'use strict';

const request = require('request');

function facebookRequestJson(options) {
    return new Promise((resolve, reject) => {
        request({ timeout: 15000, ...options, json: true }, (error, response, body) => {
            if (error) {
                const timeout = ['ETIMEDOUT', 'ESOCKETTIMEDOUT'].includes(error.code);
                const failure = new Error(timeout
                    ? 'Facebook chưa phản hồi kịp. Chưa xác nhận được kết quả; kiểm tra cuộc trò chuyện trước khi thử lại.'
                    : 'Lỗi kết nối Facebook. Chưa xác nhận được kết quả; kiểm tra cuộc trò chuyện trước khi thử lại.');
                failure.status = timeout ? 504 : 502;
                failure.code = error.code || 'FACEBOOK_NETWORK_ERROR';
                return reject(failure);
            }
            if (typeof body === 'string') {
                try { body = JSON.parse(body.replace(/^\uFEFF/, '').trim()); }
                catch (_) { body = null; }
            }
            if (!response || !Number.isInteger(response.statusCode) || !body || typeof body !== 'object' || Array.isArray(body)) {
                const failure = new Error('Facebook trả nội dung không hợp lệ. Chưa xác nhận được kết quả; kiểm tra cuộc trò chuyện trước khi thử lại.');
                failure.status = 502;
                failure.code = 'FACEBOOK_INVALID_RESPONSE';
                return reject(failure);
            }
            resolve({ statusCode: response.statusCode, body });
        });
    });
}

module.exports = { facebookRequestJson };
