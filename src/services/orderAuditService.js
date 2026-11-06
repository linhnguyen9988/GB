'use strict';
const SqlString = require('sqlstring');
// Extend the generated INSERT without depending on the optional Viettel account columns.
exports.withCreator = function(sql, user) {
 if (!user || !user.id || !user.username) throw new Error('Missing authenticated creator');
 const match = /^(INSERT INTO lendon \([^)]*)(\) VALUES\()([\s\S]*)(\);)$/i.exec(sql);
 if (!match) throw new Error('Unexpected order INSERT');
 return match[1] + ',created_by_user_id,created_by_username' + match[2] + match[3] + ',' + SqlString.escape(user.id) + ',' + SqlString.escape(user.username) + match[4];
};
