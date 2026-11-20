'use strict';

const axios = require('axios');
const db = require('../configs/DBConnection');
const { getPageToken } = require('./pageTokenService');

const labels = new Map([['bom hàng', 'Bom hàng'], ['xả hàng', 'Xả hàng']]);
const isId = value => typeof value === 'string' && /^\d{1,32}$/.test(value);
const invalidPsid = 'INVALID_PSID';
const missingLegacyPsid = 'MISSING_LEGACY_PSID';
const unavailablePsid = 'UNAVAILABLE_PSID';
const blockedErrors = `'${invalidPsid}', '${missingLegacyPsid}', '${unavailablePsid}'`;
const legacyUser = 'CAST(k.userid AS CHAR) = CAST(k.realfbid AS CHAR)';
const labelPsid = `CASE WHEN ${legacyUser}
    THEN CASE WHEN CAST(k.psid AS CHAR) REGEXP '^[1-9][0-9]{0,31}$'
                   AND CAST(k.psid AS CHAR) <> CAST(k.userid AS CHAR) THEN CAST(k.psid AS CHAR) END
    ELSE CAST(k.userid AS CHAR) END`;
const latestProfile = `NOT EXISTS (SELECT 1 FROM khachhang newer
    WHERE newer.userid = k.userid AND newer.pageid = k.pageid AND newer.id > k.id)`;

function managedLabel(value) {
    return labels.get(String(value ?? '').normalize('NFC').trim().toLowerCase()) || null;
}

async function updateCustomers(where, keys, label, sql, values) {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const [customers] = await conn.query(
            `SELECT CAST(k.pageid AS CHAR) AS page_id, (${labelPsid}) AS psid, k.label
               FROM khachhang k WHERE ${where} FOR UPDATE`,
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
                     attempts = IF(last_error = '${unavailablePsid}', attempts, 0),
                     next_attempt_at = IF(last_error = '${unavailablePsid}', next_attempt_at, UTC_TIMESTAMP()),
                     last_error = IF(last_error = '${unavailablePsid}', last_error, NULL)`,
                [...jobs.flat(), desired]
            );
        }
        await require('./zaloCustomerProfileSync').enqueueWhere(conn, where, keys);
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

const graphBase = 'https://graph.facebook.com/v25.0';

function describeGraphError(error, token, operation, node) {
    const metaMessage = error.response?.data?.error?.message;
    error.labelOperation = operation;
    error.labelNode = node;
    error.labelHttpStatus = error.response?.status;
    if (typeof metaMessage === 'string') {
        error.labelDetail = metaMessage.replaceAll(token, '[ẩn token]').replace(/[\r\n\t]+/g, ' ').slice(0, 240);
    }
    return error;
}

async function graph(token, method, node, edge, params) {
    try {
        const response = await axios.request({
            method, url: `${graphBase}/${node}/${edge}`,
            ...(method === 'POST' ? { data: new URLSearchParams(params) } : { params }),
            headers: { Authorization: `Bearer ${token}` }, timeout: 8000
        });
        return response.data;
    } catch (error) {
        throw describeGraphError(error, token, `${method} ${edge}`, node);
    }
}

async function* labelPages(token, node) {
    const cursors = new Set();
    let after;
    do {
        const page = await graph(token, 'GET', node, 'custom_labels', { fields: 'id,page_label_name', limit: 100, after });
        if (!Array.isArray(page?.data)) throw new Error('INVALID_LABEL_RESPONSE');
        yield page.data.filter(label => isId(label?.id));
        if (!page.paging?.next) break;
        const cursor = page.paging.cursors?.after;
        if (!cursor || cursors.has(cursor)) throw new Error('INVALID_LABEL_CURSOR');
        cursors.add(cursor);
        after = cursor;
    } while (after);
}

async function readLabels(token, node) {
    const result = [];
    for await (const page of labelPages(token, node)) result.push(...page);
    return result;
}

const pageLabelCache = new Map();
const labelCacheMs = 60 * 60 * 1000;

async function findPageLabel(token, pageId, desiredLabel) {
    const key = `${pageId}:${desiredLabel}`;
    const cached = pageLabelCache.get(key);
    if (cached?.expiresAt > Date.now()) {
        return cached.label;
    }
    pageLabelCache.delete(key);
    for await (const page of labelPages(token, pageId)) {
        for (const label of page) {
            const name = managedLabel(label.page_label_name);
            if (!name) continue;
            const labelKey = `${pageId}:${name}`;
            if (!(pageLabelCache.get(labelKey)?.expiresAt > Date.now())) {
                pageLabelCache.set(labelKey, { label, expiresAt: Date.now() + labelCacheMs });
            }
        }
        if (pageLabelCache.has(key)) return pageLabelCache.get(key).label;
    }
    const label = await graph(token, 'POST', pageId, 'custom_labels', { page_label_name: desiredLabel });
    if (!isId(label?.id)) throw new Error('LABEL_CREATION_UNCONFIRMED');
    pageLabelCache.set(key, { label, expiresAt: Date.now() + labelCacheMs });
    return label;
}

async function changeAssignment(token, method, id, psid) {
    const result = await graph(token, method, id, 'label', { user: psid });
    if (result?.success !== true) throw new Error('LABEL_CHANGE_UNCONFIRMED');
}

async function removeLabelBatch(token, psid, labels) {
    const batch = labels.map(label => ({
        method: 'DELETE', relative_url: `${label.id}/label?${new URLSearchParams({ user: psid })}`
    }));
    let response;
    try {
        response = await axios.request({
            method: 'POST', url: `${graphBase}/`, timeout: 8000,
            data: new URLSearchParams({ access_token: token, batch: JSON.stringify(batch) })
        });
    } catch (error) {
        throw describeGraphError(error, token, 'POST batch');
    }
    if (!Array.isArray(response.data) || response.data.length !== labels.length) {
        throw new Error('LABEL_BATCH_UNCONFIRMED');
    }
    for (const [index, item] of response.data.entries()) {
        let body;
        try {
            body = JSON.parse(item?.body);
        } catch (_) {
            throw new Error('LABEL_BATCH_UNCONFIRMED');
        }
        if (item.code >= 200 && item.code < 300 && body?.success === true) continue;
        const error = new Error('LABEL_CHANGE_UNCONFIRMED');
        error.response = { status: item.code, data: body };
        throw describeGraphError(error, token, 'DELETE label', labels[index].id);
    }
}

async function syncCustomer(job) {
    const token = await getPageToken(job.page_id);
    if (!token) throw new Error('PAGE_TOKEN_MISSING');
    const current = await readLabels(token, job.psid);
    let keepId;
    if (job.desired_label) {
        let label = current.find(item => managedLabel(item.page_label_name) === job.desired_label);
        if (!label) {
            label = await findPageLabel(token, job.page_id, job.desired_label);
            try {
                await changeAssignment(token, 'POST', label.id, job.psid);
            } catch (error) {
                if (errorCode(error) === 'META_100_33' && error.labelNode === label.id) {
                    pageLabelCache.delete(`${job.page_id}:${job.desired_label}`);
                }
                throw error;
            }
        }
        keepId = label.id;
    }
    const toRemove = current.filter(label => keepId ? label.id !== keepId : managedLabel(label.page_label_name) !== null);
    const batchSize = 50;
    for (let index = 0; index < toRemove.length; index += batchSize) {
        const batch = toRemove.slice(index, index + batchSize);
        if (batch.length === 1) {
            await changeAssignment(token, 'DELETE', batch[0].id, job.psid);
        } else {
            await removeLabelBatch(token, job.psid, batch);
        }
    }
}

function errorCode(error) {
    const meta = error.response?.data?.error;
    if (Number.isInteger(meta?.code)) return 'META_' + meta.code + (Number.isInteger(meta.error_subcode) ? '_' + meta.error_subcode : '');
    const code = error.code || error.message;
    return typeof code === 'string' && /^[A-Z0-9_]{1,80}$/.test(code) ? code : 'SYNC_ERROR';
}

async function moveLegacyJob(conn, job, key) {
    const [[profile]] = await conn.query(
        `SELECT COALESCE((${legacyUser}), 0) AS legacy_user, (${labelPsid}) AS target
           FROM khachhang k WHERE k.userid = ? AND k.pageid = ?
             AND CAST(k.userid AS CHAR CHARACTER SET ascii) = ? AND CAST(k.pageid AS CHAR CHARACTER SET ascii) = ?
          ORDER BY k.id DESC LIMIT 1`, [job.psid, job.page_id, job.psid, job.page_id]
    );
    if (!Number(profile?.legacy_user)) return false;
    if (!profile.target) {
        await conn.query(
            'UPDATE gb_facebook_customer_label_sync SET last_error = ? WHERE page_id = ? AND psid = ? AND revision = ?',
            [missingLegacyPsid, ...key]
        );
        return true;
    }
    await conn.beginTransaction();
    try {
        const [deleted] = await conn.query(
            'DELETE FROM gb_facebook_customer_label_sync WHERE page_id = ? AND psid = ? AND revision = ?', key
        );
        if (deleted.affectedRows) {
            await conn.query(
                `INSERT INTO gb_facebook_customer_label_sync (page_id, psid, desired_label, next_attempt_at)
                 VALUES (?, ?, ?, UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE revision = revision`,
                [job.page_id, profile.target, job.desired_label]
            );
        }
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    }
    return true;
}

const eligibleJob = `(q.next_attempt_at <= UTC_TIMESTAMP() AND
    (q.last_error IS NULL OR q.last_error NOT IN (${blockedErrors})))
    OR (q.last_error IN (${blockedErrors}) AND EXISTS (
        SELECT 1 FROM khachhang k WHERE k.userid = q.psid AND k.pageid = q.page_id
          AND CAST(k.userid AS CHAR CHARACTER SET ascii) = q.psid
          AND CAST(k.pageid AS CHAR CHARACTER SET ascii) = q.page_id AND ${latestProfile}
          AND ${legacyUser} AND ((${labelPsid}) IS NOT NULL OR q.last_error = '${invalidPsid}')
    ))`;

async function runJob(pageId, psid) {
    const conn = await db.getConnection();
    const lock = 'gb:fb:labels:' + pageId;
    let acquired = false;
    try {
        const [[result]] = await conn.query('SELECT GET_LOCK(?, 0) AS acquired', [lock]);
        acquired = Number(result.acquired) === 1;
        if (!acquired) return;
        const [[job]] = await conn.query(
            `SELECT page_id, psid, desired_label, revision, attempts FROM gb_facebook_customer_label_sync q
              WHERE page_id = ? AND psid = ? AND (${eligibleJob})`,
            [pageId, psid]
        );
        if (!job) return;
        const key = [pageId, psid, job.revision];
        if (await moveLegacyJob(conn, job, key)) return;
        try {
            await syncCustomer(job);
        } catch (error) {
            const code = errorCode(error);
            if (code === 'META_100_33' && error.labelOperation === 'GET custom_labels' && error.labelNode === job.psid) {
                await conn.query(
                    'UPDATE gb_facebook_customer_label_sync SET last_error = ? WHERE page_id = ? AND psid = ? AND revision = ?',
                    [unavailablePsid, ...key]
                );
                console.warn('[Nhãn Facebook]', 'Page', pageId, unavailablePsid, error.labelOperation);
                return;
            }
            if (error.response?.data?.error?.code === 100 && /^POST label$|^DELETE label$/.test(error.labelOperation) &&
                /param psid is not a valid psid id/i.test(error.labelDetail || '')) {
                await conn.query(
                    `UPDATE gb_facebook_customer_label_sync SET last_error = ? WHERE page_id = ? AND psid = ? AND revision = ?`,
                    [invalidPsid, ...key]
                );
                console.warn('[Nhãn Facebook]', 'Page', pageId, invalidPsid, error.labelOperation);
                return;
            }
            const delay = 60 * 2 ** Math.min(Number(job.attempts), 6);
            await conn.query(
                `UPDATE gb_facebook_customer_label_sync
                    SET attempts = LEAST(attempts + 1, 65535), last_error = ?,
                        next_attempt_at = TIMESTAMPADD(SECOND, ?, UTC_TIMESTAMP())
                  WHERE page_id = ? AND psid = ? AND revision = ?`,
                [code, delay, ...key]
            );
            console.warn('[Nhãn Facebook]', 'Page', pageId, code,
                error.labelOperation || '', error.labelHttpStatus || '', error.labelDetail || '');
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
    async function tick() {
        if (busy) return;
        busy = true;
        try {
            const [jobs] = await db.query(
                `SELECT page_id, psid FROM gb_facebook_customer_label_sync q
                  WHERE ${eligibleJob}
                  ORDER BY next_attempt_at, page_id, psid LIMIT 10`
            );
            for (const job of jobs) {
                try {
                    await runJob(job.page_id, job.psid);
                } catch (error) {
                    console.warn('[Nhãn Facebook] Lỗi xử lý lượt đồng bộ:', 'Page', job.page_id, errorCode(error));
                }
            }
            lastError = undefined;
        } catch (error) {
            const code = errorCode(error);
            if (code !== lastError) console.warn('[Nhãn Facebook] Hàng đợi:', code);
            lastError = code;
        } finally {
            busy = false;
        }
    }
    setInterval(tick, 15000).unref();
    void tick();
}

module.exports = { updateCustomers, start };
