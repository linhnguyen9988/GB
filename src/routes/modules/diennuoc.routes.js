'use strict';
const DBConnection = require("../../configs/DBConnection");

module.exports = function registerDienNuocRoutes(router) {
    router.get('/api/rooms', (req, res) => {
        DBConnection.query('SELECT * FROM rooms ORDER BY room_name ASC', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    router.post('/api/rooms/add', (req, res) => {
        const { room_name, base_price, current_elec, current_water } = req.body;
        const sql = 'INSERT INTO rooms (room_name, base_price, current_elec, current_water) VALUES (?, ?, ?, ?)';
        DBConnection.query(sql, [room_name, base_price, current_elec, current_water], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: result.insertId });
        });
    });

    router.post('/api/rooms/delete', (req, res) => {
        const { id } = req.body;
        DBConnection.query('DELETE FROM rooms WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });

    router.post('/api/rooms/update-stats', (req, res) => {
        const { id, new_elec, new_water } = req.body;
        const sql = 'UPDATE rooms SET current_elec = ?, current_water = ? WHERE id = ?';
        DBConnection.query(sql, [new_elec, new_water, id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });

    router.get('/api/invoices', async (req, res) => {
        const db = DBConnection.promise();
        try {
            const [rows] = await db.query(
                'SELECT * FROM invoices ORDER BY created_at DESC'
            );
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/api/invoices/add', async (req, res) => {
        const db = DBConnection.promise();
        const { room_id, room_name, total_amount, details } = req.body;

        const now = new Date();
        const invoice_date = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;

        try {
            const [result] = await db.query(
                'INSERT INTO invoices (room_id, room_name, invoice_date, total_amount, details) VALUES (?, ?, ?, ?, ?)',
                [room_id, room_name, invoice_date, total_amount, details]
            );
            res.json({ success: true, id: result.insertId });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/api/invoices/delete', async (req, res) => {
        const db = DBConnection.promise();
        const { id } = req.body;
        try {
            await db.query('DELETE FROM invoices WHERE id = ?', [id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
};
