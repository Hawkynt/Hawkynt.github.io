/**
 * PythonTranspileRegressions.js - regression tests for systematic Python
 * transpilation faults (each case names the fault it pins down).
 *
 * Every case is Given (a JavaScript snippet) / When (transpiled to Python,
 * framework stubs included) / Then (the generated code has a specific shape,
 * or a Python driver appended to it prints the expected values). The cases
 * that run Python are skipped when no Python 3 interpreter is installed.
 *
 * The PYTHON category: node tests/TranspilerSuite.js --only=python [--verbose]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CIPHER_DIR = path.join(__dirname, '..');
// Options of the current run, set by run()
let verbose = false;

// The transpiler logs progress on console.log; keep the suite output readable.
const realLog = console.log;
const quiet = fn => { console.log = () => {}; try { return fn(); } finally { console.log = realLog; } };

const { TypeAwareJSASTParser } = quiet(() => require(path.join(CIPHER_DIR, 'type-aware-transpiler.js')));
const { LanguagePlugins } = require(path.join(CIPHER_DIR, 'codingplugins', 'LanguagePlugin.js'));
// Loaded afresh: an earlier category in the same process (CODEGEN) clears the
// plugin registry, so a cached python.js would never register again.
const PYTHON_PLUGIN = require.resolve(path.join(CIPHER_DIR, 'codingplugins', 'python.js'));
delete require.cache[PYTHON_PLUGIN];
quiet(() => require(PYTHON_PLUGIN));
const plugin = LanguagePlugins.GetAll().find(p => p.extension === 'py');

/**
 * @param {string} js - JavaScript source
 * @returns {string} the generated Python module
 */
function transpile(js) {
  return quiet(() => {
    const ast = new TypeAwareJSASTParser(js).parse();
    const result = plugin.GenerateFromAST(ast, { generateTestHarness: false });
    if (!result.success) throw new Error(result.error || 'transpile failed');
    return result.code;
  });
}

let pythonCommand;
/** @returns {string|null} the Python 3 interpreter command, null when none is installed */
function findPython() {
  if (pythonCommand !== undefined) return pythonCommand;
  pythonCommand = null;
  for (const candidate of ['python', 'python3']) {
    const probe = spawnSync(candidate, ['-c', 'import sys; print(sys.version_info[0])'], { encoding: 'utf-8' });
    if (probe.status === 0 && probe.stdout.trim() === '3') { pythonCommand = candidate; break; }
  }
  return pythonCommand;
}

/**
 * Run the transpiled module with a driver appended.
 * @param {string} js - JavaScript source
 * @param {string} driver - Python statements run after the module
 * @returns {string|'skip'} trimmed stdout, or 'skip' without Python
 */
function runPython(js, driver) {
  const python = findPython();
  if (!python) return 'skip';
  const code = transpile(js) + '\n\n' + driver + '\n';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'py-regression-'));
  try {
    const file = path.join(dir, 'probe.py');
    fs.writeFileSync(file, code);
    const run = spawnSync(python, [file], { encoding: 'utf-8', timeout: 60000 });
    if (run.status !== 0)
      throw new Error(`python exited ${run.status}: ${(run.stderr || '').trim().split('\n').slice(-3).join(' | ')}${verbose ? '\n' + code : ''}`);
    return run.stdout.trim();
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp dir cleanup is best effort */ }
  }
}

const cases = require('./UnitCases.js').createCases();
/** Record a case whose outcome is the Python output compared to the expected lines. */
function check(name, fn) { cases.case(name, fn); }
function expectMatch(code, re, what) {
  if (!re.test(code)) throw new Error(`expected ${what} (${re})\n${verbose ? code : ''}`);
}
function expectNoMatch(code, re, what) {
  if (re.test(code)) throw new Error(`did not expect ${what} (${re})\n${verbose ? code : ''}`);
}
function expectOutput(out, lines) {
  if (out === 'skip') return 'skip';
  const want = lines.join('\n');
  if (out.replace(/\r/g, '') !== want) throw new Error(`expected output\n${want}\ngot\n${out}`);
}

// ---------------------------------------------------------------------------
// Framework runtime: the stubs mirror AlgorithmFramework.js
// ---------------------------------------------------------------------------
check('framework: an instance without its own Feed inherits the accumulating Feed', () => {
  const js = 'const { IAlgorithmInstance } = AlgorithmFramework;\n' +
    'class Rev extends IAlgorithmInstance {\n' +
    '  constructor(algorithm) { super(algorithm); }\n' +
    '  Result() { const out = this.inputBuffer.slice().reverse(); this.inputBuffer = []; return out; }\n' +
    '}';
  // Given two Feed calls, an empty Feed and a None Feed
  // When the result is read
  // Then it covers every fed byte, in order, exactly once
  return expectOutput(runPython(js,
    'r = Rev(None)\nr.feed([1, 2])\nr.feed([])\nr.feed(None)\nr.feed([3])\nprint(list(r.result()))\nprint(list(r.result()))'),
  ['[3, 2, 1]', '[]']);
});
check('framework: a block cipher instance inherits Result over whole blocks', () => {
  const js = 'const { IBlockCipherInstance } = AlgorithmFramework;\n' +
    'class Inc extends IBlockCipherInstance {\n' +
    '  constructor(algorithm, isInverse) { super(algorithm); this.isInverse = isInverse; this.BlockSize = 2; }\n' +
    '  EncryptBlock(block) { return [block[0] + 1, block[1] + 1]; }\n' +
    '  DecryptBlock(block) { return [block[0] - 1, block[1] - 1]; }\n' +
    '}';
  // Given a key and four fed bytes (two blocks), then three bytes (a partial block), then no key
  // When Result runs
  // Then whole blocks are processed, a partial block and a missing key are refused
  return expectOutput(runPython(js,
    'e = Inc(None, False)\ne.key = [0]\ne.feed([1, 2, 3, 4])\nprint(list(e.result()))\n' +
    'd = Inc(None, True)\nd.key = [0]\nd.feed([2, 3])\nprint(list(d.result()))\n' +
    'e.feed([1, 2, 3])\ntry:\n    e.result()\nexcept Exception as x:\n    print(x)\n' +
    'n = Inc(None, False)\nn.feed([1, 2])\ntry:\n    n.result()\nexcept Exception as x:\n    print(x)\n' +
    'print(isinstance(e, IAlgorithmInstance))'),
  ['[2, 3, 4, 5]', '[1, 2]', 'Input length must be multiple of 2 bytes', 'Key not set', 'True']);
});
check('framework: BlockAbsorber holds the last full block back; Finish sees held, pending and length', () => {
  const js = 'const { BlockAbsorber } = AlgorithmFramework;\n' +
    'class Sink { constructor() { this.seen = []; } take(block) { this.seen.push(block.slice()); } }\n' +
    'function absorbAll(sink, parts) {\n' +
    '  const a = new BlockAbsorber(4, block => sink.take(block));\n' +
    '  for (const p of parts) a.Absorb(p);\n' +
    '  return a.Finish((held, pending, total) => [held, pending, total]);\n' +
    '}';
  // Given exactly one block, then one more byte (boundary: block size and block size + 1)
  // When absorbed and finished
  // Then the full block is held until the extra byte arrives, and Finish reports the tail
  return expectOutput(runPython(js,
    's = Sink()\nprint(absorb_all(s, [[1, 2, 3, 4]]), len(s.seen))\n' +
    's = Sink()\nr = absorb_all(s, [[1, 2, 3, 4], [5]])\nprint(list(s.seen[0]), list(r[0]), r[1], r[2])\n' +
    's = Sink()\nprint(absorb_all(s, [[]]), len(s.seen))'),
  ['[[1, 2, 3, 4], 4, 4] 0', '[1, 2, 3, 4] [5] 1 5', '[[], 0, 0] 0']);
});
check('framework: SpongePadBlocks merges the separator into the final bit at rate-1', () => {
  const js = 'const { SpongePadBlocks } = AlgorithmFramework;\n' +
    'function pad(held, pending, rate, sep) { return SpongePadBlocks(held, pending, rate, sep); }';
  // Given rate-1 pending bytes, none, and a full block
  return expectOutput(runPython(js,
    'print([list(b) for b in pad([1, 2, 3], 3, 4, 6)])\nprint([list(b) for b in pad([], 0, 4, 31)])\nprint([list(b) for b in pad([1, 2, 3, 4], 4, 4, 6)])'),
  ['[[1, 2, 3, 134]]', '[[31, 0, 0, 128]]', '[[1, 2, 3, 4], [6, 0, 0, 128]]']);
});
check('framework: MerkleDamgardBlocks splits at the length-field boundary and honours the options', () => {
  const js = 'const { MerkleDamgardBlocks } = AlgorithmFramework;\n' +
    'function md(n, total, le) { const held = new Array(n).fill(0); return MerkleDamgardBlocks(held, n, total, { blockSize: 64, lengthBytes: 8, lengthLittleEndian: le }); }';
  // Given 55 bytes (fits one block) and 56 bytes (needs two), big- and little-endian length
  return expectOutput(runPython(js,
    'print(len(md(55, 55, False)), len(md(56, 56, False)))\nprint(list(md(0, 3, False)[0][56:]))\nprint(list(md(0, 3, True)[0][56:]))'),
  ['1 2', '[0, 0, 0, 0, 0, 0, 0, 24]', '[24, 0, 0, 0, 0, 0, 0, 0]']);
});

// ---------------------------------------------------------------------------
// OpCodes runtime: the Python port covers OpCodes.js
// ---------------------------------------------------------------------------
check('opcodes: every public OpCodes.js function has a Python implementation', () => {
  const OpCodes = require(path.join(CIPHER_DIR, 'OpCodes.js'));
  const names = Object.keys(OpCodes).filter(k => typeof OpCodes[k] === 'function' && !k.startsWith('_'));
  // Given the public OpCodes.js surface
  // When the Python runtime is loaded
  // Then each name is defined on the OpCodes class itself, not answered by the
  //      missing-constant fallback (which yields 0, so a call raised "'int' object is not callable")
  const out = runPython('function f() { return 1; }',
    `names = ${JSON.stringify(names)}\nprint(",".join(n for n in names if not any(n in c.__dict__ for c in OpCodes.__mro__)) or "none")`);
  return expectOutput(out, ['none']);
});
check('opcodes: hex table constructors, SetByte, BytesToChars and SecureRandomBytes', () => {
  const js = 'function f() { return [OpCodes.CreateUint64ArrayFromHex(["0x0123456789ABCDEF", "ff"]), OpCodes.CreateUint32ArrayFromHex(["DEADBEEF"]),\n' +
    '  OpCodes.CreateByteArrayFromHex(["0a0B"]), OpCodes.SetByte(0x11223344, 1, 0xAB), OpCodes.BytesToChars([72, 105]), OpCodes.SecureRandomBytes(5).length, OpCodes.SecureRandomBytes(0).length]; }';
  // Given 64-bit, short and 0x-prefixed hex, a byte index of 1, and counts 5 and 0 (boundary)
  return expectOutput(runPython(js,
    'r = f()\nprint([list(p) for p in r[0]], list(r[1]), list(r[2]), hex(r[3]), r[4], r[5], r[6])\n' +
    'for bad in (["0xZZ"], [""]):\n    try:\n        OpCodes.CreateUint64ArrayFromHex(bad)\n    except Exception as e:\n        print("refused", bad)\n' +
    'try:\n    OpCodes.SecureRandomBytes(-1)\nexcept Exception as e:\n    print(e)'),
  ['[[19088743, 2309737967], [0, 255]] [3735928559] [10, 11] 0x1122ab44 Hi 5 0',
    "refused ['0xZZ']", "refused ['']", 'SecureRandomBytes: count must be a non-negative integer']);
});

check('opcodes: array results grow on a write past their end, like a JS array', () => {
  const js = 'function f() { const a = OpCodes.CreateArray(0, 0); a[2] = 5; const b = OpCodes.CopyArray([1]); b[1] = 2; return [a, b]; }';
  // Given an empty CreateArray and a CopyArray
  // When written one and three past their end
  return expectOutput(runPython(js, 'print([list(x) for x in f()])'), ['[[0, 0, 5], [1, 2]]']);
});

// ---------------------------------------------------------------------------
// Member names: one escaping at declaration, read and write
// ---------------------------------------------------------------------------
check('names: fields and methods named like Python builtins keep one spelling everywhere', () => {
  const js = 'class St { constructor() { this.round = 2; this.file = [7]; } hash() { return this.round * 10; } }\n' +
    'class Use { run(state) { const r = state.round; const f = state.file || []; return r + f[0] + state.hash(); }\n' +
    '  bump(state) { state.round += 1; return state && state.round; } }';
  // Given fields `round`/`file` and a method `hash` (Python builtin names)
  // When they are declared on one class and read and written through another
  // Then every access uses the same attribute name
  const code = transpile(js);
  expectNoMatch(code, /\.(round|file|hash)_\b/, 'a builtin-escaped attribute name');
  return expectOutput(runPython(js, 's = St()\nu = Use()\nprint(u.run(s), u.bump(s), s.round)'), ['29 3 3']);
});
check('names: a local that folds onto a function name does not shadow the function', () => {
  const js = 'function Drbg(e) { return { v: e }; }\nfunction use(seed) { const drbg = Drbg(seed); return drbg.v + 1; }';
  // Given `const drbg = Drbg(seed)` (both fold to `drbg`)
  // Then the call still reaches the function: no "cannot access local variable"
  return expectOutput(runPython(js, 'print(use(4))'), ['5']);
});
check('names: two functions folding to one snake_case name stay two functions', () => {
  const js = 'function fFunc(x) { return x + 1; }\nfunction FFunc(x, k) { return x * k; }\nfunction use() { return [fFunc(2), FFunc(2, 5)]; }';
  // Given fFunc and FFunc (both fold to f_func)
  return expectOutput(runPython(js, 'print(list(use()))'), ['[3, 10]']);
});
check('names: a length field of a class is a field, not an array truncation', () => {
  const js = 'class Reg { constructor() { this.length = 0; this.buf = null; } }\n' +
    'function make(n, words) { const reg = new Reg(); reg.length = n; reg.buf = words; return reg; }';
  // Given `reg.length = n` on a class instance (IL type Reg)
  return expectOutput(runPython(js, 'r = make(3, [1, 2])\nprint(r.length, list(r.buf))'), ['3 [1, 2]']);
});
check('names: an enum member the runtime does not list reads as undefined', () => {
  const js = 'function c() { return [CountryCode.BG, CountryCode.US]; }';
  // Given a country code missing from the runtime's CountryCode (BG)
  // Then it is None like JavaScript's undefined, not an AttributeError
  return expectOutput(runPython(js, 'print(list(c()))'), ["[None, 'US']"]);
});
check('names: a Python keyword used as a member name is escaped the same way everywhere', () => {
  const js = 'class K { constructor() { this.lambda = 1; } get from() { return this.lambda + 1; } }\n' +
    'function f(k) { k.lambda = 5; return k.from + k.lambda; }';
  return expectOutput(runPython(js, 'print(f(K()))'), ['11']);
});

// ---------------------------------------------------------------------------
// Function expressions whose body is not one expression
// ---------------------------------------------------------------------------
check('lambda: a block-bodied arrow argument keeps every statement', () => {
  const js = 'function each(items, fn) { for (const x of items) fn(x); }\n' +
    'function collect(items) { const out = []; let sum = 0;\n' +
    '  each(items, x => { out.push(x * 2); sum += x; });\n' +
    '  each(items, x => { if (x > 1) out.push(-x); });\n' +
    '  return [out, sum]; }';
  // Given an arrow with two statements and one with a single if statement
  // When it is passed as an argument and called
  // Then every statement runs, including the update of the enclosing local
  return expectOutput(runPython(js, 'r = collect([1, 2])\nprint(list(r[0]), r[1])'), ['[2, 4, -2] 3']);
});
check('lambda: an expression-bodied arrow that assigns still assigns', () => {
  const js = 'class Box { constructor() { this.v = 0; } setter() { return x => this.v = x; } }';
  // Given `x => this.v = x`
  // When the returned function is called
  // Then the field is written and the assigned value returned
  return expectOutput(runPython(js, 'b = Box()\nf = b.setter()\nprint(f(7), b.v)'), ['7 7']);
});
check('lambda: a single-return arrow stays a lambda', () => {
  const code = transpile('function twice(xs) { return xs.map(x => { return x * 2; }); }\nfunction apply(f) { return f(1); }\nfunction g() { return apply(y => { return y + 1; }); }');
  expectMatch(code, /apply\(lambda y: y \+ 1\)/, 'apply(lambda y: y + 1)');
  expectNoMatch(code, /def _fn_\d+/, 'a hoisted helper');
});

// ---------------------------------------------------------------------------
// Side effects in value positions
// ---------------------------------------------------------------------------
check('side effects: postfix update in an initializer, a subscript and a return', () => {
  const js = 'function a(next, len) { const c = next[len]++; return [c, next[len]]; }\n' +
    'function r(reader, body) { const token = body[reader.pos++]; return [token, reader.pos]; }\n' +
    'function s(st, v) { return st.top = v + 1; }\n' +
    'function p(n) { return n++; }';
  // Given `x = y++`, `body[o.p++]` on an object field, `return o.f = v` and `return n++`
  // When run
  // Then the old value is used, the update happens once, and the assignment is kept
  const code = transpile(js);
  expectNoMatch(code, /getattr\([^)]*\)\s*\+=/, 'an augmented assignment to getattr(...)');
  return expectOutput(runPython(js,
    'print(list(a([5, 7], 1)))\nclass R: pass\nrd = R()\nrd.pos = 1\nprint(list(r(rd, [10, 20, 30])))\n' +
    'class S: pass\nst = S()\nprint(s(st, 4), st.top)\nprint(p(3))'),
  ['[7, 8]', '[20, 2]', '5 5', '3']);
});

check('side effects: ++/-- in subscripts follow JavaScript evaluation order', () => {
  const js = 'function f(k) { let o = 0; const r = [k[o++], k[o++], k[o++], k[o]]; const s = k[++o] + k[o];\n' +
    '  let p = 4; const q = k[p--] * 10 + k[p]; return [r, s, q, o, p]; }\n' +
    'function g() { let si = 0; const out = []; function put(v) { out[si++] = v; } put(5); put(6); return [out, si]; }';
  // Given several postfix reads then a plain read of the same index, prefix and postfix decrement,
  // and an increment of a variable of the enclosing function
  // Then every read sees the value JavaScript sees and the closure updates the outer variable
  return expectOutput(runPython(js, 'print(f([1, 2, 3, 4, 5, 6]))\nprint(g())'),
    ['[[1, 2, 3, 4], 10, 54, 4, 3]', '[[5, 6], 2]']);
});

// ---------------------------------------------------------------------------
// switch lowering
// ---------------------------------------------------------------------------
check('switch: braced case bodies and a break nested in an if leave only the switch', () => {
  const js = 'function sw(v, x) { let r = 0;\n' +
    '  switch (v) { case "a": r = 1; break; case "b": { r = 2; if (x) break; r = 3; break; } case "c": { const q = x + 1; r = q; break; } default: r = 9; }\n' +
    '  return r; }\n' +
    'function loop(n) { let s = 0;\n' +
    '  for (let i = 0; i < n; i++) { switch (i % 3) { case 0: if (i > 3) break; s += 1; break; case 1: continue; default: s += 100; } s += 10; }\n' +
    '  return s; }';
  // Given a nested break (no loop), and a nested break plus a continue inside a for loop
  // Then the results match JavaScript (1 2 3 5 9 252)
  return expectOutput(runPython(js, 'print(sw("a", 0), sw("b", 1), sw("b", 0), sw("c", 4), sw("z", 0), loop(8))'), ['1 2 3 5 9 252']);
});
check('switch: a continue inside a switch still advances a while-lowered for loop', () => {
  const js = 'function f(n) { let s = 0; for (let i = 0, j = 0; i < n; i++, j += 2) { switch (i) { case 1: continue; default: s += j; } } return s; }';
  // Given a two-variable for loop (lowered to while) whose switch continues
  // Then the update clause still runs: no endless loop, JS result 0+4+6 = 10 for n = 4
  return expectOutput(runPython(js, 'print(f(4))'), ['10']);
});

// ---------------------------------------------------------------------------
// IL nodes with no Python transform before
// ---------------------------------------------------------------------------
check('il: Math.trunc, Math.clz32 and padStart/padEnd with a multi-character pad', () => {
  const js = 'function f(x, s) {\n  /** @type {int32} */\n  const t = Math.trunc(x / 3);\n  /** @type {int32} */\n  const z = Math.clz32(x);\n' +
    '  return [t, z, Math.clz32(0), Math.trunc(-7 / 2), s.padStart(7, "ab"), s.padEnd(5, "0"), s.padStart(2, "x"), s.padStart(5)]; }';
  // Given zero (clz32 boundary), a negative quotient, a pad string longer than one character and a target shorter than the string
  const code = transpile(js);
  expectNoMatch(code, /UNHANDLED_EXPRESSION/, 'an unhandled IL node');
  return expectOutput(runPython(js, 'print(f(100, "abc"))'), ["[33, 25, 32, -3, 'abababc', 'abc00', 'abc', '  abc']"]);
});

// ---------------------------------------------------------------------------
// JavaScript globals
// ---------------------------------------------------------------------------
check('globals: ArrayBuffer.isView, Array(n) without new, and TestCase as a base class', () => {
  const js = 'const { TestCase } = AlgorithmFramework;\n' +
    'class MyCase extends TestCase { constructor(i, e) { super(i, e, "t", "u"); this.extra = 1; } }\n' +
    'function g(d) { const a = Array(3); const b = Array("x"); return [ArrayBuffer.isView(d), ArrayBuffer.isView([1]), a.length, b[0]]; }';
  // Given a typed array and a plain array, a numeric and a string Array() argument
  return expectOutput(runPython(js,
    'print(g(JSUint8Array(2)))\nc = MyCase([1], [2])\nprint(isinstance(c, TestCase), list(c.input), c.extra)'),
  ["[True, False, 3, 'x']", 'True [1] 1']);
});

// ---------------------------------------------------------------------------
// Bitwise NOT follows the IL type
// ---------------------------------------------------------------------------
check('not: ~ on a BigInt array element keeps 64 bits, on a Number masks to 32', () => {
  const js = '/** @param {BigInt[]} v @param {uint32} x */\nfunction f(v, x) { v[0] = ~v[0]; return [v[0] & 0xffffffffffffffffn, (~x) & 0xFF]; }';
  // Given a BigInt[] element (no BigInt literal next to the ~) and a uint32
  return expectOutput(runPython(js, 'r = f([5], 5)\nprint(hex(r[0]), r[1])'), ['0xfffffffffffffffa 250']);
});

check('double: float64 arithmetic past 2^53 rounds like a JS Number, below it stays an exact int', () => {
  const js = 'function lcg(state) {\n  /** @type {float64} */\n  const M = 1103515245;\n  /** @type {float64} */\n  const p = M * state + 12345;\n  return [OpCodes.ToUint32(p), p % 7]; }\n' +
    'function small(a) {\n  /** @type {float64} */\n  const s = a * 3 + 1;\n  return [1, 2, 3, 4, 5][s]; }';
  // Given a product above 2^53 (state = 0xFFFFFFFF) and one below it used as an index
  // Then the results equal the JavaScript ones
  const want = (() => { const M = 1103515245; const p = M * 0xFFFFFFFF + 12345; return `[${p >>> 0}, ${p % 7}] 5`; })();
  return expectOutput(runPython(js, 'print(list(lcg(0xFFFFFFFF)), small(1))'), [want]);
});

// ---------------------------------------------------------------------------
// Byte arrays are mutable
// ---------------------------------------------------------------------------
check('bytes: hex, ANSI and typed-array constructors give mutable arrays', () => {
  const js = 'function f() { const h = OpCodes.Hex8ToBytes("0a0b"); h[0] ^= 1;\n' +
    '  const a = OpCodes.AnsiToBytes("A\\u00e9"); a[1] = 7;\n' +
    '  const u = new Uint8Array([1, 2]); u[0] = 44;\n' +
    '  const w = new Uint32Array([1, 2]); w[1] = 0x12345678;\n' +
    '  return [h, a, u, w]; }';
  // Given hex text, a non-ASCII char (masked to 7 bits by AnsiToBytes) and typed-array literals
  // When each result is written to
  // Then no "'bytes' object does not support item assignment"
  return expectOutput(runPython(js, 'print([list(x) for x in f()])'), ['[[11, 11], [65, 7], [44, 2], [1, 305419896]]']);
});

// ---------------------------------------------------------------------------
// Number semantics
// ---------------------------------------------------------------------------
check('literal: an integer past 2^53 and the 64-bit Unpack mask keep their exact value', () => {
  const js = '/** @param {uint64} n */\nfunction f(n) { /** @type {float64} */ const big = 18446744073709551616; return [OpCodes.Unpack64BE(n * 8), big]; }';
  // Given 2^64 as a Number literal (JS prints it 18446744073709552000) and a 64-bit unpack
  const code = transpile(js);
  expectNoMatch(code, /18446744073709552000/, 'a rounded decimal spelling of 2^64');
  // Then the unpacked bytes are not masked by a wrong constant, and the literal is 2^64
  return expectOutput(runPython(js, 'r = f(4)\nprint(list(r[0]), r[1] == 2 ** 64)'), ['[0, 0, 0, 0, 0, 0, 0, 32] True']);
});

check('truthiness: an array-typed value is true even when empty, false only when null', () => {
  const js = '/** @param {uint8[]|null} a */\nfunction f(a) { let r = a ? 1 : 0; if (a) r += 10; if (!a) r += 100; while (a) { r += 1000; break; } return r; }';
  // Given an empty array, a filled one and None
  // Then the empty array tests true like in JavaScript
  return expectOutput(runPython(js, 'print(f([]), f([1]), f(None))'), ['1011 1011 100']);
});

check('cast: OpCodes.ToInt wraps to a signed 32-bit value, from an int or a float', () => {
  const js = '/** @param {uint32} x @param {float64} y */\nfunction f(x, y) { return [OpCodes.ToInt(x), OpCodes.ToInt(y), OpCodes.ToInt(x) < 0]; }';
  // Given 0xFFFFFFFF (boundary of the uint32 range) and the double 2.5e9
  // Then the results are the JavaScript `| 0` values
  return expectOutput(runPython(js, 'print(f(0xFFFFFFFF, 2.5e9), f(5, 7.9))'), ['[-1, -1794967296, True] [5, 7, False]']);
});

check('bigint: / truncates toward zero and % keeps the dividend sign, exactly past 2^53', () => {
  const js = '/** @param {BigInt} a @param {BigInt} b @returns {BigInt[]} */\nfunction f(a, b) { return [a / b, a % b]; }\n' +
    '/** @returns {BigInt} */\nfunction g() { return (10n ** 30n + 1n) / 3n; }';
  // Given every sign combination and a quotient far above 2^53
  return expectOutput(runPython(js, 'print(f(-7, 2), f(7, -2), f(-7, -2), f(7, 2), g())'),
    ['[-3, -1] [-3, 1] [3, -1] [3, 1] 333333333333333333333333333333']);
});

check('recursion: a call depth beyond Python\'s default limit of 1000 runs as in JavaScript', () => {
  const js = '/** @param {int32} n @returns {int32} */\nfunction depth(n) { return n === 0 ? 0 : 1 + depth(n - 1); }';
  // Given a recursion 3000 calls deep (a 2048-bit recursive gcd needs over 1000)
  return expectOutput(runPython(js, 'print(depth(3000))'), ['3000']);
});

check('reverse: Array.reverse reverses in place, also as a statement, and returns the same array', () => {
  const js = '/** @param {uint8[]} a */\nfunction f(a) { a.reverse(); const b = a.slice().reverse(); return [a, b, b.reverse() === b]; }';
  // Given reverse() as a statement, on a copy, and as a value
  return expectOutput(runPython(js, 'print([list(x) if not isinstance(x, bool) else x for x in f([1, 2, 3])])'), ['[[3, 2, 1], [3, 2, 1], True]']);
});

check('not: !(a && b) and !a === b keep the JavaScript grouping', () => {
  const js = '/** @param {int32} a @param {int32} b */\nfunction f(a, b) { return [!(a > 5 && b < 3), !(a > 5 || b < 3), !a === false, !(a ? b : 0)]; }';
  // Given a negated && and ||, a negation compared with a boolean and a negated ternary
  // Then each truth table row matches JavaScript
  return expectOutput(runPython(js, 'print(f(9, 1), f(9, 9), f(0, 1))'),
    ['[False, False, True, False] [True, False, True, False] [True, False, False, True]']);
});

check('division: a quotient assigned to a float64 keeps its fraction, an int32 one truncates', () => {
  const js = '/** @param {int32} a @param {int32} b */\nfunction f(a, b) {\n  /** @type {float64} */\n  const mean = a / b;\n  /** @type {int32} */\n  const q = a / b;\n  return [mean, q]; }';
  // Given 7 / 2 into a float64 and into an int32
  return expectOutput(runPython(js, 'print(f(7, 2))'), ['[3.5, 3]']);
});

check('division: a quotient pushed onto a float64[] keeps its fraction, onto an int32[] truncates', () => {
  const js = '/** @param {int32} f */\nfunction g(f) {\n  /** @type {float64[]} */\n  const keys = [];\n  /** @type {int32[]} */\n  const slots = [];\n  for (let k = 0; k < f; k++) { keys.push((2 * k + 1) / (2 * f)); slots.push((2 * k + 1) / 2); }\n  return [keys, slots]; }';
  // Given tANS-style claim keys (2k+1)/(2f) and an integer slot list
  return expectOutput(runPython(js, 'r = g(2)\nprint(list(r[0]), list(r[1]))'), ['[0.25, 0.75] [0, 1]']);
});

check('division: a quotient assigned to a float64[] element keeps its fraction', () => {
  const js = '/** @param {int32[]} freq @param {int32} n */\nfunction g(freq, n) {\n  /** @type {float64[]} */\n  const prob = new Array(2);\n  for (let i = 0; i < 2; i++) prob[i] = freq[i] / n;\n  return prob; }';
  // Given Tunstall-style probabilities freq[i] / n
  return expectOutput(runPython(js, 'print(list(g([1, 3], 4)))'), ['[0.25, 0.75]']);
});

check('for: a body that moves the counter or grows the bound runs as JavaScript re-tests it', () => {
  const js = '/** @param {int32[]} a */\nfunction skip(a) { const seen = []; for (let i = 0; i < a.length; ++i) { seen.push(a[i]); if (a[i] === 0) i += 2; } return seen; }\n' +
    '/** @param {int32[]} a */\nfunction grow(a) { for (let i = 0; i < a.length; i++) { if (a[i] > 1) a.push(a[i] - 1); } return a; }\n' +
    '/** @param {int32} n */\nfunction plain(n) { let s = 0; for (let i = 0; i < n; i++) s += i; return s; }';
  // Given a counter advanced inside the body, a worklist grown inside the body and a plain counting loop
  const code = transpile(js);
  expectMatch(code, /for i in range\(0, int\(n\)\)|for i in range\(0, n\)/, 'the plain loop still as range()');
  return expectOutput(runPython(js, 'print(list(skip([5, 0, 7, 8, 9])), list(grow([3])), plain(4))'), ['[5, 0, 9] [3, 2, 1] 6']);
});

check('switch: a default written before other cases still lets them match', () => {
  const js = '/** @param {int32} v @returns {string} */\nfunction f(v) { let r = ""; switch (v) { default: case 0: r = "zero/other"; break; case 1: r = "one"; break; case 2: r = "two"; break; } return r; }';
  // Given `default: case 0:` heading the switch, then the cases 1 and 2
  return expectOutput(runPython(js, 'print(f(0), f(1), f(2), f(7))'), ['zero/other one two zero/other']);
});

check('new: an x++ or ++x constructor argument passes the right value and increments once', () => {
  const js = 'class Rule { constructor(id) { this.id = id; } }\n' +
    'class Grammar { constructor() { this.next = 5; } post() { const r = new Rule(this.next++); return r.id; } pre() { return new Rule(++this.next).id; } }';
  // Given a postfix and a prefix increment as the argument of new
  // Then the code compiles and the ids are 5 then 7, the counter ends at 7
  return expectOutput(runPython(js, 'g = Grammar()\nprint(g.post(), g.pre(), g.next)'), ['5 7 7']);
});

/**
 * PYTHON: run every regression case.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  verbose = Boolean(options.verbose);
  realLog('Python transpile regression suite');
  return cases.run({ verbose });
}

module.exports = { run, transpile, runPython };
