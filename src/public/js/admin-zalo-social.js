'use strict';

(() => {
  const panel = document.getElementById('zaloSocial');
  if (!panel) return;
  const el = name => panel.querySelector('[data-social-' + name + ']');
  let accountId;
  let friends = [];
  let customers = [];
  let selected = new Set();
  let page = 0;
  let busy = false;
  let timer;
  let pollBusy = false;
  const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
  const filtered = () => friends.filter(friend => fold(friend.name + ' ' + friend.phone + ' ' + friend.uid).includes(fold(el('filter').value)));

  async function request(path, method = 'GET', body) {
    const response = await fetch('/api/admin/zalo' + path, {
      method, cache: 'no-store', headers: { 'X-GB-Zalo-Action': '1', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Không hoàn tất được thao tác Zalo.');
    return result;
  }

  function setAccount(next) {
    if (accountId && next !== accountId) {
      friends = []; customers = []; selected.clear();
      el('group').replaceChildren(new Option('Tải danh sách nhóm để chọn', ''));
      el('jobs').replaceChildren();
    }
    accountId = next;
    panel.hidden = !accountId;
  }

  function renderRows(target, rows) {
    const fragment = document.createDocumentFragment();
    for (const person of rows) {
      const row = document.createElement('div');
      row.className = 'list-group-item d-flex gap-2 align-items-center';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.className = 'form-check-input m-0 flex-shrink-0';
      checkbox.disabled = busy || !person.uid; checkbox.checked = Boolean(person.uid && selected.has(person.uid));
      checkbox.setAttribute('aria-label', 'Chọn ' + (person.name || person.phone || person.uid));
      checkbox.addEventListener('change', () => { if (checkbox.checked) selected.add(person.uid); else selected.delete(person.uid); render(); });
      const info = document.createElement('div'); info.className = 'small flex-grow-1 text-break';
      const name = document.createElement('div'); name.textContent = person.name || person.phone || person.uid;
      const detail = document.createElement('div'); detail.className = 'text-body-secondary';
      detail.textContent = [person.phone, person.uid ? 'UID ' + person.uid : 'Chưa tra UID Zalo'].filter(Boolean).join(' · ');
      info.append(name, detail); row.append(checkbox, info);
      if (!person.uid && person.phone) {
        const check = document.createElement('button'); check.type = 'button'; check.className = 'btn btn-outline-primary btn-sm flex-shrink-0';
        check.textContent = 'Tra Zalo'; check.disabled = busy;
        check.addEventListener('click', () => run(async () => {
          const { recipient } = await request('/check-phone', 'POST', { phone: person.phone });
          if (recipient.accountId !== accountId) throw new Error('Tài khoản Zalo đã thay đổi. Hãy tải lại.');
          person.uid = recipient.uid; if (!person.name) person.name = recipient.name;
          el('status').textContent = 'Đã tìm thấy UID. Tích chọn khách để thêm vào nhóm.';
        })); row.appendChild(check);
      }
      fragment.appendChild(row);
    }
    target.replaceChildren(fragment);
  }

  function render() {
    const rows = filtered();
    const pages = Math.max(1, Math.ceil(rows.length / 20)); page = Math.min(page, pages - 1);
    renderRows(el('friends'), rows.slice(page * 20, page * 20 + 20));
    renderRows(el('customers'), customers);
    el('count').textContent = rows.length + '/' + friends.length + ' bạn bè · đã chọn ' + selected.size + ' người';
    el('page').textContent = 'Trang ' + (page + 1) + '/' + pages;
    el('prev').disabled = busy || page === 0; el('next').disabled = busy || page + 1 >= pages;
    for (const name of ['load','select-all','clear','search-customers','find-phone','sync-profiles']) el(name).disabled = busy || !accountId;
    el('group').disabled = busy || !accountId;
    el('add').disabled = busy || !selected.size || !el('group').value;
  }

  async function run(action) {
    if (busy) return;
    busy = true; el('status').textContent = 'Đang xử lý…'; render();
    try { await action(); } catch (error) { el('status').textContent = error.message; }
    finally { busy = false; render(); }
  }

  async function refreshProgress() {
    if (pollBusy || document.hidden) return;
    pollBusy = true;
    try {
      const result = await request('/social-progress');
      setAccount(result.accountId);
      const counts = Object.fromEntries(result.friends.map(row => [row.state, Number(row.count)]));
      el('auto').textContent = 'Tự nhận kết bạn đang bật · đã nhận ' + (counts.done || 0) +
        ' · đang chờ ' + ((counts.pending || 0) + (counts.processing || 0)) + ' · lỗi ' + (counts.failed || 0);
      const fragment = document.createDocumentFragment();
      for (const job of result.jobs) {
        const item = document.createElement('div'); item.className = 'border rounded p-2 mb-2 small';
        const title = document.createElement('div'); title.className = 'fw-semibold text-break'; title.textContent = 'Nhóm ' + job.group_id + ' · đợt ' + job.job_id.slice(0, 8);
        const text = document.createElement('div');
        const pending = Number(job.pending) + Number(job.processing);
        text.textContent = 'Tổng ' + job.total + ' · đã thêm/gửi lời mời ' + job.sent + ' · có sẵn ' + job.skipped +
          ' · còn chờ ' + pending + ' · chưa thêm được ' + job.failed + ' · đã dừng ' + job.cancelled;
        item.append(title, text);
        if (Number(job.pending)) {
          const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn btn-outline-danger btn-sm mt-1'; cancel.textContent = 'Dừng phần còn chờ';
          cancel.addEventListener('click', () => run(async () => {
            await request('/group-members/' + job.job_id, 'DELETE'); el('status').textContent = 'Đã dừng phần còn chờ. Lượt đang gửi sẽ hoàn tất.'; await refreshProgress();
          })); item.append(cancel);
        }
        fragment.appendChild(item);
      }
      el('jobs').replaceChildren(fragment);
      el('failures-wrap').hidden = !result.failures.length;
      el('failures').replaceChildren(...result.failures.map(failure => {
        const line = document.createElement('div'); line.className = 'mb-1 text-break';
        line.textContent = failure.job_id.slice(0, 8) + ' · UID ' + failure.user_id + ' · ' + failure.last_error; return line;
      }));
      const profiles = result.profileSync || {};
      el('profile-status').textContent = 'Nhãn và biệt danh · đã xong ' + (profiles.done || 0) + ' · còn chờ ' + (profiles.pending || 0) + ' · lỗi/thử lại ' + (profiles.failed || 0);
      el('profile-errors-wrap').hidden = !result.profileErrors?.length;
      el('profile-errors').replaceChildren(...(result.profileErrors || []).map(item => {
        const line = document.createElement('div'); line.className = 'mb-1 text-break';
        line.textContent = 'UID ' + item.user_id + ' · ' + item.last_error; return line;
      }));
      render();
    } catch (error) { panel.hidden = false; el('status').textContent = error.message; }
    finally {
      pollBusy = false; clearTimeout(timer); timer = setTimeout(refreshProgress, 5000);
    }
  }

  el('load').addEventListener('click', () => run(async () => {
    const [list, groups] = await Promise.all([request('/friends'), request('/groups')]);
    if (list.accountId !== groups.accountId) throw new Error('Tài khoản Zalo đã thay đổi. Hãy tải lại.');
    setAccount(list.accountId); friends = list.friends; page = 0;
    const prior = el('group').value;
    el('group').replaceChildren(new Option('Chọn nhóm cần thêm thành viên', ''), ...groups.groups.map(group => new Option((group.name || 'Nhóm') + ' · ' + group.id, group.id)));
    if (groups.groups.some(group => group.id === prior)) el('group').value = prior;
    el('status').textContent = 'Đã tải ' + friends.length + ' bạn bè và ' + groups.groups.length + ' nhóm.';
  }));
  el('filter').addEventListener('input', () => { page = 0; render(); });
  el('group').addEventListener('change', render);
  el('prev').addEventListener('click', () => { page--; render(); });
  el('next').addEventListener('click', () => { page++; render(); });
  el('select-all').addEventListener('click', () => { for (const friend of filtered()) selected.add(friend.uid); render(); });
  el('clear').addEventListener('click', () => { selected.clear(); render(); });
  el('search-customers').addEventListener('click', () => run(async () => {
    const result = await request('/customers?q=' + encodeURIComponent(el('search').value));
    setAccount(result.accountId); customers = result.customers;
    el('status').textContent = customers.length ? 'Tìm thấy ' + customers.length + ' khách. Tra UID cho khách chưa có rồi tích chọn.' : 'Không tìm thấy khách trong GB.';
  }));
  el('find-phone').addEventListener('click', () => run(async () => {
    const { recipient } = await request('/check-phone', 'POST', { phone: el('search').value });
    setAccount(recipient.accountId); customers = [{ uid: recipient.uid, name: recipient.name, phone: el('search').value }];
    el('status').textContent = 'Đã tìm thấy Zalo. Tích chọn người này để thêm vào nhóm.';
  }));
  el('add').addEventListener('click', () => run(async () => {
    const result = await request('/group-members', 'POST', { accountId, groupId: el('group').value, memberIds: [...selected] });
    selected.clear(); el('status').textContent = 'Đã xếp ' + result.total + ' người vào hàng đợi. Có thể rời trang, GB tiếp tục xử lý.';
    await refreshProgress();
  }));
  el('sync-profiles').addEventListener('click', () => run(async () => {
    const result = await request('/profile-sync', 'POST');
    el('status').textContent = 'Đã xếp ' + result.count + ' khách có UID hợp lệ vào hàng đợi đồng bộ nhãn và biệt danh.';
    await refreshProgress();
  }));
  el('refresh').addEventListener('click', refreshProgress);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshProgress(); });
  render(); refreshProgress();
})();
