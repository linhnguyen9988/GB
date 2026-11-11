'use strict';
const DBConnection = require("../../configs/DBConnection");
const { sendFcmToUser } = require('../fcm');
const zaloAlerts = require('../../services/zaloShipmentAlerts');
const { SendCanhBao } = require('../../services/shipmentAlertService');
const {
    JT_FINAL_CODES, jtHasSigpic, isPartReturnBill, eventCode, toWaybillRow, toEpoch, readJTDetails, latestJTStatusIndex,
    insertWaybillIfNew, readStoredJTWaybill, latestStoredScanEpoch, lockJTOrder, applyJTStatus, createPartReturnOrder
} = require('../../services/jtExpressService');

const JT_NOTIFY_CODES = new Set([116, 117, 118, 120]);
const JT_MESSENGER_CODES = new Set([118, 120]);

function normalizeReason(text) {
    return typeof text === 'string' ? text.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

function isInProvinceAddressChange(text) {
    return /^thay đổi địa chỉ giao hàng ?\( ?nội tỉnh ?\)$/.test(normalizeReason(text));
}

async function claimNotifications(billCode, notices) {
    const conn = await DBConnection.getConnection();
    const claimed = [];
    try {
        await conn.beginTransaction();
        const locked = await lockJTOrder(conn, billCode);
        if (locked) {
            const [[order]] = await conn.query(
                "SELECT name, cod, userid, useraccountid FROM lendon WHERE realorderid = ? AND provider = 'J&T' LIMIT 1",
                [billCode]
            );
            const title = `${order.name} - J&T`;
            const final = JT_FINAL_CODES.includes(Number(locked.statuscode));
            for (const [code, notice] of notices) {
                const messenger = notice.messenger && Boolean(order.userid) && !final;
                if (!notice.push && !messenger) continue;
                const [existing] = await conn.query(
                    'SELECT 1 FROM order_noti_log WHERE realorderid = ? AND status_code = ? LIMIT 1',
                    [billCode, code]
                );
                if (existing.length) continue;
                const [result] = await conn.query(
                    'INSERT IGNORE INTO order_noti_log (realorderid, status_code, sent_at, title, body, userid) VALUES (?, ?, NOW(), ?, ?, ?)',
                    [billCode, code, title, notice.body, order.useraccountid]
                );
                if (result.affectedRows) claimed.push({ ...notice, code, title, order, messenger, id: result.insertId });
            }
        }
        await conn.commit();
        return claimed;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
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
        const statusIndex = latestJTStatusIndex(events);
        const alerts = new Map();
        let latestIssue;
        let suppressStatusNotice = false;
        for (const [index, event] of events.entries()) {
            const row = toWaybillRow(billCode, event);
            const issue = await insertWaybillIfNew(conn, row, withSig);
            const suppressNotice = isInProvinceAddressChange(issue) || isInProvinceAddressChange(event.scanTypeName);
            if (index === statusIndex) {
                latestIssue = issue;
                suppressStatusNotice = suppressNotice;
            }
            if (!suppressNotice && zaloAlerts.isIssue('J&T', row.scantypecode)) {
                alerts.set(row.scantypecode, {
                    body: issue ? row.scantypename + ' - ' + issue : row.scantypename,
                    phone: row.scanbycontact,
                    time: toEpoch(event.scanTime),
                    buyerRescheduled: [issue, event.scanTypeName].some(reason => normalizeReason(reason) === 'người mua hẹn lại ngày nhận')
                });
            }
        }

        const stale = storedNewest !== null && toEpoch(newest.scanTime) < storedNewest;
        const status = stale ? null : await applyJTStatus(billCode, events[statusIndex], conn, latestIssue);
        if (alerts.size) {
            const [[order]] = await conn.query(
                "SELECT name, phone, cod FROM lendon WHERE realorderid = ? AND provider = 'J&T' LIMIT 1",
                [billCode]
            );
            for (const [code, alert] of alerts) {
                await zaloAlerts.enqueue(conn, 'J&T', billCode, code, alert.body, order);
            }
        }
        const notices = new Map();
        const scanCode = eventCode(newest);
        if (status?.applied && !suppressStatusNotice && JT_NOTIFY_CODES.has(scanCode)) {
            const body = status.issue ? status.statustext + ' - ' + status.issue : status.statustext;
            notices.set(scanCode, { body, push: true });
        }
        for (const [code, alert] of alerts) {
            if (!alert.buyerRescheduled && JT_MESSENGER_CODES.has(code) && (storedNewest === null || alert.time >= storedNewest)) {
                notices.set(code, { ...notices.get(code), body: alert.body, phone: alert.phone, messenger: true });
            }
        }
        await conn.commit();
        return { billCode, notices };
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

        const { billCode, notices } = result;
        if (notices.size) {
            try {
                const claimed = await claimNotifications(billCode, notices);
                await Promise.all(claimed.flatMap(notice => {
                    const deliveries = [];
                    if (notice.messenger) {
                        deliveries.push(SendCanhBao(billCode, null, notice.phone, Number(notice.order.cod) || 0, notice.body, 'J&T'));
                    }
                    if (notice.push) {
                        deliveries.push(sendFcmToUser(DBConnection.promise(), notice.order.useraccountid, notice.title, notice.body, {
                            type: 'order_status', realorderid: billCode, status: notice.code, noti_id: notice.id
                        }));
                    }
                    return deliveries;
                }));
            } catch (error) {
                console.error('[J&T] Lỗi xử lý thông báo:', error.code || error.message);
            }
        }
    });
};
