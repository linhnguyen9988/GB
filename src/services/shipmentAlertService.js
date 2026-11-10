'use strict';
const DBConnection = require("../configs/DBConnection");
const axios = require('axios');
const { getPageToken } = require('./pageTokenService');
const { toE164VN } = require('../utils/text');

async function SendCanhBao(orderNumber, shipper_name, shipper_phone, cod, issue, carrier = 'Viettel Post') {
    const jt = carrier === 'J&T';
    try {
        const db = DBConnection.promise();

        const [orders] = await db.query(
            `SELECT userid FROM lendon WHERE realorderid = ?${jt ? " AND provider = 'J&T'" : ''} LIMIT 1`,
            [orderNumber]
        );
        if (orders.length === 0) return;

        const [users] = await db.query(
            'SELECT pageid FROM khachhang WHERE userid = ? LIMIT 1',
            [orders[0].userid]
        );
        if (users.length === 0) {
            if (jt) console.warn('[J&T Messenger]', orderNumber, 'Thiếu thông tin Page của khách.');
            return;
        }

        const pageId = users[0].pageid;
        const token = await getPageToken(pageId);
        if (jt && !token) {
            console.warn('[J&T Messenger]', orderNumber, 'Thiếu token của Page.');
            return;
        }
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
        const tryingSend = async (messaging_type, tag = null) => {
            const payload = {
                recipient: { id: recipientId },
                messaging_type,
                message: {
                    attachment: {
                        type: 'template',
                        payload: {
                            template_type: 'button',
                            text,
                            buttons
                        }
                    }
                },
                ...(tag ? { tag } : {})
            };
            if (jt) {
                await axios.post(`https://graph.facebook.com/v25.0/${encodeURIComponent(pageId)}/messages`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                    timeout: 10000
                });
            } else {
                await axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, payload);
            }
        };

        try {
            await tryingSend('UPDATE');
        } catch (err) {
            const code = err.response?.data?.error?.code;
            if (!jt && (code === 2018286 || code === 10)) {
                await tryingSend('MESSAGE_TAG', 'HUMAN_AGENT');
            } else {
                throw err;
            }
        }
    } catch (error) {
        if (jt) {
            const metaError = error.response?.data?.error;
            console.warn('[J&T Messenger]', orderNumber, 'Gửi thất bại.',
                'HTTP:', error.response?.status ?? '-', 'Meta:', metaError?.code ?? '-', 'chi tiết:', metaError?.error_subcode ?? '-');
        }
    }
}

module.exports = { SendCanhBao };
