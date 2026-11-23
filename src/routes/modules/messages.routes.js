'use strict';
const DBConnection = require("../../configs/DBConnection");
const SqlString = require('sqlstring');
const fs = require('fs');
const mime = require('mime-types');
const upload = require('../../middleware/upload');
const { GlobalPageID, GlobalPageID2 } = require('../../configs/constants');
const { codeToEmoji } = require('../../utils/emoji');
const { deliver } = require('../../services/chatDeliveryService');
const { conversationMessageSql, conversationMessageParams } = require('../../services/chatSystemMessageFilter');
const { findParts } = require('../../services/chatSendParts');
const { attachReactionSummaries, zaloReactionUpdates } = require('../../services/reactionService');

module.exports = function registerMessagesRoutes(router) {
    router.post('/api/zalo-message-heart', require('../../middleware/jwtAuth'), async (req, res) => {
        if (req.get('X-GB-Zalo-Action') !== '1') return res.status(403).json({ error: 'Yêu cầu không hợp lệ.' });
        try {
            return res.json(await require('../../services/zaloSendReaction').heartMessage(req.body?.mid));
        } catch (error) {
            const ActionError = require('../../services/zaloConnection').ZaloActionError;
            return res.status(error instanceof ActionError ? error.status : 502).json({
                error: error instanceof ActionError ? error.message : 'Zalo chưa xác nhận thả tim. Hãy kiểm tra tin nhắn.'
            });
        }
    });
    router.post('/api/send-message', require('../../middleware/jwtAuth'), (req, res) => {
        upload.single('image')(req, res, async (err) => {
            if (err) {
                console.error('Lỗi khi upload file:', err.message);
                return res.status(400).json({ success: false, error: err.message });
            }

            const { customerId, currentPageID, message, clientMessageId, deliveryChannel, orderConfirmation } = req.body;
            const file = req.file;
            const mimeType = file?.mimetype || (file && mime.lookup(file.originalname)) || '';
            const attachmentType = mimeType.startsWith('video/') ? 'video' : mimeType.startsWith('audio/') ? 'audio' : 'image';
            try {
                const { status, body } = await deliver({
                    user: req.user, customerId, pageId: currentPageID, message, file,
                    attachmentType, clientMessageId, deliveryChannel, orderConfirmation
                });
                return res.status(status).json(body);
            } catch (error) {
                console.error('Lỗi xử lý gửi tin:', error.code || error.name);
                return res.status(500).json({ success: false, error: 'Lỗi server khi xử lý tin nhắn.' });
            } finally {
                if (file?.path) await fs.promises.unlink(file.path).catch(() => {});
            }
        });
    });

    router.get('/api/last-messages', async (req, res) => {
        const sqlQuery = `
    SELECT 
    t1.messid, t1.sender, t1.recipient, t1.message, t1.time, t1.timestamp, t1.image, t1.template_json, t1.is_echo, t1.sent_by_user_id, t1.sent_by_username, t1.channel,
    k.fbname AS ten_khach, k.label AS label, k.note AS note, k.id AS khid
FROM messaging t1
INNER JOIN (
    SELECT MAX(id) AS max_id
    FROM (
        (SELECT id, recipient AS khach_id
         FROM messaging 
         WHERE sender IN (?, ?) AND ${conversationMessageSql}
         ORDER BY id DESC LIMIT 100)
        
        UNION ALL
        
        (SELECT id, sender AS khach_id
         FROM messaging 
         WHERE recipient IN (?, ?) AND ${conversationMessageSql}
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
            GlobalPageID, GlobalPageID2, ...conversationMessageParams,
            GlobalPageID, GlobalPageID2, ...conversationMessageParams,
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

    router.get('/api/messages/:customerId', async function (req, res) {
        const customerId = req.params.customerId;
        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID is required.' });
        }
        const offset = parseInt(req.query.offset, 10) || 0;
        if (req.query.afterId !== undefined || req.query.afterZaloId !== undefined) {
            const { afterId, afterZaloId, zaloReadFromId, pending, pageId, reactionMids } = req.query;
            const cursor = afterId ?? afterZaloId;
            const validId = value => typeof value === 'string' && /^\d{1,20}$/.test(value);
            if (!validId(cursor) || (zaloReadFromId !== undefined && !validId(zaloReadFromId))) {
                return res.status(400).json([]);
            }
            try {
                const [[messages], [readRows], deliveries, reactionUpdates] = await Promise.all([
                    DBConnection.query(
                        'SELECT *, CAST(id AS CHAR) AS history_cursor FROM messaging WHERE id > ? AND (sender = ? OR recipient = ?)' +
                        (afterId === undefined ? " AND channel = 'zalo'" : '') + ' ORDER BY id ASC LIMIT 50',
                        [cursor, customerId, customerId]
                    ),
                    zaloReadFromId && zaloReadFromId !== '0' ? DBConnection.query(
                        `SELECT CAST(id AS CHAR) AS id FROM messaging
                         WHERE recipient = ? AND channel = 'zalo' AND is_echo = 1 AND isread = 1 AND id BETWEEN ? AND ?`,
                        [customerId, zaloReadFromId, cursor]
                    ) : [[]],
                    req.user?.id && typeof pageId === 'string' && typeof pending === 'string' && pending.length <= 2020
                        ? findParts({ user: req.user, pageId, customerId, clientIds: pending.split(',').slice(0, 20) })
                        : [],
                    zaloReactionUpdates(customerId, reactionMids)
                ]);
                await attachReactionSummaries(messages);
                if (zaloReadFromId === undefined && pending === undefined && reactionMids === undefined) return res.json(messages);
                return res.json({ messages, readIds: readRows.map(row => row.id), deliveries, reactionUpdates });
            } catch (_) {
                return res.status(500).json([]);
            }
        }
        if (req.query.around !== undefined) {
            const mid = req.query.around;
            if (typeof mid !== 'string' || !mid || mid.length > 255) {
                return res.status(400).json({ error: 'Mã tin nhắn không hợp lệ.' });
            }
            try {
                const thread = 'FROM messaging WHERE (sender = ? OR recipient = ?)';
                const params = [customerId, customerId];
                const [[target]] = await DBConnection.query(
                    'SELECT *, CAST(id AS CHAR) AS history_cursor ' + thread + ' AND messid = ? LIMIT 1',
                    [...params, mid]
                );
                if (!target) return res.sendStatus(404);
                const [before, after] = await Promise.all([
                    DBConnection.query('SELECT * ' + thread + ' AND id < ? ORDER BY id DESC LIMIT 4', [...params, target.history_cursor]),
                    DBConnection.query('SELECT * ' + thread + ' AND id > ? ORDER BY id ASC LIMIT 4', [...params, target.history_cursor])
                ]);
                const messages = [...before[0].reverse(), target, ...after[0]];
                await attachReactionSummaries(messages);
                return res.json(messages);
            } catch (error) {
                console.error('Lỗi tải tin nhắn được trích dẫn:', error.message);
                return res.status(500).json({ error: 'Không tải được tin nhắn gốc.' });
            }
        }
        const beforeId = req.query.beforeId;
        if (beforeId !== undefined && (typeof beforeId !== 'string' || !/^\d{1,20}$/.test(beforeId))) {
            return res.status(400).json({ error: 'Invalid message cursor.' });
        }
        let limit = parseInt(req.query.limit, 10) || 10;

        if (limit > 50) {
            limit = 50;
        }
        const queryMessages = SqlString.format(
            'SELECT *, CAST(id AS CHAR) AS history_cursor FROM messaging WHERE (sender = ? OR recipient = ?)' +
            (beforeId === undefined ? ' ORDER BY id DESC LIMIT ? OFFSET ?;' : ' AND id < ? ORDER BY id DESC LIMIT ?;'),
            beforeId === undefined ? [customerId, customerId, limit, offset] : [customerId, customerId, beforeId, limit]
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
