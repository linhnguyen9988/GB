const mysql = require('mysql2/promise');

async function test() {
    console.time('connect');
    const conn = await mysql.createConnection({
        host: '127.0.0.1',
        user: 'root',
        password: 'halwhtihle',
        database: 'fb',
        connectTimeout: 10000,
    });
    console.timeEnd('connect');
    await conn.end();
}

test().catch(console.error);