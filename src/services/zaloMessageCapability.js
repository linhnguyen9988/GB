'use strict';

const db = require('../configs/DBConnection');

async function found(session, customer, uid, note = 'Đã tra được UID. Chưa xác nhận gửi được tin nhắn.') {
    const same = '(zalo_message_account_id <=> ? AND zalo_message_uid <=> ? AND zalo_can_message IS NOT NULL)';
    await db.query(`UPDATE khachhang SET
        zalo_message_status = IF(${same}, zalo_message_status, 'uid_found'),
        zalo_message_note = IF(${same}, zalo_message_note, ?),
        zalo_message_checked_at = IF(${same}, zalo_message_checked_at, UTC_TIMESTAMP()),
        zalo_can_message = IF(${same}, zalo_can_message, NULL),
        zalo_message_account_id = ?, zalo_message_uid = ?
        WHERE id = ? AND phone <=> ?`,
        [session.accountId, uid, session.accountId, uid, note, session.accountId, uid,
            session.accountId, uid, session.accountId, uid, customer.customer_id || customer.id, customer.phone]);
}

async function lookupFailure(session, customer, status, note) {
    await db.query(`UPDATE khachhang SET zalo_can_message = ?, zalo_message_status = ?,
        zalo_message_note = ?, zalo_message_checked_at = UTC_TIMESTAMP(), zalo_message_account_id = ?, zalo_message_uid = NULL
        WHERE id = ? AND phone <=> ? AND NOT (COALESCE(zalo_can_message, 0) = 1 AND zalo_message_account_id <=> ?)`, [status === 'lookup_unavailable' ? 0 : null, status, String(note).slice(0, 500), session.accountId, customer.customer_id || customer.id, customer.phone, session.accountId]);
}

function recordSend(session, uid, confirmed, error) {
    // This is evidence from a real send, never a probe message sent by the checker.
    void (async () => {
        const zalo = require('./zaloConnection');
        if (!await zalo.isSavedSessionCurrent(session)) return;
        const [rows] = await db.query('SELECT id, phone, zalo_phone FROM khachhang WHERE zalo_account_id = ? AND zaloid = ?', [session.accountId, uid]);
        for (const row of rows) {
            try { if (zalo.normalizePhone(row.phone) !== row.zalo_phone) continue; } catch (_) { continue; }
            await db.query(`UPDATE khachhang SET zalo_can_message = ?, zalo_message_status = ?,
                zalo_message_note = ?, zalo_message_checked_at = UTC_TIMESTAMP(), zalo_message_account_id = ?, zalo_message_uid = ?
                WHERE id = ? AND phone <=> ? AND zalo_account_id = ? AND zaloid = ?
                  AND (? = 1 OR COALESCE(zalo_can_message, 0) <> 1 OR NOT (zalo_message_account_id <=> ? AND zalo_message_uid <=> ?))`,
                [confirmed ? 1 : null, confirmed ? 'send_confirmed' : 'send_unconfirmed',
                    confirmed ? 'Đã xác nhận gửi tin Zalo thành công.' : String(error?.message || 'Lần gửi này chưa được xác nhận.').slice(0, 500),
                    session.accountId, uid, row.id, row.phone, session.accountId, uid, confirmed ? 1 : 0, session.accountId, uid]);
        }
    })().catch(error => console.warn('[Khả năng nhắn Zalo] Chưa lưu được kết quả:', error.code || error.name));
}

module.exports = { found, lookupFailure, recordSend };
