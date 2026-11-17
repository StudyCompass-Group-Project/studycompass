-- Enable UUID extension if preferred, or use SERIAL for IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table (Expanded with preferences, theme, and alert settings)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    current_semester_week INT DEFAULT 1,
    -- Storing preferences and settings cleanly using JSONB or explicit columns. 
    -- Explicit columns are shown here for clarity based on your feature list:
    theme_mode VARCHAR(20) DEFAULT 'light', -- 'light' or 'dark'
    theme_color VARCHAR(50) DEFAULT 'default', -- selection of color for the website
    background_photo_url TEXT, -- custom background photo
    urgent_exam_alerts BOOLEAN DEFAULT TRUE,
    deadline_alerts BOOLEAN DEFAULT TRUE,
    study_reminder_minutes INT DEFAULT 15, -- minutes before study session for reminder
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC', -- IANA name, e.g. 'America/Los_Angeles'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Courses Table (Expanded with teacher and units)
CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50), -- e.g., "COMP 482"
    semester VARCHAR(50),
    teacher_name VARCHAR(255), -- Instructor/Teacher name
    units NUMERIC(3,1) DEFAULT 3.0, -- Active units for the course
    color_code VARCHAR(7), -- e.g., "#FF5733" for calendar display
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Course Schedules Table (Handles recurring days of the week and class times)
CREATE TABLE course_schedules (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    day_of_week VARCHAR(20) NOT NULL, -- e.g., 'Monday', 'Wednesday'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL
);

-- 4. Syllabi Table (Stores uploaded syllabus files and extracted metadata)
CREATE TABLE syllabi (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    file_url TEXT, -- optional: uploaded files are analysed and discarded, not stored
    original_filename VARCHAR(255),
    parsed_metadata JSONB, -- Stores extracted schedule, grading weights, policies
    applied_at TIMESTAMP WITH TIME ZONE, -- set once the extracted data was added to the course
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Assignments Table
CREATE TABLE assignments (
    id SERIAL PRIMARY KEY,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    estimated_hours NUMERIC(4,2)
);

-- 6. Projects Table (For multi-week project breakdowns)
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Project Steps (Weekly breakdowns generated for projects)
CREATE TABLE project_steps (
    id SERIAL PRIMARY KEY,
    project_id INT REFERENCES projects(id) ON DELETE CASCADE,
    week_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE
);

-- 8. Availability / Blocked Times Table (Expanded with categories)
CREATE TABLE availability_blocks (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- e.g., "Morning Shift", "Club Meeting"
    category VARCHAR(50) NOT NULL, -- 'Work/job', 'commute', 'family/personal', or 'campus organization'
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule VARCHAR(255) -- Optional RRULE for repeating blocks
);

-- 9. Study Sessions Table (Generated study blocks and calendar events)
CREATE TABLE study_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE SET NULL,
    assignment_id INT REFERENCES assignments(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    source VARCHAR(50) DEFAULT 'auto-generated' -- e.g., 'auto-generated', 'manual', 'google-calendar'
);

-- Indexes for performance
CREATE INDEX idx_courses_user_id ON courses(user_id);
CREATE INDEX idx_course_schedules_course_id ON course_schedules(course_id);
CREATE INDEX idx_assignments_course_id ON assignments(course_id);
CREATE INDEX idx_study_sessions_user_time ON study_sessions(user_id, start_time, end_time);
CREATE INDEX idx_availability_user_time ON availability_blocks(user_id, start_time, end_time);
CREATE INDEX idx_syllabi_course_id ON syllabi(course_id);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_project_steps_project_id ON project_steps(project_id);
