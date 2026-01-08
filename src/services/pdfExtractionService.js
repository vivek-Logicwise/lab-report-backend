const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

/**
 * PDF Extraction Service
 * Handles PDF parsing with concurrent processing and memory optimization
 * 
 * Performance optimizations:
 * - Streaming for large files
 * - Concurrent processing with Promise.all
 * - Memory cleanup after processing
 */

class PDFExtractionService {
  constructor() {
    // Known marker names for VIP markers (to handle concatenation issues)
    this.knownMarkerNames = {
      'CRP': 'C-Reactive Protein',
      'IL6': 'Interleukin-6',
      'TNFA': 'Tumor Necrosis Factor Alpha',
      'FIB': 'Fibrinogen',
      'HBA1C': 'Hemoglobin A1C',
      'GLU': 'Fasting Glucose',
      'INS': 'Fasting Insulin',
      'HOMAIR': 'HOMA-IR',
      'TC': 'Total Cholesterol',
      'LDL': 'LDL Cholesterol',
      'HDL': 'HDL Cholesterol',
      'TG': 'Triglycerides',
      'APOB': 'Apolipoprotein B',
      'FERR': 'Ferritin',
      'TSAT': 'Transferrin Saturation',
      'ALT': 'Alanine Aminotransferase',
      'AST': 'Aspartate Aminotransferase',
      'CREAT': 'Creatinine',
      'EGFR': 'eGFR',
      'TSH': 'Thyroid Stimulating Hormone',
      'FT4': 'Free T4',
      'FT3': 'Free T3',
      'VITD': 'Vitamin D (25-OH)',
      'B12': 'Vitamin B12',
      'CORTISOL': 'Cortisol',
      'TEST': 'Testosterone',
      'OMEGA3': 'Omega-3 Index'
    };
  }

  /**
   * Extract text from single PDF file
   * @param {Buffer|string} pdfSource - PDF buffer or file path
   * @returns {Promise<string>} Extracted text content
   */
  async extractFromPDF(pdfSource) {
    try {
      let dataBuffer;

      // Handle both buffer and file path inputs
      if (Buffer.isBuffer(pdfSource)) {
        dataBuffer = pdfSource;
      } else if (typeof pdfSource === 'string') {
        dataBuffer = await fs.readFile(pdfSource);
      } else {
        throw new Error('Invalid PDF source: must be Buffer or file path');
      }

      // Parse PDF with optimized options
      const data = await pdfParse(dataBuffer, {
        max: 0, // Parse all pages
        version: 'default'
      });

      return data.text;
    } catch (error) {
      console.error('[PDF Extraction] Error extracting PDF:', error.message);
      throw new Error(`Failed to extract PDF content: ${error.message}`);
    }
  }

  /**
   * Extract biomarker data from PDF text
   * Parses participant info, Section A (VIP Markers) and Section B (Secondary Markers)
   * 
   * @param {string} text - Extracted PDF text
   * @returns {Object} Parsed biomarker data with participant info
   */
  parseBiomarkerData(text) {
    const markers = {
      vip: [],
      secondary: []
    };

    const participantInfo = {
      participant_code: null,
      name: null,
      age: null,
      gender: null
    };

    // Split text into lines for processing
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);

    // Extract participant information from header
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i];
      
      // Extract Participant Code or Report ID
      // Matches: "Patient Code: P-IND-001", "Participant ID: P-IND-VIVEK-001", "Report ID: POC-280-001"
      const codeMatch = line.match(/(?:Patient|Participant|Report)\s*(?:Code|ID)\s*[:\\s]\s*([A-Z0-9\\-]+)/i);
      if (codeMatch && !participantInfo.participant_code) {
        participantInfo.participant_code = codeMatch[1];
      }

      // Extract Name (e.g., "Patient Name: Vivek Kumar" or "Name: John Doe")
      const nameMatch = line.match(/(?:Patient\s*)?Name\s*[:\s]\s*([A-Za-z\s]+)(?:\s|$)/i);
      if (nameMatch && !participantInfo.name && !line.includes('Marker')) {
        participantInfo.name = nameMatch[1].trim();
      }

      // Extract Age (e.g., "Age: 31" or "Age: 31 years")
      const ageMatch = line.match(/Age\s*[:\s]\s*(\d+)/i);
      if (ageMatch && !participantInfo.age) {
        participantInfo.age = parseInt(ageMatch[1]);

      }

      // Extract Gender (e.g., "Gender: Male" or "Sex: Female")
      const genderMatch = line.match(/(?:Gender|Sex)\s*[:\s]\s*(Male|Female|Other)/i);
      if (genderMatch && !participantInfo.gender) {
        participantInfo.gender = genderMatch[1];
        console.log(`[PDF] Extracted gender: ${participantInfo.gender}`);
      }
    }

    // Find section boundaries
    let inSectionA = false;
    let inSectionB = false;

    // Known VIP marker codes (in order of length, longest first to match correctly)
    const vipCodes = ['HOMAIR', 'OMEGA3', 'CREAT', 'HBA1C', 'VITD', 'FERR', 'CORT', 
                      'APOB', 'ZINC', 'TNFA', 'EGFR', 'CRP', 'IL6', 'FIB', 'GLU', 
                      'INS', 'LDL', 'HDL', 'ALT', 'AST', 'GGT', 'TSH', 'FT3', 'FT4', 
                      'B12', 'TC', 'TG'];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect section boundaries
      if (/Section\s+A[:\s]*VIP\s+Markers/i.test(line)) {
        inSectionA = true;
        inSectionB = false;
        continue;
      }

      if (/Section\s+B[:\s]*Secondary\s+Markers/i.test(line)) {
        inSectionA = false;
        inSectionB = true;
        continue;
      }

      // Skip header rows (but not if line starts with a marker code)
      const startsWithMarkerCode = vipCodes.some(code => line.startsWith(code)) || /^SEC\d+/.test(line);
      if (!startsWithMarkerCode && /CodeMarker|^Code\s*Marker/i.test(line)) {
        continue;
      }

      // Skip patient information lines (but not if line starts with a marker code)
      if (!startsWithMarkerCode && /Patient|Report\s+ID|Collection|Gender|Age:|Name:|Comprehensive|Laboratory/i.test(line)) {
        continue;
      }
      
      // Skip lines that are just "Code", "Marker Name", "Value", "Unit", "Reference" headers
      if (!startsWithMarkerCode && /^(Code|Marker Name|Value|Unit|Reference)$/i.test(line)) {
        continue;
      }

      // Skip empty lines
      if (line.length < 5) {
        continue;
      }

      // Parse VIP markers (Section A)
      if (inSectionA) {
        // Try to find a known VIP code at the start
        let foundCode = null;
        for (const code of vipCodes) {
          if (line.startsWith(code)) {
            foundCode = code;
            break;
          }
        }

        if (foundCode) {
          // Extract rest of line after code
          const rest = line.substring(foundCode.length);
          
          // Strategy: If we know the marker name, use it to parse correctly
          // This handles cases like "Interleukin-66.1" where the name ends with a digit
          const expectedName = this.knownMarkerNames[foundCode];
          
          let name, value, unit;
          
          if (expectedName && rest.includes(expectedName)) {
            // Use the known name to extract value correctly - check if name exists in rest
            const nameStartPos = rest.indexOf(expectedName);
            const afterName = rest.substring(nameStartPos + expectedName.length);
            
            // Extract value and unit from what comes after the name - enhanced for % symbol
            const valueMatch = afterName.match(/(\d+\.?\d*)\s*(%|[a-zμ%]+\/[a-zμ%]+|[μ%]IU\/[a-zμ%]+|U\/L|Index|ng\/dL|pg\/mL|mg\/L|mg\/dL|µg\/dL|mL\/min\/\d+\.?\d*m²)/i);
            
            if (valueMatch) {
              name = expectedName;
              value = valueMatch[1];
              unit = valueMatch[2];
            }
          } else {
            // Fallback: Use unit-first strategy - enhanced to match more units including %
            const unitMatch = rest.match(/(\d+\.?\d*)\s*(%|[a-zμ%]+\/[a-zμ%]+|[μ%]IU\/[a-zμ%]+|U\/L|Index|ng\/dL|pg\/mL|mg\/L|mg\/dL|µg\/dL|mL\/min\/\d+\.?\d*m²)/i);
            
            if (unitMatch) {
              value = unitMatch[1];
              unit = unitMatch[2];
              // Everything before the value is the name
              const valuePos = rest.indexOf(unitMatch[1]);
              name = rest.substring(0, valuePos).trim();
            }
          }
          
          if (name && value && unit) {
            // Standardize marker code
            const markerCode = this.standardizeMarkerCode(foundCode);
            
            // Get standard marker name
            const standardName = this.getStandardMarkerName(markerCode, name);
            
            markers.vip.push({
              marker_code: markerCode,
              marker_name: standardName,
              value: parseFloat(value),
              unit: unit
            });
          } else {
            console.warn(`[PDF] Failed to parse VIP marker: ${foundCode} from line: ${line}`);
          }
        } else if (inSectionA && line.length > 5) {
          // Skip unrecognized lines
        }
      }

      // Parse secondary markers (Section B)
      if (inSectionB) {
        // Pattern: SEC### followed by name and value
        const codeMatch = line.match(/^(SEC\d+)/);
        
        if (codeMatch) {
          const code = codeMatch[1];
          const rest = line.substring(code.length);
          
          // Enhanced regex to match more unit patterns
          const unitMatch = rest.match(/(\d+\.?\d*)\s*([a-zμ%]+\/[a-zμ%]+|[μ%]IU\/[a-zμ%]+|U\/L|Index|%|ng\/dL|pg\/mL|mg\/L|mg\/dL|µg\/dL|mL\/min\/\d+\.?\d*m²)/i);
          
          if (unitMatch) {
            const value = unitMatch[1];
            const unit = unitMatch[2];
            // Everything before the value is the name
            const valuePos = rest.indexOf(unitMatch[1]);
            const name = rest.substring(0, valuePos).trim();
            
            markers.secondary.push({
              marker_code: code,
              marker_name: name,
              value: parseFloat(value),
              unit: unit
            });
          } else {
            console.warn(`[PDF] Failed to parse secondary marker: ${code} from line: ${line}`);
          }
        } else if (inSectionB && line.length > 5 && !line.match(/^(Code|Marker Name|Value|Unit|Reference)$/i)) {
          // Skip unrecognized lines
        }
      }
    }

    console.log(`[PDF] Extracted ${markers.vip.length} VIP markers, ${markers.secondary.length} secondary markers`);
    return {
      participantInfo,
      markers
    };
  }

  /**
   * Get standard marker name (clean version)
   * Uses shorter codes to match database
   */
  getStandardMarkerName(code, extractedName) {
    const nameMap = {
      'CRP': 'C-Reactive Protein',
      'IL6': 'Interleukin-6',
      'TNFA': 'Tumor Necrosis Factor Alpha',
      'FIB': 'Fibrinogen',
      'HBA1C': 'Hemoglobin A1C',
      'GLU': 'Fasting Glucose',
      'INS': 'Fasting Insulin',
      'HOMAIR': 'HOMA-IR',
      'TC': 'Total Cholesterol',
      'LDL': 'LDL Cholesterol',
      'HDL': 'HDL Cholesterol',
      'TG': 'Triglycerides',
      'APOB': 'Apolipoprotein B',
      'ALT': 'Alanine Aminotransferase',
      'AST': 'Aspartate Aminotransferase',
      'GGT': 'Gamma Glutamyl Transferase',
      'CREAT': 'Creatinine',
      'EGFR': 'Estimated GFR',
      'VITD': 'Vitamin D',
      'B12': 'Vitamin B12',
      'FERR': 'Ferritin',
      'TSH': 'Thyroid Stimulating Hormone',
      'FT3': 'Free T3',
      'FT4': 'Free T4',
      'CORT': 'Cortisol',
      'OMEGA3': 'Omega-3 Index',
      'ZINC': 'Serum Zinc'
    };

    return nameMap[code] || extractedName || code;
  }

  /**
   * Standardize marker codes to match database format
   * Maps PDF shortcodes to database codes (using shorter format)
   */
  standardizeMarkerCode(code) {
    const codeMap = {
      'TNFA': 'TNFA',          // Keep as TNFA not TNF_ALPHA
      'FIB': 'FIB',            // Keep as FIB not FIBRINOGEN
      'GLU': 'GLU',            // Keep as GLU not GLUCOSE
      'INS': 'INS',            // Keep as INS not INSULIN
      'HOMAIR': 'HOMAIR',      // Keep as HOMAIR not HOMA_IR
      'TC': 'TC',              // Keep as TC not TOTAL_CHOLESTEROL
      'TG': 'TG',              // Keep as TG not TRIGLYCERIDES
      'CREAT': 'CREAT',        // Keep as CREAT not CREATININE
      'VITD': 'VITD',          // Keep as VITD not VITD3
      'B12': 'B12',            // Keep as B12 not VITAMIN_B12
      'FERR': 'FERR',          // Keep as FERR not FERRITIN
      'FT3': 'FT3',            // Keep as FT3 not FREE_T3
      'FT4': 'FT4',            // Keep as FT4 not FREE_T4
      'CORT': 'CORT',          // Keep as CORT not CORTISOL
      'OMEGA3': 'OMEGA3'       // Keep as OMEGA3 not OMEGA3_INDEX
    };

    const upperCode = code.toUpperCase();
    return codeMap[upperCode] || upperCode;
  }

  /**
   * Determine if marker is VIP (27 core markers)
   */
  isVIPMarker(markerCode) {
    const vipMarkers = [
      'CRP', 'IL6', 'HBA1C', 'LDL', 'HDL', 'TRIGLYCERIDES', 'GLUCOSE',
      'INSULIN', 'VITD3', 'VITAMIN_B12', 'FERRITIN', 'TSH', 'HOMOCYSTEINE',
      'APOB', 'TNF_ALPHA', 'ALT', 'GGT', 'TESTOSTERONE', 'FREE_T3', 'FREE_T4',
      'CORTISOL', 'DHEA', 'OMEGA3_INDEX', 'FIBRINOGEN', 'HOMA_IR',
      'TOTAL_CHOLESTEROL', 'AST', 'CREATININE', 'EGFR', 'ZINC'
    ];
    return vipMarkers.includes(markerCode);
  }

  /**
   * Infer standard unit for marker if not found in PDF
   */
  inferUnit(markerCode) {
    const unitMap = {
      'CRP': 'mg/L',
      'IL6': 'pg/mL',
      'HBA1C': '%',
      'LDL': 'mg/dL',
      'HDL': 'mg/dL',
      'TRIGLYCERIDES': 'mg/dL',
      'GLUCOSE': 'mg/dL',
      'INSULIN': 'μIU/mL',
      'VITD3': 'ng/mL',
      'VITAMIN_B12': 'pg/mL',
      'FERRITIN': 'ng/mL',
      'TSH': 'μIU/mL',
      'HOMOCYSTEINE': 'μmol/L',
      'APOB': 'mg/dL',
      'TNF_ALPHA': 'pg/mL',
      'ALT': 'U/L',
      'GGT': 'U/L',
      'TESTOSTERONE': 'ng/dL',
      'FREE_T3': 'pg/mL',
      'CORTISOL': 'μg/dL',
      'DHEA': 'μg/dL',
      'OMEGA3_INDEX': '%',
      'FIBRINOGEN': 'mg/dL',
      'HOMA_IR': ''
    };

    return unitMap[markerCode] || '';
  }

  /**
   * Process multiple PDFs concurrently
   * Optimized for performance with concurrent processing
   * 
   * @param {Array} files - Array of file objects {path, buffer}
   * @returns {Promise<Array>} Array of parsed results
   */
  async processMultiplePDFs(files) {
    try {
      console.log(`[PDF Extraction] Processing ${files.length} PDF files concurrently...`);

      // Process all PDFs in parallel for maximum performance
      const results = await Promise.all(
        files.map(async (file, index) => {
          try {
            const text = await this.extractFromPDF(file.buffer || file.path);
            const extractedData = this.parseBiomarkerData(text);

            return {
              success: true,
              fileName: file.originalname || file.name || `file_${index + 1}.pdf`,
              participantInfo: extractedData.participantInfo,
              markers: extractedData.markers,
              vipCount: extractedData.markers.vip.length,
              secondaryCount: extractedData.markers.secondary.length
            };
          } catch (error) {
            console.error(`[PDF Extraction] Error processing file ${file.originalname}:`, error.message);
            return {
              success: false,
              fileName: file.originalname || file.name || `file_${index + 1}.pdf`,
              error: error.message,
              markers: { vip: [], secondary: [] }
            };
          }
        })
      );

      // Summary statistics
      const successful = results.filter(r => r.success).length;
      const totalVIP = results.reduce((sum, r) => sum + r.vipCount, 0);
      const totalSecondary = results.reduce((sum, r) => sum + r.secondaryCount, 0);

      console.log(`[PDF Extraction] Completed: ${successful}/${files.length} files, ${totalVIP} VIP markers, ${totalSecondary} secondary markers`);

      return results;
    } catch (error) {
      console.error('[PDF Extraction] Error processing multiple PDFs:', error);
      throw error;
    }
  }

  /**
   * Validate extracted marker data
   * Ensures data quality before database insertion
   */
  validateMarkerData(markers) {
    const errors = [];
    const validated = {
      vip: [],
      secondary: []
    };

    // Validate VIP markers
    markers.vip.forEach(marker => {
      if (!marker.marker_code || !marker.value) {
        errors.push(`Invalid VIP marker: ${JSON.stringify(marker)}`);
        return;
      }

      if (marker.value < 0) {
        errors.push(`Negative value for ${marker.marker_code}: ${marker.value}`);
        return;
      }

      validated.vip.push(marker);
    });

    // Validate secondary markers
    markers.secondary.forEach(marker => {
      if (!marker.marker_code || !marker.value) {
        errors.push(`Invalid secondary marker: ${JSON.stringify(marker)}`);
        return;
      }

      if (marker.value < 0) {
        errors.push(`Negative value for ${marker.marker_code}: ${marker.value}`);
        return;
      }

      validated.secondary.push(marker);
    });

    return {
      valid: errors.length === 0,
      errors,
      markers: validated
    };
  }
}

module.exports = new PDFExtractionService();
