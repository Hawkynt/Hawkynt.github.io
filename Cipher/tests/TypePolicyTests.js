#!/usr/bin/env node
/**
 * TypePolicyTests.js - unit tests for the transpiler's type resolution order
 * (OpCodes JSDoc, then framework interfaces, then local JSDoc, then nothing)
 * and for the untyped-site count built on it (tests/TypeCoverage.js).
 * Every case is Given / When / Then; classes, boundaries and error cases.
 *
 * Usage: node tests/TypePolicyTests.js [--verbose]
 */

'use strict';

const path = require('path');
const quiet = fn => { const l = console.log, e = console.error; console.log = console.error = () => {}; try { return fn(); } finally { console.log = l; console.error = e; } };
const { TypeAwareJSASTParser, PreciseTypeKnowledge, JSDocParser } = quiet(() => require(path.join(__dirname, '..', 'type-aware-transpiler.js')));
const TypeCoverage = require('./TypeCoverage.js');
const { isPreciseType } = require('./JSDocTierAudit.js');

const verbose = process.argv.includes('--verbose');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); ++passed; if (verbose) console.log(`  ✓ ${name}`); }
  catch (e) { ++failed; console.log(`  ✗ ${name}\n      ${e.message}`); }
}
function equal(actual, expected, what = '') {
  const a = actual && typeof actual === 'object' && actual.name ? actual.name : actual;
  if (a !== expected) throw new Error(`${what}expected ${JSON.stringify(expected)}, got ${JSON.stringify(a)}`);
}
function ok(cond, what) { if (!cond) throw new Error(what); }

/** Parse and return the IL AST. */
function il(code) { return quiet(() => new TypeAwareJSASTParser(code).parse()); }

/** First node matching a predicate (depth-first, skipping loc/range). */
function find(node, pred) {
  if (!node || typeof node !== 'object') return null;
  if (Array.isArray(node)) { for (const n of node) { const r = find(n, pred); if (r) return r; } return null; }
  if (pred(node)) return node;
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'range' || k === 'leadingComments') continue;
    const r = find(node[k], pred);
    if (r) return r;
  }
  return null;
}
const declOf = (ast, name) => find(ast, n => n.type === 'VariableDeclarator' && n.id && n.id.name === name);
const sites = code => TypeCoverage.analyzeSource(code).sites;

console.log('Type policy tests');

// ------------------------------------------------------------ JSDoc audit
test('audit: given width-and-sign types, when judged, then they are precise', () => {
  for (const t of ['uint8', 'uint32[]', 'BigInt', 'int32', '(h: uint32, l: uint32)', 'uint8[]|null', '...uint32', 'KeySize[]'])
    ok(isPreciseType(t, false), `${t} should be precise`);
});
test('audit: given types without width or sign, when judged, then they are imprecise', () => {
  for (const t of ['number', 'Array', '*', 'any', 'Object', 'object', 'number[]', 'uint8|number', '(h: number)'])
    ok(!isPreciseType(t, false), `${t} should be imprecise`);
});
test('audit: given a float member, when number is judged, then it is accepted', () => {
  ok(isPreciseType('number', true), 'number is precise for a float member');
});

// ------------------------------------------------------------ loaders
il('0'); // the first parser loads OpCodes.js and AlgorithmFramework.js
const knowledge = TypeAwareJSASTParser.sharedTypeKnowledge;
test('tier 1 loader: given OpCodes, when loaded, then top-level helpers are keyed by name', () => {
  equal(knowledge.opCodesTypes.RotL32.returns, 'uint32');
  equal(knowledge.opCodesTypes.ToUint32.returns, 'uint32', 'ToUint32 (was {number} = int32): ');
});
test('tier 1 loader: given the nested UInt64 object, when loaded, then its members are qualified and do not shadow top-level names', () => {
  ok(knowledge.opCodesTypes['UInt64.xor'], 'UInt64.xor is loaded');
  ok(!knowledge.opCodesTypes.xor && !knowledge.opCodesTypes.create, 'no bare nested names');
});
test('tier 1 loader: given control-flow keywords in OpCodes bodies, when loaded, then none becomes a signature', () => {
  for (const k of ['if', 'for', 'while', 'function']) ok(!knowledge.opCodesTypes[k], `${k} must not be a signature`);
});
test('tier 1 loader: given a fresh knowledge base, when a member has no JSDoc, then it is not invented', () => {
  const k = new PreciseTypeKnowledge();
  k.loadTypesFromSource('const OpCodes = {\n    /**\n     * @param {uint8} a\n     * @returns {uint8}\n     */\n    A: function(a) { return a; },\n    B: function(b) { return b; }\n};', 'opcodes');
  equal(k.opCodesTypes.A.returns, 'uint8');
  ok(!k.opCodesTypes.B, 'B has no JSDoc');
});
test('tier 2 loader: given described field JSDoc, when loaded, then every field of the class is typed', () => {
  equal(knowledge.frameworkTypes.IBlockCipherInstance.properties.BlockSize, 'int32');
  equal(knowledge.frameworkTypes.IHashFunctionInstance.properties.OutputSize, 'int32');
  equal(knowledge.frameworkTypes.Algorithm.properties.tests, 'TestCase[]');
});
test('tier 2 loader: given an accessor pair, when loaded, then it is a typed property', () => {
  equal(knowledge.frameworkTypes.IBlockCipherInstance.properties.key, 'uint8[]');
});
test('tier 2 loader: given an optional [param], when loaded, then its type is kept', () => {
  equal(knowledge.frameworkTypes.IBlockCipherInstance.methods.RequireBlockMultiple.params[0], 'int32');
});
test('tier 2 loader: given enums and exported functions, when loaded, then both are known', () => {
  ok(knowledge.frameworkEnums.has('CategoryType'), 'CategoryType enum');
  equal(knowledge.frameworkFunctions.Find.returns, 'Algorithm');
});
test('JSDoc parser: given dotted option names, when parsed, then they are not parameters', () => {
  const doc = new JSDocParser().parseJSDoc('/**\n * @param {Object} options\n * @param {int} options.size\n * @param {bool} [flag=false]\n */');
  equal(doc.params.map(p => p.name).join(','), 'options,flag');
});

// ------------------------------------------------------------ tier 3
test('tier 3: given @type on a const table, when inferred, then the declared element type wins over the literal magnitudes', () => {
  const d = declOf(il('/** @type {uint32[]} */\nconst T = [1, 2, 3];'), 'T');
  equal(d.resultType, 'uint32[]');
  equal(d.init.elements[0].resultType, 'uint32');
});
test('tier 3: given @type on a let, when reassigned, then the declared type is kept', () => {
  const ast = il('function f(a) { /** @type {uint32} */ let h = 0; h = a.length; return h; }');
  equal(declOf(ast, 'h').resultType, 'uint32');
  const assign = find(ast, n => n.type === 'AssignmentExpression' && n.left && n.left.name === 'h');
  equal(assign.resultType, 'uint32');
});
test('tier 3: given @param and @returns on a function, when it is called, then the call and its arguments are typed', () => {
  const ast = il('/**\n * @param {uint8} a\n * @returns {uint32}\n */\nfunction f(a) { return a; }\nconst q = f(1);');
  equal(declOf(ast, 'q').resultType, 'uint32');
  equal(declOf(ast, 'q').init.arguments[0].contextType, 'uint8');
});
test('tier 3: given @param on a function, when the parameter is read, then it has the declared type (a string, not a JSDoc object)', () => {
  const ast = il('/**\n * @param {uint8[]} data\n */\nfunction f(data) { const x = data; return x; }');
  equal(declOf(ast, 'x').resultType, 'uint8[]');
});
test('tier 3: given @type on this.field in the constructor, when an earlier method reads it, then the read is typed', () => {
  const ast = il('class C { get() { const v = this.buf; return v; } constructor() { /** @type {uint8[]} */ this.buf = []; } }');
  equal(declOf(ast, 'v').resultType, 'uint8[]');
});
test('tier 3: given @type on a field, when another method assigns a differently typed value, then the declared type is kept', () => {
  const ast = il('class C { constructor() { /** @type {uint8[]} */ this.buf = []; } reset() { this.buf = [1, 70000]; } read() { const v = this.buf; return v; } }');
  equal(declOf(ast, 'v').resultType, 'uint8[]');
});
test('tier 3: given a JSDoc block on one statement, when the next statement has none, then it does not inherit it', () => {
  const ast = il('class C { constructor() { /** @type {uint8[]} */ this.a = []; this.b = [300]; } m() { const v = this.b; return v; } }');
  equal(declOf(ast, 'v').resultType, 'uint16[]');
});

test('parser: given JSDoc on consecutive class methods, when parsed, then each method keeps its own', () => {
  const ast = il('class C {\n /** @returns {uint8} */\n a() { if (1) { return 1; } return 2; }\n /** @returns {uint16} */\n b() { return 3; }\n m() { const x = this.a(); const y = this.b(); return x + y; } }');
  equal(declOf(ast, 'x').resultType, 'uint8');
  equal(declOf(ast, 'y').resultType, 'uint16');
});
test('parser: given JSDoc after a closing brace, when parsed, then the next function keeps it', () => {
  const ast = il('function a() { return 1; }\n/** @returns {uint16} */\nfunction b() { return 2; }\nconst y = b();');
  equal(declOf(ast, 'y').resultType, 'uint16');
});
test('parser: given @type as the first statement of a block, when parsed, then it is attached', () => {
  const ast = il('function f() {\n  /** @type {uint16} */\n  let x = 1;\n  return x;\n}');
  equal(declOf(ast, 'x').resultType, 'uint16');
});

test('IL: given a method with @param, when normalized, then typeInfo.params is still a Map the emitters can read', () => {
  const ast = il('class C {\n /** @param {uint8[]} d */\n h(d) { return d; } }');
  const fn = find(ast, n => n.type === 'FunctionExpression' && n.typeInfo);
  ok(fn && fn.typeInfo.params instanceof Map && fn.typeInfo.params.has('d'), 'params Map with d');
});

// ------------------------------------------------------------ tier 2 before tier 3
test('tier 2: given a class deriving from a framework interface, when a framework field is read, then the framework type is used', () => {
  const ast = il('class H extends IHashFunctionInstance { m() { const s = this.OutputSize; return s; } }');
  equal(declOf(ast, 's').resultType, 'int32');
});
test('tier 2 before tier 3: given local JSDoc contradicting a framework field, when read, then the framework wins', () => {
  const ast = il('class H extends IHashFunctionInstance { constructor() { super(null); /** @type {uint8} */ this.OutputSize = 4; } m() { const s = this.OutputSize; return s; } }');
  equal(declOf(ast, 's').resultType, 'int32');
});
test('tier 2 before tier 3: given an override of Feed with loose JSDoc, when its parameter is read, then the framework type is used', () => {
  const ast = il('class H extends IHashFunctionInstance {\n /**\n * @param {Array} data\n */\n Feed(data) { const d = data; } }');
  equal(declOf(ast, 'd').resultType, 'uint8[]');
});
test('tier 2: given a framework method result, when this.Result() is called, then it is typed', () => {
  const ast = il('class H extends IHashFunctionInstance { m() { const r = this.Result(); return r; } }');
  equal(declOf(ast, 'r').resultType, 'uint8[]');
});
test('tier 2 before tier 3: given an override whose JSDoc says {Array}, when it is called, then the framework return type is kept', () => {
  const ast = il('class R extends IRandomGeneratorInstance {\n /** @returns {Array} */\n NextBytes(n) { return []; }\n m() { const r = this.NextBytes(4); return r; } }');
  equal(find(ast, n => n.type === 'ThisMethodCall' && n.method === 'NextBytes').resultType, 'uint8[]');
});
test('tier 2: given a class two local levels below the framework, when a framework field is read, then it is still typed', () => {
  const ast = il('class A extends IBlockCipherInstance {}\nclass B extends A { m() { const s = this.BlockSize; return s; } }');
  equal(declOf(ast, 's').resultType, 'int32');
});
test('tier 2: given a class that derives from nothing, when an unassigned field is read, then it stays untyped', () => {
  const ast = il('class P { m() { const s = this.BlockSize; return s; } }');
  equal(declOf(ast, 's').resultType, null);
});

// ------------------------------------------------------------ tier 1
test('tier 1: given an OpCodes call, when its arguments are untyped, then they take the JSDoc parameter types as context', () => {
  const ast = il('function f(a, b) { const x = OpCodes.RotL32(a, b); return x; }');
  const call = declOf(ast, 'x').init;
  equal(declOf(ast, 'x').resultType, 'uint32');
  equal(call.value.contextType, 'uint32');
  equal(call.amount.contextType, 'int32');
});
test('tier 1: given OpCodes.ToUint32, when inferred, then it is uint32 (its old {number} JSDoc gave int32)', () => {
  equal(declOf(il('const x = OpCodes.ToUint32(5);'), 'x').resultType, 'uint32');
});
test('tier 1: given a nested OpCodes member, when called, then its qualified JSDoc types the result', () => {
  equal(declOf(il('const x = OpCodes.UInt64.xor(a, b);'), 'x').resultType, 'uint32[]');
});

// ------------------------------------------------------------ guesses are visible
const reasons = code => sites(code).map(s => s.reason);
test('guess: given a bare numeric table, when typed by magnitude, then it is reported', () => {
  ok(reasons('const T = [0x01, 0x40];').some(r => /guessed from the literal values/.test(r)), 'magnitude guess reported');
});
test('guess: given the same table with @type, when typed, then nothing is reported', () => {
  equal(sites('/** @type {uint8[]} */\nconst T = [0x01, 0x40];').length, 0);
});
test('guess: given an empty array literal, when typed, then the int32[] default is reported', () => {
  ok(reasons('function f() { const a = []; return a; }').some(r => /empty array literal/.test(r)), 'empty array reported');
});
test('guess: given `data || []`, when used as a value, then it is reported', () => {
  ok(reasons('/** @param {uint8[]} d */\nfunction f(d) { return d || []; }').some(r => /on non-boolean operands/.test(r)), 'logical value reported');
});
test('guess: given `a || b` as an if condition, when walked, then the boolean reading is not reported', () => {
  const r = reasons('/**\n * @param {uint8[]} d\n * @param {uint8[]} e\n */\nfunction f(d, e) { if (d || e) return 1; return 0; }');
  ok(!r.some(x => /on non-boolean operands/.test(x)), 'condition is not a value');
});
test('guess: given XorN on 32-bit numbers, when typed, then the BigInt misuse is reported with the fixed-width helper', () => {
  ok(reasons('function f() { const a = OpCodes.RotL32(1, 2); return OpCodes.XorN(a, a); }').some(r => /XorN is declared BigInt.*Xor32/.test(r)), 'XorN misuse reported');
});
test('guess: given Xor32 on the same values, when typed, then nothing is reported', () => {
  equal(sites('function f() { const a = OpCodes.RotL32(1, 2); return OpCodes.Xor32(a, a); }').length, 0);
});
test('guess: given raw uint32 + int32, when typed, then the width guess is reported', () => {
  ok(reasons('function f() { const a = OpCodes.RotL32(1, 2); return a + 1; }').some(r => /no fixed width/.test(r)), 'raw arithmetic reported');
});
test('guess: given int32 index arithmetic, when typed, then nothing is reported', () => {
  equal(sites('function f() { let i = 0; const j = i + 1; return j; }').length, 0);
});
test('guess: given a literal-initialised variable later assigned uint32, when typed, then the initializer is reported', () => {
  ok(reasons('function f() { let h = 0; h = OpCodes.RotL32(h, 1); return h; }').some(r => /later assigned uint32/.test(r)), 'literal type conflict reported');
});
test('guess: given a call to a non-existent OpCodes member, when typed, then it is reported', () => {
  ok(reasons('function f(a) { return OpCodes.NoSuchHelper(a); }').some(r => /not an OpCodes member/.test(r)), 'unknown member reported');
});

test('context: given an empty array passed to a method whose JSDoc types the parameter, when typed, then it takes that type', () => {
  const ast = il('class C {\n /** @param {uint8[]} d */\n h(d) { return d; }\n m() { return this.h([]); } }');
  const call = find(ast, n => n.type === 'ThisMethodCall' && n.method === 'h');
  equal(call.arguments[0].resultType, 'uint8[]');
  equal(sites('class C {\n /**\n * @param {uint8[]} d\n * @returns {uint8[]}\n */\n h(d) { return d; }\n /** @returns {uint8[]} */\n m() { return this.h([]); } }').length, 0);
});
test('context: given numbers stored into a framework KeySize[] field, when typed, then the mismatch stays reported', () => {
  ok(reasons('class A extends HashFunctionAlgorithm { constructor() { super(); this.SupportedOutputSizes = [4]; } }')
    .some(r => /guessed from the literal values/.test(r)), '[4] is not KeySize[]');
});
test('context: given KeySize objects stored into the same field, when typed, then nothing is reported', () => {
  equal(sites('class A extends HashFunctionAlgorithm { constructor() { super(); this.SupportedOutputSizes = [new KeySize(4, 4, 1)]; } }').length, 0);
});

// ------------------------------------------------------------ walker
test('walk: given an untyped parameter read twice, when counted, then both reads are sites with line and expression', () => {
  const s = sites('function f(a) {\n  const x = a;\n  return a;\n}');
  equal(s.length, 2);
  equal(s[0].line, 2); equal(s[0].expression, 'a'); equal(s[1].line, 3);
});
test('walk: given declaration names, keys, callees and statements, when counted, then only the undeclared object literal is a site', () => {
  const s = sites('/** @returns {uint8} */\nfunction g() { return 1; }\nconst o = { k: g() };\ng();');
  equal(s.length, 1);
  equal(s[0].expression, '{ k: g() }');
});
test('walk: given the same object literal declared with @type, when counted, then nothing is a site', () => {
  equal(sites('/** @returns {uint8} */\nfunction g() { return 1; }\n/** @type {Settings} */\nconst o = { k: g() };').length, 0);
});
test('walk: given test vectors in this.tests, when counted, then they are skipped', () => {
  equal(sites('class A extends HashFunctionAlgorithm { constructor() { super(); this.tests = [{ input: [1, 2], expected: [3] }]; } }').length, 0);
});
test('walk: given a local JSDoc {number}, when read, then it is counted as untyped with the reason', () => {
  const s = sites('/** @param {number} n */\nfunction f(n) { return n; }');
  equal(s.length, 1);
  ok(/states no width/.test(s[0].reason), s[0].reason);
});
test('walk: given a genuine float, when read, then it is typed (float64 is not number)', () => {
  equal(sites('function f() { const x = 1.5; return x / 2; }').length, 0);
});
test('walk: given a syntax error, when analyzed, then a parse error is returned instead of a count', () => {
  const r = TypeCoverage.analyzeSource('function (');
  ok(r.parseError, 'parse error reported');
});
test('walk: given sites, when tallied, then every site lands in exactly one tier', () => {
  const s = sites('function f(a) { return OpCodes.XorN(a, 1) + a; }');
  const t = TypeCoverage.byTier(s);
  equal(t.opcodes + t.framework + t.local, s.length);
});

console.log(`${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
