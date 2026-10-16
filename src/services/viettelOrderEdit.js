'use strict';

const VIETTEL_BASE = 'https://partner.viettelpost.vn';
const DEFAULT_ORDER_NOTE = 'Ko giao được gọi shop. Cho xem hàng. Ko nhận hàng thu 30k';
const MAX_COD = 100000000;
const MAX_KG = 100;
const MAX_NOTE_LEN = 150;
const NEW_ORDER_GRACE_MS = 3 * 24 * 3600 * 1000;

const FIELD_LABELS = {
    name: 'Họ tên',
    phone: 'Số điện thoại',
    address: 'Địa chỉ',
    cod: 'Tiền COD',
    kg: 'Trọng lượng',
    note: 'Ghi chú'
};

const PHASES = {
    full: { label: 'Chờ lấy hàng / đã tiếp nhận', fields: ['name', 'phone', 'address', 'cod', 'kg', 'note'] },
    transit: { label: 'Đã lấy hàng / đang vận chuyển', fields: ['name', 'phone', 'cod', 'note'] },
    delivering: { label: 'Đang giao hàng', fields: ['name', 'phone', 'address', 'cod', 'note'] },
    none: { label: 'Không thể sửa', fields: [] }
};
const PHASE_RANK = { full: 1, transit: 2, delivering: 3 };

const FULL_CODES = new Set([-110, -109, -108, -100, 100, 102, 103, 104, 106]);
const TRANSIT_CODES = new Set([105, 200, 300, 301, 302, 303, 400, 401, 402, 403, 509]);
const DELIVERING_CODES = new Set([500, 508, 550, 505, 506, 507]); 
const AMBIGUOUS_CODES = new Set([202]); 
const HARD_FINAL = new Set([101, 107, 201, 501, 503, 504]);

const BLOCKED_REASONS = new Map([
    [101, 'Đơn đã hủy'], [107, 'Đơn đã hủy'], [201, 'Đơn đã hủy'], [503, 'Đơn đã hủy'],
    [510, 'Đơn đã hủy giao hàng'],
    [501, 'Đơn đã giao thành công'],
    [504, 'Đơn đã hoàn thành công'],
    [502, 'Đơn đang chuyển hoàn'], [515, 'Đơn đang chuyển hoàn'], [551, 'Đơn đang chuyển hoàn']
]);

function phaseOfCode(code) {
    if (FULL_CODES.has(code)) return 'full';
    if (TRANSIT_CODES.has(code)) return 'transit';
    if (DELIVERING_CODES.has(code)) return 'delivering';
    return null;
}

function blocked(reason, extra) {
    return Object.assign({ level: 'none', editable: false, fields: [], label: PHASES.none.label, reason, notices: [] }, extra || {});
}

function resolveEditPolicy(o) {
    const now = o.now instanceof Date ? o.now : new Date();
    const notices = [];

    if (String(o.provider || '').toLowerCase() !== 'viettel') return blocked('Không phải đơn Viettel Post');
    if (/1P\d+$/i.test(String(o.realorderid || ''))) return blocked('Đơn hoàn 1 phần không được sửa');

    let level = null;
    const raw = o.statuscode;

    if (raw === null || raw === undefined || raw === '') {
        const created = o.createdAt ? new Date(o.createdAt) : null;
        if (created && !isNaN(created) && now - created <= NEW_ORDER_GRACE_MS) {
            level = 'full';
            notices.push('Đơn chưa nhận trạng thái từ Viettel, coi như mới tạo.');
        } else {
            return blocked('Đơn chưa có trạng thái từ Viettel và đã tạo lâu, không thể sửa');
        }
    } else {
        const code = Number(raw);
        if (BLOCKED_REASONS.has(code)) return blocked(BLOCKED_REASONS.get(code));
        if (AMBIGUOUS_CODES.has(code)) {
            const logs = (o.logCodes || []).map(Number);
            if (logs.some(c => HARD_FINAL.has(c))) return blocked('Đơn đã kết thúc (hủy / giao xong / hoàn xong)');
            let best = 0;
            logs.forEach(c => { const p = phaseOfCode(c); if (p && PHASE_RANK[p] > best) best = PHASE_RANK[p]; });
            level = best ? Object.keys(PHASE_RANK).find(k => PHASE_RANK[k] === best) : 'transit';
            if (!best) notices.push('Không có lịch sử trạng thái, áp dụng quyền sửa của nhóm "đang vận chuyển".');
        } else {
            level = phaseOfCode(code);
            if (!level) return blocked('Trạng thái ' + code + (o.statustext ? ' (' + o.statustext + ')' : '') + ' chưa được hỗ trợ sửa');
        }
    }

    let fields = PHASES[level].fields.slice();
    if (o.noteSupported === false) {
        fields = fields.filter(f => f !== 'note');
        notices.push('Chưa sửa được ghi chú: bảng lendon chưa có cột ordernote (xem file migration).');
    }
    return { level, editable: true, fields, label: PHASES[level].label, reason: null, notices };
}

const CTRL = /[\u0000-\u001F\u007F]/g;

function cleanText(v) { return String(v === null || v === undefined ? '' : v).replace(CTRL, ' ').trim(); }

function normalizePhone(v) {
    let s = String(v === null || v === undefined ? '' : v).replace(/[\s.\-()]/g, '');
    if (/^\+84\d{9,10}$/.test(s)) s = '0' + s.slice(3);
    else if (/^84\d{9,10}$/.test(s)) s = '0' + s.slice(2);
    return s;
}

function parseCod(v) {
    const s = String(v === null || v === undefined ? '' : v).trim();
    if (!/^[\d.,\s]+(đ|₫|vnd)?$/i.test(s)) return { error: 'Tiền COD không hợp lệ' };
    const n = Number(s.replace(/\D/g, ''));
    if (!Number.isFinite(n)) return { error: 'Tiền COD không hợp lệ' };
    if (n > MAX_COD) return { error: 'Tiền COD vượt mức cho phép (' + MAX_COD.toLocaleString('vi-VN') + ' đ)' };
    return { value: n };
}

function parseKg(v) {
    const n = Number(String(v === null || v === undefined ? '' : v).trim().replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return { error: 'Số ký phải lớn hơn 0' };
    if (n > MAX_KG) return { error: 'Số ký vượt mức cho phép (' + MAX_KG + ' kg)' };
    return { value: Math.round(n * 100) / 100 };
}

function toViettelWeight(kgInput) {
    let kg = parseFloat(kgInput) * 1000;
    if (kg <= 1000) kg = 500;
    else if (kg <= 2000) kg = 1000;
    else if (kg <= 3000) kg = 1500;
    else if (kg <= 4000) kg = 2000;
    else if (kg <= 6000) kg = kg - 2000;
    else if (kg <= 9000) kg = kg - 3000;
    else if (kg <= 15000) kg = kg - 4000;
    else kg = kg - 5000;
    return kg;
}

function parseField(field, raw) {
    switch (field) {
        case 'name': {
            const v = cleanText(raw).replace(/\s+/g, ' ');
            if (!v) return { error: 'Họ tên không được để trống' };
            if (v.length > 100) return { error: 'Họ tên tối đa 100 ký tự' };
            return { value: v };
        }
        case 'phone': {
            const v = normalizePhone(raw);
            if (!/^0\d{9,10}$/.test(v)) return { error: 'Số điện thoại không hợp lệ' };
            return { value: v };
        }
        case 'address': {
            const v = cleanText(raw).replace(/\s+/g, ' ');
            if (v.length < 10) return { error: 'Địa chỉ quá ngắn (cần ít nhất 10 ký tự)' };
            if (v.length > 255) return { error: 'Địa chỉ tối đa 255 ký tự' };
            return { value: v };
        }
        case 'cod': return parseCod(raw);
        case 'kg': return parseKg(raw);
        case 'note': {
            const v = cleanText(raw);
            if (v.length > MAX_NOTE_LEN) return { error: 'Ghi chú tối đa ' + MAX_NOTE_LEN + ' ký tự' };
            return { value: v };
        }
        default: return { error: 'Trường không hợp lệ' };
    }
}

function normalizeOriginal(order, noteSupported) {
    return {
        name: cleanText(order.name).replace(/\s+/g, ' '),
        phone: normalizePhone(order.phone),
        address: cleanText(order.address).replace(/\s+/g, ' '),
        cod: Number(order.cod) || 0,
        kg: Number(order.kg) || 0,
        note: noteSupported && order.ordernote !== null && order.ordernote !== undefined
            ? cleanText(order.ordernote) : DEFAULT_ORDER_NOTE
    };
}

function validateEditInput(policy, original, input) {
    const values = Object.assign({}, original);
    const errors = [];
    const forbidden = [];
    const changed = [];
    input = input || {};

    Object.keys(FIELD_LABELS).forEach(field => {
        if (input[field] === undefined) return;
        const allowed = policy.fields.indexOf(field) !== -1;
        const parsed = parseField(field, input[field]);

        if (!allowed) {
            if (parsed.error || parsed.value !== original[field]) forbidden.push(field);
            return;
        }
        if (parsed.error) { errors.push(FIELD_LABELS[field] + ': ' + parsed.error); return; }
        values[field] = parsed.value;
        if (parsed.value !== original[field]) changed.push(field);
    });

    return { values, errors, forbidden, changed };
}

function buildEditPayload(p) {
    const v = p.values;
    return {
        "ORDER_NUMBER": p.orderNumber,
        "GROUPADDRESS_ID": 23832621,
        "CUS_ID": p.cusid,
        "SENDER_FULLNAME": "Áo dài Gia Bảo",
        "SENDER_ADDRESS": "862, ĐƯỜNG Đoàn Văn Cự, P.Tam Hiệp, TP.Biên Hòa, T.Đồng Nai",
        "SENDER_PHONE": p.senderphone,
        "RECEIVER_FULLNAME": v.name,
        "RECEIVER_ADDRESS": p.receiverAddress,
        "RECEIVER_PHONE": v.phone,
        "PRODUCT_NAME": "Vải",
        "PRODUCT_DESCRIPTION": "Vải",
        "PRODUCT_QUANTITY": 1,
        "PRODUCT_PRICE": v.cod,
        "PRODUCT_WEIGHT": toViettelWeight(v.kg),
        "PRODUCT_LENGTH": 1, "PRODUCT_WIDTH": 1, "PRODUCT_HEIGHT": 1,
        "PRODUCT_TYPE": "HH",
        "ORDER_PAYMENT": v.cod > 0 ? 3 : 1,
        "ORDER_SERVICE": "VSL7",
        "ORDER_SERVICE_ADD": "GNG",
        "ORDER_NOTE": v.note,
        "MONEY_COLLECTION": v.cod,
        "IS_ADDRESS_NEW": false
    };
}

async function getViettelAuth(db) {
    const [rows] = await db.query('SELECT * FROM vietteltoken');
    if (!rows || rows.length === 0) return null;
    return { token: rows[0].token, cusid: rows[0].userid, senderphone: rows[0].senderphone };
}

async function resolveAddress(axios, token, rawAddress, preprocess) {
    const sent = preprocess ? preprocess(rawAddress) : rawAddress;
    const headers = { 'Content-Type': 'application/json', token };
    let body;
    try {
        const nlp = await axios.post(VIETTEL_BASE + '/v2/order/getPriceAllNlp', {
            "SENDER_ADDRESS": "Long Bình, biên Hòa, Đồng Nai",
            "RECEIVER_ADDRESS": sent,
            "PRODUCT_TYPE": "HH",
            "PRODUCT_WEIGHT": 100,
            "TYPE": 1
        }, { headers, timeout: 15000 });
        body = nlp && nlp.data;
    } catch (e) {
        return { ok: false, message: 'Không gọi được Viettel để kiểm tra địa chỉ, thử lại sau' };
    }
    if (!body || body.error === true || !body.RECEIVER_ADDRESS) {
        return { ok: false, message: 'Viettel không nhận diện được địa chỉ này' };
    }

    const r = body.RECEIVER_ADDRESS;
    const get = (url) => axios.get(url, { timeout: 15000 }).then(x => x.data).catch(() => null);
    const wardOk = !!(r.WARD_ID && Number(r.WARD_ID) !== 0);
    const [tj, hj, xj] = await Promise.all([
        r.PROVINCE_ID ? get(VIETTEL_BASE + '/v2/categories/listProvinceById?provinceId=' + r.PROVINCE_ID) : null,
        r.DISTRICT_ID ? get(VIETTEL_BASE + '/v2/categories/districtByIdAndProvince?districtId=' + r.DISTRICT_ID + '&provinceById=' + r.PROVINCE_ID) : null,
        wardOk ? get(VIETTEL_BASE + '/v2/categories/wardByDistrictAndId?districtId=' + r.DISTRICT_ID + '&wardsId=' + r.WARD_ID) : null
    ]);
    const tinh = (tj && tj.data && tj.data[0]) ? tj.data[0].PROVINCE_NAME : '';
    const huyen = (hj && hj.data) ? hj.data.DISTRICT_NAME : '';

    if (!wardOk) return { ok: false, message: 'Không nhận diện được Xã/Phường', huyen, tinh };
    if (xj && xj.message && String(xj.message).includes('No suitable data found')) {
        return { ok: false, message: 'Thông tin phường đã thay đổi, cần lên đơn tay', huyen, tinh };
    }
    const xa = (xj && xj.data) ? xj.data.WARDS_NAME : '';
    if (!xa) return { ok: false, message: 'Không nhận diện được Xã/Phường', huyen, tinh };

    return { ok: true, xa, huyen, tinh, adx: xa + ', ' + huyen + ', ' + tinh, sentAddress: sent };
}

async function hasNoteColumn(db) {
    try {
        const [r] = await db.query(
            "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'lendon' AND COLUMN_NAME = 'ordernote' LIMIT 1");
        return r.length > 0;
    } catch (e) { return false; }
}

async function loadOrder(db, realorderid) {
    const [rows] = await db.query('SELECT * FROM lendon WHERE realorderid = ? LIMIT 1', [realorderid]);
    if (!rows || rows.length === 0) return null;
    const order = rows[0];
    let logCodes = [];
    try {
        const [logs] = await db.query('SELECT DISTINCT status_code FROM order_logs WHERE order_number = ?', [realorderid]);
        logCodes = (logs || []).map(l => Number(l.status_code));
    } catch (e) {}
    return { order, logCodes };
}

const ID_RE = /^[A-Za-z0-9_-]{4,40}$/;
function cleanId(v) { const s = String(v === null || v === undefined ? '' : v).trim(); return ID_RE.test(s) ? s : null; }
function fail(status, message, extra) { return { status, json: Object.assign({ success: false, message }, extra || {}) }; }

function policyFor(order, logCodes, noteSupported) {
    return resolveEditPolicy({
        provider: order.provider, realorderid: order.realorderid,
        statuscode: order.statuscode, statustext: order.statustext,
        createdAt: order.time, logCodes, noteSupported
    });
}

async function getEditInfo({ db, realorderid }) {
    const id = cleanId(realorderid);
    if (!id) return fail(400, 'Mã đơn không hợp lệ');
    const ctx = await loadOrder(db, id);
    if (!ctx) return fail(404, 'Không tìm thấy đơn hàng');
    const noteSupported = await hasNoteColumn(db);
    const policy = policyFor(ctx.order, ctx.logCodes, noteSupported);
    const o = normalizeOriginal(ctx.order, noteSupported);
    return {
        status: 200,
        json: {
            success: true,
            order: {
                realorderid: ctx.order.realorderid,
                orderid: ctx.order.orderid,
                name: o.name, phone: o.phone, address: o.address,
                cod: o.cod, kg: o.kg, note: o.note,
                statuscode: ctx.order.statuscode, statustext: ctx.order.statustext || '',
                sortcode: ctx.order.sortcode || ''
            },
            policy
        }
    };
}

async function checkAddress({ db, axios, address, preprocess }) {
    const v = parseField('address', address);
    if (v.error) return fail(400, v.error);
    const auth = await getViettelAuth(db);
    if (!auth) return fail(500, 'Không tìm thấy token Viettel');
    const r = await resolveAddress(axios, auth.token, v.value, preprocess);
    if (!r.ok) return { status: 200, json: { success: true, ok: false, message: r.message, huyen: r.huyen || '', tinh: r.tinh || '' } };
    return { status: 200, json: { success: true, ok: true, xa: r.xa, huyen: r.huyen, tinh: r.tinh, adx: r.adx } };
}

async function editOrder({ db, axios, realorderid, input, preprocess }) {
    const id = cleanId(realorderid);
    if (!id) return fail(400, 'Mã đơn không hợp lệ');

    const ctx = await loadOrder(db, id);
    if (!ctx) return fail(404, 'Không tìm thấy đơn hàng');

    const noteSupported = await hasNoteColumn(db);
    const policy = policyFor(ctx.order, ctx.logCodes, noteSupported);
    if (!policy.editable) return fail(403, policy.reason);

    const original = normalizeOriginal(ctx.order, noteSupported);
    const v = validateEditInput(policy, original, input);
    if (v.forbidden.length) {
        return fail(403, 'Ở trạng thái "' + policy.label + '" không được sửa: ' + v.forbidden.map(f => FIELD_LABELS[f]).join(', '));
    }
    if (v.errors.length) return fail(400, v.errors.join('. '), { errors: v.errors });
    if (v.changed.length === 0) return fail(400, 'Không có thay đổi nào để lưu');

    const auth = await getViettelAuth(db);
    if (!auth) return fail(500, 'Không tìm thấy token Viettel');

    let receiverAddress = v.values.address;
    if (v.changed.includes('address')) {
        const a = await resolveAddress(axios, auth.token, v.values.address, preprocess);
        if (!a.ok) return fail(422, 'Địa chỉ chưa hợp lệ: ' + a.message);
        receiverAddress = a.sentAddress;
    } else if (preprocess) {
        receiverAddress = preprocess(v.values.address);
    }

    const payload = buildEditPayload({
        orderNumber: ctx.order.realorderid, cusid: auth.cusid, senderphone: auth.senderphone,
        values: v.values, receiverAddress
    });

    let body;
    try {
        const resp = await axios.post(VIETTEL_BASE + '/v2/order/edit', payload,
            { headers: { 'Content-Type': 'application/json', token: auth.token }, timeout: 20000 });
        body = resp.data;
    } catch (e) {
        const msg = (e.response && e.response.data && e.response.data.message) || 'Lỗi kết nối Viettel';
        return fail(502, msg);
    }
    if (!body || body.error === true || body.status !== 200) {
        return fail(422, (body && body.message) || 'Viettel từ chối chỉnh sửa đơn');
    }

    const dbSet = {};
    const colOf = { name: 'name', phone: 'phone', address: 'address', cod: 'cod', kg: 'kg', note: 'ordernote' };
    v.changed.forEach(f => { dbSet[colOf[f]] = v.values[f]; });
    const vo = body.data || {};
    const warnings = [];
    if (vo.SORT_CODE) dbSet.sortcode = vo.SORT_CODE;
    if (v.changed.includes('address') && vo.RECEIVER_WARDS !== undefined && (!vo.RECEIVER_WARDS || vo.RECEIVER_WARDS == 0)) {
        warnings.push('Viettel không trả về Xã/Phường cho địa chỉ mới, hãy kiểm tra lại trên Viettel.');
    }
    try {
        await db.query('UPDATE lendon SET ?, last_update = NOW() WHERE realorderid = ?', [dbSet, ctx.order.realorderid]);
    } catch (e) {
        console.error('[editOrder] Viettel đã sửa nhưng lưu DB lỗi:', e.message);
        warnings.push('Đã sửa trên Viettel nhưng lưu vào hệ thống bị lỗi, dữ liệu tại đây có thể chưa khớp.');
    }

    console.log('[editOrder] ' + ctx.order.realorderid + ' (' + policy.level + ') đã sửa: ' + v.changed.join(', '));
    return {
        status: 200,
        json: {
            success: true,
            message: body.message || 'Đã cập nhật đơn',
            changed: v.changed,
            warnings,
            order: { realorderid: ctx.order.realorderid, name: v.values.name, phone: v.values.phone, address: v.values.address, cod: v.values.cod, kg: v.values.kg, note: v.values.note }
        }
    };
}

module.exports = {
    DEFAULT_ORDER_NOTE, FIELD_LABELS, PHASES,
    resolveEditPolicy, validateEditInput, normalizeOriginal, toViettelWeight, buildEditPayload,
    resolveAddress, getEditInfo, checkAddress, editOrder
};
