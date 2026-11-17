require("dotenv").config({ path: __dirname + "/../.env" });
const request = require("supertest");
const { app } = require("../app");

const login = async (email, password) => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status}`);
  return res.body.token;
};

const get = (url, token) => {
  const r = request(app).get(url);
  return token ? r.set("Authorization", "Bearer " + token) : r;
};

const post = (url, body, token) => {
  const r = request(app).post(url).send(body);
  return token ? r.set("Authorization", "Bearer " + token) : r;
};

module.exports = { app, login, get, post };