const prisma = require('../config/prisma');

// Use the unrounded percentage to decide the letter grade.
const get_letter_grade = (percentage) => {
    if (percentage >= 80) {
        return "A1";
    }
    else if (percentage >= 70) {
        return "A";
    }
    else if (percentage >= 60) {
        return "B";
    }
    else if (percentage >= 50) {
        return "C";
    }
    else if (percentage >= 40) {
        return "D";
    }
    else {
        return "Fail";
    }
};

// Get subject marks and the combined result for one enrollment.
const get_result = async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ msg: "Please log in first" });
        }
        const enrollment_id = Number(req.params.id);
        if (!Number.isInteger(enrollment_id) || enrollment_id <= 0 || enrollment_id > 2147483647) {
            return res.status(400).json({ msg: "Invalid enrollment ID" });
        }

        const enrollment = await prisma.enrollment.findUnique({
            where: { id: enrollment_id },
            include: { student: true, class: true }
        });
        if (!enrollment) {
            return res.status(404).json({ msg: "Enrollment not found" });
        }

        let allowed = false;
        if (req.user.role === "ADMIN") {
            allowed = true;
        }
        else if (req.user.role === "TEACHER") {
            const teacher = await prisma.teacher.findUnique({
                where: { userId: req.user.id }
            });
            if (teacher && enrollment.class.teacherId === teacher.id) {
                allowed = true;
            }
        }
        else if (req.user.role === "STUDENT") {
            if (enrollment.student.userId === req.user.id) {
                allowed = true;
            }
        }
        else if (req.user.role === "PARENT") {
            const parent = await prisma.parent.findUnique({
                where: { userId: req.user.id }
            });
            if (parent && enrollment.student.parentId === parent.id) {
                allowed = true;
            }
        }
        if (allowed === false) {
            return res.status(403).json({ msg: "You cannot view this student's combined result" });
        }

        // Include every required subject, even when no marks have been entered.
        const required_subjects = await prisma.subject.findMany({
            where: { classId: enrollment.classId }
        });

        const grade = await prisma.grade.findMany({
            where: {
                enrollmentId: enrollment_id
            },
            include: {
                subject: true
            }
        });

        let subjects = {};

        for (const subject of required_subjects) {
            subjects[subject.id] = {
                subjectId: subject.id,
                name: subject.name,
                MID1: null,
                MID2: null,
                FINAL: null,
                percentage: null,
                letterGrade: null
            };
        }

        for (const record of grade) {
            const sub_id = record.subjectId;
            if (subjects[sub_id] === undefined) {
                continue;
            }

            // Put this exam's marks into the same subject entry.
            if (record.examType === "MID1") {
                subjects[sub_id].MID1 = record.marks;
            }
            else if (record.examType === "MID2") {
                subjects[sub_id].MID2 = record.marks;
            }
            else if (record.examType === "FINAL") {
                subjects[sub_id].FINAL = record.marks;
            }
        }

        let total = 0;
        let all_entered = true;
        let all_passed = true;
        let missing_marks = [];

        for (const subject of required_subjects) {
            const result = subjects[subject.id];

            if (result.MID1 === null || result.MID2 === null || result.FINAL === null) {
                all_entered = false;
                if (result.MID1 === null) missing_marks.push({ subjectId: subject.id, examType: "MID1" });
                if (result.MID2 === null) missing_marks.push({ subjectId: subject.id, examType: "MID2" });
                if (result.FINAL === null) missing_marks.push({ subjectId: subject.id, examType: "FINAL" });
                continue;
            }

            // Each exam is currently scored out of 100.
            const percentage = result.MID1 * 0.25 + result.MID2 * 0.25 + result.FINAL * 0.50;
            result.percentage = Number(percentage.toFixed(2));
            result.letterGrade = get_letter_grade(percentage);
            if (percentage < 40) all_passed = false;
            total = total + percentage;
        }

        if (required_subjects.length === 0 || all_entered === false) {
            return res.status(200).json({
                msg: "Result pending",
                overallStatus: "PENDING",
                enrollment_id,
                subjects,
                missing_marks,
                overallPercentage: null,
                overallGrade: null
            });
        }

        // Every subject has equal weight in the combined result.
        const overallPercentage = total / required_subjects.length;
        let overallStatus = "PASSED";
        if (all_passed === false) overallStatus = "FAILED";
        return res.status(200).json({
            msg: "Result complete",
            enrollment_id,
            overallStatus,
            subjects,
            overallPercentage: Number(overallPercentage.toFixed(2)),
            overallGrade: get_letter_grade(overallPercentage)
        });
    }
    catch (err) {
        next(err);
    }
};

module.exports = { get_result };
