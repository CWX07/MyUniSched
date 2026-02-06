USE test1;

CREATE TABLE IF NOT EXISTS courses (
    course_code VARCHAR(20) PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    lecturer_id VARCHAR(20) NOT NULL,
    programme_id VARCHAR(20) NOT NULL,
    FOREIGN KEY (lecturer_id) REFERENCES lecturers(lecturer_id),
    FOREIGN KEY (programme_id) REFERENCES programmes(programme_id)
);