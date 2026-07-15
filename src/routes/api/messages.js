const router = require('express').Router();
const db = require('../../configs/DBConnection');
const auth = require('../../middleware/jwtAuth');
const multer = require('multer');
const sharp = require('sharp');
const FormData = require('form-data');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Multer — lưu ảnh tạm vào uploads/
const upload = multer({ dest: 'uploads/' });

// ─── GET /api/messages ────────────────────────────────────────
// Join fbname từ khachhang để hiện tên thay vì ID
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

// GET /api/messages/conversation/:sender — trả luôn cả watermark và reactions
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

    // readWatermark lấy từ isread trong chính messages — không cần query thêm
    const readWatermark = messages
      .filter(m => m.isread === 1)
      .reduce((max, m) => Math.max(max, m.timestamp || 0), 0);

    res.json({ messages, readWatermark, reactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─── POST /api/messages/send ──────────────────────────────────
// Body: multipart/form-data
//   recipient      — PSID khách hàng
//   message        — nội dung text (có thể rỗng nếu chỉ gửi ảnh)
//   currentPageID  — pageid để lấy token từ bảng pageinfo
//   image          — file ảnh (optional)
router.post('/send', auth, upload.single('image'), async (req, res) => {
  const { recipient, message, currentPageID } = req.body;
  const file = req.file;

  if (!recipient || !currentPageID)
    return res.status(400).json({ success: false, error: 'Thiếu recipient hoặc currentPageID' });

  if (!message && !file)
    return res.json({ success: true, message: 'Không có nội dung để gửi.' });

  try {
    // Lấy access token theo pageid
    const [[page]] = await db.query(
      'SELECT pageid, accesstoken FROM pageinfo WHERE pageid = ?', [currentPageID]
    );
    if (!page)
      return res.status(404).json({ success: false, error: `Không tìm thấy page: ${currentPageID}` });
    if (!page.accesstoken)
      return res.status(400).json({ success: false, error: 'Page chưa có access token' });

    const token = page.accesstoken;

    // ── Helper: gọi FB Graph API ──────────────────────────────
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

    // ── Helper: lấy comment IDs gần đây của khách để Private Reply ──
    const getRecentCommentIds = async (userId) => {
      const [rows] = await db.query(
        `SELECT commentid FROM livecomment
         WHERE userid = ? AND commentid IS NOT NULL
         ORDER BY idx DESC LIMIT 5`,
        [userId]
      );
      return rows.map(r => r.commentid);
    };

    // ── Gửi Direct Message ────────────────────────────────────
    const sendDirect = async (attachmentId, textContent) => {
      let imageSent = false, textSent = false;

      if (attachmentId) {
        let payload = {
          recipient: { id: recipient },
          messaging_type: 'UPDATE',
          message: { attachment: { type: 'image', payload: { attachment_id: attachmentId } } }
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

    // ── Private Reply (fallback) ──────────────────────────────
    const sendPrivateReply = async (attachmentId, textContent) => {
      const commentIds = await getRecentCommentIds(recipient);
      if (!commentIds.length) return { success: false };

      for (const commentId of commentIds) {
        const tasks = [];

        if (attachmentId) {
          tasks.push(sendMessageWithPayload({
            messaging_type: 'RESPONSE',
            recipient: { comment_id: commentId },
            message: { attachment: { type: 'image', payload: { attachment_id: attachmentId } } }
          }));
        }
        if (textContent) {
          tasks.push(sendMessageWithPayload({
            messaging_type: 'RESPONSE',
            recipient: { comment_id: commentId },
            message: { text: textContent }
          }));
        }

        const results = await Promise.all(tasks);
        const allOk = results.every(r => r.success);
        if (allOk) return { success: true };
      }
      return { success: false };
    };

    let attachmentId = null;
    if (file && file.path) {
      const optimizedPath = file.path + '_opt.jpg';
      try {
        await sharp(file.path)
          .rotate()
          .resize(1024, 1024, { fit: sharp.fit.inside, withoutEnlargement: true })
          .jpeg({ quality: 70 })
          .toFile(optimizedPath);
        fs.unlinkSync(file.path);

        const form = new FormData();
        form.append('message', JSON.stringify({
          attachment: { type: 'image', payload: { is_reusable: true } }
        }));
        form.append('filedata', fs.createReadStream(optimizedPath));

        const uploadRes = await axios.post(
          `https://graph.facebook.com/v19.0/me/message_attachments?access_token=${token}`,
          form, { headers: form.getHeaders() }
        );
        attachmentId = uploadRes.data.attachment_id;
        fs.unlinkSync(optimizedPath);
      } catch (err) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        if (fs.existsSync(file.path + '_opt.jpg')) fs.unlinkSync(file.path + '_opt.jpg');
        return res.status(500).json({ success: false, error: 'Lỗi khi xử lý hình ảnh.' });
      }
    }

    // ── Thử Direct → fallback Private Reply ──────────────────
    // Không lưu DB ở đây — backend chính nhận webhook từ FB sẽ tự lưu
    const directResult = await sendDirect(attachmentId, message);
    if (directResult.success) {
      return res.json({ success: true, message: 'Gửi thành công.' });
    }

    const privateResult = await sendPrivateReply(attachmentId, message);
    if (privateResult.success) {
      return res.json({ success: true, message: 'Gửi qua Private Reply thành công.' });
    }

    return res.status(400).json({ success: false, error: 'Không thể gửi tin nhắn.' });

  } catch (err) {
    console.error('Send message error:', err.message);
    res.status(500).json({ success: false, error: 'Lỗi server khi xử lý tin nhắn.' });
  }
});

module.exports = router;