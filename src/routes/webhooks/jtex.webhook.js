import DBConnection from "../../configs/DBConnection";
const { sendFcmToUser } = require('../fcm');

module.exports = function registerJtexWebhook(router) {
    router.post('/jtex', async function (req, res) {
        const db = DBConnection.promise();
        res.json({ "code": "1", "msg": "success", "data": null });

        try {
            const { bizContent } = req.body;
            if (!bizContent) return;

            const data = JSON.parse(bizContent);
            const billCode = data.billCode;
            const details = data.details[0];

            const statusMapVn = {
                103: "Tạo đơn thành công",
                105: "Đã hủy đơn",
                106: "Bưu tá đã lấy hàng",
                109: "Xuất kho trung chuyển",
                110: "Hàng đã đến bưu cục",
                112: "Đang giao hàng",
                113: "Giao hàng thành công",
                116: "Đang chuyển hoàn",
                117: "Đã ký nhận hoàn trả",
                118: "Kiện vấn đề (Giao)",
                120: "Kiện vấn đề (Hoàn)"
            };

            let currentTypeName = statusMapVn[details.scanTypeCode] || details.scanTypeName || "Hành trình mới";
            if (currentTypeName == '中心到件') currentTypeName = 'Hàng đến kho TTKT';
            else if (currentTypeName == '取件失败') currentTypeName = 'Nhận hàng không thành công';

            let scanbyphone = details.scanByContact;
            if (scanbyphone) scanbyphone = scanbyphone.replace("+84", "0");

            const waybillParams = [
                billCode,
                details.scanByCode || null,
                scanbyphone || null,
                details.scanByName || null,
                details.scanNetworkArea || null,
                details.scanNetworkCity || null,
                details.scanNetworkProvince || null,
                details.scanNetworkName || null,
                details.scanTime,
                currentTypeName,
                details.abnormalPieceName || null
            ];

            const sqlInsertWaybill = `INSERT INTO jtwaybill
            (billcode, scanbycode, scanbycontact, scanbyname, scanward, scancity, scanprov, scanpost, scantime, scantypename, issuename, scantypecode)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;

            await db.query(sqlInsertWaybill, [...waybillParams, Number(details.scanTypeCode)]);
            const scanCode = Number(details.scanTypeCode);
            let updateSql = "";
            let params = [];

            switch (scanCode) {
                case 103:
                case 105:
                case 106:
                case 109:
                    updateSql = `UPDATE lendon SET statuscode = ?, statustext = ?, kg = ?, last_update = NOW() WHERE realorderid = ?`;
                    params = [scanCode, currentTypeName, details.weight, billCode];
                    break;

                case 110:
                    updateSql = `UPDATE lendon SET statuscode = ?, statustext = ?, issue = NULL , kg = ?, last_update = NOW()
                     WHERE realorderid = ? AND statuscode NOT IN (113, 105, 117)`;
                    params = [scanCode, currentTypeName, details.weight, billCode];
                    break;

                case 112:
                case 116:
                case 117:
                    updateSql = `UPDATE lendon SET statuscode = ?, statustext = ?, issue = NULL, kg = ?, last_update = NOW() WHERE realorderid = ?`;
                    params = [scanCode, currentTypeName, details.weight, billCode];
                    break;

                case 113:
                    updateSql = `UPDATE lendon SET statuscode = ?, statustext = ?, issue = NULL, kg = ?, last_update = NOW() WHERE realorderid = ?`;
                    params = [scanCode, currentTypeName, details.weight, billCode];
                    break;

                case 118:
                case 120:
                    updateSql = `UPDATE lendon SET statuscode = ?, statustext = ?, issue = ?, kg = ?, last_update = NOW() WHERE realorderid = ?`;
                    params = [scanCode, currentTypeName, details.abnormalPieceName, details.weight, billCode];
                    break;

                default:
                    console.log(details.scanTypeName);
                    updateSql = null;
            }

            if (updateSql) {
                const [result] = await db.query(updateSql, params);
                if (result.affectedRows === 0) {
                    console.warn(`[Webhook J&T] KHÔNG TÌM THẤY đơn hàng. Bill: ${billCode}`);
                }
            }

            const JT_NOTIFY_CODES = {
                116: '🔄',
                117: '🔄',
                118: '⚠️',
                120: '⚠️',
            };

            if (JT_NOTIFY_CODES[scanCode]) {
                try {
                    const [orderRows] = await db.query(
                        'SELECT * FROM lendon WHERE realorderid = ? LIMIT 1',
                        [billCode]
                    );

                    if (orderRows.length > 0) {
                        const order = orderRows[0];
                        const userId = order.useraccountid;
                        const title = `${order.name} - J&T`;
                        const body = `${currentTypeName}${details.abnormalPieceName ? ' - ' + details.abnormalPieceName : ''}`;

                        const [notiRows] = await db.query(
                            'SELECT 1 FROM order_noti_log WHERE realorderid = ? AND status_code = ? LIMIT 1',
                            [billCode, scanCode]
                        );

                        if (!notiRows.length) {
                            const [result] = await db.query(
                                'INSERT IGNORE INTO order_noti_log (realorderid, status_code, sent_at, title, body, userid) VALUES (?, ?, NOW(), ?, ?, ?)',
                                [billCode, scanCode, title, body, userId]
                            );
                            const notiId = result.insertId;
                            const payload = {
                                type: 'order_status',
                                realorderid: billCode,
                                status: scanCode,
                                noti_id: notiId
                            };
                            await sendFcmToUser(db, userId, title, body, payload);
                        }
                    }
                } catch (notiError) {
                    console.error('[J&T FCM] Lỗi gửi notification:', notiError.message);
                }
            }

        } catch (error) {
            console.error('Lỗi Webhook J&T:', error);
        }
    });
};
