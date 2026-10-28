'use strict';
const jwt = require('jsonwebtoken');
const { JWT_SECRET, COOKIE_NAME } = require('../configs/jwtConfig');

function extractToken(req) {
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    if (req.cookies && req.cookies[COOKIE_NAME]) {
        return req.cookies[COOKIE_NAME];
    }
    return null;
}

function apiAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Không có token' });
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (_) {
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn', message: 'Token không hợp lệ hoặc đã hết hạn' });
    }
}

function webAuth(req, res, next) {
    const token = extractToken(req);
    if (!token) {
        return res.redirect('/login');
    }
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (_) {
        res.clearCookie(COOKIE_NAME);
        return res.redirect('/login');
    }
}

module.exports = apiAuth;
module.exports.apiAuth = apiAuth;
module.exports.webAuth = webAuth;
module.exports.extractToken = extractToken;
