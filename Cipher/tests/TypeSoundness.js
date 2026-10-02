/**
 * TypeSoundness.js - do the IL types hold the values that really flow?
 *
 * TypeCoverage.js counts value sites that have no type. This module checks the
 * sites that do: a site typed 'uint8' that holds 300, 'uint32' holding a
 * negative number or a fraction, 'int32' where a BigInt flows, 'boolean' that
 * is really a number, 'uint8[]' that is really a Uint32Array - each passes
 * TYPES and still emits wrong code in a statically typed language.
 *
 * How: the algorithm file is parsed into the same typed IL AST the emitters
 * consume. Every IL node keeps the source range it came from, so the sites
 * below are wrapped, in the JavaScript source itself, in a call that records
 * the value passing through and returns it unchanged:
 *
 *   initialiser        let x = E;            E against x's type and E's own
 *   assignment         x = E, x op= E        the stored value against the
 *                                            target's type (variable, field or
 *                                            array element) and the result's
 *   update             x++, --x              the new value against x's type
 *   return             return E; (x) => E    E against the function's declared
 *                                            return type and E's own
 *   push               a.push(E)             E against a's element type
 *
 * The instrumented copy is loaded as a fresh module under the file's own name,
 * its algorithms run their committed test vectors (TestEngine.TestAlgorithm,
 * round trips included), and every recorded value is compared with the IL
 * type of its site:
 *
 *   uint8..uint32, int8..int32   a number, integral, within range
 *   uint64, int64                an integral number or a BigInt, within range
 *   bigint                       a BigInt
 *   number, float32, float64     a number
 *   boolean, string              that primitive
 *   T[]                          an Array or a typed array; a typed array of
 *                                the matching kind, a plain array whose
 *                                sampled elements are T
 *
 * Class, interface and enum types are not checked; null and undefined are
 * accepted for arrays and strings (references) and rejected for numbers and
 * booleans. A store into a typed array converts the value (JS truncates
 * silently), so for those only the array's kind is checked against the
 * declared element type.
 *
 * Each site checks its first SAMPLE_FIRST values, and SAMPLE_PER_VECTOR more
 * in each later test vector, so a site in a hot loop costs almost nothing once
 * its budget is spent; a mismatching check keeps its first few offending values.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');
const vm = require('vm');

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

/** Values a site checks before its first budget is spent. */
const SAMPLE_FIRST = 256;
/** Values a site may check again in each later test vector. */
const SAMPLE_PER_VECTOR = 16;
/** Offending values kept per mismatching check. */
const MAX_SAMPLES = 3;
/** Elements of an array sampled per check. */
const ELEMENT_SAMPLES = 24;

// ---------------------------------------------------------------------------
// Types and their runtime predicates
// ---------------------------------------------------------------------------

const INT_RANGES = {
  uint8: [0, 0xFF], int8: [-0x80, 0x7F],
  uint16: [0, 0xFFFF], int16: [-0x8000, 0x7FFF],
  uint32: [0, 0xFFFFFFFF], int32: [-0x80000000, 0x7FFFFFFF]
};
const WIDE_RANGES = {
  uint64: [0n, 0xFFFFFFFFFFFFFFFFn], int64: [-0x8000000000000000n, 0x7FFFFFFFFFFFFFFFn]
};
const ALIASES = {
  byte: 'uint8', word: 'uint16', dword: 'uint32', qword: 'uint64', sbyte: 'int8', short: 'int16',
  int: 'int32', long: 'int64', bool: 'boolean', Boolean: 'boolean', String: 'string',
  float: 'float32', double: 'float64', BigInt: 'bigint', Number: 'number'
};
/** Element type of each typed-array kind, in the IL vocabulary. */
const TYPED_ARRAY_ELEMENTS = {
  Uint8Array: 'uint8', Uint8ClampedArray: 'uint8', Int8Array: 'int8', Uint16Array: 'uint16', Int16Array: 'int16',
  Uint32Array: 'uint32', Int32Array: 'int32', Float32Array: 'float32', Float64Array: 'float64',
  BigUint64Array: 'uint64', BigInt64Array: 'int64'
};
/** IL type names of typed arrays themselves: 'Uint8Array' is 'uint8[]' stored in that kind. */
const TYPED_ARRAY_TYPES = new Set(Object.keys(TYPED_ARRAY_ELEMENTS));

/**
 * @param {*} t - resultType (string or JSDoc type object)
 * @returns {string} type name ('' when none)
 */
function typeName(t) {
  if (t === null || t === undefined) return '';
  if (typeof t === 'string') return t;
  if (typeof t === 'object' && typeof t.name === 'string') return t.isArray && !t.name.endsWith('[]') ? t.name + '[]' : t.name;
  return '';
}

/**
 * The kind of a value that does not fit a numeric or boolean type.
 * @param {*} v - value
 * @returns {string} kind
 */
function wrongPrimitive(v) {
  if (v === null || v === undefined) return 'nullish';
  switch (typeof v) {
    case 'bigint': return 'bigint';
    case 'boolean': return 'boolean';
    case 'string': return 'string';
    case 'number': return 'number';
    default: return Array.isArray(v) || ArrayBuffer.isView(v) ? 'array' : 'object';
  }
}

const checkerCache = new Map();

/**
 * A predicate for an IL type: returns null when the value fits, otherwise the
 * kind of mismatch. Null for a type this checker does not judge.
 * @param {string} type - IL type name
 * @returns {Function|null} (value) => null | kind
 */
function checkerFor(type) {
  if (checkerCache.has(type)) return checkerCache.get(type);
  const checker = buildChecker(type);
  checkerCache.set(type, checker);
  return checker;
}

function buildChecker(raw) {
  if (typeof raw !== 'string' || raw === '') return null;
  const type = ALIASES[raw] || raw;
  if (INT_RANGES[type]) {
    const [lo, hi] = INT_RANGES[type];
    return v => {
      if (typeof v !== 'number') return wrongPrimitive(v);
      if (!Number.isFinite(v)) return Number.isNaN(v) ? 'nan' : 'infinite';
      if (v !== Math.floor(v)) return 'fraction';
      if (v < lo) return lo === 0 ? 'negative' : 'below-range';
      if (v > hi) return 'above-range';
      return null;
    };
  }
  if (WIDE_RANGES[type]) {
    const [lo, hi] = WIDE_RANGES[type];
    const nlo = Number(lo), nhi = Number(hi);
    return v => {
      if (typeof v === 'bigint') return v < lo ? (lo === 0n ? 'negative' : 'below-range') : v > hi ? 'above-range' : null;
      if (typeof v !== 'number') return wrongPrimitive(v);
      if (!Number.isFinite(v)) return Number.isNaN(v) ? 'nan' : 'infinite';
      if (v !== Math.floor(v)) return 'fraction';
      if (v < nlo) return nlo === 0 ? 'negative' : 'below-range';
      if (v > nhi) return 'above-range';
      return null;
    };
  }
  switch (type) {
    case 'bigint': return v => typeof v === 'bigint' ? null : wrongPrimitive(v);
    case 'number': case 'float32': case 'float64': return v => typeof v === 'number' ? null : wrongPrimitive(v);
    case 'boolean': return v => typeof v === 'boolean' ? null : wrongPrimitive(v);
    case 'string': return v => typeof v === 'string' || v === null || v === undefined ? null : wrongPrimitive(v);
  }
  if (TYPED_ARRAY_TYPES.has(type)) {
    const element = TYPED_ARRAY_ELEMENTS[type];
    return v => {
      if (v === null || v === undefined) return null;
      if (!ArrayBuffer.isView(v) || v instanceof DataView) return Array.isArray(v) ? 'plain-array' : wrongPrimitive(v);
      return TYPED_ARRAY_ELEMENTS[v.constructor.name] === element ? null : 'typed-array-kind';
    };
  }
  if (type.endsWith('[]')) {
    const elementType = type.slice(0, -2);
    const element = checkerFor(elementType);
    const elementName = ALIASES[elementType] || elementType;
    return v => {
      if (v === null || v === undefined) return null;
      if (ArrayBuffer.isView(v) && !(v instanceof DataView)) {
        const kind = TYPED_ARRAY_ELEMENTS[v.constructor.name];
        // A typed array of another element kind is another type in every
        // statically typed target, whether or not its values would fit.
        if (element && kind !== elementName) return 'typed-array-kind';
        return null;
      }
      if (!Array.isArray(v)) return v instanceof ArrayBuffer ? 'array-buffer' : wrongPrimitive(v);
      if (!element) return null;
      const n = v.length;
      // Evenly spread over the array, first and last element included
      for (let k = 0; k < n && k < ELEMENT_SAMPLES; ++k) {
        const i = n <= ELEMENT_SAMPLES ? k : Math.round(k * (n - 1) / (ELEMENT_SAMPLES - 1));
        if (!(i in v)) continue;            // a hole of new Array(n), not yet filled
        const bad = element(v[i]);
        if (bad) return 'element-' + bad.replace(/^element-/, '');
      }
      return null;
    };
  }
  return null;            // class, interface, enum, object, function, void, ...
}

/**
 * Short text of an observed value.
 * @param {*} v - value
 * @param {string} type - declared type (to point at the offending element)
 * @returns {string} text
 */
function describe(v, type) {
  if (typeof v === 'bigint') return v.toString() + 'n';
  if (typeof v === 'string') return JSON.stringify(v.length > 24 ? v.slice(0, 21) + '...' : v);
  if (typeof v === 'number' || typeof v === 'boolean' || v === null || v === undefined) return String(v);
  if (ArrayBuffer.isView(v)) return `${v.constructor.name}(${v.length})`;
  if (Array.isArray(v)) {
    const element = typeof type === 'string' && type.endsWith('[]') ? checkerFor(type.slice(0, -2)) : null;
    if (element) {
      for (let i = 0; i < v.length; ++i)
        if (element(v[i])) return `Array(${v.length}) [${i}]=${describe(v[i], type.slice(0, -2))}`;
    }
    return `Array(${v.length})`;
  }
  if (typeof v === 'function') return 'function';
  return v.constructor && v.constructor.name ? v.constructor.name : 'object';
}

// ---------------------------------------------------------------------------
// Sites
// ---------------------------------------------------------------------------

const FUNCTION_TYPES = new Set(['FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration', 'ClassExpression']);
const SKIP_KEYS = new Set(['loc', 'range', 'leadingComments', 'trailingComments', 'comments', 'parent', 'typeInfo', 'jsDoc']);
/** IL nodes standing for an OpCodes call, typed by OpCodes JSDoc (tier 1). */
const OPCODES_NODES = new Set(['InlinedOpCode', 'PackBytes', 'UnpackBytes', 'RotateLeft', 'RotateRight', 'Cast', 'HexDecode',
  'HexEncode', 'StringToBytes', 'BytesToString', 'ArrayXor', 'ArrayClear', 'OpCodesCall']);

/**
 * Is this an assignment to `this.tests` (test vectors)?
 * @param {Object} node - IL node
 * @returns {boolean} true for test vector assignments
 */
function isTestVectorAssignment(node) {
  if (!node || node.type !== 'AssignmentExpression' || !node.left) return false;
  const left = node.left;
  if (left.type === 'ThisPropertyAccess') return left.property === 'tests';
  return left.type === 'MemberExpression' && left.object && left.object.type === 'ThisExpression' &&
    left.property && (left.property.name === 'tests' || left.property.value === 'tests');
}

/**
 * Collect the instrumentable sites of a typed IL AST.
 * @param {Object} parser - TypeAwareJSASTParser that produced the AST
 * @param {Object} ast - IL AST
 * @returns {Object[]} sites { range, line, mode, checks: [{ type, role, origin }] }
 */
function collectSites(parser, ast) {
  const text = parser.normalizedCode;
  const sites = [];

  const hasRange = n => n && Array.isArray(n.range) && n.range[1] > n.range[0];
  const isFunction = n => n && FUNCTION_TYPES.has(n.type);
  const ilType = t => {
    const name = typeName(t);
    return name && checkerFor(name) ? name : null;
  };

  // Where the type of a storage location came from.
  const declaredFieldOrigin = (className, field) => {
    if (!className || !field) return 'inference';
    if (parser._frameworkMemberType && parser._frameworkMemberType(className, field, 'property')) return 'framework';
    const declared = parser.declaredFieldTypes && parser.lookupDeclaredFieldType && parser.lookupDeclaredFieldType(className, field);
    return declared ? 'local-jsdoc' : 'inference';
  };
  const variableOrigin = (name, scope) => {
    for (let s = scope; s; s = s.parent) {
      if (s.declared.has(name)) return s.declared.get(name);
    }
    return 'inference';
  };
  const valueOrigin = (node, where) => {
    if (!node) return 'inference';
    if (node.opCodesMethod || OPCODES_NODES.has(node.ilNodeType) || OPCODES_NODES.has(node.type)) return 'opcodes';
    if (node.type === 'Identifier') return variableOrigin(node.name, where.scope);
    if (node.type === 'ThisPropertyAccess') return declaredFieldOrigin(where.className, node.property);
    if (node.type === 'ThisMethodCall') return methodOrigin(where.className, node.method);
    // An element read is typed by its array.
    if (node.computed && node.object) return valueOrigin(node.object, where);
    if (node.type === 'MemberExpression' && node.computed === false && node.object && node.object.type === 'ThisPropertyAccess') return valueOrigin(node.object, where);
    // An operator on values no tier types gets a default type (int32 for
    // `a + b`): the cause is the untyped operands, which TYPES counts.
    if (onUntyped(node, 3)) return 'local-untyped';
    return 'inference';
  };
  const WEAK = new Set(['', 'number', 'any', 'object', 'Object', 'Array', 'unknown', '*', 'mixed']);
  const onUntyped = (node, depth) => {
    if (!node || depth < 0) return false;
    const operands = node.type === 'BinaryExpression' || node.type === 'LogicalExpression' ? [node.left, node.right] :
      node.type === 'UnaryExpression' || ['Floor', 'Ceil', 'Round', 'Truncate'].includes(node.type) ? [node.argument] :
      node.type === 'ConditionalExpression' ? [node.consequent, node.alternate] : null;
    if (!operands) return false;
    return operands.some(o => o && (WEAK.has(typeName(o.resultType)) && o.type !== 'Literal' || onUntyped(o, depth - 1)));
  };
  const methodOrigin = (className, method) => {
    if (className && parser._frameworkMemberType && parser._frameworkMemberType(className, method, 'method')) return 'framework';
    const declared = parser.lookupClassMethodReturnType && parser.lookupClassMethodReturnType(className, method);
    return declared ? 'local-jsdoc' : 'inference';
  };
  // The type of the storage a target names. The IL types a variable read by
  // the last assignment before it (flow typing), but the variable is declared
  // with its declarator's type, and a field with the type the parse ends with.
  const storageType = (name, scope) => {
    for (let s = scope; s; s = s.parent) if (s.types.has(name)) return s.types.get(name);
    return undefined;
  };
  const targetOf = (left, where) => {
    if (!left) return { role: 'target', origin: 'inference', type: null };
    if (left.type === 'Identifier') {
      const stored = storageType(left.name, where.scope);
      return { role: 'variable', origin: variableOrigin(left.name, where.scope), type: stored !== undefined ? stored : ilType(left.resultType) };
    }
    if (left.type === 'ThisPropertyAccess' && !left.computed) {
      const field = where.className && parser.lookupClassFieldType ? parser.lookupClassFieldType(where.className, left.property) : null;
      return { role: 'field', origin: declaredFieldOrigin(where.className, left.property), type: ilType(field || left.resultType) };
    }
    if (left.computed) return { role: 'element', origin: valueOrigin(left.object, where), type: ilType(left.resultType) };
    return { role: 'property', origin: 'inference', type: ilType(left.resultType) };
  };

  const add = (rangeNode, mode, checks, extra) => {
    const usable = checks.filter(c => c.type);
    if (!hasRange(rangeNode) || usable.length === 0) return;
    // Destructuring and other synthesized nodes inherit a range they do not span.
    const src = text.slice(rangeNode.range[0], rangeNode.range[1]);
    if (/^[[{]/.test(src) && mode === 'assign') return;
    sites.push({ range: rangeNode.range, line: (rangeNode.loc && rangeNode.loc.line) || 0, mode, checks: usable, ...extra });
  };

  const functionReturn = (fn, where) => {
    if (!fn) return { type: null };
    if (fn.methodName && where.className) {
      const framework = parser._frameworkMemberType && parser._frameworkMemberType(where.className, fn.methodName, 'method');
      const fromFramework = framework && framework.returns ? ilType(ilTypeFromJSDocLike(framework.returns)) : null;
      if (fromFramework) return { type: fromFramework, origin: 'framework' };
    }
    const info = fn.node.typeInfo || (fn.node.jsDoc ? { returns: fn.node.jsDoc.returns && fn.node.jsDoc.returns.type } : null);
    const declared = info && info.returns ? ilType(ilTypeFromJSDocLike(info.returns)) : null;
    return declared ? { type: declared, origin: 'local-jsdoc' } : { type: null };
  };

  const scopeFor = (fnNode, parent) => {
    const scope = { parent, declared: new Map(), types: new Map() };
    const params = fnNode && fnNode.typeInfo && fnNode.typeInfo.params;
    const entries = params instanceof Map ? [...params.entries()] : params && typeof params === 'object' ? Object.entries(params) : [];
    for (const [name, type] of entries) {
      scope.declared.set(name, 'local-jsdoc');
      scope.types.set(name, ilType(ilTypeFromJSDocLike(type)));
    }
    // A parameter without JSDoc has no declared storage type to check against.
    for (const p of (fnNode && fnNode.params) || []) {
      const param = p && p.type === 'AssignmentPattern' ? p.left : p;
      if (param && param.name && !scope.types.has(param.name)) scope.types.set(param.name, null);
    }
    return scope;
  };

  const walk = (node, where) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { for (const n of node) walk(n, where); return; }
    if (isTestVectorAssignment(node)) return;

    let here = where;
    if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && node.id && node.id.name)
      here = { ...where, className: node.id.name };
    if (node.type === 'MethodDefinition' && node.value) {
      const name = node.key && (node.key.name || node.key.value);
      here = { ...where, pendingMethod: name };
    }
    if (FUNCTION_TYPES.has(node.type) && node.type !== 'ClassExpression') {
      const fn = { node, methodName: where.pendingMethod || null };
      here = { ...where, fn, pendingMethod: null, scope: scopeFor(node, where.scope) };
      if (node.expression && node.body && !isFunction(node.body) && node.body.type !== 'BlockStatement') {
        const ret = functionReturn(fn, here);
        add(node.body, 'value', [
          { type: ret.type, role: 'return', origin: ret.origin },
          { type: ilType(node.body.resultType), role: 'value', origin: valueOrigin(node.body, here) }
        ]);
      }
    }

    switch (node.type) {
      case 'VariableDeclarator':
        if (node.id && node.id.type === 'Identifier' && node.declaredType)
          here.scope && here.scope.declared.set(node.id.name, 'local-jsdoc');
        // A variable typed only by an integer literal (`let h = 0`): TYPES
        // reports the literal when a later assignment does not fit.
        else if (node.id && node.id.type === 'Identifier' && here.scope && node.init && node.init.type === 'Literal' &&
                 (typeof node.init.value === 'number' || typeof node.init.value === 'bigint'))
          here.scope.declared.set(node.id.name, 'literal-init');
        if (node.id && node.id.type === 'Identifier' && here.scope) here.scope.types.set(node.id.name, ilType(node.resultType));
        if (node.init && !isFunction(node.init) && node.ilNodeType !== 'DestructuredElement' && node.ilNodeType !== 'DestructuredProperty') {
          add(node.init, 'value', [
            { type: ilType(node.resultType), role: 'variable', origin: node.declaredType ? 'local-jsdoc' : 'inference' },
            { type: ilType(node.init.resultType), role: 'value', origin: valueOrigin(node.init, here) }
          ]);
        }
        break;
      case 'AssignmentExpression': {
        if (isFunction(node.right) || !node.left) break;
        const target = targetOf(node.left, here);
        const checks = [{ type: target.type, role: target.role, origin: target.origin }];
        // '=' yields its right side (whose type the assignment repeats, or the
        // target's); a compound assignment yields the result of its operator.
        if (node.operator === '=') checks.push({ type: ilType(node.right && node.right.resultType), role: 'value', origin: valueOrigin(node.right, here) });
        else checks.push({ type: ilType(node.resultType), role: 'value', origin: 'inference' });
        const extra = target.role === 'element' && hasRange(node.left.object) ? { objectRange: node.left.object.range } : {};
        add(node, 'assign', checks, extra);
        break;
      }
      case 'UpdateExpression': {
        const target = targetOf(node.argument, here);
        const checks = [{ type: target.type, role: target.role, origin: target.origin }];
        add(node, 'update', checks, { delta: node.prefix ? 0 : (node.operator === '++' ? 1 : -1) });
        break;
      }
      case 'ReturnStatement':
        if (node.argument && !isFunction(node.argument)) {
          const ret = functionReturn(here.fn, here);
          add(node.argument, 'value', [
            { type: ret.type, role: 'return', origin: ret.origin },
            { type: ilType(node.argument.resultType), role: 'value', origin: valueOrigin(node.argument, here) }
          ]);
        }
        break;
      case 'ArrayAppend': {
        const arrayType = typeName(node.array && node.array.resultType);
        const element = arrayType.endsWith('[]') ? arrayType.slice(0, -2) : null;
        if (element && checkerFor(element))
          for (const value of node.values || [])
            if (value && value.type !== 'SpreadElement')
              add(value, 'value', [{ type: element, role: 'element', origin: valueOrigin(node.array, here) }]);
        break;
      }
    }

    for (const key of Object.keys(node)) {
      if (SKIP_KEYS.has(key)) continue;
      const child = node[key];
      if (child && typeof child === 'object') walk(child, here);
    }
  };

  walk(ast, { className: null, fn: null, pendingMethod: null, scope: { parent: null, declared: new Map(), types: new Map() } });
  return mergeSites(sites);
}

/**
 * A JSDoc type (parser object or string) as an IL type name.
 * @param {*} t - JSDoc type
 * @returns {string|null} IL name
 */
function ilTypeFromJSDocLike(t) {
  if (!t) return null;
  if (typeof t === 'object') {
    if (t.isUnion || t.isTuple || t.isGeneric) return null;
    if (t.isArray) {
      const e = ilTypeFromJSDocLike(t.elementType);
      return e ? e + '[]' : null;
    }
    t = t.name;
  }
  if (typeof t !== 'string') return null;
  t = t.trim().replace(/^[?!]|[?=]$/g, '');
  if (t.includes('|')) {
    const members = t.split('|').map(s => s.trim()).filter(s => s !== 'null' && s !== 'undefined');
    return members.length === 1 ? ilTypeFromJSDocLike(members[0]) : null;
  }
  if (t.endsWith('[]')) {
    const e = ilTypeFromJSDocLike(t.slice(0, -2));
    return e ? e + '[]' : null;
  }
  const arrayOf = t.match(/^Array<(.+)>$/);
  if (arrayOf) {
    const e = ilTypeFromJSDocLike(arrayOf[1]);
    return e ? e + '[]' : null;
  }
  return ALIASES[t] || t;
}

/**
 * Merge sites with the same range (one value, several types), drop duplicate
 * checks and sites that partially overlap another (they cannot both be wrapped).
 * @param {Object[]} sites - collected sites
 * @returns {Object[]} sites sorted by start, outer before inner
 */
function mergeSites(sites) {
  const byRange = new Map();
  for (const s of sites) {
    const key = `${s.range[0]}:${s.range[1]}`;
    const prior = byRange.get(key);
    if (!prior) { byRange.set(key, s); continue; }
    if (prior.mode !== s.mode) {
      // An assignment and the value it is (e.g. a returned assignment) share a
      // range: the assignment mode records the same value.
      if (s.mode === 'assign' || s.mode === 'update') { s.checks.push(...prior.checks); byRange.set(key, s); }
      else prior.checks.push(...s.checks);
      continue;
    }
    prior.checks.push(...s.checks);
    if (s.objectRange && !prior.objectRange) prior.objectRange = s.objectRange;
  }
  const merged = [...byRange.values()];
  for (const s of merged) {
    const seen = new Set();
    s.checks = s.checks.filter(c => {
      const key = `${c.type}|${c.role}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  merged.sort((a, b) => a.range[0] - b.range[0] || b.range[1] - a.range[1]);
  // Keep a properly nested set: a site that starts inside an open site must end inside it.
  const kept = [];
  const stack = [];
  for (const s of merged) {
    while (stack.length && stack[stack.length - 1].range[1] <= s.range[0]) stack.pop();
    const parent = stack[stack.length - 1];
    if (parent && s.range[1] > parent.range[1]) continue;
    kept.push(s);
    stack.push(s);
  }
  // An element store's object range must nest as well.
  for (const s of kept) {
    if (!s.objectRange) continue;
    const [os, oe] = s.objectRange;
    if (os < s.range[0] || oe > s.range[1] || kept.some(o => o !== s && o.range[0] < oe && o.range[1] > os && !(o.range[0] <= os && o.range[1] >= oe) && !(o.range[0] >= os && o.range[1] <= oe)))
      delete s.objectRange;
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Instrumentation
// ---------------------------------------------------------------------------

/*
 * A site E becomes
 *
 *   (__tsT=(E),__tsB[id]>0?__tsR.v(id,__tsT):__tsT)
 *
 * E is evaluated once, before the test; the recorder is called only while the
 * site has check budget left, so a site in a hot loop costs a typed-array load
 * and a compare once its budget is spent. __tsR, __tsB and __tsT are module
 * variables the prologue declares on the file's first line (line numbers stay).
 */

/**
 * Wrap every site of the source in a recording expression.
 * @param {string} text - normalized source the ranges point into
 * @param {Object[]} sites - sorted, nested sites
 * @param {string} hit - global name of the recorder
 * @returns {string} instrumented source (same line numbers)
 */
function instrument(text, sites, hit) {
  const opens = new Map();   // offset -> [text] in order
  const closes = new Map();  // offset -> [text] in order
  const push = (map, at, s, front) => {
    if (!map.has(at)) map.set(at, []);
    if (front) map.get(at).unshift(s); else map.get(at).push(s);
  };
  const wrap = (range, call) => {
    push(opens, range[0], '(__tsT=(');
    push(closes, range[1], `),${call})`, true);
  };
  sites.forEach((site, id) => {
    // Sites are sorted outer-first: an outer open precedes, and its close follows, an inner one.
    if (site.mode === 'update') wrap(site.range, `__tsB[${id}]>0?__tsR.u(${id},__tsT,${site.delta}):__tsT`);
    else wrap(site.range, `__tsB[${id}]>0?__tsR.v(${id},__tsT):__tsT`);
    if (site.objectRange) wrap(site.objectRange, `__tsB[${id}]>0?__tsR.o(${id},__tsT):__tsT`);
  });
  const points = [...new Set([...opens.keys(), ...closes.keys()])].sort((a, b) => a - b);
  let out = '';
  let pos = 0;
  for (const at of points) {
    out += text.slice(pos, at);
    if (closes.has(at)) out += closes.get(at).join('');
    if (opens.has(at)) out += opens.get(at).join('');
    pos = at;
  }
  out += text.slice(pos);

  // The prologue goes on the first line, after a leading 'use strict' directive
  // (a statement in front of it would end the directive prologue).
  out = out.replace(/^#!.*/, '');
  const prologue = `var __tsR=globalThis[${JSON.stringify(hit)}],__tsB=__tsR.budget,__tsT;`;
  const directive = out.match(/^(\s*(?:\/\/[^\n]*\n\s*|\/\*[\s\S]*?\*\/\s*)*)(['"])use strict\2;?/);
  const at = directive ? directive[0].length : 0;
  return out.slice(0, at) + prologue + out.slice(at);
}

/**
 * The recorder the instrumented code calls through a global.
 * @param {Object[]} sites - sites, indexed by id
 * @returns {Object} { v, u, o, budget, hits, failures, rearm, stop }
 */
function createRecorder(sites) {
  const n = sites.length;
  const hits = new Float64Array(n);              // values checked per site
  const budget = new Int32Array(n).fill(SAMPLE_FIRST);
  const objects = new Array(n);
  const checkers = sites.map(s => s.checks.map(c => checkerFor(c.type)));
  const failures = new Map();                    // `${id}:${checkIndex}` -> { count, kinds, samples }

  const check = (id, v) => {
    --budget[id];
    ++hits[id];
    const list = checkers[id];
    const obj = objects[id];
    const typedTarget = obj !== undefined && ArrayBuffer.isView(obj);
    for (let i = 0; i < list.length; ++i) {
      const check = sites[id].checks[i];
      let kind;
      let shown = v;
      if (typedTarget && check.role === 'element') {
        // JS converts what a typed array stores; only its kind can be wrong.
        const elementKind = TYPED_ARRAY_ELEMENTS[obj.constructor.name];
        const declared = ALIASES[check.type] || check.type;
        kind = elementKind && declared !== elementKind ? 'typed-array-kind' : null;
        shown = obj;
      } else {
        kind = list[i](v);
      }
      if (!kind) continue;
      const key = `${id}:${i}`;
      let f = failures.get(key);
      if (!f) failures.set(key, f = { count: 0, kinds: new Map(), samples: [] });
      ++f.count;
      f.kinds.set(kind, (f.kinds.get(kind) || 0) + 1);
      if (f.samples.length < MAX_SAMPLES && f.count <= 16) {
        const text = describe(shown, check.type);
        if (!f.samples.includes(text)) f.samples.push(text);
      }
    }
  };

  return {
    v(id, v) { check(id, v); return v; },
    u(id, v, delta) {
      check(id, delta === 0 ? v : typeof v === 'bigint' ? v + BigInt(delta) : v + delta);
      return v;
    },
    o(id, obj) { objects[id] = obj; return obj; },
    /** A new test vector: every site may check a few values again. */
    rearm() {
      for (let i = 0; i < n; ++i) if (budget[i] < SAMPLE_PER_VECTOR) budget[i] = SAMPLE_PER_VECTOR;
    },
    stop() { budget.fill(0); },
    budget,
    hits,
    failures
  };
}


// ---------------------------------------------------------------------------
// Running a file
// ---------------------------------------------------------------------------

let fileCounter = 0;

/**
 * A deterministic stand-in for Math.random (xorshift32).
 * @param {number} seed - non-zero 32-bit seed
 * @returns {Function} () => number in [0, 1)
 */
function seededRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Parse a file into the IL AST (quietly).
 * @param {string} source - text
 * @param {string} [filePath] - its path (types the sibling data modules it requires)
 * @returns {Object} { parser, ast, error }
 */
function parseSource(source, filePath) {
  const P = parserClass();
  const log = console.log, warn = console.warn, error = console.error;
  console.log = console.warn = console.error = () => {};
  try {
    const parser = new P(source, filePath ? { sourcePath: path.resolve(filePath) } : {});
    const ast = parser.parse();
    return { parser, ast, error: null };
  } catch (e) {
    return { parser: null, ast: null, error: e.message };
  } finally {
    console.log = log; console.warn = warn; console.error = error;
  }
}

/**
 * Load the instrumented copy of a file as a fresh module and capture what it
 * registers, leaving the framework's registry as it was.
 * @param {string} filePath - absolute path
 * @param {string} code - instrumented source
 * @returns {Object[]} algorithms the copy registered
 */
function loadInstrumented(filePath, code) {
  const AF = global.AlgorithmFramework;
  const registry = AF.Algorithms;
  const register = AF.RegisterAlgorithm;
  const captured = [];
  const displaced = [];
  // The file's own algorithms, registered when the suite loaded the original,
  // step aside: files register only what Find() does not know yet.
  const sources = global.__algorithmSources;
  const own = path.resolve(filePath).toLowerCase();
  for (let i = registry.length - 1; i >= 0; --i)
    if (sources && sources.get(registry[i]) === own) displaced.push({ at: i, algorithm: registry.splice(i, 1)[0] });
  AF.RegisterAlgorithm = function (algorithm) {
    // The original file's algorithm of the same name steps aside while its
    // instrumented copy runs, so Find() inside the file reaches the copy.
    const at = registry.findIndex(a => a && algorithm && a.name === algorithm.name);
    if (at >= 0) displaced.push({ at, algorithm: registry.splice(at, 1)[0] });
    const result = register.apply(this, arguments);
    captured.push(algorithm);
    return result;
  };
  try {
    const m = new Module(filePath, module);
    m.filename = filePath;
    m.paths = Module._nodeModulePaths(path.dirname(filePath));
    m._compile(code, filePath);
  } finally {
    AF.RegisterAlgorithm = register;
  }
  return { captured, restore() {
    for (const a of captured) {
      const i = registry.indexOf(a);
      if (i >= 0) registry.splice(i, 1);
    }
    for (const d of displaced.reverse()) registry.splice(Math.min(d.at, registry.length), 0, d.algorithm);
  } };
}

/**
 * Check one algorithm file.
 * @param {string} filePath - Path to the algorithm file
 * @param {Object} [options] - { source, parsed: {parser, ast}, testAlgorithm, maxVectors }
 * @returns {Promise<Object>} { sites, hitSites, mismatches: [...], error, timeMs }
 */
async function checkFile(filePath, options = {}) {
  const start = process.hrtime.bigint();
  const absolute = path.resolve(filePath);
  const source = typeof options.source === 'string' ? options.source : fs.readFileSync(absolute, 'utf8');
  const parsed = options.parsed && options.parsed.parser ? options.parsed : parseSource(source, absolute);
  const done = (result) => ({ ...result, timeMs: Number(process.hrtime.bigint() - start) / 1e6 });
  if (!parsed.parser) return done({ sites: 0, hitSites: 0, mismatches: [], error: `unparsed: ${parsed.error}` });

  const sites = collectSites(parsed.parser, parsed.ast);
  const text = parsed.parser.normalizedCode;
  const hit = `__typeSoundness${++fileCounter}`;
  const code = instrument(text, sites, hit);
  try {
    vm.compileFunction(code, ['exports', 'require', 'module', '__filename', '__dirname'], { filename: absolute });
  } catch (e) {
    return done({ sites: sites.length, hitSites: 0, mismatches: [], error: `instrumented copy does not compile: ${e.message}` });
  }

  const recorder = createRecorder(sites);
  global[hit] = recorder;
  const quiet = options.quiet !== false;
  const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info, debug: console.debug };
  if (quiet) console.log = console.warn = console.error = console.info = console.debug = () => {};
  // The same values every run: an algorithm drawing on Math.random (padding,
  // nonces, test keys) sees a fixed sequence, so its count cannot flicker.
  const random = Math.random;
  Math.random = seededRandom(0x9E3779B9);
  let loaded = null;
  let error = null;
  try {
    loaded = loadInstrumented(absolute, code);
    const testAlgorithm = options.testAlgorithm || require('./TestEngine').TestAlgorithm;
    for (const algorithm of loaded.captured) {
      if (!algorithm.tests || algorithm.tests.length === 0) continue;
      const original = algorithm.tests;
      if (options.maxVectors && original.length > options.maxVectors) algorithm.tests = original.slice(0, options.maxVectors);
      try { await testAlgorithm(algorithm, { verbose: false, progressCallback: () => recorder.rearm() }); }
      catch (e) { error = error || `${algorithm.name}: ${e.message}`; }
      finally { algorithm.tests = original; }
    }
  } catch (e) {
    error = `instrumented copy failed to load: ${e.message}`;
  } finally {
    recorder.stop();
    delete global[hit];
    if (loaded) loaded.restore();
    Object.assign(console, saved);
    Math.random = random;
  }

  const expressionText = (range) => {
    const s = text.slice(range[0], range[1]).replace(/\s+/g, ' ').trim();
    return s.length > 90 ? s.slice(0, 87) + '...' : s;
  };
  const mismatches = [];
  for (const [key, f] of recorder.failures) {
    const [id, index] = key.split(':').map(Number);
    const site = sites[id];
    const check = site.checks[index];
    const kinds = [...f.kinds.entries()].sort((a, b) => b[1] - a[1]);
    mismatches.push({
      line: site.line,
      expression: expressionText(site.range),
      role: check.role,
      type: check.type,
      origin: check.origin,
      kind: kinds[0][0],
      kinds: Object.fromEntries(kinds),
      observed: f.samples,
      count: f.count,
      hits: recorder.hits[id]
    });
  }
  mismatches.sort((a, b) => a.line - b.line || a.expression.localeCompare(b.expression));
  let hitSites = 0;
  for (let i = 0; i < recorder.hits.length; ++i) if (recorder.hits[i] > 0) ++hitSites;
  return done({ sites: sites.length, hitSites, mismatches, error });
}

/**
 * The mismatching sites of a result, one per (line, expression, type, role).
 * @param {Object[]} mismatches - checkFile().mismatches
 * @returns {number} count
 */
function siteCount(mismatches) {
  return new Set(mismatches.map(m => `${m.line}|${m.expression}|${m.role}|${m.type}`)).size;
}

module.exports = { checkFile, collectSites, instrument, createRecorder, checkerFor, parseSource, siteCount, describe };
