require('dotenv').config();
import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 20,
    multipleStatements: true,
    connectTimeout: 10000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
});

pool.on('error', (err) => {
    console.error('❌ [MySQL Pool Error]', err.code || err.message, '- pool sẽ tự tạo lại connection khi cần.');
});

const CONNECT_RETRY_DELAY_MS = 5000;
let connectAttempt = 0;

async function tryConnectOnce() {
    console.log(`Begin MySQL Connect`);
    connectAttempt += 1;
    const conn = await pool.getConnection();
    try {
        await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        console.log(`✅ Database connected (mysql2/promise pool) - lần thử ${connectAttempt}`);
    } finally {
        conn.release();
    }
}

function scheduleReconnect() {
    setTimeout(() => {
        tryConnectOnce().catch((err) => {
            console.error(`❌ Database connection failed (lần thử ${connectAttempt}):`, err.code || err.message,
                `- thử lại sau ${CONNECT_RETRY_DELAY_MS / 1000}s...`);
            scheduleReconnect();
        });
    }, CONNECT_RETRY_DELAY_MS);
}

tryConnectOnce().catch((err) => {
    console.error(`❌ Database connection failed (lần thử ${connectAttempt}):`, err.code || err.message,
        `- thử lại sau ${CONNECT_RETRY_DELAY_MS / 1000}s...`);
    scheduleReconnect();
});

const db = {
    query(sql, paramsOrCallback, maybeCallback) {
        let params = [];
        let callback = null;

        if (typeof paramsOrCallback === 'function') {
            callback = paramsOrCallback;
        } else if (typeof maybeCallback === 'function') {
            params = paramsOrCallback;
            callback = maybeCallback;
        } else if (paramsOrCallback !== undefined) {
            params = paramsOrCallback;
        }

        if (!Array.isArray(params)) {
            params = [params];
        }

        const promise = pool.query(sql, params);

        if (callback) {
            promise
                .then(([rows]) => callback(null, rows))
                .catch(err => callback(err, null));
            return;
        }
        return promise;
    },

    execute(sql, params = []) {
        return pool.execute(sql, params);
    },

    getConnection() {
        return pool.getConnection();
    },

    promise() {
        return this;
    },
};

module.exports = db;
