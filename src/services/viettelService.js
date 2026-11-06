'use strict';
const DBConnection = require('../configs/DBConnection');
const request = require('request');
const { getBrowser } = require('./browserService');
const { getAccountForOrder } = require('./viettelAccountService');

async function PrintBillViettel(realorderid, appUserId) {
    try {
        const [orders] = await DBConnection.query(
            'SELECT * FROM lendon WHERE (realorderid = ? OR orderid = ?) AND useraccountid = ? LIMIT 1',
            [String(realorderid || ''), String(realorderid || ''), Number(appUserId)]
        );
        if (!orders.length) return { success: false, message: 'Không tìm thấy đơn hàng.' };
        const account = await getAccountForOrder(DBConnection.promise(), orders[0]);
        if (!account || !account.token) return { success: false, message: 'Không tìm thấy token của tài khoản Viettel đã tạo đơn.' };

        const query = 'https://partner.viettelpost.vn/v2/order/printing-code';
        const result = await new Promise((resolve, reject) => {
            request({
                url: query,
                method: 'POST',
                headers: { 'Content-Type': 'application/json', token: account.token },
                body: JSON.stringify({ EXPIRY_TIME: account.expiration, ORDER_ARRAY: [orders[0].realorderid] })
            }, (error, response, body) => {
                if (error) return reject(error);
                try { resolve(JSON.parse(String(body || '').replace(/\u00a0/g, ' ').replace(/\n/g, ' '))); }
                catch (parseError) { reject(parseError); }
            });
        });
        if (result.error) return { success: false, message: result.message || 'Viettel không cấp mã in cho đơn này.' };
        const browser = await getBrowser();
        const page = await browser.newPage();
        try {
            await page.bringToFront();
            await page.goto(`https://digitalize.viettelpost.vn/DigitalizePrint/report.do?type=100&bill=${encodeURIComponent(result.message)}&showPostage=1`);
            await page.evaluate(() => window.print());
        } finally {
            setTimeout(() => page.close().catch(() => {}), 500);
        }
        return { success: true };
    } catch (error) {
        console.error('Lỗi in bill Viettel:', error.message);
        return { success: false, message: 'Không thể in bill Viettel.' };
    }
}

module.exports = { PrintBillViettel };
