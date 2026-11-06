'use strict';
const jwt = require('jsonwebtoken');
const db = require('../configs/DBConnection');
const { JWT_SECRET, COOKIE_NAME } = require('../configs/jwtConfig');
function extractToken(req) {
 const h = req.headers.authorization;
 return h && h.startsWith('Bearer ') ? h.slice(7) : req.cookies && req.cookies[COOKIE_NAME];
}
async function loadUser(req) {
 const token = extractToken(req);
 if (!token) return null;
 let claims;
 try { claims = jwt.verify(token, JWT_SECRET); } catch (_) { return null; }
 const [[user]] = await db.query('SELECT id, username, fullname, role, auth_version FROM users WHERE id = ?', [claims.id]);
 if (!user || !['admin', 'staff'].includes(user.role) || Number(claims.auth_version || 0) !== Number(user.auth_version)) return null;
 return user;
}
function authenticate(web) {
 return async (req, res, next) => {
  try {
   req.user = await loadUser(req);
   if (!req.user) {
    if (web) { res.clearCookie(COOKIE_NAME); return res.redirect('/login'); }
    return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập lại' });
   }
   res.locals.user = req.user;
   return next();
  } catch (error) { return res.status(503).json({ success: false, message: 'Không thể xác minh tài khoản' }); }
 };
}
function requireAdmin(req, res, next) {
 if (!req.user || req.user.role !== 'admin') return res.status(403).json({ success: false, message: 'Chỉ admin được thực hiện tác vụ này' });
 return next();
}
const apiAuth = authenticate(false), webAuth = authenticate(true);
module.exports = apiAuth;
Object.assign(module.exports, { apiAuth, webAuth, extractToken, loadUser, requireAdmin });
