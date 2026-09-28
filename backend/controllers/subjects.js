const prisma = require("../config/prisma");
const subjectSchema = require("../schemas/subjectschema");
const updateSubjectSchema = subjectSchema.partial();

const create_subject = async (req, res, next) => {
  try {
    const result = subjectSchema.safeParse(req.body);
    if (result.success === false) {
      return res.status(400).json({ msg: "Please enter valid subject details" });
    }
    const { name, classId } = result.data;
    const schoolClass = await prisma.class.findUnique({ where: { id: classId } });
    if (!schoolClass) {
      return res.status(404).json({ msg: "Class not found" });
    }
    const subject = await prisma.subject.create({ data: { name, classId } });
    return res.status(201).json({ msg: "Subject created", subject });
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(409).json({ msg: "The linked class no longer exists" });
    }
    next(err);
  }
};

const getall = async (req, res, next) => {
  try {
    const all_subjects = await prisma.subject.findMany();
    return res.status(200).json({ msg: "Subjects retrieved", all_subjects });
  } catch (err) {
    next(err);
  }
};

const getone = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid subject ID" });
    }
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      return res.status(404).json({ msg: "Subject not found" });
    }
    return res.status(200).json({ msg: "Subject found", subject });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid subject ID" });
    }
    const result = updateSubjectSchema.safeParse(req.body);
    if (result.success === false) {
      return res.status(400).json({ msg: "Please enter valid subject details" });
    }
    const { name, classId } = result.data;
    if (name === undefined && classId === undefined) {
      return res.status(400).json({ msg: "Provide at least one field to update" });
    }
    const existingSubject = await prisma.subject.findUnique({ where: { id } });
    if (!existingSubject) {
      return res.status(404).json({ msg: "Subject not found" });
    }
    if (classId !== undefined) {
      const schoolClass = await prisma.class.findUnique({ where: { id: classId } });
      if (!schoolClass) {
        return res.status(404).json({ msg: "Class not found" });
      }
    }
    const subjectData = {};
    if (name !== undefined) subjectData.name = name;
    if (classId !== undefined) subjectData.classId = classId;
    const subject = await prisma.subject.update({ where: { id }, data: subjectData });
    return res.status(200).json({ msg: "Subject updated", subject });
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(409).json({ msg: "The linked class no longer exists" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ msg: "Subject not found" });
    }
    next(err);
  }
};

const deletesubject = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid subject ID" });
    }
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      return res.status(404).json({ msg: "Subject not found" });
    }
    await prisma.subject.delete({ where: { id } });
    return res.status(200).json({ msg: "Subject deleted" });
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(409).json({ msg: "Cannot delete this subject because grades reference it" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ msg: "Subject not found" });
    }
    next(err);
  }
};

module.exports = { create_subject, getall, getone, update, deletesubject };
