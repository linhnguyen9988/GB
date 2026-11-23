'use strict';

function zaloErrorDetails(error) {
    const code = error?.code || error?.name || 'Error';
    if (code === 'ER_NO_SUCH_TABLE') {
        const match = /Table ['`]([^'`]+)['`]/i.exec(error.sqlMessage || error.message || '');
        const table = match?.[1].split('.').pop();
        if (/^gb_zalo_[a-z0-9_]+$/i.test(table || '')) {
            return code + ': thiếu bảng ' + table + '. Chạy migrations/20261121_zalo_tables_repair.sql trong đúng DB của GB.';
        }
        if (/^[a-z0-9_$]+$/i.test(table || '')) return code + ': thiếu bảng ' + table + ' trong database đang cấu hình cho GB.';
        return code + ': thiếu bảng trong database đang cấu hình cho GB.';
    }
    return String(code);
}

module.exports = { zaloErrorDetails };
