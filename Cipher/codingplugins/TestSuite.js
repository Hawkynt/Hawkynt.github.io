#!/usr/bin/env node

/**
 * 🧪 Cipher Coding Plugins Test Suite
 * Comprehensive testing framework for language plugins
 * 
 * Usage:
 *   node TestCodingPluginsSuite.js                    # Test all plugins
 *   node TestCodingPluginsSuite.js python.js          # Test specific plugin
 *   node TestCodingPluginsSuite.js --verbose          # Verbose output
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Test configuration
const config = {
  pluginDir: path.resolve(__dirname),
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  specificFile: process.argv.find(arg => arg.endsWith('.js') && !arg.includes('Test')),
  timeout: 5000 // 5 second timeout for plugin operations
};

/**
 * Test result structure
 * @typedef {Object} TestResult
 * @property {string} file - Plugin filename
 * @property {boolean} syntaxValid - JavaScript syntax is valid
 * @property {boolean} loadable - Can be required without errors
 * @property {boolean} registered - Plugin registered successfully
 * @property {boolean} astProcessing - AST processing works
 * @property {Object|null} pluginInfo - Plugin metadata
 * @property {string|null} generatedCode - Sample generated code
 * @property {Array<string>} errors - Error messages
 * @property {Array<string>} warnings - Warning messages
 * @property {number} testDuration - Test duration in milliseconds
 */

/**
 * Sample AST for testing plugin code generation
 */
const sampleAST = {
  type: 'Program',
  body: [
    {
      type: 'FunctionDeclaration',
      id: { type: 'Identifier', name: 'simpleFunction' },
      params: [
        { type: 'Identifier', name: 'input' }
      ],
      body: {
        type: 'BlockStatement',
        body: [
          {
            type: 'VariableDeclaration',
            declarations: [
              {
                type: 'VariableDeclarator',
                id: { type: 'Identifier', name: 'result' },
                init: {
                  type: 'BinaryExpression',
                  operator: '+',
                  left: { type: 'Identifier', name: 'input' },
                  right: { type: 'Literal', value: 42 }
                }
              }
            ],
            kind: 'const'
          },
          {
            type: 'ReturnStatement',
            argument: { type: 'Identifier', name: 'result' }
          }
        ]
      }
    }
  ]
};

/**
 * Main test suite class
 */
class TestCodingPluginsSuite {
  constructor() {
    this.results = [];
    this.stats = {
      total: 0,
      passed: 0,
      failed: 0,
      syntaxErrors: 0,
      loadErrors: 0,
      registrationErrors: 0,
      astErrors: 0
    };
  }

  /**
   * Log message with color and optional verbose filtering
   */
  log(message, color = 'reset', verboseOnly = false) {
    if (verboseOnly && !config.verbose) return;
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  /**
   * Find all JavaScript files in the plugins directory
   */
  findPluginFiles() {
    try {
      const files = fs.readdirSync(config.pluginDir)
        .filter(file => file.endsWith('.js'))
        .filter(file => !file.includes('Test') && file !== 'LanguagePlugin.js')
        .filter(file => !file.startsWith('demo-')) // Exclude demo files
        .map(file => path.join(config.pluginDir, file));

      if (config.specificFile) {
        const specificPath = path.resolve(config.pluginDir, config.specificFile);
        if (fs.existsSync(specificPath)) {
          return [specificPath];
        } else {
          this.log(`❌ Specific file not found: ${config.specificFile}`, 'red');
          return [];
        }
      }

      return files;
    } catch (error) {
      this.log(`❌ Error reading plugin directory: ${error.message}`, 'red');
      return [];
    }
  }

  /**
   * Check JavaScript syntax validity using Node.js
   */
  checkSyntax(filePath) {
    try {
      execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
      return { valid: true, error: null };
    } catch (error) {
      return { valid: false, error: error.stderr?.toString() || error.message };
    }
  }

  /**
   * Attempt to require and test a plugin file
   */
  async testPlugin(filePath) {
    const startTime = Date.now();
    const fileName = path.basename(filePath);
    
    const result = {
      file: fileName,
      syntaxValid: false,
      loadable: false,
      registered: false,
      astProcessing: false,
      pluginInfo: null,
      generatedCode: null,
      errors: [],
      warnings: [],
      testDuration: 0
    };

    this.log(`\n🔍 Testing plugin: ${fileName}`, 'cyan');

    try {
      // Step 1: Check syntax
      this.log('  1. Checking JavaScript syntax...', 'blue', true);
      const syntaxCheck = this.checkSyntax(filePath);
      if (syntaxCheck.valid) {
        result.syntaxValid = true;
        this.log('    ✅ Syntax valid', 'green', true);
      } else {
        result.syntaxValid = false;
        result.errors.push(`Syntax error: ${syntaxCheck.error}`);
        this.log('    ❌ Syntax invalid', 'red', true);
        this.stats.syntaxErrors++;
        return result;
      }

      // Step 2: Clear module cache and require LanguagePlugin framework
      delete require.cache[require.resolve('./LanguagePlugin.js')];
      const { LanguagePlugin, LanguagePlugins } = require('./LanguagePlugin.js');
      
      // Clear previous plugins for clean test
      LanguagePlugins.Clear();

      // Step 3: Attempt to load the plugin
      this.log('  2. Loading plugin module...', 'blue', true);
      try {
        delete require.cache[require.resolve(filePath)];
        require(filePath);
        result.loadable = true;
        this.log('    ✅ Module loaded successfully', 'green', true);
      } catch (error) {
        result.loadable = false;
        result.errors.push(`Load error: ${error.message}`);
        this.log(`    ❌ Load failed: ${error.message}`, 'red', true);
        this.stats.loadErrors++;
        return result;
      }

      // Step 4: Check if plugin registered itself
      this.log('  3. Checking plugin registration...', 'blue', true);
      const registeredPlugins = LanguagePlugins.GetAll();
      if (registeredPlugins.length > 0) {
        result.registered = true;
        result.pluginInfo = registeredPlugins[0].getInfo();
        this.log(`    ✅ Plugin registered: ${result.pluginInfo.name}`, 'green', true);
        
        // Step 5: Test AST processing
        this.log('  4. Testing AST processing...', 'blue', true);
        try {
          const plugin = registeredPlugins[0];
          const astResult = plugin.GenerateFromAST(sampleAST, {});
          
          if (astResult && typeof astResult === 'object') {
            result.astProcessing = true;
            result.generatedCode = astResult.code || null;
            
            if (astResult.success) {
              this.log('    ✅ AST processing successful', 'green', true);
            } else {
              this.log(`    ⚠️ AST processing returned failure: ${astResult.error}`, 'yellow', true);
              result.warnings.push(`AST processing returned failure: ${astResult.error}`);
            }
            
            if (astResult.warnings && astResult.warnings.length > 0) {
              result.warnings.push(...astResult.warnings);
            }
          } else {
            result.astProcessing = false;
            result.errors.push('AST processing returned invalid result structure');
            this.log('    ❌ AST processing returned invalid result', 'red', true);
          }
        } catch (error) {
          result.astProcessing = false;
          result.errors.push(`AST processing error: ${error.message}`);
          this.log(`    ❌ AST processing failed: ${error.message}`, 'red', true);
          this.stats.astErrors++;
        }
      } else {
        result.registered = false;
        result.errors.push('Plugin did not register itself with LanguagePlugins');
        this.log('    ❌ No plugin registered', 'red', true);
        this.stats.registrationErrors++;
      }

    } catch (error) {
      result.errors.push(`Unexpected error: ${error.message}`);
      this.log(`    ❌ Unexpected error: ${error.message}`, 'red');
    }

    result.testDuration = Date.now() - startTime;
    
    // Determine overall success
    const success = result.syntaxValid && result.loadable && result.registered && result.astProcessing;
    if (success) {
      this.stats.passed++;
      this.log(`✅ ${fileName} - All tests passed`, 'green');
    } else {
      this.stats.failed++;
      this.log(`❌ ${fileName} - Tests failed`, 'red');
    }

    return result;
  }

  /**
   * Generate detailed test report
   */
  generateReport() {
    this.log('\n' + '='.repeat(80), 'cyan');
    this.log('📊 CODING PLUGINS TEST REPORT', 'bright');
    this.log('='.repeat(80), 'cyan');

    // Overall statistics
    this.log(`\n📈 Overall Statistics:`, 'bright');
    this.log(`   Total plugins tested: ${this.stats.total}`, 'blue');
    this.log(`   Passed: ${this.stats.passed}`, 'green');
    this.log(`   Failed: ${this.stats.failed}`, 'red');
    this.log(`   Success rate: ${this.stats.total > 0 ? Math.round((this.stats.passed / this.stats.total) * 100) : 0}%`, 'yellow');

    // Error breakdown
    if (this.stats.failed > 0) {
      this.log(`\n❌ Error Breakdown:`, 'bright');
      if (this.stats.syntaxErrors > 0) this.log(`   Syntax errors: ${this.stats.syntaxErrors}`, 'red');
      if (this.stats.loadErrors > 0) this.log(`   Load errors: ${this.stats.loadErrors}`, 'red');
      if (this.stats.registrationErrors > 0) this.log(`   Registration errors: ${this.stats.registrationErrors}`, 'red');
      if (this.stats.astErrors > 0) this.log(`   AST processing errors: ${this.stats.astErrors}`, 'red');
    }

    // Detailed results
    this.log(`\n📋 Detailed Results:`, 'bright');
    this.results.forEach(result => {
      const status = (result.syntaxValid && result.loadable && result.registered && result.astProcessing) ? '✅' : '❌';
      this.log(`\n${status} ${result.file}`, 'cyan');
      
      if (result.pluginInfo) {
        this.log(`     Name: ${result.pluginInfo.name}`, 'blue');
        this.log(`     Extension: .${result.pluginInfo.extension}`, 'blue');
        this.log(`     Version: ${result.pluginInfo.version}`, 'blue');
        this.log(`     Description: ${result.pluginInfo.description}`, 'blue');
      }
      
      this.log(`     Syntax: ${result.syntaxValid ? '✅' : '❌'}`, result.syntaxValid ? 'green' : 'red');
      this.log(`     Loadable: ${result.loadable ? '✅' : '❌'}`, result.loadable ? 'green' : 'red');
      this.log(`     Registered: ${result.registered ? '✅' : '❌'}`, result.registered ? 'green' : 'red');
      this.log(`     AST Processing: ${result.astProcessing ? '✅' : '❌'}`, result.astProcessing ? 'green' : 'red');
      this.log(`     Test Duration: ${result.testDuration}ms`, 'blue');
      
      if (result.generatedCode && config.verbose) {
        this.log(`     Generated Code Preview:`, 'magenta');
        const preview = result.generatedCode.substring(0, 200);
        this.log(`     ${preview}${result.generatedCode.length > 200 ? '...' : ''}`, 'magenta');
      }
      
      if (result.errors.length > 0) {
        this.log(`     Errors:`, 'red');
        result.errors.forEach(error => this.log(`       • ${error}`, 'red'));
      }
      
      if (result.warnings.length > 0) {
        this.log(`     Warnings:`, 'yellow');
        result.warnings.forEach(warning => this.log(`       • ${warning}`, 'yellow'));
      }
    });

    // Plugin registry statistics - reload all successful plugins for accurate count
    try {
      // Clear and reload all successful plugins for accurate statistics
      delete require.cache[require.resolve('./LanguagePlugin.js')];
      const { LanguagePlugin, LanguagePlugins } = require('./LanguagePlugin.js');
      LanguagePlugins.Clear();
      
      // Load all successful plugins
      const successfulPlugins = this.results.filter(r => r.syntaxValid && r.loadable && r.registered);
      successfulPlugins.forEach(result => {
        try {
          const pluginPath = path.resolve(config.pluginDir, result.file);
          delete require.cache[require.resolve(pluginPath)];
          require(pluginPath);
        } catch (error) {
          // Ignore load errors for statistics
        }
      });
      
      const registryStats = LanguagePlugins.GetStats();
      
      this.log(`\n🗂️ Plugin Registry Statistics:`, 'bright');
      this.log(`   Total registered plugins: ${registryStats.totalPlugins}`, 'blue');
      this.log(`   Unique extensions: ${registryStats.totalExtensions}`, 'blue');
      this.log(`   Supported extensions: ${registryStats.extensions.join(', ')}`, 'blue');
      
      if (registryStats.conflictingExtensions.length > 0) {
        this.log(`   Extension conflicts: ${registryStats.conflictingExtensions.map(([ext, count]) => `${ext}(${count})`).join(', ')}`, 'yellow');
      }
    } catch (error) {
      this.log(`   ⚠️ Could not retrieve registry statistics: ${error.message}`, 'yellow');
    }

    this.log('\n' + '='.repeat(80), 'cyan');
  }

  /**
   * Run the complete test suite
   */
  async run() {
    this.log('🚀 Starting Coding Plugins Test Suite', 'bright');
    this.log(`📁 Plugin directory: ${config.pluginDir}`, 'blue');
    
    if (config.specificFile) {
      this.log(`🎯 Testing specific file: ${config.specificFile}`, 'yellow');
    }
    
    if (config.verbose) {
      this.log(`🔍 Verbose mode enabled`, 'yellow');
    }

    const pluginFiles = this.findPluginFiles();
    
    if (pluginFiles.length === 0) {
      this.log('❌ No plugin files found to test', 'red');
      return;
    }

    this.log(`\n📦 Found ${pluginFiles.length} plugin file(s) to test`, 'green');
    this.stats.total = pluginFiles.length;

    // Test each plugin
    for (const filePath of pluginFiles) {
      const result = await this.testPlugin(filePath);
      this.results.push(result);
    }

    // Generate final report
    this.generateReport();

    // Exit with appropriate code
    const exitCode = this.stats.failed > 0 ? 1 : 0;
    this.log(`\n🏁 Test suite completed with exit code: ${exitCode}`, exitCode === 0 ? 'green' : 'red');
    process.exit(exitCode);
  }
}

// Run the test suite if this file is executed directly
if (require.main === module) {
  const testSuite = new TestCodingPluginsSuite();
  testSuite.run().catch(error => {
    console.error(`💥 Test suite crashed: ${error.message}`);
    console.error(error.stack);
    process.exit(2);
  });
}

module.exports = TestCodingPluginsSuite;
