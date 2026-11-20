'use strict';

const { createHash, randomInt } = require('node:crypto');
const db = require('../configs/DBConnection');
const capability = require('./zaloMessageCapability');
const { getFriendWindow } = require('./zaloFriendHours');
const idOk = value => typeof value === 'string' && /^[1-9]\d{0,63}$/.test(value);
const sleepUntil = new Map();
const greeting = 'Áo Dài Gia Bảo xin kết bạn để hỗ trợ đơn hàng của chị.';
const details = error => String(error?.message || error?.code || 'Chưa nhận được kết quả Zalo.').slice(0, 480);
const customerFields = 'CAST(k.id AS CHAR) AS customer_id, k.fbname, k.phone, k.zaloid, k.zalo_account_id, k.zalo_phone';

async function settings(accountId, conn = db) {
    await conn.query('INSERT IGNORE INTO gb_zalo_friend_queue_settings (account_id, next_api_at) VALUES (?, UTC_TIMESTAMP(3))', [accountId]);
    const [[row]] = await conn.query('SELECT s.*, CAST(s.message_cursor AS CHAR) AS message_cursor, CAST(s.customer_cursor AS CHAR) AS customer_cursor, IF(s.invite_day = DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)), s.invite_count, 0) AS used_today, GREATEST(0, TIMESTAMPDIFF(MICROSECOND, UTC_TIMESTAMP(3), s.next_api_at) / 1000, IFNULL(TIMESTAMPDIFF(MICROSECOND, UTC_TIMESTAMP(3), s.paused_until) / 1000, 0)) AS wait_ms FROM gb_zalo_friend_queue_settings s WHERE account_id = ?', [accountId]);
    return row;
}

async function event(accountId, key, detail, conn = db) {
    await conn.query('INSERT INTO gb_zalo_friend_queue_events (account_id, job_key, detail, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())', [accountId, key, String(detail).slice(0, 500)]);
}

async function enqueueCustomer(session, customer, priority = '0') {
    const zalo = require('./zaloConnection');
    let phone;
    try { phone = zalo.normalizePhone(customer.phone); }
    catch (_) {
        await capability.lookupFailure(session, customer, 'invalid_phone', 'Số điện thoại chưa hợp lệ để tra Zalo.');
        return;
    }
    // A phone has one queue entry even when several Facebook profiles share it.
    const key = 'p:' + phone;
    await db.query(`INSERT INTO gb_zalo_friend_queue
        (account_id, job_key, customer_id, customer_name, phone, priority_message_id, next_attempt_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), UTC_TIMESTAMP())
        ON DUPLICATE KEY UPDATE customer_id = IF(VALUES(priority_message_id) >= priority_message_id, VALUES(customer_id), customer_id),
        customer_name = IF(VALUES(priority_message_id) >= priority_message_id, VALUES(customer_name), customer_name),
        priority_message_id = GREATEST(priority_message_id, VALUES(priority_message_id))`,
        [session.accountId, key, customer.customer_id, customer.fbname || '', phone, priority]);
}

async function enqueueUid(session, uid) {
    if (!idOk(session?.accountId) || !idOk(uid) || uid === session.accountId) return 'ignored';
    const [rows] = await db.query(`SELECT ${customerFields},
        COALESCE((SELECT MAX(m.id) FROM messaging m WHERE m.sender = k.userid AND m.channel = 'facebook' AND m.is_echo = 0), 0) AS priority_id
        FROM khachhang k WHERE k.zalo_account_id = ? AND k.zaloid = ? ORDER BY priority_id DESC, k.id DESC LIMIT 1`, [session.accountId, uid]);
    if (rows.length) await enqueueCustomer(session, rows[0], String(rows[0].priority_id || '0'));
    await db.query(`INSERT INTO gb_zalo_friend_queue (account_id, job_key, uid, stage, state, next_attempt_at, updated_at)
        VALUES (?, ?, ?, 'status', 'waiting', UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE uid = uid`, [session.accountId, 'u:' + uid, uid]);
    sleepUntil.delete(session.accountId);
    return 'queued';
}

async function seed(session, config) {
    // The initial pass takes newest inbound Messenger conversations first. A
    // separate PK cursor fills the remaining customer history without dropping it.
    const recent = config.message_cursor == null;
    const [messages] = await db.query(`SELECT CAST(id AS CHAR) AS id, CAST(sender AS CHAR) AS sender FROM messaging
        WHERE channel = 'facebook' AND is_echo = 0 ${recent ? '' : 'AND id > ?'}
        ORDER BY id ${recent ? 'DESC' : 'ASC'} LIMIT 500`, recent ? [] : [String(config.message_cursor)]);
    const senders = new Map();
    let high = recent ? '0' : String(config.message_cursor);
    for (const message of messages) {
        if (BigInt(message.id) > BigInt(high)) high = message.id;
        const previous = senders.get(message.sender) || '0';
        if (BigInt(message.id) > BigInt(previous)) senders.set(message.sender, message.id);
    }
    if (senders.size) {
        const [customers] = await db.query(`SELECT ${customerFields}, CAST(k.userid AS CHAR) AS fbuid FROM khachhang k
            WHERE k.userid IN (?) AND k.phone IS NOT NULL AND k.phone <> '' ORDER BY k.id`, [[...senders.keys()]]);
        for (const customer of customers) await enqueueCustomer(session, customer, senders.get(customer.fbuid) || '0');
    }
    await db.query('UPDATE gb_zalo_friend_queue_settings SET message_cursor = ? WHERE account_id = ?', [high, session.accountId]);
    const [customers] = await db.query(`SELECT ${customerFields},
        COALESCE((SELECT MAX(m.id) FROM messaging m WHERE m.sender = k.userid AND m.channel = 'facebook' AND m.is_echo = 0), 0) AS priority_id
        FROM khachhang k WHERE k.id > ? AND k.phone IS NOT NULL AND k.phone <> '' ORDER BY k.id LIMIT 100`, [String(config.customer_cursor)]);
    for (const customer of customers) await enqueueCustomer(session, customer, String(customer.priority_id || '0'));
    await db.query('UPDATE gb_zalo_friend_queue_settings SET customer_cursor = ? WHERE account_id = ?',
        [customers.length ? customers.at(-1).customer_id : '0', session.accountId]);
}

async function finish(session, job, state, detail, options = {}) {
    await db.query(`UPDATE gb_zalo_friend_queue SET state = ?, stage = ?, last_error = ?,
        next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), lease_until = NULL, updated_at = UTC_TIMESTAMP()
        WHERE account_id = ? AND job_key = ?`, [state, options.stage || job.stage,
        options.error ? detail : null, options.delay || 0, session.accountId, job.job_key]);
    await event(session.accountId, job.job_key, detail);
}

async function advance(session, job, stage, detail) {
    await db.query(`UPDATE gb_zalo_friend_queue SET stage = ?, last_error = NULL, updated_at = UTC_TIMESTAMP(),
        lease_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE) WHERE account_id = ? AND job_key = ?`, [stage, session.accountId, job.job_key]);
    await event(session.accountId, job.job_key, detail);
    return { ...job, stage };
}

function withinHours() { return getFriendWindow(Date.now()).allowed; }

async function deferUntilMorning(session, job, reserved = false) {
    if (reserved) {
        // No API request has started yet. Undo this attempt marker so tomorrow's
        // status check will not mistake a time-window deferral for an unknown send.
        await db.query(`UPDATE gb_zalo_friend_queue SET invite_attempted_at = NULL
            WHERE account_id = ? AND job_key = ? AND state = 'working'`, [session.accountId, job.job_key]);
        await db.query(`UPDATE gb_zalo_friend_queue_settings SET invite_count = GREATEST(invite_count - 1, 0)
            WHERE account_id = ? AND invite_day = DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR))`, [session.accountId]);
    }
    await finish(session, job, 'waiting', 'Ngoài giờ kết bạn 07:00–23:00 GMT+7. Chờ đến 07:00 sáng.');
}

async function linkCustomer(session, job, customer, uid) {
    const zalo = require('./zaloConnection');
    let normalized;
    try { normalized = zalo.normalizePhone(customer.phone); } catch (_) { return false; }
    if (normalized !== job.phone) return false;
    const [saved] = await db.query(`UPDATE khachhang SET zaloid = ?, zalo_account_id = ?, zalo_phone = ?, zalo_linked_at = UTC_TIMESTAMP(6)
        WHERE id = ? AND phone <=> ?`, [uid, session.accountId, job.phone, customer.customer_id, customer.phone]);
    if (!saved.affectedRows) return false;
    await capability.found(session, customer, uid);
    await require('./zaloCustomerProfileSync').enqueueWhere(db, 'k.id = ?', [customer.customer_id]);
    return true;
}

async function resolveUid(session, job) {
    if (!withinHours()) return deferUntilMorning(session, job);
    const [[customer]] = await db.query(`SELECT ${customerFields} FROM khachhang k WHERE k.id = ? LIMIT 1`, [String(job.customer_id)]);
    const zalo = require('./zaloConnection');
    let samePhone = false;
    try { samePhone = customer && zalo.normalizePhone(customer.phone) === job.phone; } catch (_) { }
    if (!samePhone) {
        await finish(session, job, 'skipped', 'Số điện thoại khách đã thay đổi, bỏ lượt cũ.'); return;
    }
    let uid;
    if (customer.zalo_account_id === session.accountId && customer.zalo_phone === job.phone && idOk(customer.zaloid)) {
        uid = customer.zaloid;
        await event(session.accountId, job.job_key, 'Dùng UID đã liên kết đúng số điện thoại.');
    } else {
        await event(session.accountId, job.job_key, 'Đang tra số điện thoại trên Zalo.');
        if (!withinHours()) return deferUntilMorning(session, job);
        const recipient = await session.api.findUser(job.phone);
        uid = zalo.eventId(recipient?.uid);
        if (!uid || uid === session.accountId) {
            await capability.lookupFailure(session, customer, 'lookup_unavailable', 'Chưa tra được UID Zalo bằng số này; chưa xác định khả năng nhận tin.');
            await finish(session, job, 'not_found', 'Không tra được UID bằng SĐT. Không kết luận khách không có Zalo.'); return;
        }
    }
    if (!await zalo.isSavedSessionCurrent(session) || !await linkCustomer(session, job, customer, uid)) {
        await finish(session, job, 'skipped', 'Thông tin khách hoặc kết nối đã đổi, không ghép UID cũ.'); return;
    }
    try {
        await db.query("UPDATE gb_zalo_friend_queue SET uid = ? WHERE account_id = ? AND job_key = ?", [uid, session.accountId, job.job_key]);
    } catch (error) {
        if (error.code !== 'ER_DUP_ENTRY') throw error;
        await db.query(`UPDATE gb_zalo_friend_queue SET priority_message_id = GREATEST(priority_message_id, ?),
            customer_id = ?, customer_name = ?, phone = ?
            WHERE account_id = ? AND uid = ?`, [job.priority_message_id, job.customer_id, job.customer_name, job.phone, session.accountId, uid]);
        await finish(session, job, 'duplicate', 'UID ' + uid + ' đã có một lượt xử lý, không gửi lời mời trùng.'); return;
    }
    return advance(session, { ...job, uid }, 'status', 'Đã lấy UID ' + uid + '. Kiểm tra quan hệ bạn bè.');
}

async function validateJob(session, job) {
    const zalo = require('./zaloConnection');
    if (!await zalo.isSavedSessionCurrent(session)) throw new Error('Kết nối Zalo đã thay đổi.');
    if (!job.customer_id || !job.phone) return true;
    const [[customer]] = await db.query(`SELECT ${customerFields} FROM khachhang k WHERE k.id = ? LIMIT 1`, [String(job.customer_id)]);
    let valid = false;
    try { valid = customer && zalo.normalizePhone(customer.phone) === job.phone &&
        customer.zalo_account_id === session.accountId && customer.zaloid === job.uid && customer.zalo_phone === job.phone; } catch (_) { }
    if (!valid) await finish(session, job, 'skipped', 'Thông tin khách hoặc liên kết Zalo đã thay đổi; bỏ lượt cũ.');
    return valid;
}

async function checkStatus(session, job) {
    if (!withinHours()) return deferUntilMorning(session, job);
    if (!await validateJob(session, job)) return;
    await event(session.accountId, job.job_key, 'Đang kiểm tra đã là bạn hoặc có lời mời đang chờ.');
    if (!withinHours()) return deferUntilMorning(session, job);
    const status = await session.api.getFriendRequestStatus(job.uid);
    const raw = [status?.is_friend, status?.is_requested, status?.is_requesting];
    if (raw.some(value => ![0, 1, '0', '1'].includes(value))) throw new Error('Trạng thái kết bạn Zalo trả về không đầy đủ.');
    if (Number(raw[0]) === 1) return finish(session, job, 'friends', 'Đã là bạn bè, hoàn tất.');
    if (Number(raw[1]) === 1 || Number(raw[2]) === 1) return finish(session, job, 'pending_request', 'Đã có lời mời đang chờ, không gửi thêm.');
    if (job.invite_attempted_at) return finish(session, job, 'uncertain', 'Chưa xác nhận lời mời trước. Cần kiểm tra trực tiếp, không tự gửi lặp.', { error: true });
    return advance(session, job, 'invite', 'Chưa kết bạn, chuyển sang gửi lời mời.');
}

async function sendInvite(session, job, config) {
    if (!withinHours()) return deferUntilMorning(session, job);
    if (!await validateJob(session, job)) return;
    const [reserve] = await db.query(`UPDATE gb_zalo_friend_queue_settings SET
        invite_count = IF(invite_day = DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR)), invite_count, 0) + 1,
        invite_day = DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 7 HOUR))
        WHERE account_id = ? AND enabled = 1 AND (paused_until IS NULL OR paused_until <= UTC_TIMESTAMP())`, [session.accountId]);
    if (!reserve.affectedRows) return finish(session, job, 'waiting', 'Hàng chờ đang tạm dừng, chưa gửi lời mời.');
    if (!withinHours()) return deferUntilMorning(session, job, true);
    await db.query('UPDATE gb_zalo_friend_queue SET invite_attempted_at = UTC_TIMESTAMP() WHERE account_id = ? AND job_key = ?', [session.accountId, job.job_key]);
    await event(session.accountId, job.job_key, 'Đang gửi lời mời kết bạn.');
    try {
        if (!await require('./zaloConnection').isSavedSessionCurrent(session)) throw new Error('Kết nối Zalo đã thay đổi.');
        if (!withinHours()) return deferUntilMorning(session, job, true);
        await session.api.sendFriendRequest(greeting, job.uid);
        await finish(session, job, 'sent', 'Zalo đã nhận lời mời kết bạn. Chờ khách đồng ý.');
    } catch (error) {
        if (Number(error.code) === 225) return finish(session, job, 'friends', 'Zalo xác nhận đã là bạn.');
        if (Number(error.code) === 222) return finish(session, job, 'pending_request', 'Zalo xác nhận đã có lời mời/đã tiếp nhận quan hệ bạn bè.');
        await finish(session, job, 'waiting', 'Chưa xác nhận kết quả gửi: ' + details(error) + '. Chờ kiểm tra lại, không tự gửi lại.', { stage: 'status', delay: 600, error: true });
        if (limited(error)) await pauseForLimit(session, error);
    }
}

const limited = error => Number(error?.code) === 429 || /too many|rate.?limit|captcha|spam|quá nhiều|thường xuyên|tạm khóa/i.test(details(error));
async function pauseForLimit(session, error) {
    await db.query('UPDATE gb_zalo_friend_queue_settings SET paused_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 30 MINUTE) WHERE account_id = ?', [session.accountId]);
    await event(session.accountId, 'system', 'Zalo có dấu hiệu giới hạn. Tự nghỉ 30 phút: ' + details(error));
}

async function tick(session) {
    if (!withinHours()) return;
    if ((sleepUntil.get(session.accountId) || 0) > Date.now()) return;
    const zalo = require('./zaloConnection');
    if (!await zalo.isSavedSessionCurrent(session)) return;
    const conn = await db.getConnection();
    const lockName = 'gb_zalo_friend_' + createHash('sha256').update(session.accountId).digest('hex').slice(0, 32);
    let locked = false;
    try {
        const [[lock]] = await conn.query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
        if (Number(lock.acquired) !== 1) return;
        locked = true;
        const config = await settings(session.accountId);
        await db.query(`UPDATE gb_zalo_friend_queue SET state = 'waiting',
            stage = IF(invite_attempted_at IS NULL, stage, 'status'), lease_until = NULL,
            last_error = 'Khôi phục sau gián đoạn; kiểm tra lại trước khi thực hiện.', updated_at = UTC_TIMESTAMP()
            WHERE account_id = ? AND state = 'working' AND lease_until < UTC_TIMESTAMP()`, [session.accountId]);
        if (!Number(config.enabled)) { sleepUntil.set(session.accountId, Date.now() + 5000); return; }
        const [[ready]] = await db.query(`SELECT account_id FROM gb_zalo_friend_queue_settings
            WHERE account_id = ? AND enabled = 1 AND next_api_at <= UTC_TIMESTAMP(3)
              AND (paused_until IS NULL OR paused_until <= UTC_TIMESTAMP())`, [session.accountId]);
        if (!ready) { sleepUntil.set(session.accountId, Date.now() + Math.max(100, Number(config.wait_ms) || 1000)); return; }
        await seed(session, config);
        if (!withinHours()) return;
        const [[job]] = await db.query(`SELECT q.*, CAST(q.priority_message_id AS CHAR) AS priority_message_id, CAST(q.customer_id AS CHAR) AS customer_id FROM gb_zalo_friend_queue q JOIN gb_zalo_friend_queue_settings s ON s.account_id = q.account_id
            WHERE q.account_id = ? AND q.state = 'waiting' AND q.next_attempt_at <= UTC_TIMESTAMP()
            ORDER BY q.priority_message_id DESC, q.customer_id DESC, q.job_key LIMIT 1`, [session.accountId]);
        if (!job) { sleepUntil.set(session.accountId, Date.now() + 30000); return; }
        await db.query("UPDATE gb_zalo_friend_queue SET state = 'working', lease_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE), updated_at = UTC_TIMESTAMP() WHERE account_id = ? AND job_key = ?", [session.accountId, job.job_key]);
        await event(session.accountId, job.job_key, 'Bắt đầu bước ' + ({lookup:'tra số',status:'kiểm tra kết bạn',invite:'gửi lời mời'}[job.stage] || job.stage));
        let active = job;
        try {
            if (!await zalo.isSavedSessionCurrent(session)) throw new Error('Kết nối Zalo đã thay đổi.');
            if (active.stage === 'lookup') active = await resolveUid(session, active);
            if (active?.stage === 'status') active = await checkStatus(session, active);
            if (active?.stage === 'invite') await sendInvite(session, active, config);
        } catch (error) {
            const failedJob = active || job;
            const attempts = Math.min(10, Number(job.attempts) + 1);
            await db.query('UPDATE gb_zalo_friend_queue SET attempts = ? WHERE account_id = ? AND job_key = ?', [attempts, session.accountId, job.job_key]);
            await finish(session, failedJob, attempts >= 3 ? 'failed' : 'waiting', details(error), { delay: 300 * attempts, error: true });
            if (failedJob.stage === 'lookup' && job.customer_id) {
                const [[customer]] = await db.query(`SELECT ${customerFields} FROM khachhang k WHERE k.id = ?`, [String(job.customer_id)]);
                if (customer) await capability.lookupFailure(session, customer, 'lookup_error', 'Tra Zalo chưa thành công: ' + details(error));
            }
            if (limited(error)) await pauseForLimit(session, error);
        } finally {
            const count = Number(config.batch_count) + 1;
            const resting = count >= Number(config.batch_size);
            const delay = resting ? randomInt(Number(config.rest_min_seconds), Number(config.rest_max_seconds) + 1)
                : randomInt(Number(config.gap_min_seconds), Number(config.gap_max_seconds) + 1);
            sleepUntil.set(session.accountId, Date.now() + delay * 1000);
            await db.query('UPDATE gb_zalo_friend_queue_settings SET batch_count = ?, next_api_at = DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND) WHERE account_id = ?', [resting ? 0 : count, delay, session.accountId]);
            await event(session.accountId, job.job_key, resting ? 'Đã xử lý đủ ' + config.batch_size + ' khách, nghỉ ngẫu nhiên ' + delay + ' giây.' : 'Nghỉ ngẫu nhiên ' + delay + ' giây trước khách tiếp theo.');
        }
    } finally {
        try { if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [lockName]); } finally { conn.release(); }
    }
}

async function account() {
    const [[row]] = await db.query('SELECT zalo_user_id FROM gb_zalo_connection WHERE id = 1 AND credentials_enc IS NOT NULL');
    if (!idOk(row?.zalo_user_id)) throw new (require('./zaloConnection').ZaloActionError)(409, 'Chưa kết nối tài khoản Zalo.');
    return row.zalo_user_id;
}

async function progress() {
    const accountId = await account();
    const config = await settings(accountId);
    const [counts] = await db.query('SELECT state, COUNT(*) AS count FROM gb_zalo_friend_queue WHERE account_id = ? GROUP BY state', [accountId]);
    const [current] = await db.query("SELECT q.*, CAST(q.priority_message_id AS CHAR) AS priority_message_id, CAST(q.customer_id AS CHAR) AS customer_id, k.zalo_can_message, k.zalo_message_status, k.zalo_message_note, m.timestamp AS messenger_timestamp FROM gb_zalo_friend_queue q LEFT JOIN khachhang k ON k.id = q.customer_id LEFT JOIN messaging m ON m.id = q.priority_message_id WHERE q.account_id = ? AND q.state = 'working' ORDER BY q.updated_at DESC LIMIT 1", [accountId]);
    const [waiting] = await db.query("SELECT q.*, CAST(q.priority_message_id AS CHAR) AS priority_message_id, CAST(q.customer_id AS CHAR) AS customer_id, k.zalo_can_message, k.zalo_message_status, k.zalo_message_note, m.timestamp AS messenger_timestamp FROM gb_zalo_friend_queue q LEFT JOIN khachhang k ON k.id = q.customer_id LEFT JOIN messaging m ON m.id = q.priority_message_id WHERE q.account_id = ? AND q.state = 'waiting' ORDER BY q.priority_message_id DESC, q.customer_id DESC LIMIT 10", [accountId]);
    const [recent] = await db.query("SELECT q.*, CAST(q.priority_message_id AS CHAR) AS priority_message_id, CAST(q.customer_id AS CHAR) AS customer_id, k.zalo_can_message, k.zalo_message_status, k.zalo_message_note, m.timestamp AS messenger_timestamp FROM gb_zalo_friend_queue q LEFT JOIN khachhang k ON k.id = q.customer_id LEFT JOIN messaging m ON m.id = q.priority_message_id WHERE q.account_id = ? AND q.state NOT IN ('working','waiting') ORDER BY q.updated_at DESC LIMIT 10", [accountId]);
    const [events] = await db.query('SELECT CAST(e.id AS CHAR) AS id, e.job_key, e.detail, e.created_at, q.customer_name, CAST(q.customer_id AS CHAR) AS customer_id, q.phone FROM gb_zalo_friend_queue_events e LEFT JOIN gb_zalo_friend_queue q ON q.account_id = e.account_id AND q.job_key = e.job_key WHERE e.account_id = ? ORDER BY e.id DESC LIMIT 80', [accountId]);
    return { accountId, config, counts, current, waiting, recent, events, schedule: getFriendWindow(Date.now()) };
}

async function configure(body) {
    const accountId = await account();
    await settings(accountId);
    if (typeof body.enabled !== 'boolean') throw new (require('./zaloConnection').ZaloActionError)(400, 'Trạng thái hàng chờ không hợp lệ.');
    await db.query('UPDATE gb_zalo_friend_queue_settings SET enabled = ? WHERE account_id = ?', [body.enabled ? 1 : 0, accountId]);
    sleepUntil.delete(accountId);
    await event(accountId, 'system', body.enabled ? 'Admin đã bật hàng chờ: nghỉ 10–15 giây/khách, đủ 10 khách nghỉ 1–2 phút.' : 'Admin đã tạm dừng hàng chờ.');
}

async function retryFailed() {
    const accountId = await account();
    const [result] = await db.query(`UPDATE gb_zalo_friend_queue SET state = 'waiting',
        stage = IF(uid IS NULL, 'lookup', 'status'), attempts = 0, next_attempt_at = UTC_TIMESTAMP(),
        last_error = NULL, lease_until = NULL, updated_at = UTC_TIMESTAMP()
        WHERE account_id = ? AND state IN ('failed','not_found')`, [accountId]);
    await event(accountId, 'system', 'Admin xếp thử lại ' + result.affectedRows + ' lượt tra lỗi.');
    return { count: result.affectedRows };
}

async function friendAccepted(session, uid) {
    const [[job]] = await db.query('SELECT job_key FROM gb_zalo_friend_queue WHERE account_id = ? AND uid = ? LIMIT 1', [session.accountId, uid]);
    if (!job) return;
    const [result] = await db.query(`UPDATE gb_zalo_friend_queue SET state = 'friends', stage = 'status', last_error = NULL,
        updated_at = UTC_TIMESTAMP() WHERE account_id = ? AND job_key = ? AND state NOT IN ('working','friends')`, [session.accountId, job.job_key]);
    if (result.affectedRows) await event(session.accountId, job.job_key, 'Zalo thông báo đã trở thành bạn bè.');
}

module.exports = { enqueueUid, tick, progress, configure, retryFailed, friendAccepted };
