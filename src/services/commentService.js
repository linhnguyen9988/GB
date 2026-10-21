import DBConnection from "../configs/DBConnection";
const SqlString = require('sqlstring');
const { AKA_SQL } = require('./akaService');
const { REAL_COMMENT_ID_SQL_REGEXP, makeFakeCommentId } = require('./fakeComment');

const getRecentCommentIdsFromDB = (userId) => {
    return new Promise((resolve, reject) => {
        if (!userId) {
            console.warn('userId không được cung cấp, không thể truy vấn database.');
            return resolve([]);
        }
        const sql = `SELECT commentid FROM livecomment WHERE userid = ? AND commentid REGEXP ? ORDER BY idx DESC LIMIT 10`;
        DBConnection.query(sql, [userId, REAL_COMMENT_ID_SQL_REGEXP], (err, rows) => {
            if (err) {
                console.error('Lỗi khi truy vấn database để lấy comment ID:', err);
                return reject(err);
            }

            if (rows && rows.length > 0) {
                resolve(rows.map(row => row.commentid));
            } else {
                console.log(`Không tìm thấy comment nào cho userId: ${userId}`);
                resolve([]);
            }
        });
    });
};

async function tryInsertMessageAsComment(khachhang, sender, text, timemess, pageid, io) {
    try {
        const db = DBConnection.promise();

        const [liveRows] = await db.query(
            `SELECT liveid, status FROM postlive ORDER BY id DESC LIMIT 1`
        );
        if (!liveRows.length || liveRows[0].status !== 'LIVE') return;

        const liveid = liveRows[0].liveid;

        const [cusRows] = await db.query(
            `SELECT *, ${AKA_SQL} FROM khachhang WHERE userid = ? LIMIT 1`, [khachhang]
        );
        const cus = cusRows.length > 0 ? cusRows[0] : null;
        const fbname = cus ? (cus.fbname || 'Khách hàng') : 'Khách hàng';

        const fakeCommentId = makeFakeCommentId(liveid, khachhang);

        const dateCreate = new Date().toLocaleString("en-US", { timeZone: "Asia/Saigon" });

        const sqlInsert = SqlString.format(
            `INSERT IGNORE INTO livecomment 
            (commentid, liveid, userid, name, message, chot, gia, timecomment, datecreate, luotin, count, app, pageid, realfbid, parent_id) 
            VALUES (?, ?, ?, ?, ?, '', '', 0, ?, 0, 0, 'Messenger', ?, ?, '')`,
            [fakeCommentId, liveid, khachhang, fbname, text || '', dateCreate, pageid, cus ? (cus.realfbid || '') : '']
        );

        const [insertResult] = await db.query(sqlInsert);
        const idx = insertResult.insertId;

        const newCommentData = {
            idx: idx,
            picture: cus ? (cus.avalink || '') : '',
            cmtid: fakeCommentId,
            liveid: liveid,
            pageid: pageid,
            fbname: fbname,
            message: text || '',
            timelocal: dateCreate,
            customerInfo: cus || {},
            fromMessenger: true
        };

        io.to(liveid).emit('new-comment', newCommentData);
        console.log(`[Messenger→Live] ${fbname}: "${text}" → live ${liveid}`);

    } catch (err) {
        console.error('[Messenger→Live] Lỗi:', err.message);
    }
}

module.exports = { getRecentCommentIdsFromDB, tryInsertMessageAsComment };
