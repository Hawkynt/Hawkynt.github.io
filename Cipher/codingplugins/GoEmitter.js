/**
 * GoEmitter.js - Go source from the Go AST
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> IL AST -> GoTransformer -> Go AST -> GoEmitter -> Go Source
 *
 * Prints the nodes of GoAST.js with gofmt-like layout (tabs, one statement
 * per line) and the parentheses Go's operator precedence needs.
 */

(function (global) {
  'use strict';

  // Go binary operator precedence (higher binds tighter)
  const PRECEDENCE = {
    '||': 1, '&&': 2,
    '==': 3, '!=': 3, '<': 3, '<=': 3, '>': 3, '>=': 3,
    '+': 4, '-': 4, '|': 4, '^': 4,
    '*': 5, '/': 5, '%': 5, '<<': 5, '>>': 5, '&': 5, '&^': 5
  };

  class GoEmitter {
    constructor(options = {}) {
      this.indentString = options.indent || '\t';
      this.newline = options.newline || options.lineEnding || '\n';
      this.addComments = options.addComments !== false;
      this.level = 0;
    }

    /**
     * Go source for a node: a File, a declaration, a statement or an expression.
     * @param {Object} node - Go AST node
     * @returns {string} Go source
     */
    emit(node) {
      if (!node) return '';
      if (node.kind === 'File') return this.file(node);
      if (this.isExpression(node)) return this.expr(node);
      return this.stmt(node);
    }

    isExpression(node) {
      return ['Ident', 'Lit', 'Binary', 'Unary', 'Call', 'Selector', 'Index', 'Slice', 'Conv', 'Assert', 'Composite', 'KeyValue', 'FuncLit', 'Paren'].includes(node.kind);
    }

    pad() { return this.indentString.repeat(this.level); }
    line(text) { return this.pad() + text + this.newline; }

    // ----------------------------------------------------------------- file

    file(node) {
      let out = `package ${node.packageName}${this.newline}${this.newline}`;
      if (node.imports && node.imports.length) {
        out += 'import (' + this.newline;
        for (const imp of node.imports) out += `${this.indentString}"${imp}"${this.newline}`;
        out += ')' + this.newline + this.newline;
      }
      for (const decl of node.decls) {
        out += this.decl(decl) + this.newline;
      }
      return out;
    }

    decl(node) {
      switch (node.kind) {
        case 'Raw': return node.code.endsWith('\n') ? node.code : node.code + this.newline;
        case 'Comment': return this.addComments ? this.comment(node.text) : '';
        case 'Struct': {
          let out = node.comment && this.addComments ? this.comment(node.comment) : '';
          out += this.line(`type ${node.name} struct {`);
          ++this.level;
          for (const f of node.fields) out += this.line(`${f.name} ${f.type}` + (f.comment && this.addComments ? ` // ${f.comment}` : ''));
          --this.level;
          return out + this.line('}');
        }
        case 'Interface': {
          let out = node.comment && this.addComments ? this.comment(node.comment) : '';
          out += this.line(`type ${node.name} interface {`);
          ++this.level;
          for (const m of node.methods) out += this.line(m);
          --this.level;
          return out + this.line('}');
        }
        case 'Func': {
          let out = node.comment && this.addComments ? this.comment(node.comment) : '';
          const receiver = node.receiver ? `(${node.receiver.name} ${node.receiver.type}) ` : '';
          out += this.pad() + `func ${receiver}${node.name}(${this.params(node.params)})${this.results(node.results)} `;
          out += this.blockBody(node.body) + this.newline;
          return out;
        }
        case 'VarDecl': return this.line(this.varDecl(node));
        default: return this.stmt(node);
      }
    }

    comment(text) {
      return String(text).split(/\r?\n/).map(l => this.line(`// ${l}`.trimEnd())).join('');
    }

    params(params) {
      return (params || []).map(p => p.name ? `${p.name} ${p.type}` : p.type).join(', ');
    }

    results(results) {
      if (!results || results.length === 0) return '';
      if (results.length === 1 && !results[0].name) return ' ' + (results[0].type || results[0]);
      return ' (' + results.map(r => r.name ? `${r.name} ${r.type}` : (r.type || r)).join(', ') + ')';
    }

    varDecl(node) {
      let text = `var ${node.name}`;
      if (node.type) text += ` ${node.type}`;
      if (node.value) text += ` = ${this.expr(node.value)}`;
      return text;
    }

    /** "{ ... }" with the statements indented one level deeper; no trailing newline. */
    blockBody(block) {
      const stmts = block && block.stmts ? block.stmts : [];
      if (stmts.length === 0) return '{}';
      let out = '{' + this.newline;
      ++this.level;
      for (const s of stmts) out += this.stmt(s);
      --this.level;
      return out + this.pad() + '}';
    }

    // ----------------------------------------------------------- statements

    stmt(node) {
      if (!node) return '';
      switch (node.kind) {
        case 'Raw': return node.code.split(/\r?\n/).map(l => this.line(l)).join('');
        case 'Comment': return this.addComments ? this.comment(node.text) : '';
        case 'Block': return this.line(this.blockBody(node));
        case 'VarDecl': return this.line(this.varDecl(node));
        case 'ExprStmt': return this.line(this.expr(node.expr));
        case 'Assign': return this.line(this.simple(node));
        case 'IncDec': return this.line(this.simple(node));
        case 'Return': return this.line(node.values.length ? `return ${node.values.map(v => this.expr(v)).join(', ')}` : 'return');
        case 'Break': return this.line(node.label ? `break ${node.label}` : 'break');
        case 'Continue': return this.line(node.label ? `continue ${node.label}` : 'continue');
        case 'Fallthrough': return this.line('fallthrough');
        case 'Defer': return this.line(`defer ${this.expr(node.call)}`);
        case 'Labeled': {
          // A label line, then its statement at the same indentation
          const inner = this.stmt(node.stmt);
          return this.pad() + `${node.label}:` + this.newline + inner;
        }
        case 'If': return this.pad() + this.ifChain(node) + this.newline;
        case 'For': {
          let head;
          if (!node.init && !node.post) head = node.cond ? `for ${this.expr(node.cond)} ` : 'for ';
          else head = `for ${node.init ? this.simple(node.init) : ''}; ${node.cond ? this.expr(node.cond) : ''}; ${node.post ? this.simple(node.post) : ''} `;
          const label = node.label ? this.pad() + node.label + ':' + this.newline : '';
          return label + this.pad() + head + this.blockBody(node.body) + this.newline;
        }
        case 'ForRange': {
          const vars = node.key || node.value ? `${node.key || '_'}${node.value ? ', ' + node.value : ''} ${node.define ? ':=' : '='} ` : '';
          const label = node.label ? this.pad() + node.label + ':' + this.newline : '';
          return label + this.pad() + `for ${vars}range ${this.expr(node.expr)} ` + this.blockBody(node.body) + this.newline;
        }
        case 'Switch': {
          const label = node.label ? this.pad() + node.label + ':' + this.newline : '';
          let out = label + this.pad() + 'switch ' + (node.init ? this.simple(node.init) + '; ' : '') + (node.tag ? this.expr(node.tag) + ' ' : '') + '{' + this.newline;
          for (const c of node.cases) {
            out += this.line(c.exprs ? `case ${c.exprs.map(e => this.expr(e)).join(', ')}:` : 'default:');
            ++this.level;
            for (const s of c.body) out += this.stmt(s);
            --this.level;
          }
          return out + this.line('}');
        }
        default:
          if (this.isExpression(node)) return this.line(this.expr(node));
          throw new Error(`GoEmitter: no statement form for ${node.kind}`);
      }
    }

    ifChain(node) {
      let out = 'if ' + (node.init ? this.simple(node.init) + '; ' : '') + this.expr(node.cond) + ' ' + this.blockBody(node.then);
      if (node.otherwise) {
        if (node.otherwise.kind === 'If') out += ' else ' + this.ifChain(node.otherwise);
        else out += ' else ' + this.blockBody(node.otherwise.kind === 'Block' ? node.otherwise : { stmts: [node.otherwise] });
      }
      return out;
    }

    /** A simple statement without indentation or newline (for headers). */
    simple(node) {
      switch (node.kind) {
        case 'Assign': return `${node.lhs.map(e => this.expr(e)).join(', ')} ${node.op} ${node.rhs.map(e => this.expr(e)).join(', ')}`;
        case 'IncDec': return `${this.expr(node.target)}${node.op}`;
        case 'ExprStmt': return this.expr(node.expr);
        case 'VarDecl': return this.varDecl(node);
        default: return this.expr(node);
      }
    }

    // ---------------------------------------------------------- expressions

    expr(node) {
      if (!node) return '';
      switch (node.kind) {
        case 'Ident': return node.name;
        case 'Lit': return node.text;
        case 'Paren': return `(${this.expr(node.operand)})`;
        case 'Binary': {
          const p = PRECEDENCE[node.op] || 0;
          const left = this.operand(node.left, p, false);
          const right = this.operand(node.right, p, true);
          return `${left} ${node.op} ${right}`;
        }
        case 'Unary': {
          const inner = this.expr(node.operand);
          const needs = node.operand.kind === 'Binary' || (node.operand.kind === 'Unary' && node.operand.op === node.op);
          return `${node.op}${needs ? `(${inner})` : inner}`;
        }
        case 'Call': return `${this.postfix(node.fn)}(${node.args.map(a => this.expr(a)).join(', ')}${node.spread ? '...' : ''})`;
        case 'Selector': return `${this.postfix(node.operand)}.${node.name}`;
        case 'Index': return `${this.postfix(node.operand)}[${this.expr(node.index)}]`;
        case 'Slice': return `${this.postfix(node.operand)}[${node.low ? this.expr(node.low) : ''}:${node.high ? this.expr(node.high) : ''}]`;
        case 'Conv': {
          const t = String(node.type);
          const wrapped = /^[\w.]+$/.test(t) ? t : `(${t})`;
          return `${wrapped}(${this.expr(node.operand)})`;
        }
        case 'Assert': return `${this.postfix(node.operand)}.(${node.type})`;
        case 'Composite': return `${node.type}{${node.elems.map(e => this.expr(e)).join(', ')}}`;
        case 'KeyValue': return `${this.expr(node.key)}: ${this.expr(node.value)}`;
        case 'FuncLit': return `func(${this.params(node.params)})${this.results(node.results)} ${this.blockBody(node.body)}`;
        default: throw new Error(`GoEmitter: no expression form for ${node.kind}`);
      }
    }

    /** An operand of a binary operator, parenthesized where precedence needs it. */
    operand(node, parentPrecedence, isRight) {
      const text = this.expr(node);
      if (node.kind === 'Binary') {
        const p = PRECEDENCE[node.op] || 0;
        if (p < parentPrecedence || (isRight && p === parentPrecedence)) return `(${text})`;
      }
      if (node.kind === 'FuncLit') return `(${text})`;
      return text;
    }

    /** An operand of a selector, index or call: anything but a primary expression is parenthesized. */
    postfix(node) {
      const text = this.expr(node);
      return ['Ident', 'Lit', 'Call', 'Selector', 'Index', 'Slice', 'Conv', 'Assert', 'Paren', 'Composite'].includes(node.kind)
        && !(node.kind === 'Lit' && /^-/.test(text)) ? text : `(${text})`;
    }
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { GoEmitter };
  if (global) global.GoEmitter = GoEmitter;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
