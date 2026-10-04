const { z } = require("zod");

const promoteSchema = z.object({
    sessionId: z.number().int().positive(),
    classId: z.number().int().positive(),
    nextSessionId: z.number().int().positive(),
    nextClassId: z.number().int().positive()
});

const graduateSchema = promoteSchema.pick({ sessionId: true, classId: true });

module.exports = { promoteSchema, graduateSchema };
