'use strict';
const GBOrderFinancialView = (() => {
    const number = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
    const feeLabels = { MONEY_TOTAL_FEE: 'Cước dịch vụ chính', MONEY_FEE: 'Phụ phí xăng dầu',
        MONEY_COLLECTION_FEE: 'Phí thu hộ', MONEY_OTHER_FEE: 'Phí khác', MONEY_VAS: 'Dịch vụ gia tăng', MONEY_VAT: 'VAT' };
    const money = value => value == null || value === '' || !Number.isFinite(Number(value)) ? 'Chưa có dữ liệu' : number.format(value) + ' ₫';
    const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    function parse(value) { try { return typeof value === 'object' && value ? value : JSON.parse(value || '{}'); } catch (_) { return {}; } }
    function hasValue(value) {
        return value != null && value !== '' && Number.isFinite(Number(value));
    }
    function changeLine(label, before, after, format = money) {
        if (!hasValue(after) || (hasValue(before) && Number(before) === Number(after))) return '';
        if (!hasValue(before)) return `<div>Đã ghi nhận ${label}: ${format(after)}</div>`;
        return `<div>${label}: ${format(before)} → ${format(after)}</div>`;
    }
    function render(order, history = []) {
        const original = order.carrier_cod_origin ?? order.original_cod;
        const details = parse(order.shipping_fee_details);
        let html = '<div class="small"><div class="row g-2">';
        const items = [ ['COD gốc', original],
            ['COD hiện tại', order.cod], ['Tổng cước (gồm VAT)', order.shipping_fee] ];
        for (const [label, value] of items) html += `<div class="col-6 col-md-4"><span class="text-muted">${label}</span><div class="fw-semibold">${money(value)}</div></div>`;
        html += '</div>';
        if (hasValue(original) && hasValue(order.cod) && Number(original) !== Number(order.cod)) {
            html += `<p class="text-warning-emphasis mt-2 mb-0">COD đã sửa: ${money(original)} → ${money(order.cod)}</p>`;
        }
        html += '<details class="mt-2"><summary>Chi tiết cước và lịch sử thay đổi</summary><dl class="row mt-2 mb-0">';
        for (const [key, label] of Object.entries(feeLabels)) if (details[key] != null) {
            html += `<dt class="col-7 fw-normal">${label}</dt><dd class="col-5 text-end">${money(details[key])}</dd>`;
        }
        html += '</dl>';
        let visibleHistory = 0;
        for (const row of history) {
            const before = parse(row.before || row.before_json), after = parse(row.after || row.after_json);
            const changed = Array.isArray(row.changed) ? row.changed : parse(row.changed_fields);
            const keys = Array.isArray(changed) ? changed : [];
            const lines = [];
            if (keys.includes('original_cod') || keys.includes('carrier_cod_origin')) {
                lines.push(changeLine('COD gốc', before.carrier_cod_origin ?? before.original_cod, after.carrier_cod_origin ?? after.original_cod));
            }
            if (keys.includes('cod')) lines.push(changeLine('COD hiện tại', before.cod, after.cod));
            if (keys.includes('shipping_fee')) lines.push(changeLine('Tổng cước', before.shipping_fee, after.shipping_fee));
            for (const [key, label] of [['kg', 'Cân nặng'], ['original_kg', 'Ký gốc']]) {
                if (keys.includes(key)) lines.push(changeLine(label, before[key], after[key], value => number.format(value) + ' kg'));
            }
            const feeChanges = [];
            if (keys.includes('shipping_fee_details')) {
                const oldFees = parse(before.shipping_fee_details), newFees = parse(after.shipping_fee_details);
                for (const [key, label] of Object.entries(feeLabels)) feeChanges.push(changeLine(label, oldFees[key], newFees[key]));
            }
            const body = lines.filter(Boolean).join('');
            const fees = feeChanges.filter(Boolean).join('');
            if (!body && !fees) continue;
            visibleHistory++;
            const source = ({ webhook: 'Hãng cập nhật', edit: 'Sửa trên GB', refresh: 'Tra cứu hãng' })[row.source] || 'Ghi nhận';
            html += `<div class="border-top pt-2 mt-2"><div class="text-muted">${esc(row.event_time || row.recorded_time || '')} · ${source}</div>${body}`;
            if (fees) html += `<details class="mt-1"><summary>Chi tiết cước</summary>${fees}</details>`;
            html += '</div>';
        }
        if (!visibleHistory) html += '<p class="text-muted mb-0">Chưa có lịch sử thay đổi.</p>';
        return html + '</details></div>';
    }
    return { render, money };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = GBOrderFinancialView;
