const express = require("express");
const router = express.Router();
const pool = require("../db");
const auth = require("../middleware/auth");

/* ---------------------------------------------------------
   TRAINER WEEKLY SCHEDULE  (KEEP FIRST)
--------------------------------------------------------- */
router.get("/trainer/:trainer_id", auth(["trainer","admin"]), async (req,res) => {
  try {
    const { trainer_id } = req.params;
    const { week_start } = req.query;

    if (!week_start)
      return res.status(400).json({ message:"week_start required" });

    const [rows] = await pool.query(
      `SELECT s.*, c.title AS course_title, m.title AS module_title, u.name AS trainer_name
       FROM schedule_slots s
       LEFT JOIN courses c ON s.course_id = c.id
       LEFT JOIN modules m ON s.module_id = m.id
       LEFT JOIN users u ON s.trainer_id = u.id
       WHERE s.trainer_id = ? AND s.week_start = ?
       ORDER BY FIELD(s.day,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), s.slot`,
      [trainer_id, week_start]
    );

    const days = {};
    rows.forEach(r => {
      if (!days[r.day]) days[r.day] = [];
      days[r.day].push(r);
    });

    res.json({ days });

  } catch (err) {
    console.error("TRAINER ROUTE ERROR:", err);
    res.status(500).json({ message:"Server error" });
  }
});


/* ---------------------------------------------------------
   CREATE WEEK (NO DUPLICATE SLOTS)
--------------------------------------------------------- */
router.post("/", auth(["admin"]), async (req, res) => {
  try {
    const { week_start } = req.body;

    if (!week_start)
      return res.status(400).json({ message: "week_start required" });

    // DELETE old slots
    await pool.query("DELETE FROM schedule_slots WHERE week_start = ?", [week_start]);

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const hours = [
      "08-09","09-10","10-11","11-12","12-13",
      "13-14","14-15","15-16","16-17"
    ];

    const values = [];
    for (const day of days) {
      for (const slot of hours) {
        values.push([week_start, day, slot]);
      }
    }

    await pool.query(
      `INSERT INTO schedule_slots (week_start, day, slot)
       VALUES ?`,
      [values]
    );

    res.json({ message: "WEEK_CREATED" });

  } catch (err) {
    console.error("CREATE WEEK ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* ---------------------------------------------------------
   GET WEEK SCHEDULE (ADMIN)
--------------------------------------------------------- */
router.get("/:week_start", auth(["admin","trainer","student"]), async (req, res) => {
  try {
    const { week_start } = req.params;

    const [rows] = await pool.query(
      `SELECT s.*, c.title AS course_title, m.title AS module_title, u.name AS trainer_name
       FROM schedule_slots s
       LEFT JOIN courses c ON s.course_id = c.id
       LEFT JOIN modules m ON s.module_id = m.id
       LEFT JOIN users u ON s.trainer_id = u.id
       WHERE s.week_start = ?
       ORDER BY FIELD(s.day,'Mon','Tue','Wed','Thu','Fri','Sat','Sun'), s.slot`,
      [week_start]
    );

    if (!rows.length) return res.json({ message: "NO_WEEK" });

    const days = {};
    rows.forEach(r => {
      if (!days[r.day]) days[r.day] = [];
      days[r.day].push(r);
    });

    res.json({ days });

  } catch (err) {
    console.error("GET WEEK ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* ---------------------------------------------------------
   UPDATE SLOT (ASSIGN COURSE/MODULE/TRAINER)
--------------------------------------------------------- */
router.put("/slot/:id", auth(["admin"]), async (req, res) => {
  try {
    const { id } = req.params;
    const { course_id, module_id, trainer_id } = req.body;

    await pool.query(
      `UPDATE schedule_slots
       SET course_id = ?, module_id = ?, trainer_id = ?
       WHERE id = ?`,
      [
        course_id || null,
        module_id || null,
        trainer_id || null,
        id
      ]
    );

    res.json({ message: "UPDATED" });

  } catch (err) {
    console.error("UPDATE SLOT ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
