/**
 * Ruby Language Plugin for Multi-Language Code Generation
 * Generates Ruby code from JavaScript AST using the transformer/emitter pattern
 * (c)2006-2025 Hawkynt
 *
 * Follows the LanguagePlugin specification with three-stage pipeline:
 * JS AST -> Ruby AST (via RubyTransformer) -> Ruby Code (via RubyEmitter)
 */

(function() {
  'use strict';

  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins, RubyAST, RubyTransformer, RubyEmitter;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load Ruby-specific modules
    RubyAST = require('./RubyAST.js');
    const transformerModule = require('./RubyTransformer.js');
    const emitterModule = require('./RubyEmitter.js');
    RubyTransformer = transformerModule.RubyTransformer;
    RubyEmitter = emitterModule.RubyEmitter;
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    RubyAST = window.RubyAST;
    RubyTransformer = window.RubyTransformer?.RubyTransformer || window.RubyTransformer;
    RubyEmitter = window.RubyEmitter?.RubyEmitter || window.RubyEmitter;
  }

  /**
   * Ruby Code Generator Plugin
   * Extends LanguagePlugin base class
   */
  class RubyPlugin extends LanguagePlugin {
    constructor() {
      super();

      // Required plugin metadata
      this.name = 'Ruby';
      this.extension = 'rb';
      this.icon = '💎';
      this.description = 'Ruby 3.3+ code generator with modern syntax support';
      this.mimeType = 'text/x-ruby';
      this.version = '3.3+';

      // Ruby-specific options
      this.options = {
        indent: '  ',          // 2 spaces (Ruby convention)
        lineEnding: '\n',
        addComments: true,
        useSymbolKeys: true,
        useModernSyntax: true,
        useFrozenStringLiteral: true,
        useEndlessMethods: false,  // Ruby 3+ endless methods
        usePatternMatching: false   // Ruby 2.7+ pattern matching
      };

      // Option metadata
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
    }

    /**
     * Generate Ruby code from Abstract Syntax Tree
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
        if (!RubyTransformer || !RubyEmitter) {
          return this.CreateErrorResult('Ruby transformer/emitter not loaded');
        }

        // Stage 1: Transform JS AST to Ruby AST
        const transformer = new RubyTransformer(mergedOptions);
        const rubyAst = transformer.transform(ast);

        if (!rubyAst) {
          return this.CreateErrorResult('Failed to transform JavaScript AST to Ruby AST');
        }

        // Stage 2: Emit Ruby code from Ruby AST
        const emitter = new RubyEmitter(mergedOptions);
        const code = emitter.emit(rubyAst);

        if (!code) {
          return this.CreateErrorResult('Failed to emit Ruby code from Ruby AST');
        }

        // Collect dependencies
        const dependencies = this._collectDependencies(rubyAst, mergedOptions);

        // Generate warnings
        const warnings = this._generateWarnings(rubyAst, mergedOptions, code);

        return this.CreateSuccessResult(code, dependencies, warnings);

      } catch (error) {
        return this.CreateErrorResult('Code generation failed: ' + error.message + '\n' + error.stack);
      }
    }

    /**
     * Collect required dependencies from Ruby AST
     * @private
     */
    _collectDependencies(rubyAst, options) {
      const dependencies = [];

      // Analyze require statements in the AST
      if (rubyAst.requires && rubyAst.requires.length > 0) {
        for (const req of rubyAst.requires) {
          if (req.path) {
            dependencies.push(req.path);
          }
        }
      }

      // Standard dependencies
      if (dependencies.length === 0) {
        dependencies.push('Standard Library (no external gems required)');
      }

      return [...new Set(dependencies)]; // Remove duplicates
    }

    /**
     * Generate warnings about potential issues
     * @private
     */
    _generateWarnings(rubyAst, options, code) {
      const warnings = [];

      // Ruby-specific warnings
      warnings.push('Review Ruby idioms and conventions (use RuboCop for linting)');
      warnings.push('Ensure frozen_string_literal pragma is appropriate for your use case');

      // Check for common issues in generated code
      if (!options.useFrozenStringLiteral) {
        warnings.push('Consider enabling frozen_string_literal for better performance');
      }

      if (code.includes('for ') && code.includes(' in ')) {
        warnings.push('Consider using .each instead of for loops (Ruby convention)');
      }

      if (code.includes('== nil') || code.includes('!= nil')) {
        warnings.push('Use .nil? method instead of == nil comparisons');
      }

      if (/def\s+[a-z]*[A-Z]/.test(code)) {
        warnings.push('Use snake_case for method names (Ruby convention)');
      }

      return warnings;
    }

    /**
     * Validate Ruby code syntax using ruby compiler
     * @override
     */
    ValidateCodeSyntax(code) {
      // Check if Ruby is available first
      if (!this._isRubyAvailable()) {
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'Ruby interpreter not available - using basic validation'
        };
      }

      try {
        const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');

        // Create temporary file
        const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_ruby_${Date.now()}.rb`);

        // Ensure .agent.tmp directory exists
        const tempDir = path.dirname(tempFile);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Write Ruby code to temp file
        fs.writeFileSync(tempFile, code);

        try {
          // Check syntax using ruby -c
          execSync(`ruby -c "${tempFile}"`, {
            stdio: 'pipe',
            timeout: 3000,
            windowsHide: true
          });

          // Clean up
          fs.unlinkSync(tempFile);

          return {
            success: true,
            method: 'ruby',
            error: null
          };

        } catch (error) {
          // Clean up on error
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }

          return {
            success: false,
            method: 'ruby',
            error: error.stderr?.toString() || error.message
          };
        }

      } catch (error) {
        // If Ruby is not available or other error, fall back to basic validation
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'Ruby interpreter error: ' + error.message
        };
      }
    }

    /**
     * Check if Ruby interpreter is available on the system
     * @private
     */
    _isRubyAvailable() {
      try {
        const { execSync } = require('child_process');
        execSync('ruby --version', {
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
     * Basic syntax validation for Ruby code (balanced braces, keywords, etc.)
     * @private
     */
    _checkBalancedSyntax(code) {
      try {
        let blockDepth = 0;
        let parenDepth = 0;
        let bracketDepth = 0;
        let braceDepth = 0;
        let inString = false;
        let inRegex = false;
        let inComment = false;
        let stringChar = null;

        const lines = code.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          inComment = false;

          for (let j = 0; j < line.length; j++) {
            const char = line[j];
            const nextChar = j < line.length - 1 ? line[j + 1] : '';

            // Handle comments
            if (char === '#' && !inString && !inRegex) {
              inComment = true;
              break;
            }

            // Handle strings
            if ((char === '"' || char === "'") && !inRegex && !inComment) {
              if (!inString) {
                inString = true;
                stringChar = char;
              } else if (char === stringChar && line[j - 1] !== '\\') {
                inString = false;
                stringChar = null;
              }
              continue;
            }

            // Handle regex
            if (char === '/' && !inString && !inComment) {
              if (!inRegex) {
                inRegex = true;
              } else if (line[j - 1] !== '\\') {
                inRegex = false;
              }
              continue;
            }

            // Skip if inside string, regex, or comment
            if (inString || inRegex || inComment) {
              continue;
            }

            // Count delimiters
            switch (char) {
              case '(':
                parenDepth++;
                break;
              case ')':
                parenDepth--;
                if (parenDepth < 0) return false;
                break;
              case '[':
                bracketDepth++;
                break;
              case ']':
                bracketDepth--;
                if (bracketDepth < 0) return false;
                break;
              case '{':
                braceDepth++;
                break;
              case '}':
                braceDepth--;
                if (braceDepth < 0) return false;
                break;
            }
          }

          // Check for block keywords
          const trimmedLine = line.trim();

          // Opening keywords
          if (/^(class|module|def|if|unless|case|while|until|for|begin|do)\b/.test(trimmedLine)) {
            blockDepth++;
          }

          // Closing keyword
          if (/^end\b/.test(trimmedLine)) {
            blockDepth--;
            if (blockDepth < 0) return false;
          }
        }

        return blockDepth === 0 && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0 && !inString && !inRegex;
      } catch (error) {
        return false;
      }
    }

    /**
     * Get Ruby interpreter download information
     * @override
     */
    GetCompilerInfo() {
      return {
        name: this.name,
        compilerName: 'Ruby Interpreter',
        downloadUrl: 'https://www.ruby-lang.org/en/downloads/',
        installInstructions: [
          'Install Ruby from https://www.ruby-lang.org/en/downloads/',
          'Windows: Download and run RubyInstaller from https://rubyinstaller.org/',
          'macOS: Ruby comes pre-installed, or use Homebrew: brew install ruby',
          'Linux: Use your package manager (apt, yum, pacman, etc.)',
          'For version management, consider using rbenv or rvm',
          'Verify installation with: ruby --version',
          'Install bundler for gem management: gem install bundler'
        ].join('\n'),
        verifyCommand: 'ruby --version',
        alternativeValidation: 'Basic syntax checking (balanced keywords/brackets/braces)',
        packageManager: 'RubyGems / Bundler',
        documentation: 'https://ruby-doc.org/'
      };
    }
  }

  // Register the plugin
  const rubyPlugin = new RubyPlugin();
  LanguagePlugins.Add(rubyPlugin);

  // Export for potential direct use
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = rubyPlugin;
  }

})(); // End of IIFE
