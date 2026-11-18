'use strict';
const router = require('express').Router();
const db = require('../../configs/DBConnection');
const auth = require('../../middleware/jwtAuth');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { deliver } = require('../../services/chatDeliveryService');

router.get('/zalo-image/:key', auth, async (req, res) => {
  if (!/^[a-f0-9]{64}$/.test(req.params.key)) return res.sendStatus(404);
  try {
    const [[image]] = await db.query("SELECT image_data FROM gb_zalo_chat_delivery WHERE send_key = ? AND state = 'sent'",
      [req.params.key]);
    if (!image?.image_data) return res.sendStatus(404);
    return res.type('jpeg').set('Cache-Control', 'private, no-store').send(image.image_data);
  } catch (_) {
    return res.sendStatus(500);
  }
});

const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];

function codeToEmoji(code) {
  if (!code) return '';
  return String(code)
    .split('-')
    .map((h) => String.fromCodePoint(parseInt(h, 16)))
    .join('');
}

const EXT_TYPE_MAP = {
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image',
  '.webp': 'image', '.heic': 'image', '.heif': 'image', '.bmp': 'image',
  '.mp4': 'video', '.mov': 'video', '.m4v': 'video', '.3gp': 'video',
  '.3gpp': 'video', '.avi': 'video', '.mkv': 'video', '.webm': 'video',
  '.mp3': 'audio', '.m4a': 'audio', '.wav': 'audio', '.aac': 'audio',
  '.ogg': 'audio', '.oga': 'audio', '.amr': 'audio', '.opus': 'audio', '.flac': 'audio',
};

function detectAttachmentType(file) {
  const mimePrefix = ALLOWED_MIME_PREFIXES.find((p) => (file.mimetype || '').startsWith(p));
  if (mimePrefix) return mimePrefix.replace('/', '');
  const ext = path.extname(file.originalname || '').toLowerCase();
  return EXT_TYPE_MAP[ext] || null;
}

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const type = detectAttachmentType(file);
    cb(type ? null : new Error('Định dạng tệp không được hỗ trợ'), !!type);
  },
});

function uploadAttachment(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Tệp quá lớn (tối đa 25MB).'
          : err.message || 'Lỗi khi tải tệp lên.';
      return res.status(400).json({ success: false, error: message });
    }
    next();
  });
}

router.get('/', auth, async (req, res) => {
  const { pageId, sender, limit = 50, offset = 0 } = req.query;
  try {
    let sql = `
      SELECT m.*, k.fbname
      FROM messaging m
      LEFT JOIN khachhang k ON k.psid = m.sender OR k.userid = m.sender
      WHERE 1=1
    `;
    const params = [];
    if (pageId) {
      sql += ' AND (m.sender = ? OR m.recipient = ?)';
      params.push(pageId, pageId);
    }
    if (sender) {
      sql += ' AND m.sender = ?';
      params.push(sender);
    }
    sql += ' ORDER BY m.timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/conversation/:sender', auth, async (req, res) => {
  const { limit = 10, offset = 0 } = req.query;
  const sender = req.params.sender;

  try {
    const [messages] = await db.query(
      `SELECT * FROM messaging 
       WHERE sender = ? OR recipient = ?
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [sender, sender, parseInt(limit), parseInt(offset)]
    );

    if (messages.length === 0) {
      return res.json({ messages: [], readWatermark: 0, reactions: [] });
    }

    const messids = messages.map(m => m.messid);
    const [rawReactions] = await db.query(
      `SELECT messid, emoji_code FROM reactions WHERE messid IN (?)`,
      [messids]
    );
    const reactions = rawReactions.map(r => ({
      messid: r.messid,
      reaction_emoji: codeToEmoji(r.emoji_code),
    }));

    const readWatermark = messages
      .filter(m => m.channel !== 'zalo' && m.isread === 1)
      .reduce((max, m) => Math.max(max, m.timestamp || 0), 0);

    res.json({ messages, readWatermark, reactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send', auth, uploadAttachment, async (req, res) => {
  const { recipient, currentPageID, message, clientMessageId, deliveryChannel, orderConfirmation } = req.body;
  const file = req.file;
  try {
    const { status, body } = await deliver({
      user: req.user, customerId: recipient, pageId: currentPageID, message, file,
      attachmentType: file ? detectAttachmentType(file) || 'image' : undefined,
      clientMessageId, deliveryChannel, orderConfirmation, mobile: true
    });
    return res.status(status).json(body);
  } catch (error) {
    console.error('Lỗi xử lý gửi tin:', error.code || error.name);
    return res.status(500).json({ success: false, error: 'Lỗi server khi xử lý tin nhắn.' });
  } finally {
    if (file?.path) await fs.promises.unlink(file.path).catch(() => {});
  }
});

module.exports = router;
