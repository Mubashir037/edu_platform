const { z } = require("zod");

const attendanceSchema = z.object({
  studentId: z.number().int().positive(),
  date: z.coerce.date(),
  status: z.enum(["PRESENT", "ABSENT"]),
  markedBy: z.number().int().positive()
});

module.exports = attendanceSchema;