/**
 * JvmTranspileRegressions.js - regression tests for systematic Java (JVM)
 * transpilation faults (each case names the fault it pins down).
 *
 * Every case is Given (a JavaScript snippet defining probe(), which returns a
 * string) / When (transpiled to Java, compiled with javac and run) / Then (the
 * Java probe returns what JavaScript's probe() returns, or the generated code
 * has a specific shape). All snippets are compiled and run together, once, so
 * the suite pays for one javac and one JVM start; the run-time cases are
 * skipped when no JDK is on PATH.
 *
 * The JVM category: node tests/TranspilerSuite.js --only=jvm [--verbose]
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CIPHER_DIR = path.join(__dirname, '..');
let verbose = false;

// The transpiler logs progress on console.log; keep the suite output readable.
const realLog = console.log;
const quiet = fn => { console.log = () => {}; try { return fn(); } finally { console.log = realLog; } };

const { TypeAwareJSASTParser } = quiet(() => require(path.join(CIPHER_DIR, 'type-aware-transpiler.js')));
const { LanguagePlugins } = require(path.join(CIPHER_DIR, 'codingplugins', 'LanguagePlugin.js'));
// Loaded afresh: an earlier category in the same process (CODEGEN) clears the
// plugin registry, so a cached java.js would never register again.
const JAVA_PLUGIN = require.resolve(path.join(CIPHER_DIR, 'codingplugins', 'java.js'));
delete require.cache[JAVA_PLUGIN];
quiet(() => require(JAVA_PLUGIN));
const javaPlugin = LanguagePlugins.GetAll().find(p => p.name === 'Java');
const OpCodes = quiet(() => require(path.join(CIPHER_DIR, 'OpCodes.js')));
const AlgorithmFramework = quiet(() => require(path.join(CIPHER_DIR, 'AlgorithmFramework.js')));

/**
 * @param {string} js - JavaScript source
 * @param {string} className - the generated class
 * @param {boolean} [runtime] - include the runtime
 * @returns {string} the Java translation
 */
function transpile(js, className, runtime = false) {
  return quiet(() => {
    const ast = new TypeAwareJSASTParser(js).parse();
    const result = javaPlugin.GenerateFromAST(ast, { className, includeRuntime: runtime });
    if (!result.success) throw new Error(result.error || 'transpile failed');
    return result.code;
  });
}

/**
 * What JavaScript's probe() returns for a snippet.
 * @param {string} js - JavaScript source defining probe()
 * @returns {string}
 */
function javascriptProbe(js) {
  // eslint-disable-next-line no-new-func
  return String(new Function('OpCodes', 'AlgorithmFramework', `${js}\nreturn probe();`)(OpCodes, AlgorithmFramework));
}

// ---------------------------------------------------------------------------
// The batch: every run-time case is compiled and run together
// ---------------------------------------------------------------------------
const runCases = [];
let batch = null;

function hasTool(tool, args) {
  const probe = spawnSync(tool, args, { encoding: 'utf-8', shell: process.platform === 'win32' });
  return probe.status === 0;
}

/**
 * Compile all run-time cases into one program and run it.
 * @returns {{skipped: boolean, outputs: Map<number, string>, error: string|null}}
 */
function runBatch() {
  if (batch) return batch;
  if (!hasTool('javac', ['-version']) || !hasTool('java', ['-version'])) return (batch = { skipped: true, outputs: new Map(), error: null });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jvm-regression-'));
  try {
    const units = [];
    const errors = new Map();
    runCases.forEach((c, i) => {
      try { units.push(transpile(c.js, `Case${i}`)); }
      catch (e) { errors.set(i, 'TRANSPILE ' + e.message); }
    });
    const calls = runCases.map((c, i) => errors.has(i) ? '' :
      `        try { System.out.println("@@${i}:" + (${c.javaProbe ? c.javaProbe.replace(/\$UNIT/g, `Case${i}`) : `Case${i}.probe()`})); }\n` +
      `        catch (Throwable e) { System.out.println("@@${i}:THROW " + e); }\n`).join('');
    const main = `final class RegressionMain {\n    public static void main(String[] args) {\n${calls}    }\n}\n`;
    const src = path.join(dir, 'Main.java');
    fs.writeFileSync(src, [javaPlugin.GetRuntime(), ...units, main].join('\n'));
    const classes = path.join(dir, 'classes');
    const c = spawnSync('javac', ['-J-Duser.language=en', '-encoding', 'UTF-8', '-nowarn', '-d', classes, src], { encoding: 'utf-8', shell: process.platform === 'win32' });
    if (c.status !== 0) {
      const lines = ((c.stdout || '') + (c.stderr || '')).split(/\r?\n/);
      const errs = lines.flatMap((l, i) => /error:/.test(l) ? [l.replace(/^.*Main\.java:/, 'line '), ...lines.slice(i + 1, i + 4)] : []).slice(0, 24).join('\n');
      return (batch = { skipped: false, outputs: new Map(), error: 'javac failed:\n' + errs });
    }
    const r = spawnSync('java', ['-Xss64m', '-cp', classes, 'RegressionMain'], { encoding: 'utf-8', timeout: 120000, shell: process.platform === 'win32' });
    const outputs = new Map(errors);
    for (const line of (r.stdout || '').split(/\r?\n/)) {
      const m = line.match(/^@@(\d+):(.*)$/);
      if (m) outputs.set(Number(m[1]), m[2]);
    }
    return (batch = { skipped: false, outputs, error: null });
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp dir cleanup is best effort */ }
  }
}

const cases = require('./UnitCases.js').createCases();

/**
 * A run-time case: the Java probe returns what JavaScript's probe() returns.
 * @param {string} name - the fault
 * @param {string} js - JavaScript defining probe()
 * @param {object} [options] - { javaProbe: Java expression ($UNIT is the class), expected: the value when not JavaScript's }
 */
function runCase(name, js, options = {}) {
  const index = runCases.length;
  runCases.push({ js, javaProbe: options.javaProbe || null });
  cases.case(name, () => {
    const b = runBatch();
    if (b.skipped) return 'skip';
    if (b.error) throw new Error(b.error);
    const want = options.expected !== undefined ? options.expected : javascriptProbe(js);
    const got = b.outputs.get(index);
    if (got !== want) throw new Error(`expected ${want}\ngot      ${got}${verbose ? '\n' + transpile(js, 'Probe') : ''}`);
  });
}

function expectMatch(code, re, what) {
  if (!re.test(code)) throw new Error(`expected ${what} (${re})\n${verbose ? code : ''}`);
}
function expectNoMatch(code, re, what) {
  if (re.test(code)) throw new Error(`did not expect ${what} (${re})\n${verbose ? code : ''}`);
}

// ---------------------------------------------------------------------------
// Numbers: JavaScript computes in doubles and 32-bit integers
// ---------------------------------------------------------------------------
runCase('numbers: >>> takes its shift count modulo 32',
  '/** @returns {string} */ function probe() { const x = 0x80000001; const n = 33; return [x >>> n, x >>> 32, -1 >>> 0].join(","); }');
runCase('numbers: an int product past 2^53 rounds like a double before ToUint32',
  '/** @param {uint32} v @returns {uint32} */ function mix(v) { return OpCodes.ToUint32((v | 0) * 0x27d4eb2d); }\n' +
  '/** @returns {string} */ function probe() { return [mix(0x9e3779b9), mix(123456789), mix(1)].join(","); }');
runCase('numbers: a product with a wider-than-int operand rounds like a double',
  '/** @returns {string} */ function probe() { /** @type {uint32} */ const a = 4294967295; /** @type {uint32} */ const b = 4294967291; return String((a * b) % 4294967296); }');
runCase('numbers: a local declared with 0 and assigned fractions keeps them',
  '/** @param {int32} k @returns {float64} */ function f(k) { let t = 0; if (k > 1) t = 1 / k; else t = k / 3; return t; }\n' +
  '/** @returns {string} */ function probe() { return [f(4), f(1)].join(","); }');

// ---------------------------------------------------------------------------
// Arrays: a JavaScript array is shared, holds any number, has its own length
// ---------------------------------------------------------------------------
runCase('arrays: a copy made with Array.from keeps its class, so a callee changing it in place is seen',
  '/** @param {uint8[]} out @param {int32} v */ function setFirst(out, v) { out[0] = v; }\n' +
  '/** @returns {string} */ function probe() { /** @type {uint8[]} */ const r = [1, 2, 3]; let h = Array.from(r); setFirst(h, 9); return h.join(","); }');
runCase('arrays: an array converted for a parameter the callee changes gets the changes back',
  '/** @param {int32[]} target @param {int32[]} source @returns {int32[]} */ function appendAll(target, source) { for (let i = 0; i < source.length; i++) target.push(source[i]); return target; }\n' +
  '/** @param {uint8[]} bytes @param {int32} i @param {int32} v */ function put(bytes, i, v) { bytes[i] = v; }\n' +
  '/** @returns {string} */ function probe() { /** @type {uint8[]} */ const key = [1, 2]; /** @type {int32[]} */ const packed = [0, 0];\n' +
  '  put(packed, 1, 200); appendAll(key, packed); return key.join(","); }');
runCase('arrays: a new plain array holds the larger numbers stored into it',
  '/** @returns {string} */ function probe() { const offsets = new Array(4).fill(0); for (let i = 0; i < 3; ++i) offsets[i + 1] = offsets[i] + 1000 * (i + 1); return offsets.join(","); }');
runCase('arrays: OpCodes.CreateArray and ArraySlice keep the values they are given',
  '/** @returns {string} */ function probe() { const w = OpCodes.CreateArray(3, 0xFFFFFFFF); const s = OpCodes.ArraySlice([300, 70000, 5], 1, 3); return [w.join("/"), s.join("/")].join(","); }');
runCase('arrays: .length of a local class instance reads its own length field',
  'class Tokens { constructor() { /** @type {int32[]} */ this.length = []; } }\n' +
  '/** @returns {string} */ function probe() { const t = new Tokens(); t.length.push(7); t.length.push(8); return String(t.length[1]); }');

// ---------------------------------------------------------------------------
// Absent values: undefined is a value a number field or parameter can hold
// ---------------------------------------------------------------------------
runCase('undefined: a number field set to undefined and tested for it keeps the absent value',
  'class Config { constructor() { /** @type {int32} */ this.count = undefined; /** @type {int32} */ this.size = undefined; } }\n' +
  '/** @returns {string} */ function probe() { const c = new Config(); c.size = 4; return [c.count !== undefined, c.size !== undefined].join(","); }');
runCase('undefined: a number parameter tested for undefined can be left out',
  '/** @param {uint8[]} data @param {int32} [offset] @param {int32} [length] @returns {int32} */\n' +
  'function count(data, offset, length) { const start = offset ? offset : 0; return start + (length === undefined ? data.length - start : length); }\n' +
  '/** @returns {string} */ function probe() { return [count([1, 2, 3]), count([1, 2, 3], 1), count([1, 2, 3], 1, 1)].join(","); }');

// ---------------------------------------------------------------------------
// Objects: JavaScript types objects by their shape
// ---------------------------------------------------------------------------
runCase('objects: a plain object used where a local class is declared is taken by its shape',
  'class Params { constructor() { /** @type {int32} */ this.n = 0; /** @type {string} */ this.name = ""; } }\n' +
  '/** @param {Params} p @returns {string} */ function describe(p) { return p.name + p.n; }\n' +
  '/** @param {Object} raw @returns {string} */ function viaUntyped(raw) { /** @type {Params} */ const p = raw; return describe(p); }\n' +
  '/** @returns {string} */ function probe() { return viaUntyped({ n: 3, name: "x" }); }');
runCase('runtime: a TestCase subclass\'s own fields are vector fields',
  'class KeyedTestCase extends AlgorithmFramework.TestCase { constructor(input, expected) { super(input, expected, "t"); /** @type {uint8[]} */ this.key = null; }\n' +
  '  /** @param {uint8[]} key */ SetKey(key) { this.key = key; } }\n' +
  '/** @returns {KeyedTestCase} */ function make() { const t = new KeyedTestCase([1], [2]); t.SetKey([5, 6]); return t; }\n' +
  '/** @returns {string} */ function probe() { return "true,5"; }',
  { javaProbe: '$UNIT.make().hasField("key") + "," + ((JsArrayLike) $UNIT.make().field("key")).getBoxed(0)' });

// ---------------------------------------------------------------------------
// OpCodes runtime
// ---------------------------------------------------------------------------
runCase('OpCodes runtime: UInt64 word pairs xor, shift and convert to bytes',
  '/** @returns {string} */ function probe() { let c = OpCodes.UInt64.create(0x80000000, 1); c = OpCodes.UInt64.xor(OpCodes.UInt64.shr(c, 1), OpCodes.UInt64.create(0, 0xFF));\n' +
  '  return [c[0], c[1], OpCodes.UInt64.toBytes(c).join("/")].join(","); }');

// ---------------------------------------------------------------------------
// Shapes: what the IL hands the JVM back ends
// ---------------------------------------------------------------------------
cases.case('IL: a loader guarded by typeof require === "undefined" returns instead of throwing', () => {
  const code = transpile('let loaded = false;\n' +
    '/** @returns {void} */ function loadHashes() { if (loaded) return; loaded = true; if (typeof require === "undefined") return;\n' +
    '  for (const m of ["./a.js"]) { try { require(m); } catch (e) { } } }\n' +
    '/** @returns {string} */ function probe() { loadHashes(); return "ok"; }', 'Guard');
  expectNoMatch(code, /requires JavaScript runtime features/, 'a stub that throws');
  expectMatch(code, /static void loadHashes\(\)/, 'the loader');
});
cases.case('BigInt: 64-bit BigInt arithmetic is java.math.BigInteger, never a guessed long', () => {
  const code = transpile('/** @param {bigint} a @param {bigint} b @returns {bigint} */ function mul(a, b) { return (a * b) & 0xFFFFFFFFFFFFFFFFn; }', 'Big');
  expectMatch(code, /java\.math\.BigInteger mul\(java\.math\.BigInteger a, java\.math\.BigInteger b\)/, 'a BigInteger signature');
});

/**
 * JVM: run every regression case.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  verbose = Boolean(options.verbose);
  realLog('JVM transpile regression suite');
  return cases.run({ verbose });
}

module.exports = { run };
