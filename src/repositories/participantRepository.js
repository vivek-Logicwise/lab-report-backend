const dbPool = require('../config/database');

/**
 * Participant Repository
 * Handles all database operations for participants table
 */

class ParticipantRepository {
  /**
   * Find participant by participant_code
   */
  async findByCode(participantCode) {
    try {
      const query = `
        SELECT 
          participant_id,
          participant_code,
          age,
          gender,
          ethnicity,
          created_at
        FROM participants
        WHERE participant_code = $1
      `;
      
      const result = await dbPool.query(query, [participantCode]);
      return result.rows && result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('[ParticipantRepo] Error finding participant:', error);
      throw error;
    }
  }

  /**
   * Find participant by ID
   */
  async findById(participantId) {
    try {
      const query = `
        SELECT 
          participant_id,
          participant_code,
          age,
          gender,
          ethnicity,
          created_at
        FROM participants
        WHERE participant_id = $1
      `;
      
      const result = await dbPool.query(query, [participantId]);
      return result.rows && result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('[ParticipantRepo] Error finding participant by ID:', error);
      throw error;
    }
  }

  /**
   * Create new participant
   */
  async create(participantData) {
    try {
      const query = `
        INSERT INTO participants (participant_code, age, gender, ethnicity)
        VALUES ($1, $2, $3, $4)
        RETURNING participant_id, participant_code, age, gender, ethnicity, created_at
      `;
      
      const params = [
        participantData.participant_code,
        participantData.age || null,
        participantData.gender || null,
        participantData.ethnicity || null
      ];
      
      const result = await dbPool.query(query, params);
      return result.rows && result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('[ParticipantRepo] Error creating participant:', error);
      throw error;
    }
  }

  /**
   * Update participant demographics
   */
  async update(participantId, updateData) {
    try {
      const query = `
        UPDATE participants
        SET 
          age = COALESCE($1, age),
          gender = COALESCE($2, gender),
          ethnicity = COALESCE($3, ethnicity)
        WHERE participant_id = $4
        RETURNING participant_id, participant_code, age, gender, ethnicity
      `;
      
      const params = [
        updateData.age || null,
        updateData.gender || null,
        updateData.ethnicity || null,
        participantId
      ];
      
      const result = await dbPool.query(query, params);
      return result.rows && result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('[ParticipantRepo] Error updating participant:', error);
      throw error;
    }
  }

  /**
   * Find or create participant
   * Returns existing participant or creates new one
   */
  async findOrCreate(participantData) {
    let participant = await this.findByCode(participantData.participant_code);

    if (!participant) {
      participant = await this.create(participantData);
    } else if (participantData.age || participantData.gender || participantData.ethnicity) {
      // Update demographics if provided
      participant = await this.update(participant.participant_id, participantData);
    }

    return participant;
  }
}

module.exports = new ParticipantRepository();
