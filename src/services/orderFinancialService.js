'use strict';
const db = require('../configs/DBConnection');

const FEE_FIELDS = ['MONEY_TOTAL', 'MONEY_TOTAL_FEE', 'MONEY_FEE', 'MONEY_COLLECTION_FEE',
    'MONEY_OTHER_FEE', 'MONEY_VAS', 'MONEY_VAT', 'EXCHANGE_WEIGHT', 'PRODUCT_PRICE', 'KPI_HT', 'ORDER_PAYMENT'];
const SNAPSHOT_FIELDS = ['cod', 'original_cod', 'carrier_cod_origin', 'goods_value_original',
    'shipping_fee', 'shipping_fee_original', 'shipping_fee_details', 'kg', 'original_kg'];

function amount(value) {
    if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 1e12 ? number : null;
}

function localNow() {
    return new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
}

function eventTime(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{2})\/(\d{2})\/(\d{4}) ((?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d)$/.exec(value);
    if (!match) return null;
    const date = `${match[3]}-${match[2]}-${match[1]}T${match[4]}`;
    const epoch = Date.parse(date + 'Z');
    return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 19) === date ? date.replace('T', ' ') : null;
}

function json(value) {
    if (value && typeof value === 'object') return value;
    try { return JSON.parse(value || '{}') || {}; } catch (_) { return {}; }
}

function snapshot(order) {
    return Object.fromEntries(SNAPSHOT_FIELDS.map(key => [key,
        key === 'shipping_fee_details' ? json(order[key]) : amount(order[key])]));
}

function changes(order, data, source, at, initialCod) {
    const update = {};
    const isInitial = source === 'create';
    const origin = amount(data.MONEY_COLLECTION_ORIGIN);
    const fresh = !!at && (!order.financial_status_at || at >= String(order.financial_status_at));
    if (isInitial && amount(initialCod) !== null) {
        if (order.original_cod == null) update.original_cod = amount(initialCod);
        if (order.goods_value_original == null) update.goods_value_original = amount(initialCod);
    }
    // An explicit carrier origin is also useful when an old order predates this feature.
    if (origin !== null && (order.carrier_cod_origin == null || fresh)) {
        update.carrier_cod_origin = origin;
        if (order.original_cod == null && update.original_cod == null) update.original_cod = origin;
        if (order.goods_value_original == null && update.goods_value_original == null) update.goods_value_original = origin;
    }
    if (fresh) {
        const cod = amount(data.MONEY_COLLECTION);
        if (cod !== null) update.cod = cod;
        const details = { ...json(order.shipping_fee_details) };
        for (const key of FEE_FIELDS) {
            const value = amount(data[key]);
            if (value !== null) details[key] = value;
        }
        if (Object.keys(details).length) update.shipping_fee_details = JSON.stringify(details);
        const fee = amount(data.MONEY_TOTAL);
        if (fee !== null) {
            update.shipping_fee = fee;
            if (order.shipping_fee_original == null) update.shipping_fee_original = fee;
        }
        // Invalid/missing fields never turn a previously known value into zero.
        if (cod !== null || FEE_FIELDS.some(key => amount(data[key]) !== null)) update.financial_status_at = at;
    }
    const carrierWeight = source === 'webhook' && at &&
        (!order.viettel_weight_status_at || at >= String(order.viettel_weight_status_at));
    if (carrierWeight || (source === 'edit' && Number(order.can_edit_weight) === 1)) {
        const grams = amount(data.PRODUCT_WEIGHT);
        if (Number.isSafeInteger(grams) && grams > 0) {
            update.kg = grams / 1000;
            update.viettel_weight_status_at = at;
            if (carrierWeight) {
                update.viettel_input_kg = order.viettel_input_kg ?? order.kg;
            }
        }
    }
    return update;
}

async function syncViettel(orderNumber, data, options = {}) {
    const source = options.source || 'webhook';
    const at = options.at || (source === 'webhook' ? eventTime(data.ORDER_STATUSDATE) : localNow());
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [[order]] = await conn.query(`SELECT l.*,
            CAST(financial_status_at AS CHAR) AS financial_status_at,
            CAST(viettel_weight_status_at AS CHAR) AS viettel_weight_status_at,
            (viettel_weight_status_at <=> ?) AS can_edit_weight
            FROM lendon l WHERE realorderid = ? AND (provider = 'Viettel' OR provider IS NULL OR provider = '')
            ORDER BY id LIMIT 1 FOR UPDATE`, [options.expectedWeightAt ?? null, orderNumber]);
        if (!order) { await conn.commit(); return false; }
        const update = changes(order, data, source, at, options.initialCod);
        const before = snapshot(order), after = snapshot({ ...order, ...update });
        const changed = SNAPSHOT_FIELDS.filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
        const clocksChanged = ['financial_status_at', 'viettel_weight_status_at'].some(key =>
            update[key] !== undefined && String(update[key]) !== String(order[key] ?? ''));
        const inputChanged = update.viettel_input_kg !== undefined && amount(update.viettel_input_kg) !== amount(order.viettel_input_kg);
        if (changed.length || clocksChanged || inputChanged) {
            if (changed.length) {
                await conn.query(`INSERT INTO order_financial_history
                    (order_id, realorderid, source, event_at, recorded_at, changed_fields, before_json, after_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [order.id, orderNumber, source, at, localNow(), JSON.stringify(changed), JSON.stringify(before), JSON.stringify(after)]);
            }
            await conn.query('UPDATE lendon SET ?, financial_updated_at = ? WHERE id = ?', [update, localNow(), order.id]);
        }
        await conn.commit();
        return true;
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally { conn.release(); }
}

async function history(orderId) {
    const [rows] = await db.query(`SELECT source, DATE_FORMAT(event_at, '%d/%m/%Y %H:%i:%s') AS event_time,
        DATE_FORMAT(recorded_at, '%d/%m/%Y %H:%i:%s') AS recorded_time, changed_fields, before_json, after_json
        FROM order_financial_history WHERE order_id = ? ORDER BY id DESC LIMIT 50`, [orderId]);
    return rows.map(row => ({ ...row, changed: json(row.changed_fields), before: json(row.before_json), after: json(row.after_json) }));
}

module.exports = { syncViettel, history, amount, eventTime, changes, snapshot, localNow };
