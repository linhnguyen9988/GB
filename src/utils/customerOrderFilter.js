'use strict';

const { jtCancelled, viettelCancelled } = require('../public/js/order-status');

function customerOrderFilter(userid, realfbid) {
    const conditions = [];
    const params = [];
    const user = String(userid ?? '').trim();
    const facebook = String(realfbid ?? '').trim();
    if (user && !['0', 'null', 'undefined'].includes(user)) {
        conditions.push(
            'l.userid = ?',
            'l.khid IN (SELECT id FROM khachhang WHERE userid = ?)',
            `l.realfbid IN (SELECT realfbid FROM khachhang
                WHERE userid = ? AND realfbid NOT IN ('', '0', 'null', 'undefined'))`
        );
        params.push(user, user, user);
    }
    if (facebook && !['0', 'null', 'undefined'].includes(facebook)) {
        conditions.push('l.realfbid = ?');
        params.push(facebook);
    }
    if (!conditions.length) return null;
    const where = `(${conditions.join(' OR ')}) AND
        CASE WHEN l.provider = 'J&T' THEN COALESCE(l.statuscode, 0) <> ${jtCancelled}
             ELSE COALESCE(l.statuscode, 0) NOT IN (${viettelCancelled.join(', ')}) END`;
    return { where, params };
}

module.exports = { customerOrderFilter };
