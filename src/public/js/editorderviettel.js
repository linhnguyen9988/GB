// Modal sửa đơn Viettel.
// Quyền sửa từng trường do SERVER quyết định (POST /getvieteleditinfo); file này chỉ hiển thị lại và chặn thao tác sai sớm.
(function (w) {
    'use strict';

    var FIELDS = ['name', 'phone', 'address', 'cod', 'kg', 'note'];
    var LABELS = { name: 'Họ tên', phone: 'Số điện thoại', address: 'Địa chỉ', cod: 'Tiền COD', kg: 'Số ký', note: 'Ghi chú' };

    function esc(s) {
        return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function toast(type, msg, delay) {
        if (typeof w.ShowCenterToast === 'function') w.ShowCenterToast(type, esc(msg), delay || 3500);
        else w.alert(msg);
    }
    function normAddr(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
    function digits(s) { return String(s || '').replace(/\D/g, ''); }
    function fmtMoney(n) { return n === '' || n === null || n === undefined ? '' : Number(n).toLocaleString('vi-VN'); }
    function errMsg(xhr, fallback) {
        return (xhr && xhr.responseJSON && xhr.responseJSON.message) || fallback;
    }
    // Cho biết lỗi đến từ đâu: Viettel từ chối / không kết nối được Viettel / lỗi của app mình.
    function errSource(xhr) {
        var j = (xhr && xhr.responseJSON) || {};
        if (j.source === 'viettel') return 'Viettel từ chối: ';
        if (j.source === 'network') return 'Lỗi kết nối tới Viettel: ';
        if (j.source === 'app') return 'Lỗi của app' + (j.ref ? ' (mã tra log: ' + j.ref + ')' : '') + ': ';
        return '';
    }

    var SKELETON =
        '<div class="modal fade" id="modalEditViettel" tabindex="-1" aria-hidden="true" data-bs-backdrop="static">' +
        '<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable"><div class="modal-content rounded-4 shadow">' +
        '<div class="modal-header">' +
        '<h5 class="modal-title fw-bold"><i class="bi bi-pencil-square"></i> Sửa đơn Viettel</h5>' +
        '<button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
        '<div class="modal-body">' +
        '<div id="evStatus" class="alert alert-secondary py-2 small mb-3"></div>' +
        '<div class="row g-2 mb-3">' +
        '<div class="col-6"><label class="form-label small text-body-secondary mb-1"><i class="bi bi-lock-fill"></i> Mã vận đơn</label>' +
        '<input type="text" class="form-control form-control-sm" id="ev-realorderid" disabled></div>' +
        '<div class="col-6"><label class="form-label small text-body-secondary mb-1"><i class="bi bi-lock-fill"></i> Mã nội bộ</label>' +
        '<input type="text" class="form-control form-control-sm" id="ev-orderid" disabled></div></div>' +

        '<div class="mb-3" data-f="name"><label class="form-label fw-semibold mb-1" for="ev-name">Họ tên người nhận</label>' +
        '<input type="text" class="form-control" id="ev-name" maxlength="100" autocomplete="off"><div class="form-text ev-lock d-none"></div></div>' +

        '<div class="mb-3" data-f="phone"><label class="form-label fw-semibold mb-1" for="ev-phone">Số điện thoại</label>' +
        '<input type="tel" class="form-control" id="ev-phone" inputmode="tel" maxlength="16" autocomplete="off"><div class="form-text ev-lock d-none"></div></div>' +

        '<div class="mb-3" data-f="address"><label class="form-label fw-semibold mb-1" for="ev-address">Địa chỉ</label>' +
        '<textarea class="form-control" id="ev-address" rows="2" maxlength="255"></textarea>' +
        '<div class="d-flex align-items-center gap-2 mt-2">' +
        '<button type="button" class="btn btn-outline-primary btn-sm" id="ev-checkaddr"><i class="bi bi-geo-alt"></i> Kiểm tra địa chỉ</button>' +
        '<span class="small" id="ev-addrresult"></span></div>' +
        '<div class="form-text ev-lock d-none"></div></div>' +

        '<div class="row g-2">' +
        '<div class="col-7 mb-3" data-f="cod"><label class="form-label fw-semibold mb-1" for="ev-cod">Tiền COD (đ)</label>' +
        '<input type="text" class="form-control" id="ev-cod" inputmode="numeric" autocomplete="off"><div class="form-text ev-lock d-none"></div></div>' +
        '<div class="col-5 mb-3" data-f="kg"><label class="form-label fw-semibold mb-1" for="ev-kg">Số ký</label>' +
        '<input type="text" class="form-control" id="ev-kg" inputmode="decimal" autocomplete="off"><div class="form-text ev-lock d-none"></div></div></div>' +

        '<div class="mb-1" data-f="note"><label class="form-label fw-semibold mb-1" for="ev-note">Ghi chú</label>' +
        '<textarea class="form-control" id="ev-note" rows="2" maxlength="150"></textarea>' +
        '<div class="form-text ev-lock d-none"></div></div>' +
        '<div id="evError" class="alert alert-danger py-2 small mt-3 mb-0 d-none"></div>' +
        '</div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-light" data-bs-dismiss="modal">Đóng</button>' +
        '<button type="button" class="btn btn-primary" id="ev-save" disabled><i class="bi bi-check2-circle"></i> Lưu thay đổi</button>' +
        '</div></div></div></div>';

    w.OpenEditViettelOrder = function (realorderid) {
        $.ajax({
            url: '/getvieteleditinfo', method: 'POST', dataType: 'JSON', data: { realorderid: realorderid },
            success: function (res) { if (res && res.success) buildModal(res); else toast('danger', (res && res.message) || 'Không tải được đơn'); },
            error: function (xhr) { toast('danger', errMsg(xhr, 'Không tải được thông tin đơn, thử lại sau.')); }
        });
    };

    function buildModal(res) {
        var old = document.getElementById('modalEditViettel');
        if (old) old.remove();
        document.body.insertAdjacentHTML('beforeend', SKELETON);

        var el = document.getElementById('modalEditViettel');
        var order = res.order, policy = res.policy;
        var $ = w.jQuery;
        var st = { checkedAddr: null, busy: false };
        var origAddr = normAddr(order.address);

        function q(id) { return document.getElementById(id); }
        var input = {};
        FIELDS.forEach(function (f) { input[f] = q('ev-' + f); });

        // --- giá trị hiện tại ---
        q('ev-realorderid').value = order.realorderid;
        q('ev-orderid').value = order.orderid || '';
        input.name.value = order.name || '';
        input.phone.value = order.phone || '';
        input.address.value = order.address || '';
        input.cod.value = fmtMoney(order.cod);
        input.kg.value = order.kg === 0 ? '' : String(order.kg);
        input.note.value = order.note || '';

        // --- quyền sửa (do server quyết định) ---
        var box = q('evStatus');
        var statusText = order.statustext || (order.statuscode === null || order.statuscode === undefined ? 'Mới tạo' : 'Mã ' + order.statuscode);
        var editable = FIELDS.filter(function (f) { return policy.fields.indexOf(f) !== -1; });
        if (policy.editable) {
            box.className = 'alert alert-info py-2 small mb-3';
            box.innerHTML = '<div><b>Trạng thái:</b> ' + esc(statusText) + ' <span class="text-body-secondary">(' + esc(policy.label) + ')</span></div>' +
                '<div><b>Được sửa:</b> ' + editable.map(function (f) { return esc(LABELS[f]); }).join(', ') + '</div>' +
                (policy.notices || []).map(function (n) { return '<div class="text-warning-emphasis">' + esc(n) + '</div>'; }).join('');
        } else {
            box.className = 'alert alert-danger py-2 small mb-3';
            box.innerHTML = '<div><b>Trạng thái:</b> ' + esc(statusText) + '</div><div><b>Không thể sửa đơn này:</b> ' + esc(policy.reason || '') + '</div>';
        }
        FIELDS.forEach(function (f) {
            var ok = policy.fields.indexOf(f) !== -1;
            input[f].disabled = !ok;
            var hint = el.querySelector('[data-f="' + f + '"] .ev-lock');
            if (!ok && hint) {
                hint.classList.remove('d-none');
                hint.innerHTML = '<i class="bi bi-lock-fill"></i> Không sửa được ở trạng thái này';
            }
        });
        if (policy.fields.indexOf('address') === -1) q('ev-checkaddr').classList.add('d-none');

        // --- helpers trạng thái ---
        function current() {
            return {
                name: input.name.value.trim(),
                phone: input.phone.value.trim(),
                address: normAddr(input.address.value),
                cod: digits(input.cod.value),
                kg: input.kg.value.trim().replace(',', '.'),
                note: input.note.value.trim()
            };
        }
        function origOf(f) {
            if (f === 'cod') return String(order.cod || 0);
            if (f === 'kg') return String(order.kg || '');
            if (f === 'address') return origAddr;
            return String(order[f] === null || order[f] === undefined ? '' : order[f]).trim();
        }
        function changedFields() {
            var c = current();
            return editable.filter(function (f) {
                if (f === 'kg') return Number(c.kg) !== Number(origOf('kg'));
                if (f === 'cod') return Number(c.cod || 0) !== Number(origOf('cod'));
                if (f === 'phone') return digits(c.phone) !== digits(origOf('phone'));
                return c[f] !== origOf(f);
            });
        }
        function addressState() { // 'same' | 'verified' | 'pending'
            var a = current().address;
            if (a === origAddr) return 'same';
            return st.checkedAddr === a ? 'verified' : 'pending';
        }
        function refresh() {
            var ch = changedFields();
            FIELDS.forEach(function (f) { input[f].classList.toggle('border-primary', ch.indexOf(f) !== -1); });
            var addr = addressState();
            q('ev-save').disabled = st.busy || !policy.editable || ch.length === 0 || (ch.indexOf('address') !== -1 && addr !== 'verified');
            var r = q('ev-addrresult');
            if (ch.indexOf('address') !== -1 && addr === 'pending' && !r.getAttribute('data-keep')) {
                r.className = 'small text-warning-emphasis';
                r.textContent = 'Địa chỉ đã đổi, hãy bấm "Kiểm tra địa chỉ" trước khi lưu.';
            } else if (ch.indexOf('address') === -1 && !r.getAttribute('data-keep')) {
                r.textContent = '';
            }
        }
        function showError(msg) {
            var e = q('evError');
            if (msg) { e.textContent = msg; e.classList.remove('d-none'); } else { e.classList.add('d-none'); }
        }

        // --- sự kiện ---
        input.cod.addEventListener('input', function () {
            var d = digits(input.cod.value);
            input.cod.value = d ? Number(d).toLocaleString('vi-VN') : '';
            refresh();
        });
        ['name', 'phone', 'kg', 'note'].forEach(function (f) { input[f].addEventListener('input', refresh); });
        input.address.addEventListener('input', function () {
            q('ev-addrresult').removeAttribute('data-keep');
            q('ev-addrresult').textContent = '';
            refresh();
        });

        q('ev-checkaddr').addEventListener('click', function () {
            var btn = this, a = current().address;
            var r = q('ev-addrresult');
            if (a.length < 10) { r.className = 'small text-danger'; r.textContent = 'Địa chỉ quá ngắn.'; r.setAttribute('data-keep', '1'); return; }
            btn.disabled = true;
            r.className = 'small text-body-secondary'; r.textContent = 'Đang kiểm tra...'; r.setAttribute('data-keep', '1');
            $.ajax({
                url: '/checkaddressviettel', method: 'POST', dataType: 'JSON', data: { address: a },
                success: function (d) {
                    if (d && d.ok) {
                        st.checkedAddr = a;
                        r.className = 'small text-success';
                        r.innerHTML = '<i class="bi bi-check-circle-fill"></i> Nhận diện: <b>' + esc(d.xa) + '</b>, ' + esc(d.huyen) + ', ' + esc(d.tinh);
                    } else {
                        st.checkedAddr = null;
                        r.className = 'small text-danger';
                        var part = (d && (d.huyen || d.tinh)) ? ' (nhận được: ' + esc([d.huyen, d.tinh].filter(Boolean).join(', ')) + ')' : '';
                        r.innerHTML = '<i class="bi bi-x-circle-fill"></i> ' + esc((d && d.message) || 'Không nhận diện được địa chỉ') + part;
                    }
                },
                error: function (xhr) {
                    st.checkedAddr = null;
                    r.className = 'small text-danger';
                    r.textContent = errMsg(xhr, 'Không kiểm tra được địa chỉ, thử lại sau.');
                },
                complete: function () { btn.disabled = false; refresh(); }
            });
        });

        q('ev-save').addEventListener('click', function () {
            var c = current(), data = { realorderid: order.realorderid };
            editable.forEach(function (f) { data[f] = c[f]; }); // chỉ gửi trường được phép sửa
            st.busy = true; showError(''); refresh();
            var btn = q('ev-save'), html = btn.innerHTML;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Đang lưu...';
            $.ajax({
                url: '/editorderviettel', method: 'POST', dataType: 'JSON', data: data,
                success: function (d) {
                    if (d && d.warnings && d.warnings.length) toast('warning', d.warnings.join(' '), 6000);
                    else toast('success', (d && d.message) || 'Đã cập nhật đơn', 2500);
                    $(document).trigger('viettelOrderEdited', [d]);
                    st.done = true;
                    bootstrap.Modal.getInstance(el).hide();
                },
                error: function (xhr) {
                    var m = errSource(xhr) + errMsg(xhr, 'Không thể lưu, thử lại sau.');
                    showError(m);
                    st.busy = false; btn.innerHTML = html; refresh();
                }
            });
        });

        el.addEventListener('hidden.bs.modal', function () {
            var done = st.done;
            el.remove();
            // sau khi lưu: mở lại chi tiết đơn để thấy dữ liệu mới
            if (done && typeof w.DetailDonHang === 'function') w.DetailDonHang(order.realorderid);
        });

        refresh();
        new bootstrap.Modal(el).show();
    }
})(window);
