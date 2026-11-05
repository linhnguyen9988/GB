'use strict';
const DBConnection = require("../configs/DBConnection");
const axios = require('axios');
const qs = require('qs');
const socket = require('../socket');
const { JT_API_ACCOUNT, JT_CUSTOMER_CODE, JT_PASSWORD, JT_PKEY, SHIP_LABEL } = require('../configs/constants');
const { md5ToBase64 } = require('../utils/crypto');
const { renderShipLabelPdf } = require('./shipLabelService');
const { isPrinterOnline } = require('./printAgent');
const { printLabelByCode, resolveAdminUnits, stripJtCode } = require('./labelPrintService');

async function CancelOrderJT(orderid) {
    const pkey = JT_PKEY;
    const apiAccount = JT_API_ACCOUNT;
    const oderjson = JSON.stringify({
        "customerCode": JT_CUSTOMER_CODE,
        "password": JT_PASSWORD,
        "txlogisticId": orderid,
        "reason": "Shop hủy đơn"
    });

    const digest = md5ToBase64(oderjson + pkey);
    const query = 'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/cancelOrder';

    try {
        const response = await axios({
            method: 'post',
            url: query,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'apiAccount': apiAccount,
                'digest': digest,
                'timestamp': new Date().getTime().toString()
            },
            data: qs.stringify({
                'bizContent': oderjson
            })
        });

        const body = response.data;

        if (body.msg === 'success') {
            const info = `Shop hủy đơn: ${body.data.billCode} -> ${body.data.txlogisticId}`;
            console.log(info);
            return info;
        } else {
            console.log(body.msg);
            return body.msg;
        }

    } catch (error) {
        console.error('Lỗi khi gọi API J&T:', error.message);
        return 'Lỗi kết nối API';
    }
}

const JT_BASE = 'https://ylopenapi.jtexpress.vn/webopenplatformapi/api';

const JT_FINAL_CODES = [105, 113, 117];
const JT_KNOWN_CODES = [103, 105, 106, 109, 110, 112, 113, 116, 117, 118, 120];

const JT_STATUS_VN = {
    103: "Tạo đơn thành công",
    105: "Đã hủy đơn",
    106: "Bưu tá đã lấy hàng",
    109: "Xuất kho trung chuyển",
    110: "Hàng đã đến bưu cục",
    112: "Đang giao hàng",
    113: "Giao hàng thành công",
    116: "Đang chuyển hoàn",
    117: "Đã ký nhận hoàn trả",
    118: "Kiện vấn đề (Giao)",
    120: "Kiện vấn đề (Hoàn)"
};

const { JT_SENDER, JT_ORDER_NOTE, JT_PRODUCT_NAME } = require('../configs/jtLabelConfig');

async function buildGBLabelBase64(orderid) {
    const [rows] = await DBConnection.query(
        `SELECT name, phone, address, cod, kg, realorderid, sortline, sortcode
           FROM lendon
          WHERE (orderid = ? OR realorderid = ?) AND provider = 'J&T'
          LIMIT 1`,
        [orderid, orderid]
    );
    if (!rows.length) throw new Error('Không tìm thấy đơn J&T trong hệ thống');
    const r = rows[0];
    const pdf = await renderShipLabelPdf([{
        billCode: r.realorderid,
        name: r.name,
        phone: r.phone,
        address: r.address,
        cod: r.cod,
        kg: r.kg,
        sortLine: r.sortline || r.sortcode,
        note: JT_ORDER_NOTE,
        productName: JT_PRODUCT_NAME
    }], JT_SENDER);
    return pdf.toString('base64');
}

function httpError(status, message) {
    const e = new Error(message);
    e.httpStatus = status;
    return e;
}

async function jtPost(apiPath, biz, timeout = 5000) {
    const json = JSON.stringify({ customerCode: JT_CUSTOMER_CODE, password: JT_PASSWORD, ...biz });
    const params = new URLSearchParams();
    params.append('bizContent', json);
    const response = await axios.post(JT_BASE + apiPath, params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'apiAccount': JT_API_ACCOUNT,
            'digest': md5ToBase64(json + JT_PKEY),
            'timestamp': Date.now().toString()
        },
        timeout
    });
    return response.data;
}

function isPartReturnBill(code) {
    return /^\d+-\d{3}$/.test(String(code || ''));
}

function normalizeMoney(v) {
    const s = String(v ?? '0').trim();
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return s.replace(/[.,]/g, '');
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? String(Math.round(n)) : '0';
}

function eventCode(ev) {
    let code = Number(ev && ev.scanTypeCode);
    if (!code && ev && ev.scanTypeName === '中心到件') code = 110;
    return code || 0;
}

function jtTypeName(code, name) {
    let n = JT_STATUS_VN[code] || name || 'Hành trình mới';
    if (n === '中心到件') n = 'Hàng đến TTKT';
    else if (n === '取件失败') n = 'Nhận hàng không thành công';
    return n;
}

function jtPics(d) {
    d = d || {};
    const urls = [];
    const addLoose = v => {
        if (Array.isArray(v)) v.forEach(addLoose);
        else if (typeof v === 'string' && v.trim() !== '') urls.push(v.trim());
    };
    const addStrict = v => {
        if (Array.isArray(v)) v.forEach(addStrict);
        else if (typeof v === 'string') v.split(/,(?=https?:\/\/)/i).map(x => x.trim()).forEach(u => { if (/^https?:\/\//i.test(u)) urls.push(u); });
    };
    addLoose(d.pictureUrl);
    addLoose(d.sigPicUrl);
    for (const [k, v] of Object.entries(d)) {
        if (k === 'pictureUrl' || k === 'sigPicUrl') continue;
        if (/pic|image|img|photo/i.test(k)) addStrict(v);
    }
    const uniq = [...new Set(urls)];
    return uniq.length ? JSON.stringify(uniq) : null;
}

function toEpoch(v) {
    if (!v) return null;
    if (v instanceof Date) return v.getTime();
    const t = new Date(String(v).replace(' ', 'T')).getTime();
    return Number.isNaN(t) ? null : t;
}

function toWaybillRow(billCode, d) {
    const code = eventCode(d);
    let typeName = jtTypeName(code, d.scanTypeName);
    if (code === 110 && /^TTKT/i.test(String(d.scanNetworkName || ''))) typeName = 'Hàng đến TTKT';
    const phone = d.staffContact || d.scanByContact || null;
    return {
        billcode: billCode,
        scanbycode: d.scanByCode || null,
        scanbycontact: phone ? String(phone).replace('+84', '0') : null,
        scanbyname: d.staffName || d.scanByName || null,
        scanward: d.scanNetworkArea || null,
        scancity: d.scanNetworkCity || null,
        scanprov: d.scanNetworkProvince || null,
        scanpost: d.scanNetworkName || null,
        scantime: d.scanTime || null,
        scantypename: typeName,
        issuename: d.reason || d.abnormalPieceName || null,
        scantypecode: code || null,
        sigpic: jtPics(d)
    };
}

let _sigpicCache = { value: false, at: 0 };
async function jtHasSigpic() {
    if (_sigpicCache.value || Date.now() - _sigpicCache.at < 60000) return _sigpicCache.value;
    try {
        const [rows] = await DBConnection.query("SHOW COLUMNS FROM jtwaybill LIKE 'sigpic'");
        _sigpicCache = { value: rows.length > 0, at: Date.now() };
    } catch (_) {
        _sigpicCache = { value: false, at: Date.now() };
    }
    return _sigpicCache.value;
}

async function insertWaybillIfNew(conn, r, withSig) {
    const cols = ['billcode', 'scanbycode', 'scanbycontact', 'scanbyname', 'scanward', 'scancity', 'scanprov', 'scanpost', 'scantime', 'scantypename', 'issuename', 'scantypecode'];
    const vals = [r.billcode, r.scanbycode, r.scanbycontact, r.scanbyname, r.scanward, r.scancity, r.scanprov, r.scanpost, r.scantime, r.scantypename, r.issuename, r.scantypecode];
    if (withSig) { cols.push('sigpic'); vals.push(r.sigpic); }
    const [res] = await conn.query(
        `INSERT INTO jtwaybill (${cols.join(',')})
         SELECT ${cols.map(() => '?').join(',')} FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM jtwaybill WHERE billcode = ? AND scantime <=> ? AND scantypecode <=> ?)`,
        [...vals, r.billcode, r.scantime, r.scantypecode]
    );
    if (withSig && r.sigpic && res.affectedRows === 0) {
        await conn.query(
            `UPDATE jtwaybill SET sigpic = ?
             WHERE billcode = ? AND scantime <=> ? AND scantypecode <=> ? AND (sigpic IS NULL OR sigpic = '')`,
            [r.sigpic, r.billcode, r.scantime, r.scantypecode]
        );
    }
    return res.affectedRows;
}

async function latestStoredScanEpoch(billCode) {
    const [rows] = await DBConnection.query('SELECT MAX(scantime) AS m FROM jtwaybill WHERE billcode = ?', [billCode]);
    return toEpoch(rows[0] && rows[0].m);
}

async function applyJTStatus(billCode, ev) {
    const code = eventCode(ev);
    if (!JT_KNOWN_CODES.includes(code)) return { applied: false, found: false };

    const [prevRows] = await DBConnection.query('SELECT statuscode FROM lendon WHERE realorderid = ? LIMIT 1', [billCode]);
    if (!prevRows.length) return { applied: false, found: false };

    const row = toWaybillRow(billCode, ev);
    const w = Number(ev.weight);
    const weight = Number.isFinite(w) && w > 0 ? w : null;
    const issue = (code === 118 || code === 120)
        ? String(ev.abnormalPieceName || ev.reason || ev.desc || 'Kiện vấn đề').slice(0, 255)
        : null;
    const terminal = JT_FINAL_CODES.includes(code);

    const [res] = await DBConnection.query(
        `UPDATE lendon
            SET statuscode = ?, statustext = ?, issue = ?, kg = COALESCE(?, kg), last_update = NOW()
          WHERE realorderid = ?${terminal ? '' : ` AND statuscode NOT IN (${JT_FINAL_CODES.join(',')})`}`,
        [code, row.scantypename, issue, weight, billCode]
    );
    return {
        applied: res.affectedRows > 0,
        found: true,
        changed: res.affectedRows > 0 && Number(prevRows[0].statuscode) !== code,
        statuscode: code,
        statustext: row.scantypename,
        issue
    };
}

async function createPartReturnOrder(billCode) {
    const child = billCode + '-001';
    try {
        await DBConnection.query(
            `INSERT INTO lendon
                (name, phone, address, cod, kg, status, date, orderid, realorderid, khid, userid, realfbid, time, provider, sortline, sortcode, statuscode, statustext, useraccountid, last_update)
             SELECT p.name, p.phone, p.address, 0, p.kg, p.status, p.date, CONCAT(p.orderid, '-001'), ?, p.khid, p.userid, p.realfbid, NOW(), 'J&T', p.sortline, p.sortcode, 116, 'Đang chuyển hoàn', p.useraccountid, NOW()
               FROM lendon p
              WHERE p.realorderid = ? AND p.provider = 'J&T'
                AND NOT EXISTS (SELECT 1 FROM lendon c WHERE c.realorderid = ?)
              LIMIT 1`,
            [child, billCode, child]
        );
    } catch (e) {
        console.error('[J&T] Lỗi tạo đơn hoàn 1 phần:', e.message);
    }
}

async function createJTOrder(input) {
    let { fbname, address, phone, cod, kg, khid, userid, realfbid, tinh, huyen, xa, accountId } = input || {};

    if (!xa) return { success: false, message: 'Check địa chỉ trước' };
    if (!fbname || !phone || !address) return { success: false, message: 'Thiếu thông tin người nhận!' };

    const codStr = normalizeMoney(cod);
    const weight = parseFloat(kg) || 1;
    const note = JT_ORDER_NOTE;
    const productName = JT_PRODUCT_NAME;
    const txlogisticId = 'DH' + Date.now();
    const timenow = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' });

    let body;
    try {
        body = await jtPost('/order/addOrder', {
            txlogisticId,
            productType: 'EXPRESS',
            orderType: '1',
            serviceType: '1',
            partSign: 1,
            deliveryType: '1',
            totalQuantity: 1,
            isCallBeforeReturn: 1,
            sender: JT_SENDER,
            receiver: { name: fbname, mobile: phone, prov: tinh, city: huyen, area: xa, address },
            payType: 'PP_PM',
            goodsType: 'bm000010',
            goodsValue: codStr,
            codMoney: codStr,
            itemsValue: codStr,
            remark: note,
            englishName: 'none',
            packageInfo: { weight, length: 10, width: 10, height: 10, volume: '10' },
            items: [{ itemName: productName, englishName: 'None', number: 1, itemValue: codStr }]
        }, 5000);
    } catch (error) {
        console.error('Lỗi Create Order J&T:', error.message);
        return { success: false, message: 'Lỗi hệ thống: ' + error.message };
    }

    if (!body || body.msg !== 'success' || !body.data) {
        return { success: false, message: 'J&T từ chối: ' + (body && body.msg) };
    }

    const sortLine = String(body.data.sortLine || '').slice(0, 45) || null;
    const sortCode = String(body.data.sortingCode || body.data.sortCode || body.data.sortLine || '').slice(0, 100) || null;

    try {
        await DBConnection.query(
            `INSERT INTO lendon
                (name, phone, address, cod, kg, status, date, orderid, realorderid, khid, userid, realfbid, time, provider, sortline, sortcode, statuscode, statustext, useraccountid, last_update, xa, huyen, tinh)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'J&T', ?, ?, ?, ?, ?, NOW(), ?, ?, ?)`,
            [fbname, phone, address, codStr, weight, 1, timenow, txlogisticId, body.data.billCode,
             khid, userid, realfbid, sortLine, sortCode, 100, 'Mới tạo', accountId ?? null,
             xa, huyen, tinh]
        );
    } catch (dbErr) {
        console.error(`Lỗi lưu đơn J&T ${body.data.billCode} vào DB:`, dbErr.message);
        return { success: false, message: `Đã tạo đơn J&T ${body.data.billCode} nhưng lưu hệ thống lỗi: ${dbErr.message}` };
    }

    return {
        success: true,
        message: 'Lên đơn J&T thành công',
        order_code: body.data.billCode,
        sort_line: sortLine,
        sort_code: sortCode,
        txlogisticId
    };
}

async function GetBillJT(orderid, userId) {
    const io = socket.getIo();
    const emitPdf = (base64) => {
        if (io && userId) {
            io.to(`USER_ROOM_${userId}`).emit("print-now", {
                type: 'pdf',
                base64,
                config: { printerName: "HPRT N41", widthMm: 80, heightMm: 80 }
            });
        }
    };

    if (SHIP_LABEL === 'html') {
        try {
            const r = await printLabelByCode(orderid, userId);
            if (r.success) return true;
            if (r.status === 404) return false;
            console.error(`❌ Lỗi in tem HTML (${orderid}): ${r.message}`);
            return false;
        } catch (e) {
            console.error(`❌ Lỗi dựng tem HTML (${orderid}), chuyển sang tem J&T:`, e.message);
        }
    } else if (SHIP_LABEL === 'gb') {
        try {
            emitPdf(await buildGBLabelBase64(orderid));
            return true;
        } catch (e) {
            console.error(`❌ Lỗi tạo tem GB (${orderid}), chuyển sang tem J&T:`, e.message);
        }
    }

    try {
        const body = await jtPost('/order/printOrder', { txlogisticId: orderid }, 5000);
        if (body.msg === 'success' && body.data?.base64EncodeContent) {
            emitPdf(body.data.base64EncodeContent);
            return true;
        }
        console.error(`❌ Lỗi lấy bill J&T (${orderid}):`, body.msg);
        return false;
    } catch (error) {
        console.error(`❌ Lỗi kết nối lấy bill J&T:`, error.message);
        return false;
    }
}

async function reprintBillJT(code, userId) {
    code = String(code || '').trim();
    if (!code) return { success: false, status: 400, message: 'Thiếu mã đơn' };

    const [rows] = await DBConnection.query(
        "SELECT orderid FROM lendon WHERE (orderid = ? OR realorderid = ?) AND provider = 'J&T' LIMIT 1",
        [code, code]
    );
    if (!rows.length) return { success: false, status: 404, message: 'Không tìm thấy đơn J&T này' };

    if (!isPrinterOnline(userId)) return { success: false, status: 404, message: 'Máy in Offline' };

    const ok = await GetBillJT(rows[0].orderid, userId);
    return ok
        ? { success: true, message: 'Đã gửi lệnh in lại' }
        : { success: false, status: 502, message: 'Không tạo được tem J&T, thử lại sau' };
}

async function traceJT(billCode) {
    const body = await jtPost('/logistics/trace', { billCodes: billCode, txlogisticId: '' }, 10000);
    if (body.code !== '1' || !Array.isArray(body.data) || body.data.length === 0) {
        return { ok: false, message: body.msg || 'J&T chưa có dữ liệu hành trình cho đơn này!' };
    }
    const trace = body.data.find(d => d.billCode === billCode) || body.data[0];
    const details = Array.isArray(trace.details) ? trace.details : [];
    if (details.length === 0) return { ok: false, message: 'Chưa có hành trình chi tiết cho đơn này.' };
    const sortedAsc = [...details].sort((a, b) => (toEpoch(a.scanTime) || 0) - (toEpoch(b.scanTime) || 0));
    return { ok: true, details: sortedAsc };
}

async function refreshJTStatus(billCode) {
    billCode = String(billCode || '').trim();
    const [orders] = await DBConnection.query(
        "SELECT statuscode FROM lendon WHERE realorderid = ? AND provider = 'J&T' LIMIT 1", [billCode]
    );
    if (!orders.length) throw httpError(404, 'Không tìm thấy đơn J&T này');

    let trace;
    try {
        trace = await traceJT(billCode);
    } catch (e) {
        console.error('Lỗi Trace J&T:', e.message);
        throw httpError(502, 'Không kết nối được J&T, thử lại sau');
    }
    if (!trace.ok) throw httpError(404, trace.message);

    const withSig = await jtHasSigpic();
    const conn = await DBConnection.getConnection();
    try {
        await conn.beginTransaction();
        const oldPics = new Map();
        if (withSig) {
            const [old] = await conn.query('SELECT scantime, scantypecode, sigpic FROM jtwaybill WHERE billcode = ?', [billCode]);
            old.forEach(o => { if (o.sigpic) oldPics.set(`${toEpoch(o.scantime)}|${o.scantypecode}`, o.sigpic); });
        }
        await conn.query('DELETE FROM jtwaybill WHERE billcode = ?', [billCode]);
        for (const ev of trace.details) {
            const row = toWaybillRow(billCode, ev);
            if (withSig && !row.sigpic) row.sigpic = oldPics.get(`${toEpoch(row.scantime)}|${row.scantypecode}`) || null;
            await insertWaybillIfNew(conn, row, withSig);
        }
        await conn.commit();
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }

    const newest = trace.details[trace.details.length - 1];
    const st = await applyJTStatus(billCode, newest);
    const [after] = await DBConnection.query('SELECT statuscode, statustext FROM lendon WHERE realorderid = ? LIMIT 1', [billCode]);
    const code = Number(after[0].statuscode);
    return {
        changed: !!st.changed,
        statuscode: code,
        statustext: after[0].statustext,
        isFinal: JT_FINAL_CODES.includes(code)
    };
}

module.exports = {
    CancelOrderJT, GetBillJT, reprintBillJT, buildGBLabelBase64,
    createJTOrder, traceJT, refreshJTStatus,
    JT_FINAL_CODES, jtHasSigpic, isPartReturnBill, eventCode, toWaybillRow, toEpoch,
    insertWaybillIfNew, latestStoredScanEpoch, applyJTStatus, createPartReturnOrder
};
