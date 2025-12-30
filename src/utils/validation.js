const Joi = require('joi');

/**
 * Validation schemas using Joi
 * Ensures data integrity before processing
 */

const uploadSchema = Joi.object({
  participant_code: Joi.string()
    .optional()
    .max(50)
    .pattern(/^[A-Za-z0-9-_]+$/)
    .allow(''),

  participant_name: Joi.string()
    .optional()
    .max(255)
    .allow(''),

  age: Joi.number()
    .optional()
    .integer()
    .min(1)
    .max(150)
    .messages({
      'number.min': 'Age must be at least 1',
      'number.max': 'Age must be less than 150'
    }),

  gender: Joi.string()
    .optional()
    .valid('Male', 'Female', 'Other')
    .allow('')
    .messages({
      'any.only': 'Gender must be Male, Female, or Other'
    }),

  ethnicity: Joi.string()
    .optional()
    .max(50)
    .allow('')
});

/**
 * Validate upload request data
 */
function validateUploadRequest(data) {
  return uploadSchema.validate(data, { abortEarly: false });
}

/**
 * Validate file upload
 */
function validateFile(file) {
  const errors = [];

  if (!file) {
    errors.push('No file provided');
    return { valid: false, errors };
  }

  // Check file type
  if (file.mimetype !== 'application/pdf') {
    errors.push(`Invalid file type: ${file.mimetype}. Only PDF files are allowed.`);
  }

  // Check file size (max 10MB by default)
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);
  if (file.size > maxSize) {
    errors.push(`File size ${file.size} exceeds maximum allowed size of ${maxSize} bytes`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate multiple files
 */
function validateFiles(files) {
  const errors = [];
  const maxFiles = parseInt(process.env.MAX_FILES_PER_REQUEST || '10', 10);

  if (!files || files.length === 0) {
    errors.push('No files provided');
    return { valid: false, errors };
  }

  if (files.length > maxFiles) {
    errors.push(`Too many files: ${files.length}. Maximum allowed is ${maxFiles}`);
  }

  // Validate each file
  files.forEach((file, index) => {
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      errors.push(`File ${index + 1} (${file.originalname}): ${fileValidation.errors.join(', ')}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateUploadRequest,
  validateFile,
  validateFiles
};
