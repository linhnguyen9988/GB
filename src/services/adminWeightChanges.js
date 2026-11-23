'use strict';
const db = require('../configs/DBConnection');
const PAGE_SIZE = 50;
const CARRIERS = new Map([['jt', 'J&T'], ['viettel', 'Viettel']]);
const JT_CONVERTED = "provider = 'J&T' AND original_kg = 3";
const DECLARED_KG = `CASE WHEN ${JT_CONVERTED} THEN 2 ELSE original_kg END`;
const CURRENT_KG = `CASE WHEN provider = 'J&T' THEN COALESCE(jt_reported_kg, kg) ELSE kg END`;

function normalizeFilters(query) {
    const carrier = CARRIERS.has(query.carrier) ? query.carrier : '';
    const allTime = query.period === 'all';
    const search = typeof query.search === 'string' ? query.search.trim().slice(0, 64) : '';
    const requestedPage = typeof query.page === 'string' ? Number(query.page) : 1;
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 &&
        requestedPage <= Math.floor(Number.MAX_SAFE_INTEGER / PAGE_SIZE) ? requestedPage : 1;
    return { carrier, allTime, search, page };
}

async function load(query) {
    const { carrier, allTime, search, page } = normalizeFilters(query);
    const filters = [
        "provider IN ('J&T', 'Viettel')",
        'original_kg > 0',
        `(${CURRENT_KG}) > 0`,
        `ABS(CAST((${CURRENT_KG}) AS DECIMAL(18,9)) - CAST((${DECLARED_KG}) AS DECIMAL(18,9)))
            > CASE WHEN provider = 'J&T' THEN 0 ELSE 0.000001 END`,
        `NOT (${JT_CONVERTED} AND (${CURRENT_KG}) = 3 AND jt_weight_reported = 0)`
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


    const [rows] = await db.query(
        `SELECT realorderid, orderid, name, provider, original_kg, ${DECLARED_KG} AS declared_kg, ${CURRENT_KG} AS kg, statuscode, statustext,
                    COALESCE(last_update, time) AS updated_at
               FROM lendon
              WHERE ${filters.join(' AND ')}
              ORDER BY COALESCE(last_update, time) DESC, id DESC
              LIMIT ? OFFSET ?`,
            params
        );
    return { orders: rows.slice(0, PAGE_SIZE), hasNext: rows.length > PAGE_SIZE, carrier, period: allTime ? 'all' : 'recent', search, page };
}

async function list(req, res) {
    res.set('Cache-Control', 'private, no-store');
    try { return res.json(await load(req.query)); }
    catch (error) {
        console.error('[Admin cân nặng]', error.code || error.message);
        return res.status(500).json({ message: 'Không tải được danh sách cân nặng. Bấm tải lại để thử lại.' });
    }
}

module.exports = { normalizeFilters, load, list };
