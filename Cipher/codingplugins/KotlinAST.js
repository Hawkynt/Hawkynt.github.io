/**
 * KotlinAST.js - the IR of the Kotlin target
 * (c)2006-2025 Hawkynt
 *
 * The Kotlin target prints the typed JVM IR it shares with the Java target
 * (JavaAST.js); this module names it for the Kotlin pipeline.
 */

(function (global) {
  'use strict';

  let JavaAST;
  if (typeof require !== 'undefined') JavaAST = require('./JavaAST.js');
  else JavaAST = global.JavaAST;

  const KotlinAST = JavaAST;
  if (typeof module !== 'undefined' && module.exports) module.exports = KotlinAST;
  if (global) global.KotlinAST = KotlinAST;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
