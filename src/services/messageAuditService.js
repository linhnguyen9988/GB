'use strict';
const { randomUUID } = require('crypto');
const db = require('../configs/DBConnection');
function emitAudit(mid, actor) {
 try { require('../socket').getIo().emit('message-audit', { messid: mid, client_message_id: actor.client_message_id || null, sent_by_user_id: actor.user_id, sent_by_username: actor.username }); } catch (_) {}
}
async function attach(mid, actor) {
 await db.query('UPDATE messaging SET sent_by_user_id = ?, sent_by_username = ? WHERE messid = ? AND sender = ? AND recipient = ?', [actor.user_id, actor.username, mid, actor.page_id, actor.customer_id]);
 emitAudit(mid, actor);
}
// Persist before sending. Echo metadata can identify the actor even when the webhook
// arrives before the Graph response, or the Graph response is lost.
exports.send = async function({ user, pageId, customerId, payload, post, clientMessageId }) {
 if (!user || !user.id || !user.username) throw new Error('Missing authenticated sender');
 const key = randomUUID();
 const localId = typeof clientMessageId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(clientMessageId) ? clientMessageId : null;
 const actor = { user_id: user.id, username: user.username, page_id: String(pageId), customer_id: String(customerId), client_message_id: localId };
 await db.query('INSERT INTO message_send_audit (audit_key, user_id, username, page_id, customer_id) VALUES (?, ?, ?, ?, ?)', [key, actor.user_id, actor.username, actor.page_id, actor.customer_id]);
 let response;
 try { response = await post({ ...payload, message: { ...payload.message, metadata: 'gb-audit:' + key + (localId ? ':' + localId : '') } }); }
 catch (error) { return { success: false, response: null, error }; }
 const mid = response.data && response.data.message_id;
 if (mid) {
  try {
   await db.query('UPDATE message_send_audit SET messid = ? WHERE audit_key = ?', [mid, key]);
   await attach(mid, actor);
  } catch (error) {
   // Sending succeeded; never resend because the audit UPDATE failed.
   console.error('[message-audit] reconcile via echo metadata:', error.message);
  }
 }
 return { success: true, response: response.data, error: null };
};
exports.fromEcho = async function(message, sender, recipient) {
 if (!message.is_echo) return null;
 const match = typeof message.metadata === 'string' && /^gb-audit:([0-9a-f-]{36})(?::([a-zA-Z0-9_-]{1,100}))?$/.exec(message.metadata);
 const metadata = match ? match[1] : null;
 const [[actor]] = await db.query('SELECT * FROM message_send_audit WHERE (audit_key = ? OR messid = ?) AND page_id = ? AND customer_id = ? LIMIT 1', [metadata, message.mid, String(sender), String(recipient)]);
 if (actor) {
  actor.client_message_id = match ? match[2] || null : null;
  await db.query('UPDATE message_send_audit SET messid = ? WHERE audit_key = ?', [message.mid, actor.audit_key]);
  await attach(message.mid, actor);
 }
 return actor || null;
};
