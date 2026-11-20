'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { v2: cloudinary } = require('cloudinary');
const { getNextCloudinaryAccount } = require('./cloudinaryService');
const { MESSPIC_DIR } = require('../configs/constants');

async function storeZaloImage(buffer, key) {
    if (!Buffer.isBuffer(buffer) || !buffer.length || !/^[a-f0-9]{64}$/.test(key)) {
        throw new Error('Dữ liệu ảnh Zalo không hợp lệ.');
    }
    try {
        const account = getNextCloudinaryAccount();
        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({
                ...account, resource_type: 'image', folder: 'zalo_images', public_id: key,
                overwrite: false, timeout: 20000
            }, (error, uploaded) => error ? reject(error) : resolve(uploaded));
            stream.on('error', reject);
            stream.end(buffer);
        });
        if (typeof result?.secure_url !== 'string' || !result.secure_url.startsWith('https://')) {
            throw new Error('Cloudinary không trả về đường dẫn ảnh.');
        }
        return result.secure_url;
    } catch (error) {
        console.warn('[Ảnh Zalo] Upload Cloudinary lỗi, lưu ảnh vào messpic:', error.code || error.name);
    }

    await fs.mkdir(MESSPIC_DIR, { recursive: true });
    const temporary = path.join(MESSPIC_DIR, `.${key}.${randomUUID()}.tmp`);
    try {
        await fs.writeFile(temporary, buffer, { flag: 'wx' });
        await fs.rename(temporary, path.join(MESSPIC_DIR, key + '.jpg'));
    } catch (error) {
        await fs.unlink(temporary).catch(() => {});
        throw error;
    }
    return '/images/messpic/' + key + '.jpg';
}

module.exports = { storeZaloImage };
