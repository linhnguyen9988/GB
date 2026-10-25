const router = require('express').Router();
const db = require('../../configs/DBConnection');
const auth = require('../../middleware/jwtAuth');

const BLOCK_MONTHS = 2;
const DUP_WINDOW_SECONDS = 120;

let tableReady = null;
function ensureTable() {
  if (!tableReady) {
    tableReady = db.query(CREATE_SQL).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

router.get('/blocked', auth, async (req, res) => {
  try {
    await ensureTable();
    const [rows] = await db.query(
      `SELECT userid, MAX(khid) AS khid, UNIX_TIMESTAMP(MAX(won_at)) AS ts
         FROM lucky_winners
        WHERE won_at >= DATE_SUB(NOW(), INTERVAL ${BLOCK_MONTHS} MONTH)
        GROUP BY userid`
    );
    res.json({
      months: BLOCK_MONTHS,
      winners: rows.map((r) => ({ userid: String(r.userid), khid: r.khid ? String(r.khid) : '', ts: Number(r.ts) }))
    });
  } catch (err) {
    console.error('[lucky] blocked lỗi:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/winner', auth, async (req, res) => {
  const b = req.body || {};
  const userid = String(b.userid || '').trim().slice(0, 40);
  if (!userid) return res.status(400).json({ error: 'Thiếu userid' });
  const khid = String(b.khid || '').trim().slice(0, 20) || null;
  const name = String(b.name || '').trim().slice(0, 80) || null;
  const phone = String(b.phone || '').trim().slice(0, 20) || null;

  try {
    await ensureTable();
    const [dup] = await db.query(
      `SELECT id FROM lucky_winners
        WHERE userid = ? AND won_at >= DATE_SUB(NOW(), INTERVAL ${DUP_WINDOW_SECONDS} SECOND) LIMIT 1`,
      [userid]
    );
    if (dup.length) return res.json({ ok: true, duplicate: true });

    await db.query(
      'INSERT INTO lucky_winners (userid, khid, fbname, phone) VALUES (?,?,?,?)',
      [userid, khid, name, phone]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[lucky] ghi người trúng lỗi:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
