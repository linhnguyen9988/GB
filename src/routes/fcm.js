const { GoogleAuth } = require('google-auth-library');
const path = require('path');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'firebase-service-account.json');
const serviceAccount = require(SERVICE_ACCOUNT_PATH);
const PROJECT_ID = serviceAccount.project_id;
const FCM_URL = 'https://fcm.googleapis.com/v1/projects/' + PROJECT_ID + '/messages:send';

let _cachedToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
    if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;
    const auth = new GoogleAuth({
        keyFile: SERVICE_ACCOUNT_PATH,
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    _cachedToken = tokenResponse.token;
    _tokenExpiry = Date.now() + 50 * 60 * 1000;
    return _cachedToken;
}

async function _sendToToken(accessToken, token, title, body, data) {
    const stringData = { title, body };
    for (const k in data) {
        if (Object.prototype.hasOwnProperty.call(data, k)) {
            stringData[k] = String(data[k]);
        }
    }

    const response = await fetch(FCM_URL, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: {
                token,
                data: stringData,
                android: { priority: 'high' },
                apns: {
                    headers: { 'apns-priority': '10' },
                    payload: {
                        aps: { 'content-available': 1, sound: 'default', badge: 1 }
                    }
                }
            }
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        const stale = response.status === 404 || err.includes('UNREGISTERED');
        if (!stale) console.error('[FCM] Error ' + response.status + ':', err);
        return { ok: false, stale };
    }
    return { ok: true, stale: false };
}

const sendFcmToUser = async (db, userId, title, body, data = {}) => {
    try {
        const [rows] = await db.query(
            'SELECT token FROM fcm_tokens WHERE userid = ?',
            [userId]
        );

        if (!rows.length) {
            console.log('[FCM] No token for user: ' + userId);
            return;
        }

        const accessToken = await getAccessToken();
        const staleTokens = [];

        await Promise.all(rows.map(async (row) => {
            const result = await _sendToToken(accessToken, row.token, title, body, data);
            if (result.stale) {
                staleTokens.push(row.token);
            } else if (result.ok) {
                console.log('[FCM] → ' + userId + ' (' + row.token.slice(-6) + '): ' + title);
            }
        }));

        if (staleTokens.length) {
            await Promise.all(staleTokens.map(t =>
                db.query('DELETE FROM fcm_tokens WHERE token = ?', [t])
            ));
            console.log('[FCM] Removed ' + staleTokens.length + ' stale token(s) for: ' + userId);
        }
    } catch (e) {
        console.error('[FCM] Exception:', e.message);
    }
};

module.exports = { sendFcmToUser };