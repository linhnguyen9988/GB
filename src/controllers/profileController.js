'use strict';
const viettelAccounts = require('../services/viettelAccountService');

const handleProfile = async (req, res) => {
    let viettelAccountRows = [];
    let viettelAccountError = '';
    try {
        viettelAccountRows = await viettelAccounts.listAccounts(req.user.id);
    } catch (error) {
        console.error('[profile] Không tải được Viettel accounts:', error.message);
        viettelAccountError = 'Chưa thể tải danh sách tài khoản. Hãy kiểm tra migration migrations/20261105_viettel_profile_accounts.sql và khóa VIETTEL_CREDENTIALS_KEY trong .env.';
    }
    return res.render('profile.ejs', {
        user: req.user,
        viettelAccounts: viettelAccountRows,
        viettelAccountError
    });
};

module.exports = { handleProfile };
