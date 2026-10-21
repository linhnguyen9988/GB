import DBConnection from "../configs/DBConnection";
const axios = require('axios');
const qs = require('qs');
const request = require('request');
const socket = require('../socket');
const { JT_API_ACCOUNT, JT_CUSTOMER_CODE, JT_PASSWORD, JT_PKEY } = require('../configs/constants');
const { delay } = require('../utils/common');
const { getBrowser } = require('./browserService');
const { md5ToBase64 } = require('../utils/crypto');

async function CancelOrderJT(orderid) {
    const pkey = JT_PKEY;
    const apiAccount = JT_API_ACCOUNT;
    const oderjson = JSON.stringify({
        "customerCode": JT_CUSTOMER_CODE,
        "password": JT_PASSWORD,
        "txlogisticId": orderid,
        "reason": "Shop hủy đơn"
    });

    const digest = md5ToBase64(oderjson + pkey);
    const query = 'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/cancelOrder';

    try {
        const response = await axios({
            method: 'post',
            url: query,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'apiAccount': apiAccount,
                'digest': digest,
                'timestamp': new Date().getTime().toString()
            },
            data: qs.stringify({
                'bizContent': oderjson
            })
        });

        const body = response.data;

        if (body.msg === 'success') {
            const info = `Shop hủy đơn: ${body.data.billCode} -> ${body.data.txlogisticId}`;
            console.log(info);
            return info;
        } else {
            console.log(body.msg);
            return body.msg;
        }

    } catch (error) {
        console.error('Lỗi khi gọi API J&T:', error.message);
        return 'Lỗi kết nối API';
    }
}

function PrintBillJT(orderid) {
    const pkey = JT_PKEY;
    var apiAccount = JT_API_ACCOUNT;
    var oderjson = `{"customerCode":"${JT_CUSTOMER_CODE}","password":"${JT_PASSWORD}","txlogisticId":"${orderid}"}`;
    var digest = md5ToBase64(oderjson + pkey);
    var query = 'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/printOrder';
    request({
        url: encodeURI(query),
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'apiAccount': apiAccount,
            'digest': digest,
            'timestamp': new Date().getTime()
        },
        form: {
            'bizContent': oderjson
        }
    }, async function (error, response, bodyx) {
        const body = JSON.parse(bodyx);
        if (body.msg == 'success') {
            (async () => {
                const browser = await getBrowser();
                const page2 = await browser.newPage();
                await page2.bringToFront();
                await page2.setContent(`
                    <html>
                    <body style="margin:0;padding:0; height:100%;">
                        <iframe src="data:application/pdf;base64,${body.data.base64EncodeContent}" style="width:100%; height:100%; border:none;"></iframe>
                    </body>
                    </html>
                `, { waitUntil: 'load' });
                await delay(500);
                await page2.evaluate(() => { window.print(); });
                setTimeout(() => {
                    page2.close();
                }, 500);
            })();
        } else {
            console.log(body.msg);
        }
    });
}

async function GetBillJT(orderid, userId) {
    const db = DBConnection.promise();
    const io = socket.getIo();
    const pkey = JT_PKEY;
    const apiAccount = JT_API_ACCOUNT;
    const oderjson = JSON.stringify({
        "customerCode": JT_CUSTOMER_CODE,
        "password": JT_PASSWORD,
        "txlogisticId": orderid
    });
    const digest = md5ToBase64(oderjson + pkey);
    const params = new URLSearchParams();
    params.append('bizContent', oderjson);

    try {
        const response = await axios.post(
            'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/printOrder',
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'apiAccount': apiAccount,
                    'digest': digest,
                    'timestamp': Date.now().toString()
                },
                timeout: 3000
            }
        );

        const body = response.data;
        if (body.msg === 'success' && body.data?.base64EncodeContent) {
            await db.query(
                'INSERT INTO jtbill (billcode, base64) VALUES (?, ?)',
                [orderid, body.data.base64EncodeContent]
            );
            const userRoom = `USER_ROOM_${userId}`;
            io.to(userRoom).emit("print-now", {
                type: 'pdf',
                base64: body.data.base64EncodeContent,
                config: {
                    printerName: "HPRT N41",
                    widthMm: 80,
                    heightMm: 80
                }
            });
            return true;
        } else {
            console.error(`❌ Lỗi lấy bill J&T (${orderid}):`, body.msg);
            return false;
        }
    } catch (error) {
        console.error(`❌ Lỗi kết nối lấy bill J&T:`, error.message);
        return false;
    }
}

module.exports = { CancelOrderJT, PrintBillJT, GetBillJT };
