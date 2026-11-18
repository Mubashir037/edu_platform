const { setupWorld, cleanupWorld, call } = require("./fixtures");
const prisma = require("../config/prisma");

let w, t;
beforeAll(async () => { w = await setupWorld(); t = w.tokens; }, 60000);
afterAll(async () => { await cleanupWorld(w); await prisma.$disconnect(); }, 60000);

describe("Role access", () => {
  test("no token on a protected route is 401", async () => {
    expect((await call("get", "/api/students")).status).toBe(401);
  });
  test("teacher cannot create a teacher", async () => {
    expect((await call("post", "/api/teachers", t.teacherA, {})).status).toBe(403);
  });
  test("teacher cannot register users", async () => {
    expect((await call("post", "/api/auth/register", t.teacherA, {})).status).toBe(403);
  });
  test("student cannot list students", async () => {
    expect((await call("get", "/api/students", t.student1)).status).toBe(403);
  });
  test("admin can list students, with paging fields", async () => {
    const res = await call("get", "/api/students?page=1&limit=1", t.admin);
    expect(res.status).toBe(200);
    expect(res.body.all_students.length).toBe(1);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.pages).toBeDefined();
  });
});

describe("/api/me", () => {
  test("student sees STUDENT role", async () => {
    const res = await call("get", "/api/me", t.student1);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("STUDENT");
  });
  test("student cannot use teacher lookup", async () => {
    expect((await call("get", "/api/me/subjects", t.student1)).status).toBe(403);
  });
  test("parent sees only their own child", async () => {
    const res = await call("get", "/api/me/children", t.parent1);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});