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
 * @property {boolean} codeValidation - Generated code is syntactically valid
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
      astErrors: 0,
      codeValidationErrors: 0
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
   * Get compiler/interpreter download information
   */
  getCompilerDownloadInfo(language) {
    const downloadInfo = {
      python: {
        name: 'Python',
        url: 'https://www.python.org/downloads/',
        instructions: 'Download Python from python.org and ensure it\'s in your PATH'
      },
      java: {
        name: 'Java Development Kit (JDK)',
        url: 'https://www.oracle.com/java/technologies/downloads/',
        instructions: 'Download JDK from Oracle or use OpenJDK. Ensure javac is in your PATH'
      },
      csharp: {
        name: '.NET SDK',
        url: 'https://dotnet.microsoft.com/download',
        instructions: 'Download .NET SDK from Microsoft. Includes dotnet CLI and csc compiler'
      },
      cpp: {
        name: 'C++ Compiler (GCC/Clang)',
        url: 'https://gcc.gnu.org/ or https://clang.llvm.org/',
        instructions: 'Install GCC via build-tools or Clang. On Windows: Visual Studio Build Tools'
      },
      c: {
        name: 'C Compiler (GCC/Clang)',
        url: 'https://gcc.gnu.org/ or https://clang.llvm.org/',
        instructions: 'Install GCC via build-tools or Clang. On Windows: Visual Studio Build Tools'
      },
      go: {
        name: 'Go Programming Language',
        url: 'https://golang.org/dl/',
        instructions: 'Download Go from golang.org and ensure it\'s in your PATH'
      },
      rust: {
        name: 'Rust',
        url: 'https://rustup.rs/',
        instructions: 'Install Rust via rustup.rs. Includes rustc compiler and cargo package manager'
      },
      kotlin: {
        name: 'Kotlin Compiler',
        url: 'https://kotlinlang.org/docs/command-line.html',
        instructions: 'Download Kotlin compiler or install via SDKMAN/Homebrew'
      },
      typescript: {
        name: 'TypeScript Compiler',
        url: 'https://www.typescriptlang.org/download',
        instructions: 'Install via npm: npm install -g typescript'
      },
      php: {
        name: 'PHP',
        url: 'https://www.php.net/downloads.php',
        instructions: 'Download PHP from php.net and ensure it\'s in your PATH'
      },
      ruby: {
        name: 'Ruby',
        url: 'https://www.ruby-lang.org/en/downloads/',
        instructions: 'Download Ruby from ruby-lang.org and ensure it\'s in your PATH'
      },
      perl: {
        name: 'Perl',
        url: 'https://www.perl.org/get.html',
        instructions: 'Download Perl from perl.org. On Windows: Strawberry Perl recommended'
      },
      pascal: {
        name: 'Free Pascal Compiler',
        url: 'https://www.freepascal.org/download.html',
        instructions: 'Download Free Pascal compiler (fpc) from freepascal.org'
      },
      basic: {
        name: 'FreeBASIC Compiler',
        url: 'https://www.freebasic.net/wiki/CompilerInstalling',
        instructions: 'Download FreeBASIC compiler (fbc) from freebasic.net'
      }
    };
    
    return downloadInfo[language.toLowerCase()] || {
      name: `${language} compiler`,
      url: 'https://www.google.com/search?q=' + encodeURIComponent(language + ' compiler download'),
      instructions: `Search for ${language} compiler installation instructions`
    };
  }

  /**
   * Validate generated code syntax for specific languages
   * @param {string} code - Generated code to validate
   * @param {string} language - Target language (from plugin extension)
   * @returns {Object} Validation result with success flag and error message
   */
  validateGeneratedCodeSyntax(code, language) {
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return { valid: false, error: 'No code generated or empty code' };
    }

    try {
      switch (language.toLowerCase()) {
        case 'js':
        case 'javascript':
          return this.validateJavaScriptSyntax(code);
        
        case 'py':
        case 'python':
          return this.validatePythonSyntax(code);
        
        case 'java':
          return this.validateJavaSyntax(code);
        
        case 'cs':
        case 'csharp':
          return this.validateCSharpSyntax(code);
        
        case 'cpp':
        case 'c++':
        case 'cxx':
          return this.validateCppSyntax(code);
        
        case 'c':
          return this.validateCSyntax(code);
        
        case 'go':
          return this.validateGoSyntax(code);
        
        case 'rs':
        case 'rust':
          return this.validateRustSyntax(code);
        
        case 'kt':
        case 'kotlin':
          return this.validateKotlinSyntax(code);
        
        case 'ts':
        case 'typescript':
          return this.validateTypeScriptSyntax(code);
        
        case 'php':
          return this.validatePhpSyntax(code);
        
        case 'rb':
        case 'ruby':
          return this.validateRubySyntax(code);
        
        case 'pl':
        case 'perl':
          return this.validatePerlSyntax(code);
        
        case 'pas':
        case 'delphi':
        case 'pascal':
          return this.validatePascalSyntax(code);
        
        case 'bas':
        case 'basic':
        case 'freebasic':
          return this.validateBasicSyntax(code);
        
        default:
          // For unknown languages, perform basic checks
          return this.performBasicCodeValidation(code);
      }
    } catch (error) {
      return { valid: false, error: `Validation error: ${error.message}` };
    }
  }

  /**
   * Show compiler missing warning with download information
   */
  showCompilerMissingWarning(language, compilerName) {
    const downloadInfo = this.getCompilerDownloadInfo(language);
    
    this.log(`    ⚠️ ${compilerName} not found - falling back to basic validation`, 'yellow', true);
    this.log(`    💡 To enable full syntax validation for ${language.toUpperCase()}:`, 'cyan', true);
    this.log(`       Download: ${downloadInfo.name}`, 'blue', true);
    this.log(`       URL: ${downloadInfo.url}`, 'blue', true);
    this.log(`       Instructions: ${downloadInfo.instructions}`, 'blue', true);
  }

  /**
   * Validate JavaScript syntax
   */
  validateJavaScriptSyntax(code) {
    try {
      // Write to temp file and use node --check
      const tempFile = path.join(__dirname, '.tmp_js_validation.js');
      fs.writeFileSync(tempFile, code);
      
      try {
        execSync(`node --check "${tempFile}"`, { stdio: 'pipe', timeout: 5000 });
        fs.unlinkSync(tempFile);
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `File operation failed: ${error.message}` };
    }
  }

  /**
   * Validate Python syntax
   */
  validatePythonSyntax(code) {
    try {
      // Use python -c "compile(code, '<string>', 'exec')" for faster validation
      let pythonCmd = 'python';
      
      // Try to find python command
      try {
        execSync('python --version', { stdio: 'pipe' });
      } catch {
        try {
          execSync('python3 --version', { stdio: 'pipe' });
          pythonCmd = 'python3';
        } catch {
          return { valid: false, error: 'Python interpreter not found in PATH' };
        }
      }
      
      // Use temp file approach for reliability
      const tempFile = path.join(__dirname, '.tmp_py_validation.py');
      fs.writeFileSync(tempFile, code);
      
      try {
        execSync(`${pythonCmd} -m py_compile "${tempFile}"`, { stdio: 'pipe', timeout: 5000 });
        fs.unlinkSync(tempFile);
        
        // Clean up .pyc file if created  
        const pycFile = tempFile + 'c';
        if (fs.existsSync(pycFile)) fs.unlinkSync(pycFile);
        
        return { valid: true, error: null };
      } catch (error) {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `Python validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate Java syntax
   */
  validateJavaSyntax(code) {
    try {
      // Extract class name from code or use default
      const classNameMatch = code.match(/public\s+class\s+(\w+)/);
      const className = classNameMatch ? classNameMatch[1] : 'GeneratedCode';
      
      const tempFile = path.join(__dirname, `.tmp_${className}.java`);
      fs.writeFileSync(tempFile, code);
      
      try {
        execSync(`javac "${tempFile}"`, { stdio: 'pipe' });
        
        // Clean up compiled files
        fs.unlinkSync(tempFile);
        const classFile = path.join(__dirname, `${className}.class`);
        if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        // Fallback to basic validation if compiler not available
        if (error.message.includes('javac') && (error.message.includes('not found') || error.message.includes('not recognized'))) {
          return this.performBasicCodeValidation(code);
        }
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `Java validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate C# syntax
   */
  validateCSharpSyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_cs_validation.cs');
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try dotnet first, then csc
        try {
          execSync(`dotnet build "${tempFile}"`, { stdio: 'pipe' });
        } catch {
          execSync(`csc /nologo /t:library "${tempFile}"`, { stdio: 'pipe' });
        }
        
        fs.unlinkSync(tempFile);
        
        // Clean up any generated files
        const dllFile = tempFile.replace('.cs', '.dll');
        const exeFile = tempFile.replace('.cs', '.exe');
        if (fs.existsSync(dllFile)) fs.unlinkSync(dllFile);
        if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        // Fallback to basic validation if compiler not available
        if ((error.message.includes('dotnet') || error.message.includes('csc')) && 
            (error.message.includes('not found') || error.message.includes('not recognized'))) {
          return this.performBasicCodeValidation(code);
        }
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `C# validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate C++ syntax
   */
  validateCppSyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_cpp_validation.cpp');
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try g++ first, then clang++
        let compiler = 'g++';
        try {
          execSync('g++ --version', { stdio: 'pipe' });
        } catch {
          compiler = 'clang++';
        }
        
        execSync(`${compiler} -fsyntax-only -std=c++17 "${tempFile}"`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `C++ validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate C syntax
   */
  validateCSyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_c_validation.c');
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try gcc first, then clang
        let compiler = 'gcc';
        try {
          execSync('gcc --version', { stdio: 'pipe' });
        } catch {
          compiler = 'clang';
        }
        
        execSync(`${compiler} -fsyntax-only -std=c11 "${tempFile}"`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `C validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate Go syntax
   */
  validateGoSyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_go_validation.go');
      fs.writeFileSync(tempFile, code);
      
      try {
        execSync(`go build -o /dev/null "${tempFile}"`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `Go validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate Rust syntax
   */
  validateRustSyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_rust_validation.rs');
      fs.writeFileSync(tempFile, code);
      
      try {
        execSync(`rustc --crate-type lib "${tempFile}" -o /dev/null`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `Rust validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate Kotlin syntax
   */
  validateKotlinSyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_kotlin_validation.kt');
      fs.writeFileSync(tempFile, code);
      
      try {
        execSync(`kotlinc "${tempFile}"`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        // Clean up generated class files
        const files = fs.readdirSync(__dirname);
        files.forEach(file => {
          if (file.startsWith('Tmp_kotlin_validation') && file.endsWith('.class')) {
            fs.unlinkSync(path.join(__dirname, file));
          }
        });
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `Kotlin validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate TypeScript syntax
   */
  validateTypeScriptSyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_ts_validation.ts');
      fs.writeFileSync(tempFile, code);
      
      try {
        execSync(`tsc --noEmit "${tempFile}"`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `TypeScript validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate PHP syntax
   */
  validatePhpSyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_php_validation.php');
      fs.writeFileSync(tempFile, code);
      
      try {
        execSync(`php -l "${tempFile}"`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `PHP validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate Ruby syntax
   */
  validateRubySyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_ruby_validation.rb');
      fs.writeFileSync(tempFile, code);
      
      try {
        execSync(`ruby -c "${tempFile}"`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `Ruby validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate Perl syntax
   */
  validatePerlSyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_perl_validation.pl');
      fs.writeFileSync(tempFile, code);
      
      try {
        execSync(`perl -c "${tempFile}"`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `Perl validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate Pascal/Delphi syntax
   */
  validatePascalSyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_pascal_validation.pas');
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try Free Pascal compiler
        execSync(`fpc -s "${tempFile}"`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        // Clean up generated files
        const files = fs.readdirSync(__dirname);
        files.forEach(file => {
          if (file.startsWith('.tmp_pascal_validation') && 
              (file.endsWith('.exe') || file.endsWith('.o') || file.endsWith('.ppu'))) {
            fs.unlinkSync(path.join(__dirname, file));
          }
        });
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `Pascal validation setup failed: ${error.message}` };
    }
  }

  /**
   * Validate BASIC syntax
   */
  validateBasicSyntax(code) {
    try {
      const tempFile = path.join(__dirname, '.tmp_basic_validation.bas');
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try FreeBASIC compiler
        execSync(`fbc -c "${tempFile}"`, { stdio: 'pipe' });
        fs.unlinkSync(tempFile);
        
        // Clean up generated files
        const objFile = tempFile.replace('.bas', '.o');
        if (fs.existsSync(objFile)) fs.unlinkSync(objFile);
        
        return { valid: true, error: null };
      } catch (error) {
        fs.unlinkSync(tempFile);
        return { valid: false, error: error.stderr?.toString() || error.message };
      }
    } catch (error) {
      return { valid: false, error: `BASIC validation setup failed: ${error.message}` };
    }
  }

  /**
   * Perform basic code validation for unknown languages
   */
  performBasicCodeValidation(code) {
    // Basic checks that apply to most programming languages
    const checks = {
      hasContent: code.trim().length > 0,
      balancedBraces: this.checkBalancedBraces(code),
      balancedParentheses: this.checkBalancedParentheses(code),
      noObviousErrors: !code.includes('undefined') && !code.includes('null')
    };
    
    const issues = [];
    if (!checks.hasContent) issues.push('Generated code is empty');
    if (!checks.balancedBraces) issues.push('Unbalanced braces detected');
    if (!checks.balancedParentheses) issues.push('Unbalanced parentheses detected');
    
    return {
      valid: issues.length === 0,
      error: issues.length > 0 ? issues.join('; ') : null
    };
  }

  /**
   * Check if braces are balanced in code
   */
  checkBalancedBraces(code) {
    let count = 0;
    for (const char of code) {
      if (char === '{') count++;
      if (char === '}') count--;
      if (count < 0) return false;
    }
    return count === 0;
  }

  /**
   * Check if parentheses are balanced in code
   */
  checkBalancedParentheses(code) {
    let count = 0;
    for (const char of code) {
      if (char === '(') count++;
      if (char === ')') count--;
      if (count < 0) return false;
    }
    return count === 0;
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
      codeValidation: false,
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
            
            // Step 6: Validate generated code syntax if AST processing succeeded
            if (result.generatedCode && result.pluginInfo && result.pluginInfo.extension) {
              this.log('  5. Validating generated code syntax...', 'blue', true);
              try {
                const validation = this.validateGeneratedCodeSyntax(result.generatedCode, result.pluginInfo.extension);
                result.codeValidation = validation.valid;
                
                if (validation.valid) {
                  this.log(`    ✅ Generated ${result.pluginInfo.extension} code is syntactically valid`, 'green', true);
                } else {
                  this.log(`    ❌ Generated ${result.pluginInfo.extension} code has syntax errors`, 'red', true);
                  result.errors.push(`Code validation failed: ${validation.error}`);
                }
              } catch (error) {
                result.codeValidation = false;
                result.errors.push(`Code validation error: ${error.message}`);
                this.log(`    ❌ Code validation crashed: ${error.message}`, 'red', true);
              }
            } else {
              result.codeValidation = false;
              result.warnings.push('Skipped code validation - no generated code or unknown extension');
              this.log('    ⚠️ Skipped code validation - no generated code', 'yellow', true);
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
    
    // Count code validation errors
    if (!result.codeValidation && result.astProcessing) {
      this.stats.codeValidationErrors++;
    }
    
    // Determine overall success
    const success = result.syntaxValid && result.loadable && result.registered && result.astProcessing && result.codeValidation;
    if (success) {
      this.stats.passed++;
      this.log(`✅ ${fileName} - All tests passed (including code validation)`, 'green');
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
      if (this.stats.codeValidationErrors > 0) this.log(`   Code validation errors: ${this.stats.codeValidationErrors}`, 'red');
    }

    // Detailed results
    this.log(`\n📋 Detailed Results:`, 'bright');
    this.results.forEach(result => {
      const status = (result.syntaxValid && result.loadable && result.registered && result.astProcessing && result.codeValidation) ? '✅' : '❌';
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
      this.log(`     Code Validation: ${result.codeValidation ? '✅' : '❌'}`, result.codeValidation ? 'green' : 'red');
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
      
      // Load all successful plugins (registered plugins regardless of code validation for statistics)
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
