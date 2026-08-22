const express=require("express");
const authRoutes = require("./routes/register");
app.use("/api/auth", authRoutes);