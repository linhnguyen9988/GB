'use strict';

const orderCodePattern = '[A-Za-z0-9][A-Za-z0-9._-]{0,63}';
const orderCode = new RegExp('^' + orderCodePattern + '$');
const careUrl = new RegExp('^/care/(' + orderCodePattern + ')/?$', 'i');

function getCarePath(code) {
    return typeof code === 'string' && code === code.trim() && orderCode.test(code) ? '/care/' + code : '';
}

function getCareReturnPath(path) {
    const match = typeof path === 'string' && path === path.trim() && path.match(careUrl);
    return match ? getCarePath(match[1]) : '';
}

function loginPath(returnTo) {
    return returnTo ? '/login?returnTo=' + encodeURIComponent(returnTo) : '/login';
}

module.exports = { getCarePath, getCareReturnPath, loginPath };
