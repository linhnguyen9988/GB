function decodeEmoji(s) {
    if (!s) return '';
    return String(s)
        .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function emojiToCode(s) {
    const cps = [];
    for (const ch of String(s || '')) cps.push(ch.codePointAt(0).toString(16).toUpperCase());
    let code = cps.join('-');
    if (code === '2764-FE0F') code = '2764';   
    return code;
}

function codeToEmoji(code) {
    if (!code) return '';
    return String(code).split('-').map(h => String.fromCodePoint(parseInt(h, 16))).join('');
}

module.exports = { decodeEmoji, emojiToCode, codeToEmoji };
