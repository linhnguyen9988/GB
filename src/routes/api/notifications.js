const router = require('express').Router();
const db = require('../../configs/DBConnection');
const auth = require('../../middleware/jwtAuth');

// GET /api/notifications/unread-count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const [[row]] = await db.query(
      'SELECT COUNT(*) as count FROM order_noti_log WHERE userid = ? AND is_read = 0',
      [req.user.id]
    );
    res.json({ count: row.count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM order_noti_log WHERE userid = ? ORDER BY sent_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/read-all  — phải khai báo TRƯỚC /:id/read
router.post('/read-all', auth, async (req, res) => {
  try {
    await db.query('UPDATE order_noti_log SET is_read = 1 WHERE userid = ?', [req.user.id]);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notifications/:id/read
router.post('/:id/read', auth, async (req, res) => {
  try {
    await db.query('UPDATE order_noti_log SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notifications/:id — xóa 1 thông báo
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM order_noti_log WHERE id = ? AND userid = ?',
      [req.params.id, req.user.id]
    );
    res.sendStatus(200);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

