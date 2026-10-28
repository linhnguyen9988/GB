'use strict';
const DBConnection = require("../../configs/DBConnection");
const FormData = require('form-data');
const SqlString = require('sqlstring');
const axios = require('axios');
const fs = require('fs');
const mime = require('mime-types');
const sharp = require('sharp');
const upload = require('../../middleware/upload');
const { GlobalPageID, GlobalPageID2 } = require('../../configs/constants');
const { codeToEmoji } = require('../../utils/emoji');
const { getPageToken } = require('../../services/pageTokenService');
const { getRecentCommentIdsFromDB } = require('../../services/commentService');

module.exports = function registerMessagesRoutes(router) {
    router.post('/api/send-message', (req, res) => {
        upload.single('image')(req, res, async (err) => {
            if (err) {
                console.error('Lỗi khi upload file:', err.message);
                return res.status(400).json({ success: false, error: err.message });
            }

            const { customerId, message, currentPageID } = req.body;
            const file = req.file;
            let attachmentId = null;
            let attachmentType = 'image';
            let token = await getPageToken(currentPageID);
            const sendMessageWithPayload = async (payload) => {
                try {
                    const response = await axios.post(
                        `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
                        payload
                    );
                    return { success: true, response: response.data, error: null };
                } catch (error) {
                    return { success: false, response: null, error: error };
                }
            };

            const sendDirectMessage = async (imageContent, textContent, mediaType) => {
                let imageSent = false;
                let textSent = false;
                if (imageContent) {
                    let payload = {
                        recipient: { id: customerId },
                        messaging_type: 'UPDATE',
                        message: { attachment: { type: mediaType || 'image', payload: { attachment_id: imageContent } } }
                    };
                    const result = await sendMessageWithPayload(payload);
                    if (result.success) {
                        imageSent = true;
                    } else {
                        const errorData = (result.error && result.error.response && result.error.response.data) ? result.error.response.data.error : null;
                        if (errorData && (errorData.code === 2018286 || errorData.code === 10)) {
                            payload = Object.assign({}, payload, { messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' });
                            const retryResult = await sendMessageWithPayload(payload);
                            if (retryResult.success) {
                                imageSent = true;
                            }
                        }
                    }
                }
                if (textContent) {
                    let payload = {
                        recipient: { id: customerId },
                        messaging_type: 'UPDATE',
                        message: { text: textContent }
                    };
                    const result = await sendMessageWithPayload(payload);
                    if (result.success) {
                        textSent = true;
                    } else {
                        const errorData = (result.error && result.error.response && result.error.response.data) ? result.error.response.data.error : null;
                        if (errorData && (errorData.code === 2018286 || errorData.code === 10)) {
                            payload = Object.assign({}, payload, { messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' });
                            const retryResult = await sendMessageWithPayload(payload);
                            if (retryResult.success) {
                                textSent = true;
                            }
                        }
                    }
                }
                const success = (!imageContent || imageSent) && (!textContent || textSent);
                const mediaLabel = mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'audio' : 'ảnh';
                const message = (imageSent && textSent) ? `Đã gửi cả ${mediaLabel} và văn bản thành công.` :
                    (imageSent) ? `Gửi ${mediaLabel} thành công, nhưng văn bản thất bại.` :
                        (textSent) ? `Gửi văn bản thành công, nhưng ${mediaLabel} thất bại.` :
                            `Không thể gửi cả ${mediaLabel} và văn bản.`;

                return { success, message, imageSent, textSent };
            };

            const sendPrivateReply = async (imageContent, textContent, mediaType) => {
                try {
                    const recentCommentIds = await getRecentCommentIdsFromDB(customerId);
                    if (!recentCommentIds || recentCommentIds.length === 0) {
                        return {
                            success: false,
                            message: "Không tìm thấy bình luận nào gần đây để Private Reply.",
                            imageStatus: imageContent ? 'failed' : 'not_provided',
                            textStatus: textContent ? 'failed' : 'not_provided'
                        };
                    }

                    let imageSent = !imageContent;
                    let textSent = !textContent;
                    let finalError = null;

                    for (const commentId of recentCommentIds) {
                        if (imageSent && textSent) break;
                        //console.log(`Private Reply: ${commentId}`);
                        if (imageContent && !imageSent) {
                            const imagePayload = {
                                messaging_type: 'RESPONSE',
                                recipient: { comment_id: commentId },
                                message: { attachment: { type: mediaType || 'image', payload: { attachment_id: imageContent } } }
                            };
                            const imageResult = await sendMessageWithPayload(imagePayload);
                            if (imageResult.success) {
                                //console.log(`Thành công (P): ${commentId}`);
                                imageSent = true;
                            } else {
                                finalError = imageResult.error;
                            }
                        }
                        if (textContent && !textSent) {
                            const textPayload = {
                                messaging_type: 'RESPONSE',
                                recipient: { comment_id: commentId },
                                message: { text: textContent }
                            };
                            const textResult = await sendMessageWithPayload(textPayload);
                            if (textResult.success) {
                                //console.log(`Thành công (T): ${commentId}`);
                                textSent = true;
                            } else {
                                finalError = textResult.error;
                            }
                        }
                    }
                    const finalSuccess = imageSent && textSent;
                    const mediaLabel = mediaType === 'video' ? 'video' : mediaType === 'audio' ? 'audio' : 'ảnh';
                    let finalMessage = "";
                    if (imageContent && textContent) {
                        if (imageSent && textSent) finalMessage = `Tin nhắn (${mediaLabel} và văn bản) đã được gửi thành công qua Private Reply.`;
                        else if (imageSent) finalMessage = `Đã gửi ${mediaLabel} thành công, nhưng không thể gửi văn bản qua Private Reply.`;
                        else if (textSent) finalMessage = `Đã gửi văn bản thành công, nhưng không thể gửi ${mediaLabel} qua Private Reply.`;
                        else finalMessage = `Không thể gửi cả ${mediaLabel} và văn bản qua Private Reply.`;
                    } else if (imageContent) {
                        finalMessage = imageSent ? `Tin nhắn ${mediaLabel} đã được gửi thành công qua Private Reply.` : `Không thể gửi tin nhắn ${mediaLabel} qua Private Reply.`;
                    } else if (textContent) {
                        finalMessage = textSent ? "Tin nhắn văn bản đã được gửi thành công qua Private Reply." : "Không thể gửi tin nhắn văn bản qua Private Reply.";
                    }

                    return {
                        success: finalSuccess,
                        message: finalMessage,
                        error: finalError,
                        imageStatus: imageContent ? (imageSent ? 'sent' : 'failed') : 'not_provided',
                        textStatus: textContent ? (textSent ? 'sent' : 'failed') : 'not_provided'
                    };
                } catch (dbError) {
                    console.error('Lỗi khi lấy comment ID từ DB:', dbError.message);
                    return {
                        success: false,
                        message: "Lỗi khi truy xuất dữ liệu bình luận từ hệ thống.",
                        imageStatus: imageContent ? 'failed' : 'not_provided',
                        textStatus: textContent ? 'failed' : 'not_provided'
                    };
                }
            };

            try {
                if (file && file.path) {
                    const mimeType = file.mimetype || mime.lookup(file.originalname) || '';
                    if (mimeType.startsWith('video/')) {
                        attachmentType = 'video';
                    } else if (mimeType.startsWith('audio/')) {
                        attachmentType = 'audio';
                    } else {
                        attachmentType = 'image';
                    }

                    let uploadFilePath = file.path;

                    if (attachmentType === 'image') {
                        const optimizedImagePath = file.path + '_optimized.jpg';
                        try {
                            await sharp(file.path)
                                .rotate()
                                .resize(1024, 1024, { fit: sharp.fit.inside, withoutEnlargement: true })
                                .jpeg({ quality: 70 })
                                .toFile(optimizedImagePath);
                            fs.unlinkSync(file.path);
                            uploadFilePath = optimizedImagePath;
                        } catch (optimizationError) {
                            console.error('Lỗi khi tối ưu hóa hoặc upload ảnh:', optimizationError.message);
                            return res.status(500).json({ success: false, error: 'Lỗi khi xử lý hình ảnh.' });
                        }
                    }

                    try {
                        const form = new FormData();
                        form.append('message', JSON.stringify({ attachment: { type: attachmentType, payload: { is_reusable: true } } }));
                        form.append('filedata', fs.createReadStream(uploadFilePath));
                        const uploadResponse = await axios.post(
                            `https://graph.facebook.com/v19.0/me/message_attachments?access_token=${token}`,
                            form,
                            { headers: form.getHeaders() }
                        );
                        attachmentId = uploadResponse.data.attachment_id;
                        fs.unlinkSync(uploadFilePath);
                    } catch (uploadError) {
                        console.error('Lỗi khi upload file đính kèm lên Facebook:', uploadError.message);
                        try { fs.unlinkSync(uploadFilePath); } catch (e) { }
                        return res.status(500).json({ success: false, error: 'Lỗi khi xử lý file đính kèm.' });
                    }
                }
                if (!attachmentId && !message) {
                    return res.json({ success: true, message: "Không có nội dung để gửi." });
                }
                const directMessageResult = await sendDirectMessage(attachmentId, message, attachmentType);
                if (directMessageResult.success) {
                    return res.json({
                        success: true,
                        message: directMessageResult.message,
                        imageSent: !attachmentId || directMessageResult.imageSent,
                        textSent: !message || directMessageResult.textSent
                    });
                }

                const needImage = !!attachmentId && !directMessageResult.imageSent;
                const needText = !!message && !directMessageResult.textSent;

                let imageSent = directMessageResult.imageSent;
                let textSent = directMessageResult.textSent;
                let privateReplyRan = false;
                let privateReplyResult = null;

                if (needImage || needText) {
                    privateReplyRan = true;
                    privateReplyResult = await sendPrivateReply(
                        needImage ? attachmentId : null,
                        needText ? message : null,
                        attachmentType
                    );
                    imageSent = needImage ? (privateReplyResult.imageStatus === 'sent') : imageSent;
                    textSent = needText ? (privateReplyResult.textStatus === 'sent') : textSent;
                }

                const overallOk = (!attachmentId || imageSent) && (!message || textSent);
                if (overallOk) {
                    return res.json({
                        success: true,
                        message: privateReplyRan ? privateReplyResult.message : directMessageResult.message,
                        imageSent,
                        textSent
                    });
                }

                const failedParts = [];
                if (attachmentId && !imageSent) {
                    failedParts.push(attachmentType === 'video' ? 'video' : attachmentType === 'audio' ? 'audio' : 'ảnh');
                }
                if (message && !textSent) failedParts.push('tin nhắn văn bản');
                const reason = privateReplyRan
                    ? privateReplyResult.message
                    : (failedParts.length ? `Không thể gửi ${failedParts.join(' và ')}.` : 'Không thể gửi tin nhắn.');

                return res.status(400).json({
                    success: false,
                    error: reason,
                    imageSent,
                    textSent
                });
            } catch (error) {
                console.error('Lỗi server tổng quát:', error.response ? JSON.stringify(error.response.data) : error.message);
                res.status(500).json({ success: false, error: 'Lỗi server khi xử lý tin nhắn.' });
            }
        });
    });

    router.get('/api/last-messages', async (req, res) => {
        const sqlQuery = `
    SELECT 
    t1.messid, t1.sender, t1.recipient, t1.message, t1.time, t1.timestamp, t1.image, t1.template_json, t1.is_echo, 
    k.fbname AS ten_khach, k.label AS label, k.note AS note, k.id AS khid
FROM messaging t1
INNER JOIN (
    SELECT MAX(id) AS max_id
    FROM (
        (SELECT id, recipient AS khach_id
         FROM messaging 
         WHERE sender IN (?, ?)
         ORDER BY id DESC LIMIT 100)
        
        UNION ALL
        
        (SELECT id, sender AS khach_id
         FROM messaging 
         WHERE recipient IN (?, ?)
         ORDER BY id DESC LIMIT 100)
    ) AS tmp
    GROUP BY khach_id
    ORDER BY max_id DESC
    LIMIT 100
) AS t2 ON t1.id = t2.max_id
LEFT JOIN khachhang k ON k.userid = IF(t1.sender IN (?, ?), t1.recipient, t1.sender)
ORDER BY t1.id DESC;
    `;

        const queryParams = [
            GlobalPageID, GlobalPageID2,
            GlobalPageID, GlobalPageID2,
            GlobalPageID, GlobalPageID2
        ];

        DBConnection.query(sqlQuery, queryParams, (err, results) => {
            if (err) {
                console.error('Lỗi truy vấn cơ sở dữ liệu:', err);
                return res.status(500).json({ error: 'Không thể lấy dữ liệu tin nhắn' });
            }

            const processedResults = results.map(row => {
                if (row.image) {
                    row.images = row.image.split(';').filter(url => url.trim() !== '');
                } else {
                    row.images = [];
                }
                return row;
            });
            res.json(processedResults);
        });
    });

    router.get('/api/messages/:customerId', function (req, res) {
        const customerId = req.params.customerId;
        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID is required.' });
        }
        const offset = parseInt(req.query.offset, 10) || 0;
        let limit = parseInt(req.query.limit, 10) || 10;

        if (limit > 50) {
            limit = 50;
        }
        const queryMessages = SqlString.format(
            'SELECT * FROM messaging WHERE sender = ? OR recipient = ? ORDER BY id DESC LIMIT ? OFFSET ?;',
            [customerId, customerId, limit, offset]
        );

        DBConnection.query(queryMessages, function (error, messages) {
            if (error) {
                console.error('Lỗi khi lấy tin nhắn:', error);
                return res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu' });
            }
            const messageMessids = messages.map(msg => msg.messid);

            if (messageMessids.length === 0) {
                return res.status(200).json([]);
            }

            const queryReactions = SqlString.format(
                'SELECT messid, emoji_code, COUNT(*) as count FROM reactions WHERE messid IN (?) GROUP BY messid, emoji_code;',
                [messageMessids]
            );

            DBConnection.query(queryReactions, function (err, reactions) {
                if (err) {
                    console.error('Lỗi khi lấy reactions:', err.code, err.sqlMessage);
                    reactions = [];
                }

                const reactionsMap = new Map();
                reactions.forEach(reaction => {
                    if (!reactionsMap.has(reaction.messid)) {
                        reactionsMap.set(reaction.messid, []);
                    }
                    reactionsMap.get(reaction.messid).push({
                        emoji: codeToEmoji(reaction.emoji_code),
                        count: Number(reaction.count)
                    });
                });

                const messagesWithReactions = messages.map(msg => {
                    const messageReactions = reactionsMap.get(msg.messid);
                    msg.reactions = messageReactions || [];
                    return msg;
                });

                res.status(200).json(messagesWithReactions);
            });
        });
    });
};
