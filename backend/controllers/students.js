const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const studentSchema = require("../schemas/studentschema");
const updateStudentSchema = studentSchema.partial();
const userFields = { id: true, name: true, email: true, role: true };
const { disconnectUser } = require('../config/socketutils');
const create_student = async (req, res, next) => {
  try {
    const result = studentSchema.safeParse(req.body);
    if (result.success === false) {
      return res.status(400).json({ msg: "Please enter valid student details" });
    }
    const { name, email, password, rollNo, classId, parentId, dob, admissionDate } = result.data;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ msg: "Email already exists" });
    }
    const existingStudent = await prisma.student.findUnique({ where: { rollNo } });
    if (existingStudent) {
      return res.status(409).json({ msg: "Roll number already exists" });
    }
    const schoolClass = await prisma.class.findUnique({ where: { id: classId } });
    if (!schoolClass) {
      return res.status(404).json({ msg: "Class not found" });
    }
    const parent = await prisma.parent.findUnique({ where: { id: parentId } });
    if (!parent) {
      return res.status(404).json({ msg: "Parent not found" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: "STUDENT" }
    });
    const student = await prisma.student.create({
      data: { userId: user.id, rollNo, classId, parentId, dob, admissionDate },
      include: { user: { select: userFields } }
    });
    return res.status(201).json({ msg: "Student created", student });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ msg: "Email or roll number already exists" });
    }
    if (err.code === "P2003") {
      return res.status(409).json({ msg: "The linked class, parent or user no longer exists" });
    }
    next(err);
  }
};
const getall = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);

    const where = {};
    const classId = Number(req.query.classId);
    if (Number.isInteger(classId) && classId > 0) where.classId = classId;

    const [all_students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: { user: { select: userFields } },
        orderBy: { id: "asc" },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.student.count({ where })
    ]);

    return res.status(200).json({
      msg: "Students retrieved",
      all_students,
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  } catch (err) {
    next(err);
  }
};

const getone = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid student ID" });
    }
    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: { select: userFields } }
    });
    if (!student) {
      return res.status(404).json({ msg: "Student not found" });
    }
    return res.status(200).json({ msg: "Student found", student });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid student ID" });
    }
    const result = updateStudentSchema.safeParse(req.body);
    if (result.success === false) {
      return res.status(400).json({ msg: "Please enter valid student details" });
    }
    const { name, email, password, rollNo, classId, parentId, dob, admissionDate } = result.data;
    if (Object.keys(result.data).length === 0) {
      return res.status(400).json({ msg: "Provide at least one field to update" });
    }
    const existingStudent = await prisma.student.findUnique({ where: { id } });
    if (!existingStudent) {
      return res.status(404).json({ msg: "Student not found" });
    }
    if (email !== undefined) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && user.id !== existingStudent.userId) {
        return res.status(409).json({ msg: "Email already exists" });
      }
    }
    if (rollNo !== undefined) {
      const student = await prisma.student.findUnique({ where: { rollNo } });
      if (student && student.id !== id) {
        return res.status(409).json({ msg: "Roll number already exists" });
      }
    }
    if (classId !== undefined) {
      const schoolClass = await prisma.class.findUnique({ where: { id: classId } });
      if (!schoolClass) {
        return res.status(404).json({ msg: "Class not found" });
      }
    }
    if (parentId !== undefined) {
      const parent = await prisma.parent.findUnique({ where: { id: parentId } });
      if (!parent) {
        return res.status(404).json({ msg: "Parent not found" });
      }
    }

    const userData = {};
    const studentData = {};
    if (name !== undefined) userData.name = name;
    if (email !== undefined) userData.email = email;
    if (password !== undefined) userData.passwordHash = await bcrypt.hash(password, 10);
    if (rollNo !== undefined) studentData.rollNo = rollNo;
    if (classId !== undefined) studentData.classId = classId;
    if (parentId !== undefined) studentData.parentId = parentId;
    if (dob !== undefined) studentData.dob = dob;
    if (admissionDate !== undefined) studentData.admissionDate = admissionDate;

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({ where: { id: existingStudent.userId }, data: userData });
    }
    if (Object.keys(studentData).length > 0) {
      await prisma.student.update({ where: { id }, data: studentData });
    }
    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: { select: userFields } }
    });
    return res.status(200).json({ msg: "Student updated", student });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ msg: "Email or roll number already exists" });
    }
    if (err.code === "P2003") {
      return res.status(409).json({ msg: "The linked class or parent no longer exists" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ msg: "Student or user account not found" });
    }
    next(err);
  }
};

const deletestudent = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid student ID" });
    }
    const student = await prisma.student.findUnique({ where: { id } });
    if (!student) {
      return res.status(404).json({ msg: "Student not found" });
    }
    await prisma.student.delete({ where: { id } });
    await prisma.user.delete({ where: { id: student.userId } });
    disconnectUser(req.app.get('io'), student.userId);
    return res.status(200).json({ msg: "Student and user account deleted" });
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(409).json({ msg: "Cannot delete this student because other records reference the student or user account" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ msg: "Student or user account not found" });
    }
    next(err);
  }
};

module.exports = { create_student, getall, getone, update, deletestudent };
