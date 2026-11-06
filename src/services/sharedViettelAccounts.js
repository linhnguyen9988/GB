'use strict';
// Compatibility adapter: GB original has no multi-account service. On the Viettel
// version, staff use an admin-managed account without access to its credentials API.
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'viettelAccountService.js');
if (fs.existsSync(file)) {
 const accounts = require(file);
 const db = require('../configs/DBConnection');
 const originalDefault = accounts.getDefaultAccount;
 const originalForOrder = accounts.getAccountForOrder;
 accounts.getDefaultAccount = async function(userId) {
  const own = await originalDefault(userId);
  if (own) return own;
  const [[owner]] = await db.query("SELECT v.app_user_id FROM vietteltoken v JOIN users u ON u.id = v.app_user_id WHERE u.role = 'admin' AND v.is_active = 1 ORDER BY v.is_default DESC, v.userid ASC LIMIT 1");
  return owner ? originalDefault(owner.app_user_id) : null;
 };
 accounts.getAccountForOrder = async function(connection, order) {
  if (!order) return null;
  if (order.viettelaccountid) {
   const [[owner]] = await connection.query('SELECT app_user_id FROM vietteltoken WHERE userid = ? LIMIT 1', [order.viettelaccountid]);
   return owner ? originalForOrder(connection, { ...order, useraccountid: owner.app_user_id }) : null;
  }
  return accounts.getDefaultAccount(order.useraccountid);
 };
}
