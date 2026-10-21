import DBConnection from "../configs/DBConnection";
const axios = require('axios');
const { getPageToken } = require('./pageTokenService');
const { toE164VN } = require('../utils/text');

async function SendCanhBao(orderNumber, shipper_name, shipper_phone, cod, issue) {
    try {
        const db = DBConnection.promise();

        const [orders] = await db.query(
            'SELECT userid FROM lendon WHERE realorderid = ? LIMIT 1',
            [orderNumber]
        );
        if (orders.length === 0) return;

        const [users] = await db.query(
            'SELECT pageid FROM khachhang WHERE userid = ? LIMIT 1',
            [orders[0].userid]
        );
        if (users.length === 0) return;

        const token = await getPageToken(users[0].pageid);
        const recipientId = orders[0].userid;
        const text = [
            `Viettel Post`,
            `Tiền hàng: ${cod.toLocaleString()}đ`,
            `Trạng thái: ${issue}`,
            `Xin hãy gọi bưu tá`,
            `Số bưu tá: ${shipper_phone}`,
            `Nếu đã nhận hàng xin bỏ qua tin nhắn này.`
        ].join('\n');
        const journeyUrl = `https://aodaigiabao.com/journey/${orderNumber}`;

        const buttons = [
            {
                type: 'web_url',
                url: journeyUrl,
                title: 'Xem đơn hàng'
            }
        ];
        const shipperPhoneE164 = toE164VN(shipper_phone);
        if (shipperPhoneE164) {
            buttons.push({
                type: 'phone_number',
                title: 'Gọi bưu tá',
                payload: shipperPhoneE164
            });
        }
        console.log(`[SendCanhBao] ${orderNumber} - shipper_phone gốc: "${shipper_phone}" -> chuẩn hoá: ${shipperPhoneE164 || '(không hợp lệ, bỏ qua nút gọi)'}`);

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
            const res = await axios.post(
                `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
                payload
            );
            return res.data;
        };

        try {
            await tryingSend('UPDATE');
        } catch (err) {
            const code = err.response?.data?.error?.code;
            if (code === 2018286 || code === 10) {
                await tryingSend('MESSAGE_TAG', 'HUMAN_AGENT');
            } else {
                throw err;
            }
        }
    } catch (error) {
        console.error("Lỗi gửi tin nhắn:", error.response?.data?.error || error.message);
    }
}

module.exports = { SendCanhBao };
