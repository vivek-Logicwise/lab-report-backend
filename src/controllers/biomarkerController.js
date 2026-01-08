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

          // Use transaction for all database inserts (faster and atomic)
          const { participant, vipResults, secondaryResults, reportId } = await dbPool.transaction(async (client) => {
            // Create participant
            const participantQuery = `
              INSERT INTO participants (participant_code, age, gender, ethnicity)
              VALUES ($1, $2, $3, $4)
              RETURNING participant_id, participant_code, age, gender, ethnicity, created_at
            `;
            const participantResult = await client.query(participantQuery, [
              participantData.participant_code,
              participantData.age,
              participantData.gender,
              participantData.ethnicity
            ]);
            const participant = participantResult.rows[0];

            // Generate unique short report ID
            const reportId = `RPT-${Date.now().toString(36).toUpperCase()}`;
            const uploadDate = new Date().toISOString().split('T')[0];

            let vipResults = [];
            let secondaryResults = [];

            // Bulk insert VIP markers
            if (validation.markers.vip.length > 0) {
              const vipValues = [];
              const vipParams = [];
              let paramIndex = 1;
              
              validation.markers.vip.forEach(marker => {
                vipValues.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`);
                vipParams.push(
                  participant.participant_id,
                  marker.marker_code,
                  marker.value,
                  marker.unit,
                  uploadDate,
                  reportId
                );
                paramIndex += 6;
              });
              
              const vipQuery = `
                INSERT INTO participant_biomarkers 
                  (participant_id, marker_code, value, unit, upload_date, report_id)
                VALUES ${vipValues.join(', ')}
                RETURNING biomarker_id, marker_code, value
              `;
              
              const vipResult = await client.query(vipQuery, vipParams);
              vipResults = vipResult.rows;
            }

            // Bulk insert secondary markers
            if (validation.markers.secondary.length > 0) {
              const secValues = [];
              const secParams = [];
              let paramIndex = 1;
              
              validation.markers.secondary.forEach(marker => {
                secValues.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5})`);
                secParams.push(
                  participant.participant_id,
                  marker.marker_code,
                  marker.value,
                  marker.unit,
                  uploadDate,
                  reportId
                );
                paramIndex += 6;
              });
              
              const secQuery = `
                INSERT INTO participant_secondary_markers 
                  (participant_id, marker_code, value, unit, upload_date, report_id)
                VALUES ${secValues.join(', ')}
                RETURNING secondary_id, marker_code, value
              `;
              
              const secResult = await client.query(secQuery, secParams);
              secondaryResults = secResult.rows;
            }

            return { participant, vipResults, secondaryResults, reportId };
          });

          // Analyze markers (outside transaction for faster commits)
          const vipAnalysis = await biomarkerAnalysisService.analyzeVIPMarkers(
            validation.markers.vip,
            participant.age
          );

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
            secondaryAnalysis,
            pdfInfo.name,
            pdfInfo.gender
          );

          patientResults.push({
            ...patientResponse,
            file_name: extraction.fileName
          });

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
