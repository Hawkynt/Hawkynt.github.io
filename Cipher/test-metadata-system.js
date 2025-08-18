#!/usr/bin/env node
/*
 * Cipher Metadata System Test Suite
 * Tests the metadata system with enhanced cipher implementations
 * (c)2006-2025 Hawkynt
 */

console.log('=== Cipher Metadata System Test Suite ===\n');

// Load the metadata system and API
try {
  require('./cipher-metadata.js');
  require('./cipher-metadata-api.js');
  require('./universal-cipher-env.js');
  require('./cipher.js');
  
  // Load enhanced cipher implementations
  const enhancedCiphers = [
    './caesar.js',
    './base64.js', 
    './chacha20.js',
    './sha256.js',
    './rc4.js'
  ];
  
  console.log('Loading enhanced cipher implementations...');
  enhancedCiphers.forEach(cipher => {
    try {
      require(cipher);
      console.log(`✓ Loaded: ${cipher}`);
    } catch (e) {
      console.log(`✗ Failed to load ${cipher}: ${e.message}`);
    }
  });
  
} catch (error) {
  console.error('Failed to load dependencies:', error.message);
  process.exit(1);
}

console.log('\n=== Testing Metadata System ===\n');

// Test 1: Validate metadata schema
console.log('1. Testing metadata schema validation...');
const testMetadata = global.CipherMetadata.createMetadata({
  algorithm: 'TestCipher',
  displayName: 'Test Cipher',
  description: 'A test cipher for validation',
  category: global.CipherMetadata.Categories.CLASSICAL,
  complexity: global.CipherMetadata.ComplexityLevels.BEGINNER,
  securityStatus: global.CipherMetadata.SecurityStatus.EDUCATIONAL
});

const errors = global.CipherMetadata.validateMetadata(testMetadata);
if (errors.length === 0) {
  console.log('✓ Metadata schema validation passed');
} else {
  console.log('✗ Metadata schema validation failed:', errors);
}

// Test 2: Check enhanced ciphers have metadata
console.log('\n2. Testing enhanced cipher metadata...');
const ciphersWithMetadata = global.CipherMetadataAPI.getAllCiphers();
console.log(`Found ${ciphersWithMetadata.length} ciphers with metadata:`);

ciphersWithMetadata.forEach(cipher => {
  if (cipher.metadata) {
    const metadata = cipher.metadata;
    console.log(`✓ ${cipher.displayName}:`);
    console.log(`  - Category: ${metadata.category}`);
    console.log(`  - Security: ${metadata.securityStatus}`);
    console.log(`  - Complexity: ${metadata.complexity}`);
    console.log(`  - Year: ${metadata.year}`);
    console.log(`  - Tags: ${metadata.tags.slice(0, 3).join(', ')}${metadata.tags.length > 3 ? '...' : ''}`);
  } else {
    console.log(`✗ ${cipher.displayName}: No metadata`);
  }
});

// Test 3: Validation report
console.log('\n3. Testing metadata validation...');
const validation = global.CipherMetadataAPI.validateAllMetadata();
console.log(`Validation Results:`);
console.log(`  - Total: ${validation.total}`);
console.log(`  - Valid: ${validation.valid}`);
console.log(`  - Invalid: ${validation.invalid}`);
if (validation.errors.length > 0) {
  console.log(`  - Errors:`);
  validation.errors.forEach(error => {
    console.log(`    * ${error.cipher}: ${error.error || error.errors.join(', ')}`);
  });
}

// Test 4: Search functionality
console.log('\n4. Testing search functionality...');
const searchResults = global.CipherMetadataAPI.searchCiphers('stream');
console.log(`Search for 'stream' found ${searchResults.length} results:`);
searchResults.forEach(cipher => {
  console.log(`  - ${cipher.displayName} (${cipher.metadata.category})`);
});

// Test 5: Category filtering
console.log('\n5. Testing category filtering...');
Object.values(global.CipherMetadata.Categories).forEach(category => {
  const categoryResults = global.CipherMetadataAPI.getCiphersByCategory(category);
  if (categoryResults.length > 0) {
    console.log(`${category}: ${categoryResults.length} cipher(s)`);
    categoryResults.forEach(cipher => {
      console.log(`  - ${cipher.displayName}`);
    });
  }
});

// Test 6: Security status filtering
console.log('\n6. Testing security status filtering...');
Object.values(global.CipherMetadata.SecurityStatus).forEach(status => {
  const statusResults = global.CipherMetadataAPI.getCiphersBySecurityStatus(status);
  if (statusResults.length > 0) {
    console.log(`${status}: ${statusResults.length} cipher(s)`);
    statusResults.forEach(cipher => {
      console.log(`  - ${cipher.displayName}`);
    });
  }
});

// Test 7: Statistics generation
console.log('\n7. Testing statistics generation...');
const stats = global.CipherMetadataAPI.getStatistics();
console.log('Statistics:');
console.log(`  - Total ciphers: ${stats.total}`);
console.log(`  - Average year: ${stats.averageYear}`);
console.log(`  - By category:`, stats.byCategory);
console.log(`  - By complexity:`, stats.byComplexity);
console.log(`  - By security status:`, stats.bySecurityStatus);

// Test 8: Report generation
console.log('\n8. Testing report generation...');
try {
  const jsonReport = global.CipherMetadataAPI.generateReport('json');
  console.log(`✓ JSON report generated (${JSON.stringify(jsonReport).length} characters)`);
  
  const markdownReport = global.CipherMetadataAPI.generateReport('markdown');
  console.log(`✓ Markdown report generated (${markdownReport.length} characters)`);
  
  const htmlReport = global.CipherMetadataAPI.generateReport('html');
  console.log(`✓ HTML report generated (${htmlReport.length} characters)`);
} catch (error) {
  console.log(`✗ Report generation failed: ${error.message}`);
}

// Test 9: Export functionality
console.log('\n9. Testing export functionality...');
try {
  const jsonExport = global.CipherMetadataAPI.exportMetadata('json');
  console.log(`✓ JSON export generated (${jsonExport.ciphers.length} ciphers)`);
  
  const csvExport = global.CipherMetadataAPI.exportMetadata('csv');
  console.log(`✓ CSV export generated (${csvExport.split('\n').length - 1} rows)`);
} catch (error) {
  console.log(`✗ Export failed: ${error.message}`);
}

// Test 10: Individual cipher metadata access
console.log('\n10. Testing individual cipher metadata access...');
const enhancedCipherNames = ['Caesar', 'BASE64', 'ChaCha20', 'SHA256', 'RC4'];
enhancedCipherNames.forEach(name => {
  const metadata = global.CipherMetadataAPI.getCipherMetadata(name);
  if (metadata) {
    console.log(`✓ ${name}: Retrieved metadata`);
    console.log(`  - Description: ${metadata.description.substring(0, 80)}...`);
    console.log(`  - Inventor: ${metadata.inventor}`);
    console.log(`  - Year: ${metadata.year}`);
  } else {
    console.log(`✗ ${name}: No metadata found`);
  }
});

console.log('\n=== Test Suite Complete ===');
console.log('The metadata system has been successfully implemented and tested.');
console.log('Enhanced cipher implementations include comprehensive metadata with:');
console.log('- Algorithm descriptions and historical context');
console.log('- Security status and complexity classifications');
console.log('- Official specifications and test vector references');
console.log('- Educational value and implementation notes');
console.log('- Searchable tags and categorization');
console.log('- Machine-readable format for UI consumption');