'use strict';

(() => {
    const panel = document.getElementById('zaloConnection');
    if (!panel) return;

    const el = name => panel.querySelector('[data-zalo-' + name + ']');
    const start = el('start');
    const cancel = el('cancel');
    const verify = el('verify');
    const disconnect = el('disconnect');
    const qr = el('qr');
    const form = el('send-form');
    const phone = el('phone');
    const checkPhone = el('check-phone');
    const message = el('text');
    const send = el('send');
    const sendStatus = el('send-status');
    const messages = {
        starting: 'Đang tạo mã QR…',
        waiting: 'Mở Zalo và quét mã QR.',
        scanned: 'Đã quét mã. Hãy xác nhận đăng nhập trên điện thoại.',
        connected: 'Đã lưu kết nối Zalo vào GB.',
        expired: 'Mã QR đã hết hạn. Bạn có thể tạo mã mới.',
        declined: 'Yêu cầu đăng nhập đã bị từ chối trên điện thoại.',
        cancelled: 'Đã hủy mã QR.',
        failed: 'Không hoàn tất được đăng nhập. Bạn có thể thử tạo mã mới.'
    };
    let state;
    let recipient;
    let working = false;
    let timer;
    const active = () => ['starting', 'waiting', 'scanned'].includes(state?.attempt?.status);

    async function request(path = '', method = 'GET', body) {
        const headers = { 'X-GB-Zalo-Action': '1' };
        if (body) headers['Content-Type'] = 'application/json';
        const response = await fetch('/api/admin/zalo' + path, {
            method, cache: 'no-store', headers, body: body ? JSON.stringify(body) : undefined
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Không tải được kết nối Zalo.');
        return data;
    }

    function render() {
        start.disabled = working || !state || active() || state.busy;
        cancel.hidden = !active();
        verify.hidden = disconnect.hidden = !state?.account;
        cancel.disabled = verify.disabled = disconnect.disabled = working || (state?.busy ?? false);
        verify.disabled ||= active();
        disconnect.disabled ||= active();
        if (recipient && recipient.accountId !== state?.account?.id) recipient = null;
        form.hidden = !state?.account;
        phone.disabled = message.disabled = checkPhone.disabled = working || form.hidden || active() || state?.busy;
        send.disabled = checkPhone.disabled || !recipient || !message.value.trim();
        el('recipient').textContent = recipient ? 'Tìm thấy ' + (recipient.name || 'UID ' + recipient.uid) : '';
        if (!state) return;
        const { account, attempt, busy } = state;
        el('account').textContent = account
            ? 'Đã lưu tài khoản ' + (account.name ? account.name + ' · ' : '') + 'UID ' + account.id
            : 'Chưa lưu tài khoản Zalo.';
        const image = attempt?.qrImage;
        if (image) qr.src = 'data:image/png;base64,' + image;
        else qr.removeAttribute('src');
        qr.hidden = !image;
        el('status').textContent = busy ? 'Admin khác đang kết nối Zalo.' : (messages[attempt?.status] || '');
    }

    async function run(action, { feedback = el('message'), refresh = true } = {}) {
        if (working) return;
        clearTimeout(timer);
        working = true;
        render();
        try {
            if (action) {
                feedback.textContent = '';
                await action();
            }
            if (refresh) state = await request();
        } catch (error) {
            feedback.textContent = error.message;
        } finally {
            working = false;
            render();
            if (active() || state?.busy) timer = setTimeout(() => run(), 1500);
        }
    }

    start.addEventListener('click', () => run(() => request('/qr', 'POST')));
    cancel.addEventListener('click', () => run(() => request('/qr/' + encodeURIComponent(state.attempt.id), 'DELETE')));
    verify.addEventListener('click', () => run(async () => {
        await request('/verify', 'POST');
        el('message').textContent = 'Phiên Zalo đã lưu vẫn đăng nhập được.';
    }));
    disconnect.addEventListener('click', () => {
        if (!window.confirm('Gỡ kết nối Zalo đã lưu khỏi GB?')) return;
        run(() => request('/' + encodeURIComponent(state.account.id), 'DELETE'));
    });
    form.addEventListener('submit', event => event.preventDefault());
    phone.addEventListener('input', () => {
        recipient = null;
        sendStatus.textContent = '';
        render();
    });
    message.addEventListener('input', render);
    const messageAction = { feedback: sendStatus, refresh: false };
    checkPhone.addEventListener('click', () => {
        if (!phone.reportValidity()) return;
        recipient = null;
        run(async () => {
            sendStatus.textContent = 'Đang kiểm tra số…';
            const result = await request('/check-phone', 'POST', { phone: phone.value });
            recipient = result.recipient;
            sendStatus.textContent = '';
        }, messageAction);
    });
    send.addEventListener('click', () => {
        if (!recipient || !message.reportValidity()) return;
        run(async () => {
            sendStatus.textContent = 'Đang gửi…';
            await request('/send-test', 'POST', {
                phone: phone.value, message: message.value,
                uid: recipient.uid, accountId: recipient.accountId
            });
            message.value = '';
            sendStatus.textContent = 'Đã gửi tin nhắn Zalo.';
        }, messageAction);
    });
    run();
})();
