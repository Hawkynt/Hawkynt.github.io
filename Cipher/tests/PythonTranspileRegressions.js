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
