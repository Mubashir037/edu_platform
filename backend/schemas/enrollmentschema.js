const { z } = require("zod");

const enrollmentSchema = z.object({
  studentId: z.number().int().positive(),
  classId: z.number().int().positive(),
  sessionId: z.number().int().positive()
});

module.exports = enrollmentSchema;

