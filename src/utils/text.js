'use strict';
function LocDau(str) {
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function normalizePhone(raw) {
    let p = String(raw || '').replace(/[\s.\-()]/g, '');
    if (p.startsWith('+84')) p = '0' + p.slice(3);
    else if (/^84\d{9}$/.test(p)) p = '0' + p.slice(2);
    return p;
}

function toE164VN(phone) {
    if (!phone) return null;
    let p = String(phone).replace(/[^\d+]/g, '');
    if (p.startsWith('+84')) p = p;
    else if (p.startsWith('84')) p = '+' + p;
    else if (p.startsWith('0')) p = '+84' + p.slice(1);
    else return null;
    return /^\+84\d{9,10}$/.test(p) ? p : null;
}

module.exports = { LocDau, normalizePhone, toE164VN };
