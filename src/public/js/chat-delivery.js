'use strict';

const GBChatDelivery = (() => {
  const TTL = 24 * 60 * 60 * 1000;

  function createPendingStore(actor) {
    const key = 'gb_chat_pending_v2:' + actor;
    let memory = {};
    let storageUnavailable = false;
    const scope = (customer, page) => JSON.stringify([String(page), String(customer)]);
    function read() {
      if (storageUnavailable) return memory;
      try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; }
      catch (_) { storageUnavailable = true; return memory; }
    }
    function write(all) {
      memory = all;
      if (storageUnavailable) return;
      try { localStorage.setItem(key, JSON.stringify(all)); } catch (_) { storageUnavailable = true; }
    }
    function getPending(customer, page) {
      const entries = read()[scope(customer, page)];
      return Array.isArray(entries) ? entries.filter(entry => Date.now() - entry.createdAt <= TTL) : [];
    }
    function save(customer, page, entry) {
      const all = read();
      all[scope(customer, page)] = getPending(customer, page).filter(item => item.localId !== entry.localId).concat(entry);
      write(all);
    }
    function remove(customer, page, localId) {
      const all = read();
      const id = scope(customer, page);
      const entries = getPending(customer, page).filter(item => item.localId !== localId);
      if (entries.length) all[id] = entries;
      else delete all[id];
      write(all);
    }
    function purgeExpired() {
      const all = read();
      for (const [id, entries] of Object.entries(all)) {
        const active = Array.isArray(entries) ? entries.filter(entry => Date.now() - entry.createdAt <= TTL) : [];
        if (active.length) all[id] = active;
        else delete all[id];
      }
      write(all);
    }
    return { getPending, save, remove, purgeExpired };
  }

  async function send({ customerId, pageId, entry, channel, text, image }) {
    const form = new FormData();
    form.append('clientMessageId', entry.localId);
    form.append('customerId', customerId);
    form.append('currentPageID', pageId);
    if (entry.orderConfirmation) form.append('orderConfirmation', '1');
    if (channel === 'zalo') form.append('deliveryChannel', 'zalo');
    else if (entry.facebookRequired) form.append('deliveryChannel', 'facebook');
    if (text) form.append('message', text);
    if (image) form.append('image', image);
    const response = await fetch('/api/send-message', { method: 'POST', body: form });
    return response.json();
  }

  function complete(entry) {
    if (entry.facebookRequired) return Boolean((!entry.hasImage || entry.facebookImageSent) && (!entry.message || entry.facebookTextSent));
    const requireZalo = entry.zaloRequired ||
      (entry.hasImage && entry.message && (entry.zaloImageSent || entry.zaloTextSent));
    if (requireZalo) return Boolean((!entry.hasImage || entry.zaloImageSent) && (!entry.message || entry.zaloTextSent));
    return Boolean((!entry.hasImage || entry.imagePartSent) && (!entry.message || entry.textPartSent));
  }

  function confirm(entry, part, channel) {
    entry.zaloRequired ||= channel === 'zalo';
    if (part === 'image') {
      entry.imagePartSent = true;
      entry.zaloImageSent ||= channel === 'zalo';
      entry.facebookImageSent ||= channel === 'facebook';
    } else if (part === 'text') {
      entry.textPartSent = true;
      entry.zaloTextSent ||= channel === 'zalo';
      entry.facebookTextSent ||= channel === 'facebook';
    }
    entry.facebookPartSent ||= channel === 'facebook';
  }

  return { createPendingStore, send, complete, confirm };
})();
