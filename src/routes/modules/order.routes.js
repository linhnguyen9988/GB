'use strict';
const DBConnection = require("../../configs/DBConnection");
const SqlString = require('sqlstring');
const axios = require('axios');
const jwtAuth = require('../../middleware/jwtAuth');
const { applyAddressFixes, cleanSearchTerm, normalizeSQL } = require('../../utils/address');

module.exports = function registerOrderRoutes(router) {
    router.post('/getdiachilendon', async function (req, response) {
        const phone = req.body.phone;
        const userid = req.body.userid || '';

        if (!phone || !userid) {
            return response.status(400).json({ error: 'Thiếu phone hoặc userid' });
        }

        try {
            const addressData = await new Promise((resolve, reject) => {
                const q = `SELECT * FROM diachilendon WHERE phone=? AND userid=? ORDER BY id DESC`;
                DBConnection.query(q, [phone, userid], (err, res) => err ? reject(err) : resolve(res));
            });

            response.json({
                data: addressData.map(item => ({
                    ...item,
                    jtready: !!(item.xajt && item.huyenjt && item.tinhjt)
                }))
            });

            const missingAddresses = addressData.filter(item => !item.xa);
            if (missingAddresses.length === 0) return;

            const tokenData = await new Promise((resolve) => {
                DBConnection.query(`SELECT token FROM vietteltoken LIMIT 1`, (err, res) => resolve(res));
            });
            if (!tokenData || tokenData.length === 0) return;
            const token = tokenData[0].token;

            for (const item of missingAddresses) {
                try {
                    const nlpRes = await axios.post('https://partner.viettelpost.vn/v2/order/getPriceAllNlp', {
                        "SENDER_ADDRESS": "Long Bình, biên Hòa, Đồng Nai",
                        "RECEIVER_ADDRESS": item.address,
                        "PRODUCT_TYPE": "HH",
                        "PRODUCT_WEIGHT": 100,
                        "TYPE": 1
                    }, { headers: { 'token': token } });

                    const body = nlpRes.data;
                    const rec = body.RECEIVER_ADDRESS;

                    if (body.error || !rec || !rec.WARD_ID) continue;

                    const [resTinh, resHuyen, resXa] = await Promise.all([
                        axios.get(`https://partner.viettelpost.vn/v2/categories/listProvinceById?provinceId=${rec.PROVINCE_ID}`),
                        axios.get(`https://partner.viettelpost.vn/v2/categories/districtByIdAndProvince?districtId=${rec.DISTRICT_ID}&provinceById=${rec.PROVINCE_ID}`),
                        axios.get(`https://partner.viettelpost.vn/v2/categories/wardByDistrictAndId?districtId=${rec.DISTRICT_ID}&wardsId=${rec.WARD_ID}`)
                    ]);

                    const tinh = (resTinh.data && resTinh.data.data && resTinh.data.data[0]) ? resTinh.data.data[0].PROVINCE_NAME : '';
                    const huyen = (resHuyen.data && resHuyen.data.data) ? resHuyen.data.data.DISTRICT_NAME : 'Không xác định';
                    const xa = (resXa.data && resXa.data.data) ? resXa.data.data.WARDS_NAME : '';
                    if (xa && huyen && tinh) {
                        const sProv = cleanSearchTerm(tinh);
                        let sDist = cleanSearchTerm(huyen);
                        let sWard = cleanSearchTerm(xa);
                        sWard = sWard.replace(/phường|xã/gi, "").trim();
                        ({ sWard, sDist } = applyAddressFixes(sWard, sDist));

                        console.log(`${sWard} - ${sDist} - ${sProv}`)

                        const findJT = `
                            SELECT * 
                            FROM jtaddress
                            WHERE 
                                ${normalizeSQL('LOWER(prov)')} LIKE ${normalizeSQL('LOWER(?)')}
                                AND ${normalizeSQL('LOWER(district)')} LIKE ${normalizeSQL('LOWER(?)')}
                                AND (
                                    ${normalizeSQL('LOWER(ward)')} LIKE ${normalizeSQL('LOWER(?)')}
                                )
                            ORDER BY 
                                (LOWER(ward) LIKE ?) DESC,
                                (LOWER(district) = ?) DESC,
                                LENGTH(ward) ASC
                            LIMIT 1`;
                        const [jtRows] = await DBConnection.promise().query(findJT, [
                            `%${sProv}%`,
                            `%${sDist}%`,
                            `%${sWard}%`,
                            `${sWard}%`,
                            sDist
                        ]);
                        if (jtRows.length > 0) {
                            const jt = jtRows[0];
                            const updateSql = SqlString.format(
                                'UPDATE diachilendon SET xa=?, huyen=?, tinh=?, xajt=?, huyenjt=?, tinhjt=?, xamoi=?, tinhmoi=? WHERE id=?',
                                [xa, huyen, tinh, jt.ward, jt.district, jt.prov, jt.newward, jt.newprov, item.id]
                            );
                            DBConnection.promise().query(updateSql);
                        } else {
                            return response.json({
                                success: false,
                                message: `J&T không có dữ liệu cho địa chỉ: ${xa} - ${huyen} - ${tinh}.`
                            });
                        }
                    }
                } catch (innerError) {
                    console.error(`Lỗi xử lý địa chỉ ID ${item.id}:`, innerError.message);
                }
            }

        } catch (error) {
            console.error('Lỗi router getdiachilendon:', error.message);
            if (!response.headersSent) {
                response.status(500).json({ error: "Lỗi server" });
            }
        }
    });

    router.post('/detaildonhang', jwtAuth, function (req, res) {
        var realorderid = req.body.realorderid;
        DBConnection.query(
            `SELECT lendon.*, khachhang.pageid AS pageid
             FROM lendon
             LEFT JOIN khachhang ON khachhang.userid = lendon.userid
             WHERE lendon.realorderid = ?`,
            [realorderid],
            async function (error, data) {
                if (error) {
                    console.error('Lỗi /detaildonhang:', error.message);
                    return res.status(500).json({ error: 'Lỗi truy vấn đơn hàng' });
                }
                if (data && data.length > 0) {
                    res.json({
                        data: data
                    });
                } else {
                    res.json({ data: [] });
                }
            });
    });

    router.post('/getuserorder', async function (req, res) {
        try {
            const userid = req.body.userid;
            const limit = parseInt(req.body.limit, 10);
            const db = DBConnection.promise();

            let sql = 'SELECT * FROM lendon WHERE userid=? ORDER BY ID desc';
            const params = [userid];
            if (Number.isInteger(limit) && limit > 0) {
                sql += ' LIMIT ?';
                params.push(limit);
            }

            const [finalData] = await db.query(sql, params);

            res.json({ success: true, data: finalData });

        } catch (error) {
            console.error("Hệ thống lỗi:", error);
            res.status(500).json({ error: 'Internal Server Error', details: error.message });
        }
    });

    router.post('/getfullinfo', jwtAuth, function (req, response) {
        var id = req.body.id;
        DBConnection.query(` SELECT * FROM khachhang WHERE id='${id}'`,
            async function (error, data) {
                response.json({
                    data: data
                });
            });
    });

    router.post('/updatediachilendon', jwtAuth, function (req, response) {
        var dccu = req.body.dccu;
        var dcmoi = req.body.dcmoi;
        DBConnection.query(SqlString.format(`UPDATE diachilendon SET address=? WHERE address=?;`, [dcmoi, dccu]));
        response.sendStatus(200);
    });

    router.post('/xoadonhang', jwtAuth, function (req, response) {
        var id = req.body.id;
        var all = req.body.all;
        var sql = ``;
        if (all > 0) {
            sql = SqlString.format('UPDATE lendon set status=0;');
        } else {
            sql = SqlString.format(`DELETE FROM lendon WHERE orderid=? OR (realorderid=? && realorderid !='');`, [id, id]);
        }
        DBConnection.query(sql);
        response.json({
            id: id
        });
    });
};
