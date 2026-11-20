'use strict';

const db = require('../configs/DBConnection');
const notices = require('../public/js/zalo-system-notice');

async function getPreferredChannel(customerId, pageId) {
    let before;
    while (true) {
        const [rows] = await db.query(`SELECT CAST(id AS CHAR) AS id, channel, message, image, template_json FROM messaging
            WHERE sender = ? AND recipient = ? AND is_echo = 0
              AND (channel IN ('facebook','zalo') OR channel IS NULL)
              ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT 25`,
            before ? [customerId, pageId, before] : [customerId, pageId]);
        for (const row of rows) {
            if (row.channel !== 'zalo') return 'facebook';
            let template;
            try { template = typeof row.template_json === 'string' ? JSON.parse(row.template_json) : row.template_json; } catch (_) { }
            if (template?.template_type === 'zalo_system' || (!template && !row.image && notices.isFriendAdded(row.message))) continue;
            return 'zalo';
        }
        if (rows.length < 25) return 'facebook';
        before = rows.at(-1).id;
    }
}

module.exports = { getPreferredChannel };
