/**
 * TypeScriptEmitter.js - TypeScript Code Generator from TypeScript AST
 * Generates properly formatted TypeScript source code from the AST of
 * TypeScriptTransformer: the JavaScript emitter's output plus the type
 * annotations (`tsType`) and property declarations (`isDeclare`) the
 * transformer attached.
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: IL AST -> TypeScript Transformer -> TypeScript AST -> TypeScript Emitter -> TypeScript Source
 */

(function(global) {
  'use strict';

  let JavaScriptEmitter;
  if (typeof require !== 'undefined') {
    JavaScriptEmitter = require('./JavaScriptEmitter.js').JavaScriptEmitter;
  } else {
    JavaScriptEmitter = global.JavaScriptEmitter;
  }

  /**
   * TypeScript Code Emitter
   */
  class TypeScriptEmitter extends JavaScriptEmitter {
    /** ': T' for a node carrying a TypeScript type, '' for one without. */
    annotation(node) {
      return node && node.tsType ? `: ${node.tsType}` : '';
    }

    emitProperty(node) {
      if (!node.isDeclare) {
        if (!node.tsType) return super.emitProperty(node);
        let decl = node.isStatic ? 'static ' : '';
        decl += node.name + this.annotation(node);
        if (node.initializer) decl += ` = ${this.emit(node.initializer)}`;
        return this.line(`${decl};`);
      }
      // Declared only for the type checker: erases to nothing, so the
      // property comes into being where the code assigns it, as in JavaScript
      const key = /^[A-Za-z_$][\w$]*$/.test(node.name) ? node.name : JSON.stringify(String(node.name));
      return this.line(`${node.isStatic ? 'static ' : ''}declare ${key}${this.annotation(node) || ': any'};`);
    }

    emitClass(node) {
      // The property declarations stand together, apart from the members after them
      const code = super.emitClass(node);
      return code.replace(/(declare [^\n]*;\n)\n(?=[ \t]*(?:static )?declare )/g, '$1');
    }

    emitParameterDecl(node) {
      let decl = '';
      if (node.isRest) decl += '...';
      decl += node.name;
      if (node.isOptional && !node.isRest && !node.defaultValue) decl += '?';
      decl += this.annotation(node);
      if (node.defaultValue) decl += ` = ${this.emit(node.defaultValue)}`;
      return decl;
    }

    emitMethod(node) {
      // A setter's parameter cannot be optional
      if (node.kind === 'set') for (const p of node.parameters) p.isOptional = false;
      return this.withReturnType(node, super.emitMethod(node));
    }

    emitFunction(node) {
      return this.withReturnType(node, super.emitFunction(node));
    }

    /** The emitted declaration with its return type after the parameter list. */
    withReturnType(node, code) {
      if (!node.tsReturnType) return code;
      // The header is the first line ending in ") {" (after any doc comment)
      const lines = code.split(this.newline);
      const index = lines.findIndex(l => l.trimEnd().endsWith(') {'));
      if (index < 0) return code;
      const header = lines[index];
      const at = header.lastIndexOf(') {');
      lines[index] = header.slice(0, at + 1) + `: ${node.tsReturnType}` + header.slice(at + 1);
      return lines.join(this.newline);
    }

    emitObjectLiteral(node) {
      for (const p of node.properties)
        if (p.kind === 'set' && p.value && p.value.parameters) for (const param of p.value.parameters) param.isOptional = false;
      return super.emitObjectLiteral(node);
    }

    emitTypeAssertion(node) {
      // `as` binds like a relational operator: `a & b as T` is `a & (b as T)`
      return `(${this.emitOperand(node.expression, 11, false, false)} as ${node.tsType})`;
    }

    emitVariableDeclaration(node) {
      let code = `${node.kind} ${node.name}${this.annotation(node)}`;
      if (node.initializer) code += ` = ${this.emit(node.initializer)}`;
      return this.line(`${code};`);
    }

    emitFor(node) {
      // A for-loop's declarations carry their types like any other
      const init = node.initializer;
      const declarations = Array.isArray(init) ? init : (init && init.nodeType === 'VariableDeclaration' ? [init] : null);
      if (!declarations || declarations.length === 0 || declarations[0].nodeType !== 'VariableDeclaration')
        return super.emitFor(node);
      const kind = declarations[0].kind || 'let';
      const parts = declarations.map(d => d.name + this.annotation(d) + (d.initializer ? ` = ${this.emit(d.initializer)}` : ''));
      const cond = node.condition ? this.emit(node.condition) : '';
      const incr = node.incrementor ? this.emit(node.incrementor) : '';
      let code = this.line(`for (${kind} ${parts.join(', ')}; ${cond}; ${incr}) {`);
      this.indentLevel++;
      code += this.emit(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    /**
     * TypeScript accepts a spread argument only for a rest parameter, and a
     * JavaScript function spreads an array into fixed parameters freely; a
     * call that spreads goes through `any` (erased again in the output).
     */
    emitCall(node) {
      if (node.calleeExpression || !node.arguments.some(a => a && a.nodeType === 'SpreadElement'))
        return super.emitCall(node);
      const args = node.arguments.map(a => this.emit(a));
      const callee = (node.target ? `${this.emitCalleeExpression(node.target)}.` : '') + node.methodName;
      return `(${callee} as any)(${args.join(', ')})`;
    }

    emitNew(node) {
      if (!node.arguments.some(a => a && a.nodeType === 'SpreadElement')) return super.emitNew(node);
      const ctor = typeof node.className === 'string' ? node.className : this.emit(node.className);
      return `new (${ctor} as any)(${node.arguments.map(a => this.emit(a)).join(', ')})`;
    }

    emitArrowFunction(node) {
      // A lone typed parameter needs its parentheses: `(x: T) => ...`
      if (!node.isFunctionExpression && node.parameters.length === 1 && node.parameters[0].tsType) {
        const saved = node.parameters;
        const params = `(${saved.map(p => this.emitParameterDecl(p)).join(', ')})`;
        const placeholder = { nodeType: 'Parameter', name: '__TS_PARAMS__', isRest: false, defaultValue: null };
        node.parameters = [placeholder];
        try {
          return super.emitArrowFunction(node).replace(/^__TS_PARAMS__/, params);
        } finally {
          node.parameters = saved;
        }
      }
      return super.emitArrowFunction(node);
    }
  }

  // Export
  const exports = { TypeScriptEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.TypeScriptEmitter = TypeScriptEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
