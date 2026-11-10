'use strict';

const db = require('../configs/DBConnection');
const zalo = require('./zaloConnection');

const recipients = ['84888118855', '84913181141'];
const issueCodes = {
    'J&T': new Set([104, 118, 120]),
    Viettel: new Set([102, 505, 506, 507])
};

function isIssue(carrier, statusCode) {
    return issueCodes[carrier]?.has(statusCode) === true;
}

async function enqueue(connection, carrier, billCode, statusCode, statusText, order) {
    if (!order || !isIssue(carrier, statusCode)) return;
    const cod = Number(order.cod);
    const value = text => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 255) || 'Chưa có';
    const lines = [
        'Đơn có vấn đề · ' + carrier,
        'Khách: ' + value(order.name),
        'SĐT khách: ' + value(order.phone),
        'Mã vận đơn: ' + billCode,
        'COD: ' + (order.cod != null && Number.isFinite(cod) ? cod.toLocaleString('vi-VN') + ' đ' : 'Chưa có'),
        'Trạng thái: ' + value(statusText)
    ];
    const note = carrier === 'Viettel' && typeof order.note === 'string' ? order.note.trim() : '';
    if (note) lines.push('Ghi chú: ' + note);
    const message = lines.join('\n');
    const values = recipients.map(phone => [carrier, billCode, statusCode, phone, message]);
    await connection.query(
        `INSERT INTO gb_zalo_shipment_alerts (carrier, bill_code, status_code, recipient_phone, message, next_attempt_at)
         VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP()), (?, ?, ?, ?, ?, UTC_TIMESTAMP())
         ON DUPLICATE KEY UPDATE id = id`,
        values.flat()
    );
}

async function settle(id, state, messageId = null) {
    await db.query(
        `UPDATE gb_zalo_shipment_alerts SET state = ?, message_id = ?,
            sent_at = IF(? = 'sent', UTC_TIMESTAMP(), NULL)
          WHERE id = ? AND state = 'sending'`,
        [state, messageId, state, id]
    );
}

async function retryLookup(id) {
    await db.query(
        `UPDATE gb_zalo_shipment_alerts
            SET state = IF(attempts >= 3, 'failed', 'pending'),
                next_attempt_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 MINUTE)
          WHERE id = ? AND state = 'sending'`,
        [id]
    );
}

function warnJob(job, reason) {
    console.warn('[Zalo vận đơn]', job.bill_code, 'trạng thái', job.status_code,
        'người nhận đuôi', job.recipient_phone.slice(-4), reason);
}

async function dispatchPending() {
    await db.query(
        `UPDATE gb_zalo_shipment_alerts SET state = 'uncertain'
          WHERE state = 'sending' AND started_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)`
    );
    const [jobs] = await db.query(
        `SELECT id, bill_code, status_code, recipient_phone, message FROM gb_zalo_shipment_alerts
          WHERE state = 'pending' AND next_attempt_at <= UTC_TIMESTAMP()
          ORDER BY next_attempt_at, id LIMIT 4`
    );
    if (!jobs.length) return;
    const session = await zalo.openSavedSession(45000);
    if (!session) throw new zalo.ZaloActionError(409, 'Đang có cảnh báo chờ gửi. Kiểm tra kết nối Zalo trong trang quản trị.');

    const found = new Map();
    for (const job of jobs) {
        const [claim] = await db.query(
            `UPDATE gb_zalo_shipment_alerts
                SET state = 'sending', attempts = attempts + 1, started_at = UTC_TIMESTAMP()
              WHERE id = ? AND state = 'pending' AND next_attempt_at <= UTC_TIMESTAMP()`,
            [job.id]
        );
        if (!claim.affectedRows) continue;

        let recipient;
        try {
            recipient = found.get(job.recipient_phone) || await zalo.findRecipient(session, job.recipient_phone);
            found.set(job.recipient_phone, recipient);
            if (!await zalo.isSavedSessionCurrent(session)) {
                await retryLookup(job.id);
                return;
            }
        } catch (error) {
            if (error instanceof zalo.ZaloActionError && error.status === 404) {
                await settle(job.id, 'failed');
                warnJob(job, 'Tra số điện thoại không ra UID.');
            } else {
                await retryLookup(job.id);
                warnJob(job, 'Lỗi tra UID hoặc xác minh phiên Zalo.');
            }
            continue;
        }

        let result;
        try {
            result = await zalo.sendText(session, recipient.uid, job.message);
        } catch (error) {
            const rejected = error instanceof zalo.ZaloActionError && error.status === 422;
            await settle(job.id, rejected ? 'failed' : 'uncertain');
            warnJob(job, rejected ? error.message : 'Chưa xác nhận được kết quả gửi.');
            continue;
        }
        await settle(job.id, 'sent', result.messageId);
    }
}

function start() {
    let busy = false;
    let lastProblem;
    setInterval(async () => {
        if (busy) return;
        busy = true;
        try {
            await dispatchPending();
            lastProblem = undefined;
        } catch (error) {
            const problem = error.code === 'ER_NO_SUCH_TABLE'
                ? 'Thiếu bảng Zalo. Kiểm tra migration kết nối và cảnh báo vận đơn.'
                : error instanceof zalo.ZaloActionError
                    ? error.message
                    : 'Không xử lý được hàng đợi cảnh báo Zalo.';
            if (problem !== lastProblem) console.warn('[Zalo vận đơn]', problem);
            lastProblem = problem;
        } finally {
            busy = false;
        }
    }, 15000).unref();
}

module.exports = { isIssue, enqueue, start };
