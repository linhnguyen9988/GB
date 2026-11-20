'use strict';

const db = require('../configs/DBConnection');
const zalo = require('./zaloConnection');
const { receiveReaction } = require('./zaloReactionService');
const { attachReactionSummaries } = require('./reactionService');

// zca-js 2.2 addReaction uses parseInt on 64-bit message IDs. Keep the exact IDs
// through its supported custom API, using the same reaction request format.
async function sendHeart(session, threadId, msgId, cliMsgId) {
    session.api.custom('gbSendHeart', async ({ utils, props }) => {
        const message = '{"rMsg":[{"gMsgID":' + BigInt(props.msgId).toString() +
            ',"cMsgID":' + BigInt(props.cliMsgId).toString() + ',"msgType":1}],"rIcon":"/-heart","rType":5,"source":6}';
        const params = utils.encodeAES(JSON.stringify({ toid: props.threadId,
            react_list: [{ message, clientId: Date.now() }] }));
        if (!params) throw new Error('Không mã hóa được reaction Zalo.');
        const url = utils.makeURL(session.api.zpwServiceMap.reaction[0] + '/api/message/reaction');
        const response = await utils.request(url, { method: 'POST', body: new URLSearchParams({ params }) });
        return utils.resolve(response);
    });
    return session.api.gbSendHeart({ threadId, msgId, cliMsgId });
}

async function heartMessage(mid) {
    if (typeof mid !== 'string' || !/^zalo:[a-f0-9]{64}$/.test(mid)) throw new zalo.ZaloActionError(400, 'Tin nhắn Zalo không hợp lệ.');
    const session = await zalo.openSavedSession();
    if (!session) throw new zalo.ZaloActionError(409, 'Chưa kết nối tài khoản Zalo.');
    const [rows] = await db.query(
        `SELECT r.thread_id, r.message_id, k.phone, k.zalo_phone FROM gb_zalo_chat_receipt r
         JOIN messaging m ON m.messid = CONCAT('zalo:', r.send_key) AND m.channel = 'zalo'
         JOIN khachhang k ON k.zalo_account_id = r.account_id AND k.zaloid = r.thread_id
           AND ((m.sender = k.userid AND m.recipient = k.pageid) OR (m.recipient = k.userid AND m.sender = k.pageid))
         WHERE r.account_id = ? AND r.send_key = ?`, [session.accountId, mid.slice(5)]
    );
    const linked = rows.filter(row => {
        try { return zalo.normalizePhone(row.phone) === row.zalo_phone; } catch (_) { return false; }
    });
    const target = linked.find(row => /^\d+$/.test(row.message_id));
    const client = target && linked.find(row => row.thread_id === target.thread_id && /^c:\d+$/.test(row.message_id));
    if (!target || !client) throw new zalo.ZaloActionError(409, 'Tin này chưa có đủ mã gốc Zalo để thả cảm xúc.');
    if (!await zalo.isSavedSessionCurrent(session)) throw new zalo.ZaloActionError(409, 'Kết nối Zalo đã thay đổi.');
    await sendHeart(session, target.thread_id, target.message_id, client.message_id.slice(2));
    await receiveReaction(session, { isSelf: true, isGroup: false, threadId: target.thread_id,
        data: { uidFrom: session.accountId, ts: String(Date.now()), content: {
            rIcon: '/-heart', rType: 5, rMsg: [{ gMsgID: target.message_id, cMsgID: client.message_id.slice(2) }]
        } } });
    const messages = [{ messid: mid }];
    await attachReactionSummaries(messages);
    return { success: true, mid, reactions: messages[0].reactions };
}

module.exports = { heartMessage };
