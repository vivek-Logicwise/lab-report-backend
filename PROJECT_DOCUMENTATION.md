# Burak Biomarker Backend - Complete Project Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Project Architecture](#project-architecture)
3. [Folder Structure](#folder-structure)
4. [Technology Stack](#technology-stack)
5. [Database Schema](#database-schema)
6. [Core Components Explained](#core-components-explained)
7. [PDF Extraction Process](#pdf-extraction-process)
8. [Business Logic Implementation](#business-logic-implementation)
9. [API Endpoints](#api-endpoints)
10. [Code Flow Diagram](#code-flow-diagram)

---

## 1. Project Overview

The **Burak Biomarker Backend** is a Node.js application that processes biomarker PDF reports, extracts patient health data, analyzes it against reference ranges, and provides risk assessments. It helps healthcare professionals understand patient health status through automated analysis of laboratory test results.

### Key Features:
- ✅ Upload multiple PDF reports simultaneously
- ✅ Extract patient information and biomarker values automatically
- ✅ Create separate patient records for each PDF file
- ✅ Analyze 27 VIP markers and 253+ secondary markers
- ✅ Calculate biological age and overall risk scores
- ✅ Store analysis results in MSSQL database
- ✅ RESTful API for integration with frontend applications

---

## 2. Project Architecture

The application follows a **layered architecture pattern** (also called N-tier architecture):

```
┌─────────────────────────────────────────────────────┐
│                    CLIENT (Frontend)                 │
│              (Sends PDF files via HTTP)              │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│                  CONTROLLER LAYER                    │
│        (Receives requests, orchestrates flow)        │
│            biomarkerController.js                    │
└─────────────────────┬───────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   SERVICE    │ │   SERVICE    │ │  REPOSITORY  │
│    LAYER     │ │    LAYER     │ │    LAYER     │
│              │ │              │ │              │
│ PDF Extract  │ │  Analysis    │ │  Database    │
│   Service    │ │   Service    │ │   Access     │
└──────────────┘ └──────────────┘ └──────────────┘
        │             │             │
        └─────────────┼─────────────┘
                      ▼
┌─────────────────────────────────────────────────────┐
│                DATABASE LAYER                        │
│              MSSQL Server Database                   │
│    (Stores participants, markers, analysis)          │
└─────────────────────────────────────────────────────┘
```

### Architecture Layers Explained:

1. **Controller Layer**: Handles HTTP requests and responses
2. **Service Layer**: Contains business logic and data processing
3. **Repository Layer**: Manages database operations.
4. **Database Layer**: Persistent data storage

---

## 3. Folder Structure

```
d:\Burak Backend\
│
├── src/                           # Source code directory
│   ├── server.js                  # Application entry point
│   │
│   ├── config/                    # Configuration files
│   │   ├── database.js           # Database connection setup
│   │   └── index.js              # Environment variables
│   │
│   ├── controllers/               # Request handlers
│   │   └── biomarkerController.js # Main controller for biomarker operations
│   │
│   ├── services/                  # Business logic layer
│   │   ├── pdfExtractionService.js      # PDF parsing logic
│   │   └── biomarkerAnalysisService.js  # Risk analysis logic
│   │
│   ├── repositories/              # Database access layer
│   │   ├── biomarkerRepository.js       # Biomarker data operations
│   │   └── participantRepository.js     # Patient data operations
│   │
│   ├── routes/                    # API route definitions
│   │   ├── biomarkerRoutes.js    # Biomarker endpoints
│   │   └── healthRoutes.js       # Health check endpoint
│   │
│   ├── middlewares/               # Express middlewares
│   │   ├── errorHandler.js       # Global error handling
│   │   └── uploadMiddleware.js   # File upload configuration
│   │
│   └── utils/                     # Utility functions
│       ├── responseFormatter.js  # API response formatting
│       └── validation.js         # Input validation
│
├── uploads/                       # Temporary file storage
│   └── temp/                     # Temp PDF files (auto-cleaned)
│
├── Document/                      # Documentation
│   ├── Burak table script.txt   # Database schema
│   └── Burak Traige logic.js    # Business logic reference
│
├── package.json                   # Dependencies and scripts
├── .env                          # Environment variables (not in git)
└── README.md                     # Project readme
```

---

## 4. Technology Stack

### Backend Technologies:
- **Node.js** (v14+): JavaScript runtime
- **Express.js**: Web framework for building REST APIs
- **mysql**: MSSQL database driver for Node.js
- **pdf-parse**: PDF text extraction library
- **multer**: File upload middleware
- **uuid**: Unique identifier generation

### Database:
- **Microsoft SQL Server Express**: Relational database

### Development Tools:
- **nodemon**: Auto-restart during development
- **dotenv**: Environment variable management

---

## 5. Database Schema

### Tables Overview:

```
participants  ──────┐
   │                │
   │ (1:N)          │ (1:N)
   │                │
   ▼                ▼
participant_biomarkers   analysis_results
   │                     
   │ (N:1)
   │
   ▼
vip_marker_references

participants  ──────┐
   │                │
   │ (1:N)          │ 
   │                │
   ▼                │
participant_secondary_markers
   │                
   │ (N:1)
   │
   ▼
secondary_marker_references
```

### Table Descriptions:

#### 1. **participants**
Stores patient demographic information.

```sql
CREATE TABLE participants (
    participant_id INT IDENTITY(1,1) PRIMARY KEY,  -- Auto-increment ID
    participant_code VARCHAR(50) UNIQUE NOT NULL,   -- Unique patient code
    age INT,                                        -- Patient age
    gender VARCHAR(10),                             -- Male/Female/Other
    ethnicity VARCHAR(50),                          -- Ethnic background
    created_at DATETIME DEFAULT GETDATE()          -- Timestamp
);
```

**Purpose**: Each row represents one patient. When you upload 2 PDFs, 2 records are created.

#### 2. **vip_marker_references**
Contains reference ranges for 27 VIP (Very Important Parameters) markers.

```sql
CREATE TABLE vip_marker_references (
    marker_id INT IDENTITY(1,1) PRIMARY KEY,
    marker_code VARCHAR(50) NOT NULL UNIQUE,        -- e.g., 'CRP', 'IL6'
    marker_name VARCHAR(255) NOT NULL,              -- Full name
    category VARCHAR(100) NOT NULL,                 -- e.g., 'Inflammation'
    unit VARCHAR(50) NOT NULL,                      -- e.g., 'mg/L'
    western_min DECIMAL(10,2),                      -- Western population min
    western_max DECIMAL(10,2),                      -- Western population max
    optimal_min DECIMAL(10,2),                      -- Optimal range min
    optimal_max DECIMAL(10,2),                      -- Optimal range max
    gcc_min DECIMAL(10,2),                          -- GCC population min
    gcc_max DECIMAL(10,2),                          -- GCC population max
    elevated_threshold DECIMAL(10,2),               -- Warning level
    high_threshold DECIMAL(10,2),                   -- High risk level
    critical_threshold DECIMAL(10,2),               -- Critical level
    priority INT DEFAULT 1,                         -- Analysis priority
    weight DECIMAL(3,2) DEFAULT 1.0,               -- Risk calculation weight
    lower_is_worse BIT,                            -- True if low = bad
    created_at DATETIME DEFAULT GETDATE()
);
```

**Purpose**: Defines what values are "normal" or "risky" for each biomarker.

#### 3. **participant_biomarkers**
Stores actual VIP marker values for each patient.

```sql
CREATE TABLE participant_biomarkers (
    biomarker_id INT IDENTITY(1,1) PRIMARY KEY,
    participant_id INT FOREIGN KEY REFERENCES participants(participant_id),
    marker_code VARCHAR(50),                        -- Links to reference
    value DECIMAL(10,2),                           -- Patient's value
    unit VARCHAR(50),                              -- Measurement unit
    upload_date DATE,                              -- When uploaded
    report_id VARCHAR(100)                         -- Unique report ID
);
```

**Purpose**: Stores test results for VIP markers (CRP, HBA1C, LDL, etc.)

#### 4. **secondary_marker_references**
Reference ranges for 253+ secondary markers (less critical but still monitored).

```sql
CREATE TABLE secondary_marker_references (
    marker_id INT IDENTITY(1,1) PRIMARY KEY,
    marker_code VARCHAR(50) NOT NULL UNIQUE,        -- e.g., 'SEC001'
    marker_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    unit VARCHAR(50) NOT NULL,
    normal_max DECIMAL(10,2) NOT NULL,
    elevated_max DECIMAL(10,2) NOT NULL,
    lower_is_worse BIT NOT NULL DEFAULT 0
);
```

#### 5. **participant_secondary_markers**
Stores actual secondary marker values for each patient.

```sql
CREATE TABLE participant_secondary_markers (
    secondary_id INT IDENTITY(1,1) PRIMARY KEY,
    participant_id INT FOREIGN KEY REFERENCES participants(participant_id),
    marker_code VARCHAR(50),
    value DECIMAL(10,2),
    unit VARCHAR(50),
    upload_date DATE,
    report_id VARCHAR(100)
);
```

#### 6. **analysis_results**
Stores computed analysis (risk scores, biological age).

```sql
CREATE TABLE analysis_results (
    analysis_id INT IDENTITY(1,1) PRIMARY KEY,
    participant_id INT FOREIGN KEY REFERENCES participants(participant_id),
    analysis_date DATETIME DEFAULT GETDATE(),
    vip_risk_score DECIMAL(3,1),                   -- Overall risk score
    biological_age DECIMAL(4,1),                   -- Calculated bio age
    result_json NVARCHAR(MAX),                     -- Full analysis JSON
    gemini_report NVARCHAR(MAX)                    -- AI-generated report
);
```

---

## 6. Core Components Explained

### 6.1 Server Entry Point (`src/server.js`)

```javascript
const express = require('express');
const dbPool = require('./config/database');
const biomarkerRoutes = require('./routes/biomarkerRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(express.json());                        // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// API Routes
app.use('/api/biomarkers', biomarkerRoutes);    // All biomarker endpoints
app.use('/api/health', healthRoutes);           // Health check endpoint

// Error handling
app.use(errorHandler);                          // Catch all errors

// Start server
async function startServer() {
  try {
    await dbPool.getPool();                     // Connect to database
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

**What this does**:
1. Creates an Express web server
2. Connects to the database
3. Sets up routes for handling requests
4. Starts listening on port 3000

---

### 6.2 Database Configuration (`src/config/database.js`)

```javascript
const mysql = require('mysql');

class DatabasePool {
  constructor() {
    this.pool = null;
  }

  async getPool() {
    if (!this.pool) {
      // Create connection pool for better performance
      this.pool = mysql.createPool({
        host: process.env.DB_HOST,              // Database server address
        user: process.env.DB_USER,              // Database username
        password: process.env.DB_PASSWORD,      // Database password
        database: process.env.DB_NAME,          // Database name
        connectionLimit: 10,                     // Max simultaneous connections
        waitForConnections: true,
        queueLimit: 0
      });
    }
    return this.pool;
  }
}

module.exports = new DatabasePool();
```

**Connection Pool Concept**:
- Instead of creating a new database connection for each request (slow), we create a **pool of reusable connections**
- When a request needs the database, it borrows a connection from the pool
- After the query finishes, the connection returns to the pool
- This makes the app much faster ⚡

---

### 6.3 File Upload Middleware (`src/middlewares/uploadMiddleware.js`)

```javascript
const multer = require('multer');
const path = require('path');

// Configure where and how to store uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/temp/');                  // Save to temp folder
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);                       // Give unique filename
  }
});

// File filter: only accept PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);                             // Accept file
  } else {
    cb(new Error('Only PDF files allowed'), false); // Reject file
  }
};

// Create upload middleware
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,                // Max 10MB per file
    files: 10                                   // Max 10 files at once
  }
});

module.exports = upload;
```

**How this works**:
1. User uploads PDF files through the API
2. Multer intercepts the files before they reach the controller
3. Files are validated (must be PDF, max 10MB)
4. Files are saved to `uploads/temp/` folder
5. File information is attached to `req.files` for the controller to use

---

## 7. PDF Extraction Process

### 7.1 PDF Extraction Service (`src/services/pdfExtractionService.js`)

This is the most complex part of the system. It extracts text from PDFs and parses biomarker data.

#### Step 1: Extract Raw Text from PDF

```javascript
async extractFromPDF(pdfSource) {
  try {
    let dataBuffer;
    
    // Handle both file path and buffer
    if (Buffer.isBuffer(pdfSource)) {
      dataBuffer = pdfSource;
    } else {
      dataBuffer = await fs.readFile(pdfSource);
    }

    // Use pdf-parse library to extract text
    const data = await pdfParse(dataBuffer);
    return data.text;                           // Returns raw text
  } catch (error) {
    throw new Error(`Failed to extract PDF: ${error.message}`);
  }
}
```

**What happens here**:
- The PDF is read as binary data (Buffer)
- `pdf-parse` library converts the PDF to plain text
- Text contains all the patient info and biomarker values

---

#### Step 2: Parse Patient Information

```javascript
parseBiomarkerData(text) {
  const participantInfo = {
    participant_code: null,
    name: null,
    age: null,
    gender: null
  };

  const lines = text.split('\n').map(line => line.trim());

  // Extract participant code
  // Looks for patterns like "Patient Code: P-IND-001"
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const line = lines[i];
    
    const codeMatch = line.match(/(?:Patient|Participant|Report)\s*(?:Code|ID)\s*[:\s]\s*([A-Z0-9\-]+)/i);
    if (codeMatch && !participantInfo.participant_code) {
      participantInfo.participant_code = codeMatch[1];
      console.log(`Extracted code: ${codeMatch[1]}`);
    }

    // Extract Age: "Age: 31 years"
    const ageMatch = line.match(/Age\s*[:\s]\s*(\d+)/i);
    if (ageMatch && !participantInfo.age) {
      participantInfo.age = parseInt(ageMatch[1]);
    }

    // Extract Gender: "Gender: Male"
    const genderMatch = line.match(/(?:Gender|Sex)\s*[:\s]\s*(Male|Female|Other)/i);
    if (genderMatch && !participantInfo.gender) {
      participantInfo.gender = genderMatch[1];
    }
  }

  return participantInfo;
}
```

**Regular Expression (Regex) Explained**:
- `/Age\s*[:\s]\s*(\d+)/i` means:
  - `Age` - literal text "Age"
  - `\s*` - zero or more spaces
  - `[:\s]` - either a colon `:` or space
  - `\s*` - more spaces
  - `(\d+)` - capture one or more digits (the age number)
  - `/i` - case insensitive flag

---

#### Step 3: Parse VIP Markers (27 markers)

```javascript
// Find Section A in the PDF
if (/Section\s+A[:\s]*VIP\s+Markers/i.test(line)) {
  inSectionA = true;                            // Start parsing VIP markers
}

// Known VIP marker codes
const vipCodes = ['CRP', 'IL6', 'TNFA', 'FIB', 'HBA1C', 'GLU', 
                  'INS', 'HOMAIR', 'TC', 'LDL', 'HDL', 'TG', 
                  'APOB', 'ALT', 'AST', 'GGT', 'CREAT', 'EGFR', 
                  'VITD', 'B12', 'FERR', 'TSH', 'FT3', 'FT4', 
                  'CORT', 'OMEGA3', 'ZINC'];

if (inSectionA) {
  // Check if line starts with a marker code
  let foundCode = null;
  for (const code of vipCodes) {
    if (line.startsWith(code)) {
      foundCode = code;
      break;
    }
  }

  if (foundCode) {
    // Line looks like: "CRP C-Reactive Protein 4.2 mg/L < 3.0"
    const rest = line.substring(foundCode.length);
    
    // Extract value and unit using regex
    // Pattern: number followed by unit
    const match = rest.match(/(\d+\.?\d*)\s*(%|mg\/L|pg\/mL|U\/L|ng\/dL|µg\/dL)/i);
    
    if (match) {
      const value = match[1];                   // "4.2"
      const unit = match[2];                    // "mg/L"
      
      markers.vip.push({
        marker_code: foundCode,                 // "CRP"
        marker_name: "C-Reactive Protein",
        value: parseFloat(value),               // 4.2
        unit: unit                              // "mg/L"
      });
    }
  }
}
```

**Example PDF Line**:
```
CRP C-Reactive Protein 4.2 mg/L < 3.0
```

**Parsing Process**:
1. Check if line starts with "CRP" ✓
2. Extract rest: "C-Reactive Protein 4.2 mg/L < 3.0"
3. Find pattern: number (4.2) + unit (mg/L)
4. Create marker object with code, name, value, unit

---

#### Step 4: Parse Secondary Markers (253+ markers)

```javascript
// Find Section B in the PDF
if (/Section\s+B[:\s]*Secondary\s+Markers/i.test(line)) {
  inSectionB = true;                            // Start parsing secondary
}

if (inSectionB) {
  // Line looks like: "SEC001 C-Reactive Protein 117.61 μmol/L"
  const codeMatch = line.match(/^(SEC\d+)/);    // Match SEC001, SEC002, etc.
  
  if (codeMatch) {
    const code = codeMatch[1];                  // "SEC001"
    const rest = line.substring(code.length);
    
    // Extract value and unit
    const match = rest.match(/(\d+\.?\d*)\s*(μmol\/L|mg\/dL|%)/i);
    
    if (match) {
      const value = match[1];
      const unit = match[2];
      const name = rest.substring(0, rest.indexOf(match[1])).trim();
      
      markers.secondary.push({
        marker_code: code,
        marker_name: name,
        value: parseFloat(value),
        unit: unit
      });
    }
  }
}
```

---

#### Step 5: Process Multiple PDFs Concurrently

```javascript
async processMultiplePDFs(files) {
  // Process all PDFs in parallel for speed
  const results = await Promise.all(
    files.map(async (file, index) => {
      try {
        const text = await this.extractFromPDF(file.buffer);
        const extractedData = this.parseBiomarkerData(text);

        return {
          success: true,
          fileName: file.originalname,
          participantInfo: extractedData.participantInfo,
          markers: extractedData.markers
        };
      } catch (error) {
        return {
          success: false,
          fileName: file.originalname,
          error: error.message
        };
      }
    })
  );

  return results;
}
```

**Promise.all() Explained**:
- Instead of processing PDFs one by one (slow):
  - PDF 1 → wait → PDF 2 → wait → PDF 3 (serial)
- We process all at the same time (fast):
  - PDF 1 ┐
  - PDF 2 ├─→ All process simultaneously
  - PDF 3 ┘
- `Promise.all()` waits for all to finish, then returns all results together

---

## 8. Business Logic Implementation

### 8.1 Risk Analysis Service (`src/services/biomarkerAnalysisService.js`)

This service calculates health risks based on biomarker values.

#### Step 1: Load Reference Ranges from Database

```javascript
async loadVIPReferences() {
  const pool = await dbPool.getPool();
  
  return new Promise((resolve, reject) => {
    const query = `
      SELECT marker_code, category, optimal_min, optimal_max,
             elevated_threshold, high_threshold, critical_threshold,
             priority, weight, lower_is_worse
      FROM vip_marker_references
    `;
    
    pool.query(query, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}
```

**What we get**:
```javascript
[
  {
    marker_code: 'CRP',
    category: 'Inflammation',
    optimal_min: 0,
    optimal_max: 1,
    elevated_threshold: 3.5,
    high_threshold: 10,
    critical_threshold: 20,
    priority: 1,
    weight: 1.5,
    lower_is_worse: false
  },
  // ... 26 more markers
]
```

---

#### Step 2: Determine Marker Status

```javascript
determineMarkerStatus(value, reference) {
  // Extract thresholds
  const optimal_max = reference.optimal_max;
  const elevated = reference.elevated_threshold;
  const high = reference.high_threshold;
  const critical = reference.critical_threshold;
  const lowerIsWorse = reference.lower_is_worse;

  // Check if value is in optimal range
  if (value >= reference.optimal_min && value <= optimal_max) {
    return {
      status: 'optimal',                        // Green - good
      severity: 0
    };
  }

  // Check for elevated (warning)
  if (value > optimal_max && value <= elevated) {
    return {
      status: 'elevated',                       // Yellow - watch
      severity: 1
    };
  }

  // Check for high (concerning)
  if (value > elevated && value <= high) {
    return {
      status: 'high',                           // Orange - concerning
      severity: 2
    };
  }

  // Check for critical (dangerous)
  if (value > high) {
    return {
      status: 'critical',                       // Red - dangerous
      severity: 3
    };
  }

  return { status: 'unknown', severity: 0 };
}
```

**Example**:
```javascript
// Patient's CRP = 4.2 mg/L
// Reference: optimal_max = 1, elevated = 3.5, high = 10

// 4.2 > 3.5 (elevated threshold)
// 4.2 < 10 (high threshold)
// Status = 'high', Severity = 2
```

---

#### Step 3: Calculate Risk Score

```javascript
calculateRiskScore(markers, references) {
  let totalWeightedRisk = 0;
  let totalWeight = 0;

  markers.forEach(marker => {
    const ref = references.find(r => r.marker_code === marker.marker_code);
    
    if (ref) {
      // Get status and severity
      const analysis = this.determineMarkerStatus(marker.value, ref);
      
      // Calculate weighted risk contribution
      const markerRisk = analysis.severity * ref.weight;
      
      totalWeightedRisk += markerRisk;
      totalWeight += ref.weight;
    }
  });

  // Calculate overall risk score (0-10 scale)
  const riskScore = (totalWeightedRisk / totalWeight) * 3.33;
  
  return {
    overall_risk_score: Math.min(riskScore, 10),  // Cap at 10
    interpretation: this.interpretRiskScore(riskScore)
  };
}
```

**Risk Score Calculation Example**:

```
Marker 1 (CRP): severity=2, weight=1.5 → risk = 2 × 1.5 = 3.0
Marker 2 (IL6): severity=1, weight=1.3 → risk = 1 × 1.3 = 1.3
Marker 3 (LDL): severity=2, weight=1.4 → risk = 2 × 1.4 = 2.8

Total Weighted Risk = 3.0 + 1.3 + 2.8 = 7.1
Total Weight = 1.5 + 1.3 + 1.4 = 4.2

Risk Score = (7.1 / 4.2) × 3.33 = 5.6 out of 10
```

---

#### Step 4: Calculate Biological Age

```javascript
calculateBiologicalAge(markers, chronologicalAge, references) {
  let ageModifier = 0;

  markers.forEach(marker => {
    const ref = references.find(r => r.marker_code === marker.marker_code);
    
    if (ref) {
      const analysis = this.determineMarkerStatus(marker.value, ref);
      
      // Each severity level adds years
      if (analysis.severity === 1) ageModifier += 1;       // +1 year
      else if (analysis.severity === 2) ageModifier += 3;  // +3 years
      else if (analysis.severity === 3) ageModifier += 5;  // +5 years
    }
  });

  const biologicalAge = chronologicalAge + ageModifier;

  return {
    biological_age: biologicalAge,
    chronological_age: chronologicalAge,
    age_difference: ageModifier,
    interpretation: ageModifier > 5 
      ? 'Your biological age is significantly higher than chronological age'
      : 'Your biological age is close to chronological age'
  };
}
```

**Example**:
```
Chronological Age = 31 years

Elevated markers (severity 1): 3 markers × 1 year = +3 years
High markers (severity 2): 2 markers × 3 years = +6 years
Critical markers (severity 3): 1 marker × 5 years = +5 years

Age Modifier = 3 + 6 + 5 = +14 years
Biological Age = 31 + 14 = 45 years
```

---

#### Step 5: Detect Health Patterns

```javascript
detectHealthPatterns(analyzedMarkers) {
  const patterns = [];

  // Group markers by category
  const byCategory = {};
  analyzedMarkers.forEach(marker => {
    if (!byCategory[marker.category]) {
      byCategory[marker.category] = [];
    }
    byCategory[marker.category].push(marker);
  });

  // Check each category for patterns
  Object.keys(byCategory).forEach(category => {
    const categoryMarkers = byCategory[category];
    const abnormalCount = categoryMarkers.filter(m => 
      m.status !== 'optimal'
    ).length;

    // If multiple markers in same category are abnormal
    if (abnormalCount >= 2) {
      patterns.push({
        pattern_type: 'category_cluster',
        category: category,
        description: `Multiple ${category} markers are abnormal`,
        affected_markers: categoryMarkers
          .filter(m => m.status !== 'optimal')
          .map(m => m.marker_code),
        severity: 'moderate'
      });
    }
  });

  // Check for metabolic syndrome pattern
  const metMarkers = ['GLU', 'INS', 'HOMAIR', 'TG', 'HDL'];
  const abnormalMetMarkers = analyzedMarkers
    .filter(m => metMarkers.includes(m.marker_code) && m.status !== 'optimal')
    .map(m => m.marker_code);

  if (abnormalMetMarkers.length >= 3) {
    patterns.push({
      pattern_type: 'metabolic_syndrome',
      description: 'Metabolic syndrome indicators detected',
      affected_markers: abnormalMetMarkers,
      severity: 'high',
      recommendation: 'Consult with endocrinologist'
    });
  }

  return patterns;
}
```

**Pattern Detection Logic**:
1. **Category Clustering**: If 2+ markers in same category (e.g., Inflammation) are abnormal
2. **Metabolic Syndrome**: If 3+ markers (GLU, INS, HOMAIR, TG, HDL) are abnormal
3. **Cardiovascular Risk**: If multiple heart-related markers are abnormal

---

### 8.2 Controller Orchestration (`src/controllers/biomarkerController.js`)

The controller coordinates all services together.

```javascript
async uploadAndProcess(req, res) {
  try {
    const files = req.files;                    // PDF files from multer

    // Step 1: Extract data from all PDFs
    const extractionResults = await pdfExtractionService.processMultiplePDFs(files);

    const successfulExtractions = extractionResults.filter(r => r.success);

    // Step 2: Process each file as a separate patient
    const patientResults = [];

    for (let i = 0; i < successfulExtractions.length; i++) {
      const extraction = successfulExtractions[i];
      
      // Generate unique patient code
      const timestamp = Date.now();
      const uniqueCode = uuidv4().substring(0, 8).toUpperCase();
      const patientCode = `PATIENT-${timestamp}-${uniqueCode}`;

      // Validate extracted markers
      const validation = pdfExtractionService.validateMarkerData({
        vip: extraction.markers.vip,
        secondary: extraction.markers.secondary
      });

      // Create new participant in database
      const participantData = {
        participant_code: patientCode,
        age: extraction.participantInfo.age,
        gender: extraction.participantInfo.gender,
        ethnicity: req.body.ethnicity
      };

      const participant = await participantRepository.create(participantData);
      console.log(`Created participant ID: ${participant.participant_id}`);

      // Generate unique report ID
      const reportId = `RPT-${patientCode}-${Date.now()}-${uuidv4().substring(0, 8)}`;

      // Save VIP markers to database
      if (validation.markers.vip.length > 0) {
        await biomarkerRepository.bulkInsertVIPMarkers(
          participant.participant_id,
          validation.markers.vip,
          reportId
        );
      }

      // Save secondary markers to database
      if (validation.markers.secondary.length > 0) {
        await biomarkerRepository.bulkInsertSecondaryMarkers(
          participant.participant_id,
          validation.markers.secondary,
          reportId
        );
      }

      // Analyze VIP markers
      const vipAnalysis = await biomarkerAnalysisService.analyzeVIPMarkers(
        validation.markers.vip,
        participant.age
      );

      // Analyze secondary markers
      const secondaryAnalysis = await biomarkerAnalysisService.analyzeSecondaryMarkers(
        validation.markers.secondary
      );

      // Save analysis results
      await biomarkerRepository.saveAnalysisResult(
        participant.participant_id,
        {
          vip_risk_score: vipAnalysis.risk_assessment.overall_risk_score,
          biological_age: vipAnalysis.biological_age.biological_age,
          result_json: vipAnalysis
        }
      );

      // Format response
      patientResults.push({
        success: true,
        participant_id: participant.participant_id,
        participant_code: patientCode,
        file_name: extraction.fileName,
        vip_markers_count: validation.markers.vip.length,
        secondary_markers_count: validation.markers.secondary.length,
        risk_score: vipAnalysis.risk_assessment.overall_risk_score,
        biological_age: vipAnalysis.biological_age.biological_age
      });
    }

    // Return all patient results
    return res.status(200).json({
      success: true,
      total_patients: patientResults.length,
      patients: patientResults
    });

  } catch (error) {
    console.error('Error processing upload:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
```

---

### 8.3 Repository Pattern (`src/repositories/participantRepository.js`)

Repositories handle all database operations.

```javascript
class ParticipantRepository {
  // Create new participant
  async create(participantData) {
    const pool = await dbPool.getPool();
    
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO participants (participant_code, age, gender, ethnicity)
        OUTPUT INSERTED.*
        VALUES (?, ?, ?, ?)
      `;
      
      const params = [
        participantData.participant_code,
        participantData.age || null,
        participantData.gender || null,
        participantData.ethnicity || null
      ];
      
      pool.query(query, params, (err, results) => {
        if (err) reject(err);
        else resolve(results[0]);               // Return created record
      });
    });
  }

  // Find participant by code
  async findByCode(participantCode) {
    const pool = await dbPool.getPool();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM participants
        WHERE participant_code = ?
      `;
      
      pool.query(query, [participantCode], (err, results) => {
        if (err) reject(err);
        else resolve(results && results.length > 0 ? results[0] : null);
      });
    });
  }
}

module.exports = new ParticipantRepository();
```

---

### 8.4 Biomarker Repository (`src/repositories/biomarkerRepository.js`)

```javascript
async bulkInsertVIPMarkers(participantId, markers, reportId) {
  const pool = await dbPool.getPool();
  
  // Build bulk insert query
  const values = markers.map(m => 
    `(${participantId}, '${m.marker_code}', ${m.value}, '${m.unit}', GETDATE(), '${reportId}')`
  ).join(',\n');

  const query = `
    INSERT INTO participant_biomarkers 
      (participant_id, marker_code, value, unit, upload_date, report_id)
    VALUES ${values}
  `;

  return new Promise((resolve, reject) => {
    pool.query(query, (err, results) => {
      if (err) reject(err);
      else {
        console.log(`Inserted ${markers.length} VIP markers`);
        resolve(results);
      }
    });
  });
}
```

**Bulk Insert Explained**:
- Instead of 27 separate INSERT queries (slow), we combine into 1 query (fast)
- Query looks like:
```sql
INSERT INTO participant_biomarkers VALUES
  (1, 'CRP', 4.2, 'mg/L', GETDATE(), 'RPT-001'),
  (1, 'IL6', 6.1, 'pg/mL', GETDATE(), 'RPT-001'),
  (1, 'HBA1C', 5.8, '%', GETDATE(), 'RPT-001'),
  ... 24 more rows
```
- This is **10-20x faster** than individual inserts

---

## 9. API Endpoints

### 9.1 Upload and Process PDFs

**Endpoint**: `POST /api/biomarkers/upload`

**Request**:
```
Content-Type: multipart/form-data

files: [file1.pdf, file2.pdf]
age: 31
gender: Male
ethnicity: Indian
```

**Response**:
```json
{
  "success": true,
  "total_patients": 2,
  "successful": 2,
  "failed": 0,
  "patients": [
    {
      "success": true,
      "participant_id": 1,
      "participant_code": "PATIENT-1767008240887-92F4B366",
      "file_name": "report1.pdf",
      "vip_markers_count": 27,
      "secondary_markers_count": 253,
      "risk_score": 5.6,
      "biological_age": 45
    },
    {
      "success": true,
      "participant_id": 2,
      "participant_code": "PATIENT-1767008241617-B89A93C3",
      "file_name": "report2.pdf",
      "vip_markers_count": 27,
      "secondary_markers_count": 253,
      "risk_score": 6.2,
      "biological_age": 48
    }
  ]
}
```

---

### 9.2 Get Participant History

**Endpoint**: `GET /api/biomarkers/participant/:participantCode`

**Response**:
```json
{
  "success": true,
  "participant": {
    "participant_id": 1,
    "participant_code": "PATIENT-1767008240887-92F4B366",
    "age": 31,
    "gender": "Male",
    "ethnicity": "Indian",
    "created_at": "2025-12-29T11:28:00Z"
  },
  "vip_markers": [
    {
      "marker_code": "CRP",
      "marker_name": "C-Reactive Protein",
      "value": 4.2,
      "unit": "mg/L",
      "status": "high",
      "severity": 2
    }
    // ... 26 more markers
  ],
  "secondary_markers": [
    // ... 253 markers
  ]
}
```

---

## 10. Code Flow Diagram

### Complete Request Flow:

```
1. Client uploads PDFs
   │
   ▼
2. Multer Middleware
   - Validates files (PDF, size)
   - Saves to uploads/temp/
   - Attaches to req.files
   │
   ▼
3. Controller receives request
   │
   ├─► 4. PDF Extraction Service
   │      - Extracts text from PDF
   │      - Parses patient info
   │      - Parses 27 VIP markers
   │      - Parses 253+ secondary markers
   │      - Returns structured data
   │
   ├─► 5. Participant Repository
   │      - Generate unique patient code
   │      - Create participant record
   │      - Returns participant_id
   │
   ├─► 6. Biomarker Repository
   │      - Bulk insert VIP markers (27)
   │      - Bulk insert secondary markers (253)
   │      - Link to participant_id
   │
   ├─► 7. Analysis Service
   │      - Load reference ranges
   │      - Determine marker status
   │      - Calculate risk score
   │      - Calculate biological age
   │      - Detect health patterns
   │      - Generate recommendations
   │
   ├─► 8. Save Analysis Results
   │      - Store risk score
   │      - Store biological age
   │      - Store full analysis JSON
   │
   └─► 9. Format Response
          - Compile all results
          - Return to client
```

---

## Key Changes Made (Reference Files)

### 1. `src/controllers/biomarkerController.js` (Lines 78-108)
**Change**: Modified patient creation logic to always create new patients for each file
**Before**: Used `findOrCreate()` which reused existing patients
**After**: Uses `create()` with unique codes to ensure separate patients

### 2. `src/services/pdfExtractionService.js` (Lines 145-180)
**Change**: Enhanced header detection and marker parsing
**Before**: Skipped lines containing "Code" which prevented parsing OMEGA3 and ZINC
**After**: Checks if line starts with marker code before skipping headers

### 3. `src/services/pdfExtractionService.js` (Lines 200-230)
**Change**: Improved marker value extraction regex
**Before**: Couldn't parse markers with `%` unit (HBA1C, OMEGA3)
**After**: Enhanced regex to match `%` symbol and more unit patterns

### 4. `src/services/pdfExtractionService.js` (Lines 254-285)
**Change**: Added logging for debugging
**Before**: Silent failures during parsing
**After**: Logs successful extractions and warnings for failed parses

---

## Summary

This Node.js backend application:
1. ✅ Accepts multiple PDF uploads simultaneously
2. ✅ Creates **separate patient records** for each file
3. ✅ Extracts **27 VIP markers** and **253+ secondary markers**
4. ✅ Analyzes health risks using reference ranges
5. ✅ Calculates **biological age** based on marker severities
6. ✅ Detects health patterns (metabolic syndrome, inflammation clusters)
7. ✅ Stores everything in **MSSQL database**
8. ✅ Provides **RESTful API** for frontend integration

**Key Technologies**: Node.js, Express, MSSQL, pdf-parse, multer
**Architecture**: Layered (Controller → Service → Repository → Database)
**Performance**: Concurrent PDF processing, bulk database inserts, connection pooling
