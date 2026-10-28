const fs = require('fs');
const mime = require('mime-types');
const path = require('path');
const request = require('request');
const axios = require('axios');

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
    if (!fs.existsSync(destinationPath)) {
        fs.mkdirSync(destinationPath, { recursive: true });
    }
    fs.writeFileSync(path.join(destinationPath, `${safeId}.jpg`), res.data);
};

module.exports = { download, downloadAvatar };
