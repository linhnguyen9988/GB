'use strict';
const jwtAuth = require('../../middleware/jwtAuth');
const { CancelOrderJT, GetBillJT, reprintBillJT, createJTOrder, refreshJTStatus } = require('../../services/jtExpressService');

module.exports = function registerJtexRoutes(router) {
    router.post('/pushorderjtex', jwtAuth, async function (req, res) {
        const result = await createJTOrder({ ...req.body, accountId: req.user.id, actor: req.user });
        if (!result.success) return res.json({ success: false, message: result.message });

        await GetBillJT(result.txlogisticId, req.user.id);
        return res.json({
            success: true,
            message: result.message,
            order_code: result.order_code,
            sort_line: result.sort_line
        });
    });

    router.post('/printjtex', jwtAuth, async function (req, res) {
        const orderid = String(req.body.orderid || '').trim();
        if (!orderid) return res.status(400).json({ success: false, message: 'Thiếu mã đơn' });
        try {
            const r = await reprintBillJT(orderid, req.user.id);
            res.status(r.success ? 200 : (r.status || 500)).json({ success: r.success, message: r.message });
        } catch (error) {
            console.error('Lỗi /printjtex:', error.message);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống, thử lại sau' });
        }
    });

    router.post('/cancelorderjt', jwtAuth, async function (req, res) {
        var orderid = req.body.orderid;
        const mess = await CancelOrderJT(orderid);
        res.json({ message: mess });
    });

    router.post('/refreshstatusjt', jwtAuth, async function (req, res) {
        const realorderid = String(req.body.realorderid || '').trim();
        if (!/^[A-Za-z0-9]+(-\d{3})?$/.test(realorderid) || realorderid.length < 6 || realorderid.length > 30) {
            return res.status(400).json({ success: false, message: 'Mã đơn không hợp lệ' });
        }
        try {
            const result = await refreshJTStatus(realorderid);
            res.json({ success: true, ...result });
        } catch (error) {
            if (error.httpStatus) {
                return res.status(error.httpStatus).json({ success: false, message: error.message });
            }
            console.error('Lỗi /refreshstatusjt:', error.message);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống, thử lại sau' });
        }
    });
};
