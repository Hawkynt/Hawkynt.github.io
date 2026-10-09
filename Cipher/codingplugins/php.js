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

        // Stage 1: Transform the IL AST to the annotated JavaScript AST
        const transformer = new PhpTransformer(mergedOptions);
        const phpAst = transformer.transform(ast);

        if (!phpAst) {
          return this.CreateErrorResult('Failed to transform JavaScript AST to PHP AST');
        }

        // Stage 2: Emit PHP in a namespace of the file's own, so bundled
        // files cannot collide
        const base = String(mergedOptions.namespace || 'CipherValidation').replace(/\./g, '\\');
        // (a namespace segment cannot start with a digit: 3des is _3des)
        const unit = mergedOptions.className ? String(mergedOptions.className).replace(/[^A-Za-z0-9_]/g, '_').replace(/^(\d)/, '_$1') : null;
        const emitter = new PhpEmitter({
          indent: mergedOptions.indent,
          newline: mergedOptions.lineEnding,
          namespace: unit ? `${base}\\${unit}` : base,
          framework: this._frameworkSurface()
        });
        let code = emitter.emit(phpAst);

        if (!code) {
          return this.CreateErrorResult('Failed to emit PHP code from PHP AST');
        }

        // A standalone file carries the runtime (Node only: it is read from
        // disk); a fragment for bundling (generateTestHarness: false) carries
        // neither the runtime nor the opening tag
        if (mergedOptions.generateTestHarness) code = this._buildStandalonePrelude() + code;
        else if (mergedOptions.generateTestHarness !== false) code = '<?php' + (mergedOptions.lineEnding || '\n') + code;

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
     * The framework's names as the emitted code reaches them: classes,
     * functions and values (the enums, the registry). Read from the live
     * AlgorithmFramework, so it cannot drift from it.
     * @private
     */
    _frameworkSurface() {
      if (this._surface) return this._surface;
      let AF = null;
      try {
        AF = typeof require !== 'undefined' ? require('../AlgorithmFramework.js') : (typeof window !== 'undefined' ? window.AlgorithmFramework : null);
      } catch (e) {
        AF = null;
      }
      const surface = { classes: [], functions: [], values: [], methods: [], namespace: 'AlgorithmFramework' };
      if (AF) {
        const methods = new Set();
        for (const name of Object.keys(AF)) {
          if (name === 'default') continue;
          const value = AF[name];
          if (typeof value === 'function') {
            if (/^class\b/.test(Function.prototype.toString.call(value))) {
              surface.classes.push(name);
              for (const m of Object.getOwnPropertyNames(value.prototype)) {
                const d = Object.getOwnPropertyDescriptor(value.prototype, m);
                if (m !== 'constructor' && d && typeof d.value === 'function') methods.add(m);
              }
            } else surface.functions.push(name);
          } else {
            surface.values.push(name);
          }
        }
        surface.methods = [...methods];
      }
      this._surface = surface;
      return surface;
    }

    /**
     * The runtime a standalone PHP file carries ahead of the algorithm:
     * php-runtime.php (JavaScript semantics), then OpCodes.js and
     * AlgorithmFramework.js themselves, transpiled by this same pipeline, so
     * the PHP OpCodes and framework cannot drift from the JavaScript ones.
     * OpCodes' object literal becomes a class of static methods (its one
     * constructor function, _BitStream, the class OpCodes__BitStream).
     * Node only (it reads the sources from disk).
     * @private
     * @returns {string} PHP source, starting with the opening tag
     */
    _buildStandalonePrelude() {
      if (this._standalonePrelude) return this._standalonePrelude;
      const fs = require('fs');
      const path = require('path');
      const rootDir = path.join(__dirname, '..');
      const nl = '\n';
      const quiet = fn => { const log = console.log; console.log = () => {}; try { return fn(); } finally { console.log = log; } };
      const { TypeAwareJSASTParser } = quiet(() => require('../type-aware-transpiler.js'));

      // The runtime, its namespace braced so that the other namespaces can follow it
      let runtime = fs.readFileSync(path.join(__dirname, 'php-runtime.php'), 'utf8');
      runtime = runtime.replace(/^<\?php\s*/, '').replace(/^namespace JS;\s*$/m, 'namespace JS {') + nl + '}' + nl;

      const unit = (source, namespace) => quiet(() => {
        const il = new TypeAwareJSASTParser(source, { keepModuleLoaderFunctions: true }).parse();
        const ast = new PhpTransformer({}).transform(il);
        return new PhpEmitter({ namespace, framework: this._frameworkSurface() }).emit(ast);
      });

      const opcodes = unit(this._opCodesAsClass(fs.readFileSync(path.join(rootDir, 'OpCodes.js'), 'utf8')), '');
      const framework = unit(this._insertSemicolons(fs.readFileSync(path.join(rootDir, 'AlgorithmFramework.js'), 'utf8')), 'AlgorithmFramework');

      this._standalonePrelude = '<?php' + nl
        + '// ==== JavaScript semantics (codingplugins/php-runtime.php) ====' + nl + runtime
        + '// ==== OpCodes.js, transpiled ====' + nl + opcodes
        + '// ==== AlgorithmFramework.js, transpiled ====' + nl + framework;
      return this._standalonePrelude;
    }

    /**
     * JavaScript written without semicolons (AlgorithmFramework.js), with the
     * semicolons automatic semicolon insertion puts where a line ends a
     * statement, for the transpiler's parser, which needs them.
     * @private
     */
    _insertSemicolons(src) {
      const tokens = [];
      const n = src.length;
      let i = 0, newline = false;
      const PUNCT = ['>>>=', '...', '===', '!==', '**=', '<<=', '>>=', '>>>', '&&=', '||=', '??=', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '?.', '++', '--',
        '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '**', '{', '}', '(', ')', '[', ']', ';', ',', '<', '>', '+', '-', '*', '/', '%',
        '&', '|', '^', '!', '~', '?', ':', '=', '.', '@', '#'];
      const regexAfter = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '&&', '||', '??', 'return', 'typeof', '=>', '==', '===', '!=', '!==', '+', '-', '*', '%']);
      while (i < n) {
        const c = src[i];
        if (c === '\n') { newline = true; ++i; continue; }
        if (/\s/.test(c)) { ++i; continue; }
        if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') ++i; continue; }
        if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); if (src.slice(i, e).includes('\n')) newline = true; i = e + 2; continue; }
        const start = i;
        let type;
        if (c === '"' || c === "'") {
          ++i; while (i < n && src[i] !== c) { if (src[i] === '\\') ++i; ++i; } ++i; type = 'str';
        } else if (c === '`') {
          ++i; let depth = 0;
          while (i < n) {
            if (src[i] === '\\') { i += 2; continue; }
            if (depth === 0 && src[i] === '`') break;
            if (src[i] === '$' && src[i + 1] === '{') { ++depth; i += 2; continue; }
            if (depth > 0 && src[i] === '}') { --depth; ++i; continue; }
            ++i;
          }
          ++i; type = 'str';
        } else if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
          while (i < n && /[0-9a-zA-Z_.]/.test(src[i])) ++i; type = 'num';
        } else if (/[A-Za-z_$]/.test(c)) {
          while (i < n && /[\w$]/.test(src[i])) ++i; type = 'id';
        } else if (c === '/' && (!tokens.length || regexAfter.has(tokens[tokens.length - 1].value))) {
          ++i; let inClass = false;
          while (i < n && (src[i] !== '/' || inClass)) { if (src[i] === '\\') ++i; else if (src[i] === '[') inClass = true; else if (src[i] === ']') inClass = false; ++i; }
          ++i; while (i < n && /[a-z]/.test(src[i])) ++i; type = 'regex';
        } else {
          const p = PUNCT.find(op => src.startsWith(op, i));
          i += p ? p.length : 1; type = 'punct';
        }
        tokens.push({ type, value: src.slice(start, i), start, end: i, newlineBefore: newline });
        newline = false;
      }
      // Which ')' close the condition of a statement (no semicolon after them)
      const opener = [];
      const conditionClose = new Set();
      tokens.forEach((t, k) => {
        if (t.value === '(') opener.push(k);
        else if (t.value === ')') { const o = opener.pop(); if (o > 0 && ['if', 'for', 'while', 'switch', 'catch', 'with'].includes(tokens[o - 1].value)) conditionClose.add(k); }
      });
      const NO_END = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'try', 'catch', 'finally', 'function', 'class', 'extends', 'new',
        'typeof', 'instanceof', 'in', 'of', 'const', 'let', 'var', 'case', 'default', 'throw', 'delete', 'void', 'yield', 'await', 'async', 'static']);
      const CONTINUES = new Set(['.', '?.', ',', '?', ':', ')', ']', '}', '=>', '=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '>>>=', '**=',
        '&&', '||', '??', '==', '!=', '===', '!==', '<', '>', '<=', '>=', '<<', '>>', '>>>', '+', '-', '*', '/', '%', '**', '&', '|', '^',
        'else', 'catch', 'finally', 'instanceof', 'in', 'of', '(', '[', ';']);
      // Which '}' close a block (a statement may end before them) rather than an object literal
      const braces = [];
      const blockClose = new Set();
      tokens.forEach((t, k) => {
        if (t.value === '{') {
          const before = k > 0 ? tokens[k - 1] : null;
          braces.push(!before || [')', 'else', 'try', 'finally', 'do', '=>', ';', '}', '{', 'static'].includes(before.value)
            || (before.type === 'id' && !['return', 'typeof', 'case', 'in', 'of', 'new', 'void', 'yield', 'await', 'throw', 'delete', 'instanceof'].includes(before.value)));
        } else if (t.value === '}') {
          if (braces.pop()) blockClose.add(k);
        }
      });
      const endsStatement = k => {
        const t = tokens[k];
        return (t.type !== 'punct' && !NO_END.has(t.value)) || [']', '++', '--'].includes(t.value) || (t.value === ')' && !conditionClose.has(k));
      };
      let out = '';
      let at = 0;
      for (let k = 1; k < tokens.length; ++k) {
        const prev = tokens[k - 1], next = tokens[k];
        const beforeBlockEnd = blockClose.has(k) && endsStatement(k - 1);
        if (!beforeBlockEnd) {
          if (!next.newlineBefore || !endsStatement(k - 1)) continue;
          if (CONTINUES.has(next.value) || (next.type === 'str' && next.value[0] === '`')) continue;
        }
        out += src.slice(at, prev.end) + ';';
        at = prev.end;
      }
      return out + src.slice(at);
    }

    /**
     * The standalone runtime prelude (see _buildStandalonePrelude), for the
     * validation's bundling of dependencies between it and the class code.
     * @returns {string}
     */
    GetStandalonePrelude() {
      return this._buildStandalonePrelude();
    }

    /**
     * OpCodes.js with its object literal written as a class of static
     * members: `Name: function (...) {...}` becomes `static Name(...) {...}`,
     * `Name: value` a static property, and a constructor function (one
     * assigning `this.x`) a class of its own named OpCodes_<Name>.
     * @private
     */
    _opCodesAsClass(source) {
      const start = source.indexOf('const OpCodes = {');
      const end = source.indexOf('// Export to global scope');
      const body = source.slice(start + 'const OpCodes = {'.length, source.lastIndexOf('};', end));
      const lines = body.split('\n');
      // Members start at exactly four spaces: "    Name: ..."
      const starts = [];
      lines.forEach((l, i) => { if (/^    [A-Za-z_$][\w$]*\s*:/.test(l)) starts.push(i); });
      const members = [];
      const extraClasses = [];
      for (let k = 0; k < starts.length; ++k) {
        // The member's own lines, and the doc comment above it
        let first = starts[k];
        while (first > 0 && /^\s*(\/\*\*|\*|\*\/)/.test(lines[first - 1])) --first;
        // ...up to the next member's doc comment (or the end)
        let last = (k + 1 < starts.length ? starts[k + 1] : lines.length) - 1;
        while (last > starts[k] && /^\s*(\/\*\*|\*|\*\/|\/\/|$)/.test(lines[last])) --last;
        let chunk = lines.slice(starts[k], last + 1).join('\n');
        const doc = lines.slice(first, starts[k]).join('\n');
        // Drop the separating comma
        chunk = chunk.trimEnd().replace(/,$/, '');
        const fn = /^    ([A-Za-z_$][\w$]*)\s*:\s*function\s*\(([^)]*)\)\s*\{/.exec(chunk);
        if (fn) {
          const rest = chunk.slice(fn[0].length);
          if (/^\s*this\.\w+\s*=/m.test(rest)) {
            extraClasses.push(`${doc}\nclass OpCodes_${fn[1]} {\n  constructor(${fn[2]}) {${rest}\n}`);
          } else {
            members.push(`${doc}\n    static ${fn[1]}(${fn[2]}) {${rest}`);
          }
          continue;
        }
        const value = /^    ([A-Za-z_$][\w$]*)\s*:\s*([\s\S]*)$/.exec(chunk);
        if (value) members.push(`${doc}\n    static ${value[1]} = ${value[2]};`);
      }
      return `class OpCodes {\n${members.join('\n\n')}\n}\n\n${extraClasses.join('\n\n')}\n`;
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

    /**
     * Generate PHP test runner code from ILTestRunner node
     * @param {Object} testRunner - ILTestRunner node with structure:
     *   {
     *     tests: [
     *       {
     *         algorithmClass: "AlgorithmClassName",
     *         instanceClass: "InstanceClassName",
     *         testCases: [
     *           { input: [byte array], expected: [byte array], key: [optional], iv: [optional], description: "test desc" }
     *         ]
     *       }
     *     ]
     *   }
     * @returns {string} PHP test runner code
     */
    generateTestRunner(testRunner) {
      if (!testRunner || !testRunner.tests || !Array.isArray(testRunner.tests)) {
        throw new Error('Invalid ILTestRunner node structure');
      }

      const lines = [];

      // PHP opening tag with strict types
      lines.push('<?php');
      if (this.options.strictTypes) {
        lines.push('declare(strict_types=1);');
      }
      lines.push('');
      lines.push('// Generated test runner');
      lines.push('');
      lines.push('// Test execution begins after class definitions');
      lines.push('');

      // Helper function to format byte array
      const formatByteArray = (bytes) => {
        if (!bytes || bytes.length === 0) {
          return '[]';
        }
        const hexValues = bytes.map(b => '0x' + ('0' + (b & 0xFF).toString(16).toUpperCase()).slice(-2));
        return '[' + hexValues.join(', ') + ']';
      };

      // Helper function to convert byte array to hex string for display
      const bytesToHex = (bytes) => {
        return bytes.map(b => ('0' + (b & 0xFF).toString(16).toUpperCase()).slice(-2)).join('');
      };

      // Generate main test code block
      lines.push('// === TEST RUNNER ===');
      lines.push('');
      lines.push('$totalTests = 0;');
      lines.push('$passedTests = 0;');
      lines.push('$failedTests = 0;');
      lines.push('');

      let testNumber = 1;

      // Iterate through each algorithm's tests
      for (const algorithmTest of testRunner.tests) {
        const { algorithmClass, instanceClass, testCases } = algorithmTest;

        if (!algorithmClass || !testCases || testCases.length === 0) {
          continue;
        }

        lines.push(`// Testing ${algorithmClass}`);
        lines.push(`echo "\\n=== Testing ${algorithmClass} ===\\n";`);
        lines.push('');

        // Generate tests for each test case
        for (const testCase of testCases) {
          const { input, expected, key, iv, nonce, outputSize, description } = testCase;

          if (!input || !expected) {
            continue;
          }

          const testLabel = description || `Test ${testNumber}`;

          lines.push(`// ${testLabel}`);
          lines.push(`echo "\\nTest #${testNumber}: ${testLabel}\\n";`);
          lines.push('$totalTests++;');
          lines.push('');

          // Create algorithm instance
          lines.push(`$algo = new ${algorithmClass}();`);

          // Create instance (use instanceClass if provided, otherwise assume CreateInstance method)
          if (instanceClass) {
            lines.push(`$instance = new ${instanceClass}($algo, false);`);
          } else {
            lines.push('$instance = $algo->CreateInstance(false);');
          }
          lines.push('');

          // Set properties if provided
          if (key) {
            const keyArray = formatByteArray(key);
            lines.push(`$instance->key = ${keyArray};`);
          }

          if (iv) {
            const ivArray = formatByteArray(iv);
            lines.push(`$instance->iv = ${ivArray};`);
          }

          if (nonce) {
            const nonceArray = formatByteArray(nonce);
            lines.push(`$instance->nonce = ${nonceArray};`);
          }

          if (outputSize !== undefined && outputSize !== null) {
            lines.push(`$instance->outputSize = ${outputSize};`);
          }

          if (key || iv || nonce || (outputSize !== undefined && outputSize !== null)) {
            lines.push('');
          }

          // Feed input
          const inputArray = formatByteArray(input);
          lines.push(`$input = ${inputArray};`);
          lines.push('$instance->Feed($input);');
          lines.push('');

          // Get result
          lines.push('$actual = $instance->Result();');
          lines.push('');

          // Expected output
          const expectedArray = formatByteArray(expected);
          lines.push(`$expected = ${expectedArray};`);
          lines.push('');

          // Compare byte-by-byte
          lines.push('// Compare actual vs expected');
          lines.push('$match = count($actual) === count($expected);');
          lines.push('if ($match) {');
          lines.push('    for ($i = 0; $i < count($actual); $i++) {');
          lines.push('        if ($actual[$i] !== $expected[$i]) {');
          lines.push('            $match = false;');
          lines.push('            break;');
          lines.push('        }');
          lines.push('    }');
          lines.push('}');
          lines.push('');

          // Report result
          lines.push('if ($match) {');
          lines.push(`    echo "PASS: ${testLabel}\\n";`);
          lines.push('    $passedTests++;');
          lines.push('} else {');
          lines.push(`    echo "FAIL: ${testLabel}\\n";`);
          lines.push('    echo "  Expected: " . bin2hex(pack("C*", ...$expected)) . "\\n";');
          lines.push('    echo "  Actual:   " . bin2hex(pack("C*", ...$actual)) . "\\n";');
          lines.push('    $failedTests++;');
          lines.push('}');
          lines.push('');

          testNumber++;
        }
      }

      // Summary and exit
      lines.push('// === TEST SUMMARY ===');
      lines.push('echo "\\n=== Test Summary ===\\n";');
      lines.push('echo "Total tests: $totalTests\\n";');
      lines.push('echo "Passed: $passedTests\\n";');
      lines.push('echo "Failed: $failedTests\\n";');
      lines.push('');
      lines.push('if ($failedTests === 0) {');
      lines.push('    echo "\\nAll tests passed!\\n";');
      lines.push('    exit(0);');
      lines.push('} else {');
      lines.push('    echo "\\n$failedTests test(s) failed!\\n";');
      lines.push('    exit(1);');
      lines.push('}');

      return lines.join('\n');
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
