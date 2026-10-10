/**
 * KotlinTransformer.js - IL AST to the typed JVM IR, for the Kotlin target
 * (c)2006-2025 Hawkynt
 *
 * Kotlin and Java run on the same JVM with the same value model, so the
 * Kotlin target lowers the IL exactly as the Java target does (see
 * JavaTransformer.js) and differs only in how the IR is printed
 * (KotlinEmitter.js).
 */

(function (global) {
  'use strict';

  let JavaTransformer;
  if (typeof require !== 'undefined') JavaTransformer = require('./JavaTransformer.js').JavaTransformer;
  else JavaTransformer = global.JavaTransformer;

  class KotlinTransformer extends JavaTransformer {}

  const exports = { KotlinTransformer };
  if (typeof module !== 'undefined' && module.exports) module.exports = exports;
  if (global) global.KotlinTransformer = KotlinTransformer;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
