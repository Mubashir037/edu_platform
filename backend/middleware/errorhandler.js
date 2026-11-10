const errorHandler = (err, req, res, next) => {
  console.error(err);
  if (err.code === "P2002") return res.status(409).json({ success: false, message: "Already exists" });
  if (err.code === "P2025") return res.status(404).json({ success: false, message: "Record not found" });
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Server error" : err.message,
  });
};
module.exports = errorHandler;