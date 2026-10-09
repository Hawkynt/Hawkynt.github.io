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

/** A language plugin: the registered one, else loaded afresh (an earlier category may have cleared the registry) */
function loadPlugin(file, extension) {
  const registered = LanguagePlugins.GetAll().find(p => p.extension === extension);
  if (registered) return registered;
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

check('ruby: a uint64 sum masked by ToQWord is masked even though its operands are 64-bit', () => {
  const js = 'function f(a, b) { /** @type {uint64} */ const x = 0xFFFFFFFFFFFFFFFFn; return OpCodes.ToQWord(x + BigInt(a)) === BigInt(a) - 1n; }';
  // Given 2^64 - 1 + a (boundary: the sum overflows 64 bits by exactly a - 1)
  // When masked to 64 bits
  // Then the result wraps instead of keeping the 65th bit
  return expectOutput(runRuby(js, 'p $main_f.(5, 0)'), ['true']);
});

check('ruby: a BigInt held in a uint64-typed constant multiplies exactly', () => {
  const js = 'const E = 0x25B946EBC0B36173n; const K = 256n; function f() { return OpCodes.ToQWord(E * K).toString(16); }';
  const want = ((0x25B946EBC0B36173n * 256n) & 0xFFFFFFFFFFFFFFFFn).toString(16);
  return expectOutput(runRuby(js, 'p $main_f.()'), [`"${want}"`]);
});

check('ruby: a float64 sum past 2^53 rounds like a double', () => {
  const js = 'function f(s) { /** @type {float64} */ let x = s; x = x * 1103515245 + 12345; return OpCodes.And32(x, 0x7FFFFFFF); }';
  // Given a product above 2^53 (rounded) plus a small odd constant (rounded again)
  const want = (() => { let x = 4294967295; x = x * 1103515245 + 12345; return (x & 0x7FFFFFFF) >>> 0; })();
  return expectOutput(runRuby(js, 'p $main_f.(4294967295)'), [String(want)]);
});

check('ruby: a closure assigning an outer local updates it', () => {
  const js = 'function f() { function bump() { counter = 16; } function take() { return counter--; } let counter = 0; bump(); take(); return counter; }';
  // Given hoisted functions writing a local declared after them
  return expectOutput(runRuby(js, 'p $main_f.()'), ['15']);
});

check('ruby: this[k] reads the property named by the variable k', () => {
  const js = 'class P { constructor() { this.alpha = 3; } get(k) { return this[k]; } put(k, v) { this[k] = v; return this.alpha; } }\n' +
    'function f() { const p = new P(); return [p.get("alpha"), p.put("alpha", 9)]; }';
  return expectOutput(runRuby(js, 'p $main_f.()'), ['[3, 9]']);
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

// ===========================================================================
// FREEBASIC
// ===========================================================================
//
// One compile serves every case (the runtime makes a build take seconds):
// each case is a module function, the driver prints its value on a line of
// its own, and a case checks its line.

const FB_CASES = {
  typedcopy: {
    // a typed array constructed from a typed array is a copy, not a view
    js: 'function typedcopy() { const a = new Uint8Array([1, 2, 3]); const b = new Uint8Array(a); b[0] = 9; return [a[0], b[0], b.length]; }',
    expect: '1,9,3'
  },
  bigdouble: {
    // integral doubles past 2^63 convert exactly (FreeBASIC's Int and Fix saturate there)
    js: 'function bigdouble() { const x = 15817227400572908000; return [x >>> 0, x | 0, String(BigInt(x))]; }',
    expect: '2126065664,2126065664,15817227400572907520'
  },
  andn: {
    // an inlined OpCodes BigInt helper is a BigInt operation even on uint64-typed operands
    js: '/**\n * @param {uint64} a - a\n * @param {uint64} b - b\n * @returns {uint64} a - b mod 2^64\n */\nfunction andn(a, b) { return OpCodes.AndN(a - b, 0xFFFFFFFFFFFFFFFFn); }',
    call: 'js_fcall2(@fmainx_andn, js_tobig(js_num(1)), js_tobig(js_num(2)))',
    expect: '18446744073709551615'
  },
  fprecision: {
    // arithmetic rounds to double precision (x87 rounds intermediates to 64-bit mantissas)
    js: 'function fprecision() { let s = 42; const out = []; for (let i = 0; i < 4; ++i) { s = OpCodes.And32(s * 1103515245 + 12345, 0x7FFFFFFF); out.push(s); } return out.join(" "); }',
    expect: '1250496027 1116302080 1964818176 1500480256'
  },
  xornum: {
    // ... and on Numbers it stays a Number operation
    js: 'function xornum() { const v = OpCodes.XorN(OpCodes.XorN(0x47, 0x50), 0x52); return [v, typeof v]; }',
    expect: '69,number'
  },
  bigstep: {
    // ++ and -- step a BigInt by 1n
    js: 'function bigstep() { let i = 0n; i++; ++i; let j = 5n; j--; return [String(i), String(j)]; }',
    expect: '2,4'
  },
  varscope: {
    // var is function-scoped: the loop variable is read after the loop
    js: 'function varscope() { for (var i = 0; i < 3; ++i) { } return i; }',
    expect: '3'
  },
  hoisted: {
    // a hoisted nested function captures a variable declared after it
    js: 'function hoisted() { const buf = [1, 2]; function step(x) { buf.push(x); } step(3); step(4); return buf.join("-"); }',
    expect: '1-2-3-4'
  },
  regex: {
    // regular expressions: replace (global), split, test, negated classes
    js: 'function regex() { return ["a1b22c".replace(/[0-9]+/g, "_"), "x  y,z".split(/[\\s,]+/).join("|"), /^ab/.test("abc"), "AbC".replace(/[^A-Z]/g, "")]; }',
    expect: 'a_b_c,x|y|z,true,AC'
  },
  charcodes: {
    // String.fromCharCode.apply spreads its array
    js: 'function charcodes() { return String.fromCharCode.apply(null, [72, 105]); }',
    expect: 'Hi'
  },
  bitstream: {
    // OpCodes.CreateBitStream writes and reads back MSB-first bit fields
    js: 'function bitstream() { const w = OpCodes.CreateBitStream(); w.writeBits(5, 3); w.writeBits(1, 1); w.writeBits(300, 9); const bytes = w.toArray(); const r = OpCodes.CreateBitStream(bytes); return [bytes.join(","), r.readBits(3), r.readBits(1), r.readBits(9)]; }',
    expect: '185,96,5,1,300'
  },
  globals: {
    // typeof an undeclared name is "undefined"; builtins the runtime provides are not
    js: 'function globals() { return [typeof notDeclaredAnywhere, typeof Math, typeof performance.now]; }',
    expect: 'undefined,object,function'
  },
  argorder: {
    // call arguments, array elements and operands are evaluated left to right
    // (FreeBASIC evaluates a call's arguments right to left)
    js: 'function argorder() { const log = []; function f(x) { log.push(x); return x; } function g(a, b, c) { return a + b + c; } ' +
      'g(f(1), f(2), f(3)); const arr = [f(4), f(5)]; const s = String(f(6)) + String(f(7)); return log.join("") + "/" + arr.join("") + "/" + s; }',
    expect: '1234567/45/67'
  }
};

let fbRun = null;
/** @returns {Map<string,string>|'skip'} every case's printed value, from one build */
function runBasicCases() {
  if (fbRun) return fbRun;
  if (!hasTool('fbc', ['-version'])) return (fbRun = 'skip');
  const names = Object.keys(FB_CASES);
  const driver = names.map(n => `Print "${n}|"; js_tostring(${FB_CASES[n].call || `js_fcall0(@fmainx_${n})`})`);
  const code = transpile('basic', names.map(n => FB_CASES[n].js).join('\n')) + '\n' + driver.join('\n') + '\n';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-regression-'));
  try {
    const file = path.join(dir, 'probe.bas');
    fs.writeFileSync(file, code);
    const build = spawnSync('fbc', [file, '-x', path.join(dir, 'probe.exe')], { encoding: 'utf-8', timeout: 300000, windowsHide: true });
    if (build.status !== 0) throw new Error(`fbc exited ${build.status}: ${(build.stdout + build.stderr).trim().split('\n').slice(0, 4).join(' | ')}`);
    const run = spawnSync(path.join(dir, 'probe.exe'), [], { encoding: 'utf-8', timeout: 60000, windowsHide: true });
    if (run.status !== 0) throw new Error(`the FreeBASIC probe exited ${run.status}: ${(run.stdout || '').trim().split('\n').slice(-3).join(' | ')}`);
    fbRun = new Map(run.stdout.replace(/\r/g, '').trim().split('\n').map(l => [l.slice(0, l.indexOf('|')), l.slice(l.indexOf('|') + 1)]));
    return fbRun;
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp dir cleanup is best effort */ }
  }
}

for (const [name, c] of Object.entries(FB_CASES)) {
  check(`basic: ${name} returns what JavaScript returns`, () => {
    // Given the JavaScript function / When transpiled to FreeBASIC, built and called / Then it returns what JavaScript returns
    const out = runBasicCases();
    if (out === 'skip') return 'skip';
    if (out.get(name) !== c.expect) throw new Error(`expected ${c.expect}, got ${out.get(name)}`);
  });
}

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
