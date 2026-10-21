import DBConnection from "../../configs/DBConnection";
import { v2 as cloudinary } from 'cloudinary';
const SqlString = require('sqlstring');
const axios = require('axios');
const socket = require('../../socket');
const { AKA_SQL } = require('../../services/akaService');
const { AVA_DIR, FB_WEBHOOK_VERIFY_TOKEN, GlobalPageID, GlobalPageID2, MESSPIC_DIR } = require('../../configs/constants');
const { CreateOrderID } = require('../../utils/orderId');
const { GetUserToken, ShareToPage2, fetchFbProfile, runGetConversations } = require('../../services/facebookService');
const { LocDau, normalizePhone } = require('../../utils/text');
const { codeToEmoji, decodeEmoji, emojiToCode } = require('../../utils/emoji');
const { download } = require('../../utils/download');
const { emitReactionSummary } = require('../../services/reactionService');
const { formatFbTime } = require('../../utils/dateTime');
const { getNextCloudinary } = require('../../services/cloudinaryService');
const { getPageToken } = require('../../services/pageTokenService');
const { tryInsertMessageAsComment } = require('../../services/commentService');

module.exports = function registerFacebookWebhook(router) {
    router.get(['/facebook', '/instagram', '/threads'], function (req, res) {
        if (
            req.query['hub.mode'] == 'subscribe' &&
            req.query['hub.verify_token'] == FB_WEBHOOK_VERIFY_TOKEN
        ) {
            res.send(req.query['hub.challenge']);
        } else {
            res.sendStatus(400);
        }
    });

    router.post('/facebook', async function (req, res) {
        res.sendStatus(200);
        const io = socket.getIo();
        const EmitMessage = async (id, phone, picture, sender, recipient, text, timemess, fbname, messageImg, label, pageid, diachi, nuocngoai, is_echo, note, messid, templateJson, replyTo) => {
            const newMessageData = {
                id: id,
                messid: messid || null,
                phone: phone,
                picture: picture,
                senderId: sender,
                recipientId: recipient,
                messageText: text,
                timestamp: timemess,
                fbname: fbname,
                messageImg: messageImg,
                label: label,
                pageid: pageid,
                diachi: diachi,
                nuocngoai: nuocngoai,
                is_echo: is_echo,
                note: note || '',
                template: templateJson || null, // JSON string: { template_type, text, buttons[] } - null nếu tin nhắn thường
                // Snapshot tin nhắn được reply (nếu có): { mid, text, image, sender } - null nếu tin nhắn thường
                replyTo: replyTo || null
            };
            io.emit('new-message', newMessageData);
        }
        if (req.body.entry[0].hasOwnProperty('messaging')) {
            const value = req.body.entry[0].messaging[0];
            var messid, sender, recipient, text, timemess = '', khachhang, pageid, token;

            if (value.hasOwnProperty('message')) {
                sender = value.sender.id;
                recipient = value.recipient.id;

                var isPage1 = (sender === GlobalPageID || recipient === GlobalPageID);
                pageid = isPage1 ? GlobalPageID : GlobalPageID2;
                token = await getPageToken(pageid);
                khachhang = (sender === GlobalPageID || sender === GlobalPageID2) ? recipient : sender;

                var messData = value.message || {};
                var text = messData.text;
                var messid = messData.mid;
                var attachments = messData.attachments;
                var is_echo = messData.is_echo;
                var replyToMid = (messData.reply_to && messData.reply_to.mid) ? messData.reply_to.mid : null;
                var echo;
                if (is_echo) {
                    echo = 1;
                } else {
                    echo = 0;
                }
                var timemess = new Date(value.timestamp).toLocaleString("en-US", { timeZone: "Asia/Saigon" });
                var finalImageString = '';
                var templateJson = null;
                var replyToText = null, replyToImage = null, replyToSender = null;
                if (replyToMid) {
                    try {
                        var origRow = await new Promise((resolve) => {
                            DBConnection.query(
                                'SELECT message, image, sender, template_json FROM messaging WHERE messid = ? LIMIT 1',
                                [replyToMid],
                                (err, rows) => resolve(err ? null : (rows && rows[0]) || null)
                            );
                        });
                        if (origRow) {
                            replyToSender = origRow.sender;
                            if (origRow.message) {
                                replyToText = origRow.message.length > 200 ? origRow.message.slice(0, 200) + '…' : origRow.message;
                            } else if (origRow.template_json) {
                                try {
                                    var origTpl = JSON.parse(origRow.template_json);
                                    replyToText = '🔘 ' + (origTpl.text || 'Tin nhắn có nút bấm');
                                } catch (e) { replyToText = '🔘 Tin nhắn có nút bấm'; }
                            } else if (origRow.image) {
                                replyToText = null;
                            }
                            if (origRow.image) {
                                replyToImage = origRow.image.split(';')[0] || null;
                            }
                        } else {
                            replyToText = null;
                        }
                    } catch (e) {
                        console.error('Lỗi tra cứu tin nhắn gốc (reply_to):', e);
                    }
                }

                if (messid) {
                    const alreadyExists = await new Promise((resolveCheck) => {
                        DBConnection.query(
                            'SELECT 1 FROM messaging WHERE messid = ? LIMIT 1',
                            [messid],
                            (err, rows) => resolveCheck(!err && rows && rows.length > 0)
                        );
                    });
                    if (alreadyExists) {
                        console.log(`[FB webhook] messid=${messid} đã tồn tại, bỏ qua (webhook trùng)`);
                        return;
                    }
                }

                try {
                    if (attachments) {
                        //console.log('[FB webhook raw attachments]', JSON.stringify(attachments));
                        var imageList = [];
                        var seenAttUrls = {};
                        var pushUnique = (val) => { if (val && imageList.indexOf(val) === -1) imageList.push(val); };

                        var mapBtn = (b) => ({
                            type: b.type,
                            title: b.title,
                            url: b.url || null,
                            payload: b.payload || null
                        });

                        for (var i = 0; i < attachments.length; i++) {
                            var att = attachments[i];

                            if (att.type === 'template' && att.payload) {
                                var tType = att.payload.template_type || 'button';
                                templateJson = JSON.stringify({
                                    template_type: tType,
                                    text: att.title || att.payload.text || '',
                                    buttons: [
                                        ...(att.payload.button ? [mapBtn(att.payload.button)] : []),
                                        ...((att.payload.buttons || []).map(mapBtn))
                                    ],
                                    elements: att.payload.elements ? att.payload.elements.map(el => ({
                                        title: el.title,
                                        subtitle: el.subtitle,
                                        image_url: el.image_url || (el.media_type === 'image' ? el.url : null),
                                        quantity: el.quantity,
                                        price: el.price,
                                        currency: el.currency,
                                        buttons: (el.buttons || []).map(mapBtn)
                                    })) : undefined,
                                    receipt: tType === 'receipt' ? {
                                        order_number: att.payload.order_number,
                                        currency: att.payload.currency,
                                        payment_method: att.payload.payment_method,
                                        summary: att.payload.summary,
                                        address: att.payload.address
                                    } : undefined
                                });
                                continue;
                            }

                            if (att.type === 'fallback' && att.payload) {
                                templateJson = JSON.stringify({
                                    template_type: 'fallback',
                                    text: att.payload.title || 'Đã chia sẻ 1 liên kết',
                                    buttons: att.payload.url
                                        ? [{ type: 'web_url', url: att.payload.url, title: 'Xem nội dung' }]
                                        : []
                                });
                                continue;
                            }

                            if (att.type === 'location' && att.payload) {
                                var coords = att.payload.coordinates;
                                var mapUrl = att.payload.url || (coords ? `https://www.google.com/maps?q=${coords.lat},${coords.long}` : null);
                                templateJson = JSON.stringify({
                                    template_type: 'location',
                                    text: att.payload.title || 'Đã chia sẻ vị trí',
                                    buttons: mapUrl ? [{ type: 'web_url', url: mapUrl, title: 'Xem vị trí trên bản đồ' }] : []
                                });
                                continue;
                            }

                            if ((att.type === 'reel' || att.type === 'ig_reel') && att.payload) {
                                var reelThumb = null;
                                if (att.payload.reel_video_id) {
                                    try {
                                        const reelRes = await fetch(
                                            `https://graph.facebook.com/v19.0/${att.payload.reel_video_id}?fields=picture&access_token=${token}`
                                        );
                                        const reelData = await reelRes.json();
                                        if (reelData && reelData.picture) reelThumb = reelData.picture;
                                    } catch (e) {
                                        console.error('Lỗi lấy thumbnail reel:', e.message);
                                    }
                                }
                                templateJson = JSON.stringify({
                                    template_type: att.type,
                                    text: att.payload.title || 'Đã chia sẻ 1 Reel',
                                    thumbnail: reelThumb,
                                    url: att.payload.url || null
                                });
                                continue;
                            }

                            var url = (att.payload && att.payload.url) ? att.payload.url : null;
                            if (!url) continue;

                            if (seenAttUrls[url]) continue;
                            seenAttUrls[url] = true;

                            if (url.indexOf('cloudinary') !== -1) {
                                pushUnique(url);
                                continue;
                            }

                            var contentType = '';
                            try {
                                const headRes = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
                                contentType = headRes.headers.get('content-type') || '';
                            } catch (e) {
                                console.error('[FB webhook] HEAD lỗi, suy ra loại tệp từ att.type:', e.message);
                                contentType = att.type === 'image' ? 'image/jpeg'
                                    : att.type === 'video' ? 'video/mp4'
                                    : att.type === 'audio' ? 'audio/mpeg' : '';
                            }
                            if (contentType.includes('text/html') || contentType.includes('application/json')) continue;

                            var picname = CreateOrderID();
                            if (contentType.startsWith('image/')) {
                                var currentCloud = null;
                                try {
                                    var isLike = ['39178562_1505197616293642', '851587_369239346556147', '851582_369239386556143'].some(id => url.includes(id));
                                    if (isLike) {
                                        pushUnique('/images/messpic/like.jpg');
                                    } else {
                                        currentCloud = getNextCloudinary();

                                        var uploadResult = await cloudinary.uploader.upload(url, {
                                            public_id: picname,
                                            folder: 'messenger_images',
                                            transformation: [{ width: 768, crop: "limit" }, { quality: "auto:eco" }]
                                        });
                                        pushUnique(uploadResult.secure_url);
                                    }
                                } catch (e) {
                                    console.error(`[Cloudinary] Upload lỗi (cloud=${currentCloud || 'n/a'}):`, (e && (e.message || (e.error && e.error.message))) || e);
                                    try {
                                        var ext = await download(url, picname, MESSPIC_DIR);
                                        pushUnique('/images/messpic/' + picname + '.' + (ext || 'jpg'));
                                    } catch (e2) {
                                        console.error('[messpic] Tải ảnh về local cũng lỗi, giữ link gốc của Facebook:', e2.message);
                                        pushUnique(url);
                                    }
                                }
                            } else if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
                                try {
                                    var ext = await download(url, picname, MESSPIC_DIR);
                                    pushUnique('/images/messpic/' + picname + '.' + (ext || 'mp4'));
                                } catch (e2) {
                                    console.error('[messpic] Tải video/audio về local lỗi, giữ link gốc:', e2.message);
                                    pushUnique(url);
                                }
                            }
                        }
                        finalImageString = imageList.join(';') + (imageList.length ? ';' : '');
                    }

                    await new Promise((resolve) => {
                        var sqlMsg = SqlString.format(
                            'INSERT IGNORE INTO messaging (messid,sender,recipient,message,image,template_json,time,timestamp,is_echo,reply_to_mid,reply_to_text,reply_to_image,reply_to_sender) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?);',
                            [messid, sender, recipient, text || null, finalImageString || null, templateJson, timemess, value.timestamp, echo, replyToMid, replyToText, replyToImage, replyToSender]
                        );

                        DBConnection.query(sqlMsg, async function (err, result) {
                            if (err) { console.error("Lỗi lưu tin:", err); return resolve(); }

                            if (!result || result.affectedRows === 0) {
                                console.log(`[FB webhook] Bỏ qua tin nhắn trùng, messid=${messid}`);
                                return resolve();
                            }

                            DBConnection.query("SELECT * FROM khachhang WHERE userid=? LIMIT 1", [khachhang], async function (error, data) {
                                var curCus = (data && data.length > 0) ? data[0] : null;

                                if (curCus) {
                                    var qrPayload = messData.quick_reply && messData.quick_reply.payload;
                                    var isPhoneQR = !is_echo && qrPayload && /^\+?[\d\s.\-()]{8,20}$/.test(String(qrPayload));

                                    if (isPhoneQR) {
                                        if (!curCus.phone) {
                                            var qrPhone = normalizePhone(qrPayload);
                                            DBConnection.query('UPDATE khachhang SET phone=? WHERE id=?', [qrPhone, curCus.id]);
                                            curCus.phone = qrPhone;
                                        }
                                    } else if (text && !is_echo && !curCus.phone) {
                                        var phoneMatch = text.match(/0[98735]([0-9]|\s|-|\.){8,12}/);
                                        if (phoneMatch) {
                                            var newPhone = phoneMatch[0].replace(/\D/g, '');
                                            DBConnection.query('UPDATE khachhang SET phone=? WHERE id=?', [newPhone, curCus.id]);
                                            curCus.phone = newPhone;
                                        }
                                    }
                                    const avatar = `https://aodaigiabao.com/images/ava/${khachhang}.jpg`
                                    EmitMessage(curCus.id, curCus.phone, avatar, sender, recipient, text || '', timemess, curCus.fbname, finalImageString, curCus.label, curCus.pageid, curCus.diachi, curCus.nuocngoai, echo, curCus.note, messid, templateJson, replyToMid ? { mid: replyToMid, text: replyToText, image: replyToImage, sender: replyToSender } : null);
                                    if (!is_echo && text && !isPhoneQR && sender !== GlobalPageID && sender !== GlobalPageID2) {
                                        tryInsertMessageAsComment(khachhang, sender, text, timemess, pageid, io);
                                    }
                                    resolve();
                                } else if (!is_echo) {
                                    var fbname = 'Khách hàng', picture = '', phone = '';
                                    try {
                                        var fbRes = await fetch("https://graph.facebook.com/" + khachhang + "/?fields=picture{url},name&access_token=" + token);
                                        var prof = await fbRes.json();
                                        fbname = prof.name || 'Khách hàng';
                                        picture = (prof.picture && prof.picture.data) ? prof.picture.data.url : '';
                                        if (picture) download(picture, khachhang, AVA_DIR).catch(() => { });
                                    } catch (e) { }

                                    if (text && !text.includes('/')) {
                                        var phoneMatch = text.match(/0[98735]([0-9]|\s|-|\.){8,12}/);
                                        if (phoneMatch) phone = phoneMatch[0].replace(/\D/g, '');
                                    }

                                    var sqlInsert = SqlString.format('INSERT INTO khachhang (userid,fbname,phone,avalink,pageid,fbnamex,tag,diachi,label) VALUES(?,?,?,?,?,?,?,?,?)',
                                        [khachhang, fbname, phone, picture, pageid, LocDau(fbname), khachhang, '', '']);

                                    DBConnection.query(sqlInsert, function (err, result) {
                                        if (err && err.code !== 'ER_DUP_ENTRY') console.error('Lỗi thêm khách mới:', err);
                                        if (!err) {
                                            axios.post("https://graph.facebook.com/v19.0/me/messages?access_token=" + token, {
                                                recipient: { id: khachhang },
                                                messaging_type: "RESPONSE",
                                                message: {
                                                    text: "Áo dài Gia Bảo chào " + fbname + "! Mã của bạn: " + khachhang +
                                                          "\nBấm nút bên dưới để cung cấp SĐT chốt đơn ạ.",
                                                    quick_replies: [{ content_type: "user_phone_number" }]
                                                }
                                            }).catch((e) => console.error('Lỗi gửi tin chào:', (e.response && e.response.data) || e.message));

                                            EmitMessage(result.insertId, phone, picture, sender, recipient, text || '', timemess, fbname, finalImageString, '', pageid, '', '', echo, '', messid, templateJson, replyToMid ? { mid: replyToMid, text: replyToText, image: replyToImage, sender: replyToSender } : null);
                                            if (!is_echo && text && sender !== GlobalPageID && sender !== GlobalPageID2) {
                                                tryInsertMessageAsComment(khachhang, sender, text, timemess, pageid, io);
                                            }
                                        }
                                        resolve(); // Xong khách mới
                                    });
                                } else {
                                    resolve(); // Kết thúc echo
                                }
                            });
                        });
                    });
                } catch (err) {
                    console.error("Lỗi xử lý: ", err);
                }
            } else if (value.hasOwnProperty('read')) {
                const watermark = value.read.watermark;
                const senderId = value.sender.id;
                DBConnection.query(
                    'UPDATE messaging SET isread = 1 WHERE recipient = ? AND timestamp <= ?',
                    [senderId, watermark],
                    (error, results) => {
                        if (error) {
                            console.error('Lỗi khi cập nhật trạng thái đã đọc:', error);
                        } else {
                            //console.log(`Đã cập nhật ${results.affectedRows} tin nhắn là đã đọc.`);
                        }
                    }
                );
                io.emit('read', {
                    senderId: senderId,
                    watermark: watermark,
                });
                return;
            } else if (value.hasOwnProperty('reaction')) {
                const senderId = value.sender.id;
                const mid = value.reaction.mid;
                const action = value.reaction.action || 'react';
                const emoji = decodeEmoji(value.reaction.emoji);
                const emojiCode = emojiToCode(emoji);
                if (!mid) return;

                const done = (error) => {
                    if (error) console.error('Lỗi lưu reaction:', error.code, error.sqlMessage, emojiCode);
                    emitReactionSummary(io, mid, { senderId: senderId, emoji: codeToEmoji(emojiCode), action: action });
                };

                if (action === 'unreact') {
                    DBConnection.query('DELETE FROM reactions WHERE messid = ? AND sender_id = ?', [mid, senderId], done);
                } else if (!emojiCode) {
                    console.error('Reaction không có emoji:', JSON.stringify(value.reaction));
                } else {
                    DBConnection.query(
                        'INSERT INTO reactions (messid, sender_id, emoji_code, timestamp) VALUES (?, ?, ?, ?) ' +
                        'ON DUPLICATE KEY UPDATE emoji_code = VALUES(emoji_code), timestamp = VALUES(timestamp)',
                        [mid, senderId, emojiCode, value.timestamp],
                        done
                    );
                }
                return;
            } else if (value.referral) {
                const ref = value.referral;
                const ctx = ref.ads_context_data || {};

                const sqlRef = SqlString.format(
                    'INSERT INTO messaging_referrals (sender_id, ad_id, ad_title, post_id, video_url, source, type, timestamp) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?)',
                    [value.sender.id, ref.ad_id, ctx.ad_title, ctx.post_id, ctx.video_url, ref.source, ref.type, value.timestamp]
                );

                DBConnection.query(sqlRef, (err) => {
                    if (err) console.error("Lỗi lưu thông tin quảng cáo:", err);
                });

                const post_id = value.referral.ads_context_data.post_id;
                const khachhang_id = value.sender.id;

                const sqlGetInfo = `
                    SELECT k.fbname, k.avalink, 
                    (SELECT COUNT(*) FROM messaging_referrals WHERE post_id = ?) AS total_interactions
                    FROM khachhang k 
                    WHERE k.userid = ? 
                    LIMIT 1`;

                DBConnection.query(sqlGetInfo, [post_id, khachhang_id], (err, results) => {
                    if (err) {
                        console.error("Lỗi truy vấn dữ liệu referral:", err);
                        return;
                    }

                    const customerName = (results.length > 0) ? results[0].fbname : "Khách hàng mới";
                    const totalInteractions = (results.length > 0) ? results[0].total_interactions : 1;

                    io.to(post_id).emit('new-referral', {
                        referral: value.referral,
                        fbname: customerName,
                        total_interactions: totalInteractions,
                        timestamp: value.timestamp
                    });
                });
            }
        } else if (req.body.entry[0].hasOwnProperty('changes')) {
            const change = req.body.entry[0].changes[0];
            const { value } = change;//cai nay phai {} moi dc
            if (value.hasOwnProperty('verb')) {
                if (value.verb === 'add' && value.item != 'comment') {
                    if (value.item == 'reaction') {
                        var sql = SqlString.format('INSERT INTO postreaction (name,userid,time,postid,type) VALUES(?,?,?,?,?);', [value.from.name, value.from.id, value.created_time, value.post_id.split('_')[1], value.reaction_type]);
                        DBConnection.query(sql);
                    } else if (value.item == 'share') {
                        //var sql = SqlString.format('INSERT INTO postshare (name,userid,time,postid,newpostid) VALUES(?,?,?,?,?);', [value.from.name, value.from.id, value.created_time, value.link.match(/(\d+)\/$/)[1], value.post_id.split('_')[1]]);
                        //DBConnection.query(sql);
                    }
                    //value.item - status - photo - video - dang tim them
                    //console.log(req.body.entry[0]);
                    //console.log(value);
                } else if (value.item == 'comment' && value.verb == 'add') {
                    if (!value.hasOwnProperty('from')) {
                        console.log('Comment outside owner page.');
                        return;
                    }

                    var parent_id = '';
                    var fbname = '';
                    var idx = '';
                    var token = '';
                    var pageid = req.body.entry[0].id;
                    var pic = 'none';
                    var userid = value.from.id;
                    var message = value.message;
                    var cmtid = value.comment_id;
                    var time = value.created_time;
                    var liveid = value.post_id.split('_')[1];
                    var timelocal = new Date(time * 1000).toLocaleString("en-US", { timeZone: "Asia/Saigon" });
                    if (value.parent_id) {
                        parent_id = value.parent_id;
                    }
                    token = await getPageToken(pageid);

                    if (!value.from.hasOwnProperty('name')) {
                        const prof = await fetchFbProfile(value.from.id, pageid);
                        if (prof) {
                            pic = prof.pic || pic;
                            fbname = prof.name;
                        }
                    } else {
                        fbname = value.from.name;
                    }
                    if (fbname == '') {
                        console.log('[comment] Không lấy được tên khách:', JSON.stringify(value.from));
                    }

                    if (message == null || message == undefined) {
                        message = '';
                    }
                    function queryAsync(sql) {
                        return new Promise((resolve, reject) => {
                            DBConnection.query(sql, (error, results) => {
                                if (error) {
                                    return reject(error);
                                }
                                resolve(results);
                            });
                        });
                    }

                    try {
                        const customerData = await queryAsync(`SELECT * FROM khachhang WHERE userid='${userid}' LIMIT 1`);

                        if (customerData.length > 0) {
                            if (!fbname) fbname = customerData[0].fbname || '';
                            const cmtSql = SqlString.format('INSERT IGNORE INTO livecomment (commentid,liveid,userid,name,message,chot,gia,timecomment,datecreate,luotin,count,app,pageid,realfbid,parent_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE realfbid=?;',
                                [cmtid, liveid, userid, fbname, message, '', '', 0, timelocal, 0, 0, 'Linh', pageid, customerData[0].realfbid, parent_id, customerData[0].realfbid]);
                            const results = await queryAsync(cmtSql);
                            idx = results.insertId;
                            if (results.affectedRows === 0) return;
                            const khachhangSql = SqlString.format('INSERT INTO khachhang (userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex,realfbid) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fbname=?, fbnamex=?, realfbid=?;',
                                [userid, fbname, customerData[0].phone, customerData[0].diachi, pic, customerData[0].uname, customerData[0].gender, customerData[0].label, pageid, LocDau(fbname), customerData[0].realfbid, fbname, LocDau(fbname), customerData[0].realfbid]);
                            await queryAsync(khachhangSql);
                        } else {
                            var picture = pic !== 'none' ? pic : '';
                            if (!picture || !fbname) {
                                const prof = await fetchFbProfile(userid, pageid);
                                if (prof) {
                                    picture = prof.pic || picture;
                                    if (!fbname) fbname = prof.name;
                                }
                            }
                            const cmtSql = SqlString.format('INSERT IGNORE INTO livecomment (commentid,liveid,userid,name,message,chot,gia,timecomment,datecreate,luotin,count,app,pageid,parent_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?);',
                                [cmtid, liveid, userid, fbname, message, '', '', 0, timelocal, 0, 0, 'Linh', pageid, parent_id]);
                            const results = await queryAsync(cmtSql);
                            idx = results.insertId;
                            if (results.affectedRows === 0) return;
                            const khachhangSql = SqlString.format('INSERT INTO khachhang (userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fbname=?, fbnamex=?, avalink=?;',
                                [userid, fbname, '', '', picture, '', '', '', pageid, LocDau(fbname), fbname, LocDau(fbname), picture]);
                            await queryAsync(khachhangSql);
                        }

                        const customerInfoResult = await queryAsync(`SELECT *, ${AKA_SQL} FROM khachhang WHERE userid='${userid}' LIMIT 1`);
                        const customerInfo = (customerInfoResult && customerInfoResult.length > 0) ? customerInfoResult[0] : {};

                        const newCommentData = {
                            idx: idx,
                            picture: picture,
                            cmtid: cmtid,
                            liveid: liveid,
                            pageid: pageid,
                            fbname: fbname,
                            message: message,
                            timelocal: timelocal,
                            customerInfo: customerInfo
                        };
                        io.to(liveid).emit('new-comment', newCommentData);
                    } catch (err) {
                        console.log('ERROR: SQL TRANSACTION FAILED', err);
                    }
                }
            } else {
                if (req.body.entry[0].changes[0].field == 'live_videos') {
                    const pageId = req.body.entry[0].id;

                    DBConnection.query("SELECT accesstoken FROM pageinfo WHERE pageid='" + pageId + "'", async function (error, data) {
                        if (error) {
                            console.error('Lỗi DB pageinfo:', error);
                            return;
                        }
                        if (data && data.length > 0) {
                            try {
                                const token = data[0].accesstoken;
                                const query = `https://graph.facebook.com/${value.id}/?fields=live_views,from,id,title,video,status,creation_time,description,permalink_url&access_token=${token}`;

                                const fbRes = await axios.get(query);
                                const fbData = fbRes.data;

                                if (fbData && fbData.video && fbData.video.id) {
                                    const liveId = fbData.video.id;
                                    const status = fbData.status;
                                    const liveViews = fbData.live_views || 0;

                                    const livestatus = {
                                        liveid: liveId,
                                        status: status
                                    };

                                    io.emit('live-status', livestatus);

                                    runGetConversations();

                                    const sql = SqlString.format(
                                        `INSERT INTO postlive (liveid, liveidwh, status, liveviews) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE status=?, liveviews=?;`,
                                        [liveId, fbData.id, status, liveViews, status, liveViews]
                                    );

                                    const sql2 = SqlString.format(
                                        'INSERT IGNORE INTO livestream (id, name, time, note, luotincuoi, luotlive, livedesc) VALUES(?,?,?,?,?,?,?);',
                                        [liveId, formatFbTime(fbData.creation_time), '', '', '', '', fbData.description || '']
                                    );

                                    DBConnection.query(sql);
                                    DBConnection.query(sql2);

                                    if (status === 'LIVE') {
                                        const newLivestream = {
                                            liveid: liveId,
                                            name: formatFbTime(fbData.creation_time),
                                            status: status,
                                            luotincuoi: 0
                                        };
                                        io.emit('new-livestream', newLivestream);
                                        GetUserToken();
                                        ShareToPage2(fbData.title || '', liveId);
                                    }
                                }
                            } catch (err) {
                                console.error('Lỗi gọi Facebook Graph API:', err.message);
                            }
                        }
                    });
                }
            }
        }
    });

    router.post('/instagram', function (req, res) {
        console.log('Instagram request body:');
        console.log(req.body);
        res.sendStatus(200);
    });

    router.post('/threads', function (req, res) {
        console.log('Threads request body:');
        console.log(req.body);
        res.sendStatus(200);
    });
};
