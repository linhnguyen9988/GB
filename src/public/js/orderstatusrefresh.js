var FINAL_ORDER_STATUSES = [101, 107, 201, 501, 503, 504];

function canRefreshOrderStatus(order) {
  if (!order) return false;
  if ((order.provider || 'Viettel') !== 'Viettel') return false;
  if (/1P\d+$/i.test(String(order.realorderid || ''))) return false;
  return FINAL_ORDER_STATUSES.indexOf(Number(order.statuscode)) === -1;
}

function requestOrderStatusRefresh(orderNumber, btn, onSuccess) {
  if (!orderNumber || btn.disabled) return;
  btn.disabled = true;
  btn.classList.add('is-loading');
  $.ajax({
    url: '/refreshstatusviettel',
    method: 'POST',
    data: { realorderid: orderNumber },
    dataType: 'JSON',
    success: function (res) {
      var text = res.statustext || ('Trạng thái ' + res.statuscode);
      ShowCenterToast(res.changed ? 'success' : 'info', (res.changed ? 'Đã cập nhật: ' : 'Chưa có thay đổi: ') + text, 3000);
      if (typeof onSuccess === 'function') onSuccess(res);
    },
    error: function (xhr) {
      var msg = (xhr.responseJSON && xhr.responseJSON.message) || 'Không thể cập nhật trạng thái, thử lại sau';
      ShowCenterToast('danger', msg, 3500);
    },
    complete: function () {
      btn.disabled = false;
      btn.classList.remove('is-loading');
    }
  });
}

function RefreshStatusInDetail(btn, orderNumber) {
  requestOrderStatusRefresh(orderNumber, btn, function (res) {
    var modal = document.getElementById('modaldetail');
    var badge = modal && modal.querySelector('.order-detail-status');
    if (badge) {
      badge.textContent = res.statustext || 'Đang xử lý';
      var color = (typeof statusBadgeClass === 'function') ? statusBadgeClass(res.statuscode) : 'secondary';
      badge.className = badge.className.replace(/\bbg-\S+/g, '').replace(/\s+/g, ' ').trim() + ' bg-' + color;
    }
    if (res.isFinal) btn.remove();
  });
}

function setupTrackingRefreshButton(orderNumber) {
  var btn = document.getElementById('header-order-refresh');
  if (!btn) return;
  btn.classList.add('d-none');
  $.ajax({
    url: '/detaildonhang',
    method: 'POST',
    data: { realorderid: orderNumber },
    dataType: 'JSON',
    success: function (res) {
      var order = res && res.data && res.data[0];
      var shown = document.getElementById('header-order-number');
      if (shown && shown.textContent.trim() === String(orderNumber) && canRefreshOrderStatus(order)) {
        btn.classList.remove('d-none');
      }
    }
  });
}

function RefreshStatusInTracking(btn) {
  var shown = document.getElementById('header-order-number');
  var orderNumber = shown ? shown.textContent.trim() : '';
  requestOrderStatusRefresh(orderNumber, btn, function (res) {
    if (res.isFinal) btn.classList.add('d-none');
  });
}
