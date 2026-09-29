const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const role = require("../middleware/role");
const validate = require("../middleware/validate");
const attendanceSchema = require("../schemas/attendanceschema");
const {
  markattandance,
  getattendance,
  update_attendance
} = require("../controllers/attendance");

router.post("/", auth, role("TEACHER"), validate(attendanceSchema), markattandance);

// This ID identifies the student whose totals and percentage are requested.
router.get("/student/:id", auth, role("ADMIN", "TEACHER", "STUDENT", "PARENT"), getattendance);

// This ID identifies the attendance record being corrected.
router.patch("/:id", auth, role("TEACHER"), validate(attendanceSchema.pick({ status: true })), update_attendance);

module.exports = router;
