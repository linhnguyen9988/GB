'use strict';

const crypto = require('crypto');
const axios = require('axios');
const DBConnection = require('../configs/DBConnection');

const VIETTEL_BASE = 'https://partner.viettelpost.vn';
const DRAFT_TTL_MS = 10 * 60 * 1000;
const drafts = new Map();
const ACCOUNT_RUNTIME_COLUMNS = `userid, app_user_id, token_enc, expiration, groupaddressid, cusid,
    warehouse_name, warehouse_address, senderphone_enc, order_service, order_service_name,
    order_service_price, order_service_time, is_default, is_active`;

function getEncryptionKey() {
    const configured = String(process.env.VIETTEL_CREDENTIALS_KEY || '').trim();
    if (Buffer.byteLength(configured, 'utf8') < 32) {
        throw new Error('Thiếu hoặc khóa VIETTEL_CREDENTIALS_KEY quá ngắn. Hãy cấu hình khóa ngẫu nhiên tối thiểu 32 bytes trong .env.');
    }
    return crypto.createHash('sha256').update(configured, 'utf8').digest();
}

function encryptSecret(value) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64'), tag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptSecret(value) {
    const parts = String(value || '').split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
        throw new Error('Thông tin Viettel trong DB không đúng định dạng mã hóa.');
    }
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm', getEncryptionKey(), Buffer.from(parts[1], 'base64')
    );
    decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
    return Buffer.concat([
        decipher.update(Buffer.from(parts[3], 'base64')),
        decipher.final()
    ]).toString('utf8');
}

function apiMessage(body, fallback) {
    return (body && (body.message || body.errorMessage))
        ? String(body.message || body.errorMessage)
        : fallback;
}

function safeApiError(error, fallback) {
    const body = error && error.response && error.response.data;
    return apiMessage(body, fallback);
}

function normalizeServices(body) {
    const rows = Array.isArray(body && body.RESULT)
        ? body.RESULT
        : (Array.isArray(body && body.data && body.data.RESULT) ? body.data.RESULT : []);
    return rows
        .filter(item => item && item.MA_DV_CHINH && Number.isFinite(Number(item.GIA_CUOC)) && Number(item.GIA_CUOC) >= 0)
        .map(item => ({
            code: String(item.MA_DV_CHINH),
            name: String(item.TEN_DICHVU || item.MA_DV_CHINH),
            price: Number(item.GIA_CUOC),
            time: String(item.THOI_GIAN || ''),
            extraServices: Array.isArray(item.EXTRA_SERVICE) ? item.EXTRA_SERVICE : []
        }))
        .sort((a, b) => a.price - b.price);
}

function normalizeWarehouses(body) {
    const rows = Array.isArray(body && body.data) ? body.data : [];
    return rows
        .filter(item => item && item.groupaddressId !== undefined && item.groupaddressId !== null && String(item.groupaddressId).trim() !== '')
        .map(item => ({
            groupaddressId: String(item.groupaddressId),
            cusId: item.cusId === undefined || item.cusId === null ? '' : String(item.cusId),
            name: String(item.name || 'Kho Viettel Post'),
            phone: String(item.phone || ''),
            address: String(item.address || ''),
            provinceId: item.provinceId || null,
            districtId: item.districtId || null,
            wardsId: item.wardsId || null
        }));
}

function cleanupDrafts() {
    const now = Date.now();
    for (const [key, draft] of drafts.entries()) {
        if (draft.expiresAt <= now) drafts.delete(key);
    }
}

async function prepareAccount({ appUserId, username, password, accountId }) {
    const appId = Number(appUserId);
    const cleanUsername = String(username || '').trim();
    const cleanPassword = String(password || '');

    if (!Number.isSafeInteger(appId) || appId <= 0) throw new Error('Tài khoản người dùng không hợp lệ.');
    if (!cleanUsername || cleanUsername.length > 120) throw new Error('Vui lòng nhập username Viettel Post hợp lệ.');
    if (!cleanPassword || cleanPassword.length > 512) throw new Error('Vui lòng nhập mật khẩu Viettel Post hợp lệ.');
    // Kiểm tra khóa mã hóa trước khi gọi API, tránh hoàn tất xác thực nhưng không thể lưu DB.
    getEncryptionKey();

    if (accountId) {
        const [owned] = await DBConnection.query(
            'SELECT userid, username_enc FROM vietteltoken WHERE app_user_id = ? AND userid = ? AND is_active = 1 LIMIT 1',
            [appId, String(accountId)]
        );
        if (!owned.length) throw new Error('Không tìm thấy tài khoản Viettel hoặc tài khoản không thuộc profile này.');
        if (!owned[0].username_enc || decryptSecret(owned[0].username_enc) !== cleanUsername) {
            throw new Error('Không được thay đổi username khi cập nhật tài khoản Viettel.');
        }
    }

    let loginRes;
    try {
        loginRes = await axios.post(VIETTEL_BASE + '/v2/user/Login', {
            USERNAME: cleanUsername,
            PASSWORD: cleanPassword
        }, {
            headers: { 'Content-Type': 'application/json' }, timeout: 20000
        });
    } catch (error) {
        throw new Error(safeApiError(error, 'Không đăng nhập được Viettel Post. Vui lòng kiểm tra username/password.'));
    }
    const shortToken = loginRes.data && loginRes.data.data && loginRes.data.data.token;
    if (loginRes.status !== 200 || !shortToken || (loginRes.data && loginRes.data.error === true)) {
        throw new Error(apiMessage(loginRes.data, 'Viettel Post từ chối đăng nhập. Vui lòng kiểm tra username/password.'));
    }

    let tokenRes;
    try {
        tokenRes = await axios.post(VIETTEL_BASE + '/v2/user/ownerconnect', {
            USERNAME: cleanUsername,
            PASSWORD: cleanPassword
        }, {
            headers: { 'Content-Type': 'application/json', token: shortToken }, timeout: 20000
        });
    } catch (error) {
        throw new Error(safeApiError(error, 'Không lấy được token dài hạn từ Viettel Post.'));
    }
    const tokenData = tokenRes.data && tokenRes.data.data;
    const longToken = tokenData && tokenData.token;
    const viettelUserId = tokenData && tokenData.userId;
    if (tokenRes.status !== 200 || !longToken || !viettelUserId || Number(tokenRes.data.status) !== 200) {
        throw new Error(apiMessage(tokenRes.data, 'Không lấy được token dài hạn từ Viettel Post.'));
    }

    let inventoryRes;
    try {
        inventoryRes = await axios.get(VIETTEL_BASE + '/v2/user/listInventory', {
            headers: { 'Content-Type': 'application/json', Token: longToken }, timeout: 20000
        });
    } catch (error) {
        throw new Error(safeApiError(error, 'Không lấy được danh sách kho Viettel Post.'));
    }
    if (!inventoryRes.data || inventoryRes.data.error === true || Number(inventoryRes.data.status) !== 200) {
        throw new Error(apiMessage(inventoryRes.data, 'Không lấy được danh sách kho Viettel Post.'));
    }
    const warehouses = normalizeWarehouses(inventoryRes.data);
    if (!warehouses.length) throw new Error('Viettel Post không trả về kho hàng nào cho tài khoản này.');

    cleanupDrafts();
    const draftId = crypto.randomBytes(24).toString('hex');
    drafts.set(draftId, {
        appUserId: appId,
        accountId: accountId ? String(accountId) : null,
        // Chỉ lưu ciphertext trong bộ nhớ tạm; không lưu password/token dạng rõ trong draft.
        usernameEnc: encryptSecret(cleanUsername),
        passwordEnc: encryptSecret(cleanPassword),
        tokenEnc: encryptSecret(longToken),
        expiration: tokenData.expired || null,
        viettelUserId: String(viettelUserId),
        warehouses,
        services: null,
        rateWarehouseId: null,
        expiresAt: Date.now() + DRAFT_TTL_MS
    });

    return {
        draftId,
        warehouses,
        expiresInSeconds: Math.floor(DRAFT_TTL_MS / 1000)
    };
}


async function loadServicesForDraft({ appUserId, draftId, groupaddressId }) {
    cleanupDrafts();
    const draft = drafts.get(String(draftId || ''));
    if (!draft || draft.appUserId !== Number(appUserId)) {
        throw new Error('Phiên cấu hình Viettel đã hết hạn. Vui lòng xác thực lại tài khoản.');
    }

    const warehouse = draft.warehouses.find(item => item.groupaddressId === String(groupaddressId || ''));
    if (!warehouse) throw new Error('Vui lòng chọn một kho hàng hợp lệ trước khi lấy dịch vụ.');
    const address = String(warehouse.address || '').trim();
    if (!address) throw new Error('Kho Viettel không có địa chỉ. Không thể lấy bảng giá cho kho này.');

    let priceRes;
    try {
        const longToken = decryptSecret(draft.tokenEnc);
        priceRes = await axios.post(VIETTEL_BASE + '/v2/order/getPriceAllNlp', {
            SENDER_ADDRESS: address,
            RECEIVER_ADDRESS: address,
            PRODUCT_TYPE: 'HH',
            PRODUCT_WEIGHT: 100,
            TYPE: 1
        }, {
            // API mẫu của Viettel nhận Token trên query string; gửi thêm header Token để tương thích.
            params: { Token: longToken, 'Content-Type': 'application/json', accept: '*/*' },
            headers: { 'Content-Type': 'application/json', accept: '*/*', Token: longToken },
            timeout: 25000
        });
    } catch (error) {
        // Không trả error.message của Axios vì URL có thể chứa Token trong query string.
        throw new Error(safeApiError(error, 'Không lấy được bảng giá dịch vụ Viettel Post.'));
    }

    const rateBody = priceRes.data;
    if (!rateBody || rateBody.error === true) {
        throw new Error(apiMessage(rateBody, 'Không lấy được danh sách dịch vụ Viettel Post.'));
    }
    const services = normalizeServices(rateBody);
    if (!services.length) throw new Error('API giá cước không trả về dịch vụ chính nào để chọn.');

    draft.services = services;
    draft.rateWarehouseId = warehouse.groupaddressId;
    return { services, cheapestServiceCode: services[0].code };
}

async function commitPreparedAccount({ appUserId, draftId, groupaddressId, serviceCode, makeDefault }) {
    cleanupDrafts();
    const draft = drafts.get(String(draftId || ''));
    if (!draft || draft.appUserId !== Number(appUserId)) {
        throw new Error('Phiên cấu hình Viettel đã hết hạn. Vui lòng xác thực lại tài khoản.');
    }

    const warehouse = draft.warehouses.find(item => item.groupaddressId === String(groupaddressId));
    if (!warehouse) throw new Error('Vui lòng chọn một kho hàng hợp lệ.');
    if (!warehouse.phone) throw new Error('Kho đã chọn không có số điện thoại người gửi từ Viettel Post. Vui lòng chọn kho khác.');
    if (!Array.isArray(draft.services) || draft.rateWarehouseId !== warehouse.groupaddressId) {
        throw new Error('Vui lòng chọn kho để tải lại bảng giá dịch vụ trước khi lưu.');
    }
    const service = draft.services.find(item => item.code === String(serviceCode));
    if (!service) throw new Error('Vui lòng chọn một dịch vụ chính hợp lệ.');

    const appId = Number(appUserId);
    const accountId = draft.accountId;
    const accountUserId = warehouse.cusId || draft.viettelUserId;
    if (!/^\d{1,20}$/.test(String(accountUserId))) {
        throw new Error('Viettel Post trả về mã CUS_ID không hợp lệ.');
    }

    const senderPhoneEnc = encryptSecret(warehouse.phone || '');
    const conn = await DBConnection.getConnection();
    let savedUserId;
    let wasDefault = false;

    const accountValues = [
        draft.usernameEnc, draft.passwordEnc, draft.tokenEnc, draft.expiration || null,
        warehouse.groupaddressId, accountUserId, warehouse.name, warehouse.address,
        senderPhoneEnc, service.code, service.name, service.price, service.time
    ];

    try {
        await conn.beginTransaction();

        if (accountId) {
            const [existingRows] = await conn.execute(
                'SELECT userid, is_default FROM vietteltoken WHERE app_user_id = ? AND userid = ? AND is_active = 1 LIMIT 1 FOR UPDATE',
                [appId, accountId]
            );
            if (!existingRows.length) throw new Error('Tài khoản cần cập nhật không còn tồn tại.');
            wasDefault = Number(existingRows[0].is_default) === 1;
            if (String(accountId) !== String(accountUserId)) {
                throw new Error('Mã CUS_ID của Viettel đã thay đổi. Để giữ liên kết với các đơn cũ, hãy thêm tài khoản mới thay vì cập nhật tài khoản này.');
            }
            await conn.execute(
                `UPDATE vietteltoken SET username_enc=?, password_enc=?, token_enc=?, token='', expiration=?,
                 groupaddressid=?, cusid=?, warehouse_name=?, warehouse_address=?, senderphone='', senderphone_enc=?,
                 order_service=?, order_service_name=?, order_service_price=?, order_service_time=?, is_active=1
                 WHERE app_user_id=? AND userid=?`,
                [...accountValues, appId, accountId]
            );
            savedUserId = accountId;
        } else {
            const [conflicts] = await conn.execute(
                'SELECT app_user_id, is_active, is_default FROM vietteltoken WHERE userid=? LIMIT 1 FOR UPDATE',
                [accountUserId]
            );

            if (conflicts.length) {
                const oldRow = conflicts[0];
                const belongsToThisUser = oldRow.app_user_id === null || Number(oldRow.app_user_id) === appId;
                const inactive = Number(oldRow.is_active) === 0;
                if (!belongsToThisUser || (!inactive && oldRow.app_user_id !== null)) {
                    throw new Error(Number(oldRow.app_user_id) === appId
                        ? 'Tài khoản Viettel này đã có trong profile. Hãy dùng nút Cập nhật trên tài khoản hiện tại.'
                        : 'Tài khoản Viettel này đã được liên kết với profile khác.');
                }
                wasDefault = Number(oldRow.is_default) === 1;
                await conn.execute(
                    `UPDATE vietteltoken SET app_user_id=?, username_enc=?, password_enc=?, token_enc=?, token='', expiration=?,
                     groupaddressid=?, cusid=?, warehouse_name=?, warehouse_address=?, senderphone='', senderphone_enc=?,
                     order_service=?, order_service_name=?, order_service_price=?, order_service_time=?, is_active=1
                     WHERE userid=?`,
                    [appId, ...accountValues, accountUserId]
                );
            } else {
                await conn.execute(
                    `INSERT INTO vietteltoken
                     (userid, app_user_id, username_enc, password_enc, token, token_enc, expiration,
                      groupaddressid, cusid, warehouse_name, warehouse_address, senderphone, senderphone_enc,
                      order_service, order_service_name, order_service_price, order_service_time, is_default, is_active)
                     VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, 0, 1)`,
                    [accountUserId, appId, draft.usernameEnc, draft.passwordEnc, draft.tokenEnc, draft.expiration || null,
                        warehouse.groupaddressId, accountUserId, warehouse.name, warehouse.address, senderPhoneEnc,
                        service.code, service.name, service.price, service.time]
                );
            }
            savedUserId = accountUserId;
        }

        const [[countRow]] = await conn.query(
            'SELECT COUNT(*) AS total FROM vietteltoken WHERE app_user_id=? AND is_active=1', [appId]
        );
        if (makeDefault || wasDefault || Number(countRow.total) === 1) {
            await conn.execute('UPDATE vietteltoken SET is_default=0 WHERE app_user_id=? AND is_active=1', [appId]);
            await conn.execute('UPDATE vietteltoken SET is_default=1 WHERE app_user_id=? AND userid=?', [appId, savedUserId]);
        }

        await conn.commit();
        drafts.delete(String(draftId));
        return {
            userid: savedUserId,
            isDefault: !!(makeDefault || wasDefault || Number(countRow.total) === 1)
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

async function listAccounts(appUserId) {
    const [rows] = await DBConnection.query(
        `SELECT userid AS accountId, username_enc, groupaddressid, cusid AS cusId, warehouse_name, warehouse_address,
                order_service, order_service_name, order_service_price, order_service_time,
                expiration, is_default
         FROM vietteltoken WHERE app_user_id=? AND is_active=1 ORDER BY is_default DESC, userid ASC`,
        [Number(appUserId)]
    );
    return rows.map(row => {
        const { username_enc, ...safeRow } = row;
        return { ...safeRow, username: username_enc ? decryptSecret(username_enc) : '' };
    });
}

function hydrateAccount(row) {
    if (!row) return null;
    const { token_enc, senderphone_enc, ...safeRow } = row;
    return {
        ...safeRow,
        token: token_enc ? decryptSecret(token_enc) : '',
        senderphone: senderphone_enc ? decryptSecret(senderphone_enc) : ''
    };
}

async function getDefaultAccount(appUserId) {
    const [rows] = await DBConnection.query(
        `SELECT ${ACCOUNT_RUNTIME_COLUMNS} FROM vietteltoken WHERE app_user_id=? AND is_active=1
         ORDER BY is_default DESC, userid ASC LIMIT 1`,
        [Number(appUserId)]
    );
    return hydrateAccount(rows[0] || null);
}

async function getAccountForOrder(db, order) {
    if (!order) return null;
    if (order.viettelaccountid !== undefined && order.viettelaccountid !== null && order.viettelaccountid !== '') {
        const [rows] = await db.query(
            `SELECT ${ACCOUNT_RUNTIME_COLUMNS} FROM vietteltoken WHERE app_user_id=? AND userid=? LIMIT 1`,
            [Number(order.useraccountid), String(order.viettelaccountid)]
        );
        // Có accountId rõ ràng thì tuyệt đối không fallback sang tài khoản mặc định khác.
        return hydrateAccount(rows[0] || null);
    }
    // Chỉ các đơn cũ chưa lưu viettelaccountid mới dùng tài khoản mặc định hiện tại.
    return getDefaultAccount(order.useraccountid);
}

async function setDefaultAccount(appUserId, accountId) {
    const appId = Number(appUserId);
    const conn = await DBConnection.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.execute(
            'SELECT userid FROM vietteltoken WHERE app_user_id=? AND userid=? AND is_active=1 LIMIT 1 FOR UPDATE',
            [appId, String(accountId)]
        );
        if (!rows.length) throw new Error('Không tìm thấy tài khoản Viettel đang hoạt động.');
        await conn.execute('UPDATE vietteltoken SET is_default=0 WHERE app_user_id=? AND is_active=1', [appId]);
        await conn.execute('UPDATE vietteltoken SET is_default=1 WHERE app_user_id=? AND userid=?', [appId, String(accountId)]);
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

async function deleteAccount(appUserId, accountId) {
    const appId = Number(appUserId);
    const conn = await DBConnection.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.execute(
            'SELECT is_default FROM vietteltoken WHERE app_user_id=? AND userid=? AND is_active=1 LIMIT 1 FOR UPDATE',
            [appId, String(accountId)]
        );
        if (!rows.length) throw new Error('Không tìm thấy tài khoản Viettel đang hoạt động.');

        // Soft delete: giữ token đã mã hóa và thông tin kho để cả đơn cũ chưa gắn viettelaccountid
        // cũng không bị chuyển nhầm sang tài khoản mặc định mới. Xóa login/pass, ẩn khỏi Profile.
        await conn.execute(
            `UPDATE vietteltoken SET is_active=0, is_default=0, username_enc=NULL, password_enc=NULL
             WHERE app_user_id=? AND userid=?`,
            [appId, String(accountId)]
        );

        if (Number(rows[0].is_default) === 1) {
            const [remaining] = await conn.execute(
                'SELECT userid FROM vietteltoken WHERE app_user_id=? AND is_active=1 ORDER BY userid ASC LIMIT 1 FOR UPDATE', [appId]
            );
            if (remaining.length) {
                await conn.execute('UPDATE vietteltoken SET is_default=1 WHERE app_user_id=? AND userid=?', [appId, remaining[0].userid]);
            }
        }
        await conn.commit();
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

module.exports = {
    prepareAccount,
    loadServicesForDraft,
    commitPreparedAccount,
    listAccounts,
    getDefaultAccount,
    getAccountForOrder,
    setDefaultAccount,
    deleteAccount,
    encryptSecret,
    decryptSecret
};
