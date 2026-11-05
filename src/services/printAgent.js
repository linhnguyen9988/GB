'use strict';
const socket = require('../socket');

function isPrinterOnline(userId) {
    const io = socket.getIo();
    const clients = io && io.sockets.adapter.rooms.get(`USER_ROOM_${userId}`);
    return !!(clients && clients.size > 0);
}

function sendHtml(userId, html, config) {
    socket.getIo().to(`USER_ROOM_${userId}`).emit('print-now', { type: 'html', html, config });
}

module.exports = { isPrinterOnline, sendHtml };
