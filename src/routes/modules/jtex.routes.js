'use strict';
const jwtAuth = require('../../middleware/jwtAuth');
const { CancelOrderJT, GetBillJT, PrintBillJT, createJTOrder, refreshJTStatus } = require('../../services/jtExpressService');

module.exports = function registerJtexRoutes(router) {
    // Lên đơn J&T từ web (chat/live) — logic nằm ở services/jtExpressService.createJTOrder
    router.post('/pushorderjtex', jwtAuth, async function (req, res) {
        const result = await createJTOrder({ ...req.body, accountId: req.user.id });
        if (!result.success) return res.json({ success: false, message: result.message });

        await GetBillJT(result.txlogisticId, req.user.id);
        return res.json({
            success: true,
            message: result.message,
            order_code: result.order_code,
            sort_line: result.sort_line
        });
    });

    router.post('/printjtex', jwtAuth, function (req, res) {
        var orderid = req.body.orderid;
        PrintBillJT(orderid);
        res.sendStatus(200)
    });

    router.post('/cancelorderjt', jwtAuth, async function (req, res) {
        var orderid = req.body.orderid;
        const mess = await CancelOrderJT(orderid);
        res.json({ message: mess });
    });

    // Làm mới hành trình + trạng thái 1 đơn J&T trực tiếp từ J&T (khi webhook bị sót)
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
