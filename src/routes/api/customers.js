const express = require('express');
const router = express.Router();
const DBConnection = require('../../configs/DBConnection');

// GET /api/customers?limit=200&offset=0&fromDate=2025-01-01&search=...&pageId=...
router.get('/', async (req, res) => {
    try {
        const db = DBConnection.promise();

        const limit  = Math.min(parseInt(req.query.limit)  || 50, 500);
        const offset = parseInt(req.query.offset) || 0;
        const search   = req.query.search   || null;
        const pageId   = req.query.pageId   || null;
        const fromDate = req.query.fromDate || null; // 'YYYY-MM-DD'

        const conditions = [];
        const params     = [];

        if (fromDate) {
            conditions.push('DATE(joindate) >= ?');
            params.push(fromDate);
        }
        if (pageId) {
            conditions.push('pageid = ?');
            params.push(pageId);
        }
        if (search) {
            conditions.push('(fbnamex LIKE ? OR phone LIKE ?)');
            params.push(`%${search}%`, `%${search}%`);
        }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql   = `SELECT * FROM khachhang ${where} ORDER BY id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const [rows] = await db.query(sql, params);
        res.json(rows);
    } catch (err) {
        console.error('[GET /api/customers]', err);
        res.status(500).json({ error: 'Lỗi tải khách hàng' });
    }
});

router.get('/stats', async (req, res) => {
    try {
        const db = DBConnection.promise();
        const fromDate = req.query.fromDate || null;
        const pageId   = req.query.pageId   || null;

        const conditions = [];
        const params = [];
        if (fromDate) { conditions.push('DATE(joindate) >= ?'); params.push(fromDate); }
        if (pageId)   { conditions.push('pageid = ?');          params.push(pageId); }

        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [[row]] = await db.query(
            `SELECT
                COUNT(*)                                                       AS totalCustomers,
                COALESCE(SUM(phone IS NOT NULL AND TRIM(phone) != ''), 0)      AS withPhone
             FROM khachhang ${where}`,
            params
        );
        res.json({
            totalCustomers: Number(row.totalCustomers ?? 0),
            withPhone:      Number(row.withPhone ?? 0),
        });
    } catch (err) {
        console.error('[GET /api/customers/stats]', err);
        res.status(500).json({ error: 'Lỗi thống kê khách hàng' });
    }
});

router.get('/by-userid/:userid', async (req, res) => {
    try {
        const db = DBConnection.promise();
        const [rows] = await db.query(
            'SELECT * FROM khachhang WHERE userid = ? LIMIT 1',
            [req.params.userid]
        );
        if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[GET /api/customers/by-userid]', err);
        res.status(500).json({ error: 'Lỗi tìm khách hàng' });
    }
});
// GET /api/customers/:id
router.get('/:id', async (req, res) => {
    try {
        const db = DBConnection.promise();
        const [rows] = await db.query('SELECT * FROM khachhang WHERE id = ? LIMIT 1', [req.params.id]);
        if (!rows.length) return res.status(404).json({ error: 'Không tìm thấy' });
        res.json(rows[0]);
    } catch (err) {
        console.error('[GET /api/customers/:id]', err);
        res.status(500).json({ error: 'Lỗi tải khách hàng' });
    }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
    try {
        const db = DBConnection.promise();
        const allowed = ['phone', 'diachi', 'note', 'label', 'aka', 'nuocngoai'];
        const updates = {};
        for (const key of allowed) {
            if (req.body[key] !== undefined) updates[key] = req.body[key];
        }
        if (!Object.keys(updates).length) return res.status(400).json({ error: 'Không có trường nào để cập nhật' });

        const sets   = Object.keys(updates).map(k => `${k} = ?`).join(', ');
        const values = [...Object.values(updates), req.params.id];
        await db.query(`UPDATE khachhang SET ${sets} WHERE id = ?`, values);
        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/customers/:id]', err);
        res.status(500).json({ error: 'Lỗi cập nhật khách hàng' });
    }
});

module.exports = router;
