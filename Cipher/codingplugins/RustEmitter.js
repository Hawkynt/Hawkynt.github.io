/**
 * RustEmitter.js - Rust source from the Rust AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> IL AST -> RustTransformer -> Rust AST -> RustEmitter -> Rust Source
 *
 * Prints the nodes of RustAST.js with rustfmt-like layout and the parentheses
 * Rust's precedence needs (a cast always gets its own, so `x as u32 < y` never
 * reads as a generic argument list).
 */

(function (global) {
  'use strict';

  // Rust binary operator precedence (higher binds tighter)
  const PRECEDENCE = {
    '||': 1, '&&': 2,
    '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3,
    '|': 4, '^': 5, '&': 6, '<<': 7, '>>': 7,
    '+': 8, '-': 8, '*': 9, '/': 9, '%': 9
  };
  const COMPARISON = new Set(['==', '!=', '<', '<=', '>', '>=']);

  class RustEmitter {
    constructor(options = {}) {
      this.indentString = options.indent || '    ';
      this.newline = options.newline || options.lineEnding || '\n';
      this.addComments = options.addComments !== false;
      this.level = 0;
    }

    /**
     * Rust source for a node: a File, an item, a statement or an expression.
     * @param {Object} node - Rust AST node
     * @returns {string} Rust source
     */
    emit(node) {
      if (!node) return '';
      if (node.kind === 'File') return node.items.map(i => this.item(i)).join(this.newline);
      if (this.isExpression(node)) return this.expr(node);
      return this.item(node);
    }

    isExpression(node) {
      return ['Ident', 'Lit', 'Binary', 'Unary', 'Call', 'MethodCall', 'Field', 'Index', 'Cast', 'Closure', 'BlockExpr', 'IfExpr', 'Macro', 'Ref', 'Paren', 'Tuple'].includes(node.kind);
    }

    pad() { return this.indentString.repeat(this.level); }
    line(text) { return this.pad() + text + this.newline; }

    comment(text) {
      return this.addComments ? String(text).split(/\r?\n/).map(l => this.line(`// ${l}`.trimEnd())).join('') : '';
    }

    // ---------------------------------------------------------------- items

    item(node) {
      switch (node.kind) {
        case 'Raw': return node.code.endsWith('\n') ? node.code : node.code + this.newline;
        case 'Comment': return this.comment(node.text);
        case 'Struct': {
          let out = node.comment ? this.comment(node.comment) : '';
          if (node.derives.length) out += this.line(`#[derive(${node.derives.join(', ')})]`);
          if (!node.fields.length) return out + this.line(`pub struct ${node.name};`);
          out += this.line(`pub struct ${node.name} {`);
          ++this.level;
          for (const f of node.fields) out += this.line(`pub ${f.name}: ${f.type},`);
          --this.level;
          return out + this.line('}');
        }
        case 'Impl': {
          let out = this.line(node.trait ? `impl ${node.trait} for ${node.target} {` : `impl ${node.target} {`);
          ++this.level;
          out += node.items.map(i => this.item(i)).join(this.newline);
          --this.level;
          return out + this.line('}');
        }
        case 'Fn': {
          let out = node.comment ? this.comment(node.comment) : '';
          const params = [];
          if (node.receiver) params.push(node.receiver);
          for (const p of node.params) params.push(`${p.name}: ${p.type}`);
          out += this.pad() + `pub fn ${node.name}(${params.join(', ')})${node.ret ? ' -> ' + node.ret : ''} ` + this.blockText(node.body) + this.newline;
          return out;
        }
        default: return this.stmt(node);
      }
    }

    /** "{ ... }" with statements one level deeper; no trailing newline. */
    blockText(block) {
      const stmts = block && block.stmts ? block.stmts : [];
      const tail = block && block.tail;
      if (!stmts.length && !tail) return '{}';
      let out = '{' + this.newline;
      ++this.level;
      for (const s of stmts) out += this.stmt(s);
      if (tail) out += this.line(this.expr(tail));
      --this.level;
      return out + this.pad() + '}';
    }

    // ----------------------------------------------------------- statements

    stmt(node) {
      if (!node) return '';
      switch (node.kind) {
        case 'Raw': return node.code.split(/\r?\n/).map(l => this.line(l)).join('');
        case 'Comment': return this.comment(node.text);
        case 'Block': return this.line(this.blockText(node));
        case 'Let': {
          let t = `let ${node.mutable ? 'mut ' : ''}${node.name}`;
          if (node.type) t += `: ${node.type}`;
          if (node.init) t += ` = ${this.expr(node.init)}`;
          return this.line(t + ';');
        }
        case 'ExprStmt': {
          const e = this.expr(node.expr);
          // Block-like expressions need no semicolon
          const blockLike = ['IfExpr', 'BlockExpr'].includes(node.expr.kind);
          return this.line(blockLike ? e : e + ';');
        }
        case 'Assign': return this.line(`${this.expr(node.target)} ${node.op} ${this.expr(node.value)};`);
        case 'Return': return this.line(node.value ? `return ${this.expr(node.value)};` : 'return;');
        case 'Break': return this.line(`break${node.label ? ' ' + node.label : ''}${node.value ? ' ' + this.expr(node.value) : ''};`);
        case 'Continue': return this.line(`continue${node.label ? ' ' + node.label : ''};`);
        case 'If': return this.pad() + this.ifText(node) + this.newline;
        case 'While': return this.pad() + (node.label ? node.label + ': ' : '') + `while ${this.expr(node.cond)} ` + this.blockText(node.body) + this.newline;
        case 'Loop': return this.pad() + (node.label ? node.label + ': ' : '') + 'loop ' + this.blockText(node.body) + this.newline;
        case 'For': return this.pad() + (node.label ? node.label + ': ' : '') + `for ${node.pat} in ${this.expr(node.iter)} ` + this.blockText(node.body) + this.newline;
        case 'Match': return this.pad() + this.matchText(node) + this.newline;
        default:
          if (this.isExpression(node)) return this.line(this.expr(node) + ';');
          throw new Error(`RustEmitter: no statement form for ${node.kind}`);
      }
    }

    ifText(node) {
      let out = `if ${this.expr(node.cond)} ` + this.blockText(node.then);
      if (node.otherwise) {
        if (node.otherwise.kind === 'If') out += ' else ' + this.ifText(node.otherwise);
        else out += ' else ' + this.blockText(node.otherwise.kind === 'Block' ? node.otherwise : { stmts: [node.otherwise] });
      }
      return out;
    }

    matchText(node) {
      let out = `match ${this.expr(node.expr)} {` + this.newline;
      ++this.level;
      for (const arm of node.arms) out += this.pad() + `${arm.pat} => ` + this.blockText(arm.body) + this.newline;
      --this.level;
      return out + this.pad() + '}';
    }

    // ---------------------------------------------------------- expressions

    expr(node) {
      if (!node) return '()';
      switch (node.kind) {
        case 'Ident': return node.name;
        case 'Lit': return node.text;
        case 'Raw': return node.code;
        case 'Paren': return `(${this.expr(node.operand)})`;
        case 'Tuple': return `(${node.elems.map(e => this.expr(e)).join(', ')}${node.elems.length === 1 ? ',' : ''})`;
        case 'Binary': {
          const p = PRECEDENCE[node.op] || 0;
          return `${this.operand(node.left, p, false, node.op)} ${node.op} ${this.operand(node.right, p, true, node.op)}`;
        }
        case 'Unary': {
          const inner = this.expr(node.operand);
          const simple = ['Ident', 'Lit', 'Call', 'MethodCall', 'Field', 'Index', 'Paren', 'Macro'].includes(node.operand.kind) && !/^-/.test(inner);
          return `${node.op}${simple ? inner : `(${inner})`}`;
        }
        case 'Call': return `${this.postfix(node.fn)}(${node.args.map(a => this.expr(a)).join(', ')})`;
        case 'MethodCall': return `${this.postfix(node.recv)}.${node.name}${node.turbofish ? `::<${node.turbofish}>` : ''}(${node.args.map(a => this.expr(a)).join(', ')})`;
        case 'Field': return `${this.postfix(node.operand)}.${node.name}`;
        case 'Index': return `${this.postfix(node.operand)}[${this.expr(node.index)}]`;
        case 'Cast': return `${this.castOperand(node.operand)} as ${node.type}`;
        case 'Closure': {
          const params = node.params.map(p => p.type ? `${p.name}: ${p.type}` : p.name).join(', ');
          return `${node.move ? 'move ' : ''}|${params}|${node.ret ? ' -> ' + node.ret : ''} ` + this.blockText(node.body);
        }
        case 'BlockExpr': return this.blockText({ stmts: node.stmts, tail: node.tail });
        case 'IfExpr': return `if ${this.expr(node.cond)} ` + this.blockText(this.asBlock(node.then)) + ' else ' + this.blockText(this.asBlock(node.otherwise));
        case 'Macro': return `${node.name}!(${node.args.map(a => typeof a === 'string' ? a : this.expr(a)).join(', ')})`;
        case 'Ref': return `&${node.mutable ? 'mut ' : ''}${this.postfixOrUnary(node.operand)}`;
        default: throw new Error(`RustEmitter: no expression form for ${node.kind}`);
      }
    }

    asBlock(x) {
      if (!x) return { stmts: [], tail: null };
      if (x.kind === 'Block') return x;
      return { stmts: [], tail: x };
    }

    /** An operand of a binary operator, parenthesized where precedence or parsing needs it. */
    operand(node, parentPrecedence, isRight, parentOp) {
      const text = this.expr(node);
      if (node.kind === 'Binary') {
        const p = PRECEDENCE[node.op] || 0;
        if (p < parentPrecedence || (isRight && p === parentPrecedence) || (COMPARISON.has(node.op) && COMPARISON.has(parentOp))) return `(${text})`;
        return text;
      }
      if (node.kind === 'Cast' || node.kind === 'Closure' || node.kind === 'IfExpr' || node.kind === 'BlockExpr') return `(${text})`;
      return text;
    }

    castOperand(node) {
      const text = this.expr(node);
      return ['Ident', 'Lit', 'Call', 'MethodCall', 'Field', 'Index', 'Paren', 'Macro'].includes(node.kind) && !/^-/.test(text) ? text : `(${text})`;
    }

    postfix(node) {
      const text = this.expr(node);
      return ['Ident', 'Call', 'MethodCall', 'Field', 'Index', 'Paren', 'Macro', 'Tuple'].includes(node.kind) || (node.kind === 'Lit' && /^[a-zA-Z_"]/.test(text) && !/^-/.test(text)) ? text : `(${text})`;
    }

    postfixOrUnary(node) {
      return node.kind === 'Unary' ? this.expr(node) : this.postfix(node);
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { RustEmitter };
  if (global) global.RustEmitter = RustEmitter;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
