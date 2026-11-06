'use strict';
const db = require('../configs/DBConnection');
const bcrypt = require('bcryptjs');
const { COOKIE_NAME } = require('../configs/jwtConfig');
exports.show = (req, res) => res.render('personalProfile', { user: req.user });
exports.changePassword = async (req, res) => {
 const oldPassword = req.body.oldPassword || req.body.oldpassword;
 const newPassword = req.body.newPassword || req.body.newpassword;
 const confirmPassword = req.body.confirmPassword || req.body.confirmpassword;
 if (typeof oldPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 10 || Buffer.byteLength(newPassword, 'utf8') > 72 || newPassword !== confirmPassword) {
  return res.status(400).json({ success: false, message: 'Mật khẩu mới cần ít nhất 10 ký tự, tối đa 72 byte và xác nhận phải khớp' });
 }
 try {
  const [[u]] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
  if (!u || !await bcrypt.compare(oldPassword, u.password)) return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng' });
  const hash = await bcrypt.hash(newPassword, 12);
  const [result] = await db.query('UPDATE users SET password = ?, auth_version = auth_version + 1 WHERE id = ? AND password = ?', [hash, req.user.id, u.password]);
  if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Tài khoản vừa thay đổi, hãy đăng nhập lại' });
  res.clearCookie(COOKIE_NAME);
  return res.json({ success: true, message: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.' });
 } catch (_) { return res.status(500).json({ success: false, message: 'Không đổi được mật khẩu' }); }
};
