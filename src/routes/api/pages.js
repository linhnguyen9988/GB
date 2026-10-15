const router = require('express').Router();
const db = require('../../configs/DBConnection');
const auth = require('../../middleware/jwtAuth');

// GET /api/pages
router.get('/', auth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, pageid, name FROM pageinfo');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
