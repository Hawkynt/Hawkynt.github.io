/**
 * Rust Language Plugin for Multi-Language Code Generation
 * (c)2006-2025 Hawkynt
 *
 * Generation flow: IL AST -> RustTransformer -> Rust AST -> RustEmitter -> Rust code
 *
 * The generated file is a complete crate body: the JavaScript runtime (no
 * external crates; BigInt included) and the transpiled code, whose top-level
 * statements run in js_module_init(). Options:
 *   library: true   - only the transpiled items (no runtime), for bundling a
 *                     dependency into a program that already has it
 *   symbolPrefix    - prefix of every top-level name (a bundled dependency
 *                     keeps its names apart this way)
 */

(function () {
  'use strict';

  let LanguagePlugin, LanguagePlugins, RustTransformer, RustEmitter;
  if (typeof require !== 'undefined') {
    const framework = require('./LanguagePlugin.js');
    LanguagePlugin = framework.LanguagePlugin;
    LanguagePlugins = framework.LanguagePlugins;
    RustTransformer = require('./RustTransformer.js').RustTransformer;
    RustEmitter = require('./RustEmitter.js').RustEmitter;
  } else {
    LanguagePlugin = window.LanguagePlugin;
    LanguagePlugins = window.LanguagePlugins;
    RustTransformer = window.RustTransformer;
    RustEmitter = window.RustEmitter;
  }

  class RustPlugin extends LanguagePlugin {
    constructor() {
      super();
      this.name = 'Rust';
      this.extension = 'rs';
      this.icon = '🦀';
      this.description = 'Rust language code generator';
      this.mimeType = 'text/x-rust';
      this.version = '1.70+ (Edition 2021)';
      this.options = {
        indent: '    ',
        lineEnding: '\n',
        addComments: true,
        edition: '2021'
      };
    }

    /**
     * Generate Rust code from the IL AST
     * @param {Object} ast - IL AST
     * @param {Object} options - generation options (see the file header)
     * @returns {CodeGenerationResult}
     */
    GenerateFromAST(ast, options = {}) {
      try {
        if (!ast || typeof ast !== 'object') return this.CreateErrorResult('Invalid AST: must be an object');
        const merged = { ...this.options, ...options };
        const transformer = new RustTransformer({
          library: !!merged.library,
          symbolPrefix: merged.symbolPrefix || '',
          lenient: !!merged.lenient
        });
        const file = transformer.transform(ast);
        const emitter = new RustEmitter({ indent: merged.indent, newline: merged.lineEnding, addComments: merged.addComments });
        const code = emitter.emit(file);
        return this.CreateSuccessResult(code, [], transformer.warnings.slice(0, 50));
      } catch (error) {
        return this.CreateErrorResult(`Code generation failed: ${error.message}`);
      }
    }

    /**
     * Validate Rust code by compiling it, when rustc is installed
     * @override
     */
    ValidateCodeSyntax(code) {
      try {
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        const { execFileSync } = require('child_process');
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rust-validate-'));
        try {
          const file = path.join(dir, 'lib.rs');
          fs.writeFileSync(file, code);
          execFileSync('rustc', ['--crate-type=lib', '-A', 'warnings', '--out-dir', dir, file], { stdio: 'pipe', timeout: 120000, windowsHide: true });
          return { success: true, method: 'rustc', error: null };
        } catch (error) {
          return { success: false, method: 'rustc', error: (error.stderr && error.stderr.toString()) || error.message };
        } finally {
          fs.rmSync(dir, { recursive: true, force: true });
        }
      } catch (error) {
        return { success: false, method: 'basic', error: 'Rust compiler not available' };
      }
    }

    GetCompilerInfo() {
      return {
        name: this.name,
        compilerName: 'Rust (rustc)',
        downloadUrl: 'https://www.rust-lang.org/tools/install',
        installInstructions: 'Install Rust using rustup from https://rustup.rs/, then verify with: rustc --version',
        verifyCommand: 'rustc --version',
        documentation: 'https://doc.rust-lang.org/'
      };
    }
  }

  const rustPlugin = new RustPlugin();
  LanguagePlugins.Add(rustPlugin);
  if (typeof module !== 'undefined' && module.exports) module.exports = rustPlugin;
})();
