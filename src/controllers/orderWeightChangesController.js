'use strict';

const db = require('../configs/DBConnection');
const { get: getOrderStatus } = require('../public/js/order-status');

const PAGE_SIZE = 50;
const PAGE_PATH = '/admin/order-weight-changes';
const CARRIERS = new Map([['jt', 'J&T'], ['viettel', 'Viettel']]);
const JT_CONVERTED = "provider = 'J&T' AND original_kg = 3";
const DECLARED_KG = `CASE WHEN ${JT_CONVERTED} THEN 2 ELSE original_kg END`;

async function show(req, res) {
    const carrier = CARRIERS.has(req.query.carrier) ? req.query.carrier : '';
    const allTime = req.query.period === 'all';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 64) : '';
    const requestedPage = typeof req.query.page === 'string' ? Number(req.query.page) : 1;
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 &&
        requestedPage <= Math.floor(Number.MAX_SAFE_INTEGER / PAGE_SIZE) ? requestedPage : 1;

    const filters = [
        "provider IN ('J&T', 'Viettel')",
        'original_kg > 0',
        'kg > 0',
        `ABS(kg - (${DECLARED_KG})) > 0.000001`,
        `NOT (${JT_CONVERTED} AND kg = 3 AND jt_weight_reported = 0)`
    ];
    if (!allTime) filters.push('COALESCE(last_update, time) >= DATE_SUB(NOW(), INTERVAL 10 DAY)');
    const params = [];
    if (carrier) {
        filters.push('provider = ?');
        params.push(CARRIERS.get(carrier));
    }
    if (search) {
        filters.push("(realorderid LIKE ? ESCAPE '!' OR orderid LIKE ? ESCAPE '!')");
        const pattern = '%' + search.replace(/[!%_]/g, '!$&') + '%';
        params.push(pattern, pattern);
    }
    params.push(PAGE_SIZE + 1, (page - 1) * PAGE_SIZE);

    const pageUrl = number => {
        const query = new URLSearchParams({ page: String(number) });
        if (carrier) query.set('carrier', carrier);
        if (allTime) query.set('period', 'all');
        if (search) query.set('search', search);
        return PAGE_PATH + '?' + query.toString();
    };

    res.set('Cache-Control', 'no-store');
    const view = { user: req.user, carrier, search, allTime, page, getOrderStatus, previous: page > 1 ? pageUrl(page - 1) : null };
    try {
        const [rows] = await db.query(
            `SELECT realorderid, orderid, name, provider, original_kg, ${DECLARED_KG} AS declared_kg, kg, statuscode, statustext,
                    COALESCE(last_update, time) AS updated_at
               FROM lendon
              WHERE ${filters.join(' AND ')}
              ORDER BY COALESCE(last_update, time) DESC, id DESC
              LIMIT ? OFFSET ?`,
            params
        );
        return res.render('adminOrderWeightChanges', {
            ...view,
            orders: rows.slice(0, PAGE_SIZE),
            next: rows.length > PAGE_SIZE ? pageUrl(page + 1) : null,
            error: null
        });
    } catch (error) {
        console.error('Lỗi tải đối chiếu cân nặng:', error.code || error.message);
        return res.status(500).render('adminOrderWeightChanges', {
            ...view, orders: [], next: null, error: 'Không tải được danh sách cân nặng. Vui lòng thử lại.'
        });
    }
}

module.exports = { show };
