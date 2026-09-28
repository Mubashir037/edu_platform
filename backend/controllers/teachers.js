const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const teacherSchema = require("../schemas/teacherschema");
const updateTeacherSchema = teacherSchema.partial();

// Return profile details without exposing the password hash.
const userFields = { id: true, name: true, email: true, role: true };

const create_teacher = async (req, res, next) => {
  try {
    const result = teacherSchema.safeParse(req.body);
    if (result.success === false) {
      return res.status(400).json({ msg: "Please enter valid teacher details" });
    }

    const { name, email, password, subject, qualification, joiningDate } = result.data;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: "TEACHER" }
    });

    const teacher = await prisma.teacher.create({
      data: {
        userId: user.id,
        subject,
        qualification,
        joiningDate
      },
      include: { user: { select: userFields } }
    });

    return res.status(201).json({ message: "Teacher created", teacher });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ msg: "Email already exists" });
    }
    next(err);
  }
};

const getone = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid teacher ID" });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { user: { select: userFields } }
    });

    if (!teacher) {
      return res.status(404).json({ msg: "Teacher not found" });
    }
    return res.status(200).json({ msg: "Teacher found", teacher });
  } catch (err) {
    next(err);
  }
};

const getall = async (req, res, next) => {
  try {
    const all_teachers = await prisma.teacher.findMany({
      include: { user: { select: userFields } }
    });

    // An empty list is a successful response too.
    return res.status(200).json({ msg: "Teachers retrieved", all_teachers });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid teacher ID" });
    }

    const result = updateTeacherSchema.safeParse(req.body);
    if (result.success === false) {
      return res.status(400).json({ msg: "Please enter valid teacher details" });
    }

    const { name, email, password, subject, qualification, joiningDate } = result.data;
    const userData = {};
    const teacherData = {};

    if (name !== undefined) userData.name = name;
    if (email !== undefined) userData.email = email;
    if (subject !== undefined) teacherData.subject = subject;
    if (qualification !== undefined) teacherData.qualification = qualification;
    if (joiningDate !== undefined) teacherData.joiningDate = joiningDate;

    const userFieldCount = Object.keys(userData).length;
    const teacherFieldCount = Object.keys(teacherData).length;
    if (userFieldCount === 0 && teacherFieldCount === 0 && password === undefined) {
      return res.status(400).json({ msg: "Provide at least one field to update" });
    }

    const existingTeacher = await prisma.teacher.findUnique({ where: { id } });
    if (!existingTeacher) {
      return res.status(404).json({ msg: "Teacher not found" });
    }

    if (password !== undefined) {
      userData.passwordHash = await bcrypt.hash(password, 10);
    }
    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: existingTeacher.userId },
        data: userData
      });
    }

    if (Object.keys(teacherData).length > 0) {
      await prisma.teacher.update({
        where: { id },
        data: teacherData
      });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: { user: { select: userFields } }
    });

    return res.status(200).json({ msg: "Teacher updated", teacher });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ msg: "Email already exists" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ msg: "Teacher not found" });
    }
    next(err);
  }
};

const deleteteacher = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid teacher ID" });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id } });
    if (!teacher) {
      return res.status(404).json({ msg: "Teacher not found" });
    }

    await prisma.teacher.delete({ where: { id } });
    await prisma.user.delete({
      where: { id: teacher.userId }
    });

    return res.status(200).json({ msg: "Teacher and user account deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ msg: "Teacher not found" });
    }
    if (err.code === "P2003") {
      return res.status(409).json({
        msg: "Cannot delete this teacher because other records reference the teacher or user account"
      });
    }
    next(err);
  }
};

module.exports = { create_teacher, getone, getall, update, deleteteacher };
