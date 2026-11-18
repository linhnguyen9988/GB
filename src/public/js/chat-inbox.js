'use strict';

const GBChatInbox = (() => {
  function init(pageIds) {
    const openBtn = document.getElementById('open-messenger-btn');
    const closeBtn = document.getElementById('close-messenger-btn');
    const messengerPane = document.getElementById('messenger-pane');
    const chatList = document.getElementById('chat-list');
    if (!openBtn || !closeBtn || !messengerPane || !chatList) return { addMessageToTop() {} };
    let refreshing = false;

    function addMessageToTop(msg) {
      const sentByPage = pageIds.includes(String(msg.senderId));
      const customerId = String(sentByPage ? msg.recipientId : msg.senderId);
      const pageId = String(sentByPage ? msg.senderId : msg.recipientId);
      if (!/^\d+$/.test(customerId) || !pageIds.includes(pageId)) return;
      const timestamp = Number(msg.message_timestamp || msg.timestamp) || Date.parse(msg.timestamp) || 0;
      const oldItem = chatList.querySelector(`[data-customer-id="${CSS.escape(customerId)}"][data-sender-page-id="${CSS.escape(pageId)}"]`);
      if (oldItem && (Number(oldItem.dataset.timestamp) > timestamp || (msg.messid && oldItem.dataset.mid === String(msg.messid)))) return;

      const customerName = msg.fbname || 'Khách hàng';
      const avatar = document.createElement('img');
      avatar.className = 'chat-avatar';
      const defaultAvatar = '/images/ava/default.jpg';
      avatar.src = GBChatMessageView.safeUrl(msg.picture) || '/images/ava/' + encodeURIComponent(customerId) + '.jpg';
      avatar.addEventListener('error', () => { avatar.src = defaultAvatar; }, { once: true });

      const info = document.createElement('div');
      info.className = 'chat-info';
      const name = document.createElement('p');
      name.className = 'chat-name';
      const pageIcon = document.createElement('i');
      pageIcon.className = pageId === pageIds[1] ? 'bi bi-2-square' : 'bi bi-1-square';
      const label = typeof msg.label === 'string' && msg.label.includes('hàng') ? ' - ' + msg.label.replace(' hàng', '') : '';
      name.append(customerName + ' ', pageIcon, label);

      const preview = document.createElement('p');
      preview.className = 'last-message';
      if (msg.channel === 'zalo') {
        const badge = document.createElement('span');
        badge.className = 'zalo-message-icon';
        badge.title = 'Zalo';
        badge.setAttribute('aria-label', 'Zalo');
        badge.textContent = 'Z';
        preview.append(badge, ' ');
      }

      let text = msg.messageText || '';
      if (!text && msg.template) {
        try {
          const template = typeof msg.template === 'string' ? JSON.parse(msg.template) : msg.template;
          text = '🔘 ' + (template.text || 'Tin nhắn có nút bấm');
        } catch (_) {
          text = '🔘 Tin nhắn có nút bấm';
        }
      }
      preview.append((sentByPage ? 'Bạn: ' : '') + (text || (msg.messageImg ? 'Tệp đính kèm' : '')));
      info.append(name, preview);

      // Keep the existing attachment previews without loading attachments outside the visible pane.
      const attachments = typeof msg.messageImg === 'string' ? msg.messageImg.split(';') : [];
      const media = document.createElement('div');
      media.className = 'message-images';
      for (const part of attachments) {
        const url = GBChatMessageView.safeUrl(part.trim());
        if (!url) continue;
        const path = new URL(url).pathname.toLowerCase();
        const kind = /\.(mp4|webm|mov)$/.test(path) ? 'video'
          : /\.(mp3|wav|aac|m4a)$/.test(path) || path.includes('audioclip') ? 'audio'
          : msg.channel === 'zalo' || /\.(jpg|jpeg|png|gif|webp)$/.test(path) ? 'img' : null;
        if (!kind) continue;
        const element = document.createElement(kind);
        element.src = url;
        if (kind === 'img') {
          element.alt = '';
          element.loading = 'lazy';
        } else {
          element.className = 'message-' + kind;
          element.preload = 'none';
          if (kind === 'audio') element.controls = true;
        }
        media.appendChild(element);
      }
      if (media.childElementCount) info.append(media);

      const item = document.createElement('a');
      item.href = '#';
      item.className = 'chat-item open-message-modal no-underline-link';
      Object.assign(item.dataset, { customerId, customerName, senderPageId: pageId, timestamp, mid: msg.messid || '' });
      item.append(avatar, info);
      oldItem?.remove();

      const older = Array.from(chatList.querySelectorAll('.chat-item'))
        .find(row => Number(row.dataset.timestamp) <= timestamp);
      chatList.insertBefore(item, older || null);
      while (chatList.querySelectorAll('.chat-item').length > 100) chatList.lastElementChild.remove();
    }

    async function fetchLastMessages() {
      if (refreshing || document.hidden || !messengerPane.classList.contains('is-open')) return;
      refreshing = true;
      try {
        const response = await fetch('/api/last-messages', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const messages = await response.json();
        const status = chatList.querySelector('[data-inbox-status]');
        status?.remove();
        for (const msg of messages) {
          addMessageToTop({
            messid: msg.messid,
            timestamp: msg.timestamp,
            senderId: msg.sender,
            recipientId: msg.recipient,
            messageText: msg.message,
            fbname: msg.ten_khach,
            messageImg: msg.image,
            template: msg.template_json,
            label: msg.label,
            channel: msg.channel
          });
        }
      } catch (error) {
        console.error('Không thể lấy dữ liệu tin nhắn:', error);
        if (!chatList.querySelector('.chat-item, [data-inbox-status]')) {
          const status = document.createElement('p');
          status.dataset.inboxStatus = 'error';
          status.className = 'text-center text-body-secondary';
          status.textContent = 'Không thể tải tin nhắn. Đang thử lại…';
          chatList.appendChild(status);
        }
      } finally {
        refreshing = false;
      }
    }

    openBtn.addEventListener('click', () => {
      if (messengerPane.classList.toggle('is-open')) void fetchLastMessages();
    });
    closeBtn.addEventListener('click', () => messengerPane.classList.remove('is-open'));
    setInterval(fetchLastMessages, 6000);

    return { addMessageToTop };
  }

  return { init };
})();
