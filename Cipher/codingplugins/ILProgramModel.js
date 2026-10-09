/**
 * ILProgramModel.js - Whole-program model of a typed IL AST for statically typed targets
 * (c)2006-2025 Hawkynt
 *
 * The Go and Rust transformers have no classes with inheritance and virtual
 * dispatch, so they need the program as a set of flat classes: every class
 * carries the fields, accessors and methods of its whole base chain, the
 * AlgorithmFramework.js base classes included. This module builds that model
 * from the IL AST:
 *
 * - the framework's own IL (AlgorithmFramework.js parsed by the same
 *   TypeAwareJSASTParser), so a framework method such as
 *   IBlockCipherInstance.Result() is emitted into each class that inherits it
 *   and its `this.EncryptBlock(...)` reaches the class's own override;
 * - per class: its base, its subclasses, its own constructor, methods,
 *   accessors, static members and fields (with their IL types), and the
 *   flattened member table of its chain;
 * - the top-level functions, variables and statements in source order;
 * - what the program reaches, so only the framework parts it uses are emitted.
 *
 * Types are IL types throughout ('uint32', 'uint8[]', 'TEAInstance', ...); the
 * targets map them. Nothing here guesses a type from a name or a value.
 */

(function (global) {
  'use strict';

  // ==========================================================================
  // IL TYPE UTILITIES
  // ==========================================================================

  const INT_BITS = { int8: 8, int16: 16, int32: 32, int64: 64, uint8: 8, uint16: 16, uint32: 32, uint64: 64 };
  const TYPE_ALIASES = {
    byte: 'uint8', word: 'uint16', dword: 'uint32', qword: 'uint64', sbyte: 'int8', short: 'int16',
    int: 'int32', long: 'int64', uint: 'uint32', ushort: 'uint16', ulong: 'uint64', bool: 'boolean',
    Boolean: 'boolean', String: 'string', float: 'float64', double: 'float64', float32: 'float64',
    Number: 'number', BigInt: 'bigint', Array: 'any[]', Object: 'object', Function: 'function',
    Uint8Array: 'uint8[]', Uint8ClampedArray: 'uint8[]', Int8Array: 'int8[]', Uint16Array: 'uint16[]',
    Int16Array: 'int16[]', Uint32Array: 'uint32[]', Int32Array: 'int32[]', Float32Array: 'float64[]',
    Float64Array: 'float64[]', BigUint64Array: 'bigint[]', BigInt64Array: 'bigint[]', '*': 'any', mixed: 'any',
    ArrayBuffer: 'uint8[]',
    undefined: 'void'
  };

  /** The canonical spelling of an IL type ('BigInt' -> 'bigint', 'byte' -> 'uint8', ...). */
  function canonicalType(type) {
    if (type === null || type === undefined) return null;
    if (typeof type !== 'string') type = jsDocToIL(type);
    if (!type) return null;
    type = type.trim();
    if (type.endsWith('[]')) {
      const element = canonicalType(type.slice(0, -2));
      return element ? element + '[]' : 'any[]';
    }
    return TYPE_ALIASES[type] || type;
  }

  const isArrayType = t => typeof t === 'string' && t.endsWith('[]');
  const elementType = t => isArrayType(t) ? t.slice(0, -2) : null;
  const isIntType = t => Object.prototype.hasOwnProperty.call(INT_BITS, t);
  const isFloatType = t => t === 'float64' || t === 'number' || t === 'float32';
  const isNumericType = t => isIntType(t) || isFloatType(t);
  const isBigType = t => t === 'bigint' || t === 'BigInt';
  const intBits = t => INT_BITS[t] || 0;
  const isSignedInt = t => isIntType(t) && t.startsWith('int');
  const isTupleType = t => typeof t === 'string' && t.startsWith('[') && t.endsWith(']');

  /**
   * A JSDoc type (a JSDocParser type object or a type string) as an IL type.
   * A nullable union maps to its non-null member, other unions and generics to
   * 'any', keyed collections to 'Map<K,V>' / 'object'.
   * @param {Object|string} t - JSDoc type
   * @returns {string|null} IL type
   */
  function jsDocToIL(t) {
    if (!t) return null;
    if (typeof t === 'object') {
      if (t.isTuple) return 'any[]';
      if (t.isUnion) return jsDocToIL((t.unionTypes || []).map(u => u && u.name).filter(Boolean).join('|'));
      if (t.isArray) {
        const element = jsDocToIL(t.elementType);
        return (element || 'any') + '[]';
      }
      if (t.isGeneric) return t.name === 'Map' ? 'Map' : (t.name === 'Array' ? 'any[]' : 'object');
      t = t.name;
    }
    if (typeof t !== 'string') return null;
    t = t.trim().replace(/^[?!]|[?=]$/g, '');
    if (!t) return null;
    if (t.includes('|')) {
      const members = t.split('|').map(s => s.trim()).filter(s => s && s !== 'null' && s !== 'undefined');
      if (members.length === 1) return jsDocToIL(members[0]);
      return members.length === 0 ? null : 'any';
    }
    if (/^(Map|Set)\b/.test(t)) return t.startsWith('Set') ? 'Set' : 'Map';
    if (/^(Object|Record)\.?</.test(t)) return 'object';
    if (t.endsWith('[]')) return (jsDocToIL(t.slice(0, -2)) || 'any') + '[]';
    const arrayOf = t.match(/^Array\.?<(.+)>$/);
    if (arrayOf) return (jsDocToIL(arrayOf[1]) || 'any') + '[]';
    if (t.startsWith('[') && t.endsWith(']')) return 'any[]';
    if (t.startsWith('{') || t.startsWith('function') || t.includes('=>')) return t.startsWith('{') ? 'object' : 'function';
    if (!/^[A-Za-z_$][\w$.]*$/.test(t)) return 'any';
    return canonicalType(t);
  }

  /** Whether a JSDoc type admits null for a value type ({int32|null}, {?uint32}, {int32=}). */
  function jsDocNullable(t) {
    if (!t) return false;
    let text = t;
    let flagged = false;
    if (typeof t === 'object') {
      if (t.isArray || t.isGeneric || t.isTuple) return false;
      flagged = !!t.isNullable;
      text = t.isUnion ? (t.unionTypes || []).map(u => u && u.name).filter(Boolean).join('|') : t.name;
    }
    if (typeof text !== 'string') return false;
    const marked = flagged || /^\?|[?=]$/.test(text.trim()) || text.split('|').some(s => s.trim() === 'null' || s.trim() === 'undefined');
    const base = jsDocToIL(text);
    return marked && (isNumericType(base) || isBigType(base) || base === 'boolean');
  }

  // ==========================================================================
  // AUTOMATIC SEMICOLON INSERTION (for AlgorithmFramework.js)
  // ==========================================================================

  /**
   * Insert the semicolons JavaScript's automatic semicolon insertion implies,
   * so the IL parser (which needs them after a throw and between statements on
   * separate lines) reads semicolon-free code such as AlgorithmFramework.js.
   * Statements end at a line break when the line ends a value, the next line
   * starts a statement, and the line is not a control-statement header; inside
   * object literals, argument lists and brackets nothing is inserted.
   * @param {string} src - JavaScript source
   * @returns {string} the source with the implied semicolons written out
   */
  function insertSemicolons(src) {
    const out = [];
    const stack = [];
    const n = src.length;
    let lastSig = '';
    let lastWord = '';
    let lastHeaderClose = false;
    let pendingHeader = false;
    const isIdChar = c => /[A-Za-z0-9_$]/.test(c);
    const NO_VALUE_WORDS = /^(return|else|do|typeof|new|delete|void|throw|case|in|instanceof|of|yield|await|extends)$/;
    const endsValue = () => (/[A-Za-z0-9_$)\]'"`]/.test(lastSig) && !NO_VALUE_WORDS.test(lastWord))
      || lastWord === 'return' || lastWord === 'break' || lastWord === 'continue';
    const startsStatement = pos => {
      const rest = src.slice(pos, pos + 16);
      return /^[A-Za-z_$'"`}]/.test(rest) && !/^(instanceof|in)\b/.test(rest);
    };
    let i = 0;
    while (i < n) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') {
        const j = src.indexOf('\n', i);
        const e = j < 0 ? n : j;
        out.push(src.slice(i, e));
        i = e;
        continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        const j = src.indexOf('*/', i + 2);
        const e = j < 0 ? n : j + 2;
        out.push(src.slice(i, e));
        i = e;
        continue;
      }
      if (c === '\n') {
        let j = i + 1;
        while (j < n) {
          if (/\s/.test(src[j])) { ++j; continue; }
          if (src[j] === '/' && src[j + 1] === '/') { const k = src.indexOf('\n', j); j = k < 0 ? n : k; continue; }
          if (src[j] === '/' && src[j + 1] === '*') { const k = src.indexOf('*/', j + 2); j = k < 0 ? n : k + 2; continue; }
          break;
        }
        const top = stack[stack.length - 1] || 'block';
        if (top === 'block' && lastSig && lastSig !== ';' && endsValue() && !lastHeaderClose && startsStatement(j)) {
          out.push(';');
          lastSig = ';';
          lastWord = '';
        }
        out.push(c);
        ++i;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        let j = i + 1;
        while (j < n && src[j] !== c) { if (src[j] === '\\') ++j; ++j; }
        out.push(src.slice(i, j + 1));
        i = j + 1;
        lastSig = c;
        lastWord = '';
        lastHeaderClose = false;
        continue;
      }
      if (isIdChar(c)) {
        let j = i;
        while (j < n && isIdChar(src[j])) ++j;
        const word = src.slice(i, j);
        out.push(word);
        i = j;
        lastSig = word[word.length - 1];
        lastWord = word;
        lastHeaderClose = false;
        if (/^(if|for|while|catch|switch|function)$/.test(word)) pendingHeader = true;
        continue;
      }
      if (/\s/.test(c)) { out.push(c); ++i; continue; }
      if (c === '(') { stack.push(pendingHeader ? 'header' : 'paren'); pendingHeader = false; }
      else if (c === '[') stack.push('bracket');
      else if (c === '{') stack.push(/[=(,:\[?]/.test(lastSig) || lastWord === 'return' ? 'object' : 'block');
      else if (c === ')' || c === ']' || c === '}') {
        const kind = stack.pop();
        if (c === '}' && kind === 'block' && lastSig && lastSig !== ';' && lastSig !== '{' && endsValue() && !lastHeaderClose) out.push(';');
        out.push(c);
        ++i;
        lastSig = c;
        lastWord = '';
        lastHeaderClose = kind === 'header';
        continue;
      }
      out.push(c);
      ++i;
      lastSig = c;
      lastWord = '';
      lastHeaderClose = false;
    }
    return out.join('');
  }

  // ==========================================================================
  // FRAMEWORK IL
  // ==========================================================================

  /** Framework members the target runtimes provide themselves (the registry). */
  const RUNTIME_PROVIDED = new Set(['RegisterAlgorithm', '_processTestVector', 'Find', 'Clear', 'Algorithms']);

  let frameworkCache = null;

  function getParser() {
    if (typeof require !== 'undefined') {
      try { return require('../type-aware-transpiler.js').TypeAwareJSASTParser; } catch (e) { /* fall through */ }
    }
    return global.TypeAwareJSASTParser || null;
  }

  function frameworkSource() {
    if (typeof require !== 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');
        return fs.readFileSync(path.join(__dirname, '..', 'AlgorithmFramework.js'), 'utf8');
      } catch (e) { /* fall through */ }
    }
    return global.AlgorithmFrameworkSource || null;
  }

  /**
   * The IL of AlgorithmFramework.js: its top-level statements, parsed once.
   * @returns {Object[]} top-level IL statements ([] when it cannot be read)
   */
  function frameworkIL() {
    if (frameworkCache) return frameworkCache;
    frameworkCache = [];
    const Parser = getParser();
    const source = frameworkSource();
    if (!Parser || !source) return frameworkCache;
    const log = console.log;
    try {
      console.log = () => {};
      const ast = new Parser(insertSemicolons(source)).parse();
      frameworkCache = (ast && ast.body) || [];
    } catch (e) {
      frameworkCache = [];
    } finally {
      console.log = log;
    }
    return frameworkCache;
  }

  // ==========================================================================
  // AST WALKING
  // ==========================================================================

  /**
   * Visit every IL node under a root (not into nested class declarations unless asked).
   * @param {Object} root - IL node or array
   * @param {function(Object, Object): (boolean|void)} visit - return false to skip a node's children
   */
  function walk(root, visit) {
    const seen = new Set();
    (function go(node, parent) {
      if (!node || typeof node !== 'object' || seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) { for (const x of node) go(x, parent); return; }
      if (typeof node.type === 'string' && visit(node, parent) === false) return;
      for (const key in node) {
        if (key === 'parent' || key === 'leadingComments' || key === 'trailingComments' || key === 'jsDoc' || key === 'typeInfo') continue;
        const v = node[key];
        if (v && typeof v === 'object') go(v, typeof node.type === 'string' ? node : parent);
      }
    })(root, null);
  }

  // ==========================================================================
  // PROGRAM MODEL
  // ==========================================================================

  /** The class a new expression constructs: new X(...) or new AlgorithmFramework.X(...). */
  function constructedName(callee) {
    if (!callee) return null;
    if (callee.type === 'Identifier') return callee.name || null;
    if (callee.type === 'MemberExpression' && !callee.computed && callee.object && callee.object.name === 'AlgorithmFramework') {
      const p = callee.property;
      return typeof p === 'string' ? p : (p && (p.name || p.value)) || null;
    }
    return null;
  }

  /** The @template type parameters of a function: a value of one has no single type, so it is 'any'. */
  function templateNames(fn, jsDoc) {
    const names = new Set();
    for (const list of [jsDoc && jsDoc.templates, fn && fn.typeInfo && fn.typeInfo.templates]) {
      if (!Array.isArray(list)) continue;
      for (const t of list) {
        const name = typeof t === 'string' ? t : (t && t.name);
        if (name) for (const n of String(name).split(',')) names.add(n.trim());
      }
    }
    return names;
  }

  /** A JSDoc/IL type where a template parameter (T, T[]) stands for 'any'. */
  function withoutTemplates(type, templates) {
    if (!type || !templates.size) return type;
    let base = type;
    let dims = '';
    while (base.endsWith('[]')) { base = base.slice(0, -2); dims += '[]'; }
    return templates.has(base) ? 'any' + dims : type;
  }

  /** A method's IL return type: its JSDoc, else the type its return statements give. */
  function functionReturnType(fn, jsDoc) {
    if (!fn) return 'void';
    const declared = (fn.typeInfo && fn.typeInfo.returns) || (jsDoc && jsDoc.returns && jsDoc.returns.type) || fn.returnType || fn.declaredReturnType;
    if (declared) {
      const t = withoutTemplates(typeof declared === 'string' ? canonicalType(declared) : jsDocToIL(declared), templateNames(fn, jsDoc));
      if (t && t !== 'void') return t;
      if (t === 'void') return 'void';
    }
    let found = null;
    let hasValue = false;
    walk(fn.body, (node) => {
      if (node !== fn.body && (node.type === 'FunctionExpression' || node.type === 'FunctionDeclaration' || node.type === 'ArrowFunction' || node.type === 'ArrowFunctionExpression' || node.type === 'ClassDeclaration')) return false;
      if (node.type === 'ReturnStatement' && node.argument) {
        hasValue = true;
        const t = canonicalType(node.argument.resultType);
        if (t && t !== 'null' && !found) found = t;
      }
    });
    if (fn.expression && fn.body && fn.body.type !== 'BlockStatement') return canonicalType(fn.body.resultType) || 'any';
    return found || (hasValue ? 'any' : 'void');
  }

  /** Whether a function's declared return admits null for a value type. */
  function functionReturnNullable(fn, jsDoc) {
    const declared = (fn && fn.typeInfo && fn.typeInfo.returns) || (jsDoc && jsDoc.returns && jsDoc.returns.type);
    return jsDocNullable(declared);
  }

  /**
   * The IL types a function body gives its local names where they are
   * assigned or read: for a declarator the IL left untyped (let a, b; with
   * the values assigned later). First typed assignment wins, else first typed read.
   * @param {Object} body - function body
   * @returns {Map<string, string>} name -> IL type
   */
  function localUseTypes(body) {
    const assigned = new Map();
    const read = new Map();
    walk(body, n => {
      if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'Identifier') {
        const t = canonicalType(n.left.resultType || n.right.resultType);
        if (t && t !== 'null' && t !== 'any' && !assigned.has(n.left.name)) assigned.set(n.left.name, t);
      } else if (n.type === 'Identifier' && n.name) {
        const t = canonicalType(n.resultType);
        if (t && t !== 'null' && t !== 'any' && t !== 'function' && !read.has(n.name)) read.set(n.name, t);
      }
    });
    for (const [k, v] of read) if (!assigned.has(k)) assigned.set(k, v);
    return assigned;
  }

  /**
   * The parameters of a function: name, IL type, nullable, default value node.
   * @param {Object} fn - FunctionExpression / FunctionDeclaration / ArrowFunction
   * @param {Object} [jsDoc] - the method's JSDoc
   */
  function functionParams(fn, jsDoc) {
    if (!fn || !fn.params) return [];
    const docParams = (jsDoc && jsDoc.params) || [];
    const templates = templateNames(fn, jsDoc);
    return fn.params.map((p, i) => {
      let node = p;
      let defaultValue = p.defaultValue || null;
      if (p.type === 'AssignmentPattern') { node = p.left; defaultValue = p.right; }
      const rest = p.type === 'RestElement';
      if (rest) node = p.argument;
      const doc = docParams.find(d => d.name === node.name) || docParams[i];
      let type = canonicalType(node.resultType);
      if ((!type || type === 'any') && doc && doc.type) type = jsDocToIL(doc.type) || type;
      type = withoutTemplates(type, templates);
      const nullable = !!node.nullable || (doc && jsDocNullable(doc.type)) || false;
      const optional = !!defaultValue || !!(doc && doc.type && (doc.type.isOptional || /=$/.test(doc.type.name || '')));
      return { name: node.name, type: type || 'any', nullable, defaultValue, optional, rest };
    });
  }

  /**
   * Build the whole-program model.
   * @param {Object} program - IL Program node
   * @param {Object} [options] - { framework: true to merge AlgorithmFramework.js }
   * @returns {ProgramModel}
   */
  function buildModel(program, options = {}) {
    const model = new ProgramModel();
    const useFramework = options.framework !== false;
    const frameworkBody = useFramework ? frameworkIL() : [];
    for (const stmt of frameworkBody) model.addTopLevel(stmt, 'framework');
    let body = (program && program.body) || [];
    for (const lib of options.libraries || []) body = mergeLibrary(body, lib);
    for (const stmt of body) model.addTopLevel(stmt, 'main');
    model.link();
    model.computeReachable();
    return model;
  }

  /**
   * Bundle a library an algorithm takes through a factory parameter (a .data.js
   * file: function (AlgorithmFramework, OpCodes, Library)). The library's
   * top-level names get the prefix "<param>__" and its statements go ahead of
   * the program's; in the program, Param.X becomes that prefixed X, a name
   * destructured from the parameter its prefixed name, and the parameter itself
   * (as a value) a module object of the exports - or, for a library exporting
   * one value, that value.
   * @param {Object[]} body - program statements
   * @param {{param: string, ast: Object, names: string[], single: string|null}} lib
   * @returns {Object[]} the merged statements
   */
  function mergeLibrary(body, lib) {
    const prefix = lib.param + '__';
    const declared = new Set();
    for (const s of (lib.ast && lib.ast.body) || []) {
      if ((s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') && s.id) declared.add(s.id.name);
      if (s.type === 'VariableDeclaration') for (const d of s.declarations) if (d.id && d.id.type === 'Identifier') declared.add(d.id.name);
    }
    const renameIn = (root, names, to) => walk(root, n => {
      if (n.type === 'Identifier' && names.has(n.name)) n.name = to(n.name);
      if (n.type === 'ClassDeclaration' && n.superClass && n.superClass.type === 'Identifier' && names.has(n.superClass.name)) n.superClass.name = to(n.superClass.name);
      if (n.type === 'NewExpression' && n.callee && n.callee.type === 'Identifier' && names.has(n.callee.name)) n.callee.name = to(n.callee.name);
      for (const key of ['resultType', 'contextType', 'declaredType']) {
        if (typeof n[key] === 'string') {
          let base = n[key];
          let dims = '';
          while (base.endsWith('[]')) { base = base.slice(0, -2); dims += '[]'; }
          if (names.has(base)) n[key] = to(base) + dims;
        }
      }
      if (n.type === 'ParentConstructorCall' && names.has(n.parentClass)) n.parentClass = to(n.parentClass);
    });
    // Only the library's declarations: its other top-level statements are module plumbing (exports)
    const libBody = ((lib.ast && lib.ast.body) || []).filter(s => ['FunctionDeclaration', 'ClassDeclaration', 'VariableDeclaration'].includes(s.type));
    renameIn(libBody, declared, n => prefix + n);
    const exported = new Set(lib.names || []);
    // In the program: Param.X -> prefixed X; { X } = Param -> prefixed X; Param -> module object
    const destructured = new Map(); // local name -> exported name
    const kept = [];
    const propName = p => typeof p === 'string' ? p : (p && (p.name || p.value));
    for (const s of body) {
      if (s.type === 'VariableDeclaration' && s.declarations.length && s.declarations.every(d => d.id && d.id.type === 'ObjectPattern' && d.init && d.init.type === 'Identifier' && d.init.name === lib.param)) {
        for (const d of s.declarations) for (const p of d.id.properties || []) {
          const key = propName(p.key);
          const local = p.value && p.value.type === 'Identifier' ? p.value.name : key;
          if (key) destructured.set(local, key);
        }
        continue;
      }
      // The IL's form of const { X, Y } = Param: const _destructure_0 = Param, X = _destructure_0.X, ...
      const first = s.type === 'VariableDeclaration' && s.declarations[0];
      if (first && first.ilNodeType === 'DestructureTemp' && first.init && first.init.type === 'Identifier' && first.init.name === lib.param) {
        const temp = first.id.name;
        for (const d of s.declarations.slice(1)) {
          if (d.init && d.init.type === 'MemberExpression' && d.init.object && d.init.object.name === temp && d.id && d.id.type === 'Identifier')
            destructured.set(d.id.name, propName(d.init.property));
        }
        continue;
      }
      kept.push(s);
    }
    const target = name => lib.single ? prefix + lib.single : prefix + (destructured.get(name) || name);
    const member = v => {
      if (!v || typeof v !== 'object' || v.type !== 'MemberExpression' || v.computed || !v.object || v.object.type !== 'Identifier' || v.object.name !== lib.param || lib.single) return null;
      const prop = typeof v.property === 'string' ? v.property : (v.property && (v.property.name || v.property.value));
      return exported.has(prop) ? Object.assign({}, v, { type: 'Identifier', name: prefix + prop, object: undefined, property: undefined }) : null;
    };
    walk(kept, n => {
      for (const key of Object.keys(n)) {
        if (key === 'parent') continue;
        const v = n[key];
        if (Array.isArray(v)) v.forEach((x, i) => { const r = member(x); if (r) v[i] = r; });
        else { const r = member(v); if (r) n[key] = r; }
      }
    });
    if (destructured.size) renameIn(kept, new Set(destructured.keys()), target);
    if (lib.single) renameIn(kept, new Set([lib.param]), () => prefix + lib.single);
    // The parameter as a value (if (!Param), const C = Param): the module object
    const moduleObject = lib.single ? null : {
      type: 'VariableDeclaration', kind: 'const',
      declarations: [{
        type: 'VariableDeclarator', resultType: 'object',
        id: { type: 'Identifier', name: lib.param, resultType: 'object' },
        init: {
          type: 'ObjectLiteral', resultType: 'object',
          properties: [...exported].filter(name => declared.has(name)).map(name => ({
            type: 'ObjectProperty', key: name, computed: false,
            value: { type: 'Identifier', name: prefix + name, resultType: 'any' }
          }))
        }
      }]
    };
    return [...libBody, ...(moduleObject ? [moduleObject] : []), ...kept];
  }

  class ClassInfo {
    constructor(name, node, origin) {
      this.name = name;
      this.node = node;
      this.origin = origin;
      this.baseName = node.superClass && (node.superClass.name || (node.superClass.property && node.superClass.property.name)) || null;
      this.base = null;
      this.subclasses = [];
      this.ctor = null;
      this.ctorDoc = null;
      this.methods = new Map();       // name -> { name, fn, jsDoc, owner }
      this.getters = new Map();       // name -> { fn, jsDoc, owner }
      this.setters = new Map();
      this.staticMethods = new Map(); // name -> { name, fn, jsDoc, owner }
      this.staticFields = new Map();  // name -> { type, init, owner }
      this.staticGetters = new Map();
      this.fields = new Map();        // name -> { type, nullable, owner, fromRead }
      this.fieldInits = [];           // FieldDefinition (instance) nodes
      this.effective = null;
    }

    /** The classes from the root of the chain down to this one. */
    chain() {
      const list = [];
      for (let c = this; c; c = c.base) list.unshift(c);
      return list;
    }

    isA(name) {
      for (let c = this; c; c = c.base) if (c.name === name) return true;
      return false;
    }

    /** Whether any class derives from this one. */
    get hasSubclasses() { return this.subclasses.length > 0; }
  }

  class ProgramModel {
    constructor() {
      this.classes = new Map();
      this.functions = new Map();   // name -> { name, node, origin }
      this.variables = new Map();   // name -> { name, declarator, kind, origin, type }
      this.items = [];              // top-level items in source order: { kind, name, node, origin }
      this.reachable = new Set();   // names of reachable top-level declarations
    }

    addTopLevel(stmt, origin) {
      if (!stmt) return;
      switch (stmt.type) {
        case 'ClassDeclaration': {
          const name = stmt.id && stmt.id.name;
          if (!name) return;
          if (origin === 'main' && this.classes.has(name) && this.classes.get(name).origin === 'framework') this.removeItem(name);
          const info = new ClassInfo(name, stmt, origin);
          this.classes.set(name, info);
          this.items.push({ kind: 'class', name, node: stmt, origin });
          return;
        }
        case 'FunctionDeclaration': {
          const name = stmt.id && stmt.id.name;
          if (!name || (origin === 'framework' && RUNTIME_PROVIDED.has(name))) return;
          this.functions.set(name, { name, node: stmt, origin });
          this.items.push({ kind: 'function', name, node: stmt, origin });
          return;
        }
        case 'VariableDeclaration': {
          for (const d of stmt.declarations || []) {
            const id = d.id;
            if (id && id.type === 'Identifier') {
              if (origin === 'framework' && RUNTIME_PROVIDED.has(id.name)) continue;
              const type = canonicalType(d.declaredType || d.resultType || id.resultType || (d.init && d.init.resultType)) || 'any';
              this.variables.set(id.name, { name: id.name, declarator: d, kind: stmt.kind, origin, type, nullable: !!(d.nullable || id.nullable || d.declaredNullable) });
              this.items.push({ kind: 'variable', name: id.name, node: d, declaration: stmt, origin });
            } else {
              this.items.push({ kind: 'statement', node: { type: 'VariableDeclaration', kind: stmt.kind, declarations: [d] }, origin });
            }
          }
          return;
        }
        default:
          if (origin === 'framework') return;
          this.items.push({ kind: 'statement', node: stmt, origin });
      }
    }

    removeItem(name) {
      this.items = this.items.filter(i => i.name !== name);
    }

    /** Resolve bases, collect members, flatten. */
    link() {
      for (const info of this.classes.values()) {
        info.base = info.baseName ? this.classes.get(info.baseName) || null : null;
        if (info.base) info.base.subclasses.push(info);
      }
      for (const info of this.classes.values()) this.collectMembers(info);
      for (const info of this.classes.values()) this.collectFields(info);
      // Static fields assigned at top level: `ClassName.field = value;`
      for (const item of this.items) {
        if (item.kind !== 'statement' || item.node.type !== 'ExpressionStatement') continue;
        const e = item.node.expression;
        if (e && e.type === 'AssignmentExpression' && e.operator === '=' && e.left.type === 'MemberExpression' && !e.left.computed
          && e.left.object.type === 'Identifier' && this.classes.has(e.left.object.name)) {
          const info = this.classes.get(e.left.object.name);
          const field = e.left.property.name || e.left.property.value;
          if (field && !info.staticFields.has(field) && !info.staticMethods.has(field))
            info.staticFields.set(field, { type: canonicalType(e.left.resultType || e.right.resultType) || 'any', init: null, owner: info });
        }
      }
      for (const info of this.classes.values()) this.flatten(info);
    }

    collectMembers(info) {
      for (const member of (info.node.body && info.node.body.body) || []) {
        if (member.type === 'MethodDefinition') {
          const name = member.key && (member.key.name || member.key.value);
          if (!name) continue;
          const entry = { name, fn: member.value, jsDoc: member.jsDoc || null, owner: info, node: member };
          if (member.kind === 'constructor') { info.ctor = member.value; info.ctorDoc = member.jsDoc || null; }
          else if (member.static) {
            if (member.kind === 'get') info.staticGetters.set(name, entry);
            else info.staticMethods.set(name, entry);
          }
          else if (member.kind === 'get') info.getters.set(name, entry);
          else if (member.kind === 'set') info.setters.set(name, entry);
          else info.methods.set(name, entry);
        } else if (member.type === 'FieldDefinition' || member.type === 'PropertyDefinition' || member.type === 'ClassProperty') {
          const name = member.key && (member.key.name || member.key.value);
          if (!name) continue;
          const type = canonicalType(member.resultType || (member.value && member.value.resultType)) || 'any';
          if (member.static) info.staticFields.set(name, { type, init: member.value, owner: info });
          else {
            info.fields.set(name, { type, nullable: false, owner: info, fromRead: false });
            info.fieldInits.push(member);
          }
        } else if (member.type === 'StaticBlock') {
          info.staticBlocks = (info.staticBlocks || []).concat([member]);
        }
      }
    }

    /** Fields: every `this.x` the class's own code assigns (or only reads) that is no accessor. */
    collectFields(info) {
      const bodies = [];
      if (info.ctor) bodies.push(info.ctor);
      for (const m of info.methods.values()) bodies.push(m.fn);
      for (const m of info.getters.values()) bodies.push(m.fn);
      for (const m of info.setters.values()) bodies.push(m.fn);
      const isAccessor = name => {
        for (let c = info; c; c = c.base) if (c.getters.has(name) || c.setters.has(name) || c.methods.has(name)) return true;
        return false;
      };
      const record = (name, type, nullable, fromRead, mixed) => {
        if (!name || isAccessor(name)) return;
        const t = mixed ? 'any' : (canonicalType(type) || null);
        const existing = info.fields.get(name);
        if (!existing) info.fields.set(name, { type: t || 'any', nullable: !!nullable, owner: info, fromRead, mixed: !!mixed });
        else if (mixed || existing.mixed) {
          existing.type = 'any';
          existing.mixed = true;
          if (!fromRead) existing.fromRead = false;
        } else {
          if ((existing.type === 'any' || existing.type === 'null' || (existing.fromRead && !fromRead)) && t && t !== 'null') existing.type = t;
          if (!fromRead) existing.fromRead = false;
          if (nullable) existing.nullable = true;
        }
      };
      for (const fn of bodies) {
        walk(fn.body, (node) => {
          if (node.type === 'ClassDeclaration') return false;
          if (node.type === 'AssignmentExpression' && node.left && node.left.type === 'ThisPropertyAccess' && !node.left.computed) {
            const t = node.left.resultType && node.left.resultType !== 'null' ? node.left.resultType : (node.declaredType || node.right.resultType);
            // A field declared an object (a framework enum) that is assigned a string or a number holds either: no one type
            const declared = canonicalType(t);
            const assigned = canonicalType(node.right.resultType);
            const primitive = x => x === 'string' || x === 'boolean' || isNumericType(x);
            const objectLike = x => !!x && !primitive(x) && !isArrayType(x) && !isBigType(x) && !['any', 'null', 'void', 'function'].includes(x);
            const mixed = objectLike(declared) && primitive(assigned);
            record(node.left.property, t, node.left.nullable || node.nullable || node.declaredNullable, false, mixed);
          } else if (node.type === 'ThisPropertyAccess' && !node.computed) {
            record(node.property, node.resultType, node.nullable, true);
          }
        });
      }
    }

    /** The flattened member tables of a class: its chain's members, later classes overriding earlier ones. */
    flatten(info) {
      const eff = { methods: new Map(), getters: new Map(), setters: new Map(), fields: new Map(), staticMethods: new Map(), staticFields: new Map() };
      for (const c of info.chain()) {
        for (const [k, v] of c.methods) eff.methods.set(k, v);
        if (c.getters.size || c.setters.size) {
          const names = new Set([...c.getters.keys(), ...c.setters.keys()]);
          for (const k of names) {
            if (c.getters.has(k)) eff.getters.set(k, c.getters.get(k)); else eff.getters.delete(k);
            if (c.setters.has(k)) eff.setters.set(k, c.setters.get(k)); else eff.setters.delete(k);
          }
        }
        for (const [k, v] of c.fields) {
          const prev = eff.fields.get(k);
          // The most derived class that assigns the field decides its type: that is what it holds
          if (!prev || v.mixed || (prev.type === 'any' && v.type !== 'any' && !prev.mixed) || (!v.fromRead && v.type !== 'any' && !prev.mixed)) eff.fields.set(k, v);
        }
        for (const [k, v] of c.staticMethods) eff.staticMethods.set(k, v);
        for (const [k, v] of c.staticFields) eff.staticFields.set(k, v);
      }
      for (const k of [...eff.fields.keys()]) if (eff.getters.has(k) || eff.setters.has(k) || eff.methods.has(k)) eff.fields.delete(k);
      info.effective = eff;
    }

    /** The class an IL type names, or null. */
    classOf(type) {
      if (!type || typeof type !== 'string') return null;
      return this.classes.get(type) || null;
    }

    /**
     * Mark what the program reaches: everything of the main file, and the
     * framework classes, functions and variables it references (transitively).
     */
    computeReachable() {
      const reach = this.reachable;
      const queue = [];
      const mark = name => {
        if (!name || reach.has(name)) return;
        if (this.classes.has(name) || this.functions.has(name) || this.variables.has(name)) {
          reach.add(name);
          queue.push(name);
        }
      };
      const scan = node => walk(node, n => {
        if (n.type === 'Identifier' && n.name) mark(n.name);
        if (n.resultType && typeof n.resultType === 'string') {
          let t = n.resultType;
          while (t.endsWith('[]')) t = t.slice(0, -2);
          if (this.classes.has(t)) mark(t);
        }
        if (n.type === 'ParentConstructorCall' && n.parentClass) mark(n.parentClass);
        if (n.type === 'NewExpression') mark(constructedName(n.callee));
      });
      for (const item of this.items) {
        if (item.origin !== 'main') continue;
        if (item.name) mark(item.name); else scan(item.node);
      }
      // The framework's enums are part of every program's surface
      for (const name of ['CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode']) mark(name);
      while (queue.length) {
        const name = queue.shift();
        const cls = this.classes.get(name);
        if (cls) {
          if (cls.baseName) mark(cls.baseName);
          scan(cls.node);
          for (const sub of cls.subclasses) if (sub.origin === 'main') mark(sub.name);
          continue;
        }
        const fn = this.functions.get(name);
        if (fn) { scan(fn.node); continue; }
        const v = this.variables.get(name);
        if (v) scan(v.declarator);
      }
    }

    isReachable(name) { return this.reachable.has(name); }
  }

  const ILProgramModel = {
    buildModel, ProgramModel, ClassInfo, frameworkIL, insertSemicolons, walk, constructedName,
    canonicalType, jsDocToIL, jsDocNullable, functionReturnType, localUseTypes, functionReturnNullable, functionParams,
    isArrayType, elementType, isIntType, isFloatType, isNumericType, isBigType, intBits, isSignedInt, isTupleType,
    RUNTIME_PROVIDED
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ILProgramModel;
  if (global) global.ILProgramModel = ILProgramModel;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
