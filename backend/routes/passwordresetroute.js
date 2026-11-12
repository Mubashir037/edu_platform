const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const validate = require("../middleware/validate");
const { forgotPasswordSchema, resetPasswordSchema } = require("../schemas/authschema");
const { forgotPassword, resetPassword } = require("../controllers/passwordreset");

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Too many requests, try again later" }
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { msg: "Too many attempts, try again later" }
});

router.post("/forgot-password", forgotLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post("/reset-password", resetLimiter, validate(resetPasswordSchema), resetPassword);

module.exports = router;