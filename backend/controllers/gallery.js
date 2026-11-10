const crypto = require("crypto");
const prisma = require("../config/prisma");
const supabase = require("../config/supabase");

const BUCKET = "gallery";
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Image file is required (field: image)" });
    const { title, caption } = req.body;
    const path = `${Date.now()}-${crypto.randomUUID()}.${EXT[req.file.mimetype]}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, req.file.buffer, { contentType: req.file.mimetype });
    if (error) return next(error);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    try {
      const image = await prisma.galleryImage.create({
        data: { title: title || null, caption: caption || null, url: data.publicUrl, path },
      });
      res.status(201).json(image);
    } catch (dbErr) {
      await supabase.storage.from(BUCKET).remove([path]); // avoid orphan file
      next(dbErr);
    }
  } catch (err) { next(err); }
};

const listImages = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 12, 50);
    const [items, total] = await Promise.all([
      prisma.galleryImage.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.galleryImage.count(),
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

const updateImage = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const { title, caption } = req.body;
    const image = await prisma.galleryImage.update({
      where: { id },
      data: { ...(title !== undefined && { title }), ...(caption !== undefined && { caption }) },
    });
    res.json(image);
  } catch (err) { next(err); }
};
const replaceImage = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    if (!req.file) return res.status(400).json({ message: "Image file is required (field: image)" });

    const existing = await prisma.galleryImage.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Image not found" });

    // 1. Upload the new file under a new path
    const newPath = `${Date.now()}-${crypto.randomUUID()}.${EXT[req.file.mimetype]}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(newPath, req.file.buffer, { contentType: req.file.mimetype });
    if (error) return next(error);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(newPath);

    // 2. Point the database row at the new file
    let updated;
    try {
      updated = await prisma.galleryImage.update({
        where: { id },
        data: { url: data.publicUrl, path: newPath },
      });
    } catch (dbErr) {
      await supabase.storage.from(BUCKET).remove([newPath]); // roll back the new upload
      return next(dbErr);
    }

    // 3. Only now delete the old file
    await supabase.storage.from(BUCKET).remove([existing.path]);

    res.json(updated);
  } catch (err) { next(err); }
};

const deleteImage = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    const image = await prisma.galleryImage.findUnique({ where: { id } });
    if (!image) return res.status(404).json({ message: "Image not found" });
    await supabase.storage.from(BUCKET).remove([image.path]);
    await prisma.galleryImage.delete({ where: { id } });
    res.json({ message: "Image deleted" });
  } catch (err) { next(err); }
};


module.exports = { uploadImage, listImages, updateImage, deleteImage, replaceImage };