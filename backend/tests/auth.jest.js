require("dotenv").config({ path: __dirname + "/../.env" });
const request = require("supertest");
const { app } = require("../app");

describe("Auth", () => {
  test("register without a token is blocked", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Hacker", email: "h@x.com", password: "123456", role: "ADMIN" });
    expect(res.status).toBe(401);
  });

  test("login with a wrong password fails", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: process.env.ADMIN_EMAIL, password: "wrongpass" });
    expect(res.status).toBe(401);
  });

  test("admin login returns a token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test("unknown route returns 404 JSON", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
  });
});