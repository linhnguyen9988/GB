'use strict';
const db = require('../configs/DBConnection');
const dates = require('./returnedOrderReport');
const PAGE_SIZE = 50;
const PICKUPS_SQL = `
    SELECT 'jt' AS carrier, l.realorderid AS billcode, MAX(l.name) AS name, MAX(l.phone) AS phone,
           MAX(l.statuscode) AS statuscode, MAX(l.statustext) AS statustext,
           MAX(l.goods_value_original) AS goods, MAX(l.cod) AS cod, MAX(l.shipping_fee) AS fee,
           MAX(COALESCE(l.carrier_cod_origin, l.original_cod)) AS original_cod,
           MIN(j.scantime) AS picked_at
      FROM lendon l JOIN jtwaybill j ON j.billcode = l.realorderid
     WHERE l.provider = 'J&T' AND j.scantypecode = 106
     GROUP BY l.realorderid
    UNION ALL
    SELECT 'viettel' AS carrier, l.realorderid AS billcode, MAX(l.name) AS name, MAX(l.phone) AS phone,
           MAX(l.statuscode) AS statuscode, MAX(l.statustext) AS statustext,
           MAX(l.goods_value_original) AS goods, MAX(l.cod) AS cod, MAX(l.shipping_fee) AS fee,
           MAX(COALESCE(l.carrier_cod_origin, l.original_cod)) AS original_cod,
           MIN(STR_TO_DATE(v.status_date_raw, '%d/%m/%Y %H:%i:%s')) AS picked_at
      FROM lendon l JOIN order_logs v ON v.order_number = l.realorderid
     WHERE (l.provider = 'Viettel' OR l.provider IS NULL OR l.provider = '') AND v.status_code = 200
     GROUP BY l.realorderid`;

async function load(filter) {
    const where = `picked_at >= ? AND picked_at < ?${filter.carrier ? ' AND carrier = ?' : ''}`;
    const params = [filter.from + ' 00:00:00', dates.shiftDay(filter.to, 1) + ' 00:00:00'];
    if (filter.carrier) params.push(filter.carrier);
    const [summary] = await db.query(`SELECT DATE_FORMAT(picked_at, '%Y-%m-%d') AS day,
        COUNT(*) AS total, SUM(carrier = 'jt') AS jt, SUM(carrier = 'viettel') AS viettel,
        SUM(goods) AS goods, SUM(original_cod) AS original_cod, SUM(cod) AS cod, SUM(fee) AS fee,
        SUM(goods IS NULL) AS missing_goods, SUM(original_cod IS NULL) AS missing_original_cod, SUM(cod IS NULL) AS missing_cod, SUM(fee IS NULL) AS missing_fee,
        SUM(original_cod IS NOT NULL AND original_cod <> cod) AS changed_cod
        FROM (${PICKUPS_SQL}) p WHERE ${where}
        GROUP BY DATE_FORMAT(picked_at, '%Y-%m-%d') ORDER BY day DESC`, params);
    const keys = ['total', 'jt', 'viettel', 'goods', 'original_cod', 'cod', 'fee', 'missing_original_cod', 'missing_goods', 'missing_cod', 'missing_fee', 'changed_cod'];
    const totals = Object.fromEntries(keys.map(key => [key, 0]));
    const byDay = new Map(summary.map(row => [row.day, row]));
    const days = [];
    for (let day = filter.to; day >= filter.from; day = dates.shiftDay(day, -1)) {
        const row = { day };
        for (const key of keys) { row[key] = Number(byDay.get(day)?.[key] || 0); totals[key] += row[key]; }
        days.push(row);
    }
    const detailParams = [filter.day + ' 00:00:00', dates.shiftDay(filter.day, 1) + ' 00:00:00'];
    if (filter.carrier) detailParams.push(filter.carrier);
    const [orders] = await db.query(`SELECT carrier, billcode, name, phone, statuscode, statustext, goods, cod, fee, original_cod,
        DATE_FORMAT(picked_at, '%d/%m/%Y %H:%i:%s') AS picked_time
        FROM (${PICKUPS_SQL}) p WHERE ${where}
        ORDER BY picked_at DESC, carrier, billcode LIMIT ? OFFSET ?`,
    [...detailParams, PAGE_SIZE + 1, (filter.page - 1) * PAGE_SIZE]);
    return { days, totals, orders: orders.slice(0, PAGE_SIZE), hasNext: orders.length > PAGE_SIZE };
}

module.exports = { filters: dates.filters, shiftDay: dates.shiftDay, load, PICKUPS_SQL };
