'use strict';
const path = require('path');

require('dotenv').config();

const JT_PKEY = process.env.JT_PKEY;
const JT_API_ACCOUNT = process.env.JT_API_ACCOUNT;
const JT_CUSTOMER_CODE = process.env.JT_CUSTOMER_CODE;
const JT_PASSWORD = process.env.JT_PASSWORD;
const VIETTEL_WEBHOOK_TOKEN = process.env.VIETTEL_WEBHOOK_TOKEN;
const FB_WEBHOOK_VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN;
const REGISTER_PATH = process.env.REGISTER_PATH;

const CARRIER_ALIASES = { viettel: 'viettel', jt: 'jt', 'j&t': 'jt' };
const CARRIER_RAW = String(process.env.CARRIER || 'viettel').trim().toLowerCase();
const ACTIVE_CARRIER = CARRIER_ALIASES[CARRIER_RAW] || 'viettel';
if (!CARRIER_ALIASES[CARRIER_RAW]) {
    console.warn(`[CARRIER] Giá trị "${process.env.CARRIER}" không hợp lệ (chỉ nhận viettel | jt), dùng mặc định: viettel`);
}
const SHIP_LABEL_ALIASES = { html: 'gb', gb: 'gb', jt: 'jt' };
const SHIP_LABEL_RAW = String(process.env.SHIP_LABEL || 'gb').trim().toLowerCase();
const SHIP_LABEL = SHIP_LABEL_ALIASES[SHIP_LABEL_RAW] || 'gb';
if (!SHIP_LABEL_ALIASES[SHIP_LABEL_RAW]) {
    console.warn(`[SHIP_LABEL] Giá trị "${process.env.SHIP_LABEL}" không hợp lệ (chỉ nhận GB | JT), dùng mặc định: GB`);
}
const GlobalPageID = '223266991771270';
const GlobalPageID2 = '102116919355833';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const AVA_DIR = path.join(PUBLIC_DIR, 'images', 'ava');
const MESSPIC_DIR = path.join(PUBLIC_DIR, 'images', 'messpic');
const DONHANG_DIR = path.join(PUBLIC_DIR, 'donhang');

module.exports = { JT_PKEY, JT_API_ACCOUNT, JT_CUSTOMER_CODE, JT_PASSWORD, VIETTEL_WEBHOOK_TOKEN, FB_WEBHOOK_VERIFY_TOKEN, REGISTER_PATH, ACTIVE_CARRIER, SHIP_LABEL, GlobalPageID, GlobalPageID2, PUBLIC_DIR, AVA_DIR, MESSPIC_DIR, DONHANG_DIR };
