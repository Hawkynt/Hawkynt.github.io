/**
 * JavaAST.js - The typed JVM IR shared by the Java and Kotlin targets
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> IL AST -> JavaTransformer (lowering) -> JVM IR
 *           -> JavaEmitter (Java source) or KotlinEmitter (Kotlin source)
 *
 * The IR is a tree of plain objects. Every expression carries `t`, its JVM
 * type; every conversion between types is an explicit node, so a printer for
 * a language without implicit widening (Kotlin) needs no type inference of
 * its own.
 *
 * JVM types are strings:
 *   primitives  'int' 'long' 'double' 'boolean' 'void'
 *   boxed       'Integer' 'Long' 'Double' 'Boolean' (nullable value types)
 *   references  'String' 'BigInteger' 'Object' 'JsObject' 'JsMap' 'JsSet'
 *               'JsFn' 'JsRegExp' 'JsError' and class names
 *   arrays      'U8Array' 'I8Array' 'U16Array' 'I16Array' 'U32Array'
 *               'I32Array' 'I64Array' 'F64Array' 'F32Array' 'BoolArray' and
 *               'JsArray<T>' for references
 *   'null'      the type of the null literal (assignable to any reference)
 *
 * The value of a JavaScript number lives in the narrowest container its IL
 * type allows: int for 8-to-32-bit integers (uint32 excepted), long for
 * uint32 and Number-valued 64-bit integers, double for floating point. Every
 * conversion preserves the JavaScript value; the IL types guarantee it fits.
 */

(function (global) {
  'use strict';

  const PRIMITIVES = new Set(['int', 'long', 'double', 'boolean']);
  const BOXES = { int: 'Integer', long: 'Long', double: 'Double', boolean: 'Boolean' };
  const UNBOXES = { Integer: 'int', Long: 'long', Double: 'double', Boolean: 'boolean' };
  const NUMERIC_RANK = { int: 1, long: 2, double: 3 };

  /** Element JVM type of each primitive array class, and the IL element type it holds. */
  const ARRAY_CLASSES = {
    U8Array: { elem: 'int', il: 'uint8', typed: 'Uint8Array' },
    I8Array: { elem: 'int', il: 'int8', typed: 'Int8Array' },
    U16Array: { elem: 'int', il: 'uint16', typed: 'Uint16Array' },
    I16Array: { elem: 'int', il: 'int16', typed: 'Int16Array' },
    U32Array: { elem: 'long', il: 'uint32', typed: 'Uint32Array' },
    I32Array: { elem: 'int', il: 'int32', typed: 'Int32Array' },
    I64Array: { elem: 'long', il: 'int64', typed: null },
    F64Array: { elem: 'double', il: 'float64', typed: 'Float64Array' },
    F32Array: { elem: 'double', il: 'float32', typed: 'Float32Array' },
    BoolArray: { elem: 'boolean', il: 'boolean', typed: null }
  };
  /** Array class holding each IL element type. */
  const ARRAY_OF_IL = {
    uint8: 'U8Array', byte: 'U8Array', int8: 'I8Array', sbyte: 'I8Array',
    uint16: 'U16Array', word: 'U16Array', int16: 'I16Array', short: 'I16Array',
    uint32: 'U32Array', dword: 'U32Array', int32: 'I32Array', int: 'I32Array',
    float64: 'F64Array', number: 'F64Array', double: 'F64Array', float32: 'F32Array', float: 'F32Array',
    boolean: 'BoolArray', bool: 'BoolArray'
  };
  /** Array class of each JavaScript typed array name. */
  const TYPED_ARRAY_CLASS = {
    Uint8Array: 'U8Array', Uint8ClampedArray: 'U8Array', Int8Array: 'I8Array', Uint16Array: 'U16Array',
    Int16Array: 'I16Array', Uint32Array: 'U32Array', Int32Array: 'I32Array', Float32Array: 'F32Array',
    Float64Array: 'F64Array', BigUint64Array: 'JsArray<BigInteger>', BigInt64Array: 'JsArray<BigInteger>'
  };

  const T = {
    isPrim: t => PRIMITIVES.has(t),
    isNumeric: t => t === 'int' || t === 'long' || t === 'double',
    isIntegral: t => t === 'int' || t === 'long',
    isBoxed: t => !!UNBOXES[t],
    box: t => BOXES[t] || t,
    unbox: t => UNBOXES[t] || t,
    rank: t => NUMERIC_RANK[t] || 0,
    /** The wider of two numeric types. */
    wider: (a, b) => ((NUMERIC_RANK[a] || 0) >= (NUMERIC_RANK[b] || 0) ? a : b),
    isRef: t => !PRIMITIVES.has(t) && t !== 'void',
    isPrimArray: t => !!ARRAY_CLASSES[t],
    isJsArray: t => typeof t === 'string' && t.startsWith('JsArray<'),
    isArray: t => !!ARRAY_CLASSES[t] || (typeof t === 'string' && t.startsWith('JsArray<')),
    /** JVM type of an array's elements. */
    elemOf: t => {
      if (ARRAY_CLASSES[t]) return ARRAY_CLASSES[t].elem;
      if (typeof t === 'string' && t.startsWith('JsArray<')) return t.slice(8, -1);
      return 'Object';
    },
    /** The array class holding elements of JVM type e (references in JsArray). */
    arrayOfElem: e => {
      if (e === 'int') return 'I32Array';
      if (e === 'long') return 'I64Array';
      if (e === 'double') return 'F64Array';
      if (e === 'boolean') return 'BoolArray';
      return `JsArray<${T.box(e)}>`;
    },
    ARRAY_CLASSES, ARRAY_OF_IL, TYPED_ARRAY_CLASS, BOXES, UNBOXES
  };

  // ------------------------------------------------------------------ IR nodes
  // Expressions (all carry t)
  const E = {
    lit: (v, t) => ({ k: 'lit', v, t }),
    nul: (t = 'null') => ({ k: 'lit', v: null, t }),
    str: v => ({ k: 'lit', v: String(v), t: 'String' }),
    bool: v => ({ k: 'lit', v: !!v, t: 'boolean' }),
    int: v => ({ k: 'lit', v, t: 'int' }),
    long: v => ({ k: 'lit', v, t: 'long' }),
    dbl: v => ({ k: 'lit', v, t: 'double' }),
    big: v => ({ k: 'big', v: String(v), t: 'BigInteger' }),
    name: (name, t, extra) => Object.assign({ k: 'name', name, t }, extra),
    self: t => ({ k: 'this', t }),
    sup: t => ({ k: 'super', t }),
    field: (obj, name, t) => ({ k: 'field', obj, name, t }),
    sfield: (owner, name, t) => ({ k: 'sfield', owner, name, t }),
    call: (obj, name, args, t) => ({ k: 'call', obj, name, args, t }),
    scall: (owner, name, args, t) => ({ k: 'scall', owner, name, args, t }),
    fcall: (fn, args, t) => ({ k: 'fcall', fn, args, t }),
    nw: (cls, args, t) => ({ k: 'new', cls, args, t: t || cls }),
    un: (op, e, t) => ({ k: 'un', op, e, t }),
    bin: (op, l, r, t) => ({ k: 'bin', op, l, r, t }),
    cond: (c, a, b, t) => ({ k: 'cond', c, a, b, t }),
    cast: (e, t) => ({ k: 'cast', e, t }),
    assign: (target, v, t) => ({ k: 'assign', target, v, t: t || target.t }),
    inc: (target, op, prefix) => ({ k: 'inc', target, op, prefix, t: target.t }),
    inst: (e, cls) => ({ k: 'instanceof', e, cls, t: 'boolean' }),
    lambda: (params, body, ret) => ({ k: 'lambda', params, body, ret, t: 'JsFn' }),
    anon: (decl) => ({ k: 'anon', decl, t: 'Object' })
  };
  // Statements
  const S = {
    block: body => ({ k: 'block', body }),
    local: (name, t, init, extra) => Object.assign({ k: 'local', name, t, init }, extra),
    expr: e => ({ k: 'expr', e }),
    iff: (c, then, els) => ({ k: 'if', c, then, els }),
    whl: (c, body) => ({ k: 'while', c, body }),
    dowhile: (body, c) => ({ k: 'dowhile', body, c }),
    fr: (init, c, update, body) => ({ k: 'for', init, c, update, body }),
    sw: (disc, cases) => ({ k: 'switch', disc, cases }),
    brk: target => ({ k: 'break', target }),
    cont: target => ({ k: 'continue', target }),
    ret: e => ({ k: 'return', e }),
    thr: e => ({ k: 'throw', e }),
    tri: (block, catchName, catchBody, fin) => ({ k: 'try', block, catchName, catchBody, fin }),
    labeled: body => ({ k: 'labeled', body }),
    fns: (name, decl) => ({ k: 'fns', name, decl })
  };

  const JavaAST = { T, E, S };

  if (typeof module !== 'undefined' && module.exports) module.exports = JavaAST;
  if (global) global.JavaAST = JavaAST;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
