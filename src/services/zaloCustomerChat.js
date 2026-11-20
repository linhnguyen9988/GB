'use strict';

const { createHash, randomUUID } = require('node:crypto');
const sharp = require('sharp');
const db = require('../configs/DBConnection');
const zalo = require('./zaloConnection');
const { eventId } = zalo;
const { readZaloContent } = require('./zaloMessageContent');
const { storeZaloImage } = require('./zaloMediaStorage');
const { archiveZaloMessage } = require('./zaloIncomingMediaStorage');
const { resolveSticker } = require('./zaloStickerService');
const reactions = require('./zaloReactionService');
const social = require('./zaloSocialService');
const { scheduleFriendRequest } = require('./zaloFriendRequest');

const isId = value => typeof value === 'string' && /^\d{1,64}$/.test(value);
const keyFor = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const debugReceive = process.env.ZALO_CHAT_DEBUG === '1';
const isOrderConfirmation = text => typeof text === 'string' &&
    /(?:^|\n)\s*Đơn hàng chị có\s*:/iu.test(text.normalize('NFC'));

const outgoingByThread = new Map();

function beginOutgoing(accountId, uid) {
    const key = accountId + ':' + uid;
    const jobs = outgoingByThread.get(key) || new Set();
    let done;
    const job = new Promise(resolve => { done = resolve; });
    jobs.add(job);
    outgoingByThread.set(key, jobs);
    return () => {
        done();
        jobs.delete(job);
        if (!jobs.size) outgoingByThread.delete(key);
    };
}

async function findMappedCustomer(session, uid) {
    const [customers] = await db.query(
        `SELECT CAST(userid AS CHAR) AS customer_id, CAST(pageid AS CHAR) AS page_id, phone, zalo_phone, fbname
         FROM khachhang WHERE zalo_account_id = ? AND zaloid = ?
         ORDER BY zalo_linked_at DESC, id DESC`, [session.accountId, uid]
    );
    return customers.find(row => {
        try { return isId(row.customer_id) && isId(row.page_id) && zalo.normalizePhone(row.phone) === row.zalo_phone; }
        catch (_) { return false; }
    });
}

async function saveMessage(conn, { mid, customerId, pageId, text, image, timestamp, actor, isRead = 0, template = null }) {
    await conn.query(
        `INSERT IGNORE INTO messaging
            (messid, sender, recipient, message, image, time, timestamp, is_echo, sent_by_user_id, sent_by_username, isread, channel, template_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'zalo', ?)`,
        [mid, actor ? pageId : customerId, actor ? customerId : pageId, text || null, image || null,
            new Date(timestamp).toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }), timestamp,
            actor ? 1 : 0, actor?.id ?? null, actor?.username ?? null, isRead, template ? JSON.stringify(template) : null]
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
    void require('./zaloCustomerProfileSync').enqueueWhere(db, 'k.id = ?', [String(customer.id)]).catch(error => {
        console.warn('[Hồ sơ Zalo] Chưa xếp được lượt đồng bộ:', error.code || error.name);
    });
    return uid;
}

async function sendPart(session, uid, { customerId, pageId, clientMessageId, actor, text, image, link }) {
    const key = keyFor(session.accountId, pageId, customerId, clientMessageId, image ? 'image' : 'text');
    const captionKey = image && text ? keyFor(session.accountId, pageId, customerId, clientMessageId, 'text') : null;
    const keys = captionKey ? [key, captionKey] : [key];
    if (captionKey) {
        try {
            await db.query('INSERT INTO gb_zalo_chat_delivery (send_key) VALUES (?), (?)', keys);
        } catch (error) {
            // Reserve both parts in one statement. An existing part must not be sent again in a caption.
            if (error.code === 'ER_DUP_ENTRY') return 'existing';
            throw error;
        }
    } else {
        const [claim] = await db.query('INSERT IGNORE INTO gb_zalo_chat_delivery (send_key) VALUES (?)', [key]);
        if (!claim.affectedRows) {
            const [[row]] = await db.query('SELECT state FROM gb_zalo_chat_delivery WHERE send_key = ?', [key]);
            return row?.state === 'sent' ? 'sent' : 'uncertain';
        }
    }
    if (!await zalo.isSavedSessionCurrent(session)) {
        await db.query('DELETE FROM gb_zalo_chat_delivery WHERE send_key IN (?)', [keys]);
        throw new zalo.ZaloActionError(409, 'Kết nối Zalo vừa thay đổi. Vui lòng thử lại.');
    }
    scheduleFriendRequest(session, uid);
    const capability = require('./zaloMessageCapability');
    let providerMessageId;
    try {
        if (image) {
            const { data, info } = image;
            const result = await session.api.sendMessage({
                msg: text || '',
                attachments: [{ data, filename: 'anh-don.jpg', metadata: { totalSize: data.length, width: info.width, height: info.height } }]
            }, uid, session.userThread);
            const attachment = result?.attachment?.find(item => item.msgId != null);
            if (!attachment) return 'uncertain';
            providerMessageId = eventId(attachment.msgId);
        } else if (link) {
            const result = await session.api.sendLink({ link, msg: text }, uid, session.userThread);
            if (result?.msgId == null) return 'uncertain';
            providerMessageId = eventId(result.msgId);
        } else {
            const result = await zalo.sendText(session, uid, text, session.userThread);
            providerMessageId = result.messageId;
        }
    } catch (error) {
        capability.recordSend(session, uid, false, error);
        if (error.status === 422 || (error.name === 'ZcaApiError' && Number(error.code) > 0)) {
            await db.query('DELETE FROM gb_zalo_chat_delivery WHERE send_key IN (?)', [keys]);
            return 'rejected';
        }
        return 'uncertain';
    }
    if (!providerMessageId) return 'uncertain';
    capability.recordSend(session, uid, true);
    try {
        const imageUrl = image ? await storeZaloImage(image.data, key) : null;
        let mid;
        await withTransaction(async conn => {
            const receipt = await reactions.linkMessage(conn, session.accountId, uid, [providerMessageId], key);
            mid = 'zalo:' + receipt.key;
            const storedText = link ? `${text || ''}
${link}` : text;
            const template = imageUrl ? { template_type: 'zalo_media',
                attachments: [{ url: imageUrl, kind: 'image', stored: true }] } : null;
            await saveMessage(conn, { mid, customerId, pageId, text: storedText,
                image: imageUrl, timestamp: Date.now(), actor, isRead: receipt.isRead, template });
            await conn.query(
                `UPDATE messaging SET message = COALESCE(?, message), image = COALESCE(?, image),
                 template_json = COALESCE(?, template_json), sent_by_user_id = ?, sent_by_username = ?,
                 isread = GREATEST(isread, ?) WHERE messid = ? AND channel = 'zalo' AND is_echo = 1`,
                [storedText || null, imageUrl, template ? JSON.stringify(template) : null,
                    actor?.id ?? null, actor?.username ?? null, receipt.isRead, mid]
            );
            await reactions.projectReactions(conn, session.accountId, uid, mid);
            await conn.query("UPDATE gb_zalo_chat_delivery SET state = 'sent', image_url = ?, image_data = NULL WHERE send_key = ?",
                [imageUrl, key]);
            if (captionKey) {
                await conn.query("UPDATE gb_zalo_chat_delivery SET state = 'sent' WHERE send_key = ?", [captionKey]);
            }
        });
        reactions.publish(mid);
    } catch (_) {
        return 'uncertain';
    }
    return 'sent';
}

async function sendCustomerMessage({ customerId, pageId, clientMessageId, actor, text, file, link }) {
    const result = { imageSent: false, textSent: false, uncertain: false };
    let finishOutgoing;
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
        finishOutgoing = beginOutgoing(session.accountId, uid);
        const input = { customerId, pageId, clientMessageId, actor };
        let imageStatus, textStatus;
        if (image && text && !link) {
            const combined = await sendPart(session, uid, { ...input, image, text });
            if (combined !== 'existing') imageStatus = textStatus = combined;
        }
        if (!imageStatus && !textStatus) {
            const results = await Promise.allSettled([
                image ? sendPart(session, uid, { ...input, image }) : null,
                text ? sendPart(session, uid, { ...input, text, link }) : null
            ]);
            [imageStatus, textStatus] = results.map(part => part.status === 'fulfilled' ? part.value : 'uncertain');
        }
        result.imageSent = imageStatus === 'sent';
        result.textSent = textStatus === 'sent';
        result.uncertain = imageStatus === 'uncertain' || textStatus === 'uncertain';
        if (result.uncertain) result.error = 'Chưa xác nhận được kết quả gửi Zalo. Kiểm tra cuộc trò chuyện trước khi gửi lại.';
        else if ((file && !result.imageSent) || (text && !result.textSent)) result.error = 'Zalo từ chối gửi ảnh hoặc nội dung tin nhắn.';
    } catch (error) {
        result.error = error instanceof zalo.ZaloActionError ? error.message : 'Không hoàn tất được thao tác gửi Zalo.';
    } finally {
        finishOutgoing?.();
    }
    return result;
}

async function receiveMessage(session, event) {
    if (!event || event.type !== session.userThread) return;
    const { content, ts, msgType } = event.data || {};
    const uid = event.isSelf ? eventId(event.threadId) || eventId(event.data?.idTo) : eventId(event.data?.uidFrom);
    const msgId = [event.data?.msgId, event.data?.realMsgId].map(eventId).find(id => id && id !== '0');
    if (!uid || uid === session.accountId || !msgId) return;
    if (event.isSelf) {
        const jobs = outgoingByThread.get(session.accountId + ':' + uid);
        if (jobs) await Promise.all([...jobs]);
    }
    if (!await zalo.isSavedSessionCurrent(session)) return;
    const customer = await findMappedCustomer(session, uid);
    if (!customer) {
        if (debugReceive) console.info('[Tin nhắn Zalo] Chưa ghép được khách cho UID đuôi', uid.slice(-6));
        return;
    }
    let normalizedContent = content;
    if (msgType === 'chat.sticker') {
        try { normalizedContent = await resolveSticker(session, content); }
        catch (error) { console.warn('[Sticker Zalo] Không lấy được chi tiết:', error.code || error.name); }
    }
    const { text, image, template } = readZaloContent(msgType, normalizedContent);
    // friend_event already records the centered system notice. Zalo may also
    // emit the same notice through its message stream, including the GB alias.
    if (!event.isSelf && !image && !template &&
        require('../public/js/zalo-system-notice').isFriendAdded(text, customer.fbname)) return;
    const time = Number(ts);
    const timestamp = Number.isSafeInteger(time) && time > 0 && time <= 8640000000000000 ? time : Date.now();
    const ids = [msgId];
    const clientId = eventId(event.data?.cliMsgId);
    if (clientId && clientId !== '0' && clientId.length <= 62) ids.push('c:' + clientId);
    let mid;
    await withTransaction(async conn => {
        const receipt = await reactions.linkMessage(conn, session.accountId, uid, ids, keyFor(session.accountId, uid, msgId));
        mid = 'zalo:' + receipt.key;
        await saveMessage(conn, { mid, customerId: customer.customer_id, pageId: customer.page_id,
            text, image, template, timestamp, isRead: receipt.isRead,
            actor: event.isSelf ? { id: null, username: 'Zalo' } : null });
        await reactions.projectReactions(conn, session.accountId, uid, mid);
    });
    if (template?.template_type === 'zalo_media') {
        await db.query(
            `UPDATE messaging SET message = ? WHERE messid = ? AND channel = 'zalo'
             AND message IN ('[Ảnh Zalo chưa có đường dẫn]', '[Tệp đính kèm Zalo]', '[Sticker Zalo chưa lấy được dữ liệu]')`,
            [text || null, mid]
        );
        const [[stored]] = await db.query('SELECT sent_by_user_id FROM messaging WHERE messid = ? LIMIT 1', [mid]);
        if (!event.isSelf || !stored?.sent_by_user_id) await archiveZaloMessage(db, mid, template);
    }
    if (event.isSelf) require('./zaloMessageCapability').recordSend(session, uid, true);
    reactions.publish(mid);
    if (debugReceive) console.info('[Tin nhắn Zalo] Đã lưu tin', event.isSelf ? 'shop gửi' : 'khách gửi', 'UID đuôi', uid.slice(-6));
}

async function receiveFriendEvent(session, event) {
    await social.receiveFriendRequest(session, event);
    const labels = {
        0: name => 'Bạn vừa kết bạn với ' + name,
        1: name => 'Bạn và ' + name + ' không còn là bạn bè',
        2: name => event.isSelf ? 'Bạn đã gửi lời mời kết bạn tới ' + name : name + ' đã gửi lời mời kết bạn',
        3: name => 'Lời mời kết bạn với ' + name + ' đã được thu hồi',
        4: name => 'Lời mời kết bạn với ' + name + ' đã bị từ chối',
        6: name => 'Bạn đã chặn ' + name, 7: name => 'Bạn đã bỏ chặn ' + name,
        8: name => 'Bạn đã chặn cuộc gọi từ ' + name, 9: name => 'Bạn đã bỏ chặn cuộc gọi từ ' + name
    };
    if (!event || !labels[event.type] || !await zalo.isSavedSessionCurrent(session)) return;
    const uid = [event.threadId, event.data?.fromUid, event.data?.toUid, event.data]
        .map(eventId).find(id => id && id !== session.accountId);
    if (!uid) return;
    const customer = await findMappedCustomer(session, uid);
    if (!customer) return;
    if (Number(event.type) === 0) {
        await require('./zaloFriendQueue').friendAccepted(session, uid);
        const profiles = require('./zaloCustomerProfileSync');
        await profiles.enqueueWhere(db, 'k.zalo_account_id = ? AND k.zaloid = ?', [session.accountId, uid]);
        await profiles.wake(session.accountId, uid);
    }
    const text = labels[event.type](customer.fbname || customer.phone || 'khách hàng');
    await withTransaction(async conn => {
        await conn.query('INSERT IGNORE INTO gb_zalo_friend_state (account_id, thread_id) VALUES (?, ?)', [session.accountId, uid]);
        const [[state]] = await conn.query(
            'SELECT last_type FROM gb_zalo_friend_state WHERE account_id = ? AND thread_id = ? FOR UPDATE', [session.accountId, uid]
        );
        if (state.last_type !== null && Number(state.last_type) === Number(event.type)) return;
        await conn.query('UPDATE gb_zalo_friend_state SET last_type = ? WHERE account_id = ? AND thread_id = ?',
            [event.type, session.accountId, uid]);
        await saveMessage(conn, {
            mid: 'zalo:' + keyFor(session.accountId, uid, 'friend', randomUUID()),
            customerId: customer.customer_id, pageId: customer.page_id, text, timestamp: Date.now(),
            template: { template_type: 'zalo_system', text, event: Number(event.type) }
        });
    });
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
    let friendQueueBusy = false;
    setInterval(async () => {
        if (!current || friendQueueBusy) return;
        friendQueueBusy = true;
        try { await require('./zaloFriendQueue').tick(current); }
        catch (error) { console.warn('[Hàng chờ kết bạn Zalo] Lỗi xử lý:', error.code || error.name); }
        finally { friendQueueBusy = false; }
    }, 1000).unref();
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
                listener.on('reaction', event => reactions.receiveReaction(session, event).catch(error => {
                    console.warn('[Reaction Zalo] Lỗi lưu:', error.code || error.name);
                }));
                listener.on('old_reactions', (events, isGroup) => {
                    if (isGroup || !Array.isArray(events)) return;
                    for (const event of events) reactions.receiveReaction(session, event).catch(error => {
                        console.warn('[Reaction Zalo] Lỗi lưu lịch sử:', error.code || error.name);
                    });
                });
                listener.on('old_messages', (events, type) => {
                    if (type !== session.userThread || !Array.isArray(events)) return;
                    for (const event of events) receiveMessage(session, event).catch(error => {
                        console.warn('[Tin nhắn Zalo] Lỗi lưu lịch sử:', error.code || error.name);
                    });
                });
                listener.on('friend_event', event => receiveFriendEvent(session, event).catch(error => {
                    console.warn('[Thông báo Zalo] Lỗi lưu:', error.code || error.name);
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
            if (current) {
                await social.processPending(current);
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
