#!/usr/bin/env node
/*
 * Update Test Runner Script
 * Updates universal-test-runner.js to use new categorized directory structure
 * (c)2006-2025 Hawkynt
 */

const fs = require('fs');
const path = require('path');

function updateTestRunner() {
  console.log('🔄 Updating universal-test-runner.js for new directory structure...\n');
  
  const testRunnerPath = path.join(__dirname, 'universal-test-runner.js');
  
  if (!fs.existsSync(testRunnerPath)) {
    console.error('❌ universal-test-runner.js not found');
    return;
  }
  
  // Auto-discover all universal algorithm files in the new structure
  const algorithmsDir = path.join(__dirname, 'algorithms');
  const cipherModules = [];
  
  if (fs.existsSync(algorithmsDir)) {
    const categories = fs.readdirSync(algorithmsDir);
    
    categories.forEach(category => {
      const categoryPath = path.join(algorithmsDir, category);
      if (fs.statSync(categoryPath).isDirectory()) {
        const files = fs.readdirSync(categoryPath);
        files.forEach(file => {
          if (file.endsWith('.js')) {
            cipherModules.push(`./algorithms/${category}/${file}`);
          }
        });
      }
    });
  }
  
  console.log(`📊 Found ${cipherModules.length} universal cipher modules`);
  
  // Generate new test runner content
  const newContent = `#!/usr/bin/env node
/*
 * Universal Cipher Test Runner
 * Tests cipher implementations in both Node.js and Browser environments
 * Auto-discovers algorithms from categorized directory structure
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Environment detection
  const isNode = typeof module !== 'undefined' && module.exports;
  const isBrowser = typeof window !== 'undefined';
  
  // Load dependencies for Node.js
  if (isNode) {
    require('./universal-cipher-env.js');
    require('./cipher.js');
    
    // Auto-discovered universal cipher implementations from categorized structure
    const cipherModules = [
${cipherModules.map(module => `      '${module}'`).join(',\n')}
    ];
    
    console.log('=== Loading Universal Cipher System ===\\n');
    
    // Load all cipher modules
    cipherModules.forEach(module => {
      try {
        require(module);
        const fileName = module.split('/').pop().replace('.js', '');
        console.log(\`✓ Loaded \${fileName}\`);
      } catch (error) {
        console.log(\`✗ Failed to load \${module}: \${error.message}\`);
      }
    });
  }
  
  // Test framework
  const TestRunner = {
    tests: [],
    results: {
      total: 0,
      passed: 0,
      failed: 0,
      errors: 0
    },
    
    addTest: function(name, testFn, description) {
      this.tests.push({
        name: name,
        fn: testFn,
        description: description || 'No description'
      });
    },
    
    runAllTests: function() {
      console.log('\\n=== UNIVERSAL CIPHER TESTING ===');
      console.log('Environment:', isNode ? 'Node.js' : 'Browser');
      
      if (typeof Cipher !== 'undefined' && Cipher.GetCiphers) {
        const availableCiphers = Cipher.GetCiphers();
        console.log('Available ciphers:', availableCiphers.length);
        console.log('');
      } else {
        console.log('❌ Cipher system not loaded properly');
        return;
      }
      
      console.log('=== Testing Individual Algorithms ===\\n');
      
      this.results = { total: 0, passed: 0, failed: 0, errors: 0 };
      
      this.tests.forEach(test => {
        this.runSingleTest(test);
      });
      
      this.printSummary();
      this.testCipherByCipher();
    },
    
    runSingleTest: function(test) {
      this.results.total++;
      
      try {
        const result = test.fn();
        if (result === true || (result && result.success === true)) {
          this.results.passed++;
          console.log(\`✓ \${test.name}: PASSED\`);
        } else {
          this.results.failed++;
          const error = result && result.error ? \` - \${result.error}\` : '';
          console.log(\`✗ \${test.name}: FAILED\${error}\`);
        }
      } catch (error) {
        this.results.errors++;
        console.log(\`❌ \${test.name}: ERROR - \${error.message}\`);
      }
    },
    
    printSummary: function() {
      console.log('\\n=== TEST SUMMARY ===');
      console.log(\`Total tests: \${this.results.total}\`);
      console.log(\`Passed: \${this.results.passed} (\${Math.round(this.results.passed/this.results.total*100) || 0}%)\`);
      console.log(\`Failed: \${this.results.failed} (\${Math.round(this.results.failed/this.results.total*100) || 0}%)\`);
      console.log(\`Errors: \${this.results.errors} (\${Math.round(this.results.errors/this.results.total*100) || 0}%)\`);
    },
    
    testCipherByCipher: function() {
      console.log('\\n=== CIPHER-BY-CIPHER RESULTS ===');
      
      if (typeof Cipher === 'undefined' || !Cipher.GetCiphers) {
        console.log('❌ Cipher system not available');
        return;
      }
      
      const availableCiphers = Cipher.GetCiphers();
      
      availableCiphers.forEach(cipherName => {
        try {
          const cipher = Cipher.GetCipher(cipherName);
          if (cipher) {
            console.log(\`✓ \${cipherName}: Available\`);
            
            // Basic functionality test
            if (cipher.Init) cipher.Init();
            if (cipher.KeySetup && cipher.EncryptBlock) {
              const keyId = cipher.KeySetup('testkey');
              if (keyId !== undefined) {
                console.log(\`  ✓ Key setup successful\`);
              } else {
                console.log(\`  ⚠️ Key setup returned undefined\`);
              }
            }
          } else {
            console.log(\`✗ \${cipherName}: Failed to retrieve cipher object\`);
          }
        } catch (error) {
          console.log(\`❌ \${cipherName}: \${error.message}\`);
        }
      });
    }
  };
  
  // Add some basic tests
  TestRunner.addTest('Caesar Cipher', function() {
    if (typeof Cipher === 'undefined' || !Cipher.GetCipher) {
      return { success: false, error: 'Cipher system not loaded' };
    }
    
    try {
      const caesar = Cipher.GetCipher('Caesar');
      if (!caesar) {
        return { success: false, error: 'Caesar cipher not found' };
      }
      
      if (caesar.Init) caesar.Init();
      const keyId = caesar.KeySetup('');
      const encrypted = caesar.EncryptBlock(keyId, 'HELLO');
      caesar.ClearData(keyId);
      
      return { success: encrypted === 'KHOOR' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, 'Test Caesar cipher with basic shift');
  
  TestRunner.addTest('Base64 Encoding', function() {
    if (typeof Cipher === 'undefined' || !Cipher.GetCipher) {
      return { success: false, error: 'Cipher system not loaded' };
    }
    
    try {
      const base64 = Cipher.GetCipher('BASE64');
      if (!base64) {
        return { success: false, error: 'BASE64 encoder not found' };
      }
      
      if (base64.Init) base64.Init();
      const keyId = base64.KeySetup('');
      const encoded = base64.EncryptBlock(keyId, 'hello');
      base64.ClearData(keyId);
      
      return { success: encoded === 'aGVsbG8=' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, 'Test Base64 encoding');
  
  // Export for both environments
  if (isNode) {
    module.exports = TestRunner;
    
    // Auto-run if this is the main module
    if (require.main === module) {
      TestRunner.runAllTests();
    }
  } else {
    global.TestRunner = TestRunner;
  }
  
})(typeof global !== 'undefined' ? global : window);`;

  // Write the updated test runner
  fs.writeFileSync(testRunnerPath, newContent, 'utf8');
  
  console.log('✅ universal-test-runner.js updated successfully');
  console.log(`📁 Auto-discovering ${cipherModules.length} algorithm modules from categorized structure`);
}

if (require.main === module) {
  updateTestRunner();
}

module.exports = { updateTestRunner };