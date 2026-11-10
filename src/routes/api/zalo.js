'use strict';

const router = require('express').Router();
const zalo = require('../../services/zaloConnection');

router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (req.method !== 'GET' && req.get('X-GB-Zalo-Action') !== '1') {
        return res.status(403).json({ message: 'Yêu cầu Zalo không hợp lệ.' });
    }
    next();
});

function route(handler) {
    return async (req, res) => {
        try {
            return await handler(req, res);
        } catch (error) {
            if (error instanceof zalo.ZaloActionError) {
                return res.status(error.status).json({ message: error.message });
            }
            if (error.code === 'ER_NO_SUCH_TABLE') {
                return res.status(503).json({ message: 'Cần chạy migration 20261109_zalo_connection.sql.' });
            }
            if (error.code === 'MODULE_NOT_FOUND') {
                return res.status(503).json({ message: 'Cần cài thư viện zca-js trên máy chủ GB.' });
            }
            if (error.message?.includes('VIETTEL_CREDENTIALS_KEY')) {
                return res.status(503).json({ message: 'Cần cấu hình VIETTEL_CREDENTIALS_KEY để mã hóa phiên Zalo.' });
            }
            return res.status(502).json({ message: 'Không hoàn tất được thao tác Zalo. Vui lòng thử lại.' });
        }
    };
}

router.get('/', route(async (req, res) => res.json(await zalo.getStatus(req.user.id))));
router.post('/qr', route(async (req, res) => {
    if (!await zalo.start(req.user)) {
        return res.status(409).json({ message: 'GB đang chờ xác nhận một mã QR Zalo.' });
    }
    return res.status(202).json({ success: true });
}));
router.delete('/qr/:id', route(async (req, res) => {
    if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) {
        return res.status(400).json({ message: 'Mã phiên QR không hợp lệ.' });
    }
    await zalo.cancel(req.user.id, req.params.id);
    return res.json({ success: true });
}));
router.post('/verify', route(async (_req, res) => {
    if (!await zalo.verify()) {
        return res.status(409).json({ message: 'Chưa có phiên Zalo hợp lệ. Hãy quét mã QR để kết nối.' });
    }
    return res.json({ success: true });
}));
router.post('/check-phone', route(async (req, res) => {
    const recipient = await zalo.checkPhone(req.body?.phone);
    return res.json({ recipient });
}));
router.post('/send-test', route(async (req, res) => {
    const result = await zalo.sendTestMessage(req.body || {});
    return res.json({ success: true, ...result });
}));
router.delete('/:id', route(async (req, res) => {
    if (!/^\d{1,64}$/.test(req.params.id)) return res.status(400).json({ message: 'Mã tài khoản không hợp lệ.' });
    if (!await zalo.disconnect(req.params.id)) {
        return res.status(409).json({ message: 'Kết nối đã thay đổi hoặc GB đang chờ xác nhận mã QR.' });
    }
    return res.json({ success: true });
}));

module.exports = router;
