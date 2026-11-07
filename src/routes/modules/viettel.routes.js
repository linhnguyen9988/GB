'use strict';
const DBConnection = require("../../configs/DBConnection");
const SqlString = require('sqlstring');
const axios = require('axios');
const jwtAuth = require('../../middleware/jwtAuth');
const { toViettelWeightGrams } = require('../../utils/viettelWeight');
const viettelOrderEdit = require('../../services/viettelOrderEdit');
const { CreateOrderID } = require('../../utils/orderId');
const { PrintBillViettel } = require('../../services/viettelService');
const { getDefaultAccount, getAccountForOrder } = require('../../services/viettelAccountService');
const { refreshOrderStatus } = require('../../services/viettelStatusService');
const { suggestProvDistrict } = require('../../services/jtAddressService');
const { printLabelByCode } = require('../../services/labelPrintService');
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
        res.status(410).json({ error: 'Luồng cấu hình token đã chuyển sang Profile > Tài khoản Viettel Post.' });
    });

    router.post('/huydonviettel', jwtAuth, async function (req, res) {
        const id = req.body.realorderid;
        const xoa = req.body.xoa;
        let type = (xoa > 0) ? 11 : 4; // 4 là hủy, 11 là xóa

        try {
            const [orders] = await DBConnection.query(
                'SELECT * FROM lendon WHERE realorderid=? AND useraccountid=? LIMIT 1',
                [String(id), Number(req.user.id)]
            );
            if (!orders.length) return res.status(404).json({ message: 'Không tìm thấy đơn hàng thuộc tài khoản của bạn.' });
            const account = await getAccountForOrder(DBConnection.promise(), orders[0]);
            if (!account || !account.token) return res.status(404).json({ message: 'Không tìm thấy token Viettel của đơn hàng.' });
            const token = account.token;
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
            const result = await refreshOrderStatus(realorderid, req.user.id);
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
            const [orders] = await DBConnection.query(
                'SELECT * FROM lendon WHERE realorderid=? AND useraccountid=? LIMIT 1',
                [String(id), Number(req.user.id)]
            );
            if (!orders.length) return res.status(404).json({ message: 'Không tìm thấy đơn hàng thuộc tài khoản của bạn.' });
            const account = await getAccountForOrder(DBConnection.promise(), orders[0]);
            if (!account || !account.token) return res.status(404).json({ message: 'Không tìm thấy token Viettel của đơn hàng.' });
            const token = account.token;
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
            realorderid: req.body.realorderid,
            appUserId: req.user.id
        }));
    });

    router.post('/checkaddressviettel', jwtAuth, function (req, res) {
        runViettelEdit(res, 'Lỗi checkaddressviettel', () => viettelOrderEdit.checkAddress({
            db: DBConnection.promise(),
            axios,
            address: req.body.address,
            preprocess: preprocessForViettel,
            appUserId: req.user.id
        }));
    });

    router.post('/editorderviettel', jwtAuth, function (req, res) {
        const b = req.body || {};
        runViettelEdit(res, 'Lỗi editorderviettel', () => viettelOrderEdit.editOrder({
            db: DBConnection.promise(),
            axios,
            realorderid: b.realorderid,
            input: { name: b.name, phone: b.phone, address: b.address, cod: b.cod, kg: b.kg, note: b.note },
            preprocess: preprocessForViettel,
            appUserId: req.user.id
        }));
    });

    router.post('/printviettelmanual', jwtAuth, async function (req, res) {
        const result = await PrintBillViettel(req.body.realorderid, req.user.id);
        res.status(result.success ? 200 : 400).json(result);
    });

    router.post('/checkaddress', jwtAuth, async function (req, res) {
        const { phone, khid, name, diachi: address, userid } = req.body;
        let xa = '', huyen = '', tinh = '';

        try {
            const account = await getDefaultAccount(req.user.id);
            if (!account || !account.token) {
                return res.status(400).json({ error: 'Profile chưa cấu hình tài khoản Viettel mặc định.' });
            }
            const token = account.token;

            const nlpResponse = await axios.post('https://partner.viettelpost.vn/v2/order/getPriceAllNlp', {
                "SENDER_ADDRESS": account.warehouse_address || "Long Bình, biên Hòa, Đồng Nai",
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
            let sProv = '', sDist = '';
            if (xa && huyen && tinh) {
                try {
                    sProv = cleanSearchTerm(tinh);
                    sDist = cleanSearchTerm(huyen);
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

            let addressId = null;
            if (!existingAddr || existingAddr.length < 1) {
                const insertValues = [name, phone, addressNorm, khid, userid, xa, huyen, tinh];
                let insertSql;
                const dbp = DBConnection.promise();

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
                const [insRes] = await dbp.query(insertSql);
                addressId = insRes.insertId;
            } else {
                const existingId = existingAddr[0].id;
                addressId = existingId;
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

            let jtSuggest = null;
            if (jtResult && jtResult.error) {
                try {
                    jtSuggest = await suggestProvDistrict(DBConnection.promise(), sProv, sDist);
                } catch (sgErr) {
                    console.error('Lỗi gợi ý JT:', sgErr.message);
                    jtSuggest = { tinhjt: '', huyenjt: '' };
                }
            }

            res.json({
                adx,
                id: addressId,
                ...(jtSuggest ? { jtSuggest } : {}),
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
        try { kg = toViettelWeightGrams(kgreal); }
        catch (error) { return res.status(400).json({ error: error.message }); }

        const typecod = (cod > 0) ? 3 : 1;

        try {
            const account = await getDefaultAccount(req.user.id);
            if (!account || !account.token || !account.groupaddressid || !account.cusid || !account.order_service) {
                return res.status(400).json({ error: 'Profile chưa cấu hình đủ tài khoản Viettel, kho mặc định và dịch vụ chính.' });
            }
            const { token, senderphone, cusid, groupaddressid } = account;
            const matuquan = CreateOrderID();
            const apiUrl = 'https://partner.viettelpost.vn/v2/order/createOrder';

            const response = await axios.post(apiUrl, {
                "ORDER_NUMBER": matuquan,
                "GROUPADDRESS_ID": groupaddressid,
                "CUS_ID": cusid,
                "SENDER_FULLNAME": account.warehouse_name || "Áo dài Gia Bảo",
                "SENDER_ADDRESS": account.warehouse_address || "862, ĐƯỜNG Đoàn Văn Cự, P.Tam Hiệp, TP.Biên Hòa, T.Đồng Nai",
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
                "ORDER_SERVICE": account.order_service,
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
            const timenow = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Saigon" });
            const now = new Date();
            const userId = req.user.id;
            const sql = SqlString.format('INSERT INTO lendon (name,phone,address,cod,kg,status,date,orderid,realorderid,khid,userid,realfbid,time,provider,useraccountid,viettelaccountid,sortcode,xa,huyen,tinh) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);',
                [fbname, phone, address, cod, kgreal, 1, timenow, matuquan, finalRealOrderId, khid, userid, realfbid, now, 'Viettel', userId, account.userid, sortCode, xa, huyen, tinh]);//useraccountid la user GB, viettelaccountid la userid Viettel Post

            await DBConnection.query(require('../../services/orderAuditService').withCreator(sql, req.user));

            let printed = false, printMessage = '';
            try {
                const pr = await printLabelByCode(finalRealOrderId, userId);
                printed = !!pr.success;
                printMessage = pr.message || '';
            } catch (pe) {
                console.error('Lỗi in tem Viettel:', pe.message);
                printMessage = 'Lỗi dựng tem, hãy in lại từ danh sách đơn';
            }

            res.json({
                xa, huyen, tinh,
                sortcode: sortCode,
                realorderid: finalRealOrderId,
                timenow,
                matuquan,
                printed,
                printMessage
            });

        } catch (error) {
            console.error('Lỗi Create Order:', error.message);
            res.json({ error: 'Lỗi hệ thống: ' + error.message });
        }
    });
};
