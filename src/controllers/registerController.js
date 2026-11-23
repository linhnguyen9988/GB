'use strict';
const { REGISTER_PATH } = require('../configs/constants');
const registerService = require('../services/registerService');
const settings = require('../services/registrationSettings');
const { validationResult } = require('express-validator');

function closed(res, status = 403, message = 'Đăng ký tài khoản hiện đang khóa. Vui lòng liên hệ quản trị viên.') {
    res.set('Cache-Control', 'no-store');
    return res.status(status).render('register.ejs', { errors: [], registrationOpen: false, registrationMessage: message });
}

async function getPageRegister(req, res) {
    res.set('Cache-Control', 'no-store');
    try {
        if (!await settings.isOpen()) return closed(res);
        return res.render('register.ejs', { errors: req.flash('errors'), registrationOpen: true, registrationMessage: '' });
    } catch (error) {
        console.error('[Trang đăng ký]', error.code || error.message);
        return closed(res, 503, 'Tạm thời chưa mở được đăng ký. Vui lòng thử lại sau.');
    }
}

async function guardRegistration(req, res, next) {
    try {
        if (!await settings.isOpen()) return closed(res);
        return next();
    } catch (error) {
        console.error('[Kiểm tra đăng ký]', error.code || error.message);
        return closed(res, 503, 'Tạm thời chưa mở được đăng ký. Vui lòng thử lại sau.');
    }
}

async function createNewUser(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        req.flash('errors', Object.values(errors.mapped()).map(item => item.msg));
        return res.redirect(REGISTER_PATH);
    }
    try {
        await registerService.createNewUser({ fullname: req.body.fullName, username: req.body.username, password: req.body.password });
        return res.redirect('/login');
    } catch (error) {
        if (error.code === 'REGISTRATION_CLOSED') return closed(res);
        if (error.code) {
            console.error('[Tạo tài khoản]', error.code);
            return closed(res, 503, 'Chưa tạo được tài khoản. Vui lòng thử lại sau.');
        }
        req.flash('errors', error.message || 'Không tạo được tài khoản.');
        return res.redirect(REGISTER_PATH);
    }
}

module.exports = { getPageRegister, guardRegistration, createNewUser };
