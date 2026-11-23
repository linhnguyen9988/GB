'use strict';
(() => {
    const root = document.querySelector('.admin-dashboard');
    if (!root) return;
    const find = selector => root.querySelector(selector);
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const message = (selector, text, error = false) => {
        const node = find(selector);
        node.textContent = text;
        node.classList.toggle('text-danger', error);
        node.classList.toggle('text-success', !error && !!text);
    };
    async function json(url, options = {}) {
        const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Không thực hiện được yêu cầu.');
        return result;
    }

    let registrationLoaded = false, registrationBusy = false, registrationEnabled = null;
    const registrationSwitch = find('[data-registration-switch]');
    function registrationMessage(text, error = false) {
        message('[data-registration-status]', text, error);
    }
    function renderRegistration(enabled) {
        registrationEnabled = enabled;
        registrationSwitch.checked = enabled;
        registrationMessage(enabled ? 'Đang mở đăng ký tài khoản mới.' : 'Đang khóa đăng ký tài khoản mới.');
    }
    async function loadRegistration() {
        if (registrationBusy) return;
        registrationBusy = true;
        registrationSwitch.disabled = true;
        registrationMessage('Đang tải trạng thái đăng ký…');
        try {
            const result = await json('/api/admin/registration-settings');
            if (typeof result.enabled !== 'boolean') throw new Error('Không đọc được trạng thái đăng ký.');
            renderRegistration(result.enabled);
            registrationLoaded = true;
        } catch (error) {
            registrationMessage(error.message || 'Không đọc được trạng thái đăng ký.', true);
        } finally {
            registrationBusy = false;
            registrationSwitch.disabled = registrationEnabled === null;
        }
    }
    registrationSwitch.addEventListener('change', async () => {
        if (registrationBusy || registrationEnabled === null) return;
        const enabled = registrationSwitch.checked;
        registrationBusy = true;
        registrationSwitch.disabled = true;
        registrationMessage('Đang lưu trạng thái đăng ký…');
        try {
            const result = await json('/api/admin/registration-settings', {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled })
            });
            if (typeof result.enabled !== 'boolean') throw new Error('Chưa xác nhận được trạng thái. Bấm Tải lại để kiểm tra.');
            renderRegistration(result.enabled);
        } catch (error) {
            registrationSwitch.checked = registrationEnabled;
            registrationMessage(error.message || 'Không lưu được trạng thái. Bấm Tải lại để kiểm tra.', true);
        } finally {
            registrationBusy = false;
            registrationSwitch.disabled = false;
        }
    });

    let usersLoaded = false, usersLoading = false, pendingRoleSaves = 0;
    function userRows(users) {
        const body = find('[data-users-body]');
        body.replaceChildren();
        users.forEach(user => {
            const self = String(user.id) === root.dataset.currentUser;
            let savedRole = user.role;
            const tr = document.createElement('tr');
            const account = document.createElement('th');
            account.scope = 'row';
            account.textContent = user.username || '';
            if (self) {
                const note = document.createElement('small');
                note.className = 'd-block text-muted fw-normal';
                note.textContent = 'Tài khoản đang dùng';
                account.append(note);
            }
            const name = document.createElement('td');
            name.textContent = user.fullname || '';
            const actions = document.createElement('td');
            const group = document.createElement('div');
            group.className = 'admin-role-controls';
            const select = document.createElement('select');
            select.className = 'form-select form-select-sm';
            select.setAttribute('aria-label', 'Quyền của ' + (user.username || 'tài khoản'));
            for (const [value, label] of [['staff', 'Nhân viên'], ['admin', 'Quản trị viên']]) {
                const option = document.createElement('option');
                option.value = value;
                option.textContent = label;
                select.append(option);
            }
            select.value = savedRole;
            select.disabled = self;
            const save = document.createElement('button');
            save.type = 'button';
            save.className = 'btn btn-sm btn-primary';
            save.textContent = 'Lưu';
            save.disabled = true;
            select.addEventListener('change', () => { save.disabled = select.value === savedRole; });
            save.addEventListener('click', async () => {
                if (self || save.disabled) return;
                const role = select.value;
                save.disabled = select.disabled = true;
                pendingRoleSaves++;
                find('[data-users-refresh]').disabled = true;
                save.textContent = 'Đang lưu…';
                message('[data-users-status]', 'Đang lưu quyền của ' + user.username + '…');
                try {
                    const result = await json('/api/admin/users/' + encodeURIComponent(user.id) + '/role', {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role })
                    });
                    if (!result.success) throw new Error(result.message || 'Không cập nhật được quyền.');
                    savedRole = role;
                    message('[data-users-status]', 'Đã cập nhật quyền của ' + user.username + '. Tài khoản này cần đăng nhập lại.');
                } catch (error) {
                    message('[data-users-status]', error.message || 'Không lưu được quyền.', true);
                } finally {
                    select.disabled = false;
                    save.disabled = select.value === savedRole;
                    save.textContent = 'Lưu';
                    pendingRoleSaves--;
                    find('[data-users-refresh]').disabled = usersLoading || pendingRoleSaves > 0;
                }
            });
            group.append(select, save);
            actions.append(group);
            tr.append(account, name, actions);
            body.append(tr);
        });
    }
    async function loadUsers() {
        if (usersLoading || pendingRoleSaves) return;
        usersLoading = true;
        find('[data-users-refresh]').disabled = true;
        find('[data-users-body]').replaceChildren();
        message('[data-users-status]', 'Đang tải tài khoản…');
        try {
            const result = await json('/api/admin/users');
            userRows(result.users);
            usersLoaded = true;
            message('[data-users-status]', result.users.length ? result.users.length + ' tài khoản' : 'Chưa có tài khoản.');
        } catch (error) {
            message('[data-users-status]', error.message || 'Không tải được tài khoản.', true);
        } finally {
            usersLoading = false;
            find('[data-users-refresh]').disabled = false;
        }
    }
    find('[data-users-refresh]').addEventListener('click', () => { void loadUsers(); void loadRegistration(); });

    let weightLoaded = false, weightBusy = false, weightRequest = 0, weightController, weightHasNext = false;
    const weightFilter = { search: '', carrier: '', period: 'recent', page: 1 };
    const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
    function weightButtons() {
        find('[data-weight-prev]').disabled = weightBusy || weightFilter.page <= 1;
        find('[data-weight-next]').disabled = weightBusy || !weightHasNext;
        find('[data-weight-refresh]').disabled = weightBusy;
    }
    function weightRows(orders) {
        find('[data-weight-body]').innerHTML = orders.map(order => {
            const jt = order.provider === 'J&T';
            const format = new Intl.NumberFormat(jt ? 'en-US' : 'vi-VN', { useGrouping: !jt, maximumFractionDigits: jt ? 9 : 6 });
            const signed = new Intl.NumberFormat(jt ? 'en-US' : 'vi-VN', { useGrouping: !jt, maximumFractionDigits: jt ? 9 : 6, signDisplay: 'exceptZero' });
            const original = Number(order.original_kg), declared = Number(order.declared_kg), current = Number(order.kg);
            const status = GBOrderStatus.get(order.provider, order.statuscode, order.statustext);
            const colors = ['primary', 'secondary', 'info', 'success', 'warning', 'danger'];
            const color = colors.includes(status.color) ? status.color : 'secondary';
            const code = String(order.realorderid || order.orderid || '');
            const date = order.updated_at ? new Date(order.updated_at) : null;
            return `<tr><th scope="row"><div class="admin-order-identity"><span>${esc(code)}</span><span class="badge gb-order-status text-bg-${color} admin-order-status">${esc(status.label)}</span></div><small class="d-block text-muted fw-normal mt-1">${jt ? 'J&T' : 'Viettel Post'} · ${esc(order.name || '')}</small><a class="btn btn-sm btn-outline-primary mt-2" href="/journey/${encodeURIComponent(code)}" target="_blank" rel="noopener">Hành trình</a></th><td><dl class="admin-report-info"><dt>Gửi hãng</dt><dd>${format.format(declared)} kg</dd><dt>Hiện tại</dt><dd class="fw-semibold">${format.format(current)} kg</dd><dt>Chênh lệch</dt><dd>${signed.format(current - declared)} kg</dd>${declared !== original ? `<dt>Nhập ban đầu</dt><dd>${format.format(original)} kg</dd>` : ''}</dl></td><td>${date && Number.isFinite(date.getTime()) ? esc(dateFormat.format(date)) : '—'}</td></tr>`;
        }).join('');
    }
    async function loadWeight() {
        const version = ++weightRequest;
        weightController?.abort();
        const active = new AbortController();
        weightController = active;
        weightBusy = true;
        weightHasNext = false;
        weightButtons();
        find('[data-weight-body]').innerHTML = '';
        find('[data-weight-page]').textContent = 'Trang ' + weightFilter.page;
        message('[data-weight-status]', 'Đang tải đối chiếu cân nặng…');
        const timeout = setTimeout(() => active.abort(), 30000);
        try {
            const result = await json('/api/admin/weight-changes?' + new URLSearchParams(weightFilter), { signal: active.signal });
            if (version !== weightRequest) return;
            weightRows(result.orders);
            weightLoaded = true;
            weightHasNext = result.hasNext;
            weightFilter.page = result.page;
            find('[data-weight-page]').textContent = 'Trang ' + result.page;
            message('[data-weight-status]', result.orders.length ? result.orders.length + ' đơn trên trang này' : 'Không có đơn chênh lệch cân nặng khớp bộ lọc.');
        } catch (error) {
            if (version !== weightRequest) return;
            message('[data-weight-status]', error.name === 'AbortError' ? 'Tải quá lâu. Bấm Tải lại để thử lại.' : error.message || 'Không tải được cân nặng.', true);
        } finally {
            clearTimeout(timeout);
            if (version === weightRequest) { weightBusy = false; weightButtons(); }
        }
    }
    find('[data-weight-form]').addEventListener('submit', event => {
        event.preventDefault();
        weightFilter.search = find('[data-weight-search]').value.trim();
        weightFilter.carrier = find('[data-weight-carrier]').value;
        weightFilter.period = find('[data-weight-period]').value;
        weightFilter.page = 1;
        void loadWeight();
    });
    find('[data-weight-refresh]').addEventListener('click', () => void loadWeight());
    find('[data-weight-prev]').addEventListener('click', () => {
        if (!weightBusy && weightFilter.page > 1) { weightFilter.page--; void loadWeight(); }
    });
    find('[data-weight-next]').addEventListener('click', () => {
        if (!weightBusy && weightHasNext) { weightFilter.page++; void loadWeight(); }
    });
    function activate(view) {
        if (view === 'users') { if (!usersLoaded) void loadUsers(); if (!registrationLoaded) void loadRegistration(); }
        if (view === 'weight' && !weightLoaded) void loadWeight();
    }
    root.addEventListener('admin-view-change', event => activate(event.detail.view));
    activate(find('.sidebar .nav-item.active')?.dataset.view);
})();
