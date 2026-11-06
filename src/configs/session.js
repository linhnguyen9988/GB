'use strict';
const session = require('express-session');
const db = require('./DBConnection');
const MySQLSessionStore = require('../services/mysqlSessionStore')(session);

module.exports = function configureSession() {
 const secret = process.env.SESSION_SECRET;
 if (!secret || Buffer.byteLength(secret) < 32) {
  throw new Error('SESSION_SECRET must be a stable random secret of at least 32 bytes. Set it in .env for all GB workers.');
 }
 const store = new MySQLSessionStore(db);
 const middleware = session({
  name: 'gb.sid', secret, store,
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 86400000 }
 });
 // No MemoryStore fallback: return a controlled failure if MySQL is unavailable.
 return (req, res, next) => {
  store.initialize().then(() => middleware(req, res, error => {
   if (error) {
    console.error('[session-store] request failed:', error.code || 'DB_ERROR');
    return res.status(503).send('Không thể tải phiên làm việc. Vui lòng thử lại sau.');
   }
   return next();
  }), error => {
   console.error('[session-store] initialization failed:', error.code || 'DB_ERROR');
   return res.status(503).send('Không thể khởi tạo phiên làm việc. Vui lòng thử lại sau.');
  });
 };
};
