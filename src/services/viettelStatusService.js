const DBConnection = require('../configs/DBConnection');
const axios = require('axios');

const VIETTEL_DETAIL_URL = 'https://partner.viettelpost.vn/v2/order/detail-v2';

const FINAL_STATUSES = new Set([101, 107, 201, 501, 503, 504]);

const COOLDOWN_MS = 5000;
const recentResults = new Map();

class StatusRefreshError extends Error {
    constructor(message, httpStatus) {
        super(message);
        this.httpStatus = httpStatus;
    }
}

async function fetchViettelOrderStatus(orderNumber) {
    const [tokens] = await DBConnection.query('SELECT token FROM vietteltoken LIMIT 1');
    if (!tokens.length || !tokens[0].token) {
        throw new StatusRefreshError('Không tìm thấy Viettel token', 404);
    }

    let response;
    try {
        response = await axios.get(VIETTEL_DETAIL_URL, {
            params: { o: orderNumber },
            headers: { accept: '*/*', Token: tokens[0].token },
            timeout: 10000,
            validateStatus: () => true
        });
    } catch (err) {
        console.error('[viettel-status] Lỗi kết nối Viettel:', err.message);
        throw new StatusRefreshError('Không kết nối được Viettel, thử lại sau', 502);
    }

    const body = response.data;
    if (response.status !== 200 || !body || body.error || !body.data) {
        const apiMessage = body && body.message ? String(body.message).slice(0, 200) : `HTTP ${response.status}`;
        console.error('[viettel-status] Viettel trả lỗi cho đơn', orderNumber, '-', apiMessage);
        throw new StatusRefreshError('Viettel không trả về trạng thái đơn: ' + apiMessage, 502);
    }

    const status = parseInt(body.data.ORDER_STATUS, 10);
    if (Number.isNaN(status)) {
        throw new StatusRefreshError('Viettel trả về dữ liệu không có ORDER_STATUS', 502);
    }
    return status;
}

async function getStatusText(statusCode) {
    const [logRows] = await DBConnection.query(
        "SELECT status_name FROM order_logs WHERE status_code = ? AND status_name IS NOT NULL AND status_name <> '' LIMIT 1",
        [statusCode]);
    if (logRows.length) return logRows[0].status_name;

    const [orderRows] = await DBConnection.query(
        "SELECT statustext FROM lendon WHERE statuscode = ? AND statustext IS NOT NULL AND statustext <> '' LIMIT 1",
        [statusCode]);
    if (orderRows.length) return orderRows[0].statustext;

    return 'Trạng thái ' + statusCode;
}

async function refreshOrderStatus(orderNumber) {
    const cached = recentResults.get(orderNumber);
    if (cached && Date.now() - cached.at < COOLDOWN_MS) {
        return { ...cached.result, cached: true };
    }

    const [orders] = await DBConnection.query(
        'SELECT realorderid, provider, statuscode, statustext FROM lendon WHERE realorderid = ? LIMIT 1',
        [orderNumber]);
    if (!orders.length) throw new StatusRefreshError('Không tìm thấy đơn hàng', 404);

    const order = orders[0];
    if ((order.provider || 'Viettel') !== 'Viettel') {
        throw new StatusRefreshError('Chỉ hỗ trợ cập nhật đơn Viettel', 400);
    }
    if (/1P\d+$/i.test(orderNumber)) {
        throw new StatusRefreshError('Đơn hoàn 1 phần chưa hỗ trợ cập nhật trạng thái', 400);
    }

    const current = parseInt(order.statuscode, 10) || 0;
    if (FINAL_STATUSES.has(current)) {
        return { statuscode: current, statustext: order.statustext, changed: false, isFinal: true };
    }

    let status = await fetchViettelOrderStatus(orderNumber);
    if (status === -108) status = 100;

    let result;
    if (status === current) {
        result = { statuscode: current, statustext: order.statustext, changed: false, isFinal: FINAL_STATUSES.has(current) };
    } else {
        const statustext = await getStatusText(status);
        await DBConnection.query(
            'UPDATE lendon SET statuscode = ?, statustext = ?, last_update = NOW() WHERE realorderid = ?',
            [status, statustext, orderNumber]);
        console.log(`[viettel-status] Đơn ${orderNumber}: ${current} -> ${status} (${statustext})`);
        result = { statuscode: status, statustext, changed: true, isFinal: FINAL_STATUSES.has(status) };
    }

    if (recentResults.size > 500) recentResults.clear();
    recentResults.set(orderNumber, { at: Date.now(), result });
    return result;
}

module.exports = { refreshOrderStatus, StatusRefreshError, FINAL_STATUSES };
