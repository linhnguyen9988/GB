'use strict';

const GBChatZaloView = (() => {
  function createSticker(url, sticker) {
    if (!sticker.sprite || Number(sticker.frames) <= 1) {
      const image = document.createElement('img');
      image.src = url;
      image.alt = sticker.label || 'Sticker Zalo';
      image.className = 'message-image zalo-sticker';
      return image;
    }
    const canvas = document.createElement('canvas');
    canvas.className = 'zalo-sticker';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', sticker.label || 'Sticker Zalo động');
    const sheet = new Image();
    const preview = new Image();
    preview.src = GBChatMessageView.safeUrl(sticker.previewUrl);
    sheet.onload = () => {
      const frames = Math.max(1, Math.min(1000, Number(sticker.frames) || 1));
      let columns = 1;
      let rows = frames;
      if (preview.naturalWidth && preview.naturalHeight &&
          sheet.naturalWidth % preview.naturalWidth === 0 && sheet.naturalHeight % preview.naturalHeight === 0) {
        columns = sheet.naturalWidth / preview.naturalWidth;
        rows = sheet.naturalHeight / preview.naturalHeight;
      } else {
        let best = Infinity;
        for (let count = 1; count <= frames; count++) {
          const heightCount = Math.ceil(frames / count);
          const distortion = Math.abs(Math.log((sheet.naturalWidth / count) / (sheet.naturalHeight / heightCount)));
          const score = distortion + (count * heightCount - frames) / frames;
          if (score < best) { best = score; columns = count; rows = heightCount; }
        }
      }
      const width = sheet.naturalWidth / columns;
      const height = sheet.naturalHeight / rows;
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const totalFrames = Math.min(frames, columns * rows);
      const duration = Number(sticker.duration) || totalFrames * 80;
      const delay = Math.max(40, Math.min(500, (duration <= 60 ? duration * 1000 : duration) / totalFrames));
      const context = canvas.getContext('2d');
      let previousFrame = -1;
      function draw(now) {
        if (!canvas.isConnected) return;
        const frame = Math.floor(now / delay) % totalFrames;
        if (frame !== previousFrame) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(sheet, (frame % columns) * width, Math.floor(frame / columns) * height,
            width, height, 0, 0, canvas.width, canvas.height);
          previousFrame = frame;
        }
        requestAnimationFrame(draw);
      }
      requestAnimationFrame(draw);
    };
    sheet.onerror = () => {
      const fallback = document.createElement('img');
      fallback.src = GBChatMessageView.safeUrl(sticker.previewUrl) || url;
      fallback.className = 'message-image zalo-sticker';
      fallback.alt = sticker.label || 'Sticker Zalo';
      canvas.replaceWith(fallback);
    };
    sheet.src = url;
    return canvas;
  }

  function createSystemMessage(msg, template, avatarUrl) {
    const row = document.createElement('div');
    row.className = 'message-row-messenger message-system-row';
    row.dataset.channel = 'zalo';
    row.dataset.sender = msg.sender;
    if (msg.id != null) row.dataset.messageId = msg.id;
    if (msg.messid) row.dataset.msgId = msg.messid;
    const pill = document.createElement('div');
    pill.className = 'zalo-system-pill';
    const avatar = document.createElement('img');
    avatar.src = avatarUrl;
    avatar.alt = '';
    const text = document.createElement('span');
    text.textContent = template.text || msg.message || 'Thông báo Zalo';
    pill.append(avatar, text);
    const time = document.createElement('span');
    time.className = 'message-timestamp';
    const date = new Date(msg.timestamp || msg.time);
    time.textContent = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('vi-VN');
    row.append(pill, time);
    row.addEventListener('click', () => row.classList.toggle('show-timestamp'));
    return row;
  }

  return { createSticker, createSystemMessage };
})();
