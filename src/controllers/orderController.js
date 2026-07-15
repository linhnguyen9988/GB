import DBConnection from "../configs/DBConnection";
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
        let sql = "SELECT l.*, k.pageid FROM lendon l INNER JOIN khachhang k ON l.userid = k.userid WHERE DATE(l.time) BETWEEN ? AND ?";
        let params = [finalStartDate, finalEndDate];

        if (search.trim() !== "") {
            sql += " AND realorderid LIKE ?";
            params.push(`%${search}%`);
        }

        sql += " ORDER BY time DESC";

        const [rows] = await db.execute(sql, params); 

        return res.render("donhang.ejs", {
            user: req.user,
            orders: rows,
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