'use strict';
const DBConnection = require("../configs/DBConnection");
const axios = require('axios');
const qs = require('qs');
const request = require('request');
const socket = require('../socket');
const { JT_API_ACCOUNT, JT_CUSTOMER_CODE, JT_PASSWORD, JT_PKEY } = require('../configs/constants');
const { delay } = require('../utils/common');
const { getBrowser } = require('./browserService');
const { md5ToBase64 } = require('../utils/crypto');

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

function PrintBillJT(orderid) {
    const pkey = JT_PKEY;
    var apiAccount = JT_API_ACCOUNT;
    var oderjson = `{"customerCode":"${JT_CUSTOMER_CODE}","password":"${JT_PASSWORD}","txlogisticId":"${orderid}"}`;
    var digest = md5ToBase64(oderjson + pkey);
    var query = 'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/printOrder';
    request({
        url: encodeURI(query),
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'apiAccount': apiAccount,
            'digest': digest,
            'timestamp': new Date().getTime()
        },
        form: {
            'bizContent': oderjson
        }
    }, async function (error, response, bodyx) {
        const body = JSON.parse(bodyx);
        if (body.msg == 'success') {
            (async () => {
                const browser = await getBrowser();
                const page2 = await browser.newPage();
                await page2.bringToFront();
                await page2.setContent(`
                    <html>
                    <body style="margin:0;padding:0; height:100%;">
                        <iframe src="data:application/pdf;base64,${body.data.base64EncodeContent}" style="width:100%; height:100%; border:none;"></iframe>
                    </body>
                    </html>
                `, { waitUntil: 'load' });
                await delay(500);
                await page2.evaluate(() => { window.print(); });
                setTimeout(() => {
                    page2.close();
                }, 500);
            })();
        } else {
            console.log(body.msg);
        }
    });
}

// =====================================================================
//  J&T — dùng chung cho: lên đơn, in bill, tra hành trình, webhook
//  (tham khảo cách tổ chức của repo PushJTxVT)
// =====================================================================
const JT_BASE = 'https://ylopenapi.jtexpress.vn/webopenplatformapi/api';

// Mã trạng thái cuối: đã hủy / giao thành công / đã hoàn — không bị sự kiện cũ ghi đè
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

// Người gửi — mặc định giữ đúng giá trị cũ, có thể ghi đè bằng biến môi trường
const JT_SENDER = {
    name: process.env.JT_SENDER_NAME || 'Áo Dài Gia Bảo',
    mobile: process.env.JT_SENDER_MOBILE || '0888118855',
    prov: process.env.JT_SENDER_PROV || 'Đồng Nai',
    city: process.env.JT_SENDER_CITY || 'Thành phố Biên Hoà',
    area: process.env.JT_SENDER_AREA || 'Phường Long Bình-251TPB07',
    address: process.env.JT_SENDER_ADDRESS || '197 HBB'
};

function httpError(status, message) {
    const e = new Error(message);
    e.httpStatus = status;
    return e;
}

// POST có ký digest tới J&T. biz sẽ được gắn customerCode + password.
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

// ---------- helpers ----------
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

// Gom mọi URL ảnh (ảnh giao hàng / chữ ký) trong 1 sự kiện J&T -> JSON string
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

// 1 sự kiện J&T -> 1 dòng bảng jtwaybill
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

// Cột sigpic là tùy chọn (cần chạy migration) — kiểm tra 1 lần, cache lại
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

// Chèn 1 dòng hành trình nếu chưa có (trùng billcode + thời gian + mã trạng thái thì bỏ qua)
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

// Cập nhật trạng thái đơn trong lendon theo 1 sự kiện J&T.
// Trạng thái cuối (105/113/117) luôn được ghi; trạng thái khác không ghi đè đơn đã ở trạng thái cuối.
async function applyJTStatus(billCode, ev) {
    const code = eventCode(ev);
    if (!JT_KNOWN_CODES.includes(code)) return { applied: false, found: false };

    const [prevRows] = await DBConnection.query('SELECT statuscode FROM lendon WHERE realorderid = ? LIMIT 1', [billCode]);
    if (!prevRows.length) return { applied: false, found: false };

    const row = toWaybillRow(billCode, ev);
    const w = Number(ev.weight);
    const weight = Number.isFinite(w) && w > 0 ? w : null;
    const issue = (code === 118 || code === 120)
        ? (ev.abnormalPieceName || ev.reason || ev.desc || 'Kiện vấn đề')
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

// J&T báo "ký nhận 1 phần": tạo đơn hoàn mới mang mã <bill>-001 (không tạo trùng)
async function createPartReturnOrder(billCode) {
    const child = billCode + '-001';
    try {
        await DBConnection.query(
            `INSERT INTO lendon
                (name, phone, address, cod, kg, status, date, orderid, realorderid, khid, userid, realfbid, time, provider, sortline, statuscode, statustext, useraccountid, last_update)
             SELECT p.name, p.phone, p.address, 0, p.kg, p.status, p.date, CONCAT(p.orderid, '-001'), ?, p.khid, p.userid, p.realfbid, NOW(), 'J&T', p.sortline, 116, 'Đang chuyển hoàn', p.useraccountid, NOW()
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

// ---------- Lên đơn ----------
// Dùng chung cho /pushorderjtex (web) và /push-jt (app). Không in bill — route tự gọi GetBillJT.
async function createJTOrder(input) {
    let { fbname, address, phone, cod, kg, khid, userid, realfbid, tinh, huyen, xa, accountId } = input || {};

    if (!xa) return { success: false, message: 'Check địa chỉ trước' };
    if (!fbname || !phone || !address) return { success: false, message: 'Thiếu thông tin người nhận!' };

    const codStr = normalizeMoney(cod);
    const weight = parseFloat(kg) || 1;
    const note = 'Cho xem hàng. Không nhận thu 30k';
    const productName = 'Vải';
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

    try {
        await DBConnection.query(
            `INSERT INTO lendon
                (name, phone, address, cod, kg, status, date, orderid, realorderid, khid, userid, realfbid, time, provider, sortline, statuscode, statustext, useraccountid, last_update)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'J&T', ?, ?, ?, ?, NOW())`,
            [fbname, phone, address, codStr, weight, 1, timenow, txlogisticId, body.data.billCode,
             khid, userid, realfbid, body.data.sortLine || null, 100, 'Mới tạo', accountId ?? null]
        );
    } catch (dbErr) {
        // Đơn đã tạo bên J&T nhưng lưu DB lỗi — báo rõ để khỏi lên trùng
        console.error(`Lỗi lưu đơn J&T ${body.data.billCode} vào DB:`, dbErr.message);
        return { success: false, message: `Đã tạo đơn J&T ${body.data.billCode} nhưng lưu hệ thống lỗi: ${dbErr.message}` };
    }

    return {
        success: true,
        message: 'Lên đơn J&T thành công',
        order_code: body.data.billCode,
        sort_line: body.data.sortLine,
        txlogisticId
    };
}

// ---------- In bill ----------
async function GetBillJT(orderid, userId) {
    const io = socket.getIo();
    try {
        const body = await jtPost('/order/printOrder', { txlogisticId: orderid }, 5000);
        if (body.msg === 'success' && body.data?.base64EncodeContent) {
            // Không lưu bill vào DB (file base64 rất nặng) — mỗi lần cần in thì gọi API J&T lấy bill rồi gửi thẳng tới máy in
            if (io && userId) {
                io.to(`USER_ROOM_${userId}`).emit("print-now", {
                    type: 'pdf',
                    base64: body.data.base64EncodeContent,
                    config: { printerName: "HPRT N41", widthMm: 80, heightMm: 80 }
                });
            }
            return true;
        }
        console.error(`❌ Lỗi lấy bill J&T (${orderid}):`, body.msg);
        return false;
    } catch (error) {
        console.error(`❌ Lỗi kết nối lấy bill J&T:`, error.message);
        return false;
    }
}

// ---------- Tra hành trình ----------
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

// Kéo hành trình từ J&T, ghi đè bảng jtwaybill của đơn đó (giữ lại ảnh cũ nếu trace không có) rồi cập nhật trạng thái.
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
    CancelOrderJT, PrintBillJT, GetBillJT,
    createJTOrder, traceJT, refreshJTStatus,
    // dùng cho webhook
    JT_FINAL_CODES, jtHasSigpic, isPartReturnBill, eventCode, toWaybillRow, toEpoch,
    insertWaybillIfNew, latestStoredScanEpoch, applyJTStatus, createPartReturnOrder
};
