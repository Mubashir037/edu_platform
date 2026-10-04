const prisma = require('../config/prisma');
const { promoteSchema, graduateSchema } = require('../schemas/progressionschema');

// Avoid overlapping progression requests in this running server.
let processing = false;

// All three exams are out of 100, with weights 25%, 25%, 50%.
const check_result = (subjects, grades) => {
    let pending = subjects.length === 0;
    let passed = true;
    for (const subject of subjects) {
        let mid1 = null;
        let mid2 = null;
        let final = null;
        for (const grade of grades) {
            if (grade.subjectId !== subject.id) continue;
            if (grade.examType === 'MID1') mid1 = grade.marks;
            if (grade.examType === 'MID2') mid2 = grade.marks;
            if (grade.examType === 'FINAL') final = grade.marks;
        }
        if (mid1 === null || mid2 === null || final === null) {
            pending = true;
            continue;
        }
        if (!Number.isFinite(mid1) || !Number.isFinite(mid2) || !Number.isFinite(final) ||
            mid1 < 0 || mid1 > 100 || mid2 < 0 || mid2 > 100 || final < 0 || final > 100) {
            pending = true;
            continue;
        }
        const percentage = mid1 * 0.25 + mid2 * 0.25 + final * 0.50;
        if (percentage < 40) passed = false;
    }
    return { pending, passed };
};

const withdraw_student = async (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ msg: 'Admin access required' });
    }
    if (processing) {
        return res.status(409).json({ msg: 'A progression request is running. Try again shortly.' });
    }
    processing = true;
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
            return res.status(400).json({ msg: 'Invalid enrollment ID' });
        }
        const enrollment = await prisma.enrollment.findUnique({
            where: { id }, include: { student: true, session: true }
        });
        if (!enrollment) {
            return res.status(404).json({ msg: 'Enrollment not found' });
        }
        if (enrollment.status !== 'ACTIVE' && enrollment.status !== 'WITHDRAWN') {
            return res.status(409).json({ msg: 'Only an active enrollment can be withdrawn' });
        }
        if (enrollment.session.closedAt) {
            return res.status(409).json({ msg: 'This session is already closed' });
        }
        const other = await prisma.enrollment.findFirst({
            where: { studentId: enrollment.studentId, status: 'ACTIVE', id: { not: id } }
        });
        if (other) {
            return res.status(409).json({ msg: 'This student has another active enrollment. Resolve it before withdrawing the account.' });
        }
        // Repeating the request can finish either step if the previous attempt failed.
        await prisma.user.update({ where: { id: enrollment.student.userId }, data: { isActive: false } });
        if (enrollment.status === 'ACTIVE') {
            await prisma.enrollment.update({
                where: { id }, data: { status: 'WITHDRAWN', withdrawnAt: new Date() }
            });
        }
        return res.status(200).json({ msg: 'Student withdrawn; login disabled; history preserved' });
    }
    catch (err) {
        next(err);
    }
    finally {
        // Allow the next request, even if this request failed.
        processing = false;
    }
};

// Promote passing students into the selected next class and session.
const promote_students = async (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ msg: 'Admin access required' });
    }
    if (processing) {
        return res.status(409).json({ msg: 'A progression request is running. Try again shortly.' });
    }
    processing = true;
    const report = { promoted: [], graduated: [], failed: [], pending: [], skipped: [], errors: [] };
    try {
        const result = promoteSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ msg: 'Provide valid session and class IDs' });
        }
        const { sessionId, classId, nextSessionId, nextClassId } = result.data;
        const session = await prisma.academicsession.findUnique({ where: { id: sessionId } });
        if (!session) {
            return res.status(404).json({ msg: 'Session not found' });
        }
        if (session.closedAt) {
            return res.status(409).json({ msg: 'Session already closed' });
        }
        const schoolClass = await prisma.class.findUnique({ where: { id: classId } });
        if (!schoolClass) {
            return res.status(404).json({ msg: 'Class not found' });
        }
        if (sessionId === nextSessionId || classId === nextClassId) {
            return res.status(400).json({ msg: 'Select a different next session and next class' });
        }
        const nextSession = await prisma.academicsession.findUnique({ where: { id: nextSessionId } });
        const nextClass = await prisma.class.findUnique({ where: { id: nextClassId } });
        if (!nextSession || !nextClass) {
            return res.status(404).json({ msg: 'Next session or class not found' });
        }
        if (nextSession.closedAt || nextSession.startDate <= session.enddate) {
            return res.status(400).json({ msg: 'Next session must be open and start after the current session ends' });
        }
        const subjects = await prisma.subject.findMany({ where: { classId } });
        const enrollments = await prisma.enrollment.findMany({
            where: { sessionId, classId },
            include: { grades: true, student: { include: { user: true } } }
        });
        for (const enrollment of enrollments) {
            const id = enrollment.id;
            if (enrollment.status !== 'ACTIVE' || !enrollment.student.user.isActive) {
                let reason = enrollment.status;
                if (enrollment.status === 'ACTIVE') {
                    reason = 'ACCOUNT_INACTIVE';
                }
                report.skipped.push({ enrollmentId: id, reason: reason });
                continue;
            }
            const result = check_result(subjects, enrollment.grades);
            if (result.pending) {
                report.pending.push(id);
                continue;
            }
            try {
                if (!result.passed) {
                    // A failed result is complete, but the student is not promoted.
                    await prisma.enrollment.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
                    report.failed.push(id);
                    continue;
                }
                let target = await prisma.enrollment.findFirst({
                    where: { studentId: enrollment.studentId, sessionId: nextSessionId }
                });
                if (target && (target.classId !== nextClassId || target.status !== 'ACTIVE')) {
                    report.skipped.push({ enrollmentId: id, reason: 'Conflicting enrollment already exists in the next session' });
                    continue;
                }
                if (!target) {
                    target = await prisma.enrollment.create({
                        data: { studentId: enrollment.studentId, classId: nextClassId, sessionId: nextSessionId }
                    });
                }
                // Keep the legacy current-class field consistent until it is retired.
                await prisma.student.update({ where: { id: enrollment.studentId }, data: { classId: nextClassId } });
                await prisma.enrollment.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
                report.promoted.push({ enrollmentId: id, newEnrollmentId: target.id });
            }
            catch (err) {
                // Previous students remain processed; this student can be retried.
                console.error(err);
                report.errors.push({ enrollmentId: id, msg: 'Could not finish processing this enrollment. Retry the request.' });
            }
        }
        return res.status(200).json({ msg: 'Class processing finished. Review pending, skipped and errors before closing the session.', report });
    }
    catch (err) {
        next(err);
    }
    finally {
        // Allow the next request, even if this request failed.
        processing = false;
    }
};

// Finish school for passing students in the final class.
const graduate_students = async (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ msg: 'Admin access required' });
    }
    if (processing) {
        return res.status(409).json({ msg: 'A progression request is running. Try again shortly.' });
    }
    processing = true;
    const report = { promoted: [], graduated: [], failed: [], pending: [], skipped: [], errors: [] };
    try {
        const result = graduateSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ msg: 'Provide valid session and class IDs' });
        }
        const { sessionId, classId } = result.data;
        const session = await prisma.academicsession.findUnique({ where: { id: sessionId } });
        if (!session) {
            return res.status(404).json({ msg: 'Session not found' });
        }
        if (session.closedAt) {
            return res.status(409).json({ msg: 'Session already closed' });
        }
        const schoolClass = await prisma.class.findUnique({ where: { id: classId } });
        if (!schoolClass) {
            return res.status(404).json({ msg: 'Class not found' });
        }
        const subjects = await prisma.subject.findMany({ where: { classId } });
        const enrollments = await prisma.enrollment.findMany({
            where: { sessionId, classId },
            include: { grades: true, student: { include: { user: true } } }
        });
        for (const enrollment of enrollments) {
            const id = enrollment.id;
            if (enrollment.status !== 'ACTIVE' || !enrollment.student.user.isActive) {
                let reason = enrollment.status;
                if (enrollment.status === 'ACTIVE') {
                    reason = 'ACCOUNT_INACTIVE';
                }
                report.skipped.push({ enrollmentId: id, reason: reason });
                continue;
            }
            const result = check_result(subjects, enrollment.grades);
            if (result.pending) {
                report.pending.push(id);
                continue;
            }
            try {
                if (!result.passed) {
                    // A failed result is complete, but the student is not promoted.
                    await prisma.enrollment.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
                    report.failed.push(id);
                    continue;
                }
                await prisma.enrollment.update({
                    where: { id },
                    data: { status: 'GRADUATED', completedAt: new Date() }
                });
                report.graduated.push(id);
            }
            catch (err) {
                // Previous students remain processed; this student can be retried.
                console.error(err);
                report.errors.push({ enrollmentId: id, msg: 'Could not finish processing this enrollment. Retry the request.' });
            }
        }
        return res.status(200).json({ msg: 'Class processing finished. Review pending, skipped and errors before closing the session.', report });
    }
    catch (err) {
        next(err);
    }
    finally {
        // Allow the next request, even if this request failed.
        processing = false;
    }
};

const close_session = async (req, res, next) => {
    if (!req.user || req.user.role !== 'ADMIN') {
        return res.status(403).json({ msg: 'Admin access required' });
    }
    if (processing) {
        return res.status(409).json({ msg: 'A progression request is running. Try again shortly.' });
    }
    processing = true;
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
            return res.status(400).json({ msg: 'Invalid session ID' });
        }
        const session = await prisma.academicsession.findUnique({ where: { id } });
        if (!session) {
            return res.status(404).json({ msg: 'Session not found' });
        }
        if (session.closedAt) {
            return res.status(200).json({ msg: 'Session already closed' });
        }
        const remaining = await prisma.enrollment.count({ where: { sessionId: id, status: 'ACTIVE' } });
        if (remaining > 0) {
            return res.status(409).json({ msg: 'Process all active enrollments before closing the session', remaining });
        }
        await prisma.academicsession.update({ where: { id }, data: { isactive: false, closedAt: new Date() } });
        return res.status(200).json({ msg: 'Session closed; old enrollments and results preserved' });
    }
    catch (err) {
        next(err);
    }
    finally {
        // Allow the next request, even if this request failed.
        processing = false;
    }
};

module.exports = { withdraw_student, promote_students, graduate_students, close_session };
