const { setupWorld, cleanupWorld, call } = require("./fixtures");
const prisma = require("../config/prisma");
jest.setTimeout(60000);

let w, t;
beforeAll(async () => { w = await setupWorld(); t = w.tokens; }, 60000);
afterAll(async () => { await cleanupWorld(w); await prisma.$disconnect(); }, 60000);

const put = (token, enroll, subject, exam, marks) =>
  call("post", "/api/grades", token, { enrollmentId: enroll, subjectId: subject, examType: exam, marks });
const result = (token, enroll) => call("get", `/api/results/enrollment/${enroll}`, token);

// Enter all three exams for one subject.
const fill = async (token, enroll, subject, [a, b, c]) => {
  for (const [exam, m] of [["MID1", a], ["MID2", b], ["FINAL", c]]) {
    const r = await put(token, enroll, subject, exam, m);
    if (r.status !== 201) throw new Error(`fill ${exam}: got ${r.status}`);
  }
};
// Change all three existing marks of one subject to the same value.
const setAll = async (token, enroll, subject, x) => {
  const rows = await prisma.grade.findMany({ where: { enrollmentId: enroll, subjectId: subject } });
  for (const g of rows) {
    const r = await call("patch", `/api/grades/${g.id}`, token, { marks: x });
    if (r.status !== 200) throw new Error(`patch: got ${r.status}`);
  }
};

describe("Marks entry rules", () => {
  test("marks 101, -1 and a bad exam type -> 400", async () => {
    expect((await put(t.teacherB, w.enroll1, w.math, "MID1", 101)).status).toBe(400);
    expect((await put(t.teacherB, w.enroll1, w.math, "MID1", -1)).status).toBe(400);
    expect((await put(t.teacherB, w.enroll1, w.math, "MID3", 50)).status).toBe(400);
  });
  test("teacher of another subject -> 403", async () => {
    expect((await put(t.teacherA, w.enroll1, w.math, "MID1", 50)).status).toBe(403);
    expect((await put(t.teacherB, w.enroll1, w.english, "MID1", 50)).status).toBe(403);
  });
  test("student cannot enter marks -> 403", async () => {
    expect((await put(t.student1, w.enroll1, w.math, "MID1", 50)).status).toBe(403);
  });
  test("valid marks -> 201, same exam twice -> 409", async () => {
    expect((await put(t.teacherB, w.enroll1, w.math, "MID1", 80)).status).toBe(201);
    expect((await put(t.teacherB, w.enroll1, w.math, "MID1", 80)).status).toBe(409);
  });
});

describe("Result maths", () => {
  test("student 1: Math 80 (A1), English 70 (A), overall 75, PASSED", async () => {
    await put(t.teacherB, w.enroll1, w.math, "MID2", 80);
    await put(t.teacherB, w.enroll1, w.math, "FINAL", 80);
    await fill(t.teacherA, w.enroll1, w.english, [70, 70, 70]);
    const res = await result(t.student1, w.enroll1);
    expect(res.status).toBe(200);
    expect(res.body.subjects[w.math].percentage).toBe(80);
    expect(res.body.subjects[w.math].letterGrade).toBe("A1");
    expect(res.body.subjects[w.english].letterGrade).toBe("A");
    expect(res.body.overallPercentage).toBe(75);
    expect(res.body.overallGrade).toBe("A");
    expect(res.body.overallStatus).toBe("PASSED");
  });

  test("missing exams -> PENDING", async () => {
    await put(t.teacherB, w.enroll2, w.math, "MID1", 100);
    const res = await result(t.admin, w.enroll2);
    expect(res.body.overallStatus).toBe("PENDING");
  });

  test("weights: 100/0/0 = 25, 0/0/100 = 50", async () => {
    await put(t.teacherB, w.enroll2, w.math, "MID2", 0);
    await put(t.teacherB, w.enroll2, w.math, "FINAL", 0);
    await fill(t.teacherA, w.enroll2, w.english, [0, 0, 100]);
    const res = await result(t.admin, w.enroll2);
    expect(res.body.subjects[w.math].percentage).toBe(25);
    expect(res.body.subjects[w.english].percentage).toBe(50);
    expect(res.body.overallPercentage).toBe(37.5);
    expect(res.body.overallStatus).toBe("FAILED");
  });

  test("grade boundaries", async () => {
    await setAll(t.teacherB, w.enroll2, w.math, 100);
    const cases = [[40, "D"], [39.99, "Fail"], [50, "C"], [49.99, "D"], [60, "B"], [70, "A"], [80, "A1"]];
    for (const [x, letter] of cases) {
      await setAll(t.teacherA, w.enroll2, w.english, x);
      const res = await result(t.admin, w.enroll2);
      expect([x, res.body.subjects[w.english].letterGrade]).toEqual([x, letter]);
    }
  });

  test("a failed subject fails the student even with a good average", async () => {
    await setAll(t.teacherA, w.enroll2, w.english, 39);
    const res = await result(t.admin, w.enroll2);
    expect(res.body.overallPercentage).toBe(69.5);
    expect(res.body.overallGrade).toBe("B");
    expect(res.body.overallStatus).toBe("FAILED");
  });
});

describe("Result access", () => {
  test("own student and parent 200, other student and parent 403", async () => {
    expect((await result(t.student1, w.enroll1)).status).toBe(200);
    expect((await result(t.parent1, w.enroll1)).status).toBe(200);
    expect((await result(t.student2, w.enroll1)).status).toBe(403);
    expect((await result(t.parent2, w.enroll1)).status).toBe(403);
  });
});