'use strict';

function getRowIdx() {
    return $('#comment_table').DataTable().cell({
        focused: true
    }).index().row;
}

let currentPostId = null;

function UpdateLiveStatusBadge(status) {
    var badge = document.getElementById("liveStatusBadge");
    if (!badge) return;
    if (status === 'LIVE') {
        badge.className = 'badge bg-danger live-badge-pulse';
        badge.innerHTML = 'Live';
    } else if (status) {
        badge.className = 'badge bg-secondary';
        badge.innerHTML = 'Kết thúc';
    } else {
        badge.className = 'badge bg-light text-dark border';
        badge.innerHTML = 'Chưa rõ trạng thái';
    }
}

let liveReplay = null;
let liveReconnectTimer;
let liveConnectionVersion = 0;

function lastVisibleCommentIndex(liveId) {
    if (!$.fn.dataTable.isDataTable('#comment_table')) return '0';
    let cursor = 0n;
    $('#comment_table').DataTable().rows().every(function () {
        const row = this.data();
        if (!row || String(row[17]) !== String(liveId) || !/^\d+$/.test(String(row[27]))) return;
        const index = BigInt(row[27]);
        if (index > cursor) cursor = index;
    });
    return String(cursor);
}

function isActiveLiveSocket(liveId, version) {
    return socket.connected && currentPostId === liveId && liveConnectionVersion === version;
}

async function replayLiveComments(replay, version) {
    try {
        let hasMore;
        do {
            const query = new URLSearchParams({ liveId: replay.liveId, after: replay.after });
            const response = await fetch('/api/live-comments/catch-up?' + query, { cache: 'no-store' });
            if (!isActiveLiveSocket(replay.liveId, version) || liveReplay !== replay) return;
            if (!response.ok) {
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    liveReplay = null;
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            const page = await response.json();
            if (!isActiveLiveSocket(replay.liveId, version) || liveReplay !== replay) return;
            if (page.comments.length) {
                for (const comment of page.comments) AddLiveComment(comment, true);
                $('#comment_table').DataTable().draw(false);
                replay.after = String(page.comments[page.comments.length - 1].idx);
            }
            hasMore = page.hasMore && page.comments.length > 0;
        } while (hasMore);
        liveReplay = null;
    } catch (error) {
        if (!isActiveLiveSocket(replay.liveId, version) || liveReplay !== replay) return;
        console.error('[live] Lỗi tải bù bình luận:', error);
        liveReconnectTimer = setTimeout(() => {
            if (isActiveLiveSocket(replay.liveId, version)) void replayLiveComments(replay, version);
        }, 2500);
    }
}

function subscribeLiveRoom(liveId) {
    const version = ++liveConnectionVersion;
    if (!socket.connected) return;
    socket.timeout(5000).emit('join-live-stream', liveId, (error, response) => {
        if (!isActiveLiveSocket(liveId, version)) return;
        if (error || !response?.joined) {
            liveReconnectTimer = setTimeout(() => {
                if (isActiveLiveSocket(liveId, version)) subscribeLiveRoom(liveId);
            }, 2500);
            return;
        }

        if (liveReplay?.liveId === liveId) void replayLiveComments(liveReplay, version);
    });
}

function JoinLiveRoom(liveId) {
    if (!liveId) return;
    liveId = String(liveId);
    if (currentPostId === liveId) return;
    LeaveLiveRoom();
    currentPostId = liveId;
    subscribeLiveRoom(liveId);
}

function LeaveLiveRoom() {
    clearTimeout(liveReconnectTimer);
    liveConnectionVersion++;
    liveReplay = null;
    if (currentPostId && socket.connected) socket.emit('leave-live-stream', currentPostId);
    currentPostId = null;
}

socket.on('disconnect', () => {
    clearTimeout(liveReconnectTimer);
    liveConnectionVersion++;
    if (currentPostId && liveReplay?.liveId !== currentPostId) {
        liveReplay = { liveId: currentPostId, after: lastVisibleCommentIndex(currentPostId) };
    }
});

socket.on('connect', () => {
    if (currentPostId) subscribeLiveRoom(currentPostId);
});
