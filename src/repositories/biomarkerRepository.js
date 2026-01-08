const dbPool = require('../config/database');

/**
 * Biomarker Repository
 * Handles VIP markers and secondary markers database operations
 * Optimized for PostgreSQL
 */

class BiomarkerRepository {
  /**
   * Execute query using PostgreSQL
   */
  async executeQuery(query, params = []) {
    const result = await dbPool.query(query, params);
    return result.rows || [];
  }

  /**
   * Get all VIP marker references
   */
  async getVIPMarkerReferences() {
    try {
      const query = `
        SELECT 
          marker_id,
          marker_code,
          marker_name,
          category,
          unit,
          western_min,
          western_max,
          optimal_min,
          optimal_max,
          gcc_min,
          gcc_max,
          elevated_threshold,
          high_threshold,
          critical_threshold,
          priority,
          weight,
          description,
          lower_is_worse
        FROM vip_marker_references
        ORDER BY category, priority
      `;

      return await this.executeQuery(query);
    } catch (error) {
      console.error('[BiomarkerRepo] Error fetching VIP references:', error);
      throw error;
    }
  }

  /**
   * Get all secondary marker references
   */
  async getSecondaryMarkerReferences() {
    try {
      const query = `
        SELECT 
          marker_id,
          marker_code,
          marker_name,
          category,
          subcategory,
          unit,
          normal_max,
          elevated_max,
          description,
          lower_is_worse
        FROM secondary_marker_references
        ORDER BY category, marker_code
      `;

      return await this.executeQuery(query);
    } catch (error) {
      console.error('[BiomarkerRepo] Error fetching secondary references:', error);
      throw error;
    }
  }

  /**
   * Get participant's VIP marker values
   */
  async getParticipantVIPMarkers(participantId) {
    try {
      const query = `
        SELECT 
          pb.biomarker_id,
          pb.marker_code,
          pb.value,
          pb.unit,
          pb.upload_date,
          pb.report_id,
          vmr.marker_name,
          vmr.category
        FROM participant_biomarkers pb
        JOIN vip_marker_references vmr ON pb.marker_code = vmr.marker_code
        WHERE pb.participant_id = $1
        ORDER BY pb.upload_date DESC, vmr.category, vmr.priority
      `;

      return await this.executeQuery(query, [participantId]);
    } catch (error) {
      console.error('[BiomarkerRepo] Error fetching participant VIP markers:', error);
      throw error;
    }
  }

  /**
   * Get participant's secondary marker values
   */
  async getParticipantSecondaryMarkers(participantId) {
    try {
      const query = `
        SELECT 
          ps.secondary_id,
          ps.marker_code,
          ps.value,
          ps.unit,
          ps.upload_date,
          ps.report_id,
          smr.marker_name,
          smr.category,
          smr.subcategory
        FROM participant_secondary_markers ps
        JOIN secondary_marker_references smr ON ps.marker_code = smr.marker_code
        WHERE ps.participant_id = $1
        ORDER BY ps.upload_date DESC, smr.category
      `;

      return await this.executeQuery(query, [participantId]);
    } catch (error) {
      console.error('[BiomarkerRepo] Error fetching participant secondary markers:', error);
      throw error;
    }
  }

  /**
   * Save analysis results
   */
  async saveAnalysisResult(participantId, analysisData) {
    try {
      const query = `
        INSERT INTO analysis_results 
          (participant_id, vip_risk_score, biological_age, result_json, gemini_report)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING analysis_id, analysis_date
      `;

      const params = [
        participantId,
        analysisData.vip_risk_score,
        analysisData.biological_age,
        JSON.stringify(analysisData.result_json),
        analysisData.gemini_report || null
      ];

      const results = await this.executeQuery(query, params);
      return results && results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error('[BiomarkerRepo] Error saving analysis result:', error);
      throw error;
    }
  }
}

module.exports = new BiomarkerRepository();
