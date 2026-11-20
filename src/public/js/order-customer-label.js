'use strict';

const GBOrderCustomerLabel = (() => {
  function mount(container, customer) {
    if (!container) return;
    const title = document.createElement('label');
    title.className = 'order-detail-label mb-1';
    title.textContent = 'Nhãn khách hàng';
    const select = document.createElement('select');
    select.className = 'form-select form-select-sm';
    select.setAttribute('aria-label', 'Sửa nhãn khách hàng');
    const status = document.createElement('span');
    status.className = 'small d-block mt-1';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    let saved = String(customer.label || '');
    const labels = ['', 'Thân thiết', 'Bom hàng', 'Xả hàng', 'Có vấn đề'];
    if (saved && !labels.includes(saved)) labels.push(saved);
    for (const label of labels) select.add(new Option(label || 'Không có nhãn', label));
    select.value = saved;
    title.appendChild(select);
    title.classList.add('d-block');
    container.replaceChildren(title, status);
    const id = String(customer.customerId || '');
    if (!/^\d{1,20}$/.test(id)) {
      select.disabled = true;
      status.textContent = 'Đơn này chưa liên kết hồ sơ khách hàng.';
      return;
    }
    select.addEventListener('change', async () => {
      const label = select.value;
      if (label === saved || select.disabled) return;
      select.disabled = true;
      status.className = 'small d-block mt-1 text-body-secondary';
      status.textContent = 'Đang lưu…';
      try {
        const response = await fetch('/api/customers/' + encodeURIComponent(id), {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label })
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || result.message || 'Không lưu được nhãn khách hàng.');
        saved = label;
        status.className = 'small d-block mt-1 text-success';
        status.textContent = 'Đã lưu nhãn';
      } catch (error) {
        select.value = saved;
        status.className = 'small d-block mt-1 text-danger';
        status.textContent = error.message;
        if (typeof ShowCenterToast === 'function') ShowCenterToast('danger', error.message, 5000);
      } finally { select.disabled = false; }
    });
  }
  return { mount };
})();
