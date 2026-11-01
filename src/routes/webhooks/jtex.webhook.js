'use strict';
const DBConnection = require("../../configs/DBConnection");
const { sendFcmToUser } = require('../fcm');
const {
    jtHasSigpic, isPartReturnBill, eventCode, toWaybillRow, toEpoch,
    insertWaybillIfNew, latestStoredScanEpoch, applyJTStatus, createPartReturnOrder
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

module.exports = function registerJtexWebhook(router) {
    router.post('/jtex', async function (req, res) {
        res.json({ "code": "1", "msg": "success", "data": null });

        try {
            const { bizContent } = req.body;
            if (!bizContent) return;

            const data = typeof bizContent === 'string' ? JSON.parse(bizContent) : bizContent;
            const billCode = data.billCode;
            const events = Array.isArray(data.details) ? data.details.filter(Boolean) : [];
            if (!billCode || events.length === 0) return;

            const db = DBConnection.promise();

            events.sort((a, b) => (toEpoch(a.scanTime) || 0) - (toEpoch(b.scanTime) || 0));
            const newest = events[events.length - 1];
            const scanCode = eventCode(newest);

            const partSign = Number(newest.partSign ?? data.partSign ?? 0);
            if (partSign === 1 && !isPartReturnBill(billCode)) {
                await createPartReturnOrder(billCode);
            }

            const storedNewestEpoch = await latestStoredScanEpoch(billCode);

            const withSig = await jtHasSigpic();
            for (const ev of events) {
                await insertWaybillIfNew(db, toWaybillRow(billCode, ev), withSig);
            }

            const newestEpoch = toEpoch(newest.scanTime);
            const isStale = storedNewestEpoch !== null && newestEpoch !== null && newestEpoch < storedNewestEpoch;
            if (isStale) return;

            const st = await applyJTStatus(billCode, newest);
            if (!st.found) {
                console.warn(`[Webhook J&T] KHÔNG TÌM THẤY đơn hàng. Bill: ${billCode}`);
                return;
            }

            if (st.applied && JT_NOTIFY_CODES.has(scanCode)) {
                try {
                    await notifyShop(db, billCode, scanCode, st.statustext, st.issue);
                } catch (notiError) {
                    console.error('[J&T FCM] Lỗi gửi notification:', notiError.message);
                }
            }
        } catch (error) {
            console.error('Lỗi Webhook J&T:', error);
        }
    });
};
