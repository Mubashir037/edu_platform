const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const validate = require("../middleware/validate");
const session_schema = require("../schemas/academicsessionschema");
const { create_session, get_one, get_all, update } = require("../controllers/academic_session");

router.post("/", auth, role("ADMIN"), validate(session_schema), create_session);
router.get("/", auth, role("ADMIN"), get_all);
router.get("/search", auth, role("ADMIN"), get_one);
router.patch("/:id", auth, role("ADMIN"), validate(session_schema.partial()), update);

module.exports = router;
