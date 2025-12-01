/**
 * Perl Language Plugin for Multi-Language Code Generation
 * Generates Perl code from JavaScript AST using the transformer/emitter pattern
 * (c)2006-2025 Hawkynt
 *
 * Follows the LanguagePlugin specification with three-stage pipeline:
 * JS AST -> Perl AST (via PerlTransformer) -> Perl Code (via PerlEmitter)
 */

(function() {
  'use strict';

  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins, PerlAST, PerlTransformer, PerlEmitter;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load Perl-specific modules
    PerlAST = require('./PerlAST.js');
    const transformerModule = require('./PerlTransformer.js');
    const emitterModule = require('./PerlEmitter.js');
    PerlTransformer = transformerModule.PerlTransformer;
    PerlEmitter = emitterModule.PerlEmitter;
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    PerlAST = window.PerlAST;
    PerlTransformer = window.PerlTransformer?.PerlTransformer || window.PerlTransformer;
    PerlEmitter = window.PerlEmitter?.PerlEmitter || window.PerlEmitter;
  }

  /**
   * Perl Code Generator Plugin
   * Extends LanguagePlugin base class
   */
  class PerlPlugin extends LanguagePlugin {
    constructor() {
      super();

      // Required plugin metadata
      this.name = 'Perl';
      this.extension = 'pl';
      this.icon = '🐪';
      this.description = 'Production-ready Perl 5.38+ code generator with crypto extensions';
      this.mimeType = 'text/x-perl';
      this.version = '5.38+';

      // Perl-specific options
      this.options = {
        indent: '    ',        // 4 spaces
        lineEnding: '\n',
        strictTypes: false,    // Perl is dynamically typed
        useStrict: true,
        useWarnings: true,
        addSignatures: true,   // Modern Perl 5.36+ feature
        useExperimentalFeatures: true, // try/catch, class, etc.
        useCryptoExtensions: true,
        usePostfixDeref: true,
        useModernClass: false, // class keyword (5.38+) vs Moo
        packageName: 'main',
        addTypeComments: true,
        useCPANModules: true
      };

      // Option metadata - defines enum choices
      this.optionsMeta = {
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
        // Modern class keyword requires 5.38+
        useModernClass: {
          enabledWhen: { useExperimentalFeatures: true },
          disabledReason: 'Modern class syntax requires experimental features enabled'
        }
      };
    }

    /**
     * Generate Perl code from Abstract Syntax Tree
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
        if (!PerlTransformer || !PerlEmitter) {
          return this.CreateErrorResult('Perl transformer/emitter not loaded');
        }

        // Stage 1: Transform JS AST to Perl AST
        const transformer = new PerlTransformer(mergedOptions);
        const perlAst = transformer.transform(ast);

        if (!perlAst) {
          return this.CreateErrorResult('Failed to transform JavaScript AST to Perl AST');
        }

        // Stage 2: Emit Perl code from Perl AST
        const emitter = new PerlEmitter(mergedOptions);
        const code = emitter.emit(perlAst);

        if (!code) {
          return this.CreateErrorResult('Failed to emit Perl code from Perl AST');
        }

        // Collect dependencies
        const dependencies = this._collectDependencies(perlAst, mergedOptions);

        // Generate warnings
        const warnings = this._generateWarnings(perlAst, mergedOptions);

        return this.CreateSuccessResult(code, dependencies, warnings);

      } catch (error) {
        return this.CreateErrorResult('Code generation failed: ' + error.message + '\n' + error.stack);
      }
    }

    /**
     * Collect required dependencies from Perl AST
     * @private
     */
    _collectDependencies(perlAst, options) {
      const dependencies = [];

      // Analyze use declarations in the AST
      if (perlAst.uses && perlAst.uses.length > 0) {
        for (const use of perlAst.uses) {
          if (use.module) {
            dependencies.push(use.module);
          }
        }
      }

      // Standard dependencies
      if (options.useStrict) {
        dependencies.push('strict (pragma)');
      }
      if (options.useWarnings) {
        dependencies.push('warnings (pragma)');
      }

      // Modern Perl features
      if (options.addSignatures) {
        dependencies.push('feature::signatures (Perl 5.36+)');
      }

      // Object system
      if (!options.useModernClass) {
        dependencies.push('Moo (CPAN module for object system)');
      } else {
        dependencies.push('class keyword (Perl 5.38+)');
      }

      // Crypto extensions
      if (options.useCryptoExtensions) {
        dependencies.push('Crypt::* modules (CPAN - for crypto operations)');
        dependencies.push('Digest::* modules (CPAN - for hashing)');
      }

      return [...new Set(dependencies)]; // Remove duplicates
    }

    /**
     * Generate warnings about potential issues
     * @private
     */
    _generateWarnings(perlAst, options) {
      const warnings = [];

      // Perl-specific warnings
      warnings.push('Review variable scoping (my/our/local) for correctness');
      warnings.push('Check sigils ($scalar, @array, %hash) for proper context');
      warnings.push('Verify use of references and dereferencing');

      if (options.addSignatures) {
        warnings.push('Signatures require Perl 5.36+ or experimental::signatures');
      }

      if (options.useModernClass) {
        warnings.push('Modern class syntax requires Perl 5.38+ with experimental features');
      }

      if (options.useCryptoExtensions) {
        warnings.push('Crypto operations may require CPAN modules (Crypt::*, Digest::*)');
      }

      warnings.push('Run perl -c to check syntax');
      warnings.push('Run perlcritic for style and best practices');

      return warnings;
    }

    /**
     * Validate Perl code syntax using perl compiler
     * @override
     */
    ValidateCodeSyntax(code) {
      // Check if Perl is available first
      if (!this._isPerlAvailable()) {
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'Perl interpreter not available - using basic validation'
        };
      }

      try {
        const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');

        // Create temporary file
        const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_perl_${Date.now()}.pl`);

        // Ensure .agent.tmp directory exists
        const tempDir = path.dirname(tempFile);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Write Perl code to temp file
        fs.writeFileSync(tempFile, code);

        try {
          // Try to check the Perl code syntax
          execSync(`perl -c "${tempFile}"`, {
            stdio: 'pipe',
            timeout: 3000,
            windowsHide: true
          });

          // Clean up
          fs.unlinkSync(tempFile);

          return {
            success: true,
            method: 'perl',
            error: null
          };

        } catch (error) {
          // Clean up on error
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }

          return {
            success: false,
            method: 'perl',
            error: error.stderr?.toString() || error.message
          };
        }

      } catch (error) {
        // If Perl is not available or other error, fall back to basic validation
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'Perl interpreter error: ' + error.message
        };
      }
    }

    /**
     * Check if Perl interpreter is available on the system
     * @private
     */
    _isPerlAvailable() {
      try {
        const { execSync } = require('child_process');
        execSync('perl --version', {
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
     * Basic syntax validation for Perl code (balanced braces, etc.)
     * @private
     */
    _checkBalancedSyntax(code) {
      try {
        let braces = 0;
        let parentheses = 0;
        let brackets = 0;
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inLineComment = false;
        let inBlockComment = false;
        let escaped = false;

        for (let i = 0; i < code.length; i++) {
          const char = code[i];
          const nextChar = i < code.length - 1 ? code[i + 1] : '';

          // Handle single quotes
          if (char === "'" && !escaped && !inDoubleQuote && !inLineComment && !inBlockComment) {
            inSingleQuote = !inSingleQuote;
            continue;
          }

          // Handle double quotes
          if (char === '"' && !escaped && !inSingleQuote && !inLineComment && !inBlockComment) {
            inDoubleQuote = !inDoubleQuote;
            continue;
          }

          // Handle comments
          if (!inSingleQuote && !inDoubleQuote) {
            if (char === '#' && !inBlockComment) {
              inLineComment = true;
              continue;
            }
            // Perl POD comments =pod ... =cut
            if (char === '=' && code.substr(i, 4) === '=pod') {
              inBlockComment = true;
              i += 3; // Skip 'pod'
              continue;
            }
            if (inBlockComment && char === '=' && code.substr(i, 4) === '=cut') {
              inBlockComment = false;
              i += 3; // Skip 'cut'
              continue;
            }
          }

          // Handle line endings for line comments
          if (char === '\n') {
            inLineComment = false;
          }

          // Track escape sequences
          if (char === '\\' && (inSingleQuote || inDoubleQuote)) {
            escaped = !escaped;
            continue;
          } else {
            escaped = false;
          }

          // Skip if inside string or comment
          if (inSingleQuote || inDoubleQuote || inLineComment || inBlockComment) {
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

        return braces === 0 && parentheses === 0 && brackets === 0 && !inSingleQuote && !inDoubleQuote && !inBlockComment;
      } catch (error) {
        return false;
      }
    }

    /**
     * Get Perl interpreter download information
     * @override
     */
    GetCompilerInfo() {
      return {
        name: this.name,
        compilerName: 'Perl',
        downloadUrl: 'https://www.perl.org/get.html',
        installInstructions: [
          'Install Perl from https://www.perl.org/get.html',
          'Windows: Download Strawberry Perl from https://strawberryperl.com/',
          'macOS: Perl is pre-installed. Update with: brew install perl',
          'Linux: Use package manager: sudo apt install perl (Ubuntu/Debian) or sudo yum install perl (RHEL/CentOS)',
          'Verify installation with: perl --version',
          'Install CPAN modules: cpan Moo Crypt::Mode Digest::SHA3',
          'For modern features, ensure Perl 5.36+ is installed'
        ].join('\n'),
        verifyCommand: 'perl --version',
        alternativeValidation: 'Basic syntax checking (balanced brackets/braces/parentheses)',
        packageManager: 'CPAN (Comprehensive Perl Archive Network)',
        documentation: 'https://perldoc.perl.org/'
      };
    }
  }

  // Register the plugin
  const perlPlugin = new PerlPlugin();
  LanguagePlugins.Add(perlPlugin);

  // Export for potential direct use
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = perlPlugin;
  }

})(); // End of IIFE
