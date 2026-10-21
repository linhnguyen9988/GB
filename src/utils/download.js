const fs = require('fs');
const mime = require('mime-types');
const path = require('path');
const request = require('request');

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

module.exports = { download };
