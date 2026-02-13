// routes/users.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// get trainers (admin only)
router.get('/trainers', auth(['admin']), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, name, email, role 
      FROM users 
      WHERE role = 'trainer'
      ORDER BY name
    `);

    // attach readable display name
    const trainers = rows.map(t => ({
      id: t.id,
      display: `${t.name} — ${t.email} (ID: ${t.id})`
    }));

    res.json(trainers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
