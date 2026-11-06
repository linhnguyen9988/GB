'use strict';
// Implements express-session's callback Store contract using GB's shared pool.
module.exports = function createStoreClass(session) {
 return class MySQLSessionStore extends session.Store {
  constructor(db, { ttl = 86400000, cleanupInterval = 900000 } = {}) {
   super();
   this.db = db;
   this.ttl = ttl;
   this.ready = null;
   this.cleaning = false;
   this.timer = setInterval(() => this.cleanup().catch(error => {
    console.error('[session-store] cleanup failed:', error.code || 'DB_ERROR');
   }), cleanupInterval);
   this.timer.unref();
  }
  initialize() {
   if (!this.ready) {
    this.ready = this.db.query(`CREATE TABLE IF NOT EXISTS gb_sessions (
     session_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
     expires BIGINT UNSIGNED NOT NULL,
     data MEDIUMTEXT NOT NULL,
     KEY idx_gb_sessions_expires (expires)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(error => {
     this.ready = null;
     throw error;
    });
   }
   return this.ready;
  }
  expires(sess) {
   const expires = sess.cookie && sess.cookie.expires;
   const value = expires ? new Date(expires).getTime() : NaN;
   return Number.isFinite(value) ? value : Date.now() + this.ttl;
  }
  run(operation, callback = () => {}) {
   // Only DB/serialization errors go to the callback, never a second callback
   // if the consumer itself throws.
   Promise.resolve().then(() => this.initialize()).then(operation).then(
    result => callback(null, result), error => callback(error)
   );
  }
  get(sid, callback) {
   this.run(async () => {
    const [[row]] = await this.db.query('SELECT data FROM gb_sessions WHERE session_id = ? AND expires > ?', [sid, Date.now()]);
    return row ? JSON.parse(row.data) : null;
   }, callback);
  }
  set(sid, sess, callback) {
   this.run(async () => {
    await this.db.query('INSERT INTO gb_sessions (session_id, expires, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)', [sid, this.expires(sess), JSON.stringify(sess)]);
   }, callback);
  }
  touch(sid, sess, callback) {
   this.run(async () => {
    // Do not resurrect expired/deleted sessions or overwrite concurrent flash data.
    await this.db.query('UPDATE gb_sessions SET expires = ? WHERE session_id = ? AND expires > ?', [this.expires(sess), sid, Date.now()]);
   }, callback);
  }
  destroy(sid, callback) {
   this.run(async () => { await this.db.query('DELETE FROM gb_sessions WHERE session_id = ?', [sid]); }, callback);
  }
  async cleanup() {
   if (this.cleaning) return;
   this.cleaning = true;
   try {
    await this.initialize();
    // Bounded work, indexed expiration; safe for multiple application workers.
    await this.db.query('DELETE FROM gb_sessions WHERE expires <= ? LIMIT 10000', [Date.now()]);
   } finally { this.cleaning = false; }
  }
  close() { clearInterval(this.timer); }
 };
};
