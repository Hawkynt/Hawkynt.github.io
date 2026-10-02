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
