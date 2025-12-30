
============================================================================
// BURAK PRECISION HEALTH PLATFORM - COMPLETE LOGICAL CONTAINER
// ============================================================================
// VERSION: 2.0.0
// AUTHOR: Dr. Waseem
// PURPOSE: Complete biomarker analysis engine (27 VIP + 253 Secondary)
// 
// FEATURES:
//   - 27 VIP markers: Full analysis (patterns, risk, biological age)
//   - 253 Secondary markers: Good/Bad/Ugly categorization
//   - Combined output for Gemini AI report generation
//
// USAGE:
//   const analyzer = require('./burak-analyzer-complete');
//   const result = await analyzer.analyzeParticipant(participantId);
//
// DEPENDENCIES:
//   npm install pg
//
// DATABASE REQUIRED:
//   - vip_marker_references (27 VIP markers)
//   - secondary_marker_references (253 secondary markers)
//   - participant_biomarkers (all participant data)
//   - participants (demographic info)
// ============================================================================

const { Pool } = require('pg');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Database connection
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'burak_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your_password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },

  // Category weights for VIP marker risk scoring
  categoryWeights: {
    'Inflammation': 1.5,
    'Metabolism': 1.5,
    'Cardiovascular': 1.3,
    'Liver': 1.2,
    'Kidney': 1.2,
    'Hormones': 1.2,
    'Vitamins/Minerals': 1.0,
    'Gut Health': 1.0
  },

  // VIP markers where LOWER values are WORSE
  lowerIsWorseMarkers: [
    'HDL', 'VITAMIN_D', 'VITAMIN_B12', 'OMEGA3_INDEX', 
    'FREE_T3', 'TESTOSTERONE', 'SHANNON_INDEX'
  ],

  // Biological age adjustment factor
  biologicalAgeAdjustment: 1.5,

  // Pattern detection rules for VIP markers
  patterns: {
    'Chronic Inflammation': {
      markers: ['CRP', 'IL6', 'TNF_ALPHA', 'FIBRINOGEN', 'HOMOCYSTEINE'],
      minAbnormal: 2
    },
    'Metabolic Syndrome': {
      markers: ['GLUCOSE_FASTING', 'HBA1C', 'INSULIN', 'TRIGLYCERIDES', 'HDL'],
      minAbnormal: 3
    },
    'Insulin Resistance': {
      markers: ['INSULIN', 'HOMA_IR', 'GLUCOSE_FASTING'],
      minAbnormal: 1
    },
    'Cardiovascular Risk': {
      markers: ['LDL', 'TRIGLYCERIDES', 'APOB', 'CRP'],
      minAbnormal: 2
    },
    'Liver Stress': {
      markers: ['ALT', 'GGT'],
      minAbnormal: 1
    },
    'Vitamin Deficiency': {
      markers: ['VITAMIN_D', 'VITAMIN_B12', 'FERRITIN'],
      minAbnormal: 1
    },
    'Thyroid Dysfunction': {
      markers: ['TSH', 'FREE_T3'],
      minAbnormal: 1
    }
  }
};

// Create database connection pool
const pool = new Pool(CONFIG.database);

// ============================================================================
// DATABASE QUERIES - VIP MARKERS
// ============================================================================

/**
 * Get participant's VIP marker values (27 markers)
 */
async function getParticipantVIPData(participantId) {
  const query = `
    SELECT 
      pb.marker_code,
      pb.value,
      pb.unit,
      pb.upload_date,
      pb.report_id
    FROM participant_biomarkers pb
    JOIN vip_marker_references vmr 
      ON pb.marker_code = vmr.marker_code
    WHERE pb.participant_id = $1
    ORDER BY vmr.category, vmr.priority
  `;
  
  const result = await pool.query(query, [participantId]);
  return result.rows;
}

/**
 * Get VIP marker references (27 markers with thresholds)
 */
async function getVipMarkerReferences() {
  const query = `
    SELECT 
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
      description
    FROM vip_marker_references
    ORDER BY category, priority
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

// ============================================================================
// DATABASE QUERIES - SECONDARY MARKERS
// ============================================================================

/**
 * Get participant's secondary marker values (253 markers)
 */
async function getParticipantSecondaryData(participantId) {
  const query = `
    SELECT 
      pb.marker_code,
      pb.value,
      pb.unit,
      pb.upload_date
    FROM participant_biomarkers pb
    JOIN secondary_marker_references smr 
      ON pb.marker_code = smr.marker_code
    WHERE pb.participant_id = $1
    ORDER BY smr.category, pb.marker_code
  `;
  
  const result = await pool.query(query, [participantId]);
  return result.rows;
}

/**
 * Get secondary marker references (253 markers)
 */
async function getSecondaryMarkerReferences() {
  const query = `
    SELECT 
      marker_code,
      marker_name,
      category,
      unit,
      normal_max,
      elevated_max,
      description
    FROM secondary_marker_references
    ORDER BY category, marker_code
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

// ============================================================================
// DATABASE QUERIES - PARTICIPANT INFO
// ============================================================================

/**
 * Get participant demographic information
 */
async function getParticipantInfo(participantId) {
  const query = `
    SELECT 
      participant_id,
      age,
      gender,
      ethnicity,
      created_at
    FROM participants
    WHERE participant_id = $1
  `;
  
  const result = await pool.query(query, [participantId]);
  return result.rows[0] || null;
}

// ============================================================================
// VIP MARKER ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Determine if a VIP marker is "lower is worse" type
 */
function isLowerIsWorse(markerCode) {
  return CONFIG.lowerIsWorseMarkers.includes(markerCode);
}

/**
 * Categorize VIP marker value
 */
function categorizeVIPMarker(value, ref) {
  const isLowerWorse = isLowerIsWorse(ref.marker_code);
  
  let status;
  let interpretation;

  if (isLowerWorse) {
    // For markers where LOW is bad (HDL, Vitamin D, etc.)
    if (value < ref.critical_threshold) {
      status = 'CRITICAL';
      interpretation = 'Critically low - immediate attention needed';
    } else if (value < ref.high_threshold) {
      status = 'HIGH';
      interpretation = 'Very low - medical consultation recommended';
    } else if (value < ref.elevated_threshold) {
      status = 'ELEVATED';
      interpretation = 'Below optimal - consider improvement';
    } else {
      status = 'NORMAL';
      interpretation = 'Within optimal range';
    }
  } else {
    // For markers where HIGH is bad (CRP, Glucose, etc.)
    if (value > ref.critical_threshold) {
      status = 'CRITICAL';
      interpretation = 'Critically high - immediate attention needed';
    } else if (value > ref.high_threshold) {
      status = 'HIGH';
      interpretation = 'Very high - medical consultation recommended';
    } else if (value > ref.elevated_threshold) {
      status = 'ELEVATED';
      interpretation = 'Above optimal - monitoring recommended';
    } else {
      status = 'NORMAL';
      interpretation = 'Within optimal range';
    }
  }

  return { status, interpretation };
}

/**
 * Calculate severity score for VIP marker (0-10 scale)
 */
function calculateVIPSeverity(value, ref) {
  const isLowerWorse = isLowerIsWorse(ref.marker_code);

  if (isLowerWorse) {
    // Lower values = higher severity
    if (value >= ref.elevated_threshold) return 0; // Normal
    if (value >= ref.high_threshold) return 3;      // Slightly low
    if (value >= ref.critical_threshold) return 6;  // Significantly low
    return 9;                                       // Critically low
  } else {
    // Higher values = higher severity
    if (value <= ref.elevated_threshold) return 0; // Normal
    if (value <= ref.high_threshold) return 3;      // Slightly elevated
    if (value <= ref.critical_threshold) return 6;  // Significantly elevated
    return 9;                                       // Critically high
  }
}

// ============================================================================
// SECONDARY MARKER ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Categorize secondary marker (Good/Bad/Ugly)
 */
function categorizeSecondaryMarker(value, ref) {
  let category;
  let color;
  let interpretation;
  let severity;

  if (value <= ref.normal_max) {
    category = 'GOOD';
    color = 'green';
    interpretation = 'Within normal range';
    severity = 0;
  } else if (value <= ref.elevated_max) {
    category = 'BAD';
    color = 'yellow';
    interpretation = 'Elevated - monitor';
    severity = 5;
  } else {
    category = 'UGLY';
    color = 'red';
    interpretation = 'High - needs attention';
    severity = 8;
  }

  return { category, color, interpretation, severity };
}

/**
 * Analyze all secondary markers for a participant
 */
async function analyzeSecondaryMarkers(participantId) {
  // Get participant's secondary marker data
  const participantData = await getParticipantSecondaryData(participantId);
  
  // Get reference ranges
  const references = await getSecondaryMarkerReferences();
  
  // Analyze each marker
  const results = [];
  
  for (const marker of participantData) {
    const ref = references.find(r => r.marker_code === marker.marker_code);
    
    if (!ref) {
      console.warn(`[Warning] No reference found for secondary marker: ${marker.marker_code}`);
      continue;
    }
    
    const categorization = categorizeSecondaryMarker(marker.value, ref);
    
    results.push({
      marker_code: marker.marker_code,
      marker_name: ref.marker_name,
      category: ref.category,
      value: marker.value,
      unit: marker.unit,
      status: categorization.category,
      color: categorization.color,
      interpretation: categorization.interpretation,
      severity: categorization.severity,
      normal_max: ref.normal_max,
      elevated_max: ref.elevated_max,
      description: ref.description,
      upload_date: marker.upload_date
    });
  }
  
  // Group by category for better organization
  const byCategory = {};
  results.forEach(marker => {
    if (!byCategory[marker.category]) {
      byCategory[marker.category] = {
        total: 0,
        good: 0,
        bad: 0,
        ugly: 0,
        markers: []
      };
    }
    byCategory[marker.category].total++;
    byCategory[marker.category][marker.status.toLowerCase()]++;
    byCategory[marker.category].markers.push(marker);
  });
  
  // Overall summary
  const summary = {
    total: results.length,
    good: results.filter(m => m.status === 'GOOD').length,
    bad: results.filter(m => m.status === 'BAD').length,
    ugly: results.filter(m => m.status === 'UGLY').length,
    by_category: byCategory
  };
  
  // Get only BAD and UGLY markers for highlighting
  const flaggedMarkers = results.filter(m => m.status === 'BAD' || m.status === 'UGLY');
  
  return {
    all_markers: results,
    flagged_markers: flaggedMarkers,
    summary: summary
  };
}

// ============================================================================
// PATTERN DETECTION (VIP MARKERS ONLY)
// ============================================================================

/**
 * Detect health patterns from VIP marker results
 */
function detectPatterns(vipMarkerResults) {
  const patterns = [];

  for (const [patternName, patternConfig] of Object.entries(CONFIG.patterns)) {
    // Filter VIP markers relevant to this pattern
    const relevantMarkers = vipMarkerResults.filter(m => 
      patternConfig.markers.includes(m.marker_code)
    );

    // Count how many are abnormal
    const abnormalMarkers = relevantMarkers.filter(m => 
      m.status !== 'NORMAL'
    );

    // Check if pattern is detected
    if (abnormalMarkers.length >= patternConfig.minAbnormal) {
      // Calculate pattern severity (average of involved markers)
      const avgSeverity = abnormalMarkers.reduce((sum, m) => sum + m.severity, 0) / abnormalMarkers.length;
      
      patterns.push({
        name: patternName,
        severity: Math.round(avgSeverity * 10) / 10,
        markers_affected: abnormalMarkers.map(m => m.marker_code),
        marker_count: abnormalMarkers.length,
        description: getPatternDescription(patternName)
      });
    }
  }

  // Sort by severity (highest first)
  patterns.sort((a, b) => b.severity - a.severity);

  return patterns;
}

/**
 * Get human-readable pattern description
 */
function getPatternDescription(patternName) {
  const descriptions = {
    'Chronic Inflammation': 'Multiple inflammation markers are elevated, suggesting ongoing immune system activation',
    'Metabolic Syndrome': 'Multiple metabolic markers are abnormal, indicating increased risk of diabetes and heart disease',
    'Insulin Resistance': 'Your body is not responding efficiently to insulin',
    'Cardiovascular Risk': 'Multiple heart health markers are elevated, suggesting increased cardiovascular risk',
    'Liver Stress': 'Liver enzymes are elevated, indicating liver is under stress',
    'Vitamin Deficiency': 'One or more essential vitamins are below optimal levels',
    'Thyroid Dysfunction': 'Thyroid hormone levels are outside optimal range'
  };

  return descriptions[patternName] || 'Pattern detected';
}

// ============================================================================
// RISK SCORING (VIP MARKERS ONLY)
// ============================================================================

/**
 * Calculate overall risk score (0-10 scale, weighted by category)
 */
function calculateOverallRisk(vipMarkerResults) {
  if (vipMarkerResults.length === 0) return 0;

  // Group VIP markers by category
  const categorizedMarkers = {};
  
  vipMarkerResults.forEach(marker => {
    if (!categorizedMarkers[marker.category]) {
      categorizedMarkers[marker.category] = [];
    }
    categorizedMarkers[marker.category].push(marker);
  });

  // Calculate weighted score
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const [category, markers] of Object.entries(categorizedMarkers)) {
    const weight = CONFIG.categoryWeights[category] || 1.0;
    const categorySeverity = markers.reduce((sum, m) => sum + m.severity, 0) / markers.length;
    
    totalWeightedScore += categorySeverity * weight;
    totalWeight += weight;
  }

  const riskScore = totalWeightedScore / totalWeight;
  return Math.round(riskScore * 10) / 10;
}

/**
 * Get risk category from numeric score
 */
function getRiskCategory(riskScore) {
  if (riskScore < 3) return 'LOW';
  if (riskScore < 6) return 'MODERATE';
  if (riskScore < 8) return 'HIGH';
  return 'CRITICAL';
}

/**
 * Calculate category-specific risk scores
 */
function calculateCategoryRisks(vipMarkerResults) {
  const categoryRisks = {};

  // Group by category
  const categorizedMarkers = {};
  vipMarkerResults.forEach(marker => {
    if (!categorizedMarkers[marker.category]) {
      categorizedMarkers[marker.category] = [];
    }
    categorizedMarkers[marker.category].push(marker);
  });

  // Calculate risk for each category
  for (const [category, markers] of Object.entries(categorizedMarkers)) {
    const avgSeverity = markers.reduce((sum, m) => sum + m.severity, 0) / markers.length;
    
    categoryRisks[category] = {
      score: Math.round(avgSeverity * 10) / 10,
      category: getRiskCategory(avgSeverity),
      markers_count: markers.length,
      abnormal_count: markers.filter(m => m.status !== 'NORMAL').length,
      weight: CONFIG.categoryWeights[category] || 1.0
    };
  }

  return categoryRisks;
}

// ============================================================================
// BIOLOGICAL AGE CALCULATION (VIP MARKERS ONLY)
// ============================================================================

/**
 * Calculate biological age from VIP markers
 */
function calculateBiologicalAge(vipMarkerResults, chronologicalAge) {
  if (!chronologicalAge || chronologicalAge <= 0) {
    return {
      biological_age: null,
      chronological_age: null,
      age_delta: null,
      interpretation: 'Age not provided',
      average_severity: null
    };
  }

  // Calculate average severity across all VIP markers
  const avgSeverity = vipMarkerResults.reduce((sum, m) => sum + m.severity, 0) / vipMarkerResults.length;

  // Calculate age delta
  const ageDelta = (avgSeverity - 5) * CONFIG.biologicalAgeAdjustment;
  const biologicalAge = chronologicalAge + ageDelta;

  // Round to 1 decimal
  const bioAge = Math.round(biologicalAge * 10) / 10;
  const delta = Math.round(ageDelta * 10) / 10;

  // Interpretation
  let interpretation;
  if (Math.abs(delta) < 2) {
    interpretation = 'Your biological age matches your chronological age';
  } else if (delta > 0) {
    interpretation = `Your body is aging ${Math.abs(delta)} years faster than your actual age`;
  } else {
    interpretation = `Your body is aging ${Math.abs(delta)} years slower than your actual age`;
  }

  return {
    biological_age: bioAge,
    chronological_age: chronologicalAge,
    age_delta: delta,
    interpretation: interpretation,
    average_severity: Math.round(avgSeverity * 10) / 10
  };
}

/**
 * Get VIP markers most affecting biological age
 */
function getAgingMarkers(vipMarkerResults) {
  // Key markers that impact aging
  const agingMarkerCodes = [
    'CRP', 'IL6', 'GLUCOSE_FASTING', 'HBA1C', 'TRIGLYCERIDES',
    'LDL', 'HDL', 'VITAMIN_D', 'TESTOSTERONE', 'CORTISOL'
  ];

  return vipMarkerResults
    .filter(m => agingMarkerCodes.includes(m.marker_code))
    .filter(m => m.status !== 'NORMAL')
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 5) // Top 5 markers affecting aging
    .map(m => ({
      marker_code: m.marker_code,
      marker_name: m.marker_name,
      value: m.value,
      severity: m.severity,
      status: m.status
    }));
}

// ============================================================================
// MAIN ANALYSIS FUNCTION (COMBINED VIP + SECONDARY)
// ============================================================================

/**
 * Complete analysis of participant biomarkers (27 VIP + 253 Secondary)
 * 
 * @param {number} participantId - ID of participant to analyze
 * @returns {Promise<Object>} - Complete analysis results
 */
async function analyzeParticipant(participantId) {
  const startTime = Date.now();

  try {
    console.log(`[Burak Analyzer] Starting complete analysis for participant ${participantId}...`);

    // ========================================================================
    // STEP 1: Get participant info
    // ========================================================================
    console.log('[1/9] Fetching participant info...');
    const participantInfo = await getParticipantInfo(participantId);

    // ========================================================================
    // STEP 2: Analyze VIP markers (27 markers - Full analysis)
    // ========================================================================
    console.log('[2/9] Fetching VIP marker data...');
    const vipParticipantData = await getParticipantVIPData(participantId);
    
    if (vipParticipantData.length === 0) {
      throw new Error(`No VIP marker data found for participant ${participantId}`);
    }

    console.log('[3/9] Fetching VIP marker references...');
    const vipReferences = await getVipMarkerReferences();
    
    console.log('[4/9] Analyzing VIP markers...');
    const vipResults = [];

    for (const marker of vipParticipantData) {
      const ref = vipReferences.find(r => r.marker_code === marker.marker_code);
      
      if (!ref) {
        console.warn(`[Warning] No reference found for VIP marker: ${marker.marker_code}`);
        continue;
      }

      // Determine which range to use (GCC if available, otherwise Western)
      const useGCC = ref.gcc_max !== null && ref.gcc_max > 0;

      // Categorize marker
      const categorization = categorizeVIPMarker(marker.value, ref);

      // Calculate severity score
      const severity = calculateVIPSeverity(marker.value, ref);

      vipResults.push({
        marker_code: marker.marker_code,
        marker_name: ref.marker_name,
        category: ref.category,
        value: marker.value,
        unit: marker.unit,
        status: categorization.status,
        interpretation: categorization.interpretation,
        severity: severity,
        optimal_min: ref.optimal_min,
        optimal_max: ref.optimal_max,
        elevated_threshold: ref.elevated_threshold,
        high_threshold: ref.high_threshold,
        critical_threshold: ref.critical_threshold,
        reference_used: useGCC ? 'GCC' : 'Western',
        priority: ref.priority,
        weight: ref.weight,
        description: ref.description,
        upload_date: marker.upload_date
      });
    }

    console.log('[5/9] Detecting health patterns...');
    const patterns = detectPatterns(vipResults);

    console.log('[6/9] Calculating risk scores...');
    const overallRisk = calculateOverallRisk(vipResults);
    const riskCategory = getRiskCategory(overallRisk);
    const categoryRisks = calculateCategoryRisks(vipResults);

    console.log('[7/9] Calculating biological age...');
    const biologicalAgeData = calculateBiologicalAge(
      vipResults,
      participantInfo?.age || null
    );
    const agingMarkers = getAgingMarkers(vipResults);

    // ========================================================================
    // STEP 3: Analyze Secondary markers (253 markers - Good/Bad/Ugly)
    // ========================================================================
    console.log('[8/9] Analyzing secondary markers...');
    const secondaryResults = await analyzeSecondaryMarkers(participantId);

    // ========================================================================
    // STEP 4: Compile complete results
    // ========================================================================
    console.log('[9/9] Compiling final results...');
    const processingTime = Date.now() - startTime;

    const result = {
      // Participant identification
      participant_id: participantId,
      participant_info: participantInfo,
      analysis_date: new Date().toISOString(),
      
      // ====================================================================
      // VIP MARKERS (27 markers - Full precision analysis)
      // ====================================================================
      vip_markers: {
        markers: vipResults,
        
        summary: {
          total_markers: vipResults.length,
          expected_markers: 27,
          normal_count: vipResults.filter(m => m.status === 'NORMAL').length,
          elevated_count: vipResults.filter(m => m.status === 'ELEVATED').length,
          high_count: vipResults.filter(m => m.status === 'HIGH').length,
          critical_count: vipResults.filter(m => m.status === 'CRITICAL').length,
          completeness_pct: Math.round((vipResults.length / 27) * 100)
        },
        
        patterns: patterns,
        
        risk_assessment: {
          overall_risk_score: overallRisk,
          risk_category: riskCategory,
          category_risks: categoryRisks
        },
        
        biological_age: biologicalAgeData,
        aging_markers: agingMarkers
      },
      
      // ====================================================================
      // SECONDARY MARKERS (253 markers - Good/Bad/Ugly categorization)
      // ====================================================================
      secondary_markers: {
        // Summary counts
        summary: secondaryResults.summary,
        
        // Only BAD and UGLY markers (for report highlighting)
        flagged_markers: secondaryResults.flagged_markers,
        
        // All 253 markers (optional, for detailed view)
        all_markers: secondaryResults.all_markers
      },
      
      // ====================================================================
      // COMBINED INSIGHTS
      // ====================================================================
      overall_health_score: {
        vip_risk_score: overallRisk,
        secondary_good_pct: Math.round((secondaryResults.summary.good / secondaryResults.summary.total) * 100),
        secondary_bad_count: secondaryResults.summary.bad,
        secondary_ugly_count: secondaryResults.summary.ugly,
        overall_status: getOverallHealthStatus(overallRisk, secondaryResults.summary)
      },
      
      // ====================================================================
      // METADATA
      // ====================================================================
      metadata: {
        analysis_version: '2.0.0',
        analysis_engine: 'Burak Complete Analyzer',
        vip_markers_analyzed: vipResults.length,
        secondary_markers_analyzed: secondaryResults.summary.total,
        total_markers_analyzed: vipResults.length + secondaryResults.summary.total,
        reference_source: vipResults.filter(m => m.reference_used === 'GCC').length > 0 
          ? 'Mixed (GCC + Western)' 
          : 'Western only',
        processing_time_ms: processingTime,
        generated_at: new Date().toISOString()
      }
    };

    console.log(`[Burak Analyzer] ✓ Complete analysis finished! (${processingTime}ms)`);
    console.log(`[Summary] VIP: ${vipResults.length}/27 | Secondary: ${secondaryResults.summary.total}/253 | Total: ${vipResults.length + secondaryResults.summary.total}/280`);
    
    return result;

  } catch (error) {
    console.error('[Burak Analyzer] ✗ Analysis failed:', error.message);
    throw error;
  }
}

/**
 * Determine overall health status from combined analysis
 */
function getOverallHealthStatus(vipRiskScore, secondarySummary) {
  const secondaryUglyPct = (secondarySummary.ugly / secondarySummary.total) * 100;
  const secondaryBadPct = (secondarySummary.bad / secondarySummary.total) * 100;
  
  // Critical if VIP risk is critical OR >20% of secondary markers are UGLY
  if (vipRiskScore >= 8 || secondaryUglyPct > 20) {
    return 'CRITICAL';
  }
  
  // High if VIP risk is high OR >15% UGLY + >30% BAD
  if (vipRiskScore >= 6 || (secondaryUglyPct > 15 && secondaryBadPct > 30)) {
    return 'HIGH';
  }
  
  // Moderate if VIP risk is moderate OR >25% BAD
  if (vipRiskScore >= 3 || secondaryBadPct > 25) {
    return 'MODERATE';
  }
  
  // Low if everything else is good
  return 'LOW';
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Validate participant data before analysis
 */
function validateParticipantData(data) {
  const errors = [];

  data.forEach((marker, index) => {
    // Check value is numeric
    if (typeof marker.value !== 'number' || isNaN(marker.value)) {
      errors.push(`Row ${index + 1}: Value is not a valid number`);
    }

    // Check value is positive
    if (marker.value < 0) {
      errors.push(`Row ${index + 1}: Value cannot be negative`);
    }

    // Check marker code exists
    if (!marker.marker_code || marker.marker_code.trim() === '') {
      errors.push(`Row ${index + 1}: Marker code is missing`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Close database connection pool
 */
async function closeConnection() {
  await pool.end();
  console.log('[Burak Analyzer] Database connection closed');
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('[Burak Analyzer] ✓ Database connection successful');
    return true;
  } catch (error) {
    console.error('[Burak Analyzer] ✗ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Get analysis summary for quick overview
 */
function getAnalysisSummary(result) {
  return {
    participant_id: result.participant_id,
    overall_status: result.overall_health_score.overall_status,
    vip_risk: `${result.vip_markers.risk_assessment.overall_risk_score}/10 (${result.vip_markers.risk_assessment.risk_category})`,
    vip_abnormal: result.vip_markers.summary.elevated_count + result.vip_markers.summary.high_count + result.vip_markers.summary.critical_count,
    secondary_good: result.secondary_markers.summary.good,
    secondary_bad: result.secondary_markers.summary.bad,
    secondary_ugly: result.secondary_markers.summary.ugly,
    patterns_detected: result.vip_markers.patterns.length,
    biological_age: result.vip_markers.biological_age.biological_age,
    age_delta: result.vip_markers.biological_age.age_delta
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main analysis function
  analyzeParticipant,
  
  // Utility functions
  validateParticipantData,
  testConnection,
  closeConnection,
  getAnalysisSummary,
  
  // Individual components (if needed separately)
  analyzeSecondaryMarkers,
  detectPatterns,
  calculateOverallRisk,
  getRiskCategory,
  calculateCategoryRisks,
  calculateBiologicalAge,
  getAgingMarkers,
  
  // Configuration (read-only)
  CONFIG
};

// ============================================================================
// STANDALONE EXECUTION (for testing)
// ============================================================================

if (require.main === module) {
  const participantId = process.argv[2] || 1;
  
  console.log('='.repeat(80));
  console.log('BURAK PRECISION HEALTH PLATFORM - COMPLETE ANALYZER v2.0');
  console.log('='.repeat(80));
  console.log(`Analyzing participant ID: ${participantId}`);
  console.log(`Expected markers: 27 VIP + 253 Secondary = 280 total\n`);

  testConnection()
    .then(connected => {
      if (!connected) {
        console.error('Cannot proceed without database connection');
        process.exit(1);
      }
      return analyzeParticipant(participantId);
    })
    .then(result => {
      console.log('\n' + '='.repeat(80));
      console.log('COMPLETE ANALYSIS RESULT');
      console.log('='.repeat(80));
      
      // Display quick summary
      const summary = getAnalysisSummary(result);
      console.log('\nQUICK SUMMARY:');
      console.log('─'.repeat(80));
      console.log(`Overall Status: ${summary.overall_status}`);
      console.log(`VIP Risk: ${summary.vip_risk}`);
      console.log(`VIP Abnormal: ${summary.vip_abnormal}/27`);
      console.log(`Secondary: ${summary.secondary_good} GOOD | ${summary.secondary_bad} BAD | ${summary.secondary_ugly} UGLY`);
      console.log(`Patterns: ${summary.patterns_detected} detected`);
      if (summary.biological_age) {
        console.log(`Biological Age: ${summary.biological_age} years (delta: ${summary.age_delta > 0 ? '+' : ''}${summary.age_delta})`);
      }
      
      // Full JSON output
      console.log('\n' + '='.repeat(80));
      console.log('FULL JSON OUTPUT (for Gemini):');
      console.log('='.repeat(80));
      console.log(JSON.stringify(result, null, 2));
      
      console.log('\n' + '='.repeat(80));
      console.log('ANALYSIS COMPLETE');
      console.log('='.repeat(80));
      
      return closeConnection();
    })
    .then(() => {
      console.log('\n✓ Done! Ready for Gemini API integration.');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n✗ Error:', error);
      closeConnection().then(() => process.exit(1));
    });
}
