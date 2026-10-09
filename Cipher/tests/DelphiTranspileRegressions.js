/**
 * DelphiTranspileRegressions.js - regression tests for systematic Delphi/Free
 * Pascal transpilation faults (each case names the fault it pins down).
 *
 * Every case is Given (a JavaScript snippet with a `probe()` function that
 * returns a string) / When (transpiled to a Pascal unit over the shared
 * runtime unit, compiled with Free Pascal and run) / Then (the program prints
 * what `probe()` returns under Node, the reference). Cases are skipped when no
 * Free Pascal compiler is installed.
 *
 * The DELPHI category: node tests/TranspilerSuite.js --only=delphi [--verbose]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CIPHER_DIR = path.join(__dirname, '..');
const RUNTIME_UNIT = 'CipherRuntime';
// Options of the current run, set by run()
let verbose = false;

// The transpiler logs progress on console.log; keep the suite output readable.
const realLog = console.log;
const quiet = fn => { console.log = () => {}; try { return fn(); } finally { console.log = realLog; } };

const { TypeAwareJSASTParser } = quiet(() => require(path.join(CIPHER_DIR, 'type-aware-transpiler.js')));
const { LanguagePlugins } = require(path.join(CIPHER_DIR, 'codingplugins', 'LanguagePlugin.js'));
// Loaded afresh: an earlier category in the same process (CODEGEN) clears the
// plugin registry, so a cached delphi.js would never register again.
const DELPHI_PLUGIN = require.resolve(path.join(CIPHER_DIR, 'codingplugins', 'delphi.js'));
delete require.cache[DELPHI_PLUGIN];
quiet(() => require(DELPHI_PLUGIN));
const plugin = LanguagePlugins.GetAll().find(p => p.extension === 'pas');

/**
 * @param {string} js - JavaScript source
 * @param {string} unitName - Pascal unit name
 * @returns {string} the generated unit, over the shared runtime unit
 */
function transpile(js, unitName = 'Probe', strict = true) {
  return quiet(() => {
    const ast = new TypeAwareJSASTParser(js).parse();
    const result = plugin.GenerateFromAST(ast, { unitName, runtimeUnit: RUNTIME_UNIT, library: true, strict });
    if (!result.success) throw new Error(result.error || 'transpile failed');
    return result.code;
  });
}

let fpcCommand;
/** @returns {string|null} the Free Pascal compiler command, null when none is installed */
function findFpc() {
  if (fpcCommand !== undefined) return fpcCommand;
  fpcCommand = null;
  const probe = spawnSync('fpc', ['-iV'], { encoding: 'utf-8' });
  if (probe.status === 0 && /^\d+\.\d+\.\d+/.test(probe.stdout.trim())) fpcCommand = 'fpc';
  return fpcCommand;
}

// One directory per run: the runtime unit compiles once and every probe reuses it.
let workDir = null;
let probeCount = 0;
function workDirectory() {
  if (workDir) return workDir;
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pas-regression-'));
  fs.writeFileSync(path.join(workDir, RUNTIME_UNIT + '.pas'), plugin.GetRuntimeUnit(RUNTIME_UNIT));
  return workDir;
}

/**
 * Transpile, compile and run a snippet; the program prints probe().
 * @param {string} js - JavaScript source defining probe(): string
 * @returns {string|'skip'} trimmed stdout, or 'skip' without Free Pascal
 */
function runPascal(js) {
  const fpc = findFpc();
  if (!fpc) return 'skip';
  const dir = workDirectory();
  const unitName = 'Probe' + (++probeCount);
  const unit = transpile(js, unitName);
  fs.writeFileSync(path.join(dir, unitName + '.pas'), unit);
  const program = `program Run${unitName};\n{$MODE DELPHIUNICODE}\nuses SysUtils, ${RUNTIME_UNIT}, ${unitName};\n` +
    `begin\n  SetTextCodePage(Output, CP_UTF8);\n  WriteLn(probe);\nend.\n`;
  const main = path.join(dir, `Run${unitName}.pas`);
  fs.writeFileSync(main, program);
  const build = spawnSync(fpc, ['-Mdelphi', '-O1', '-ve', `-FU${dir}`, `-Fu${dir}`, main], { cwd: dir, encoding: 'utf-8', timeout: 300000 });
  if (build.status !== 0) {
    const errors = (build.stdout || '').split('\n').filter(l => /Error|Fatal/.test(l)).slice(0, 5).join('\n');
    throw new Error(`fpc failed:\n${errors}${verbose ? '\n' + unit : ''}`);
  }
  const exe = path.join(dir, `Run${unitName}` + (process.platform === 'win32' ? '.exe' : ''));
  const run = spawnSync(exe, [], { encoding: 'utf-8', timeout: 60000 });
  if (run.status !== 0) throw new Error(`program exited ${run.status}: ${(run.stdout + run.stderr).trim().split('\n').slice(-3).join(' | ')}`);
  return run.stdout.replace(/\r/g, '').trim();
}

/** @returns {string} probe() of the snippet run by Node, the reference */
function reference(js) {
  return String(new Function(js + '\nreturn probe();')());
}

const cases = require('./UnitCases.js').createCases();
/** A case whose program output must equal the JavaScript reference. */
function sameAsJs(name, js, expected) {
  cases.case(name, () => {
    const want = expected !== undefined ? expected : reference(js);
    const out = runPascal(js);
    if (out === 'skip') return 'skip';
    if (out !== want) throw new Error(`expected\n${want}\ngot\n${out}`);
  });
}
function expectMatch(code, re, what) {
  if (!re.test(code)) throw new Error(`expected ${what} (${re})\n${verbose ? code : ''}`);
}

// ---------------------------------------------------------------------------
// The unit compiles without a compiler
// ---------------------------------------------------------------------------
cases.case('unit: a snippet transpiles to a unit using the shared runtime, without a System clash', () => {
  // Given any snippet
  // When transpiled for a shared runtime unit
  // Then the unit uses that runtime and never re-declares System
  const code = transpile('/** @returns {string} */ function probe() { return "x"; }', 'Probe');
  expectMatch(code, /^unit Probe;/m, 'the unit header');
  expectMatch(code, new RegExp(`uses[^;]*\\b${RUNTIME_UNIT}\\b`), 'uses of the runtime unit');
  if (/uses[^;]*\bSystem\b/.test(code)) throw new Error('the unit lists System in uses (duplicate identifier)');
});

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------
sameAsJs('precedence: the right operand of an operator of the same level keeps its parentheses',
  '/** @param {uint32} m @returns {uint32} */ function f(m) { return m & (m >>> 1) & 0xFF; }\n' +
  '/** @param {int32} a @param {int32} b @param {int32} c @returns {int32} */ function g(a, b, c) { return a - (b - c); }\n' +
  '/** @param {int32} a @param {int32} b @returns {int32} */ function h(a, b) { return (a * b) % (b - 1); }\n' +
  '/** @returns {string} */ function probe() { return f(0x12345678) + " " + g(10, 4, 3) + " " + h(7, 5); }');
sameAsJs('number: integer arithmetic past 32 bits is not narrowed, past 2^53 rounds like a double, / is a division',
  '/** @param {uint32} a @returns {float64} */ function big(a) { return (a * a) % 1000; }\n' +
  '/** @param {uint32} a @returns {float64} */ function wide(a) { return (a + a) % 7; }\n' +
  '/** @param {int32} a @param {int32} b @returns {float64} */ function div(a, b) { return a / b; }\n' +
  '/** @returns {string} */ function probe() { return big(0xFFFFFFFF) + " " + wide(0xFFFFFFFF) + " " + div(7, 2) + " " + div(-1, 4); }');
sameAsJs('bigint: arbitrary precision past 64 bits, masked 64-bit shifts',
  '/** @param {BigInt} x @returns {BigInt} */ function shl(x) { return (x << 3n) & 0xFFFFFFFFFFFFFFFFn; }\n' +
  '/** @returns {string} */ function probe() { return ((1n << 70n) % 1000003n).toString() + " " + shl(0xF000000000000001n).toString(16); }');

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------
sameAsJs('string: slice counts negative indices from the end, substring clamps them to 0',
  '/** @param {string} s @returns {string} */ function f(s) { return s.slice(-3) + "|" + s.slice(1, -1) + "|" + s.substring(-2, 2) + "|" + s.substring(3, 1); }\n' +
  '/** @returns {string} */ function probe() { return f("abcdef"); }');

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
sameAsJs('map: set, get, has, delete and size follow JavaScript, a missing key reads undefined',
  '/** @returns {string} */ function probe() {\n' +
  '  const m = new Map(); m.set(1, "a"); m.set(2, "b"); m.set(1, "c");\n' +
  '  const before = m.size; const gone = m.delete(2); const again = m.delete(2);\n' +
  '  return before + " " + m.get(1) + " " + m.has(2) + " " + gone + " " + again + " " + m.size + " " + (m.get(9) === undefined); }');

// ---------------------------------------------------------------------------
// Members reached by name
// ---------------------------------------------------------------------------
sameAsJs('members: a member no class of the static type declares is written and read by name',
  'class Box { constructor() { this.v = 2; } }\n' +
  '/** @param {Box} b @returns {int32} */ function g(b) { b.extra = 5; return b.extra + b.v; }\n' +
  '/** @returns {string} */ function probe() { return String(g(new Box())); }');

// ---------------------------------------------------------------------------
// Control flow
// ---------------------------------------------------------------------------
sameAsJs('control: a switch with fall-through and a continue inside a loop',
  '/** @param {int32} n @returns {int32} */ function f(n) { let s = 0;\n' +
  '  for (let i = 0; i < n; i++) { switch (i % 3) { case 0: s += 1; case 1: s += 10; break; default: continue; } s += 100; }\n' +
  '  return s; }\n' +
  '/** @returns {string} */ function probe() { return String(f(7)); }');
sameAsJs('control: typeof of a typed value folds and drops the branch the type rules out',
  '/** @param {uint8[]} d @returns {int32} */ function f(d) { if (typeof d === "string") return d.charCodeAt(0); return d.length; }\n' +
  '/** @returns {string} */ function probe() { return String(f([1, 2, 3])); }');

// ---------------------------------------------------------------------------
// Callbacks
// ---------------------------------------------------------------------------
sameAsJs('callback: an untyped expression-bodied arrow still returns its value',
  '/** @param {uint8[]} b @returns {string} */ function show(b) { return b.join(","); }\n' +
  '/** @returns {string} */ function probe() { return show(Array.from({length: 4}, (_, i) => i)); }');
cases.case('callback: a callback that is not a function expression is refused, not compiled empty', () => {
  // Given arr.map(String)
  // Then the statement raises "unsupported" instead of mapping every element to 0
  const code = transpile('/** @param {float64[]} a @returns {string} */ function f(a) { return a.map(String).join(" "); }', 'Probe', false);
  expectMatch(code, /unsupported: a callback that is not a function expression/, 'the unsupported raise');
});

// ---------------------------------------------------------------------------
// Number to string
// ---------------------------------------------------------------------------
sameAsJs('number: String() of a fraction whose exponent is 0, negative fractions and huge integers',
  '/** @param {float64} a @returns {float64} */ function id(a) { return a; }\n' +
  '/** @returns {string} */ function probe() { return id(3.5) + " " + id(-0.25) + " " + id(1e21) + " " + id(123456789.125) + " " + id(1.5e-7); }');

/**
 * DELPHI: run every regression case.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  verbose = Boolean(options.verbose);
  realLog('Delphi transpile regression suite');
  try {
    return cases.run({ verbose });
  } finally {
    if (workDir) { try { fs.rmSync(workDir, { recursive: true, force: true }); } catch (e) { /* temp dir cleanup is best effort */ } }
    workDir = null;
  }
}

module.exports = { run, transpile, runPascal };
