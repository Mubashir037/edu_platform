const { z } = require("zod");

const base = {
  title: z.string().trim().min(1).max(150),
  body: z.string().trim().min(1).max(1000),
};

const bulkNotificationSchema = z.discriminatedUnion("target", [
  z.object({
    ...base,
    target: z.literal("ROLE"),
    role: z.enum(["TEACHER", "STUDENT", "PARENT"]),
  }),
  z.object({
    ...base,
    target: z.literal("CLASS"),
    classId: z.number().int().positive(),
    includeParents: z.boolean().optional().default(false),
  }),
  z.object({
    ...base,
    target: z.literal("USERS"),
    userIds: z.array(z.number().int().positive()).min(1).max(500),
  }),
]);

module.exports = { bulkNotificationSchema };