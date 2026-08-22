const { z } = require("zod");

const teacherSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  subject: z.string().min(1),
  qualification: z.string().min(1),
  joiningDate: z.coerce.date()
});

module.exports = teacherSchema;