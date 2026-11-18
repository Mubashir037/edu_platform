const { setupWorld, cleanupWorld, call } = require("./fixtures");
const prisma = require("../config/prisma");

let w, t;
beforeAll(async () => { w = await setupWorld(); t = w.tokens; }, 60000);
afterAll(async () => { await cleanupWorld(w); await prisma.$disconnect(); }, 60000);

const mark = (token, date, status = "PRESENT", enroll = w.enroll1) =>
  call("post", "/api/attendance", token, { enroll_id: enroll, date, status });

describe("Attendance", () => {
  test("teacher marks PRESENT and ABSENT -> 201", async () => {
    expect((await mark(t.teacherA, "2026-11-02", "PRESENT")).status).toBe(201);
    expect((await mark(t.teacherA, "2026-11-03", "ABSENT")).status).toBe(201);
  });
  test("same day twice -> 409", async () => {
    expect((await mark(t.teacherA, "2026-11-02")).status).toBe(409);
  });
  test("date outside the session -> 400", async () => {
    expect((await mark(t.teacherA, "2026-01-01")).status).toBe(400);
  });
  test("invalid status -> 400", async () => {
    expect((await mark(t.teacherA, "2026-11-04", "LATE")).status).toBe(400);
  });
  test("other class's teacher -> 403", async () => {
    expect((await mark(t.teacherB, "2026-11-05")).status).toBe(403);
  });
  test("student cannot mark -> 403", async () => {
    expect((await mark(t.student1, "2026-11-05")).status).toBe(403);
  });
  test("unknown enrollment -> 404", async () => {
    expect((await mark(t.teacherA, "2026-11-05", "PRESENT", 999999999)).status).toBe(404);
  });
  test("percentage: 1 present + 1 absent = 50", async () => {
    const res = await call("get", `/api/attendance/enrollment/${w.enroll1}`, t.student1);
    expect(res.status).toBe(200);
    expect(res.body.present).toBe(1);
    expect(res.body.absent).toBe(1);
    expect(res.body.percentage).toBe(50);
  });
  test("parent of the student can read -> 200", async () => {
    expect((await call("get", `/api/attendance/enrollment/${w.enroll1}`, t.parent1)).status).toBe(200);
  });
  test("other student / other parent cannot read -> 403", async () => {
    expect((await call("get", `/api/attendance/enrollment/${w.enroll1}`, t.student2)).status).toBe(403);
    expect((await call("get", `/api/attendance/enrollment/${w.enroll1}`, t.parent2)).status).toBe(403);
  });
});