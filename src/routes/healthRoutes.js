const express = require('express');
const biomarkerController = require('../controllers/biomarkerController');

const router = express.Router();

/**
 * Health check route
 */
router.get('/health', biomarkerController.healthCheck.bind(biomarkerController));

module.exports = router;
