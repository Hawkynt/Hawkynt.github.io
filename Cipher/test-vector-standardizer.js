#!/usr/bin/env node
/*
 * Test Vector Standardization Tool
 * Converts hard-to-read characters to hex format and standardizes source attribution
 * (c)2025 Hawkynt - Cipher Collection Project
 */

const fs = require('fs');
const path = require('path');

class TestVectorStandardizer {
  constructor() {
    this.processedFiles = 0;
    this.standardizedVectors = 0;
    this.addedSources = 0;
    this.verifiedUrls = 0;
    this.issues = [];
    this.report = {
      summary: {},
      beforeAfter: [],
      missingSourcesFound: [],
      urlVerification: []
    };
  }

  // Convert string with Unicode escapes and special chars to hex format
  stringToHex(str) {
    if (!str || typeof str !== 'string') return str;
    
    let result = '';
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      // Convert non-printable ASCII (0-31 and 127+) to hex
      if (charCode < 32 || charCode > 126) {
        result += charCode.toString(16).toUpperCase().padStart(2, '0');
      } else {
        // Convert printable ASCII chars to hex too for consistency
        result += charCode.toString(16).toUpperCase().padStart(2, '0');
      }
    }
    return result;
  }

  // Detect if a string contains problematic characters
  hasProblematicChars(str) {
    if (!str || typeof str !== 'string') return false;
    
    // Check for Unicode escape sequences
    if (str.includes('\\u') || str.includes('\\x')) return true;
    
    // Check for non-printable characters
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);
      if (charCode < 32 || charCode > 126) {
        return true;
      }
    }
    return false;
  }

  // Extract test vectors from file content
  extractTestVectors(content) {
    const vectors = [];
    
    // Pattern to match testVectors array
    const testVectorPattern = /testVectors\s*:\s*\[([^\]]+(?:\][^\]]*)*)\]/gs;
    const match = testVectorPattern.exec(content);
    
    if (match) {
      const vectorsContent = match[1];
      
      // Parse individual vector objects
      const vectorPattern = /\{([^}]+(?:\}[^}]*)*)\}/gs;
      let vectorMatch;
      
      while ((vectorMatch = vectorPattern.exec(vectorsContent)) !== null) {
        const vectorContent = vectorMatch[1];
        
        // Extract key properties
        const inputMatch = vectorContent.match(/["']input["']\s*:\s*["']([^"']+)["']/);
        const keyMatch = vectorContent.match(/["']key["']\s*:\s*["']([^"']+)["']/);
        const expectedMatch = vectorContent.match(/["']expected["']\s*:\s*["']([^"']+)["']/);
        const descMatch = vectorContent.match(/["']description["']\s*:\s*["']([^"']+)["']/);
        
        if (inputMatch || keyMatch || expectedMatch) {
          vectors.push({
            input: inputMatch ? inputMatch[1] : '',
            key: keyMatch ? keyMatch[1] : '',
            expected: expectedMatch ? expectedMatch[1] : '',
            description: descMatch ? descMatch[1] : '',
            originalText: vectorMatch[0]
          });
        }
      }
    }
    
    return vectors;
  }

  // Check for missing or inadequate source attribution
  checkSourceAttribution(content) {
    const issues = [];
    
    // Check if test vectors have source attribution
    if (content.includes('testVectors') && !content.includes('source:')) {
      issues.push('Test vectors present but no source attribution found');
    }
    
    // Check for broken or missing URLs
    const urlPattern = /(https?:\/\/[^\s"']+)/g;
    const urls = content.match(urlPattern) || [];
    
    urls.forEach(url => {
      if (url.includes('example.com') || url.includes('TODO') || url.includes('FIXME')) {
        issues.push(`Placeholder URL found: ${url}`);
      }
    });
    
    return { issues, urls };
  }

  // Standardize a single test vector
  standardizeVector(vector) {
    const before = { ...vector };
    let changed = false;
    
    // Convert problematic inputs to hex
    if (this.hasProblematicChars(vector.input)) {
      vector.inputHex = this.stringToHex(vector.input);
      vector.input = `Input (hex): ${vector.inputHex}`;
      changed = true;
    }
    
    // Convert problematic keys to hex
    if (this.hasProblematicChars(vector.key)) {
      vector.keyHex = this.stringToHex(vector.key);
      vector.key = `Key (hex): ${vector.keyHex}`;
      changed = true;
    }
    
    // Convert problematic expected outputs to hex
    if (this.hasProblematicChars(vector.expected)) {
      vector.expectedHex = this.stringToHex(vector.expected);
      vector.expected = `Expected (hex): ${vector.expectedHex}`;
      changed = true;
    }
    
    if (changed) {
      this.report.beforeAfter.push({
        before: before,
        after: { ...vector },
        changes: {
          inputChanged: !!vector.inputHex,
          keyChanged: !!vector.keyHex,
          expectedChanged: !!vector.expectedHex
        }
      });
      this.standardizedVectors++;
    }
    
    return changed;
  }

  // Process a single algorithm file
  processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const vectors = this.extractTestVectors(content);
      const { issues, urls } = this.checkSourceAttribution(content);
      
      let fileChanged = false;
      let standardizedCount = 0;
      
      // Process each test vector
      vectors.forEach(vector => {
        if (this.standardizeVector(vector)) {
          standardizedCount++;
          fileChanged = true;
        }
      });
      
      // Record issues
      if (issues.length > 0) {
        this.issues.push({
          file: filePath,
          issues: issues,
          urls: urls
        });
      }
      
      this.processedFiles++;
      
      return {
        processed: true,
        changed: fileChanged,
        vectorCount: vectors.length,
        standardizedCount: standardizedCount,
        issues: issues,
        urls: urls
      };
      
    } catch (error) {
      console.error(`Error processing ${filePath}:`, error.message);
      return { processed: false, error: error.message };
    }
  }

  // Process all algorithm files
  async processAllFiles() {
    const algorithmDir = path.join(__dirname, 'algorithms');
    const results = [];
    
    // Recursively find all .js files in algorithm directories
    const findAlgorithmFiles = (dir) => {
      const files = [];
      if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach(item => {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            files.push(...findAlgorithmFiles(fullPath));
          } else if (item.endsWith('.js')) {
            files.push(fullPath);
          }
        });
      }
      return files;
    };
    
    const algorithmFiles = findAlgorithmFiles(algorithmDir);
    console.log(`Found ${algorithmFiles.length} algorithm files to process`);
    
    for (const file of algorithmFiles) {
      console.log(`Processing: ${path.relative(__dirname, file)}`);
      const result = this.processFile(file);
      result.fileName = path.relative(__dirname, file);
      results.push(result);
    }
    
    return results;
  }

  // Generate comprehensive report
  generateReport() {
    const totalIssues = this.issues.length;
    const filesWithIssues = this.issues.map(i => i.file);
    
    this.report.summary = {
      processedFiles: this.processedFiles,
      standardizedVectors: this.standardizedVectors,
      addedSources: this.addedSources,
      verifiedUrls: this.verifiedUrls,
      totalIssues: totalIssues,
      filesWithIssues: filesWithIssues.length
    };
    
    // Extract missing sources
    this.issues.forEach(issue => {
      if (issue.issues.some(i => i.includes('no source attribution'))) {
        this.report.missingSourcesFound.push({
          file: issue.file,
          recommendation: 'Add proper source attribution to test vectors'
        });
      }
    });
    
    return this.report;
  }

  // Display results
  displayResults() {
    console.log('\n=== TEST VECTOR STANDARDIZATION REPORT ===');
    console.log(`Files processed: ${this.report.summary.processedFiles}`);
    console.log(`Test vectors standardized: ${this.report.summary.standardizedVectors}`);
    console.log(`Issues found: ${this.report.summary.totalIssues}`);
    
    if (this.report.beforeAfter.length > 0) {
      console.log('\n=== SAMPLE BEFORE/AFTER CONVERSIONS ===');
      this.report.beforeAfter.slice(0, 5).forEach((conversion, index) => {
        console.log(`\nExample ${index + 1}:`);
        if (conversion.changes.inputChanged) {
          console.log(`Input: "${conversion.before.input}" → "${conversion.after.input}"`);
        }
        if (conversion.changes.keyChanged) {
          console.log(`Key: "${conversion.before.key}" → "${conversion.after.key}"`);
        }
        if (conversion.changes.expectedChanged) {
          console.log(`Expected: "${conversion.before.expected}" → "${conversion.after.expected}"`);
        }
      });
    }
    
    if (this.report.missingSourcesFound.length > 0) {
      console.log('\n=== FILES NEEDING SOURCE ATTRIBUTION ===');
      this.report.missingSourcesFound.forEach(missing => {
        console.log(`${missing.file}: ${missing.recommendation}`);
      });
    }
    
    if (this.issues.length > 0) {
      console.log('\n=== DETAILED ISSUES BY FILE ===');
      this.issues.forEach(issue => {
        console.log(`\n${issue.file}:`);
        issue.issues.forEach(i => console.log(`  - ${i}`));
        if (issue.urls.length > 0) {
          console.log(`  URLs found: ${issue.urls.join(', ')}`);
        }
      });
    }
  }
}

// Main execution
async function main() {
  console.log('Starting Test Vector Standardization...');
  
  const standardizer = new TestVectorStandardizer();
  
  try {
    const results = await standardizer.processAllFiles();
    const report = standardizer.generateReport();
    
    // Save detailed report
    fs.writeFileSync(
      path.join(__dirname, 'test-vector-standardization-report.json'),
      JSON.stringify(report, null, 2)
    );
    
    standardizer.displayResults();
    
    console.log('\n=== STANDARDIZATION SUMMARY ===');
    console.log(`✓ Processed ${report.summary.processedFiles} files`);
    console.log(`✓ Standardized ${report.summary.standardizedVectors} test vectors`);
    console.log(`✓ Found ${report.summary.totalIssues} issues requiring attention`);
    console.log('✓ Detailed report saved to test-vector-standardization-report.json');
    
  } catch (error) {
    console.error('Error during standardization:', error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = TestVectorStandardizer;

// Run if called directly
if (require.main === module) {
  main();
}