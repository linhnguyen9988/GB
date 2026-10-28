'use strict';
const DBConnection = require("../../configs/DBConnection");
const SqlString = require('sqlstring');
const axios = require('axios');
const fs = require('fs');
const jwtAuth = require('../../middleware/jwtAuth');
const path = require('path');
const viettelOrderEdit = require('../../services/viettelOrderEdit');
const { CreateOrderID } = require('../../utils/orderId');
const { DONHANG_DIR } = require('../../configs/constants');
const { GetViettelToken, PrintBillViettel } = require('../../services/viettelService');
const { refreshOrderStatus } = require('../../services/viettelStatusService');
const { applyAddressFixes, cleanSearchTerm, normalizeSQL, preprocessForViettel } = require('../../utils/address');

async function runViettelEdit(res, label, fn) {
    try {
        const r = await fn();
        res.status(r.status).json(r.json);
    } catch (error) {
        const ref = Date.now().toString(36);
        console.error(label + ' [' + ref + ']:', error && error.stack ? error.stack : error);
        res.status(500).json({ success: false, source: 'app', ref, message: 'Lỗi hệ thống của app, thử lại sau' });
    }
}

module.exports = function registerViettelRoutes(router) {
    router.post('/getvietteltoken', jwtAuth, function (req, res) {
        GetViettelToken();
        res.sendStatus(200);
    });

    router.post('/huydonviettel', jwtAuth, async function (req, res) {
        const id = req.body.realorderid;
        const xoa = req.body.xoa;
        let type = (xoa > 0) ? 11 : 4; // 4 là hủy, 11 là xóa

        try {
            const data = await new Promise((resolve, reject) => {
                DBConnection.query(`SELECT * FROM vietteltoken`, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            if (!data || data.length === 0) {
                return res.status(404).json({ message: "Không tìm thấy Viettel token" });
            }

            const token = data[0].token;
            const url = 'https://partner.viettelpost.vn/v2/order/UpdateOrder';

            const response = await axios.post(url, {
                "TYPE": type,
                "ORDER_NUMBER": id,
                "NOTE": "Trùng đơn"
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'token': token
                }
            });

            const body = response.data;

            res.json({
                message: body.message || "Xử lý thành công"
            });

        } catch (error) {
            console.error('Lỗi hủy đơn Viettel:', error.message);

            res.status(500).json({
                message: "Lỗi hệ thống hoặc lỗi kết nối API",
                error: error.message
            });
        }
    });

    router.post('/refreshstatusviettel', jwtAuth, async function (req, res) {
        const realorderid = String(req.body.realorderid || '').trim();
        if (!/^[A-Za-z0-9]{6,30}$/.test(realorderid)) {
            return res.status(400).json({ success: false, message: 'Mã đơn không hợp lệ' });
        }
        try {
            const result = await refreshOrderStatus(realorderid);
            res.json({ success: true, ...result });
        } catch (error) {
            if (error.httpStatus) {
                return res.status(error.httpStatus).json({ success: false, message: error.message });
            }
            console.error('Lỗi /refreshstatusviettel:', error.message);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống, thử lại sau' });
        }
    });

    router.post('/capnhatdonviettel', jwtAuth, async function (req, res) {
        const id = req.body.realorderid;
        const type = parseInt(req.body.type, 10);
        const note = (req.body.note || '').toString().substring(0, 150);

        if (!id || ![1, 2, 3].includes(type)) {
            return res.status(400).json({ message: "Thiếu mã đơn hoặc loại cập nhật không hợp lệ" });
        }

        try {
            const data = await new Promise((resolve, reject) => {
                DBConnection.query(`SELECT * FROM vietteltoken`, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            if (!data || data.length === 0) {
                return res.status(404).json({ message: "Không tìm thấy Viettel token" });
            }

            const token = data[0].token;
            const url = 'https://partner.viettelpost.vn/v2/order/UpdateOrder';

            const response = await axios.post(url, {
                "TYPE": type,
                "ORDER_NUMBER": id,
                "NOTE": note
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'token': token
                }
            });

            const body = response.data;

            if (body.error === true || body.status !== 200) {
                return res.status(400).json({ message: body.message || "Lỗi từ Viettel Post" });
            }

            res.json({
                message: body.message || "Xử lý thành công"
            });

        } catch (error) {
            console.error('Lỗi cập nhật đơn Viettel:', error.message);

            res.status(500).json({
                message: (error.response && error.response.data && error.response.data.message) || "Lỗi hệ thống hoặc lỗi kết nối API",
                error: error.message
            });
        }
    });

    router.post('/getvieteleditinfo', jwtAuth, function (req, res) {
        runViettelEdit(res, 'Lỗi getvieteleditinfo', () => viettelOrderEdit.getEditInfo({
            db: DBConnection.promise(),
            realorderid: req.body.realorderid
        }));
    });

    router.post('/checkaddressviettel', jwtAuth, function (req, res) {
        runViettelEdit(res, 'Lỗi checkaddressviettel', () => viettelOrderEdit.checkAddress({
            db: DBConnection.promise(),
            axios,
            address: req.body.address,
            preprocess: preprocessForViettel
        }));
    });

    router.post('/editorderviettel', jwtAuth, function (req, res) {
        const b = req.body || {};
        runViettelEdit(res, 'Lỗi editorderviettel', () => viettelOrderEdit.editOrder({
            db: DBConnection.promise(),
            axios,
            realorderid: b.realorderid,
            input: { name: b.name, phone: b.phone, address: b.address, cod: b.cod, kg: b.kg, note: b.note },
            preprocess: preprocessForViettel
        }));
    });

    router.post('/printviettelmanual', function (req, res) {
        var realorderid = req.body.realorderid;
        PrintBillViettel(realorderid);
        res.sendStatus(200);
    });

    router.post('/checkaddress', async function (req, res) {
        const { phone, khid, name, diachi: address, userid } = req.body;
        let xa = '', huyen = '', tinh = '';

        try {
            const tokenData = await new Promise((resolve, reject) => {
                DBConnection.query(`SELECT * FROM vietteltoken`, (err, rows) => err ? reject(err) : resolve(rows));
            });

            if (!tokenData || tokenData.length === 0) {
                return res.json({ error: "Lỗi: Không tìm thấy token Viettel" });
            }

            const token = tokenData[0].token;

            const nlpResponse = await axios.post('https://partner.viettelpost.vn/v2/order/getPriceAllNlp', {
                "SENDER_ADDRESS": "Long Bình, biên Hòa, Đồng Nai",
                "RECEIVER_ADDRESS": preprocessForViettel(address),
                "PRODUCT_TYPE": "HH",
                "PRODUCT_WEIGHT": 100,
                "TYPE": 1
            }, {
                headers: { 'Content-Type': 'application/json', 'token': token }
            });

            const body = nlpResponse.data;

            if (body.error === true) {
                return res.json({ error: "Lỗi: Không nhận diện được địa chỉ" });
            }

            const receiver = body.RECEIVER_ADDRESS;
            if (!receiver.WARD_ID || receiver.WARD_ID == 0) {
                return res.json({ error: "Sai xã phường" });
            }

            const [resTinh, resHuyen, resXa] = await Promise.all([
                axios.get(`https://partner.viettelpost.vn/v2/categories/listProvinceById?provinceId=${receiver.PROVINCE_ID}`),
                axios.get(`https://partner.viettelpost.vn/v2/categories/districtByIdAndProvince?districtId=${receiver.DISTRICT_ID}&provinceById=${receiver.PROVINCE_ID}`),
                axios.get(`https://partner.viettelpost.vn/v2/categories/wardByDistrictAndId?districtId=${receiver.DISTRICT_ID}&wardsId=${receiver.WARD_ID}`)
            ]);

            if (resTinh.data.data) tinh = resTinh.data.data[0].PROVINCE_NAME;
            if (resHuyen.data.data) huyen = resHuyen.data.data.DISTRICT_NAME;

            if (resXa.data.message && resXa.data.message.includes('No suitable data found')) {
                return res.json({ error: "Lỗi: Thông tin phường bị thay đổi, phải lên đơn tay" });
            }
            if (resXa.data.data) xa = resXa.data.data.WARDS_NAME;

            const adx = `${xa}, ${huyen}, ${tinh}`;

            let jtResult = null;
            if (xa && huyen && tinh) {
                try {
                    const sProv = cleanSearchTerm(tinh);
                    let sDist = cleanSearchTerm(huyen);
                    let sWard = cleanSearchTerm(xa);
                    sWard = sWard.replace(/phường|xã/gi, "").trim();
                    ({ sWard, sDist } = applyAddressFixes(sWard, sDist));

                    const db = DBConnection.promise();
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

                    const [jtRows] = await db.query(findJT, [
                        `%${sProv}%`,
                        `%${sDist}%`,
                        `%${sWard}%`,
                        `${sWard}%`,
                        sDist
                    ]);

                    if (jtRows.length > 0) {
                        const jt = jtRows[0];
                        jtResult = {
                            xajt: jt.ward,
                            huyenjt: jt.district,
                            tinhjt: jt.prov,
                            xamoi: jt.newward,
                            tinhmoi: jt.newprov
                        };
                    } else {
                        console.log(`J&T không có dữ liệu cho: ${xa} - ${huyen} - ${tinh}`);
                        jtResult = { error: `J&T không có dữ liệu cho: ${xa} - ${huyen} - ${tinh}` };
                    }
                } catch (jtError) {
                    console.error('Lỗi lookup JT:', jtError.message);
                    jtResult = { error: 'Lỗi tra cứu J&T: ' + jtError.message };
                }
            }
            const addressNorm = address.trim();
            const checkSql = SqlString.format(
                `SELECT id FROM diachilendon WHERE LOWER(TRIM(address))=LOWER(?) AND phone=? AND userid=?`,
                [addressNorm, phone, userid]
            );

            const existingAddr = await new Promise((resolve) => {
                DBConnection.query(checkSql, (err, rows) => resolve(rows));
            });

            if (!existingAddr || existingAddr.length < 1) {
                const insertValues = [name, phone, addressNorm, khid, userid, xa, huyen, tinh];
                let insertSql;

                if (jtResult && !jtResult.error) {
                    insertSql = SqlString.format(
                        'INSERT INTO diachilendon (name, phone, address, khid, userid, xa, huyen, tinh, xajt, huyenjt, tinhjt, xamoi, tinhmoi) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?);',
                        [...insertValues, jtResult.xajt, jtResult.huyenjt, jtResult.tinhjt, jtResult.xamoi, jtResult.tinhmoi]
                    );
                } else {
                    insertSql = SqlString.format(
                        'INSERT INTO diachilendon (name, phone, address, khid, userid, xa, huyen, tinh) VALUES(?,?,?,?,?,?,?,?);',
                        insertValues
                    );
                }
                DBConnection.query(insertSql);
            } else {
                const existingId = existingAddr[0].id;
                if (jtResult && !jtResult.error) {
                    const updateSql = SqlString.format(
                        'UPDATE diachilendon SET xa=?, huyen=?, tinh=?, xajt=?, huyenjt=?, tinhjt=?, xamoi=?, tinhmoi=? WHERE id=?',
                        [xa, huyen, tinh, jtResult.xajt, jtResult.huyenjt, jtResult.tinhjt, jtResult.xamoi, jtResult.tinhmoi, existingId]
                    );
                    DBConnection.query(updateSql);
                } else {
                    const updateSql = SqlString.format(
                        'UPDATE diachilendon SET xa=?, huyen=?, tinh=? WHERE id=? AND (xa IS NULL OR xa="")',
                        [xa, huyen, tinh, existingId]
                    );
                    DBConnection.query(updateSql);
                }
            }

            res.json({
                adx,
                jtready: !!(jtResult && !jtResult.error),
                ...(jtResult && !jtResult.error ? jtResult : {}),
                ...(jtResult && jtResult.error ? { jtError: jtResult.error } : {})
            });

        } catch (error) {
            console.error('Lỗi Check Address:', error.message);
            res.status(500).json({ error: "Lỗi hệ thống khi xử lý địa chỉ" });
        }
    });

    router.post('/createorderviettel', jwtAuth, async function (req, res) {
        let { edit, fbname, address, phone, cod, kg, khid, userid, realfbid } = req.body;
        if (edit == 1) return res.json({ error: 'Chức năng sửa đơn đã chuyển sang /editorderviettel' });
        let kgreal = kg;
        if (address.length < 10) return res.json({ error: 'Chưa có địa chỉ' });

        cod = cod.toString().replaceAll('.', '');
        kg = parseFloat(kg) * 1000;

        if (kg <= 1000) kg = 500;
        else if (kg <= 2000) kg = 1000;
        else if (kg <= 3000) kg = 1500;
        else if (kg <= 4000) kg = 2000;
        else if (kg <= 6000) kg = kg - 2000;
        else if (kg <= 9000) kg = kg - 3000;
        else if (kg <= 15000) kg = kg - 4000;
        else kg = kg - 5000;

        const typecod = (cod > 0) ? 3 : 1;

        try {
            const tokenData = await new Promise((resolve, reject) => {
                DBConnection.query(`SELECT * FROM vietteltoken`, (err, rows) => err ? reject(err) : resolve(rows));
            });

            if (!tokenData || tokenData.length === 0) return res.json({ error: 'Lỗi: Không có token' });

            const { token, userid: cusid, senderphone } = tokenData[0];
            const matuquan = CreateOrderID();
            const apiUrl = 'https://partner.viettelpost.vn/v2/order/createOrder';

            const response = await axios.post(apiUrl, {
                "ORDER_NUMBER": matuquan,
                "GROUPADDRESS_ID": 23832621,
                "CUS_ID": cusid,
                "SENDER_FULLNAME": "Áo dài Gia Bảo",
                "SENDER_ADDRESS": "862, ĐƯỜNG Đoàn Văn Cự, P.Tam Hiệp, TP.Biên Hòa, T.Đồng Nai",
                "SENDER_PHONE": senderphone,
                "RECEIVER_FULLNAME": fbname,
                "RECEIVER_ADDRESS": address,
                "RECEIVER_PHONE": phone,
                "PRODUCT_NAME": "Vải",
                "PRODUCT_DESCRIPTION": "Vải",
                "PRODUCT_QUANTITY": 1,
                "PRODUCT_PRICE": cod,
                "PRODUCT_WEIGHT": kg,
                "PRODUCT_LENGTH": 1, "PRODUCT_WIDTH": 1, "PRODUCT_HEIGHT": 1,
                "PRODUCT_TYPE": "HH",
                "ORDER_PAYMENT": typecod,
                "ORDER_SERVICE": "VSL7",
                //"ORDER_VOUCHER": "TUHAOVN",
                "ORDER_SERVICE_ADD": "GNG",// co the de nhieu ma, "GG1P,GNG" .....GNG la gui hang tai buu cuc
                "ORDER_NOTE": "Ko giao được gọi shop. Cho xem hàng. Ko nhận hàng thu 30k",
                "MONEY_COLLECTION": cod,
                "IS_ADDRESS_NEW": false
            }, {
                headers: { 'Content-Type': 'application/json', 'token': token }
            });

            const body = response.data;

            if (body.error === true || body.status !== 200) {
                return res.json({ error: body.message || 'Lỗi từ Viettel Post' });
            }

            const viettelOrder = body.data;
            const finalRealOrderId = viettelOrder.ORDER_NUMBER;

            if (!viettelOrder.RECEIVER_WARDS || viettelOrder.RECEIVER_WARDS == 0) {
                await axios.post('https://partner.viettelpost.vn/v2/order/UpdateOrder',
                    { "TYPE": 4, "ORDER_NUMBER": finalRealOrderId, "NOTE": "Không tìm được tên Phường/Xã" },
                    { headers: { 'token': token } }
                );
                return res.json({ error: 'Sai địa chỉ: không tìm được Xã/Phường' });
            }

            let tinh = '', huyen = '', xa = '';
            const [resTinh, resHuyen, resXa] = await Promise.all([
                axios.get(`https://partner.viettelpost.vn/v2/categories/listProvinceById?provinceId=${viettelOrder.RECEIVER_PROVINCE}`),
                axios.get(`https://partner.viettelpost.vn/v2/categories/districtByIdAndProvince?districtId=${viettelOrder.RECEIVER_DISTRICT}&provinceById=${viettelOrder.RECEIVER_PROVINCE}`),
                axios.get(`https://partner.viettelpost.vn/v2/categories/wardByDistrictAndId?districtId=${viettelOrder.RECEIVER_DISTRICT}&wardsId=${viettelOrder.RECEIVER_WARDS}`)
            ]);
            tinh = (resTinh.data && resTinh.data.data && resTinh.data.data[0]) ? resTinh.data.data[0].PROVINCE_NAME : '';
            huyen = (resHuyen.data && resHuyen.data.data) ? resHuyen.data.data.DISTRICT_NAME : 'Không xác định';
            xa = (resXa.data && resXa.data.data) ? resXa.data.data.WARDS_NAME : '';

            if (!xa) return res.json({ error: 'Sai địa chỉ: không tìm được Xã/Phường' });

            const sortCode = viettelOrder.SORT_CODE || '';
            const tinhSort = sortCode ? `${tinh} - ${sortCode}` : tinh;

            const timenow = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Saigon" });
            const now = new Date();
            const userId = req.user.id;
            const sql = SqlString.format('INSERT INTO lendon (name,phone,address,cod,kg,status,date,orderid,realorderid,khid,userid,realfbid,time,provider,useraccountid,sortcode) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);',
                [fbname, phone, address, cod, kgreal, 1, timenow, matuquan, finalRealOrderId, khid, userid, realfbid, now, 'Viettel', userId, sortCode]);//dung userid

            await new Promise((resolve) => DBConnection.query(sql, resolve));

            res.json({
                xa, huyen, tinh: tinhSort,
                sortcode: sortCode,
                realorderid: finalRealOrderId,
                timenow,
                matuquan
            });

        } catch (error) {
            console.error('Lỗi Create Order:', error.message);
            res.json({ error: 'Lỗi hệ thống: ' + error.message });
        }
    });

    router.post('/printviettel', function (req, res) {
        const { html, realorderid } = req.body;
        try {
            const safeId = String(realorderid || '').replace(/[^A-Za-z0-9_-]/g, '');
            if (!safeId) return res.status(400).json({ success: false, error: 'realorderid không hợp lệ' });
            fs.mkdirSync(DONHANG_DIR, { recursive: true });
            fs.writeFileSync(path.join(DONHANG_DIR, `${safeId}.txt`), html);
        } catch (e) { console.log("Lỗi ghi file:", e); }
        res.json({ success: true });
    });
};
