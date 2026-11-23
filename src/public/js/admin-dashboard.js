'use strict';

    let viettelDraftId = null;
    let viettelEditAccountId = null;
    let viettelRateRequestSeq = 0;
    const viettelModal = () => bootstrap.Modal.getOrCreateInstance(document.getElementById('viettelAccountModal'));

    let viettelSenderAccountId = null;

    function openViettelSender(button) {
      viettelSenderAccountId = button.dataset.accountId;
      document.getElementById('viettelSenderName').value = button.dataset.senderName || '';
      document.getElementById('viettelSenderPhone').value = button.dataset.senderPhone || '';
      document.getElementById('viettelSenderAddress').value = button.dataset.senderAddress || '';
      document.getElementById('viettelSenderError').classList.add('d-none');
      bootstrap.Modal.getOrCreateInstance(document.getElementById('viettelSenderModal')).show();
    }

    document.getElementById('viettelSenderForm').addEventListener('submit', async function (event) {
      event.preventDefault();
      if (!this.reportValidity() || !viettelSenderAccountId) return;
      const button = document.getElementById('viettelSenderSave');
      if (button.disabled) return;
      const errorBox = document.getElementById('viettelSenderError');
      errorBox.classList.add('d-none');
      button.disabled = true;
      button.textContent = 'Đang lưu...';
      try {
        await viettelApi('/api/viettel/accounts/' + encodeURIComponent(viettelSenderAccountId) + '/sender', {
          method: 'PATCH',
          body: JSON.stringify({
            name: document.getElementById('viettelSenderName').value.trim(),
            phone: document.getElementById('viettelSenderPhone').value.trim(),
            address: document.getElementById('viettelSenderAddress').value.trim()
          })
        });
        window.location.reload();
      } catch (error) {
        errorBox.textContent = error.message;
        errorBox.classList.remove('d-none');
      } finally {
        button.disabled = false;
        button.textContent = 'Lưu người gửi';
      }
    });

    function showViettelError(message) {
      const el = document.getElementById('viettelModalError');
      el.textContent = message || 'Có lỗi xảy ra.';
      el.classList.remove('d-none');
    }
    function clearViettelError() {
      const el = document.getElementById('viettelModalError');
      el.textContent = '';
      el.classList.add('d-none');
    }
    function setViettelBusy(busy) {
      document.getElementById('viettelPrepareBtn').disabled = !!busy;
      document.getElementById('viettelPrepareSpinner').classList.toggle('d-none', !busy);
    }
    function openViettelModal(mode, accountId, username) {
      viettelRateRequestSeq += 1;
      viettelDraftId = null;
      viettelEditAccountId = mode === 'edit' ? String(accountId) : null;
      clearViettelError();
      document.getElementById('viettelModalTitle').textContent = mode === 'edit' ? 'Cập nhật tài khoản Viettel Post' : 'Thêm tài khoản Viettel Post';
      document.getElementById('viettelModalStepLabel').textContent = 'Bước 1/2 · Xác thực tài khoản';
      document.getElementById('viettelUsername').value = username || '';
      document.getElementById('viettelUsername').readOnly = mode === 'edit';
      document.getElementById('viettelPassword').value = '';
      document.getElementById('viettelPassword').placeholder = mode === 'edit' ? 'Nhập mật khẩu mới của tài khoản' : 'Nhập mật khẩu Viettel Post';
      document.getElementById('viettelStepCredentials').classList.remove('d-none');
      document.getElementById('viettelStepSelection').classList.add('d-none');
      document.getElementById('viettelBackBtn').classList.add('d-none');
      document.getElementById('viettelSaveBtn').classList.add('d-none');
      document.getElementById('viettelSaveBtn').disabled = true;
      document.getElementById('viettelServiceChoices').replaceChildren();
      document.getElementById('viettelServiceHint').textContent = 'Chọn kho để hệ thống gọi API lấy bảng giá.';
      document.getElementById('viettelWarehouseSelect').onchange = null;
      document.getElementById('viettelPrepareBtn').classList.remove('d-none');
      viettelModal().show();
    }

    async function viettelApi(url, options = {}) {
      const response = await fetch(url, {
        credentials: 'same-origin',
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.success === false) throw new Error(result.message || 'Yêu cầu không thành công.');
      return result;
    }

    async function prepareViettelAccount() {
      clearViettelError();
      const username = document.getElementById('viettelUsername').value.trim();
      const password = document.getElementById('viettelPassword').value;
      if (!username || !password) return showViettelError('Vui lòng nhập đầy đủ username và mật khẩu Viettel.');
      setViettelBusy(true);
      try {
        const result = await viettelApi('/api/viettel/accounts/prepare', {
          method: 'POST',
          body: JSON.stringify({ username, password, accountId: viettelEditAccountId })
        });
        viettelDraftId = result.draftId;
        document.getElementById('viettelPassword').value = '';
        const warehouseSelect = document.getElementById('viettelWarehouseSelect');
        warehouseSelect.replaceChildren();
        const warehousePlaceholder = document.createElement('option');
        warehousePlaceholder.value = '';
        warehousePlaceholder.textContent = '-- Chọn kho mặc định để lên đơn --';
        warehousePlaceholder.selected = true;
        warehouseSelect.appendChild(warehousePlaceholder);
        result.warehouses.forEach((warehouse) => {
          const option = document.createElement('option');
          option.value = warehouse.groupaddressId;
          option.textContent = `${warehouse.name} · ${warehouse.address} · ${warehouse.phone} · ID ${warehouse.groupaddressId}`;
          warehouseSelect.appendChild(option);
        });

        const serviceChoices = document.getElementById('viettelServiceChoices');
        serviceChoices.replaceChildren();
        document.getElementById('viettelServiceHint').textContent = 'Chọn kho mặc định để lấy bảng giá dịch vụ theo địa chỉ kho.';
        warehouseSelect.onchange = loadViettelServices;

        document.getElementById('viettelStepCredentials').classList.add('d-none');
        document.getElementById('viettelStepSelection').classList.remove('d-none');
        document.getElementById('viettelModalStepLabel').textContent = 'Bước 2/2 · Chọn kho và dịch vụ';
        document.getElementById('viettelPrepareBtn').classList.add('d-none');
        document.getElementById('viettelBackBtn').classList.remove('d-none');
        document.getElementById('viettelSaveBtn').classList.remove('d-none');
        document.getElementById('viettelSaveBtn').disabled = true;
      } catch (error) {
        showViettelError(error.message);
      } finally {
        setViettelBusy(false);
      }
    }


    async function loadViettelServices() {
      const warehouseId = document.getElementById('viettelWarehouseSelect').value;
      const serviceChoices = document.getElementById('viettelServiceChoices');
      const hint = document.getElementById('viettelServiceHint');
      const saveButton = document.getElementById('viettelSaveBtn');
      const requestSeq = ++viettelRateRequestSeq;
      serviceChoices.replaceChildren();
      saveButton.disabled = true;
      if (!warehouseId || !viettelDraftId) {
        hint.textContent = 'Chọn kho để hệ thống gọi API lấy bảng giá.';
        return;
      }
      clearViettelError();
      hint.textContent = 'Đang gọi Viettel Post lấy bảng giá theo địa chỉ kho...';
      try {
        const result = await viettelApi('/api/viettel/accounts/services', {
          method: 'POST',
          body: JSON.stringify({ draftId: viettelDraftId, groupaddressId: warehouseId })
        });
        if (requestSeq !== viettelRateRequestSeq || warehouseId !== document.getElementById('viettelWarehouseSelect').value) return;
        result.services.forEach((service, index) => {
          const col = document.createElement('div');
          col.className = 'col-12 col-md-6';
          const label = document.createElement('label');
          label.className = 'border rounded-3 p-3 h-100 d-flex gap-2 align-items-start';
          label.style.cursor = 'pointer';
          const radio = document.createElement('input');
          radio.type = 'radio';
          radio.name = 'viettelServiceCode';
          radio.value = service.code;
          radio.className = 'form-check-input mt-1';
          radio.checked = index === 0;
          const details = document.createElement('span');
          details.className = 'flex-grow-1';
          const title = document.createElement('span');
          title.className = 'd-block fw-semibold';
          title.textContent = `${service.name} (${service.code})`;
          const meta = document.createElement('span');
          meta.className = 'd-block small text-muted';
          meta.textContent = `${Number(service.price || 0).toLocaleString('vi-VN')} đ · ${service.time || 'Chưa có thời gian'}`;
          details.append(title, meta);
          if (index === 0) {
            const cheapest = document.createElement('span');
            cheapest.className = 'badge text-bg-success mt-2';
            cheapest.textContent = 'Rẻ nhất';
            details.appendChild(cheapest);
            label.classList.add('border-success');
          }
          label.append(radio, details);
          col.appendChild(label);
          serviceChoices.appendChild(col);
        });
        hint.textContent = `Đã tải ${result.services.length} dịch vụ. Dịch vụ rẻ nhất được chọn sẵn.`;
        saveButton.disabled = false;
      } catch (error) {
        if (requestSeq !== viettelRateRequestSeq) return;
        hint.textContent = 'Không lấy được bảng giá. Hãy chọn lại kho hoặc thử lại.';
        showViettelError(error.message);
      }
    }

    function backToViettelCredentials() {
      clearViettelError();
      document.getElementById('viettelStepSelection').classList.add('d-none');
      document.getElementById('viettelStepCredentials').classList.remove('d-none');
      document.getElementById('viettelModalStepLabel').textContent = 'Bước 1/2 · Xác thực tài khoản';
      document.getElementById('viettelPrepareBtn').classList.remove('d-none');
      document.getElementById('viettelBackBtn').classList.add('d-none');
      document.getElementById('viettelSaveBtn').classList.add('d-none');
    }

    async function saveViettelAccount() {
      clearViettelError();
      const selectedService = document.querySelector('input[name="viettelServiceCode"]:checked');
      const warehouseId = document.getElementById('viettelWarehouseSelect').value;
      if (!viettelDraftId || !warehouseId || !selectedService) return showViettelError('Vui lòng chọn kho, đợi tải bảng giá và chọn dịch vụ chính.');
      const button = document.getElementById('viettelSaveBtn');
      button.disabled = true;
      button.textContent = 'Đang lưu...';
      try {
        await viettelApi('/api/viettel/accounts/commit', {
          method: 'POST',
          body: JSON.stringify({
            draftId: viettelDraftId,
            groupaddressId: warehouseId,
            serviceCode: selectedService.value
          })
        });
        viettelModal().hide();
        window.location.reload();
      } catch (error) {
        showViettelError(error.message);
      } finally {
        button.disabled = false;
        button.textContent = 'Lưu tài khoản';
      }
    }

    document.getElementById('viettelAccountCards')?.addEventListener('click', function (event) {
      const button = event.target.closest('[data-vt-action]');
      if (!button) return;
      const action = button.dataset.vtAction;
      const accountId = button.dataset.accountId;
      if (action === 'sender') openViettelSender(button);
      else if (action === 'edit') openViettelModal('edit', accountId, button.dataset.username || '');
      else if (action === 'delete') deleteViettelAccount(accountId);
    });

    async function deleteViettelAccount(accountId) {
      if (!confirm('Ẩn tài khoản Viettel này khỏi danh sách quản trị? Đơn cũ vẫn giữ thông tin mã hóa để tiếp tục xử lý.')) return;
      try {
        await viettelApi(`/api/viettel/accounts/${encodeURIComponent(accountId)}`, { method: 'DELETE' });
        window.location.reload();
      } catch (error) { alert(error.message); }
    }

    function PrintViettelManual() {
      var realorderid = document.getElementById("realorderid").value;
      $.ajax({
        url: "/printviettelmanual",
        method: "POST",
        dataType: "JSON",
        data: { realorderid: realorderid },// in nhieu don thi cach nhau dau ,
        success: function (data) {
        }
      });
    }
    function RequestPasswordChange() {
      var oldpassword = document.getElementById("oldpassword").value;
      var newpassword = document.getElementById("newpassword").value;
      var confirmpassword = document.getElementById("confirmpassword").value;
      $.ajax({
        url: "/changepass",
        method: "POST",
        dataType: "JSON",
        data: { oldpassword: oldpassword, newpassword: newpassword, confirmpassword: confirmpassword },
        success: function (data) {
          alert('done');
        }
      });
    }
    function OpenChangePass() {
      $('#modalpass').modal('show');
    }
    function GetAllAddress() {
      $.ajax({
        url: "/getalladdress",
        method: "POST",
        dataType: "JSON",
        data: {},
        success: function (data) {
          alert('done');
        }
      });
    }
    function md5ToBase64(input) {
      const md5Hash = CryptoJS.MD5(input);
      const wordArray = md5Hash;
      const base64String = CryptoJS.enc.Base64.stringify(wordArray);
      return base64String;
    }
    async function TokenPage() {
      $.ajax({
        url: "/gettoken",
        method: "POST",
        dataType: "JSON",
        data: {  },
        success: function (data) {
          alert('Done!')
        }
      });
    }
    async function PushJTEX() {
      $.ajax({
        url: "/pushorderjtex",
        method: "POST",
        dataType: "JSON",
        data: { fbname: "Linh ZZZZ", phone: "0559955435", address: "197 HBB", cod: 200000, kg: 3, khid: 0, realfbid: 0, xa: "Phường Thanh Bình", huyen: "Thành Phố Biên Hòa", tinh: "Đồng Nai", selfadd: 1 },
        success: function (data) {
        }
      });
    }

    async function GetUserToken(button) {
      button.disabled = true;
      button.textContent = 'Đang lấy token...';
      try {
        const response = await fetch('/api/admin/facebook/user-token', { method: 'POST' });
        const result = await response.json();
        if (!response.ok || !result.success) {
          ShowCenterToast(response.status === 409 ? 'warning' : 'danger',
            gbEscapeText(result.message || 'Không lấy được User Token.'), 5000);
          return;
        }
        const account = result.name ? ' của ' + result.name : '';
        ShowCenterToast('success', gbEscapeText('Đã cập nhật User Token' + account + '.'), 5000);
      } catch (_) {
        ShowCenterToast('danger', 'Không nhận được phản hồi khi lấy User Token.', 5000);
      } finally {
        button.textContent = 'Get User Token';
        button.disabled = false;
      }
    }

    async function sendToPrinter(userId, content, type = 'pdf', pName = "Xprinter XP-420B") {
      const apiUrl = 'https://aodaigiabao.com/print-order';

      const payload = {
        userId: userId,
        type: type, // 'pdf' hoặc 'html'
        content: content,
        config: {
          printerName: pName,         // Tên máy in thực tế
          widthMm: 80,                // Khổ giấy rộng (mm)
          heightMm: 150,               // Khổ giấy dài (mm)
          marginTopPx: 0               // Lề trên (px) - dùng cho PDF
        }
      };

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const result = await response.json();
        console.log("Kết quả:", result);
      } catch (error) {
        console.error("Lỗi:", error);
      }
    }

    /*async function sendToPrinter(userId, pdfBase64, printerName) {
      const apiUrl = 'https://aodaigiabao.com/print-order';

      const payload = {
        userId: userId,        // ID của chủ máy in
        pdfBase64: pdfBase64,  // Chuỗi Base64 PDF (không bao gồm tiền tố data:application/pdf;base64,)
        printerName: printerName || "Xprinter XP-420B" // Tên máy in thực tế của khách
      };

      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.success) {
          //alert("Đã gửi lệnh in xuống máy tính khách!");
        } else {
          alert("Lỗi: " + result.message);
        }
      } catch (error) {
        console.error("Lỗi kết nối API:", error);
        alert("Không thể kết nối đến máy chủ in!");
      }
    }*/




(() => {
    const root = document.querySelector('.admin-dashboard');
    if (!root) return;
    const find = selector => root.querySelector(selector);
    const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const count = value => value == null || !Number.isFinite(Number(value)) ? '—' : number.format(value);
    const money = value => value == null || !Number.isFinite(Number(value)) ? 'Chưa có dữ liệu' : count(value) + ' ₫';
    const dayText = value => String(value).split('-').reverse().join('/');
    const clock = value => String(value || '').split(' ')[1] || '';
    const titles = {
        overview: ['Tổng quan quản trị', 'Đơn hàng, tiền thu hộ và vận hành trong một màn hình.'],
        shipping: ['Vận chuyển', 'Tài khoản mặc định, thông tin người gửi và cấu hình lên đơn.'],
        zalo: ['Kết nối & chăm sóc Zalo', 'Đăng nhập, cảnh báo đơn hàng và hàng chờ kết bạn.'],
        tools: ['Công cụ quản trị', 'Những tác vụ dùng khi cần, tách riêng khỏi số liệu vận hành.'],
        users: ['Tài khoản & phân quyền', 'Quản lý người dùng và quyền truy cập ngay trong admin.'],
        weight: ['Đối chiếu cân nặng', 'So sánh số ký gửi hãng với số ký hiện tại.']
    };
    const setText = (selector, value) => { const node = find(selector); if (node) node.textContent = value; };
    function viewFromHash() {
        const hash = location.hash.slice(1);
        if (hash === 'viettelAccountPanel' || hash === 'shippingAccountsTitle') return 'shipping';
        if (hash === 'zaloConnection') return 'zalo';
        return titles[hash] ? hash : 'overview';
    }
    function showView(view, updateHash = true) {
        if (!titles[view]) view = 'overview';
        root.querySelectorAll('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== view; });
        root.querySelectorAll('.sidebar [data-view]').forEach(item => {
            const selected = item.dataset.view === view;
            item.classList.toggle('active', selected);
            if (selected) item.setAttribute('aria-current', 'page'); else item.removeAttribute('aria-current');
        });
        setText('#page-title', titles[view][0]);
        setText('#page-description', titles[view][1]);
        find('.date-actions').hidden = view !== 'overview';
        find('#dashboard-status').hidden = view !== 'overview';
        if (updateHash) history.replaceState(null, '', '#' + view);
        root.dispatchEvent(new CustomEvent('admin-view-change', { detail: { view } }));
    }
    root.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
    window.addEventListener('hashchange', () => showView(viewFromHash(), false));
    showView(viewFromHash(), false);

    function reportLinks(day) {
        root.querySelectorAll('[data-report]').forEach(control => { control.dataset.reportDay = day; });
    }
    function orderStatusBadge(order) {
        const provider = order.carrier === 'jt' ? 'J&T' : 'Viettel';
        const status = GBOrderStatus.get(provider, order.statuscode, order.statustext);
        const color = ['secondary', 'info', 'primary', 'success', 'warning', 'danger'].includes(status.color) ? status.color : 'secondary';
        return `<span class="badge gb-order-status text-bg-${color} admin-order-status" title="${esc(status.label)}">${esc(status.label)}</span>`;
    }
    function state(selector, message, error = false) {
        find(selector).innerHTML = '<p class="' + (error ? 'error-state' : 'muted') + '" style="padding:18px 0">' + esc(message) + '</p>';
    }
    function row(order, kind) {
        const carrier = order.carrier === 'jt' ? 'J&T' : 'Viettel';
        const name = order.name || 'Chưa có tên';
        const time = kind === 'return' ? order.final_time : order.picked_time;
        const code = String(order.billcode || '');
        const badge = kind === 'return'
            ? `<span class="pill ${Number(order.partial) ? 'partial' : 'returned'}">${Number(order.partial) ? 'Hoàn một phần' : 'Hoàn toàn bộ'}</span>`
            : kind === 'pickup' ? '<span>' + money(order.cod) + '</span>' : '';
        const change = kind === 'cod' ? `<div class="money-change" style="margin-top:5px"><span class="old-money">${money(order.original_cod)}</span> → ${money(order.cod)}</div>` : '';
        const icon = kind === 'return' ? 'return' : kind === 'cod' ? 'wallet' : 'check';
        return `<div class="order-row"><span class="row-icon"><svg class="icon" aria-hidden="true"><use href="#i-${icon}"/></svg></span><div class="row-body"><div class="row-line"><span class="admin-order-identity"><a href="/care/${encodeURIComponent(code)}" target="_blank" rel="noopener"><strong>${esc(code)}</strong></a>${orderStatusBadge(order)}</span><span class="muted">${esc(clock(time))}</span></div><div class="row-meta"><span class="pill ${order.carrier === 'jt' ? 'jt' : 'vt'}">${carrier}</span><span>${esc(name)}</span>${badge}</div>${change}</div></div>`;
    }
    function list(selector, orders, kind, error) {
        if (error) return state(selector, error, true);
        if (!orders.length) return state(selector, 'Không có đơn khớp trong ngày này.');
        find(selector).innerHTML = orders.map(order => row(order, kind)).join('');
    }
    function totalValue(summary, key) {
        if (!summary) return '—';
        if (summary['missing_' + key] > 0 && summary['missing_' + key] >= summary.total) return '—';
        return count(summary[key]) + (summary['missing_' + key] > 0 ? ' *' : '');
    }
    function table(data) {
        find('#daily-table').innerHTML = [...data.days].reverse().map(item => {
            const picked = item.pickup, returned = item.returned;
            const monetary = key => picked ? totalValue(picked, key) + (totalValue(picked, key) === '—' ? '' : ' ₫') : '—';
            return `<tr class="day-report-row ${item.day === data.day ? 'today' : ''}" data-report-day="${esc(item.day)}" tabindex="0" role="button" aria-label="Xem báo cáo ngày ${esc(dayText(item.day))}"><td>${esc(dayText(item.day).slice(0, 5))}</td><td class="numeric">${count(picked?.total)}</td><td class="numeric" data-report-kind="return" title="Xem đơn hoàn">${count(returned?.total)}</td><td class="numeric">${monetary('original_cod')}</td><td class="numeric">${monetary('cod')}</td><td class="numeric">${monetary('fee')}</td></tr>`;
        }).join('');
    }
    function chart(data) {
        const days = data.days;
        const max = Math.max(5, ...days.flatMap(day => [Number(day.pickup?.total || 0), Number(day.returned?.total || 0)]));
        const step = Math.max(1, Math.ceil(max / 5)), ceiling = step * 5;
        let svg = '<svg viewBox="0 0 470 253" role="img" aria-label="Số đơn nhận kiện và hoàn thành công trong 7 ngày">';
        for (let n = 0; n <= 5; n++) {
            const y = 207 - n * 35;
            svg += `<line class="grid" x1="42" y1="${y}" x2="459" y2="${y}"/><text x="34" y="${y + 3}" text-anchor="end">${esc(count(n * step))}</text>`;
        }
        days.forEach((day, index) => {
            const x = 52 + index * 58;
            for (const [offset, value, style, label] of [[0, day.pickup?.total, 'picked', 'Nhận kiện'], [20, day.returned?.total, 'returned-bar', 'Hoàn về']]) {
                if (value == null) continue;
                const height = Number(value) / ceiling * 175;
                svg += `<rect class="${style}" x="${x + offset}" y="${207 - height}" width="15" height="${height}" rx="3"><title>${esc(dayText(day.day))} · ${label}: ${esc(count(value))}</title></rect>`;
            }
            svg += `<text x="${x + 16}" y="229" text-anchor="middle">${esc(dayText(day.day).slice(0, 5))}</text>`;
        });
        find('#activity-chart').innerHTML = svg + '</svg>';
        setText('#chart-period', dayText(days[0].day).slice(0, 5) + ' – ' + dayText(data.day).slice(0, 5));
    }
    function render(data) {
        const picked = data.pickup, returned = data.returned;
        setText('#metric-orders', count(picked?.total));
        setText('#list-total', count(picked?.total));
        setText('#return-total', count(returned?.total));
        setText('#metric-original-cod', totalValue(picked, 'original_cod'));
        setText('#metric-cod', totalValue(picked, 'cod'));
        setText('#metric-fee', totalValue(picked, 'fee'));
        setText('#metric-carriers', picked ? `J&T ${count(picked.jt)} · Viettel Post ${count(picked.viettel)}` : 'Chưa tải được số liệu');
        const missing = Number(picked?.missing_original_cod || 0);
        find('#metric-original-cod').closest('.metric').querySelector('.metric-foot').textContent = missing ? `* Thiếu COD gốc của ${count(missing)} đơn` : 'COD gốc đã ghi nhận';
        setText('#metric-fee-note', picked ? `${count(picked.total - picked.missing_fee)}/${count(picked.total)} đơn có dữ liệu cước` : 'Chưa tải được số liệu');
        setText('#cod-change-note', picked ? `${count(picked.changed_cod)} đơn đã sửa COD · Theo cập nhật mới nhất` : 'Chưa tải được số liệu');
        setText('#cod-change-total', picked ? count(picked.changed_cod) + ' đơn' : '—');
        setText('#partial-total', count(returned?.partial) + ' đơn hoàn một phần');
        root.querySelectorAll('.selected-day').forEach(node => { node.textContent = dayText(data.day); });
        list('#pickup-list', data.pickupOrders, 'pickup', data.errors.pickups);
        list('#return-list', data.returnOrders, 'return', data.errors.returns);
        list('#cod-list', data.changedOrders, 'cod', data.errors.changes);
        setText('#cod-change-footer', 'Tối đa 5 đơn có COD thay đổi · Theo ngày nhận kiện');
        table(data);
        chart(data);
        reportLinks(data.day);
    }

    const dayModal = find('#adminDayModal');
    const inModal = selector => dayModal.querySelector(selector);
    const detail = { day: root.dataset.today, type: 'pickup', carrier: '', page: 1 };
    let detailRequest = 0, detailController, detailBusy = false, detailHasNext = false, detailTrigger;
    function detailButtons() {
        inModal('[data-day-prev]').disabled = detailBusy || detail.page <= 1;
        inModal('[data-day-next]').disabled = detailBusy || !detailHasNext;
        inModal('[data-day-retry]').disabled = detailBusy;
    }
    function detailSummary(data) {
        const summary = data.summary;
        const values = data.type === 'return'
            ? [['Đã hoàn', count(summary.total) + ' đơn'], ['J&T', count(summary.jt) + ' đơn'],
                ['Viettel Post', count(summary.viettel) + ' đơn'], ['Trong đó một phần', count(summary.partial) + ' đơn']]
            : [['Tổng đơn', count(summary.total) + ' đơn'], ['COD gốc', totalValue(summary, 'original_cod')],
                ['COD hiện tại', totalValue(summary, 'cod')], ['Cước gồm VAT', totalValue(summary, 'fee')]];
        inModal('[data-day-summary]').innerHTML = values.map(([label, value], index) =>
            `<div class="col-6 col-md-3"><div class="card"><span class="small text-muted">${label}</span><strong>${esc(value)}${data.type !== 'return' && index > 0 && value !== '—' ? ' ₫' : ''}</strong></div></div>`).join('');
    }
    function detailRows(data) {
        const returned = data.type === 'return';
        const table = inModal('[data-day-orders]').closest('table');
        table.classList.add('admin-day-orders-table');
        inModal('[data-day-head]').innerHTML = '<tr><th>Đơn hàng</th><th>Khách hàng</th><th>' +
            (returned ? 'Thông tin hoàn' : 'COD, cước & nhận kiện') + '</th></tr>';
        inModal('[data-day-orders]').innerHTML = data.orders.map(order => {
            const code = String(order.billcode || '');
            const codChanged = order.original_cod != null && Number(order.original_cod) !== Number(order.cod);
            const cod = `<strong${codChanged ? ' class="text-warning-emphasis"' : ''}>${money(order.cod)}</strong>`;
            const info = returned
                ? `<dt>Loại hoàn</dt><dd>${Number(order.partial) ? 'Một phần' : 'Toàn bộ'}</dd><dt>Trạng thái cuối</dt><dd>${esc(order.final_time)}</dd>`
                : `<dt>COD gốc</dt><dd>${money(order.original_cod)}</dd><dt>COD hiện tại</dt><dd>${cod}</dd><dt>Cước gồm VAT</dt><dd>${money(order.fee)}</dd><dt>Nhận kiện</dt><dd>${esc(order.picked_time)}</dd>`;
            return `<tr><th scope="row"><div class="admin-order-identity"><span class="admin-report-code">${esc(code)}</span>${orderStatusBadge(order)}</div><div class="admin-report-carrier text-muted">${order.carrier === 'jt' ? 'J&T' : 'Viettel Post'}</div><a class="btn btn-sm btn-outline-primary" href="/journey/${encodeURIComponent(code)}" target="_blank" rel="noopener">Hành trình</a></th><td class="admin-report-customer"><div class="fw-semibold">${esc(order.name || 'Chưa có tên')}</div><div class="text-muted">${esc(order.phone || '')}</div></td><td><dl class="admin-report-info">${info}</dl></td></tr>`;
        }).join('');
    }
    async function loadDetail() {
        const version = ++detailRequest;
        detailController?.abort();
        const active = new AbortController();
        detailController = active;
        detailBusy = true;
        detailHasNext = false;
        detailButtons();
        const requested = { ...detail };
        inModal('#adminDayTitle').textContent = 'Chi tiết ngày ' + dayText(requested.day);
        inModal('[data-day-date]').value = requested.day;
        inModal('[data-day-carrier]').value = requested.carrier;
        dayModal.querySelectorAll('[data-day-kind]').forEach(button => {
            const selected = button.dataset.dayKind === requested.type;
            button.classList.toggle('active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
        inModal('[data-day-summary]').innerHTML = '';
        inModal('[data-day-orders]').innerHTML = '';
        inModal('[data-day-head]').innerHTML = '';
        const status = inModal('[data-day-status]');
        status.classList.remove('text-danger');
        status.textContent = 'Đang tải danh sách đơn…';
        inModal('[data-day-page]').textContent = '';
        const timeout = setTimeout(() => active.abort(), 30000);
        try {
            const response = await fetch('/api/admin/report-day?' + new URLSearchParams(requested), {
                cache: 'no-store', credentials: 'same-origin', signal: active.signal
            });
            const data = await response.json();
            if (version !== detailRequest) return;
            if (!response.ok) throw new Error(data.message || 'Không tải được chi tiết ngày.');
            detailSummary(data);
            detailRows(data);
            detailHasNext = data.hasNext;
            const missing = data.type !== 'return' && (Number(data.summary.missing_original_cod) || Number(data.summary.missing_cod) || Number(data.summary.missing_fee));
            status.textContent = !data.orders.length ? 'Không có đơn trong trang này.' :
                (missing ? '* Tổng chỉ cộng các khoản đã có dữ liệu; một số đơn còn thiếu COD gốc hoặc cước. ' : '') +
                (data.type === 'return' ? 'Đơn hoàn một phần đã nằm trong tổng, không cộng thêm.' : 'COD và cước theo cập nhật mới nhất đã lưu.');
            const first = (data.page - 1) * 50 + 1;
            inModal('[data-day-page]').textContent = data.orders.length
                ? `${first}–${first + data.orders.length - 1} / ${count(data.summary.total)} đơn · Trang ${data.page}`
                : 'Trang ' + data.page;
            inModal('.modal-body').scrollTop = 0;
        } catch (error) {
            if (version !== detailRequest) return;
            status.classList.add('text-danger');
            status.textContent = error.name === 'AbortError' ? 'Tải quá lâu. Bấm Tải lại để thử lại.' : error.message || 'Không tải được chi tiết ngày.';
        } finally {
            clearTimeout(timeout);
            if (version === detailRequest) { detailBusy = false; detailButtons(); }
        }
    }
    function openDay(day, type, trigger) {
        detail.day = day;
        if (type) detail.type = type;
        detail.page = 1;
        detailTrigger = trigger;
        if (!dayModal.classList.contains('show')) bootstrap.Modal.getOrCreateInstance(dayModal).show();
        void loadDetail();
    }
    find('#daily-table').addEventListener('click', event => {
        const row = event.target.closest('[data-report-day]');
        if (row) openDay(row.dataset.reportDay, event.target.closest('[data-report-kind]')?.dataset.reportKind, row);
    });
    find('#daily-table').addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const row = event.target.closest('[data-report-day]');
        if (!row) return;
        event.preventDefault();
        openDay(row.dataset.reportDay, null, row);
    });
    root.addEventListener('click', event => {
        const link = event.target.closest('[data-report]');
        if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        if (link.dataset.report.includes('weight-changes')) return;
        event.preventDefault();
        openDay(link.dataset.reportDay || find('#report-date').value, link.dataset.report, link);
    });
    dayModal.querySelectorAll('[data-day-kind]').forEach(button => button.addEventListener('click', () => {
        detail.type = button.dataset.dayKind;
        detail.page = 1;
        void loadDetail();
    }));
    inModal('[data-day-carrier]').addEventListener('change', event => {
        detail.carrier = event.target.value; detail.page = 1; void loadDetail();
    });
    inModal('[data-day-date]').addEventListener('change', event => {
        if (!event.target.value) return;
        detail.day = event.target.value; detail.page = 1; void loadDetail();
    });
    inModal('[data-day-prev]').addEventListener('click', () => {
        if (detailBusy || detail.page <= 1) return;
        detail.page--; void loadDetail();
    });
    inModal('[data-day-next]').addEventListener('click', () => {
        if (detailBusy || !detailHasNext) return;
        detail.page++; void loadDetail();
    });
    inModal('[data-day-retry]').addEventListener('click', () => void loadDetail());
    dayModal.addEventListener('hidden.bs.modal', () => {
        detailRequest++;
        detailController?.abort();
        detailBusy = false;
        if (detailTrigger?.isConnected) detailTrigger.focus({ preventScroll: true });
    });

    let request = 0, controller;
    async function load() {
        const version = ++request;
        controller?.abort();
        const activeController = new AbortController();
        controller = activeController;
        const day = find('#report-date').value;
        reportLinks(day);
        find('#refresh').disabled = true;
        find('#dashboard-status').classList.remove('error');
        setText('#dashboard-status', 'Đang tải số liệu ngày ' + dayText(day) + '…');
        // Never leave another day's figures visible while a new date is loading.
        for (const id of ['metric-orders', 'metric-original-cod', 'metric-cod', 'metric-fee', 'list-total', 'return-total', 'cod-change-total']) setText('#' + id, '—');
        for (const id of ['pickup-list', 'return-list', 'cod-list']) state('#' + id, 'Đang tải…');
        for (const id of ['metric-carriers', 'metric-fee-note', 'cod-change-note', 'partial-total', 'cod-change-footer']) setText('#' + id, 'Đang tải…');
        root.querySelectorAll('.selected-day').forEach(node => { node.textContent = dayText(day); });
        find('#daily-table').innerHTML = '';
        find('#activity-chart').innerHTML = '';
        const timeout = setTimeout(() => activeController.abort(), 30000);
        try {
            const response = await fetch('/api/admin/overview?' + new URLSearchParams({ day }), {
                cache: 'no-store', credentials: 'same-origin', signal: activeController.signal
            });
            const data = await response.json();
            if (version !== request) return;
            if (!response.ok) throw new Error(data.message || 'Không tải được số liệu.');
            render(data);
            const partial = Object.keys(data.errors || {}).length > 0;
            find('#dashboard-status').classList.toggle('error', partial);
            setText('#dashboard-status', partial ? 'Một phần số liệu chưa tải được. Bấm làm mới để thử lại.' :
                `Ngày ${dayText(data.day)} · GMT+7 · Cập nhật ${new Date().toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
        } catch (error) {
            if (version !== request) return;
            const message = error.name === 'AbortError' ? 'Tải số liệu quá lâu. Bấm làm mới để thử lại.' : error.message || 'Không tải được số liệu.';
            find('#dashboard-status').classList.add('error');
            setText('#dashboard-status', message);
            for (const id of ['pickup-list', 'return-list', 'cod-list']) state('#' + id, message, true);
        } finally {
            clearTimeout(timeout);
            if (version === request) find('#refresh').disabled = false;
        }
    }
    const vnToday = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    find('#today').addEventListener('click', () => { find('#report-date').value = vnToday(); void load(); });
    find('#yesterday').addEventListener('click', () => {
        find('#report-date').value = new Date(Date.parse(vnToday() + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
        void load();
    });
    find('#report-date').addEventListener('change', () => { if (find('#report-date').value) void load(); });
    find('#refresh').addEventListener('click', () => void load());
    void load();
})();
