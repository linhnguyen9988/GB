'use strict';

const GBZaloSystemNotice = (() => {
  const clean = value => String(value || '').normalize('NFC').replace(/\s+/g, ' ').trim().replace(/[.!]$/, '').trim();
  const aliasSuffix = /\s*[·•|–-]\s*KH\d{1,20}$/u;
  function isFriendAdded(text, customerName) {
    if (typeof text !== 'string' || text.length > 400) return false;
    // Zalo also sends an acceptance card as a normal message. Its title and
    // built-in illustration become two plaintext lines in older stored rows.
    const artwork = /\s+https?:\/\/res-zalo\.zadn\.vn\/upload\/media\/2019\/10\/11\/artboard_5_4_x_2x_1570759790847_74009\.png(?:\?[^\s]*)?\s*$/iu;
    const hasArtwork = artwork.test(text);
    const title = clean(text.replace(artwork, ''));
    const accepted = /^(.+) đã đồng ý kết bạn$/u.exec(title);
    const match = /^Bạn vừa kết bạn với (.+)$/u.exec(title) || accepted;
    if (!match) return false;
    const name = clean(match[1]);
    const expected = clean(customerName).replace(aliasSuffix, '').trim();
    const actual = name.replace(aliasSuffix, '').trim();
    return Boolean(accepted && hasArtwork) || aliasSuffix.test(name) || Boolean(expected && actual === expected);
  }
  function isSystemMessage(row, customerName) {
    if (row?.channel !== 'zalo') return false;
    let template = row.template_json ?? row.template;
    if (typeof template === 'string') {
      try { template = JSON.parse(template); } catch (_) { template = null; }
    }
    if (template?.template_type === 'zalo_system') return true;
    return !template && !(row.image || row.messageImg) &&
      isFriendAdded(row.message ?? row.messageText, customerName || row.fbname || row.ten_khach);
  }
  return { isFriendAdded, isSystemMessage };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = GBZaloSystemNotice;
