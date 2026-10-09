/**
 * TypeScriptAST.js - TypeScript Abstract Syntax Tree Node Types
 * (c)2006-2025 Hawkynt
 *
 * TypeScript code is JavaScript code with types, so the TypeScript AST is the
 * JavaScript AST (JavaScriptAST.js) whose declarations carry two more fields:
 *   - tsType:    the TypeScript type of a parameter, variable or property
 *   - isDeclare: a property declared for the type checker only (`declare x: T;`)
 *
 * Pipeline: IL AST -> TypeScript Transformer -> TypeScript AST -> TypeScript Emitter -> TypeScript Source
 */

(function(global) {
  'use strict';

  let JavaScriptAST;
  if (typeof require !== 'undefined') {
    JavaScriptAST = require('./JavaScriptAST.js');
  } else {
    JavaScriptAST = global.JavaScriptAST;
  }

  const TypeScriptAST = Object.assign({}, JavaScriptAST);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TypeScriptAST;
  }
  if (typeof global !== 'undefined') {
    global.TypeScriptAST = TypeScriptAST;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
