'use strict';

const { createHash } = require('node:crypto');
const sharp = require('sharp');
const db = require('../configs/DBConnection');
const zalo = require('./zaloConnection');
const { eventId } = zalo;

const isId = value => typeof value === 'string' && /^\d{1,64}$/.test(value);
const keyFor = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const debugReceive = process.env.ZALO_CHAT_DEBUG === '1';
const isOrderConfirmation = text => typeof text === 'string' &&
    /(?:^|\n)\s*Đơn hàng chị có\s*:/iu.test(text.normalize('NFC'));

async function saveMessage(conn, { mid, customerId, pageId, text, image, timestamp, actor, isRead = 0 }) {
    await conn.query(
        `INSERT IGNORE INTO messaging
            (messid, sender, recipient, message, image, time, timestamp, is_echo, sent_by_user_id, sent_by_username, isread, channel)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'zalo')`,
        [mid, actor ? pageId : customerId, actor ? customerId : pageId, text || null, image || null,
            new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }), timestamp,
            actor ? 1 : 0, actor?.id ?? null, actor?.username ?? null, isRead]
    );
}

async function withTransaction(write) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await write(conn);
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

async function resolveCustomer(session, customerId, pageId) {
    const [[customer]] = await db.query(
        'SELECT id, phone, zaloid, zalo_account_id, zalo_phone FROM khachhang WHERE userid = ? AND pageid = ? LIMIT 1',
        [customerId, pageId]
    );
    if (!customer) throw new zalo.ZaloActionError(404, 'Không tìm thấy khách trên Page này.');
    let phone;
    try {
        phone = zalo.normalizePhone(customer.phone);
    } catch (_) {
        throw new zalo.ZaloActionError(400, 'Khách chưa có số điện thoại hợp lệ để tra Zalo.');
    }
    const uid = customer.zalo_account_id === session.accountId && customer.zalo_phone === phone && isId(customer.zaloid)
        ? customer.zaloid : (await zalo.findRecipient(session, phone)).uid;
    const [updated] = await db.query(
        `UPDATE khachhang SET zaloid = ?, zalo_account_id = ?, zalo_phone = ?, zalo_linked_at = UTC_TIMESTAMP(6)
           WHERE id = ? AND phone <=> ? AND userid = ? AND pageid = ?`,
        [uid, session.accountId, phone, customer.id, customer.phone, customerId, pageId]
    );
    if (!updated.affectedRows) throw new zalo.ZaloActionError(409, 'Thông tin khách vừa thay đổi. Vui lòng thử lại.');
    return uid;
}

async function sendPart(session, uid, { customerId, pageId, clientMessageId, actor, text, image }) {
    const key = keyFor(session.accountId, pageId, customerId, clientMessageId, image ? 'image' : 'text');
    const [claim] = await db.query('INSERT IGNORE INTO gb_zalo_chat_delivery (send_key) VALUES (?)', [key]);
    if (!claim.affectedRows) {
        const [[row]] = await db.query('SELECT state FROM gb_zalo_chat_delivery WHERE send_key = ?', [key]);
        return row?.state === 'sent' ? 'sent' : 'uncertain';
    }
    if (!await zalo.isSavedSessionCurrent(session)) {
        await db.query('DELETE FROM gb_zalo_chat_delivery WHERE send_key = ?', [key]);
        throw new zalo.ZaloActionError(409, 'Kết nối Zalo vừa thay đổi. Vui lòng thử lại.');
    }
    let providerMessageId;
    try {
        if (image) {
            const { data, info } = image;
            const result = await session.api.sendMessage({
                msg: '',
                attachments: [{ data, filename: 'anh-don.jpg', metadata: { totalSize: data.length, width: info.width, height: info.height } }]
            }, uid, session.userThread);
            const attachment = result?.attachment?.find(item => item.msgId != null);
            if (!attachment) return 'uncertain';
            providerMessageId = eventId(attachment.msgId);
        } else {
            const result = await zalo.sendText(session, uid, text, session.userThread);
            providerMessageId = result.messageId;
        }
    } catch (error) {
        if (error.status === 422 || (error.name === 'ZcaApiError' && Number(error.code) > 0)) {
            await db.query('DELETE FROM gb_zalo_chat_delivery WHERE send_key = ?', [key]);
            return 'rejected';
        }
        return 'uncertain';
    }
    try {
        await withTransaction(async conn => {
            let isRead = 0;
            if (providerMessageId) {
                const receiptKey = [session.accountId, uid, providerMessageId];
                await conn.query(
                    `INSERT INTO gb_zalo_chat_receipt (account_id, thread_id, message_id, send_key)
                     VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE send_key = ?`,
                    [...receiptKey, key, key]
                );
                const [[receipt]] = await conn.query(
                    'SELECT is_seen FROM gb_zalo_chat_receipt WHERE account_id = ? AND thread_id = ? AND message_id = ? FOR UPDATE',
                    receiptKey
                );
                isRead = receipt.is_seen;
            }
            await saveMessage(conn, { mid: 'zalo:' + key, customerId, pageId, text,
                image: image ? '/api/messages/zalo-image/' + key : null, timestamp: Date.now(), actor, isRead });
            await conn.query("UPDATE gb_zalo_chat_delivery SET state = 'sent', image_data = ? WHERE send_key = ?",
                [image?.data ?? null, key]);
        });
    } catch (_) {
        return 'uncertain';
    }
    return 'sent';
}

async function sendCustomerMessage({ customerId, pageId, clientMessageId, actor, text, file }) {
    const result = { imageSent: false, textSent: false, uncertain: false };
    try {
        if (!isId(customerId) || !isId(pageId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(clientMessageId || '')) {
            throw new zalo.ZaloActionError(400, 'Thiếu thông tin cuộc trò chuyện hoặc mã gửi Zalo.');
        }
        if (text && typeof text !== 'string') throw new zalo.ZaloActionError(400, 'Nội dung tin nhắn không hợp lệ.');
        let image;
        if (file) {
            if (file.mimetype && file.mimetype !== 'application/octet-stream' && !file.mimetype.startsWith('image/')) {
                throw new zalo.ZaloActionError(400, 'Gửi lại bằng Zalo hỗ trợ tin chữ và hình ảnh.');
            }
            try {
                image = await sharp(file.path).rotate().resize(1280, 1280, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 80 }).toBuffer({ resolveWithObject: true });
            } catch (_) {
                throw new zalo.ZaloActionError(400, 'Không đọc được ảnh để gửi Zalo.');
            }
        }
        const session = await zalo.openSavedSession(90000);
        if (!session) throw new zalo.ZaloActionError(409, 'GB chưa kết nối tài khoản Zalo.');
        const uid = await resolveCustomer(session, customerId, pageId);
        const input = { customerId, pageId, clientMessageId, actor };
        if (image) {
            const status = await sendPart(session, uid, { ...input, image });
            result.imageSent = status === 'sent';
            result.uncertain = status === 'uncertain';
        }
        if (text) {
            const status = await sendPart(session, uid, { ...input, text });
            result.textSent = status === 'sent';
            result.uncertain ||= status === 'uncertain';
        }
        if (result.uncertain) result.error = 'Chưa xác nhận được kết quả gửi Zalo. Kiểm tra cuộc trò chuyện trước khi gửi lại.';
        else if ((file && !result.imageSent) || (text && !result.textSent)) result.error = 'Zalo từ chối gửi ảnh hoặc nội dung tin nhắn.';
    } catch (error) {
        result.error = error instanceof zalo.ZaloActionError ? error.message : 'Không hoàn tất được thao tác gửi Zalo.';
    }
    return result;
}

async function receiveMessage(session, event) {
    if (!event || event.isSelf || event.type !== session.userThread) return;
    const { content, ts, msgType } = event.data || {};
    const uidFrom = eventId(event.data?.uidFrom);
    const msgId = eventId(event.data?.msgId);
    if (!uidFrom || !msgId) {
        if (debugReceive) console.info('[Tin nhắn Zalo] Bỏ qua tin đến vì UID hoặc mã tin không hợp lệ.');
        return;
    }
    if (!await zalo.isSavedSessionCurrent(session)) return;
    const [customers] = await db.query(
        `SELECT CAST(userid AS CHAR) AS customer_id, CAST(pageid AS CHAR) AS page_id, phone, zalo_phone
           FROM khachhang WHERE zalo_account_id = ? AND zaloid = ?
           ORDER BY zalo_linked_at DESC, id DESC`,
        [session.accountId, uidFrom]
    );
    const customer = customers.find(row => {
        try { return zalo.normalizePhone(row.phone) === row.zalo_phone; } catch (_) { return false; }
    });
    if (!customer || !isId(customer.customer_id) || !isId(customer.page_id)) {
        if (debugReceive) console.info('[Tin nhắn Zalo] Chưa ghép được khách cho UID đuôi', uidFrom.slice(-6),
            'trên tài khoản đuôi', session.accountId.slice(-6), 'Số hồ sơ khớp UID:', customers.length);
        return;
    }
    const url = msgType === 'share.photo' && (content?.href || content?.thumb);
    const image = typeof url === 'string' && /^https:\/\/[^\s;"<>]+$/i.test(url) ? url : null;
    const text = typeof content === 'string' ? content.slice(0, 8000) : (image ? null : '[Tệp đính kèm Zalo]');
    const time = Number(ts);
    const timestamp = Number.isSafeInteger(time) && time > 0 && time <= 8640000000000000 ? time : Date.now();
    await saveMessage(db, { mid: 'zalo:' + keyFor(session.accountId, uidFrom, msgId),
        customerId: customer.customer_id, pageId: customer.page_id, text, image, timestamp });
    if (debugReceive) console.info('[Tin nhắn Zalo] Đã xử lý tin đến từ UID đuôi', uidFrom.slice(-6));
}

async function receiveSeenMessages(session, events) {
    if (!Array.isArray(events) || !await zalo.isSavedSessionCurrent(session)) return;
    for (const event of events) {
        if (!event || event.isSelf || event.type !== session.userThread) continue;
        const threadId = eventId(event.threadId);
        const messageId = eventId(event.data?.realMsgId ?? event.data?.msgId);
        if (!threadId || threadId === session.accountId || !messageId) continue;
        const receiptKey = [session.accountId, threadId, messageId];
        // Keep receipts even if they arrive before the send transaction links the message.
        await withTransaction(async conn => {
            await conn.query(
                `INSERT INTO gb_zalo_chat_receipt (account_id, thread_id, message_id, is_seen)
                 VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE is_seen = 1`,
                receiptKey
            );
            const [[receipt]] = await conn.query(
                'SELECT send_key FROM gb_zalo_chat_receipt WHERE account_id = ? AND thread_id = ? AND message_id = ? FOR UPDATE',
                receiptKey
            );
            if (receipt.send_key) {
                await conn.query("UPDATE messaging SET isread = 1 WHERE messid = ? AND channel = 'zalo' AND is_echo = 1",
                    ['zalo:' + receipt.send_key]);
            }
        });
    }
}

function startListener() {
    let current;
    let busy = false;
    let lastError;
    setInterval(async () => {
        if (busy) return;
        busy = true;
        try {
            if (current && !await zalo.isSavedSessionCurrent(current)) {
                current.api.listener.stop();
                current = undefined;
            }
            if (!current) {
                const session = await zalo.openSavedSession();
                if (!session) return;
                const listener = session.api.listener;
                listener.on('message', event => receiveMessage(session, event).catch(error => {
                    console.warn('[Tin nhắn Zalo] Lỗi lưu tin đến:', error.code || error.name);
                }));
                listener.on('seen_messages', events => receiveSeenMessages(session, events).catch(error => {
                    console.warn('[Tin nhắn Zalo] Lỗi lưu trạng thái đã xem:', error.code || error.name);
                }));
                listener.on('connected', () => {
                    if (debugReceive) console.info('[Tin nhắn Zalo] Đã mở kết nối nhận tin cho tài khoản đuôi', session.accountId.slice(-6));
                });
                listener.on('error', error => {
                    if (debugReceive) console.warn('[Tin nhắn Zalo] Lỗi kết nối nhận tin:', error?.code || error?.name || 'WebSocket');
                });
                listener.on('closed', code => {
                    if (debugReceive) console.info('[Tin nhắn Zalo] Đã đóng kết nối nhận tin:', code);
                    if (current === session) current = undefined;
                });
                listener.start();
                current = session;
            }
            lastError = undefined;
        } catch (error) {
            const code = error.code || error.name;
            if (code !== lastError) console.warn('[Tin nhắn Zalo] Lỗi mở kết nối:', code);
            lastError = code;
        } finally {
            busy = false;
        }
    }, 10000).unref();
}

module.exports = { isOrderConfirmation, sendCustomerMessage, startListener };
