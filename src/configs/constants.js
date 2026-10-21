const path = require('path');

require('dotenv').config();

const JT_PKEY = process.env.JT_PKEY;
const JT_API_ACCOUNT = process.env.JT_API_ACCOUNT;
const JT_CUSTOMER_CODE = process.env.JT_CUSTOMER_CODE;
const JT_PASSWORD = process.env.JT_PASSWORD;
const VIETTEL_USERNAME = process.env.VIETTEL_USERNAME;
const VIETTEL_PASSWORD = process.env.VIETTEL_PASSWORD;
const VIETTEL_WEBHOOK_TOKEN = process.env.VIETTEL_WEBHOOK_TOKEN;
const FB_WEBHOOK_VERIFY_TOKEN = process.env.FB_WEBHOOK_VERIFY_TOKEN;
const REGISTER_PATH = process.env.REGISTER_PATH;
const GlobalPageID = '223266991771270';
const GlobalPageID2 = '102116919355833';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const AVA_DIR = path.join(PUBLIC_DIR, 'images', 'ava');
const MESSPIC_DIR = path.join(PUBLIC_DIR, 'images', 'messpic');
const DONHANG_DIR = path.join(PUBLIC_DIR, 'donhang');

module.exports = { JT_PKEY, JT_API_ACCOUNT, JT_CUSTOMER_CODE, JT_PASSWORD, VIETTEL_USERNAME, VIETTEL_PASSWORD, VIETTEL_WEBHOOK_TOKEN, FB_WEBHOOK_VERIFY_TOKEN, REGISTER_PATH, GlobalPageID, GlobalPageID2, PUBLIC_DIR, AVA_DIR, MESSPIC_DIR, DONHANG_DIR };
