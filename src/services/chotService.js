'use strict';
const DBConnection = require('../configs/DBConnection');

const RETRY_MS = 60000;
const state = { has: false, pending: null, failedAt: 0 };

async function detect() {
    const [cols] = await DBConnection.query("SHOW COLUMNS FROM livecomment WHERE Field IN ('gia2','slchot2')");
    return cols.length === 2;
}

function ensureChot2() {
    if (state.has) return Promise.resolve(true);
    if (state.pending) return state.pending;
    if (state.failedAt && Date.now() - state.failedAt < RETRY_MS) return Promise.resolve(false);

    state.pending = (async () => {
        try {
            if (await detect()) { state.has = true; return true; }
            await DBConnection.query(
                'ALTER TABLE livecomment ADD COLUMN gia2 VARCHAR(20) NULL, ADD COLUMN slchot2 INT NULL, ALGORITHM=INSTANT'
            );
            state.has = true;
            console.log('[chốt 2 giá] Đã thêm cột gia2, slchot2 vào bảng livecomment');
            return true;
        } catch (err) {
            try { if (await detect()) { state.has = true; return true; } } catch (_) { /* bỏ qua */ }
            state.failedAt = Date.now();
            console.error('[chốt 2 giá] Không thêm được cột gia2/slchot2:', err.message,
                '— hãy chạy tay file sql/livecomment_gia2.sql');
            return false;
        }
    })().finally(() => { state.pending = null; });
    return state.pending;
}

function hasChot2() { return state.has; }

function selectCols(prefix = '') {
    return state.has ? ` ${prefix}gia2, ${prefix}slchot2,` : '';
}

function parseSecondPrice(body) {
    const gia2 = String((body && body.gia2) ?? '').replace(/[^0-9]/g, '').replace(/^0+/, '').slice(0, 10);
    if (!gia2) return { gia2: null, slchot2: null };
    let sl = parseInt(body.slchot2, 10);
    if (!Number.isFinite(sl) || sl < 1) sl = 1;
    return { gia2, slchot2: Math.min(sl, 50) };
}

module.exports = { ensureChot2, hasChot2, selectCols, parseSecondPrice };
