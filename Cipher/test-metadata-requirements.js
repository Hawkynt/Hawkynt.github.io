#!/usr/bin/env node
/*
 * Comprehensive Metadata Requirements Validation Test
 * 
 * This test validates that all cipher algorithms meet the metadata requirements:
 * 1. Basic Info: name, description, year, country flag
 * 2. References: URL to deeper explanation or author website
 * 3. Test Vectors: At least one test vector per algorithm
 * 4. Vector Attribution: Each vector needs origin URL and description
 * 5. Source Material: At least one reference URL per algorithm
 * 
 * (c)2025 Hawkynt - Educational Cryptographic Platform
 * For use with SynthelicZ Cipher Tools
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Symbols for status indicators
const symbols = {
  pass: '✅',
  fail: '❌',
  warning: '⚠️',
  info: 'ℹ️',
  bullet: '•'
};

class MetadataValidator {
  constructor() {
    this.results = [];
    this.totalAlgorithms = 0;
    this.passedAlgorithms = 0;
    this.categories = new Map();
    this.urlValidator = /^https?:\/\/.+/i;
    this.countryCodeValidator = /^[A-Z]{2}$/;
  }

  /**
   * Scan algorithms directory and find all cipher files
   */
  findAlgorithmFiles() {
    const algorithmsDir = path.join(__dirname, 'algorithms');
    const algorithmFiles = [];

    function scanDirectory(dir) {
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (entry.endsWith('.js') && !entry.includes('test')) {
            algorithmFiles.push(fullPath);
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dir}:`, error.message);
      }
    }

    if (fs.existsSync(algorithmsDir)) {
      scanDirectory(algorithmsDir);
    } else {
      console.error('Algorithms directory not found:', algorithmsDir);
    }

    return algorithmFiles.sort();
  }

  /**
   * Load and evaluate a cipher algorithm file
   */
  loadAlgorithm(filePath) {
    try {
      // Read the file as text first to extract metadata manually
      const code = fs.readFileSync(filePath, 'utf8');
      
      // Try to extract algorithm object using text parsing for better reliability
      const algorithm = this.parseAlgorithmFromCode(code, filePath);
      
      return algorithm;
    } catch (error) {
      console.warn(`Warning: Could not load ${filePath}: ${error.message}`);
      return {};
    }
  }

  /**
   * Parse algorithm object from source code using text analysis
   */
  parseAlgorithmFromCode(code, filePath) {
    const algorithm = {
      metadata: {},
      testVectors: [],
      officialTestVectors: [],
      referenceLinks: {},
      internalName: '',
      name: ''
    };

    try {
      // Extract algorithm name from filename as fallback
      const baseName = path.basename(filePath, '.js');
      algorithm.internalName = baseName;
      algorithm.name = baseName;

      // Look for main algorithm object definition
      const algorithmObjMatch = code.match(/const\s+(\w+)\s*=\s*\{[\s\S]*?\};/s);
      if (algorithmObjMatch) {
        const objName = algorithmObjMatch[1];
        algorithm.internalName = objName;
        algorithm.name = objName;
      }

      // Extract internalName property
      const internalNameMatch = code.match(/internalName\s*:\s*['"]([^'"]+)['"]/i);
      if (internalNameMatch) {
        algorithm.internalName = internalNameMatch[1];
      }

      // Extract name property
      const nameMatch = code.match(/name\s*:\s*['"]([^'"]+)['"]/i);
      if (nameMatch) {
        algorithm.name = nameMatch[1];
      }

      // Extract metadata object
      const metadataMatch = code.match(/metadata\s*:\s*(\{[\s\S]*?\}),?/s);
      if (metadataMatch) {
        try {
          // Try to parse the metadata object
          algorithm.metadata = this.parseMetadataObject(metadataMatch[1]);
        } catch (e) {
          // If parsing fails, extract key fields manually
          algorithm.metadata = this.extractMetadataFields(metadataMatch[1]);
        }
      }

      // Look for CipherMetadata.createMetadata calls
      const createMetadataMatch = code.match(/CipherMetadata\.createMetadata\(\s*(\{[\s\S]*?\})\s*\)/s);
      if (createMetadataMatch) {
        try {
          const metaObj = this.parseMetadataObject(createMetadataMatch[1]);
          algorithm.metadata = { ...algorithm.metadata, ...metaObj };
        } catch (e) {
          const metaObj = this.extractMetadataFields(createMetadataMatch[1]);
          algorithm.metadata = { ...algorithm.metadata, ...metaObj };
        }
      }

      // Extract test vectors
      const testVectorsMatch = code.match(/testVectors\s*:\s*(\[[\s\S]*?\]),?/s);
      if (testVectorsMatch) {
        algorithm.testVectors = this.parseTestVectors(testVectorsMatch[1]);
      }

      // Extract official test vectors
      const officialVectorsMatch = code.match(/officialTestVectors\s*:\s*(\[[\s\S]*?\]),?/s);
      if (officialVectorsMatch) {
        algorithm.officialTestVectors = this.parseTestVectors(officialVectorsMatch[1]);
      }

      // Extract reference links
      const referenceLinksMatch = code.match(/referenceLinks\s*:\s*(\{[\s\S]*?\}),?/s);
      if (referenceLinksMatch) {
        algorithm.referenceLinks = this.parseReferenceLinks(referenceLinksMatch[1]);
      }

      return algorithm;
    } catch (error) {
      console.warn(`Error parsing ${filePath}: ${error.message}`);
      return algorithm; // Return what we have so far
    }
  }

  /**
   * Extract metadata fields from a metadata object string
   */
  extractMetadataFields(metadataStr) {
    const metadata = {};

    // Extract key fields using regex
    const fields = {
      algorithm: /algorithm\s*:\s*['"]([^'"]+)['"]/i,
      displayName: /displayName\s*:\s*['"]([^'"]+)['"]/i,
      name: /name\s*:\s*['"]([^'"]+)['"]/i,
      description: /description\s*:\s*['"]([^'"]*?)['"]/is,
      inventor: /inventor\s*:\s*['"]([^'"]+)['"]/i,
      year: /year\s*:\s*(-?\d+)/i,
      country: /country\s*:\s*['"]([^'"]+)['"]/i,
      url: /url\s*:\s*['"]([^'"]+)['"]/i
    };

    for (const [key, regex] of Object.entries(fields)) {
      const match = metadataStr.match(regex);
      if (match) {
        if (key === 'year') {
          metadata[key] = parseInt(match[1]);
        } else {
          metadata[key] = match[1];
        }
      }
    }

    // Extract specifications array
    const specificationsMatch = metadataStr.match(/specifications\s*:\s*(\[[\s\S]*?\])/s);
    if (specificationsMatch) {
      metadata.specifications = this.parseSpecifications(specificationsMatch[1]);
    }

    // Extract references array
    const referencesMatch = metadataStr.match(/references\s*:\s*(\[[\s\S]*?\])/s);
    if (referencesMatch) {
      metadata.references = this.parseSpecifications(referencesMatch[1]);
    }

    return metadata;
  }

  /**
   * Parse metadata object from string (simplified JSON-like parsing)
   */
  parseMetadataObject(objStr) {
    // This is a simplified parser - for complex objects, fall back to field extraction
    try {
      // Clean up the object string to make it more JSON-like
      let cleanStr = objStr
        .replace(/([\w]+)\s*:/g, '"$1":') // Quote property names
        .replace(/'/g, '"') // Convert single quotes to double quotes
        .replace(/,\s*}/g, '}') // Remove trailing commas
        .replace(/,\s*]/g, ']'); // Remove trailing commas in arrays
      
      return JSON.parse(cleanStr);
    } catch (e) {
      // Fall back to field extraction
      return this.extractMetadataFields(objStr);
    }
  }

  /**
   * Parse test vectors array
   */
  parseTestVectors(vectorsStr) {
    const vectors = [];
    
    // Look for individual test vector objects
    const vectorMatches = vectorsStr.match(/\{[\s\S]*?\}/g);
    if (vectorMatches) {
      for (const vectorMatch of vectorMatches) {
        const vector = {};
        
        // Extract common fields
        const descMatch = vectorMatch.match(/description\s*:\s*['"]([^'"]*?)['"]/s);
        if (descMatch) vector.description = descMatch[1];
        
        const sourceMatch = vectorMatch.match(/source\s*:\s*\{[\s\S]*?\}/s);
        if (sourceMatch) {
          const urlMatch = sourceMatch[0].match(/url\s*:\s*['"]([^'"]+)['"]/i);
          if (urlMatch) {
            vector.source = { url: urlMatch[1] };
          }
        }
        
        const linkMatch = vectorMatch.match(/link\s*:\s*['"]([^'"]+)['"]/i);
        if (linkMatch) {
          vector.link = linkMatch[1];
        }
        
        const originMatch = vectorMatch.match(/origin\s*:\s*\{[\s\S]*?\}/s);
        if (originMatch) {
          const urlMatch = originMatch[0].match(/url\s*:\s*['"]([^'"]+)['"]/i);
          if (urlMatch) {
            vector.origin = { url: urlMatch[1] };
          }
        }
        
        vectors.push(vector);
      }
    }
    
    return vectors;
  }

  /**
   * Parse specifications/references array
   */
  parseSpecifications(specsStr) {
    const specs = [];
    
    const specMatches = specsStr.match(/\{[\s\S]*?\}/g);
    if (specMatches) {
      for (const specMatch of specMatches) {
        const spec = {};
        
        const nameMatch = specMatch.match(/name\s*:\s*['"]([^'"]*?)['"]/s);
        if (nameMatch) spec.name = nameMatch[1];
        
        const urlMatch = specMatch.match(/url\s*:\s*['"]([^'"]+)['"]/i);
        if (urlMatch) spec.url = urlMatch[1];
        
        if (spec.url) specs.push(spec);
      }
    }
    
    return specs;
  }

  /**
   * Parse reference links object
   */
  parseReferenceLinks(linksStr) {
    const links = {};
    
    // Extract specifications array
    const specificationsMatch = linksStr.match(/specifications\s*:\s*(\[[\s\S]*?\])/s);
    if (specificationsMatch) {
      links.specifications = this.parseSpecifications(specificationsMatch[1]);
    }
    
    // Extract implementations array
    const implementationsMatch = linksStr.match(/implementations\s*:\s*(\[[\s\S]*?\])/s);
    if (implementationsMatch) {
      links.implementations = this.parseSpecifications(implementationsMatch[1]);
    }
    
    return links;
  }

  /**
   * Validate required metadata fields for an algorithm
   */
  validateAlgorithm(filePath, algorithm) {
    const relativePath = path.relative(__dirname, filePath);
    const category = path.dirname(relativePath).split('/').pop();
    const algorithmName = algorithm.internalName || algorithm.name || path.basename(filePath, '.js');

    const result = {
      name: algorithmName,
      file: relativePath,
      category: category,
      metadata: algorithm.metadata || {},
      testVectors: algorithm.testVectors || [],
      officialTestVectors: algorithm.officialTestVectors || [],
      referenceLinks: algorithm.referenceLinks || {},
      scores: {
        basicInfo: 0,
        references: 0,
        testVectors: 0,
        vectorAttribution: 0,
        sourceMaterial: 0
      },
      issues: [],
      warnings: [],
      recommendations: []
    };

    this.validateBasicInfo(result);
    this.validateReferences(result);
    this.validateTestVectors(result);
    this.validateVectorAttribution(result);
    this.validateSourceMaterial(result);

    // Calculate overall compliance
    const totalScore = Object.values(result.scores).reduce((sum, score) => sum + score, 0);
    const maxScore = Object.keys(result.scores).length * 100;
    result.overallCompliance = Math.round((totalScore / maxScore) * 100);

    return result;
  }

  /**
   * Validate basic algorithm information
   */
  validateBasicInfo(result) {
    const meta = result.metadata;
    let score = 0;

    // Check name (20 points)
    if (meta.displayName || meta.algorithm || result.name) {
      score += 20;
    } else {
      result.issues.push('Missing algorithm name');
    }

    // Check description (30 points)
    if (meta.description && meta.description.length >= 50) {
      score += 30;
    } else if (meta.description) {
      score += 15;
      result.warnings.push('Description is too short (< 50 characters)');
    } else {
      result.issues.push('Missing algorithm description');
    }

    // Check year (20 points)
    if (meta.year && typeof meta.year === 'number' && meta.year > 1000) {
      score += 20;
    } else if (meta.year) {
      score += 10;
      result.warnings.push('Year format may be invalid');
    } else {
      result.issues.push('Missing invention/publication year');
    }

    // Check country (30 points)
    if (meta.country && this.countryCodeValidator.test(meta.country)) {
      score += 30;
    } else if (meta.country) {
      score += 15;
      result.warnings.push('Country code format invalid (should be 2-letter ISO code)');
    } else {
      result.issues.push('Missing country of origin');
    }

    result.scores.basicInfo = score;
  }

  /**
   * Validate reference URLs and documentation
   */
  validateReferences(result) {
    const meta = result.metadata;
    let score = 0;

    // Check main reference URL (50 points)
    if (meta.url && this.urlValidator.test(meta.url)) {
      score += 50;
    } else if (meta.url) {
      score += 25;
      result.warnings.push('Main URL format may be invalid');
    } else {
      result.issues.push('Missing main reference URL');
    }

    // Check specifications array (30 points)
    if (meta.specifications && Array.isArray(meta.specifications) && meta.specifications.length > 0) {
      const validSpecs = meta.specifications.filter(spec => 
        spec.url && this.urlValidator.test(spec.url)
      );
      if (validSpecs.length > 0) {
        score += 30;
      } else {
        score += 15;
        result.warnings.push('Specifications exist but URLs are invalid');
      }
    } else {
      result.issues.push('Missing specifications array');
    }

    // Check references array (20 points)
    if (meta.references && Array.isArray(meta.references) && meta.references.length > 0) {
      const validRefs = meta.references.filter(ref => 
        ref.url && this.urlValidator.test(ref.url)
      );
      if (validRefs.length > 0) {
        score += 20;
      } else {
        score += 10;
        result.warnings.push('References exist but URLs are invalid');
      }
    } else {
      result.warnings.push('Missing references array (optional but recommended)');
    }

    result.scores.references = score;
  }

  /**
   * Validate test vectors existence and quality
   */
  validateTestVectors(result) {
    let score = 0;
    const vectors = result.testVectors.length + result.officialTestVectors.length;

    if (vectors >= 5) {
      score += 100;
    } else if (vectors >= 3) {
      score += 80;
    } else if (vectors >= 1) {
      score += 60;
    } else {
      result.issues.push('No test vectors found');
      result.recommendations.push('Add at least 1 test vector with known expected output');
    }

    if (vectors > 0 && vectors < 3) {
      result.recommendations.push('Consider adding more test vectors for better coverage');
    }

    result.scores.testVectors = score;
  }

  /**
   * Validate test vector attribution and sources
   */
  validateVectorAttribution(result) {
    let score = 0;
    const allVectors = [...result.testVectors, ...result.officialTestVectors];
    
    if (allVectors.length === 0) {
      result.scores.vectorAttribution = 0;
      return;
    }

    let vectorsWithAttribution = 0;
    let vectorsWithValidUrls = 0;

    for (const vector of allVectors) {
      if (vector.source || vector.origin || vector.link) {
        vectorsWithAttribution++;
        
        const sourceUrl = vector.source?.url || vector.origin?.url || vector.link;
        if (sourceUrl && this.urlValidator.test(sourceUrl)) {
          vectorsWithValidUrls++;
        }
      }
    }

    const attributionRatio = vectorsWithAttribution / allVectors.length;
    const urlValidityRatio = vectorsWithValidUrls / allVectors.length;

    score = Math.round((attributionRatio * 60) + (urlValidityRatio * 40));

    if (vectorsWithAttribution === 0) {
      result.issues.push('No test vector attribution found');
      result.recommendations.push('Add source attribution to test vectors');
    } else if (attributionRatio < 0.5) {
      result.warnings.push('Many test vectors lack proper attribution');
    }

    if (vectorsWithValidUrls === 0 && vectorsWithAttribution > 0) {
      result.warnings.push('Test vector sources lack valid URLs');
    }

    result.scores.vectorAttribution = score;
  }

  /**
   * Validate source material and documentation links
   */
  validateSourceMaterial(result) {
    let score = 0;
    const meta = result.metadata;
    const links = result.referenceLinks;

    let validSources = 0;

    // Check metadata specifications
    if (meta.specifications && Array.isArray(meta.specifications)) {
      validSources += meta.specifications.filter(spec => 
        spec.url && this.urlValidator.test(spec.url)
      ).length;
    }

    // Check reference links structure
    if (links.specifications && Array.isArray(links.specifications)) {
      validSources += links.specifications.filter(spec => 
        spec.url && this.urlValidator.test(spec.url)
      ).length;
    }

    if (links.implementations && Array.isArray(links.implementations)) {
      validSources += links.implementations.filter(impl => 
        impl.url && this.urlValidator.test(impl.url)
      ).length;
    }

    // Check main metadata URL
    if (meta.url && this.urlValidator.test(meta.url)) {
      validSources++;
    }

    if (validSources >= 3) {
      score = 100;
    } else if (validSources >= 2) {
      score = 80;
    } else if (validSources >= 1) {
      score = 60;
    } else {
      result.issues.push('No valid source material URLs found');
      result.recommendations.push('Add at least one authoritative source URL');
    }

    if (validSources > 0 && validSources < 2) {
      result.recommendations.push('Add more reference sources for comprehensive documentation');
    }

    result.scores.sourceMaterial = score;
  }

  /**
   * Run validation on all algorithms
   */
  async runValidation() {
    console.log(`${colors.bright}${colors.cyan}🔍 SynthelicZ Cipher Metadata Requirements Validation${colors.reset}\n`);
    
    const algorithmFiles = this.findAlgorithmFiles();
    this.totalAlgorithms = algorithmFiles.length;

    console.log(`Found ${colors.bright}${algorithmFiles.length}${colors.reset} algorithm files to validate\n`);

    for (const filePath of algorithmFiles) {
      const algorithm = this.loadAlgorithm(filePath);
      const result = this.validateAlgorithm(filePath, algorithm);
      this.results.push(result);

      // Track categories
      const category = result.category;
      if (!this.categories.has(category)) {
        this.categories.set(category, { total: 0, passed: 0 });
      }
      this.categories.get(category).total++;

      if (result.overallCompliance >= 70) {
        this.passedAlgorithms++;
        this.categories.get(category).passed++;
      }

      // Show progress
      const status = result.overallCompliance >= 70 ? 
        `${colors.green}${symbols.pass}` : 
        `${colors.red}${symbols.fail}`;
      console.log(`${status} ${result.name} (${result.overallCompliance}%)${colors.reset}`);
    }

    console.log('\n' + '='.repeat(80) + '\n');
    this.generateReport();
  }

  /**
   * Generate comprehensive validation report
   */
  generateReport() {
    console.log(`${colors.bright}${colors.blue}📊 METADATA COMPLIANCE REPORT${colors.reset}\n`);

    // Overall statistics
    const overallCompliance = Math.round((this.passedAlgorithms / this.totalAlgorithms) * 100);
    console.log(`${colors.bright}Overall Compliance: ${overallCompliance}% (${this.passedAlgorithms}/${this.totalAlgorithms})${colors.reset}\n`);

    // Category breakdown
    console.log(`${colors.bright}📂 Category Breakdown:${colors.reset}`);
    for (const [category, stats] of this.categories.entries()) {
      const categoryCompliance = Math.round((stats.passed / stats.total) * 100);
      const status = categoryCompliance >= 70 ? colors.green : colors.red;
      console.log(`  ${status}${category}: ${categoryCompliance}% (${stats.passed}/${stats.total})${colors.reset}`);
    }
    console.log();

    // Detailed results for failing algorithms
    const failingAlgorithms = this.results.filter(r => r.overallCompliance < 70);
    if (failingAlgorithms.length > 0) {
      console.log(`${colors.bright}${colors.red}❌ ALGORITHMS NEEDING ATTENTION (${failingAlgorithms.length}):${colors.reset}\n`);
      
      for (const result of failingAlgorithms.slice(0, 10)) { // Show first 10
        console.log(`${colors.bright}${result.name}${colors.reset} (${result.file})`);
        console.log(`  Compliance: ${result.overallCompliance}%`);
        
        // Show score breakdown
        console.log(`  Scores:`);
        for (const [category, score] of Object.entries(result.scores)) {
          const status = score >= 70 ? colors.green : score >= 40 ? colors.yellow : colors.red;
          console.log(`    ${status}${category}: ${score}%${colors.reset}`);
        }
        
        // Show critical issues
        if (result.issues.length > 0) {
          console.log(`  ${colors.red}Issues:${colors.reset}`);
          result.issues.slice(0, 3).forEach(issue => {
            console.log(`    ${symbols.fail} ${issue}`);
          });
        }
        
        console.log();
      }
      
      if (failingAlgorithms.length > 10) {
        console.log(`... and ${failingAlgorithms.length - 10} more algorithms\n`);
      }
    }

    // Top performing algorithms
    const topPerformers = this.results
      .filter(r => r.overallCompliance >= 90)
      .sort((a, b) => b.overallCompliance - a.overallCompliance)
      .slice(0, 5);
    
    if (topPerformers.length > 0) {
      console.log(`${colors.bright}${colors.green}🏆 TOP PERFORMING ALGORITHMS:${colors.reset}\n`);
      topPerformers.forEach(result => {
        console.log(`  ${symbols.pass} ${colors.green}${result.name}${colors.reset} - ${result.overallCompliance}%`);
      });
      console.log();
    }

    // Generate actionable recommendations
    this.generateRecommendations();

    // Generate updated README table data
    this.generateReadmeUpdate();
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations() {
    console.log(`${colors.bright}${colors.yellow}💡 ACTIONABLE RECOMMENDATIONS:${colors.reset}\n`);

    // Collect common issues
    const issueFrequency = new Map();
    const recommendationFrequency = new Map();

    this.results.forEach(result => {
      result.issues.forEach(issue => {
        issueFrequency.set(issue, (issueFrequency.get(issue) || 0) + 1);
      });
      result.recommendations.forEach(rec => {
        recommendationFrequency.set(rec, (recommendationFrequency.get(rec) || 0) + 1);
      });
    });

    // Top issues to fix
    const topIssues = Array.from(issueFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    console.log(`${colors.bright}🔧 Most Common Issues to Fix:${colors.reset}`);
    topIssues.forEach(([issue, count]) => {
      console.log(`  ${symbols.fail} ${issue} (${count} algorithms)`);
    });
    console.log();

    // Priority fixes
    console.log(`${colors.bright}🎯 Priority Fixes:${colors.reset}`);
    console.log(`  1. Add basic metadata (name, description, year, country) to algorithms missing it`);
    console.log(`  2. Include at least one test vector with source attribution`);
    console.log(`  3. Add reference URLs to specifications or documentation`);
    console.log(`  4. Ensure country codes use 2-letter ISO format (e.g., 'US', 'DE', 'JP')`);
    console.log(`  5. Validate all URLs are accessible and properly formatted`);
    console.log();

    // Suggested sources for missing URLs
    console.log(`${colors.bright}🌐 Suggested Sources for Missing URLs:${colors.reset}`);
    console.log(`  • Wikipedia articles for algorithm overviews`);
    console.log(`  • Original academic papers (Google Scholar, ACM Digital Library)`);
    console.log(`  • NIST/RFC specifications for standardized algorithms`);
    console.log(`  • OpenSSL/libsodium implementations for production examples`);
    console.log(`  • Cryptographic textbooks and educational resources`);
    console.log();
  }

  /**
   * Generate updated README.md content with compliance status
   */
  generateReadmeUpdate() {
    console.log(`${colors.bright}${colors.magenta}📋 README.md UPDATE RECOMMENDATIONS:${colors.reset}\n`);

    // Calculate statistics for badges
    const workingCount = this.results.filter(r => r.overallCompliance >= 70).length;
    const totalCount = this.results.length;
    const workingPercentage = Math.round((workingCount / totalCount) * 100);

    console.log(`${colors.bright}Suggested Badge Updates:${colors.reset}`);
    console.log(`[![Algorithms](https://img.shields.io/badge/Algorithms-${totalCount}+-blue.svg)](https://hawkynt.github.io/Cipher/)`);
    console.log(`[![Metadata](https://img.shields.io/badge/Metadata%20Compliant-${workingCount}%20(${workingPercentage}%25)-${workingPercentage >= 80 ? 'brightgreen' : workingPercentage >= 60 ? 'yellow' : 'red'}.svg)](https://hawkynt.github.io/Cipher/)`);
    console.log();

    // Generate algorithm table with compliance status
    console.log(`${colors.bright}Algorithm Table with Compliance Status:${colors.reset}`);
    console.log('| Algorithm | Category | Compliance | Issues | Status |');
    console.log('|-----------|----------|------------|--------|--------|');

    this.results
      .sort((a, b) => b.overallCompliance - a.overallCompliance)
      .slice(0, 20) // Show top 20
      .forEach(result => {
        const complianceColor = result.overallCompliance >= 90 ? '🟢' : 
                               result.overallCompliance >= 70 ? '🟡' : '🔴';
        const status = result.overallCompliance >= 70 ? '✅ Complete' : '⚠️ Needs Work';
        const issueCount = result.issues.length;
        
        console.log(`| ${result.name} | ${result.category} | ${complianceColor} ${result.overallCompliance}% | ${issueCount} | ${status} |`);
      });

    if (this.results.length > 20) {
      console.log(`| ... | ... | ... | ... | ... |`);
      console.log(`| (${this.results.length - 20} more algorithms) | | | | |`);
    }
    console.log();

    // Legend
    console.log(`${colors.bright}Legend:${colors.reset}`);
    console.log(`🟢 90-100% - Excellent metadata compliance`);
    console.log(`🟡 70-89% - Good compliance, minor improvements needed`);
    console.log(`🔴 <70% - Needs significant metadata improvements`);
    console.log();

    console.log(`${colors.bright}Summary Statistics:${colors.reset}`);
    console.log(`• Total Algorithms: ${this.totalAlgorithms}`);
    console.log(`• Metadata Compliant (≥70%): ${this.passedAlgorithms} (${Math.round((this.passedAlgorithms/this.totalAlgorithms)*100)}%)`);
    console.log(`• Excellent (≥90%): ${this.results.filter(r => r.overallCompliance >= 90).length}`);
    console.log(`• Good (70-89%): ${this.results.filter(r => r.overallCompliance >= 70 && r.overallCompliance < 90).length}`);
    console.log(`• Needs Work (<70%): ${this.results.filter(r => r.overallCompliance < 70).length}`);
  }

  /**
   * Save detailed results to JSON file
   */
  saveResults() {
    const outputFile = path.join(__dirname, 'metadata-validation-results.json');
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalAlgorithms: this.totalAlgorithms,
        compliantAlgorithms: this.passedAlgorithms,
        overallCompliance: Math.round((this.passedAlgorithms / this.totalAlgorithms) * 100),
        categories: Object.fromEntries(this.categories)
      },
      results: this.results
    };

    try {
      fs.writeFileSync(outputFile, JSON.stringify(reportData, null, 2));
      console.log(`\n${colors.bright}📁 Detailed results saved to: ${colors.cyan}${outputFile}${colors.reset}\n`);
    } catch (error) {
      console.error(`Failed to save results: ${error.message}`);
    }
  }
}

// Main execution
if (require.main === module) {
  const validator = new MetadataValidator();
  validator.runValidation().then(() => {
    validator.saveResults();
    
    // Exit with appropriate code
    const overallCompliance = Math.round((validator.passedAlgorithms / validator.totalAlgorithms) * 100);
    process.exit(overallCompliance >= 70 ? 0 : 1);
  }).catch(error => {
    console.error(`${colors.red}Validation failed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = MetadataValidator;