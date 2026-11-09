'use strict';
const DBConnection = require("../../configs/DBConnection");
const { sendFcmToUser } = require('../fcm');
const {
    jtHasSigpic, isPartReturnBill, eventCode, toWaybillRow, toEpoch, readJTDetails,
    insertWaybillIfNew, readStoredJTWaybill, latestStoredScanEpoch, lockJTOrder, applyJTStatus, createPartReturnOrder
} = require('../../services/jtExpressService');

const JT_NOTIFY_CODES = new Set([116, 117, 118, 120]);

async function notifyShop(db, billCode, scanCode, statusText, issueText) {
    const [orderRows] = await db.query('SELECT * FROM lendon WHERE realorderid = ? LIMIT 1', [billCode]);
    if (!orderRows.length) return;
    const order = orderRows[0];
    const userId = order.useraccountid;
    const title = `${order.name} - J&T`;
    const body = `${statusText}${issueText ? ' - ' + issueText : ''}`;

    const [notiRows] = await db.query(
        'SELECT 1 FROM order_noti_log WHERE realorderid = ? AND status_code = ? LIMIT 1',
        [billCode, scanCode]
    );
    if (notiRows.length) return;

    const [result] = await db.query(
        'INSERT IGNORE INTO order_noti_log (realorderid, status_code, sent_at, title, body, userid) VALUES (?, ?, NOW(), ?, ?, ?)',
        [billCode, scanCode, title, body, userId]
    );
    await sendFcmToUser(db, userId, title, body, {
        type: 'order_status',
        realorderid: billCode,
        status: scanCode,
        noti_id: result.insertId
    });
}

async function storeFeedback(data) {
    const billCode = String(data?.billCode ?? '').trim();
    const events = readJTDetails(data?.details);
    if (!/^[A-Za-z0-9_-]{1,45}$/.test(billCode) || !events.length) {
        throw new Error('Webhook J&T thiếu mã vận đơn hoặc mốc hành trình');
    }
    const newest = events[events.length - 1];
    const withSig = await jtHasSigpic();
    const conn = await DBConnection.getConnection();
    try {
        await conn.beginTransaction();
        await lockJTOrder(conn, billCode);
        const previous = await readStoredJTWaybill(conn, billCode, withSig);
        const storedNewest = latestStoredScanEpoch(previous);

        const partSign = Number(newest.partSign ?? data.partSign ?? 0);
        if (partSign === 1 && !isPartReturnBill(billCode)) {
            await createPartReturnOrder(billCode, conn);
        }
        let latestIssue;
        for (const event of events) {
            latestIssue = await insertWaybillIfNew(conn, toWaybillRow(billCode, event), withSig);
        }

        const stale = storedNewest !== null && toEpoch(newest.scanTime) < storedNewest;
        const status = stale ? null : await applyJTStatus(billCode, newest, conn, latestIssue);
        await conn.commit();
        return { billCode, scanCode: eventCode(newest), status };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = function registerJtexWebhook(router) {
    router.post('/jtex', async function (req, res) {
        let result;
        try {
            const { bizContent } = req.body || {};
            const data = typeof bizContent === 'string' ? JSON.parse(bizContent) : bizContent;
            result = await storeFeedback(data);
        } catch (error) {
            console.error('Lỗi lưu webhook J&T:', error.message);
            return res.json({ code: '0', msg: 'Không lưu được hành trình J&T', data: null });
        }
        res.json({ code: '1', msg: 'success', data: null });

        const { billCode, scanCode, status } = result;
        if (status?.applied && JT_NOTIFY_CODES.has(scanCode)) {
            try {
                await notifyShop(DBConnection.promise(), billCode, scanCode, status.statustext, status.issue);
            } catch (error) {
                console.error('[J&T FCM] Lỗi gửi notification:', error.message);
            }
        }
    });
};
