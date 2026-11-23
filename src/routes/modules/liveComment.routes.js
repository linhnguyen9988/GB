'use strict';
const DBConnection = require("../../configs/DBConnection");
const SqlString = require('sqlstring');
const StringBuilder = require('node-stringbuilder');
const jwtAuth = require('../../middleware/jwtAuth');
const request = require('request');
const { facebookRequestJson } = require('../../services/facebookRequestJson');
const socket = require('../../socket');
const { AVA_DIR, GlobalPageID } = require('../../configs/constants');
const { LocDau } = require('../../utils/text');
const { attachAka } = require('../../services/akaService');
const { downloadAvatar } = require('../../utils/download');
const { fetchFbProfile } = require('../../services/facebookService');
const { getBrowser } = require('../../services/browserService');
const { getPageToken } = require('../../services/pageTokenService');
const { isFakeCommentId } = require('../../services/fakeComment');
const { isNumeric } = require('../../utils/common');
const { ensureChot2, hasChot2, selectCols, parseSecondPrice } = require('../../services/chotService');

module.exports = function registerLiveCommentRoutes(router) {
    var currentlivetime;
    ensureChot2().catch(function () { });

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
                    downloadAvatar(result.comments.data[i].from.picture.data.url, result.comments.data[i].from.id, AVA_DIR).catch(() => {});
                }
            }

            try {
                DBConnection.query(sb.toString());
            } catch (e) {
                console.log('ERROR: Insert comment error');
                return;
            }

            DBConnection.query(
                ` SELECT livecomment.idx, livecomment.mess, livecomment.userid, livecomment.timecomment, livecomment.name, livecomment.message, livecomment.datecreate, livecomment.chot, livecomment.gia, livecomment.slchot,${selectCols('livecomment.')} livecomment.commentid, livecomment.luotin, livecomment.count, livecomment.app, livecomment.liveid, livecomment.pageid, livecomment.updateava, livecomment.realfbid, khachhang.id, khachhang.phone, khachhang.diachi, khachhang.avalink, khachhang.label, khachhang.note, khachhang.fbnamex, khachhang.aka, khachhang.nuocngoai, khachhang.realfbid, khachhang.threadid FROM livecomment INNER JOIN khachhang ON (livecomment.userid=khachhang.userid) AND (${zzz.substring(0, zzz.length - 4)}) ORDER BY idx DESC LIMIT ${soluong}`,
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

    router.get('/api/live-comments/catch-up', jwtAuth, async (req, res) => {
        const { liveId, after } = req.query;
        if (typeof liveId !== 'string' || !/^[0-9_]{1,100}$/.test(liveId) ||
            typeof after !== 'string' || !/^\d{1,20}$/.test(after)) {
            return res.status(400).json({ error: 'Mã live hoặc mốc bình luận không hợp lệ.' });
        }

        try {
            const [rows] = await DBConnection.query(
                `SELECT CAST(l.idx AS CHAR) AS idx, l.commentid AS cmtid, l.name AS fbname, l.message,
                        l.datecreate AS timelocal, l.liveid, l.pageid, l.userid, l.chot, l.gia, l.slchot,
                        l.luotin, l.count, l.timecomment,
                        ${hasChot2() ? 'l.gia2, l.slchot2,' : ''}
                        k.id AS khid, k.fbname AS customer_name, k.phone, k.diachi, k.label,
                        k.note, k.aka, k.nuocngoai, k.realfbid, k.threadid, k.fbnamex
                 FROM livecomment l
                 LEFT JOIN khachhang k ON k.id = COALESCE(
                     (SELECT MAX(c.id) FROM khachhang c WHERE c.userid = l.userid AND c.pageid = l.pageid),
                     (SELECT MAX(c.id) FROM khachhang c WHERE c.userid = l.userid)
                 )
                 WHERE l.liveid = ? AND l.idx > CAST(? AS UNSIGNED) ORDER BY l.idx ASC LIMIT 101`,
                [liveId, after]
            );
            const comments = rows.slice(0, 100).map(row => ({
                idx: row.idx, cmtid: row.cmtid, liveid: row.liveid, pageid: row.pageid, fbname: row.fbname,
                message: row.message, timelocal: row.timelocal, chot: row.chot, gia: row.gia, slchot: row.slchot,
                gia2: row.gia2, slchot2: row.slchot2, luotin: row.luotin, count: row.count, timecomment: row.timecomment,
                customerInfo: {
                    id: row.khid, userid: row.userid, pageid: row.pageid, fbname: row.customer_name || row.fbname || '',
                    phone: row.phone || '', diachi: row.diachi || '', label: row.label || '', note: row.note || '',
                    aka: row.aka || '', nuocngoai: row.nuocngoai || '', realfbid: row.realfbid || '',
                    threadid: row.threadid || '', fbnamex: row.fbnamex || ''
                }
            }));
            return res.json({ comments, hasMore: rows.length > comments.length });
        } catch (error) {
            console.error('[live] Không tải bù được bình luận:', error.code || error.name);
            return res.status(500).json({ error: 'Không tải bù được bình luận.' });
        }
    });

    router.post("/action", jwtAuth, function (request, response, next) {
        var liveid = request.body.liveid;
        DBConnection.query(' SELECT livecomment.idx, livecomment.mess, livecomment.userid, livecomment.timecomment, livecomment.name, livecomment.message, livecomment.datecreate, livecomment.chot, livecomment.gia, livecomment.commentid, livecomment.luotin, livecomment.count, livecomment.app, livecomment.liveid, livecomment.pageid, livecomment.updateava, livecomment.realfbid, livecomment.slchot,' + selectCols('livecomment.') + ' khachhang.id, khachhang.phone, khachhang.diachi, khachhang.avalink, khachhang.label, khachhang.note, khachhang.fbnamex, khachhang.aka, khachhang.nuocngoai, khachhang.realfbid, khachhang.threadid FROM livecomment INNER JOIN khachhang ON livecomment.userid=khachhang.userid AND liveid= ? ', liveid,
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

    router.post('/detailcomment', jwtAuth, async function (req, res) {
        const { commentid, userid, refreshProfile } = req.body;
        if (isFakeCommentId(commentid)) {
            return res.json({
                success: false,
                data: { skipped: true, message: 'Đây là comment ảo được tạo từ tin nhắn của khách, không có comment gốc trên Facebook để cập nhật.' }
            });
        }
        if (typeof commentid !== 'string' || !/^\d+_\d+$/.test(commentid) ||
            typeof userid !== 'string' || !/^\d+$/.test(userid)) {
            return res.status(400).json({ success: false, error: 'Mã bình luận hoặc khách hàng không hợp lệ.' });
        }

        let page;
        let profile;
        let refreshCustomerProfile;
        const updateProfile = refreshProfile === '1';
        try {
            const [[comment]] = await DBConnection.query(
                'SELECT CAST(pageid AS CHAR) AS pageid FROM livecomment WHERE commentid = ? AND userid = ? LIMIT 1',
                [commentid, userid]
            );
            if (!comment) return res.status(404).json({ success: false, error: 'Không tìm thấy bình luận của khách này.' });
            refreshCustomerProfile = async (from) => {
                const picture = from?.picture?.data;
                let avatar = picture?.url || '';
                let name = from?.name || '';
                let avatarSaved = false;
                if (avatar) {
                    avatarSaved = await downloadAvatar(avatar, userid, AVA_DIR).then(() => true, () => false);
                }
                if (!avatarSaved || !name) {
                    const fallback = await fetchFbProfile(userid, comment.pageid, { saveAvatar: false });
                    name ||= fallback?.name || '';
                    if (!avatarSaved && fallback?.pic && fallback.pic !== avatar) {
                        avatar = fallback.pic;
                        avatarSaved = await downloadAvatar(avatar, userid, AVA_DIR).then(() => true, () => false);
                    }
                }
                const result = { name, searchName: name ? LocDau(name) : '', avatarSaved };
                if (name || avatarSaved) {
                    await DBConnection.query(
                        `UPDATE khachhang SET fbname = COALESCE(?, fbname), fbnamex = COALESCE(?, fbnamex),
                            avalink = COALESCE(?, avalink) WHERE userid = ? AND pageid = ?`,
                        [name || null, result.searchName || null, avatarSaved ? avatar : null, userid, comment.pageid]
                    );
                }
                return result;
            };

            const [[account]] = await DBConnection.query('SELECT token FROM usertoken WHERE id = 1');
            if (!account?.token) {
                if (updateProfile) profile = await refreshCustomerProfile();
                return res.status(503).json({ success: false, error: 'Thiếu user token Facebook để cập nhật bình luận.', profile });
            }

            const browser = await getBrowser();
            page = await browser.newPage();
            const fields = 'from,id,created_time,live_broadcast_timestamp,message,application';
            async function readComment(fieldList) {
                const params = new URLSearchParams({ fields: fieldList, access_token: account.token });
                await page.goto(`https://graph.facebook.com/v16.0/${commentid}?${params}`, { timeout: 15000 });
                return JSON.parse(await page.$eval('*', element => element.innerText));
            }
            let data = await readComment(updateProfile ? fields.replace('from,', 'from{id,name,picture{url,is_silhouette}},') : fields);
            if (updateProfile && data?.error) data = await readComment(fields);
            if (data?.error) {
                if (updateProfile) profile = await refreshCustomerProfile();
                const graphError = data.error;
                const inaccessible = Number(graphError.error_subcode) === 33 ||
                    /Invalid comment_id|Unsupported get request|does not exist|cannot be loaded/i.test(String(graphError.message || ''));
                const message = inaccessible
                    ? 'Không truy cập được bình luận. Bình luận có thể đã bị xóa hoặc token không đủ quyền xem.'
                    : Number(graphError.code) === 190
                        ? 'Token Facebook đã hết hạn hoặc không hợp lệ. Vui lòng lấy lại token rồi thử cập nhật.'
                        : 'Facebook không cập nhật được bình luận: ' + (graphError.message || 'Không có thông tin lỗi.');
                return res.status(inaccessible ? 404 : 502).json({
                    success: false, error: message, profile,
                    facebookError: { code: graphError.code, error_subcode: graphError.error_subcode }
                });
            }
            if (!data || typeof data !== 'object' || !data.id || !data.from?.id) {
                if (updateProfile) profile = await refreshCustomerProfile();
                return res.status(502).json({
                    success: false, profile, error: 'Facebook chưa trả đủ thông tin bình luận và người bình luận. Chưa cập nhật dữ liệu bình luận.'
                });
            }

            const realId = String(data.from.id);
            const timestamp = data.live_broadcast_timestamp == null ? NaN : Number(data.live_broadcast_timestamp);
            const hasTimestamp = Number.isFinite(timestamp) && timestamp >= 0 && timestamp <= 8640000000000;
            const time = hasTimestamp ? new Date(timestamp * 1000).toISOString().slice(11, 19) : null;
            if (updateProfile) profile = await refreshCustomerProfile(data.from);

            const [[oldCustomer]] = await DBConnection.query(
                'SELECT phone, diachi, note, nuocngoai FROM khachhang WHERE realfbid = ? AND userid != ? LIMIT 1',
                [realId, userid]
            );
            if (oldCustomer) {
                await DBConnection.query(
                    'UPDATE khachhang SET realfbid=?, phone=?, diachi=?, note=?, nuocngoai=? WHERE userid=?',
                    [realId, oldCustomer.phone, oldCustomer.diachi, oldCustomer.note, oldCustomer.nuocngoai, userid]
                );
            } else {
                await DBConnection.query('UPDATE khachhang SET realfbid=? WHERE userid=?', [realId, userid]);
            }
            await DBConnection.query(
                `UPDATE livecomment SET realfbid=?, count=COALESCE(?, count), timecomment=COALESCE(?, timecomment),
                    app=COALESCE(?, app), name=COALESCE(?, name) WHERE commentid=? AND userid=?`,
                [realId, hasTimestamp ? timestamp : null, time, data.application?.name || null, profile?.name || null, commentid, userid]
            );
            return res.json({ success: true, data, profile });
        } catch (error) {
            console.error('[detailcomment] Lỗi cập nhật:', error.code || error.name);
            if (updateProfile && !profile && refreshCustomerProfile) {
                try { profile = await refreshCustomerProfile(); }
                catch (profileError) { console.error('[detailcomment] Lỗi cập nhật avatar:', profileError.code || profileError.name); }
            }
            return res.status(502).json({ success: false, profile, error: 'Không cập nhật được bình luận từ Facebook hoặc database.' });
        } finally {
            if (page) await page.close().catch(() => {});
        }
    });

    router.post('/replycomment', jwtAuth, async function (req, res) {
        const { commentid, pageid, userid, chat } = req.body || {};
        const fail = (status, message) => res.status(status).json({ success: false, error: message, data: { error: { message } } });
        if (isFakeCommentId(commentid)) return res.json({ data: { skipped: true, message: 'Comment ảo, bỏ qua.' } });
        if (typeof chat !== 'string' || !chat.trim() || !/^[0-9]{1,64}$/.test(String(pageid || '')) ||
            !/^[0-9]{1,64}$/.test(String(userid || '')) || typeof commentid !== 'string' || !/^[0-9_]{0,100}$/.test(commentid)) {
            return fail(400, 'Thiếu hoặc sai nội dung, khách, Page hoặc mã bình luận.');
        }
        try {
            const [[page]] = await DBConnection.query('SELECT accesstoken FROM pageinfo WHERE pageid = ? LIMIT 1', [pageid]);
            if (!page?.accesstoken) return fail(409, 'Page chưa có token để gửi tin nhắn.');
            const direct = commentid === '' || chat.includes('..');
            const { statusCode, body } = await facebookRequestJson({
                url: 'https://graph.facebook.com/v10.0/me/messages', method: 'POST',
                qs: { access_token: page.accesstoken },
                body: { recipient: direct ? { id: String(userid) } : { comment_id: commentid },
                    messaging_type: direct ? 'UPDATE' : 'RESPONSE', message: { text: chat } }
            });
            if (statusCode === 200 && typeof body.message_id === 'string') {
                const psid = body.recipient_id;
                if (typeof psid === 'string' && /^[0-9]{1,64}$/.test(psid)) {
                    try {
                        await DBConnection.query('UPDATE khachhang SET psid = ? WHERE userid = ? AND pageid = ?', [psid, userid, pageid]);
                    } catch (error) {
                        // Facebook has already accepted the message. A local bookkeeping
                        // failure must not tell the user to send it again.
                        console.error('[replycomment] Tin đã gửi, chưa lưu được PSID:', error.code || error.name);
                    }
                }
            } else if (!body.error?.message) {
                return fail(502, 'Facebook chưa trả mã tin nhắn hoặc lý do lỗi. Kiểm tra cuộc trò chuyện trước khi thử lại.');
            }
            return res.json({ data: body });
        } catch (error) {
            console.error('[replycomment] Không hoàn tất yêu cầu:', error.code || error.name);
            return fail(error.status || 503, error.status ? error.message : 'Không truy cập được database để gửi tin nhắn.');
        }
    });

    router.post('/getthread', jwtAuth, async function (req, res) {
        const { pageid, threadid, userid } = req.body || {};
        const fail = (status, message) => res.status(status).json({ success: false, error: message, data: { error: { message } } });
        if (!/^[0-9]{1,64}$/.test(String(pageid || '')) || typeof threadid !== 'string' || !/^[A-Za-z0-9_:-]{1,200}$/.test(threadid)) {
            return fail(400, 'Page hoặc mã cuộc trò chuyện không hợp lệ.');
        }
        try {
            if (threadid !== '0' && /^[0-9]{1,64}$/.test(String(userid || ''))) {
                await DBConnection.query('UPDATE khachhang SET threadid = ? WHERE userid = ? AND pageid = ?', [threadid, userid, pageid]);
            }
            const [[page]] = await DBConnection.query('SELECT accesstoken FROM pageinfo WHERE pageid = ? LIMIT 1', [pageid]);
            if (!page?.accesstoken) return fail(409, 'Page chưa có token để tải cuộc trò chuyện.');
            const { statusCode, body } = await facebookRequestJson({
                url: 'https://graph.facebook.com/' + encodeURIComponent(threadid), method: 'GET',
                qs: { fields: 'messages.limit(10){from,attachments,message,created_time,sticker},updated_time', access_token: page.accesstoken }
            });
            if (statusCode >= 400 && !body.error?.message) return fail(502, 'Không tải được cuộc trò chuyện từ Facebook.');
            return res.json({ data: body });
        } catch (error) {
            console.error('[getthread] Không hoàn tất yêu cầu:', error.code || error.name);
            return fail(error.status || 503, error.status ? error.message : 'Không truy cập được database để tải cuộc trò chuyện.');
        }
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
        var sllive = parseInt(request.body.sllive);
        if (!(sllive > 0)) sllive = 1;
        var userid = request.body.userid;
        var sb = '';
        var sql = SqlString.format("SELECT * FROM livestream order by idx desc limit ?;", [sllive]);
        DBConnection.query(sql, function (error, data) {
            if (error || !data || data.length === 0) return response.json({ data: [] });
            for (var i = 0; i < data.length; i++) {
                sb += `liveid='${data[i].id}' OR `;
            }
            sb = sb.substring(0, sb.length - 4);
            DBConnection.query(SqlString.format(`SELECT * FROM livecomment WHERE (${sb}) AND userid=?;`, [userid]), function (error, data) {
                response.json({
                    data: error ? [] : data
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
        var second = parseSecondPrice(request.body);
        ensureChot2().catch(function () { return false; }).then(function (hasCols) {
            if (second.gia2 && !hasCols) {
                return response.status(409).json({ error: 'Chưa thêm được cột gia2/slchot2 vào bảng livecomment, hãy chạy file sql/livecomment_gia2.sql' });
            }
            var extraSet = hasCols ? ', gia2 = ?, slchot2 = ?' : '';
            var extraParams = hasCols ? [second.gia2, second.slchot2] : [];

            function finish(luotcuoi) {
                const newChotData = {
                    cid: cid,
                    gia: gia,
                    chot: chot,//nay la chu~ CHOT
                    liveid: liveid,
                    luotcuoilive: luotcuoi,
                    slchot: slchot,
                    gia2: second.gia2,
                    slchot2: second.slchot2
                };
                io.to(liveid).emit('new-chot', newChotData);
                if (socketid) {
                    io.to(socketid).emit('new-chot', newChotData);
                }
                response.json({ data: cid, luotcuoi: luotcuoi });
            }

            DBConnection.query('SELECT luotin FROM livecomment WHERE commentid = ? LIMIT 1', [cid], function (err0, existingRows) {
                if (err0) {
                    console.error('updatechot select error:', err0);
                    return response.status(500).json({ error: 'Lỗi cơ sở dữ liệu' });
                }
                var existingLuotin = (existingRows && existingRows[0]) ? parseInt(existingRows[0].luotin) : 0;
                if (existingLuotin && existingLuotin > 0) {
                    var luotcuoi = existingLuotin;
                    DBConnection.query(SqlString.format('UPDATE livecomment SET chot=?, gia=?, slchot=?' + extraSet + ' WHERE commentid=?', [chot, gia, slchot].concat(extraParams, [cid])), function (err1) {
                        if (err1) {
                            console.error('updatechot update error:', err1);
                            return response.status(500).json({ error: 'Lỗi cơ sở dữ liệu' });
                        }
                        finish(luotcuoi);
                    });
                } else {
                    DBConnection.query(
                        'UPDATE livestream SET luotincuoi = @newluot := luotincuoi + 1 WHERE id = ?; ' +
                        'UPDATE livecomment SET chot = ?, gia = ?, luotin = @newluot, slchot = ?' + extraSet + ' WHERE commentid = ?; ' +
                        'SELECT @newluot AS luotcuoi;',
                        [liveid, chot, gia, slchot].concat(extraParams, [cid]),
                        function (err2, results) {
                            if (err2) {
                                console.error('updatechot increment error:', err2);
                                return response.status(500).json({ error: 'Lỗi cơ sở dữ liệu' });
                            }
                            var luotcuoi = results && results[2] && results[2][0] ? results[2][0].luotcuoi : null;
                            finish(luotcuoi);
                        }
                    );
                }
            });
        });
    });

    router.post('/updatexa', function (request, response, next) {
        const io = socket.getIo();
        var chot = request.body.chot;
        var cid = request.body.commentid;
        var liveid = request.body.liveid;
        var socketid = request.body.socketid;
        ensureChot2().catch(function () { return false; }).then(function (hasCols) {
            var sql = SqlString.format('UPDATE livecomment SET chot=?, gia=?, slchot=1' + (hasCols ? ', gia2=NULL, slchot2=NULL' : '') + ' WHERE commentid=?', [chot, '', cid]);
            DBConnection.query(sql).catch(function (err) { console.error('updatexa error:', err.message); });
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
