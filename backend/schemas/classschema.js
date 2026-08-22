const { z } = require("zod");

const classSchema = z.object({
  name: z.string().min(1),
  teacherId: z.number().int().positive()
});

module.exports = classSchema;