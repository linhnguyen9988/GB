'use strict';
const { check } = require("express-validator");

let validateRegister = [
    check("username", "Tên đăng nhập cần từ 3 đến 255 ký tự").isString().trim().isLength({ min: 3, max: 255 }),
    check("fullName", "Vui lòng nhập họ tên, tối đa 255 ký tự").isString().trim().isLength({ min: 1, max: 255 }),

    check("password", "Mật khẩu cần từ 6 đến 72 ký tự")
    .isString().isLength({ min: 6, max: 72 }),

    check("passwordConfirmation", "Mật khẩu nhập lại bị sai.")
    .custom((value, { req }) => {
        return value === req.body.password
    })
];

let validateLogin = [
    check("username", "Tên đăng nhập ít nhất 3 ký tự").isLength({ min: 3 }),

    check("password", "Sai mật khẩu")
    .not().isEmpty()
];

module.exports = {
    validateRegister: validateRegister,
    validateLogin: validateLogin
};
