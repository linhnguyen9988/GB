import { check } from "express-validator";

let validateRegister = [
    check("username", "Tên đăng nhập cần ít nhất 3 ký tự").isLength({ min: 3 }),

    check("password", "Mật khẩu ít nhất 6 ký tự")
    .isLength({ min: 6 }),

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
