'use strict';
const DBConnection = require("../configs/DBConnection");
const bcrypt = require("bcryptjs");

let findUserByUsername = async (username) => {
    const [rows] = await DBConnection.query(
        'SELECT * FROM `users` WHERE `username` = ? LIMIT 1',
        [username]
    );
    return rows[0] || null;
};

let handleLogin = async (username, password) => {
    const user = await findUserByUsername(username);
    if (!user) {
        throw new Error(`Tên đăng nhập "${username}" không tồn tại`);
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new Error(`Sai mật khẩu`);
    }
    return user;
};

module.exports = {
    handleLogin,
};
