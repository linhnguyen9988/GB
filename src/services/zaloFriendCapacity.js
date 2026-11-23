'use strict';

const LIMIT = 100;
const REFRESH_MS = 5 * 60 * 1000;
const snapshots = new Map();

function entry(session) {
    let item = snapshots.get(session.accountId);
    if (!item || item.identity !== session.encrypted) {
        item = { identity: session.encrypted, ids: null, checkedAt: 0, error: null };
        snapshots.set(session.accountId, item);
    }
    return item;
}

function status(accountId) {
    const item = snapshots.get(accountId);
    return { limit: LIMIT, count: item?.ids ? item.ids.size : null,
        checkedAt: item?.checkedAt || null, error: item?.error || null };
}

async function check(session) {
    const item = entry(session);
    if (item.ids && Date.now() - item.checkedAt < REFRESH_MS) return status(session.accountId);
    try {
        let result;
        try { result = await session.api.getSentFriendRequest(); }
        catch (error) {
            // zca-js documents 112 as the empty sent-request list.
            if (Number(error.code) !== 112) throw error;
            result = {};
        }
        if (!result || typeof result !== 'object' || Array.isArray(result) ||
            Object.entries(result).some(([uid, value]) => !/^[1-9]\d{0,63}$/.test(uid) || !value || typeof value !== 'object')) {
            throw new Error('Danh sách lời mời Zalo trả về không hợp lệ.');
        }
        item.ids = new Set(Object.keys(result));
        item.checkedAt = Date.now();
        item.error = null;
    } catch (error) {
        item.ids = null;
        item.checkedAt = 0;
        item.error = 'Chưa đọc được số lời mời đang chờ. Tạm dừng kết bạn, kiểm tra lại sau 5 phút.';
        throw error;
    }
    return status(session.accountId);
}

function sent(session, uid) {
    // Reserve each successful send locally until the next authoritative refresh.
    // The worker's database lock serializes this check/send/update per account.
    entry(session).ids?.add(uid);
}

function invalidate(accountId) { snapshots.delete(accountId); }

module.exports = { check, status, sent, invalidate, REFRESH_MS };
