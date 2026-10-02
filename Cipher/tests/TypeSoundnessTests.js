/**
 * TypeSoundnessTests.js - unit tests of the type-soundness checker
 * (TypeSoundness.js): the value predicates of each IL type, the
 * instrumentation (values and line numbers unchanged), the sampling budget,
 * and a whole run over a probe algorithm file. Every case is Given / When /
 * Then and covers equivalence classes, boundaries and the exceptional cases.
 *
 * The SOUNDNESS category: node tests/TranspilerSuite.js --only=soundness
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const TypeSoundness = require('./TypeSoundness.js');
const { createCases } = require('./UnitCases.js');

const cases = createCases();
const test = cases.case;
const CIPHER_ROOT = path.join(__dirname, '..');

function equal(actual, expected, what = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}expected ${e}, got ${a}`);
}
/** The mismatch kind of a value under a type (null: it fits). */
const kind = (type, value) => TypeSoundness.checkerFor(type)(value);

// ---------------------------------------------------------------- integers
test('uint8: given 0 and 255 (the boundaries), when checked, then both fit', () => {
  equal([kind('uint8', 0), kind('uint8', 255)], [null, null]);
});
test('uint8: given 256 and -1 (one past each boundary), when checked, then above-range and negative', () => {
  equal([kind('uint8', 256), kind('uint8', -1)], ['above-range', 'negative']);
});
test('uint8: given 1.5, NaN and Infinity, when checked, then fraction, nan and infinite', () => {
  equal([kind('uint8', 1.5), kind('uint8', NaN), kind('uint8', Infinity)], ['fraction', 'nan', 'infinite']);
});
test('uint8: given a BigInt, a boolean, a string, null and an array, when checked, then each names its kind', () => {
  equal([kind('uint8', 1n), kind('uint8', true), kind('uint8', '1'), kind('uint8', null), kind('uint8', [1])],
    ['bigint', 'boolean', 'string', 'nullish', 'array']);
});
test('int32: given -2^31 and 2^31-1, when checked, then both fit; one beyond each, then below-range and above-range', () => {
  equal([kind('int32', -0x80000000), kind('int32', 0x7FFFFFFF), kind('int32', -0x80000001), kind('int32', 0x80000000)],
    [null, null, 'below-range', 'above-range']);
});
test('uint32: given 2^32-1, when checked, then it fits; 2^32, then above-range', () => {
  equal([kind('uint32', 0xFFFFFFFF), kind('uint32', 0x100000000)], [null, 'above-range']);
});
test('int8/int16/uint16: given their boundaries, when checked, then they fit and one past does not', () => {
  equal([kind('int8', -128), kind('int8', 128), kind('int16', -32768), kind('int16', 32768), kind('uint16', 65535), kind('uint16', 65536)],
    [null, 'above-range', null, 'above-range', null, 'above-range']);
});
test('aliases: given byte, word, dword, int, bool, double, when checked, then they mean their IL types', () => {
  equal([kind('byte', 256), kind('word', 65536), kind('dword', -1), kind('int', 0x80000000), kind('bool', 0), kind('double', 'x')],
    ['above-range', 'above-range', 'negative', 'above-range', 'number', 'string']);
});

// ---------------------------------------------------------------- 64-bit and BigInt
test('uint64: given 2^64-1n, 0n and the Number 2^53, when checked, then all fit (either representation)', () => {
  equal([kind('uint64', 2n ** 64n - 1n), kind('uint64', 0n), kind('uint64', 2 ** 53)], [null, null, null]);
});
test('uint64: given 2^64n and -1n, when checked, then above-range and negative', () => {
  equal([kind('uint64', 2n ** 64n), kind('uint64', -1n)], ['above-range', 'negative']);
});
test('int64: given -2^63n and 2^63n, when checked, then the first fits and the second is above-range', () => {
  equal([kind('int64', -(2n ** 63n)), kind('int64', 2n ** 63n)], [null, 'above-range']);
});
test('bigint/BigInt: given 5n and 5, when checked, then the BigInt fits and the Number is a number where a BigInt flows', () => {
  equal([kind('bigint', 5n), kind('BigInt', 5)], [null, 'number']);
});

// ---------------------------------------------------------------- other primitives
test('boolean, string, float64, number: given matching values, when checked, then they fit', () => {
  equal([kind('boolean', false), kind('string', ''), kind('float64', 0.5), kind('number', -3)], [null, null, null, null]);
});
test('boolean: given 0, when checked, then a number where a boolean is declared', () => {
  equal(kind('boolean', 0), 'number');
});
test('string: given null, when checked, then it fits (a reference)', () => {
  equal(kind('string', null), null);
});
test('number: given a BigInt, when checked, then a BigInt where a Number is declared', () => {
  equal(kind('number', 1n), 'bigint');
});
test('class and unknown types: given KeySize or object, when a checker is asked for, then there is none', () => {
  equal([TypeSoundness.checkerFor('KeySize'), TypeSoundness.checkerFor('object'), TypeSoundness.checkerFor('')], [null, null, null]);
});

// ---------------------------------------------------------------- arrays
test('uint8[]: given a Uint8Array, a byte array, an empty array and null, when checked, then all fit', () => {
  equal([kind('uint8[]', new Uint8Array(4)), kind('uint8[]', [0, 255]), kind('uint8[]', []), kind('uint8[]', null)], [null, null, null, null]);
});
test('uint8[]: given a Uint32Array, when checked, then typed-array-kind (another type in a typed language)', () => {
  equal(kind('uint8[]', new Uint32Array(4)), 'typed-array-kind');
});
test('uint8[]: given [1, 300], when checked, then element-above-range', () => {
  equal(kind('uint8[]', [1, 300]), 'element-above-range');
});
test('uint8[]: given new Array(4) (holes), when checked, then it fits; given [undefined], then element-nullish', () => {
  equal([kind('uint8[]', new Array(4)), kind('uint8[]', [undefined])], [null, 'element-nullish']);
});
test('uint8[]: given a string or an ArrayBuffer, when checked, then string and array-buffer', () => {
  equal([kind('uint8[]', 'abc'), kind('uint8[]', new ArrayBuffer(4))], ['string', 'array-buffer']);
});
test('uint8[][]: given [[1], [2, 256]], when checked, then the nested element mismatch is found', () => {
  equal(kind('uint8[][]', [[1], [2, 256]]), 'element-above-range');
});
test('Uint8Array: given a plain array, when checked, then plain-array', () => {
  equal(kind('Uint8Array', [1]), 'plain-array');
});
test('arrays: given 1000 bytes with 300 last (boundary of the sample), when checked, then it is found', () => {
  const a = new Array(1000).fill(1);
  a[999] = 300;   // the sample is spread over the array, first and last element included
  equal(kind('uint8[]', a), 'element-above-range');
});

// ---------------------------------------------------------------- instrumentation
/** Parse, collect and instrument a snippet; returns { code, sites }. */
function instrumented(source) {
  const parsed = TypeSoundness.parseSource(source);
  if (parsed.error) throw new Error(parsed.error);
  const sites = TypeSoundness.collectSites(parsed.parser, parsed.ast);
  return { code: TypeSoundness.instrument(parsed.parser.normalizedCode, sites, '__tsUnit'), sites };
}
/** Run instrumented code with a recorder; returns { result, recorder }. */
function runInstrumented(source, entry) {
  const { code, sites } = instrumented(source);
  const recorder = TypeSoundness.createRecorder(sites);
  const sandbox = { __tsUnit: recorder, OpCodes: require(path.join(CIPHER_ROOT, 'OpCodes.js')) };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return { result: vm.runInContext(entry, sandbox), recorder, sites };
}

test('instrument: given a file, when instrumented, then it has the same number of lines', () => {
  const source = '/** @param {uint8} a\n * @param {uint8} b */\nfunction f(a, b) {\n  let x = a;\n  x = x + b;\n  return x;\n}\n';
  equal(instrumented(source).code.split('\n').length, source.split('\n').length);
});
test("instrument: given a leading 'use strict', when instrumented, then the directive still opens the file", () => {
  const { code } = instrumented("'use strict';\n/** @param {uint8} a */\nfunction f(a) { const x = a; return x; }\n");
  if (!/^'use strict';/.test(code)) throw new Error(code.slice(0, 60));
});
test('instrument: given assignments, updates, returns and nesting, when run, then every value is unchanged', () => {
  const source = '/** @param {uint32[]} w */\nfunction f(w) {\n  let s = 0;\n  for (let i = 0; i < w.length; i++) { s = s + w[i]; w[i] = s; }\n  let j = 5;\n  const k = j++ + ++j;\n  return [s, k, j, w.join()];\n}\n';
  const { result } = runInstrumented(source, 'f([1, 2, 3])');
  equal(Array.from(result), [6, 12, 7, '1,3,6']);
});
test('recorder: given a uint8 site holding 300, when run, then one mismatch with the value is recorded', () => {
  const { recorder, sites } = runInstrumented('/** @param {uint8} a */\nfunction f(a) {\n  /** @type {uint8} */\n  let x = a;\n  x = x + 200;\n  return x;\n}\n', 'f(100)');
  const failures = [...recorder.failures.entries()].map(([key, f]) => {
    const [id, i] = key.split(':').map(Number);
    return `${sites[id].checks[i].role}:${sites[id].checks[i].type}:${[...f.kinds.keys()].join()}:${f.samples.join()}`;
  });
  if (!failures.includes('variable:uint8:above-range:300')) throw new Error(failures.join(' | '));
});
test('recorder: given a site past its budget, when hit again, then it is not checked until a new vector re-arms it', () => {
  const { recorder, sites } = runInstrumented('/** @param {uint8} a */\nfunction f(a) { /** @type {uint8} */ const x = a; return x; }\nfunction g() { let t = 0; for (let i = 0; i < 300; ++i) t = t + f(1); return t; }\n', 'g()');
  const id = sites.findIndex(s => s.checks.some(c => c.type === 'uint8' && c.role === 'variable'));
  equal(recorder.hits[id], 256, 'checked values ');
  recorder.rearm();
  equal(recorder.budget[id], 16, 'budget after re-arming ');
});
test('collectSites: given a variable re-typed by a later assignment, when collected, then its target type is the declarator\'s', () => {
  const parsed = TypeSoundness.parseSource('/** @param {uint8} a\n * @param {uint32} b */\nfunction f(a, b) {\n  let x = b;\n  x = a;\n  x = OpCodes.Shl32(x, 8);\n  return x;\n}\n');
  const sites = TypeSoundness.collectSites(parsed.parser, parsed.ast);
  const shl = sites.find(s => s.line === 6 && s.mode === 'assign');
  equal(shl.checks.find(c => c.role === 'variable').type, 'uint32');
});
test('collectSites: given this.tests = [...], when collected, then the test vectors have no sites', () => {
  const parsed = TypeSoundness.parseSource('class A extends HashFunctionAlgorithm { constructor() { super(); this.tests = [{ input: [1], expected: [2] }]; } }');
  equal(TypeSoundness.collectSites(parsed.parser, parsed.ast).filter(s => s.line === 1 && /tests/.test(String(s.range))).length, 0);
});

// ---------------------------------------------------------------- a whole file
/** Write a probe algorithm (a hash whose Result holds 300 in a uint8) to a temp dir. */
function writeProbe(dir, name, body) {
  const file = path.join(dir, `${name}.js`);
  fs.writeFileSync(file, `(function (root, factory) {
  module.exports = factory(require(${JSON.stringify(path.join(CIPHER_ROOT, 'AlgorithmFramework.js'))}), require(${JSON.stringify(path.join(CIPHER_ROOT, 'OpCodes.js'))}));
})(this, function (AlgorithmFramework, OpCodes) {
  'use strict';
  const { RegisterAlgorithm, CategoryType, HashFunctionAlgorithm, IHashFunctionInstance } = AlgorithmFramework;
  class Probe extends HashFunctionAlgorithm {
    constructor() {
      super();
      this.name = ${JSON.stringify(name)};
      this.category = CategoryType.HASH;
      this.tests = [{ text: 'probe', uri: '', input: [200, 100], expected: [44] }];
    }
    CreateInstance(isInverse = false) { return isInverse ? null : new ProbeInstance(this); }
  }
  class ProbeInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint8[]} */
      this.data = [];
    }
    Feed(data) { for (let i = 0; i < data.length; ++i) this.data.push(data[i]); }
    Result() {
${body}
    }
  }
  RegisterAlgorithm(new Probe());
  return { Probe };
});
`);
  return file;
}

test('checkFile: given a probe whose uint8 sum reaches 300, when checked, then the site is reported with line, expression and value', async () => {
  const TestEngine = require('./TestEngine.js');
  await TestEngine.LoadDependencies(true, false);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soundness-'));
  try {
    const file = writeProbe(dir, 'TypeSoundnessProbeA', '      /** @type {uint8} */\n      let sum = 0;\n      for (let i = 0; i < this.data.length; ++i) sum = sum + this.data[i];\n      return [OpCodes.And32(sum, 0xFF)];');
    const r = await TypeSoundness.checkFile(file);
    equal(r.error, null, 'error ');
    const m = r.mismatches.find(x => x.role === 'variable' && x.type === 'uint8');
    if (!m) throw new Error(JSON.stringify(r.mismatches));
    equal([m.line, m.expression, m.kind, m.origin, m.observed[0]], [25, 'sum = sum + this.data[i]', 'above-range', 'local-jsdoc', '300']);
    equal(global.AlgorithmFramework.Find('TypeSoundnessProbeA'), null, 'the copy left the registry ');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('checkFile: given a probe that keeps its sum in a uint32, when checked, then nothing is reported', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soundness-'));
  try {
    const file = writeProbe(dir, 'TypeSoundnessProbeB', '      /** @type {uint32} */\n      let sum = 0;\n      for (let i = 0; i < this.data.length; ++i) sum = sum + this.data[i];\n      return [OpCodes.And32(sum, 0xFF)];');
    const r = await TypeSoundness.checkFile(file);
    equal([r.error, r.mismatches.length, r.hitSites > 0], [null, 0, true]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('checkFile: given a file the transpiler cannot parse, when checked, then an unparsed error and no mismatches', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'soundness-'));
  try {
    const file = path.join(dir, 'broken.js');
    fs.writeFileSync(file, 'function (');
    const r = await TypeSoundness.checkFile(file);
    if (!/^unparsed/.test(r.error)) throw new Error(String(r.error));
    equal(r.mismatches.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * SOUNDNESS: run every type-soundness checker case.
 * @param {object} options - { verbose }
 * @returns {Promise<object>} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  console.log('Type soundness checker tests');
  return cases.runAsync(options);
}

module.exports = { run };
