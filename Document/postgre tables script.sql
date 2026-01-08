CREATE TABLE participants (
    participant_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    participant_code VARCHAR(50) UNIQUE NOT NULL,
    age INT,
    gender VARCHAR(10),
    ethnicity VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vip_marker_references (
    marker_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    marker_code VARCHAR(50) NOT NULL UNIQUE,
    marker_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit VARCHAR(50) NOT NULL,

    western_min NUMERIC(10,2),
    western_max NUMERIC(10,2),
    optimal_min NUMERIC(10,2),
    optimal_max NUMERIC(10,2),
    gcc_min NUMERIC(10,2),
    gcc_max NUMERIC(10,2),

    elevated_threshold NUMERIC(10,2),
    high_threshold NUMERIC(10,2),
    critical_threshold NUMERIC(10,2),

    priority INT DEFAULT 1,
    weight NUMERIC(3,2) DEFAULT 1.0,

    description TEXT,
    lower_is_worse BOOLEAN,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE participant_biomarkers (
    biomarker_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    participant_id INT NOT NULL,
    marker_code VARCHAR(50),
    value NUMERIC(10,2),
    unit VARCHAR(50),
    upload_date DATE,
    report_id VARCHAR(100),

    CONSTRAINT fk_participant_biomarkers_participant
        FOREIGN KEY (participant_id)
        REFERENCES participants(participant_id)
);

CREATE TABLE secondary_marker_references (
    marker_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    marker_code VARCHAR(50) NOT NULL UNIQUE,
    marker_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    unit VARCHAR(50) NOT NULL,

    normal_max NUMERIC(10,2) NOT NULL,
    elevated_max NUMERIC(10,2) NOT NULL,

    description TEXT,
    lower_is_worse BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE participant_secondary_markers (
    secondary_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    participant_id INT NOT NULL,
    marker_code VARCHAR(50),
    value NUMERIC(10,2),
    unit VARCHAR(50),
    upload_date DATE,
    report_id VARCHAR(100),

    CONSTRAINT fk_participant_secondary_participant
        FOREIGN KEY (participant_id)
        REFERENCES participants(participant_id)
);

CREATE TABLE analysis_results (
    analysis_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    participant_id INT NOT NULL,
    analysis_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    vip_risk_score NUMERIC(3,1),
    biological_age NUMERIC(4,1),

    result_json TEXT,
    gemini_report TEXT,

    CONSTRAINT fk_analysis_results_participant
        FOREIGN KEY (participant_id)
        REFERENCES participants(participant_id)
);
