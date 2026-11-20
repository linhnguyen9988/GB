'use strict';

const db = require('../configs/DBConnection');
const { storeZaloImage } = require('../services/zaloMediaStorage');
const { archiveZaloMessage } = require('../services/zaloIncomingMediaStorage');

async function migrateZaloImages() {
    let migrated = 0;
    while (true) {
        const [rows] = await db.query(
            'SELECT send_key FROM gb_zalo_chat_delivery WHERE image_data IS NOT NULL ORDER BY send_key LIMIT 50'
        );
        if (!rows.length) break;
        for (const { send_key: key } of rows) {
            const [[image]] = await db.query(
                'SELECT image_data, image_url FROM gb_zalo_chat_delivery WHERE send_key = ? AND image_data IS NOT NULL', [key]
            );
            if (!image) continue;
            const storedUrl = image.image_url || await storeZaloImage(image.image_data, key);
            const conn = await db.getConnection();
            try {
                await conn.beginTransaction();
                const [[current]] = await conn.query(
                    'SELECT image_url FROM gb_zalo_chat_delivery WHERE send_key = ? AND image_data IS NOT NULL FOR UPDATE', [key]
                );
                if (current) {
                    const url = current.image_url || storedUrl;
                    await conn.query(
                        'UPDATE gb_zalo_chat_delivery SET image_url = ?, image_data = NULL WHERE send_key = ?', [url, key]
                    );
                    await conn.query(
                        "UPDATE messaging SET image = ? WHERE messid = ? AND channel = 'zalo' AND image = ?",
                        [url, 'zalo:' + key, '/api/messages/zalo-image/' + key]
                    );
                    migrated++;
                }
                await conn.commit();
            } catch (error) {
                await conn.rollback();
                throw error;
            } finally {
                conn.release();
            }
            console.log('[Ảnh Zalo] Đã chuyển:', migrated);
        }
    }
    console.log('[Ảnh Zalo] Hoàn tất. Số ảnh gửi đã chuyển:', migrated);
    await migrateReceivedMedia();
    return migrated;
}

async function migrateReceivedMedia() {
    let afterId = '0';
    let checked = 0;
    let failed = 0;
    while (true) {
        const [rows] = await db.query(
            `SELECT CAST(id AS CHAR) AS id, messid, template_json FROM messaging
             WHERE channel = 'zalo' AND is_echo = 0 AND template_json IS NOT NULL
             AND id > CAST(? AS UNSIGNED) ORDER BY id ASC LIMIT 50`,
            [afterId]
        );
        if (!rows.length) break;
        for (const row of rows) {
            afterId = row.id;
            let template;
            try { template = JSON.parse(row.template_json); } catch (_) { continue; }
            if (template?.template_type !== 'zalo_media' || !Array.isArray(template.attachments)) continue;
            const result = await archiveZaloMessage(db, row.messid, template);
            failed += result.failed;
            checked++;
            console.log('[Tệp Zalo] Tin nhận đã kiểm tra:', checked, 'Tệp còn lỗi:', failed);
        }
    }
    if (failed) throw new Error('Một số tệp chưa tải được. Link gốc vẫn được giữ, có thể chạy lại lệnh chuyển tệp.');
}

if (require.main === module) {
    migrateZaloImages().then(() => process.exit(0), error => {
        console.error('[Ảnh Zalo] Dừng chuyển ảnh:', error.code || error.message);
        process.exit(1);
    });
}

module.exports = { migrateZaloImages, migrateReceivedMedia };
