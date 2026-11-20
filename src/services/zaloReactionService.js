'use strict';

const { createHash } = require('node:crypto');
const db = require('../configs/DBConnection');
const zalo = require('./zaloConnection');
const { emojiToCode } = require('../utils/emoji');
const { emitReactionSummary } = require('./reactionService');

const icons = {
    '/-heart': '❤️', '/-strong': '👍', ':>': '😆', ':o': '😮', ':-((': '😢', ':-h': '😡',
    ':-*': '😘', ":')": '😂', '/-shit': '💩', '/-rose': '🌹', '/-break': '💔', '/-weak': '👎',
    ';xx': '😍', ';-/': '😕', ';-)': '😉', '/-fade': '🥀', '/-li': '☀️', '/-bd': '🎂',
    '/-bome': '💣', '/-ok': '👌', '/-v': '✌️', '/-thanks': '🙏', '/-punch': '👊',
    '/-share': '🤝', '_()_': '🙏', '/-no': '🙅', '/-bad': '👎', '/-loveu': '🤟',
    '--b': '😞', ':((': '😭', 'x-)': '😎', '8-)': '🤓', ';-d': '😁', 'b-)': '😎',
    ':--|': '😐', 'p-(': '😔', ':-bye': '👋', '|-)': '😴', ':wipe': '😓', ':-dig': '🤔',
    '&-(': '😣', ':handclap': '👏', '>-|': '😠', ':-f': '🪑', ':-l': '🪑', ':-r': '🪑',
    ';-x': '🤐', ':-o': '😲', ';-s': '😳', ';-a': '😨', ':-<': '🙁', ':))': '🤣',
    '$-)': '🤑', '/-beer': '🍺'
};

function publish(mid) {
    try { emitReactionSummary(require('../socket').getIo(), mid); } catch (_) { }
}

async function projectReactions(conn, accountId, threadId, mid) {
    const [rows] = await conn.query(
        `SELECT sender_id, emoji_code, event_time FROM gb_zalo_reactions
         WHERE account_id = ? AND thread_id = ? AND resolved_mid = ?
         ORDER BY event_time ASC, event_id ASC`, [accountId, threadId, mid]
    );
    for (const row of rows) {
        if (row.emoji_code) {
            await conn.query(
                `INSERT INTO reactions (messid, sender_id, emoji_code, timestamp) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE emoji_code = VALUES(emoji_code), timestamp = VALUES(timestamp)`,
                [mid, row.sender_id, row.emoji_code, row.event_time]
            );
        } else {
            await conn.query('DELETE FROM reactions WHERE messid = ? AND sender_id = ?', [mid, row.sender_id]);
        }
    }
}

async function linkMessage(conn, accountId, threadId, messageIds, preferredKey) {
    const ids = [...new Set(messageIds.filter(Boolean))].sort();
    let key = preferredKey;
    let isRead = 0;
    for (const id of ids) {
        await conn.query(
            `INSERT INTO gb_zalo_chat_receipt (account_id, thread_id, message_id, send_key) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE send_key = COALESCE(send_key, VALUES(send_key))`,
            [accountId, threadId, id, key]
        );
        const [[receipt]] = await conn.query(
            'SELECT send_key, is_seen FROM gb_zalo_chat_receipt WHERE account_id = ? AND thread_id = ? AND message_id = ? FOR UPDATE',
            [accountId, threadId, id]
        );
        key = receipt.send_key || key;
        isRead = Math.max(isRead, Number(receipt.is_seen) || 0);
        await conn.query(
            'UPDATE gb_zalo_reactions SET resolved_mid = ? WHERE account_id = ? AND thread_id = ? AND message_id = ?',
            ['zalo:' + key, accountId, threadId, id]
        );
    }
    return { key, isRead };
}

async function receiveReaction(session, event) {
    if (!event || event.isGroup || !await zalo.isSavedSessionCurrent(session)) return;
    const threadId = zalo.eventId(event.threadId);
    const actorId = event.isSelf ? session.accountId : zalo.eventId(event.data?.uidFrom);
    const content = event.data?.content;
    if (!threadId || threadId === session.accountId || !actorId || !Array.isArray(content?.rMsg)) return;
    const [customers] = await db.query(
        'SELECT phone, zalo_phone FROM khachhang WHERE zalo_account_id = ? AND zaloid = ?', [session.accountId, threadId]
    );
    if (!customers.some(customer => {
        try { return zalo.normalizePhone(customer.phone) === customer.zalo_phone; } catch (_) { return false; }
    })) return;
    const icon = typeof content.rIcon === 'string' ? content.rIcon : '';
    const removed = content.rIcon === '' || Number(content.rType) === -1;
    const commonTypes = { 0: '😆', 2: '😢', 3: '👍', 5: '❤️', 20: '😡', 32: '😮' };
    const emoji = icons[icon] || (/\p{Extended_Pictographic}/u.test(icon) ? icon : commonTypes[content.rType] || '❓');
    const emojiCode = removed ? null : emojiToCode(emoji);
    const rawTime = Number(String(event.data.ts || ''));
    const timestamp = Number.isSafeInteger(rawTime) && rawTime > 0 ? rawTime : Date.now();
    const rawId = zalo.eventId(event.data.actionId) || zalo.eventId(event.data.msgId);
    const eventId = rawId ? rawId.padStart(64, '0')
        : createHash('sha256').update(JSON.stringify([timestamp, icon, actorId, content.rMsg.map(target => [zalo.eventId(target.gMsgID), zalo.eventId(target.cMsgID)])])).digest('hex');
    const mids = new Set();
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const targets = [...new Set(content.rMsg.map(target => {
            const globalId = zalo.eventId(target.gMsgID);
            const clientId = zalo.eventId(target.cMsgID);
            return globalId && globalId !== '0' ? globalId
                : clientId && clientId.length <= 62 && clientId !== '0' ? 'c:' + clientId : null;
        }).filter(Boolean))].sort();
        for (const id of targets) {
            await conn.query(
                'INSERT IGNORE INTO gb_zalo_chat_receipt (account_id, thread_id, message_id) VALUES (?, ?, ?)',
                [session.accountId, threadId, id]
            );
            const [[receipt]] = await conn.query(
                'SELECT send_key FROM gb_zalo_chat_receipt WHERE account_id = ? AND thread_id = ? AND message_id = ? FOR UPDATE',
                [session.accountId, threadId, id]
            );
            const mid = receipt?.send_key ? 'zalo:' + receipt.send_key : null;
            const newer = '(VALUES(event_time) > event_time OR (VALUES(event_time) = event_time AND VALUES(event_id) > event_id))';
            await conn.query(
                `INSERT INTO gb_zalo_reactions
                 (account_id, thread_id, message_id, sender_id, emoji_code, raw_icon, event_time, event_id, resolved_mid)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE emoji_code = IF(${newer}, VALUES(emoji_code), emoji_code),
                 raw_icon = IF(${newer}, VALUES(raw_icon), raw_icon), event_id = IF(${newer}, VALUES(event_id), event_id),
                 event_time = GREATEST(event_time, VALUES(event_time)), resolved_mid = COALESCE(resolved_mid, VALUES(resolved_mid))`,
                [session.accountId, threadId, id, actorId, emojiCode, icon, timestamp, eventId, mid]
            );
            if (mid) {
                await projectReactions(conn, session.accountId, threadId, mid);
                mids.add(mid);
            }
        }
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
    for (const mid of mids) publish(mid);
}

module.exports = { linkMessage, projectReactions, receiveReaction, publish };
