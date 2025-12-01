/**
 * Delphi Language Plugin for Multi-Language Code Generation
 * Generates Delphi/Pascal code from JavaScript AST using the transformer/emitter pattern
 * (c)2006-2025 Hawkynt
 *
 * Follows the LanguagePlugin specification with three-stage pipeline:
 * JS AST -> Delphi AST (via DelphiTransformer) -> Delphi Code (via DelphiEmitter)
 */

(function() {
  'use strict';

  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins, DelphiAST, DelphiTransformer, DelphiEmitter;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load Delphi-specific modules
    DelphiAST = require('./DelphiAST.js');
    const transformerModule = require('./DelphiTransformer.js');
    const emitterModule = require('./DelphiEmitter.js');
    DelphiTransformer = transformerModule.DelphiTransformer;
    DelphiEmitter = emitterModule.DelphiEmitter;
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    DelphiAST = window.DelphiAST;
    DelphiTransformer = window.DelphiTransformer?.DelphiTransformer || window.DelphiTransformer;
    DelphiEmitter = window.DelphiEmitter?.DelphiEmitter || window.DelphiEmitter;
  }

  /**
   * Delphi Code Generator Plugin
   * Extends LanguagePlugin base class
   */
  class DelphiPlugin extends LanguagePlugin {
    constructor() {
      super();

      // Required plugin metadata
      this.name = 'Delphi';
      this.extension = 'pas';
      this.icon = '🏛️';
      this.description = 'Delphi/Object Pascal code generator with modern features';
      this.mimeType = 'text/x-pascal';
      this.version = 'Delphi 12+ / FPC 3.2+';

      // Delphi-specific options
      this.options = {
        indent: '  ',          // 2 spaces (Delphi convention)
        lineEnding: '\n',
        addComments: true,
        useStrictTypes: true,
        unitName: 'GeneratedUnit',
        dialect: 'delphi',     // 'turbo', 'borland', 'delphi', 'freepascal'
        useGenerics: true,
        useInterfaces: true,
        useAttributes: true,
        useInlineFunctions: true,
        useAnonymousMethods: true,
        useRecordHelpers: true,
        useClassHelpers: true,
        errorHandling: true,
        targetFramework: 'Console' // 'Console', 'VCL', 'FMX'
      };

      // Option metadata - defines enum choices
      this.optionsMeta = {
        dialect: {
          type: 'enum',
          choices: [
            { value: 'turbo', label: 'Turbo Pascal', description: 'Turbo Pascal 7.0 for DOS - no OOP classes' },
            { value: 'borland', label: 'Borland Pascal', description: 'Borland Pascal 7.0 with Objects unit' },
            { value: 'delphi', label: 'Delphi', description: 'Modern Delphi (RAD Studio) with full features' },
            { value: 'freepascal', label: 'Free Pascal', description: 'Free Pascal Compiler (FPC) - cross-platform' }
          ]
        },
        targetFramework: {
          type: 'enum',
          choices: [
            { value: 'Console', label: 'Console', description: 'Console application without GUI' },
            { value: 'VCL', label: 'VCL (Windows)', description: 'Visual Component Library for Windows' },
            { value: 'FMX', label: 'FMX (Cross-platform)', description: 'FireMonkey for Windows, macOS, iOS, Android' }
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
        // Generics only available in Delphi and FreePascal
        useGenerics: {
          enabledWhen: { dialect: ['delphi', 'freepascal'] },
          disabledReason: 'Generics require Delphi or Free Pascal'
        },
        // Anonymous methods only in Delphi and FreePascal 3.2+
        useAnonymousMethods: {
          enabledWhen: { dialect: ['delphi', 'freepascal'] },
          disabledReason: 'Anonymous methods require Delphi or Free Pascal 3.2+'
        },
        // Record helpers only in Delphi and FreePascal
        useRecordHelpers: {
          enabledWhen: { dialect: ['delphi', 'freepascal'] },
          disabledReason: 'Record helpers require Delphi or Free Pascal'
        },
        // Attributes only in Delphi
        useAttributes: {
          enabledWhen: { dialect: ['delphi'] },
          disabledReason: 'Attributes require Delphi'
        }
      };
    }

    /**
     * Generate Delphi code from Abstract Syntax Tree
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
        if (!DelphiTransformer || !DelphiEmitter) {
          return this.CreateErrorResult('Delphi transformer/emitter not loaded');
        }

        // Stage 1: Transform JS AST to Delphi AST
        const transformer = new DelphiTransformer({
          unitName: mergedOptions.unitName || 'GeneratedUnit',
          dialect: mergedOptions.dialect || 'delphi',
          useGenerics: mergedOptions.useGenerics,
          typeKnowledge: options.parser?.typeKnowledge || options.typeKnowledge
        });

        const delphiAst = transformer.transform(ast);

        if (!delphiAst) {
          return this.CreateErrorResult('Failed to transform JavaScript AST to Delphi AST');
        }

        // Stage 2: Emit Delphi code from Delphi AST
        const emitter = new DelphiEmitter({
          indent: mergedOptions.indent || '  ',
          newline: mergedOptions.lineEnding || '\n',
          addComments: mergedOptions.addComments !== false
        });

        const code = emitter.emit(delphiAst);

        if (!code) {
          return this.CreateErrorResult('Failed to emit Delphi code from Delphi AST');
        }

        // Collect dependencies
        const dependencies = this._collectDependencies(delphiAst, mergedOptions);

        // Generate warnings
        const warnings = this._generateWarnings(delphiAst, mergedOptions);

        return this.CreateSuccessResult(code, dependencies, warnings);

      } catch (error) {
        return this.CreateErrorResult('Code generation failed: ' + error.message + '\n' + error.stack);
      }
    }

    /**
     * Collect required dependencies from Delphi AST
     * @private
     */
    _collectDependencies(delphiAst, options) {
      const dependencies = [];

      // Analyze uses declarations in the AST
      if (delphiAst.interfaceSection && delphiAst.interfaceSection.uses) {
        for (const use of delphiAst.interfaceSection.uses) {
          if (use.units) {
            dependencies.push(...use.units);
          }
        }
      }

      // Remove duplicates
      return [...new Set(dependencies)];
    }

    /**
     * Generate warnings about potential issues
     * @private
     */
    _generateWarnings(delphiAst, options) {
      const warnings = [];

      // Delphi-specific warnings
      warnings.push('Review memory management - Delphi uses reference counting for interfaces and manual management for objects');
      warnings.push('Consider using try-finally blocks for resource cleanup');

      if (options.dialect === 'turbo' || options.dialect === 'borland') {
        warnings.push('Legacy Pascal dialect - many modern features not available');
      }

      if (!options.errorHandling) {
        warnings.push('Error handling disabled - consider using try-except blocks');
      }

      if (options.useGenerics && options.dialect === 'freepascal') {
        warnings.push('Free Pascal generics syntax differs slightly from Delphi - review generated code');
      }

      return warnings;
    }

    /**
     * Validate Delphi code syntax using Free Pascal Compiler or Delphi Compiler
     * @override
     */
    ValidateCodeSyntax(code) {
      // Check if compiler is available first
      if (!this._isDelphiCompilerAvailable() && !this._isFPCAvailable()) {
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'Delphi/FPC compiler not available - using basic validation'
        };
      }

      try {
        const fs = require('fs');
        const path = require('path');
        const { execSync } = require('child_process');

        // Create temporary file
        const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_delphi_${Date.now()}.pas`);

        // Ensure .agent.tmp directory exists
        const tempDir = path.dirname(tempFile);
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        // Write Delphi code to temp file
        fs.writeFileSync(tempFile, code);

        try {
          // Try Free Pascal Compiler first (more commonly available)
          if (this._isFPCAvailable()) {
            execSync(`fpc -vw -l "${tempFile}"`, {
              stdio: 'pipe',
              timeout: 3000,
              windowsHide: true
            });
          } else {
            // Try Delphi Compiler
            execSync(`dcc32 -NSSystem -B "${tempFile}"`, {
              stdio: 'pipe',
              timeout: 3000,
              windowsHide: true
            });
          }

          // Clean up
          fs.unlinkSync(tempFile);

          // Clean up any generated files
          const baseName = path.basename(tempFile, '.pas');
          const generatedFiles = [
            path.join(tempDir, baseName + '.dcu'),
            path.join(tempDir, baseName + '.o'),
            path.join(tempDir, baseName + '.ppu'),
            path.join(tempDir, baseName)
          ];

          for (const genFile of generatedFiles) {
            if (fs.existsSync(genFile)) {
              fs.unlinkSync(genFile);
            }
          }

          return {
            success: true,
            method: this._isFPCAvailable() ? 'fpc' : 'dcc32',
            error: null
          };

        } catch (error) {
          // Clean up on error
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
          }

          return {
            success: false,
            method: this._isFPCAvailable() ? 'fpc' : 'dcc32',
            error: error.stderr?.toString() || error.message
          };
        }

      } catch (error) {
        // If compiler is not available or other error, fall back to basic validation
        const isBasicSuccess = this._checkBalancedSyntax(code);
        return {
          success: isBasicSuccess,
          method: 'basic',
          error: isBasicSuccess ? null : 'Compiler error: ' + error.message
        };
      }
    }

    /**
     * Check if Delphi compiler is available on the system
     * @private
     */
    _isDelphiCompilerAvailable() {
      try {
        const { execSync } = require('child_process');
        execSync('dcc32 --version', {
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
     * Check if Free Pascal Compiler is available on the system
     * @private
     */
    _isFPCAvailable() {
      try {
        const { execSync } = require('child_process');
        execSync('fpc -h', {
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
     * Basic syntax validation for Delphi code (balanced keywords, etc.)
     * @private
     */
    _checkBalancedSyntax(code) {
      try {
        let beginCount = 0;
        let endCount = 0;
        let caseCount = 0;
        let recordCount = 0;
        let classCount = 0;

        // Simple regex-based checking (not perfect but catches obvious errors)
        const lines = code.split('\n');

        for (const line of lines) {
          const trimmed = line.trim().toLowerCase();

          // Skip comments
          if (trimmed.startsWith('//') || trimmed.startsWith('{') || trimmed.startsWith('(*')) {
            continue;
          }

          // Count begins and ends
          if (/\bbegin\b/.test(trimmed)) beginCount++;
          if (/\bend\b/.test(trimmed)) endCount++;

          // Count case...of...end
          if (/\bcase\b/.test(trimmed)) caseCount++;

          // Count record...end
          if (/\brecord\b/.test(trimmed)) recordCount++;

          // Count class...end
          if (/\bclass\b/.test(trimmed)) classCount++;
        }

        // Basic balance check
        return beginCount === endCount;

      } catch (error) {
        return false;
      }
    }

    /**
     * Get Delphi compiler download information
     * @override
     */
    GetCompilerInfo() {
      return {
        name: this.name,
        compilerName: 'Delphi Compiler / Free Pascal Compiler',
        downloadUrl: 'https://www.embarcadero.com/products/delphi or https://www.freepascal.org/',
        installInstructions: [
          'Delphi (Commercial):',
          '  Download from https://www.embarcadero.com/products/delphi',
          '  Install RAD Studio or Delphi Community Edition',
          '  Add compiler directory to PATH (e.g., C:\\Program Files (x86)\\Embarcadero\\Studio\\22.0\\bin)',
          '',
          'Free Pascal (Open Source):',
          '  Download from https://www.freepascal.org/download.html',
          '  Windows: Run the installer and add to PATH',
          '  Linux: sudo apt-get install fpc or equivalent',
          '  macOS: brew install fpc',
          '',
          'Verify installation:',
          '  Delphi: dcc32 --version',
          '  FPC: fpc -h'
        ].join('\n'),
        verifyCommand: 'dcc32 --version OR fpc -h',
        alternativeValidation: 'Basic syntax checking (balanced begin/end keywords)',
        packageManager: 'GetIt Package Manager (Delphi) / OPM (FPC)',
        documentation: 'https://docwiki.embarcadero.com/RADStudio/en/Main_Page or https://www.freepascal.org/docs.html'
      };
    }
  }

  // Register the plugin
  const delphiPlugin = new DelphiPlugin();
  LanguagePlugins.Add(delphiPlugin);

  // Export for potential direct use
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = delphiPlugin;
  }

})(); // End of IIFE
