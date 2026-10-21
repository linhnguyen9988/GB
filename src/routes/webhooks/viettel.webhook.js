import DBConnection from "../../configs/DBConnection";
const fs = require('fs');
const path = require('path');
const { SendCanhBao } = require('../../services/shipmentAlertService');
const { VIETTEL_WEBHOOK_TOKEN } = require('../../configs/constants');
const { sendFcmToUser } = require('../fcm');

    const POD_LOG_FILE = path.join(__dirname, '..', 'pod-webhooks.txt');

function logPodWebhookToFile(rawBody, orderNumber, podImages) {
    const timestamp = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' });
    const lines = [
        '='.repeat(80),
        `Thời gian ghi: ${timestamp}`,
        `Đơn hàng: ${orderNumber}`,
        `Số ảnh POD: ${podImages.length}`,
        `Link ảnh: ${podImages.join(', ')}`,
        '--- Toàn bộ payload webhook ---',
        JSON.stringify(rawBody, null, 2),
        '='.repeat(80),
        '', ''
    ].join('\n');

    fs.appendFile(POD_LOG_FILE, lines, (err) => {
        if (err) console.error('Lỗi ghi file pod-webhooks.txt:', err);
    });
}

module.exports = function registerViettelWebhook(router) {
    router.post('/viettel', async (req, res) => {
        try {
            const body = req.body;
            if (body.TOKEN !== VIETTEL_WEBHOOK_TOKEN) {
                return res.status(401).send('Unauthorized');
            }
            const data = body.DATA;
            
            let status = parseInt(data.ORDER_STATUS);
            let statustext = data.STATUS_NAME;

            if (status === -108) {
                status = 100;
                statustext = 'Mới tạo';
            }

            const reasonCode = data.REASON_CODE || null;

            const podImages = data.POD?.IMAGES || [];
            if (podImages.length > 0) {
                console.log(`[POD] Đơn ${data.ORDER_NUMBER} ĐÃ CÓ ${podImages.length} ảnh POD:`, podImages);
                logPodWebhookToFile(body, data.ORDER_NUMBER, podImages);
            } else {
                //console.log(`[POD] Đơn ${data.ORDER_NUMBER} chưa có ảnh POD (mảng rỗng)`);
            }
            const podImagesJson = podImages.length > 0 ? JSON.stringify(podImages) : null;

            const orderNumber = data.ORDER_NUMBER;
            //logPodWebhookToFile(body, data.ORDER_NUMBER, podImages);//de xem webhook thoi, sau nay bo di
            const db = DBConnection.promise();

            const [dupRows] = await db.query(
                'SELECT 1 FROM order_logs WHERE order_number = ? AND status_code = ? AND status_date_raw = ? LIMIT 1',
                [orderNumber, status, data.ORDER_STATUSDATE]
            );
            if (dupRows.length > 0) {
                //console.log(`[Duplicate] Bỏ qua webhook trùng: đơn ${orderNumber}, status=${status}, date=${data.ORDER_STATUSDATE}`);
                return res.sendStatus(200);
            }

            let phone = data.EMPLOYEE_PHONE || '';
            if (phone.startsWith('84')) {
                phone = '0' + phone.substring(2);
            }

            const is1P1 = /1P\d+$/i.test(orderNumber);
            const baseOrderNumber = is1P1 ? orderNumber.replace(/1P\d+$/i, '') : orderNumber;

            const [rows] = await db.query(
                'SELECT * FROM lendon WHERE realorderid = ? LIMIT 1',
                [orderNumber]
            );

            const FINAL_STATUSES = new Set([101, 107, 201, 501, 503, 504]);

            const FLUTTER_500 = new Set([500, 502, 505, 506, 507, 508, 509, 515, 550, 551]);

            if (rows.length === 0 && is1P1) {
                const [baseRows] = await db.query(
                    'SELECT * FROM lendon WHERE realorderid = ? LIMIT 1',
                    [baseOrderNumber]
                );

                if (baseRows.length > 0) {
                    const base = baseRows[0];
                    const timenow = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Saigon" });
                    await db.query(
                        `INSERT INTO lendon (name, phone, address, cod, kg, status, date, orderid, realorderid, khid, userid, realfbid, time, provider, statuscode, statustext, reason_code, pod_images, last_update)
                 VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, NOW())`,
                        [
                            base.name, base.phone, base.address,
                            base.kg, 1, timenow,
                            orderNumber, orderNumber,
                            base.khid, base.userid, base.realfbid,
                            base.provider || 'Viettel',
                            status, statustext, reasonCode, podImagesJson
                        ]
                    );
                    console.log(`[1P1] Tạo đơn hoàn 1 phần mới: ${orderNumber} từ đơn gốc ${baseOrderNumber}`);
                } else {
                    console.warn(`[1P1] Không tìm thấy đơn gốc ${baseOrderNumber} để tạo đơn ${orderNumber}`);
                }
            } else if (rows.length > 0) {
                const currentStatus = parseInt(rows[0].statuscode) || 0;
                const isCurrentFinal = FINAL_STATUSES.has(currentStatus);
                const isNewFinal = FINAL_STATUSES.has(status);
                const isFlutterMove = FLUTTER_500.has(currentStatus) && FLUTTER_500.has(status);

                const shouldUpdateStatus = !isCurrentFinal && (status > currentStatus || isNewFinal || isFlutterMove);
                const shouldUpdateReasonOnly = isCurrentFinal && !shouldUpdateStatus &&
                    ((reasonCode && !rows[0].reason_code) || (podImagesJson && !rows[0].pod_images));

                if (shouldUpdateStatus) {
                    await db.query(`
                UPDATE lendon 
                SET statuscode = ?, 
                    statustext = ?, 
                    cod = ?,
                    shipper_name = ?, 
                    shipper_phone = ?,
                    reason_code = ?,
                    pod_images = COALESCE(?, pod_images),
                    last_update = NOW()
                WHERE realorderid = ?`,
                        [status, statustext, data.MONEY_COLLECTION,
                            data.EMPLOYEE_NAME || null, phone || null, reasonCode, podImagesJson, orderNumber]
                    );

                    const NOTIFY_STATUSES = {
                        505: '⚠️', 506: '⚠️', 507: '⚠️',
                        502: '🔄', 515: '🔄', 551: '🔄', 504: '🔄',
                    };

                    if (NOTIFY_STATUSES[status] && rows[0].userid) {
                        const userId = rows[0].useraccountid;
                        const note = data.NOTE || '';
                        const money = Number(data.MONEY_COLLECTION) || 0;
                        const title = `${rows[0].name} (${money.toLocaleString()} đ)`;
                        const body = note ? `${statustext} - ${note}.` : `${statustext}.`;

                        const [notiRows] = await db.query(
                            'SELECT 1 FROM order_noti_log WHERE realorderid = ? AND status_code = ? LIMIT 1',
                            [orderNumber, status]
                        );

                        if (!notiRows.length) {
                            const [result] = await db.query(
                                'INSERT IGNORE INTO order_noti_log (realorderid, status_code, sent_at, title, body, userid) VALUES (?, ?, NOW(), ?, ?, ?)',
                                [orderNumber, status, title, body, userId]
                            );
                            const notiId = result.insertId;
                            const payload = {
                                type: 'order_status',
                                realorderid: orderNumber,
                                status,
                                noti_id: notiId
                            };
                            if (!note.includes('hẹn phát lại') && !note.includes('Áo dài Gia Bảo')) {
                                SendCanhBao(orderNumber, data.EMPLOYEE_NAME, phone, money, note || statustext);
                                await sendFcmToUser(db, userId, title, body, payload);
                            }
                        }
                    }
                } else if (shouldUpdateReasonOnly) {
                    await db.query(
                        `UPDATE lendon 
                 SET reason_code = COALESCE(reason_code, ?),
                     pod_images = COALESCE(pod_images, ?),
                     last_update = NOW()
                 WHERE realorderid = ?`,
                        [reasonCode, podImagesJson, orderNumber]
                    );
                    console.log(`[Reason/POD Only] Đơn ${orderNumber} đã final (status=${currentStatus}), bổ sung reason_code=${reasonCode || '(không đổi)'}, pod_images=${podImagesJson ? 'có' : '(không đổi)'}`);
                } else {
                    console.log(`[Skip Update] Đơn ${orderNumber}: currentStatus=${currentStatus}${isCurrentFinal ? ' (đã chốt)' : ''}, status nhận được=${status} không phải bước tiến hợp lệ`);
                }
            }

            await db.query(`
        INSERT IGNORE INTO order_logs 
        (order_number, status_code, status_name, location, note, money_collection, employee_name, employee_phone, status_date_raw, reason_code, pod_images) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [orderNumber, status, statustext,
                    data.LOCATION_CURRENTLY || data.LOCALION_CURRENTLY,
                    data.NOTE || '', data.MONEY_COLLECTION,
                    data.EMPLOYEE_NAME || null, phone || null, data.ORDER_STATUSDATE, reasonCode, podImagesJson]
            );

            res.sendStatus(200);
        } catch (error) {
            console.error('Webhook Error:', error);
            res.status(500).send('Internal Server Error');
        }
    });

    /* xai chung voi flutter, ko can cai nay nua
    router.get('/api/order-tracking/:order_number', async (req, res) => {
        try {
            const { order_number } = req.params;
            const db = DBConnection.promise();

            // Lấy provider từ bảng lendon
            const [orderInfo] = await db.query(
                'SELECT provider FROM lendon WHERE realorderid = ? LIMIT 1',
                [order_number]
            );

            const provider = orderInfo.length > 0 ? (orderInfo[0].provider || 'Viettel') : 'Viettel';

            let logs = [];

            if (provider === 'J&T') {
                const [jtLogs] = await db.query(
                    `SELECT 
                    scantime        AS status_date_raw,
                    scantypename    AS status_name,
                    CONCAT(scanward, ', ', scancity, ', ', scanprov) AS location,
                    scanbyname      AS employee_name,
                    scanbycontact   AS employee_phone,
                    issuename       AS note,
                    0               AS money_collection
                FROM jtwaybill 
                WHERE billcode = ? 
                ORDER BY scantime DESC`,
                    [order_number]
                );
                logs = jtLogs;
            } else {
                const [vtLogs] = await db.query(
                    'SELECT * FROM order_logs WHERE order_number = ? ORDER BY status_date_raw DESC',
                    [order_number]
                );
                logs = vtLogs;
            }

            res.json({ success: true, data: logs, provider });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });*/
};
