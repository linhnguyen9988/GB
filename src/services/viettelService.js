'use strict';
const DBConnection = require("../configs/DBConnection");
const SqlString = require('sqlstring');
const axios = require('axios');
const request = require('request');
const { VIETTEL_PASSWORD, VIETTEL_USERNAME } = require('../configs/constants');
const { getBrowser } = require('./browserService');

function PrintBillViettel(realorderid) {//chi dung cho don day tu API, don tao bang tay ko in dc
    DBConnection.query(` SELECT * FROM vietteltoken`,
        async function (error, data) {
            if (data.length > 0) {
                var token = data[0].token;
                var expiration = data[0].expiration;
                var query = 'https://partner.viettelpost.vn/v2/order/printing-code';
                request({
                    url: encodeURI(query),
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'token': token
                    },
                    body: JSON.stringify({
                        "EXPIRY_TIME": expiration, "ORDER_ARRAY": [realorderid]//het han nam 2028
                    })

                }, async function (error, response, bodyx) {
                    var body = JSON.parse(bodyx.replaceAll(" ", "").replaceAll(/\n/g, " "));
                    const printcode = body.message;
                    if (body.error == true) {
                        console.log('Don nay ko len bang API')
                        return;
                    }
                    const browser = await getBrowser();
                    const page2 = await browser.newPage();
                    await page2.bringToFront();
                    await page2.goto(`https://digitalize.viettelpost.vn/DigitalizePrint/report.do?type=100&bill=${printcode}&showPostage=1`);
                    await page2.evaluate(() => { window.print(); })
                    setTimeout(() => {
                        page2.close();
                    }, 500);
                });
            }
        });
}

async function GetViettelToken() {
    const loginUrl = 'https://partner.viettelpost.vn/v2/user/Login';
    const ownerConnectUrl = 'https://partner.viettelpost.vn/v2/user/ownerconnect';

    const credentials = {
        "USERNAME": VIETTEL_USERNAME,
        "PASSWORD": VIETTEL_PASSWORD
    };

    try {
        const loginRes = await axios.post(loginUrl, credentials, {
            headers: { 'Content-Type': 'application/json' }
        });

        const loginData = loginRes.data;

        if (loginRes.status === 200 && loginData.data && loginData.data.token) {
            console.log('Đã có token tạm, đang lấy token dài hạn...');
            const tokenRes = await axios.post(ownerConnectUrl, credentials, {
                headers: {
                    'Content-Type': 'application/json',
                    'token': loginData.data.token
                }
            });

            const bodytoken = tokenRes.data;

            if (bodytoken.status === 200) {
                const vtoken = SqlString.format(
                    'INSERT IGNORE INTO vietteltoken (userid, token, expiration) VALUES(?,?,?) ON DUPLICATE KEY UPDATE token=?, expiration=?;',
                    [bodytoken.data.userId, bodytoken.data.token, bodytoken.data.expired, bodytoken.data.token, bodytoken.data.expired]
                );

                try {
                    await DBConnection.query(vtoken);
                    console.log('Cập nhật Viettel Token thành công!');
                } catch (sqlError) {
                    console.error('ERROR: SQL ERROR', sqlError.message);
                }
            } else {
                console.log('Lỗi lấy token dài hạn:', bodytoken.message || bodytoken);
            }
        } else {
            console.log('Đăng nhập thất bại:', loginData);
        }

    } catch (error) {
        if (error.response) {
            console.error('Lỗi API Viettel:', error.response.data);
        } else {
            console.error('Lỗi kết nối:', error.message);
        }
    }
}

module.exports = { PrintBillViettel, GetViettelToken };
