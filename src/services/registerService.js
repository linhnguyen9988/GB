'use strict';
const db = require('../configs/DBConnection');
const bcrypt = require('bcryptjs');
const settings = require('./registrationSettings');

async function createNewUser(data) {
    // Hash before locking, then recheck the setting and insert atomically.
    const password = await bcrypt.hash(data.password, 10);
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        if (!await settings.isOpen(connection, true)) {
            const error = new Error('Đăng ký tài khoản hiện đang khóa.');
            error.code = 'REGISTRATION_CLOSED';
            throw error;
        }
        const [existing] = await connection.query('SELECT id FROM users WHERE username = ? LIMIT 1', [data.username]);
        if (existing.length) throw new Error('Tên đăng nhập đã tồn tại. Hãy chọn tên khác.');
        await connection.query('INSERT INTO users SET ?', [{ role: 'staff', fullname: data.fullname, username: data.username, password }]);
        await connection.commit();
        return 'Tạo tài khoản thành công';
    } catch (error) {
        await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') throw new Error('Tên đăng nhập đã tồn tại. Hãy chọn tên khác.');
        throw error;
    } finally { connection.release(); }
}

module.exports = { createNewUser };
