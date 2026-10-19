/**
 * CAST.js - the C file the C transformer produces
 * (c)2006-2025 Hawkynt
 *
 * CTransformer compiles to C text on the JavaScript value runtime (see
 * CTransformer.js), so a file is a list of text sections; CEmitter puts the
 * runtime ahead of them.
 */
(function (global) {
  'use strict';

  /** Base of the C nodes */
  class CNode {
    constructor(nodeType) { this.nodeType = nodeType; }
  }

  /** A section of C text */
  class CRaw extends CNode {
    /** @param {string} text - C source */
    constructor(text) { super('Raw'); this.text = text; }
  }

  /** A C translation unit: the runtime (added by the emitter) and the sections */
  class CFile extends CNode {
    /** @param {CNode[]} sections - the file's sections in order */
    constructor(sections = []) { super('File'); this.sections = sections; }
  }

  const CAST = { CNode, CRaw, CFile };
  if (typeof module !== 'undefined' && module.exports) module.exports = CAST;
  if (typeof global !== 'undefined') global.CAST = CAST;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
