'use strict';
const db = require('../configs/DBConnection');
const pickups = require('./pickupOrderReport');
const returns = require('./returnedOrderReport');

async function load(day) {
    const date = returns.filters({ from: day, to: day, day }).day;
    const from = returns.shiftDay(date, -6);
    const filter = { ...returns.filters({ from, to: date, day: date }), page: 1 };
    const results = await Promise.allSettled([
        pickups.load(filter), returns.load(filter),
        db.query(`SELECT carrier, billcode, name, statuscode, statustext, original_cod, cod
            FROM (${pickups.PICKUPS_SQL}) p
            WHERE picked_at >= ? AND picked_at < ? AND original_cod IS NOT NULL AND original_cod <> cod
            ORDER BY picked_at DESC, carrier, billcode LIMIT 5`,
        [date + ' 00:00:00', returns.shiftDay(date, 1) + ' 00:00:00'])
    ]);
    const errors = {};
    const names = ['pickups', 'returns', 'changes'];
    results.forEach((result, index) => {
        if (result.status !== 'rejected') return;
        errors[names[index]] = 'Chưa tải được dữ liệu. Bấm làm mới để thử lại.';
        console.error('[Admin dashboard ' + names[index] + ']', result.reason?.code || result.reason?.message);
    });
    const picked = results[0].status === 'fulfilled' ? results[0].value : null;
    const returned = results[1].status === 'fulfilled' ? results[1].value : null;
    const pickupByDay = new Map((picked?.days || []).map(row => [row.day, row]));
    const returnByDay = new Map((returned?.days || []).map(row => [row.day, row]));
    const days = [];
    for (let cursor = from; cursor <= date; cursor = returns.shiftDay(cursor, 1)) {
        days.push({ day: cursor, pickup: picked ? pickupByDay.get(cursor) : null,
            returned: returned ? returnByDay.get(cursor) : null });
    }
    // Report services supply explicit zero rows; missing source data stays null.
    return {
        day: date, days, errors,
        pickup: picked ? pickupByDay.get(date) : null,
        returned: returned ? returnByDay.get(date) : null,
        pickupOrders: picked?.orders.slice(0, 5) || [],
        returnOrders: returned?.orders.slice(0, 5) || [],
        changedOrders: results[2].status === 'fulfilled' ? results[2].value[0] : []
    };
}

async function overview(req, res) {
    res.set('Cache-Control', 'private, no-store');
    try {
        const day = req.query.day === undefined ? returns.vnDay() : req.query.day;
        if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return res.status(400).json({ message: 'Ngày báo cáo không hợp lệ.' });
        returns.filters({ from: day, to: day, day });
        return res.json(await load(day));
    } catch (error) {
        if (/ngày|Trang/.test(error.message || '')) return res.status(400).json({ message: error.message });
        console.error('[Admin dashboard]', error.code || error.message);
        return res.status(500).json({ message: 'Không tải được tổng quan quản trị.' });
    }
}

async function dayDetails(req, res) {
    res.set('Cache-Control', 'private, no-store');
    const { day, type = 'pickup', carrier = '', page = '1' } = req.query;
    if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
        !['pickup', 'return', 'cod'].includes(type) || !['', 'jt', 'viettel'].includes(carrier)) {
        return res.status(400).json({ message: 'Bộ lọc báo cáo không hợp lệ.' });
    }
    let filter;
    try { filter = returns.filters({ from: day, to: day, day, carrier, page }); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    try {
        if (type !== 'cod') {
            const result = await (type === 'pickup' ? pickups : returns).load(filter);
            return res.json({ day, type, carrier, page: filter.page, summary: result.totals,
                orders: result.orders, hasNext: result.hasNext });
        }
        const where = `picked_at >= ? AND picked_at < ? AND original_cod IS NOT NULL AND original_cod <> cod${carrier ? ' AND carrier = ?' : ''}`;
        const params = [day + ' 00:00:00', returns.shiftDay(day, 1) + ' 00:00:00'];
        if (carrier) params.push(carrier);
        const [[summary]] = await db.query(`SELECT COUNT(*) AS total, SUM(goods) AS goods, SUM(original_cod) AS original_cod, SUM(cod) AS cod,
            SUM(fee) AS fee, SUM(original_cod IS NULL) AS missing_original_cod, SUM(goods IS NULL) AS missing_goods, SUM(cod IS NULL) AS missing_cod,
            SUM(fee IS NULL) AS missing_fee FROM (${pickups.PICKUPS_SQL}) p WHERE ${where}`, params);
        const [orders] = await db.query(`SELECT carrier, billcode, name, phone, statuscode, statustext, goods, original_cod, cod, fee,
            DATE_FORMAT(picked_at, '%d/%m/%Y %H:%i:%s') AS picked_time
            FROM (${pickups.PICKUPS_SQL}) p WHERE ${where}
            ORDER BY picked_at DESC, carrier, billcode LIMIT ? OFFSET ?`,
        [...params, 51, (filter.page - 1) * 50]);
        const totals = Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, Number(value || 0)]));
        return res.json({ day, type, carrier, page: filter.page, summary: totals,
            orders: orders.slice(0, 50), hasNext: orders.length > 50 });
    } catch (error) {
        console.error('[Admin chi tiết ngày]', error.code || error.message);
        return res.status(500).json({ message: 'Không tải được chi tiết ngày. Vui lòng thử lại.' });
    }
}

module.exports = { load, overview, dayDetails };
