// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public'))); // optional
app.use(express.static(path.join(__dirname, 'public')));

// routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/schedule', require('./routes/schedule'));
app.use('/api/enrollments', require('./routes/enrollments'));
app.use('/api/timetable', require('./routes/timetable'));

app.get('*', (req,res)=> res.sendFile(path.join(__dirname,'public','index.html')));

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log(`Server listening on http://localhost:${PORT}`));
