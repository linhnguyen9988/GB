'use strict';
const socket = require('../../socket');
const { createGiaBaoLabel } = require('../../services/labelService');

module.exports = function registerPrintRoutes(router) {
    router.post('/api/generate-pdf', async (req, res) => {
        try {
            const pdfBuffer = await createGiaBaoLabel(req.body);
            res.json({ success: true, pdfBase64: pdfBuffer.toString('base64') });
        } catch (err) {
            console.error("LỖI TẠI SERVER:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    router.post('/print-order', (req, res) => {
        const io = socket.getIo();
        const { userId, type, content, config } = req.body;

        if (!userId || !content) {
            return res.status(400).json({ success: false, message: "Thiếu dữ liệu in" });
        }

        const userRoom = `USER_ROOM_${userId}`;
        const clients = io.sockets.adapter.rooms.get(userRoom);
        const isOnline = clients && clients.size > 0;

        if (isOnline) {
            const emitData = {
                type: type || 'pdf',
                config: config
            };

            if (emitData.type === 'html') {
                emitData.html = content;
            } else {
                emitData.base64 = content;
            }

            io.to(userRoom).emit("print-now", emitData);
            res.json({ success: true, message: "Đã gửi lệnh in" });
        } else {
            res.status(404).json({ success: false, message: "Máy in Offline" });
        }
    });
};
