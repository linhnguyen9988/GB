'use strict';
const DBConnection = require("../configs/DBConnection");
const { getBrowser } = require('./browserService');

const PAGE_TOKEN_REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
const PAGE_TOKEN_FAIL_COOLDOWN_MS = 60 * 60 * 1000;
const pageTokenState = { lastAt: 0, lastOk: false };
let pageTokenInflight = null;

async function _refreshPageTokensViaChrome() {
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.goto('https://www.facebook.com/v11.0/dialog/oauth?response_type=token&client_id=1733556690196497&redirect_uri=https://pages.fm&state=eyJyZWRpcmVjdF90byI6Imh0dHBzOi8vcGFnZXMuZm0iLCJjb3VudHJ5IjoiVk4iLCJsb2NhbGUiOiJ2aSJ9&scope=public_profile,email,pages_manage_metadata,pages_read_engagement,pages_show_list,pages_read_user_content,pages_manage_posts,pages_manage_engagement,read_page_mailboxes,pages_messaging,pages_messaging_subscriptions,ads_read,page_events,instagram_basic,instagram_manage_messages,instagram_manage_comments');

        await Promise.all([
            page.click('#platformDialogForm > div > div.clearfix._ikh > div > div > div > div._6-wr > div > div.x78zum5.x1q0g3np.x2lwn1j.xeuugli.xh8yej3 > div.x3nfvp2.x193iq5w.xxymvpz.xeuugli.x2lah0s.x1iyjqo2.x1r8uery.x13fj5qh > div > span > div > div'),
            page.waitForNavigation({ waitUntil: 'networkidle2' })
        ]);

        const url = page.url();
        if (!url.includes('access_token')) {
            console.log('Loi Gettoken');
            return { ok: false, error: "Lỗi Get Token 2" };
        }
        const token = url.split('token=').pop().split('&')[0];
        await page.goto('https://graph.facebook.com/me/accounts?access_token=' + token);
        const body = await page.$eval('*', (el) => el.innerText);
        const result = JSON.parse(body.replaceAll(" ", ""));
        if (!result || !Array.isArray(result.data)) {
            console.log('Loi Gettoken: me/accounts không trả về danh sách page');
            return { ok: false, error: "Lỗi Get Token 2" };
        }

        const sql = `
        INSERT INTO pageinfo (pageid, accesstoken, name)
        VALUES (?,?,?)
        ON DUPLICATE KEY UPDATE
            accesstoken = VALUES(accesstoken),
            name = VALUES(name)
        `;
        for (var i = 0; i < result.data.length; i++) {
            await DBConnection.query(sql, [
                result.data[i].id,
                result.data[i].access_token,
                result.data[i].name
            ]);
        }
        return { ok: true, data: result };
    } catch (e) {
        console.log(e);
        return { ok: false, error: "Lỗi Get token" };
    } finally {
        await page.close().catch(() => { });
    }
}

function refreshPageTokensViaChrome() {
    if (pageTokenInflight) return pageTokenInflight;
    pageTokenInflight = _refreshPageTokensViaChrome()
        .catch((e) => ({ ok: false, error: e.message }))
        .then((r) => {
            pageTokenState.lastAt = Date.now();
            pageTokenState.lastOk = !!r.ok;
            return r;
        })
        .finally(() => { pageTokenInflight = null; });
    return pageTokenInflight;
}

function isTokenError(err) {
    return !!err && [102, 190, 463, 467].includes(Number(err.code));
}

async function refreshPageTokensOnce() {
    if (process.env.PAGE_TOKEN_AUTO_REFRESH === '0') return false; 
    if (pageTokenInflight) return (await pageTokenInflight).ok;
    const wait = pageTokenState.lastOk ? PAGE_TOKEN_REFRESH_COOLDOWN_MS : PAGE_TOKEN_FAIL_COOLDOWN_MS;
    if (Date.now() - pageTokenState.lastAt < wait) return pageTokenState.lastOk;
    console.log('[PageToken] Token lỗi, đang lấy lại bằng Chrome...');
    const r = await refreshPageTokensViaChrome();
    console.log(r.ok ? `[PageToken] ✅ Đã lấy lại page token (${r.data.data.length} page)` : `[PageToken] ❌ Không lấy lại được: ${r.error}`);
    return r.ok;
}

async function getPageToken(pageid) {
    try {
        const db = DBConnection.promise();
        const [rows] = await db.query(
            'SELECT accesstoken FROM pageinfo WHERE pageid = ? LIMIT 1',
            [pageid]
        );
        return rows.length > 0 ? rows[0].accesstoken : null;
    } catch (err) {
        console.error('Lỗi lấy accesstoken từ pageinfo:', err.message);
        return null;
    }
}

module.exports = { refreshPageTokensViaChrome, isTokenError, refreshPageTokensOnce, getPageToken };
