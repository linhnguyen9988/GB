'use strict';
const chromeCfg = require('../chrome-config');
const puppeteer = require('puppeteer');
const { exec } = require('child_process');

const BROWSER_URL = chromeCfg.BROWSER_URL;

let cachedBrowser = null;
let browserPromise = null;

async function getBrowser() {
    if (cachedBrowser && cachedBrowser.isConnected()) return cachedBrowser;

    if (!browserPromise) {
        browserPromise = (async () => {
            let browser;
            try {
                browser = await puppeteer.connect({ browserURL: BROWSER_URL });
            } catch (e) {
                console.log(`Chưa có Chromium nào đang mở ở port ${chromeCfg.REMOTE_PORT}, đang tự mở...`);
                chromeCfg.clearStaleProfileLocks();
                browser = await puppeteer.launch(chromeCfg.launchOptions({ headless: true }));
                await new Promise(r => setTimeout(r, 1500));
            }
            cachedBrowser = browser;
            browser.once('disconnected', () => {
                if (cachedBrowser === browser) cachedBrowser = null;
            });
            return browser;
        })().finally(() => { browserPromise = null; });
    }
    return browserPromise;
}

let shuttingDown = false;
async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[${signal}] Đang đóng Chromium...`);
    try {
        if (cachedBrowser) {
            await Promise.race([cachedBrowser.close(), new Promise(r => setTimeout(r, 8000))]);
        }
    } catch (e) {}
    process.exit(0);
}
if (!chromeCfg.isWin) {
    process.once('SIGINT', () => gracefulShutdown('SIGINT'));
    process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));
}

if (!chromeCfg.isWin && process.env.CHROME_PREWARM !== '0') {
    setTimeout(() => {
        getBrowser().then(() => console.log('Chromium đã sẵn sàng.'))
            .catch(e => console.error('Không mở sẵn được Chromium:', e.message));
    }, 3000);
}

function RestartChromeX() {
    if (!chromeCfg.isWin) {
        exec(`pkill -f "remote-debugging-port=${chromeCfg.REMOTE_PORT}"`);
        return;
    }
    exec(`taskkill /f /im "chrome.exe" /t`)
    setTimeout(() => {
        exec(`"C:\\GB\\node_modules\\puppeteer\\.local-chromium\\win64-1022525\\chrome-win\\chrome.exe" --hide-crash-restore-bubble --kiosk-printing --remote-debugging-port=5555 viettelpost.vn/thong-tin-don-hang`)
    }, 500);
}

module.exports = { getBrowser, RestartChromeX };
