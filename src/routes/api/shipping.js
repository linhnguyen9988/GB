'use strict';

const router = require('express').Router();
const { requireAdmin } = require('../../middleware/jwtAuth');
const shipping = require('../../services/shippingAccounts');

function route(handler) {
    return async (req, res) => {
        try {
            res.json({ success: true, ...await handler(req) });
        } catch (error) {
            if (error.shippingConfiguration) return res.status(400).json({ success: false, message: error.message });
            console.error('Lỗi tài khoản vận chuyển:', error.code || error.message);
            res.status(500).json({ success: false, message: 'Không xử lý được cấu hình vận chuyển. Kiểm tra migration và khóa mã hóa trên máy chủ.' });
        }
    };
}

router.get('/default', route(async () => ({ carrier: (await shipping.getDefault())?.carrier || null })));
router.use(requireAdmin);
router.get('/accounts', route(async () => ({ accounts: await shipping.listAccounts(), selected: await shipping.getDefault() })));
router.post('/accounts/jt', route(async req => {
    await shipping.saveJTAccount(req.body?.customerCode);
    return { message: 'Đã lưu tài khoản J&T.' };
}));
router.put('/default', route(async req => {
    await shipping.setDefault(req.body?.carrier, req.body?.accountId);
    return { message: 'Đã đổi tài khoản lên đơn mặc định.' };
}));

module.exports = router;
