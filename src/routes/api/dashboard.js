const router = require('express').Router();
const db = require('../../configs/DBConnection');
const auth = require('../../middleware/jwtAuth');

// GET /api/dashboard/stats
router.get('/stats', auth, async (req, res) => {
  try {
    const [[{ totalMessages }]] = await db.query('SELECT COUNT(*) as totalMessages FROM messaging');
    const [[{ unreadMessages }]] = await db.query('SELECT COUNT(*) as unreadMessages FROM messaging WHERE isread = 0');
    const [[{ totalCustomers }]] = await db.query('SELECT COUNT(*) as totalCustomers FROM khachhang');
    const [[{ newCustomersToday }]] = await db.query(
      'SELECT COUNT(*) as newCustomersToday FROM khachhang WHERE DATE(joindate) = CURDATE()'
    );
    const [[{ totalOrders }]] = await db.query('SELECT COUNT(*) as totalOrders FROM lendon');
    const [[{ pendingOrders }]] = await db.query('SELECT COUNT(*) as pendingOrders FROM lendon WHERE statuscode = 0');
    const [[{ deliveredOrders }]] = await db.query('SELECT COUNT(*) as deliveredOrders FROM lendon WHERE statuscode = 2');
    const [[{ cancelledOrders }]] = await db.query('SELECT COUNT(*) as cancelledOrders FROM lendon WHERE statuscode = -1');
    const [[{ totalCod }]] = await db.query('SELECT COALESCE(SUM(cod),0) as totalCod FROM lendon WHERE statuscode = 2');
    const [[{ totalLiveComments }]] = await db.query('SELECT COUNT(*) as totalLiveComments FROM livecomment');

    // 7 ngày gần đây
    const [last7Days] = await db.query(`
      SELECT
        DATE_FORMAT(d.date, '%Y-%m-%d') as date,
        COALESCE(m.cnt, 0) as messages,
        COALESCE(o.cnt, 0) as orders,
        COALESCE(c.cnt, 0) as customers
      FROM (
        SELECT CURDATE() - INTERVAL n DAY as date
        FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3
              UNION SELECT 4 UNION SELECT 5 UNION SELECT 6) nums
      ) d
      LEFT JOIN (
        SELECT DATE(FROM_UNIXTIME(timestamp/1000)) as dt, COUNT(*) as cnt
        FROM messaging GROUP BY dt
      ) m ON m.dt = d.date
      LEFT JOIN (
        SELECT DATE(last_update) as dt, COUNT(*) as cnt
        FROM lendon GROUP BY dt
      ) o ON o.dt = d.date
      LEFT JOIN (
        SELECT DATE(joindate) as dt, COUNT(*) as cnt
        FROM khachhang GROUP BY dt
      ) c ON c.dt = d.date
      ORDER BY d.date ASC
    `);

    res.json({
      totalMessages, unreadMessages,
      totalCustomers, newCustomersToday,
      totalOrders, pendingOrders, deliveredOrders, cancelledOrders,
      totalCod: parseInt(totalCod),
      totalLiveComments,
      last7Days
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
