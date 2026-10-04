const prisma = require('../config/prisma');
const enrollmentschema = require('../schemas/enrollmentschema');

// Create enrollment.
const create = async (req, res, next) => {
    try {
        const result = enrollmentschema.safeParse(req.body);
        if (result.success === false) {
            return res.status(400).json({ msg: "Provide valid studentId, classId and sessionId" });
        }
        const { studentId, classId, sessionId } = result.data;

        const student = await prisma.student.findUnique({ where: { id: studentId }, include: { user: true } });
        if (!student) {
            return res.status(404).json({ msg: "Student not found" });
        }
        if (!student.user.isActive) {
            return res.status(409).json({ msg: "Cannot enroll an inactive student" });
        }
        const schoolClass = await prisma.class.findUnique({ where: { id: classId } });
        if (!schoolClass) {
            return res.status(404).json({ msg: "Class not found" });
        }
        const session = await prisma.academicsession.findUnique({ where: { id: sessionId } });
        if (!session) {
            return res.status(404).json({ msg: "Session not found" });
        }
        if (session.closedAt) {
            return res.status(409).json({ msg: "Cannot enroll in a closed session" });
        }
        const existing = await prisma.enrollment.findFirst({
            where: { studentId: studentId, sessionId: sessionId }
        });
        if (existing) {
            return res.status(409).json({ msg: "Student already enrolled in this session" });
        }

        const enrollment = await prisma.enrollment.create({
            data: { studentId, classId, sessionId }
        });
        return res.status(201).json({ msg: "Enrollment created", enrollment });
    }
    catch (err) {
        if (err.code === "P2002") {
            return res.status(409).json({ msg: "Student already enrolled in this session" });
        }
        if (err.code === "P2003") {
            return res.status(409).json({ msg: "The student, class or session no longer exists" });
        }
        next(err);
    }
};

// Get all enrollments.
const get_all = async (req, res, next) => {
    try {
        const all_enrollments = await prisma.enrollment.findMany();
        return res.status(200).json({ msg: "Got enrollments", all_enrollments });
    }
    catch (err) {
        next(err);
    }
};

// Get one enrollment using its ID.
const get_one = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
            return res.status(400).json({ msg: "Invalid enrollment ID" });
        }
        const enrollment = await prisma.enrollment.findUnique({ where: { id: id } });
        if (!enrollment) {
            return res.status(404).json({ msg: "Enrollment not found" });
        }
        return res.status(200).json({ msg: "Got enrollment", enrollment });
    }
    catch (err) {
        next(err);
    }
};

// Correct the class. Create a new enrollment for a new academic year.
const update = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
            return res.status(400).json({ msg: "Invalid enrollment ID" });
        }
        const result = enrollmentschema.pick({ classId: true }).strict().safeParse(req.body);
        if (result.success === false) {
            return res.status(400).json({ msg: "Provide only a valid classId to correct the enrollment" });
        }
        const { classId } = result.data;
        const existing = await prisma.enrollment.findUnique({ where: { id: id }, include: { session: true } });
        if (!existing) {
            return res.status(404).json({ msg: "Enrollment not found" });
        }
        if (existing.status !== "ACTIVE" || existing.session.closedAt) {
            return res.status(409).json({ msg: "Historical enrollments cannot be changed" });
        }
        const attendanceCount = await prisma.attendance.count({ where: { enroll_id: id } });
        const gradeCount = await prisma.grade.count({ where: { enrollmentId: id } });
        if (attendanceCount > 0 || gradeCount > 0) {
            return res.status(409).json({ msg: "Cannot change class after attendance or grades have been recorded" });
        }
        const schoolClass = await prisma.class.findUnique({ where: { id: classId } });
        if (!schoolClass) {
            return res.status(404).json({ msg: "Class not found" });
        }

        const enrollment = await prisma.enrollment.update({
            where: { id: id },
            data: { classId: classId }
        });
        return res.status(200).json({ msg: "Enrollment updated", enrollment });
    }
    catch (err) {
        if (err.code === "P2025") {
            return res.status(404).json({ msg: "Enrollment not found" });
        }
        if (err.code === "P2003") {
            return res.status(409).json({ msg: "The class no longer exists" });
        }
        next(err);
    }
};

// Remove an enrollment entered by mistake, not the student's account.
const delete_enrollment = async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
            return res.status(400).json({ msg: "Invalid enrollment ID" });
        }
        const existing = await prisma.enrollment.findUnique({ where: { id: id }, include: { session: true } });
        if (!existing) {
            return res.status(404).json({ msg: "Enrollment not found" });
        }
        if (existing.status !== "ACTIVE" || existing.session.closedAt) {
            return res.status(409).json({ msg: "Historical enrollments cannot be deleted" });
        }
        await prisma.enrollment.delete({ where: { id: id } });
        return res.status(200).json({ msg: "Enrollment deleted" });
    }
    catch (err) {
        if (err.code === "P2025") {
            return res.status(404).json({ msg: "Enrollment not found" });
        }
        if (err.code === "P2003") {
            return res.status(409).json({ msg: "Other records reference this enrollment" });
        }
        next(err);
    }
};

module.exports = { create, get_all, get_one, update, delete_enrollment };
