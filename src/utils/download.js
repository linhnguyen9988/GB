'use strict';
const fs = require('fs');
const mime = require('mime-types');
const path = require('path');
const request = require('request');
const axios = require('axios');
const sharp = require('sharp');
const { randomUUID } = require('node:crypto');

const download = function (uri, filename, destinationPath) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(destinationPath)) {
            fs.mkdirSync(destinationPath, { recursive: true });
        }
        request.head(uri, function (err, res) {
            if (err) {
                return reject(err);
            }
            const contentType = res.headers['content-type'];
            let fileExtension = mime.extension(contentType);
            if (uri.includes('audioclip')) {
                fileExtension = 'mp3';
            }
            let newFilename = filename;
            if (fileExtension) {
                newFilename += `.${fileExtension}`;
            }
            const fullPath = path.join(destinationPath, newFilename);
            request(uri).pipe(fs.createWriteStream(fullPath)).on('close', () => {
                resolve(fileExtension);
            }).on('error', (e) => {
                reject(e);
            });
        });
    });
};

const downloadAvatar = async function (url, userid, destinationPath) {
    const safeId = String(userid || '').replace(/[^A-Za-z0-9_-]/g, '');
    if (!safeId) throw new Error('Thiếu userid để đặt tên file avatar');
    if (!url) throw new Error('Facebook không trả về link avatar');
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 15000,
        maxContentLength: 5 * 1024 * 1024,
        validateStatus: () => true
    });
    const type = String(res.headers['content-type'] || '');
    if (res.status !== 200 || !type.startsWith('image/')) {
        throw new Error(`Tải avatar thất bại: HTTP ${res.status} (${type || 'không có content-type'})`);
    }
    const avatar = await sharp(Buffer.from(res.data), { limitInputPixels: 20_000_000 })
        .rotate().resize(512, 512, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
    await fs.promises.mkdir(destinationPath, { recursive: true });
    const pendingPath = path.join(destinationPath, `.${safeId}.${randomUUID()}.tmp`);
    try {
        await fs.promises.writeFile(pendingPath, avatar, { flag: 'wx' });
        await fs.promises.rename(pendingPath, path.join(destinationPath, `${safeId}.jpg`));
    } catch (error) {
        if (error.code !== 'EEXIST') await fs.promises.unlink(pendingPath).catch(() => {});
        throw error;
    }
};

module.exports = { download, downloadAvatar };
