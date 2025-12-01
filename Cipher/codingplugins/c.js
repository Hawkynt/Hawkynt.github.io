/**
 * C Language Plugin for Multi-Language Code Generation
 * Generates C code from JavaScript AST using the transformer/emitter pattern
 * (c)2006-2025 Hawkynt
 *
 * Follows the LanguagePlugin specification with three-stage pipeline:
 * JS AST -> C AST (via CTransformer) -> C Code (via CEmitter)
 */

(function() {
  'use strict';

  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins, CAST, CTransformer, CEmitter;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load C-specific modules
    CAST = require('./CAST.js');
    const transformerModule = require('./CTransformer.js');
    const emitterModule = require('./CEmitter.js');
    CTransformer = transformerModule.CTransformer;
    CEmitter = emitterModule.CEmitter;
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    CAST = window.CAST;
    CTransformer = window.CTransformer?.CTransformer || window.CTransformer;
    CEmitter = window.CEmitter?.CEmitter || window.CEmitter;
  }

  /**
   * C Code Generator Plugin
   * Extends LanguagePlugin base class
   */
  class CPlugin extends LanguagePlugin {
    constructor() {
      super();

      // Required plugin metadata
      this.name = 'C';
      this.extension = 'c';
      this.icon = '🔧';
      this.description = 'C language code generator with manual memory management';
      this.mimeType = 'text/x-c';
      this.version = 'C99/C11/C17';

      // C-specific options with enhanced crypto support
      this.options = {
        indent: '    ',        // 4 spaces
        lineEnding: '\n',
        addComments: true,
        useStrictTypes: true,
        standard: 'c11',       // c89, c99, c11, c17, c23
        addHeaders: true,
        useInlineAssembly: false,
        useCryptoLibs: true,
        useOpenSSL: true,
        useSodium: false,
        useStaticAssert: true, // C11 feature
        useGenericSelections: true, // C11 feature
        useAlignof: true,      // C11 feature
        useThreadLocal: true,  // C11 feature
        useAtomics: true,      // C11 feature
        useBitOperations: true, // Enhanced crypto bit ops
        addDocstrings: true,
        strictTypes: false,
        useConstCorrectness: true,
        addSafetyChecks: true,
        memoryManagement: 'manual' // manual, gc, pool
      };

      // Option metadata - defines enum choices
      this.optionsMeta = {
        standard: {
          type: 'enum',
          choices: [
            { value: 'c89', label: 'C89/ANSI C', description: 'ANSI C 1989 standard' },
            { value: 'c99', label: 'C99', description: 'ISO C 1999 with inline, restrict, VLAs' },
            { value: 'c11', label: 'C11', description: 'ISO C 2011 with _Generic, _Static_assert, atomics' },
            { value: 'c17', label: 'C17', description: 'ISO C 2017 bug fix release' },
            { value: 'c23', label: 'C23', description: 'ISO C 2023 with typeof, auto, constexpr' }
          ]
        },
        memoryManagement: {
          type: 'enum',
          choices: [
            { value: 'manual', label: 'Manual', description: 'Manual malloc/free memory management' },
            { value: 'pool', label: 'Memory Pool', description: 'Use memory pool allocator' },
            { value: 'gc', label: 'Garbage Collection', description: 'Use Boehm GC or similar' }
          ]
        },
        indent: {
          type: 'enum',
          choices: [
            { value: '  ', label: '2 Spaces' },
            { value: '    ', label: '4 Spaces' },
            { value: '\t', label: 'Tab' }
          ]
        }
      };

      // Option constraints
      this.optionConstraints = {
        useStaticAssert: {
          enabledWhen: { standard: ['c11', 'c17', 'c23'] },
          disabledReason: '_Static_assert requires C11 or later'
        },
        useGenericSelections: {
          enabledWhen: { standard: ['c11', 'c17', 'c23'] },
          disabledReason: '_Generic requires C11 or later'
        },
        useAlignof: {
          enabledWhen: { standard: ['c11', 'c17', 'c23'] },
          disabledReason: '_Alignof requires C11 or later'
        },
        useThreadLocal: {
          enabledWhen: { standard: ['c11', 'c17', 'c23'] },
          disabledReason: '_Thread_local requires C11 or later'
        },
        useAtomics: {
          enabledWhen: { standard: ['c11', 'c17', 'c23'] },
          disabledReason: 'Atomics require C11 or later'
        }
      };
    }

    /**
     * Generate C code from Abstract Syntax Tree
     * @param {Object} ast - Parsed/Modified AST representation
     * @param {Object} options - Generation options
     * @returns {CodeGenerationResult}
     */
    GenerateFromAST(ast, options = {}) {
      try {
        // Merge options
        const mergedOptions = { ...this.options, ...options };

        // Validate AST
        if (!ast || typeof ast !== 'object') {
          return this.CreateErrorResult('Invalid AST: must be an object');
        }

        // Check if transformer and emitter are available
        if (!CTransformer || !CEmitter) {
          return this.CreateErrorResult('C transformer/emitter not loaded');
        }

        // Stage 1: Transform JS AST to C AST
        const transformer = new CTransformer(mergedOptions);
        const cAst = transformer.transform(ast);

        if (!cAst) {
          return this.CreateErrorResult('Failed to transform JavaScript AST to C AST');
        }

        // Stage 2: Emit C code from C AST
        const emitter = new CEmitter(mergedOptions);
        const code = emitter.emit(cAst);

        if (!code) {
          return this.CreateErrorResult('Failed to emit C code from C AST');
        }

        // Collect dependencies
        const dependencies = this._collectDependencies(cAst, mergedOptions);

        // Generate warnings
        const warnings = this._generateWarnings(cAst, mergedOptions);

        return this.CreateSuccessResult(code, dependencies, warnings);

      } catch (error) {
        return this.CreateErrorResult('Code generation failed: ' + error.message + '\n' + error.stack);
      }
    }

    /**
     * Collect required dependencies from C AST
     * @private
     */
    _collectDependencies(cAst, options) {
      const dependencies = [];

      // Standard C library headers
      dependencies.push('stdint.h (standard integer types)');
      dependencies.push('stdbool.h (boolean type)');
      dependencies.push('stddef.h (standard definitions)');
      dependencies.push('string.h (string operations)');

      // Optional dependencies based on features used
      if (options.useCryptoLibs) {
        if (options.useOpenSSL) {
          dependencies.push('OpenSSL library (libssl, libcrypto)');
        }
        if (options.useSodium) {
          dependencies.push('libsodium (modern cryptography library)');
        }
      }

      if (options.useAtomics && (options.standard === 'c11' || options.standard === 'c17' || options.standard === 'c23')) {
        dependencies.push('stdatomic.h (C11 atomics)');
      }

      if (options.useThreadLocal && (options.standard === 'c11' || options.standard === 'c17' || options.standard === 'c23')) {
        dependencies.push('threads.h (C11 threading)');
      }

      return dependencies;
    }

    /**
     * Generate warnings about potential issues
     * @private
     */
    _generateWarnings(cAst, options) {
      const warnings = [];

      // C-specific warnings
      warnings.push('Review manual memory management (malloc/free) for memory leaks');
      warnings.push('Consider using const qualifiers for read-only data');
      warnings.push('Validate all pointer dereferences to avoid segmentation faults');
      warnings.push('Use static analysis tools (cppcheck, clang-tidy) to check for issues');

      if (options.memoryManagement === 'manual') {
        warnings.push('Manual memory management enabled - ensure proper malloc/free pairing');
      }

      if (!options.useConstCorrectness) {
        warnings.push('Const correctness disabled - may miss optimization opportunities');
      }

      if (!options.addSafetyChecks) {
        warnings.push('Safety checks disabled - validate inputs and bounds manually');
      }

      if (options.standard === 'c89') {
        warnings.push('C89 standard selected - many modern C features unavailable');
      }

      return warnings;
    }

    /**
     * Validate C code syntax using compiler
     * @override
     */
    ValidateCodeSyntax(code) {
      // Check if C compiler is available first
      if (!this._isCompilerAvailable()) {
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'C compiler not available - using basic validation'
        };
      }

      try {
        const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');

        // Create temporary file
        const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_c_${Date.now()}.c`);

        // Ensure .agent.tmp directory exists
        const tempDir = path.dirname(tempFile);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Write C code to temp file
        fs.writeFileSync(tempFile, code);

        try {
          // Try to compile the C code (syntax check only, don't link)
          execSync(`gcc -c -std=c11 "${tempFile}" -o nul`, {
            stdio: 'pipe',
            timeout: 3000,
            windowsHide: true
          });

          // Clean up
          fs.unlinkSync(tempFile);

          return {
            success: true,
            method: 'gcc',
            error: null
          };

        } catch (error) {
          // Clean up on error
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }

          return {
            success: false,
            method: 'gcc',
            error: error.stderr?.toString() || error.message
          };
        }

      } catch (error) {
        // If compiler is not available or other error, fall back to basic validation
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'C compiler error: ' + error.message
        };
      }
    }

    /**
     * Check if C compiler is available on the system
     * @private
     */
    _isCompilerAvailable() {
      try {
        const { execSync } = require('child_process');
        execSync('gcc --version', {
          stdio: 'pipe',
          timeout: 2000,
          windowsHide: true
        });
        return true;
      } catch (error) {
        // Try clang as fallback
        try {
          execSync('clang --version', {
            stdio: 'pipe',
            timeout: 2000,
            windowsHide: true
          });
          return true;
        } catch (error2) {
          return false;
        }
      }
    }

    /**
     * Basic syntax validation for C code (balanced braces, etc.)
     * @private
     */
    _checkBalancedSyntax(code) {
      try {
        let braces = 0;
        let parentheses = 0;
        let brackets = 0;
        let inString = false;
        let inChar = false;
        let inLineComment = false;
        let inBlockComment = false;
        let escaped = false;

        for (let i = 0; i < code.length; i++) {
          const char = code[i];
          const nextChar = i < code.length - 1 ? code[i + 1] : '';

          // Handle strings
          if (char === '"' && !escaped && !inChar && !inLineComment && !inBlockComment) {
            inString = !inString;
            continue;
          }

          // Handle char literals
          if (char === "'" && !escaped && !inString && !inLineComment && !inBlockComment) {
            inChar = !inChar;
            continue;
          }

          // Handle comments
          if (!inString && !inChar) {
            if (char === '/' && nextChar === '/' && !inBlockComment) {
              inLineComment = true;
              i++; // Skip next character
              continue;
            }
            if (char === '/' && nextChar === '*' && !inLineComment) {
              inBlockComment = true;
              i++; // Skip next character
              continue;
            }
            if (char === '*' && nextChar === '/' && inBlockComment) {
              inBlockComment = false;
              i++; // Skip next character
              continue;
            }
          }

          // Handle line endings for line comments
          if (char === '\n') {
            inLineComment = false;
          }

          // Track escape sequences
          if (char === '\\' && (inString || inChar)) {
            escaped = !escaped;
            continue;
          } else {
            escaped = false;
          }

          // Skip if inside string, char, or comment
          if (inString || inChar || inLineComment || inBlockComment) {
            continue;
          }

          // Count brackets and braces
          switch (char) {
            case '{':
              braces++;
              break;
            case '}':
              braces--;
              if (braces < 0) return false;
              break;
            case '(':
              parentheses++;
              break;
            case ')':
              parentheses--;
              if (parentheses < 0) return false;
              break;
            case '[':
              brackets++;
              break;
            case ']':
              brackets--;
              if (brackets < 0) return false;
              break;
          }
        }

        return braces === 0 && parentheses === 0 && brackets === 0 && !inString && !inChar && !inBlockComment;
      } catch (error) {
        return false;
      }
    }

    /**
     * Get C compiler download information
     * @override
     */
    GetCompilerInfo() {
      return {
        name: this.name,
        compilerName: 'GCC or Clang',
        downloadUrl: 'https://gcc.gnu.org/ or https://clang.llvm.org/',
        installInstructions: [
          'Windows: Install MinGW-w64 from https://www.mingw-w64.org/ or MSYS2',
          '  - Download MSYS2 from https://www.msys2.org/',
          '  - Run: pacman -S mingw-w64-x86_64-gcc',
          '  - Add C:\\msys64\\mingw64\\bin to PATH',
          'macOS: Install Xcode Command Line Tools',
          '  - Run: xcode-select --install',
          'Linux: Install build-essential package',
          '  - Ubuntu/Debian: sudo apt-get install build-essential',
          '  - Fedora/RHEL: sudo yum install gcc gcc-c++',
          'Verify installation with: gcc --version'
        ].join('\n'),
        verifyCommand: 'gcc --version',
        alternativeValidation: 'Basic syntax checking (balanced brackets/braces/parentheses)',
        packageManager: 'System package manager or manual installation',
        documentation: 'https://en.cppreference.com/w/c'
      };
    }
  }

  // Register the plugin
  const cPlugin = new CPlugin();
  LanguagePlugins.Add(cPlugin);

  // Export for potential direct use
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = cPlugin;
  }

})(); // End of IIFE
