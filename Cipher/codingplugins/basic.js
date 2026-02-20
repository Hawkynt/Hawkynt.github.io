/**
 * Basic Language Plugin for Multi-Language Code Generation
 * Generates Basic code from JavaScript AST using the transformer/emitter pattern
 * (c)2006-2025 Hawkynt
 *
 * Follows the LanguagePlugin specification with three-stage pipeline:
 * JS AST -> Basic AST (via BasicTransformer) -> Basic Code (via BasicEmitter)
 */

(function() {
  'use strict';

  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins, BasicAST, BasicTransformer, BasicEmitter;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load Basic-specific modules
    BasicAST = require('./BasicAST.js');
    const transformerModule = require('./BasicTransformer.js');
    const emitterModule = require('./BasicEmitter.js');
    BasicTransformer = transformerModule.BasicTransformer;
    BasicEmitter = emitterModule.BasicEmitter;
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    BasicAST = window.BasicAST;
    BasicTransformer = window.BasicTransformer?.BasicTransformer || window.BasicTransformer;
    BasicEmitter = window.BasicEmitter?.BasicEmitter || window.BasicEmitter;
  }

  /**
   * Basic Code Generator Plugin
   * Extends LanguagePlugin base class
   */
  class BasicPlugin extends LanguagePlugin {
    constructor() {
      super();

      // Required plugin metadata
      this.name = 'Basic';
      this.extension = 'bas';
      this.icon = '📟';
      this.description = 'BASIC language with multiple dialects (VB.NET, FreeBASIC, QB64, etc.)';
      this.mimeType = 'text/x-basic';
      this.version = 'Multi-dialect: VB.NET, FreeBASIC, QB64, QBasic, VB6, PureBASIC';

      // Basic-specific options
      this.options = {
        indent: '    ',        // 4 spaces
        lineEnding: '\n',
        addComments: true,
        variant: 'FREEBASIC',  // Default variant
        upperCase: false,      // Use mixed case keywords
        strictTypes: true,     // Enable strong typing
        useClasses: true,      // Enable OOP features for modern variants
        useExceptionHandling: true, // Use Try/Catch vs On Error
        skipInheritance: false // Skip base class inheritance (for standalone testing)
      };

      // Option metadata - defines enum choices
      this.optionsMeta = {
        variant: {
          type: 'enum',
          choices: [
            { value: 'FREEBASIC', label: 'FreeBASIC', description: 'Modern open-source BASIC compiler' },
            { value: 'VBNET', label: 'VB.NET', description: 'Microsoft Visual Basic .NET' },
            { value: 'VBA', label: 'VBA', description: 'Visual Basic for Applications (Office)' },
            { value: 'VBSCRIPT', label: 'VBScript', description: 'Windows scripting language' },
            { value: 'VB6', label: 'Visual Basic 6', description: 'Classic Visual Basic 6.0' },
            { value: 'QB64', label: 'QB64', description: 'Modern QBasic-compatible compiler' },
            { value: 'QBASIC', label: 'QBasic', description: '16-bit DOS BASIC interpreter' },
            { value: 'QUICKBASIC', label: 'QuickBasic 4.5', description: 'Microsoft QuickBasic compiler' },
            { value: 'PUREBASIC', label: 'PureBASIC', description: 'Cross-platform BASIC compiler' },
            { value: 'POWERBASIC', label: 'PowerBASIC', description: 'High-performance Windows BASIC' },
            { value: 'GAMBAS', label: 'Gambas', description: 'Linux Visual Basic clone' },
            { value: 'XOJO', label: 'Xojo', description: 'Cross-platform RAD tool (REALbasic)' }
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
        // useClasses is only available for dialects that support OOP
        useClasses: {
          enabledWhen: { variant: ['VBNET', 'FREEBASIC', 'VB6', 'GAMBAS', 'XOJO'] },
          disabledReason: 'OOP classes not supported in this dialect'
        },
        // useExceptionHandling is only available for dialects that support try/catch
        useExceptionHandling: {
          enabledWhen: { variant: ['VBNET', 'FREEBASIC', 'VBA', 'VB6', 'GAMBAS', 'XOJO', 'PUREBASIC'] },
          disabledReason: 'Exception handling not supported in this dialect'
        }
      };
    }

    /**
     * Generate Basic code from Abstract Syntax Tree
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
        if (!BasicTransformer || !BasicEmitter) {
          return this.CreateErrorResult('Basic transformer/emitter not loaded');
        }

        // Stage 1: Transform JS AST to Basic AST
        const transformer = new BasicTransformer(mergedOptions);
        const basicAst = transformer.transform(ast);

        if (!basicAst) {
          return this.CreateErrorResult('Failed to transform JavaScript AST to Basic AST');
        }

        // Stage 2: Emit Basic code from Basic AST
        const emitter = new BasicEmitter(mergedOptions);
        const code = emitter.emit(basicAst);

        if (!code) {
          return this.CreateErrorResult('Failed to emit Basic code from Basic AST');
        }

        // Collect dependencies
        const dependencies = this._collectDependencies(basicAst, mergedOptions);

        // Generate warnings
        const warnings = this._generateWarnings(basicAst, mergedOptions);

        return this.CreateSuccessResult(code, dependencies, warnings);

      } catch (error) {
        return this.CreateErrorResult('Code generation failed: ' + error.message + '\n' + error.stack);
      }
    }

    /**
     * Collect required dependencies from Basic AST
     * @private
     */
    _collectDependencies(basicAst, options) {
      const dependencies = [];
      const variant = (options.variant || 'FREEBASIC').toUpperCase();

      // Analyze imports in the AST
      if (basicAst.imports && basicAst.imports.length > 0) {
        for (const imp of basicAst.imports) {
          dependencies.push(imp.namespace);
        }
      }

      // Variant-specific dependencies
      if (variant === 'VBNET') {
        dependencies.push('System (Base Class Library)');
      } else if (variant === 'FREEBASIC') {
        dependencies.push('FreeBASIC Runtime Library');
      } else if (variant === 'VB6' || variant === 'VBA') {
        dependencies.push('Visual Basic Runtime (MSVBVM60.DLL)');
      }

      return [...new Set(dependencies)]; // Remove duplicates
    }

    /**
     * Generate warnings about potential issues
     * @private
     */
    _generateWarnings(basicAst, options) {
      const warnings = [];
      const variant = (options.variant || 'FREEBASIC').toUpperCase();

      // Basic-specific warnings
      warnings.push('Review array indexing - Basic typically uses 0-based or 1-based indexing depending on dialect');

      if (variant === 'QBASIC' || variant === 'QUICKBASIC') {
        warnings.push('QBasic/QuickBasic has limited data types - review type conversions');
        warnings.push('Legacy BASIC dialects may not support modern control structures');
      }

      if (variant === 'VB6' || variant === 'VBA') {
        warnings.push('VB6/VBA requires COM components for some advanced features');
        warnings.push('Consider On Error handling for legacy compatibility');
      }

      if (variant === 'VBNET') {
        warnings.push('VB.NET code requires .NET Framework or .NET Core/5+');
        warnings.push('Review namespace imports for required assemblies');
      }

      if (!options.useClasses) {
        warnings.push('OOP features disabled - using Type/Structure for data types');
      }

      return warnings;
    }

    /**
     * Validate Basic code syntax
     * @override
     */
    ValidateCodeSyntax(code) {
      const variant = (this.options.variant || 'FREEBASIC').toUpperCase();

      // Check if appropriate compiler is available
      if (variant === 'FREEBASIC' && this._isFreeBASICAvailable()) {
        return this._validateWithFreeBASIC(code);
      } else if (variant === 'VBNET' && this._isVBNETAvailable()) {
        return this._validateWithVBNET(code);
      }

      // Fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'Compiler not available - using basic validation'
      };
    }

    /**
     * Check if FreeBASIC compiler is available
     * @private
     */
    _isFreeBASICAvailable() {
      try {
        const { execSync } = require('child_process');
        execSync('fbc -version', {
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
     * Check if VB.NET compiler is available
     * @private
     */
    _isVBNETAvailable() {
      try {
        const { execSync } = require('child_process');
        execSync('vbc /help', {
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
     * Validate with FreeBASIC compiler
     * @private
     */
    _validateWithFreeBASIC(code) {
      try {
        const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');

        // Create temporary file
        const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_basic_${Date.now()}.bas`);

        // Ensure .agent.tmp directory exists
        const tempDir = path.dirname(tempFile);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Write Basic code to temp file
        fs.writeFileSync(tempFile, code);

        try {
          // Try to compile the Basic code (syntax check only)
          execSync(`fbc -c "${tempFile}"`, {
            stdio: 'pipe',
            timeout: 3000,
            windowsHide: true
          });

          // Clean up
          fs.unlinkSync(tempFile);

          // Clean up any generated object files
          const objFile = tempFile.replace('.bas', '.o');
          if (fs.existsSync(objFile)) {
            fs.unlinkSync(objFile);
          }

          return {
            success: true,
            method: 'fbc',
            error: null
          };

        } catch (error) {
          // Clean up on error
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }

          const objFile = tempFile.replace('.bas', '.o');
          if (fs.existsSync(objFile)) {
            fs.unlinkSync(objFile);
          }

          return {
            success: false,
            method: 'fbc',
            error: error.stderr?.toString() || error.message
          };
        }

      } catch (error) {
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'FreeBASIC compiler error: ' + error.message
        };
      }
    }

    /**
     * Validate with VB.NET compiler
     * @private
     */
    _validateWithVBNET(code) {
      try {
        const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');

        // Create temporary file
        const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_vbnet_${Date.now()}.vb`);

        // Ensure .agent.tmp directory exists
        const tempDir = path.dirname(tempFile);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Write VB.NET code to temp file
        fs.writeFileSync(tempFile, code);

        try {
          // Try to compile the VB.NET code
          execSync(`vbc /t:library "${tempFile}"`, {
            stdio: 'pipe',
            timeout: 3000,
            windowsHide: true
          });

          // Clean up
          fs.unlinkSync(tempFile);

          // Clean up any generated DLL files
          const dllFile = tempFile.replace('.vb', '.dll');
          if (fs.existsSync(dllFile)) {
            fs.unlinkSync(dllFile);
          }

          return {
            success: true,
            method: 'vbc',
            error: null
          };

        } catch (error) {
          // Clean up on error
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }

          const dllFile = tempFile.replace('.vb', '.dll');
          if (fs.existsSync(dllFile)) {
            fs.unlinkSync(dllFile);
          }

          return {
            success: false,
            method: 'vbc',
            error: error.stderr?.toString() || error.message
          };
        }

      } catch (error) {
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'VB.NET compiler error: ' + error.message
        };
      }
    }

    /**
     * Basic syntax validation for Basic code (balanced keywords, etc.)
     * @private
     */
    _checkBalancedSyntax(code) {
      try {
        const lines = code.split(/\r?\n/);
        const stack = [];

        const openKeywords = ['IF', 'FOR', 'WHILE', 'DO', 'SELECT', 'SUB', 'FUNCTION', 'CLASS', 'TYPE', 'WITH'];
        const closeKeywords = ['END IF', 'NEXT', 'WEND', 'LOOP', 'END SELECT', 'END SUB', 'END FUNCTION', 'END CLASS', 'END TYPE', 'END WITH'];

        for (let line of lines) {
          // Remove comments
          const commentPos = line.indexOf("'");
          if (commentPos >= 0) {
            line = line.substring(0, commentPos);
          }

          line = line.trim().toUpperCase();

          // Check for opening keywords
          for (const keyword of openKeywords) {
            if (line.startsWith(keyword + ' ') || line === keyword) {
              stack.push(keyword);
            }
          }

          // Check for closing keywords
          for (const keyword of closeKeywords) {
            if (line.startsWith(keyword) || line === keyword) {
              if (stack.length === 0) return false;
              const expected = this._getMatchingOpen(keyword);
              const actual = stack.pop();
              if (expected !== actual) return false;
            }
          }

          // Check for special single-line forms
          if (line.startsWith('IF ') && line.includes(' THEN ') && !line.endsWith(' THEN')) {
            // Single-line If - pop the IF we just pushed
            if (stack.length > 0 && stack[stack.length - 1] === 'IF') {
              stack.pop();
            }
          }
        }

        return stack.length === 0;
      } catch (error) {
        return false;
      }
    }

    /**
     * Get matching opening keyword for a closing keyword
     * @private
     */
    _getMatchingOpen(closeKeyword) {
      const map = {
        'END IF': 'IF',
        'NEXT': 'FOR',
        'WEND': 'WHILE',
        'LOOP': 'DO',
        'END SELECT': 'SELECT',
        'END SUB': 'SUB',
        'END FUNCTION': 'FUNCTION',
        'END CLASS': 'CLASS',
        'END TYPE': 'TYPE',
        'END WITH': 'WITH'
      };
      return map[closeKeyword];
    }

    /**
     * Get Basic compiler download information
     * @override
     */
    GetCompilerInfo() {
      const variant = (this.options.variant || 'FREEBASIC').toUpperCase();

      if (variant === 'FREEBASIC') {
        return {
          name: this.name,
          compilerName: 'FreeBASIC (fbc)',
          downloadUrl: 'https://www.freebasic.net/get',
          installInstructions: [
            'Download FreeBASIC from https://www.freebasic.net/get',
            'Windows: Download and run the installer',
            'Linux: Download tarball and extract to /opt or ~/freebasic',
            'Add fbc to your PATH environment variable',
            'Verify installation with: fbc -version'
          ].join('\n'),
          verifyCommand: 'fbc -version',
          alternativeValidation: 'Basic syntax checking (balanced keywords)',
          packageManager: 'No package manager (static compilation)',
          documentation: 'https://www.freebasic.net/wiki/DocToc'
        };
      } else if (variant === 'VBNET') {
        return {
          name: this.name,
          compilerName: 'Visual Basic .NET (vbc)',
          downloadUrl: 'https://visualstudio.microsoft.com/downloads/',
          installInstructions: [
            'Install Visual Studio with VB.NET support',
            'Or install .NET SDK from https://dotnet.microsoft.com/download',
            'VBC compiler will be in: C:\\Program Files\\Microsoft Visual Studio\\...',
            'Add compiler directory to PATH',
            'Verify installation with: vbc /help'
          ].join('\n'),
          verifyCommand: 'vbc /help',
          alternativeValidation: 'Basic syntax checking (balanced keywords)',
          packageManager: 'NuGet (for libraries)',
          documentation: 'https://docs.microsoft.com/en-us/dotnet/visual-basic/'
        };
      } else {
        return {
          name: this.name,
          compilerName: `${variant} compiler`,
          downloadUrl: 'https://www.google.com/search?q=' + encodeURIComponent(variant + ' compiler download'),
          installInstructions: 'Please search for installation instructions for ' + variant,
          verifyCommand: 'N/A',
          alternativeValidation: 'Basic syntax checking (balanced keywords)',
          packageManager: 'Varies by dialect',
          documentation: 'https://www.google.com/search?q=' + encodeURIComponent(variant + ' documentation')
        };
      }
    }
  }

  // Register the plugin
  const basicPlugin = new BasicPlugin();
  LanguagePlugins.Add(basicPlugin);

  // Export for potential direct use
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = basicPlugin;
  }

})(); // End of IIFE
