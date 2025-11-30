/**
 * Rust Language Plugin for Multi-Language Code Generation
 * Generates Rust code from JavaScript AST using the transformer/emitter pattern
 * (c)2006-2025 Hawkynt
 *
 * Follows the LanguagePlugin specification with three-stage pipeline:
 * JS AST -> Rust AST (via RustTransformer) -> Rust Code (via RustEmitter)
 */

(function() {
  'use strict';

  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins, RustAST, RustTransformer, RustEmitter;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load Rust-specific modules
    RustAST = require('./RustAST.js');
    const transformerModule = require('./RustTransformer.js');
    const emitterModule = require('./RustEmitter.js');
    RustTransformer = transformerModule.RustTransformer;
    RustEmitter = emitterModule.RustEmitter;
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    RustAST = window.RustAST;
    RustTransformer = window.RustTransformer?.RustTransformer || window.RustTransformer;
    RustEmitter = window.RustEmitter?.RustEmitter || window.RustEmitter;
  }

  /**
   * Rust Code Generator Plugin
   * Extends LanguagePlugin base class
   */
  class RustPlugin extends LanguagePlugin {
    constructor() {
      super();

      // Required plugin metadata
      this.name = 'Rust';
      this.extension = 'rs';
      this.icon = '🦀';
      this.description = 'Rust language code generator with ownership semantics';
      this.mimeType = 'text/x-rust';
      this.version = '1.70+ (Edition 2021)';

      // Rust-specific options
      this.options = {
        indent: '    ',        // 4 spaces (Rust convention)
        lineEnding: '\n',
        addComments: true,
        useStrictTypes: true,
        errorHandling: true,
        edition: '2021',
        useOwnership: true,    // Use proper Rust ownership patterns
        useTraits: true,       // Generate trait implementations
        useGenerics: true,     // Use generic types where appropriate
        useZeroCopy: true,     // Prefer &[u8] over Vec<u8> for read-only data
        useSIMD: false,        // Enable SIMD optimizations
        noStd: false           // For embedded/no_std environments
      };

      // Option metadata - defines enum choices
      this.optionsMeta = {
        edition: {
          type: 'enum',
          choices: [
            { value: '2015', label: 'Rust 2015', description: 'Original Rust edition' },
            { value: '2018', label: 'Rust 2018', description: 'NLL, module system changes, async/await' },
            { value: '2021', label: 'Rust 2021', description: 'Disjoint capture, IntoIterator for arrays' },
            { value: '2024', label: 'Rust 2024', description: 'Latest edition with new features' }
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
        // SIMD support improved in 2018+
        useSIMD: {
          enabledWhen: { edition: ['2018', '2021', '2024'] },
          disabledReason: 'Stable SIMD requires Rust 2018 edition or later'
        }
      };
    }

    /**
     * Generate Rust code from Abstract Syntax Tree
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
        if (!RustTransformer || !RustEmitter) {
          return this.CreateErrorResult('Rust transformer/emitter not loaded');
        }

        // Stage 1: Transform JS AST to Rust AST
        const transformer = new RustTransformer(mergedOptions);
        const rustAst = transformer.transform(ast);

        if (!rustAst) {
          return this.CreateErrorResult('Failed to transform JavaScript AST to Rust AST');
        }

        // Stage 2: Emit Rust code from Rust AST
        const emitter = new RustEmitter(mergedOptions);
        const code = emitter.emit(rustAst);

        if (!code) {
          return this.CreateErrorResult('Failed to emit Rust code from Rust AST');
        }

        // Collect dependencies
        const dependencies = this._collectDependencies(rustAst, mergedOptions);

        // Generate warnings
        const warnings = this._generateWarnings(rustAst, mergedOptions);

        return this.CreateSuccessResult(code, dependencies, warnings);

      } catch (error) {
        return this.CreateErrorResult('Code generation failed: ' + error.message + '\n' + error.stack);
      }
    }

    /**
     * Collect required dependencies from Rust AST
     * @private
     */
    _collectDependencies(rustAst, options) {
      const dependencies = [];

      // Analyze use declarations in the AST
      if (rustAst.uses && rustAst.uses.length > 0) {
        for (const use of rustAst.uses) {
          if (use.path && !use.path.startsWith('std::')) {
            // External crate dependency
            dependencies.push(use.path.split('::')[0]);
          }
        }
      }

      // Standard dependencies for crypto code
      dependencies.push('std (standard library)');

      // Optional dependencies based on features used
      if (options.useSIMD) {
        dependencies.push('std::arch (SIMD intrinsics)');
      }

      return [...new Set(dependencies)]; // Remove duplicates
    }

    /**
     * Generate warnings about potential issues
     * @private
     */
    _generateWarnings(rustAst, options) {
      const warnings = [];

      // Rust-specific warnings
      warnings.push('Review ownership and borrowing patterns for correctness');
      warnings.push('Consider using lifetimes for complex reference patterns');
      warnings.push('Run `cargo clippy` to check for Rust-specific issues');
      warnings.push('Run `cargo fmt` to format code according to Rust conventions');

      if (!options.errorHandling) {
        warnings.push('Error handling disabled - consider using Result<T, E> types');
      }

      if (!options.useOwnership) {
        warnings.push('Ownership semantics disabled - may produce non-idiomatic Rust');
      }

      return warnings;
    }

    /**
     * Validate Rust code syntax using rustc compiler
     * @override
     */
    ValidateCodeSyntax(code) {
      // Check if Rust is available first
      if (!this._isRustAvailable()) {
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'Rust compiler not available - using basic validation'
        };
      }

      try {
        const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');

        // Create temporary file
        const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_rust_${Date.now()}.rs`);

        // Ensure .agent.tmp directory exists
        const tempDir = path.dirname(tempFile);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Write Rust code to temp file
        fs.writeFileSync(tempFile, code);

        try {
          // Try to compile the Rust code as a library crate
          execSync(`rustc --crate-type=lib "${tempFile}"`, {
            stdio: 'pipe',
            timeout: 3000,
            windowsHide: true
          });

          // Clean up
          fs.unlinkSync(tempFile);

          // Clean up any generated library files
          const libFile = tempFile.replace('.rs', '.rlib');
          if (fs.existsSync(libFile)) {
            fs.unlinkSync(libFile);
          }

          return {
            success: true,
            method: 'rustc',
            error: null
          };

        } catch (error) {
          // Clean up on error
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }

          const libFile = tempFile.replace('.rs', '.rlib');
          if (fs.existsSync(libFile)) {
            fs.unlinkSync(libFile);
          }

          return {
            success: false,
            method: 'rustc',
            error: error.stderr?.toString() || error.message
          };
        }

      } catch (error) {
        // If Rust is not available or other error, fall back to basic validation
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'Rust compiler error: ' + error.message
        };
      }
    }

    /**
     * Check if Rust compiler is available on the system
     * @private
     */
    _isRustAvailable() {
      try {
        const { execSync } = require('child_process');
        execSync('rustc --version', {
          stdio: 'pipe',
          timeout: 2000,
          windowsHide: true
        });
        return true;
      } catch (error) {
        return false;
      }
    }

    /**
     * Basic syntax validation for Rust code (balanced braces, etc.)
     * @private
     */
    _checkBalancedSyntax(code) {
      try {
        let braces = 0;
        let parentheses = 0;
        let brackets = 0;
        let inString = false;
        let inRawString = false;
        let inLineComment = false;
        let inBlockComment = false;
        let escaped = false;
        let rawStringHashes = 0;

        for (let i = 0; i < code.length; i++) {
          const char = code[i];
          const nextChar = i < code.length - 1 ? code[i + 1] : '';

          // Handle raw strings (r#"..."# or r"...")
          if (char === 'r' && nextChar === '"' && !inString && !inLineComment && !inBlockComment) {
            inRawString = true;
            rawStringHashes = 0;
            i++; // Skip the quote
            continue;
          }

          if (char === 'r' && nextChar === '#' && !inString && !inLineComment && !inBlockComment) {
            // Count hashes for raw string delimiter
            let hashCount = 0;
            let j = i + 1;
            while (j < code.length && code[j] === '#') {
              hashCount++;
              j++;
            }
            if (j < code.length && code[j] === '"') {
              inRawString = true;
              rawStringHashes = hashCount;
              i = j; // Skip to the quote
              continue;
            }
          }

          // End raw strings
          if (inRawString && char === '"') {
            let hashCount = 0;
            let j = i + 1;
            while (j < code.length && code[j] === '#' && hashCount < rawStringHashes) {
              hashCount++;
              j++;
            }
            if (hashCount === rawStringHashes) {
              inRawString = false;
              i = j - 1; // Will be incremented by loop
              continue;
            }
          }

          // Handle regular strings
          if (char === '"' && !escaped && !inRawString && !inLineComment && !inBlockComment) {
            inString = !inString;
            continue;
          }

          // Handle comments
          if (!inString && !inRawString) {
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

          // Track escape sequences in regular strings
          if (char === '\\' && inString && !inRawString) {
            escaped = !escaped;
            continue;
          } else {
            escaped = false;
          }

          // Skip if inside string or comment
          if (inString || inRawString || inLineComment || inBlockComment) {
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

        return braces === 0 && parentheses === 0 && brackets === 0 && !inString && !inRawString && !inBlockComment;
      } catch (error) {
        return false;
      }
    }

    /**
     * Get Rust compiler download information
     * @override
     */
    GetCompilerInfo() {
      return {
        name: this.name,
        compilerName: 'Rust (rustc)',
        downloadUrl: 'https://www.rust-lang.org/tools/install',
        installInstructions: [
          'Install Rust using rustup from https://rustup.rs/',
          'Windows: Download and run rustup-init.exe',
          'macOS/Linux: curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh',
          'Follow the on-screen instructions to complete installation',
          'Restart your terminal or run: source $HOME/.cargo/env',
          'Verify installation with: rustc --version',
          'Install additional tools: rustup component add clippy rustfmt'
        ].join('\n'),
        verifyCommand: 'rustc --version',
        alternativeValidation: 'Basic syntax checking (balanced brackets/braces/parentheses)',
        packageManager: 'Cargo (built-in package manager)',
        documentation: 'https://doc.rust-lang.org/'
      };
    }
  }

  // Register the plugin
  const rustPlugin = new RustPlugin();
  LanguagePlugins.Add(rustPlugin);

  // Export for potential direct use
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = rustPlugin;
  }

})(); // End of IIFE
