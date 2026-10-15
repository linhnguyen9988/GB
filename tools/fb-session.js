require('dotenv').config();
const fs = require('fs');
const puppeteer = require('puppeteer');
const cfg = require('../src/chrome-config');

const SAME_SITE = { no_restriction: 'None', none: 'None', lax: 'Lax', strict: 'Strict' };

function toPuppeteerCookie(c) {
    const out = {
        name: c.name,
        value: String(c.value),
        domain: c.domain,
        path: c.path || '/',
        httpOnly: !!c.httpOnly,
        secure: c.secure !== false
    };
    const exp = c.expirationDate !== undefined ? c.expirationDate : c.expires;
    if (!c.session && typeof exp === 'number' && exp > 0) out.expires = Math.floor(exp);
    const ss = SAME_SITE[String(c.sameSite || '').toLowerCase()];
    if (ss) out.sameSite = ss;
    if (out.sameSite === 'None') out.secure = true;
    return out;
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function isBrowserUp() {
    try {
        const b = await puppeteer.connect({ browserURL: cfg.BROWSER_URL });
        b.disconnect();
        return true;
    } catch (e) { return false; }
}

async function stopRunningChromium() {
    if (cfg.isWin || !(await isBrowserUp())) return;
    console.log('Đang tắt Chromium cũ để nạp cookie an toàn...');
    try { require('child_process').execSync(`pkill -TERM -f "remote-debugging-port=${cfg.REMOTE_PORT}"`); } catch (e) {}
    for (let i = 0; i < 20 && (await isBrowserUp()); i++) await sleep(1000);
    await sleep(2000);
}

async function launchOwn() {
    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            cfg.clearStaleProfileLocks();
            console.log(`Mở Chromium mới (lần ${attempt}), profile:`, cfg.USER_DATA_DIR);
            const browser = await puppeteer.launch({ ...cfg.launchOptions({ headless: true }), dumpio: !!process.env.DEBUG_CHROME });
            return { browser, owned: true };
        } catch (e) {
            lastErr = e;
            console.log('Mở Chromium thất bại:', e.message.split('\n')[0]);
            await sleep(3000);
        }
    }
    throw lastErr;
}

async function openBrowser({ forceOwn = false } = {}) {
    if (forceOwn) {
        await stopRunningChromium();
        return launchOwn();
    }
    try {
        const browser = await puppeteer.connect({ browserURL: cfg.BROWSER_URL });
        console.log('Dùng lại Chromium đang chạy ở cổng', cfg.REMOTE_PORT);
        return { browser, owned: false };
    } catch (e) {
        return launchOwn();
    }
}

async function isLoggedIn(page) {
    const cookies = await page.cookies('https://www.facebook.com');
    const hasUser = cookies.some(c => c.name === 'c_user');
    await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    const loginForm = await page.$('input[name="email"], form[action*="login"]');
    const url = page.url();
    const checkpoint = /checkpoint|login/.test(url);
    return { hasUser, loginForm: !!loginForm, checkpoint, url };
}

const TOKEN_PATTERNS = [
    /accessToken="(EAA[A-Za-z0-9]+)"/g,
    /"accessToken":"(EAA[A-Za-z0-9]+)"/g,
    /"access_token":"(EAA[A-Za-z0-9]+)"/g
];

function pickTokens(html) {
    const out = [];
    for (const re of TOKEN_PATTERNS) {
        const all = [...html.matchAll(re)].map(m => m[1]).reverse();
        for (const t of all) if (!out.includes(t)) out.push(t);
    }
    return out.slice(0, 6);
}

async function fetchUserTokens(page) {
    await page.goto('https://www.facebook.com/adsmanager', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise(r => setTimeout(r, 4000));
    console.log('URL sau khi mở adsmanager:', page.url());

    let tokens = [];
    try {
        const html = await page.evaluate(() => fetch(location.href, { credentials: 'include' }).then(r => r.text()));
        tokens = pickTokens(html);
    } catch (e) { console.log('Cách 1 lỗi:', e.message); }

    if (!tokens.length) {
        try {
            await page.goto('view-source:' + page.url());
            const body = await page.$eval('*', el => el.innerText);
            tokens = pickTokens(body);
        } catch (e) { console.log('Cách 2 lỗi:', e.message); }
    }
    return tokens;
}

async function validateTokenInPage(page, token) {
    await page.goto('https://graph.facebook.com/v16.0/me?fields=id,name&access_token=' + encodeURIComponent(token),
        { waitUntil: 'domcontentloaded', timeout: 60000 });
    const text = await page.evaluate(() => document.body ? document.body.innerText : '');
    try { return JSON.parse(text); } catch (e) { return { error: { message: 'Phản hồi không phải JSON: ' + text.slice(0, 120) } }; }
}

async function saveToken(token) {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        charset: 'utf8mb4'
    });
    try {
        await conn.query('INSERT INTO usertoken (id, token) VALUES (1, ?) ON DUPLICATE KEY UPDATE token = ?', [token, token]);
    } finally {
        await conn.end();
    }
}

(async () => {
    const [mode, file] = process.argv.slice(2);
    if (!['import', 'check', 'token'].includes(mode) || (mode === 'import' && !file)) {
        console.log('Cách dùng:\n  node tools/fb-session.js import cookies.json\n  node tools/fb-session.js check\n  node tools/fb-session.js token');
        process.exit(1);
    }

    const { browser, owned } = await openBrowser({ forceOwn: mode === 'import' });
    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        if (mode === 'import') {
            const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
            const list = (Array.isArray(raw) ? raw : raw.cookies || [])
                .filter(c => c && c.name && c.domain && /facebook\.com$/.test(String(c.domain).replace(/^\./, '')))
                .map(toPuppeteerCookie);
            if (!list.length) throw new Error('Không có cookie facebook.com nào trong file.');
            await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.setCookie(...list);
            console.log(`Đã nạp ${list.length} cookie.`);
        }

        if (mode === 'token') {
            const tokens = await fetchUserTokens(page);
            if (!tokens.length) {
                console.log('❌ Không tìm thấy accessToken trong trang adsmanager (chưa đăng nhập, checkpoint, hoặc Facebook đổi cấu trúc trang).');
                process.exitCode = 2;
            } else {
                console.log(`Tìm thấy ${tokens.length} token ứng viên, đang kiểm tra...`);
                let saved = false;
                for (const [i, token] of tokens.entries()) {
                    const info = await validateTokenInPage(page, token);
                    if (info.error) {
                        const e = info.error;
                        console.log(`  #${i + 1} (${token.slice(0, 8)}..., dài ${token.length}): ❌ ${e.message}` +
                            `${e.type ? ' | type=' + e.type : ''}${e.code ? ' | code=' + e.code : ''}${e.error_subcode ? ' | subcode=' + e.error_subcode : ''}`);
                        continue;
                    }
                    await saveToken(token);
                    console.log(`  #${i + 1}: ✅ hợp lệ (tài khoản: ${info.name} - ${info.id}), dài ${token.length}, bắt đầu bằng ${token.slice(0, 8)}...`);
                    console.log('✅ Đã lưu vào bảng usertoken (id=1).');
                    saved = true;
                    break;
                }
                if (!saved) { console.log('❌ Không token nào được Facebook chấp nhận.'); process.exitCode = 3; }
            }
        } else {
            const r = await isLoggedIn(page);
            console.log('Kết quả:', r);
            if (r.hasUser && !r.loginForm && !r.checkpoint) {
                console.log('✅ Đã đăng nhập Facebook, phiên được lưu trong profile.');
            } else if (r.checkpoint) {
                console.log('⚠️ Facebook yêu cầu xác minh (checkpoint). Cần đăng nhập thủ công qua màn hình ảo (xem hướng dẫn).');
            } else {
                console.log('❌ Chưa đăng nhập (cookie hết hạn hoặc bị Facebook từ chối).');
            }
        }
        if (owned || (await browser.pages()).length > 1) await page.close().catch(() => {});
    } finally {
        if (owned) { await sleep(1500); await browser.close(); } else browser.disconnect();
    }
})().catch(e => { console.error('Lỗi:', e.message); process.exit(1); });