'use strict';
const db = require('../configs/DBConnection');
const bcrypt = require('bcryptjs');
const { COOKIE_NAME } = require('../configs/jwtConfig');
exports.show = (req, res) => res.render('personalProfile', { user: req.user });
exports.updateProfile = async (req, res) => {
 const fullname = typeof req.body.fullname === 'string' ? req.body.fullname.trim() : '';
 if (!fullname || fullname.length > 100 || /[\u0000-\u001f\u007f]/.test(fullname)) return res.status(400).json({ success: false, message: 'Họ tên cần từ 1 đến 100 ký tự hợp lệ.' });
 try {
  await db.query('UPDATE users SET fullname = ? WHERE id = ?', [fullname, req.user.id]);
  return res.json({ success: true, fullname, message: 'Đã lưu thông tin cá nhân.' });
 } catch (_) { return res.status(500).json({ success: false, message: 'Chưa lưu được thay đổi. Vui lòng thử lại.' }); }
};
exports.revokeSessions = async (req, res) => {
 if (typeof req.body.password !== 'string' || !req.body.password) return res.status(400).json({ success: false, message: 'Nhập mật khẩu hiện tại để xác nhận.' });
 try {
  const [[u]] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
  if (!u || !await bcrypt.compare(req.body.password, u.password)) return res.status(400).json({ success: false, message: 'Mật khẩu hiện tại không đúng.' });
  const [result] = await db.query('UPDATE users SET auth_version = auth_version + 1 WHERE id = ? AND password = ?', [req.user.id, u.password]);
  if (!result.affectedRows) return res.status(409).json({ success: false, message: 'Tài khoản vừa thay đổi. Vui lòng đăng nhập lại.' });
  res.clearCookie(COOKIE_NAME);
  return res.json({ success: true, message: 'Đã đăng xuất mọi phiên, bao gồm thiết bị này.' });
 } catch (_) { return res.status(500).json({ success: false, message: 'Chưa đăng xuất được các phiên. Vui lòng thử lại.' }); }
};
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
