'use strict';
const router = require('express').Router();
const db = require('../../configs/DBConnection');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../../configs/jwtConfig');
const { apiAuth } = require('../../middleware/jwtAuth');

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Thiáº¿u username hoáº·c password' });

  try {
    const [[user]] = await db.query(
      'SELECT * FROM users WHERE username = ?', [username]
    );
    if (!user)
      return res.status(401).json({ message: 'TÃ i khoáº£n khÃ´ng tá»“n táº¡i' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ message: 'Máº­t kháº©u khÃ´ng Ä‘Ãºng' });

    const token = jwt.sign(
      { id: user.id, username: user.username, auth_version: user.auth_version || 0 },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { id: user.id, username: user.username, fullname: user.fullname, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/change-password', apiAuth, require('../../controllers/personalProfileController').changePassword);

module.exports = router;
