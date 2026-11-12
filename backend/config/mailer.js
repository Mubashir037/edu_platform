const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

const sendMail = ({ to, subject, text }) =>
  transporter.sendMail({ from: `"School Portal" <${process.env.EMAIL_USER}>`, to, subject, text });

module.exports = { sendMail };