'use strict';
const JT_SENDER = {
    name: process.env.JT_SENDER_NAME || 'Áo Dài Gia Bảo',
    mobile: process.env.JT_SENDER_MOBILE || '0888118855',
    prov: process.env.JT_SENDER_PROV || 'Đồng Nai',
    city: process.env.JT_SENDER_CITY || 'Thành phố Biên Hoà',
    area: process.env.JT_SENDER_AREA || 'Phường Long Bình-251TPB07',
    address: process.env.JT_SENDER_ADDRESS || '197 HBB'
};
const JT_ORDER_NOTE = 'Cho xem hàng. Không nhận thu 30k';
const JT_PRODUCT_NAME = 'Vải';

module.exports = { JT_SENDER, JT_ORDER_NOTE, JT_PRODUCT_NAME };
