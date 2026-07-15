const router = require('express').Router();
const db = require('../../configs/DBConnection');
const auth = require('../../middleware/jwtAuth');

// GET /api/orders
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

// GET /api/orders/logs/:orderNumber — hành trình đơn hàng (Viettel + J&T)
router.get('/logs/:orderNumber', auth, async (req, res) => {
  try {
    const orderNumber = req.params.orderNumber;

    // Lấy provider từ bảng lendon
    const [[orderInfo]] = await db.query(
      'SELECT provider FROM lendon WHERE realorderid = ? LIMIT 1',
      [orderNumber]
    );
    const provider = orderInfo?.provider || 'Viettel';

    let rows = [];
    if (provider === 'J&T') {
      [rows] = await db.query(
        `SELECT
           scantime        AS status_date_raw,
           scantypename    AS status_name,
           CONCAT_WS(', ', NULLIF(scanward,''), NULLIF(scancity,''), NULLIF(scanprov,'')) AS location,
           scanbyname      AS employee_name,
           scanbycontact   AS employee_phone,
           issuename       AS note,
           0               AS money_collection,
           scantypecode    AS status_code
         FROM jtwaybill
         WHERE billcode = ?
         ORDER BY scantime DESC`,
        [orderNumber]
      );
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

// GET /api/orders/:id
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

// PUT /api/orders/:id/status
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

// POST /api/orders - tạo đơn mới (từ màn hình chốt đơn)
router.post('/', auth, async (req, res) => {
  const orders = req.body; // array of orders
  if (!Array.isArray(orders) || !orders.length)
    return res.status(400).json({ error: 'Danh sách đơn trống' });

  try {
    const created = [];
    for (const o of orders) {
      const [result] = await db.query(
        `INSERT INTO lendon
           (name, phone, address, cod, statuscode, statustext, date, khid, userid, time, last_update, useraccountid)
         VALUES (?, ?, ?, ?, 0, 'Chờ lấy hàng', ?, ?, ?, NOW(), NOW(), ?)`,
        [
          o.customerName, o.phone, o.address,
          parseInt(o.price) || 0,
          new Date().toLocaleDateString('vi-VN'),
          o.khid || 0, o.userId || '',
          req.user?.id ?? null
        ]
      );
      created.push(result.insertId);
    }
    res.json({ success: true, created });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/orders/push-jt — lên đơn J&T (dùng JWT, cho Flutter app)
router.post('/push-jt', auth, async (req, res) => {
  const CryptoJS = require('crypto-js');
  const axios = require('axios');

  function md5ToBase64(input) {
    const md5Hash = CryptoJS.MD5(input);
    return CryptoJS.enc.Base64.stringify(md5Hash);
  }

  async function getBillAndPrint(matuquan, userId, io) {
    const pkey = '47e60fbcc61544dcb85d30acd39d5e66';
    const apiAccount = '813258343706625024';
    const oderjson = JSON.stringify({
      customerCode: '251LC12614',
      password: 'F55D925970D227346C2422F74FE0A9C3',
      txlogisticId: matuquan,
    });
    const digest = md5ToBase64(oderjson + pkey);
    const params = new URLSearchParams();
    params.append('bizContent', oderjson);
    try {
      const r = await axios.post(
        'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/printOrder',
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            apiAccount,
            digest,
            timestamp: Date.now().toString(),
          },
          timeout: 5000,
        }
      );
      const body = r.data;
      if (body.msg === 'success' && body.data?.base64EncodeContent) {
        await db.query('INSERT INTO jtbill (billcode, base64) VALUES (?, ?)', [
          matuquan,
          body.data.base64EncodeContent,
        ]);
        if (io && userId) {
          const userRoom = `USER_ROOM_${userId}`;
          io.to(userRoom).emit('print-now', {
            type: 'pdf',
            base64: body.data.base64EncodeContent,
            config: { printerName: 'HPRT N41', widthMm: 80, heightMm: 80 },
          });
        }
      }
    } catch (_) {}
  }

  let { fbname, address, phone, cod, kg, khid, userid, realfbid, tinh, huyen, xa } = req.body;

  if (!xa) return res.json({ success: false, message: 'Check địa chỉ trước' });

  kg = parseFloat(kg) || 1; // đảm bảo là số float, không phải string

  const pkey = '47e60fbcc61544dcb85d30acd39d5e66';
  const apiAccount = '813258343706625024';
  const matuquan = 'DH' + Date.now();
  const timenow = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Saigon' }); // dùng cho field date (hiển thị)

  const oderjson = JSON.stringify({
    customerCode: '251LC12614',
    password: 'F55D925970D227346C2422F74FE0A9C3',
    txlogisticId: matuquan,
    productType: 'EXPRESS',
    orderType: '1',
    serviceType: '1',
    partSign: 1,
    deliveryType: '1',
    totalQuantity: 1,
    sender: {
      name: 'Áo Dài Gia Bảo',
      mobile: '0888118855',
      prov: 'Đồng Nai',
      city: 'Thành phố Biên Hoà',
      area: 'Phường Long Bình-251TPB07',
      address: '197 HBB',
    },
    receiver: { name: fbname, mobile: phone, prov: tinh, city: huyen, area: xa, address },
    payType: 'PP_PM',
    goodsType: 'bm000010',
    goodsValue: cod.toString(),
    codMoney: cod.toString(),
    itemsValue: cod.toString(),
    remark: 'Cho xem hàng. Không nhận thu 30k',
    englishName: 'none',
    packageInfo: { weight: kg, length: 10, width: 10, height: 10, volume: '10' },
    items: [{ itemName: 'Vải', englishName: 'None', number: 1, itemValue: cod }],
  });

  const digest = md5ToBase64(oderjson + pkey);
  const params = new URLSearchParams();
  params.append('bizContent', oderjson);

  try {
    const response = await axios.post(
      'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/addOrder',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          apiAccount,
          digest,
          timestamp: Date.now().toString(),
        },
        timeout: 5000,
      }
    );

    const body = response.data;
    if (body.msg !== 'success') {
      return res.json({ success: false, message: 'J&T từ chối: ' + body.msg });
    }

    const sqlOrder = `
      INSERT INTO lendon
        (name, phone, address, cod, kg, status, date, orderid, realorderid, khid, userid, realfbid, time, provider, sortline, statuscode, statustext, useraccountid, last_update)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'J&T', ?, ?, ?, ?, NOW())`;
    await db.query(sqlOrder, [
      fbname, phone, address, cod, kg,
      1, timenow, matuquan, body.data.billCode,
      khid, userid, realfbid,
      body.data.sortLine || null, 100, 'Mới tạo',
      req.user?.id ?? null,
    ]);

    // In bill — dùng userId từ JWT
    const jwtUserId = req.user?.id ?? userid;
    let io = null;
    try { io = require('../../socket').getIo(); } catch (_) {}
    getBillAndPrint(matuquan, jwtUserId, io);

    return res.json({
      success: true,
      message: 'Lên đơn J&T thành công',
      order_code: body.data.billCode,
      sort_line: body.data.sortLine,
    });
  } catch (error) {
    console.error('Lỗi Create Order J&T (API):', error.message);
    return res.json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
  }
});


module.exports = router;