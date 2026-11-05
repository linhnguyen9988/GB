'use strict';
const DBConnection = require('../configs/DBConnection');
const { isPrinterOnline, sendHtml } = require('./printAgent');
const { renderLabel } = require('./labelHtml');

function stripJtCode(v) {
    return String(v || '').replace(/-\s*\d{2,3}[A-Za-z]+\d*\s*$/, '').trim();
}

async function resolveAdminUnits({ address, phone, userid }) {
    const [rows] = await DBConnection.query(
        `SELECT xa, huyen, tinh FROM diachilendon
          WHERE LOWER(TRIM(address)) = LOWER(?) AND phone = ? AND userid = ?
            AND xa IS NOT NULL AND xa <> ''
          ORDER BY id DESC LIMIT 1`,
        [String(address || '').trim(), phone, userid]
    );
    if (rows.length) return { xa: rows[0].xa, huyen: rows[0].huyen || '', tinh: rows[0].tinh || '', approx: false };

    const parts = String(address || '').split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
        const n = parts.length;
        return { xa: parts[n - 3], huyen: parts[n - 2], tinh: parts[n - 1], approx: true };
    }
    return { xa: '', huyen: '', tinh: '', approx: true };
}

async function loadLabelOrder(code) {
    const [rows] = await DBConnection.query(
        'SELECT * FROM lendon WHERE realorderid = ? OR orderid = ? LIMIT 1', [code, code]
    );
    if (!rows.length) return null;
    const r = rows[0];
    if (r.xa) return { ...r, approx: false };
    const units = await resolveAdminUnits(r);
    return { ...r, ...units };
}

async function printLabelByCode(code, userId) {
    code = String(code || '').trim();
    if (!code) return { success: false, status: 400, message: 'Thiếu mã đơn' };

    const order = await loadLabelOrder(code);
    if (!order) return { success: false, status: 404, message: 'Không tìm thấy đơn hàng' };
    if (!isPrinterOnline(userId)) return { success: false, status: 404, message: 'Máy in Offline' };

    const { html, config } = await renderLabel(order);
    sendHtml(userId, html, config);
    return {
        success: true,
        message: order.approx ? 'Đã gửi lệnh in (tỉnh/huyện/xã suy từ địa chỉ, hãy kiểm tra tem)' : 'Đã gửi lệnh in'
    };
}

module.exports = { loadLabelOrder, printLabelByCode, resolveAdminUnits, stripJtCode };
