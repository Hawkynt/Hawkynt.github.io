/**
 * Go Language Plugin for Multi-Language Code Generation
 * (c)2006-2025 Hawkynt
 *
 * Generation flow: IL AST -> GoTransformer -> Go AST -> GoEmitter -> Go code
 *
 * The generated file is a complete Go program body (package, imports, the
 * JavaScript runtime and the transpiled code). Options:
 *   packageName / namespace  - the package clause (default: main)
 *   library: true            - only the transpiled declarations (no package,
 *                              imports or runtime), for bundling a dependency
 *                              into a program that already has them
 *   symbolPrefix             - prefix of every top-level name (a bundled
 *                              dependency keeps its names apart this way)
 */

(function () {
  'use strict';

  let LanguagePlugin, LanguagePlugins, GoEmitter, GoTransformer;
  if (typeof require !== 'undefined') {
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;
    GoEmitter = require('./GoEmitter.js').GoEmitter;
    GoTransformer = require('./GoTransformer.js').GoTransformer;
  } else {
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    GoEmitter = window.GoEmitter;
    GoTransformer = window.GoTransformer;
  }

  class GoPlugin extends LanguagePlugin {
    constructor() {
      super();
      this.name = 'Go';
      this.extension = 'go';
      this.icon = '🐹';
      this.description = 'Go language code generator';
      this.mimeType = 'text/x-go';
      this.version = '1.21+';
      this.options = {
        indent: '\t',
        lineEnding: '\n',
        packageName: 'main',
        addComments: true
      };
    }

    /**
     * Generate Go code from the IL AST
     * @param {Object} ast - IL AST
     * @param {Object} options - generation options (see the file header)
     * @returns {CodeGenerationResult}
     */
    GenerateFromAST(ast, options = {}) {
      try {
        if (!ast || typeof ast !== 'object') return this.CreateErrorResult('Invalid AST: must be an object');
        const merged = { ...this.options, ...options };
        // A Go program's package is main; a namespace becomes a comment, not a package name
        const packageName = options.packageName || 'main';
        const transformer = new GoTransformer({
          packageName,
          library: !!merged.library,
          symbolPrefix: merged.symbolPrefix || '',
          libraries: merged.libraries,
          lenient: !!merged.lenient
        });
        const file = transformer.transform(ast);
        const emitter = new GoEmitter({ indent: merged.indent, newline: merged.lineEnding, addComments: merged.addComments });
        let code = merged.library ? file.decls.map(d => emitter.decl(d) + emitter.newline).join('') : emitter.emit(file);
        if (merged.namespace && !merged.library) code = `// Namespace: ${merged.namespace}\n` + code;
        return this.CreateSuccessResult(code, this._collectDependencies(merged), transformer.warnings.slice(0, 50));
      } catch (error) {
        return this.CreateErrorResult(`Code generation failed: ${error.message}`);
      }
    }

    _collectDependencies(options) {
      return [{
        name: 'go.mod',
        content: `module ${options.moduleName || 'generated-go-code'}\n\ngo ${options.goVersion || '1.21'}\n`,
        description: 'Go module file'
      }];
    }

    /**
     * Validate Go code by building it, when Go is installed
     * @override
     */
    ValidateCodeSyntax(code) {
      try {
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        const { execFileSync } = require('child_process');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'go-validate-'));
        try {
          fs.writeFileSync(path.join(dir, 'go.mod'), 'module tempvalidation\n\ngo 1.21\n');
          fs.writeFileSync(path.join(dir, 'main.go'), code);
          execFileSync('go', ['vet', '.'], { stdio: 'pipe', timeout: 60000, cwd: dir, windowsHide: true });
          return { success: true, method: 'go', error: null };
        } catch (error) {
          return { success: false, method: 'go', error: (error.stderr && error.stderr.toString()) || error.message };
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (error) {
        return { success: false, method: 'basic', error: 'Go compiler not available' };
      }
    }

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

  const goPlugin = new GoPlugin();
  LanguagePlugins.Add(goPlugin);
  if (typeof module !== 'undefined' && module.exports) module.exports = goPlugin;
})();
