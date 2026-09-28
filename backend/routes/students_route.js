const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const validate = require("../middleware/validate");
const studentSchema = require("../schemas/studentschema");
const { create_student, getall, getone, update, deletestudent } = require("../controllers/students");

router.post("/", auth, role("ADMIN"), validate(studentSchema), create_student);
router.get("/", auth, role("ADMIN"), getall);
router.get("/:id", auth, role("ADMIN"), getone);
router.patch("/:id", auth, role("ADMIN"), validate(studentSchema.partial()), update);
router.delete("/:id", auth, role("ADMIN"), deletestudent);

module.exports = router;
