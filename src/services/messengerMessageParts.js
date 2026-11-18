'use strict';

function buildParts(attachmentId, attachmentType, text) {
    return {
        image: attachmentId ? { attachment: { type: attachmentType || 'image', payload: { attachment_id: attachmentId } } } : null,
        text: text ? { text } : null
    };
}

async function postPart(send, payload, part, uncertain) {
    try {
        return await send(payload, part);
    } catch (error) {
        uncertain[part] = true;
        console.error('[Messenger] Lỗi xử lý phần tin:', part, error.message);
        return { success: false };
    }
}

async function sendDirectParts({ recipient, parts, uncertain, send }) {
    async function post(part) {
        const message = parts[part];
        if (!message) return false;
        const payload = { recipient: { id: recipient }, messaging_type: 'UPDATE', message };
        const result = await postPart(send, payload, part, uncertain);
        if (result.success) return true;
        const code = result.error?.response?.data?.error?.code;
        if (uncertain[part] || (code !== 2018286 && code !== 10)) return false;
        const retry = await postPart(send, { ...payload, messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' }, part, uncertain);
        return retry.success;
    }

    const [imageSent, textSent] = await Promise.all([post('image'), post('text')]);
    return { imageSent, textSent, success: (!parts.image || imageSent) && (!parts.text || textSent) };
}

async function sendPrivateParts({ commentIds, parts, uncertain, send }) {
    const available = [...new Set(commentIds)];
    const sent = { image: false, text: false };
    const requested = ['image', 'text'].filter(part => parts[part] && !uncertain[part]);

    // A comment can receive one private reply. Pair two different comments or leave the pair for the next channel.
    if (available.length < requested.length) return { imageSent: false, textSent: false };
    while (available.length) {
        const missing = requested.filter(part => !sent[part] && !uncertain[part]);
        const round = missing.slice(0, available.length);
        if (!round.length) break;
        await Promise.all(round.map(async part => {
            const commentId = available.shift();
            const result = await postPart(send, {
                messaging_type: 'RESPONSE',
                recipient: { comment_id: commentId },
                message: parts[part]
            }, part, uncertain);
            sent[part] = result.success;
        }));
    }
    return { imageSent: sent.image, textSent: sent.text };
}

module.exports = { buildParts, sendDirectParts, sendPrivateParts };
