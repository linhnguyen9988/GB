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

// ── An toàn khi có lỗi bất ngờ: log rõ ràng thay vì tiến trình "chết lặng"
// hoặc treo không dấu vết (rất khó debug qua nodemon).
process.on('unhandledRejection', (reason) => {
    console.error('❌ [Unhandled Rejection]', reason);
});
process.on('uncaughtException', (err) => {
    console.error('❌ [Uncaught Exception]', err);
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
    const host = req.headers.host;
    let newHost = host;

    if (host && host.startsWith('www.')) {
        newHost = host.substring(4);
    }

    const redirectUrl = `https://${newHost}${req.url}`;

    res.writeHead(301, { Location: redirectUrl });
    res.end();
});
// Nếu port 80 đang bị 1 tiến trình node cũ (chưa tắt hẳn do lần trước bị treo/crash)
// chiếm giữ, listen() sẽ lỗi EADDRINUSE. Không bắt lỗi này thì nodemon sẽ báo lỗi
// mơ hồ hoặc tiến trình đứng im ở bước khởi động - đây là log rõ ràng để biết ngay.
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

var privateKey = fs.readFileSync('c:\\aodaigiabao.com-key.pem');
var certificate = fs.readFileSync('c:\\aodaigiabao.com-chain.pem');
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

app.get('*', function (req, res) {
    res.status(404).render('404.ejs');
});