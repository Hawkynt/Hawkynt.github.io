/**
 * RustTransformer.js - IL AST to Rust AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> IL AST -> RustTransformer -> Rust AST -> RustEmitter -> Rust Source
 *
 * Every Rust type comes from an IL type (resultType, declared field and
 * parameter types, JSDoc returns); nothing is guessed from a name or a value.
 *
 * The object model (see ILProgramModel.js) keeps JavaScript's reference
 * semantics without fighting the borrow checker:
 * - arrays are JsArr<T>, a shared, growable Rc<RefCell<Vec<T>>> (cloning one
 *   aliases it, as assigning a JavaScript array does);
 * - every class is a handle C(Option<Rc<RefCell<CData>>>) whose data holds the
 *   fields of its whole base chain, AlgorithmFramework.js's included, with every
 *   inherited method emitted on it; fields are read and written through
 *   accessor methods, so no borrow outlives one field access;
 * - a type with subclasses, and any untyped object, is JsObj (members by name
 *   through the JsObject trait, as JavaScript resolves them); any value of no
 *   one type is JsAny; BigInt is the runtime's JsBig (no external crates);
 * - a local variable a closure captures lives in a shared cell (JsCell), so the
 *   closure and the function see one variable.
 *
 * Numbers follow JavaScript: an IL type of fixed width is that Rust type and
 * its arithmetic wraps (wrapping_add, wrapping_mul, ...) exactly where the IL
 * type is fixed-width; bitwise operators work on 32 bits as ToInt32/ToUint32
 * do, BigInt operators at full width. A throw is a panic carrying the thrown
 * value; try/catch is catch_unwind.
 */

(function (global) {
  'use strict';

  let RustAST, Model;
  if (typeof require !== 'undefined') {
    RustAST = require('./RustAST.js');
    Model = require('./ILProgramModel.js');
  } else {
    RustAST = global.RustAST;
    Model = global.ILProgramModel;
  }

  const R = RustAST;
  const { canonicalType, isArrayType, elementType, isIntType, isFloatType, isNumericType, isBigType, intBits, isSignedInt } = Model;

  /** The name of a property key: the IL keeps it as a string, ESTree as an Identifier or Literal. */
  const propKey = k => typeof k === 'string' ? k : (k && (k.name !== undefined ? k.name : String(k.value)));

  const RUST_KEYWORDS = new Set(['as', 'async', 'await', 'break', 'const', 'continue', 'crate', 'dyn', 'else', 'enum', 'extern', 'false',
    'fn', 'for', 'if', 'impl', 'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return', 'self', 'Self', 'static',
    'struct', 'super', 'trait', 'true', 'type', 'unsafe', 'use', 'where', 'while', 'abstract', 'become', 'box', 'do', 'final', 'macro',
    'override', 'priv', 'try', 'typeof', 'unsized', 'virtual', 'yield', 'union', 'gen']);
  const RESERVED = new Set(['this', 'main', 'std', 'core', 'alloc', 'Some', 'None', 'Ok', 'Err', 'Option', 'Result', 'Vec', 'String',
    'Box', 'Rc', 'RefCell', 'Cell', 'Ref', 'RefMut', 'HashMap', 'Default', 'Clone', 'Any', 'drop', 'vec', 'format', 'panic', 'assert']);

  /** A Rust string literal holding a JavaScript string (characters as \u{..} escapes when not printable ASCII). */
  function rustStringLiteral(s) {
    let out = '"';
    for (const ch of String(s)) {
      const code = ch.codePointAt(0);
      if (code === 0x22) out += '\\"';
      else if (code === 0x5c) out += '\\\\';
      else if (code === 0x0a) out += '\\n';
      else if (code === 0x0d) out += '\\r';
      else if (code === 0x09) out += '\\t';
      else if (code >= 0x20 && code < 0x7f) out += ch;
      else if (code >= 0xD800 && code < 0xE000) out += '?';
      else out += `\\u{${code.toString(16)}}`;
    }
    return out + '"';
  }

  /** The Rust spelling of a JavaScript constant of an IL type (a typed literal). */
  function rustConstLiteral(c, t) {
    if (c === null || c === undefined) return 'JsAny::undefined()';
    if (typeof c === 'string') return rustStringLiteral(c) + '.to_string()';
    if (typeof c === 'boolean') return String(c);
    const suffix = { uint8: 'u8', uint16: 'u16', uint32: 'u32', uint64: 'u64', int8: 'i8', int16: 'i16', int32: 'i32', int64: 'i64' }[t];
    if (typeof c === 'bigint') {
      if (suffix) return c < 0n ? `(${c}${suffix})` : `${c}${suffix}`;
      return c >= -(2n ** 63n) && c < 2n ** 63n ? `JsBig::from_i64(${c < 0n ? `(${c}i64)` : `${c}i64`})` : `js_big_lit("${c}")`;
    }
    if (Number.isNaN(c)) return 'f64::NAN';
    if (!Number.isFinite(c)) return c > 0 ? 'f64::INFINITY' : 'f64::NEG_INFINITY';
    if (suffix && Number.isInteger(c)) return c < 0 ? `(${c}${suffix})` : `${c}${suffix}`;
    const s = String(c);
    return (c < 0 ? '(' : '') + (/[.e]/.test(s) ? s.replace(/e/, s.includes('.') ? 'e' : '.0e') : s + '.0') + 'f64' + (c < 0 ? ')' : '');
  }

  /** A Rust expression with its IL type (and its value when it is a compile-time constant). */
  class Val {
    constructor(e, t, c) {
      this.t = t;
      if (c !== undefined) this.c = c;
      this.e = e || (c !== undefined ? R.Lit(rustConstLiteral(c, t)) : R.Lit('()'));
    }
    get isConst() { return this.c !== undefined; }
  }

  class RustTransformer {
    constructor(options = {}) {
      this.options = options;
      this.warnings = [];
    }

    // ======================================================================
    // ENTRY
    // ======================================================================

    /**
     * Transform an IL Program into a Rust File.
     * @param {Object} ast - IL AST (Program)
     * @returns {Object} RustAST File
     */
    transform(ast) {
      this.model = Model.buildModel(ast, { framework: this.options.framework !== false });
      this.prefix = this.options.symbolPrefix || '';
      this.library = !!this.options.library;
      this.items = [];
      this.initStmts = [];
      this.tmpCounter = 0;
      this.labelCounter = 0;
      this.superCopies = new Map();
      this.emittedClasses = new Set();
      this.computeEmittedClasses();
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
          this.items.push(R.Comment(`${item.kind} ${item.name || ''} could not be transpiled: ${e.message}`));
        }
      }
      this.items.push(R.Fn(this.prefix + 'js_module_init', null, [], null, R.Block(this.initStmts),
        'Runs the top-level code of the JavaScript module (registers its algorithms)'));
      const items = [];
      if (!this.library) items.push(R.Raw(RUST_HEADER), R.Raw(RUST_RUNTIME));
      items.push(...this.items);
      return R.File(items);
    }

    computeEmittedClasses() {
      const instantiated = new Set();
      Model.walk(this.model.items.filter(i => i.origin === 'main').map(i => i.node), n => {
        if (n.type === 'NewExpression' && Model.constructedName(n.callee)) instantiated.add(Model.constructedName(n.callee));
      });
      let changed = true;
      while (changed) {
        changed = false;
        for (const info of this.model.classes.values()) {
          if (info.origin !== 'framework' || !instantiated.has(info.name) || info._scannedRust) continue;
          info._scannedRust = true;
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
      if (RUST_KEYWORDS.has(n) || RESERVED.has(n) || /^(js_|Js|JS_|op_|vh_)/.test(n) || n === '_') n += '_';
      return n;
    }

    className(name) { return this.prefix + this.ident(name); }
    methodName(name) { return this.ident(name); }
    getterName(name) { return 'get_' + String(name).replace(/[^A-Za-z0-9_]/g, '_'); }
    setterName(name) { return 'set_' + String(name).replace(/[^A-Za-z0-9_]/g, '_'); }
    fieldGet(name) { return 'fld_' + String(name).replace(/[^A-Za-z0-9_]/g, '_'); }
    fieldSet(name) { return 'fld_set_' + String(name).replace(/[^A-Za-z0-9_]/g, '_'); }
    fieldStore(name) { return 'f_' + String(name).replace(/[^A-Za-z0-9_]/g, '_'); }
    topName(name) {
      const v = this.model.variables.get(name);
      if (v && v.origin === 'framework') return this.ident(name);
      return this.prefix + this.ident(name);
    }
    globalCell(name) { return 'G_' + this.topName(name).toUpperCase(); }
    staticName(cls, name) { return `${this.className(cls)}_${String(name).replace(/[^A-Za-z0-9_]/g, '_')}`; }
    tmp(base = 't') { return `js_${base}${++this.tmpCounter}`; }
    label() { return `'l${++this.labelCounter}`; }

    // ======================================================================
    // TYPES
    // ======================================================================

    isLeafClass(t) {
      const info = this.model.classOf(t);
      return !!info && this.emittedClasses.has(t) && !info.hasSubclasses;
    }

    /** The Rust spelling of an IL type. */
    rustType(t) {
      if (typeof t === 'string' && t.startsWith('#')) return this.className(t.slice(1));
      t = canonicalType(t) || 'any';
      if (t === 'goint' || t === 'idx') return 'usize';
      if (isIntType(t)) return { uint8: 'u8', uint16: 'u16', uint32: 'u32', uint64: 'u64', int8: 'i8', int16: 'i16', int32: 'i32', int64: 'i64' }[t];
      if (isFloatType(t)) return 'f64';
      if (isBigType(t)) return 'JsBig';
      switch (t) {
        case 'boolean': return 'bool';
        case 'string': return 'String';
        case 'void': return '()';
        case 'any': case 'null': case 'function': case 'undefined': return 'JsAny';
        case 'regex': case 'RegExp': return 'JsRegex';
        case 'Error': case 'TypeError': case 'RangeError': return 'JsError';
        case 'Map': case 'Set': return 'JsMap';
        case 'object': return 'JsObj';
      }
      if (/^Map</.test(t)) return 'JsMap';
      if (isArrayType(t)) {
        const el = elementType(t);
        return `JsArr<${this.rustType(el === 'object' || el === 'any' ? 'any' : el)}>`;
      }
      if (t.startsWith('[') && t.endsWith(']')) return 'JsArr<JsAny>';
      if (t.startsWith('(') || t.includes('=>')) return 'JsAny';
      if (this.isLeafClass(t)) return this.className(t);
      return 'JsObj';
    }

    typeOfNullable(t, nullable) {
      return nullable && (isNumericType(canonicalType(t)) || canonicalType(t) === 'boolean') ? 'any' : (canonicalType(t) || 'any');
    }

    rustTypeNullable(t, nullable) { return this.rustType(this.typeOfNullable(t, nullable)); }

    /** Copy types are read without a clone. */
    isCopy(t) {
      const r = this.rustType(t);
      return /^(u8|u16|u32|u64|i8|i16|i32|i64|f64|bool|usize)$/.test(r);
    }

    zero(t) {
      const r = this.rustType(t);
      if (r === '()') return R.Lit('()');
      if (/^(u8|u16|u32|u64|i8|i16|i32|i64|usize)$/.test(r)) return R.Lit(`0${r}`);
      if (r === 'f64') return R.Lit('0.0f64');
      if (r === 'bool') return R.Lit('false');
      if (r === 'String') return R.Call(R.Ident('String::new'), []);
      return R.Call(R.Ident(`${this.turbofishType(r)}::default`), []);
    }

    /** A type name usable as a path prefix (JsArr<u8> -> JsArr::<u8>). */
    turbofishType(r) { return r.replace(/^(\w+)</, '$1::<'); }

    sameRust(a, b) { return this.rustType(a) === this.rustType(b); }

    // ======================================================================
    // CONVERSION
    // ======================================================================

    numKind(r) {
      if (/^(u8|u16|u32|u64|i8|i16|i32|i64|usize)$/.test(r)) return 'int';
      if (r === 'f64') return 'float';
      return null;
    }

    /** A Rust expression of IL type `to` for a value. */
    coerce(v, to) {
      to = canonicalType(to) || 'any';
      if (!(v instanceof Val)) throw new Error('coerce of a non-value');
      const from = canonicalType(v.t) || 'any';
      const rf = this.rustType(from);
      const rt = this.rustType(to);
      if (to === 'void') return v.e;
      if (v.isConst) return this.constTo(v, to);
      if ((from === 'closure' || from === 'fnref') && v.sig) {
        // A function as a value: the dynamic calling convention (JsAny in, JsAny out)
        const fnAny = v.anyFn || this.functionAsAny(v);
        return rt === 'JsAny' ? fnAny : this.coerce(new Val(fnAny, 'any'), to);
      }
      if (rf === rt) return v.e;
      if (from === 'null') return this.zero(to);
      if (rt === 'JsAny') return R.MethodCall(v.e, 'to_js', []);
      if (rt === 'JsObj') {
        if (rf === 'JsAny') return R.MethodCall(v.e, 'obj', []);
        if (this.model.classOf(from.replace(/^#/, '')) || rf === 'JsMap') return R.MethodCall(v.e, 'to_obj', []);
        if (rf === 'JsError') return R.Call(R.Ident('JsObj::new'), [R.Call(R.Ident('JsErrorObject'), [v.e])]);
        return R.MethodCall(R.MethodCall(v.e, 'to_js', []), 'obj', []);
      }
      const nf = this.numKind(rf);
      const nt = this.numKind(rt);
      if (nf && nt) {
        if (nf === 'float' && nt === 'int') return R.Cast(R.Call(R.Ident('js_f2i'), [v.e]), rt);
        return R.Cast(v.e, rt);
      }
      if (rt === 'bool') return this.truthy(v);
      if (rf === 'bool' && nt) return nt === 'float' ? R.Cast(R.Call(R.Ident('js_b2i'), [v.e]), 'f64') : R.Cast(R.Call(R.Ident('js_b2i'), [v.e]), rt);
      if (rf === 'JsBig' && nt) return nt === 'float' ? R.MethodCall(v.e, 'to_f64', []) : R.Cast(R.MethodCall(v.e, rt.startsWith('u') ? 'to_u64' : 'to_i64', []), rt);
      if (rt === 'JsBig' && nf) {
        if (nf === 'float') return R.Call(R.Ident('JsBig::from_f64'), [v.e]);
        return rf.startsWith('u') || rf === 'usize' ? R.Call(R.Ident('JsBig::from_u64'), [R.Cast(v.e, 'u64')]) : R.Call(R.Ident('JsBig::from_i64'), [R.Cast(v.e, 'i64')]);
      }
      if (rt === 'String') return R.MethodCall(R.MethodCall(v.e, 'to_js', []), 'text', []);
      if (nt && rf === 'String') {
        const n = R.Call(R.Ident('js_to_number'), [R.Ref(v.e)]);
        return nt === 'float' ? n : R.Cast(R.Call(R.Ident('js_f2i'), [n]), rt);
      }
      if (rf.startsWith('JsArr<') && rt.startsWith('JsArr<')) return R.Call(R.Ident('js_arr_conv'), [R.Ref(v.e)]);
      // Everything else through the dynamic value
      if (rf === 'JsAny') return R.Call(R.Ident(`<${rt}>::from_js`), [R.Ref(v.e)]);
      return R.Call(R.Ident(`<${rt}>::from_js`), [R.Ref(R.MethodCall(v.e, 'to_js', []))]);
    }

    /** A constant in the Rust spelling of IL type `to` (wrapped to the width as ToIntN does). */
    constTo(v, to) {
      const c = v.c;
      const rt = this.rustType(to);
      if (c === null || c === undefined) return this.zero(to);
      if (typeof c === 'string') {
        if (rt === 'String') return R.MethodCall(R.Lit(rustStringLiteral(c)), 'to_string', []);
        if (this.numKind(rt)) return this.constTo(new Val(null, 'float64', Number(c)), to);
        return this.coerce(new Val(R.MethodCall(R.Lit(rustStringLiteral(c)), 'to_string', []), 'string'), to);
      }
      if (typeof c === 'boolean') {
        if (rt === 'bool') return R.Lit(String(c));
        if (this.numKind(rt)) return R.Lit(c ? `1${rt === 'f64' ? '.0f64' : rt}` : `0${rt === 'f64' ? '.0f64' : rt}`);
        return this.coerce(new Val(R.Lit(String(c)), 'boolean'), to);
      }
      if (typeof c === 'bigint') {
        if (rt === 'JsBig') return this.bigLit(c);
        if (this.numKind(rt) === 'int') return R.Lit(this.intLit(this.wrapBig(c, to), rt));
        if (rt === 'f64') return R.Lit(this.floatLit(Number(c)));
        return this.coerce(new Val(this.bigLit(c), 'bigint'), to);
      }
      if (typeof c === 'number') {
        if (rt === 'JsBig') return this.bigLit(BigInt(Math.trunc(Number.isFinite(c) ? c : 0)));
        if (this.numKind(rt) === 'int') {
          if (!Number.isFinite(c)) return R.Lit(`0${rt}`);
          return R.Lit(this.intLit(this.wrapBig(BigInt(Math.trunc(c)), to === 'goint' || to === 'idx' ? 'uint64' : canonicalType(to)), rt));
        }
        if (rt === 'f64') return R.Lit(this.floatLit(c));
        if (rt === 'bool') return R.Lit(c !== 0 && !Number.isNaN(c) ? 'true' : 'false');
        if (rt === 'String') return R.MethodCall(R.Lit(rustStringLiteral(String(c))), 'to_string', []);
        const ft = canonicalType(v.t);
        const natural = isNumericType(ft) ? ft : (Number.isInteger(c) ? 'int32' : 'float64');
        return this.coerce(new Val(this.constTo(v, natural), natural), to);
      }
      return this.zero(to);
    }

    wrapBig(b, t) {
      const bits = intBits(t) || 64;
      return isSignedInt(t) ? BigInt.asIntN(bits, b) : BigInt.asUintN(bits, b);
    }

    intLit(b, r) {
      if (b < 0n) return `(${b}${r})`.replace(`(${b}${r})`, b === -(2n ** BigInt(parseInt(r.slice(1)) - 1)) ? `${r}::MIN` : `(${b}${r})`);
      return `${b}${r}`;
    }

    floatLit(n) {
      if (Number.isNaN(n)) return 'f64::NAN';
      if (n === Infinity) return 'f64::INFINITY';
      if (n === -Infinity) return 'f64::NEG_INFINITY';
      let s = String(n);
      if (!/[.e]/.test(s)) s += '.0';
      if (/e/.test(s) && !/\./.test(s.split('e')[0])) s = s.replace('e', '.0e');
      return n < 0 ? `(${s}f64)` : `${s}f64`;
    }

    bigLit(b) {
      if (b >= -(2n ** 63n) && b < 2n ** 63n) return R.Call(R.Ident('JsBig::from_i64'), [R.Lit(b < 0n ? (b === -(2n ** 63n) ? 'i64::MIN' : `(${b}i64)`) : `${b}i64`)]);
      return R.Call(R.Ident('js_big_lit'), [R.Lit(`"${b.toString()}"`)]);
    }

    /** A boolean Rust expression for JavaScript truthiness of a value. */
    truthy(v) {
      if (v.isConst) return R.Lit(v.c ? 'true' : 'false');
      const r = this.rustType(v.t);
      if (r === 'bool') return v.e;
      if (this.numKind(r) === 'int') return R.Binary('!=', v.e, R.Lit(`0${r}`));
      if (r === 'f64') return R.Call(R.Ident('js_truthy_f64'), [v.e]);
      if (r === 'String') return R.Unary('!', R.MethodCall(v.e, 'is_empty', []));
      if (r === 'JsAny') return R.MethodCall(v.e, 'truthy', []);
      if (r === 'JsBig') return R.Unary('!', R.MethodCall(v.e, 'is_zero', []));
      if (r === 'JsError' || r === 'JsMap') return R.Lit('true');
      return R.Unary('!', R.MethodCall(v.e, 'is_null', []));
    }

    // ======================================================================
    // CLASSES
    // ======================================================================

    emitClass(info) {
      const name = this.className(info.name);
      const eff = info.effective;
      const dataName = name + 'Data';
      const fields = [];
      for (const [fname, f] of eff.fields) fields.push({ name: this.fieldStore(fname), type: this.rustTypeNullable(f.type, f.nullable) });
      fields.push({ name: 'js_extra', type: 'HashMap<String, JsAny>' });
      const chainNames = info.chain().map(c => c.name).join(' < ');
      this.items.push(R.Struct(dataName, fields, ['Default'], `The fields of the JavaScript class ${info.name}` + (info.base ? ` (${chainNames})` : '')));
      this.items.push(R.Struct(`${name}(pub Option<Rc<RefCell<${dataName}>>>)`.replace(/^/, ''), [], ['Clone', 'Default'], `A reference to a ${info.name} (null when empty)`));

      const methods = [];
      methods.push(R.Raw([
        `    fn d(&self) -> Ref<'_, ${dataName}> {`,
        `        match &self.0 { Some(r) => r.borrow(), None => js_throw_error("TypeError", "Cannot read properties of null (${info.name})") }`,
        '    }',
        `    fn dm(&self) -> RefMut<'_, ${dataName}> {`,
        `        match &self.0 { Some(r) => r.borrow_mut(), None => js_throw_error("TypeError", "Cannot set properties of null (${info.name})") }`,
        '    }',
        '    pub fn is_null(&self) -> bool { self.0.is_none() }',
        `    pub fn to_obj(&self) -> JsObj { if self.0.is_none() { JsObj::null() } else { JsObj::new(self.clone()) } }`,
        `    pub fn ptr_eq(&self, other: &${name}) -> bool { match (&self.0, &other.0) { (Some(a), Some(b)) => Rc::ptr_eq(a, b), (None, None) => true, _ => false } }`
      ].join('\n')));
      for (const [fname, f] of eff.fields) {
        const t = this.rustTypeNullable(f.type, f.nullable);
        methods.push(R.Raw(`    pub fn ${this.fieldGet(fname)}(&self) -> ${t} { self.d().${this.fieldStore(fname)}.clone() }\n    pub fn ${this.fieldSet(fname)}(&self, v: ${t}) { self.dm().${this.fieldStore(fname)} = v; }`));
      }

      // Static members
      for (const [sname, s] of eff.staticFields) {
        if (s.owner !== info) continue;
        const t = s.type || (s.init && s.init.resultType) || 'any';
        this.emitGlobal(this.staticName(info.name, sname), t, s.init);
      }
      for (const [mname, m] of eff.staticMethods) {
        if (m.owner !== info) continue;
        this.items.push(this.emitFunctionDecl(this.staticName(info.name, mname), null, m.fn, m.jsDoc, null));
      }
      for (const block of info.staticBlocks || []) {
        this.withFunction({ returnType: 'void', cls: null }, () => {
          this.initStmts.push(R.Block(this.stmts(block.body || [])));
        });
      }

      // Construction: new() and one init per class of the chain
      const chain = info.chain();
      const ctorOwner = [...chain].reverse().find(c => c.ctor) || null;
      const ctorParams = ctorOwner ? Model.functionParams(ctorOwner.ctor, ctorOwner.ctorDoc) : [];
      const newParams = ctorParams.map(p => ({ name: 'mut ' + this.ident(p.name), type: this.rustTypeNullable(p.type, p.nullable) }));
      methods.push(R.Fn('new', null, newParams, name, R.Block([
        R.Let('this', null, R.Call(R.Ident(name), [R.Call(R.Ident('Some'), [R.Call(R.Ident('Rc::new'), [R.Call(R.Ident('RefCell::new'), [R.Call(R.Ident(`${dataName}::default`), [])])])])]), false),
        R.ExprStmt(R.MethodCall(R.Ident('this'), this.initName(info), ctorParams.map(p => R.Ident(this.ident(p.name))))),
      ], R.Ident('this')), `Constructs a ${info.name}`));
      for (const c of chain) methods.push(this.emitInit(info, c));
      for (const [mname, m] of eff.methods) methods.push(this.emitFunctionDecl(this.methodName(mname), '&self', m.fn, m.jsDoc, info));
      for (const [gname, g] of eff.getters) methods.push(this.emitFunctionDecl(this.getterName(gname), '&self', g.fn, g.jsDoc, info));
      for (const [sname, s] of eff.setters) methods.push(this.emitFunctionDecl(this.setterName(sname), '&self', s.fn, s.jsDoc, info));
      for (const [key, copy] of [...this.superCopies.entries()].filter(([, v]) => v.cls === info)) methods.push(this.emitFunctionDecl(key, '&self', copy.fn, copy.jsDoc, info));
      this.items.push(R.Impl(name, methods));
      this.items.push(...this.emitProtocol(info, name));
    }

    initName(c) { return `js_init_${String(c.name).replace(/[^A-Za-z0-9_]/g, '_')}`; }

    emitInit(info, c) {
      if (c.ctor) return this.emitFunctionDecl(this.initName(c), '&self', c.ctor, c.ctorDoc, info, { init: c });
      const owner = c.base ? [...c.base.chain()].reverse().find(x => x.ctor) : null;
      const params = owner ? Model.functionParams(owner.ctor, owner.ctorDoc) : [];
      const rp = params.map(p => ({ name: 'mut ' + this.ident(p.name), type: this.rustTypeNullable(p.type, p.nullable) }));
      const stmts = [];
      if (c.base) stmts.push(R.ExprStmt(R.MethodCall(R.Ident('self'), this.initName(c.base), params.map(p => R.Ident(this.ident(p.name))))));
      stmts.push(...this.fieldInitializers(info, c));
      return R.Fn(this.initName(c), '&self', rp, null, R.Block(stmts));
    }

    fieldInitializers(info, c) {
      const out = [];
      for (const fd of c.fieldInits || []) {
        if (!fd.value) continue;
        const fname = propKey(fd.key);
        const f = info.effective.fields.get(fname);
        if (!f) continue;
        this.withFunction({ returnType: 'void', cls: info, self: true }, () => {
          const v = this.expr(fd.value);
          out.push(...this.flushPre(), R.ExprStmt(R.MethodCall(R.Ident('self'), this.fieldSet(fname), [this.coerce(v, this.typeOfNullable(f.type, f.nullable))])));
        });
      }
      return out;
    }

    /** impl JsObject / JsDyn / ToJs / FromJs: the members of a class by their JavaScript names. */
    emitProtocol(info, name) {
      const eff = info.effective;
      const q = s => rustStringLiteral(s);
      const lines = [];
      lines.push(`impl JsObject for ${name} {`, '    fn as_any(&self) -> &dyn Any { self }');
      // js_get
      lines.push('    fn js_get(&self, name: &str) -> JsAny {', '        match name {');
      for (const [fname] of eff.fields) lines.push(`            ${q(fname)} => self.${this.fieldGet(fname)}().to_js(),`);
      for (const [gname] of eff.getters) lines.push(`            ${q(gname)} => self.${this.getterName(gname)}().to_js(),`);
      for (const [mname] of eff.methods) if (!eff.getters.has(mname)) lines.push(`            ${q(mname)} => { let o = self.clone(); js_func(move |a| o.js_call(${q(mname)}, a)) }`);
      lines.push('            _ => self.d().js_extra.get(name).cloned().unwrap_or_default(),', '        }', '    }');
      // js_set
      lines.push('    fn js_set(&self, name: &str, value: JsAny) {', '        match name {');
      for (const [fname, f] of eff.fields) lines.push(`            ${q(fname)} => self.${this.fieldSet(fname)}(<${this.rustTypeNullable(f.type, f.nullable)}>::from_js(&value)),`);
      const accessorNames = new Set([...eff.getters.keys(), ...eff.setters.keys()]);
      for (const aname of accessorNames) {
        const s = eff.setters.get(aname);
        if (s) {
          const p = Model.functionParams(s.fn, s.jsDoc)[0] || { type: 'any', nullable: false };
          lines.push(`            ${q(aname)} => self.${this.setterName(aname)}(<${this.rustTypeNullable(p.type, p.nullable)}>::from_js(&value)),`);
        } else {
          lines.push(`            ${q(aname)} => js_throw_error("TypeError", ${q('Cannot set property ' + aname + ' which has only a getter')}),`);
        }
      }
      lines.push('            _ => { self.dm().js_extra.insert(name.to_string(), value); }', '        }', '    }');
      // js_call
      lines.push('    fn js_call(&self, name: &str, args: Vec<JsAny>) -> JsAny {', '        match name {');
      for (const [mname, m] of eff.methods) {
        const params = Model.functionParams(m.fn, m.jsDoc);
        const ret = this.signatureReturn(m.fn, m.jsDoc);
        const args = params.map((p, i) => {
          const rt = this.rustTypeNullable(p.type, p.nullable);
          if (p.defaultValue) {
            let dflt = null;
            this.withFunction({ returnType: 'void', cls: info, self: true }, () => {
              const v = this.expr(p.defaultValue);
              if (!this.fn.pre.length) dflt = this.emitExprText(this.coerce(v, 'any'));
              this.fn.pre = [];
            });
            return `<${rt}>::from_js(&js_arg_or(&args, ${i}, ${dflt || 'JsAny::undefined()'}))`;
          }
          return `<${rt}>::from_js(&js_arg(&args, ${i}))`;
        });
        const call = `self.${this.methodName(mname)}(${args.join(', ')})`;
        lines.push(ret.type === 'void' ? `            ${q(mname)} => { ${call}; JsAny::undefined() }` : `            ${q(mname)} => ${call}.to_js(),`);
      }
      lines.push('            _ => {', '                let f = self.d().js_extra.get(name).cloned();',
        `                match f { Some(f) => f.call(args), None => js_throw_error("TypeError", &format!("${info.name}.{} is not a function", name)) }`,
        '            }', '        }', '    }');
      const all = [...new Set([...eff.fields.keys(), ...accessorNames, ...eff.methods.keys()])];
      lines.push(`    fn js_has(&self, name: &str) -> bool { ${all.length ? `matches!(name, ${all.map(q).join(' | ')}) || ` : ''}self.d().js_extra.contains_key(name) }`);
      lines.push(`    fn js_has_method(&self, name: &str) -> bool { ${eff.methods.size ? `matches!(name, ${[...eff.methods.keys()].map(q).join(' | ')}) || ` : ''}self.d().js_extra.get(name).map(|f| f.is_func()).unwrap_or(false) }`);
      lines.push('    fn js_ident(&self) -> usize { self.0.as_ref().map(|r| Rc::as_ptr(r) as *const u8 as usize).unwrap_or(0) }');
      lines.push('    fn js_is_null(&self) -> bool { self.0.is_none() }');
      lines.push('}');
      lines.push(`impl JsDyn for ${name} {`, '    fn as_any(&self) -> &dyn Any { self }',
        '    fn obj(&self) -> Option<JsObj> { Some(self.to_obj()) }', '    fn truthy(&self) -> bool { self.0.is_some() }',
        '    fn ident(&self) -> usize { JsObject::js_ident(self) }', '}');
      lines.push(`impl ToJs for ${name} {`, '    fn to_js(&self) -> JsAny { if self.0.is_none() { JsAny::undefined() } else { JsAny::new(self.clone()) } }', '}');
      lines.push(`impl FromJs for ${name} {`, `    fn from_js(v: &JsAny) -> ${name} { v.downcast::<${name}>().or_else(|| v.obj().downcast::<${name}>()).unwrap_or_default() }`, '}');
      return [R.Raw(lines.join('\n'))];
    }

    emitExprText(e) {
      if (!this._emitter) {
        const RustEmitter = (typeof require !== 'undefined') ? require('./RustEmitter.js').RustEmitter : global.RustEmitter;
        this._emitter = new RustEmitter({});
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

    withFunction(ctx, body) {
      const saved = this.fn;
      this.fn = Object.assign({ scopes: [new Map()], pre: [], loops: [], cells: new Set() }, ctx);
      try { return body(); } finally { this.fn = saved; }
    }

    /**
     * A Rust function (or method) for a JavaScript function.
     * @param {string} name - Rust name
     * @param {string|null} receiver - '&self' for a method
     * @param {Object} fn - IL FunctionExpression
     * @param {Object} jsDoc - its JSDoc
     * @param {Object|null} cls - the class whose `this` it sees
     * @param {Object} [extra] - { init: ClassInfo } for a constructor body
     */
    emitFunctionDecl(name, receiver, fn, jsDoc, cls, extra = {}) {
      const params = Model.functionParams(fn, jsDoc);
      const ret = extra.init ? { type: 'void' } : this.signatureReturn(fn, jsDoc);
      return this.withFunction({ returnType: ret.type, cls, self: !!receiver, initOf: extra.init || null }, () => {
        this.fn.cells = this.capturedNames(fn);
        const rp = [];
        const prologue = [];
        for (const p of params) {
          const t = this.typeOfNullable(p.type, p.nullable);
          const b = this.declareLocal(p.name, t);
          if (b.cell) {
            const raw = this.ident(p.name) + '_p';
            rp.push({ name: raw, type: this.rustType(t) });
            prologue.push(R.Let(b.rs, null, R.Call(R.Ident('JsCell::new'), [R.Ident(raw)]), false));
          } else {
            rp.push({ name: 'mut ' + b.rs, type: this.rustType(t) });
          }
        }
        let stmts = [...prologue];
        if (extra.init && !this.containsParentCall(fn.body)) {
          if (extra.init.base) stmts.push(R.ExprStmt(R.MethodCall(R.Ident('self'), this.initName(extra.init.base), [])));
          stmts.push(...this.fieldInitializers(cls, extra.init));
        }
        stmts.push(...this.functionBody(fn));
        let tail = null;
        if (ret.type !== 'void' && !this.terminates(stmts)) tail = this.zero(ret.type);
        return R.Fn(name, receiver, rp, ret.type === 'void' ? null : this.rustType(ret.type), R.Block(stmts, tail));
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

    /**
     * Names a nested function or closure of this function refers to: they
     * become shared cells, so the closure and the function see one variable.
     */
    capturedNames(fn) {
      const names = new Set();
      const isFn = n => n.type === 'FunctionExpression' || n.type === 'ArrowFunction' || n.type === 'ArrowFunctionExpression' || n.type === 'FunctionDeclaration';
      Model.walk(fn.body, n => {
        if (n === fn) return;
        if (isFn(n)) {
          Model.walk(n.body, m => { if (m.type === 'Identifier' && m.name) names.add(m.name); });
          return false;
        }
      });
      // Names the closures declare themselves are theirs
      return names;
    }

    functionBody(fn) {
      if (fn.body && fn.body.type === 'BlockStatement') {
        this.hoistVars(fn.body);
        return this.stmts(fn.body.body);
      }
      if (fn.body) {
        const v = this.expr(fn.body);
        const stmts = this.flushPre();
        if (this.fn.returnType === 'void') stmts.push(this.exprStmt(v));
        else stmts.push(R.Return(this.coerce(v, this.fn.returnType)));
        return stmts;
      }
      return [];
    }

    terminates(stmts) {
      const last = stmts[stmts.length - 1];
      return !!last && (last.kind === 'Return');
    }

    hoistVars(body) {
      const hoisted = [];
      Model.walk(body, (n) => {
        if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration' || n.type === 'ArrowFunction' || n.type === 'ArrowFunctionExpression' || n.type === 'ClassDeclaration') return false;
        if (n.type === 'VariableDeclaration' && n.kind === 'var') {
          for (const d of n.declarations) if (d.id && d.id.type === 'Identifier') hoisted.push(d);
          n._hoistedRust = true;
        }
      });
      if (!hoisted.length) return;
      this.fn.hoisted = [];
      const seen = new Set();
      for (const d of hoisted) {
        if (seen.has(d.id.name)) continue;
        seen.add(d.id.name);
        const t = this.typeOfNullable(this.declaratorType(d) || 'any', d.nullable || d.id.nullable);
        const b = this.declareLocal(d.id.name, t);
        this.fn.hoisted.push(this.letLocal(b, this.zero(t)));
      }
    }

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

    declareLocal(name, type) {
      const scope = this.fn.scopes[this.fn.scopes.length - 1];
      const binding = { name, rs: this.ident(name), type: canonicalType(type) || 'any', cell: this.fn.cells.has(name) };
      scope.set(name, binding);
      return binding;
    }

    /** let for a binding: a plain mutable local, or a shared cell. */
    letLocal(b, init) {
      if (b.cell) return R.Let(b.rs, `JsCell<${this.rustType(b.type)}>`, R.Call(R.Ident('JsCell::new'), [init]), false);
      return R.Let(b.rs, this.rustType(b.type), init, true);
    }

    lookup(name) {
      for (let i = this.fn.scopes.length - 1; i >= 0; --i) {
        const b = this.fn.scopes[i].get(name);
        if (b) return b;
      }
      if (this.fn.outer) return this.fn.outer(name);
      return null;
    }

    readLocal(b) {
      if (b.cell) return new Val(R.MethodCall(R.Ident(b.rs), 'get', []), b.type);
      return new Val(this.isCopy(b.type) ? R.Ident(b.rs) : R.MethodCall(R.Ident(b.rs), 'clone', []), b.type);
    }

    writeLocal(b, e) {
      if (b.cell) return R.ExprStmt(R.MethodCall(R.Ident(b.rs), 'set', [e]));
      return R.Assign(R.Ident(b.rs), '=', e);
    }

    pushScope() { this.fn.scopes.push(new Map()); }
    popScope() { return this.fn.scopes.pop(); }

    // ======================================================================
    // TOP LEVEL
    // ======================================================================

    emitTopFunction(item) {
      const node = item.node;
      this.items.push(this.emitFunctionDecl(this.topName(item.name), null, node, node.jsDoc, null));
    }

    /**
     * A module variable: a thread-local cell with a getter and a setter. Its
     * initializer runs in js_module_init, in source order; a framework
     * variable (its enums) instead initializes on first use, so a bundled
     * dependency's module code finds it set.
     */
    emitGlobal(goName, t, init, lazy) {
      const rt = this.rustType(t);
      const cell = 'G_' + goName.toUpperCase();
      let initial = 'Default::default()';
      if (init && lazy) {
        this.withFunction({ returnType: 'void', cls: null }, () => {
          const val = this.expr(init);
          if (this.fn.pre.length) throw new Error('a framework variable initializer with statements');
          initial = this.emitExprText(this.coerce(val, t));
        });
      }
      this.items.push(R.Raw([
        `thread_local! { static ${cell}: RefCell<${rt}> = RefCell::new(${initial}); }`,
        `pub fn ${goName}() -> ${rt} { ${cell}.with(|c| c.borrow().clone()) }`,
        `pub fn ${goName}_set(v: ${rt}) { ${cell}.with(|c| *c.borrow_mut() = v) }`
      ].join('\n')));
      if (init && !lazy) {
        this.withFunction({ returnType: 'void', cls: null }, () => {
          const val = this.expr(init);
          this.initStmts.push(...this.flushPre(), R.ExprStmt(R.Call(R.Ident(goName + '_set'), [this.coerce(val, t)])));
        });
      }
    }

    emitTopVariable(item) {
      const d = item.node;
      const v = this.model.variables.get(item.name);
      const t = this.typeOfNullable(v.type, v.nullable);
      this.emitGlobal(this.topName(item.name), t, d.init, item.origin === 'framework');
    }

    emitTopStatement(node) {
      this.withFunction({ returnType: 'void', cls: null }, () => {
        const out = this.stmt(node);
        if (out.length) this.initStmts.push(R.Block(out));
      });
    }

    // ======================================================================
    // STATEMENTS
    // ======================================================================

    /** Transform with a pre-statement list of its own: what f needs stays with what it returns. */
    isolate(f) {
      const saved = this.fn.pre;
      this.fn.pre = [];
      try {
        const v = f();
        return { v, pre: this.fn.pre };
      } finally {
        this.fn.pre = saved;
      }
    }

    flushPre() {
      const pre = this.fn.pre;
      this.fn.pre = [];
      return pre;
    }

    stmts(list) {
      const out = [];
      this.pushScope();
      if (this.fn.hoisted && this.fn.hoisted.length) { out.push(...this.fn.hoisted); this.fn.hoisted = null; }
      for (const s of list || []) out.push(...this.stmt(s));
      this.popScope();
      return out;
    }

    stmt(node) {
      if (!node) return [];
      switch (node.type) {
        case 'BlockStatement': return [R.Block(this.stmts(node.body))];
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
        case 'BreakStatement': return [this.jump('break', node.label)];
        case 'ContinueStatement': return [this.jump('continue', node.label)];
        case 'ThrowStatement': return this.throwStatement(node);
        case 'TryStatement': return this.tryStatement(node);
        case 'SwitchStatement': return this.switchStatement(node);
        case 'LabeledStatement': return this.labeledStatement(node);
        case 'FunctionDeclaration': return this.localFunction(node);
        case 'ClassDeclaration': throw new Error('a class declared inside a function is not supported');
        default: return this.expressionStatement(node);
      }
    }

    /**
     * A break or continue: every loop carries labels ('lN: the loop, 'cN: its
     * body block), since Rust allows no unlabeled break inside a labeled block.
     */
    jump(kind, label) {
      const loops = this.fn.loops;
      let target = null;
      if (label) target = [...loops].reverse().find(l => l.jsLabel === (label.name || label));
      else target = [...loops].reverse().find(l => kind === 'break' ? true : l.isLoop);
      if (!target) throw new Error(`${kind} outside a loop`);
      if (this.fn.tryDepth && target.depth < this.fn.tryDepth) {
        // Leaving a try body: carried out by the try's flow value
        const code = this.fn.tryJumps.length;
        this.fn.tryJumps.push({ kind, target });
        return R.Return(R.Call(R.Ident('JsFlow::Jump'), [R.Lit(`${code}usize`)]));
      }
      if (kind === 'continue') return R.Break(target.bodyLabel);
      return R.Break(target.label);
    }

    /** Run body() inside a loop context; returns its statements. */
    inLoop(info, body) {
      info.depth = this.fn.tryDepth || 0;
      this.fn.loops.push(info);
      try { return body(); } finally { this.fn.loops.pop(); }
    }

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
          const v = this.xArrayAppend(e);
          return [...this.flushPre(), R.ExprStmt(v.e)];
        }
        case 'LogicalExpression': {
          const cond = e.operator === '??' ? R.MethodCall(this.coerce(this.expr(e.left), 'any'), 'is_null', []) : this.condition(e.left);
          const pre = this.flushPre();
          const body = this.withBlock(() => this.expressionStatement(e.right));
          return [...pre, R.If(e.operator === '||' ? R.Unary('!', cond) : cond, R.Block(body))];
        }
        case 'ConditionalExpression': {
          const cond = this.condition(e.test);
          const pre = this.flushPre();
          return [...pre, R.If(cond, R.Block(this.withBlock(() => this.expressionStatement(e.consequent))), R.Block(this.withBlock(() => this.expressionStatement(e.alternate))))];
        }
      }
      const v = this.expr(e);
      return [...this.flushPre(), this.exprStmt(v)];
    }

    exprStmt(v) {
      if (v.isConst) return R.ExprStmt(R.Lit('()'));
      if (v.e.kind === 'Call' || v.e.kind === 'MethodCall' || v.e.kind === 'Macro' || v.e.kind === 'BlockExpr' || v.e.kind === 'IfExpr') return R.ExprStmt(v.e);
      return R.Let('_', null, v.e, false);
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
        if (node._hoistedRust) {
          if (!d.init) continue;
          const b = this.lookup(d.id.name);
          const v = this.expr(d.init);
          out.push(...this.flushPre(), this.writeLocal(b, this.coerce(v, b.type)));
          continue;
        }
        let init = this.zero(t);
        if (d.init) {
          const v = this.expr(d.init);
          init = this.coerce(v, t);
          out.push(...this.flushPre());
        }
        const b = this.declareLocal(d.id.name, t);
        out.push(this.letLocal(b, init));
      }
      return out;
    }

    destructuringDeclaration(d) {
      const out = [];
      const src = this.expr(d.init);
      out.push(...this.flushPre());
      const tmp = this.tmp('d');
      out.push(R.Let(tmp, this.rustType(src.t), src.e, false));
      const srcVal = new Val(R.MethodCall(R.Ident(tmp), 'clone', []), src.t);
      if (d.id.type === 'ArrayPattern') {
        d.id.elements.forEach((el, i) => {
          if (!el) return;
          const target = el.type === 'AssignmentPattern' ? el.left : el;
          const t = canonicalType(target.resultType) || (isArrayType(src.t) ? elementType(src.t) : 'any');
          const item = this.indexValue(srcVal, new Val(null, 'int32', i), t);
          const b = this.declareLocal(target.name, t);
          out.push(this.letLocal(b, this.coerce(item, t)));
        });
      } else if (d.id.type === 'ObjectPattern') {
        for (const p of d.id.properties) {
          const key = propKey(p.key);
          const target = p.value && p.value.type === 'AssignmentPattern' ? p.value.left : (p.value || p.key);
          const t = canonicalType(target.resultType || p.resultType) || 'any';
          const item = this.memberValue(srcVal, key, t);
          const b = this.declareLocal(target.name || key, t);
          out.push(this.letLocal(b, this.coerce(item, t)));
        }
      }
      return out;
    }

    returnStatement(node) {
      const wrap = e => this.fn.tryDepth ? R.Return(R.Call(R.Ident('JsFlow::Return'), [e])) : R.Return(e);
      if (!node.argument) {
        if (this.fn.returnType !== 'void') return [wrap(this.zero(this.fn.returnType))];
        return [this.fn.tryDepth ? R.Return(R.Call(R.Ident('JsFlow::Return'), [R.Lit('()')])) : R.Return()];
      }
      const v = this.expr(node.argument);
      const pre = this.flushPre();
      if (this.fn.returnType === 'void') return [...pre, this.exprStmt(v), this.fn.tryDepth ? R.Return(R.Call(R.Ident('JsFlow::Return'), [R.Lit('()')])) : R.Return()];
      return [...pre, wrap(this.coerce(v, this.fn.returnType))];
    }

    condition(test) {
      const v = this.expr(test);
      return this.truthy(v);
    }

    /** A condition whose side effects stay inside it (a block expression). */
    conditionExpr(test) {
      const c = this.condition(test);
      const pre = this.flushPre();
      return pre.length ? R.BlockExpr(pre, c) : c;
    }

    branch(node) {
      if (!node) return R.Block([]);
      return R.Block(this.withBlock(() => node.type === 'BlockStatement' ? this.stmts(node.body) : this.stmt(node)));
    }

    ifStatement(node) {
      const cond = this.condition(node.test);
      const pre = this.flushPre();
      const then = this.branch(node.consequent);
      let otherwise = null;
      if (node.alternate) {
        if (node.alternate.type === 'IfStatement') {
          const inner = this.ifStatement(node.alternate);
          otherwise = inner.length === 1 ? inner[0] : R.Block(inner);
        } else {
          otherwise = this.branch(node.alternate);
        }
      }
      return [...pre, R.If(cond, then, otherwise)];
    }

    takeLabel() {
      const l = this.fn.pendingLabel || null;
      this.fn.pendingLabel = null;
      return l;
    }

    /**
     * for (init; test; update) body:
     *   { init; 'lN: loop { if !test { break 'lN; } 'cN: { body } update; } }
     * continue leaves the body block, so the update still runs.
     */
    forStatement(node) {
      const jsLabel = this.takeLabel();
      return this.withBlock(() => {
        const out = [];
        if (node.init) out.push(...this.stmt(node.init.type === 'VariableDeclaration' ? node.init : { type: 'ExpressionStatement', expression: node.init }));
        const info = { label: this.label(), bodyLabel: null, isLoop: true, jsLabel };
        info.bodyLabel = info.label.replace("'l", "'c");
        const loopStmts = [];
        if (node.test) loopStmts.push(R.If(R.Unary('!', R.Paren(this.conditionExpr(node.test))), R.Block([R.Break(info.label)])));
        const body = this.inLoop(info, () => this.loopBody(node.body));
        loopStmts.push(R.Raw(`${info.bodyLabel}: ` + this.blockText(body)));
        if (node.update) loopStmts.push(...this.expressionStatement(node.update));
        out.push(R.Loop(R.Block(loopStmts), info.label));
        return [R.Block(out)];
      });
    }

    blockText(block) {
      if (!this._emitter) {
        const RustEmitter = (typeof require !== 'undefined') ? require('./RustEmitter.js').RustEmitter : global.RustEmitter;
        this._emitter = new RustEmitter({});
      }
      // The emitter prints at its own indentation: nested blocks re-indent when printed as Raw
      return this._emitter.blockText(block).split('\n').map((l, i) => i === 0 ? l : l).join('\n');
    }

    loopBody(body) {
      return R.Block(this.withBlock(() => body && body.type === 'BlockStatement' ? this.stmts(body.body) : this.stmt(body)));
    }

    whileStatement(node) {
      const jsLabel = this.takeLabel();
      const info = { label: this.label(), isLoop: true, jsLabel };
      info.bodyLabel = info.label.replace("'l", "'c");
      const cond = this.conditionExpr(node.test);
      const body = this.inLoop(info, () => this.loopBody(node.body));
      return [R.Loop(R.Block([R.If(R.Unary('!', R.Paren(cond)), R.Block([R.Break(info.label)])), R.Raw(`${info.bodyLabel}: ` + this.blockText(body))]), info.label)];
    }

    doWhileStatement(node) {
      const jsLabel = this.takeLabel();
      const info = { label: this.label(), isLoop: true, jsLabel };
      info.bodyLabel = info.label.replace("'l", "'c");
      const body = this.inLoop(info, () => this.loopBody(node.body));
      const cond = this.conditionExpr(node.test);
      return [R.Loop(R.Block([R.Raw(`${info.bodyLabel}: ` + this.blockText(body)), R.If(R.Unary('!', R.Paren(cond)), R.Block([R.Break(info.label)]))]), info.label)];
    }

    forOfStatement(node) {
      const jsLabel = this.takeLabel();
      const iter = this.expr(node.right);
      const pre = this.flushPre();
      const decl = node.left.type === 'VariableDeclaration' ? node.left.declarations[0].id : node.left;
      const it = canonicalType(iter.t) || 'any';
      const elT = isArrayType(it) ? elementType(it) : (it === 'string' ? 'string' : 'any');
      const info = { label: this.label(), isLoop: true, jsLabel };
      info.bodyLabel = info.label.replace("'l", "'c");
      return this.withBlock(() => {
        const declared = canonicalType(decl.resultType);
        const b = this.declareLocal(decl.name, declared || elT);
        const tmpV = this.tmp('v');
        const body = this.inLoop(info, () => this.loopBody(node.body));
        let src;
        if (isArrayType(it)) src = R.MethodCall(iter.e, 'to_vec', []);
        else if (it === 'string') src = R.MethodCall(R.Call(R.Ident('js_string_chars'), [R.Ref(iter.e)]), 'to_vec', []);
        else src = R.MethodCall(R.MethodCall(this.coerce(iter, 'any'), 'list', []), 'unwrap_or_default', []);
        const elVal = new Val(R.Ident(tmpV), isArrayType(it) ? (elT === 'object' ? 'any' : elT) : (it === 'string' ? 'string' : 'any'));
        const inner = R.Block([this.letLocal(b, this.coerce(elVal, b.type)), R.Raw(`${info.bodyLabel}: ` + this.blockText(body))]);
        return [...pre, R.For(tmpV, src, inner, info.label)];
      });
    }

    forInStatement(node) {
      const jsLabel = this.takeLabel();
      const obj = this.expr(node.right);
      const pre = this.flushPre();
      const decl = node.left.type === 'VariableDeclaration' ? node.left.declarations[0].id : node.left;
      const info = { label: this.label(), isLoop: true, jsLabel };
      info.bodyLabel = info.label.replace("'l", "'c");
      return this.withBlock(() => {
        const b = this.declareLocal(decl.name, 'string');
        const tmpV = this.tmp('k');
        const body = this.inLoop(info, () => this.loopBody(node.body));
        const inner = R.Block([this.letLocal(b, R.Ident(tmpV)), R.Raw(`${info.bodyLabel}: ` + this.blockText(body))]);
        return [...pre, R.For(tmpV, R.MethodCall(R.Call(R.Ident('js_keys'), [R.Ref(this.coerce(obj, 'any'))]), 'to_vec', []), inner, info.label)];
      });
    }

    labeledStatement(node) {
      const loops = ['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForOfStatement', 'ForInStatement'];
      const name = node.label.name || node.label;
      if (loops.includes(node.body.type)) {
        this.fn.pendingLabel = name;
        return this.stmt(node.body);
      }
      // A labeled block (or switch): break L leaves it
      const info = { label: this.label(), isLoop: false, jsLabel: name };
      info.bodyLabel = info.label;
      const body = this.inLoop(info, () => this.loopBody(node.body));
      return [R.Raw(`${info.label}: ` + this.blockText(body))];
    }

    throwStatement(node) {
      const v = this.expr(node.argument);
      const pre = this.flushPre();
      return [...pre, R.ExprStmt(R.Call(R.Ident('js_throw'), [this.coerce(v, 'any')]))];
    }

    /**
     * try { A } catch (e) { B } finally { C }: A runs in catch_unwind as a
     * closure returning a JsFlow (a return or a jump out of the try is carried
     * out by that value); B and C run inline.
     */
    tryStatement(node) {
      const savedDepth = this.fn.tryDepth || 0;
      const savedJumps = this.fn.tryJumps;
      this.fn.tryDepth = savedDepth + 1;
      this.fn.tryJumps = [];
      const flowT = this.fn.returnType === 'void' ? '()' : this.rustType(this.fn.returnType);
      const tryBody = this.branch(node.block).stmts;
      const jumps = this.fn.tryJumps;
      this.fn.tryDepth = savedDepth;
      this.fn.tryJumps = savedJumps;
      const r = this.tmp('r');
      const out = [];
      const closure = R.Closure([], `JsFlow<${flowT}>`, R.Block([...tryBody, R.Return(R.Ident('JsFlow::Normal'))]));
      out.push(R.Let(r, null, R.Call(R.Ident('std::panic::catch_unwind'), [R.Call(R.Ident('std::panic::AssertUnwindSafe'), [closure])]), false));
      let catchBlock;
      if (node.handler) {
        catchBlock = this.withBlock(() => {
          const stmts = [];
          if (node.handler.param) {
            const b = this.declareLocal(node.handler.param.name, 'any');
            stmts.push(this.letLocal(b, R.Call(R.Ident('js_caught'), [R.Ident('p')])));
          }
          stmts.push(...this.stmts(node.handler.body.body));
          return stmts;
        });
      } else {
        catchBlock = [R.ExprStmt(R.Call(R.Ident('std::panic::resume_unwind'), [R.Ident('p')]))];
      }
      const finallyStmts = node.finalizer ? this.branch(node.finalizer).stmts : [];
      // A return or a jump out of the try body continues here, after the finally
      const flowVar = this.tmp('f');
      const arms = [`JsFlow::Return(v) => { ${this.fn.tryDepth ? 'return JsFlow::Return(v);' : (this.fn.returnType === 'void' ? 'let _ = v; return;' : 'return v;')} }`];
      jumps.forEach((j, i) => {
        const target = j.kind === 'continue' ? j.target.bodyLabel : j.target.label;
        arms.push(`JsFlow::Jump(${i}) => { break ${target}; }`);
      });
      arms.push('_ => {}');
      const flowStmts = [R.Raw(`match ${flowVar} {\n    ${arms.join('\n    ')}\n}`)];
      const okArm = R.Block([R.Let(flowVar, null, R.Ident('flow'), false), ...finallyStmts, ...flowStmts]);
      const errArm = R.Block([...catchBlock, ...finallyStmts]);
      out.push(R.Match(R.Ident(r), [{ pat: 'Ok(flow)', body: okArm }, { pat: 'Err(p)', body: errArm }]));
      return [R.Block(out)];
    }

    /**
     * switch: 'sN: { let v = disc; let mut go = false;
     *   if go || <case 1> { go = true; body } ... }  (break leaves 'sN; JavaScript falls through)
     */
    switchStatement(node) {
      const jsLabel = this.takeLabel();
      const disc = this.expr(node.discriminant);
      const pre = this.flushPre();
      const tag = canonicalType(disc.t) || 'any';
      const v = this.tmp('sw');
      const go = this.tmp('go');
      const m = this.tmp('m');
      const info = { label: this.label(), isLoop: false, jsLabel };
      info.bodyLabel = info.label;
      const stmts = [R.Let(v, this.rustType(tag), this.coerce(disc, tag), false)];
      // Which case matches first (or the default's position)
      const tests = [];
      node.cases.forEach((c, i) => {
        if (!c.test) return;
        const cv = this.expr(c.test);
        const casePre = this.flushPre();
        if (casePre.length) throw new Error('a switch case with side effects is not supported');
        tests.push({ i, cond: this.equality('===', new Val(R.MethodCall(R.Ident(v), 'clone', []), tag), cv).e });
      });
      const defaultIndex = node.cases.findIndex(c => !c.test);
      let chain = R.Lit(`${defaultIndex >= 0 ? defaultIndex : node.cases.length}usize`);
      for (let k = tests.length - 1; k >= 0; --k) chain = R.IfExpr(tests[k].cond, R.Lit(`${tests[k].i}usize`), chain);
      stmts.push(R.Let(m, 'usize', chain, false), R.Let(go, 'bool', R.Lit('false'), true));
      this.inLoop(info, () => {
        node.cases.forEach((c, i) => {
          const body = this.withBlock(() => this.stmts(c.consequent));
          stmts.push(R.If(R.Binary('||', R.Ident(go), R.Binary('==', R.Ident(m), R.Lit(`${i}usize`))), R.Block([R.Assign(R.Ident(go), '=', R.Lit('true')), ...body])));
        });
      });
      stmts.push(R.Raw(`let _ = ${go};`));
      return [...pre, R.Raw(`${info.label}: ` + this.blockText(R.Block(stmts)))];
    }

    localFunction(node) {
      const name = node.id.name;
      const b = this.declareLocal(name, 'function');
      const lit = this.funcLit(node, node.jsDoc);
      b.fnSig = lit.sig;
      // A recursive local function reaches itself through its cell
      if (b.cell) return [R.Let(b.rs, 'JsCell<JsAny>', R.Call(R.Ident('JsCell::new'), [R.Call(R.Ident('JsAny::undefined'), [])]), false), R.ExprStmt(R.MethodCall(R.Ident(b.rs), 'set', [lit.anyFn]))];
      return [R.Let(b.rs, null, lit.e, false)];
    }

    /**
     * A closure for a nested function or arrow function: a move closure over
     * clones of what it captures (cells stay shared). `anyFn` is the same
     * function as a JsAny taking and returning JsAny.
     */
    funcLit(node, jsDoc) {
      const params = Model.functionParams(node, jsDoc);
      const ret = this.signatureReturn(node, jsDoc);
      const outer = this.fn;
      const captured = new Map();
      const lookupOuter = name => {
        for (let i = outer.scopes.length - 1; i >= 0; --i) {
          const b = outer.scopes[i].get(name);
          if (b) { captured.set(b.rs, b); return b; }
        }
        const b = outer.outer ? outer.outer(name) : null;
        if (b) captured.set(b.rs, b);
        return b;
      };
      const usesThis = this.usesThis(node);
      const built = this.withFunction({ returnType: ret.type, cls: outer.cls, self: outer.self, outer: lookupOuter, inClosure: true, initOf: null }, () => {
        this.fn.cells = this.capturedNames(node);
        const rp = [];
        const prologue = [];
        for (const p of params) {
          const t = this.typeOfNullable(p.type, p.nullable);
          const b = this.declareLocal(p.name, t);
          if (b.cell) {
            rp.push({ name: this.ident(p.name) + '_p', type: this.rustType(t) });
            prologue.push(R.Let(b.rs, null, R.Call(R.Ident('JsCell::new'), [R.Ident(this.ident(p.name) + '_p')]), false));
          } else rp.push({ name: 'mut ' + b.rs, type: this.rustType(t) });
        }
        const body = [...prologue, ...this.functionBody(node)];
        const tail = ret.type !== 'void' && !this.terminates(body) ? this.zero(ret.type) : null;
        return { rp, body: R.Block(body, tail) };
      });
      // Captures: clones bound before the move closure
      const captureLets = [...captured.values()].map(b => R.Let(b.rs, null, R.MethodCall(R.Ident(b.rs), 'clone', []), false));
      if (usesThis && outer.self) captureLets.push(R.Let('self_', null, R.MethodCall(R.Ident(outer.inClosure ? 'self_' : 'self'), 'clone', []), false));
      const retT = ret.type === 'void' ? null : this.rustType(ret.type);
      const closure = R.Closure(built.rp, retT, built.body, true);
      const e = R.BlockExpr(captureLets, closure);
      // The same function behind the dynamic calling convention
      const anyParams = params.map((p, i) => `<${this.rustTypeNullable(p.type, p.nullable)}>::from_js(&js_arg(&a, ${i}))`);
      const fnVar = this.tmp('fn');
      const anyFn = R.BlockExpr([R.Let(fnVar, null, e, false)],
        R.Call(R.Ident('js_func'), [R.Raw(`move |a: Vec<JsAny>| { ${ret.type === 'void' ? `${fnVar}(${anyParams.join(', ')}); JsAny::undefined()` : `${fnVar}(${anyParams.join(', ')}).to_js()`} }`)]));
      const v = new Val(e, 'closure');
      v.sig = { params, ret };
      v.anyFn = anyFn;
      return v;
    }

    /** A top-level function as a JsAny function value. */
    functionAsAny(v) {
      const params = v.sig.params;
      const ret = v.sig.ret;
      const anyParams = params.map((p, i) => `<${this.rustTypeNullable(p.type, p.nullable)}>::from_js(&js_arg(&a, ${i}))`);
      const f = this.emitExprText(v.e);
      return R.Call(R.Ident('js_func'), [R.Raw(`move |a: Vec<JsAny>| { ${ret.type === 'void' ? `${f}(${anyParams.join(', ')}); JsAny::undefined()` : `${f}(${anyParams.join(', ')}).to_js()`} }`)]);
    }

    usesThis(node) {
      let found = false;
      Model.walk(node.body, n => {
        if (n.type === 'ThisExpression' || n.type === 'ThisPropertyAccess' || n.type === 'ThisMethodCall' || n.type === 'ParentMethodCall') found = true;
      });
      return found;
    }

    /** self inside methods, self_ (a captured clone) inside closures. */
    selfIdent() { return R.Ident(this.fn.inClosure ? 'self_' : 'self'); }

    // ======================================================================
    // ASSIGNMENT
    // ======================================================================

    assignment(node, asValue) {
      const op = node.operator;
      const binOp = op === '=' ? null : op.slice(0, -1);
      if (binOp === '||' || binOp === '&&' || binOp === '??') {
        const target = this.lvalue(node.left);
        const cur = target.get();
        const cond = binOp === '||' ? R.Unary('!', this.truthy(cur)) : binOp === '&&' ? this.truthy(cur) : R.MethodCall(this.coerce(cur, 'any'), 'is_null', []);
        const rhs = this.expr(node.right);
        const inner = [...this.flushPre(), ...target.set(rhs)];
        const stmts = [...target.pre, R.If(cond, R.Block(inner))];
        return asValue ? { stmts, value: target.get() } : stmts;
      }
      const target = this.lvalue(node.left);
      let value;
      if (binOp) value = this.binaryValues(binOp, target.get(), this.expr(node.right), canonicalType(node.resultType) || target.type, node);
      else value = this.expr(node.right);
      const pre = [...target.pre, ...this.flushPre()];
      const tmp = this.tmp('a');
      const t = target.type;
      const stmts = [...pre, R.Let(tmp, this.rustType(t), this.coerce(value, t), false), ...target.set(new Val(this.cloneOf(R.Ident(tmp), t), t))];
      if (!asValue) return stmts;
      return { stmts, value: new Val(this.cloneOf(R.Ident(tmp), t), t) };
    }

    cloneOf(e, t) { return this.isCopy(t) ? e : R.MethodCall(e, 'clone', []); }

    /** An assignable place: { type, get() -> Val, set(Val) -> stmts, pre }. */
    lvalue(node) {
      const pre = [];
      switch (node.type) {
        case 'Identifier': {
          const b = this.lookup(node.name);
          if (b) return { type: b.type, pre, get: () => this.readLocal(b), set: v => [this.writeLocal(b, this.coerce(v, b.type))] };
          const top = this.model.variables.get(node.name);
          if (top) {
            const t = this.typeOfNullable(top.type, top.nullable);
            const n = this.topName(node.name);
            return { type: t, pre, get: () => new Val(R.Call(R.Ident(n), []), t), set: v => [R.ExprStmt(R.Call(R.Ident(n + '_set'), [this.coerce(v, t)]))] };
          }
          throw new Error(`assignment to an unknown variable ${node.name}`);
        }
        case 'ThisPropertyAccess':
          if (!node.computed) return this.memberLvalue(this.thisValue(), node.property, node, pre);
          return this.indexLvalue(this.thisValue(), node.property, node, pre);
        case 'MemberExpression': {
          if (!node.computed) {
            const key = propKey(node.property);
            if (node.object.type === 'Identifier' && this.model.classes.has(node.object.name) && !this.lookup(node.object.name)) {
              const sf = this.findStaticField(this.model.classes.get(node.object.name), key);
              if (sf) {
                const n = this.staticName(sf.owner.name, key);
                const t = sf.type || 'any';
                return { type: t, pre, get: () => new Val(R.Call(R.Ident(n), []), t), set: v => [R.ExprStmt(R.Call(R.Ident(n + '_set'), [this.coerce(v, t)]))] };
              }
            }
            const obj = this.stableExpr(this.expr(node.object), pre);
            return this.memberLvalue(obj, key, node, pre);
          }
          const obj = this.stableExpr(this.expr(node.object), pre);
          return this.indexLvalue(obj, node.property, node, pre);
        }
        case 'ArrayLength': {
          const arr = this.stableExpr(this.expr(node.array), pre);
          return this.memberLvalue(arr, 'length', { resultType: 'int32' }, pre);
        }
        default:
          throw new Error(`cannot assign to ${node.type}`);
      }
    }

    /** A value that may be used twice: identifiers stay, anything else goes to a temporary. */
    stableExpr(v, pre) {
      pre.push(...this.flushPre());
      if (v.isConst || v.e.kind === 'Ident' || v.isThis) return v;
      const tmp = this.tmp('o');
      pre.push(R.Let(tmp, null, v.e, false));
      const out = new Val(this.cloneOf(R.Ident(tmp), v.t), v.t);
      out.stableName = tmp;
      return out;
    }

    findStaticField(info, key) {
      for (let c = info; c; c = c.base) if (c.staticFields.has(key)) return Object.assign({ owner: c }, c.staticFields.get(key));
      return null;
    }

    memberLvalue(obj, key, node, pre) {
      const ot = canonicalType(obj.t) || 'any';
      const info = obj.isThis ? this.fn.cls : (this.isLeafClass(ot) ? this.model.classOf(ot) : null);
      const nodeType = this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable);
      if (info) {
        const eff = info.effective;
        if (eff.fields.has(key)) {
          const f = eff.fields.get(key);
          const t = this.typeOfNullable(f.type, f.nullable);
          return { type: t, pre, field: true, get: () => new Val(R.MethodCall(obj.recv || obj.e, this.fieldGet(key), []), t), set: v => [R.ExprStmt(R.MethodCall(obj.recv || obj.e, this.fieldSet(key), [this.coerce(v, t)]))] };
        }
        if (eff.setters.has(key) || eff.getters.has(key)) {
          const g = eff.getters.get(key);
          const s = eff.setters.get(key);
          const gt = g ? this.signatureReturn(g.fn, g.jsDoc).type : 'any';
          const sp = s ? (Model.functionParams(s.fn, s.jsDoc)[0] || { type: 'any' }) : null;
          const st = sp ? this.typeOfNullable(sp.type, sp.nullable) : 'any';
          return {
            type: s ? st : gt, pre,
            get: () => g ? new Val(R.MethodCall(obj.recv || obj.e, this.getterName(key), []), gt) : new Val(R.Call(R.Ident('JsAny::undefined'), []), 'any'),
            set: v => s ? [R.ExprStmt(R.MethodCall(obj.recv || obj.e, this.setterName(key), [this.coerce(v, st)]))] : [R.ExprStmt(R.MethodCall(obj.e, 'js_set', [R.Lit(rustStringLiteral(key)), this.coerce(v, 'any')]))]
          };
        }
      }
      if (ot === 'Error' || ot === 'TypeError' || ot === 'RangeError') {
        const field = key === 'message' ? 'message' : key === 'name' ? 'name' : null;
        if (field) return { type: 'string', pre, get: () => new Val(R.MethodCall(R.Field(obj.e, field), 'clone', []), 'string'), set: () => { throw new Error('assignment to an error field'); } };
      }
      if (isArrayType(ot) && key === 'length') {
        return {
          type: 'int32', pre,
          get: () => new Val(R.Cast(R.MethodCall(obj.e, 'len', []), 'i32'), 'int32'),
          set: v => [R.ExprStmt(R.MethodCall(obj.e, 'set_len', [this.coerce(v, 'idx')]))]
        };
      }
      const o = this.coerce(obj, 'object');
      return {
        type: nodeType, pre,
        get: () => new Val(R.MethodCall(o, 'get', [R.Lit(rustStringLiteral(key))]), 'any'),
        set: v => [R.ExprStmt(R.MethodCall(o, 'set', [R.Lit(rustStringLiteral(key)), this.coerce(v, 'any')]))]
      };
    }

    indexLvalue(obj, indexNode, node, pre) {
      const ot = canonicalType(obj.t) || 'any';
      const idx = this.stableExpr(this.expr(indexNode), pre);
      if (isArrayType(ot)) {
        const el = elementType(ot);
        const elT = el === 'object' ? 'any' : el;
        const i = this.coerce(idx, 'idx');
        return {
          type: elT, pre,
          get: () => new Val(R.MethodCall(obj.e, 'get', [i]), elT),
          set: v => [R.ExprStmt(R.MethodCall(obj.e, 'set', [i, this.coerce(v, elT)]))]
        };
      }
      if (ot === 'string') throw new Error('assignment to a string index');
      const o = this.coerce(obj, 'object');
      const nodeType = this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable);
      const key = R.Ref(R.MethodCall(this.coerce(idx, 'any'), 'text', []));
      return {
        type: nodeType, pre,
        get: () => new Val(R.MethodCall(o, 'get', [key]), 'any'),
        set: v => [R.ExprStmt(R.MethodCall(o, 'set', [key, this.coerce(v, 'any')]))]
      };
    }

    update(node, asValue) {
      const target = this.lvalue(node.argument);
      const t = target.type;
      const cur = target.get();
      const one = new Val(null, 'int32', 1);
      const nt = isNumericType(t) || isBigType(t) ? t : 'float64';
      const pre = [...target.pre, ...this.flushPre()];
      const old = this.tmp('u');
      const stmts = [...pre, R.Let(old, this.rustType(t), this.coerce(cur, t), false)];
      const next = this.binaryValues(node.operator === '++' ? '+' : '-', new Val(this.cloneOf(R.Ident(old), t), t), one, nt, node);
      if (!asValue) return [...stmts, ...target.set(next)];
      if (node.prefix) {
        const nv = this.tmp('n');
        return { stmts: [...stmts, R.Let(nv, this.rustType(t), this.coerce(next, t), false), ...target.set(new Val(this.cloneOf(R.Ident(nv), t), t))], value: new Val(this.cloneOf(R.Ident(nv), t), t) };
      }
      return { stmts: [...stmts, ...target.set(next)], value: new Val(this.cloneOf(R.Ident(old), t), t) };
    }

    parentConstructorCall(node) {
      const info = this.fn.cls;
      const owner = this.fn.initOf;
      if (!info || !owner || !owner.base) return [];
      const base = owner.base;
      const ctorOwner = [...base.chain()].reverse().find(c => c.ctor);
      const params = ctorOwner ? Model.functionParams(ctorOwner.ctor, ctorOwner.ctorDoc) : [];
      const args = this.callArgs(node.arguments || [], params);
      return [...this.flushPre(), R.ExprStmt(R.MethodCall(R.Ident('self'), this.initName(base), args)), ...this.fieldInitializers(info, owner)];
    }

    // ======================================================================
    // EXPRESSIONS
    // ======================================================================

    thisValue() {
      const cls = this.fn.cls;
      if (!cls || !this.fn.self) return new Val(R.Call(R.Ident('JsObj::null'), []), 'object');
      const v = new Val(R.MethodCall(this.selfIdent(), 'clone', []), this.isLeafClass(cls.name) ? cls.name : '#' + cls.name);
      v.isThis = true;
      v.recv = this.selfIdent();
      return v;
    }

    expr(node) {
      if (!node) return new Val(R.Call(R.Ident('JsAny::undefined'), []), 'null', null);
      const handler = this['x' + node.type];
      if (handler) return handler.call(this, node);
      return this.unsupported(node);
    }

    /** A runtime failure where nothing is transpiled (it compiles, and throws when it runs). */
    unsupportedVal(args, type) {
      const t = canonicalType(type) || 'any';
      return new Val(R.Call(R.Ident(`js_unsupported::<${this.rustType(t === 'void' ? 'any' : t)}>`), args), t);
    }

    unsupported(node) {
      this.warnings.push(`unsupported ${node.type}`);
      return this.unsupportedVal([R.Lit(rustStringLiteral(node.type))], canonicalType(node.resultType) || 'any');
    }

    xLiteral(node) {
      const t = canonicalType(node.resultType);
      if (node.regex) return new Val(R.Call(R.Ident('JsRegex::new'), [R.Lit(rustStringLiteral(node.regex.pattern)), R.Lit(rustStringLiteral(node.regex.flags || ''))]), 'regex');
      const v = node.value;
      if (v === null) return new Val(R.Call(R.Ident('JsAny::undefined'), []), 'null', null);
      if (node.bigint !== undefined || typeof v === 'bigint') {
        const b = BigInt(typeof v === 'bigint' ? v : String(node.bigint || v).replace(/n$/, ''));
        return new Val(null, isBigType(t) ? 'bigint' : (t === 'uint64' || t === 'int64' ? t : 'bigint'), b);
      }
      if (typeof v === 'number') return new Val(null, t && isNumericType(t) ? t : (Number.isInteger(v) ? 'int32' : 'float64'), v);
      if (typeof v === 'string') return new Val(null, 'string', v);
      if (typeof v === 'boolean') return new Val(null, 'boolean', v);
      return new Val(R.Call(R.Ident('JsAny::undefined'), []), 'null', null);
    }

    xIdentifier(node) {
      const name = node.name;
      if (name === 'undefined') return new Val(R.Call(R.Ident('JsAny::undefined'), []), 'null', null);
      if (name === 'NaN') return new Val(null, 'float64', NaN);
      if (name === 'Infinity') return new Val(null, 'float64', Infinity);
      const b = this.lookup(name);
      if (b) {
        if (b.fnSig) {
          const v = new Val(b.cell ? R.MethodCall(R.Ident(b.rs), 'get', []) : R.Ident(b.rs), b.cell ? 'any' : 'closure');
          v.sig = b.fnSig;
          v.cellFn = b.cell;
          return v;
        }
        return this.readLocal(b);
      }
      const top = this.model.variables.get(name);
      if (top) return new Val(R.Call(R.Ident(this.topName(name)), []), this.typeOfNullable(top.type, top.nullable));
      const fn = this.model.functions.get(name);
      if (fn) {
        const v = new Val(R.Ident(this.topName(name)), 'fnref');
        v.sig = { params: Model.functionParams(fn.node, fn.node.jsDoc), ret: this.signatureReturn(fn.node, fn.node.jsDoc) };
        return v;
      }
      if (this.model.classes.has(name)) {
        const v = new Val(R.Call(R.Ident('JsAny::undefined'), []), 'any');
        v.classRef = this.model.classes.get(name);
        return v;
      }
      this.warnings.push(`unknown identifier ${name}`);
      return this.unsupportedVal([R.Lit(rustStringLiteral('identifier ' + name))], canonicalType(node.resultType) || 'any');
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
        const key = propKey(node.property);
        if (node.object.type === 'Identifier' && !this.lookup(node.object.name)) {
          const special = this.globalMember(node.object.name, key);
          if (special) return special;
          if (this.model.classes.has(node.object.name) && !this.model.variables.has(node.object.name)) {
            const sf = this.findStaticField(this.model.classes.get(node.object.name), key);
            if (sf) return new Val(R.Call(R.Ident(this.staticName(sf.owner.name, key)), []), sf.type || 'any');
          }
        }
        return this.memberValue(this.expr(node.object), key, resultType);
      }
      return this.indexValue(this.expr(node.object), this.expr(node.property), resultType);
    }

    globalMember(obj, key) {
      const consts = {
        'Number.MAX_SAFE_INTEGER': 9007199254740991, 'Number.MIN_SAFE_INTEGER': -9007199254740991,
        'Number.MAX_VALUE': Number.MAX_VALUE, 'Number.MIN_VALUE': Number.MIN_VALUE, 'Number.EPSILON': Number.EPSILON,
        'Number.POSITIVE_INFINITY': Infinity, 'Number.NEGATIVE_INFINITY': -Infinity, 'Number.NaN': NaN,
        'Math.PI': Math.PI, 'Math.E': Math.E, 'Math.LN2': Math.LN2, 'Math.LN10': Math.LN10, 'Math.LOG2E': Math.LOG2E,
        'Math.LOG10E': Math.LOG10E, 'Math.SQRT2': Math.SQRT2, 'Math.SQRT1_2': Math.SQRT1_2
      };
      const k = `${obj}.${key}`;
      return k in consts ? new Val(null, 'float64', consts[k]) : null;
    }

    memberValue(obj, key, resultType) {
      const ot = canonicalType(obj.t) || 'any';
      if (obj.classRef) {
        const sf = this.findStaticField(obj.classRef, key);
        if (sf) return new Val(R.Call(R.Ident(this.staticName(sf.owner.name, key)), []), sf.type || 'any');
        if (key === 'name') return new Val(null, 'string', obj.classRef.name);
      }
      if (ot === 'string' && key === 'length') return new Val(R.Call(R.Ident('js_str_len'), [R.Ref(obj.e)]), 'int32');
      if (isArrayType(ot) && key === 'length') return new Val(R.Cast(R.MethodCall(obj.e, 'len', []), 'i32'), 'int32');
      const pre = [];
      const lv = this.memberLvalue(obj, key, { resultType }, pre);
      this.fn.pre.push(...pre);
      return lv.get();
    }

    indexValue(obj, idx, resultType) {
      const ot = canonicalType(obj.t) || 'any';
      if (isArrayType(ot)) {
        const el = elementType(ot);
        return new Val(R.MethodCall(obj.e, 'get', [this.coerce(idx, 'idx')]), el === 'object' ? 'any' : el);
      }
      if (ot === 'string') return new Val(R.Call(R.Ident('js_char_at'), [R.Ref(obj.e), this.coerce(idx, 'int64')]), 'string');
      if (ot === 'Map') return new Val(R.MethodCall(obj.e, 'map_get', [R.Ref(this.coerce(idx, 'any'))]), 'any');
      const o = this.coerce(obj, 'object');
      return new Val(R.MethodCall(o, 'get', [R.Ref(R.MethodCall(this.coerce(idx, 'any'), 'text', []))]), 'any');
    }

    xArrayLength(node) {
      const a = this.expr(node.array);
      const t = canonicalType(a.t) || 'any';
      if (isArrayType(t)) return new Val(R.Cast(R.MethodCall(a.e, 'len', []), 'i32'), 'int32');
      if (t === 'string') return new Val(R.Call(R.Ident('js_str_len'), [R.Ref(a.e)]), 'int32');
      return new Val(R.Call(R.Ident('js_length'), [R.Ref(this.coerce(a, 'any'))]), 'int32');
    }

    // ------------------------------------------------------------ operators

    xBinaryExpression(node) {
      return this.binaryValues(node.operator, this.expr(node.left), this.expr(node.right), canonicalType(node.resultType), node);
    }

    binaryValues(op, l, r, rt, node) {
      const lt = canonicalType(l.t) || 'any';
      const rtp = canonicalType(r.t) || 'any';
      if (l.isConst && r.isConst && (typeof l.c === 'bigint') === (typeof r.c === 'bigint')) {
        const folded = this.fold(op, l.c, r.c);
        if (folded !== undefined) return new Val(null, rt || (typeof folded === 'boolean' ? 'boolean' : typeof folded === 'string' ? 'string' : 'float64'), folded);
      }
      switch (op) {
        case '===': case '==': case '!==': case '!=': return this.equality(op, l, r);
        case '<': case '<=': case '>': case '>=': return this.compare(op, l, r);
        case 'in': return new Val(R.Call(R.Ident('js_in'), [R.Ref(R.MethodCall(this.coerce(l, 'any'), 'text', [])), R.Ref(this.coerce(r, 'any'))]), 'boolean');
        case 'instanceof': return this.instanceOf(l, r);
      }
      const big = isBigType(lt) || isBigType(rtp) || isBigType(rt) || typeof l.c === 'bigint' || typeof r.c === 'bigint';
      if (op === '+' && (lt === 'string' || rtp === 'string' || rt === 'string')) {
        return new Val(R.Macro('format', ['"{}{}"', this.coerce(l, 'string'), this.coerce(r, 'string')]), 'string');
      }
      if (['&', '|', '^', '<<', '>>', '>>>'].includes(op)) return this.bitwise(op, l, r, rt, big);
      if (op === '**') return this.power(l, r, rt);
      if (big && (isBigType(rt) || isBigType(lt) || isBigType(rtp))) {
        const m = { '+': 'add', '-': 'sub', '*': 'mul', '/': 'div', '%': 'rem' }[op];
        const res = new Val(R.MethodCall(this.coerce(l, 'bigint'), m, [R.Ref(this.coerce(r, 'bigint'))]), 'bigint');
        return rt && !isBigType(rt) ? new Val(this.coerce(res, rt), rt) : res;
      }
      const t = rt && isNumericType(rt) ? rt : (isNumericType(lt) && isNumericType(rtp) ? this.widen(lt, rtp) : 'float64');
      if (op === '/') {
        if ((t === 'uint64' || t === 'int64') && this.isBigIntish(node)) return new Val(R.MethodCall(this.coerce(l, t), 'wrapping_div', [this.coerce(r, t)]), t);
        const q = new Val(R.Binary('/', this.coerce(l, 'float64'), this.coerce(r, 'float64')), 'float64');
        return isFloatType(t) ? q : new Val(this.coerce(q, t), t);
      }
      if (op === '%') {
        const w = this.widen(lt, rtp);
        if (!isIntType(w) || isFloatType(t)) {
          const m = new Val(R.Binary('%', this.coerce(l, 'float64'), this.coerce(r, 'float64')), 'float64');
          return isFloatType(t) ? m : new Val(this.coerce(m, t), t);
        }
        const m = new Val(R.MethodCall(this.coerce(l, w), 'wrapping_rem', [this.coerce(r, w)]), w);
        return w === t ? m : new Val(this.coerce(m, t), t);
      }
      if (isIntType(t)) {
        const m = { '+': 'wrapping_add', '-': 'wrapping_sub', '*': 'wrapping_mul' }[op];
        return new Val(R.MethodCall(this.coerce(l, t), m, [this.coerce(r, t)]), t);
      }
      return new Val(R.Binary(op, this.coerce(l, t), this.coerce(r, t)), t);
    }

    isBigIntish(node) {
      const isBig = n => n && (isBigType(n.resultType) || n.type === 'BigIntCast' || n.bigint === true || (n.type === 'Literal' && (n.bigint !== undefined || typeof n.value === 'bigint')));
      return !!node && (isBig(node.left) || isBig(node.right));
    }

    widen(a, b) {
      if (a === b) return a;
      if (isFloatType(a) || isFloatType(b) || !isIntType(a) || !isIntType(b)) return 'float64';
      if (a === 'uint64' || b === 'uint64') return (isSignedInt(a) || isSignedInt(b)) ? 'int64' : 'uint64';
      return 'int64';
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

    bitwise(op, l, r, rt, big) {
      const lt = canonicalType(l.t) || 'any';
      const rtp = canonicalType(r.t) || 'any';
      const wide = t => t === 'uint64' || t === 'int64';
      if (big || wide(rt) || isBigType(rt)) {
        if ((wide(lt) || l.isConst) && (wide(rtp) || r.isConst || op === '<<' || op === '>>') && wide(rt) && !isBigType(lt) && !isBigType(rtp)) {
          if (op === '<<' || op === '>>' || op === '>>>') return new Val(R.Call(R.Ident(op === '<<' ? 'js_shl64' : 'js_shr64'), [this.coerce(l, 'uint64'), this.coerce(r, 'int64')]), 'uint64').t === rt ? new Val(R.Call(R.Ident(op === '<<' ? 'js_shl64' : 'js_shr64'), [this.coerce(l, 'uint64'), this.coerce(r, 'int64')]), 'uint64') : new Val(this.coerce(new Val(R.Call(R.Ident(op === '<<' ? 'js_shl64' : 'js_shr64'), [this.coerce(l, 'uint64'), this.coerce(r, 'int64')]), 'uint64'), rt), rt);
          return new Val(R.Binary(op, this.coerce(l, rt), this.coerce(r, rt)), rt);
        }
        let res;
        if (op === '<<' || op === '>>' || op === '>>>') res = new Val(R.MethodCall(this.coerce(l, 'bigint'), 'shift', [op === '<<' ? this.coerce(r, 'int64') : R.Unary('-', this.coerce(r, 'int64'))]), 'bigint');
        else res = new Val(R.MethodCall(this.coerce(l, 'bigint'), { '&': 'and', '|': 'or', '^': 'xor' }[op], [R.Ref(this.coerce(r, 'bigint'))]), 'bigint');
        return rt && !isBigType(rt) ? new Val(this.coerce(res, rt), rt) : res;
      }
      if (op === '<<' || op === '>>' || op === '>>>') {
        const a = this.toInt32Bits(l, op === '>>>' ? 'uint32' : 'int32');
        const count = r.isConst ? R.Lit(`${(Number(r.c) >>> 0) & 31}u32`) : this.toInt32Bits(r, 'uint32');
        const res = new Val(R.MethodCall(a, op === '<<' ? 'wrapping_shl' : 'wrapping_shr', [count]), op === '>>>' ? 'uint32' : 'int32');
        return rt && rt !== res.t ? new Val(this.coerce(res, rt), rt) : res;
      }
      const res = new Val(R.Binary(op, this.toInt32Bits(l, 'int32'), this.toInt32Bits(r, 'int32')), 'int32');
      return rt && rt !== 'int32' ? new Val(this.coerce(res, rt), rt) : res;
    }

    toInt32Bits(v, as) {
      const t = canonicalType(v.t) || 'any';
      const rs = as === 'uint32' ? 'u32' : 'i32';
      if (v.isConst) {
        const n = typeof v.c === 'bigint' ? Number(BigInt.asIntN(32, v.c)) : (Number(v.c) | 0);
        const x = as === 'uint32' ? n >>> 0 : n;
        return R.Lit(x < 0 ? (x === -2147483648 ? 'i32::MIN' : `(${x}${rs})`) : `${x}${rs}`);
      }
      if (t === as) return v.e;
      if (isIntType(t)) return R.Cast(v.e, rs);
      if (isFloatType(t)) return R.Cast(R.Call(R.Ident('js_f2i'), [v.e]), rs);
      return R.Cast(this.coerce(v, 'int64'), rs);
    }

    power(l, r, rt) {
      const lt = canonicalType(l.t) || 'any';
      if (isBigType(lt) || isBigType(rt) || typeof l.c === 'bigint') {
        const res = new Val(R.MethodCall(this.coerce(l, 'bigint'), 'pow', [R.Ref(this.coerce(r, 'bigint'))]), 'bigint');
        return rt && !isBigType(rt) ? new Val(this.coerce(res, rt), rt) : res;
      }
      const p = new Val(R.MethodCall(this.coerce(l, 'float64'), 'powf', [this.coerce(r, 'float64')]), 'float64');
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
        if (isNullV(other)) e = R.Lit('true');
        else {
          const rs = this.rustType(other.t);
          if (rs === 'JsAny' || rs === 'JsObj' || rs.startsWith('JsArr<') || this.model.classOf(other.t)) e = R.MethodCall(other.e, 'is_null', []);
          else e = R.Lit('false');
        }
      } else if (isBigType(lt) || isBigType(rtp)) {
        e = R.Binary('==', R.MethodCall(this.coerce(l, 'bigint'), 'cmp', [R.Ref(this.coerce(r, 'bigint'))]), R.Lit('0'));
      } else if (isNumericType(lt) && isNumericType(rtp)) {
        const w = this.widen(lt, rtp);
        e = R.Binary('==', this.coerce(l, w), this.coerce(r, w));
      } else if (isNumericType(lt) && r.isConst && typeof r.c === 'number') {
        e = R.Binary('==', this.coerce(l, 'float64'), this.coerce(r, 'float64'));
      } else if (isNumericType(rtp) && l.isConst && typeof l.c === 'number') {
        e = R.Binary('==', this.coerce(l, 'float64'), this.coerce(r, 'float64'));
      } else if ((lt === 'string' || rtp === 'string') && (lt === rtp || l.isConst || r.isConst)) {
        e = R.Binary('==', this.coerce(l, 'string'), this.coerce(r, 'string'));
      } else if (lt === 'boolean' && rtp === 'boolean') {
        e = R.Binary('==', l.e, r.e);
      } else {
        e = R.Call(R.Ident(op === '===' || op === '!==' ? 'js_strict_equals' : 'js_loose_equals'), [R.Ref(this.coerce(l, 'any')), R.Ref(this.coerce(r, 'any'))]);
      }
      return new Val(neg ? R.Unary('!', R.Paren(e)) : e, 'boolean');
    }

    compare(op, l, r) {
      const lt = canonicalType(l.t) || 'any';
      const rtp = canonicalType(r.t) || 'any';
      if (isBigType(lt) || isBigType(rtp)) return new Val(R.Binary(op, R.MethodCall(this.coerce(l, 'bigint'), 'cmp', [R.Ref(this.coerce(r, 'bigint'))]), R.Lit('0')), 'boolean');
      if (lt === 'string' && rtp === 'string') return new Val(R.Binary(op, l.e, r.e), 'boolean');
      let w;
      if (isNumericType(lt) && isNumericType(rtp)) w = this.widen(lt, rtp);
      else if (isNumericType(lt) && r.isConst) w = lt;
      else if (isNumericType(rtp) && l.isConst) w = rtp;
      else w = 'float64';
      if (w !== 'float64' && ((l.isConst && !this.fits(l.c, w)) || (r.isConst && !this.fits(r.c, w)))) w = 'float64';
      return new Val(R.Binary(op, this.coerce(l, w), this.coerce(r, w)), 'boolean');
    }

    fits(c, t) {
      if (typeof c !== 'number' || !Number.isInteger(c)) return typeof c === 'bigint';
      const bits = intBits(t);
      if (!bits) return true;
      const min = isSignedInt(t) ? -(2 ** (bits - 1)) : 0;
      const max = isSignedInt(t) ? 2 ** (bits - 1) - 1 : 2 ** bits - 1;
      return c >= min && c <= max;
    }

    instanceOf(l, r) {
      const cls = r.classRef;
      if (!cls) return new Val(R.Unary('!', R.MethodCall(R.Call(R.Ident('<JsError>::from_js'), [R.Ref(this.coerce(l, 'any'))]), 'name', [])), 'boolean');
      const names = [...this.emittedClasses].filter(n => this.model.classes.get(n).isA(cls.name)).map(n => this.className(n));
      if (!names.length) return new Val(R.Lit('false'), 'boolean');
      const any = this.coerce(l, 'any');
      const tmp = this.tmp('i');
      const test = names.map(n => `${tmp}.downcast::<${n}>().is_some() || ${tmp}.obj().downcast::<${n}>().is_some()`).join(' || ');
      return new Val(R.BlockExpr([R.Let(tmp, null, any, false)], R.Lit(test)), 'boolean');
    }

    xLogicalExpression(node) {
      let rt = canonicalType(node.resultType) || 'any';
      const op = node.operator;
      const lt0 = canonicalType(node.left.resultType);
      const rt0 = canonicalType(node.right.resultType);
      if (rt === 'boolean' && op !== '??' && lt0 && lt0 === rt0 && lt0 !== 'boolean' && lt0 !== 'any') rt = lt0;
      if (rt === 'boolean' && op !== '??') {
        const a = this.condition(node.left);
        const preA = this.flushPre();
        const b = this.conditionExpr(node.right);
        this.fn.pre.push(...preA);
        return new Val(R.Binary(op, a, b), 'boolean');
      }
      const left = this.expr(node.left);
      const { v: right, pre: preB } = this.isolate(() => this.expr(node.right));
      const tmp = this.tmp('l');
      const leftVal = new Val(this.cloneOf(R.Ident(tmp), left.t), left.t);
      let keepLeft;
      if (op === '||') keepLeft = this.truthy(leftVal);
      else if (op === '&&') keepLeft = R.Unary('!', this.truthy(leftVal));
      else keepLeft = R.Unary('!', R.MethodCall(this.coerce(leftVal, 'any'), 'is_null', []));
      const e = R.BlockExpr([R.Let(tmp, this.rustType(left.t), left.e, false)],
        R.IfExpr(keepLeft, this.coerce(leftVal, rt), preB.length ? R.BlockExpr(preB, this.coerce(right, rt)) : this.coerce(right, rt)));
      return new Val(e, rt);
    }

    xConditionalExpression(node) {
      const rt = this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable);
      const cond = this.condition(node.test);
      const { v: a, pre: preA } = this.isolate(() => this.expr(node.consequent));
      const { v: b, pre: preB } = this.isolate(() => this.expr(node.alternate));
      const ca = this.coerce(a, rt);
      const cb = this.coerce(b, rt);
      return new Val(R.IfExpr(cond, preA.length ? R.BlockExpr(preA, ca) : ca, preB.length ? R.BlockExpr(preB, cb) : cb), rt);
    }

    xUnaryExpression(node) {
      const op = node.operator;
      if (op === '++' || op === '--') return this.xUpdateExpression(Object.assign({}, node, { type: 'UpdateExpression', prefix: node.prefix !== false }));
      const rt = canonicalType(node.resultType);
      if (op === 'typeof') return this.typeOf(node.argument);
      if (op === 'delete') return new Val(null, 'boolean', true);
      const v = this.expr(node.argument);
      if (op === '!') {
        if (v.isConst) return new Val(null, 'boolean', !v.c);
        return new Val(R.Unary('!', R.Paren(this.truthy(v))), 'boolean');
      }
      if (op === 'void') { this.fn.pre.push(this.exprStmt(v)); return new Val(R.Call(R.Ident('JsAny::undefined'), []), 'null', null); }
      const t = canonicalType(v.t) || 'any';
      if (v.isConst && (typeof v.c === 'number' || typeof v.c === 'bigint')) {
        if (op === '-') return new Val(null, rt || v.t, -v.c);
        if (op === '+') return new Val(null, rt || 'float64', Number(v.c));
        if (op === '~') return new Val(null, rt || 'int32', ~v.c);
      }
      if (op === '-') {
        if (isBigType(t) || isBigType(rt)) return new Val(R.MethodCall(this.coerce(v, 'bigint'), 'neg', []), 'bigint');
        const target = rt && isNumericType(rt) ? rt : (isNumericType(t) ? t : 'float64');
        if (isIntType(target)) return new Val(R.MethodCall(this.coerce(v, target), 'wrapping_neg', []), target);
        return new Val(R.Unary('-', this.coerce(v, target)), target);
      }
      if (op === '+') {
        const target = rt && isNumericType(rt) ? rt : 'float64';
        return new Val(this.coerce(v, target), target);
      }
      if (op === '~') {
        if (isBigType(t) || isBigType(rt) || ((t === 'uint64' || t === 'int64') && (rt === 'uint64' || rt === 'int64'))) {
          if (!isBigType(t) && !isBigType(rt)) return new Val(R.Unary('!', this.coerce(v, rt)), rt);
          const res = new Val(R.MethodCall(this.coerce(v, 'bigint'), 'not', []), 'bigint');
          return rt && !isBigType(rt) ? new Val(this.coerce(res, rt), rt) : res;
        }
        const res = new Val(R.Unary('!', this.toInt32Bits(v, 'int32')), 'int32');
        return rt && rt !== 'int32' ? new Val(this.coerce(res, rt), rt) : res;
      }
      throw new Error(`unary ${op}`);
    }

    typeOf(arg) {
      const v = this.expr(arg);
      const t = canonicalType(v.t) || 'any';
      const known = isNumericType(t) ? 'number' : isBigType(t) ? 'bigint' : t === 'string' ? 'string' : t === 'boolean' ? 'boolean'
        : (t === 'closure' || t === 'fnref') ? 'function' : (isArrayType(t) || this.isLeafClass(t)) ? 'object' : null;
      if (known) return new Val(null, 'string', known);
      return new Val(R.Call(R.Ident('js_type_of'), [R.Ref(this.coerce(v, 'any'))]), 'string');
    }

    xTypeOfExpression(node) { return this.typeOf(node.argument); }

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

    // ---------------------------------------------------------- calls

    callArgs(argNodes, params) {
      const out = [];
      if (argNodes.some(a => a && a.type === 'SpreadElement')) {
        const list = this.spreadList(argNodes, 'any');
        const tmp = this.tmp('s');
        this.fn.pre.push(R.Let(tmp, null, list, false));
        params.forEach((p, i) => out.push(this.coerce(new Val(R.MethodCall(R.Ident(tmp), 'get', [R.Lit(`${i}usize`)]), 'any'), this.typeOfNullable(p.type, p.nullable))));
        return out;
      }
      params.forEach((p, i) => {
        const t = this.typeOfNullable(p.type, p.nullable);
        if (i < argNodes.length) out.push(this.coerce(this.expr(argNodes[i]), t));
        else if (p.defaultValue) out.push(this.coerce(this.expr(p.defaultValue), t));
        else out.push(this.zero(t));
      });
      for (let i = params.length; i < argNodes.length; ++i) {
        const v = this.expr(argNodes[i]);
        if (!v.isConst && (v.e.kind === 'Call' || v.e.kind === 'MethodCall')) this.fn.pre.push(this.exprStmt(v));
      }
      return out;
    }

    /** Values of a list with spreads, as one JsArr expression of the element type. */
    spreadList(nodes, elT) {
      const parts = [];
      let run = [];
      const flush = () => { if (run.length) { parts.push(R.Call(R.Ident('js_arr'), [R.Macro('vec', run)])); run = []; } };
      for (const n of nodes) {
        if (n && n.type === 'SpreadElement') {
          flush();
          const v = this.expr(n.argument);
          parts.push(this.coerce(v, elT + '[]'));
        } else run.push(this.coerce(this.expr(n), elT));
      }
      flush();
      if (parts.length === 1) return run.length === 0 && parts[0].kind === 'Call' && parts[0].fn.name === 'js_arr' ? parts[0] : R.MethodCall(parts[0], 'copy', []);
      return R.Call(R.Ident('js_concat'), [R.Macro('vec', parts.length ? parts : [R.Call(R.Ident('JsArr::new'), [])])]);
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
        const local = this.lookup(callee.name);
        if (!local) {
          const special = this.globalCall(callee.name, node, rt);
          if (special) return special;
        }
        const fv = this.xIdentifier(callee);
        if (fv.sig && !fv.cellFn) return new Val(R.Call(fv.e, this.callArgs(node.arguments || [], fv.sig.params)), fv.sig.ret.type);
        if (fv.classRef) return this.newObject(fv.classRef, node.arguments || []);
        const args = (node.arguments || []).map(a => this.coerce(this.expr(a), 'any'));
        const res = new Val(R.MethodCall(this.coerce(fv, 'any'), 'call', [R.Macro('vec', args)]), 'any');
        return fv.sig ? new Val(this.coerce(res, fv.sig.ret.type === 'void' ? 'any' : fv.sig.ret.type), fv.sig.ret.type === 'void' ? 'any' : fv.sig.ret.type) : res;
      }
      if (callee.type === 'MemberExpression' && !callee.computed) {
        const key = propKey(callee.property);
        if (callee.object.type === 'Identifier' && !this.lookup(callee.object.name)) {
          const special = this.globalMethodCall(callee.object.name, key, node, rt);
          if (special) return special;
          const info = this.model.classes.get(callee.object.name);
          if (info && !this.model.variables.has(callee.object.name)) {
            for (let c = info; c; c = c.base) {
              const sm = c.staticMethods.get(key);
              if (sm) return new Val(R.Call(R.Ident(this.staticName(c.name, key)), this.callArgs(node.arguments || [], Model.functionParams(sm.fn, sm.jsDoc))), this.signatureReturn(sm.fn, sm.jsDoc).type);
            }
          }
        }
        return this.methodCall(this.expr(callee.object), key, node.arguments || [], rt, node);
      }
      if (callee.type === 'MemberExpression' && callee.computed) {
        const obj = this.expr(callee.object);
        const key = this.expr(callee.property);
        const args = (node.arguments || []).map(a => this.coerce(this.expr(a), 'any'));
        return new Val(R.MethodCall(this.coerce(obj, 'object'), 'call', [R.Ref(R.MethodCall(this.coerce(key, 'any'), 'text', [])), R.Macro('vec', args)]), 'any');
      }
      const f = this.expr(callee);
      if (f.sig && f.t === 'closure') return new Val(R.Call(R.Paren(f.e), this.callArgs(node.arguments || [], f.sig.params)), f.sig.ret.type);
      const args = (node.arguments || []).map(a => this.coerce(this.expr(a), 'any'));
      return new Val(R.MethodCall(this.coerce(f, 'any'), 'call', [R.Macro('vec', args)]), 'any');
    }

    globalCall(name, node, rt) {
      const args = node.arguments || [];
      const a = i => this.expr(args[i]);
      switch (name) {
        case 'RegisterAlgorithm': return new Val(R.Call(R.Ident('js_register_algorithm'), [this.coerce(a(0), 'object')]), 'void');
        case 'Number': {
          if (!args.length) return new Val(null, 'float64', 0);
          const v = a(0);
          const target = rt && isNumericType(rt) ? rt : 'float64';
          return new Val(this.coerce(v, target), target);
        }
        case 'BigInt': {
          const v = a(0);
          if (canonicalType(v.t) === 'string') return new Val(R.Call(R.Ident('JsBig::parse'), [R.Ref(v.e)]), 'bigint');
          return new Val(this.coerce(v, 'bigint'), 'bigint');
        }
        case 'String': return new Val(this.coerce(a(0), 'string'), 'string');
        case 'Boolean': return new Val(this.truthy(a(0)), 'boolean');
        case 'parseInt': {
          const v = new Val(R.Call(R.Ident('js_parse_int'), [R.Ref(this.coerce(a(0), 'string')), args[1] ? this.coerce(a(1), 'int64') : R.Lit('10i64')]), 'float64');
          return rt && isNumericType(rt) && !isFloatType(rt) ? new Val(this.coerce(v, rt), rt) : v;
        }
        case 'parseFloat': return new Val(R.Call(R.Ident('js_to_number'), [R.Ref(this.coerce(a(0), 'string'))]), 'float64');
        case 'isNaN': return new Val(R.MethodCall(this.coerce(a(0), 'float64'), 'is_nan', []), 'boolean');
        case 'isFinite': return new Val(R.MethodCall(this.coerce(a(0), 'float64'), 'is_finite', []), 'boolean');
        case 'Error': case 'TypeError': case 'RangeError':
          return new Val(R.Call(R.Ident('JsError::new'), [R.Lit(rustStringLiteral(name)), args[0] ? R.Ref(this.coerce(a(0), 'string')) : R.Lit('""')]), 'Error');
      }
      return null;
    }

    globalMethodCall(obj, key, node, rt) {
      const args = node.arguments || [];
      const a = i => this.expr(args[i]);
      switch (`${obj}.${key}`) {
        case 'AlgorithmFramework.Find': return new Val(R.Call(R.Ident('js_find_algorithm'), [R.Ref(this.coerce(a(0), 'string'))]), 'Algorithm');
        case 'AlgorithmFramework.RegisterAlgorithm': return new Val(R.Call(R.Ident('js_register_algorithm'), [this.coerce(a(0), 'object')]), 'void');
        case 'Object.keys': return new Val(R.Call(R.Ident('js_keys'), [R.Ref(this.coerce(a(0), 'any'))]), 'string[]');
        case 'Object.freeze': case 'Object.seal': return a(0);
        case 'Array.isArray': case 'ArrayBuffer.isView': return new Val(R.Call(R.Ident('js_is_array'), [R.Ref(this.coerce(a(0), 'any'))]), 'boolean');
        case 'Number.isInteger': case 'Number.isSafeInteger': return new Val(R.Call(R.Ident('js_is_integer'), [R.Ref(this.coerce(a(0), 'any'))]), 'boolean');
        case 'Number.isFinite': return new Val(R.MethodCall(this.coerce(a(0), 'float64'), 'is_finite', []), 'boolean');
        case 'Number.isNaN': return new Val(R.MethodCall(this.coerce(a(0), 'float64'), 'is_nan', []), 'boolean');
        case 'Number.parseInt': return this.globalCall('parseInt', node, rt);
        case 'String.fromCharCode': return new Val(R.Call(R.Ident('js_from_char_codes'), [R.MethodCall(this.spreadList(args, 'int32'), 'to_vec', [])]), 'string');
        case 'Math.imul': return new Val(R.Cast(R.MethodCall(this.toInt32Bits(a(0), 'uint32'), 'wrapping_mul', [this.toInt32Bits(a(1), 'uint32')]), 'i32'), 'int32');
        case 'BigInt.asUintN': case 'BigInt.asIntN': {
          const res = new Val(R.MethodCall(this.coerce(a(1), 'bigint'), key === 'asUintN' ? 'as_uint_n' : 'as_int_n', [this.coerce(a(0), 'idx')]), 'bigint');
          return rt && !isBigType(rt) && rt !== 'any' ? new Val(this.coerce(res, rt), rt) : res;
        }
        case 'console.log': case 'console.warn': case 'console.error': case 'console.info': case 'console.debug':
          return new Val(R.Call(R.Ident('js_log'), [R.Macro('vec', args.map((x, i) => this.coerce(a(i), 'any')))]), 'void');
      }
      if (obj === 'Math') return this.mathCall(key, args.map((x, i) => a(i)), rt);
      if (obj === 'OpCodes') return this.opCodesCall(key, args, rt, node);
      return null;
    }

    mathCall(key, args, rt) {
      const f64 = i => this.coerce(args[i], 'float64');
      const unary = { floor: 'floor', ceil: 'ceil', trunc: 'trunc', abs: 'abs', sqrt: 'sqrt', log: 'ln', log2: 'log2', log10: 'log10', exp: 'exp', sin: 'sin', cos: 'cos', tan: 'tan', tanh: 'tanh', atan: 'atan', cbrt: 'cbrt', log1p: 'ln_1p', expm1: 'exp_m1' };
      let res;
      if (unary[key]) res = new Val(R.MethodCall(f64(0), unary[key], []), 'float64');
      else if (key === 'round') res = new Val(R.Call(R.Ident('js_round'), [f64(0)]), 'float64');
      else if (key === 'sign') res = new Val(R.Call(R.Ident('js_sign'), [f64(0)]), 'float64');
      else if (key === 'pow') res = new Val(R.MethodCall(f64(0), 'powf', [f64(1)]), 'float64');
      else if (key === 'atan2') res = new Val(R.MethodCall(f64(0), 'atan2', [f64(1)]), 'float64');
      else if (key === 'hypot') res = new Val(R.MethodCall(f64(0), 'hypot', [f64(1)]), 'float64');
      else if (key === 'random') res = new Val(R.Call(R.Ident('js_random'), []), 'float64');
      else if (key === 'fround') res = new Val(R.Cast(R.Cast(f64(0), 'f32'), 'f64'), 'float64');
      else if (key === 'clz32') res = new Val(R.Cast(R.MethodCall(this.toInt32Bits(args[0], 'uint32'), 'leading_zeros', []), 'f64'), 'float64');
      else if (key === 'min' || key === 'max') return this.minMax(key, args, rt);
      else return null;
      return rt && isNumericType(rt) && !isFloatType(rt) ? new Val(this.coerce(res, rt), rt) : res;
    }

    minMax(key, args, rt) {
      const t = rt && isNumericType(rt) ? rt : 'float64';
      if (args.every(v => isIntType(canonicalType(v.t)) || v.isConst) && isIntType(t) && args.length >= 1) {
        let e = this.coerce(args[0], t);
        for (let i = 1; i < args.length; ++i) e = R.MethodCall(e, key, [this.coerce(args[i], t)]);
        return new Val(e, t);
      }
      const res = new Val(R.Call(R.Ident(key === 'min' ? 'js_min_f' : 'js_max_f'), [R.Ref(R.Macro('vec', args.map(v => this.coerce(v, 'float64'))))]), 'float64');
      return isFloatType(t) ? res : new Val(this.coerce(res, t), t);
    }

    methodCall(obj, key, argNodes, rt, node) {
      const ot = canonicalType(obj.t) || 'any';
      const info = obj.isThis ? this.fn.cls : (this.isLeafClass(ot) ? this.model.classOf(ot) : null);
      if (info) {
        const m = info.effective.methods.get(key);
        if (m) {
          const params = Model.functionParams(m.fn, m.jsDoc);
          return new Val(R.MethodCall(obj.recv || obj.e, this.methodName(key), this.callArgs(argNodes, params)), this.signatureReturn(m.fn, m.jsDoc).type);
        }
        if (info.effective.fields.has(key)) {
          const f = this.memberValue(obj, key, 'any');
          const args = argNodes.map(a => this.coerce(this.expr(a), 'any'));
          return new Val(R.MethodCall(this.coerce(f, 'any'), 'call', [R.Macro('vec', args)]), 'any');
        }
      }
      const builtin = this.builtinMethod(obj, ot, key, argNodes, rt, node);
      if (builtin) return builtin;
      const args = argNodes.map(a => this.coerce(this.expr(a), 'any'));
      if (obj.sig && (key === 'call' || key === 'apply')) return new Val(R.MethodCall(this.coerce(obj, 'any'), 'call', [R.Macro('vec', args.slice(1))]), 'any');
      return new Val(R.MethodCall(this.coerce(obj, 'object'), 'call', [R.Lit(rustStringLiteral(key)), R.Macro('vec', args)]), 'any');
    }

    builtinMethod(obj, ot, key, argNodes, rt) {
      const a = i => this.expr(argNodes[i]);
      const has = i => i < argNodes.length;
      const s = () => R.Ref(obj.e);
      if (ot === 'string') {
        switch (key) {
          case 'charCodeAt': case 'codePointAt': return new Val(R.Call(R.Ident('js_char_code_at'), [s(), has(0) ? this.coerce(a(0), 'int64') : R.Lit('0i64')]), 'int32');
          case 'charAt': return new Val(R.Call(R.Ident('js_char_at'), [s(), has(0) ? this.coerce(a(0), 'int64') : R.Lit('0i64')]), 'string');
          case 'toUpperCase': case 'toLocaleUpperCase': return new Val(R.Call(R.Ident('js_to_upper'), [s()]), 'string');
          case 'toLowerCase': case 'toLocaleLowerCase': return new Val(R.Call(R.Ident('js_to_lower'), [s()]), 'string');
          case 'trim': return new Val(R.MethodCall(R.MethodCall(obj.e, 'trim', []), 'to_string', []), 'string');
          case 'indexOf': return new Val(R.Call(R.Ident('js_str_index_of'), [s(), R.Ref(this.coerce(a(0), 'string')), has(1) ? this.coerce(a(1), 'int64') : R.Lit('0i64')]), 'int32');
          case 'lastIndexOf': return new Val(R.Call(R.Ident('js_str_last_index_of'), [s(), R.Ref(this.coerce(a(0), 'string'))]), 'int32');
          case 'includes': return new Val(R.MethodCall(obj.e, 'contains', [R.MethodCall(this.coerce(a(0), 'string'), 'as_str', [])]), 'boolean');
          case 'startsWith': return new Val(R.MethodCall(obj.e, 'starts_with', [R.MethodCall(this.coerce(a(0), 'string'), 'as_str', [])]), 'boolean');
          case 'endsWith': return new Val(R.MethodCall(obj.e, 'ends_with', [R.MethodCall(this.coerce(a(0), 'string'), 'as_str', [])]), 'boolean');
          case 'substring': return new Val(R.Call(R.Ident('js_substring'), [s(), this.coerce(a(0), 'int64'), has(1) ? this.coerce(a(1), 'int64') : R.Ident('JS_NO_END')]), 'string');
          case 'substr': return new Val(R.Call(R.Ident('js_substr'), [s(), this.coerce(a(0), 'int64'), has(1) ? this.coerce(a(1), 'int64') : R.Ident('JS_NO_END')]), 'string');
          case 'slice': return new Val(R.Call(R.Ident('js_str_slice'), [s(), has(0) ? this.coerce(a(0), 'int64') : R.Lit('0i64'), has(1) ? this.coerce(a(1), 'int64') : R.Ident('JS_NO_END')]), 'string');
          case 'split': {
            const sep = has(0) ? a(0) : null;
            if (sep && canonicalType(sep.t) === 'regex') return new Val(R.MethodCall(sep.e, 'split', [s()]), 'string[]');
            return new Val(R.Call(R.Ident('js_split'), [s(), sep ? R.Ref(this.coerce(sep, 'string')) : R.Lit('"\\u{0}"')]), 'string[]');
          }
          case 'repeat': return new Val(R.Call(R.Ident('js_repeat'), [s(), this.coerce(a(0), 'int64')]), 'string');
          case 'padStart': return new Val(R.Call(R.Ident('js_pad_start'), [s(), this.coerce(a(0), 'int64'), has(1) ? R.Ref(this.coerce(a(1), 'string')) : R.Lit('" "')]), 'string');
          case 'padEnd': return new Val(R.Call(R.Ident('js_pad_end'), [s(), this.coerce(a(0), 'int64'), has(1) ? R.Ref(this.coerce(a(1), 'string')) : R.Lit('" "')]), 'string');
          case 'concat': return new Val(R.Macro('format', ['"{}{}"', obj.e, this.coerce(a(0), 'string')]), 'string');
          case 'toString': case 'valueOf': case 'normalize': return obj;
          case 'replace': case 'replaceAll': {
            const x = a(0);
            if (canonicalType(x.t) === 'string') return new Val(R.MethodCall(obj.e, key === 'replace' ? 'replacen' : 'replace', key === 'replace' ? [R.MethodCall(this.coerce(x, 'string'), 'as_str', []), R.MethodCall(this.coerce(a(1), 'string'), 'as_str', []), R.Lit('1')] : [R.MethodCall(this.coerce(x, 'string'), 'as_str', []), R.MethodCall(this.coerce(a(1), 'string'), 'as_str', [])]), 'string');
            const re = canonicalType(x.t) === 'regex' ? x.e : R.Call(R.Ident('<JsRegex>::from_js'), [R.Ref(this.coerce(x, 'any'))]);
            return new Val(R.MethodCall(re, 'replace', [R.Ref(obj.e), R.Ref(this.coerce(a(1), 'string'))]), 'string');
          }
        }
      }
      if (isArrayType(ot)) {
        const el = elementType(ot) === 'object' ? 'any' : elementType(ot);
        switch (key) {
          case 'push': {
            if (argNodes.length === 1) return new Val(R.Cast(R.MethodCall(obj.e, 'push', [this.coerce(a(0), el)]), 'i32'), 'int32');
            const tmp = this.tmp('p');
            this.fn.pre.push(R.Let(tmp, null, obj.e, false));
            for (let i = 0; i < argNodes.length; ++i) this.fn.pre.push(R.ExprStmt(R.MethodCall(R.Ident(tmp), 'push', [this.coerce(a(i), el)])));
            return new Val(R.Cast(R.MethodCall(R.Ident(tmp), 'len', []), 'i32'), 'int32');
          }
          case 'slice': return new Val(R.MethodCall(obj.e, 'slice', [has(0) ? this.coerce(a(0), 'int64') : R.Lit('0i64'), has(1) ? this.coerce(a(1), 'int64') : R.Ident('JS_NO_END')]), ot);
          case 'join': return new Val(R.MethodCall(obj.e, 'join', [has(0) ? R.Ref(this.coerce(a(0), 'string')) : R.Lit('","')]), 'string');
          case 'indexOf': return new Val(R.MethodCall(obj.e, 'index_of', [R.Ref(this.coerce(a(0), el)), has(1) ? this.coerce(a(1), 'int64') : R.Lit('0i64')]), 'int32');
          case 'includes': return new Val(R.Binary('>=', R.MethodCall(obj.e, 'index_of', [R.Ref(this.coerce(a(0), el)), R.Lit('0i64')]), R.Lit('0')), 'boolean');
          case 'reverse': return new Val(R.MethodCall(obj.e, 'reverse', []), ot);
          case 'fill': return new Val(R.MethodCall(obj.e, 'fill', [this.coerce(a(0), el), has(1) ? this.coerce(a(1), 'int64') : R.Lit('0i64'), has(2) ? this.coerce(a(2), 'int64') : R.Ident('JS_NO_END')]), ot);
          case 'concat': return new Val(R.MethodCall(obj.e, 'concat', [R.Ref(R.Macro('vec', argNodes.map((x, i) => { const v = a(i); return isArrayType(canonicalType(v.t)) ? this.coerce(v, ot) : R.Call(R.Ident('js_arr'), [R.Macro('vec', [this.coerce(v, el)])]); })))]), ot);
          case 'pop': return new Val(R.MethodCall(obj.e, 'pop', []), el);
          case 'shift': return new Val(R.MethodCall(obj.e, 'shift', []), el);
          case 'unshift': return new Val(R.Cast(R.MethodCall(obj.e, 'unshift', [R.Macro('vec', argNodes.map((x, i) => this.coerce(a(i), el)))]), 'i32'), 'int32');
          case 'splice': return new Val(R.MethodCall(obj.e, 'splice', [has(0) ? this.coerce(a(0), 'int64') : R.Lit('0i64'), has(1) ? this.coerce(a(1), 'int64') : R.Ident('JS_NO_END'), R.Macro('vec', argNodes.slice(2).map((x, i) => this.coerce(a(i + 2), el)))]), ot);
          case 'set': return new Val(R.MethodCall(obj.e, 'set_from', [R.Ref(this.coerce(a(0), ot)), has(1) ? this.coerce(a(1), 'idx') : R.Lit('0usize')]), 'void');
          case 'subarray': return new Val(R.MethodCall(obj.e, 'subarray', [has(0) ? this.coerce(a(0), 'int64') : R.Lit('0i64'), has(1) ? this.coerce(a(1), 'int64') : R.Ident('JS_NO_END')]), ot);
          case 'toString': return new Val(R.MethodCall(obj.e, 'join', [R.Lit('","')]), 'string');
          case 'map': case 'filter': case 'forEach': case 'some': case 'every': case 'find': case 'findIndex': case 'reduce': case 'sort':
            return this.arrayCallback(obj, ot, key, argNodes, rt);
        }
      }
      if ((isNumericType(ot) || isBigType(ot)) && key === 'toString') {
        if (isBigType(ot)) return new Val(R.MethodCall(obj.e, 'to_string_radix', [has(0) ? R.Cast(this.coerce(a(0), 'int64'), 'u32') : R.Lit('10')]), 'string');
        // An integer prints exactly (a 64-bit BigInt held as u64 has no float form)
        if (isIntType(ot)) return new Val(R.MethodCall(R.Call(R.Ident(isSignedInt(ot) ? 'JsBig::from_i64' : 'JsBig::from_u64'), [R.Cast(obj.e, isSignedInt(ot) ? 'i64' : 'u64')]), 'to_string_radix', [has(0) ? R.Cast(this.coerce(a(0), 'int64'), 'u32') : R.Lit('10')]), 'string');
        return new Val(R.Call(R.Ident('js_num_to_string'), [this.coerce(obj, 'float64'), has(0) ? this.coerce(a(0), 'int64') : R.Lit('10i64')]), 'string');
      }
      if (isNumericType(ot) && key === 'toFixed') return new Val(R.Call(R.Ident('js_to_fixed'), [this.coerce(obj, 'float64'), has(0) ? this.coerce(a(0), 'int64') : R.Lit('0i64')]), 'string');
      if (ot === 'Map') {
        switch (key) {
          case 'get': return new Val(R.MethodCall(obj.e, 'map_get', [R.Ref(this.coerce(a(0), 'any'))]), 'any');
          case 'set': return new Val(R.MethodCall(obj.e, 'map_set', [this.coerce(a(0), 'any'), this.coerce(a(1), 'any')]), 'Map');
          case 'has': return new Val(R.MethodCall(obj.e, 'map_has', [R.Ref(this.coerce(a(0), 'any'))]), 'boolean');
          case 'delete': return new Val(R.MethodCall(obj.e, 'map_delete', [R.Ref(this.coerce(a(0), 'any'))]), 'boolean');
          case 'clear': return new Val(R.MethodCall(obj.e, 'map_clear', []), 'void');
          case 'keys': return new Val(R.MethodCall(obj.e, 'map_keys', []), 'any[]');
          case 'values': return new Val(R.MethodCall(obj.e, 'map_values', []), 'any[]');
        }
      }
      if (ot === 'regex' && key === 'test') return new Val(R.MethodCall(obj.e, 'test', [R.Ref(this.coerce(a(0), 'string'))]), 'boolean');
      if (key === 'toString' && argNodes.length === 0) return new Val(R.MethodCall(this.coerce(obj, 'any'), 'text', []), 'string');
      return null;
    }

    arrayCallback(obj, ot, key, argNodes, rt) {
      const el = elementType(ot) === 'object' ? 'any' : elementType(ot);
      const cb = this.callbackValue(argNodes[0]);
      if (!cb) throw new Error(`array ${key} with a callback that is not a function literal`);
      switch (key) {
        case 'map': {
          const outEl = isArrayType(rt) ? elementType(rt) : (cb.sig.ret.type === 'void' ? 'any' : cb.sig.ret.type);
          return new Val(R.MethodCall(obj.e, 'map', [this.adaptCallback(cb, [el, 'int32'], outEl)]), outEl + '[]');
        }
        case 'filter': return new Val(R.MethodCall(obj.e, 'filter', [this.adaptCallback(cb, [el, 'int32'], 'boolean')]), ot);
        case 'forEach': return new Val(R.MethodCall(obj.e, 'for_each', [this.adaptCallback(cb, [el, 'int32'], 'void')]), 'void');
        case 'some': return new Val(R.MethodCall(obj.e, 'some', [this.adaptCallback(cb, [el, 'int32'], 'boolean')]), 'boolean');
        case 'every': return new Val(R.MethodCall(obj.e, 'every', [this.adaptCallback(cb, [el, 'int32'], 'boolean')]), 'boolean');
        case 'find': return new Val(R.MethodCall(obj.e, 'find', [this.adaptCallback(cb, [el, 'int32'], 'boolean')]), el);
        case 'findIndex': return new Val(R.MethodCall(obj.e, 'find_index', [this.adaptCallback(cb, [el, 'int32'], 'boolean')]), 'int32');
        case 'sort': return new Val(R.MethodCall(obj.e, 'sort_by', [this.adaptCallback(cb, [el, el], 'float64')]), ot);
        case 'reduce': {
          const accT = rt && rt !== 'any' ? rt : (cb.sig.ret.type || 'any');
          const init = argNodes[1] ? this.coerce(this.expr(argNodes[1]), accT) : this.zero(accT);
          return new Val(R.MethodCall(obj.e, 'reduce', [this.adaptCallback(cb, [accT, el, 'int32'], accT), init]), accT);
        }
      }
      return null;
    }

    callbackValue(node) {
      if (!node || !['ArrowFunction', 'ArrowFunctionExpression', 'FunctionExpression'].includes(node.type)) return null;
      return this.funcLit(node, node.jsDoc);
    }

    /** A closure with exactly the parameter types the runtime passes, calling the transpiled one. */
    adaptCallback(cb, paramTypes, retType) {
      const params = cb.sig.params;
      const f = this.tmp('cb');
      const args = params.map((p, i) => i < paramTypes.length
        ? this.coerce(new Val(R.Ident(`a${i}`), paramTypes[i]), this.typeOfNullable(p.type, p.nullable))
        : this.zero(p.type));
      const call = R.Call(R.Ident(f), args);
      let body;
      if (retType === 'void') body = R.Block([R.ExprStmt(call)]);
      else if (cb.sig.ret.type === 'void') body = R.Block([R.ExprStmt(call)], this.zero(retType));
      else body = R.Block([], this.coerce(new Val(call, cb.sig.ret.type), retType));
      return R.BlockExpr([R.Let(f, null, cb.e, false)], R.Closure(paramTypes.map((t, i) => ({ name: `a${i}`, type: this.rustType(t) })), retType === 'void' ? null : this.rustType(retType), body, true));
    }

    xThisMethodCall(node) {
      return this.methodCall(this.thisValue(), node.method, node.arguments || [], this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable), node);
    }

    xParentMethodCall(node) {
      const info = this.fn.cls;
      let m = null;
      for (let c = info && info.base; c && !m; c = c.base) m = c.methods.get(node.method) || null;
      if (!m) throw new Error(`super.${node.method} has no base method`);
      const key = `js_super_${m.owner.name}_${node.method}`;
      if (!this.superCopies.has(key)) this.superCopies.set(key, { cls: info, fn: m.fn, jsDoc: m.jsDoc });
      return new Val(R.MethodCall(this.selfIdent(), key, this.callArgs(node.arguments || [], Model.functionParams(m.fn, m.jsDoc))), this.signatureReturn(m.fn, m.jsDoc).type);
    }

    xParentConstructorCall(node) {
      this.fn.pre.push(...this.parentConstructorCall(node));
      return new Val(R.Lit('()'), 'void');
    }

    xNewExpression(node) {
      // new AlgorithmFramework.X(...) is new X(...)
      const callee = node.callee;
      const name = callee && (callee.name || (callee.type === 'MemberExpression' && callee.object && callee.object.name === 'AlgorithmFramework' ? propKey(callee.property) : null));
      const rt = canonicalType(node.resultType) || 'any';
      const args = node.arguments || [];
      if (name && this.model.classes.has(name) && this.emittedClasses.has(name)) return this.newObject(this.model.classes.get(name), args);
      switch (name) {
        case 'Error': case 'TypeError': case 'RangeError': case 'SyntaxError':
          return new Val(R.Call(R.Ident('JsError::new'), [R.Lit(rustStringLiteral(name)), args[0] ? R.Ref(this.coerce(this.expr(args[0]), 'string')) : R.Lit('""')]), 'Error');
        case 'Array': {
          const el = isArrayType(rt) ? elementType(rt) : 'any';
          if (args.length === 1) {
            const n = this.expr(args[0]);
            if (isNumericType(canonicalType(n.t))) return new Val(R.Call(R.Ident(`${this.turbofishType(this.rustType(el + '[]'))}::with_len`), [this.coerce(n, 'idx')]), el + '[]');
          }
          return new Val(R.Call(R.Ident('js_arr'), [R.Macro('vec', args.map(a => this.coerce(this.expr(a), el)))]), el + '[]');
        }
        case 'Map': case 'Set': return new Val(R.Call(R.Ident('js_map_new'), []), 'Map');
        case 'Object': return new Val(R.Call(R.Ident('js_obj_of'), [R.Macro('vec', [])]), 'object');
      }
      if (/^(Uint8|Int8|Uint16|Int16|Uint32|Int32|Float32|Float64|Uint8Clamped|BigUint64|BigInt64)Array$/.test(name || '')) return this.typedArray(rt, args[0]);
      if (name && this.model.classes.has(name)) throw new Error(`new ${name}: the class is abstract here`);
      return this.unsupported({ type: 'new ' + name, resultType: rt });
    }

    newObject(info, args) {
      const ctorOwner = [...info.chain()].reverse().find(c => c.ctor) || null;
      const params = ctorOwner ? Model.functionParams(ctorOwner.ctor, ctorOwner.ctorDoc) : [];
      return new Val(R.Call(R.Ident(`${this.className(info.name)}::new`), this.callArgs(args, params)), this.isLeafClass(info.name) ? info.name : '#' + info.name);
    }

    typedArray(rt, arg) {
      const t = isArrayType(rt) ? rt : 'uint8[]';
      const rs = this.rustType(t);
      if (!arg) return new Val(R.Call(R.Ident(`${this.turbofishType(rs)}::new`), []), t);
      const v = this.expr(arg);
      const vt = canonicalType(v.t) || 'any';
      if (isNumericType(vt)) return new Val(R.Call(R.Ident(`${this.turbofishType(rs)}::with_len`), [this.coerce(v, 'idx')]), t);
      if (isArrayType(vt)) return this.sameRust(vt, t) ? new Val(R.MethodCall(v.e, 'copy', []), t) : new Val(this.coerce(v, t), t);
      return new Val(this.coerce(v, t), t);
    }

    // ---------------------------------------------------------- literals

    xArrayExpression(node) {
      const rt = canonicalType(node.resultType) || 'any[]';
      const t = isArrayType(rt) ? rt : 'any[]';
      const el = elementType(t) === 'object' ? 'any' : elementType(t);
      const elems = node.elements || [];
      if (elems.some(e => e && e.type === 'SpreadElement')) return new Val(this.spreadList(elems, el), t);
      return new Val(R.Call(R.Ident(`js_arr::<${this.rustType(el)}>`), [R.Macro('vec', elems.map(e => e ? this.coerce(this.expr(e), el) : this.zero(el)))]), t);
    }

    xArrayLiteral(node) { return this.xArrayExpression(node); }

    xObjectLiteral(node) {
      const entries = [];
      for (const p of node.properties || []) {
        if (p.type === 'SpreadElement' || p.type === 'SpreadProperty') throw new Error('object spread');
        const key = p.computed ? R.MethodCall(R.MethodCall(this.coerce(this.expr(p.key), 'any'), 'text', []), 'as_str', []) : R.Lit(rustStringLiteral(propKey(p.key)));
        let value;
        if (p.value && ['FunctionExpression', 'ArrowFunction', 'ArrowFunctionExpression'].includes(p.value.type)) value = this.funcLit(p.value, p.value.jsDoc).anyFn;
        else value = this.coerce(this.expr(p.value), 'any');
        entries.push(R.Tuple([key, value]));
      }
      const rt = canonicalType(node.resultType) || 'object';
      return new Val(R.Call(R.Ident('js_obj_of'), [R.Macro('vec', entries)]), rt === 'any' || !this.model.classOf(rt) ? 'object' : rt);
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
        if (text) parts.push(this.coerce(new Val(null, 'string', text), 'string'));
        if (node.expressions && node.expressions[i]) parts.push(this.coerce(this.expr(node.expressions[i]), 'string'));
      });
      return this.concatStrings(parts);
    }

    concatStrings(parts) {
      if (!parts.length) return new Val(null, 'string', '');
      return new Val(R.Macro('format', [`"${'{}'.repeat(parts.length)}"`, ...parts]), 'string');
    }

    xStringInterpolation(node) {
      return this.concatStrings((node.parts || []).map(p => p.type === 'StringPart' ? this.coerce(new Val(null, 'string', p.value), 'string') : this.coerce(this.expr(p.expression), 'string')));
    }

    // ---------------------------------------------------------- IL nodes

    xErrorCreation(node) {
      const msg = node.message ? this.coerce(this.expr(node.message), 'string') : R.Call(R.Ident('String::new'), []);
      return new Val(R.Call(R.Ident('JsError::new'), [R.Lit(rustStringLiteral(node.errorType || 'Error')), R.Ref(msg)]), 'Error');
    }

    xCast(node) {
      const arg = this.expr(node.arguments[0]);
      const target = canonicalType(node.targetType === 'int' ? 'int32' : node.targetType) || canonicalType(node.resultType);
      const method = node.opCodesMethod;
      const at = canonicalType(arg.t) || 'any';
      const masks = { ToUint32: ['>>>', 0, 'uint32'], ToDWord: ['>>>', 0, 'uint32'], ToInt: ['|', 0, 'int32'], ToInt32: ['|', 0, 'int32'],
        ToByte: ['&', 0xFF, 'uint8'], ToUint8: ['&', 0xFF, 'uint8'], ToWord: ['&', 0xFFFF, 'uint16'], ToUint16: ['&', 0xFFFF, 'uint16'] };
      if (masks[method]) {
        const [op, k, t] = masks[method];
        if (isBigType(at)) return new Val(this.coerce(new Val(R.MethodCall(arg.e, 'as_uint_n', [R.Lit('32usize')]), 'bigint'), target || t), target || t);
        const res = this.bitwise(op, arg, new Val(null, 'int32', k), t, false);
        return target && target !== res.t ? new Val(this.coerce(res, target), target) : res;
      }
      if (method === 'ToQWord') {
        if (isBigType(at)) return new Val(R.MethodCall(arg.e, 'to_u64', []), 'uint64');
        if (isFloatType(at)) return new Val(R.Cast(R.Call(R.Ident('js_f2i'), [arg.e]), 'u64'), 'uint64');
        return new Val(this.coerce(arg, 'uint64'), 'uint64');
      }
      return new Val(this.coerce(arg, target || 'any'), target || 'any');
    }

    xBigIntCast(node) {
      const v = this.expr(node.argument);
      const rt = canonicalType(node.resultType) || 'bigint';
      if (canonicalType(v.t) === 'string') return new Val(R.Call(R.Ident('JsBig::parse'), [R.Ref(v.e)]), 'bigint');
      if (v.isConst && typeof v.c === 'number') return new Val(null, rt, BigInt(Math.trunc(v.c)));
      return new Val(this.coerce(v, rt), rt);
    }

    xHexDecode(node) {
      const v = this.expr(node.arguments[0]);
      const rt = canonicalType(node.resultType) || 'uint8[]';
      const fn = { Hex16ToWords: 'js_hex16_to_words', Hex32ToDWords: 'js_hex32_to_dwords' }[node.opCodesMethod] || 'js_hex8_to_bytes';
      const natural = fn === 'js_hex32_to_dwords' ? 'uint32[]' : fn === 'js_hex16_to_words' ? 'uint16[]' : 'uint8[]';
      const res = new Val(R.Call(R.Ident(fn), [R.Ref(this.coerce(v, 'string'))]), natural);
      return rt === natural ? res : new Val(this.coerce(res, rt), rt);
    }

    xStringToBytes(node) {
      const v = this.expr(node.arguments[0]);
      const fn = { AnsiToBytes: 'js_ansi_to_bytes', AsciiToBytes: 'js_ascii_to_bytes', Utf8ToBytes: 'js_utf8_to_bytes' }[node.opCodesMethod] || (node.encoding === 'utf8' ? 'js_utf8_to_bytes' : 'js_ascii_to_bytes');
      return new Val(R.Call(R.Ident(fn), [R.Ref(this.coerce(v, 'string'))]), 'uint8[]');
    }

    xBytesToString(node) {
      const v = this.expr(node.arguments[0]);
      const fn = { BytesToAnsi: 'js_bytes_to_ansi', BytesToUtf8: 'js_bytes_to_utf8' }[node.opCodesMethod] || 'js_bytes_to_ascii';
      return new Val(R.Call(R.Ident(fn), [R.Ref(this.coerce(v, 'uint8[]'))]), 'string');
    }

    xPackBytes(node) {
      const bits = node.bits || 32;
      const le = node.endian === 'little';
      const rt = canonicalType(node.resultType) || (bits === 16 ? 'uint16' : 'uint32');
      const args = node.arguments || [];
      const n = bits / 8;
      let byteExprs;
      if (args.length === 1 || args.some(a => a.type === 'SpreadElement')) {
        const tmp = this.tmp('p');
        this.fn.pre.push(R.Let(tmp, null, R.MethodCall(this.spreadList(args, 'int32'), 'to_vec', []), false));
        byteExprs = Array.from({ length: n }, (_, i) => R.Call(R.Ident('js_byte_at'), [R.Ref(R.Ident(tmp)), R.Lit(`${i}usize`)]));
      } else {
        byteExprs = args.map(a => this.toInt32Bits(this.expr(a), 'int32'));
      }
      const goT = bits === 64 ? 'u64' : 'u32';
      let acc = null;
      byteExprs.forEach((b, i) => {
        const pos = le ? i : n - 1 - i;
        let part = R.Cast(R.Paren(R.Binary('&', b, R.Lit('0xFF'))), goT);
        if (pos) part = R.Binary('<<', R.Paren(part), R.Lit(String(pos * 8)));
        acc = acc ? R.Binary('|', acc, part) : part;
      });
      const natural = bits === 16 ? 'int32' : (bits === 64 ? 'uint64' : 'uint32');
      const res = new Val(bits === 16 ? R.Cast(R.Paren(acc), 'i32') : acc, natural);
      return rt === natural ? res : new Val(this.coerce(res, rt), rt);
    }

    xUnpackBytes(node) {
      const bits = node.bits || 32;
      const le = node.endian === 'little';
      const v = this.expr(node.arguments[0]);
      const rt = canonicalType(node.resultType) || 'uint8[]';
      let res;
      if (bits === 64) res = new Val(R.Call(R.Ident(le ? 'js_unpack64_le' : 'js_unpack64_be'), [isBigType(canonicalType(v.t)) ? R.MethodCall(v.e, 'to_u64', []) : this.coerce(v, 'uint64')]), 'uint8[]');
      else res = new Val(R.Call(R.Ident(`js_unpack${bits}_${le ? 'le' : 'be'}`), [this.toInt32Bits(v, 'uint32')]), 'uint8[]');
      return rt === 'uint8[]' ? res : new Val(this.coerce(res, rt), rt);
    }

    xRotateLeft(node) { return this.rotate(node, true); }
    xRotateRight(node) { return this.rotate(node, false); }

    rotate(node, left) {
      const bits = node.bits || 32;
      const v = this.expr(node.value);
      const amt = this.expr(node.amount);
      const rt = canonicalType(node.resultType) || (bits === 64 ? 'uint64' : 'uint32');
      const m = left ? 'rotate_left' : 'rotate_right';
      let res;
      if (bits === 64) {
        const x = isBigType(canonicalType(v.t)) ? R.MethodCall(v.e, 'to_u64', []) : this.coerce(v, 'uint64');
        res = new Val(R.MethodCall(x, m, [R.Binary('&', this.toInt32Bits(amt, 'uint32'), R.Lit('63'))]), 'uint64');
      } else {
        const rs = bits === 8 ? 'u8' : bits === 16 ? 'u16' : 'u32';
        const x = bits === 32 ? this.toInt32Bits(v, 'uint32') : R.Cast(this.toInt32Bits(v, 'uint32'), rs);
        const k = amt.isConst ? R.Lit(`${(Number(amt.c) | 0) & (bits - 1)}u32`) : R.Binary('&', this.toInt32Bits(amt, 'uint32'), R.Lit(String(bits - 1)));
        res = new Val(R.MethodCall(x, m, [k]), { u8: 'uint8', u16: 'uint16', u32: 'uint32' }[rs]);
      }
      return rt === res.t ? res : new Val(this.coerce(res, rt), rt);
    }

    xArrayXor(node) {
      const rt = canonicalType(node.resultType) || 'uint8[]';
      const res = new Val(R.Call(R.Ident('js_xor_arrays'), [R.Ref(this.coerce(this.expr(node.arguments[0]), 'uint8[]')), R.Ref(this.coerce(this.expr(node.arguments[1]), 'uint8[]'))]), 'uint8[]');
      return rt === 'uint8[]' ? res : new Val(this.coerce(res, rt), rt);
    }

    xArrayClear(node) {
      const a = this.expr(node.arguments[0]);
      return new Val(R.MethodCall(a.e, 'clear_values', []), 'void');
    }

    xArrayAppend(node) {
      const arr = this.expr(node.array);
      const at = canonicalType(arr.t) || 'any[]';
      if (!isArrayType(at)) return this.unsupportedVal([R.Lit('"push on a value that is not an array"')], 'int32');
      const el = elementType(at) === 'object' ? 'any' : elementType(at);
      const values = node.values || (node.value ? [node.value] : []);
      const tmp = this.tmp('p');
      this.fn.pre.push(R.Let(tmp, null, arr.e, false));
      for (const v of values) {
        if (v && v.type === 'SpreadElement') this.fn.pre.push(R.ExprStmt(R.MethodCall(R.Ident(tmp), 'push_all', [R.Ref(this.coerce(this.expr(v.argument), at))])));
        else this.fn.pre.push(R.ExprStmt(R.MethodCall(R.Ident(tmp), 'push', [this.coerce(this.expr(v), el)])));
      }
      return new Val(R.Cast(R.MethodCall(R.Ident(tmp), 'len', []), 'i32'), 'int32');
    }

    xArrayCreation(node) {
      const rt = canonicalType(node.resultType) || ((node.elementType || 'any') + '[]');
      const t = isArrayType(rt) ? rt : 'any[]';
      const rs = this.turbofishType(this.rustType(t));
      if (!node.size) return new Val(R.Call(R.Ident(`${rs}::new`), []), t);
      return new Val(R.Call(R.Ident(`${rs}::with_len`), [this.coerce(this.expr(node.size), 'idx')]), t);
    }

    xTypedArrayCreation(node) {
      const rt = canonicalType(node.resultType) || 'uint8[]';
      if (node.buffer) return new Val(this.coerce(this.expr(node.buffer), rt), rt);
      return this.typedArray(rt, node.size);
    }

    xBufferCreation(node) {
      return new Val(R.Call(R.Ident('JsArr::<u8>::with_len'), [this.coerce(this.expr(node.size), 'idx')]), 'uint8[]');
    }

    xArrayFrom(node) {
      const rt = canonicalType(node.resultType) || 'any[]';
      const t = isArrayType(rt) ? rt : 'any[]';
      const el = elementType(t) === 'object' ? 'any' : elementType(t);
      const lengthOf = () => {
        let len = node.length;
        if (!len && node.iterable && node.iterable.type === 'ObjectLiteral') {
          const p = node.iterable.properties.find(x => propKey(x.key) === 'length');
          len = p && p.value;
        }
        return len;
      };
      if (node.mapFunction) {
        const cb = this.callbackValue(node.mapFunction);
        if (!cb) throw new Error('Array.from with a map function that is not a literal');
        const len = lengthOf();
        if (len) return new Val(R.MethodCall(R.Call(R.Ident('JsArr::<JsAny>::with_len'), [this.coerce(this.expr(len), 'idx')]), 'map', [this.adaptCallback(cb, ['any', 'int32'], el)]), t);
        const src = this.expr(node.iterable);
        const st = canonicalType(src.t) || 'any[]';
        const s = isArrayType(st) ? src : new Val(this.coerce(src, 'any[]'), 'any[]');
        const srcEl = isArrayType(st) ? (elementType(st) === 'object' ? 'any' : elementType(st)) : 'any';
        return new Val(R.MethodCall(s.e, 'map', [this.adaptCallback(cb, [srcEl, 'int32'], el)]), t);
      }
      const len = lengthOf();
      if (len) return new Val(R.Call(R.Ident(`${this.turbofishType(this.rustType(t))}::with_len`), [this.coerce(this.expr(len), 'idx')]), t);
      const src = this.expr(node.iterable);
      const st = canonicalType(src.t) || 'any';
      if (isArrayType(st) && this.sameRust(st, t)) return new Val(R.MethodCall(src.e, 'copy', []), t);
      if (st === 'string') return new Val(this.coerce(new Val(R.Call(R.Ident('js_string_chars'), [R.Ref(src.e)]), 'string[]'), t), t);
      return new Val(this.coerce(src, t), t);
    }

    xArraySlice(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t) || 'any';
      const start = node.start ? this.coerce(this.expr(node.start), 'int64') : R.Lit('0i64');
      const end = node.end ? this.coerce(this.expr(node.end), 'int64') : R.Ident('JS_NO_END');
      if (at === 'string') return new Val(R.Call(R.Ident('js_str_slice'), [R.Ref(a.e), start, end]), 'string');
      const rt = canonicalType(node.resultType) || at;
      const src = isArrayType(at) ? a : new Val(this.coerce(a, rt), rt);
      const res = new Val(R.MethodCall(src.e, 'slice', [start, end]), src.t);
      return this.sameRust(res.t, rt) ? res : new Val(this.coerce(res, rt), rt);
    }

    xTypedArraySubarray(node) {
      const a = this.expr(node.array);
      return new Val(R.MethodCall(a.e, 'subarray', [node.begin ? this.coerce(this.expr(node.begin), 'int64') : R.Lit('0i64'), node.end ? this.coerce(this.expr(node.end), 'int64') : R.Ident('JS_NO_END')]), canonicalType(a.t));
    }

    xTypedArraySet(node) {
      const a = this.expr(node.array);
      return new Val(R.MethodCall(a.e, 'set_from', [R.Ref(this.coerce(this.expr(node.source), canonicalType(a.t))), node.offset ? this.coerce(this.expr(node.offset), 'idx') : R.Lit('0usize')]), 'void');
    }

    xArrayConcat(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t) || 'any[]';
      const t = isArrayType(at) ? at : (canonicalType(node.resultType) || 'any[]');
      const el = elementType(t) === 'object' ? 'any' : elementType(t);
      const parts = (node.arrays || []).map(x => {
        const v = this.expr(x.type === 'SpreadElement' ? x.argument : x);
        return isArrayType(canonicalType(v.t)) ? this.coerce(v, t) : R.Call(R.Ident('js_arr'), [R.Macro('vec', [this.coerce(v, el)])]);
      });
      return new Val(R.MethodCall(this.coerce(a, t), 'concat', [R.Ref(R.Macro('vec', parts))]), t);
    }

    xArrayFill(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t) || canonicalType(node.resultType) || 'any[]';
      const el = isArrayType(at) ? (elementType(at) === 'object' ? 'any' : elementType(at)) : 'any';
      return new Val(R.MethodCall(a.e, 'fill', [this.coerce(this.expr(node.value), el), node.start ? this.coerce(this.expr(node.start), 'int64') : R.Lit('0i64'), node.end ? this.coerce(this.expr(node.end), 'int64') : R.Ident('JS_NO_END')]), at);
    }

    xArrayIndexOf(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t) || 'any';
      if (at === 'string') return new Val(R.Call(R.Ident('js_str_index_of'), [R.Ref(a.e), R.Ref(this.coerce(this.expr(node.value), 'string')), node.start ? this.coerce(this.expr(node.start), 'int64') : R.Lit('0i64')]), 'int32');
      const arr = isArrayType(at) ? a : new Val(this.coerce(a, 'any[]'), 'any[]');
      const el = elementType(arr.t) === 'object' ? 'any' : elementType(arr.t);
      return new Val(R.MethodCall(arr.e, 'index_of', [R.Ref(this.coerce(this.expr(node.value), el)), node.start ? this.coerce(this.expr(node.start), 'int64') : R.Lit('0i64')]), 'int32');
    }

    xArrayIncludes(node) {
      const r = this.xArrayIndexOf(node);
      return new Val(R.Binary('>=', r.e, R.Lit('0')), 'boolean');
    }

    xArrayJoin(node) {
      const a = this.expr(node.array);
      return new Val(R.MethodCall(a.e, 'join', [node.separator ? R.Ref(this.coerce(this.expr(node.separator), 'string')) : R.Lit('","')]), 'string');
    }

    xArrayReverse(node) { const a = this.expr(node.array); return new Val(R.MethodCall(a.e, 'reverse', []), canonicalType(a.t)); }
    xArrayPop(node) { const a = this.expr(node.array); return new Val(R.MethodCall(a.e, 'pop', []), elementType(canonicalType(a.t)) || 'any'); }
    xArrayShift(node) { const a = this.expr(node.array); return new Val(R.MethodCall(a.e, 'shift', []), elementType(canonicalType(a.t)) || 'any'); }

    xArrayUnshift(node) {
      const a = this.expr(node.array);
      const el = elementType(canonicalType(a.t)) || 'any';
      return new Val(R.Cast(R.MethodCall(a.e, 'unshift', [R.Macro('vec', [this.coerce(this.expr(node.value), el)])]), 'i32'), 'int32');
    }

    xArraySplice(node) {
      const a = this.expr(node.array);
      const at = canonicalType(a.t);
      const el = elementType(at) || 'any';
      return new Val(R.MethodCall(a.e, 'splice', [node.start ? this.coerce(this.expr(node.start), 'int64') : R.Lit('0i64'), node.deleteCount ? this.coerce(this.expr(node.deleteCount), 'int64') : R.Ident('JS_NO_END'), R.Macro('vec', (node.items || []).map(i => this.coerce(this.expr(i), el)))]), at);
    }

    xArrayMap(node) { const a = this.expr(node.array); return this.arrayCallback(a, canonicalType(a.t), 'map', [node.callback], canonicalType(node.resultType)); }
    xArrayFilter(node) { const a = this.expr(node.array); return this.arrayCallback(a, canonicalType(a.t), 'filter', [node.callback], canonicalType(node.resultType)); }
    xArrayForEach(node) { const a = this.expr(node.array); return this.arrayCallback(a, canonicalType(a.t), 'forEach', [node.callback], 'void'); }
    xArraySort(node) {
      const a = this.expr(node.array);
      if (!node.compareFn) return new Val(R.MethodCall(a.e, 'sort_default', []), canonicalType(a.t));
      return this.arrayCallback(a, canonicalType(a.t), 'sort', [node.compareFn], canonicalType(a.t));
    }

    xIsArrayCheck(node) {
      const v = this.expr(node.value);
      if (isArrayType(canonicalType(v.t))) return new Val(R.Unary('!', R.MethodCall(v.e, 'is_null', [])), 'boolean');
      return new Val(R.Call(R.Ident('js_is_array'), [R.Ref(this.coerce(v, 'any'))]), 'boolean');
    }

    xIsIntegerCheck(node) {
      const v = this.expr(node.value);
      if (isIntType(canonicalType(v.t))) return new Val(null, 'boolean', true);
      return new Val(R.Call(R.Ident('js_is_integer'), [R.Ref(this.coerce(v, 'any'))]), 'boolean');
    }

    xObjectFreeze(node) { return this.expr(node.object); }

    xMapCreation(node) {
      const m = this.tmp('m');
      const stmts = [R.Let(m, null, R.Call(R.Ident('js_map_new'), []), false)];
      for (const e of node.entries || []) {
        if (e && e.type === 'ArrayExpression' && e.elements.length === 2)
          stmts.push(R.ExprStmt(R.MethodCall(R.Ident(m), 'map_set', [this.coerce(this.expr(e.elements[0]), 'any'), this.coerce(this.expr(e.elements[1]), 'any')])));
      }
      return new Val(R.BlockExpr(stmts, R.Ident(m)), 'Map');
    }

    xFloor(node) { return this.mathUnary(node, 'floor'); }
    xCeil(node) { return this.mathUnary(node, 'ceil'); }
    xRound(node) { return this.mathUnary(node, 'round'); }
    xTruncate(node) { return this.mathUnary(node, 'trunc'); }
    xAbs(node) { return this.mathUnary(node, 'abs'); }
    xSqrt(node) { return this.mathUnary(node, 'sqrt'); }
    xLog(node) { return this.mathUnary(node, 'ln'); }
    xLog2(node) { return this.mathUnary(node, 'log2'); }
    xExp(node) { return this.mathUnary(node, 'exp'); }
    xSin(node) { return this.mathUnary(node, 'sin'); }
    xCos(node) { return this.mathUnary(node, 'cos'); }
    xTanh(node) { return this.mathUnary(node, 'tanh'); }

    mathUnary(node, fn) {
      const v = this.expr(node.argument);
      const rt = canonicalType(node.resultType) || 'float64';
      const vt = canonicalType(v.t);
      if (isIntType(vt) && ['floor', 'ceil', 'trunc', 'round'].includes(fn)) {
        const t = rt && isNumericType(rt) ? rt : vt;
        return new Val(this.coerce(v, t), t);
      }
      if (v.isConst && typeof v.c === 'number') {
        const f = { floor: Math.floor, ceil: Math.ceil, round: Math.round, trunc: Math.trunc, abs: Math.abs, sqrt: Math.sqrt, ln: Math.log, log2: Math.log2, exp: Math.exp, sin: Math.sin, cos: Math.cos, tanh: Math.tanh }[fn];
        if (f) return new Val(null, rt, f(v.c));
      }
      const res = fn === 'round' ? new Val(R.Call(R.Ident('js_round'), [this.coerce(v, 'float64')]), 'float64') : new Val(R.MethodCall(this.coerce(v, 'float64'), fn, []), 'float64');
      return isFloatType(rt) || !isNumericType(rt) ? res : new Val(this.coerce(res, rt), rt);
    }

    xMin(node) { return this.minMax('min', (node.arguments || []).map(a => this.expr(a)), canonicalType(node.resultType)); }
    xMax(node) { return this.minMax('max', (node.arguments || []).map(a => this.expr(a)), canonicalType(node.resultType)); }
    xPower(node) { return this.power(this.expr(node.base), this.expr(node.exponent), canonicalType(node.resultType)); }

    xMathCall(node) {
      const args = (node.arguments || []).map(a => this.expr(a));
      const rt = canonicalType(node.resultType);
      if (node.method === 'imul') return new Val(R.Cast(R.MethodCall(this.toInt32Bits(args[0], 'uint32'), 'wrapping_mul', [this.toInt32Bits(args[1], 'uint32')]), 'i32'), 'int32');
      return this.mathCall(node.method, args, rt) || this.unsupported(node);
    }

    xMathConstant(node) { return new Val(null, 'float64', node.value !== undefined ? node.value : Math[node.name]); }
    xNumberConstant(node) { return new Val(null, canonicalType(node.resultType) || 'float64', node.value); }
    xRandom() { return new Val(R.Call(R.Ident('js_random'), []), 'float64'); }

    xCountLeadingZeros(node) {
      const v = this.expr(node.argument);
      return new Val(R.Cast(R.MethodCall(this.toInt32Bits(v, 'uint32'), 'leading_zeros', []), 'i32'), 'int32');
    }

    xStringCharAt(node) {
      return new Val(R.Call(R.Ident('js_char_at'), [R.Ref(this.coerce(this.expr(node.string), 'string')), this.coerce(this.expr(node.index), 'int64')]), 'string');
    }

    xStringCharCodeAt(node) {
      return new Val(R.Call(R.Ident('js_char_code_at'), [R.Ref(this.coerce(this.expr(node.string), 'string')), node.index ? this.coerce(this.expr(node.index), 'int64') : R.Lit('0i64')]), 'int32');
    }

    xStringFromCharCodes(node) {
      return new Val(R.Call(R.Ident('js_from_char_codes'), [R.MethodCall(this.spreadList(node.charCodes || [], 'int32'), 'to_vec', [])]), 'string');
    }

    xStringTransform(node) {
      const s = this.expr(node.string);
      return this.builtinMethod(s, 'string', node.method, [], 'string') || this.unsupported(node);
    }

    xStringRepeat(node) {
      return new Val(R.Call(R.Ident('js_repeat'), [R.Ref(this.coerce(this.expr(node.string), 'string')), this.coerce(this.expr(node.count), 'int64')]), 'string');
    }

    xStringReplace(node) {
      const s = this.expr(node.string);
      return this.builtinMethod(new Val(this.coerce(s, 'string'), 'string'), 'string', node.method === 'replaceAll' ? 'replaceAll' : 'replace', [node.searchValue, node.replaceValue], 'string') || this.unsupported(node);
    }

    xStringIndexOf(node) {
      const s = R.Ref(this.coerce(this.expr(node.string), 'string'));
      const sub = R.Ref(this.coerce(this.expr(node.searchValue), 'string'));
      if (node.method === 'lastIndexOf') return new Val(R.Call(R.Ident('js_str_last_index_of'), [s, sub]), 'int32');
      return new Val(R.Call(R.Ident('js_str_index_of'), [s, sub, node.fromIndex ? this.coerce(this.expr(node.fromIndex), 'int64') : R.Lit('0i64')]), 'int32');
    }

    xStringIncludes(node) {
      const s = this.coerce(this.expr(node.string), 'string');
      const sub = R.MethodCall(this.coerce(this.expr(node.searchValue), 'string'), 'as_str', []);
      const m = node.method === 'startsWith' ? 'starts_with' : node.method === 'endsWith' ? 'ends_with' : 'contains';
      return new Val(R.MethodCall(s, m, [sub]), 'boolean');
    }

    xStringSubstring(node) {
      const s = R.Ref(this.coerce(this.expr(node.string), 'string'));
      const start = node.start ? this.coerce(this.expr(node.start), 'int64') : R.Lit('0i64');
      if (node.method === 'substr') return new Val(R.Call(R.Ident('js_substr'), [s, start, node.length ? this.coerce(this.expr(node.length), 'int64') : R.Ident('JS_NO_END')]), 'string');
      if (node.method === 'slice') return new Val(R.Call(R.Ident('js_str_slice'), [s, start, node.end ? this.coerce(this.expr(node.end), 'int64') : R.Ident('JS_NO_END')]), 'string');
      return new Val(R.Call(R.Ident('js_substring'), [s, start, node.end ? this.coerce(this.expr(node.end), 'int64') : R.Ident('JS_NO_END')]), 'string');
    }

    xStringSplit(node) {
      if (node.separator) {
        const sep = this.expr(node.separator);
        if (canonicalType(sep.t) === 'regex') return new Val(R.MethodCall(sep.e, 'split', [R.Ref(this.coerce(this.expr(node.string), 'string'))]), 'string[]');
      }
      return new Val(R.Call(R.Ident('js_split'), [R.Ref(this.coerce(this.expr(node.string), 'string')), node.separator ? R.Ref(this.coerce(this.expr(node.separator), 'string')) : R.Lit('"\\u{0}"')]), 'string[]');
    }

    xStringPad(node) {
      return new Val(R.Call(R.Ident(node.method === 'padEnd' ? 'js_pad_end' : 'js_pad_start'), [R.Ref(this.coerce(this.expr(node.string), 'string')), this.coerce(this.expr(node.targetLength), 'int64'), node.padString ? R.Ref(this.coerce(this.expr(node.padString), 'string')) : R.Lit('" "')]), 'string');
    }

    xDebugOutput(node) {
      return new Val(R.Call(R.Ident('js_log'), [R.Macro('vec', (node.arguments || []).map(a => this.coerce(this.expr(a), 'any')))]), 'void');
    }

    xOpCodesCall(node) {
      return this.opCodesCall(node.method || node.opCodesMethod, node.arguments || [], this.typeOfNullable(canonicalType(node.resultType) || 'any', node.nullable), node);
    }

    opCodesCall(method, argNodes, rt) {
      const sig = OPCODES_SIGNATURES[method];
      if (!sig) {
        this.warnings.push(`OpCodes.${method}`);
        return this.unsupportedVal([R.Lit(rustStringLiteral('OpCodes.' + method))], rt || 'any');
      }
      if (sig.special) return sig.special.call(this, argNodes, rt);
      const args = sig.params.map((t, i) => {
        const e = i < argNodes.length ? this.coerce(this.expr(argNodes[i]), t) : this.zero(t);
        return /^(JsArr|JsBig|String)/.test(this.rustType(t)) ? R.Ref(e) : e;
      });
      const res = new Val(R.Call(R.Ident(sig.fn), args), sig.returns);
      return rt && rt !== 'any' && !this.sameRust(rt, sig.returns) ? new Val(this.coerce(res, rt), rt) : res;
    }
  }

  /** OpCodes methods the IL leaves as calls: runtime function, JSDoc parameter and return IL types. */
  const OPCODES_SIGNATURES = {
    GetByte: { fn: 'op_get_byte', params: ['uint32', 'int32'], returns: 'uint8' },
    GF256Mul: { fn: 'op_gf256_mul', params: ['int32', 'int32'], returns: 'uint8' },
    SetBit: { fn: 'op_set_bit', params: ['uint32', 'int32', 'int32'], returns: 'uint32' },
    GetBit: { fn: 'op_get_bit', params: ['uint32', 'int32'], returns: 'boolean' },
    BitMask: { fn: 'op_bit_mask', params: ['int32'], returns: 'uint32' },
    Shr32Signed: { fn: 'op_shr32_signed', params: ['int32', 'int32'], returns: 'int32' },
    MulHi32: { fn: 'op_mul_hi32', params: ['uint32', 'uint32'], returns: 'uint32' },
    PopCount: { fn: 'op_pop_count', params: ['uint32'], returns: 'int32' },
    PopCountFast: { fn: 'op_pop_count', params: ['uint32'], returns: 'int32' },
    Hex32ToDWords: { fn: 'js_hex32_to_dwords', params: ['string'], returns: 'uint32[]', byRef: true },
    SecureCompare: { fn: 'op_secure_compare', params: ['uint8[]', 'uint8[]'], returns: 'boolean' },
    ConstantTimeCompare: { fn: 'op_constant_time_compare', params: ['uint8[]', 'uint8[]', 'int32'], returns: 'boolean' },
    ArraysEqual: { fn: 'op_secure_compare', params: ['uint8[]', 'uint8[]'], returns: 'boolean' },
    BytesToChars: { fn: 'op_bytes_to_chars', params: ['uint8[]'], returns: 'string' },
    RotL64n: { fn: 'op_rot_l64n', params: ['bigint', 'int32'], returns: 'bigint' },
    RotR64n: { fn: 'op_rot_r64n', params: ['bigint', 'int32'], returns: 'bigint' },
    GcdN: { fn: 'op_gcd_n', params: ['bigint', 'bigint'], returns: 'bigint' },
    ModN: { fn: 'op_mod_n', params: ['bigint', 'bigint'], returns: 'bigint' },
    MulModN: { fn: 'op_mul_mod_n', params: ['bigint', 'bigint', 'bigint'], returns: 'bigint' },
    ModPowN: { fn: 'op_mod_pow_n', params: ['bigint', 'bigint', 'bigint'], returns: 'bigint' },
    ModInverseN: { fn: 'op_mod_inverse_n', params: ['bigint', 'bigint'], returns: 'bigint' },
    SquareModN: { fn: 'op_square_mod_n', params: ['bigint', 'bigint'], returns: 'bigint' },
    GetBitN: { fn: 'op_get_bit_n', params: ['bigint', 'int32'], returns: 'bigint' },
    BitCountN: { fn: 'op_bit_count_n', params: ['bigint'], returns: 'int32' },
    RotL128n: { fn: 'op_rot_l128n', params: ['bigint', 'int32'], returns: 'bigint' },
    ToLong: { fn: 'op_to_long', params: ['bigint'], returns: 'bigint' },
    ToShort: { fn: 'op_to_short', params: ['int32'], returns: 'int16' },
    GFMul: { fn: 'op_gf_mul', params: ['int32', 'int32', 'int32', 'int32'], returns: 'uint32' },
    Add3L64: { fn: 'op_add3_l64', params: ['uint32', 'uint32', 'uint32'], returns: 'float64' },
    Add3H64: { fn: 'op_add3_h64', params: ['float64', 'float64', 'float64', 'float64'], returns: 'int32' },
    EncodeMsgLength64LE: { fn: 'op_encode_msg_length64_le', params: ['float64'], returns: 'uint8[]' },
    Words32ToBytesBE: { fn: 'op_words32_to_bytes_be', params: ['uint32[]'], returns: 'uint8[]' },
    BytesToWords32BE: { fn: 'op_bytes_to_words32_be', params: ['uint8[]'], returns: 'uint32[]' },
    XorArrayWithByte: { fn: 'op_xor_array_with_byte', params: ['uint8[]', 'int32'], returns: 'uint8[]' },
    GCMIncrement: { fn: 'op_gcm_increment', params: ['uint8[]'], returns: 'uint8[]' },
    GHashMul: { fn: 'op_ghash_mul', params: ['uint8[]', 'uint8[]'], returns: 'uint8[]' },
    SecureRandomBytes: { fn: 'op_secure_random_bytes', params: ['int32'], returns: 'uint8[]' },
    RotL64_HL: { fn: 'op_rot_l64_hl', params: ['uint32', 'uint32', 'int32'], returns: 'object' },
    Split64: { fn: 'op_split64', params: ['float64'], returns: 'object' },
    AddMod: { fn: 'op_add_mod', params: ['float64', 'float64', 'float64'], returns: 'float64' },
    SubMod: { fn: 'op_sub_mod', params: ['float64', 'float64', 'float64'], returns: 'float64' },
    CreateUint64ArrayFromHex: { fn: 'op_create_uint64_array_from_hex', params: ['string[]'], returns: 'uint32[][]' },
    CreateArray: {
      special(argNodes, rt) {
        const t = rt && isArrayType(rt) ? rt : 'uint8[]';
        const el = elementType(t) === 'object' ? 'any' : elementType(t);
        const n = this.coerce(this.expr(argNodes[0]), 'idx');
        const v = argNodes[1] ? this.coerce(this.expr(argNodes[1]), el) : this.zero(el);
        return new Val(R.Call(R.Ident(`${this.turbofishType(this.rustType(t))}::filled`), [n, v]), t);
      }
    },
    CopyArray: {
      special(argNodes, rt) {
        const v = this.expr(argNodes[0]);
        const vt = canonicalType(v.t);
        const res = new Val(R.MethodCall(isArrayType(vt) ? v.e : this.coerce(v, rt || 'uint8[]'), 'copy', []), isArrayType(vt) ? vt : (rt || 'uint8[]'));
        return rt && rt !== 'any' && !this.sameRust(rt, res.t) ? new Val(this.coerce(res, rt), rt) : res;
      }
    },
    ConcatArrays: {
      special(argNodes, rt) {
        const t = rt && isArrayType(rt) ? rt : 'uint8[]';
        if (argNodes[0].type === 'ArrayExpression') return new Val(R.Call(R.Ident('js_concat'), [R.Macro('vec', argNodes[0].elements.map(e => this.coerce(this.expr(e), t)))]), t);
        return new Val(R.Call(R.Ident('js_concat'), [R.MethodCall(this.coerce(this.expr(argNodes[0]), t + '[]'), 'to_vec', [])]), t);
      }
    },
    ArraySlice: {
      special(argNodes) {
        const v = this.expr(argNodes[0]);
        return new Val(R.MethodCall(v.e, 'slice', [argNodes[1] ? this.coerce(this.expr(argNodes[1]), 'int64') : R.Lit('0i64'), argNodes[2] ? this.coerce(this.expr(argNodes[2]), 'int64') : R.Ident('JS_NO_END')]), canonicalType(v.t));
      }
    }
  };

  /** The crate attributes and imports every generated program starts with. */
  const RUST_HEADER = `// Generated Rust code (the JavaScript runtime first, the transpiled algorithm after it)
#![allow(unused, non_snake_case, non_camel_case_types, non_upper_case_globals, unused_parens, unused_mut, unused_variables,
         unused_assignments, unreachable_code, dead_code, unused_labels, unused_braces, irrefutable_let_patterns,
         clippy::all)]
`;

  // The JavaScript runtime the generated code calls: exceptions, dynamic values (JsAny/JsObj),
  // shared arrays (JsArr), objects and Maps, the algorithm registry, numbers, strings, bytes,
  // BigInt (JsBig, arbitrary precision, no external crate) and the OpCodes helpers
  const RUST_RUNTIME = String.raw`// ===== JavaScript runtime for transpiled code =====
#[allow(unused_imports)]
use std::any::Any;
#[allow(unused_imports)]
use std::cell::{Cell, Ref, RefCell, RefMut};
#[allow(unused_imports)]
use std::collections::HashMap;
#[allow(unused_imports)]
use std::rc::Rc;

// ----- exceptions: a throw is a panic carrying a marker; the value waits in JS_THROWN

thread_local! {
    static JS_THROWN: RefCell<Option<JsAny>> = RefCell::new(None);
}

/// The panic payload of a JavaScript throw (the thrown value is in JS_THROWN).
pub struct JsThrowMarker;

/// throw value
pub fn js_throw(v: JsAny) -> ! {
    JS_THROWN.with(|t| *t.borrow_mut() = Some(v));
    std::panic::panic_any(JsThrowMarker)
}

pub fn js_throw_error(name: &str, message: &str) -> ! {
    js_throw(JsAny::new(JsError::new(name, message)))
}

/// What a catch clause receives: the thrown value, or a TypeError for a fault
/// of the Rust runtime (an index out of range, a null access).
pub fn js_caught(payload: Box<dyn Any + Send>) -> JsAny {
    if payload.is::<JsThrowMarker>() {
        return JS_THROWN.with(|t| t.borrow_mut().take()).unwrap_or(JsAny::undefined());
    }
    let msg = if let Some(s) = payload.downcast_ref::<&str>() {
        s.to_string()
    } else if let Some(s) = payload.downcast_ref::<String>() {
        s.clone()
    } else {
        "panic".to_string()
    };
    JsAny::new(JsError::new("TypeError", &msg))
}

/// try { body } catch (e) { handler(e) }
pub fn js_try<R>(body: impl FnOnce() -> R, handler: impl FnOnce(JsAny) -> R) -> R {
    match std::panic::catch_unwind(std::panic::AssertUnwindSafe(body)) {
        Ok(r) => r,
        Err(p) => handler(js_caught(p)),
    }
}

pub fn js_unsupported<T>(what: &str) -> T {
    js_throw_error("Error", &format!("not transpiled: {}", what))
}

/// How a try body ended: normally, by a return, or by a jump (break/continue) out of it
pub enum JsFlow<R> {
    Normal,
    Return(R),
    Jump(usize),
}

/// A local variable shared with the closures that capture it
pub struct JsCell<T>(Rc<RefCell<T>>);
impl<T> Clone for JsCell<T> {
    fn clone(&self) -> Self { JsCell(self.0.clone()) }
}
impl<T: Clone> JsCell<T> {
    pub fn new(v: T) -> Self { JsCell(Rc::new(RefCell::new(v))) }
    pub fn get(&self) -> T { self.0.borrow().clone() }
    pub fn set(&self, v: T) { *self.0.borrow_mut() = v; }
}

/// BigInt shifts of 64-bit values: a count past the width gives 0, not a masked count
pub fn js_shl64(x: u64, n: i64) -> u64 { if n < 0 { js_shr64(x, -n) } else if n >= 64 { 0 } else { x << n } }
pub fn js_shr64(x: u64, n: i64) -> u64 { if n < 0 { js_shl64(x, -n) } else if n >= 64 { 0 } else { x >> n } }

// ----- JsError

#[derive(Clone, Default)]
pub struct JsError {
    pub name: String,
    pub message: String,
}

impl JsError {
    pub fn new(name: &str, message: &str) -> JsError {
        JsError { name: name.to_string(), message: message.to_string() }
    }
    pub fn to_js_string(&self) -> String {
        if self.name.is_empty() { self.message.clone() } else { format!("{}: {}", self.name, self.message) }
    }
}

// ----- dynamic values

/// The members every dynamic JavaScript value answers.
pub trait JsDyn: 'static {
    fn as_any(&self) -> &dyn Any;
    fn type_of(&self) -> &'static str { "object" }
    fn num(&self) -> Option<f64> { None }
    fn int(&self) -> Option<i64> { None }
    fn list(&self) -> Option<Vec<JsAny>> { None }
    fn text(&self) -> String { format!("[object {}]", "Object") }
    fn obj(&self) -> Option<JsObj> { None }
    fn big(&self) -> Option<JsBig> { None }
    fn truthy(&self) -> bool { true }
    fn ident(&self) -> usize { self as *const Self as *const u8 as usize }
    fn call(&self, _args: Vec<JsAny>) -> JsAny { js_throw_error("TypeError", "value is not a function") }
    fn is_func(&self) -> bool { false }
}

/// A JavaScript value of any type; undefined and null are None.
#[derive(Clone, Default)]
pub struct JsAny(pub Option<Rc<dyn JsDyn>>);

impl JsAny {
    pub fn new<T: JsDyn>(v: T) -> JsAny { JsAny(Some(Rc::new(v))) }
    pub fn undefined() -> JsAny { JsAny(None) }
    pub fn is_null(&self) -> bool {
        match &self.0 {
            None => true,
            Some(v) => v.obj().map(|o| o.is_null()).unwrap_or(false),
        }
    }
    pub fn downcast<T: Clone + 'static>(&self) -> Option<T> {
        self.0.as_ref().and_then(|v| v.as_any().downcast_ref::<T>().cloned())
    }
    pub fn num(&self) -> f64 {
        match &self.0 {
            None => 0.0,
            Some(v) => v.num().unwrap_or(f64::NAN),
        }
    }
    pub fn text(&self) -> String {
        match &self.0 {
            None => "undefined".to_string(),
            Some(v) => v.text(),
        }
    }
    pub fn truthy(&self) -> bool { self.0.as_ref().map(|v| v.truthy()).unwrap_or(false) }
    pub fn list(&self) -> Option<Vec<JsAny>> { self.0.as_ref().and_then(|v| v.list()) }
    pub fn obj(&self) -> JsObj { self.0.as_ref().and_then(|v| v.obj()).unwrap_or_default() }
    pub fn type_of(&self) -> &'static str { self.0.as_ref().map(|v| v.type_of()).unwrap_or("undefined") }
    pub fn is_func(&self) -> bool { self.0.as_ref().map(|v| v.is_func()).unwrap_or(false) }
    pub fn call(&self, args: Vec<JsAny>) -> JsAny {
        match &self.0 {
            None => js_throw_error("TypeError", "undefined is not a function"),
            Some(v) => v.call(args),
        }
    }
}

/// A value as a JsAny.
pub trait ToJs {
    fn to_js(&self) -> JsAny;
}

/// A value from a JsAny, with JavaScript's conversions.
pub trait FromJs: Sized {
    fn from_js(v: &JsAny) -> Self;
}

pub fn js_to<T: FromJs>(v: &JsAny) -> T { T::from_js(v) }

impl ToJs for JsAny {
    fn to_js(&self) -> JsAny { self.clone() }
}
impl FromJs for JsAny {
    fn from_js(v: &JsAny) -> JsAny { v.clone() }
}

macro_rules! js_number_type {
    ($t:ty, $signed:expr) => {
        impl JsDyn for $t {
            fn as_any(&self) -> &dyn Any { self }
            fn type_of(&self) -> &'static str { "number" }
            fn num(&self) -> Option<f64> { Some(*self as f64) }
            fn int(&self) -> Option<i64> { Some(*self as i64) }
            fn text(&self) -> String { js_num_to_string(*self as f64, 10) }
            fn truthy(&self) -> bool { *self != (0 as $t) }
        }
        impl ToJs for $t {
            fn to_js(&self) -> JsAny { JsAny::new(*self) }
        }
        impl FromJs for $t {
            fn from_js(v: &JsAny) -> $t {
                match &v.0 {
                    None => 0 as $t,
                    Some(d) => match d.int() {
                        Some(i) => i as $t,
                        None => js_f2i(d.num().unwrap_or(0.0)) as $t,
                    },
                }
            }
        }
    };
}
js_number_type!(u8, false);
js_number_type!(u16, false);
js_number_type!(u32, false);
js_number_type!(u64, false);
js_number_type!(i8, true);
js_number_type!(i16, true);
js_number_type!(i32, true);
js_number_type!(i64, true);
js_number_type!(usize, false);

impl JsDyn for f64 {
    fn as_any(&self) -> &dyn Any { self }
    fn type_of(&self) -> &'static str { "number" }
    fn num(&self) -> Option<f64> { Some(*self) }
    fn int(&self) -> Option<i64> { if self.is_finite() && self.fract() == 0.0 && self.abs() < 9.2e18 { Some(*self as i64) } else { None } }
    fn text(&self) -> String { js_num_to_string(*self, 10) }
    fn truthy(&self) -> bool { *self != 0.0 && !self.is_nan() }
}
impl ToJs for f64 {
    fn to_js(&self) -> JsAny { JsAny::new(*self) }
}
impl FromJs for f64 {
    fn from_js(v: &JsAny) -> f64 {
        match &v.0 {
            None => 0.0,
            Some(d) => d.num().unwrap_or_else(|| js_to_number(&d.text())),
        }
    }
}

impl JsDyn for bool {
    fn as_any(&self) -> &dyn Any { self }
    fn type_of(&self) -> &'static str { "boolean" }
    fn num(&self) -> Option<f64> { Some(if *self { 1.0 } else { 0.0 }) }
    fn int(&self) -> Option<i64> { Some(if *self { 1 } else { 0 }) }
    fn text(&self) -> String { if *self { "true".to_string() } else { "false".to_string() } }
    fn truthy(&self) -> bool { *self }
}
impl ToJs for bool {
    fn to_js(&self) -> JsAny { JsAny::new(*self) }
}
impl FromJs for bool {
    fn from_js(v: &JsAny) -> bool { v.truthy() }
}

impl JsDyn for String {
    fn as_any(&self) -> &dyn Any { self }
    fn type_of(&self) -> &'static str { "string" }
    fn num(&self) -> Option<f64> { Some(js_to_number(self)) }
    fn text(&self) -> String { self.clone() }
    fn truthy(&self) -> bool { !self.is_empty() }
    fn list(&self) -> Option<Vec<JsAny>> { Some(self.chars().map(|c| JsAny::new(c.to_string())).collect()) }
}
impl ToJs for String {
    fn to_js(&self) -> JsAny { JsAny::new(self.clone()) }
}
impl FromJs for String {
    fn from_js(v: &JsAny) -> String {
        match &v.0 {
            None => String::new(),
            Some(d) => d.text(),
        }
    }
}

impl JsDyn for JsError {
    fn as_any(&self) -> &dyn Any { self }
    fn text(&self) -> String { self.to_js_string() }
    fn obj(&self) -> Option<JsObj> { Some(JsObj::new(JsErrorObject(self.clone()))) }
}
impl ToJs for JsError {
    fn to_js(&self) -> JsAny { JsAny::new(self.clone()) }
}
impl FromJs for JsError {
    fn from_js(v: &JsAny) -> JsError {
        v.downcast::<JsError>().unwrap_or_else(|| JsError::new("", &v.text()))
    }
}

/// The error as an object (message, name)
#[derive(Clone)]
pub struct JsErrorObject(pub JsError);
impl JsObject for JsErrorObject {
    fn as_any(&self) -> &dyn Any { self }
    fn js_get(&self, name: &str) -> JsAny {
        match name {
            "message" => self.0.message.to_js(),
            "name" => self.0.name.to_js(),
            _ => JsAny::undefined(),
        }
    }
    fn js_set(&self, _name: &str, _value: JsAny) {}
    fn js_call(&self, name: &str, _args: Vec<JsAny>) -> JsAny {
        if name == "toString" { return self.0.to_js_string().to_js(); }
        js_throw_error("TypeError", &format!("Error.{} is not a function", name))
    }
    fn js_has(&self, name: &str) -> bool { name == "message" || name == "name" }
    fn js_has_method(&self, name: &str) -> bool { name == "toString" }
}

/// A function value
pub struct JsFunc(pub Rc<dyn Fn(Vec<JsAny>) -> JsAny>);
impl JsDyn for JsFunc {
    fn as_any(&self) -> &dyn Any { self }
    fn type_of(&self) -> &'static str { "function" }
    fn text(&self) -> String { "function".to_string() }
    fn call(&self, args: Vec<JsAny>) -> JsAny { (self.0)(args) }
    fn is_func(&self) -> bool { true }
}
pub fn js_func(f: impl Fn(Vec<JsAny>) -> JsAny + 'static) -> JsAny { JsAny::new(JsFunc(Rc::new(f))) }
pub fn js_arg(args: &[JsAny], i: usize) -> JsAny { args.get(i).cloned().unwrap_or_default() }
pub fn js_arg_or(args: &[JsAny], i: usize, d: JsAny) -> JsAny {
    match args.get(i) {
        Some(v) if v.0.is_some() => v.clone(),
        _ => d,
    }
}

// ----- arrays: shared, growable, null-able (JavaScript arrays are references)

pub struct JsArr<T>(pub Option<Rc<RefCell<Vec<T>>>>);

impl<T> Clone for JsArr<T> {
    fn clone(&self) -> Self { JsArr(self.0.clone()) }
}
impl<T> Default for JsArr<T> {
    fn default() -> Self { JsArr(None) }
}

impl<T: Clone + Default + 'static> JsArr<T> {
    pub fn new() -> Self { JsArr(Some(Rc::new(RefCell::new(Vec::new())))) }
    pub fn from_vec(v: Vec<T>) -> Self { JsArr(Some(Rc::new(RefCell::new(v)))) }
    pub fn with_len(n: usize) -> Self { JsArr::from_vec(vec![T::default(); n]) }
    pub fn filled(n: usize, v: T) -> Self { JsArr::from_vec(vec![v; n]) }
    pub fn null() -> Self { JsArr(None) }
    pub fn is_null(&self) -> bool { self.0.is_none() }
    fn rc(&self) -> &Rc<RefCell<Vec<T>>> {
        match &self.0 {
            Some(r) => r,
            None => js_throw_error("TypeError", "Cannot read properties of null (an array)"),
        }
    }
    pub fn len(&self) -> usize { self.rc().borrow().len() }
    pub fn get(&self, i: usize) -> T {
        let r = self.rc().borrow();
        if i < r.len() { r[i].clone() } else { T::default() }
    }
    pub fn set(&self, i: usize, v: T) {
        let mut r = self.rc().borrow_mut();
        if i < r.len() {
            r[i] = v;
        } else {
            while r.len() < i { r.push(T::default()); }
            r.push(v);
        }
    }
    pub fn push(&self, v: T) -> usize {
        let mut r = self.rc().borrow_mut();
        r.push(v);
        r.len()
    }
    pub fn push_all(&self, v: &JsArr<T>) -> usize {
        let items = v.to_vec();
        let mut r = self.rc().borrow_mut();
        r.extend(items);
        r.len()
    }
    pub fn pop(&self) -> T { self.rc().borrow_mut().pop().unwrap_or_default() }
    pub fn shift(&self) -> T {
        let mut r = self.rc().borrow_mut();
        if r.is_empty() { T::default() } else { r.remove(0) }
    }
    pub fn unshift(&self, items: Vec<T>) -> usize {
        let mut r = self.rc().borrow_mut();
        for (k, it) in items.into_iter().enumerate() { r.insert(k, it); }
        r.len()
    }
    pub fn to_vec(&self) -> Vec<T> { self.rc().borrow().clone() }
    pub fn set_len(&self, n: usize) {
        let mut r = self.rc().borrow_mut();
        r.resize(n, T::default());
    }
    pub fn slice(&self, start: i64, end: i64) -> JsArr<T> {
        let r = self.rc().borrow();
        let (a, b) = js_range(r.len(), start, end);
        JsArr::from_vec(if a < b { r[a..b].to_vec() } else { Vec::new() })
    }
    pub fn copy(&self) -> JsArr<T> {
        if self.is_null() { return JsArr::null(); }
        JsArr::from_vec(self.to_vec())
    }
    pub fn concat(&self, others: &[JsArr<T>]) -> JsArr<T> {
        let mut v = self.to_vec();
        for o in others { v.extend(o.to_vec()); }
        JsArr::from_vec(v)
    }
    pub fn fill(&self, v: T, start: i64, end: i64) -> JsArr<T> {
        {
            let mut r = self.rc().borrow_mut();
            let (a, b) = js_range(r.len(), start, end);
            for i in a..b { r[i] = v.clone(); }
        }
        self.clone()
    }
    pub fn reverse(&self) -> JsArr<T> {
        self.rc().borrow_mut().reverse();
        self.clone()
    }
    pub fn splice(&self, start: i64, delete: i64, items: Vec<T>) -> JsArr<T> {
        let mut r = self.rc().borrow_mut();
        let n = r.len();
        let a = js_index(n, start);
        let d = if delete == JS_NO_END { n - a } else { (delete.max(0) as usize).min(n - a) };
        let removed: Vec<T> = r.splice(a..a + d, items).collect();
        JsArr::from_vec(removed)
    }
    /// A view sharing nothing (Rust cannot alias part of a Vec): a copy of the range
    pub fn subarray(&self, start: i64, end: i64) -> JsArr<T> { self.slice(start, end) }
    pub fn set_from(&self, src: &JsArr<T>, offset: usize) {
        let items = src.to_vec();
        let mut r = self.rc().borrow_mut();
        if offset + items.len() > r.len() { drop(r); js_throw_error("RangeError", "offset is out of bounds"); }
        for (k, it) in items.into_iter().enumerate() { r[offset + k] = it; }
    }
    pub fn ptr_eq(&self, other: &JsArr<T>) -> bool {
        match (&self.0, &other.0) {
            (Some(a), Some(b)) => Rc::ptr_eq(a, b),
            (None, None) => true,
            _ => false,
        }
    }
    pub fn clear_values(&self) {
        let mut r = self.rc().borrow_mut();
        for x in r.iter_mut() { *x = T::default(); }
    }
    pub fn map<U: Clone + Default + 'static>(&self, f: impl Fn(T, i32) -> U) -> JsArr<U> {
        let v = self.to_vec();
        JsArr::from_vec(v.into_iter().enumerate().map(|(i, x)| f(x, i as i32)).collect())
    }
    pub fn filter(&self, f: impl Fn(T, i32) -> bool) -> JsArr<T> {
        let v = self.to_vec();
        JsArr::from_vec(v.into_iter().enumerate().filter(|(i, x)| f(x.clone(), *i as i32)).map(|(_, x)| x).collect())
    }
    pub fn for_each(&self, f: impl Fn(T, i32)) {
        let v = self.to_vec();
        for (i, x) in v.into_iter().enumerate() { f(x, i as i32); }
    }
    pub fn some(&self, f: impl Fn(T, i32) -> bool) -> bool {
        let v = self.to_vec();
        v.into_iter().enumerate().any(|(i, x)| f(x, i as i32))
    }
    pub fn every(&self, f: impl Fn(T, i32) -> bool) -> bool {
        let v = self.to_vec();
        v.into_iter().enumerate().all(|(i, x)| f(x, i as i32))
    }
    pub fn find(&self, f: impl Fn(T, i32) -> bool) -> T {
        let v = self.to_vec();
        v.into_iter().enumerate().find(|(i, x)| f(x.clone(), *i as i32)).map(|(_, x)| x).unwrap_or_default()
    }
    pub fn find_index(&self, f: impl Fn(T, i32) -> bool) -> i32 {
        let v = self.to_vec();
        v.into_iter().enumerate().position(|(i, x)| f(x, i as i32)).map(|p| p as i32).unwrap_or(-1)
    }
    pub fn reduce<R>(&self, f: impl Fn(R, T, i32) -> R, init: R) -> R {
        let v = self.to_vec();
        let mut acc = init;
        for (i, x) in v.into_iter().enumerate() { acc = f(acc, x, i as i32); }
        acc
    }
    pub fn sort_by(&self, f: impl Fn(T, T) -> f64) -> JsArr<T> {
        let mut v = self.to_vec();
        v.sort_by(|a, b| {
            let c = f(a.clone(), b.clone());
            if c < 0.0 { std::cmp::Ordering::Less } else if c > 0.0 { std::cmp::Ordering::Greater } else { std::cmp::Ordering::Equal }
        });
        *self.rc().borrow_mut() = v;
        self.clone()
    }
}

impl<T: Clone + Default + ToJs + 'static> JsArr<T> {
    pub fn index_of(&self, v: &T, from: i64) -> i32 {
        let items = self.to_vec();
        let start = if from < 0 { (items.len() as i64 + from).max(0) as usize } else { from as usize };
        let target = v.to_js();
        for i in start..items.len() {
            if js_strict_equals(&items[i].to_js(), &target) { return i as i32; }
        }
        -1
    }
    pub fn join(&self, sep: &str) -> String {
        self.to_vec().iter().map(|x| { let a = x.to_js(); if a.is_null() { String::new() } else { a.text() } }).collect::<Vec<_>>().join(sep)
    }
    pub fn sort_default(&self) -> JsArr<T> {
        let mut v = self.to_vec();
        v.sort_by(|a, b| a.to_js().text().cmp(&b.to_js().text()));
        *self.rc().borrow_mut() = v;
        self.clone()
    }
}

impl<T: Clone + Default + ToJs + 'static> JsDyn for JsArr<T> {
    fn as_any(&self) -> &dyn Any { self }
    fn list(&self) -> Option<Vec<JsAny>> { if self.is_null() { None } else { Some(self.to_vec().iter().map(|x| x.to_js()).collect()) } }
    fn text(&self) -> String { self.join(",") }
    fn truthy(&self) -> bool { !self.is_null() }
    fn ident(&self) -> usize { self.0.as_ref().map(|r| Rc::as_ptr(r) as *const u8 as usize).unwrap_or(0) }
}
impl<T: Clone + Default + ToJs + 'static> ToJs for JsArr<T> {
    fn to_js(&self) -> JsAny { if self.is_null() { JsAny::undefined() } else { JsAny::new(self.clone()) } }
}
impl<T: Clone + Default + ToJs + FromJs + 'static> FromJs for JsArr<T> {
    fn from_js(v: &JsAny) -> JsArr<T> {
        if let Some(a) = v.downcast::<JsArr<T>>() { return a; }
        match v.list() {
            Some(items) => JsArr::from_vec(items.iter().map(|x| T::from_js(x)).collect()),
            None => JsArr::null(),
        }
    }
}

/// An array of another element type, converted element by element
pub fn js_arr_conv<A: Clone + Default + ToJs + 'static, B: Clone + Default + FromJs + 'static>(a: &JsArr<A>) -> JsArr<B> {
    if a.is_null() { return JsArr::null(); }
    JsArr::from_vec(a.to_vec().iter().map(|x| B::from_js(&x.to_js())).collect())
}

pub const JS_NO_END: i64 = i64::MAX;

pub fn js_index(n: usize, i: i64) -> usize {
    if i < 0 { (n as i64 + i).max(0) as usize } else { (i as usize).min(n) }
}

pub fn js_range(n: usize, start: i64, end: i64) -> (usize, usize) {
    let a = js_index(n, start);
    let b = if end == JS_NO_END { n } else { js_index(n, end) };
    (a, b)
}

pub fn js_arr<T: Clone + Default + 'static>(v: Vec<T>) -> JsArr<T> { JsArr::from_vec(v) }

pub fn js_concat<T: Clone + Default + 'static>(parts: Vec<JsArr<T>>) -> JsArr<T> {
    let mut v = Vec::new();
    for p in parts { v.extend(p.to_vec()); }
    JsArr::from_vec(v)
}

// ----- objects: members by name

pub trait JsObject: 'static {
    fn as_any(&self) -> &dyn Any;
    fn js_get(&self, name: &str) -> JsAny;
    fn js_set(&self, name: &str, value: JsAny);
    fn js_call(&self, name: &str, args: Vec<JsAny>) -> JsAny;
    fn js_has(&self, name: &str) -> bool;
    fn js_has_method(&self, name: &str) -> bool;
    fn js_ident(&self) -> usize { self as *const Self as *const u8 as usize }
    fn js_is_null(&self) -> bool { false }
    fn js_keys(&self) -> Vec<String> { Vec::new() }
}

/// Any JavaScript object (or null).
#[derive(Clone, Default)]
pub struct JsObj(pub Option<Rc<dyn JsObject>>);

impl JsObj {
    pub fn new<T: JsObject>(o: T) -> JsObj { JsObj(Some(Rc::new(o))) }
    pub fn null() -> JsObj { JsObj(None) }
    pub fn is_null(&self) -> bool { self.0.as_ref().map(|o| o.js_is_null()).unwrap_or(true) }
    fn o(&self) -> &Rc<dyn JsObject> {
        match &self.0 {
            Some(o) => o,
            None => js_throw_error("TypeError", "Cannot read properties of null"),
        }
    }
    pub fn get(&self, name: &str) -> JsAny { self.o().js_get(name) }
    pub fn set(&self, name: &str, v: JsAny) { self.o().js_set(name, v) }
    pub fn call(&self, name: &str, args: Vec<JsAny>) -> JsAny { self.o().js_call(name, args) }
    pub fn has(&self, name: &str) -> bool { self.0.as_ref().map(|o| o.js_has(name)).unwrap_or(false) }
    pub fn has_method(&self, name: &str) -> bool { self.0.as_ref().map(|o| o.js_has_method(name)).unwrap_or(false) }
    pub fn downcast<T: Clone + 'static>(&self) -> Option<T> { self.0.as_ref().and_then(|o| o.as_any().downcast_ref::<T>().cloned()) }
    pub fn ident(&self) -> usize { self.0.as_ref().map(|o| o.js_ident()).unwrap_or(0) }
    pub fn keys(&self) -> Vec<String> { self.0.as_ref().map(|o| o.js_keys()).unwrap_or_default() }
}

impl JsDyn for JsObj {
    fn as_any(&self) -> &dyn Any { self }
    fn obj(&self) -> Option<JsObj> { Some(self.clone()) }
    fn truthy(&self) -> bool { !self.is_null() }
    fn ident(&self) -> usize { JsObj::ident(self) }
    fn text(&self) -> String {
        if let Some(e) = self.downcast::<JsErrorObject>() { return e.0.to_js_string(); }
        format!("[object {}]", "Object")
    }
}
impl ToJs for JsObj {
    fn to_js(&self) -> JsAny { if self.0.is_none() { JsAny::undefined() } else { JsAny::new(self.clone()) } }
}
impl FromJs for JsObj {
    fn from_js(v: &JsAny) -> JsObj { v.obj() }
}

/// A JavaScript object literal (string keys) or Map (any keys), in insertion order
#[derive(Clone, Default)]
pub struct JsMap(pub Rc<RefCell<JsMapData>>);

#[derive(Default)]
pub struct JsMapData {
    keys: Vec<(String, JsAny)>,
    vals: HashMap<String, JsAny>,
}

/// The identity of a Map key: numbers by value, strings by content, objects by reference
fn js_map_key(k: &JsAny) -> String {
    match &k.0 {
        None => "u:".to_string(),
        Some(d) => match d.type_of() {
            "number" => format!("n:{}", d.num().unwrap_or(f64::NAN)),
            "string" => format!("s:{}", d.text()),
            "boolean" => format!("b:{}", d.text()),
            _ => format!("o:{}", d.ident()),
        },
    }
}

impl JsMap {
    pub fn new() -> JsMap { JsMap::default() }
    pub fn of(kv: Vec<(&str, JsAny)>) -> JsMap {
        let m = JsMap::new();
        for (k, v) in kv { m.js_set(k, v); }
        m
    }
    pub fn map_get(&self, k: &JsAny) -> JsAny { self.0.borrow().vals.get(&js_map_key(k)).cloned().unwrap_or_default() }
    pub fn map_set(&self, k: JsAny, v: JsAny) -> JsMap {
        let key = js_map_key(&k);
        let mut d = self.0.borrow_mut();
        if !d.vals.contains_key(&key) { d.keys.push((key.clone(), k)); }
        d.vals.insert(key, v);
        drop(d);
        self.clone()
    }
    pub fn map_has(&self, k: &JsAny) -> bool { self.0.borrow().vals.contains_key(&js_map_key(k)) }
    pub fn map_delete(&self, k: &JsAny) -> bool {
        let key = js_map_key(k);
        let mut d = self.0.borrow_mut();
        if d.vals.remove(&key).is_none() { return false; }
        d.keys.retain(|(x, _)| *x != key);
        true
    }
    pub fn map_clear(&self) { let mut d = self.0.borrow_mut(); d.keys.clear(); d.vals.clear(); }
    pub fn map_keys(&self) -> JsArr<JsAny> { JsArr::from_vec(self.0.borrow().keys.iter().map(|(_, k)| k.clone()).collect()) }
    pub fn map_values(&self) -> JsArr<JsAny> {
        let d = self.0.borrow();
        JsArr::from_vec(d.keys.iter().map(|(k, _)| d.vals.get(k).cloned().unwrap_or_default()).collect())
    }
    pub fn size(&self) -> i32 { self.0.borrow().keys.len() as i32 }
}

impl JsObject for JsMap {
    fn as_any(&self) -> &dyn Any { self }
    fn js_get(&self, name: &str) -> JsAny {
        let v = self.0.borrow().vals.get(&format!("s:{}", name)).cloned();
        match v {
            Some(v) => v,
            None if name == "size" => self.size().to_js(),
            None => JsAny::undefined(),
        }
    }
    fn js_set(&self, name: &str, value: JsAny) { self.map_set(name.to_string().to_js(), value); }
    fn js_call(&self, name: &str, args: Vec<JsAny>) -> JsAny {
        let f = self.js_get(name);
        if f.is_func() { return f.call(args); }
        match name {
            "get" => self.map_get(&js_arg(&args, 0)),
            "set" => { self.map_set(js_arg(&args, 0), js_arg(&args, 1)); JsAny::new(JsObj::new(self.clone())) }
            "has" | "hasOwnProperty" => self.map_has(&js_arg(&args, 0)).to_js(),
            "delete" => self.map_delete(&js_arg(&args, 0)).to_js(),
            _ => js_throw_error("TypeError", &format!("object.{} is not a function", name)),
        }
    }
    fn js_has(&self, name: &str) -> bool { self.0.borrow().vals.contains_key(&format!("s:{}", name)) }
    fn js_has_method(&self, name: &str) -> bool { self.js_get(name).is_func() }
    fn js_ident(&self) -> usize { Rc::as_ptr(&self.0) as *const u8 as usize }
    fn js_keys(&self) -> Vec<String> { self.0.borrow().keys.iter().map(|(_, k)| k.text()).collect() }
}

pub fn js_obj_of(kv: Vec<(&str, JsAny)>) -> JsObj { JsObj::new(JsMap::of(kv)) }
pub fn js_map_new() -> JsMap { JsMap::new() }

// ----- the algorithm registry

thread_local! {
    pub static JS_ALGORITHMS: RefCell<Vec<JsObj>> = RefCell::new(Vec::new());
}

pub fn js_register_algorithm(a: JsObj) {
    if a.is_null() { js_throw_error("Error", "RegisterAlgorithm: Invalid algorithm object"); }
    JS_ALGORITHMS.with(|r| r.borrow_mut().push(a));
}

pub fn js_find_algorithm(name: &str) -> JsObj {
    let all = JS_ALGORITHMS.with(|r| r.borrow().clone());
    for a in all.iter().rev() {
        if a.get("name").text() == name { return a.clone(); }
    }
    JsObj::null()
}

// ----- numbers

/// A float truncated and wrapped to 64 bits, as ToInt32/ToUint32 do before narrowing.
pub fn js_f2i(f: f64) -> i64 {
    if !f.is_finite() { return 0; }
    let t = f.trunc();
    if t >= -9.223372036854775e18 && t < 9.223372036854775e18 { return t as i64; }
    let m = t.rem_euclid(18446744073709551616.0);
    (m as u64) as i64
}

pub fn js_b2i(b: bool) -> i64 { if b { 1 } else { 0 } }

pub fn js_truthy_f64(f: f64) -> bool { f != 0.0 && !f.is_nan() }

pub fn js_to_number(s: &str) -> f64 {
    let t = s.trim();
    if t.is_empty() { return 0.0; }
    if let Some(h) = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")) {
        return u64::from_str_radix(h, 16).map(|v| v as f64).unwrap_or(f64::NAN);
    }
    match t {
        "Infinity" | "+Infinity" => return f64::INFINITY,
        "-Infinity" => return f64::NEG_INFINITY,
        _ => {}
    }
    t.parse::<f64>().unwrap_or(f64::NAN)
}

pub fn js_parse_int(s: &str, radix: i64) -> f64 {
    let mut t = s.trim();
    let mut neg = false;
    if let Some(r) = t.strip_prefix('-') { neg = true; t = r; } else if let Some(r) = t.strip_prefix('+') { t = r; }
    let radix = if radix == 0 { 10 } else { radix as u32 };
    if radix == 16 { if let Some(r) = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")) { t = r; } }
    let mut r = 0.0f64;
    let mut any = false;
    for c in t.chars() {
        match c.to_digit(radix) {
            Some(d) => { r = r * radix as f64 + d as f64; any = true; }
            None => break,
        }
    }
    if !any { return f64::NAN; }
    if neg { -r } else { r }
}

pub fn js_num_to_string(f: f64, radix: i64) -> String {
    if f.is_nan() { return "NaN".to_string(); }
    if f.is_infinite() { return if f > 0.0 { "Infinity".to_string() } else { "-Infinity".to_string() }; }
    if radix != 10 && f.fract() == 0.0 {
        let neg = f < 0.0;
        let mut v = f.abs() as u128;
        if v == 0 { return "0".to_string(); }
        let mut digits = Vec::new();
        while v > 0 { digits.push(std::char::from_digit((v % radix as u128) as u32, radix as u32).unwrap()); v /= radix as u128; }
        if neg { digits.push('-'); }
        return digits.iter().rev().collect();
    }
    if f.fract() == 0.0 && f.abs() < 1e21 { return format!("{}", f as i128); }
    let s = format!("{:e}", f);
    if f.abs() >= 1e21 || f.abs() < 1e-6 {
        // JavaScript: 1e+21, 1.5e-7
        let (m, e) = s.split_once('e').unwrap();
        return if e.starts_with('-') { format!("{}e{}", m, e) } else { format!("{}e+{}", m, e) };
    }
    format!("{}", f)
}

pub fn js_to_fixed(f: f64, digits: i64) -> String { format!("{:.*}", digits.max(0) as usize, f) }
pub fn js_round(f: f64) -> f64 { (f + 0.5).floor() }
pub fn js_sign(f: f64) -> f64 { if f > 0.0 { 1.0 } else if f < 0.0 { -1.0 } else { f } }
pub fn js_min_f(xs: &[f64]) -> f64 {
    let mut r = f64::INFINITY;
    for &x in xs { if x.is_nan() { return x; } if x < r { r = x; } }
    r
}
pub fn js_max_f(xs: &[f64]) -> f64 {
    let mut r = f64::NEG_INFINITY;
    for &x in xs { if x.is_nan() { return x; } if x > r { r = x; } }
    r
}
pub fn js_is_integer(v: &JsAny) -> bool {
    match &v.0 { Some(d) if d.type_of() == "number" => { let f = d.num().unwrap_or(f64::NAN); f.is_finite() && f.fract() == 0.0 } _ => false }
}

thread_local! {
    static JS_RAND: Cell<u64> = Cell::new(0x9E3779B97F4A7C15);
}
pub fn js_random() -> f64 {
    JS_RAND.with(|s| {
        let mut x = s.get();
        x ^= x << 13; x ^= x >> 7; x ^= x << 17;
        s.set(x);
        (x >> 11) as f64 / 9007199254740992.0
    })
}

// ----- equality, truthiness, typeof

pub fn js_strict_equals(a: &JsAny, b: &JsAny) -> bool {
    match (&a.0, &b.0) {
        (None, None) => true,
        (None, Some(_)) | (Some(_), None) => a.is_null() && b.is_null(),
        (Some(x), Some(y)) => {
            let (tx, ty) = (x.type_of(), y.type_of());
            if tx != ty { return false; }
            match tx {
                "number" => x.num() == y.num(),
                "string" | "boolean" => x.text() == y.text(),
                "bigint" => x.big().map(|p| p.cmp(&y.big().unwrap()) == 0).unwrap_or(false),
                _ => x.ident() == y.ident(),
            }
        }
    }
}

pub fn js_loose_equals(a: &JsAny, b: &JsAny) -> bool {
    if a.is_null() || b.is_null() { return a.is_null() && b.is_null(); }
    if js_strict_equals(a, b) { return true; }
    let prim = |t: &str| t == "number" || t == "string" || t == "boolean";
    if prim(a.type_of()) && prim(b.type_of()) { return a.num() == b.num(); }
    false
}

pub fn js_type_of(v: &JsAny) -> String { v.type_of().to_string() }

pub fn js_is_array(v: &JsAny) -> bool { v.type_of() == "object" && v.list().is_some() }

pub fn js_keys(v: &JsAny) -> JsArr<String> {
    if let Some(items) = v.list() { return JsArr::from_vec((0..items.len()).map(|i| i.to_string()).collect()); }
    JsArr::from_vec(v.obj().keys())
}

pub fn js_get_prop(v: &JsAny, name: &str) -> JsAny {
    if let Some(items) = v.list() {
        if name == "length" { return (items.len() as i32).to_js(); }
        if let Ok(i) = name.parse::<usize>() { return items.get(i).cloned().unwrap_or_default(); }
        return JsAny::undefined();
    }
    v.obj().get(name)
}

pub fn js_in(key: &str, v: &JsAny) -> bool {
    if let Some(items) = v.list() { return key == "length" || key.parse::<usize>().map(|i| i < items.len()).unwrap_or(false); }
    v.obj().has(key)
}

pub fn js_length(v: &JsAny) -> i32 {
    if let Some(items) = v.list() { return items.len() as i32; }
    if v.type_of() == "string" { return v.text().chars().count() as i32; }
    i32::from_js(&v.obj().get("length"))
}

pub fn js_log(args: Vec<JsAny>) {
    eprintln!("{}", args.iter().map(|a| a.text()).collect::<Vec<_>>().join(" "));
}

// ----- strings (one char per JavaScript character code below 256)

pub fn js_str_len(s: &str) -> i32 { if s.is_ascii() { s.len() as i32 } else { s.chars().count() as i32 } }

pub fn js_char_code_at(s: &str, i: i64) -> i32 {
    if i < 0 { return 0; }
    if s.is_ascii() { return s.as_bytes().get(i as usize).map(|&b| b as i32).unwrap_or(0); }
    s.chars().nth(i as usize).map(|c| c as i32).unwrap_or(0)
}

pub fn js_char_at(s: &str, i: i64) -> String {
    if i < 0 { return String::new(); }
    s.chars().nth(i as usize).map(|c| c.to_string()).unwrap_or_default()
}

pub fn js_from_char_codes(codes: Vec<i32>) -> String {
    codes.iter().map(|&c| char::from_u32((c as u32) & 0xFFFF).unwrap_or('?')).collect()
}

fn js_chars(s: &str) -> Vec<char> { s.chars().collect() }

pub fn js_substring(s: &str, a: i64, b: i64) -> String {
    let c = js_chars(s);
    let n = c.len() as i64;
    let b = if b == JS_NO_END { n } else { b };
    let mut a = a.max(0).min(n);
    let mut b = b.max(0).min(n);
    if a > b { std::mem::swap(&mut a, &mut b); }
    c[a as usize..b as usize].iter().collect()
}

pub fn js_substr(s: &str, a: i64, len: i64) -> String {
    let c = js_chars(s);
    let n = c.len();
    let a = js_index(n, a);
    let l = if len == JS_NO_END || len < 0 { n - a } else { (len as usize).min(n - a) };
    c[a..a + l].iter().collect()
}

pub fn js_str_slice(s: &str, a: i64, b: i64) -> String {
    let c = js_chars(s);
    let (a, b) = js_range(c.len(), a, b);
    if a >= b { String::new() } else { c[a..b].iter().collect() }
}

pub fn js_str_index_of(s: &str, sub: &str, from: i64) -> i32 {
    let c = js_chars(s);
    let p = js_chars(sub);
    let start = from.max(0) as usize;
    if p.is_empty() { return start.min(c.len()) as i32; }
    if p.len() > c.len() { return -1; }
    for i in start..=(c.len() - p.len()) {
        if c[i..i + p.len()] == p[..] { return i as i32; }
    }
    -1
}

pub fn js_str_last_index_of(s: &str, sub: &str) -> i32 {
    let c = js_chars(s);
    let p = js_chars(sub);
    if p.len() > c.len() { return -1; }
    for i in (0..=(c.len() - p.len())).rev() {
        if c[i..i + p.len()] == p[..] { return i as i32; }
    }
    -1
}

pub fn js_to_upper(s: &str) -> String { s.chars().map(|c| if c.is_ascii_lowercase() { c.to_ascii_uppercase() } else { c }).collect() }
pub fn js_to_lower(s: &str) -> String { s.chars().map(|c| if c.is_ascii_uppercase() { c.to_ascii_lowercase() } else { c }).collect() }

pub fn js_split(s: &str, sep: &str) -> JsArr<String> {
    if sep.is_empty() { return JsArr::from_vec(s.chars().map(|c| c.to_string()).collect()); }
    JsArr::from_vec(s.split(sep).map(|x| x.to_string()).collect())
}

pub fn js_pad_start(s: &str, n: i64, pad: &str) -> String {
    let len = js_str_len(s) as i64;
    if len >= n || pad.is_empty() { return s.to_string(); }
    let need = (n - len) as usize;
    let p: String = pad.chars().cycle().take(need).collect();
    p + s
}

pub fn js_pad_end(s: &str, n: i64, pad: &str) -> String {
    let len = js_str_len(s) as i64;
    if len >= n || pad.is_empty() { return s.to_string(); }
    let need = (n - len) as usize;
    let p: String = pad.chars().cycle().take(need).collect();
    s.to_string() + &p
}

pub fn js_repeat(s: &str, n: i64) -> String { s.repeat(n.max(0) as usize) }

pub fn js_string_chars(s: &str) -> JsArr<String> { JsArr::from_vec(s.chars().map(|c| c.to_string()).collect()) }

// ----- bytes (OpCodes conversions)

pub fn js_hex8_to_bytes(s: &str) -> JsArr<u8> {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len() / 2);
    let mut i = 0;
    while i + 1 < b.len() {
        let h = (b[i] as char).to_digit(16);
        let l = (b[i + 1] as char).to_digit(16);
        match (h, l) {
            (Some(h), Some(l)) => out.push((h * 16 + l) as u8),
            _ => js_throw_error("Error", "Hex8ToBytes: Invalid hex characters found"),
        }
        i += 2;
    }
    JsArr::from_vec(out)
}

pub fn js_hex16_to_words(s: &str) -> JsArr<u16> {
    let mut out = Vec::new();
    let mut i = 0;
    while i + 4 <= s.len() { out.push(u16::from_str_radix(&s[i..i + 4], 16).unwrap_or(0)); i += 4; }
    JsArr::from_vec(out)
}

pub fn js_hex32_to_dwords(s: &str) -> JsArr<u32> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < s.len() { let e = (i + 8).min(s.len()); out.push(u32::from_str_radix(&s[i..e], 16).unwrap_or(0)); i += 8; }
    JsArr::from_vec(out)
}

pub fn js_ansi_to_bytes(s: &str) -> JsArr<u8> { JsArr::from_vec(s.chars().map(|c| (c as u32 & 0x7F) as u8).collect()) }
pub fn js_ascii_to_bytes(s: &str) -> JsArr<u8> { JsArr::from_vec(s.chars().map(|c| (c as u32 & 0xFF) as u8).collect()) }
pub fn js_utf8_to_bytes(s: &str) -> JsArr<u8> { JsArr::from_vec(s.as_bytes().to_vec()) }
pub fn js_bytes_to_ansi(b: &JsArr<u8>) -> String { b.to_vec().iter().map(|&c| (c & 0x7F) as char).collect() }
pub fn js_bytes_to_ascii(b: &JsArr<u8>) -> String { b.to_vec().iter().map(|&c| c as char).collect() }
pub fn js_bytes_to_utf8(b: &JsArr<u8>) -> String { String::from_utf8_lossy(&b.to_vec()).to_string() }

pub fn js_unpack16_be(w: u32) -> JsArr<u8> { JsArr::from_vec(vec![(w >> 8) as u8, w as u8]) }
pub fn js_unpack16_le(w: u32) -> JsArr<u8> { JsArr::from_vec(vec![w as u8, (w >> 8) as u8]) }
pub fn js_unpack32_be(w: u32) -> JsArr<u8> { JsArr::from_vec(w.to_be_bytes().to_vec()) }
pub fn js_unpack32_le(w: u32) -> JsArr<u8> { JsArr::from_vec(w.to_le_bytes().to_vec()) }
pub fn js_unpack64_be(w: u64) -> JsArr<u8> { JsArr::from_vec(w.to_be_bytes().to_vec()) }
pub fn js_unpack64_le(w: u64) -> JsArr<u8> { JsArr::from_vec(w.to_le_bytes().to_vec()) }

pub fn js_xor_arrays(a: &JsArr<u8>, b: &JsArr<u8>) -> JsArr<u8> {
    let (x, y) = (a.to_vec(), b.to_vec());
    JsArr::from_vec(x.iter().zip(y.iter()).map(|(p, q)| p ^ q).collect())
}

pub fn js_byte_at(a: &[i32], i: usize) -> i32 { a.get(i).cloned().unwrap_or(0) }

// ----- BigInt: arbitrary precision, sign and magnitude (little-endian 32-bit limbs)

#[derive(Clone, Default, Debug)]
pub struct JsBig {
    neg: bool,
    mag: Vec<u32>,
}

fn big_trim(v: &mut Vec<u32>) { while let Some(&0) = v.last() { v.pop(); } }

fn mag_cmp(a: &[u32], b: &[u32]) -> std::cmp::Ordering {
    if a.len() != b.len() { return a.len().cmp(&b.len()); }
    for i in (0..a.len()).rev() { if a[i] != b[i] { return a[i].cmp(&b[i]); } }
    std::cmp::Ordering::Equal
}

fn mag_add(a: &[u32], b: &[u32]) -> Vec<u32> {
    let n = a.len().max(b.len());
    let mut out = Vec::with_capacity(n + 1);
    let mut carry = 0u64;
    for i in 0..n {
        let s = *a.get(i).unwrap_or(&0) as u64 + *b.get(i).unwrap_or(&0) as u64 + carry;
        out.push(s as u32);
        carry = s >> 32;
    }
    if carry != 0 { out.push(carry as u32); }
    out
}

/// a - b for |a| >= |b|
fn mag_sub(a: &[u32], b: &[u32]) -> Vec<u32> {
    let mut out = Vec::with_capacity(a.len());
    let mut borrow = 0i64;
    for i in 0..a.len() {
        let mut d = a[i] as i64 - *b.get(i).unwrap_or(&0) as i64 - borrow;
        if d < 0 { d += 1 << 32; borrow = 1; } else { borrow = 0; }
        out.push(d as u32);
    }
    big_trim(&mut out);
    out
}

fn mag_mul(a: &[u32], b: &[u32]) -> Vec<u32> {
    if a.is_empty() || b.is_empty() { return Vec::new(); }
    let mut out = vec![0u32; a.len() + b.len()];
    for i in 0..a.len() {
        let mut carry = 0u64;
        let ai = a[i] as u64;
        if ai == 0 { continue; }
        for j in 0..b.len() {
            let t = ai * b[j] as u64 + out[i + j] as u64 + carry;
            out[i + j] = t as u32;
            carry = t >> 32;
        }
        let mut k = i + b.len();
        while carry != 0 {
            let t = out[k] as u64 + carry;
            out[k] = t as u32;
            carry = t >> 32;
            k += 1;
        }
    }
    big_trim(&mut out);
    out
}

fn mag_shl(a: &[u32], n: usize) -> Vec<u32> {
    if a.is_empty() { return Vec::new(); }
    let (w, b) = (n / 32, n % 32);
    let mut out = vec![0u32; w];
    if b == 0 { out.extend_from_slice(a); } else {
        let mut carry = 0u32;
        for &x in a { out.push((x << b) | carry); carry = x >> (32 - b); }
        if carry != 0 { out.push(carry); }
    }
    big_trim(&mut out);
    out
}

fn mag_shr(a: &[u32], n: usize) -> Vec<u32> {
    let (w, b) = (n / 32, n % 32);
    if w >= a.len() { return Vec::new(); }
    let src = &a[w..];
    let mut out = Vec::with_capacity(src.len());
    for i in 0..src.len() {
        let lo = src[i] >> b;
        let hi = if b == 0 { 0 } else { src.get(i + 1).map(|&x| x << (32 - b)).unwrap_or(0) };
        out.push(lo | hi);
    }
    big_trim(&mut out);
    out
}

/// Knuth's algorithm D: (quotient, remainder) of magnitudes, b non-empty
fn mag_divmod(a: &[u32], b: &[u32]) -> (Vec<u32>, Vec<u32>) {
    if mag_cmp(a, b) == std::cmp::Ordering::Less { return (Vec::new(), a.to_vec()); }
    if b.len() == 1 {
        let d = b[0] as u64;
        let mut q = vec![0u32; a.len()];
        let mut r = 0u64;
        for i in (0..a.len()).rev() {
            let cur = (r << 32) | a[i] as u64;
            q[i] = (cur / d) as u32;
            r = cur % d;
        }
        big_trim(&mut q);
        let mut rv = vec![r as u32];
        big_trim(&mut rv);
        return (q, rv);
    }
    let s = b[b.len() - 1].leading_zeros() as usize;
    let bn = mag_shl(b, s);
    let mut an = mag_shl(a, s);
    if an.len() == a.len() { an.push(0); }
    while an.len() < a.len() + 1 { an.push(0); }
    let n = bn.len();
    let m = an.len() - n;
    let mut q = vec![0u32; m];
    let btop = bn[n - 1] as u64;
    let bsec = bn[n - 2] as u64;
    for j in (0..m).rev() {
        let num = ((an[j + n] as u64) << 32) | an[j + n - 1] as u64;
        let mut qhat = num / btop;
        let mut rhat = num % btop;
        while qhat >= (1 << 32) || qhat * bsec > ((rhat << 32) | an[j + n - 2] as u64) {
            qhat -= 1;
            rhat += btop;
            if rhat >= (1 << 32) { break; }
        }
        let mut borrow = 0i64;
        let mut carry = 0u64;
        for i in 0..n {
            let p = qhat * bn[i] as u64 + carry;
            carry = p >> 32;
            let t = an[i + j] as i64 - (p & 0xFFFF_FFFF) as i64 - borrow;
            if t < 0 { an[i + j] = (t + (1 << 32)) as u32; borrow = 1; } else { an[i + j] = t as u32; borrow = 0; }
        }
        let t = an[j + n] as i64 - carry as i64 - borrow;
        if t < 0 {
            an[j + n] = (t + (1 << 32)) as u32;
            qhat -= 1;
            let mut c = 0u64;
            for i in 0..n {
                let s2 = an[i + j] as u64 + bn[i] as u64 + c;
                an[i + j] = s2 as u32;
                c = s2 >> 32;
            }
            an[j + n] = (an[j + n] as u64 + c) as u32;
        } else {
            an[j + n] = t as u32;
        }
        q[j] = qhat as u32;
    }
    big_trim(&mut q);
    an.truncate(n);
    big_trim(&mut an);
    (q, mag_shr(&an, s))
}

impl JsBig {
    pub fn zero() -> JsBig { JsBig::default() }
    fn from_parts(neg: bool, mut mag: Vec<u32>) -> JsBig {
        big_trim(&mut mag);
        let neg = neg && !mag.is_empty();
        JsBig { neg, mag }
    }
    pub fn from_u64(v: u64) -> JsBig { JsBig::from_parts(false, vec![v as u32, (v >> 32) as u32]) }
    pub fn from_i64(v: i64) -> JsBig { JsBig::from_parts(v < 0, { let u = v.unsigned_abs(); vec![u as u32, (u >> 32) as u32] }) }
    pub fn from_u128(v: u128) -> JsBig { JsBig::from_parts(false, vec![v as u32, (v >> 32) as u32, (v >> 64) as u32, (v >> 96) as u32]) }
    pub fn from_f64(f: f64) -> JsBig {
        if !f.is_finite() || f.fract() != 0.0 { js_throw_error("RangeError", "The number cannot be converted to a BigInt because it is not an integer"); }
        if f.abs() < 1.8e19 { return if f < 0.0 { JsBig::from_i64(f as i64) } else { JsBig::from_u64(f as u64) }; }
        let bits = f.abs().to_bits();
        let exp = ((bits >> 52) & 0x7FF) as i64 - 1075;
        let mant = (bits & ((1 << 52) - 1)) | (1 << 52);
        let m = JsBig::from_u64(mant);
        let r = if exp >= 0 { m.shl(exp as usize) } else { m.shr((-exp) as usize) };
        if f < 0.0 { r.neg() } else { r }
    }
    pub fn parse(s: &str) -> JsBig {
        let t = s.trim();
        let (neg, t) = if let Some(r) = t.strip_prefix('-') { (true, r) } else { (false, t) };
        let (radix, digits) = if let Some(r) = t.strip_prefix("0x").or_else(|| t.strip_prefix("0X")) { (16, r) }
            else if let Some(r) = t.strip_prefix("0b").or_else(|| t.strip_prefix("0B")) { (2, r) }
            else if let Some(r) = t.strip_prefix("0o").or_else(|| t.strip_prefix("0O")) { (8, r) } else { (10, t) };
        let mut mag: Vec<u32> = Vec::new();
        for c in digits.chars() {
            let d = match c.to_digit(radix) { Some(d) => d, None => js_throw_error("SyntaxError", &format!("Cannot convert {} to a BigInt", s)) };
            mag = mag_add(&mag_mul(&mag, &[radix]), &[d]);
        }
        JsBig::from_parts(neg, mag)
    }
    pub fn is_zero(&self) -> bool { self.mag.is_empty() }
    pub fn is_neg(&self) -> bool { self.neg }
    pub fn cmp(&self, o: &JsBig) -> i32 {
        use std::cmp::Ordering::*;
        match (self.neg, o.neg) {
            (false, true) => 1,
            (true, false) => -1,
            (n, _) => {
                let c = mag_cmp(&self.mag, &o.mag);
                let c = if n { c.reverse() } else { c };
                match c { Less => -1, Equal => 0, Greater => 1 }
            }
        }
    }
    pub fn neg(&self) -> JsBig { JsBig::from_parts(!self.neg, self.mag.clone()) }
    pub fn add(&self, o: &JsBig) -> JsBig {
        if self.neg == o.neg { return JsBig::from_parts(self.neg, mag_add(&self.mag, &o.mag)); }
        if mag_cmp(&self.mag, &o.mag) != std::cmp::Ordering::Less { JsBig::from_parts(self.neg, mag_sub(&self.mag, &o.mag)) }
        else { JsBig::from_parts(o.neg, mag_sub(&o.mag, &self.mag)) }
    }
    pub fn sub(&self, o: &JsBig) -> JsBig { self.add(&o.neg()) }
    pub fn mul(&self, o: &JsBig) -> JsBig { JsBig::from_parts(self.neg != o.neg, mag_mul(&self.mag, &o.mag)) }
    /// Truncating division and the remainder with the dividend's sign (JavaScript's / and %)
    pub fn divmod(&self, o: &JsBig) -> (JsBig, JsBig) {
        if o.is_zero() { js_throw_error("RangeError", "Division by zero"); }
        let (q, r) = mag_divmod(&self.mag, &o.mag);
        (JsBig::from_parts(self.neg != o.neg, q), JsBig::from_parts(self.neg, r))
    }
    pub fn div(&self, o: &JsBig) -> JsBig { self.divmod(o).0 }
    pub fn rem(&self, o: &JsBig) -> JsBig { self.divmod(o).1 }
    pub fn pow(&self, e: &JsBig) -> JsBig {
        if e.neg { js_throw_error("RangeError", "Exponent must be non-negative"); }
        let mut result = JsBig::from_u64(1);
        let mut base = self.clone();
        let bits = e.bit_length();
        for i in 0..bits {
            if e.bit(i) { result = result.mul(&base); }
            if i + 1 < bits { base = base.mul(&base); }
        }
        result
    }
    pub fn mod_pow(&self, e: &JsBig, m: &JsBig) -> JsBig {
        let mut result = JsBig::from_u64(1).modulo(m);
        let mut base = self.modulo(m);
        let bits = e.bit_length();
        for i in 0..bits {
            if e.bit(i) { result = result.mul(&base).modulo(m); }
            base = base.mul(&base).modulo(m);
        }
        result
    }
    /// The non-negative remainder (mathematical modulo)
    pub fn modulo(&self, m: &JsBig) -> JsBig {
        let r = self.rem(m);
        if r.neg { r.add(&JsBig::from_parts(false, m.mag.clone())) } else { r }
    }
    pub fn bit_length(&self) -> usize {
        match self.mag.last() { None => 0, Some(&top) => self.mag.len() * 32 - top.leading_zeros() as usize }
    }
    /// Bit i of the magnitude
    pub fn bit(&self, i: usize) -> bool { self.mag.get(i / 32).map(|w| (w >> (i % 32)) & 1 == 1).unwrap_or(false) }
    pub fn shl(&self, n: usize) -> JsBig { JsBig::from_parts(self.neg, mag_shl(&self.mag, n)) }
    /// Arithmetic shift right (floor division by 2^n, as JavaScript's >>)
    pub fn shr(&self, n: usize) -> JsBig {
        if !self.neg { return JsBig::from_parts(false, mag_shr(&self.mag, n)); }
        // floor for negatives: -((|a| - 1) >> n) - 1
        let m1 = mag_sub(&self.mag, &[1]);
        JsBig::from_parts(true, mag_add(&mag_shr(&m1, n), &[1]))
    }
    pub fn shift(&self, n: i64) -> JsBig { if n >= 0 { self.shl(n as usize) } else { self.shr((-n) as usize) } }
    /// Two's complement limbs over len limbs
    fn twos(&self, len: usize) -> Vec<u32> {
        let mut v = self.mag.clone();
        v.resize(len, 0);
        if self.neg {
            for x in v.iter_mut() { *x = !*x; }
            let mut i = 0;
            loop { let (s, o) = v[i].overflowing_add(1); v[i] = s; if !o { break; } i += 1; if i == len { break; } }
        }
        v
    }
    fn from_twos(mut v: Vec<u32>) -> JsBig {
        let neg = v.last().map(|&t| t & 0x8000_0000 != 0).unwrap_or(false);
        if neg {
            for x in v.iter_mut() { *x = !*x; }
            let mut i = 0;
            loop { let (s, o) = v[i].overflowing_add(1); v[i] = s; if !o { break; } i += 1; if i == v.len() { break; } }
        }
        JsBig::from_parts(neg, v)
    }
    fn bitop(&self, o: &JsBig, f: impl Fn(u32, u32) -> u32) -> JsBig {
        let len = self.mag.len().max(o.mag.len()) + 1;
        let (a, b) = (self.twos(len), o.twos(len));
        JsBig::from_twos(a.iter().zip(b.iter()).map(|(x, y)| f(*x, *y)).collect())
    }
    pub fn and(&self, o: &JsBig) -> JsBig { self.bitop(o, |x, y| x & y) }
    pub fn or(&self, o: &JsBig) -> JsBig { self.bitop(o, |x, y| x | y) }
    pub fn xor(&self, o: &JsBig) -> JsBig { self.bitop(o, |x, y| x ^ y) }
    pub fn not(&self) -> JsBig { self.neg().sub(&JsBig::from_u64(1)) }
    pub fn as_uint_n(&self, n: usize) -> JsBig {
        let len = n / 32 + 2;
        let mut v = self.twos(len.max(self.mag.len() + 1));
        let words = (n + 31) / 32;
        v.truncate(words);
        if n % 32 != 0 { if let Some(t) = v.last_mut() { *t &= (1u32 << (n % 32)) - 1; } }
        JsBig::from_parts(false, v)
    }
    pub fn as_int_n(&self, n: usize) -> JsBig {
        let u = self.as_uint_n(n);
        if n > 0 && u.bit(n - 1) { u.sub(&JsBig::from_u64(1).shl(n)) } else { u }
    }
    pub fn to_u64(&self) -> u64 {
        let v = self.twos(self.mag.len().max(2) + 1);
        v[0] as u64 | (v[1] as u64) << 32
    }
    pub fn to_i64(&self) -> i64 { self.to_u64() as i64 }
    pub fn to_f64(&self) -> f64 {
        let mut f = 0.0f64;
        for &w in self.mag.iter().rev() { f = f * 4294967296.0 + w as f64; }
        if self.neg { -f } else { f }
    }
    pub fn to_string_radix(&self, radix: u32) -> String {
        if self.mag.is_empty() { return "0".to_string(); }
        let mut digits = Vec::new();
        let mut m = self.mag.clone();
        while !m.is_empty() {
            let (q, r) = mag_divmod(&m, &[radix]);
            digits.push(std::char::from_digit(*r.first().unwrap_or(&0), radix).unwrap());
            m = q;
        }
        if self.neg { digits.push('-'); }
        digits.iter().rev().collect()
    }
    pub fn gcd(&self, o: &JsBig) -> JsBig {
        let mut a = JsBig::from_parts(false, self.mag.clone());
        let mut b = JsBig::from_parts(false, o.mag.clone());
        while !b.is_zero() { let r = a.rem(&b); a = b; b = r; }
        a
    }
    pub fn mod_inverse(&self, m: &JsBig) -> JsBig {
        let (mut old_r, mut r) = (self.modulo(m), m.clone());
        let (mut old_s, mut s) = (JsBig::from_u64(1), JsBig::zero());
        while !r.is_zero() {
            let q = old_r.div(&r);
            let nr = old_r.sub(&q.mul(&r)); old_r = r; r = nr;
            let ns = old_s.sub(&q.mul(&s)); old_s = s; s = ns;
        }
        if old_r.cmp(&JsBig::from_u64(1)) != 0 { js_throw_error("Error", "Modular inverse does not exist"); }
        old_s.modulo(m)
    }
}

impl JsDyn for JsBig {
    fn as_any(&self) -> &dyn Any { self }
    fn type_of(&self) -> &'static str { "bigint" }
    fn num(&self) -> Option<f64> { Some(self.to_f64()) }
    fn int(&self) -> Option<i64> { Some(self.to_i64()) }
    fn big(&self) -> Option<JsBig> { Some(self.clone()) }
    fn text(&self) -> String { self.to_string_radix(10) }
    fn truthy(&self) -> bool { !self.is_zero() }
}
impl ToJs for JsBig {
    fn to_js(&self) -> JsAny { JsAny::new(self.clone()) }
}
impl FromJs for JsBig {
    fn from_js(v: &JsAny) -> JsBig {
        match &v.0 {
            None => JsBig::zero(),
            Some(d) => match d.big() {
                Some(b) => b,
                None => match d.type_of() {
                    "string" => JsBig::parse(&d.text()),
                    _ => match d.int() { Some(i) => JsBig::from_i64(i), None => JsBig::from_f64(d.num().unwrap_or(0.0)) },
                },
            },
        }
    }
}

pub fn js_big_lit(s: &str) -> JsBig { JsBig::parse(s) }

// ----- regular expressions: the subset the algorithms use (classes, escapes,
// quantifiers ? * +, anchors ^ $; no groups or alternation), by backtracking

#[derive(Clone, Debug)]
enum JsReAtom {
    Char(char),
    Any,
    Class(Vec<(char, char)>, bool),
}

#[derive(Clone, Debug)]
pub struct JsRegex {
    atoms: Vec<(JsReAtom, usize, usize)>,
    start: bool,
    end: bool,
    pub global: bool,
    icase: bool,
}

fn js_re_escape_class(c: char) -> Option<Vec<(char, char)>> {
    match c {
        'd' => Some(vec![('0', '9')]),
        'w' => Some(vec![('a', 'z'), ('A', 'Z'), ('0', '9'), ('_', '_')]),
        's' => Some(vec![(' ', ' '), ('\t', '\r'), ('\u{a0}', '\u{a0}')]),
        _ => None,
    }
}

impl JsRegex {
    pub fn new(pattern: &str, flags: &str) -> JsRegex {
        let p: Vec<char> = pattern.chars().collect();
        let mut atoms = Vec::new();
        let mut i = 0;
        let mut start = false;
        let mut end = false;
        while i < p.len() {
            let c = p[i];
            let atom = match c {
                '^' if i == 0 => { start = true; i += 1; continue; }
                '$' if i == p.len() - 1 => { end = true; i += 1; continue; }
                '.' => { i += 1; JsReAtom::Any }
                '\\' => {
                    let e = p[i + 1];
                    i += 2;
                    if e == 'p' && i < p.len() && p[i] == '{' {
                        while i < p.len() && p[i] != '}' { i += 1; }
                        i += 1;
                        JsReAtom::Class(vec![('a', 'z'), ('A', 'Z'), ('\u{c0}', '\u{24f}')], false)
                    } else if let Some(r) = js_re_escape_class(e.to_ascii_lowercase()) {
                        JsReAtom::Class(r, e.is_ascii_uppercase())
                    } else {
                        JsReAtom::Char(match e { 'n' => '\n', 't' => '\t', 'r' => '\r', other => other })
                    }
                }
                '[' => {
                    i += 1;
                    let neg = p.get(i) == Some(&'^');
                    if neg { i += 1; }
                    let mut ranges = Vec::new();
                    while i < p.len() && p[i] != ']' {
                        let mut lo = p[i];
                        if lo == '\\' {
                            let e = p[i + 1];
                            i += 2;
                            if let Some(r) = js_re_escape_class(e) { ranges.extend(r); continue; }
                            lo = match e { 'n' => '\n', 't' => '\t', 'r' => '\r', other => other };
                        } else {
                            i += 1;
                        }
                        if i + 1 < p.len() && p[i] == '-' && p[i + 1] != ']' {
                            let mut hi = p[i + 1];
                            i += 2;
                            if hi == '\\' { hi = p[i]; i += 1; }
                            ranges.push((lo, hi));
                        } else {
                            ranges.push((lo, lo));
                        }
                    }
                    i += 1;
                    JsReAtom::Class(ranges, neg)
                }
                other => { i += 1; JsReAtom::Char(other) }
            };
            let (mut min, mut max) = (1usize, 1usize);
            if i < p.len() {
                match p[i] {
                    '?' => { min = 0; max = 1; i += 1; }
                    '*' => { min = 0; max = usize::MAX; i += 1; }
                    '+' => { min = 1; max = usize::MAX; i += 1; }
                    _ => {}
                }
            }
            atoms.push((atom, min, max));
        }
        JsRegex { atoms, start, end, global: flags.contains('g'), icase: flags.contains('i') }
    }

    fn matches_atom(&self, atom: &JsReAtom, c: char) -> bool {
        let fold = |x: char| if self.icase { x.to_ascii_lowercase() } else { x };
        match atom {
            JsReAtom::Any => c != '\n',
            JsReAtom::Char(x) => fold(*x) == fold(c),
            JsReAtom::Class(ranges, neg) => {
                let hit = ranges.iter().any(|&(lo, hi)| (c >= lo && c <= hi) || (self.icase && ((fold(c) >= fold(lo) && fold(c) <= fold(hi)) || (c.to_ascii_uppercase() >= lo && c.to_ascii_uppercase() <= hi))));
                hit != *neg
            }
        }
    }

    /// The end of a match of atoms[k..] starting at text[pos], or None
    fn match_here(&self, text: &[char], pos: usize, k: usize) -> Option<usize> {
        if k == self.atoms.len() {
            return if self.end && pos != text.len() { None } else { Some(pos) };
        }
        let (atom, min, max) = &self.atoms[k];
        let mut n = 0;
        while n < *max && pos + n < text.len() && self.matches_atom(atom, text[pos + n]) { n += 1; }
        loop {
            if n >= *min {
                if let Some(e) = self.match_here(text, pos + n, k + 1) { return Some(e); }
            }
            if n == 0 || n <= *min { return None; }
            n -= 1;
        }
    }

    /// The first match at or after from: (start, end)
    pub fn find(&self, text: &[char], from: usize) -> Option<(usize, usize)> {
        for s in from..=text.len() {
            if self.start && s != 0 { return None; }
            if let Some(e) = self.match_here(text, s, 0) { return Some((s, e)); }
        }
        None
    }

    pub fn test(&self, s: &str) -> bool { let t: Vec<char> = s.chars().collect(); self.find(&t, 0).is_some() }

    pub fn replace(&self, s: &str, repl: &str) -> String {
        let t: Vec<char> = s.chars().collect();
        let mut out = String::new();
        let mut pos = 0;
        while pos <= t.len() {
            match self.find(&t, pos) {
                None => break,
                Some((a, b)) => {
                    out.extend(&t[pos..a]);
                    out.push_str(&repl.replace("$&", &t[a..b].iter().collect::<String>()));
                    pos = if b > a { b } else { if a < t.len() { out.push(t[a]); } a + 1 };
                    if !self.global { break; }
                }
            }
        }
        if pos < t.len() { out.extend(&t[pos..]); }
        out
    }

    pub fn split(&self, s: &str) -> JsArr<String> {
        let t: Vec<char> = s.chars().collect();
        let mut out = Vec::new();
        let mut pos = 0;
        let mut seg = 0;
        while pos < t.len() {
            match self.find(&t, pos) {
                Some((a, b)) if b > a => { out.push(t[seg..a].iter().collect()); seg = b; pos = b; }
                Some((a, _)) => { pos = a + 1; }
                None => break,
            }
        }
        out.push(t[seg..].iter().collect());
        JsArr::from_vec(out)
    }
}

impl JsDyn for JsRegex {
    fn as_any(&self) -> &dyn Any { self }
    fn text(&self) -> String { "/regex/".to_string() }
}
impl ToJs for JsRegex {
    fn to_js(&self) -> JsAny { JsAny::new(self.clone()) }
}
impl FromJs for JsRegex {
    fn from_js(v: &JsAny) -> JsRegex { v.downcast::<JsRegex>().unwrap_or_else(|| JsRegex::new(&regex_escape(&v.text()), "")) }
}
impl Default for JsRegex {
    fn default() -> Self { JsRegex::new("", "") }
}

fn regex_escape(s: &str) -> String {
    s.chars().map(|c| if "\\^$.[]?*+(){}|".contains(c) { format!("\\{}", c) } else { c.to_string() }).collect()
}

// ----- OpCodes methods the IL keeps as calls

pub fn op_get_byte(word: u32, n: i32) -> u8 { (word >> ((n.wrapping_mul(8)) as u32 & 31)) as u8 }
pub fn op_gf256_mul(a: i32, b: i32) -> u8 {
    let (mut x, mut y, mut r) = (a as u8, b as u8, 0u8);
    for _ in 0..8 {
        if y & 1 != 0 { r ^= x; }
        let hi = x & 0x80;
        x <<= 1;
        if hi != 0 { x ^= 0x1B; }
        y >>= 1;
    }
    r
}
pub fn op_set_bit(v: u32, bit: i32, on: i32) -> u32 { if on != 0 { v | (1u32 << (bit as u32 & 31)) } else { v & !(1u32 << (bit as u32 & 31)) } }
pub fn op_get_bit(v: u32, bit: i32) -> bool { (v >> (bit as u32 & 31)) & 1 != 0 }
pub fn op_bit_mask(n: i32) -> u32 { if n >= 32 { 0xFFFF_FFFF } else if n <= 0 { 0 } else { (1u32 << n) - 1 } }
pub fn op_shr32_signed(v: i32, n: i32) -> i32 { v >> (n as u32 & 31) }
pub fn op_mul_hi32(a: u32, b: u32) -> u32 { ((a as u64 * b as u64) >> 32) as u32 }
pub fn op_pop_count(v: u32) -> i32 { v.count_ones() as i32 }
pub fn op_secure_compare(a: &JsArr<u8>, b: &JsArr<u8>) -> bool { a.to_vec() == b.to_vec() }
pub fn op_constant_time_compare(a: &JsArr<u8>, b: &JsArr<u8>, n: i32) -> bool {
    let (x, y) = (a.to_vec(), b.to_vec());
    let l = if n == 0 { x.len().min(y.len()) } else { n as usize };
    let mut r = 0u32;
    for i in 0..l { r |= (x.get(i).cloned().unwrap_or(0) ^ y.get(i).cloned().unwrap_or(0)) as u32; }
    r |= (x.len() ^ y.len()) as u32;
    r == 0
}
pub fn op_bytes_to_chars(b: &JsArr<u8>) -> String { js_bytes_to_ascii(b) }
pub fn op_rot_l64n(v: &JsBig, n: i32) -> JsBig { JsBig::from_u64(v.as_uint_n(64).to_u64().rotate_left((n & 63) as u32)) }
pub fn op_rot_r64n(v: &JsBig, n: i32) -> JsBig { JsBig::from_u64(v.as_uint_n(64).to_u64().rotate_right((n & 63) as u32)) }
pub fn op_mod_n(a: &JsBig, m: &JsBig) -> JsBig {
    if m.cmp(&JsBig::zero()) <= 0 { js_throw_error("RangeError", "ModN requires a positive modulus"); }
    a.modulo(m)
}
/// ((a % m) * (b % m)) % m with JavaScript's remainder (the dividend's sign)
pub fn op_mul_mod_n(a: &JsBig, b: &JsBig, m: &JsBig) -> JsBig { a.rem(m).mul(&b.rem(m)).rem(m) }
pub fn op_square_mod_n(a: &JsBig, m: &JsBig) -> JsBig { let r = a.rem(m); r.mul(&r).rem(m) }
pub fn op_mod_pow_n(base: &JsBig, exp: &JsBig, m: &JsBig) -> JsBig {
    if m.cmp(&JsBig::from_u64(1)) == 0 { return JsBig::zero(); }
    if exp.is_zero() { return JsBig::from_u64(1); }
    let mut result = JsBig::from_u64(1);
    let mut b = base.rem(m);
    let mut e = exp.clone();
    while e.cmp(&JsBig::zero()) > 0 {
        if e.bit(0) { result = result.mul(&b).rem(m); }
        e = e.shr(1);
        b = b.mul(&b).rem(m);
    }
    result
}
pub fn op_mod_inverse_n(a: &JsBig, m: &JsBig) -> JsBig {
    let mut old_r = op_mod_n(a, m);
    let mut r = m.clone();
    let (mut old_s, mut s) = (JsBig::from_u64(1), JsBig::zero());
    while !r.is_zero() {
        let q = old_r.div(&r);
        let nr = old_r.sub(&q.mul(&r)); old_r = r; r = nr;
        let ns = old_s.sub(&q.mul(&s)); old_s = s; s = ns;
    }
    if old_r.cmp(&JsBig::from_u64(1)) != 0 { js_throw_error("RangeError", "ModInverseN: value has no inverse modulo m"); }
    op_mod_n(&old_s, m)
}
pub fn op_gcd_n(a: &JsBig, b: &JsBig) -> JsBig { a.gcd(b) }
pub fn op_get_bit_n(v: &JsBig, i: i32) -> JsBig { v.shr(i.max(0) as usize).and(&JsBig::from_u64(1)) }
/// The bit length (1 for zero), as OpCodes.BitCountN counts it
pub fn op_bit_count_n(v: &JsBig) -> i32 { if v.is_zero() { 1 } else { v.bit_length() as i32 } }
pub fn op_rot_l128n(v: &JsBig, n: i32) -> JsBig {
    let m = v.as_uint_n(128);
    let k = (n & 127) as usize;
    if k == 0 { return m; }
    m.shl(k).or(&m.shr(128 - k)).as_uint_n(128)
}
pub fn op_to_long(v: &JsBig) -> JsBig { v.as_int_n(64) }
pub fn op_to_short(v: i32) -> i16 { let x = v & 0xFFFF; (if x > 32767 { x - 65536 } else { x }) as i16 }
pub fn op_gf_mul(a: i32, b: i32, irreducible: i32, width: i32) -> u32 {
    let (mut a, mut b, mut result) = (a, b, 0i32);
    let mask = 1i32.wrapping_shl(width as u32).wrapping_sub(1);
    while b != 0 {
        if b & 1 != 0 { result ^= a; }
        a = a.wrapping_shl(1);
        if a & 1i32.wrapping_shl(width as u32) != 0 { a ^= irreducible; }
        a &= mask;
        b = ((b as u32) >> 1) as i32;
    }
    result as u32
}
pub fn op_add3_l64(a: u32, b: u32, c: u32) -> f64 { a as f64 + b as f64 + c as f64 }
pub fn op_add3_h64(low_sum: f64, a: f64, b: f64, c: f64) -> i32 {
    js_f2i(a + b + c + (js_f2i(low_sum / 4294967296.0) as i32) as f64) as i32
}
pub fn op_encode_msg_length64_le(bit_length: f64) -> JsArr<u8> {
    let low = js_f2i(bit_length) as u32;
    let high = js_f2i((bit_length / 4294967296.0).floor()) as u32;
    let mut v = low.to_le_bytes().to_vec();
    v.extend(high.to_le_bytes());
    JsArr::from_vec(v)
}
pub fn op_words32_to_bytes_be(w: &JsArr<u32>) -> JsArr<u8> { JsArr::from_vec(w.to_vec().iter().flat_map(|x| x.to_be_bytes()).collect()) }
pub fn op_bytes_to_words32_be(b: &JsArr<u8>) -> JsArr<u32> {
    let v = b.to_vec();
    let mut out = Vec::new();
    let mut i = 0;
    while i < v.len() {
        let g = |k: usize| *v.get(k).unwrap_or(&0) as u32;
        out.push(g(i) << 24 | g(i + 1) << 16 | g(i + 2) << 8 | g(i + 3));
        i += 4;
    }
    JsArr::from_vec(out)
}
pub fn op_xor_array_with_byte(a: &JsArr<u8>, v: i32) -> JsArr<u8> { JsArr::from_vec(a.to_vec().iter().map(|x| x ^ (v as u8)).collect()) }
pub fn op_gcm_increment(counter: &JsArr<u8>) -> JsArr<u8> {
    if counter.is_null() || counter.len() != 16 { js_throw_error("Error", "GCMIncrement requires 16-byte counter"); }
    let mut carry = 1u32;
    for i in (12..16).rev() {
        let sum = counter.get(i) as u32 + carry;
        counter.set(i, (sum & 0xFF) as u8);
        carry = sum >> 8;
    }
    counter.clone()
}
pub fn op_ghash_mul(x: &JsArr<u8>, y: &JsArr<u8>) -> JsArr<u8> {
    let (xv, mut v) = (x.to_vec(), y.to_vec());
    if xv.len() != 16 || v.len() != 16 { js_throw_error("Error", "GHashMul requires 16-byte arrays"); }
    let mut z = vec![0u8; 16];
    for i in 0..128 {
        if (xv[i >> 3] >> (7 - (i & 7))) & 1 != 0 { for j in 0..16 { z[j] ^= v[j]; } }
        let lsb = v[15] & 1;
        for j in (1..16).rev() { v[j] = (v[j] >> 1) | (v[j - 1] << 7); }
        v[0] >>= 1;
        if lsb != 0 { v[0] ^= 0xE1; }
    }
    JsArr::from_vec(z)
}
pub fn op_secure_random_bytes(n: i32) -> JsArr<u8> { JsArr::from_vec((0..n.max(0)).map(|_| (js_random() * 256.0) as u8).collect()) }
pub fn op_rot_l64_hl(high: u32, low: u32, n: i32) -> JsObj {
    let x = ((high as u64) << 32 | low as u64).rotate_left((n & 63) as u32);
    js_obj_of(vec![("h", ((x >> 32) as u32).to_js()), ("l", (x as u32).to_js())])
}
pub fn op_split64(v: f64) -> JsObj {
    js_obj_of(vec![("high32", ((v / 4294967296.0).floor() as u32).to_js()), ("low32", (js_f2i(v) as i32).to_js())])
}
pub fn op_add_mod(a: f64, b: f64, m: f64) -> f64 { ((a % m) + (b % m)) % m }
pub fn op_sub_mod(a: f64, b: f64, m: f64) -> f64 { ((a % m) - (b % m) + m) % m }
pub fn op_create_uint64_array_from_hex(values: &JsArr<String>) -> JsArr<JsArr<u32>> {
    JsArr::from_vec(values.to_vec().iter().map(|h| {
        let s = h.trim_start_matches("0x").trim_start_matches("0X");
        let p = format!("{:0>16}", s);
        js_arr(vec![u32::from_str_radix(&p[0..8], 16).unwrap_or(0), u32::from_str_radix(&p[8..16], 16).unwrap_or(0)])
    }).collect())
}

// ===== end of the runtime =====
`;

  const exported = { RustTransformer, RUST_RUNTIME, RUST_HEADER, OPCODES_SIGNATURES, rustStringLiteral };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (global) { global.RustTransformer = RustTransformer; global.RustTransformerModule = exported; }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
