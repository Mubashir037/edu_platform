require("dotenv").config();
const bcrypt = require("bcrypt");
const prisma = require("./config/prisma");

(async () => {
  const email = process.env.ADMIN_EMAIL;
  const pass = process.env.ADMIN_PASSWORD;
  if (!email || !pass) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD in .env");
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return console.log("Admin already exists");
  await prisma.user.create({
    data: { name: "Admin", email, passwordHash: await bcrypt.hash(pass, 10), role: "ADMIN" },
  });
  console.log("Admin created");
})().finally(() => prisma.$disconnect());