/**
 * RubyEmitter.js - Ruby Code Generator from Ruby AST
 * Prints RubyAST nodes as Ruby source, adding exactly the parentheses Ruby's
 * operator precedence requires.
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference (IL AST) -> Ruby AST -> Ruby Emitter -> Ruby Source
 *
 * Options:
 * - indent: indentation string (default two spaces)
 * - newline/lineEnding: line ending (default '\n')
 * - addComments: emit the file's doc comment (default true)
 */

(function(global) {
  'use strict';

  // Precedence, high binds tighter (Ruby's operator table)
  const PREC = {
    PRIMARY: 20,
    NOT: 18,        // ! ~ unary +
    POW: 17,        // **
    NEG: 16,        // unary -
    MUL: 15,        // * / %
    ADD: 14,        // + -
    SHIFT: 13,      // << >>
    BITAND: 12,     // &
    BITOR: 11,      // | ^
    REL: 10,        // < <= > >=
    EQ: 9,          // == != === =~ <=>
    AND: 8,         // &&
    OR: 7,          // ||
    RANGE: 6,       // .. ...
    TERNARY: 5,     // ? :
    ASSIGN: 3,      // = op=
    LOWEST: 0
  };

  const BINARY_PREC = {
    '**': PREC.POW,
    '*': PREC.MUL, '/': PREC.MUL, '%': PREC.MUL,
    '+': PREC.ADD, '-': PREC.ADD,
    '<<': PREC.SHIFT, '>>': PREC.SHIFT,
    '&': PREC.BITAND,
    '|': PREC.BITOR, '^': PREC.BITOR,
    '<': PREC.REL, '<=': PREC.REL, '>': PREC.REL, '>=': PREC.REL,
    '==': PREC.EQ, '!=': PREC.EQ, '===': PREC.EQ, '=~': PREC.EQ, '<=>': PREC.EQ,
    '&&': PREC.AND, '||': PREC.OR,
    '..': PREC.RANGE, '...': PREC.RANGE
  };

  class RubyEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '  ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
    }

    /** Emit a statement-level node (or a whole module) */
    emit(node) {
      if (!node) return '';
      const method = `emit${node.nodeType}`;
      if (typeof this[method] === 'function') return this[method](node);
      // An expression in statement position
      return this.line(this.expr(node));
    }

    indent() {
      return this.indentString.repeat(this.indentLevel);
    }

    line(content = '') {
      return content ? `${this.indent()}${content}${this.newline}` : this.newline;
    }

    // ========================[ STRUCTURE ]========================

    emitModule(node) {
      let code = '';
      for (const magic of node.magicComments) code += this.line(`# ${magic.name}: ${magic.value}`);
      if (node.magicComments.length) code += this.newline;
      if (node.docComment && this.options.addComments !== false) code += this.emitDocComment(node.docComment) + this.newline;
      for (const item of node.items) code += this.emit(item);
      return code;
    }

    emitDocComment(node) {
      return String(node.text).split('\n').map(l => this.line(l ? `# ${l}` : '#')).join('');
    }

    emitComment(node) {
      return String(node.text).split('\n').map(l => this.line(`# ${l}`)).join('');
    }

    emitRawCode(node) {
      const lines = String(node.code).replace(/\n$/, '').split('\n');
      return lines.map(l => (l.length ? this.indent() + l : '') + this.newline).join('');
    }

    emitModuleDef(node) {
      let code = this.line(`module ${node.name}`);
      this.indentLevel++;
      for (const item of node.body) code += this.emit(item);
      this.indentLevel--;
      return code + this.line('end');
    }

    emitClass(node) {
      let code = this.line(`class ${node.name}${node.superclass ? ' < ' + this.expr(node.superclass, PREC.PRIMARY) : ''}`);
      this.indentLevel++;
      node.body.forEach((member, i) => {
        if (i > 0 && member.nodeType === 'Method') code += this.newline;
        code += this.emit(member);
      });
      this.indentLevel--;
      return code + this.line('end');
    }

    emitAttribute(node) {
      const list = node.names.map(n => `:${n}`).join(', ');
      if (node.isStatic) return this.line(`singleton_class.send(:attr_${node.kind}, ${list})`);
      return this.line(`attr_${node.kind} ${list}`);
    }

    emitMethod(node) {
      const params = node.parameters.map(p => this.emitParameter(p)).join(', ');
      let code = this.line(`def ${node.isStatic ? 'self.' : ''}${node.name}${params ? `(${params})` : ''}`);
      this.indentLevel++;
      code += this.emitStatements(node.body);
      this.indentLevel--;
      return code + this.line('end');
    }

    emitParameter(p) {
      if (p.isRest) return `*${p.name}`;
      return p.defaultValue ? `${p.name} = ${this.expr(p.defaultValue, PREC.TERNARY)}` : p.name;
    }

    // ========================[ STATEMENTS ]========================

    emitStatements(block) {
      if (!block) return '';
      const statements = block.nodeType === 'Block' ? block.statements : [block];
      return statements.map(s => this.emit(s)).join('');
    }

    emitBlock(node) {
      return this.emitStatements(node);
    }

    emitExpressionStatement(node) {
      return this.line(this.expr(node.expression, PREC.LOWEST, true));
    }

    emitReturn(node) {
      return this.line(node.expression ? `return ${this.expr(node.expression, PREC.TERNARY)}` : 'return');
    }

    emitBreak() {
      return this.line('break');
    }

    emitNext() {
      return this.line('next');
    }

    emitRaise(node) {
      return this.line(`raise ${this.expr(node.exception, PREC.TERNARY)}`);
    }

    emitIf(node) {
      let code = this.line(`if ${this.expr(node.condition, PREC.LOWEST)}`);
      code += this.nested(node.thenBranch);
      for (const branch of node.elsifBranches) {
        code += this.line(`elsif ${this.expr(branch.condition, PREC.LOWEST)}`);
        code += this.nested(branch.body);
      }
      if (node.elseBranch && this.hasStatements(node.elseBranch)) {
        code += this.line('else');
        code += this.nested(node.elseBranch);
      }
      return code + this.line('end');
    }

    emitWhile(node) {
      if (node.isDoWhile) {
        let code = this.line('begin');
        code += this.nested(node.body);
        return code + this.line(`end while ${this.expr(node.condition, PREC.LOWEST)}`);
      }
      let code = this.line(`while ${this.expr(node.condition, PREC.LOWEST)}`);
      code += this.nested(node.body);
      return code + this.line('end');
    }

    emitFor(node) {
      let code = this.line(`for ${node.variable} in ${this.expr(node.iterable, PREC.LOWEST)}`);
      code += this.nested(node.body);
      return code + this.line('end');
    }

    emitCase(node) {
      let code = this.line(`case ${this.expr(node.subject, PREC.LOWEST)}`);
      for (const when of node.whens) {
        code += this.line(`when ${when.patterns.map(p => this.expr(p, PREC.TERNARY)).join(', ')}`);
        code += this.nested(when.body);
      }
      if (node.elseBody) {
        code += this.line('else');
        code += this.nested(node.elseBody);
      }
      return code + this.line('end');
    }

    emitBegin(node) {
      let code = this.line('begin');
      code += this.nested(node.body);
      for (const r of node.rescues) {
        const types = r.exceptionTypes && r.exceptionTypes.length ? ' ' + r.exceptionTypes.join(', ') : '';
        code += this.line(`rescue${types}${r.variableName ? ' => ' + r.variableName : ''}`);
        code += this.nested(r.body);
      }
      if (node.ensureBody) {
        code += this.line('ensure');
        code += this.nested(node.ensureBody);
      }
      return code + this.line('end');
    }

    nested(block) {
      this.indentLevel++;
      const code = this.emitStatements(block);
      this.indentLevel--;
      return code;
    }

    hasStatements(block) {
      return block && (block.nodeType !== 'Block' || block.statements.length > 0);
    }

    // ========================[ EXPRESSIONS ]========================

    /**
     * An expression, parenthesized when its precedence is below what the
     * context needs.
     * @param {object} node - expression node
     * @param {number} minPrec - the least precedence the context accepts unparenthesized
     * @param {boolean} [statement] - in statement position (assignments need no parentheses)
     */
    expr(node, minPrec = PREC.LOWEST, statement = false) {
      const [code, prec] = this.exprWithPrec(node, statement);
      return prec < minPrec ? `(${code})` : code;
    }

    exprWithPrec(node, statement = false) {
      if (!node) return ['nil', PREC.PRIMARY];
      switch (node.nodeType) {
        case 'Literal': return this.emitLiteral(node);
        case 'Identifier': return [node.name, PREC.PRIMARY];
        case 'BinaryExpression': return this.emitBinary(node);
        case 'UnaryExpression': return this.emitUnary(node);
        case 'MethodCall': return [this.emitCall(node), PREC.PRIMARY];
        case 'Index': return [`${this.expr(node.target, PREC.PRIMARY)}[${node.indices.map(i => this.expr(i, PREC.TERNARY)).join(', ')}]`, PREC.PRIMARY];
        case 'Assignment': return [`${this.expr(node.target, PREC.PRIMARY)} ${node.operator} ${this.expr(node.value, PREC.ASSIGN)}`, statement ? PREC.LOWEST : PREC.ASSIGN];
        case 'MultipleAssignment': return [`${node.targets.map(t => this.expr(t, PREC.PRIMARY)).join(', ')} = ${this.expr(node.value, PREC.TERNARY)}`, statement ? PREC.LOWEST : -1];
        case 'ArrayLiteral': return [`[${node.elements.map(e => this.expr(e, PREC.TERNARY)).join(', ')}]`, PREC.PRIMARY];
        case 'HashLiteral': return [node.pairs.length ? `{ ${node.pairs.map(([k, v]) => `${this.expr(k, PREC.TERNARY)} => ${this.expr(v, PREC.TERNARY)}`).join(', ')} }` : '{}', PREC.PRIMARY];
        case 'Lambda': return [this.emitLambda(node), PREC.PRIMARY];
        case 'Conditional': return [`${this.expr(node.condition, PREC.TERNARY + 1)} ? ${this.expr(node.thenExpr, PREC.TERNARY + 1)} : ${this.expr(node.elseExpr, PREC.TERNARY)}`, PREC.TERNARY];
        case 'Splat': return [`*${this.expr(node.expression, PREC.PRIMARY)}`, PREC.PRIMARY];
        case 'Sequence': return [`(${node.expressions.map(e => this.expr(e, PREC.LOWEST, true)).join('; ')})`, PREC.PRIMARY];
        case 'Super': return [`super(${node.arguments.map(a => this.expr(a, PREC.TERNARY)).join(', ')})`, PREC.PRIMARY];
        case 'RawExpression': return [node.code, node.precedence];
        default: return [`js_unsupported(${JSON.stringify(String(node.nodeType))})`, PREC.PRIMARY];
      }
    }

    emitLiteral(node) {
      const v = node.value;
      switch (node.literalType) {
        case 'nil': return ['nil', PREC.PRIMARY];
        case 'bool': return [v ? 'true' : 'false', PREC.PRIMARY];
        case 'string': return [RubyEmitter.quote(String(v)), PREC.PRIMARY];
        case 'symbol': return [`:${v}`, PREC.PRIMARY];
        case 'int': {
          const text = String(v);
          return [text, text.startsWith('-') ? PREC.NEG : PREC.PRIMARY];
        }
        case 'float': {
          if (Number.isNaN(v)) return ['JS::NAN', PREC.PRIMARY];
          if (v === Infinity) return ['JS::INF', PREC.PRIMARY];
          if (v === -Infinity) return ['-JS::INF', PREC.NEG];
          let text = String(v);
          if (/e/.test(text) && !/\./.test(text.split('e')[0])) text = text.replace('e', '.0e');
          if (!/[.e]/.test(text)) text += '.0';
          return [text, text.startsWith('-') ? PREC.NEG : PREC.PRIMARY];
        }
        default: return [String(v), PREC.PRIMARY];
      }
    }

    emitBinary(node) {
      const op = node.operator;
      const prec = BINARY_PREC[op] !== undefined ? BINARY_PREC[op] : PREC.LOWEST;
      let leftMin = prec;
      let rightMin = prec + 1;
      if (op === '**') {
        leftMin = prec + 1;
        rightMin = PREC.NEG;
      } else if (prec === PREC.EQ || prec === PREC.REL) {
        leftMin = prec + 1;
      }
      return [`${this.expr(node.left, leftMin)} ${op} ${this.expr(node.right, rightMin)}`, prec];
    }

    emitUnary(node) {
      const op = node.operator;
      if (op === '-') {
        const operand = this.expr(node.operand, PREC.PRIMARY);
        return [`-${operand.startsWith('-') ? `(${operand})` : operand}`, PREC.NEG];
      }
      if (op === '!' || op === '~' || op === '+') return [`${op}${this.expr(node.operand, PREC.PRIMARY)}`, PREC.NOT];
      return [`${op} ${this.expr(node.operand, PREC.PRIMARY)}`, PREC.LOWEST];
    }

    emitCall(node) {
      const args = node.arguments.map(a => this.expr(a, PREC.TERNARY)).join(', ');
      let block = '';
      if (node.block) block = ' ' + this.emitBlockExpression(node.block);
      if (node.receiver) {
        const receiver = this.expr(node.receiver, PREC.PRIMARY);
        const safeReceiver = /^-?\d/.test(receiver) ? `(${receiver})` : receiver;
        if (node.useShortCall) return `${safeReceiver}.(${args})${block}`;
        if (!args && !node.forceParens) return `${safeReceiver}.${node.methodName}${block}`;
        return `${safeReceiver}.${node.methodName}(${args})${block}`;
      }
      return `${node.methodName}(${args})${block}`;
    }

    emitLambda(node) {
      const params = node.parameters.map(p => this.emitParameter(p)).join(', ');
      const head = `->(${params})`;
      const body = node.body;
      if (body && body.nodeType !== 'Block') return `${head} { ${this.expr(body, PREC.LOWEST, true)} }`;
      const statements = body ? body.statements : [];
      if (statements.length === 0) return `${head} { nil }`;
      // A multi-line brace body, indented one level below the current line
      this.indentLevel++;
      const inner = statements.map(s => this.emit(s)).join('');
      this.indentLevel--;
      return `${head} {${this.newline}${inner}${this.indent()}}`;
    }

    emitBlockExpression(node) {
      const params = node.parameters.length ? ` |${node.parameters.map(p => this.emitParameter(p)).join(', ')}|` : '';
      const body = node.body;
      if (body && body.nodeType !== 'Block') return `{${params} ${this.expr(body, PREC.LOWEST, true)} }`;
      this.indentLevel++;
      const inner = (body ? body.statements : []).map(s => this.emit(s)).join('');
      this.indentLevel--;
      return `{${params}${this.newline}${inner}${this.indent()}}`;
    }

    /** A Ruby double-quoted string literal of any JavaScript string, ASCII only */
    static quote(text) {
      let out = '"';
      for (const ch of text) {
        const code = ch.codePointAt(0);
        if (ch === '\\') out += '\\\\';
        else if (ch === '"') out += '\\"';
        else if (ch === '#') out += '\\#';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\r') out += '\\r';
        else if (ch === '\t') out += '\\t';
        else if (code < 0x20 || code === 0x7f) out += '\\x' + code.toString(16).padStart(2, '0');
        else if (code > 0x7e) {
          // Lone surrogates have no UTF-8 encoding: the replacement character stands in
          out += (code >= 0xD800 && code <= 0xDFFF) ? '\\u{fffd}' : `\\u{${code.toString(16)}}`;
        } else out += ch;
      }
      return out + '"';
    }
  }

  RubyEmitter.PREC = PREC;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RubyEmitter, PREC };
  }
  if (typeof global !== 'undefined') {
    global.RubyEmitter = RubyEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
