if (!process.env.JWT_SECRET) {
    console.warn(
        '⚠️  Thiếu biến môi trường JWT_SECRET trong .env — đang chạy với secret mặc định KHÔNG AN TOÀN. ' +
        'Hãy đặt JWT_SECRET (chuỗi ngẫu nhiên, đủ dài) trong .env trước khi lên production.'
    );
}

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET || 'dev-only-insecure-secret-please-set-JWT_SECRET-in-env',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '30d',
    COOKIE_NAME: 'token',
};
