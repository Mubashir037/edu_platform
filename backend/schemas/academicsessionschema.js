const { z } = require("zod");

const academicSessionSchema = z.object({
  name: z.string().trim().min(1),
  startDate: z.string().min(1).pipe(z.coerce.date()),
  enddate: z.string().min(1).pipe(z.coerce.date()),
  isactive: z.boolean().optional()
});

module.exports = academicSessionSchema;
