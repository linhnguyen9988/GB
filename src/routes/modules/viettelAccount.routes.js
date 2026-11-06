'use strict';

const jwtAuth = require('../../middleware/jwtAuth');
const accounts = require('../../services/viettelAccountService');

module.exports = function registerViettelAccountRoutes(router) {
    router.get('/api/viettel/accounts', jwtAuth, async (req, res) => {
        try {
            const rows = await accounts.listAccounts(req.user.id);
            res.json({ success: true, accounts: rows });
        } catch (error) {
            console.error('[viettel-account] list:', error.message);
            res.status(500).json({ success: false, message: 'Không tải được tài khoản Viettel. Hãy kiểm tra migration DB.' });
        }
    });

    router.post('/api/viettel/accounts/prepare', jwtAuth, async (req, res) => {
        try {
            const result = await accounts.prepareAccount({
                appUserId: req.user.id,
                username: req.body.username,
                password: req.body.password,
                accountId: req.body.accountId
            });
            res.json({ success: true, ...result });
        } catch (error) {
            const message = error.response && error.response.data
                ? (error.response.data.message || 'Viettel Post trả về lỗi khi xác thực tài khoản.')
                : error.message;
            console.error('[viettel-account] prepare:', message);
            res.status(400).json({ success: false, message });
        }
    });

    router.post('/api/viettel/accounts/services', jwtAuth, async (req, res) => {
        try {
            const result = await accounts.loadServicesForDraft({
                appUserId: req.user.id,
                draftId: req.body.draftId,
                groupaddressId: req.body.groupaddressId
            });
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('[viettel-account] services:', error.message);
            res.status(400).json({ success: false, message: error.message || 'Không lấy được bảng giá dịch vụ Viettel.' });
        }
    });

    router.post('/api/viettel/accounts/commit', jwtAuth, async (req, res) => {
        try {
            const result = await accounts.commitPreparedAccount({
                appUserId: req.user.id,
                draftId: req.body.draftId,
                groupaddressId: req.body.groupaddressId,
                serviceCode: req.body.serviceCode,
                makeDefault: req.body.makeDefault === true || req.body.makeDefault === 'true'
            });
            res.json({ success: true, ...result, message: 'Đã lưu tài khoản Viettel Post.' });
        } catch (error) {
            console.error('[viettel-account] commit:', error.message);
            res.status(400).json({ success: false, message: error.message || 'Không lưu được tài khoản Viettel.' });
        }
    });

    router.post('/api/viettel/accounts/:accountId/default', jwtAuth, async (req, res) => {
        try {
            await accounts.setDefaultAccount(req.user.id, req.params.accountId);
            res.json({ success: true, message: 'Đã đặt tài khoản Viettel mặc định.' });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    });

    router.delete('/api/viettel/accounts/:accountId', jwtAuth, async (req, res) => {
        try {
            await accounts.deleteAccount(req.user.id, req.params.accountId);
            res.json({
                success: true,
                message: 'Đã ẩn tài khoản khỏi Profile; giữ token mã hóa để xử lý các đơn cũ.'
            });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    });
};
