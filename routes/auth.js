// routes/auth.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

router.post('/register', async (req,res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message:'Missing fields' });
  try {
    const hashed = await bcrypt.hash(password, 10);
    const [r] = await pool.query('INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)', [name,email,hashed, role || 'student']);
    res.json({ id: r.insertId, name, email, role: role || 'student' });
  } catch(err) {
    console.error('REGISTER ERROR:', err);
    if (err && err.code === 'ER_DUP_ENTRY') return res.status(400).json({ message: 'Email already registered' });
    res.status(500).json({ message: 'Server error while registering' });
  }
});

router.post('/login', async (req,res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT id,name,email,password,role FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Invalid credentials' });
    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
    const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    const token = jwt.sign({ id: user.id, role: user.role, name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch(err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
