const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const role = require("../middleware/role");
const validate = require("../middleware/validate");
const parentSchema = require("../schemas/parentschema");
const {
  create_parent,
  getall,
  getone,
  update,
  deleteparent
} = require("../controllers/parents");

router.post("/", auth, role("ADMIN"), validate(parentSchema), create_parent);
router.get("/", auth, role("ADMIN"), getall);
router.get("/:id", auth, role("ADMIN"), getone);
router.patch("/:id", auth, role("ADMIN"), validate(parentSchema.partial()), update);
router.delete("/:id", auth, role("ADMIN"), deleteparent);

module.exports = router;
