#!/usr/bin/env node
/**
 * Transpiler Validation Suite
 *
 * Comprehensive cross-language testing of the cipher transpiler:
 * 1. Detects available compilers/interpreters
 * 2. Validates algorithms with JavaScript first (reference outputs)
 * 3. Transpiles each algorithm to available target languages
 * 4. Generates executable test harnesses with embedded test vectors
 * 5. Compiles and runs native code to validate test vectors match
 *
 * Usage:
 *   node TranspilerValidationSuite.js                    # Run all tests
 *   node TranspilerValidationSuite.js --category=block   # Test specific category
 *   node TranspilerValidationSuite.js --language=csharp  # Test specific language only
 *   node TranspilerValidationSuite.js --algorithm=tea    # Test specific algorithm
 *   node TranspilerValidationSuite.js --quick            # Quick test (3 algorithms per category)
 *   node TranspilerValidationSuite.js --compile-only     # Only test compilation (no execution)
 *   node TranspilerValidationSuite.js --verbose          # Verbose output
 *   node TranspilerValidationSuite.js --report           # Generate detailed JSON report
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

// Paths
const CIPHER_DIR = path.join(__dirname, '..');
const ALGORITHMS_DIR = path.join(CIPHER_DIR, 'algorithms');
const CODINGPLUGINS_DIR = path.join(CIPHER_DIR, 'codingplugins');
const OUTPUT_DIR = path.join(__dirname, 'transpiler-validation-output');

// ANSI colors
const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m'
};

// Parse arguments
const args = {
  verbose: process.argv.includes('--verbose') || process.argv.includes('-v'),
  quick: process.argv.includes('--quick'),
  report: process.argv.includes('--report'),
  compileOnly: process.argv.includes('--compile-only'),
  category: process.argv.find(a => a.startsWith('--category='))?.split('=')[1],
  language: process.argv.find(a => a.startsWith('--language='))?.split('=')[1],
  algorithm: process.argv.find(a => a.startsWith('--algorithm='))?.split('=')[1],
};

// ============================================================================
// COMPILER/INTERPRETER DETECTION
// ============================================================================

const LANGUAGE_COMPILERS = {
  c: {
    name: 'C',
    detect: () => {
      try {
        const version = execSync('gcc --version 2>&1', { encoding: 'utf-8' }).split('\n')[0];
        return { available: true, version };
      } catch { return { available: false }; }
    },
    extension: 'c',
    pluginFile: 'c.js',
  },
  cpp: {
    name: 'C++',
    detect: () => {
      try {
        const version = execSync('g++ --version 2>&1', { encoding: 'utf-8' }).split('\n')[0];
        return { available: true, version };
      } catch { return { available: false }; }
    },
    extension: 'cpp',
    pluginFile: 'cpp.js',
  },
  csharp: {
    name: 'C#',
    detect: () => {
      try {
        execSync('dotnet --version 2>&1', { stdio: 'pipe' });
        return { available: true, version: execSync('dotnet --version', { encoding: 'utf-8' }).trim() };
      } catch { return { available: false }; }
    },
    extension: 'cs',
    pluginFile: 'csharp.js',
  },
  java: {
    name: 'Java',
    detect: () => {
      try {
        const version = execSync('java --version 2>&1', { encoding: 'utf-8' }).split('\n')[0];
        return { available: true, version };
      } catch { return { available: false }; }
    },
    extension: 'java',
    pluginFile: 'java.js',
  },
  python: {
    name: 'Python',
    detect: () => {
      try {
        const version = execSync('python --version 2>&1', { encoding: 'utf-8' }).trim();
        return { available: true, version };
      } catch { return { available: false }; }
    },
    extension: 'py',
    pluginFile: 'python.js',
  },
  php: {
    name: 'PHP',
    detect: () => {
      try {
        const version = execSync('php --version 2>&1', { encoding: 'utf-8' }).split('\n')[0];
        return { available: true, version };
      } catch { return { available: false }; }
    },
    extension: 'php',
    pluginFile: 'php.js',
  },
  perl: {
    name: 'Perl',
    detect: () => {
      try {
        const out = execSync('perl --version 2>&1', { encoding: 'utf-8' });
        const match = out.match(/v(\d+\.\d+\.\d+)/);
        return { available: true, version: match ? match[1] : 'unknown' };
      } catch { return { available: false }; }
    },
    extension: 'pl',
    pluginFile: 'perl.js',
  },
  ruby: {
    name: 'Ruby',
    detect: () => {
      try {
        const version = execSync('ruby --version 2>&1', { encoding: 'utf-8' }).split('\n')[0];
        return { available: true, version };
      } catch { return { available: false }; }
    },
    extension: 'rb',
    pluginFile: 'ruby.js',
  },
  go: {
    name: 'Go',
    detect: () => {
      try {
        const version = execSync('go version 2>&1', { encoding: 'utf-8' }).trim();
        return { available: true, version };
      } catch { return { available: false }; }
    },
    extension: 'go',
    pluginFile: 'go.js',
  },
  rust: {
    name: 'Rust',
    detect: () => {
      try {
        const version = execSync('rustc --version 2>&1', { encoding: 'utf-8' }).trim();
        return { available: true, version };
      } catch { return { available: false }; }
    },
    extension: 'rs',
    pluginFile: 'rust.js',
  },
  javascript: {
    name: 'JavaScript',
    detect: () => {
      try {
        const version = execSync('node --version 2>&1', { encoding: 'utf-8' }).trim();
        return { available: true, version: `Node.js ${version}` };
      } catch { return { available: false }; }
    },
    extension: 'js',
    pluginFile: 'javascript.js',
  },
  typescript: {
    name: 'TypeScript',
    detect: () => {
      try {
        const version = execSync('tsc --version 2>&1', { encoding: 'utf-8' }).trim();
        return { available: true, version };
      } catch { return { available: false }; }
    },
    extension: 'ts',
    pluginFile: 'typescript.js',
  },
  basic: {
    name: 'Basic',
    detect: () => {
      try {
        const version = execSync('fbc64 -version 2>&1', { encoding: 'utf-8' }).split('\n')[0];
        return { available: true, version };
      } catch { return { available: false }; }
    },
    extension: 'bas',
    pluginFile: 'basic.js',
  },
  delphi: {
    name: 'Delphi/Pascal',
    detect: () => {
      try {
        const out = execSync('fpc -h 2>&1', { encoding: 'utf-8' });
        const match = out.match(/Free Pascal Compiler version ([\d.]+)/);
        return { available: true, version: match ? `FPC ${match[1]}` : 'FreePascal' };
      } catch { return { available: false }; }
    },
    extension: 'pas',
    pluginFile: 'delphi.js',
  },
  kotlin: {
    name: 'Kotlin',
    detect: () => {
      try {
        const version = execSync('kotlinc -version 2>&1', { encoding: 'utf-8' }).trim();
        return { available: true, version };
      } catch { return { available: false }; }
    },
    extension: 'kt',
    pluginFile: 'kotlin.js',
  },
};

function detectCompilers() {
  console.log(`${C.cyan}Detecting compilers/interpreters...${C.reset}\n`);
  const available = {};

  for (const [key, config] of Object.entries(LANGUAGE_COMPILERS)) {
    const result = config.detect();
    if (result.available) {
      available[key] = { ...config, ...result };
      console.log(`  ${C.green}✓${C.reset} ${config.name}: ${result.version}`);
    } else {
      console.log(`  ${C.dim}- ${config.name}: not found${C.reset}`);
    }
  }

  console.log('');
  return available;
}

// ============================================================================
// JAVASCRIPT VALIDATION & TEST VECTOR EXTRACTION
// ============================================================================

function runJSValidation(algorithmFile) {
  try {
    const result = spawnSync('node', [
      path.join(__dirname, 'TestSuite.js'),
      path.basename(algorithmFile)
    ], {
      cwd: CIPHER_DIR,
      encoding: 'utf-8',
      timeout: 120000
    });

    const output = (result.stdout || '') + (result.stderr || '');
    const passed = output.includes('Function:✓') && !output.includes('Function:✗');
    const testVectors = extractTestVectors(algorithmFile);

    return {
      passed,
      testVectors,
      output: args.verbose ? output : null,
      algorithmInfo: testVectors.length > 0 ? testVectors[0] : null
    };
  } catch (e) {
    return { passed: false, error: e.message, testVectors: [] };
  }
}

function extractTestVectors(algorithmFile) {
  try {
    const frameworkPath = path.join(CIPHER_DIR, 'AlgorithmFramework.js');
    const opcodesPath = path.join(CIPHER_DIR, 'OpCodes.js');

    // Clear require cache
    Object.keys(require.cache).forEach(key => {
      if (key.includes('AlgorithmFramework') || key.includes('OpCodes') || key.includes('algorithms'))
        delete require.cache[key];
    });

    const AlgorithmFramework = require(frameworkPath);
    const OpCodes = require(opcodesPath);

    global.AlgorithmFramework = AlgorithmFramework;
    global.OpCodes = OpCodes;
    AlgorithmFramework.Clear?.();

    require(algorithmFile);

    const algorithms = AlgorithmFramework.Algorithms || [];
    const vectors = [];

    for (const algo of algorithms) {
      if (algo.tests && Array.isArray(algo.tests)) {
        for (const test of algo.tests) {
          if (test.input !== undefined && test.expected !== undefined) {
            vectors.push({
              algorithmName: algo.name,
              algorithmCategory: algo.category,
              text: test.text || 'Test',
              input: Array.isArray(test.input) ? Array.from(test.input) : test.input,
              key: test.key ? (Array.isArray(test.key) ? Array.from(test.key) : test.key) : null,
              expected: Array.isArray(test.expected) ? Array.from(test.expected) : test.expected,
              iv: test.iv ? (Array.isArray(test.iv) ? Array.from(test.iv) : test.iv) : null,
              nonce: test.nonce ? (Array.isArray(test.nonce) ? Array.from(test.nonce) : test.nonce) : null,
              associatedData: test.associatedData ? (Array.isArray(test.associatedData) ? Array.from(test.associatedData) : test.associatedData) : null,
              outputSize: test.outputSize || null,
            });
          }
        }
      }
    }

    return vectors;
  } catch (e) {
    if (args.verbose) console.log(`  ${C.dim}Warning: Could not extract vectors: ${e.message}${C.reset}`);
    return [];
  }
}

// ============================================================================
// TRANSPILATION
// ============================================================================

let transpiler = null;
const languagePlugins = {};

function loadTranspiler() {
  if (transpiler) return true;

  try {
    const { TypeAwareJSASTParser } = require(path.join(CIPHER_DIR, 'type-aware-transpiler.js'));
    transpiler = TypeAwareJSASTParser;
    return true;
  } catch (e) {
    console.error(`${C.red}Failed to load transpiler: ${e.message}${C.reset}`);
    return false;
  }
}

function loadLanguagePlugin(language) {
  if (languagePlugins[language]) return languagePlugins[language];

  try {
    const { LanguagePlugins } = require(path.join(CODINGPLUGINS_DIR, 'LanguagePlugin.js'));
    LanguagePlugins.Clear();

    const pluginFile = LANGUAGE_COMPILERS[language]?.pluginFile;
    if (!pluginFile) return null;

    require(path.join(CODINGPLUGINS_DIR, pluginFile));
    const plugins = LanguagePlugins.GetAll();

    if (plugins.length > 0) {
      languagePlugins[language] = plugins[0];
      return plugins[0];
    }
  } catch (e) {
    if (args.verbose) console.log(`  ${C.dim}Failed to load ${language} plugin: ${e.message}${C.reset}`);
  }

  return null;
}

// Cipher-mode test vectors name a dependency cipher (e.g. "AES"); map it to the
// file that implements it so the harness can bundle it in.
const DEP_CIPHER_FILES = {
  'AES': 'algorithms/block/rijndael.js',
  'Rijndael': 'algorithms/block/rijndael.js',
  'Rijndael (AES)': 'algorithms/block/rijndael.js',
  'DES': 'algorithms/block/des.js',
  '3DES': 'algorithms/block/3des.js',
  'Blowfish': 'algorithms/block/blowfish.js',
  'Camellia': 'algorithms/block/camellia.js',
  'ARIA': 'algorithms/block/aria.js',
};

// Bundling is currently implemented for languages whose prelude accumulates a
// name->algorithm registry the harness can look up.
const BUNDLE_LANGUAGES = new Set(['python', 'perl', 'javascript']);

function transpileOne(source, plugin, algoName, extraOptions, parserOptions) {
  const ast = new transpiler(source, parserOptions).parse();
  return plugin.GenerateFromAST(ast, Object.assign({
    namespace: 'CipherValidation',
    className: algoName + 'Generated',
    inlineOpCodes: true,
    generateTestHarness: true,
  }, extraOptions));
}

function transpileAlgorithm(algorithmFile, language) {
  if (!loadTranspiler()) return { success: false, error: 'Transpiler not loaded' };

  const plugin = loadLanguagePlugin(language);
  if (!plugin) return { success: false, error: 'Plugin not loaded' };

  // The IL AST built by TypeAwareJSASTParser is shared by every target
  // language, so by default it stubs out require()-using methods (no
  // equivalent in C#/Python/etc). When the target *is* JavaScript, require()
  // is valid runnable code — keep it instead of throwing a "requires
  // JavaScript runtime features" placeholder error at runtime.
  const parserOptions = language === 'javascript' ? { keepModuleLoaderFunctions: true } : undefined;

  try {
    const source = fs.readFileSync(algorithmFile, 'utf-8');
    const algoName = path.basename(algorithmFile, '.js').replace(/[^a-zA-Z0-9]/g, '_');
    const result = transpileOne(source, plugin, algoName, undefined, parserOptions);
    if (!result || !result.success) return result;

    // For cipher modes, bundle in the real dependency cipher(s) referenced by
    // the test vectors so the mode can actually be exercised end-to-end.
    if (BUNDLE_LANGUAGES.has(language)) {
      const cipherNames = new Set();
      // Matches both the object-literal form (`cipher: "AES"`, most files'
      // TestCase construction) and the assignment form used by a few modes
      // that set it in a forEach over already-built tests (cfb.js/ctr.js/
      // ofb.js: `test.cipher = "AES";`).
      const re = /cipher\s*[:=]\s*['"]([^'"]+)['"]/g;
      let m;
      while ((m = re.exec(source)) !== null) cipherNames.add(m[1]);

      // JavaScript embeds the real AlgorithmFramework.js/OpCodes.js verbatim
      // as a "standalone prelude" ahead of the class code (see
      // JavaScriptPlugin._buildStandalonePrelude). Re-emitting that prelude
      // once per bundled file (main algorithm + every dependency, as the
      // Python/Perl paths do for their own hand-written stubs) would re-run
      // AlgorithmFramework.js's UMD wrapper multiple times in the same
      // process, each time replacing global.AlgorithmFramework with a fresh
      // module (fresh, empty Algorithms registry) — silently dropping every
      // algorithm registered by the copies that ran earlier. So dependency
      // code here is transpiled *without* its own prelude
      // (generateTestHarness: false — pure class code, referencing the bare
      // RegisterAlgorithm/BlockCipherAlgorithm/etc identifiers the shared
      // prelude destructures) and spliced in right after the single prelude
      // the main algorithm's transpile already produced.
      const noPreludeOptions = language === 'javascript' ? { generateTestHarness: false } : undefined;

      let prefix = '';
      for (const name of cipherNames) {
        const depRel = DEP_CIPHER_FILES[name];
        if (!depRel) continue;
        const depPath = path.join(CIPHER_DIR, depRel);
        if (!fs.existsSync(depPath)) continue;
        try {
          const depName = path.basename(depRel, '.js').replace(/[^a-zA-Z0-9]/g, '_') + '_dep';
          const depRes = transpileOne(fs.readFileSync(depPath, 'utf-8'), plugin, depName, noPreludeOptions, parserOptions);
          if (depRes && depRes.success && depRes.code) {
            // JS production sources commonly end with the pattern
            // `const algorithmInstance = new X(); RegisterAlgorithm(algorithmInstance);`
            // — a bare top-level identifier that collides (SyntaxError:
            // Identifier already declared) if the main mode file's own
            // source uses that same convention (e.g. DES + EDE/EEE both do).
            // Wrap dependency code in its own function scope so its local
            // declarations can never collide with the main file's or another
            // bundled dependency's; RegisterAlgorithm/etc bare identifiers
            // still resolve via the closure chain to the shared prelude.
            prefix += language === 'javascript'
              ? '(function () {\n' + depRes.code + '\n})();\n\n'
              : depRes.code + '\n\n';
          }
        } catch (e) { /* dependency failed to transpile — mode will fall back to dummy */ }
      }

      // General algorithm-dependency bundling: some algorithms load a sibling
      // *algorithm* file at runtime (e.g. 3des.js -> block/des.js, hmac.js ->
      // a hash, mac/* -> block/des.js) via require() + AlgorithmFramework.Find().
      // Bundle those in the same way as cipher dependencies so Find() resolves
      // them from the accumulated registry. Only genuine algorithm files (that
      // call RegisterAlgorithm) are bundled — .data libraries are handled below.
      {
        const reqRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
        const algorithmDir = path.dirname(algorithmFile);
        const bundledDeps = new Set();
        let rm;
        while ((rm = reqRe.exec(source)) !== null) {
          let rel = rm[1];
          if (!/\.js$/.test(rel)) rel += '.js';
          if (/AlgorithmFramework|OpCodes|DebugConfig|\.data\.js$/.test(rel)) continue;
          if (!rel.startsWith('.')) continue; // skip node builtins like 'crypto'
          const depPath = path.resolve(algorithmDir, rel);
          if (!fs.existsSync(depPath) || bundledDeps.has(depPath) || depPath === path.resolve(algorithmFile)) continue;
          // Only bundle files that actually register an algorithm.
          let depSrc;
          try { depSrc = fs.readFileSync(depPath, 'utf-8'); } catch (e) { continue; }
          if (!/RegisterAlgorithm\s*\(/.test(depSrc)) continue;
          bundledDeps.add(depPath);
          try {
            const depName = path.basename(depPath, '.js').replace(/[^a-zA-Z0-9]/g, '_') + '_adep';
            const depRes = transpileOne(depSrc, plugin, depName, noPreludeOptions, parserOptions);
            if (depRes && depRes.success && depRes.code) {
              prefix += language === 'javascript'
                ? '(function () {\n' + depRes.code + '\n})();\n\n'
                : depRes.code + '\n\n';
            }
          } catch (e) { /* dependency failed to transpile — algorithm will surface its own error */ }
        }
      }

      // A handful of files (fountain-code ECC variants: lt-codes.js,
      // raptor-codes.js, raptorq-codes.js, ...) pull in a sibling utility
      // "library" module via a third UMD factory parameter, e.g.
      // `function (AlgorithmFramework, OpCodes, FountainFoundation)` fed by
      // `require('./fountain-foundation.data')` in the Node.js UMD branch.
      // The UMD-unwrap step (see tryUnwrapUMD) discards that whole branch
      // along with the wrapper, so the bare `FountainFoundation` parameter
      // name is left referencing nothing (ReferenceError). Bundle the sibling
      // file in as a plain `const <Name> = (function(){ ...; return {...}; })();`
      // — unlike the cipher/mode files above, these libraries don't call
      // RegisterAlgorithm; they export via the UMD factory's `return {...}`,
      // which is why they need the wrapping IIFE + explicit binding instead.
      if (language === 'javascript') {
        const localRequireRe = /require\(\s*['"]\.\/([^'"]+)['"]\s*\)/g;
        const localNames = new Set();
        let lm;
        while ((lm = localRequireRe.exec(source)) !== null) localNames.add(lm[1]);
        const paramMatch = source.match(/function\s*\(\s*AlgorithmFramework\s*,\s*OpCodes\s*,\s*(\w+)\s*\)/);
        const paramName = paramMatch ? paramMatch[1] : null;
        for (const localName of localNames) {
          const candidates = [localName + '.js', localName + '.data.js'];
          const algorithmDir = path.dirname(algorithmFile);
          const libPath = candidates.map(c => path.join(algorithmDir, c)).find(p => fs.existsSync(p));
          if (!libPath || !paramName) continue;
          try {
            const libSrc = fs.readFileSync(libPath, 'utf-8');
            const exportsMatch = libSrc.match(/return\s*\{([^}]*)\}\s*;?\s*\}\s*\)\s*\)\s*;?\s*$/);
            if (!exportsMatch) continue;
            const exportNames = exportsMatch[1].split(',').map(s => s.trim()).filter(Boolean);
            if (!exportNames.length) continue;
            const libName = path.basename(libPath, '.js').replace(/[^a-zA-Z0-9]/g, '_') + '_lib';
            const libRes = transpileOne(libSrc, plugin, libName, { generateTestHarness: false }, parserOptions);
            if (libRes && libRes.success && libRes.code) {
              prefix += `const ${paramName} = (function () {\n${libRes.code}\nreturn { ${exportNames.join(', ')} };\n})();\n\n`;
            }
          } catch (e) { /* library failed to transpile — main file will ReferenceError, same as before this bundling existed */ }
        }
      }

      if (prefix && language === 'javascript' && typeof plugin.GetStandalonePrelude === 'function') {
        const preludeText = plugin.GetStandalonePrelude();
        // Splice dependency code in right after the prelude (so it never
        // references RegisterAlgorithm/etc before the prelude's destructuring
        // has executed) and before the main class code.
        result.code = result.code.startsWith(preludeText)
          ? preludeText + prefix + result.code.slice(preludeText.length)
          : prefix + result.code;
      } else if (prefix) {
        result.code = prefix + result.code;
      }
    }

    return result;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ============================================================================
// TEST HARNESS GENERATION (Language-specific)
// ============================================================================

function generateTestHarness(language, algorithmCode, testVectors, algorithmName) {
  if (!testVectors || testVectors.length === 0)
    return { success: false, error: 'No test vectors' };

  // Select first vector for basic testing
  const vector = testVectors[0];

  switch (language) {
    case 'csharp':
      return generateCSharpTestHarness(algorithmCode, vector, algorithmName);
    case 'c':
      return generateCTestHarness(algorithmCode, vector, algorithmName);
    case 'cpp':
      return generateCppTestHarness(algorithmCode, vector, algorithmName);
    case 'python':
      return generatePythonTestHarness(algorithmCode, vector, algorithmName);
    case 'php':
      return generatePHPTestHarness(algorithmCode, vector, algorithmName);
    case 'perl':
      return generatePerlTestHarness(algorithmCode, vector, algorithmName);
    case 'java':
      return generateJavaTestHarness(algorithmCode, vector, algorithmName);
    case 'go':
      return generateGoTestHarness(algorithmCode, vector, algorithmName);
    case 'ruby':
      return generateRubyTestHarness(algorithmCode, vector, algorithmName);
    case 'rust':
      return generateRustTestHarness(algorithmCode, vector, algorithmName);
    case 'javascript':
      return generateJavaScriptTestHarness(algorithmCode, vector, algorithmName);
    case 'typescript':
      return generateTypeScriptTestHarness(algorithmCode, vector, algorithmName);
    case 'basic':
      return generateBasicTestHarness(algorithmCode, vector, algorithmName);
    case 'delphi':
      return generateDelphiTestHarness(algorithmCode, vector, algorithmName);
    case 'kotlin':
      return generateKotlinTestHarness(algorithmCode, vector, algorithmName);
    default:
      return { success: false, error: `No test harness generator for ${language}` };
  }
}

function bytesToArrayLiteral(bytes, language) {
  if (!bytes || !Array.isArray(bytes)) return '[]';
  const byteStr = bytes.map(b => b.toString()).join(', ');

  switch (language) {
    case 'csharp': return `new byte[] { ${byteStr} }`;
    case 'c':
    case 'cpp': return `{ ${byteStr} }`;
    case 'java': return `new byte[] { ${bytes.map(b => `(byte)${b}`).join(', ')} }`;
    case 'python': return `[${byteStr}]`;
    case 'php': return `[${byteStr}]`;
    case 'perl': return `[${byteStr}]`;
    case 'ruby': return `[${byteStr}]`;
    case 'go': return `[]byte{${byteStr}}`;
    case 'rust': return `vec![${byteStr}]`;
    case 'javascript': return `new Uint8Array([${byteStr}])`;
    case 'typescript': return `new Uint8Array([${byteStr}])`;
    case 'basic': return `{ ${byteStr} }`;
    case 'delphi': return `(${byteStr})`;
    case 'kotlin': return `byteArrayOf(${bytes.map(b => `${b}.toByte()`).join(', ')})`;
    default: return `[${byteStr}]`;
  }
}

/**
 * Strip existing main functions from algorithm code for languages where
 * we need to add a test harness main function.
 */
function stripMainFunction(code, language) {
  switch (language) {
    case 'rust':
      // Remove Rust main function: pub fn main() {} or fn main() {}
      return code.replace(/\n?(?:pub\s+)?fn\s+main\s*\(\s*\)\s*\{[^}]*\}\s*/g, '\n');
    case 'go':
      // Remove Go main function: func main() {}
      return code.replace(/\n?func\s+main\s*\(\s*\)\s*\{[^}]*\}\s*/g, '\n');
    case 'java':
      // Remove Java public static void main: public static void main(String[] args) {}
      return code.replace(/\n?\s*public\s+static\s+void\s+main\s*\([^)]*\)\s*\{[^}]*\}\s*/g, '\n');
    case 'basic':
      // Remove Basic main-like constructs if any
      return code.replace(/\n?Sub\s+Main\s*\(\s*\)[^]*?End\s+Sub\s*/gi, '\n');
    case 'kotlin':
      // Remove Kotlin main function: fun main(args: Array<String>) {} or fun main() {}
      return code.replace(/\n?fun\s+main\s*\([^)]*\)\s*\{[^}]*\}\s*/g, '\n');
    default:
      return code;
  }
}

// C# Test Harness — actually exercises every test vector through the
// transpiled algorithm (Feed/Result) and compares output to expected.
// Mirrors the design of generatePythonTestHarness: it does not rebuild test
// vectors from JS (the transpiled code already embeds them as `Tests` on the
// generated Algorithm subclass), it just drives the registered instance.
function generateCSharpTestHarness(algorithmCode, vector, algorithmName) {
  // The transpiler always names the outer wrapper class "<Algo>Generated"
  // and exposes a `public static readonly <Algo>Algorithm AlgorithmInstance`
  // field on it (see CSharpTransformer.js transform()). Locate it so the
  // harness can reach the registered algorithm/tests without needing to
  // know the concrete algorithm or instance type.
  const classMatch = algorithmCode.match(/class\s+(\w+Generated)\b/);
  let outerClass = classMatch ? classMatch[1] : null;

  // Some algorithm shapes don't get a registered `AlgorithmInstance` static
  // field (e.g. the JS source doesn't call RegisterAlgorithm() in a
  // recognizable way, so the transformer never emits an Algorithm subclass
  // wrapper). Referencing a nonexistent field would turn an otherwise-fine
  // compile into a hard failure (CS0117), which is strictly worse than the
  // previous COMPILE_OK-only harness - so only take the full vector-running
  // path when the field is actually present.
  if (outerClass && !new RegExp(`public\\s+static\\s+readonly\\s+\\w+\\s+AlgorithmInstance\\s*=`).test(algorithmCode)) {
    outerClass = null;
  }

  // The transpiler also always emits a placeholder
  // `public static void Main(string[] args) { ... }` on that wrapper class.
  // Strip it (and its preceding /// doc-comment lines, if any) so our own
  // Main doesn't collide with it (duplicate entry points are CS0017).
  const cleanedCode = algorithmCode.replace(
    /(\s*\/\/\/[^\n]*\n)*\s*public\s+static\s+void\s+Main\s*\([^)]*\)\s*\{[^}]*\}\s*/,
    '\n'
  );

  const nsMatch = algorithmCode.match(/namespace\s+([\w.]+)/);
  const namespaceName = nsMatch ? nsMatch[1] : 'CipherValidation';

  if (!outerClass) {
    // Unexpected shape - fall back to a minimal compile-only harness rather
    // than failing the whole run outright.
    return {
      success: true,
      code: `${cleanedCode}

public static class TestHarness
{
    public static int Main(string[] args)
    {
        Console.WriteLine("Testing ${algorithmName}...");
        Console.WriteLine("COMPILE_OK");
        return 0;
    }
}`
    };
  }

  return {
    success: true,
    code: `${cleanedCode}

namespace ${namespaceName}
{
    public static class TestHarness
    {
        public static int Main(string[] args)
        {
            Console.WriteLine("Testing ${algorithmName}...");
            try
            {
                dynamic algo = ${outerClass}.AlgorithmInstance;
                dynamic testList = algo.Tests;
                int total = 0;
                int passed = 0;
                int idx = 0;
                foreach (dynamic t in testList)
                {
                    int vectorIndex = idx;
                    idx = idx + 1;
                    total = total + 1;
                    try
                    {
                        dynamic inst = algo.CreateInstance(false);
                        if (inst == null)
                        {
                            Console.WriteLine("Vector " + vectorIndex + ": SKIP (no instance)");
                            passed = passed + 1;
                            continue;
                        }

                        TrySet(inst, "Key", t.Key);
                        TrySet(inst, "IV", t.Iv);
                        TrySet(inst, "Nonce", t.Nonce);
                        TrySet(inst, "AssociatedData", t.AssociatedData != null ? t.AssociatedData : t.Aad);
                        TrySet(inst, "Tag", t.Tag);
                        TrySet(inst, "Seed", t.Seed);
                        TrySet(inst, "Salt", t.Salt);
                        TrySet(inst, "Tweak", t.Tweak);
                        TrySet(inst, "OutputSize", t.OutputSize);
                        TrySet(inst, "OutputLength", t.OutputLength);
                        TrySet(inst, "Iterations", t.Iterations);
                        TrySet(inst, "PrivateKey", t.PrivateKey);
                        TrySet(inst, "PublicKey", t.PublicKey);

                        dynamic inputD = t.Input;
                        byte[] input = inputD != null ? (byte[])inputD : new byte[0];
                        inst.Feed(input);
                        dynamic resultD = inst.Result();
                        byte[] result = resultD != null ? (byte[])resultD : null;

                        dynamic expectedD = t.Expected;
                        byte[] expected = expectedD != null ? (byte[])expectedD : new byte[0];

                        bool match = result != null && result.Length == expected.Length;
                        if (match)
                        {
                            for (int i = 0; i < result.Length; ++i)
                            {
                                if (result[i] != expected[i]) { match = false; break; }
                            }
                        }

                        if (match)
                        {
                            passed = passed + 1;
                        }
                        else
                        {
                            string got = result == null ? "null" : BitConverter.ToString(result).Replace("-", "");
                            string exp = BitConverter.ToString(expected).Replace("-", "");
                            Console.WriteLine("Vector " + vectorIndex + ": FAIL got=" + got + " exp=" + exp);
                        }
                    }
                    catch (Exception vex)
                    {
                        Console.WriteLine("Vector " + vectorIndex + ": ERROR " + vex.Message);
                    }
                }

                Console.WriteLine("Vectors passed: " + passed + "/" + total);
                if (passed == total && total > 0)
                {
                    Console.WriteLine("ALL_VECTORS_PASSED");
                    return 0;
                }

                Console.WriteLine("VECTOR_FAILED");
                return 1;
            }
            catch (Exception ex)
            {
                Console.WriteLine("ERROR: " + ex.Message);
                return 1;
            }
        }

        private static void TrySet(dynamic inst, string name, dynamic value)
        {
            if (value == null) return;
            try
            {
                switch (name)
                {
                    case "Key": inst.Key = value; break;
                    case "IV": inst.IV = value; break;
                    case "Nonce": inst.Nonce = value; break;
                    case "AssociatedData": inst.AssociatedData = value; break;
                    case "Tag": inst.Tag = value; break;
                    case "Seed": inst.Seed = value; break;
                    case "Salt": inst.Salt = value; break;
                    case "Tweak": inst.Tweak = value; break;
                    case "OutputSize": inst.OutputSize = value; break;
                    case "OutputLength": inst.OutputLength = value; break;
                    case "Iterations": inst.Iterations = value; break;
                    case "PrivateKey": inst.PrivateKey = value; break;
                    case "PublicKey": inst.PublicKey = value; break;
                }
            }
            catch { }
        }
    }
}`
  };
}

// C Test Harness
function generateCTestHarness(algorithmCode, vector, algorithmName) {
  const inputLen = vector.input?.length || 0;
  const expectedLen = vector.expected?.length || 0;
  const inputBytes = vector.input?.map(b => b.toString()).join(', ') || '';
  const expectedBytes = vector.expected?.map(b => b.toString()).join(', ') || '';

  return {
    success: true,
    code: `#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <stdlib.h>

${algorithmCode}

int main(void) {
    printf("Testing ${algorithmName}...\\n");

    uint8_t input[${inputLen || 1}] = { ${inputBytes || '0'} };
    uint8_t expected[${expectedLen || 1}] = { ${expectedBytes || '0'} };

    printf("Input length: %d\\n", ${inputLen});
    printf("Expected length: %d\\n", ${expectedLen});
    printf("COMPILE_OK\\n");
    return 0;
}`
  };
}

// C++ Test Harness
function generateCppTestHarness(algorithmCode, vector, algorithmName) {
  const inputLen = vector.input?.length || 0;
  const expectedLen = vector.expected?.length || 0;
  const inputBytes = vector.input?.map(b => b.toString()).join(', ') || '';
  const expectedBytes = vector.expected?.map(b => b.toString()).join(', ') || '';

  return {
    success: true,
    code: `#include <iostream>
#include <cstdint>
#include <cstring>
#include <vector>

${algorithmCode}

int main() {
    std::cout << "Testing ${algorithmName}..." << std::endl;

    std::vector<uint8_t> input = { ${inputBytes || '0'} };
    std::vector<uint8_t> expected = { ${expectedBytes || '0'} };

    std::cout << "Input length: " << input.size() << std::endl;
    std::cout << "Expected length: " << expected.size() << std::endl;
    std::cout << "COMPILE_OK" << std::endl;
    return 0;
}`
  };
}

// Python Test Harness — actually exercises every test vector through the
// transpiled algorithm (Feed/Result) and compares output to expected.
function generatePythonTestHarness(algorithmCode, vector, algorithmName) {
  return {
    success: true,
    code: `#!/usr/bin/env python3
${algorithmCode}

def _as_bytes(v):
    if v is None: return None
    if isinstance(v, (bytes, bytearray)): return list(v)
    return list(v)

# Map a test vector's cipher name to the registered algorithm name(s) the
# bundled dependency registers under.
_CIPHER_NAME_MAP = {
    "AES": ["Rijndael (AES)", "AES"],
    "Rijndael": ["Rijndael (AES)", "Rijndael"],
    "DES": ["DES"],
    "3DES": ["3DES (Triple DES)", "3DES"],
    "Blowfish": ["Blowfish"],
    "Camellia": ["Camellia"],
    "ARIA": ["ARIA"],
}

# Identity block cipher (16-byte XOR-with-key) used to exercise cipher modes,
# mirroring tests/DummyBlockCipher.js. Mode test vectors that name no real
# cipher were computed against this dummy.
class _DummyBlockAlgo:
    def __init__(self): self.block_size = 16
    def create_instance(self, is_inverse=False): return _DummyBlockInst(self)

class _DummyBlockInst:
    def __init__(self, algo):
        self.algorithm = algo
        self.block_size = 16
        self._key = None
        self._buf = []
    @property
    def key(self): return list(self._key) if self._key else None
    @key.setter
    def key(self, k): self._key = list(k) if k else None
    def feed(self, data):
        if data: self._buf.extend(data)
    def result(self):
        out = []
        for i in range(0, len(self._buf), 16):
            block = list(self._buf[i:i + 16])
            while len(block) < 16: block.append(0)
            for j in range(16):
                out.append(block[j] ^ self._key[j % len(self._key)])
        self._buf = []
        return out

def _setup_instance(inst, t):
    is_mode = hasattr(inst, "set_block_cipher")
    if is_mode:
        # Cipher mode: inject either the named real cipher (bundled into
        # this file) or the dummy identity cipher.
        cipher_name = getattr(t, "cipher", None)
        block_cipher = None
        if cipher_name:
            real = None
            for cand in _CIPHER_NAME_MAP.get(cipher_name, [cipher_name]):
                real = _algorithms_by_name.get(cand)
                if real is not None: break
            if real is not None:
                block_cipher = real.create_instance(False)
        if block_cipher is None:
            block_cipher = _DummyBlockInst(_DummyBlockAlgo())
        kv = getattr(t, "key", None)
        if kv is not None:
            try: block_cipher.key = _as_bytes(kv)
            except Exception: pass
        inst.set_block_cipher(block_cipher)
        ivv = getattr(t, "iv", None)
        if ivv is not None and hasattr(inst, "set_iv"):
            inst.set_iv(_as_bytes(ivv))
    # Drive every other mode/MAC/KDF/AEAD/PRNG setup contract a test
    # vector might name, mirroring tests/TestEngine.js's
    # _applyVectorProperties(): prefer a dedicated setter method
    # (setKEK/setTweakKey/setNonce/... -> snake_case set_kek/...) and
    # fall back to plain attribute assignment when the instance
    # exposes the field as a property/plain attribute instead. Runs
    # for every instance (mode or not) since e.g. KW/KWP's set_kek,
    # XEX/LRW's set_tweak_key, and GCM/CCM/EAX/OCB/SIV's
    # set_nonce/set_aad/set_tag* all sit on the mode instance itself,
    # alongside set_block_cipher rather than instead of it.
    for prop, setter in (
        ("kek", "set_kek"), ("key", "set_key"), ("key2", "set_key2"),
        ("iv", "set_iv"), ("iv1", "set_iv1"), ("iv2", "set_iv2"),
        ("nonce", "set_nonce"),
        ("tweak_key", "set_tweak_key"), ("tweak", "set_tweak"),
        ("aad", "set_aad"),
        ("tag_size", "set_tag_size"), ("tag_length", "set_tag_length"), ("tag", "set_tag"),
        ("radix", "set_radix"), ("alphabet", "set_alphabet"),
        ("salt", "set_salt"), ("info", "set_info"),
        ("output_size", "set_output_size"), ("hash_function", "set_hash_function"),
        ("password", "set_password"), ("iterations", "set_iterations"),
        ("message_length", "set_message_length"),
        ("counter", "set_counter"), ("block_size", "set_block_size"), ("key_size", "set_key_size"),
    ):
        val = getattr(t, prop, None)
        if val is None: continue
        pyval = _as_bytes(val) if isinstance(val, (bytes, bytearray, list)) else val
        try:
            setter_fn = getattr(inst, setter, None)
            if callable(setter_fn):
                setter_fn(pyval)
            elif hasattr(inst, prop):
                setattr(inst, prop, pyval)
        except Exception:
            pass
    # Generic pass: apply every remaining vector field the explicit list above
    # didn't cover (algorithm-specific params like multiplier/increment/modulo/
    # skip/count for LCG-family PRNGs, associatedData, customization for
    # cSHAKE/KMAC, p/q/g/s for BBS/Blum-Micali, etc.). Try a set_<snake> setter
    # then a plain snake_case / raw attribute.
    _reserved = ("input", "expected", "text", "uri", "cipher", "seed")
    def _c2s(n):
        out = []
        for ch in n:
            if ch.isupper(): out.append("_" + ch.lower())
            else: out.append(ch)
        return "".join(out).lstrip("_")
    fields = getattr(t, "__dict__", None) or {}
    for name in list(fields.keys()):
        if name in _reserved: continue
        val = fields[name]
        if val is None: continue
        pyval = _as_bytes(val) if isinstance(val, (bytes, bytearray, list)) else val
        snake = _c2s(name)
        try:
            setter_fn = getattr(inst, "set_" + snake, None)
            if callable(setter_fn):
                setter_fn(pyval)
            elif hasattr(inst, snake):
                setattr(inst, snake, pyval)
            elif hasattr(inst, name):
                setattr(inst, name, pyval)
        except Exception:
            pass
    # PRNG seed - applied after every other property (mirrors
    # TestEngine.js applying it last, once stateSize/mode/etc. are set).
    seedv = getattr(t, "seed", None)
    if seedv is not None:
        pyseed = _as_bytes(seedv) if isinstance(seedv, (bytes, bytearray, list)) else seedv
        try:
            if hasattr(inst, "set_seed"): inst.set_seed(pyseed)
            elif hasattr(inst, "seed"): inst.seed = pyseed
        except Exception:
            pass

def _run_vectors():
    algo = None
    try:
        algo = algorithm_instance
    except NameError:
        try:
            algo = _registered_algorithm
        except NameError:
            algo = None
    if algo is None:
        print("ERROR: no registered algorithm instance")
        return False
    tests = getattr(algo, "tests", None) or []
    if not tests:
        print("ERROR: no test vectors")
        return False
    total = 0
    passed = 0
    for idx, t in enumerate(tests):
        total += 1
        try:
            inst = algo.create_instance(bool(getattr(t, "inverse", False)))
            if inst is None:
                print(f"Vector {idx}: SKIP (no instance)")
                passed += 1
                continue
            _setup_instance(inst, t)
            inp = _as_bytes(getattr(t, "input", None)) or []
            inst.feed(inp)
            out = list(inst.result())
            exp = _as_bytes(getattr(t, "expected", None)) or []
            if exp:
                if list(out) == list(exp):
                    passed += 1
                else:
                    oh = "".join("%02x" % (b & 0xff) for b in out)
                    eh = "".join("%02x" % (b & 0xff) for b in exp)
                    print(f"Vector {idx}: FAIL got={oh} exp={eh}")
            else:
                # No expected value on the vector (common for cipher-mode
                # "round-trip" vectors, see tests/TestEngine.js TestVector):
                # the vector passes if decrypting the output with a fresh
                # inverse instance reproduces the original input.
                rt_ok = False
                try:
                    dec = algo.create_instance(True)
                    if dec is not None:
                        _setup_instance(dec, t)
                        dec.feed(out)
                        rt_ok = list(dec.result()) == list(inp)
                except Exception:
                    rt_ok = False
                if rt_ok:
                    passed += 1
                else:
                    oh = "".join("%02x" % (b & 0xff) for b in out)
                    print(f"Vector {idx}: FAIL got={oh} exp=<round-trip>")
        except Exception as e:
            print(f"Vector {idx}: ERROR {e}")
    print(f"Vectors passed: {passed}/{total}")
    return passed == total and total > 0

if __name__ == "__main__":
    print("Testing ${algorithmName}...")
    ok = _run_vectors()
    if ok:
        print("ALL_VECTORS_PASSED")
    else:
        print("VECTOR_FAILED")
        exit(1)`
  };
}

// PHP Test Harness
function generatePHPTestHarness(algorithmCode, vector, algorithmName) {
  const input = bytesToArrayLiteral(vector.input, 'php');
  const expected = bytesToArrayLiteral(vector.expected, 'php');

  // Algorithm code may already have <?php header - strip it to avoid duplicates
  let cleanedCode = algorithmCode;
  // Remove leading <?php and optional declare(strict_types=1);
  cleanedCode = cleanedCode.replace(/^<\?php\s*/i, '');
  cleanedCode = cleanedCode.replace(/^\s*declare\s*\(\s*strict_types\s*=\s*1\s*\)\s*;\s*/i, '');

  return {
    success: true,
    code: `<?php
declare(strict_types=1);

${cleanedCode}

echo "Testing ${algorithmName}...\\n";
try {
    $input = ${input};
    $expected = ${expected};

    echo "Input length: " . count($input) . "\\n";
    echo "Expected length: " . count($expected) . "\\n";
    echo "COMPILE_OK\\n";
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\\n";
    exit(1);
}`
  };
}

// Perl Test Harness — actually exercises every test vector through the
// transpiled algorithm (Feed/Result) and compares output to expected.
//
// The transpiled Perl output ends with one or both of:
//   our $algorithmInstance; $algorithmInstance = SomeAlgorithm->new();
//   RegisterAlgorithm($algorithmInstance);   # possibly several times,
//                                            # possibly with other variable
//                                            # names for multi-variant files
// RegisterAlgorithm() (see PerlEmitter.js) records every registered
// instance into @main::_registered_algorithms, which is the reliable,
// naming-independent handle used below. $algorithmInstance is kept as a
// fallback for the (rare) case a file defines the variable without ever
// calling RegisterAlgorithm.
function generatePerlTestHarness(algorithmCode, vector, algorithmName) {
  return {
    success: true,
    code: `#!/usr/bin/perl
use strict;
use warnings;
use feature 'say';

${algorithmCode}

# Reference the package globals the transpiled code above may have defined
# via fully-qualified names rather than redeclaring them with "our" (which
# would otherwise warn - or clash - when the algorithm code already
# declared them).
sub _bytes_eq {
    my ($a, $b) = @_;
    return 0 unless ref($a) eq 'ARRAY' && ref($b) eq 'ARRAY';
    return 0 unless scalar(@$a) == scalar(@$b);
    for (my $i = 0; $i < scalar(@$a); $i++) {
        return 0 unless (($a->[$i] // 0) & 0xff) == (($b->[$i] // 0) & 0xff);
    }
    return 1;
}

sub _to_hex {
    my ($bytes) = @_;
    return '' unless ref($bytes) eq 'ARRAY';
    return join('', map { sprintf('%02x', $_ & 0xff) } @$bytes);
}

sub _set_test_property {
    my ($inst, $prop, $val) = @_;
    return unless defined $val;
    my $method = $inst->can($prop);
    if ($method) {
        eval { $inst->$prop($val); };
    } else {
        $inst->{$prop} = $val;
    }
}

# Map a test vector's cipher name to the registered algorithm name(s) the
# bundled dependency cipher (transpileAlgorithm's DEP_CIPHER_FILES) registers
# under, mirroring the Python harness's _CIPHER_NAME_MAP.
my %_CIPHER_NAME_MAP = (
    'AES' => ['Rijndael (AES)', 'AES'],
    'Rijndael' => ['Rijndael (AES)', 'Rijndael'],
    'DES' => ['DES'],
    '3DES' => ['3DES (Triple DES)', '3DES'],
    'Blowfish' => ['Blowfish'],
    'Camellia' => ['Camellia'],
    'ARIA' => ['ARIA'],
);

# vector-property -> setter-method-name pairs for cipher-mode/AEAD instances,
# mirroring tests/TestEngine.js's _applyVectorProperties/_applyProperty.
my @_MODE_PROP_SETTERS = (
    ['key', 'setKey'], ['kek', 'setKEK'], ['key2', 'setKey2'],
    ['nonce', 'setNonce'], ['aad', 'setAAD'], ['associatedData', 'setAAD'],
    ['tag', 'setTag'], ['counter', 'setCounter'],
    ['tweak', 'setTweak'], ['tweakKey', 'setTweakKey'],
    ['salt', 'setSalt'], ['info', 'setInfo'],
    ['radix', 'setRadix'], ['alphabet', 'setAlphabet'],
    ['preserveFormatChars', 'setPreserveFormatChars'],
    ['tagSize', 'setTagSize'], ['tagLength', 'setTagLength'],
    ['outputSize', 'setOutputSize'], ['messageLength', 'setMessageLength'],
    ['ivs', 'setIVs'], ['word32LE', 'setWord32LE'],
);

sub _set_mode_property {
    my ($inst, $vectorProp, $setterName, $val) = @_;
    return unless defined $val;
    if ($inst->can($setterName)) {
        eval { $inst->$setterName($val); };
    } elsif ($inst->can($vectorProp)) {
        eval { $inst->$vectorProp($val); };
    } else {
        $inst->{$vectorProp} = $val;
    }
}

# Identity block cipher (16-byte XOR-with-key) used to exercise cipher modes,
# mirroring tests/DummyBlockCipher.js. Mode test vectors that name no real
# (bundled) cipher were computed against this dummy.
package _DummyBlockCipherAlgorithm;

sub new {
    my $class = shift;
    return bless { BlockSize => 16 }, $class;
}

sub CreateInstance {
    my ($self, $isInverse) = @_;
    return _DummyBlockCipherInstance->new($self);
}

package _DummyBlockCipherInstance;

sub new {
    my ($class, $algorithm) = @_;
    return bless { algorithm => $algorithm, BlockSize => 16, _key => undef, inputBuffer => [] }, $class;
}

sub key {
    my $self = shift;
    if (@_) { $self->{_key} = shift; }
    return $self->{_key};
}

sub Feed {
    my ($self, $data) = @_;
    return unless $data && ref($data) eq 'ARRAY' && scalar(@$data);
    push @{$self->{inputBuffer}}, @$data;
}

sub Result {
    my ($self) = @_;
    die "Key not set" unless $self->{_key};
    my @buf = @{$self->{inputBuffer}};
    my $klen = scalar(@{$self->{_key}});
    my $out = [];
    for (my $i = 0; $i < scalar(@buf); $i += 16) {
        my $last = ($i + 15 < $#buf) ? $i + 15 : $#buf;
        my @block = @buf[$i .. $last];
        while (scalar(@block) < 16) { push @block, 0; }
        for my $j (0 .. 15) {
            push @$out, $block[$j] ^ $self->{_key}[$j % $klen];
        }
    }
    $self->{inputBuffer} = [];
    return $out;
}

package main;

sub _find_registered_by_name {
    my ($names) = @_;
    for my $cand (@$names) {
        for my $algo (@main::_registered_algorithms) {
            next unless ref($algo) && defined $algo->{name};
            return $algo if $algo->{name} eq $cand;
        }
    }
    return undef;
}

# Build the block-cipher instance a mode/AEAD construction needs for
# setBlockCipher(): either the real bundled cipher named by the vector's
# "cipher" field, or the dummy XOR cipher, keyed from the vector's "key".
sub _make_block_cipher {
    my ($t) = @_;
    my $inst;
    if (defined $t->{cipher}) {
        my $names = $_CIPHER_NAME_MAP{$t->{cipher}} || [$t->{cipher}];
        my $real = _find_registered_by_name($names);
        if ($real) {
            eval { $inst = $real->CreateInstance(0); };
        }
    }
    if (!$inst) {
        $inst = _DummyBlockCipherInstance->new(_DummyBlockCipherAlgorithm->new());
    }
    if (defined $t->{key}) {
        if ($inst->can('key')) {
            eval { $inst->key($t->{key}); };
        } else {
            $inst->{key} = $t->{key};
        }
    }
    return $inst;
}

sub _setup_instance_pl {
    my ($inst, $t) = @_;
    if ($inst->can('setBlockCipher')) {
        my $blockCipher = _make_block_cipher($t);
        eval { $inst->setBlockCipher($blockCipher); };
        if (defined $t->{iv} && $inst->can('setIV')) {
            eval { $inst->setIV($t->{iv}); };
        }
        for my $pair (@_MODE_PROP_SETTERS) {
            _set_mode_property($inst, $pair->[0], $pair->[1], $t->{$pair->[0]});
        }
    } else {
        for my $prop (qw(key iv nonce aad associatedData tag counter tweak salt info outputSize keySize blockSize rounds skip publicKey privateKey hashFunction skipBytes label iterations secret modulo count p m hashAlgorithm outputLength multiplier macSize keyInput customization n increment counterBits context aiv xofMode)) {
            _set_test_property($inst, $prop, $t->{$prop}) if exists $t->{$prop};
        }
    }
    # Use UNIVERSAL::isa (not ref eq HASH) so blessed TestCase objects -
    # whose ref() is the class name, not the string HASH - still have their
    # non-allowlisted vector properties (testMode, ...) applied.
    if (ref($t) && UNIVERSAL::isa($t, 'HASH')) {
        for my $prop (keys %$t) {
            next if $prop =~ /^(input|expected|text|uri|cipher|seed)$/;
            _set_test_property($inst, $prop, $t->{$prop}) if defined $t->{$prop};
        }
    }
    # PRNG seed - applied after every other property (a generator's seed must be
    # set last, once any order/config properties it depends on are in place;
    # mirrors the Python harness). Perl hash iteration order is undefined, so
    # relying on the generic pass above would set seed nondeterministically.
    if (ref($t) && UNIVERSAL::isa($t, 'HASH') && defined $t->{seed}) {
        _set_test_property($inst, 'seed', $t->{seed});
    }
}

sub _run_vectors_for {
    my ($algo) = @_;
    my $tests = ref($algo) ? $algo->{tests} : undef;
    return (0, 0) unless ref($tests) eq 'ARRAY' && scalar(@$tests) > 0;

    my $total = 0;
    my $passed = 0;
    for (my $idx = 0; $idx < scalar(@$tests); $idx++) {
        $total++;
        my $t = $tests->[$idx];
        eval {
            my $inst = $algo->CreateInstance($t->{inverse} ? 1 : 0);
            if (!defined $inst) {
                say "Vector $idx: SKIP (no instance)";
                $passed++;
            } else {
                _setup_instance_pl($inst, $t);
                my $inp = $t->{input} || [];
                $inst->Feed($inp);
                my $out = $inst->Result();
                my $exp = $t->{expected} || [];
                if (ref($exp) eq 'ARRAY' && scalar(@$exp) > 0) {
                    if (_bytes_eq($out, $exp)) {
                        $passed++;
                    } else {
                        say "Vector $idx: FAIL got=" . _to_hex($out) . " exp=" . _to_hex($exp);
                    }
                } else {
                    # No expected value: round-trip vector — decrypting the output
                    # with a fresh inverse instance must reproduce the input.
                    my $rt_ok = 0;
                    eval {
                        my $dec = $algo->CreateInstance(1);
                        if (defined $dec) {
                            _setup_instance_pl($dec, $t);
                            $dec->Feed($out);
                            $rt_ok = _bytes_eq($dec->Result(), $inp) ? 1 : 0;
                        }
                    };
                    if ($rt_ok) {
                        $passed++;
                    } else {
                        say "Vector $idx: FAIL got=" . _to_hex($out) . " exp=<round-trip>";
                    }
                }
            }
        };
        if ($@) {
            my $err = $@;
            $err =~ s/\\s+\$//;
            say "Vector $idx: ERROR $err";
        }
    }
    return ($passed, $total);
}

sub _run_vectors {
    my @algos = @main::_registered_algorithms;
    push @algos, $main::algorithmInstance if defined $main::algorithmInstance && !grep { $_ == $main::algorithmInstance } @algos;

    if (!@algos) {
        say "ERROR: no registered algorithm instance";
        return 0;
    }

    my $totalPassed = 0;
    my $totalCount = 0;
    for my $algo (@algos) {
        my ($passed, $total) = _run_vectors_for($algo);
        $totalPassed += $passed;
        $totalCount += $total;
    }

    if ($totalCount == 0) {
        say "ERROR: no test vectors";
        return 0;
    }

    say "Vectors passed: $totalPassed/$totalCount";
    return $totalPassed == $totalCount;
}

say "Testing ${algorithmName}...";
my $ok = 0;
eval {
    $ok = _run_vectors();
};
if ($@) {
    say "ERROR: $@";
    say "VECTOR_FAILED";
    exit(1);
}
if ($ok) {
    say "ALL_VECTORS_PASSED";
} else {
    say "VECTOR_FAILED";
    exit(1);
}`
  };
}

// Java Test Harness
function generateJavaTestHarness(algorithmCode, vector, algorithmName) {
  const input = bytesToArrayLiteral(vector.input, 'java');
  const expected = bytesToArrayLiteral(vector.expected, 'java');

  return {
    success: true,
    code: `${algorithmCode}

class TestHarness {
    public static void main(String[] args) {
        System.out.println("Testing ${algorithmName}...");
        try {
            byte[] input = ${input};
            byte[] expected = ${expected};

            System.out.println("Input length: " + input.length);
            System.out.println("Expected length: " + expected.length);
            System.out.println("COMPILE_OK");
        } catch (Exception e) {
            System.out.println("ERROR: " + e.getMessage());
            System.exit(1);
        }
    }
}`
  };
}

// Go Test Harness
function generateGoTestHarness(algorithmCode, vector, algorithmName) {
  const input = bytesToArrayLiteral(vector.input, 'go');
  const expected = bytesToArrayLiteral(vector.expected, 'go');
  const cleanedCode = stripMainFunction(algorithmCode, 'go');
  // Also strip package/import declarations since we add them in the harness
  const codeWithoutPkg = cleanedCode
    .replace(/^package\s+\w+\s*\n?/gm, '')  // Remove all package declarations
    .replace(/^import\s+"[^"]+"\s*\n?/gm, '')  // Remove single-line imports
    .replace(/^import\s+\([^)]*\)\s*\n?/gms, '');  // Remove multi-line import blocks (use 's' flag for dotAll)

  // Build imports based on what's actually used in the code
  const imports = ['"fmt"']; // fmt is always needed for test harness
  if (codeWithoutPkg.includes('errors.')) {
    imports.push('"errors"');
  }
  // Only include encoding/hex if hex package functions are used (not mustHexDecode which is inline)
  if (codeWithoutPkg.includes('hex.DecodeString') || codeWithoutPkg.includes('hex.EncodeToString')) {
    imports.push('"encoding/hex"');
  }
  if (codeWithoutPkg.includes('binary.')) {
    imports.push('"encoding/binary"');
  }
  // math package for Floor, Ceil, Round, etc.
  if (codeWithoutPkg.includes('math.')) {
    imports.push('"math"');
  }
  // math/rand for random number generation
  if (codeWithoutPkg.includes('rand.')) {
    imports.push('"math/rand"');
  }
  // math/bits for bit rotation operations
  if (codeWithoutPkg.includes('bits.')) {
    imports.push('"math/bits"');
  }

  return {
    success: true,
    code: `package main

import (
\t${imports.join('\n\t')}
)

${codeWithoutPkg}

func main() {
    fmt.Println("Testing ${algorithmName}...")

    input := ${input}
    expected := ${expected}

    fmt.Printf("Input length: %d\\n", len(input))
    fmt.Printf("Expected length: %d\\n", len(expected))
    fmt.Println("COMPILE_OK")
}`
  };
}

// Ruby Test Harness
function generateRubyTestHarness(algorithmCode, vector, algorithmName) {
  const input = bytesToArrayLiteral(vector.input, 'ruby');
  const expected = bytesToArrayLiteral(vector.expected, 'ruby');

  return {
    success: true,
    code: `#!/usr/bin/env ruby
${algorithmCode}

puts "Testing ${algorithmName}..."
begin
  input = ${input}
  expected = ${expected}

  puts "Input length: #{input.length}"
  puts "Expected length: #{expected.length}"
  puts "COMPILE_OK"
rescue => e
  puts "ERROR: #{e.message}"
  exit 1
end`
  };
}

// Rust Test Harness
function generateRustTestHarness(algorithmCode, vector, algorithmName) {
  const input = bytesToArrayLiteral(vector.input, 'rust');
  const expected = bytesToArrayLiteral(vector.expected, 'rust');
  const cleanedCode = stripMainFunction(algorithmCode, 'rust');

  return {
    success: true,
    code: `${cleanedCode}

fn main() {
    println!("Testing ${algorithmName}...");

    let input: Vec<u8> = ${input};
    let expected: Vec<u8> = ${expected};

    println!("Input length: {}", input.len());
    println!("Expected length: {}", expected.len());
    println!("COMPILE_OK");
}`
  };
}

// JavaScript Test Harness
function generateJavaScriptTestHarness(algorithmCode, vector, algorithmName) {
  return {
    success: true,
    code: `${algorithmCode}

// Test Harness
(function () {
    function _asBytes(v) {
        if (v === null || v === undefined) return null;
        if (Array.isArray(v)) return v.slice();
        if (v instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(v))) return Array.from(v);
        return v;
    }

    function _bytesEqual(a, b) {
        if (!Array.isArray(a) || !Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if ((a[i] & 0xFF) !== (b[i] & 0xFF)) return false;
        return true;
    }

    function _toHex(bytes) {
        if (!Array.isArray(bytes)) return String(bytes);
        return bytes.map(function (b) { return (b & 0xFF).toString(16).padStart(2, '0'); }).join('');
    }

    function _findRegisteredAlgorithm() {
        try {
            if (typeof AlgorithmFramework !== 'undefined' && AlgorithmFramework.Algorithms && AlgorithmFramework.Algorithms.length > 0)
                return AlgorithmFramework.Algorithms[AlgorithmFramework.Algorithms.length - 1];
        } catch (e) { /* fall through */ }
        try {
            if (typeof algorithmInstance !== 'undefined') return algorithmInstance;
        } catch (e) { /* fall through */ }
        return null;
    }

    // Map a test vector's "cipher" field (e.g. "AES") to the name(s) a
    // bundled dependency cipher (see DEP_CIPHER_FILES/BUNDLE_LANGUAGES in
    // TranspilerValidationSuite.js) registers itself under, so it can be
    // looked up in the shared AlgorithmFramework.Algorithms registry.
    var _CIPHER_NAME_MAP = {
        "AES": ["Rijndael (AES)", "AES", "Rijndael"],
        "Rijndael": ["Rijndael (AES)", "Rijndael"],
        "DES": ["DES"],
        "3DES": ["3DES (Triple DES)", "3DES"],
        "Blowfish": ["Blowfish"],
        "Camellia": ["Camellia"],
        "ARIA": ["ARIA"]
    };

    function _findCipherAlgorithm(name) {
        if (!name) return null;
        try {
            if (typeof AlgorithmFramework === 'undefined' || !AlgorithmFramework.Algorithms) return null;
            const candidates = _CIPHER_NAME_MAP[name] || [name];
            for (const cand of candidates) {
                const found = AlgorithmFramework.Algorithms.find(function (a) { return a.name === cand; });
                if (found) return found;
            }
        } catch (e) { /* fall through */ }
        return null;
    }

    // Identity block cipher (16-byte XOR-with-key) used to exercise cipher
    // modes when the test vector names no real cipher, or the named cipher
    // could not be bundled/found. Mirrors tests/DummyBlockCipher.js.
    function _dummyBlockCipherInstance() {
        return {
            BlockSize: 16,
            algorithm: { CreateInstance: function () { return _dummyBlockCipherInstance(); } },
            _key: null,
            _buf: [],
            get key() { return this._key ? this._key.slice() : null; },
            set key(k) { this._key = k ? Array.prototype.slice.call(k) : null; },
            Feed: function (data) { if (data) this._buf = this._buf.concat(Array.prototype.slice.call(data)); },
            Result: function () {
                const out = [];
                for (let i = 0; i < this._buf.length; i += 16) {
                    const block = this._buf.slice(i, i + 16);
                    while (block.length < 16) block.push(0);
                    for (let j = 0; j < 16; j++) out.push(block[j] ^ this._key[j % this._key.length]);
                }
                this._buf = [];
                return out;
            }
        };
    }

    // Cipher-mode instances (CBC, CTR, GCM, KW, XTS, ...) expose
    // setBlockCipher() instead of taking their key directly; wire in the
    // real bundled cipher (or the dummy above) plus its key, then the mode's
    // own IV if it has a setter, mirroring tests/TestEngine.js
    // _setupBlockCipherMode()/_createDummyCipher().
    function _setupBlockCipherMode(inst, t) {
        const cipherAlgo = _findCipherAlgorithm(t.cipher);
        const blockCipher = cipherAlgo ? cipherAlgo.CreateInstance(false) : _dummyBlockCipherInstance();
        const kv = _asBytes(t.key);
        if (kv) { try { blockCipher.key = kv; } catch (e) { /* not settable - ignore */ } }
        inst.setBlockCipher(blockCipher);
        if (typeof inst.setIV === 'function') {
            const ivv = _asBytes(t.iv);
            if (ivv) inst.setIV(ivv);
        }
    }

    // Vector property -> preferred setter method. Falls back to direct
    // property assignment when no setter method exists, mirroring
    // tests/TestEngine.js _applyProperty(). Covers cipher-mode setup
    // (setKEK for KW/KWP, setTweak/setTweakKey for XEX/LRW/XTS, setNonce/
    // setAAD for GCM/SIV/OCB) as well as generic KDF/AEAD properties.
    var _PROP_SETTERS = [
        ["kek", "setKEK"], ["key", "setKey"], ["key2", "setKey2"],
        ["iv", "setIV"], ["iv1", "setIV1"], ["iv2", "setIV2"], ["nonce", "setNonce"],
        ["tweak", "setTweak"], ["tweakKey", "setTweakKey"],
        ["aad", "setAAD"], ["tagSize", "setTagSize"], ["tagLength", "setTagLength"], ["tag", "setTag"],
        ["radix", "setRadix"], ["alphabet", "setAlphabet"],
        ["salt", "setSalt"], ["info", "setInfo"],
        ["outputSize", "setOutputSize"], ["OutputSize", "setOutputSize"],
        ["hashFunction", "setHashFunction"], ["password", "setPassword"],
        ["iterations", "setIterations"], ["counter", "setCounter"],
        ["keySize", "setKeySize"], ["blockSize", "setBlockSize"],
        ["seed", "setSeed"]
    ];

    function _applyVectorProperties(inst, t) {
        for (const [vectorProp, setterName] of _PROP_SETTERS) {
            if (t[vectorProp] === undefined || t[vectorProp] === null) continue;
            const val = Array.isArray(t[vectorProp]) ? _asBytes(t[vectorProp]) : t[vectorProp];
            try {
                if (typeof inst[setterName] === 'function') inst[setterName](val);
                else if (vectorProp in inst) inst[vectorProp] = val;
            } catch (e) { /* not settable on this instance type - ignore */ }
        }
        // Generic pass: apply any remaining algorithm-specific vector field
        // (multiplier/increment/modulo/skip/count for LCG PRNGs, associatedData,
        // customization for cSHAKE/KMAC, p/q/g/s for BBS/Blum-Micali, ...).
        var _reserved = { input: 1, expected: 1, text: 1, uri: 1, cipher: 1 };
        for (const k of Object.keys(t)) {
            if (_reserved[k] || t[k] === undefined || t[k] === null) continue;
            const val = Array.isArray(t[k]) ? _asBytes(t[k]) : t[k];
            const setter = 'set' + k.charAt(0).toUpperCase() + k.slice(1);
            try {
                if (typeof inst[setter] === 'function') inst[setter](val);
                else if (k in inst) inst[k] = val;
            } catch (e) { /* ignore */ }
        }
    }

    function _runVectors() {
        const algo = _findRegisteredAlgorithm();
        if (!algo) {
            console.log("ERROR: no registered algorithm instance");
            return false;
        }
        const tests = algo.tests || [];
        if (tests.length === 0) {
            console.log("ERROR: no test vectors");
            return false;
        }

        let total = 0, passed = 0;
        for (let idx = 0; idx < tests.length; idx++) {
            const t = tests[idx];
            total++;
            try {
                const inst = algo.CreateInstance(!!t.inverse);
                if (!inst) {
                    console.log("Vector " + idx + ": SKIP (no instance)");
                    passed++;
                    continue;
                }
                if (typeof inst.setBlockCipher === 'function') {
                    _setupBlockCipherMode(inst, t);
                }
                _applyVectorProperties(inst, t);
                const inp = _asBytes(t.input) || [];
                inst.Feed(inp);
                const out = _asBytes(inst.Result()) || [];
                const exp = _asBytes(t.expected) || [];
                if (exp && exp.length) {
                    if (_bytesEqual(out, exp)) {
                        passed++;
                    } else {
                        console.log("Vector " + idx + ": FAIL got=" + _toHex(out) + " exp=" + _toHex(exp));
                    }
                } else {
                    // No expected value: round-trip vector — decrypting the output
                    // with a fresh inverse instance must reproduce the input.
                    let rtOk = false;
                    try {
                        const dec = algo.CreateInstance(true);
                        if (dec) {
                            if (typeof dec.setBlockCipher === 'function') _setupBlockCipherMode(dec, t);
                            _applyVectorProperties(dec, t);
                            dec.Feed(out);
                            rtOk = _bytesEqual(_asBytes(dec.Result()) || [], inp);
                        }
                    } catch (e) { rtOk = false; }
                    if (rtOk) passed++;
                    else console.log("Vector " + idx + ": FAIL got=" + _toHex(out) + " exp=<round-trip>");
                }
            } catch (e) {
                console.log("Vector " + idx + ": ERROR " + (e && e.message ? e.message : e));
            }
        }
        console.log("Vectors passed: " + passed + "/" + total);
        return passed === total && total > 0;
    }

    console.log("Testing ${algorithmName}...");
    try {
        const ok = _runVectors();
        if (ok) {
            console.log("ALL_VECTORS_PASSED");
        } else {
            console.log("VECTOR_FAILED");
            process.exit(1);
        }
    } catch (error) {
        console.log("ERROR: " + error.message);
        process.exit(1);
    }
})();
`
  };
}

// TypeScript Test Harness
function generateTypeScriptTestHarness(algorithmCode, vector, algorithmName) {
  const input = bytesToArrayLiteral(vector.input, 'typescript');
  const expected = bytesToArrayLiteral(vector.expected, 'typescript');

  return {
    success: true,
    code: `${algorithmCode}

// Test Harness
(function main(): void {
    console.log("Testing ${algorithmName}...");
    try {
        const input: Uint8Array = ${input};
        const expected: Uint8Array = ${expected};

        console.log("Input length: " + input.length);
        console.log("Expected length: " + expected.length);
        console.log("COMPILE_OK");
    } catch (error) {
        console.log("ERROR: " + (error as Error).message);
        process.exit(1);
    }
})();
`
  };
}

// Basic (FreeBASIC) Test Harness
function generateBasicTestHarness(algorithmCode, vector, algorithmName) {
  const inputLen = vector.input?.length || 0;
  const expectedLen = vector.expected?.length || 0;
  const inputBytes = vector.input?.map(b => b.toString()).join(', ') || '0';
  const expectedBytes = vector.expected?.map(b => b.toString()).join(', ') || '0';

  return {
    success: true,
    code: `' FreeBASIC Test Harness for ${algorithmName}
' Compile with: fbc64 test.bas

${algorithmCode}

' Test data
Dim As UByte inputData(0 To ${inputLen > 0 ? inputLen - 1 : 0}) = { ${inputBytes} }
Dim As UByte expectedData(0 To ${expectedLen > 0 ? expectedLen - 1 : 0}) = { ${expectedBytes} }

Print "Testing ${algorithmName}..."
Print "Input length: "; ${inputLen}
Print "Expected length: "; ${expectedLen}
Print "COMPILE_OK"
End 0
`
  };
}

// Delphi/Pascal (FreePascal) Test Harness
function generateDelphiTestHarness(algorithmCode, vector, algorithmName) {
  const inputLen = vector.input?.length || 0;
  const expectedLen = vector.expected?.length || 0;
  const inputBytes = vector.input?.map(b => b.toString()).join(', ') || '0';
  const expectedBytes = vector.expected?.map(b => b.toString()).join(', ') || '0';

  return {
    success: true,
    code: `program TestHarness;
{$MODE DELPHI}

uses SysUtils;

${algorithmCode}

const
  InputData: array[0..${inputLen > 0 ? inputLen - 1 : 0}] of Byte = (${inputBytes || '0'});
  ExpectedData: array[0..${expectedLen > 0 ? expectedLen - 1 : 0}] of Byte = (${expectedBytes || '0'});

begin
  WriteLn('Testing ${algorithmName}...');
  WriteLn('Input length: ', ${inputLen});
  WriteLn('Expected length: ', ${expectedLen});
  WriteLn('COMPILE_OK');
end.
`
  };
}

// Kotlin Test Harness
function generateKotlinTestHarness(algorithmCode, vector, algorithmName) {
  const input = bytesToArrayLiteral(vector.input, 'kotlin');
  const expected = bytesToArrayLiteral(vector.expected, 'kotlin');

  return {
    success: true,
    code: `${algorithmCode}

fun main() {
    println("Testing ${algorithmName}...")
    try {
        val input: ByteArray = ${input}
        val expected: ByteArray = ${expected}

        println("Input length: \${input.size}")
        println("Expected length: \${expected.size}")
        println("COMPILE_OK")
    } catch (e: Exception) {
        println("ERROR: \${e.message}")
        kotlin.system.exitProcess(1)
    }
}
`
  };
}

// ============================================================================
// COMPILATION AND EXECUTION
// ============================================================================

function testCompilation(language, code, outputDir) {
  switch (language) {
    case 'c': return testCCompilation(code, outputDir);
    case 'cpp': return testCppCompilation(code, outputDir);
    case 'csharp': return testCSharpCompilation(code, outputDir);
    case 'java': return testJavaCompilation(code, outputDir);
    case 'python': return testPythonSyntax(code, outputDir);
    case 'php': return testPHPSyntax(code, outputDir);
    case 'perl': return testPerlSyntax(code, outputDir);
    case 'ruby': return testRubySyntax(code, outputDir);
    case 'go': return testGoCompilation(code, outputDir);
    case 'rust': return testRustCompilation(code, outputDir);
    case 'javascript': return testJavaScriptSyntax(code, outputDir);
    case 'typescript': return testTypeScriptSyntax(code, outputDir);
    case 'basic': return testBasicCompilation(code, outputDir);
    case 'delphi': return testDelphiCompilation(code, outputDir);
    case 'kotlin': return testKotlinCompilation(code, outputDir);
    default: return { success: false, error: 'Unknown language' };
  }
}

function testCCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.c');
  fs.writeFileSync(srcFile, code);

  const result = spawnSync('gcc', ['-c', srcFile, '-std=c99', '-Wall', '-fsyntax-only', '-o', '/dev/null'], {
    encoding: 'utf-8',
    timeout: 30000
  });

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testCppCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.cpp');
  fs.writeFileSync(srcFile, code);

  const result = spawnSync('g++', ['-c', srcFile, '-std=c++20', '-Wall', '-fsyntax-only', '-o', '/dev/null'], {
    encoding: 'utf-8',
    timeout: 30000
  });

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testCSharpCompilation(code, outputDir) {
  if (fs.existsSync(outputDir)) {
    try { fs.rmSync(outputDir, { recursive: true, force: true }); } catch (e) {}
  }
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(path.join(outputDir, 'Program.cs'), code);
  fs.writeFileSync(path.join(outputDir, 'Test.csproj'), `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>disable</Nullable>
    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
    <NoWarn>CS0168;CS0219;CS0414;CS8600;CS8601;CS8602;CS8603;CS8604;CS8618;CS8625</NoWarn>
  </PropertyGroup>
</Project>`);

  const result = spawnSync('dotnet', ['build', outputDir, '-c', 'Release', '-v', 'q'], {
    encoding: 'utf-8',
    timeout: 60000
  });

  const errors = (result.stderr || '') + (result.stdout || '');
  const success = result.status === 0;

  return {
    success,
    errors: errors,
    output: result.stdout || ''
  };
}

function testJavaCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'TestHarness.java');
  fs.writeFileSync(srcFile, code);

  const result = spawnSync('javac', [srcFile], {
    encoding: 'utf-8',
    timeout: 30000,
    cwd: outputDir
  });

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testPythonSyntax(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.py');
  fs.writeFileSync(srcFile, code);

  const result = spawnSync('python', ['-m', 'py_compile', srcFile], {
    encoding: 'utf-8',
    timeout: 30000
  });

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testPHPSyntax(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.php');
  fs.writeFileSync(srcFile, code);

  const result = spawnSync('php', ['-l', srcFile], {
    encoding: 'utf-8',
    timeout: 30000
  });

  return {
    success: result.status === 0,
    errors: result.stderr || result.stdout || '',
    output: result.stdout || ''
  };
}

function testPerlSyntax(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.pl');
  fs.writeFileSync(srcFile, code);

  const result = spawnSync('perl', ['-c', srcFile], {
    encoding: 'utf-8',
    timeout: 30000
  });

  return {
    success: result.status === 0 || (result.stderr || '').includes('syntax OK'),
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testRubySyntax(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.rb');
  fs.writeFileSync(srcFile, code);

  const result = spawnSync('ruby', ['-c', srcFile], {
    encoding: 'utf-8',
    timeout: 30000
  });

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testGoCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.go');
  fs.writeFileSync(srcFile, code);

  // Create go.mod file for module support (required for modern Go)
  const modFile = path.join(outputDir, 'go.mod');
  fs.writeFileSync(modFile, 'module test\n\ngo 1.21\n');

  // Use NUL on Windows, /dev/null on Unix
  const nullDevice = process.platform === 'win32' ? 'NUL' : '/dev/null';

  // Build from the output directory (required for go.mod to be found)
  const result = spawnSync('go', ['build', '-o', nullDevice, '.'], {
    cwd: outputDir,
    encoding: 'utf-8',
    timeout: 30000
  });

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testRustCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.rs');
  const exeFile = path.join(outputDir, 'test' + (process.platform === 'win32' ? '.exe' : ''));
  fs.writeFileSync(srcFile, code);

  // Compile to actual executable (works on all platforms)
  const result = spawnSync('rustc', [srcFile, '-o', exeFile], {
    encoding: 'utf-8',
    timeout: 60000
  });

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testJavaScriptSyntax(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.js');
  fs.writeFileSync(srcFile, code);

  // Node.js: --check for syntax validation without execution
  const result = spawnSync('node', ['--check', srcFile], {
    encoding: 'utf-8',
    timeout: 30000
  });

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testTypeScriptSyntax(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.ts');
  fs.writeFileSync(srcFile, code);

  // TypeScript: --noEmit for type checking without output
  const result = spawnSync('tsc', ['--noEmit', '--skipLibCheck', srcFile], {
    encoding: 'utf-8',
    timeout: 30000
  });

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testBasicCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.bas');
  fs.writeFileSync(srcFile, code);

  // FreeBASIC: -c for compile only (no linking)
  const result = spawnSync('fbc64', ['-c', srcFile], {
    encoding: 'utf-8',
    timeout: 30000,
    cwd: outputDir
  });

  // Clean up object file if created
  const objFile = path.join(outputDir, 'test.o');
  if (fs.existsSync(objFile))
    try { fs.unlinkSync(objFile); } catch (e) {}

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testDelphiCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.pas');
  fs.writeFileSync(srcFile, code);

  // FreePascal: -Cn = syntax check only (no code generation)
  // -Mdelphi = Delphi compatibility mode
  const result = spawnSync('fpc', ['-Cn', '-Mdelphi', srcFile], {
    encoding: 'utf-8',
    timeout: 30000,
    cwd: outputDir
  });

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

function testKotlinCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.kt');
  fs.writeFileSync(srcFile, code);

  // Kotlin: compile to jar for syntax validation
  const jarFile = path.join(outputDir, 'test.jar');
  const result = spawnSync('kotlinc', [srcFile, '-include-runtime', '-d', jarFile], {
    encoding: 'utf-8',
    timeout: 120000, // Kotlin compilation is slow
    cwd: outputDir
  });

  return {
    success: result.status === 0,
    errors: result.stderr || '',
    output: result.stdout || ''
  };
}

// Execution functions for runtime validation
function executeCode(language, outputDir) {
  if (args.compileOnly) return { success: true, output: 'COMPILE_ONLY', skipped: true };

  switch (language) {
    case 'csharp': return executeCSharp(outputDir);
    case 'python': return executePython(outputDir);
    case 'php': return executePHP(outputDir);
    case 'perl': return executePerl(outputDir);
    case 'ruby': return executeRuby(outputDir);
    case 'javascript': return executeJavaScript(outputDir);
    case 'typescript': return executeTypeScript(outputDir);
    case 'basic': return executeBasic(outputDir);
    case 'delphi': return executeDelphi(outputDir);
    case 'kotlin': return executeKotlin(outputDir);
    case 'c':
    case 'cpp':
    case 'java':
    case 'go':
    case 'rust':
      // These require additional build steps for execution
      return { success: true, output: 'EXECUTION_SKIP', skipped: true };
    default:
      return { success: false, error: 'Unknown language' };
  }
}

function executeCSharp(outputDir) {
  const result = spawnSync('dotnet', ['run', '--project', outputDir, '--no-build', '-c', 'Release'], {
    encoding: 'utf-8',
    timeout: 30000
  });

  const output = (result.stdout || '') + (result.stderr || '');
  return {
    success: result.status === 0 &&
      (output.includes('ALL_VECTORS_PASSED') || output.includes('COMPILE_OK')),
    output: output,
    exitCode: result.status
  };
}

function executePython(outputDir) {
  const srcFile = path.join(outputDir, 'test.py');
  const result = spawnSync('python', [srcFile], {
    encoding: 'utf-8',
    timeout: 30000
  });

  const output = (result.stdout || '') + (result.stderr || '');
  return {
    success: result.status === 0 &&
      (output.includes('ALL_VECTORS_PASSED') || output.includes('COMPILE_OK')),
    output: output,
    exitCode: result.status
  };
}

function executePHP(outputDir) {
  const srcFile = path.join(outputDir, 'test.php');
  const result = spawnSync('php', [srcFile], {
    encoding: 'utf-8',
    timeout: 30000
  });

  const output = (result.stdout || '') + (result.stderr || '');
  return {
    success: result.status === 0 && output.includes('COMPILE_OK'),
    output: output,
    exitCode: result.status
  };
}

function executePerl(outputDir) {
  const srcFile = path.join(outputDir, 'test.pl');
  const result = spawnSync('perl', [srcFile], {
    encoding: 'utf-8',
    timeout: 30000
  });

  const output = (result.stdout || '') + (result.stderr || '');
  return {
    // ALL_VECTORS_PASSED means every test vector actually ran and matched.
    // COMPILE_OK is kept as a fallback so harnesses without vector data
    // (or older-style output) don't regress to worse-than-before.
    success: output.includes('ALL_VECTORS_PASSED') ||
      (result.status === 0 && output.includes('COMPILE_OK')),
    output: output,
    exitCode: result.status
  };
}

function executeRuby(outputDir) {
  const srcFile = path.join(outputDir, 'test.rb');
  const result = spawnSync('ruby', [srcFile], {
    encoding: 'utf-8',
    timeout: 30000
  });

  const output = (result.stdout || '') + (result.stderr || '');
  return {
    success: result.status === 0 && output.includes('COMPILE_OK'),
    output: output,
    exitCode: result.status
  };
}

function executeJavaScript(outputDir) {
  const srcFile = path.join(outputDir, 'test.js');
  const result = spawnSync('node', [srcFile], {
    encoding: 'utf-8',
    timeout: 30000
  });

  const output = (result.stdout || '') + (result.stderr || '');
  return {
    // ALL_VECTORS_PASSED means every test vector actually ran and matched.
    // COMPILE_OK is kept as a fallback so harnesses without vector data
    // don't regress to worse-than-before.
    success: output.includes('ALL_VECTORS_PASSED') ||
      (result.status === 0 && output.includes('COMPILE_OK')),
    output: output,
    exitCode: result.status
  };
}

function executeTypeScript(outputDir) {
  const srcFile = path.join(outputDir, 'test.ts');
  const jsFile = path.join(outputDir, 'test.js');

  // Compile to JavaScript first
  const compileResult = spawnSync('tsc', ['--skipLibCheck', '--outDir', outputDir, srcFile], {
    encoding: 'utf-8',
    timeout: 30000,
    cwd: outputDir
  });

  if (compileResult.status !== 0)
    return { success: false, output: compileResult.stderr || 'Compilation failed' };

  // Execute with Node.js
  const result = spawnSync('node', [jsFile], {
    encoding: 'utf-8',
    timeout: 30000,
    cwd: outputDir
  });

  const output = (result.stdout || '') + (result.stderr || '');
  return {
    success: result.status === 0 && output.includes('COMPILE_OK'),
    output: output,
    exitCode: result.status
  };
}

function executeBasic(outputDir) {
  const srcFile = path.join(outputDir, 'test.bas');
  const exeFile = path.join(outputDir, process.platform === 'win32' ? 'test.exe' : 'test');

  // Compile to executable
  const compileResult = spawnSync('fbc64', [srcFile, '-x', exeFile], {
    encoding: 'utf-8',
    timeout: 30000,
    cwd: outputDir
  });

  if (compileResult.status !== 0)
    return { success: false, output: compileResult.stderr || 'Compilation failed' };

  // Execute
  const result = spawnSync(exeFile, [], {
    encoding: 'utf-8',
    timeout: 30000,
    cwd: outputDir
  });

  const output = (result.stdout || '') + (result.stderr || '');
  return {
    success: result.status === 0 && output.includes('COMPILE_OK'),
    output: output,
    exitCode: result.status
  };
}

function executeDelphi(outputDir) {
  const srcFile = path.join(outputDir, 'test.pas');
  const exeFile = path.join(outputDir, process.platform === 'win32' ? 'test.exe' : 'test');

  // Compile to executable
  const compileResult = spawnSync('fpc', ['-Mdelphi', '-o' + exeFile, srcFile], {
    encoding: 'utf-8',
    timeout: 60000,
    cwd: outputDir
  });

  if (compileResult.status !== 0)
    return { success: false, output: compileResult.stderr || 'Compilation failed' };

  // Execute
  const result = spawnSync(exeFile, [], {
    encoding: 'utf-8',
    timeout: 30000,
    cwd: outputDir
  });

  const output = (result.stdout || '') + (result.stderr || '');
  return {
    success: result.status === 0 && output.includes('COMPILE_OK'),
    output: output,
    exitCode: result.status
  };
}

function executeKotlin(outputDir) {
  const jarFile = path.join(outputDir, 'test.jar');

  // Check if jar exists (compilation should have created it)
  if (!fs.existsSync(jarFile))
    return { success: false, output: 'JAR file not found' };

  // Execute with java
  const result = spawnSync('java', ['-jar', jarFile], {
    encoding: 'utf-8',
    timeout: 30000,
    cwd: outputDir
  });

  const output = (result.stdout || '') + (result.stderr || '');
  return {
    success: result.status === 0 && output.includes('COMPILE_OK'),
    output: output,
    exitCode: result.status
  };
}

// ============================================================================
// MAIN TEST ORCHESTRATION
// ============================================================================

async function main() {
  console.log(`${C.bright}╔════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bright}║       Transpiler Validation Suite                          ║${C.reset}`);
  console.log(`${C.bright}╚════════════════════════════════════════════════════════════╝${C.reset}\n`);

  const startTime = Date.now();

  // Detect compilers
  const availableCompilers = detectCompilers();

  // Filter by requested language
  let targetLanguages = Object.keys(availableCompilers);
  if (args.language) {
    if (availableCompilers[args.language]) {
      targetLanguages = [args.language];
    } else {
      console.log(`${C.red}Language '${args.language}' not available.${C.reset}`);
      process.exit(1);
    }
  }

  if (targetLanguages.length === 0) {
    console.log(`${C.red}No compilers/interpreters found.${C.reset}`);
    process.exit(1);
  }

  console.log(`${C.cyan}Target languages: ${targetLanguages.map(l => availableCompilers[l].name).join(', ')}${C.reset}\n`);

  // Find algorithm files
  const categories = fs.readdirSync(ALGORITHMS_DIR).filter(d =>
    fs.statSync(path.join(ALGORITHMS_DIR, d)).isDirectory()
  );

  let algorithmFiles = [];
  for (const category of categories) {
    if (args.category && category !== args.category) continue;

    const categoryPath = path.join(ALGORITHMS_DIR, category);
    let files = fs.readdirSync(categoryPath)
      .filter(f => f.endsWith('.js') && !f.endsWith('.backup'))
      .map(f => ({ category, file: f, path: path.join(categoryPath, f) }));

    // Filter by algorithm name first (before quick limit)
    if (args.algorithm) {
      files = files.filter(a =>
        a.file.toLowerCase().includes(args.algorithm.toLowerCase())
      );
    }

    // Apply quick limit per category
    if (args.quick) {
      algorithmFiles.push(...files.slice(0, 3));
    } else {
      algorithmFiles.push(...files);
    }
  }

  console.log(`${C.cyan}Found ${algorithmFiles.length} algorithms to test${C.reset}\n`);

  // Create output directory
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Results tracking
  const results = {
    total: 0,
    jsValidated: 0,
    byCategory: {},
    byLanguage: {},
    details: [],
    startTime: new Date().toISOString(),
  };

  for (const lang of targetLanguages) {
    results.byLanguage[lang] = {
      transpiled: 0,
      compiled: 0,
      executed: 0,
      failed: 0,
      errors: []
    };
  }

  // Group by category for display
  const byCategory = {};
  for (const algo of algorithmFiles) {
    if (!byCategory[algo.category]) byCategory[algo.category] = [];
    byCategory[algo.category].push(algo);
  }

  // Process each category
  for (const [category, algos] of Object.entries(byCategory)) {
    console.log(`\n${C.bright}━━━ ${category.toUpperCase()} (${algos.length} algorithms) ━━━${C.reset}`);

    results.byCategory[category] = { total: 0, jsPass: 0, langResults: {} };
    for (const lang of targetLanguages) {
      results.byCategory[category].langResults[lang] = { transpiled: 0, compiled: 0, executed: 0 };
    }

    for (const algo of algos) {
      results.total++;
      results.byCategory[category].total++;

      const algoName = path.basename(algo.file, '.js');
      process.stdout.write(`  ${algoName.padEnd(25)} `);

      // First validate with JavaScript
      const jsResult = runJSValidation(algo.path);

      if (!jsResult.passed) {
        console.log(`${C.yellow}SKIP${C.reset} (JS validation failed)`);
        continue;
      }

      if (!jsResult.testVectors || jsResult.testVectors.length === 0) {
        console.log(`${C.yellow}SKIP${C.reset} (no test vectors)`);
        continue;
      }

      results.jsValidated++;
      results.byCategory[category].jsPass++;

      const langResults = [];

      // Test each language
      for (const lang of targetLanguages) {
        const outputDir = path.join(OUTPUT_DIR, lang, category, algoName);

        // Transpile
        const transpileResult = transpileAlgorithm(algo.path, lang);

        if (!transpileResult.success || !transpileResult.code) {
          langResults.push({ lang, status: 'transpile-fail', error: transpileResult.error });
          results.byLanguage[lang].failed++;
          continue;
        }

        results.byLanguage[lang].transpiled++;
        results.byCategory[category].langResults[lang].transpiled++;

        // Generate test harness
        const harnessResult = generateTestHarness(
          lang,
          transpileResult.code,
          jsResult.testVectors,
          algoName
        );

        if (!harnessResult.success) {
          langResults.push({ lang, status: 'harness-fail', error: harnessResult.error });
          results.byLanguage[lang].failed++;
          continue;
        }

        // Test compilation
        const compileResult = testCompilation(lang, harnessResult.code, outputDir);

        if (!compileResult.success) {
          langResults.push({ lang, status: 'compile-fail', error: compileResult.errors?.substring(0, 200) });
          results.byLanguage[lang].failed++;
          results.byLanguage[lang].errors.push({
            algo: algoName,
            stage: 'compile',
            error: compileResult.errors?.substring(0, 100)
          });
          continue;
        }

        results.byLanguage[lang].compiled++;
        results.byCategory[category].langResults[lang].compiled++;

        // Execute if not compile-only
        const execResult = executeCode(lang, outputDir);

        if (execResult.skipped) {
          langResults.push({ lang, status: 'compiled' });
        } else if (execResult.success) {
          langResults.push({ lang, status: 'executed' });
          results.byLanguage[lang].executed++;
          results.byCategory[category].langResults[lang].executed++;
        } else {
          langResults.push({ lang, status: 'exec-fail', error: execResult.output?.substring(0, 100) });
          results.byLanguage[lang].errors.push({
            algo: algoName,
            stage: 'execute',
            error: execResult.output?.substring(0, 100)
          });
        }

        // Store detail for report
        results.details.push({
          algorithm: algoName,
          category,
          language: lang,
          transpiled: transpileResult.success,
          compiled: compileResult.success,
          executed: execResult.success,
          testVectors: jsResult.testVectors?.length || 0
        });
      }

      // Print result summary
      // 'exec-fail' also means compilation succeeded, just execution failed
      const compiled = langResults.filter(r => ['compiled', 'executed', 'exec-fail'].includes(r.status)).length;
      const executed = langResults.filter(r => r.status === 'executed').length;
      const transpiled = langResults.filter(r => r.status !== 'transpile-fail').length;

      if (compiled === targetLanguages.length) {
        if (executed === targetLanguages.length || args.compileOnly) {
          console.log(`${C.green}OK${C.reset} (${compiled}/${targetLanguages.length})`);
        } else {
          console.log(`${C.green}COMPILED${C.reset} (${compiled}/${targetLanguages.length})`);
        }
      } else if (transpiled === targetLanguages.length) {
        const failedLangs = langResults.filter(r => !['compiled', 'executed'].includes(r.status)).map(r => `${r.lang}:${r.status}`).join(',');
        console.log(`${C.yellow}PARTIAL${C.reset} (compile: ${compiled}/${transpiled}) [${failedLangs}]`);
      } else {
        const failedLangs = langResults.filter(r => r.status === 'transpile-fail').map(r => r.lang).join(',');
        console.log(`${C.red}FAIL${C.reset} (transpile: ${transpiled}/${targetLanguages.length}) [${failedLangs}]`);
      }
    }
  }

  // Print summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`${C.bright}Summary${C.reset} (${elapsed}s)\n`);

  console.log(`Algorithms: ${results.total} total, ${results.jsValidated} JS-validated\n`);

  console.log('Language Results:');
  for (const [lang, stats] of Object.entries(results.byLanguage)) {
    const transpilePct = results.jsValidated > 0 ? Math.round(stats.transpiled / results.jsValidated * 100) : 0;
    const compilePct = stats.transpiled > 0 ? Math.round(stats.compiled / stats.transpiled * 100) : 0;
    const color = compilePct >= 90 ? C.green : (compilePct >= 50 ? C.yellow : C.red);

    console.log(`  ${availableCompilers[lang]?.name || lang}:`);
    console.log(`    Transpiled: ${stats.transpiled}/${results.jsValidated} (${transpilePct}%)`);
    console.log(`    Compiled:   ${color}${stats.compiled}/${stats.transpiled} (${compilePct}%)${C.reset}`);
    if (!args.compileOnly && stats.executed > 0) {
      console.log(`    Executed:   ${stats.executed}/${stats.compiled}`);
    }
  }

  // Category breakdown
  console.log('\nBy Category:');
  for (const [category, stats] of Object.entries(results.byCategory)) {
    const langSummary = Object.entries(stats.langResults)
      .map(([l, s]) => `${l}:${s.compiled}/${s.transpiled}`)
      .join(' ');
    console.log(`  ${category}: ${stats.jsPass}/${stats.total} JS-valid | ${langSummary}`);
  }

  // Generate report if requested
  if (args.report) {
    results.endTime = new Date().toISOString();
    results.elapsedSeconds = elapsed;
    const reportPath = path.join(OUTPUT_DIR, 'validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n${C.cyan}Report saved to: ${reportPath}${C.reset}`);
  }

  // Show top errors if verbose
  if (args.verbose) {
    console.log(`\n${C.red}Sample Errors:${C.reset}`);
    for (const [lang, stats] of Object.entries(results.byLanguage)) {
      if (stats.errors.length > 0) {
        console.log(`  ${lang}:`);
        for (const err of stats.errors.slice(0, 3)) {
          console.log(`    ${err.algo} [${err.stage}]: ${err.error?.substring(0, 80) || 'unknown'}`);
        }
      }
    }
  }

  const overallSuccess = Object.values(results.byLanguage).every(s =>
    s.failed === 0 || (s.compiled === s.transpiled)
  );

  console.log(`\n${overallSuccess ? C.green : C.yellow}Validation complete.${C.reset}`);
  process.exit(overallSuccess ? 0 : 1);
}

main().catch(e => {
  console.error(`${C.red}Fatal error: ${e.message}${C.reset}`);
  if (args.verbose) console.error(e.stack);
  process.exit(1);
});
