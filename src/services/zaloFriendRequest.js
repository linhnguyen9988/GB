'use strict';

function scheduleFriendRequest(session, uid) {
    // All outbound invitations share the durable, paced queue, including those
    // triggered by ordinary customer messages. Sending the message never waits.
    return require('./zaloFriendQueue').enqueueUid(session, uid).catch(error => {
        console.warn('[Kết bạn Zalo] Chưa xếp được lượt vào hàng chờ:', error.code || error.name);
        return 'failed';
    });
}

module.exports = { scheduleFriendRequest };
