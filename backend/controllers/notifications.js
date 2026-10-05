const prisma = require('../config/prisma');

// Use the auth middleware before these controller functions.
const create_notification = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }
        if (req.user.role !== "ADMIN") {
            return res.status(403).json({ msg: "Only admins can send notifications" });
        }

        const { recipientId, title, body } = req.body || {};

        if (!Number.isInteger(recipientId) || recipientId <= 0 || recipientId > 2147483647) {
            return res.status(400).json({ msg: "Provide a valid recipient user ID" });
        }
        if (typeof title !== "string" || title.trim() === "") {
            return res.status(400).json({ msg: "Title is required" });
        }
        if (typeof body !== "string" || body.trim() === "") {
            return res.status(400).json({ msg: "Body is required" });
        }

        const recipient = await prisma.user.findUnique({
            where: { id: recipientId }
        });
        if (!recipient) {
            return res.status(404).json({ msg: "Recipient not found" });
        }
        if (!recipient.isActive) {
            return res.status(400).json({ msg: "Recipient account is inactive" });
        }

        const notification = await prisma.notification.create({
            data: {
                recipientId: recipientId,
                senderId: req.user.id,
                title: title.trim(),
                body: body.trim()
            }
        });

        // Get the Socket.IO server stored in app.js and notify this user only.
        const io = req.app.get('io');
        io.to('user:' + recipientId).emit('notification:new', notification);
        return res.status(201).json({ msg: "Notification saved", notification });
    }
    catch (err) {
        next(err);
    }
};

const get_my_notifications = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }

        const notifications = await prisma.notification.findMany({
            where: { recipientId: req.user.id },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }]
        });

        return res.status(200).json({ notifications });
    }
    catch (err) {
        next(err);
    }
};

const mark_as_read = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }

        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
            return res.status(400).json({ msg: "Invalid notification ID" });
        }

        const notification = await prisma.notification.findFirst({
            where: { id: id, recipientId: req.user.id }
        });
        if (!notification) {
            return res.status(404).json({ msg: "Notification not found" });
        }

        const updatedNotification = await prisma.notification.update({
            where: { id: id, recipientId: req.user.id },
            data: { isRead: true }
        });

        return res.status(200).json({
            msg: "Notification marked as read",
            notification: updatedNotification
        });
    }
    catch (err) {
        if (err.code === "P2025") {
            return res.status(404).json({ msg: "Notification not found" });
        }
        next(err);
    }
};

module.exports = { create_notification, get_my_notifications, mark_as_read };
