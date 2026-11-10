'use strict';
const DBConnection = require("../configs/DBConnection");
const { get: getOrderStatus } = require('../public/js/order-status');

function formatVNDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    const p = (n) => n.toString().padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function normalizeOrderCode(raw) {
    if (!raw) return { code: '', partial: false };
    let code = String(raw).trim().toUpperCase();
    let partial = false;
    if (code.includes('1P1')) {
        code = code.replace('1P1', '');
        partial = true;
    }
    return { code, partial };
}

async function fetchJourneyLogs(db, { realorderid: orderCode, provider, cod }) {
    if (provider === 'J&T') {
        const [rows] = await db.query(
            `SELECT
               scantime        AS status_date_raw,
               scantypename    AS status_name,
               CONCAT_WS(', ', NULLIF(scanward,''), NULLIF(scancity,''), NULLIF(scanprov,'')) AS location,
               scanbyname      AS employee_name,
               scanbycontact   AS employee_phone,
               issuename       AS note,
               ?               AS money_collection,
               scantypecode    AS status_code
             FROM jtwaybill
             WHERE billcode = ?
             ORDER BY scantime DESC`,
            [cod ?? 0, orderCode]
        );
        return rows;
    }

    const [rows] = await db.query(
        `SELECT * FROM order_logs WHERE order_number = ? ORDER BY id DESC`,
        [orderCode]
    );
    return rows;
}

const handleJourneySearch = async (req, res) => {
    const rawCode = (req.query.madonhang || req.query.code || '').toString().trim();
    if (!rawCode) {
        return res.render('journey.ejs', {
            mode: 'search',
            errorMessage: null,
            order: null,
            logs: [],
            searchedCode: '',
        });
    }
    return res.redirect('/journey/' + encodeURIComponent(rawCode));
};

const handleJourneyDetail = async (req, res) => {
    try {
        const db = DBConnection.promise();
        const { code: orderCode, partial } = normalizeOrderCode(req.params.madonhang);

        if (!orderCode) {
            return res.render('journey.ejs', {
                mode: 'search',
                errorMessage: 'Vui lòng nhập mã đơn hàng.',
                order: null,
                logs: [],
                searchedCode: '',
            });
        }

        const [rows] = await db.query(
            `SELECT realorderid, orderid, name, phone, address, cod, kg,
                    statuscode, statustext, date, time, provider
             FROM lendon
             WHERE realorderid = ? OR orderid = ?
             ORDER BY time DESC
             LIMIT 1`,
            [orderCode, orderCode]
        );

        if (!rows.length) {
            return res.render('journey.ejs', {
                mode: 'not_found',
                errorMessage: 'Không tìm thấy đơn hàng với mã này. Vui lòng kiểm tra lại.',
                order: null,
                logs: [],
                searchedCode: req.params.madonhang,
            });
        }

        const order = rows[0];
        const logs = await fetchJourneyLogs(db, order);

        return res.render('journey.ejs', {
            mode: 'detail',
            errorMessage: null,
            order: {
                ...order,
                partial,
                badge: getOrderStatus(order.provider, order.statuscode, order.statustext),
                dateDisplay: order.date || formatVNDateTime(order.time),
            },
            logs: logs.map((l) => ({
                ...l,
                badge: getOrderStatus(order.provider, l.status_code, l.status_name),
                timeDisplay: formatVNDateTime(l.status_date_raw) || l.status_date_raw || '',
                codDisplay: new Intl.NumberFormat('vi-VN').format(Number(l.money_collection) || 0),
            })),
            searchedCode: order.realorderid,
        });
    } catch (error) {
        console.error('Lỗi tại handleJourneyDetail:', error);
        return res.status(500).render('journey.ejs', {
            mode: 'error',
            errorMessage: 'Có lỗi xảy ra khi tra cứu đơn hàng. Vui lòng thử lại sau.',
            order: null,
            logs: [],
            searchedCode: '',
        });
    }
};

module.exports = {
    handleJourneySearch,
    handleJourneyDetail,
};
