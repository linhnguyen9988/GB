'use strict';

const { createHash } = require('node:crypto');
const db = require('../configs/DBConnection');
const isId = value => typeof value === 'string' && /^[1-9]\d{0,63}$/.test(value);
const definitions = [
    { name: 'Bom hàng', color: '#e74c3c' }, { name: 'Xả hàng', color: '#e74c3c' },
    { name: 'Có vấn đề', color: '#f39c12' }, { name: 'Thân thiết', color: '#27ae60' }
];
const owned = new Set(definitions.map(item => 'GB · ' + item.name));
const fields = 'CAST(k.id AS CHAR) AS customer_id, k.fbname, k.label, k.zaloid, k.zalo_account_id, k.phone, k.zalo_phone';
const latest = `NOT EXISTS (SELECT 1 FROM khachhang newer
    WHERE newer.zalo_account_id = k.zalo_account_id AND newer.zaloid = k.zaloid
      AND (COALESCE(newer.zalo_linked_at, '1000-01-01') > COALESCE(k.zalo_linked_at, '1000-01-01')
        OR (COALESCE(newer.zalo_linked_at, '1000-01-01') = COALESCE(k.zalo_linked_at, '1000-01-01') AND newer.id > k.id)))`;
let scanAccount;
let scanCursor = '0';

function target(row) {
    const zalo = require('./zaloConnection');
    if (!isId(row.customer_id) || !isId(row.zaloid) || !isId(row.zalo_account_id)) return null;
    try { if (zalo.normalizePhone(row.phone) !== row.zalo_phone) return null; } catch (_) { return null; }
    const name = String(row.fbname || '').normalize('NFC').replace(/[\r\n\t]+/g, ' ').trim() || 'Khách hàng';
    const suffix = ' · KH' + row.customer_id;
    const alias = Array.from(name).slice(0, Math.max(1, 50 - Array.from(suffix).length)).join('') + suffix;
    const definition = definitions.find(item => item.name.toLocaleLowerCase('vi') === String(row.label || '').normalize('NFC').trim().toLocaleLowerCase('vi'));
    const label = definition ? 'GB · ' + definition.name : '';
    return { accountId: row.zalo_account_id, uid: row.zaloid, alias, label,
        hash: createHash('sha256').update(JSON.stringify([row.customer_id, alias, label])).digest('hex') };
}

async function enqueueWhere(conn, where, params, force = false) {
    const [rows] = await conn.query(`SELECT ${fields} FROM khachhang k WHERE (${where})
        AND k.zaloid IS NOT NULL AND k.zalo_account_id IS NOT NULL AND ${latest}`, params);
    let count = 0;
    for (const row of rows) {
        const item = target(row);
        if (!item) continue;
        const changed = force ? '1' : 'desired_hash <> VALUES(desired_hash)';
        await conn.query(
            `INSERT INTO gb_zalo_customer_profile_sync (account_id, user_id, desired_hash) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE next_attempt_at = IF(${changed}, UTC_TIMESTAMP(), next_attempt_at),
             attempts = IF(${changed}, 0, attempts), last_error = IF(${changed}, NULL, last_error),
             applied_hash = IF(${changed}, NULL, applied_hash),
             synced_label = IF(${force ? '1' : '0'}, NULL, synced_label), synced_alias = IF(${force ? '1' : '0'}, NULL, synced_alias),
             desired_hash = VALUES(desired_hash)`, [item.accountId, item.uid, item.hash]
        );
        count++;
    }
    return count;
}

async function queueAll() {
    const [[row]] = await db.query('SELECT zalo_user_id FROM gb_zalo_connection WHERE id = 1 AND credentials_enc IS NOT NULL');
    if (!isId(row?.zalo_user_id)) throw new (require('./zaloConnection').ZaloActionError)(409, 'Chưa kết nối tài khoản Zalo.');
    const count = await enqueueWhere(db, 'k.zalo_account_id = ?', [row.zalo_user_id], true);
    return { count };
}

async function scan(session) {
    if (scanAccount !== session.accountId) { scanAccount = session.accountId; scanCursor = '0'; }
    const [rows] = await db.query(`SELECT CAST(k.id AS CHAR) AS customer_id FROM khachhang k
        WHERE k.zalo_account_id = ? AND k.zaloid IS NOT NULL AND k.id > ? ORDER BY k.id LIMIT 100`, [session.accountId, scanCursor]);
    if (!rows.length) { scanCursor = '0'; return; }
    await enqueueWhere(db, 'k.id IN (?)', [rows.map(row => row.customer_id)]);
    scanCursor = rows.at(-1).customer_id;
}

function mergeLabels(snapshot, jobs) {
    if (!Array.isArray(snapshot?.labelData) || !Number.isSafeInteger(snapshot.version) || snapshot.version < 0 ||
        snapshot.labelData.some(item => !item || !Number.isSafeInteger(item.id) || typeof item.text !== 'string' || !Array.isArray(item.conversations))) {
        throw new Error('Zalo trả danh sách nhãn không hợp lệ, chưa cập nhật.');
    }
    const data = snapshot.labelData.map(item => ({ ...item, conversations: [...item.conversations] }));
    let nextId = Math.max(0, ...data.map(item => item.id)) + 1;
    for (const job of jobs) {
        for (const item of data) if (owned.has(item.text)) item.conversations = item.conversations.filter(uid => String(uid) !== job.uid);
        if (!job.label) continue;
        let label = data.find(item => item.text === job.label);
        if (!label) {
            if (!Number.isSafeInteger(nextId)) throw new Error('Không tạo được mã nhãn Zalo.');
            const definition = definitions.find(item => 'GB · ' + item.name === job.label);
            label = { id: nextId++, text: job.label, textKey: '', conversations: [], color: definition.color,
                offset: data.length, emoji: '', createTime: Date.now() };
            data.push(label);
        }
        label.conversations.push(job.uid);
    }
    return data;
}

function confirmsLabels(data, jobs) {
    return Array.isArray(data) && jobs.every(job => {
        const matches = data.filter(item => owned.has(item.text) && Array.isArray(item.conversations) && item.conversations.some(uid => String(uid) === job.uid));
        return job.label ? matches.length === 1 && matches[0].text === job.label : matches.length === 0;
    });
}

async function processPending(session) {
    const zalo = require('./zaloConnection');
    if (!await zalo.isSavedSessionCurrent(session)) return;
    await scan(session);
    const conn = await db.getConnection();
    const lockName = 'gb_zalo_profile_' + createHash('sha256').update(session.accountId).digest('hex').slice(0, 32);
    let locked = false;
    try {
        const [[lock]] = await conn.query('SELECT GET_LOCK(?, 0) AS acquired', [lockName]);
        if (Number(lock.acquired) !== 1) return;
        locked = true;
        const [rows] = await conn.query(`SELECT * FROM gb_zalo_customer_profile_sync
            WHERE account_id = ? AND (applied_hash IS NULL OR applied_hash <> desired_hash)
              AND next_attempt_at <= UTC_TIMESTAMP() ORDER BY next_attempt_at, user_id LIMIT 10`, [session.accountId]);
        const jobs = [];
        for (const row of rows) {
            const [[customer]] = await conn.query(`SELECT ${fields} FROM khachhang k
                WHERE k.zalo_account_id = ? AND k.zaloid = ? AND ${latest} LIMIT 1`, [session.accountId, row.user_id]);
            const item = customer && target(customer);
            if (!item) {
                await conn.query(`UPDATE gb_zalo_customer_profile_sync SET next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 HOUR),
                    last_error = 'Khách không còn liên kết UID và số điện thoại hợp lệ.' WHERE account_id = ? AND user_id = ?`, [session.accountId, row.user_id]);
                continue;
            }
            if (item.hash !== row.desired_hash) {
                await enqueueWhere(conn, 'k.id = ?', [customer.customer_id]);
                row.desired_hash = item.hash;
            }
            jobs.push({ ...item, row, labelOk: row.synced_label === item.label, aliasOk: row.synced_alias === item.alias, errors: [] });
        }
        const labelJobs = jobs.filter(job => !job.labelOk);
        if (labelJobs.length) {
            try {
                const snapshot = await session.api.getLabels();
                const data = mergeLabels(snapshot, labelJobs);
                if (!await zalo.isSavedSessionCurrent(session)) return;
                if (JSON.stringify(data) !== JSON.stringify(snapshot.labelData)) {
                    const result = await session.api.updateLabels({ labelData: data, version: snapshot.version + 1 });
                    if (!Number.isSafeInteger(result?.version) || result.version < snapshot.version + 1 || !confirmsLabels(result.labelData, labelJobs)) {
                        throw new Error('Zalo chưa xác nhận đầy đủ các nhãn khách hàng.');
                    }
                }
                for (const job of labelJobs) job.labelOk = true;
            } catch (error) {
                for (const job of labelJobs) job.errors.push('Nhãn: ' + String(error.message || error.code));
            }
        }
        for (const job of jobs) {
            if (!await zalo.isSavedSessionCurrent(session)) return;
            if (!job.aliasOk) {
                try { await session.api.changeFriendAlias(job.alias, job.uid); job.aliasOk = true; }
                catch (error) { job.errors.push('Biệt danh: ' + String(error.message || error.code)); }
            }
            const complete = job.labelOk && job.aliasOk;
            const attempts = complete ? 0 : Math.min(20, Number(job.row.attempts) + 1);
            const delay = complete ? 0 : Math.min(3600, 30 * 2 ** Math.min(attempts, 7));
            await conn.query(`UPDATE gb_zalo_customer_profile_sync SET
                synced_label = COALESCE(?, synced_label), synced_alias = COALESCE(?, synced_alias),
                applied_hash = ?, attempts = ?, last_error = ?, next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND), updated_at = UTC_TIMESTAMP()
                WHERE account_id = ? AND user_id = ? AND desired_hash = ?`,
                [job.labelOk ? job.label : null, job.aliasOk ? job.alias : null, complete ? job.hash : null,
                    attempts, job.errors.join(' · ').slice(0, 500) || null, delay, session.accountId, job.uid, job.hash]);
        }
    } finally {
        try { if (locked) await conn.query('SELECT RELEASE_LOCK(?)', [lockName]); }
        finally { conn.release(); }
    }
}

async function wake(accountId, uid) {
    await db.query(`UPDATE gb_zalo_customer_profile_sync SET next_attempt_at = UTC_TIMESTAMP(), attempts = 0
        WHERE account_id = ? AND user_id = ? AND (applied_hash IS NULL OR applied_hash <> desired_hash)`, [accountId, uid]);
}

module.exports = { enqueueWhere, queueAll, processPending, wake };
