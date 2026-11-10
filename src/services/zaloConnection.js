'use strict';

const { randomUUID } = require('node:crypto');
const db = require('../configs/DBConnection');
const { encryptSecret, decryptSecret } = require('./viettelAccountService');

const ATTEMPT_SECONDS = 130;
const ACTIVE_STATES = "'starting', 'waiting', 'scanned'";
const ACTIVE_ATTEMPT = `attempt_status IN (${ACTIVE_STATES}) AND attempt_expires_at > UTC_TIMESTAMP()`;
const localAttempts = new Map();

class ZaloActionError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

function createClient(Zalo, signal) {
    return new Zalo({
        logging: false,
        checkUpdate: false,
        polyfill: (url, options = {}) => fetch(url, {
            ...options,
            signal: options.signal ? AbortSignal.any([options.signal, signal]) : signal
        })
    });
}

async function setAttempt(id, status, qrImage = null) {
    const [result] = await db.execute(
        `UPDATE gb_zalo_connection SET attempt_status = ?, qr_image_enc = ?
          WHERE id = 1 AND attempt_id = ? AND ${ACTIVE_ATTEMPT}`,
        [status, qrImage, id]
    );
    return result.affectedRows > 0;
}

async function runQr(id, admin, sdk, controller) {
    let queued = Promise.resolve();
    let displayName = '';
    let failure = 'failed';
    const events = sdk.LoginQRCallbackEventType;
    const timer = setTimeout(() => {
        failure = 'expired';
        controller.abort();
    }, ATTEMPT_SECONDS * 1000);
    function queueUpdate(status, qrImage) {
        queued = queued.then(async () => {
            if (!await setAttempt(id, status, qrImage)) controller.abort();
        });
        queued.catch(() => controller.abort());
    }

    try {
        const api = await createClient(sdk.Zalo, controller.signal).loginQR({}, event => {
            if (controller.signal.aborted) {
                event.actions?.abort();
                return;
            }
            switch (event.type) {
                case events.QRCodeGenerated: {
                    const image = String(event.data.image || '').replace(/^data:image\/png;base64,/, '');
                    if (image.length > 262144 || !/^iVBORw0KGgo[A-Za-z0-9+/=]*$/.test(image)) {
                        event.actions.abort();
                        return;
                    }
                    queueUpdate('waiting', encryptSecret(image));
                    break;
                }
                case events.QRCodeScanned:
                    displayName = String(event.data.display_name || '').trim().slice(0, 255);
                    queueUpdate('scanned');
                    break;
                case events.QRCodeExpired:
                case events.QRCodeDeclined:
                    failure = event.type === events.QRCodeExpired ? 'expired' : 'declined';
                    event.actions.abort();
                    break;
            }
        });
        await queued;
        controller.signal.throwIfAborted();
        const uid = String(api.getOwnId() ?? '');
        const { cookie, imei, userAgent } = api.getContext();
        const cookies = cookie?.toJSON()?.cookies;
        if (!/^\d{1,64}$/.test(uid) || !cookies?.length || !imei || !userAgent) {
            throw new Error('Incomplete Zalo session');
        }
        const credentials = encryptSecret(JSON.stringify({ cookie: cookies, imei, userAgent }));
        const [result] = await db.execute(
            `UPDATE gb_zalo_connection
                SET zalo_user_id = ?, display_name = ?, credentials_enc = ?, connected_at = UTC_TIMESTAMP(),
                    attempt_status = 'connected', qr_image_enc = NULL
              WHERE id = 1 AND attempt_id = ? AND ${ACTIVE_ATTEMPT}
                AND EXISTS (SELECT 1 FROM users WHERE id = ? AND role = 'admin' AND auth_version = ?)`,
            [uid, displayName, credentials, id, admin.id, admin.auth_version]
        );
        if (!result.affectedRows) await setAttempt(id, 'cancelled');
    } catch (_) {
        await queued.catch(() => {});
        await db.execute(
            `UPDATE gb_zalo_connection
                SET attempt_status = IF(attempt_expires_at <= UTC_TIMESTAMP(), 'expired', ?), qr_image_enc = NULL
              WHERE id = 1 AND attempt_id = ? AND attempt_status IN (${ACTIVE_STATES})`,
            [failure, id]
        ).catch(() => console.error('Không lưu được trạng thái QR Zalo.'));
    } finally {
        clearTimeout(timer);
        localAttempts.delete(id);
    }
}

async function start(admin) {
    const sdk = require('zca-js');
    encryptSecret('');
    const id = randomUUID();
    const [result] = await db.execute(
        `UPDATE gb_zalo_connection
            SET attempt_id = ?, attempt_admin_id = ?, attempt_status = 'starting',
                qr_image_enc = NULL, attempt_expires_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ${ATTEMPT_SECONDS} SECOND)
          WHERE id = 1 AND (attempt_status IS NULL OR NOT (${ACTIVE_ATTEMPT}))`,
        [id, admin.id]
    );
    if (!result.affectedRows) return false;
    const controller = new AbortController();
    localAttempts.set(id, controller);
    void runQr(id, admin, sdk, controller);
    return true;
}

async function getStatus(adminId) {
    const [[row]] = await db.query(
        `SELECT zalo_user_id, display_name, attempt_id, attempt_admin_id, attempt_status,
                CASE WHEN attempt_admin_id = ? AND ${ACTIVE_ATTEMPT} THEN qr_image_enc END AS qr_image_enc,
                (${ACTIVE_ATTEMPT}) AS active
           FROM gb_zalo_connection WHERE id = 1`,
        [adminId]
    );
    const ownsAttempt = row.attempt_id && String(row.attempt_admin_id) === String(adminId);
    const active = Boolean(Number(row.active));
    const expired = !active && ['starting', 'waiting', 'scanned'].includes(row.attempt_status);
    return {
        account: row.zalo_user_id ? { id: row.zalo_user_id, name: row.display_name } : null,
        busy: active && !ownsAttempt,
        attempt: ownsAttempt ? {
            id: row.attempt_id,
            status: expired ? 'expired' : row.attempt_status,
            qrImage: row.qr_image_enc ? decryptSecret(row.qr_image_enc) : null
        } : null
    };
}

async function cancel(adminId, id) {
    const [result] = await db.execute(
        `UPDATE gb_zalo_connection SET attempt_status = 'cancelled', qr_image_enc = NULL
          WHERE id = 1 AND attempt_id = ? AND attempt_admin_id = ? AND ${ACTIVE_ATTEMPT}`,
        [id, adminId]
    );
    if (result.affectedRows) localAttempts.get(id)?.abort();
}

async function disconnect(accountId) {
    const [result] = await db.execute(
        `UPDATE gb_zalo_connection
            SET zalo_user_id = NULL, display_name = NULL, credentials_enc = NULL, connected_at = NULL,
                attempt_id = NULL, attempt_admin_id = NULL, attempt_status = NULL,
                qr_image_enc = NULL, attempt_expires_at = NULL
          WHERE id = 1 AND zalo_user_id = ? AND (attempt_status IS NULL OR NOT (${ACTIVE_ATTEMPT}))`,
        [accountId]
    );
    return result.affectedRows > 0;
}

async function readSavedSession() {
    const [[row]] = await db.query(
        `SELECT zalo_user_id, credentials_enc FROM gb_zalo_connection
          WHERE id = 1 AND (attempt_status IS NULL OR NOT (${ACTIVE_ATTEMPT}))`
    );
    return row;
}

async function openSavedSession(timeoutMs = 20000) {
    const row = await readSavedSession();
    if (!row?.credentials_enc) return null;
    const { Zalo, ThreadType } = require('zca-js');
    const credentials = JSON.parse(decryptSecret(row.credentials_enc));
    let api;
    try {
        api = await createClient(Zalo, AbortSignal.timeout(timeoutMs)).login(credentials);
    } catch (_) {
        throw new ZaloActionError(502, 'Không mở được phiên Zalo đã lưu. Kiểm tra kết nối hoặc quét QR lại.');
    }
    if (String(api.getOwnId()) !== row.zalo_user_id) return null;
    return { api, userThread: ThreadType.User, accountId: row.zalo_user_id, encrypted: row.credentials_enc };
}

async function verify() {
    return Boolean(await openSavedSession());
}

async function isSavedSessionCurrent(session) {
    return (await readSavedSession())?.credentials_enc === session.encrypted;
}

function normalizePhone(value) {
    const phone = typeof value === 'string' && value.length <= 32 ? value.trim().replace(/[ .()-]/g, '') : '';
    if (/^0[1-9]\d{8}$/.test(phone)) return '84' + phone.slice(1);
    if (/^\+?84[1-9]\d{8}$/.test(phone)) return phone.replace(/^\+/, '');
    if (/^\+(?!84)[1-9]\d{7,14}$/.test(phone)) return phone.slice(1);
    throw new ZaloActionError(400, 'Nhập số điện thoại hợp lệ, ví dụ 0912345678 hoặc +84912345678.');
}

async function findRecipient(session, phone) {
    const user = await session.api.findUser(phone);
    const uid = typeof user?.uid === 'number' && !Number.isSafeInteger(user.uid) ? '' : String(user?.uid ?? '');
    if (!/^\d{1,64}$/.test(uid)) {
        throw new ZaloActionError(404, 'Không tìm thấy tài khoản Zalo có thể tra cứu bằng số này.');
    }
    const name = String(user.display_name || user.zalo_name || '').trim().slice(0, 255);
    return { uid, name, accountId: session.accountId };
}

async function checkPhone(value) {
    const phone = normalizePhone(value);
    const session = await openSavedSession();
    if (!session) throw new ZaloActionError(409, 'Kết nối tài khoản Zalo trước khi kiểm tra số.');
    return findRecipient(session, phone);
}

async function sendTestMessage({ phone: value, message, uid, accountId }) {
    const phone = normalizePhone(value);
    const text = typeof message === 'string' ? message.trim() : '';
    if (!text || text.length > 2000) {
        throw new ZaloActionError(400, 'Nhập nội dung tin nhắn từ 1 đến 2.000 ký tự.');
    }
    if (typeof uid !== 'string' || !/^\d{1,64}$/.test(uid) ||
        typeof accountId !== 'string' || !/^\d{1,64}$/.test(accountId)) {
        throw new ZaloActionError(400, 'Kiểm tra số điện thoại trước khi gửi.');
    }
    const session = await openSavedSession();
    if (!session || session.accountId !== accountId) {
        throw new ZaloActionError(409, 'Kết nối Zalo đã thay đổi. Hãy kiểm tra lại số điện thoại.');
    }
    const recipient = await findRecipient(session, phone);
    if (recipient.uid !== uid || !await isSavedSessionCurrent(session)) {
        throw new ZaloActionError(409, 'Người nhận hoặc kết nối Zalo đã thay đổi. Hãy kiểm tra lại số điện thoại.');
    }
    return sendText(session, recipient.uid, text);
}

async function sendText(session, uid, text) {
    let result;
    try {
        result = await session.api.sendMessage(text, uid, session.userThread);
    } catch (error) {
        if (error.name === 'ZcaApiError' && Number.isInteger(Number(error.code)) && Number(error.code) !== 0) {
            throw new ZaloActionError(422, 'Zalo từ chối gửi tin nhắn (mã ' + Number(error.code) + ').');
        }
    }
    const messageId = result?.message?.msgId;
    if (messageId == null) {
        throw new ZaloActionError(502, 'Chưa xác nhận được tin đã gửi. Kiểm tra cuộc trò chuyện Zalo trước khi gửi lại.');
    }
    return { messageId: String(messageId) };
}

module.exports = {
    start, getStatus, cancel, disconnect, verify, checkPhone, sendTestMessage, ZaloActionError,
    openSavedSession, isSavedSessionCurrent, findRecipient, sendText
};
