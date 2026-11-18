'use strict';

const GBChatMessageView = (() => {
  function escape(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function safeUrl(value, allowBlob = false) {
    if (typeof value !== 'string' || !value) return '';
    try {
      const url = new URL(value, document.baseURI);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
      if (allowBlob && url.protocol === 'blob:' && url.origin === location.origin) return url.href;
    } catch (_) {}
    return '';
  }

  function buildReactionsHtml(reactions) {
    if (!reactions || !reactions.length) return '';
    const list = reactions
      .map(r => ({ emoji: (r.emoji === '❤') ? '❤️' : r.emoji, count: Number(r.count) || 1 }))
      .sort((x, y) => y.count - x.count);
    const total = list.reduce((sum, r) => sum + r.count, 0);
    const title = list.map(r => `${r.emoji} ${r.count}`).join('  ·  ');
    const emojis = list.slice(0, 3).map(r => `<span class="reaction-emoji">${escape(r.emoji)}</span>`).join('');
    const countHtml = total > 1 ? `<span class="reaction-count">${total}</span>` : '';
    return `<div class="message-reactions-container" title="${escape(title)}">${emojis}${countHtml}</div>`;
  }

  function create({ customerAvatarEl, pageIds, jumpToQuotedMessage }) {
    function formatTimestamp(timestampString) {
      if (!timestampString) return '';
      const date = new Date(timestampString);
      if (Number.isNaN(date.getTime())) return '';
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      const time = date.toLocaleTimeString('en-US', { hour12: true });
      return `${day}/${month}/${year}, ${time}`;
    }

    function getMediaKind(url, msg) {
      if (msg.channel === 'zalo') return 'image';
      const mime = typeof msg.fileType === 'string' ? msg.fileType.split('/')[0] : '';
      if (['image', 'audio', 'video'].includes(mime)) return mime;
      const path = new URL(url).pathname.toLowerCase();
      if (path.includes('audioclip') || /\.(mp3|wav|aac|flac|m4a|opus)$/.test(path)) return 'audio';
      if (/\.(mp4|webm|ogg|mov|mkv|avi|3gp)$/.test(path)) return 'video';
      if (/\.(jpg|jpeg|png|gif|bmp|webp|svg|avif|heic)$/.test(path)) return 'image';
      return '';
    }

    function createMedia(url, kind) {
      if (kind === 'image') {
        const img = document.createElement('img');
        img.src = url;
        img.classList.add('message-image', 'message-clickable');
        img.alt = 'Ảnh đính kèm';
        return img;
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'message-media-container';
      const media = document.createElement(kind);
      media.src = url;
      media.controls = true;
      media.preload = 'metadata';
      media.className = 'message-' + kind;
      wrapper.appendChild(media);
      return wrapper;
    }

    function renderAttachment(url, kind) {
      if (kind) return createMedia(url, kind);
      const attachment = document.createElement('a');
      attachment.href = url;
      attachment.target = '_blank';
      attachment.rel = 'noopener noreferrer';
      attachment.textContent = 'Mở tệp đính kèm';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      fetch(url, { method: 'HEAD', signal: controller.signal }).then(response => {
        if (!response.ok) return;
        const type = response.headers.get('Content-Type')?.split('/')[0];
        if (['image', 'audio', 'video'].includes(type)) attachment.replaceWith(createMedia(url, type));
      }).catch(() => {}).finally(() => clearTimeout(timeout));
      return attachment;
    }

    function buildTemplateButtonHtml(b) {
      if (!b) return '';
      const title = escape(b.title);
      const url = safeUrl(b.url);
      if (b.type === 'web_url' && url) {
        return `<a href="${escape(url)}" target="_blank" rel="noopener" class="message-template-btn"><i class="bi bi-box-arrow-up-right"></i> ${title || 'Xem'}</a>`;
      }
      if (b.type === 'phone_number' && /^[+0-9 ().-]+$/.test(b.payload || '')) {
        return `<a href="tel:${escape(b.payload)}" class="message-template-btn"><i class="bi bi-telephone-fill"></i> ${title || 'Gọi'}</a>`;
      }
      return `<span class="message-template-btn message-template-btn-disabled" title="Nút này không thể bấm lại từ khung chat admin"><i class="bi bi-hand-index-thumb"></i> ${title}</span>`;
    }

    function buildTemplateHtml(tpl) {
      if (!tpl) return '';

      if (tpl.template_type === 'reel' || tpl.template_type === 'ig_reel') {
        const reelUrl = safeUrl(tpl.url);
        const thumbnail = safeUrl(tpl.thumbnail);
        const pageName = tpl.text || (tpl.template_type === 'ig_reel' ? 'Instagram' : 'Facebook');
        const providerLabel = tpl.template_type === 'ig_reel' ? 'Instagram' : 'Facebook';
        const thumbHtml = thumbnail
          ? `<img src="${escape(thumbnail)}" class="message-reel-thumb" alt="Reel">`
          : `<div class="message-reel-thumb message-reel-thumb-empty"></div>`;
        return `<div class="message-template-card message-reel-card" data-reel-url="${escape(reelUrl)}">
          <div class="message-reel-media">
            ${thumbHtml}
            <div class="message-reel-play"><i class="bi bi-play-fill"></i></div>
          </div>
          <div class="message-reel-footer">
            <div class="message-reel-footer-text">
              <div class="message-reel-page-name">${escape(pageName)}</div>
              <div class="message-reel-provider">${providerLabel}</div>
            </div>
          </div>
        </div>`;
      }

      let html = `<div class="message-template-card">`;
      if (tpl.text) {
        html += `<div class="message-template-text">${escape(tpl.text).replace(/\n/g, '<br>')}</div>`;
      }
      if (Array.isArray(tpl.elements) && tpl.elements.length) {
        html += `<div class="message-template-elements">`;
        tpl.elements.forEach(el => {
          if (!el || typeof el !== 'object') return;
          html += `<div class="message-template-element">`;
          const imageUrl = safeUrl(el.image_url);
          if (imageUrl) html += `<img src="${escape(imageUrl)}" class="message-template-element-img">`;
          if (el.title) html += `<div class="message-template-element-title">${escape(el.title)}</div>`;
          if (el.subtitle) html += `<div class="message-template-element-subtitle">${escape(el.subtitle)}</div>`;
          if (el.quantity != null || el.price != null) {
            const qty = el.quantity != null ? `x${escape(el.quantity)}` : '';
            const price = el.price != null ? Number(el.price).toLocaleString('vi-VN') + ' ' + escape(el.currency || 'đ') : '';
            html += `<div class="message-template-element-meta">${qty} ${price}</div>`;
          }
          if (Array.isArray(el.buttons)) el.buttons.forEach(b => { html += buildTemplateButtonHtml(b); });
          html += `</div>`;
        });
        html += `</div>`;
      }
      if (tpl.receipt) {
        const r = tpl.receipt;
        html += `<div class="message-template-receipt">`;
        if (r.order_number) html += `<div>Mã đơn: <b>${escape(r.order_number)}</b></div>`;
        if (r.payment_method) html += `<div>Thanh toán: ${escape(r.payment_method)}</div>`;
        if (r.address) {
          const a = r.address;
          const addrParts = [a.street_1, a.city, a.state, a.country].filter(Boolean).join(', ');
          if (addrParts) html += `<div>Địa chỉ: ${escape(addrParts)}</div>`;
        }
        if (r.summary && r.summary.total_cost != null) {
          html += `<div class="message-template-receipt-total">Tổng cộng: ${Number(r.summary.total_cost).toLocaleString('vi-VN')} ${escape(r.currency || 'đ')}</div>`;
        }
        html += `</div>`;
      }
      if (Array.isArray(tpl.buttons) && tpl.buttons.length) {
        html += `<div class="message-template-buttons">`;
        tpl.buttons.forEach(b => { html += buildTemplateButtonHtml(b); });
        html += `</div>`;
      }
      html += `</div>`;
      return html;
    }

    async function renderMessage(msg, shouldShowAvatar) {
      const isZalo = msg.channel === 'zalo';
      const isPageSender = isZalo ? Boolean(Number(msg.is_echo)) : pageIds.includes(String(msg.sender));

      const messageRow = document.createElement('div');
      let avatarHtml = '';

      if (!isPageSender) {
        if (shouldShowAvatar) {
          avatarHtml = `<img src="${escape(customerAvatarEl.src)}" class="avatar-messenger" style="width: 25px; height: 25px; margin-right: 5px;">`;
        } else {
          avatarHtml = `<div class="avatar-messenger-placeholder" style="width: 25px; height: 25px; margin-right: 5px;"></div>`;
        }
      }

      const formattedTime = formatTimestamp(msg.time);
      const channelIcon = isZalo
        ? '<span class="zalo-message-icon" role="img" title="Zalo" aria-label="Zalo">Z</span>'
        : '<i class="fa-brands fa-facebook-messenger messenger-message-icon" role="img" title="Messenger" aria-label="Messenger"></i>';
      const timestampHtml = `<span class="message-timestamp">${channelIcon}<span class="message-timestamp-text">${formattedTime}${isPageSender ? " · " + escape(msg.sent_by_username || "Chưa ghi nhận") : ""}</span></span>`;

      let textContentHtml = '';
      if (msg.message) {
        const formattedMessage = escape(msg.message).replace(/\n/g, '<br>');
        textContentHtml = `<div class="message-text-content">${formattedMessage}</div>`;
      }

      let replyQuoteHtml = '';
      const replyTextVal = msg.reply_to_text != null ? msg.reply_to_text : (msg.replyTo ? msg.replyTo.text : null);
      const replyImageVal = safeUrl(msg.reply_to_image ?? msg.replyTo?.image);
      const replySenderVal = msg.reply_to_sender != null ? msg.reply_to_sender : (msg.replyTo ? msg.replyTo.sender : null);
      const replyMidVal = msg.reply_to_mid != null ? msg.reply_to_mid : (msg.replyTo ? msg.replyTo.mid : null);
      if (replyMidVal) {
        const isReplyToPage = pageIds.includes(String(replySenderVal));
        const custName = String(msg.fbname || '').trim();
        const replyLabel = isReplyToPage ? 'Trả lời bạn' : (custName ? `Đã trả lời ${custName}` : 'Đã trả lời');
        let replyBodyHtml = '';
        if (replyImageVal) {
          replyBodyHtml = `<div class="message-reply-quote-thumb-card"><img src="${escape(replyImageVal)}" alt="Ảnh gốc"></div>`;
        } else if (replyTextVal) {
          const shortText = escape(replyTextVal);
          replyBodyHtml = `<div class="message-reply-quote-text-pill">${shortText}</div>`;
        } else {
          replyBodyHtml = `<div class="message-reply-quote-text-pill message-reply-quote-missing">Tin nhắn gốc không còn</div>`;
        }
        replyQuoteHtml = `<div class="message-reply-quote-wrap" role="button" tabindex="0" data-quote-mid="${escape(replyMidVal)}">
          <div class="message-reply-quote-label"><i class="bi bi-reply-fill"></i> ${escape(replyLabel)}</div>
          ${replyBodyHtml}
        </div>`;
      }

      let templateHtml = '';
      if (msg.template_json) {
        try {
          templateHtml = buildTemplateHtml(JSON.parse(msg.template_json));
        } catch (e) { }
      } else if (msg.template) {
        templateHtml = buildTemplateHtml(msg.template);
      }

      let mediaHtml = '';
      let messageImagesContainer;
      if (msg.image) {
        if (typeof msg.image === 'string' && (msg.image.includes('like') || msg.image.includes('39178562_1505197616293642') || msg.image.includes('851587_369239346556147') || msg.image.includes('851582_369239386556143'))) {
          mediaHtml = `<div class="like-message-container"><span class="like-message-icon">👍</span></div>`;
        } else {
          const mediaUrls = typeof msg.image === 'string' ? msg.image.split(';') : [];
          messageImagesContainer = document.createElement('div');
          messageImagesContainer.classList.add('message-images-container');

          for (const source of mediaUrls) {
            const url = safeUrl(source.trim(), Boolean(msg.localId));
            if (!url) continue;
            messageImagesContainer.appendChild(renderAttachment(url, getMediaKind(url, msg)));
          }
        }
      }

      const reactionsHtml = buildReactionsHtml(msg.reactions);

      let statusHtml = '';
      if (isPageSender) {
        if (Number(msg.isread)) {
          statusHtml = `<div class="message-status-read"><img src="${escape(customerAvatarEl.src)}" alt="Đã xem" class="avatar-seen"></div>`;
        } else {
          statusHtml = `<div class="message-status-sent"><i class="bi bi-check2"></i></div>`;
        }
      }

      messageRow.dataset.sender = msg.sender;
      if (msg.timestamp != null) messageRow.dataset.sentAt = msg.timestamp;
      messageRow.classList.add('message-row-messenger');
      if (msg.id != null) messageRow.dataset.messageId = msg.id;
      if (isZalo) messageRow.dataset.channel = 'zalo';
      if (msg.messid) {
        messageRow.dataset.msgId = msg.messid;
      }
      if (msg.localId) {
        messageRow.dataset.localId = msg.localId;
      }

      if (isPageSender) {
        messageRow.classList.add('message-sent-messenger');
        let innerHTML = `<div class="message-content-wrapper">`;
        innerHTML += replyQuoteHtml;
        if (textContentHtml) {
          innerHTML += `<div class="message-text-messenger">${textContentHtml}</div>`;
        }
        innerHTML += `${mediaHtml}${templateHtml}${reactionsHtml}`;
        innerHTML += `<div class="message-status-time-wrapper">${timestampHtml}${statusHtml}</div>`;
        innerHTML += `</div>`;
        messageRow.innerHTML = innerHTML;
      } else {
        messageRow.classList.add('message-received-messenger');
        let innerHTML = `${avatarHtml}<div class="message-content-wrapper">`;
        innerHTML += replyQuoteHtml;
        if (textContentHtml) {
          innerHTML += `<div class="message-text-messenger">${textContentHtml}</div>`;
        }
        innerHTML += `${mediaHtml}${templateHtml}${reactionsHtml}`;
        innerHTML += `<div class="message-status-time-wrapper">${timestampHtml}${statusHtml}</div>`;
        innerHTML += `</div>`;
        messageRow.innerHTML = innerHTML;
      }

      if (messageImagesContainer?.childElementCount) {
        const wrapper = messageRow.querySelector('.message-content-wrapper');
        wrapper.insertBefore(messageImagesContainer, wrapper.querySelector('.message-template-card, .message-reactions-container, .message-status-time-wrapper'));
      }

      messageRow.addEventListener('click', function (event) {
        const reelEl = event.target.closest('.message-reel-card');
        if (reelEl && reelEl.dataset.reelUrl) {
          event.stopPropagation();
          window.open(reelEl.dataset.reelUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        const quoteEl = event.target.closest('.message-reply-quote-wrap');
        if (quoteEl) {
          event.stopPropagation();
          jumpToQuotedMessage(quoteEl.dataset.quoteMid, quoteEl);
          return;
        }
        if (event.target.closest('.message-row-messenger') === this) {
          this.classList.toggle('show-timestamp');
        }
      });

      messageRow.addEventListener('keydown', event => {
        const quote = event.target.closest('.message-reply-quote-wrap');
        if (!quote || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        jumpToQuotedMessage(quote.dataset.quoteMid, quote);
      });
      return messageRow;
    }

    return { renderMessage };
  }

  return { buildReactionsHtml, create, escape, safeUrl };
})();
