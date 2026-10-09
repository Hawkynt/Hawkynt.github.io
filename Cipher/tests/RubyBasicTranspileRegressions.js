/**
 * RubyBasicTranspileRegressions.js - regression tests for systematic Ruby and
 * FreeBASIC transpilation faults (each case names the fault it pins down).
 *
 * Every case is Given (a JavaScript snippet) / When (transpiled to Ruby or
 * FreeBASIC, runtime included) / Then (the generated code has a specific
 * shape, or a driver appended to it prints the expected values). The cases
 * that run code are skipped when the interpreter or compiler is not installed.
 *
 * The RUBYBASIC category: node tests/TranspilerSuite.js --only=rubybasic [--verbose]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CIPHER_DIR = path.join(__dirname, '..');
let verbose = false;

const realLog = console.log;
const quiet = fn => { console.log = () => {}; try { return fn(); } finally { console.log = realLog; } };

const { TypeAwareJSASTParser } = quiet(() => require(path.join(CIPHER_DIR, 'type-aware-transpiler.js')));
const { LanguagePlugins } = require(path.join(CIPHER_DIR, 'codingplugins', 'LanguagePlugin.js'));

/** A language plugin loaded afresh (an earlier category may have cleared the registry) */
function loadPlugin(file, extension) {
  const resolved = require.resolve(path.join(CIPHER_DIR, 'codingplugins', file));
  delete require.cache[resolved];
  quiet(() => require(resolved));
  return LanguagePlugins.GetAll().find(p => p.extension === extension);
}

const plugins = {};
function plugin(language) {
  if (!plugins[language]) plugins[language] = language === 'ruby' ? loadPlugin('ruby.js', 'rb') : loadPlugin('basic.js', 'bas');
  return plugins[language];
}

/**
 * @param {string} language - ruby or basic
 * @param {string} js - JavaScript source
 * @returns {string} the generated code
 */
function transpile(language, js) {
  return quiet(() => {
    const ast = new TypeAwareJSASTParser(js).parse();
    const result = plugin(language).GenerateFromAST(ast, { className: 'mainGenerated' });
    if (!result.success) throw new Error(result.error || 'transpile failed');
    return result.code;
  });
}

const toolCache = {};
/** @returns {boolean} whether the command runs */
function hasTool(command, args) {
  if (!(command in toolCache)) {
    const probe = spawnSync(command, args, { encoding: 'utf-8', windowsHide: true });
    toolCache[command] = !probe.error && probe.status === 0;
  }
  return toolCache[command];
}

/**
 * Run the transpiled Ruby with a driver appended.
 * @param {string} js - JavaScript source
 * @param {string} driver - Ruby statements run after the module
 * @returns {string|'skip'} trimmed stdout, or 'skip' without Ruby
 */
function runRuby(js, driver) {
  if (!hasTool('ruby', ['--version'])) return 'skip';
  const code = transpile('ruby', js) + '\n' + driver + '\n';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-regression-'));
  try {
    const file = path.join(dir, 'probe.rb');
    fs.writeFileSync(file, code);
    const run = spawnSync('ruby', [file], { encoding: 'utf-8', timeout: 60000, windowsHide: true });
    if (run.status !== 0)
      throw new Error(`ruby exited ${run.status}: ${(run.stderr || '').trim().split('\n').slice(0, 4).join(' | ')}${verbose ? '\n' + code : ''}`);
    return run.stdout.trim();
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp dir cleanup is best effort */ }
  }
}

const cases = require('./UnitCases.js').createCases();
function check(name, fn) { cases.case(name, fn); }
function expectMatch(code, re, what) {
  if (!re.test(code)) throw new Error(`expected ${what} (${re})${verbose ? '\n' + code : ''}`);
}
function expectOutput(out, lines) {
  if (out === 'skip') return 'skip';
  const want = lines.join('\n');
  if (out.replace(/\r/g, '') !== want) throw new Error(`expected output\n${want}\ngot\n${out}`);
}

// ===========================================================================
// RUBY
// ===========================================================================

// ---------------------------------------------------------------- syntax

check('ruby: a file whose name starts with a digit gets valid global names', () => {
  // Given a module-level constant in a file transpiled as "3des"
  // When transpiled
  // Then its global is not $3... (a Ruby match variable), so the file parses
  const code = quiet(() => plugin('ruby').GenerateFromAST(new TypeAwareJSASTParser('const ROUNDS = 16;').parse(), { className: '3desGenerated' }).code);
  expectMatch(code, /\$g3des_ROUNDS = 16/, 'a letter-led global');
});

check('ruby: locals named like Ruby keywords or constants are renamed', () => {
  const js = 'function f(end) { const K = end + 1; let next = K * 2; return [end, K, next]; }';
  // Given parameters/locals named end, K and next
  // When run
  // Then they behave as plain variables
  return expectOutput(runRuby(js, 'p $main_f.(3)'), ['[3, 4, 8]']);
});

check('ruby: a member named class or hash does not replace the Ruby method', () => {
  const js = 'class Box { constructor() { this.class = 7; this.hash = [1]; } get(k) { return this[k]; } }\n' +
    'function f() { const b = new Box(); return [b.class, b.hash[0], b.get("class")]; }';
  // Given properties named class and hash
  // When read directly and by computed key
  // Then each reads the property, and the object still has its Ruby class
  return expectOutput(runRuby(js, 'p $main_f.()'), ['[7, 1, 7]']);
});

// ---------------------------------------------------------------- numbers

check('ruby: OpCodes.Mul32 multiplies exactly; a raw product past 2^53 rounds like a double', () => {
  const js = 'function f(a, b) { return [OpCodes.Mul32(a, b), OpCodes.ToUint32(a * b)]; }';
  // Given two uint32 values whose product exceeds 2^53 (boundary of exact doubles)
  // When multiplied through Mul32 and through a plain *
  // Then Mul32 is the exact low word, the plain product the low word of the rounded double
  const a = 0xFFFFFFFF, b = 16777619;
  const want = `[${Math.imul(a, b) >>> 0}, ${(a * b) >>> 0}]`;
  return expectOutput(runRuby(js, `p $main_f.(${a}, ${b})`), [want]);
});

check('ruby: bit operators give JavaScript int32/uint32 results', () => {
  const js = 'function f(x, n) { return [x << 4, x >>> n, x >> 4, (x ^ 0x80000000) | 0, ~x, OpCodes.RotL32(x, n), OpCodes.Shl32(x, 4)]; }';
  // Given a value with the top bit set and a shift count of 33 (masked to 1)
  const x = 0xF000000F, n = 33;
  const want = `[${x << 4}, ${x >>> n}, ${x >> 4}, ${(x ^ 0x80000000) | 0}, ${~x}, ${((x << 1) | (x >>> 31)) >>> 0}, ${(x << 4) >>> 0}]`;
  return expectOutput(runRuby(js, `p $main_f.(${x}, ${n})`), [want]);
});

check('ruby: division is a double, Math.floor and |0 make integers', () => {
  const js = 'function f(a, b) { return [a / b, Math.floor(a / b), (a / b) | 0, a % b, -a % b]; }';
  // Given 7 and 2 (an inexact quotient) and a negative dividend for %
  return expectOutput(runRuby(js, 'p $main_f.(7, 2)'), ['[3.5, 3, 3, 1, -1]']);
});

check('ruby: + concatenates when either side is a string, adds otherwise', () => {
  const js = 'function f(n) { return ["a" + n + 2, n + 2 + "a", "x" + 1.5, "" + (n / 2)]; }';
  return expectOutput(runRuby(js, 'p $main_f.(1)'), ['["a12", "3a", "x1.5", "0.5"]']);
});

check('ruby: truthiness follows JavaScript (0, "", NaN false; [] true)', () => {
  const js = 'function f(v) { return v ? 1 : 0; } function g(v) { return v || 9; }';
  // Given 0, the empty string, NaN, an empty array and a non-zero number
  return expectOutput(runRuby(js, 'p [$main_f.(0), $main_f.(""), $main_f.(JS::NAN), $main_f.([]), $main_f.(2)]\np [$main_g.(0), $main_g.(5)]'),
    ['[0, 0, 0, 1, 1]', '[9, 5]']);
});

// ---------------------------------------------------------------- control flow

check('ruby: continue in a for loop still runs the update', () => {
  const js = 'function f() { const out = []; for (let i = 0; i < 5; i++) { if (i === 2) continue; out.push(i); } return out; }';
  // Given a continue on the third iteration
  // When run
  // Then the loop does not repeat it forever and skips only that value
  return expectOutput(runRuby(js, 'p $main_f.()'), ['[0, 1, 3, 4]']);
});

check('ruby: switch falls through empty cases and leaves on a nested break', () => {
  const js = 'function f(x, flag) { let r = 0; switch (x) { case 1: case 2: r = 12; break; case 3: if (flag) { r = 30; break; } r = 31; break; default: r = -1; } return r; }';
  // Given grouped cases, a break inside an if, and the default
  return expectOutput(runRuby(js, 'p [$main_f.(1, false), $main_f.(2, false), $main_f.(3, true), $main_f.(3, false), $main_f.(9, false)]'),
    ['[12, 12, 30, 31, -1]']);
});

check('ruby: continue inside a switch inside a loop continues the loop', () => {
  const js = 'function f() { const out = []; for (let i = 0; i < 4; i++) { switch (i) { case 1: if (i > 0) { continue; } break; default: break; } out.push(i); } return out; }';
  return expectOutput(runRuby(js, 'p $main_f.()'), ['[0, 2, 3]']);
});

check('ruby: array destructuring assignment swaps', () => {
  const js = 'function f(a, b) { [a, b] = [b, a]; return [a, b]; }';
  return expectOutput(runRuby(js, 'p $main_f.(1, 2)'), ['[2, 1]']);
});

check('ruby: a closure reads a local assigned after it is created', () => {
  const js = 'function f() { const read = () => count; let count = 1; count += 2; return read(); }';
  // Given a lambda referring to a later-declared local (Ruby decides locals at parse time)
  return expectOutput(runRuby(js, 'p $main_f.()'), ['3']);
});

// ---------------------------------------------------------------- objects

check('ruby: a base-class constructor assignment reaches the subclass setter', () => {
  const js = 'class Base { constructor() { this.key = [1]; } }\n' +
    'class Derived extends Base { constructor() { super(); } set key(k) { this._k = k.length; } get key() { return this._k; } }\n' +
    'function f() { return new Derived().key; }';
  return expectOutput(runRuby(js, 'p $main_f.()'), ['1']);
});

check('ruby: typed arrays wrap on store and subarray writes through', () => {
  const js = 'function f() { const u = new Uint8Array(4); u[0] = 300; const v = u.subarray(1, 3); v[0] = 513; const w = new Int32Array(1); w[0] = 0xFFFFFFFF; return [Array.from(u), w[0]]; }';
  return expectOutput(runRuby(js, 'p $main_f.()'), ['[[44, 1, 0, 0], -1]']);
});

check('ruby: a global function used as a value (String.fromCharCode.apply)', () => {
  const js = 'function f(bytes) { return String.fromCharCode.apply(null, bytes); }';
  return expectOutput(runRuby(js, 'p $main_f.([72, 105])'), ['"Hi"']);
});

check('ruby: object literals read by dot and by computed key, numbers as keys', () => {
  const js = 'function f() { const o = { a: 1, "b-c": 2 }; o[3] = 4; o.d = o.a + o["b-c"]; return [o.d, o["3"], Object.keys(o).length]; }';
  return expectOutput(runRuby(js, 'p $main_f.()'), ['[3, 4, 4]']);
});

// ---------------------------------------------------------------- framework

check('ruby: a block cipher instance inherits Result over whole blocks and refuses a partial one', () => {
  const js = 'class Inc extends IBlockCipherInstance {\n' +
    '  constructor(algorithm, isInverse) { super(algorithm); this.isInverse = isInverse; this.BlockSize = 2; }\n' +
    '  EncryptBlock(block) { return [block[0] + 1, block[1] + 1]; }\n' +
    '  DecryptBlock(block) { return [block[0] - 1, block[1] - 1]; }\n' +
    '}';
  return expectOutput(runRuby(js,
    'e = CvMain::Inc.new(nil, false)\ne.key = [0]\ne.Feed([1, 2, 3, 4])\np e.Result()\n' +
    'e.Feed([1, 2, 3])\nbegin\n  e.Result()\nrescue => x\n  puts x.message\nend'),
  ['[2, 3, 4, 5]', 'Input length must be multiple of 2 bytes']);
});

check('ruby: RegisterAlgorithm turns plain test objects into TestCases keeping extra fields', () => {
  const js = 'class A extends HashFunctionAlgorithm { constructor() { super(); this.name = "A"; this.tests = [{ input: [1], expected: [2], outputSize: 4 }]; } }\n' +
    'RegisterAlgorithm(new A());';
  return expectOutput(runRuby(js, 't = AlgorithmFramework.Find("A").tests[0]\np [t.class.name, t["outputSize"], t.text]'),
    ['["TestCase", 4, "Test vector #1"]']);
});

/**
 * RUBYBASIC: run every regression case.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  verbose = Boolean(options.verbose);
  realLog('Ruby and FreeBASIC transpile regression suite');
  return cases.run({ verbose });
}

module.exports = { run, transpile, runRuby };
