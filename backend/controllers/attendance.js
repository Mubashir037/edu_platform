const prisma = require("../config/prisma");
const attendanceSchema = require("../schemas/attendanceschema");

const markattandance = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ msg: "Only teachers can mark attendance" });
        }

        const result = attendanceSchema.safeParse(req.body);
        if (result.success === false) {
            return res.status(400).json({ msg: "Provide a valid enrollment ID, date (YYYY-MM-DD), and PRESENT or ABSENT status" });
        }
        const enroll_id = result.data.enroll_id;
        const status = result.data.status;
        const date = new Date(result.data.date + "T00:00:00.000Z");
        if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result.data.date) {
            return res.status(400).json({ msg: "Invalid attendance date" });
        }

        const teacher = await prisma.teacher.findUnique({
            where: { userId: req.user.id }
        });
        if (!teacher) {
            return res.status(403).json({ msg: "Teacher profile not found" });
        }
        const enrollment = await prisma.enrollment.findUnique({
            where: { id: enroll_id },
            include: { class: true, session: true }
        });
        if (!enrollment) {
            return res.status(404).json({ msg: "Enrollment not found" });
        }
        if (enrollment.class.teacherId !== teacher.id) {
            return res.status(403).json({ msg: "You can only mark attendance for your own class" });
        }

        const startDate = new Date(enrollment.session.startDate);
        const endDate = new Date(enrollment.session.enddate);
        startDate.setUTCHours(0, 0, 0, 0);
        endDate.setUTCHours(0, 0, 0, 0);
        if (date < startDate || date > endDate) {
            return res.status(400).json({ msg: "Date must fall within the enrollment's academic session" });
        }

        // Check the whole UTC day, including any older records with a time.
        const nextDate = new Date(date);
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                enroll_id: enroll_id,
                date: { gte: date, lt: nextDate }
            }
        });
        if (existingAttendance) {
            return res.status(409).json({ msg: "Attendance already marked for this student on this date" });
        }

        const attendance = await prisma.attendance.create({
            data: {
                studentId: enrollment.studentId,
                enroll_id: enroll_id,
                date: date,
                status: status,
                markedBy: teacher.id
            }
        });
        return res.status(201).json({ msg: "Attendance marked", attendance });
    }
    catch (err) {
        if (err.code === "P2002") {
            return res.status(409).json({ msg: "Attendance already marked for this enrollment on this date" });
        }
        if (err.code === "P2003") {
            return res.status(409).json({ msg: "The enrollment, student or teacher no longer exists" });
        }
        next(err);
    }
};

const getattendance = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }
        const enroll_id = Number(req.params.id);
        if (!Number.isInteger(enroll_id) || enroll_id <= 0 || enroll_id > 2147483647) {
            return res.status(400).json({ msg: "Invalid enrollment ID" });
        }
        const enrollment = await prisma.enrollment.findUnique({
            where: { id: enroll_id },
            include: { class: true, student: true }
        });
        if (!enrollment) {
            return res.status(404).json({ msg: "Enrollment not found" });
        }
        const student = enrollment.student;

        let allowed = false;
        if (req.user.role === "ADMIN") {
            allowed = true;
        } else if (req.user.role === "TEACHER") {
            const teacher = await prisma.teacher.findUnique({
                where: { userId: req.user.id }
            });
            if (teacher && enrollment.class.teacherId === teacher.id) {
                allowed = true;
            }
        } else if (req.user.role === "STUDENT") {
            if (student.userId === req.user.id) {
                allowed = true;
            }
        } else if (req.user.role === "PARENT") {
            const parent = await prisma.parent.findUnique({
                where: { userId: req.user.id }
            });
            if (parent && student.parentId === parent.id) {
                allowed = true;
            }
        }
        if (allowed === false) {
            return res.status(403).json({ msg: "You cannot view this student's attendance" });
        }

        const records = await prisma.attendance.findMany({
            where: { enroll_id: enroll_id },
            orderBy: { date: "desc" }
        });
        let present = 0;
        let absent = 0;
        for (const record of records) {
            if (record.status === "PRESENT") {
                present++;
            } else if (record.status === "ABSENT") {
                absent++;
            }
        }
        const total = present + absent;
        let percentage = 0;
        if (total > 0) {
            percentage = (present / total) * 100;
        }
        return res.status(200).json({
            enroll_id,
            studentId: enrollment.studentId,
            sessionId: enrollment.sessionId,
            present,
            absent,
            total,
            percentage: Number(percentage.toFixed(2))
        });
    }
    catch (err) {
        next(err);
    }
};

const update_attendance = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ msg: "Only teachers can update attendance" });
        }
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
            return res.status(400).json({ msg: "Invalid attendance ID" });
        }
        if (!req.body) {
            return res.status(400).json({ msg: "Provide PRESENT or ABSENT status" });
        }
        const status = req.body.status;
        if (status !== "PRESENT" && status !== "ABSENT") {
            return res.status(400).json({ msg: "Status must be PRESENT or ABSENT" });
        }
        const attendance = await prisma.attendance.findUnique({ where: { id: id } });
        if (!attendance) {
            return res.status(404).json({ msg: "Attendance not found" });
        }
        if (attendance.enroll_id === null) {
            return res.status(409).json({ msg: "Link this older attendance record to an enrollment before updating it" });
        }
        const enrollment = await prisma.enrollment.findUnique({
            where: { id: attendance.enroll_id },
            include: { class: true }
        });
        if (!enrollment) {
            return res.status(404).json({ msg: "Enrollment not found" });
        }
        const teacher = await prisma.teacher.findUnique({
            where: { userId: req.user.id }
        });
        if (!teacher) {
            return res.status(403).json({ msg: "Teacher profile not found" });
        }
        if (enrollment.class.teacherId !== teacher.id) {
            return res.status(403).json({ msg: "You can only update attendance for your own class" });
        }
        const updatedAttendance = await prisma.attendance.update({
            where: { id: id },
            data: { status: status }
        });
        return res.status(200).json({ msg: "Attendance updated", attendance: updatedAttendance });
    }
    catch (err) {
        if (err.code === "P2025") {
            return res.status(404).json({ msg: "Attendance not found" });
        }
        next(err);
    }
};

module.exports = { markattandance, getattendance, update_attendance };
