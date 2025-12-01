/**
 * PHP Language Plugin for Multi-Language Code Generation
 * Generates PHP code from JavaScript AST using the transformer/emitter pattern
 * (c)2006-2025 Hawkynt
 *
 * Follows the LanguagePlugin specification with three-stage pipeline:
 * JS AST -> PHP AST (via PhpTransformer) -> PHP Code (via PhpEmitter)
 */

(function() {
  'use strict';

  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins, PhpAST, PhpTransformer, PhpEmitter;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load PHP-specific modules
    PhpAST = require('./PhpAST.js');
    const transformerModule = require('./PhpTransformer.js');
    const emitterModule = require('./PhpEmitter.js');
    PhpTransformer = transformerModule.PhpTransformer;
    PhpEmitter = emitterModule.PhpEmitter;
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    PhpAST = window.PhpAST;
    PhpTransformer = window.PhpTransformer?.PhpTransformer || window.PhpTransformer;
    PhpEmitter = window.PhpEmitter?.PhpEmitter || window.PhpEmitter;
  }

  /**
   * PHP Code Generator Plugin
   * Extends LanguagePlugin base class
   */
  class PhpPlugin extends LanguagePlugin {
    constructor() {
      super();

      // Required plugin metadata
      this.name = 'PHP';
      this.extension = 'php';
      this.icon = '🐘';
      this.description = 'PHP 8+ language code generator with modern features';
      this.mimeType = 'text/x-php';
      this.version = '8.4+';

      // PHP-specific options
      this.options = {
        indent: '    ',              // 4 spaces (PSR-12 compliant)
        lineEnding: '\n',
        strictTypes: true,            // declare(strict_types=1)
        addTypeHints: true,           // Add type hints to parameters/returns
        addDocBlocks: true,           // Add PHPDoc comments
        useShortArraySyntax: true,    // Use [] instead of array()
        useNullCoalescing: true,      // Use ?? operator
        useMatchExpressions: true,    // Use match() instead of switch
        useArrowFunctions: true,      // Use fn() => syntax
        useConstructorPromotion: true,// Use constructor property promotion
        useReadonlyProperties: true,  // Use readonly keyword
        namespace: null               // Optional namespace (e.g., 'App\\Crypto')
      };

      // Option metadata - defines enum choices
      this.optionsMeta = {
        indent: {
          type: 'enum',
          choices: [
            { value: '  ', label: '2 Spaces' },
            { value: '    ', label: '4 Spaces (PSR-12)' },
            { value: '\t', label: 'Tab' }
          ]
        }
      };
    }

    /**
     * Generate PHP code from Abstract Syntax Tree
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
        if (!PhpTransformer || !PhpEmitter) {
          return this.CreateErrorResult('PHP transformer/emitter not loaded');
        }

        // Stage 1: Transform JS AST to PHP AST
        const transformer = new PhpTransformer(mergedOptions);
        const phpAst = transformer.transform(ast);

        if (!phpAst) {
          return this.CreateErrorResult('Failed to transform JavaScript AST to PHP AST');
        }

        // Stage 2: Emit PHP code from PHP AST
        const emitter = new PhpEmitter(mergedOptions);
        const code = emitter.emit(phpAst);

        if (!code) {
          return this.CreateErrorResult('Failed to emit PHP code from PHP AST');
        }

        // Collect dependencies
        const dependencies = this._collectDependencies(phpAst, mergedOptions);

        // Generate warnings
        const warnings = this._generateWarnings(phpAst, mergedOptions);

        return this.CreateSuccessResult(code, dependencies, warnings);

      } catch (error) {
        return this.CreateErrorResult('Code generation failed: ' + error.message + '\n' + error.stack);
      }
    }

    /**
     * Collect required dependencies from PHP AST
     * @private
     */
    _collectDependencies(phpAst, options) {
      const dependencies = [];

      // Analyze use declarations in the AST
      if (phpAst.uses && phpAst.uses.length > 0) {
        for (const use of phpAst.uses) {
          if (use.fullyQualifiedClassName) {
            dependencies.push(use.fullyQualifiedClassName);
          }
        }
      }

      // Standard PHP extensions for crypto code
      dependencies.push('ext-sodium (for cryptographic operations)');
      dependencies.push('ext-openssl (for legacy crypto support)');
      dependencies.push('ext-mbstring (for string operations)');

      return [...new Set(dependencies)]; // Remove duplicates
    }

    /**
     * Generate warnings about potential issues
     * @private
     */
    _generateWarnings(phpAst, options) {
      const warnings = [];

      // PHP-specific warnings
      warnings.push('Ensure PHP 8.1+ is installed for modern language features');
      warnings.push('Run `composer require` for any third-party dependencies');

      if (options.strictTypes) {
        warnings.push('Strict types enabled - ensure type compatibility across codebase');
      }

      if (options.namespace) {
        warnings.push(`Code is namespaced under: ${options.namespace}`);
      }

      warnings.push('Review cryptographic operations for security best practices');
      warnings.push('Consider using PHP-CS-Fixer for code style validation');
      warnings.push('Test with PHPStan or Psalm for static analysis');

      return warnings;
    }

    /**
     * Validate PHP code syntax using php -l
     * @override
     */
    ValidateCodeSyntax(code) {
      // Check if PHP is available first
      if (!this._isPhpAvailable()) {
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'PHP CLI not available - using basic validation'
        };
      }

      try {
        const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');

        // Create temporary file
        const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_php_${Date.now()}.php`);

        // Ensure .agent.tmp directory exists
        const tempDir = path.dirname(tempFile);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Write PHP code to temp file
        fs.writeFileSync(tempFile, code);

        try {
          // Use php -l to check syntax
          execSync(`php -l "${tempFile}"`, {
            stdio: 'pipe',
            timeout: 3000,
            windowsHide: true
          });

          // Clean up
          fs.unlinkSync(tempFile);

          return {
            success: true,
            method: 'php',
            error: null
          };

        } catch (error) {
          // Clean up on error
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }

          return {
            success: false,
            method: 'php',
            error: error.stderr?.toString() || error.message
          };
        }

      } catch (error) {
        // If PHP is not available or other error, fall back to basic validation
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'PHP validation error: ' + error.message
        };
      }
    }

    /**
     * Check if PHP CLI is available on the system
     * @private
     */
    _isPhpAvailable() {
      try {
        const { execSync } = require('child_process');
        execSync('php --version', {
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
     * Basic syntax validation for PHP code (balanced braces, etc.)
     * @private
     */
    _checkBalancedSyntax(code) {
      try {
        let braces = 0;
        let parentheses = 0;
        let brackets = 0;
        let inString = false;
        let inComment = false;
        let inLineComment = false;
        let inDocComment = false;
        let stringDelimiter = null;
        let escaped = false;
        let inHeredoc = false;
        let heredocMarker = null;

        for (let i = 0; i < code.length; i++) {
          const char = code[i];
          const nextChar = i < code.length - 1 ? code[i + 1] : '';
          const prevChar = i > 0 ? code[i - 1] : '';

          // Handle heredoc/nowdoc
          if (!inString && !inComment && !inLineComment && !inDocComment) {
            if (char === '<' && nextChar === '<' && i + 2 < code.length && code[i + 2] === '<') {
              // Possible heredoc start
              const match = code.substring(i).match(/<<<\s*['"]?(\w+)['"]?\s*\n/);
              if (match) {
                inHeredoc = true;
                heredocMarker = match[1];
                i += match[0].length - 1;
                continue;
              }
            }
          }

          if (inHeredoc) {
            const lineStart = code.lastIndexOf('\n', i) + 1;
            const line = code.substring(lineStart, code.indexOf('\n', i));
            if (line.trim() === heredocMarker || line.trim() === heredocMarker + ';') {
              inHeredoc = false;
              heredocMarker = null;
            }
            continue;
          }

          // Handle strings
          if ((char === '"' || char === "'") && !escaped && !inComment && !inLineComment && !inDocComment) {
            if (!inString) {
              inString = true;
              stringDelimiter = char;
            } else if (char === stringDelimiter) {
              inString = false;
              stringDelimiter = null;
            }
            continue;
          }

          // Handle comments
          if (!inString) {
            if (char === '/' && nextChar === '*' && !inLineComment) {
              if (i + 2 < code.length && code[i + 2] === '*') {
                inDocComment = true;
              } else {
                inComment = true;
              }
              i++; // Skip next character
              continue;
            }
            if (char === '*' && nextChar === '/' && (inComment || inDocComment)) {
              inComment = false;
              inDocComment = false;
              i++; // Skip next character
              continue;
            }
            if (char === '/' && nextChar === '/' && !inComment && !inDocComment) {
              inLineComment = true;
              i++; // Skip next character
              continue;
            }
            if (char === '#' && !inComment && !inDocComment) {
              inLineComment = true;
              continue;
            }
          }

          // Handle line endings for line comments
          if (char === '\n') {
            inLineComment = false;
          }

          // Track escape sequences in strings
          if (char === '\\' && inString) {
            escaped = !escaped;
            continue;
          } else {
            escaped = false;
          }

          // Skip if inside string or comment
          if (inString || inComment || inLineComment || inDocComment) {
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

        return braces === 0 && parentheses === 0 && brackets === 0 && !inString && !inComment && !inDocComment && !inHeredoc;
      } catch (error) {
        return false;
      }
    }

    /**
     * Get PHP download information
     * @override
     */
    GetCompilerInfo() {
      return {
        name: this.name,
        compilerName: 'PHP CLI',
        downloadUrl: 'https://www.php.net/downloads',
        installInstructions: [
          'Install PHP 8.1 or higher from https://www.php.net/downloads',
          'Windows: Download thread-safe ZIP and extract to C:\\php, add to PATH',
          'macOS: brew install php@8.4',
          'Linux (Ubuntu/Debian): sudo apt install php8.4-cli php8.4-mbstring php8.4-sodium',
          'Linux (Fedora/RHEL): sudo dnf install php-cli php-mbstring php-sodium',
          'Verify installation with: php --version',
          'Install Composer for package management: https://getcomposer.org/',
          'Recommended extensions: sodium, openssl, mbstring, curl'
        ].join('\n'),
        verifyCommand: 'php --version',
        alternativeValidation: 'Basic syntax checking (balanced brackets/braces/parentheses)',
        packageManager: 'Composer (https://getcomposer.org/)',
        documentation: 'https://www.php.net/manual/en/'
      };
    }
  }

  // Register the plugin
  const phpPlugin = new PhpPlugin();
  LanguagePlugins.Add(phpPlugin);

  // Export for potential direct use
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = phpPlugin;
  }

})(); // End of IIFE
