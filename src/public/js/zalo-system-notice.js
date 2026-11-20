'use strict';

const GBZaloSystemNotice = (() => {
  const clean = value => String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim().replace(/[.!]$/, '').trim();
  const aliasSuffix = /\s*[·•|–-]\s*KH\d{1,20}$/u;
  function isFriendAdded(text, customerName) {
    if (typeof text !== 'string' || text.length > 400) return false;
    const match = /^Bạn vừa kết bạn với (.+)$/u.exec(clean(text));
    if (!match) return false;
    const name = clean(match[1]);
    const expected = clean(customerName).replace(aliasSuffix, '').trim();
    const actual = name.replace(aliasSuffix, '').trim();
    return aliasSuffix.test(name) || Boolean(expected && actual === expected);
  }
  return { isFriendAdded };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = GBZaloSystemNotice;
