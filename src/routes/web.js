import express from "express";

// ── API routes (backend 2 đã gộp) ──────────────────────────
const apiAuth = require('./api/auth');
const apiDashboard = require('./api/dashboard');
const apiMessages = require('./api/messages');
const apiLivecomments = require('./api/livecomments');
const apiCustomers = require('./api/customers');
const apiOrders = require('./api/orders');
const apiPages = require('./api/pages');
const apiNotifications = require('./api/notifications');
// ────────────────────────────────────────────────────────────

import dienNuocController from "../controllers/dienNuocController";
import orderController from "../controllers/orderController";
import profileController from "../controllers/profileController";
import registerController from "../controllers/registerController";
import loginController from "../controllers/loginController";
const jwtAuth = require('../middleware/jwtAuth');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_this';

// Middleware cho web browser: không có token thì redirect /login thay vì 401
const webAuth = (req, res, next) => {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) token = authHeader.slice(7);
    if (!token && req.cookies && req.cookies.token) token = req.cookies.token;
    if (!token) return res.redirect('/login');
    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (_) {
        res.clearCookie('token');
        return res.redirect('/login');
    }
};
import auth from "../validation/authValidation";
import DBConnection from "../configs/DBConnection";
import loadcommentController from "../controllers/loadcommentController";
import readcommentController from "../controllers/readcommentController";
const puppeteer = require('puppeteer');
const fs = require('fs');
const qs = require('qs');
const StringBuilder = require('node-stringbuilder');
const { exec } = require('child_process');
var request = require('request');
var SqlString = require('sqlstring');
var CryptoJS = require("crypto-js");
const socket = require('../socket');
const { pushToUser } = require('../socket');
const multer = require('multer');
const sharp = require('sharp');
const upload = multer({ dest: 'uploads/' });
const axios = require('axios');
const GlobalPageID = '223266991771270';
const GlobalPageID2 = '102116919355833';
const mime = require('mime-types');
const path = require('path');
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');

import { v2 as cloudinary } from 'cloudinary';

const CHROME_PATH = 'C:\\GB\\node_modules\\puppeteer\\.local-chromium\\win64-1022525\\chrome-win\\chrome.exe';
const USER_DATA_DIR = 'C:\\Users\\Administrator\\AppData\\Local\\Chromium\\User Data';
const REMOTE_PORT = 5555;
const BROWSER_URL = `http://127.0.0.1:${REMOTE_PORT}`;

let launchingPromise = null;

async function getBrowser() {
    try {
        const browser = await puppeteer.connect({ browserURL: BROWSER_URL });
        return browser;
    } catch (e) {
        console.log('Chưa có Chromium nào đang mở ở port 5555, đang tự mở...');

        if (!launchingPromise) {
            launchingPromise = puppeteer.launch({
                headless: false,
                executablePath: CHROME_PATH,
                userDataDir: USER_DATA_DIR,
                args: [
                    '--remote-debugging-port=' + REMOTE_PORT,
                    '--profile-directory=Default',
                    '--hide-crash-restore-bubble'
                ]
            }).finally(() => {
                launchingPromise = null;
            });
        }
        const browser = await launchingPromise;

        await new Promise(r => setTimeout(r, 1500));
        return browser;
    }
}

function delay(time) { return new Promise(resolve => setTimeout(resolve, time)); }
function formatFbTime(fbTimeString) {
    const date = new Date(fbTimeString);
    const localOffsetMinutes = date.getTimezoneOffset();
    const vietnamOffsetMinutes = -420;
    const offsetDifferenceMinutes = localOffsetMinutes - vietnamOffsetMinutes;
    const vietnamTime = new Date(date.getTime() - (offsetDifferenceMinutes * 60 * 1000));
    const hour = vietnamTime.getHours();
    const timeCode = (hour >= 2 && hour < 19) ? 'S' : 'T';
    const day = String(vietnamTime.getDate()).padStart(2, '0');
    const month = String(vietnamTime.getMonth() + 1).padStart(2, '0');
    const year = String(vietnamTime.getFullYear()).slice(2);
    return `${timeCode} - ${day}/${month}/${year}`;
}

async function ShareToPage2(message, videoid) {
    console.log('Sharing...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    const url = 'https://graph.facebook.com/v20.0/102116919355833/feed';

    const params = new URLSearchParams();
    params.append('message', message);
    params.append('link', `https://www.facebook.com/100040645522129/videos/${videoid}`);
    params.append('access_token', PAGE_ACCESS_TOKEN2);

    try {
        const response = await axios.post(url, params);
        console.log(response.data);
    } catch (error) {
        if (error.response) {
            console.error('API Error:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

async function GetUserToken() {
    const browser = await getBrowser();
    const page2 = await browser.newPage();
    await page2.bringToFront();

    await page2.goto('https://facebook.com/adsmanager');
    await page2.goto('view-source:' + page2.url());
    const body = await page2.$eval('*', (el) => el.innerText);
    var token = body.split('accessToken="').pop().split('"')[0];

    /*
     await page2.goto('view-source:https://business.facebook.com/content_management');
     const body = await page2.$eval('*', (el) => el.innerText);
     var token = 'EAAG' + body.split('["EAAG').pop().split('"')[0];
     */
    UpdateUToken(1, token);
    await page2.goto('https://graph.facebook.com/me/accounts?access_token=' + token);
    const bodypage = await page2.$eval('*', (el) => el.innerText);
    const bpjson = JSON.parse(bodypage.replaceAll(" ", "").replaceAll(/\n/g, " "));
    for (let z = 0; z < bpjson.data.length; z++) {
        var pagetoken = bpjson.data[z].access_token;
        console.log(bpjson.data[z].id + '->' + pagetoken)
    }
    //TODO: luu vao DB
    setTimeout(() => {
        page2.close();
    }, 500);
}

function RestartChromeX() {
    exec(`taskkill /f /im "chrome.exe" /t`)
    setTimeout(() => {
        //exec(`"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --hide-crash-restore-bubble --remote-debugging-port=22222 --disable-gpu --kiosk-printing 127.0.0.1`)
        //exec(`"C:\\Users\\tonyl\\Desktop\\GoogleChromePortable\\GoogleChromePortable.exe" --hide-crash-restore-bubble --remote-debugging-port=22222 --disable-gpu --kiosk-printing aodaigiabao.com`)
        exec(`"C:\\GB\\node_modules\\puppeteer\\.local-chromium\\win64-1022525\\chrome-win\\chrome.exe" --hide-crash-restore-bubble --kiosk-printing --remote-debugging-port=5555 viettelpost.vn/thong-tin-don-hang`)
    }, 500);
}

function md5ToBase64(input) {
    const md5Hash = CryptoJS.MD5(input);
    const wordArray = md5Hash;
    const base64String = CryptoJS.enc.Base64.stringify(wordArray);
    return base64String;
}

async function CancelOrderJT(orderid) {
    const pkey = '47e60fbcc61544dcb85d30acd39d5e66';
    const apiAccount = '813258343706625024';
    const oderjson = JSON.stringify({
        "customerCode": "251LC12614",
        "password": "F55D925970D227346C2422F74FE0A9C3",
        "txlogisticId": orderid,
        "reason": "Shop hủy đơn"
    });

    const digest = md5ToBase64(oderjson + pkey);
    const query = 'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/cancelOrder';

    try {
        const response = await axios({
            method: 'post',
            url: query,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'apiAccount': apiAccount,
                'digest': digest,
                'timestamp': new Date().getTime().toString()
            },
            data: qs.stringify({
                'bizContent': oderjson
            })
        });

        const body = response.data;

        if (body.msg === 'success') {
            const info = `Shop hủy đơn: ${body.data.billCode} -> ${body.data.txlogisticId}`;
            console.log(info);
            return info;
        } else {
            console.log(body.msg);
            return body.msg;
        }

    } catch (error) {
        console.error('Lỗi khi gọi API J&T:', error.message);
        return 'Lỗi kết nối API';
    }
}

function PrintBillJT(orderid) {
    const pkey = '47e60fbcc61544dcb85d30acd39d5e66';
    var apiAccount = '813258343706625024';
    var oderjson = `{"customerCode":"251LC12614","password":"F55D925970D227346C2422F74FE0A9C3","txlogisticId":"${orderid}"}`;
    var digest = md5ToBase64(oderjson + pkey);
    var query = 'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/printOrder';
    request({
        url: encodeURI(query),
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'apiAccount': apiAccount,
            'digest': digest,
            'timestamp': new Date().getTime()
        },
        form: {
            'bizContent': oderjson
        }
    }, async function (error, response, bodyx) {
        const body = JSON.parse(bodyx);
        if (body.msg == 'success') {
            (async () => {
                const browser = await getBrowser();
                const page2 = await browser.newPage();
                await page2.bringToFront();
                await page2.setContent(`
                    <html>
                    <body style="margin:0;padding:0; height:100%;">
                        <iframe src="data:application/pdf;base64,${body.data.base64EncodeContent}" style="width:100%; height:100%; border:none;"></iframe>
                    </body>
                    </html>
                `, { waitUntil: 'load' });
                await delay(500);
                await page2.evaluate(() => { window.print(); });
                setTimeout(() => {
                    page2.close();
                }, 500);
            })();
        } else {
            console.log(body.msg);
        }
    });
}

function PrintBillViettel(realorderid) {//chi dung cho don day tu API, don tao bang tay ko in dc
    DBConnection.query(` SELECT * FROM vietteltoken`,
        async function (error, data) {
            if (data.length > 0) {
                var token = data[0].token;
                var expiration = data[0].expiration;
                var query = 'https://partner.viettelpost.vn/v2/order/printing-code';
                request({
                    url: encodeURI(query),
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'token': token
                    },
                    body: JSON.stringify({
                        "EXPIRY_TIME": expiration, "ORDER_ARRAY": [realorderid]//het han nam 2028
                    })

                }, async function (error, response, bodyx) {
                    var body = JSON.parse(bodyx.replaceAll(" ", "").replaceAll(/\n/g, " "));
                    const printcode = body.message;
                    if (body.error == true) {
                        console.log('Don nay ko len bang API')
                        return;
                    }
                    const browser = await getBrowser();
                    const page2 = await browser.newPage();
                    await page2.bringToFront();
                    await page2.goto(`https://digitalize.viettelpost.vn/DigitalizePrint/report.do?type=100&bill=${printcode}&showPostage=1`);
                    await page2.evaluate(() => { window.print(); })
                    setTimeout(() => {
                        page2.close();
                    }, 500);
                });
            }
        });
}

async function GetViettelToken() {
    const loginUrl = 'https://partner.viettelpost.vn/v2/user/Login';
    const ownerConnectUrl = 'https://partner.viettelpost.vn/v2/user/ownerconnect';

    const credentials = {
        "USERNAME": "0559955435",
        "PASSWORD": "Linh@123456"
    };

    try {
        const loginRes = await axios.post(loginUrl, credentials, {
            headers: { 'Content-Type': 'application/json' }
        });

        const loginData = loginRes.data;

        if (loginRes.status === 200 && loginData.data && loginData.data.token) {
            console.log('Đã có token tạm, đang lấy token dài hạn...');
            const tokenRes = await axios.post(ownerConnectUrl, credentials, {
                headers: {
                    'Content-Type': 'application/json',
                    'token': loginData.data.token
                }
            });

            const bodytoken = tokenRes.data;

            if (bodytoken.status === 200) {
                const vtoken = SqlString.format(
                    'INSERT IGNORE INTO vietteltoken (userid, token, expiration) VALUES(?,?,?) ON DUPLICATE KEY UPDATE token=?, expiration=?;',
                    [bodytoken.data.userId, bodytoken.data.token, bodytoken.data.expired, bodytoken.data.token, bodytoken.data.expired]
                );

                try {
                    await DBConnection.query(vtoken);
                    console.log('Cập nhật Viettel Token thành công!');
                } catch (sqlError) {
                    console.error('ERROR: SQL ERROR', sqlError.message);
                }
            } else {
                console.log('Lỗi lấy token dài hạn:', bodytoken.message || bodytoken);
            }
        } else {
            console.log('Đăng nhập thất bại:', loginData);
        }

    } catch (error) {
        if (error.response) {
            console.error('Lỗi API Viettel:', error.response.data);
        } else {
            console.error('Lỗi kết nối:', error.message);
        }
    }
}

function addZero(x, n) {
    while (x.toString().length < n) {
        x = "0" + x;
    }
    return x;
}
function CreateOrderID() {
    var today = new Date();
    var dd = String(today.getDate()).padStart(2, '0');
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var yyyy = today.getFullYear().toString().slice(2);
    let h = addZero(today.getHours(), 2);
    let m = addZero(today.getMinutes(), 2);
    let s = addZero(today.getSeconds(), 2);
    let ms = addZero(today.getMilliseconds(), 3);
    return `${yyyy}${mm}${dd}${h}${m}${s}${ms}`;
}

async function WaitUntil(conditionFunction) {
    const poll = resolve => {
        if (conditionFunction()) resolve();
        else setTimeout(_ => poll(resolve), 100);
    }
    return new Promise(poll);
}

async function UpdateUToken(id, token) {
    var utoken = SqlString.format('INSERT IGNORE INTO usertoken (id,token) VALUES(?,?) ON DUPLICATE KEY UPDATE token=?;', [id, token, token]);
    try {
        DBConnection.query(utoken);
    } catch (e) {
        console.log('ERROR: SQL ERROR');
    }
}

process.on('uncaughtException', function (error) {
    console.log(error.stack);
});


function LocDau(str) {
    return str.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

const getRecentCommentIdsFromDB = (userId) => {
    return new Promise((resolve, reject) => {
        if (!userId) {
            console.warn('userId không được cung cấp, không thể truy vấn database.');
            return resolve([]);
        }
        const sql = `SELECT commentid FROM livecomment WHERE userid = ? ORDER BY idx DESC LIMIT 10`;
        DBConnection.query(sql, [userId], (err, rows) => {
            if (err) {
                console.error('Lỗi khi truy vấn database để lấy comment ID:', err);
                return reject(err);
            }

            if (rows && rows.length > 0) {
                resolve(rows.map(row => row.commentid));
            } else {
                console.log(`Không tìm thấy comment nào cho userId: ${userId}`);
                resolve([]);
            }
        });
    });
};

let router = express.Router();
const FormData = require('form-data');
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const PAGE_ACCESS_TOKEN2 = process.env.PAGE_ACCESS_TOKEN2;

async function tryInsertMessageAsComment(khachhang, sender, text, timemess, pageid, io) {
    try {
        const db = DBConnection.promise();

        // Lấy live mới nhất (theo id auto increment), kiểm tra có đang LIVE không
        const [liveRows] = await db.query(
            `SELECT liveid, status FROM postlive ORDER BY id DESC LIMIT 1`
        );
        if (!liveRows.length || liveRows[0].status !== 'LIVE') return;

        const liveid = liveRows[0].liveid;

        // Lấy thông tin khách hàng
        const [cusRows] = await db.query(
            `SELECT * FROM khachhang WHERE userid = ? LIMIT 1`, [khachhang]
        );
        const cus = cusRows.length > 0 ? cusRows[0] : null;
        const fbname = cus ? (cus.fbname || 'Khách hàng') : 'Khách hàng';

        // Tạo commentid giả dạng liveid_timestamp_userid
        const fakeCommentId = `${liveid}_${Date.now()}_${khachhang}`;

        const dateCreate = new Date().toLocaleString("en-US", { timeZone: "Asia/Saigon" });

        const sqlInsert = SqlString.format(
            `INSERT IGNORE INTO livecomment 
            (commentid, liveid, userid, name, message, chot, gia, timecomment, datecreate, luotin, count, app, pageid, realfbid, parent_id) 
            VALUES (?, ?, ?, ?, ?, '', '', 0, ?, 0, 0, 'Messenger', ?, ?, '')`,
            [fakeCommentId, liveid, khachhang, fbname, text || '', dateCreate, pageid, cus ? (cus.realfbid || '') : '']
        );

        const [insertResult] = await db.query(sqlInsert);
        const idx = insertResult.insertId;

        // Emit về FE như một comment bình thường
        const newCommentData = {
            idx: idx,
            picture: cus ? (cus.avalink || '') : '',
            cmtid: fakeCommentId,
            liveid: liveid,
            pageid: pageid,
            fbname: fbname,
            message: text || '',
            timelocal: dateCreate,
            customerInfo: cus || {},
            fromMessenger: true
        };

        io.to(liveid).emit('new-comment', newCommentData);
        console.log(`[Messenger→Live] ${fbname}: "${text}" → live ${liveid}`);

    } catch (err) {
        console.error('[Messenger→Live] Lỗi:', err.message);
    }
}

let initWebRoutes = (app) => {
    router.post('/api/send-message', (req, res) => {
        upload.single('image')(req, res, async (err) => {
            if (err) {
                console.error('Lỗi khi upload file:', err.message);
                return res.status(400).json({ success: false, error: err.message });
            }

            const { customerId, message, currentPageID } = req.body;
            const file = req.file;
            let attachmentId = null;
            let token = '';
            if (currentPageID == GlobalPageID) {
                token = PAGE_ACCESS_TOKEN;
            }
            if (currentPageID == GlobalPageID2) {
                token = PAGE_ACCESS_TOKEN2;
            }
            const sendMessageWithPayload = async (payload) => {
                try {
                    const response = await axios.post(
                        `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
                        payload
                    );
                    return { success: true, response: response.data, error: null };
                } catch (error) {
                    return { success: false, response: null, error: error };
                }
            };

            const sendDirectMessage = async (imageContent, textContent) => {
                let imageSent = false;
                let textSent = false;
                if (imageContent) {
                    let payload = {
                        recipient: { id: customerId },
                        messaging_type: 'UPDATE',
                        message: { attachment: { type: 'image', payload: { attachment_id: imageContent } } }
                    };
                    const result = await sendMessageWithPayload(payload);
                    if (result.success) {
                        imageSent = true;
                    } else {
                        const errorData = (result.error && result.error.response && result.error.response.data) ? result.error.response.data.error : null;
                        if (errorData && (errorData.code === 2018286 || errorData.code === 10)) {
                            payload = Object.assign({}, payload, { messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' });
                            const retryResult = await sendMessageWithPayload(payload);
                            if (retryResult.success) {
                                imageSent = true;
                            }
                        }
                    }
                }
                if (textContent) {
                    let payload = {
                        recipient: { id: customerId },
                        messaging_type: 'UPDATE',
                        message: { text: textContent }
                    };
                    const result = await sendMessageWithPayload(payload);
                    if (result.success) {
                        textSent = true;
                    } else {
                        const errorData = (result.error && result.error.response && result.error.response.data) ? result.error.response.data.error : null;
                        if (errorData && (errorData.code === 2018286 || errorData.code === 10)) {
                            payload = Object.assign({}, payload, { messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' });
                            const retryResult = await sendMessageWithPayload(payload);
                            if (retryResult.success) {
                                textSent = true;
                            }
                        }
                    }
                }
                const success = (imageContent && imageSent) || (textContent && textSent);
                const message = (imageSent && textSent) ? "Đã gửi cả ảnh và văn bản thành công." :
                    (imageSent) ? "Gửi ảnh thành công, nhưng văn bản thất bại." :
                        (textSent) ? "Gửi văn bản thành công, nhưng ảnh thất bại." :
                            "Không thể gửi cả ảnh và văn bản.";

                return { success, message };
            };

            const sendPrivateReply = async (imageContent, textContent) => {
                try {
                    const recentCommentIds = await getRecentCommentIdsFromDB(customerId);
                    if (!recentCommentIds || recentCommentIds.length === 0) {
                        return {
                            success: false,
                            message: "Không tìm thấy bình luận nào gần đây để Private Reply.",
                            imageStatus: imageContent ? 'failed' : 'not_provided',
                            textStatus: textContent ? 'failed' : 'not_provided'
                        };
                    }

                    let imageSent = !imageContent;
                    let textSent = !textContent;
                    let finalError = null;

                    for (const commentId of recentCommentIds) {
                        if (imageSent && textSent) break;
                        console.log(`Private Reply: ${commentId}`);
                        if (imageContent && !imageSent) {
                            const imagePayload = {
                                messaging_type: 'RESPONSE',
                                recipient: { comment_id: commentId },
                                message: { attachment: { type: 'image', payload: { attachment_id: imageContent } } }
                            };
                            const imageResult = await sendMessageWithPayload(imagePayload);
                            if (imageResult.success) {
                                console.log(`Thành công (P): ${commentId}`);
                                imageSent = true;
                            } else {
                                finalError = imageResult.error;
                            }
                        }
                        if (textContent && !textSent) {
                            const textPayload = {
                                messaging_type: 'RESPONSE',
                                recipient: { comment_id: commentId },
                                message: { text: textContent }
                            };
                            const textResult = await sendMessageWithPayload(textPayload);
                            if (textResult.success) {
                                console.log(`Thành công (T): ${commentId}`);
                                textSent = true;
                            } else {
                                finalError = textResult.error;
                            }
                        }
                    }
                    const finalSuccess = imageSent && textSent;
                    let finalMessage = "";
                    if (imageContent && textContent) {
                        if (imageSent && textSent) finalMessage = "Tin nhắn (ảnh và văn bản) đã được gửi thành công qua Private Reply.";
                        else if (imageSent) finalMessage = "Đã gửi ảnh thành công, nhưng không thể gửi văn bản qua Private Reply.";
                        else if (textSent) finalMessage = "Đã gửi văn bản thành công, nhưng không thể gửi ảnh qua Private Reply.";
                        else finalMessage = "Không thể gửi cả ảnh và văn bản qua Private Reply.";
                    } else if (imageContent) {
                        finalMessage = imageSent ? "Tin nhắn ảnh đã được gửi thành công qua Private Reply." : "Không thể gửi tin nhắn ảnh qua Private Reply.";
                    } else if (textContent) {
                        finalMessage = textSent ? "Tin nhắn văn bản đã được gửi thành công qua Private Reply." : "Không thể gửi tin nhắn văn bản qua Private Reply.";
                    }

                    return {
                        success: finalSuccess,
                        message: finalMessage,
                        error: finalError,
                        imageStatus: imageContent ? (imageSent ? 'sent' : 'failed') : 'not_provided',
                        textStatus: textContent ? (textSent ? 'sent' : 'failed') : 'not_provided'
                    };
                } catch (dbError) {
                    console.error('Lỗi khi lấy comment ID từ DB:', dbError.message);
                    return {
                        success: false,
                        message: "Lỗi khi truy xuất dữ liệu bình luận từ hệ thống.",
                        imageStatus: imageContent ? 'failed' : 'not_provided',
                        textStatus: textContent ? 'failed' : 'not_provided'
                    };
                }
            };

            try {
                if (file && file.path) {
                    const optimizedImagePath = file.path + '_optimized.jpg';
                    try {
                        await sharp(file.path)
                            .rotate()
                            .resize(1024, 1024, { fit: sharp.fit.inside, withoutEnlargement: true })
                            .jpeg({ quality: 70 })
                            .toFile(optimizedImagePath);
                        fs.unlinkSync(file.path);
                        const form = new FormData();
                        form.append('message', JSON.stringify({ attachment: { type: 'image', payload: { is_reusable: true } } }));
                        form.append('filedata', fs.createReadStream(optimizedImagePath));
                        const uploadResponse = await axios.post(
                            `https://graph.facebook.com/v19.0/me/message_attachments?access_token=${token}`,
                            form,
                            { headers: form.getHeaders() }
                        );
                        attachmentId = uploadResponse.data.attachment_id;
                        fs.unlinkSync(optimizedImagePath);
                    } catch (optimizationError) {
                        console.error('Lỗi khi tối ưu hóa hoặc upload ảnh:', optimizationError.message);
                        return res.status(500).json({ success: false, error: 'Lỗi khi xử lý hình ảnh.' });
                    }
                }
                if (!attachmentId && !message) {
                    return res.json({ success: true, message: "Không có nội dung để gửi." });
                }
                const directMessageResult = await sendDirectMessage(attachmentId, message);
                if (directMessageResult.success) {
                    return res.json({ success: true, message: directMessageResult.message });
                }
                const privateReplyResult = await sendPrivateReply(attachmentId, message);
                if (privateReplyResult.success) {
                    return res.json({
                        success: true,
                        message: privateReplyResult.message,
                        imageStatus: privateReplyResult.imageStatus,
                        textStatus: privateReplyResult.textStatus
                    });
                } else {
                    return res.status(400).json({
                        success: false,
                        error: privateReplyResult.message,
                        imageStatus: privateReplyResult.imageStatus,
                        textStatus: privateReplyResult.textStatus
                    });
                }
            } catch (error) {
                console.error('Lỗi server tổng quát:', error.response ? JSON.stringify(error.response.data) : error.message);
                res.status(500).json({ success: false, error: 'Lỗi server khi xử lý tin nhắn.' });
            }
        });
    });

    router.get('/api/last-messages', async (req, res) => {
        const sqlQuery = `
    SELECT 
    t1.messid, t1.sender, t1.recipient, t1.message, t1.time, t1.timestamp, t1.image, t1.is_echo, 
    k.fbname AS ten_khach, k.label AS label, k.note AS note, k.id AS khid
FROM messaging t1
INNER JOIN (
    -- Bước này cực quan trọng: Chỉ lấy 100 ID lớn nhất thỏa mãn điều kiện
    SELECT MAX(id) AS max_id
    FROM (
        (SELECT id, recipient AS khach_id
         FROM messaging 
         WHERE sender IN (?, ?)
         ORDER BY id DESC LIMIT 100)
        
        UNION ALL
        
        (SELECT id, sender AS khach_id
         FROM messaging 
         WHERE recipient IN (?, ?)
         ORDER BY id DESC LIMIT 100)
    ) AS tmp
    GROUP BY khach_id
    ORDER BY max_id DESC
    LIMIT 100
) AS t2 ON t1.id = t2.max_id
LEFT JOIN khachhang k ON k.userid = IF(t1.sender IN (?, ?), t1.recipient, t1.sender)
ORDER BY t1.id DESC;
    `;

        const queryParams = [
            GlobalPageID, GlobalPageID2, // Cho: WHERE sender IN (?, ?)
            GlobalPageID, GlobalPageID2, // Cho: OR recipient IN (?, ?)
            GlobalPageID, GlobalPageID2  // Cho: IF(t1.sender IN (?, ?)
        ];

        DBConnection.query(sqlQuery, queryParams, (err, results) => {
            if (err) {
                console.error('Lỗi truy vấn cơ sở dữ liệu:', err);
                return res.status(500).json({ error: 'Không thể lấy dữ liệu tin nhắn' });
            }

            const processedResults = results.map(row => {
                if (row.image) {
                    row.images = row.image.split(';').filter(url => url.trim() !== '');
                } else {
                    row.images = [];
                }
                return row;
            });
            res.json(processedResults);
        });
    });

    router.get('/api/messages/:customerId', function (req, res) {
        const customerId = req.params.customerId;
        if (!customerId) {
            return res.status(400).json({ error: 'Customer ID is required.' });
        }
        const offset = parseInt(req.query.offset, 10) || 0;
        let limit = parseInt(req.query.limit, 10) || 10;

        if (limit > 50) {
            limit = 50;
        }
        const queryMessages = SqlString.format(
            'SELECT * FROM messaging WHERE sender = ? OR recipient = ? ORDER BY id DESC LIMIT ? OFFSET ?;',
            [customerId, customerId, limit, offset]
        );

        DBConnection.query(queryMessages, function (error, messages) {
            if (error) {
                console.error('Lỗi khi lấy tin nhắn:', error);
                return res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu' });
            }
            const messageMessids = messages.map(msg => msg.messid);

            if (messageMessids.length === 0) {
                return res.status(200).json([]);
            }

            const queryReactions = SqlString.format(
                'SELECT messid, reaction_emoji, COUNT(*) as count FROM reactions WHERE messid IN (?) GROUP BY messid, reaction_emoji;',
                [messageMessids]
            );

            DBConnection.query(queryReactions, function (err, reactions) {
                if (err) {
                    console.error('Lỗi khi lấy reactions:', err);
                    return res.status(500).json({ error: 'Lỗi server khi lấy dữ liệu reactions' });
                }

                const reactionsMap = new Map();
                reactions.forEach(reaction => {
                    if (!reactionsMap.has(reaction.messid)) {
                        reactionsMap.set(reaction.messid, []);
                    }
                    reactionsMap.get(reaction.messid).push({
                        emoji: reaction.reaction_emoji,
                        count: reaction.count
                    });
                });

                const messagesWithReactions = messages.map(msg => {
                    const messageReactions = reactionsMap.get(msg.messid);
                    msg.reactions = messageReactions || [];
                    return msg;
                });

                res.status(200).json(messagesWithReactions);
            });
        });
    });
    //jt webhooks
    router.post('/jtex', async function (req, res) {
        const db = DBConnection.promise();
        res.json({ "code": "1", "msg": "success", "data": null });

        try {
            const { bizContent } = req.body;
            if (!bizContent) return;

            const data = JSON.parse(bizContent);
            const billCode = data.billCode;
            const details = data.details[0];

            const statusMapVn = {
                103: "Tạo đơn thành công",
                105: "Đã hủy đơn",
                106: "Bưu tá đã lấy hàng",
                109: "Xuất kho trung chuyển",
                110: "Hàng đã đến bưu cục",
                112: "Đang giao hàng",
                113: "Giao hàng thành công",
                116: "Đang chuyển hoàn",
                117: "Đã ký nhận hoàn trả",
                118: "Kiện vấn đề (Giao)",
                120: "Kiện vấn đề (Hoàn)"
            };

            let currentTypeName = statusMapVn[details.scanTypeCode] || details.scanTypeName || "Hành trình mới";
            if (currentTypeName == '中心到件') currentTypeName = 'Hàng đến kho TTKT';
            else if (currentTypeName == '取件失败') currentTypeName = 'Nhận hàng không thành công';

            let scanbyphone = details.scanByContact;
            if (scanbyphone) scanbyphone = scanbyphone.replace("+84", "0");

            const waybillParams = [
                billCode,
                details.scanByCode || null,
                scanbyphone || null,
                details.scanByName || null,
                details.scanNetworkArea || null,
                details.scanNetworkCity || null,
                details.scanNetworkProvince || null,
                details.scanNetworkName || null,
                details.scanTime,
                currentTypeName,
                details.abnormalPieceName || null
            ];

            const sqlInsertWaybill = `INSERT INTO jtwaybill
            (billcode, scanbycode, scanbycontact, scanbyname, scanward, scancity, scanprov, scanpost, scantime, scantypename, issuename, scantypecode)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;

            await db.query(sqlInsertWaybill, [...waybillParams, Number(details.scanTypeCode)]);
            const scanCode = Number(details.scanTypeCode);
            let updateSql = "";
            let params = [];

            switch (scanCode) {
                case 103:
                case 105:
                case 106:
                case 109:
                    updateSql = `UPDATE lendon SET statuscode = ?, statustext = ?, kg = ?, last_update = NOW() WHERE realorderid = ?`;
                    params = [scanCode, currentTypeName, details.weight, billCode];
                    break;

                case 110:
                    updateSql = `UPDATE lendon SET statuscode = ?, statustext = ?, issue = NULL , kg = ?, last_update = NOW()
                     WHERE realorderid = ? AND statuscode NOT IN (113, 105, 117)`;
                    params = [scanCode, currentTypeName, details.weight, billCode];
                    break;

                case 112:
                case 116:
                case 117:
                    updateSql = `UPDATE lendon SET statuscode = ?, statustext = ?, issue = NULL, kg = ?, last_update = NOW() WHERE realorderid = ?`;
                    params = [scanCode, currentTypeName, details.weight, billCode];
                    break;

                case 113:
                    updateSql = `UPDATE lendon SET statuscode = ?, statustext = ?, issue = NULL, kg = ?, last_update = NOW() WHERE realorderid = ?`;
                    params = [scanCode, currentTypeName, details.weight, billCode];
                    break;

                case 118:
                case 120:
                    updateSql = `UPDATE lendon SET statuscode = ?, statustext = ?, issue = ?, kg = ?, last_update = NOW() WHERE realorderid = ?`;
                    params = [scanCode, currentTypeName, details.abnormalPieceName, details.weight, billCode];
                    break;

                default:
                    console.log(details.scanTypeName);
                    updateSql = null;
            }

            if (updateSql) {
                const [result] = await db.query(updateSql, params);
                if (result.affectedRows === 0) {
                    console.warn(`[Webhook J&T] KHÔNG TÌM THẤY đơn hàng. Bill: ${billCode}`);
                }
            }

            const JT_NOTIFY_CODES = {
                116: '🔄', // Đang chuyển hoàn
                117: '🔄', // Đã ký nhận hoàn trả
                118: '⚠️', // Kiện vấn đề (Giao)
                120: '⚠️', // Kiện vấn đề (Hoàn)
            };

            if (JT_NOTIFY_CODES[scanCode]) {
                try {
                    const [orderRows] = await db.query(
                        'SELECT * FROM lendon WHERE realorderid = ? LIMIT 1',
                        [billCode]
                    );

                    if (orderRows.length > 0) {
                        const order = orderRows[0];
                        const userId = order.useraccountid;
                        const title = `${order.name} - J&T`;
                        const body = `${currentTypeName}${details.abnormalPieceName ? ' - ' + details.abnormalPieceName : ''}`;

                        const [notiRows] = await db.query(
                            'SELECT 1 FROM order_noti_log WHERE realorderid = ? AND status_code = ? LIMIT 1',
                            [billCode, scanCode]
                        );

                        if (!notiRows.length) {
                            const [result] = await db.query(
                                'INSERT IGNORE INTO order_noti_log (realorderid, status_code, sent_at, title, body, userid) VALUES (?, ?, NOW(), ?, ?, ?)',
                                [billCode, scanCode, title, body, userId]
                            );
                            const notiId = result.insertId;
                            const payload = {
                                type: 'order_status',
                                realorderid: billCode,
                                status: scanCode,
                                noti_id: notiId
                            };
                            await sendFcmToUser(db, userId, title, body, payload);
                        }
                    }
                } catch (notiError) {
                    console.error('[J&T FCM] Lỗi gửi notification:', notiError.message);
                }
            }

        } catch (error) {
            console.error('Lỗi Webhook J&T:', error);
        }
    });

    router.post('/api/fcm-token', async (req, res) => {
        const db = DBConnection.promise();
        const { userId, token } = req.body;
        if (!userId || !token) return res.status(400).json({ error: 'Missing userId or token' });
        try {
            await db.query(
                `INSERT INTO fcm_tokens (userid, token, updated_at)
                 VALUES (?, ?, NOW())
                 ON DUPLICATE KEY UPDATE userid = VALUES(userid), updated_at = NOW()`,
                [userId, token]
            );
            res.json({ ok: true });
        } catch (e) {
            console.error('[FCM] Save token error:', e.message);
            res.status(500).json({ error: e.message });
        }
    });

    router.post('/api/fcm-token/remove', async (req, res) => {
        const db = DBConnection.promise();
        const { userId, token } = req.body;
        if (!userId || !token) return res.status(400).json({ error: 'Missing userId or token' });
        try {
            await db.query(
                'DELETE FROM fcm_tokens WHERE userid = ? AND token = ?',
                [userId, token]
            );
            res.json({ ok: true });
        } catch (e) {
            console.error('[FCM] Remove token error:', e.message);
            res.status(500).json({ error: e.message });
        }
    });
    const { sendFcmToUser } = require('./fcm');

    router.post('/sendnoti', async (req, res) => {
        const db = DBConnection.promise();
        await sendFcmToUser(db,
            '1', // test userId
            '505: 139219956547',
            'xxxxx',
            { type: 'order_status', realorderid: '139219956547' }
        );
        res.json({ success: true, message: 'Đã gửi' });
    });

    router.post('/viettel', async (req, res) => {
        try {
            const body = req.body;
            if (body.TOKEN !== 'aodaigiabao') {
                return res.status(401).send('Unauthorized');
            }

            const data = body.DATA;
            let status = parseInt(data.ORDER_STATUS);
            let statustext = data.STATUS_NAME;

            if (status === -108) {
                status = 100;
                statustext = 'Mới tạo';
            }

            const db = DBConnection.promise();
            let phone = data.EMPLOYEE_PHONE || '';
            if (phone.startsWith('84')) {
                phone = '0' + phone.substring(2);
            }

            const orderNumber = data.ORDER_NUMBER;
            const is1P1 = /1P\d+$/i.test(orderNumber);
            const baseOrderNumber = is1P1 ? orderNumber.replace(/1P\d+$/i, '') : orderNumber;

            const [rows] = await db.query(
                'SELECT * FROM lendon WHERE realorderid = ? LIMIT 1',
                [orderNumber]
            );

            if (rows.length === 0 && is1P1) {
                const [baseRows] = await db.query(
                    'SELECT * FROM lendon WHERE realorderid = ? LIMIT 1',
                    [baseOrderNumber]
                );

                if (baseRows.length > 0) {
                    const base = baseRows[0];
                    const timenow = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Saigon" });
                    await db.query(
                        `INSERT INTO lendon (name, phone, address, cod, kg, status, date, orderid, realorderid, khid, userid, realfbid, time, provider, statuscode, statustext, last_update)
                     VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, NOW())`,
                        [
                            base.name, base.phone, base.address,
                            base.kg, 1, timenow,
                            orderNumber, orderNumber,
                            base.khid, base.userid, base.realfbid,
                            base.provider || 'Viettel',
                            status, statustext
                        ]
                    );
                    console.log(`[1P1] Tạo đơn hoàn 1 phần mới: ${orderNumber} từ đơn gốc ${baseOrderNumber}`);
                } else {
                    console.warn(`[1P1] Không tìm thấy đơn gốc ${baseOrderNumber} để tạo đơn ${orderNumber}`);
                }
            } else if (rows.length > 0) {
                const currentStatus = parseInt(rows[0].statuscode) || 0;
                if (status > currentStatus || status >= 107) {
                    await db.query(`
                    UPDATE lendon 
                    SET statuscode = ?, 
                        statustext = ?, 
                        cod = ?,
                        shipper_name = ?, 
                        shipper_phone = ?,
                        last_update = NOW()
                    WHERE realorderid = ?`,
                        [status, statustext, data.MONEY_COLLECTION,
                            data.EMPLOYEE_NAME || null, phone || null, orderNumber]
                    );

                    const NOTIFY_STATUSES = {
                        505: '⚠️', 506: '⚠️', 507: '⚠️',
                        502: '🔄', 515: '🔄', 551: '🔄', 504: '🔄',
                    };

                    if (NOTIFY_STATUSES[status] && rows[0].userid) {
                        const userId = rows[0].useraccountid;
                        const title = `${rows[0].name} (${data.MONEY_COLLECTION.toLocaleString()} đ)`;
                        const body = `${statustext} - ${data.NOTE}.`;

                        const [notiRows] = await db.query(
                            'SELECT 1 FROM order_noti_log WHERE realorderid = ? AND status_code = ? LIMIT 1',
                            [orderNumber, status]
                        );

                        if (!notiRows.length) {
                            const [result] = await db.query(
                                'INSERT IGNORE INTO order_noti_log (realorderid, status_code, sent_at, title, body, userid) VALUES (?, ?, NOW(), ?, ?, ?)',
                                [orderNumber, status, title, body, userId]
                            );
                            const notiId = result.insertId;
                            const payload = {
                                type: 'order_status',
                                realorderid: orderNumber,
                                status,
                                noti_id: notiId
                            };
                            if (!data.NOTE.includes('hẹn phát lại') && !data.NOTE.includes('Áo dài Gia Bảo')) {
                                SendCanhBao(orderNumber, data.EMPLOYEE_NAME, phone, data.MONEY_COLLECTION, data.NOTE);
                                await sendFcmToUser(db, userId, title, body, payload);
                            }
                        }
                    }
                } else {
                    console.log(`[Skip Update] Đơn ${orderNumber}: Status cũ (${currentStatus}) mới hơn status nhận được (${status})`);
                }
            }

            await db.query(`
            INSERT IGNORE INTO order_logs 
            (order_number, status_code, status_name, location, note, money_collection, employee_name, employee_phone, status_date_raw) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [orderNumber, status, statustext,
                    data.LOCATION_CURRENTLY || data.LOCALION_CURRENTLY,
                    data.NOTE || '', data.MONEY_COLLECTION,
                    data.EMPLOYEE_NAME || null, phone || null, data.ORDER_STATUSDATE]
            );

            res.sendStatus(200);
        } catch (error) {
            console.error('Webhook Error:', error);
            res.status(500).send('Internal Server Error');
        }
    });

    async function SendCanhBao(orderNumber, shipper_name, shipper_phone, cod, issue) {
        try {
            const db = DBConnection.promise();

            const [orders] = await db.query(
                'SELECT userid FROM lendon WHERE realorderid = ? LIMIT 1',
                [orderNumber]
            );
            if (orders.length === 0) return;

            const [users] = await db.query(
                'SELECT pageid FROM khachhang WHERE userid = ? LIMIT 1',
                [orders[0].userid]
            );
            if (users.length === 0) return;

            const token = (users[0].pageid === GlobalPageID) ? PAGE_ACCESS_TOKEN : PAGE_ACCESS_TOKEN2;
            const recipientId = orders[0].userid;
            const text = `Shipper thông báo đơn hàng [${cod.toLocaleString()}đ] của chị có trạng thái [${issue}]\r\nNếu cần liên hệ xin gọi [${shipper_name}]. Số bưu tá ${shipper_phone}. Hoặc nếu thông tin trên sai xin nhắn lại với shop em ạ, em cám ơn!`;

            const tryingSend = async (messaging_type, tag = null) => {
                const payload = {
                    recipient: { id: recipientId },
                    messaging_type,
                    message: { text },
                    ...(tag ? { tag } : {})
                };
                const res = await axios.post(
                    `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
                    payload
                );
                return res.data;
            };

            try {
                await tryingSend('UPDATE');
            } catch (err) {
                const code = err.response?.data?.error?.code;
                if (code === 2018286 || code === 10) {
                    await tryingSend('MESSAGE_TAG', 'HUMAN_AGENT');
                } else {
                    throw err;
                }
            }
        } catch (error) {
            console.error("Lỗi gửi tin nhắn:", error.response?.data?.error || error.message);
        }
    }

    /* xai chung voi flutter, ko can cai nay nua
    router.get('/api/order-tracking/:order_number', async (req, res) => {
        try {
            const { order_number } = req.params;
            const db = DBConnection.promise();

            // Lấy provider từ bảng lendon
            const [orderInfo] = await db.query(
                'SELECT provider FROM lendon WHERE realorderid = ? LIMIT 1',
                [order_number]
            );

            const provider = orderInfo.length > 0 ? (orderInfo[0].provider || 'Viettel') : 'Viettel';

            let logs = [];

            if (provider === 'J&T') {
                const [jtLogs] = await db.query(
                    `SELECT 
                    scantime        AS status_date_raw,
                    scantypename    AS status_name,
                    CONCAT(scanward, ', ', scancity, ', ', scanprov) AS location,
                    scanbyname      AS employee_name,
                    scanbycontact   AS employee_phone,
                    issuename       AS note,
                    0               AS money_collection
                FROM jtwaybill 
                WHERE billcode = ? 
                ORDER BY scantime DESC`,
                    [order_number]
                );
                logs = jtLogs;
            } else {
                const [vtLogs] = await db.query(
                    'SELECT * FROM order_logs WHERE order_number = ? ORDER BY status_date_raw DESC',
                    [order_number]
                );
                logs = vtLogs;
            }

            res.json({ success: true, data: logs, provider });
        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    });*/

    //fb webhooks
    router.get(['/facebook', '/instagram', '/threads'], function (req, res) {
        if (
            req.query['hub.mode'] == 'subscribe' &&
            req.query['hub.verify_token'] == 'halwhtihle'
        ) {
            res.send(req.query['hub.challenge']);
        } else {
            res.sendStatus(400);
        }
    });

    router.post('/api/generate-pdf', async (req, res) => {
        try {
            const pdfBuffer = await createGiaBaoLabel(req.body);
            res.json({ success: true, pdfBase64: pdfBuffer.toString('base64') });
        } catch (err) {
            console.error("LỖI TẠI SERVER:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    async function createGiaBaoLabel(data) {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: [226, 320],
                    margins: { top: 5, bottom: 5, left: 0, right: 0 }
                });
                // 2 dong nay dung cho may to, may nho ko can
                //doc.translate(-8, 0);
                //doc.scale(0.90);
                doc.fillColor('black');
                doc.strokeColor('black');

                let buffers = [];
                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => resolve(Buffer.concat(buffers)));

                const fontBold = path.join(__dirname, '..', 'public', 'fonts', 'Tahoma-Bold.ttf');
                const fontRegular = path.join(__dirname, '..', 'public', 'fonts', 'Tahoma.ttf');

                const cleanName = (data.name || "").trim();
                const cleanComment = (data.comment || "").trim();
                const cleanPrice = String(data.gia || "0");
                const luotCuoi = data.luotcuoi || "";
                const note = (data.note || "").trim();
                const address = (data.address || "").trim();
                const isForeign = (data.region || "").includes("Nước ngoài");

                // 1. HEADER (Y=5 đến 30)
                doc.font(fontBold).fontSize(11);
                doc.roundedRect(10, 5, 206, 25, 4).stroke();
                doc.text(`Áo Dài Gia Bảo • ${data.date || ""} • ${luotCuoi}`, 10, 13, { align: 'center', width: 206 });

                // 2. AVATAR & TÊN (Cùng Y=32)
                let commonY = 32;
                let avatarSize = 35;
                let nameX = 52;

                if (data.avabase64 && data.avabase64.length > 10) {
                    try {
                        let rawBuffer;
                        if (data.avabase64.startsWith('http')) {
                            const response = await axios({ method: 'get', url: data.avabase64, responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } });
                            rawBuffer = Buffer.from(response.data);
                        } else {
                            const base64Data = data.avabase64.split(';base64,').pop();
                            rawBuffer = Buffer.from(base64Data, 'base64');
                        }
                        const processedImg = await sharp(rawBuffer).resize(100, 100).grayscale().modulate({ contrast: 1.5 }).png().toBuffer();
                        doc.image(processedImg, 15, commonY, { width: avatarSize, height: avatarSize });
                    } catch (e) {
                        doc.lineWidth(0.5).rect(15, commonY, avatarSize, avatarSize).stroke();
                    }
                }

                // Vẽ tên khách
                doc.font(fontBold).fontSize(16).text(cleanName, nameX, commonY, { width: 158, lineGap: -2 });

                // Tính toán vị trí đặt Icon sau tên
                const nameWidth = doc.widthOfString(cleanName);
                const iconStartX = nameX + Math.min(nameWidth, 145) + 4;
                let currentIconX = iconStartX;

                // --- VẼ ICON QUẢ CẦU (NƯỚC NGOÀI) ---
                if (isForeign) {
                    doc.save();
                    doc.translate(currentIconX, commonY + 3);
                    doc.lineWidth(0.8);
                    doc.circle(5, 5, 5).stroke(); // Vòng tròn ngoài
                    doc.moveTo(0, 5).lineTo(10, 5).stroke(); // Đường xích đạo (ngang)
                    doc.moveTo(5, 0).quadraticCurveTo(8, 5, 5, 10).stroke(); // Kinh tuyến phải
                    doc.moveTo(5, 0).quadraticCurveTo(2, 5, 5, 10).stroke(); // Kinh tuyến trái
                    doc.restore();
                    currentIconX += 14;
                }

                // --- VẼ ICON LOCATION (ĐỊA CHỈ) ---
                if (address) {
                    doc.save();
                    doc.translate(currentIconX, commonY + 3);
                    // Vẽ giọt nước đặc
                    doc.moveTo(5, 12)
                        .bezierCurveTo(-1, 6, 1, 0, 5, 0)
                        .bezierCurveTo(9, 0, 11, 6, 5, 12)
                        .fill();
                    // Đục lỗ trắng ở giữa
                    doc.fillColor('white').circle(5, 4, 1.5).fill();
                    doc.restore();
                }

                const nameHeight = doc.heightOfString(cleanName, { width: 158, lineGap: -2 });
                let currentY = Math.max(commonY + avatarSize, commonY + nameHeight) + 5;

                // 3. THÔNG TIN PHỤ (CÁCH NHAU 3PX)
                doc.fillColor('black').font(fontRegular).fontSize(12);

                // Phone
                if (data.phone) {
                    doc.save();
                    doc.translate(15, currentY - 1);
                    doc.roundedRect(0, 0, 9, 13, 2).fill();
                    doc.fillColor('white').circle(4.5, 11, 1).fill();
                    doc.restore();
                    doc.fillColor('black').font(fontBold).text(`${data.phone}`, 32, currentY);
                    currentY += 15 + 3;
                }

                // Comment
                if (cleanComment) {
                    doc.save();
                    doc.translate(15, currentY + 1);
                    doc.moveTo(0, 0).lineTo(13, 0).lineTo(13, 9).lineTo(7, 9).lineTo(3, 13).lineTo(3, 9).lineTo(0, 9).closePath().fill();
                    doc.restore();
                    doc.font(fontRegular).text(`${cleanComment}`, 32, currentY, { width: 178, lineGap: -1 });
                    const h = doc.heightOfString(`${cleanComment}`, { width: 178, lineGap: -1 });
                    currentY += h + 3;
                }

                // Price
                if (cleanPrice && cleanPrice !== "0") {
                    doc.save();
                    doc.translate(15, currentY + 1);
                    doc.rect(0, 0, 14, 9).fill();
                    doc.fillColor('white').circle(7, 4.5, 2.5).fill();
                    doc.restore();
                    doc.fillColor('black').font(fontBold).text(`${cleanPrice}.000 đ`, 32, currentY);
                    currentY += 15 + 3;
                }

                // 4. BARCODE
                currentY += 5;
                if (data.id) {
                    try {
                        const bc = await bwipjs.toBuffer({ bcid: 'code128', text: String(data.id), scale: 1, height: 4, includetext: false });
                        doc.image(bc, 63, currentY, { width: 100 });
                        currentY += 22;
                    } catch (e) { }
                }

                if (note) {
                    doc.font(fontRegular).fontSize(9).text(note, 10, currentY, { align: 'center', width: 206 });
                }

                doc.end();
            } catch (err) { reject(err); }
        });
    }
    router.post('/print-order', (req, res) => {
        const io = socket.getIo();
        const { userId, type, content, config } = req.body;

        if (!userId || !content) {
            return res.status(400).json({ success: false, message: "Thiếu dữ liệu in" });
        }

        const userRoom = `USER_ROOM_${userId}`;
        const clients = io.sockets.adapter.rooms.get(userRoom);
        const isOnline = clients && clients.size > 0;

        if (isOnline) {
            const emitData = {
                type: type || 'pdf',
                config: config
            };

            if (emitData.type === 'html') {
                emitData.html = content;
            } else {
                emitData.base64 = content;
            }

            io.to(userRoom).emit("print-now", emitData);

            //console.log(`[Lệnh in] Gửi ${emitData.type} tới ${userRoom}`);
            res.json({ success: true, message: "Đã gửi lệnh in" });
        } else {
            res.status(404).json({ success: false, message: "Máy in Offline" });
        }
    });

    let accountIndex = 0;
    const cloudinaryAccounts = [
        {
            cloud_name: 'davwpypkv',//login Gmail duoibuomhaihoa
            api_key: '651939943148141',
            api_secret: 'XZWtLIsRUz6uKhWlXyJ_40IModM'
        },
        {
            cloud_name: 'dpzhg8eok',
            api_key: '836871388191537',
            api_secret: 'gw8EiO66QxJ5c3E17NVMGUfoq60'
        },
        {
            cloud_name: 'dlnt2waye',//tonylinh@me.com
            api_key: '462861664463636',
            api_secret: 'UL_Eapigkk9EuzRenjZrktTT6-Y'
        }
    ];

    function getNextCloudinary() {
        const account = cloudinaryAccounts[accountIndex % cloudinaryAccounts.length];
        accountIndex++;
        if (accountIndex > 1000000) accountIndex = 0;
        cloudinary.config(account);
        return account.cloud_name;
    }

    router.post('/streamlabs', async function (req, res) {
        const now = new Date().getTime();
        if (req.body.obj && req.body.obj.hasOwnProperty('payload')) {
            const payload = req.body.obj.payload;
            const pageid = req.body.pageid;
            const io = socket.getIo();

            const userid = payload.from?.id;
            const fbname = payload.from?.name;
            const message = payload.message;
            const cmtid = payload.id;
            const picture = payload.from.picture.data.url;
            if (picture) download(picture, userid, 'C:/GB/src/public/images/ava/').catch(() => { });
            const timelocal = new Date(payload.created_time)
                .toLocaleString("en-US", { timeZone: "Asia/Saigon" });
            
            if (!userid || !message) {
                return res.status(400).json({ success: false, message: "Thiếu userid/message" });
            }
            const liveid = cmtid.split('_')[0];

            const db = DBConnection.promise();

            const [existing] = await db.query(
                'SELECT 1 FROM livecomment WHERE commentid = ? LIMIT 1', [cmtid]
            );
            if (existing.length > 0) {
                return res.json({ success: true, message: "Duplicate, bỏ qua" });
            }
            const [customerData] = await db.query(
                'SELECT * FROM khachhang WHERE userid = ? LIMIT 1', [userid]
            );

            if (customerData.length > 0) {
                const oldCus = customerData[0];
                const khachhangSql = SqlString.format('INSERT INTO khachhang (userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex,realfbid) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fbname=?, fbnamex=?, realfbid=?, avalink=?;',
                    [userid, fbname, oldCus.phone, oldCus.diachi, oldCus.avalink || picture, oldCus.uname, oldCus.gender, oldCus.label, pageid, LocDau(fbname), oldCus.realfbid,
                        fbname, LocDau(fbname), oldCus.realfbid, picture]);
                await db.query(khachhangSql);
            } else {
                const khachhangSql = SqlString.format('INSERT INTO khachhang (userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex,realfbid) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fbname=?, fbnamex=?, realfbid=?, avalink=?;',
                    [userid, fbname, '', '', picture, '', '', '', pageid, LocDau(fbname), '', fbname, LocDau(fbname), '', picture]);
                await db.query(khachhangSql);
            }

            const realfbidForComment = customerData.length > 0 ? customerData[0].realfbid : '';

            const [insertResult] = await db.query(
                `INSERT IGNORE INTO livecomment 
            (commentid, liveid, userid, name, message, chot, gia, timecomment, datecreate, luotin, count, app, pageid, realfbid, parent_id)
            VALUES (?, ?, ?, ?, ?, '', '', 0, ?, 0, 0, 'Streamlabs', ?, ?, '')`,
                [cmtid, liveid, userid, fbname, message, timelocal, pageid, realfbidForComment]
            );

            const [customerInfoResult] = await db.query(
                'SELECT * FROM khachhang WHERE userid = ? LIMIT 1', [userid]
            );
            const customerInfo = customerInfoResult.length > 0 ? customerInfoResult[0] : {};

            io.to(liveid).emit('new-comment', {
                idx: insertResult.insertId,
                picture: picture,
                cmtid: cmtid,
                liveid: liveid,
                pageid: pageid,
                fbname: fbname,
                message: message,
                timelocal: timelocal,
                customerInfo: customerInfo
            });
            const now2 = new Date().getTime() - now;
            console.log(`STR:(${now2})${fbname}: ${message}`)
            res.json({ success: true, message: "Đã nhan", customerInfo: customerInfo });
        }
    });

    router.post('/facebook', async function (req, res) {
        res.sendStatus(200);
        const io = socket.getIo();
        const EmitMessage = async (id, phone, picture, sender, recipient, text, timemess, fbname, messageImg, label, pageid, diachi, nuocngoai, is_echo, note) => {
            const newMessageData = {
                id: id,
                phone: phone,
                picture: picture,
                senderId: sender,
                recipientId: recipient,
                messageText: text,
                timestamp: timemess,
                fbname: fbname,
                messageImg: messageImg,
                label: label,
                pageid: pageid,
                diachi: diachi,
                nuocngoai: nuocngoai,
                is_echo: is_echo,
                note: note || ''
            };
            io.emit('new-message', newMessageData);
        }
        if (req.body.entry[0].hasOwnProperty('messaging')) {
            const value = req.body.entry[0].messaging[0];
            var messid, sender, recipient, text, timemess = '', khachhang, pageid, token;

            if (value.hasOwnProperty('message')) {
                sender = value.sender.id;
                recipient = value.recipient.id;

                var isPage1 = (sender === GlobalPageID || recipient === GlobalPageID);
                pageid = isPage1 ? GlobalPageID : GlobalPageID2;
                token = isPage1 ? PAGE_ACCESS_TOKEN : PAGE_ACCESS_TOKEN2;
                khachhang = (sender === GlobalPageID || sender === GlobalPageID2) ? recipient : sender;

                var messData = value.message || {};
                var text = messData.text;
                var messid = messData.mid;
                var attachments = messData.attachments;
                var is_echo = messData.is_echo;
                var echo;
                if (is_echo) {
                    echo = 1;
                } else {
                    echo = 0;
                }
                var timemess = new Date(value.timestamp).toLocaleString("en-US", { timeZone: "Asia/Saigon" });
                var finalImageString = '';

                try {
                    if (attachments) {
                        var imageList = [];
                        for (var i = 0; i < attachments.length; i++) {
                            var att = attachments[i];
                            var url = (att.payload && att.payload.url) ? att.payload.url : null;
                            if (!url) continue;

                            if (url.indexOf('cloudinary') !== -1) {
                                imageList.push(url);
                                continue;
                            }

                            const headRes = await fetch(url, { method: 'HEAD' });
                            const contentType = headRes.headers.get('content-type') || '';
                            if (contentType.includes('text/html') || contentType.includes('application/json')) continue;

                            var picname = CreateOrderID();
                            if (contentType.startsWith('image/')) {
                                try {
                                    var isLike = ['39178562_1505197616293642', '851587_369239346556147', '851582_369239386556143'].some(id => url.includes(id));
                                    if (isLike) {
                                        imageList.push('/images/messpic/like.jpg');
                                    } else {
                                        const currentCloud = getNextCloudinary();

                                        var uploadResult = await cloudinary.uploader.upload(url, {
                                            public_id: picname,
                                            folder: 'messenger_images',
                                            transformation: [{ width: 768, crop: "limit" }, { quality: "auto:eco" }]
                                        });
                                        imageList.push(uploadResult.secure_url);
                                    }
                                } catch (e) {
                                    var ext = await download(url, picname, 'C:/GB/src/public/images/messpic/').catch(() => 'jpg');
                                    imageList.push('/images/messpic/' + picname + '.' + ext);
                                }
                            } else if (contentType.startsWith('video/') || contentType.startsWith('audio/')) {
                                var ext = await download(url, picname, 'C:/GB/src/public/images/messpic/').catch(() => 'mp4');
                                imageList.push('/images/messpic/' + picname + '.' + ext);
                            }
                        }
                        finalImageString = imageList.join(';') + (imageList.length ? ';' : '');
                    }

                    await new Promise((resolve) => {
                        var sqlMsg = attachments
                            ? SqlString.format('INSERT IGNORE INTO messaging (messid,sender,recipient,image,time,timestamp,is_echo) VALUES (?,?,?,?,?,?,?);', [messid, sender, recipient, finalImageString, timemess, value.timestamp, echo])
                            : SqlString.format('INSERT IGNORE INTO messaging (messid,sender,recipient,message,time,timestamp,is_echo) VALUES(?,?,?,?,?,?,?);', [messid, sender, recipient, text, timemess, value.timestamp, echo]);

                        DBConnection.query(sqlMsg, async function (err) {
                            if (err) { console.error("Lỗi lưu tin:", err); return resolve(); }

                            DBConnection.query("SELECT * FROM khachhang WHERE userid='" + khachhang + "' LIMIT 1", async function (error, data) {
                                var curCus = (data && data.length > 0) ? data[0] : null;

                                if (curCus) {
                                    if (text && !is_echo && !curCus.phone) {
                                        var phoneMatch = text.match(/0[98735]([0-9]|\s|-|\.){8,12}/);
                                        if (phoneMatch) {
                                            var newPhone = phoneMatch[0].replace(/\D/g, '');
                                            DBConnection.query("UPDATE khachhang SET phone='" + newPhone + "' WHERE id=" + curCus.id);
                                            curCus.phone = newPhone;
                                        }
                                    }
                                    const avatar = `https://aodaigiabao.com/images/ava/${khachhang}.jpg`
                                    EmitMessage(curCus.id, curCus.phone, avatar, sender, recipient, text || '', timemess, curCus.fbname, finalImageString, curCus.label, curCus.pageid, curCus.diachi, curCus.nuocngoai, echo, curCus.note);
                                    if (!is_echo && text && sender !== GlobalPageID && sender !== GlobalPageID2) {
                                        tryInsertMessageAsComment(khachhang, sender, text, timemess, pageid, io);
                                    }
                                    resolve();
                                } else if (!is_echo) {
                                    var fbname = 'Khách hàng', picture = '', phone = '';
                                    try {
                                        var fbRes = await fetch("https://graph.facebook.com/" + khachhang + "/?fields=picture{url},name&access_token=" + token);
                                        var prof = await fbRes.json();
                                        fbname = prof.name || 'Khách hàng';
                                        picture = (prof.picture && prof.picture.data) ? prof.picture.data.url : '';
                                        if (picture) download(picture, khachhang, 'C:/GB/src/public/images/ava/').catch(() => { });
                                    } catch (e) { }

                                    if (text && !text.includes('/')) {
                                        var phoneMatch = text.match(/0[98735]([0-9]|\s|-|\.){8,12}/);
                                        if (phoneMatch) phone = phoneMatch[0].replace(/\D/g, '');
                                    }

                                    axios.post("https://graph.facebook.com/v19.0/me/messages?access_token=" + token, {
                                        recipient: { id: khachhang },
                                        message: { text: "Áo dài Gia Bảo chào " + fbname + "! Mã của bạn: " + khachhang }
                                    }).catch(() => { });

                                    var sqlInsert = SqlString.format('INSERT INTO khachhang (userid,fbname,phone,avalink,pageid,fbnamex,tag,diachi,label) VALUES(?,?,?,?,?,?,?,?,?)',
                                        [khachhang, fbname, phone, picture, pageid, LocDau(fbname), khachhang, '', '']);

                                    DBConnection.query(sqlInsert, function (err, result) {
                                        if (!err) {
                                            EmitMessage(result.insertId, phone, picture, sender, recipient, text || '', timemess, fbname, finalImageString, '', pageid, '', '', echo);
                                            if (!is_echo && text && sender !== GlobalPageID && sender !== GlobalPageID2) {
                                                tryInsertMessageAsComment(khachhang, sender, text, timemess, pageid, io);
                                            }
                                        }
                                        resolve(); // Xong khách mới
                                    });
                                } else {
                                    resolve(); // Kết thúc echo
                                }
                            });
                        });
                    });
                } catch (err) {
                    console.error("Lỗi xử lý: ", err);
                }
            } else if (value.hasOwnProperty('read')) {
                const watermark = value.read.watermark;
                const senderId = value.sender.id;
                DBConnection.query(
                    'UPDATE messaging SET isread = 1 WHERE recipient = ? AND timestamp <= ?',
                    [senderId, watermark],
                    (error, results) => {
                        if (error) {
                            console.error('Lỗi khi cập nhật trạng thái đã đọc:', error);
                        } else {
                            //console.log(`Đã cập nhật ${results.affectedRows} tin nhắn là đã đọc.`);
                        }
                    }
                );
                io.emit('read', {
                    senderId: senderId,      // PSID khách
                    watermark: watermark,    // timestamp khách đã đọc tới
                });
                return;
            } else if (value.hasOwnProperty('reaction')) {
                const senderId = value.sender.id;
                const mid = value.reaction.mid;
                let emoji = value.reaction.emoji; // Facebook gửi "\uD83D\uDC4D" hoặc "👍"
                const reactionTime = value.timestamp;

                try {
                    if (emoji.includes('\\u')) {
                        emoji = JSON.parse(`"${emoji}"`);
                    }
                } catch (e) {
                    console.error('Lỗi decode emoji:', emoji, e);
                }

                // Cách 2: Dùng String.fromCodePoint nếu nó là dạng khác
                // emoji = emoji.replace(/\\u([0-9a-fA-F]{4})/g, (m, g1) => 
                //   String.fromCodePoint(parseInt(g1, 16))
                // );

                DBConnection.query(
                    'INSERT INTO reactions (messid, sender_id, reaction_emoji, timestamp) VALUES (?, ?, ?, ?)',
                    [mid, senderId, emoji, reactionTime],
                    (error, results) => {
                        if (error) {
                            console.error('Lỗi khi lưu reaction:', error);
                        }
                    }
                );
                io.emit('reaction', {
                    senderId: senderId,
                    mid: mid,
                    emoji: emoji,
                });
                return;
            } else if (value.referral) {
                const ref = value.referral;
                const ctx = ref.ads_context_data || {};

                const sqlRef = SqlString.format(
                    'INSERT INTO messaging_referrals (sender_id, ad_id, ad_title, post_id, video_url, source, type, timestamp) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?)',
                    [value.sender.id, ref.ad_id, ctx.ad_title, ctx.post_id, ctx.video_url, ref.source, ref.type, value.timestamp]
                );

                DBConnection.query(sqlRef, (err) => {
                    if (err) console.error("Lỗi lưu thông tin quảng cáo:", err);
                });

                const post_id = value.referral.ads_context_data.post_id;
                const khachhang_id = value.sender.id;

                const sqlGetInfo = `
                    SELECT k.fbname, k.avalink, 
                    (SELECT COUNT(*) FROM messaging_referrals WHERE post_id = ?) AS total_interactions
                    FROM khachhang k 
                    WHERE k.userid = ? 
                    LIMIT 1`;

                DBConnection.query(sqlGetInfo, [post_id, khachhang_id], (err, results) => {
                    if (err) {
                        console.error("Lỗi truy vấn dữ liệu referral:", err);
                        return;
                    }

                    const customerName = (results.length > 0) ? results[0].fbname : "Khách hàng mới";
                    const totalInteractions = (results.length > 0) ? results[0].total_interactions : 1;

                    io.to(post_id).emit('new-referral', {
                        referral: value.referral,
                        fbname: customerName,
                        total_interactions: totalInteractions,
                        timestamp: value.timestamp
                    });
                });
            }
        } else if (req.body.entry[0].hasOwnProperty('changes')) {
            const change = req.body.entry[0].changes[0];
            const { value } = change;//cai nay phai {} moi dc
            if (value.hasOwnProperty('verb')) {
                if (value.verb === 'add' && value.item != 'comment') {
                    if (value.item == 'reaction') {
                        var sql = SqlString.format('INSERT INTO postreaction (name,userid,time,postid,type) VALUES(?,?,?,?,?);', [value.from.name, value.from.id, value.created_time, value.post_id.split('_')[1], value.reaction_type]);
                        DBConnection.query(sql);
                    } else if (value.item == 'share') {
                        //var sql = SqlString.format('INSERT INTO postshare (name,userid,time,postid,newpostid) VALUES(?,?,?,?,?);', [value.from.name, value.from.id, value.created_time, value.link.match(/(\d+)\/$/)[1], value.post_id.split('_')[1]]);
                        //DBConnection.query(sql);
                    }
                    //value.item - status - photo - video - dang tim them
                    //console.log(req.body.entry[0]);
                    //console.log(value);
                } else if (value.item == 'comment' && value.verb == 'add') {
                    if (!value.hasOwnProperty('from')) {
                        console.log('Comment outside owner page.');
                        return;
                    }

                    var parent_id = '';
                    var fbname = '';
                    var idx = '';
                    var token = '';
                    var pageid = req.body.entry[0].id;
                    var pic = 'none';
                    var userid = value.from.id;
                    var message = value.message;
                    var cmtid = value.comment_id;
                    var time = value.created_time;
                    var liveid = value.post_id.split('_')[1];
                    var timelocal = new Date(time * 1000).toLocaleString("en-US", { timeZone: "Asia/Saigon" });
                    if (value.parent_id) {
                        parent_id = value.parent_id;
                    }
                    if (pageid == GlobalPageID) {
                        token = PAGE_ACCESS_TOKEN;
                    }
                    if (pageid == GlobalPageID2) {
                        token = PAGE_ACCESS_TOKEN2;
                    }

                    if (!value.from.hasOwnProperty('name')) {//nghi ngo no bo qua doan nay
                        try {
                            const query = `https://graph.facebook.com/${value.from.id}/?fields=picture{url},name&access_token=${token}`;
                            const res = await fetch(query);
                            if (res.ok) {
                                const data = await res.json();
                                download(data.picture.data.url, data.id, 'C:/GB/src/public/images/ava/');
                                pic = data.picture.data.url;
                                fbname = data.name;
                            }
                        } catch (e) {
                            console.log('Error fetching user info:', e);
                        }
                    } else {
                        fbname = value.from.name;
                    }
                    if (fbname == '') {//tim hieu nguyen nhan, neu van bi thi bat no update bang token 1 lan nua
                        console.log(value);
                        console.log(value.from);
                        try {//ep' no update them lan nua
                            const query = `https://graph.facebook.com/${value.from.id}/?fields=picture{url},name&access_token=${token}`;
                            const res = await fetch(query);
                            if (res.ok) {
                                const data = await res.json();
                                download(data.picture.data.url, data.id, 'C:/GB/src/public/images/ava/');
                                pic = data.picture.data.url;
                                fbname = data.name;
                            }
                        } catch (e) {
                            console.log('Error fetching user info:', e);
                        }
                    }

                    if (message == null || message == undefined) {
                        message = '';
                    }
                    function queryAsync(sql) {
                        return new Promise((resolve, reject) => {
                            DBConnection.query(sql, (error, results) => {
                                if (error) {
                                    return reject(error);
                                }
                                resolve(results);
                            });
                        });
                    }

                    try {
                        const customerData = await queryAsync(`SELECT * FROM khachhang WHERE userid='${userid}' LIMIT 1`);

                        if (customerData.length > 0) {
                            const cmtSql = SqlString.format('INSERT IGNORE INTO livecomment (commentid,liveid,userid,name,message,chot,gia,timecomment,datecreate,luotin,count,app,pageid,realfbid,parent_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE realfbid=?;',
                                [cmtid, liveid, userid, fbname, message, '', '', 0, timelocal, 0, 0, 'Linh', pageid, customerData[0].realfbid, parent_id, customerData[0].realfbid]);
                            const results = await queryAsync(cmtSql);
                            idx = results.insertId;
                            if (results.affectedRows === 0) return;
                            const khachhangSql = SqlString.format('INSERT INTO khachhang (userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex,realfbid) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fbname=?, fbnamex=?, realfbid=?;',
                                [userid, fbname, customerData[0].phone, customerData[0].diachi, pic, customerData[0].uname, customerData[0].gender, customerData[0].label, pageid, LocDau(fbname), customerData[0].realfbid, fbname, LocDau(fbname), customerData[0].realfbid]);
                            await queryAsync(khachhangSql);
                        } else {
                            var picture = '';
                            try {
                                const query = `https://graph.facebook.com/${userid}/?fields=picture{url},name&access_token=${token}`;
                                const res = await fetch(query);
                                if (res.ok) {
                                    const data = await res.json();
                                    download(data.picture.data.url, data.id, 'C:/GB/src/public/images/ava/');
                                    picture = data.picture.data.url;
                                }
                            } catch (e) {
                                console.log('Error fetching new user info:', e);
                            }
                            const cmtSql = SqlString.format('INSERT IGNORE INTO livecomment (commentid,liveid,userid,name,message,chot,gia,timecomment,datecreate,luotin,count,app,pageid,parent_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?);',
                                [cmtid, liveid, userid, fbname, message, '', '', 0, timelocal, 0, 0, 'Linh', pageid, parent_id]);
                            const results = await queryAsync(cmtSql);
                            idx = results.insertId;
                            if (results.affectedRows === 0) return;
                            const khachhangSql = SqlString.format('INSERT INTO khachhang (userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fbname=?, fbnamex=?, avalink=?;',
                                [userid, fbname, '', '', picture, '', '', '', pageid, LocDau(fbname), fbname, LocDau(fbname), picture]);
                            await queryAsync(khachhangSql);
                        }

                        const customerInfoResult = await queryAsync(`SELECT * FROM khachhang WHERE userid='${userid}' LIMIT 1`);
                        const customerInfo = (customerInfoResult && customerInfoResult.length > 0) ? customerInfoResult[0] : {};

                        const newCommentData = {
                            idx: idx,
                            picture: picture,
                            cmtid: cmtid,
                            liveid: liveid,
                            pageid: pageid,
                            fbname: fbname,
                            message: message,
                            timelocal: timelocal,
                            customerInfo: customerInfo
                        };
                        io.to(liveid).emit('new-comment', newCommentData);
                    } catch (err) {
                        console.log('ERROR: SQL TRANSACTION FAILED', err);
                    }
                }
            } else {
                if (req.body.entry[0].changes[0].field == 'live_videos') {
                    const pageId = req.body.entry[0].id;

                    DBConnection.query("SELECT accesstoken FROM pageinfo WHERE pageid='" + pageId + "'", async function (error, data) {
                        if (error) {
                            console.error('Lỗi DB pageinfo:', error);
                            return;
                        }
                        if (data && data.length > 0) {
                            try {
                                const token = data[0].accesstoken;
                                const query = `https://graph.facebook.com/${value.id}/?fields=live_views,from,id,title,video,status,creation_time,description,permalink_url&access_token=${token}`;

                                const fbRes = await axios.get(query);
                                const fbData = fbRes.data;

                                if (fbData && fbData.video && fbData.video.id) {
                                    const liveId = fbData.video.id;
                                    const status = fbData.status;
                                    const liveViews = fbData.live_views || 0;

                                    const livestatus = {
                                        liveid: liveId,
                                        status: status
                                    };

                                    io.emit('live-status', livestatus);

                                    const sql = SqlString.format(
                                        `INSERT INTO postlive (liveid, liveidwh, status, liveviews) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE status=?, liveviews=?;`,
                                        [liveId, fbData.id, status, liveViews, status, liveViews]
                                    );

                                    const sql2 = SqlString.format(
                                        'INSERT IGNORE INTO livestream (id, name, time, note, luotincuoi, luotlive, livedesc) VALUES(?,?,?,?,?,?,?);',
                                        [liveId, formatFbTime(fbData.creation_time), '', '', '', '', fbData.description || '']
                                    );


                                    DBConnection.query(sql);
                                    DBConnection.query(sql2);

                                    if (status === 'LIVE') {
                                        const newLivestream = {
                                            liveid: liveId,
                                            name: formatFbTime(fbData.creation_time),
                                            status: status,
                                            luotincuoi: 0
                                        };
                                        io.emit('new-livestream', newLivestream);
                                        GetUserToken();
                                        ShareToPage2(fbData.title || '', liveId);
                                    }
                                }
                            } catch (err) {
                                console.error('Lỗi gọi Facebook Graph API:', err.message);
                            }
                        }
                    });
                }
            }
        }
    });

    router.post('/instagram', function (req, res) {
        console.log('Instagram request body:');
        console.log(req.body);
        res.sendStatus(200);
    });

    router.post('/threads', function (req, res) {
        console.log('Threads request body:');
        console.log(req.body);
        res.sendStatus(200);
    });
    //end FB webhooks
    router.post('/getvietteltoken', function (req, res) {
        GetViettelToken();
        res.sendStatus(200);
    });

    router.post('/huydonviettel', async function (req, res) {
        const id = req.body.realorderid;
        const xoa = req.body.xoa;
        let type = (xoa > 0) ? 11 : 4; // 4 là hủy, 11 là xóa

        try {
            const data = await new Promise((resolve, reject) => {
                DBConnection.query(`SELECT * FROM vietteltoken`, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            if (!data || data.length === 0) {
                return res.status(404).json({ message: "Không tìm thấy Viettel token" });
            }

            const token = data[0].token;
            const url = 'https://partner.viettelpost.vn/v2/order/UpdateOrder';

            const response = await axios.post(url, {
                "TYPE": type,
                "ORDER_NUMBER": id,
                "NOTE": "Trùng đơn"
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'token': token
                }
            });

            const body = response.data;

            res.json({
                message: body.message || "Xử lý thành công"
            });

        } catch (error) {
            console.error('Lỗi hủy đơn Viettel:', error.message);

            res.status(500).json({
                message: "Lỗi hệ thống hoặc lỗi kết nối API",
                error: error.message
            });
        }
    });

    router.post('/printviettelmanual', function (req, res) {
        var realorderid = req.body.realorderid;
        PrintBillViettel(realorderid);
        res.sendStatus(200);
    });

    router.post('/detaildonhang', function (req, res) {
        var realorderid = req.body.realorderid;
        DBConnection.query(` SELECT * FROM lendon WHERE realorderid='${realorderid}'`,
            async function (error, data) {
                if (data.length > 0) {
                    res.json({
                        data: data
                    });
                }
            });
    });

    function preprocessForViettel(addr) {
        if (!addr) return addr;
        let a = addr.trim();

        const hasDongNai = /đồng\s*nai/i.test(a);
        const hasThongNhat = /thống\s*nhất/i.test(a);
        const alreadyHasHuyen = /huyện\s+thống\s*nhất|h\.\s*thống\s*nhất|\bh\s+thống\s*nhất/i.test(a);

        if (hasDongNai && hasThongNhat && !alreadyHasHuyen) {
            a = a.replace(/thống\s*nhất/gi, 'huyện Thống Nhất');
            a = a.replace(/huyện\s+huyện/gi, 'huyện');
        }
        return a;
    }
    router.post('/checkaddress', async function (req, res) {
        const { phone, khid, name, diachi: address, userid } = req.body;
        let xa = '', huyen = '', tinh = '';

        try {
            const tokenData = await new Promise((resolve, reject) => {
                DBConnection.query(`SELECT * FROM vietteltoken`, (err, rows) => err ? reject(err) : resolve(rows));
            });

            if (!tokenData || tokenData.length === 0) {
                return res.json({ error: "Lỗi: Không tìm thấy token Viettel" });
            }

            const token = tokenData[0].token;

            const nlpResponse = await axios.post('https://partner.viettelpost.vn/v2/order/getPriceAllNlp', {
                "SENDER_ADDRESS": "Long Bình, biên Hòa, Đồng Nai",
                "RECEIVER_ADDRESS": preprocessForViettel(address),
                "PRODUCT_TYPE": "HH",
                "PRODUCT_WEIGHT": 100,
                "TYPE": 1
            }, {
                headers: { 'Content-Type': 'application/json', 'token': token }
            });

            const body = nlpResponse.data;

            if (body.error === true) {
                return res.json({ error: "Lỗi: Không nhận diện được địa chỉ" });
            }

            const receiver = body.RECEIVER_ADDRESS;
            if (!receiver.WARD_ID || receiver.WARD_ID == 0) {
                return res.json({ error: "Sai xã phường" });
            }

            const [resTinh, resHuyen, resXa] = await Promise.all([
                axios.get(`https://partner.viettelpost.vn/v2/categories/listProvinceById?provinceId=${receiver.PROVINCE_ID}`),
                axios.get(`https://partner.viettelpost.vn/v2/categories/districtByIdAndProvince?districtId=${receiver.DISTRICT_ID}&provinceById=${receiver.PROVINCE_ID}`),
                axios.get(`https://partner.viettelpost.vn/v2/categories/wardByDistrictAndId?districtId=${receiver.DISTRICT_ID}&wardsId=${receiver.WARD_ID}`)
            ]);

            if (resTinh.data.data) tinh = resTinh.data.data[0].PROVINCE_NAME;
            if (resHuyen.data.data) huyen = resHuyen.data.data.DISTRICT_NAME;

            if (resXa.data.message && resXa.data.message.includes('No suitable data found')) {
                return res.json({ error: "Lỗi: Thông tin phường bị thay đổi, phải lên đơn tay" });
            }
            if (resXa.data.data) xa = resXa.data.data.WARDS_NAME;

            const adx = `${xa}, ${huyen}, ${tinh}`;

            let jtResult = null;
            if (xa && huyen && tinh) {
                try {
                    const sProv = cleanSearchTerm(tinh);
                    let sDist = cleanSearchTerm(huyen);
                    let sWard = cleanSearchTerm(xa);
                    sWard = sWard.replace(/phường|xã/gi, "").trim();
                    ({ sWard, sDist } = applyAddressFixes(sWard, sDist));

                    const db = DBConnection.promise();
                    const findJT = `
                    SELECT * 
                    FROM jtaddress
                    WHERE 
                        ${normalizeSQL('LOWER(prov)')} LIKE ${normalizeSQL('LOWER(?)')}
                        AND ${normalizeSQL('LOWER(district)')} LIKE ${normalizeSQL('LOWER(?)')}
                        AND (
                            ${normalizeSQL('LOWER(ward)')} LIKE ${normalizeSQL('LOWER(?)')}
                        )
                    ORDER BY 
                        (LOWER(ward) LIKE ?) DESC,
                        (LOWER(district) = ?) DESC,
                        LENGTH(ward) ASC
                    LIMIT 1`;

                    const [jtRows] = await db.query(findJT, [
                        `%${sProv}%`,
                        `%${sDist}%`,
                        `%${sWard}%`,
                        `${sWard}%`,
                        sDist
                    ]);

                    if (jtRows.length > 0) {
                        const jt = jtRows[0];
                        jtResult = {
                            xajt: jt.ward,
                            huyenjt: jt.district,
                            tinhjt: jt.prov,
                            xamoi: jt.newward,
                            tinhmoi: jt.newprov
                        };
                    } else {
                        console.log(`J&T không có dữ liệu cho: ${xa} - ${huyen} - ${tinh}`);
                        jtResult = { error: `J&T không có dữ liệu cho: ${xa} - ${huyen} - ${tinh}` };
                    }
                } catch (jtError) {
                    console.error('Lỗi lookup JT:', jtError.message);
                    jtResult = { error: 'Lỗi tra cứu J&T: ' + jtError.message };
                }
            }
            const addressNorm = address.trim();
            const checkSql = SqlString.format(
                `SELECT id FROM diachilendon WHERE LOWER(TRIM(address))=LOWER(?) AND phone=? AND userid=?`,
                [addressNorm, phone, userid]
            );

            const existingAddr = await new Promise((resolve) => {
                DBConnection.query(checkSql, (err, rows) => resolve(rows));
            });

            if (!existingAddr || existingAddr.length < 1) {
                const insertValues = [name, phone, addressNorm, khid, userid, xa, huyen, tinh];
                let insertSql;

                if (jtResult && !jtResult.error) {
                    insertSql = SqlString.format(
                        'INSERT INTO diachilendon (name, phone, address, khid, userid, xa, huyen, tinh, xajt, huyenjt, tinhjt, xamoi, tinhmoi) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?);',
                        [...insertValues, jtResult.xajt, jtResult.huyenjt, jtResult.tinhjt, jtResult.xamoi, jtResult.tinhmoi]
                    );
                } else {
                    insertSql = SqlString.format(
                        'INSERT INTO diachilendon (name, phone, address, khid, userid, xa, huyen, tinh) VALUES(?,?,?,?,?,?,?,?);',
                        insertValues
                    );
                }
                DBConnection.query(insertSql);
            } else {
                const existingId = existingAddr[0].id;
                if (jtResult && !jtResult.error) {
                    const updateSql = SqlString.format(
                        'UPDATE diachilendon SET xa=?, huyen=?, tinh=?, xajt=?, huyenjt=?, tinhjt=?, xamoi=?, tinhmoi=? WHERE id=?',
                        [xa, huyen, tinh, jtResult.xajt, jtResult.huyenjt, jtResult.tinhjt, jtResult.xamoi, jtResult.tinhmoi, existingId]
                    );
                    DBConnection.query(updateSql);
                } else {
                    const updateSql = SqlString.format(
                        'UPDATE diachilendon SET xa=?, huyen=?, tinh=? WHERE id=? AND (xa IS NULL OR xa="")',
                        [xa, huyen, tinh, existingId]
                    );
                    DBConnection.query(updateSql);
                }
            }

            res.json({
                adx,
                jtready: !!(jtResult && !jtResult.error),
                ...(jtResult && !jtResult.error ? jtResult : {}),
                ...(jtResult && jtResult.error ? { jtError: jtResult.error } : {})
            });

        } catch (error) {
            console.error('Lỗi Check Address:', error.message);
            res.status(500).json({ error: "Lỗi hệ thống khi xử lý địa chỉ" });
        }
    });

    router.post('/createorderviettel', jwtAuth, async function (req, res) {
        let { edit, realorderid, fbname, address, phone, cod, kg, khid, userid, realfbid } = req.body;
        let kgreal = kg;
        if (address.length < 10) return res.json({ error: 'Chưa có địa chỉ' });

        cod = cod.toString().replaceAll('.', '');
        kg = parseFloat(kg) * 1000;

        if (kg <= 1000) kg = 500;
        else if (kg <= 2000) kg = 1000;
        else if (kg <= 3000) kg = 1500;
        else if (kg <= 4000) kg = 2000;
        else if (kg <= 6000) kg = kg - 2000;
        else if (kg <= 9000) kg = kg - 3000;
        else if (kg <= 15000) kg = kg - 4000;
        else kg = kg - 5000;

        const typecod = (cod > 0) ? 3 : 1;

        try {
            const tokenData = await new Promise((resolve, reject) => {
                DBConnection.query(`SELECT * FROM vietteltoken`, (err, rows) => err ? reject(err) : resolve(rows));
            });

            if (!tokenData || tokenData.length === 0) return res.json({ error: 'Lỗi: Không có token' });

            const { token, userid: cusid, senderphone } = tokenData[0];
            let matuquan = (edit == 1) ? realorderid : CreateOrderID();
            let apiUrl = (edit == 1)
                ? 'https://partner.viettelpost.vn/v2/order/edit'
                : 'https://partner.viettelpost.vn/v2/order/createOrder';

            const response = await axios.post(apiUrl, {
                "ORDER_NUMBER": matuquan,
                "GROUPADDRESS_ID": 23832621,
                "CUS_ID": cusid,
                "SENDER_FULLNAME": "Áo dài Gia Bảo",
                "SENDER_ADDRESS": "862, ĐƯỜNG Đoàn Văn Cự, P.Tam Hiệp, TP.Biên Hòa, T.Đồng Nai",
                "SENDER_PHONE": senderphone,
                "RECEIVER_FULLNAME": fbname,
                "RECEIVER_ADDRESS": address,
                "RECEIVER_PHONE": phone,
                "PRODUCT_NAME": "Vải",
                "PRODUCT_DESCRIPTION": "Vải",
                "PRODUCT_QUANTITY": 1,
                "PRODUCT_PRICE": cod,
                "PRODUCT_WEIGHT": kg,
                "PRODUCT_LENGTH": 1, "PRODUCT_WIDTH": 1, "PRODUCT_HEIGHT": 1,
                "PRODUCT_TYPE": "HH",
                "ORDER_PAYMENT": typecod,
                "ORDER_SERVICE": "VSL7",
                //"ORDER_VOUCHER": "TUHAOVN",
                "ORDER_SERVICE_ADD": "GNG",// co the de nhieu ma, "GG1P,GNG" .....GNG la gui hang tai buu cuc
                "ORDER_NOTE": "Ko giao được gọi shop. Cho xem hàng. Ko nhận hàng thu 30k",
                "MONEY_COLLECTION": cod,
                "IS_ADDRESS_NEW": false
            }, {
                headers: { 'Content-Type': 'application/json', 'token': token }
            });

            const body = response.data;

            if (body.error === true || body.status !== 200) {
                return res.json({ error: body.message || 'Lỗi từ Viettel Post' });
            }

            const viettelOrder = body.data;
            const finalRealOrderId = viettelOrder.ORDER_NUMBER;

            if (!viettelOrder.RECEIVER_WARDS || viettelOrder.RECEIVER_WARDS == 0) {
                await axios.post('https://partner.viettelpost.vn/v2/order/UpdateOrder',
                    { "TYPE": 4, "ORDER_NUMBER": finalRealOrderId, "NOTE": "Không tìm được tên Phường/Xã" },
                    { headers: { 'token': token } }
                );
                return res.json({ error: 'Sai địa chỉ: không tìm được Xã/Phường' });
            }

            let tinh = '', huyen = '', xa = '';
            const [resTinh, resHuyen, resXa] = await Promise.all([
                axios.get(`https://partner.viettelpost.vn/v2/categories/listProvinceById?provinceId=${viettelOrder.RECEIVER_PROVINCE}`),
                axios.get(`https://partner.viettelpost.vn/v2/categories/districtByIdAndProvince?districtId=${viettelOrder.RECEIVER_DISTRICT}&provinceById=${viettelOrder.RECEIVER_PROVINCE}`),
                axios.get(`https://partner.viettelpost.vn/v2/categories/wardByDistrictAndId?districtId=${viettelOrder.RECEIVER_DISTRICT}&wardsId=${viettelOrder.RECEIVER_WARDS}`)
            ]);
            tinh = (resTinh.data && resTinh.data.data && resTinh.data.data[0]) ? resTinh.data.data[0].PROVINCE_NAME : '';
            huyen = (resHuyen.data && resHuyen.data.data) ? resHuyen.data.data.DISTRICT_NAME : 'Không xác định';
            xa = (resXa.data && resXa.data.data) ? resXa.data.data.WARDS_NAME : '';

            if (!xa) return res.json({ error: 'Sai địa chỉ: không tìm được Xã/Phường' });

            const timenow = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Saigon" });
            const now = new Date();
            const userId = req.user.id;
            let sql = "";
            if (edit != 1) {
                sql = SqlString.format('INSERT INTO lendon (name,phone,address,cod,kg,status,date,orderid,realorderid,khid,userid,realfbid,time,provider,useraccountid) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?);',
                    [fbname, phone, address, cod, kgreal, 1, timenow, matuquan, finalRealOrderId, khid, userid, realfbid, now, 'Viettel', userId]);//dung userid
            } else {
                sql = SqlString.format(`UPDATE lendon SET name=?,phone=?,address=?,cod=?,kg=?,status=?,date=?,orderid=?,realorderid=?,khid=?,provider='Viettel' WHERE realorderid=?;`,
                    [fbname, phone, address, cod, kgreal, 1, timenow, matuquan, finalRealOrderId, khid, finalRealOrderId]);
            }

            await new Promise((resolve) => DBConnection.query(sql, resolve));

            res.json({
                xa, huyen, tinh,
                realorderid: finalRealOrderId,
                timenow,
                matuquan
            });

        } catch (error) {
            console.error('Lỗi Create Order:', error.message);
            res.json({ error: 'Lỗi hệ thống: ' + error.message });
        }
    });

    router.post('/getuserorder', async function (req, res) {
        try {
            const userid = req.body.userid;
            const db = DBConnection.promise();
            const [finalData] = await db.query(
                'SELECT * FROM lendon WHERE userid=? ORDER BY ID desc LIMIT 3',
                [userid]
            );

            res.json({ success: true, data: finalData });

        } catch (error) {
            console.error("Hệ thống lỗi:", error);
            res.status(500).json({ error: 'Internal Server Error', details: error.message });
        }
    });

    router.post("/restartchrome", jwtAuth, async function (request, response, next) {
        RestartChromeX()
        response.json({
            data: JSON.parse('{"success": "Restart Chrome thành công"}')
        });
    });

    /*
    251LC12614
    Key : T249U1a2
    password : F55D925970D227346C2422F74FE0A9C3
    */
    router.post('/pushorderjtex', jwtAuth, async function (req, res) {
        const db = DBConnection.promise();
        let { fbname, address, phone, cod, kg, khid, userid, realfbid, tinh, huyen, xa } = req.body;

        if (!xa) {
            return res.json({ success: false, message: "Check địa chỉ trước" });
        }

        const note = "Cho xem hàng. Không nhận thu 30k";
        const product_name = "Vải";
        const timenow = new Date().toLocaleString("vi-VN", { timeZone: "Asia/Saigon" });

        const pkey = '47e60fbcc61544dcb85d30acd39d5e66';
        const apiAccount = '813258343706625024';
        const matuquan = "DH" + Date.now();

        const oderjson = JSON.stringify({
            "customerCode": "251LC12614",
            "password": "F55D925970D227346C2422F74FE0A9C3",
            "txlogisticId": matuquan,
            "productType": "EXPRESS",
            "orderType": "1",
            "serviceType": "1",
            "partSign": 1,
            "deliveryType": "1",
            "totalQuantity": 1,
            "sender": {
                "name": "Áo Dài Gia Bảo",
                "mobile": "0888118855",
                "prov": "Đồng Nai",
                "city": "Thành phố Biên Hoà",
                "area": "Phường Long Bình-251TPB07",
                "address": "197 HBB"
            },
            "receiver": {
                "name": fbname,
                "mobile": phone,
                "prov": tinh,
                "city": huyen,
                "area": xa,
                "address": address
            },
            "payType": "PP_PM",
            "goodsType": "bm000010",
            "goodsValue": cod.toString(),
            "codMoney": cod.toString(),
            "itemsValue": cod.toString(),
            "remark": note,
            "englishName": "none",
            "packageInfo": {
                "weight": kg,
                "length": 10, "width": 10, "height": 10, "volume": "10"
            },
            "items": [{
                "itemName": product_name,
                "englishName": "None",
                "number": 1,
                "itemValue": cod
            }]
        });

        const digest = md5ToBase64(oderjson + pkey);
        const params = new URLSearchParams();
        params.append('bizContent', oderjson);

        try {
            const response = await axios.post(
                'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/addOrder',
                params,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'apiAccount': apiAccount,
                        'digest': digest,
                        'timestamp': Date.now().toString()
                    },
                    timeout: 5000
                }
            );

            const body = response.data;

            if (body.msg === 'success') {
                const userId = req.user.id;
                const sqlOrder = `
                    INSERT INTO lendon 
                    (name, phone, address, cod, kg, status, date, orderid, realorderid, khid, userid, realfbid, time, provider, sortline, statuscode, statustext, useraccountid)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'J&T', ?, ?, ?, ?)`;//dung userid
                await db.query(sqlOrder, [
                    fbname, phone, address, cod, kg,
                    1, timenow, matuquan, body.data.billCode,
                    khid, userid, realfbid, body.data.sortLine || null,
                    100, 'Mới tạo', userId
                ]);

                await GetBillJT(matuquan, userId);//matuquan

                return res.json({
                    success: true,
                    message: "Lên đơn J&T thành công",
                    order_code: body.data.billCode,
                    sort_line: body.data.sortLine
                });
            } else {
                return res.json({ success: false, message: "J&T từ chối: " + body.msg });
            }

        } catch (error) {
            console.error('Lỗi Create Order J&T:', error.message);
            return res.json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
        }
    });

    async function GetBillJT(orderid, userId) {
        const db = DBConnection.promise();
        const io = socket.getIo();
        const pkey = '47e60fbcc61544dcb85d30acd39d5e66';
        const apiAccount = '813258343706625024';
        const oderjson = JSON.stringify({
            "customerCode": "251LC12614",
            "password": "F55D925970D227346C2422F74FE0A9C3",
            "txlogisticId": orderid
        });
        const digest = md5ToBase64(oderjson + pkey);
        const params = new URLSearchParams();
        params.append('bizContent', oderjson);

        try {
            const response = await axios.post(
                'https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/printOrder',
                params,
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'apiAccount': apiAccount,
                        'digest': digest,
                        'timestamp': Date.now().toString()
                    },
                    timeout: 3000
                }
            );

            const body = response.data;
            if (body.msg === 'success' && body.data?.base64EncodeContent) {
                await db.query(
                    'INSERT INTO jtbill (billcode, base64) VALUES (?, ?)',
                    [orderid, body.data.base64EncodeContent]
                );
                const userRoom = `USER_ROOM_${userId}`;
                io.to(userRoom).emit("print-now", {
                    type: 'pdf',
                    base64: body.data.base64EncodeContent,
                    config: {
                        printerName: "HPRT N41",
                        widthMm: 80,
                        heightMm: 80
                    }
                });
                return true;
            } else {
                console.error(`❌ Lỗi lấy bill J&T (${orderid}):`, body.msg);
                return false;
            }
        } catch (error) {
            console.error(`❌ Lỗi kết nối lấy bill J&T:`, error.message);
            return false;
        }
    }

    function applyAddressFixes(sWard, sDist) {

        sWard = (sWard || '').toLowerCase().normalize('NFC').trim();
        sDist = (sDist || '').toLowerCase().normalize('NFC').trim();

        sWard = sWard.replace(/\s*-\s*(h\.|huyện|quận|tt|tx|thị trấn|thị xã).*$/i, '').trim();

        if (sWard === 'cần guộc') sWard = 'cần giuộc';
        if (sWard === 'eatling') sWard = 'ea tling';
        if (sDist === 'phú xuân') sDist = 'huế';
        if (sDist === 'gò vấp' && ['1', '3', '4', '5', '7'].includes(sWard)) sWard = '0' + sWard;
        if (sDist === 'bình giang' && sWard === 'thái minh') sWard = 'bình minh';
        if (sDist === 'nghĩa hưng' && sWard === 'đông thịnh') sWard = 'nghĩa Đồng';
        if (sDist === 'xuân trường' && sWard === 'xuân phúc') sWard = 'xuân hòa';
        if (sDist === 'quỳ châu' && sWard === 'quỳ châu') sWard = 'tân lạc';
        if (sDist === 'đạ huoai' && sWard === 'quốc oai') sDist = 'đạ tẻh';
        if (sDist === 'đạ huoai' && sWard === 'mỹ đức') sDist = 'đạ tẻh';
        if (sDist === 'đạ huoai' && sWard === 'đạ kho') sDist = 'đạ tẻh';
        if (sDist === 'long điền' && sWard === 'tam an') sWard = 'an ngãi';
        if (sWard === 'đạ tẻh' && sDist === 'đạ huoai') sDist = 'đạ tẻh';
        if (sDist === 'đạ huoai' && sWard === 'quảng ngãi') sDist = 'cát tiên';
        if (sDist === 'đạ huoai' && sWard === 'phước cát') sDist = 'cát tiên';
        if (sDist === 'đạ huoai' && sWard === 'cát tiên') sDist = 'cát tiên';
        if (sDist === 'phú lộc' && sWard === 'hương lộc') sDist = 'nam đông';
        if (sDist === 'giao thủy' && sWard === 'giao thủy') sWard = 'ngô đồng';
        if (sDist === 'cẩm giàng' && sWard === 'phúc điền') sWard = 'cẩm phúc';
        if (sDist === 'kim thành' && sWard === 'hòa bình') sWard = 'Liên Hòa';
        if (sDist === 'kim thành' && sWard === 'vũ dũng') sWard = 'cổ dũng';
        if (sDist === 'nam trực' && sWard === 'nam điền') sWard = 'nam mỹ';
        if (sDist === 'gia lộc' && sWard === 'quang đức') sWard = 'quang minh';
        if (sDist === 'nam sách' && sWard === 'an phú') sWard = 'an lâm';
        if (sDist === 'sơn dương' && sWard === 'hồng sơn') sWard = 'hồng lạc';
        if (sDist === 'chũ' && sWard === 'chũ') sDist = 'lục ngạn';
        if (sDist === 'chũ' && sWard === 'phượng sơn') sDist = 'lục ngạn';
        if (sDist === 'xuân trường' && sWard === 'xuân giang') sWard = 'xuân đài';

        if (sDist.includes('chư') && sDist.includes('pưh')) sDist = 'chư pưh';
        if (sWard.includes('đồng sơn') && sDist.includes('đồng hới')) sWard = 'đồng sơn';
        if (sDist === 'long điền' && ['đất đỏ', 'láng dài', 'lộc an', 'long mỹ', 'long tân', 'phước long thọ', 'phước hải', 'phước hội'].includes(sWard)) {
            sDist = 'đất đỏ';
        }
        return { sWard, sDist };
    }

    function normalizeSQL(field) {
        const pairs = [
            ['đặ pék', 'đắk pék'], ['kong dỡng', 'kon dỡng'], ['kon chro', 'Kông Chro'], ['iakha', 'ia kha'],
            ['iii', '3'], ['ba', '3'], ['ii', '2'], ['i', '1'],
            ['krông ana', 'krông a na'], ['mdrăk', 'mđrăk'], ['cư drăm', 'cư đrăm'], ['ia sao', 'iasao'],
            ['đất đỏ', 'long đất'], ['long điền', 'long đất'],
            ['cần guộc', 'cần giuộc'], ['bàu hàm 1', 'bàu hàm'],
            ['hoà', 'hòa'], ['hoả', 'hỏa'], ['hoã', 'hỏa'], ['hoạ', 'họa'],
            ['oà', 'òa'], ['oả', 'ỏa'], ['oã', 'ỏa'], ['oạ', 'òa'],
            ['uý', 'úy'], ['uỳ', 'ùy'], ['uỷ', 'ủy'], ['uỹ', 'ũy'], ['uỵ', 'ụy'],
            ['thuý', 'thúy'], ['thuỷ', 'thủy'], ['thuỵ', 'thụy'],
            ['mĩ', 'mỹ'], ['kĩ', 'kỹ'], ['kì', 'kỳ'], ['kí', 'ký'], ['vĩ', 'vỹ'], ['hĩ', 'hỹ'], ['ngĩ', 'nghĩ'],
            ['quí', 'quý'], ['quì', 'quỳ'], ['quỉ', 'quỷ'], ['quĩ', 'quỹ'], ['quị', 'quỵ'],
            ['mí', 'mỹ'], ['hì', 'hỳ'], ['tí', 'tý'],
            ['sĩ', 'sỹ'], ['đông xá', 'Ðông Xá'], ['vân đồn', 'Vân Đồn']
        ];

        let sql = field;
        pairs.forEach(p => {
            sql = `REPLACE(${sql}, '${p[0]}', '${p[1]}')`;
        });
        return sql;
    }

    function cleanSearchTerm(str) {
        if (!str) return "";
        let cleaned = str.toLowerCase().normalize('NFC').trim();
        if (cleaned.length > 10 && cleaned.charAt(cleaned.length - 9) === '-') {
            cleaned = cleaned.slice(0, -9).trim();
        }
        return cleaned
            .replace(/(kcn|phường|xã|quận|huyện|thị xã|thị trấn|tt|tx|thành phố|thi xã|thi trấn|đảo|p.) (?!\d)/gi, "")
            .replace('.', '')
            .replace(' (gia kiệm)', '')
            .replace('bà rịa - vũng tàu', 'bà rịa – vũng tàu')
            .replace('thừa thiên - huế', 'thừa thiên – huế')
            .replace("đăknhau", 'đăk nhau')
            .replace("h'leo", 'hleo')
            .replace("đăk môi", 'đăk môl')
            .replace("đưng k'nớh", 'đưng knớ')
            .replace("k'đơn", 'ka đơn')
            .replace("iasao", 'ia sao')
            .replace("- h chư pưh", '')
            .replace("iako", 'ia ko')
            .replace("iarsươm", 'ia rsươm')
            .replace("iabăng", 'ia băng')
            .replace("iabang", 'ia bang')
            .replace("iadin", 'ia din')
            .replace("nà trì", 'nà chì')
            .replace("liêng s'rônh", 'Liêng Srônh')
            .replace("linh đông", 'Linh Ðông')
            .replace("đất quốc", 'đất cuốc')
            .replace("đăk r'moan", 'đăk rmoan')
            .replace("hà ra", 'hra')
            .replace("ia gar", 'ia ga')
            .replace("chà vài", 'chà vàl')
            .replace('iakring', 'ia kring')
            .replace('iakênh', 'ia kênh')
            .replace('chưhdrông', 'chư hdrông')
            .replace('iake', 'ia ake')
            .replace('iamơrơn', 'ia mrơn')
            .replace('nham biền', 'nham bền')
            .replace('eakao', 'ea kao')
            .replace("h'nol", 'hnol')
            .replace("p quang hanh", 'quang hanh')
            .replace('thuận hóa', 'huế')
            .replace('cuebuor', 'xã cư êbur')
            .replace('chưr căm', 'chư rcăm')
            .replace('madaguoil', 'ma đa guôi')
            .replace('madagoil', 'ma đa guôi')
            .replace("đạm'ri", 'đạ mri')
            .replace('lâm ðồng', 'lâm đồng')
            .replace('bình ðịnh', 'bình định')
            .replace('krông pắk', 'krông pắc')
            .replace('ea kmêc', 'ea knuêc')
            .replace("ea m'nang", 'ea mnang')
            .replace("cư m'gar", 'cư mgar')
            .replace("m'đrắk", 'mdrăk')
            .replace("cư m'ta", 'cư mta')
            .replace("mỹ đình ii", 'mỹ đình 2')
            .replace("mỹ đình i", 'mỹ đình 1')
            .replace("an hoà", 'an hòa')
            .replace("đắk rô", 'đắk drô')
            .replace("eatu", 'ea tu')
            .replace("eatam", 'ea tam')
            .replace("cuôr dăng", 'cuôr đăng')
            .replace("long hoà", 'long hòa')
            .replace("long đất", 'long điền')
            .replace("nâm n jang", 'nâm njang')
            .replace("thuận hóa", 'huế')
            .replace("nam ðịnh", 'nam định')
            .replace("đliê ya", 'dliê ya')
            .replace("simacai", 'si ma cai')
            .replace("đà tẻh", 'đạ tẻh')
            .replace("pơngdrang", 'pơng drang')
            .replace("tông lệnh", 'tông lạnh')
            .replace("thứ 11", 'thứ mười một')
            .replace("tân hội cơ", 'tân hộ cơ')
            .trim();
    }

    router.post('/printjtex', jwtAuth, function (req, res) {
        var orderid = req.body.orderid;
        PrintBillJT(orderid);
        res.sendStatus(200)
    });
    router.post('/cancelorderjt', jwtAuth, async function (req, res) {
        var orderid = req.body.orderid;
        const mess = await CancelOrderJT(orderid);
        res.json({ message: mess });
    });
    router.post('/getrealfbid', jwtAuth, function (req, res) {
        res.sendStatus(200);
        return;
        var userid = req.body.userid;
        var tag = req.body.tag;
        if (tag == 'null' && tag == null || tag == undefined) {
            console.log('Null Tag');
            return;
        }
        (async () => {
            const browser = await getBrowser();
            const page2 = await browser.newPage();
            await page2.bringToFront();
            await page2.goto('https://business.facebook.com/latest/inbox/', { waitUntil: 'networkidle2' });
            const inputSelector = '#js_6g';

            await page2.waitForSelector(inputSelector, { visible: true });
            await page2.evaluate((selector, text) => {
                const input = document.querySelector(selector);
                input.value = text;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }, inputSelector, tag);

            const classSelector = '.x2izyaf.x1ejq31n.x18oe1m7.xstzfhl.xso031l.x1q0q8m5.xy7tls4.x6ikm8r.x10wlt62.xlyipyv.xuxw1ft';
            const classSelector2 = '._4ik4._4ik5';
            try {
                await page2.waitForSelector(classSelector, { visible: true });
                await delay(500);
                if (classSelector) {
                    await classSelector.click();
                } else {
                    console.log("Không tìm thấy dòng chữ này!");
                }
                await page2.waitForSelector(classSelector2, { visible: true });
                await delay(500);
                await page2.click(classSelector2);
            } catch (error) {
                console.error('Lỗi khi chờ hoặc click:', error);
            }
            var realid = page2.url().split('selected_item_id=').pop().split('&')[0];
            var sql = SqlString.format(`UPDATE khachhang SET realfbid=? WHERE userid=?`, [realid, userid]);
            if (isNumeric(realid)) {
                DBConnection.query(sql);
                console.log('Update Real ID: ' + realid);
            }
            await page2.close();
            res.json({
                data: realid
            });
        })();
    });

    router.post('/printviettel', function (req, res) {
        const { html, realorderid } = req.body;
        try {
            fs.writeFileSync(`C:/GB/src/public/donhang/${realorderid}.txt`, html);
        } catch (e) { console.log("Lỗi ghi file:", e); }
        res.json({ success: true });
    });

    router.post("/gettoken", jwtAuth, function (request, response, next) {
        (async () => {
            const browser = await getBrowser();
            const page = await browser.newPage();
            var token = '';
            try {
                await page.goto('https://www.facebook.com/v11.0/dialog/oauth?response_type=token&client_id=1733556690196497&redirect_uri=https://pages.fm&state=eyJyZWRpcmVjdF90byI6Imh0dHBzOi8vcGFnZXMuZm0iLCJjb3VudHJ5IjoiVk4iLCJsb2NhbGUiOiJ2aSJ9&scope=public_profile,email,pages_manage_metadata,pages_read_engagement,pages_show_list,pages_read_user_content,pages_manage_posts,pages_manage_engagement,read_page_mailboxes,pages_messaging,pages_messaging_subscriptions,ads_read,page_events,instagram_basic,instagram_manage_messages,instagram_manage_comments');

                await Promise.all([
                    page.click('#platformDialogForm > div > div.clearfix._ikh > div > div > div > div:nth-child(4) > div > div > div.x6s0dn4.x78zum5.x1q0g3np.x1qughib.xexx8yu.xx281p9.x156go17.x67w97k > div.x78zum5.x1q0g3np.xdzyupr > div:nth-child(2) > div > div'),
                    page.waitForNavigation({ waitUntil: 'networkidle2' })
                ]);
            } catch (e) {
                console.log(e);
                response.json({ data: { error: "Lỗi Get token" } });
                return;
            }

            const url = page.url();
            if (url.includes('access_token')) {
                token = url.split('token=').pop().split('&')[0];
                await page.goto('https://graph.facebook.com/me/accounts?access_token=' + token);
                const body = await page.$eval('*', (el) => el.innerText);
                var result = JSON.parse(body.replaceAll(" ", ""));
                await page.close();

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
                response.json({ data: result });
            } else {
                await page.close();
                response.json({ data: { error: "Lỗi Get Token 2" } });
                console.log('Loi Gettoken');
            }
        })();
    });

    const download = function (uri, filename, destinationPath) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(destinationPath)) {
                fs.mkdirSync(destinationPath, { recursive: true });
            }
            request.head(uri, function (err, res) {
                if (err) {
                    return reject(err);
                }
                const contentType = res.headers['content-type'];
                let fileExtension = mime.extension(contentType);
                if (uri.includes('audioclip')) {
                    fileExtension = 'mp3';
                }
                let newFilename = filename;
                if (fileExtension) {
                    newFilename += `.${fileExtension}`;
                }
                const fullPath = path.join(destinationPath, newFilename);
                request(uri).pipe(fs.createWriteStream(fullPath)).on('close', () => {
                    resolve(fileExtension);
                }).on('error', (e) => {
                    reject(e);
                });
            });
        });
    };


    var currentlivetime;
    router.post("/scancomment", jwtAuth, function (request, response, next) {
        currentlivetime = 0;
        const sb = new StringBuilder();
        var liveidxx = request.body.liveid;
        var soluong = request.body.soluong;
        const liveidarray = liveidxx.replaceAll(' ', '').split(",");
        var zzz = '';

        (async () => {
            for (var j = 0; j < liveidarray.length; j++) {
                zzz = zzz + `liveid='${liveidarray[j]}' OR `;
                var query = `https://graph.facebook.com/${liveidarray[j]}/?fields=title,live_status,from,created_time,description,comments.limit(1000).order(reverse_chronological){from{name,id,picture.height(50).width(50)},created_time,message,live_broadcast_timestamp,application{name}}&version=v13.0&access_token=${PAGE_ACCESS_TOKEN}`;

                let result;
                try {
                    const res = await fetch(query);
                    if (!res.ok) {
                        console.error(`Facebook API HTTP error: ${res.status} ${res.statusText}`);
                        return response.json({ data: JSON.parse('{"error": "Lỗi kết nối Facebook API: ' + res.status + '"}') });
                    }
                    result = await res.json();
                } catch (fetchErr) {
                    console.error('fetch failed:', fetchErr.message);
                    return response.json({ data: JSON.parse('{"error": "Lỗi kết nối Facebook: ' + fetchErr.message + '"}') });
                }

                if (!result.hasOwnProperty('id')) {
                    console.log('Loi Live ID khong ton tai!');
                    return response.json({ data: JSON.parse('{"error": "Lỗi sai LiveId"}') });
                }

                var livecreatedtime = new Date(result.created_time).toLocaleString("en-US", { timeZone: "Asia/Saigon" });
                currentlivetime = result.created_time;
                var sqllive = SqlString.format(
                    'INSERT IGNORE INTO livestream (id,name,time,note,luotincuoi,luotlive,livedesc) VALUES(?,?,?,?,?,?,?);INSERT IGNORE INTO pageinfo (pageid, name) VALUES (?,?);',
                    [result.id, result.title, livecreatedtime, '', '', '', result.description, result.from.id, result.from.name]
                );
                try {
                    DBConnection.query(sqllive);
                } catch (e) {
                    console.log('ERROR: SQL ERROR');
                    return response.json({ data: JSON.parse('{"error": "Lỗi kết nối SQL"}') });
                }

                if (!result.hasOwnProperty('comments')) {
                    console.log('Trying to scan livestream with no comment!');
                    return response.json({ data: JSON.parse('{"error": "Lỗi live chưa có bình luận"}') });
                }

                for (var i = 0; i < result.comments.data.length; i++) {
                    var appname = '';
                    if (result.comments.data[i].hasOwnProperty('application')) {
                        appname = result.comments.data[i].application.name;
                    } else {
                        appname = 'None';
                    }
                    var timelocal = new Date(result.comments.data[i].created_time).toLocaleString("en-US", { timeZone: "Asia/Saigon" });
                    var timeint = result.comments.data[i].live_broadcast_timestamp;

                    if (String(timeint) === 'undefined') {
                        timeint = 0;
                    }
                    var timecmt = new Date(timeint * 1000).toISOString().substring(11, 19);
                    var fromuser = result.comments.data[i].from.name;

                    var sql = SqlString.format(
                        'INSERT IGNORE INTO livecomment (commentid,liveid,userid,name,message,chot,gia,timecomment,datecreate,luotin,count,app,pageid) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE timecomment=?,app=?,count=?;INSERT INTO khachhang (userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex) VALUES(?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE fbname=?, fbnamex=?, avalink=?;',
                        [
                            result.comments.data[i].id, result.id, result.comments.data[i].from.id, fromuser,
                            result.comments.data[i].message, '', '', timecmt, timelocal, 0, timeint, appname, result.from.id,
                            timecmt, appname, timeint,
                            result.comments.data[i].from.id, fromuser, '', '', result.comments.data[i].from.picture.data.url,
                            '', '', '', result.from.id, LocDau(fromuser), fromuser, LocDau(fromuser),
                            result.comments.data[i].from.picture.data.url
                        ]
                    );
                    sb.appendLine().append(sql);
                    download(result.comments.data[i].from.picture.data.url, result.comments.data[i].from.id, 'C:/GB/src/public/images/ava/');
                }
            }

            try {
                DBConnection.query(sb.toString());
            } catch (e) {
                console.log('ERROR: Insert comment error');
                return;
            }

            DBConnection.query(
                ` SELECT livecomment.idx, livecomment.mess, livecomment.userid, livecomment.timecomment, livecomment.name, livecomment.message, livecomment.datecreate, livecomment.chot, livecomment.gia, livecomment.commentid, livecomment.luotin, livecomment.count, livecomment.app, livecomment.liveid, livecomment.pageid, livecomment.updateava, livecomment.realfbid, khachhang.id, khachhang.phone, khachhang.diachi, khachhang.avalink, khachhang.label, khachhang.note, khachhang.fbnamex, khachhang.aka, khachhang.nuocngoai, khachhang.realfbid, khachhang.threadid FROM livecomment INNER JOIN khachhang ON (livecomment.userid=khachhang.userid) AND (${zzz.substring(0, zzz.length - 4)}) ORDER BY idx DESC LIMIT ${soluong}`,
                function (error, data) {
                    response.json({ data: data });
                }
            );
        })();
    });

    router.post("/deleteallpost2", jwtAuth, function (req, response, next) {
        var z, y = 0;
        var token = '';
        (async () => {
            var query = `https://graph.facebook.com/v23.0/102116919355833/feed?limit=100&access_token=${token}`;
            const res = await fetch(query);
            if (res.ok) {
                const result = await res.json();
                z = result.data.length;
                for (var j = 0; j < result.data.length; j++) {
                    var t = 0;
                    y = j;
                    var queryx = `https://graph.facebook.com/v23.0/${result.data[j].id}?access_token=${token}`;
                    request({
                        url: encodeURI(queryx),
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'access_token': token
                        }
                    }, async function (error, response, bodyx) {
                        var body = JSON.parse(bodyx.replaceAll(" ", "").replaceAll(/\n/g, " "));
                        if (body.hasOwnProperty('success')) {
                            console.log('P2:' + y)
                        } else {
                            console.log(body)
                        }
                        t = 1;
                    });
                    await WaitUntil(_ => t == 1);
                    console.log(result.data[j].id)
                    t = 0;
                }
            }
        })();
        if (z - 1 == y) {
            console.log('Done')
        }
        response.json({
            data: 'x'
        });
    });
    router.post("/deleteallpost", jwtAuth, function (req, response, next) {
        var token = '';
        var z, y = 0;
        (async () => {
            var query = `https://graph.facebook.com/v23.0/223266991771270/feed?limit=100&access_token=${token}`;
            const res = await fetch(query);
            if (res.ok) {
                const result = await res.json();
                z = result.data.length;
                for (var j = 0; j < result.data.length; j++) {
                    var t = 0;
                    y = j;
                    var queryx = `https://graph.facebook.com/v23.0/${result.data[j].id}?access_token=${token}`;
                    request({
                        url: encodeURI(queryx),
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                            'access_token': token
                        }
                    });
                }
            }
        })();

        response.json({
            data: 'x'
        });
    });

    router.post("/action", jwtAuth, function (request, response, next) {
        var liveid = request.body.liveid;
        DBConnection.query(' SELECT livecomment.idx, livecomment.mess, livecomment.userid, livecomment.timecomment, livecomment.name, livecomment.message, livecomment.datecreate, livecomment.chot, livecomment.gia, livecomment.commentid, livecomment.luotin, livecomment.count, livecomment.app, livecomment.liveid, livecomment.pageid, livecomment.updateava, livecomment.realfbid, khachhang.id, khachhang.phone, khachhang.diachi, khachhang.avalink, khachhang.label, khachhang.note, khachhang.fbnamex, khachhang.aka, khachhang.nuocngoai, khachhang.realfbid, khachhang.threadid FROM livecomment INNER JOIN khachhang ON livecomment.userid=khachhang.userid AND liveid= ? ', liveid,
            function (error, data) {
                if (error) {
                    response.json({
                        data: JSON.parse('{"error": "SQL ERROR"}')
                    });
                    throw error;
                } else {
                    response.json({
                        data: data
                    });
                }
            });
    });

    router.get('/khachhang', webAuth, function (req, res) {
        res.render('khachhang', { user: req.user });
    });
    router.get('/readcomment', webAuth, readcommentController.handleReadComment);

    router.post('/getdiachilendon', async function (req, response) {
        const phone = req.body.phone;
        const userid = req.body.userid || '';

        if (!phone || !userid) {
            return response.status(400).json({ error: 'Thiếu phone hoặc userid' });
        }

        try {
            const addressData = await new Promise((resolve, reject) => {
                const q = `SELECT * FROM diachilendon WHERE phone=? AND userid=? ORDER BY id DESC`;
                DBConnection.query(q, [phone, userid], (err, res) => err ? reject(err) : resolve(res));
            });

            response.json({
                data: addressData.map(item => ({
                    ...item,
                    jtready: !!(item.xajt && item.huyenjt && item.tinhjt)
                }))
            });

            const missingAddresses = addressData.filter(item => !item.xa);
            if (missingAddresses.length === 0) return;

            const tokenData = await new Promise((resolve) => {
                DBConnection.query(`SELECT token FROM vietteltoken LIMIT 1`, (err, res) => resolve(res));
            });
            if (!tokenData || tokenData.length === 0) return;
            const token = tokenData[0].token;

            for (const item of missingAddresses) {
                try {
                    const nlpRes = await axios.post('https://partner.viettelpost.vn/v2/order/getPriceAllNlp', {
                        "SENDER_ADDRESS": "Long Bình, biên Hòa, Đồng Nai",
                        "RECEIVER_ADDRESS": item.address,
                        "PRODUCT_TYPE": "HH",
                        "PRODUCT_WEIGHT": 100,
                        "TYPE": 1
                    }, { headers: { 'token': token } });

                    const body = nlpRes.data;
                    const rec = body.RECEIVER_ADDRESS;

                    if (body.error || !rec || !rec.WARD_ID) continue;

                    const [resTinh, resHuyen, resXa] = await Promise.all([
                        axios.get(`https://partner.viettelpost.vn/v2/categories/listProvinceById?provinceId=${rec.PROVINCE_ID}`),
                        axios.get(`https://partner.viettelpost.vn/v2/categories/districtByIdAndProvince?districtId=${rec.DISTRICT_ID}&provinceById=${rec.PROVINCE_ID}`),
                        axios.get(`https://partner.viettelpost.vn/v2/categories/wardByDistrictAndId?districtId=${rec.DISTRICT_ID}&wardsId=${rec.WARD_ID}`)
                    ]);

                    const tinh = (resTinh.data && resTinh.data.data && resTinh.data.data[0]) ? resTinh.data.data[0].PROVINCE_NAME : '';
                    const huyen = (resHuyen.data && resHuyen.data.data) ? resHuyen.data.data.DISTRICT_NAME : 'Không xác định';
                    const xa = (resXa.data && resXa.data.data) ? resXa.data.data.WARDS_NAME : '';
                    if (xa && huyen && tinh) {
                        const sProv = cleanSearchTerm(tinh);
                        let sDist = cleanSearchTerm(huyen);
                        let sWard = cleanSearchTerm(xa);
                        sWard = sWard.replace(/phường|xã/gi, "").trim();
                        ({ sWard, sDist } = applyAddressFixes(sWard, sDist));

                        console.log(`${sWard} - ${sDist} - ${sProv}`)

                        const findJT = `
                            SELECT * 
                            FROM jtaddress
                            WHERE 
                                ${normalizeSQL('LOWER(prov)')} LIKE ${normalizeSQL('LOWER(?)')}
                                AND ${normalizeSQL('LOWER(district)')} LIKE ${normalizeSQL('LOWER(?)')}
                                AND (
                                    ${normalizeSQL('LOWER(ward)')} LIKE ${normalizeSQL('LOWER(?)')}
                                )
                            ORDER BY 
                                (LOWER(ward) LIKE ?) DESC,
                                (LOWER(district) = ?) DESC,
                                LENGTH(ward) ASC
                            LIMIT 1`;
                        const [jtRows] = await DBConnection.promise().query(findJT, [
                            `%${sProv}%`,
                            `%${sDist}%`,
                            `%${sWard}%`,
                            `${sWard}%`,
                            sDist
                        ]);
                        if (jtRows.length > 0) {
                            const jt = jtRows[0];
                            const updateSql = SqlString.format(
                                'UPDATE diachilendon SET xa=?, huyen=?, tinh=?, xajt=?, huyenjt=?, tinhjt=?, xamoi=?, tinhmoi=? WHERE id=?',
                                [xa, huyen, tinh, jt.ward, jt.district, jt.prov, jt.newward, jt.newprov, item.id]
                            );
                            DBConnection.promise().query(updateSql);
                        } else {
                            return res.json({
                                success: false,
                                message: `J&T không có dữ liệu cho địa chỉ: ${xa} - ${huyen} - ${tinh}.`
                            });
                        }
                    }
                } catch (innerError) {
                    console.error(`Lỗi xử lý địa chỉ ID ${item.id}:`, innerError.message);
                }
            }

        } catch (error) {
            console.error('Lỗi router getdiachilendon:', error.message);
            if (!response.headersSent) {
                response.status(500).json({ error: "Lỗi server" });
            }
        }
    });

    router.post('/getfullinfo', jwtAuth, function (req, response) {
        var id = req.body.id;
        DBConnection.query(` SELECT * FROM khachhang WHERE id='${id}'`,
            async function (error, data) {
                response.json({
                    data: data
                });
            });
    });
    router.post('/updatediachilendon', jwtAuth, function (req, response) {
        var dccu = req.body.dccu;
        var dcmoi = req.body.dcmoi;
        DBConnection.query(SqlString.format(`UPDATE diachilendon SET address=? WHERE address=?;`, [dcmoi, dccu]));
        response.sendStatus(200);
    });
    router.post('/xoadonhang', jwtAuth, function (req, response) {
        var id = req.body.id;
        var all = req.body.all;
        var sql = ``;
        if (all > 0) {
            sql = SqlString.format('UPDATE lendon set status=0;');
        } else {
            sql = SqlString.format(`DELETE FROM lendon WHERE orderid=? OR (realorderid=? && realorderid !='');`, [id, id]);
        }
        DBConnection.query(sql);
        response.json({
            id: id
        });
    });


    router.post('/updateuserpsid', jwtAuth, async function (req, response) {
        const { psid, pageid } = req.body;
        let token = '';

        if (pageid === GlobalPageID) {
            token = PAGE_ACCESS_TOKEN;
        } else if (pageid === GlobalPageID2) {
            token = PAGE_ACCESS_TOKEN2;
        } else {
            return response.status(400).json({ error: 'Page ID không hợp lệ' });
        }

        const graphApiUrl = `https://graph.facebook.com/v15.0/${psid}/?fields=picture{url},name&access_token=${token}`;

        try {
            const fbRes = await axios.get(graphApiUrl);
            const data = fbRes.data;

            if (data && data.name) {
                const avatarUrl = (data.picture && data.picture.data && data.picture.data.url) ? data.picture.data.url : '';
                const fbName = data.name;
                const updateSql = SqlString.format(
                    'UPDATE khachhang SET avalink=?, fbname=?, fbnamex=? WHERE userid=?;',
                    [avatarUrl, fbName, LocDau(fbName), psid]
                );

                await new Promise((resolve, reject) => {
                    DBConnection.query(updateSql, (err, res) => err ? reject(err) : resolve(res));
                });

                console.log('Updated: ' + fbName);
                download(avatarUrl, data.id, 'C:/GB/src/public/images/ava/');

                response.json({
                    success: true,
                    data: data
                });
            }
        } catch (error) {
            console.error('Lỗi khi cập nhật PSID:', error.message);
            response.status(500).json({
                success: false,
                error: 'Lỗi khi gọi API Facebook hoặc lỗi Database'
            });
        }
    });

    router.post('/detailcomment', jwtAuth, function (req, res) {
        var cmtid = req.body.commentid;
        var userid = req.body.userid;
        DBConnection.query(" SELECT token FROM usertoken WHERE id=1",
            async function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    let token = data[0].token;
                    const browser = await getBrowser();
                    const page = await browser.newPage();
                    await page.goto(`https://graph.facebook.com/v16.0/${cmtid}?fields=from,id,created_time,live_broadcast_timestamp,message,application&access_token=${token}`);
                    const body = await page.$eval('*', (el) => el.innerText);
                    const bodyx = JSON.parse(body);
                    await page.close();
                    if (error) {
                        res.json({
                            error: 'Lỗi Token'
                        });
                    } else {
                        if (bodyx.hasOwnProperty('from')) {
                            var timecmt = 0;
                            if (bodyx.hasOwnProperty('live_broadcast_timestamp')) {
                                timecmt = new Date(bodyx.live_broadcast_timestamp * 1000).toISOString().substring(11, 19);
                            }
                            res.json({
                                data: bodyx
                            });
                            const realfbid_moi = bodyx.from.id;
                            const userid_hientai = userid;

                            const sql_select = SqlString.format('SELECT phone, diachi, note, nuocngoai FROM khachhang WHERE realfbid = ? AND userid != ? LIMIT 1', [realfbid_moi, userid_hientai]);

                            DBConnection.query(sql_select, (error, results) => {
                                if (error) {
                                    console.error('Lỗi khi SELECT khách hàng cũ:', error);
                                    return;
                                }
                                let sql_update_khachhang = '';
                                if (results && results.length > 0) {
                                    const old_customer = results[0];

                                    sql_update_khachhang = SqlString.format(
                                        'UPDATE khachhang SET realfbid=?, phone=?, diachi=?, note=?, nuocngoai=? WHERE userid=?',
                                        [realfbid_moi, old_customer.phone, old_customer.diachi, old_customer.note, old_customer.nuocngoai, userid_hientai]
                                    );
                                } else {
                                    sql_update_khachhang = SqlString.format(
                                        'UPDATE khachhang SET realfbid=? WHERE userid=?',
                                        [realfbid_moi, userid_hientai]
                                    );
                                }

                                let sql_update_livecmt = SqlString.format(
                                    'UPDATE livecomment SET realfbid=?, count=?, timecomment=?, app=? WHERE commentid=?',
                                    [realfbid_moi, bodyx.live_broadcast_timestamp, timecmt, bodyx.application.name, cmtid]
                                );

                                let sql_final = sql_update_livecmt + '; ' + sql_update_khachhang;
                                DBConnection.query(sql_final);
                            });

                        } else {
                            res.json({
                                data: bodyx
                            });
                        }
                    }
                }
            });
    });

    router.post('/replycomment', jwtAuth, function (req, res) {
        var cmtid = req.body.commentid;
        var pageid = req.body.pageid;
        var userid = req.body.userid;
        var chat = req.body.chat.replace(/(?:\r\n|\r|\n)/g, '\\n');
        var type = '';
        var baseon = '';
        var id = '';
        if (cmtid === '' || chat.includes('..')) {
            type = 'UPDATE';
            baseon = 'id';
            id = userid;
        } else {
            type = 'RESPONSE';
            baseon = 'comment_id';
            id = cmtid;
        }
        DBConnection.query(" SELECT accesstoken from pageinfo WHERE pageid='" + pageid + "'",
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    let token = data[0].accesstoken;
                    var query = `https://graph.facebook.com/v10.0/me/messages?access_token=${token}&recipient={"${baseon}":"${id}"}&messaging_type=${type}&message={"text":"${chat}"}`;
                    request({
                        url: encodeURI(query),
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }, function (error, response, bodyx) {
                        var body = JSON.parse(bodyx.replaceAll(" ", "").replaceAll(/\n/g, " "));
                        if (error) {
                            console.log(error + ": " + id);
                        } else {
                            res.json({
                                data: body
                            });
                            if (response.statusCode == 200) {
                                var psid = body.recipient_id;
                                DBConnection.query(" UPDATE khachhang SET psid='" + psid + "' WHERE userid='" + userid + "'");
                            } else {
                                console.log(body.error.message);
                            }
                        }
                    });
                }
            });
    });
    router.post('/getthread', jwtAuth, function (req, res) {
        var pageid = req.body.pageid;
        var threadid = req.body.threadid;
        var userid = req.body.userid;
        if (threadid != '0' && userid != '') {
            DBConnection.query(`UPDATE khachhang SET threadid='${threadid}' WHERE userid='${userid}';`);
        }
        DBConnection.query(" SELECT accesstoken FROM pageinfo WHERE pageid='" + pageid + "'",
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    let token = data[0].accesstoken;
                    var query = `https://graph.facebook.com/${threadid}?fields=messages.limit(10){from,attachments,message,created_time,sticker},updated_time&access_token=${token}`;
                    request({
                        url: encodeURI(query),
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    }, function (error, response, bodyx) {
                        var body = JSON.parse(bodyx);
                        if (error) {
                            console.log(error);
                        } else {
                            res.json({
                                data: body
                            });
                        }
                    });
                }
            });
    });
    router.post('/updateaddress', jwtAuth, function (req, res) {
        var address = req.body.address;
        var userid = req.body.userid;
        DBConnection.query(SqlString.format(` UPDATE khachhang SET diachi=? WHERE userid=?`, [address, userid]),
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    res.json({
                        data: userid
                    });
                }
            });
    });
    router.post('/updateaddress2', jwtAuth, function (req, res) {
        var address = req.body.address;
        var userid = req.body.userid;
        var sql = SqlString.format(` UPDATE khachhang SET diachi=? WHERE userid=?`, [address, userid]);
        DBConnection.query(sql,
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    res.json({
                        data: userid
                    });
                }
            });
    });
    router.post('/onupdatephone', jwtAuth, function (req, res) {
        var phone = req.body.phone;
        var userid = req.body.userid;
        DBConnection.query(SqlString.format(` UPDATE khachhang SET phone=? WHERE userid=?`, [phone, userid]),
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    res.json({
                        data: userid
                    });
                }
            });
    });
    router.post('/onupdatenote', jwtAuth, function (req, res) {
        var note = req.body.note;
        var userid = req.body.userid;
        DBConnection.query(SqlString.format(` UPDATE khachhang SET note=? WHERE userid=?`, [note, userid]),
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    res.json({
                        data: userid
                    });
                }
            });
    });
    router.post('/updaterealfbid', jwtAuth, function (req, res) {
        var realfbid = req.body.realfbid;
        var userid = req.body.userid;
        DBConnection.query(SqlString.format(` UPDATE khachhang SET realfbid=? WHERE userid=?`, [realfbid, userid]),
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    res.json({
                        data: realfbid
                    });
                }
            });
    });

    router.post('/getconversations', jwtAuth, function (req, res) {
        DBConnection.query(" SELECT pageid,accesstoken from pageinfo",
            function (error, data) {
                if (error) {
                    throw error;
                }
                else {
                    for (var i = 0; i < data.length; i++) {
                        const sb = new StringBuilder();
                        let token = data[i].accesstoken;
                        let pageid = data[i].pageid;
                        (async () => {
                            var query = `https://graph.facebook.com/${pageid}/conversations?fields=id,senders,updated_time&limit=499&access_token=${token}`;
                            request({
                                url: encodeURI(query),
                                method: 'GET',
                                headers: {
                                    'Content-Type': 'application/json'
                                }
                            }, function (error, response, bodyx) {
                                var body = JSON.parse(bodyx.replaceAll(" ", "").replaceAll(/\n/g, " "));
                                if (error) {
                                    console.log(error);
                                } else {
                                    for (var j = 0; j < body.data.length; j++) {
                                        var threadid = body.data[j].id;
                                        var psid = body.data[j].senders.data[0].id;
                                        var fbname = body.data[j].senders.data[0].name;
                                        var sql = SqlString.format('INSERT IGNORE INTO khachhang (threadid,userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE threadid=?;',
                                            [threadid, psid, fbname, '', '', '', '', '', '', pageid, LocDau(fbname), '', threadid]);
                                        sb.appendLine().append(sql);
                                    }
                                    DBConnection.query(sb.toString());
                                    console.log('Done: ' + pageid);
                                }
                            });
                        })();
                    }
                    res.json({
                        success: "Success"
                    });
                }
            });
    });

    router.post('/deletelive', jwtAuth, function (request, response, next) {
        var liveid = request.body.liveid;
        var sql = SqlString.format(`DELETE FROM livestream WHERE id='${liveid}'; DELETE FROM livecomment WHERE liveid='${liveid}'`);
        DBConnection.query(sql,
            function (error, data) {
            });
    });

    router.post('/getuserinfo', jwtAuth, function (request, response, next) {
        var stringforsearch = request.body.stringforsearch;
        var searchstring = LocDau(stringforsearch);

        if ((searchstring.length == 5 || searchstring.length == 12) && isNumeric(searchstring)) {
            const sqlQuery = `
            SELECT khachhang.* FROM lendon 
            INNER JOIN khachhang ON lendon.khid = khachhang.id 
            WHERE (lendon.statuscode != 501 AND lendon.statuscode != 504) AND lendon.realorderid LIKE ? AND time >= NOW() - INTERVAL 14 DAY
            ORDER BY lendon.id DESC
        `;
            const searchValue = `%${searchstring}%`;

            DBConnection.query(sqlQuery, [searchValue], function (error, data) {
                if (error) {
                    console.error(error);
                    return response.status(500).json({ error: 'Database query failed' });
                }

                if (data.length > 0) {
                    response.json({ data: data });
                } else {
                    const phoneQuery = `SELECT * FROM khachhang WHERE phone LIKE ?`;
                    DBConnection.query(phoneQuery, [searchValue], function (error, data) {
                        if (error) {
                            console.error(error);
                            return response.status(500).json({ error: 'Database query failed' });
                        }
                        response.json({ data: data });
                    });
                }
            });
            return;
        }

        var sdt = isNumeric(searchstring) ? 'phone' : 'fbnamex';
        const finalQuery = `SELECT * FROM khachhang WHERE ?? LIKE ? ORDER BY id DESC`;
        const finalValues = [sdt, `%${searchstring.replaceAll("'", "")}%`];

        DBConnection.query(finalQuery, finalValues, function (error, data) {
            if (error) {
                console.error(error);
                return response.status(500).json({ error: 'Database query failed' });
            }
            response.json({ data: data });
        });
    });

    router.post('/getcommentchot', jwtAuth, function (request, response, next) {
        var sllive = request.body.sllive;
        var userid = request.body.userid;
        var sb = '';
        var sql = SqlString.format("SELECT * FROM livestream order by idx desc limit ?;", [parseInt(sllive)]);
        DBConnection.query(sql, function (error, data) {
            if (data.length > 0) {
                for (var i = 0; i < data.length; i++) {
                    sb += `liveid='${data[i].id}' OR `;
                }
            }
            sb = sb.substring(0, sb.length - 4);
            DBConnection.query(SqlString.format(`SELECT * FROM livecomment WHERE (${sb}) AND userid=?;`, [userid]), function (error, data) {
                response.json({
                    data: data
                });
            });
        });
    });
    router.post('/updatechot', function (request, response, next) {
        const io = socket.getIo();
        var cid = request.body.commentid;
        var gia = request.body.gia;
        var chot = request.body.chot;
        var luotincuoi = request.body.luotincuoi;
        var luotcuoilive = request.body.luotcuoilive;
        var liveid = request.body.liveid;
        var slchot = request.body.slchot;
        if (!isNumeric(slchot) || slchot == '' || slchot == 0) {
            slchot = 1;
        }
        DBConnection.query(SqlString.format('UPDATE livecomment SET chot=?, gia=?, luotin=?, slchot=? WHERE commentid=?; UPDATE livestream SET luotincuoi=? WHERE id=?', [chot, gia, luotincuoi, slchot, cid, luotcuoilive, liveid]));
        const newChotData = {
            cid: cid,
            gia: gia,
            chot: chot,//nay la chu~ CHOT
            liveid: liveid,
            luotincuoi: luotincuoi,
            luotcuoilive: luotcuoilive,
            slchot: slchot
        };
        io.to(liveid).emit('new-chot', newChotData);
        response.json({
            data: cid
        });
    });
    router.post('/updatexa', function (request, response, next) {
        const io = socket.getIo();
        var chot = request.body.chot;
        var cid = request.body.commentid;
        var liveid = request.body.liveid;
        DBConnection.query(SqlString.format('UPDATE livecomment SET chot=?, gia=? WHERE commentid=?', [chot, '', cid]));
        const newXaData = {
            cid: cid,
            chot: chot,//nay la chu~ XA
        };
        io.to(liveid).emit('new-xa', newXaData);
        response.json({
            data: cid
        });
    });
    router.post('/updatephone', jwtAuth, function (request, response, next) {
        var name = '';
        var userid = request.body.userid;
        var phone = request.body.phone;
        var userrequest = '';
        var lastuser = '';
        var realfbid = request.body.realfbid;
        if (realfbid.length > 1) {
            DBConnection.query(SqlString.format('UPDATE khachhang SET phone=? WHERE userid=?', [phone, userid, realfbid]));
        } else {
            DBConnection.query(SqlString.format('UPDATE khachhang SET phone=? WHERE userid=?', [phone, userid]));
        }
        DBConnection.query(SqlString.format("SELECT fbname,userid,label,realfbid FROM khachhang WHERE phone=? GROUP BY realfbid", [phone]),
            function (error, data) {
                var xabom = 'none';
                if (data.length > 1) {
                    for (var i = 0; i < data.length; i++) {
                        if (data[i].userid == realfbid) {
                            return;
                        }
                        name += data[i].fbname + ' - ';
                        userrequest += data[i].userid + ';';
                        lastuser = userrequest.replaceAll(userid + ';', '');
                        if (data[i].label.includes('Xả')) {
                            xabom = 'Xả hàng'
                        } else if (data[i].label.includes('Bom')) {
                            xabom = 'Bom hàng'
                        } else if (data[i].label.includes('Có')) {
                            xabom = 'Có vấn đề'
                        }
                    }
                    name = name.substring(0, name.length - 3);
                    if (xabom == 'none') {
                        DBConnection.query(SqlString.format('UPDATE khachhang SET aka=?,akauid=? WHERE phone=?', [name, lastuser, phone]));
                    } else {
                        DBConnection.query(SqlString.format('UPDATE khachhang SET aka=?, label=?, akauid=? WHERE phone=?', [name, xabom, lastuser, phone]));
                    }
                    response.json({
                        data: JSON.parse('{"name": "' + name + '", "bom": "' + xabom + '"}')
                    });
                } else {
                    response.json({
                        data: JSON.parse('{"message": "OK"}')
                    });
                }
            });
    });

    router.post('/updateuser', jwtAuth, function (request, response, next) {
        var phone = request.body.phone;
        var diachi = request.body.diachi;
        var userid = request.body.userid;
        var label = request.body.label;
        var note = request.body.note;
        var nuocngoai = request.body.nn;
        var realfbid = request.body.realfbid;
        var important = request.body.checknote;
        var sql;

        if (realfbid.length > 0) {
            sql = SqlString.format('UPDATE khachhang SET nuocngoai=?, phone=?, diachi=?, label=?, note=?, important=? WHERE userid=? OR realfbid=?',
                [nuocngoai, phone, diachi, label, note, important, userid, realfbid]);
        } else {
            sql = SqlString.format('UPDATE khachhang SET nuocngoai=?, phone=?, diachi=?, label=?, note=?, important=? WHERE userid=?',
                [nuocngoai, phone, diachi, label, note, important, userid]);
        }
        DBConnection.query(sql);
        response.json({
            data: userid
        });
        console.log('Updated: ' + userid + ' - ' + nuocngoai);
    });

    router.post('/getnewuser', jwtAuth, function (req, resx) {
        (async () => {
            var userid = req.body.userid;
            if (!isNumeric(userid)) {
                const browser = await getBrowser();
                const page = await browser.newPage();
                await page.bringToFront();
                await page.goto('view-source:' + userid);
                const body = await page.$eval('*', (el) => el.innerText);
                userid = body.split('"selectedID":"').pop().split('"')[0];
                //await delay(3000);
                await page.close();
                if (!isNumeric(userid)) {
                    resx.json({
                        data: JSON.parse('{"error": "Link khách hàng sai"}')
                    });
                    return;
                }
            }
            DBConnection.query("SELECT userid,fbname,phone,diachi,label,note,avalink,realfbid FROM khachhang WHERE realfbid='" + userid + "'",
                async function (error, data) {
                    if (data.length > 0) {
                        resx.json({
                            data: data[0]
                        });
                    } else {
                        DBConnection.query(" SELECT token FROM usertoken WHERE id=1",
                            async function (error, data) {
                                let token = data[0].token;
                                const browser = await getBrowser();
                                const page = await browser.newPage();
                                await page.bringToFront();
                                await page.goto(`https://graph.facebook.com/${userid}/?fields=picture{url},name&access_token=${token}`);
                                const body = await page.$eval('*', (el) => el.innerText);
                                const datax = JSON.parse(body);
                                //await delay(3000);
                                await page.close();
                                resx.json({
                                    data: datax
                                });
                                /*var query = `https://graph.facebook.com/${userid}/?fields=picture{url},name&access_token=${token}`;
                                const res = await fetch(query);
                                if (res.ok) {
                                    const data = await res.json();
                                    resx.json({
                                        data: data
                                    });
                                }else{
                                    console.log(res)
                                }
                                    */
                            });
                    }
                });
        })();
    });


    function isNumeric(n) {
        return !isNaN(parseFloat(n)) && isFinite(n);
    }

    router.post('/updatelivenote', jwtAuth, function (request, response, next) {
        var note = request.body.note;
        var liveid = request.body.liveid;
        var zzz = '';
        const liveidarray = liveid.replaceAll(' ', '').split(",");
        for (var j = 0; j < liveidarray.length; j++) {
            zzz = zzz + `id='${liveidarray[j]}' OR `;
        }
        DBConnection.query(SqlString.format(" UPDATE livestream SET note=? WHERE " + zzz.substring(0, zzz.length - 4), note));
        response.json({
            data: JSON.parse('{"success": "Ghi chú sẽ được lưu"}')
        });
        console.log('Updated note: ' + liveid);
    });

    router.get('/api/rooms', (req, res) => {
        DBConnection.query('SELECT * FROM rooms ORDER BY room_name ASC', (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    router.post('/api/rooms/add', (req, res) => {
        const { room_name, base_price, current_elec, current_water } = req.body;
        const sql = 'INSERT INTO rooms (room_name, base_price, current_elec, current_water) VALUES (?, ?, ?, ?)';
        DBConnection.query(sql, [room_name, base_price, current_elec, current_water], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, id: result.insertId });
        });
    });

    router.post('/api/rooms/delete', (req, res) => {
        const { id } = req.body;
        DBConnection.query('DELETE FROM rooms WHERE id = ?', [id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });

    router.post('/api/rooms/update-stats', (req, res) => {
        const { id, new_elec, new_water } = req.body;
        const sql = 'UPDATE rooms SET current_elec = ?, current_water = ? WHERE id = ?';
        DBConnection.query(sql, [new_elec, new_water, id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });

    router.get('/api/invoices', async (req, res) => {
        const db = DBConnection.promise();
        try {
            const [rows] = await db.query(
                'SELECT * FROM invoices ORDER BY created_at DESC'
            );
            res.json(rows);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/api/invoices/add', async (req, res) => {
        const db = DBConnection.promise();
        const { room_id, room_name, total_amount, details } = req.body;

        const now = new Date();
        const invoice_date = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;

        try {
            const [result] = await db.query(
                'INSERT INTO invoices (room_id, room_name, invoice_date, total_amount, details) VALUES (?, ?, ?, ?, ?)',
                [room_id, room_name, invoice_date, total_amount, details]
            );
            res.json({ success: true, id: result.insertId });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/api/invoices/delete', async (req, res) => {
        const db = DBConnection.promise();
        const { id } = req.body;
        try {
            await db.query('DELETE FROM invoices WHERE id = ?', [id]);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });


    //router.get('/loadcomment', jwtAuth, loadcommentController.handleLoadComment);
    router.get("/", webAuth, loadcommentController.handleLoadComment);
    router.get("/profile", webAuth, profileController.handleProfile);
    router.get("/diennuoc", webAuth, dienNuocController.handleDienNuoc);
    router.get("/donhang", webAuth, orderController.handleOrder);
    router.get("/login", loginController.checkLoggedOut, loginController.getPageLogin);
    router.post("/login", (req, res, next) => {
        const origRedirect = res.redirect.bind(res);
        res.redirect = (url) => {
            // Nếu login thành công (redirect về trang chính, không phải /login)
            if (req.user && url !== '/login') {
                const token = jwt.sign(
                    { id: req.user.id, username: req.user.username },
                    JWT_SECRET,
                    { expiresIn: '30d' }
                );
                res.cookie('token', token, {
                    httpOnly: true,
                    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 ngày
                    sameSite: 'lax',
                });
            }
            origRedirect(url);
        };
        loginController.handleLogin(req, res, next);
    });

    router.get("/halwhtihle", registerController.getPageRegister);//register
    router.post("/halwhtihle", auth.validateRegister, registerController.createNewUser);
    router.post("/logout", (req, res, next) => {
        res.clearCookie('token');
        loginController.postLogOut(req, res, next);
    });

    // ── Mount API routes (backend 2 đã gộp) ─────────────────
    app.use('/api/auth', apiAuth);
    app.use('/api/dashboard', apiDashboard);
    app.use('/api/messages', apiMessages);
    app.use('/api/livecomments', apiLivecomments);
    app.use('/api/customers', apiCustomers);
    app.use('/api/orders', apiOrders);
    app.use('/api/pages', apiPages);
    app.use('/api/notifications', apiNotifications);
    // ─────────────────────────────────────────────────────────

    return app.use("/", router);
};


module.exports = initWebRoutes;