const router = require('express').Router();
const db = require('../../configs/DBConnection');
const auth = require('../../middleware/jwtAuth');
const multer = require('multer');
const sharp = require('sharp');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Accept image, video, and audio uploads. FB Send API attachment uploads
// (non-resumable) are capped around 25MB, so we enforce the same limit here
// and reject anything else early instead of wasting time uploading it.
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/'];

// Dart's http package can't always guess a proper Content-Type for a given
// file (camera-recorded temp files, some file_picker results, etc.) and
// falls back to 'application/octet-stream'. When that happens we fall back
// to the file's extension instead of rejecting it outright.
const EXT_TYPE_MAP = {
  '.jpg': 'image', '.jpeg': 'image', '.png': 'image', '.gif': 'image',
  '.webp': 'image', '.heic': 'image', '.heif': 'image', '.bmp': 'image',
  '.mp4': 'video', '.mov': 'video', '.m4v': 'video', '.3gp': 'video',
  '.3gpp': 'video', '.avi': 'video', '.mkv': 'video', '.webm': 'video',
  '.mp3': 'audio', '.m4a': 'audio', '.wav': 'audio', '.aac': 'audio',
  '.ogg': 'audio', '.oga': 'audio', '.amr': 'audio', '.opus': 'audio', '.flac': 'audio',
};

// Returns 'image' | 'video' | 'audio' | null
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

// multer throws synchronously/via callback on file-size or fileFilter
// rejections. Without catching it explicitly here, Express falls back to its
// default error handler, which returns a raw HTML 500 instead of JSON —
// that's the "báo lỗi 500" the client was seeing whenever an attachment was
// too large or an unsupported type.
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
    // Query 1: lấy tin nhắn — đơn giản, không JOIN
    const [messages] = await db.query(
      `SELECT * FROM messaging 
       WHERE sender = ? OR recipient = ?
       ORDER BY id DESC LIMIT ? OFFSET ?`,
      [sender, sender, parseInt(limit), parseInt(offset)]
    );

    if (messages.length === 0) {
      return res.json({ messages: [], readWatermark: 0, reactions: [] });
    }

    // Query 2: reactions chỉ cho những messid vừa lấy — không scan toàn bảng
    const messids = messages.map(m => m.messid);
    const [reactions] = await db.query(
      `SELECT messid, reaction_emoji FROM reactions WHERE messid IN (?)`,
      [messids]
    );

    const readWatermark = messages
      .filter(m => m.isread === 1)
      .reduce((max, m) => Math.max(max, m.timestamp || 0), 0);

    res.json({ messages, readWatermark, reactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/send', auth, uploadAttachment, async (req, res) => {
  const { recipient, message, currentPageID } = req.body;
  const file = req.file;

  if (!recipient || !currentPageID)
    return res.status(400).json({ success: false, error: 'Thiếu recipient hoặc currentPageID' });

  if (!message && !file)
    return res.json({ success: true, message: 'Không có nội dung để gửi.' });

  try {
    const [[page]] = await db.query(
      'SELECT pageid, accesstoken FROM pageinfo WHERE pageid = ?', [currentPageID]
    );
    if (!page)
      return res.status(404).json({ success: false, error: `Không tìm thấy page: ${currentPageID}` });
    if (!page.accesstoken)
      return res.status(400).json({ success: false, error: 'Page chưa có access token' });

    const token = page.accesstoken;

    const sendMessageWithPayload = async (payload) => {
      try {
        const response = await axios.post(
          `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
          payload
        );
        return { success: true, response: response.data, error: null };
      } catch (error) {
        return { success: false, response: null, error };
      }
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

    // attachmentType is 'image' | 'video' | 'audio' — determines both the
    // upload payload type and the outgoing message attachment type.
    const sendDirect = async (attachmentId, attachmentType, textContent) => {
      let imageSent = false, textSent = false;

      if (attachmentId) {
        let payload = {
          recipient: { id: recipient },
          messaging_type: 'UPDATE',
          message: { attachment: { type: attachmentType, payload: { attachment_id: attachmentId } } }
        };
        const result = await sendMessageWithPayload(payload);
        if (result.success) {
          imageSent = true;
        } else {
          const code = result.error?.response?.data?.error?.code;
          if (code === 2018286 || code === 10) {
            payload = { ...payload, messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' };
            const retry = await sendMessageWithPayload(payload);
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
        const result = await sendMessageWithPayload(payload);
        if (result.success) {
          textSent = true;
        } else {
          const code = result.error?.response?.data?.error?.code;
          if (code === 2018286 || code === 10) {
            payload = { ...payload, messaging_type: 'MESSAGE_TAG', tag: 'HUMAN_AGENT' };
            const retry = await sendMessageWithPayload(payload);
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

        if (attachmentId && !imageSent) {
          tasks.push(
            sendMessageWithPayload({
              messaging_type: 'RESPONSE',
              recipient: { comment_id: commentId },
              message: { attachment: { type: attachmentType, payload: { attachment_id: attachmentId } } }
            }).then(r => { if (r.success) imageSent = true; })
          );
        }
        if (textContent && !textSent) {
          tasks.push(
            sendMessageWithPayload({
              messaging_type: 'RESPONSE',
              recipient: { comment_id: commentId },
              message: { text: textContent }
            }).then(r => { if (r.success) textSent = true; })
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
        let cleanupPaths = [file.path];

        if (attachmentType === 'image') {
          // Images get re-encoded/resized before upload to keep things fast
          // and cheap; video/audio are sent through as-is.
          const optimizedPath = file.path + '_opt.jpg';
          await sharp(file.path)
            .rotate()
            .resize(1024, 1024, { fit: sharp.fit.inside, withoutEnlargement: true })
            .jpeg({ quality: 70 })
            .toFile(optimizedPath);
          fs.unlinkSync(file.path);
          uploadPath = optimizedPath;
          cleanupPaths = [optimizedPath];
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

        for (const p of cleanupPaths) {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        }
      } catch (err) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        if (fs.existsSync(file.path + '_opt.jpg')) fs.unlinkSync(file.path + '_opt.jpg');
        const label = attachmentType === 'video' ? 'video' : attachmentType === 'audio' ? 'âm thanh' : 'hình ảnh';
        return res.status(500).json({ success: false, error: `Lỗi khi xử lý tệp ${label}.` });
      }
    }

    const directResult = await sendDirect(attachmentId, attachmentType, message);
    if (directResult.success) {
      return res.json({ success: true, message: 'Gửi thành công.' });
    }

    let imageSent = directResult.imageSent;
    let textSent = directResult.textSent;
    const needImage = !!attachmentId && !imageSent;
    const needText = !!message && !textSent;

    if (needImage || needText) {
      const privateResult = await sendPrivateReply(
        needImage ? attachmentId : null,
        attachmentType,
        needText ? message : null
      );
      imageSent = imageSent || privateResult.imageSent;
      textSent = textSent || privateResult.textSent;
    }

    const overallOk = (!attachmentId || imageSent) && (!message || textSent);
    if (overallOk) {
      return res.json({ success: true, message: 'Gửi thành công.' });
    }

    const failedParts = [];
    if (attachmentId && !imageSent) failedParts.push('tệp đính kèm');
    if (message && !textSent) failedParts.push('tin nhắn văn bản');
    const reason = failedParts.length
      ? `Không thể gửi ${failedParts.join(' và ')}.`
      : 'Không thể gửi tin nhắn.';

    return res.status(400).json({
      success: false,
      error: reason,
      imageSent,
      textSent,
    });

  } catch (err) {
    console.error('Send message error:', err.message);
    res.status(500).json({ success: false, error: 'Lỗi server khi xử lý tin nhắn.' });
  }
});

module.exports = router;