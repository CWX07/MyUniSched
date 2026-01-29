USE test1;

CREATE TABLE IF NOT EXISTS courses (
    course_code VARCHAR(20) PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    lecturer_id VARCHAR(20) NOT NULL,
    programme_name VARCHAR(100) NOT NULL,
    course_year INT NOT NULL,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(lecturer_id)
);