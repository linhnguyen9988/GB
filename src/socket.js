import DBConnection from "./configs/DBConnection";
import bcrypt from "bcryptjs";
const { Server } = require("socket.io");
let io;

const initSocket = (server) => {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        },
        transports: ['polling', 'websocket'],
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    io.on('connection', (socket) => {
        socket.on('join-live-stream', (postId) => {
            socket.join(postId);
            console.log(`User joined live stream room: ${postId}`);
        });

        socket.on('leave-live-stream', (postId) => {
            socket.leave(postId);
            console.log(`User left live stream room: ${postId}`);
        });

        socket.on('join-user-room', (userId) => {
            if (!userId) return;
            const room = `USER_ROOM_${userId}`;
            socket.join(room);
            console.log(`[Push] Socket ${socket.id} joined ${room}`);
        });

        socket.on("login-printer", (credentials) => {
            const { username, password } = credentials;

            DBConnection.query(
                'SELECT id, password FROM users WHERE username = ? LIMIT 1',
                [username],
                async (err, results) => {
                    if (err) return socket.emit("login-error", "Lỗi DB");

                    if (results.length > 0) {
                        const user = results[0];
                        const match = await bcrypt.compare(password, user.password);

                        if (match) {
                            const userRoom = `USER_ROOM_${user.id}`;
                            socket.join(userRoom);
                            socket.emit("login-success", { message: "Thành công", userRoom });
                        } else {
                            socket.emit("login-error", "Sai mật khẩu!");
                        }
                    } else {
                        socket.emit("login-error", "Tài khoản không tồn tại!");
                    }
                }
            );
        });

        socket.on('disconnect', () => {
            //console.log('User disconnected');
        });
    });
};

const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

/**
 * Gửi push notification tới 1 user cụ thể.
 * @param {string|number} userId
 * @param {string} title
 * @param {string} body
 * @param {object} [data]
 */
const pushToUser = (userId, title, body, data = null) => {
    if (!io) return;
    const payload = { title: title, body: body };
    if (data) payload.data = data;
    io.to(`USER_ROOM_${userId}`).emit('push_notification', payload);
    console.log(`[Push] → USER_ROOM_${userId}: ${title}`);
};


const pushToAll = (title, body, data = null) => {
    if (!io) return;
    const payload2 = { title: title, body: body };
    if (data) payload2.data = data;
    io.emit('push_notification', payload2);
    console.log(`[Push] Broadcast: ${title}`);
};

module.exports = {
    initSocket,
    getIo,
    pushToUser,
    pushToAll
};