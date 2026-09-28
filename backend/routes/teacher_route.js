const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const role = require("../middleware/role");
const validate = require("../middleware/validate");
const teacherSchema = require("../schemas/teacherschema");
const {
  create_teacher,
  getone,
  getall,
  update,
  deleteteacher
} = require("../controllers/teachers");

router.post("/", auth, role("ADMIN"), validate(teacherSchema), create_teacher);
router.get("/", auth, role("ADMIN"), getall);
router.get("/:id", auth, role("ADMIN"), getone);
router.patch("/:id", auth, role("ADMIN"), validate(teacherSchema.partial()), update);
router.delete("/:id", auth, role("ADMIN"), deleteteacher);

module.exports = router;
