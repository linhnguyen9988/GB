'use strict';
const db = require('../configs/DBConnection');

async function isOpen(connection = db, lock = false) {
    const [[row]] = await connection.query('SELECT enabled FROM gb_registration_settings WHERE id = 1' + (lock ? ' FOR UPDATE' : ''));
    if (!row) throw new Error('Thiếu cấu hình đăng ký tài khoản');
    return Number(row.enabled) === 1;
}

async function setOpen(enabled, actorId) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        await isOpen(connection, true);
        await connection.query('UPDATE gb_registration_settings SET enabled = ?, updated_by = ?, updated_at = UTC_TIMESTAMP() WHERE id = 1', [enabled ? 1 : 0, actorId]);
        await connection.commit();
        return enabled;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally { connection.release(); }
}

async function show(req, res) {
    res.set('Cache-Control', 'private, no-store');
    try { return res.json({ enabled: await isOpen() }); }
    catch (error) {
        console.error('[Đăng ký tài khoản]', error.code || error.message);
        return res.status(503).json({ message: 'Không đọc được cấu hình đăng ký. Vui lòng thử lại.' });
    }
}

async function update(req, res) {
    res.set('Cache-Control', 'private, no-store');
    if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ message: 'Trạng thái đăng ký không hợp lệ.' });
    try { return res.json({ enabled: await setOpen(req.body.enabled, req.user.id) }); }
    catch (error) {
        console.error('[Cập nhật đăng ký]', error.code || error.message);
        return res.status(503).json({ message: 'Không lưu được trạng thái đăng ký. Bấm Tải lại để kiểm tra.' });
    }
}

module.exports = { isOpen, setOpen, show, update };
