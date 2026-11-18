'use strict';

(function (root) {
    function createConfirmation() {
        let candidate = '';
        let count = 0;
        let lastReadAt = 0;
        let delivered = false;

        function reset() {
            candidate = '';
            count = 0;
            lastReadAt = 0;
            delivered = false;
        }

        function read(value, now = Date.now()) {
            if (typeof value !== 'string' || value.length < 5 || value.length > 500) {
                reset();
                return null;
            }
            if (candidate !== value || now - lastReadAt > 3000) {
                candidate = value;
                count = 0;
                delivered = false;
            }
            lastReadAt = now;
            count++;
            if (count < 3 || delivered) return null;
            delivered = true;
            return candidate;
        }

        return { read, reset };
    }

    const api = { createConfirmation };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.GBCustomerScanCode = api;
})(typeof window !== 'undefined' ? window : globalThis);
