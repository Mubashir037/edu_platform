const { z } = require("zod");

const createQuerySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(150),
  phone: z.string().trim().max(20).optional(),
  subject: z.string().trim().max(150).optional(),
  message: z.string().trim().min(10).max(1000),
  website: z.string().optional(), // honeypot: real users leave it empty
});

const updateStatusSchema = z.object({
  status: z.enum(["NEW", "READ", "REPLIED"]),
});

module.exports = { createQuerySchema, updateStatusSchema };