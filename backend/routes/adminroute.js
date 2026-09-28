const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("..//middleware/role");
const validate = require("../middleware/validate");
const class_schema = require("../schemas/classschema");
const { createclass,
    getallclasses,
    getoneclass,
    updateclass,
    deleteclass } = require("../controllers/classes");
router.post("/", auth, role("ADMIN"), validate(class_schema), createclass);
router.get("/", auth, role("ADMIN"), getallclasses);
router.get("/:id", auth, role("ADMIN"), getoneclass);
router.put("/:id", auth, role("ADMIN"), validate(class_schema), updateclass);
router.delete("/:id", auth, role("ADMIN"), deleteclass);

module.exports = router;