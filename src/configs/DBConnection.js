require('dotenv').config();
import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
});

pool.getConnection()
    .then(conn => {
        conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
        console.log("✅ Database connected (mysql2/promise pool)");
        conn.release();
    })
    .catch(err => {
        console.error("❌ Database connection failed:", err.message);
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
