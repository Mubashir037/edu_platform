const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const role = require("../middleware/role");
const { get_result } = require("../controllers/result");

router.get("/enrollment/:id", auth, role("ADMIN", "TEACHER", "STUDENT", "PARENT"), get_result);

module.exports = router;
