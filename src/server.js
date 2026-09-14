// server.js
'use strict';
require('dotenv').config();
import express, { query } from "express";
import configViewEngine from "./configs/viewEngine";
import initWebRoutes from "./routes/web";
import bodyParser from "body-parser";
import cookieParser from 'cookie-parser';
import session from "express-session";
import connectFlash from "connect-flash";
const fs = require('fs');
const http = require('http');
const https = require('https');
const socket = require('./socket');
const path = require('path');

let app = express();

process.on('unhandledRejection', (reason) => {
    console.error('❌ [Unhandled Rejection]', reason);
});
process.on('uncaughtException', (err) => {
    console.error('❌ [Uncaught Exception]', err);
});

const ACME_CHALLENGE_DIR = 'C:\\wacs-challenges';
if (!fs.existsSync(ACME_CHALLENGE_DIR)) {
    fs.mkdirSync(ACME_CHALLENGE_DIR, { recursive: true });
}
app.get('/.well-known/acme-challenge/:token', (req, res) => {
    const filePath = path.join(ACME_CHALLENGE_DIR, '.well-known', 'acme-challenge', req.params.token);
    console.log('[ACME] Yêu cầu challenge:', req.params.token, '-> đọc file:', filePath);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('[ACME] Không tìm thấy file challenge:', err.message);
            return res.status(404).type('text/plain').send('Not found');
        }
        res.type('text/plain').send(data);
    });
});

app.use((req, res, next) => {
    try {
        decodeURIComponent(req.path);
        next();
    } catch (e) {
        if (e instanceof URIError) {
            //console.error('Lỗi URI (bị chặn sớm):', req.originalUrl);
            return res.status(400).send('Bad Request: Invalid URL');
        }
        next(e);
    }
});
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

configViewEngine(app);

app.use(connectFlash());

var xhub = require('express-x-hub');
app.use(xhub({ algorithm: 'sha1', secret: 'af774e918b2b6336188792ef83fd7660' }));//FB


initWebRoutes(app);

const httpServer = http.createServer((req, res) => {
    if (req.url && req.url.startsWith('/.well-known/acme-challenge/')) {
        return app(req, res);
    }

    const host = req.headers.host;
    let newHost = host;

    if (host && host.startsWith('www.')) {
        newHost = host.substring(4);
    }

    const redirectUrl = `https://${newHost}${req.url}`;

    res.writeHead(301, { Location: redirectUrl });
    res.end();
});
httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('❌ Port 80 đang bị chiếm dụng. Kiểm tra tiến trình node cũ còn chạy: ' +
            'PowerShell -> netstat -ano | findstr :80  rồi taskkill /F /PID <pid>');
    } else {
        console.error('❌ [HTTP Server Error]', err);
    }
});
httpServer.listen(80);
console.log('Listening on port: 80');

const KEY_PATH = 'c:\\aodaigiabao.com-key.pem';
const CERT_PATH = 'c:\\aodaigiabao.com-chain.pem';

var privateKey = fs.readFileSync(KEY_PATH);
var certificate = fs.readFileSync(CERT_PATH);
const httpsServer = https.createServer({
    key: privateKey,
    cert: certificate
}, app);

httpsServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error('❌ Port 443 đang bị chiếm dụng. Kiểm tra tiến trình node cũ còn chạy: ' +
            'PowerShell -> netstat -ano | findstr :443  rồi taskkill /F /PID <pid>');
    } else {
        console.error('❌ [HTTPS Server Error]', err);
    }
});
httpsServer.listen(443, () => {
    console.log('Listening on port: 443');
    socket.initSocket(httpsServer);
});

let reloadTimeout = null;
function reloadCert() {
    clearTimeout(reloadTimeout);
    reloadTimeout = setTimeout(() => {
        try {
            const newKey = fs.readFileSync(KEY_PATH);
            const newCert = fs.readFileSync(CERT_PATH);
            httpsServer.setSecureContext({ key: newKey, cert: newCert });
            console.log('✅ [Cert] Đã reload chứng chỉ mới lúc', new Date().toLocaleString());
        } catch (err) {
            console.error('❌ [Cert] Reload thất bại, sẽ thử lại khi có thay đổi tiếp theo:', err.message);
        }
    }, 3000);
}

fs.watch(path.dirname(KEY_PATH), (eventType, filename) => {
    if (!filename) return;
    const full = path.join(path.dirname(KEY_PATH), filename);
    if (full === KEY_PATH || full === CERT_PATH) {
        reloadCert();
    }
});

app.get('*', function (req, res) {
    res.status(404).render('404.ejs');
});