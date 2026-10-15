const TOKEN_PATTERNS = [
    /accessToken="(EAA[A-Za-z0-9]+)"/g,
    /"accessToken":"(EAA[A-Za-z0-9]+)"/g,
    /"access_token":"(EAA[A-Za-z0-9]+)"/g
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function pickTokens(html) {
    const out = [];
    for (const re of TOKEN_PATTERNS) {
        const all = [...String(html).matchAll(re)].map(m => m[1]).reverse();
        for (const t of all) if (!out.includes(t)) out.push(t);
    }
    return out.slice(0, 6);
}

async function fetchUserTokens(page, log = () => { }) {
    await page.goto('https://www.facebook.com/adsmanager', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(4000);
    const url = page.url();
    log('URL sau khi mở adsmanager: ' + url);
    if (/login|checkpoint/.test(url)) return { tokens: [], url, reason: 'Phiên Facebook đã mất hoặc bị checkpoint (' + url + ')' };

    let tokens = [];
    try {
        const html = await page.evaluate(() => fetch(location.href, { credentials: 'include' }).then(r => r.text()));
        tokens = pickTokens(html);
    } catch (e) { log('Cách 1 lỗi: ' + e.message); }

    if (!tokens.length) {
        try {
            await page.goto('view-source:' + url);
            const body = await page.$eval('*', el => el.innerText);
            tokens = pickTokens(body);
        } catch (e) { log('Cách 2 lỗi: ' + e.message); }
    }
    return { tokens, url, reason: tokens.length ? null : 'Không tìm thấy accessToken trong trang adsmanager' };
}

async function validateTokenInPage(page, token) {
    await page.goto('https://graph.facebook.com/v16.0/me?fields=id,name&access_token=' + encodeURIComponent(token),
        { waitUntil: 'domcontentloaded', timeout: 60000 });
    const text = await page.evaluate(() => document.body ? document.body.innerText : '');
    try { return JSON.parse(text); } catch (e) { return { error: { message: 'Phản hồi không phải JSON: ' + String(text).slice(0, 120) } }; }
}

async function refreshUserToken(page, saveToken, log = () => { }) {
    const { tokens, reason } = await fetchUserTokens(page, log);
    if (!tokens.length) return { ok: false, reason };
    log(`Tìm thấy ${tokens.length} token ứng viên, đang kiểm tra...`);
    const errors = [];
    for (const [i, token] of tokens.entries()) {
        const info = await validateTokenInPage(page, token);
        if (info.error) {
            const e = info.error;
            const msg = `#${i + 1} (${token.slice(0, 8)}..., dài ${token.length}): ${e.message}` +
                `${e.type ? ' | type=' + e.type : ''}${e.code ? ' | code=' + e.code : ''}${e.error_subcode ? ' | subcode=' + e.error_subcode : ''}`;
            errors.push(msg);
            log('  ❌ ' + msg);
            continue;
        }
        await saveToken(token);
        log(`  #${i + 1}: ✅ hợp lệ (tài khoản: ${info.name} - ${info.id}), dài ${token.length}, bắt đầu bằng ${token.slice(0, 8)}...`);
        return { ok: true, info, tokenLength: token.length };
    }
    return { ok: false, reason: 'Không token nào được Facebook chấp nhận: ' + errors.join(' ; ') };
}

module.exports = { pickTokens, fetchUserTokens, validateTokenInPage, refreshUserToken };
