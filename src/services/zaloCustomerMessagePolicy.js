'use strict';

const db = require('../configs/DBConnection');
const foreignCustomerMessage = 'Khách có nhãn Nước ngoài, GB không gửi tin nhắn Zalo.';

function isForeignCustomer(customer) {
    return [customer?.nuocngoai, customer?.label].some(value =>
        String(value || '').normalize('NFC').trim().toLocaleLowerCase('vi').includes('nước ngoài'));
}

async function hasForeignRecipient({ phone, uid, accountId }) {
    // The admin test form addresses a phone/UID rather than a customer row.
    // Match all linked rows: a newer domestic row must not hide a foreign label.
    const digits = String(phone || '').replace(/^\+?84/, '0');
    const variants = [digits, '84' + digits.slice(1)];
    const [rows] = await db.query(
        `SELECT nuocngoai, label FROM khachhang
         WHERE (zalo_account_id = ? AND zaloid = ?)
            OR REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '.', ''), '-', ''), '(', ''), ')', ''), '+', '') IN (?, ?)`,
        [accountId, uid, ...variants]
    );
    return rows.some(isForeignCustomer);
}

module.exports = { isForeignCustomer, hasForeignRecipient, foreignCustomerMessage };
