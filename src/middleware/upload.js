'use strict';
// Multer upload (tạm vào thư mục uploads/, tối đa 25MB)

const multer = require('multer');

const upload = multer({ dest: 'uploads/', limits: { fileSize: 25 * 1024 * 1024 } });

module.exports = upload;
