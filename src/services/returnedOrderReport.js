'use strict';

const db = require('../configs/DBConnection');
const DAY_MS = 86400000;
const PAGE_SIZE = 50;
const PATH = '/admin/returned-orders';

function vnDay(now = Date.now()) {
    return new Date(Number(now) + 7 * 3600000).toISOString().slice(0, 10);
}

function validDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const epoch = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === value;
}

function shiftDay(day, delta) {
    return new Date(Date.parse(day + 'T00:00:00Z') + delta * DAY_MS).toISOString().slice(0, 10);
}

function filters(query, now) {
    const today = vnDay(now);
    const from = query.from || shiftDay(today, -9);
    const to = query.to || today;
    if (!validDay(from) || !validDay(to) || from > to ||
        Date.parse(to) - Date.parse(from) > 365 * DAY_MS) {
        throw new Error('Chọn khoảng ngày hợp lệ, tối đa 366 ngày.');
    }
    const day = query.day || today;
    if (!validDay(day)) throw new Error('Ngày xem chi tiết không hợp lệ.');
    const carrier = ['jt', 'viettel'].includes(query.carrier) ? query.carrier : '';
    const page = Number(query.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new Error('Trang không hợp lệ.');
    return { today, from, to, day: day < from || day > to ? to : day, carrier, page };
}

// Both sources store carrier event times in Vietnam local time. Do not use
// last_update: POD/weight updates and late webhooks can change it independently.
// Group by waybill so duplicate webhooks/order rows never inflate the count.
const RETURNS_SQL = `
    SELECT 'jt' AS carrier, l.realorderid AS billcode,
           MAX(l.name) AS name, MAX(l.phone) AS phone,
           MAX(l.statuscode) AS statuscode, MAX(l.statustext) AS statustext,
           MAX(CASE WHEN j.scantypecode = l.statuscode THEN j.scantime END) AS final_at,
           CASE WHEN l.realorderid LIKE '%-001' THEN 1 ELSE 0 END AS partial
      FROM lendon l INNER JOIN jtwaybill j ON j.billcode = l.realorderid
     WHERE l.provider = 'J&T' AND l.statuscode IN (117, 121)
     GROUP BY l.realorderid
    HAVING MAX(CASE WHEN j.scantypecode = 117 THEN j.scantime END) IS NOT NULL
       AND (MAX(CASE WHEN j.scantypecode = 113 THEN j.scantime END) IS NULL
         OR MAX(CASE WHEN j.scantypecode = 117 THEN j.scantime END)
            >= MAX(CASE WHEN j.scantypecode = 113 THEN j.scantime END))
    UNION ALL
    SELECT 'viettel' AS carrier, l.realorderid AS billcode,
           MAX(l.name) AS name, MAX(l.phone) AS phone,
           MAX(l.statuscode) AS statuscode, MAX(l.statustext) AS statustext,
           MAX(STR_TO_DATE(v.status_date_raw, '%d/%m/%Y %H:%i:%s')) AS final_at,
           CASE WHEN l.realorderid REGEXP '1[Pp][0-9]+$' THEN 1 ELSE 0 END AS partial
      FROM lendon l INNER JOIN order_logs v ON v.order_number = l.realorderid
     WHERE (l.provider = 'Viettel' OR l.provider IS NULL OR l.provider = '')
       AND l.statuscode = 504 AND v.status_code = 504
     GROUP BY l.realorderid`;

function url(filter, changes = {}) {
    const values = { from: filter.from, to: filter.to, carrier: filter.carrier, day: filter.day, ...changes };
    return PATH + '?' + new URLSearchParams(values).toString();
}

async function load(filter) {
    const condition = `final_at >= ? AND final_at < ?${filter.carrier ? ' AND carrier = ?' : ''}`;
    const params = [filter.from + ' 00:00:00', shiftDay(filter.to, 1) + ' 00:00:00'];
    if (filter.carrier) params.push(filter.carrier);
    const [summary] = await db.query(`
        SELECT DATE_FORMAT(final_at, '%Y-%m-%d') AS day, COUNT(*) AS total,
               SUM(carrier = 'jt') AS jt, SUM(carrier = 'viettel') AS viettel,
               SUM(partial) AS partial
          FROM (${RETURNS_SQL}) r WHERE ${condition}
         GROUP BY DATE_FORMAT(final_at, '%Y-%m-%d') ORDER BY day DESC`, params);
    const byDay = new Map(summary.map(row => [row.day, row]));
    const days = [];
    const totals = { total: 0, jt: 0, viettel: 0, partial: 0 };
    for (let day = filter.to; day >= filter.from; day = shiftDay(day, -1)) {
        const raw = byDay.get(day) || {};
        const row = { day };
        for (const key of Object.keys(totals)) {
            row[key] = Number(raw[key] || 0);
            totals[key] += row[key];
        }
        days.push(row);
    }
    const detailParams = [filter.day + ' 00:00:00', shiftDay(filter.day, 1) + ' 00:00:00'];
    if (filter.carrier) detailParams.push(filter.carrier);
    const [orders] = await db.query(`
        SELECT carrier, billcode, name, phone, statuscode, statustext, partial,
               DATE_FORMAT(final_at, '%d/%m/%Y %H:%i:%s') AS final_time
          FROM (${RETURNS_SQL}) r WHERE ${condition}
         ORDER BY final_at DESC, carrier, billcode LIMIT ? OFFSET ?`,
    [...detailParams, PAGE_SIZE + 1, (filter.page - 1) * PAGE_SIZE]);
    return { days, totals, orders: orders.slice(0, PAGE_SIZE), hasNext: orders.length > PAGE_SIZE };
}

module.exports = { filters, load, url, vnDay, shiftDay, RETURNS_SQL, PAGE_SIZE };
