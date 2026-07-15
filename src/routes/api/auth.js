const router = require('express').Router();
const db = require('../../configs/DBConnection');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ message: 'Không có token' });
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Thiếu username hoặc password' });

  try {
    const [[user]] = await db.query(
      'SELECT * FROM users WHERE username = ?', [username]
    );
    if (!user)
      return res.status(401).json({ message: 'Tài khoản không tồn tại' });

    let valid = false;
    if (user.password && user.password.startsWith('$2')) {
      valid = await bcrypt.compare(password, user.password);
    } else {
      valid = password === user.password;
    }
    if (!valid)
      return res.status(401).json({ message: 'Mật khẩu không đúng' });

    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, fullname: user.fullname }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword)
    return res.status(400).json({ success: false, message: 'Thiếu thông tin' });

  try {
    const [[user]] = await db.query(
      'SELECT password FROM users WHERE id = ?', [req.user.id]
    );
    if (!user)
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản' });

    let match = false;
    if (user.password && user.password.startsWith('$2')) {
      match = await bcrypt.compare(oldPassword, user.password);
    } else {
      match = oldPassword === user.password;
    }

    if (!match)
      return res.json({ success: false, message: 'Mật khẩu hiện tại không đúng' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;