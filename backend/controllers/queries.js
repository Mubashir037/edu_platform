const prisma = require("../config/prisma");

const createQuery = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message, website } = req.body;
    // Honeypot filled = bot. Pretend success, save nothing.
    if (website) return res.status(201).json({ message: "Message sent" });

    await prisma.contactQuery.create({
      data: { name, email, phone: phone || null, subject: subject || null, message },
    });
    res.status(201).json({ message: "Message sent" });
  } catch (err) { next(err); }
};

const listQueries = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const where = ["NEW", "READ", "REPLIED"].includes(req.query.status)
      ? { status: req.query.status }
      : {};
    const [items, total] = await Promise.all([
      prisma.contactQuery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contactQuery.count({ where }),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

const getQuery = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const query = await prisma.contactQuery.findUnique({ where: { id } });
    if (!query) return res.status(404).json({ message: "Query not found" });
    res.json(query);
  } catch (err) { next(err); }
};

const updateQueryStatus = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const query = await prisma.contactQuery.update({
      where: { id },
      data: { status: req.body.status },
    });
    res.json(query);
  } catch (err) { next(err); }
};

const deleteQuery = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    await prisma.contactQuery.delete({ where: { id } });
    res.json({ message: "Query deleted" });
  } catch (err) { next(err); }
};

module.exports = { createQuery, listQueries, getQuery, updateQueryStatus, deleteQuery };