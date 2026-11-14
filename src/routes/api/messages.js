'use strict';
const router = require('express').Router();
const db = require('../../configs/DBConnection');
const auth = require('../../middleware/jwtAuth');
const multer = require('multer');
const sharp = require('sharp');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('node:crypto');
const zaloChat = require('../../services/zaloCustomerChat');

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
  const { recipient, message, currentPageID } = req.body;
  const file = req.file;
  const directZalo = req.body.deliveryChannel === 'zalo';
  const orderConfirmation = zaloChat.isOrderConfirmation(message) || req.body.orderConfirmation === '1';
  const uncertain = { image: false, text: false };
  const messageIds = [];

  async function sendViaZalo(imageSent, textSent, facebookError) {
    const missingFile = !imageSent && !uncertain.image ? file : null;
    const missingText = !textSent && !uncertain.text ? message : '';
    const result = missingFile || missingText ? await zaloChat.sendCustomerMessage({
      customerId: String(recipient), pageId: String(currentPageID), actor: req.user,
      clientMessageId: req.body.clientMessageId || randomUUID(), text: missingText, file: missingFile
    }) : {};
    const success = Boolean((!file || imageSent || result.imageSent) && (!message || textSent || result.textSent));
    return res.status(success ? 200 : 400).json({
      messageIds, success, imageSent: Boolean(imageSent || result.imageSent), textSent: Boolean(textSent || result.textSent),
      zaloImageSent: Boolean(result.imageSent), zaloTextSent: Boolean(result.textSent),
      uncertain: Boolean(result.uncertain || uncertain.image || uncertain.text),
      ...(success ? { message: 'Gửi thành công.' } : { error: result.error ? 'Zalo: ' + result.error : facebookError })
    });
  }

  try {
    if (!recipient || !currentPageID)
      return res.status(400).json({ success: false, error: 'Thiếu recipient hoặc currentPageID' });
    if (!message && !file)
      return res.json({ success: true, message: 'Không có nội dung để gửi.' });
    if (directZalo) return await sendViaZalo(false, false);
    const [[page]] = await db.query(
      'SELECT pageid, accesstoken FROM pageinfo WHERE pageid = ?', [currentPageID]
    );
    if (!page?.accesstoken && orderConfirmation) return await sendViaZalo(false, false);
    if (!page)
      return res.status(404).json({ success: false, error: `Không tìm thấy page: ${currentPageID}` });
    if (!page.accesstoken)
      return res.status(400).json({ success: false, error: 'Page chưa có access token' });

    const token = page.accesstoken;

    const sendMessageWithPayload = async (payload, part) => {
      const result = await require('../../services/messageAuditService').send({
        user: req.user, pageId: currentPageID, customerId: recipient, payload, clientMessageId: req.body.clientMessageId,
        post: body => axios.post(`https://graph.facebook.com/v19.0/me/messages?access_token=${token}`, body)
      });
      if (result.success && result.response && result.response.message_id) messageIds.push(result.response.message_id);
      if (!result.success && (!result.error?.response || result.error.response.status >= 500)) uncertain[part] = true;
      return result;
    };

    const getRecentCommentIds = async (userId) => {
      const [rows] = await db.query(
        `SELECT commentid FROM livecomment
         WHERE userid = ? AND commentid IS NOT NULL
         ORDER BY idx DESC LIMIT 5`,
        [userId]
      );
      return rows.map(r => r.commentid);
    };

    const sendDirect = async (attachmentId, attachmentType, textContent) => {
      let imageSent = false, textSent = false;

      if (attachmentId) {
        let payload = {
          recipient: { id: recipient },
          messaging_type: 'UPDATE',
          message: { attachment: { type: attachmentType, payload: { attachment_id: attachmentId } } }
        };
        const result = await sendMessageWithPayload(payload, 'image');
        if (result.success) {
          imageSent = true;
        } else {
          const code = result.error?.response?.data?.error?.code;
          if (!uncertain.image && (code === 2018286 || code === 10)) {
            payload = { ...payload, messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' };
            const retry = await sendMessageWithPayload(payload, 'image');
            if (retry.success) imageSent = true;
          }
        }
      }

      if (textContent) {
        let payload = {
          recipient: { id: recipient },
          messaging_type: 'UPDATE',
          message: { text: textContent }
        };
        const result = await sendMessageWithPayload(payload, 'text');
        if (result.success) {
          textSent = true;
        } else {
          const code = result.error?.response?.data?.error?.code;
          if (!uncertain.text && (code === 2018286 || code === 10)) {
            payload = { ...payload, messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' };
            const retry = await sendMessageWithPayload(payload, 'text');
            if (retry.success) textSent = true;
          }
        }
      }

      const success = (!attachmentId || imageSent) && (!textContent || textSent);
      return { success, imageSent, textSent };
    };

    const sendPrivateReply = async (attachmentId, attachmentType, textContent) => {
      const commentIds = await getRecentCommentIds(recipient);
      if (!commentIds.length) {
        return { success: false, imageSent: false, textSent: false };
      }

      let imageSent = false;
      let textSent = false;

      for (const commentId of commentIds) {
        const tasks = [];

        if (attachmentId && !imageSent && !uncertain.image) {
          tasks.push(
            sendMessageWithPayload({
              messaging_type: 'RESPONSE',
              recipient: { comment_id: commentId },
              message: { attachment: { type: attachmentType, payload: { attachment_id: attachmentId } } }
            }, 'image').then(r => { if (r.success) imageSent = true; })
          );
        }
        if (textContent && !textSent && !uncertain.text) {
          tasks.push(
            sendMessageWithPayload({
              messaging_type: 'RESPONSE',
              recipient: { comment_id: commentId },
              message: { text: textContent }
            }, 'text').then(r => { if (r.success) textSent = true; })
          );
        }

        if (tasks.length === 0) break; 
        await Promise.all(tasks);

        const imageOk = !attachmentId || imageSent;
        const textOk = !textContent || textSent;
        if (imageOk && textOk) {
          return { success: true, imageSent, textSent };
        }
      }

      const success = (!attachmentId || imageSent) && (!textContent || textSent);
      return { success, imageSent, textSent };
    };

    let attachmentId = null;
    let attachmentType = null;
    if (file && file.path) {
      attachmentType = detectAttachmentType(file) || 'image';

      try {
        let uploadPath = file.path;
        if (attachmentType === 'image') {
          const optimizedPath = file.path + '_opt.jpg';
          await sharp(file.path)
            .rotate()
            .resize(1024, 1024, { fit: sharp.fit.inside, withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toFile(optimizedPath);
          uploadPath = optimizedPath;
        }

        const form = new FormData();
        form.append('message', JSON.stringify({
          attachment: { type: attachmentType, payload: { is_reusable: true } }
        }));
        form.append('filedata', fs.createReadStream(uploadPath));

        const uploadRes = await axios.post(
          `https://graph.facebook.com/v19.0/me/message_attachments?access_token=${token}`,
          form, { headers: form.getHeaders() }
        );
        attachmentId = uploadRes.data.attachment_id;

      } catch (err) {
        console.error('Lỗi chuẩn bị tệp gửi Facebook:', err.code || err.name);
      }
    }

    const directResult = await sendDirect(attachmentId, attachmentType, message);
    if (directResult.success && (!file || attachmentId)) {
      return res.json({ messageIds, success: true, message: 'Gửi thành công.' });
    }

    let imageSent = directResult.imageSent;
    let textSent = directResult.textSent;
    const needImage = !!attachmentId && !imageSent && !uncertain.image;
    const needText = !!message && !textSent && !uncertain.text;

    if (needImage || needText) {
      const privateResult = await sendPrivateReply(
        needImage ? attachmentId : null,
        attachmentType,
        needText ? message : null
      );
      imageSent = imageSent || privateResult.imageSent;
      textSent = textSent || privateResult.textSent;
    }

    const overallOk = (!file || imageSent) && (!message || textSent);
    if (overallOk) {
      return res.json({ messageIds, success: true, message: 'Gửi thành công.' });
    }

    const failedParts = [];
    if (file && !imageSent) failedParts.push('tệp đính kèm');
    if (message && !textSent) failedParts.push('tin nhắn văn bản');
    const reason = uncertain.image || uncertain.text
      ? 'Chưa xác nhận được kết quả gửi Facebook. Kiểm tra cuộc trò chuyện trước khi gửi lại.'
      : failedParts.length
      ? `Không thể gửi ${failedParts.join(' và ')}.`
      : 'Không thể gửi tin nhắn.';

    if (orderConfirmation) return await sendViaZalo(imageSent, textSent, reason);
    return res.status(400).json({
      messageIds,
      success: false,
      error: reason,
      imageSent,
      textSent,
      uncertain: uncertain.image || uncertain.text,
    });

  } catch (err) {
    console.error('Send message error:', err.message);
    res.status(500).json({ success: false, error: 'Lỗi server khi xử lý tin nhắn.' });
  } finally {
    if (file?.path) {
      await Promise.all([file.path, file.path + '_opt.jpg'].map(name => fs.promises.unlink(name).catch(() => {})));
    }
  }
});

module.exports = router;
