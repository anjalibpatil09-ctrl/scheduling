// routes/enrollments.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth'); // your middleware

// Enroll student in a course (admin or the student themselves)
router.post('/student/:studentId/course/:courseId', auth(['admin','student']), async (req, res) => {
  try {
    const studentId = parseInt(req.params.studentId, 10);
    const courseId = parseInt(req.params.courseId, 10);

    if (!studentId || !courseId) return res.status(400).json({ message: 'studentId and courseId required' });

    // If the logged-in user is a student, ensure they can only enroll themself
    if (req.user.role === 'student' && req.user.id !== studentId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // ensure course exists
    const [[course]] = await pool.query('SELECT id FROM courses WHERE id = ?', [courseId]);
    if (!course) return res.status(404).json({ message: 'Course not found' });

    // ensure student exists
    const [[student]] = await pool.query('SELECT id FROM users WHERE id = ? AND role = "student"', [studentId]);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // avoid duplicate enrollment
    const [[exists]] = await pool.query('SELECT id FROM enrollments WHERE student_id = ? AND course_id = ?', [studentId, courseId]);
    if (exists) return res.json({ message: 'ALREADY_ENROLLED' });

    // insert
    await pool.query('INSERT INTO enrollments (student_id, course_id, enrolled_at) VALUES (?, ?, NOW())', [studentId, courseId]);

    return res.json({ message: 'ENROLLED' });
  } catch (err) {
    console.error('ENROLL ERROR:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
