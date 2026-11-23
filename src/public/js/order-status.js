'use strict';

const GBOrderStatus = (() => {
    const jt = {
        100: { label: 'Mới tạo', color: 'secondary', group: 'receiving' },
        103: { label: 'Đã tạo đơn', color: 'secondary', group: 'receiving' },
        104: { label: 'Lấy hàng thất bại', color: 'warning', group: 'issue' },
        105: { label: 'Hủy đơn', color: 'danger', group: 'cancelled' },
        106: { label: 'Đã lấy hàng', color: 'info', group: 'shipping' },
        109: { label: 'Đang vận chuyển', color: 'info', group: 'shipping' },
        110: { label: 'Hàng đến', color: 'info', group: 'shipping' },
        112: { label: 'Đang giao hàng', color: 'primary', group: 'delivering' },
        113: { label: 'Giao thành công', color: 'success', group: 'success' },
        116: { label: 'Đang chuyển hoàn', color: 'warning', group: 'issue2' },
        117: { label: 'Hoàn thành công', color: 'danger', group: 'returned' },
        118: { label: 'Kiện vấn đề phát hàng', color: 'warning', group: 'issue' },
        120: { label: 'Kiện vấn đề chuyển hoàn', color: 'danger', group: 'issue' },
        121: { label: 'Kết thúc', color: 'secondary', group: 'finished' },
    };
    const jtCancelled = 105;
    const viettelCancelled = [101, 107, 201, 503, 510];
    const viettelColors = {
        102: 'warning', 200: 'info', 202: 'info', 300: 'info', 400: 'info',
        401: 'info', 402: 'info', 403: 'info', 509: 'info',
        500: 'primary', 508: 'primary', 550: 'primary', 501: 'success',
        505: 'warning', 506: 'warning', 507: 'warning', 515: 'warning',
        551: 'warning', 504: 'danger',
    };

    function get(provider, code, text) {
        const statusCode = Number(code);
        if (provider === 'J&T' && jt[statusCode]) return jt[statusCode];
        const viettel = !provider || provider === 'Viettel';
        if (viettel && statusCode === 504) return { label: 'Hoàn thành công', color: 'danger', group: 'returned' };
        if (viettel && statusCode === 501) return { label: 'Giao thành công', color: 'success', group: 'success' };
        const label = String(text || '').replace(/\s+/g, ' ').trim();
        if (/^Thành công\s*[-–—]\s*Chuyển trả người gửi$/i.test(label)) {
            return { label: 'Hoàn thành công', color: 'danger', group: 'returned' };
        }
        if (/^Thành công\s*[-–—]\s*Giao thành công$/i.test(label)) {
            return { label: 'Giao thành công', color: 'success', group: 'success' };
        }

        const displayLabel = /^Nhận từ bưu tá\s*[-–—]\s*Bưu cục gốc$/i.test(label) ? 'Đã quét nhận' : text;
        return {
            label: displayLabel || 'Đang xử lý',
            color: viettel && viettelCancelled.includes(statusCode) ? 'danger'
                : (viettel && viettelColors[statusCode]) || 'secondary',
        };
    }

    return { jt, jtCancelled, viettelCancelled, get };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = GBOrderStatus;
