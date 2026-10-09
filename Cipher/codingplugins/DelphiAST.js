/**
 * DelphiAST.js - Object Pascal syntax tree for the Delphi/Free Pascal target
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: typed IL AST -> DelphiTransformer -> this tree -> DelphiEmitter -> source.
 *
 * The tree is deliberately small: plain objects with a `kind`, built through
 * the factories below. Expressions carry no types (the transformer has already
 * resolved every conversion); the emitter only decides layout and parentheses.
 *
 * Expressions: id, lit, bin, un, call, mem, idx, cast, arr, raw
 * Statements:  assign, expr, if, while, repeat, for, try, raise, exit, break,
 *              continue, goto, label, block, comment, raw
 * Declarations: unit, typeAlias, classDecl, recordDecl, field, method,
 *              property, routine, varDecl, constDecl
 */

(function (global) {
  'use strict';

  // ------------------------------------------------------------ expressions

  /** An identifier (already a valid, unique Pascal name). */
  const id = name => ({ kind: 'id', name });
  /** A literal, given as its Pascal source text. */
  const lit = text => ({ kind: 'lit', text: String(text) });
  /** A binary operation; op is Pascal syntax (+, -, *, /, div, mod, and, or, xor, shl, shr, =, <>, <, >, <=, >=, is, as). */
  const bin = (op, l, r) => ({ kind: 'bin', op, l, r });
  /** A unary operation: not, - or @. */
  const un = (op, e) => ({ kind: 'un', op, e });
  /** A call of a routine or method; fn is an expression (id or mem). */
  const call = (fn, args = []) => ({ kind: 'call', fn: typeof fn === 'string' ? id(fn) : fn, args });
  /** A member access obj.name. */
  const mem = (obj, name) => ({ kind: 'mem', obj, name });
  /** An index access obj[index]. */
  const idx = (obj, index) => ({ kind: 'idx', obj, index });
  /** A value cast Type(e). */
  const cast = (type, e) => ({ kind: 'cast', type, e });
  /** An open array constructor [a, b, c]. */
  const arr = items => ({ kind: 'arr', items });
  /** Source text used verbatim as an expression. */
  const raw = text => ({ kind: 'raw', text });

  // ------------------------------------------------------------ statements

  const assign = (target, value) => ({ kind: 'assign', target, value });
  const expr = e => ({ kind: 'expr', e });
  const ifStmt = (cond, thenBody, elseBody = null) => ({ kind: 'if', cond, then: thenBody, else: elseBody });
  const whileStmt = (cond, body) => ({ kind: 'while', cond, body });
  const repeatStmt = (body, cond) => ({ kind: 'repeat', body, cond });
  const forStmt = (variable, from, to, down, body) => ({ kind: 'for', variable, from, to, down, body });
  /** try body except (on E: T do handler) finally fin end; either part may be null. */
  const tryStmt = (body, handler, fin) => ({ kind: 'try', body, handler, fin });
  const raise = e => ({ kind: 'raise', e });
  const exit = (value = null) => ({ kind: 'exit', value });
  const breakStmt = () => ({ kind: 'break' });
  const continueStmt = () => ({ kind: 'continue' });
  const gotoStmt = label => ({ kind: 'goto', label });
  const label = name => ({ kind: 'label', name });
  const block = body => ({ kind: 'block', body });
  const comment = text => ({ kind: 'comment', text });
  const rawStmt = text => ({ kind: 'rawStmt', text });

  // ------------------------------------------------------------ declarations

  /** A parameter: mode is '', 'const', 'var' or 'out'. */
  const param = (name, type, mode = '', defaultValue = null) => ({ name, type, mode, defaultValue });

  /**
   * A routine: a global function, a nested function or a method body.
   * @param {object} o - { name, owner (class name for methods), kind
   *   ('function'|'procedure'|'constructor'), params, returns, isClassMethod,
   *   directives, labels, vars [{name,type}], nested [routine], body [stmt] }
   */
  const routine = o => Object.assign({
    kind: 'routine', owner: null, routineKind: 'procedure', params: [], returns: null,
    isClassMethod: false, directives: [], labels: [], vars: [], nested: [], body: [], comment: null
  }, o);

  /** A method declaration inside a class. */
  const methodDecl = o => Object.assign({
    kind: 'method', routineKind: 'procedure', params: [], returns: null,
    isClassMethod: false, directives: [], visibility: 'public'
  }, o);
  const field = (name, type, isClassVar = false) => ({ kind: 'field', name, type, isClassVar });
  const property = (name, type, read, write, isClassProp = false) => ({ kind: 'property', name, type, read, write, isClassProp });
  const classDecl = (name, base, members, comment = null) => ({ kind: 'classDecl', name, base, members, comment });
  const forwardClass = name => ({ kind: 'forwardClass', name });
  const recordDecl = (name, fields) => ({ kind: 'recordDecl', name, fields });
  const typeAlias = (name, text) => ({ kind: 'typeAlias', name, text });
  const procType = (name, text) => ({ kind: 'procType', name, text });
  const varDecl = (name, type) => ({ kind: 'varDecl', name, type });
  /** A typed constant: const name: type = valueText; */
  const constDecl = (name, type, valueText) => ({ kind: 'constDecl', name, type, valueText });

  /**
   * A unit.
   * @param {object} o - { name, header (comment lines), interfaceUses,
   *   implementationUses, runtimeInterface, runtimeImplementation,
   *   runtimeInitialization, types [decl], consts [constDecl], vars [varDecl],
   *   forwards [routine], routines [routine], initialization [stmt] }
   */
  const unit = o => Object.assign({
    kind: 'unit', name: 'GeneratedUnit', header: [], interfaceUses: [], implementationUses: [],
    runtimeInterface: '', runtimeImplementation: '', runtimeInitialization: '',
    types: [], consts: [], vars: [], forwards: [], routines: [], initialization: []
  }, o);

  const DelphiAST = {
    id, lit, bin, un, call, mem, idx, cast, arr, raw,
    assign, expr, ifStmt, whileStmt, repeatStmt, forStmt, tryStmt, raise, exit, breakStmt, continueStmt,
    gotoStmt, label, block, comment, rawStmt,
    param, routine, methodDecl, field, property, classDecl, forwardClass, recordDecl, typeAlias, procType,
    varDecl, constDecl, unit
  };

  if (typeof module !== 'undefined' && module.exports)
    module.exports = DelphiAST;
  if (typeof global !== 'undefined' && global)
    global.DelphiAST = DelphiAST;

})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
