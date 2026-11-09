var FINAL_ORDER_STATUSES = [101, 107, 201, 501, 503, 504];

function formatOrderDetailWeight(order) {
  const current = Number(order.kg);
  if (!Number.isFinite(current) || current <= 0) return '—';

  const original = Number(order.original_kg);
  const isJT = order.provider === 'J&T';
  const isViettel = (order.provider || 'Viettel') === 'Viettel';
  const convertedJT = isJT && original === 3;
  const declared = convertedJT ? 2 : original;
  const unconfirmedJT = convertedJT && current === 3 && Number(order.jt_weight_reported) !== 1;
  const changed = (isJT || isViettel) && Number.isFinite(declared) && declared > 0 &&
    !unconfirmedJT && Math.abs(current - declared) > 0.000001;

  const format = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 });
  const currentText = format.format(current) + ' kg';
  return changed ? format.format(declared) + ' kg → ' + currentText : currentText;
}

function getJTOrderIssue(order) {
  return order.provider === 'J&T' && [118, 120].includes(Number(order.statuscode)) ? String(order.issue || '') : '';
}

function updateJTOrderIssue(element, order) {
  if (!element) return;
  element.textContent = getJTOrderIssue(order);
  element.hidden = !element.textContent;
}

function loadOrderDetailsForRefresh(orderNumber, onSuccess) {
  $.ajax({
    url: '/detaildonhang',
    method: 'POST',
    data: { realorderid: orderNumber },
    dataType: 'JSON',
    success: function (res) {
      var order = res && res.data && res.data[0];
      if (order) onSuccess(order);
    }
  });
}

function canRefreshOrderStatus(order) {
  if (!order) return false;
  if (order.provider === 'J&T') {
    return true;
  }
  if ((order.provider || 'Viettel') !== 'Viettel') return false;
  if (/1P\d+$/i.test(String(order.realorderid || ''))) return false;
  return FINAL_ORDER_STATUSES.indexOf(Number(order.statuscode)) === -1;
}

function requestOrderStatusRefresh(orderNumber, btn, onSuccess, provider) {
  if (!orderNumber || btn.disabled) return;
  var refreshUrl = provider === 'J&T' ? '/refreshstatusjt' : '/refreshstatusviettel';
  btn.disabled = true;
  btn.classList.add('is-loading');
  $.ajax({
    url: refreshUrl,
    method: 'POST',
    data: { realorderid: orderNumber },
    dataType: 'JSON',
    success: function (res) {
      var text = res.statustext || ('Trạng thái ' + res.statuscode);
      if (provider === 'J&T' && Number.isInteger(res.logCount)) {
        ShowCenterToast('success', 'Đã tải lại ' + res.logCount + ' mốc hành trình J&T.', 3000);
      } else {
        ShowCenterToast(res.changed ? 'success' : 'info', (res.changed ? 'Đã cập nhật: ' : 'Chưa có thay đổi: ') + text, 3000);
      }
      if (typeof onSuccess === 'function') onSuccess(res);
    },
    error: function (xhr) {
      var msg = (xhr.responseJSON && xhr.responseJSON.message) || 'Không thể cập nhật trạng thái, thử lại sau';
      ShowCenterToast('danger', gbEscapeText(msg), 5000);
    },
    complete: function () {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  });
}

function RefreshStatusInDetail(btn, orderNumber, provider) {
  var modal = btn.closest('#modaldetail');
  requestOrderStatusRefresh(orderNumber, btn, function (res) {
    if (!modal || !modal.isConnected) return;
    var badge = modal.querySelector('.order-detail-status');
    if (badge) {
      badge.textContent = res.statustext || 'Đang xử lý';
      var color = (typeof statusBadgeClass === 'function') ? statusBadgeClass(res.statuscode) : 'secondary';
      badge.className = badge.className.replace(/\bbg-\S+/g, '').replace(/\s+/g, ' ').trim() + ' bg-' + color;
    }
    var weight = modal.querySelector('.order-detail-weight');
    var issue = modal.querySelector('.order-detail-issue');
    if (weight || issue) {
      loadOrderDetailsForRefresh(orderNumber, function (order) {
        if (!modal.isConnected) return;
        if (weight) weight.textContent = formatOrderDetailWeight(order);
        updateJTOrderIssue(issue, order);
      });
    }
    if (res.isFinal && provider !== 'J&T') btn.remove();
  }, provider);
}

function setupTrackingRefreshButton(orderNumber) {
  var btn = document.getElementById('header-order-refresh');
  if (!btn) return;
  btn.classList.add('d-none');
  loadOrderDetailsForRefresh(orderNumber, function (order) {
    var shown = document.getElementById('header-order-number');
    if (!shown || shown.textContent.trim() !== String(orderNumber)) return;

    var weight = document.getElementById('header-order-weight');
    if (weight) weight.textContent = formatOrderDetailWeight(order);
    updateJTOrderIssue(document.getElementById('header-order-issue'), order);
    if (canRefreshOrderStatus(order)) {
      btn.dataset.provider = order.provider || 'Viettel';
      btn.title = 'Cập nhật trạng thái từ ' + (order.provider === 'J&T' ? 'J&T' : 'Viettel');
      btn.classList.remove('d-none');
    }
  });
}

function RefreshStatusInTracking(btn) {
  var shown = document.getElementById('header-order-number');
  var orderNumber = shown ? shown.textContent.trim() : '';
  var provider = btn.dataset.provider || 'Viettel';
  requestOrderStatusRefresh(orderNumber, btn, function (res) {
    if (!shown || shown.textContent.trim() !== orderNumber) return;
    setupTrackingRefreshButton(orderNumber);
    if (provider === 'J&T' && typeof loadOrderJourney === 'function') loadOrderJourney(orderNumber);
  }, provider);
}
