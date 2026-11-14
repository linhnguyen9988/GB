'use strict';

const db = require('../configs/DBConnection');
const { GlobalPageID, GlobalPageID2 } = require('../configs/constants');
const { get: getOrderStatus } = require('../public/js/order-status');
const { formatOrderDetailWeight, getJTOrderIssue } = require('../public/js/orderstatusrefresh');
const { customerOrderFilter } = require('../utils/customerOrderFilter');
const { getCarePath } = require('../utils/carePath');

const knownPages = new Set([GlobalPageID, GlobalPageID2]);
const number = new Intl.NumberFormat('vi-VN');
const vietnamDateTime = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'short', timeStyle: 'short'
});

function positiveId(value) {
    const id = String(value ?? '');
    return /^[1-9]\d{0,63}$/.test(id) ? id : null;
}

function presentOrder(row) {
    const waybill = row.realorderid || '';
    const date = row.time ? new Date(row.time) : null;
    return {
        code: waybill || row.orderid,
        internalCode: row.orderid,
        path: getCarePath(waybill || row.orderid),
        journeyCode: getCarePath(waybill) ? waybill : '',
        carrier: row.provider === 'Viettel' || !row.provider ? 'Viettel Post' : row.provider,
        badge: getOrderStatus(row.provider, row.statuscode, row.statustext),
        cod: row.cod == null || row.cod === '' || !Number.isFinite(Number(row.cod)) ? '—' : number.format(row.cod) + ' ₫',
        date: row.date || (date && !Number.isNaN(date.getTime()) ? vietnamDateTime.format(date) : '—'),
        name: row.name,
        phone: row.phone,
        address: row.address,
        userId: positiveId(row.customer_id)
    };
}

async function show(req, res) {
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
    const code = req.params.orderCode;
    const renderError = (status, error) => res.status(status).render('orderCare', { user: req.user, order: null, error });
    if (!getCarePath(code)) return renderError(404, 'Mã đơn hàng không hợp lệ.');

    try {
        const [[row]] = await db.query(
            `SELECT l.*, CAST(l.khid AS CHAR) AS customer_key,
                    CAST(l.userid AS CHAR) AS customer_id, CAST(l.realfbid AS CHAR) AS facebook_id
             FROM lendon l WHERE l.realorderid = ? OR l.orderid = ?
             ORDER BY (l.realorderid = ?) DESC, l.time DESC, l.id DESC LIMIT 1`,
            [code, code, code]
        );
        if (!row) return renderError(404, 'Không tìm thấy đơn hàng với mã này.');

        const key = positiveId(row.customer_key);
        const userId = positiveId(row.customer_id);
        const facebookId = positiveId(row.facebook_id);
        const [[profile]] = await db.query(
            `SELECT CAST(userid AS CHAR) AS customer_id, CAST(realfbid AS CHAR) AS facebook_id,
                    CAST(pageid AS CHAR) AS page_id, fbname, phone, diachi, label, note
             FROM khachhang WHERE id = ? OR userid = ? OR realfbid = ?
             ORDER BY CASE WHEN id = ? THEN 0 WHEN userid = ? THEN 1 ELSE 2 END, id DESC LIMIT 1`,
            [key, userId, facebookId, key, userId]
        );
        const customerId = positiveId(profile?.customer_id) || userId;
        const pageId = knownPages.has(profile?.page_id) ? profile.page_id : null;
        const contactFacebookId = positiveId(profile?.facebook_id) || facebookId;
        let careBusinessUrl = '';
        if (pageId && contactFacebookId) {
            const params = new URLSearchParams({ asset_id: pageId, selected_item_id: contactFacebookId, mailbox_id: '', thread_type: 'FB_MESSAGE' });
            careBusinessUrl = 'https://business.facebook.com/latest/inbox/messenger?' + params;
        }

        const filter = customerOrderFilter(customerId, contactFacebookId);
        const [recentRows] = filter ? await db.query(
            `SELECT l.realorderid, l.orderid, l.name, l.phone, l.provider, l.statuscode, l.statustext, l.cod,
                    l.time, l.date, CAST(l.userid AS CHAR) AS customer_id
             FROM lendon l WHERE ${filter.where} ORDER BY l.time DESC, l.id DESC LIMIT 5`, filter.params
        ) : [[]];

        return res.render('orderCare', {
            user: req.user,
            order: {
                ...presentOrder(row),
                creator: row.created_by_username,
                weight: formatOrderDetailWeight(row),
                issue: getJTOrderIssue(row),
                note: row.ordernote
            },
            customer: {
                id: customerId, pageId, name: profile?.fbname || row.name || 'Khách hàng',
                pageLabel: pageId === GlobalPageID ? 'Page 1' : pageId === GlobalPageID2 ? 'Page 2' : '',
                phone: profile?.phone || row.phone, address: profile?.diachi || row.address,
                label: profile?.label, note: profile?.note
            },
            recent: recentRows.map(presentOrder),
            careBusinessUrl
        });
    } catch (error) {
        console.error('Lỗi tải trang chăm sóc đơn:', error.code || error.message);
        return renderError(500, 'Không tải được thông tin đơn hàng. Vui lòng thử lại.');
    }
}

module.exports = { show };
