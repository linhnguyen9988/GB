import DBConnection from "../configs/DBConnection";
import bcrypt from "bcryptjs";

let findUserByUsername = async (username) => {
    const [rows] = await DBConnection.query(
        'SELECT * FROM `users` WHERE `username` = ? LIMIT 1',
        [username]
    );
    return rows[0] || null;
};

let findUserById = async (id) => {
    const [rows] = await DBConnection.query(
        'SELECT * FROM `users` WHERE `id` = ? LIMIT 1',
        [id]
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

let comparePassword = async (password, userObject) => {
    const isMatch = await bcrypt.compare(password, userObject.password);
    return isMatch ? true : `Mật khẩu sai`;
};

module.exports = {
    handleLogin,
    findUserByUsername,
    findUserById,
    comparePassword,
};
