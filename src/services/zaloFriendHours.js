'use strict';

const OFFSET = 7 * 60 * 60 * 1000;

function getFriendWindow(now = Date.now()) {
    const local = new Date(now + OFFSET);
    const hour = local.getUTCHours();
    const allowed = hour >= 7 && hour < 23;
    const nextDay = hour >= 23 ? 1 : 0;
    const nextOpen = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + nextDay, 7) - OFFSET;
    return { allowed, timezone: 'GMT+7', start: '07:00', end: '23:00',
        nextOpenAt: allowed ? null : new Date(nextOpen).toISOString() };
}

module.exports = { getFriendWindow };
