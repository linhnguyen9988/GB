'use strict';
const DBConnection = require("../configs/DBConnection");
const { get: getOrderStatus } = require('../public/js/order-status');
let handleOrder = async (req, res) => {
    try {
        const db = DBConnection.promise();
        const search = req.query.search || '';
        const start_date = req.query.start_date;
        const end_date = req.query.end_date;

        const today = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);

        const defaultStart = sevenDaysAgo.toISOString().split('T')[0];
        const defaultEnd = today.toISOString().split('T')[0];

        const finalStartDate = start_date || defaultStart;
        const finalEndDate = end_date || defaultEnd;
        let sql = `SELECT l.*, COALESCE(k.pageid, (
                    SELECT legacy.pageid FROM khachhang legacy
                    WHERE legacy.userid = l.userid ORDER BY legacy.id DESC LIMIT 1
                )) AS pageid
                FROM lendon l
                LEFT JOIN khachhang k ON k.id = l.khid
                WHERE DATE(l.time) BETWEEN ? AND ?`;
        let params = [finalStartDate, finalEndDate];

        if (search.trim() !== "") {
            sql += " AND l.realorderid LIKE ?";
            params.push(`%${search}%`);
        }

        sql += " ORDER BY l.time DESC";

        const [rows] = await db.execute(sql, params); 

        return res.render("donhang.ejs", {
            user: req.user,
            orders: rows,
            getOrderStatus,
            searchQuery: search,
            startDate: finalStartDate,
            endDate: finalEndDate
        });

    } catch (error) {
        console.error("Lỗi tại handleOrder:", error);
        return res.status(500).send("Có lỗi xảy ra khi tải danh sách đơn hàng.");
    }
};

module.exports = {
    handleOrder: handleOrder,
};
