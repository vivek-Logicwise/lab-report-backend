const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');

/**
 * File Upload Middleware
 * Configures Multer for PDF file uploads with validation
 * Uses memory storage for efficiency (no disk I/O)
 */

// Ensure upload directory exists (handles both local and serverless environments)
const uploadDir = config.upload.tempDir;
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (error) {
  console.warn(`[Upload] Could not create upload directory: ${error.message}. Using memory storage only.`);
}

// Configure multer storage (memory storage for streaming)
const storage = multer.memoryStorage();

// File filter to accept only PDFs
const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only PDF files are allowed.`), false);
  }
};

// Configure multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: config.upload.maxFiles
  }
});

/**
 * Middleware to handle multiple file uploads
 * Accepts up to MAX_FILES_PER_REQUEST files with field name 'files'
 */
const uploadMultiple = upload.array('files', config.upload.maxFiles);

/**
 * Error handling middleware for multer
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large',
        details: `Maximum file size is ${config.upload.maxFileSize} bytes`
      });
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files',
        details: `Maximum ${config.upload.maxFiles} files allowed per request`
      });
    }

    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  if (err) {
    // Other errors
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  next();
};

module.exports = {
  uploadMultiple,
  handleUploadError
};
