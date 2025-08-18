#!/usr/bin/env node
/*
 * Script to fix missing properties in cipher algorithms
 * Adds the required minKeyLength, maxKeyLength, etc. properties
 * (c)2025 Hawkynt - Refactor tool
 */

const fs = require('fs');
const path = require('path');

// List of files that need fixing (without the ./ prefix)
const filesToFix = [
  'algorithms/asymmetric/dilithium.js',
  'algorithms/asymmetric/ml-kem.js', 
  'algorithms/asymmetric/sphincs-plus.js',
  'algorithms/block/kalyna.js',
  'algorithms/block/loki89.js',
  'algorithms/block/misty2.js',
  'algorithms/block/newdes.js',
  'algorithms/block/present128.js',
  'algorithms/compression/brotli.js',
  'algorithms/hash/blake2s.js',
  'algorithms/hash/blake3.js',
  'algorithms/hash/crc16.js',
  'algorithms/hash/sha3-256.js',
  'algorithms/hash/shake128.js',
  'algorithms/hash/siphash.js',
  'algorithms/hash/streebog.js',
  'algorithms/hash/tiger.js',
  'algorithms/hash/whirlpool.js',
  'algorithms/hash/xxhash32.js',
  'algorithms/kdf/argon2.js',
  'algorithms/mac/cmac.js',
  'algorithms/special/ascon.js',
  'algorithms/stream/e2.js',
  'algorithms/stream/zuc.js'
];

// Property templates for different algorithm types
const propertyTemplates = {
  hash: {
    minKeyLength: 0,        // Hash functions can work without keys
    maxKeyLength: 64,       // Most support up to 64-byte keys
    stepKeyLength: 1,       // Any key length
    minBlockSize: 0,        // Hash functions accept any input size
    maxBlockSize: 0,        // No maximum (0 = unlimited)
    stepBlockSize: 1,       // Any data size
    instances: {}           // Instance tracking
  },
  
  block: {
    minKeyLength: 16,       // Most block ciphers need at least 128-bit keys
    maxKeyLength: 32,       // Up to 256-bit keys typically
    stepKeyLength: 8,       // Usually 64-bit steps
    minBlockSize: 8,        // Minimum block size (64-bit)
    maxBlockSize: 16,       // Maximum block size (128-bit)
    stepBlockSize: 8,       // Block size steps
    instances: {}           // Instance tracking
  },
  
  stream: {
    minKeyLength: 16,       // Stream ciphers usually need 128-bit+ keys
    maxKeyLength: 32,       // Up to 256-bit keys
    stepKeyLength: 1,       // Any key length within range
    minBlockSize: 0,        // Stream ciphers process any amount
    maxBlockSize: 0,        // No maximum (0 = unlimited)
    stepBlockSize: 1,       // Any data size
    instances: {}           // Instance tracking
  },
  
  asymmetric: {
    minKeyLength: 32,       // Post-quantum algorithms need larger keys
    maxKeyLength: 256,      // Up to 2048-bit keys for some PQ algorithms
    stepKeyLength: 1,       // Flexible key lengths
    minBlockSize: 0,        // Asymmetric ciphers handle variable sizes
    maxBlockSize: 0,        // No maximum
    stepBlockSize: 1,       // Any data size
    instances: {}           // Instance tracking
  },
  
  compression: {
    minKeyLength: 0,        // Compression doesn't typically need keys
    maxKeyLength: 0,        // No key support
    stepKeyLength: 1,       // N/A
    minBlockSize: 0,        // Accept any input size
    maxBlockSize: 0,        // No maximum
    stepBlockSize: 1,       // Any data size
    instances: {}           // Instance tracking
  },
  
  mac: {
    minKeyLength: 16,       // MACs need keys
    maxKeyLength: 64,       // Support up to 512-bit keys
    stepKeyLength: 1,       // Any key length within range
    minBlockSize: 0,        // Accept any input size
    maxBlockSize: 0,        // No maximum
    stepBlockSize: 1,       // Any data size
    instances: {}           // Instance tracking
  },
  
  special: {
    minKeyLength: 16,       // Special/authenticated modes need keys
    maxKeyLength: 32,       // Up to 256-bit keys
    stepKeyLength: 1,       // Any key length within range
    minBlockSize: 0,        // Flexible input sizes
    maxBlockSize: 0,        // No maximum
    stepBlockSize: 1,       // Any data size
    instances: {}           // Instance tracking
  },
  
  kdf: {
    minKeyLength: 1,        // KDFs can derive from any input
    maxKeyLength: 64,       // Support large input keys
    stepKeyLength: 1,       // Any key length
    minBlockSize: 0,        // Accept any input size
    maxBlockSize: 0,        // No maximum
    stepBlockSize: 1,       // Any data size
    instances: {}           // Instance tracking
  }
};

function determineAlgorithmType(filePath) {
  if (filePath.includes('/hash/')) return 'hash';
  if (filePath.includes('/block/')) return 'block';
  if (filePath.includes('/stream/')) return 'stream';
  if (filePath.includes('/asymmetric/')) return 'asymmetric';
  if (filePath.includes('/compression/')) return 'compression';
  if (filePath.includes('/mac/')) return 'mac';
  if (filePath.includes('/special/')) return 'special';
  if (filePath.includes('/kdf/')) return 'kdf';
  return 'block'; // Default fallback
}

function formatProperties(properties) {
  return `
    // Required Cipher interface properties
    minKeyLength: ${properties.minKeyLength},        // Minimum key length in bytes
    maxKeyLength: ${properties.maxKeyLength},        // Maximum key length in bytes
    stepKeyLength: ${properties.stepKeyLength},       // Key length step size
    minBlockSize: ${properties.minBlockSize},        // Minimum block size in bytes
    maxBlockSize: ${properties.maxBlockSize},        // Maximum block size (0 = unlimited)
    stepBlockSize: ${properties.stepBlockSize},       // Block size step
    instances: {},          // Instance tracking`;
}

function fixFile(filePath) {
  try {
    console.log(`Fixing ${filePath}...`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if properties are already present
    if (content.includes('minKeyLength:')) {
      console.log(`  ✓ Already has required properties`);
      return;
    }
    
    // Find the algorithm object definition
    const algorithmMatch = content.match(/const\s+\w+\s*=\s*{[\s\S]*?internalName:\s*['"`][^'"`]+['"`],[\s\S]*?name:\s*['"`][^'"`]+['"`],/);
    
    if (!algorithmMatch) {
      console.log(`  ✗ Could not find algorithm object definition`);
      return;
    }
    
    const algorithmType = determineAlgorithmType(filePath);
    const properties = propertyTemplates[algorithmType];
    const formattedProperties = formatProperties(properties);
    
    // Find insertion point after the name property
    const nameMatch = content.match(/(name:\s*['"`][^'"`]+['"`],)/);
    if (!nameMatch) {
      console.log(`  ✗ Could not find name property`);
      return;
    }
    
    // Insert the properties after the name
    const newContent = content.replace(nameMatch[1], nameMatch[1] + formattedProperties);
    
    // Write the updated content
    fs.writeFileSync(filePath, newContent);
    console.log(`  ✓ Added ${algorithmType} properties`);
    
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
  }
}

function main() {
  console.log('Fixing missing cipher properties...\n');
  
  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const file of filesToFix) {
    if (fs.existsSync(file)) {
      try {
        fixFile(file);
        fixed++;
      } catch (error) {
        console.log(`Error processing ${file}: ${error.message}`);
        errors++;
      }
    } else {
      console.log(`Skipping ${file} (not found)`);
      skipped++;
    }
  }
  
  console.log(`\nSummary:`);
  console.log(`  Fixed: ${fixed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
}

if (require.main === module) {
  main();
}