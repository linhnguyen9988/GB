'use strict';

const axios = require('axios');
const db = require('../configs/DBConnection');
const { getPageToken } = require('./pageTokenService');

const labels = new Map([['bom hàng', 'Bom hàng'], ['xả hàng', 'Xả hàng']]);
const isId = value => typeof value === 'string' && /^\d{1,32}$/.test(value);

function managedLabel(value) {
    return labels.get(String(value ?? '').normalize('NFC').trim().toLowerCase()) || null;
}

async function updateCustomers(where, keys, label, sql, values) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [customers] = await conn.query(
            `SELECT CAST(pageid AS CHAR) AS page_id, CAST(userid AS CHAR) AS psid, label
               FROM khachhang WHERE ${where} FOR UPDATE`,
            keys
        );
        await conn.query(sql, values);
        const desired = managedLabel(label);
        const jobs = customers
            .filter(customer => isId(customer.page_id) && isId(customer.psid) && managedLabel(customer.label) !== desired)
            .map(customer => [customer.page_id, customer.psid, desired]);
        if (jobs.length) {
            await conn.query(
                `INSERT INTO gb_facebook_customer_label_sync (page_id, psid, desired_label, next_attempt_at)
                 VALUES ${jobs.map(() => '(?, ?, ?, UTC_TIMESTAMP())').join(', ')}
                 ON DUPLICATE KEY UPDATE desired_label = ?, revision = revision + 1,
                     attempts = 0, next_attempt_at = UTC_TIMESTAMP(), last_error = NULL`,
                [...jobs.flat(), desired]
            );
        }
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

async function graph(token, method, node, edge, params) {
    const response = await axios.request({
        method, url: `https://graph.facebook.com/v25.0/${node}/${edge}`,
        ...(method === 'POST' ? { data: new URLSearchParams(params) } : { params }),
        headers: { Authorization: `Bearer ${token}` }, timeout: 8000
    });
    return response.data;
}

async function readLabels(token, node) {
    const result = [];
    const cursors = new Set();
    let after;
    do {
        const page = await graph(token, 'GET', node, 'custom_labels', { fields: 'id,page_label_name', limit: 100, after });
        if (!Array.isArray(page?.data)) throw new Error('INVALID_LABEL_RESPONSE');
        result.push(...page.data.filter(label => isId(label?.id)));
        if (!page.paging?.next) break;
        const cursor = page.paging.cursors?.after;
        if (!cursor || cursors.has(cursor)) throw new Error('INVALID_LABEL_CURSOR');
        cursors.add(cursor);
        after = cursor;
    } while (after);
    return result;
}

async function changeAssignment(token, method, id, psid) {
    const result = await graph(token, method, id, 'label', { user: psid });
    if (result?.success !== true) throw new Error('LABEL_CHANGE_UNCONFIRMED');
}

async function syncCustomer(job) {
    const token = await getPageToken(job.page_id);
    if (!token) throw new Error('PAGE_TOKEN_MISSING');
    const current = await readLabels(token, job.psid);
    let keepId;
    if (job.desired_label) {
        let label = current.find(item => managedLabel(item.page_label_name) === job.desired_label);
        if (!label) {
            const pageLabels = await readLabels(token, job.page_id);
            label = pageLabels.find(item => managedLabel(item.page_label_name) === job.desired_label)
                || await graph(token, 'POST', job.page_id, 'custom_labels', { page_label_name: job.desired_label });
            if (!isId(label?.id)) throw new Error('LABEL_CREATION_UNCONFIRMED');
            await changeAssignment(token, 'POST', label.id, job.psid);
        }
        keepId = label.id;
    }
    for (const label of current) {
        const shouldRemove = keepId ? label.id !== keepId : managedLabel(label.page_label_name) !== null;
        if (shouldRemove) {
            await changeAssignment(token, 'DELETE', label.id, job.psid);
        }
    }
}

function errorCode(error) {
    const meta = error.response?.data?.error;
    if (Number.isInteger(meta?.code)) return 'META_' + meta.code + (Number.isInteger(meta.error_subcode) ? '_' + meta.error_subcode : '');
    const code = error.code || error.message;
    return typeof code === 'string' && /^[A-Z0-9_]{1,80}$/.test(code) ? code : 'SYNC_ERROR';
}

async function runJob(pageId, psid) {
    const conn = await db.getConnection();
    const lock = 'gb:fb:labels:' + pageId;
    let acquired = false;
    try {
        const [[result]] = await conn.query('SELECT GET_LOCK(?, 0) AS acquired', [lock]);
        acquired = Number(result.acquired) === 1;
        if (!acquired) return;
        const [[job]] = await conn.query(
            `SELECT page_id, psid, desired_label, revision, attempts FROM gb_facebook_customer_label_sync
              WHERE page_id = ? AND psid = ? AND next_attempt_at <= UTC_TIMESTAMP()`,
            [pageId, psid]
        );
        if (!job) return;
        const key = [pageId, psid, job.revision];
        try {
            await syncCustomer(job);
        } catch (error) {
            const code = errorCode(error);
            const delay = 60 * 2 ** Math.min(Number(job.attempts), 6);
            await conn.query(
                `UPDATE gb_facebook_customer_label_sync
                    SET attempts = LEAST(attempts + 1, 65535), last_error = ?,
                        next_attempt_at = TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP())
                  WHERE page_id = ? AND psid = ? AND revision = ?`,
                [code, delay, ...key]
            );
            console.warn('[Nhãn Facebook]', 'Page', pageId, code);
            return;
        }
        await conn.query('DELETE FROM gb_facebook_customer_label_sync WHERE page_id = ? AND psid = ? AND revision = ?', key);
    } finally {
        try {
            if (acquired) await conn.query('SELECT RELEASE_LOCK(?)', [lock]);
            conn.release();
        } catch (_) {
            conn.destroy();
        }
    }
}

function start() {
    let busy = false;
    let lastError;
    setInterval(async () => {
        if (busy) return;
        busy = true;
        try {
            const [jobs] = await db.query(
                `SELECT page_id, psid FROM gb_facebook_customer_label_sync
                  WHERE next_attempt_at <= UTC_TIMESTAMP() ORDER BY next_attempt_at LIMIT 10`
            );
            for (const job of jobs) await runJob(job.page_id, job.psid);
            lastError = undefined;
        } catch (error) {
            const code = errorCode(error);
            if (code !== lastError) console.warn('[Nhãn Facebook] Hàng đợi:', code);
            lastError = code;
        } finally {
            busy = false;
        }
    }, 15000).unref();
}

module.exports = { updateCustomers, start };
