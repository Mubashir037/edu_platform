const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const validate = require("../middleware/validate");
const subjectSchema = require("../schemas/subjectschema");
const { create_subject, getall, getone, update, deletesubject } = require("../controllers/subjects");

router.post("/", auth, role("ADMIN"), validate(subjectSchema), create_subject);
router.get("/", auth, role("ADMIN"), getall);
router.get("/:id", auth, role("ADMIN"), getone);
router.patch("/:id", auth, role("ADMIN"), validate(subjectSchema.partial()), update);
router.delete("/:id", auth, role("ADMIN"), deletesubject);

module.exports = router;
