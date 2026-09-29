const { z } = require("zod");

const attendanceSchema = z.object({
  studentId: z.number().int().positive().max(2147483647),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["PRESENT", "ABSENT"])
});

module.exports = attendanceSchema;
