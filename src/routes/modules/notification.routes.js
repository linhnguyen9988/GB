import DBConnection from "../../configs/DBConnection";

module.exports = function registerNotificationRoutes(router) {
    router.post('/api/fcm-token', async (req, res) => {
        const db = DBConnection.promise();
        const { userId, token } = req.body;
        if (!userId || !token) return res.status(400).json({ error: 'Missing userId or token' });
        try {
            await db.query(
                `INSERT INTO fcm_tokens (userid, token, updated_at)
                 VALUES (?, ?, NOW())
                 ON DUPLICATE KEY UPDATE userid = VALUES(userid), updated_at = NOW()`,
                [userId, token]
            );
            res.json({ ok: true });
        } catch (e) {
            console.error('[FCM] Save token error:', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/api/fcm-token/remove', async (req, res) => {
        const db = DBConnection.promise();
        const { userId, token } = req.body;
        if (!userId || !token) return res.status(400).json({ error: 'Missing userId or token' });
        try {
            await db.query(
                'DELETE FROM fcm_tokens WHERE userid = ? AND token = ?',
                [userId, token]
            );
            res.json({ ok: true });
        } catch (e) {
            console.error('[FCM] Remove token error:', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    const { sendFcmToUser } = require('../fcm');

    router.post('/sendnoti', async (req, res) => {
        const db = DBConnection.promise();
        await sendFcmToUser(db,
            '1', // test userId
            '505: 139219956547',
            'xxxxx',
            { type: 'order_status', realorderid: '139219956547' }
        );
        res.json({ success: true, message: 'Đã gửi' });
    });
};
