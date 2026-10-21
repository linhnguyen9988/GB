import DBConnection from "../configs/DBConnection";

const AKA_SQL = "(SELECT GROUP_CONCAT(DISTINCT k2.fbname SEPARATOR ' - ') FROM khachhang k2 WHERE khachhang.phone IS NOT NULL AND khachhang.phone<>'' AND k2.phone=khachhang.phone AND k2.userid<>khachhang.userid AND (khachhang.realfbid IS NULL OR khachhang.realfbid='' OR k2.realfbid IS NULL OR k2.realfbid<>khachhang.realfbid)) AS aka";

function attachAka(rows, cb) {
    rows = rows || [];
    var phones = [];
    var seenPhone = {};
    rows.forEach(function (r) {
        var ph = (r.phone || '').toString().trim();
        if (ph.length >= 9 && !seenPhone[ph]) { seenPhone[ph] = true; phones.push(ph); }
    });
    if (phones.length === 0) {
        rows.forEach(function (r) { r.aka = ''; });
        return cb(rows);
    }
    DBConnection.query('SELECT userid, realfbid, fbname, phone FROM khachhang WHERE phone IN (?)', [phones], function (error, list) {
        if (error) {
            console.error('attachAka:', error);
            rows.forEach(function (r) { r.aka = ''; });
            return cb(rows);
        }
        var byPhone = {};
        list.forEach(function (o) {
            var ph = (o.phone || '').toString().trim();
            (byPhone[ph] = byPhone[ph] || []).push(o);
        });
        rows.forEach(function (r) {
            var ph = (r.phone || '').toString().trim();
            var seen = {};
            var names = [];
            (byPhone[ph] || []).forEach(function (o) {
                if (String(o.userid) === String(r.userid)) return;
                if (r.realfbid && String(o.realfbid) === String(r.realfbid)) return;
                var key = o.realfbid ? 'r' + o.realfbid : 'u' + o.userid;
                if (seen[key]) return;
                seen[key] = true;
                names.push(o.fbname);
            });
            r.aka = names.join(' - ');
        });
        cb(rows);
    });
}

function attachAkaCount(rows, cb) {
    var phones = [];
    rows.forEach(function (r) {
        var ph = (r.phone || '').toString().trim();
        if (ph.length >= 9 && phones.indexOf(ph) === -1) phones.push(ph);
    });
    if (phones.length === 0) {
        rows.forEach(function (r) { r.akacount = 0; r.aka = ''; });
        return cb(rows);
    }
    DBConnection.query(
        "SELECT phone, COUNT(DISTINCT IF(realfbid IS NULL OR realfbid='', userid, realfbid)) AS cnt FROM khachhang WHERE phone IN (?) GROUP BY phone",
        [phones],
        function (error, counts) {
            var map = {};
            if (!error && counts) counts.forEach(function (c) { map[c.phone] = c.cnt; });
            rows.forEach(function (r) {
                var c = map[(r.phone || '').toString().trim()] || 1;
                r.akacount = c > 1 ? c - 1 : 0;
                r.aka = r.akacount > 0 ? (r.aka || 'AKA') : '';
            });
            cb(rows);
        });
}

function dedupeByPerson(rows) {
    function rank(label) {
        label = label || '';
        if (label.indexOf('Xả') !== -1 || label.indexOf('Bom') !== -1) return 3;
        if (label.indexOf('Có') !== -1) return 2;
        return label ? 1 : 0;
    }
    function hasText(v) { return v !== null && v !== undefined && String(v).trim() !== '' && String(v) !== 'null'; }
    var groups = {};
    var order = [];
    (rows || []).forEach(function (r) {
        var key = (r.realfbid && String(r.realfbid).length > 0) ? 'r' + r.realfbid : 'u' + r.userid;
        if (!groups[key]) { groups[key] = []; order.push(key); }
        groups[key].push(r);
    });
    return order.map(function (key) {
        var g = groups[key];
        var best = g.slice().sort(function (x, y) { return rank(y.label) - rank(x.label); })[0];
        var out = Object.assign({}, g[0]);
        out.label = best.label;
        out.note = hasText(best.note) ? best.note : (g.find(function (x) { return hasText(x.note); }) || {}).note || '';
        out.diachi = hasText(best.diachi) ? best.diachi : (g.find(function (x) { return hasText(x.diachi); }) || {}).diachi || '';
        return out;
    });
}

module.exports = { AKA_SQL, attachAka, attachAkaCount, dedupeByPerson };
