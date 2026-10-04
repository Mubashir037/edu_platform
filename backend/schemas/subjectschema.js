const { z } = require("zod");

const subjectSchema = z.object({
  name: z.string().min(1),
  classId: z.number().int().positive(),
  teacherId: z.number().int().positive().max(2147483647)
});

module.exports = subjectSchema;
