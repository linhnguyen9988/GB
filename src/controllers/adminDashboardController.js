'use strict';
const { REGISTER_PATH } = require('../configs/constants');
const viettelAccounts = require('../services/viettelAccountService');

const show = async (req, res) => {
    let viettelAccountRows = [];
    let viettelAccountError = '';
    try {
        viettelAccountRows = await viettelAccounts.listAccounts(req.user.id);
    } catch (error) {
        console.error('[admin] Không tải được Viettel accounts:', error.message);
        viettelAccountError = 'Chưa thể tải danh sách tài khoản. Hãy kiểm tra migration migrations/20261105_viettel_profile_accounts.sql và khóa VIETTEL_CREDENTIALS_KEY trong .env.';
    }
    return res.render('adminDashboard', {
        user: req.user,
        registerPath: REGISTER_PATH,
        today: require('../services/returnedOrderReport').vnDay(),
        viettelAccounts: viettelAccountRows,
        viettelAccountError
    });
};

module.exports = { show };
