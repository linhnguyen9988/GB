'use strict';
const router = require('express').Router();
const db = require('../../configs/DBConnection');
const { requireAdmin } = require('../../middleware/jwtAuth');
router.use(requireAdmin);
router.use('/zalo', require('./zalo'));
router.get('/users', async (req, res) => {
 try { const [users] = await db.query('SELECT id, username, fullname, role FROM users ORDER BY id'); res.json({ users }); }
 catch (_) { res.status(500).json({ message: 'Không tải được tài khoản' }); }
});
router.put('/users/:id/role', async (req, res) => {
 const id = Number(req.params.id), role = req.body.role;
 if (!Number.isSafeInteger(id) || id <= 0 || !['admin','staff'].includes(role)) return res.status(400).json({ message: 'Vai trò không hợp lệ' });
 if (String(id) === String(req.user.id)) return res.status(400).json({ message: 'Không tự thay đổi quyền của chính mình' });
 let conn;
 try {
  conn = await db.getConnection();
  await conn.beginTransaction();
  const [admins] = await conn.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id FOR UPDATE");
  if (!admins.some(u => String(u.id) === String(req.user.id))) { await conn.rollback(); return res.status(403).json({ message: 'Quyền admin đã bị thu hồi' }); }
  const [r] = await conn.query('UPDATE users SET role = ?, auth_version = auth_version + 1 WHERE id = ?', [role, id]);
  await conn.commit();
  return res.status(r.affectedRows ? 200 : 404).json({ success: !!r.affectedRows });
 } catch (_) { if (conn) await conn.rollback(); return res.status(500).json({ message: 'Không cập nhật được quyền' }); }
 finally { if (conn) conn.release(); }
});
module.exports = router;
