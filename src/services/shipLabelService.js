'use strict';
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const path = require('path');

const FONT_BOLD = path.join(__dirname, '..', 'public', 'fonts', 'Tahoma-Bold.ttf');
const FONT_REGULAR = path.join(__dirname, '..', 'public', 'fonts', 'Tahoma.ttf');

const BRAND_LINES = ['Áo Dài', 'Gia Bảo'];

const PAGE = 226.77;              // 80mm
const FRAME_X = 5;
const FRAME_W = 216.77;
const COL_W = FRAME_W / 3;
const COL_X1 = FRAME_X + COL_W;   // đường chia cột thứ 1
const COL_X2 = COL_X1 + COL_W;    // đường chia cột thứ 2
const RIGHT = FRAME_X + FRAME_W;  // mép phải khung

function formatSortCode(sortString) {
    if (!sortString) return ['', '', ''];
    const parts = String(sortString).split('-').map(p => p.trim());
    if (parts.length === 5) return [parts[0], `${parts[1]}-${parts[2]}-${parts[3]}`, parts[4]];
    if (parts.length === 4) return [parts[0], `${parts[1]}-${parts[2]}`, parts[3]];
    return [parts[0] || '', parts[1] || '', parts[2] || ''];
}

function fitLine(doc, text, font, maxSize, minSize, x, y, width, align = 'center') {
    let size = maxSize;
    doc.font(font);
    const wide = (t) => doc.fontSize(size).widthOfString(t) > width;
    while (size > minSize && wide(text)) size -= 0.5;
    if (wide(text)) {
        while (text.length > 1 && wide(text + '…')) text = text.slice(0, -1);
        text = text.trimEnd() + '…';
    }
    doc.fontSize(size).text(text, x, y, { width, align, lineBreak: false });
    return size;
}

function receiverLine(doc, name, phone, maxWidth, minSize) {
    doc.font(FONT_BOLD).fontSize(minSize);
    let n = String(name || '');
    const full = (t) => `NHẬN: ${t} - ${phone || ''}`;
    if (doc.widthOfString(full(n)) <= maxWidth) return full(n);
    while (n.length > 1 && doc.widthOfString(full(n + '…')) > maxWidth) n = n.slice(0, -1);
    return full(n.trimEnd() + '…');
}

function money(v) {
    const n = Number(v);
    return (Number.isFinite(n) ? n : 0).toLocaleString('vi-VN');
}

/**
 * @param {Array<{billCode:string, name:string, phone:string, address:string,
 *                cod:number|string, kg:number|string, sortLine:string,
 *                note?:string, productName?:string}>} orders
 * @param {{name:string, mobile:string}} sender
 * @returns {Promise<Buffer>} PDF (mỗi đơn 1 trang 80x80mm)
 */
async function renderShipLabelPdf(orders, sender) {
    const doc = new PDFDocument({ size: [PAGE, PAGE], margins: { top: 0, left: 0, right: 0, bottom: 0 } });

    const assets = await Promise.all(orders.map(async (o) => {
        const code = String(o.billCode || '');
        const [barcodeBuf, qrBuf] = await Promise.all([
            bwipjs.toBuffer({ bcid: 'code128', text: code, scale: 3, height: 10, includetext: false }),
            bwipjs.toBuffer({ bcid: 'qrcode', text: code, scale: 3, paddingwidth: 1, paddingheight: 1 })
        ]);
        return { o, code, barcodeBuf, qrBuf };
    }));

    for (let i = 0; i < assets.length; i++) {
        if (i > 0) doc.addPage();
        const { o, code, barcodeBuf, qrBuf } = assets[i];
        const sort = formatSortCode(o.sortLine);

        doc.lineWidth(1.5).strokeColor('#000000').fillColor('#000000');
        doc.rect(FRAME_X, FRAME_X, FRAME_W, FRAME_W).stroke();

        doc.moveTo(FRAME_X, 45).lineTo(RIGHT, 45).stroke();
        doc.moveTo(COL_X1, FRAME_X).lineTo(COL_X1, 45).stroke();
        fitLine(doc, BRAND_LINES[0], FONT_BOLD, 13, 8, FRAME_X, 10, COL_W);
        fitLine(doc, BRAND_LINES[1], FONT_BOLD, 13, 8, FRAME_X, 25, COL_W);
        doc.image(barcodeBuf, COL_X1 + 10, 10, { width: 125, height: 20 });
        fitLine(doc, code, FONT_BOLD, 9, 6, COL_X1, 32, RIGHT - COL_X1);

        doc.moveTo(FRAME_X, 75).lineTo(RIGHT, 75).stroke();
        doc.moveTo(COL_X1, 45).lineTo(COL_X1, 75).stroke();
        doc.moveTo(COL_X2, 45).lineTo(COL_X2, 75).stroke();
        [FRAME_X, COL_X1, COL_X2].forEach((cx, k) => {
            fitLine(doc, sort[k] || '', FONT_BOLD, 14, 7, cx + 2, 52, COL_W - 4);
        });

        doc.moveTo(FRAME_X, 143).lineTo(RIGHT, 143).stroke();
        fitLine(doc, `GỬI: ${sender.name || 'N/A'} - ${sender.mobile || ''}`, FONT_BOLD, 9, 7, 10, 82, 205, 'left');
        fitLine(doc, receiverLine(doc, o.name, o.phone, 205, 7), FONT_BOLD, 9, 7, 10, 95, 205, 'left');
        let addr = String(o.address || '');
        const ADDR_Y = 107, ADDR_H = 141 - ADDR_Y;
        let addrSize = 8.5;
        doc.font(FONT_REGULAR);
        const tooTall = (t) => doc.fontSize(addrSize).heightOfString(t, { width: 205, lineGap: 1 }) > ADDR_H;
        while (addrSize > 6.5 && tooTall(addr)) addrSize -= 0.5;
        if (tooTall(addr)) {
            const words = addr.split(/\s+/);
            while (words.length > 1 && tooTall(words.join(' ') + ' …')) words.pop();
            addr = words.join(' ') + ' …';
        }
        doc.fontSize(addrSize).text(addr, 10, ADDR_Y, { width: 205, lineGap: 1 });

        const qrX = 160;
        doc.moveTo(qrX, 143).lineTo(qrX, 199).stroke();
        doc.moveTo(FRAME_X, 199).lineTo(RIGHT, 199).stroke();
        doc.font(FONT_BOLD).fontSize(8).text(o.note || 'KHÔNG CHO XEM HÀNG', 10, 148, { width: qrX - 15 });
        const kg = Number(o.kg);
        fitLine(doc, `Hàng hóa: ${o.productName || ''} x ${Number.isFinite(kg) ? kg : o.kg} KG`,
            FONT_REGULAR, 12, 8, 10, 185, qrX - 15, 'left');
        doc.image(qrBuf, qrX + 4, 145, { width: 52, height: 52 });

        fitLine(doc, `TIỀN THU HỘ: ${money(o.cod)} VNĐ`, FONT_BOLD, 13, 8, FRAME_X, 205, FRAME_W);
    }

    return new Promise((resolve, reject) => {
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
    });
}

module.exports = { renderShipLabelPdf, formatSortCode };
