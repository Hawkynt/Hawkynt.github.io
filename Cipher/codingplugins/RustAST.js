/**
 * RustAST.js - Rust Abstract Syntax Tree node types
 * The language AST RustTransformer builds and RustEmitter prints.
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> IL AST -> RustTransformer -> Rust AST -> RustEmitter -> Rust Source
 *
 * Every node is a plain object with a `kind`; the factories below are the only
 * way the transformer creates them, so the emitter's switch covers them all.
 */

(function (global) {
  'use strict';

  const RustAST = {
    // ---------------------------------------------------------------- file
    File: (items) => ({ kind: 'File', items }),
    /** Verbatim Rust source (the runtime prelude, generated glue). */
    Raw: (code) => ({ kind: 'Raw', code }),
    Comment: (text) => ({ kind: 'Comment', text }),

    // -------------------------------------------------------------- items
    /** struct name { fields } with fields [{ name, type }] and #[derive(...)] list */
    Struct: (name, fields, derives, comment) => ({ kind: 'Struct', name, fields, derives: derives || [], comment }),
    /** impl [trait for] target { items } */
    Impl: (target, items, trait) => ({ kind: 'Impl', target, items, trait: trait || null }),
    /** fn name(self?, params) -> ret { body }; receiver '&self' or null */
    Fn: (name, receiver, params, ret, body, comment) => ({ kind: 'Fn', name, receiver, params, ret: ret || null, body, comment }),

    // ---------------------------------------------------------- statements
    Block: (stmts, tail) => ({ kind: 'Block', stmts: stmts || [], tail: tail || null }),
    /** let [mut] name[: type] [= init]; */
    Let: (name, type, init, mutable) => ({ kind: 'Let', name, type: type || null, init: init || null, mutable: mutable !== false }),
    /** expr; */
    ExprStmt: (expr) => ({ kind: 'ExprStmt', expr }),
    /** target op value; (op: = += -= ...) */
    Assign: (target, op, value) => ({ kind: 'Assign', target, op, value }),
    Return: (value) => ({ kind: 'Return', value: value || null }),
    If: (cond, then, otherwise) => ({ kind: 'If', cond, then, otherwise: otherwise || null }),
    While: (cond, body, label) => ({ kind: 'While', cond, body, label: label || null }),
    Loop: (body, label) => ({ kind: 'Loop', body, label: label || null }),
    /** for pat in iter { body } */
    For: (pat, iter, body, label) => ({ kind: 'For', pat, iter, body, label: label || null }),
    /** match expr { arms } with arms [{ pat, body: Block|expr }] */
    Match: (expr, arms) => ({ kind: 'Match', expr, arms }),
    Break: (label, value) => ({ kind: 'Break', label: label || null, value: value || null }),
    Continue: (label) => ({ kind: 'Continue', label: label || null }),

    // --------------------------------------------------------- expressions
    Ident: (name) => ({ kind: 'Ident', name }),
    /** A literal in Rust spelling (1u32, "x".to_string(), true) */
    Lit: (text) => ({ kind: 'Lit', text: String(text) }),
    Binary: (op, left, right) => ({ kind: 'Binary', op, left, right }),
    Unary: (op, operand) => ({ kind: 'Unary', op, operand }),
    Call: (fn, args) => ({ kind: 'Call', fn, args: args || [] }),
    /** recv.name::<turbofish>(args) */
    MethodCall: (recv, name, args, turbofish) => ({ kind: 'MethodCall', recv, name, args: args || [], turbofish: turbofish || null }),
    Field: (operand, name) => ({ kind: 'Field', operand, name }),
    Index: (operand, index) => ({ kind: 'Index', operand, index }),
    /** expr as type */
    Cast: (operand, type) => ({ kind: 'Cast', operand, type }),
    /** |params| -> ret { body } (move closure when move is set) */
    Closure: (params, ret, body, move) => ({ kind: 'Closure', params, ret: ret || null, body, move: !!move }),
    /** A block as an expression: { stmts; tail } */
    BlockExpr: (stmts, tail) => ({ kind: 'BlockExpr', stmts: stmts || [], tail }),
    /** if cond { a } else { b } as an expression */
    IfExpr: (cond, then, otherwise) => ({ kind: 'IfExpr', cond, then, otherwise }),
    /** name!(args) */
    Macro: (name, args) => ({ kind: 'Macro', name, args: args || [] }),
    /** &expr / &mut expr */
    Ref: (operand, mutable) => ({ kind: 'Ref', operand, mutable: !!mutable }),
    Paren: (operand) => ({ kind: 'Paren', operand }),
    Tuple: (elems) => ({ kind: 'Tuple', elems })
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = RustAST;
  if (global) global.RustAST = RustAST;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
