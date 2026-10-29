'use strict';
const DBConnection = require("../configs/DBConnection");
const SqlString = require('sqlstring');
const StringBuilder = require('node-stringbuilder');
const axios = require('axios');
const fbToken = require('../fb-token');
const request = require('request');
const { AVA_DIR, GlobalPageID2 } = require('../configs/constants');
const { LocDau } = require('../utils/text');
const { download } = require('../utils/download');
const { getBrowser } = require('./browserService');
const { getPageToken, isTokenError, refreshPageTokensOnce } = require('./pageTokenService');

async function ShareToPage2(message, videoid) {
    console.log('Sharing...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    const url = 'https://graph.facebook.com/v20.0/102116919355833/feed';

    const token = await getPageToken(GlobalPageID2);

    const params = new URLSearchParams();
    params.append('message', message);
    params.append('link', `https://www.facebook.com/100040645522129/videos/${videoid}`);
    params.append('access_token', token);

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

let tokenRefreshing = false;
async function GetUserToken() {
    if (tokenRefreshing) return;
    tokenRefreshing = true;
    let page2;
    try {
        const browser = await getBrowser();
        page2 = await browser.newPage();
        const r = await fbToken.refreshUserToken(
            page2,
            (t) => UpdateUToken(1, t),
            (m) => console.log('[GetUserToken]', m)
        );
        if (r.ok) console.log(`[GetUserToken] ✅ Đã cập nhật token mới (${r.info.name})`);
        else console.error('[GetUserToken] ❌ KHÔNG lấy được token mới, giữ nguyên token cũ:', r.reason);
    } catch (e) {
        console.error('[GetUserToken] ❌ Lỗi:', e.message);
    } finally {
        tokenRefreshing = false;
        if (page2) setTimeout(() => page2.close().catch(() => { }), 500);
    }
}

async function UpdateUToken(id, token) {
    var utoken = SqlString.format('INSERT IGNORE INTO usertoken (id,token) VALUES(?,?) ON DUPLICATE KEY UPDATE token=?;', [id, token, token]);
    try {
        DBConnection.query(utoken);
    } catch (e) {
        console.log('ERROR: SQL ERROR');
    }
}

async function fetchFbProfile(fbuserid, pageid) {
    for (let attempt = 0; attempt < 2; attempt++) {
        const token = await getPageToken(pageid);
        if (!token) {
            console.error(`[fetchFbProfile] ${fbuserid}: thiếu page token (page ${pageid} chưa có trong bảng pageinfo?)`);
            return null;
        }
        let res, data;
        try {
            res = await fetch(`https://graph.facebook.com/${fbuserid}/?fields=picture{url},name&access_token=${token}`);
            data = await res.json().catch(() => null);
        } catch (e) {
            console.error(`[fetchFbProfile] ${fbuserid}: ${e.message}`);
            return null;
        }
        if (res.ok && data && !data.error) {
            const picUrl = data.picture && data.picture.data && data.picture.data.url;
            if (picUrl) download(picUrl, data.id, AVA_DIR).catch(() => { });
            return { id: data.id, name: data.name || '', pic: picUrl || '' };
        }
        const e = (data && data.error) || {};
        console.error(`[fetchFbProfile] ${fbuserid}: HTTP ${res.status} | ${e.message || 'không có dữ liệu'}` +
            `${e.code ? ' | code=' + e.code : ''}${e.error_subcode ? ' | subcode=' + e.error_subcode : ''}`);
        if (attempt === 0 && isTokenError(e) && await refreshPageTokensOnce()) continue;
        return null;
    }
    return null;
}

function runGetConversations() {
    DBConnection.query(" SELECT pageid,accesstoken from pageinfo",
        function (error, data) {
            if (error) {
                console.error('Lỗi getconversations:', error);
                return;
            }
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
                        if (error) {
                            console.log(error);
                            return;
                        }
                        try {
                            var body = JSON.parse(bodyx.replaceAll(" ", "").replaceAll(/\n/g, " "));
                            for (var j = 0; j < body.data.length; j++) {
                                var threadid = body.data[j].id;
                                var psid = body.data[j].senders.data[0].id;
                                var fbname = body.data[j].senders.data[0].name;
                                var sql = SqlString.format('INSERT IGNORE INTO khachhang (threadid,userid,fbname,phone,diachi,avalink,uname,gender,label,pageid,fbnamex,note) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE threadid=?;',
                                    [threadid, psid, fbname, '', '', '', '', '', '', pageid, LocDau(fbname), '', threadid]);
                                sb.appendLine().append(sql);
                            }
                            DBConnection.query(sb.toString());
                            //console.log('Done getconversations: ' + pageid);
                        } catch (e) {
                            console.log('Lỗi parse conversations (getconversations):', e);
                        }
                    });
                })();
            }
        });
}

module.exports = { ShareToPage2, GetUserToken, UpdateUToken, fetchFbProfile, runGetConversations };
