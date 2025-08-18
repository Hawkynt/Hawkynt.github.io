#!/usr/bin/env node
/*
 * Script to modernize Hungarian notation in cipher algorithms
 * Converts szXxx -> xxx, nXxx -> xxx, etc.
 * (c)2025 Hawkynt - Refactor tool
 */

const fs = require('fs');
const path = require('path');

// Hungarian notation patterns to modernize
const hungarianMappings = {
  'szVersion': 'version',
  'szDate': 'date', 
  'szAuthor': 'author',
  'szDescription': 'description',
  'szReference': 'reference',
  'szName': 'displayName',
  'szInternalName': 'internalName', // Keep as is - already good
  'nKeySize': 'keySize',
  'nBlockSize': 'blockSize',
  'bIsStreamCipher': 'isStreamCipher',
  'bIsBlockCipher': 'isBlockCipher',
  'bIsPostQuantum': 'isPostQuantum',
  'bIsSignature': 'isSignature',
  'nComplexity': 'complexity',
  'szFamily': 'family',
  'szCategory': 'category',
  'arrInstances': 'instances',
  'boolInit': 'isInitialized',
  'objUsedCipher': 'usedCipher'
};

function modernizeHungarianNotation(content) {
  let modernized = content;
  
  for (const [hungarian, modern] of Object.entries(hungarianMappings)) {
    // Replace property definitions (name: value)
    const propertyRegex = new RegExp(`\\b${hungarian}\\s*:`, 'g');
    modernized = modernized.replace(propertyRegex, `${modern}:`);
    
    // Replace property access (obj.name)
    const accessRegex = new RegExp(`\\.${hungarian}\\b`, 'g');
    modernized = modernized.replace(accessRegex, `.${modern}`);
    
    // Replace direct references in code
    const directRegex = new RegExp(`\\b${hungarian}\\b(?=\\s*[,;\\)\\]])`, 'g');
    modernized = modernized.replace(directRegex, modern);
  }
  
  return modernized;
}

function processFile(filePath) {
  try {
    console.log(`Processing ${filePath}...`);
    
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check if file has Hungarian notation
    const hasHungarian = Object.keys(hungarianMappings).some(hungarian => 
      content.includes(hungarian)
    );
    
    if (!hasHungarian) {
      console.log(`  ✓ No Hungarian notation found`);
      return;
    }
    
    const modernized = modernizeHungarianNotation(content);
    
    if (modernized !== content) {
      fs.writeFileSync(filePath, modernized);
      console.log(`  ✓ Modernized Hungarian notation`);
    } else {
      console.log(`  ✓ No changes needed`);
    }
    
  } catch (error) {
    console.log(`  ✗ Error: ${error.message}`);
  }
}

function findJavaScriptFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function main() {
  console.log('Modernizing Hungarian notation in cipher algorithms...\n');
  
  // Find all JavaScript files in the Cipher directory
  const cipherDir = '.';
  const jsFiles = findJavaScriptFiles(cipherDir);
  
  let processed = 0;
  let modernized = 0;
  let errors = 0;
  
  for (const file of jsFiles) {
    try {
      const beforeContent = fs.readFileSync(file, 'utf8');
      processFile(file);
      const afterContent = fs.readFileSync(file, 'utf8');
      
      processed++;
      if (beforeContent !== afterContent) {
        modernized++;
      }
    } catch (error) {
      console.log(`Error processing ${file}: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\nSummary:`);
  console.log(`  Files processed: ${processed}`);
  console.log(`  Files modernized: ${modernized}`);
  console.log(`  Errors: ${errors}`);
}

if (require.main === module) {
  main();
}