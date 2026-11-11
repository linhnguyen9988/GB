'use strict';
const DBConnection = require("../../configs/DBConnection");
const SqlString = require('sqlstring');
const axios = require('axios');
const jwtAuth = require('../../middleware/jwtAuth');
const socket = require('../../socket');
const { AVA_DIR, GlobalPageID, GlobalPageID2 } = require('../../configs/constants');
const { LocDau } = require('../../utils/text');
const { attachAkaCount, dedupeByPerson } = require('../../services/akaService');
const { downloadAvatar } = require('../../utils/download');
const { getBrowser } = require('../../services/browserService');
const { getPageToken } = require('../../services/pageTokenService');
const { updateCustomers } = require('../../services/facebookCustomerLabels');
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

                let avatarSaved = true;
                let avatarError = '';
                try {
                    await downloadAvatar(avatarUrl, data.id || psid, AVA_DIR);
                } catch (avaErr) {
                    avatarSaved = false;
                    avatarError = avaErr.message;
                    console.error('Lỗi tải avatar của', psid, '-', avaErr.message);
                }

                response.json({
                    success: true,
                    data: data,
                    avatarSaved: avatarSaved,
                    avatarError: avatarError
                });
            } else {
                response.status(404).json({
                    success: false,
                    error: 'Facebook không trả về thông tin người dùng'
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

    router.post('/onupdatelabel', jwtAuth, async function (req, res) {
        const { label, userid } = req.body;
        try {
            await updateCustomers('userid = ?', [userid], label, 'UPDATE khachhang SET label = ? WHERE userid = ?', [label, userid]);
            res.json({ data: userid });
        } catch (error) {
            console.error('Lỗi cập nhật nhãn khách hàng:', error.code);
            res.status(500).json({ error: 'Không lưu được nhãn khách hàng' });
        }
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

    router.post('/updatephone', jwtAuth, async function (request, response) {
        const { userid, phone, realfbid = '', liveid, socketid } = request.body;
        try {
            await DBConnection.query('UPDATE khachhang SET phone=? WHERE userid=?', [phone, userid]);
            if (liveid || socketid) {
                let target = socket.getIo();
                if (liveid) target = target.to(liveid);
                if (socketid) target = target.to(socketid);
                target.emit('new-phone', { userid, phone, liveid });
            }
            const [othersRaw] = await DBConnection.query(
                "SELECT id,fbname,userid,realfbid,pageid,label,note,diachi,phone,threadid FROM khachhang WHERE phone=? AND userid<>? AND (realfbid IS NULL OR realfbid='' OR realfbid<>?) ORDER BY id DESC",
                [phone, userid, realfbid || '']
            );
            const others = dedupeByPerson(othersRaw);
            if (!others?.length) return response.json({ data: { message: 'OK' } });

            let xabom = 'none';
            const names = [];
            const uids = [];
            for (const customer of others) {
                const label = customer.label || '';
                names.push(customer.fbname);
                uids.push(customer.userid);
                if (label.includes('Xả')) xabom = 'Xả hàng';
                else if (label.includes('Bom')) xabom = 'Bom hàng';
                else if (label.includes('Có') && xabom === 'none') xabom = 'Có vấn đề';
            }
            const name = names.join(' - ');
            const akauid = uids.join(';') + ';';
            if (xabom === 'none') {
                await DBConnection.query('UPDATE khachhang SET aka=?, akauid=? WHERE phone=?', [name, akauid, phone]);
            } else {
                await updateCustomers('phone = ?', [phone], xabom,
                    'UPDATE khachhang SET aka=?, label=?, akauid=? WHERE phone=?', [name, xabom, akauid, phone]);
            }
            response.json({ data: { name, bom: xabom, list: others } });
        } catch (error) {
            console.error('Lỗi cập nhật số điện thoại khách hàng:', error.code);
            response.status(500).json({ error: 'Không hoàn tất được cập nhật số điện thoại' });
        }
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

    router.post('/updateuser', jwtAuth, async function (request, response) {
        var phone = request.body.phone;
        var diachi = request.body.diachi;
        var userid = request.body.userid;
        var label = request.body.label;
        var note = request.body.note;
        var nuocngoai = request.body.nn;
        var realfbid = request.body.realfbid || '';
        var important = request.body.checknote ?? null;
        const where = realfbid.length > 0 ? 'userid = ? OR realfbid = ?' : 'userid = ?';
        const keys = realfbid.length > 0 ? [userid, realfbid] : [userid];
        try {
            await updateCustomers(where, keys, label,
                `UPDATE khachhang SET nuocngoai=?, phone=?, diachi=?, label=?, note=?, important=COALESCE(?, important) WHERE ${where}`,
                [nuocngoai, phone, diachi, label, note, important, ...keys]);
            response.json({ data: userid });
        } catch (error) {
            console.error('Lỗi cập nhật thông tin khách hàng:', error.code);
            response.status(500).json({ error: 'Không lưu được thông tin khách hàng' });
        }
    });
};
