'use strict';

const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const db = require('../configs/DBConnection');
const audit = require('./messageAuditService');
const zalo = require('./zaloCustomerChat');
const { claimParts, finishPart, isClientId } = require('./chatSendParts');
const { getRecentCommentIdsFromDB } = require('./commentService');
const { buildParts, sendDirectParts, sendPrivateParts } = require('./messengerMessageParts');

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
    const names = [...(file ? ['image'] : []), ...(message ? ['text'] : [])];
    let claims = {};
    const states = {};
    const uncertain = {};
    let errorText;
    let failureStatus = 400;

    function track(part, state, channel, mid) {
        states[part] = { state, channel, messid: mid || null };
        uncertain[part] = state === 'uncertain';
    }
    const isClaimed = part => Boolean(claims[part]?.claimId);
    const needs = part => isClaimed(part) && !states[part];

    try {
        claims = await claimParts(request, names);
        for (const part of names) {
            const saved = claims[part];
            if (!saved.claimId) track(part, saved.state, saved.channel, saved.messid);
        }
        if (!directZalo && names.some(needs)) {
            const [[page]] = await db.query('SELECT accesstoken FROM pageinfo WHERE pageid = ? LIMIT 1', [request.pageId]);
            if (page?.accesstoken) {
                const token = page.accesstoken;
                const attachmentId = needs('image') ? await uploadAttachment(file, attachmentType, token) : null;
                const send = async (payload, part) => {
                    try {
                        const result = await audit.send({
                            ...request, payload, claim: claims[part],
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
            } else {
                errorText = 'Thiếu token Facebook của Page.';
                if (mobile && !page && !allowZalo) failureStatus = 404;
            }
        }

        if (allowZalo && names.some(needs)) {
            const image = needs('image') ? file : null;
            const text = needs('text') ? message : '';
            try {
                const result = await zalo.sendCustomerMessage({ ...request, actor: user, text, file: image });
                if (image) track('image', result.imageSent ? 'sent' : result.uncertain ? 'uncertain' : 'failed', 'zalo');
                if (text) track('text', result.textSent ? 'sent' : result.uncertain ? 'uncertain' : 'failed', 'zalo');
                if (result.error) errorText = 'Zalo: ' + result.error;
            } catch (error) {
                if (image) track('image', 'uncertain', 'zalo');
                if (text) track('text', 'uncertain', 'zalo');
                console.error('[chat] Lỗi xử lý Zalo:', error.code || error.name);
            }
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
    }

    const imageSent = states.image?.state === 'sent';
    const textSent = states.text?.state === 'sent';
    const success = names.every(part => states[part]?.state === 'sent');
    const unknown = names.some(part => states[part]?.state === 'uncertain');
    const messageIds = names.map(part => states[part]?.messid).filter(Boolean);
    const body = { success, messageIds, imageSent, textSent, uncertain: unknown,
        zaloImageSent: imageSent && states.image.channel === 'zalo',
        zaloTextSent: textSent && states.text.channel === 'zalo' };
    if (!mobile) {
        body.facebookImageSent = imageSent && states.image.channel === 'facebook';
        body.facebookTextSent = textSent && states.text.channel === 'facebook';
    }
    if (success) body.message = 'Gửi thành công.';
    else body.error = unknown ? 'Chưa xác nhận được kết quả gửi. Vui lòng kiểm tra cuộc trò chuyện trước khi gửi lại.'
        : errorText || 'Không gửi được ' + names.filter(part => states[part]?.state !== 'sent').map(part => part === 'image' ? 'tệp đính kèm' : 'tin nhắn văn bản').join(' và ') + '.';
    return { status: success ? 200 : failureStatus, body };
}

module.exports = { deliver };
