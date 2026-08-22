const { z } = require("zod");

const subjectSchema = z.object({
  name: z.string().min(1),
  classId: z.number().int().positive()
});

module.exports = subjectSchema;