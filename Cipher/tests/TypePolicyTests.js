/**
 * TypePolicyTests.js - unit tests for the transpiler's type resolution order
 * (OpCodes JSDoc, then framework interfaces, then local JSDoc, then nothing)
 * and for the untyped-site count built on it (tests/TypeCoverage.js).
 * Every case is Given / When / Then; classes, boundaries and error cases.
 *
 * The POLICY category: node tests/TranspilerSuite.js --only=policy [--verbose]
 */

'use strict';

const path = require('path');
const quiet = fn => { const l = console.log, e = console.error; console.log = console.error = () => {}; try { return fn(); } finally { console.log = l; console.error = e; } };
const { TypeAwareJSASTParser, PreciseTypeKnowledge, JSDocParser } = quiet(() => require(path.join(__dirname, '..', 'type-aware-transpiler.js')));
const TypeCoverage = require('./TypeCoverage.js');
const TypeSoundness = require('./TypeSoundness.js');
const { isPreciseType } = require('./JSDocTierAudit.js');

const cases = require('./UnitCases.js').createCases();
const test = cases.case;
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
test('logical: given `data || []` on a uint8[], when typed, then [] takes uint8[] and nothing is reported', () => {
  equal(sites('/**\n * @param {uint8[]} d\n * @returns {uint8[]}\n */\nfunction f(d) { return d || []; }').length, 0);
});
test('logical: given `s || 5` on a string, when used as a value, then the value of no shared type is reported', () => {
  ok(reasons('/**\n * @param {string} s\n * @returns {string}\n */\nfunction f(s) { const v = s || 5; return v; }').some(r => /no common type/.test(r)), 'logical value reported');
});
test('logical: given `a || b` on two uint32, when inferred, then it is uint32 (was boolean)', () => {
  const ast = il('/**\n * @param {uint32} a\n * @param {uint32} b\n */\nfunction f(a, b) { const v = a || b; return v; }');
  equal(declOf(ast, 'v').resultType, 'uint32');
});
test('logical: given `flag || 0`, when inferred, then a boolean and a number share no type', () => {
  equal(declOf(il('/** @param {boolean} c */\nfunction f(c) { const v = c || 0; return v; }'), 'v').resultType, null);
});
test('logical: given `a || b` on booleans, when inferred, then boolean', () => {
  equal(declOf(il('/**\n * @param {boolean} a\n * @param {boolean} b\n */\nfunction f(a, b) { const v = a || b; return v; }'), 'v').resultType, 'boolean');
});
test('logical: given `opts || {}` on a typedef, when inferred, then the typedef type', () => {
  equal(declOf(il('/** @param {Settings} o */\nfunction f(o) { const v = o || {}; return v; }'), 'v').resultType, 'Settings');
});
test('logical: given `a || b` in an if condition on numbers, when counted, then the truth test is no site', () => {
  equal(sites('/**\n * @param {uint8} a\n * @param {string} b\n * @returns {int32}\n */\nfunction f(a, b) { if (a || b) return 1; return 0; }').length, 0);
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
test('walk: given an untyped parameter read twice, when counted, then the parameter and both reads are sites with line and expression', () => {
  const s = sites('function f(a) {\n  const x = a;\n  return a;\n}');
  equal(s.length, 3);
  equal(s[0].line, 1); ok(/parameter 'a' has no type/.test(s[0].reason), s[0].reason);
  equal(s[1].line, 2); equal(s[1].expression, 'a'); equal(s[2].line, 3);
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
test('walk: given a local JSDoc {number}, when read, then the parameter and its read are counted as untyped with the reason', () => {
  const s = sites('/** @param {number} n */\nfunction f(n) { return n; }');
  equal(s.length, 2);
  ok(s.every(x => /states no width/.test(x.reason)), s.map(x => x.reason).join('; '));
});

test('walk: given a genuine float, when read, then it is typed (float64 is not number)', () => {
  equal(sites('function f() { const x = 1.5; return x / 2; }').length, 0);
});
test('walk: given a syntax error, when analyzed, then a parse error is returned instead of a count', () => {
  const r = TypeCoverage.analyzeSource('function (');
  ok(r.parseError, 'parse error reported');
});
test('walk: given a wrapper function called in place, when counted, then the sites in its body are counted', () => {
  // A wrapper the transpiler does not unwrap stays a call; its body used to be
  // skipped with the callee, hiding a whole file from TYPES.
  const s = sites("(function (global) {\n  function f(a) { return a; }\n})(typeof global !== 'undefined' ? global : this);\nif (require.main === module) { }");
  ok(s.some(x => x.line === 2 && x.expression === 'a'), 'the body read of a is a site');
});
test('walk: given a function invoked with .call(this), when counted, then the sites in its body are counted', () => {
  ok(sites('(function () {\n  function f(a) { return a; }\n}).call(this);').some(x => x.line === 2 && x.expression === 'a'), 'the body read of a is a site');
});
test('walk: given a named function as callee, when counted, then the callee itself is no site', () => {
  equal(sites('/** @returns {uint8} */\nfunction g() { return 1; }\ng();').length, 0);
});
test('walk: given catch (e), when counted, then the declared e is no site', () => {
  equal(sites('function f() { try { return 1; } catch (e) { return 2; } }').length, 0);
});
test('walk: given catch (e) whose e is read, when counted, then only the read is a site', () => {
  const s = sites('function f() {\n  try { return 1; }\n  catch (e) {\n    return e;\n  }\n}');
  equal(s.length, 1);
  equal(s[0].line, 4);
});
test('walk: given catch without a binding (catch {), when counted, then it parses and nothing is a site', () => {
  const r = TypeCoverage.analyzeSource('function f() { try { return 1; } catch { return 2; } }');
  ok(!r.parseError, `parse error: ${r.parseError}`);
  equal(r.sites.length, 0);
});
test('context: given return { ... } under @returns {Settings}, when counted, then the object literal is no site', () => {
  equal(sites('/** @typedef {Object} Settings */\n/** @returns {Settings} */\nfunction f() { return { a: 1 }; }').length, 0);
});
test('context: given return { ... } without @returns, when counted, then the object literal is a site', () => {
  equal(sites('function f() { return { a: 1 }; }').length, 1);
});
test('context: given an inner function without @returns, when counted, then the outer @returns does not reach its return', () => {
  equal(sites('/** @returns {Settings} */\nfunction f() { const g = function () { return { a: 1 }; }; return { b: g }; }').length, 1);
});
// ------------------------------------------------------------ precision gaps
test('guess: given int32 + a rounded double of a 64-bit range, when typed, then the int64 count is no width guess', () => {
  const s = sites('/** @param {int32} i\n * @param {int32} p\n * @param {float64} t */\nfunction f(i, p, t) { const k = Math.round(p * Math.cos(t)); const j = i + k; return j; }');
  equal(s.length, 0);
});
test('guess: given int64 * int32, when typed, then the guess stays reported (the product may leave int64)', () => {
  ok(reasons('/** @param {int64} q\n * @param {int32} i */\nfunction f(q, i) { const j = q * i; return j; }').some(r => /no fixed width/.test(r)), 'int64 * int32 reported');
});
test('guess: given uint64 + int32, when typed, then the guess stays reported (an unsigned word is no count)', () => {
  ok(reasons('/** @param {uint64} w\n * @param {int32} i */\nfunction f(w, i) { const j = w + i; return j; }').some(r => /no fixed width/.test(r)), 'uint64 + int32 reported');
});
test('nullable: given @param {int32|null}, when counted, then its reads are typed (no site)', () => {
  equal(sites('/** @param {int32|null} a\n * @returns {int32} */\nfunction f(a) { const x = a === null ? 0 : a; return x; }').length, 0);
});
test('nullable: given @type {?uint32} on a field, when counted, then the field reads are typed', () => {
  equal(sites('class A { constructor() { /** @type {?uint32} */ this.c = null; } /** @returns {uint32} */ g() { return this.c === null ? 0 : this.c; } }').length, 0);
});
test('nullable: given a nullable int32, when checked, then null passes and other kinds still fail', () => {
  const check = TypeSoundness.checkerFor('int32?');
  equal(check(null), null); equal(check(undefined), null); equal(check(7), null);
  equal(check(1.5), 'fraction'); equal(check('7'), 'string');
  equal(TypeSoundness.checkerFor('int32')(null), 'nullish');
});
test('nullable: given an assignment of null to a @param {uint32|null}, when sites are collected, then the variable check is uint32?', () => {
  const parsed = TypeSoundness.parseSource('/** @param {uint32|null} a */\nfunction f(a) { a = null; return a; }');
  const checks = TypeSoundness.collectSites(parsed.parser, parsed.ast).flatMap(s => s.checks);
  ok(checks.some(c => c.role === 'variable' && c.type === 'uint32?'), JSON.stringify(checks));
});
test('nullable: given @returns {?int32}, when sites are collected, then the return check is int32?', () => {
  const parsed = TypeSoundness.parseSource('/** @returns {?int32} */\nfunction f() { return null; }');
  const checks = TypeSoundness.collectSites(parsed.parser, parsed.ast).flatMap(s => s.checks);
  ok(checks.some(c => c.role === 'return' && c.type === 'int32?'), JSON.stringify(checks));
});
test('tuple: given a mixed row, when counted, then it is typed (no site)', () => {
  equal(sites('function f() { const r = ["", 0, " "]; const v = r[1]; return v; }').length, 0);
});
test('tuple: given a tuple type, when checked, then each position is checked', () => {
  const check = TypeSoundness.checkerFor('[string,int32,string]');
  equal(check(['', 0, ' ']), null);
  equal(check(['', 'x', ' ']), 'element-string');
  equal(check('abc'), 'string');
  equal(TypeSoundness.checkerFor('[string,int32][]')([['a', 1], ['b', 2.5]]), 'element-fraction');
});

// ------------------------------------------------------------ storage: declarators, parameters, fields
test('storage: given `let a, b;` without JSDoc, when counted, then each declarator is a site', () => {
  const s = sites('/** @returns {int32} */\nfunction f() {\n  let a, b;\n  return 0;\n}');
  equal(s.length, 2);
  ok(s.every(x => x.line === 3 && /variable '[ab]' has no type/.test(x.reason)), s.map(x => x.reason).join('; '));
});
test('storage: given `let a;` with @type {uint32}, when counted, then nothing is a site', () => {
  equal(sites('/** @returns {int32} */\nfunction f() {\n  /** @type {uint32} */\n  let a;\n  return 0;\n}').length, 0);
});
test('storage: given new Array(n) without JSDoc, when counted, then it is one site (the value, not the declarator again)', () => {
  const s = sites('/** @param {int32} n */\nfunction f(n) { const a = new Array(n); }');
  equal(s.length, 1);
  equal(s[0].expression, 'new Array(n)');
});
test('storage: given new Array(n) with @type {uint32[]}, when counted, then nothing is a site', () => {
  equal(sites('/** @param {int32} n */\nfunction f(n) {\n  /** @type {uint32[]} */\n  const a = new Array(n);\n}').length, 0);
});
test('storage: given a call typed only after narrowing (no @returns), when counted, then its declarator is a site', () => {
  const s = sites('function g() { return 1; }\n/** @returns {int32} */\nfunction f() { const v = g(); return 0; }');
  ok(s.some(x => /variable 'v' has no type/.test(x.reason)), s.map(x => x.reason).join('; '));
});
test('storage: given a parameter without @param that is never read, when counted, then the parameter is a site', () => {
  const s = sites('/** @returns {int32} */\nfunction f(unused) { return 0; }');
  equal(s.length, 1);
  ok(/parameter 'unused'/.test(s[0].reason), s[0].reason);
});
test('storage: given a default parameter without JSDoc, when counted, then it is a site', () => {
  ok(sites('/** @returns {int32} */\nfunction f(n = 4) { return 0; }').some(x => /parameter 'n'/.test(x.reason)), 'default parameter reported');
});
test('storage: given an array callback, when the array is typed, then its parameters are typed (no site)', () => {
  equal(sites('/**\n * @param {uint8[]} b\n * @returns {uint8[]}\n */\nfunction f(b) { return b.filter((v, i) => i > 0); }').length, 0);
});
test('storage: given an array callback on a call result, when the call declares @returns, then its parameters are typed', () => {
  equal(sites('/** @returns {uint8[]} */\nfunction g() { return [1]; }\n/** @returns {int32[]} */\nfunction f() { return g().map(v => v + 1); }').filter(x => /parameter/.test(x.reason)).length, 0);
});
test('storage: given a callback passed to a framework function-typed parameter, when typed, then its parameters take that signature', () => {
  const ast = il('class H extends IHashFunctionInstance { constructor() { super(null); /** @type {BlockAbsorber} */ this._a = new BlockAbsorber(64, block => this._p(block)); } /** @param {uint8[]} b */ _p(b) { } }');
  const arrow = find(ast, n => n.type === 'ArrowFunction');
  equal(arrow.params[0].resultType, 'uint8[]');
});
test('storage: given a field only ever assigned null, when counted, then the field is a site', () => {
  ok(sites('class A { constructor() { this.k = null; } }').some(x => /field 'k' is typed 'null'/.test(x.reason)), 'null field reported');
});
test('storage: given a field with @type {uint8[]|null} assigned null, when counted, then nothing is a site', () => {
  equal(sites('class A { constructor() { /** @type {uint8[]|null} */ this.k = null; } }').length, 0);
});
test('storage: given a field typed by its assignments, when counted, then it is no site (boundary)', () => {
  equal(sites('class A { constructor() { this.k = OpCodes.RotL32(1, 2); } }').length, 0);
});

// ------------------------------------------------------------ weak types and their array forms
test('weak: given any, any[], number[][], Array<*> and Object[], when judged, then each is weak', () => {
  for (const t of ['any', 'any[]', 'number[][]', 'Array<*>', 'Object[]', 'Array', '', null, 'undefined'])
    ok(TypeCoverage.isWeakType(t), `${t} should be weak`);
});
test('weak: given uint8[], string[][], KeySize[] and bigint, when judged, then none is weak (boundary)', () => {
  for (const t of ['uint8[]', 'string[][]', 'KeySize[]', 'bigint', 'Array<uint32>'])
    ok(!TypeCoverage.isWeakType(t), `${t} should not be weak`);
});
test('weak: given a value typed any[] by JSDoc, when read, then the read is counted', () => {
  ok(sites('/**\n * @param {any[]} q\n * @returns {int32}\n */\nfunction f(q) { const w = q; return 0; }').some(x => /'any\[\]'/.test(x.reason)), 'any[] reported');
});
// ------------------------------------------------------------ kinds: booleans, BigInts, accessors
test('kind: given a boolean added to a number, when counted, then the boolean operand is a site', () => {
  const r = reasons('/**\n * @param {uint32} x\n * @returns {int32}\n */\nfunction f(x) { let n = 0; n += OpCodes.GetBit(x, 0); return n; }');
  ok(r.some(x => /boolean used as a number/.test(x)), r.join('; '));
});
test('kind: given the boolean converted with ? 1 : 0, when counted, then nothing is a site', () => {
  equal(sites('/**\n * @param {uint32} x\n * @returns {int32}\n */\nfunction f(x) { let n = 0; n += OpCodes.GetBit(x, 0) ? 1 : 0; return n; }').length, 0);
});
test('kind: given 1 - a boolean, when counted, then the boolean is a site (exceptional)', () => {
  ok(reasons('/**\n * @param {uint32} x\n * @returns {int32}\n */\nfunction f(x) { return 1 - OpCodes.GetBit(x, 0); }').some(x => /boolean used as a number/.test(x)), 'reported');
});
test('kind: given a number where a boolean parameter is declared, when counted, then it is a site', () => {
  ok(reasons('/**\n * @param {uint8[]} b\n * @returns {uint32}\n */\nfunction f(b) { return OpCodes.SetBit(0, 1, b[0]); }').some(x => /where boolean is declared/.test(x)), 'reported');
});
test('kind: given a comparison where a boolean parameter is declared, when counted, then nothing is a site (boundary)', () => {
  equal(sites('/**\n * @param {uint8[]} b\n * @returns {uint32}\n */\nfunction f(b) { return OpCodes.SetBit(0, 1, b[0] !== 0); }').length, 0);
});
test('kind: given a BigInt literal where a byte is declared, when counted, then it is a site', () => {
  ok(reasons('/** @returns {uint8[]} */\nfunction f() { return OpCodes.CreateArray(4, 0n); }').some(x => /BigInt value where uint8/.test(x)), 'reported');
});
test('kind: given a shift amount of an inlined BigInt shift, when typed, then its context is the BigInt the operator takes', () => {
  equal(sites('/**\n * @param {BigInt} v\n * @returns {BigInt}\n */\nfunction f(v) { return OpCodes.ShiftLn(v, 8n); }').length, 0);
  equal(sites('/**\n * @param {BigInt} v\n * @param {int32} n\n * @returns {BigInt}\n */\nfunction f(v, n) { return OpCodes.ShiftLn(v, n); }').length, 0);
});
test('accessor: given a setter of uint8[] and a getter of string, when counted, then the setter is a site', () => {
  ok(reasons('class A {\n /** @param {uint8[]} k */\n set key(k) { this._k = String.fromCharCode(...k); }\n /** @returns {string} */\n get key() { return this._k; } }')
    .some(x => /accessor 'key' takes uint8\[\] but returns string/.test(x)), 'reported');
});
test('accessor: given a setter and getter of one type, when counted, then nothing is a site', () => {
  equal(sites('class A {\n /** @param {uint8[]} k */\n set key(k) { /** @type {uint8[]} */ this._k = k; }\n /** @returns {uint8[]} */\n get key() { return this._k; } }').length, 0);
});
test('accessor: given a getter with @returns, when this.prop is assigned, then the property has the getter type', () => {
  const ast = il('class A {\n constructor() { this.curve = null; }\n /** @param {string|null} n */\n set curve(n) { this._n = n; }\n /** @returns {string|null} */\n get curve() { return this._n; }\n m() { const c = this.curve; return c; } }');
  equal(declOf(ast, 'c').resultType, 'string');
});

// ------------------------------------------------------------ inference fixes
test('inference: given Array.from(uint8[]), when inferred, then uint8[] (was any[])', () => {
  equal(declOf(il('/** @param {uint8[]} b */\nfunction f(b) { const c = Array.from(b); return c; }'), 'c').resultType, 'uint8[]');
});
test('inference: given Array.from(b, v => v * 2) on uint8[], when inferred, then the map result type', () => {
  equal(declOf(il('/** @param {uint8[]} b */\nfunction f(b) { const c = Array.from(b, v => v * 2); return c; }'), 'c').resultType, 'int32[]');
});
test('inference: given Array.from of an untyped value, when inferred, then untyped (not any[])', () => {
  equal(declOf(il('function f(b) { const c = Array.from(b); return c; }'), 'c').resultType, null);
});
test('inference: given an array of instances of two sibling classes, when inferred, then their common base class', () => {
  equal(declOf(il('class A extends HashFunctionAlgorithm {}\nclass B extends HashFunctionAlgorithm {}\nconst x = [new A(), new B()];'), 'x').resultType, 'HashFunctionAlgorithm[]');
});
test('inference: given instances of unrelated classes, when inferred, then no common type (exceptional)', () => {
  equal(declOf(il('class A {}\nclass B {}\nconst x = [new A(), new B()];'), 'x').resultType, null);
});
test('inference: given strings stored into a Vulnerability[] field, when typed, then the literal is not retyped', () => {
  const ast = il('class A extends HashFunctionAlgorithm { constructor() { super(); this.knownVulnerabilities = ["weak"]; } }');
  equal(find(ast, n => n.ilNodeType === 'ArrayLiteral').resultType, 'string[]');
});
test('inference: given a framework property setter without JSDoc, when its parameter is read, then it has the property type', () => {
  const ast = il('class B extends IBlockCipherInstance { set key(keyData) { const k = keyData; this._k = k; } }');
  equal(declOf(ast, 'k').resultType, 'uint8[]');
});
test('inference: given const f = function (x) with @param, when typed, then the parameter node itself is typed', () => {
  const ast = il('function o() {\n  /**\n   * @param {int32} x\n   * @returns {int32}\n   */\n  const f = function (x) { return x; };\n  return f(1);\n}');
  equal(find(ast, n => n.type === 'FunctionExpression').params[0].resultType, 'int32');
});
test('inference: given a field reset to null after a typed assignment, when looked up, then the typed assignment wins', () => {
  const ast = il('class A {\n constructor() { this.k = null; }\n /** @param {uint8[]} b */\n set(b) { this.k = b.slice(); }\n clear() { this.k = null; }\n m() { const v = this.k; return v; } }');
  equal(declOf(ast, 'v').resultType, 'uint8[]');
});
test('inference: given [t, u] = [u, t - q * u] on a BigInt-literal variable, when typed, then the literal initializer is a guess', () => {
  ok(reasons('/**\n * @param {BigInt} q\n * @returns {BigInt}\n */\nfunction f(q) { let t = 0n, u = 1n; [t, u] = [u, t - q * u]; return t; }').some(x => /later assigned bigint/.test(x)), 'reported');
});
test('inference: given the same variables declared @type {BigInt}, when typed, then nothing is reported', () => {
  equal(sites('/**\n * @param {BigInt} q\n * @returns {BigInt}\n */\nfunction f(q) { /** @type {BigInt} */ let t = 0n, u = 1n; [t, u] = [u, t - q * u]; return t; }').length, 0);
});
test('inference: given an array callback on a field of a class-typed field, when typed, then its parameter takes the element type', () => {
  const ast = il('class K {\n constructor() { /** @type {int32[][]} */ this.rows = []; } }\nclass A {\n constructor() { /** @type {K} */ this.k = new K(); }\n m() { this.k.rows.forEach(row => OpCodes.ClearArray(row)); } }');
  equal(find(ast, n => n.type === 'ArrowFunction').params[0].resultType, 'int32[]');
});
test('inference: given new Float64Array(n).sort(), when typed, then the sort is marked numeric with the typed-array kind', () => {
  const ast = il('/** @param {int32} n */\nfunction f(n) { const k = new Float64Array(n); k.sort(); return k; }');
  const sort = find(ast, n => n.type === 'ArraySort');
  equal(sort.typedArrayKind, 'Float64Array');
  equal(sort.numericSort, true);
});
test('inference: given a plain array sort without a comparator, when typed, then it is not marked numeric (boundary)', () => {
  const sort = find(il('/** @param {uint32[]} k */\nfunction f(k) { k.sort(); return k; }'), n => n.type === 'ArraySort');
  equal(sort.numericSort, undefined);
});
test('inference: given a field holding a typed array, when sorted, then the kind is known', () => {
  const sort = find(il('class A {\n constructor() { this.k = new Uint32Array(4); }\n m() { this.k.sort(); } }'), n => n.type === 'ArraySort');
  equal(sort.typedArrayKind, 'Uint32Array');
});
test('record: given @typedef {Object} with @property lines, when typed, then it is an IL record type', () => {
  const code = '/**\n * @typedef {Object} Keys\n * @property {uint8[]} k1 - first\n * @property {uint32} n - count\n */\n/** @type {Keys} */\nconst K = { k1: [1, 2], n: 3 };\nfunction f() { const a = K.k1; const b = K.n; return a; }';
  const ast = il(code);
  equal(JSON.stringify(ast.recordTypes.Keys.map(f => f.name + ':' + f.resultType)), '["k1:uint8[]","n:uint32"]');
  equal(declOf(ast, 'a').resultType, 'uint8[]');
  equal(declOf(ast, 'b').resultType, 'uint32');
  const literal = find(ast, n => n.type === 'ObjectLiteral');
  equal(literal.resultType, 'Keys');
  equal(literal.recordType, 'Keys');
  equal(literal.properties[1].value.resultType, 'uint32');
});
test('record: given a typedef without @property lines, when typed, then no record type is made (boundary)', () => {
  equal(Object.keys(il('/** @typedef {Object} Empty */\nconst x = 1;').recordTypes).length, 0);
});
test('template: given an OpCodes helper declared {T[]} (ClearArray), when a uint32[] is passed, then no uint8[] context is imposed', () => {
  const ast = il('/** @param {uint32[]} w */\nfunction f(w) { OpCodes.ClearArray(w); }');
  const call = find(ast, n => n.opCodesMethod === 'ClearArray');
  const arg = call && (call.arguments || call.args || [call.array || call.argument]).find(Boolean);
  ok(arg && arg.name === 'w', `ClearArray argument found (${call && Object.keys(call)})`);
  equal(arg.contextType, undefined);
});

// ------------------------------------------------------------ soundness: classes, enums, arguments
test('soundness: given a framework enum, when checked, then only its members pass', () => {
  global.AlgorithmFramework = global.AlgorithmFramework || quiet(() => require(path.join(__dirname, '..', 'AlgorithmFramework.js')));
  const AF = global.AlgorithmFramework;
  const check = TypeSoundness.checkerFor('CountryCode');
  equal(check(AF.CountryCode.US), null);
  equal(check(null), null);
  equal(check('Multi-national'), 'string');
  equal(check({ name: 'United States' }), 'not-enum-member');
});
test('soundness: given a framework class, when checked, then instances pass and strings, plain objects and other classes fail', () => {
  const AF = global.AlgorithmFramework;
  const check = TypeSoundness.checkerFor('Vulnerability[]');
  equal(check([new AF.Vulnerability('a', 'b')]), null);
  equal(check(['weak']), 'element-string');
  equal(check([{ type: 'a' }]), 'element-plain-object');
  equal(check([new AF.KeySize(1, 1, 1)]), 'element-other-class');
  equal(TypeSoundness.checkerFor('KeySize[]')([28]), 'element-number');
});
test('soundness: given TestCase, when a plain object is checked, then it passes (vectors are object literals by convention)', () => {
  equal(TypeSoundness.checkerFor('TestCase[]')([{ input: [1], expected: [2] }]), null);
});
test('soundness: given a typedef name, when checked, then objects pass and primitives fail', () => {
  const check = TypeSoundness.checkerFor('SomeRecordShape');
  equal(check({ a: 1 }), null);
  equal(check(5), 'number');
});
test('soundness: given an argument (kind only), when checked, then any whole number fits a 32-bit parameter but a BigInt does not', () => {
  const check = TypeSoundness.kindCheckerFor('int32');
  equal(check(0xFFFFFFFF), null);
  equal(check(-1), null);
  equal(check(8n), 'bigint');
  equal(check(0.5), 'fraction');
  equal(TypeSoundness.kindCheckerFor('uint64')(8n), null);
  equal(TypeSoundness.kindCheckerFor('boolean')(1), 'number');
});
test('soundness: given an argument declared uint8[] (kind only), when a Uint32Array is passed, then the typed-array kind fails', () => {
  equal(TypeSoundness.kindCheckerFor('uint8[]')(new Uint32Array(2)), 'typed-array-kind');
  equal(TypeSoundness.kindCheckerFor('uint8[]')([300]), null);
});
test('soundness: given a call argument with a declared parameter type, when sites are collected, then it is checked as an argument', () => {
  const parsed = TypeSoundness.parseSource('/**\n * @param {uint32} a\n * @returns {uint32}\n */\nfunction g(a) { return a; }\n/** @param {uint32} x */\nfunction f(x) { return g(x); }');
  const checks = TypeSoundness.collectSites(parsed.parser, parsed.ast).flatMap(s => s.checks);
  ok(checks.some(c => c.role === 'argument' && c.type === 'uint32' && c.kindOnly), JSON.stringify(checks));
});

test('walk: given sites, when tallied, then every site lands in exactly one tier', () => {
  const s = sites('function f(a) { return OpCodes.XorN(a, 1) + a; }');
  const t = TypeCoverage.byTier(s);
  equal(t.opcodes + t.framework + t.local, s.length);
});

/**
 * POLICY: run every type policy case.
 * @param {object} options - { verbose }
 * @returns {object} { passed, failed, skipped, detail }
 */
function run(options = {}) {
  console.log('Type policy tests');
  return cases.run(options);
}

module.exports = { run };
