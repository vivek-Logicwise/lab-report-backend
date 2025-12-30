/**
 * Response Formatter Utility
 * Formats biomarker analysis results to match UI expected JSON structure
 */

class ResponseFormatter {
  /**
   * Format complete analysis response for UI
   * Matches the expected JSON structure from requirements
   * Note: Secondary markers are stored in DB but NOT returned in response
   */
  formatAnalysisResponse(participant, vipAnalysis, secondaryAnalysis) {
    return {
      participant: {
        participant_id: participant.participant_id,
        participant_code: participant.participant_code,
        chronological_age: participant.age
      },
      summary: vipAnalysis.summary,
      markers: vipAnalysis.markers,
      patterns: vipAnalysis.patterns,
      risk_assessment: vipAnalysis.risk_assessment,
      biological_age: vipAnalysis.biological_age,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Format multiple file upload response
   * Returns summary of all processed files
   */
  formatMultiFileResponse(results) {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      success: true,
      message: `Processed ${results.length} file(s): ${successful.length} successful, ${failed.length} failed`,
      files: results.map(r => ({
        fileName: r.fileName,
        success: r.success,
        error: r.error || null,
        vipMarkersExtracted: r.vipCount || 0,
        secondaryMarkersExtracted: r.secondaryCount || 0
      })),
      total_files: results.length,
      successful_files: successful.length,
      failed_files: failed.length,
      analysis: successful.length > 0 ? successful[0].analysis : null
    };
  }

  /**
   * Format error response
   */
  formatError(error, statusCode = 500) {
    return {
      success: false,
      error: error.message || 'An error occurred',
      statusCode: statusCode,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format participant name from code
   * Converts P-IND-001 to readable name
   */
  formatName(participantCode) {
    // If a name was provided separately, use it
    // Otherwise, return the code
    return participantCode;
  }

  /**
   * Format validation errors
   */
  formatValidationError(errors) {
    return {
      success: false,
      error: 'Validation failed',
      details: errors,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format success message for database operations
   */
  formatSuccessMessage(message, data = null) {
    const response = {
      success: true,
      message: message,
      timestamp: new Date().toISOString()
    };

    if (data) {
      response.data = data;
    }

    return response;
  }
}

module.exports = new ResponseFormatter();
