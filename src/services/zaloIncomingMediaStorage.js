'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const dns = require('node:dns');
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const { createHash, randomUUID } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const axios = require('axios');
const mime = require('mime-types');
const { v2: cloudinary } = require('cloudinary');
const { getNextCloudinaryAccount } = require('./cloudinaryService');
const { MESSPIC_DIR } = require('../configs/constants');

const extensions = {
    image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic', 'bmp'],
    audio: ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'wav', 'amr', 'flac'],
    video: ['mp4', 'webm', 'mov', 'mkv', 'avi', '3gp', '3gpp', 'm4v']
};

function publicAddress(address) {
    if (net.isIP(address) === 4) {
        const [a, b] = address.split('.').map(Number);
        return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
            (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
            (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
            (a === 198 && (b === 18 || b === 19)));
    }
    return net.isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:db8:/i.test(address);
}

function publicLookup(hostname, options, callback) {
    dns.lookup(hostname, { all: true }, (error, addresses) => {
        if (error) return callback(error);
        const allowed = addresses.filter(item => publicAddress(item.address));
        if (!allowed.length) return callback(new Error('Đường dẫn tệp Zalo không dùng địa chỉ mạng công cộng.'));
        if (options?.all) return callback(null, allowed);
        return callback(null, allowed[0].address, allowed[0].family);
    });
}

async function downloadMedia(source, kind, temporary) {
    const httpAgent = new http.Agent({ lookup: publicLookup });
    const httpsAgent = new https.Agent({ lookup: publicLookup });
    try {
        let url = new URL(source);
        for (let redirects = 0; redirects <= 4; redirects++) {
            const hostname = url.hostname.replace(/^\[|\]$/g, '');
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
                (net.isIP(hostname) && !publicAddress(hostname))) {
                throw new Error('Đường dẫn tệp Zalo không hợp lệ.');
            }
            const response = await axios.get(url.href, {
                responseType: 'stream', maxRedirects: 0, proxy: false,
                httpAgent, httpsAgent, timeout: 30000, signal: AbortSignal.timeout(120000),
                validateStatus: () => true
            });
            if ([301, 302, 303, 307, 308].includes(response.status)) {
                response.data.destroy();
                if (!response.headers.location) throw new Error('Chuyển hướng tệp Zalo thiếu địa chỉ.');
                url = new URL(response.headers.location, url);
                continue;
            }
            const type = String(response.headers['content-type'] || '').split(';')[0].toLowerCase();
            const generic = !type || type === 'application/octet-stream' || (kind === 'audio' && type === 'application/ogg');
            if (response.status !== 200 || (!type.startsWith(kind + '/') && !generic)) {
                response.data.destroy();
                throw new Error('Không tải được đúng loại tệp Zalo.');
            }
            const allowed = extensions[kind];
            const inferred = mime.extension(type) || path.extname(url.pathname).slice(1).toLowerCase();
            const extension = allowed.includes(inferred) ? inferred : allowed[0];
            await pipeline(response.data, fs.createWriteStream(temporary, { flags: 'wx' }));
            const { size } = await fsp.stat(temporary);
            if (!size) throw new Error('Tệp Zalo tải về không có dữ liệu.');
            return extension;
        }
        throw new Error('Tệp Zalo chuyển hướng quá nhiều lần.');
    } finally {
        httpAgent.destroy();
        httpsAgent.destroy();
    }
}

async function storeAttachment(attachment, key) {
    await fsp.mkdir(MESSPIC_DIR, { recursive: true });
    const temporary = path.join(MESSPIC_DIR, `.${key}.${randomUUID()}.tmp`);
    try {
        const extension = await downloadMedia(attachment.url, attachment.kind, temporary);
        if (attachment.kind === 'image') {
            try {
                const result = await cloudinary.uploader.upload(temporary, {
                    ...getNextCloudinaryAccount(), resource_type: 'image', folder: 'zalo_images',
                    public_id: key, overwrite: false, timeout: 20000
                });
                if (!/^https:\/\//.test(result?.secure_url || '')) throw new Error('Cloudinary thiếu đường dẫn ảnh.');
                return result.secure_url;
            } catch (error) {
                console.warn('[Tệp Zalo] Upload ảnh lỗi, giữ bản ảnh trong messpic:', error.code || error.name);
            }
        }
        const filename = key + '.' + extension;
        await fsp.rename(temporary, path.join(MESSPIC_DIR, filename));
        return '/images/messpic/' + filename;
    } finally {
        await fsp.unlink(temporary).catch(() => {});
    }
}

async function archiveZaloAttachments(template, key, previousTemplate) {
    const previous = Array.isArray(previousTemplate?.attachments) ? previousTemplate.attachments : [];
    const attachments = [];
    let failed = 0;
    for (const [index, attachment] of template.attachments.entries()) {
        const stored = previous.find(item => item.stored === true && item.source_url === attachment.url);
        if (stored) {
            attachments.push(stored);
            continue;
        }
        if (attachment.stored === true || !extensions[attachment.kind]) {
            attachments.push(attachment);
            continue;
        }
        try {
            const mediaKey = createHash('sha256').update(key + ':' + index).digest('hex');
            const url = await storeAttachment(attachment, mediaKey);
            attachments.push({ ...attachment, url, source_url: attachment.url, stored: true });
        } catch (error) {
            failed++;
            attachments.push(attachment);
            console.warn('[Tệp Zalo] Chưa lưu được tệp, giữ link gốc:', error.code || error.name);
        }
    }
    return {
        image: attachments.map(item => item.url).join(';'),
        template: { ...template, attachments },
        failed
    };
}

async function archiveZaloMessage(db, mid, template) {
    const [[saved]] = await db.query(
        "SELECT template_json FROM messaging WHERE messid = ? AND channel = 'zalo' AND (is_echo = 0 OR sent_by_user_id IS NULL) LIMIT 1", [mid]
    );
    if (!saved) return { failed: 0 };
    let previous;
    try { previous = JSON.parse(saved.template_json); } catch (_) { }
    const archived = await archiveZaloAttachments(template, mid, previous);
    const metadata = JSON.stringify(archived.template);
    if (metadata !== saved.template_json) {
        await db.query(
            "UPDATE messaging SET image = ?, template_json = ? WHERE messid = ? AND channel = 'zalo' AND (is_echo = 0 OR sent_by_user_id IS NULL)",
            [archived.image, metadata, mid]
        );
    }
    return archived;
}

module.exports = { archiveZaloAttachments, archiveZaloMessage };
