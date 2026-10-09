/**
 * Cross-language transpiler validation (the VALIDATION category of tests/TranspilerSuite.js)
 *
 * For every algorithm file, in a worker process of its own:
 * 1. Runs the original JavaScript through TestEngine (the reference). An
 *    algorithm whose reference fails is reported and not held against any
 *    language; the files it loads while running are its dependencies.
 * 2. Transpiles the file (and its dependencies, where the language bundles
 *    them) to every installed language.
 * 3. Appends a vector harness (tests/validation-harness/) that applies every
 *    vector with the semantics of TestEngine.ConfigureInstance and checks the
 *    output, and the round trip where the reference made one.
 * 4. Compiles it and, where the language has a vector harness, runs it.
 *
 * A language passes when every algorithm it transpiled also compiled and passed
 * every vector. The transpile, compile and execute counts are kept apart, and
 * every algorithm/language pair gets a result: the stage it failed at (or
 * passed), the first error, its class, and the vectors passed out of total.
 *
 * Usage (it is slow unscoped, so it runs only when named):
 *   node tests/TranspilerSuite.js --only=validation                    # every algorithm
 *   node tests/TranspilerSuite.js --only=validation --category=block   # one category directory
 *   node tests/TranspilerSuite.js --only=validation --language=csharp  # one language
 *   node tests/TranspilerSuite.js --only=validation --algorithm=tea    # file names containing "tea"
 *   node tests/TranspilerSuite.js --only=validation --quick            # 3 algorithms per category
 *   node tests/TranspilerSuite.js --only=validation --compile-only     # no execution
 *   node tests/TranspilerSuite.js --only=validation --jobs=8           # 8 files at a time
 *   node tests/TranspilerSuite.js --only=validation --report=out.json  # per-algorithm JSON
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, spawn } = require('child_process');

// Paths
const CIPHER_DIR = path.join(__dirname, '..');
const ALGORITHMS_DIR = path.join(CIPHER_DIR, 'algorithms');
const CODINGPLUGINS_DIR = path.join(CIPHER_DIR, 'codingplugins');
const HARNESS_DIR = path.join(__dirname, 'validation-harness');
const OUTPUT_DIR = path.join(__dirname, 'transpiler-validation-output');
const DEFAULT_REPORT = path.join(OUTPUT_DIR, 'validation-report.json');

// ANSI colors
const C = {
  reset: '\x1b[0m', bright: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m'
};

// Options of the current run (or worker), set by run()/the worker entry
const args = {
  verbose: false, quick: false, report: null, compileOnly: false,
  category: null, language: null, algorithm: null, jobs: null, timeout: null
};

// Seconds a compile or a run of one file may take before it counts as failed
const DEFAULT_TIMEOUT = 120;
// The limit grows to this many seconds per second the JavaScript reference took
const TIMEOUT_PER_REFERENCE_SECOND = 100;
// A worker handles one algorithm file in every language
const WORKER_TIMEOUT_SECONDS = 4 * 3600;

// ============================================================================
// TOOLS AND COMPILER/INTERPRETER DETECTION
// ============================================================================

// Tools that go by another name in some installations (FreeBASIC ships fbc
// or fbc64), tried in order.
const TOOL_ALTERNATIVES = { fbc64: ['fbc64', 'fbc'], fbc: ['fbc', 'fbc64'] };
const resolvedTools = new Map();

/**
 * Where a tool lives and how to start it. On Windows a tool may be a .cmd or
 * .bat shim (npm's tsc, kotlinc), which Node only starts through the shell.
 * @param {string} name - command name
 * @returns {{command: string, shell: boolean}|null} null when it is not on PATH
 */
function resolveTool(name) {
  if (resolvedTools.has(name)) return resolvedTools.get(name);
  let found = null;
  for (const candidate of TOOL_ALTERNATIVES[name] || [name]) {
    if (process.platform !== 'win32') {
      const which = spawnSync('which', [candidate], { encoding: 'utf-8', timeout: 10000 });
      if (which.status === 0 && which.stdout.trim()) found = { command: candidate, shell: false };
    } else {
      const where = spawnSync('where', [candidate], { encoding: 'utf-8', timeout: 10000, windowsHide: true });
      const paths = where.status === 0 ? where.stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean) : [];
      // Prefer a real executable over a shim of the same name
      const exe = paths.find(p => /\.(exe|com)$/i.test(p));
      const shim = paths.find(p => /\.(cmd|bat)$/i.test(p));
      if (exe) found = { command: exe, shell: false };
      else if (shim) found = { command: shim, shell: true };
    }
    if (found) break;
  }
  resolvedTools.set(name, found);
  return found;
}

/** An argument quoted for cmd.exe, for tools started through the shell. */
function shellQuote(arg) {
  const text = String(arg);
  return /^[\w.:\\/=+-]+$/.test(text) ? text : `"${text.replace(/"/g, '""')}"`;
}

/**
 * spawnSync for a named tool: resolves it on PATH (shims included). A tool
 * that is not installed yields status null and an error, never a throw.
 * @returns {object} spawnSync's result
 */
function spawnTool(name, argv, options = {}) {
  const tool = resolveTool(name);
  if (!tool) return { status: null, stdout: '', stderr: '', error: new Error(`${name} is not on PATH`) };
  const opts = Object.assign({ encoding: 'utf-8', windowsHide: true }, options);
  if (!tool.shell) return spawnSync(tool.command, argv, opts);
  const line = [tool.command, ...argv].map(shellQuote).join(' ');
  return spawnSync(line, [], Object.assign(opts, { shell: true, windowsVerbatimArguments: true }));
}

// Output that means a tool is present but cannot run
const BROKEN_TOOL = /Could not create the Java Virtual Machine|Error occurred during initialization of VM|is not recognized as an internal or external command|No Java runtime present|command not found/i;

/**
 * Probe a tool: it must start, exit 0, say nothing that marks it broken, and
 * print a version (to stdout or stderr) that matches the pattern.
 * @param {string} name - command name
 * @param {string[]} argv - version arguments
 * @param {RegExp} pattern - the version line; its first group, when it has one, is the version
 * @returns {{available: boolean, version?: string, reason?: string}}
 */
function probeTool(name, argv, pattern) {
  let result;
  try {
    result = spawnTool(name, argv, { timeout: 60000 });
  } catch (error) {
    return { available: false, reason: error.message };
  }
  if (result.error) return { available: false, reason: result.error.message };
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (BROKEN_TOOL.test(output)) return { available: false, reason: firstLine(output.match(BROKEN_TOOL)[0]) };
  if (result.status !== 0) return { available: false, reason: `${name} exited with ${result.status}` };
  const line = output.split(/\r?\n/).map(l => l.trim()).find(l => pattern.test(l));
  if (!line) return { available: false, reason: `${name} printed no version` };
  const m = pattern.exec(line);
  return { available: true, version: m[1] || line };
}

/** A detector needing every probe to pass; the first probe's version is reported. */
const requireTools = (...probes) => () => {
  let first = null;
  for (const [name, argv, pattern] of probes) {
    const r = probeTool(name, argv, pattern);
    if (!r.available) return r;
    if (!first) first = r;
  }
  return first;
};

const LANGUAGE_COMPILERS = {
  c: { name: 'C', detect: requireTools(['gcc', ['--version'], /^gcc.*?(\d+\.\d+\.\d+)/i]), extension: 'c', pluginFile: 'c.js' },
  cpp: { name: 'C++', detect: requireTools(['g++', ['--version'], /^g\+\+.*?(\d+\.\d+\.\d+)/i]), extension: 'cpp', pluginFile: 'cpp.js' },
  csharp: { name: 'C#', detect: requireTools(['dotnet', ['--version'], /^(\d+\.\d+\.\d+\S*)$/]), extension: 'cs', pluginFile: 'csharp.js' },
  java: {
    name: 'Java',
    detect: requireTools(['java', ['-version'], /version "?([\d._]+)/i], ['javac', ['-version'], /javac\s+([\d._]+)/i]),
    extension: 'java', pluginFile: 'java.js'
  },
  python: { name: 'Python', detect: requireTools(['python', ['--version'], /^Python (\d+\.\d+\.\d+)/]), extension: 'py', pluginFile: 'python.js' },
  php: { name: 'PHP', detect: requireTools(['php', ['--version'], /^PHP (\d+\.\d+\.\d+)/]), extension: 'php', pluginFile: 'php.js' },
  perl: { name: 'Perl', detect: requireTools(['perl', ['--version'], /This is perl.*?v(\d+\.\d+\.\d+)/]), extension: 'pl', pluginFile: 'perl.js' },
  ruby: { name: 'Ruby', detect: requireTools(['ruby', ['--version'], /^ruby (\d+\.\d+\.\d+)/]), extension: 'rb', pluginFile: 'ruby.js' },
  go: { name: 'Go', detect: requireTools(['go', ['version'], /^go version go(\d+\.\d+(?:\.\d+)?)/]), extension: 'go', pluginFile: 'go.js' },
  rust: { name: 'Rust', detect: requireTools(['rustc', ['--version'], /^rustc (\d+\.\d+\.\d+)/]), extension: 'rs', pluginFile: 'rust.js' },
  javascript: { name: 'JavaScript', detect: requireTools(['node', ['--version'], /^v(\d+\.\d+\.\d+)/]), extension: 'js', pluginFile: 'javascript.js' },
  typescript: { name: 'TypeScript', detect: requireTools(['tsc', ['--version'], /^Version (\d+\.\d+\.\d+)/]), extension: 'ts', pluginFile: 'typescript.js' },
  basic: { name: 'Basic', detect: requireTools(['fbc64', ['-version'], /FreeBASIC Compiler - Version (\d+\.\d+\.\d+)/i]), extension: 'bas', pluginFile: 'basic.js' },
  delphi: { name: 'Delphi/Pascal', detect: requireTools(['fpc', ['-iV'], /^(\d+\.\d+\.\d+)$/]), extension: 'pas', pluginFile: 'delphi.js' },
  kotlin: { name: 'Kotlin', detect: requireTools(['kotlinc', ['-version'], /kotlinc-jvm (\d+\.\d+\.\d+)/]), extension: 'kt', pluginFile: 'kotlin.js' },
};

/**
 * Every language whose toolchain is installed and works. A tool that is
 * missing or broken is reported and left out; it never fails the run.
 * @returns {Object<string, object>} language key -> config with version
 */
function detectCompilers() {
  console.log(`${C.cyan}Detecting compilers/interpreters...${C.reset}\n`);
  const available = {};
  for (const [key, config] of Object.entries(LANGUAGE_COMPILERS)) {
    let result;
    try {
      result = config.detect();
    } catch (error) {
      result = { available: false, reason: error.message };
    }
    if (result.available) {
      available[key] = { ...config, ...result };
      console.log(`  ${C.green}✓${C.reset} ${config.name}: ${result.version}`);
    } else {
      console.log(`  ${C.dim}- ${config.name}: ${result.reason || 'not found'}${C.reset}`);
    }
  }
  console.log('');
  return available;
}

// ============================================================================
// REFERENCE RUN (the original JavaScript) AND THE HARNESS SPEC
// ============================================================================

// Vector fields, as TestEngine._applyVectorProperties treats them: framework
// fields the engine consumes, descriptive fields that configure nothing,
// fields with a dedicated setter (in application order), and the seed (last).
const FRAMEWORK_FIELDS = new Set(['input', 'expected', 'text', 'uri', 'inverse']);
const DESCRIPTIVE_FIELDS = new Set(['roundTripOnly']);
const SETTER_FIELDS = [
  ['key', 'setKey'], ['iv', 'setIV'], ['nonce', 'setNonce'], ['iv1', 'setIV1'], ['iv2', 'setIV2'],
  ['key2', 'setKey2'], ['tweak', 'setTweak'], ['tweakKey', 'setTweakKey'],
  ['aad', 'setAAD'], ['tagSize', 'setTagSize'], ['tagLength', 'setTagLength'], ['tag', 'setTag'],
  ['radix', 'setRadix'], ['alphabet', 'setAlphabet'],
  ['salt', 'setSalt'], ['info', 'setInfo'], ['outputSize', 'setOutputSize'], ['OutputSize', 'setOutputSize'],
  ['hashFunction', 'setHashFunction'], ['password', 'setPassword'], ['iterations', 'setIterations']
];
const SEED_FIELD = ['seed', 'setSeed'];
// Cipher modes that split and manage their own keys (TestEngine keys no cipher for them)
const MULTI_KEY_MODES = ['EDE', 'EEE'];

function categoryName(algorithm) {
  if (!algorithm.category) return '';
  return typeof algorithm.category === 'string' ? algorithm.category : (algorithm.category.name || String(algorithm.category));
}

// TestEngine._requiresEncodingStability: these categories round-trip as
// encode(decode(encode(x))) == encode(x) instead of decode(encode(x)) == x
function requiresEncodingStability(algorithm) {
  const name = categoryName(algorithm).toLowerCase();
  return ['encoding', 'checksum', 'error correction'].some(c => name.includes(c));
}

function sameArray(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; ++i) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * How the harness applies and checks one vector, mirroring TestEngine.TestVector
 * and ConfigureInstance. The checks are the ones the reference passed: the
 * expected output unless the vector is round-trip only, and the round trip
 * (or encoding stability) only where the reference made one successfully.
 * @param {object} algorithm - registered reference algorithm
 * @param {object} vector - its test vector
 * @param {object} vectorResult - TestEngine.TestVector's result for it
 * @param {boolean} isMode - whether TestEngine treats it as a cipher mode
 * @param {object} categories - AlgorithmFramework.CategoryType
 * @returns {object} { fields, steps, mode, inverse, expect, rt }
 */
function vectorPlan(algorithm, vector, vectorResult, isMode, categories) {
  const fields = Object.keys(vector).filter(k => vector[k] !== undefined && !FRAMEWORK_FIELDS.has(k) && !DESCRIPTIVE_FIELDS.has(k));
  const steps = [];
  const step = (field, extra) => Object.assign({ field }, vector[field] === null ? { isNull: true } : {}, extra);
  if (fields.includes('kek')) steps.push(step('kek', { kind: 'kek' }));
  for (const [field, setter] of SETTER_FIELDS)
    if (fields.includes(field)) steps.push(step(field, { setter }));
  for (const field of fields)
    if (field !== 'kek' && field !== SEED_FIELD[0] && !SETTER_FIELDS.some(([f]) => f === field)) steps.push(step(field));
  if (fields.includes(SEED_FIELD[0])) steps.push(step(SEED_FIELD[0], { setter: SEED_FIELD[1] }));

  const hasExpected = !!(vector.expected && vector.expected.length > 0);
  const asymmetricRoundTrip = !!categories && algorithm.category === categories.ASYMMETRIC
    && hasExpected && sameArray(vector.expected, vector.input);
  const rt = vectorResult && vectorResult.roundTripSuccess === true
    ? (requiresEncodingStability(algorithm) ? 'stability' : 'decode')
    : null;
  return {
    fields,
    steps,
    mode: isMode ? { cipher: vector.cipher ? String(vector.cipher) : null, keyTruthy: !!vector.key, ivTruthy: !!vector.iv } : null,
    inverse: vector.inverse === true,
    expect: hasExpected && !asymmetricRoundTrip,
    rt
  };
}

/**
 * Algorithm files loaded while the reference ran, children before parents
 * (the order they must be defined in when bundled), the file itself excluded.
 * Only files that register an algorithm count; .data libraries are bundled
 * separately.
 * @param {string} mainFile - absolute path of the file under test
 * @returns {string[]} absolute paths
 */
function loadedDependencies(mainFile) {
  const ordered = [];
  const seen = new Set();
  const isAlgorithmFile = file => file.toLowerCase().startsWith(ALGORITHMS_DIR.toLowerCase() + path.sep)
    && file.endsWith('.js') && !file.endsWith('.data.js');
  const visit = mod => {
    if (!mod || seen.has(mod.filename)) return;
    seen.add(mod.filename);
    for (const child of mod.children || []) visit(child);
    if (isAlgorithmFile(mod.filename) && path.resolve(mod.filename) !== path.resolve(mainFile)) ordered.push(mod.filename);
  };
  visit(require.cache[path.resolve(mainFile)]);
  for (const mod of Object.values(require.cache)) visit(mod);
  return ordered.filter(file => {
    try { return /RegisterAlgorithm\s*\(/.test(fs.readFileSync(file, 'utf-8')); } catch (e) { return false; }
  });
}

/**
 * Run the original algorithm file through TestEngine in this process (a worker
 * runs one file) and derive what the transpiled harness must reproduce.
 * @param {string} algorithmFile - absolute path
 * @returns {Promise<object>} { algorithms: [{ name, className, category, isMode,
 *   multiKey, referenceError, vectors }], dependencies, sample, error }
 */
async function referenceRun(algorithmFile) {
  const TestEngine = require('./TestEngine.js');
  await TestEngine.LoadDependencies(true, false);
  const AF = global.AlgorithmFramework;
  const resolved = path.resolve(algorithmFile);
  try {
    require(resolved);
  } catch (error) {
    return { algorithms: [], dependencies: [], sample: null, error: `loading the original failed: ${error.message}` };
  }

  const source = resolved.toLowerCase();
  const registered = [...global.__algorithmSources].filter(([, file]) => file === source).map(([algorithm]) => algorithm);
  const algorithms = [];
  let sample = null;
  for (const algorithm of registered) {
    const entry = {
      name: algorithm.name,
      className: algorithm.constructor && algorithm.constructor.name || null,
      category: categoryName(algorithm),
      isMode: !!TestEngine.IsBlockCipherMode(algorithm),
      multiKey: MULTI_KEY_MODES.includes(algorithm.name),
      referenceError: null,
      vectors: []
    };
    algorithms.push(entry);
    let result;
    try {
      result = await TestEngine.TestAlgorithm(algorithm);
    } catch (error) {
      entry.referenceError = `TestEngine threw: ${error.message}`;
      continue;
    }
    if (result.status !== 'passed') {
      const first = result.errors.find(e => e) || {};
      entry.referenceError = `reference ${result.status} (${result.passed}/${result.total} vectors)`
        + (first.error || first.message ? `: ${first.error || first.message}` : '');
      continue;
    }
    entry.vectors = algorithm.tests.map((vector, i) =>
      vectorPlan(algorithm, vector, result.vectorResults[i], entry.isMode, AF.CategoryType));
    if (!sample && algorithm.tests.length) {
      const first = algorithm.tests[0];
      sample = { input: Array.from(first.input || []), expected: Array.from(first.expected || []) };
    }
  }
  return { algorithms, dependencies: loadedDependencies(resolved), sample, error: null };
}

/**
 * The framework's class names, and every member a framework instance class
 * gives an instance (own fields and prototype members) - what `name in
 * instance` finds in JavaScript before the algorithm adds anything.
 * @returns {{types: string[], members: string[]}}
 */
function frameworkSurface() {
  const AF = require(path.join(CIPHER_DIR, 'AlgorithmFramework.js'));
  const types = Object.keys(AF).filter(name => typeof AF[name] === 'function' && /^[A-Z]/.test(name));
  const members = new Set();
  for (const name of types.filter(n => /^I\w*Instance$/.test(n))) {
    let instance = null;
    try { instance = new AF[name](null); } catch (e) { instance = null; }
    if (instance) for (const key of Object.keys(instance)) members.add(key);
    for (let proto = AF[name].prototype; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto))
      for (const key of Object.getOwnPropertyNames(proto)) if (key !== 'constructor') members.add(key);
  }
  return { types: types.sort(), members: [...members].sort() };
}

// ============================================================================
// TRANSPILATION
// ============================================================================

let transpiler = null;
const languagePlugins = {};

function loadTranspiler() {
  if (!transpiler) transpiler = require(path.join(CIPHER_DIR, 'type-aware-transpiler.js')).TypeAwareJSASTParser;
  return transpiler;
}

function loadLanguagePlugin(language) {
  if (languagePlugins[language]) return languagePlugins[language];
  const pluginFile = LANGUAGE_COMPILERS[language] && LANGUAGE_COMPILERS[language].pluginFile;
  if (!pluginFile) throw new Error(`no language plugin for ${language}`);
  const { LanguagePlugins } = require(path.join(CODINGPLUGINS_DIR, 'LanguagePlugin.js'));
  LanguagePlugins.Clear();
  require(path.join(CODINGPLUGINS_DIR, pluginFile));
  const plugins = LanguagePlugins.GetAll();
  if (plugins.length === 0) throw new Error(`${pluginFile} registered no language plugin`);
  languagePlugins[language] = plugins[0];
  return plugins[0];
}

// Bundling is implemented for languages whose prelude accumulates a
// name->algorithm registry the harness can look up.
const BUNDLE_LANGUAGES = new Set(['python', 'perl', 'javascript', 'java']);

function transpileOne(source, plugin, algoName, extraOptions, parserOptions) {
  const Parser = loadTranspiler();
  const ast = new Parser(source, parserOptions).parse();
  const result = plugin.GenerateFromAST(ast, Object.assign({
    namespace: 'CipherValidation',
    className: algoName + 'Generated',
    inlineOpCodes: true,
    generateTestHarness: true,
  }, extraOptions));
  if (!result || !result.success || !result.code)
    throw new Error((result && (result.error || (result.errors || []).join('; '))) || 'the plugin produced no code');
  return result.code;
}

/**
 * The expression a .data library exports, in the shapes the libraries use:
 * a UMD factory ending in "return { a, b };" or "return Name;", or an IIFE
 * assigning "module.exports = ...;".
 * @param {string} source - library source
 * @returns {string|null} JavaScript expression, or null for an unknown shape
 */
function libraryExports(source) {
  let m = source.match(/return\s*(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*;?\s*\}\s*\)\s*\)\s*;?\s*$/);
  if (m) return m[1];
  // Its own IIFE keeps the names local, so the bundle hands it a module
  // object of its own to assign, and returns that
  return /module\.exports\s*=/.test(source) ? 'module.exports' : null;
}

/**
 * The names a .data library exports: every name of an exported object
 * literal, or the one variable it returns.
 * @param {string} source - library source
 * @returns {{names: string[], single: string|null}|null} null for an unknown shape
 */
function libraryExportNames(source) {
  const exported = libraryExports(source);
  if (!exported) return null;
  let literal = exported;
  if (exported === 'module.exports') {
    const m = source.match(/module\.exports\s*=\s*(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*;/);
    if (!m) return null;
    literal = m[1];
  }
  if (!literal.startsWith('{')) return { names: [], single: literal };
  const names = literal.slice(1, -1).split(',').map(s => s.trim()).filter(Boolean)
    .map(entry => entry.split(':')[0].trim());
  return { names, single: null };
}

/** The Python transpiler's snake_case of a name (all-capitals names are kept). */
function pythonSnake(name) {
  if (name === name.toUpperCase()) return name;
  return name.replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2').replace(/([a-z\d])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
 * Bundle the .data libraries an algorithm takes through its third factory
 * parameter, for Python and Perl: the library's transpiled code, then the
 * parameter bound to its exports. Python reads them as attributes (raw or
 * snake_case names), Perl as hash entries or methods.
 * @returns {{code: string, error?: string}}
 */
function bundleLibrariesFor(language, source, algorithmFile, plugin, parserOptions) {
  const paramMatches = [...source.matchAll(/function\s*\(\s*AlgorithmFramework\s*,\s*OpCodes\s*,\s*(\w+)\s*\)/g)];
  const paramName = paramMatches.length ? paramMatches[paramMatches.length - 1][1] : null;
  if (!paramName) return { code: '' };
  let code = '';
  for (const lm of source.matchAll(/require\(\s*['"]\.\/([^'"]+)['"]\s*\)/g)) {
    const libPath = [lm[1], lm[1] + '.js', lm[1] + '.data.js']
      .map(c => path.join(path.dirname(algorithmFile), c)).find(f => f.endsWith('.data.js') && fs.existsSync(f));
    if (!libPath) continue;
    const libSrc = fs.readFileSync(libPath, 'utf-8');
    const exported = libraryExportNames(libSrc);
    if (!exported) return { code, error: 'library ' + path.basename(libPath) + ': its exports are in no shape the bundling knows' };
    let libCode;
    try {
      libCode = transpileOne(libSrc, plugin, path.basename(libPath, '.js').replace(/[^a-zA-Z0-9]/g, '_') + '_lib', undefined, parserOptions);
    } catch (e) {
      return { code, error: 'library ' + path.basename(libPath) + ': ' + e.message };
    }
    // A library assigning module.exports from its own IIFE keeps its names
    // local: it gets a module object to assign, and the parameter is bound to that
    if (libraryExports(libSrc) === 'module.exports') {
      code += language === 'python'
        ? `import types as _vh_types\nmodule = _vh_types.SimpleNamespace(exports=_vh_types.SimpleNamespace())\n${libCode}\n${pythonSnake(paramName)} = module.exports\n\n`
        : `our $module = { exports => {} };\n${libCode}\nour $${paramName} = $module->{exports};\n\n`;
      continue;
    }
    code += libCode + '\n\n';
    if (language === 'python') {
      const target = pythonSnake(paramName);
      if (exported.single) {
        if (pythonSnake(exported.single) !== target) code += `${target} = ${pythonSnake(exported.single)}\n\n`;
      } else {
        const pick = name => `globals()[${JSON.stringify(name)}] if ${JSON.stringify(name)} in globals() else globals()[${JSON.stringify(pythonSnake(name))}]`;
        const entries = [];
        for (const name of exported.names) {
          entries.push(`${JSON.stringify(name)}: ${pick(name)}`);
          if (pythonSnake(name) !== name) entries.push(`${JSON.stringify(pythonSnake(name))}: ${pick(name)}`);
        }
        code += `import types as _vh_types\n${target} = _vh_types.SimpleNamespace(**{${entries.join(', ')}})\n\n`;
      }
    } else if (language === 'perl') {
      if (exported.single) {
        if (exported.single !== paramName) code += `our $${paramName} = $${exported.single};\n\n`;
      } else {
        // A class is its package name, a function a method of the binding's
        // own package, anything else the variable of that name
        const pkg = `_VhLibrary_${paramName}`;
        const entries = [];
        const methods = [];
        for (const name of exported.names) {
          if (new RegExp(`^package ${name};`, 'm').test(libCode)) entries.push(`'${name}' => '${name}'`);
          else if (new RegExp(`^sub ${name}\\b`, 'm').test(libCode)) methods.push(`sub ${name} { my $self = shift; return main::${name}(@_); }`);
          else entries.push(`'${name}' => $${name}`);
        }
        code += `package ${pkg};\n${methods.join('\n')}\npackage main;\nour $${paramName} = bless({ ${entries.join(', ')} }, '${pkg}');\n\n`;
      }
    }
  }
  return { code };
}

/**
 * The .data libraries an algorithm takes through its third factory parameter,
 * for the JVM languages: the plugin merges each library's declarations into
 * the generated class and binds the parameter to what the library exports.
 * A parameter that loads another algorithm module instead
 * (function () { return require('./des'); }) names that module.
 * @returns {{param: string, ast?: object, exports?: object, loader?: string}[]}
 */
function jvmLibraries(source, algorithmFile) {
  const paramMatches = [...source.matchAll(/function\s*\(\s*AlgorithmFramework\s*,\s*OpCodes\s*,\s*(\w+)\s*\)/g)];
  const param = paramMatches.length ? paramMatches[paramMatches.length - 1][1] : null;
  if (!param) return [];
  const loader = source.match(/function\s*\(\s*\)\s*\{\s*return\s+require\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*\}/);
  if (loader) return [{ param, loader: path.basename(loader[1], '.js') }];
  const libraries = [];
  for (const lm of source.matchAll(/require\(\s*['"]\.\/([^'"]+)['"]\s*\)/g)) {
    const libPath = [lm[1], lm[1] + '.js', lm[1] + '.data.js']
      .map(c => path.join(path.dirname(algorithmFile), c)).find(f => f.endsWith('.data.js') && fs.existsSync(f));
    if (!libPath) continue;
    const libSrc = fs.readFileSync(libPath, 'utf-8');
    const Parser = loadTranspiler();
    libraries.push({ param, ast: new Parser(libSrc).parse(), exports: libraryExportNames(libSrc) });
  }
  return libraries;
}

/**
 * Transpile an algorithm file and, where the language bundles them, the
 * algorithm files it loaded while its reference ran.
 * @param {string} algorithmFile - absolute path
 * @param {string} language - language key
 * @param {string[]} dependencies - absolute paths, children before parents
 * @returns {{success: boolean, code?: string, error?: string}}
 */
function transpileAlgorithm(algorithmFile, language, dependencies = []) {
  let plugin;
  try {
    plugin = loadLanguagePlugin(language);
  } catch (e) {
    return { success: false, error: `plugin: ${e.message}` };
  }

  // The IL AST is shared by every target language, so by default it stubs out
  // require()-using methods (no equivalent in C#/Python/etc). When the target
  // *is* JavaScript, require() is valid runnable code - keep it.
  const parserOptions = language === 'javascript' ? { keepModuleLoaderFunctions: true } : undefined;
  const source = fs.readFileSync(algorithmFile, 'utf-8');
  const algoName = path.basename(algorithmFile, '.js').replace(/[^a-zA-Z0-9]/g, '_');
  let code;
  try {
    code = transpileOne(source, plugin, algoName, language === 'java' ? { libraries: jvmLibraries(source, algorithmFile) } : undefined, parserOptions);
  } catch (e) {
    return { success: false, error: e.message };
  }
  if (!BUNDLE_LANGUAGES.has(language)) return { success: true, code };

  // JavaScript embeds the real AlgorithmFramework.js/OpCodes.js as a single
  // standalone prelude; dependency code is transpiled without its own prelude
  // (a second copy would replace the registry) and wrapped in its own function
  // scope so its top-level declarations cannot collide with the main file's.
  // Python and Perl preludes keep their registry across repeated copies.
  const noPreludeOptions = language === 'javascript' ? { generateTestHarness: false }
    : language === 'java' ? { includeRuntime: false } : undefined;
  // A JavaScript dependency also keeps what its factory returned, for a file
  // that loads it through a loader parameter (see below).
  const depExports = new Map();
  let prefix = '';
  for (const depPath of dependencies) {
    const depName = path.basename(depPath, '.js').replace(/[^a-zA-Z0-9]/g, '_') + '_dep';
    try {
      const depSource = fs.readFileSync(depPath, 'utf-8');
      const depCode = transpileOne(depSource, plugin, depName, noPreludeOptions, parserOptions);
      if (language === 'javascript') {
        const variable = '__validation_' + depName;
        depExports.set(path.resolve(depPath).toLowerCase(), variable);
        prefix += `const ${variable} = (function () {\nconst module = { exports: {} };\n${depCode}\nreturn ${libraryExports(depSource) || 'undefined'};\n})();\n\n`;
      } else {
        prefix += depCode + '\n\n';
      }
    } catch (e) {
      return { success: false, error: `dependency ${path.relative(ALGORITHMS_DIR, depPath).replace(/\\/g, '/')}: ${e.message}` };
    }
  }

  // A handful of files (SHARK, Brotli, Deflate, the fountain codes) pull in a
  // sibling .data library through a third UMD factory parameter, fed by
  // require('./x.data'). The UMD unwrap discards that branch, leaving the
  // parameter unbound, so the library is bundled as
  // const <Name> = (function () { ...; return <its exports>; })();
  if (language === 'javascript') {
    const localRequireRe = /require\(\s*['"]\.\/([^'"]+)['"]\s*\)/g;
    const localNames = new Set();
    let lm;
    while ((lm = localRequireRe.exec(source)) !== null) localNames.add(lm[1]);
    // The factory is the last such function: an AMD branch may wrap it in one of its own
    const paramMatches = [...source.matchAll(/function\s*\(\s*AlgorithmFramework\s*,\s*OpCodes\s*,\s*(\w+)\s*\)/g)];
    const paramName = paramMatches.length ? paramMatches[paramMatches.length - 1][1] : null;
    for (const localName of localNames) {
      const libPath = [localName, localName + '.js', localName + '.data.js']
        .map(c => path.join(path.dirname(algorithmFile), c)).find(f => f.endsWith('.data.js') && fs.existsSync(f));
      if (!libPath || !paramName) continue;
      const libSrc = fs.readFileSync(libPath, 'utf-8');
      const exported = libraryExports(libSrc);
      if (!exported) return { success: false, error: 'library ' + path.basename(libPath) + ': its exports are in no shape the bundling knows' };
      const libName = path.basename(libPath, '.js').replace(/[^a-zA-Z0-9]/g, '_') + '_lib';
      try {
        const libCode = transpileOne(libSrc, plugin, libName, { generateTestHarness: false }, parserOptions);
        prefix += 'const ' + paramName + ' = (function () {\nconst module = { exports: {} };\n'
          + libCode + '\nreturn ' + exported + ';\n})();\n\n';
      } catch (e) {
        return { success: false, error: 'library ' + path.basename(libPath) + ': ' + e.message };
      }
    }
    // A third parameter fed `function () { return require('../x/y'); }` is a
    // loader for another algorithm file (mac/zuc128mac.js loads stream/zuc.js,
    // darkcrypt-deal.js block/des.js, at first use). That file is bundled as a
    // dependency, so the loader hands back what its factory returned.
    const loader = source.match(/function\s*\(\s*\)\s*\{\s*return\s+require\(\s*['"]([^'"]+)['"]\s*\)/);
    if (paramName && loader && !prefix.includes('const ' + paramName + ' = ')) {
      const target = path.resolve(path.dirname(algorithmFile), loader[1].endsWith('.js') ? loader[1] : loader[1] + '.js').toLowerCase();
      const variable = depExports.get(target);
      if (!variable) return { success: false, error: `loader ${paramName}: ${loader[1]} was not loaded by the reference, so it is not bundled` };
      prefix += 'const ' + paramName + ' = function () { return ' + variable + '; };\n\n';
    }
  } else if (language !== 'java') {
    // Python and Perl: the library's code goes ahead of the algorithm, and the
    // factory parameter is bound to an object holding what it exports
    const bundled = bundleLibrariesFor(language, source, algorithmFile, plugin, parserOptions);
    if (bundled.error) return { success: false, error: bundled.error };
    prefix += bundled.code;
  }

  if (prefix && language === 'javascript' && typeof plugin.GetStandalonePrelude === 'function') {
    // Dependency code goes right after the prelude (it references the
    // prelude's RegisterAlgorithm/etc) and before the main class code.
    const preludeText = plugin.GetStandalonePrelude();
    code = code.startsWith(preludeText) ? preludeText + prefix + code.slice(preludeText.length) : prefix + code;
  } else if (prefix) {
    code = prefix + code;
  }
  return { success: true, code };
}

// ============================================================================
// TEST HARNESS GENERATION (Language-specific)
// ============================================================================

// Languages whose harness runs every vector; the others only prove the
// generated code compiles and a run of theirs checks nothing.
const VECTOR_HARNESS_LANGUAGES = new Set(['javascript', 'python', 'perl', 'csharp', 'java']);

/**
 * The harness spec handed to a vector harness: per algorithm the name, the
 * class (C# looks it up by that), whether it is a cipher mode, and per vector
 * its application plan and checks.
 * @param {object[]} algorithms - referenceRun().algorithms that passed their reference
 * @returns {object} { algorithms: [...] }
 */
function harnessSpec(algorithms) {
  return {
    algorithms: algorithms.map(a => ({
      name: a.name, className: a.className, isMode: a.isMode, multiKey: a.multiKey, vectors: a.vectors
    }))
  };
}

/** JSON with every non-ASCII character escaped, so it embeds into any source encoding. */
function asciiJson(value) {
  return JSON.stringify(value).replace(/[^\x00-\x7e]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

function readHarness(file) {
  return fs.readFileSync(path.join(HARNESS_DIR, file), 'utf-8');
}

/**
 * Append the language's harness to transpiled code.
 * @param {string} language - language key
 * @param {string} algorithmCode - transpiled code
 * @param {object} spec - harnessSpec()
 * @param {string} algorithmName - file base name, for messages
 * @param {object} [sample] - { input, expected } of the first vector, for compile-only harnesses
 * @returns {{success: boolean, code?: string, error?: string}}
 */
function generateTestHarness(language, algorithmCode, spec, algorithmName, sample) {
  if (!spec || !spec.algorithms.length || spec.algorithms.every(a => a.vectors.length === 0))
    return { success: false, error: 'No test vectors' };
  const vector = sample || { input: [], expected: [] };

  switch (language) {
    case 'csharp':
      return generateCSharpTestHarness(algorithmCode, spec, algorithmName);
    case 'c':
      return generateCTestHarness(algorithmCode, vector, algorithmName);
    case 'cpp':
      return generateCppTestHarness(algorithmCode, vector, algorithmName);
    case 'python':
      return generatePythonTestHarness(algorithmCode, spec, algorithmName);
    case 'php':
      return generatePHPTestHarness(algorithmCode, vector, algorithmName);
    case 'perl':
      return generatePerlTestHarness(algorithmCode, spec, algorithmName);
    case 'java':
      return generateJavaTestHarness(algorithmCode, spec, algorithmName);
    case 'go':
      return generateGoTestHarness(algorithmCode, vector, algorithmName);
    case 'ruby':
      return generateRubyTestHarness(algorithmCode, vector, algorithmName);
    case 'rust':
      return generateRustTestHarness(algorithmCode, vector, algorithmName);
    case 'javascript':
      return generateJavaScriptTestHarness(algorithmCode, spec, algorithmName);
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

// C# vector harness (tests/validation-harness/Harness.cs). The transpiled code
// carries its vectors as `Tests` on each generated Algorithm subclass; the
// harness finds every algorithm the file registers by name, by reflection.
const CSHARP_DUMMY_CLASSES = `    // The identity cipher of tests/DummyBlockCipher.js, for mode vectors naming no cipher
    public sealed class ValidationDummyCipherAlgorithm : BlockCipherAlgorithm
    {
        public ValidationDummyCipherAlgorithm() { Name = "DummyBlockCipher"; BlockSize = 16; }
        public override object CreateInstance(bool isInverse = false) { return new ValidationDummyCipherInstance(this); }
    }

    public sealed class ValidationDummyCipherInstance : IBlockCipherInstance
    {
        private readonly System.Collections.Generic.List<byte> buffer = new System.Collections.Generic.List<byte>();
        public ValidationDummyCipherInstance(Algorithm algorithm) : base(algorithm) { }
        public int BlockSize { get; set; } = 16;
        public override void Feed(byte[] data) { if (data != null) buffer.AddRange(data); }
        public override byte[] Result()
        {
            if (Key == null || Key.Length == 0) throw new System.InvalidOperationException("Key not set");
            var output = new System.Collections.Generic.List<byte>();
            for (int i = 0; i < buffer.Count; i += 16)
                for (int j = 0; j < 16; ++j)
                    output.Add((byte)((i + j < buffer.Count ? buffer[i + j] : 0) ^ Key[j % Key.Length]));
            buffer.Clear();
            return output.ToArray();
        }
    }`;

function generateCSharpTestHarness(algorithmCode, spec, algorithmName) {
  // The transpiler emits a placeholder `public static void Main(string[] args)`
  // on the wrapper class; strip it (and its doc comment) so the harness Main is
  // the only entry point (CS0017 otherwise).
  const cleanedCode = algorithmCode.replace(
    /(\s*\/\/\/[^\n]*\n)*\s*public\s+static\s+void\s+Main\s*\([^)]*\)\s*\{[^}]*\}\s*/,
    '\n'
  );
  const nsMatch = algorithmCode.match(/namespace\s+([\w.]+)/);
  const surface = frameworkSurface();
  const literal = list => list.map(s => JSON.stringify(s)).join(', ');
  const hasMode = spec.algorithms.some(a => a.isMode);
  const harness = readHarness('Harness.cs')
    .replace('__NAMESPACE__', nsMatch ? nsMatch[1] : 'CipherValidation')
    .replace('__SPEC_JSON__', () => asciiJson(spec).replace(/"/g, '""'))
    .replace('__FRAMEWORK_TYPES__', () => literal(surface.types))
    .replace('__FRAMEWORK_MEMBERS__', () => literal(surface.members))
    .replace('__DUMMY_CLASSES__', () => hasMode ? CSHARP_DUMMY_CLASSES : '')
    .replace('__DUMMY_FACTORY__', () => hasMode
      ? 'return new ValidationDummyCipherInstance(new ValidationDummyCipherAlgorithm());'
      : `throw new InvalidOperationException("${algorithmName} is not a cipher mode");`);
  return { success: true, code: `${cleanedCode}\n${harness}` };
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

// Python vector harness (tests/validation-harness/harness.py); the spec is
// embedded as a JSON string literal, which is also a valid Python literal.
function generatePythonTestHarness(algorithmCode, spec, algorithmName) {
  const harness = readHarness('harness.py').replace('__SPEC_JSON__', () => JSON.stringify(asciiJson(spec)));
  return { success: true, code: `#!/usr/bin/env python3\n# Validation of ${algorithmName}\n${algorithmCode}\n${harness}` };
}

// Perl vector harness (tests/validation-harness/harness.pl). The transpiled
// code records every registered instance in @main::_registered_algorithms
// (see PerlEmitter.js), which the harness searches by name.
function generatePerlTestHarness(algorithmCode, spec, algorithmName) {
  const literal = "'" + asciiJson(spec).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const harness = readHarness('harness.pl').replace('__SPEC_JSON__', () => literal);
  return {
    success: true,
    code: `#!/usr/bin/perl\n# Validation of ${algorithmName}\nuse strict;\nuse warnings;\nuse feature 'say';\n\n${algorithmCode}\n${harness}`
  };
}

// JavaScript vector harness (tests/validation-harness/harness.js), run after
// the embedded AlgorithmFramework registered every bundled algorithm.
function generateJavaScriptTestHarness(algorithmCode, spec, algorithmName) {
  const harness = readHarness('harness.js').replace('__SPEC_JSON__', () => asciiJson(spec));
  return { success: true, code: `${algorithmCode}\n// Validation of ${algorithmName}\n${harness}` };
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

// Java vector harness (tests/validation-harness/Harness.java). The generated
// code marks the classes whose initialisers register its algorithms
// (// @generated-unit Name, see JavaEmitter.js); the harness loads them, then
// looks the algorithms up in the runtime's registry by name.
function generateJavaTestHarness(algorithmCode, spec, algorithmName) {
  const units = [...algorithmCode.matchAll(/^\/\/ @generated-unit (\w+)$/gm)].map(m => m[1]);
  const pkg = algorithmCode.match(/^package ([\w.]+);/m);
  const qualified = units.map(u => JSON.stringify(pkg ? pkg[1] + '.' + u : u)).join(', ');
  const harness = readHarness('Harness.java')
    .replace('__SPEC_JSON__', () => JSON.stringify(asciiJson(spec)))
    .replace('__GENERATED_UNITS__', () => qualified);
  return { success: true, code: `${algorithmCode}\n// Validation of ${algorithmName}\n${harness}` };
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

  // The code's own imports, and fmt for the harness. Guessing imports from
  // the code would hide an import the emitter forgot.
  const imports = new Set(['"fmt"']);
  for (const m of cleanedCode.matchAll(/^import\s+("[^"]+")/gm)) imports.add(m[1]);
  for (const m of cleanedCode.matchAll(/^import\s+\(([^)]*)\)/gm))
    for (const spec of m[1].split('\n').map(l => l.trim()).filter(Boolean)) imports.add(spec);
  imports.delete('');

  return {
    success: true,
    code: `package main

import (
\t${[...imports].join('\n\t')}
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

  // The plugin emits a unit: it is compiled from a file of its name, used by the program
  const unit = algorithmCode.match(/^\s*unit\s+(\w+)\s*;/m);
  return {
    success: true,
    extraFiles: unit ? { [unit[1] + '.pas']: algorithmCode } : undefined,
    code: `program TestHarness;
{$MODE DELPHI}

uses SysUtils${unit ? ', ' + unit[1] : ''};

${unit ? '' : algorithmCode}

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

function testCompilation(language, code, outputDir, extraFiles) {
  // Files the harness compiles alongside the program (a Pascal unit)
  if (extraFiles) {
    fs.mkdirSync(outputDir, { recursive: true });
    for (const [name, text] of Object.entries(extraFiles)) fs.writeFileSync(path.join(outputDir, name), text);
  }
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

  const result = spawnTool('gcc', ['-c', srcFile, '-std=c99', '-Wall', '-fsyntax-only'], {
    encoding: 'utf-8',
    timeout: timeoutSeconds() * 1000
  });

  return {
    success: result.status === 0,
    errors: compilerOutput(result),
    output: result.stdout || ''
  };
}

function testCppCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.cpp');
  fs.writeFileSync(srcFile, code);

  const result = spawnTool('g++', ['-c', srcFile, '-std=c++20', '-Wall', '-fsyntax-only'], {
    encoding: 'utf-8',
    timeout: timeoutSeconds() * 1000
  });

  return {
    success: result.status === 0,
    errors: compilerOutput(result),
    output: result.stdout || ''
  };
}


function testCSharpCompilation(code, outputDir) {
  if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(path.join(outputDir, 'Program.cs'), code);
  fs.writeFileSync(path.join(outputDir, 'Test.csproj'), `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>disable</Nullable>
    <TreatWarningsAsErrors>false</TreatWarningsAsErrors>
    <NoWarn>CS0108;CS0114;CS0168;CS0219;CS0414;CS8600;CS8601;CS8602;CS8603;CS8604;CS8618;CS8625</NoWarn>
    <InvariantGlobalization>true</InvariantGlobalization>
    <SatelliteResourceLanguages>en</SatelliteResourceLanguages>
    <GenerateDocumentationFile>false</GenerateDocumentationFile>
  </PropertyGroup>
</Project>`);

  // Each job builds in its own directory, so concurrent builds share no output;
  // reused MSBuild nodes and the compiler server keep a build at seconds.
  const result = runProcess('dotnet', ['build', outputDir, '-c', 'Release', '-v', 'q', '-nologo', '-clp:ErrorsOnly'],
    { timeoutSeconds: timeoutSeconds() * 2 });
  const errors = result.stdout + result.stderr;
  return {
    success: !result.timedOut && result.exitCode === 0,
    errors: result.timedOut ? `dotnet build timed out after ${timeoutSeconds() * 2}s` : errors,
    output: result.stdout
  };
}

function testJavaCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'TestHarness.java');
  fs.writeFileSync(srcFile, code);

  // Classes go to a directory of their own, where the vector run finds them
  const classes = path.join(outputDir, 'classes');
  if (fs.existsSync(classes)) fs.rmSync(classes, { recursive: true, force: true });
  const result = spawnTool('javac', ['-J-Duser.language=en', '-encoding', 'UTF-8', '-nowarn', '-d', classes, srcFile], {
    encoding: 'utf-8',
    timeout: timeoutSeconds() * 1000,
    cwd: outputDir
  });

  return {
    success: result.status === 0,
    errors: compilerOutput(result),
    output: result.stdout || ''
  };
}

// A syntax check of an interpreted language: the file it will run, checked by the interpreter
function syntaxCheck(code, outputDir, file, command, argv) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, file);
  fs.writeFileSync(srcFile, code);
  const result = runProcess(command, argv.concat([srcFile]), { cwd: outputDir });
  return {
    success: !result.timedOut && result.exitCode === 0,
    errors: result.timedOut ? `${command} syntax check timed out after ${timeoutSeconds()}s` : (result.error || result.stderr || result.stdout),
    output: result.stdout
  };
}

function testPythonSyntax(code, outputDir) {
  return syntaxCheck(code, outputDir, 'test.py', 'python', ['-m', 'py_compile']);
}

function testPHPSyntax(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.php');
  fs.writeFileSync(srcFile, code);

  const result = spawnTool('php', ['-l', srcFile], {
    encoding: 'utf-8',
    timeout: timeoutSeconds() * 1000
  });

  return {
    success: result.status === 0,
    errors: compilerOutput(result),
    output: result.stdout || ''
  };
}

function testPerlSyntax(code, outputDir) {
  return syntaxCheck(code, outputDir, 'test.pl', 'perl', ['-c']);
}

function testRubySyntax(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.rb');
  fs.writeFileSync(srcFile, code);

  const result = spawnTool('ruby', ['-c', srcFile], {
    encoding: 'utf-8',
    timeout: timeoutSeconds() * 1000
  });

  return {
    success: result.status === 0,
    errors: compilerOutput(result),
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
  const result = spawnTool('go', ['build', '-o', nullDevice, '.'], {
    cwd: outputDir,
    encoding: 'utf-8',
    timeout: timeoutSeconds() * 1000
  });

  return {
    success: result.status === 0,
    errors: compilerOutput(result),
    output: result.stdout || ''
  };
}

function testRustCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.rs');
  const exeFile = path.join(outputDir, 'test' + (process.platform === 'win32' ? '.exe' : ''));
  fs.writeFileSync(srcFile, code);

  // Compile to actual executable (works on all platforms)
  const result = spawnTool('rustc', [srcFile, '-o', exeFile], {
    encoding: 'utf-8',
    timeout: timeoutSeconds() * 1000
  });

  return {
    success: result.status === 0,
    errors: compilerOutput(result),
    output: result.stdout || ''
  };
}

function testJavaScriptSyntax(code, outputDir) {
  return syntaxCheck(code, outputDir, 'test.js', 'node', ['--check']);
}

function testTypeScriptSyntax(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.ts');
  fs.writeFileSync(srcFile, code);

  // TypeScript: --noEmit for type checking without output
  const result = spawnTool('tsc', ['--noEmit', '--skipLibCheck', srcFile], {
    encoding: 'utf-8',
    timeout: timeoutSeconds() * 1000
  });

  return {
    success: result.status === 0,
    errors: compilerOutput(result),
    output: result.stdout || ''
  };
}

function testBasicCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.bas');
  fs.writeFileSync(srcFile, code);

  // FreeBASIC: -c for compile only (no linking)
  const result = spawnTool('fbc64', ['-c', srcFile], {
    encoding: 'utf-8',
    timeout: timeoutSeconds() * 1000,
    cwd: outputDir
  });

  // Clean up object file if created
  const objFile = path.join(outputDir, 'test.o');
  if (fs.existsSync(objFile))
    try { fs.unlinkSync(objFile); } catch (e) {}

  return {
    success: result.status === 0,
    errors: compilerOutput(result),
    output: result.stdout || ''
  };
}

function testDelphiCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.pas');
  fs.writeFileSync(srcFile, code);

  // FreePascal: -Cn = syntax check only (no code generation)
  // -Mdelphi = Delphi compatibility mode
  const result = spawnTool('fpc', ['-Cn', '-Mdelphi', srcFile], {
    encoding: 'utf-8',
    timeout: timeoutSeconds() * 1000,
    cwd: outputDir
  });

  return {
    success: result.status === 0,
    errors: compilerOutput(result),
    output: result.stdout || ''
  };
}

function testKotlinCompilation(code, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const srcFile = path.join(outputDir, 'test.kt');
  fs.writeFileSync(srcFile, code);

  // Kotlin: compile to jar for syntax validation
  const jarFile = path.join(outputDir, 'test.jar');
  const result = spawnTool('kotlinc', [srcFile, '-include-runtime', '-d', jarFile], {
    encoding: 'utf-8',
    timeout: timeoutSeconds() * 2000, // Kotlin compilation is slow
    cwd: outputDir
  });

  return {
    success: result.status === 0,
    errors: compilerOutput(result),
    output: result.stdout || ''
  };
}

// ============================================================================
// EXECUTION AND ITS RESULT
// ============================================================================

function timeoutSeconds() {
  const value = Number(args.timeout);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_TIMEOUT;
}

/**
 * Run a process to completion or its timeout.
 * @returns {{stdout: string, stderr: string, exitCode: number|null, timedOut: boolean, error: string|null}}
 */
function runProcess(command, argv, options = {}) {
  const result = spawnTool(command, argv, {
    encoding: 'utf-8',
    cwd: options.cwd,
    timeout: (options.timeoutSeconds || timeoutSeconds()) * 1000,
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
    env: Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1', DOTNET_CLI_UI_LANGUAGE: 'en', VSLANG: '1033' })
  });
  const timedOut = !!(result.error && result.error.code === 'ETIMEDOUT');
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.status,
    timedOut,
    error: result.error && !timedOut ? result.error.message : null
  };
}

/**
 * Run a compiled vector harness.
 * @param {string} language - one of VECTOR_HARNESS_LANGUAGES
 * @param {string} outputDir - where testCompilation put it
 * @returns {object} runProcess() result
 */
function executeCode(language, outputDir) {
  switch (language) {
    case 'javascript': return runProcess('node', [path.join(outputDir, 'test.js')], { cwd: outputDir });
    case 'python': return runProcess('python', ['-X', 'utf8', path.join(outputDir, 'test.py')], { cwd: outputDir });
    case 'perl': return runProcess('perl', [path.join(outputDir, 'test.pl')], { cwd: outputDir });
    case 'csharp': return runProcess('dotnet', [path.join(outputDir, 'bin', 'Release', 'net10.0', 'Test.dll')], { cwd: outputDir });
    case 'java': return runProcess('java', ['-Xss64m', '-cp', path.join(outputDir, 'classes'), javaMainClass(outputDir)], { cwd: outputDir });
    default: throw new Error(`${language} has no vector harness to run`);
  }
}

/** The harness class to run: TestHarness, in the package the generated code declares. */
function javaMainClass(outputDir) {
  const source = fs.readFileSync(path.join(outputDir, 'TestHarness.java'), 'utf-8');
  const pkg = source.match(/^package ([\w.]+);/m);
  return pkg ? pkg[1] + '.TestHarness' : 'TestHarness';
}

// Lines of tool output that are warnings or noise, never the error
const NOISE_LINE = /^\s*$|^# \w+$|^Free Pascal Compiler|^Copyright \(c\)|^Target OS:|^Compiling |^Linking |^\d+ lines compiled|^Note:|^Hint:|redefined at|masks earlier declaration|used only once|Useless use|syntax OK|^\s*at |^\s*\^+\s*$|^Node\.js v|^\s*File "|^Traceback|^\s*~+\s*$|^warning|: warning |Build FAILED|^\s*\d+ Warning|^\s*\d+ Error|Time Elapsed/i;

/**
 * The first line of tool output that states an error, cut to a readable length.
 * @param {string} text - stderr/stdout of a compiler or a crashed run
 * @param {string} language - language key, for its error shape
 * @returns {string} the error, or '' when the text has none
 */
function firstError(text, language) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(l => l && !NOISE_LINE.test(l));
  if (lines.length === 0) return '';
  const pick = pattern => lines.find(l => pattern.test(l));
  let line;
  if (language === 'csharp') line = pick(/error CS\d+/) || pick(/Unhandled exception|Exception:/);
  else if (language === 'python') line = [...lines].reverse().find(l => /^\w+(Error|Exception|Exit)\b/.test(l));
  else if (language === 'javascript') line = pick(/^\w*Error\b/) || pick(/Error:/);
  else if (language === 'ruby') {
    // Prism reports "syntax errors found", then each error under a caret
    const caret = pick(/^\|\s*\^~*\s+\S/);
    if (caret) line = 'syntax error: ' + caret.replace(/^\|\s*\^~*\s+/, '');
  }
  // Compilers: the first line that says error (gcc, javac, rustc, tsc, fpc, fbc, kotlinc, ...)
  if (!line) line = pick(/\b(error|fatal)\b/i) || lines[0];
  // Drop the location prefix: "...\test.c:12:5: ", "Program.cs(1,2): ", "test.pas(3,4) ", "ruby.exe: "
  line = line.replace(/^.*?\.cs\(\d+,\d+\):\s*/, '').replace(/\s*\[[^\]]*\.csproj\]$/, '')
    .replace(/^\S*ruby(\.exe)?:\s*/i, '')
    .replace(/^(?:[A-Za-z]:)?[^:]*?[\\/.]?test\.\w+(?::\d+)*(?:\(\d+(?:,\d+)?\))?:?\s*/, '');
  return line.length > 400 ? line.slice(0, 400) + '…' : line;
}

/** What a compiler printed, both streams (tsc, fpc and fbc report on stdout), or why it did not run. */
function compilerOutput(result) {
  const text = (result.stderr || '') + (result.stdout || '');
  if (text.trim()) return text;
  if (result.error) return result.error.code === 'ETIMEDOUT' ? 'the compiler timed out' : result.error.message;
  return result.status === null ? 'the compiler was killed' : '';
}

/**
 * Read a vector harness run back: per spec algorithm, the vectors that passed
 * and the first error. A vector the harness never reported (a crash, a
 * timeout) counts as failed, and so does a run that exited non-zero.
 * @param {object} spec - harnessSpec() the harness ran
 * @param {object} run - runProcess() result
 * @param {string} language - for reading a crash message
 * @returns {object[]} per algorithm: { passed, total, error }
 */
function parseHarnessOutput(spec, run, language) {
  const results = spec.algorithms.map(a => ({ passed: 0, total: a.vectors.length, error: null, reported: 0 }));
  const lines = String(run.stdout || '').split(/\r?\n/);
  let done = false;
  for (const line of lines) {
    let m;
    if ((m = /^@@VEC (\d+) (\d+) (PASS|FAIL)(?: (.*))?$/.exec(line))) {
      const r = results[Number(m[1])];
      if (!r) continue;
      ++r.reported;
      if (m[3] === 'PASS') ++r.passed;
      else if (!r.error) r.error = `vector ${m[2]}: ${m[4] || 'failed'}`;
    } else if ((m = /^@@ALGO (\d+) MISSING (.*)$/.exec(line))) {
      const r = results[Number(m[1])];
      if (r && !r.error) r.error = m[2];
    } else if ((m = /^@@ALGO (\d+) COUNT (\d+)$/.exec(line))) {
      const r = results[Number(m[1])];
      if (r && !r.error) r.error = `the transpiled algorithm has ${m[2]} vectors, the reference ${r.total}`;
    } else if (line.trim() === '@@DONE') {
      done = true;
    }
  }
  const crash = run.timedOut
    ? `timed out after ${timeoutSeconds()}s`
    : run.error || firstError(run.stderr, language) || firstError(run.stdout.split(/\r?\n/).filter(l => !l.startsWith('@@')).join('\n'), language)
      || `exited with code ${run.exitCode}`;
  // A crash belongs to the algorithms whose vectors it cut short; a non-zero
  // exit after every vector reported fails them all, as nothing else explains it.
  for (const r of results) {
    if (r.error) continue;
    if (r.reported < r.total) r.error = crash;
    else if (done && run.exitCode !== 0) r.error = `exited with code ${run.exitCode} after its vectors: ${crash}`;
  }
  return results.map(({ passed, total, error }) => ({ passed, total, error }));
}

// ============================================================================
// ERROR CLASSES
// ============================================================================

/** An error message with its particulars (names, numbers, bytes, paths) blanked. */
function normalizeMessage(text) {
  return String(text)
    .replace(/\s+at\s+.+?\sline\s\d+(, <[^>]*> line \d+)?\.?/g, '')
    .replace(/\(?(?:[A-Za-z]:)?[\\/][^:()\n]*?\.(?:py|pl|pm|cs|js|ts|c|cpp|java|go|rs|kt|bas|pas|php|rb)\b\)?(?::\d+)*/g, '<file>')
    .replace(/'[^']*'|"[^"]*"|`[^`]*`|‘[^’]*’/g, "'…'")
    .replace(/\b0x[0-9a-f]+\b/gi, 'N')
    .replace(/\b[0-9a-f]{8,}\b/gi, '<hex>')
    .replace(/\b\d+\b/g, 'N')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The class an error belongs to, for counting what to fix first: the stage,
 * then the compiler code or the exception type and its message shape.
 * @param {string} stage - transpile, compile, execute, harness
 * @param {string|null} error - the record's first error
 * @returns {string|null} e.g. "compile: CS0103", "execute: wrong output"
 */
function errorClass(stage, error) {
  if (!error || stage === 'passed' || stage === 'compiled') return null;
  const text = String(error).replace(/^vector \d+: /, '');
  let m;
  let kind;
  if ((m = /\berror (CS\d+)\b/.exec(text))) kind = m[1];
  else if (/^output .* expected /.test(text)) kind = 'wrong output';
  else if (/^round trip gave /.test(text)) kind = 'round trip does not invert';
  else if (/^encoding is not stable/.test(text)) kind = 'encoding not stable';
  else if ((m = /Vector field '([^']+)' is not applied: no block cipher named/.exec(text))) kind = 'named block cipher not registered';
  else if ((m = /Vector field '([^']+)' is not applied/.exec(text))) kind = `field not applied: ${m[1]}`;
  else if ((m = /Vector field '([^']+)' is missing from the transpiled vector/.exec(text))) kind = `field missing from transpiled vector: ${m[1]}`;
  else if ((m = /^Setting vector field '([^']+)' failed: (.*)$/.exec(text))) kind = `setting ${m[1]} fails: ${normalizeMessage(m[2]).slice(0, 80)}`;
  else if (/no algorithm named .* is registered/.test(text)) kind = 'algorithm not registered';
  else if (/^the transpiled algorithm has \d+ vectors/.test(text)) kind = 'vector count differs';
  else if (/timed out after/.test(text)) kind = 'timeout';
  else if (/^dependency /.test(text)) kind = 'dependency fails to transpile';
  // The member a missing-member error names says what to implement; keep it
  else if ((m = /^(AttributeError):.* has no attribute '(\w+)'/.exec(text))) kind = `${m[1]}: no attribute '${m[2]}'`;
  else if ((m = /^(NameError|UnboundLocalError):.*?'(\w+)'/.exec(text))) kind = `${m[1]}: '${m[2]}'`;
  else if ((m = /^(Can't locate object method) "(\w+)"/.exec(text))) kind = `${m[1]} '${m[2]}'`;
  else if ((m = /^(Undefined subroutine) &?([\w:]+)/.exec(text))) kind = `${m[1]} '${m[2]}'`;
  else if ((m = /^(ReferenceError|TypeError): (\w+) is not (defined|a function|a constructor)/.exec(text))) kind = `${m[1]}: ${m[2]} is not ${m[3]}`;
  else kind = normalizeMessage(text).slice(0, 100);
  return `${stage}: ${kind}`;
}

// ============================================================================
// ONE ALGORITHM FILE (run in a worker process)
// ============================================================================

const firstLine = text => String(text || '').split(/\r?\n/).find(l => l.trim()) || String(text || '');

/**
 * Validate one algorithm file in every language: reference, transpile,
 * harness, compile, run.
 * @param {{category: string, file: string, path: string}} file - the algorithm file
 * @param {string[]} languages - language keys
 * @param {function(object): void} [progress] - receives the outcome so far, before each language
 * @returns {Promise<object>} { file, category, records, reference, unregistered }
 */
async function validateFile(file, languages, progress = () => {}) {
  const rel = `${file.category}/${file.file}`;
  const outcome = { file: rel, category: file.category, records: [], reference: [], unregistered: false, current: null };
  const referenceStarted = Date.now();
  const reference = await referenceRun(file.path);
  outcome.referenceSeconds = (Date.now() - referenceStarted) / 1000;
  // A transpiled run takes many times the JavaScript reference's time (Python
  // and Perl easily 100x on the big-number and PQC algorithms), so the limit
  // of a compile or run scales with it, up to half an hour
  args.timeout = Math.max(timeoutSeconds(), Math.min(1800, Math.ceil(outcome.referenceSeconds * TIMEOUT_PER_REFERENCE_SECOND)));
  outcome.timeoutSeconds = timeoutSeconds();
  if (reference.error) {
    outcome.reference.push({ file: rel, algorithm: null, error: reference.error });
    return outcome;
  }
  if (reference.algorithms.length === 0) {
    outcome.unregistered = true;
    return outcome;
  }
  for (const a of reference.algorithms)
    if (a.referenceError || a.vectors.length === 0)
      outcome.reference.push({ file: rel, algorithm: a.name, error: a.referenceError || 'no test vectors' });
  const valid = reference.algorithms.filter(a => !a.referenceError && a.vectors.length > 0);
  if (valid.length === 0) return outcome;

  const spec = harnessSpec(valid);
  const algoName = path.basename(file.file, '.js');
  for (const language of languages) {
    outcome.current = language;
    const languageStarted = Date.now();
    progress(outcome);
    const records = valid.map(a => ({
      file: rel, category: file.category, algorithm: a.name, language,
      stage: null, error: null, errorClass: null, vectorsPassed: 0, vectorsTotal: a.vectors.length
    }));
    const fail = (stage, error) => { for (const r of records) { r.stage = stage; r.error = error; } };

    const transpiled = transpileAlgorithm(file.path, language, reference.dependencies);
    if (!transpiled.success) {
      fail('transpile', firstLine(transpiled.error));
    } else {
      const harness = generateTestHarness(language, transpiled.code, spec, algoName, reference.sample);
      const outputDir = path.join(OUTPUT_DIR, language, file.category, algoName);
      const compiled = harness.success ? testCompilation(language, harness.code, outputDir, harness.extraFiles) : null;
      if (!harness.success) {
        fail('transpile', `harness: ${harness.error}`);
      } else if (!compiled.success) {
        const error = firstError(compiled.errors, language) || firstLine(compiled.errors) || 'compilation failed';
        fail(/timed out/i.test(error) ? 'timeout' : 'compile', error);
      } else if (args.compileOnly || !VECTOR_HARNESS_LANGUAGES.has(language)) {
        fail('compiled', null);
      } else {
        const execution = executeCode(language, outputDir);
        const results = parseHarnessOutput(spec, execution, language);
        records.forEach((r, i) => {
          r.vectorsPassed = results[i].passed;
          r.error = results[i].error;
          // A run cut off by its time limit says nothing about the code it ran
          r.stage = !r.error ? 'passed' : execution.timedOut && /^timed out after/.test(r.error) ? 'timeout' : 'execute';
        });
      }
    }
    const seconds = (Date.now() - languageStarted) / 1000;
    for (const r of records) {
      r.errorClass = errorClass(r.stage, r.error);
      r.seconds = seconds;
    }
    outcome.records.push(...records);
  }
  outcome.current = null;
  return outcome;
}

// ============================================================================
// THE RUN: WORKERS, SUMMARY, REPORT
// ============================================================================

/**
 * Validate one file in a worker process of its own, so every file starts from
 * a clean require cache and registry and runs in parallel with the others.
 * A worker that dies or times out fails the language it was working on.
 * @returns {Promise<object>} validateFile()'s outcome
 */
function runWorker(file, languages, scratchDir, index) {
  const payloadFile = path.join(scratchDir, `job-${index}.json`);
  const resultFile = path.join(scratchDir, `result-${index}.json`);
  fs.writeFileSync(payloadFile, JSON.stringify({
    file, languages, resultFile,
    options: { compileOnly: args.compileOnly, timeout: args.timeout, verbose: args.verbose }
  }));
  return new Promise(resolve => {
    const child = spawn(process.execPath, [__filename, '--worker', payloadFile], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-8192); });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, WORKER_TIMEOUT_SECONDS * 1000);
    child.on('close', code => {
      clearTimeout(timer);
      let outcome = null;
      try { outcome = JSON.parse(fs.readFileSync(resultFile, 'utf-8')); } catch (e) { outcome = null; }
      const rel = `${file.category}/${file.file}`;
      const died = timedOut ? `the worker timed out after ${WORKER_TIMEOUT_SECONDS}s`
        : `the worker exited with code ${code}: ${firstError(stderr, 'javascript') || 'no message'}`;
      if (!outcome) {
        outcome = { file: rel, category: file.category, records: [], reference: [], unregistered: false, current: null,
          crash: `${died} before its reference finished` };
      } else if (outcome.current || code !== 0) {
        const done = new Set(outcome.records.map(r => r.language));
        const names = [...new Set(outcome.records.map(r => r.algorithm))];
        for (const language of languages.filter(l => !done.has(l)))
          for (const algorithm of names.length ? names : [null])
            outcome.records.push({ file: rel, category: file.category, algorithm, language, stage: 'harness',
              error: language === outcome.current ? died : `not run: ${died}`, errorClass: 'harness: worker died',
              vectorsPassed: 0, vectorsTotal: 0 });
        outcome.crash = died;
      }
      resolve(outcome);
    });
  });
}

/** Run tasks with at most `limit` in flight, in order of submission. */
async function pool(items, limit, task) {
  const results = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await task(items[i], i);
    }
  });
  await Promise.all(lanes);
  return results;
}

const STAGE_OK = new Set(['passed', 'compiled']);

/**
 * Count transpiled, compiled and executed algorithms per language and per
 * category, decide each language, and rank its error classes.
 * A language passes when every algorithm it transpiled also compiled and
 * passed every vector (or compiled, where it has no vector harness or the run
 * is compile-only), and no worker died on it.
 * @param {object[]} records - every algorithm/language result
 * @param {string[]} languages - language keys, in display order
 * @returns {object} { byLanguage, byCategory }
 */
function summarize(records, languages) {
  const counts = () => ({ considered: 0, transpiled: 0, compiled: 0, executed: 0, timedOut: 0 });
  const add = (c, r) => {
    ++c.considered;
    if (r.stage !== 'transpile' && r.stage !== 'harness') ++c.transpiled;
    if (r.stage === 'execute' || STAGE_OK.has(r.stage) || (r.stage === 'timeout' && !/compil|build|syntax/i.test(r.error || ''))) ++c.compiled;
    if (r.stage === 'timeout') ++c.timedOut;
    if (r.stage === 'passed') ++c.executed;
  };
  const byLanguage = {};
  for (const language of languages) {
    const mine = records.filter(r => r.language === language);
    const c = counts();
    mine.forEach(r => add(c, r));
    const classes = {};
    for (const r of mine) if (r.errorClass) classes[r.errorClass] = (classes[r.errorClass] || 0) + 1;
    c.errorClasses = Object.entries(classes).map(([name, count]) => ({ class: name, count }))
      .sort((a, b) => b.count - a.count || (a.class < b.class ? -1 : a.class > b.class ? 1 : 0));
    // Timeouts are counted on their own and fail no language
    c.passed = mine.every(r => r.stage === 'transpile' || r.stage === 'timeout' || STAGE_OK.has(r.stage));
    byLanguage[language] = c;
  }
  const byCategory = {};
  for (const category of [...new Set(records.map(r => r.category))].sort()) {
    byCategory[category] = {};
    for (const language of languages) {
      const c = counts();
      records.filter(r => r.category === category && r.language === language).forEach(r => add(c, r));
      byCategory[category][language] = c;
    }
  }
  return { byLanguage, byCategory };
}

function defaultJobs() {
  return Math.max(1, Math.floor((os.cpus() || []).length / 2) || 1);
}

const STAGE_SHORT = { passed: 'ok', compiled: 'compiled', transpile: 'transpile', compile: 'compile', execute: 'execute', timeout: 'timeout', harness: 'harness' };

function progressLine(outcome, done, total, seconds, languages) {
  const head = `  [${String(done).padStart(String(total).length)}/${total}] ${outcome.file.padEnd(38)}`;
  if (outcome.crash && outcome.records.length === 0) return `${head} ${C.red}${outcome.crash}${C.reset}`;
  if (outcome.unregistered) return `${head} ${C.dim}registers no algorithm${C.reset}`;
  if (outcome.records.length === 0) return `${head} ${C.yellow}reference fails${C.reset} (${outcome.reference.map(r => r.error).join('; ').slice(0, 100)})`;
  const parts = languages.map(language => {
    const mine = outcome.records.filter(r => r.language === language);
    const bad = mine.filter(r => !STAGE_OK.has(r.stage));
    if (bad.length === 0) return `${C.green}${language}:ok${C.reset}`;
    const stages = [...new Set(bad.map(r => STAGE_SHORT[r.stage] || r.stage))].join('+');
    const vectors = bad.some(r => r.stage === 'execute')
      ? ` ${mine.reduce((s, r) => s + r.vectorsPassed, 0)}/${mine.reduce((s, r) => s + r.vectorsTotal, 0)}` : '';
    return `${C.red}${language}:${stages}${vectors}${C.reset}`;
  });
  const skipped = outcome.reference.length ? ` ${C.yellow}(${outcome.reference.length} reference-failed)${C.reset}` : '';
  return `${head} ${parts.join(' ')}${skipped} ${C.dim}${seconds.toFixed(1)}s${C.reset}`;
}

function printSummary(summary, languages, available, totals, elapsed) {
  console.log(`\n${'═'.repeat(72)}`);
  console.log(`${C.bright}Summary${C.reset} (${elapsed}s, ${totals.jobs} jobs)\n`);
  console.log(`Files: ${totals.files} (${totals.unregistered} register no algorithm); `
    + `algorithms: ${totals.algorithms} validated, ${totals.referenceFailed} failed their JavaScript reference (held against no language)`);
  if (totals.crashed) console.log(`${C.red}Workers died on ${totals.crashed} file(s)${C.reset}`);

  console.log('\nLanguage results (algorithms; transpiled of considered, compiled and executed of transpiled):');
  for (const language of languages) {
    const s = summary.byLanguage[language];
    const verdict = s.passed ? `${C.green}PASS${C.reset}` : `${C.red}FAIL${C.reset}`;
    console.log(`  ${(available[language] ? available[language].name : language).padEnd(12)} `
      + `transpiled ${String(s.transpiled).padStart(5)}/${s.considered}  `
      + `compiled ${String(s.compiled).padStart(5)}/${s.transpiled}  `
      + (args.compileOnly || !VECTOR_HARNESS_LANGUAGES.has(language) ? 'executed     -  ' : `executed ${String(s.executed).padStart(5)}/${s.compiled}  `)
      + verdict + (s.timedOut ? `  (${s.timedOut} timed out)` : ''));
  }

  console.log('\nBy category (transpiled/compiled/executed of considered):');
  for (const [category, perLanguage] of Object.entries(summary.byCategory)) {
    const any = Object.values(perLanguage)[0];
    console.log(`  ${category.padEnd(12)} (${String(any.considered).padStart(3)}) `
      + languages.map(l => `${l} ${perLanguage[l].transpiled}/${perLanguage[l].compiled}/${perLanguage[l].executed}`).join('  '));
  }

  const top = args.verbose ? 25 : 8;
  console.log(`\nTop error classes (of ${top}):`);
  for (const language of languages) {
    const classes = summary.byLanguage[language].errorClasses;
    if (!classes.length) continue;
    console.log(`  ${language}:`);
    for (const c of classes.slice(0, top)) console.log(`    ${String(c.count).padStart(5)}  ${c.class}`);
  }
}

/**
 * VALIDATION: transpile every algorithm to every available language, compile
 * it and, where the language has a vector harness, run every vector.
 * @param {object} options - { verbose, quick, report, compileOnly, category, language, algorithm, jobs, timeout }
 *   report: true for the default path, or a path
 * @returns {Promise<object>} { passed, failed, detail } counted in languages
 */
async function run(options = {}) {
  for (const key of Object.keys(args))
    args[key] = options[key] === undefined ? (typeof args[key] === 'boolean' ? false : null) : options[key];

  const startTime = Date.now();
  const availableCompilers = detectCompilers();

  let targetLanguages = Object.keys(availableCompilers);
  if (args.language) {
    if (!availableCompilers[args.language]) {
      console.log(`${C.red}Language '${args.language}' not available.${C.reset}`);
      return { passed: 0, failed: 1, detail: `language ${args.language} not available` };
    }
    targetLanguages = [args.language];
  }
  if (targetLanguages.length === 0) {
    console.log(`${C.red}No compilers/interpreters found.${C.reset}`);
    return { passed: 0, failed: 1, detail: 'no compilers/interpreters found' };
  }
  console.log(`${C.cyan}Target languages: ${targetLanguages.map(l => availableCompilers[l].name).join(', ')}${C.reset}`);

  const algorithmFiles = [];
  const categories = fs.readdirSync(ALGORITHMS_DIR).filter(d => fs.statSync(path.join(ALGORITHMS_DIR, d)).isDirectory()).sort();
  for (const category of categories) {
    if (args.category && category !== args.category) continue;
    let files = fs.readdirSync(path.join(ALGORITHMS_DIR, category))
      .filter(f => f.endsWith('.js') && !f.endsWith('.data.js'))
      .sort()
      .map(f => ({ category, file: f, path: path.join(ALGORITHMS_DIR, category, f) }));
    if (args.algorithm) files = files.filter(a => a.file.toLowerCase().includes(args.algorithm.toLowerCase()));
    algorithmFiles.push(...(args.quick ? files.slice(0, 3) : files));
  }
  if (algorithmFiles.length === 0) {
    console.log(`${C.red}No algorithm file matches.${C.reset}`);
    return { passed: 0, failed: 1, detail: 'no algorithm file matches' };
  }

  const jobs = Math.max(1, Number(args.jobs) || defaultJobs());
  console.log(`${C.cyan}${algorithmFiles.length} algorithm files, ${jobs} at a time${C.reset}\n`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-validation-'));

  let done = 0;
  let outcomes;
  try {
    // Largest files first: they take longest, and started last they would
    // leave every other job idle at the end of the run
    const schedule = [...algorithmFiles].sort((a, b) => fs.statSync(b.path).size - fs.statSync(a.path).size);
    outcomes = await pool(schedule, jobs, async (file, i) => {
      const started = Date.now();
      const outcome = await runWorker(file, targetLanguages, scratchDir, i);
      console.log(progressLine(outcome, ++done, algorithmFiles.length, (Date.now() - started) / 1000, targetLanguages));
      return outcome;
    });
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true });
  }

  const languageOrder = l => targetLanguages.indexOf(l);
  const records = outcomes.flatMap(o => o.records).sort((a, b) =>
    a.file.localeCompare(b.file) || String(a.algorithm).localeCompare(String(b.algorithm)) || languageOrder(a.language) - languageOrder(b.language));
  const reference = outcomes.flatMap(o => o.reference);
  const summary = summarize(records, targetLanguages);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const totals = {
    jobs,
    files: algorithmFiles.length,
    unregistered: outcomes.filter(o => o.unregistered).length,
    algorithms: new Set(records.map(r => `${r.file}\u0000${r.algorithm}`)).size,
    referenceFailed: reference.length,
    crashed: outcomes.filter(o => o.crash).length
  };
  printSummary(summary, targetLanguages, availableCompilers, totals, elapsed);

  if (args.report) {
    const reportPath = args.report === true ? DEFAULT_REPORT : path.resolve(String(args.report));
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
      generated: new Date().toISOString(),
      elapsedSeconds: Number(elapsed),
      options: { quick: args.quick, compileOnly: args.compileOnly, category: args.category, language: args.language, algorithm: args.algorithm, jobs, timeout: timeoutSeconds() },
      languages: Object.fromEntries(targetLanguages.map(l => [l, { name: availableCompilers[l].name, version: availableCompilers[l].version, vectorHarness: VECTOR_HARNESS_LANGUAGES.has(l) }])),
      totals,
      summary,
      results: records,
      referenceFailures: reference,
      crashes: outcomes.filter(o => o.crash).map(o => ({ file: o.file, error: o.crash }))
    }, null, 2));
    console.log(`\n${C.cyan}Report saved to: ${reportPath}${C.reset}`);
  }

  const failedLanguages = targetLanguages.filter(l => !summary.byLanguage[l].passed);
  console.log(`\n${failedLanguages.length === 0 ? C.green : C.red}Validation complete${failedLanguages.length ? `: ${failedLanguages.join(', ')} failing` : ''}.${C.reset}`);
  return {
    passed: targetLanguages.length - failedLanguages.length,
    failed: failedLanguages.length,
    detail: `${totals.algorithms} algorithms, ${totals.referenceFailed} reference-failed; `
      + targetLanguages.map(l => {
        const s = summary.byLanguage[l];
        return `${l} transpiled ${s.transpiled}/${s.considered}, compiled ${s.compiled}/${s.transpiled}`
          + (args.compileOnly || !VECTOR_HARNESS_LANGUAGES.has(l) ? '' : `, executed ${s.executed}/${s.compiled}`);
      }).join('; ')
  };
}

/** Worker entry: validate the file named by the payload and write its outcome. */
async function workerMain(payloadFile) {
  const payload = JSON.parse(fs.readFileSync(payloadFile, 'utf-8'));
  Object.assign(args, payload.options);
  const write = outcome => fs.writeFileSync(payload.resultFile, JSON.stringify(outcome));
  const outcome = await validateFile(payload.file, payload.languages, write);
  write(outcome);
}

if (require.main === module) {
  const at = process.argv.indexOf('--worker');
  if (at < 0) {
    console.error('Run the validation through the suite: node tests/TranspilerSuite.js --only=validation');
    process.exit(2);
  }
  workerMain(process.argv[at + 1]).then(() => process.exit(0), error => {
    console.error(error && error.stack || String(error));
    process.exit(1);
  });
}

module.exports = {
  run, validateFile, vectorPlan, harnessSpec, generateTestHarness, parseHarnessOutput,
  errorClass, summarize, firstError, transpileAlgorithm, frameworkSurface, testCompilation, executeCode,
  detectCompilers, probeTool, LANGUAGE_COMPILERS
};
