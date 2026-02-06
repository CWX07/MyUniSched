USE test1;

CREATE TABLE IF NOT EXISTS programmes (
    programme_id VARCHAR(20) PRIMARY KEY,
    programme_name VARCHAR(100) NOT NULL,
    programme_level VARCHAR(50) NOT NULL,
    programme_year INT NOT NULL
);