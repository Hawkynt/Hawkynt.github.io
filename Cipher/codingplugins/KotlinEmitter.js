/**
 * KotlinEmitter.js - Kotlin source from the JVM IR (see JavaAST.js)
 * (c)2006-2025 Hawkynt
 *
 * Prints the typed JVM IR the JavaTransformer lowers the IL to as Kotlin.
 * The IR states every value's JVM type; Java converts between numeric types
 * implicitly (widening in calls, returns, assignments and operators), Kotlin
 * never does, so this emitter resolves each call against the signatures of
 * the runtime, the unit and the JDK classes the IR uses, and spells every
 * conversion out (.toLong(), .toDouble(), ...). Reference types are nullable
 * as JavaScript values may be undefined; members of a nullable value are
 * reached through !!.
 *
 * A unit becomes an object (the module's fields, functions and initialiser)
 * holding its classes as nested classes; fields are @JvmField, so the
 * runtime's reflection sees them as the JavaScript properties they are.
 */

(function (global) {
  'use strict';

  let JavaAST;
  if (typeof require !== 'undefined') JavaAST = require('./JavaAST.js');
  else JavaAST = global.JavaAST;
  const { T } = JavaAST;

  // Kotlin operator precedence (higher binds tighter)
  const P_ASSIGN = 0, P_IF = 1, P_OR = 4, P_AND = 5, P_EQ = 6, P_CMP = 7, P_IS = 8, P_INFIX = 10,
    P_ADD = 12, P_MUL = 13, P_PREFIX = 15, P_POSTFIX = 16, P_PRIMARY = 17;
  const BIN = {
    '||': [P_OR, '||'], '&&': [P_AND, '&&'], '==': [P_EQ, '=='], '!=': [P_EQ, '!='],
    '<': [P_CMP, '<'], '<=': [P_CMP, '<='], '>': [P_CMP, '>'], '>=': [P_CMP, '>='],
    '|': [P_INFIX, 'or'], '^': [P_INFIX, 'xor'], '&': [P_INFIX, 'and'],
    '<<': [P_INFIX, 'shl'], '>>': [P_INFIX, 'shr'], '>>>': [P_INFIX, 'ushr'],
    '+': [P_ADD, '+'], '-': [P_ADD, '-'], '*': [P_MUL, '*'], '/': [P_MUL, '/'], '%': [P_MUL, '%']
  };

  const KEYWORDS = new Set(['as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for', 'fun', 'if', 'in', 'interface',
    'is', 'null', 'object', 'package', 'return', 'super', 'this', 'throw', 'true', 'try', 'typealias', 'typeof', 'val',
    'var', 'when', 'while']);
  /** An identifier in Kotlin (keywords in backticks; $ is not an identifier character). */
  function id(name) {
    const n = String(name).replace(/\$/g, '_S_').replace(/^(_+)$/, '$1u');
    return KEYWORDS.has(n) ? '`' + n + '`' : n;
  }

  /** A Kotlin string literal. */
  function quote(s) {
    let out = '"';
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      if (ch === '"') out += '\\"';
      else if (ch === '\\') out += '\\\\';
      else if (ch === '$') out += '\\$';
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else if (c < 0x20 || c === 0x7F || (c > 0x7E && c <= 0xFFFF)) out += '\\u' + c.toString(16).padStart(4, '0');
      else if (c > 0xFFFF) { for (const unit of [ch.charCodeAt(0), ch.charCodeAt(1)]) out += '\\u' + unit.toString(16).padStart(4, '0'); }
      else out += ch;
    }
    return out + '"';
  }

  /** Masks and powers of two read best in hex. */
  function isMask(v) {
    if (!Number.isInteger(v) || v < 0xFFFF) return false;
    const b = BigInt(v);
    return (b & (b + 1n)) === 0n || (b & (b - 1n)) === 0n;
  }

  function dbl(v) {
    if (Number.isNaN(v)) return 'Double.NaN';
    if (v === Infinity) return 'Double.POSITIVE_INFINITY';
    if (v === -Infinity) return 'Double.NEGATIVE_INFINITY';
    if (Object.is(v, -0)) return '-0.0';
    let s = String(v);
    if (/^-?\d+$/.test(s)) s += '.0';
    if (/^-?\d+e/.test(s)) s = s.replace('e', '.0e');
    return s;
  }

  const PRIM = new Set(['int', 'long', 'double', 'boolean']);
  const BOXES = { int: 'Integer', long: 'Long', double: 'Double', boolean: 'Boolean' };
  const UNBOX = { Integer: 'int', Long: 'long', Double: 'double', Boolean: 'boolean' };
  const RANK = { int: 1, long: 2, double: 3 };
  const unbox = t => UNBOX[t] || t;
  const isNum = t => t === 'int' || t === 'long' || t === 'double';
  /** A class name without its type arguments. */
  const rawName = t => (typeof t === 'string' ? t.replace(/<.*$/, '') : t);

  // ===================================================================
  // Signatures: the runtime's (parsed from its Kotlin source), the JDK
  // classes the IR calls, and the unit's own
  // ===================================================================

  /** Map a Kotlin type in a runtime signature back to the IR's type name. */
  function irOfKt(k, typeParams) {
    let s = String(k).trim();
    const nullable = s.endsWith('?');
    if (nullable) s = s.slice(0, -1).trim();
    if (typeParams && typeParams.has(s)) return typeParams.get(s);
    switch (s) {
      case 'Int': return nullable ? 'Integer' : 'int';
      case 'Long': return nullable ? 'Long' : 'long';
      case 'Double': return nullable ? 'Double' : 'double';
      case 'Boolean': return nullable ? 'Boolean' : 'boolean';
      case 'Any': return 'Object';
      case 'Unit': return 'void';
      case 'String': return 'String';
      case 'java.math.BigInteger': return 'BigInteger';
      case 'Array<out Any?>': case 'Array<Any?>': return 'Object[]';
    }
    if (/^Class<.*>$/.test(s)) return 'Class';
    const g = s.match(/^JsArray<(.*)>$/);
    if (g) return `JsArray<${boxedIr(irOfKt(g[1], typeParams))}>`;
    return s.replace(/<.*$/, '');
  }
  const boxedIr = t => BOXES[t] || t;

  /** Split a parameter list at top-level commas. */
  function splitTop(s) {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of s) {
      if (ch === '<' || ch === '(') depth++;
      else if (ch === '>' || ch === ')') depth--;
      if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
    }
    if (cur.trim()) out.push(cur);
    return out.map(x => x.trim()).filter(Boolean);
  }

  /** The text with string and character literals and comments blanked (braces inside them are not code). */
  function blankLiterals(src) {
    let out = '';
    for (let i = 0; i < src.length; ++i) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') { out += ' '; ++i; } out += '\n'; continue; }
      if (c === '/' && src[i + 1] === '*') { while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; ++i; } out += '  '; ++i; continue; }
      if (c === '"' || c === '\'') {
        out += c; ++i;
        while (i < src.length && src[i] !== c) { if (src[i] === '\\') { out += ' '; ++i; } out += ' '; ++i; }
        out += c; continue;
      }
      out += c;
    }
    return out;
  }

  /**
   * Parse the class and member signatures of Kotlin source (the runtime).
   * @returns {Map<string, {ext: string|null, ifaces: string[], methods: Map, statics: Map, ctors: Array, fields: Map}>}
   */
  function parseKotlinSignatures(src) {
    const text = blankLiterals(src);
    const db = new Map();
    const stack = []; // { name, depth, isStatic }
    let depth = 0;
    const entry = name => {
      if (!db.has(name)) db.set(name, { ext: null, ifaces: [], methods: new Map(), statics: new Map(), ctors: [], fields: new Map() });
      return db.get(name);
    };
    const cur = () => stack.length ? stack[stack.length - 1] : null;
    const params = (list, typeParams) => splitTop(list).map(p => {
      const m = p.match(/^(vararg\s+)?(?:@\w+\s+)*(?:val\s+|var\s+)?`?(\w+)`?\s*:\s*(.+)$/);
      if (!m) return null;
      return { t: irOfKt(m[3].replace(/\s*=.*$/, ''), typeParams), varargs: !!m[1] };
    }).filter(Boolean);
    const lines = text.split('\n');
    for (const line of lines) {
      const startDepth = depth;
      const c = cur();
      let m;
      if ((m = line.match(/^\s*(?:(?:abstract|open|private|internal|data|final)\s+)*(class|object|interface|fun interface)\s+(\w+)(<[^>]*>)?(?:\s+private\s+constructor)?(\s*\((?:[^()]|\([^()]*\))*\))?(?:\s*:\s*([^{]+?))?\s*(\{|$)/))) {
        const name = c && c.kind === 'object' && m[1] === 'object' ? `${c.name}.${m[2]}` : m[2];
        const e = entry(name);
        e.kind = m[1];
        const supers = m[5] ? splitTop(m[5]) : [];
        for (const sp of supers) {
          const sn = sp.replace(/\(.*$/, '').replace(/<.*$/, '').trim();
          if (/\(/.test(sp) || e.kind === 'class' && !e.ext && !['JsDynamic', 'JsFn'].includes(sn)) { if (!e.ext && sn !== 'RuntimeException') e.ext = sn; else if (sn === 'RuntimeException') e.ext = 'RuntimeException'; }
          else e.ifaces.push(sn);
        }
        if (m[4]) e.ctors.push({ params: params(m[4].trim().slice(1, -1), null) });
        if (m[1] === 'fun interface') {
          const fm = line.match(/fun\s+(\w+)\s*\(([^)]*)\)\s*:\s*([^}]+?)\s*\}/);
          if (fm) e.methods.set(fm[1], [{ params: params(fm[2], null), ret: irOfKt(fm[3], null) }]);
        }
        const classParams = new Map();
        if (m[3]) for (const tp of splitTop(m[3].slice(1, -1))) classParams.set(tp.split(':')[0].trim(), 'Object');
        if (m[6] === '{') stack.push({ name, kind: m[1] === 'object' ? 'object' : 'class', depth: startDepth + 1, typeParams: classParams });
      } else if (c && /^\s*companion object\s*\{/.test(line)) {
        stack.push({ name: c.name, kind: 'companion', depth: startDepth + 1, typeParams: new Map() });
      } else if (c && (m = line.match(/^\s*(?:@\w+\s+)*(?:(?:private|public|open|override|abstract|final|operator|inline)\s+)*fun\s+(?:<([^>]+)>\s+)?`?(\w+)`?\s*\(/))) {
        const typeParams = new Map(c.typeParams || []);
        if (m[1]) for (const tp of splitTop(m[1])) { const [n, bound] = tp.split(':').map(x => x.trim()); typeParams.set(n, bound ? irOfKt(bound, null) : 'Object'); }
        const at = line.indexOf('(', line.indexOf('fun'));
        let d = 0, end = at;
        for (; end < line.length; ++end) { if (line[end] === '(') d++; else if (line[end] === ')' && --d === 0) break; }
        const rest = line.slice(end + 1);
        const rm = rest.match(/^\s*:\s*([^={]+?)\s*(=|\{|$)/);
        const sig = { params: params(line.slice(at + 1, end), typeParams), ret: rm ? irOfKt(rm[1], typeParams) : 'void' };
        sig.varargs = sig.params.some(p => p.varargs);
        sig.open = /\b(open|override|abstract)\b/.test(line.slice(0, line.indexOf('fun')));
        const e = entry(c.name);
        const isStatic = c.kind === 'companion' || c.kind === 'object';
        const map = isStatic ? e.statics : e.methods;
        if (!map.has(m[2])) map.set(m[2], []);
        map.get(m[2]).push(sig);
      } else if (c && (m = line.match(/^\s*(?:(?:private|public)\s+)?constructor\s*\(/))) {
        const at = line.indexOf('(');
        let d = 0, end = at;
        for (; end < line.length; ++end) { if (line[end] === '(') d++; else if (line[end] === ')' && --d === 0) break; }
        entry(c.name).ctors.push({ params: params(line.slice(at + 1, end), c.typeParams || null) });
      } else if (c && (m = line.match(/^\s*(?:@JvmField\s+)?(?:(?:private|public|override|open)\s+)*(val|var)\s+`?(\w+)`?\s*:\s*([^=]+?)\s*(=|$)/))) {
        const e = entry(c.name);
        e.fields.set(m[2], { t: irOfKt(m[3], null), static: c.kind !== 'class' });
      }
      for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      while (stack.length && depth < stack[stack.length - 1].depth) stack.pop();
    }
    return db;
  }

  /** JDK members the IR calls (static owner or receiver type -> name -> [params, ret][]). */
  const JDK = {
    Math: {
      floor: [[['double'], 'double']], ceil: [[['double'], 'double']], sqrt: [[['double'], 'double']], log: [[['double'], 'double']],
      exp: [[['double'], 'double']], sin: [[['double'], 'double']], cos: [[['double'], 'double']], tan: [[['double'], 'double']],
      tanh: [[['double'], 'double']], atan: [[['double'], 'double']], atan2: [[['double', 'double'], 'double']], asin: [[['double'], 'double']],
      acos: [[['double'], 'double']], log10: [[['double'], 'double']], log1p: [[['double'], 'double']], expm1: [[['double'], 'double']],
      cbrt: [[['double'], 'double']], sinh: [[['double'], 'double']], cosh: [[['double'], 'double']], pow: [[['double', 'double'], 'double']],
      rint: [[['double'], 'double']], hypot: [[['double', 'double'], 'double']],
      min: [[['int', 'int'], 'int'], [['long', 'long'], 'long'], [['double', 'double'], 'double']],
      max: [[['int', 'int'], 'int'], [['long', 'long'], 'long'], [['double', 'double'], 'double']],
      abs: [[['int'], 'int'], [['long'], 'long'], [['double'], 'double']],
      floorDiv: [[['int', 'int'], 'int'], [['long', 'long'], 'long']], floorMod: [[['int', 'int'], 'int'], [['long', 'long'], 'long']]
    },
    'java.util.Objects': { equals: [[['Object', 'Object'], 'boolean']] },
    Double: { isNaN: [[['double'], 'boolean']], isInfinite: [[['double'], 'boolean']], doubleToRawLongBits: [[['double'], 'long']], longBitsToDouble: [[['long'], 'double']] },
    Integer: { numberOfLeadingZeros: [[['int'], 'int']], numberOfTrailingZeros: [[['int'], 'int']], bitCount: [[['int'], 'int']], rotateLeft: [[['int', 'int'], 'int']], rotateRight: [[['int', 'int'], 'int']], toHexString: [[['int'], 'String']] },
    Long: { numberOfLeadingZeros: [[['long'], 'int']], bitCount: [[['long'], 'int']], rotateLeft: [[['long', 'int'], 'long']], rotateRight: [[['long', 'int'], 'long']] },
    BigInteger: { valueOf: [[['long'], 'BigInteger']] }
  };
  const JDK_OWNER = { Double: 'java.lang.Double', Integer: 'Integer', Long: 'java.lang.Long', BigInteger: 'java.math.BigInteger', Boolean: 'java.lang.Boolean', Character: 'Character', String: 'java.lang.String' };
  const NUMBER_VALUE = { intValue: 'toInt', longValue: 'toLong', doubleValue: 'toDouble', floatValue: 'toFloat', shortValue: 'toShort', byteValue: 'toByte' };
  const BIGINT_METHODS = {
    add: ['BigInteger'], subtract: ['BigInteger'], multiply: ['BigInteger'], divide: ['BigInteger'], remainder: ['BigInteger'], mod: ['BigInteger'],
    and: ['BigInteger'], or: ['BigInteger'], xor: ['BigInteger'], andNot: ['BigInteger'], gcd: ['BigInteger'], min: ['BigInteger'], max: ['BigInteger'],
    compareTo: ['BigInteger'], equals: ['Object'], modPow: ['BigInteger', 'BigInteger'], modInverse: ['BigInteger'],
    shiftLeft: ['int'], shiftRight: ['int'], testBit: ['int'], setBit: ['int'], clearBit: ['int'], flipBit: ['int'], pow: ['int'], toString: ['int']
  };

  class KotlinEmitter {
    constructor(options = {}) {
      this.indentUnit = options.indent || '    ';
      this.nl = options.newline || '\n';
      this.options = options;
      this.n = 0;
    }

    /**
     * The Kotlin source of a unit.
     * @param {Object} unit - the IR unit
     * @param {Object} options - { packageName, runtime (Kotlin source, prepended), runtimeSignatures (parsed DB) }
     */
    emit(unit, options = {}) {
      this.unit = unit;
      this.db = new Map(options.runtimeSignatures || (options.runtime ? parseKotlinSignatures(options.runtime) : []));
      this.addUnitSignatures(unit);
      const lines = [];
      if (options.runtime) {
        lines.push('@file:Suppress("UNCHECKED_CAST", "NAME_SHADOWING", "UNUSED_VARIABLE", "UNUSED_PARAMETER", "UNUSED_VALUE", "VARIABLE_WITH_REDUNDANT_INITIALIZER", "UNNECESSARY_NOT_NULL_ASSERTION", "USELESS_CAST", "UNREACHABLE_CODE", "REDUNDANT_ELSE_IN_WHEN", "KotlinConstantConditions", "SENSELESS_COMPARISON", "DEPRECATION", "PLATFORM_CLASS_MAPPED_TO_KOTLIN", "CAST_NEVER_SUCCEEDS", "UNUSED_EXPRESSION", "IMPLICIT_CAST_TO_ANY")');
        if (options.packageName) lines.push(`package ${options.packageName}`);
        lines.push('', options.runtime, '');
      } else if (options.packageName) lines.push(`package ${options.packageName}`, '');
      lines.push(...this.unitObject(unit));
      return lines.join(this.nl) + this.nl;
    }

    // ------------------------------------------------------------------ signatures of the unit

    addUnitSignatures(unit) {
      const entry = name => {
        if (!this.db.has(name)) this.db.set(name, { ext: null, ifaces: [], methods: new Map(), statics: new Map(), ctors: [], fields: new Map(), unit: true });
        return this.db.get(name);
      };
      const sigOf = m => ({ params: m.params.map(p => ({ t: p.t, varargs: false })), ret: m.ret, varargs: false });
      const u = entry(unit.name);
      for (const m of unit.methods) { if (!u.statics.has(m.name)) u.statics.set(m.name, []); u.statics.get(m.name).push(sigOf(m)); }
      for (const f of unit.fields) u.fields.set(f.name, { t: f.t, static: true });
      for (const c of unit.classes) {
        const e = entry(c.name);
        e.ext = c.ext || null;
        if (c.dynamic) e.ifaces.push('JsDynamic');
        for (const ctor of c.ctors) e.ctors.push({ params: ctor.params.map(p => ({ t: p.t, varargs: false })) });
        for (const m of c.methods) { const map = m.static ? e.statics : e.methods; if (!map.has(m.name)) map.set(m.name, []); map.get(m.name).push(sigOf(m)); }
        for (const f of c.fields) e.fields.set(f.name, { t: f.t, static: !!f.static });
      }
    }

    /** The ancestors of a class (itself first), through unit and runtime classes. */
    ancestors(name) {
      const out = [];
      const seen = new Set();
      const visit = n => {
        n = rawName(n);
        if (!n || seen.has(n)) return;
        seen.add(n);
        const e = this.db.get(n);
        out.push(n);
        if (!e) return;
        if (e.ext) visit(e.ext);
        for (const i of e.ifaces || []) visit(i);
      };
      visit(name);
      return out;
    }

    isSubclass(a, b) { return this.ancestors(a).includes(rawName(b)); }

    /** Whether a value of IR type `from` can be passed where `to` is declared, and at which cost (null: not at all). */
    applicable(from, to, phase) {
      if (from === to) return 0;
      if (to === 'Object' || to === 'Object?') return PRIM.has(from) ? (phase >= 2 ? 2 : null) : 1;
      if (from === 'null') return PRIM.has(to) ? null : 1;
      if (PRIM.has(from) && PRIM.has(to)) return isNum(from) && isNum(to) && RANK[from] < RANK[to] ? 1 : null;
      if (PRIM.has(from)) return phase >= 2 && (BOXES[from] === to || (to === 'Number' && isNum(from))) ? 2 : null;
      if (PRIM.has(to)) {
        if (phase < 2 || !UNBOX[from]) return null;
        const u = UNBOX[from];
        return u === to ? 2 : isNum(u) && isNum(to) && RANK[u] < RANK[to] ? 3 : null;
      }
      const fr = rawName(from), tr = rawName(to);
      if (fr === tr) return 0;
      if (tr === 'Number' && (UNBOX[fr] || fr === 'BigInteger')) return 1;
      if (from === 'Object[]' || to === 'Object[]') return null;
      if (tr === 'Class' && (fr === 'Class' || from === 'Class')) return 0;
      if (this.isSubclass(fr, tr)) return 1;
      return null;
    }

    /** Choose among signatures for the argument types (Java's phases: no boxing, boxing, varargs). */
    resolve(sigs, argTypes) {
      if (!sigs || !sigs.length) return null;
      for (const phase of [1, 2, 3]) {
        const ok = [];
        for (const sig of sigs) {
          const ps = sig.params;
          const va = sig.varargs && ps.length && ps[ps.length - 1].varargs;
          if (phase < 3 || !va) {
            if (ps.length !== argTypes.length) continue;
            let cost = 0, fine = true;
            for (let i = 0; i < ps.length; ++i) {
              // before the varargs phase a varargs parameter is its array (Java passes an array as it)
              const pt = va && i === ps.length - 1 ? ps[i].t + '[]' : ps[i].t;
              const c = this.applicable(argTypes[i], pt, phase);
              if (c === null) { fine = false; break; }
              cost += c;
            }
            if (fine) ok.push({ sig, cost, arrayPass: !!va });
          } else {
            if (argTypes.length < ps.length - 1) continue;
            let cost = 0, fine = true;
            for (let i = 0; i < argTypes.length; ++i) {
              const pt = i < ps.length - 1 ? ps[i].t : ps[ps.length - 1].t;
              const c = this.applicable(argTypes[i], pt, 2);
              if (c === null) { fine = false; break; }
              cost += c;
            }
            if (fine) ok.push({ sig, cost, spread: true });
          }
        }
        if (ok.length) {
          // most specific: a candidate whose parameters all fit every other candidate's
          const specific = ok.filter(a => ok.every(b => a === b || a.sig.params.every((p, i) => !b.sig.params[i] || this.applicable(p.t, b.sig.params[i].t, 1) !== null)));
          const pick = (specific.length ? specific : ok).sort((a, b) => a.cost - b.cost)[0];
          return pick;
        }
      }
      return null;
    }

    /** Signatures of a method name on a receiver type (instance) or owner (static). */
    methodSigs(owner, name, isStatic) {
      const out = [];
      if (isStatic) {
        const j = JDK[owner] && JDK[owner][name];
        if (j) return j.map(([ps, ret]) => ({ params: ps.map(t => ({ t, varargs: false })), ret, varargs: false }));
        const e = this.db.get(owner);
        if (e && e.statics.has(name)) return e.statics.get(name);
        return out;
      }
      if (owner === 'BigInteger' && BIGINT_METHODS[name]) return [{ params: BIGINT_METHODS[name].map(t => ({ t, varargs: false })), ret: 'Object', varargs: false }];
      for (const a of this.ancestors(owner)) {
        const e = this.db.get(a);
        if (e && e.methods.has(name)) out.push(...e.methods.get(name));
      }
      return out;
    }

    // ------------------------------------------------------------------ types

    /** A JVM IR type in Kotlin syntax (references nullable). */
    kt(t, nonNull) {
      if (!t || t === 'null' || t === 'Object' || t === 'Class') return nonNull ? 'Any' : 'Any?';
      switch (t) {
        case 'int': return 'Int';
        case 'long': return 'Long';
        case 'double': return 'Double';
        case 'boolean': return 'Boolean';
        case 'void': return 'Unit';
        case 'Integer': return 'Int?';
        case 'Long': return 'Long?';
        case 'Double': return 'Double?';
        case 'Boolean': return 'Boolean?';
        case 'Object[]': return 'Array<out Any?>?';
        case 'BigInteger': return nonNull ? 'java.math.BigInteger' : 'java.math.BigInteger?';
        case 'RuntimeException': return nonNull ? 'RuntimeException' : 'RuntimeException?';
      }
      const g = t.match(/^(\w+)<(.*)>$/);
      if (g) return `${g[1]}<${splitTop(g[2]).map(a => this.ktArg(a)).join(', ')}>${nonNull ? '' : '?'}`;
      return nonNull ? t : t + '?';
    }

    ktArg(t) { return PRIM.has(t) ? this.kt(BOXES[t]) : this.kt(t); }

    /** A type in an is-check (no nullability, star projections). */
    ktIs(t) {
      const n = this.kt(t, true);
      return n.replace(/<.*>$/, '<*>');
    }

    defaultValue(t) {
      if (t === 'int') return '0';
      if (t === 'long') return '0L';
      if (t === 'double') return '0.0';
      if (t === 'boolean') return 'false';
      return 'null';
    }

    /** The value a missing return gives (JavaScript undefined). */
    undefinedValue(t) {
      if (t === 'int') return '0';
      if (t === 'long') return '0L';
      if (t === 'double') return 'Double.NaN';
      if (t === 'boolean') return 'false';
      return 'null';
    }

    ind(n) { return this.indentUnit.repeat(n); }
    fresh(base) { return `${base}__${++this.n}`; }

    // ------------------------------------------------------------------ unit and classes

    unitObject(unit) {
      const out = [];
      const i1 = this.ind(1);
      out.push(`// @generated-unit ${unit.name}`);
      out.push(`object ${unit.name} {`);
      for (const f of unit.fields) out.push(`${i1}@JvmField var ${id(f.name)}: ${this.kt(f.t)} = ${this.defaultValue(f.t)}`);
      if (unit.init.length) {
        out.push(`${i1}init {`);
        unit.init.forEach((s, i) => out.push(`${i1}${i1}init__${i}()`));
        out.push(`${i1}}`);
        unit.init.forEach((s, i) => out.push(...this.method({ name: `init__${i}`, params: [], ret: 'void', static: true, body: s.body || [s], priv: true }, 1, null, { unitLevel: true })));
      }
      for (const m of unit.methods) out.push(...this.method(Object.assign({ static: true }, m), 1, null, { unitLevel: true }));
      for (const c of unit.classes) out.push(...this.cls(c, 1));
      out.push('}');
      return out;
    }

    cls(c, depth) {
      const i = this.ind(depth), i1 = this.ind(depth + 1);
      const out = [''];
      const supers = [];
      if (c.ext) supers.push(c.ext);
      if (c.dynamic) supers.push('JsDynamic');
      out.push(`${i}open class ${c.name}${supers.length ? ' : ' + supers.join(', ') : ''} {`);
      if (c.dynamic) {
        out.push(`${i1}private var props__: JsObject? = null`);
        out.push(`${i1}override fun props(): JsObject? { if (props__ == null) props__ = JsObject(); return props__ }`);
      }
      // fields an ancestor already declares are that field (Java hides; Kotlin would conflict)
      const inherited = new Set();
      for (const a of this.ancestors(c.ext || '').filter(Boolean)) { const e = this.db.get(a); if (e) for (const k of e.fields.keys()) inherited.add(k); }
      for (const f of c.fields) {
        if (f.static || inherited.has(f.name)) continue;
        out.push(`${i1}@JvmField var ${id(f.name)}: ${this.kt(f.t)} = ${this.defaultValue(f.t)}`);
      }
      for (const ctor of c.ctors) out.push(...this.ctor(c, ctor, depth + 1));
      for (const m of c.methods.filter(m => !m.static)) out.push(...this.method(m, depth + 1, c, {}));
      const statics = c.fields.filter(f => f.static), staticMethods = c.methods.filter(m => m.static);
      if (statics.length || staticMethods.length || (c.staticInit && c.staticInit.length)) {
        out.push(`${i1}companion object {`);
        for (const f of statics) out.push(`${i1}${this.indentUnit}@JvmField var ${id(f.name)}: ${this.kt(f.t)} = ${this.defaultValue(f.t)}`);
        if (c.staticInit && c.staticInit.length) {
          const ctx = this.fnCtx({ cls: c, ret: 'void', static: true, body: c.staticInit });
          out.push(`${i1}${this.indentUnit}init {`, ...this.stmts(c.staticInit, depth + 3, ctx), `${i1}${this.indentUnit}}`);
        }
        for (const m of staticMethods) out.push(...this.method(m, depth + 2, c, { companion: true }));
        out.push(`${i1}}`);
      }
      out.push(`${i}}`);
      return out;
    }

    /** A function context: the jump labels its loops and blocks need, the parameters it reassigns. */
    fnCtx(o) {
      const ctx = Object.assign({ labels: new Map(), bodyLabels: new Map(), stack: [], temps: 0 }, o);
      this.prepareJumps(o.body, ctx);
      return ctx;
    }

    ctor(c, ctor, depth) {
      const i = this.ind(depth);
      const ctx = this.fnCtx({ cls: c, ret: 'void', ctor: true, body: ctor.body });
      let body = ctor.body;
      let delegation = '';
      const first = body[0];
      if (first && first.k === 'expr' && first.e.k === 'call' && (first.e.name === '<init>' || first.e.name === '<this>')) {
        const target = first.e.name === '<init>' ? c.ext : c.name;
        const args = this.callArgs(first.e.args, this.db.get(rawName(target)) ? this.db.get(rawName(target)).ctors : null, ctx);
        delegation = ` : ${first.e.name === '<init>' ? 'super' : 'this'}(${args})`;
        body = body.slice(1);
      } else if (c.ext) delegation = ' : super()';
      const params = ctor.params.map(p => `${id(p.name)}: ${this.kt(p.t)}`).join(', ');
      const out = [`${i}constructor(${params})${delegation} {`];
      out.push(...this.paramCopies(ctor.params, body, depth + 1));
      out.push(...this.stmts(body, depth + 1, ctx));
      out.push(`${i}}`);
      return out;
    }

    /** Kotlin parameters are values: a parameter the body assigns gets a variable of the same name. */
    paramCopies(params, body, depth) {
      const assigned = new Set();
      const seen = new Set();
      const visit = n => {
        if (!n || typeof n !== 'object' || seen.has(n)) return;
        seen.add(n);
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if ((n.k === 'assign' || n.k === 'inc') && n.target && n.target.k === 'name' && !n.target.boxed) assigned.add(n.target.name);
        if (n.k === 'lambda' || n.k === 'fns') return;
        for (const k of Object.keys(n)) if (k !== 't' && k !== 'ktTarget' && !(k === 'target' && (n.k === 'break' || n.k === 'continue')) && n[k] && typeof n[k] === 'object') visit(n[k]);
      };
      visit(body);
      return params.filter(p => assigned.has(p.name)).map(p => `${this.ind(depth)}var ${id(p.name)}: ${this.kt(p.t)} = ${id(p.name)}`);
    }

    /** Whether a method overrides one an ancestor declares (same name and parameter types). */
    overrides(cls, m) {
      if (!cls || m.static) return false;
      for (const a of this.ancestors(cls.ext || '').filter(Boolean)) {
        const e = this.db.get(a);
        if (!e || !e.methods.has(m.name)) continue;
        if (e.methods.get(m.name).some(s => s.params.length === m.params.length && s.params.every((p, i) => rawName(p.t) === rawName(m.params[i].t) || (p.t === 'Object' && !PRIM.has(m.params[i].t))))) return true;
      }
      return false;
    }

    method(m, depth, cls, where) {
      const i = this.ind(depth);
      const ctx = this.fnCtx({ cls, ret: m.ret, static: !!m.static, body: m.body, unitLevel: !!where.unitLevel, holder: where.holder || null });
      if (where.holder) ctx.holderOf = where.holderOf;
      const params = m.params.map(p => `${id(p.name)}: ${this.kt(p.t)}`).join(', ');
      let mods = '';
      if (where.unitLevel || where.companion) mods = (m.priv ? 'private ' : '') + '@JvmStatic ';
      else if (where.holder) mods = '';
      else mods = this.overrides(cls, m) ? 'override ' : 'open ';
      if (where.unitLevel || where.companion) mods = (m.priv ? '@JvmStatic private ' : '@JvmStatic ');
      const ret = m.ret === 'void' ? '' : `: ${this.kt(m.ret)}`;
      const out = [`${i}${mods}fun ${id(m.name)}(${params})${ret} {`];
      out.push(...this.paramCopies(m.params, m.body, depth + 1));
      out.push(...this.stmts(m.body, depth + 1, ctx));
      if (m.ret !== 'void' && this.canComplete(m.body)) out.push(`${i}${this.indentUnit}return ${this.undefinedValue(m.ret)}`);
      out.push(`${i}}`);
      return out;
    }

    // ------------------------------------------------------------------ jumps

    /** Label every loop, switch and block a break or continue targets. */
    prepareJumps(body, ctx) {
      const stack = [];
      const visit = s => {
        if (!s || typeof s !== 'object') return;
        if (Array.isArray(s)) { s.forEach(visit); return; }
        switch (s.k) {
          case 'while': case 'dowhile': case 'for':
            stack.push(s); visit(s.init); visit(s.body); stack.pop(); return;
          case 'switch': case 'switchChain': case 'labeled':
            stack.push(s); if (s.cases) for (const c of s.cases) visit(c.body); else visit(s.body); stack.pop(); return;
          case 'break': case 'continue': {
            let target = s.target;
            if (!target) {
              for (let i = stack.length - 1; i >= 0; --i) {
                const c = stack[i];
                if (c.k === 'labeled') continue;
                if (s.k === 'continue' && (c.k === 'switch' || c.k === 'switchChain')) continue;
                target = c; break;
              }
            }
            if (!target) return;
            s.ktTarget = target;
            if (!ctx.labels.has(target)) ctx.labels.set(target, `L${++this.n}`);
            if (s.k === 'continue' && target.k === 'for' && target.update && target.update.length && !ctx.bodyLabels.has(target)) ctx.bodyLabels.set(target, `L${++this.n}b`);
            return;
          }
          case 'block': visit(s.body); return;
          case 'if': visit(s.then); visit(s.els); return;
          case 'try': visit(s.block); visit(s.catchBody); visit(s.fin); return;
          case 'expr': if (s.e && s.e.k === 'stmtExpr') visit(s.e.stmt); return;
          default: return;
        }
      };
      visit(body);
    }

    lbl(s, ctx) { const l = ctx.labels.get(s); return l ? `${l}@ ` : ''; }

    canComplete(stmts) {
      if (!stmts || stmts.length === 0) return true;
      return stmts.every(s => this.stmtCompletes(s));
    }

    stmtCompletes(s) {
      if (!s) return true;
      switch (s.k) {
        case 'return': case 'throw': case 'break': case 'continue': return false;
        case 'block': return this.canComplete(s.body);
        case 'if': return !s.els || this.stmtCompletes(s.then) || this.stmtCompletes(s.els);
        case 'while': return !(s.c && s.c.k === 'lit' && s.c.v === true) || this.hasBreakTo(s.body, s);
        case 'for': return s.c !== null && !(s.c && s.c.k === 'lit' && s.c.v === true) || this.hasBreakTo(s.body, s);
        case 'dowhile': return !(s.c && s.c.k === 'lit' && s.c.v === true) || this.hasBreakTo(s.body, s);
        case 'try': return (this.stmtCompletes(s.block) || (s.catchBody && this.stmtCompletes(s.catchBody))) && (!s.fin || this.stmtCompletes(s.fin));
        default: return true;
      }
    }

    hasBreakTo(body, target) {
      let hit = false;
      const visit = s => {
        if (hit || !s || typeof s !== 'object') return;
        if (Array.isArray(s)) { s.forEach(visit); return; }
        if (s.k === 'break' && (s.target === target || s.ktTarget === target)) { hit = true; return; }
        for (const key of ['body', 'then', 'els', 'block', 'catchBody', 'fin', 'cases']) if (s[key]) visit(s[key]);
      };
      visit(body);
      return hit;
    }

    // ------------------------------------------------------------------ statements

    stmts(list, depth, ctx) {
      const out = [];
      for (const s of list || []) {
        out.push(...this.stmt(s, depth, ctx));
        if (!this.stmtCompletes(s)) break;
      }
      return out;
    }

    stmt(s, depth, ctx) {
      const i = this.ind(depth);
      switch (s.k) {
        case 'block': {
          if (s.body.length === 0) return [];
          return [`${i}run {`, ...this.stmts(s.body, depth + 1, ctx), `${i}}`];
        }
        case 'local': return this.local(s, depth, ctx);
        case 'expr': return this.exprStmt(s.e, depth, ctx);
        case 'if': {
          const out = [`${i}if (${this.cond(s.c, ctx)}) {`, ...this.inner(s.then, depth, ctx)];
          let els = s.els;
          while (els) {
            const only = els.k === 'block' && els.body.length === 1 && els.body[0].k === 'if' ? els.body[0] : (els.k === 'if' ? els : null);
            if (only) { out.push(`${i}} else if (${this.cond(only.c, ctx)}) {`, ...this.inner(only.then, depth, ctx)); els = only.els; }
            else { out.push(`${i}} else {`, ...this.inner(els, depth, ctx)); els = null; }
          }
          out.push(`${i}}`);
          return out;
        }
        case 'while': {
          ctx.stack.push(s);
          const out = [`${i}${this.lbl(s, ctx)}while (${this.cond(s.c, ctx)}) {`, ...this.inner(s.body, depth, ctx), `${i}}`];
          ctx.stack.pop();
          return out;
        }
        case 'dowhile': {
          ctx.stack.push(s);
          const out = [`${i}${this.lbl(s, ctx)}do {`, ...this.inner(s.body, depth, ctx), `${i}} while (${this.cond(s.c, ctx)})`];
          ctx.stack.pop();
          return out;
        }
        case 'for': return this.forStmt(s, depth, ctx);
        case 'switch': return this.switchStmt(s, depth, ctx);
        case 'switchChain': return this.switchChain(s, depth, ctx);
        case 'labeled': {
          ctx.stack.push(s);
          const l = ctx.labels.get(s);
          const out = [`${i}run ${l ? l + '@' : ''}{`, ...this.inner(s.body, depth, ctx), `${i}}`];
          ctx.stack.pop();
          return out;
        }
        case 'break': {
          const t = s.ktTarget || s.target;
          const l = t && ctx.labels.get(t);
          if (!t || !l) return [`${i}break`];
          if (t.k === 'switch' || t.k === 'switchChain' || t.k === 'labeled') return [`${i}return@${l}`];
          return [`${i}break@${l}`];
        }
        case 'continue': {
          const t = s.ktTarget || s.target;
          const bl = t && ctx.bodyLabels.get(t);
          if (bl) return [`${i}return@${bl}`];
          const l = t && ctx.labels.get(t);
          return [l ? `${i}continue@${l}` : `${i}continue`];
        }
        case 'return': {
          if (ctx.lambda) return [`${i}return@${ctx.lambda} ${s.e ? this.boxedTo(s.e, ctx) : 'null'}`];
          if (!s.e) return [ctx.ret && ctx.ret !== 'void' ? `${i}return ${this.undefinedValue(ctx.ret)}` : `${i}return`];
          if (ctx.ret === 'void') return [...this.exprStmt(s.e, depth, ctx), `${i}return`];
          return [`${i}return ${this.convTo(s.e, ctx.ret, ctx)}`];
        }
        case 'throw': return [`${i}throw ${this.post(s.e, ctx)}!!`];
        case 'try': {
          const out = [`${i}try {`, ...this.inner(s.block, depth, ctx)];
          if (s.catchBody) out.push(`${i}} catch (${id(s.catchName)}: RuntimeException) {`, ...this.inner(s.catchBody, depth, ctx));
          if (s.fin) out.push(`${i}} finally {`, ...this.inner(s.fin, depth, ctx));
          if (!s.catchBody && !s.fin) out.push(`${i}} finally {`);
          out.push(`${i}}`);
          return out;
        }
        case 'fns': return this.fnsHolder(s, depth, ctx);
        default: throw new Error(`KotlinEmitter: statement ${s.k}`);
      }
    }

    inner(s, depth, ctx) {
      if (!s) return [];
      if (s.k === 'block') return this.stmts(s.body, depth + 1, ctx);
      return this.stmt(s, depth + 1, ctx);
    }

    local(s, depth, ctx) {
      const i = this.ind(depth);
      if (s.boxed) {
        const ref = { int: 'IntRef', long: 'LongRef', double: 'DoubleRef', boolean: 'BoolRef' }[s.t];
        const init = s.init ? this.convTo(s.init, s.t, ctx) : this.defaultValue(s.t);
        return [`${i}val ${id(s.name)} = ${ref ? `${ref}(${init})` : `Ref<${this.ktArg(s.t)}>(${init})`}`];
      }
      return [`${i}var ${id(s.name)}: ${this.kt(s.t)} = ${s.init ? this.convTo(s.init, s.t, ctx) : this.defaultValue(s.t)}`];
    }

    exprStmt(e, depth, ctx) {
      const i = this.ind(depth);
      if (e.k === 'letin') {
        const out = [`${i}run {`];
        for (const b of e.binds) out.push(`${i}${this.indentUnit}val ${id(b.name)}: ${this.kt(b.e.t)} = ${this.convTo(b.e, b.e.t, ctx)}`);
        out.push(...this.exprStmt(e.body, depth + 1, ctx));
        out.push(`${i}}`);
        return out;
      }
      if (e.k === 'stmtExpr') return this.stmt(e.stmt, depth, ctx);
      let x = e;
      while (x.k === 'cast') x = x.e;
      if (x.k === 'scall' && x.owner === 'Js' && x.name === 'seq') return x.args.flatMap(a => this.exprStmt(a, depth, ctx));
      if (x.k === 'assign') return [`${i}${this.assignStmt(x, ctx)}`];
      if (x.k === 'inc') return [`${i}${this.expr(x, 0, ctx)}`];
      if (x.k === 'call' || x.k === 'scall' || x.k === 'new') return [`${i}${this.expr(x, 0, ctx)}`];
      if (x.k === 'cond') return [`${i}if (${this.cond(x.c, ctx)}) {`, ...this.exprStmt(x.a, depth + 1, ctx), `${i}} else {`, ...this.exprStmt(x.b, depth + 1, ctx), `${i}}`];
      if (x.k === 'lit' || x.k === 'name' || x.k === 'this' || x.k === 'sfield' || x.k === 'classref' || x.k === 'lambda') return [];
      return [`${i}Js.discard(${this.expr(x, 0, ctx)})`];
    }

    forStmt(s, depth, ctx) {
      const i = this.ind(depth), i1 = this.ind(depth + 1);
      const out = [`${i}run {`];
      for (const x of s.init || []) out.push(...this.stmt(x, depth + 1, ctx));
      ctx.stack.push(s);
      const cond = s.c ? this.cond(s.c, ctx) : 'true';
      out.push(`${i1}${this.lbl(s, ctx)}while (${cond}) {`);
      const bl = ctx.bodyLabels.get(s);
      if (bl) out.push(`${i1}${this.indentUnit}run ${bl}@{`, ...this.inner(s.body, depth + 2, ctx), `${i1}${this.indentUnit}}`);
      else out.push(...this.inner(s.body, depth + 1, ctx));
      if (this.stmtCompletes(s.body) || bl || this.hasContinueTo(s.body, s)) for (const u of s.update || []) out.push(...this.stmt(u, depth + 2, ctx));
      out.push(`${i1}}`);
      ctx.stack.pop();
      out.push(`${i}}`);
      return out;
    }

    hasContinueTo(body, target) {
      let hit = false;
      const visit = s => {
        if (hit || !s || typeof s !== 'object') return;
        if (Array.isArray(s)) { s.forEach(visit); return; }
        if (s.k === 'continue' && (s.target === target || s.ktTarget === target)) { hit = true; return; }
        for (const key of ['body', 'then', 'els', 'block', 'catchBody', 'fin', 'cases']) if (s[key]) visit(s[key]);
      };
      visit(body);
      return hit;
    }

    /** A switch as a block: the index of the first case taken, then every body from it on (fall-through). */
    switchStmt(s, depth, ctx) {
      const i = this.ind(depth), i1 = this.ind(depth + 1);
      const l = ctx.labels.get(s);
      const d = this.fresh('d'), e = this.fresh('e');
      const discT = s.disc.t;
      const out = [`${i}run ${l ? l + '@' : ''}{`];
      out.push(`${i1}val ${d}: ${this.kt(discT)} = ${this.convTo(s.disc, discT, ctx)}`);
      const n = s.cases.length;
      const defaultIdx = s.cases.findIndex(c => !c.tests);
      const branches = [];
      s.cases.forEach((c, k) => { if (c.tests) for (const t of c.tests) branches.push(`${this.convTo(t, discT, ctx)} -> ${k}`); });
      const otherwise = defaultIdx >= 0 ? defaultIdx : n;
      let entry = `when (${d}) { ${branches.join('; ')}${branches.length ? '; ' : ''}else -> ${otherwise} }`;
      if (s.guard) entry = `if (${this.cond(s.guard, ctx)}) ${entry} else ${otherwise}`;
      out.push(`${i1}val ${e}: Int = ${entry}`);
      ctx.stack.push(s);
      s.cases.forEach((c, k) => {
        if (!c.body.length) return;
        out.push(`${i1}if (${e} <= ${k}) {`, ...this.stmts(c.body, depth + 2, ctx), `${i1}}`);
      });
      ctx.stack.pop();
      out.push(`${i}}`);
      return out;
    }

    switchChain(s, depth, ctx) {
      const i = this.ind(depth), i1 = this.ind(depth + 1);
      const l = ctx.labels.get(s);
      const out = [`${i}run ${l ? l + '@' : ''}{`];
      ctx.stack.push(s);
      for (const c of s.cases) {
        if (!c.body.length) continue;
        out.push(`${i1}if (${id(s.match)} >= 0 && ${id(s.match)} <= ${c.index}) {`, ...this.stmts(c.body, depth + 2, ctx), `${i1}}`);
      }
      ctx.stack.pop();
      out.push(`${i}}`);
      return out;
    }

    fnsHolder(s, depth, ctx) {
      const i = this.ind(depth);
      const out = [`${i}val ${id(s.name)} = object {`];
      for (const m of s.decl.methods) out.push(...this.method(Object.assign({}, m, { static: false }), depth + 1, ctx.cls, { holder: true, holderOf: ctx }));
      out.push(`${i}}`);
      return out;
    }

    // ------------------------------------------------------------------ expressions

    expr(e, minPrec, ctx) {
      const [text, prec] = this.exprP(e, ctx);
      return prec < minPrec ? `(${text})` : text;
    }

    /** An expression usable as a receiver (postfix position). */
    post(e, ctx) { return this.expr(e, P_POSTFIX, ctx); }

    /** A receiver: non-null asserted when the value may be null. */
    recv(e, ctx) {
      const text = this.post(e, ctx);
      if (e.k === 'this' || e.k === 'super' || e.k === 'new' || e.k === 'classref' || (e.k === 'lit' && e.v !== null) || PRIM.has(e.t)) return text;
      if (e.k === 'name' && (e.t === 'Object' || !e.t) && /^fns__|^fns\d|^fns_/.test(e.name)) return text;
      if (e.k === 'name' && ctx && ctx.holderNames && ctx.holderNames.has(e.name)) return text;
      return `${text}!!`;
    }

    /** A condition (a boolean, never null). */
    cond(e, ctx) { return this.convTo(e, 'boolean', ctx); }

    /** An expression converted to an IR type. */
    convTo(e, to, ctx) {
      if (e.k === 'lit' && e.v === null) return PRIM.has(to) ? this.undefinedValue(to) : 'null';
      if (e.k === 'lit' && isNum(e.t) && isNum(to) && typeof e.v === 'number') return this.lit({ k: 'lit', v: to === 'int' ? Number(BigInt.asIntN(32, BigInt(Math.trunc(Number.isFinite(e.v) ? e.v : 0)))) : to === 'long' ? (Number.isFinite(e.v) ? Math.trunc(e.v) : 0) : e.v, t: to })[0];
      const from = e.t;
      if (!to || from === to || to === 'void') return this.expr(e, P_ASSIGN, ctx);
      return this.convText(e, from, to, ctx);
    }

    convText(e, from, to, ctx) {
      const fu = unbox(from), tu = unbox(to);
      if (PRIM.has(from) && PRIM.has(to)) {
        if (isNum(from) && isNum(to)) return `${this.post(e, ctx)}.to${this.kt(to)}()`;
        return this.expr(e, P_ASSIGN, ctx);
      }
      if (PRIM.has(from)) {
        // boxing: Kotlin boxes implicitly; a different number kind converts first
        if (isNum(from) && isNum(tu) && from !== tu) return `${this.post(e, ctx)}.to${this.kt(tu)}()`;
        if (UNBOX[to] === from) return `(${this.expr(e, P_PREFIX, ctx)} as ${this.kt(to)})`;
        return this.expr(e, P_ASSIGN, ctx);
      }
      if (PRIM.has(to)) {
        if (UNBOX[from]) return isNum(fu) && fu !== to ? `${this.post(e, ctx)}!!.to${this.kt(to)}()` : `${this.post(e, ctx)}!!`;
        if (from === 'Object' || from === 'null' || !from) return `(${this.expr(e, P_PREFIX, ctx)} as ${this.kt(to)})`;
        return this.expr(e, P_ASSIGN, ctx);
      }
      if (UNBOX[from] && UNBOX[to] && fu !== tu && isNum(fu) && isNum(tu)) return `${this.post(e, ctx)}?.to${this.kt(tu)}()`;
      return this.expr(e, P_ASSIGN, ctx);
    }

    /** A value returned from a function value (boxed as Any?). */
    boxedTo(e, ctx) { return this.convTo(e, 'Object', ctx); }

    /** Call arguments, converted to the parameters of the overload Java would choose. */
    callArgs(args, sigs, ctx) {
      const argTypes = args.map(a => (a.k === 'lit' && a.v === null && (!a.t || a.t === 'null' || a.t === 'Object')) ? 'null' : a.t);
      const pick = sigs ? this.resolve(sigs, argTypes) : null;
      return args.map((a, i) => {
        // an array passed as a varargs parameter's array is spread in Kotlin
        if (pick && pick.arrayPass && i === args.length - 1) return `*${this.recv(a, ctx)}`;
        let pt = null;
        if (pick) {
          const ps = pick.sig.params;
          pt = i < ps.length ? ps[i].t : ps[ps.length - 1].t;
          if (pick.spread && i >= ps.length - 1) pt = ps[ps.length - 1].t;
        }
        if (a.k === 'lit' && a.v === null && a.t && a.t !== 'null' && a.t !== 'Object') return `null as ${this.kt(a.t)}`;
        if (pt && pt !== 'Object[]') return this.convTo(a, pt, ctx);
        if (a.t === 'Object[]' && pick && pick.spread) return `*${this.recv(a, ctx)}`;
        return this.expr(a, P_ASSIGN, ctx);
      }).join(', ');
    }

    assignStmt(e, ctx) {
      return `${this.target(e.target, ctx)} = ${this.convTo(e.v, e.target.t || e.t, ctx)}`;
    }

    target(t, ctx) {
      if (t.k === 'name') return t.boxed ? `${id(t.name)}.v` : id(t.name);
      if (t.k === 'field') return `${this.recv(t.obj, ctx)}.${id(t.name)}`;
      if (t.k === 'sfield') return `${this.owner(t.owner)}.${id(t.name)}`;
      return this.expr(t, P_POSTFIX, ctx);
    }

    owner(o) {
      if (!o) return '';
      return JDK_OWNER[o] || o;
    }

    exprP(e, ctx) {
      switch (e.k) {
        case 'lit': return this.lit(e);
        case 'big': {
          const v = BigInt(e.v);
          if (v === 0n) return ['java.math.BigInteger.ZERO', P_POSTFIX];
          if (v === 1n) return ['java.math.BigInteger.ONE', P_POSTFIX];
          if (v >= -(2n ** 63n) && v < 2n ** 63n) return [`java.math.BigInteger.valueOf(${v === -(2n ** 63n) ? 'Long.MIN_VALUE' : v + 'L'})`, P_POSTFIX];
          return [`java.math.BigInteger(${quote(v.toString())})`, P_POSTFIX];
        }
        case 'name': return [e.boxed ? `${id(e.name)}.v` : id(e.name), P_PRIMARY];
        case 'this': return [ctx && ctx.holder && ctx.cls ? `this@${ctx.cls.name}` : 'this', P_PRIMARY];
        case 'super': return ['super', P_PRIMARY];
        case 'classref': return [e.name, P_PRIMARY];
        case 'classlit': return [`${e.name}::class.java`, P_POSTFIX];
        case 'field': return [`${this.recv(e.obj, ctx)}.${id(e.name)}`, P_POSTFIX];
        case 'sfield': return [`${this.owner(e.owner)}.${id(e.name)}`, P_POSTFIX];
        case 'call': return [this.callText(e, ctx), P_POSTFIX];
        case 'scall': return [this.scallText(e, ctx), P_POSTFIX];
        case 'new': {
          const cls = rawName(e.cls);
          const entry = this.db.get(cls);
          const g = String(e.cls).match(/^(\w+)<(.*)>$/);
          const typeArgs = g ? `<${splitTop(g[2]).map(a => this.ktArg(a)).join(', ')}>` : '';
          return [`${cls}${typeArgs}(${this.callArgs(e.args, entry ? entry.ctors : null, ctx)})`, P_POSTFIX];
        }
        case 'jsarrayOf': {
          const et = T.elemOf(e.t);
          if (e.items.length === 0) return [`JsArray<${this.ktArg(et)}>()`, P_POSTFIX];
          return [`JsArray.of<${this.ktArg(et)}>(${e.items.map(x => this.convTo(x, et, ctx)).join(', ')})`, P_POSTFIX];
        }
        case 'uncheckedCast': return [`(${this.expr(e.e, P_PREFIX, ctx)} as ${this.kt(e.t)})`, P_PRIMARY];
        case 'un': {
          if (e.op === '~') return [`${this.post(e.e, ctx)}.inv()`, P_POSTFIX];
          if (e.op === '!') return [`!${this.expr(e.e, P_PREFIX, ctx)}`, P_PREFIX];
          const inner = this.expr(e.e, P_PREFIX, ctx);
          return [`${e.op}${e.op === '-' && inner.startsWith('-') ? ' ' : ''}${inner}`, P_PREFIX];
        }
        case 'bin': return this.binary(e, ctx);
        case 'cond': {
          const t = e.t;
          return [`(if (${this.cond(e.c, ctx)}) ${this.convTo(e.a, t, ctx)} else ${this.convTo(e.b, t, ctx)})`, P_PRIMARY];
        }
        case 'cast': return this.cast(e, ctx);
        case 'assign': {
          // an assignment used as a value
          const v = this.fresh('v');
          if (e.target.k === 'field' && !(e.target.obj.k === 'this' || e.target.obj.k === 'name')) {
            const o = this.fresh('o');
            return [`run { val ${o} = ${this.recv(e.target.obj, ctx)}; val ${v} = ${this.convTo(e.v, e.target.t || e.t, ctx)}; ${o}.${id(e.target.name)} = ${v}; ${v} }`, P_POSTFIX];
          }
          return [`run { val ${v} = ${this.convTo(e.v, e.target.t || e.t, ctx)}; ${this.target(e.target, ctx)} = ${v}; ${v} }`, P_POSTFIX];
        }
        case 'inc': return e.prefix ? [`${e.op}${this.target(e.target, ctx)}`, P_PREFIX] : [`${this.target(e.target, ctx)}${e.op}`, P_POSTFIX];
        case 'instanceof': return [`(${this.expr(e.e, P_POSTFIX, ctx)} is ${this.ktIs(e.cls)})`, P_PRIMARY];
        case 'lambda': return [this.lambda(e, ctx), P_POSTFIX];
        case 'letin': {
          const binds = e.binds.map(b => `val ${id(b.name)}: ${this.kt(b.e.t)} = ${this.convTo(b.e, b.e.t, ctx)}`).join('; ');
          return [`run { ${binds}; ${this.expr(e.body, P_ASSIGN, ctx)} }`, P_POSTFIX];
        }
        case 'stmtExpr': return [`run {${this.nl}${this.stmt(e.stmt, 2, ctx).join(this.nl)}${this.nl}}`, P_POSTFIX];
        default: throw new Error(`KotlinEmitter: expression ${e.k}`);
      }
    }

    callText(e, ctx) {
      if (e.name === '<init>' || e.name === '<this>') throw new Error('KotlinEmitter: constructor call outside a constructor head');
      if (!e.obj) {
        // an unqualified call: a holder's sibling, or the class's own method
        const sigs = ctx && ctx.cls ? this.methodSigs(ctx.cls.name, e.name, false) : null;
        return `${id(e.name)}(${this.callArgs(e.args, sigs && sigs.length ? sigs : null, ctx)})`;
      }
      const t = e.obj.t;
      if (t === 'String') {
        if (e.name === 'length' && e.args.length === 0) return `${this.recv(e.obj, ctx)}.length`;
        return `${this.recv(e.obj, ctx)}.${id(e.name)}(${e.args.map(a => this.convTo(a, a.t === 'String' ? 'String' : a.t, ctx) + (a.t === 'String' && !(a.k === 'lit' && a.v !== null) ? '!!' : '')).join(', ')})`;
      }
      if (t === 'BigInteger' && e.args.length === 0 && NUMBER_VALUE[e.name]) return `${this.recv(e.obj, ctx)}.${NUMBER_VALUE[e.name]}()`;
      let owner = rawName(t);
      if (e.obj.k === 'this' && ctx && ctx.cls) owner = ctx.cls.name;
      if (e.obj.k === 'super' && ctx && ctx.cls) owner = ctx.cls.ext;
      const sigs = this.methodSigs(owner, e.name, false);
      return `${this.recv(e.obj, ctx)}.${id(e.name)}(${this.callArgs(e.args, sigs.length ? sigs : null, ctx)})`;
    }

    scallText(e, ctx) {
      const owner = e.owner;
      const sigs = this.methodSigs(owner || this.unit.name, e.name, true);
      const args = this.callArgs(e.args, sigs.length ? sigs : null, ctx);
      if (!owner) return `${id(e.name)}(${args})`;
      return `${this.owner(owner)}.${id(e.name)}${this.typeArgs(owner, e)}(${args})`;
    }

    /**
     * Explicit type arguments of the runtime's generic functions: Java infers them from the
     * target type, Kotlin only from the arguments.
     */
    typeArgs(owner, e) {
      const elem = () => this.ktArg(T.isJsArray(e.t) ? T.elemOf(e.t) : 'Object');
      const self = () => (PRIM.has(e.t) ? this.kt(BOXES[e.t]) : this.kt(e.t));
      const key = `${owner}.${e.name}`;
      switch (key) {
        case 'Js.toArr': case 'JsArray.from': case 'JsArray.filled': case 'JsArray.of': return `<${elem()}>`;
        case 'Js.as': case 'Js.enumOf': return `<${this.kt(e.t, true)}>`;
        case 'Js.cast': case 'Js.seq': case 'Js.coalesce': case 'Js.or': case 'Js.and':
        case 'Js.aliasArg': case 'Js.build': case 'OpCodes.ArraySlice':
          return `<${self()}>`;
        case 'Js.back': return PRIM.has(e.t) ? '' : `<${self()}>`;
        case 'OpCodes.CopyArray': return T.isJsArray(e.t) ? `<${elem()}>` : '';
        default: return '';
      }
    }

    binary(e, ctx) {
      const [prec, op] = BIN[e.op];
      const lt = unbox(e.l.t), rt = unbox(e.r.t);
      const both = (a, b) => [this.expr(a.e, a.p, ctx), this.expr(b.e, b.p, ctx)];
      if (e.op === '&&' || e.op === '||') {
        return [`${this.wrap(this.cond(e.l, ctx), e.l, prec, ctx)} ${op} ${this.wrap(this.cond(e.r, ctx), e.r, prec + 1, ctx)}`, prec];
      }
      if (e.op === '==' || e.op === '!=') {
        const ln = e.l.k === 'lit' && e.l.v === null, rn = e.r.k === 'lit' && e.r.v === null;
        if (ln || rn) return [`${this.expr(ln ? e.r : e.l, P_EQ + 1, ctx)} ${op} null`, P_EQ];
        if (isNum(lt) && isNum(rt) && (PRIM.has(e.l.t) || PRIM.has(e.r.t))) {
          const w = RANK[lt] >= RANK[rt] ? lt : rt;
          return [`${this.numOperand(e.l, w, P_EQ + 1, ctx)} ${op} ${this.numOperand(e.r, w, P_EQ + 1, ctx)}`, P_EQ];
        }
        if (PRIM.has(e.l.t) || PRIM.has(e.r.t)) return [`${this.expr(e.l, P_EQ + 1, ctx)} ${op} ${this.expr(e.r, P_EQ + 1, ctx)}`, P_EQ];
        return [`${this.expr(e.l, P_EQ + 1, ctx)} ${op === '==' ? '===' : '!=='} ${this.expr(e.r, P_EQ + 1, ctx)}`, P_EQ];
      }
      if (['<', '<=', '>', '>='].includes(e.op)) {
        const w = RANK[lt] >= RANK[rt] ? lt : rt;
        return [`${this.numOperand(e.l, w, prec + 1, ctx)} ${op} ${this.numOperand(e.r, w, prec + 1, ctx)}`, prec];
      }
      if (e.op === '+' && e.t === 'String') {
        const l = e.l.t === 'String' ? this.expr(e.l, P_ADD, ctx) : `Js.str(${this.expr(e.l, P_ASSIGN, ctx)})`;
        return [`${l} + ${this.expr(e.r, P_ADD + 1, ctx)}`, P_ADD];
      }
      if (lt === 'boolean' && rt === 'boolean') {
        return [`${this.wrap(this.cond(e.l, ctx), e.l, prec, ctx)} ${op} ${this.wrap(this.cond(e.r, ctx), e.r, prec + 1, ctx)}`, prec];
      }
      if (e.op === '<<' || e.op === '>>' || e.op === '>>>') {
        const lw = isNum(lt) ? lt : unbox(e.t);
        return [`${this.numOperand(e.l, lw, prec, ctx)} ${op} ${this.numOperand(e.r, 'int', prec + 1, ctx)}`, prec];
      }
      // arithmetic and bitwise: both operands in the result's type (Java's binary numeric promotion)
      const w = isNum(unbox(e.t)) ? unbox(e.t) : (RANK[lt] >= RANK[rt] ? lt : rt);
      return [`${this.numOperand(e.l, w, prec, ctx)} ${op} ${this.numOperand(e.r, w, prec + 1, ctx)}`, prec];
    }

    /** An operand converted to a numeric type, parenthesized for its position. */
    numOperand(x, w, minPrec, ctx) {
      if (!w || !isNum(w)) return this.expr(x, minPrec, ctx);
      if (x.t === w) return this.expr(x, minPrec, ctx);
      const text = this.convTo(x, w, ctx);
      if (x.k === 'lit') return /^-/.test(text) && minPrec > P_PREFIX ? `(${text})` : text;
      return text.endsWith(')') || text.endsWith('!!') ? text : `(${text})`;
    }

    wrap(text, e, minPrec, ctx) {
      const [, p] = this.exprP(e, ctx);
      return p < minPrec && !(text.startsWith('(') && text.endsWith(')')) ? `(${text})` : text;
    }

    cast(e, ctx) {
      const to = e.t, from = e.e.t;
      if (e.e.k === 'lit' && isNum(to) && isNum(from)) {
        let v = e.e.v;
        if (to === 'int') v = Number.isFinite(v) ? Number(BigInt.asIntN(32, BigInt(Math.trunc(v)))) : 0;
        else if (to === 'long') v = Number.isFinite(v) ? Math.trunc(v) : 0;
        return this.lit({ k: 'lit', v, t: to });
      }
      if (PRIM.has(to) || PRIM.has(from) || UNBOX[to]) {
        if (from === to) return this.exprP(e.e, ctx);
        if (PRIM.has(to) && !PRIM.has(from) && !UNBOX[from]) return [`(${this.expr(e.e, P_PREFIX, ctx)} as ${this.kt(to)})`, P_PRIMARY];
        if (UNBOX[to] && !PRIM.has(from) && !UNBOX[from]) return [`(${this.expr(e.e, P_PREFIX, ctx)} as ${this.kt(to)})`, P_PRIMARY];
        return [this.convText(e.e, from, to, ctx), P_POSTFIX];
      }
      if (to === 'String' || to === 'Object' || to === 'Class') return [`(${this.expr(e.e, P_PREFIX, ctx)} as ${this.kt(to)})`, P_PRIMARY];
      return [`(${this.expr(e.e, P_PREFIX, ctx)} as ${this.kt(to)})`, P_PRIMARY];
    }

    lambda(e, ctx) {
      const label = `fn${++this.n}`;
      const lctx = Object.assign({}, ctx, { ret: e.ret || 'Object', lambda: label, labels: new Map(), bodyLabels: new Map(), stack: [] });
      this.prepareJumps(e.body, lctx);
      const params = e.params.map(p => id(p.name)).join(', ');
      const lines = this.stmts(e.body, 1, lctx);
      if (this.canComplete(e.body)) lines.push(`${this.indentUnit}null`);
      return `JsFn ${label}@{ ${params} ->${this.nl}${lines.map(l => this.indentUnit.repeat(3) + l).join(this.nl)}${this.nl}${this.indentUnit.repeat(3)}}`;
    }

    lit(e) {
      const v = e.v;
      if (v === null || v === undefined) return ['null', P_PRIMARY];
      switch (e.t) {
        case 'int': {
          if (v === -2147483648) return ['Int.MIN_VALUE', P_POSTFIX];
          if (v < 0) return [String(v), P_PREFIX];
          return [isMask(v) && v <= 0x7FFFFFFF ? '0x' + v.toString(16).toUpperCase() : String(v), P_PRIMARY];
        }
        case 'long': {
          if (v <= -9223372036854775808) return ['Long.MIN_VALUE', P_POSTFIX];
          const b = BigInt(Math.trunc(v));
          if (b < 0n) return [`${b}L`, P_PREFIX];
          if (b >= 2n ** 63n) return ['Long.MAX_VALUE', P_POSTFIX];
          return [`${isMask(v) ? '0x' + b.toString(16).toUpperCase() : b.toString()}L`, P_PRIMARY];
        }
        case 'double': {
          const s = dbl(v);
          return [s, s.startsWith('-') ? P_PREFIX : (s.startsWith('Double.') ? P_POSTFIX : P_PRIMARY)];
        }
        case 'boolean': return [v ? 'true' : 'false', P_PRIMARY];
        case 'String': return [this.stringLit(v), P_PRIMARY];
        default:
          if (typeof v === 'string') return [this.stringLit(v), P_PRIMARY];
          if (typeof v === 'boolean') return [v ? 'true' : 'false', P_PRIMARY];
          if (typeof v === 'number') return this.lit({ k: 'lit', v, t: Number.isInteger(v) && Math.abs(v) <= 2147483647 ? 'int' : 'double' });
          return [String(v), P_PRIMARY];
      }
    }

    /** A string constant; long ones are joined at run time (a constant holds at most 65535 bytes). */
    stringLit(s) {
      if (s.length <= 8000) return quote(s);
      const parts = [];
      for (let i = 0; i < s.length; i += 8000) parts.push(quote(s.slice(i, i + 8000)));
      return `Js.concatChunks(${parts.join(', ')})`;
    }
  }

  const exports = { KotlinEmitter, parseKotlinSignatures, quote };
  if (typeof module !== 'undefined' && module.exports) module.exports = exports;
  if (global) { global.KotlinEmitter = KotlinEmitter; global.KotlinSignatures = parseKotlinSignatures; }
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
