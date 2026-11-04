'use strict';
const { normalizeSQL } = require('../utils/address');

async function getProvinces(db) {
    const [rows] = await db.query(
        'SELECT DISTINCT prov FROM jtaddress WHERE prov IS NOT NULL AND prov <> "" ORDER BY prov ASC'
    );
    return rows.map(r => r.prov);
}

async function getDistricts(db, prov) {
    const [rows] = await db.query(
        'SELECT DISTINCT district FROM jtaddress WHERE prov = ? AND district IS NOT NULL AND district <> "" ORDER BY district ASC',
        [prov]
    );
    return rows.map(r => r.district);
}

async function getWards(db, prov, district) {
    const [rows] = await db.query(
        'SELECT DISTINCT ward FROM jtaddress WHERE prov = ? AND district = ? AND ward IS NOT NULL AND ward <> "" ORDER BY ward ASC',
        [prov, district]
    );
    return rows.map(r => r.ward);
}

function stripAdminPrefix(str) {
    let t = (str || '').toLowerCase().normalize('NFC');
    t = t.replace(/[–—]/g, '-');
    t = t.replace(/-\s*\d{2,3}[a-z]+\d*\s*$/i, '');
    t = t.replace(/\s+/g, ' ').trim();
    const m = t.match(/^(tỉnh|thành phố|thanh pho|tp\.?|thị xã|thi xã|tx\.?|thị trấn|thi trấn|tt\.?|huyện|quận|phường|xã|p\.|q\.|h\.|x\.)\s+(\S.*)$/i);
    if (!m) return t;
    if (/^\d+$/.test(m[2])) return t;
    return m[2];
}

function sqlField(expr) {
    return normalizeSQL(`REPLACE(REPLACE(LOWER(${expr}),'–','-'),'—','-')`);
}

async function findByLike(db, column, term, extraWhere, extraParams) {
    if (!term) return '';
    const where = extraWhere ? ` AND ${extraWhere}` : '';
    const [r1] = await db.query(
        `SELECT DISTINCT ${column} AS v FROM jtaddress
         WHERE ${sqlField(column)} LIKE ${sqlField('?')}${where}
         ORDER BY (LOWER(${column}) = ?) DESC, LENGTH(${column}) ASC
         LIMIT 1`,
        [`%${term}%`, ...extraParams, term]
    );
    if (r1.length) return r1[0].v;

    const [r2] = await db.query(
        `SELECT DISTINCT ${column} AS v FROM jtaddress
         WHERE ${sqlField('?')} LIKE CONCAT('%', ${sqlField(column)}, '%')
           AND ${column} IS NOT NULL AND ${column} <> ''${where}
         ORDER BY LENGTH(${column}) DESC
         LIMIT 1`,
        [term, ...extraParams]
    );
    return r2.length ? r2[0].v : '';
}

async function suggestProvDistrict(db, tinh, huyen) {
    const out = { tinhjt: '', huyenjt: '' };
    const sProv = stripAdminPrefix(tinh);
    const sDist = stripAdminPrefix(huyen);
    if (!sProv) return out;

    out.tinhjt = await findByLike(db, 'prov', sProv, '', []);
    if (!out.tinhjt || !sDist) return out;

    out.huyenjt = await findByLike(db, 'district', sDist, 'prov = ?', [out.tinhjt]);
    return out;
}

async function getExact(db, prov, district, ward) {
    const [rows] = await db.query(
        'SELECT * FROM jtaddress WHERE prov = ? AND district = ? AND ward = ? LIMIT 1',
        [prov, district, ward]
    );
    return rows[0] || null;
}

module.exports = { stripAdminPrefix, getProvinces, getDistricts, getWards, suggestProvDistrict, getExact };
