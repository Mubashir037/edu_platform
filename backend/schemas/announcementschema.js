const { z } = require("zod");

const announcementSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  postedBy: z.number().int().positive(),
  targetRole: z.enum(["ADMIN", "TEACHER", "STUDENT", "PARENT"])
});

module.exports = announcementSchema;