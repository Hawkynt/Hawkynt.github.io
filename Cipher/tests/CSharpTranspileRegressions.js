/**
 * CSharpTranspileRegressions.js - regression tests for systematic C#
 * transpilation faults (each case names the fault it pins down).
 *
 * Every case is Given (a JavaScript snippet) / When (transpiled to C#) / Then
 * (the generated code has, or lacks, a specific shape). The runtime-stub cases
 * additionally compile and run a small C# program against the generated
 * framework stubs when the .NET SDK is installed; they are skipped otherwise.
 *
 * The CSHARP category: node tests/TranspilerSuite.js --only=csharp [--verbose] [--no-dotnet]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CIPHER_DIR = path.join(__dirname, '..');
// Options of the current run, set by run()
let verbose = false;
let allowDotnet = true;

// The transpiler logs progress on console.log; keep the suite output readable.
const realLog = console.log;
const quiet = fn => { console.log = () => {}; try { return fn(); } finally { console.log = realLog; } };

const { TypeAwareJSASTParser } = quiet(() => require(path.join(CIPHER_DIR, 'type-aware-transpiler.js')));
const { LanguagePlugins } = require(path.join(CIPHER_DIR, 'codingplugins', 'LanguagePlugin.js'));
// Loaded afresh: an earlier category in the same process (CODEGEN) clears the
// plugin registry, so a cached csharp.js would never register again.
const CSHARP_PLUGIN = require.resolve(path.join(CIPHER_DIR, 'codingplugins', 'csharp.js'));
delete require.cache[CSHARP_PLUGIN];
quiet(() => require(CSHARP_PLUGIN));
const plugin = LanguagePlugins.GetAll().find(p => /c#|csharp/i.test(p.name || '') || p.extension === 'cs');

function transpile(js, withStubs = false) {
  return quiet(() => {
    const ast = new TypeAwareJSASTParser(js).parse();
    const result = plugin.GenerateFromAST(ast, {
      namespace: 'RegressionTest', className: 'Generated',
      generateTestHarness: false, generateFrameworkStubs: withStubs
    });
    if (!result.success) throw new Error(result.error || 'transpile failed');
    return result.code;
  });
}

const cases = require('./UnitCases.js').createCases();
const check = cases.case;
function expectMatch(code, re, what) {
  if (!re.test(code)) throw new Error(`expected ${what} (${re})\n${verbose ? code : ''}`);
}
function expectNoMatch(code, re, what) {
  if (re.test(code)) throw new Error(`did not expect ${what} (${re})\n${verbose ? code : ''}`);
}

// ---------------------------------------------------------------------------
// Parser: contextual keywords are ordinary identifiers
// ---------------------------------------------------------------------------
check('parser: `set` as a const name and a for..of binding', () => {
  const ast = quiet(() => new TypeAwareJSASTParser(
    'function f(sets) { const set = { a: 1 }; let n = set.a; for (const set of sets) n += set; return n; }').parse());
  if (!ast || ast.type !== 'Program') throw new Error('no Program node');
});
check('parser: `get`, `of`, `static`, `async`, `as` as parameter and variable names', () => {
  quiet(() => new TypeAwareJSASTParser(
    'function f(get, of) { const as = get + of; let async = as; const static = async; return static; }').parse());
});
check('parser: class getters/setters still parse as accessors', () => {
  const code = transpile('class A { get size() { return this._s; } set size(v) { this._s = v; } }');
  expectMatch(code, /\bSize\b[\s\S]*\bget\b[\s\S]*\bset\b/, 'a Size property with get and set');
});

// ---------------------------------------------------------------------------
// Module-level bindings are hoisted as PascalCase members
// ---------------------------------------------------------------------------
check('module binding: camelCase const table and arrow helper are referenced by their hoisted names', () => {
  const code = transpile('const sboxTable = [1, 2, 3];\nconst rol = (v, n) => v + n;\nfunction use(i) { return rol(sboxTable[i], 1); }');
  expectMatch(code, /Rol\(SboxTable\[/, 'Rol(SboxTable[...])');
  expectNoMatch(code, /\bsboxTable\b|\brol\(/, 'a camelCase reference');
});
check('module binding: IIFE locals are referenced by their hoisted names', () => {
  const code = transpile('const T = (function () { const phiN = (w) => w + 1; const mix = (x) => phiN(x); return { mix }; })();');
  expectMatch(code, /PhiN\(x/, 'PhiN(x) inside the hoisted Mix');
});
check('module binding: a same-named parameter shadows the module binding (function, arrow, method)', () => {
  const code = transpile('const table = [1, 2];\nconst apply = (table) => table[0];\nfunction g(table) { return table[1]; }\nclass K { run(table) { return table[0]; } }');
  expectNoMatch(code, /Table\[0\] *;|Table\[1\]/, 'a parameter rewritten to the module field');
  expectMatch(code, /table => table\[0\]/, 'the arrow keeps its own parameter');
});

check('IIFE hoisting: two IIFEs with the same local get distinct module names; a shadowing parameter is kept', () => {
  const code = transpile('const A = (() => { const table = [1, 2]; return table; })();\nconst B = (() => { const table = [3, 4]; const f = (table) => table[0]; return f(table); })();');
  expectMatch(code, /\bTable\b[^;]*=/, 'the first hoisted Table');
  expectMatch(code, /\bTable_2\b[^;]*=/, 'the second, renamed Table_2');
  expectMatch(code, /table => table\[0\]/, 'the arrow parameter untouched');
  expectMatch(code, /F\(Table_2\b/, 'the second IIFE reading its own renamed local');
});

// ---------------------------------------------------------------------------
// Locals that camelCase onto a parameter name
// ---------------------------------------------------------------------------
check('scope: `const A = a` next to parameter `a` gets a distinct C# name', () => {
  const code = transpile('function mul(a, b) { const A = a === 0 ? 65536 : a; return A * b; }');
  expectMatch(code, /\ba2\s*=.*\ba\b/, 'a renamed local a2 initialised from a');
  expectMatch(code, /return a2 \*/, 'the renamed local used afterwards');
});
check('scope: loop variable `r` next to parameter `R` does not redeclare it', () => {
  const code = transpile('function f(L, R) { let s = 0; for (let r = 0; r < 8; r++) s += r + R; return s + L; }');
  expectMatch(code, /for \(int r2 = 0; r2 < 8; r2\+\+\)/, 'the loop variable renamed to r2');
  expectMatch(code, /r2 \+ r\b/, 'the loop body reading both r2 and the parameter r');
});

// ---------------------------------------------------------------------------
// Field typing
// ---------------------------------------------------------------------------
check('fields: null-initialised then constructed field takes the class type', () => {
  const code = transpile('class H { constructor() { this._absorber = null; } set key(k) { this._absorber = new BlockAbsorber(64, b => this._p(b)); } _p(b) {} }');
  expectMatch(code, /BlockAbsorber\??\s+_absorber/, 'a BlockAbsorber-typed _absorber');
});
check('fields: object literal assigned behind accessors is dynamic, not byte[]', () => {
  const code = transpile('class R { constructor() { this._publicKey = null; } set publicKey(k) { this._publicKey = k ? k : null; } get publicKey() { return this._publicKey; } gen(n) { this._publicKey = { n: n }; return this._publicKey.n; } }');
  expectMatch(code, /dynamic\??\s+_publicKey/, 'a dynamic _publicKey');
  expectNoMatch(code, /byte\[\]\??\s+_publicKey/, 'a byte[] _publicKey');
});
check('destructuring: object pattern over a scalar-guessed source is held as dynamic', () => {
  const code = transpile('class C { constructor() { this._sched = 0; } run() { const { RK, W } = this._sched; return RK[0] + W[0]; } }');
  expectMatch(code, /dynamic _destructure_\d+ = this\._sched/, 'a dynamic destructuring temp');
});

// ---------------------------------------------------------------------------
// Expression mappings
// ---------------------------------------------------------------------------
check('bigint.toString(radix) uses the ToRadixString helper', () => {
  const code = transpile('function f(q) { const x = BigInt(q) * 3n; return x.toString(2).length; }');
  expectMatch(code, /ToRadixString\(x, 2\)/, 'ToRadixString(x, 2)');
});
check('number.toString(2) still uses Convert.ToString', () => {
  const code = transpile('function f(q) { const n = q | 0; return n.toString(2); }');
  expectMatch(code, /Convert\.ToString\(/, 'Convert.ToString(...)');
});
check('crypto.getRandomValues maps to GetRandomValues and the feature test folds to true', () => {
  const code = transpile('function r(n) { const b = new Uint8Array(n); if (typeof crypto !== "undefined" && crypto.getRandomValues) { crypto.getRandomValues(b); } return b; }');
  expectMatch(code, /GetRandomValues\(b\)/, 'GetRandomValues(b)');
  expectNoMatch(code, /crypto\./, 'a crypto.* member access');
});
check('record.table[i]: the index parameter is an integer, not a string key', () => {
  const code = transpile('class C { f(tabs, round, x) { return x ^ tabs.P16[round]; } g(t) { return this.f(t, 3, 5); } }');
  expectNoMatch(code, /string round/, 'a string-typed round parameter');
});
check('inputBuffer.push(array) appends the bytes (Concat); other arrays keep push-as-element (Append)', () => {
  const code = transpile('class I { constructor() { this.inputBuffer = []; this.rows = []; } Feed(data) { this.inputBuffer.push(data); } add(row) { this.rows.push(row); } }');
  expectMatch(code, /InputBuffer\.Concat\(data\)/, 'InputBuffer.Concat(data)');
  expectNoMatch(code, /Rows\.Concat\(/, 'Rows.Concat(...)');
});
check('dynamic truthiness uses IsTruthy', () => {
  const code = transpile('class K { constructor() { this._k = null; } gen() { this._k = { n: 1 }; } has() { return !this._k; } }');
  expectMatch(code, /!IsTruthy\(this\._k\)/, '!IsTruthy(this._k)');
});
check('runtime-keyed tables: empty `{}` and non-uniform rows become Dictionary<string, dynamic>', () => {
  const code = transpile('const SETS = {};\nconst CURVES = { a: { p: 1, sub: { q: 2 } }, b: 7 };\nfunction get(name) { return SETS[name] || CURVES[name]; }');
  expectMatch(code, /Dictionary<string, dynamic> SETS/, 'SETS as Dictionary<string, dynamic>');
  expectMatch(code, /Dictionary<string, dynamic> CURVES/, 'CURVES as Dictionary<string, dynamic>');
});
check('runtime-keyed tables: numeric key into a string-keyed dictionary is converted with ToString', () => {
  const code = transpile('const KEYS = { 512: { p: "a" }, 1024: { p: "b" } };\nfunction get(size) { const s = size | 0; return KEYS[s].p; }');
  expectMatch(code, /KEYS\[s\.ToString\(\)\]/, 'KEYS[s.ToString()]');
});

// ---------------------------------------------------------------------------
// JSDoc reaches the emitter
// ---------------------------------------------------------------------------
check('jsdoc: a method @param {uint8[]} beats body usage that suggests uint[]', () => {
  const code = transpile('class A {\n  /**\n   * @param {uint8[]} input - bytes\n   * @returns {uint32} value\n   */\n' +
    '  h(input) { return OpCodes.Xor32(OpCodes.Shl32(input[0], 16), input[1]); }\n  g() { return this.h([]); }\n}');
  expectMatch(code, /\bH\(byte\[\] input/, 'H(byte[] input');
});
check('fields: a framework-declared field shadowed by a same-named accessor pair gets its own backing field', () => {
  const code = transpile('class K extends IKdfInstance {\n  constructor(a) { super(a); this.Iterations = 1000; }\n' +
    '  get iterations() { return this.Iterations; }\n  set iterations(v) { this.Iterations = v; }\n}');
  expectMatch(code, /private int _iterations\b/, 'a private _iterations backing field');
  expectNoMatch(code, /this\.Iterations = unchecked/, 'a cast assignment into the accessor itself');
});
check('jsdoc: a width-less @param {Array} does not override body-usage inference', () => {
  const code = transpile('/**\n * @param {Array} a - [low32, high32]\n * @param {Array} b - [low32, high32]\n */\n' +
    'function xor64(a, b) { return [OpCodes.Xor32(a[0], b[0]), OpCodes.Xor32(a[1], b[1])]; }');
  expectMatch(code, /Xor64\(uint\[\] a/, 'Xor64(uint[] a (not byte[])');
});

// ---------------------------------------------------------------------------
// Framework base classes: members are inherited, methods overridden
// ---------------------------------------------------------------------------
check('framework: a subclass inherits inputBuffer and isInverse instead of redeclaring them', () => {
  const code = transpile('class I extends IAlgorithmInstance {\n  constructor(a) { super(a); this.isInverse = false; this.inputBuffer = []; }\n' +
    '  Result() { return this.inputBuffer; }\n}');
  expectNoMatch(code, /\bInputBuffer\s*\{\s*get/, 'a redeclared InputBuffer property');
  expectNoMatch(code, /\bbool\s+IsInverse\b/, 'a redeclared IsInverse property');
  expectMatch(code, /public override byte\[\] Result\(\)/, 'Result overriding the framework method');
});
check('framework: framework methods are overridden, a name the framework lacks is the subclass\'s own', () => {
  const code = transpile('class I extends IBlockCipherInstance {\n  constructor(a) { super(a); this.BlockSize = 2; this.seed = 5; }\n' +
    '  EncryptBlock(block) { return block; }\n  DecryptBlock(block) { return block; }\n}');
  expectMatch(code, /public override byte\[\] EncryptBlock\(byte\[\] block\b/, 'an EncryptBlock override');
  expectMatch(code, /public override byte\[\] DecryptBlock\(byte\[\] block\b/, 'a DecryptBlock override');
  expectNoMatch(code, /\bint\s+BlockSize\s*\{/, 'a redeclared BlockSize');
  expectMatch(code, /\bint\s+Seed\b/, 'the subclass\'s own int Seed');
});
check('framework: CreateInstance() without a parameter still overrides with the framework signature', () => {
  const code = transpile('class A extends BlockCipherAlgorithm {\n  constructor() { super(); this.name = "A"; }\n  CreateInstance() { return new I(this); }\n}\n' +
    'class I extends IBlockCipherInstance { constructor(a) { super(a); } }');
  expectMatch(code, /public override IBlockCipherInstance CreateInstance\(bool unused0 = default\)/, 'the framework CreateInstance signature');
});
check('framework: a module function named like an inherited member is called qualified', () => {
  const code = transpile('function EncryptBlock(b) { return b; }\nclass I extends IBlockCipherInstance {\n' +
    '  constructor(a) { super(a); }\n  Result() { return EncryptBlock(this.inputBuffer); }\n}');
  expectMatch(code, /Generated\.EncryptBlock\(this\.InputBuffer\)/, 'Generated.EncryptBlock(this.InputBuffer)');
});

// ---------------------------------------------------------------------------
// The algorithm registry
// ---------------------------------------------------------------------------
check('registry: every registered algorithm is listed, the first is AlgorithmInstance', () => {
  const code = transpile('class A extends HashFunctionAlgorithm { constructor() { super(); this.name = "A"; } }\n' +
    'class B extends A { constructor() { super(); this.name = "B"; } }\nRegisterAlgorithm(new A());\nRegisterAlgorithm(new B());');
  expectMatch(code, /static readonly Algorithm\[\] Algorithms = new Algorithm\[\] \{ new A\(\), new B\(\) \}/, 'Algorithms = { new A(), new B() }');
  expectMatch(code, /static readonly Algorithm AlgorithmInstance = Algorithms\[0\]/, 'AlgorithmInstance = Algorithms[0]');
});
check('registry: a module-declared algorithmInstance is kept and listed', () => {
  const code = transpile('class A extends HashFunctionAlgorithm { constructor() { super(); this.name = "A"; } }\n' +
    'const algorithmInstance = new A();\nif (!AlgorithmFramework.Find(algorithmInstance.name)) { RegisterAlgorithm(algorithmInstance); }');
  expectMatch(code, /Algorithms = new Algorithm\[\] \{ AlgorithmInstance \}/, 'Algorithms = { AlgorithmInstance }');
  expectNoMatch(code, /AlgorithmInstance = Algorithms\[0\]/, 'a second AlgorithmInstance');
});

check('registry: an algorithm registered through a module helper is listed', () => {
  const code = transpile('class A extends HashFunctionAlgorithm { constructor() { super(); this.name = "A"; } }\n' +
    '/** @param {A} algo - algorithm */\nfunction registerOnce(algo) { if (!AlgorithmFramework.Find(algo.name)) RegisterAlgorithm(algo); }\n' +
    'registerOnce(new A());');
  expectMatch(code, /Algorithms = new Algorithm\[\] \{ new A\(\) \}/, 'Algorithms = { new A() }');
  expectMatch(code, /static void RegisterAlgorithm\(Algorithm algorithm\)/, 'a RegisterAlgorithm method for the helper');
});
check('registry: a dependency transpiled asDependency brings no usings, stubs or Main', () => {
  const code = quiet(() => {
    const ast = new TypeAwareJSASTParser('class D extends HashFunctionAlgorithm { constructor() { super(); this.name = "D"; } }\nRegisterAlgorithm(new D());').parse();
    return plugin.GenerateFromAST(ast, { namespace: 'RegressionTest', className: 'DepGenerated', asDependency: true }).code;
  });
  expectNoMatch(code, /^using /m, 'a using directive');
  expectNoMatch(code, /static void Main\(/, 'a Main method');
  expectNoMatch(code, /class IAlgorithmInstance/, 'the framework stubs');
  expectMatch(code, /Algorithms = new Algorithm\[\] \{ new D\(\) \}/, 'its own registry');
});
check('module bindings: a const the module grows is not readonly (CS0198)', () => {
  const code = transpile('/** @type {uint32[]} */\nconst TABLE = [];\nfunction fill() { TABLE.push(1); }');
  expectNoMatch(code, /readonly uint\[\] TABLE/, 'a readonly TABLE');
});

// ---------------------------------------------------------------------------
// Declarations take their IL type
// ---------------------------------------------------------------------------
check('IL types: a constructor parameter takes its JSDoc class type, not one guessed from its name', () => {
  const code = transpile('class Fancy extends BlockCipherAlgorithm { constructor() { super(); this.rounds = 8; } CreateInstance(inv) { return new I(this); } }\n' +
    'class I extends IBlockCipherInstance {\n  /** @param {Fancy} algorithm - parent */\n  constructor(algorithm) { super(algorithm); this.r = algorithm.rounds; }\n}');
  expectMatch(code, /public I\(Fancy algorithm\)/, 'I(Fancy algorithm)');
});

// ---------------------------------------------------------------------------
// Expression mappings: push
// ---------------------------------------------------------------------------
check('push: every argument of a multi-argument push is appended, in order', () => {
  const code = transpile('/**\n * @param {uint8[]} a - first\n * @param {uint8[]} b - second\n * @returns {uint8[]} joined\n */\n' +
    'function join(a, b) { /** @type {uint8[]} */ const res = []; res.push(...a, ...b); res.push(1, 2); return res; }');
  expectMatch(code, /res = res\.Concat\(a\)\.Concat\(b\)\.ToArray\(\)/, 'res.Concat(a).Concat(b)');
  expectMatch(code, /res = res\.Append\([^;]*1[^;]*\)\.Append\([^;]*2[^;]*\)\.ToArray\(\)/, 'res.Append(1).Append(2)');
});

// ---------------------------------------------------------------------------
// Arrays grown through a parameter
// ---------------------------------------------------------------------------
check('push: an array parameter the callee grows is passed by ref', () => {
  const code = transpile('/**\n * @param {uint8[]} dest - grown\n * @param {uint8} v - value\n */\nfunction emit(dest, v) { dest.push(v); }\n' +
    '/** @returns {uint8[]} bytes */\nfunction build() { /** @type {uint8[]} */ const res = []; emit(res, 1); emit(res, 2); return res; }');
  expectMatch(code, /Emit\(ref byte\[\] dest/, 'Emit(ref byte[] dest, ...)');
  expectMatch(code, /Emit\(ref res,/, 'Emit(ref res, ...)');
});

// ---------------------------------------------------------------------------
// Parameter names
// ---------------------------------------------------------------------------
check('scope: parameters P and p get distinct C# names (CS0100)', () => {
  const code = transpile('/**\n * @param {int32} P - modulus\n * @param {int32} p - value\n * @returns {int32} r\n */\n' +
    'function red(P, p) { return p % P; }');
  expectMatch(code, /Red\(int p, int p2\)/, 'Red(int p, int p2)');
  expectMatch(code, /return p2 % p;/, 'the body reading p2 % p');
});

// ---------------------------------------------------------------------------
// Immediately invoked functions as values
// ---------------------------------------------------------------------------
check('IIFE: a function invoked where a value is expected becomes an invoked typed lambda', () => {
  const code = transpile('/** @returns {int32} sum */\nfunction total() { const i = 2; ' +
    'return i + (function () { /** @type {int32} */ let i = 3; return i; })(); }');
  expectMatch(code, /\(\(Func<int>\)\(\(\) =>/, '((Func<int>)(() => ...');
  expectMatch(code, /\.Invoke\(\)/, '.Invoke()');
  expectNoMatch(code, /Unknown\(/, 'an Unknown() call');
});

// ---------------------------------------------------------------------------
// Operator grouping
// ---------------------------------------------------------------------------
check('grouping: a parenthesized || inside && keeps its parentheses', () => {
  const code = transpile('/**\n * @param {int32} a - a\n * @param {int32} b - b\n * @returns {boolean} r\n */\n' +
    'function f(a, b) { return a > 0 && (b > 0 || b < -5); }');
  expectMatch(code, /a > 0 && \(b > 0 \|\| b < -5\)/, 'a > 0 && (b > 0 || b < -5)');
});

// ---------------------------------------------------------------------------
// BigInteger narrowing
// ---------------------------------------------------------------------------
check('BigInteger: ToQWord keeps the low 64 bits before converting', () => {
  const code = transpile('/**\n * @param {BigInt} x - value\n * @returns {BigInt} low 64 bits\n */\n' +
    'function wrap64(x) { return OpCodes.ToQWord(x * 3n); }');
  expectMatch(code, /& ulong\.MaxValue/, 'a mask with ulong.MaxValue');
});
check('BigInteger: a 64-bit shift of a BigInteger is not cast down to ulong', () => {
  const code = transpile('/**\n * @param {BigInt} x - value\n * @returns {BigInt} shifted\n */\n' +
    'function hi(x) { return OpCodes.XorN(x, OpCodes.ShiftRn(x, 40)); }');
  expectNoMatch(code, /\(ulong\)\(x\)/, 'x cast to ulong');
});

// ---------------------------------------------------------------------------
// Truthiness and mixed-sign arithmetic
// ---------------------------------------------------------------------------
check('truthiness: !bigint compares with zero', () => {
  const code = transpile('/**\n * @param {BigInt} x - value\n * @returns {boolean} zero\n */\nfunction z(x) { return !x; }');
  expectMatch(code, /x == 0/, 'x == 0');
});
check('arithmetic: ulong += int takes the int as ulong (CS0034)', () => {
  const code = transpile('class C {\n  constructor() { /** @type {uint64} */ this.total = 0n; }\n' +
    '  /** @param {int32} n - count */\n  add(n) { this.total += n; }\n}');
  expectMatch(code, /Total \+= unchecked\(\(ulong\)\(n\)\)|Total \+= \(ulong\)\(?n\)?/, 'Total += (ulong)n');
});

// ---------------------------------------------------------------------------
// Fields take their IL type in every declaring pass
// ---------------------------------------------------------------------------
check('IL types: a key backing field keeps its JSDoc class type, not byte[] from its name', () => {
  const code = transpile('class Key { constructor(n) { /** @type {BigInt} */ this.n = n; } }\n' +
    'class R {\n  constructor() { /** @type {Key|null} */ this._publicKey = null; }\n' +
    '  /** @param {Key|null} k - key */\n  set publicKey(k) { this._publicKey = k ? k : null; }\n' +
    '  /** @returns {Key|null} key */\n  get publicKey() { return this._publicKey; }\n}');
  expectMatch(code, /Key\?? _publicKey\b/, 'a Key-typed _publicKey');
  expectMatch(code, /public Key PublicKey\b/, 'a Key-typed PublicKey');
});
check('IL types: a counter field keeps its JSDoc type, not a guess from its name or literal', () => {
  const code = transpile('class C {\n  constructor() { /** @type {int32} */ this.chunk_counter = 0; }\n' +
    '  reset() { /** @type {uint32[]} */ this.state_words = []; this.chunk_counter = 0; }\n}');
  expectMatch(code, /\bint Chunk_counter\b/, 'int Chunk_counter');
  expectMatch(code, /\buint\[\] State_words\b/, 'uint[] State_words');
});

// ---------------------------------------------------------------------------
// Numeric operands
// ---------------------------------------------------------------------------
check('numeric: a float operand of a bitwise operator is truncated as JavaScript does', () => {
  const code = transpile('/**\n * @param {float64} x - value\n * @returns {int32} low byte\n */\nfunction lowByte(x) { return x & 255; }');
  expectMatch(code, /\(long\)\(x\)\) & 255|\(long\)x & 255/, '(long)x & 255');
});
check('strings: a character read by index into a string local is a string', () => {
  const code = transpile('/**\n * @param {string} s - text\n * @param {int32} i - index\n * @returns {string} char\n */\n' +
    'function at(s, i) { /** @type {string} */ const c = s[i]; return c; }');
  expectMatch(code, /string c = s\[i\]\.ToString\(\);/, 'string c = s[i].ToString();');
});
check('numeric: toFixed formats with a fixed digit count, ArrayBuffer.isView tests for an array', () => {
  const code = transpile('/**\n * @param {float64} x - value\n * @param {uint8[]} d - data\n * @returns {string} text\n */\n' +
    'function show(x, d) { return ArrayBuffer.isView(d) ? x.toFixed(2) : ""; }');
  expectMatch(code, /ToString\("F" \+ 2, System\.Globalization\.CultureInfo\.InvariantCulture\)/, 'ToString("F" + 2, InvariantCulture)');
  expectMatch(code, /d is System\.Array/, 'd is System.Array');
});
check('numeric: the global isNaN tests a double', () => {
  const code = transpile('/**\n * @param {float64} x - value\n * @returns {boolean} not a number\n */\nfunction nan(x) { return isNaN(x); }');
  expectMatch(code, /double\.IsNaN\(/, 'double.IsNaN(...)');
});

// ---------------------------------------------------------------------------
// Framework-typed values
// ---------------------------------------------------------------------------
check('framework: a member the framework type lacks is read through dynamic', () => {
  const code = transpile('class K extends IAlgorithmInstance {\n  /** @param {Algorithm} hash - hash algorithm */\n' +
    '  use(hash) { /** @type {IMacInstance} */ const mac = hash.CreateInstance(false); mac.key = [1, 2]; return mac; }\n}');
  expectMatch(code, /\(dynamic\)\(?mac\)?\)?\)?\.Key/, '((dynamic)mac).Key');
  expectMatch(code, /\(IMacInstance\)/, 'the created instance cast to IMacInstance');
});

// ---------------------------------------------------------------------------
// Array literals and nullable members take the IL's types
// ---------------------------------------------------------------------------
check('IL types: an array literal passed to a call inside a test vector takes the parameter type', () => {
  const code = transpile('/**\n * @param {int32[]} symbols - symbols\n * @returns {uint8[]} octets\n */\n' +
    'function toOctets(symbols) { return symbols.map(s => s & 255); }\n' +
    'class A extends Algorithm {\n  constructor() { super(); this.tests = [new TestCase(toOctets([0, 1, -1, 0]), [1], "t", "u")]; }\n}');
  expectMatch(code, /ToOctets\(new int\[\] \{ 0, 1, -1, 0 \}\)/, 'ToOctets(new int[] { 0, 1, -1, 0 })');
});
check('IL types: a nullable value-type field is T?, an undefined value-type field becomes default', () => {
  const code = transpile('class C {\n  constructor() { /** @type {int32|null} */ this.size = null; /** @type {int32} */ this.count = undefined; }\n' +
    '  /** @returns {int32} size */\n  get() { return this.size === null ? 0 : this.size; }\n}');
  expectMatch(code, /int\? Size\b/, 'int? Size');
  expectMatch(code, /this\.Count = default/, 'this.Count = default');
});

// ---------------------------------------------------------------------------
// OpCodes helpers
// ---------------------------------------------------------------------------
check('OpCodes.CreateArray: the array has the element type its target is declared with', () => {
  const code = transpile('class C { constructor() { /** @type {BigInt[]} */ this.s = OpCodes.CreateArray(4, 0n); } }');
  expectMatch(code, /CreateArray<BigInteger>\(/, 'CreateArray<BigInteger>(...)');
});

// ---------------------------------------------------------------------------
// Runtime stubs (needs the .NET SDK)
// ---------------------------------------------------------------------------
check('runtime stubs: BlockAbsorber, pad helpers, ToRadixString, IsTruthy, GFMul behave like the JS framework', () => {
  if (!allowDotnet) return 'skip';
  const probe = spawnSync('dotnet', ['--version'], { encoding: 'utf-8' });
  if (probe.status !== 0) return 'skip';

  // A block cipher that relies on the framework's Feed and block loop
  const stubs = transpile('class XorInstance extends IBlockCipherInstance {\n' +
    '  constructor(algorithm) { super(algorithm); this.BlockSize = 2; }\n' +
    '  EncryptBlock(block) { return [block[0] ^ this.key[0], block[1] ^ this.key[1]]; }\n' +
    '  DecryptBlock(block) { return this.EncryptBlock(block); }\n}\n' +
    '/**\n * @param {BigInt} x - value\n * @returns {BigInt} low 64 bits\n */\nfunction wrap64(x) { return OpCodes.ToQWord(x); }', true)
    .replace(/public static void Main\s*\([^)]*\)\s*\{[^}]*\}/, '');
  const program = `${stubs}
namespace RegressionTest {
  public static class Probe {
    static int failures = 0;
    static void Eq(string name, object got, object want) {
      if (!object.Equals(got?.ToString(), want?.ToString())) { ++failures; Console.WriteLine("FAIL " + name + ": got " + got + " want " + want); }
    }
    static string Hex(byte[][] blocks) => string.Join("|", blocks.Select(b => Convert.ToHexString(b)));
    public static int Main() {
      // ToRadixString: zero, negative, radix 16 lower-case, radix 36 boundary
      Eq("radix0", FrameworkFunctions.ToRadixString(BigInteger.Zero, 2), "0");
      Eq("radix-neg", FrameworkFunctions.ToRadixString(new BigInteger(-10), 2), "-1010");
      Eq("radix16", FrameworkFunctions.ToRadixString(new BigInteger(255), 16), "ff");
      Eq("radix36", FrameworkFunctions.ToRadixString(new BigInteger(35), 36), "z");
      // IsTruthy: JS falsy values and objects
      Eq("t-null", FrameworkFunctions.IsTruthy(null), false);
      Eq("t-zero", FrameworkFunctions.IsTruthy(0), false);
      Eq("t-nan", FrameworkFunctions.IsTruthy(double.NaN), false);
      Eq("t-empty", FrameworkFunctions.IsTruthy(""), false);
      Eq("t-one", FrameworkFunctions.IsTruthy(1u), true);
      Eq("t-obj", FrameworkFunctions.IsTruthy(new { n = 1 }), true);
      // SpongePadBlocks: rate-1 bytes pending merges separator and final bit (0x86)
      Eq("sponge-merge", Hex(FrameworkFunctions.SpongePadBlocks(new byte[] { 1, 2, 3 }, 3, 4, 0x06)), "01020386");
      Eq("sponge-empty", Hex(FrameworkFunctions.SpongePadBlocks(new byte[0], 0, 4, 0x1F)), "1F000080");
      Eq("sponge-full", Hex(FrameworkFunctions.SpongePadBlocks(new byte[] { 1, 2, 3, 4 }, 4, 4, 0x06)), "01020304|06000080");
      // MerkleDamgardBlocks: 55 bytes fit one block, 56 need two (SHA-256 boundary)
      Eq("md-55", FrameworkFunctions.MerkleDamgardBlocks(new byte[55], 55, 55, new { BlockSize = 64, LengthBytes = 8 }).Length, 1);
      Eq("md-56", FrameworkFunctions.MerkleDamgardBlocks(new byte[56], 56, 56, new { BlockSize = 64, LengthBytes = 8 }).Length, 2);
      Eq("md-len", Convert.ToHexString(FrameworkFunctions.MerkleDamgardBlocks(new byte[0], 0, 3, new { BlockSize = 64, LengthBytes = 8 })[0].Skip(56).ToArray()), "0000000000000018");
      Eq("md-le", Convert.ToHexString(FrameworkFunctions.MerkleDamgardBlocks(new byte[0], 0, 3, new { BlockSize = 64, LengthBytes = 8, LengthLittleEndian = true })[0].Skip(56).ToArray()), "1800000000000000");
      // BlockAbsorber holds the last full block back until more data arrives
      var seen = new List<string>();
      var absorber = new BlockAbsorber(4, b => seen.Add(Convert.ToHexString(b)));
      absorber.Absorb(new byte[] { 1, 2, 3, 4 });
      Eq("hold-full", seen.Count, 0);
      absorber.Absorb(new byte[] { 5 });
      Eq("release", string.Join(",", seen), "01020304");
      Eq("tail", absorber.Finish((held, pending, total) => Convert.ToHexString(held) + "/" + pending + "/" + total), "05/1/5");
      // GFMul: AES field, 0x57 * 0x83 = 0xC1 (FIPS-197 example)
      Eq("gfmul", OpCodes.GFMul(0x57, 0x83, 0x11B, 8), 0xC1);
      // ModN keeps the result in [0, m); ModInverseN matches the JS helper, 0 for m = 1, throws when not invertible
      Eq("modn-neg", OpCodes.ModN(new BigInteger(-3), new BigInteger(7)), 4);
      Eq("modn-edge", OpCodes.ModN(new BigInteger(-7), new BigInteger(7)), 0);
      Eq("modinv", OpCodes.ModInverseN(new BigInteger(3), new BigInteger(11)), 4);
      Eq("modinv-neg", OpCodes.ModInverseN(new BigInteger(-8), new BigInteger(11)), 4);
      Eq("modinv-m1", OpCodes.ModInverseN(new BigInteger(5), BigInteger.One), 0);
      var threw = false;
      try { OpCodes.ModInverseN(new BigInteger(4), new BigInteger(8)); } catch (ArgumentException) { threw = true; }
      Eq("modinv-none", threw, true);
      // Framework instance: Feed accumulates, Result runs EncryptBlock over every block
      var xor = new Generated.XorInstance(null);
      xor.Key = new byte[] { 1, 2 };
      xor.Feed(new byte[] { 0, 0 });
      xor.Feed(new byte[0]);
      xor.Feed(new byte[] { 3, 3 });
      Eq("feed-result", Convert.ToHexString(xor.Result()), "01020201");
      Eq("result-drains", xor.InputBuffer.Length, 0);
      xor.Feed(new byte[] { 1 });
      var partial = false;
      try { xor.Result(); } catch (Exception) { partial = true; }
      Eq("partial-block", partial, true);
      var keyless = new Generated.XorInstance(null);
      keyless.Feed(new byte[] { 1, 2 });
      var noKey = false;
      try { keyless.Result(); } catch (Exception) { noKey = true; }
      Eq("no-key", noKey, true);
      // ToQWord keeps the low 64 bits of a wider BigInteger (no OverflowException)
      Eq("qword-wrap", Generated.Wrap64(BigInteger.Pow(2, 70) + 5), 5);
      Eq("qword-max", Generated.Wrap64(BigInteger.Pow(2, 64) - 1), ulong.MaxValue);
      // SetBit on a uint keeps it a uint; CreateArray fills any element type
      Eq("setbit-uint", OpCodes.SetBit(0x80000000u, 0, true), 0x80000001u);
      Eq("setbit-clear", OpCodes.SetBit(0x80000001u, 31, false), 1u);
      Eq("createarray", string.Join(",", OpCodes.CreateArray(3, new BigInteger(7))), "7,7,7");
      Eq("createarray-empty", OpCodes.CreateArray(0, 1u).Length, 0);
      // BytesToChars maps each byte to one char; RotL64_HL rotates the high:low pair
      Eq("bytestochars", OpCodes.BytesToChars(new byte[] { 65, 0xE9 }), "Aé");
      Eq("rotl64-hl", OpCodes.RotL64_HL(0x80000000u, 1u, 1), (0u, 3u));
      Eq("rotl64-hl-32", OpCodes.RotL64_HL(1u, 2u, 32), (2u, 1u));
      Eq("rotl64-hl-0", OpCodes.RotL64_HL(1u, 2u, 64), (1u, 2u));
      Console.WriteLine(failures == 0 ? "STUBS_OK" : "STUBS_FAILED");
      return failures == 0 ? 0 : 1;
    }
  }
}`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-regression-'));
  try {
    fs.writeFileSync(path.join(dir, 'Program.cs'), program);
    fs.writeFileSync(path.join(dir, 'Probe.csproj'), `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>disable</Nullable>
    <StartupObject>RegressionTest.Probe</StartupObject>
    <NoWarn>CS0168;CS0219;CS0414;CS8600;CS8601;CS8602;CS8603;CS8604;CS8618;CS8625;CS8632</NoWarn>
  </PropertyGroup>
</Project>`);
    const run = spawnSync('dotnet', ['run', '--project', dir, '-c', 'Release'], {
      encoding: 'utf-8', timeout: 180000, env: Object.assign({}, process.env, { DOTNET_CLI_UI_LANGUAGE: 'en' })
    });
    const out = (run.stdout || '') + (run.stderr || '');
    if (!out.includes('STUBS_OK'))
      throw new Error(out.split('\n').filter(l => /FAIL|error/.test(l)).slice(0, 12).join('\n') || out.slice(-1500));
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* temp dir cleanup is best effort */ }
  }
});

/**
 * CSHARP: run every regression case.
 * @param {object} options - { verbose, dotnet } (dotnet: false skips compiling and running the stubs)
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  verbose = Boolean(options.verbose);
  allowDotnet = options.dotnet !== false;
  realLog('C# transpile regression suite');
  return cases.run({ verbose });
}

module.exports = { run };
