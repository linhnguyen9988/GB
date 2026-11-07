'use strict';

const { createHash } = require('node:crypto');
const db = require('../configs/DBConnection');
const viettel = require('./viettelAccountService');

function configurationError(message) {
    return Object.assign(new Error(message), { shippingConfiguration: true });
}

async function getDefault() {
    const [[row]] = await db.query('SELECT carrier, account_id FROM shipping_default WHERE id = 1');
    return row?.carrier && row.account_id ? { carrier: row.carrier, accountId: String(row.account_id) } : null;
}

async function requireDefault(carrier) {
    const selected = await getDefault();
    if (!selected) throw configurationError('Chưa chọn tài khoản lên đơn mặc định trong trang quản trị.');
    if (selected.carrier !== carrier) {
        const name = selected.carrier === 'jt' ? 'J&T' : 'Viettel Post';
        throw configurationError(`Đơn vị lên đơn mặc định là ${name}. Hãy tải lại trang để lên đơn đúng hãng.`);
    }
    return selected.accountId;
}

async function getViettelAddressAccount(appUserId) {
    const selected = await getDefault();
    if (selected?.carrier === 'viettel') return viettel.getActiveAccountById(selected.accountId);
    return viettel.getDefaultAccount(appUserId);
}

async function listAccounts() {
    const [jt] = await db.query('SELECT CAST(id AS CHAR) AS accountId, customer_code AS label FROM jt_accounts ORDER BY customer_code');
    const [vt] = await db.query(`SELECT CAST(userid AS CHAR) AS accountId,
        CONCAT(COALESCE(NULLIF(warehouse_name, ''), 'Kho'), ' · ', userid) AS label
        FROM vietteltoken WHERE is_active = 1 AND NULLIF(token_enc, '') IS NOT NULL
        AND groupaddressid AND cusid AND NULLIF(order_service, '') IS NOT NULL ORDER BY userid`);
    return [...jt.map(row => ({ ...row, carrier: 'jt' })), ...vt.map(row => ({ ...row, carrier: 'viettel' }))];
}

async function saveJTAccount(value) {
    const customerCode = typeof value === 'string' ? value.trim() : '';
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(customerCode)) throw configurationError('CustomerCode không hợp lệ.');
    const key = process.env.JT_KEY;
    if (!key || !key.trim()) throw configurationError('Chưa cấu hình JT_KEY trên máy chủ GB.');
    const password = createHash('md5').update(key + 'jadada369t3', 'utf8').digest('hex').toUpperCase();
    const encrypted = viettel.encryptSecret(password);
    await db.execute(`INSERT INTO jt_accounts (customer_code, password_enc) VALUES (?, ?)
        ON DUPLICATE KEY UPDATE password_enc = VALUES(password_enc)`, [customerCode, encrypted]);
}

async function getJTAccount(accountId) {
    const [[row]] = await db.query('SELECT CAST(id AS CHAR) AS id, customer_code, password_enc FROM jt_accounts WHERE id = ?', [accountId]);
    if (!row) throw configurationError('Không tìm thấy tài khoản J&T đã lưu cho đơn.');
    return { id: row.id, customerCode: row.customer_code, password: viettel.decryptSecret(row.password_enc) };
}

async function setDefault(carrier, value) {
    const accountId = String(value ?? '').trim();
    if (!['jt', 'viettel'].includes(carrier) || !/^\d{1,20}$/.test(accountId)) {
        throw configurationError('Chọn một tài khoản vận chuyển hợp lệ.');
    }
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[setting]] = await conn.query('SELECT id FROM shipping_default WHERE id = 1 FOR UPDATE');
        if (!setting) throw configurationError('Chưa khởi tạo cấu hình vận chuyển. Hãy chạy migration.');
        const sql = carrier === 'jt'
            ? 'SELECT CAST(id AS CHAR) AS id FROM jt_accounts WHERE id = ? FOR UPDATE'
            : `SELECT CAST(userid AS CHAR) AS id FROM vietteltoken WHERE userid = ? AND is_active = 1
               AND NULLIF(token_enc, '') IS NOT NULL AND groupaddressid AND cusid
               AND NULLIF(order_service, '') IS NOT NULL FOR UPDATE`;
        const [[account]] = await conn.query(sql, [accountId]);
        if (!account) throw configurationError('Tài khoản không còn hoạt động hoặc chưa cấu hình đủ.');
        await conn.execute('UPDATE shipping_default SET carrier = ?, account_id = ? WHERE id = 1', [carrier, String(account.id)]);
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = { getDefault, requireDefault, getViettelAddressAccount, listAccounts, saveJTAccount, getJTAccount, setDefault };
