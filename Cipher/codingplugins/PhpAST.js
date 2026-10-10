/**
 * PhpAST.js - PHP Abstract Syntax Tree Node Types
 * (c)2006-2025 Hawkynt
 *
 * The PHP target runs JavaScript semantics on PHP (php-runtime.php), so its
 * AST is the JavaScript AST (JavaScriptAST.js), each node annotated by
 * PhpTransformer with what its IL node says about it:
 *   - il: { type, kind } - the IL result type and the IL node type
 * PhpEmitter spells it in PHP.
 *
 * Pipeline: IL AST -> PHP Transformer -> PHP AST -> PHP Emitter -> PHP Source
 */

(function(global) {
  'use strict';

  let JavaScriptAST;
  if (typeof require !== 'undefined') {
    JavaScriptAST = require('./JavaScriptAST.js');
  } else {
    JavaScriptAST = global.JavaScriptAST;
  }

  const PhpAST = Object.assign({}, JavaScriptAST);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PhpAST;
  }
  if (typeof global !== 'undefined') {
    global.PhpAST = PhpAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
