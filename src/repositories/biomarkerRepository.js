const dbPool = require('../config/database');

/**
 * Biomarker Repository
 * Handles VIP markers and secondary markers database operations
 * Optimized for msnodesqlv8 driver
 */

class BiomarkerRepository {
  /**
   * Execute query using mssql package
   */
  async executeQuery(query, params = []) {
    const result = await dbPool.query(query, params);
    return result.recordset || [];
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
   * Bulk insert VIP markers
   * Inserts one at a time for msnodesqlv8 compatibility
   */
  async bulkInsertVIPMarkers(participantId, markers, reportId) {
    try {
      if (markers.length === 0) return [];

      const results = [];
      const uploadDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

      for (const marker of markers) {
        const query = `
          INSERT INTO participant_biomarkers 
            (participant_id, marker_code, value, unit, upload_date, report_id)
          OUTPUT INSERTED.biomarker_id, INSERTED.marker_code, INSERTED.value
          VALUES (@param0, @param1, @param2, @param3, @param4, @param5)
        `;

        const params = [
          participantId,
          marker.marker_code,
          marker.value,
          marker.unit,
          uploadDate,
          reportId
        ];

        const result = await this.executeQuery(query, params);
        if (result && result.length > 0) {
          results.push(result[0]);
        }
      }

      console.log(`[BiomarkerRepo] Inserted ${results.length} VIP markers`);
      return results;
    } catch (error) {
      console.error('[BiomarkerRepo] Error bulk inserting VIP markers:', error);
      throw error;
    }
  }

  /**
   * Bulk insert secondary markers
   */
  async bulkInsertSecondaryMarkers(participantId, markers, reportId) {
    try {
      if (markers.length === 0) return [];

      const results = [];
      const uploadDate = new Date().toISOString().split('T')[0];

      for (const marker of markers) {
        const query = `
          INSERT INTO participant_secondary_markers 
            (participant_id, marker_code, value, unit, upload_date, report_id)
          OUTPUT INSERTED.secondary_id, INSERTED.marker_code, INSERTED.value
          VALUES (@param0, @param1, @param2, @param3, @param4, @param5)
        `;

        const params = [
          participantId,
          marker.marker_code,
          marker.value,
          marker.unit,
          uploadDate,
          reportId
        ];

        const result = await this.executeQuery(query, params);
        if (result && result.length > 0) {
          results.push(result[0]);
        }
      }

      console.log(`[BiomarkerRepo] Inserted ${results.length} secondary markers`);
      return results;
    } catch (error) {
      console.error('[BiomarkerRepo] Error bulk inserting secondary markers:', error);
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
        WHERE pb.participant_id = @param0
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
        WHERE ps.participant_id = @param0
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
        OUTPUT INSERTED.analysis_id, INSERTED.analysis_date
        VALUES (@param0, @param1, @param2, @param3, @param4)
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
