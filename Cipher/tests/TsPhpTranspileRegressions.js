/**
 * TsPhpTranspileRegressions.js - regression tests for systematic TypeScript
 * and PHP transpilation faults (each case names the fault it pins down).
 *
 * Every case is Given (a JavaScript snippet) / When (transpiled to a
 * standalone TypeScript or PHP file, the runtime included, and compiled or
 * linted the way the VALIDATION category does it) / Then (a driver appended
 * to it prints the expected values, or the generated code has a specific
 * shape). The cases that compile or run are skipped when tsc or php is not
 * installed.
 *
 * The TSPHP category: node tests/TranspilerSuite.js --only=tsphp [--verbose]
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const CIPHER_DIR = path.join(__dirname, '..');
// Options of the current run, set by run()
let verbose = false;

// The transpiler logs progress on console.log; keep the suite output readable.
const realLog = console.log;
const quiet = fn => { console.log = () => {}; try { return fn(); } finally { console.log = realLog; } };

const { TypeAwareJSASTParser } = quiet(() => require(path.join(CIPHER_DIR, 'type-aware-transpiler.js')));
const { LanguagePlugins } = require(path.join(CIPHER_DIR, 'codingplugins', 'LanguagePlugin.js'));
const Validation = require('./TranspilerValidation.js');

/**
 * The plugin of a language, loaded afresh: an earlier category in the same
 * process (CODEGEN) clears the plugin registry.
 */
const plugins = {};
function pluginFor(file, extension) {
  if (plugins[extension]) return plugins[extension];
  const resolved = require.resolve(path.join(CIPHER_DIR, 'codingplugins', file));
  delete require.cache[resolved];
  quiet(() => require(resolved));
  plugins[extension] = LanguagePlugins.GetAll().find(p => p.extension === extension);
  return plugins[extension];
}

/**
 * @param {string} js - JavaScript source
 * @param {string} language - 'typescript' or 'php'
 * @param {boolean} [standalone] - include the runtime (as the validation does)
 * @returns {string} the generated code
 */
function transpile(js, language, standalone = true) {
  const plugin = language === 'typescript' ? pluginFor('typescript.js', 'ts') : pluginFor('php.js', 'php');
  return quiet(() => {
    const ast = new TypeAwareJSASTParser(js).parse();
    const result = plugin.GenerateFromAST(ast, { generateTestHarness: standalone, namespace: 'CipherValidation' });
    if (!result.success) throw new Error(result.error || 'transpile failed');
    return result.code;
  });
}

const available = {};
/** Whether the toolchain of a language is installed. */
function installed(language) {
  if (available[language] === undefined) {
    const config = Validation.LANGUAGE_COMPILERS[language];
    let probe;
    try { probe = config.detect(); } catch (e) { probe = { available: false }; }
    available[language] = !!probe.available;
  }
  return available[language];
}

/**
 * Compile (or lint) the transpiled snippet with a driver appended, the way the
 * validation does, and run it.
 * @param {string} js - JavaScript source
 * @param {string} language - 'typescript' or 'php'
 * @param {string} driver - statements of that language run after the code
 * @returns {string|'skip'} trimmed stdout, or 'skip' without the toolchain
 */
function runIn(js, language, driver) {
  if (!installed(language)) return 'skip';
  const code = transpile(js, language) + '\n' + driver + '\n';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsphp-regression-'));
  try {
    const compiled = Validation.testCompilation(language, code, dir);
    if (!compiled.success)
      throw new Error(`${language} does not compile: ${Validation.firstError(compiled.errors, language) || compiled.errors}${verbose ? '\n' + code : ''}`);
    const run = Validation.executeCode(language, dir);
    if (run.exitCode !== 0)
      throw new Error(`${language} run exited ${run.exitCode}: ${(run.stderr || run.stdout || '').trim().split('\n').slice(-3).join(' | ')}`);
    return run.stdout.trim();
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp dir cleanup is best effort */ }
  }
}

const cases = require('./UnitCases.js').createCases();
function check(name, fn) { cases.case(name, fn); }
function expectMatch(code, re, what) {
  if (!re.test(code)) throw new Error(`expected ${what} (${re})\n${verbose ? code : ''}`);
}
function expectOutput(out, lines) {
  if (out === 'skip') return 'skip';
  const want = lines.join('\n');
  if (out.replace(/\r/g, '') !== want) throw new Error(`expected output\n${want}\ngot\n${out}`);
}

// ---------------------------------------------------------------------------
// TypeScript: the JavaScript reference output, typed from the IL
// ---------------------------------------------------------------------------
check('typescript: every property a class reaches through this is declared, and erases to nothing', () => {
  const js = 'class Box extends AlgorithmFramework.IAlgorithmInstance {\n' +
    '  constructor(algorithm) { super(algorithm); this.count = 0; /** @type {uint8[]} */ this.items = []; }\n' +
    '  /** @param {uint8} x */ add(x) { this.items.push(x); this.count += 1; this.last = x; }\n' +
    '}\n' +
    'globalThis.Box = Box;';
  // Given a class that creates its properties by assigning them
  // When it is transpiled
  // Then each is declared with `declare` (no initializer the JavaScript would not have)
  const code = transpile(js, 'typescript', false);
  expectMatch(code, /declare count: number;/, 'a declared count');
  expectMatch(code, /declare items: NumericArray;/, 'declared items');
  expectMatch(code, /declare last: \w+;/, 'a declared last');
  // And the class runs as the JavaScript does
  return expectOutput(runIn(js, 'typescript',
    'const b = new (globalThis as any).Box(null); b.add(5); b.add(7); console.log(b.count, b.items.join(","), b.last);'),
  ['2 5,7 7']);
});

check('typescript: a call that spreads an array into fixed parameters compiles', () => {
  const js = 'function sum(a, b, c) { return a + b + c; }\n' +
    'globalThis.word = OpCodes.Pack32BE(...[1, 2, 3, 4]);\n' +
    'globalThis.total = sum(...[1, 2, 3]);';
  // Given spread arguments to an OpCodes function and a function of three parameters
  // When compiled and run
  // Then they are accepted and compute the JavaScript values
  return expectOutput(runIn(js, 'typescript', 'console.log((globalThis as any).word, (globalThis as any).total);'), ['16909060 6']);
});

check('typescript: a call may leave out arguments and pass more than declared', () => {
  const js = 'function f(a, b) { return b === undefined ? a : a + b; }\n' +
    'function g(a) { return a; }\n' +
    'globalThis.r = [f(1), f(1, 2), g(3, 4)];';
  // Given calls with fewer and more arguments than parameters
  // When compiled and run
  // Then tsc accepts them (TS2554 before) and the values are JavaScript's
  return expectOutput(runIn(js, 'typescript', 'console.log((globalThis as any).r.join(","));'), ['1,3,3']);
});

check('typescript: an `as` assertion keeps the grouping of a lower-precedence operand', () => {
  const js = 'const MASK64 = 0xFFFFFFFFFFFFFFFFn;\n' +
    '/** @param {uint64} a @param {uint64} b @returns {uint64} */\n' +
    'function mix(a, b) { return OpCodes.AndN(OpCodes.XorN(a, b) + 1n, MASK64); }\n' +
    'globalThis.m = mix(0xFFFFFFFFFFFFFFFFn, 0n);';
  // Given 64-bit operands the IL leaves open (a BigInt or a Number) in a masked sum
  // When compiled and run
  // Then `(x & y as any)` was not parsed as `x & (y as any)`, and the value wraps as in JavaScript
  return expectOutput(runIn(js, 'typescript', 'console.log(String((globalThis as any).m));'), ['0']);
});

check('typescript: a boolean in arithmetic counts as 0 or 1', () => {
  const js = '/** @param {uint32[]} words @returns {int32} */\n' +
    'function ones(words) { let n = 0; for (let i = 0; i < words.length; ++i) n += OpCodes.GetBit(words[i], 0); return n; }\n' +
    'globalThis.n = ones([1, 2, 3]);';
  // Given a sum of OpCodes.GetBit results (booleans)
  // When compiled and run
  // Then tsc accepts it and the sum is JavaScript's
  return expectOutput(runIn(js, 'typescript', 'console.log((globalThis as any).n);'), ['2']);
});

check('typescript: a placeholder method that only throws lets its overrides return values', () => {
  const js = 'class Base { schedule(key) { throw new Error("not implemented"); }\n' +
    '  /** @param {uint8[]} key */ setKey(key) { this.ks = this.schedule(key); } }\n' +
    'class Impl extends Base { schedule(key) { return key.map(b => b ^ 1); } }\n' +
    'globalThis.Impl = Impl;';
  // Given a base method whose body only throws and a subclass implementing it
  // When compiled
  // Then the base does not return void (TS2322 at the assignment before)
  return expectOutput(runIn(js, 'typescript',
    'const i = new (globalThis as any).Impl(); i.setKey([2, 3]); console.log(i.ks.join(","));'), ['3,2']);
});

check('typescript: a variable the IL types only by a guess is left to inference', () => {
  const js = 'class Counter { constructor() { this.counters = new Map(); }\n' +
    '  increment(name, value = 1) { const current = this.counters.get(name) || 0; this.counters.set(name, current + value); } }\n' +
    'globalThis.Counter = Counter;';
  // Given `x || 0`, which the IL marks as a guessed boolean
  // When compiled
  // Then the variable carries no boolean annotation and the sum compiles
  const code = transpile(js, 'typescript', false);
  if (/current: boolean/.test(code)) throw new Error('the guessed boolean type was emitted');
  return expectOutput(runIn(js, 'typescript',
    'const c = new (globalThis as any).Counter(); c.increment("a"); c.increment("a", 2); console.log(c.counters.get("a"));'), ['3']);
});

check('typescript: a getter and a setter of different types both state their type', () => {
  const js = 'class Seeded { constructor() { this._seed = 0n; }\n' +
    '  /** @returns {BigInt} */ get seed() { return this._seed; }\n' +
    '  /** @param {string} value */ set seed(value) { this._seed = BigInt("0x" + value); } }\n' +
    'globalThis.Seeded = Seeded;';
  // Given a getter returning a BigInt and a setter taking hex text
  // When compiled and run
  // Then tsc accepts the pair (TS2322 before) and the value round-trips
  return expectOutput(runIn(js, 'typescript',
    'const s = new (globalThis as any).Seeded(); s.seed = "ff"; console.log(String(s.seed));'), ['255']);
});

check('typescript: an object method named byteLength stays a call', () => {
  const js = 'class Cursor { constructor() { this.n = 3; } byteLength() { return this.n; } }\n' +
    'globalThis.size = 10 + new Cursor().byteLength();';
  // Given a user method that shares its name with a DataView property
  // When compiled and run
  // Then it is called (the IL made it a property read: number + function)
  return expectOutput(runIn(js, 'typescript', 'console.log((globalThis as any).size);'), ['13']);
});

// ---------------------------------------------------------------------------
// PHP: the JavaScript reference output on the JavaScript-semantics runtime
// ---------------------------------------------------------------------------

/** A PHP driver printing the module variables of the snippet (namespace CipherValidation) */
const phpPrint = (...names) => `namespace {\necho ${names.map(n => `\\JS\\toStr(\\CipherValidation\\M::$${n})`).join(" . ' ' . ")}, "\\n";\n}`;

/** What JavaScript prints for the same variables */
function jsPrint(js, ...names) {
  // eslint-disable-next-line no-new-func
  return new Function('OpCodes', `${js}\nreturn [${names.join(', ')}].map(String).join(' ');`)(require(path.join(CIPHER_DIR, 'OpCodes.js')));
}

check('php: an array passed to a function is the same array (PHP arrays are values)', () => {
  const js = 'function fill(a) { a[0] = 7; }\nconst arr = [0, 1];\nfill(arr);\nconst r = arr[0];';
  // Given a function writing into the array it is passed
  // When run
  // Then the caller's array changed, as in JavaScript
  return expectOutput(runIn(js, 'php', phpPrint('r')), [jsPrint(js, 'r')]);
});

check('php: ++ and -- of an array element change it (PHP loses them on ArrayAccess)', () => {
  const js = 'const c = [0, 5];\nc[1]++;\n++c[1];\nc[0]--;\nconst a = c[0], b = c[1];';
  // Given increments and a decrement of elements
  // When run
  // Then each took effect
  return expectOutput(runIn(js, 'php', phpPrint('a', 'b')), [jsPrint(js, 'a', 'b')]);
});

check('php: 32-bit bitwise results are JavaScript\'s signed and unsigned words', () => {
  const js = 'const x = 0x80000000;\nconst a = x | 0, b = 0xFFFFFFFF ^ 0, c = 1 << 31, d = -1 >>> 0, e = (x >> 4), f = OpCodes.Not32(0), g = OpCodes.Xor32(0xFFFFFFFF, 1);';
  // Given bit 31 reached by |, ^, <<, >>, >>> and the unsigned OpCodes helpers
  // When run
  // Then each value is JavaScript's (an inlined OpCodes.Not32 is unsigned as OpCodes returns it)
  return expectOutput(runIn(js, 'php', phpPrint('a', 'b', 'c', 'd', 'e', 'f', 'g')), [jsPrint(js, 'a', 'b', 'c', 'd', 'e', 'f', 'g')]);
});

check('php: a product past 2^53 is the double JavaScript rounds it to', () => {
  const js = 'const s0 = 0xAAD26B49;\nconst t0 = OpCodes.ToUint32(1099087573 * s0);';
  // Given two 32-bit factors whose exact product PHP would keep
  // When run
  // Then the low word is the one of JavaScript's rounded product
  return expectOutput(runIn(js, 'php', phpPrint('t0')), [jsPrint(js, 't0')]);
});

check('php: accessors and methods differing only in case are kept apart', () => {
  const js = 'class C { constructor() { this._k = 1; this._K = 2; }\n  get key() { return this._k; } get Key() { return this._K; }\n  v() { return 3; } V() { return 4; } }\n'
    + 'const o = new C();\nconst a = o.key, b = o.Key, c = o.v(), d = o.V();';
  // Given accessors key/Key and methods v/V (PHP method names ignore case)
  // When run
  // Then each is its own
  return expectOutput(runIn(js, 'php', phpPrint('a', 'b', 'c', 'd')), ['1 2 3 4']);
});

check('php: a property holding null is not undefined', () => {
  const js = 'const o = { input: null };\nconst a = o.input !== undefined, b = o.missing !== undefined;';
  // Given a property set to null and one never set (PHP has one null for both)
  // When compared with undefined
  // Then only the missing one is undefined
  return expectOutput(runIn(js, 'php', phpPrint('a', 'b')), ['true false']);
});

check('php: BigInt division and remainder truncate toward zero', () => {
  const js = 'const a = -7n % 3n, b = -7n / 2n, c = -5n >> 1n, d = -5n & 255n;';
  // Given negative BigInts (GMP's % is never negative)
  // When run
  // Then the results are JavaScript's
  return expectOutput(runIn(js, 'php', phpPrint('a', 'b', 'c', 'd')), [jsPrint(js, 'a', 'b', 'c', 'd')]);
});

check('php: Node.js crypto HMACs are PHP\'s hash HMACs', () => {
  const js = "const crypto = require('crypto');\nconst h = crypto.createHmac('sha1', Buffer.from([1, 2, 3]));\nh.update(Buffer.from([4, 5]));\nconst r = h.digest('hex');";
  // Given an algorithm computing HMAC-SHA1 with Node's crypto module
  // When run
  // Then the digest is the same
  const expected = require('crypto').createHmac('sha1', Buffer.from([1, 2, 3])).update(Buffer.from([4, 5])).digest('hex');
  return expectOutput(runIn(js, 'php', phpPrint('r')), [expected]);
});

/**
 * TSPHP: run every regression case.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  verbose = Boolean(options.verbose);
  realLog('TypeScript and PHP transpile regression suite');
  return cases.run({ verbose });
}

module.exports = { run, transpile, runIn };
