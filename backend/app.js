const express=require("express");
const app=express();
const authRoutes = require("./routes/registerroute");
const login=require("./routes/loginroute");
const classRoutes = require("./routes/adminroute"); 
const teacherRoutes = require("./routes/teacher_route");
const parentRoutes = require("./routes/parents_route");
const studentRoutes = require("./routes/students_route");
const subjectRoutes = require("./routes/subjects_route");
const attendanceRoutes = require("./routes/attendance_route");
const academicSessionRoutes = require("./routes/academic_session_route");
const enrollmentRoutes = require("./routes/enrollment_route");
const gradeRoutes = require("./routes/grades_route");
const resultRoutes = require("./routes/result_route");
const progressionRoutes = require("./routes/student_progression_route");
const announcementRoutes = require("./routes/announcements_route");
const cors = require("cors");
require("dotenv").config();
app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/auth", login)
app.use("/api/classes", classRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/parents", parentRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/sessions", academicSessionRoutes);
app.use("/api/enrollments", enrollmentRoutes);
app.use("/api/grades", gradeRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/progression", progressionRoutes);
app.use("/api/announcements", announcementRoutes);
app.listen(5000,()=>{
    console.log("server is being hit");
})
