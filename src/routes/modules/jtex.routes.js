'use strict';
const jwtAuth = require('../../middleware/jwtAuth');
const { CancelOrderJT, dispatchJTLabel, reprintBillJT, createJTOrder, refreshJTStatus } = require('../../services/jtExpressService');

module.exports = function registerJtexRoutes(router) {
    router.post('/pushorderjtex', jwtAuth, async function (req, res) {
        let result;
        try {
            result = await createJTOrder({ ...req.body, accountId: req.user.id, actor: req.user });
        } catch (error) {
            console.error('Lỗi /pushorderjtex:', error.message);
            return res.status(500).json({ success: false, message: 'GB chưa xác nhận được kết quả. Kiểm tra đơn J&T trước khi gửi lại.' });
        }
        if (!result.success) return res.json(result);

        try {
            const print = await dispatchJTLabel(result.txlogisticId, req.user.id);
            return res.json({ ...result, printDispatched: print.success, printStatus: print.printStatus, printMessage: print.message });
        } catch (error) {
            console.error('Lỗi gửi tem sau khi tạo đơn J&T:', error.message);
            return res.json({ ...result, printDispatched: false, printStatus: 'label_error', printMessage: 'Chưa xác nhận được việc gửi lệnh in.' });
        }
    });

    router.post('/printjtex', jwtAuth, async function (req, res) {
        const orderid = String(req.body.orderid || '').trim();
        if (!orderid) return res.status(400).json({ success: false, message: 'Thiếu mã đơn' });
        try {
            const r = await reprintBillJT(orderid, req.user.id);
            res.status(r.success ? 200 : (r.status || 500)).json({ success: r.success, message: r.message, printStatus: r.printStatus });
        } catch (error) {
            console.error('Lỗi /printjtex:', error.message);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống, thử lại sau' });
        }
    });

    router.post('/cancelorderjt', jwtAuth, async function (req, res) {
        const orderid = String(req.body?.orderid || '').trim();
        if (!/^[A-Za-z0-9_-]{1,45}$/.test(orderid)) {
            return res.status(400).json({ success: false, message: 'Mã đơn J&T không hợp lệ' });
        }
        res.json(await CancelOrderJT(orderid));
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
