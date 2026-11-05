'use strict';
const bwipjs = require('bwip-js');
const PDFDocument = require('pdfkit');
const path = require('path');
const { JT_SENDER, JT_ORDER_NOTE, JT_PRODUCT_NAME } = require('../configs/jtLabelConfig');

const PRINTER = 'HPRT N41';
const VIETTEL_CONFIG = { printerName: PRINTER, widthMm: 150, heightMm: 100 };
const JT_CONFIG = { printerName: PRINTER, widthMm: 80, heightMm: 80 };

function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isJT(provider) {
    return String(provider || '').trim().toLowerCase() === 'j&t';
}

const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });


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

async function viettelBarcodeImg(code) {
    const buf = await bwipjs.toBuffer({ bcid: 'code128', text: code, scale: 2, height: 8, includetext: false, paddingwidth: 5, paddingheight: 0, backgroundcolor: 'FFFFFF' });
    const { w } = pngSize(buf);
    return `<img src="data:image/png;base64,${buf.toString('base64')}" width="${w}" height="30"/>`;
}

async function viettelQrImg(code) {
    const buf = await bwipjs.toBuffer({ bcid: 'qrcode', text: code, eclevel: 'H', scale: 3, paddingwidth: 8, paddingheight: 8, backgroundcolor: 'FFFFFF' });
    const { w, h } = pngSize(buf);
    return `<img src="data:image/png;base64,${buf.toString('base64')}" width="${Math.round(w / 2)}" height="${Math.round(h / 2)}"/>`;
}

async function renderViettelHtml(o) {
    const code = String(o.realorderid || '');
    const [barcode, qr] = await Promise.all([viettelBarcodeImg(code), viettelQrImg(code)]);
    const tinhSort = o.sortcode ? `${o.tinh} - ${o.sortcode}` : o.tinh;
    const cod = (Number(o.cod) || 0).toLocaleString('vi-VN');

    return `<html><head>
                <meta charset="utf-8">
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


const FONT_BOLD = path.join(__dirname, '..', 'public', 'fonts', 'Tahoma-Bold.ttf');
const FONT_REGULAR = path.join(__dirname, '..', 'public', 'fonts', 'Tahoma.ttf');
const BRAND_LINES = ['Áo Dài', 'Gia Bảo'];

const PAGE = 226.77;
const FRAME_X = 5;
const FRAME_W = 216.77;
const COL_W = FRAME_W / 3;
const COL_X1 = FRAME_X + COL_W;
const COL_X2 = COL_X1 + COL_W;
const RIGHT = FRAME_X + FRAME_W;
const LINE = 1.5;

let _measurer = null;
function measurer() {
    if (!_measurer) _measurer = new PDFDocument({ size: [PAGE, PAGE], margins: { top: 0, left: 0, right: 0, bottom: 0 } });
    return _measurer;
}

function formatSortCode(sortString) {
    if (!sortString) return ['', '', ''];
    const parts = String(sortString).split('-').map(p => p.trim());
    if (parts.length === 5) return [parts[0], `${parts[1]}-${parts[2]}-${parts[3]}`, parts[4]];
    if (parts.length === 4) return [parts[0], `${parts[1]}-${parts[2]}`, parts[3]];
    return [parts[0] || '', parts[1] || '', parts[2] || ''];
}

function fit(text, font, maxSize, minSize, width) {
    const d = measurer();
    d.font(font);
    let size = maxSize;
    const wide = (t) => d.fontSize(size).widthOfString(t) > width;
    while (size > minSize && wide(text)) size -= 0.5;
    if (wide(text)) {
        while (text.length > 1 && wide(text + '…')) text = text.slice(0, -1);
        text = text.trimEnd() + '…';
    }
    return { text, size };
}

function receiverText(name, phone, maxWidth, minSize) {
    const d = measurer();
    d.font(FONT_BOLD).fontSize(minSize);
    let n = String(name || '');
    const full = (t) => `NHẬN: ${t} - ${phone || ''}`;
    if (d.widthOfString(full(n)) <= maxWidth) return full(n);
    while (n.length > 1 && d.widthOfString(full(n + '…')) > maxWidth) n = n.slice(0, -1);
    return full(n.trimEnd() + '…');
}

function money(v) {
    const n = Number(v);
    return (Number.isFinite(n) ? n : 0).toLocaleString('vi-VN');
}

const r3 = (n) => Math.round(n * 1000) / 1000;

function lineHeightOf(font, size) {
    return r3(measurer().font(font).fontSize(size).currentLineHeight());
}

function textLine(x, y, width, align, { text, size }, bold) {
    const font = bold ? FONT_BOLD : FONT_REGULAR;
    return `<div class="t" style="left:${r3(x)}pt;top:${r3(y)}pt;width:${r3(width)}pt;text-align:${align};` +
        `font-weight:${bold ? 'bold' : 'normal'};font-size:${size}pt;line-height:${lineHeightOf(font, size)}pt;white-space:nowrap;">${escapeHtml(text)}</div>`;
}

const hline = (y, x1, x2) => `<div class="l" style="left:${r3(x1 - LINE / 2)}pt;top:${r3(y - LINE / 2)}pt;width:${r3(x2 - x1 + LINE)}pt;height:${LINE}pt;"></div>`;
const vline = (x, y1, y2) => `<div class="l" style="left:${r3(x - LINE / 2)}pt;top:${r3(y1 - LINE / 2)}pt;width:${LINE}pt;height:${r3(y2 - y1 + LINE)}pt;"></div>`;

async function renderJtHtml(o) {
    const code = String(o.realorderid || '');
    const [barcodeBuf, qrBuf] = await Promise.all([
        bwipjs.toBuffer({ bcid: 'code128', text: code, scale: 3, height: 10, includetext: false }),
        bwipjs.toBuffer({ bcid: 'qrcode', text: code, scale: 3, paddingwidth: 1, paddingheight: 1 })
    ]);
    const img = (buf, x, y, w, h) =>
        `<img class="t" style="left:${x}pt;top:${y}pt;width:${w}pt;height:${h}pt;" src="data:image/png;base64,${buf.toString('base64')}"/>`;

    const sender = JT_SENDER;
    const sort = formatSortCode(o.sortline || o.sortcode);
    const parts = [];

    parts.push(hline(FRAME_X, FRAME_X, RIGHT), hline(RIGHT, FRAME_X, RIGHT), vline(FRAME_X, FRAME_X, RIGHT), vline(RIGHT, FRAME_X, RIGHT));

    parts.push(hline(45, FRAME_X, RIGHT), vline(COL_X1, FRAME_X, 45));
    parts.push(textLine(FRAME_X, 10, COL_W, 'center', fit(BRAND_LINES[0], FONT_BOLD, 13, 8, COL_W), true));
    parts.push(textLine(FRAME_X, 25, COL_W, 'center', fit(BRAND_LINES[1], FONT_BOLD, 13, 8, COL_W), true));
    parts.push(img(barcodeBuf, COL_X1 + 10, 10, 125, 20));
    parts.push(textLine(COL_X1, 32, RIGHT - COL_X1, 'center', fit(code, FONT_BOLD, 9, 6, RIGHT - COL_X1), true));

    parts.push(hline(75, FRAME_X, RIGHT), vline(COL_X1, 45, 75), vline(COL_X2, 45, 75));
    [FRAME_X, COL_X1, COL_X2].forEach((cx, k) => {
        parts.push(textLine(cx + 2, 52, COL_W - 4, 'center', fit(sort[k] || '', FONT_BOLD, 14, 7, COL_W - 4), true));
    });

    parts.push(hline(143, FRAME_X, RIGHT));
    parts.push(textLine(10, 82, 205, 'left', fit(`GỬI: ${sender.name || 'N/A'} - ${sender.mobile || ''}`, FONT_BOLD, 9, 7, 205), true));
    parts.push(textLine(10, 95, 205, 'left', fit(receiverText(o.name, o.phone, 205, 7), FONT_BOLD, 9, 7, 205), true));

    const d = measurer();
    let addr = String(o.address || '');
    const ADDR_Y = 107, ADDR_H = 141 - ADDR_Y;
    let addrSize = 8.5;
    d.font(FONT_REGULAR);
    const tooTall = (t) => d.fontSize(addrSize).heightOfString(t, { width: 205, lineGap: 1 }) > ADDR_H;
    while (addrSize > 6.5 && tooTall(addr)) addrSize -= 0.5;
    if (tooTall(addr)) {
        const words = addr.split(/\s+/);
        while (words.length > 1 && tooTall(words.join(' ') + ' …')) words.pop();
        addr = words.join(' ') + ' …';
    }
    const addrLh = r3(lineHeightOf(FONT_REGULAR, addrSize) + 1);
    parts.push(`<div class="t" style="left:10pt;top:${ADDR_Y}pt;width:205pt;height:${ADDR_H}pt;overflow:hidden;` +
        `font-size:${addrSize}pt;line-height:${addrLh}pt;">${escapeHtml(addr)}</div>`);

    const qrX = 160;
    parts.push(vline(qrX, 143, 199), hline(199, FRAME_X, RIGHT));
    parts.push(`<div class="t" style="left:10pt;top:148pt;width:${qrX - 15}pt;font-weight:bold;font-size:8pt;line-height:${lineHeightOf(FONT_BOLD, 8)}pt;white-space:nowrap;">${escapeHtml(JT_ORDER_NOTE)}</div>`);
    const kg = Number(o.kg);
    parts.push(textLine(10, 185, qrX - 15, 'left',
        fit(`Hàng hóa: ${JT_PRODUCT_NAME} x ${Number.isFinite(kg) ? kg : o.kg} KG`, FONT_REGULAR, 12, 8, qrX - 15), false));
    parts.push(img(qrBuf, qrX + 4, 145, 52, 52));

    parts.push(textLine(FRAME_X, 205, FRAME_W, 'center', fit(`TIỀN THU HỘ: ${money(o.cod)} VNĐ`, FONT_BOLD, 13, 8, FRAME_W), true));

    return `<html><head>
<meta charset="utf-8">
<style>
  @page { size: 80mm 80mm; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .p { position: relative; width: ${PAGE}pt; height: ${PAGE}pt; overflow: hidden; font-family: "Tahoma", sans-serif; color: #000; }
  .t { position: absolute; margin: 0; padding: 0; }
  .l { position: absolute; background: #000; }
</style>
</head>
<body><div class="p">
${parts.join('\n')}
</div></body></html>`;
}

/**
 * Chọn mẫu theo hãng: Viettel -> tem Viettel cũ (150x100), J&T -> tem GB cũ (80x80).
 * @returns {Promise<{html:string, config:{printerName:string,widthMm:number,heightMm:number}}>}
 */
async function renderLabel(order) {
    return isJT(order.provider)
        ? { html: await renderJtHtml(order), config: JT_CONFIG }
        : { html: await renderViettelHtml(order), config: VIETTEL_CONFIG };
}

module.exports = { renderLabel, renderViettelHtml, renderJtHtml, billedGram, formatSortCode, VIETTEL_CONFIG, JT_CONFIG };
