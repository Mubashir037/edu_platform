// Step 3: test data helper. Creates a small school through the real API, then deletes it.
const request = require("supertest");
const { app, login } = require("./helpers");
const prisma = require("../config/prisma");

const PW = "123456";
const call = (method, url, token, body) => {
  const r = request(app)[method](url);
  if (token) r.set("Authorization", "Bearer " + token);
  return body ? r.send(body) : r;
};
const must = (res, code, what) => {
  if (res.status !== code) throw new Error(`${what}: expected ${code}, got ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
};

// Creates: 2 teachers, 2 parents, 2 classes, 2 students, 2 subjects, 1 active session, 2 enrollments.
async function setupWorld() {
  const run = Date.now().toString().slice(-7);
  const roll = Number(run.slice(-5)) * 10;
  const admin = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  const w = { run, admin, emails: {} };
  const em = (k) => (w.emails[k] = `${k}${run}@test.com`);

  for (const [k, subject] of [["teacherA", "English"], ["teacherB", "Math"]]) {
    const b = must(await call("post", "/api/teachers", admin, { name: `Test ${k}`, email: em(k), password: PW, subject, qualification: "MA", joiningDate: "2024-08-01" }), 201, k);
    w[k] = b.teacher.id;
  }
  for (const k of ["parent1", "parent2"]) {
    w[k] = must(await call("post", "/api/parents", admin, { name: `Test ${k}`, email: em(k), password: PW }), 201, k).parent.id;
  }
  w.class5 = must(await call("post", "/api/classes", admin, { name: `Test Class 5 ${run}`, teacherId: w.teacherA }), 201, "class5").class.id;
  w.class6 = must(await call("post", "/api/classes", admin, { name: `Test Class 6 ${run}`, teacherId: w.teacherB }), 201, "class6").class.id;
  let i = 1;
  for (const [k, p] of [["student1", "parent1"], ["student2", "parent2"]]) {
    w[k] = must(await call("post", "/api/students", admin, { name: `Test ${k}`, email: em(k), password: PW, rollNo: roll + i++, classId: w.class5, parentId: w[p], dob: "2014-03-10", admissionDate: "2024-04-01" }), 201, k).student.id;
  }
  w.math = must(await call("post", "/api/subjects", admin, { name: "Math", classId: w.class5, teacherId: w.teacherB }), 201, "math").subject.id;
  w.english = must(await call("post", "/api/subjects", admin, { name: "English", classId: w.class5, teacherId: w.teacherA }), 201, "english").subject.id;
  w.session = must(await call("post", "/api/sessions", admin, { name: `Test 2026-27 ${run}`, startDate: "2026-08-01", enddate: "2027-05-31", isactive: true }), 201, "session").session.id;

  for (const k of ["student1", "student2"]) {
    const r = await call("post", "/api/enrollments", admin, { studentId: w[k], classId: w.class5, sessionId: w.session });
    if (r.status === 201) w["enroll" + k.slice(-1)] = r.body.enrollment.id;
    else { // student create may auto-enroll
      const e = await prisma.enrollment.findFirst({ where: { studentId: w[k], sessionId: w.session } });
      if (!e) throw new Error(`enrollment ${k}: ${r.status} ${JSON.stringify(r.body)}`);
      w["enroll" + k.slice(-1)] = e.id;
    }
  }
  // tokens, keyed like the roadmap: tokens.teacherA, tokens.student1 ...
  w.tokens = { admin };
  for (const k of Object.keys(w.emails)) w.tokens[k] = await login(w.emails[k], PW);
  return w;
}

// Deletes everything setupWorld made (plus anything created on top of it: grades, attendance, notifications).
async function cleanupWorld(w) {
  if (!w || !w.emails) return;
  const users = await prisma.user.findMany({ where: { email: { in: Object.values(w.emails) } }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  const studentIds = (await prisma.student.findMany({ where: { userId: { in: userIds } }, select: { id: true } })).map((s) => s.id);
  const enrollIds = (await prisma.enrollment.findMany({ where: { OR: [{ sessionId: w.session }, { studentId: { in: studentIds } }] }, select: { id: true } })).map((e) => e.id);
  const classIds = [w.class5, w.class6].filter(Boolean);

  await prisma.notification.deleteMany({ where: { OR: [{ recipientId: { in: userIds } }, { senderId: { in: userIds } }] } });
  await prisma.grade.deleteMany({ where: { enrollmentId: { in: enrollIds } } });
  await prisma.attendance.deleteMany({ where: { OR: [{ enroll_id: { in: enrollIds } }, { studentId: { in: studentIds } }] } });
  await prisma.enrollment.deleteMany({ where: { id: { in: enrollIds } } });
  await prisma.subject.deleteMany({ where: { classId: { in: classIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.class.deleteMany({ where: { id: { in: classIds } } });
  await prisma.teacher.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.parent.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  // sessions created by progression tests share the run suffix
  await prisma.academicsession.deleteMany({ where: { name: { contains: w.run } } });
}

module.exports = { setupWorld, cleanupWorld, call, must };