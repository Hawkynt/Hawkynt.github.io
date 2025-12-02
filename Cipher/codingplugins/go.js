/**
 * Go Language Plugin for Multi-Language Code Generation
 * Generates Go code from JavaScript AST using AST pipeline
 *
 * Follows the LanguagePlugin specification exactly
 *
 * Generation flow: JS AST -> GoTransformer -> Go AST -> GoEmitter -> Go code
 */

// Import the framework
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let GoEmitter, GoTransformer;

  if (typeof require !== 'undefined') {
    // Node.js environment
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;

    // Load AST pipeline components
    const emitterModule = require('./GoEmitter.js');
    GoEmitter = emitterModule.GoEmitter;
    const transformerModule = require('./GoTransformer.js');
    GoTransformer = transformerModule.GoTransformer;
  } else {
    // Browser environment - use globals
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    GoEmitter = window.GoEmitter;
    GoTransformer = window.GoTransformer;
  }

/**
 * Go Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class GoPlugin extends LanguagePlugin {
  constructor() {
    super();

    // Required plugin metadata
    this.name = 'Go';
    this.extension = 'go';
    this.icon = '🐹';
    this.description = 'Go language code generator';
    this.mimeType = 'text/x-go';
    this.version = '1.21+';

    // Go-specific options
    this.options = {
      indent: '\t', // Go uses tabs by convention
      lineEnding: '\n',
      packageName: 'main',
      addComments: true,
      useStrictTypes: true,
      errorHandling: true,
      useInterfaces: true,
      useGoroutines: true,
      useCrypto: true,
      useGenerics: true, // Go 1.18+
      useContext: true,
      useChannels: true
    };
  }

  /**
   * Generate Go code from Abstract Syntax Tree using AST pipeline
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

      // Step 1: Transform JS AST to Go AST
      const transformer = new GoTransformer({
        packageName: mergedOptions.packageName,
        typeKnowledge: mergedOptions.typeKnowledge,
        addComments: mergedOptions.addComments,
        useStrictTypes: mergedOptions.useStrictTypes,
        errorHandling: mergedOptions.errorHandling,
        useInterfaces: mergedOptions.useInterfaces,
        useGoroutines: mergedOptions.useGoroutines,
        useCrypto: mergedOptions.useCrypto,
        useGenerics: mergedOptions.useGenerics,
        useContext: mergedOptions.useContext,
        useChannels: mergedOptions.useChannels
      });

      const goAst = transformer.transform(ast);

      // Step 2: Emit Go code from Go AST
      const emitter = new GoEmitter({
        indent: mergedOptions.indent,
        newline: mergedOptions.lineEnding,
        addComments: mergedOptions.addComments
      });

      const code = emitter.emit(goAst);

      // Step 3: Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);

      // Step 4: Generate warnings
      const warnings = this._generateWarnings(ast, mergedOptions);

      return this.CreateSuccessResult(code, dependencies, warnings);

    } catch (error) {
      return this.CreateErrorResult(`Code generation failed: ${error.message}`);
    }
  }


  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];

    const goModContent = `module ${options.moduleName || 'generated-go-code'}

go ${options.goVersion || '1.21'}
`;

    dependencies.push({
      name: 'go.mod',
      content: goModContent,
      description: 'Go module file'
    });

    return dependencies;
  }

  /**
   * Generate warnings
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    warnings.push('Consider adding proper error handling');
    warnings.push('Replace interface{} with specific types for better performance');
    return warnings;
  }

  /**
   * Validate Go code syntax
   * @override
   */
  ValidateCodeSyntax(code) {
    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');

      const tempDir = path.join(__dirname, '..', '.agent.tmp', `temp_go_${Date.now()}`);
      const tempFile = path.join(tempDir, 'main.go');

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      fs.writeFileSync(path.join(tempDir, 'go.mod'), `module tempvalidation\n\ngo 1.21\n`);
      fs.writeFileSync(tempFile, code);

      try {
        execSync(`go build -o nul .`, {
          stdio: 'pipe',
          timeout: 3000,
          cwd: tempDir,
          windowsHide: true
        });

        fs.rmSync(tempDir, { recursive: true, force: true });

        return {
          success: true,
          method: 'go',
          error: null
        };
      } catch (error) {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }

        return {
          success: false,
          method: 'go',
          error: error.stderr?.toString() || error.message
        };
      }
    } catch (error) {
      return {
        success: false,
        method: 'basic',
        error: 'Go compiler not available'
      };
    }
  }

  /**
   * Get Go compiler information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'Go',
      downloadUrl: 'https://golang.org/dl/',
      installInstructions: 'Download and install Go from https://golang.org/dl/',
      verifyCommand: 'go version',
      documentation: 'https://golang.org/doc/'
    };
  }
}

// Register the plugin
const goPlugin = new GoPlugin();
LanguagePlugins.Add(goPlugin);

// Export for potential direct use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = goPlugin;
}

})(); // End of IIFE
