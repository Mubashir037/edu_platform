const { z } = require("zod");

const announcementSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  isPublished: z.boolean().optional()
});

module.exports = announcementSchema;
