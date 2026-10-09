/**
 * PhpTransformer.js - IL AST to PHP AST Transformer
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source → Parser → JS AST → IL Transformer → IL AST → Language Transformer → Language AST → Language Emitter → Language Source
 *
 * The PHP target runs JavaScript semantics on PHP: its AST is the JavaScript
 * reference AST (JavaScriptTransformer, whose output runs every algorithm
 * correctly), each expression annotated with what its IL node says about it,
 * and PhpEmitter spells it in PHP against the runtime (php-runtime.php):
 *   - il.type: the IL result type (decides number, BigInt, string, array or
 *     object operations, and where a bitwise result needs no 32-bit wrap)
 *   - il.kind: the IL node type (StringSlice and ArraySlice are both a
 *     `slice` call in JavaScript, and different operations in PHP)
 * Parameters and variables carry their IL type as well.
 */

(function(global) {
  'use strict';

  let JavaScriptTransformer;
  if (typeof require !== 'undefined') {
    JavaScriptTransformer = require('./JavaScriptTransformer.js').JavaScriptTransformer;
  } else {
    JavaScriptTransformer = global.JavaScriptTransformer;
  }

  /** The IL type of a node: the declared type wins over the inferred one unless it is open */
  const OPEN_TYPES = new Set(['uint64', 'int64', 'object', 'any', 'function', 'null', 'undefined', 'unknown']);
  function ilTypeOf(node) {
    if (!node) return null;
    let t = node.declaredType || node.resultType || null;
    if (typeof node.declaredType === 'string' && node.resultType && OPEN_TYPES.has(node.declaredType)) t = node.resultType;
    if (t && typeof t === 'object') t = t.name || null;
    // A type the IL marks as guessed says nothing
    if (node.typeGuessKind) return null;
    return typeof t === 'string' ? t : null;
  }

  /**
   * IL AST to PHP AST transformer: the JavaScript transformer, annotating.
   */
  class PhpTransformer extends JavaScriptTransformer {
    constructor(options = {}) {
      super(options);
    }

    /** Record what the IL node says on the expression made from it (the outermost node wins). */
    annotate(result, node) {
      if (!result || typeof result !== 'object' || Array.isArray(result) || !node) return result;
      if (!result.nodeType) return result;
      result.il = { type: ilTypeOf(node), kind: node.type, nullable: !!node.nullable };
      return result;
    }

    transformExpression(node) {
      return this.annotate(super.transformExpression(node), node);
    }

    transformNode(node) {
      const result = super.transformNode(node);
      // Statements carry no value; an expression reached through transformNode is annotated
      if (result && !Array.isArray(result) && node && !/Statement$|Declaration$/.test(node.type) && !result.il)
        this.annotate(result, node);
      return result;
    }

    transformParameter(node) {
      const param = super.transformParameter(node);
      let source = node;
      if (node.type === 'AssignmentExpression' && node.left) source = node.left;
      param.il = { type: ilTypeOf(source), kind: 'Parameter' };
      return param;
    }

    transformVariableDeclaration(node) {
      const result = super.transformVariableDeclaration(node);
      const list = Array.isArray(result) ? result : (result ? [result] : []);
      const byName = new Map();
      for (const decl of node.declarations || [])
        if (decl.id && decl.id.type === 'Identifier') byName.set(decl.id.name, decl);
      for (const decl of list) {
        const il = byName.get(decl.name);
        if (il) decl.il = { type: ilTypeOf(il.id) || ilTypeOf(il.init), kind: 'Variable' };
      }
      return result;
    }

    transformMethodDefinition(node) {
      const method = super.transformMethodDefinition(node);
      if (method) method.il = { kind: 'Method', isStatic: !!node.static };
      return method;
    }
  }

  const exports = { PhpTransformer, ilTypeOf };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PhpTransformer = PhpTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
