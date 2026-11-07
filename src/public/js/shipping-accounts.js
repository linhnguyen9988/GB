'use strict';

(() => {
    const defaultForm = document.getElementById('shippingDefaultForm');
    const jtForm = document.getElementById('shippingJTForm');
    const select = document.getElementById('shippingAccount');
    const current = document.getElementById('shippingCurrent');
    const status = document.getElementById('shippingAccountsStatus');
    const forms = [defaultForm, jtForm];
    const defaultButton = defaultForm.querySelector('button');
    let accounts = [];

    async function request(path, method = 'GET', body) {
        const options = { method, cache: 'no-store' };
        if (body) {
            options.headers = { 'Content-Type': 'application/json' };
            options.body = JSON.stringify(body);
        }
        const response = await fetch('/api/shipping' + path, options);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || 'Không xử lý được cấu hình vận chuyển.');
        return result;
    }

    function label(account) {
        return (account.carrier === 'jt' ? 'J&T Express' : 'Viettel Post') + ' · ' + account.label;
    }

    async function refresh() {
        const data = await request('/accounts');
        accounts = data.accounts;
        select.replaceChildren(new Option('Chọn tài khoản', ''));
        let selected = null;
        accounts.forEach((account, index) => {
            select.add(new Option(label(account), String(index)));
            if (data.selected?.carrier === account.carrier && data.selected.accountId === account.accountId) {
                select.value = String(index);
                selected = account;
            }
        });
        current.textContent = selected ? 'Đang dùng ' + label(selected) : 'Chưa có tài khoản mặc định sẵn sàng để lên đơn.';
        select.disabled = accounts.length === 0;
    }

    function show(message, error = false) {
        status.textContent = message;
        status.classList.toggle('text-danger', error);
        status.classList.toggle('text-success', !error);
    }

    function bind(form, save) {
        form.addEventListener('submit', async event => {
            event.preventDefault();
            forms.forEach(item => { item.querySelector('button').disabled = true; });
            show('Đang lưu…');
            try {
                const result = await save();
                await refresh();
                show(result.message);
            } catch (error) {
                show(error.message, true);
            } finally {
                jtForm.querySelector('button').disabled = false;
                defaultButton.disabled = select.disabled;
            }
        });
    }

    bind(jtForm, async () => {
        const input = document.getElementById('shippingCustomerCode');
        const result = await request('/accounts/jt', 'POST', { customerCode: input.value });
        jtForm.reset();
        return result;
    });
    bind(defaultForm, () => {
        const account = select.value === '' ? null : accounts[Number(select.value)];
        if (!account) throw new Error('Chọn tài khoản lên đơn mặc định.');
        return request('/default', 'PUT', { carrier: account.carrier, accountId: account.accountId });
    });
    refresh().then(() => { defaultButton.disabled = select.disabled; }).catch(error => {
        current.textContent = 'Không tải được tài khoản vận chuyển.';
        show(error.message, true);
    });
})();
