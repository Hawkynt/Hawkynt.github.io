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

check('module statements: a loop filling a module table runs where the module runs it, between the fields', () => {
  const code = transpile('/** @type {uint32[]} */\nconst TABLE = [];\nfor (let c = 0; c < 4; c++) TABLE.push(c * 3);\n' +
    'const SECOND = TABLE.length;\n/**\n * @param {int32} i - i\n * @returns {uint32} v\n */\nfunction get(i) { return TABLE[i]; }');
  expectMatch(code, /private static bool ModuleInit1\(\)\s*\{\s*for \(int c = 0; c < 4; c\+\+\)[\s\S]*?TABLE = TABLE\.Append\([\s\S]*?return true;/, 'the loop in ModuleInit1');
  const table = code.indexOf(' TABLE = Array.Empty'), init = code.indexOf('ModuleInit1Done = ModuleInit1()'), second = code.indexOf(' SECOND = ');
  if (!(table >= 0 && init > table && second > init)) throw new Error('expected TABLE, then its initialization, then SECOND');
});
check('module statements: a registry guard and a store into a table run, a guard of the module system does not', () => {
  const code = transpile('const T = [0, 0];\nT[1] = 5;\nclass A extends Algorithm { constructor() { super(); this.name = "A"; } }\n' +
    'const a = new A();\nif (!AlgorithmFramework.Find(a.name)) { RegisterAlgorithm(a); }');
  expectMatch(code, /ModuleInit1\(\)\s*\{\s*T\[1\] = /, 'the store T[1] = 5 in ModuleInit1');
  expectNoMatch(code, /ModuleInit2/, 'a module init for the registry guard');
});
check('module scope: (function () { ... }).call(this) declares its tables like any module scope', () => {
  const code = transpile('(function () {\n  const SBOX = [7, 8, 9];\n  module.exports = { SBOX };\n}).call(this);');
  expectMatch(code, /static readonly \w+\[\] SBOX = /, 'the SBOX field');
});
check('module scope: a long concatenation of string literals becomes one literal', () => {
  const parts = Array.from({ length: 1200 }, (_, i) => `'${(i % 256).toString(16).padStart(2, '0')}'`).join(' +\n  ');
  const code = transpile(`const HEX =\n  ${parts};\n/** @returns {int32} n */\nfunction size() { return HEX.length; }`);
  expectMatch(code, /HEX = "000102/, 'one literal starting 000102');
});
check('statements: Object.freeze(x) as a statement leaves no bare expression (CS0201)', () => {
  const code = transpile('const BOXES = [[1, 2], [3, 4]];\nfor (let i = 0; i < BOXES.length; i++) Object.freeze(BOXES[i]);\nObject.freeze(BOXES);');
  expectNoMatch(code, /^\s*BOXES\[i\];/m, 'a bare BOXES[i]; statement');
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
  expectMatch(code, /return (a2 \*|JsMul\(a2,)/, 'the renamed local used afterwards');
});
check('scope: a constructor parameter named A is read as A (not a)', () => {
  const code = transpile('class S {\n  /**\n   * @param {uint8[]} first - first\n   * @param {uint8[][]} A - matrix\n   */\n  constructor(first, A) { this.first = first; this.A = A; }\n}');
  expectMatch(code, /this\.A = A;/, 'this.A = A');
});
check('scope: for (var i ...) read after the loop is declared ahead of the loop', () => {
  const code = transpile('/**\n * @param {int32} n - n\n * @returns {int32} r\n */\nfunction f(n) { for (var i = 0; i < n; ++i) { if (i * i > n) break; } return i; }');
  expectMatch(code, /int i = 0;\s*for \(; i < n; \+\+i\)/, 'int i = 0; for (; i < n; ++i)');
});
check('scope: loop variable `r` next to parameter `R` does not redeclare it', () => {
  const code = transpile('function f(L, R) { let s = 0; for (let r = 0; r < 8; r++) s += r + R; return s + L; }');
  expectMatch(code, /for \(int r2 = 0; r2 < 8; r2\+\+\)/, 'the loop variable renamed to r2');
  expectMatch(code, /r2 \+ r\b/, 'the loop body reading both r2 and the parameter r');
});

// ---------------------------------------------------------------------------
// Field typing
// ---------------------------------------------------------------------------
check('locals: a local declared without a value takes its JSDoc @type', () => {
  const code = transpile('/**\n * @param {uint32[]} S - s\n * @param {int32} k - k\n * @returns {uint32} r\n */\n' +
    'function f(S, k) { /** @type {int32[]} */\n  let idx;\n  if (k === 2) idx = [1, 2]; else idx = [3, 4];\n  return S[idx[0]]; }');
  expectMatch(code, /int\[\] idx = Array\.Empty<int>\(\);/, 'int[] idx');
});
check('constructors: a parameter a caller may leave out defaults (JavaScript passes undefined)', () => {
  const code = transpile('class Engine {\n  /**\n   * @param {int32} size - size\n   * @param {string} profile - profile\n   */\n' +
    '  constructor(size, profile) { this.size = size; this.profile = profile; }\n}\n/** @returns {Engine} e */\nfunction make() { return new Engine(4); }');
  expectMatch(code, /public Engine\(int size = default, string profile = default\)/, 'Engine(int size = default, string profile = default)');
});
check('methods: a parameter a caller may leave out defaults (JavaScript passes undefined)', () => {
  const code = transpile('class Shake {\n  /**\n   * @param {uint8[]} data - data\n   * @param {int32} offset - offset\n   * @param {int32} length - length\n   */\n' +
    '  absorb(data, offset, length) { this.n = (offset || 0) + (length || data.length); }\n  /** @param {uint8[]} d - d */\n  run(d) { this.absorb(d); }\n}');
  expectMatch(code, /Absorb\(byte\[\] data = (null|default), int offset = (0|default), int length = (0|default)\)/, 'Absorb with defaults for every parameter');
});
check('methods: a static method growing an array parameter gets it by ref through Class.method(local)', () => {
  const code = transpile('class Lz {\n  /**\n   * @param {uint8[]} out - out\n   * @param {uint8} b - b\n   */\n  static put(out, b) { out.push(b); }\n}\n' +
    '/** @returns {uint8[]} r */\nfunction f() { /** @type {uint8[]} */ const out = []; Lz.put(out, 1); return out; }');
  expectMatch(code, /Put\(ref byte\[\] @?out/, 'Put(ref byte[] out, ...)');
  expectMatch(code, /Lz\.Put\(ref @?out, /, 'Lz.Put(ref out, ...)');
});
check('methods: a whole-number default of an int parameter is an int literal (0, not 0.0)', () => {
  const code = transpile('/**\n * @param {uint8[]} data - data\n * @param {int32} source - source\n */\nfunction add(data, source = 0) { return data.length + source; }');
  expectMatch(code, /int source = 0\b(?!\.)/, 'int source = 0');
});
check('methods: no default before a ref parameter (CS1737)', () => {
  const code = transpile('/**\n * @param {int32[]} values - v\n * @param {int32[]} overflow - o\n * @returns {int32[]} r\n */\n' +
    'function enc(values, overflow) { for (let i = 0; i < values.length; i++) overflow[i + 4] = values[i]; return values; }\n' +
    '/** @returns {int32[]} r */\nfunction use() { /** @type {int32[]} */ const o = []; return enc([1, 2], o); }');
  expectNoMatch(code, /= default, ref /, 'a default before a ref parameter');
});
check('arrays: an array handed to a constructor that keeps and fills it is read back from the object', () => {
  const code = transpile('class W {\n  /** @param {uint8[]} out - out */\n  constructor(out) { /** @type {uint8[]} */ this.out = out; }\n  /** @param {uint8} b - b */\n  put(b) { this.out.push(b); }\n}\n' +
    '/** @returns {uint8[]} r */\nfunction f() { /** @type {uint8[]} */ const result = [9]; const w = new W(result); w.put(1); return result; }');
  expectMatch(code, /w\.Put\([^;]*\);\s*result = w\.Out;\s*return result;/, 'result = w.Out before the return');
});
check('fields: a backing field starting as BigInt words holds BigIntegers, whatever its accessor takes', () => {
  const code = transpile('class T extends IRandomGeneratorInstance {\n  constructor(a) { super(a); this._key = [0n, 0n]; }\n' +
    '  /** @param {uint8[]} k - key */\n  set key(k) { this._key[0] = BigInt(k[0]); this._key[1] = BigInt(k[1]); }\n  /** @returns {uint8[]} k */\n  get key() { return null; }\n}');
  expectMatch(code, /BigInteger\[\] _key;/, 'BigInteger[] _key');
});
check('fields: two fields differing only in case keep their own values', () => {
  const code = transpile('class P {\n  constructor() { /** @type {int32} */ this.N = 8; /** @type {int32} */ this.n = 2 * this.N; }\n' +
    '  /** @returns {int32} sum */\n  sum() { return this.n + this.N; }\n}');
  expectMatch(code, /this\.NField = /, 'n renamed to NField');
  expectMatch(code, /return this\.NField \+ this\.N;/, 'both read apart');
});
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
check('string.split: split("") gives the characters through JsSplit, not string.Split', () => {
  const code = transpile('/**\n * @param {string} line - line\n * @returns {string[]} cells\n */\nfunction cells(line) { return line.split(""); }');
  expectMatch(code, /JsSplit\(line, ""\)/, 'JsSplit(line, "")');
  expectNoMatch(code, /line\.Split\(/, 'line.Split (Split("") returns the whole string)');
});
check('string.slice/substr: negative bounds and lengths go through JsSlice/JsSubstr, not Substring', () => {
  const code = transpile('/**\n * @param {string} s - s\n * @returns {string} r\n */\nfunction f(s) { return s.slice(0, -2) + s.slice(3) + s.substr(1, 2); }');
  expectMatch(code, /JsSlice\(s, 0, -2\)/, 'JsSlice(s, 0, -2)');
  expectMatch(code, /JsSlice\(s, 3\)/, 'JsSlice(s, 3)');
  expectMatch(code, /JsSubstr\(s, 1, 2\)/, 'JsSubstr(s, 1, 2) (the length was dropped)');
});
check('conditions: a number into a @type {boolean} local is its truthiness (OpCodes.GetBit is 0/1)', () => {
  const code = transpile('/**\n * @param {uint8} f - f\n * @returns {boolean} b\n */\nfunction g(f) { /** @type {boolean} */ const m = OpCodes.GetBit(f, 3); return m; }');
  expectMatch(code, /bool m = \(OpCodes\.GetBit\(f, 3\)\) != 0;/, 'bool m = (GetBit(...)) != 0');
});
check('conditions: !(a && b) tests each operand by its truthiness', () => {
  const code = transpile('/**\n * @param {boolean} m - m\n * @param {int32} k - k\n * @returns {int32} r\n */\nfunction g(m, k) { if (!(m && k)) return 1; return 0; }');
  expectMatch(code, /if \(!\(m && k != 0\)\)/, '!(m && k != 0)');
});
check('conditions: a number as a for test is its truthiness', () => {
  const code = transpile('/**\n * @param {int32} k - k\n * @returns {int32} r\n */\nfunction g(k) { let n = 0; for (; k; k--) n++; return n; }');
  expectMatch(code, /for \(; k != 0; k--\)/, 'for (; k != 0; k--)');
});
check('conditions: Array.isArray of an array-typed value keeps only the array branch', () => {
  const code = transpile('class N {\n  constructor() { /** @type {uint8[]} */ this.buffer = []; }\n' +
    '  /** @param {uint8[]} data - data */\n  feed(data) { if (Array.isArray(data)) { this.buffer = this.buffer.concat(data); } else { this.buffer.push(data); } }\n}');
  expectMatch(code, /this\.Buffer = this\.Buffer\.Concat\(data\)/, 'the concat branch');
  expectNoMatch(code, /Append\(data\)/, 'the dead push(data) branch (CS1929)');
});
check('conditions: a feature test of an array method is true for a C# array', () => {
  const code = transpile('/**\n * @param {uint8[]} src - s\n * @returns {uint8[]} r\n */\nfunction g(src) { const buf = src.subarray ? src.subarray(0, 2) : src.slice(0, 2); return buf; }');
  expectNoMatch(code, /\.Subarray/, 'src.Subarray (CS1061)');
});
check('regex: /re/.test(s) as a condition is the bool of Regex.IsMatch, not compared to null', () => {
  const code = transpile('/**\n * @param {string} c - c\n * @returns {int32} r\n */\nfunction f(c) { if (/[A-Z]/.test(c)) return 1; return 0; }');
  expectMatch(code, /if \(System\.Text\.RegularExpressions\.Regex\.IsMatch\(c, "\[A-Z\]"\)\)/, 'if (Regex.IsMatch(c, "[A-Z]"))');
  expectNoMatch(code, /IsMatch\([^)]*\) != null/, 'IsMatch(...) != null (always true)');
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
check('framework: extra super() arguments and a super call the framework lacks are dropped', () => {
  const code = transpile('class I extends IAlgorithmInstance {\n  /**\n   * @param {Algorithm} a - algorithm\n   * @param {boolean} inv - inverse\n   */\n' +
    '  constructor(a, inv) { super(a, inv); }\n  ClearData() { super.ClearData(); }\n}');
  expectMatch(code, /: base\(a\)/, ': base(a)');
  expectNoMatch(code, /base\.ClearData\(/, 'base.ClearData()');
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
  expectMatch(code, /static readonly Algorithm RegisteredAlgorithm0 = new A\(\);[\s\S]*RegisteredAlgorithm1 = new B\(\);/, 'a static field per registered algorithm');
  expectMatch(code, /static readonly Algorithm\[\] Algorithms = new Algorithm\[\] \{ RegisteredAlgorithm0, RegisteredAlgorithm1 \}/, 'Algorithms listing them');
  expectMatch(code, /static readonly Algorithm AlgorithmInstance = Algorithms\[0\]/, 'AlgorithmInstance = Algorithms[0]');
});
check('registry: a module-declared algorithmInstance is kept and listed', () => {
  const code = transpile('class A extends HashFunctionAlgorithm { constructor() { super(); this.name = "A"; } }\n' +
    'const algorithmInstance = new A();\nif (!AlgorithmFramework.Find(algorithmInstance.name)) { RegisterAlgorithm(algorithmInstance); }');
  expectMatch(code, /Algorithms = new Algorithm\[\] \{ AlgorithmInstance \}/, 'Algorithms = { AlgorithmInstance }');
  expectNoMatch(code, /AlgorithmInstance = Algorithms\[0\]/, 'a second AlgorithmInstance');
});

check('registry: a loop registering one variant per name lists each variant', () => {
  const code = transpile('class A extends HashFunctionAlgorithm { /** @param {string} v - variant */ constructor(v) { super(); this.name = "A-" + v; } }\n' +
    '/** @type {string[]} */\nconst VARIANTS = ["256", "512"];\n' +
    'for (let i = 0; i < VARIANTS.length; ++i) { const algo = new A(VARIANTS[i]); if (!AlgorithmFramework.Find(algo.name)) RegisterAlgorithm(algo); }');
  expectMatch(code, /RegisteredAlgorithm0 = new A\("256"\);[\s\S]*RegisteredAlgorithm1 = new A\("512"\);/, 'one field per variant');
});
check('registry: an algorithm registered through a module helper is listed', () => {
  const code = transpile('class A extends HashFunctionAlgorithm { constructor() { super(); this.name = "A"; } }\n' +
    '/** @param {A} algo - algorithm */\nfunction registerOnce(algo) { if (!AlgorithmFramework.Find(algo.name)) RegisterAlgorithm(algo); }\n' +
    'registerOnce(new A());');
  expectMatch(code, /RegisteredAlgorithm0 = new A\(\);[\s\S]*Algorithms = new Algorithm\[\] \{ RegisteredAlgorithm0 \}/, 'Algorithms = { new A() }');
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
  expectMatch(code, /Algorithms = new Algorithm\[\] \{ RegisteredAlgorithm0 \}/, 'its own registry');
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
  expectMatch(code, /public I\(Fancy algorithm( = default)?\)/, 'I(Fancy algorithm)');
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
check('arrays: a local declared empty and filled by index grows on each store', () => {
  const code = transpile('/** @returns {uint32[]} keys */\nfunction keys() { /** @type {uint32[]} */ const rk = []; for (let i = 0; i < 4; ++i) rk[i] = i * 3; return rk; }');
  expectMatch(code, /OpCodes\.SetGrow<uint>\(ref rk, i, /, 'OpCodes.SetGrow<uint>(ref rk, i, ...)');
});
check('arrays: a field assigned empty and filled by index grows on each store', () => {
  const code = transpile('class C {\n  constructor() { /** @type {uint32[]} */ this.rk = []; }\n' +
    '  /** @param {int32} n - count */\n  fill(n) { this.rk = []; for (let i = 0; i < n; ++i) this.rk[i] = i; }\n}');
  expectMatch(code, /\(this\.Rk = OpCodes\.Grown<uint>\(this\.Rk, i\)\)\[i\] = /, '(this.Rk = OpCodes.Grown<uint>(this.Rk, i))[i] = ...');
});
check('arrays: a field assigned an empty local array grows on each store too', () => {
  const code = transpile('class C {\n  constructor() { /** @type {uint32[]} */ this.rk = null; }\n' +
    '  /** @param {int32} n - count */\n  fill(n) { /** @type {uint32[]} */ const keys = []; this.rk = keys; for (let i = 0; i < n; ++i) this.rk[i] = i; }\n}');
  expectMatch(code, /OpCodes\.Grown<uint>\(this\.Rk, i\)/, 'OpCodes.Grown<uint>(this.Rk, i)');
});
check('push: null pushed onto a value-type array is its default (CS0037)', () => {
  const code = transpile('/** @returns {uint8[]} bytes */\nfunction f() { /** @type {uint8[]} */ const d = []; d.push(null); return d; }');
  expectMatch(code, /\.Append\(default\(byte\)\)/, '.Append(default(byte))');
});
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
  expectMatch(code, /Red\(int p( = default)?, int p2( = default)?\)/, 'Red(int p, int p2)');
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
check('IL types: a jagged field filled outside the constructor keeps its JSDoc type', () => {
  const code = transpile('class D {\n  init() {\n    /** @type {uint8[][][]} */\n    this.SBOX = [];\n    /** @type {uint8[][]} */\n' +
    '    const box = [[1, 2], [3, 4]];\n    this.SBOX.push(box);\n    return this.SBOX[0][1][0];\n  }\n}');
  expectMatch(code, /byte\[\]\[\]\[\] SBOX\b/, 'byte[][][] SBOX');
  expectMatch(code, /this\.SBOX\.Append\(box\)/, 'this.SBOX.Append(box) without conversion');
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
check('numeric: conditional branches of int and uint both take the conditional\'s IL type', () => {
  const code = transpile('/**\n * @param {boolean} c - choice\n * @param {int32} a - signed\n * @param {uint32} b - unsigned\n * @returns {int32} r\n */\n' +
    'function pick(c, a, b) { return c ? a : OpCodes.ToUint32(b % 7); }');
  expectMatch(code, /c \? unchecked\(\((long|int)\)\(a\)\) : unchecked\(\((long|int)\)/, 'both branches cast to the IL type');
});
check('IL types: an array of any values is dynamic, so it holds any array', () => {
  const code = transpile('/** @param {uint8[]} s - state\n * @returns {Array<*>} copy */\nfunction copy(s) { /** @type {any[]} */ const r = s.slice(); return r; }');
  expectMatch(code, /dynamic r = /, 'dynamic r');
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
check('strings: BigInt(text), padStart and !lookup() map to the runtime and a null test', () => {
  const code = transpile('class P { constructor() { /** @type {int32} */ this.n = 1; } }\n' +
    '/** @param {string} k - key\n * @returns {P|null} params */\nfunction find(k) { return k === "a" ? new P() : null; }\n' +
    '/**\n * @param {string} hex - digits\n * @returns {string} padded\n */\n' +
    'function show(hex) { if (!find(hex)) return ""; const v = BigInt("0x" + hex); return hex.padStart(8, "0") + v; }');
  expectMatch(code, /ParseBigInt\("0x" \+ hex\)/, 'ParseBigInt("0x" + hex)');
  expectMatch(code, /PadString\(hex, 8, "0", true\)/, 'PadString(hex, 8, "0", true)');
  expectMatch(code, /if \(Find\(hex\) == null\)/, 'Find(hex) == null');
});
check('numeric: the global isNaN tests a double', () => {
  const code = transpile('/**\n * @param {float64} x - value\n * @returns {boolean} not a number\n */\nfunction nan(x) { return isNaN(x); }');
  expectMatch(code, /double\.IsNaN\(/, 'double.IsNaN(...)');
});

// ---------------------------------------------------------------------------
// Framework-typed values
// ---------------------------------------------------------------------------
check('framework: every country code the algorithms name exists in the CountryCode stub', () => {
  const algorithmsDir = path.join(CIPHER_DIR, 'algorithms');
  const used = new Set();
  for (const dir of fs.readdirSync(algorithmsDir)) {
    const full = path.join(algorithmsDir, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const file of fs.readdirSync(full).filter(f => f.endsWith('.js')))
      for (const m of fs.readFileSync(path.join(full, file), 'utf-8').matchAll(/CountryCode\.([A-Z_]+)/g)) used.add(m[1]);
  }
  const stubs = transpile('class A extends Algorithm { constructor() { super(); this.name = "A"; } }', true);
  const members = new Set((stubs.match(/enum CountryCode \{([^}]*)\}/) || ['', ''])[1].split(',').map(s => s.trim()));
  const missing = [...used].filter(c => !members.has(c));
  if (missing.length) throw new Error('missing country codes: ' + missing.join(', '));
});
check('framework: a framework property set on a framework-typed instance reaches the concrete class (dynamic)', () => {
  const code = transpile('class K extends IAlgorithmInstance {\n  /** @param {Algorithm} hash - hash algorithm */\n' +
    '  use(hash) { /** @type {IHashFunctionInstance} */ const h = hash.CreateInstance(false); h.outputSize = 37; return h; }\n}');
  expectMatch(code, /\(\(dynamic\)\(?h\)?\)\.OutputSize = /, '((dynamic)h).OutputSize = ...');
});
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
check('test vectors: a non-byte array given to new TestCase is converted to bytes', () => {
  const code = transpile('class A extends Algorithm {\n  constructor() { super(); this.tests = [new TestCase([1, 2], ' +
    '(() => { /** @type {uint32[]} */ const out = []; for (let i = 0; i < 3; i++) out.push(i); return out; })(), "t", "u")]; }\n}');
  expectMatch(code, /\.Invoke\(\)\.Select\(_v => unchecked\(\(byte\)\(_v\)\)\)\.ToArray\(\)/, 'the uint[] IIFE result converted to byte[]');
});
check('test vectors: an object vector\'s non-byte input is converted to bytes', () => {
  const code = transpile('class A extends Algorithm {\n  constructor() { super(); this.tests = [{ text: "t", uri: "u", ' +
    'input: (() => { /** @type {uint32[]} */ const out = []; for (let i = 0; i < 3; i++) out.push(i); return out; })(), expected: [1] }]; }\n}');
  expectMatch(code, /Input = \(\(Func<uint\[\]>\)[\s\S]*\.Invoke\(\)\.Select\(_v => unchecked\(\(byte\)\(_v\)\)\)\.ToArray\(\)/, 'Input converted to byte[]');
});
check('IL types: x != null ? x : y on a nullable int is x ?? y, an int', () => {
  const code = transpile('class F {\n  constructor() { /** @type {int32} */ this.poolIdx = 0; }\n' +
    '  /**\n   * @param {uint8[]} data - data\n   * @param {int32} source - source\n   * @param {int32|null} pool - pool\n   * @returns {int32} r\n   */\n' +
    '  add(data, source = 0, pool = null) { /** @type {int32} */ const target = pool !== null ? pool : this.poolIdx; return target + source; }\n}');
  expectMatch(code, /int target = pool \?\? this\.PoolIdx;/, 'int target = pool ?? this.PoolIdx');
});
check('test vectors: records mapped into the vectors stay plain objects; only the map result is a TestCase', () => {
  const code = transpile('class A extends Algorithm {\n  constructor() { super();\n    this.tests = [{ n: "one", p: "12" }, { n: "two", p: "34" }].map(s => ({ text: "t " + s.n, uri: "u", input: OpCodes.AnsiToBytes(s.p), expected: [1] }));\n  }\n}');
  expectNoMatch(code, /new TestCase \{ \["n"\]/, 'the records built as TestCase');
  expectMatch(code, /\.Select\(s => new TestCase \{/, 'the map building TestCases');
});
check('test vectors: a vector field the TestCase stub lacks is read and written through its bag', () => {
  const code = transpile('class A extends Algorithm {\n  constructor() { super();\n    this.tests = [{ text: "t", uri: "u", input: [1], expected: [2] }];\n' +
    '    for (let i = 0; i < this.tests.length; i++) this.tests[i].batchSize = 2;\n  }\n}');
  expectMatch(code, /this\.Tests\[i\]\["batchSize"\] = 2;/, 'this.Tests[i]["batchSize"] = 2');
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
check('OpCodes.Unpack32LE: a float64 word is unpacked from its low 32 bits as an unsigned integer', () => {
  const code = transpile('/**\n * @param {float64} len - length\n * @returns {uint8[]} bytes\n */\n' +
    'function f(len) { /** @type {float64} */ const high = Math.floor(len / 4294967296); /** @type {float64} */ const low = len - high * 4294967296; return OpCodes.Unpack32LE(low); }');
  expectMatch(code, /\(uint\)\(unchecked\(\(long\)\(low\)\)\)\) >> 8/, 'the double cast to long, then uint, before the shift');
  expectNoMatch(code, /\blow >> 8/, 'a shift of the double itself');
});

// ---------------------------------------------------------------------------
// Validation harness (tests/TranspilerValidation.js, C# paths)
// ---------------------------------------------------------------------------
const Validation = quiet(() => require('./TranspilerValidation.js'));
const MODE_SPEC = { algorithms: [{ name: 'M', className: 'M', isMode: true, multiKey: false, vectors: [{ fields: [], steps: [] }] }] };

check('harness: the dummy cipher of a mode overrides CreateInstance with the block cipher instance type', () => {
  const harness = quiet(() => Validation.generateTestHarness('csharp', 'namespace CipherValidation { }', MODE_SPEC, 'm'));
  if (!harness.success) throw new Error(harness.error);
  expectMatch(harness.code, /public override IBlockCipherInstance CreateInstance\(bool isInverse = false\)/, 'CreateInstance returning IBlockCipherInstance');
  expectNoMatch(harness.code, /class ValidationDummyCipherInstance[\s\S]*public int BlockSize \{/, 'a redeclared BlockSize hiding the framework one');
});
check('harness: a dependency is appended after the main code without stubs, its using directives at the top', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-bundle-'));
  try {
    const dependency = path.join(dir, 'dep-cipher.js');
    fs.writeFileSync(dependency, 'class DepCipher extends BlockCipherAlgorithm { constructor() { super(); this.name = "Dep"; } }\nRegisterAlgorithm(new DepCipher());\n');
    const main = transpile('class MainMode extends Algorithm { constructor() { super(); this.name = "Main"; } }\nRegisterAlgorithm(new MainMode());', true);
    const bundled = quiet(() => Validation.bundleCSharpDependencies(main, [dependency], plugin, undefined));
    if (!bundled.success) throw new Error(bundled.error);
    expectMatch(bundled.code, /class dep_cipher_depGenerated[\s\S]*class DepCipher\b/, 'the dependency\'s own wrapper class holding DepCipher');
    if (bundled.code.indexOf('dep_cipher_depGenerated') < bundled.code.indexOf('class MainMode')) throw new Error('the dependency precedes the main code');
    if ((bundled.code.match(/public class Algorithm\b/g) || []).length !== 1) throw new Error('expected the framework stubs exactly once');
    expectNoMatch(bundled.code, /\}\s*\n\s*using /, 'a using directive after code');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
check('harness: a .data library taken through a factory parameter is bundled, and the parameter holds its exports', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-library-'));
  try {
    const main = path.join(dir, 'main.js');
    fs.writeFileSync(main, "(function (root, factory) { module.exports = factory(require('../../AlgorithmFramework'), require('../../OpCodes'), require('./tables.data')); })" +
      '(this, function (AlgorithmFramework, OpCodes, Tables) { return {}; });\n');
    fs.writeFileSync(path.join(dir, 'tables.data.js'), '(function () {\n  const SBOX = [1, 2, 3];\n  module.exports = { SBOX };\n}).call(this);\n');
    const code = 'namespace CipherValidation { public class mainGenerated { public static dynamic Tables = null; public static dynamic Sbox = Tables.SBOX; } }';
    const bundled = quiet(() => Validation.bundleCSharpDependencies(code, [], plugin, undefined, main));
    if (!bundled.success) throw new Error(bundled.error);
    expectMatch(bundled.code, /public static dynamic Tables = ValidationLibraries\.Exports\(typeof\(tables_data_libGenerated\)\);/, 'Tables bound to the library\'s exports');
    expectMatch(bundled.code, /class tables_data_libGenerated[\s\S]*\bSBOX\b/, 'the library class with its SBOX table');
    expectMatch(bundled.code, /class ValidationLibraryExports : System\.Dynamic\.DynamicObject/, 'the exports object');
    // A parameter the code never reads (the stubs stand in for it) gets no library
    const unused = '// Tables is provided by the stubs\nnamespace CipherValidation { public class mainGenerated { public static dynamic Tables = null; } }';
    const plain = quiet(() => Validation.bundleCSharpDependencies(unused, [], plugin, undefined, main));
    expectNoMatch(plain.code, /tables_data_libGenerated/, 'the library bundled for an unused parameter');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
check('harness: a dependency that fails to transpile names the dependency', () => {
  const bundled = quiet(() => Validation.bundleCSharpDependencies('', [path.join(os.tmpdir(), 'no-such-dependency.js')], plugin, undefined));
  if (bundled.success || !/dependency .*no-such-dependency\.js/.test(bundled.error)) throw new Error('expected a failure naming the dependency, got ' + JSON.stringify(bundled));
});

// ---------------------------------------------------------------------------
// Arrays: JavaScript grows them, C# rebinds
// ---------------------------------------------------------------------------
check('arrays: a field aliasing a local the method pushes to is assigned it again before each return and at the end', () => {
  const code = transpile('class K {\n  constructor() { /** @type {uint32[]} */ this.keys = null; }\n' +
    '  /** @param {int32} n - n */\n  schedule(n) {\n    /** @type {uint32[]} */\n    const keys = [];\n    this.keys = keys;\n' +
    '    if (n === 0) return;\n    for (let i = 0; i < n; i++) keys.push(i);\n  }\n}');
  expectMatch(code, /this\.Keys = keys;\s*return;/, 'the field assigned again before the early return');
  expectMatch(code, /keys = keys\.Append\([\s\S]*\}\s*this\.Keys = keys;\s*\}/, 'the field assigned again at the end');
});
check('arrays: a local taken from a field and pushed to is stored back into the field', () => {
  const code = transpile('class L {\n  constructor() { /** @type {uint8[]} */ this.reg = [0, 1]; }\n  /** @param {uint8} b - b */\n' +
    '  insert(b) { const r = this.reg; r.shift(); r.push(b); }\n}');
  expectMatch(code, /r = r\.Append\([^;]*\)\.ToArray\(\);\s*this\.Reg = r;/, 'this.Reg = r after the push');
});
check('arrays: a local taken from a row of a field table and pushed to is stored back into that row', () => {
  const code = transpile('class L {\n  constructor() { /** @type {uint8[][]} */ this.regs = [[0, 1], [1, 0]]; }\n  /**\n   * @param {int32} r - r\n   * @param {uint8} b - b\n   */\n' +
    '  clock(r, b) { const x = this.regs[r]; x.shift(); x.push(b); }\n}');
  expectMatch(code, /x = x\.Append\([^;]*\)\.ToArray\(\);\s*this\.Regs\[r\] = x;/, 'this.Regs[r] = x after the push');
});
check('arrays: a return before the field is first assigned the local is not synced (the local is not declared yet)', () => {
  const code = transpile('class D {\n  constructor() { /** @type {uint32[]} */ this.deck = [1, 2]; }\n' +
    '  /** @param {int32} n - n */\n  cut(n) {\n    if (n <= 0) return;\n    /** @type {uint32[]} */\n    const rebuilt = [];\n' +
    '    for (let i = 0; i < n; i++) rebuilt.push(this.deck[i]);\n    this.deck = rebuilt;\n  }\n}');
  expectNoMatch(code, /if \(n <= 0\)\s*\{\s*this\.Deck = rebuilt;/, 'a sync before rebuilt is declared (CS0841)');
});
check('arrays: a whole copy stored into past its end grows (key.slice() extended to a schedule)', () => {
  const code = transpile('/**\n * @param {uint8[]} key - key\n * @returns {uint8[]} schedule\n */\nfunction expand(key) {\n' +
    '  /** @type {uint8[]} */\n  const rk = key.slice();\n  for (let i = 16; i < 32; i++) rk[i] = rk[i - 16];\n  return rk;\n}');
  expectMatch(code, /OpCodes\.SetGrow<byte>\(ref rk, i, /, 'SetGrow(ref rk, i, ...)');
});
check('arrays: a local pushed into a container before it is filled is pushed after it is filled', () => {
  const code = transpile('/**\n * @param {string} a - alphabet\n * @returns {string[][]} rows\n */\nfunction f(a) {\n  /** @type {string[][]} */\n  const rows = [];\n' +
    '  for (let r = 0; r < 3; r++) {\n    /** @type {string[]} */\n    const cells = [];\n    rows.push(cells);\n    for (let c = 0; c < 3; c++) cells.push(a[r * 3 + c]);\n  }\n  return rows;\n}');
  expectMatch(code, /cells = cells\.Append\([\s\S]*?\}\s*rows = rows\.Append\(cells\)/, 'rows.Append(cells) after the loop filling cells');
});
check('arrays: a growable field stored at an index with a side effect evaluates the index once (OpCodes.Stored)', () => {
  const code = transpile('class H {\n  constructor() { /** @type {uint8[]} */ this.buf = []; /** @type {int32} */ this.off = 0; }\n' +
    '  /** @param {uint8} b - byte */\n  put(b) { this.buf[this.off++] = b; }\n}');
  expectMatch(code, /this\.Buf = OpCodes\.Stored<byte>\(this\.Buf, this\.Off\+\+, b\)/, 'this.Buf = OpCodes.Stored(this.Buf, this.Off++, b)');
});
check('arrays: a growable field stored at an index read from another table grows', () => {
  const code = transpile('class S {\n  constructor() { /** @type {int32[]} */ this.fwd = [2, 0, 1]; /** @type {int32[]} */ this.rev = [];\n' +
    '    for (let i = 0; i < 3; i++) this.rev[this.fwd[i]] = i; }\n}');
  expectMatch(code, /OpCodes\.Grown<int>\(this\.Rev, this\.Fwd\[i\]\)/, 'OpCodes.Grown(this.Rev, this.Fwd[i])');
});
check('arrays: a row stored as an empty array and filled past its end grows in place', () => {
  const code = transpile('/**\n * @param {uint8[]} d - data\n * @returns {uint8[][]} m\n */\nfunction f(d) {\n  /** @type {uint8[][]} */\n  const m = [];\n' +
    '  for (let r = 0; r < 2; r++) { m[r] = OpCodes.CreateArray(0, 0); for (let c = 0; c < 2; c++) m[r][c] = d[r * 2 + c]; }\n  return m;\n}');
  expectMatch(code, /OpCodes\.SetGrow<byte>\(ref m\[r\], c, /, 'SetGrow(ref m[r], c, ...)');
});
check('arrays: a local stored into a container before it is filled is stored after it is filled', () => {
  const code = transpile('/**\n * @param {int32} k - k\n * @returns {int32[][][]} m\n */\nfunction f(k) {\n  /** @type {int32[][][]} */\n  const a = [];\n' +
    '  for (let i = 0; i < k; i++) {\n    /** @type {int32[][]} */\n    const row = [];\n    a[i] = row;\n    for (let j = 0; j < k; j++) row[j] = [i, j];\n  }\n  return a;\n}');
  expectMatch(code, /SetGrow<int\[\]>\(ref row, j, [\s\S]*?\}\s*OpCodes\.SetGrow<int\[\]\[\]>\(ref a, i, row\)/, 'a[i] = row after the loop filling row');
});
check('conditions: a[i] as a condition is false past the end of a, as undefined is in JavaScript', () => {
  const code = transpile('/**\n * @param {uint8[]} r - r\n * @param {int32} i - i\n * @returns {int32} n\n */\nfunction f(r, i) { let n = 0; if (r[i] && (r[i] & 1)) n++; return n; }');
  expectMatch(code, /if \(i >= 0 && i < r\.Length && r\[i\] != 0 && /, 'the index checked before the read');
});
check('conditions: grid[r][c] of a string grid as a condition checks the column before the read', () => {
  const code = transpile('/**\n * @param {string[][]} grid - g\n * @param {int32} r - r\n * @param {int32} c - c\n * @returns {string} s\n */\n' +
    'function f(grid, r, c) { let s = ""; if (grid[r][c]) s += grid[r][c]; return s; }');
  expectMatch(code, /if \(c >= 0 && c < grid\[r\]\.Length && /, 'c checked against grid[r].Length');
});
check('arrays: shift()/pop() of an array used as a value give the element and shrink the array', () => {
  const code = transpile('class K {\n  constructor() { /** @type {uint8[]} */ this.ks = [1, 2]; }\n  /** @returns {uint8} b */\n  next() { return this.ks.shift(); }\n' +
    '  /**\n   * @param {uint8[]} a - a\n   * @returns {uint8} b\n   */\n  last(a) { return 5 ^ a.pop(); }\n}');
  expectMatch(code, /byte __v = this\.Ks\[0\];\s*this\.Ks = this\.Ks\.Skip\(1\)\.ToArray\(\);/, 'shift: first element, then the rest');
  expectMatch(code, /byte __v = a\[a\.Length - 1\];\s*a = a\.Take\(a\.Length - 1\)\.ToArray\(\);/, 'pop: last element, then the rest');
  expectNoMatch(code, /RemoveAt/, 'List.RemoveAt on an array (CS1061)');
});
check('arrays: Array(n) called without new creates the array', () => {
  const code = transpile('/** @returns {uint8[]} a */\nfunction f() { /** @type {uint8[]} */ const a = Array(4).fill(0x61); return a; }');
  expectNoMatch(code, /[^.\w]Array\(4\)/, 'a call of Array(4) (CS1955)');
  expectMatch(code, /new byte\[4\]|CreateArray<byte>\(4|Repeat\(unchecked\(\(byte\)\(0x61\)\), 4\)|Repeat\([^)]*0x61[^)]*\)*, 4\)/, 'an array of 4');
});
check('arrays: Array.from({length: n}, () => v) gives Select a lambda taking the element', () => {
  const code = transpile('/** @returns {uint8[]} a */\nfunction f() { /** @type {uint8[]} */ const a = Array.from({ length: 4 }, () => 0x64); return a; }');
  expectMatch(code, /Enumerable\.Range\(0, 4\)\.Select\(_ => /, 'Select(_ => ...)');
});
check('destructuring: [a, b] = [b, a] keeps each value in its target type (no byte array in between)', () => {
  const code = transpile('/**\n * @param {uint32} a - a\n * @param {uint32} b - b\n * @returns {uint32} r\n */\nfunction g(a, b) { let r0 = OpCodes.ToUint32(a), r1 = OpCodes.ToUint32(b); [r0, r1] = [r1, r0]; return r0; }');
  expectMatch(code, /uint swap0 = r1;\s*uint swap1 = r0;\s*r0 = swap0;\s*r1 = swap1;/, 'typed temporaries, then the targets');
  expectNoMatch(code, /new byte\[\] \{ unchecked\(\(byte\)\(r1\)\)/, 'the words cut to bytes');
});
check('classes: push(a, b) on an object of a class with its own push method calls that method', () => {
  const code = transpile('class Ring {\n  constructor() { /** @type {uint32[]} */ this.v = []; }\n  /**\n   * @param {uint32} a - a\n   * @param {uint32} b - b\n   */\n  push(a, b) { this.v[0] = a; this.v[1] = b; }\n}\n' +
    '/** @returns {Ring} r */\nfunction f() { const r = new Ring(); r.push(1, 2); return r; }');
  expectMatch(code, /r\.Push\(/, 'r.Push(...)');
  expectNoMatch(code, /r = r\.Append/, 'an array append on the object (CS1929)');
});
check('OpCodes: Not32 of a uint pushed into a uint[] is a uint, not the long C# makes of it', () => {
  const code = transpile('/**\n * @param {uint32[]} k - k\n * @returns {uint32[]} r\n */\nfunction f(k) { /** @type {uint32[]} */ const n = []; for (let i = 0; i < k.length; i++) n.push(OpCodes.Not32(k[i])); return n; }');
  expectMatch(code, /n\.Append\(unchecked\(\(uint\)\(unchecked\(\(int\)\(~k\[i\]\)\) & 4294967295u\)\)\)/, 'the masked result cast to uint');
});
check('arrays: numbers concatenated to the input buffer become bytes', () => {
  const code = transpile('class M extends IMacInstance {\n  /** @returns {uint8[]} r */\n  Result() { /** @type {int32} */ const n = 3; const padding = OpCodes.CreateArray(n, n);\n' +
    '    /** @type {uint8[]} */ const padded = this.inputBuffer.concat(padding); return padded; }\n}');
  expectMatch(code, /this\.InputBuffer\.Concat\(padding\.Select\(/, 'padding converted to bytes before the Concat');
});
check('arrays: a store into a Uint16Array narrows the value to ushort', () => {
  const code = transpile('/** @returns {uint16[]} t */\nfunction f() { const table = new Uint16Array(4);\n  for (let i = 0; i < 4; ++i) { /** @type {int32} */ let code = 285 + i; table[i] = code; }\n  return table; }');
  expectMatch(code, /table\[i\] = unchecked\(\(ushort\)\(code\)\);/, 'table[i] = (ushort)code');
});
check('arrays: a store past the end of a pushed row grows that row in place', () => {
  const code = transpile('/**\n * @param {uint16[]} w - words\n * @returns {uint16[][]} tables\n */\nfunction build(w) {\n' +
    '  /** @type {uint16[][]} */\n  const tables = [];\n  for (let t = 0; t < 2; t++) { /** @type {uint16[]} */ const row = [0]; tables.push(row); }\n' +
    '  for (let r = 1; r <= 3; r++) tables[1][r] = w[r];\n  return tables;\n}');
  expectMatch(code, /OpCodes\.SetGrow<ushort>\(ref tables\[1\], r, /, 'SetGrow(ref tables[1], r, ...)');
});

// ---------------------------------------------------------------------------
// Numbers: JavaScript divides integers to a fraction
// ---------------------------------------------------------------------------
check('Math.ceil/round of an integer quotient divide as doubles, not as integers', () => {
  const header = '/**\n * @param {int32} n - n\n * @param {int32} h - h\n * @returns {int32} r\n */\n';
  const ceil = transpile(header + 'function f(n, h) { return Math.ceil(n / h); }');
  expectMatch(ceil, /Math\.Ceiling\(\(double\)\(n\) \/ h\)/, 'Math.Ceiling((double)(n) / h)');
  expectNoMatch(ceil, /\(double\)\(n \/ h\)/, 'the integer quotient converted afterwards');
  const round = transpile(header + 'function f(n, h) { return Math.round(n / h); }');
  expectNoMatch(round, /\(double\)\(n \/ h\)/, 'the integer quotient converted afterwards');
});
check('numbers: a product of two 32-bit numbers is the double JavaScript computes (JsMul); Mul32 and small constants stay exact', () => {
  const code = transpile('/**\n * @param {uint32} s - state\n * @param {uint32} a - multiplier\n * @returns {uint32} next\n */\n' +
    'function next(s, a) { return OpCodes.ToUint32(1099087573 * s) ^ OpCodes.Mul32(a, s) ^ OpCodes.ToUint32(s * 5); }');
  expectMatch(code, /JsMul\(1099087573, s\)/, 'JsMul(1099087573, s)');
  expectNoMatch(code, /JsMul\(a, s\)/, 'JsMul for OpCodes.Mul32');
  expectNoMatch(code, /JsMul\(s, 5\)/, 'JsMul for a small constant');
});
check('OpCodes.Unpack32LE of a call evaluates the call once', () => {
  const code = transpile('class G {\n  constructor() { /** @type {uint32} */ this.s = 1; }\n  /** @returns {uint32} next */\n  next() { this.s = OpCodes.Add32(this.s, 1); return this.s; }\n' +
    '  /** @returns {uint8[]} bytes */\n  bytes() { return OpCodes.Unpack32LE(this.next()); }\n}');
  expectMatch(code, /OpCodes\.Unpack32LE\(unchecked\(\(uint\)\(this\.Next\(\)\)\)\)|OpCodes\.Unpack32LE\(\(uint\)\(?this\.Next\(\)\)?\)/, 'OpCodes.Unpack32LE((uint)this.Next())');
  if ((code.match(/this\.Next\(\)/g) || []).length !== 1) throw new Error('expected one call of Next()');
});
check('Math.floor of a product over an integer divides in doubles, so the product does not wrap', () => {
  const code = transpile('/**\n * @param {int32} y - y\n * @param {int32} m - m\n * @returns {int32} j\n */\nfunction f(y, m) { return Math.floor((y * 256) / m); }');
  expectMatch(code, /Math\.Floor\(\(double\)\(y\) \* 256 \/ m\)/, 'Math.Floor((double)y * 256 / m)');
});
check('numbers: an int compared with a uint64 compares as numbers, not with an ambiguous operator (CS0034)', () => {
  const code = transpile('/**\n * @param {int32} n - n\n * @param {uint64} max - max\n * @returns {boolean} r\n */\nfunction f(n, max) { return n > max; }');
  expectMatch(code, /return \(double\)\(n\) > \(double\)\(max\);/, '(double)n > (double)max');
});
check('Math.floor of a uint64 keeps it a ulong, not an int', () => {
  const code = transpile('/**\n * @param {uint64} counter - c\n * @returns {uint64} r\n */\nfunction f(counter) { /** @type {uint64} */ let rest = counter; rest = Math.floor(rest / 256); return rest; }');
  expectMatch(code, /rest = unchecked\(\(ulong\)\(Math\.Floor\(/, 'rest = (ulong)Math.Floor(...)');
});
check('OpCodes.Shr32 of an int32 parameter assigned back to it is cast to the parameter type', () => {
  const code = transpile('class U {\n  /**\n   * @param {int32} n - n\n   * @returns {int32} zeros\n   */\n' +
    '  static ntz(n) { let c = 0; while (OpCodes.And32(n, 1) === 0) { c++; n = OpCodes.Shr32(n, 1); } return c; }\n}');
  expectMatch(code, /n = unchecked\(\(int\)\(n >>> 1 & 4294967295u\)\);/, 'n = (int)(n >>> 1 & 4294967295u)');
});
check('numbers: a ** b is Math.Pow for numbers and BigInteger.Pow for BigInts (C# has no ** operator)', () => {
  const code = transpile('/**\n * @param {bigint} t - t\n * @param {int32} h - h\n * @returns {bigint} r\n */\nfunction g(t, h) { const m = 2 ** h; return t % (2n ** BigInt(h)) + BigInt(m); }');
  expectMatch(code, /Math\.Pow\(\(double\)\(2\), \(double\)\(h\)\)/, 'Math.Pow((double)2, (double)h)');
  expectMatch(code, /BigInteger\.Pow\(\(BigInteger\)\(2ul\), /, 'BigInteger.Pow((BigInteger)2, ...)');
  expectNoMatch(code, /\*\*/, 'a ** operator (CS0193)');
});
check('numbers: a division with a number written as 1.0 divides doubles', () => {
  const code = transpile('const IM = 2147483647;\nconst AM = 1.0 / IM;\n/**\n * @param {int32} s - s\n * @returns {float64} r\n */\nfunction f(s) { return AM * s; }');
  expectMatch(code, /double AM = (1\.0|\(double\)\(1\)) \/ IM;/, 'double AM = 1.0 / IM');
  const local = transpile('/**\n * @param {int32} im - im\n * @returns {float64} r\n */\nfunction f(im) { return 3 * (1.0 / im); }');
  expectMatch(local, /1\.0 \/ im/, '1.0 / im in an expression');
});
check('DataView: a local DataView is the byte[] it views, not dynamic', () => {
  const code = transpile('/**\n * @param {float64} v - v\n * @returns {uint8[]} r\n */\nfunction f(v) { /** @type {uint8[]} */ const out = [];\n' +
    '  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, v, true);\n  for (let i = 0; i < 8; i++) out.push(view.getUint8(i));\n  return out; }');
  expectMatch(code, /byte\[\] view = /, 'byte[] view');
});
check('Math.round rounds a half up as JavaScript does, not to even', () => {
  const code = transpile('/**\n * @param {float64} x - x\n * @returns {int32} r\n */\nfunction f(x) { return Math.round(x * 3); }');
  expectMatch(code, /Math\.Floor\(\(double\)\(x \* 3\) \+ 0\.5\)/, 'Math.Floor(x * 3 + 0.5)');
  expectNoMatch(code, /Math\.Round\(/, 'Math.Round (banker\'s rounding)');
});

check('BigInt locals: an undeclared local starting at a BigInt literal is a BigInteger, not ulong', () => {
  const code = transpile('function inv(value, modulus) {\n  let t = 0n, newT = 1n;\n  let r = modulus, newR = value % modulus;\n' +
    '  while (newR !== 0n) { const q = r / newR; [t, newT] = [newT, t - q * newT]; [r, newR] = [newR, r - q * newR]; }\n  return t < 0n ? t + modulus : t;\n}');
  expectMatch(code, /BigInteger t = 0;/, 'BigInteger t');
  expectNoMatch(code, /ulong t\b/, 'ulong t (Euclid\'s coefficients go negative)');
  const declared = transpile('/** @returns {uint64} h */\nfunction h() { /** @type {uint64} */ let x = 5n; return x; }');
  expectMatch(declared, /ulong x = /, 'a declared uint64 local stays ulong');
});
check('numbers: Number.MAX_VALUE written out is a double literal, without an integer suffix', () => {
  const code = transpile('const UNREACHABLE = 1.7976931348623157e+308;\n/** @returns {float64} v */\nfunction f() { return UNREACHABLE; }');
  expectNoMatch(code, /e\+308[uUlL]/, 'an integer suffix after the exponent');
});
check('loops: a loop variable named like a keyword is escaped in the for header too', () => {
  const code = transpile('/**\n * @param {int32} n - n\n * @returns {int32} s\n */\nfunction f(n) { let s = 0; for (let base = 0; base < n; base += 2) s += base; return s; }');
  expectMatch(code, /for \(int @base = 0; @base < n;/, 'for (int @base = 0; ...)');
});
check('BigInt shifts: OpCodes.ShiftLn(BigInt(1), n) shifts a BigInteger, not a ulong (whose count C# masks to 6 bits)', () => {
  const code = transpile('/**\n * @param {int32} b - b\n * @returns {bigint} r\n */\nfunction f(b) { /** @type {bigint} */ let n = BigInt(7); n += OpCodes.ShiftLn(BigInt(1), b * 8); return n; }');
  expectMatch(code, /\(BigInteger\)\(1ul\) << /, '(BigInteger)1 << ...');
});
check('BigInt shifts: a shift of a uint64 variable stays a ulong shift', () => {
  const code = transpile('/**\n * @param {uint64} c - c\n * @returns {uint64} r\n */\nfunction f(c) { /** @type {uint64} */ let k = c; k = OpCodes.ShiftLn(k, 1n); return k; }');
  expectNoMatch(code, /\(BigInteger\)\(.*k/, 'k widened to BigInteger');
});
check('BigInt literal: a hex literal with a leading digit 8-F stays positive', () => {
  const code = transpile('/**\n * @param {bigint} k - key state\n * @returns {bigint} masked\n */\nfunction f(k) { return OpCodes.AndN(k, ~OpCodes.ShiftLn(0xFn, 120n)); }');
  expectMatch(code, /BigInteger\.Parse\("0F", System\.Globalization\.NumberStyles\.HexNumber\)/, 'Parse("0F") (Parse("F") is -1)');
});

// ---------------------------------------------------------------------------
// Array.prototype.slice
// ---------------------------------------------------------------------------
check('slice: a negative bound is passed on negative, for SliceArray to count from the end', () => {
  const code = transpile('/**\n * @param {uint8[]} a - a\n * @param {int32} n - n\n * @returns {uint8[]} r\n */\n' +
    'function f(a, n) { return a.slice(-n).concat(a.slice(0, -4)); }');
  expectMatch(code, /SliceArray\(a, -n, a\.Length\)/, 'SliceArray(a, -n, a.Length)');
  expectMatch(code, /SliceArray\(a, 0, -4\)/, 'SliceArray(a, 0, -4)');
  expectNoMatch(code, /a\.Length - /, 'a bound computed as Length - n');
});

// ---------------------------------------------------------------------------
// Switch statements: JavaScript fall-through as an explicit jump
// ---------------------------------------------------------------------------
const MODE_CLASSES = 'class Modes {\n  constructor() { /** @type {int32} */ this.ADD = 0; /** @type {int32} */ this.XOR = 1; }\n}\n' +
  '/** @type {Modes} */\nconst Mode = new Modes();\nclass Gen {\n  constructor() { /** @type {int32} */ this._mode = Mode.ADD; }\n' +
  '  /** @param {int32} m - mode */\n  set mode(m) { this._mode = m; }\n  /** @returns {int32} m */\n  get mode() { return this._mode; }\n' +
  '  /**\n   * @param {uint32} a - a\n   * @param {uint32} b - b\n   * @returns {uint32} r\n   */\n' +
  '  combine(a, b) { switch (this._mode) { case Mode.ADD: return OpCodes.Add32(a, b); case Mode.XOR: return OpCodes.Xor32(a, b); default: return a; } }\n}';
check('module binding: a module constant named like a member of a class is qualified inside the class', () => {
  const code = transpile(MODE_CLASSES);
  expectMatch(code, /this\._mode = Generated\.Mode\.ADD;/, 'Generated.Mode.ADD (the property Mode hides it)');
});
check('switch: a case label read off an object is matched by a guard (CS9135)', () => {
  const code = transpile(MODE_CLASSES);
  expectMatch(code, /case var __case when __case == Generated\.Mode\.ADD:/, 'case var __case when __case == Mode.ADD');
});
check('return: a null module sentinel returned from an array-typed function is cast to the array (CS0266)', () => {
  const code = transpile('const FAIL = null;\n/**\n * @param {int32} n - n\n * @returns {uint32[][]} r\n */\n' +
    'function f(n) { if (n < 0) return FAIL; return [[1, 2]]; }');
  expectMatch(code, /return \(uint\[\]\[\]\)\(?FAIL\)?;/, 'return (uint[][])FAIL;');
});
check('stub classes: a stub method result into a narrower JSDoc local is cast (CS0266)', () => {
  const code = transpile('class Holder {\n  constructor() {\n    /** @type {SparseMatrix} */\n    this.m = null;\n  }\n' +
    '  /** @returns {int32} r */\n  f() {\n    /** @type {uint8} */\n    const cell = this.m.get(1, 2);\n    return cell;\n  }\n}');
  expectMatch(code, /byte cell = (unchecked\()?\(byte\)\(?this\.M\.Get\(1, 2\)/, 'byte cell = (byte)this.M.Get(1, 2)');
});
check('members: a file class member named by a string is read by name (CS0021)', () => {
  const code = transpile('class Params {\n  constructor() {\n    /** @type {int32} */\n    this.publicKeySize = 32;\n  }\n}\n' +
    '/**\n * @param {Params} set - set\n * @param {string} field - member name\n * @returns {int32} r\n */\n' +
    'function sizeOf(set, field) {\n  /** @type {int32} */\n  const size = set[field];\n  return size;\n}');
  expectMatch(code, /JsMember\(set, field\)/, 'JsMember(set, field)');
});
check('ref: a member grown by a call statement goes through a temporary stored back (CS0206-free)', () => {
  const code = transpile('/**\n * @param {uint8[]} target - grown in place\n * @param {uint8[]} source - read\n * @returns {uint8[]} target\n */\n' +
    'function appendAll(target, source) {\n  for (let i = 0; i < source.length; i++) target.push(source[i]);\n  return target;\n}\n' +
    'class Holder {\n  constructor() {\n    /** @type {uint8[]} */\n    this.buffer = [];\n  }\n' +
    '  /** @param {uint8[]} data - data */\n  feed(data) {\n    appendAll(this.buffer, data);\n    const out = [1];\n    appendAll(out, data);\n  }\n}');
  expectMatch(code, /var __ref1 = this\.Buffer;\s*AppendAll\(ref __ref1, data\);\s*this\.Buffer = __ref1;/, 'temporary passed by ref and stored back');
  expectMatch(code, /AppendAll\(ref @?out, data\);/, 'a local passed by ref directly');
  expectMatch(code, /AppendAll\(ref byte\[\] target/, 'ref parameter');
});
check('accessors: a setter taking a string for a getter returning a class makes the property dynamic (CS0029)', () => {
  const code = transpile('class Group {\n  constructor() {\n    /** @type {int32} */\n    this.bits = 0;\n  }\n}\n' +
    'class Holder {\n  constructor() {\n    /** @type {Group} */\n    this._group = new Group();\n  }\n' +
    '  /** @param {string} name - group name */\n  set group(name) { this._group = new Group(); }\n' +
    '  /** @returns {Group} the group */\n  get group() { return this._group; }\n}');
  expectMatch(code, /public dynamic Group\b/, 'public dynamic Group');
});
check('accessors: the setter of a dynamic property reads its value as the declared parameter type (CS1977)', () => {
  const code = transpile('class Holder {\n  constructor() {\n    /** @type {string} */\n    this._key = "";\n  }\n' +
    '  /** @param {uint8[]} keyData - key bytes */\n  set key(keyData) { this._key = keyData ? String.fromCharCode(...keyData) : ""; }\n' +
    '  /** @returns {string} the key text */\n  get key() { return this._key; }\n}');
  expectMatch(code, /byte\[\] keyData = value;/, 'byte[] keyData = value;');
});
check('accessors: a dynamic property setter telling kinds of values apart keeps its value dynamic', () => {
  const code = transpile('class Holder {\n  constructor() {\n    /** @type {BigInt} */\n    this._state = 0n;\n  }\n' +
    '  /** @param {uint8[]} seedValue - seed */\n  set seed(seedValue) {\n    if (typeof seedValue === "bigint") this._state = seedValue;\n' +
    '    else this._state = BigInt(seedValue.length);\n  }\n  /** @returns {BigInt} the state */\n  get seed() { return this._state; }\n}');
  expectNoMatch(code, /byte\[\] seedValue = value;/, 'a byte[] seedValue local');
});
check('typeof: a typeof test names the JavaScript kind of the value', () => {
  const code = transpile('class Holder {\n  constructor() {\n    /** @type {BigInt} */\n    this._state = 0n;\n  }\n' +
    '  /** @param {uint8[]} seedValue - seed */\n  set seed(seedValue) {\n    if (typeof seedValue === "bigint") this._state = seedValue;\n' +
    '    else this._state = BigInt(seedValue.length);\n  }\n  /** @returns {BigInt} the state */\n  get seed() { return this._state; }\n}');
  expectMatch(code, /JsTypeOf\(\w+\) == "bigint"/, 'JsTypeOf(value) == "bigint"');
  expectNoMatch(code, /GetType\(\)\.ToString\(\)/, 'the C# type name');
});
check('length: storing the length member of an object assigns its Length, not a new array (CS0029)', () => {
  const code = transpile('class Register {\n  constructor() {\n    /** @type {int32} */\n    this.length = 0;\n  }\n}\n' +
    '/**\n * @param {int32} n - length\n * @returns {Register} r\n */\nfunction make(n) {\n  const reg = new Register();\n  reg.length = n;\n  return reg;\n}\n' +
    '/**\n * @param {uint8[]} a - buffer\n * @returns {uint8[]} r\n */\nfunction clear(a) { a.length = 0; return a; }');
  expectMatch(code, /reg\.Length = n;/, 'reg.Length = n');
  expectMatch(code, /a = new byte\[0\];/, 'an array length store still makes a new array');
});
check('qword: an array literal of ToQWord results is a ulong array (CS1503)', () => {
  const code = transpile('/**\n * @param {uint64[]} state - state\n * @returns {void}\n */\nfunction medium(state) { state[0] = OpCodes.ToQWord(state[0] + 1n); }\n' +
    '/**\n * @param {uint64[]} KX - table\n * @param {int32} backup - backup\n * @returns {void}\n */\n' +
    'function tiny(KX, backup) {\n  const tmp = [\n    OpCodes.ToQWord(OpCodes.ToQWord(KX[16] + KX[128]) + BigInt(backup)),\n    OpCodes.ToQWord(KX[17] + KX[129])\n  ];\n  medium(tmp);\n}');
  expectMatch(code, /ulong\[\] tmp = new ulong\[\]/, 'ulong[] tmp = new ulong[]');
});
check('bigint rows: a frozen BigInt row stored into a uint64 table converts element-wise (CS0019)', () => {
  const code = transpile('/**\n * @returns {uint64[][]} tables\n */\nfunction build() {\n  /** @type {uint64[][]} */\n  const table = new Array(8);\n' +
    '  for (let j = 0; j < 8; j++) {\n    /** @type {BigInt[]} */\n    const row = new Array(256);\n' +
    '    for (let b = 0; b < 256; b++) {\n      /** @type {BigInt} */\n      let acc = 0n;\n      row[b] = acc;\n    }\n' +
    '    table[j] = Object.freeze(row);\n  }\n  return table;\n}');
  expectMatch(code, /table\[j\] = row\.Select\(_v => (unchecked\()?\(ulong\)\(?_v\)?\)?\)\.ToArray\(\);/, 'row.Select(_v => (ulong)_v).ToArray()');
  expectNoMatch(code, /\(row & ulong\.MaxValue\)/, 'the row masked as a number');
});
check('conditions: a negated numeric call result tests it against 0 (CS0023)', () => {
  const code = transpile('/**\n * @param {int32} i - index\n * @returns {uint32} bit\n */\nfunction bitAt(i) { return OpCodes.And32(i, 1); }\n' +
    '/**\n * @param {int32} n - count\n * @returns {int32} r\n */\nfunction count(n) {\n  let c = 0;\n  for (let i = 0; i < n; ++i) if (!bitAt(i)) ++c;\n  return c;\n}');
  expectMatch(code, /if \(\(BitAt\(i\)\) == 0\)/, '(BitAt(i)) == 0');
});
check('maps: a module Map filled with dynamic values takes the type its typed .get declares (CS0029)', () => {
  const code = transpile('const HASH_CACHE = new Map();\n/**\n * @param {string} name - name\n * @returns {Algorithm} r\n */\n' +
    'function findHash(name) {\n  /** @type {Algorithm} */\n  const cached = HASH_CACHE.get(name);\n  if (cached) return cached;\n' +
    '  const found = AlgorithmFramework.Find(name);\n  HASH_CACHE.set(name, found);\n  return found;\n}');
  expectMatch(code, /Dictionary<string, Algorithm> HASH_CACHE/, 'Dictionary<string, Algorithm>');
});
check('jagged literals: an int array listed among byte arrays converts element-wise (CS0030)', () => {
  const code = transpile('/**\n * @param {uint8[][]} parts - parts\n * @param {int32} n - length\n * @returns {uint8[]} r\n */\n' +
    'function hash(parts, n) { return parts[0].slice(0, n); }\n' +
    '/**\n * @param {int32[]} randomness - octets\n * @returns {uint8[]} r\n */\n' +
    'function enc(randomness) {\n  const m = randomness.slice(0, 4);\n  /** @type {uint8[]} */\n  const domain = [1];\n  return hash([m, domain], 4);\n}');
  expectMatch(code, /new byte\[\]\[\] \{ m\.Select\(_v => (unchecked\()?\(byte\)\(?_v\)?\)?\)\.ToArray\(\), domain \}/, 'm converted element-wise');
  expectNoMatch(code, /\(byte\[\]\)\(?m\)?/, 'an array cast (byte[])m');
});
check('concat: a registered int array concatenated to a byte array chain is taken as bytes (CS1929)', () => {
  const code = transpile('/**\n * @param {uint8[]} a - bytes\n * @param {uint8[]} b - bytes\n * @param {int32[]} c - octets\n * @returns {uint8[]} r\n */\n' +
    'function join(a, b, c) { return a.concat(b).concat(c); }');
  expectMatch(code, /\.Concat\(c\.Select\(_v => (unchecked\()?\(byte\)\(?_v\)?\)?\)\.ToArray\(\)\)/, 'c converted to bytes');
});
check('typed arrays: a registered int member named like bytes is a size, not an array to copy (CS0411)', () => {
  const code = transpile('class Params {\n  constructor() {\n    /** @type {int32} */\n    this.seedBytes = 16;\n    /** @type {int32} */\n    this.pkBytes = 2 * this.seedBytes;\n  }\n' +
    '  /** @returns {uint8[]} r */\n  blank() { return new Uint8Array(this.pkBytes); }\n}\n' +
    '/**\n * @param {Params} p - p\n * @returns {uint8[]} Result\n */\nfunction make(p) {\n  const pk = new Uint8Array(p.pkBytes);\n  return pk;\n}');
  expectMatch(code, /byte\[\] pk = new byte\[p\.PkBytes\];/, 'new byte[p.PkBytes]');
  expectMatch(code, /return new byte\[this\.PkBytes\];/, 'new byte[this.PkBytes]');
});
check('ref: an array converted for a grown int parameter goes through a temporary converted back', () => {
  const code = transpile('/**\n * @param {int32[]} target - grown in place\n * @param {int32[]} source - read\n * @returns {int32[]} target\n */\n' +
    'function appendAll(target, source) {\n  for (let i = 0; i < source.length; i++) target.push(source[i]);\n  return target;\n}\n' +
    'class Holder {\n  constructor() {\n    /** @type {uint8[]} */\n    this.buffer = [];\n  }\n' +
    '  /** @param {uint8[]} data - data */\n  feed(data) {\n    appendAll(this.buffer, data);\n    /** @type {uint8[]} */\n    const out = [1];\n    appendAll(out, data);\n  }\n}');
  expectMatch(code, /var __ref\d+ = this\.Buffer\.Select\(/, 'the converted member in a temporary');
  expectMatch(code, /this\.Buffer = ArrayAs\(__ref\d+, this\.Buffer\);/, 'the member converted back');
  expectMatch(code, /@?out = ArrayAs\(__ref\d+, @?out\);/, 'the local converted back');
});
check('registry: a module constant named algorithms leaves the registry RegisteredAlgorithms (CS0102)', () => {
  const code = transpile('const { RegisterAlgorithm, BlockCipherAlgorithm } = AlgorithmFramework;\n' +
    'class AAlgorithm extends BlockCipherAlgorithm {\n  /** @param {string} name - name */\n  constructor(name) {\n    super();\n    this.name = name;\n  }\n}\n' +
    '/** @type {BlockCipherAlgorithm[]} */\nconst algorithms = [new AAlgorithm("A-1"), new AAlgorithm("A-2")];\n' +
    'for (let i = 0; i < algorithms.length; ++i) {\n  if (!AlgorithmFramework.Find(algorithms[i].name)) RegisterAlgorithm(algorithms[i]);\n}');
  expectMatch(code, /Algorithm\[\] RegisteredAlgorithms = /, 'RegisteredAlgorithms');
  expectMatch(code, /AlgorithmInstance = RegisteredAlgorithms\.FirstOrDefault\(\);/, 'AlgorithmInstance from RegisteredAlgorithms');
});
check('scopes: a local function parameter named like a differently cased outer local is renamed', () => {
  const code = transpile('/**\n * @param {uint32} x - x\n * @returns {uint32} r\n */\nfunction one(x) { return x; }\n' +
    '/**\n * @param {uint32} G - g\n * @returns {uint32} r\n */\nfunction outer(G) {\n  const F = G + 1;\n' +
    '  /**\n   * @param {int32} f - count\n   * @returns {uint32} r\n   */\n  function inner(f) { return one(F) + f; }\n  return inner(2);\n}');
  expectMatch(code, /uint Inner\(int fParam/, 'Inner(int fParam)');
  expectMatch(code, /One\((unchecked\(\(uint\)\()?f\)?\)?\) \+ fParam/, 'One(f) + fParam');
});
check('instances: CreateInstance into a local of the file instance class is cast down (CS0266)', () => {
  const code = transpile('const { BlockCipherAlgorithm, IBlockCipherInstance } = AlgorithmFramework;\n' +
    'class PermInstance extends IBlockCipherInstance {\n  /** @param {PermAlgorithm} algorithm - algorithm */\n  constructor(algorithm) { super(algorithm); }\n' +
    '  /** @returns {uint8[]} r */\n  Result() { return []; }\n}\n' +
    'class PermAlgorithm extends BlockCipherAlgorithm {\n  constructor() { super(); }\n' +
    '  /**\n   * @param {boolean} isInverse - inverse\n   * @returns {PermInstance} r\n   */\n  CreateInstance(isInverse) { return new PermInstance(this); }\n' +
    '  /** @returns {uint8[]} r */\n  run() {\n    /** @type {PermInstance} */\n    const instance = this.CreateInstance(false);\n    return instance.Result();\n  }\n}');
  expectMatch(code, /PermInstance instance = \(PermInstance\)\(?this\.CreateInstance\(false\)\)?;/, '(PermInstance)this.CreateInstance(false)');
});
check('slice: an array slice the IL gives a string member is JsSlice (CS1503)', () => {
  const code = transpile('class Entry {\n  /** @param {string} digest - digest */\n  constructor(digest) {\n    /** @type {string} */\n    this.digest = digest;\n  }\n}\n' +
    'const LIST = [new Entry("abc")];\n/**\n * @returns {string[]} r\n */\n' +
    'function heads() { return LIST.filter(entry => entry.digest.length > 0).map(entry => entry.digest.slice(0, 2) + "."); }');
  expectMatch(code, /JsSlice\(entry\.Digest, 0, 2\)/, 'JsSlice(entry.Digest, 0, 2)');
  expectNoMatch(code, /SliceArray\(entry\.Digest/, 'SliceArray on a string');
});
check('bigint arguments: a BigInt argument for a uint64 parameter keeps its low bits (OverflowException)', () => {
  const code = transpile('/**\n * @param {uint64} x - x\n * @returns {uint64} r\n */\nfunction m64(x) { return x; }\n' +
    '/**\n * @param {uint64} a - a\n * @param {int32} i - i\n * @returns {uint64} r\n */\nfunction mix(a, i) { return m64(a - BigInt(i)); }');
  expectMatch(code, /M64\((unchecked\()?\(ulong\)\(.*& ulong\.MaxValue\)/, 'M64((ulong)(... & ulong.MaxValue))');
});
check('optional members: a value member starting undefined is nullable and unwraps into a plain one', () => {
  const code = transpile('class Config {\n  constructor() {\n    /** @type {int32} */\n    this.count = undefined;\n  }\n}\n' +
    'class Holder {\n  constructor() {\n    /** @type {int32} */\n    this.count = 1;\n  }\n' +
    '  /** @param {Config} cfg - settings */\n  set config(cfg) {\n    if (cfg.count !== undefined) this.count = cfg.count;\n  }\n}');
  expectMatch(code, /public int\? Count \{ get; set; \}/, 'int? Count');
  expectMatch(code, /this\.Count = (unchecked\()?\(int\)\(?value\.Count\)?\)?;/, 'this.Count = (int)value.Count');
});
check('typed arrays: a copy of a dynamic value is cast to the typed array first (RuntimeBinderException)', () => {
  const code = transpile('class Holder {\n  constructor() {\n    this._privateKey = null;\n  }\n' +
    '  /** @param {uint8[]} keyBytes - key */\n  setKey(keyBytes) { this._privateKey = keyBytes ? new Uint8Array(keyBytes) : AlgorithmFramework.Find("x"); }\n' +
    '  /** @returns {uint8[]} r */\n  copy() { const k = new Uint8Array(this._privateKey); return k; }\n}');
  expectMatch(code, /\((unchecked\()?\(byte\[\]\)\(?this\._privateKey\)?\)?\)\.ToArray\(\)/, '((byte[])this._privateKey).ToArray()');
});
check('concat: dynamic arrays concatenated are cast to byte arrays first (RuntimeBinderException)', () => {
  const code = transpile('class Holder {\n  constructor() {\n    this._a = null;\n    this._b = null;\n  }\n' +
    '  /** @param {uint8[]} k - key */\n  set(k) { this._a = k ? k : AlgorithmFramework.Find("x"); this._b = k ? k : AlgorithmFramework.Find("y"); }\n' +
    '  /** @returns {uint8[]} r */\n  both() { return this._a.concat(this._b); }\n}');
  expectMatch(code, /\((unchecked\()?\(byte\[\]\)\(?this\._a\)?\)?\)\.Concat\((unchecked\()?\(byte\[\]\)\(?this\._b\)?\)?\)/, '((byte[])this._a).Concat((byte[])this._b)');
});
check('dynamic arguments: a dynamic value for an int array parameter converts at run time (RuntimeBinderException)', () => {
  const code = transpile('/**\n * @param {int32[]} key - key\n * @returns {int32} r\n */\nfunction first(key) { return key[0]; }\n' +
    'class Holder {\n  constructor() {\n    this._key = null;\n  }\n' +
    '  /** @param {uint8[]} k - key */\n  set(k) { this._key = k ? k : AlgorithmFramework.Find("x"); }\n' +
    '  /** @returns {int32} r */\n  head() { return first(this._key); }\n}');
  expectMatch(code, /First\(AsArrayOf<int>\(\(object\)\(?this\._key\)?\)\)/, 'First(AsArrayOf<int>((object)this._key))');
});
check('inheritance: a backing field a subclass sets is protected in the base and not redeclared', () => {
  const code = transpile('class Base {\n  constructor() {\n    /** @type {int32} */\n    this._rounds = 16;\n  }\n' +
    '  /** @returns {int32} r */\n  get rounds() { return this._rounds; }\n' +
    '  /** @param {int32} value - rounds */\n  set rounds(value) { this._rounds = value; }\n}\n' +
    'class Derived extends Base {\n  constructor() {\n    super();\n    this._rounds = 32;\n  }\n}');
  expectMatch(code, /protected int _rounds;/, 'protected int _rounds');
  expectNoMatch(code, /class Derived[^}]*_rounds \{ get; set; \}/, 'a redeclared _rounds in Derived');
});
check('compound assignment: an element with a side-effecting index is read and written once', () => {
  const code = transpile('/**\n * @param {uint8[]} buf - buffer\n * @param {uint8[]} data - data\n * @returns {int32} r\n */\n' +
    'function absorb(buf, data) {\n  let n = 0;\n  for (let i = 0; i < data.length; ++i) buf[n++] ^= data[i];\n  return n;\n}');
  expectMatch(code, /buf\[n\+\+\] \^= (unchecked\()?\(byte\)\(?data\[i\]\)?\)?;/, 'buf[n++] ^= (byte)data[i]');
  expectNoMatch(code, /buf\[n\+\+\] = /, 'buf[n++] = ...buf[n++]...');
});
check('bitwise: x | 0 on an unsigned value is its signed 32-bit value', () => {
  const code = transpile('/**\n * @param {uint32} value - Input value\n * @returns {uint32} - Hashed value\n */\n' +
    'function mix(value) {\n  value = OpCodes.ToUint32((value|0) * 0x27d4eb2d);\n  return value;\n}');
  expectMatch(code, /JsMul\((unchecked\()?\(int\)\(?value\)?\)?, 0x27D4EB2D\)/, 'JsMul((int)value, ...)');
  expectNoMatch(code, /value \| 0u/, 'value | 0u');
});
check('division: a quotient of integers nested in a value going into doubles divides as doubles', () => {
  const code = transpile('/**\n * @param {int32[]} counts - counts\n * @param {int32} total - total\n * @returns {float64[]} r\n */\n' +
    'function pct(counts, total) {\n  /** @type {float64[]} */\n  const percentages = [];\n' +
    '  for (let k = 0; k < 26; k++) percentages.push(total > 0 ? (counts[k] / total) * 100 : 0);\n' +
    '  /** @type {float64} */\n  const first = (counts[0] / total) * 100;\n  percentages.push(first);\n  return percentages;\n}');
  expectMatch(code, /\(double\)\(?counts\[k\]\)? \/ total \* 100/, '(double)counts[k] / total * 100 in the push');
  expectMatch(code, /double first = \(double\)\(?counts\[0\]\)? \/ total \* 100/, '(double)counts[0] / total * 100 in the declaration');
});
check('defaults: a default computed from another argument is applied in the body', () => {
  const code = transpile('/**\n * @param {float64[]} weights - weights\n * @param {int32} [symbolCount] - count\n * @returns {int32[]} lengths\n */\n' +
    'function buildCodeLengths(weights, symbolCount = weights.length) {\n  /** @type {int32} */\n  const count = symbolCount;\n  return new Array(count).fill(0);\n}\n' +
    '/**\n * @param {float64[]} w - weights\n * @returns {int32[]} lengths\n */\nfunction all(w) { return buildCodeLengths(w); }');
  expectMatch(code, /BuildCodeLengths\(double\[\] weights = default, int\? symbolCountArg = null\)/, 'int? symbolCountArg = null');
  expectMatch(code, /int symbolCount = symbolCountArg \?\? weights\.Length;/, 'int symbolCount = symbolCountArg ?? weights.Length');
});
check('module init: a fill or a module function call at module scope runs at load time', () => {
  const code = transpile('/** @type {int32[]} */\nconst LENGTHS = new Array(30);\nLENGTHS.fill(5);\n' +
    '/** @type {uint32[]} */\nconst TABLE = new Array(4);\n/** @returns {void} */\nfunction initTable() { for (let i = 0; i < 4; ++i) TABLE[i] = i * 3; }\ninitTable();');
  expectMatch(code, /static bool ModuleInit\d+\(\)\s*\{\s*Array\.Fill\(LENGTHS, 5\)|static bool ModuleInit\d+\(\)\s*\{[^}]*LENGTHS/, 'a ModuleInit filling LENGTHS');
  expectMatch(code, /static bool ModuleInit\d+\(\)\s*\{\s*InitTable\(\);/, 'a ModuleInit calling InitTable()');
});
check('concat: an argument concatenated to a byte array literal converts to bytes (CS1929)', () => {
  const code = transpile('/** @returns {uint8[]} r */\nfunction header() { return [0, 0, 0, 0, 255].concat(Array.from({length: 3}, (_, i) => i)); }');
  expectMatch(code, /new byte\[\] \{[^}]*\}\.Concat\(.*\.Select\(_v => (unchecked\()?\(byte\)\(?_v\)?\)?\)\.ToArray\(\)\)\.ToArray\(\)/, 'the int sequence converted to bytes');
});
check('nullable numbers: a nullable member is falsy when null or 0, and unwraps when returned', () => {
  const code = transpile('class Gen {\n  constructor() {\n    /** @type {int32|null} */\n    this._skipCount = null;\n  }\n' +
    '  /** @param {int32} n - skip */\n  skip(n) { this._skipCount = n; }\n' +
    '  /** @returns {int32} r */\n  get skipCount() { return (this._skipCount ? this._skipCount : 0); }\n}');
  expectMatch(code, /\(this\._skipCount \?\? 0\) != 0 \?/, '(this._skipCount ?? 0) != 0');
  expectMatch(code, /return (unchecked\()?\(int\)/, 'the result cast to int');
});
check('calls: a bare call is typed by the module function, not a same-named method', () => {
  const code = transpile(SAME_NAMED_CALLS);
  expectMatch(code, /return Generated\.Decapsulate\(.*\)\.Select\(_v => (unchecked\()?\(int\)\(?_v\)?\)?\)\.ToArray\(\);/, 'the byte[] result converted to int[]');
});
check('return: an array of another numeric element type converts element-wise (CS0029)', () => {
  const code = transpile('/**\n * @param {uint8[]} b - bytes\n * @returns {int32[]} r\n */\nfunction widen(b) { /** @type {uint8[]} */ const c = b.slice(0); return c; }');
  expectMatch(code, /return c\.Select\(_v => (unchecked\()?\(int\)\(?_v\)?\)?\)\.ToArray\(\);/, 'return c.Select(...).ToArray()');
});
const SUBARRAY_VIEWS = '/**\n * @param {uint8[]} dest - written\n * @param {uint8[]} src - read\n * @param {int32} length - length\n */\n' +
  'function xorBlock(dest, src, length) {\n  for (let i = 0; i < length; i++) dest[i] = OpCodes.Xor32(dest[i], src[i]);\n}\n' +
  '/**\n * @param {uint8[]} V - state\n * @param {uint8[]} data - data\n * @param {int32} off - offset\n */\n' +
  'function absorb(V, data, off) {\n  xorBlock(V.subarray(off), data, 4);\n  const half = V.subarray(16, 32);\n  xorBlock(half, data, 4);\n  xorBlock(data, V.subarray(0, 4), 4);\n}';
check('subarray views: a view handed to a function writing it is copied back after the call', () => {
  const code = transpile(SUBARRAY_VIEWS);
  expectMatch(code, /var (__view\d+) = OpCodes\.SliceArray\(v, off, v\.Length\);\s*XorBlock\(\1, data, 4\);\s*Array\.Copy\(\1, 0, v, off, \1\.Length\);/, 'temporary view copied back at off');
  expectMatch(code, /XorBlock\(half, data, 4\);\s*Array\.Copy\(half, 0, v, 16, half\.Length\);/, 'const view local copied back at 16');
});
check('subarray views: a view for a parameter only read is passed as is', () => {
  const code = transpile(SUBARRAY_VIEWS);
  expectMatch(code, /XorBlock\(data, OpCodes\.SliceArray\(v, 0, 4\), 4\);/, 'read-only view passed directly');
});
const REGISTRATION_LOOP ='const { RegisterAlgorithm, BlockCipherAlgorithm } = AlgorithmFramework;\n' +
  'const SETS = [{ name: "A-1", n: 1 }, { name: "A-2", n: 2 }];\n' +
  'class AAlgorithm extends BlockCipherAlgorithm {\n  /** @param {string} name - name */\n  constructor(name) {\n    super();\n    this.name = name;\n  }\n}\n' +
  'for (let i = 0; i < SETS.length; ++i) {\n  const instance = new AAlgorithm(SETS[i].name);\n' +
  '  if (!AlgorithmFramework.Find(instance.name)) {\n    RegisterAlgorithm(instance);\n  }\n}';
check('registry: a module loop over computed data registers into the Algorithms registry when it runs', () => {
  const code = transpile(REGISTRATION_LOOP);
  expectMatch(code, /registered\.Add\(\(Algorithm\)\(?instance\)?\);/, 'registered.Add((Algorithm)instance)');
  expectMatch(code, /Algorithms = new Algorithm\[\] \{\s*\}\.Concat\(RegistrationLoop1\(\)\)\.ToArray\(\);/, 'Algorithms concatenating RegistrationLoop1()');
});
check('conditions: a negated dynamic call result is its truthiness', () => {
  const code = transpile(REGISTRATION_LOOP);
  expectMatch(code, /if \(!IsTruthy\(AlgorithmFramework\.Find\(instance\.Name\)\)\)/, '!IsTruthy(AlgorithmFramework.Find(...))');
});
check('maps: a module Map takes its value type from the .set calls of the file (CS0029)', () => {
  const code = transpile('class Pair {\n  /** @param {int32} a - a */\n  constructor(a) {\n    /** @type {int32} */\n    this.a = a;\n  }\n}\n' +
    'const CACHE = new Map();\n/**\n * @param {string} key - key\n * @returns {Pair} r\n */\n' +
    'function lookup(key) {\n  /** @type {Pair} */\n  const cached = CACHE.get(key);\n  if (cached) return cached;\n' +
    '  const pair = new Pair(1);\n  CACHE.set(key, pair);\n  return pair;\n}');
  expectMatch(code, /Dictionary<string, Pair> CACHE = new Dictionary<string, Pair>\(\)/, 'Dictionary<string, Pair> CACHE');
});
check('static calls: the result of a static method of a file class is typed by its signature (CS0266)', () => {
  const code = transpile('class Coder {\n  /**\n   * @param {uint8[]} data - Input\n   * @returns {int32} r\n   */\n' +
    '  run(data) {\n    /** @type {int32} */\n    const h = Coder._hash3(data, 0);\n    return h;\n  }\n' +
    '  /**\n   * @param {uint8[]} data - Input\n   * @param {int32} pos - Position\n   * @returns {uint32} Hash bucket\n   */\n' +
    '  static _hash3(data, pos) { return OpCodes.And32(data[pos] * 33, 0xFFF); }\n}');
  expectMatch(code, /int h = (unchecked\()?\(int\)\(?Coder\._hash3\(data, 0\)/, 'int h = (int)Coder._hash3(data, 0)');
});
check('fields: a JSDoc field type is known to a function declared ahead of the class (CS0266)', () => {
  const code = transpile('/**\n * @param {State} state - state\n * @param {int32} pos - pos\n * @returns {int32} r\n */\n' +
    'function local(state, pos) {\n  /** @type {int32} */\n  const at = pos - state.resetPos;\n  return at;\n}\n' +
    'class State {\n  constructor() {\n    /** @type {float64} */\n    this.resetPos = 0;\n  }\n}');
  expectMatch(code, /int at = (unchecked\()?\(int\)\(pos - state\.ResetPos\)/, 'int at = (int)(pos - state.ResetPos)');
});
check('for: a loop variable walking linked nodes keeps the node class type (CS0029)', () => {
  const code = transpile('class Node {\n  constructor() {\n    /** @type {Node} */\n    this.parent = null;\n  }\n}\n' +
    '/**\n * @param {Node} node - node\n * @returns {int32} r\n */\nfunction depth(node) { let d = 0; for (let n = node.parent; n !== null; n = n.parent) ++d; return d; }');
  expectMatch(code, /for \(Node n = node\.Parent; n != null; n = n\.Parent\)/, 'for (Node n = node.Parent; ...)');
});
check('for: a counting loop variable stays int', () => {
  const code = transpile('/**\n * @param {uint8[]} a - a\n * @returns {int32} r\n */\nfunction f(a) { let s = 0; for (let i = a.length - 1; i >= 0; --i) s += a[i]; return s; }');
  expectMatch(code, /for \(int i = /, 'for (int i = ...)');
});
const OVERRIDING_CLASSES ='class Base {\n  /** @param {uint8[]} s - state */\n  run(s) { this.step(s); }\n' +
  '  /** @param {uint8[]} s - state */\n  step(s) { throw new Error("abstract"); }\n}\n' +
  'class Derived extends Base {\n  /** @param {uint8[]} s - state */\n  step(s) { s[0] = 1; }\n}\n' +
  'class Other extends Base {\n  /**\n   * @param {uint8[]} s - state\n   * @param {int32} n - count\n   */\n  step(s, n) { s[0] = n; }\n}';
check('inheritance: a method a subclass redeclares with the same signature is virtual, the redeclaration an override', () => {
  const code = transpile(OVERRIDING_CLASSES);
  expectMatch(code, /public virtual void Step\(byte\[\] s( = null)?\)/, 'virtual Step in the base');
  expectMatch(code, /public override void Step\(byte\[\] s( = null)?\)/, 'override Step in the subclass');
});
check('inheritance: a redeclaration with a different signature stays a separate method', () => {
  const code = transpile(OVERRIDING_CLASSES);
  expectMatch(code, /public void Step\(byte\[\] s( = default)?, int n( = default)?\)/, 'plain Step(byte[], int)');
});
check('switch: a case falling through into default jumps with `goto default;`', () => {
  const code = transpile('function f(m) { let r = 0; switch (m) { case "a": r = 1; default: r += 2; } return r; }');
  expectMatch(code, /r = 1;\s*goto default;/, 'goto default; after the falling case');
  expectNoMatch(code, /goto case default/, 'the invalid `goto case default`');
});
check('switch: a case falling through into a labelled case jumps with `goto case <label>;`', () => {
  const code = transpile('function f(m) { let r = 0; switch (m) { case 1: r = 1; case 2: r += 2; break; } return r; }');
  expectMatch(code, /r = 1;\s*goto case 2;/, 'goto case 2;');
});
check('switch: a case whose block, or whose if/else, ends in a jump on every path gets no extra jump', () => {
  const code = transpile('function f(m, x) { switch (m) { case "a": { const y = x + 1; return y; } ' +
    'case "b": if (x) { return 1; } else { throw new Error("no"); } default: return 0; } }');
  expectNoMatch(code, /goto /, 'a goto after a terminated case');
});

// ---------------------------------------------------------------------------
// byteLength: a DataView's property, or an object's own method
// ---------------------------------------------------------------------------
check('byteLength: a call of an object\'s own byteLength() method stays that call', () => {
  const code = transpile('class Cursor {\n  constructor() { /** @type {int32} */ this.pos = 0; }\n' +
    '  /** @returns {float64} bytes */\n  byteLength() { return Math.ceil(this.pos / 8); }\n}\n' +
    'function g() { const cur = new Cursor(); const n = 3 + cur.byteLength(); return n; }');
  expectMatch(code, /3 \+ cur\.ByteLength\(\)/, 'cur.ByteLength()');
  expectNoMatch(code, /UNHANDLED_EXPRESSION/, 'an unhandled expression placeholder');
});
check('byteLength: a byte buffer\'s byteLength() is its Length', () => {
  const code = transpile('/**\n * @param {uint8[]} buf - bytes\n * @returns {int32} length\n */\nfunction g(buf) { return buf.byteLength(); }');
  expectMatch(code, /return buf\.Length;/, 'buf.Length');
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
    '/**\n * @param {BigInt} x - value\n * @returns {BigInt} low 64 bits\n */\nfunction wrap64(x) { return OpCodes.ToQWord(x); }\n' +
    'class XorAlgorithm extends BlockCipherAlgorithm { constructor() { super(); this.name = "XorProbe"; } }\nRegisterAlgorithm(new XorAlgorithm());', true)
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
      ulong absorbed = absorber.Length; // uint64, as the framework documents it
      Eq("absorbed", absorbed, 5ul);
      // Finish hands the total as a uint64, which MerkleDamgardBlocks takes
      Eq("finish-ulong", absorber.Finish((held, pending, total) => FrameworkFunctions.MerkleDamgardBlocks(held, pending, total, new { BlockSize = 64, LengthBytes = 8 }).Length), 1);
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
      // The registry finds a registered algorithm by name, and nothing for an unknown one
      Eq("find", AlgorithmFramework.Find("XorProbe")?.Name, "XorProbe");
      Eq("find-none", AlgorithmFramework.Find("NoSuchAlgorithm") == null, true);
      Eq("getall", AlgorithmFramework.GetAll().Length >= 1, true);
      // ParseBigInt reads JavaScript BigInt text; PadString repeats its pad
      Eq("parsebigint-hex", FrameworkFunctions.ParseBigInt("0xff"), 255);
      Eq("parsebigint-dec", FrameworkFunctions.ParseBigInt("-12"), -12);
      Eq("parsebigint-bin", FrameworkFunctions.ParseBigInt("0b101"), 5);
      Eq("padstart", FrameworkFunctions.PadString("7", 4, "ab", true), "aba7");
      Eq("padend", FrameworkFunctions.PadString("7", 3, "0", false), "700");
      Eq("pad-long", FrameworkFunctions.PadString("12345", 3, "0", true), "12345");
      // BitStream writers take a signed or dynamic number as its low 32 bits
      var bits = new BitStream();
      dynamic signedLength = 0x01020304;
      bits.WriteUint32LE(signedLength);
      bits.WriteByte(-1);
      Eq("bitstream-signed", Convert.ToHexString(bits.ToArray()), "04030201FF");
      // SetGrow stores by index, growing the array as a JavaScript store does
      var grown = new uint[0];
      OpCodes.SetGrow(ref grown, 2, 7u);
      Eq("setgrow", string.Join(",", grown), "0,0,7");
      OpCodes.SetGrow(ref grown, 0, 1u);
      Eq("setgrow-inside", string.Join(",", grown), "1,0,7");
      Eq("grown", OpCodes.Grown(new byte[1], 3).Length, 4);
      // Foundation classes take a computed (double) size as JavaScript does
      Eq("graph-double", new BipartiteGraph(3.0, 2.0) != null, true);
      Eq("matrix-double", new SparseMatrix(2.0, 2.0) != null, true);
      var kept = new byte[5];
      Eq("grown-same", ReferenceEquals(OpCodes.Grown(kept, 2), kept), true);
      // BytesToChars maps each byte to one char; RotL64_HL rotates the high:low pair
      Eq("bytestochars", OpCodes.BytesToChars(new byte[] { 65, 0xE9 }), "Aé");
      Eq("rotl64-hl", OpCodes.RotL64_HL(0x80000000u, 1u, 1), (0u, 3u));
      Eq("rotl64-hl-32", OpCodes.RotL64_HL(1u, 2u, 32), (2u, 1u));
      Eq("rotl64-hl-0", OpCodes.RotL64_HL(1u, 2u, 64), (1u, 2u));
      // SliceArray is Array.prototype.slice: bounds clamp, negatives count from the end
      Eq("slice-past-end", Convert.ToHexString(OpCodes.SliceArray(new byte[] { 1, 2, 3 }, 1, 9)), "0203");
      Eq("slice-neg-start", Convert.ToHexString(OpCodes.SliceArray(new byte[] { 1, 2, 3 }, -2, 3)), "0203");
      Eq("slice-neg-past", Convert.ToHexString(OpCodes.SliceArray(new byte[] { 1, 2, 3 }, -5, 3)), "010203");
      Eq("slice-neg-end", Convert.ToHexString(OpCodes.SliceArray(new byte[] { 1, 2, 3 }, 0, -1)), "0102");
      Eq("slice-crossed", OpCodes.SliceArray(new byte[] { 1, 2, 3 }, 2, 1).Length, 0);
      Eq("slice-generic", string.Join(",", OpCodes.SliceArray(new uint[] { 7, 8 }, 1, 5)), "8");
      // JsMul rounds a product past 2^53 as a JavaScript number does
      Eq("jsmul-exact", FrameworkFunctions.JsMul(65535u, 65537u), 4294967295u);
      Eq("jsmul-rounded", FrameworkFunctions.JsMul(1099087573u, 2865916745u), unchecked((uint)(ulong)(1099087573.0 * 2865916745.0)));
      Eq("jsmul-neg", FrameworkFunctions.JsMul(-3, 5), -15);
      Eq("jsmul-long",FrameworkFunctions.JsMul(4294967295L, 4294967295L), unchecked((long)(ulong)(4294967295.0 * 4294967295.0)));
      // ConstantTimeCompare takes the length to compare, as OpCodes.js does
      Eq("ctc-equal", OpCodes.ConstantTimeCompare(new byte[] { 1, 2 }, new byte[] { 1, 2 }, 2), true);
      Eq("ctc-differ", OpCodes.ConstantTimeCompare(new byte[] { 1, 2 }, new byte[] { 1, 3 }), false);
      Eq("ctc-lengths", OpCodes.ConstantTimeCompare(new byte[] { 1, 2 }, new byte[] { 1, 2, 3 }, 2), false);
      // SparseMatrix counts its entries and takes JavaScript-number (double) indexes
      var sm = new SparseMatrix(3, 3);
      sm.Set(0.0, 2.0, 1.0);
      sm.Set(1, 1, 1);
      sm.Set(1, 1, 0);
      Eq("sparse-count", sm.NonZeroCount(), 1);
      Eq("sparse-double-set", sm.Get(0, 2), 1);
      // JsMember reads a property by its JavaScript or C# name, undefined as null
      var bag = new TestCase { Text = "t" };
      Eq("member-camel", (string)FrameworkFunctions.JsMember(bag, "text"), "t");
      Eq("member-missing", (object)FrameworkFunctions.JsMember(bag, "nothing") == null, true);
      // AsArrayOf takes a dynamic value as an array of the declared element type
      Eq("as-array-same", FrameworkFunctions.AsArrayOf<int>(new int[] { 3 })[0], 3);
      Eq("as-array-bytes", string.Join(",", FrameworkFunctions.AsArrayOf<int>(new byte[] { 1, 255 })), "1,255");
      Eq("as-array-null", FrameworkFunctions.AsArrayOf<int>(null) == null, true);
      // JsTypeOf names the JavaScript kind of a value
      Eq("typeof-number", FrameworkFunctions.JsTypeOf(5), "number");
      Eq("typeof-bigint", FrameworkFunctions.JsTypeOf(new BigInteger(5)), "bigint");
      Eq("typeof-string", FrameworkFunctions.JsTypeOf("x"), "string");
      Eq("typeof-undefined", FrameworkFunctions.JsTypeOf(null), "undefined");
      Eq("typeof-object", FrameworkFunctions.JsTypeOf(new byte[1]), "object");
      // ArrayAs converts a copy back to the element type of the array it came from
      Eq("array-as", Convert.ToHexString(FrameworkFunctions.ArrayAs(new int[] { 1, 255, 256 }, new byte[0])), "01FF00");
      Eq("array-as-int", string.Join(",", FrameworkFunctions.ArrayAs(new byte[] { 7 }, new int[0])), "7");
      // OpCodes.UInt64 works on [high32, low32] pairs
      Eq("u64-shr", string.Join(",", OpCodes.UInt64.Shr(OpCodes.UInt64.Create(0x12345678, 0x9ABCDEF0), 8)), "1193046,2023406814");
      Eq("u64-shl-wide", string.Join(",", OpCodes.UInt64.Shl(OpCodes.UInt64.Create(0, 1), 40)), "256,0");
      Eq("u64-xor", string.Join(",", OpCodes.UInt64.Xor(OpCodes.UInt64.Create(0xFFFFFFFF, 0), OpCodes.UInt64.Create(0xF, 0xF))), "4294967280,15");
      Eq("u64-add-carry", string.Join(",", OpCodes.UInt64.Add(OpCodes.UInt64.Create(0, 0xFFFFFFFF), OpCodes.UInt64.Create(0, 1))), "1,0");
      Eq("u64-rotr", string.Join(",", OpCodes.UInt64.Rotr(OpCodes.UInt64.Create(0, 1), 1)), "2147483648,0");
      Eq("u64-bytes", Convert.ToHexString(OpCodes.UInt64.ToBytes(OpCodes.UInt64.FromBytes(new byte[] { 1, 2 }))), "0000000000000102");
      // ToShort/ToLong sign-wrap to 16/64 bits; CreateUint64ArrayFromHex yields [high, low] pairs
      Eq("toshort-wrap", OpCodes.ToShort(0x18000), (short)-32768);
      Eq("toshort-max", OpCodes.ToShort(32767), (short)32767);
      Eq("tolong-wrap", OpCodes.ToLong(BigInteger.Pow(2, 63)), -BigInteger.Pow(2, 63));
      Eq("tolong-neg", OpCodes.ToLong(new BigInteger(-1)), new BigInteger(-1));
      Eq("tolong-mask", OpCodes.ToLong(BigInteger.Pow(2, 64) + 5), new BigInteger(5));
      Eq("u64hex", string.Join(",", OpCodes.CreateUint64ArrayFromHex(new[] { "0x0123456789ABCDEF", "ff" }).Select(p => p[0] + ":" + p[1])), "19088743:2309737967,0:255");
      // JsSlice/JsSubstr are string.prototype.slice/substr
      Eq("sslice-neg", FrameworkFunctions.JsSlice("abcdef", 0, -2), "abcd");
      Eq("sslice-past", FrameworkFunctions.JsSlice("abc", 1, 9), "bc");
      Eq("sslice-crossed", FrameworkFunctions.JsSlice("abc", 2, 1), "");
      Eq("sslice-from-end", FrameworkFunctions.JsSlice("abc", -2), "bc");
      Eq("substr", FrameworkFunctions.JsSubstr("abcdef", 1, 2), "bc");
      Eq("substr-past", FrameworkFunctions.JsSubstr("abc", 2, 5), "c");
      // JsSplit is string.prototype.split
      Eq("split-chars", string.Join("|", FrameworkFunctions.JsSplit("abc", "")), "a|b|c");
      Eq("split-sep", string.Join("|", FrameworkFunctions.JsSplit("a,,b", ",")), "a||b");
      Eq("split-none", string.Join("|", FrameworkFunctions.JsSplit("a b", null)), "a b");
      Eq("split-empty", FrameworkFunctions.JsSplit("", "").Length, 0);
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
