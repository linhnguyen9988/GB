'use strict';
const DBConnection = require("../configs/DBConnection");
const { codeToEmoji } = require('../utils/emoji');

function emitReactionSummary(io, mid, extra) {
    DBConnection.query(
        'SELECT emoji_code, COUNT(*) AS count FROM reactions WHERE messid = ? GROUP BY emoji_code',
        [mid],
        (err, rows) => {
            if (err) { console.error('Lỗi lấy tổng hợp reaction:', err); return; }
            const list = rows.map(r => ({ emoji: codeToEmoji(r.emoji_code), count: Number(r.count) }));
            io.emit('reaction', Object.assign({ mid: mid, reactions: list }, extra));
        }
    );
}

async function reactionSummaries(mids) {
    const ids = [...new Set(mids)];
    if (!ids.length) return [];
    const [rows] = await DBConnection.query(
        'SELECT messid, emoji_code, COUNT(*) AS count FROM reactions WHERE messid IN (?) GROUP BY messid, emoji_code', [ids]
    );
    const groups = new Map(ids.map(mid => [mid, []]));
    for (const row of rows) {
        groups.get(row.messid)?.push({ emoji: codeToEmoji(row.emoji_code), count: Number(row.count) });
    }
    return [...groups].map(([mid, reactions]) => ({ mid, reactions }));
}

async function attachReactionSummaries(messages) {
    const summaries = new Map((await reactionSummaries(messages.map(message => message.messid).filter(Boolean)))
        .map(item => [item.mid, item.reactions]));
    for (const message of messages) message.reactions = summaries.get(message.messid) || [];
}

async function zaloReactionUpdates(customerId, requested) {
    if (typeof requested !== 'string') return [];
    const mids = [...new Set(requested.split(',').filter(mid => /^zalo:[a-f0-9]{64}$/.test(mid)))].slice(0, 40);
    if (!mids.length) return [];
    const [messages] = await DBConnection.query(
        `SELECT messid FROM messaging WHERE channel = 'zalo' AND messid IN (?) AND (sender = ? OR recipient = ?)`,
        [mids, customerId, customerId]
    );
    return reactionSummaries(messages.map(message => message.messid));
}

module.exports = { emitReactionSummary, attachReactionSummaries, zaloReactionUpdates };
