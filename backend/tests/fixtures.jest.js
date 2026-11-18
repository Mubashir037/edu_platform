const { setupWorld, cleanupWorld, call } = require("./fixtures");
const prisma = require("../config/prisma");

let w;
beforeAll(async () => { w = await setupWorld(); }, 60000);
afterAll(async () => { await cleanupWorld(w); await prisma.$disconnect(); }, 60000);

describe("Test data helper", () => {
  test("creates a full school with ids and tokens", () => {
    for (const k of ["teacherA", "teacherB", "parent1", "parent2", "class5", "class6", "student1", "student2", "math", "english", "session", "enroll1", "enroll2"]) {
      expect(w[k]).toEqual(expect.any(Number));
    }
    expect(w.tokens.student1).toEqual(expect.any(String));
  });

  test("students are enrolled in the active session", async () => {
    const res = await call("get", "/api/me/enrollments", w.tokens.student1);
    expect(res.status).toBe(200);
  });

  test("cleanup removes everything", async () => {
    await cleanupWorld(w);
    expect(await prisma.user.count({ where: { email: { in: Object.values(w.emails) } } })).toBe(0);
    expect(await prisma.academicsession.count({ where: { id: w.session } })).toBe(0);
  }, 60000);
});