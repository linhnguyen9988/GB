import DBConnection from "../../configs/DBConnection";
const SqlString = require('sqlstring');
const axios = require('axios');
const jwtAuth = require('../../middleware/jwtAuth');
const socket = require('../../socket');
const { AVA_DIR, GlobalPageID, GlobalPageID2 } = require('../../configs/constants');
const { LocDau } = require('../../utils/text');
const { attachAkaCount, dedupeByPerson } = require('../../services/akaService');
const { download } = require('../../utils/download');
const { getBrowser } = require('../../services/browserService');
const { getPageToken } = require('../../services/pageTokenService');
const { isNumeric } = require('../../utils/common');

module.exports = function registerCustomerRoutes(router) {
    router.post('/updateuserpsid', jwtAuth, async function (req, response) {
        const { psid, pageid } = req.body;
        if (pageid !== GlobalPageID && pageid !== GlobalPageID2) {
            return response.status(400).json({ error: 'Page ID không hợp lệ' });
        }
        const token = await getPageToken(pageid);

        const graphApiUrl = `https://graph.facebook.com/v15.0/${psid}/?fields=picture{url},name&access_token=${token}`;

        try {
            const fbRes = await axios.get(graphApiUrl);
            const data = fbRes.data;

            if (data && data.name) {
                const avatarUrl = (data.picture && data.picture.data && data.picture.data.url) ? data.picture.data.url : '';
                const fbName = data.name;
                const updateSql = SqlString.format(
                    'UPDATE khachhang SET avalink=?, fbname=?, fbnamex=? WHERE userid=?;',
                    [avatarUrl, fbName, LocDau(fbName), psid]
                );

                await new Promise((resolve, reject) => {
                    DBConnection.query(updateSql, (err, res) => err ? reject(err) : resolve(res));
                });

                console.log('Updated: ' + fbName);
                download(avatarUrl, data.id, AVA_DIR);

                response.json({
                    success: true,
                    data: data
                });
            }
        } catch (error) {
            console.error('Lỗi khi cập nhật PSID:', error.message);
            response.status(500).json({
                success: false,
                error: 'Lỗi khi gọi API Facebook hoặc lỗi Database'
            });
        }
    });

    router.post('/updateaddress', jwtAuth, function (req, res) {
        var address = req.body.address;
        var userid = req.body.userid;
        DBConnection.query(SqlString.format(` UPDATE khachhang SET diachi=? WHERE userid=?`, [address, userid]),
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    res.json({
                        data: userid
                    });
                }
            });
    });

    router.post('/updateaddress2', jwtAuth, function (req, res) {
        var address = req.body.address;
        var userid = req.body.userid;
        var sql = SqlString.format(` UPDATE khachhang SET diachi=? WHERE userid=?`, [address, userid]);
        DBConnection.query(sql,
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    res.json({
                        data: userid
                    });
                }
            });
    });

    router.post('/onupdatephone', jwtAuth, function (req, res) {
        var phone = req.body.phone;
        var userid = req.body.userid;
        DBConnection.query(SqlString.format(` UPDATE khachhang SET phone=? WHERE userid=?`, [phone, userid]),
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    res.json({
                        data: userid
                    });
                }
            });
    });

    router.post('/onupdatenote', jwtAuth, function (req, res) {
        var note = req.body.note;
        var userid = req.body.userid;
        DBConnection.query(SqlString.format(` UPDATE khachhang SET note=? WHERE userid=?`, [note, userid]),
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    res.json({
                        data: userid
                    });
                }
            });
    });

    router.post('/onupdatelabel', jwtAuth, function (req, res) {
        var label = req.body.label;
        var userid = req.body.userid;
        DBConnection.query(SqlString.format(` UPDATE khachhang SET label=? WHERE userid=?`, [label, userid]),
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    res.json({
                        data: userid
                    });
                }
            });
    });

    router.post('/updaterealfbid', jwtAuth, function (req, res) {
        var realfbid = req.body.realfbid;
        var userid = req.body.userid;
        DBConnection.query(SqlString.format(` UPDATE khachhang SET realfbid=? WHERE userid=?`, [realfbid, userid]),
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    res.json({
                        data: realfbid
                    });
                }
            });
    });

    router.post('/getuserinfo', jwtAuth, function (request, response, next) {
        var stringforsearch = request.body.stringforsearch;
        var searchstring = LocDau(stringforsearch);

        if ((searchstring.length == 5 || searchstring.length == 12) && isNumeric(searchstring)) {
            const sqlQuery = `
            SELECT khachhang.* FROM lendon 
            INNER JOIN khachhang ON lendon.khid = khachhang.id 
            WHERE (lendon.statuscode != 501 AND lendon.statuscode != 504) AND lendon.realorderid LIKE ? AND time >= NOW() - INTERVAL 14 DAY
            ORDER BY lendon.id DESC
        `;
            const searchValue = `%${searchstring}%`;

            DBConnection.query(sqlQuery, [searchValue], function (error, data) {
                if (error) {
                    console.error(error);
                    return response.status(500).json({ error: 'Database query failed' });
                }

                if (data.length > 0) {
                    attachAkaCount(data, function (rows) { response.json({ data: rows }); });
                } else {
                    const phoneQuery = `SELECT * FROM khachhang WHERE phone LIKE ?`;
                    DBConnection.query(phoneQuery, [searchValue], function (error, data) {
                        if (error) {
                            console.error(error);
                            return response.status(500).json({ error: 'Database query failed' });
                        }
                        attachAkaCount(data, function (rows) { response.json({ data: rows }); });
                    });
                }
            });
            return;
        }

        var sdt = isNumeric(searchstring) ? 'phone' : 'fbnamex';
        const finalQuery = `SELECT * FROM khachhang WHERE ?? LIKE ? ORDER BY id DESC`;
        const finalValues = [sdt, `%${searchstring.replaceAll("'", "")}%`];

        DBConnection.query(finalQuery, finalValues, function (error, data) {
            if (error) {
                console.error(error);
                return response.status(500).json({ error: 'Database query failed' });
            }
            attachAkaCount(data, function (rows) { response.json({ data: rows }); });
        });
    });

    router.post('/updatephone', jwtAuth, function (request, response, next) {
        const io = socket.getIo();
        var userid = request.body.userid;
        var phone = request.body.phone;
        var realfbid = request.body.realfbid || '';
        var liveid = request.body.liveid;
        var socketid = request.body.socketid;
        DBConnection.query(SqlString.format('UPDATE khachhang SET phone=? WHERE userid=?', [phone, userid]));
        const newPhoneData = { userid: userid, phone: phone, liveid: liveid };
        if (liveid) {
            io.to(liveid).emit('new-phone', newPhoneData);
        }
        if (socketid) {
            io.to(socketid).emit('new-phone', newPhoneData);
        }
        
        DBConnection.query(
            SqlString.format("SELECT id,fbname,userid,realfbid,pageid,label,note,diachi,phone,threadid FROM khachhang WHERE phone=? AND userid<>? AND (realfbid IS NULL OR realfbid='' OR realfbid<>?) ORDER BY id DESC", [phone, userid, realfbid]),
            function (error, othersRaw) {
                var others = dedupeByPerson(othersRaw);
                if (error) {
                    console.error(error);
                    return response.json({ data: { message: 'OK' } });
                }
                if (!others || others.length === 0) {
                    return response.json({ data: { message: 'OK' } });
                }
                var xabom = 'none';
                var names = [];
                var uids = [];
                others.forEach(function (o) {
                    var lb = o.label || '';
                    names.push(o.fbname);
                    uids.push(o.userid);
                    if (lb.includes('Xả')) xabom = 'Xả hàng';
                    else if (lb.includes('Bom')) xabom = 'Bom hàng';
                    else if (lb.includes('Có') && xabom == 'none') xabom = 'Có vấn đề';
                });
                var name = names.join(' - ');
                var akauid = uids.join(';') + ';';
                if (xabom == 'none') {
                    DBConnection.query(SqlString.format('UPDATE khachhang SET aka=?,akauid=? WHERE phone=?', [name, akauid, phone]));
                } else {
                    DBConnection.query(SqlString.format('UPDATE khachhang SET aka=?, label=?, akauid=? WHERE phone=?', [name, xabom, akauid, phone]));
                }
                response.json({
                    data: { name: name, bom: xabom, list: others }
                });
            });
    });

    router.post('/getakadetail', jwtAuth, function (req, res) {
        var phone = (req.body.phone || '').toString().replace(/\D/g, '');
        var userid = (req.body.userid || '').toString();
        var realfbid = (req.body.realfbid || '').toString();
        if (phone.length < 9) {
            return res.json({ data: [] });
        }
        DBConnection.query(
            SqlString.format("SELECT id,fbname,userid,realfbid,pageid,label,note,diachi,phone,threadid FROM khachhang WHERE phone=? AND userid<>? AND (realfbid IS NULL OR realfbid='' OR realfbid<>?) ORDER BY id DESC", [phone, userid, realfbid]),
            function (error, data) {
                if (error) {
                    console.error(error);
                    return res.status(500).json({ error: 'Database query failed' });
                }
                res.json({ data: dedupeByPerson(data) });
            });
    });

    router.post('/updateuser', jwtAuth, function (request, response, next) {
        var phone = request.body.phone;
        var diachi = request.body.diachi;
        var userid = request.body.userid;
        var label = request.body.label;
        var note = request.body.note;
        var nuocngoai = request.body.nn;
        var realfbid = request.body.realfbid;
        var important = request.body.checknote;
        var sql;

        if (realfbid.length > 0) {
            sql = SqlString.format('UPDATE khachhang SET nuocngoai=?, phone=?, diachi=?, label=?, note=?, important=? WHERE userid=? OR realfbid=?',
                [nuocngoai, phone, diachi, label, note, important, userid, realfbid]);
        } else {
            sql = SqlString.format('UPDATE khachhang SET nuocngoai=?, phone=?, diachi=?, label=?, note=?, important=? WHERE userid=?',
                [nuocngoai, phone, diachi, label, note, important, userid]);
        }
        DBConnection.query(sql);
        response.json({
            data: userid
        });
        console.log('Updated: ' + userid + ' - ' + nuocngoai);
    });

    router.post('/getnewuser', jwtAuth, function (req, resx) {
        (async () => {
            var userid = req.body.userid;
            if (!isNumeric(userid)) {
                const browser = await getBrowser();
                const page = await browser.newPage();
                await page.bringToFront();
                await page.goto('view-source:' + userid);
                const body = await page.$eval('*', (el) => el.innerText);
                userid = body.split('"selectedID":"').pop().split('"')[0];
                //await delay(3000);
                await page.close();
                if (!isNumeric(userid)) {
                    resx.json({
                        data: JSON.parse('{"error": "Link khách hàng sai"}')
                    });
                    return;
                }
            }
            DBConnection.query("SELECT userid,fbname,phone,diachi,label,note,avalink,realfbid FROM khachhang WHERE realfbid='" + userid + "'",
                async function (error, data) {
                    if (data.length > 0) {
                        resx.json({
                            data: data[0]
                        });
                    } else {
                        DBConnection.query(" SELECT token FROM usertoken WHERE id=1",
                            async function (error, data) {
                                let token = data[0].token;
                                const browser = await getBrowser();
                                const page = await browser.newPage();
                                await page.bringToFront();
                                await page.goto(`https://graph.facebook.com/${userid}/?fields=picture{url},name&access_token=${token}`);
                                const body = await page.$eval('*', (el) => el.innerText);
                                const datax = JSON.parse(body);
                                //await delay(3000);
                                await page.close();
                                resx.json({
                                    data: datax
                                });
                                /*var query = `https://graph.facebook.com/${userid}/?fields=picture{url},name&access_token=${token}`;
                                const res = await fetch(query);
                                if (res.ok) {
                                    const data = await res.json();
                                    resx.json({
                                        data: data
                                    });
                                }else{
                                    console.log(res)
                                }
                                    */
                            });
                    }
                });
        })();
    });
};
