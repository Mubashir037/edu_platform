const prisma = require('../config/prisma');

// Use the auth middleware before these controller functions.

// Admin sends one notification to one user.
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

// Admin sends one notification to many users: by ROLE, by CLASS, or by a list of USERS.
// The request body is checked by bulkNotificationSchema in the route.
const create_bulk_notification = async (req, res, next) => {
    try {
        const { target, title, body } = req.body;
        let userIds = [];

        if (target === "ROLE") {
            const users = await prisma.user.findMany({
                where: { role: req.body.role, isActive: true },
                select: { id: true }
            });
            userIds = users.map(u => u.id);
        }
        else if (target === "CLASS") {
            const cls = await prisma.class.findUnique({ where: { id: req.body.classId } });
            if (!cls) {
                return res.status(404).json({ msg: "Class not found" });
            }

            // Active enrollments in the active session only.
            const enrollments = await prisma.enrollment.findMany({
                where: {
                    classId: req.body.classId,
                    status: "ACTIVE",
                    session: { isactive: true }
                },
                select: {
                    student: {
                        select: {
                            user: { select: { id: true, isActive: true } },
                            parent: { select: { user: { select: { id: true, isActive: true } } } }
                        }
                    }
                }
            });

            const found = [];
            for (const e of enrollments) {
                found.push(e.student.user);
                if (req.body.includeParents && e.student.parent) {
                    found.push(e.student.parent.user);
                }
            }
            userIds = found.filter(u => u && u.isActive).map(u => u.id);
        }
        else if (target === "USERS") {
            const users = await prisma.user.findMany({
                where: { id: { in: req.body.userIds }, isActive: true },
                select: { id: true }
            });
            userIds = users.map(u => u.id);
        }

        // A parent with two children should get one message, not two.
        userIds = [...new Set(userIds)];
        if (userIds.length === 0) {
            return res.status(400).json({ msg: "No active recipients found" });
        }

        // One row per recipient, so each person can mark theirs as read separately.
        const created = await prisma.notification.createManyAndReturn({
            data: userIds.map(id => ({
                recipientId: id,
                senderId: req.user.id,
                title: title,
                body: body
            }))
        });

        // Live push to each recipient's private room.
        const io = req.app.get('io');
        for (const n of created) {
            io.to('user:' + n.recipientId).emit('notification:new', n);
        }

        return res.status(201).json({ msg: "Notifications sent", recipients: created.length });
    }
    catch (err) {
        next(err);
    }
};

// A user reads their own notifications, newest first, in pages.
// Optional query: ?page=1&limit=20&unread=true
const get_my_notifications = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

        const where = { recipientId: req.user.id };
        if (req.query.unread === "true") {
            where.isRead = false;
        }

        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where: where,
                orderBy: [{ createdAt: "desc" }, { id: "desc" }],
                skip: (page - 1) * limit,
                take: limit
            }),
            prisma.notification.count({ where: where })
        ]);

        return res.status(200).json({
            notifications,
            total,
            page,
            pages: Math.ceil(total / limit)
        });
    }
    catch (err) {
        next(err);
    }
};

// Number for the bell badge.
const get_unread_count = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }

        const count = await prisma.notification.count({
            where: { recipientId: req.user.id, isRead: false }
        });

        return res.status(200).json({ count });
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

module.exports = {
    create_notification,
    create_bulk_notification,
    get_my_notifications,
    get_unread_count,
    mark_as_read
};