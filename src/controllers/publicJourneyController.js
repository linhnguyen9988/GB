// controllers/publicJourneyController.js
// Trang public cho khách xem thông tin đơn hàng + hành trình vận chuyển.
// KHÔNG yêu cầu đăng nhập — chỉ cần đúng mã đơn hàng là xem được.
import DBConnection from "../configs/DBConnection";

// Trạng thái -> màu badge (đồng bộ với statusBadgeClass() trong headerafterlogin.ejs)
const STATUS_COLOR_MAP = {
    100: 'secondary', 101: 'secondary', 102: 'secondary', 103: 'secondary', 104: 'secondary', 105: 'secondary', 106: 'secondary',
    200: 'info', 201: 'info', 202: 'info', 300: 'info', 400: 'info', 401: 'info', 402: 'info', 403: 'info', 509: 'info',
    500: 'primary', 508: 'primary', 550: 'primary',
    501: 'success',
    505: 'warning', 506: 'warning', 507: 'warning',
    515: 'danger', 551: 'danger',
    504: 'danger',
};

function getStatusColor(statuscode) {
    if (statuscode === null || statuscode === undefined) return 'secondary';
    return STATUS_COLOR_MAP[Number(statuscode)] || 'secondary';
}

function formatVNDateTime(value) {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    const p = (n) => n.toString().padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Chuẩn hoá mã đơn khách nhập: bỏ khoảng trắng, chữ hoa; hỗ trợ mã "hoàn 1 phần" (hậu tố 1P1)
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

async function fetchJourneyLogs(db, orderCode, provider) {
    if (provider === 'J&T') {
        const [rows] = await db.query(
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
            [orderCode]
        );
        return rows;
    }

    const [rows] = await db.query(
        `SELECT * FROM order_logs WHERE order_number = ? ORDER BY id DESC`,
        [orderCode]
    );
    return rows;
}

// GET /journey  -> trang tra cứu (nhập mã đơn)
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

// GET /journey/:madonhang  -> trang chi tiết đơn hàng + hành trình
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
        const logs = await fetchJourneyLogs(db, order.realorderid, order.provider || 'Viettel');

        return res.render('journey.ejs', {
            mode: 'detail',
            errorMessage: null,
            order: {
                ...order,
                partial,
                statusColor: getStatusColor(order.statuscode),
                dateDisplay: order.date || formatVNDateTime(order.time),
            },
            logs: logs.map((l) => ({
                ...l,
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
