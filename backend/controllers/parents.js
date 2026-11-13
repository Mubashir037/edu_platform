const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const parentSchema = require("../schemas/parentschema");
const updateParentSchema = parentSchema.partial();
const { disconnectUser } = require('../config/socketutils');
// Only return these User fields, never the password hash.
const userFields = { id: true, name: true, email: true, role: true };

const create_parent = async (req, res, next) => {
  try {
    const result = parentSchema.safeParse(req.body);
    if (result.success === false) {
      return res.status(400).json({ msg: "Please enter valid parent details" });
    }

    const { name, email, password } = result.data;
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ msg: "Email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: "PARENT" }
    });
    const parent = await prisma.parent.create({
      data: { userId: user.id },
      include: { user: { select: userFields } }
    });

    return res.status(201).json({ msg: "Parent created", parent });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ msg: "Email already exists" });
    }
    next(err);
  }
};

const getall = async (req, res, next) => {
  try {
    const all_parents = await prisma.parent.findMany({
      include: { user: { select: userFields } }
    });
    return res.status(200).json({ msg: "Parents retrieved", all_parents });
  } catch (err) {
    next(err);
  }
};

const getone = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid parent ID" });
    }

    const parent = await prisma.parent.findUnique({
      where: { id },
      include: { user: { select: userFields } }
    });
    if (!parent) {
      return res.status(404).json({ msg: "Parent not found" });
    }

    return res.status(200).json({ msg: "Parent found", parent });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid parent ID" });
    }

    const result = updateParentSchema.safeParse(req.body);
    if (result.success === false) {
      return res.status(400).json({ msg: "Please enter valid parent details" });
    }
    const { name, email, password } = result.data;
    if (name === undefined && email === undefined && password === undefined) {
      return res.status(400).json({ msg: "Provide at least one field to update" });
    }

    const existingParent = await prisma.parent.findUnique({ where: { id } });
    if (!existingParent) {
      return res.status(404).json({ msg: "Parent not found" });
    }

    const userData = {};
    if (name !== undefined) userData.name = name;
    if (email !== undefined) userData.email = email;
    if (password !== undefined) {
      userData.passwordHash = await bcrypt.hash(password, 10);
    }

    // Parent has no editable profile fields; they are stored in User.
    await prisma.user.update({
      where: { id: existingParent.userId },
      data: userData
    });
    const parent = await prisma.parent.findUnique({
      where: { id },
      include: { user: { select: userFields } }
    });

    return res.status(200).json({ msg: "Parent updated", parent });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ msg: "Email already exists" });
    }
    if (err.code === "P2025") {
      return res.status(404).json({ msg: "Parent or user account not found" });
    }
    next(err);
  }
};

const deleteparent = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) {
      return res.status(400).json({ msg: "Invalid parent ID" });
    }

    const parent = await prisma.parent.findUnique({ where: { id } });
    if (!parent) {
      return res.status(404).json({ msg: "Parent not found" });
    }

    await prisma.parent.delete({ where: { id } });
    await prisma.user.delete({ where: { id: parent.userId } });
    disconnectUser(req.app.get('io'), parent.userId);
    return res.status(200).json({ msg: "Parent and user account deleted" });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ msg: "Parent or user account not found" });
    }
    if (err.code === "P2003") {
      return res.status(409).json({
        msg: "Cannot delete this parent because other records reference the parent or user account"
      });
    }
    next(err);
  }
};

module.exports = { create_parent, getall, getone, update, deleteparent };
