const { login, get, post } = require("./helpers");

let admin, teacherA, student1, parent1;

beforeAll(async () => {
  admin = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  teacherA = await login("teachera@test.com", "123456");
  student1 = await login("student1@test.com", "123456");
  parent1 = await login("parent1@test.com", "123456");
});

describe("Role access", () => {
  test("no token on a protected route is 401", async () => {
    expect((await get("/api/students")).status).toBe(401);
  });

  test("teacher cannot create a teacher", async () => {
    const res = await post("/api/teachers", {}, teacherA);
    expect(res.status).toBe(403);
  });

  test("teacher cannot register users", async () => {
    const res = await post("/api/auth/register", {}, teacherA);
    expect(res.status).toBe(403);
  });

  test("student cannot list students", async () => {
    expect((await get("/api/students", student1)).status).toBe(403);
  });

  test("admin can list students, with paging fields", async () => {
    const res = await get("/api/students?page=1&limit=1", admin);
    expect(res.status).toBe(200);
    expect(res.body.all_students.length).toBe(1);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.pages).toBeDefined();
  });
});

describe("/api/me", () => {
  test("student sees STUDENT role", async () => {
    const res = await get("/api/me", student1);
    expect(res.status).toBe(200);
    expect(res.body.role).toBe("STUDENT");
  });

  test("student cannot use teacher lookup", async () => {
    expect((await get("/api/me/subjects", student1)).status).toBe(403);
  });

  test("parent sees only their own child", async () => {
    const res = await get("/api/me/children", parent1);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});