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

module.exports = { emitReactionSummary };
