'use strict';
const socket = require('../socket');

function isPrinterOnline(userId) {
    const io = socket.getIo();
    const clients = io && io.sockets.adapter.rooms.get(`USER_ROOM_${userId}`);
    return !!(clients && clients.size > 0);
}

function sendHtml(userId, html, config) {
    return dispatchPrint(userId, { type: 'html', html, config });
}

function dispatchPrint(userId, payload) {
    const io = socket.getIo();
    const room = `USER_ROOM_${userId}`;
    if (!userId || !io.sockets.adapter.rooms.get(room)?.size) return false;
    io.to(room).emit('print-now', payload);
    return true;
}

module.exports = { isPrinterOnline, sendHtml, dispatchPrint };
