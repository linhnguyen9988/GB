'use strict';
const { v2: cloudinary } = require('cloudinary');

let accountIndex = 0;
const cloudinaryAccounts = [1, 2, 3].map(i => ({
    cloud_name: process.env[`CLOUDINARY_${i}_CLOUD_NAME`],
    api_key: process.env[`CLOUDINARY_${i}_API_KEY`],
    api_secret: process.env[`CLOUDINARY_${i}_API_SECRET`]
})).filter(a => a.cloud_name && a.api_key && a.api_secret);

[1, 2, 3].forEach(i => {
    const missing = ['CLOUD_NAME', 'API_KEY', 'API_SECRET']
        .filter(k => !process.env[`CLOUDINARY_${i}_${k}`])
        .map(k => `CLOUDINARY_${i}_${k}`);
    if (missing.length && missing.length < 3) {
        console.warn(`[Cloudinary] Tài khoản ${i} bị bỏ qua vì thiếu env: ${missing.join(', ')}`);
    }
});
console.log(`[Cloudinary] Số tài khoản hợp lệ: ${cloudinaryAccounts.length}/3`);

function getNextCloudinary() {
    if (!cloudinaryAccounts.length) throw new Error('Chưa cấu hình tài khoản Cloudinary nào trong env');
    const account = cloudinaryAccounts[accountIndex % cloudinaryAccounts.length];
    accountIndex++;
    if (accountIndex > 1000000) accountIndex = 0;
    cloudinary.config(account);
    return account.cloud_name;
}

module.exports = { getNextCloudinary };
