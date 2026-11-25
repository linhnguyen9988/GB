'use strict';

// Prices in livecomment are entered in thousands of dong, as on the closing form.
function buildReport(rows) {
    const customers = new Map();
    const total = { customers: 0, codes: 0, quantity: 0, amount: 0 };
    for (const row of rows) {
        const uid = String(row.userid);
        if (!customers.has(uid)) customers.set(uid, {
            userid: uid, khid: row.khid, name: row.customer_name || row.name || uid,
            phone: row.phone || '', codes: 0, quantity: 0, amount: 0, items: []
        });
        const customer = customers.get(uid);
        const prices = [];
        for (const [priceValue, quantityValue] of [[row.gia, row.slchot], [row.gia2, row.slchot2]]) {
            if (priceValue == null || String(priceValue).trim() === '') continue;
            const price = Number(priceValue);
            if (!Number.isFinite(price) || price < 0) continue;
            const parsedQuantity = Number(quantityValue);
            const quantity = Number.isSafeInteger(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
            prices.push({ price: Math.round(price * 1000), quantity });
        }
        const quantity = prices.reduce((sum, p) => sum + p.quantity, 0);
        const amount = prices.reduce((sum, p) => sum + p.price * p.quantity, 0);
        customer.items.push({ commentid: row.commentid, liveid: row.liveid,
            code: row.message || '', printNumber: row.luotin, prices, quantity, amount });
        customer.codes++;
        customer.quantity += quantity;
        customer.amount += amount;
        total.codes++;
        total.quantity += quantity;
        total.amount += amount;
    }
    total.customers = customers.size;
    return { customers: [...customers.values()], total };
}

async function getReport(db, liveIds, userid, hasSecondPrice) {
    const [rows] = await db.query(`
        SELECT CAST(l.userid AS CHAR) AS userid, CAST(l.liveid AS CHAR) AS liveid,
            l.commentid, l.name, l.message, l.luotin, l.gia, l.slchot,
            ${hasSecondPrice ? 'l.gia2, l.slchot2,' : ''}
            k.id AS khid, k.fbname AS customer_name, k.phone
        FROM livecomment l LEFT JOIN khachhang k ON k.userid = l.userid
        WHERE l.liveid IN (?) AND l.chot = ? ${userid ? 'AND l.userid = ?' : ''}
        ORDER BY l.idx ASC`, [liveIds, 'CHỐT', ...(userid ? [userid] : [])]);
    return buildReport(rows);
}

module.exports = { buildReport, getReport };
