import DBConnection from "../../configs/DBConnection";
const SqlString = require('sqlstring');
const StringBuilder = require('node-stringbuilder');
const jwtAuth = require('../../middleware/jwtAuth');
const request = require('request');
const socket = require('../../socket');
const { AVA_DIR, GlobalPageID } = require('../../configs/constants');
const { LocDau } = require('../../utils/text');
const { attachAka } = require('../../services/akaService');
const { download } = require('../../utils/download');
const { getBrowser } = require('../../services/browserService');
const { getPageToken } = require('../../services/pageTokenService');
const { isFakeCommentId } = require('../../services/fakeComment');
const { isNumeric } = require('../../utils/common');

module.exports = function registerLiveCommentRoutes(router) {
    var currentlivetime;

    router.post("/scancomment", jwtAuth, function (request, response, next) {
        currentlivetime = 0;
        const sb = new StringBuilder();
        var liveidxx = request.body.liveid;
        var soluong = request.body.soluong;
        const liveidarray = liveidxx.replaceAll(' ', '').split(",");
        var zzz = '';

        (async () => {
            const scanToken = await getPageToken(GlobalPageID);
            for (var j = 0; j < liveidarray.length; j++) {
                zzz = zzz + `liveid='${liveidarray[j]}' OR `;
                var query = `https://graph.facebook.com/${liveidarray[j]}/?fields=title,live_status,from,created_time,description,comments.limit(1000).order(reverse_chronological){from{name,id,picture.height(50).width(50)},created_time,message,live_broadcast_timestamp,application{name}}&version=v13.0&access_token=${scanToken}`;

                let result;
                try {
                    const res = await fetch(query);
                    if (!res.ok) {
                        console.error(`Facebook API HTTP error: ${res.status} ${res.statusText}`);
                        return response.json({ data: JSON.parse('{"error": "Lỗi kết nối Facebook API: ' + res.status + '"}') });
                    }
                    result = await res.json();
                } catch (fetchErr) {
                    console.error('fetch failed:', fetchErr.message);
                    return response.json({ data: JSON.parse('{"error": "Lỗi kết nối Facebook: ' + fetchErr.message + '"}') });
                }

                if (!result.hasOwnProperty('id')) {
                    console.log('Loi Live ID khong ton tai!');
                    return response.json({ data: JSON.parse('{"error": "Lỗi sai LiveId"}') });
                }

                var livecreatedtime = new Date(result.created_time).toLocaleString("en-US", { timeZone: "Asia/Saigon" });
                currentlivetime = result.created_time;
                var sqllive = SqlString.format(
                    'INSERT IGNORE INTO livestream (id,name,time,note,luotincuoi,luotlive,livedesc) VALUES(?,?,?,?,?,?,?);INSERT IGNORE INTO pageinfo (pageid, name) VALUES (?,?);',
                    [result.id, result.title, livecreatedtime, '', '', '', result.description, result.from.id, result.from.name]
                );
                try {
                    DBConnection.query(sqllive);
                } catch (e) {
                    console.log('ERROR: SQL ERROR');
                    return response.json({ data: JSON.parse('{"error": "Lỗi kết nối SQL"}') });
                }

                if (!result.hasOwnProperty('comments')) {
                    console.log('Trying to scan livestream with no comment!');
                    return response.json({ data: JSON.parse('{"error": "Lỗi live chưa có bình luận"}') });
                }

                for (var i = 0; i < result.comments.data.length; i++) {
                    var appname = '';
                    if (result.comments.data[i].hasOwnProperty('application')) {
                        appname = result.comments.data[i].application.name;
                    } else {
                        appname = 'None';
                    }
                    var timelocal = new Date(result.comments.data[i].created_time).toLocaleString("en-US", { timeZone: "Asia/Saigon" });
                    var timeint = result.comments.data[i].live_broadcast_timestamp;

                    if (String(timeint) === 'undefined') {
                        timeint = 0;
                    }
                    var timecmt = new Date(timeint * 1000).toISOString().substring(11, 19);
                    var fromuser = result.comments.data[i].from.name;

                    var sql = SqlString.format(
                        'INSERT IGNORE INTO livecomment (commentid,liveid,userid,name,message,chot,gia,timecomment,datecreate,luotin,count,app,pageid) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE timecomment=?,app=?,count=?;INSERT INTO khachhang (userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fbname=?, fbnamex=?, avalink=?;',
                        [
                            result.comments.data[i].id, result.id, result.comments.data[i].from.id, fromuser,
                            result.comments.data[i].message, '', '', timecmt, timelocal, 0, timeint, appname, result.from.id,
                            timecmt, appname, timeint,
                            result.comments.data[i].from.id, fromuser, '', '', result.comments.data[i].from.picture.data.url,
                            '', '', '', result.from.id, LocDau(fromuser), fromuser, LocDau(fromuser),
                            result.comments.data[i].from.picture.data.url
                        ]
                    );
                    sb.appendLine().append(sql);
                    download(result.comments.data[i].from.picture.data.url, result.comments.data[i].from.id, AVA_DIR);
                }
            }

            try {
                DBConnection.query(sb.toString());
            } catch (e) {
                console.log('ERROR: Insert comment error');
                return;
            }

            DBConnection.query(
                ` SELECT livecomment.idx, livecomment.mess, livecomment.userid, livecomment.timecomment, livecomment.name, livecomment.message, livecomment.datecreate, livecomment.chot, livecomment.gia, livecomment.commentid, livecomment.luotin, livecomment.count, livecomment.app, livecomment.liveid, livecomment.pageid, livecomment.updateava, livecomment.realfbid, khachhang.id, khachhang.phone, khachhang.diachi, khachhang.avalink, khachhang.label, khachhang.note, khachhang.fbnamex, khachhang.aka, khachhang.nuocngoai, khachhang.realfbid, khachhang.threadid FROM livecomment INNER JOIN khachhang ON (livecomment.userid=khachhang.userid) AND (${zzz.substring(0, zzz.length - 4)}) ORDER BY idx DESC LIMIT ${soluong}`,
                function (error, data) {
                    if (error) {
                        console.error(error);
                        return response.json({ data: [] });
                    }
                    attachAka(data, function (rows) { response.json({ data: rows }); });
                }
            );
        })();
    });

    router.post("/deleteallpost", jwtAuth, function (req, response, next) {
        var z, y = 0;
        (async () => {
            const delToken = await getPageToken(GlobalPageID);
            var query = `https://graph.facebook.com/v23.0/223266991771270/feed?limit=100&access_token=${delToken}`;
            const res = await fetch(query);
            if (res.ok) {
                const result = await res.json();
                z = result.data.length;
                for (var j = 0; j < result.data.length; j++) {
                    var t = 0;
                    y = j;
                    var queryx = `https://graph.facebook.com/v23.0/${result.data[j].id}?access_token=${delToken}`;
                    request({
                        url: encodeURI(queryx),
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'access_token': delToken
                        }
                    });
                }
            }
        })();

        response.json({
            data: 'x'
        });
    });

    router.post("/action", jwtAuth, function (request, response, next) {
        var liveid = request.body.liveid;
        DBConnection.query(' SELECT livecomment.idx, livecomment.mess, livecomment.userid, livecomment.timecomment, livecomment.name, livecomment.message, livecomment.datecreate, livecomment.chot, livecomment.gia, livecomment.commentid, livecomment.luotin, livecomment.count, livecomment.app, livecomment.liveid, livecomment.pageid, livecomment.updateava, livecomment.realfbid, livecomment.slchot, khachhang.id, khachhang.phone, khachhang.diachi, khachhang.avalink, khachhang.label, khachhang.note, khachhang.fbnamex, khachhang.aka, khachhang.nuocngoai, khachhang.realfbid, khachhang.threadid FROM livecomment INNER JOIN khachhang ON livecomment.userid=khachhang.userid AND liveid= ? ', liveid,
            function (error, data) {
                if (error) {
                    response.json({
                        data: JSON.parse('{"error": "SQL ERROR"}')
                    });
                    throw error;
                } else {
                    attachAka(data, function (rows) {
                        response.json({
                            data: rows
                        });
                    });
                }
            });
    });

    router.post('/detailcomment', jwtAuth, function (req, res) {
        var cmtid = req.body.commentid;
        var userid = req.body.userid;
        if (isFakeCommentId(cmtid)) {
            return res.json({ data: { skipped: true, message: 'Comment ảo, bỏ qua.' } });
        }
        DBConnection.query(" SELECT token FROM usertoken WHERE id=1",
            async function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    let token = data[0].token;
                    let bodyx;
                    let page;
                    try {
                        const browser = await getBrowser();
                        page = await browser.newPage();
                        await page.goto(`https://graph.facebook.com/v16.0/${cmtid}?fields=from,id,created_time,live_broadcast_timestamp,message,application&access_token=${token}`);
                        const body = await page.$eval('*', (el) => el.innerText);
                        bodyx = JSON.parse(body);
                    } catch (e) {
                        console.error('[detailcomment] Lỗi đọc Graph API:', e.message);
                        return res.json({ error: 'Lỗi Token' });
                    } finally {
                        if (page) await page.close().catch(() => { });
                    }
                    if (error) {
                        res.json({
                            error: 'Lỗi Token'
                        });
                    } else {
                        if (bodyx.hasOwnProperty('from')) {
                            var timecmt = 0;
                            if (bodyx.hasOwnProperty('live_broadcast_timestamp')) {
                                timecmt = new Date(bodyx.live_broadcast_timestamp * 1000).toISOString().substring(11, 19);
                            }
                            res.json({
                                data: bodyx
                            });
                            const realfbid_moi = bodyx.from.id;
                            const userid_hientai = userid;

                            const sql_select = SqlString.format('SELECT phone, diachi, note, nuocngoai FROM khachhang WHERE realfbid = ? AND userid != ? LIMIT 1', [realfbid_moi, userid_hientai]);

                            DBConnection.query(sql_select, (error, results) => {
                                if (error) {
                                    console.error('Lỗi khi SELECT khách hàng cũ:', error);
                                    return;
                                }
                                let sql_update_khachhang = '';
                                if (results && results.length > 0) {
                                    const old_customer = results[0];

                                    sql_update_khachhang = SqlString.format(
                                        'UPDATE khachhang SET realfbid=?, phone=?, diachi=?, note=?, nuocngoai=? WHERE userid=?',
                                        [realfbid_moi, old_customer.phone, old_customer.diachi, old_customer.note, old_customer.nuocngoai, userid_hientai]
                                    );
                                } else {
                                    sql_update_khachhang = SqlString.format(
                                        'UPDATE khachhang SET realfbid=? WHERE userid=?',
                                        [realfbid_moi, userid_hientai]
                                    );
                                }

                                let sql_update_livecmt = SqlString.format(
                                    'UPDATE livecomment SET realfbid=?, count=?, timecomment=?, app=? WHERE commentid=?',
                                    [realfbid_moi, bodyx.live_broadcast_timestamp, timecmt, bodyx.application.name, cmtid]
                                );

                                let sql_final = sql_update_livecmt + '; ' + sql_update_khachhang;
                                DBConnection.query(sql_final);
                            });

                        } else {
                            res.json({
                                data: bodyx
                            });
                        }
                    }
                }
            });
    });

    router.post('/replycomment', jwtAuth, function (req, res) {
        var cmtid = req.body.commentid;
        var pageid = req.body.pageid;
        var userid = req.body.userid;
        var chat = req.body.chat.replace(/(?:\r\n|\r|\n)/g, '\\n');
        var type = '';
        var baseon = '';
        var id = '';
        if (isFakeCommentId(cmtid)) {
            return res.json({ data: { skipped: true, message: 'Comment ảo, bỏ qua.' } });
        }
        if (cmtid === '' || chat.includes('..')) {
            type = 'UPDATE';
            baseon = 'id';
            id = userid;
        } else {
            type = 'RESPONSE';
            baseon = 'comment_id';
            id = cmtid;
        }
        DBConnection.query(" SELECT accesstoken from pageinfo WHERE pageid='" + pageid + "'",
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    let token = data[0].accesstoken;
                    var query = `https://graph.facebook.com/v10.0/me/messages?access_token=${token}&recipient={"${baseon}":"${id}"}&messaging_type=${type}&message={"text":"${chat}"}`;
                    request({
                        url: encodeURI(query),
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }, function (error, response, bodyx) {
                        var body = JSON.parse(bodyx.replaceAll(" ", "").replaceAll(/\n/g, " "));
                        if (error) {
                            console.log(error + ": " + id);
                        } else {
                            res.json({
                                data: body
                            });
                            if (response.statusCode == 200) {
                                var psid = body.recipient_id;
                                DBConnection.query(" UPDATE khachhang SET psid='" + psid + "' WHERE userid='" + userid + "'");
                            } else {
                                console.log(body.error.message);
                            }
                        }
                    });
                }
            });
    });

    router.post('/getthread', jwtAuth, function (req, res) {
        var pageid = req.body.pageid;
        var threadid = req.body.threadid;
        var userid = req.body.userid;
        if (threadid != '0' && userid != '') {
            DBConnection.query(`UPDATE khachhang SET threadid='${threadid}' WHERE userid='${userid}';`);
        }
        DBConnection.query(" SELECT accesstoken FROM pageinfo WHERE pageid='" + pageid + "'",
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    let token = data[0].accesstoken;
                    var query = `https://graph.facebook.com/${threadid}?fields=messages.limit(10){from,attachments,message,created_time,sticker},updated_time&access_token=${token}`;
                    request({
                        url: encodeURI(query),
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }, function (error, response, bodyx) {
                        var body = JSON.parse(bodyx);
                        if (error) {
                            console.log(error);
                        } else {
                            res.json({
                                data: body
                            });
                        }
                    });
                }
            });
    });

    router.post('/getlivestatus', jwtAuth, function (req, res) {
        var liveid = req.body.liveid;
        DBConnection.query('SELECT status, liveviews FROM postlive WHERE liveid = ? ORDER BY id DESC LIMIT 1', [liveid], function (error, data) {
            if (error) {
                return res.json({ status: null, liveviews: 0 });
            }
            if (data && data.length > 0) {
                res.json({ status: data[0].status, liveviews: data[0].liveviews });
            } else {
                res.json({ status: null, liveviews: 0 });
            }
        });
    });

    router.post('/deletelive', jwtAuth, function (request, response, next) {
        var liveid = request.body.liveid;
        var sql = SqlString.format(`DELETE FROM livestream WHERE id='${liveid}'; DELETE FROM livecomment WHERE liveid='${liveid}'`);
        DBConnection.query(sql,
            function (error, data) {
            });
    });

    router.post('/getcommentchot', jwtAuth, function (request, response, next) {
        var sllive = request.body.sllive;
        var userid = request.body.userid;
        var sb = '';
        var sql = SqlString.format("SELECT * FROM livestream order by idx desc limit ?;", [parseInt(sllive)]);
        DBConnection.query(sql, function (error, data) {
            if (data.length > 0) {
                for (var i = 0; i < data.length; i++) {
                    sb += `liveid='${data[i].id}' OR `;
                }
            }
            sb = sb.substring(0, sb.length - 4);
            DBConnection.query(SqlString.format(`SELECT * FROM livecomment WHERE (${sb}) AND userid=?;`, [userid]), function (error, data) {
                response.json({
                    data: data
                });
            });
        });
    });

    router.post('/updatechot', function (request, response, next) {
        const io = socket.getIo();
        var cid = request.body.commentid;
        var gia = request.body.gia;
        var chot = request.body.chot;
        var liveid = request.body.liveid;
        var slchot = request.body.slchot;
        var socketid = request.body.socketid;
        if (!isNumeric(slchot) || slchot == '' || slchot == 0) {
            slchot = 1;
        }
        DBConnection.query('SELECT luotin FROM livecomment WHERE commentid = ? LIMIT 1', [cid], function (err0, existingRows) {
            if (err0) {
                console.error('updatechot select error:', err0);
                return response.status(500).json({ error: 'Lỗi cơ sở dữ liệu' });
            }
            var existingLuotin = (existingRows && existingRows[0]) ? parseInt(existingRows[0].luotin) : 0;
            if (existingLuotin && existingLuotin > 0) {
                var luotcuoi = existingLuotin;
                DBConnection.query(SqlString.format('UPDATE livecomment SET chot=?, gia=?, slchot=? WHERE commentid=?', [chot, gia, slchot, cid]), function (err1) {
                    if (err1) {
                        console.error('updatechot update error:', err1);
                        return response.status(500).json({ error: 'Lỗi cơ sở dữ liệu' });
                    }
                    const newChotData = {
                        cid: cid,
                        gia: gia,
                        chot: chot,//nay la chu~ CHOT
                        liveid: liveid,
                        luotcuoilive: luotcuoi,
                        slchot: slchot
                    };
                    io.to(liveid).emit('new-chot', newChotData);
                    if (socketid) {
                        io.to(socketid).emit('new-chot', newChotData);
                    }
                    response.json({ data: cid, luotcuoi: luotcuoi });
                });
            } else {
                DBConnection.query(
                    'UPDATE livestream SET luotincuoi = @newluot := luotincuoi + 1 WHERE id = ?; ' +
                    'UPDATE livecomment SET chot = ?, gia = ?, luotin = @newluot, slchot = ? WHERE commentid = ?; ' +
                    'SELECT @newluot AS luotcuoi;',
                    [liveid, chot, gia, slchot, cid],
                    function (err2, results) {
                        if (err2) {
                            console.error('updatechot increment error:', err2);
                            return response.status(500).json({ error: 'Lỗi cơ sở dữ liệu' });
                        }
                        var luotcuoi = results && results[2] && results[2][0] ? results[2][0].luotcuoi : null;
                        const newChotData = {
                            cid: cid,
                            gia: gia,
                            chot: chot,//nay la chu~ CHOT
                            liveid: liveid,
                            luotcuoilive: luotcuoi,
                            slchot: slchot
                        };
                        io.to(liveid).emit('new-chot', newChotData);
                        if (socketid) {
                            io.to(socketid).emit('new-chot', newChotData);
                        }
                        response.json({ data: cid, luotcuoi: luotcuoi });
                    }
                );
            }
        });
    });

    router.post('/updatexa', function (request, response, next) {
        const io = socket.getIo();
        var chot = request.body.chot;
        var cid = request.body.commentid;
        var liveid = request.body.liveid;
        var socketid = request.body.socketid;
        DBConnection.query(SqlString.format('UPDATE livecomment SET chot=?, gia=?, slchot=1 WHERE commentid=?', [chot, '', cid]));
        const newXaData = {
            cid: cid,
            chot: chot,
        };
        io.to(liveid).emit('new-xa', newXaData);
        if (socketid) {
            io.to(socketid).emit('new-xa', newXaData);
        }
        response.json({
            data: cid
        });
    });

    router.post('/updatelivenote', jwtAuth, function (request, response, next) {
        var note = request.body.note;
        var liveid = request.body.liveid;
        var zzz = '';
        const liveidarray = liveid.replaceAll(' ', '').split(",");
        for (var j = 0; j < liveidarray.length; j++) {
            zzz = zzz + `id='${liveidarray[j]}' OR `;
        }
        DBConnection.query(SqlString.format(" UPDATE livestream SET note=? WHERE " + zzz.substring(0, zzz.length - 4), note));
        response.json({
            data: JSON.parse('{"success": "Ghi chú sẽ được lưu"}')
        });
        console.log('Updated note: ' + liveid);
    });
};
