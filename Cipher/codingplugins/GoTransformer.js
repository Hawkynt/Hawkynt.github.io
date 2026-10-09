/**
 * GoTransformer.js - IL AST to Go AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> IL AST -> GoTransformer -> Go AST -> GoEmitter -> Go Source
 *
 * Every Go type comes from an IL type (resultType, declared field and
 * parameter types, JSDoc returns); nothing is guessed from a name or a value.
 *
 * The object model (see ILProgramModel.js):
 * - every class becomes a struct holding the fields of its whole base chain,
 *   AlgorithmFramework.js's included, with every inherited method emitted on
 *   it, so `this.EncryptBlock(...)` inside the framework's Result() reaches the
 *   class's own override;
 * - a class nothing derives from is a concrete pointer (*TEAInstance); a type
 *   with subclasses (Algorithm, IBlockCipherInstance, a local base class) and
 *   any untyped object are the JsObject interface, which every class
 *   implements by name (JsGet/JsSet/JsCall), as JavaScript resolves members;
 * - object literals are *JsMap, errors *JsError, BigInt *big.Int.
 *
 * Numbers follow JavaScript: an IL type of fixed width is that Go type, and an
 * operation computes in the type the IL gives its result (bitwise operators
 * on 32 bits as ToInt32/ToUint32 do, BigInt operators at full width).
 * Strings are Latin-1 byte strings: one byte per character code below 256.
 *
 * The runtime the generated code relies on (GO_RUNTIME below) holds the
 * JavaScript semantics that are not one Go operator: the object protocol,
 * array and string helpers, BigInt, exceptions and the algorithm registry.
 */

(function (global) {
  'use strict';

  let GoAST, Model;
  if (typeof require !== 'undefined') {
    GoAST = require('./GoAST.js');
    Model = require('./ILProgramModel.js');
  } else {
    GoAST = global.GoAST;
    Model = global.ILProgramModel;
  }

  const G = GoAST;

  /** A Go string literal holding a JavaScript string as Latin-1 bytes. */
  function goStringLiteral(s) {
    let out = '"';
    for (const ch of String(s)) {
      const code = ch.codePointAt(0);
      if (code === 0x22) out += '\\"';
      else if (code === 0x5c) out += '\\\\';
      else if (code === 0x0a) out += '\\n';
      else if (code === 0x0d) out += '\\r';
      else if (code === 0x09) out += '\\t';
      else if (code >= 0x20 && code < 0x7f) out += ch;
      else if (code < 0x10000) out += '\\x' + (code & 0xff).toString(16).padStart(2, '0');
      else out += '\\x3f';
    }
    return out + '"';
  }

  /** The Go spelling of a JavaScript constant (an untyped Go constant where it is a number). */
  function constLiteral(c) {
    if (c === null || c === undefined) return 'nil';
    if (typeof c === 'string') return goStringLiteral(c);
    if (typeof c === 'boolean') return String(c);
    if (typeof c === 'bigint') return c >= -(2n ** 63n) && c < 2n ** 63n ? `jsBigI(${c})` : `jsBigLit("${c}")`;
    if (Number.isNaN(c)) return 'math.NaN()';
    if (c === Infinity) return 'math.Inf(1)';
    if (c === -Infinity) return 'math.Inf(-1)';
    return String(c);
  }

  /** The name of a property key: the IL keeps it as a string, ESTree as an Identifier or Literal. */
  const propKey = k => typeof k === 'string' ? k : (k && (k.name !== undefined ? k.name : String(k.value)));
  const { canonicalType, isArrayType, elementType, isIntType, isFloatType, isNumericType, isBigType, intBits, isSignedInt } = Model;

  const GO_KEYWORDS = new Set(['break', 'case', 'chan', 'const', 'continue', 'default', 'defer', 'else', 'fallthrough', 'for',
    'func', 'go', 'goto', 'if', 'import', 'interface', 'map', 'package', 'range', 'return', 'select', 'struct', 'switch', 'type', 'var']);
  const GO_PREDECLARED = new Set(['append', 'cap', 'clear', 'close', 'complex', 'copy', 'delete', 'imag', 'len', 'make', 'max', 'min',
    'new', 'panic', 'print', 'println', 'real', 'recover', 'bool', 'byte', 'comparable', 'complex64', 'complex128', 'error', 'float32',
    'float64', 'int', 'int8', 'int16', 'int32', 'int64', 'rune', 'string', 'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uintptr',
    'any', 'true', 'false', 'iota', 'nil', 'this', 'init', 'main',
    // the packages the generated code imports
    'math', 'big', 'fmt', 'strings', 'strconv', 'sort', 'reflect', 'regexp', 'os', 'bits', 'json', 'errors']);

  const IMPORTS = ['fmt', 'math', 'math/big', 'math/bits', 'os', 'reflect', 'regexp', 'sort', 'strconv', 'strings'];

  /** Bit width / signedness to the runtime's conversion helper suffix. */
  const NUM_SUFFIX = { uint8: 'U8', uint16: 'U16', uint32: 'U32', uint64: 'U64', int8: 'I8', int16: 'I16', int32: 'I32', int64: 'I64', float64: 'F64' };

  /** A Go expression with its IL type (and its value when it is a compile-time constant). */
  class Val {
    constructor(e, t, c) {
      this.t = t;
      if (c !== undefined) this.c = c;
      this.e = e || (c !== undefined ? G.Lit(constLiteral(c)) : G.Lit('nil'));
    }
    get isConst() { return this.c !== undefined; }
  }

  class GoTransformer {
    constructor(options = {}) {
      this.options = options;
      this.packageName = options.packageName || 'main';
      this.warnings = [];
    }

    // ======================================================================
    // ENTRY
    // ======================================================================

    /**
     * Transform an IL Program into a Go File.
     * @param {Object} ast - IL AST (Program)
     * @returns {Object} GoAST File
     */
    transform(ast) {
      this.model = Model.buildModel(ast, { framework: this.options.framework !== false });
      this.prefix = this.options.symbolPrefix || '';
      this.library = !!this.options.library;
      this.decls = [];
      this.initStmts = [];
      this.tmpCounter = 0;
      this.superCopies = new Map();
      this.classNames = new Map();
      this.emittedClasses = new Set();
      this.computeEmittedClasses();
      for (const info of this.model.classes.values()) if (this.emittedClasses.has(info.name)) this.classNames.set(info.name, this.prefix + this.ident(info.name));

      const body = [];
      for (const item of this.model.items) {
        if (item.name && !this.model.isReachable(item.name)) continue;
        if (item.origin === 'framework' && this.library && item.kind === 'variable') continue;
        try {
          switch (item.kind) {
            case 'class': if (this.emittedClasses.has(item.name)) this.emitClass(this.model.classes.get(item.name)); break;
            case 'function': this.emitTopFunction(item); break;
            case 'variable': this.emitTopVariable(item); break;
            case 'statement': this.emitTopStatement(item.node); break;
          }
        } catch (e) {
          if (!this.options.lenient) throw new Error(`${item.kind} ${item.name || ''}: ${e.message}`);
          this.warnings.push(`${item.kind} ${item.name || ''}: ${e.message}`);
          this.decls.push(G.Comment(`${item.kind} ${item.name || ''} could not be transpiled: ${e.message}`));
        }
      }
      if (this.initStmts.length) this.decls.push(G.Func('init', null, [], [], G.Block(this.initStmts)));
      const decls = [];
      if (!this.library) decls.push(G.Raw(GO_RUNTIME));
      decls.push(...this.decls);
      return G.File(this.packageName, this.library ? [] : IMPORTS, decls);
    }

    /** Classes that become structs: every class of the main file, and framework classes something instantiates. */
    computeEmittedClasses() {
      const instantiated = new Set();
      Model.walk(this.model.items.filter(i => i.origin === 'main').map(i => i.node), n => {
        if (n.type === 'NewExpression' && Model.constructedName(n.callee)) instantiated.add(Model.constructedName(n.callee));
      });
      // Framework classes instantiate each other (TestCase, KeySize, ...)
      let changed = true;
      while (changed) {
        changed = false;
        for (const info of this.model.classes.values()) {
          if (info.origin !== 'framework' || !instantiated.has(info.name) || info._scanned) continue;
          info._scanned = true;
          Model.walk(info.node, n => {
            const c = n.type === 'NewExpression' && Model.constructedName(n.callee);
            if (c && !instantiated.has(c)) { instantiated.add(c); changed = true; }
          });
        }
      }
      for (const info of this.model.classes.values()) {
        if (!this.model.isReachable(info.name)) continue;
        if (info.origin === 'main' || instantiated.has(info.name)) this.emittedClasses.add(info.name);
      }
    }

    // ======================================================================
    // NAMES
    // ======================================================================

    ident(name) {
      let n = String(name).replace(/\$/g, '_S_').replace(/[^A-Za-z0-9_]/g, '_');
      if (/^[0-9]/.test(n)) n = '_' + n;
      if (GO_KEYWORDS.has(n) || GO_PREDECLARED.has(n) || /^(js|Js|JS)/.test(n) || n === '_') n += '_';
      return n;
    }

    className(name) { return this.classNames.get(name) || (this.prefix + this.ident(name)); }
    fieldName(info, name) {
      const eff = info.effective;
      const base = this.ident(name);
      return eff && (eff.methods.has(name) || eff.getters.has(name) || eff.setters.has(name)) ? base + '_f' : base;
    }
    methodName(name) { return this.ident(name); }
    getterName(name) { return 'get_' + String(name).replace(/[^A-Za-z0-9_]/g, '_'); }
    setterName(name) { return 'set_' + String(name).replace(/[^A-Za-z0-9_]/g, '_'); }
    topName(name) {
      // The framework's variables (its enums) live once, in the main program
      const v = this.model.variables.get(name);
      if (v && v.origin === 'framework') return this.ident(name);
      return this.prefix + this.ident(name);
    }

    /** A generic runtime function instantiated for a Go type: jsFill[uint8]. */
    generic(name, goType) { return G.Index(G.Ident(name), G.Ident(goType)); }
    staticName(cls, name) { return `${this.className(cls)}_${String(name).replace(/[^A-Za-z0-9_]/g, '_')}`; }
    tmp(base = 't') { return `jsT${base}${++this.tmpCounter}`; }

    // ======================================================================
    // TYPES
    // ======================================================================

    /** Whether an IL class type is a concrete Go pointer (emitted, nothing derives from it). */
    isLeafClass(t) {
      const info = this.model.classOf(t);
      return !!info && this.emittedClasses.has(t) && !info.hasSubclasses;
    }

    /** The Go spelling of an IL type. */
    goType(t) {
      t = canonicalType(t) || 'any';
      if (t === 'goint') return 'int';
      if (isIntType(t)) return t;
      if (isFloatType(t)) return 'float64';
      if (isBigType(t)) return '*big.Int';
      switch (t) {
        case 'boolean': return 'bool';
        case 'string': return 'string';
        case 'void': return '';
        case 'any': case 'null': case 'function': case 'undefined': return 'any';
        case 'Error': case 'TypeError': case 'RangeError': return '*JsError';
        case 'regex': case 'RegExp': return '*regexp.Regexp';
        case 'Map': return '*JsMap';
        case 'Set': return '*JsMap';
        case 'object': return 'JsObject';
      }
      if (/^Map</.test(t)) return '*JsMap';
      if (isArrayType(t)) {
        const el = elementType(t);
        return '[]' + this.goType(el === 'object' || el === 'any' ? 'any' : el);
      }
      if (t.startsWith('[') && t.endsWith(']')) return '[]any';
      if (t.startsWith('(') || t.includes('=>')) return 'any';
      if (this.isLeafClass(t)) return '*' + this.className(t);
      return 'JsObject';
    }

    /** The Go type of a value that may be null: value types become any. */
    goTypeNullable(t, nullable) {
      if (nullable && (isNumericType(canonicalType(t)) || canonicalType(t) === 'boolean')) return 'any';
      return this.goType(t);
    }

    typeOfNullable(t, nullable) {
      return nullable && (isNumericType(canonicalType(t)) || canonicalType(t) === 'boolean') ? 'any' : (canonicalType(t) || 'any');
    }

    /** The zero value of an IL type. */
    zero(t) {
      const g = this.goType(t);
      if (/^(u?int\d*|float64|int)$/.test(g)) return G.Lit('0');
      if (g === 'bool') return G.Lit('false');
      if (g === 'string') return G.Lit('""');
      return G.Lit('nil');
    }

    /** Whether two IL types have the same Go type. */
    sameGo(a, b) { return this.goType(a) === this.goType(b); }

    // ======================================================================
    // CONVERSION
    // ======================================================================

    /** A Go expression of IL type `to` for a value. */
    coerce(v, to) {
      to = canonicalType(to) || 'any';
      if (!(v instanceof Val)) throw new Error('coerce of a non-value');
      const from = canonicalType(v.t) || 'any';
      const gf = this.goType(from);
      const gt = this.goType(to);
      if (to === 'void') return v.e;
      if (v.isConst) return this.constTo(v, to);
      if (gf === gt) return v.e;
      if (from === 'null' || (v.e.kind === 'Lit' && v.e.text === 'nil')) return this.zero(to);
      if (gt === 'any') return v.e;
      if (gt === 'JsObject') {
        if (gf.startsWith('*') && gf !== '*big.Int') return v.e;
        return G.Call(G.Ident('jsToObject'), [v.e]);
      }
      // numbers
      const numFrom = this.numKind(gf);
      const numTo = this.numKind(gt);
      if (numFrom && numTo) {
        if (numFrom === 'float' && numTo === 'int') return G.Conv(gt, G.Call(G.Ident('jsF2I'), [v.e]));
        return G.Conv(gt, v.e);
      }
      if (gt === 'bool') return this.truthy(v);
      if (gf === 'bool' && numTo) return G.Conv(gt, G.Call(G.Ident('jsB2I'), [v.e]));
      if (gf === '*big.Int' && numTo) return numTo === 'float' ? G.Call(G.Ident('jsBigToF64'), [v.e]) : G.Conv(gt, G.Call(G.Ident(gt.startsWith('u') ? 'jsBigToU64' : 'jsBigToI64'), [v.e]));
      if (gt === '*big.Int' && numFrom) return G.Call(G.Ident(numFrom === 'float' ? 'jsBigFromF64' : (gf.startsWith('u') ? 'jsBigFromU64' : 'jsBigFromI64')), [numFrom === 'float' ? v.e : G.Conv(gf.startsWith('u') ? 'uint64' : 'int64', v.e)]);
      if (gt === 'string') return G.Call(G.Ident('jsStr'), [v.e]);
      if (numTo && gf === 'string') return G.Conv(gt, G.Call(G.Ident(numTo === 'float' ? 'jsToNumber' : 'jsToNumberInt'), [v.e]));
      // everything else (slices of other elements, interfaces, class pointers) by the runtime's conversion
      return G.Call(G.Index(G.Ident('jsTo'), G.Ident(gt)), [v.e]);
    }

    numKind(g) {
      if (/^u?int(8|16|32|64)?$/.test(g)) return 'int';
      if (g === 'float64') return 'float';
      return null;
    }

    /** A constant in the Go spelling of IL type `to` (wrapped to the width as JavaScript's ToIntN does). */
    constTo(v, to) {
      const c = v.c;
      const gt = this.goType(to);
      if (c === null || c === undefined) return this.zero(to);
      if (typeof c === 'string') {
        if (gt === 'string' || gt === 'any') return G.Lit(this.goString(c));
        if (this.numKind(gt)) return this.constTo(new Val(null, 'float64', Number(c)), to);
        return this.coerce(new Val(G.Lit(this.goString(c)), 'string'), to);
      }
      if (typeof c === 'boolean') {
        if (gt === 'bool' || gt === 'any') return G.Lit(String(c));
        if (this.numKind(gt)) return G.Lit(c ? '1' : '0');
        if (gt === 'string') return G.Lit(this.goString(String(c)));
        return this.coerce(new Val(G.Lit(String(c)), 'boolean'), to);
      }
      if (typeof c === 'bigint') {
        if (gt === '*big.Int') return this.bigLit(c);
        if (/^u?int/.test(gt)) return G.Lit(String(this.wrapBig(c, to)));
        if (gt === 'float64') return G.Lit(this.goFloat(Number(c)));
        if (gt === 'any') return this.bigLit(c);
        if (gt === 'string') return G.Lit(this.goString(c.toString()));
        return this.coerce(new Val(this.bigLit(c), 'bigint'), to);
      }
      if (typeof c === 'number') {
        const tcan = canonicalType(to);
        if (gt === '*big.Int') return this.bigLit(BigInt(Math.trunc(c)));
        if (/^u?int\d*$/.test(gt)) {
          if (!Number.isFinite(c)) return G.Lit('0');
          const w = this.wrapBig(BigInt(Math.trunc(c)), gt === 'int' ? 'int64' : tcan);
          return G.Lit(String(w));
        }
        if (gt === 'float64') return G.Lit(this.goFloat(c));
        if (gt === 'bool') return G.Lit(c !== 0 && !Number.isNaN(c) ? 'true' : 'false');
        if (gt === 'string') return G.Lit(this.goString(this.jsNumberString(c)));
        if (gt === 'any') {
          const ft = canonicalType(v.t);
          const g = isNumericType(ft) ? this.goType(ft) : 'float64';
          return G.Conv(g, this.constTo(v, isNumericType(ft) ? ft : 'float64'));
        }
        return this.coerce(new Val(this.constTo(v, 'float64'), 'float64'), to);
      }
      return this.zero(to);
    }

    wrapBig(b, t) {
      const bits = intBits(t) || 64;
      return isSignedInt(t) || t === 'goint' ? BigInt.asIntN(bits, b) : BigInt.asUintN(bits, b);
    }

    bigLit(b) {
      if (b >= -(2n ** 63n) && b < 2n ** 63n) return G.Call(G.Ident('jsBigI'), [G.Lit(String(b))]);
      return G.Call(G.Ident('jsBigLit'), [G.Lit(`"${b.toString()}"`)]);
    }

    goFloat(n) {
      if (Number.isNaN(n)) return 'math.NaN()';
      if (n === Infinity) return 'math.Inf(1)';
      if (n === -Infinity) return 'math.Inf(-1)';
      if (Object.is(n, -0)) return 'math.Copysign(0, -1)';
      const s = String(n);
      return /[.e]/.test(s) ? s : s + '.0';
    }

    /** A Go string literal holding a JavaScript string as Latin-1 bytes. */
    goString(s) { return goStringLiteral(s); }

    jsNumberString(n) { return String(n); }

    /** A boolean Go expression for JavaScript truthiness of a value. */
    truthy(v) {
      const t = canonicalType(v.t) || 'any';
      if (v.isConst) return G.Lit(v.c ? 'true' : 'false');
      const g = this.goType(t);
      if (g === 'bool') return v.e;
      if (this.numKind(g) === 'int') return G.Binary('!=', v.e, G.Lit('0'));
      if (g === 'float64') return G.Call(G.Ident('jsTruthyF64'), [v.e]);
      if (g === 'string') return G.Binary('!=', v.e, G.Lit('""'));
      if (g.startsWith('[]') || g.startsWith('*')) return G.Binary('!=', v.e, G.Lit('nil'));
      return G.Call(G.Ident('jsTruthy'), [v.e]);
    }

    // ======================================================================
    // CLASSES
    // ======================================================================

    emitClass(info) {
      const name = this.className(info.name);
      const eff = info.effective;
      const fields = [];
      for (const [fname, f] of eff.fields) fields.push({ name: this.fieldName(info, fname), type: this.goTypeNullable(f.type, f.nullable) });
      fields.push({ name: 'jsExtra', type: 'map[string]any' });
      const chainNames = info.chain().map(c => c.name).join(' < ');
      this.decls.push(G.Struct(name, fields, `${name} is the JavaScript class ${info.name}` + (info.base ? ` (${chainNames})` : '')));

      // Static members
      for (const [sname, s] of eff.staticFields) {
        if (s.owner !== info) continue;
        const t = s.type || (s.init && s.init.resultType) || 'any';
        this.decls.push(G.VarDecl(this.staticName(info.name, sname), this.goType(t), null));
        if (s.init) {
          this.withFunction({ returnType: 'void', cls: null }, () => {
            const v = this.expr(s.init);
            this.initStmts.push(...this.flushPre(), G.Assign(G.Ident(this.staticName(info.name, sname)), '=', this.coerce(v, t)));
          });
        }
      }
      for (const [mname, m] of eff.staticMethods) {
        if (m.owner !== info) continue;
        this.decls.push(this.emitFunctionDecl(this.staticName(info.name, mname), null, m.fn, m.jsDoc, null));
      }
      for (const block of info.staticBlocks || []) {
        this.withFunction({ returnType: 'void', cls: null }, () => {
          this.initStmts.push(G.Block(this.stmts(block.body || [])));
        });
      }

      // Constructor chain: New<Class> and one init per class of the chain
      const chain = info.chain();
      const ctorOwner = [...chain].reverse().find(c => c.ctor) || null;
      const ctorParams = ctorOwner ? Model.functionParams(ctorOwner.ctor, ctorOwner.ctorDoc) : [];
      const receiver = { name: 'this', type: '*' + name };
      const newParams = ctorParams.map(p => ({ name: this.ident(p.name), type: this.goTypeNullable(p.type, p.nullable) }));
      this.decls.push(G.Func('New' + name, null, newParams, [{ type: '*' + name }], G.Block([
        G.Assign(G.Ident('this'), ':=', G.Unary('&', G.Composite(name, []))),
        G.ExprStmt(G.Call(G.Selector(G.Ident('this'), this.initName(info)), newParams.map(p => G.Ident(p.name)))),
        G.Return(G.Ident('this'))
      ]), `New${name} constructs a ${info.name}`));
      for (const c of chain) this.decls.push(this.emitInit(info, c));

      // Methods, accessors
      for (const [mname, m] of eff.methods) this.decls.push(this.emitFunctionDecl(this.methodName(mname), receiver, m.fn, m.jsDoc, info));
      for (const [gname, g] of eff.getters) this.decls.push(this.emitFunctionDecl(this.getterName(gname), receiver, g.fn, g.jsDoc, info));
      for (const [sname, s] of eff.setters) this.decls.push(this.emitFunctionDecl(this.setterName(sname), receiver, s.fn, s.jsDoc, info));
      for (const [key, copy] of this.superCopiesFor(info)) this.decls.push(this.emitFunctionDecl(key, receiver, copy.fn, copy.jsDoc, info));

      this.decls.push(...this.emitProtocol(info, name));
    }

    initName(c) { return `jsInit_${String(c.name).replace(/[^A-Za-z0-9_]/g, '_')}`; }

    /** The init method of one class of the chain: field initializers, then its constructor body (or the implicit one). */
    emitInit(info, c) {
      const receiver = { name: 'this', type: '*' + this.className(info.name) };
      if (c.ctor) return this.emitFunctionDecl(this.initName(c), receiver, c.ctor, c.ctorDoc, info, { init: c });
      // Implicit constructor: pass the arguments on to the base
      const owner = c.base ? [...c.base.chain()].reverse().find(x => x.ctor) : null;
      const params = owner ? Model.functionParams(owner.ctor, owner.ctorDoc) : [];
      const goParams = params.map(p => ({ name: this.ident(p.name), type: this.goTypeNullable(p.type, p.nullable) }));
      const stmts = [];
      if (c.base) stmts.push(G.ExprStmt(G.Call(G.Selector(G.Ident('this'), this.initName(c.base)), goParams.map(p => G.Ident(p.name)))));
      stmts.push(...this.fieldInitializers(info, c));
      return G.Func(this.initName(c), receiver, goParams, [], G.Block(stmts));
    }

    fieldInitializers(info, c) {
      const out = [];
      for (const fd of c.fieldInits || []) {
        if (!fd.value) continue;
        const fname = fd.key.name || fd.key.value;
        const f = info.effective.fields.get(fname);
        if (!f) continue;
        this.withFunction({ returnType: 'void', cls: info, self: true }, () => {
          const v = this.expr(fd.value);
          out.push(...this.flushPre(), G.Assign(G.Selector(G.Ident('this'), this.fieldName(info, fname)), '=', this.coerce(v, this.typeOfNullable(f.type, f.nullable))));
        });
      }
      return out;
    }

    superCopiesFor(info) {
      return [...this.superCopies.entries()].filter(([, v]) => v.cls === info).map(([k, v]) => [k, v]);
    }

    /** JsGet/JsSet/JsCall/JsHas/JsHasMethod: the members of a class by their JavaScript names. */
    emitProtocol(info, name) {
      const eff = info.effective;
      const recv = `func (this *${name})`;
      const lines = [];
      const q = s => this.goString(s);
      // JsGet
      lines.push(`${recv} JsGet(name string) any {`, '\tswitch name {');
      for (const [fname, f] of eff.fields) lines.push(`\tcase ${q(fname)}:`, `\t\treturn this.${this.fieldName(info, fname)}`);
      for (const [gname] of eff.getters) lines.push(`\tcase ${q(gname)}:`, `\t\treturn this.${this.getterName(gname)}()`);
      for (const [mname] of eff.methods) if (!eff.getters.has(mname)) lines.push(`\tcase ${q(mname)}:`, `\t\treturn jsBind(this, ${q(mname)})`);
      lines.push('\t}', '\tif this.jsExtra != nil {', '\t\treturn this.jsExtra[name]', '\t}', '\treturn nil', '}', '');
      // JsSet
      lines.push(`${recv} JsSet(name string, value any) {`, '\tswitch name {');
      for (const [fname, f] of eff.fields) lines.push(`\tcase ${q(fname)}:`, `\t\tthis.${this.fieldName(info, fname)} = jsTo[${this.goTypeNullable(f.type, f.nullable)}](value)`, '\t\treturn');
      const accessorNames = new Set([...eff.getters.keys(), ...eff.setters.keys()]);
      for (const aname of accessorNames) {
        const s = eff.setters.get(aname);
        if (s) {
          const p = Model.functionParams(s.fn, s.jsDoc)[0] || { type: 'any', nullable: false };
          lines.push(`\tcase ${q(aname)}:`, `\t\tthis.${this.setterName(aname)}(jsTo[${this.goTypeNullable(p.type, p.nullable)}](value))`, '\t\treturn');
        } else {
          lines.push(`\tcase ${q(aname)}:`, `\t\tpanic(jsNewError("TypeError", "Cannot set property ${aname.replace(/[^\w$]/g, '_')} which has only a getter"))`);
        }
      }
      lines.push('\t}', '\tif this.jsExtra == nil {', '\t\tthis.jsExtra = map[string]any{}', '\t}', '\tthis.jsExtra[name] = value', '}', '');
      // JsCall
      lines.push(`${recv} JsCall(name string, args ...any) any {`, '\tswitch name {');
      for (const [mname, m] of eff.methods) {
        const params = Model.functionParams(m.fn, m.jsDoc);
        const ret = this.signatureReturn(m.fn, m.jsDoc);
        const args = params.map((p, i) => {
          const gt = this.goTypeNullable(p.type, p.nullable);
          if (p.defaultValue) {
            let dflt = 'nil';
            this.withFunction({ returnType: 'void', cls: info, self: true }, () => {
              const v = this.expr(p.defaultValue);
              if (!this.fn.pre.length) dflt = this.emitExprText(this.coerce(v, this.typeOfNullable(p.type, p.nullable)));
              this.fn.pre = [];
            });
            return `jsTo[${gt}](jsArgOr(args, ${i}, ${dflt}))`;
          }
          return `jsTo[${gt}](jsArg(args, ${i}))`;
        });
        const call = `this.${this.methodName(mname)}(${args.join(', ')})`;
        lines.push(`\tcase ${q(mname)}:`);
        if (ret.type === 'void') lines.push(`\t\t${call}`, '\t\treturn nil');
        else lines.push(`\t\treturn ${call}`);
      }
      lines.push('\t}', '\tif f, ok := this.jsExtra[name]; ok {', '\t\treturn jsCallFunc(f, args...)', '\t}',
        `\tpanic(jsNewError("TypeError", ${q(info.name + '.')} + name + " is not a function"))`, '}', '');
      // JsHas / JsHasMethod
      const all = [...new Set([...eff.fields.keys(), ...accessorNames, ...eff.methods.keys()])];
      lines.push(`${recv} JsHas(name string) bool {`, '\tswitch name {');
      if (all.length) lines.push(`\tcase ${all.map(q).join(', ')}:`, '\t\treturn true');
      lines.push('\t}', '\t_, ok := this.jsExtra[name]', '\treturn ok', '}', '');
      lines.push(`${recv} JsHasMethod(name string) bool {`, '\tswitch name {');
      if (eff.methods.size) lines.push(`\tcase ${[...eff.methods.keys()].map(q).join(', ')}:`, '\t\treturn true');
      lines.push('\t}', '\treturn jsIsFunc(this.jsExtra[name])', '}');
      return [G.Raw(lines.join('\n'))];
    }

    emitExprText(e) {
      if (!this._emitter) {
        const GoEmitter = (typeof require !== 'undefined') ? require('./GoEmitter.js').GoEmitter : global.GoEmitter;
        this._emitter = new GoEmitter({});
      }
      return this._emitter.expr(e);
    }

    // ======================================================================
    // FUNCTIONS
    // ======================================================================

    signatureReturn(fn, jsDoc) {
      const type = Model.functionReturnType(fn, jsDoc);
      const nullable = Model.functionReturnNullable(fn, jsDoc);
      return { type: type === 'void' ? 'void' : this.typeOfNullable(type, nullable) };
    }

    /** Run body() with a fresh function context. */
    withFunction(ctx, body) {
      const saved = this.fn;
      this.fn = Object.assign({ scopes: [new Map()], pre: [], labels: [], tryDepth: 0 }, ctx);
      try { return body(); } finally { this.fn = saved; }
    }

    /**
     * A Go function (or method) for a JavaScript function.
     * @param {string} name - Go name
     * @param {Object|null} receiver - { name, type } for a method
     * @param {Object} fn - IL FunctionExpression
     * @param {Object} jsDoc - its JSDoc
     * @param {Object|null} cls - the class whose `this` it sees
     * @param {Object} [extra] - { init: ClassInfo } for a constructor body
     */
    emitFunctionDecl(name, receiver, fn, jsDoc, cls, extra = {}) {
      const params = Model.functionParams(fn, jsDoc);
      const ret = extra.init ? { type: 'void' } : this.signatureReturn(fn, jsDoc);
      return this.withFunction({ returnType: ret.type, cls, self: !!receiver, initOf: extra.init || null }, () => {
        const goParams = params.map(p => ({ name: this.declareLocal(p.name, this.typeOfNullable(p.type, p.nullable), true).go, type: this.goTypeNullable(p.type, p.nullable) }));
        let stmts = [];
        if (extra.init) {
          // Field initializers run right after super() (or first, without a base)
          const hasSuper = this.containsParentCall(fn.body);
          if (!hasSuper) {
            if (extra.init.base) stmts.push(G.ExprStmt(G.Call(G.Selector(G.Ident('this'), this.initName(extra.init.base)), [])));
            stmts.push(...this.fieldInitializers(cls, extra.init));
          }
        }
        stmts.push(...this.functionBody(fn));
        return G.Func(name, receiver, goParams, ret.type === 'void' ? [] : [{ type: this.goType(ret.type) }], G.Block(stmts));
      });
    }

    containsParentCall(body) {
      let found = false;
      Model.walk(body, n => {
        if (n.type === 'FunctionExpression' || n.type === 'ArrowFunction' || n.type === 'ArrowFunctionExpression') return false;
        if (n.type === 'ParentConstructorCall') found = true;
      });
      return found;
    }

    /** The statements of a function body, ending in a return when it has a result. */
    functionBody(fn) {
      let stmts;
      if (fn.body && fn.body.type === 'BlockStatement') {
        this.hoistVars(fn.body);
        stmts = this.stmts(fn.body.body);
      } else if (fn.body) {
        const v = this.expr(fn.body);
        stmts = this.flushPre();
        if (this.fn.returnType === 'void') stmts.push(this.exprStmt(v));
        else stmts.push(G.Return(this.coerce(v, this.fn.returnType)));
      } else {
        stmts = [];
      }
      if (this.fn.returnType !== 'void' && !this.terminates(stmts)) stmts.push(G.Return(this.zero(this.fn.returnType)));
      return stmts;
    }

    /** Whether Go sees a statement list as terminating (so no return needs adding). */
    terminates(stmts) {
      const last = stmts[stmts.length - 1];
      if (!last) return false;
      if (last.kind === 'Return') return true;
      if (last.kind === 'ExprStmt' && last.expr.kind === 'Call' && last.expr.fn.kind === 'Ident' && last.expr.fn.name === 'panic') return true;
      if (last.kind === 'Block') return this.terminates(last.stmts);
      if (last.kind === 'If') return !!last.otherwise && this.terminates(last.then.stmts)
        && (last.otherwise.kind === 'If' ? this.terminates([last.otherwise]) : this.terminates(last.otherwise.stmts || [last.otherwise]));
      if (last.kind === 'For' && !last.cond && !this.hasBreak(last.body)) return true;
      return false;
    }

    hasBreak(block) {
      let found = false;
      const visit = s => {
        if (!s || found) return;
        if (s.kind === 'Break') { found = true; return; }
        if (s.kind === 'For' || s.kind === 'ForRange' || s.kind === 'Switch') return; // their own breaks
        for (const k of ['stmts', 'then', 'otherwise', 'body', 'stmt']) {
          const v = s[k];
          if (Array.isArray(v)) v.forEach(visit); else if (v && typeof v === 'object') visit(v);
        }
      };
      visit(block);
      return found;
    }

    /** JavaScript `var` declarations are function scoped: they are declared at the top. */
    hoistVars(body) {
      const hoisted = [];
      Model.walk(body, (n) => {
        if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration' || n.type === 'ArrowFunction' || n.type === 'ArrowFunctionExpression' || n.type === 'ClassDeclaration') return false;
        if (n.type === 'VariableDeclaration' && n.kind === 'var') {
          for (const d of n.declarations) if (d.id && d.id.type === 'Identifier') hoisted.push(d);
          n._hoisted = true;
        }
      });
      if (!hoisted.length) return;
      this.fn.hoisted = this.fn.hoisted || [];
      const seen = new Set();
      for (const d of hoisted) {
        if (seen.has(d.id.name)) continue;
        seen.add(d.id.name);
        const t = this.typeOfNullable(this.declaratorType(d) || 'any', d.nullable || d.id.nullable);
        const b = this.declareLocal(d.id.name, t);
        this.fn.hoisted.push(G.VarDecl(b.go, this.goType(t), null), G.Assign(G.Ident('_'), '=', G.Ident(b.go)));
      }
    }

    /** The IL type of a variable declarator (a || b of two numbers is that number type). */
    declaratorType(d) {
      if (d.declaredType) return canonicalType(d.declaredType);
      let t = canonicalType(d.resultType || d.id.resultType || (d.init && d.init.resultType));
      const init = d.init;
      if (t === 'boolean' && init && init.type === 'LogicalExpression' && init.operator !== '??') {
        const a = canonicalType(init.left.resultType);
        const b = canonicalType(init.right.resultType);
        if (a && a === b && a !== 'boolean' && a !== 'any') t = a;
      }
      return t;
    }

    // ======================================================================
    // SCOPES
    // ======================================================================

    declareLocal(name, type, isParam = false) {
      const scope = this.fn.scopes[this.fn.scopes.length - 1];
      let go = this.ident(name);
      const binding = { name, go, type: canonicalType(type) || 'any', used: isParam };
      scope.set(name, binding);
      return binding;
    }

    lookup(name) {
      for (let i = this.fn.scopes.length - 1; i >= 0; --i) {
        const b = this.fn.scopes[i].get(name);
        if (b) return b;
      }
      if (this.fn.outer) return this.fn.outer(name);
      return null;
    }

    pushScope() { this.fn.scopes.push(new Map()); }
    popScope() { return this.fn.scopes.pop(); }

    // ======================================================================
    // TOP LEVEL
    // ======================================================================

    emitTopFunction(item) {
      const node = item.node;
      this.decls.push(this.emitFunctionDecl(this.topName(item.name), null, node, node.jsDoc, null));
    }

    emitTopVariable(item) {
      const d = item.node;
      const v = this.model.variables.get(item.name);
      const t = this.typeOfNullable(v.type, v.nullable);
      const goName = this.topName(item.name);
      // A framework variable (its enums) is set before any init() runs, so a
      // bundled dependency's module code finds it set
      if (item.origin === 'framework' && d.init) {
        this.withFunction({ returnType: 'void', cls: null }, () => {
          const val = this.expr(d.init);
          if (this.fn.pre.length) throw new Error('a framework variable initializer with statements');
          this.decls.push(G.VarDecl(goName, this.goType(t), this.coerce(val, t)));
        });
        return;
      }
      this.decls.push(G.VarDecl(goName, this.goType(t), null));
      if (d.init) {
        this.withFunction({ returnType: 'void', cls: null }, () => {
          const val = this.expr(d.init);
          this.initStmts.push(...this.flushPre(), G.Assign(G.Ident(goName), '=', this.coerce(val, t)));
        });
      }
    }

    emitTopStatement(node) {
      this.withFunction({ returnType: 'void', cls: null }, () => {
        const out = this.stmt(node);
        if (out.length) this.initStmts.push(out.length === 1 && out[0].kind !== 'VarDecl' ? out[0] : G.Block(out));
      });
    }

    // ======================================================================
    // STATEMENTS
    // ======================================================================

    /** Pending statements an expression needs before it (hoisted temporaries). */
    flushPre() {
      const pre = this.fn.pre;
      this.fn.pre = [];
      return pre;
    }

    stmts(list) {
      const out = [];
      const pending = [];
      this.pushScope();
      if (this.fn.hoisted && this.fn.hoisted.length) { out.push(...this.fn.hoisted); this.fn.hoisted = null; }
      for (const s of list || []) {
        const before = out.length;
        out.push(...this.stmt(s));
        if (s && s.type === 'VariableDeclaration' && !s._hoisted) pending.push({ at: out.length, decls: s.declarations });
        void before;
      }
      const scope = this.popScope();
      // Locals nothing reads still have to be "used" for Go
      const inserts = [];
      for (const b of scope.values()) {
        if (b.used || b.isParam) continue;
        const entry = pending.find(p => p.decls.some(d => d.id && d.id.name === b.name));
        if (entry) inserts.push({ at: entry.at, stmt: G.Assign(G.Ident('_'), '=', G.Ident(b.go)) });
      }
      inserts.sort((a, b) => b.at - a.at);
      for (const ins of inserts) out.splice(ins.at, 0, ins.stmt);
      return out;
    }

    stmt(node) {
      if (!node) return [];
      switch (node.type) {
        case 'BlockStatement': return [G.Block(this.stmts(node.body))];
        case 'EmptyStatement': return [];
        case 'ExpressionStatement': return this.expressionStatement(node.expression);
        case 'VariableDeclaration': return this.variableDeclaration(node);
        case 'ReturnStatement': return this.returnStatement(node);
        case 'IfStatement': return this.ifStatement(node);
        case 'ForStatement': return this.forStatement(node);
        case 'WhileStatement': return this.whileStatement(node);
        case 'DoWhileStatement': return this.doWhileStatement(node);
        case 'ForOfStatement': return this.forOfStatement(node);
        case 'ForInStatement': return this.forInStatement(node);
        case 'BreakStatement': return [G.Break(node.label ? this.labelName(node.label) : null)];
        case 'ContinueStatement': return [G.Continue(node.label ? this.labelName(node.label) : null)];
        case 'ThrowStatement': return this.throwStatement(node);
        case 'TryStatement': return this.tryStatement(node);
        case 'SwitchStatement': return this.switchStatement(node);
        case 'LabeledStatement': return this.labeledStatement(node);
        case 'FunctionDeclaration': return this.localFunction(node);
        case 'ClassDeclaration': throw new Error('a class declared inside a function is not supported');
        case 'DebugOutput': return this.expressionStatement(node);
        default:
          return this.expressionStatement(node);
      }
    }

    labelName(label) { return 'L_' + (label.name || label); }

    expressionStatement(e) {
      if (!e) return [];
      switch (e.type) {
        case 'AssignmentExpression': return this.assignment(e, false);
        case 'UpdateExpression': return this.update(e, false);
        case 'UnaryExpression':
          if (e.operator === '++' || e.operator === '--') return this.update(e, false);
          break;
        case 'SequenceExpression': return [].concat(...e.expressions.map(x => this.expressionStatement(x)));
        case 'ParentConstructorCall': return this.parentConstructorCall(e);
        case 'ArrayAppend': {
          // push as a statement: only the append
          this.xArrayAppend(e);
          return this.flushPre();
        }
        case 'LogicalExpression': {
          // a && f() as a statement
          const cond = this.condition(e.left);
          const pre = this.flushPre();
          const body = this.withBlock(() => this.expressionStatement(e.right));
          return [...pre, G.If(e.operator === '&&' ? cond : (e.operator === '||' ? G.Unary('!', cond) : G.Call(G.Ident('jsIsNull'), [this.coerce(this.expr(e.left), 'any')])), G.Block(body))];
        }
        case 'ConditionalExpression': {
          const cond = this.condition(e.test);
          const pre = this.flushPre();
          return [...pre, G.If(cond, G.Block(this.withBlock(() => this.expressionStatement(e.consequent))), G.Block(this.withBlock(() => this.expressionStatement(e.alternate))))];
        }
      }
      const v = this.expr(e);
      return [...this.flushPre(), this.exprStmt(v)];
    }

    /** A value as a statement: calls stay, anything else is assigned to _. */
    exprStmt(v) {
      if (v.e.kind === 'Call' && !(v.isConst)) return G.ExprStmt(v.e);
      if (v.t === 'void') return G.ExprStmt(v.e);
      return G.Assign(G.Ident('_'), '=', v.e);
    }

    withBlock(f) {
      this.pushScope();
      try { return f(); } finally { this.popScope(); }
    }

    variableDeclaration(node) {
      const out = [];
      for (const d of node.declarations) {
        if (!d.id) continue;
        if (d.id.type !== 'Identifier') { out.push(...this.destructuringDeclaration(d)); continue; }
        const t = this.typeOfNullable(this.declaratorType(d) || 'any', d.nullable || d.id.nullable || d.declaredNullable);
        if (node._hoisted) {
          if (!d.init) continue;
          const b = this.lookup(d.id.name);
          const v = this.expr(d.init);
          out.push(...this.flushPre(), G.Assign(G.Ident(b.go), '=', this.coerce(v, b.type)));
          continue;
        }
        let init = null;
        if (d.init) {
          const v = this.expr(d.init);
          init = this.coerce(v, t);
          out.push(...this.flushPre());
        }
        const b = this.declareLocal(d.id.name, t);
        out.push(G.VarDecl(b.go, this.goType(t), init));
      }
      return out;
    }

    destructuringDeclaration(d) {
      const out = [];
      const src = this.expr(d.init);
      out.push(...this.flushPre());
      const tmp = this.tmp('d');
      out.push(G.VarDecl(tmp, this.goType(src.t), src.e), G.Assign(G.Ident('_'), '=', G.Ident(tmp)));
      const srcVal = new Val(G.Ident(tmp), src.t);
      if (d.id.type === 'ArrayPattern') {
        d.id.elements.forEach((el, i) => {
          if (!el) return;
          const target = el.type === 'AssignmentPattern' ? el.left : el;
          const t = canonicalType(target.resultType) || (isArrayType(src.t) ? elementType(src.t) : 'any');
          const item = this.indexValue(srcVal, new Val(G.Lit(String(i)), 'int32', i), t);
          const b = this.declareLocal(target.name, t);
          out.push(G.VarDecl(b.go, this.goType(t), this.coerce(item, t)));
        });
      } else if (d.id.type === 'ObjectPattern') {
        for (const p of d.id.properties) {
          const key = propKey(p.key);
          const target = p.value && p.value.type === 'AssignmentPattern' ? p.value.left : (p.value || p.key);
          const t = canonicalType(target.resultType || p.resultType) || 'any';
          const item = this.memberValue(srcVal, key, t);
          const b = this.declareLocal(target.name, t);
          out.push(G.VarDecl(b.go, this.goType(t), this.coerce(item, t)));
        }
      }
      return out;
    }

    returnStatement(node) {
      if (!node.argument) return this.returnWith(this.fn.returnType !== 'void' ? this.zero(this.fn.returnType) : null);
      const v = this.expr(node.argument);
      const pre = this.flushPre();
      if (this.fn.returnType === 'void') return [...pre, this.exprStmt(v), ...this.returnWith(null)];
      return [...pre, ...this.returnWith(this.coerce(v, this.fn.returnType))];
    }

    /**
     * Return from the JavaScript function. Inside a try (whose body and catch
     * run in closures) that sets the closure's named results jsDone/jsRet,
     * which the enclosing function returns once the closure is done.
     */
    returnWith(value) {
      if (this.fn.inTry && this.fn.inTry.hasReturn) {
        const lhs = [G.Ident('jsDone')];
        const rhs = [G.Lit('true')];
        if (value && this.fn.returnType !== 'void') { lhs.push(G.Ident('jsRet')); rhs.push(value); }
        return [G.Assign(lhs, '=', rhs), G.Return()];
      }
      return [value ? G.Return(value) : G.Return()];
    }

    condition(test) {
      const v = this.expr(test);
      return this.truthy(v);
    }

    /** Statements of a branch, as a block. */
    branch(node) {
      if (!node) return G.Block([]);
      return G.Block(this.withBlock(() => node.type === 'BlockStatement' ? this.stmts(node.body) : this.stmt(node)));
    }

    ifStatement(node) {
      const cond = this.condition(node.test);
      const pre = this.flushPre();
      const then = this.branch(node.consequent);
      let otherwise = null;
      if (node.alternate) {
        if (node.alternate.type === 'IfStatement') {
          const inner = this.ifStatement(node.alternate);
          otherwise = inner.length === 1 ? inner[0] : G.Block(inner);
        } else {
          otherwise = this.branch(node.alternate);
        }
      }
      return [...pre, G.If(cond, then, otherwise)];
    }

    /** A loop's label (when a LabeledStatement wraps it). */
    takeLabel() {
      const l = this.fn.pendingLabel || null;
      this.fn.pendingLabel = null;
      return l;
    }

    forStatement(node) {
      const label = this.takeLabel();
      this.pushScope();
      const out = [];
      let init = null;
      if (node.init) {
        if (node.init.type === 'VariableDeclaration' && !node.init._hoisted && node.init.declarations.every(d => d.id.type === 'Identifier')) {
          const names = [];
          const values = [];
          for (const d of node.init.declarations) {
            const t = this.typeOfNullable(this.declaratorType(d) || 'any', d.nullable);
            const v = d.init ? this.coerce(this.expr(d.init), t) : this.zero(t);
            const b = this.declareLocal(d.id.name, t);
            b.used = true;
            names.push(G.Ident(b.go));
            values.push(this.typedValue(v, t));
          }
          const pre = this.flushPre();
          if (pre.length) { out.push(...pre); }
          init = G.Assign(names, ':=', values);
        } else {
          out.push(...this.stmt(node.init.type === 'VariableDeclaration' ? node.init : { type: 'ExpressionStatement', expression: node.init }));
        }
      }
      let cond = null;
      if (node.test) {
        const c = this.condition(node.test);
        const pre = this.flushPre();
        cond = pre.length ? this.iife([...pre, G.Return(c)], 'bool') : c;
      }
      let post = null;
      if (node.update) {
        const ups = this.expressionStatement(node.update);
        post = ups.length === 1 && (ups[0].kind === 'Assign' && ups[0].op !== ':=' || ups[0].kind === 'IncDec' || ups[0].kind === 'ExprStmt') ? ups[0] : G.ExprStmt(G.Call(G.FuncLit([], [], G.Block(ups)), []));
      }
      const body = this.loopBody(node.body);
      this.popScope();
      out.push(G.For(init, cond, post, body, label));
      return out.length === 1 ? out : [G.Block(out)];
    }

    /** A Go expression with an explicit type (for := declarations). */
    typedValue(e, t) {
      const g = this.goType(t);
      if (e.kind === 'Lit') return G.Conv(g, e);
      if (e.kind === 'Conv' && e.type === g) return e;
      return G.Conv(g, e);
    }

    loopBody(body) {
      return G.Block(this.withBlock(() => body && body.type === 'BlockStatement' ? this.stmts(body.body) : this.stmt(body)));
    }

    whileStatement(node) {
      const label = this.takeLabel();
      const c = this.condition(node.test);
      const pre = this.flushPre();
      const cond = pre.length ? this.iife([...pre, G.Return(c)], 'bool') : c;
      return [G.For(null, cond, null, this.loopBody(node.body), label)];
    }

    doWhileStatement(node) {
      // for first := true; first || cond; first = false { body }: continue re-tests the condition
      const label = this.takeLabel();
      const first = this.tmp('first');
      const body = this.loopBody(node.body);
      const c = this.condition(node.test);
      const pre = this.flushPre();
      const cond = pre.length ? this.iife([...pre, G.Return(c)], 'bool') : c;
      return [G.For(G.Assign(G.Ident(first), ':=', G.Lit('true')), G.Binary('||', G.Ident(first), cond), G.Assign(G.Ident(first), '=', G.Lit('false')), body, label)];
    }

    forOfStatement(node) {
      const label = this.takeLabel();
      const iter = this.expr(node.right);
      const pre = this.flushPre();
      const decl = node.left.type === 'VariableDeclaration' ? node.left.declarations[0].id : node.left;
      this.pushScope();
      const it = canonicalType(iter.t) || 'any';
      let elT = isArrayType(it) ? elementType(it) : (it === 'string' ? 'string' : 'any');
      const declared = canonicalType(decl.resultType);
      const b = this.declareLocal(decl.name, declared || elT);
      const tmpV = this.tmp('v');
      const body = this.loopBody(node.body);
      this.popScope();
      let rangeExpr = iter.e;
      if (it === 'string') rangeExpr = G.Call(G.Ident('jsStringChars'), [iter.e]);
      else if (!isArrayType(it)) rangeExpr = G.Call(G.Ident('jsIterValues'), [iter.e]);
      const assign = G.VarDecl(b.go, this.goType(b.type), this.coerce(new Val(G.Ident(tmpV), it === 'string' ? 'string' : (isArrayType(it) ? elT : 'any')), b.type));
      body.stmts.unshift(assign, G.Assign(G.Ident('_'), '=', G.Ident(b.go)));
      return [...pre, G.ForRange('_', tmpV, rangeExpr, body, label)];
    }

    forInStatement(node) {
      const label = this.takeLabel();
      const obj = this.expr(node.right);
      const pre = this.flushPre();
      const decl = node.left.type === 'VariableDeclaration' ? node.left.declarations[0].id : node.left;
      this.pushScope();
      const b = this.declareLocal(decl.name, 'string');
      b.used = true;
      const body = this.loopBody(node.body);
      this.popScope();
      body.stmts.unshift(G.Assign(G.Ident('_'), '=', G.Ident(b.go)));
      return [...pre, G.ForRange('_', b.go, G.Call(G.Ident('jsKeys'), [this.coerce(obj, 'any')]), body, label)];
    }

    labeledStatement(node) {
      const name = this.labelName(node.label);
      const loops = ['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForOfStatement', 'ForInStatement', 'SwitchStatement'];
      if (loops.includes(node.body.type)) {
        this.fn.pendingLabel = name;
        return this.stmt(node.body);
      }
      // A labeled block: break L leaves it - a one-pass loop gives that
      const body = this.loopBody(node.body);
      body.stmts.push(G.Break(name));
      return [G.For(null, null, null, body, name)];
    }

    throwStatement(node) {
      const v = this.expr(node.argument);
      const pre = this.flushPre();
      return [...pre, G.ExprStmt(G.Call(G.Ident('panic'), [G.Call(G.Ident('jsThrowable'), [this.coerce(v, 'any')])]))];
    }

    tryStatement(node) {
      // func() { defer finally; defer recover-catch; try }(), with returns carried out
      const hasReturn = this.containsReturn(node);
      const resultType = this.fn.returnType;
      const saved = { inTry: this.fn.inTry };
      this.fn.inTry = { hasReturn, resultType };
      const doneVar = 'jsDone';
      const valVar = 'jsRet';
      const tryBody = this.branch(node.block).stmts;
      let catchStmts = null;
      if (node.handler) {
        catchStmts = this.withBlock(() => {
          const stmts = [];
          if (node.handler.param) {
            const b = this.declareLocal(node.handler.param.name, 'any');
            b.used = true;
            stmts.push(G.Assign(G.Ident(b.go), ':=', G.Call(G.Ident('jsCaught'), [G.Ident('jsR')])), G.Assign(G.Ident('_'), '=', G.Ident(b.go)));
          }
          stmts.push(...this.stmts(node.handler.body.body));
          return stmts;
        });
      }
      const finallyStmts = node.finalizer ? this.branch(node.finalizer).stmts : null;
      this.fn.inTry = saved.inTry;
      const inner = [];
      if (finallyStmts) inner.push(G.Defer(G.Call(G.FuncLit([], [], G.Block(finallyStmts)), [])));
      if (catchStmts) {
        inner.push(G.Defer(G.Call(G.FuncLit([], [], G.Block([
          G.If(G.Binary('!=', G.Ident('jsR'), G.Lit('nil')), G.Block(catchStmts), null, G.Assign(G.Ident('jsR'), ':=', G.Call(G.Ident('recover'), [])))
        ])), [])));
      }
      inner.push(...tryBody);
      if (!hasReturn) return [G.ExprStmt(G.Call(G.FuncLit([], [], G.Block(inner)), []))];
      const results = [{ name: doneVar, type: 'bool' }];
      if (resultType !== 'void') results.push({ name: valVar, type: this.goType(resultType) });
      inner.push(G.Return());
      const call = G.Call(G.FuncLit([], results, G.Block(inner)), []);
      const d = this.tmp('done');
      const r = this.tmp('ret');
      const lhs = resultType !== 'void' ? [G.Ident(d), G.Ident(r)] : [G.Ident(d)];
      return [G.If(G.Ident(d), G.Block(this.returnWith(resultType !== 'void' ? G.Ident(r) : null)), null, G.Assign(lhs, ':=', call))];
    }

    containsReturn(node) {
      let found = false;
      Model.walk([node.block, node.handler, node.finalizer], n => {
        if (n.type === 'FunctionExpression' || n.type === 'ArrowFunction' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionDeclaration') return false;
        if (n.type === 'ReturnStatement') found = true;
      });
      return found;
    }

    switchStatement(node) {
      const label = this.takeLabel();
      const disc = this.expr(node.discriminant);
      const pre = this.flushPre();
      const tag = canonicalType(disc.t) || 'any';
      const cases = [];
      const n = node.cases.length;
      node.cases.forEach((c, i) => {
        const exprs = c.test ? [this.coerce(this.expr(c.test), tag)] : null;
        const casePre = this.flushPre();
        if (casePre.length) throw new Error('a switch case with side effects is not supported');
        let body = this.withBlock(() => this.stmts(c.consequent));
        // JavaScript falls through a case that does not end in a jump
        const last = body[body.length - 1];
        const unwrapped = c.consequent.length === 1 && c.consequent[0].type === 'BlockStatement' ? body[0] && body[0].stmts : null;
        const lastInner = unwrapped ? unwrapped[unwrapped.length - 1] : null;
        const ends = x => x && (x.kind === 'Return' || x.kind === 'Continue' || (x.kind === 'Break') ||
          (x.kind === 'ExprStmt' && x.expr.kind === 'Call' && x.expr.fn.name === 'panic'));
        if (last && last.kind === 'Break' && !last.label) body = body.slice(0, -1);
        else if (lastInner && lastInner.kind === 'Break' && !lastInner.label) body[0].stmts = unwrapped.slice(0, -1);
        else if (!ends(last) && !ends(lastInner) && i < n - 1) body.push(G.Fallthrough());
        cases.push({ exprs, body });
      });
      // A case that only falls through to the next merges its expression into it
      const merged = [];
      for (let i = 0; i < cases.length; ++i) {
        const c = cases[i];
        if (c.body.length === 1 && c.body[0].kind === 'Fallthrough' && c.exprs && cases[i + 1] && cases[i + 1].exprs) {
          cases[i + 1].exprs = c.exprs.concat(cases[i + 1].exprs);
          continue;
        }
        merged.push(c);
      }
      // Duplicate constant cases are compile errors in a tagged Go switch; a
      // tagless switch on a temporary compares each case in order instead
      const texts = [];
      for (const c of merged) for (const e of c.exprs || []) texts.push(e.kind === 'Lit' ? e.text : null);
      const tagged = texts.every(t => t !== null) && new Set(texts).size === texts.length;
      if (tagged) return [...pre, G.Switch(this.coerce(disc, tag), merged, label)];
      const tmp = this.tmp('sw');
      for (const c of merged) if (c.exprs) c.exprs = c.exprs.map(e => this.equality('===', new Val(G.Ident(tmp), tag), new Val(e, tag)).e);
      return [...pre, G.Switch(null, merged, label, G.Assign(G.Ident(tmp), ':=', this.coerce(disc, tag)))];
    }

    localFunction(node) {
      const name = node.id.name;
      const params = Model.functionParams(node, node.jsDoc);
      const ret = this.signatureReturn(node, node.jsDoc);
      const b = this.declareLocal(name, 'function');
      b.used = true;
      b.fnSig = { params, ret };
      const fnType = this.funcType(params, ret.type);
      const lit = this.funcLit(node, node.jsDoc);
      return [G.VarDecl(b.go, fnType, null), G.Assign(G.Ident(b.go), '=', lit.e), G.Assign(G.Ident('_'), '=', G.Ident(b.go))];
    }

    funcType(params, retType) {
      return `func(${params.map(p => this.goTypeNullable(p.type, p.nullable)).join(', ')})${retType === 'void' ? '' : ' ' + this.goType(retType)}`;
    }

    /** A closure for a nested function or arrow function. */
    funcLit(node, jsDoc) {
      const params = Model.functionParams(node, jsDoc);
      const ret = this.signatureReturn(node, jsDoc);
      const outer = this.fn;
      const lookupOuter = name => {
        for (let i = outer.scopes.length - 1; i >= 0; --i) {
          const b = outer.scopes[i].get(name);
          if (b) { b.used = true; return b; }
        }
        return outer.outer ? outer.outer(name) : null;
      };
      const lit = this.withFunction({ returnType: ret.type, cls: outer.cls, self: outer.self, outer: lookupOuter }, () => {
        const goParams = params.map(p => ({ name: this.declareLocal(p.name, this.typeOfNullable(p.type, p.nullable), true).go, type: this.goTypeNullable(p.type, p.nullable) }));
        const body = this.functionBody(node);
        return G.FuncLit(goParams, ret.type === 'void' ? [] : [{ type: this.goType(ret.type) }], G.Block(body));
      });
      const v = new Val(lit, 'function');
      v.sig = { params, ret };
      return v;
    }

    /** func() T { stmts }() */
    iife(stmts, type) {
      return G.Call(G.FuncLit([], type && type !== 'void' ? [{ type: this.goType(type) }] : [], G.Block(stmts)), []);
    }

    // ======================================================================
    // ASSIGNMENT
    // ======================================================================

    /**
     * An assignment as statements (asValue false), or as statements plus the
     * assigned value (asValue true: returns { stmts, value }).
     */
    assignment(node, asValue) {
      const op = node.operator;
      const left = node.left;
      const binOp = op === '=' ? null : op.slice(0, -1);
      // Logical assignment: a ||= b, a &&= b, a ??= b
      if (binOp === '||' || binOp === '&&' || binOp === '??') {
        const target = this.lvalue(left);
        const cur = target.get();
        const cond = binOp === '||' ? G.Unary('!', this.truthy(cur)) : binOp === '&&' ? this.truthy(cur) : G.Call(G.Ident('jsIsNull'), [this.coerce(cur, 'any')]);
        const rhs = this.expr(node.right);
        const inner = [...this.flushPre(), ...target.set(rhs)];
        const pre = [...target.pre];
        const stmts = [...pre, G.If(cond, G.Block(inner))];
        return asValue ? { stmts, value: target.get() } : stmts;
      }
      const target = this.lvalue(left);
      let value;
      if (binOp) {
        const cur = target.get();
        const rhs = this.expr(node.right);
        value = this.binaryValues(binOp, cur, rhs, canonicalType(node.resultType) || target.type, node);
      } else {
        value = this.expr(node.right);
      }
      const pre = [...target.pre, ...this.flushPre()];
      if (!asValue) return [...pre, ...target.set(value)];
      // As a value: keep it in a temporary
      const t = target.type;
      const tmp = this.tmp('a');
      const stmts = [...pre, G.Assign(G.Ident(tmp), ':=', this.coerce(value, t)), ...target.set(new Val(G.Ident(tmp), t))];
      return { stmts, value: new Val(G.Ident(tmp), t) };
    }

    /**
     * An assignable place: { type, get() -> Val, set(Val) -> stmts, pre }.
     * Index and object expressions are evaluated once (into temporaries when they have effects).
     */
    lvalue(node) {
      const pre = [];
      switch (node.type) {
        case 'Identifier': {
          const b = this.lookup(node.name);
          if (b) {
            return { type: b.type, pre, get: () => { b.used = true; return new Val(G.Ident(b.go), b.type); }, set: v => [G.Assign(G.Ident(b.go), '=', this.coerce(v, b.type))] };
          }
          const top = this.model.variables.get(node.name);
          if (top) {
            const t = this.typeOfNullable(top.type, top.nullable);
            const id = G.Ident(this.topName(node.name));
            return { type: t, pre, get: () => new Val(id, t), set: v => [G.Assign(id, '=', this.coerce(v, t))] };
          }
          throw new Error(`assignment to an unknown variable ${node.name}`);
        }
        case 'ThisPropertyAccess':
          if (!node.computed) return this.memberLvalue(this.thisValue(), node.property, node, pre);
          return this.indexLvalue(this.thisValue(), node.property, node, pre);
        case 'MemberExpression': {
          if (!node.computed) {
            const key = node.property.name || node.property.value;
            // Class.staticField
            if (node.object.type === 'Identifier' && this.model.classes.has(node.object.name) && !this.lookup(node.object.name)) {
              const info = this.model.classes.get(node.object.name);
              const sf = this.findStaticField(info, key);
              if (sf) {
                const id = G.Ident(this.staticName(sf.owner.name, key));
                const t = sf.type || 'any';
                return { type: t, pre, get: () => new Val(id, t), set: v => [G.Assign(id, '=', this.coerce(v, t))] };
              }
            }
            const obj = this.stableExpr(this.expr(node.object), pre);
            return this.memberLvalue(obj, key, node, pre);
          }
          const obj = this.stableExpr(this.expr(node.object), pre);
          return this.indexLvalue(obj, node.property, node, pre);
        }
        case 'ArrayLength': {
          const arr = this.expr(node.array);
          pre.push(...this.flushPre());
          return this.memberLvalue(arr, 'length', { resultType: 'int32' }, pre);
        }
        default:
          throw new Error(`cannot assign to ${node.type}`);
      }
    }

    /** An expression that may be evaluated twice: identifiers and this stay, anything else goes to a temporary. */
    stableExpr(v, pre) {
      pre.push(...this.flushPre());
      if (v.e.kind === 'Ident' || v.isConst) return v;
      if (v.e.kind === 'Selector' && v.e.operand.kind === 'Ident') return v;
      const tmp = this.tmp('o');
      pre.push(G.Assign(G.Ident(tmp), ':=', v.e));
      return new Val(G.Ident(tmp), v.t);
    }

    findStaticField(info, key) {
      for (let c = info; c; c = c.base) if (c.staticFields.has(key)) return Object.assign({ owner: c }, c.staticFields.get(key));
      return null;
    }

    memberLvalue(obj, key, node, pre) {
      const ot = canonicalType(obj.t) || 'any';
      const info = this.isLeafClass(ot) || (obj.isThis && this.fn.cls) ? (obj.isThis ? this.fn.cls : this.model.classOf(ot)) : null;
      const nodeType = this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable);
      if (info) {
        const eff = info.effective;
        if (eff.fields.has(key)) {
          const f = eff.fields.get(key);
          const t = this.typeOfNullable(f.type, f.nullable);
          const sel = G.Selector(obj.e, this.fieldName(info, key));
          return { type: t, pre, get: () => new Val(sel, t), set: v => [G.Assign(sel, '=', this.coerce(v, t))], field: true };
        }
        if (eff.setters.has(key) || eff.getters.has(key)) {
          const g = eff.getters.get(key);
          const s = eff.setters.get(key);
          const gt = g ? this.signatureReturn(g.fn, g.jsDoc).type : 'any';
          const sp = s ? (Model.functionParams(s.fn, s.jsDoc)[0] || { type: 'any' }) : null;
          const st = sp ? this.typeOfNullable(sp.type, sp.nullable) : 'any';
          return {
            type: s ? st : gt, pre,
            get: () => g ? new Val(G.Call(G.Selector(obj.e, this.getterName(key)), []), gt) : new Val(G.Lit('nil'), 'any'),
            set: v => s ? [G.ExprStmt(G.Call(G.Selector(obj.e, this.setterName(key)), [this.coerce(v, st)]))]
              : [G.ExprStmt(G.Call(G.Selector(obj.e, 'JsSet'), [G.Lit(this.goString(key)), this.coerce(v, 'any')]))]
          };
        }
      }
      if (ot === 'Error' || ot === 'TypeError' || ot === 'RangeError') {
        const field = key === 'message' ? 'Message' : key === 'name' ? 'Name' : null;
        if (field) {
          const sel = G.Selector(obj.e, field);
          return { type: 'string', pre, get: () => new Val(sel, 'string'), set: v => [G.Assign(sel, '=', this.coerce(v, 'string'))] };
        }
      }
      if (isArrayType(ot) && key === 'length') {
        return {
          type: 'int32', pre,
          get: () => new Val(G.Conv('int32', G.Call(G.Ident('len'), [obj.e])), 'int32'),
          set: v => {
            const target = this.lvalueExprFor(obj);
            return [G.Assign(target, '=', G.Call(G.Ident('jsSetLength'), [obj.e, G.Conv('int', this.coerce(v, 'int32'))]))];
          }
        };
      }
      // Dynamic object
      const o = this.coerce(obj, 'object');
      return {
        type: nodeType, pre,
        get: () => new Val(G.Call(G.Selector(o, 'JsGet'), [G.Lit(this.goString(key))]), 'any'),
        set: v => [G.ExprStmt(G.Call(G.Selector(o, 'JsSet'), [G.Lit(this.goString(key)), this.anyOf(v)]))]
      };
    }

    /** A value for an any slot, keeping its IL type (constants get an explicit Go type). */
    anyOf(v) {
      return this.coerce(v, 'any');
    }

    lvalueExprFor(obj) {
      return obj.e;
    }

    indexLvalue(obj, indexNode, node, pre) {
      const ot = canonicalType(obj.t) || 'any';
      const idx = this.stableExpr(this.expr(indexNode), pre);
      if (isArrayType(ot)) {
        const el = elementType(ot);
        const elT = el === 'object' ? 'any' : el;
        const i = this.coerce(idx, 'goint');
        const place = G.Index(obj.e, i);
        return {
          type: elT, pre,
          get: () => new Val(G.Index(obj.e, i), elT),
          set: v => {
            // An index at the end grows the array, as JavaScript's does
            const val = this.coerce(v, elT);
            if (this.isAssignable(obj.e)) return [G.Assign(obj.e, '=', G.Call(this.generic('jsSetAt', this.goType(elT)), [obj.e, i, val]))];
            return [G.Assign(place, '=', val)];
          }
        };
      }
      if (ot === 'string') throw new Error('assignment to a string index');
      const o = this.coerce(obj, 'object');
      const key = G.Call(G.Ident('jsKey'), [this.coerce(idx, 'any')]);
      const nodeType = this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable);
      return {
        type: nodeType, pre,
        get: () => new Val(G.Call(G.Selector(o, 'JsGet'), [key]), 'any'),
        set: v => [G.ExprStmt(G.Call(G.Selector(o, 'JsSet'), [key, this.anyOf(v)]))]
      };
    }

    isAssignable(e) {
      return e.kind === 'Ident' || e.kind === 'Selector' || e.kind === 'Index';
    }

    update(node, asValue) {
      const target = this.lvalue(node.argument);
      const t = target.type;
      const cur = target.get();
      const one = new Val(G.Lit('1'), 'int32', 1);
      const next = this.binaryValues(node.operator === '++' ? '+' : '-', cur, one, isNumericType(t) || isBigType(t) ? t : 'float64', node);
      const pre = [...target.pre, ...this.flushPre()];
      if (!asValue) {
        if (target.field !== undefined || cur.e.kind === 'Ident' || cur.e.kind === 'Selector' || cur.e.kind === 'Index') {
          if (this.numKind(this.goType(t)) && (cur.e.kind === 'Ident' || target.field)) return [...pre, G.IncDec(cur.e, node.operator)];
        }
        return [...pre, ...target.set(next)];
      }
      const tmp = this.tmp('u');
      if (node.prefix) {
        return { stmts: [...pre, ...target.set(next), G.Assign(G.Ident(tmp), ':=', this.coerce(target.get(), t))], value: new Val(G.Ident(tmp), t) };
      }
      return { stmts: [...pre, G.Assign(G.Ident(tmp), ':=', this.coerce(cur, t)), ...target.set(this.binaryValues(node.operator === '++' ? '+' : '-', new Val(G.Ident(tmp), t), one, isNumericType(t) || isBigType(t) ? t : 'float64', node))], value: new Val(G.Ident(tmp), t) };
    }

    parentConstructorCall(node) {
      const info = this.fn.cls;
      const owner = this.fn.initOf;
      if (!info || !owner || !owner.base) return [];
      const base = owner.base;
      const ctorOwner = [...base.chain()].reverse().find(c => c.ctor);
      const params = ctorOwner ? Model.functionParams(ctorOwner.ctor, ctorOwner.ctorDoc) : [];
      const args = this.callArgs(node.arguments || [], params);
      const out = [...this.flushPre(), G.ExprStmt(G.Call(G.Selector(G.Ident('this'), this.initName(base)), args))];
      out.push(...this.fieldInitializers(info, owner));
      return out;
    }

    // ======================================================================
    // EXPRESSIONS
    // ======================================================================

    thisValue() {
      const cls = this.fn.cls;
      if (!cls || !this.fn.self) return new Val(G.Ident('nil'), 'any');
      const v = new Val(G.Ident('this'), this.isLeafClass(cls.name) ? cls.name : '#this');
      v.isThis = true;
      v.thisClass = cls;
      return v;
    }

    /**
     * Transform an IL expression.
     * @param {Object} node - IL expression
     * @returns {Val} the Go expression and its IL type
     */
    expr(node) {
      if (!node) return new Val(G.Lit('nil'), 'null', null);
      const handler = this['x' + node.type];
      if (handler) return handler.call(this, node);
      this.warnings.push(`unsupported expression ${node.type}`);
      return new Val(G.Call(G.Ident('jsUnsupported'), [G.Lit(this.goString(node.type))]), canonicalType(node.resultType) || 'any');
    }

    xLiteral(node) {
      const t = canonicalType(node.resultType);
      if (node.regex) {
        return new Val(G.Call(G.Selector(G.Ident('regexp'), 'MustCompile'), [G.Lit(this.goString(this.goRegex(node.regex)))]), 'regex');
      }
      const v = node.value;
      if (v === null) return new Val(G.Lit('nil'), 'null', null);
      if (node.bigint !== undefined || typeof v === 'bigint') {
        const b = BigInt(typeof v === 'bigint' ? v : String(node.bigint || v).replace(/n$/, ''));
        return new Val(null, isBigType(t) ? 'bigint' : (t === 'uint64' || t === 'int64' ? t : 'bigint'), b);
      }
      if (typeof v === 'number') return new Val(null, t && isNumericType(t) ? t : (Number.isInteger(v) ? 'int32' : 'float64'), v);
      if (typeof v === 'string') return new Val(null, 'string', v);
      if (typeof v === 'boolean') return new Val(null, 'boolean', v);
      return new Val(G.Lit('nil'), 'null', null);
    }

    goRegex(r) {
      const flags = (r.flags || '').replace(/[gy]/g, '');
      return (flags ? `(?${flags})` : '') + r.pattern;
    }

    xIdentifier(node) {
      const name = node.name;
      if (name === 'undefined') return new Val(G.Lit('nil'), 'null', null);
      if (name === 'NaN') return new Val(null, 'float64', NaN);
      if (name === 'Infinity') return new Val(null, 'float64', Infinity);
      const b = this.lookup(name);
      if (b) {
        b.used = true;
        const v = new Val(G.Ident(b.go), b.type);
        if (b.fnSig) v.sig = b.fnSig;
        return v;
      }
      const top = this.model.variables.get(name);
      if (top) return new Val(G.Ident(this.topName(name)), this.typeOfNullable(top.type, top.nullable));
      const fn = this.model.functions.get(name);
      if (fn) {
        const v = new Val(G.Ident(this.topName(name)), 'function');
        v.sig = { params: Model.functionParams(fn.node, fn.node.jsDoc), ret: this.signatureReturn(fn.node, fn.node.jsDoc) };
        return v;
      }
      if (this.model.classes.has(name)) {
        const v = new Val(G.Lit('nil'), 'any');
        v.classRef = this.model.classes.get(name);
        return v;
      }
      this.warnings.push(`unknown identifier ${name}`);
      return new Val(G.Call(G.Ident('jsUnsupported'), [G.Lit(this.goString('identifier ' + name))]), canonicalType(node.resultType) || 'any');
    }

    xThisExpression() { return this.thisValue(); }

    xThisPropertyAccess(node) {
      const self = this.thisValue();
      if (node.computed) return this.indexValue(self, this.expr(node.property), canonicalType(node.resultType) || 'any');
      return this.memberValue(self, node.property, this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable));
    }

    xMemberExpression(node) {
      const resultType = this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable);
      if (!node.computed) {
        const key = node.property.name || node.property.value;
        if (node.object.type === 'Identifier' && !this.lookup(node.object.name)) {
          const special = this.globalMember(node.object.name, key, node);
          if (special) return special;
          if (this.model.classes.has(node.object.name) && !this.model.variables.has(node.object.name)) {
            const info = this.model.classes.get(node.object.name);
            const sf = this.findStaticField(info, key);
            if (sf) return new Val(G.Ident(this.staticName(sf.owner.name, key)), sf.type || 'any');
            for (let c = info; c; c = c.base) {
              if (c.staticGetters && c.staticGetters.has(key)) {
                const g = c.staticGetters.get(key);
                return new Val(G.Call(G.Ident(this.staticName(c.name, 'get_' + key)), []), this.signatureReturn(g.fn, g.jsDoc).type);
              }
            }
          }
        }
        const obj = this.expr(node.object);
        return this.memberValue(obj, key, resultType);
      }
      const obj = this.expr(node.object);
      return this.indexValue(obj, this.expr(node.property), resultType);
    }

    /** Members of the JavaScript globals (Number.MAX_SAFE_INTEGER, Math.PI, ...). */
    globalMember(obj, key) {
      const consts = {
        'Number.MAX_SAFE_INTEGER': 9007199254740991, 'Number.MIN_SAFE_INTEGER': -9007199254740991,
        'Number.MAX_VALUE': Number.MAX_VALUE, 'Number.MIN_VALUE': Number.MIN_VALUE, 'Number.EPSILON': Number.EPSILON,
        'Number.POSITIVE_INFINITY': Infinity, 'Number.NEGATIVE_INFINITY': -Infinity, 'Number.NaN': NaN,
        'Math.PI': Math.PI, 'Math.E': Math.E, 'Math.LN2': Math.LN2, 'Math.LN10': Math.LN10, 'Math.LOG2E': Math.LOG2E,
        'Math.LOG10E': Math.LOG10E, 'Math.SQRT2': Math.SQRT2, 'Math.SQRT1_2': Math.SQRT1_2
      };
      const k = `${obj}.${key}`;
      if (k in consts) return new Val(null, 'float64', consts[k]);
      return null;
    }

    /** obj.key as a value. */
    memberValue(obj, key, resultType) {
      const ot = canonicalType(obj.t) || 'any';
      if (obj.classRef) {
        const sf = this.findStaticField(obj.classRef, key);
        if (sf) return new Val(G.Ident(this.staticName(sf.owner.name, key)), sf.type || 'any');
        if (key === 'name') return new Val(null, 'string', obj.classRef.name);
      }
      if ((ot === 'string' || isArrayType(ot)) && key === 'length')
        return new Val(G.Conv('int32', G.Call(G.Ident('len'), [obj.e])), 'int32');
      const pre = [];
      const lv = this.memberLvalue(obj, key, { resultType }, pre);
      this.fn.pre.push(...pre);
      return lv.get();
    }

    /** obj[index] as a value. */
    indexValue(obj, idx, resultType) {
      const ot = canonicalType(obj.t) || 'any';
      if (isArrayType(ot)) {
        const el = elementType(ot);
        return new Val(G.Index(obj.e, this.coerce(idx, 'goint')), el === 'object' ? 'any' : el);
      }
      if (ot === 'string') return new Val(G.Call(G.Ident('jsCharAt'), [obj.e, this.coerce(idx, 'goint')]), 'string');
      if (ot === 'Map') return new Val(G.Call(G.Selector(obj.e, 'MapGet'), [this.coerce(idx, 'any')]), 'any');
      const o = this.coerce(obj, 'object');
      return new Val(G.Call(G.Selector(o, 'JsGet'), [G.Call(G.Ident('jsKey'), [this.coerce(idx, 'any')])]), 'any');
    }

    xArrayLength(node) {
      const a = this.expr(node.array);
      const t = canonicalType(a.t) || 'any';
      if (isArrayType(t) || t === 'string') return new Val(G.Conv('int32', G.Call(G.Ident('len'), [a.e])), 'int32');
      return new Val(G.Call(G.Ident('jsLength'), [this.coerce(a, 'any')]), 'int32');
    }

    // ------------------------------------------------------------ operators

    xBinaryExpression(node) {
      const left = this.expr(node.left);
      const right = this.expr(node.right);
      return this.binaryValues(node.operator, left, right, canonicalType(node.resultType), node);
    }

    /**
     * A binary operation on two values with the IL result type.
     * @param {string} op - JavaScript operator
     * @param {Val} l - left
     * @param {Val} r - right
     * @param {string} rt - IL result type
     */
    binaryValues(op, l, r, rt, node) {
      const lt = canonicalType(l.t) || 'any';
      const rtp = canonicalType(r.t) || 'any';
      // Constant folding with JavaScript's own semantics
      if (l.isConst && r.isConst && !(typeof l.c === 'bigint') !== !(typeof r.c === 'bigint') === false) {
        const folded = this.fold(op, l.c, r.c);
        if (folded !== undefined) return new Val(null, rt || (typeof folded === 'boolean' ? 'boolean' : typeof folded === 'string' ? 'string' : 'float64'), folded);
      }
      switch (op) {
        case '===': case '==': case '!==': case '!=': return this.equality(op, l, r);
        case '<': case '<=': case '>': case '>=': return this.compare(op, l, r);
        case 'in': return new Val(G.Call(G.Ident('jsIn'), [this.coerce(l, 'any'), this.coerce(r, 'any')]), 'boolean');
        case 'instanceof': return this.instanceOf(l, r);
      }
      const big = isBigType(lt) || isBigType(rtp) || isBigType(rt) || (typeof l.c === 'bigint') || (typeof r.c === 'bigint');
      // String concatenation
      if (op === '+' && (lt === 'string' || rtp === 'string' || rt === 'string')) {
        return new Val(G.Binary('+', this.coerce(l, 'string'), this.coerce(r, 'string')), 'string');
      }
      const bitwise = ['&', '|', '^', '<<', '>>', '>>>'].includes(op);
      if (bitwise) return this.bitwise(op, l, r, rt, big);
      if (op === '**') return this.power(l, r, rt);
      // Arithmetic
      if (big && (isBigType(rt) || isBigType(lt) || isBigType(rtp))) {
        const fn = { '+': 'jsBigAdd', '-': 'jsBigSub', '*': 'jsBigMul', '/': 'jsBigDiv', '%': 'jsBigMod' }[op];
        const res = new Val(G.Call(G.Ident(fn), [this.coerce(l, 'bigint'), this.coerce(r, 'bigint')]), 'bigint');
        return rt && !isBigType(rt) ? new Val(this.coerce(res, rt), rt) : res;
      }
      let t = rt && isNumericType(rt) ? rt : (isNumericType(lt) && isNumericType(rtp) ? this.widen(lt, rtp) : 'float64');
      if (op === '/') {
        // JavaScript division is a float division; a 64-bit integer result is a BigInt division
        if ((t === 'uint64' || t === 'int64') && (big || ((lt === 'uint64' || lt === 'int64') && (rtp === 'uint64' || rtp === 'int64') && !isFloatType(lt) && !isFloatType(rtp)) && this.isBigIntish(node))) {
          return new Val(G.Binary('/', this.coerce(l, t), this.coerce(r, t)), t);
        }
        const q = new Val(G.Binary('/', this.coerce(l, 'float64'), this.coerce(r, 'float64')), 'float64');
        return isFloatType(t) ? q : new Val(this.coerce(q, t), t);
      }
      if (op === '%') {
        if (isFloatType(t) || isFloatType(lt) || isFloatType(rtp)) {
          const m = new Val(G.Call(G.Selector(G.Ident('math'), 'Mod'), [this.coerce(l, 'float64'), this.coerce(r, 'float64')]), 'float64');
          return isFloatType(t) ? m : new Val(this.coerce(m, t), t);
        }
        // Integer remainder: computed in the wider operand type (it takes the sign of the dividend)
        const w = this.widen(lt, rtp);
        if (!isIntType(w)) {
          const m = new Val(G.Call(G.Selector(G.Ident('math'), 'Mod'), [this.coerce(l, 'float64'), this.coerce(r, 'float64')]), 'float64');
          return isFloatType(t) ? m : new Val(this.coerce(m, t), t);
        }
        const m = new Val(G.Binary('%', this.coerce(l, w), this.coerce(r, w)), w);
        return w === t ? m : new Val(this.coerce(m, t), t);
      }
      return new Val(G.Binary(op, this.coerce(l, t), this.coerce(r, t)), t);
    }

    /** Whether a 64-bit division is a BigInt one (its operands are BigInt values). */
    isBigIntish(node) {
      const isBig = n => n && (isBigType(n.resultType) || n.type === 'BigIntCast' || n.bigint === true || (n.type === 'Literal' && (n.bigint !== undefined || typeof n.value === 'bigint')));
      return !!node && (isBig(node.left) || isBig(node.right));
    }

    /** The type two numbers of different types compute in. */
    widen(a, b) {
      if (a === b) return a;
      if (isFloatType(a) || isFloatType(b) || !isIntType(a) || !isIntType(b)) return 'float64';
      if (a === 'uint64' || b === 'uint64') return (isSignedInt(a) || isSignedInt(b)) ? 'int64' : 'uint64';
      return intBits(a) === 64 || intBits(b) === 64 ? 'int64' : (isSignedInt(a) || isSignedInt(b) || intBits(a) === 32 || intBits(b) === 32 ? 'int64' : 'int32');
    }

    fold(op, a, b) {
      try {
        switch (op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return typeof a === 'bigint' ? (b === 0n ? undefined : a / b) : a / b;
          case '%': return typeof a === 'bigint' ? (b === 0n ? undefined : a % b) : a % b;
          case '**': return a ** b;
          case '&': return a & b;
          case '|': return a | b;
          case '^': return a ^ b;
          case '<<': return a << b;
          case '>>': return a >> b;
          case '>>>': return a >>> b;
          case '===': case '==': return a === b;
          case '!==': case '!=': return a !== b;
          case '<': return a < b;
          case '<=': return a <= b;
          case '>': return a > b;
          case '>=': return a >= b;
        }
      } catch (e) { return undefined; }
      return undefined;
    }

    /** Bitwise operators: 32-bit for Numbers (ToInt32/ToUint32), full width for BigInt. */
    bitwise(op, l, r, rt, big) {
      const lt = canonicalType(l.t) || 'any';
      const rtp = canonicalType(r.t) || 'any';
      const wide = t => t === 'uint64' || t === 'int64';
      const bigOp = big || wide(rt) || isBigType(rt);
      if (bigOp) {
        // Both 64-bit: Go's own operators are exact
        if ((wide(lt) || l.isConst) && (wide(rtp) || r.isConst || op === '<<' || op === '>>') && wide(rt) && !isBigType(lt) && !isBigType(rtp)) {
          if (op === '<<' || op === '>>') {
            const shifted = new Val(G.Binary(op === '>>>' ? '>>' : op, this.coerce(l, rt), this.coerce(r, 'uint64')), rt);
            return shifted;
          }
          return new Val(G.Binary(op, this.coerce(l, rt), this.coerce(r, rt)), rt);
        }
        const fn = { '&': 'jsBigAnd', '|': 'jsBigOr', '^': 'jsBigXor', '<<': 'jsBigShl', '>>': 'jsBigShr', '>>>': 'jsBigShr' }[op];
        const args = op === '<<' || op === '>>' || op === '>>>' ? [this.coerce(l, 'bigint'), G.Conv('int', this.coerce(r, 'int64'))] : [this.coerce(l, 'bigint'), this.coerce(r, 'bigint')];
        const res = new Val(G.Call(G.Ident(fn), args), 'bigint');
        return rt && !isBigType(rt) ? new Val(this.coerce(res, rt), rt) : res;
      }
      // Number operators: ToInt32 of both operands
      let a = this.toInt32Bits(l, op === '>>>' ? 'uint32' : 'int32');
      if (op === '<<' || op === '>>' || op === '>>>') {
        // An untyped constant shifted by a variable takes its type from the context: give it its own
        if (l.isConst) a = G.Conv(op === '>>>' ? 'uint32' : 'int32', a);
        const count = r.isConst ? G.Lit(String((Number(r.c) >>> 0) & 31)) : G.Binary('&', this.toInt32Bits(r, 'uint32'), G.Lit('31'));
        const res = new Val(G.Binary(op === '>>>' ? '>>' : op, a, count), op === '>>>' ? 'uint32' : 'int32');
        return rt && rt !== res.t ? new Val(this.coerce(res, rt), rt) : res;
      }
      const res = new Val(G.Binary(op, this.toInt32Bits(l, 'int32'), this.toInt32Bits(r, 'int32')), 'int32');
      return rt && rt !== 'int32' ? new Val(this.coerce(res, rt), rt) : res;
    }

    /** A 32-bit operand of a Number bitwise operator (JavaScript's ToInt32/ToUint32). */
    toInt32Bits(v, as) {
      const t = canonicalType(v.t) || 'any';
      if (v.isConst) {
        const n = typeof v.c === 'bigint' ? Number(BigInt.asIntN(32, v.c)) : (Number(v.c) | 0);
        return G.Lit(String(as === 'uint32' ? n >>> 0 : n));
      }
      if (t === as) return v.e;
      if (isIntType(t)) return G.Conv(as, v.e);
      if (isFloatType(t)) return G.Conv(as, G.Call(G.Ident('jsToInt32'), [v.e]));
      return G.Conv(as, this.coerce(v, 'int32'));
    }

    power(l, r, rt) {
      const lt = canonicalType(l.t) || 'any';
      if (isBigType(lt) || isBigType(rt) || typeof l.c === 'bigint') {
        const res = new Val(G.Call(G.Ident('jsBigPow'), [this.coerce(l, 'bigint'), this.coerce(r, 'bigint')]), 'bigint');
        return rt && !isBigType(rt) ? new Val(this.coerce(res, rt), rt) : res;
      }
      const p = new Val(G.Call(G.Selector(G.Ident('math'), 'Pow'), [this.coerce(l, 'float64'), this.coerce(r, 'float64')]), 'float64');
      return rt && !isFloatType(rt) && isNumericType(rt) ? new Val(this.coerce(p, rt), rt) : p;
    }

    equality(op, l, r) {
      const neg = op === '!==' || op === '!=';
      const lt = canonicalType(l.t) || 'any';
      const rtp = canonicalType(r.t) || 'any';
      const isNullV = v => v.t === 'null' || (v.isConst && v.c === null);
      let e;
      if (isNullV(l) || isNullV(r)) {
        const other = isNullV(l) ? r : l;
        if (isNullV(other)) e = G.Lit('true');
        else {
          const g = this.goType(other.t);
          if (g === 'any' || g === 'JsObject') e = G.Call(G.Ident('jsIsNull'), [other.e]);
          else if (g.startsWith('[]') || g.startsWith('*') || g.startsWith('map')) e = G.Binary('==', other.e, G.Lit('nil'));
          else e = G.Lit('false'); // a value type is never null
        }
      } else if (isBigType(lt) || isBigType(rtp)) {
        e = G.Binary('==', G.Call(G.Ident('jsBigCmp'), [this.coerce(l, 'bigint'), this.coerce(r, 'bigint')]), G.Lit('0'));
      } else if (isNumericType(lt) && isNumericType(rtp)) {
        const w = this.widen(lt, rtp);
        e = G.Binary('==', this.coerce(l, w), this.coerce(r, w));
      } else if (lt === 'string' && rtp === 'string') {
        e = G.Binary('==', l.e, r.e);
      } else if (lt === 'boolean' && rtp === 'boolean') {
        e = G.Binary('==', l.e, r.e);
      } else if ((lt === 'string' && r.isConst) || (rtp === 'string' && l.isConst)) {
        e = G.Binary('==', this.coerce(l, 'string'), this.coerce(r, 'string'));
      } else if (isNumericType(lt) && r.isConst && typeof r.c === 'number') {
        e = G.Binary('==', l.e, this.coerce(r, lt));
      } else if (isNumericType(rtp) && l.isConst && typeof l.c === 'number') {
        e = G.Binary('==', this.coerce(l, rtp), r.e);
      } else {
        e = G.Call(G.Ident(op.length === 3 || op === '!==' ? 'jsStrictEquals' : 'jsLooseEquals'), [this.coerce(l, 'any'), this.coerce(r, 'any')]);
      }
      return new Val(neg ? G.Unary('!', e.kind === 'Binary' ? G.Paren(e) : e) : e, 'boolean');
    }

    compare(op, l, r) {
      const lt = canonicalType(l.t) || 'any';
      const rtp = canonicalType(r.t) || 'any';
      if (isBigType(lt) || isBigType(rtp)) {
        return new Val(G.Binary(op, G.Call(G.Ident('jsBigCmp'), [this.coerce(l, 'bigint'), this.coerce(r, 'bigint')]), G.Lit('0')), 'boolean');
      }
      if (lt === 'string' && rtp === 'string') return new Val(G.Binary(op, l.e, r.e), 'boolean');
      let w;
      if (isNumericType(lt) && isNumericType(rtp)) w = this.widen(lt, rtp);
      else if (isNumericType(lt) && r.isConst) w = lt;
      else if (isNumericType(rtp) && l.isConst) w = rtp;
      else w = 'float64';
      // A constant that does not fit the operand type compares as float
      if (w !== 'float64' && ((l.isConst && !this.fits(l.c, w)) || (r.isConst && !this.fits(r.c, w)))) w = 'float64';
      return new Val(G.Binary(op, this.coerce(l, w), this.coerce(r, w)), 'boolean');
    }

    fits(c, t) {
      if (typeof c !== 'number' || !Number.isInteger(c)) return typeof c === 'bigint' ? true : false;
      const bits = intBits(t);
      if (!bits) return true;
      const min = isSignedInt(t) ? -(2 ** (bits - 1)) : 0;
      const max = isSignedInt(t) ? 2 ** (bits - 1) - 1 : 2 ** bits - 1;
      return c >= min && c <= max;
    }

    instanceOf(l, r) {
      const cls = r.classRef;
      if (!cls) {
        const name = r.e && r.e.kind === 'Call' ? null : null;
        void name;
        return new Val(G.Call(G.Ident('jsInstanceOfBuiltin'), [this.coerce(l, 'any'), G.Lit(this.goString('Error'))]), 'boolean');
      }
      // Every emitted class that is (or derives from) it
      const names = [...this.emittedClasses].filter(n => this.model.classes.get(n).isA(cls.name)).map(n => '*' + this.className(n));
      if (!names.length) return new Val(G.Lit('false'), 'boolean');
      const v = this.tmp('i');
      const cases = names.map(n => ({ exprs: [G.Ident(n)], body: [G.Return(G.Lit('true'))] }));
      const sw = { kind: 'Raw', code: '' };
      void sw;
      const body = [G.Raw(`switch ${v}.(type) {\ncase ${names.join(', ')}:\n\treturn true\n}`), G.Return(G.Lit('false'))];
      void cases;
      return new Val(G.Call(G.FuncLit([{ name: v, type: 'any' }], [{ type: 'bool' }], G.Block(body)), [this.coerce(l, 'any')]), 'boolean');
    }

    xLogicalExpression(node) {
      let rt = canonicalType(node.resultType) || 'any';
      const op = node.operator;
      // a || b yields one of its operands: when both have one non-boolean type, that is its type
      const lt0 = canonicalType(node.left.resultType);
      const rt0 = canonicalType(node.right.resultType);
      if (rt === 'boolean' && op !== '??' && lt0 && lt0 === rt0 && lt0 !== 'boolean' && lt0 !== 'any') rt = lt0;
      if (rt === 'boolean' && op !== '??') {
        const a = this.condition(node.left);
        const preA = this.flushPre();
        const b = this.condition(node.right);
        const preB = this.flushPre();
        this.fn.pre.push(...preA);
        const right = preB.length ? this.iife([...preB, G.Return(b)], 'boolean') : b;
        return new Val(G.Binary(op === '&&' ? '&&' : '||', a, right), 'boolean');
      }
      // A value: func() T { a := left; if <a is the answer> { return a }; return right }()
      const left = this.expr(node.left);
      const preA = this.flushPre();
      const right = this.expr(node.right);
      const preB = this.flushPre();
      const t = rt;
      const tmp = this.tmp('l');
      const leftVal = new Val(G.Ident(tmp), left.t);
      let keepLeft;
      if (op === '||') keepLeft = this.truthy(leftVal);
      else if (op === '&&') keepLeft = G.Unary('!', this.truthy(leftVal));
      else keepLeft = G.Unary('!', G.Call(G.Ident('jsIsNull'), [this.coerce(leftVal, 'any')]));
      this.fn.pre.push(...preA);
      const stmts = [G.Assign(G.Ident(tmp), ':=', left.e), G.If(keepLeft, G.Block([G.Return(this.coerce(leftVal, t))])), ...preB, G.Return(this.coerce(right, t))];
      return new Val(this.iife(stmts, t), t);
    }

    xConditionalExpression(node) {
      const rt = this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable);
      const cond = this.condition(node.test);
      const pre = this.flushPre();
      this.fn.pre.push(...pre);
      const a = this.expr(node.consequent);
      const preA = this.flushPre();
      const b = this.expr(node.alternate);
      const preB = this.flushPre();
      const ca = this.coerce(a, rt);
      const cb = this.coerce(b, rt);
      if (!preA.length && !preB.length && this.isSimple(ca) && this.isSimple(cb)) {
        return new Val(G.Call(G.Index(G.Ident('jsIf'), G.Ident(this.goType(rt))), [cond, ca, cb]), rt);
      }
      return new Val(this.iife([G.If(cond, G.Block([...preA, G.Return(ca)])), ...preB, G.Return(cb)], rt), rt);
    }

    /** An expression that cannot fail or have effects (safe to evaluate eagerly). */
    isSimple(e) {
      if (e.kind === 'Lit' || e.kind === 'Ident') return true;
      if (e.kind === 'Conv') return this.isSimple(e.operand);
      if (e.kind === 'Selector') return e.operand.kind === 'Ident';
      if (e.kind === 'Unary') return this.isSimple(e.operand);
      if (e.kind === 'Binary') return !['/', '%'].includes(e.op) && this.isSimple(e.left) && this.isSimple(e.right);
      return false;
    }

    xUnaryExpression(node) {
      const op = node.operator;
      if (op === '++' || op === '--') return this.xUpdateExpression(Object.assign({}, node, { type: 'UpdateExpression', prefix: node.prefix !== false }));
      const rt = canonicalType(node.resultType);
      if (op === 'typeof') return this.typeOf(node.argument);
      if (op === 'delete') return this.xDeleteExpression(node);
      const v = this.expr(node.argument);
      if (op === '!') {
        if (v.isConst) return new Val(null, 'boolean', !v.c);
        const c = this.truthy(v);
        return new Val(G.Unary('!', c.kind === 'Binary' ? G.Paren(c) : c), 'boolean');
      }
      if (op === 'void') { this.fn.pre.push(this.exprStmt(v)); return new Val(G.Lit('nil'), 'null', null); }
      const t = canonicalType(v.t) || 'any';
      if (v.isConst && (typeof v.c === 'number' || typeof v.c === 'bigint')) {
        if (op === '-') return new Val(null, rt || v.t, -v.c);
        if (op === '+') return new Val(null, rt || 'float64', Number(v.c));
        if (op === '~') return new Val(null, rt || 'int32', ~v.c);
      }
      if (op === '-') {
        if (isBigType(t) || isBigType(rt)) return new Val(G.Call(G.Ident('jsBigNeg'), [this.coerce(v, 'bigint')]), 'bigint');
        const target = rt && isNumericType(rt) ? rt : (isNumericType(t) ? t : 'float64');
        return new Val(G.Unary('-', this.coerce(v, target)), target);
      }
      if (op === '+') {
        const target = rt && isNumericType(rt) ? rt : 'float64';
        return new Val(this.coerce(v, target), target);
      }
      if (op === '~') {
        if (isBigType(t) || isBigType(rt) || ((t === 'uint64' || t === 'int64') && (rt === 'uint64' || rt === 'int64'))) {
          if (!isBigType(t) && !isBigType(rt)) return new Val(G.Unary('^', this.coerce(v, rt)), rt);
          const res = new Val(G.Call(G.Ident('jsBigNot'), [this.coerce(v, 'bigint')]), 'bigint');
          return rt && !isBigType(rt) ? new Val(this.coerce(res, rt), rt) : res;
        }
        const res = new Val(G.Unary('^', this.toInt32Bits(v, 'int32')), 'int32');
        return rt && rt !== 'int32' ? new Val(this.coerce(res, rt), rt) : res;
      }
      throw new Error(`unary ${op}`);
    }

    typeOf(arg) {
      const v = this.expr(arg);
      const t = canonicalType(v.t) || 'any';
      const known = isNumericType(t) ? 'number' : isBigType(t) ? 'bigint' : t === 'string' ? 'string' : t === 'boolean' ? 'boolean'
        : t === 'function' ? null : (isArrayType(t) || this.isLeafClass(t)) ? 'object' : null;
      if (known) return new Val(null, 'string', known);
      return new Val(G.Call(G.Ident('jsTypeOf'), [this.coerce(v, 'any')]), 'string');
    }

    xTypeOfExpression(node) { return this.typeOf(node.argument); }

    xDeleteExpression(node) {
      const arg = node.argument;
      if (arg.type === 'MemberExpression') {
        const obj = this.expr(arg.object);
        const key = arg.computed ? G.Call(G.Ident('jsKey'), [this.coerce(this.expr(arg.property), 'any')]) : G.Lit(this.goString(arg.property.name));
        return new Val(G.Call(G.Ident('jsDelete'), [this.coerce(obj, 'any'), key]), 'boolean');
      }
      return new Val(null, 'boolean', true);
    }

    xUpdateExpression(node) {
      const r = this.update(node, true);
      this.fn.pre.push(...r.stmts);
      return r.value;
    }

    xAssignmentExpression(node) {
      const r = this.assignment(node, true);
      this.fn.pre.push(...r.stmts);
      return r.value;
    }

    xSequenceExpression(node) {
      const list = node.expressions;
      for (let i = 0; i < list.length - 1; ++i) this.fn.pre.push(...this.expressionStatement(list[i]));
      return this.expr(list[list.length - 1]);
    }

    /**
     * Side effects an expression needs go to fn.pre, which the enclosing
     * statement emits first. Inside a condition of && / || / ?: that would
     * change the order, so those wrap their operand's pre into a closure.
     */

    // ---------------------------------------------------------- calls

    /** Arguments coerced to the callee's parameter types, missing ones given their default. */
    callArgs(argNodes, params, selfInfo) {
      const out = [];
      const spread = argNodes.some(a => a && a.type === 'SpreadElement');
      if (spread) {
        // f(...xs): every parameter from the spread list
        const list = this.spreadList(argNodes, 'any');
        const tmp = this.tmp('s');
        this.fn.pre.push(G.Assign(G.Ident(tmp), ':=', list), G.Assign(G.Ident('_'), '=', G.Ident(tmp)));
        params.forEach((p, i) => {
          const t = this.typeOfNullable(p.type, p.nullable);
          out.push(this.coerce(new Val(G.Call(G.Ident('jsArg'), [G.Ident(tmp), G.Lit(String(i))]), 'any'), t));
        });
        return out;
      }
      params.forEach((p, i) => {
        const t = this.typeOfNullable(p.type, p.nullable);
        if (i < argNodes.length) {
          const v = this.expr(argNodes[i]);
          out.push(this.coerce(v, t));
        } else if (p.defaultValue) {
          const saved = this.fn.cls;
          if (selfInfo !== undefined) this.fn.cls = selfInfo;
          out.push(this.coerce(this.expr(p.defaultValue), t));
          this.fn.cls = saved;
        } else {
          out.push(this.zero(t));
        }
      });
      // Extra arguments are evaluated for their effects
      for (let i = params.length; i < argNodes.length; ++i) {
        const v = this.expr(argNodes[i]);
        if (!v.isConst && v.e.kind === 'Call') this.fn.pre.push(this.exprStmt(v));
      }
      return out;
    }

    /** The values of an argument or element list with spreads, as one []any (or typed) slice expression. */
    spreadList(nodes, elT) {
      const parts = [];
      let run = [];
      const goEl = this.goType(elT);
      const flush = () => { if (run.length) { parts.push(G.Composite('[]' + goEl, run)); run = []; } };
      for (const n of nodes) {
        if (n && n.type === 'SpreadElement') {
          flush();
          const v = this.expr(n.argument);
          const vt = canonicalType(v.t) || 'any';
          parts.push(isArrayType(vt) && this.goType(vt) === '[]' + goEl ? v.e : this.coerce(v, elT + '[]'));
        } else {
          run.push(this.coerce(this.expr(n), elT));
        }
      }
      flush();
      if (parts.length === 1) return parts[0].kind === 'Composite' ? parts[0] : G.Call(G.Ident('jsCopy'), [parts[0]]);
      return G.Call(G.Ident('jsConcat'), parts.length ? parts : [G.Composite('[]' + goEl, [])]);
    }

    xCallExpression(node) {
      const callee = node.callee;
      const rt = this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable);
      // f.apply(thisArg, list) and f.call(thisArg, ...args) of a global function: the call itself
      if (callee.type === 'MemberExpression' && !callee.computed && ['apply', 'call'].includes(propKey(callee.property))
        && (callee.object.type === 'MemberExpression' || (callee.object.type === 'Identifier' && !this.lookup(callee.object.name) && this.model.functions.has(callee.object.name)))) {
        const args = node.arguments || [];
        const direct = propKey(callee.property) === 'apply'
          ? (args[1] ? [{ type: 'SpreadElement', argument: args[1] }] : [])
          : args.slice(1);
        return this.xCallExpression(Object.assign({}, node, { callee: callee.object, arguments: direct }));
      }
      if (callee.type === 'Identifier') {
        const name = callee.name;
        const local = this.lookup(name);
        if (!local) {
          const special = this.globalCall(name, node, rt);
          if (special) return special;
        }
        const fv = this.xIdentifier(callee);
        if (fv.sig) {
          const args = this.callArgs(node.arguments || [], fv.sig.params);
          const ret = fv.sig.ret.type;
          return new Val(G.Call(fv.e, args), ret);
        }
        if (fv.classRef) return this.newObject(fv.classRef, node.arguments || []);
        const args = (node.arguments || []).map(a => this.coerce(this.expr(a), 'any'));
        return new Val(G.Call(G.Ident('jsCallFunc'), [this.coerce(fv, 'any'), ...args]), 'any');
      }
      if (callee.type === 'MemberExpression' && !callee.computed) {
        const key = callee.property.name || callee.property.value;
        if (callee.object.type === 'Identifier' && !this.lookup(callee.object.name)) {
          const special = this.globalMethodCall(callee.object.name, key, node, rt);
          if (special) return special;
          const info = this.model.classes.get(callee.object.name);
          if (info && !this.model.variables.has(callee.object.name)) {
            for (let c = info; c; c = c.base) {
              const sm = c.staticMethods.get(key);
              if (sm) {
                const params = Model.functionParams(sm.fn, sm.jsDoc);
                return new Val(G.Call(G.Ident(this.staticName(c.name, key)), this.callArgs(node.arguments || [], params)), this.signatureReturn(sm.fn, sm.jsDoc).type);
              }
            }
          }
        }
        const obj = this.expr(callee.object);
        return this.methodCall(obj, key, node.arguments || [], rt, node);
      }
      if (callee.type === 'MemberExpression' && callee.computed) {
        const obj = this.expr(callee.object);
        const key = this.expr(callee.property);
        const args = (node.arguments || []).map(a => this.coerce(this.expr(a), 'any'));
        return new Val(G.Call(G.Selector(this.coerce(obj, 'object'), 'JsCall'), [G.Call(G.Ident('jsKey'), [this.coerce(key, 'any')]), ...args]), 'any');
      }
      // (expr)(args): a function value
      const f = this.expr(callee);
      if (f.sig) return new Val(G.Call(f.e, this.callArgs(node.arguments || [], f.sig.params)), f.sig.ret.type);
      const args = (node.arguments || []).map(a => this.coerce(this.expr(a), 'any'));
      return new Val(G.Call(G.Ident('jsCallFunc'), [this.coerce(f, 'any'), ...args]), 'any');
    }

    /** Calls of JavaScript globals that reach the IL unlowered. */
    globalCall(name, node, rt) {
      const args = node.arguments || [];
      const a = i => this.expr(args[i]);
      switch (name) {
        case 'RegisterAlgorithm':
          return new Val(G.Call(G.Ident('jsRegisterAlgorithm'), [this.coerce(a(0), 'object')]), 'void');
        case 'Number': {
          if (!args.length) return new Val(null, 'float64', 0);
          const v = a(0);
          const vt = canonicalType(v.t);
          const target = rt && isNumericType(rt) ? rt : 'float64';
          if (isBigType(vt)) return new Val(this.coerce(new Val(G.Call(G.Ident('jsBigToF64'), [v.e]), 'float64'), target), target);
          if (vt === 'string') return new Val(this.coerce(new Val(G.Call(G.Ident('jsToNumber'), [v.e]), 'float64'), target), target);
          return new Val(this.coerce(v, target), target);
        }
        case 'BigInt': {
          const v = a(0);
          const vt = canonicalType(v.t);
          if (vt === 'string') return new Val(G.Call(G.Ident('jsBigParse'), [v.e]), 'bigint');
          return new Val(this.coerce(v, 'bigint'), 'bigint');
        }
        case 'String': return new Val(this.coerce(a(0), 'string'), 'string');
        case 'Boolean': return new Val(this.truthy(a(0)), 'boolean');
        case 'parseInt': {
          const s = this.coerce(a(0), 'string');
          const radix = args[1] ? this.coerce(a(1), 'goint') : G.Lit('10');
          const v = new Val(G.Call(G.Ident('jsParseInt'), [s, radix]), 'float64');
          return rt && isNumericType(rt) && !isFloatType(rt) ? new Val(this.coerce(v, rt), rt) : v;
        }
        case 'parseFloat': return new Val(G.Call(G.Ident('jsToNumber'), [this.coerce(a(0), 'string')]), 'float64');
        case 'isNaN': return new Val(G.Call(G.Selector(G.Ident('math'), 'IsNaN'), [this.coerce(a(0), 'float64')]), 'boolean');
        case 'isFinite': return new Val(G.Call(G.Ident('jsIsFinite'), [this.coerce(a(0), 'float64')]), 'boolean');
        case 'Error': case 'TypeError': case 'RangeError':
          return new Val(G.Call(G.Ident('jsNewError'), [G.Lit(this.goString(name)), args[0] ? this.coerce(a(0), 'string') : G.Lit('""')]), 'Error');
      }
      return null;
    }

    /** Calls of members of JavaScript globals (AlgorithmFramework.Find, Object.keys, Math.x, ...). */
    globalMethodCall(obj, key, node, rt) {
      const args = node.arguments || [];
      const a = i => this.expr(args[i]);
      const k = `${obj}.${key}`;
      switch (k) {
        case 'AlgorithmFramework.Find':
          return new Val(G.Call(G.Ident('jsFindAlgorithm'), [this.coerce(a(0), 'string')]), 'Algorithm');
        case 'AlgorithmFramework.RegisterAlgorithm':
          return new Val(G.Call(G.Ident('jsRegisterAlgorithm'), [this.coerce(a(0), 'object')]), 'void');
        case 'Object.keys': return new Val(G.Call(G.Ident('jsKeys'), [this.coerce(a(0), 'any')]), 'string[]');
        case 'Object.values': return new Val(G.Call(G.Ident('jsValues'), [this.coerce(a(0), 'any')]), 'any[]');
        case 'Object.entries': return new Val(G.Call(G.Ident('jsEntries'), [this.coerce(a(0), 'any')]), 'any[]');
        case 'Object.assign': return new Val(G.Call(G.Ident('jsAssign'), args.map((x, i) => this.coerce(a(i), 'any'))), canonicalType(args[0].resultType) || 'object');
        case 'Object.freeze': case 'Object.seal': { const v = a(0); return v; }
        case 'Array.isArray': return new Val(G.Call(G.Ident('jsIsArray'), [this.coerce(a(0), 'any')]), 'boolean');
        case 'ArrayBuffer.isView': return new Val(G.Call(G.Ident('jsIsArray'), [this.coerce(a(0), 'any')]), 'boolean');
        case 'Number.isInteger': return new Val(G.Call(G.Ident('jsIsInteger'), [this.coerce(a(0), 'any')]), 'boolean');
        case 'Number.isSafeInteger': return new Val(G.Call(G.Ident('jsIsInteger'), [this.coerce(a(0), 'any')]), 'boolean');
        case 'Number.isFinite': return new Val(G.Call(G.Ident('jsIsFinite'), [this.coerce(a(0), 'float64')]), 'boolean');
        case 'Number.isNaN': return new Val(G.Call(G.Selector(G.Ident('math'), 'IsNaN'), [this.coerce(a(0), 'float64')]), 'boolean');
        case 'Number.parseInt': return this.globalCall('parseInt', node, rt);
        case 'String.fromCharCode': return new Val(G.Call(G.Ident('jsFromCharCodes'), [this.spreadList(args, 'int32')]), 'string');
        case 'Math.imul': return new Val(G.Conv('int32', G.Binary('*', this.toInt32Bits(a(0), 'uint32'), this.toInt32Bits(a(1), 'uint32'))), 'int32');
        case 'BigInt.asUintN': return this.bigAsN(a(0), a(1), false, rt);
        case 'BigInt.asIntN': return this.bigAsN(a(0), a(1), true, rt);
        case 'JSON.stringify': return new Val(G.Call(G.Ident('jsJSON'), [this.coerce(a(0), 'any')]), 'string');
        case 'console.log': case 'console.warn': case 'console.error': case 'console.info': case 'console.debug':
          return new Val(G.Call(G.Ident('jsLog'), args.map((x, i) => this.coerce(a(i), 'any'))), 'void');
      }
      if (obj === 'Math') return this.mathCall(key, args.map((x, i) => a(i)), rt);
      if (obj === 'OpCodes') return this.opCodesCall(key, args, rt, node);
      return null;
    }

    bigAsN(bits, v, signed, rt) {
      const res = new Val(G.Call(G.Ident(signed ? 'jsBigAsIntN' : 'jsBigAsUintN'), [this.coerce(bits, 'goint'), this.coerce(v, 'bigint')]), 'bigint');
      return rt && !isBigType(rt) && rt !== 'any' ? new Val(this.coerce(res, rt), rt) : res;
    }

    mathCall(key, args, rt) {
      const f64 = i => this.coerce(args[i], 'float64');
      const unary = { floor: 'Floor', ceil: 'Ceil', round: 'jsRound', trunc: 'Trunc', abs: 'Abs', sqrt: 'Sqrt', log: 'Log', log2: 'Log2', log10: 'Log10', exp: 'Exp', sin: 'Sin', cos: 'Cos', tan: 'Tan', tanh: 'Tanh', atan: 'Atan', sign: 'jsSign', cbrt: 'Cbrt', fround: 'jsFround', clz32: 'jsClz32', log1p: 'Log1p', expm1: 'Expm1' };
      let res;
      if (unary[key]) {
        const fn = unary[key].startsWith('js') ? G.Ident(unary[key]) : G.Selector(G.Ident('math'), unary[key]);
        res = new Val(G.Call(fn, [f64(0)]), 'float64');
      } else if (key === 'pow') res = new Val(G.Call(G.Selector(G.Ident('math'), 'Pow'), [f64(0), f64(1)]), 'float64');
      else if (key === 'atan2') res = new Val(G.Call(G.Selector(G.Ident('math'), 'Atan2'), [f64(0), f64(1)]), 'float64');
      else if (key === 'min' || key === 'max') return this.minMax(key, args, rt);
      else if (key === 'random') res = new Val(G.Call(G.Ident('jsRandom'), []), 'float64');
      else if (key === 'hypot') res = new Val(G.Call(G.Selector(G.Ident('math'), 'Hypot'), [f64(0), f64(1)]), 'float64');
      else return null;
      return rt && isNumericType(rt) && !isFloatType(rt) ? new Val(this.coerce(res, rt), rt) : res;
    }

    minMax(key, args, rt) {
      const t = rt && isNumericType(rt) ? rt : 'float64';
      const allInt = args.every(v => isIntType(canonicalType(v.t)) || v.isConst) && isIntType(t);
      if (allInt && args.length >= 1) {
        // Go's min/max builtins
        return new Val(G.Call(G.Ident(key), args.map(v => this.coerce(v, t))), t);
      }
      const res = new Val(G.Call(G.Ident(key === 'min' ? 'jsMinF' : 'jsMaxF'), args.map(v => this.coerce(v, 'float64'))), 'float64');
      return isFloatType(t) ? res : new Val(this.coerce(res, t), t);
    }

    /**
     * A method call obj.key(args): direct on a concrete class, by name on an
     * object, and the JavaScript built-in methods of strings, arrays, numbers.
     */
    methodCall(obj, key, argNodes, rt, node) {
      const ot = canonicalType(obj.t) || 'any';
      const info = obj.isThis ? this.fn.cls : (this.isLeafClass(ot) ? this.model.classOf(ot) : null);
      if (info) {
        const m = info.effective.methods.get(key);
        if (m) {
          const params = Model.functionParams(m.fn, m.jsDoc);
          const ret = this.signatureReturn(m.fn, m.jsDoc);
          return new Val(G.Call(G.Selector(obj.e, this.methodName(key)), this.callArgs(argNodes, params, info)), ret.type);
        }
        if (info.effective.fields.has(key)) {
          const f = this.memberValue(obj, key, 'any');
          const args = argNodes.map(a => this.coerce(this.expr(a), 'any'));
          return new Val(G.Call(G.Ident('jsCallFunc'), [this.coerce(f, 'any'), ...args]), 'any');
        }
      }
      // Built-in methods by receiver type
      const builtin = this.builtinMethod(obj, ot, key, argNodes, rt, node);
      if (builtin) return builtin;
      const args = argNodes.map(a => this.coerce(this.expr(a), 'any'));
      if (ot === 'function' || (obj.sig && (key === 'call' || key === 'apply'))) {
        return new Val(G.Call(G.Ident('jsCallFunc'), [this.coerce(obj, 'any'), ...args.slice(1)]), 'any');
      }
      return new Val(G.Call(G.Selector(this.coerce(obj, 'object'), 'JsCall'), [G.Lit(this.goString(key)), ...args]), 'any');
    }

    /** JavaScript's own methods of strings, arrays, numbers, Maps, errors. */
    builtinMethod(obj, ot, key, argNodes, rt, node) {
      const a = i => this.expr(argNodes[i]);
      const has = i => i < argNodes.length;
      if (ot === 'string') {
        switch (key) {
          case 'charCodeAt': return new Val(G.Call(G.Ident('jsCharCodeAt'), [obj.e, has(0) ? this.coerce(a(0), 'goint') : G.Lit('0')]), 'int32');
          case 'charAt': return new Val(G.Call(G.Ident('jsCharAt'), [obj.e, has(0) ? this.coerce(a(0), 'goint') : G.Lit('0')]), 'string');
          case 'codePointAt': return new Val(G.Call(G.Ident('jsCharCodeAt'), [obj.e, this.coerce(a(0), 'goint')]), 'int32');
          case 'toUpperCase': case 'toLocaleUpperCase': return new Val(G.Call(G.Ident('jsToUpper'), [obj.e]), 'string');
          case 'toLowerCase': case 'toLocaleLowerCase': return new Val(G.Call(G.Ident('jsToLower'), [obj.e]), 'string');
          case 'trim': return new Val(G.Call(G.Selector(G.Ident('strings'), 'TrimSpace'), [obj.e]), 'string');
          case 'indexOf': return new Val(G.Call(G.Ident('jsStrIndexOf'), [obj.e, this.coerce(a(0), 'string'), has(1) ? this.coerce(a(1), 'goint') : G.Lit('0')]), 'int32');
          case 'lastIndexOf': return new Val(G.Conv('int32', G.Call(G.Selector(G.Ident('strings'), 'LastIndex'), [obj.e, this.coerce(a(0), 'string')])), 'int32');
          case 'includes': return new Val(G.Call(G.Selector(G.Ident('strings'), 'Contains'), [obj.e, this.coerce(a(0), 'string')]), 'boolean');
          case 'startsWith': return new Val(G.Call(G.Selector(G.Ident('strings'), 'HasPrefix'), [obj.e, this.coerce(a(0), 'string')]), 'boolean');
          case 'endsWith': return new Val(G.Call(G.Selector(G.Ident('strings'), 'HasSuffix'), [obj.e, this.coerce(a(0), 'string')]), 'boolean');
          case 'substring': return new Val(G.Call(G.Ident('jsSubstring'), [obj.e, this.coerce(a(0), 'goint'), has(1) ? this.coerce(a(1), 'goint') : G.Lit('-1')]), 'string');
          case 'substr': return new Val(G.Call(G.Ident('jsSubstr'), [obj.e, this.coerce(a(0), 'goint'), has(1) ? this.coerce(a(1), 'goint') : G.Lit('-1')]), 'string');
          case 'slice': return new Val(G.Call(G.Ident('jsStrSlice'), [obj.e, has(0) ? this.coerce(a(0), 'goint') : G.Lit('0'), has(1) ? this.coerce(a(1), 'goint') : G.Ident('jsNoEnd')]), 'string');
          case 'split': return new Val(G.Call(G.Ident('jsSplit'), [obj.e, has(0) ? this.coerce(a(0), 'any') : G.Lit('nil')]), 'string[]');
          case 'repeat': return new Val(G.Call(G.Selector(G.Ident('strings'), 'Repeat'), [obj.e, this.coerce(a(0), 'goint')]), 'string');
          case 'padStart': return new Val(G.Call(G.Ident('jsPadStart'), [obj.e, this.coerce(a(0), 'goint'), has(1) ? this.coerce(a(1), 'string') : G.Lit('" "')]), 'string');
          case 'padEnd': return new Val(G.Call(G.Ident('jsPadEnd'), [obj.e, this.coerce(a(0), 'goint'), has(1) ? this.coerce(a(1), 'string') : G.Lit('" "')]), 'string');
          case 'replace': case 'replaceAll': return new Val(G.Call(G.Ident(key === 'replace' ? 'jsReplace' : 'jsReplaceAll'), [obj.e, this.coerce(a(0), 'any'), this.coerce(a(1), 'any')]), 'string');
          case 'concat': return new Val(G.Binary('+', obj.e, this.coerce(a(0), 'string')), 'string');
          case 'toString': case 'valueOf': return obj;
          case 'match': return new Val(G.Call(G.Ident('jsMatch'), [obj.e, this.coerce(a(0), 'any')]), 'string[]');
          case 'normalize': return obj;
        }
      }
      if (isArrayType(ot)) {
        const el = elementType(ot);
        switch (key) {
          case 'push': {
            const items = argNodes.map((x, i) => this.coerce(a(i), el));
            const target = obj.e;
            if (!this.isAssignable(target)) return new Val(G.Conv('int32', G.Call(G.Ident('len'), [G.Call(G.Ident('append'), [target, ...items])])), 'int32');
            this.fn.pre.push(G.Assign(target, '=', G.Call(G.Ident('append'), [target, ...items])));
            return new Val(G.Conv('int32', G.Call(G.Ident('len'), [target])), 'int32');
          }
          case 'slice': return new Val(G.Call(G.Ident('jsSlice'), [obj.e, has(0) ? this.coerce(a(0), 'goint') : G.Lit('0'), has(1) ? this.coerce(a(1), 'goint') : G.Ident('jsNoEnd')]), ot);
          case 'join': return new Val(G.Call(G.Ident('jsJoin'), [obj.e, has(0) ? this.coerce(a(0), 'string') : G.Lit('","')]), 'string');
          case 'indexOf': return new Val(G.Call(this.generic('jsIndexOf', this.goType(el)), [obj.e, this.coerce(a(0), el), has(1) ? this.coerce(a(1), 'goint') : G.Lit('0')]), 'int32');
          case 'includes': return new Val(G.Binary('>=', G.Call(this.generic('jsIndexOf', this.goType(el)), [obj.e, this.coerce(a(0), el), G.Lit('0')]), G.Lit('0')), 'boolean');
          case 'reverse': return new Val(G.Call(G.Ident('jsReverse'), [obj.e]), ot);
          case 'fill': return new Val(G.Call(this.generic('jsFill', this.goType(el)), [obj.e, this.coerce(a(0), el), has(1) ? this.coerce(a(1), 'goint') : G.Lit('0'), has(2) ? this.coerce(a(2), 'goint') : G.Ident('jsNoEnd')]), ot);
          case 'concat': return new Val(G.Call(G.Ident('jsConcat'), [obj.e, ...argNodes.map((x, i) => { const v = a(i); return isArrayType(canonicalType(v.t)) ? this.coerce(v, ot) : G.Composite(this.goType(ot), [this.coerce(v, el)]); })]), ot);
          case 'pop': case 'shift': {
            if (!this.isAssignable(obj.e)) throw new Error(`${key} on a temporary array`);
            return new Val(G.Call(G.Ident(key === 'pop' ? 'jsPop' : 'jsShift'), [G.Unary('&', obj.e)]), el);
          }
          case 'unshift': {
            if (!this.isAssignable(obj.e)) throw new Error('unshift on a temporary array');
            return new Val(G.Call(this.generic('jsUnshift', this.goType(el)), [G.Unary('&', obj.e), ...argNodes.map((x, i) => this.coerce(a(i), el))]), 'int32');
          }
          case 'splice': {
            if (!this.isAssignable(obj.e)) throw new Error('splice on a temporary array');
            return new Val(G.Call(this.generic('jsSplice', this.goType(el)), [G.Unary('&', obj.e), has(0) ? this.coerce(a(0), 'goint') : G.Lit('0'), has(1) ? this.coerce(a(1), 'goint') : G.Ident('jsNoEnd'), ...argNodes.slice(2).map((x, i) => this.coerce(a(i + 2), el))]), ot);
          }
          case 'set': return new Val(G.Call(G.Ident('jsTypedSet'), [obj.e, this.coerce(a(0), ot), has(1) ? this.coerce(a(1), 'goint') : G.Lit('0')]), 'void');
          case 'subarray': return new Val(G.Call(G.Ident('jsSubarray'), [obj.e, has(0) ? this.coerce(a(0), 'goint') : G.Lit('0'), has(1) ? this.coerce(a(1), 'goint') : G.Ident('jsNoEnd')]), ot);
          case 'toString': return new Val(G.Call(G.Ident('jsJoin'), [obj.e, G.Lit('","')]), 'string');
          case 'map': case 'filter': case 'forEach': case 'some': case 'every': case 'find': case 'findIndex': case 'reduce': case 'sort':
            return this.arrayCallback(obj, ot, key, argNodes, rt);
        }
      }
      if (isNumericType(ot) || isBigType(ot)) {
        if (key === 'toString') {
          if (isBigType(ot)) return new Val(G.Call(G.Ident('jsBigToString'), [obj.e, has(0) ? this.coerce(a(0), 'goint') : G.Lit('10')]), 'string');
          // An integer prints exactly (a 64-bit BigInt held as uint64 has no float form)
          if (isIntType(ot)) return new Val(G.Call(G.Selector(G.Ident('strconv'), isSignedInt(ot) ? 'FormatInt' : 'FormatUint'), [G.Conv(isSignedInt(ot) ? 'int64' : 'uint64', obj.e), has(0) ? this.coerce(a(0), 'goint') : G.Lit('10')]), 'string');
          return new Val(G.Call(G.Ident('jsNumToString'), [this.coerce(obj, 'float64'), has(0) ? this.coerce(a(0), 'goint') : G.Lit('10')]), 'string');
        }
        if (key === 'toFixed') return new Val(G.Call(G.Ident('jsToFixed'), [this.coerce(obj, 'float64'), has(0) ? this.coerce(a(0), 'goint') : G.Lit('0')]), 'string');
      }
      if (ot === 'Map') {
        switch (key) {
          case 'get': return new Val(G.Call(G.Selector(obj.e, 'MapGet'), [this.coerce(a(0), 'any')]), 'any');
          case 'set': return new Val(G.Call(G.Selector(obj.e, 'MapSet'), [this.coerce(a(0), 'any'), this.coerce(a(1), 'any')]), 'Map');
          case 'has': return new Val(G.Call(G.Selector(obj.e, 'MapHas'), [this.coerce(a(0), 'any')]), 'boolean');
          case 'delete': return new Val(G.Call(G.Selector(obj.e, 'MapDelete'), [this.coerce(a(0), 'any')]), 'boolean');
          case 'clear': return new Val(G.Call(G.Selector(obj.e, 'MapClear'), []), 'void');
          case 'keys': return new Val(G.Call(G.Selector(obj.e, 'MapKeys'), []), 'any[]');
          case 'values': return new Val(G.Call(G.Selector(obj.e, 'MapValues'), []), 'any[]');
          case 'add': return new Val(G.Call(G.Selector(obj.e, 'MapSet'), [this.coerce(a(0), 'any'), this.coerce(a(0), 'any')]), 'Map');
        }
      }
      if (key === 'toString' && argNodes.length === 0) return new Val(G.Call(G.Ident('jsStr'), [this.coerce(obj, 'any')]), 'string');
      if (key === 'hasOwnProperty') return new Val(G.Call(G.Ident('jsIn'), [this.coerce(a(0), 'any'), this.coerce(obj, 'any')]), 'boolean');
      return null;
    }

    /** map/filter/forEach/... with a callback: a loop the callback's closure is applied in. */
    arrayCallback(obj, ot, key, argNodes, rt) {
      const el = elementType(ot);
      const cb = this.callbackValue(argNodes[0], [el, 'int32', ot]);
      if (!cb) throw new Error(`array ${key} with a callback that is not a function literal`);
      const fnE = cb.e;
      switch (key) {
        case 'map': {
          const outEl = isArrayType(rt) ? elementType(rt) : cb.ret;
          return new Val(G.Call(G.Ident('jsMap'), [obj.e, this.adaptCallback(cb, [el, 'int32'], outEl)]), (outEl || 'any') + '[]');
        }
        case 'filter': return new Val(G.Call(G.Ident('jsFilter'), [obj.e, this.adaptCallback(cb, [el, 'int32'], 'boolean')]), ot);
        case 'forEach': return new Val(G.Call(G.Ident('jsForEach'), [obj.e, this.adaptCallback(cb, [el, 'int32'], 'void')]), 'void');
        case 'some': return new Val(G.Call(G.Ident('jsSome'), [obj.e, this.adaptCallback(cb, [el, 'int32'], 'boolean')]), 'boolean');
        case 'every': return new Val(G.Call(G.Ident('jsEvery'), [obj.e, this.adaptCallback(cb, [el, 'int32'], 'boolean')]), 'boolean');
        case 'find': return new Val(G.Call(G.Ident('jsFind'), [obj.e, this.adaptCallback(cb, [el, 'int32'], 'boolean')]), el);
        case 'findIndex': return new Val(G.Call(G.Ident('jsFindIndex'), [obj.e, this.adaptCallback(cb, [el, 'int32'], 'boolean')]), 'int32');
        case 'sort': return new Val(G.Call(G.Ident('jsSort'), [obj.e, this.adaptCallback(cb, [el, el], 'float64')]), ot);
        case 'reduce': {
          const accT = rt && rt !== 'any' ? rt : (cb.ret || 'any');
          const init = argNodes[1] ? this.coerce(this.expr(argNodes[1]), accT) : this.zero(accT);
          return new Val(G.Call(G.Ident('jsReduce'), [obj.e, this.adaptCallback(cb, [accT, el, 'int32'], accT), init]), accT);
        }
      }
      void fnE;
      return null;
    }

    /** A function literal argument transformed with the parameter types its caller gives it. */
    callbackValue(node, paramTypes) {
      if (!node || !['ArrowFunction', 'ArrowFunctionExpression', 'FunctionExpression'].includes(node.type)) return null;
      const v = this.funcLit(node, node.jsDoc);
      v.ret = v.sig.ret.type;
      return v;
    }

    /** Wrap a closure so its signature is exactly func(paramTypes...) retType. */
    adaptCallback(cb, paramTypes, retType) {
      const params = cb.sig.params;
      const goParams = paramTypes.map((t, i) => ({ name: `jsA${i}`, type: this.goType(t) }));
      const args = params.map((p, i) => i < paramTypes.length
        ? this.coerce(new Val(G.Ident(`jsA${i}`), paramTypes[i]), this.typeOfNullable(p.type, p.nullable))
        : this.zero(p.type));
      const tmp = 'jsCb';
      const call = G.Call(G.Ident(tmp), args);
      const body = [G.Assign(G.Ident(tmp), ':=', cb.e)];
      for (let i = 0; i < paramTypes.length; ++i) body.push(G.Assign(G.Ident('_'), '=', G.Ident(`jsA${i}`)));
      if (retType === 'void') body.push(G.ExprStmt(call));
      else if (cb.sig.ret.type === 'void') body.push(G.ExprStmt(call), G.Return(this.zero(retType)));
      else body.push(G.Return(this.coerce(new Val(call, cb.sig.ret.type), retType)));
      return G.FuncLit(goParams, retType === 'void' ? [] : [{ type: this.goType(retType) }], G.Block(body));
    }

    xThisMethodCall(node) {
      const self = this.thisValue();
      const rt = this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable);
      return this.methodCall(self, node.method, node.arguments || [], rt, node);
    }

    xParentMethodCall(node) {
      const info = this.fn.cls;
      const owner = this.fn.initOf || null;
      void owner;
      // super.m(): the version of m the base chain of the current method's class has
      const methodOwner = this.fn.methodOwner || info;
      let base = methodOwner && methodOwner.base;
      let m = null;
      for (let c = base; c && !m; c = c.base) m = c.methods.get(node.method) || null;
      if (!m) throw new Error(`super.${node.method} has no base method`);
      const key = `jsSuper_${m.owner.name}_${node.method}`;
      if (!this.superCopies.has(key)) this.superCopies.set(key, { cls: info, fn: m.fn, jsDoc: m.jsDoc });
      const params = Model.functionParams(m.fn, m.jsDoc);
      return new Val(G.Call(G.Selector(G.Ident('this'), key), this.callArgs(node.arguments || [], params)), this.signatureReturn(m.fn, m.jsDoc).type);
    }

    xParentConstructorCall(node) {
      this.fn.pre.push(...this.parentConstructorCall(node));
      return new Val(G.Lit('nil'), 'void');
    }

    xNewExpression(node) {
      const callee = node.callee;
      // new AlgorithmFramework.X(...) is new X(...)
      const name = callee && (callee.name || (callee.type === 'MemberExpression' && callee.object && callee.object.name === 'AlgorithmFramework' ? propKey(callee.property) : null));
      const rt = canonicalType(node.resultType) || 'any';
      const args = node.arguments || [];
      if (name && this.model.classes.has(name) && this.emittedClasses.has(name)) return this.newObject(this.model.classes.get(name), args);
      switch (name) {
        case 'Error': case 'TypeError': case 'RangeError': case 'SyntaxError':
          return new Val(G.Call(G.Ident('jsNewError'), [G.Lit(this.goString(name)), args[0] ? this.coerce(this.expr(args[0]), 'string') : G.Lit('""')]), 'Error');
        case 'Array': {
          const el = isArrayType(rt) ? elementType(rt) : 'any';
          if (args.length === 1) {
            const n = this.expr(args[0]);
            if (isNumericType(canonicalType(n.t))) return new Val(G.Call(G.Ident('make'), [G.Ident(this.goType(el + '[]')), this.coerce(n, 'goint')]), el + '[]');
          }
          return new Val(G.Composite(this.goType(el + '[]'), args.map(a => this.coerce(this.expr(a), el))), el + '[]');
        }
        case 'Map': case 'Set': return new Val(G.Call(G.Ident('jsNewMap'), []), 'Map');
        case 'Object': return new Val(G.Call(G.Ident('jsNewMap'), []), 'object');
      }
      if (/^(Uint8|Int8|Uint16|Int16|Uint32|Int32|Float32|Float64|Uint8Clamped|BigUint64|BigInt64)Array$/.test(name || '')) {
        return this.typedArray(rt, args[0]);
      }
      if (name && this.model.classes.has(name)) throw new Error(`new ${name}: the class is abstract here`);
      this.warnings.push(`new ${name}`);
      return new Val(G.Call(G.Ident('jsUnsupported'), [G.Lit(this.goString('new ' + name))]), rt);
    }

    newObject(info, args) {
      const chain = info.chain();
      const ctorOwner = [...chain].reverse().find(c => c.ctor) || null;
      const params = ctorOwner ? Model.functionParams(ctorOwner.ctor, ctorOwner.ctorDoc) : [];
      return new Val(G.Call(G.Ident('New' + this.className(info.name)), this.callArgs(args, params)), info.name);
    }

    typedArray(rt, arg) {
      const t = isArrayType(rt) ? rt : 'uint8[]';
      if (!arg) return new Val(G.Composite(this.goType(t), []), t);
      const v = this.expr(arg);
      const vt = canonicalType(v.t) || 'any';
      if (isNumericType(vt)) return new Val(G.Call(G.Ident('make'), [G.Ident(this.goType(t)), this.coerce(v, 'goint')]), t);
      if (isArrayType(vt)) {
        if (this.goType(vt) === this.goType(t)) return new Val(G.Call(G.Ident('jsCopy'), [v.e]), t);
        return new Val(this.coerce(v, t), t);
      }
      return new Val(G.Call(G.Index(G.Ident('jsTypedFrom'), G.Ident(this.goType(elementType(t)))), [this.coerce(v, 'any')]), t);
    }

    // ---------------------------------------------------------- literals

    xArrayExpression(node) {
      const rt = canonicalType(node.resultType) || 'any[]';
      const t = isArrayType(rt) ? rt : 'any[]';
      const el = elementType(t);
      const elems = node.elements || [];
      if (elems.some(e => e && e.type === 'SpreadElement')) return new Val(this.spreadList(elems, el), t);
      return new Val(G.Composite(this.goType(t), elems.map(e => e ? this.coerce(this.expr(e), el) : this.zero(el))), t);
    }

    xArrayLiteral(node) { return this.xArrayExpression(node); }

    xObjectLiteral(node) {
      const args = [];
      for (const p of node.properties || []) {
        if (p.type === 'SpreadElement' || p.type === 'SpreadProperty') {
          args.push(G.Lit('"..."'), this.coerce(this.expr(p.argument), 'any'));
          continue;
        }
        const key = p.computed ? this.coerce(this.expr(p.key), 'any') : G.Lit(this.goString(propKey(p.key)));
        let value;
        if (p.value && ['FunctionExpression', 'ArrowFunction', 'ArrowFunctionExpression'].includes(p.value.type)) value = this.funcLit(p.value, p.value.jsDoc).e;
        else value = this.anyOf(this.expr(p.value));
        args.push(p.computed ? G.Call(G.Ident('jsKey'), [key]) : key, value);
      }
      const rt = canonicalType(node.resultType) || 'object';
      return new Val(G.Call(G.Ident('jsMapOf'), args), rt === 'any' ? 'object' : rt);
    }

    xObjectExpression(node) { return this.xObjectLiteral(node); }

    xFunctionExpression(node) { return this.funcLit(node, node.jsDoc); }
    xArrowFunction(node) { return this.funcLit(node, node.jsDoc); }
    xArrowFunctionExpression(node) { return this.funcLit(node, node.jsDoc); }

    xSpreadElement(node) { return this.expr(node.argument); }

    xTemplateLiteral(node) {
      const parts = [];
      (node.quasis || []).forEach((q, i) => {
        const text = q.value && (q.value.cooked !== undefined ? q.value.cooked : q.value.raw);
        if (text) parts.push(G.Lit(this.goString(text)));
        if (node.expressions && node.expressions[i]) parts.push(this.coerce(this.expr(node.expressions[i]), 'string'));
      });
      if (!parts.length) return new Val(null, 'string', '');
      return new Val(parts.reduce((a, b) => G.Binary('+', a, b)), 'string');
    }

    xStringInterpolation(node) {
      const parts = (node.parts || []).map(p => p.type === 'StringPart' ? G.Lit(this.goString(p.value)) : this.coerce(this.expr(p.expression), 'string'));
      if (!parts.length) return new Val(null, 'string', '');
      return new Val(parts.reduce((a, b) => G.Binary('+', a, b)), 'string');
    }

    // ---------------------------------------------------------- IL nodes

    xErrorCreation(node) {
      const msg = node.message ? this.coerce(this.expr(node.message), 'string') : G.Lit('""');
      return new Val(G.Call(G.Ident('jsNewError'), [G.Lit(this.goString(node.errorType || 'Error')), msg]), 'Error');
    }

    xCast(node) {
      const arg = this.expr(node.arguments[0]);
      const target = canonicalType(node.targetType === 'int' ? 'int32' : node.targetType) || canonicalType(node.resultType);
      const method = node.opCodesMethod;
      const at = canonicalType(arg.t) || 'any';
      // JavaScript's own conversion: ToUint32 is x >>> 0, ToInt is x | 0, ToByte x & 0xFF, ...
      const masks = { ToUint32: ['>>>', 0, 'uint32'], ToDWord: ['>>>', 0, 'uint32'], ToInt: ['|', 0, 'int32'], ToInt32: ['|', 0, 'int32'],
        ToByte: ['&', 0xFF, 'uint8'], ToUint8: ['&', 0xFF, 'uint8'], ToWord: ['&', 0xFFFF, 'uint16'], ToUint16: ['&', 0xFFFF, 'uint16'] };
      if (masks[method] && !isBigType(at) && !(at === 'uint64' || at === 'int64') || (masks[method] && (at === 'uint64' || at === 'int64'))) {
        const [op, k, t] = masks[method];
        if (isBigType(at)) return new Val(this.coerce(new Val(G.Call(G.Ident('jsBigAsUintN'), [G.Lit('32'), arg.e]), 'bigint'), target || t), target || t);
        const r = this.bitwise(op, arg, new Val(null, 'int32', k), t, false);
        return target && target !== r.t ? new Val(this.coerce(r, target), target) : r;
      }
      if (method === 'ToQWord') {
        if (isBigType(at)) return new Val(G.Call(G.Ident('jsBigToU64'), [G.Call(G.Ident('jsBigAsUintN'), [G.Lit('64'), arg.e])]), 'uint64');
        if (isFloatType(at)) return new Val(G.Conv('uint64', G.Call(G.Ident('jsF2I'), [arg.e])), 'uint64');
        return new Val(this.coerce(arg, 'uint64'), 'uint64');
      }
      if (method === 'ToLong' || method === 'ToShort' || method === 'ToChar' || method === 'ToSByte') {
        return new Val(this.coerce(arg, target), target);
      }
      return new Val(this.coerce(arg, target || 'any'), target || 'any');
    }

    xBigIntCast(node) {
      const v = this.expr(node.argument);
      const rt = canonicalType(node.resultType) || 'bigint';
      const vt = canonicalType(v.t);
      if (vt === 'string') return new Val(G.Call(G.Ident('jsBigParse'), [v.e]), 'bigint');
      if (v.isConst && typeof v.c === 'number') return new Val(null, rt, BigInt(Math.trunc(v.c)));
      return new Val(this.coerce(v, rt), rt);
    }

    xHexDecode(node) {
      const v = this.expr(node.arguments[0]);
      const rt = canonicalType(node.resultType) || 'uint8[]';
      const fn = { Hex8ToBytes: 'jsHex8ToBytes', Hex16ToWords: 'jsHex16ToWords', Hex32ToDWords: 'jsHex32ToDWords', HexToBytes: 'jsHex8ToBytes' }[node.opCodesMethod] || 'jsHex8ToBytes';
      const natural = fn === 'jsHex32ToDWords' ? 'uint32[]' : fn === 'jsHex16ToWords' ? 'uint16[]' : 'uint8[]';
      const res = new Val(G.Call(G.Ident(fn), [this.coerce(v, 'string')]), natural);
      return rt === natural ? res : new Val(this.coerce(res, rt), rt);
    }

    xStringToBytes(node) {
      const v = this.expr(node.arguments[0]);
      const fn = { AnsiToBytes: 'jsAnsiToBytes', AsciiToBytes: 'jsAsciiToBytes', Utf8ToBytes: 'jsUtf8ToBytes', StringToBytes: 'jsAsciiToBytes' }[node.opCodesMethod] || (node.encoding === 'utf8' ? 'jsUtf8ToBytes' : 'jsAsciiToBytes');
      return new Val(G.Call(G.Ident(fn), [this.coerce(v, 'string')]), 'uint8[]');
    }

    xBytesToString(node) {
      const v = this.expr(node.arguments[0]);
      const fn = { BytesToAnsi: 'jsBytesToAnsi', BytesToAscii: 'jsBytesToAscii', BytesToUtf8: 'jsBytesToUtf8', BytesToString: 'jsBytesToAscii' }[node.opCodesMethod] || 'jsBytesToAscii';
      return new Val(G.Call(G.Ident(fn), [this.coerce(v, 'uint8[]')]), 'string');
    }

    xPackBytes(node) {
      const bits = node.bits || 32;
      const le = node.endian === 'little';
      const rt = canonicalType(node.resultType) || (bits === 16 ? 'uint16' : 'uint32');
      const args = node.arguments || [];
      const n = bits / 8;
      let byteExprs;
      if (args.length === 1 || args.some(a => a.type === 'SpreadElement')) {
        const list = this.spreadList(args, 'int32');
        const tmp = this.tmp('p');
        this.fn.pre.push(G.Assign(G.Ident(tmp), ':=', list));
        byteExprs = Array.from({ length: n }, (_, i) => G.Call(G.Ident('jsByteAt'), [G.Ident(tmp), G.Lit(String(i))]));
      } else {
        byteExprs = args.map(a => {
          const v = this.expr(a);
          return this.toInt32Bits(v, 'int32');
        });
      }
      // Pack32BE: ((b0 & 0xFF) << 24 | ...) >>> 0, Pack16: without the >>> 0 (an int32)
      const order = le ? byteExprs.map((_, i) => n - 1 - i) : byteExprs.map((_, i) => i);
      let acc = null;
      const goT = bits === 64 ? 'uint64' : 'uint32';
      byteExprs.forEach((b, i) => {
        const shift = (n - 1 - order.indexOf(i)) * 8;
        let part = G.Conv(goT, G.Binary('&', b, G.Lit('0xFF')));
        if (shift) part = G.Binary('<<', part, G.Lit(String(shift)));
        acc = acc ? G.Binary('|', acc, part) : part;
      });
      const natural = bits === 16 ? 'int32' : (bits === 64 ? 'uint64' : 'uint32');
      const res = new Val(bits === 16 ? G.Conv('int32', acc) : acc, natural);
      return rt === natural ? res : new Val(this.coerce(res, rt), rt);
    }

    xUnpackBytes(node) {
      const bits = node.bits || 32;
      const le = node.endian === 'little';
      const v = this.expr(node.arguments[0]);
      const rt = canonicalType(node.resultType) || 'uint8[]';
      let res;
      if (bits === 64) {
        const vt = canonicalType(v.t);
        res = new Val(G.Call(G.Ident(le ? 'jsUnpack64LE' : 'jsUnpack64BE'), [isBigType(vt) ? G.Call(G.Ident('jsBigToU64'), [G.Call(G.Ident('jsBigAsUintN'), [G.Lit('64'), v.e])]) : this.coerce(v, 'uint64')]), 'uint8[]');
      } else {
        const w = this.toInt32Bits(v, 'uint32');
        res = new Val(G.Call(G.Ident(`jsUnpack${bits}${le ? 'LE' : 'BE'}`), [w]), 'uint8[]');
      }
      return rt === 'uint8[]' ? res : new Val(this.coerce(res, rt), rt);
    }

    xRotateLeft(node) { return this.rotate(node, true); }
    xRotateRight(node) { return this.rotate(node, false); }

    rotate(node, left) {
      const bits = node.bits || 32;
      const v = this.expr(node.value);
      const amt = this.expr(node.amount);
      const rt = canonicalType(node.resultType) || (bits === 64 ? 'uint64' : 'uint32');
      let res;
      if (bits === 64) {
        const vt = canonicalType(v.t);
        const x = isBigType(vt) ? G.Call(G.Ident('jsBigToU64'), [G.Call(G.Ident('jsBigAsUintN'), [G.Lit('64'), v.e])]) : this.coerce(v, 'uint64');
        const k = this.coerce(amt, 'goint');
        res = new Val(G.Call(G.Selector(G.Ident('bits'), 'RotateLeft64'), [x, left ? k : G.Unary('-', k)]), 'uint64');
      } else {
        const goT = bits === 8 ? 'uint8' : bits === 16 ? 'uint16' : 'uint32';
        // value masked to the width, positions masked to width-1 (OpCodes.RotL8/16/32)
        const x = bits === 32 ? this.toInt32Bits(v, 'uint32') : G.Conv(goT, this.toInt32Bits(v, 'uint32'));
        const k = amt.isConst ? G.Lit(String((Number(amt.c) | 0) & (bits - 1))) : G.Binary('&', G.Conv('int', this.toInt32Bits(amt, 'int32')), G.Lit(String(bits - 1)));
        const fn = bits === 8 ? 'RotateLeft8' : bits === 16 ? 'RotateLeft16' : 'RotateLeft32';
        res = new Val(G.Call(G.Selector(G.Ident('bits'), fn), [x, left ? k : G.Unary('-', k.kind === 'Lit' ? k : G.Paren(k))]), goT);
      }
      return rt === res.t ? res : new Val(this.coerce(res, rt), rt);
    }

    xArrayXor(node) {
      const a = this.coerce(this.expr(node.arguments[0]), 'uint8[]');
      const b = this.coerce(this.expr(node.arguments[1]), 'uint8[]');
      const rt = canonicalType(node.resultType) || 'uint8[]';
      const res = new Val(G.Call(G.Ident('jsXorArrays'), [a, b]), 'uint8[]');
      return rt === 'uint8[]' ? res : new Val(this.coerce(res, rt), rt);
    }

    xArrayClear(node) {
      const a = this.expr(node.arguments[0]);
      return new Val(G.Call(G.Ident('jsClear'), [a.e]), 'void');
    }

    xArrayAppend(node) {
      const arr = this.expr(node.array);
      const at = canonicalType(arr.t) || 'any[]';
      const el = isArrayType(at) ? elementType(at) : 'any';
      const values = node.values || (node.value ? [node.value] : []);
      const items = [];
      let spread = false;
      for (const v of values) {
        if (v && v.type === 'SpreadElement') {
          spread = true;
          items.push({ spread: true, e: this.coerce(this.expr(v.argument), at) });
        } else items.push({ e: this.coerce(this.expr(v), el) });
      }
      if (!isArrayType(at)) {
        return new Val(G.Call(G.Ident('jsPushAny'), [this.coerce(arr, 'any'), ...items.map(i => i.e)]), 'int32');
      }
      let target = arr.e;
      if (!this.isAssignable(target)) throw new Error('push onto a temporary array');
      let appended;
      if (!spread) appended = G.Call(G.Ident('append'), [target, ...items.map(i => i.e)]);
      else if (items.length === 1) appended = G.Call(G.Ident('append'), [target, items[0].e], true);
      else appended = G.Call(G.Ident('append'), [target, G.Call(G.Ident('jsConcat'), items.map(i => i.spread ? i.e : G.Composite(this.goType(at), [i.e])))], true);
      this.fn.pre.push(G.Assign(target, '=', appended));
      return new Val(G.Conv('int32', G.Call(G.Ident('len'), [target])), 'int32');
    }

    xArrayCreation(node) {
      const rt = canonicalType(node.resultType) || ((node.elementType || 'any') + '[]');
      const t = isArrayType(rt) ? rt : 'any[]';
      if (!node.size) return new Val(G.Composite(this.goType(t), []), t);
      const n = this.expr(node.size);
      return new Val(G.Call(G.Ident('make'), [G.Ident(this.goType(t)), this.coerce(n, 'goint')]), t);
    }

    xTypedArrayCreation(node) {
      const rt = canonicalType(node.resultType) || 'uint8[]';
      if (node.buffer) {
        const b = this.expr(node.buffer);
        return new Val(G.Call(G.Index(G.Ident('jsTypedFrom'), G.Ident(this.goType(elementType(rt)))), [this.coerce(b, 'any')]), rt);
      }
      return this.typedArray(rt, node.size);
    }

    xBufferCreation(node) {
      return new Val(G.Call(G.Ident('make'), [G.Ident('[]uint8'), this.coerce(this.expr(node.size), 'goint')]), 'uint8[]');
    }

    xArrayFrom(node) {
      const rt = canonicalType(node.resultType) || 'any[]';
      const t = isArrayType(rt) ? rt : 'any[]';
      const el = elementType(t);
      if (node.mapFunction) {
        const cb = this.callbackValue(node.mapFunction, []);
        if (!cb) throw new Error('Array.from with a map function that is not a literal');
        if (node.length || (node.iterable && node.iterable.type === 'ObjectLiteral')) {
          let len = node.length;
          if (!len && node.iterable && node.iterable.type === 'ObjectLiteral') {
            const p = node.iterable.properties.find(x => propKey(x.key) === 'length');
            len = p && p.value;
          }
          const n = this.coerce(this.expr(len), 'goint');
          return new Val(G.Call(G.Ident('jsFromLength'), [n, this.adaptCallback(cb, ['any', 'int32'], el)]), t);
        }
        const src = this.expr(node.iterable);
        const st = canonicalType(src.t) || 'any[]';
        const srcEl = isArrayType(st) ? elementType(st) : 'any';
        return new Val(G.Call(G.Ident('jsMap'), [isArrayType(st) ? src.e : this.coerce(src, 'any[]'), this.adaptCallback(cb, [isArrayType(st) ? srcEl : 'any', 'int32'], el)]), t);
      }
      if (node.length || (node.iterable && node.iterable.type === 'ObjectLiteral')) {
        let len = node.length;
        if (!len) {
          const p = node.iterable.properties.find(x => propKey(x.key) === 'length');
          len = p && p.value;
        }
        return new Val(G.Call(G.Ident('make'), [G.Ident(this.goType(t)), this.coerce(this.expr(len), 'goint')]), t);
      }
      const src = this.expr(node.iterable);
      const st = canonicalType(src.t) || 'any';
      if (isArrayType(st) && this.goType(st) === this.goType(t)) return new Val(G.Call(G.Ident('jsCopy'), [src.e]), t);
      if (st === 'string') return new Val(this.coerce(new Val(G.Call(G.Ident('jsStringChars'), [src.e]), 'string[]'), t), t);
      return new Val(this.coerce(src, t), t);
    }

    xArraySlice(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t) || 'any';
      const start = node.start ? this.coerce(this.expr(node.start), 'goint') : G.Lit('0');
      const end = node.end ? this.coerce(this.expr(node.end), 'goint') : G.Ident('jsNoEnd');
      if (at === 'string') return new Val(G.Call(G.Ident('jsStrSlice'), [a.e, start, end]), 'string');
      const rt = canonicalType(node.resultType) || at;
      const res = new Val(G.Call(G.Ident('jsSlice'), [isArrayType(at) ? a.e : this.coerce(a, rt), start, end]), isArrayType(at) ? at : rt);
      return this.sameGo(res.t, rt) ? res : new Val(this.coerce(res, rt), rt);
    }

    xTypedArraySubarray(node) {
      const a = this.expr(node.array);
      const start = node.begin ? this.coerce(this.expr(node.begin), 'goint') : G.Lit('0');
      const end = node.end ? this.coerce(this.expr(node.end), 'goint') : G.Ident('jsNoEnd');
      return new Val(G.Call(G.Ident('jsSubarray'), [a.e, start, end]), canonicalType(a.t));
    }

    xTypedArraySet(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t);
      const src = this.coerce(this.expr(node.source), at);
      const off = node.offset ? this.coerce(this.expr(node.offset), 'goint') : G.Lit('0');
      return new Val(G.Call(G.Ident('jsTypedSet'), [a.e, src, off]), 'void');
    }

    xArrayConcat(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t) || 'any[]';
      const t = isArrayType(at) ? at : (canonicalType(node.resultType) || 'any[]');
      const el = elementType(t);
      const parts = [this.coerce(a, t)];
      for (const x of node.arrays || []) {
        const v = this.expr(x.type === 'SpreadElement' ? x.argument : x);
        const vt = canonicalType(v.t) || 'any';
        parts.push(isArrayType(vt) ? this.coerce(v, t) : G.Composite(this.goType(t), [this.coerce(v, el)]));
      }
      return new Val(G.Call(G.Ident('jsConcat'), parts), t);
    }

    xArrayFill(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t) || canonicalType(node.resultType) || 'any[]';
      const el = isArrayType(at) ? elementType(at) : 'any';
      const start = node.start ? this.coerce(this.expr(node.start), 'goint') : G.Lit('0');
      const end = node.end ? this.coerce(this.expr(node.end), 'goint') : G.Ident('jsNoEnd');
      return new Val(G.Call(this.generic('jsFill', this.goType(el)), [a.e, this.coerce(this.expr(node.value), el), start, end]), at);
    }

    xArrayIndexOf(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t) || 'any';
      if (at === 'string') return new Val(G.Call(G.Ident('jsStrIndexOf'), [a.e, this.coerce(this.expr(node.value), 'string'), node.start ? this.coerce(this.expr(node.start), 'goint') : G.Lit('0')]), 'int32');
      const el = isArrayType(at) ? elementType(at) : 'any';
      return new Val(G.Call(this.generic('jsIndexOf', this.goType(isArrayType(at) ? el : 'any')), [isArrayType(at) ? a.e : this.coerce(a, 'any[]'), this.coerce(this.expr(node.value), isArrayType(at) ? el : 'any'), node.start ? this.coerce(this.expr(node.start), 'goint') : G.Lit('0')]), 'int32');
    }

    xArrayIncludes(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t) || 'any';
      if (at === 'string') return new Val(G.Call(G.Selector(G.Ident('strings'), 'Contains'), [a.e, this.coerce(this.expr(node.value), 'string')]), 'boolean');
      const el = isArrayType(at) ? elementType(at) : 'any';
      return new Val(G.Binary('>=', G.Call(this.generic('jsIndexOf', this.goType(isArrayType(at) ? el : 'any')), [isArrayType(at) ? a.e : this.coerce(a, 'any[]'), this.coerce(this.expr(node.value), isArrayType(at) ? el : 'any'), G.Lit('0')]), G.Lit('0')), 'boolean');
    }

    xArrayJoin(node) {
      const a = this.expr(node.array);
      return new Val(G.Call(G.Ident('jsJoin'), [a.e, node.separator ? this.coerce(this.expr(node.separator), 'string') : G.Lit('","')]), 'string');
    }

    xArrayReverse(node) {
      const a = this.expr(node.array);
      return new Val(G.Call(G.Ident('jsReverse'), [a.e]), canonicalType(a.t));
    }

    xArrayPop(node) { return this.builtinMethod(this.expr(node.array), canonicalType(this.expr(node.array).t), 'pop', [], null, node) || this.unsupported(node); }
    xArrayShift(node) { const a = this.expr(node.array); return this.builtinMethod(a, canonicalType(a.t), 'shift', [], null, node) || this.unsupported(node); }

    xArrayUnshift(node) {
      const a = this.expr(node.array);
      const el = elementType(canonicalType(a.t)) || 'any';
      return new Val(G.Call(this.generic('jsUnshift', this.goType(el)), [G.Unary('&', a.e), this.coerce(this.expr(node.value), el)]), 'int32');
    }

    xArraySplice(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t);
      const el = elementType(at) || 'any';
      const start = node.start ? this.coerce(this.expr(node.start), 'goint') : G.Lit('0');
      const del = node.deleteCount ? this.coerce(this.expr(node.deleteCount), 'goint') : G.Ident('jsNoEnd');
      return new Val(G.Call(this.generic('jsSplice', this.goType(el)), [G.Unary('&', a.e), start, del, ...(node.items || []).map(i => this.coerce(this.expr(i), el))]), at);
    }

    xArrayMap(node) { const a = this.expr(node.array); return this.arrayCallback(a, canonicalType(a.t), 'map', [node.callback], canonicalType(node.resultType)); }
    xArrayFilter(node) { const a = this.expr(node.array); return this.arrayCallback(a, canonicalType(a.t), 'filter', [node.callback], canonicalType(node.resultType)); }
    xArrayForEach(node) { const a = this.expr(node.array); return this.arrayCallback(a, canonicalType(a.t), 'forEach', [node.callback], 'void'); }
    xArraySort(node) {
      const a = this.expr(node.array);
      if (!node.compareFn) return new Val(G.Call(G.Ident('jsSortDefault'), [a.e]), canonicalType(a.t));
      return this.arrayCallback(a, canonicalType(a.t), 'sort', [node.compareFn], canonicalType(a.t));
    }

    xIsArrayCheck(node) {
      const v = this.expr(node.value);
      const t = canonicalType(v.t) || 'any';
      if (isArrayType(t)) return new Val(G.Binary('!=', v.e, G.Lit('nil')), 'boolean');
      return new Val(G.Call(G.Ident('jsIsArray'), [this.coerce(v, 'any')]), 'boolean');
    }

    xIsIntegerCheck(node) {
      const v = this.expr(node.value);
      const t = canonicalType(v.t);
      if (isIntType(t)) return new Val(null, 'boolean', true);
      return new Val(G.Call(G.Ident('jsIsInteger'), [this.coerce(v, 'any')]), 'boolean');
    }

    xObjectFreeze(node) { return this.expr(node.object); }

    xMapCreation(node) {
      const args = [];
      for (const e of node.entries || []) {
        if (e && e.type === 'ArrayExpression' && e.elements.length === 2) args.push(this.coerce(this.expr(e.elements[0]), 'any'), this.coerce(this.expr(e.elements[1]), 'any'));
      }
      return new Val(G.Call(G.Ident('jsNewMapOf'), args), 'Map');
    }

    xFloor(node) { return this.mathUnary(node, 'Floor'); }
    xCeil(node) { return this.mathUnary(node, 'Ceil'); }
    xRound(node) { return this.mathUnary(node, 'jsRound'); }
    xTruncate(node) { return this.mathUnary(node, 'Trunc'); }
    xAbs(node) { return this.mathUnary(node, 'Abs'); }
    xSqrt(node) { return this.mathUnary(node, 'Sqrt'); }
    xLog(node) { return this.mathUnary(node, 'Log'); }
    xLog2(node) { return this.mathUnary(node, 'Log2'); }
    xExp(node) { return this.mathUnary(node, 'Exp'); }
    xSin(node) { return this.mathUnary(node, 'Sin'); }
    xCos(node) { return this.mathUnary(node, 'Cos'); }
    xTanh(node) { return this.mathUnary(node, 'Tanh'); }

    mathUnary(node, fn) {
      const v = this.expr(node.argument);
      const rt = canonicalType(node.resultType) || 'float64';
      const vt = canonicalType(v.t);
      // Floor/Ceil/Trunc/Round/Abs of an integer is the integer
      if (isIntType(vt) && ['Floor', 'Ceil', 'Trunc', 'jsRound'].includes(fn)) return isIntType(rt) || !isNumericType(rt) ? new Val(this.coerce(v, rt && isNumericType(rt) ? rt : vt), rt && isNumericType(rt) ? rt : vt) : new Val(this.coerce(v, 'float64'), 'float64');
      if (v.isConst && typeof v.c === 'number') {
        const f = { Floor: Math.floor, Ceil: Math.ceil, jsRound: Math.round, Trunc: Math.trunc, Abs: Math.abs, Sqrt: Math.sqrt, Log: Math.log, Log2: Math.log2, Exp: Math.exp, Sin: Math.sin, Cos: Math.cos, Tanh: Math.tanh }[fn];
        if (f) return new Val(null, rt, f(v.c));
      }
      const callee = fn.startsWith('js') ? G.Ident(fn) : G.Selector(G.Ident('math'), fn);
      const res = new Val(G.Call(callee, [this.coerce(v, 'float64')]), 'float64');
      return isFloatType(rt) || !isNumericType(rt) ? res : new Val(this.coerce(res, rt), rt);
    }

    xMin(node) { return this.minMax('min', (node.arguments || []).map(a => this.expr(a)), canonicalType(node.resultType)); }
    xMax(node) { return this.minMax('max', (node.arguments || []).map(a => this.expr(a)), canonicalType(node.resultType)); }

    xPower(node) { return this.power(this.expr(node.base), this.expr(node.exponent), canonicalType(node.resultType)); }

    xMathCall(node) {
      const args = (node.arguments || []).map(a => this.expr(a));
      const rt = canonicalType(node.resultType);
      if (node.method === 'imul') return new Val(G.Conv('int32', G.Binary('*', this.toInt32Bits(args[0], 'uint32'), this.toInt32Bits(args[1], 'uint32'))), 'int32');
      const r = this.mathCall(node.method, args, rt);
      if (r) return r;
      return this.unsupported(node);
    }

    xMathConstant(node) { return new Val(null, 'float64', node.value !== undefined ? node.value : Math[node.name]); }
    xNumberConstant(node) { return new Val(null, canonicalType(node.resultType) || 'float64', node.value); }
    xRandom() { return new Val(G.Call(G.Ident('jsRandom'), []), 'float64'); }

    xCountLeadingZeros(node) {
      const v = this.expr(node.argument);
      const bits = node.bits || 32;
      return new Val(G.Conv('int32', G.Call(G.Selector(G.Ident('bits'), bits === 64 ? 'LeadingZeros64' : 'LeadingZeros32'), [this.toInt32Bits(v, 'uint32')])), 'int32');
    }

    xStringCharAt(node) {
      const s = this.expr(node.string);
      return new Val(G.Call(G.Ident('jsCharAt'), [this.coerce(s, 'string'), this.coerce(this.expr(node.index), 'goint')]), 'string');
    }

    xStringCharCodeAt(node) {
      const s = this.expr(node.string);
      return new Val(G.Call(G.Ident('jsCharCodeAt'), [this.coerce(s, 'string'), node.index ? this.coerce(this.expr(node.index), 'goint') : G.Lit('0')]), canonicalType(node.resultType) === 'uint16' ? 'int32' : 'int32');
    }

    xStringFromCharCodes(node) {
      return new Val(G.Call(G.Ident('jsFromCharCodes'), [this.spreadList(node.charCodes || [], 'int32')]), 'string');
    }

    xStringTransform(node) {
      const s = this.expr(node.string);
      return this.builtinMethod(s, 'string', node.method, [], 'string', node) || this.unsupported(node);
    }

    xStringRepeat(node) {
      return new Val(G.Call(G.Selector(G.Ident('strings'), 'Repeat'), [this.coerce(this.expr(node.string), 'string'), this.coerce(this.expr(node.count), 'goint')]), 'string');
    }

    xStringReplace(node) {
      return new Val(G.Call(G.Ident(node.method === 'replaceAll' ? 'jsReplaceAll' : 'jsReplace'), [this.coerce(this.expr(node.string), 'string'), this.coerce(this.expr(node.searchValue), 'any'), this.coerce(this.expr(node.replaceValue), 'any')]), 'string');
    }

    xStringIndexOf(node) {
      const s = this.coerce(this.expr(node.string), 'string');
      const sub = this.coerce(this.expr(node.searchValue), 'string');
      if (node.method === 'lastIndexOf') return new Val(G.Conv('int32', G.Call(G.Selector(G.Ident('strings'), 'LastIndex'), [s, sub])), 'int32');
      return new Val(G.Call(G.Ident('jsStrIndexOf'), [s, sub, node.fromIndex ? this.coerce(this.expr(node.fromIndex), 'goint') : G.Lit('0')]), 'int32');
    }

    xStringIncludes(node) {
      const s = this.coerce(this.expr(node.string), 'string');
      const sub = this.coerce(this.expr(node.searchValue), 'string');
      const fn = node.method === 'startsWith' ? 'HasPrefix' : node.method === 'endsWith' ? 'HasSuffix' : 'Contains';
      return new Val(G.Call(G.Selector(G.Ident('strings'), fn), [s, sub]), 'boolean');
    }

    xStringSubstring(node) {
      const s = this.coerce(this.expr(node.string), 'string');
      const start = node.start ? this.coerce(this.expr(node.start), 'goint') : G.Lit('0');
      if (node.method === 'substr') return new Val(G.Call(G.Ident('jsSubstr'), [s, start, node.length ? this.coerce(this.expr(node.length), 'goint') : G.Lit('-1')]), 'string');
      if (node.method === 'slice') return new Val(G.Call(G.Ident('jsStrSlice'), [s, start, node.end ? this.coerce(this.expr(node.end), 'goint') : G.Ident('jsNoEnd')]), 'string');
      return new Val(G.Call(G.Ident('jsSubstring'), [s, start, node.end ? this.coerce(this.expr(node.end), 'goint') : G.Lit('-1')]), 'string');
    }

    xStringSplit(node) {
      return new Val(G.Call(G.Ident('jsSplit'), [this.coerce(this.expr(node.string), 'string'), node.separator ? this.coerce(this.expr(node.separator), 'any') : G.Lit('nil')]), 'string[]');
    }

    xStringPad(node) {
      const fn = node.method === 'padEnd' ? 'jsPadEnd' : 'jsPadStart';
      return new Val(G.Call(G.Ident(fn), [this.coerce(this.expr(node.string), 'string'), this.coerce(this.expr(node.targetLength), 'goint'), node.padString ? this.coerce(this.expr(node.padString), 'string') : G.Lit('" "')]), 'string');
    }

    xDebugOutput(node) {
      return new Val(G.Call(G.Ident('jsLog'), (node.arguments || []).map(a => this.coerce(this.expr(a), 'any'))), 'void');
    }

    xOpCodesCall(node) {
      return this.opCodesCall(node.method || node.opCodesMethod, node.arguments || [], this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable), node);
    }

    /** OpCodes methods the IL keeps as calls: the runtime's op* functions with their JSDoc signatures. */
    opCodesCall(method, argNodes, rt, node) {
      const sig = OPCODES_SIGNATURES[method];
      if (!sig) {
        this.warnings.push(`OpCodes.${method}`);
        return new Val(G.Call(G.Ident('jsUnsupported'), [G.Lit(this.goString('OpCodes.' + method))]), rt || 'any');
      }
      if (sig.special) return sig.special.call(this, argNodes, rt, node);
      const args = sig.params.map((t, i) => i < argNodes.length ? this.coerce(this.expr(argNodes[i]), t) : (sig.defaults && sig.defaults[i] !== undefined ? G.Lit(sig.defaults[i]) : this.zero(t)));
      const res = new Val(G.Call(G.Ident('op' + method), args), sig.returns);
      return rt && rt !== 'any' && !this.sameGo(rt, sig.returns) ? new Val(this.coerce(res, rt), rt) : res;
    }

    unsupported(node) {
      this.warnings.push(`unsupported ${node.type}`);
      return new Val(G.Call(G.Ident('jsUnsupported'), [G.Lit(this.goString(node.type))]), canonicalType(node.resultType) || 'any');
    }
  }

  /**
   * OpCodes methods the IL leaves as calls, with the parameter and return IL
   * types of their JSDoc. Generic ones (whose element type follows the
   * argument) have a `special` transform.
   */
  const OPCODES_SIGNATURES = {
    GetByte: { params: ['uint32', 'int32'], returns: 'uint8' },
    GF256Mul: { params: ['int32', 'int32'], returns: 'uint8' },
    GFMul: { params: ['int32', 'int32', 'int32', 'int32'], returns: 'int32' },
    SetBit: { params: ['uint32', 'int32', 'int32'], returns: 'uint32' },
    GetBit: { params: ['uint32', 'int32'], returns: 'boolean' },
    BitMask: { params: ['int32'], returns: 'uint32' },
    Shr32Signed: { params: ['int32', 'int32'], returns: 'int32' },
    MulHi32: { params: ['uint32', 'uint32'], returns: 'uint32' },
    PopCount: { params: ['uint32'], returns: 'int32' },
    PopCountFast: { params: ['uint32'], returns: 'int32' },
    BitCountN: { params: ['bigint'], returns: 'int32' },
    Hex32ToDWords: { params: ['string'], returns: 'uint32[]' },
    SecureCompare: { params: ['uint8[]', 'uint8[]'], returns: 'boolean' },
    ConstantTimeCompare: { params: ['uint8[]', 'uint8[]', 'int32'], returns: 'boolean' },
    ArraysEqual: { params: ['uint8[]', 'uint8[]'], returns: 'boolean' },
    BytesToChars: { params: ['uint8[]'], returns: 'string' },
    Words32ToBytesBE: { params: ['uint32[]'], returns: 'uint8[]' },
    BytesToWords32BE: { params: ['uint8[]'], returns: 'uint32[]' },
    XorArrayWithByte: { params: ['uint8[]', 'int32'], returns: 'uint8[]' },
    GHashMul: { params: ['uint8[]', 'uint8[]'], returns: 'uint8[]' },
    GCMIncrement: { params: ['uint8[]'], returns: 'uint8[]' },
    EncodeMsgLength64LE: { params: ['float64'], returns: 'uint8[]' },
    SecureRandomBytes: { params: ['int32'], returns: 'uint8[]' },
    RotL64n: { params: ['bigint', 'int32'], returns: 'bigint' },
    RotR64n: { params: ['bigint', 'int32'], returns: 'bigint' },
    RotL128n: { params: ['bigint', 'int32'], returns: 'bigint' },
    GcdN: { params: ['bigint', 'bigint'], returns: 'bigint' },
    ModN: { params: ['bigint', 'bigint'], returns: 'bigint' },
    AddMod: { params: ['bigint', 'bigint', 'bigint'], returns: 'bigint' },
    SubMod: { params: ['bigint', 'bigint', 'bigint'], returns: 'bigint' },
    MulModN: { params: ['bigint', 'bigint', 'bigint'], returns: 'bigint' },
    SquareModN: { params: ['bigint', 'bigint'], returns: 'bigint' },
    ModPowN: { params: ['bigint', 'bigint', 'bigint'], returns: 'bigint' },
    ModInverseN: { params: ['bigint', 'bigint'], returns: 'bigint' },
    GetBitN: { params: ['bigint', 'int32'], returns: 'int32' },
    ToLong: { params: ['float64'], returns: 'int64' },
    ToShort: { params: ['float64'], returns: 'int16' },
    Add3L64: { params: ['uint32', 'uint32', 'uint32'], returns: 'float64' },
    Add3H64: { params: ['float64', 'uint32', 'uint32', 'uint32'], returns: 'uint32' },
    CreateUint64ArrayFromHex: { params: ['string'], returns: 'uint64[]' },
    CreateArray: {
      special(argNodes, rt) {
        const t = rt && isArrayType(rt) ? rt : 'uint8[]';
        const n = this.coerce(this.expr(argNodes[0]), 'goint');
        const v = argNodes[1] ? this.coerce(this.expr(argNodes[1]), elementType(t)) : this.zero(elementType(t));
        return new Val(G.Call(this.generic('jsMakeFilled', this.goType(elementType(t))), [n, v]), t);
      }
    },
    CopyArray: {
      special(argNodes, rt) {
        const v = this.expr(argNodes[0]);
        const vt = canonicalType(v.t);
        const res = new Val(G.Call(G.Ident('jsCopy'), [isArrayType(vt) ? v.e : this.coerce(v, rt || 'uint8[]')]), isArrayType(vt) ? vt : (rt || 'uint8[]'));
        return rt && rt !== 'any' && !this.sameGo(rt, res.t) ? new Val(this.coerce(res, rt), rt) : res;
      }
    },
    ConcatArrays: {
      special(argNodes, rt) {
        const v = this.expr(argNodes[0]);
        const t = rt && isArrayType(rt) ? rt : 'uint8[]';
        if (argNodes[0].type === 'ArrayExpression') {
          const parts = argNodes[0].elements.map(e => this.coerce(this.expr(e), t));
          return new Val(G.Call(G.Ident('jsConcat'), parts), t);
        }
        return new Val(G.Call(G.Ident('jsConcat'), [this.coerce(v, t + '[]')], true), t);
      }
    },
    ArraySlice: {
      special(argNodes, rt) {
        const v = this.expr(argNodes[0]);
        const vt = canonicalType(v.t);
        const start = argNodes[1] ? this.coerce(this.expr(argNodes[1]), 'goint') : G.Lit('0');
        const end = argNodes[2] ? this.coerce(this.expr(argNodes[2]), 'goint') : G.Ident('jsNoEnd');
        return new Val(G.Call(G.Ident('jsSlice'), [v.e, start, end]), vt);
      }
    },
    RotL64_HL: {
      special(argNodes) {
        return new Val(G.Call(G.Ident('opRotL64_HL'), argNodes.map((a, i) => this.coerce(this.expr(a), i < 2 ? 'uint32' : 'int32'))), 'object');
      }
    },
    Split64: {
      special(argNodes) {
        return new Val(G.Call(G.Ident('opSplit64'), [this.coerce(this.expr(argNodes[0]), 'any')]), 'object');
      }
    },
    CreateBitStream: {
      special(argNodes) {
        return new Val(G.Call(G.Ident('jsUnsupported'), [G.Lit('"OpCodes.CreateBitStream"')]), 'object');
      }
    }
  };

  // ==========================================================================
  // GO RUNTIME: the JavaScript semantics the generated code calls
  // ==========================================================================

  const GO_RUNTIME = String.raw`// ===== JavaScript runtime for transpiled code =====

// JsObject is any JavaScript object: members are resolved by name, as
// JavaScript does. Every transpiled class implements it.
type JsObject interface {
	JsGet(name string) any
	JsSet(name string, value any)
	JsCall(name string, args ...any) any
	JsHas(name string) bool
	JsHasMethod(name string) bool
}

// JsError is a thrown JavaScript value: an Error (Name, Message) or any other value.
type JsError struct {
	Name    string
	Message string
	Value   any
}

func (e *JsError) Error() string {
	if e.Name == "" {
		return e.Message
	}
	return e.Name + ": " + e.Message
}
func (e *JsError) JsGet(name string) any {
	switch name {
	case "message":
		return e.Message
	case "name":
		return e.Name
	}
	return nil
}
func (e *JsError) JsSet(name string, value any) {
	switch name {
	case "message":
		e.Message = jsStr(value)
	case "name":
		e.Name = jsStr(value)
	}
}
func (e *JsError) JsCall(name string, args ...any) any {
	if name == "toString" {
		return e.Error()
	}
	panic(jsNewError("TypeError", "Error."+name+" is not a function"))
}
func (e *JsError) JsHas(name string) bool       { return name == "message" || name == "name" }
func (e *JsError) JsHasMethod(name string) bool { return name == "toString" }

func jsNewError(name string, message string) *JsError {
	return &JsError{Name: name, Message: message}
}

// jsThrowable is the panic value of a throw statement.
func jsThrowable(v any) any {
	if e, ok := v.(*JsError); ok {
		return e
	}
	return &JsError{Message: jsStr(v), Value: v}
}

// jsCaught is what a catch clause receives: the thrown value, or a TypeError
// for a fault of the Go runtime (an index out of range, a nil access).
func jsCaught(r any) any {
	switch x := r.(type) {
	case *JsError:
		if x.Value != nil {
			return x.Value
		}
		return x
	case error:
		return &JsError{Name: "TypeError", Message: x.Error()}
	}
	return &JsError{Name: "Error", Message: fmt.Sprint(r)}
}

func jsUnsupported(what string) any {
	panic(jsNewError("Error", "not transpiled: "+what))
}

// ----- plain objects and Maps

// JsMap is a JavaScript object literal (string keys) or Map (any keys), in insertion order.
type JsMap struct {
	keys []any
	vals map[any]any
}

func jsNewMap() *JsMap { return &JsMap{vals: map[any]any{}} }

func jsMapOf(kv ...any) *JsMap {
	m := jsNewMap()
	for i := 0; i+1 < len(kv); i += 2 {
		if s, ok := kv[i].(string); ok && s == "..." {
			for _, k := range jsKeys(kv[i+1]) {
				m.JsSet(k, jsGetProp(kv[i+1], k))
			}
			continue
		}
		m.JsSet(jsKey(kv[i]), kv[i+1])
	}
	return m
}

func jsNewMapOf(kv ...any) *JsMap {
	m := jsNewMap()
	for i := 0; i+1 < len(kv); i += 2 {
		m.MapSet(kv[i], kv[i+1])
	}
	return m
}

func jsMapKey(k any) any {
	switch x := k.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32:
		return jsF64(x)
	}
	return k
}

func (m *JsMap) MapGet(k any) any { return m.vals[jsMapKey(k)] }
func (m *JsMap) MapSet(k, v any) *JsMap {
	k = jsMapKey(k)
	if _, ok := m.vals[k]; !ok {
		m.keys = append(m.keys, k)
	}
	m.vals[k] = v
	return m
}
func (m *JsMap) MapHas(k any) bool { _, ok := m.vals[jsMapKey(k)]; return ok }
func (m *JsMap) MapDelete(k any) bool {
	k = jsMapKey(k)
	if _, ok := m.vals[k]; !ok {
		return false
	}
	delete(m.vals, k)
	for i, x := range m.keys {
		if x == k {
			m.keys = append(m.keys[:i:i], m.keys[i+1:]...)
			break
		}
	}
	return true
}
func (m *JsMap) MapClear()        { m.keys = nil; m.vals = map[any]any{} }
func (m *JsMap) MapKeys() []any   { return append([]any{}, m.keys...) }
func (m *JsMap) MapValues() []any {
	out := make([]any, len(m.keys))
	for i, k := range m.keys {
		out[i] = m.vals[k]
	}
	return out
}
func (m *JsMap) JsGet(name string) any {
	if name == "size" {
		if _, ok := m.vals[name]; !ok {
			return int32(len(m.keys))
		}
	}
	return m.vals[name]
}
func (m *JsMap) JsSet(name string, value any) { m.MapSet(name, value) }
func (m *JsMap) JsCall(name string, args ...any) any {
	if f, ok := m.vals[name]; ok {
		return jsCallFunc(f, args...)
	}
	switch name {
	case "get":
		return m.MapGet(jsArg(args, 0))
	case "set":
		return m.MapSet(jsArg(args, 0), jsArg(args, 1))
	case "has":
		return m.MapHas(jsArg(args, 0))
	case "delete":
		return m.MapDelete(jsArg(args, 0))
	case "hasOwnProperty":
		return m.MapHas(jsArg(args, 0))
	}
	panic(jsNewError("TypeError", "object."+name+" is not a function"))
}
func (m *JsMap) JsHas(name string) bool       { _, ok := m.vals[name]; return ok }
func (m *JsMap) JsHasMethod(name string) bool { return jsIsFunc(m.vals[name]) }

// jsKey is a property key: JavaScript turns numbers into their string form.
func jsKey(k any) string {
	if s, ok := k.(string); ok {
		return s
	}
	return jsStr(k)
}

func jsGetProp(o any, name string) any {
	switch x := o.(type) {
	case JsObject:
		return x.JsGet(name)
	case nil:
		panic(jsNewError("TypeError", "Cannot read properties of null (reading '"+name+"')"))
	}
	rv := reflect.ValueOf(o)
	if rv.Kind() == reflect.Slice || rv.Kind() == reflect.String {
		if name == "length" {
			return int32(rv.Len())
		}
		if i, err := strconv.Atoi(name); err == nil && i >= 0 && i < rv.Len() {
			return rv.Index(i).Interface()
		}
	}
	return nil
}

func jsToObject(v any) JsObject {
	if v == nil {
		return nil
	}
	if o, ok := v.(JsObject); ok {
		if jsIsNull(o) {
			return nil
		}
		return o
	}
	panic(jsNewError("TypeError", fmt.Sprintf("%T is not an object", v)))
}

func jsKeys(o any) []string {
	switch x := o.(type) {
	case *JsMap:
		out := []string{}
		for _, k := range x.keys {
			out = append(out, jsKey(k))
		}
		return out
	case nil:
		return []string{}
	}
	rv := reflect.ValueOf(o)
	if rv.Kind() == reflect.Slice {
		out := make([]string, rv.Len())
		for i := range out {
			out[i] = strconv.Itoa(i)
		}
		return out
	}
	return []string{}
}

func jsValues(o any) []any {
	out := []any{}
	for _, k := range jsKeys(o) {
		out = append(out, jsGetProp(o, k))
	}
	return out
}

func jsEntries(o any) []any {
	out := []any{}
	for _, k := range jsKeys(o) {
		out = append(out, []any{k, jsGetProp(o, k)})
	}
	return out
}

func jsAssign(target any, sources ...any) any {
	t := jsToObject(target)
	for _, s := range sources {
		for _, k := range jsKeys(s) {
			t.JsSet(k, jsGetProp(s, k))
		}
	}
	return target
}

func jsIn(key any, o any) bool {
	switch x := o.(type) {
	case JsObject:
		return x.JsHas(jsKey(key))
	}
	rv := reflect.ValueOf(o)
	if rv.Kind() == reflect.Slice {
		i, err := strconv.Atoi(jsKey(key))
		return err == nil && i >= 0 && i < rv.Len() || jsKey(key) == "length"
	}
	return false
}

func jsDelete(o any, key string) bool {
	if m, ok := o.(*JsMap); ok {
		m.MapDelete(key)
	}
	return true
}

func jsBind(o JsObject, name string) any {
	return func(args ...any) any { return o.JsCall(name, args...) }
}

func jsIterValues(v any) []any {
	switch x := v.(type) {
	case *JsMap:
		return x.MapValues()
	case nil:
		return nil
	}
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Slice {
		out := make([]any, rv.Len())
		for i := range out {
			out[i] = rv.Index(i).Interface()
		}
		return out
	}
	return nil
}

// ----- the algorithm registry (AlgorithmFramework.RegisterAlgorithm / Find)

var jsAlgorithms []JsObject

func jsRegisterAlgorithm(a JsObject) {
	if a == nil {
		panic(jsNewError("Error", "RegisterAlgorithm: Invalid algorithm object"))
	}
	jsAlgorithms = append(jsAlgorithms, a)
}

func jsFindAlgorithm(name string) JsObject {
	for i := len(jsAlgorithms) - 1; i >= 0; i-- {
		if jsStr(jsAlgorithms[i].JsGet("name")) == name {
			return jsAlgorithms[i]
		}
	}
	return nil
}

// ----- functions

func jsArg(args []any, i int) any {
	if i < len(args) {
		return args[i]
	}
	return nil
}

func jsArgOr(args []any, i int, dflt any) any {
	if i < len(args) && args[i] != nil {
		return args[i]
	}
	return dflt
}

func jsIsFunc(f any) bool {
	return f != nil && reflect.TypeOf(f).Kind() == reflect.Func
}

func jsCallFunc(f any, args ...any) any {
	if f == nil {
		panic(jsNewError("TypeError", "undefined is not a function"))
	}
	if g, ok := f.(func(...any) any); ok {
		return g(args...)
	}
	fv := reflect.ValueOf(f)
	ft := fv.Type()
	if ft.Kind() != reflect.Func {
		panic(jsNewError("TypeError", fmt.Sprintf("%T is not a function", f)))
	}
	in := make([]reflect.Value, ft.NumIn())
	for i := range in {
		in[i] = jsConvertValue(jsArg(args, i), ft.In(i))
	}
	out := fv.Call(in)
	if len(out) == 0 {
		return nil
	}
	return out[0].Interface()
}

// ----- values and conversions

func jsIsNull(v any) bool {
	if v == nil {
		return true
	}
	rv := reflect.ValueOf(v)
	switch rv.Kind() {
	case reflect.Ptr, reflect.Interface, reflect.Map, reflect.Func:
		return rv.IsNil()
	}
	return false
}

func jsTruthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case string:
		return x != ""
	case float64:
		return x != 0 && !math.IsNaN(x)
	case *big.Int:
		return x.Sign() != 0
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return jsF64(x) != 0
	}
	return !jsIsNull(v)
}

func jsTruthyF64(f float64) bool { return f != 0 && !math.IsNaN(f) }

func jsB2I(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

// jsF2I truncates a float as JavaScript's ToInt32/ToUint32 do before wrapping.
func jsF2I(f float64) int64 {
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return 0
	}
	f = math.Trunc(f)
	if f >= -9.223372036854775e18 && f < 9.223372036854775e18 {
		return int64(f)
	}
	m := math.Mod(f, 18446744073709551616.0)
	if m < 0 {
		m += 18446744073709551616.0
	}
	if m >= 9.223372036854775808e18 {
		return int64(uint64(m))
	}
	return int64(m)
}

func jsToInt32(f float64) int32 { return int32(jsF2I(f)) }

func jsF64(v any) float64 {
	switch x := v.(type) {
	case float64:
		return x
	case float32:
		return float64(x)
	case int:
		return float64(x)
	case int8:
		return float64(x)
	case int16:
		return float64(x)
	case int32:
		return float64(x)
	case int64:
		return float64(x)
	case uint:
		return float64(x)
	case uint8:
		return float64(x)
	case uint16:
		return float64(x)
	case uint32:
		return float64(x)
	case uint64:
		return float64(x)
	case bool:
		if x {
			return 1
		}
		return 0
	case string:
		return jsToNumber(x)
	case *big.Int:
		return jsBigToF64(x)
	case nil:
		return 0
	}
	return math.NaN()
}

// jsI64 is a value as a 64-bit integer, exact for integers of every Go type.
func jsI64(v any) int64 {
	switch x := v.(type) {
	case int:
		return int64(x)
	case int8:
		return int64(x)
	case int16:
		return int64(x)
	case int32:
		return int64(x)
	case int64:
		return x
	case uint:
		return int64(x)
	case uint8:
		return int64(x)
	case uint16:
		return int64(x)
	case uint32:
		return int64(x)
	case uint64:
		return int64(x)
	case *big.Int:
		return jsBigToI64(x)
	}
	return jsF2I(jsF64(v))
}

func jsToNumber(s string) float64 {
	t := strings.TrimSpace(s)
	if t == "" {
		return 0
	}
	if strings.HasPrefix(t, "0x") || strings.HasPrefix(t, "0X") {
		if n, err := strconv.ParseUint(t[2:], 16, 64); err == nil {
			return float64(n)
		}
		return math.NaN()
	}
	f, err := strconv.ParseFloat(t, 64)
	if err != nil {
		if t == "Infinity" || t == "+Infinity" {
			return math.Inf(1)
		}
		if t == "-Infinity" {
			return math.Inf(-1)
		}
		return math.NaN()
	}
	return f
}

func jsToNumberInt(s string) int64 { return jsF2I(jsToNumber(s)) }

func jsIsFinite(f float64) bool { return !math.IsNaN(f) && !math.IsInf(f, 0) }

func jsIsInteger(v any) bool {
	switch x := v.(type) {
	case float64:
		return !math.IsNaN(x) && !math.IsInf(x, 0) && x == math.Trunc(x)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return true
	}
	return false
}

func jsParseInt(s string, radix int) float64 {
	t := strings.TrimSpace(s)
	neg := false
	if strings.HasPrefix(t, "-") {
		neg = true
		t = t[1:]
	} else if strings.HasPrefix(t, "+") {
		t = t[1:]
	}
	if radix == 0 {
		radix = 10
	}
	if (radix == 16 || radix == 10 && false) && (strings.HasPrefix(t, "0x") || strings.HasPrefix(t, "0X")) {
		t = t[2:]
	}
	end := 0
	for end < len(t) {
		c := t[end]
		d := 99
		switch {
		case c >= '0' && c <= '9':
			d = int(c - '0')
		case c >= 'a' && c <= 'z':
			d = int(c-'a') + 10
		case c >= 'A' && c <= 'Z':
			d = int(c-'A') + 10
		}
		if d >= radix {
			break
		}
		end++
	}
	if end == 0 {
		return math.NaN()
	}
	r := 0.0
	for _, c := range t[:end] {
		d := 0
		switch {
		case c >= '0' && c <= '9':
			d = int(c - '0')
		case c >= 'a' && c <= 'z':
			d = int(c-'a') + 10
		default:
			d = int(c-'A') + 10
		}
		r = r*float64(radix) + float64(d)
	}
	if neg {
		return -r
	}
	return r
}

// jsTo converts a value to a Go type with JavaScript's conversions (numbers
// between widths, arrays element by element, objects by assertion).
func jsTo[T any](v any) T {
	if x, ok := v.(T); ok {
		return x
	}
	var z T
	rt := reflect.TypeOf(&z).Elem()
	if v == nil {
		return z
	}
	rv := jsConvertValue(v, rt)
	return rv.Interface().(T)
}

func jsConvertValue(v any, rt reflect.Type) reflect.Value {
	if v == nil {
		return reflect.Zero(rt)
	}
	vv := reflect.ValueOf(v)
	if vv.Type() == rt {
		return vv
	}
	switch rt.Kind() {
	case reflect.Interface:
		if vv.Type().Implements(rt) {
			r := reflect.New(rt).Elem()
			r.Set(vv)
			return r
		}
		if rt.NumMethod() == 0 {
			r := reflect.New(rt).Elem()
			r.Set(vv)
			return r
		}
	case reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64, reflect.Int:
		return reflect.ValueOf(jsI64(v)).Convert(rt)
	case reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uint:
		return reflect.ValueOf(uint64(jsI64(v))).Convert(rt)
	case reflect.Float64, reflect.Float32:
		return reflect.ValueOf(jsF64(v)).Convert(rt)
	case reflect.Bool:
		return reflect.ValueOf(jsTruthy(v))
	case reflect.String:
		return reflect.ValueOf(jsStr(v))
	case reflect.Slice:
		if vv.Kind() == reflect.Slice {
			out := reflect.MakeSlice(rt, vv.Len(), vv.Len())
			for i := 0; i < vv.Len(); i++ {
				out.Index(i).Set(jsConvertValue(vv.Index(i).Interface(), rt.Elem()))
			}
			return out
		}
		if vv.Kind() == reflect.String && rt.Elem().Kind() == reflect.String {
			s := v.(string)
			out := reflect.MakeSlice(rt, len(s), len(s))
			for i := 0; i < len(s); i++ {
				out.Index(i).Set(reflect.ValueOf(s[i : i+1]))
			}
			return out
		}
	case reflect.Ptr:
		if rt == reflect.TypeOf((*big.Int)(nil)) {
			return reflect.ValueOf(jsBigOf(v))
		}
		if vv.Type().AssignableTo(rt) {
			return vv
		}
	}
	if vv.Type().ConvertibleTo(rt) {
		return vv.Convert(rt)
	}
	panic(jsNewError("TypeError", fmt.Sprintf("cannot convert %T to %v", v, rt)))
}

// ----- strings (Latin-1: one byte per character code)

func jsStr(v any) string {
	switch x := v.(type) {
	case nil:
		return "undefined"
	case string:
		return x
	case bool:
		if x {
			return "true"
		}
		return "false"
	case float64:
		return jsNumToString(x, 10)
	case float32:
		return jsNumToString(float64(x), 10)
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return fmt.Sprint(x)
	case *big.Int:
		return x.String()
	case *JsError:
		return x.Error()
	case JsObject:
		if jsIsNull(x) {
			return "null"
		}
		return "[object " + "Object]"
	}
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Slice {
		parts := make([]string, rv.Len())
		for i := range parts {
			e := rv.Index(i).Interface()
			if e != nil {
				parts[i] = jsStr(e)
			}
		}
		return strings.Join(parts, ",")
	}
	return fmt.Sprint(v)
}

func jsNumToString(f float64, radix int) string {
	if math.IsNaN(f) {
		return "NaN"
	}
	if math.IsInf(f, 1) {
		return "Infinity"
	}
	if math.IsInf(f, -1) {
		return "-Infinity"
	}
	if radix != 10 {
		if f == math.Trunc(f) && math.Abs(f) < 1e300 {
			b, _ := new(big.Float).SetFloat64(f).Int(nil)
			return b.Text(radix)
		}
	}
	if f == math.Trunc(f) && math.Abs(f) < 1e21 {
		return strconv.FormatFloat(f, 'f', -1, 64)
	}
	s := strconv.FormatFloat(f, 'g', -1, 64)
	if strings.Contains(s, "e") {
		mant, exp, _ := strings.Cut(s, "e")
		if exp[0] == '+' {
			exp = exp[1:]
			return mant + "e+" + strings.TrimLeft(exp, "0")
		}
		return mant + "e-" + strings.TrimLeft(exp[1:], "0")
	}
	return s
}

func jsToFixed(f float64, digits int) string { return strconv.FormatFloat(f, 'f', digits, 64) }

const jsNoEnd = math.MaxInt

func jsCharAt(s string, i int) string {
	if i < 0 || i >= len(s) {
		return ""
	}
	return s[i : i+1]
}

func jsCharCodeAt(s string, i int) int32 {
	if i < 0 || i >= len(s) {
		return 0
	}
	return int32(s[i])
}

func jsFromCharCodes(codes []int32) string {
	b := make([]byte, len(codes))
	for i, c := range codes {
		b[i] = byte(c)
	}
	return string(b)
}

func jsStringChars(s string) []string {
	out := make([]string, len(s))
	for i := range out {
		out[i] = s[i : i+1]
	}
	return out
}

func jsClampIndex(i, n int) int {
	if i < 0 {
		i += n
		if i < 0 {
			i = 0
		}
	}
	if i > n {
		i = n
	}
	return i
}

func jsSubstring(s string, a, b int) string {
	n := len(s)
	if b < 0 && b == -1 {
		b = n
	}
	a = max(0, min(a, n))
	b = max(0, min(b, n))
	if a > b {
		a, b = b, a
	}
	return s[a:b]
}

func jsSubstr(s string, a, length int) string {
	n := len(s)
	a = jsClampIndex(a, n)
	if length < 0 || a+length > n {
		length = n - a
	}
	return s[a : a+length]
}

func jsStrSlice(s string, a, b int) string {
	n := len(s)
	a = jsClampIndex(a, n)
	if b == jsNoEnd {
		b = n
	}
	b = jsClampIndex(b, n)
	if a >= b {
		return ""
	}
	return s[a:b]
}

func jsStrIndexOf(s, sub string, from int) int32 {
	if from < 0 {
		from = 0
	}
	if from > len(s) {
		if sub == "" {
			return int32(len(s))
		}
		return -1
	}
	i := strings.Index(s[from:], sub)
	if i < 0 {
		return -1
	}
	return int32(i + from)
}

func jsToUpper(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'a' && c <= 'z' {
			b[i] = c - 32
		}
	}
	return string(b)
}

func jsToLower(s string) string {
	b := []byte(s)
	for i, c := range b {
		if c >= 'A' && c <= 'Z' {
			b[i] = c + 32
		}
	}
	return string(b)
}

func jsSplit(s string, sep any) []string {
	switch x := sep.(type) {
	case nil:
		return []string{s}
	case string:
		if x == "" {
			return jsStringChars(s)
		}
		return strings.Split(s, x)
	case *regexp.Regexp:
		return x.Split(s, -1)
	}
	return []string{s}
}

func jsPadStart(s string, n int, pad string) string {
	for len(s) < n && pad != "" {
		need := n - len(s)
		p := strings.Repeat(pad, need/len(pad)+1)[:need]
		s = p + s
	}
	return s
}

func jsPadEnd(s string, n int, pad string) string {
	for len(s) < n && pad != "" {
		need := n - len(s)
		s = s + strings.Repeat(pad, need/len(pad)+1)[:need]
	}
	return s
}

func jsReplace(s string, search any, repl any) string {
	r := jsStr(repl)
	switch x := search.(type) {
	case string:
		return strings.Replace(s, x, r, 1)
	case *regexp.Regexp:
		return x.ReplaceAllString(s, strings.ReplaceAll(r, "$&", "${0}"))
	}
	return s
}

func jsReplaceAll(s string, search any, repl any) string {
	switch x := search.(type) {
	case string:
		return strings.ReplaceAll(s, x, jsStr(repl))
	}
	return jsReplace(s, search, repl)
}

func jsMatch(s string, re any) []string {
	if r, ok := re.(*regexp.Regexp); ok {
		return r.FindAllString(s, -1)
	}
	return nil
}

func jsTypeOf(v any) string {
	switch v.(type) {
	case nil:
		return "undefined"
	case string:
		return "string"
	case bool:
		return "boolean"
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
		return "number"
	case *big.Int:
		return "bigint"
	}
	if jsIsFunc(v) {
		return "function"
	}
	return "object"
}

func jsStrictEquals(a, b any) bool {
	if a == nil || b == nil {
		return jsIsNull(a) && jsIsNull(b)
	}
	switch x := a.(type) {
	case string:
		y, ok := b.(string)
		return ok && x == y
	case bool:
		y, ok := b.(bool)
		return ok && x == y
	case *big.Int:
		y, ok := b.(*big.Int)
		return ok && x.Cmp(y) == 0
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
		switch b.(type) {
		case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
			return jsF64(a) == jsF64(b)
		}
		return false
	}
	ra, rb := reflect.ValueOf(a), reflect.ValueOf(b)
	if ra.Kind() == reflect.Slice && rb.Kind() == reflect.Slice {
		return ra.Pointer() == rb.Pointer() && ra.Len() == rb.Len()
	}
	if ra.Type().Comparable() && rb.Type().Comparable() {
		return a == b
	}
	return false
}

func jsLooseEquals(a, b any) bool {
	if jsIsNull(a) || jsIsNull(b) {
		return jsIsNull(a) && jsIsNull(b)
	}
	if jsStrictEquals(a, b) {
		return true
	}
	switch a.(type) {
	case string, bool, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
		switch b.(type) {
		case string, bool, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
			return jsF64(a) == jsF64(b)
		}
	}
	return false
}

func jsInstanceOfBuiltin(v any, name string) bool {
	_, ok := v.(*JsError)
	return ok
}

func jsLength(v any) int32 {
	switch x := v.(type) {
	case string:
		return int32(len(x))
	case JsObject:
		return int32(jsI64(x.JsGet("length")))
	case nil:
		panic(jsNewError("TypeError", "Cannot read properties of null (reading 'length')"))
	}
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Slice {
		return int32(rv.Len())
	}
	return 0
}

func jsLog(args ...any) {
	parts := make([]string, len(args))
	for i, a := range args {
		parts[i] = jsStr(a)
	}
	fmt.Fprintln(os.Stderr, strings.Join(parts, " "))
}

func jsJSON(v any) string { return fmt.Sprint(v) }

func jsIf[T any](c bool, a, b T) T {
	if c {
		return a
	}
	return b
}

// ----- math

func jsRound(f float64) float64 { return math.Floor(f + 0.5) }
func jsSign(f float64) float64 {
	switch {
	case f > 0:
		return 1
	case f < 0:
		return -1
	}
	return f
}
func jsFround(f float64) float64 { return float64(float32(f)) }
func jsClz32(f float64) float64  { return float64(bits.LeadingZeros32(uint32(jsF2I(f)))) }
func jsMinF(xs ...float64) float64 {
	r := math.Inf(1)
	for _, x := range xs {
		if math.IsNaN(x) {
			return x
		}
		if x < r {
			r = x
		}
	}
	return r
}
func jsMaxF(xs ...float64) float64 {
	r := math.Inf(-1)
	for _, x := range xs {
		if math.IsNaN(x) {
			return x
		}
		if x > r {
			r = x
		}
	}
	return r
}

var jsRandState uint64 = 0x9E3779B97F4A7C15

func jsRandom() float64 {
	jsRandState ^= jsRandState << 13
	jsRandState ^= jsRandState >> 7
	jsRandState ^= jsRandState << 17
	return float64(jsRandState>>11) / 9007199254740992.0
}

// ----- BigInt

func jsBigI(v int64) *big.Int { return big.NewInt(v) }
func jsBigLit(s string) *big.Int {
	b, _ := new(big.Int).SetString(s, 10)
	return b
}
func jsBigFromI64(v int64) *big.Int  { return big.NewInt(v) }
func jsBigFromU64(v uint64) *big.Int { return new(big.Int).SetUint64(v) }
func jsBigFromF64(f float64) *big.Int {
	if math.IsNaN(f) || math.IsInf(f, 0) || f != math.Trunc(f) {
		panic(jsNewError("RangeError", "The number cannot be converted to a BigInt because it is not an integer"))
	}
	b, _ := new(big.Float).SetFloat64(f).Int(nil)
	return b
}
func jsBigOf(v any) *big.Int {
	switch x := v.(type) {
	case *big.Int:
		return x
	case float64:
		return jsBigFromF64(x)
	case uint64:
		return jsBigFromU64(x)
	case string:
		return jsBigParse(x)
	case nil:
		return nil
	}
	return big.NewInt(jsI64(v))
}
func jsBigParse(s string) *big.Int {
	t := strings.TrimSpace(s)
	base := 10
	if strings.HasPrefix(t, "0x") || strings.HasPrefix(t, "0X") {
		base, t = 16, t[2:]
	} else if strings.HasPrefix(t, "0b") || strings.HasPrefix(t, "0B") {
		base, t = 2, t[2:]
	} else if strings.HasPrefix(t, "0o") || strings.HasPrefix(t, "0O") {
		base, t = 8, t[2:]
	}
	if t == "" {
		return big.NewInt(0)
	}
	b, ok := new(big.Int).SetString(t, base)
	if !ok {
		panic(jsNewError("SyntaxError", "Cannot convert "+s+" to a BigInt"))
	}
	return b
}
func jsBigToF64(b *big.Int) float64 { f, _ := new(big.Float).SetInt(b).Float64(); return f }
func jsBigToI64(b *big.Int) int64 {
	return int64(jsBigToU64(b))
}
func jsBigToU64(b *big.Int) uint64 {
	m := new(big.Int).And(b, jsMask64)
	return m.Uint64()
}

var jsMask64 = new(big.Int).SetUint64(0xFFFFFFFFFFFFFFFF)

func jsBigAdd(a, b *big.Int) *big.Int { return new(big.Int).Add(a, b) }
func jsBigSub(a, b *big.Int) *big.Int { return new(big.Int).Sub(a, b) }
func jsBigMul(a, b *big.Int) *big.Int { return new(big.Int).Mul(a, b) }
func jsBigDiv(a, b *big.Int) *big.Int {
	if b.Sign() == 0 {
		panic(jsNewError("RangeError", "Division by zero"))
	}
	return new(big.Int).Quo(a, b)
}
func jsBigMod(a, b *big.Int) *big.Int {
	if b.Sign() == 0 {
		panic(jsNewError("RangeError", "Division by zero"))
	}
	return new(big.Int).Rem(a, b)
}
func jsBigPow(a, b *big.Int) *big.Int {
	if b.Sign() < 0 {
		panic(jsNewError("RangeError", "Exponent must be non-negative"))
	}
	return new(big.Int).Exp(a, b, nil)
}
func jsBigAnd(a, b *big.Int) *big.Int { return new(big.Int).And(a, b) }
func jsBigOr(a, b *big.Int) *big.Int  { return new(big.Int).Or(a, b) }
func jsBigXor(a, b *big.Int) *big.Int { return new(big.Int).Xor(a, b) }
func jsBigNot(a *big.Int) *big.Int    { return new(big.Int).Not(a) }
func jsBigNeg(a *big.Int) *big.Int    { return new(big.Int).Neg(a) }
func jsBigShl(a *big.Int, n int) *big.Int {
	if n < 0 {
		return jsBigShr(a, -n)
	}
	return new(big.Int).Lsh(a, uint(n))
}
func jsBigShr(a *big.Int, n int) *big.Int {
	if n < 0 {
		return jsBigShl(a, -n)
	}
	return new(big.Int).Rsh(a, uint(n))
}
func jsBigCmp(a, b *big.Int) int { return a.Cmp(b) }
func jsBigAsUintN(n int, a *big.Int) *big.Int {
	m := new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), uint(n)), big.NewInt(1))
	return new(big.Int).And(a, m)
}
func jsBigAsIntN(n int, a *big.Int) *big.Int {
	u := jsBigAsUintN(n, a)
	if n > 0 && u.Bit(n-1) == 1 {
		u.Sub(u, new(big.Int).Lsh(big.NewInt(1), uint(n)))
	}
	return u
}
func jsBigToString(b *big.Int, radix int) string { return b.Text(radix) }

// ----- arrays

func jsCopy[T any](a []T) []T {
	if a == nil {
		return nil
	}
	out := make([]T, len(a))
	copy(out, a)
	return out
}

func jsSlice[T any](a []T, start, end int) []T {
	n := len(a)
	start = jsClampIndex(start, n)
	if end == jsNoEnd {
		end = n
	}
	end = jsClampIndex(end, n)
	if start >= end {
		return []T{}
	}
	out := make([]T, end-start)
	copy(out, a[start:end])
	return out
}

func jsSubarray[T any](a []T, start, end int) []T {
	n := len(a)
	start = jsClampIndex(start, n)
	if end == jsNoEnd {
		end = n
	}
	end = jsClampIndex(end, n)
	if start >= end {
		return a[start:start]
	}
	return a[start:end:end]
}

func jsConcat[T any](parts ...[]T) []T {
	n := 0
	for _, p := range parts {
		n += len(p)
	}
	out := make([]T, 0, n)
	for _, p := range parts {
		out = append(out, p...)
	}
	return out
}

func jsSetAt[T any](a []T, i int, v T) []T {
	if i < len(a) {
		a[i] = v
		return a
	}
	if i < 0 {
		return a
	}
	for len(a) < i {
		var z T
		a = append(a, z)
	}
	return append(a, v)
}

func jsSetLength[T any](a []T, n int) []T {
	if n <= len(a) {
		return a[:n]
	}
	for len(a) < n {
		var z T
		a = append(a, z)
	}
	return a
}

func jsMakeFilled[T any](n int, v T) []T {
	out := make([]T, n)
	for i := range out {
		out[i] = v
	}
	return out
}

func jsFill[T any](a []T, v T, start, end int) []T {
	n := len(a)
	start = jsClampIndex(start, n)
	if end == jsNoEnd {
		end = n
	}
	end = jsClampIndex(end, n)
	for i := start; i < end; i++ {
		a[i] = v
	}
	return a
}

func jsClear[T any](a []T) {
	var z T
	for i := range a {
		a[i] = z
	}
}

func jsReverse[T any](a []T) []T {
	for i, j := 0, len(a)-1; i < j; i, j = i+1, j-1 {
		a[i], a[j] = a[j], a[i]
	}
	return a
}

func jsIndexOf[T any](a []T, v T, from int) int32 {
	if from < 0 {
		from += len(a)
		if from < 0 {
			from = 0
		}
	}
	for i := from; i < len(a); i++ {
		if jsStrictEquals(any(a[i]), any(v)) {
			return int32(i)
		}
	}
	return -1
}

func jsJoin[T any](a []T, sep string) string {
	parts := make([]string, len(a))
	for i, x := range a {
		if !jsIsNull(any(x)) {
			parts[i] = jsStr(any(x))
		}
	}
	return strings.Join(parts, sep)
}

func jsPop[T any](p *[]T) T {
	var z T
	a := *p
	if len(a) == 0 {
		return z
	}
	v := a[len(a)-1]
	*p = a[:len(a)-1]
	return v
}

func jsShift[T any](p *[]T) T {
	var z T
	a := *p
	if len(a) == 0 {
		return z
	}
	v := a[0]
	*p = a[1:]
	return v
}

func jsUnshift[T any](p *[]T, items ...T) int32 {
	*p = append(append([]T{}, items...), (*p)...)
	return int32(len(*p))
}

func jsSplice[T any](p *[]T, start, deleteCount int, items ...T) []T {
	a := *p
	n := len(a)
	start = jsClampIndex(start, n)
	if deleteCount == jsNoEnd || start+deleteCount > n {
		deleteCount = n - start
	}
	if deleteCount < 0 {
		deleteCount = 0
	}
	removed := append([]T{}, a[start:start+deleteCount]...)
	rest := append([]T{}, a[start+deleteCount:]...)
	*p = append(append(a[:start:start], items...), rest...)
	return removed
}

func jsPushAny(a any, items ...any) int32 {
	panic(jsNewError("TypeError", "push on a value that is not an array"))
}

func jsTypedSet[T any](dst []T, src []T, offset int) {
	if offset+len(src) > len(dst) {
		panic(jsNewError("RangeError", "offset is out of bounds"))
	}
	copy(dst[offset:], src)
}

func jsTypedFrom[T any](v any) []T {
	return jsTo[[]T](v)
}

func jsFromLength[T any](n int, f func(any, int32) T) []T {
	out := make([]T, n)
	for i := range out {
		out[i] = f(nil, int32(i))
	}
	return out
}

func jsMap[A, B any](a []A, f func(A, int32) B) []B {
	out := make([]B, len(a))
	for i, x := range a {
		out[i] = f(x, int32(i))
	}
	return out
}

func jsFilter[A any](a []A, f func(A, int32) bool) []A {
	out := []A{}
	for i, x := range a {
		if f(x, int32(i)) {
			out = append(out, x)
		}
	}
	return out
}

func jsForEach[A any](a []A, f func(A, int32)) {
	for i, x := range a {
		f(x, int32(i))
	}
}

func jsSome[A any](a []A, f func(A, int32) bool) bool {
	for i, x := range a {
		if f(x, int32(i)) {
			return true
		}
	}
	return false
}

func jsEvery[A any](a []A, f func(A, int32) bool) bool {
	for i, x := range a {
		if !f(x, int32(i)) {
			return false
		}
	}
	return true
}

func jsFind[A any](a []A, f func(A, int32) bool) A {
	for i, x := range a {
		if f(x, int32(i)) {
			return x
		}
	}
	var z A
	return z
}

func jsFindIndex[A any](a []A, f func(A, int32) bool) int32 {
	for i, x := range a {
		if f(x, int32(i)) {
			return int32(i)
		}
	}
	return -1
}

func jsReduce[A, R any](a []A, f func(R, A, int32) R, init R) R {
	acc := init
	for i, x := range a {
		acc = f(acc, x, int32(i))
	}
	return acc
}

func jsSort[A any](a []A, cmp func(A, A) float64) []A {
	sort.SliceStable(a, func(i, j int) bool { return cmp(a[i], a[j]) < 0 })
	return a
}

func jsSortDefault[A any](a []A) []A {
	sort.SliceStable(a, func(i, j int) bool { return jsStr(any(a[i])) < jsStr(any(a[j])) })
	return a
}

func jsIsArray(v any) bool {
	if v == nil {
		return false
	}
	return reflect.TypeOf(v).Kind() == reflect.Slice
}

func jsByteAt(a []int32, i int) int32 {
	if i < len(a) {
		return a[i]
	}
	return 0
}

// ----- bytes (OpCodes conversions)

func jsHexDigit(c byte) int {
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0')
	case c >= 'a' && c <= 'f':
		return int(c-'a') + 10
	case c >= 'A' && c <= 'F':
		return int(c-'A') + 10
	}
	return -1
}

func jsHex8ToBytes(s string) []uint8 {
	out := make([]uint8, 0, len(s)/2)
	for i := 0; i+1 < len(s); i += 2 {
		h, l := jsHexDigit(s[i]), jsHexDigit(s[i+1])
		if h < 0 || l < 0 {
			panic(jsNewError("Error", "Hex8ToBytes: Invalid hex characters found"))
		}
		out = append(out, uint8(h<<4|l))
	}
	return out
}

func jsHex16ToWords(s string) []uint16 {
	out := []uint16{}
	for i := 0; i+3 < len(s); i += 4 {
		v, _ := strconv.ParseUint(s[i:i+4], 16, 16)
		out = append(out, uint16(v))
	}
	return out
}

func jsHex32ToDWords(s string) []uint32 {
	out := []uint32{}
	for i := 0; i < len(s); i += 8 {
		e := min(i+8, len(s))
		v, _ := strconv.ParseUint(s[i:e], 16, 32)
		out = append(out, uint32(v))
	}
	return out
}

func jsAnsiToBytes(s string) []uint8 {
	out := make([]uint8, len(s))
	for i := 0; i < len(s); i++ {
		out[i] = s[i] & 0x7F
	}
	return out
}

func jsAsciiToBytes(s string) []uint8 { return []uint8(s) }

func jsUtf8ToBytes(s string) []uint8 {
	out := []uint8{}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c < 0x80 {
			out = append(out, c)
		} else {
			out = append(out, 0xC0|c>>6, 0x80|c&0x3F)
		}
	}
	return out
}

func jsBytesToAnsi(b []uint8) string {
	out := make([]byte, len(b))
	for i, c := range b {
		out[i] = c & 0x7F
	}
	return string(out)
}

func jsBytesToAscii(b []uint8) string { return string(b) }

func jsBytesToUtf8(b []uint8) string {
	out := []byte{}
	for i := 0; i < len(b); i++ {
		c := b[i]
		if c < 0x80 {
			out = append(out, c)
		} else if c&0xE0 == 0xC0 && i+1 < len(b) {
			out = append(out, byte((uint16(c&0x1F)<<6)|uint16(b[i+1]&0x3F)))
			i++
		} else {
			out = append(out, '?')
		}
	}
	return string(out)
}

func jsUnpack16BE(w uint32) []uint8 { return []uint8{uint8(w >> 8), uint8(w)} }
func jsUnpack16LE(w uint32) []uint8 { return []uint8{uint8(w), uint8(w >> 8)} }
func jsUnpack32BE(w uint32) []uint8 { return []uint8{uint8(w >> 24), uint8(w >> 16), uint8(w >> 8), uint8(w)} }
func jsUnpack32LE(w uint32) []uint8 { return []uint8{uint8(w), uint8(w >> 8), uint8(w >> 16), uint8(w >> 24)} }
func jsUnpack64BE(w uint64) []uint8 {
	return []uint8{uint8(w >> 56), uint8(w >> 48), uint8(w >> 40), uint8(w >> 32), uint8(w >> 24), uint8(w >> 16), uint8(w >> 8), uint8(w)}
}
func jsUnpack64LE(w uint64) []uint8 {
	return []uint8{uint8(w), uint8(w >> 8), uint8(w >> 16), uint8(w >> 24), uint8(w >> 32), uint8(w >> 40), uint8(w >> 48), uint8(w >> 56)}
}

func jsXorArrays(a, b []uint8) []uint8 {
	n := min(len(a), len(b))
	out := make([]uint8, n)
	for i := 0; i < n; i++ {
		out[i] = a[i] ^ b[i]
	}
	return out
}

// ----- OpCodes methods the IL keeps as calls

func opGetByte(word uint32, n int32) uint8 { return uint8(word >> (uint32(n*8) & 31)) }
func opGF256Mul(a, b int32) uint8 {
	x, y := uint8(a), uint8(b)
	var r uint8
	for i := 0; i < 8; i++ {
		if y&1 != 0 {
			r ^= x
		}
		hi := x & 0x80
		x <<= 1
		if hi != 0 {
			x ^= 0x1B
		}
		y >>= 1
	}
	return r
}
func opGFMul(a, b, poly, width int32) int32 {
	var r int32
	mask := int32(1)<<uint32(width) - 1
	top := int32(1) << uint32(width-1)
	for b != 0 {
		if b&1 != 0 {
			r ^= a
		}
		hi := a & top
		a = (a << 1) & mask
		if hi != 0 {
			a ^= poly & mask
		}
		b >>= 1
	}
	return r
}
func opSetBit(v uint32, bit int32, on int32) uint32 {
	if on != 0 {
		return v | 1<<(uint32(bit)&31)
	}
	return v &^ (1 << (uint32(bit) & 31))
}
func opGetBit(v uint32, bit int32) bool { return (v>>(uint32(bit)&31))&1 != 0 }
func opBitMask(n int32) uint32 {
	if n >= 32 {
		return 0xFFFFFFFF
	}
	if n <= 0 {
		return 0
	}
	return uint32(int32(1)<<uint32(n) - 1)
}
func opShr32Signed(v, n int32) int32 { return v >> (uint32(n) & 31) }
func opMulHi32(a, b uint32) uint32  { return uint32((uint64(a) * uint64(b)) >> 32) }
func opPopCount(v uint32) int32     { return int32(bits.OnesCount32(v)) }
func opPopCountFast(v uint32) int32 { return int32(bits.OnesCount32(v)) }
func opBitCountN(v *big.Int) int32 {
	n := 0
	for _, w := range new(big.Int).Abs(v).Bits() {
		n += bits.OnesCount64(uint64(w))
	}
	return int32(n)
}
func opHex32ToDWords(s string) []uint32 { return jsHex32ToDWords(s) }
func opSecureCompare(a, b []uint8) bool {
	if len(a) != len(b) {
		return false
	}
	var r uint8
	for i := range a {
		r |= a[i] ^ b[i]
	}
	return r == 0
}
func opConstantTimeCompare(a, b []uint8, n int32) bool {
	l := int(n)
	if l == 0 {
		l = min(len(a), len(b))
	}
	r := 0
	for i := 0; i < l; i++ {
		var x, y uint8
		if i < len(a) {
			x = a[i]
		}
		if i < len(b) {
			y = b[i]
		}
		r |= int(x ^ y)
	}
	r |= len(a) ^ len(b)
	return r == 0
}
func opArraysEqual(a, b []uint8) bool { return opSecureCompare(a, b) }
func opBytesToChars(b []uint8) string { return string(b) }
func opWords32ToBytesBE(w []uint32) []uint8 {
	out := make([]uint8, 0, len(w)*4)
	for _, x := range w {
		out = append(out, jsUnpack32BE(x)...)
	}
	return out
}
func opBytesToWords32BE(b []uint8) []uint32 {
	out := make([]uint32, 0, len(b)/4)
	for i := 0; i+3 < len(b); i += 4 {
		out = append(out, uint32(b[i])<<24|uint32(b[i+1])<<16|uint32(b[i+2])<<8|uint32(b[i+3]))
	}
	return out
}
func opXorArrayWithByte(a []uint8, v int32) []uint8 {
	out := make([]uint8, len(a))
	for i, x := range a {
		out[i] = x ^ uint8(v)
	}
	return out
}
func opGCMIncrement(c []uint8) []uint8 {
	out := jsCopy(c)
	for i := len(out) - 1; i >= len(out)-4 && i >= 0; i-- {
		out[i]++
		if out[i] != 0 {
			break
		}
	}
	return out
}
func opGHashMul(x, y []uint8) []uint8 {
	z := make([]uint8, 16)
	v := jsCopy(y)
	for i := 0; i < 128; i++ {
		if (x[i>>3]>>(7-uint(i&7)))&1 != 0 {
			for j := 0; j < 16; j++ {
				z[j] ^= v[j]
			}
		}
		lsb := v[15] & 1
		for j := 15; j > 0; j-- {
			v[j] = v[j]>>1 | v[j-1]<<7
		}
		v[0] >>= 1
		if lsb != 0 {
			v[0] ^= 0xE1
		}
	}
	return z
}
func opEncodeMsgLength64LE(n float64) []uint8 {
	bitsLen := uint64(n) * 8
	return jsUnpack64LE(bitsLen)
}
func opSecureRandomBytes(n int32) []uint8 {
	out := make([]uint8, n)
	for i := range out {
		out[i] = uint8(jsRandom() * 256)
	}
	return out
}
func opRotL64n(v *big.Int, n int32) *big.Int {
	x := jsBigToU64(v)
	return jsBigFromU64(bits.RotateLeft64(x, int(n&63)))
}
func opRotR64n(v *big.Int, n int32) *big.Int {
	x := jsBigToU64(v)
	return jsBigFromU64(bits.RotateLeft64(x, -int(n&63)))
}
func opRotL128n(v *big.Int, n int32) *big.Int {
	m := jsBigAsUintN(128, v)
	k := uint(n & 127)
	if k == 0 {
		return m
	}
	l := new(big.Int).Lsh(m, k)
	r := new(big.Int).Rsh(m, 128-k)
	return jsBigAsUintN(128, l.Or(l, r))
}
func opGcdN(a, b *big.Int) *big.Int {
	x, y := new(big.Int).Abs(a), new(big.Int).Abs(b)
	return new(big.Int).GCD(nil, nil, x, y)
}
func opModN(a, m *big.Int) *big.Int {
	r := new(big.Int).Rem(a, m)
	if r.Sign() < 0 {
		r.Add(r, m)
	}
	return r
}
func opAddMod(a, b, m *big.Int) *big.Int    { return opModN(new(big.Int).Add(a, b), m) }
func opSubMod(a, b, m *big.Int) *big.Int    { return opModN(new(big.Int).Sub(a, b), m) }
func opMulModN(a, b, m *big.Int) *big.Int   { return opModN(new(big.Int).Mul(a, b), m) }
func opSquareModN(a, m *big.Int) *big.Int   { return opModN(new(big.Int).Mul(a, a), m) }
func opModPowN(b, e, m *big.Int) *big.Int {
	if m.Cmp(big.NewInt(1)) == 0 {
		return big.NewInt(0)
	}
	return new(big.Int).Exp(opModN(b, m), e, m)
}
func opModInverseN(a, m *big.Int) *big.Int {
	r := new(big.Int).ModInverse(opModN(a, m), m)
	if r == nil {
		panic(jsNewError("Error", "Modular inverse does not exist"))
	}
	return r
}
func opGetBitN(v *big.Int, n int32) int32 { return int32(new(big.Int).Rsh(v, uint(n)).Bit(0)) }
func opToLong(f float64) int64            { return jsF2I(f) }
func opToShort(f float64) int16           { return int16(jsF2I(f)) }
func opAdd3L64(a, b, c uint32) float64    { return float64(uint64(a) + uint64(b) + uint64(c)) }
func opAdd3H64(lo float64, a, b, c uint32) uint32 {
	return uint32(uint64(a) + uint64(b) + uint64(c) + uint64(lo/4294967296))
}
func opCreateUint64ArrayFromHex(s string) []uint64 {
	out := []uint64{}
	for i := 0; i < len(s); i += 16 {
		v, _ := strconv.ParseUint(s[i:min(i+16, len(s))], 16, 64)
		out = append(out, v)
	}
	return out
}
func opRotL64_HL(h, l uint32, n int32) JsObject {
	x := bits.RotateLeft64(uint64(h)<<32|uint64(l), int(n&63))
	return jsMapOf("high", uint32(x>>32), "low", uint32(x))
}
func opSplit64(v any) JsObject {
	x := uint64(jsI64(v))
	return jsMapOf("high32", uint32(x>>32), "low32", uint32(x))
}

// ===== end of the runtime =====
`;

  const exported = { GoTransformer, GO_RUNTIME, OPCODES_SIGNATURES };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (global) { global.GoTransformer = GoTransformer; global.GoTransformerModule = exported; }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
