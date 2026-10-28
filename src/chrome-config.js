'use strict';
require('dotenv').config();
const os = require('os');
const path = require('path');

const isWin = process.platform === 'win32';

const CHROME_PATH = process.env.CHROME_PATH ||
    (isWin ? 'C:\\GB\\node_modules\\puppeteer\\.local-chromium\\win64-1022525\\chrome-win\\chrome.exe' : undefined);

const USER_DATA_DIR = process.env.CHROME_USER_DATA_DIR ||
    (isWin ? 'C:\\Users\\Administrator\\AppData\\Local\\Chromium\\User Data'
           : path.join(os.homedir(), 'chrome-profile'));

const REMOTE_PORT = Number(process.env.CHROME_REMOTE_PORT || 5555);
const BROWSER_URL = `http://127.0.0.1:${REMOTE_PORT}`;

function launchOptions({ headless = true } = {}) {
    const args = [
        '--remote-debugging-port=' + REMOTE_PORT,
        '--profile-directory=Default',
        '--hide-crash-restore-bubble'
    ];
    if (!isWin) {
        args.push('--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage');
    }
    if (process.env.CHROME_USER_AGENT) {
        args.push('--user-agent=' + process.env.CHROME_USER_AGENT);
    }
    const opts = { userDataDir: USER_DATA_DIR, args };
    if (!isWin) {
        opts.handleSIGINT = false;
        opts.handleSIGTERM = false;
        opts.handleSIGHUP = false;
    }
    if (CHROME_PATH) opts.executablePath = CHROME_PATH;
    if (isWin) {
        opts.headless = false;
        if (headless) args.push('--headless=true');
    } else {
        opts.headless = headless;
    }
    return opts;
}

function clearStaleProfileLocks() {
    const fs = require('fs');
    for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
        try { fs.rmSync(path.join(USER_DATA_DIR, f), { force: true }); } catch (e) { /* bỏ qua */ }
    }
}

module.exports = { CHROME_PATH, USER_DATA_DIR, REMOTE_PORT, BROWSER_URL, isWin, launchOptions, clearStaleProfileLocks };