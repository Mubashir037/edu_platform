const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const {
  getMe, getMySubjects, getClassEnrollments, getMyEnrollments, getMyChildren,
} = require("../controllers/me");

router.use(auth);

router.get("/", getMe);
router.get("/subjects", role("TEACHER"), getMySubjects);
router.get("/classes/:classId/enrollments", role("TEACHER"), getClassEnrollments);
router.get("/enrollments", role("STUDENT"), getMyEnrollments);
router.get("/children", role("PARENT"), getMyChildren);

module.exports = router;