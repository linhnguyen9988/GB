'use strict';

const report = require('../services/returnedOrderReport');

async function show(req, res) {
    res.set('Cache-Control', 'no-store');
    let filter;
    try {
        filter = report.filters(req.query);
    } catch (error) {
        return res.status(400).send(error.message);
    }
    const view = {
        user: req.user, ...filter, url: changes => report.url(filter, changes),
        yesterday: report.shiftDay(filter.today, -1), pageSize: report.PAGE_SIZE
    };
    try {
        const data = await report.load(filter);
        return res.render('adminReturnedOrders', { ...view, ...data, error: null });
    } catch (error) {
        console.error('[Báo cáo hoàn hàng]', error.code || error.message);
        return res.status(500).render('adminReturnedOrders', {
            ...view, days: [], totals: {}, orders: [], hasNext: false,
            error: 'Không tải được báo cáo hoàn hàng. Vui lòng thử lại.'
        });
    }
}

module.exports = { show };
