var FINAL_ORDER_STATUSES = [101, 107, 201, 501, 503, 504];
var JT_FINAL_ORDER_STATUSES = [105, 113, 117];

function canRefreshOrderStatus(order) {
  if (!order) return false;
  if (order.provider === 'J&T') {
    return JT_FINAL_ORDER_STATUSES.indexOf(Number(order.statuscode)) === -1;
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

function RefreshStatusInDetail(btn, orderNumber, provider) {
  requestOrderStatusRefresh(orderNumber, btn, function (res) {
    var modal = document.getElementById('modaldetail');
    var badge = modal && modal.querySelector('.order-detail-status');
    if (badge) {
      badge.textContent = res.statustext || 'Đang xử lý';
      var color = (typeof statusBadgeClass === 'function') ? statusBadgeClass(res.statuscode) : 'secondary';
      badge.className = badge.className.replace(/\bbg-\S+/g, '').replace(/\s+/g, ' ').trim() + ' bg-' + color;
    }
    if (res.isFinal) btn.remove();
  }, provider);
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
        btn.dataset.provider = order.provider || 'Viettel';
        btn.title = 'Cập nhật trạng thái từ ' + (order.provider === 'J&T' ? 'J&T' : 'Viettel');
        btn.classList.remove('d-none');
      }
    }
  });
}

function RefreshStatusInTracking(btn) {
  var shown = document.getElementById('header-order-number');
  var orderNumber = shown ? shown.textContent.trim() : '';
  var provider = btn.dataset.provider || 'Viettel';
  requestOrderStatusRefresh(orderNumber, btn, function (res) {
    if (res.isFinal) btn.classList.add('d-none');
    // J&T: hành trình vừa được kéo lại từ J&T -> tải lại danh sách hành trình đang xem
    if (provider === 'J&T' && typeof loadOrderJourney === 'function') loadOrderJourney(orderNumber);
  }, provider);
}
