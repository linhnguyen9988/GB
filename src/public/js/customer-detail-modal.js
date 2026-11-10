'use strict';

function EditEsc(v) {
    return String(v === null || v === undefined || v === 'null' ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function EditPlainName(title, fallback) {
    var tmp = document.createElement('template');
    tmp.innerHTML = title || '';
    tmp.content.querySelectorAll('span, svg, i, button, small, br').forEach(function (el) { el.remove(); });
    var t = tmp.content.textContent.trim();
    return t || fallback || '';
}

function LoadEditRecentOrders(box, userid, realfbid, name, phone) {
    $.ajax({
        url: '/api/orders/recent',
        method: 'GET',
        data: { userid: userid, realfbid: realfbid, limit: 5 },
        dataType: 'JSON',
        success: function (res) {
            if (!box.isConnected) return;
            var list = (res && res.data) ? res.data.slice(0, 5) : [];
            if (list.length === 0) {
                box.innerHTML = '<div class="text-muted small text-center py-2">Khách chưa có đơn nào.</div>';
                return;
            }
            box.innerHTML = list.map(function (o) {
                var cod = new Intl.NumberFormat('vi-VN').format(o.cod || 0) + ' ₫';
                var d = o.time ? new Date(o.time) : null;
                var dateStr = (d && !isNaN(d)) ? d.toLocaleDateString('vi-VN') : '';
                var status = GBOrderStatus.get(o.provider, o.statuscode, o.statustext);
                var code = o.realorderid || o.orderid || '';
                return '<div class="border rounded-3 p-2 px-3 mb-2">'
                    + '<div class="d-flex justify-content-between align-items-center gap-2">'
                    + '<span class="fw-bold text-break small">' + EditEsc(code) + '</span>'
                    + '<span class="badge gb-order-status text-bg-' + status.color + '">' + EditEsc(status.label) + '</span>'
                    + '</div>'
                    + '<div class="d-flex justify-content-between align-items-center mt-1">'
                    + '<div class="small text-muted">'
                    + '<span class="text-success fw-semibold">COD ' + EditEsc(cod) + '</span>'
                    + ' · ' + EditEsc(o.kg === null || o.kg === undefined ? '' : o.kg) + ' Kg'
                    + (dateStr ? ' · ' + EditEsc(dateStr) : '')
                    + '</div>'
                    + '<button type="button" class="btn btn-outline-primary btn-sm py-0 edit-order-journey" data-order="' + EditEsc(code) + '"><i class="bi bi-truck"></i> Hành trình</button>'
                    + '</div></div>';
            }).join('');
            box.querySelectorAll('.edit-order-journey').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    EditOpenJourney(btn, name, userid, phone);
                });
            });
        },
        error: function () {
            if (box.isConnected) box.innerHTML = '<div class="text-danger small text-center py-2">Không tải được danh sách đơn.</div>';
        }
    });
}

function restoreModalFocus(trigger) {
    if (!trigger?.isConnected) return;
    const parent = trigger.closest('.modal.show');
    if (parent) {
        document.body.classList.add('modal-open');
        // Bootstrap uses a single document focus trap, so restore the parent after the child closes.
        const trap = bootstrap.Modal.getInstance(parent)?._focustrap;
        trap?.deactivate();
        trap?.activate();
    }
    trigger.focus();
}

function EditOpenJourney(button, name, userid, phone) {
    const orderNumber = button.dataset.order;
    const tracking = document.getElementById('trackingModal');
    if (!tracking || !orderNumber) return;
    tracking.addEventListener('hidden.bs.modal', () => restoreModalFocus(button), { once: true });
    OrderJourney(orderNumber, name, userid, phone);
}

function ShowCustomerDetails({ name, userid, phone, diachi, note, label, realfbid, nn, trigger, onSaved }) {
    if (document.getElementById('modaledit')) return;
    name = name || 'Khách hàng';
    var labels = ['Thân thiết', 'Bom hàng', 'Xả hàng', 'Có vấn đề'];
    var curLabel = (label === null || label === undefined || label === 'null') ? '' : String(label).trim();
    var labelOpts = '<option value="">— Không nhãn —</option>' + labels.map(function (l) {
        return '<option value="' + l + '"' + (l === curLabel ? ' selected' : '') + '>' + l + '</option>';
    }).join('');
    if (curLabel && labels.indexOf(curLabel) === -1) {
        labelOpts += '<option value="' + EditEsc(curLabel) + '" selected>' + EditEsc(curLabel) + '</option>';
    }
    var nnOpts = '<option value=""' + ((nn !== 'Nước ngoài' && nn !== 'Trong nước') ? ' selected' : '') + '>Chưa chọn</option>'
        + '<option value="Trong nước"' + (nn === 'Trong nước' ? ' selected' : '') + '>Trong nước</option>'
        + '<option value="Nước ngoài"' + (nn === 'Nước ngoài' ? ' selected' : '') + '>Nước ngoài</option>';
    var badge = '';
    if (curLabel.indexOf('Xả') !== -1 || curLabel.indexOf('Bom') !== -1) badge = '<span class="badge bg-danger">' + EditEsc(curLabel) + '</span>';
    else if (curLabel.indexOf('Có') !== -1) badge = '<span class="badge bg-warning text-dark">' + EditEsc(curLabel) + '</span>';
    else if (curLabel.indexOf('Thân') !== -1) badge = '<span class="badge bg-success">' + EditEsc(curLabel) + '</span>';

    document.body.insertAdjacentHTML("beforeend",
        `<div class="modal" tabindex="-1" role="dialog" id="modaledit" aria-labelledby="customer-detail-title">
    <div class="modal-dialog modal-dialog-scrollable" role="document">
      <div class="modal-content rounded-4 shadow">
        <div class="modal-header p-4 pb-3 border-bottom-0">
          <div class="d-flex align-items-center flex-grow-1 me-3" style="min-width:0">
            <img src="/images/ava/${encodeURIComponent(userid)}.jpg" class="rounded-circle me-3" width="48" height="48" alt="" onerror="this.onerror=null;this.src='/images/ava/default.jpg'">
            <div style="min-width:0">
              <h3 id="customer-detail-title" class="fw-bold mb-0 text-truncate">${EditEsc(name)}</h3>
              <div class="mt-1">${badge}</div>
            </div>
          </div>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>

        <form class="modal-body p-4 pt-0">
          <div class="border rounded-3 p-3 mb-3 bg-body-tertiary small">
            <div class="d-flex justify-content-between"><span class="text-muted">ID</span><span class="text-break">${EditEsc(userid)}</span></div>
            <div class="d-flex justify-content-between mt-1"><span class="text-muted">Real FB ID</span><span class="text-break">${EditEsc(realfbid)}</span></div>
            <input type="hidden" id="customer-detail-userid" name="userid" value="${EditEsc(userid)}">
            <input type="hidden" id="customer-detail-realfbid" name="realfbid" value="${EditEsc(realfbid)}">
          </div>

          <div class="row g-3">
            <div class="col-12">
              <label class="form-label small text-muted mb-1" for="customer-detail-phone"><i class="bi bi-phone-fill"></i> Số điện thoại</label>
              <input type="text" id="customer-detail-phone" name="phone" class="form-control" inputmode="tel" value="${EditEsc(phone)}">
            </div>
            <div class="col-6">
              <label class="form-label small text-muted mb-1" for="customer-detail-label"><i class="bi bi-tag-fill"></i> Nhãn</label>
              <select id="customer-detail-label" name="label" class="form-select">${labelOpts}</select>
            </div>
            <div class="col-6">
              <label class="form-label small text-muted mb-1" for="customer-detail-nn"><i class="bi bi-globe2"></i> Khu vực</label>
              <select id="customer-detail-nn" name="nn" class="form-select">${nnOpts}</select>
            </div>
            <div class="col-12">
              <label class="form-label small text-muted mb-1" for="customer-detail-diachi"><i class="bi bi-geo-alt-fill"></i> Địa chỉ</label>
              <textarea class="form-control" id="customer-detail-diachi" name="diachi" rows="2">${EditEsc(diachi)}</textarea>
            </div>
            <div class="col-12">
              <label class="form-label small text-muted mb-1" for="customer-detail-note"><i class="bi bi-journal-bookmark-fill"></i> Ghi chú</label>
              <textarea class="form-control" id="customer-detail-note" name="note" rows="4">${EditEsc(note)}</textarea>
            </div>
            <div class="col-12">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <label class="form-label small text-muted mb-0"><i class="bi bi-box-seam-fill"></i> 5 đơn gần nhất</label>
              </div>
              <div id="edit-recent-orders"><div class="text-center text-muted small py-2"><span class="spinner-border spinner-border-sm"></span> Đang tải...</div></div>
            </div>
          </div>

          <div class="d-flex gap-2 mt-4">
            <button class="btn btn-outline-secondary flex-grow-1" type="button" data-bs-dismiss="modal">Hủy</button>
            <button class="btn btn-primary flex-grow-1" type="submit"><i class="bi bi-check-lg"></i> Lưu</button>
          </div>
        </form>
      </div>
    </div>
  </div>`);
    const modal = document.getElementById('modaledit');
    const instance = bootstrap.Modal.getOrCreateInstance(modal);
    const form = modal.querySelector('form');
    form.addEventListener('submit', async function (event) {
        event.preventDefault();
        const button = form.querySelector('[type="submit"]');
        if (button.disabled) return;
        const details = Object.fromEntries(new FormData(form));
        button.disabled = true;
        try {
            await $.ajax({ url: '/updateuser', method: 'POST', data: details, dataType: 'json' });
        } catch (_) {
            ShowCenterToast('danger', 'Sửa thất bại, vui lòng thử lại', 3000);
            return;
        } finally {
            button.disabled = false;
        }
        if (onSaved) onSaved(details);
        ShowCenterToast('success', 'Đã sửa thành công', 3000);
        if (modal.isConnected) instance.hide();
    });

    modal.addEventListener('hidden.bs.modal', function () {
        instance.dispose();
        modal.remove();
        restoreModalFocus(trigger);
    }, { once: true });
    instance.show();
    LoadEditRecentOrders(modal.querySelector('#edit-recent-orders'), userid, realfbid, name, phone);
}
