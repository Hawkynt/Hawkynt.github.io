#!/usr/bin/env node
/*
 * Language Conversion Test System
 * Validates multi-language code generation functionality
 * (c)2006-2025 Hawkynt
 */

(function(global) {
  'use strict';
  
  // Load code generation system
  try {
    require('../code-generation-interface.js');
  } catch (e) {
    console.error('Failed to load code generation system:', e.message);
    process.exit(1);
  }
  
  const LanguageConversionTest = {
    
    testResults: [],
    supportedLanguages: ['python', 'cpp', 'java', 'rust', 'csharp', 'kotlin', 'delphi', 'freebasic', 'perl'],
    testAlgorithms: ['Caesar', 'AES', 'ChaCha20', 'SHA256', 'Base64'],
    
    // Test code generation for all languages
    testAllLanguages: function() {
      console.log('Language Conversion Test Suite');
      console.log('==============================');
      
      const startTime = Date.now();
      let totalTests = 0;
      let passedTests = 0;
      
      this.supportedLanguages.forEach(language => {
        console.log(`\n=== Testing ${language.toUpperCase()} Code Generation ===`);
        
        this.testAlgorithms.forEach(algorithm => {
          totalTests++;
          
          try {
            const result = this.testLanguageGeneration(language, algorithm);
            if (result.success) {
              passedTests++;
              console.log(`✓ ${algorithm} → ${language}`);
            } else {
              console.log(`✗ ${algorithm} → ${language}: ${result.error}`);
            }
            
            this.testResults.push({
              language: language,
              algorithm: algorithm,
              success: result.success,
              error: result.error,
              codeLength: result.codeLength,
              generationTime: result.generationTime
            });
          } catch (e) {
            console.log(`✗ ${algorithm} → ${language}: Exception - ${e.message}`);
            this.testResults.push({
              language: language,
              algorithm: algorithm,
              success: false,
              error: e.message,
              codeLength: 0,
              generationTime: 0
            });
          }
        });
      });
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Generate summary
      console.log('\n==============================');
      console.log('Code Generation Summary:');
      console.log(`Total Tests: ${totalTests}`);
      console.log(`Passed: ${passedTests}`);
      console.log(`Failed: ${totalTests - passedTests}`);
      console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
      console.log(`Total Time: ${totalTime}ms`);
      
      this.generateDetailedReport();
      
      return {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
        successRate: (passedTests / totalTests) * 100,
        totalTime: totalTime,
        results: this.testResults
      };
    },
    
    // Test code generation for specific language/algorithm combination
    testLanguageGeneration: function(language, algorithm) {
      const startTime = Date.now();
      
      try {
        if (!global.CodeGenerationInterface) {
          return { success: false, error: 'CodeGenerationInterface not available' };
        }
        
        const methodName = `generate${language.charAt(0).toUpperCase() + language.slice(1)}`;
        const generator = global.CodeGenerationInterface[methodName];
        
        if (typeof generator !== 'function') {
          return { success: false, error: `Generator method ${methodName} not found` };
        }
        
        const options = this.getTestOptions(algorithm);
        const generatedCode = generator.call(global.CodeGenerationInterface, algorithm, `${algorithm} Algorithm`, options);
        
        const endTime = Date.now();
        const generationTime = endTime - startTime;
        
        // Validate generated code
        const validation = this.validateGeneratedCode(language, algorithm, generatedCode);
        
        return {
          success: validation.success,
          error: validation.error,
          codeLength: generatedCode ? generatedCode.length : 0,
          generationTime: generationTime,
          code: generatedCode
        };
      } catch (e) {
        const endTime = Date.now();
        return {
          success: false,
          error: e.message,
          codeLength: 0,
          generationTime: endTime - startTime
        };
      }
    },
    
    // Get test options for specific algorithm
    getTestOptions: function(algorithm) {
      const baseOptions = {
        includeTests: true,
        includeDocumentation: true,
        optimizeForReadability: true
      };
      
      switch (algorithm.toLowerCase()) {
        case 'caesar':
          return { ...baseOptions, keySize: 1, blockSize: 1 };
        case 'aes':
          return { ...baseOptions, keySize: 256, blockSize: 128 };
        case 'chacha20':
          return { ...baseOptions, keySize: 256, streamCipher: true };
        case 'sha256':
          return { ...baseOptions, hashFunction: true, outputSize: 256 };
        case 'base64':
          return { ...baseOptions, encoding: true };
        default:
          return baseOptions;
      }
    },
    
    // Validate generated code quality
    validateGeneratedCode: function(language, algorithm, code) {
      if (!code || typeof code !== 'string') {
        return { success: false, error: 'No code generated' };
      }
      
      if (code.length < 50) {
        return { success: false, error: 'Generated code too short' };
      }
      
      // Language-specific validations
      const validations = {
        python: this.validatePythonCode,
        cpp: this.validateCppCode,
        java: this.validateJavaCode,
        rust: this.validateRustCode,
        csharp: this.validateCSharpCode,
        kotlin: this.validateKotlinCode,
        delphi: this.validateDelphiCode,
        freebasic: this.validateFreeBASICCode,
        perl: this.validatePerlCode
      };
      
      const validator = validations[language];
      if (validator) {
        return validator.call(this, algorithm, code);
      }
      
      // Default validation
      return this.validateGenericCode(algorithm, code);
    },
    
    // Python code validation
    validatePythonCode: function(algorithm, code) {
      const requiredPatterns = [
        /class\s+\w+/,  // Class definition
        /def\s+\w+/,    // Method definition
        /import\s+/     // Import statement
      ];
      
      for (const pattern of requiredPatterns) {
        if (!pattern.test(code)) {
          return { success: false, error: `Missing required Python pattern: ${pattern}` };
        }
      }
      
      if (code.includes('TODO') || code.includes('PLACEHOLDER')) {
        return { success: false, error: 'Code contains placeholders' };
      }
      
      return { success: true };
    },
    
    // C++ code validation
    validateCppCode: function(algorithm, code) {
      const requiredPatterns = [
        /#include\s*<\w+>/,  // Include directive
        /class\s+\w+/,       // Class definition
        /public:/,           // Public access modifier
        /\w+::\w+/          // Scope resolution
      ];
      
      for (const pattern of requiredPatterns) {
        if (!pattern.test(code)) {
          return { success: false, error: `Missing required C++ pattern: ${pattern}` };
        }
      }
      
      return { success: true };
    },
    
    // Java code validation
    validateJavaCode: function(algorithm, code) {
      const requiredPatterns = [
        /public\s+class\s+\w+/,  // Public class
        /public\s+\w+\s+\w+\(/,  // Public method
        /import\s+java\./        // Java import
      ];
      
      for (const pattern of requiredPatterns) {
        if (!pattern.test(code)) {
          return { success: false, error: `Missing required Java pattern: ${pattern}` };
        }
      }
      
      return { success: true };
    },
    
    // Rust code validation
    validateRustCode: function(algorithm, code) {
      const requiredPatterns = [
        /pub\s+(struct|enum|fn)/,  // Public declaration
        /fn\s+\w+/,                // Function definition
        /impl\s+\w+/               // Implementation block
      ];
      
      for (const pattern of requiredPatterns) {
        if (!pattern.test(code)) {
          return { success: false, error: `Missing required Rust pattern: ${pattern}` };
        }
      }
      
      return { success: true };
    },
    
    // C# code validation
    validateCSharpCode: function(algorithm, code) {
      const requiredPatterns = [
        /public\s+class\s+\w+/,     // Public class
        /namespace\s+\w+/,          // Namespace
        /public\s+\w+\s+\w+\(/     // Public method
      ];
      
      for (const pattern of requiredPatterns) {
        if (!pattern.test(code)) {
          return { success: false, error: `Missing required C# pattern: ${pattern}` };
        }
      }
      
      return { success: true };
    },
    
    // Kotlin code validation
    validateKotlinCode: function(algorithm, code) {
      const requiredPatterns = [
        /class\s+\w+/,      // Class definition
        /fun\s+\w+/,        // Function definition
        /package\s+\w+/     // Package declaration
      ];
      
      for (const pattern of requiredPatterns) {
        if (!pattern.test(code)) {
          return { success: false, error: `Missing required Kotlin pattern: ${pattern}` };
        }
      }
      
      return { success: true };
    },
    
    // Delphi code validation
    validateDelphiCode: function(algorithm, code) {
      const requiredPatterns = [
        /unit\s+\w+/,           // Unit declaration
        /interface/,            // Interface section
        /implementation/,       // Implementation section
        /class\s*\(\w+\)/      // Class with inheritance
      ];
      
      for (const pattern of requiredPatterns) {
        if (!pattern.test(code)) {
          return { success: false, error: `Missing required Delphi pattern: ${pattern}` };
        }
      }
      
      return { success: true };
    },
    
    // FreeBASIC code validation
    validateFreeBASICCode: function(algorithm, code) {
      const requiredPatterns = [
        /Type\s+\w+/,       // Type definition
        /Function\s+\w+/,   // Function definition
        /End\s+Type/        // End type
      ];
      
      for (const pattern of requiredPatterns) {
        if (!pattern.test(code)) {
          return { success: false, error: `Missing required FreeBASIC pattern: ${pattern}` };
        }
      }
      
      return { success: true };
    },
    
    // Perl code validation
    validatePerlCode: function(algorithm, code) {
      const requiredPatterns = [
        /package\s+\w+/,    // Package declaration
        /sub\s+\w+/,        // Subroutine definition
        /use\s+strict/      // Strict pragma
      ];
      
      for (const pattern of requiredPatterns) {
        if (!pattern.test(code)) {
          return { success: false, error: `Missing required Perl pattern: ${pattern}` };
        }
      }
      
      return { success: true };
    },
    
    // Generic code validation
    validateGenericCode: function(algorithm, code) {
      // Check for algorithm name in code
      const algorithmPattern = new RegExp(algorithm, 'i');
      if (!algorithmPattern.test(code)) {
        return { success: false, error: 'Algorithm name not found in generated code' };
      }
      
      // Check for basic structure
      if (!code.includes('{') && !code.includes('begin') && !code.includes(':')) {
        return { success: false, error: 'Code lacks basic structure' };
      }
      
      return { success: true };
    },
    
    // Generate detailed report
    generateDetailedReport: function() {
      console.log('\n=== Detailed Code Generation Report ===');
      
      // Report by language
      const byLanguage = {};
      this.testResults.forEach(result => {
        if (!byLanguage[result.language]) {
          byLanguage[result.language] = { passed: 0, failed: 0, total: 0, totalTime: 0 };
        }
        
        byLanguage[result.language].total++;
        byLanguage[result.language].totalTime += result.generationTime;
        
        if (result.success) {
          byLanguage[result.language].passed++;
        } else {
          byLanguage[result.language].failed++;
        }
      });
      
      console.log('\nResults by Language:');
      Object.entries(byLanguage).forEach(([language, stats]) => {
        const rate = ((stats.passed / stats.total) * 100).toFixed(1);
        const avgTime = (stats.totalTime / stats.total).toFixed(1);
        console.log(`  ${language}: ${stats.passed}/${stats.total} (${rate}%) - Avg: ${avgTime}ms`);
      });
      
      // Report by algorithm
      const byAlgorithm = {};
      this.testResults.forEach(result => {
        if (!byAlgorithm[result.algorithm]) {
          byAlgorithm[result.algorithm] = { passed: 0, failed: 0, total: 0 };
        }
        
        byAlgorithm[result.algorithm].total++;
        if (result.success) {
          byAlgorithm[result.algorithm].passed++;
        } else {
          byAlgorithm[result.algorithm].failed++;
        }
      });
      
      console.log('\nResults by Algorithm:');
      Object.entries(byAlgorithm).forEach(([algorithm, stats]) => {
        const rate = ((stats.passed / stats.total) * 100).toFixed(1);
        console.log(`  ${algorithm}: ${stats.passed}/${stats.total} (${rate}%)`);
      });
      
      // Show failures
      const failures = this.testResults.filter(r => !r.success);
      if (failures.length > 0) {
        console.log('\nFailures:');
        failures.forEach(failure => {
          console.log(`  ${failure.algorithm} → ${failure.language}: ${failure.error}`);
        });
      }
    }
  };
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LanguageConversionTest;
  }
  
  // Auto-run if called directly
  if (typeof require !== 'undefined' && require.main === module) {
    LanguageConversionTest.testAllLanguages();
  }
  
  // Export to global scope
  global.LanguageConversionTest = LanguageConversionTest;
  
})(typeof global !== 'undefined' ? global : window);