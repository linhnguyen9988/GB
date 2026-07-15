const router = require('express').Router();
const db = require('../../configs/DBConnection');
const auth = require('../../middleware/jwtAuth');

// GET /api/livecomments/livestreams - 5 livestream gần nhất
router.get('/livestreams', auth, async (req, res) => {
  const { limit = 5 } = req.query;
  try {
    const [rows] = await db.query(
      `SELECT ls.idx, ls.id, ls.name, ls.time, ls.livedesc, ls.luotincuoi,
              pl.status, pl.liveviews
       FROM livestream ls
       LEFT JOIN postlive pl ON pl.liveid = ls.id
       ORDER BY ls.idx DESC LIMIT ?`,
      [parseInt(limit)]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/livecomments
router.get('/', auth, async (req, res) => {
  const { liveId, pageId, limit, offset = 0 } = req.query;
  try {
    let sql = `
      SELECT lc.*,
       k.label     AS customer_label,
       k.phone     AS customer_phone,
       k.nuocngoai AS nuocngoai,
       k.diachi    AS diachi,
       k.note      AS note,
       k.id        AS khid
FROM livecomment lc
LEFT JOIN khachhang k ON k.userid = lc.userid
      WHERE 1=1
    `;
    const params = [];
    if (liveId) { sql += ' AND lc.liveid = ?'; params.push(liveId); }
    if (pageId) { sql += ' AND lc.pageid = ?'; params.push(pageId); }
    sql += ' ORDER BY lc.idx DESC';
    if (limit !== undefined && limit !== '') {
      sql += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));
    }

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/livecomments/customer-chots
// Body: { userid: string, liveIds: string[] }
router.post('/customer-chots', auth, async (req, res) => {
  const { userid, liveIds } = req.body;

  if (!userid || typeof userid !== 'string' || userid.trim() === '') {
    return res.status(400).json({ error: 'userid is required' });
  }
  if (!Array.isArray(liveIds) || liveIds.length === 0) {
    return res.json({ chots: [] });
  }

  const ids = liveIds
    .filter((id) => typeof id === 'string' && id.trim() !== '')
    .slice(0, 20);

  if (ids.length === 0) return res.json({ chots: [] });

  try {
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await db.query(
      `SELECT liveid, chot, COALESCE(slchot, 1) AS slchot
       FROM livecomment
       WHERE userid = ?
         AND liveid IN (${placeholders})
         AND chot IS NOT NULL AND chot <> ''
       ORDER BY idx ASC`,
      [userid.trim(), ...ids]
    );
    res.json({ chots: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;