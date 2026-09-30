const { z } = require("zod");

const gradeSchema = z.object({
  enrollmentId: z.number().int().positive().max(2147483647),
  subjectId: z.number().int().positive().max(2147483647),
  examType: z.enum(["MID1", "MID2", "FINAL"]),
  marks: z.number().min(0).max(100)
});

module.exports = gradeSchema;
