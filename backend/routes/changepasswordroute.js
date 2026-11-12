const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const validate = require("../middleware/validate");
const { changePasswordSchema } = require("../schemas/authschema");
const { changePassword } = require("../controllers/changepassword");

router.patch("/change-password", auth, validate(changePasswordSchema), changePassword);

module.exports = router;