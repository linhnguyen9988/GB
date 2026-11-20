'use strict';

const { randomUUID } = require('node:crypto');
const db = require('../configs/DBConnection');
const zalo = require('./zaloConnection');
const validId = value => typeof value === 'string' && /^\d{1,64}$/.test(value) && value !== '0';
const errorText = error => String(error?.message || 'Zalo không trả về kết quả.').slice(0, 450);

async function savedAccountId() {
    const [[row]] = await db.query('SELECT zalo_user_id FROM gb_zalo_connection WHERE id = 1 AND credentials_enc IS NOT NULL');
    if (!row?.zalo_user_id) throw new zalo.ZaloActionError(409, 'Chưa kết nối tài khoản Zalo.');
    return row.zalo_user_id;
}

async function sessionFor(accountId) {
    const session = await zalo.openSavedSession(45000);
    if (!session || (accountId && session.accountId !== accountId)) {
        throw new zalo.ZaloActionError(409, 'Kết nối Zalo đã thay đổi. Hãy tải lại danh sách.');
    }
    return session;
}

async function listFriends() {
    const session = await sessionFor();
    const rows = await session.api.getAllFriends();
    if (!Array.isArray(rows)) throw new zalo.ZaloActionError(502, 'Không tải được danh sách bạn bè Zalo.');
    if (!await zalo.isSavedSessionCurrent(session)) throw new zalo.ZaloActionError(409, 'Kết nối Zalo đã thay đổi.');
    const friends = rows.map(row => ({ uid: zalo.eventId(row.userId),
        name: String(row.displayName || row.zaloName || row.username || '').slice(0, 255),
        phone: String(row.phoneNumber || '').slice(0, 32) })).filter(row => validId(row.uid));
    friends.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return { accountId: session.accountId, friends };
}

async function searchCustomers(query) {
    if (typeof query !== 'string' || query.trim().length < 2 || query.length > 100) {
        throw new zalo.ZaloActionError(400, 'Nhập ít nhất 2 ký tự tên hoặc số điện thoại.');
    }
    const session = { accountId: await savedAccountId() };
    const like = '%' + query.trim().replace(/[\\%_]/g, '\\$&') + '%';
    const [rows] = await db.query(
        `SELECT id, fbname, phone, zaloid, zalo_account_id, zalo_phone FROM khachhang
         WHERE fbname LIKE ? OR phone LIKE ? ORDER BY id DESC LIMIT 50`, [like, like]
    );
    const customers = rows.map(row => {
        let linked = false;
        try { linked = row.zalo_account_id === session.accountId && zalo.normalizePhone(row.phone) === row.zalo_phone; } catch (_) { }
        return { id: String(row.id), name: row.fbname || '', phone: row.phone || '', uid: linked && validId(row.zaloid) ? row.zaloid : null };
    });
    return { accountId: session.accountId, customers };
}

async function enqueueGroup({ accountId, groupId, memberIds }) {
    if (!validId(accountId) || !validId(groupId) || !Array.isArray(memberIds) ||
        !memberIds.length || memberIds.length > 20000 || memberIds.some(id => !validId(id))) {
        throw new zalo.ZaloActionError(400, 'Chọn nhóm và ít nhất một người hợp lệ.');
    }
    const session = await sessionFor(accountId);
    const groups = await session.api.getAllGroups();
    if (!Object.hasOwn(groups?.gridVerMap || {}, groupId) || !await zalo.isSavedSessionCurrent(session)) {
        throw new zalo.ZaloActionError(409, 'Tài khoản Zalo không còn trong nhóm đã chọn.');
    }
    let ids = [...new Set(memberIds)].filter(id => id !== accountId);
    if (!ids.length) throw new zalo.ZaloActionError(400, 'Không thể thêm chính tài khoản shop.');
    const jobId = randomUUID();
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('SELECT id FROM gb_zalo_connection WHERE id = 1 FOR UPDATE');
        const [queued] = await conn.query(
            "SELECT user_id FROM gb_zalo_group_add WHERE account_id = ? AND group_id = ? AND user_id IN (?) AND state IN ('pending','processing') FOR UPDATE",
            [accountId, groupId, ids]);
        const active = new Set(queued.map(row => row.user_id));
        ids = ids.filter(id => !active.has(id));
        if (!ids.length) throw new zalo.ZaloActionError(409, 'Những người đã chọn đều đang chờ thêm vào nhóm này.');
        for (let index = 0; index < ids.length; index += 100) {
            await conn.query('INSERT INTO gb_zalo_group_add (job_id, account_id, group_id, user_id) VALUES ?',
                [ids.slice(index, index + 100).map(id => [jobId, accountId, groupId, id])]);
        }
        await conn.commit();
    } catch (error) { await conn.rollback(); throw error; }
    finally { conn.release(); }
    return { jobId, total: ids.length };
}

async function groupProgress() {
    const session = { accountId: await savedAccountId() };
    const [jobs] = await db.query(
        `SELECT job_id, group_id, COUNT(*) AS total,
         SUM(state = 'pending') AS pending, SUM(state = 'processing') AS processing,
         SUM(state = 'sent') AS sent, SUM(state = 'skipped') AS skipped,
         SUM(state IN ('failed','uncertain')) AS failed, SUM(state = 'cancelled') AS cancelled
         FROM gb_zalo_group_add WHERE account_id = ? GROUP BY job_id, group_id
         ORDER BY MAX(id) DESC LIMIT 5`, [session.accountId]
    );
    const [failures] = await db.query(
        `SELECT job_id, user_id, last_error FROM gb_zalo_group_add
         WHERE account_id = ? AND state IN ('failed','uncertain') ORDER BY id DESC LIMIT 50`, [session.accountId]
    );
    const [friends] = await db.query(
        'SELECT state, COUNT(*) AS count FROM gb_zalo_friend_accept WHERE account_id = ? GROUP BY state', [session.accountId]
    );
    const [[profileSync]] = await db.query(
        `SELECT COUNT(*) AS total, SUM(applied_hash = desired_hash) AS done,
         SUM(applied_hash IS NULL OR applied_hash <> desired_hash) AS pending,
         SUM(last_error IS NOT NULL) AS failed FROM gb_zalo_customer_profile_sync WHERE account_id = ?`, [session.accountId]);
    const [profileErrors] = await db.query(
        `SELECT user_id, last_error FROM gb_zalo_customer_profile_sync
         WHERE account_id = ? AND last_error IS NOT NULL ORDER BY updated_at DESC LIMIT 20`, [session.accountId]);
    return { accountId: session.accountId, jobs, failures, friends, profileSync, profileErrors };
}

async function cancelGroup(jobId) {
    if (typeof jobId !== 'string' || !/^[a-f0-9-]{36}$/.test(jobId)) throw new zalo.ZaloActionError(400, 'Mã đợt thêm không hợp lệ.');
    const session = { accountId: await savedAccountId() };
    await db.query("UPDATE gb_zalo_group_add SET state = 'cancelled', updated_at = UTC_TIMESTAMP() WHERE account_id = ? AND job_id = ? AND state = 'pending'", [session.accountId, jobId]);
}

async function receiveFriendRequest(session, event) {
    if (!event || Number(event.type) !== 2 || event.isSelf || !await zalo.isSavedSessionCurrent(session)) return;
    const uid = [event.data?.fromUid, event.threadId].map(zalo.eventId).find(id => id && id !== session.accountId);
    if (!uid) return;
    await db.query(
        `INSERT INTO gb_zalo_friend_accept (account_id, user_id) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE state = IF(state = 'processing', state, 'pending'),
         attempts = IF(state = 'processing', attempts, 0), next_attempt = UTC_TIMESTAMP(), last_error = NULL`,
        [session.accountId, uid]
    );
}

async function processFriends(session) {
    await db.query("UPDATE gb_zalo_friend_accept SET state = 'pending' WHERE account_id = ? AND state = 'processing' AND next_attempt < UTC_TIMESTAMP()", [session.accountId]);
    const [rows] = await db.query("SELECT user_id FROM gb_zalo_friend_accept WHERE account_id = ? AND state = 'pending' AND next_attempt <= UTC_TIMESTAMP() LIMIT 3", [session.accountId]);
    for (const row of rows) {
        if (!await zalo.isSavedSessionCurrent(session)) return;
        const [claim] = await db.query(
            "UPDATE gb_zalo_friend_accept SET state = 'processing', attempts = attempts + 1, next_attempt = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE) WHERE account_id = ? AND user_id = ? AND state = 'pending'",
            [session.accountId, row.user_id]);
        if (!claim.affectedRows) continue;
        try {
            await session.api.acceptFriendRequest(row.user_id);
            await db.query("UPDATE gb_zalo_friend_accept SET state = 'done', last_error = NULL WHERE account_id = ? AND user_id = ?", [session.accountId, row.user_id]);
        } catch (error) {
            const status = await session.api.getFriendRequestStatus(row.user_id).catch(() => null);
            if (Number(status?.is_friend) === 1) {
                await db.query("UPDATE gb_zalo_friend_accept SET state = 'done', last_error = NULL WHERE account_id = ? AND user_id = ?", [session.accountId, row.user_id]);
            } else {
                await db.query("UPDATE gb_zalo_friend_accept SET state = IF(attempts < 5, 'pending', 'failed'), next_attempt = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE), last_error = ? WHERE account_id = ? AND user_id = ?", [errorText(error), session.accountId, row.user_id]);
            }
        }
    }
}

async function processGroups(session) {
    await db.query("UPDATE gb_zalo_group_add SET state = 'uncertain', last_error = 'GB khởi động lại khi đang thêm. Kiểm tra nhóm trước khi thêm lại.', updated_at = UTC_TIMESTAMP() WHERE account_id = ? AND state = 'processing' AND updated_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)", [session.accountId]);
    const [[job]] = await db.query("SELECT job_id, group_id FROM gb_zalo_group_add WHERE account_id = ? AND state = 'pending' ORDER BY id LIMIT 1", [session.accountId]);
    if (!job || !await zalo.isSavedSessionCurrent(session)) return;
    const [rows] = await db.query("SELECT CAST(id AS CHAR) AS id, user_id FROM gb_zalo_group_add WHERE account_id = ? AND job_id = ? AND state = 'pending' ORDER BY id LIMIT 10", [session.accountId, job.job_id]);
    const claimed = [];
    for (const row of rows) {
        const [result] = await db.query("UPDATE gb_zalo_group_add SET state = 'processing', updated_at = UTC_TIMESTAMP() WHERE id = ? AND state = 'pending'", [row.id]);
        if (result.affectedRows) claimed.push(row);
    }
    if (!claimed.length) return;
    const finish = (row, state, note) => db.query('UPDATE gb_zalo_group_add SET state = ?, last_error = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?', [state, note, row.id]);
    try {
        const info = (await session.api.getGroupInfo(job.group_id))?.gridInfoMap?.[job.group_id];
        if (!info) throw new Error('Không đọc được thông tin nhóm.');
        const current = new Set([...(info.memberIds || []), ...(info.currentMems || []).map(item => item.id), ...(info.memVerList || []).map(id => String(id).split('_')[0])].map(String));
        const pending = [];
        for (const row of claimed) {
            if (current.has(row.user_id)) await finish(row, 'skipped', 'Đã ở trong nhóm.');
            else pending.push(row);
        }
        if (!pending.length) return;
        if (!await zalo.isSavedSessionCurrent(session)) throw new Error('Tài khoản Zalo đã thay đổi.');
        const result = await session.api.addUserToGroup(pending.map(row => row.user_id), job.group_id);
        if (!result || !Array.isArray(result.errorMembers) || !result.error_data || typeof result.error_data !== 'object') {
            throw new Error('Zalo không trả kết quả thêm thành viên đầy đủ. Kiểm tra nhóm trước khi thêm lại.');
        }
        const errors = new Map(result.errorMembers.map(id => [String(id), 'Zalo từ chối thêm thành viên.']));
        for (const [code, ids] of Object.entries(result.error_data)) {
            if (Array.isArray(ids)) for (const id of ids) errors.set(String(id), 'Zalo từ chối thêm thành viên, mã ' + code + '.');
        }
        for (const row of pending) await finish(row, errors.has(row.user_id) ? 'failed' : 'sent', errors.get(row.user_id) || null);
    } catch (error) {
        for (const row of claimed) {
            await db.query("UPDATE gb_zalo_group_add SET state = 'uncertain', last_error = ?, updated_at = UTC_TIMESTAMP() WHERE id = ? AND state = 'processing'", [errorText(error), row.id]);
        }
    }
}

async function processPending(session) {
    await processFriends(session);
    await processGroups(session);
    await require('./zaloCustomerProfileSync').processPending(session);
}

module.exports = { listFriends, searchCustomers, enqueueGroup, groupProgress, cancelGroup, receiveFriendRequest, processPending };
