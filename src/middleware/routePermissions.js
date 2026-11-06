'use strict';
const { apiAuth, webAuth, requireAdmin } = require('./jwtAuth');
const { REGISTER_PATH } = require('../configs/constants');
// These operations belong to the former /profile administration screen.
const adminPaths = new Set(['/gettoken', '/getvietteltoken', '/restartchrome', '/getalladdress', '/sendnoti', '/printviettelmanual', '/deleteallpost', '/deletelive', '/scancomment']);
module.exports = function routePermissions(req, res, next) {
 const p = req.path.toLowerCase().replace(/\/+$/, '') || '/';
 if (['/login', '/logout', '/journey'].includes(p) || p.startsWith('/journey/')) return next();
 const auth = req.method === 'GET' && !p.startsWith('/api/') ? webAuth : apiAuth;
 return auth(req, res, () => {
  if (p === '/admin' || p.startsWith('/admin/') || p === REGISTER_PATH || adminPaths.has(p) || p === '/api/viettel/accounts' || p.startsWith('/api/viettel/accounts/')) return requireAdmin(req, res, next);
  return next();
 });
};
