/**
 * JavaEmitter.js - Java source from the JVM IR (see JavaAST.js)
 * (c)2006-2025 Hawkynt
 *
 * Prints a lowered unit as one Java compilation unit: an optional package,
 * the runtime (when asked for), and a final class holding the module's
 * static fields, functions and classes. Top-level statements run from the
 * class initialiser, each in a method of its own so no initialiser grows
 * past the JVM's 64 KB method limit.
 */

(function (global) {
  'use strict';

  let JavaAST;
  if (typeof require !== 'undefined') JavaAST = require('./JavaAST.js');
  else JavaAST = global.JavaAST;
  const { T } = JavaAST;

  // Java operator precedence (higher binds tighter)
  const PREC = {
    '||': 3, '&&': 4, '|': 5, '^': 6, '&': 7, '==': 8, '!=': 8,
    '<': 9, '<=': 9, '>': 9, '>=': 9, 'instanceof': 9, '<<': 10, '>>': 10, '>>>': 10,
    '+': 11, '-': 11, '*': 12, '/': 12, '%': 12
  };
  const P_ASSIGN = 1, P_COND = 2, P_UNARY = 13, P_POSTFIX = 14, P_PRIMARY = 15;

  /** A Java string literal (control characters as octal escapes: unicode escapes are processed before lexing). */
  function quote(s) {
    let out = '"';
    for (const ch of String(s)) {
      const c = ch.codePointAt(0);
      if (ch === '"') out += '\\"';
      else if (ch === '\\') out += '\\\\';
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '\\r';
      else if (ch === '\t') out += '\\t';
      else if (c < 0x20 || c === 0x7F) out += '\\' + c.toString(8).padStart(3, '0');
      else if (c > 0xFFFF) { for (const unit of [ch.charCodeAt(0), ch.charCodeAt(1)]) out += '\\u' + unit.toString(16).padStart(4, '0'); }
      else if (c > 0x7E) out += '\\u' + c.toString(16).padStart(4, '0');
      else out += ch;
    }
    return out + '"';
  }

  /** Masks and powers of two read best in hex (0xFFFFFFFF, 0x80000000). */
  function isMask(v) {
    if (!Number.isInteger(v) || v < 0xFFFF) return false;
    const b = BigInt(v);
    return (b & (b + 1n)) === 0n || (b & (b - 1n)) === 0n;
  }

  /** A double literal. */
  function dbl(v) {
    if (Number.isNaN(v)) return 'Double.NaN';
    if (v === Infinity) return 'Double.POSITIVE_INFINITY';
    if (v === -Infinity) return 'Double.NEGATIVE_INFINITY';
    if (Object.is(v, -0)) return '-0.0';
    let s = String(v);
    if (/^-?\d+$/.test(s)) s += '.0';
    return s;
  }

  class JavaEmitter {
    constructor(options = {}) {
      this.indentUnit = options.indent || '    ';
      this.nl = options.newline || '\n';
      this.options = options;
    }

    /** The Java source of a unit. */
    emit(unit, options = {}) {
      this.unit = unit;
      const lines = [];
      // No imports: names are qualified, so units concatenate into one file (bundled dependencies)
      if (options.packageName) lines.push(`package ${options.packageName};`, '');
      if (options.runtime) lines.push(options.runtime, '');
      lines.push(...this.unitClass(unit));
      return lines.join(this.nl) + this.nl;
    }

    unitClass(unit) {
      const out = [];
      // The marker names the class whose initialiser registers the algorithms (the validation harness loads it)
      out.push(`// @generated-unit ${unit.name}`);
      out.push(`final class ${unit.name} {`);
      out.push(`${this.indentUnit}private ${unit.name}() {}`);
      for (const f of unit.fields) out.push(`${this.indentUnit}static ${this.type(f.t)} ${f.name};`);
      if (unit.init.length) {
        out.push(`${this.indentUnit}static {`);
        unit.init.forEach((s, i) => out.push(`${this.indentUnit}${this.indentUnit}init__${i}();`));
        out.push(`${this.indentUnit}}`);
        unit.init.forEach((s, i) => {
          out.push(...this.method({ name: `init__${i}`, params: [], ret: 'void', static: true, body: s.body || [s], priv: true }, 1, null));
        });
      }
      for (const m of unit.methods) out.push(...this.method(Object.assign({ static: true }, m), 1, null));
      for (const c of unit.classes) out.push(...this.cls(c, 1));
      out.push('}');
      return out;
    }

    ind(n) { return this.indentUnit.repeat(n); }

    cls(c, depth) {
      const i = this.ind(depth);
      const out = [''];
      out.push(`${i}static class ${c.name}${c.ext ? ' extends ' + c.ext : ''} {`);
      for (const f of c.fields) out.push(`${i}${this.indentUnit}public ${f.static ? 'static ' : ''}${this.type(f.t)} ${f.name};`);
      if (c.staticInit && c.staticInit.length) {
        const ctx = { cls: c, ret: 'void', static: true };
        out.push(`${i}${this.indentUnit}static {`);
        for (const s of c.staticInit) out.push(...this.stmt(s, depth + 2, ctx));
        out.push(`${i}${this.indentUnit}}`);
      }
      for (const ctor of c.ctors) {
        const ctx = { cls: c, ret: 'void', ctor: true };
        this.prepareJumps(ctor.body);
        out.push(`${i}${this.indentUnit}public ${c.name}(${ctor.params.map(p => `${this.type(p.t)} ${p.name}`).join(', ')}) {`);
        out.push(...this.stmts(ctor.body, depth + 2, ctx));
        out.push(`${i}${this.indentUnit}}`);
      }
      for (const m of c.methods) out.push(...this.method(m, depth + 1, c));
      out.push(`${i}}`);
      return out;
    }

    method(m, depth, cls, holderCtx) {
      const i = this.ind(depth);
      const ctx = holderCtx ? { cls: holderCtx.cls, ret: m.ret, static: holderCtx.static, inHolder: true } : { cls, ret: m.ret, static: !!m.static };
      this.prepareJumps(m.body);
      const params = m.params.map((p, idx) => `${this.type(p.t)}${m.varargs && idx === m.params.length - 1 && false ? '...' : ''} ${p.name}`).join(', ');
      const mods = (m.priv ? 'private ' : (cls || m.static ? 'public ' : '')) + (m.static ? 'static ' : '');
      const out = [`${i}${mods}${this.type(m.ret)} ${m.name}(${params}) {`];
      out.push(...this.stmts(m.body, depth + 1, ctx));
      if (m.ret !== 'void' && this.canComplete(m.body)) out.push(`${i}${this.indentUnit}return ${this.undefinedValue(m.ret)};`);
      out.push(`${i}}`);
      return out;
    }

    undefinedValue(t) {
      if (t === 'int') return '0';
      if (t === 'long') return '0L';
      if (t === 'double') return 'Double.NaN';
      if (t === 'boolean') return 'false';
      return 'null';
    }

    /** A JVM type in Java syntax. */
    type(t) {
      if (!t || t === 'null') return 'Object';
      if (t === 'Class') return 'Object';
      return t.replace(/\bBigInteger\b/g, 'java.math.BigInteger');
    }

    /** A static call or field owner (BigInteger qualified). */
    owner(o) { return o === 'BigInteger' ? 'java.math.BigInteger' : o; }

    // ------------------------------------------------------------------ jumps

    /**
     * Decide which break/continue statements need a label: those whose target
     * is not the innermost construct Java would pick.
     */
    prepareJumps(body) {
      let n = 0;
      const stack = [];
      const visit = (s) => {
        if (!s || typeof s !== 'object') return;
        if (Array.isArray(s)) { s.forEach(visit); return; }
        switch (s.k) {
          case 'while': case 'dowhile': case 'for':
            stack.push(s); visit(s.init); visit(s.update); visit(s.body); stack.pop(); return;
          case 'switch': stack.push(s); for (const c of s.cases) visit(c.body); stack.pop(); return;
          case 'switchChain': s.label = s.label || `sw${++n}`; stack.push(s); for (const c of s.cases) visit(c.body); stack.pop(); return;
          case 'labeled': s.label = s.label || `lbl${++n}`; stack.push(s); visit(s.body); stack.pop(); return;
          case 'break': case 'continue': {
            const target = s.target;
            let innermost = null;
            for (let i = stack.length - 1; i >= 0; --i) {
              const c = stack[i];
              if (c.k === 'labeled') continue;
              if (s.k === 'continue' && (c.k === 'switch' || c.k === 'switchChain')) continue;
              if (c.k === 'switchChain') { innermost = c; break; }
              innermost = c; break;
            }
            if (target && (innermost !== target || target.k === 'switchChain' || target.k === 'labeled')) {
              target.label = target.label || `L${++n}`;
              s.useLabel = true;
            }
            return;
          }
          case 'block': visit(s.body); return;
          case 'if': visit(s.then); visit(s.els); return;
          case 'try': visit(s.block); visit(s.catchBody); visit(s.fin); return;
          case 'fns': return; // methods of their own
          default: return;
        }
      };
      visit(body);
    }

    /** Whether a statement list can complete normally (JLS 14.22, approximated). */
    canComplete(stmts) {
      if (!stmts || stmts.length === 0) return true;
      return this.stmtCompletes(stmts[stmts.length - 1]);
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
        case 'labeled': return true;
        case 'switch': {
          // completes unless it has a default and every case group ends in a jump that leaves it
          if (!s.cases.some(c => !c.tests)) return true;
          if (this.hasBreakTo(s.cases.map(c => c.body), s)) return true;
          return s.cases.length === 0 || this.canComplete(s.cases[s.cases.length - 1].body);
        }
        case 'switchChain': return true;
        default: return true;
      }
    }

    hasBreakTo(body, target) {
      let hit = false;
      const visit = s => {
        if (hit || !s || typeof s !== 'object') return;
        if (Array.isArray(s)) { s.forEach(visit); return; }
        if (s.k === 'break' && s.target === target) { hit = true; return; }
        for (const key of ['body', 'then', 'els', 'block', 'catchBody', 'fin', 'cases']) if (s[key]) visit(s[key]);
      };
      visit(body);
      return hit;
    }

    // ------------------------------------------------------------------ statements

    /** A statement list; statements after one that cannot complete are dropped (Java rejects unreachable code). */
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
          return [`${i}{`, ...this.stmts(s.body, depth + 1, ctx), `${i}}`];
        }
        case 'local': return this.local(s, depth, ctx);
        case 'expr': return this.exprStmt(s.e, depth, ctx);
        case 'if': {
          const out = [`${i}if (${this.expr(s.c, 0, ctx)}) {`, ...this.inner(s.then, depth, ctx)];
          let els = s.els;
          while (els) {
            const only = els.k === 'block' && els.body.length === 1 && els.body[0].k === 'if' ? els.body[0] : (els.k === 'if' ? els : null);
            if (only) { out.push(`${i}} else if (${this.expr(only.c, 0, ctx)}) {`, ...this.inner(only.then, depth, ctx)); els = only.els; }
            else { out.push(`${i}} else {`, ...this.inner(els, depth, ctx)); els = null; }
          }
          out.push(`${i}}`);
          return out;
        }
        case 'while': return [`${i}${this.lbl(s)}while (${this.expr(s.c, 0, ctx)}) {`, ...this.inner(s.body, depth, ctx), `${i}}`];
        case 'dowhile': return [`${i}${this.lbl(s)}do {`, ...this.inner(s.body, depth, ctx), `${i}} while (${this.expr(s.c, 0, ctx)});`];
        case 'for': return this.forStmt(s, depth, ctx);
        case 'switch': return this.switchStmt(s, depth, ctx);
        case 'switchChain': return this.switchChain(s, depth, ctx);
        case 'break': return [`${i}break${s.useLabel && s.target && s.target.label ? ' ' + s.target.label : ''};`];
        case 'continue': return [`${i}continue${s.useLabel && s.target && s.target.label ? ' ' + s.target.label : ''};`];
        case 'return': {
          if (ctx.lambda) return [`${i}return ${s.e ? this.expr(s.e, 0, ctx) : 'null'};`];
          if (!s.e) return [ctx.ret && ctx.ret !== 'void' ? `${i}return ${this.undefinedValue(ctx.ret)};` : `${i}return;`];
          if (ctx.ret === 'void') return [...this.exprStmt(s.e, depth, ctx), `${i}return;`];
          return [`${i}return ${this.expr(s.e, 0, ctx)};`];
        }
        case 'throw': return [`${i}throw ${this.expr(s.e, 0, ctx)};`];
        case 'try': {
          const out = [`${i}try {`, ...this.inner(s.block, depth, ctx)];
          if (s.catchBody) out.push(`${i}} catch (RuntimeException ${s.catchName}) {`, ...this.inner(s.catchBody, depth, ctx));
          if (s.fin) out.push(`${i}} finally {`, ...this.inner(s.fin, depth, ctx));
          if (!s.catchBody && !s.fin) out.push(`${i}} finally {`);
          out.push(`${i}}`);
          return out;
        }
        case 'labeled': return [`${i}${s.label}: {`, ...this.inner(s.body, depth, ctx), `${i}}`];
        case 'fns': return this.fnsHolder(s, depth, ctx);
        default: throw new Error(`JavaEmitter: statement ${s.k}`);
      }
    }

    lbl(s) { return s.label ? `${s.label}: ` : ''; }

    /** The statements of a nested body (a block's contents unwrapped). */
    inner(s, depth, ctx) {
      if (!s) return [];
      if (s.k === 'block') return this.stmts(s.body, depth + 1, ctx);
      return this.stmt(s, depth + 1, ctx);
    }

    local(s, depth, ctx) {
      const i = this.ind(depth);
      if (s.boxed) {
        const [ref, ctor] = this.refType(s.t);
        return [`${i}final ${ref} ${s.name} = new ${ctor}(${s.init ? this.expr(s.init, P_ASSIGN, ctx) : ''});`];
      }
      return [`${i}${this.type(s.t)} ${s.name}${s.init ? ' = ' + this.expr(s.init, P_ASSIGN, ctx) : ''};`];
    }

    refType(t) {
      if (t === 'int') return ['IntRef', 'IntRef'];
      if (t === 'long') return ['LongRef', 'LongRef'];
      if (t === 'double') return ['DoubleRef', 'DoubleRef'];
      if (t === 'boolean') return ['BoolRef', 'BoolRef'];
      return [`Ref<${this.type(t)}>`, `Ref<${this.type(t)}>`];
    }

    exprStmt(e, depth, ctx) {
      const i = this.ind(depth);
      if (e.k === 'letin') {
        const out = [`${i}{`];
        for (const b of e.binds) out.push(`${i}${this.indentUnit}${this.type(b.e.t)} ${b.name} = ${this.expr(b.e, P_ASSIGN, ctx)};`);
        out.push(...this.exprStmt(e.body, depth + 1, ctx));
        out.push(`${i}}`);
        return out;
      }
      if (e.k === 'stmtExpr') return this.stmt(e.stmt, depth, ctx);
      let x = e;
      while (x.k === 'cast') x = x.e;
      if (x.k === 'scall' && x.owner === 'Js' && x.name === 'seq') {
        // a, b in statement position: each for its effect
        return x.args.flatMap(a => this.exprStmt(a, depth, ctx));
      }
      if (x.k === 'call' || x.k === 'scall' || x.k === 'assign' || x.k === 'inc' || x.k === 'new') {
        if (x.k === 'new' && x.t !== 'void') return [`${i}${this.expr(x, 0, ctx)};`];
        return [`${i}${this.expr(x, 0, ctx)};`];
      }
      if (x.k === 'cond') return [`${i}if (${this.expr(x.c, 0, ctx)}) {`, ...this.exprStmt(x.a, depth + 1, ctx), `${i}} else {`, ...this.exprStmt(x.b, depth + 1, ctx), `${i}}`];
      if (x.k === 'lit' || x.k === 'name' || x.k === 'this' || x.k === 'sfield' || x.k === 'classref' || x.k === 'lambda') return [];
      return [`${i}Js.discard(${this.expr(this.boxed(x), 0, ctx)});`];
    }

    boxed(e) { return T.isPrim(e.t) ? { k: 'cast', e, t: T.box(e.t) } : e; }

    forStmt(s, depth, ctx) {
      const i = this.ind(depth);
      const init = s.init || [];
      const simple = init.length === 0 || (init.length === 1 && init[0].k === 'local' && !init[0].boxed) ||
        (init.every(x => x.k === 'local' && !x.boxed && x.t === init[0].t));
      const updates = (s.update || []).map(u => u.k === 'expr' ? u.e : null);
      const updatesOk = updates.every(u => u && (u.k === 'assign' || u.k === 'inc' || u.k === 'call' || u.k === 'scall'));
      const cond = s.c ? this.expr(s.c, 0, ctx) : '';
      const head = (initText) => `${i}${this.lbl(s)}for (${initText}; ${cond}; ${updatesOk ? updates.map(u => this.expr(u, 0, ctx)).join(', ') : ''}) {`;
      let body = this.inner(s.body, depth, ctx);
      if (!updatesOk && s.update && s.update.length) {
        // updates that are not Java expression statements run at the end of each iteration
        // (continue targets the loop: they are wrapped so continue still runs them)
        throw new Error('JavaEmitter: for-update is not an expression statement');
      }
      if (simple) {
        const initText = init.length === 0 ? '' : init[0].k === 'local'
          ? `${this.type(init[0].t)} ${init.map(x => `${x.name} = ${this.expr(x.init, P_ASSIGN, ctx)}`).join(', ')}`
          : '';
        return [head(initText), ...body, `${i}}`];
      }
      if (init.every(x => x.k === 'expr' && ['assign', 'inc', 'call', 'scall'].includes(x.e.k))) {
        return [head(init.map(x => this.expr(x.e, 0, ctx)).join(', ')), ...body, `${i}}`];
      }
      return [`${i}{`, ...this.stmts(init, depth + 1, ctx), head('').replace(i, i + this.indentUnit), ...body.map(l => this.indentUnit + l), `${i}${this.indentUnit}}`, `${i}}`];
    }

    switchStmt(s, depth, ctx) {
      const i = this.ind(depth);
      let disc = this.expr(s.disc, 0, ctx);
      if (s.guard) {
        const used = new Set(s.cases.filter(c => c.tests).flatMap(c => c.tests.map(t => t.v)));
        let impossible = -2147483648;
        while (used.has(impossible)) impossible++;
        disc = `${this.expr(s.guard, P_COND + 1, ctx)} ? ${this.expr(s.disc, P_COND, ctx)} : ${impossible}`;
      }
      const out = [`${i}${this.lbl(s)}switch (${disc}) {`];
      for (const c of s.cases) {
        if (c.tests) for (const t of c.tests) out.push(`${i}${this.indentUnit}case ${this.expr(t, 0, ctx)}:`);
        else out.push(`${i}${this.indentUnit}default:`);
        if (c.body.length) out.push(`${i}${this.indentUnit}{`, ...this.stmts(c.body, depth + 2, ctx), `${i}${this.indentUnit}}`);
      }
      out.push(`${i}}`);
      return out;
    }

    switchChain(s, depth, ctx) {
      const i = this.ind(depth);
      const out = [`${i}${s.label}: {`];
      for (const c of s.cases) {
        if (!c.body.length) continue;
        out.push(`${i}${this.indentUnit}if (${s.match} >= 0 && ${s.match} <= ${c.index}) {`, ...this.stmts(c.body, depth + 2, ctx), `${i}${this.indentUnit}}`);
      }
      out.push(`${i}}`);
      return out;
    }

    fnsHolder(s, depth, ctx) {
      const i = this.ind(depth);
      const out = [`${i}final var ${s.name} = new Object() {`];
      for (const m of s.decl.methods) {
        const inner = this.method(Object.assign({}, m, { static: false }), depth + 1, null, ctx).map(l => l.replace(/^(\s*)public /, '$1'));
        // `this` inside the holder's methods is the enclosing instance
        out.push(...inner);
      }
      out.push(`${i}};`);
      return out;
    }

    // ------------------------------------------------------------------ expressions

    /** An expression, parenthesized when its precedence is below minPrec. */
    expr(e, minPrec, ctx) {
      const [text, prec] = this.exprP(e, ctx);
      return prec < minPrec ? `(${text})` : text;
    }

    exprP(e, ctx) {
      switch (e.k) {
        case 'lit': return this.lit(e);
        case 'big': {
          const v = BigInt(e.v);
          if (v === 0n) return ['java.math.BigInteger.ZERO', P_POSTFIX];
          if (v === 1n) return ['java.math.BigInteger.ONE', P_POSTFIX];
          if (v >= -(2n ** 63n) && v < 2n ** 63n) return [`java.math.BigInteger.valueOf(${v === -(2n ** 63n) ? 'Long.MIN_VALUE' : v + 'L'})`, P_POSTFIX];
          return [`new java.math.BigInteger(${quote(v.toString())})`, P_POSTFIX];
        }
        case 'name': return [e.boxed ? `${e.name}.v` : e.name, P_PRIMARY];
        case 'this': return [ctx && ctx.inHolder && ctx.cls ? `${ctx.cls.name}.this` : 'this', P_PRIMARY];
        case 'super': return ['super', P_PRIMARY];
        case 'classref': return [e.name, P_PRIMARY];
        case 'classlit': return [`${e.name}.class`, P_POSTFIX];
        case 'field': return [`${this.expr(e.obj, P_POSTFIX, ctx)}.${e.name}`, P_POSTFIX];
        case 'sfield': return [`${this.owner(e.owner)}.${e.name}`, P_POSTFIX];
        case 'call': {
          if (e.name === '<init>') return [`super(${this.args(e.args, ctx)})`, P_POSTFIX];
          if (e.name === '<this>') return [`this(${this.args(e.args, ctx)})`, P_POSTFIX];
          if (!e.obj) return [`${e.name}(${this.args(e.args, ctx)})`, P_POSTFIX];
          return [`${this.expr(e.obj, P_POSTFIX, ctx)}.${e.name}(${this.args(e.args, ctx)})`, P_POSTFIX];
        }
        case 'scall': return [`${e.owner ? this.owner(e.owner) + '.' : ''}${e.name}(${this.args(e.args, ctx)})`, P_POSTFIX];
        case 'new': return [`new ${this.type(e.cls)}(${this.args(e.args, ctx)})`, P_POSTFIX];
        case 'jsarrayOf': {
          const et = T.elemOf(e.t);
          if (e.items.length === 0) return [`new ${this.type(e.t)}()`, P_POSTFIX];
          return [`JsArray.<${this.type(et)}>of(${this.args(e.items, ctx)})`, P_POSTFIX];
        }
        case 'uncheckedCast': return [`Js.<${this.type(e.t)}>cast(${this.expr(e.e, 0, ctx)})`, P_POSTFIX];
        case 'un': {
          const inner = this.expr(e.e, P_UNARY, ctx);
          return [`${e.op}${e.op === '-' && inner.startsWith('-') ? ' ' : ''}${inner}`, P_UNARY];
        }
        case 'bin': {
          const p = PREC[e.op];
          // left-associative: the right operand binds tighter
          return [`${this.expr(e.l, p, ctx)} ${e.op} ${this.expr(e.r, p + 1, ctx)}`, p];
        }
        case 'cond': return [`${this.expr(e.c, P_COND + 1, ctx)} ? ${this.expr(e.a, P_COND, ctx)} : ${this.expr(e.b, P_COND, ctx)}`, P_COND];
        case 'cast': {
          if (e.e.k === 'lit' && T.isNumeric(e.t) && T.isNumeric(e.e.t)) {
            let v = e.e.v;
            if (e.t === 'int') v = Number.isFinite(v) ? Number(BigInt.asIntN(32, BigInt(Math.trunc(v)))) : 0;
            else if (e.t === 'long') v = Number.isFinite(v) ? Math.trunc(v) : 0;
            return this.lit({ k: 'lit', v, t: e.t });
          }
          // widening a primitive happens implicitly in Java
          const target = this.type(e.t);
          return [`(${target}) ${this.expr(e.e, P_UNARY, ctx)}`, P_UNARY];
        }
        case 'assign': return [`${this.expr(e.target, P_POSTFIX, ctx)} = ${this.expr(e.v, P_ASSIGN, ctx)}`, P_ASSIGN];
        case 'inc': return e.prefix ? [`${e.op}${this.expr(e.target, P_UNARY, ctx)}`, P_UNARY] : [`${this.expr(e.target, P_POSTFIX, ctx)}${e.op}`, P_POSTFIX];
        case 'instanceof': return [`${this.expr(e.e, 10, ctx)} instanceof ${this.type(e.cls)}`, 9];
        case 'lambda': return [`(JsFn) ${e.params.map(p => p.name).join(', ')} -> ${this.lambdaBody(e, ctx)}`, P_ASSIGN];
        case 'letin': throw new Error('JavaEmitter: temporaries in expression position');
        case 'stmtExpr': throw new Error('JavaEmitter: statement in expression position');
        default: throw new Error(`JavaEmitter: expression ${e.k}`);
      }
    }

    lambdaBody(e, ctx) {
      const lctx = { cls: ctx && ctx.cls, ret: e.ret || 'void', lambda: true, inHolder: ctx && ctx.inHolder };
      this.prepareJumps(e.body);
      const lines = this.stmts(e.body, 1, lctx);
      if (this.canComplete(e.body)) lines.push(`${this.indentUnit}return null;`);
      return `{${this.nl}${lines.map(l => this.indentUnit.repeat(3) + l).join(this.nl)}${this.nl}${this.indentUnit.repeat(3)}}`;
    }

    args(list, ctx) {
      return list.map(a => {
        // a typed null keeps overload resolution unambiguous
        if (a.k === 'lit' && a.v === null && a.t && a.t !== 'null' && a.t !== 'Object') return `(${this.type(a.t)}) null`;
        return this.expr(a, P_ASSIGN, ctx);
      }).join(', ');
    }

    lit(e) {
      const v = e.v;
      if (v === null || v === undefined) return ['null', P_PRIMARY];
      switch (e.t) {
        case 'int': return [isMask(v) ? '0x' + v.toString(16).toUpperCase() : String(v), v < 0 ? P_UNARY : P_PRIMARY];
        case 'long': {
          if (v <= -9223372036854775808) return ['Long.MIN_VALUE', P_POSTFIX];
          const s = isMask(v) ? '0x' + BigInt(v).toString(16).toUpperCase() : BigInt(Math.trunc(v)).toString();
          return [`${s}L`, v < 0 ? P_UNARY : P_PRIMARY];
        }
        case 'double': return [dbl(v), (v < 0 || Object.is(v, -0)) && Number.isFinite(v) ? P_UNARY : P_PRIMARY];
        case 'boolean': return [v ? 'true' : 'false', P_PRIMARY];
        case 'String': return [this.stringLit(v), P_PRIMARY];
        default:
          if (v === null) return ['null', P_PRIMARY];
          if (typeof v === 'string') return [this.stringLit(v), P_PRIMARY];
          if (typeof v === 'boolean') return [v ? 'true' : 'false', P_PRIMARY];
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

  const exports = { JavaEmitter, quote };
  if (typeof module !== 'undefined' && module.exports) module.exports = exports;
  if (global) global.JavaEmitter = JavaEmitter;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
