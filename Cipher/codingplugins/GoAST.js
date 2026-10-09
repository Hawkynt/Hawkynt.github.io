/**
 * GoAST.js - Go Abstract Syntax Tree node types
 * The language AST GoTransformer builds and GoEmitter prints.
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> IL AST -> GoTransformer -> Go AST -> GoEmitter -> Go Source
 *
 * Every node is a plain object with a `kind`; the factories below are the only
 * way the transformer creates them, so the emitter's switch covers them all.
 */

(function (global) {
  'use strict';

  const GoAST = {
    // ---------------------------------------------------------------- file
    File: (packageName, imports, decls) => ({ kind: 'File', packageName, imports, decls }),
    /** Verbatim Go source (the runtime prelude, the harness glue). */
    Raw: (code) => ({ kind: 'Raw', code }),
    Comment: (text) => ({ kind: 'Comment', text }),

    // -------------------------------------------------------- declarations
    /** type name struct { fields } with fields [{ name, type, comment }] */
    Struct: (name, fields, comment) => ({ kind: 'Struct', name, fields, comment }),
    /** type name interface { methods } with methods as signature strings */
    Interface: (name, methods, comment) => ({ kind: 'Interface', name, methods, comment }),
    /** func (receiver) name(params) results { body }; receiver { name, type } or null */
    Func: (name, receiver, params, results, body, comment) => ({ kind: 'Func', name, receiver, params, results, body, comment }),
    /** var name type = value (package level or local) */
    VarDecl: (name, type, value) => ({ kind: 'VarDecl', name, type, value }),

    // ---------------------------------------------------------- statements
    Block: (stmts) => ({ kind: 'Block', stmts: stmts || [] }),
    ExprStmt: (expr) => ({ kind: 'ExprStmt', expr }),
    /** lhs op rhs with op one of = := += -= ... (lhs, rhs are arrays) */
    Assign: (lhs, op, rhs) => ({ kind: 'Assign', lhs: [].concat(lhs), op, rhs: [].concat(rhs) }),
    IncDec: (target, op) => ({ kind: 'IncDec', target, op }),
    Return: (values) => ({ kind: 'Return', values: values ? [].concat(values) : [] }),
    If: (cond, then, otherwise, init) => ({ kind: 'If', cond, then, otherwise: otherwise || null, init: init || null }),
    /** for init; cond; post { body } - any of init/cond/post may be null */
    For: (init, cond, post, body, label) => ({ kind: 'For', init, cond, post, body, label: label || null }),
    ForRange: (key, value, expr, body, label, define) => ({ kind: 'ForRange', key, value, expr, body, label: label || null, define: define !== false }),
    /** switch init; tag { cases } with cases [{ exprs (null = default), body: [stmts] }] */
    Switch: (tag, cases, label, init) => ({ kind: 'Switch', tag, cases, label: label || null, init: init || null }),
    Break: (label) => ({ kind: 'Break', label: label || null }),
    Continue: (label) => ({ kind: 'Continue', label: label || null }),
    Labeled: (label, stmt) => ({ kind: 'Labeled', label, stmt }),
    Defer: (call) => ({ kind: 'Defer', call }),
    Fallthrough: () => ({ kind: 'Fallthrough' }),

    // --------------------------------------------------------- expressions
    Ident: (name) => ({ kind: 'Ident', name }),
    /** A literal, already in Go spelling (number, "string", true, nil) */
    Lit: (text) => ({ kind: 'Lit', text: String(text) }),
    Binary: (op, left, right) => ({ kind: 'Binary', op, left, right }),
    Unary: (op, operand) => ({ kind: 'Unary', op, operand }),
    Call: (fn, args, spread) => ({ kind: 'Call', fn, args: args || [], spread: !!spread }),
    Selector: (operand, name) => ({ kind: 'Selector', operand, name }),
    Index: (operand, index) => ({ kind: 'Index', operand, index }),
    Slice: (operand, low, high) => ({ kind: 'Slice', operand, low: low || null, high: high || null }),
    /** T(x) */
    Conv: (type, operand) => ({ kind: 'Conv', type, operand }),
    /** x.(T) */
    Assert: (operand, type) => ({ kind: 'Assert', operand, type }),
    /** T{elems}; elems are expressions or KeyValue nodes */
    Composite: (type, elems) => ({ kind: 'Composite', type, elems: elems || [] }),
    KeyValue: (key, value) => ({ kind: 'KeyValue', key, value }),
    /** func(params) results { body } with params [{ name, type }] */
    FuncLit: (params, results, body) => ({ kind: 'FuncLit', params, results, body }),
    Paren: (operand) => ({ kind: 'Paren', operand })
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = GoAST;
  if (global) global.GoAST = GoAST;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
