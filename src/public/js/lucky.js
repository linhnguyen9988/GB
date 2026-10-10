(function () {
  var LS_P = 'lucky_players_v1', LS_K = 'lucky_key_v1', LS_V = 'lucky_visible_v1', LS_PR = 'lucky_print_v1';
  var SPIN_MS = 7000;
  var players = [], visible = false, winnerId = null, spinning = false, key;

  try { players = JSON.parse(localStorage.getItem(LS_P) || '[]') || []; } catch (e) { players = []; }
  visible = localStorage.getItem(LS_V) === '1';
  var printOn = localStorage.getItem(LS_PR) !== '0';
  key = 'halwhtihle123';
  var link = location.origin + '/quay.html?k=' + key;

  function sock() { return (typeof socket !== 'undefined') ? socket : null; }
  function save() { localStorage.setItem(LS_P, JSON.stringify(players)); localStorage.setItem(LS_V, visible ? '1' : '0'); }
  function state() {
    return { players: players.map(function (p) { return { id: p.id, name: p.name }; }), visible: visible, winnerId: winnerId };
  }
  function sync() { var s = sock(); if (s) s.emit('lucky-sync', key, state()); }
  function rnd(n) { var a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }

  var css = document.createElement('style');
  css.textContent =
    '#lucky-w{position:fixed;top:80px;right:20px;width:300px;z-index:2000;background:#1c1f26;color:#fff;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.45);font:14px/1.4 system-ui,sans-serif;display:none;user-select:none}' +
    '#lucky-w .lh{cursor:move;padding:10px 12px;background:linear-gradient(90deg,#f59e0b,#ef4444);border-radius:12px 12px 0 0;display:flex;justify-content:space-between;font-weight:700}' +
    '#lucky-w .lh button{background:none;border:0;color:#fff;font-size:20px;line-height:1;cursor:pointer}' +
    '#lucky-w .ll{max-height:38vh;overflow:auto;padding:6px 8px}' +
    '#lucky-w .lr{display:flex;align-items:center;gap:8px;padding:4px 2px;border-bottom:1px solid #2c303a}' +
    '#lucky-w .lr.win{background:#f59e0b33;border-radius:6px}' +
    '#lucky-w .lr img{width:28px;height:28px;border-radius:50%;object-fit:cover}' +
    '#lucky-w .lr span{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '#lucky-w .lr b{cursor:pointer;color:#f87171;padding:0 6px;font-size:16px}' +
    '#lucky-w .lb{display:flex;gap:6px;padding:8px}' +
    '#lucky-w .lb button{flex:1;border:0;border-radius:8px;padding:8px 4px;color:#fff;font-weight:600;cursor:pointer}' +
    '#lucky-w .lb button:disabled{opacity:.5;cursor:default}' +
    '#lucky-w .lk{display:flex;gap:6px;padding:0 8px 8px}' +
    '#lucky-w .lk input{flex:1;min-width:0;background:#11131a;border:1px solid #3a3f4c;color:#9ca3af;border-radius:6px;padding:4px 6px;font-size:12px}' +
    '#lucky-w .lk button{background:#374151;border:0;color:#fff;border-radius:6px;padding:0 8px;cursor:pointer}' +
    '#lucky-w .lm{padding:0 10px 10px;min-height:20px;font-size:13px;color:#fbbf24}';
  document.head.appendChild(css);

  var w = document.createElement('div');
  w.id = 'lucky-w';
  w.innerHTML =
    '<div class="lh"><span>🎁 Quay thưởng (<span id="lucky-n">0</span>)</span><button id="lucky-x" title="Đóng">&times;</button></div>' +
    '<div class="ll" id="lucky-list"></div>' +
    '<div class="lb"><button id="lucky-spin" style="background:#16a34a">🎰 Quay</button>' +
    '<button id="lucky-vis" style="background:#2563eb">👁 Hiện</button>' +
    '<button id="lucky-clr" style="background:#dc2626">🗑 Xóa hết</button></div>' +
    '<div class="lk"><input id="lucky-link" readonly><button id="lucky-copy">Copy link OBS</button></div>' +
    '<label style="display:block;padding:0 10px 6px;font-size:13px;cursor:pointer"><input type="checkbox" id="lucky-pr"> 🖨 In tem khi có người trúng</label>' +
    '<div class="lm" id="lucky-msg"></div>';
  document.body.appendChild(w);
  var $ = function (id) { return document.getElementById(id); };
  $('lucky-link').value = link;
  $('lucky-pr').checked = printOn;
  $('lucky-pr').onchange = function () { printOn = this.checked; localStorage.setItem(LS_PR, printOn ? '1' : '0'); };

  function msg(t) { $('lucky-msg').textContent = t || ''; }
  function printTem(win) {
    msg('🏆 ' + win.name + ' — đang in tem...');
    var ava = win.ava || ('/images/ava/' + encodeURIComponent(win.id) + '.jpg');
    if (ava.charAt(0) === '/') ava = location.origin + ava;
    var body = {
      date: (typeof ToDay === 'function') ? ToDay() : new Date().toLocaleString('vi-VN'),
      name: win.name,
      phone: win.phone || '',
      comment: 'TRÚNG THƯỞNG QUAY SỐ',
      gia: '0',
      id: win.khid || '',
      avabase64: ava,
      address: '', region: '', note: ''
    };
    fetch('/api/generate-pdf', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (pdf) {
      if (!pdf || !pdf.success) throw new Error('Không tạo được tem');
      return fetch('/print-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: window.CURRENT_USER_ID, type: 'pdf', content: pdf.pdfBase64,
          config: { printerName: 'XP-80C', widthMm: 80, heightMm: 297, marginTopPx: -5 }
        })
      }).then(function (r) { return r.json(); });
    }).then(function (res) {
      msg('🏆 ' + win.name + (res && res.success ? ' — đã gửi lệnh in ✅' : ' — ⚠️ Máy in đang Offline!'));
    }).catch(function (e) { msg('🏆 ' + win.name + ' — ⚠️ Lỗi in tem: ' + e.message); });
  }

  function render() {
    $('lucky-n').textContent = players.length;
    var list = $('lucky-list'); list.innerHTML = '';
    players.forEach(function (p, i) {
      var r = document.createElement('div'); r.className = 'lr' + (p.id === winnerId ? ' win' : '');
      var im = document.createElement('img'); im.src = '/images/ava/' + encodeURIComponent(p.id) + '.jpg';
      im.onerror = function () { this.onerror = null; this.src = '/images/ava/default.jpg'; };
      var sp = document.createElement('span'); sp.textContent = p.name;
      var x = document.createElement('b'); x.textContent = '✕'; x.title = 'Xóa khách này';
      x.onclick = function () { players.splice(i, 1); if (winnerId === p.id) winnerId = null; save(); render(); sync(); };
      r.appendChild(im); r.appendChild(sp); r.appendChild(x); list.appendChild(r);
    });
    $('lucky-vis').textContent = visible ? '🙈 Ẩn' : '👁 Hiện';
    $('lucky-spin').disabled = spinning || players.length < 2;
  }

  window.LuckyAdd = function (id, name, phone, khid, ava) {
    id = String(id || '').trim();
    name = String(name || '').trim().slice(0, 80) || 'Khách';
    if (!id) return;
    w.style.display = 'block';

    var idx = players.findIndex(function (p) { return p.id === id; });
    var newData = {
      id: id,
      name: name,
      phone: String(phone || '').slice(0, 20),
      khid: String(khid || '').slice(0, 20),
      ava: String(ava || '').length < 500? String(ava || '') : ''
    };

    if (idx >= 0) {
      var cur = players[idx];
      if (newData.name) cur.name = newData.name;
      if (newData.phone) cur.phone = newData.phone;
      if (newData.khid) cur.khid = newData.khid;
      if (newData.ava) cur.ava = newData.ava;
      msg('↻ Đã cập nhật: ' + cur.name + (cur.phone? ' - ' + cur.phone : ''));
    } else {
      players.push(newData);
      msg('✅ Đã thêm: ' + name);
    }

    winnerId = null; save(); render(); sync();
  };
  
  window.LuckyToggle = function () { w.style.display = (w.style.display === 'block') ? 'none' : 'block'; };

  $('lucky-x').onclick = function () { w.style.display = 'none'; };
  $('lucky-copy').onclick = function () {
    var i = $('lucky-link'); i.select();
    (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.resolve(document.execCommand('copy')))
      .then(function () { msg('📋 Đã copy link cho OBS'); });
  };
  $('lucky-vis').onclick = function () { visible = !visible; save(); render(); sync(); };
  $('lucky-clr').onclick = function () {
    if (!players.length || !confirm('Xóa tất cả khách trong danh sách quay thưởng?')) return;
    players = []; winnerId = null; save(); render(); sync(); msg('');
  };
  $('lucky-spin').onclick = function () {
    if (spinning || players.length < 2) return;
    var win = players[rnd(players.length)];
    winnerId = win.id; visible = true; spinning = true; save(); render(); msg('🎰 Đang quay...');
    var s = sock(); if (s) s.emit('lucky-spin', key, state(), SPIN_MS);
    setTimeout(function () {
      spinning = false; render(); msg('🏆 Trúng thưởng: ' + win.name);
      if (printOn) printTem(win);
    }, SPIN_MS + 500);
  };

  (function drag(el, handle) {
    var x = 0, y = 0;
    handle.onmousedown = function (e) {
      if (e.target.tagName === 'BUTTON') return;
      x = e.clientX; y = e.clientY;
      document.onmousemove = function (ev) {
        el.style.left = (el.offsetLeft - (x - ev.clientX)) + 'px';
        el.style.top = (el.offsetTop - (y - ev.clientY)) + 'px';
        el.style.right = 'auto'; x = ev.clientX; y = ev.clientY;
      };
      document.onmouseup = function () { document.onmousemove = document.onmouseup = null; };
    };
  })(w, w.querySelector('.lh'));

  var s0 = sock();
  if (s0) s0.on('connect', function () { if (players.length || visible) sync(); });
  render();
})();