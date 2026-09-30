const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const validate = require("../middleware/validate");
const gradeSchema = require("../schemas/marksschema");
const { assign_grade, update_grade } = require("../controllers/grades");

router.post("/", auth, role("TEACHER"), validate(gradeSchema), assign_grade);
router.patch("/:id", auth, role("TEACHER"), validate(gradeSchema.pick({ marks: true }).strict()), update_grade);

module.exports = router;
