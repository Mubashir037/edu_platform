const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const upload = require("../middleware/upload");
const {
  uploadImage,
  listImages,
  updateImage,
  deleteImage,
  replaceImage,
} = require("../controllers/gallery");

router.get("/", listImages); // public
router.post("/", auth, role("ADMIN"), upload.single("image"), uploadImage);
router.patch("/:id", auth, role("ADMIN"), updateImage); // title/caption only
router.put("/:id/image", auth, role("ADMIN"), upload.single("image"), replaceImage);
router.delete("/:id", auth, role("ADMIN"), deleteImage);

module.exports = router;