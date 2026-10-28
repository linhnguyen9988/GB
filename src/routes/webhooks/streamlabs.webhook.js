'use strict';
const DBConnection = require("../../configs/DBConnection");
const SqlString = require('sqlstring');
const socket = require('../../socket');
const { AKA_SQL } = require('../../services/akaService');
const { AVA_DIR } = require('../../configs/constants');
const { LocDau } = require('../../utils/text');
const { download } = require('../../utils/download');

module.exports = function registerStreamlabsWebhook(router) {
    router.post('/streamlabs', async function (req, res) {
        if (req.body.obj && req.body.obj.hasOwnProperty('payload')) {
            const payload = req.body.obj.payload;
            const pageid = req.body.pageid;
            const io = socket.getIo();

            if (!payload || !payload.from || !payload.message) {
                console.log('[streamlabs] bỏ qua event không phải comment:', JSON.stringify(req.body.obj).slice(0, 1500));
                return res.json({ success: false, message: "Không phải comment" });
            }

            const userid = payload.from?.id;
            const fbname = payload.from?.name;
            const message = payload.message;
            const cmtid = payload.id;
            const picture = payload.from?.picture?.data?.url;
            if (picture) download(picture, userid, AVA_DIR).catch(() => { });
            const timelocal = new Date(payload.created_time)
                .toLocaleString("en-US", { timeZone: "Asia/Saigon" });

            if (!userid || !message) {
                return res.status(400).json({ success: false, message: "Thiếu userid/message" });
            }
            const liveid = cmtid.split('_')[0];

            const db = DBConnection.promise();

            const [existing] = await db.query(
                'SELECT 1 FROM livecomment WHERE commentid = ? LIMIT 1', [cmtid]
            );
            if (existing.length > 0) {
                return res.json({ success: true, message: "Duplicate, bỏ qua" });
            }
            const [customerData] = await db.query(
                'SELECT * FROM khachhang WHERE userid = ? LIMIT 1', [userid]
            );

            if (customerData.length > 0) {
                const oldCus = customerData[0];
                const khachhangSql = SqlString.format('INSERT INTO khachhang (userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex,realfbid) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fbname=?, fbnamex=?, realfbid=?, avalink=?;',
                    [userid, fbname, oldCus.phone, oldCus.diachi, oldCus.avalink || picture, oldCus.uname, oldCus.gender, oldCus.label, pageid, LocDau(fbname), oldCus.realfbid,
                        fbname, LocDau(fbname), oldCus.realfbid, picture]);
                await db.query(khachhangSql);
            } else {
                const khachhangSql = SqlString.format('INSERT INTO khachhang (userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex,realfbid) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fbname=?, fbnamex=?, realfbid=?, avalink=?;',
                    [userid, fbname, '', '', picture, '', '', '', pageid, LocDau(fbname), '', fbname, LocDau(fbname), '', picture]);
                await db.query(khachhangSql);
            }

            const realfbidForComment = customerData.length > 0 ? customerData[0].realfbid : '';

            const [insertResult] = await db.query(
                `INSERT IGNORE INTO livecomment 
            (commentid, liveid, userid, name, message, chot, gia, timecomment, datecreate, luotin, count, app, pageid, realfbid, parent_id)
            VALUES (?, ?, ?, ?, ?, '', '', 0, ?, 0, 0, 'Streamlabs', ?, ?, '')`,
                [cmtid, liveid, userid, fbname, message, timelocal, pageid, realfbidForComment]
            );

            const [customerInfoResult] = await db.query(
                'SELECT *, ' + AKA_SQL + ' FROM khachhang WHERE userid = ? LIMIT 1', [userid]
            );
            const customerInfo = customerInfoResult.length > 0 ? customerInfoResult[0] : {};

            io.to(liveid).emit('new-comment', {
                idx: insertResult.insertId,
                picture: picture,
                cmtid: cmtid,
                liveid: liveid,
                pageid: pageid,
                fbname: fbname,
                message: message,
                timelocal: timelocal,
                customerInfo: customerInfo
            });
            res.json({ success: true, message: "Đã nhan", customerInfo: customerInfo });
        } else {
            //console.log('[streamlabs] request không có obj.payload:', JSON.stringify(req.body).slice(0, 1000));
            res.json({ success: false, message: "Không có payload" });
        }
    });
};
