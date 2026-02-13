-- create_db.sql
CREATE DATABASE IF NOT EXISTS scheduling_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE scheduling_app;


DROP TABLE IF EXISTS bulk_uploads;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS schedule_slots;
DROP TABLE IF EXISTS modules;
DROP TABLE IF EXISTS courses;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin','student','trainer') NOT NULL DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE modules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  duration_hours INT DEFAULT 3,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE schedule_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  week_start DATE NOT NULL,
  day ENUM('Mon','Tue','Wed','Thu','Fri','Sat','Sun') NOT NULL,
  slot ENUM('8-11','11-14','14-17','17-20') NOT NULL,
  course_id INT,
  module_id INT,
  trainer_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL,
  FOREIGN KEY (trainer_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE bulk_uploads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255),
  uploaded_by INT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Seed sample users
-- hashed password for 'adminpass' (bcrypt $2b$10$... below)
INSERT INTO users (name,email,password,role) VALUES
('Admin User','admin@example.com','abcd','admin'),
('Alice Trainer','alice.trainer@example.com','x','trainer'),
('Bob Trainer','bob.trainer@example.com','x','trainer'),
('Student One','stud1@example.com','x','student'),
('Student Two','stud2@example.com','x','student');
UPDATE users 
SET password = '$2b$10$PvTvQ0F9aPaDgq7fXwsaAeYjBkwVgRJmqxZxXtSt6CIdqgghaO97u'
WHERE email = 'admin@example.com';


INSERT INTO courses (title,description) VALUES
('Full Stack Web','Full stack web development course'),
('Data Science','Data science basics');

INSERT INTO modules (course_id,title,description) VALUES
(1,'HTML & CSS','Intro to frontend'),
(1,'Node & Express','Backend basics'),
(2,'Python for Data','Python essentials'),
(2,'Intro ML','Machine learning basics');

-- sample week slots (example week)
INSERT INTO schedule_slots (week_start,day,slot) VALUES
('2025-12-08','Mon','8-11'),('2025-12-08','Mon','11-14'),('2025-12-08','Mon','14-17'),('2025-12-08','Mon','17-20'),
('2025-12-08','Tue','8-11'),('2025-12-08','Tue','11-14'),('2025-12-08','Tue','14-17'),('2025-12-08','Tue','17-20');

-- sample enrollments (student ids assumed based on insertion order)
INSERT INTO enrollments (student_id,course_id) VALUES
(4,1),(5,2);
SELECT id, email, password, role 
FROM users 
WHERE email = 'admin@example.com';
USE scheduling_app;

-- 1) If you already have schedule_slots data you want to keep, back it up:
CREATE TABLE IF NOT EXISTS schedule_slots_backup AS SELECT * FROM schedule_slots;

-- 2) Modify the column to the new enum values (08-09 ... 19-20)
DELETE FROM schedule_slots;


-- 3) Optionally remove all existing week data so you can recreate clean hourly weeks:
DELETE FROM schedule_slots; -- CAREFUL: deletes all. If you backed up above you can restore.

-- 4) (Optional) Recreate an example week (replace date with Monday you want)
INSERT INTO schedule_slots (week_start, day, slot)
SELECT '2025-12-08' AS week_start, d.day, s.slot
FROM (SELECT 'Mon' AS day UNION SELECT 'Tue' UNION SELECT 'Wed' UNION SELECT 'Thu' UNION SELECT 'Fri' UNION SELECT 'Sat' UNION SELECT 'Sun') d
CROSS JOIN (SELECT '08-09' AS slot UNION SELECT '09-10' UNION SELECT '10-11' UNION SELECT '11-12' UNION SELECT '12-13' UNION SELECT '13-14' UNION SELECT '14-15' UNION SELECT '15-16' UNION SELECT '16-17' UNION SELECT '17-18' UNION SELECT '18-19' UNION SELECT '19-20') s;
