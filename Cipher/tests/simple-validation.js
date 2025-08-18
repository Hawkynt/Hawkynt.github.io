#!/usr/bin/env node
/*
 * Simple Infrastructure Validation
 * Tests core functionality without DOM dependencies
 * (c)2006-2025 Hawkynt
 */

console.log('SynthelicZ Cipher Tools - Simple Validation');
console.log('==========================================');

const fs = require('fs');
const path = require('path');

let totalTests = 0;
let passedTests = 0;

function runTest(name, testFn) {
  totalTests++;
  try {
    const result = testFn();
    if (result) {
      passedTests++;
      console.log(`✓ ${name}`);
    } else {
      console.log(`✗ ${name} - Failed`);
    }
  } catch (e) {
    console.log(`✗ ${name} - Error: ${e.message}`);
  }
}

// Test 1: Check core files exist
runTest('OpCodes.js exists', () => {
  return fs.existsSync(path.join(__dirname, '..', 'OpCodes.js'));
});

runTest('cipher.js exists', () => {
  return fs.existsSync(path.join(__dirname, '..', 'cipher.js'));
});

// Test 2: Load OpCodes
let OpCodes;
runTest('Load OpCodes', () => {
  try {
    OpCodes = require('../OpCodes.js');
    return typeof global.OpCodes === 'object';
  } catch (e) {
    console.log(`OpCodes load error: ${e.message}`);
    return false;
  }
});

// Test 3: Test OpCodes functions
if (global.OpCodes) {
  runTest('OpCodes.RotL32 function', () => {
    const result = global.OpCodes.RotL32(0x12345678, 8);
    return result === 0x34567812;
  });
  
  runTest('OpCodes.StringToBytes function', () => {
    const result = global.OpCodes.StringToBytes('ABC');
    return result.length === 3 && result[0] === 65;
  });
}

// Test 4: Load cipher system
let Cipher;
runTest('Load Cipher system', () => {
  try {
    require('../universal-cipher-env.js');
    Cipher = require('../cipher.js');
    return typeof global.Cipher === 'object';
  } catch (e) {
    console.log(`Cipher system load error: ${e.message}`);
    return false;
  }
});

// Test 5: Check algorithm directories
const algDir = path.join(__dirname, '..', 'algorithms');
runTest('Algorithms directory exists', () => {
  return fs.existsSync(algDir);
});

if (fs.existsSync(algDir)) {
  const categories = ['block', 'stream', 'hash', 'classical', 'compression'];
  categories.forEach(category => {
    runTest(`${category} algorithms directory`, () => {
      const categoryDir = path.join(algDir, category);
      return fs.existsSync(categoryDir);
    });
  });
}

// Test 6: Check for universal suffix cleanup
runTest('No universal suffix files remain', () => {
  function findUniversalFiles(dir) {
    let found = [];
    if (!fs.existsSync(dir)) return found;
    
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        found = found.concat(findUniversalFiles(fullPath));
      } else if (item.endsWith('-universal.js')) {
        found.push(fullPath);
      }
    }
    return found;
  }
  
  const universalFiles = findUniversalFiles(path.join(__dirname, '..'));
  if (universalFiles.length > 0) {
    console.log(`Found universal files: ${universalFiles.join(', ')}`);
  }
  return universalFiles.length === 0;
});

// Test 7: Load a sample algorithm
runTest('Load sample algorithm (caesar)', () => {
  try {
    const caesarPath = path.join(__dirname, '..', 'algorithms', 'classical', 'caesar.js');
    if (fs.existsSync(caesarPath)) {
      require(caesarPath);
      return true;
    } else {
      console.log('Caesar algorithm file not found');
      return false;
    }
  } catch (e) {
    console.log(`Caesar load error: ${e.message}`);
    return false;
  }
});

// Test 8: Verify enhanced algorithms have test vectors
runTest('Enhanced algorithms have test vectors', () => {
  try {
    const rijndaelPath = path.join(__dirname, '..', 'algorithms', 'block', 'rijndael.js');
    if (fs.existsSync(rijndaelPath)) {
      const content = fs.readFileSync(rijndaelPath, 'utf8');
      return content.includes('testVectors') && content.includes('referenceLinks');
    }
    return false;
  } catch (e) {
    return false;
  }
});

// Test 9: Count enhanced algorithms
runTest('Count enhanced algorithms with test vectors', () => {
  try {
    let enhancedCount = 0;
    
    function countEnhanced(dir) {
      if (!fs.existsSync(dir)) return;
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          countEnhanced(fullPath);
        } else if (item.endsWith('.js')) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('testVectors') && content.includes('referenceLinks')) {
              enhancedCount++;
            }
          } catch (e) {
            // Skip files that can't be read
          }
        }
      }
    }
    
    countEnhanced(algDir);
    console.log(`  Found ${enhancedCount} enhanced algorithms`);
    return enhancedCount > 20; // Expect at least 20 enhanced algorithms
  } catch (e) {
    return false;
  }
});

// Summary
console.log('\n==========================================');
console.log('Validation Summary:');
console.log(`Total Tests: ${totalTests}`);
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${totalTests - passedTests}`);
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log('\n🟢 All tests passed! System is healthy.');
} else if (passedTests / totalTests >= 0.8) {
  console.log('\n🟡 Most tests passed. Minor issues detected.');
} else {
  console.log('\n🔴 Multiple test failures. System needs attention.');
}

console.log('\n==========================================');