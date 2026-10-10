/**
 * TypeScript Language Plugin for Multi-Language Code Generation
 * Generates TypeScript compatible code from JavaScript AST
 *
 * Follows the LanguagePlugin specification exactly
 *
 * Uses AST pipeline: JS AST -> TS AST (via TypeScriptTransformer) -> TS Code (via TypeScriptEmitter)
 */

// Import the framework
// Import the framework (Node.js environment)
(function() {
  // Use local variables to avoid global conflicts
  let LanguagePlugin, LanguagePlugins;
  let TypeScriptAST, TypeScriptEmitter, TypeScriptTransformer;

if (typeof require !== 'undefined') {
  // Node.js environment
  const framework = require('./LanguagePlugin.js');
  LanguagePlugin = framework.LanguagePlugin;
  LanguagePlugins = framework.LanguagePlugins;

  // Load AST pipeline components (required)
  try {
    TypeScriptAST = require('./TypeScriptAST.js');
    const emitterModule = require('./TypeScriptEmitter.js');
    TypeScriptEmitter = emitterModule.TypeScriptEmitter;
    const transformerModule = require('./TypeScriptTransformer.js');
    TypeScriptTransformer = transformerModule.TypeScriptTransformer;
  } catch (e) {
    // Pipeline components not available - plugin will fail
    console.warn('TypeScript AST pipeline components not loaded:', e.message);
  }
} else {
  // Browser environment - use globals
  LanguagePlugin = window.LanguagePlugin;
  LanguagePlugins = window.LanguagePlugins;
  TypeScriptAST = window.TypeScriptAST;
  TypeScriptEmitter = window.TypeScriptEmitter;
  TypeScriptTransformer = window.TypeScriptTransformer;
}

/**
 * TypeScript Code Generator Plugin
 * Extends LanguagePlugin base class
 */
class TypeScriptPlugin extends LanguagePlugin {
  constructor() {
    super();
    
    // Required plugin metadata
    this.name = 'TypeScript';
    this.extension = 'ts';
    this.icon = '📘';
    this.description = 'TypeScript code generator';
    this.mimeType = 'text/x-typescript';
    this.version = '5.0+';
    
    // TypeScript-specific options
    this.options = {
      indent: '  ', // 2 spaces (common TS convention)
      lineEnding: '\n',
      strictTypes: true,
      addJSDoc: true,
      useInterfaces: true,
      exportAll: false
    };
  }

  /**
   * Generate TypeScript code from Abstract Syntax Tree
   * Uses AST pipeline: JS AST -> TS AST -> TS Emitter -> TS Source
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

      // Validate AST pipeline components are available
      if (!TypeScriptTransformer || !TypeScriptEmitter) {
        return this.CreateErrorResult('TypeScript AST pipeline components not loaded');
      }

      // Create transformer with options
      const transformer = new TypeScriptTransformer({
        frameworkSurface: this._frameworkSurface()
      });

      // Transform JS AST to TypeScript AST
      const tsAst = transformer.transform(ast);

      // Create emitter with options
      const emitter = new TypeScriptEmitter({
        indent: mergedOptions.indent || '  ',
        newline: mergedOptions.lineEnding || mergedOptions.newline || '\n'
      });

      // Emit TypeScript code from TypeScript AST
      let code = emitter.emit(tsAst);

      // A standalone runnable file (test harness generation) carries the
      // runtime the classes depend on: the real OpCodes.js and
      // AlgorithmFramework.js, made TypeScript (see _buildStandalonePrelude).
      // The algorithm's own code gets a function scope of its own, the
      // isolation its UMD factory gave it, so its top-level names cannot
      // collide with the runtime's.
      if (mergedOptions.generateTestHarness) {
        const nl = mergedOptions.lineEnding || mergedOptions.newline || '\n';
        code = this._buildStandalonePrelude() + nl + '(function () {' + nl + code + nl + '})();' + nl;
      }

      // Collect dependencies
      const dependencies = this._collectDependencies(ast, mergedOptions);

      // Generate warnings if any
      const warnings = this._generateWarnings(ast, mergedOptions);

      return this.CreateSuccessResult(code, dependencies, warnings);

    } catch (error) {
      return this.CreateErrorResult(`Code generation failed: ${error.message}\n${error.stack}`);
    }
  }


  /**
   * The framework's classes as the type checker sees them: per class its
   * base, its methods and accessors, and the properties an instance has.
   * Read from the live AlgorithmFramework (Node: required; browser: the
   * global), so it cannot drift from it.
   * @private
   * @returns {{classes: Object<string, {base: string|null, members: string[], fields: string[]}>}}
   */
  _frameworkSurface() {
    if (this._surface) return this._surface;
    let AF = null;
    try {
      AF = typeof require !== 'undefined' ? require('../AlgorithmFramework.js') : (typeof window !== 'undefined' ? window.AlgorithmFramework : null);
    } catch (e) {
      AF = null;
    }
    const classes = {};
    if (AF) {
      for (const name of Object.keys(AF)) {
        const ctor = AF[name];
        if (typeof ctor !== 'function' || !/^[A-Z]/.test(name) || !ctor.prototype) continue;
        const parent = Object.getPrototypeOf(ctor);
        const members = Object.getOwnPropertyNames(ctor.prototype).filter(m => m !== 'constructor');
        let fields = [];
        try { fields = Object.keys(new ctor(null)); } catch (e) { fields = []; }
        classes[name] = { base: parent && parent.name && AF[parent.name] === parent ? parent.name : null, members, fields };
      }
    }
    this._surface = { classes };
    return this._surface;
  }

  /**
   * The runtime a standalone TypeScript file carries ahead of its classes:
   * the real OpCodes.js object and AlgorithmFramework.js classes, verbatim
   * except for what TypeScript needs on top of JavaScript - the classes
   * declare the properties their constructors assign (typed from their
   * JSDoc), the few lines of OpCodes the checker cannot type are marked, and
   * the Node globals the runtime touches are declared. Node-only (it reads
   * the sources from disk).
   * @private
   * @returns {string} TypeScript source
   */
  _buildStandalonePrelude() {
    if (this._standalonePrelude) return this._standalonePrelude;
    const fs = require('fs');
    const path = require('path');
    const { tsTypeOf } = require('./TypeScriptTransformer.js');
    const rootDir = path.join(__dirname, '..');
    const opCodesSrc = fs.readFileSync(path.join(rootDir, 'OpCodes.js'), 'utf8');
    const frameworkSrc = fs.readFileSync(path.join(rootDir, 'AlgorithmFramework.js'), 'utf8');
    const known = { classes: new Set(Object.keys(this._frameworkSurface().classes)) };

    // OpCodes: the object literal itself
    const opStart = opCodesSrc.indexOf('const OpCodes = {');
    const opEnd = opCodesSrc.indexOf('// Export to global scope');
    if (opStart < 0 || opEnd < 0) throw new Error('OpCodes.js: the OpCodes object literal was not found');
    // Lines whose JavaScript the checker rejects though it runs as intended
    // (a BigInt/Number mix, a constructor called without its argument, a
    // comparison inside a bitwise and)
    const untypable = [/&\s*\d+\s*!==\s*0/,/new OpCodes\._BitStream\(\)/, /const nextS = oldS - q \* s/];
    let opCodes = this._optionalParameters(opCodesSrc.slice(opStart, opEnd).split('\n').map(line =>
      untypable.some(re => re.test(line)) ? line.replace(/^(\s*)/, '$1// @ts-ignore\n$1') : line).join('\n').trimEnd());
    // Every OpCodes function returns what its JSDoc says, and takes the
    // BigInts it says it takes (inferred from a body working on untyped
    // parameters, a BigInt result would be a number); its other parameters
    // take what JavaScript passes them (a truthy number for a boolean, a
    // BigInt fill value), as they always have
    opCodes = opCodes.replace(/(\/\*\*((?:(?!\*\/)[\s\S])*?)\*\/\s*\n\s*\w+\s*:\s*function\s*)\(([^()]*)\)(\s*\{)/g, (all, head, doc, params, brace) => {
      const paramTypes = new Map();
      for (const p of doc.matchAll(/@param\s*\{([^}]+)\}\s*\[?(\w+)/g)) paramTypes.set(p[2], p[1]);
      const typed = params.split(',').map(p => {
        const m = /^(\s*)(\.\.\.)?(\w+)(\??)(\s*)$/.exec(p);
        if (!m || m[2] || !paramTypes.has(m[3])) return p;
        const type = tsTypeOf(paramTypes.get(m[3]), known);
        return type === 'bigint' || type === 'bigint[]' ? `${m[1]}${m[3]}${m[4]}: ${type}${m[5]}` : p;
      }).join(',');
      const returns = /@returns?\s*\{([^}]+)\}/.exec(doc);
      return `${head}(${typed})${returns ? `: ${tsTypeOf(returns[1], known)}` : ''}${brace}`;
    });

    // AlgorithmFramework: the factory's body at top level, so its classes are
    // types as well as values, and the object it returns
    const bodyStart = frameworkSrc.indexOf("'use strict';", frameworkSrc.indexOf('function () {'));
    const returnAt = frameworkSrc.lastIndexOf('return {');
    const returnEnd = frameworkSrc.indexOf('};', returnAt);
    if (bodyStart < 0 || returnAt < 0 || returnEnd < 0) throw new Error('AlgorithmFramework.js: the factory body was not found');
    let framework = frameworkSrc.slice(bodyStart + "'use strict';".length, returnAt);
    const exported = frameworkSrc.slice(returnAt + 'return '.length, returnEnd + 1);
    framework = this._optionalParameters(this._declareFrameworkProperties(framework, known, tsTypeOf))
      // A subclass may hand its base constructor more than it takes
      .replace(/^(\s*constructor\([^()]*)\)(\s*\{)/gm, (all, head, brace) => `${head}${/\(\s*$/.test(head) ? '' : ', '}..._extra: any[])${brace}`);

    this._standalonePrelude = [
      '// ==== runtime environment (Node.js) ====',
      'declare const console: { log(...data: any[]): void; error(...data: any[]): void; warn(...data: any[]): void; info(...data: any[]): void };',
      'declare class TextEncoder { encode(input?: string): Uint8Array; }',
      'declare class TextDecoder { constructor(label?: string, options?: any); decode(input?: any, options?: any): string; }',
      'declare const require: any;',
      'declare const module: any;',
      'declare const global: any;',
      'declare const process: any;',
      'declare const define: any;',
      'declare const exports: any;',
      'declare const window: any;',
      'declare const self: any;',
      'declare const crypto: any;',
      'declare const performance: any;',
      'declare const Buffer: any;',
      '/** An array of numbers: a JavaScript Array or a typed array; the IL does not tell them apart */',
      'type NumericArray = any;',
      '// ==== embedded runtime: OpCodes.js ====',
      opCodes,
      '// ==== embedded runtime: AlgorithmFramework.js ====',
      framework.trim(),
      `const AlgorithmFramework = ${exported};`,
      ''
    ].join('\n');
    return this._standalonePrelude;
  }

  /**
   * Mark every plain parameter of the runtime's functions, methods and
   * constructors optional, as every JavaScript parameter is (a caller may
   * leave any argument out). Setters keep theirs: TypeScript requires it.
   * @private
   */
  _optionalParameters(source) {
    const optional = params => params.split(',').map(p => {
      const name = p.trim();
      return /^[A-Za-z_$][\w$]*$/.test(name) ? p.replace(name, name + '?') : p;
    }).join(',');
    return source
      .replace(/\bfunction(\s+\w+)?\s*\(([^()]*)\)/g, (all, name, params) => `function${name || ''}(${optional(params)})`)
      .replace(/^(\s*)(?!if\b|for\b|while\b|switch\b|catch\b|return\b|get\b|set\b)(constructor|[A-Za-z_$][\w$]*)\s*\(([^()]*)\)(\s*(?::\s*any\s*)?\{)/gm,
        (all, indent, name, params, brace) => `${indent}${name}(${optional(params)})${brace}`);
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
   * Insert `declare name: T;` into every class of the framework source for
   * each property its body assigns through `this`, typed from the JSDoc
   * `@type` above the assignment.
   * @private
   */
  _declareFrameworkProperties(source, known, tsTypeOf) {
    // The Algorithm and IAlgorithmInstance families
    const surface = this._frameworkSurface().classes;
    const open_ = new Set(Object.keys(surface).filter(name => {
      for (let c = name, guard = 0; c && guard < 32; c = surface[c] && surface[c].base, ++guard)
        if (c === 'Algorithm' || c === 'IAlgorithmInstance') return true;
      return false;
    }));
    let out = '';
    let at = 0;
    const classRe = /\bclass\s+(\w+)(?:\s+extends\s+[\w.]+)?\s*\{/g;
    let m;
    while ((m = classRe.exec(source)) !== null) {
      const open = m.index + m[0].length;
      // The class body, by brace matching
      let depth = 1;
      let i = open;
      while (i < source.length && depth > 0) {
        const c = source[i];
        if (c === '{') ++depth;
        else if (c === '}') --depth;
        ++i;
      }
      const body = source.slice(open, i - 1);
      const types = new Map();
      const assignRe = /(?:\/\*\*\s*@type\s*\{([^}]+)\}[^*]*\*\/\s*)?this\.(\w+)\s*=(?!=)/g;
      let a;
      while ((a = assignRe.exec(body)) !== null)
        if (!types.has(a[2]) || (!types.get(a[2]) && a[1])) types.set(a[2], a[1] || null);
      // Accessors of the same name are the class's own
      for (const accessor of body.matchAll(/^\s*(?:get|set)\s+(\w+)\s*\(/gm)) types.delete(accessor[1]);
      out += source.slice(at, open);
      // An algorithm or instance has whatever properties its subclass gives
      // it (the vector harnesses set them by name), and a subclass may make
      // one of the framework's an accessor: they are open, their properties
      // declared by the index signature alone. A test vector carries whatever
      // fields its algorithm takes, any of them missing.
      if (open_.has(m[1])) {
        if (m[1] === 'Algorithm' || m[1] === 'IAlgorithmInstance') out += '\n      [member: string]: any;';
      } else {
        for (const [name, jsDocType] of types) out += `\n      declare ${name}?: ${tsTypeOf(jsDocType, known)};`;
        if (m[1] === 'TestCase') out += '\n      [field: string]: any;';
      }
      at = open;
    }
    out += source.slice(at);
    // A placeholder method that only throws would return void, and the
    // overrides that implement it could then return nothing else
    out = out.replace(/^(\s*\w+\([^)]*\))(\s*\{\s*throw\s+'[^']*'\s*\})/gm, '$1: any$2');
    // The enums: frozen objects whose members are looked up by name; one an
    // algorithm names that does not exist is undefined, as in JavaScript
    return out.replace(/const\s+(\w+)\s*=\s*Object\.freeze\(\{/g, 'const $1: { readonly [member: string]: any } = Object.freeze({');
  }

  /**
   * Collect required dependencies
   * @private
   */
  _collectDependencies(ast, options) {
    const dependencies = [];
    // TypeScript compiler handles most dependencies
    return dependencies;
  }

  /**
   * Generate warnings about potential issues
   * @private
   */
  _generateWarnings(ast, options) {
    const warnings = [];
    return warnings;
  }

  /**
   * Check if TypeScript compiler is available on the system
   * @private
   */
  _isTypescriptAvailable() {
    try {
      const { execSync } = require('child_process');
      execSync('tsc --version', { 
        stdio: 'pipe', 
        timeout: 1000,
        windowsHide: true  // Prevent Windows error dialogs
      });
      return true;
    } catch (error) {
      // Try npx tsc as fallback
      try {
        execSync('npx tsc --version', { 
          stdio: 'pipe', 
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        return 'npx';
      } catch (error2) {
        return false;
      }
    }
  }

  /**
   * Basic syntax validation using bracket/parentheses matching
   * @private
   */
  _checkBalancedSyntax(code) {
    try {
      const stack = [];
      const pairs = { '(': ')', '[': ']', '{': '}', '<': '>' };
      const opening = Object.keys(pairs);
      const closing = Object.values(pairs);
      
      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        
        // Skip string literals
        if (char === '"' || char === "'" || char === '`') {
          const quote = char;
          i++; // Skip opening quote
          while (i < code.length && code[i] !== quote) {
            if (code[i] === '\\') i++; // Skip escaped characters
            i++;
          }
          continue;
        }
        
        // Skip single-line comments
        if (char === '/' && i + 1 < code.length && code[i + 1] === '/') {
          while (i < code.length && code[i] !== '\n') i++;
          continue;
        }
        
        // Skip multi-line comments
        if (char === '/' && i + 1 < code.length && code[i + 1] === '*') {
          i += 2;
          while (i < code.length - 1) {
            if (code[i] === '*' && code[i + 1] === '/') {
              i += 2;
              break;
            }
            i++;
          }
          continue;
        }
        
        if (opening.includes(char)) {
          // Special handling for < in TypeScript - only count as opening if it looks like a generic
          if (char === '<') {
            // Simple heuristic: check if this could be a generic type parameter
            const nextChars = code.slice(i + 1, i + 10);
            if (!/^[A-Za-z_]/.test(nextChars)) continue;
          }
          stack.push(char);
        } else if (closing.includes(char)) {
          if (char === '>') {
            // Only match > with < if we have an unmatched <
            if (stack.length === 0 || stack[stack.length - 1] !== '<') continue;
          }
          if (stack.length === 0) return false;
          const lastOpening = stack.pop();
          if (pairs[lastOpening] !== char) return false;
        }
      }
      
      return stack.length === 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate TypeScript code syntax using tsc
   * @override
   */
  ValidateCodeSyntax(code) {
    // Check if TypeScript compiler is available first
    const tscAvailable = this._isTypescriptAvailable();
    if (!tscAvailable) {
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'TypeScript compiler not available - using basic validation'
      };
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const tscCommand = tscAvailable === 'npx' ? 'npx tsc' : 'tsc';
      
      // Create temporary file
      const tempFile = path.join(__dirname, '..', '.agent.tmp', `temp_ts_${Date.now()}.ts`);
      
      // Ensure .agent.tmp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Write code to temp file
      fs.writeFileSync(tempFile, code);
      
      try {
        // Try to compile the TypeScript code (no emit, just check)
        execSync(`${tscCommand} --noEmit --skipLibCheck "${tempFile}"`, { 
          stdio: 'pipe',
          timeout: 3000,
          windowsHide: true  // Prevent Windows error dialogs
        });
        
        // Clean up
        fs.unlinkSync(tempFile);
        
        return {
          success: true,
          method: 'tsc',
          error: null
        };
        
      } catch (error) {
        // Clean up on error
        if (fs.existsSync(tempFile)) {
          fs.unlinkSync(tempFile);
        }
        
        return {
          success: false,
          method: 'tsc',
          error: error.stderr?.toString() || error.message
        };
      }
      
    } catch (error) {
      // If TypeScript compiler is not available or other error, fall back to basic validation
      const isBasicSuccess = this._checkBalancedSyntax(code);
      return {
        success: isBasicSuccess,
        method: 'basic',
        error: isBasicSuccess ? null : 'TypeScript compiler not available - using basic validation'
      };
    }
  }

  /**
   * Get TypeScript compiler download information
   * @override
   */
  GetCompilerInfo() {
    return {
      name: this.name,
      compilerName: 'TypeScript Compiler',
      downloadUrl: 'https://www.typescriptlang.org/download',
      installInstructions: [
        'Install TypeScript globally: npm install -g typescript',
        'Or use npx: npx typescript',
        'Or install Node.js first from https://nodejs.org/en/download/',
        'Verify installation with: tsc --version'
      ].join('\n'),
      verifyCommand: 'tsc --version',
      alternativeValidation: 'Basic syntax checking (balanced brackets/parentheses with TypeScript generics)',
      packageManager: 'npm',
      documentation: 'https://www.typescriptlang.org/docs/'
    };
  }

  /**
   * Generate TypeScript test runner code from ILTestRunner node (global property)
   * @param {Object} testRunner - ILTestRunner node with test cases
   * @returns {string} TypeScript test runner code
   */
  generateTestRunner(testRunner) {
    if (!testRunner || !testRunner.tests || testRunner.tests.length === 0) {
      return '';
    }

    const lines = [];
    lines.push('// Auto-generated Test Runner');
    lines.push('');
    lines.push('function bytesToHex(bytes: Uint8Array | number[]): string {');
    lines.push('  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");');
    lines.push('}');
    lines.push('');
    lines.push('function arraysEqual(a: Uint8Array | number[], b: Uint8Array | number[]): boolean {');
    lines.push('  if (a.length !== b.length) return false;');
    lines.push('  for (let i = 0; i < a.length; ++i) {');
    lines.push('    if (a[i] !== b[i]) return false;');
    lines.push('  }');
    lines.push('  return true;');
    lines.push('}');
    lines.push('');
    lines.push('(function main(): void {');
    lines.push('  let passed: number = 0;');
    lines.push('  let failed: number = 0;');
    lines.push('  console.log("Running tests...");');
    lines.push('  console.log("");');
    lines.push('');

    for (const testGroup of testRunner.tests) {
      const algoClass = testGroup.algorithmClass;
      const instClass = testGroup.instanceClass;

      for (let i = 0; i < testGroup.testCases.length; ++i) {
        const tc = testGroup.testCases[i];
        const desc = tc.description || `Test ${i + 1}`;
        const inputBytes = tc.input ? `new Uint8Array([${tc.input.join(', ')}])` : 'new Uint8Array(0)';
        const expectedBytes = tc.expected ? `new Uint8Array([${tc.expected.join(', ')}])` : 'new Uint8Array(0)';

        lines.push(`  // Test: ${desc}`);
        lines.push('  try {');
        lines.push(`    const algo = new ${algoClass}();`);
        lines.push(`    const instance = algo.CreateInstance() as ${instClass};`);
        lines.push('');

        // Set key/iv/nonce if provided
        if (tc.key) {
          lines.push(`    instance.key = new Uint8Array([${tc.key.join(', ')}]);`);
        }
        if (tc.iv) {
          lines.push(`    instance.iv = new Uint8Array([${tc.iv.join(', ')}]);`);
        }
        if (tc.nonce) {
          lines.push(`    instance.nonce = new Uint8Array([${tc.nonce.join(', ')}]);`);
        }

        lines.push(`    const input: Uint8Array = ${inputBytes};`);
        lines.push(`    const expected: Uint8Array = ${expectedBytes};`);
        lines.push('');
        lines.push('    instance.feed(input);');
        lines.push('    const actual: Uint8Array | number[] = instance.result();');
        lines.push('');
        lines.push('    if (arraysEqual(actual, expected)) {');
        lines.push(`      console.log("PASS: ${desc}");`);
        lines.push('      ++passed;');
        lines.push('    } else {');
        lines.push(`      console.log("FAIL: ${desc}");`);
        lines.push('      console.log("  Expected: " + bytesToHex(expected));');
        lines.push('      console.log("  Actual:   " + bytesToHex(actual));');
        lines.push('      ++failed;');
        lines.push('    }');
        lines.push('  } catch (error) {');
        lines.push(`    console.log("ERROR: ${desc} - " + (error as Error).message);`);
        lines.push('    ++failed;');
        lines.push('  }');
        lines.push('');
      }
    }

    lines.push('  console.log("");');
    lines.push('  console.log(`Results: ${passed} passed, ${failed} failed`);');
    lines.push('  process.exit(failed === 0 ? 0 : 1);');
    lines.push('})();');

    return lines.join('\n');
  }

}

// Register the plugin
const typeScriptPlugin = new TypeScriptPlugin();
LanguagePlugins.Add(typeScriptPlugin);

// Export for potential direct use
// Export for potential direct use (Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = typeScriptPlugin;
}


})(); // End of IIFE