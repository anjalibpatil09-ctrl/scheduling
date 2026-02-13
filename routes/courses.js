// routes/courses.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.get('/', async (req,res) => {
  const [rows] = await pool.query('SELECT * FROM courses');
  res.json(rows);
});

router.get('/:id/modules', async (req,res) => {
  const [rows] = await pool.query('SELECT * FROM modules WHERE course_id = ?', [req.params.id]);
  res.json(rows);
});

// create course / module (admin)
router.post('/', auth(['admin']), async (req,res) => {
  const { title, description } = req.body;
  const [r] = await pool.query('INSERT INTO courses (title,description) VALUES (?,?)', [title,description]);
  res.json({ id: r.insertId, title, description });
});

router.post('/:id/modules', auth(['admin']), async (req,res) => {
  const { title, description, duration_hours } = req.body;
  const [r] = await pool.query('INSERT INTO modules (course_id,title,description,duration_hours) VALUES (?,?,?,?)', [req.params.id,title,description,duration_hours || 1]);
  res.json({ id: r.insertId });
});

module.exports = router;
