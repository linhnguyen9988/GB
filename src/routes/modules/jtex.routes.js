import DBConnection from "../../configs/DBConnection";
const axios = require('axios');
const jwtAuth = require('../../middleware/jwtAuth');
const { CancelOrderJT, GetBillJT, PrintBillJT } = require('../../services/jtExpressService');
const { JT_API_ACCOUNT, JT_CUSTOMER_CODE, JT_PASSWORD, JT_PKEY } = require('../../configs/constants');
const { md5ToBase64 } = require('../../utils/crypto');

module.exports = function registerJtexRoutes(router) {
    router.post('/pushorderjtex', jwtAuth, async function (req, res) {
        const db = DBConnection.promise();
        let { fbname, address, phone, cod, kg, khid, userid, realfbid, tinh, huyen, xa } = req.body;

        if (!xa) {
            return res.json({ success: false, message: "Check địa chỉ trước" });
        }

        const note = "Cho xem hàng. Không nhận thu 30k";
        const product_name = "Vải";
        const timenow = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Saigon" });

        const pkey = JT_PKEY;
        const apiAccount = JT_API_ACCOUNT;
        const matuquan = "DH" + Date.now();

        const oderjson = JSON.stringify({
            "customerCode": JT_CUSTOMER_CODE,
            "password": JT_PASSWORD,
            "txlogisticId": matuquan,
            "productType": "EXPRESS",
            "orderType": "1",
            "serviceType": "1",
            "partSign": 1,
            "deliveryType": "1",
            "totalQuantity": 1,
            "sender": {
                "name": "Áo Dài Gia Bảo",
                "mobile": "0888118855",
                "prov": "Đồng Nai",
                "city": "Thành phố Biên Hoà",
                "area": "Phường Long Bình-251TPB07",
                "address": "197 HBB"
            },
            "receiver": {
                "name": fbname,
                "mobile": phone,
                "prov": tinh,
                "city": huyen,
                "area": xa,
                "address": address
            },
            "payType": "PP_PM",
            "goodsType": "bm000010",
            "goodsValue": cod.toString(),
            "codMoney": cod.toString(),
            "itemsValue": cod.toString(),
            "remark": note,
            "englishName": "none",
            "packageInfo": {
                "weight": kg,
                "length": 10, "width": 10, "height": 10, "volume": "10"
            },
            "items": [{
                "itemName": product_name,
                "englishName": "None",
                "number": 1,
                "itemValue": cod
            }]
        });

        const digest = md5ToBase64(oderjson + pkey);
        const params = new URLSearchParams();
        params.append('bizContent', oderjson);

        try {
            const response = await axios.post(
                'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/addOrder',
                params,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'apiAccount': apiAccount,
                        'digest': digest,
                        'timestamp': Date.now().toString()
                    },
                    timeout: 5000
                }
            );

            const body = response.data;

            if (body.msg === 'success') {
                const userId = req.user.id;
                const sqlOrder = `
                    INSERT INTO lendon 
                    (name, phone, address, cod, kg, status, date, orderid, realorderid, khid, userid, realfbid, time, provider, sortline, statuscode, statustext, useraccountid)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'J&T', ?, ?, ?, ?)`;//dung userid
                await db.query(sqlOrder, [
                    fbname, phone, address, cod, kg,
                    1, timenow, matuquan, body.data.billCode,
                    khid, userid, realfbid, body.data.sortLine || null,
                    100, 'Mới tạo', userId
                ]);

                await GetBillJT(matuquan, userId);//matuquan

                return res.json({
                    success: true,
                    message: "Lên đơn J&T thành công",
                    order_code: body.data.billCode,
                    sort_line: body.data.sortLine
                });
            } else {
                return res.json({ success: false, message: "J&T từ chối: " + body.msg });
            }

        } catch (error) {
            console.error('Lỗi Create Order J&T:', error.message);
            return res.json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
        }
    });

    router.post('/printjtex', jwtAuth, function (req, res) {
        var orderid = req.body.orderid;
        PrintBillJT(orderid);
        res.sendStatus(200)
    });

    router.post('/cancelorderjt', jwtAuth, async function (req, res) {
        var orderid = req.body.orderid;
        const mess = await CancelOrderJT(orderid);
        res.json({ message: mess });
    });
};
