'use strict';

function submitShippingOrder(carrier, { button, payload, onCreated, successMessage }) {
    const jt = carrier === 'jt';
    const name = jt ? 'J&T' : 'Viettel';
    if (button) button.disabled = true;

    return $.ajax({
        url: jt ? '/pushorderjtex' : '/createorderviettel',
        method: 'POST',
        dataType: 'json',
        ...(jt ? { contentType: 'application/json', data: JSON.stringify(payload) } : { data: payload })
    }).always(() => {
        if (button) button.disabled = false;
    }).done(data => {
        const created = jt ? data.success : Boolean(data.realorderid);
        if (!created) {
            const reason = jt ? data.message || 'Không tạo được đơn J&T.' : data.error || 'GB chưa xác nhận được đơn Viettel.';
            ShowCenterToast(data.order_created ? 'warning' : 'danger', gbEscapeText(reason), 5000);
            return;
        }

        onCreated();
        const code = jt ? data.order_code : data.realorderid;
        const printFailed = jt ? data.printDispatched === false : !data.printed;
        if (printFailed) {
            const reason = data.printMessage || 'Chưa gửi được lệnh in.';
            ShowCenterToast('warning', gbEscapeText(`Đã lên đơn ${name} ${code}. ${reason} Bạn có thể in lại từ danh sách đơn.`), 5000);
            return;
        }

        const message = successMessage ? successMessage(code) : `Đã lên đơn ${name} ${code}`;
        ShowCenterToast('success', gbEscapeText(message), successMessage ? 4000 : 5000);
    }).fail(xhr => {
        const error = jt ? xhr.responseJSON?.message : xhr.responseJSON?.error;
        ShowCenterToast('danger', gbEscapeText(error || `Không nhận được phản hồi. Kiểm tra đơn ${name} trước khi gửi lại.`), 5000);
    });
}
