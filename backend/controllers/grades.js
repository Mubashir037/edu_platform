const prisma = require('../config/prisma')

const assign_grade = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ msg: "Only teachers can assign grades" });
        }
        if (!req.body) {
            return res.status(400).json({ msg: "Provide grade details" });
        }
        const { enrollmentId, subjectId, examType, marks } = req.body;
        if (!Number.isInteger(enrollmentId) || enrollmentId <= 0 || enrollmentId > 2147483647) {
            return res.status(400).json({ msg: "Invalid enrollment ID" });
        }
        if (!Number.isInteger(subjectId) || subjectId <= 0 || subjectId > 2147483647) {
            return res.status(400).json({ msg: "Invalid subject ID" });
        }
        if (examType !== "MID1" && examType !== "MID2" && examType !== "FINAL") {
            return res.status(400).json({ msg: "Exam type must be MID1, MID2 or FINAL" });
        }
        // Keep the existing 0-100 marks range until exam maximums are decided.
        if (!Number.isFinite(marks) || marks < 0 || marks > 100) {
            return res.status(400).json({ msg: "Marks must be a number from 0 to 100" });
        }
        const teacher = await prisma.teacher.findUnique({
            where: {
                userId: req.user.id
            }
        });
        if (!teacher) {
            return res.status(404).json({
                msg: "teacher not found for grade assignments"
            })
        }
        const enrollment = await prisma.enrollment.findUnique({
            where: {
                id: enrollmentId
            },
            include: {
                class: true
            }
        });
        if (!enrollment) {
            return res.status(404).json({
                msg: "enrollment not found"
            })
        }
        const subject = await prisma.subject.findUnique({
            where: {
                id: subjectId
            }
        });

        if (!subject) {
            return res.status(404).json({
                msg: "Subject not found"
            });

        }
        if (subject.classId !== enrollment.classId) {
            return res.status(400).json({
                msg: "This subject does not belong to the student's enrolled class"
            });
        }
        if (enrollment.class.teacherId !== teacher.id) {
            return res.status(403).json({
                msg: "You cannot enter marks for this class"
            });
        }

        
        const existing = await prisma.grade.findFirst({
            where: {
                enrollmentId: enrollmentId,
                subjectId: subjectId,
                examType: examType
            }
        });
        if (existing) {
            return res.status(409).json({ msg: "Marks already entered for this exam and subject" });
        }

        const grade = await prisma.grade.create({
            data: {
                enrollmentId: enrollmentId,
                subjectId: subjectId,
                examType: examType,
                marks: marks,
                markedBy: teacher.id
            }
        });
        return res.status(201).json({ msg: "Marks assigned", grade });
    }
    catch (err) {
        if (err.code === "P2002") {
            return res.status(409).json({ msg: "Marks already entered for this exam and subject" });
        }
        if (err.code === "P2003") {
            return res.status(409).json({ msg: "The enrollment, subject or teacher no longer exists" });
        }
        next(err)
    }
}

const update_grade = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }
        if (req.user.role !== "TEACHER") {
            return res.status(403).json({ msg: "Only teachers can update grades" });
        }
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
            return res.status(400).json({ msg: "Invalid grade ID" });
        }
        if (!req.body) {
            return res.status(400).json({ msg: "Provide marks to update" });
        }
        const { marks } = req.body;
        if (!Number.isFinite(marks) || marks < 0 || marks > 100) {
            return res.status(400).json({ msg: "Marks must be a number from 0 to 100" });
        }

        const grade = await prisma.grade.findUnique({ where: { id: id } });
        if (!grade) {
            return res.status(404).json({ msg: "Grade not found" });
        }
        const teacher = await prisma.teacher.findUnique({
            where: { userId: req.user.id }
        });
        if (!teacher) {
            return res.status(403).json({ msg: "Teacher profile not found" });
        }
        const enrollment = await prisma.enrollment.findUnique({
            where: { id: grade.enrollmentId },
            include: { class: true }
        });
        if (!enrollment) {
            return res.status(404).json({ msg: "Enrollment not found" });
        }
        const subject = await prisma.subject.findUnique({
            where: { id: grade.subjectId }
        });
        if (!subject) {
            return res.status(404).json({ msg: "Subject not found" });
        }
        if (subject.classId !== enrollment.classId) {
            return res.status(400).json({ msg: "This subject does not belong to the student's enrolled class" });
        }
        if (enrollment.class.teacherId !== teacher.id) {
            return res.status(403).json({ msg: "You cannot update marks for this class" });
        }

        const updated_grade = await prisma.grade.update({
            where: { id: id },
            data: { marks: marks }
        });
        return res.status(200).json({ msg: "Marks updated", grade: updated_grade });
    }
    catch (err) {
        if (err.code === "P2025") {
            return res.status(404).json({ msg: "Grade not found" });
        }
        next(err);
    }
};

module.exports = { assign_grade, update_grade };
