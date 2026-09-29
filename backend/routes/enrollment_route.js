const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const role = require("../middleware/role");
const validate = require("../middleware/validate");
const enrollmentschema = require("../schemas/enrollmentschema");
const { create, get_all, get_one, update, delete_enrollment } = require("../controllers/enrollment");

router.post("/", auth, role("ADMIN"), validate(enrollmentschema), create);
router.get("/", auth, role("ADMIN"), get_all);
router.get("/:id", auth, role("ADMIN"), get_one);
router.patch("/:id", auth, role("ADMIN"), validate(enrollmentschema.pick({ classId: true }).strict()), update);
router.delete("/:id", auth, role("ADMIN"), delete_enrollment);

module.exports = router;
