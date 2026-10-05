const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const prisma = require('./prisma');

const setupSocket = (server) => {
    const io = new Server(server, {
        cors: { origin: process.env.FRONTEND_URL || 'http://localhost:5173' }
    });

    // Check the login token before allowing a socket connection.
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) {
                return next(new Error('Please log in first'));
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (!Number.isInteger(decoded.id) || !Number.isInteger(decoded.exp)) {
                return next(new Error('Invalid token'));
            }
            const user = await prisma.user.findUnique({
                where: { id: decoded.id },
                select: { id: true, isActive: true }
            });
            if (!user || !user.isActive) {
                return next(new Error('Account is inactive or no longer exists'));
            }
            socket.data.userId = user.id;
            socket.data.expiresAt = decoded.exp * 1000;
            next();
        }
        catch (err) {
            next(new Error('Unable to authenticate connection'));
        }
    });

    io.on('connection', (socket) => {
        // The verified token decides the room, never an ID sent by the browser.
        socket.join('user:' + socket.data.userId);

        const expiryTimer = setTimeout(() => {
            socket.disconnect(true);
        }, Math.max(0, socket.data.expiresAt - Date.now()));

        socket.on('disconnect', () => {
            clearTimeout(expiryTimer);
        });
    });

    return io;
};

module.exports = setupSocket;
