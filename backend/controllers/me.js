const prisma = require("../config/prisma");

const enrollmentSelect = {
  id: true,
  status: true,
  session: { select: { id: true, name: true, isactive: true } },
  class: { select: { id: true, name: true } },
};

const getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true, name: true, email: true, role: true,
        teacher: { select: { id: true, subject: true, qualification: true } },
        student: { select: { id: true, rollNo: true, classId: true, parentId: true } },
        parent: { select: { id: true } },
      },
    });
    res.json(user);
  } catch (err) { next(err); }
};

const getMySubjects = async (req, res, next) => {
  try {
    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });

    const [subjects, classTeacherOf] = await Promise.all([
      prisma.subject.findMany({
        where: { teacherId: teacher.id },
        select: { id: true, name: true, class: { select: { id: true, name: true } } },
      }),
      prisma.class.findMany({
        where: { teacherId: teacher.id },
        select: { id: true, name: true },
      }),
    ]);
    res.json({ subjects, classTeacherOf });
  } catch (err) { next(err); }
};

const getClassEnrollments = async (req, res, next) => {
  try {
    const classId = Number(req.params.classId);
    if (!Number.isInteger(classId)) return res.status(400).json({ message: "Invalid class id" });

    const teacher = await prisma.teacher.findUnique({ where: { userId: req.user.id } });
    if (!teacher) return res.status(404).json({ message: "Teacher profile not found" });

    // Allowed if class teacher OR teaches a subject in this class
    const allowed = await prisma.class.findFirst({
      where: {
        id: classId,
        OR: [{ teacherId: teacher.id }, { subjects: { some: { teacherId: teacher.id } } }],
      },
      select: { id: true },
    });
    if (!allowed) return res.status(403).json({ message: "Not your class" });

    const where = { classId };
    if (req.query.sessionId) {
      const sid = Number(req.query.sessionId);
      if (!Number.isInteger(sid)) return res.status(400).json({ message: "Invalid sessionId" });
      where.sessionId = sid;
    } else {
      where.session = { isactive: true }; // default: current session
    }
    if (req.query.status) where.status = req.query.status;

    const enrollments = await prisma.enrollment.findMany({
      where,
      select: {
        id: true,
        status: true,
        sessionId: true,
        student: { select: { id: true, rollNo: true, user: { select: { name: true } } } },
      },
      orderBy: { student: { rollNo: "asc" } },
    });
    res.json(enrollments);
  } catch (err) { next(err); }
};

const getMyEnrollments = async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ message: "Student profile not found" });

    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: student.id },
      select: enrollmentSelect,
      orderBy: { id: "desc" },
    });
    res.json(enrollments);
  } catch (err) { next(err); }
};

const getMyChildren = async (req, res, next) => {
  try {
    const parent = await prisma.parent.findUnique({ where: { userId: req.user.id } });
    if (!parent) return res.status(404).json({ message: "Parent profile not found" });

    const children = await prisma.student.findMany({
      where: { parentId: parent.id },
      select: {
        id: true,
        rollNo: true,
        user: { select: { name: true } },
        enrollments: { select: enrollmentSelect, orderBy: { id: "desc" } },
      },
    });
    res.json(children);
  } catch (err) { next(err); }
};

module.exports = { getMe, getMySubjects, getClassEnrollments, getMyEnrollments, getMyChildren };