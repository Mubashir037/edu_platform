const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const validate = require("../middleware/validate");
const { createQuerySchema, updateStatusSchema } = require("../schemas/queryschema");
const {
  createQuery, listQueries, getQuery, updateQueryStatus, deleteQuery,
} = require("../controllers/queries");

const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,                   // 5 submissions per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many submissions, try again later" },
});

router.post("/", submitLimiter, validate(createQuerySchema), createQuery); // public
router.get("/", auth, role("ADMIN"), listQueries);
router.get("/:id", auth, role("ADMIN"), getQuery);
router.patch("/:id", auth, role("ADMIN"), validate(updateStatusSchema), updateQueryStatus);
router.delete("/:id", auth, role("ADMIN"), deleteQuery);

module.exports = router;