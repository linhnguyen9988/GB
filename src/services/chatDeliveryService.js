'use strict';

const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const db = require('../configs/DBConnection');
const audit = require('./messageAuditService');
const zalo = require('./zaloCustomerChat');
const { claimParts, finishPart, findParts, isClientId, facebookFallbackId } = require('./chatSendParts');
const { getRecentCommentIdsFromDB } = require('./commentService');
const { buildParts, sendDirectParts, sendPrivateParts } = require('./messengerMessageParts');

const { getPreferredChannel } = require('./chatReplyChannel');

const graph = 'https://graph.facebook.com/v19.0/me';

async function uploadAttachment(file, type, token) {
    const optimized = file.path + '_gb_chat.jpg';
    let path = file.path;
    try {
        if (type === 'image') {
            try {
                await sharp(path).rotate().resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                    .jpeg({ quality: 70 }).toFile(optimized);
                path = optimized;
            } catch (_) {}
        }
        const form = new FormData();
        form.append('message', JSON.stringify({ attachment: { type, payload: { is_reusable: true } } }));
        form.append('filedata', fs.createReadStream(path));
        const response = await axios.post(graph + '/message_attachments', form, {
            params: { access_token: token }, headers: form.getHeaders(), timeout: 30000
        });
        return response.data?.attachment_id || null;
    } catch (error) {
        console.error('[chat] Không tải được tệp lên Messenger:', error.code || error.name);
        return null;
    } finally {
        if (type === 'image') await fs.promises.unlink(optimized).catch(() => {});
    }
}

async function deliver({ user, customerId, pageId, message, file, attachmentType = 'image',
    clientMessageId, deliveryChannel, orderConfirmation, mobile = false }) {
    if (!customerId || !pageId) return { status: 400, body: { success: false, error: 'Thiếu khách hoặc Page.' } };
    if (!message && !file) return mobile
        ? { status: 200, body: { success: true, message: 'Không có nội dung để gửi.' } }
        : { status: 400, body: { success: false, error: 'Không có nội dung để gửi.' } };

    const request = {
        user, pageId: String(pageId), customerId: String(customerId),
        clientMessageId: isClientId(clientMessageId) ? clientMessageId : randomUUID()
    };
    const directZalo = deliveryChannel === 'zalo';
    const allowZalo = directZalo || orderConfirmation === '1' || zalo.isOrderConfirmation(message);
    let preferredChannel = 'facebook';
    let facebookRequired = false;
    let fallbackClaims = null;
    const facebookStates = {};
    const names = [...(file ? ['image'] : []), ...(message ? ['text'] : [])];
    let claims = {};
    const states = {};
    let zaloResult = null;
    const uncertain = {};
    let errorText;
    let failureStatus = 400;

    function track(part, state, channel, mid) {
        states[part] = { state, channel, messid: mid || null };
        uncertain[part] = state === 'uncertain';
    }
    const isClaimed = part => Boolean(claims[part]?.claimId);
    const needs = part => isClaimed(part) && states[part]?.state !== 'sent';

    async function refreshConfirmations(activeClaims = claims, mask = uncertain) {
        const pending = names.filter(part => activeClaims[part]?.claimId && mask[part]);
        if (!pending.length) return;
        try {
            const confirmed = await findParts({ ...request, clientIds: [request.clientMessageId] });
            for (const saved of confirmed) {
                if (pending.includes(saved.part) && saved.state === 'sent') {
                    track(saved.part, 'sent', saved.channel, saved.messid);
                }
            }
        } catch (error) {
            console.error('[chat] Không kiểm tra được xác nhận gửi:', error.code || error.name);
        }
    }

    const deliveryUncertain = uncertain;

    async function sendFacebook(activeClaims, forceFull = false) {
        const savedStates = forceFull ? facebookStates : states;
        const uncertain = forceFull ? {} : deliveryUncertain;
        const needs = part => Boolean(activeClaims[part]?.claimId) && savedStates[part]?.state !== 'sent';
        const track = (part, state, channel, mid) => {
            savedStates[part] = { state, channel, messid: mid || null };
            states[part] = savedStates[part];
            uncertain[part] = state === 'uncertain';
            deliveryUncertain[part] = uncertain[part];
        };
        if (forceFull) for (const part of names) {
            if (!activeClaims[part]?.claimId) {
                const saved = activeClaims[part];
                track(part, saved.state, 'facebook', saved.messid);
            }
        }
        if (!names.some(needs)) return;
        const [[page]] = await db.query('SELECT accesstoken FROM pageinfo WHERE pageid = ? LIMIT 1', [request.pageId]);
        if (page?.accesstoken) {
            const token = page.accesstoken;
            const attachmentId = needs('image') ? await uploadAttachment(file, attachmentType, token) : null;
            const send = async (payload, part) => {
                try {
                    if (uncertain[part]) await refreshConfirmations(activeClaims, uncertain);
                    if (states[part]?.state === 'sent' && states[part].channel === 'facebook') {
                        savedStates[part] = states[part];
                        return { success: true, response: { message_id: states[part].messid } };
                    }
                    const result = await audit.send({
                        ...request, payload, claim: activeClaims[part],
                        post: body => axios.post(graph + '/messages', body, {
                            params: { access_token: token }, timeout: 15000
                        })
                    });
                    if (result.success && result.response?.message_id) {
                        track(part, 'sent', 'facebook', result.response.message_id);
                    } else if (result.success || !result.error?.response ||
                               result.error.response.status >= 500 || result.error.response.status === 408) {
                        track(part, 'uncertain', 'facebook');
                        return { ...result, success: false };
                    }
                    return result;
                } catch (error) {
                    track(part, 'uncertain', 'facebook');
                    throw error;
                }
            };
            if (needs('image') && !attachmentId) {
                errorText = 'Không tải được tệp đính kèm lên Messenger.';
            } else {
                await sendDirectParts({
                    recipient: request.customerId, parts: buildParts(attachmentId, attachmentType, needs('text') ? message : ''),
                    uncertain, send
                });
                const parts = buildParts(needs('image') ? attachmentId : null, attachmentType, needs('text') ? message : '');
                if (parts.image || parts.text) {
                    try {
                        const commentIds = await getRecentCommentIdsFromDB(request.customerId, request.pageId);
                        await sendPrivateParts({ commentIds, parts, uncertain, send });
                    } catch (error) {
                        console.error('[chat] Không lấy được bình luận để Private Reply:', error.code || error.name);
                    }
                }
            }
        } else {
            errorText = 'Thiếu token Facebook của Page.';
            if (mobile && !page && !allowZalo && !forceFull) failureStatus = 404;
        }
    }

    async function sendZalo() {
        const image = file || null;
        const text = message || '';
        const missingImage = needs('image');
        const missingText = needs('text');
        zaloResult = { imageSent: false, textSent: false, uncertain: false };
        try {
            const result = await zalo.sendCustomerMessage({ ...request, actor: user, text, file: image });
            zaloResult = result;
            if (missingImage) track('image', result.imageSent ? 'sent' : result.uncertain ? 'uncertain' : 'failed', 'zalo');
            if (missingText) track('text', result.textSent ? 'sent' : result.uncertain ? 'uncertain' : 'failed', 'zalo');
            if (result.error) errorText = 'Zalo: ' + result.error;
        } catch (error) {
            zaloResult.uncertain = true;
            if (missingImage) track('image', 'uncertain', 'zalo');
            if (missingText) track('text', 'uncertain', 'zalo');
            console.error('[chat] Lỗi xử lý Zalo:', error.code || error.name);
        }
    }

    try {
        claims = await claimParts(request, names);
        for (const part of names) {
            const saved = claims[part];
            if (!saved.claimId) track(part, saved.state, saved.channel, saved.messid);
        }

        preferredChannel = deliveryChannel === 'facebook' ? 'facebook'
            : directZalo ? 'zalo' : await getPreferredChannel(request.customerId, request.pageId);
        const saved = await findParts({ ...request, clientIds: [request.clientMessageId] });
        const resumeFacebook = saved.some(part => part.requiredChannel === 'facebook');
        const alreadyDelivered = names.every(part => states[part]?.state === 'sent');
        const savedChannels = new Set(names.map(part => states[part]?.channel));
        if (resumeFacebook) {
            facebookRequired = true;
        } else if (!directZalo && alreadyDelivered && savedChannels.size === 1) {
            preferredChannel = states[names[0]].channel || preferredChannel;
        } else if (!directZalo && !names.some(isClaimed)) {
            // Another request owns these parts; do not start a second channel.
        } else if (preferredChannel === 'zalo') {
            await sendZalo();
            const complete = (!file || zaloResult?.imageSent) && (!message || zaloResult?.textSent);
            facebookRequired = !complete && !zaloResult?.uncertain && names.some(isClaimed);
        } else {
            await sendFacebook(claims);
            await refreshConfirmations();
            const mixedChannels = names.some(part => states[part]?.channel === 'facebook') && names.some(part => states[part]?.channel === 'zalo');
            if (allowZalo && (names.some(needs) || mixedChannels)) await sendZalo();
        }
        if (facebookRequired) {
            fallbackClaims = await claimParts({ ...request, clientMessageId: facebookFallbackId(request.clientMessageId) }, names);
            await sendFacebook(fallbackClaims, true);
            await refreshConfirmations(fallbackClaims);
            for (const part of names) if (states[part]?.state === 'sent' && states[part].channel === 'facebook') facebookStates[part] = states[part];
        }
    } catch (error) {
        console.error('[chat] Lỗi xử lý gửi tin:', error.code || error.name);
        failureStatus = 500;
        errorText = 'Lỗi server khi xử lý tin nhắn.';
    } finally {
        for (const part of names) {
            if (!isClaimed(part)) continue;
            const saved = states[part] || { state: 'failed' };
            try {
                await finishPart(claims[part], saved.state, saved.channel || null, saved.messid || null);
            } catch (error) {
                console.error('[chat] Lỗi lưu kết quả gửi:', error.code || error.name);
            }
        }
        if (fallbackClaims) for (const part of names) {
            const saved = facebookStates[part] || { state: 'failed' };
            try { await finishPart(fallbackClaims[part], saved.state, 'facebook', saved.messid || null); }
            catch (error) { console.error('[chat] Lỗi lưu phần gửi lại qua Facebook:', error.code || error.name); }
        }
    }

    const imageSent = states.image?.state === 'sent' || Boolean(zaloResult?.imageSent);
    const textSent = states.text?.state === 'sent' || Boolean(zaloResult?.textSent);
    const success = facebookRequired ? names.every(part => facebookStates[part]?.state === 'sent') : zaloResult
        ? (!file || zaloResult.imageSent) && (!message || zaloResult.textSent)
        : names.every(part => states[part]?.state === 'sent');
    const unknown = facebookRequired ? names.some(part => facebookStates[part]?.state === 'uncertain') : zaloResult ? Boolean(zaloResult.uncertain) : names.some(part => states[part]?.state === 'uncertain');
    const messageIds = names.map(part => states[part]?.messid).filter(Boolean);
    const body = { success, messageIds, imageSent, textSent, uncertain: unknown,
        preferredChannel, facebookRequired,
        zaloRequired: Boolean(zaloResult) && !facebookRequired,
        zaloImageSent: Boolean(zaloResult?.imageSent || (states.image?.state === 'sent' && states.image.channel === 'zalo')),
        zaloTextSent: Boolean(zaloResult?.textSent || (states.text?.state === 'sent' && states.text.channel === 'zalo')) };
    if (!mobile) {
        body.facebookImageSent = states.image?.state === 'sent' && states.image.channel === 'facebook';
        body.facebookTextSent = states.text?.state === 'sent' && states.text.channel === 'facebook';
    }
    if (success) body.message = 'Gửi thành công.';
    else body.error = unknown ? 'Chưa xác nhận được kết quả gửi. Vui lòng kiểm tra cuộc trò chuyện trước khi gửi lại.'
        : (facebookRequired ? 'Chưa gửi đủ ảnh và nội dung qua Messenger.' : '') || errorText || (zaloResult ? 'Chưa gửi đủ ảnh và nội dung qua Zalo.' : '') || 'Không gửi được ' + names.filter(part => states[part]?.state !== 'sent').map(part => part === 'image' ? 'tệp đính kèm' : 'tin nhắn văn bản').join(' và ') + '.';
    return { status: success ? 200 : failureStatus, body };
}

module.exports = { deliver };
