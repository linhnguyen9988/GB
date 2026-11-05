'use strict';
const bwipjs = require('bwip-js');
const DBConnection = require('../configs/DBConnection');
const { isPrinterOnline, sendHtml } = require('./printAgent');

const PRINT_CONFIG = { printerName: 'HPRT N41', widthMm: 150, heightMm: 100 };

function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function catGonChuoi(chuoi, doDaiToiDa) {
    chuoi = String(chuoi || '');
    return chuoi.length <= doDaiToiDa ? chuoi : chuoi.substring(0, doDaiToiDa) + '...';
}

function billedGram(kg) {
    let g = (Number(kg) > 0 ? Number(kg) : 1) * 1000;
    if (g <= 1000) g = 500;
    else if (g <= 2000) g = 1000;
    else if (g <= 3000) g = 1500;
    else if (g <= 4000) g = 2000;
    else if (g <= 6000) g = g - 2000;
    else if (g <= 9000) g = g - 3000;
    else if (g <= 15000) g = g - 4000;
    else g = g - 5000;
    return g;
}

const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });

async function barcodeImg(code) {
    const buf = await bwipjs.toBuffer({ bcid: 'code128', text: code, scale: 2, height: 8, includetext: false, paddingwidth: 5, paddingheight: 0, backgroundcolor: 'FFFFFF' });
    const { w } = pngSize(buf);
    return `<img src="data:image/png;base64,${buf.toString('base64')}" width="${w}" height="30"/>`;
}

async function qrImg(code) {
    const buf = await bwipjs.toBuffer({ bcid: 'qrcode', text: code, eclevel: 'H', scale: 3, paddingwidth: 8, paddingheight: 8, backgroundcolor: 'FFFFFF' });
    const { w, h } = pngSize(buf);
    return `<img src="data:image/png;base64,${buf.toString('base64')}" width="${Math.round(w / 2)}" height="${Math.round(h / 2)}"/>`;
}

/**
 * Dựng HTML tem Viettel (bố cục giống tem tạo ở trình duyệt lúc lên đơn).
 * @param {{realorderid:string, name:string, phone:string, address:string, cod:number|string, kg:number|string,
 *          tinh:string, huyen:string, xa:string, sortcode?:string}} o
 */
async function renderViettelLabelHtml(o) {
    const code = String(o.realorderid || '');
    const [barcode, qr] = await Promise.all([barcodeImg(code), qrImg(code)]);
    const tinhSort = o.sortcode ? `${o.tinh} - ${o.sortcode}` : o.tinh;
    const cod = (Number(o.cod) || 0).toLocaleString('vi-VN');

    return `<html><head>
                <style>
                    body { width: 360px; margin: 2mm 0mm 2mm 2mm; line-height: 1.6; }
                    table { width: 360px; font-family: "tahoma"; border-collapse: collapse; }
                    @media print{@page {size: landscape}}
                    *, html {margin:0;padding:0;}
                </style>
                </head>
                <body>
                <table>
                    <tr><td colspan="2">Tỉnh/TP: <p style="font-size:14px;display:inline;font-weight: bold;">${escapeHtml(tinhSort)}</p></td></tr>
                    <tr><td colspan="2">Quận/Huyện: <p style="font-size:13px;display:inline;font-weight: bold;">${escapeHtml(o.huyen)}</p></td></tr>
                    <tr><td colspan="2">Phường/Xã: <p style="font-size:13px;display:inline;font-weight: bold;">${escapeHtml(o.xa)}</p></td></tr>
                    <tr><td colspan="2" align="right"><p style="font-size:10px;display:inline;">${billedGram(o.kg) / 1000} KG</p></td></tr>
                    <tr><td colspan="2"><center>${barcode}<br><p style="font-size:10px;display:inline;vertical-align: top;">${escapeHtml(code)}</p></center></td></tr>
                    <tr><td colspan="2"><h5>${escapeHtml(o.name)} • ${escapeHtml(o.phone)}</h5></td></tr>
                    <tr><td colspan="2"><p style="font-size:10px;display:inline;vertical-align: top;">${escapeHtml(catGonChuoi(o.address, 60))}</p></td></tr>
                    <tr><td><p style="font-size:10px;display:inline;vertical-align: top;">Cho xem hàng, không nhận thu 30k</p><br>
                    <p style="font-size:10px;display:inline;">1 x Vải</p><br>
                    <p style="font-size:18px;display:inline;">Tiền thu hộ: <b>${cod} đ</b></p></td>
                    <td>${qr}</td></tr>
                </table>
                </body></html>`;
}

async function resolveAdminUnits(order) {
    const [rows] = await DBConnection.query(
        `SELECT xa, huyen, tinh FROM diachilendon
          WHERE LOWER(TRIM(address)) = LOWER(?) AND phone = ? AND userid = ?
            AND xa IS NOT NULL AND xa <> ''
          ORDER BY id DESC LIMIT 1`,
        [String(order.address || '').trim(), order.phone, order.userid]
    );
    if (rows.length) return { xa: rows[0].xa, huyen: rows[0].huyen || '', tinh: rows[0].tinh || '', approx: false };

    const parts = String(order.address || '').split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
        const n = parts.length;
        return { xa: parts[n - 3], huyen: parts[n - 2], tinh: parts[n - 1], approx: true };
    }
    return { xa: '', huyen: '', tinh: '', approx: true };
}

async function loadViettelLabelOrder(realorderid) {
    const [rows] = await DBConnection.query(
        `SELECT name, phone, address, cod, kg, realorderid, sortcode, userid
           FROM lendon WHERE realorderid = ? AND provider = 'Viettel' LIMIT 1`,
        [realorderid]
    );
    if (!rows.length) return null;
    const units = await resolveAdminUnits(rows[0]);
    return { ...rows[0], ...units };
}

// In lại tem Viettel: dựng HTML từ bảng lendon rồi gửi tới máy in của user (không cần lưu file tem).
async function reprintViettelLabel(realorderid, userId) {
    const order = await loadViettelLabelOrder(realorderid);
    if (!order) return { success: false, status: 404, message: 'Không tìm thấy đơn Viettel này' };
    if (!isPrinterOnline(userId)) return { success: false, status: 404, message: 'Máy in Offline' };

    const html = await renderViettelLabelHtml(order);
    sendHtml(userId, html, PRINT_CONFIG);
    return {
        success: true,
        message: order.approx ? 'Đã gửi lệnh in lại (tỉnh/huyện/xã suy từ địa chỉ, hãy kiểm tra tem)' : 'Đã gửi lệnh in lại'
    };
}

module.exports = { renderViettelLabelHtml, loadViettelLabelOrder, reprintViettelLabel, billedGram };
