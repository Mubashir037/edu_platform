const { z } = require("zod");

const studentSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  rollNo: z.number().int().positive(),
  classId: z.number().int().positive(),
  parentId: z.number().int().positive(),
  dob: z.coerce.date(),
  admissionDate: z.coerce.date()
});

module.exports = studentSchema;