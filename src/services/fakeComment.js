'use strict';

function isFakeCommentId(id) {
    if (id === null || id === undefined || id === '') return false;
    return (String(id).match(/_/g) || []).length !== 1;
}

function makeFakeCommentId(liveid, psid) {
    return liveid + '_' + Date.now() + '_' + psid;
}

const REAL_COMMENT_ID_SQL_REGEXP = '^[^_]+_[^_]+$';

module.exports = { isFakeCommentId, makeFakeCommentId, REAL_COMMENT_ID_SQL_REGEXP };
