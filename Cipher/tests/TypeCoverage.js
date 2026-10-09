/**
 * TypeCoverage.js - count the value sites whose type no policy tier supplies.
 *
 * The transpiler resolves types in a fixed order: OpCodes JSDoc (tier 1), the
 * AlgorithmFramework interfaces (tier 2), the algorithm file's own JSDoc
 * (tier 3). Anything else is a guess. This module parses one algorithm file
 * into the same typed IL AST the language emitters consume (no target
 * language is generated) and walks it, counting every value-bearing
 * expression in a value position that is still untyped:
 *
 *   - its resultType is missing or says nothing about width and signedness
 *     (null, 'any', 'number', 'object', ...), and no declared context types
 *     it either (an argument of an OpCodes call, a value stored into a
 *     declared field or variable); or
 *   - the transpiler had to guess it (the IL node carries `typeGuess`: a
 *     literal-magnitude array, `a || []`, raw `a + b` on fixed-width values,
 *     a BigInt helper applied to numbers, ...).
 *
 * A type that states no width counts as none, its array forms too ('any[]',
 * 'number[][]', 'Array<*>').
 *
 * Storage and kinds are counted as well, whether or not a value site shows them:
 *
 *   - every variable (`let a, b;` included), parameter and field whose type is
 *     missing, weak or only `null` (a declarator whose initializer is itself a
 *     counted site is not counted twice);
 *   - a value of one kind where its context declares another: a number where a
 *     `boolean` parameter is declared, a BigInt literal for a `uint8`, ...;
 *   - a boolean used as a number (`n += OpCodes.GetBit(x, i)`, `1 - flag`);
 *   - an accessor whose setter takes another type than its getter returns (a
 *     property no typed language declares with one type).
 *
 * `number` versus float: the IL names a genuine floating-point value
 * 'float64'/'float32' (fractional literals, `/`, Math.sqrt, ...). A bare
 * 'number' only survives where nothing stated a width - most often a local
 * JSDoc `{number}` - so it is always counted.
 *
 * Value positions are operands, call arguments, assignment right-hand sides,
 * return values, initialisers, array elements, object property values and
 * member-access objects. Declaration names, property keys, callees,
 * assignment targets, statement wrappers, discarded expression statements and
 * branch conditions are not values. Test vectors (`this.tests = [...]`) are
 * skipped: they are stripped before emission and typed by the framework's
 * TestCase.
 *
 * Each site is attributed to the tier whose gap it is:
 *   'opcodes'   an OpCodes call or result without a JSDoc type
 *   'framework' a framework interface member without a declared type
 *   'local'     everything else: missing local JSDoc, or source that uses a
 *               construct no tier can type
 */

'use strict';

const fs = require('fs');
const path = require('path');

let Parser = null;
function parserClass() {
  if (!Parser) {
    const log = console.log;
    console.log = () => {};
    try { Parser = require(path.join(__dirname, '..', 'type-aware-transpiler.js')).TypeAwareJSASTParser; }
    finally { console.log = log; }
  }
  return Parser;
}

/** resultTypes that state no width or signedness. */
const WEAK_TYPES = new Set(['', 'any', 'number', 'object', 'Object', 'unknown', '*', 'Array', 'mixed', 'undefined']);

/** Types that say nothing about what a variable, parameter or field holds. */
const EMPTY_STORAGE_TYPES = new Set(['null', 'void']);

/**
 * Does a type state no width or signedness? An array of such a type (`any[]`,
 * `number[][]`, `Array<*>`) states none either.
 * @param {*} t - resultType (string or JSDoc type object)
 * @returns {boolean} true when weak
 */
function isWeakType(t) {
  let name = typeName(t).trim();
  for (;;) {
    if (name.endsWith('[]')) { name = name.slice(0, -2).trim(); continue; }
    const generic = name.match(/^Array<(.*)>$/);
    if (generic) { name = generic[1].trim(); continue; }
    return WEAK_TYPES.has(name);
  }
}

/** Nodes that are not values themselves (their children may be). */
const NOT_VALUES = new Set([
  'Program', 'ExpressionStatement', 'VariableDeclaration', 'VariableDeclarator', 'ReturnStatement',
  'IfStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'WhileStatement', 'DoWhileStatement',
  'BlockStatement', 'SwitchStatement', 'SwitchCase', 'BreakStatement', 'ContinueStatement', 'ThrowStatement',
  'TryStatement', 'CatchClause', 'LabeledStatement', 'EmptyStatement', 'FunctionDeclaration',
  'FunctionExpression', 'ArrowFunctionExpression', 'ClassDeclaration', 'ClassExpression', 'ClassBody',
  'MethodDefinition', 'FieldDefinition', 'PropertyDefinition', 'StaticBlock', 'Property', 'TemplateElement',
  'SpreadElement', 'RestElement', 'ObjectPattern', 'ArrayPattern', 'AssignmentPattern',
  'AssignmentExpression', 'UpdateExpression', 'SequenceExpression', 'Block', 'Line', 'Super',
  'ParentConstructorCall', 'DebugOutput', 'ImportDeclaration', 'ExportNamedDeclaration', 'ExportDefaultDeclaration'
]);

/** Keys that never hold a value. */
const SKIP_KEYS = new Set(['loc', 'range', 'leadingComments', 'trailingComments', 'comments', 'parent',
  'typeInfo', 'jsDoc', 'id', 'key', 'params', 'callee', 'label', 'superClass', 'decorators', 'quasis', 'recordTypes']);

/** Guesses a declared context type settles (the value is converted to it). */
const CONTEXT_SETTLES = new Set(['literal-array', 'raw-arithmetic', 'raw-bitwise']);

/** Keys that hold a branch condition. */
const CONDITION_KEYS = new Set(['test']);

/**
 * @param {*} t - resultType (string or JSDoc type object)
 * @returns {string} type name
 */
function typeName(t) {
  if (t === null || t === undefined) return '';
  if (typeof t === 'string') return t;
  if (typeof t === 'object' && typeof t.name === 'string') return t.isArray && !t.name.endsWith('[]') ? t.name + '[]' : t.name;
  return String(t);
}

/**
 * The kind of value a type holds, for telling one kind from another: a
 * number, a BigInt, a 64-bit integer (which may be either), a string, a
 * boolean, nothing (null). Null for arrays, references and untyped values.
 * @param {string} t - type name
 * @param {Object} [node] - the value, when a literal says more than its type (`8n` is a BigInt)
 * @returns {string|null} kind
 */
function valueKind(t, node) {
  if (node && node.type === 'Literal' && typeof node.value === 'bigint') return 'bigint';
  if (!t) return null;
  if (/^(u?int(8|16|32)|float(32|64))$/.test(t)) return 'number';
  if (/^u?int64$/.test(t)) return 'wide';
  if (t === 'bigint' || t === 'BigInt') return 'bigint';
  if (t === 'string' || t === 'boolean') return t;
  if (t === 'null') return 'nothing';
  return null;
}

/**
 * Do two kinds differ? A 64-bit integer is a number or a BigInt; null is
 * judged by nullability, not here.
 * @param {string|null} a - kind
 * @param {string|null} b - kind
 * @returns {boolean} true when no value has both kinds
 */
function kindsDiffer(a, b) {
  if (!a || !b || a === b || a === 'nothing' || b === 'nothing') return false;
  if (a === 'wide') return b !== 'number' && b !== 'bigint';
  if (b === 'wide') return a !== 'number' && a !== 'bigint';
  return true;
}

/** Operators that treat their operands as numbers. */
const NUMERIC_OPERATORS = new Set(['+', '-', '*', '/', '%', '**', '&', '|', '^', '<<', '>>', '>>>']);

const FUNCTION_NODES = new Set(['FunctionExpression', 'ArrowFunctionExpression']);
/** Nodes that declare parameters. */
const FUNCTION_DECLARATIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ArrowFunction']);

/**
 * The function a call invokes in place: `(function () {...})()`,
 * `(() => {...})()`, `(function () {...}).call(this)`.
 * @param {Object} callee - IL callee node
 * @returns {Object|null} the function node, or null for any other callee
 */
function calledFunction(callee) {
  if (!callee || typeof callee !== 'object') return null;
  if (FUNCTION_NODES.has(callee.type)) return callee;
  if (callee.type === 'MemberExpression' && callee.object && FUNCTION_NODES.has(callee.object.type)) return callee.object;
  return null;
}

/**
 * Is this an assignment to `this.tests` (test vectors)?
 * @param {Object} node - IL node
 * @returns {boolean} true for test vector assignments
 */
function isTestVectorAssignment(node) {
  if (!node || node.type !== 'AssignmentExpression') return false;
  const left = node.left;
  if (!left) return false;
  if (left.type === 'ThisPropertyAccess') return left.property === 'tests';
  return left.type === 'MemberExpression' && left.object && left.object.type === 'ThisExpression' &&
    left.property && (left.property.name === 'tests' || left.property.value === 'tests');
}

/**
 * Analyze JavaScript source.
 * @param {string} code - Algorithm source
 * @param {string} [filePath] - Its path: the sibling data modules it requires are typed from their own JSDoc
 * @returns {Object} { sites: [{line, expression, reason, tier}], parseError, parsed: { parser, ast } }
 */
function analyzeSource(code, filePath) {
  const P = parserClass();
  const log = console.log, warn = console.warn, error = console.error;
  let parser, ast;
  console.log = console.warn = console.error = () => {};
  try {
    parser = new P(code, filePath ? { sourcePath: path.resolve(filePath) } : {});
    ast = parser.parse();
  } catch (e) {
    return { sites: [], parseError: e.message };
  } finally {
    console.log = log; console.warn = warn; console.error = error;
  }

  const text = parser.normalizedCode || code;
  const sites = [];
  const seen = new Set();

  const expressionText = (range) => {
    if (!range) return '';
    const s = text.slice(range[0], range[1]).replace(/\s+/g, ' ').trim();
    return s.length > 90 ? s.slice(0, 87) + '...' : s;
  };

  // The framework interface of the class declares the member (typed or not).
  const frameworkDeclares = (className, member, kind) => parser._frameworkMember(className, member, kind) !== null;

  const recorded = new Set();
  const record = (node, where, reason, tier) => {
    recorded.add(node);
    sites.push({
      line: (node.loc && node.loc.line) || where.line || 0,
      expression: expressionText(node.range || where.range),
      reason,
      tier
    });
  };

  const judge = (node, where) => {
    if (seen.has(node)) return;
    seen.add(node);
    // A declared context (OpCodes/framework/JSDoc parameter, declared target)
    // fixes the type of a literal shape or of raw arithmetic flowing into it.
    const settledByContext = node.contextType && CONTEXT_SETTLES.has(node.typeGuessKind);
    // In a condition `a || b` is a truth test (its operands are judged on their own).
    if (where.inCondition && node.type === 'LogicalExpression') return;
    if (node.typeGuess && !settledByContext) {
      record(node, where, node.typeGuess, node.typeGuessTier || 'local');
      return;
    }
    const t = typeName(node.resultType);
    // A value of one kind where the context declares another (a boolean
    // where a number is declared, a number where a boolean is, ...).
    const context = typeName(node.contextType);
    const kind = valueKind(t, node), expected = valueKind(context);
    if (kindsDiffer(kind, expected)) {
      record(node, where, `a ${kind === 'bigint' ? 'BigInt' : t} value where ${context} is declared; convert it explicitly`, 'local');
      return;
    }
    if (!isWeakType(t) || node.contextType) return;
    let tier = 'local';
    let reason = t === 'number'
      ? "declared 'number', which states no width or signedness"
      : t && t !== 'undefined' ? `typed '${t}', which states no width or signedness`
      : `no tier types this ${node.type === 'Identifier' ? `name '${node.name}'` : node.type}`;
    if (node.opCodesMethod && !(parser.typeKnowledge.opCodesTypes || {})[node.opCodesMethod]) {
      tier = 'opcodes';
      reason = `OpCodes.${node.opCodesMethod} result has no JSDoc type`;
    } else if (node.opCodesMethod) {
      reason = `OpCodes.${node.opCodesMethod} takes its result type from operands that are untyped`;
    } else if (node.type === 'ThisPropertyAccess' && frameworkDeclares(where.className, node.property, 'property')) {
      tier = 'framework';
      reason = `framework member '${node.property}' has no declared type`;
    } else if (node.type === 'ThisMethodCall' && frameworkDeclares(where.className, node.method, 'method')) {
      tier = 'framework';
      reason = `framework method '${node.method}' has no declared return type`;
    } else if (node.type === 'ThisPropertyAccess') {
      reason = `field '${node.property}' has no JSDoc @type and no typed assignment`;
    } else if (node.type === 'ThisMethodCall') {
      reason = `method '${node.method}' has no JSDoc @returns`;
    }
    record(node, where, reason, tier);
  };

  // where: { line, range, className, inCondition }
  const walk = (node, isValue, where) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) walk(n, isValue, where); return; }
    if (isTestVectorAssignment(node)) return;

    const here = {
      line: (node.loc && node.loc.line) || where.line,
      range: node.range || where.range,
      className: where.className,
      inCondition: where.inCondition
    };
    if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && node.id && node.id.name)
      here.className = node.id.name;

    if (isValue && node.type && !NOT_VALUES.has(node.type) && !(node.type === 'Literal' && node.regex))
      judge(node, here);

    // A condition stays a condition through `!`, `&&` and `||`.
    const conditionChain = here.inCondition &&
      (node.type === 'LogicalExpression' || (node.type === 'UnaryExpression' && node.operator === '!'));

    for (const key of Object.keys(node)) {
      // A callee is not a value, but a function called in place - an IIFE
      // wrapper the transpiler did not unwrap, `(function () {...}).call(this)` -
      // holds code whose sites count like any other.
      if (key === 'callee') {
        const fn = calledFunction(node[key]);
        if (fn) walk(fn, false, { ...here, inCondition: false });
        continue;
      }
      if (SKIP_KEYS.has(key)) continue;
      const child = node[key];
      if (!child || typeof child !== 'object') continue;
      let childIsValue = true;
      const childWhere = { ...here, inCondition: conditionChain };
      if (CONDITION_KEYS.has(key)) { childIsValue = false; childWhere.inCondition = true; }
      else if (node.type === 'ExpressionStatement' && key === 'expression') childIsValue = false;
      else if ((node.type === 'AssignmentExpression') && key === 'left') childIsValue = false;
      else if (node.type === 'UpdateExpression' && key === 'argument') childIsValue = false;
      else if (node.type === 'SequenceExpression') childIsValue = false;
      else if ((node.type === 'MemberExpression' || node.type === 'ThisPropertyAccess') && key === 'property' && !node.computed) continue;
      else if (node.type === 'Property' && key === 'key' && !node.computed) continue;
      else if (node.type === 'CatchClause' && key === 'param') continue;       // `catch (e)` declares e
      else if ((node.type === 'ForOfStatement' || node.type === 'ForInStatement') && key === 'left') childIsValue = false;
      else if (node.type === 'ForStatement' && (key === 'init' || key === 'update')) childIsValue = false;
      walk(child, childIsValue, childWhere);
    }
    storage(node, here);
  };

  // Storage: every variable, parameter and field must be declared with a type,
  // whether or not a read of it is a value site (an emitter declares it with
  // the type its uses happen to suggest otherwise).
  const isFunctionValue = n => n && /^(FunctionExpression|ArrowFunctionExpression|ArrowFunction|ClassExpression|FunctionDeclaration)$/.test(n.ilNodeType || n.type);
  const storageWeak = t => isWeakType(t) || EMPTY_STORAGE_TYPES.has(typeName(t));
  const storageReason = (what, t) => t && t !== 'undefined'
    ? `${what} is typed '${t}', which states no width or signedness; declare it with a JSDoc type`
    : `${what} has no type; declare it with a JSDoc type or a typed initializer`;
  const fieldsSeen = new Set();
  // A boolean that arithmetic treats as 0 or 1 (`n += OpCodes.GetBit(x, i)`):
  // no typed language adds a boolean to a number.
  const booleanArithmetic = (node, where) => {
    const operands = [];
    if (node.type === 'BinaryExpression' && NUMERIC_OPERATORS.has(node.operator) &&
        !(node.operator === '+' && [node.left, node.right].some(o => o && typeName(o.resultType) === 'string')))
      operands.push(node.left, node.right);
    else if (node.type === 'AssignmentExpression' && NUMERIC_OPERATORS.has(String(node.operator).slice(0, -1)))
      operands.push(node.right);
    else if ((node.type === 'UnaryExpression' && ['-', '+', '~'].includes(node.operator)) ||
             (node.type === 'UpdateExpression'))
      operands.push(node.argument);
    for (const o of operands)
      if (o && typeName(o.resultType) === 'boolean' && !recorded.has(o))
        record(o, { ...where, line: (o.loc && o.loc.line) || where.line, range: o.range || where.range },
          'a boolean used as a number; convert it with `? 1 : 0`', 'local');
  };
  const storage = (node, where) => {
    booleanArithmetic(node, where);
    // set p(v: S) beside get p(): G with S != G - a property of no one type
    if (node.type === 'MethodDefinition' && node.kind === 'set' && where.className && node.key && parser.accessorTypeConflict) {
      const name = node.key.name || node.key.value;
      const conflict = parser.accessorTypeConflict(where.className, name);
      if (conflict)
        record(node.key, where, `accessor '${name}' takes ${conflict.set} but returns ${conflict.get}; a property has one type`, 'local');
      return;
    }
    // let x; const y = untypedCall(); - unless the initializer is itself a counted site
    if (node.type === 'VariableDeclarator' && node.id && node.id.type === 'Identifier' &&
        node.ilNodeType !== 'DestructureTemp' && !isFunctionValue(node.init) &&
        storageWeak(node.resultType) && !(node.init && recorded.has(node.init))) {
      record(node.id, where, storageReason(`variable '${node.id.name}'`, typeName(node.resultType)), 'local');
      return;
    }
    // function f(a) - a parameter without @param (or one the framework types)
    if (FUNCTION_DECLARATIONS.has(node.type) && Array.isArray(node.params)) {
      for (const p of node.params) {
        const param = p && p.type === 'AssignmentPattern' ? p.left : p && p.type === 'RestElement' ? p.argument : p;
        if (!param || param.type !== 'Identifier' || !storageWeak(param.resultType)) continue;
        record(param, { ...where, line: (param.loc && param.loc.line) || where.line, range: param.range || where.range },
          storageReason(`parameter '${param.name}'`, typeName(param.resultType)), 'local');
      }
      return;
    }
    // this.f = v - a field typed by neither the framework, a JSDoc @type nor its assignments
    if (node.type === 'AssignmentExpression' && node.left && node.left.type === 'ThisPropertyAccess' &&
        !node.left.computed && where.className && typeof node.left.property === 'string') {
      const key = `${where.className}.${node.left.property}`;
      if (fieldsSeen.has(key)) return;
      fieldsSeen.add(key);
      if (isFunctionValue(node.right)) return;
      const t = parser.lookupClassFieldType(where.className, node.left.property);
      if (!storageWeak(t)) return;
      const framework = frameworkDeclares(where.className, node.left.property, 'property');
      record(node.left, where, framework ? `framework member '${node.left.property}' has no declared type`
        : storageReason(`field '${node.left.property}'`, typeName(t)), framework ? 'framework' : 'local');
    }
  };

  walk(ast, false, { line: 0, range: null, className: null, inCondition: false });
  sites.sort((a, b) => a.line - b.line);
  // The parse is handed on (TypeSoundness.js checks the same IL AST).
  return { sites, parseError: null, parsed: { parser, ast } };
}

/**
 * Analyze one file.
 * @param {string} filePath - Path to the algorithm file
 * @param {string} [source] - Its text, when the caller has already read it
 * @returns {Object} { sites, parseError, count }
 */
function analyzeFile(filePath, source) {
  const result = analyzeSource(typeof source === 'string' ? source : fs.readFileSync(filePath, 'utf8'), filePath);
  result.count = result.parseError ? null : result.sites.length;
  return result;
}

/**
 * Tally sites per tier.
 * @param {Object[]} sites - Untyped sites
 * @returns {Object} { opcodes, framework, local }
 */
function byTier(sites) {
  const tally = { opcodes: 0, framework: 0, local: 0 };
  for (const s of sites) tally[s.tier] = (tally[s.tier] || 0) + 1;
  return tally;
}

module.exports = { analyzeSource, analyzeFile, byTier, WEAK_TYPES, isWeakType };
