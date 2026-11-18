'use strict';

const { createHash, randomUUID } = require('node:crypto');
const db = require('../configs/DBConnection');

function isClientId(value) {
    return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
}

function partKey({ user, pageId, customerId, clientMessageId }, part) {
    return createHash('sha256').update(JSON.stringify([
        String(user.id), String(pageId), String(customerId), clientMessageId, part
    ])).digest('hex');
}

async function findParts({ user, pageId, customerId, clientIds }) {
    const keys = new Map();
    for (const id of clientIds) {
        if (!isClientId(id)) continue;
        for (const part of ['image', 'text']) {
            keys.set(partKey({ user, pageId, customerId, clientMessageId: id }, part), { id, part });
        }
    }
    if (!keys.size) return [];
    const [rows] = await db.query(
        'SELECT send_key, state, channel, messid FROM gb_chat_send_parts WHERE send_key IN (?)',
        [[...keys.keys()]]
    );
    return rows.map(row => ({ ...keys.get(row.send_key), state: row.state, channel: row.channel, messid: row.messid }));
}

async function claimParts(request, parts) {
    const keys = new Map(parts.map(part => [partKey(request, part), part]));
    const claimId = randomUUID();
    const values = [...keys.keys()];
    // Reserve every new part in the same statement so competing requests cannot split a new pair.
    await db.query('INSERT IGNORE INTO gb_chat_send_parts (send_key, claim_id) VALUES ?', [values.map(key => [key, claimId])]);
    await db.query(
        "UPDATE gb_chat_send_parts SET claim_id = ?, state = 'sending', audit_key = NULL, messid = NULL, channel = NULL WHERE send_key IN (?) AND state = 'failed'",
        [claimId, values]
    );
    const [rows] = await db.query(
        'SELECT send_key, claim_id, state, channel, messid FROM gb_chat_send_parts WHERE send_key IN (?)',
        [values]
    );
    const saved = new Map(rows.map(row => [row.send_key, row]));
    return Object.fromEntries([...keys.entries()].map(([key, part]) => {
        const row = saved.get(key);
        return [part, row?.claim_id === claimId && row.state === 'sending' ? { key, claimId, part }
            : { part, state: row?.state === 'sent' ? 'sent' : 'uncertain', channel: row?.channel, messid: row?.messid }];
    }));
}

async function bindAudit(claim, auditKey) {
    const [result] = await db.query(
        "UPDATE gb_chat_send_parts SET audit_key = ? WHERE send_key = ? AND claim_id = ? AND state = 'sending'",
        [auditKey, claim.key, claim.claimId]
    );
    if (!result.affectedRows) throw new Error('Message part is no longer claimed');
}

async function confirmFacebook(auditKey, mid) {
    await db.query(
        "UPDATE gb_chat_send_parts SET state = 'sent', channel = 'facebook', messid = ? WHERE audit_key = ? AND state IN ('sending','uncertain','sent')",
        [mid, auditKey]
    );
}

async function finishPart(claim, state, channel, mid = null) {
    if (!claim?.claimId) return;
    await db.query(
        "UPDATE gb_chat_send_parts SET state = ?, channel = ?, messid = ? WHERE send_key = ? AND claim_id = ? AND state = 'sending'",
        [state, channel, mid, claim.key, claim.claimId]
    );
}

module.exports = { isClientId, findParts, claimParts, bindAudit, confirmFacebook, finishPart };
