'use strict';
const router = require('express').Router();
const db = require('../../configs/DBConnection');
const auth = require('../../middleware/jwtAuth');
const { getAccountForOrder } = require('../../services/viettelAccountService');

router.get('/', auth, async (req, res) => {
  const { status, search, fromDate, limit = 50, offset = 0 } = req.query;
  try {
    let sql = 'SELECT l.*, k.pageid FROM lendon l LEFT JOIN khachhang k ON k.id = l.khid WHERE 1=1';
    const params = [];
    if (status !== undefined && status !== '') {
      sql += ' AND l.statuscode = ?';
      params.push(parseInt(status));
    }
    if (search) {
      sql += ' AND (l.name LIKE ? OR l.phone LIKE ? OR l.orderid LIKE ? OR l.realorderid LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (fromDate) {
      sql += ' AND DATE(l.time) >= ?';
      params.push(fromDate);
    }
    sql += ' ORDER BY l.time DESC, l.statuscode DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/recent', auth, async (req, res) => {
  try {
    const userid = String(req.query.userid || '').trim();
    const realfbid = String(req.query.realfbid || '').trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 3, 1), 10);
    if (!userid && !realfbid) return res.json({ data: [] });

    const conds = [];
    const params = [];
    if (userid) { conds.push('userid = ?'); params.push(userid); }
    if (realfbid && realfbid !== 'null') { conds.push('realfbid = ?'); params.push(realfbid); }
    params.push(limit);

    const [rows] = await db.query(
      `SELECT realorderid, orderid, cod, kg, statuscode, statustext, provider, time, last_update, address
       FROM lendon
       WHERE (${conds.join(' OR ')})
       ORDER BY time DESC, realorderid DESC
       LIMIT ?`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('orders/recent:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', auth, async (req, res) => {
  const { fromDate, dateMode = 'created' } = req.query;
  try {
    const dateCol = dateMode === 'updated' ? 'l.last_update' : 'l.time';
    const conditions = ['1=1'];
    const params = [];
    if (fromDate) {
      conditions.push(`DATE(${dateCol}) >= ?`);
      params.push(fromDate);
    }
    const where = conditions.join(' AND ');

    const [[summary]] = await db.query(
      `SELECT COUNT(*) AS totalOrders, COALESCE(SUM(cod), 0) AS totalCod
       FROM lendon l WHERE ${where}`,
      params
    );

    const [byStatus] = await db.query(
      `SELECT statuscode, MIN(statustext) AS statustext, COUNT(*) AS cnt, COALESCE(SUM(cod), 0) AS totalCod
       FROM lendon l WHERE ${where}
       GROUP BY statuscode
       ORDER BY cnt DESC`,
      params
    );

    res.json({
      totalOrders: Number(summary.totalOrders ?? 0),
      totalCod:    Number(summary.totalCod ?? 0),
      byStatus: byStatus.map(s => ({
        ...s,
        cnt:      Number(s.cnt),
        totalCod: Number(s.totalCod),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/logs/:orderNumber', auth, async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber;

    const [[orderInfo]] = await db.query(
      'SELECT provider FROM lendon WHERE realorderid = ? LIMIT 1',
      [orderNumber]
    );
    const provider = orderInfo?.provider || 'Viettel';

    let rows = [];
    if (provider === 'J&T') {
      const { jtHasSigpic, formatJTScanTime } = require('../../services/jtExpressService');
      const sigCol = (await jtHasSigpic()) ? ', sigpic' : '';
      [rows] = await db.query(
        `SELECT
           CAST(scantime AS CHAR) AS status_date_raw,
           scantypename    AS status_name,
           CONCAT_WS(', ', NULLIF(scanward,''), NULLIF(scancity,''), NULLIF(scanprov,'')) AS location,
           scanbyname      AS employee_name,
           scanbycontact   AS employee_phone,
           issuename       AS note,
           0               AS money_collection,
           scantypecode    AS status_code${sigCol}
         FROM jtwaybill
         WHERE billcode = ?
         ORDER BY REPLACE(CAST(scantime AS CHAR), 'T', ' ') DESC`,
        [orderNumber]
      );
      for (const row of rows) row.status_date_raw = formatJTScanTime(row.status_date_raw) || row.status_date_raw;
    } else {
      [rows] = await db.query(
        `SELECT * FROM order_logs
         WHERE order_number = ?
         ORDER BY id DESC`,
        [orderNumber]
      );
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/call-log/:orderNumber', auth, async (req, res) => {
  const axios = require('axios');
  try {
    const orderNumber = req.params.orderNumber;
    if (!orderNumber) return res.status(400).json({ error: 'Thiếu mã vận đơn' });

    const [[order]] = await db.query(
      'SELECT * FROM lendon WHERE realorderid=? AND useraccountid=? LIMIT 1',
      [orderNumber, Number(req.user.id)]
    );
    if (!order) return res.status(404).json({ error: 'Không tìm thấy đơn hàng thuộc tài khoản của bạn' });
    const account = await getAccountForOrder(db, order);
    if (!account?.token) {
      return res.status(400).json({ error: 'Không tìm thấy token Viettel của đơn hàng' });
    }

    const response = await axios.get('https://partner.viettelpost.vn/v2/order/call-log', {
      params: { orderNumber },
      headers: {
        accept: '*/*',
        Token: account.token,
      },
      timeout: 10000,
    });

    const body = response.data;
    if (body?.error) {
      return res.status(400).json({ error: body.message || 'Lỗi lấy lịch sử cuộc gọi' });
    }

    res.json(body?.data || []);
  } catch (err) {
    const apiMsg = err.response?.data?.message;
    res.status(500).json({ error: apiMsg || err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const [[row]] = await db.query(
      `SELECT l.*, k.pageid
       FROM lendon l
       LEFT JOIN khachhang k ON k.id = l.khid
       WHERE l.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/status', auth, async (req, res) => {
  const { statusCode, statusText } = req.body;
  try {
    await db.query(
      'UPDATE lendon SET statuscode=?, statustext=?, last_update=NOW() WHERE id=?',
      [statusCode, statusText, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', auth, async (req, res) => {
  const orders = req.body; // array of orders
  if (!Array.isArray(orders) || !orders.length)
    return res.status(400).json({ error: 'Danh sách đơn trống' });

  try {
    const created = [];
    for (const o of orders) {
      const [result] = await db.query(
        `INSERT INTO lendon
           (name, phone, address, cod, statuscode, statustext, date, khid, userid, time, last_update, useraccountid, created_by_user_id, created_by_username)
         VALUES (?, ?, ?, ?, 0, 'Chờ lấy hàng', ?, ?, ?, NOW(), NOW(), ?, ?, ?)`,
        [
          o.customerName, o.phone, o.address,
          parseInt(o.price) || 0,
          new Date().toLocaleDateString('vi-VN'),
          o.khid || 0, o.userId || '',
          req.user.id, req.user.id, req.user.username
        ]
      );
      created.push(result.insertId);
    }
    res.json({ success: true, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/push-jt', auth, async (req, res) => {
  const { createJTOrder, dispatchJTLabel } = require('../../services/jtExpressService');
  try {
    const result = await createJTOrder({ ...req.body, accountId: req.user.id, actor: req.user });
    if (!result.success) return res.json(result);

    Promise.resolve().then(() => dispatchJTLabel(result.txlogisticId, req.user.id)).then(print => {
      if (!print.success) console.warn(`J&T ${result.order_code}: ${print.printStatus} — ${print.message}`);
    }).catch(error => console.error('Lỗi gửi tem J&T (API):', error.message));

    return res.json({ ...result, printStatus: 'pending' });
  } catch (error) {
    console.error('Lỗi Create Order J&T (API):', error.message);
    return res.json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
  }
});


module.exports = router;
