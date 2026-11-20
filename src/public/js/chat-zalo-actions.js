'use strict';

const GBChatZaloActions = (() => {
  const busy = new Set();
  const recent = new Map();
  const excluded = target => target.closest('a,button,input,textarea,audio,video,.message-reply-quote-wrap,.message-reel-card');

  async function heart(row, mid) {
    row.dataset.zaloDoubleTapUntil = String(Date.now() + 500);
    if (busy.has(mid) || Date.now() - (recent.get(mid) || 0) < 1000) return;
    recent.set(mid, Date.now());
    if (recent.size > 200) recent.delete(recent.keys().next().value);
    busy.add(mid);
    row.classList.add('zalo-reacting');
    try {
      const response = await fetch('/api/zalo-message-heart', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-GB-Zalo-Action': '1' },
        body: JSON.stringify({ mid })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Không thả tim được tin Zalo.');
      document.dispatchEvent(new CustomEvent('gb-zalo-reaction', { detail: result }));
    } catch (error) {
      if (typeof ShowCenterToast === 'function') ShowCenterToast('danger', error.message, 5000);
      else {
        const note = document.createElement('span');
        note.className = 'message-fail-reason'; note.textContent = error.message;
        row.appendChild(note); setTimeout(() => note.remove(), 5000);
      }
    } finally { busy.delete(mid); row.classList.remove('zalo-reacting'); }
  }

  function bind(row, msg) {
    if (msg.channel !== 'zalo' || !/^zalo:[a-f0-9]{64}$/.test(msg.messid || '')) return;
    let down;
    let lastTap;
    row.addEventListener('dblclick', event => {
      if (excluded(event.target)) return;
      event.preventDefault(); heart(row, msg.messid);
    });
    row.addEventListener('pointerdown', event => {
      down = event.pointerType === 'touch' && !excluded(event.target)
        ? { x: event.clientX, y: event.clientY, time: Date.now() } : null;
    }, { passive: true });
    row.addEventListener('pointercancel', () => { down = lastTap = null; });
    row.addEventListener('pointerup', event => {
      if (!down || Date.now() - down.time > 350 || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 12) {
        down = lastTap = null; return;
      }
      const now = Date.now();
      if (lastTap && now - lastTap.time < 300 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24) {
        event.preventDefault(); lastTap = null; heart(row, msg.messid);
      } else lastTap = { x: event.clientX, y: event.clientY, time: now };
      down = null;
    });
  }
  return { bind };
})();
