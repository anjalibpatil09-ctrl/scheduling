const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

/* ----------------------------------------
    STUDENT TIMETABLE ROUTE
---------------------------------------- */
router.get("/student/:studentId", auth(["admin", "student"]), async (req, res) => {
  try {
    const studentId = req.params.studentId;
    const weekStart = req.query.week_start;

    if (!weekStart)
      return res.status(400).json({ message: "week_start required" });

    // Get student's enrolled courses
    const [courses] = await pool.query(
      "SELECT course_id FROM enrollments WHERE student_id = ?",
      [studentId]
    );

    const courseIds = courses.map(r => r.course_id);

    if (courseIds.length === 0)
      return res.json({ timetable: [] });

    // Get timetable
    const [slots] = await pool.query(
      `SELECT s.*, c.title AS course_title, m.title AS module_title, u.name AS trainer_name
       FROM schedule_slots s
       LEFT JOIN courses c ON s.course_id = c.id
       LEFT JOIN modules m ON s.module_id = m.id
       LEFT JOIN users u ON s.trainer_id = u.id
       WHERE s.week_start = ?
       AND s.course_id IN (?)
       ORDER BY FIELD(s.day,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), s.slot`,
      [weekStart, courseIds]
    );

    res.json({ timetable: slots });

  } catch (err) {
    console.error("STUDENT TIMETABLE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
