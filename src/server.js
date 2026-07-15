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
httpServer.listen(80);
console.log('Listening on port: 80');

var privateKey = fs.readFileSync('c:\\aodaigiabao.com-key.pem');
var certificate = fs.readFileSync('c:\\aodaigiabao.com-chain.pem');
const httpsServer = https.createServer({
    key: privateKey,
    cert: certificate
}, app);

httpsServer.listen(443, () => {
    console.log('Listening on port: 443');
    socket.initSocket(httpsServer);
});

app.get('*', function (req, res) {
    res.status(404).render('404.ejs');
});