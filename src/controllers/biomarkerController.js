const pdfExtractionService = require('../services/pdfExtractionService');
const biomarkerAnalysisService = require('../services/biomarkerAnalysisService');
const participantRepository = require('../repositories/participantRepository');
const biomarkerRepository = require('../repositories/biomarkerRepository');
const { validateUploadRequest, validateFiles } = require('../utils/validation');
const responseFormatter = require('../utils/responseFormatter');
const dbPool = require('../config/database');

/**
 * Biomarker Upload Controller
 * Handles PDF upload, extraction, analysis, and persistence
 * 
 * Performance features:
 * - Concurrent PDF processing
 * - Bulk inserts for efficiency
 * - Comprehensive error handling
 */

class BiomarkerController {
  /**
   * Upload and process biomarker PDF files
   * POST /api/biomarkers/upload
   * 
   * Body (multipart/form-data):
   * - files: PDF file(s) (required)
   * - participant_code: string (optional - extracted from PDF if not provided)
   * - participant_name: string (optional)
   * - age: number (optional - extracted from PDF if not provided)
   * - gender: string (optional - extracted from PDF if not provided)
   * - ethnicity: string (optional)
   */
  async uploadAndProcess(req, res) {
    try {
      console.log('[Controller] Processing biomarker upload request...');

      // Validate files
      const files = req.files;
      const filesValidation = validateFiles(files);

      if (!filesValidation.valid) {
        return res.status(400).json(
          responseFormatter.formatValidationError(filesValidation.errors)
        );
      }

      // Validate request body
      const bodyValidation = validateUploadRequest(req.body);

      if (bodyValidation.error) {
        const errors = bodyValidation.error.details.map(d => d.message);
        return res.status(400).json(
          responseFormatter.formatValidationError(errors)
        );
      }

      const { participant_code, participant_name, age, gender, ethnicity } = req.body;

      // Step 1: Process all PDFs concurrently
      console.log(`[Controller] Extracting data from ${files.length} PDF(s)...`);
      const extractionResults = await pdfExtractionService.processMultiplePDFs(files);

      // Check if any extraction succeeded
      const successfulExtractions = extractionResults.filter(r => r.success);
      if (successfulExtractions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Failed to extract data from any PDF files',
          details: extractionResults.map(r => ({ file: r.fileName, error: r.error }))
        });
      }

      // Step 2: Process each file as a separate patient
      console.log(`[Controller] Processing ${successfulExtractions.length} patient(s)...`);
      
      const patientResults = [];

      for (let i = 0; i < successfulExtractions.length; i++) {
        const extraction = successfulExtractions[i];
        const pdfInfo = extraction.participantInfo;
        
        // Generate short unique patient code
        const patientCode = `PT-${Date.now().toString(36).toUpperCase()}`;
        
        console.log(`[Controller] Processing patient ${i + 1}/${successfulExtractions.length}: ${patientCode}`);

        try {
          // Validate extracted data for this patient
          const validation = pdfExtractionService.validateMarkerData({
            vip: extraction.markers.vip,
            secondary: extraction.markers.secondary
          });

          if (!validation.valid) {
            console.warn(`[Controller] Validation warnings for ${patientCode}:`, validation.errors);
          }

          // Always create new participant for each file (no findOrCreate - always create)
          const participantData = {
            participant_code: patientCode,
            age: pdfInfo.age || (age ? parseInt(age) : null),
            gender: pdfInfo.gender || gender,
            ethnicity: ethnicity
          };

          const participant = await participantRepository.create(participantData);
          console.log(`[Controller] Created new participant ID: ${participant.participant_id}`);

          // Generate unique short report ID
          const reportId = `RPT-${Date.now().toString(36).toUpperCase()}`;

          // Bulk insert markers into database
          if (validation.markers.vip.length > 0) {
            await biomarkerRepository.bulkInsertVIPMarkers(
              participant.participant_id,
              validation.markers.vip,
              reportId
            );
            console.log(`[Controller] Inserted ${validation.markers.vip.length} VIP markers for ${patientCode}`);
          }

          if (validation.markers.secondary.length > 0) {
            await biomarkerRepository.bulkInsertSecondaryMarkers(
              participant.participant_id,
              validation.markers.secondary,
              reportId
            );
            console.log(`[Controller] Inserted ${validation.markers.secondary.length} secondary markers for ${patientCode}`);
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
          const analysisRecord = await biomarkerRepository.saveAnalysisResult(
            participant.participant_id,
            {
              vip_risk_score: vipAnalysis.risk_assessment.overall_risk_score,
              biological_age: vipAnalysis.biological_age.biological_age,
              result_json: vipAnalysis,
              gemini_report: null // Can be generated separately
            }
          );

          // Format response for this patient
          const patientResponse = responseFormatter.formatAnalysisResponse(
            participant,
            vipAnalysis,
            secondaryAnalysis
          );

          patientResults.push({
            ...patientResponse,
            file_name: extraction.fileName
          });

          console.log(`[Controller] Completed processing for patient: ${patientCode}`);

        } catch (error) {
          console.error(`[Controller] Error processing patient ${patientCode}:`, error);
          patientResults.push({
            success: false,
            participant_code: patientCode,
            file_name: extraction.fileName,
            error: error.message
          });
        }
      }

      console.log(`[Controller] All patients processed. Success: ${patientResults.filter(r => r.success).length}/${patientResults.length}`);

      // Return array of patient results
      return res.status(200).json({
        success: true,
        total_patients: patientResults.length,
        successful: patientResults.filter(r => r.success).length,
        failed: patientResults.filter(r => !r.success).length,
        patients: patientResults
      });

    } catch (error) {
      console.error('[Controller] Error processing upload:', error);

      return res.status(500).json(
        responseFormatter.formatError(error, 500)
      );
    }
  }

  /**
   * Get participant analysis history
   * GET /api/biomarkers/participant/:participantCode
   */
  async getParticipantHistory(req, res) {
    try {
      const { participantCode } = req.params;

      const participant = await participantRepository.findByCode(participantCode);

      if (!participant) {
        return res.status(404).json({
          success: false,
          error: 'Participant not found'
        });
      }

      const vipMarkers = await biomarkerRepository.getParticipantVIPMarkers(participant.participant_id);
      const secondaryMarkers = await biomarkerRepository.getParticipantSecondaryMarkers(participant.participant_id);

      return res.status(200).json({
        success: true,
        participant,
        vip_markers: vipMarkers,
        secondary_markers: secondaryMarkers
      });

    } catch (error) {
      console.error('[Controller] Error fetching participant history:', error);
      return res.status(500).json(
        responseFormatter.formatError(error, 500)
      );
    }
  }

  /**
   * Health check endpoint
   * GET /api/health
   */
  async healthCheck(req, res) {
    try {
      const dbHealth = await dbPool.healthCheck();

      return res.status(200).json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbHealth
      });
    } catch (error) {
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        error: error.message
      });
    }
  }
}

module.exports = new BiomarkerController();
