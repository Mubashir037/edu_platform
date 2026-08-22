const { z } = require("zod");

const gradeSchema = z.object({
  studentId: z.number().int().positive(),
  subjectId: z.number().int().positive(),
  examName: z.string().min(1),
  marks: z.number().min(0).max(100),
  term: z.string().min(1)
});

module.exports = gradeSchema;