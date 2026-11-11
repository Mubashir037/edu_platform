const prisma = require('../config/prisma');
const announcementSchema = require('../schemas/announcementschema');

// Make a public website announcement. New announcements are drafts by default.
const create_announcement = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }
        const admin_id = req.user.id;
        const admin = await prisma.user.findUnique({
            where: { id: admin_id }
        });
        if (!admin) {
            return res.status(404).json({ msg: "Admin not found" });
        }
        if (admin.role !== "ADMIN" || !admin.isActive) {
            return res.status(403).json({ msg: "Only active admins can make announcements" });
        }

        const result = announcementSchema.safeParse(req.body);
        if (result.success === false) {
            return res.status(400).json({ msg: "Provide a title, body and valid publication status" });
        }
        const { title, body, isPublished } = result.data;
        const announcement = await prisma.announcement.create({
            data: {
                title,
                body,
                postedBy: admin_id,
                isPublished
            }
        });
        return res.status(201).json({
            msg: "Announcement created",
            announcement
        });
    }
    catch (err) {
        next(err);
    }
};
// Delete announcement.
const delete_announcement = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }
        const admin_id = req.user.id;
        const ann_id = Number(req.params.id);
        if (!Number.isInteger(ann_id) || ann_id <= 0 || ann_id > 2147483647) {
            return res.status(400).json({ msg: "Invalid announcement ID" });
        }

        const admin = await prisma.user.findUnique({
            where: { id: admin_id }
        });
        if (!admin) {
            return res.status(404).json({ msg: "Admin not found" });
        }
        if (admin.role !== "ADMIN" || !admin.isActive) {
            return res.status(403).json({ msg: "Only active admins can delete announcements" });
        }

        await prisma.announcement.delete({
            where: { id: ann_id }
        });
        return res.status(200).json({ msg: "Announcement deleted" });
    }
    catch (err) {
        if (err.code === "P2025") {
            return res.status(404).json({ msg: "Announcement not found" });
        }
        next(err);
    }
};
// Update only the fields supplied by the admin.
const update_announcement = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }

        const admin_id = req.user.id;
        const ann_id = Number(req.params.id);
        if (!Number.isInteger(ann_id) || ann_id <= 0 || ann_id > 2147483647) {
            return res.status(400).json({ msg: "Invalid announcement ID" });
        }
        const admin = await prisma.user.findUnique({
            where: {
                id: admin_id
            }
        });
        if (!admin) {
            return res.status(404).json({
                msg: "Admin not found"
            });
        }
        if (admin.role !== "ADMIN" || !admin.isActive) {
            return res.status(403).json({
                msg: "Only active admins can update announcements"
            });
        }

        const result = announcementSchema.partial().safeParse(req.body);
        if (result.success === false) {
            return res.status(400).json({ msg: "Provide valid announcement details" });
        }
        const { title, body, isPublished } = result.data;
        const data = {};
        if (title !== undefined) {
            data.title = title;
        }
        if (body !== undefined) {
            data.body = body;
        }
        if (isPublished !== undefined) {
            data.isPublished = isPublished;
        }
        if (Object.keys(data).length === 0) {
            return res.status(400).json({ msg: "Provide at least one field to update" });
        }

        const announcement = await prisma.announcement.update({
            where: {
                id: ann_id
            },
            data: data
        });
        return res.status(200).json({ msg: "Announcement updated", announcement });

    }
    catch (err) {
        if (err.code === "P2025") {
            return res.status(404).json({ msg: "Announcement not found" });
        }
        next(err);
    }
};

// Public visitors can only read published notices.
const get_all = async (req, res, next) => {
    try {
        const announcements = await prisma.announcement.findMany({
            where: { isPublished: true },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }]
        });
        return res.status(200).json({ announcements });
    }
    catch (err) {
        next(err);
    }
};

const get_one = async (req, res, next) => {
    try {
        const ann_id = Number(req.params.id);
        if (!Number.isInteger(ann_id) || ann_id <= 0 || ann_id > 2147483647) {
            return res.status(400).json({ msg: "Invalid announcement ID" });
        }
        const announcement = await prisma.announcement.findFirst({
            where: { id: ann_id, isPublished: true }
        });
        if (!announcement) {
            return res.status(404).json({ msg: "Announcement not found" });
        }
        return res.status(200).json({ announcement });
    }
    catch (err) {
        next(err);
    }
};
// Admin can see drafts and published notices.
const admin_get_all = async (req, res, next) => {
    try {
        const where = {};
        if (req.query.published === "true") where.isPublished = true;
        if (req.query.published === "false") where.isPublished = false;

        const announcements = await prisma.announcement.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }]
        });
        return res.status(200).json({ announcements });
    }
    catch (err) {
        next(err);
    }
};

const admin_get_one = async (req, res, next) => {
    try {
        const ann_id = Number(req.params.id);
        if (!Number.isInteger(ann_id) || ann_id <= 0 || ann_id > 2147483647) {
            return res.status(400).json({ msg: "Invalid announcement ID" });
        }
        const announcement = await prisma.announcement.findUnique({
            where: { id: ann_id }
        });
        if (!announcement) {
            return res.status(404).json({ msg: "Announcement not found" });
        }
        return res.status(200).json({ announcement });
    }
    catch (err) {
        next(err);
    }
};
module.exports = { create_announcement, delete_announcement, update_announcement, get_all, get_one, admin_get_all, admin_get_one };

