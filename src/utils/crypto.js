'use strict';
const CryptoJS = require("crypto-js");

function md5ToBase64(input) {
    const md5Hash = CryptoJS.MD5(input);
    const wordArray = md5Hash;
    const base64String = CryptoJS.enc.Base64.stringify(wordArray);
    return base64String;
}

module.exports = { md5ToBase64 };
