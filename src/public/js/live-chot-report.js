'use strict';
(() => {
    let modal, body, title, scope, request, selected, savedCell, context, data, detail;
    const money = value => Number(value || 0).toLocaleString('vi-VN') + ' ₫';
    function element(tag, text, className) {
        const el = document.createElement(tag);
        if (text !== undefined) el.textContent = text;
        if (className) el.className = className;
        return el;
    }
    function button(text, action) {
        const el = element('button', text, 'btn btn-sm btn-outline-primary');
        el.type = 'button'; el.addEventListener('click', action); return el;
    }
    function liveIds() {
        return [...new Set((document.getElementById('liveidinput').value || '').split(',').map(x => x.trim()).filter(Boolean))].join(',');
    }
    function currentCustomer() {
        try {
            const table = $('#comment_table').DataTable();
            const cell = table.cell({ focused: true }).index();
            if (cell) {
                const row = table.row(cell.row).data();
                if (row) return { userid: String(row[12]), name: row[26] || '', liveIds: liveIds(), cell };
            }
        } catch (_) { /* No selected row yet. */ }
        return selected && selected.liveIds === liveIds() ? selected : null;
    }
    function ensureModal() {
        if (modal) return;
        const root = element('div', undefined, 'modal fade');
        root.id = 'modalLiveChotReport'; root.tabIndex = -1;
        root.setAttribute('aria-labelledby', 'liveChotReportTitle'); root.setAttribute('aria-hidden', 'true');
        root.innerHTML = `<div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"><div class="modal-content">
            <div class="modal-header"><div><h5 class="modal-title" id="liveChotReportTitle"></h5><div class="small text-muted" id="liveChotReportScope"></div></div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Đóng"></button></div>
            <div class="modal-body" aria-live="polite"></div><div class="modal-footer">
            <button type="button" class="btn btn-outline-primary" id="liveChotReportRefresh">Cập nhật</button>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button></div></div></div>`;
        document.body.appendChild(root);
        modal = bootstrap.Modal.getOrCreateInstance(root);
        body = root.querySelector('.modal-body'); title = root.querySelector('.modal-title'); scope = root.querySelector('#liveChotReportScope');
        root.querySelector('#liveChotReportRefresh').addEventListener('click', load);
        root.addEventListener('hidden.bs.modal', () => {
            if (request) request.abort();
            try {
                const table = $('#comment_table').DataTable();
                table.keys.enable();
                if (savedCell && context.liveIds === liveIds() && table.row(savedCell.row).data()) table.cell(savedCell).focus();
            } catch (_) { /* Table may have been reloaded. */ }
        });
    }
    function plainComment(value) {
        const doc = new DOMParser().parseFromString(String(value || ''), 'text/html');
        return doc.body.textContent || '';
    }
    function summary(total) {
        const box = element('div', undefined, 'live-chot-totals');
        for (const [label, value] of [['Khách', total.customers], ['Mã / bình luận chốt', total.codes], ['Số lượng', total.quantity], ['Tổng tiền', money(total.amount)]]) {
            const item = element('div'); item.append(element('small', label), element('strong', value)); box.append(item);
        }
        return box;
    }
    function render() {
        body.replaceChildren();
        title.textContent = detail || context.userid ? 'Chi tiết chốt · ' + (detail ? detail.name : context.name) : 'Tổng chốt trong live';
        if (detail && !context.userid) body.append(button('← Tất cả khách', () => { detail = null; render(); }));
        const total = detail ? { customers: 1, codes: detail.codes, quantity: detail.quantity, amount: detail.amount } : data.total;
        body.append(summary(total));
        if (!data.customers.length) {
            body.append(element('p', context.userid ? 'Khách chưa có mã được chốt trong live này.' : 'Live chưa có khách được chốt.', 'text-muted'));
            return;
        }
        const wrap = element('div', undefined, 'table-responsive');
        const table = element('table', undefined, 'table table-striped align-middle live-chot-table');
        const head = element('thead'); const header = element('tr');
        (detail ? ['Mã / bình luận', 'Giá × SL', 'Thành tiền'] : ['Khách hàng', 'Mã đã chốt', 'SL', 'Tổng tiền']).forEach(x => header.append(element('th', x)));
        head.append(header); const tbody = element('tbody'); table.append(head, tbody); wrap.append(table); body.append(wrap);
        if (detail) {
            for (const item of detail.items) {
                const tr = element('tr'); const code = element('td');
                code.append(element('div', plainComment(item.code) || '(Bình luận trống)'));
                code.append(element('small', 'Lượt in: ' + (item.printNumber || '—') + (context.liveIds.includes(',') ? ' · Live ' + item.liveid : ''), 'text-muted'));
                const prices = element('td');
                item.prices.forEach(p => prices.append(element('div', money(p.price) + ' × ' + p.quantity)));
                if (!item.prices.length) prices.append(element('span', 'Chưa có giá', 'text-muted'));
                tr.append(code, prices, element('td', money(item.amount), 'fw-bold')); tbody.append(tr);
            }
        } else {
            const search = element('input', undefined, 'form-control mb-3');
            search.type = 'search'; search.placeholder = 'Tìm tên, SĐT hoặc KHID'; search.setAttribute('aria-label', search.placeholder);
            body.insertBefore(search, wrap);
            for (const customer of data.customers) {
                const tr = element('tr'); const who = element('td');
                who.append(button(customer.name, () => { detail = customer; render(); }));
                who.append(element('div', [customer.khid ? 'KH' + customer.khid : '', customer.phone].filter(Boolean).join(' · '), 'small text-muted'));
                const codes = element('td');
                codes.append(element('strong', customer.codes + ' mã'));
                codes.append(element('div', customer.items.map(x => plainComment(x.code) || '(Trống)').join(' · '), 'live-chot-codes small'));
                tr.append(who, codes, element('td', customer.quantity), element('td', money(customer.amount), 'fw-bold'));
                tr.dataset.search = [customer.name, customer.phone, customer.khid].join(' ').toLocaleLowerCase('vi'); tbody.append(tr);
            }
            search.addEventListener('input', () => {
                const value = search.value.trim().toLocaleLowerCase('vi');
                for (const row of tbody.rows) row.hidden = !row.dataset.search.includes(value);
            });
        }
    }
    async function load() {
        if (request) request.abort();
        const active = request = new AbortController();
        detail = null; data = null;
        body.replaceChildren(element('div', ' Đang tải…', 'text-muted'));
        const spinner = element('span', undefined, 'spinner-border spinner-border-sm'); spinner.setAttribute('aria-hidden', 'true'); body.firstChild.prepend(spinner);
        try {
            const params = new URLSearchParams({ liveIds: context.liveIds });
            if (context.userid) params.set('userid', context.userid);
            const response = await fetch('/api/live-comments/chot-report?' + params, { signal: active.signal });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Không tải được danh sách chốt.');
            if (request !== active) return;
            data = result; detail = context.userid ? data.customers[0] || null : null; render();
        } catch (err) {
            if (err.name === 'AbortError' || request !== active) return;
            body.replaceChildren(element('p', err.message || 'Không tải được danh sách chốt.', 'text-danger'), button('Thử lại', load));
        }
    }
    function open(customerOnly) {
        const ids = liveIds();
        if (!ids) return ShowCenterToast('warning', 'Hãy tải live trước.', 2500);
        const customer = currentCustomer();
        if (customerOnly && !customer) return ShowCenterToast('warning', 'Hãy chọn một dòng của khách trước.', 2500);
        ensureModal();
        savedCell = customer && customer.cell;
        context = { liveIds: ids, userid: customerOnly ? customer.userid : null, name: customerOnly ? customer.name : '' };
        title.textContent = customerOnly ? 'Chi tiết chốt · ' + customer.name : 'Tổng chốt trong live';
        scope.textContent = 'Live: ' + ids + ' · Chỉ tính các dòng CHỐT, không tính XẢ';
        try { $('#comment_table').DataTable().keys.disable(); } catch (_) { /* No table yet. */ }
        modal.show(); load();
    }
    $('#comment_table').on('key-focus.liveChotReport', (event, table, cell) => {
        const row = table.row(cell.index().row).data();
        if (row) selected = { userid: String(row[12]), name: row[26] || '', liveIds: liveIds(), cell: cell.index() };
    });
    document.getElementById('liveChotReportAll').addEventListener('click', () => open(false));
    document.getElementById('liveChotReportCustomer').addEventListener('click', () => open(true));
    document.addEventListener('keydown', event => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.repeat || event.isComposing || document.querySelector('.modal.show')) return;
        if (event.target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
        const key = event.key.toLowerCase();
        if (key !== 'i' && key !== 'o') return;
        event.preventDefault(); event.stopImmediatePropagation(); open(key === 'o');
    }, true);
})();
