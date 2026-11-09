'use strict';
const DBConnection = require("../configs/DBConnection");
const axios = require('axios');
const shipping = require('./shippingAccounts');
const { JT_API_ACCOUNT, JT_CUSTOMER_CODE, JT_PASSWORD, JT_PKEY, SHIP_LABEL } = require('../configs/constants');
const { md5ToBase64 } = require('../utils/crypto');
const { isPrinterOnline, dispatchPrint } = require('./printAgent');
const { printLabelByCode } = require('./labelPrintService');

async function loadJTOrder(code) {
    const [[order]] = await DBConnection.query(
        "SELECT orderid, jtaccountid FROM lendon WHERE (orderid = ? OR realorderid = ?) AND provider = 'J&T' LIMIT 1",
        [code, code]
    );
    return order;
}

async function accountForJTOrder(order) {
    if (order.jtaccountid != null) return shipping.getJTAccount(order.jtaccountid);
    // Orders created before this migration used the legacy .env account.
    return { customerCode: JT_CUSTOMER_CODE, password: JT_PASSWORD };
}

async function CancelOrderJT(orderid) {
    try {
        const order = await loadJTOrder(String(orderid || '').trim());
        if (!order) return { success: false, message: 'Không tìm thấy đơn J&T này' };
        const account = await accountForJTOrder(order);
        const body = await jtPost('/order/cancelOrder', {
            txlogisticId: order.orderid,
            reason: 'Shop hủy đơn'
        }, account);
        if (body?.msg === 'success') return { success: true, message: 'J&T đã xác nhận hủy đơn' };
        return { success: false, message: body?.message || body?.msg || 'J&T chưa xác nhận hủy đơn' };
    } catch (error) {
        console.error('Lỗi hủy đơn J&T:', error.message);
        const detail = error.response?.data?.message || error.response?.data?.msg || error.message;
        return { success: false, message: 'Không hủy được đơn J&T: ' + detail };
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

function httpError(status, message) {
    const e = new Error(message);
    e.httpStatus = status;
    return e;
}

async function jtPost(apiPath, biz, account, timeout = 5000) {
    if (!JT_API_ACCOUNT || !JT_PKEY) throw new Error('Thiếu JT_API_ACCOUNT hoặc JT_PKEY trên máy chủ GB.');
    if (!account?.customerCode || !account.password) throw new Error('Thiếu thông tin xác thực J&T của đơn hàng.');
    const json = JSON.stringify({ customerCode: account.customerCode, password: account.password, ...biz });
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

function mergeJTPictures(...values) {
    const urls = new Set();
    function add(value) {
        if (Array.isArray(value)) {
            value.forEach(add);
            return;
        }
        if (typeof value !== 'string') return;
        const text = value.trim();
        if (text.startsWith('[')) {
            try { add(JSON.parse(text)); } catch (_) {}
            return;
        }
        for (const url of text.split(/,\s*(?=https?:\/\/)/i)) {
            const candidate = url.trim();
            if (/^https?:\/\/[^\s"'<>]+$/i.test(candidate)) urls.add(candidate);
        }
    }
    values.forEach(add);
    return urls.size ? JSON.stringify([...urls]) : null;
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function toEpoch(v) {
    if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
    const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})?$/i.exec(String(v || '').trim());
    if (!match) return null;
    const [, day, clock, fraction = '', zone = '+07:00'] = match;
    const calendar = `${day}T${clock}`;
    const utc = Date.parse(calendar + 'Z');
    if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 19) !== calendar) return null;
    const epoch = Date.parse(calendar + fraction + zone);
    return Number.isFinite(epoch) ? epoch : null;
}

function formatJTScanTime(value) {
    const epoch = toEpoch(value);
    if (epoch === null) return null;
    return new Date(epoch + VN_OFFSET_MS).toISOString().slice(0, 19).replace('T', ' ');
}

function readJTDetails(details) {
    const events = Array.isArray(details) ? details : details && typeof details === 'object' ? [details] : [];
    if (events.some(event => !event || toEpoch(event.scanTime) === null)) {
        throw new Error('J&T trả mốc hành trình có thời gian không hợp lệ');
    }
    return [...events].sort((a, b) => toEpoch(a.scanTime) - toEpoch(b.scanTime));
}

function toWaybillRow(billCode, d) {
    const code = eventCode(d);
    let typeName = jtTypeName(code, d.scanTypeName);
    if (code === 110 && /^TTKT/i.test(String(d.scanNetworkName || ''))) typeName = 'Hàng đến TTKT';
    const phone = d.staffContact || d.scanByContact || null;
    const reasons = code === 118 || code === 120
        ? [d.abnormalPieceName, d.reason, d.desc] : [d.reason, d.abnormalPieceName, d.desc];
    const issue = reasons.map(value => typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '')
        .find(Boolean);
    return {
        billcode: billCode,
        scanbycode: d.scanByCode || null,
        scanbycontact: phone ? String(phone).replace('+84', '0') : null,
        scanbyname: d.staffName || d.scanByName || null,
        scanward: d.scanNetworkArea || null,
        scancity: d.scanNetworkCity || null,
        scanprov: d.scanNetworkProvince || null,
        scanpost: d.scanNetworkName || null,
        scantime: formatJTScanTime(d.scanTime),
        scantypename: typeName,
        issuename: issue ? issue.slice(0, 255) : null,
        scantypecode: code || null,
        // Trace uses pictureUrl and status feedback uses sigPicUrl.
        sigpic: mergeJTPictures(d.pictureUrl, d.sigPicUrl)
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

async function insertWaybill(conn, row, withSig) {
    const { sigpic, ...fields } = row;
    if (withSig) fields.sigpic = sigpic;
    else if (sigpic) throw new Error('Thiếu cột jtwaybill.sigpic để lưu ảnh POD');
    await conn.query('INSERT INTO jtwaybill SET ?', [fields]);
}

async function insertWaybillIfNew(conn, row, withSig) {
    const match = `billcode = ? AND REPLACE(CAST(scantime AS CHAR), 'T', ' ') <=> ? AND scantypecode <=> ? AND scanpost <=> ?`;
    const params = [row.billcode, row.scantime, row.scantypecode, row.scanpost];
    const [existing] = await conn.query(
        `SELECT issuename${withSig ? ', sigpic' : ''} FROM jtwaybill WHERE ${match}`, params
    );
    if (!existing.length) {
        await insertWaybill(conn, row, withSig);
        return row.issuename;
    }

    const updates = {};
    if (row.issuename && existing.some(item => item.issuename !== row.issuename)) {
        updates.issuename = row.issuename;
    }
    if (row.sigpic) {
        if (!withSig) throw new Error('Thiếu cột jtwaybill.sigpic để lưu ảnh POD');
        const pictures = mergeJTPictures(...existing.map(item => item.sigpic), row.sigpic);
        if (existing.some(item => item.sigpic !== pictures)) updates.sigpic = pictures;
    }
    if (Object.keys(updates).length) {
        await conn.query(`UPDATE jtwaybill SET ? WHERE ${match}`, [updates, ...params]);
    }
    return row.issuename || existing.find(item => item.issuename)?.issuename || null;
}

async function readStoredJTWaybill(conn, billCode, withSig) {
    const [rows] = await conn.query(
        `SELECT CAST(scantime AS CHAR) AS scantime, scantypecode, scanpost, issuename${withSig ? ', sigpic' : ''}
         FROM jtwaybill WHERE billcode = ?`, [billCode]
    );
    return rows;
}

function waybillEventKey(row) {
    return JSON.stringify([formatJTScanTime(row.scantime), String(row.scantypecode ?? ''), row.scanpost || '']);
}

function latestStoredScanEpoch(rows) {
    let latest = null;
    for (const row of rows) {
        const epoch = toEpoch(row.scantime);
        if (epoch !== null && (latest === null || epoch > latest)) latest = epoch;
    }
    return latest;
}

async function lockJTOrder(conn, billCode) {
    const [[order]] = await conn.query("SELECT statuscode FROM lendon WHERE realorderid = ? AND provider = 'J&T' LIMIT 1 FOR UPDATE", [billCode]);
    return order;
}

async function applyJTStatus(billCode, ev, conn, storedIssue) {
    const code = eventCode(ev);
    const [prevRows] = await conn.query("SELECT statuscode FROM lendon WHERE realorderid = ? AND provider = 'J&T' LIMIT 1", [billCode]);
    if (!prevRows.length) return { applied: false, found: false };
    if (!JT_KNOWN_CODES.includes(code)) return { applied: false, found: true };

    const row = toWaybillRow(billCode, ev);
    const rawWeight = ev.weight;
    const w = typeof rawWeight === 'number' || typeof rawWeight === 'string' ? Number(rawWeight) : NaN;
    const weight = Number.isFinite(w) && w > 0 ? w : null;
    const issue = (code === 118 || code === 120)
        ? (storedIssue || row.issuename || 'Kiện vấn đề')
        : null;
    const terminal = JT_FINAL_CODES.includes(code);

    const [res] = await conn.query(
        `UPDATE lendon
            SET statuscode = ?, statustext = ?, issue = ?, kg = COALESCE(?, kg),
                jt_weight_reported = CASE WHEN ? IS NULL THEN jt_weight_reported ELSE 1 END,
                last_update = NOW()
          WHERE realorderid = ? AND provider = 'J&T'${terminal ? '' : ` AND statuscode NOT IN (${JT_FINAL_CODES.join(',')})`}`,
        [code, row.scantypename, issue, weight, weight, billCode]
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

async function createPartReturnOrder(billCode, conn) {
    const child = billCode + '-001';
    await conn.query(
        `INSERT INTO lendon
                (name, phone, address, cod, kg, status, date, orderid, realorderid, khid, userid, realfbid, time, provider, sortline, sortcode, statuscode, statustext, useraccountid, last_update, created_by_user_id, created_by_username, jtaccountid, original_kg)
             SELECT p.name, p.phone, p.address, 0, p.kg, p.status, p.date, CONCAT(p.orderid, '-001'), ?, p.khid, p.userid, p.realfbid, NOW(), 'J&T', p.sortline, p.sortcode, 116, 'Đang chuyển hoàn', p.useraccountid, NOW(), p.created_by_user_id, p.created_by_username, p.jtaccountid, p.original_kg
               FROM lendon p
              WHERE p.realorderid = ? AND p.provider = 'J&T'
                AND NOT EXISTS (SELECT 1 FROM lendon c WHERE c.realorderid = ?)
              LIMIT 1`,
        [child, billCode, child]
    );
}

async function createJTOrder(input) {
    let { fbname, address, phone, cod, kg, khid, userid, realfbid, tinh, huyen, xa, accountId, actor } = input || {};

    if (!actor || !actor.id || !actor.username) return { success: false, message: 'Thiếu nhân viên tạo đơn' };
    if (!xa) return { success: false, stage: 'validation', message: 'Chưa có xã/phường J&T. Vui lòng kiểm tra lại địa chỉ.' };
    if (!fbname || !phone || !address) return { success: false, message: 'Thiếu thông tin người nhận!' };

    const codStr = normalizeMoney(cod);
    const hasCod = Number(codStr) > 0;
    const goodsValue = hasCod ? codStr : '100000';
    const weight = parseFloat(kg) || 1;
    const note = JT_ORDER_NOTE;
    const productName = JT_PRODUCT_NAME;
    const txlogisticId = 'DH' + Date.now();
    const timenow = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' });

    let account;
    try {
        account = await shipping.getJTAccount(await shipping.requireDefault('jt'));
    } catch (error) {
        if (!error.shippingConfiguration) throw error;
        return { success: false, stage: 'configuration', message: error.message };
    }

    let body;
    try {
        body = await jtPost('/order/addOrder', {
            txlogisticId,
            productType: 'EXPRESS',
            orderType: '1',
            serviceType: '1',
            partSign: Number(codStr) > 0 ? 1 : 0,
            deliveryType: '1',
            totalQuantity: 1,
            isCallBeforeReturn: 1,
            sender: JT_SENDER,
            receiver: { name: fbname, mobile: phone, prov: tinh, city: huyen, area: xa, address },
            payType: 'PP_PM',
            goodsType: 'bm000010',
            goodsValue,
            ...(hasCod ? { codMoney: codStr } : {}),
            itemsValue: goodsValue,
            remark: note,
            englishName: 'none',
            packageInfo: { weight: weight === 3 ? 2 : weight, length: 10, width: 10, height: 10, volume: '10' },
            items: [{ itemName: productName, englishName: 'None', number: 1, itemValue: goodsValue }]
        }, account);
    } catch (error) {
        console.error('Lỗi Create Order J&T:', error.message);
        const detail = error.response?.data?.message || error.response?.data?.msg || error.message;
        return { success: false, stage: 'carrier_request', message: 'Không hoàn tất yêu cầu tạo đơn J&T: ' + detail, txlogisticId };
    }

    if (!body || body.msg !== 'success') {
        const detail = body?.message || body?.msg || 'Không có chi tiết trong phản hồi';
        const code = typeof body?.code === 'string' || typeof body?.code === 'number' ? ` [${body.code}]` : '';
        return { success: false, stage: 'carrier_response', message: `J&T từ chối tạo đơn${code}: ${detail}`, txlogisticId };
    }
    if (!body.data?.billCode) {
        return { success: false, stage: 'carrier_response', message: 'J&T báo thành công nhưng chưa trả mã vận đơn. Kiểm tra đơn trên J&T trước khi gửi lại.', txlogisticId };
    }

    const sortLine = String(body.data.sortLine || '').slice(0, 45) || null;
    const sortCode = String(body.data.sortingCode || body.data.sortCode || body.data.sortLine || '').slice(0, 100) || null;

    try {
        await DBConnection.query(
            `INSERT INTO lendon
                (name, phone, address, cod, kg, status, date, orderid, realorderid, khid, userid, realfbid, time, provider, sortline, sortcode, statuscode, statustext, useraccountid, last_update, xa, huyen, tinh, created_by_user_id, created_by_username, jtaccountid, original_kg)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'J&T', ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)`,
            [fbname, phone, address, codStr, weight, 1, timenow, txlogisticId, body.data.billCode,
             khid, userid, realfbid, sortLine, sortCode, 100, 'Mới tạo', accountId ?? null,
             xa, huyen, tinh, actor.id, actor.username, account.id, weight]
        );
    } catch (dbErr) {
        console.error(`Lỗi lưu đơn J&T ${body.data.billCode} vào DB:`, dbErr.message);
        const reason = dbErr.code ? ` (${dbErr.code})` : '';
        return { success: false, stage: 'save_order', order_created: true, order_code: body.data.billCode, txlogisticId, message: `J&T đã cấp mã ${body.data.billCode}, nhưng GB chưa lưu được đơn${reason}. Kiểm tra đơn này trước khi tạo lại.` };
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

async function dispatchJTLabel(orderid, userId) {
    const unavailable = { success: false, status: 404, printStatus: 'printer_unavailable', message: 'Chưa thấy kết nối nhận lệnh in cho tài khoản này' };
    let online;
    try { online = isPrinterOnline(userId); }
    catch (error) {
        console.error('Lỗi kết nối dịch vụ in J&T:', error.message);
        return { success: false, status: 503, printStatus: 'print_service_unavailable', message: 'Dịch vụ gửi lệnh in chưa sẵn sàng' };
    }
    if (!online) return unavailable;
    try {
        if (SHIP_LABEL === 'gb') return await printLabelByCode(orderid, userId);
        const order = await loadJTOrder(orderid);
        if (!order) return { success: false, status: 404, printStatus: 'order_not_found', message: 'Không tìm thấy đơn J&T này' };
        const account = await accountForJTOrder(order);
        const body = await jtPost('/order/printOrder', { txlogisticId: order.orderid }, account);
        if (body?.msg === 'success' && body.data?.base64EncodeContent) {
            if (!dispatchPrint(userId, {
                type: 'pdf', base64: body.data.base64EncodeContent,
                config: { printerName: 'HPRT N41', widthMm: 80, heightMm: 80 }
            })) return unavailable;
            return { success: true, printStatus: 'dispatched', message: 'Đã gửi lệnh in tem J&T' };
        }
        console.error(`Lỗi lấy tem J&T (${orderid}):`, body?.msg || 'Thiếu PDF');
        return { success: false, status: 502, printStatus: 'label_error', message: 'J&T chưa trả về file tem' };
    } catch (error) {
        console.error(`Lỗi xử lý tem J&T (${orderid}):`, error.message);
        return { success: false, status: 502, printStatus: 'label_error', message: 'Không thể chuẩn bị hoặc gửi tem J&T. Hãy thử in lại.' };
    }
}

async function GetBillJT(orderid, userId) {
    return (await dispatchJTLabel(orderid, userId)).success;
}

async function reprintBillJT(code, userId) {
    code = String(code || '').trim();
    if (!code) return { success: false, status: 400, message: 'Thiếu mã đơn' };

    const order = await loadJTOrder(code);
    if (!order) return { success: false, status: 404, message: 'Không tìm thấy đơn J&T này' };
    return dispatchJTLabel(order.orderid, userId);
}

async function traceJT(billCode) {
    const order = await loadJTOrder(billCode);
    if (!order) return { ok: false, message: 'Không tìm thấy đơn J&T này' };
    const account = await accountForJTOrder(order);
    const body = await jtPost('/logistics/trace', { billCodes: billCode, txlogisticId: '' }, account, 10000);
    if (String(body?.code) !== '1') {
        return { ok: false, message: body?.msg || 'J&T chưa trả hành trình cho đơn này.' };
    }
    const shipments = Array.isArray(body.data) ? body.data : [body.data];
    const trace = shipments.find(item => String(item?.billCode ?? '') === billCode);
    const details = readJTDetails(trace?.details);
    if (details.length === 0) return { ok: false, message: 'Chưa có hành trình chi tiết cho đơn này.' };
    return { ok: true, details };
}

async function refreshJTStatus(billCode) {
    billCode = String(billCode || '').trim();
    let trace;
    try {
        trace = await traceJT(billCode);
    } catch (error) {
        console.error('Lỗi Trace J&T:', error.message);
        throw httpError(502, 'Không tải được hành trình hợp lệ từ J&T. Hành trình hiện tại vẫn được giữ.');
    }
    if (!trace.ok) throw httpError(404, trace.message);

    const withSig = await jtHasSigpic();
    const newest = trace.details[trace.details.length - 1];
    const rows = trace.details.map(event => toWaybillRow(billCode, event));
    if (!withSig && rows.some(row => row.sigpic)) {
        throw httpError(503, 'Thiếu cột jtwaybill.sigpic để lưu ảnh POD. Hành trình hiện tại vẫn được giữ.');
    }
    const conn = await DBConnection.getConnection();
    try {
        await conn.beginTransaction();
        if (!await lockJTOrder(conn, billCode)) throw httpError(404, 'Không tìm thấy đơn J&T này');
        const oldRows = await readStoredJTWaybill(conn, billCode, withSig);
        const storedNewest = latestStoredScanEpoch(oldRows);
        if (storedNewest !== null && toEpoch(newest.scanTime) < storedNewest) {
            throw httpError(409, 'J&T chưa trả về mốc mới nhất đang có. Hãy tải lại hành trình sau.');
        }
        const oldEvents = new Map();
        for (const row of oldRows) {
            const key = waybillEventKey(row);
            const previous = oldEvents.get(key);
            oldEvents.set(key, {
                issue: row.issuename || previous?.issue,
                pictures: mergeJTPictures(previous?.pictures, row.sigpic)
            });
        }
        await conn.query('DELETE FROM jtwaybill WHERE billcode = ?', [billCode]);
        for (const row of rows) {
            const previous = oldEvents.get(waybillEventKey(row));
            row.sigpic = mergeJTPictures(row.sigpic, previous?.pictures);
            row.issuename = row.issuename || previous?.issue || null;
            await insertWaybill(conn, row, withSig);
        }
        const st = await applyJTStatus(billCode, newest, conn, rows[rows.length - 1].issuename);
        const [[after]] = await conn.query("SELECT statuscode, statustext FROM lendon WHERE realorderid = ? AND provider = 'J&T' LIMIT 1", [billCode]);
        await conn.commit();
        return {
            changed: !!st.changed,
            statuscode: Number(after.statuscode),
            statustext: after.statustext,
            isFinal: JT_FINAL_CODES.includes(Number(after.statuscode)),
            logCount: rows.length
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = {
    CancelOrderJT, GetBillJT, dispatchJTLabel, reprintBillJT,
    createJTOrder, traceJT, refreshJTStatus,
    JT_FINAL_CODES, jtHasSigpic, isPartReturnBill, eventCode, toWaybillRow, toEpoch, formatJTScanTime, readJTDetails,
    insertWaybillIfNew, readStoredJTWaybill, latestStoredScanEpoch, lockJTOrder, applyJTStatus, createPartReturnOrder
};
