/**
 * CTranspileRegressions.js - regression tests for systematic C and C++
 * transpilation faults (each case names the fault it pins down).
 *
 * Every case is Given (a JavaScript snippet) / When (transpiled, the runtime
 * prelude included) / Then (a driver appended to the generated code prints the
 * expected values once compiled and run). The cases are skipped when the
 * compiler (g++ for C++, gcc for C) is not installed.
 *
 * The C category: node tests/TranspilerSuite.js --only=c [--verbose]
 */

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

const plugins = {};
/** The registered plugin of a language file, loaded afresh once (CODEGEN clears the registry). */
function pluginFor(file, extension) {
  if (plugins[file]) return plugins[file];
  const resolved = require.resolve(path.join(CIPHER_DIR, 'codingplugins', file));
  delete require.cache[resolved];
  const found = () => LanguagePlugins.GetAll().find(p => p.extension === extension);
  if (!found()) quiet(() => require(resolved));
  return (plugins[file] = found());
}

const NAMESPACE = 'regression';
const CLASS_NAME = 'Case';

/**
 * @param {object} plugin - language plugin
 * @param {string} js - JavaScript source
 * @returns {string} the generated code
 */
function transpile(plugin, js) {
  return quiet(() => {
    const ast = new TypeAwareJSASTParser(js).parse();
    const result = plugin.GenerateFromAST(ast, { namespace: NAMESPACE, className: CLASS_NAME, generateTestHarness: false });
    if (!result.success) throw new Error(result.error || 'transpile failed');
    return result.code;
  });
}

const compilers = {};
/** @returns {boolean} whether the compiler is installed */
function hasCompiler(name) {
  if (compilers[name] === undefined) {
    const probe = spawnSync(name, ['--version'], { encoding: 'utf-8' });
    compilers[name] = probe.status === 0;
  }
  return compilers[name];
}

/**
 * Compile the transpiled code with a driver appended and run it.
 * @param {string} js - JavaScript source
 * @param {string} driver - C++ statements of main(); the transpiled namespace is in scope
 * @returns {string|'skip'} trimmed stdout, or 'skip' without g++
 */
function runCpp(js, driver) {
  if (!hasCompiler('g++')) return 'skip';
  const code = transpile(pluginFor('cpp.js', 'cpp'), js) +
    `\n#include <iostream>\nstatic void print(const js::String& s) { std::cout << js::toUtf8(s.s()) << std::endl; }\n` +
    `template <class T> static void print(const T& v) { print(js::str(v)); }\n` +
    `int main() {\n  js::runModuleInits();\n  using namespace ${NAMESPACE}_${CLASS_NAME};\n  try {\n${driver}\n  } catch (js::Throw& t) { print(js::String(u"threw: " + js::describe(t.value))); }\n  return 0;\n}\n`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpp-regression-'));
  try {
    const file = path.join(dir, 'probe.cpp');
    const exe = path.join(dir, 'probe.exe');
    fs.writeFileSync(file, code);
    const build = spawnSync('g++', [file, '-std=gnu++20', '-O0', '-fwrapv', '-w', '-o', exe], { encoding: 'utf-8', timeout: 180000 });
    if (build.status !== 0)
      throw new Error(`g++ failed: ${(build.stderr || '').split('\n').filter(l => /error/.test(l)).slice(0, 3).join(' | ')}${verbose ? '\n' + code : ''}`);
    const run = spawnSync(exe, [], { encoding: 'utf-8', timeout: 60000 });
    if (run.status !== 0) throw new Error(`the program exited ${run.status}: ${(run.stderr || '').trim().slice(0, 300)}`);
    return run.stdout.trim();
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp dir cleanup is best effort */ }
  }
}

const cases = require('./UnitCases.js').createCases();
function check(name, fn) { cases.case(name, fn); }
function expectOutput(out, lines) {
  if (out === 'skip') return 'skip';
  const want = lines.join('\n');
  if (out.replace(/\r/g, '') !== want) throw new Error(`expected output\n${want}\ngot\n${out}`);
}

// ---------------------------------------------------------------------------
// C++: numbers keep their JavaScript values
// ---------------------------------------------------------------------------
check('C++ numbers: uint32 sums, int32 bitwise results and shifts keep JavaScript values', () => {
  const js = '/** @param {uint32} a @param {uint32} b @returns {uint32} */\nfunction add(a, b) { return (a + b) >>> 0; }\n' +
    '/** @param {uint32} a @param {uint32} b @returns {int32} */\nfunction mix(a, b) { return a ^ b; }\n' +
    '/** @param {int32} a @returns {int32} */\nfunction sar(a) { return a >> 4; }\n' +
    '/** @param {uint32} a @param {uint32} b @returns {float64} */\nfunction wide(a, b) { return a + b; }';
  // Given operands whose sum leaves 32 bits and whose XOR sets the sign bit
  // When the functions run
  // Then the results equal the JavaScript ones
  return expectOutput(runCpp(js, 'print(add(0xFFFFFFFFu, 2u)); print(mix(0x80000000u, 1u)); print(sar(-256)); print(wide(0xFFFFFFFFu, 1u));'),
    ['1', '-2147483647', '-16', '4294967296']);
});

check('C++ numbers: division is a double, modulo keeps the dividend sign, BigInt division truncates', () => {
  const js = '/** @param {int32} a @returns {float64} */\nfunction half(a) { return a / 2; }\n' +
    '/** @param {int32} a @param {int32} b @returns {int32} */\nfunction rem(a, b) { return a % b; }\n' +
    '/** @param {BigInt} a @param {BigInt} b @returns {BigInt} */\nfunction bigDiv(a, b) { return a / b; }\n' +
    '/** @param {BigInt} a @returns {BigInt} */\nfunction bigShr(a) { return a >> 3n; }';
  // Given an odd numerator, a negative dividend and negative BigInts
  // Then / gives a fraction, % the JavaScript sign, BigInt / truncates and >> floors
  return expectOutput(runCpp(js, 'print(half(7)); print(rem(-7, 3)); print(bigDiv(js::BigInt(-7), js::BigInt(2))); print(bigShr(js::BigInt(-9)));'),
    ['3.5', '-1', '-3', '-2']);
});

// ---------------------------------------------------------------------------
// C++: arrays
// ---------------------------------------------------------------------------
check('C++ arrays: assigning length empties the array (not a no-op)', () => {
  const js = 'function f() { const a = [1, 2, 3]; a.length = 0; a.push(9); return a; }';
  // Given an array whose length is set to 0
  // When an element is pushed
  // Then it is the only element
  return expectOutput(runCpp(js, 'print(f());'), ['9']);
});

check('C++ arrays: arrays are shared references, slices are copies', () => {
  const js = 'function f() { const a = [1, 2, 3]; const b = a; b[0] = 7; const c = a.slice(1); c[0] = 8; return [a[0], a[1], c[0]]; }';
  // Given an alias and a slice of one array
  // When both are written to
  // Then the alias writes through, the slice does not
  return expectOutput(runCpp(js, 'print(f());'), ['7,2,8']);
});

// ---------------------------------------------------------------------------
// C++: classes and the framework
// ---------------------------------------------------------------------------
check('C++ framework: a block cipher instance inherits Result over whole blocks', () => {
  const js = 'const { IBlockCipherInstance } = AlgorithmFramework;\n' +
    'class Inc extends IBlockCipherInstance {\n' +
    '  constructor(algorithm, isInverse) { super(algorithm); this.isInverse = isInverse; this.BlockSize = 2; this.key = [1]; }\n' +
    '  EncryptBlock(block) { return [block[0] + 1, block[1] + 1]; }\n' +
    '  DecryptBlock(block) { return [block[0] - 1, block[1] - 1]; }\n' +
    '}';
  // Given two blocks fed in two calls
  // When the result is read
  // Then each block is encrypted once, in order
  return expectOutput(runCpp(js, 'auto* c = (new Inc())->__ctor(nullptr, false); c->Feed(js::Array<uint8_t>{1, 2, 3}); c->Feed(js::Array<uint8_t>{4}); print(c->Result());'),
    ['2,3,4,5']);
});

check('C++ classes: an accessor may take another type than it returns', () => {
  const js = 'class K {\n  constructor() { this._k = "A"; }\n' +
    '  /** @param {uint8[]} bytes */\n  set key(bytes) { this._k = String.fromCharCode.apply(null, bytes); }\n' +
    '  /** @returns {string} */\n  get key() { return this._k; }\n}';
  // Given a setter taking bytes and a getter returning a string
  // When bytes are assigned through the dynamic member protocol and read back
  // Then the string of those bytes is returned
  return expectOutput(runCpp(js, 'K* k = (new K())->__ctor(); k->__set(u"key", js::Any(js::Array<uint8_t>{72, 105})); print(k->__get_key());'),
    ['Hi']);
});

check('C++ classes: a top-level function stays callable from a method of the same name', () => {
  const js = 'function Encode(x) { return x + 1; }\n' +
    'class C {\n  Encode(x) { return Encode(x) * 2; }\n}';
  // Given a method calling the top-level function it shares a name with
  // When the method runs
  // Then it calls the function, not itself
  return expectOutput(runCpp(js, 'C* c = (new C())->__ctor(); print(c->Encode(js::Any(3)));'), ['8']);
});

check('C++ framework: metadata may hold strings and numbers where the JSDoc names classes', () => {
  const js = 'const { Algorithm, HashFunctionAlgorithm } = AlgorithmFramework;\n' +
    'class H extends HashFunctionAlgorithm {\n  constructor() { super(); this.name = "H"; this.SupportedOutputSizes = [32]; this.knownVulnerabilities = ["weak"]; }\n}\n' +
    'RegisterAlgorithm(new H());';
  // Given an algorithm listing a number as an output size and a string as a vulnerability
  // When the module initialises
  // Then the algorithm registers instead of throwing
  return expectOutput(runCpp(js, 'print(js::String(js::Find(js::String(u"H")) ? u"registered" : u"missing"));'), ['registered']);
});

check('C++ strings: AnsiToBytes masks to 7 bits, AsciiToBytes to 8', () => {
  const js = 'function f() { return [OpCodes.AnsiToBytes("A\\u00e9"), OpCodes.AsciiToBytes("A\\u00e9")]; }';
  // Given a character above 0x7F
  // Then each conversion masks it as OpCodes.js does
  return expectOutput(runCpp(js, 'auto r = f(); print(r.get(0)); print(r.get(1));'), ['65,105', '65,233']);
});

check('C++ reflection: vector fields reach setters and fields by name, as `in` would', () => {
  const js = 'class Inst {\n  constructor() { this.rounds = 8; this._iv = null; }\n' +
    '  setIV(iv) { this._iv = iv; }\n}';
  // Given a field and a setter method
  // Then __has finds the field and the method, __hasMethod only the method, an unknown name neither
  return expectOutput(runCpp(js, 'Inst* i = (new Inst())->__ctor(); print(i->__has(u"rounds")); print(i->__hasMethod(u"setIV")); print(i->__hasMethod(u"rounds")); print(i->__has(u"nonce"));'),
    ['true', 'true', 'false', 'false']);
});

check('C++ functions as values: a missing argument takes the parameter default', () => {
  const js = 'function count(w, n = w.length) { return n; }\n' +
    'function viaValue() { const fns = [count]; return fns[0]([1, 2, 3]); }';
  // Given a function whose default refers to another parameter, called through a value
  // When the second argument is left out
  // Then the default is evaluated, not zero passed
  return expectOutput(runCpp(js, 'print(viaValue());'), ['3']);
});

/**
 * C: run every regression case.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  verbose = Boolean(options.verbose);
  realLog('C and C++ transpile regression suite');
  return cases.run({ verbose });
}

module.exports = { run, transpile, runCpp };
