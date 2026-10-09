/**
 * CTransformer.js - IL AST to C transformer
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: IL AST -> JavaScriptTransformer (the reference lowering of the IL
 * nodes) -> JavaScript AST -> C source on the runtime of CEmitter.js.
 *
 * C has no counterpart for JavaScript's dynamic values, so the generated code
 * computes on tagged values with JavaScript's semantics: numbers are doubles
 * with the ToInt32/ToUint32 bit operators, BigInt is an arbitrary precision
 * integer, strings are UTF-16, arrays, typed arrays, objects and closures are
 * heap objects (see the runtime in CEmitter.js). The IL already decided every
 * operation (OpCodes calls, typed array kinds, 64-bit BigInt arithmetic) and
 * JavaScriptTransformer spells those decisions as JavaScript; this transformer
 * compiles that JavaScript to C:
 *
 *  - every function, method, constructor and arrow function is a C function
 *    js_val f(js_func* __f, js_val __this, int __jsargc, js_val* __jsargv, js_val __nt)
 *  - a variable a nested function captures lives in a heap cell; the closure
 *    keeps pointers to the cells it uses (__f->env)
 *  - module-level names are C statics
 *  - classes are constructor functions with prototype objects; super calls and
 *    lookups go through the method's home object
 *  - exceptions are setjmp/longjmp frames; finally blocks run on every exit
 *  - operands are evaluated left to right (C leaves argument order open, so
 *    operands with side effects are sequenced through temporaries)
 *
 * The AlgorithmFramework classes come from a JavaScript rendition of
 * AlgorithmFramework.js compiled by this same transformer, and every OpCodes
 * method a program uses is compiled from OpCodes.js itself.
 */
(function (global) {
  'use strict';

  let CAST;
  if (typeof require !== 'undefined') CAST = require('./CAST.js');
  else CAST = global.CAST;

  function jsTransformerClass() {
    if (typeof require !== 'undefined') return require('./JavaScriptTransformer.js').JavaScriptTransformer;
    return global.JavaScriptTransformer;
  }
  function ilParserClass() {
    if (typeof require !== 'undefined') return require('../type-aware-transpiler.js').TypeAwareJSASTParser;
    return global.TypeAwareJSASTParser;
  }
  /** Run with console.log silenced (the parser reports its progress there) */
  function quiet(fn) {
    const log = console.log;
    console.log = () => {};
    try { return fn(); } finally { console.log = log; }
  }
  /** JavaScript source to the JavaScript AST JavaScriptTransformer makes of its IL */
  function toJsAst(source) {
    const Parser = ilParserClass();
    const JsT = jsTransformerClass();
    return quiet(() => new JsT({}).transform(new Parser(source).parse()));
  }

  // ========================[ C SPELLING ]========================
  /** A C identifier for a JavaScript name ($ and other characters spelled out) */
  function cIdent(name) {
    let s = String(name).replace(/[^A-Za-z0-9_]/g, c => c === '$' ? '_S_' : '_x' + c.charCodeAt(0).toString(16) + '_');
    if (/^[0-9]/.test(s)) s = '_' + s;
    return s;
  }
  /** A u"..." literal of the string's UTF-16 code units */
  function u16Literal(s) {
    let out = 'u"', lastHex = false;
    for (let i = 0; i < s.length; ++i) {
      const c = s.charCodeAt(i), ch = s[i];
      if (c >= 0x20 && c < 0x7F) {
        if (lastHex && /[0-9a-fA-F]/.test(ch)) out += '" u"';
        lastHex = false;
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '?') out += '\\?';
        else out += ch;
      } else if (ch === '\n') { out += '\\n'; lastHex = false; }
      else if (ch === '\t') { out += '\\t'; lastHex = false; }
      else if (ch === '\r') { out += '\\r'; lastHex = false; }
      else { out += '\\x' + c.toString(16); lastHex = true; }
    }
    return out + '"';
  }
  const strLit = s => `JS_S(${u16Literal(String(s))})`;
  const strRef = s => `JS_STR(${u16Literal(String(s))})`;
  const atom = s => `JS_ATOM(${u16Literal(String(s))})`;
  function numLit(v) {
    if (Number.isNaN(v)) return 'JS_D(NAN)';
    if (v === Infinity) return 'JS_D(INFINITY)';
    if (v === -Infinity) return 'JS_D(-INFINITY)';
    if (v === 0) return Object.is(v, -0) ? 'JS_D(-0.0)' : 'JS_D(0)';
    let t = String(v);
    if (/^-?\d+$/.test(t)) t += '.0';
    return `JS_D(${t})`;
  }
  /** Cook the raw text of a template literal (its escapes) */
  function cookTemplate(raw) {
    let out = '';
    for (let i = 0; i < raw.length; ++i) {
      const c = raw[i];
      if (c !== '\\') { out += c; continue; }
      const n = raw[++i];
      switch (n) {
        case 'n': out += '\n'; break;
        case 't': out += '\t'; break;
        case 'r': out += '\r'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'v': out += '\v'; break;
        case '0': out += '\0'; break;
        case 'x': out += String.fromCharCode(parseInt(raw.substr(i + 1, 2), 16)); i += 2; break;
        case 'u':
          if (raw[i + 1] === '{') { const e = raw.indexOf('}', i); out += String.fromCodePoint(parseInt(raw.slice(i + 2, e), 16)); i = e; }
          else { out += String.fromCharCode(parseInt(raw.substr(i + 1, 4), 16)); i += 4; }
          break;
        case '\r': if (raw[i + 1] === '\n') ++i; break;
        case '\n': break;
        default: out += n === undefined ? '' : n;
      }
    }
    return out;
  }

  // ========================[ SCOPES ]========================
  class FnCtx {
    constructor(parent, kind, node) {
      this.parent = parent;
      this.kind = kind; // module, function, arrow, method, ctor, fields
      this.node = node;
      this.free = [];   // captured variables of outer functions this function uses
      this.hasTry = false;
      this.thisVar = null;
      this.argsVar = null;
      this.cname = null;
      this.cls = null;  // class info for class members (shared environment)
      this.names = new Map();
    }
    get envLayout() { return this.cls ? this.cls.free : this.free; }
    /** A C local name unique in this function */
    uniqueName(base) {
      const n = (this.names.get(base) || 0) + 1;
      this.names.set(base, n);
      return n === 1 ? base : `${base}_${n}`;
    }
  }
  class Scope {
    constructor(parent, fn) { this.parent = parent; this.fn = fn; this.vars = new Map(); }
  }
  class Var {
    constructor(name, kind, fn, isModule) {
      this.name = name; this.kind = kind; this.fn = fn; this.isModule = isModule;
      this.captured = false; this.assigned = false; this.funcDecl = null; this.cname = null; this.cell = null;
    }
    get boxed() { return !this.isModule && (this.captured || this.fn.hasTry); }
  }

  const SKIP_KEYS = new Set(['jsDoc', 'nodeType', 'scoped']);

  // ========================[ TRANSFORMER ]========================
  class CTransformer {
    /**
     * @param {object} options - { className, namespace }
     */
    constructor(options = {}) {
      this.options = options;
      this.prefix = cIdent(options.className || options.namespace || 'module');
    }

    /**
     * IL AST to a C file: the runtime, the framework, the OpCodes methods the
     * program uses and the program as a module.
     * @param {object} ilAst - IL AST (Program)
     * @returns {object} CAST.CFile
     */
    transform(ilAst) {
      const JsT = jsTransformerClass();
      const unit = quiet(() => new JsT({}).transform(ilAst));
      // OpCodes calls go straight to the members compiled from OpCodes.js
      const members = opcodesMembers();
      const functionNames = new Set([...members.keys()].filter(n => members.get(n) && members.get(n).nodeType === 'ArrowFunction'));
      const gen = new ModuleCompiler(this.prefix, `${this.prefix}_init`, { directOpcodes: functionNames });
      const moduleCode = gen.compileUnit(unit);
      const opc = opcodesFor(gen.opcodesUsed);
      return new CAST.CFile([
        new CAST.CRaw(frameworkCode()),
        new CAST.CRaw(opc.code),
        new CAST.CRaw(gen.moduleText(moduleCode, opc.registrations))
      ]);
    }
  }

  // ========================[ MODULE COMPILER ]========================
  class ModuleCompiler {
    /**
     * @param {string} prefix - C name prefix of this module's statics and functions
     * @param {string} initName - name of the module initialiser
     * @param {object} [opts] - { opcodesUnit: true when compiling OpCodes members, framework: true }
     */
    constructor(prefix, initName, opts = {}) {
      this.P = prefix;
      this.initName = initName;
      this.opts = opts;
      this.functions = [];     // C function definitions
      this.prototypes = [];
      this.statics = [];       // module statics
      this.fnCounter = 0;
      this.tmpCounter = 0;
      this.labelCounter = 0;
      this.resolved = new Map(); // node -> Var | null (global)
      this.opcodesUsed = new Set();
      this.directOpcodes = opts.directOpcodes || null; // names compiled as C functions
    }

    // ------------------------------------------------ analysis
    analyzeUnit(unit) {
      const mod = new FnCtx(null, 'module', unit);
      this.module = mod;
      const scope = new Scope(null, mod);
      this.declareBlock(scope, unit.statements, true);
      for (const s of flat(unit.statements)) this.aStmt(s, scope);
      return mod;
    }
    declare(scope, name, kind, node) {
      const fnScope = scope.fn.kind === 'module' && scope.parent === null;
      let v = scope.vars.get(name);
      if (v) { if (node && kind === 'function') v.funcDecl = node; return v; }
      v = new Var(name, kind, scope.fn, fnScope);
      if (node && kind === 'function') v.funcDecl = node;
      if (v.isModule) v.cname = `${this.P}_${cIdent(name)}`;
      else {
        v.cname = scope.fn.uniqueName(`v_${cIdent(name)}`);
        v.cell = 'c' + v.cname.slice(1);
      }
      scope.vars.set(name, v);
      return v;
    }
    /** Hoist the declarations of a block; a function body also hoists its var declarations */
    declareBlock(scope, statements, functionBody) {
      for (const s of flat(statements)) {
        if (!s) continue;
        if (s.nodeType === 'VariableDeclaration' && s.kind !== 'var') this.declare(scope, s.name, s.kind);
        else if (s.nodeType === 'Function') this.declare(scope, s.name, 'function', s);
        else if (s.nodeType === 'Class') this.declare(scope, s.name, 'class');
      }
      if (functionBody) {
        const vars = [];
        const visit = (n) => {
          if (!n || typeof n !== 'object') return;
          if (Array.isArray(n)) { n.forEach(visit); return; }
          if (n.nodeType === 'VariableDeclaration' && n.kind === 'var') vars.push(n.name);
          if (n.nodeType === 'Function' || n.nodeType === 'ArrowFunction' || n.nodeType === 'Class' || n.nodeType === 'Method' || n.nodeType === 'Constructor') return;
          for (const k in n) if (!SKIP_KEYS.has(k) && !k.startsWith('__')) visit(n[k]);
        };
        visit(statements);
        for (const name of vars) if (!scope.vars.has(name)) this.declare(scope, name, 'var');
      }
    }
    lookup(scope, name) {
      for (let s = scope; s; s = s.parent) if (s.vars.has(name)) return s.vars.get(name);
      return null;
    }
    /** A use of variable v in function fn: a captured variable joins the environments in between */
    use(v, fn) {
      if (!v || v.isModule || v.fn === fn) return;
      v.captured = true;
      for (let f = fn; f && f !== v.fn; f = f.parent) if (!f.free.includes(v)) f.free.push(v);
    }
    pseudo(fn, which) {
      // this/arguments of the nearest non-arrow function
      let f = fn;
      while (f && f.kind === 'arrow') f = f.parent;
      if (!f || f.kind === 'module') return null;
      const key = which === 'this' ? 'thisVar' : 'argsVar';
      if (!f[key]) {
        const v = new Var(which, which, f, false);
        v.cname = which === 'this' ? '__this' : f.uniqueName('v_arguments');
        v.cell = which === 'this' ? 'c___this' : 'c' + v.cname.slice(1);
        f[key] = v;
      }
      this.use(f[key], fn);
      return f[key];
    }
    aStmt(s, scope) {
      if (!s) return;
      if (Array.isArray(s)) { for (const x of s) this.aStmt(x, scope); return; }
      switch (s.nodeType) {
        case 'Block': {
          const inner = new Scope(scope, scope.fn);
          this.declareBlock(inner, s.statements, false);
          for (const x of flat(s.statements)) this.aStmt(x, inner);
          s.__scope = inner;
          return;
        }
        case 'VariableDeclaration': {
          if (s.initializer) this.aExpr(s.initializer, scope);
          const v = s.kind === 'var' ? this.lookup(scope, s.name) : (scope.vars.get(s.name) || this.declare(scope, s.name, s.kind));
          this.resolved.set(s, v);
          return;
        }
        case 'ExpressionStatement': this.aExpr(s.expression, scope); return;
        case 'Return': if (s.expression) this.aExpr(s.expression, scope); return;
        case 'Throw': this.aExpr(s.expression, scope); return;
        case 'If': this.aExpr(s.condition, scope); this.aStmt(s.thenBranch, scope); if (s.elseBranch) this.aStmt(s.elseBranch, scope); return;
        case 'For': {
          const inner = new Scope(scope, scope.fn);
          s.__scope = inner;
          const init = s.initializer;
          if (init) {
            const decls = Array.isArray(init) ? init : [init];
            for (const d of decls) {
              if (d && d.nodeType === 'VariableDeclaration') {
                if (d.initializer) this.aExpr(d.initializer, inner);
                const v = d.kind === 'var' ? this.lookup(scope, d.name) : this.declare(inner, d.name, d.kind);
                this.resolved.set(d, v);
              } else this.aExpr(d, inner);
            }
          }
          if (s.condition) this.aExpr(s.condition, inner);
          if (s.incrementor) this.aExpr(s.incrementor, inner);
          this.aStmt(s.body, inner);
          return;
        }
        case 'ForOf': {
          this.aExpr(s.collection, scope);
          const inner = new Scope(scope, scope.fn);
          s.__scope = inner;
          s.__var = this.declare(inner, s.variableName, 'const');
          this.aStmt(s.body, inner);
          return;
        }
        case 'While': this.aExpr(s.condition, scope); this.aStmt(s.body, scope); return;
        case 'DoWhile': this.aStmt(s.body, scope); this.aExpr(s.condition, scope); return;
        case 'Switch': {
          this.aExpr(s.expression, scope);
          const inner = new Scope(scope, scope.fn);
          s.__scope = inner;
          this.declareBlock(inner, s.cases.flatMap(c => c.statements), false);
          for (const c of s.cases) {
            if (c.label) this.aExpr(c.label, inner);
            for (const x of flat(c.statements)) this.aStmt(x, inner);
          }
          return;
        }
        case 'Break': case 'Continue': return;
        case 'TryCatch': {
          scope.fn.hasTry = true;
          this.aStmt(s.tryBlock, scope);
          for (const cc of s.catchClauses || []) {
            const inner = new Scope(scope, scope.fn);
            cc.__scope = inner;
            if (cc.variableName) cc.__var = this.declare(inner, cc.variableName, 'let');
            this.aStmt(cc.body, inner);
          }
          if (s.finallyBlock) this.aStmt(s.finallyBlock, scope);
          return;
        }
        case 'Function': {
          const v = this.lookup(scope, s.name);
          this.resolved.set(s, v);
          s.__fn = this.aFunction(s, scope, 'function', s.parameters, s.body, s.name);
          return;
        }
        case 'Class': {
          const v = scope.vars.get(s.name) || this.declare(scope, s.name, 'class');
          this.resolved.set(s, v);
          this.aClass(s, scope);
          return;
        }
        case 'StaticBlock': this.aStmt(s.body, scope); return;
        default:
          // an expression in statement position
          this.aExpr(s, scope);
      }
    }
    aFunction(node, scope, kind, params, body, name, cls) {
      const fn = new FnCtx(scope.fn, kind, node);
      fn.cls = cls || null;
      fn.cname = `${this.P}_f${++this.fnCounter}_${cIdent(name || 'anonymous')}`;
      const fscope = new Scope(scope, fn);
      fn.scope = fscope;
      fn.params = [];
      for (const p of params || []) {
        if (p.defaultValue) this.aExpr(p.defaultValue, fscope);
        const v = this.declare(fscope, p.name, 'param');
        fn.params.push({ v, node: p });
      }
      if (body && body.nodeType === 'Block') {
        this.declareBlock(fscope, body.statements, true);
        for (const x of flat(body.statements)) this.aStmt(x, fscope);
      } else if (body) this.aExpr(body, fscope);
      node.__fn = fn;
      return fn;
    }
    aClass(node, scope) {
      if (node.baseClass) this.aExpr(node.baseClass, scope);
      const cls = { free: [], node, members: [] };
      node.__cls = cls;
      const fields = (node.members || []).filter(m => m.nodeType === 'Property' && !m.isStatic);
      for (const m of node.members || []) {
        if (m.nodeType === 'Constructor') cls.ctor = this.aFunction(m, scope, 'ctor', m.parameters, m.body, node.name + '_ctor', cls);
        else if (m.nodeType === 'Method') cls.members.push(this.aFunction(m, scope, 'method', m.parameters, m.body, `${node.name}_${m.name}`, cls));
        else if (m.nodeType === 'Property' && m.isStatic) { if (m.initializer) this.aStatic(m.initializer, scope); }
        else if (m.nodeType === 'StaticBlock') this.aStatic(m.body, scope);
      }
      if (fields.length) {
        const fake = { nodeType: 'Fields' };
        const fn = new FnCtx(scope.fn, 'fields', fake);
        fn.cls = cls;
        fn.cname = `${this.P}_f${++this.fnCounter}_${cIdent(node.name || 'anonymous')}_fields`;
        const fscope = new Scope(scope, fn);
        for (const f of fields) if (f.initializer) this.aExpr(f.initializer, fscope);
        cls.fields = fn;
      }
      // the class's members share one environment
      const all = [cls.ctor, cls.fields, ...cls.members].filter(Boolean);
      for (const f of all) for (const v of f.free) if (!cls.free.includes(v)) cls.free.push(v);
    }
    aStatic(node, scope) {
      // static initialisers run where the class is created, with this = the class
      const saved = this.staticThis;
      this.staticThis = true;
      if (node.nodeType === 'Block') this.aStmt(node, scope); else this.aExpr(node, scope);
      this.staticThis = saved;
    }
    aExpr(e, scope, receiver) {
      if (!e || typeof e !== 'object') return;
      if (Array.isArray(e)) { for (const x of e) this.aExpr(x, scope); return; }
      switch (e.nodeType) {
        case 'Identifier': {
          const v = this.lookup(scope, e.name);
          if (v) { this.resolved.set(e, v); this.use(v, scope.fn); }
          else if (e.name === 'arguments') { const a = this.pseudo(scope.fn, 'arguments'); this.resolved.set(e, a); }
          else this.resolved.set(e, null);
          // OpCodes as a value (not the receiver of a member): every member may be used
          if (e.name === 'OpCodes' && !v && !receiver) this.noteOpcodes(null);
          return;
        }
        case 'This': {
          if (this.staticThis) { e.__static = true; return; }
          const v = this.pseudo(scope.fn, 'this');
          this.resolved.set(e, v);
          return;
        }
        case 'Super': {
          // super needs this (and the home object through __f)
          const v = this.pseudo(scope.fn, 'this');
          this.resolved.set(e, v);
          return;
        }
        case 'Assignment': {
          this.aExpr(e.target, scope);
          this.aExpr(e.value, scope);
          if (e.target && e.target.nodeType === 'Identifier') { const v = this.resolved.get(e.target); if (v) v.assigned = true; }
          this.markAssignedPattern(e.target);
          return;
        }
        case 'UnaryExpression':
          this.aExpr(e.operand, scope);
          if ((e.operator === '++' || e.operator === '--') && e.operand && e.operand.nodeType === 'Identifier') { const v = this.resolved.get(e.operand); if (v) v.assigned = true; }
          return;
        case 'Call': {
          if (e.calleeExpression) this.aExpr(e.calleeExpression, scope);
          else if (e.target) {
            this.aExpr(e.target, scope, true);
            if (e.target.nodeType === 'Identifier' && e.target.name === 'OpCodes' && !this.resolved.get(e.target)) this.noteOpcodes(e.methodName);
            if (e.target.nodeType === 'Super') { const v = this.pseudo(scope.fn, 'this'); this.resolved.set(e.target, v); }
          } else if (e.methodName === 'super') {
            const v = this.pseudo(scope.fn, 'this');
            e.__this = v;
          } else {
            const v = this.lookup(scope, e.methodName);
            this.resolved.set(e, v);
            if (v) this.use(v, scope.fn);
          }
          this.aExpr(e.arguments, scope);
          return;
        }
        case 'New': {
          if (typeof e.className === 'string') {
            const first = e.className.split('.')[0];
            const v = this.lookup(scope, first);
            this.resolved.set(e, v);
            if (v) this.use(v, scope.fn);
            if (first === 'OpCodes' && !v) this.noteOpcodes(e.className.split('.')[1] || null);
          } else this.aExpr(e.className, scope);
          this.aExpr(e.arguments, scope);
          return;
        }
        case 'MemberAccess':
          this.aExpr(e.target, scope, true);
          if (e.target && e.target.nodeType === 'Identifier' && e.target.name === 'OpCodes' && !this.resolved.get(e.target)) this.noteOpcodes(e.member);
          return;
        case 'ArrowFunction': {
          const kind = e.isFunctionExpression ? 'function' : 'arrow';
          this.aFunction(e, scope, kind, e.parameters, e.body, e.__name || (kind === 'arrow' ? 'arrow' : 'function'));
          return;
        }
        case 'Class': this.aClass(e, scope); return;
        case 'ObjectLiteral':
          for (const p of e.properties) {
            if (p.value && p.value.nodeType === 'ArrowFunction' && !p.spread) p.value.__name = String(p.key);
            this.aExpr(p.value, scope);
          }
          return;
        case 'TemplateLiteral': for (const p of e.parts) if (p.expression) this.aExpr(p.expression, scope); return;
        case 'Literal': case 'JSDoc': return;
        default:
          for (const k in e) if (!SKIP_KEYS.has(k) && !k.startsWith('__') && e[k] && typeof e[k] === 'object') this.aExpr(e[k], scope);
      }
    }
    markAssignedPattern(t) {
      if (!t) return;
      if (t.nodeType === 'ArrayLiteral') for (const el of t.elements) { if (el && el.nodeType === 'Identifier') { const v = this.resolved.get(el); if (v) v.assigned = true; } }
      if (t.nodeType === 'ObjectLiteral') for (const p of t.properties) { if (p.value && p.value.nodeType === 'Identifier') { const v = this.resolved.get(p.value); if (v) v.assigned = true; } }
    }
    noteOpcodes(name) { this.opcodesUsed.add(name === null ? '*' : name); }

    // ------------------------------------------------ generation helpers
    // (not __ names: __k8 and the like are predefined macros)
    tmp(p = 't') { return `jt_${p}${++this.tmpCounter}`; }
    label(p) { return `jl_${p}${++this.labelCounter}`; }
    /** The value of variable v from the current function */
    access(v) {
      if (v.isModule) return v.cname;
      if (v.fn === this.fn) {
        if (v.kind === 'this') return '__this';
        return v.boxed ? `(*${v.cell})` : v.cname;
      }
      const k = this.fn.envLayout.indexOf(v);
      if (k < 0) throw new Error(`C: '${v.name}' is not in the environment of ${this.fn.cname}`);
      return `(*__f->env[${k}])`;
    }
    /** The cell of captured variable v, for a closure's environment */
    cellRef(v) {
      if (v.fn === this.fn) {
        if (v.kind === 'this') return 'c___this';
        if (!v.boxed) throw new Error(`C: '${v.name}' is captured but not boxed`);
        return v.cell;
      }
      const k = this.fn.envLayout.indexOf(v);
      if (k < 0) throw new Error(`C: '${v.name}' is not in the environment of ${this.fn.cname}`);
      return `__f->env[${k}]`;
    }
    envArray(layout) {
      if (!layout.length) return '0, NULL';
      return `${layout.length}, (js_val*[]){ ${layout.map(v => this.cellRef(v)).join(', ')} }`;
    }
    thisExpr(e) {
      if (e && e.__static) return this.staticThisExpr || 'JS_U';
      const v = this.resolved.get(e);
      if (!v) return 'JS_U';
      return this.access(v);
    }
    homeExpr() { return this.fn.kind === 'module' ? 'NULL' : '__f->home'; }

    // ------------------------------------------------ expressions
    // An expression compiles to { c, pure, lit }: pure when it has no side
    // effects (reads only), lit when it is a constant.
    /**
     * Sequence operands left to right: when any has side effects, each goes
     * into a temporary first.
     * @returns {{pre: string, refs: string[]}}
     */
    sequence(parts) {
      const needs = parts.filter(p => !p.lit).length > 1 && parts.some(p => !p.pure);
      if (!needs) return { pre: '', refs: parts.map(p => p.c) };
      let pre = '';
      const refs = parts.map(p => {
        if (p.lit) return p.c;
        const t = this.tmp();
        pre += `js_val ${t} = ${p.c}; `;
        return t;
      });
      return { pre, refs };
    }
    wrap(pre, c) { return pre ? `({ ${pre}${c}; })` : c; }
    argList(refs) { return refs.length ? `${refs.length}, (js_val[]){ ${refs.join(', ')} }` : '0, NULL'; }
    hasSpread(args) { return (args || []).some(a => a && a.nodeType === 'SpreadElement'); }
    /** Arguments with spreads as a runtime array expression */
    spreadArray(items) {
      const a = this.tmp('a');
      let code = `js_arr* ${a} = js_arr_alloc(0, ${items.length}); `;
      for (const it of items) {
        if (it && it.nodeType === 'SpreadElement') code += `js_arr_push_spread(${a}, ${this.expr(it.argument).c}); `;
        else code += `js_arr_push1(${a}, ${this.expr(it).c}); `;
      }
      return `({ ${code}JS_O(${a}); })`;
    }
    expr(e) {
      if (!e) return { c: 'JS_U', pure: true, lit: true };
      switch (e.nodeType) {
        case 'Literal': return this.literal(e);
        case 'Identifier': return this.identifier(e);
        case 'This': return { c: this.thisExpr(e), pure: true };
        case 'Parenthesized': return this.expr(e.expression);
        case 'ChainExpression': return this.expr(e.expression);
        case 'BinaryExpression': return this.binary(e);
        case 'UnaryExpression': return this.unary(e);
        case 'Assignment': return this.assign(e);
        case 'MemberAccess': return this.member(e);
        case 'ElementAccess': return this.element(e);
        case 'Call': return this.call(e);
        case 'New': return this.newExpr(e);
        case 'ArrayLiteral': return this.arrayLiteral(e);
        case 'ObjectLiteral': return this.objectLiteral(e);
        case 'Conditional': {
          const c = this.cond(e.condition), a = this.expr(e.trueExpression), b = this.expr(e.falseExpression);
          return { c: `(${c} ? ${a.c} : ${b.c})`, pure: a.pure && b.pure && !c.includes('({') };
        }
        case 'ArrowFunction': return { c: this.closure(e.__fn, e.isFunctionExpression ? 'JF_CTOR' : 'JF_ARROW', e.__fn.kind === 'arrow' ? this.homeExpr() : 'NULL'), pure: true };
        case 'TemplateLiteral': return this.template(e);
        case 'SequenceExpression': {
          const parts = e.expressions.map(x => this.expr(x).c);
          const last = parts.pop();
          return { c: `(${parts.map(p => `(void)(${p})`).join(', ')}${parts.length ? ', ' : ''}${last})` };
        }
        case 'DeleteExpression': return this.deleteExpr(e.argument);
        case 'Class': return { c: this.classValue(e) };
        case 'SpreadElement': throw new Error('C: a spread element outside a call or array');
        case 'Super': return { c: this.thisExpr(e), pure: true };
        // generators and async functions have no C counterpart here: reaching one throws
        case 'YieldExpression': case 'AwaitExpression': return { c: `js_unsupported("${e.nodeType === 'YieldExpression' ? 'yield' : 'await'}")` };
        default: throw new Error(`C: no translation for ${e.nodeType}`);
      }
    }
    literal(e) {
      switch (e.literalType) {
        case 'number': return { c: numLit(Number(e.value)), pure: true, lit: true };
        case 'string': return { c: strLit(e.value), pure: true, lit: true };
        case 'boolean': return { c: e.value ? 'JS_TRUE' : 'JS_FALSE', pure: true, lit: true };
        case 'null': return { c: 'JS_NULL', pure: true, lit: true };
        case 'undefined': return { c: 'JS_U', pure: true, lit: true };
        case 'bigint': return { c: `JS_BIG("${BigInt(e.value).toString()}")`, pure: true, lit: true };
        case 'regex': return { c: `js_regexp_new_val(${strRef(e.pattern)}, ${strRef(e.flags || '')})`, pure: true };
        default:
          if (typeof e.value === 'number') return { c: numLit(e.value), pure: true, lit: true };
          if (typeof e.value === 'string') return { c: strLit(e.value), pure: true, lit: true };
          if (typeof e.value === 'bigint') return { c: `JS_BIG("${e.value.toString()}")`, pure: true, lit: true };
          return { c: 'JS_U', pure: true, lit: true };
      }
    }
    globalRef(name) {
      switch (name) {
        case 'undefined': return { c: 'JS_U', pure: true, lit: true };
        case 'NaN': return { c: 'JS_D(NAN)', pure: true, lit: true };
        case 'Infinity': return { c: 'JS_D(INFINITY)', pure: true, lit: true };
        case 'globalThis': return { c: 'JS_O(js_global)', pure: true };
        case 'OpCodes': return { c: 'js_opcodes', pure: true };
      }
      if (!/^[A-Za-z_$][\w$]*$/.test(name)) throw new Error(`C: unsupported expression '${name}'`);
      return { c: `JS_GLOBAL_CACHED(${u16Literal(name)})`, pure: true };
    }
    identifier(e) {
      const v = this.resolved.get(e);
      if (v) return { c: this.access(v), pure: true };
      return this.globalRef(e.name);
    }
    /** An expression whose value is unused: x++ needs no copy of the old value */
    discarded(e) {
      if (e && e.nodeType === 'UnaryExpression' && (e.operator === '++' || e.operator === '--') && !e.isPrefix)
        return this.update(Object.assign({}, e, { isPrefix: true })).c;
      if (e && e.nodeType === 'SequenceExpression') return e.expressions.map(x => `(void)(${this.discarded(x)})`).join(', ');
      return this.expr(e).c;
    }
    /** A C condition (an int) for a JavaScript expression */
    cond(e) {
      if (e && e.nodeType === 'BinaryExpression' && (e.operator === '&&' || e.operator === '||')) return `(${this.cond(e.left)} ${e.operator} ${this.cond(e.right)})`;
      if (e && e.nodeType === 'UnaryExpression' && e.operator === '!') return `(!${this.cond(e.operand)})`;
      if (e && e.nodeType === 'Parenthesized') return this.cond(e.expression);
      return `js_truthy(${this.expr(e).c})`;
    }
    binary(e) {
      const op = e.operator;
      if (op === '&&' || op === '||' || op === '??') {
        const l = this.expr(e.left), r = this.expr(e.right), t = this.tmp();
        const test = op === '&&' ? `js_truthy(${t})` : op === '||' ? `!js_truthy(${t})` : `JS_IS_NULLISH(${t})`;
        return { c: `({ js_val ${t} = ${l.c}; ${test} ? ${r.c} : ${t}; })`, pure: l.pure && r.pure };
      }
      const fns = {
        '+': 'js_add', '-': 'js_sub', '*': 'js_mul', '/': 'js_div', '%': 'js_mod', '**': 'js_pow',
        '&': 'js_band', '|': 'js_bor', '^': 'js_bxor', '<<': 'js_shl', '>>': 'js_sar', '>>>': 'js_shr',
        '==': 'js_eq', '!=': 'js_ne', '===': 'js_seq', '!==': 'js_sne', '<': 'js_lt', '>': 'js_gt', '<=': 'js_le', '>=': 'js_ge',
        'instanceof': 'js_instanceof', 'in': 'js_in'
      };
      const fn = fns[op];
      if (!fn) throw new Error(`C: unsupported operator ${op}`);
      // long + chains (tables spelled as concatenations) stay shallow: fold them iteratively
      const l = this.expr(e.left), r = this.expr(e.right);
      const s = this.sequence([l, r]);
      return { c: this.wrap(s.pre, `${fn}(${s.refs[0]}, ${s.refs[1]})`), pure: l.pure && r.pure && op !== 'instanceof' && op !== 'in', lit: l.lit && r.lit && op !== 'instanceof' && op !== 'in' && op !== '+' };
    }
    unary(e) {
      const op = e.operator;
      if (op === '++' || op === '--') return this.update(e);
      if (op === 'typeof') {
        if (e.operand && e.operand.nodeType === 'Identifier' && !this.resolved.get(e.operand) && !['undefined', 'NaN', 'Infinity', 'globalThis', 'OpCodes'].includes(e.operand.name))
          return { c: `js_global_typeof(${atom(e.operand.name)})`, pure: true };
        return { c: `js_typeof(${this.expr(e.operand).c})`, pure: true };
      }
      if (op === 'delete') return this.deleteExpr(e.operand);
      const a = this.expr(e.operand);
      switch (op) {
        case '-': return { c: `js_neg(${a.c})`, pure: a.pure, lit: a.lit };
        case '+': return { c: `js_pos(${a.c})`, pure: a.pure };
        case '!': return { c: `js_not(${a.c})`, pure: a.pure };
        case '~': return { c: `js_bnot(${a.c})`, pure: a.pure, lit: a.lit };
        case 'void': return { c: `((void)(${a.c}), JS_U)`, pure: a.pure };
        default: throw new Error(`C: unsupported unary operator ${op}`);
      }
    }
    deleteExpr(t) {
      if (t && t.nodeType === 'MemberAccess') return { c: `js_delete(${this.expr(t.target).c}, ${strLit(t.member)})` };
      if (t && t.nodeType === 'ElementAccess') {
        const o = this.expr(t.target), k = this.expr(t.index), s = this.sequence([o, k]);
        return { c: this.wrap(s.pre, `js_delete(${s.refs[0]}, ${s.refs[1]})`) };
      }
      return { c: 'JS_TRUE', pure: true };
    }
    /** A place: { get, set(v), pre } with the object and key evaluated once into temporaries */
    place(t, once) {
      if (t.nodeType === 'Identifier') {
        const v = this.resolved.get(t);
        if (v) { const a = this.access(v); return { pre: '', get: a, set: x => `(${a} = ${x})` }; }
        const name = t.name;
        return { pre: '', get: this.globalRef(name).c, set: x => `js_global_set(${atom(name)}, ${x})` };
      }
      if (t.nodeType === 'MemberAccess') {
        if (t.target && t.target.nodeType === 'Super') {
          const self = this.thisExpr(t.target), k = atom(t.member);
          return { pre: '', get: `js_super_get(__f, ${self}, ${k})`, set: x => `js_super_set(__f, ${self}, ${k}, ${x})` };
        }
        const o = this.expr(t.target);
        let pre = '', oref = o.c;
        if (once || !o.pure) { oref = this.tmp('o'); pre = `js_val ${oref} = ${o.c}; `; }
        const k = atom(t.member);
        return { pre, get: `js_get(${oref}, ${k})`, set: x => `js_set(${oref}, ${k}, ${x})` };
      }
      if (t.nodeType === 'ElementAccess') {
        const o = this.expr(t.target), k = this.expr(t.index);
        let pre = '', oref = o.c, kref = k.c;
        if (once || !o.pure || !k.pure) {
          oref = this.tmp('o'); pre += `js_val ${oref} = ${o.c}; `;
          if (!k.lit) { kref = this.tmp('k'); pre += `js_val ${kref} = ${k.c}; `; }
        }
        return { pre, get: `js_getv(${oref}, ${kref})`, set: x => `js_setv(${oref}, ${kref}, ${x})` };
      }
      if (t.nodeType === 'Parenthesized') return this.place(t.expression, once);
      throw new Error(`C: cannot assign to ${t.nodeType}`);
    }
    assign(e) {
      const op = e.operator;
      const t = e.target;
      if (t.nodeType === 'ArrayLiteral' || t.nodeType === 'ObjectLiteral') return this.destructure(t, e.value);
      if (op === '=') {
        const v = this.expr(e.value);
        if (t.nodeType === 'Identifier') { const p = this.place(t); return { c: p.set(v.c) }; }
        // the target's object and key come first
        const p = this.place(t, !v.pure);
        return { c: this.wrap(p.pre, p.set(v.c)) };
      }
      const base = op.slice(0, -1);
      const p = this.place(t, true);
      if (base === '&&' || base === '||' || base === '??') {
        const cur = this.tmp(), v = this.expr(e.value);
        const test = base === '&&' ? `js_truthy(${cur})` : base === '||' ? `!js_truthy(${cur})` : `JS_IS_NULLISH(${cur})`;
        return { c: `({ ${p.pre}js_val ${cur} = ${p.get}; ${test} ? ${p.set(v.c)} : ${cur}; })` };
      }
      const fns = { '+': 'js_add', '-': 'js_sub', '*': 'js_mul', '/': 'js_div', '%': 'js_mod', '**': 'js_pow', '&': 'js_band', '|': 'js_bor', '^': 'js_bxor', '<<': 'js_shl', '>>': 'js_sar', '>>>': 'js_shr' };
      const fn = fns[base];
      if (!fn) throw new Error(`C: unsupported assignment operator ${op}`);
      const v = this.expr(e.value);
      if (v.pure) return { c: this.wrap(p.pre, p.set(`${fn}(${p.get}, ${v.c})`)) };
      const cur = this.tmp();
      return { c: `({ ${p.pre}js_val ${cur} = ${p.get}; ${p.set(`${fn}(${cur}, ${v.c})`)}; })` };
    }
    destructure(t, valueNode) {
      const src = this.tmp('d');
      let code = `js_val ${src} = ${this.expr(valueNode).c}; `;
      if (t.nodeType === 'ArrayLiteral') {
        t.elements.forEach((el, i) => {
          if (!el || (el.nodeType === 'Literal' && el.literalType === 'undefined')) return;
          const p = this.place(el);
          code += `${p.pre}${p.set(`js_getv(${src}, JS_D(${i}))`)}; `;
        });
      } else {
        for (const prop of t.properties) {
          const p = this.place(prop.value);
          code += `${p.pre}${p.set(`js_get(${src}, ${atom(prop.key)})`)}; `;
        }
      }
      return { c: `({ ${code}${src}; })` };
    }
    update(e) {
      const inc = e.operator === '++' ? 'js_inc' : 'js_dec';
      const p = this.place(e.operand, true);
      if (e.isPrefix) return { c: this.wrap(p.pre, p.set(`${inc}(${p.get})`)) };
      const old = this.tmp();
      return { c: `({ ${p.pre}js_val ${old} = js_tonum_update(${p.get}); ${p.set(`${inc}(${old})`)}; ${old}; })` };
    }
    member(e) {
      if (e.target && e.target.nodeType === 'Super') return { c: `js_super_get(__f, ${this.thisExpr(e.target)}, ${atom(e.member)})` };
      const o = this.expr(e.target);
      if (e.isOptional) {
        const t = this.tmp();
        return { c: `({ js_val ${t} = ${o.c}; JS_IS_NULLISH(${t}) ? JS_U : js_get(${t}, ${atom(e.member)}); })`, pure: o.pure };
      }
      return { c: `js_get(${o.c}, ${atom(e.member)})`, pure: o.pure };
    }
    element(e) {
      const o = this.expr(e.target), k = this.expr(e.index);
      const s = this.sequence([o, k]);
      return { c: this.wrap(s.pre, `js_getv(${s.refs[0]}, ${s.refs[1]})`), pure: o.pure && k.pure };
    }
    /** Call arguments: { pre, list } with a list for (argc, argv), or an array expression when spread */
    callArgs(args, leading = []) {
      if (this.hasSpread(args)) {
        const lead = leading.map(x => x);
        const s = this.sequence(lead);
        return { pre: s.pre, refs: s.refs, spread: this.spreadArray(args) };
      }
      const parts = [...leading, ...(args || []).map(a => this.expr(a))];
      const s = this.sequence(parts);
      return { pre: s.pre, refs: s.refs.slice(0, leading.length), list: this.argList(s.refs.slice(leading.length)) };
    }
    call(e) {
      const args = e.arguments || [];
      if (e.calleeExpression) {
        const f = this.expr(e.calleeExpression);
        const a = this.callArgs(args, [f]);
        return { c: this.wrap(a.pre, a.spread ? `js_call_array(${a.refs[0]}, JS_U, ${a.spread})` : `js_call(${a.refs[0]}, JS_U, ${a.list})`) };
      }
      if (!e.target) {
        if (e.methodName === 'super') {
          const self = e.__this ? this.access(e.__this) : '__this';
          const a = this.callArgs(args);
          return { c: this.wrap(a.pre, a.spread ? `js_super_construct_array(__f, ${self}, ${a.spread}, __nt)` : `js_super_construct(__f, ${self}, ${a.list}, __nt)`) };
        }
        const v = this.resolved.get(e);
        if (v && v.funcDecl && !v.assigned && v.funcDecl.__fn && !this.hasSpread(args)) {
          // a function declaration never reassigned: call its C function directly
          const a = this.callArgs(args);
          return { c: this.wrap(a.pre, `${v.funcDecl.__fn.cname}(js_as_func(${this.access(v)}), JS_U, ${a.list}, JS_U)`) };
        }
        const f = v ? { c: this.access(v), pure: true } : this.globalRef(e.methodName);
        const a = this.callArgs(args, [f]);
        return { c: this.wrap(a.pre, a.spread ? `js_call_array(${a.refs[0]}, JS_U, ${a.spread})` : `js_call(${a.refs[0]}, JS_U, ${a.list})`) };
      }
      if (e.target.nodeType === 'Super') {
        const self = this.thisExpr(e.target);
        const a = this.callArgs(args);
        if (a.spread) return { c: this.wrap(a.pre, `js_call_array(js_super_get(__f, ${self}, ${atom(e.methodName)}), ${self}, ${a.spread})`) };
        return { c: this.wrap(a.pre, `js_super_invoke(__f, ${self}, ${atom(e.methodName)}, ${a.list})`) };
      }
      // OpCodes.X(...) with X compiled from OpCodes.js: a direct call
      if (e.target.nodeType === 'Identifier' && e.target.name === 'OpCodes' && !this.resolved.get(e.target) &&
          this.directOpcodes && this.directOpcodes.has(e.methodName) && !this.hasSpread(args)) {
        const a = this.callArgs(args);
        return { c: this.wrap(a.pre, `opc_${cIdent(e.methodName)}(opcf_${cIdent(e.methodName)}, js_opcodes, ${a.list}, JS_U)`) };
      }
      const o = this.expr(e.target);
      const a = this.callArgs(args, [o]);
      if (a.spread) return { c: this.wrap(a.pre, `js_invoke_array(${a.refs[0]}, ${atom(e.methodName)}, ${a.spread})`) };
      return { c: this.wrap(a.pre, `js_invoke(${a.refs[0]}, ${atom(e.methodName)}, ${a.list})`) };
    }
    newExpr(e) {
      let ctor;
      if (typeof e.className === 'string') {
        const parts = e.className.split('.');
        const v = this.resolved.get(e);
        ctor = v ? { c: this.access(v), pure: true } : this.globalRef(parts[0]);
        for (const p of parts.slice(1)) ctor = { c: `js_get(${ctor.c}, ${atom(p)})`, pure: true };
      } else ctor = this.expr(e.className);
      const a = this.callArgs(e.arguments || [], [ctor]);
      return { c: this.wrap(a.pre, a.spread ? `js_new_array(${a.refs[0]}, ${a.spread})` : `js_new(${a.refs[0]}, ${a.list})`) };
    }
    arrayLiteral(e) {
      const els = e.elements || [];
      if (this.hasSpread(els)) return { c: this.spreadArray(els) };
      const parts = els.map(x => this.expr(x));
      const s = this.sequence(parts);
      if (!parts.length) return { c: 'js_arr_new(0)', pure: true };
      return { c: this.wrap(s.pre, `js_arr_of(${parts.length}, (js_val[]){ ${s.refs.join(', ')} })`), pure: parts.every(p => p.pure) };
    }
    objectLiteral(e) {
      if (!e.properties.length) return { c: 'js_new_object()', pure: true };
      const o = this.tmp('ob');
      let code = `js_val ${o} = js_new_object(); `;
      for (const p of e.properties) {
        if (p.spread || p.key === '...') { code += `js_assign_from(${o}, ${this.expr(p.value).c}); `; continue; }
        const key = atom(String(p.key));
        if (p.kind === 'get' || p.kind === 'set') {
          code += `js_obj_method(${o}, ${key}, ${this.expr(p.value).c}, ${p.kind === 'get' ? 'JM_GET' : 'JM_SET'}); `;
          continue;
        }
        if (p.value && p.value.nodeType === 'ArrowFunction' && p.value.isFunctionExpression) {
          code += `js_obj_method(${o}, ${key}, ${this.expr(p.value).c}, JM_METHOD); `;
          continue;
        }
        code += `js_define(${o}.u.o, ${key}, ${this.expr(p.value).c}, 0); `;
      }
      return { c: `({ ${code}${o}; })` };
    }
    template(e) {
      const items = [];
      for (const part of e.parts) {
        const text = cookTemplate(part.text || '');
        if (text) items.push(strLit(text));
        if (part.expression) items.push(`JS_SV(js_to_str(${this.expr(part.expression).c}))`);
      }
      if (!items.length) return { c: strLit(''), pure: true, lit: true };
      return { c: `js_template(${items.length}, (js_val[]){ ${items.join(', ')} })` };
    }
    /** A closure value of a compiled function context */
    closure(fn, flags, home) {
      this.genFunction(fn);
      const name = fn.node && fn.node.name ? fn.node.name : (fn.node && fn.node.__name) || '';
      return `js_closure(${fn.cname}, ${strRef(name)}, ${this.fnLength(fn)}, ${flags}, ${home}, ${this.envArray(fn.free)})`;
    }
    fnLength(fn) {
      let n = 0;
      for (const p of fn.params || []) { if (p.node.defaultValue || p.node.isRest) break; ++n; }
      return n;
    }

    // ------------------------------------------------ classes
    classExpr(node) {
      const cls = node.__cls;
      const name = node.name || '';
      const ctor = cls.ctor;
      // the constructor (an implicit one when the class has none)
      let ctorName;
      const derived = !!node.baseClass;
      if (ctor) { this.genFunction(ctor); ctorName = ctor.cname; }
      else {
        ctorName = `${this.P}_f${++this.fnCounter}_${cIdent(name || 'class')}_ctor`;
        this.prototypes.push(`static JS_FN(${ctorName});`);
        this.functions.push(derived
          ? `static JS_FN(${ctorName}) {\n  return js_super_construct(__f, __this, __jsargc, __jsargv, __nt);\n}\n`
          : `static JS_FN(${ctorName}) {\n  if (__f->fields) __f->fields(__f, __this);\n  return JS_U;\n}\n`);
      }
      if (cls.fields) this.genFields(cls);
      const c = this.tmp('cls');
      const parent = derived ? this.expr(node.baseClass).c : 'JS_U';
      let code = `js_val ${c} = js_class_new(${strRef(name)}, ${derived ? 1 : 0}, ${parent}, ${ctorName}, ${ctor ? this.fnLength(ctor) : 0}, ${this.envArray(cls.free)}, ${cls.fields ? cls.fields.cname : 'NULL'}); `;
      let i = 0;
      for (const m of node.members || []) {
        if (m.nodeType !== 'Method') continue;
        const fn = cls.members[i++];
        this.genFunction(fn);
        const kind = m.kind === 'get' ? 'JM_GET' : m.kind === 'set' ? 'JM_SET' : 'JM_METHOD';
        code += `js_class_method(${c}, ${atom(m.name)}, ${fn.cname}, ${this.fnLength(fn)}, ${kind}, ${m.isStatic ? 1 : 0}); `;
      }
      return { code, ref: c };
    }
    /** Static members: evaluated with this = the class, after the class is bound */
    classStatics(node, ref) {
      let code = '';
      const saved = this.staticThisExpr;
      this.staticThisExpr = ref;
      for (const m of node.members || []) {
        if (m.nodeType === 'Property' && m.isStatic) code += `js_define(${ref}.u.o, ${atom(m.name)}, ${m.initializer ? this.expr(m.initializer).c : 'JS_U'}, 0); `;
        else if (m.nodeType === 'StaticBlock') code += `{ ${this.blockText(m.body)} } `;
      }
      this.staticThisExpr = saved;
      return code;
    }
    genFields(cls) {
      const fn = cls.fields;
      const saved = this.saveFn();
      this.enterFn(fn);
      const lines = [];
      for (const m of cls.node.members) {
        if (m.nodeType !== 'Property' || m.isStatic) continue;
        lines.push(`  js_define(__this.u.o, ${atom(m.name)}, ${m.initializer ? this.expr(m.initializer).c : 'JS_U'}, 0);`);
      }
      this.prototypes.push(`static void ${fn.cname}(js_func* __f, js_val __this);`);
      this.functions.push(`static void ${fn.cname}(js_func* __f, js_val __this) {\n${this.prologue(fn)}${lines.join('\n')}\n}\n`);
      this.restoreFn(saved);
    }
    // a class expression's value
    classValue(node) {
      const r = this.classExpr(node);
      return `({ ${r.code}${this.classStatics(node, r.ref)}${r.ref}; })`;
    }

    // ------------------------------------------------ functions
    saveFn() { return { fn: this.fn, jumps: this.jumps, lines: this.lines, indent: this.indent }; }
    restoreFn(s) { this.fn = s.fn; this.jumps = s.jumps; this.lines = s.lines; this.indent = s.indent; }
    enterFn(fn) { this.fn = fn; this.jumps = []; this.lines = []; this.indent = 1; }
    /** Locals every function sets up first: this and arguments cells */
    prologue(fn) {
      let s = '';
      if (fn.thisVar && fn.thisVar.boxed) s += '  js_val* c___this = js_cell(__this);\n';
      if (fn.argsVar) {
        s += `  js_val ${fn.argsVar.cname} = js_arr_of(__jsargc, __jsargv);\n`;
        if (fn.argsVar.boxed) s += `  js_val* ${fn.argsVar.cell} = js_cell(${fn.argsVar.cname});\n`;
      }
      return s;
    }
    genFunction(fn) {
      if (fn.generated) return;
      fn.generated = true;
      const saved = this.saveFn();
      this.enterFn(fn);
      const node = fn.node;
      // parameters
      let pro = this.prologue(fn);
      fn.params.forEach((p, i) => {
        const v = p.v, local = v.cname;
        if (p.node.isRest) pro += `  js_val ${local} = js_arr_of(__jsargc > ${i} ? __jsargc - ${i} : 0, __jsargv + (__jsargc > ${i} ? ${i} : __jsargc));\n`;
        else pro += `  js_val ${local} = JS_ARG(${i});\n`;
        if (v.boxed) pro += `  js_val* ${v.cell} = js_cell(${local});\n`;
        if (p.node.defaultValue) {
          const d = this.expr(p.node.defaultValue).c;
          pro += `  if (${this.access(v)}.t == JS_T_UNDEF) ${this.access(v)} = ${d};\n`;
        }
      });
      if (fn.kind === 'ctor' && !node.__derived && !(fn.cls && fn.cls.node.baseClass)) pro += '  if (__f->fields) __f->fields(__f, __this);\n';
      this.lines = [];
      const body = fn.kind === 'ctor' || fn.kind === 'method' || fn.kind === 'function' ? node.body : node.body;
      if (body && body.nodeType === 'Block') {
        this.hoist(fn.scope, body.statements, true);
        for (const s of flat(body.statements)) this.stmt(s);
        this.line('return JS_U;');
      } else if (body) {
        this.line(`return ${this.expr(body).c};`);
      } else this.line('return JS_U;');
      this.prototypes.push(`static JS_FN(${fn.cname});`);
      this.functions.push(`static JS_FN(${fn.cname}) {\n${pro}${this.lines.join('\n')}\n}\n`);
      this.restoreFn(saved);
    }
    line(s) { this.lines.push('  '.repeat(this.indent) + s); }
    /** Block entry: cells of captured block variables, function-scoped vars, hoisted functions */
    hoist(scope, statements, functionBody) {
      if (!scope) return;
      for (const v of scope.vars.values()) {
        if (v.kind === 'param') continue;
        if (v.isModule) continue;
        if (v.boxed) this.line(`js_val* ${v.cell} = js_cell(JS_U);`);
        else if (v.kind === 'var' || v.kind === 'function' || v.kind === 'class') this.line(`js_val ${v.cname} = JS_U;`);
      }
      for (const s of flat(statements)) {
        if (s && s.nodeType === 'Function') {
          const v = this.resolved.get(s);
          this.line(`${this.access(v)} = ${this.closure(s.__fn, 'JF_CTOR', 'NULL')};`);
        }
      }
    }

    // ------------------------------------------------ statements
    blockText(block) {
      const savedLines = this.lines, savedIndent = this.indent;
      this.lines = []; this.indent = 0;
      this.block(block);
      const text = this.lines.join(' ');
      this.lines = savedLines; this.indent = savedIndent;
      return text;
    }
    block(b) {
      if (!b) return;
      if (b.nodeType !== 'Block') { this.line('{'); ++this.indent; this.stmt(b); --this.indent; this.line('}'); return; }
      this.line('{');
      ++this.indent;
      this.hoist(b.__scope, b.statements, false);
      for (const s of flat(b.statements)) this.stmt(s);
      --this.indent;
      this.line('}');
    }
    stmt(s) {
      if (!s) return;
      if (Array.isArray(s)) { for (const x of s) this.stmt(x); return; }
      switch (s.nodeType) {
        case 'Block': this.block(s); return;
        case 'VariableDeclaration': this.varDecl(s); return;
        case 'ExpressionStatement': {
          const x = s.expression;
          if (x && x.nodeType === 'Class') { this.classStatement(x); return; }
          this.line(`(void)(${this.discarded(x)});`);
          return;
        }
        case 'Return': {
          const v = s.expression ? this.expr(s.expression).c : 'JS_U';
          // a module's top-level return (an unwrapped factory's early exit) ends its initialiser
          // (what it returns is what the module exports)
          if (this.module === this.fn) { this.line(`js_module_return(${v}); goto __module_end;`); return; }
          if (this.jumps.some(j => j.kind === 'try')) {
            const t = this.tmp('r');
            this.line(`{ js_val ${t} = ${v};`);
            this.unwind(j => false);
            this.line(`return ${t}; }`);
          } else this.line(`return ${v};`);
          return;
        }
        case 'Throw': this.line(`js_throw(${this.expr(s.expression).c});`); return;
        case 'If': {
          this.line(`if (${this.cond(s.condition)})`);
          this.block(s.thenBranch);
          if (s.elseBranch) { this.line('else'); this.block(s.elseBranch); }
          return;
        }
        case 'For': this.forStmt(s); return;
        case 'ForOf': this.forOf(s); return;
        case 'While': {
          this.line(`while (${this.cond(s.condition)})`);
          this.jumps.push({ kind: 'loop' });
          this.block(s.body);
          this.jumps.pop();
          return;
        }
        case 'DoWhile': {
          this.line('do');
          this.jumps.push({ kind: 'loop' });
          this.block(s.body);
          this.jumps.pop();
          this.line(`while (${this.cond(s.condition)});`);
          return;
        }
        case 'Switch': this.switchStmt(s); return;
        case 'Break': {
          this.unwind(j => j.kind === 'loop' || j.kind === 'switch');
          const target = [...this.jumps].reverse().find(j => j.kind === 'loop' || j.kind === 'switch');
          if (!target) throw new Error('C: break outside a loop or switch');
          this.line(target.kind === 'switch' ? `goto ${target.end};` : 'break;');
          return;
        }
        case 'Continue': {
          this.unwind(j => j.kind === 'loop');
          this.line('continue;');
          return;
        }
        case 'TryCatch': this.tryStmt(s); return;
        case 'Function': return; // hoisted to its block's start
        case 'Class': this.classStatement(s); return;
        case 'StaticBlock': this.block(s.body); return;
        default:
          this.line(`(void)(${this.expr(s).c});`);
      }
    }
    classStatement(node) {
      const v = this.resolved.get(node);
      const r = this.classExpr(node);
      this.line(`{ ${r.code}`);
      if (v) this.line(`  ${v.isModule ? v.cname : (v.boxed ? `(*${v.cell})` : v.cname)} = ${r.ref};`);
      const statics = this.classStatics(node, r.ref);
      if (statics) this.line(`  ${statics}`);
      this.line('}');
    }
    varDecl(s) {
      const v = this.resolved.get(s);
      if (!v) throw new Error(`C: unresolved declaration ${s.name}`);
      const init = s.initializer ? this.expr(s.initializer).c : null;
      if (v.isModule) { if (init) this.line(`${v.cname} = ${init};`); else if (s.kind !== 'var') this.line(`${v.cname} = JS_U;`); return; }
      if (v.boxed) { if (init) this.line(`(*${v.cell}) = ${init};`); else if (s.kind !== 'var') this.line(`(*${v.cell}) = JS_U;`); return; }
      if (v.kind === 'var') { if (init) this.line(`${v.cname} = ${init};`); return; }
      this.line(`js_val ${v.cname} = ${init || 'JS_U'};`);
    }
    forStmt(s) {
      this.line('{');
      ++this.indent;
      this.hoist(s.__scope, [], false);
      const init = s.initializer;
      if (init) {
        const decls = Array.isArray(init) ? init : [init];
        for (const d of decls) {
          if (d && d.nodeType === 'VariableDeclaration') this.varDecl(d);
          else if (d) this.line(`(void)(${this.expr(d).c});`);
        }
      }
      const cond = s.condition ? this.cond(s.condition) : '1';
      const upd = s.incrementor ? `(void)(${this.discarded(s.incrementor)})` : '';
      this.line(`for (; ${cond}; ${upd})`);
      this.jumps.push({ kind: 'loop' });
      this.block(s.body);
      this.jumps.pop();
      --this.indent;
      this.line('}');
    }
    forOf(s) {
      const coll = this.expr(s.collection).c;
      const v = s.__var;
      this.line('{');
      ++this.indent;
      if (s.isForIn) {
        const keys = this.tmp('keys'), i = this.tmp('i');
        this.line(`js_val ${keys} = js_for_in_keys(${coll});`);
        this.line(`for (int64_t ${i} = 0; ${i} < js_as_arr(${keys})->len; ++${i}) {`);
        ++this.indent;
        this.bindLoopVar(v, `js_as_arr(${keys})->a[${i}]`);
      } else {
        const it = this.tmp('it'), x = this.tmp('x');
        this.line(`js_iter ${it}; js_val ${x}; js_iter_init(&${it}, ${coll});`);
        this.line(`while (js_iter_next(&${it}, &${x})) {`);
        ++this.indent;
        this.bindLoopVar(v, x);
      }
      this.jumps.push({ kind: 'loop' });
      this.block(s.body);
      this.jumps.pop();
      --this.indent;
      this.line('}');
      --this.indent;
      this.line('}');
    }
    bindLoopVar(v, value) {
      if (v.boxed) this.line(`js_val* ${v.cell} = js_cell(${value});`);
      else this.line(`js_val ${v.cname} = ${value};`);
    }
    switchStmt(s) {
      const d = this.tmp('d');
      const end = this.label('sw_end');
      const labels = s.cases.map(() => this.label('case'));
      this.line('{');
      ++this.indent;
      this.hoist(s.__scope, s.cases.flatMap(c => c.statements), false);
      this.line(`js_val ${d} = ${this.expr(s.expression).c};`);
      let dflt = null;
      s.cases.forEach((c, i) => {
        if (!c.label || c.isDefault) { dflt = labels[i]; return; }
        this.line(`if (js_strict_eq(${d}, ${this.expr(c.label).c})) goto ${labels[i]};`);
      });
      this.line(`goto ${dflt || end};`);
      this.jumps.push({ kind: 'switch', end });
      s.cases.forEach((c, i) => {
        this.line(`${labels[i]}: ;`);
        for (const x of flat(c.statements)) this.stmt(x);
      });
      this.jumps.pop();
      this.line(`${end}: ;`);
      --this.indent;
      this.line('}');
    }
    /**
     * Leave try frames up to the jump target (the innermost entry stop accepts):
     * pop each frame and run its finally block.
     */
    unwind(stop) {
      for (let i = this.jumps.length - 1; i >= 0; --i) {
        const j = this.jumps[i];
        if (stop(j)) return;
        if (j.kind !== 'try') continue;
        this.line(`JS_TRY_POP(${j.frame});`);
        if (j.finalizer) {
          const saved = this.jumps;
          this.jumps = this.jumps.slice(0, i);
          this.block(j.finalizer);
          this.jumps = saved;
        }
      }
    }
    tryStmt(s) {
      const t = this.tmp('try');
      const fin = s.finallyBlock || null;
      const cc = (s.catchClauses || [])[0] || null;
      this.line('{');
      ++this.indent;
      this.line(`js_try ${t}; JS_TRY_PUSH(${t});`);
      this.line(`if (!JS_SETJMP(${t}.jb)) {`);
      ++this.indent;
      this.jumps.push({ kind: 'try', frame: t, finalizer: fin });
      this.block(s.tryBlock);
      this.jumps.pop();
      this.line(`JS_TRY_POP(${t});`);
      --this.indent;
      this.line('} else {');
      ++this.indent;
      this.line(`JS_TRY_POP(${t});`);
      if (cc) {
        const bindError = () => {
          if (cc.__var) {
            if (cc.__var.boxed) this.line(`js_val* ${cc.__var.cell} = js_cell(${t}.exc);`);
            else this.line(`js_val ${cc.__var.cname} = ${t}.exc;`);
          }
        };
        if (fin) {
          // the handler runs in a frame of its own, so its exceptions still run finally
          const t2 = this.tmp('try');
          this.line(`js_try ${t2}; JS_TRY_PUSH(${t2});`);
          this.line(`if (!JS_SETJMP(${t2}.jb)) {`);
          ++this.indent;
          bindError();
          this.jumps.push({ kind: 'try', frame: t2, finalizer: fin });
          this.block(cc.body);
          this.jumps.pop();
          this.line(`JS_TRY_POP(${t2});`);
          --this.indent;
          this.line('} else {');
          ++this.indent;
          this.line(`JS_TRY_POP(${t2});`);
          this.block(fin);
          this.line(`js_throw(${t2}.exc);`);
          --this.indent;
          this.line('}');
        } else {
          bindError();
          this.block(cc.body);
        }
      } else {
        this.block(fin);
        this.line(`js_throw(${t}.exc);`);
      }
      --this.indent;
      this.line('}');
      if (fin) this.block(fin);
      --this.indent;
      this.line('}');
    }

    // ------------------------------------------------ module
    compileUnit(unit) {
      const mod = this.analyzeUnit(unit);
      this.enterFn(mod);
      this.indent = 1;
      for (const v of collectModuleVars(mod, unit, this)) this.statics.push(`static js_val ${v.cname};`);
      for (const s of flat(unit.statements)) {
        if (s && s.nodeType === 'Function') {
          const v = this.resolved.get(s);
          this.line(`${v.cname} = ${this.closure(s.__fn, 'JF_CTOR', 'NULL')};`);
        }
      }
      for (const s of flat(unit.statements)) this.stmt(s);
      // the unwrapped factory's result (return { A, B }) is gone from the IL: a module
      // that exported nothing exports its top-level names, for a bundle to bind
      const names = [...this.moduleScopeVars()].filter(v => !/^__/.test(v.name));
      if (names.length && !this.opts.framework)
        this.line(`js_module_autoexport(${names.length}, (const char*[]){ ${names.map(v => JSON.stringify(v.name)).join(', ')} }, (js_val[]){ ${names.map(v => v.cname).join(', ')} });`);
      return this.lines.join('\n');
    }
    moduleScopeVars() {
      const out = new Set();
      for (const v of this.resolved.values()) if (v && v.isModule) out.add(v);
      return out;
    }
    /** The module's C text: statics, prototypes, functions, its initialiser and registration */
    moduleText(initBody, registrations, guardName) {
      const P = this.P;
      const parts = [];
      parts.push(`/* ---------------- module ${P} ---------------- */`);
      parts.push(...this.statics);
      parts.push(...this.prototypes);
      parts.push(...this.functions);
      parts.push(`static void ${this.initName}(void) {\n  js_begin_module();\n${registrations || ''}${initBody}\n  goto __module_end;\n__module_end:\n  js_end_module();\n}`);
      if (!this.opts.framework) {
        parts.push(`static js_module_node js_mod_${P} = { ${this.initName}, JS_MODULE_LIST };`);
        parts.push('#undef JS_MODULE_LIST');
        parts.push(`#define JS_MODULE_LIST (&js_mod_${P})`);
      }
      return parts.join('\n') + '\n';
    }
  }

  function flat(list) {
    const out = [];
    for (const x of list || []) { if (Array.isArray(x)) out.push(...flat(x)); else out.push(x); }
    return out;
  }
  function collectModuleVars(mod, unit, gen) {
    const vars = new Set();
    for (const v of gen.resolved.values()) if (v && v.isModule) vars.add(v);
    // declared but unused names too
    const visit = (s) => {
      if (!s) return;
      const v = gen.resolved.get(s);
      if (v && v.isModule) vars.add(v);
    };
    flat(unit.statements).forEach(visit);
    return [...vars];
  }

  // ========================[ FRAMEWORK ]========================
  // A JavaScript rendition of AlgorithmFramework.js (its classes, the shared
  // construction primitives and the registry; the enums are copied from the
  // loaded framework), compiled by this transformer into the C prelude.
  const FRAMEWORK_SOURCE = String.raw`
class LinkItem {
  constructor(text, uri) { this.text = text; this.uri = uri; }
}
class TestCase extends LinkItem {
  constructor(input, expected, description = '', uri = '') { super(description, uri); this.input = input; this.expected = expected; }
}
class Vulnerability extends LinkItem {
  constructor(type, description = '', mitigation = '', uri = '') { super(type, uri); this.description = description; this.mitigation = mitigation; }
}
class AuthResult {
  constructor(success, output = null, failureReason = null) { this.Success = success; this.Output = output; this.FailureReason = failureReason; }
}
class KeySize {
  constructor(minSize, maxSize, stepSize = 1) { this.minSize = minSize; this.maxSize = maxSize; this.stepSize = stepSize; }
}
function _byte(value) {
  const reduced = Math.trunc(value) % 256;
  return reduced < 0 ? reduced + 256 : reduced;
}
function _mergeBits(a, b) {
  const left = _byte(a);
  const right = _byte(b);
  let merged = 0;
  let weight = 1;
  for (let bit = 0; bit < 8; bit++) {
    if (Math.floor(left / weight) % 2 === 1 || Math.floor(right / weight) % 2 === 1) merged += weight;
    weight *= 2;
  }
  return merged;
}
function _encodeLength(value, byteCount, littleEndian) {
  const encoded = new Array(byteCount).fill(0);
  let remaining = Math.max(0, Math.trunc(value));
  for (let i = 0; i < byteCount; i++) {
    encoded[littleEndian ? i : byteCount - 1 - i] = remaining % 256;
    remaining = Math.floor(remaining / 256);
  }
  return encoded;
}
class BlockAbsorber {
  constructor(blockSize, processBlock) {
    if (!(blockSize > 0)) throw new Error('BlockAbsorber: blockSize must be positive');
    if (typeof processBlock !== 'function') throw new Error('BlockAbsorber: processBlock must be a function');
    this._blockSize = blockSize;
    this._processBlock = processBlock;
    this._held = new Array(blockSize).fill(0);
    this._pending = 0;
    this._length = 0;
  }
  get BlockSize() { return this._blockSize; }
  get Pending() { return this._pending; }
  get Length() { return this._length; }
  Absorb(data) {
    if (!data || data.length === 0) return;
    const blockSize = this._blockSize;
    const total = data.length;
    let offset = 0;
    while (offset < total) {
      if (this._pending === blockSize) {
        this._processBlock(this._held);
        this._pending = 0;
      }
      const take = Math.min(blockSize - this._pending, total - offset);
      for (let i = 0; i < take; i++) this._held[this._pending + i] = _byte(data[offset + i]);
      this._pending += take;
      offset += take;
      this._length += take;
    }
  }
  Finish(finalize) {
    if (typeof finalize !== 'function') throw new Error('BlockAbsorber: finalize must be a function');
    return finalize(this._held.slice(0, this._pending), this._pending, this._length);
  }
  Reset() {
    this._held.fill(0);
    this._pending = 0;
    this._length = 0;
  }
}
function SpongePadBlocks(held, pending, rate, separator) {
  if (!(rate > 0)) throw new Error('SpongePadBlocks: rate must be positive');
  if (pending < 0 || pending > rate) throw new Error('SpongePadBlocks: pending ' + pending + ' outside 0..' + rate);
  const blocks = [];
  let block = new Array(rate).fill(0);
  for (let i = 0; i < pending; i++) block[i] = _byte(held[i]);
  let used = pending;
  if (used === rate) {
    blocks.push(block);
    block = new Array(rate).fill(0);
    used = 0;
  }
  block[used] = _byte(separator);
  block[rate - 1] = _mergeBits(block[rate - 1], 0x80);
  blocks.push(block);
  return blocks;
}
function MerkleDamgardBlocks(held, pending, totalLength, options) {
  const settings = options || {};
  const blockSize = settings.blockSize;
  if (!(blockSize > 0)) throw new Error('MerkleDamgardBlocks: blockSize must be positive');
  if (pending < 0 || pending > blockSize) throw new Error('MerkleDamgardBlocks: pending ' + pending + ' outside 0..' + blockSize);
  const padByte = settings.padByte === undefined ? 0x80 : settings.padByte;
  const lengthBytes = settings.lengthBytes === undefined ? 8 : settings.lengthBytes;
  const littleEndian = settings.lengthLittleEndian === true;
  const inBits = settings.lengthInBits !== false;
  if (lengthBytes < 0 || lengthBytes >= blockSize) throw new Error('MerkleDamgardBlocks: lengthBytes ' + lengthBytes + ' does not fit a ' + blockSize + '-byte block');
  const blocks = [];
  let block = new Array(blockSize).fill(0);
  for (let i = 0; i < pending; i++) block[i] = _byte(held[i]);
  let used = pending;
  if (used === blockSize) {
    blocks.push(block);
    block = new Array(blockSize).fill(0);
    used = 0;
  }
  block[used] = _byte(padByte);
  used++;
  if (used > blockSize - lengthBytes) {
    blocks.push(block);
    block = new Array(blockSize).fill(0);
  }
  if (lengthBytes > 0) {
    const encoded = _encodeLength(inBits ? totalLength * 8 : totalLength, lengthBytes, littleEndian);
    for (let i = 0; i < lengthBytes; i++) block[blockSize - lengthBytes + i] = encoded[i];
  }
  blocks.push(block);
  return blocks;
}
class IAlgorithmInstance {
  constructor(algorithm) {
    this.algorithm = algorithm;
    this.isInverse = false;
    this.inputBuffer = [];
  }
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.inputBuffer) this.inputBuffer = [];
    for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
  }
  Result() { throw 'Result() not implemented'; }
  Dispose() {
    if (this.inputBuffer) this.inputBuffer.length = 0;
  }
}
class Algorithm {
  constructor() {
    this.name = null;
    this.description = null;
    this.inventor = null;
    this.year = null;
    this.category = null;
    this.subCategory = null;
    this.securityStatus = null;
    this.complexity = null;
    this.country = null;
    this.documentation = [];
    this.references = [];
    this.knownVulnerabilities = [];
    this.tests = [];
  }
  CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented'; }
}
class CryptoAlgorithm extends Algorithm {}
class SymmetricCipherAlgorithm extends CryptoAlgorithm {}
class AsymmetricCipherAlgorithm extends CryptoAlgorithm {}
class BlockCipherAlgorithm extends SymmetricCipherAlgorithm {
  constructor() { super(); this.SupportedKeySizes = []; this.SupportedBlockSizes = []; }
  CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented'; }
}
class StreamCipherAlgorithm extends SymmetricCipherAlgorithm {
  CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented'; }
}
class EncodingAlgorithm extends Algorithm {
  CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented'; }
}
class CompressionAlgorithm extends Algorithm {
  CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented'; }
}
class ErrorCorrectionAlgorithm extends Algorithm {}
class HashFunctionAlgorithm extends Algorithm {
  constructor() { super(); this.SupportedOutputSizes = []; }
  CreateInstance(isInverse = false) { throw 'CreateInstance() not implemented'; }
}
class MacAlgorithm extends Algorithm {
  constructor() { super(); this.SupportedMacSizes = []; this.NeedsKey = true; }
}
class KdfAlgorithm extends Algorithm {
  constructor() { super(); this.SupportedOutputSizes = []; this.SaltRequired = true; }
}
class PaddingAlgorithm extends Algorithm {
  constructor() { super(); this.IsLengthIncluded = false; }
}
class CipherModeAlgorithm extends Algorithm {
  constructor() { super(); this.RequiresIV = true; this.SupportedIVSizes = []; }
}
class AeadAlgorithm extends CryptoAlgorithm {
  constructor() { super(); this.SupportedTagSizes = []; this.SupportsDetached = false; }
}
class RandomGenerationAlgorithm extends Algorithm {
  constructor() { super(); this.IsDeterministic = false; this.IsCryptographicallySecure = true; this.SupportedSeedSizes = []; }
}
class IBlockCipherInstance extends IAlgorithmInstance {
  constructor(algorithm) { super(algorithm); this.BlockSize = 0; this.KeySize = 0; this._key = null; }
  set key(keyBytes) { this._key = keyBytes; }
  get key() { return this._key; }
  EncryptBlock(block) { throw 'EncryptBlock() not implemented'; }
  DecryptBlock(block) { throw 'DecryptBlock() not implemented'; }
  RequireBlockMultiple(blockSize) {
    const size = blockSize || this.BlockSize;
    if (!(size > 0)) throw new Error('BlockSize not set');
    const length = this.inputBuffer ? this.inputBuffer.length : 0;
    if (length % size !== 0) throw new Error('Input length must be multiple of ' + size + ' bytes');
    return length / size;
  }
  Result() {
    if (!this.key) throw new Error('Key not set');
    if (!this.inputBuffer || this.inputBuffer.length === 0) throw new Error('No data fed');
    const blockSize = this.BlockSize;
    this.RequireBlockMultiple(blockSize);
    const output = [];
    for (let offset = 0; offset < this.inputBuffer.length; offset += blockSize) {
      const block = this.inputBuffer.slice(offset, offset + blockSize);
      const processed = this.isInverse ? this.DecryptBlock(block) : this.EncryptBlock(block);
      for (let i = 0; i < processed.length; i++) output.push(processed[i]);
    }
    this.inputBuffer = [];
    return output;
  }
}
class IHashFunctionInstance extends IAlgorithmInstance {
  constructor(algorithm) { super(algorithm); this.OutputSize = 0; }
}
class IMacInstance extends IAlgorithmInstance {
  ComputeMac(data) { throw 'ComputeMac() not implemented'; }
}
class IKdfInstance extends IAlgorithmInstance {
  constructor(algorithm) { super(algorithm); this.OutputSize = 0; this.Iterations = 0; }
}
class IAeadInstance extends IAlgorithmInstance {
  constructor(algorithm) { super(algorithm); this.aad = []; this.tagSize = 0; }
}
class IErrorCorrectionInstance extends IAlgorithmInstance {
  DetectError(data) { throw 'DetectError() not implemented'; }
}
class IRandomGeneratorInstance extends IAlgorithmInstance {
  NextBytes(count) { throw 'NextBytes() not implemented'; }
}
const Algorithms = [];
function _processTestVector(test, index, algorithmName) {
  if (!(test instanceof TestCase)) {
    if (test && typeof test === 'object' && test.input !== undefined) {
      const description = test.text || 'Test vector #' + (index + 1);
      const uri = test.uri || '';
      const expected = test.expected !== undefined ? test.expected : [];
      const result = new TestCase(test.input, expected, description, uri);
      const keys = Object.keys(test);
      for (let k = 0; k < keys.length; ++k) {
        const key = keys[k];
        if (key !== 'input' && key !== 'expected' && key !== 'text' && key !== 'uri') result[key] = test[key];
      }
      return result;
    }
    throw new Error('RegisterAlgorithm: Invalid test vector #' + (index + 1) + " in algorithm '" + algorithmName + "' - must have at least 'input' field");
  }
  if (test.input === undefined) throw new Error('RegisterAlgorithm: Test vector #' + (index + 1) + " in algorithm '" + algorithmName + "' missing input");
  if (!Array.isArray(test.input) && test.input !== null) throw new Error('RegisterAlgorithm: Test vector #' + (index + 1) + " in algorithm '" + algorithmName + "' has invalid input (must be byte array or null)");
  if (test.expected !== undefined && !Array.isArray(test.expected)) throw new Error('RegisterAlgorithm: Test vector #' + (index + 1) + " in algorithm '" + algorithmName + "' has invalid expected (must be byte array)");
  return test;
}
function RegisterAlgorithm(algorithm) {
  if (!algorithm || typeof algorithm !== 'object') throw new Error('RegisterAlgorithm: Invalid algorithm object');
  if (!algorithm.name || typeof algorithm.name !== 'string') throw new Error('RegisterAlgorithm: Algorithm must have a valid name');
  for (let i = 0; i < Algorithms.length; ++i)
    if (Algorithms[i].name === algorithm.name) throw new Error("RegisterAlgorithm: Algorithm '" + algorithm.name + "' already registered");
  if (algorithm.tests && Array.isArray(algorithm.tests)) {
    const processed = [];
    for (let i = 0; i < algorithm.tests.length; ++i) processed.push(_processTestVector(algorithm.tests[i], i, algorithm.name));
    algorithm.tests = processed;
  }
  Algorithms.push(algorithm);
}
function Find(name) {
  for (let i = 0; i < Algorithms.length; ++i) if (Algorithms[i].name === name) return Algorithms[i];
  return null;
}
function Clear() { Algorithms.length = 0; }
const AlgorithmFramework = {
  RegisterAlgorithm: RegisterAlgorithm, CategoryType: CategoryType, SecurityStatus: SecurityStatus, ComplexityType: ComplexityType, CountryCode: CountryCode,
  LinkItem: LinkItem, TestCase: TestCase, Vulnerability: Vulnerability, AuthResult: AuthResult, KeySize: KeySize,
  BlockAbsorber: BlockAbsorber, SpongePadBlocks: SpongePadBlocks, MerkleDamgardBlocks: MerkleDamgardBlocks,
  Algorithm: Algorithm, CryptoAlgorithm: CryptoAlgorithm, SymmetricCipherAlgorithm: SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm: AsymmetricCipherAlgorithm,
  BlockCipherAlgorithm: BlockCipherAlgorithm, StreamCipherAlgorithm: StreamCipherAlgorithm, EncodingAlgorithm: EncodingAlgorithm, CompressionAlgorithm: CompressionAlgorithm,
  ErrorCorrectionAlgorithm: ErrorCorrectionAlgorithm, HashFunctionAlgorithm: HashFunctionAlgorithm, MacAlgorithm: MacAlgorithm, KdfAlgorithm: KdfAlgorithm,
  PaddingAlgorithm: PaddingAlgorithm, CipherModeAlgorithm: CipherModeAlgorithm, AeadAlgorithm: AeadAlgorithm, RandomGenerationAlgorithm: RandomGenerationAlgorithm,
  IAlgorithmInstance: IAlgorithmInstance, IBlockCipherInstance: IBlockCipherInstance, IHashFunctionInstance: IHashFunctionInstance, IMacInstance: IMacInstance,
  IKdfInstance: IKdfInstance, IAeadInstance: IAeadInstance, IErrorCorrectionInstance: IErrorCorrectionInstance, IRandomGeneratorInstance: IRandomGeneratorInstance,
  Algorithms: Algorithms, Find: Find, Clear: Clear
};
const exportNames = Object.keys(AlgorithmFramework);
for (let i = 0; i < exportNames.length; ++i) globalThis[exportNames[i]] = AlgorithmFramework[exportNames[i]];
globalThis.AlgorithmFramework = AlgorithmFramework;
OpCodes.BytesToHex = function (bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += (bytes[i] & 0xFF).toString(16).padStart(2, '0');
  return s;
};
`;
  const ENUM_NAMES = ['CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode'];
  function loadedFramework() {
    if (typeof require !== 'undefined') { try { return require('../AlgorithmFramework.js'); } catch (e) { /* the browser global below */ } }
    return global.AlgorithmFramework || null;
  }
  let frameworkCache = null;
  /** The framework compiled to C (once per process) */
  function frameworkCode() {
    if (frameworkCache) return frameworkCache;
    const AF = loadedFramework();
    const enums = ENUM_NAMES.map(n => `const ${n} = Object.freeze(${JSON.stringify(AF && AF[n] ? AF[n] : {})});`).join('\n');
    const unit = toJsAst(enums + '\n' + FRAMEWORK_SOURCE);
    const gen = new ModuleCompiler('fw', 'js_framework_init', { framework: true });
    const body = gen.compileUnit(unit);
    frameworkCache = `#ifndef JS_FRAMEWORK_INCLUDED\n#define JS_FRAMEWORK_INCLUDED\n${gen.moduleText(body, '', null)}#endif\n`;
    return frameworkCache;
  }

  // ========================[ OPCODES ]========================
  function loadedOpCodes() {
    if (typeof require !== 'undefined') { try { return require('../OpCodes.js'); } catch (e) { /* the browser global below */ } }
    return global.OpCodes || null;
  }
  /** JavaScript source of a value (functions by their own text) */
  function valueSource(v, depth = 0) {
    if (typeof v === 'function') {
      const s = v.toString();
      return /^(function\b|\(|[A-Za-z_$][\w$]*\s*=>|async\b)/.test(s) ? s : 'function ' + s;
    }
    if (v && typeof v === 'object' && depth < 4) {
      if (Array.isArray(v)) return '[' + v.map(x => valueSource(x, depth + 1)).join(', ') + ']';
      return '{\n' + Object.keys(v).map(k => `${JSON.stringify(k)}: ${valueSource(v[k], depth + 1)}`).join(',\n') + '\n}';
    }
    return v === undefined ? 'undefined' : JSON.stringify(v);
  }
  let opcodesCache = null;
  /** OpCodes members as JavaScript AST nodes (one parse per process) */
  function opcodesMembers() {
    if (opcodesCache) return opcodesCache;
    const O = loadedOpCodes();
    const members = new Map();
    if (O) {
      const names = Object.keys(O);
      const src = 'const OpCodes = {\n' + names.map(n => `${JSON.stringify(n)}: ${valueSource(O[n])}`).join(',\n') + '\n};\n';
      const unit = toJsAst(src);
      const decl = flat(unit.statements).find(s => s && s.nodeType === 'VariableDeclaration' && s.name === 'OpCodes');
      if (decl && decl.initializer && decl.initializer.properties)
        for (const p of decl.initializer.properties) members.set(String(p.key), p.value);
    }
    opcodesCache = members;
    return members;
  }
  /** The names of OpCodes members a node refers to (OpCodes.X, this.X in a member) */
  function opcodesReferences(node, out) {
    const visit = (n) => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(visit); return; }
      if ((n.nodeType === 'Call' || n.nodeType === 'MemberAccess') && n.target && ((n.target.nodeType === 'Identifier' && n.target.name === 'OpCodes') || n.target.nodeType === 'This')) {
        out.add(n.nodeType === 'Call' ? n.methodName : n.member);
        for (const k in n) if (!SKIP_KEYS.has(k) && !k.startsWith('__') && k !== 'target') visit(n[k]);
        return;
      }
      // new OpCodes._BitStream(...) names its constructor by a dotted path
      if (n.nodeType === 'New' && typeof n.className === 'string' && n.className.startsWith('OpCodes.')) out.add(n.className.split('.')[1]);
      if (n.nodeType === 'Identifier' && n.name === 'OpCodes') out.add('*');
      for (const k in n) if (!SKIP_KEYS.has(k) && !k.startsWith('__')) visit(n[k]);
    };
    visit(node);
  }
  const opcodeMemberCache = new Map();
  /** One OpCodes member compiled to C (guarded so bundled modules share it) */
  function opcodeMemberCode(name, value, functionNames) {
    // members call only members of the closed set they need, so one compilation serves every module
    const key = name;
    if (opcodeMemberCache.has(key)) return opcodeMemberCache.get(key);
    const id = cIdent(name);
    const gen = new ModuleCompiler(`opc_${id}`, `opc_reg_${id}`, { directOpcodes: functionNames });
    // compile `const __member = <value>;` as a tiny module whose static holds the member
    const unit = { nodeType: 'CompilationUnit', statements: [{ nodeType: 'VariableDeclaration', name: '__member', kind: 'const', initializer: value }] };
    const isFunction = value && value.nodeType === 'ArrowFunction';
    if (isFunction) value.__name = name;
    const mod = gen.analyzeUnit(unit);
    gen.enterFn(mod);
    let body = '';
    if (isFunction) {
      // the member's function is the C function opc_<name>, called directly
      const fn = value.__fn;
      fn.cname = `opc_${id}`;
      gen.genFunction(fn);
      body = `  if (!opcf_${id}) { opcf_${id} = js_as_func(js_closure(opc_${id}, ${strRef(name)}, ${gen.fnLength(fn)}, JF_CTOR, NULL, 0, NULL)); js_define(js_opcodes.u.o, ${atom(name)}, JS_O(opcf_${id}), 0); }\n`;
    } else {
      gen.indent = 1;
      for (const v of collectModuleVars(mod, unit, gen)) gen.statics.push(`static js_val ${v.cname};`);
      gen.stmt(unit.statements[0]);
      body = `  static int done; if (done) return; done = 1;\n${gen.lines.join('\n')}\n  js_define(js_opcodes.u.o, ${atom(name)}, opc_${id}___member, 0);\n`;
    }
    const code = `#ifndef JS_OPC_${id}\n#define JS_OPC_${id}\n` +
      (isFunction ? `static js_func* opcf_${id};\n` : '') +
      gen.statics.join('\n') + '\n' + gen.prototypes.join('\n') + '\n' + gen.functions.join('\n') +
      `static void opc_reg_${id}(void) {\n${body}}\n#endif\n`;
    opcodeMemberCache.set(key, code);
    return code;
  }
  /**
   * The OpCodes members a module uses, with what they use in turn.
   * @param {Set<string>} used - member names ('*' for a use of the whole object)
   * @returns {{code: string, registrations: string}}
   */
  function opcodesFor(used) {
    const members = opcodesMembers();
    const need = new Set();
    const queue = [...used].includes('*') ? [...members.keys()] : [...used];
    while (queue.length) {
      const n = queue.pop();
      if (need.has(n) || !members.has(n)) continue;
      need.add(n);
      const refs = new Set();
      opcodesReferences(members.get(n), refs);
      if (refs.has('*')) { for (const k of members.keys()) if (!need.has(k)) queue.push(k); }
      for (const r of refs) if (r !== '*' && !need.has(r)) queue.push(r);
    }
    const ordered = [...members.keys()].filter(n => need.has(n));
    const functionNames = new Set(ordered.filter(n => members.get(n) && members.get(n).nodeType === 'ArrowFunction'));
    let code = '';
    const allFunctions = new Set([...members.keys()].filter(n => members.get(n) && members.get(n).nodeType === 'ArrowFunction'));
    for (const n of ordered) code += opcodeMemberCode(n, members.get(n), allFunctions);
    // prototypes of every direct-call target go first, as members call each other
    const protos = [...functionNames].map(n => `#ifndef JS_OPC_PROTO_${cIdent(n)}\n#define JS_OPC_PROTO_${cIdent(n)}\nstatic js_func* opcf_${cIdent(n)};\nstatic JS_FN(opc_${cIdent(n)});\n#endif\n`).join('');
    const registrations = ordered.map(n => `  opc_reg_${cIdent(n)}();\n`).join('');
    return { code: protos + code, registrations, functionNames };
  }

  const exports = { CTransformer, cIdent, u16Literal };
  if (typeof module !== 'undefined' && module.exports) module.exports = exports;
  if (typeof global !== 'undefined') global.CTransformer = CTransformer;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
