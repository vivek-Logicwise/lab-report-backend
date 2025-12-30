const express = require('express');
const biomarkerController = require('../controllers/biomarkerController');
const { uploadMultiple, handleUploadError } = require('../middlewares/uploadMiddleware');

const router = express.Router();

/**
 * Biomarker Routes
 */

// Upload and process PDF biomarker files
router.post(
  '/upload',
  uploadMultiple,
  handleUploadError,
  biomarkerController.uploadAndProcess.bind(biomarkerController)
);

// Get participant history
router.get(
  '/participant/:participantCode',
  biomarkerController.getParticipantHistory.bind(biomarkerController)
);

module.exports = router;
