'use strict';
const PDFDocument = require('pdfkit');
const axios = require('axios');
const bwipjs = require('bwip-js');
const path = require('path');
const sharp = require('sharp');

async function createGiaBaoLabel(data) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({
                size: [226, 320],
                margins: { top: 5, bottom: 5, left: 0, right: 0 }
            });
            // 2 dong nay dung cho may to, may nho ko can
            //doc.translate(-8, 0);
            //doc.scale(0.90);
            doc.fillColor('black');
            doc.strokeColor('black');

            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            const fontBold = path.join(__dirname, '..', 'public', 'fonts', 'Tahoma-Bold.ttf');
            const fontRegular = path.join(__dirname, '..', 'public', 'fonts', 'Tahoma.ttf');

            const cleanName = (data.name || "").trim();
            const cleanComment = (data.comment || "").trim();
            const cleanPrice = String(data.gia || "0");
            const luotCuoi = data.luotcuoi || "";
            const note = (data.note || "").trim();
            const address = (data.address || "").trim();
            const isForeign = (data.region || "").includes("Nước ngoài");

            doc.font(fontBold).fontSize(11);
            doc.roundedRect(10, 5, 206, 25, 4).stroke();
            doc.text(`Áo Dài Gia Bảo • ${data.date || ""} • ${luotCuoi}`, 10, 13, { align: 'center', width: 206 });

            let commonY = 32;
            let avatarSize = 35;
            let nameX = 52;

            if (data.avabase64 && data.avabase64.length > 10) {
                try {
                    let rawBuffer;
                    if (data.avabase64.startsWith('http')) {
                        const response = await axios({ method: 'get', url: data.avabase64, responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
                        rawBuffer = Buffer.from(response.data);
                    } else {
                        const base64Data = data.avabase64.split(';base64,').pop();
                        rawBuffer = Buffer.from(base64Data, 'base64');
                    }
                    const processedImg = await sharp(rawBuffer).resize(100, 100).grayscale().modulate({ contrast: 1.5 }).png().toBuffer();
                    doc.image(processedImg, 15, commonY, { width: avatarSize, height: avatarSize });
                } catch (e) {
                    doc.lineWidth(0.5).rect(15, commonY, avatarSize, avatarSize).stroke();
                }
            }

            doc.font(fontBold).fontSize(16).text(cleanName, nameX, commonY, { width: 158, lineGap: -2 });

            const nameWidth = doc.widthOfString(cleanName);
            const iconStartX = nameX + Math.min(nameWidth, 145) + 4;
            let currentIconX = iconStartX;

            if (isForeign) {
                doc.save();
                doc.translate(currentIconX, commonY + 3);
                doc.lineWidth(0.8);
                doc.circle(5, 5, 5).stroke();
                doc.moveTo(0, 5).lineTo(10, 5).stroke();
                doc.moveTo(5, 0).quadraticCurveTo(8, 5, 5, 10).stroke();
                doc.moveTo(5, 0).quadraticCurveTo(2, 5, 5, 10).stroke();
                doc.restore();
                currentIconX += 14;
            }

            if (address) {
                doc.save();
                doc.translate(currentIconX, commonY + 3);
                doc.moveTo(5, 12)
                    .bezierCurveTo(-1, 6, 1, 0, 5, 0)
                    .bezierCurveTo(9, 0, 11, 6, 5, 12)
                    .fill();
                doc.fillColor('white').circle(5, 4, 1.5).fill();
                doc.restore();
            }

            const nameHeight = doc.heightOfString(cleanName, { width: 158, lineGap: -2 });
            let currentY = Math.max(commonY + avatarSize, commonY + nameHeight) + 5;

            doc.fillColor('black').font(fontRegular).fontSize(12);

            if (data.phone) {
                doc.save();
                doc.translate(15, currentY - 1);
                doc.roundedRect(0, 0, 9, 13, 2).fill();
                doc.fillColor('white').circle(4.5, 11, 1).fill();
                doc.restore();
                doc.fillColor('black').font(fontBold).text(`${data.phone}`, 32, currentY);
                currentY += 15 + 3;
            }

            if (cleanComment) {
                doc.save();
                doc.translate(15, currentY + 1);
                doc.moveTo(0, 0).lineTo(13, 0).lineTo(13, 9).lineTo(7, 9).lineTo(3, 13).lineTo(3, 9).lineTo(0, 9).closePath().fill();
                doc.restore();
                doc.font(fontRegular).text(`${cleanComment}`, 32, currentY, { width: 178, lineGap: -1 });
                const h = doc.heightOfString(`${cleanComment}`, { width: 178, lineGap: -1 });
                currentY += h + 3;
            }

            if (cleanPrice && cleanPrice !== "0") {
                doc.save();
                doc.translate(15, currentY + 1);
                doc.rect(0, 0, 14, 9).fill();
                doc.fillColor('white').circle(7, 4.5, 2.5).fill();
                doc.restore();
                doc.fillColor('black').font(fontBold).text(`${cleanPrice}.000 đ`, 32, currentY);
                currentY += 15 + 3;
            }

            currentY += 5;
            if (data.id) {
                try {
                    const bc = await bwipjs.toBuffer({ bcid: 'code128', text: String(data.id), scale: 1, height: 4, includetext: false });
                    doc.image(bc, 63, currentY, { width: 100 });
                    currentY += 22;
                } catch (e) { }
            }

            if (note) {
                doc.font(fontRegular).fontSize(9).text(note, 10, currentY, { align: 'center', width: 206 });
            }

            doc.end();
        } catch (err) { reject(err); }
    });
}

module.exports = { createGiaBaoLabel };
