'use strict';
const { createHash } = require('node:crypto');
const DBConnection = require("../configs/DBConnection");
const axios = require('axios');
const { getPageToken } = require('./pageTokenService');
const { toE164VN } = require('../utils/text');
const { sendCustomerMessage } = require('./zaloCustomerChat');

function suppressCustomerShipmentAlert(...reasons) {
    return reasons.some(reason => typeof reason === 'string' &&
        /phân sai|hàng chưa đến/.test(reason.normalize('NFC').toLowerCase().replace(/\s+/g, ' ')));
}

function isOutsideMessagingWindow(error) {
    const { code, error_subcode: subcode } = error.response?.data?.error || {};
    return code === 2018286 || (code === 10 && [2018278, 2018065, 2534022].includes(subcode));
}

async function SendCanhBao(orderNumber, shipper_name, shipper_phone, cod, issue, carrier = 'Viettel Post') {
    const jt = carrier === 'J&T';
    try {
        const db = DBConnection.promise();

        const [orders] = await db.query(
            `SELECT CAST(userid AS CHAR) AS userid FROM lendon WHERE realorderid = ?${jt ? " AND provider = 'J&T'" : ''} LIMIT 1`,
            [orderNumber]
        );
        if (orders.length === 0) return;

        const [users] = await db.query(
            'SELECT CAST(pageid AS CHAR) AS pageid FROM khachhang WHERE userid = ? LIMIT 1',
            [orders[0].userid]
        );
        if (users.length === 0) {
            console.warn(`[${carrier} Messenger]`, orderNumber, 'Thiếu thông tin Page của khách.');
            return;
        }

        const pageId = users[0].pageid;
        const token = await getPageToken(pageId);
        const recipientId = orders[0].userid;
        const shipperPhoneE164 = toE164VN(shipper_phone);
        const text = [
            carrier,
            ...(jt ? [`Mã vận đơn: ${orderNumber}`] : []),
            `Tiền hàng: ${cod.toLocaleString(jt ? 'vi-VN' : undefined)}đ`,
            `Trạng thái: ${issue}`,
            ...(!jt || shipperPhoneE164 ? ['Xin hãy gọi bưu tá', `Số bưu tá: ${shipper_phone}`] : []),
            `Nếu đã nhận hàng xin bỏ qua tin nhắn này.`
        ].join('\n');
        const journeyUrl = `https://aodaigiabao.com/journey/${encodeURIComponent(orderNumber)}`;

        const buttons = [
            {
                type: 'web_url',
                url: journeyUrl,
                title: 'Xem đơn hàng'
            }
        ];
        if (shipperPhoneE164) {
            buttons.push({
                type: 'phone_number',
                title: 'Gọi bưu tá',
                payload: shipperPhoneE164
            });
        }
        const sendMessenger = async (humanAgent = false) => {
            const payload = {
                recipient: { id: recipientId },
                messaging_type: humanAgent ? 'MESSAGE_TAG' : 'UPDATE',
                ...(humanAgent ? { tag: 'HUMAN_AGENT' } : {}),
                message: {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'button',
                            text,
                            buttons
                        }
                    }
                }
            };
            if (jt) {
                await axios.post(`https://graph.facebook.com/v25.0/${encodeURIComponent(pageId)}/messages`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                });
            } else {
                await axios.post('https://graph.facebook.com/v19.0/me/messages', payload, {
                    headers: { Authorization: `Bearer ${token}` }, timeout: 10000
                });
            }
        };

        if (token) {
            try {
                try {
                    await sendMessenger();
                } catch (error) {
                    if (!isOutsideMessagingWindow(error)) throw error;
                    await sendMessenger(true);
                }
                return;
            } catch (error) {
                const status = error.response?.status;
                const metaError = error.response?.data?.error;
                if (!(status >= 400 && status < 500 && metaError)) throw error;
                console.warn(`[${carrier} Messenger]`, orderNumber, 'Meta từ chối · chuyển sang Zalo',
                    metaError.code, metaError.error_subcode ?? '-');
            }
        }

        const zaloText = `${text}\nXem đơn hàng: ${journeyUrl}`;
        const clientMessageId = jt
            ? 'jt-shipment-' + createHash('sha256').update(text).digest('hex')
            : 'viettel-shipment-' + createHash('sha256').update(zaloText).digest('hex');
        const result = await sendCustomerMessage({
            customerId: recipientId, pageId, clientMessageId,
            actor: { username: 'Hệ thống' }, text, link: journeyUrl
        });
        if (!result.textSent) console.warn(`[${carrier} Zalo]`, orderNumber, result.error || 'Chưa xác nhận được kết quả gửi.');
    } catch (error) {
        const metaError = error.response?.data?.error;
        console.warn(`[${carrier} Messenger]`, orderNumber, 'Gửi thất bại.',
            'HTTP:', error.response?.status ?? '-', 'Meta:', metaError?.code ?? '-', 'chi tiết:', metaError?.error_subcode ?? '-');
    }
}

module.exports = { SendCanhBao, suppressCustomerShipmentAlert };
