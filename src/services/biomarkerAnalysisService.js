const config = require('../config');
const biomarkerRepository = require('../repositories/biomarkerRepository');

/**
 * Biomarker Analysis Service
 * Implements complete triage logic from Business Logic document:
 * - Marker categorization (NORMAL/ELEVATED/HIGH/CRITICAL)
 * - Severity scoring (0-10 scale)
 * - Pattern detection (7 health patterns)
 * - Risk assessment with category weighting
 * - Biological age calculation
 * 
 * Handles both VIP markers (27) and secondary markers (280+)
 */

class BiomarkerAnalysisService {
  constructor() {
    this.vipReferences = null;
    this.secondaryReferences = null;
  }

  /**
   * Load reference data from database
   * Cached for performance
   */
  async loadReferences() {
    if (!this.vipReferences) {
      this.vipReferences = await biomarkerRepository.getVIPMarkerReferences();
      console.log(`[Analysis] Loaded ${this.vipReferences.length} VIP marker references`);
    }

    if (!this.secondaryReferences) {
      this.secondaryReferences = await biomarkerRepository.getSecondaryMarkerReferences();
      console.log(`[Analysis] Loaded ${this.secondaryReferences.length} secondary marker references`);
    }
  }

  /**
   * Analyze VIP markers for a participant
   * Returns detailed analysis with categorization, severity, patterns, and risk
   */
  async analyzeVIPMarkers(markerValues, participantAge = null) {
    await this.loadReferences();

    const analyzedMarkers = [];

    for (const markerValue of markerValues) {
      const reference = this.vipReferences.find(r => r.marker_code === markerValue.marker_code);

      if (!reference) {
        console.warn(`[Analysis] No reference found for VIP marker: ${markerValue.marker_code}`);
        continue;
      }

      // Determine reference range to use (GCC preferred, fallback to Western)
      const referenceUsed = this.determineReferenceRange(reference);

      // Categorize marker value
      const categorization = this.categorizeVIPMarker(markerValue.value, reference);

      // Calculate severity score
      const severity = this.calculateVIPSeverity(markerValue.value, reference);

      // Format reference range string
      const referenceRange = this.formatReferenceRange(reference, referenceUsed);

      analyzedMarkers.push({
        marker_code: markerValue.marker_code,
        marker_name: reference.marker_name,
        category: reference.category,
        value: markerValue.value,
        unit: reference.unit,
        status: categorization.status,
        severity: severity,
        reference_used: referenceUsed.type,
        reference_range: referenceRange,
        is_lower_is_worse: reference.lower_is_worse || false,
        thresholds: {
          elevated_threshold: reference.elevated_threshold,
          high_threshold: reference.high_threshold,
          critical_threshold: reference.critical_threshold
        }
      });
    }

    // Calculate summary statistics
    const summary = {
      total_markers: analyzedMarkers.length,
      normal_count: analyzedMarkers.filter(m => m.status === 'NORMAL').length,
      elevated_count: analyzedMarkers.filter(m => m.status === 'ELEVATED').length,
      high_count: analyzedMarkers.filter(m => m.status === 'HIGH').length,
      critical_count: analyzedMarkers.filter(m => m.status === 'CRITICAL').length
    };

    // Detect health patterns
    const patterns = this.detectPatterns(analyzedMarkers);

    // Calculate overall risk
    const riskAssessment = this.calculateRiskAssessment(analyzedMarkers);

    // Calculate biological age
    const biologicalAge = this.calculateBiologicalAge(analyzedMarkers, participantAge);

    return {
      markers: analyzedMarkers,
      summary,
      patterns,
      risk_assessment: riskAssessment,
      biological_age: biologicalAge
    };
  }

  /**
   * Analyze secondary markers (Good/Bad/Ugly categorization)
   */
  async analyzeSecondaryMarkers(markerValues) {
    await this.loadReferences();

    const analyzedMarkers = [];

    for (const markerValue of markerValues) {
      const reference = this.secondaryReferences.find(r => r.marker_code === markerValue.marker_code);

      if (!reference) {
        console.warn(`[Analysis] No reference found for secondary marker: ${markerValue.marker_code}`);
        continue;
      }

      const categorization = this.categorizeSecondaryMarker(markerValue.value, reference);

      analyzedMarkers.push({
        marker_code: markerValue.marker_code,
        marker_name: reference.marker_name,
        category: reference.category,
        subcategory: reference.subcategory,
        value: markerValue.value,
        unit: reference.unit,
        status: categorization.category,
        color: categorization.color,
        severity: categorization.severity,
        interpretation: categorization.interpretation,
        normal_max: reference.normal_max,
        elevated_max: reference.elevated_max
      });
    }

    // Summary by category
    const summary = {
      total: analyzedMarkers.length,
      good: analyzedMarkers.filter(m => m.status === 'GOOD').length,
      bad: analyzedMarkers.filter(m => m.status === 'BAD').length,
      ugly: analyzedMarkers.filter(m => m.status === 'UGLY').length
    };

    return {
      markers: analyzedMarkers,
      summary,
      flagged_markers: analyzedMarkers.filter(m => m.status === 'BAD' || m.status === 'UGLY')
    };
  }

  /**
   * Map database category names to standard category names for weighting
   */
  mapCategory(dbCategory) {
    const categoryMap = {
      'Liver': 'Liver Function',
      'Kidney': 'Kidney Function',
      'Thyroid': 'Thyroid Function'
    };
    return categoryMap[dbCategory] || dbCategory;
  }

  /**
   * Format reference range string (e.g., "0-100" or ">40")
   */
  formatReferenceRange(reference, referenceUsed) {
    const isLowerWorse = reference.lower_is_worse || false;
    const min = referenceUsed.min;
    const max = referenceUsed.max;

    if (isLowerWorse) {
      // For "lower is worse" markers, show minimum threshold
      return `>${min}`;
    } else {
      // For "higher is worse" markers, show range
      if (min === 0 || min === null) {
        return `0-${max}`;
      }
      return `${min}-${max}`;
    }
  }

  /**
   * Determine which reference range to use (GCC preferred, Western fallback)
   */
  determineReferenceRange(reference) {
    if (reference.gcc_min !== null && reference.gcc_max !== null && reference.gcc_max > 0) {
      return {
        type: 'GCC',
        min: reference.gcc_min,
        max: reference.gcc_max
      };
    } else {
      return {
        type: 'Western',
        min: reference.western_min,
        max: reference.western_max
      };
    }
  }

  /**
   * Categorize VIP marker value (NORMAL/ELEVATED/HIGH/CRITICAL)
   * Handles both "higher is worse" and "lower is worse" markers
   */
  categorizeVIPMarker(value, reference) {
    const isLowerWorse = reference.lower_is_worse || 
                         config.analysis.lowerIsWorseMarkers.includes(reference.marker_code);

    let status;

    if (isLowerWorse) {
      // For markers where LOW values are bad (HDL, Vitamin D, etc.)
      if (value < reference.critical_threshold) {
        status = 'CRITICAL';
      } else if (value < reference.high_threshold) {
        status = 'HIGH';
      } else if (value < reference.elevated_threshold) {
        status = 'ELEVATED';
      } else {
        status = 'NORMAL';
      }
    } else {
      // For markers where HIGH values are bad (CRP, Glucose, etc.)
      if (value > reference.critical_threshold) {
        status = 'CRITICAL';
      } else if (value > reference.high_threshold) {
        status = 'HIGH';
      } else if (value > reference.elevated_threshold) {
        status = 'ELEVATED';
      } else {
        status = 'NORMAL';
      }
    }

    return { status };
  }

  /**
   * Calculate severity score (0-10 scale)
   */
  calculateVIPSeverity(value, reference) {
    const isLowerWorse = reference.lower_is_worse || 
                         config.analysis.lowerIsWorseMarkers.includes(reference.marker_code);

    if (isLowerWorse) {
      // Lower values = higher severity
      if (value >= reference.elevated_threshold) return 0; // Normal
      if (value >= reference.high_threshold) return 3;      // Slightly low
      if (value >= reference.critical_threshold) return 6;  // Significantly low
      return 9;                                             // Critically low
    } else {
      // Higher values = higher severity
      if (value <= reference.elevated_threshold) return 0; // Normal
      if (value <= reference.high_threshold) return 3;      // Slightly elevated
      if (value <= reference.critical_threshold) return 6;  // Significantly elevated
      return 9;                                             // Critically high
    }
  }

  /**
   * Categorize secondary marker (GOOD/BAD/UGLY)
   */
  categorizeSecondaryMarker(value, reference) {
    let category, color, interpretation, severity;

    if (value <= reference.normal_max) {
      category = 'GOOD';
      color = 'green';
      interpretation = 'Within normal range';
      severity = 0;
    } else if (value <= reference.elevated_max) {
      category = 'BAD';
      color = 'yellow';
      interpretation = 'Elevated - monitor closely';
      severity = 5;
    } else {
      category = 'UGLY';
      color = 'red';
      interpretation = 'High - requires attention';
      severity = 8;
    }

    return { category, color, interpretation, severity };
  }

  /**
   * Detect health patterns from VIP markers
   * Implements 7 pattern detection rules from business logic
   */
  detectPatterns(analyzedMarkers) {
    const patterns = [];
    const patternConfigs = config.analysis.patterns;

    for (const [patternName, patternConfig] of Object.entries(patternConfigs)) {
      // Filter markers relevant to this pattern
      const relevantMarkers = analyzedMarkers.filter(m =>
        patternConfig.markers.includes(m.marker_code)
      );

      // Count abnormal markers
      const abnormalMarkers = relevantMarkers.filter(m => m.status !== 'NORMAL');

      // Check if pattern threshold met (minimum 2 abnormal markers required)
      if (abnormalMarkers.length >= 2) {
        const avgSeverity = abnormalMarkers.reduce((sum, m) => sum + m.severity, 0) / abnormalMarkers.length;

        patterns.push({
          name: patternName,
          markers_affected: abnormalMarkers.map(m => m.marker_code),
          severity: avgSeverity,//Math.round(avgSeverity * 10) / 10,
          trigger_count: abnormalMarkers.length,
          description: patternConfig.description || `Multiple ${patternConfig.markers.join(', ')} markers elevated`
        });
      }
    }

    // Sort by severity descending
    patterns.sort((a, b) => b.severity - a.severity);

    return patterns;
  }

  /**
   * Calculate overall risk assessment
   * Uses category weighting from config
   */
  calculateRiskAssessment(analyzedMarkers) {
    if (analyzedMarkers.length === 0) {
      return {
        overall_risk_score: 0,
        risk_category: 'LOW',
        category_risks: {}
      };
    }

    // Group markers by category (using mapped category names)
    const categorizedMarkers = {};
    analyzedMarkers.forEach(marker => {
      const mappedCategory = this.mapCategory(marker.category);
      if (!categorizedMarkers[mappedCategory]) {
        categorizedMarkers[mappedCategory] = [];
      }
      categorizedMarkers[mappedCategory].push(marker);
    });

    // Calculate category-specific risks
    const categoryRisks = {};
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const [category, markers] of Object.entries(categorizedMarkers)) {
      const weight = config.analysis.categoryWeights[category] || 1.0;
      const avgSeverity = markers.reduce((sum, m) => sum + m.severity, 0) / markers.length;
      const abnormalCount = markers.filter(m => m.status !== 'NORMAL').length;
      const weightedScore = avgSeverity * weight;

      totalWeightedScore += weightedScore;
      totalWeight += weight;

      // Determine risk level for this category
      const categoryRiskLevel = this.getRiskCategory(avgSeverity);

      categoryRisks[category] = {
        average_severity: Math.round(avgSeverity * 100) / 100,
        weight: weight,
        weighted_score: Math.round(weightedScore * 100) / 100,
        markers_count: markers.length,
        risk_level: categoryRiskLevel
      };
    }

    // Overall risk score
    const overallRiskScore = totalWeightedScore / totalWeight;
    const riskCategory = this.getRiskCategory(overallRiskScore);

    return {
      overall_risk_score: Math.round(overallRiskScore * 100) / 100,
      risk_category: riskCategory,
      total_weighted_score: Math.round(totalWeightedScore * 100) / 100,
      total_weight: Math.round(totalWeight * 10) / 10,
      category_risks: categoryRisks
    };
  }

  /**
   * Map numeric risk score to category
   */
  getRiskCategory(score) {
    if (score < 3) return 'LOW';
    if (score < 6) return 'MODERATE';
    if (score < 8) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Calculate biological age from VIP markers
   * Formula: biologicalAge = chronologicalAge + (avgSeverity - 5) * 1.5
   */
  calculateBiologicalAge(analyzedMarkers, chronologicalAge) {
    if (!chronologicalAge || chronologicalAge <= 0 || analyzedMarkers.length === 0) {
      return {
        avg_severity: 0,
        age_delta: 0,
        biological_age: chronologicalAge || 0
      };
    }

    // Calculate average severity
    const avgSeverity = analyzedMarkers.reduce((sum, m) => sum + m.severity, 0) / analyzedMarkers.length;

    // Calculate age delta
    const ageDelta = (avgSeverity - 5) * config.analysis.biologicalAgeAdjustment;
    const biologicalAge = chronologicalAge + ageDelta;

    // Round to 2 decimals
    const bioAge = Math.round(biologicalAge * 100) / 100;
    const delta = Math.round(ageDelta * 100) / 100;
    const avgSev = Math.round(avgSeverity * 100) / 100;

    return {
      avg_severity: avgSev,
      age_delta: delta,
      biological_age: bioAge
    };
  }
}

module.exports = new BiomarkerAnalysisService();
