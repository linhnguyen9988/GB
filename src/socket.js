import DBConnection from "./configs/DBConnection";
import bcrypt from "bcryptjs";
const { Server } = require("socket.io");
let io;
const luckyStates = new Map(); // quay thưởng: chỉ giữ trong RAM, không ghi DB

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

        const luckyKey = (k) => (typeof k === 'string' && /^[A-Za-z0-9]{8,40}$/.test(k)) ? k : null;
        const luckyClean = (st) => ({
            visible: !!(st && st.visible),
            winnerId: (st && st.winnerId) ? String(st.winnerId).slice(0, 40) : null,
            players: ((st && Array.isArray(st.players)) ? st.players : []).slice(0, 500)
                .map(p => ({ id: String((p && p.id) || '').slice(0, 40), name: String((p && p.name) || '').slice(0, 80) }))
                .filter(p => p.id)
        });
        const luckySave = (k, st) => {
            luckyStates.set(k, st);
            if (luckyStates.size > 200) luckyStates.delete(luckyStates.keys().next().value);
        };
        socket.on('lucky-join', (k) => {
            k = luckyKey(k); if (!k) return;
            socket.join('LUCKY_' + k);
            const st = luckyStates.get(k);
            if (st) socket.emit('lucky-state', st);
        });
        socket.on('lucky-sync', (k, st) => {
            k = luckyKey(k); if (!k) return;
            st = luckyClean(st); luckySave(k, st);
            io.to('LUCKY_' + k).emit('lucky-state', st);
        });
        socket.on('lucky-spin', (k, st, dur) => {
            k = luckyKey(k); if (!k) return;
            st = luckyClean(st); st.visible = true; luckySave(k, st);
            dur = Math.min(Math.max(parseInt(dur, 10) || 7000, 3000), 15000);
            io.to('LUCKY_' + k).emit('lucky-spin', { state: st, dur });
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