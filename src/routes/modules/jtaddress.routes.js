'use strict';
const DBConnection = require('../../configs/DBConnection');
const jwtAuth = require('../../middleware/jwtAuth');
const jtAddr = require('../../services/jtAddressService');

module.exports = function registerJtAddressRoutes(router) {
    router.get('/jtaddress/provinces', jwtAuth, async function (req, res) {
        try {
            res.json({ success: true, data: await jtAddr.getProvinces(DBConnection.promise()) });
        } catch (e) {
            console.error('Lỗi /jtaddress/provinces:', e.message);
            res.status(500).json({ success: false, message: 'Lỗi server' });
        }
    });

    router.get('/jtaddress/districts', jwtAuth, async function (req, res) {
        const prov = (req.query.prov || '').trim();
        if (!prov) return res.json({ success: true, data: [] });
        try {
            res.json({ success: true, data: await jtAddr.getDistricts(DBConnection.promise(), prov) });
        } catch (e) {
            console.error('Lỗi /jtaddress/districts:', e.message);
            res.status(500).json({ success: false, message: 'Lỗi server' });
        }
    });

    router.get('/jtaddress/wards', jwtAuth, async function (req, res) {
        const prov = (req.query.prov || '').trim();
        const district = (req.query.district || '').trim();
        if (!prov || !district) return res.json({ success: true, data: [] });
        try {
            res.json({ success: true, data: await jtAddr.getWards(DBConnection.promise(), prov, district) });
        } catch (e) {
            console.error('Lỗi /jtaddress/wards:', e.message);
            res.status(500).json({ success: false, message: 'Lỗi server' });
        }
    });

    router.post('/savejtaddress', jwtAuth, async function (req, res) {
        const { id, tinhjt, huyenjt, xajt } = req.body || {};
        if (!id || !tinhjt || !huyenjt || !xajt) {
            return res.status(400).json({ success: false, message: 'Thiếu id, tỉnh, huyện hoặc xã' });
        }
        try {
            const db = DBConnection.promise();
            const jt = await jtAddr.getExact(db, tinhjt, huyenjt, xajt);
            if (!jt) {
                return res.json({ success: false, message: 'Địa chỉ không có trong dữ liệu J&T' });
            }
            const [r] = await db.query(
                'UPDATE diachilendon SET xajt=?, huyenjt=?, tinhjt=?, xamoi=?, tinhmoi=? WHERE id=?',
                [jt.ward, jt.district, jt.prov, jt.newward, jt.newprov, id]
            );
            if (!r.affectedRows) {
                return res.json({ success: false, message: 'Không tìm thấy địa chỉ cần cập nhật' });
            }
            res.json({
                success: true,
                xajt: jt.ward, huyenjt: jt.district, tinhjt: jt.prov,
                xamoi: jt.newward, tinhmoi: jt.newprov
            });
        } catch (e) {
            console.error('Lỗi /savejtaddress:', e.message);
            res.status(500).json({ success: false, message: 'Lỗi server' });
        }
    });
};
