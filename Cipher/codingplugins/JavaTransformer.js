/**
 * JavaTransformer.js - IL AST to the typed JVM IR (shared by Java and Kotlin)
 * (c)2006-2025 Hawkynt
 *
 * Lowers the typed IL AST into the JVM IR of JavaAST.js. The rules:
 *
 * - Every value keeps its exact JavaScript value. The IL type of a site picks
 *   the JVM container (see JavaAST.js); operators follow JavaScript: & | ^ <<
 *   >> work on ToInt32 of their operands and yield int, >>> yields a uint32
 *   in a long, + - * compute in the widest of their operands' containers and
 *   the IL result's, / is always floating point.
 * - 64-bit integer sites hold a BigInt or a Number in JavaScript; which one
 *   is inferred from the values that flow into them (literals, BigInt(),
 *   64-bit packs and rotations, BigInt-typed operands), never from names.
 *   BigInt values live in java.math.BigInteger.
 * - Arrays are reference-semantics growable arrays (U8Array, ..., JsArray<T>)
 *   of the runtime; a typed array is the same class with a fixed length.
 * - Plain objects are JsObject, functions as values JsFn; members a class
 *   does not declare are reached through the runtime's reflective access.
 * - A method overriding a framework or local base method takes the base's
 *   JVM signature, so dispatch works as in JavaScript.
 *
 * The runtime the IR calls into (Js, OpCodes, the arrays, the framework) is
 * emitted with the code; see java.js and kotlin.js.
 */

(function (global) {
  'use strict';

  let JavaAST;
  if (typeof require !== 'undefined') JavaAST = require('./JavaAST.js');
  else JavaAST = global.JavaAST;
  const { T, E, S } = JavaAST;

  // ===================================================================
  // Names
  // ===================================================================

  const RESERVED = new Set([
    // Java
    'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const', 'continue',
    'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if',
    'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private',
    'protected', 'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this',
    'throw', 'throws', 'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null', 'var',
    'record', 'yield', '_', 'sealed', 'permits',
    // Kotlin hard keywords
    'as', 'fun', 'in', 'is', 'object', 'typealias', 'typeof', 'val', 'when',
    // runtime and java.lang names a local must not shadow
    'Js', 'JsArray', 'JsObject', 'JsMap', 'JsSet', 'JsFn', 'JsError', 'JsRegExp', 'OpCodes', 'Math', 'String',
    'Object', 'Integer', 'Long', 'Double', 'Boolean', 'System', 'BigInteger', 'AlgorithmFramework',
    'U8Array', 'I8Array', 'U16Array', 'I16Array', 'U32Array', 'I32Array', 'I64Array', 'F64Array', 'F32Array', 'BoolArray',
    'IntRef', 'LongRef', 'DoubleRef', 'BoolRef', 'Ref', 'Character', 'Number', 'Array', 'Exception', 'Error',
    'Unit', 'Any', 'Int', 'Nothing', 'it'
  ]);

  /** A JavaScript identifier as a JVM identifier. */
  function jid(name) {
    let n = String(name).replace(/[^A-Za-z0-9_$]/g, c => '_u' + c.charCodeAt(0).toString(16) + '_');
    if (/^[0-9]/.test(n)) n = '_' + n;
    if (n.includes('$')) n = n.replace(/\$/g, '_S_');
    return RESERVED.has(n) ? n + '_' : n;
  }

  /** A member name (fields and methods may reuse names a local may not). */
  function mid(name) {
    let n = String(name).replace(/[^A-Za-z0-9_$]/g, c => '_u' + c.charCodeAt(0).toString(16) + '_');
    if (/^[0-9]/.test(n)) n = '_' + n;
    if (n.includes('$')) n = n.replace(/\$/g, '_S_');
    const keyword = new Set(['abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const',
      'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float', 'for', 'goto', 'if',
      'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new', 'package', 'private', 'protected',
      'public', 'return', 'short', 'static', 'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
      'transient', 'try', 'void', 'volatile', 'while', 'true', 'false', 'null', 'var', '_', 'as', 'fun', 'in', 'is',
      'object', 'typealias', 'typeof', 'val', 'when', 'getClass', 'hashCode', 'equals', 'toString', 'clone', 'notify',
      'notifyAll', 'wait', 'finalize']);
    return keyword.has(n) ? n + '_' : n;
  }

  // ===================================================================
  // IL types
  // ===================================================================

  /** The IL type of a resultType value as a string ('' when none). */
  function ilName(t) {
    if (t === null || t === undefined) return '';
    if (typeof t === 'string') return t;
    if (typeof t === 'object' && typeof t.name === 'string') return t.isArray && !t.name.endsWith('[]') ? t.name + '[]' : t.name;
    return '';
  }

  const IL_ALIAS = {
    byte: 'uint8', word: 'uint16', dword: 'uint32', qword: 'uint64', sbyte: 'int8', short: 'int16',
    int: 'int32', long: 'int64', bool: 'boolean', Boolean: 'boolean', String: 'string', float: 'float32',
    double: 'float64', BigInt: 'bigint', Number: 'number', Int: 'int32', UInt: 'uint32'
  };
  function ilNorm(t) {
    const n = ilName(t).trim();
    return IL_ALIAS[n] || n;
  }
  function tupleParts(type) {
    if (typeof type !== 'string' || type.length < 3 || type[0] !== '[' || !type.endsWith(']') || type.endsWith('[]')) return null;
    const parts = [];
    let depth = 0, start = 1;
    for (let i = 1; i < type.length - 1; ++i) {
      const c = type[i];
      if (c === '[' || c === '<' || c === '(' || c === '{') ++depth;
      else if (c === ']' || c === '>' || c === ')' || c === '}') { if (--depth < 0) return null; }
      else if (c === ',' && depth === 0) { parts.push(type.slice(start, i)); start = i + 1; }
    }
    if (depth !== 0) return null;
    parts.push(type.slice(start, type.length - 1));
    return parts;
  }
  const INT_IL = new Set(['uint8', 'int8', 'uint16', 'int16', 'int32']);
  const IL64 = new Set(['uint64', 'int64']);
  const FLOAT_IL = new Set(['float32', 'float64', 'number']);

  // ===================================================================
  // The framework surface (mirrors the runtime's framework classes)
  // ===================================================================

  const FRAMEWORK = {
    LinkItem: { fields: { text: 'String', uri: 'String' }, ctors: [['String', 'String'], ['String']] },
    TestCase: {
      ext: 'LinkItem', dynamic: true, fields: { input: 'U8Array', expected: 'U8Array' },
      ctors: [['U8Array', 'U8Array', 'String', 'String'], ['U8Array', 'U8Array', 'String'], ['U8Array', 'U8Array']]
    },
    Vulnerability: {
      ext: 'LinkItem', fields: { description: 'String', mitigation: 'String' },
      ctors: [['String', 'String', 'String', 'String'], ['String', 'String', 'String'], ['String', 'String'], ['String']]
    },
    AuthResult: { fields: { Success: 'boolean', Output: 'U8Array', FailureReason: 'String' }, ctors: [['boolean', 'U8Array', 'String'], ['boolean', 'U8Array'], ['boolean']] },
    KeySize: { fields: { minSize: 'int', maxSize: 'int', stepSize: 'int' }, ctors: [['int', 'int', 'int'], ['int', 'int']] },
    BlockAbsorber: {
      fields: { _blockSize: 'int', _processBlock: 'JsFn', _held: 'U8Array', _pending: 'int', _length: 'long' },
      accessors: { BlockSize: ['int', false], Pending: ['int', false], Length: ['long', false] },
      methods: { Absorb: [['U8Array'], 'void'], Finish: [['JsFn'], 'Object'], Reset: [[], 'void'] },
      ctors: [['int', 'JsFn']]
    },
    IAlgorithmInstance: {
      abstract: true, fields: { algorithm: 'Algorithm', isInverse: 'boolean', inputBuffer: 'U8Array' },
      methods: { Feed: [['U8Array'], 'void'], Result: [[], 'U8Array'], Dispose: [[], 'void'] },
      ctors: [['Algorithm'], []]
    },
    Algorithm: {
      abstract: true,
      fields: {
        name: 'String', description: 'String', inventor: 'String', year: 'int', category: 'CategoryType',
        subCategory: 'String', securityStatus: 'SecurityStatus', complexity: 'ComplexityType', country: 'CountryCode',
        documentation: 'JsArray<LinkItem>', references: 'JsArray<LinkItem>', knownVulnerabilities: 'JsArray<Vulnerability>',
        tests: 'JsArray<TestCase>'
      },
      methods: { CreateInstance: [['boolean'], 'IAlgorithmInstance', 0] },
      ctors: [[]]
    },
    CryptoAlgorithm: { ext: 'Algorithm', abstract: true, ctors: [[]] },
    SymmetricCipherAlgorithm: { ext: 'CryptoAlgorithm', abstract: true, ctors: [[]] },
    AsymmetricCipherAlgorithm: { ext: 'CryptoAlgorithm', abstract: true, ctors: [[]] },
    BlockCipherAlgorithm: { ext: 'SymmetricCipherAlgorithm', abstract: true, fields: { SupportedKeySizes: 'JsArray<KeySize>', SupportedBlockSizes: 'JsArray<KeySize>' }, ctors: [[]] },
    StreamCipherAlgorithm: { ext: 'SymmetricCipherAlgorithm', abstract: true, ctors: [[]] },
    EncodingAlgorithm: { ext: 'Algorithm', abstract: true, ctors: [[]] },
    CompressionAlgorithm: { ext: 'Algorithm', abstract: true, ctors: [[]] },
    ErrorCorrectionAlgorithm: { ext: 'Algorithm', abstract: true, ctors: [[]] },
    HashFunctionAlgorithm: { ext: 'Algorithm', abstract: true, fields: { SupportedOutputSizes: 'JsArray<KeySize>' }, ctors: [[]] },
    MacAlgorithm: { ext: 'Algorithm', abstract: true, fields: { SupportedMacSizes: 'JsArray<KeySize>', NeedsKey: 'boolean' }, ctors: [[]] },
    KdfAlgorithm: { ext: 'Algorithm', abstract: true, fields: { SupportedOutputSizes: 'JsArray<KeySize>', SaltRequired: 'boolean' }, ctors: [[]] },
    PaddingAlgorithm: { ext: 'Algorithm', abstract: true, fields: { IsLengthIncluded: 'boolean' }, ctors: [[]] },
    CipherModeAlgorithm: { ext: 'Algorithm', abstract: true, fields: { RequiresIV: 'boolean', SupportedIVSizes: 'JsArray<KeySize>' }, ctors: [[]] },
    AeadAlgorithm: { ext: 'CryptoAlgorithm', abstract: true, fields: { SupportedTagSizes: 'JsArray<KeySize>', SupportsDetached: 'boolean' }, ctors: [[]] },
    RandomGenerationAlgorithm: { ext: 'Algorithm', abstract: true, fields: { IsDeterministic: 'boolean', IsCryptographicallySecure: 'boolean', SupportedSeedSizes: 'JsArray<KeySize>' }, ctors: [[]] },
    IBlockCipherInstance: {
      ext: 'IAlgorithmInstance', abstract: true, fields: { BlockSize: 'int', KeySize: 'int', _key: 'U8Array' },
      accessors: { key: ['U8Array', true] },
      methods: { EncryptBlock: [['U8Array'], 'U8Array'], DecryptBlock: [['U8Array'], 'U8Array'], RequireBlockMultiple: [['int'], 'int', 0] },
      ctors: [['Algorithm'], []]
    },
    IHashFunctionInstance: { ext: 'IAlgorithmInstance', abstract: true, fields: { OutputSize: 'int' }, ctors: [['Algorithm'], []] },
    IMacInstance: { ext: 'IAlgorithmInstance', abstract: true, methods: { ComputeMac: [['U8Array'], 'U8Array'] }, ctors: [['Algorithm'], []] },
    IKdfInstance: { ext: 'IAlgorithmInstance', abstract: true, fields: { OutputSize: 'int', Iterations: 'int' }, ctors: [['Algorithm'], []] },
    IAeadInstance: { ext: 'IAlgorithmInstance', abstract: true, fields: { aad: 'U8Array', tagSize: 'int' }, ctors: [['Algorithm'], []] },
    IErrorCorrectionInstance: { ext: 'IAlgorithmInstance', abstract: true, methods: { DetectError: [['U8Array'], 'boolean'] }, ctors: [['Algorithm'], []] },
    IRandomGeneratorInstance: { ext: 'IAlgorithmInstance', abstract: true, methods: { NextBytes: [['int'], 'U8Array'] }, ctors: [['Algorithm'], []] },
    CategoryType: { enumLike: true, fields: { name: 'String', color: 'String', icon: 'String', description: 'String' } },
    SecurityStatus: { enumLike: true, fields: { name: 'String', color: 'String', icon: 'String' } },
    ComplexityType: { enumLike: true, fields: { name: 'String', color: 'String', level: 'int' } },
    CountryCode: { enumLike: true, fields: { name: 'String', icon: 'String' } },
    _BitStream: {
      fields: { buffer: 'int', bufferBits: 'int', byteArray: 'U8Array', readPosition: 'int', totalBitsWritten: 'int' },
      methods: {
        writeBits: [['long', 'long'], 'void'], writeBit: [['long'], 'void'], writeByte: [['long'], 'void'], writeBytes: [['U8Array'], 'void'],
        writeUint16BE: [['long'], 'void'], writeUint16LE: [['long'], 'void'], writeUint32BE: [['long'], 'void'], writeUint32LE: [['long'], 'void'],
        readBits: [['long'], 'long'], readBit: [[], 'long'], readByte: [[], 'int'], readBytes: [['long'], 'U8Array'], peekBits: [['long'], 'long'],
        skipBits: [['long'], 'void'], hasMoreBits: [[], 'boolean'], getRemainingBits: [[], 'int'], resetReadPosition: [[], 'void'],
        seekBits: [['long'], 'void'], toArray: [['boolean'], 'U8Array', 0], getBitLength: [[], 'int'], getByteLength: [[], 'int'],
        clear: [[], 'void'], clone: [[], '_BitStream'], writeVarInt: [['long'], 'void'], readVarInt: [[], 'long'], writeUnary: [['long'], 'void'],
        readUnary: [[], 'int'], alignToByte: [[], 'void'], isAligned: [[], 'boolean']
      },
      ctors: [['U8Array'], []]
    }
  };
  const FRAMEWORK_STATICS = {
    RegisterAlgorithm: [['Algorithm'], 'void'],
    Find: [['String'], 'Algorithm'],
    Clear: [[], 'void'],
    SpongePadBlocks: [['U8Array', 'int', 'int', 'int'], 'JsArray<U8Array>'],
    MerkleDamgardBlocks: [['U8Array', 'int', 'double', 'JsObject'], 'JsArray<U8Array>']
  };
  const ENUM_CONSTANTS = {
    CategoryType: ['ASYMMETRIC', 'BLOCK', 'STREAM', 'HASH', 'CHECKSUM', 'COMPRESSION', 'ENCODING', 'CLASSICAL', 'MAC', 'KDF', 'ECC', 'MODE', 'PADDING', 'AEAD', 'SPECIAL', 'PQC', 'RANDOM'],
    SecurityStatus: ['SECURE', 'DEPRECATED', 'BROKEN', 'OBSOLETE', 'EXPERIMENTAL', 'EDUCATIONAL'],
    ComplexityType: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'RESEARCH'],
    CountryCode: ['US', 'RU', 'CN', 'UA', 'DE', 'GB', 'FR', 'JP', 'KR', 'IL', 'BE', 'CA', 'AU', 'IT', 'NL', 'CH', 'SE', 'NO', 'IN', 'BR', 'INTL', 'ANCIENT', 'UNKNOWN']
  };

  /** Runtime OpCodes: [JVM parameter types, JVM return type, minimum arguments]. '*' passes the argument as it is; 'same' returns the first argument's type. */
  const OPCODES = {
    GetByte: [['long', 'long'], 'int'], GF256Mul: [['long', 'long'], 'int'],
    RotL64n: [['BigInteger', 'long'], 'BigInteger'], RotR64n: [['BigInteger', 'long'], 'BigInteger'],
    RotL128n: [['BigInteger', 'long'], 'BigInteger'], RotR128n: [['BigInteger', 'long'], 'BigInteger'],
    ShiftLn: [['BigInteger', 'long'], 'BigInteger'], ShiftRn: [['BigInteger', 'long'], 'BigInteger'],
    CreateArray: [['double', 'double'], 'U8Array', 1], Hex32ToDWords: [['String'], 'U32Array'], CopyArray: [['*'], 'same'],
    SetBit: [['long', 'long', 'boolean'], 'long'], ConcatArrays: [['Object'], 'U8Array'], GetBit: [['long', 'long'], 'boolean'],
    SecureCompare: [['Object', 'Object'], 'boolean'], ConstantTimeCompare: [['Object', 'Object', 'double'], 'boolean', 2],
    ArraysEqual: [['Object', 'Object'], 'boolean'], CompareArrays: [['Object', 'Object'], 'boolean'],
    BytesToChars: [['Object'], 'String'], CreateBitStream: [['U8Array'], '_BitStream', 0], ToLong: [['BigInteger'], 'BigInteger'],
    ToQWord: [['BigInteger'], 'BigInteger'], BitMask: [['long'], 'long'], Shr32Signed: [['long', 'long'], 'int'],
    SecureRandomBytes: [['double'], 'U8Array'], MulHi32: [['long', 'long'], 'long'],
    ArraySlice: [['Object', 'double', 'double'], 'U8Array', 2], GFMul: [['long', 'long', 'long', 'long'], 'long'],
    BitCountN: [['BigInteger'], 'int'], RotL64_HL: [['long', 'long', 'long'], 'JsObject'], RotR64_HL: [['long', 'long', 'long'], 'JsObject'],
    GcdN: [['BigInteger', 'BigInteger'], 'BigInteger'], PopCount: [['long'], 'int'], PopCountFast: [['long'], 'int'],
    AddMod: [['long', 'long', 'long'], 'int'], SubMod: [['long', 'long', 'long'], 'int'],
    Words32ToBytesBE: [['Object'], 'U8Array'], BytesToWords32BE: [['Object'], 'U32Array'], EncodeMsgLength64LE: [['double'], 'U8Array'],
    SquareModN: [['BigInteger', 'BigInteger'], 'BigInteger'], Split64: [['double'], 'JsObject'], ModN: [['BigInteger', 'BigInteger'], 'BigInteger'],
    GetBitN: [['BigInteger', 'long'], 'BigInteger'], SetBitN: [['BigInteger', 'long', 'BigInteger'], 'BigInteger'],
    MulModN: [['BigInteger', 'BigInteger', 'BigInteger'], 'BigInteger'], ModPowN: [['BigInteger', 'BigInteger', 'BigInteger'], 'BigInteger'],
    ModInverseN: [['BigInteger', 'BigInteger'], 'BigInteger'], AndN: [['BigInteger', 'BigInteger'], 'BigInteger'],
    OrN: [['BigInteger', 'BigInteger'], 'BigInteger'], XorN: [['BigInteger', 'BigInteger'], 'BigInteger'],
    Add3L64: [['long', 'long', 'long'], 'long'], Add3H64: [['double', 'double', 'double', 'double'], 'int'],
    GHashMul: [['U8Array', 'U8Array'], 'U8Array'], GCMIncrement: [['U8Array'], 'U8Array'],
    CreateUint64ArrayFromHex: [['Object'], 'JsArray<U32Array>'], ToShort: [['long'], 'int'], ToSByte: [['long'], 'int'],
    XorArrayWithByte: [['Object', 'long'], 'U8Array'], XorArrays: [['Object', 'Object'], 'U8Array'], ClearArray: [['Object'], 'void'],
    Hex8ToBytes: [['String'], 'U8Array'], BytesToHex: [['Object'], 'String'],
    RotL8: [['long', 'long'], 'int'], RotR8: [['long', 'long'], 'int'], RotL16: [['long', 'long'], 'int'], RotR16: [['long', 'long'], 'int'],
    RotL32: [['long', 'long'], 'long'], RotR32: [['long', 'long'], 'long'],
    Unpack16BE: [['long'], 'U8Array'], Unpack16LE: [['long'], 'U8Array'], Unpack32BE: [['long'], 'U8Array'], Unpack32LE: [['long'], 'U8Array'],
    Unpack64BE: [['Object'], 'U8Array'], Unpack64LE: [['Object'], 'U8Array'],
    Pack16BE: [['int', 'int'], 'int'], Pack16LE: [['int', 'int'], 'int'],
    Pack32BE: [['int', 'int', 'int', 'int'], 'long'], Pack32LE: [['int', 'int', 'int', 'int'], 'long'],
    Pack64BE: [['int', 'int', 'int', 'int', 'int', 'int', 'int', 'int'], 'BigInteger'], Pack64LE: [['int', 'int', 'int', 'int', 'int', 'int', 'int', 'int'], 'BigInteger']
  };

  const MAX_INT = 2147483647, MIN_INT = -2147483648;

  const SKIP_KEYS = new Set(['parent', 'loc', 'range', 'typeInfo', 'jsDoc', 'leadingComments', 'trailingComments', 'resultType', 'typeAnnotation', 'declaredReturnType', 'contextType', 'targetType']);
  /** Annotate an IL node without making the annotation a child: other transformers walk the same AST. */
  function mark(node, key, value) {
    Object.defineProperty(node, key, { value, writable: true, configurable: true, enumerable: false });
    return value;
  }

  /**
   * The declarations of a .data library: an IIFE wrapper the IL kept is opened,
   * its module-export branches (module.exports, define, this.X =) and returns dropped.
   */
  function libraryStatements(ast) {
    let body = (ast && ast.body) || [];
    if (body.length === 1 && body[0].type === 'ExpressionStatement' && body[0].expression && body[0].expression.type === 'CallExpression') {
      let callee = body[0].expression.callee;
      if (callee && callee.type === 'MemberExpression' && callee.object && (callee.object.type === 'FunctionExpression' || callee.object.type === 'ArrowFunction')) callee = callee.object;
      // UMD: the factory is the last function argument; a plain IIFE runs its own body
      const args = body[0].expression.arguments || [];
      const factory = [...args].reverse().find(x => x && (x.type === 'FunctionExpression' || x.type === 'ArrowFunction'));
      if (factory && factory.body && factory.body.body) body = factory.body.body;
      else if (callee && (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunction') && callee.body && callee.body.body) body = callee.body.body;
    }
    const mentionsModule = n => JSON.stringify(n, (k, v) => (k === 'parent' || k.startsWith('__') ? undefined : v)).match(/"name":"(module|define|exports)"/);
    return body.filter(st => st && st.type !== 'ReturnStatement' && !(st.type === 'IfStatement' && mentionsModule(st.test)) &&
      !(st.type === 'ExpressionStatement' && st.expression && st.expression.type === 'Literal'));
  }

  /**
   * Fold left-deep chains of '+' whose operands are all string literals (tables
   * spelled as thousands of concatenated hex strings) into one literal, without
   * recursing down the chain.
   */
  function foldStringChains(root) {
    const stack = [root];
    const seen = new Set();
    while (stack.length) {
      const n = stack.pop();
      if (!n || typeof n !== 'object' || seen.has(n)) continue;
      seen.add(n);
      if (Array.isArray(n)) { for (const c of n) stack.push(c); continue; }
      for (const k of Object.keys(n)) {
        if (SKIP_KEYS.has(k) || k.startsWith('__')) continue;
        let v = n[k];
        if (v && typeof v === 'object' && v.type === 'BinaryExpression' && v.operator === '+') {
          const parts = [];
          let spine = v;
          while (spine && spine.type === 'BinaryExpression' && spine.operator === '+') { parts.push(spine.right); spine = spine.left; }
          parts.push(spine);
          if (parts.length > 2 && parts.every(p => p && p.type === 'Literal' && typeof p.value === 'string')) {
            n[k] = { type: 'Literal', value: parts.reverse().map(p => p.value).join(''), resultType: 'string', ilNodeType: 'Literal' };
            continue;
          }
        }
        if (v && typeof v === 'object') stack.push(v);
      }
    }
  }

  /** Call f with every child node (object) of an IL node; the lowering's own annotations (__x) are not children. */
  function eachChild(n, f) {
    for (const k of Object.keys(n)) {
      if (SKIP_KEYS.has(k) || k.startsWith('__')) continue;
      const v = n[k];
      if (v && typeof v === 'object') f(v);
    }
  }

  /** Thrown for IL the lowering cannot express; the plugin reports it as a transpile failure. */
  class LoweringError extends Error {}

  // ===================================================================
  // The transformer
  // ===================================================================

  class JavaTransformer {
    constructor(options = {}) {
      this.options = options;
      this.warnings = [];
      this.uid = 0;
    }

    /**
     * Lower an IL program to a JVM IR unit.
     * @param {Object} il - IL AST (Program)
     * @returns {Object} { k: 'unit', name, classes, fields, methods, init }
     */
    transform(il, extra = {}) {
      this.il = il;
      this.libraries = extra.libraries || [];
      this.unitName = mid(this.options.className || 'GeneratedClass');
      this.classes = new Map();      // name -> class info (local and framework)
      this.functions = new Map();    // module function symbol -> fn info
      this.moduleVars = new Map();   // module variable symbol -> symbol
      this.moduleNames = new Set();  // JVM names of module members (a library may reuse a JavaScript name)
      this.unit = { k: 'unit', name: this.unitName, classes: [], fields: [], methods: [], init: [] };
      for (const [name, def] of Object.entries(FRAMEWORK)) this.addFrameworkClass(name, def);
      const body = il && il.type === 'Program' ? il.body : (Array.isArray(il) ? il : [il]);
      // .data libraries the module takes as a factory parameter: their declarations join the module
      const libBodies = this.libraries.flatMap(lib => (lib.ast = Object.assign({}, lib.ast, { body: libraryStatements(lib.ast) })).body);
      this.body = [...libBodies, ...(body || [])].filter(Boolean);
      foldStringChains(this.body);
      this.resolve(this.body);
      this.collectDeclarations(this.body);
      this.inferKinds();
      this.lowerProgram(this.body);
      return this.unit;
    }

    warn(message) { this.warnings.push(message); }
    fresh(base) { return `${base}$${++this.uid}`; }

    // =================================================================
    // Classes and members
    // =================================================================

    addFrameworkClass(name, def) {
      const info = {
        name, javaName: name, ext: def.ext || null, framework: true, abstract: !!def.abstract, dynamic: !!def.dynamic,
        fields: new Map(), accessors: new Map(), methods: new Map(), statics: new Map(), staticMethods: new Map(),
        ctors: (def.ctors || [[]]).map(p => ({ params: p.map((t, i) => ({ name: 'p' + i, t })) })),
        subclasses: [], enumLike: !!def.enumLike
      };
      for (const [f, t] of Object.entries(def.fields || {})) info.fields.set(f, { name: f, javaName: f, t });
      for (const [a, [t, settable]] of Object.entries(def.accessors || {}))
        info.accessors.set(a, { name: a, t, getter: true, setter: settable });
      for (const [m, [params, ret, min]] of Object.entries(def.methods || {}))
        info.methods.set(m, { name: m, javaName: m, params: params.map((t, i) => ({ name: 'p' + i, t })), ret, min: min === undefined ? params.length : min, framework: true });
      if (ENUM_CONSTANTS[name]) for (const c of ENUM_CONSTANTS[name]) info.statics.set(c, { name: c, javaName: c, t: name });
      this.classes.set(name, info);
    }

    classInfo(name) { return name ? this.classes.get(name) || null : null; }

    /** Whether class a is b or a subclass of it. */
    isSubclass(a, b) {
      for (let c = this.classInfo(a); c; c = this.classInfo(c.ext)) if (c.name === b) return true;
      return false;
    }

    /** The member of a class or its ancestors: { kind: 'field'|'accessor'|'method', info, owner }. */
    findMember(className, name) {
      for (let c = this.classInfo(className); c; c = this.classInfo(c.ext)) {
        if (c.accessors.has(name)) return { kind: 'accessor', info: c.accessors.get(name), owner: c };
        if (c.fields.has(name)) return { kind: 'field', info: c.fields.get(name), owner: c };
        if (c.methods.has(name)) return { kind: 'method', info: c.methods.get(name), owner: c };
      }
      return null;
    }

    findStatic(className, name) {
      for (let c = this.classInfo(className); c; c = this.classInfo(c.ext)) {
        if (c.statics.has(name)) return { kind: 'field', info: c.statics.get(name), owner: c };
        if (c.staticMethods.has(name)) return { kind: 'method', info: c.staticMethods.get(name), owner: c };
      }
      return null;
    }

    /** A member some subclass of the class declares (for a downcast), or null. */
    findMemberInSubclasses(className, name) {
      const startInfo = this.classInfo(className);
      if (!startInfo || startInfo.framework) return null;
      const hits = [];
      const visit = c => {
        for (const sub of c.subclasses) {
          const s = this.classInfo(sub);
          if (!s) continue;
          if (s.accessors.has(name) || s.fields.has(name) || s.methods.has(name)) hits.push(s);
          else visit(s);
        }
      };
      const start = this.classInfo(className);
      if (start) visit(start);
      if (hits.length === 0) return null;
      // The nearest common class declaring it (all hits share the member only when they agree)
      return hits.length === 1 ? { cls: hits[0].name, member: this.findMember(hits[0].name, name) } : null;
    }

    // =================================================================
    // Resolution: symbols for every declaration and reference
    // =================================================================

    /**
     * Give every declaration a symbol and every identifier reference its
     * symbol (node.__sym). Symbols record what the lowering needs: the IL
     * type, the function they belong to, assignments, captures by nested
     * functions, and BigInt-ness.
     */
    resolve(body) {
      const scopes = [];
      const fnStack = [];
      const self = this;
      const push = (fn) => scopes.push({ names: new Map(), fn });
      const pop = () => scopes.pop();
      const curFn = () => fnStack[fnStack.length - 1] || null;
      const declare = (name, sym) => {
        sym.name = name; sym.fn = curFn(); sym.refs = 0; sym.assigns = sym.assigns || 0; sym.captured = false; sym.capturedAssigned = false;
        scopes[scopes.length - 1].names.set(name, sym);
        return sym;
      };
      const declareFnScope = (name, sym) => {
        // var: the nearest function scope
        for (let i = scopes.length - 1; i >= 0; --i)
          if (scopes[i].isFunction || i === 0) {
            if (scopes[i].names.has(name)) return scopes[i].names.get(name);
            sym.name = name; sym.fn = curFn(); sym.refs = 0; sym.assigns = 0; sym.captured = false;
            scopes[i].names.set(name, sym);
            return sym;
          }
        return declare(name, sym);
      };
      const lookup = name => {
        for (let i = scopes.length - 1; i >= 0; --i) if (scopes[i].names.has(name)) return scopes[i].names.get(name);
        return null;
      };
      const ref = (node, isWrite) => {
        const sym = lookup(node.name);
        if (!sym) return;
        mark(node, '__sym', sym);
        sym.refs++;
        (sym.sites || (sym.sites = [])).push(node);
        if (sym.fn !== curFn()) {
          sym.captured = true;
          if (isWrite) sym.capturedAssigned = true;
        }
        if (isWrite) {
          sym.assigns++;
          if (sym.fn !== curFn()) sym.writtenInner = true;
        }
      };
      const declType = (decl) => decl.resultType || (decl.id && decl.id.resultType) || null;
      // Hoist function declarations and var declarations of a block
      const hoist = (stmts, isFnBody) => {
        for (const s of stmts || []) {
          if (!s) continue;
          if (s.type === 'FunctionDeclaration' && s.id) {
            const sym = declare(s.id.name, { kind: 'func', node: s, il: null });
            mark(s, '__sym', sym);
          } else if (s.type === 'ClassDeclaration' && s.id) {
            if (!lookup(s.id.name) || scopes.length > 1) mark(s, '__sym', declare(s.id.name, { kind: 'class', node: s }));
          } else if (s.type === 'VariableDeclaration' && s.kind !== 'var') {
            // let/const: the binding exists from the block's start (a function declared
            // earlier in the block refers to it); the declaration initialises it
            for (const d of s.declarations || []) {
              if (!d.id || d.id.type !== 'Identifier') continue;
              const alias = namespaceAliasOf(d);
              if (alias) { scopes[scopes.length - 1].names.set(d.id.name, alias); mark(d, '__namespaceAlias', true); continue; }
              const sym = declare(d.id.name, { kind: s.kind === 'const' ? 'const' : 'let', il: declType(d), node: d, nullable: !!(d.nullable || d.id.nullable) });
              mark(d, '__sym', sym); mark(d.id, '__sym', sym);
              mark(d, '__hoisted', true);
              if (!d.init) sym.noInit = true;
            }
          }
        }
        if (isFnBody) collectVars(stmts);
      };
      // const { A } = Lib is expanded by the IL into _destructure = Lib; A = _destructure.A: aliases of the library's members
      const namespaceAliasOf = d => {
        if (!d.init) return null;
        const nsOf = n => n && n.type === 'Identifier' && lookup(n.name) && lookup(n.name).kind === 'namespace' ? lookup(n.name) : null;
        const whole = nsOf(d.init);
        if (whole) return whole;
        if (d.init.type === 'MemberExpression' && !d.init.computed && nsOf(d.init.object))
          return nsOf(d.init.object).members.get(d.init.property && (d.init.property.name || d.init.property.value)) || null;
        return null;
      };
      const collectVars = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(collectVars); return; }
        if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunction', 'ArrowFunctionExpression', 'ClassDeclaration', 'MethodDefinition'].includes(node.type)) return;
        if (node.type === 'VariableDeclaration' && node.kind === 'var')
          for (const d of node.declarations || [])
            if (d.id && d.id.type === 'Identifier') { const s = declareFnScope(d.id.name, { kind: 'var', il: declType(d), node: d, nullable: !!(d.nullable || d.id.nullable) }); mark(d, '__sym', s); s.isVar = true; }
        eachChild(node, c => collectVars(c));
      };

      const fnNode = n => n && ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunction', 'ArrowFunctionExpression'].includes(n.type);
      const walkFunction = (fn, method) => {
        fnStack.push(fn);
        push(fn);
        scopes[scopes.length - 1].isFunction = true;
        mark(fn, '__params', []);
        let patternIndex = 0;
        for (const p of fn.params || []) {
          const pn = p.type === 'AssignmentPattern' ? p.left : p.type === 'RestElement' || p.type === 'RestParameter' ? (p.argument || p) : p;
          if (pn && (pn.type === 'ObjectPattern' || pn.type === 'ArrayPattern')) {
            const sym = declare('param__' + patternIndex++, { kind: 'param', il: null, node: pn, pattern: pn });
            mark(pn, '__sym', sym);
            fn.__params.push(sym);
            const names = pn.type === 'ObjectPattern' ? (pn.properties || []).map(q => q.value || q.key) : (pn.elements || []);
            for (const v of names) if (v && v.type === 'Identifier') mark(v, '__sym', declare(v.name, { kind: 'let', il: v.resultType || null, node: v }));
            continue;
          }
          const name = pn.name || (typeof p === 'string' ? p : null);
          if (!name) continue;
          const il = pn.resultType || (pn.typeAnnotation) || (fn.typeInfo && fn.typeInfo.params && fn.typeInfo.params[name]) || null;
          const sym = declare(name, { kind: 'param', il, node: pn, nullable: !!pn.nullable, rest: p.type === 'RestElement' || p.type === 'RestParameter' });
          mark(pn, '__sym', sym);
          fn.__params.push(sym);
          const def = pn.defaultValue || (p.type === 'AssignmentPattern' ? p.right : null);
          if (def) walk(def);
        }
        if (fn.body && fn.body.type === 'BlockStatement') {
          hoist(fn.body.body, true);
          for (const s of fn.body.body || []) walk(s);
        } else if (fn.body) walk(fn.body);
        pop();
        fnStack.pop();
      };

      const walk = (node) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(walk); return; }
        switch (node.type) {
          case 'Identifier': ref(node, false); return;
          case 'FunctionDeclaration': walkFunction(node); return;
          case 'FunctionExpression': case 'ArrowFunction': case 'ArrowFunctionExpression': walkFunction(node); return;
          case 'ClassDeclaration': case 'ClassExpression': {
            if (node.superClass) walk(node.superClass);
            const members = (node.body && node.body.body) || [];
            for (const m of members) {
              if (m.type === 'MethodDefinition' && m.value) walkFunction(m.value, m);
              else if ((m.type === 'FieldDefinition' || m.type === 'PropertyDefinition') && m.value) {
                fnStack.push(m); walk(m.value); fnStack.pop();
              } else if (m.type === 'StaticBlock') {
                fnStack.push(m); push(m); const stmts = Array.isArray(m.body) ? m.body : (m.body && m.body.body) || []; hoist(stmts, true); stmts.forEach(walk); pop(); fnStack.pop();
              }
            }
            return;
          }
          case 'BlockStatement': {
            push(curFn());
            hoist(node.body, false);
            for (const s of node.body || []) walk(s);
            pop();
            return;
          }
          case 'VariableDeclaration': {
            for (const d of node.declarations || []) {
              if (d.init) walk(d.init);
              if (!d.id) continue;
              if (d.__namespaceAlias) continue;
              if (d.id.type === 'Identifier' && d.init && node.kind === 'var') {
                const alias = namespaceAliasOf(d);
                if (alias) { scopes[scopes.length - 1].names.set(d.id.name, alias); mark(d, '__namespaceAlias', true); continue; }
              }
              if (d.id.type === 'Identifier' && d.__hoisted && d.__sym) continue;
              if (d.id.type === 'Identifier') {
                if (node.kind === 'var') { const s = d.__sym || lookup(d.id.name); if (s && d.init) s.assigns++; mark(d, '__sym', s); if (s) mark(d.id, '__sym', s); }
                else { const s = declare(d.id.name, { kind: node.kind === 'const' ? 'const' : 'let', il: declType(d), node: d, nullable: !!(d.nullable || d.id.nullable) }); mark(d, '__sym', s); mark(d.id, '__sym', s); if (!d.init) s.noInit = true; }
              } else if (d.id.type === 'ArrayPattern') {
                for (const el of d.id.elements || []) if (el && el.type === 'Identifier') { const s = declare(el.name, { kind: 'let', il: el.resultType || null, node: el }); mark(el, '__sym', s); }
              } else if (d.id.type === 'ObjectPattern' && d.init && d.init.type === 'Identifier' && lookup(d.init.name) && lookup(d.init.name).kind === 'namespace') {
                const ns = lookup(d.init.name);
                for (const p of d.id.properties || []) {
                  const key = p.key && (p.key.name || p.key.value);
                  const v = p.value || p.key;
                  const target = ns.members.get(key);
                  if (v && v.type === 'Identifier' && target) scopes[scopes.length - 1].names.set(v.name, target);
                }
                mark(d, '__namespaceAlias', true);
              } else if (d.id.type === 'ObjectPattern') {
                for (const p of d.id.properties || []) {
                  const v = p.value || p.key;
                  if (v && v.type === 'Identifier') { const s = declare(v.name, { kind: 'let', il: v.resultType || null, node: v, fromObjectPattern: true }); mark(v, '__sym', s); }
                }
              }
            }
            return;
          }
          case 'ForStatement': {
            push(curFn());
            walk(node.init); walk(node.test); walk(node.update); walk(node.body);
            pop();
            return;
          }
          case 'ForOfStatement': case 'ForInStatement': {
            walk(node.right);
            push(curFn());
            walk(node.left);
            if (node.left && node.left.type === 'Identifier') ref(node.left, true);
            walk(node.body);
            pop();
            return;
          }
          case 'CatchClause': {
            push(curFn());
            if (node.param && node.param.type === 'Identifier') { const s = declare(node.param.name, { kind: 'catch', il: 'Error', node: node.param }); mark(node.param, '__sym', s); }
            walk(node.body);
            pop();
            return;
          }
          case 'AssignmentExpression': {
            if (node.left && node.left.type === 'Identifier') ref(node.left, true); else walk(node.left);
            walk(node.right);
            return;
          }
          case 'UpdateExpression': {
            if (node.argument && node.argument.type === 'Identifier') ref(node.argument, true); else walk(node.argument);
            return;
          }
          case 'MemberExpression': {
            walk(node.object);
            if (node.computed) walk(node.property);
            return;
          }
          case 'MethodDefinition': if (node.value) walkFunction(node.value, node); return;
          case 'ObjectProperty': case 'Property': {
            if (node.computed && node.key && typeof node.key === 'object') walk(node.key);
            walk(node.value);
            return;
          }
          case 'LabeledStatement': walk(node.body); return;
          case 'BreakStatement': case 'ContinueStatement': return;
          case 'ThisPropertyAccess': if (node.computed && node.property && typeof node.property === 'object') walk(node.property); return;
          default:
            eachChild(node, walk);
                  }
      };
      push(null);
      scopes[0].isFunction = true;
      const libStatements = new Set(this.libraries.flatMap(lib => (lib.ast && lib.ast.body) || []));
      hoist(body.filter(s => libStatements.has(s)), true);
      let bound = false;
      const bindLibraries = () => {
        if (bound) return;
        bound = true;
        for (const lib of this.libraries) {
          if (!lib.param || scopes[0].names.has(lib.param) && !lib.exports) continue;
          const ex = lib.exports || {};
          if (ex.single) {
            const target = scopes[0].names.get(ex.single);
            if (target && ex.single !== lib.param) scopes[0].names.set(lib.param, target);
          } else if (ex.names) {
            const members = new Map();
            for (const n of ex.names) if (scopes[0].names.has(n)) members.set(n, scopes[0].names.get(n));
            scopes[0].names.set(lib.param, { kind: 'namespace', name: lib.param, members, refs: 0, assigns: 0, fn: null });
          }
        }
      };
      let mainHoisted = false;
      for (const s of body) {
        if (!libStatements.has(s)) {
          bindLibraries();
          if (!mainHoisted) { mainHoisted = true; hoist(body.filter(x => !libStatements.has(x)), true); }
        }
        walk(s);
      }
      bindLibraries();
      this.moduleScope = scopes[0];
      pop();
    }

    // =================================================================
    // Declarations: classes, module functions and variables
    // =================================================================

    collectDeclarations(body) {
      const classNodes = [];
      const findClasses = node => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(findClasses); return; }
        if (node.type === 'ClassDeclaration' && node.id) classNodes.push(node);
        if (node.type === 'VariableDeclarator' && node.init && node.init.type === 'ClassExpression' && node.id && node.id.type === 'Identifier') {
          const decl = Object.assign({}, node.init, { type: 'ClassDeclaration', id: node.init.id || { type: 'Identifier', name: node.id.name } });
          decl.id = { type: 'Identifier', name: node.id.name };
          classNodes.push(decl);
          mark(node, '__asClass', decl);
        }
        eachChild(node, c => findClasses(c));
      };
      findClasses(body);
      this.classNodes = classNodes;
      for (const c of classNodes) {
        const name = c.id.name;
        if (this.classes.has(name) && this.classes.get(name).framework) {
          this.warn(`class ${name} shadows a framework class`);
        }
        const ext = c.superClass ? (c.superClass.name || (c.superClass.property && (c.superClass.property.name || c.superClass.property.value)) || null) : null;
        const info = {
          name, javaName: mid(name), ext, node: c, framework: false, fields: new Map(), accessors: new Map(), methods: new Map(),
          statics: new Map(), staticMethods: new Map(), ctors: null, subclasses: [], local: true
        };
        this.classes.set(name, info);
      }
      for (const c of classNodes) {
        const info = this.classes.get(c.id.name);
        if (info.ext && this.classes.get(info.ext)) this.classes.get(info.ext).subclasses.push(info.name);
      }
      // Methods and accessors first (field collection skips accessor names)
      for (const c of classNodes) this.collectMethods(this.classes.get(c.id.name));
      for (const c of classNodes) this.collectFields(this.classes.get(c.id.name));
      // Module functions and variables
      for (const s of body) {
        if (s.type === 'FunctionDeclaration' && s.id && s.__sym) this.addModuleFunction(s.__sym, this.fnInfo(s, s.id.name));
        if (s.type === 'VariableDeclaration')
          for (const d of s.declarations || []) {
            if (!d.id || d.id.type !== 'Identifier' || !d.__sym) continue;
            const sym = d.__sym;
            if (d.init && (d.init.type === 'ArrowFunction' || d.init.type === 'FunctionExpression' || d.init.type === 'ArrowFunctionExpression') && sym.assigns === 0 && s.kind !== 'var') {
              sym.kind = 'func'; sym.node = d.init; mark(d, '__asFunction', true);
              this.addModuleFunction(sym, this.fnInfo(d.init, d.id.name));
            } else if (d.__namespaceAlias) {
              // an alias of a library member: nothing to store
            } else if (d.__asClass) {
              sym.kind = 'class';
            } else {
              sym.javaName = this.moduleName(d.id.name);
              this.moduleVars.set(sym, sym);
            }
          }
      }
      // Static fields assigned as ClassName.x = ... anywhere
      this.collectStaticAssignments(body);
    }

    /** A unique JVM name for a module member. */
    moduleName(name) {
      let n = mid(name);
      if (this.moduleNames.has(n)) { let i = 2; while (this.moduleNames.has(`${n}_${i}`)) ++i; n = `${n}_${i}`; }
      this.moduleNames.add(n);
      return n;
    }

    addModuleFunction(sym, fi) {
      fi.javaName = this.moduleName(fi.name);
      sym.fi = fi;
      this.functions.set(sym, fi);
    }

    /** JVM signature info of a function or method node. */
    fnInfo(fn, name) {
      const params = (fn.__params || []).map(sym => ({ name: sym.name, sym, il: sym.il, def: sym.node && sym.node.defaultValue ? sym.node.defaultValue : null, rest: !!sym.rest }));
      let min = params.length;
      while (min > 0 && (params[min - 1].def || params[min - 1].rest)) min--;
      return { name, javaName: mid(name), node: fn, params, retIl: this.returnIl(fn), min };
    }

    /** The IL return type of a function: JSDoc, else the common type of what it returns. */
    returnIl(fn) {
      const declared = ilName(fn.declaredReturnType) || ilName(fn.typeInfo && fn.typeInfo.returns);
      if (declared && declared !== 'void') return { il: declared, nullable: !!(fn.typeInfo && fn.typeInfo.returns && fn.typeInfo.returns.isNullable) };
      if (fn.body && fn.body.type !== 'BlockStatement') return { il: ilName(fn.body.resultType) || '', node: fn.body, exprBody: true };
      const returned = [];
      const collect = node => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(collect); return; }
        if (['ArrowFunction', 'FunctionExpression', 'FunctionDeclaration', 'ArrowFunctionExpression', 'ClassDeclaration'].includes(node.type)) return;
        if (node.type === 'ReturnStatement') { if (node.argument) returned.push(node.argument); return; }
        eachChild(node, c => collect(c));
      };
      collect(fn.body && fn.body.body);
      if (returned.length === 0) return { il: declared === 'void' ? 'void' : 'void', none: true };
      return { il: '', returned };
    }

    collectMethods(info) {
      const members = (info.node.body && info.node.body.body) || [];
      for (const m of members) {
        if (m.type !== 'MethodDefinition' || !m.value) continue;
        const name = m.key && (m.key.name !== undefined ? m.key.name : m.key.value);
        if (name === undefined) continue;
        if (m.kind === 'constructor') { info.ctorNode = m; continue; }
        if (m.kind === 'get' || m.kind === 'set') {
          const a = info.accessors.get(name) || { name, getter: false, setter: false, local: true, cls: info.name };
          if (m.kind === 'get') { a.getter = true; a.getNode = m; } else { a.setter = true; a.setNode = m; }
          info.accessors.set(name, a);
          continue;
        }
        const fi = this.fnInfo(m.value, name);
        fi.member = m;
        if (m.static) info.staticMethods.set(name, fi); else info.methods.set(name, fi);
      }
    }

    collectFields(info) {
      const node = info.node;
      const members = (node.body && node.body.body) || [];
      const add = (name, il, isStatic, valueNode) => {
        if (name === undefined || name === null) return;
        const map = isStatic ? info.statics : info.fields;
        if (!isStatic && (info.accessors.has(name) || info.methods.has(name))) return;
        if (!isStatic) {
          // Declared by an ancestor: not redeclared (the subclass shares it)
          for (let c = this.classInfo(info.ext); c; c = this.classInfo(c.ext))
            if (c.fields.has(name) || c.accessors.has(name)) return;
        }
        const existing = map.get(name);
        if (existing) { if (!existing.il && il) existing.il = il; if (il) existing.ils.push(il); existing.values.push(valueNode); return; }
        map.set(name, { name, javaName: mid(name), il, ils: il ? [il] : [], values: valueNode ? [valueNode] : [], owner: info.name, static: isStatic });
      };
      for (const m of members) {
        if (m.type === 'FieldDefinition' || m.type === 'PropertyDefinition') {
          const name = m.key && (m.key.name !== undefined ? m.key.name : m.key.value);
          add(name, ilName(m.resultType) || (m.value && ilName(m.value.resultType)) || null, !!m.static, m.value || null);
        }
      }
      const visit = (n, isStatic) => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(x => visit(x, isStatic)); return; }
        if (n.type === 'ClassDeclaration' && n !== node) return;
        if (n.type === 'ThisPropertyAccess' && !n.computed) {
          const name = typeof n.property === 'string' ? n.property : (n.property && n.property.name);
          add(name, ilName(n.resultType) || null, isStatic, null);
        }
        if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'ThisPropertyAccess' && !n.left.computed) {
          const name = typeof n.left.property === 'string' ? n.left.property : (n.left.property && n.left.property.name);
          add(name, ilName(n.left.resultType) || ilName(n.right && n.right.resultType) || null, isStatic, n.right);
        }
        eachChild(n, c => visit(c, isStatic));
      };
      for (const m of members) {
        if (m.type === 'MethodDefinition' && m.value) visit(m.value.body, !!m.static);
        else if (m.type === 'StaticBlock') visit(m.body, true);
      }
    }

    collectStaticAssignments(body) {
      const visit = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression' && !n.left.computed &&
            n.left.object && n.left.object.type === 'Identifier' && n.left.object.__sym && n.left.object.__sym.kind === 'class') {
          const info = this.classInfo(n.left.object.name);
          const name = n.left.property && (n.left.property.name || n.left.property.value);
          if (info && info.local && name && !info.statics.has(name) && !info.staticMethods.has(name))
            info.statics.set(name, { name, javaName: mid(name), il: ilName(n.left.resultType) || ilName(n.right && n.right.resultType) || null, values: [n.right], owner: info.name, static: true });
        }
        eachChild(n, c => visit(c));
      };
      visit(body);
    }

    // =================================================================
    // BigInt-ness of 64-bit sites
    // =================================================================

    /**
     * Whether the value of an IL expression is a BigInt. Decided by the node
     * itself where it can be (literals, BigInt(), 64-bit packs and
     * rotations, bigint-typed results), else by the symbol or field it reads.
     */
    isBig(node) {
      if (!node || typeof node !== 'object') return false;
      const il = ilNorm(node.resultType);
      if (il === 'bigint') return true;
      // a position an OpCodes BigInt parameter takes (AndN, XorN, ShiftLn, ...) holds a BigInt
      if (ilNorm(node.contextType) === 'bigint') return true;
      switch (node.type) {
        case 'Literal': return typeof node.value === 'bigint' || (typeof node.raw === 'string' && /n$/.test(node.raw) && !/^['"]/.test(node.raw)) || !!node.bigint;
        case 'BigIntCast': return true;
        case 'PackBytes': return node.bits === 64;
        case 'RotateLeft': case 'RotateRight': case 'Rotation': return node.bits === 64;
        case 'Cast': return ilNorm(node.targetType) === 'uint64';
        case 'OpCodesCall': { const sig = OPCODES[node.method]; return !!sig && sig[1] === 'BigInteger'; }
        case 'Identifier': return !!(node.__sym && node.__sym.big);
        case 'ThisPropertyAccess': { const f = this.fieldForThis(node); return !!(f && f.big); }
        case 'MemberExpression': {
          if (node.computed) { const arr = this.arraySymbolOf(node.object); if (arr) return !!arr.elemBig; return this.isBig(node.object) && false; }
          const f = this.fieldForMember(node); return !!(f && f.big);
        }
        case 'CallExpression': case 'ThisMethodCall': { const fi = this.calleeInfo(node); return !!(fi && fi.retBig); }
        case 'BinaryExpression':
          if (['==', '===', '!=', '!==', '<', '<=', '>', '>=', 'instanceof', 'in'].includes(node.operator)) return false;
          // the inliner marks the N-suffix OpCodes (AndN, XorN, ShiftLn, ...) as BigInt operations
          if (node.bigint === true || /^(And|Or|Xor|ShiftL|ShiftR)N$/.test(node.opCodesMethod || '')) return true;
          if (node.operator === '>>>') return false;
          return this.isBig(node.left) || this.isBig(node.right);
        case 'LogicalExpression': return this.isBig(node.left) || this.isBig(node.right);
        case 'ConditionalExpression': return this.isBig(node.consequent) || this.isBig(node.alternate);
        case 'UnaryExpression': return (node.operator === '-' || node.operator === '~') && this.isBig(node.argument);
        case 'AssignmentExpression': return this.isBig(node.right);
        case 'SequenceExpression': return this.isBig(node.expressions[node.expressions.length - 1]);
        case 'UpdateExpression': return this.isBig(node.argument);
        case 'ArrayPop': case 'ArrayShift': { const arr = this.arraySymbolOf(node.array); return !!(arr && arr.elemBig); }
        default: return false;
      }
    }

    /** The symbol (or field) of an array expression, for its element kind. */
    arraySymbolOf(node) {
      if (!node) return null;
      if (node.type === 'CallExpression' || node.type === 'ThisMethodCall') { const fi = this.calleeInfo(node); return fi ? { elemBig: !!fi.retElemBig } : null; }
      if (node.type === 'Identifier') return node.__sym || null;
      if (node.type === 'ThisPropertyAccess') return this.fieldForThis(node);
      if (node.type === 'MemberExpression' && !node.computed) return this.fieldForMember(node);
      if (node.type === 'MemberExpression' && node.computed) return this.arraySymbolOf(node.object);
      return null;
    }

    fieldForThis(node) {
      const cls = node.__class || this.currentClassName;
      const name = typeof node.property === 'string' ? node.property : node.property && node.property.name;
      if (!cls || !name) return null;
      const m = this.findMember(cls, name);
      if (m && (m.kind === 'field' || m.kind === 'accessor')) return m.info;
      const s = this.classInfo(cls) && this.classInfo(cls).statics.get(name);
      return s || null;
    }

    fieldForMember(node) {
      const objIl = ilNorm(node.object && node.object.resultType);
      const name = node.property && (node.property.name || node.property.value);
      if (node.object && node.object.type === 'Identifier' && node.object.__sym && node.object.__sym.kind === 'class') {
        const info = this.classInfo(node.object.name);
        return info ? info.statics.get(name) || null : null;
      }
      if (!this.classInfo(objIl)) return null;
      const m = this.findMember(objIl, name);
      return m && (m.kind === 'field' || m.kind === 'accessor') ? m.info : null;
    }

    calleeInfo(node) {
      if (node.type === 'ThisMethodCall') {
        const cls = node.__class || this.currentClassName;
        const m = cls && this.findMember(cls, node.method);
        return m && m.kind === 'method' ? m.info : (cls && this.classInfo(cls) && this.classInfo(cls).staticMethods.get(node.method)) || null;
      }
      if (node.callee && node.callee.type === 'Identifier') return (node.callee.__sym && node.callee.__sym.kind === 'func' && node.callee.__sym.fi) || null;
      if (node.callee && node.callee.type === 'MemberExpression' && !node.callee.computed) {
        const objIl = ilNorm(node.callee.object.resultType);
        const name = node.callee.property && node.callee.property.name;
        if (node.callee.object.type === 'Identifier' && node.callee.object.__sym && node.callee.object.__sym.kind === 'class') {
          const info = this.classInfo(node.callee.object.name);
          return info ? info.staticMethods.get(name) || null : null;
        }
        if (node.callee.object.type === 'ThisExpression') {
          const m = this.currentClassName && this.findMember(this.currentClassName, name);
          return m && m.kind === 'method' ? m.info : null;
        }
        const m = this.classInfo(objIl) && this.findMember(objIl, name);
        return m && m.kind === 'method' ? m.info : null;
      }
      return null;
    }

    /**
     * Fixpoint over every 64-bit (and untyped) site: a site holds BigInts when
     * any value stored into it is one. Visits assignments, initialisers,
     * returns, call arguments and array stores, with the class context set so
     * this.x resolves.
     */
    inferKinds() {
      const may64 = il => { const n = ilNorm(il); return IL64.has(n) || n === '' || n === 'number' || n === 'object' || n === 'any'; };
      const mayArr64 = il => { const n = ilNorm(il); return n === 'uint64[]' || n === 'int64[]' || n === '' || n === 'object[]' || n === 'any[]' || n === 'number[]'; };
      // bigint-typed sites are BigInt from the start
      const allSyms = [];
      const seen = new WeakSet();
      const gather = n => {
        if (!n || typeof n !== 'object' || seen.has(n)) return;
        seen.add(n);
        if (Array.isArray(n)) { n.forEach(gather); return; }
        if (n.__sym && !allSyms.includes(n.__sym)) allSyms.push(n.__sym);
        eachChild(n, c => gather(c));
      };
      gather(this.body);
      for (const s of allSyms) {
        const il = ilNorm(s.il);
        if (il === 'bigint') s.big = true;
        if (il === 'bigint[]' || il === 'BigInt[]') s.elemBig = true;
        if (s.node && s.node.init && s.node.init.type === 'TypedArrayCreation' && /^Big/.test(s.node.init.arrayType || '')) s.elemBig = true;
      }
      const fieldsAll = [];
      for (const c of this.classes.values()) if (c.local) { for (const f of c.fields.values()) fieldsAll.push(f); for (const f of c.statics.values()) fieldsAll.push(f); }
      for (const f of fieldsAll) {
        const il = ilNorm(f.il);
        if (il === 'bigint') f.big = true;
        if (il === 'bigint[]') f.elemBig = true;
      }
      const fnInfos = [...this.functions.values()];
      for (const c of this.classes.values()) if (c.local) { fnInfos.push(...c.methods.values(), ...c.staticMethods.values()); }
      for (const fi of fnInfos) if (ilNorm(fi.retIl && fi.retIl.il) === 'bigint') fi.retBig = true;

      let changed = true, rounds = 0;
      const mark = (target, prop, value) => { if (target && value && !target[prop]) { target[prop] = true; changed = true; } };
      const fnStack = [];
      const visit = (n) => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if (n.type === 'ClassDeclaration') {
          const prev = this.currentClassName;
          this.currentClassName = n.id && n.id.name;
          for (const m of (n.body && n.body.body) || []) { this.tagClass(m, this.currentClassName); }
          visitChildren(n);
          this.currentClassName = prev;
          return;
        }
        if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunction', 'ArrowFunctionExpression'].includes(n.type)) {
          fnStack.push(n); visitChildren(n); fnStack.pop(); return;
        }
        switch (n.type) {
          case 'VariableDeclarator':
            if (n.__sym && n.init && may64(n.__sym.il)) mark(n.__sym, 'big', this.isBig(n.init));
            if (n.__sym && n.init) this.markArrayElems(n.__sym, n.init, mark);
            break;
          case 'AssignmentExpression': {
            const big = this.isBig(n.right);
            if (n.left.type === 'Identifier' && n.left.__sym && may64(n.left.__sym.il)) mark(n.left.__sym, 'big', big);
            if (n.left.type === 'ThisPropertyAccess') { const f = this.fieldForThis(n.left); if (f && may64(f.il)) mark(f, 'big', big); if (f) this.markArrayElems(f, n.right, mark); }
            if (n.left.type === 'MemberExpression' && !n.left.computed) { const f = this.fieldForMember(n.left); if (f && may64(f.il)) mark(f, 'big', big); }
            if (n.left.type === 'MemberExpression' && n.left.computed) { const a = this.arraySymbolOf(n.left.object); if (a) { mark(a, 'elemBig', big); if (n.operator === '=') this.noteElement(a, n.right); } }
            if (n.left.type === 'Identifier' && n.left.__sym) this.markArrayElems(n.left.__sym, n.right, mark);
            break;
          }
          case 'ArrayAppend': {
            const a = this.arraySymbolOf(n.array);
            const vals = n.values && n.values.length ? n.values : [n.value];
            if (a) for (const v of vals) if (v && v.type !== 'SpreadElement') {
              mark(a, 'elemBig', this.isBig(v));
              this.markArrayElems(a, v, mark);
              this.noteElement(a, v);
            }
            break;
          }
          case 'ReturnStatement': {
            const fn = fnStack[fnStack.length - 1];
            if (fn && n.argument && this.isBig(n.argument)) {
              for (const fi of fnInfos) if (fi.node === fn) mark(fi, 'retBig', true);
            }
            if (fn && n.argument) {
              const probe = {};
              this.markArrayElems(probe, n.argument, (t, p, v) => { if (v) probe.elemBig = true; });
              if (probe.elemBig) for (const fi of fnInfos) if (fi.node === fn) mark(fi, 'retElemBig', true);
            }
            break;
          }
          case 'CallExpression': case 'ThisMethodCall': {
            const fi = this.calleeInfo(n);
            if (fi) (n.arguments || []).forEach((a, i) => {
              const p = fi.params[i];
              if (p && p.sym && may64(p.il)) mark(p.sym, 'big', this.isBig(a));
              if (p && p.sym) this.markArrayElems(p.sym, a, mark);
            });
            break;
          }
        }
        visitChildren(n);
      };
      const visitChildren = n => { eachChild(n, c => visit(c)); };
      while (changed && rounds++ < 12) {
        changed = false;
        visit(this.body);
        // expression-bodied arrows return their body
        for (const fi of fnInfos) if (fi.retIl && fi.retIl.exprBody && !fi.retBig && this.isBig(fi.node.body)) { fi.retBig = true; changed = true; }
      }
      this.currentClassName = null;
    }

    /** A value stored into an array: a non-number in a number array (an empty literal the IL typed int32[]) makes it hold objects. */
    noteElement(arraySym, value) {
      if (!arraySym || arraySym.holdsObjects || !value) return;
      const vt = ilNorm(value.resultType);
      if (value.type === 'ObjectLiteral' || value.type === 'ObjectExpression' || vt === 'object' || vt === 'string' || vt.endsWith('[]') ||
          (this.classInfo(vt) && !this.classInfo(vt).enumLike)) {
        arraySym.holdsObjects = true;
        arraySym.jtCached = null;
      }
    }

    tagClass(node, className) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(n => this.tagClass(n, className)); return; }
      if (node.type === 'ClassDeclaration') return;
      if (node.type === 'ThisPropertyAccess' || node.type === 'ThisMethodCall' || node.type === 'ThisExpression') mark(node, '__class', className);
      eachChild(node, c => this.tagClass(c, className));
    }

    markArrayElems(target, init, mark) {
      if (!init) return;
      if (init.type === 'TypedArrayCreation' && /^Big/.test(init.arrayType || '')) mark(target, 'elemBig', true);
      if ((init.type === 'ArrayExpression' || init.type === 'ArrayLiteral') && (init.elements || []).some(e => e && e.type !== 'SpreadElement' && this.isBig(e))) mark(target, 'elemBig', true);
      const src = this.arraySymbolOf(init);
      if (src && src.elemBig) mark(target, 'elemBig', true);
      if ((init.type === 'ArraySlice' || init.type === 'ArrayConcat') && init.array) { const s = this.arraySymbolOf(init.array); if (s && s.elemBig) mark(target, 'elemBig', true); }
      if (init.type === 'OpCodesCall' && init.method === 'CopyArray' && init.arguments && init.arguments[0]) { const s = this.arraySymbolOf(init.arguments[0]); if (s && s.elemBig) mark(target, 'elemBig', true); }
    }

    // =================================================================
    // JVM types of IL types
    // =================================================================

    /**
     * The JVM type holding an IL type.
     * @param {*} ilType - IL type (string or object)
     * @param {Object} [o] - { big: BigInt-valued, elemBig: BigInt elements, nullable }
     */
    jt(ilType, o = {}) {
      const n = ilNorm(ilType);
      let t = this.jtOfName(n, o);
      if (o.nullable && T.isPrim(t)) t = T.box(t);
      return t;
    }

    jtOfName(n, o = {}) {
      if (!n) return o.big ? 'BigInteger' : 'Object';
      if (INT_IL.has(n)) return 'int';
      if (n === 'uint32') return 'long';
      if (IL64.has(n)) return o.big ? 'BigInteger' : 'long';
      if (n === 'bigint') return 'BigInteger';
      if (FLOAT_IL.has(n)) return o.big ? 'BigInteger' : 'double';
      if (n === 'boolean') return 'boolean';
      if (n === 'string') return 'String';
      if (n === 'void' || n === 'undefined') return 'void';
      if (n === 'null') return 'Object';
      if (n.endsWith('[]')) {
        const e = ilNorm(n.slice(0, -2));
        if (IL64.has(e)) return o.elemBig ? 'JsArray<BigInteger>' : 'I64Array';
        if (e === 'bigint') return 'JsArray<BigInteger>';
        if (T.ARRAY_OF_IL[e]) return T.ARRAY_OF_IL[e];
        // nested arrays: the leaf elements carry the BigInt-ness
        const et = this.jtOfName(e, e.endsWith('[]') ? o : {});
        return `JsArray<${T.box(et === 'void' ? 'Object' : et)}>`;
      }
      const tup = tupleParts(n);
      if (tup) return 'JsArray<Object>';
      if (T.TYPED_ARRAY_CLASS[n]) return o.elemBig && T.TYPED_ARRAY_CLASS[n] === 'I64Array' ? 'JsArray<BigInteger>' : T.TYPED_ARRAY_CLASS[n];
      if (n === 'Array') return 'JsArray<Object>';
      if (/^function\b/.test(n) || n === 'Function' || /=>/.test(n)) return 'JsFn';
      if (n === 'Map') return 'JsMap';
      if (n === 'Set') return 'JsSet';
      if (n === 'RegExp') return 'JsRegExp';
      if (n === 'Error' || /Error$/.test(n) && !this.classInfo(n)) return 'JsError';
      if (n === 'ArrayBuffer') return 'U8Array';
      if (n === 'DataView') return 'JsDataView';
      if (this.classInfo(n)) return this.classInfo(n).javaName;
      if (/^Map<|^Record<|^Object<|^\{/.test(n)) return n.startsWith('Map<') ? 'JsMap' : 'JsObject';
      if (/^(Array|Iterable)<(.+)>$/.test(n)) return this.jtOfName(n.replace(/^(Array|Iterable)<(.+)>$/, '$2') + '[]', o);
      return 'Object';
    }

    /** The JVM type of an IL expression node. */
    nodeJt(node) {
      if (!node) return 'Object';
      let il = node.resultType;
      if ((!il || ilNorm(il) === 'null') && node.contextType && node.type !== 'Literal') il = node.contextType;
      const big = this.isBig(node);
      const arr = this.arraySymbolOf(node);
      return this.jt(il, { big, nullable: !!node.nullable, elemBig: !!(arr && arr.elemBig) || (node.type === 'TypedArrayCreation' && /^Big/.test(node.arrayType || '')) });
    }

    /** The JVM type of an expression read from storage: a variable's or field's own type (joined over its sites), else the node's. */
    storageJt(node) {
      if (node && node.type === 'Identifier' && node.__sym && !['func', 'localfn', 'class', 'namespace'].includes(node.__sym.kind)) return this.symJt(node.__sym);
      if (node && node.type === 'ThisPropertyAccess' && !node.computed) {
        const f = this.fieldForThis(node);
        if (f && f.values) return this.fieldJt(f);
      }
      return this.nodeJt(node);
    }

    /** The JVM type of a symbol (computed once). */
    symJt(sym) {
      if (sym.jtCached) return sym.jtCached;
      let t;
      if (sym.kind === 'catch') t = 'RuntimeException';
      else if (sym.rest) t = 'JsArray<Object>';
      else {
        let il = sym.il;
        if (!ilName(il) && sym.node && sym.node.init) il = sym.node.init.resultType || sym.node.init.contextType;
        if (!ilName(il) && sym.node && sym.node.defaultValue) il = sym.node.defaultValue.resultType;
        const o = { big: !!sym.big, elemBig: !!sym.elemBig, nullable: !!sym.nullable };
        t = this.jt(il, o);
        // The IL types each site of a variable on its own; the variable holds them all
        if (sym.kind !== 'param' && !(sym.node && sym.node.init && this.holdsTypedArray([sym.node.init])))
          t = this.joinSites(t, (sym.sites || []).map(n => n.resultType ? this.jt(n.resultType, o) : null).filter(Boolean));
        if (sym.holdsObjects && T.isPrimArray(t)) t = 'JsArray<Object>';
        if (t === 'void') t = 'Object';
      }
      sym.jtCached = t;
      return t;
    }

    fieldJt(f) {
      if (f.t) return f.t;
      if (f.jtCached) return f.jtCached;
      let il = f.il;
      if (!ilName(il)) for (const v of f.values || []) if (v && ilName(v.resultType)) { il = v.resultType; break; }
      const o = { big: !!f.big, elemBig: !!f.elemBig };
      let t = this.jt(il, o);
      // The IL types each site of a field on its own; the field holds them all
      if (!this.holdsTypedArray(f.values)) t = this.joinSites(t, (f.ils || []).map(x => this.jt(x, o)));
      if (f.holdsObjects && T.isPrimArray(t)) t = 'JsArray<Object>';
      if (t === 'void') t = 'Object';
      f.jtCached = t;
      return t;
    }

    /** Whether a typed array is stored (its class decides the container: no widening). */
    holdsTypedArray(values) {
      return (values || []).some(v => v && (v.type === 'TypedArrayCreation' || ((v.type === 'ArrayFrom' || v.type === 'ArrayLiteral') && v.arrayType)));
    }

    /**
     * Join a storage type with the IL types of its sites: numbers widen
     * (int < long < double), arrays of numbers widen to an array class
     * holding both value ranges. Other disagreements keep the declared type.
     */
    joinSites(t, siteTypes) {
      let r = t;
      for (const s of siteTypes) {
        const j = this.joinJt(r, s);
        if (j) r = j;
      }
      return r;
    }

    joinJt(a, b) {
      if (!a || !b || a === b) return a || b;
      if (a === 'Object' || b === 'Object' || a === 'void' || b === 'void') return null;
      const ua = T.unbox(a), ub = T.unbox(b);
      if (T.isNumeric(ua) && T.isNumeric(ub)) {
        const w = T.wider(ua, ub);
        return T.isBoxed(a) || T.isBoxed(b) ? T.box(w) : w;
      }
      if (T.isPrimArray(a) && T.isPrimArray(b)) {
        const RANGE = { U8Array: [0, 255], I8Array: [-128, 127], U16Array: [0, 65535], I16Array: [-32768, 32767],
          I32Array: [-2147483648, 2147483647], U32Array: [0, 4294967295], I64Array: [-(2 ** 63), 2 ** 63], F32Array: [-Infinity, Infinity], F64Array: [-Infinity, Infinity, true] };
        if (!RANGE[a] || !RANGE[b]) return null;
        const float = a === 'F64Array' || b === 'F64Array' || a === 'F32Array' || b === 'F32Array';
        if (float) return 'F64Array';
        const lo = Math.min(RANGE[a][0], RANGE[b][0]), hi = Math.max(RANGE[a][1], RANGE[b][1]);
        for (const c of ['U8Array', 'I8Array', 'U16Array', 'I16Array', 'I32Array', 'U32Array', 'I64Array'])
          if (RANGE[c][0] <= lo && RANGE[c][1] >= hi) return c;
        return 'F64Array';
      }
      return null;
    }

    /** The type an accessor's getter returns (an overridden base accessor or field decides it). */
    accessorJt(a) {
      if (a.t) return a.t;
      if (a.jtCached) return a.jtCached;
      const base = a.cls ? this.baseAccessor(this.classInfo(a.cls), a.name) : null;
      let t = null;
      if (base) t = base.a ? this.accessorJt(base.a) : this.fieldJt(base.field);
      else if (a.getNode) { const r = this.fnRet(this.fnInfo(a.getNode.value, a.name)); if (r !== 'void') t = r; }
      if (!t && a.setNode) t = this.setterParamJt(a);
      a.jtCached = t || 'Object';
      return a.jtCached;
    }

    /** The type an accessor's setter takes. */
    accessorSetJt(a) {
      if (a.t) return a.t;
      if (a.setJtCached) return a.setJtCached;
      const base = a.cls ? this.baseAccessor(this.classInfo(a.cls), a.name) : null;
      let t = null;
      if (base) t = base.a ? this.accessorSetJt(base.a) : this.fieldJt(base.field);
      else if (a.setNode) t = this.setterParamJt(a);
      if (!t) t = this.accessorJt(a);
      a.setJtCached = t || 'Object';
      return a.setJtCached;
    }

    setterParamJt(a) {
      const p = a.setNode && a.setNode.value.__params && a.setNode.value.__params[0];
      return p ? this.symJt(p) : null;
    }

    /** JVM return type of a function info. */
    fnRet(fi) {
      if (fi.ret) return fi.ret;
      if (fi.retCached) return fi.retCached;
      const r = fi.retIl || { il: 'void' };
      let t;
      if (r.none) t = 'void';
      else if (r.il) t = this.jt(r.il, { big: !!fi.retBig, elemBig: !!fi.retElemBig, nullable: !!r.nullable });
      // an expression-bodied arrow returns its expression, typed or not
      else if (r.exprBody) { t = this.nodeJt(r.node); if (t === 'void' && !(r.node && /Call|New/.test(r.node.type))) t = 'Object'; }
      else if (r.returned) {
        const types = r.returned.map(n => this.storageJt(n)).filter(x => x !== 'void');
        t = this.commonJt(types);
      } else t = 'void';
      if (fi.retBig && T.isNumeric(t)) t = 'BigInteger';
      fi.retCached = t;
      return t;
    }

    /** The common JVM type of several values. */
    commonJt(types) {
      const ts = types.filter(t => t && t !== 'null');
      if (ts.length === 0) return types.includes('null') ? 'Object' : 'void';
      if (ts.every(t => t === ts[0])) return types.includes('null') && T.isPrim(ts[0]) ? T.box(ts[0]) : ts[0];
      const unboxed = ts.map(T.unbox);
      if (unboxed.every(T.isNumeric)) {
        const w = unboxed.reduce(T.wider);
        return ts.some(T.isBoxed) || types.includes('null') ? T.box(w) : w;
      }
      if (ts.every(t => this.classInfo(t))) {
        // nearest common ancestor
        for (let c = this.classInfo(ts[0]); c; c = this.classInfo(c.ext))
          if (ts.every(t => this.isSubclass(t, c.name))) return c.javaName;
      }
      if (ts.every(T.isArray) && ts.every(t => t === ts[0])) return ts[0];
      return 'Object';
    }

    paramJt(p) { return p.t || (p.sym ? this.symJt(p.sym) : this.jt(p.il)); }

    // =================================================================
    // Program
    // =================================================================

    lowerProgram(body) {
      // Classes
      for (const c of this.classNodes) this.unit.classes.push(this.lowerClass(this.classes.get(c.id.name)));
      // Module functions
      for (const fi of this.functions.values()) this.unit.methods.push(...this.lowerFunction(fi, { static: true }));
      // Module variables become static fields, initialised in order by the static initialiser
      for (const sym of this.moduleVars.values()) {
        sym.static = true;
        this.unit.fields.push({ name: sym.javaName, t: this.symJt(sym), static: true });
      }
      // Top-level statements: each in its own init method (a class initialiser has a size limit)
      this.fn = { locals: [new Map()], labels: [], isStatic: true, retJt: 'void', name: '<clinit>', used: new Set() };
      for (const s of body) {
        if (s.type === 'FunctionDeclaration' || s.type === 'ClassDeclaration') continue;
        if (s.type === 'ExpressionStatement' && s.expression && s.expression.type === 'Literal') continue;
        if (s.type === 'VariableDeclaration' && s.declarations.every(d => d.__asFunction || d.__asClass || d.__namespaceAlias || (d.id && d.id.type === 'ObjectPattern') || this.isFrameworkAlias(d))) continue;
        const stmts = this.lowerStmt(s);
        if (stmts.length) this.unit.init.push(S.block(stmts));
      }
      this.fn = null;
    }

    /** `const X = AlgorithmFramework.X` (an alias of a framework export, resolved directly). */
    isFrameworkAlias(d) {
      return d.id && d.id.type === 'Identifier' && d.init && d.init.type === 'MemberExpression' && !d.init.computed &&
        d.init.object && d.init.object.type === 'Identifier' && (d.init.object.name === 'AlgorithmFramework' || d.init.object.name === 'OpCodes');
    }

    // =================================================================
    // Classes
    // =================================================================

    lowerClass(info) {
      const decl = { k: 'class', name: info.javaName, ext: info.ext ? (this.classInfo(info.ext) ? this.classInfo(info.ext).javaName : 'Object') : null, fields: [], ctors: [], methods: [], statics: [], abstract: false, staticInit: [] };
      const base = this.classInfo(info.ext);
      decl.dynamic = !base || !base.local;
      if (decl.ext === 'Object') decl.ext = null;
      const prevClass = this.currentClassName;
      this.currentClassName = info.name;
      this.tagClass(info.node.body, info.name);
      for (const f of info.fields.values()) decl.fields.push({ name: f.javaName, t: this.fieldJt(f), static: false });
      for (const f of info.statics.values()) decl.fields.push({ name: f.javaName, t: this.fieldJt(f), static: true });
      // Static field initialisers and static blocks, in member order
      const members = (info.node.body && info.node.body.body) || [];
      for (const m of members) {
        if ((m.type === 'FieldDefinition' || m.type === 'PropertyDefinition') && m.value) {
          const name = m.key && (m.key.name !== undefined ? m.key.name : m.key.value);
          if (m.static) {
            const f = info.statics.get(name);
            this.fn = { locals: [new Map()], labels: [], isStatic: true, retJt: 'void', cls: info, used: new Set() };
            decl.staticInit.push(S.expr(E.assign(E.sfield(info.javaName, f.javaName, this.fieldJt(f)), this.valueOf(m.value, this.fieldJt(f)))));
            this.fn = null;
          }
        } else if (m.type === 'StaticBlock') {
          this.fn = { locals: [new Map()], labels: [], isStatic: true, retJt: 'void', cls: info, used: new Set() };
          const stmts = Array.isArray(m.body) ? m.body : (m.body && m.body.body) || [];
          decl.staticInit.push(S.block(this.lowerStmts(stmts)));
          this.fn = null;
        }
      }
      // Instance field initialisers run at the start of every constructor (after super)
      const fieldInits = members.filter(m => (m.type === 'FieldDefinition' || m.type === 'PropertyDefinition') && !m.static && m.value);
      // Constructors
      decl.ctors = this.lowerConstructors(info, fieldInits);
      // Methods
      for (const fi of info.methods.values()) decl.methods.push(...this.lowerFunction(fi, { cls: info }));
      for (const fi of info.staticMethods.values()) decl.methods.push(...this.lowerFunction(fi, { cls: info, static: true }));
      // Accessors
      for (const a of info.accessors.values()) decl.methods.push(...this.lowerAccessor(info, a));
      // Abstract framework methods with no implementation stay inherited (the runtime throws like JavaScript)
      this.currentClassName = prevClass;
      return decl;
    }

    /** The JVM signature a method must have: an overridden base method's, else its own. */
    baseMethod(info, name) {
      for (let c = this.classInfo(info.ext); c; c = this.classInfo(c.ext)) if (c.methods.has(name)) return { owner: c, m: c.methods.get(name) };
      return null;
    }

    baseAccessor(info, name) {
      for (let c = this.classInfo(info.ext); c; c = this.classInfo(c.ext)) {
        if (c.accessors.has(name)) return { owner: c, a: c.accessors.get(name) };
        if (c.fields.has(name)) return { owner: c, field: c.fields.get(name) };
      }
      return null;
    }

    /** Parameter JVM types and return type of a function or method info (base signature first). */
    signature(fi, info) {
      if (fi.sig) return fi.sig;
      const base = info && !fi.isStatic ? this.baseMethod(info, fi.name) : null;
      let params, ret;
      if (base) {
        const bsig = base.m.framework ? { params: base.m.params.map(p => p.t), ret: base.m.ret } : this.signature(base.m, base.owner);
        params = fi.params.map((p, i) => i < bsig.params.length ? bsig.params[i] : this.paramJt(p));
        ret = bsig.ret;
        const own = this.fnRet(fi);
        // a covariant return where both are classes
        if (own !== ret && this.classInfo(own) && this.classInfo(ret) && this.isSubclass(own, ret)) ret = own;
        fi.overrides = base;
      } else {
        params = fi.params.map(p => this.paramJt(p));
        ret = this.fnRet(fi);
      }
      fi.sig = { params, ret };
      return fi.sig;
    }

    lowerConstructors(info, fieldInits) {
      const ctorNode = info.ctorNode;
      const baseInfo = this.classInfo(info.ext);
      const out = [];
      if (!ctorNode) {
        // The implicit constructor passes its arguments on: one per base constructor
        const baseCtors = baseInfo ? this.ctorSignatures(baseInfo) : [[]];
        for (const sig of baseCtors) {
          this.fn = { locals: [new Map()], labels: [], isStatic: false, retJt: 'void', cls: info, used: new Set(), ctor: true };
          const params = sig.map((t, i) => ({ name: 'arg' + i, t }));
          const body = [S.expr(E.call(E.sup(baseInfo ? baseInfo.javaName : 'Object'), '<init>', params.map(p => E.name(p.name, p.t)), 'void'))];
          for (const fd of fieldInits) body.push(this.fieldInit(info, fd));
          out.push({ params, body });
          this.fn = null;
        }
        info.ctorSigs = baseCtors;
        return out;
      }
      const fn = ctorNode.value;
      const fi = this.fnInfo(fn, '<init>');
      info.ctorInfo = fi;
      const paramTypes = fi.params.map(p => this.paramJt(p));
      info.ctorSigs = [];
      for (let n = fi.min; n <= fi.params.length; ++n) info.ctorSigs.push(paramTypes.slice(0, n));
      // Overloads for trailing defaults delegate to the full constructor
      for (let n = fi.min; n < fi.params.length; ++n) {
        this.fn = { locals: [new Map()], labels: [], isStatic: false, retJt: 'void', cls: info, used: new Set(), ctor: true };
        const params = fi.params.slice(0, n).map((p, i) => this.declareParam(p, paramTypes[i]));
        const args = params.map(p => E.name(p.name, p.t));
        for (let i = n; i < fi.params.length; ++i) args.push(this.defaultArg(fi.params[i], paramTypes[i]));
        out.push({ params, body: [S.expr(E.call(E.self(info.javaName), '<this>', args, 'void'))] });
        this.fn = null;
      }
      // The full constructor
      this.fn = { locals: [new Map()], labels: [], isStatic: false, retJt: 'void', cls: info, used: new Set(), ctor: true, node: fn };
      const params = fi.params.map((p, i) => this.declareParam(p, paramTypes[i]));
      const prologue = this.paramPrologue(fi, params);
      const stmts = (fn.body && fn.body.body) || [];
      // super(...) first; statements before it that do not touch `this` move ahead of nothing (JVM needs it first)
      let superIdx = stmts.findIndex(s => s.type === 'ExpressionStatement' && s.expression && (s.expression.type === 'ParentConstructorCall' || (s.expression.type === 'CallExpression' && s.expression.callee && s.expression.callee.type === 'Super')));
      const body = [];
      const pre = [];
      if (superIdx >= 0) {
        const sc = stmts[superIdx].expression;
        const before = stmts.slice(0, superIdx);
        // Statements ahead of super() (they cannot touch this) are computed into locals by the arguments
        if (before.length) pre.push(...this.lowerStmts(before));
        body.push(S.expr(this.superCtorCall(info, sc.arguments || [])));
      } else {
        body.push(S.expr(E.call(E.sup(baseInfo ? baseInfo.javaName : 'Object'), '<init>', baseInfo && !this.ctorSignatures(baseInfo).some(s => s.length === 0) ? this.ctorSignatures(baseInfo)[0].map(t => this.undefinedOf(t)) : [], 'void')));
      }
      if (pre.length) {
        // The JVM requires super(...) first: statements ahead of it are lowered into a static helper only when
        // they declare nothing the rest uses; here they are kept after super (they cannot read this in JavaScript).
        body.push(...pre);
      }
      body.push(...prologue);
      for (const fd of fieldInits) body.push(this.fieldInit(info, fd));
      body.push(...this.lowerStmts(stmts.slice(superIdx + 1)));
      out.push({ params, body });
      this.fn = null;
      return out;
    }

    fieldInit(info, fd) {
      const name = fd.key && (fd.key.name !== undefined ? fd.key.name : fd.key.value);
      const f = info.fields.get(name);
      if (!f) return S.block([]);
      return S.expr(E.assign(E.field(E.self(info.javaName), f.javaName, this.fieldJt(f)), this.valueOf(fd.value, this.fieldJt(f))));
    }

    /** Signatures (parameter JVM types) of a class's constructors. */
    ctorSignatures(info) {
      if (info.framework) return info.ctors.map(c => c.params.map(p => p.t));
      if (info.ctorSigs) return info.ctorSigs;
      if (info.ctorNode) {
        const fi = this.fnInfo(info.ctorNode.value, '<init>');
        const prev = this.currentClassName;
        this.currentClassName = info.name;
        const types = fi.params.map(p => this.paramJt(p));
        this.currentClassName = prev;
        const sigs = [];
        for (let n = fi.min; n <= fi.params.length; ++n) sigs.push(types.slice(0, n));
        return sigs;
      }
      const base = this.classInfo(info.ext);
      return base ? this.ctorSignatures(base) : [[]];
    }

    superCtorCall(info, args) {
      const base = this.classInfo(info.ext);
      const sigs = base ? this.ctorSignatures(base) : [[]];
      const lowered = this.lowerArgsFor(args, sigs);
      return E.call(E.sup(base ? base.javaName : 'Object'), '<init>', lowered, 'void');
    }

    /** Pick the signature matching the argument count (padding with undefined) and convert. */
    lowerArgsFor(args, sigs) {
      const spread = args.some(a => a && a.type === 'SpreadElement');
      if (spread) throw new LoweringError('spread arguments to a typed call');
      let sig = sigs.find(s => s.length === args.length) || sigs.filter(s => s.length > args.length).sort((a, b) => a.length - b.length)[0]
        || sigs.slice().sort((a, b) => b.length - a.length)[0] || [];
      const out = [];
      for (let i = 0; i < sig.length; ++i) out.push(i < args.length ? this.valueOf(args[i], sig[i]) : this.undefinedOf(sig[i]));
      return out;
    }

    /** The value a missing argument (JavaScript undefined) takes in a JVM type. */
    undefinedOf(t) {
      if (t === 'int' || t === 'long') return E.lit(0, t);
      if (t === 'double') return E.lit(NaN, 'double');
      if (t === 'boolean') return E.bool(false);
      return E.nul(t);
    }

    declareParam(p, t) {
      const name = this.declareLocal(p.sym || { name: p.name }, t, true);
      return { name, t };
    }

    /** Parameters a nested function assigns are copied into boxed locals; destructuring parameters are unpacked. */
    paramPrologue(fi, params) {
      const out = [];
      fi.params.forEach((p, i) => {
        const pattern = p.sym && p.sym.pattern;
        if (!pattern) return;
        const src = E.name(params[i].name, params[i].t);
        if (pattern.type === 'ObjectPattern') {
          for (const q of pattern.properties || []) {
            const v = q.value || q.key;
            if (!v || !v.__sym) continue;
            const key = q.key && (q.key.name || q.key.value);
            const t = this.symJt(v.__sym);
            out.push(S.local(this.declareLocal(v.__sym, t), t, this.conv(E.scall('Js', 'getProp', [this.conv(src, 'Object'), E.str(key)], 'Object'), t)));
          }
        } else {
          (pattern.elements || []).forEach((v, k) => {
            if (!v || !v.__sym) return;
            const t = this.symJt(v.__sym);
            out.push(S.local(this.declareLocal(v.__sym, t), t, this.conv(E.scall('Js', 'index', [this.conv(src, 'Object'), E.cast(E.int(k), 'Integer')], 'Object'), t)));
          });
        }
      });
      fi.params.forEach((p, i) => {
        const sym = p.sym;
        if (sym && this.needsBox(sym)) {
          const boxed = this.fresh(params[i].name);
          out.push(S.local(boxed, params[i].t, E.name(params[i].name, params[i].t), { boxed: true }));
          sym.javaName = boxed;
          sym.boxed = true;
        }
      });
      return out;
    }

    needsBox(sym) {
      if (sym.boxed && sym.predeclaredIn) return true;
      // the declaration always initialises (undefined where JavaScript gives none): any later write breaks finality
      return !!(sym.captured && (sym.capturedAssigned || sym.assigns > (sym.isVar && sym.node && sym.node.init ? 1 : 0)));
    }

    defaultArg(p, t) {
      if (p.def) return this.valueOf(p.def, t);
      return this.undefinedOf(t);
    }

    /**
     * Lower a function or method, with overloads for trailing default and
     * omitted parameters.
     * @returns {Object[]} method declarations
     */
    lowerFunction(fi, opts) {
      const info = opts.cls || null;
      fi.isStatic = !!opts.static;
      const sig = this.signature(fi, info);
      const out = [];
      const javaName = fi.javaName;
      // Overloads delegating with the default values
      const base = fi.overrides;
      for (let n = fi.min; n < fi.params.length; ++n) {
        this.fn = { locals: [new Map()], labels: [], isStatic: !!opts.static, retJt: sig.ret, cls: info, used: new Set() };
        const params = fi.params.slice(0, n).map((p, i) => this.declareParam(p, sig.params[i]));
        const args = params.map(p => E.name(p.name, p.t));
        for (let i = n; i < fi.params.length; ++i) args.push(this.defaultArg(fi.params[i], sig.params[i]));
        const call = opts.static ? E.scall(info ? info.javaName : null, javaName, args, sig.ret) : E.call(E.self(info.javaName), javaName, args, sig.ret);
        out.push({ k: 'method', name: javaName, params, ret: sig.ret, static: !!opts.static, body: [sig.ret === 'void' ? S.expr(call) : S.ret(call)] });
        this.fn = null;
      }
      // A base method with fewer parameters than this override is overridden too, delegating
      if (base && !base.m.framework === false) { /* framework arities match their JavaScript ones */ }
      this.fn = { locals: [new Map()], labels: [], isStatic: !!opts.static, retJt: sig.ret, cls: info, used: new Set(), node: fi.node };
      const params = fi.params.map((p, i) => this.declareParam(p, sig.params[i]));
      const body = [];
      // Parameters typed differently from the base signature are converted on entry
      fi.params.forEach((p, i) => {
        if (!p.sym) return;
        const own = this.paramJt(p);
        if (own !== sig.params[i] && !(T.isRef(own) && own === 'Object')) {
          const local = this.fresh(params[i].name);
          body.push(S.local(local, own, this.conv(E.name(params[i].name, sig.params[i]), own)));
          p.sym.javaName = local;
          p.sym.jtCached = own;
        }
      });
      body.push(...this.paramPrologue(fi, params));
      body.push(...this.lowerFnBody(fi.node, sig.ret));
      out.push({ k: 'method', name: javaName, params, ret: sig.ret, static: !!opts.static, body, varargs: fi.params.length && fi.params[fi.params.length - 1].rest });
      this.fn = null;
      return out;
    }

    lowerFnBody(fn, retJt) {
      if (fn.body && fn.body.type === 'BlockStatement') {
        const hoisted = this.hoistVars(fn);
        const stmts = this.lowerStmts(fn.body.body || []);
        return [...hoisted, ...stmts];
      }
      if (fn.body) {
        if (retJt === 'void') return [S.expr(this.lowerExpr(fn.body))];
        return [S.ret(this.valueOf(fn.body, retJt))];
      }
      return [];
    }

    /** `var` declarations of a function, declared at its top (JavaScript hoists them). */
    hoistVars(fn) {
      const out = [];
      const seen = new Set();
      const visit = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunction', 'ArrowFunctionExpression', 'ClassDeclaration'].includes(n.type)) return;
        if (n.type === 'VariableDeclaration' && n.kind === 'var')
          for (const d of n.declarations || []) {
            const sym = d.__sym;
            if (!sym || seen.has(sym) || sym.static) continue;
            seen.add(sym);
            const t = this.symJt(sym);
            const name = this.declareLocal(sym, t);
            sym.boxed = this.needsBox(sym);
            sym.declaredIn = this.fn;
            out.push(S.local(name, t, this.undefinedOf(t), { boxed: sym.boxed }));
          }
        eachChild(n, c => visit(c));
      };
      visit(fn.body && fn.body.body);
      return out;
    }

    lowerAccessor(info, a) {
      const out = [];
      const base = this.baseAccessor(info, a.name);
      const jt = this.accessorJt(a);
      const setJt = this.accessorSetJt(a);
      if (base && base.field) this.warn(`accessor ${info.name}.${a.name} overrides a field of ${base.owner.name}`);
      if (a.getNode) {
        this.fn = { locals: [new Map()], labels: [], isStatic: false, retJt: jt, cls: info, used: new Set(), node: a.getNode.value };
        out.push({ k: 'method', name: 'get_' + mid(a.name), params: [], ret: jt, static: !!a.getNode.static, body: this.lowerFnBody(a.getNode.value, jt) });
        this.fn = null;
      } else if (base && base.a && base.a.getter) {
        // A setter alone hides the inherited getter in JavaScript: reading gives undefined
        out.push({ k: 'method', name: 'get_' + mid(a.name), params: [], ret: jt, static: false, body: [S.ret(this.undefinedOf(jt))] });
      }
      if (a.setNode) {
        const fn = a.setNode.value;
        this.fn = { locals: [new Map()], labels: [], isStatic: false, retJt: 'void', cls: info, used: new Set(), node: fn };
        const fi = this.fnInfo(fn, 'set_' + a.name);
        const params = fi.params.slice(0, 1).map(p => this.declareParam(p, setJt));
        const body = [];
        const p = fi.params[0];
        if (p && p.sym) {
          const own = this.paramJt(p);
          if (own !== setJt && own !== 'Object') {
            const local = this.fresh(params[0].name);
            body.push(S.local(local, own, this.conv(E.name(params[0].name, setJt), own)));
            p.sym.javaName = local; p.sym.jtCached = own;
          }
        }
        body.push(...this.paramPrologue(fi, params));
        body.push(...this.lowerFnBody(fn, 'void'));
        out.push({ k: 'method', name: 'set_' + mid(a.name), params, ret: 'void', static: !!a.setNode.static, body });
        this.fn = null;
      } else if (a.getNode && base && base.a && base.a.setter) {
        // A getter alone: assigning throws in strict mode
        out.push({ k: 'method', name: 'set_' + mid(a.name), params: [{ name: 'v', t: setJt }], ret: 'void', static: false,
          body: [S.thr(E.scall('Js', 'error', [E.str('TypeError'), E.str(`Cannot set property ${a.name} which has only a getter`)], 'JsError'))] });
      }
      return out;
    }

    // =================================================================
    // Locals and scopes
    // =================================================================

    /** Declare a local (or parameter) in the current function, renaming any shadowing. */
    declareLocal(sym, t, isParam) {
      const fn = this.fn;
      let name = jid(sym.name || 'tmp');
      const taken = n => fn.used.has(n) || this.fieldShadows(n);
      if (taken(name)) { let i = 1; while (taken(`${name}_${i}`)) ++i; name = `${name}_${i}`; }
      fn.used.add(name);
      fn.locals[fn.locals.length - 1].set(sym.name, name);
      sym.javaName = name;
      sym.jtCached = sym.jtCached || t;
      if (t) sym.jtCached = t;
      return name;
    }

    /** Locals may not reuse a name an enclosing function's local already holds (Java forbids shadowing). */
    fieldShadows(n) {
      for (const outer of this.fnStack || []) if (outer.used.has(n)) return true;
      return false;
    }

    pushScope() { this.fn.locals.push(new Map()); }
    popScope() { this.fn.locals.pop(); }

    // =================================================================
    // Statements
    // =================================================================

    lowerStmts(stmts) {
      const out = [];
      // Nested function declarations of this block: one object of local functions,
      // placed where the first is declared (or at the top when called before it)
      const fnDecls = (stmts || []).filter(s => s && s.type === 'FunctionDeclaration');
      if (fnDecls.length) {
        // JavaScript hoists the functions: they go first. The block's own locals
        // they use are declared ahead of them (boxed: a later initialisation is an
        // assignment), so the functions see them wherever they are declared.
        const blockSyms = new Set();
        for (const st of stmts) if (st && st.type === 'VariableDeclaration' && st.kind !== 'var')
          for (const d of st.declarations || []) if (d.__sym && !d.__asFunction) blockSyms.add(d.__sym);
        const captured = [];
        const visit = n => {
          if (!n || typeof n !== 'object') return;
          if (Array.isArray(n)) { n.forEach(visit); return; }
          if (n.type === 'Identifier' && n.__sym && blockSyms.has(n.__sym) && !captured.includes(n.__sym)) captured.push(n.__sym);
          eachChild(n, visit);
        };
        fnDecls.forEach(fd => visit(fd.body));
        for (const sym of captured) {
          if (sym.static || this.moduleVars.has(sym)) continue;
          const t = this.symJt(sym);
          const name = this.declareLocal(sym, t);
          sym.boxed = true;
          sym.predeclaredIn = this.fn;
          out.push(S.local(name, t, this.undefinedOf(t), { boxed: true }));
        }
        out.push(this.lowerLocalFunctions(fnDecls));
      }
      for (const s of stmts || []) {
        if (!s) continue;
        if (s.type === 'FunctionDeclaration') continue;
        out.push(...this.lowerStmt(s));
      }
      return out;
    }

    /** Whether the code being lowered is inside a method of that local-function holder. */
    insideHolder(holder) {
      if (this.fn && this.fn.holders && this.fn.holders.has(holder)) return true;
      return false;
    }

    mentions(node, names) {
      let hit = false;
      const visit = n => {
        if (hit || !n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if (n.type === 'Identifier' && names.has(n.name)) { hit = true; return; }
        eachChild(n, c => visit(c));
      };
      visit(node);
      return hit;
    }

    /** A block's function declarations as methods of one local object (they may call each other). */
    lowerLocalFunctions(fnDecls) {
      const holder = this.fresh('fns');
      const outerFn = this.fn;
      const methods = [];
      for (const f of fnDecls) {
        const sym = f.__sym;
        sym.kind = 'localfn';
        sym.holder = holder;
        const fi = this.fnInfo(f, f.id.name);
        sym.fi = fi;
      }
      this.fnStack = (this.fnStack || []).concat([outerFn]);
      for (const f of fnDecls) {
        const fi = f.__sym.fi;
        const ret = this.fnRet(fi);
        const ptypes = fi.params.map(p => this.paramJt(p));
        fi.sig = { params: ptypes, ret };
        for (let n = fi.min; n < fi.params.length; ++n) {
          this.fn = { locals: [new Map()], labels: [], isStatic: outerFn.isStatic, retJt: ret, cls: outerFn.cls, used: new Set(), inner: true, holders: new Set([...(outerFn.holders || []), holder]) };
          const params = fi.params.slice(0, n).map((p, i) => this.declareParam(p, ptypes[i]));
          const args = params.map(p => E.name(p.name, p.t));
          for (let i = n; i < fi.params.length; ++i) args.push(this.defaultArg(fi.params[i], ptypes[i]));
          const call = E.call(null, fi.javaName, args, ret);
          methods.push({ k: 'method', name: fi.javaName, params, ret, body: [ret === 'void' ? S.expr(call) : S.ret(call)] });
        }
        this.fn = { locals: [new Map()], labels: [], isStatic: outerFn.isStatic, retJt: ret, cls: outerFn.cls, used: new Set(), inner: true, node: f, holders: new Set([...(outerFn.holders || []), holder]) };
        const params = fi.params.map((p, i) => this.declareParam(p, ptypes[i]));
        const body = [...this.paramPrologue(fi, params), ...this.lowerFnBody(f, ret)];
        methods.push({ k: 'method', name: fi.javaName, params, ret, body });
      }
      this.fnStack.pop();
      this.fn = outerFn;
      outerFn.used.add(holder);
      return S.fns(holder, { methods });
    }

    lowerStmt(node) {
      if (!node) return [];
      switch (node.type) {
        case 'VariableDeclaration': return this.lowerVarDecl(node);
        case 'ExpressionStatement': return this.lowerExprStmt(node.expression);
        case 'ReturnStatement': {
          const rt = this.fn.retJt;
          if (!node.argument) return [S.ret(null)];
          if (rt === 'void') return [...this.lowerExprStmt(node.argument), S.ret(null)];
          return [S.ret(this.valueOf(node.argument, rt))];
        }
        case 'IfStatement': {
          const c = this.truthy(this.lowerExpr(node.test));
          const then = this.scoped(() => this.lowerStmt(node.consequent));
          const els = node.alternate ? this.scoped(() => this.lowerStmt(node.alternate)) : null;
          return [S.iff(c, this.asBlock(then), els ? this.asBlock(els) : null)];
        }
        case 'BlockStatement': return [S.block(this.scoped(() => this.lowerStmts(node.body)))];
        case 'EmptyStatement': return [];
        case 'ForStatement': return this.lowerFor(node);
        case 'WhileStatement': {
          const loop = S.whl(null, null);
          loop.c = this.truthy(this.lowerExpr(node.test));
          loop.body = this.asBlock(this.inLoop(loop, node, () => this.scoped(() => this.lowerStmt(node.body))));
          return [loop];
        }
        case 'DoWhileStatement': {
          const loop = S.dowhile(null, null);
          loop.body = this.asBlock(this.inLoop(loop, node, () => this.scoped(() => this.lowerStmt(node.body))));
          loop.c = this.truthy(this.lowerExpr(node.test));
          return [loop];
        }
        case 'ForOfStatement': return this.lowerForOf(node);
        case 'ForInStatement': return this.lowerForIn(node);
        case 'SwitchStatement': return this.lowerSwitch(node);
        case 'BreakStatement': return [S.brk(this.jumpTarget(node, false))];
        case 'ContinueStatement': return [S.cont(this.jumpTarget(node, true))];
        case 'ThrowStatement': return [S.thr(this.throwable(node.argument))];
        case 'TryStatement': return this.lowerTry(node);
        case 'LabeledStatement': {
          const label = node.label && node.label.name;
          const body = node.body;
          if (body && ['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForOfStatement', 'ForInStatement', 'SwitchStatement'].includes(body.type)) {
            this.fn.pendingLabel = label;
            const inner = this.lowerStmt(body);
            this.fn.pendingLabel = null;
            return inner;
          }
          // A labeled block: break label leaves it
          const block = S.labeled(null);
          this.fn.labels.push({ kind: 'block', node, ir: block, label });
          try { block.body = S.block(this.scoped(() => this.lowerStmt(body))); } finally { this.fn.labels.pop(); }
          return [block];
        }
        case 'ClassDeclaration': return []; // hoisted
        case 'FunctionDeclaration': return [];
        default:
          // An expression in statement position
          if (node.type && /Expression$|Call$|Append$|Clear$|Fill$|Set$|Write$/.test(node.type)) return this.lowerExprStmt(node);
          return this.lowerExprStmt(node);
      }
    }

    /** A statement list as one block (a list holding one block is that block). */
    asBlock(stmts) {
      return stmts.length === 1 && stmts[0].k === 'block' ? stmts[0] : S.block(stmts);
    }

    scoped(fn) {
      this.pushScope();
      try { return fn(); } finally { this.popScope(); }
    }

    /** Lower a loop body with its break/continue targets registered. */
    inLoop(loop, node, fn) {
      const label = this.fn.pendingLabel || null;
      this.fn.pendingLabel = null;
      this.fn.labels.push({ kind: 'loop', node, ir: loop, label });
      try { return fn(); } finally { this.fn.labels.pop(); }
    }

    jumpTarget(node, isContinue) {
      const name = node.label && node.label.name;
      for (let i = this.fn.labels.length - 1; i >= 0; --i) {
        const l = this.fn.labels[i];
        if (name) { if (l.label === name) return l.ir; continue; }
        if (isContinue && l.kind !== 'loop') continue;
        if (l.kind === 'block') continue;
        return l.ir;
      }
      if (name) return { k: 'labeledRef', label: name };
      throw new LoweringError(`${isContinue ? 'continue' : 'break'} outside a loop`);
    }

    lowerVarDecl(node) {
      const out = [];
      for (const d of node.declarations || []) {
        if (!d.id) continue;
        if (d.__asFunction || d.__asClass || d.__namespaceAlias) continue;
        if (this.isFrameworkAlias(d)) continue;
        if (d.id.type === 'ObjectPattern') {
          if (d.init && d.init.type === 'Identifier' && (d.init.name === 'AlgorithmFramework' || d.init.name === 'OpCodes')) continue;
          out.push(...this.lowerObjectPattern(d));
          continue;
        }
        if (d.id.type === 'ArrayPattern') { out.push(...this.lowerArrayPattern(d)); continue; }
        const sym = d.__sym;
        if (!sym) continue;
        const t = this.symJt(sym);
        if (sym.static || (this.fn.name === '<clinit>' && this.moduleVars.has(sym))) {
          // a module variable: assign the static field
          sym.static = true;
          if (d.init) out.push(S.expr(E.assign(E.sfield(this.unitName, sym.javaName, t), this.valueOf(d.init, t))));
          continue;
        }
        if ((sym.isVar && sym.declaredIn === this.fn) || sym.predeclaredIn === this.fn) {
          if (d.init) out.push(S.expr(E.assign(this.symRef(sym), this.valueOf(d.init, t))));
          continue;
        }
        let t2 = t;
        const initRaw = d.init ? this.lowerExpr(d.init, t) : null;
        // no IL type: the local takes the reference type its initialiser has (new Array(n), a class instance)
        if (t === 'Object' && initRaw && T.isRef(initRaw.t) && !['Object', 'null', 'Class', 'void'].includes(initRaw.t) && !ilName(sym.il)) { t2 = initRaw.t; sym.jtCached = t2; }
        const init = initRaw ? this.conv(initRaw, t2) : this.undefinedOf(t2);
        const name = this.declareLocal(sym, t2);
        const boxed = this.needsBox(sym);
        sym.boxed = boxed;
        if (sym.isVar) sym.declaredIn = this.fn;
        out.push(S.local(name, t2, init, { boxed }));
      }
      return out;
    }

    lowerArrayPattern(d) {
      const out = [];
      const src = this.lowerExpr(d.init);
      const tmp = this.fresh('destructure');
      this.fn.used.add(tmp);
      out.push(S.local(tmp, src.t, src));
      (d.id.elements || []).forEach((el, i) => {
        if (!el || el.type !== 'Identifier' || !el.__sym) return;
        const t = this.symJt(el.__sym);
        const name = this.declareLocal(el.__sym, t);
        out.push(S.local(name, t, this.conv(this.elementGet(E.name(tmp, src.t), E.int(i)), t), { boxed: this.needsBox(el.__sym) }));
        el.__sym.boxed = this.needsBox(el.__sym);
      });
      return out;
    }

    lowerObjectPattern(d) {
      const out = [];
      if (!d.init) return out;
      const src = this.lowerExpr(d.init);
      const tmp = this.fresh('destructure');
      this.fn.used.add(tmp);
      out.push(S.local(tmp, src.t, src));
      for (const p of d.id.properties || []) {
        const key = p.key && (p.key.name || p.key.value);
        const v = p.value || p.key;
        if (!v || v.type !== 'Identifier' || !v.__sym) continue;
        const t = this.symJt(v.__sym);
        const name = this.declareLocal(v.__sym, t);
        out.push(S.local(name, t, this.conv(this.memberGet(E.name(tmp, src.t), key, null), t), { boxed: this.needsBox(v.__sym) }));
        v.__sym.boxed = this.needsBox(v.__sym);
      }
      return out;
    }

    lowerExprStmt(expr) {
      if (!expr) return [];
      if (expr.type === 'SequenceExpression') return expr.expressions.flatMap(e => this.lowerExprStmt(e));
      // a && b(), a || b() as statements
      if (expr.type === 'LogicalExpression' && (expr.operator === '&&' || expr.operator === '||')) {
        const c = this.truthy(this.lowerExpr(expr.left));
        return [S.iff(expr.operator === '&&' ? c : E.un('!', c, 'boolean'), S.block(this.lowerExprStmt(expr.right)), null)];
      }
      if (expr.type === 'ConditionalExpression') {
        return [S.iff(this.truthy(this.lowerExpr(expr.test)), S.block(this.lowerExprStmt(expr.consequent)), S.block(this.lowerExprStmt(expr.alternate)))];
      }
      const e = this.lowerExpr(expr, null, true);
      if (!e) return [];
      return [S.expr(e)];
    }

    lowerFor(node) {
      const out = [];
      const loop = S.fr([], null, [], null);
      return this.scoped(() => {
        const init = [];
        if (node.init) {
          if (node.init.type === 'VariableDeclaration') init.push(...this.lowerVarDecl(node.init));
          else init.push(...this.lowerExprStmt(node.init));
        }
        // a loop variable a closure captures and the loop assigns is boxed: declared ahead of the loop
        loop.init = init;
        loop.c = node.test ? this.truthy(this.lowerExpr(node.test)) : null;
        loop.update = node.update ? this.lowerExprStmt(node.update) : [];
        loop.body = this.asBlock(this.inLoop(loop, node, () => this.scoped(() => this.lowerStmt(node.body))));
        out.push(loop);
        return out;
      });
    }

    lowerForOf(node) {
      return this.scoped(() => {
        const src = this.lowerExpr(node.right);
        const coll = this.fresh('of');
        const idx = this.fresh('i');
        this.fn.used.add(coll); this.fn.used.add(idx);
        let collT = src.t, getter, len;
        if (src.t === 'String') {
          getter = () => E.scall('Js', 'charAt', [E.name(coll, 'String'), E.cast(E.name(idx, 'int'), 'double')], 'String');
          len = E.call(E.name(coll, 'String'), 'length', [], 'int');
        } else if (src.t === 'JsMap' || src.t === 'JsSet' || src.t === 'JsObject' || !T.isArray(src.t)) {
          const arr = src.t === 'JsMap' ? E.call(src, 'entries', [], 'JsArray<Object>') : src.t === 'JsSet' ? E.call(src, 'values', [], 'JsArray<Object>') : E.scall('Js', 'spread', [this.conv(src, 'Object')], 'JsArrayLike');
          return this.forOfOver(node, arr, coll, idx);
        } else {
          getter = () => this.elementGet(E.name(coll, collT), E.name(idx, 'int'));
          len = E.call(E.name(coll, collT), 'length', [], 'int');
        }
        const loop = S.fr([S.local(coll, collT, src), S.local(idx, 'int', E.int(0))], E.bin('<', E.name(idx, 'int'), len, 'boolean'), [S.expr(E.inc(E.name(idx, 'int'), '++', false))], null);
        loop.body = this.asBlock(this.inLoop(loop, node, () => this.scoped(() => [...this.bindLoopVar(node.left, getter()), ...this.lowerStmt(node.body)])));
        return [loop];
      });
    }

    forOfOver(node, arr, coll, idx) {
      const loop = S.fr([S.local(coll, arr.t, arr), S.local(idx, 'int', E.int(0))], E.bin('<', E.name(idx, 'int'), E.call(E.name(coll, arr.t), 'length', [], 'int'), 'boolean'), [S.expr(E.inc(E.name(idx, 'int'), '++', false))], null);
      const get = E.call(E.name(coll, arr.t), 'getBoxed', [E.name(idx, 'int')], 'Object');
      loop.body = this.asBlock(this.inLoop(loop, node, () => this.scoped(() => [...this.bindLoopVar(node.left, get), ...this.lowerStmt(node.body)])));
      return [loop];
    }

    bindLoopVar(left, value) {
      if (left.type === 'VariableDeclaration') {
        const out = [];
        const decls = left.declarations || [];
        decls.forEach((d, i) => {
          if (i === 0 && d.id && d.id.type === 'Identifier' && d.__sym) {
            const t = this.symJt(d.__sym);
            const name = this.declareLocal(d.__sym, t);
            d.__sym.boxed = this.needsBox(d.__sym);
            out.push(S.local(name, t, this.conv(value, t), { boxed: d.__sym.boxed }));
          } else if (i === 0 && d.id && d.id.type === 'ArrayPattern') {
            out.push(...this.lowerArrayPattern({ id: d.id, init: { __lowered: value } }));
          } else if (i > 0) {
            out.push(...this.lowerVarDecl({ type: 'VariableDeclaration', kind: 'const', declarations: [d] }));
          }
        });
        return out;
      }
      if (left.type === 'Identifier' && left.__sym) return [S.expr(E.assign(this.symRef(left.__sym), this.conv(value, this.symJt(left.__sym))))];
      throw new LoweringError('for-of target ' + left.type);
    }

    lowerForIn(node) {
      return this.scoped(() => {
        const src = this.lowerExpr(node.right);
        const keys = T.isArray(src.t)
          ? E.scall('Js', 'indexKeys', [src], 'JsArray<String>')
          : E.call(this.conv(src, 'JsObject'), 'keys', [], 'JsArray<String>');
        const coll = this.fresh('keys'), idx = this.fresh('i');
        this.fn.used.add(coll); this.fn.used.add(idx);
        const loop = S.fr([S.local(coll, 'JsArray<String>', keys), S.local(idx, 'int', E.int(0))], E.bin('<', E.name(idx, 'int'), E.call(E.name(coll, 'JsArray<String>'), 'length', [], 'int'), 'boolean'), [S.expr(E.inc(E.name(idx, 'int'), '++', false))], null);
        const get = E.call(E.name(coll, 'JsArray<String>'), 'get', [E.name(idx, 'int')], 'String');
        loop.body = this.asBlock(this.inLoop(loop, node, () => this.scoped(() => [...this.bindLoopVar(node.left, get), ...this.lowerStmt(node.body)])));
        return [loop];
      });
    }

    lowerSwitch(node) {
      const disc = this.lowerExpr(node.discriminant);
      const sw = S.sw(null, []);
      const label = this.fn.pendingLabel || null;
      this.fn.pendingLabel = null;
      this.fn.labels.push({ kind: 'switch', node, ir: sw, label });
      try {
        // Native switch: an int or String discriminant with literal cases
        const cases = node.cases || [];
        const literalTests = cases.every(c => !c.test || (c.test.type === 'Literal' && (typeof c.test.value === 'string' || (typeof c.test.value === 'number' && Number.isInteger(c.test.value)))));
        let kind = null;
        if (literalTests) {
          const vals = cases.filter(c => c.test).map(c => c.test.value);
          if (vals.every(v => typeof v === 'string') && disc.t === 'String') kind = 'String';
          else if (vals.every(v => typeof v === 'number' && v >= MIN_INT && v <= MAX_INT) && T.isNumeric(T.unbox(disc.t))) kind = 'int';
        }
        if (kind) {
          sw.disc = kind === 'int' ? this.switchInt(disc) : disc;
          sw.kind = kind;
          sw.cases = this.scoped(() => cases.map(c => ({ tests: c.test ? [kind === 'int' ? E.int(c.test.value) : E.str(c.test.value)] : null, body: this.lowerSwitchBody(c.consequent) })));
          // A double discriminant that is not integral matches no int case
          if (kind === 'int' && T.unbox(disc.t) === 'double') sw.discGuard = true;
          return this.wrapSwitchDisc(sw, disc, kind);
        }
        // General: the index of the first matching case, then fall-through by order
        const tmp = this.fresh('sw'), m = this.fresh('m');
        this.fn.used.add(tmp); this.fn.used.add(m);
        const discT = disc.t;
        const out = [S.local(tmp, discT, disc)];
        let matchExpr = E.int(-1);
        const defaultIdx = cases.findIndex(c => !c.test);
        for (let i = cases.length - 1; i >= 0; --i) {
          if (!cases[i].test) continue;
          const test = this.lowerExpr(cases[i].test);
          const eq = this.strictEquals(E.name(tmp, discT), test);
          matchExpr = E.cond(eq, E.int(i), matchExpr, 'int');
        }
        out.push(S.local(m, 'int', matchExpr));
        if (defaultIdx >= 0) out.push(S.iff(E.bin('<', E.name(m, 'int'), E.int(0), 'boolean'), S.block([S.expr(E.assign(E.name(m, 'int'), E.int(defaultIdx)))]), null));
        sw.k = 'switchChain';
        sw.match = m;
        sw.cases = this.scoped(() => cases.map((c, i) => ({ index: i, body: this.lowerSwitchBody(c.consequent) })));
        out.push(sw);
        return [S.block(out)];
      } finally {
        this.fn.labels.pop();
      }
    }

    wrapSwitchDisc(sw, disc, kind) {
      if (kind === 'int' && T.unbox(disc.t) === 'double') {
        // only an integral double can equal an int case label
        const tmp = this.fresh('sw');
        this.fn.used.add(tmp);
        sw.disc = this.conv(E.name(tmp, 'double'), 'int');
        sw.guard = E.bin('==', E.name(tmp, 'double'), E.scall('Math', 'floor', [E.name(tmp, 'double')], 'double'), 'boolean');
        return [S.block([S.local(tmp, 'double', this.conv(disc, 'double')), sw])];
      }
      if (kind === 'int' && T.unbox(disc.t) === 'long') {
        const tmp = this.fresh('sw');
        this.fn.used.add(tmp);
        sw.disc = E.cast(E.name(tmp, 'long'), 'int');
        sw.guard = E.bin('==', E.name(tmp, 'long'), E.cast(E.cast(E.name(tmp, 'long'), 'int'), 'long'), 'boolean');
        return [S.block([S.local(tmp, 'long', this.conv(disc, 'long')), sw])];
      }
      return [sw];
    }

    switchInt(disc) {
      const u = T.unbox(disc.t);
      if (u === 'int') return this.conv(disc, 'int');
      return disc;
    }

    lowerSwitchBody(stmts) {
      return this.lowerStmts(stmts || []);
    }

    lowerTry(node) {
      const block = S.block(this.scoped(() => this.lowerStmts(node.block.body)));
      let catchName = null, catchBody = null;
      if (node.handler) {
        this.scoped(() => {
          const p = node.handler.param;
          if (p && p.__sym) {
            catchName = this.declareLocal(p.__sym, 'RuntimeException');
            p.__sym.jtCached = 'RuntimeException';
          } else {
            catchName = this.fresh('e');
            this.fn.used.add(catchName);
          }
          catchBody = S.block(this.lowerStmts(node.handler.body.body));
        });
      }
      const fin = node.finalizer ? S.block(this.scoped(() => this.lowerStmts(node.finalizer.body))) : null;
      return [S.tri(block, catchName, catchBody, fin)];
    }

    throwable(node) {
      const e = this.lowerExpr(node);
      if (e.t === 'JsError' || e.t === 'RuntimeException') return e;
      return E.scall('JsError', 'thrown', [this.conv(e, 'Object')], 'JsError');
    }

    // =================================================================
    // Expressions
    // =================================================================

    /** Lower and convert to a JVM type. */
    valueOf(node, t) {
      const e = this.lowerExpr(node, t);
      return this.conv(e, t);
    }

    /**
     * Lower an IL expression.
     * @param {Object} node - IL node
     * @param {string} [expect] - the JVM type the context wants (guides literals)
     * @param {boolean} [stmt] - in statement position (the value is discarded)
     * @returns {Object} IR expression
     */
    lowerExpr(node, expect, stmt) {
      if (!node) return E.nul();
      if (node.__lowered) return node.__lowered;
      const h = this['x_' + node.type];
      if (h) return h.call(this, node, expect, stmt);
      throw new LoweringError(`no lowering for IL node type '${node.type}'`);
    }

    x_Literal(node, expect) {
      const v = node.value;
      if (node.regex) return E.nw('JsRegExp', [E.str(node.regex.pattern), E.str(node.regex.flags || '')]);
      if (v instanceof RegExp) return E.nw('JsRegExp', [E.str(v.source), E.str(v.flags)]);
      if (typeof v === 'bigint') return E.big(v);
      if (typeof v === 'string' && typeof node.raw === 'string' && /^-?[0-9]+n$/.test(node.raw)) return E.big(node.raw.slice(0, -1));
      if (v === null || v === undefined) return E.nul(expect && T.isRef(expect) ? expect : 'null');
      if (typeof v === 'boolean') return E.bool(v);
      if (typeof v === 'string') return E.str(v);
      if (typeof v === 'number') {
        const big = this.isBig(node);
        if (big) return E.big(BigInt(v));
        const want = T.unbox(expect || '');
        const il = this.jt(node.resultType);
        let t = T.isNumeric(want) ? want : (T.isNumeric(il) ? il : 'double');
        if (want === 'BigInteger' && Number.isInteger(v)) return E.big(BigInt(v));
        if (!Number.isInteger(v) || Object.is(v, -0)) t = 'double';
        if (t === 'int' && (v > MAX_INT || v < MIN_INT)) t = Math.abs(v) <= 9007199254740992 ? 'long' : 'double';
        if (t === 'long' && Math.abs(v) > 9223372036854775807) t = 'double';
        return E.lit(v, t);
      }
      return E.nul();
    }

    x_TemplateLiteral(node) {
      let acc = null;
      (node.quasis || []).forEach((q, i) => {
        const text = q.value ? (q.value.cooked !== undefined ? q.value.cooked : q.value.raw) : '';
        acc = acc ? E.bin('+', acc, E.str(text), 'String') : E.str(text);
        if (i < (node.expressions || []).length) acc = E.bin('+', acc, this.toStr(this.lowerExpr(node.expressions[i])), 'String');
      });
      return acc || E.str('');
    }

    x_StringInterpolation(node) {
      let acc = E.str('');
      if (node.quasis && node.expressions) {
        node.quasis.forEach((q, i) => {
          acc = E.bin('+', acc, E.str(typeof q === 'string' ? q : (q && q.value && (q.value.cooked || q.value.raw)) || ''), 'String');
          if (i < node.expressions.length) acc = E.bin('+', acc, this.toStr(this.lowerExpr(node.expressions[i])), 'String');
        });
        return acc;
      }
      for (const part of node.parts || []) {
        if (part.type === 'ExpressionPart' || part.expression !== undefined) acc = E.bin('+', acc, this.toStr(this.lowerExpr(part.expression)), 'String');
        else acc = E.bin('+', acc, E.str(part.value !== undefined ? part.value : (part.text || '')), 'String');
      }
      return acc;
    }

    x_Identifier(node) {
      const sym = node.__sym;
      if (sym) {
        if (sym.kind === 'func') return this.functionValue(sym);
        if (sym.kind === 'localfn') return this.functionValue(sym);
        if (sym.kind === 'class') return { k: 'classref', name: this.classInfo(sym.name) ? this.classInfo(sym.name).javaName : sym.name, t: 'Class', cls: sym.name };
        return this.symRef(sym);
      }
      switch (node.name) {
        case 'undefined': return E.nul();
        case 'NaN': return E.dbl(NaN);
        case 'Infinity': return E.dbl(Infinity);
        case 'AlgorithmFramework': return { k: 'classref', name: 'AlgorithmFramework', t: 'Class', cls: 'AlgorithmFramework' };
        case 'OpCodes': return { k: 'classref', name: 'OpCodes', t: 'Class', cls: 'OpCodes' };
      }
      if (FRAMEWORK[node.name] || node.name === 'AlgorithmFramework') return { k: 'classref', name: node.name, t: 'Class', cls: node.name };
      if (FRAMEWORK_STATICS[node.name]) return this.functionValueStatic('AlgorithmFramework', node.name);
      if (node.name === 'Algorithms') return E.sfield('AlgorithmFramework', 'Algorithms', 'JsArray<Algorithm>');
      if (node.name === 'String' || node.name === 'Number' || node.name === 'Boolean' || node.name === 'BigInt') {
        // the conversion functions as values (arr.map(String))
        const argsName = this.fresh('a');
        const arg = E.scall('Js', 'arg', [E.name(argsName, 'Object[]'), E.int(0)], 'Object');
        const conv = { String: E.scall('Js', 'str', [arg], 'String'), Number: E.cast(E.scall('Js', 'toNum', [arg], 'double'), 'Double'), Boolean: E.cast(E.scall('Js', 'truthy', [arg], 'boolean'), 'Boolean'), BigInt: E.scall('Js', 'toBig', [arg], 'BigInteger') }[node.name];
        return E.lambda([{ name: argsName }], [S.ret(conv)]);
      }
      return this.conv(E.scall('Js', 'global', [E.str(node.name)], 'Object'), this.dynResultJt(node));
    }

    /** A reference to a symbol's storage (local, boxed local, or static field). */
    symRef(sym) {
      const t = this.symJt(sym);
      if (sym.static || this.moduleVars.has(sym)) {
        return E.sfield(this.unitName, sym.javaName, t);
      }
      return E.name(sym.javaName || jid(sym.name), t, sym.boxed ? { boxed: true } : undefined);
    }

    /** A function used as a value: a JsFn calling it. */
    functionValue(sym) {
      const fi = sym.fi;
      if (!fi) throw new LoweringError(`function ${sym.name} has no declaration`);
      const sig = sym.kind === 'localfn' ? fi.sig : this.signature(fi, null);
      const argsName = this.fresh('a');
      const args = sig.params.map((t, i) => this.conv(E.scall('Js', 'arg', [E.name(argsName, 'Object[]'), E.int(i)], 'Object'), t));
      const call = sym.kind === 'localfn' ? E.call(E.name(sym.holder, 'Object'), fi.javaName, args, sig.ret) : E.scall(this.unitName, fi.javaName, args, sig.ret);
      return E.lambda([{ name: argsName }], sig.ret === 'void' ? [S.expr(call), S.ret(E.nul())] : [S.ret(this.conv(call, 'Object'))]);
    }

    functionValueStatic(owner, name) {
      const [ptypes, ret] = FRAMEWORK_STATICS[name];
      const argsName = this.fresh('a');
      const args = ptypes.map((t, i) => this.conv(E.scall('Js', 'arg', [E.name(argsName, 'Object[]'), E.int(i)], 'Object'), t));
      const call = E.scall(owner, name, args, ret);
      return E.lambda([{ name: argsName }], ret === 'void' ? [S.expr(call), S.ret(E.nul())] : [S.ret(this.conv(call, 'Object'))]);
    }

    x_ThisExpression() {
      if (!this.fn || this.fn.isStatic || !this.fn.cls) {
        if (this.fn && this.fn.cls && this.fn.isStatic) return { k: 'classref', name: this.fn.cls.javaName, t: 'Class', cls: this.fn.cls.name };
        // module code: the global object
        return E.sfield('Js', 'GLOBAL', 'JsObject');
      }
      return E.self(this.fn.cls.javaName);
    }

    selfRef() {
      if (!this.fn || !this.fn.cls) return E.sfield('Js', 'GLOBAL', 'JsObject');
      if (this.fn.isStatic) return { k: 'classref', name: this.fn.cls.javaName, t: 'Class', cls: this.fn.cls.name };
      return E.self(this.fn.cls.javaName);
    }

    x_ThisPropertyAccess(node) {
      const name = typeof node.property === 'string' ? node.property : (node.property && (node.property.name || node.property.value));
      if (node.computed && node.property && typeof node.property === 'object') return this.dynamicIndex(this.selfRef(), this.lowerExpr(node.property), node);
      return this.memberGet(this.selfRef(), name, node);
    }

    x_ThisMethodCall(node) {
      return this.methodCall(this.selfRef(), node.method, node.arguments || [], node);
    }

    x_ParentMethodCall(node) {
      const base = this.fn.cls && this.classInfo(this.fn.cls.ext);
      if (!base || !this.findMember(base.name, node.method)) return this.superMissing(node.method, node);
      return this.methodCall(E.sup(base ? base.javaName : 'Object'), node.method, node.arguments || [], node, base ? base.name : null);
    }

    x_ParentConstructorCall(node) {
      return this.superCtorCall(this.fn.cls, node.arguments || []);
    }

    /** super.name() where no base class has the method: JavaScript throws a TypeError there. */
    superMissing(name, node) {
      const t = this.callResultJt(node);
      const thrown = E.scall('Js', 'typeError', [E.str(`(intermediate value).${name} is not a function`)], 'Object');
      return t === 'void' ? thrown : this.conv(thrown, t);
    }

    x_Super() { const base = this.fn.cls && this.classInfo(this.fn.cls.ext); return E.sup(base ? base.javaName : 'Object'); }

    x_SequenceExpression(node, expect, stmt) {
      if (stmt) throw new LoweringError('sequence in statement position');
      // a, b: evaluate a for effect, yield b
      const parts = node.expressions.map(e => this.lowerExpr(e));
      const last = parts[parts.length - 1];
      return E.scall('Js', 'seq', [...parts.slice(0, -1).map(p => this.conv(p, 'Object')), this.conv(last, T.box(last.t === 'null' ? 'Object' : last.t))], last.t === 'null' ? 'Object' : T.box(last.t));
    }

    x_ConditionalExpression(node, expect) {
      const c = this.truthy(this.lowerExpr(node.test));
      let a = this.lowerExpr(node.consequent, expect), b = this.lowerExpr(node.alternate, expect);
      let t = this.nodeJt(node);
      if (t === 'Object' || t === 'void') t = this.commonJt([a.t, b.t]);
      if (t === 'void') t = 'Object';
      if (T.isPrim(t) && (a.t === 'null' || b.t === 'null' || T.isBoxed(a.t) || T.isBoxed(b.t))) t = T.box(t);
      return E.cond(c, this.conv(a, t), this.conv(b, t), t);
    }

    x_ObjectExpression(node) { return this.x_ObjectLiteral(node); }

    x_ObjectLiteral(node) {
      const args = [];
      let spreads = [];
      for (const p of node.properties || []) {
        if (p.type === 'ObjectSpread' || p.type === 'SpreadElement') { spreads.push(this.lowerExpr(p.argument)); continue; }
        let key = p.key;
        if (key && typeof key === 'object') key = p.computed ? null : (key.name !== undefined ? key.name : key.value);
        if (p.kind === 'get' || p.kind === 'set') throw new LoweringError('accessor property in an object literal');
        let k;
        if (key === null) k = this.conv(this.lowerExpr(p.key), 'Object');
        else {
          const m = typeof key === 'string' && key.match(/^0[bB][01]+$|^0[oO][0-7]+$|^0[xX][0-9a-fA-F]+$/);
          k = E.str(m ? String(Number(key)) : String(key));
        }
        const v = p.value ? this.lowerExpr(p.value) : E.nul();
        args.push(k, this.conv(v, 'Object'));
      }
      let obj = E.scall('JsObject', 'of', args, 'JsObject');
      if (spreads.length) obj = E.scall('Js', 'assign', [E.nw('JsObject', []), ...spreads.map(s => this.conv(s, 'Object')), obj], 'JsObject');
      return obj;
    }

    x_ArrayExpression(node, expect) { return this.arrayLiteral(node, expect); }
    x_ArrayLiteral(node, expect) { return this.arrayLiteral(node, expect); }

    /** The array class an array literal or creation should produce. */
    arrayTypeFor(node, expect) {
      if (expect && T.isArray(expect)) return expect;
      let t = this.nodeJt(node);
      if (node.arrayType && T.TYPED_ARRAY_CLASS[node.arrayType]) t = T.TYPED_ARRAY_CLASS[node.arrayType];
      if (!T.isArray(t)) {
        const et = node.elementType ? this.jt(node.elementType) : 'Object';
        t = node.elementType && T.ARRAY_OF_IL[ilNorm(node.elementType)] ? T.ARRAY_OF_IL[ilNorm(node.elementType)] : T.arrayOfElem(et === 'void' ? 'Object' : et);
      }
      return t;
    }

    arrayLiteral(node, expect) {
      const t = this.arrayTypeFor(node, expect);
      const elemT = T.elemOf(t);
      const els = node.elements || [];
      const fixed = !!node.arrayType;
      if (els.some(e => e && e.type === 'SpreadElement')) {
        // [...a, x, ...b]: a growable array built in order
        const parts = els.map(e => e && e.type === 'SpreadElement'
          ? { spread: true, e: this.lowerExpr(e.argument) }
          : { spread: false, e: e ? this.conv(this.lowerExpr(e, elemT), elemT) : this.undefinedOf(elemT) });
        return E.scall('Js', 'build', [E.nw(t, []), ...parts.map(p => p.spread ? E.scall('Js', 'spreadOf', [this.conv(p.e, 'Object')], 'Object') : this.conv(p.e, 'Object'))], t);
      }
      // Long numeric tables are parsed from a string (keeps the class file small)
      if (T.isPrimArray(t) && els.length > 48 && els.every(e => e && e.type === 'Literal' && typeof e.value === 'number' && !this.isBig(e))) {
        const text = els.map(e => Object.is(e.value, -0) ? '-0' : String(e.value)).join(',');
        return E.scall(t, fixed ? 'typedParse' : 'parse', [E.str(text)], t);
      }
      const items = els.map(e => e ? this.conv(this.lowerExpr(e, elemT), elemT) : this.undefinedOf(elemT));
      if (T.isPrimArray(t)) return E.scall(t, fixed ? 'typedOf' : 'of', items, t);
      return { k: 'jsarrayOf', items, t };
    }

    x_SpreadElement(node) { throw new LoweringError('spread outside an array literal or call'); }

    x_ArrayCreation(node, expect) {
      let t = expect && T.isArray(expect) ? expect : this.jt(node.resultType || node.contextType);
      if (!T.isArray(t)) t = node.elementType ? T.arrayOfElem(this.jt(node.elementType)) : (expect && T.isArray(expect) ? expect : 'JsArray<Object>');
      if (!node.size) return T.isPrimArray(t) ? E.nw(t, []) : { k: 'jsarrayOf', items: [], t };
      const size = this.lowerExpr(node.size);
      if (size.t === 'String' || size.t === 'Object' && !T.isNumeric(T.unbox(size.t))) return E.scall('Js', 'build', [E.nw(t, []), this.conv(size, 'Object')], t);
      return E.nw(t, [this.conv(size, 'int')]);
    }

    x_TypedArrayCreation(node, expect) {
      let t = T.TYPED_ARRAY_CLASS[node.arrayType] || this.jt(node.resultType);
      if (!T.isArray(t)) t = 'U8Array';
      if (!node.size) return E.scall(t === 'JsArray<BigInteger>' ? 'Js' : t, t === 'JsArray<BigInteger>' ? 'bigTyped' : 'typed', [E.int(0)], t);
      const arg = this.lowerExpr(node.size);
      if (T.isNumeric(T.unbox(arg.t))) {
        if (t === 'JsArray<BigInteger>') return E.scall('Js', 'bigTyped', [this.conv(arg, 'int')], t);
        return E.scall(t, 'typed', [this.conv(arg, 'int')], t);
      }
      // new Uint8Array(array) / (buffer) copies
      if (t === 'JsArray<BigInteger>') return E.scall('Js', 'bigTypedFrom', [this.conv(arg, 'Object')], t);
      return E.scall(t, 'typedFrom', [this.conv(arg, 'Object')], t);
    }

    x_BufferCreation(node) {
      return E.scall('U8Array', 'typed', [this.valueOf(node.size, 'int')], 'U8Array');
    }

    x_ArrayFrom(node, expect) {
      const src = this.lowerExpr(node.iterable || node.value || node.argument || (node.arguments && node.arguments[0]));
      let t = node.arrayType ? T.TYPED_ARRAY_CLASS[node.arrayType] : this.nodeJt(node);
      if (!T.isArray(t)) t = expect && T.isArray(expect) ? expect : (T.isArray(src.t) ? src.t : 'JsArray<Object>');
      if (node.mapFunction) {
        const fn = this.lowerExpr(node.mapFunction);
        const mapped = E.call(E.scall('Js', 'spread', [this.conv(src, 'Object')], 'JsArrayLike'), 'mapToObjects', [this.conv(fn, 'JsFn')], 'JsArray<Object>');
        return this.conv(mapped, t);
      }
      if (T.isNumeric(T.unbox(src.t))) {
        // Array.from({length: n}) is lowered by the IL; a number makes an empty array
        return T.isPrimArray(t) ? E.nw(t, [E.int(0)]) : { k: 'jsarrayOf', items: [], t };
      }
      if (src.t === 'JsObject') {
        // Array.from({ length: n }): n holes
        const len = E.scall('Js', 'toInt', [E.call(src, 'get', [E.str('length')], 'Object')], 'int');
        return T.isPrimArray(t) ? (node.arrayType ? E.scall(t, 'typed', [len], t) : E.nw(t, [len])) : E.nw(t, [len]);
      }
      if (T.isPrimArray(t)) return E.scall(t, node.arrayType ? 'typedFrom' : 'from', [this.conv(src, 'Object')], t);
      return E.scall('JsArray', 'from', [this.conv(src, 'Object')], t);
    }

    x_ArrayOf(node) {
      return this.arrayLiteral({ elements: node.elements || [], resultType: node.resultType, elementType: node.elementType });
    }

    // ------------------------------------------------------------------ operators

    x_BinaryExpression(node, expect) {
      const op = node.operator;
      // (a * b) & mask: 32-bit multiplication (the JavaScript target's Math.imul)
      if (op === '&' && node.left && node.left.type === 'BinaryExpression' && node.left.operator === '*' && node.right && node.right.type === 'Literal' &&
          (node.right.value === 0xFFFFFFFF || node.right.value === 0xFFFF || node.right.value === 0xFF) && !this.isBig(node.left)) {
        const a = this.toInt32(this.lowerExpr(node.left.left)), b = this.toInt32(this.lowerExpr(node.left.right));
        const mul = E.bin('*', a, b, 'int');
        if (node.right.value === 0xFFFFFFFF && Object.prototype.hasOwnProperty.call(node.left, 'bigint')) return this.u32(mul);
        return E.bin('&', mul, E.int(node.right.value === 0xFFFFFFFF ? -1 : node.right.value), 'int');
      }
      // (x) & 0xFFFFFFFF from an inlined OpCodes 32-bit helper: unsigned (>>> 0)
      if (op === '&' && node.right && node.right.type === 'Literal' && node.right.value === 0xFFFFFFFF && node.left && node.left.type === 'BinaryExpression' &&
          Object.prototype.hasOwnProperty.call(node.left, 'bigint') && !this.isBig(node.left)) {
        return this.u32(this.toInt32(this.lowerExpr(node.left)));
      }
      if (op === 'instanceof') return this.instanceOf(this.lowerExpr(node.left), node.right);
      if (op === 'in') {
        const key = this.lowerExpr(node.left), obj = this.lowerExpr(node.right);
        return E.scall('Js', 'hasMember', [this.conv(obj, 'Object'), this.toStr(key)], 'boolean');
      }
      if (op === '&&' || op === '||' || op === '??') return this.x_LogicalExpression(node, expect);
      const big = this.isBig(node.left) || this.isBig(node.right);
      const l = this.lowerExpr(node.left), r = this.lowerExpr(node.right);
      return this.binary(op, l, r, node, big);
    }

    /** A binary operator on lowered operands, with JavaScript semantics. */
    binary(op, l, r, node, big) {
      const resT = node ? this.nodeJt(node) : null;
      const isStr = t => t === 'String';
      if (op === '+' && (isStr(l.t) || isStr(r.t) || (resT === 'String' && !T.isNumeric(T.unbox(l.t)) && !T.isNumeric(T.unbox(r.t))))) {
        return E.bin('+', this.toStr(l), this.toStr(r), 'String');
      }
      if (['==', '===', '!=', '!=='].includes(op)) {
        const strict = op === '===' || op === '!==';
        const eq = strict ? this.strictEquals(l, r) : this.looseEquals(l, r);
        return op.startsWith('!') ? this.not(eq) : eq;
      }
      if (big || l.t === 'BigInteger' || r.t === 'BigInteger') return this.bigBinary(op, l, r, resT);
      const dyn = t => !T.isNumeric(T.unbox(t)) && t !== 'boolean' && t !== 'Boolean';
      if (['<', '<=', '>', '>='].includes(op)) {
        if (isStr(l.t) && isStr(r.t)) return E.bin(op, E.call(l, 'compareTo', [r], 'int'), E.int(0), 'boolean');
        if (dyn(l.t) || dyn(r.t)) return E.scall('Js', { '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge' }[op], [this.conv(l, 'Object'), this.conv(r, 'Object')], 'boolean');
        const w = T.wider(this.num(l).t, this.num(r).t);
        return E.bin(op, this.conv(l, w), this.conv(r, w), 'boolean');
      }
      if (['&', '|', '^'].includes(op)) return E.bin(op, this.toInt32(l), this.toInt32(r), 'int');
      if (op === '<<' || op === '>>') return E.bin(op, this.toInt32(l), this.shiftCount(r), 'int');
      if (op === '>>>') {
        const v = this.toInt32(l);
        if (r.k === 'lit' && r.v === 0) return this.u32(v);
        // the count is taken modulo 32 as in JavaScript (a long shift would take it modulo 64)
        return E.bin('>>>', this.u32(v), this.shiftCount32(r), 'long');
      }
      if (op === '+' && (dyn(l.t) || dyn(r.t))) {
        if (resT === 'String') return E.bin('+', this.toStr(l), this.toStr(r), 'String');
        const sum = E.scall('Js', 'add', [this.conv(l, 'Object'), this.conv(r, 'Object')], 'Object');
        return T.isNumeric(resT) ? this.conv(sum, 'double') : sum;
      }
      if (op === '**') return E.scall('Js', 'pow', [this.conv(l, 'double'), this.conv(r, 'double')], 'double');
      const ln = this.num(l), rn = this.num(r);
      if (op === '/') return E.bin('/', this.conv(ln, 'double'), this.conv(rn, 'double'), 'double');
      let w = T.wider(ln.t, rn.t);
      if (T.isNumeric(resT) && op !== '%') w = T.wider(w, resT);
      if (op === '*' && w === 'int') w = 'long';
      if (op === '%' && w !== 'double') {
        // integer remainder by zero is NaN in JavaScript
        return E.scall('Js', 'rem', [this.conv(ln, w), this.conv(rn, w)], w);
      }
      return E.bin(op, this.conv(ln, w), this.conv(rn, w), w);
    }

    /** A numeric operand (booleans, boxes and dynamic values become numbers). */
    num(e) {
      const u = T.unbox(e.t);
      if (T.isNumeric(u)) return u === e.t ? e : this.conv(e, u);
      if (u === 'boolean') return E.cond(this.conv(e, 'boolean'), E.int(1), E.int(0), 'int');
      return this.conv(e, 'double');
    }

    shiftCount(r) {
      const n = this.toInt32(r);
      return n;
    }

    /** A shift count reduced modulo 32 (for shifts the JVM performs on a long). */
    shiftCount32(r) {
      const n = this.toInt32(r);
      if (n.k === 'lit') return E.int(n.v & 31);
      return E.bin('&', n, E.int(31), 'int');
    }

    /** ToInt32 of a value, as an int. */
    toInt32(e) {
      const u = T.unbox(e.t);
      if (e.k === 'lit' && T.isNumeric(e.t)) return E.int(Number.isFinite(e.v) ? Number(BigInt.asIntN(32, BigInt(Math.trunc(e.v)))) : 0);
      if (u === 'int') return this.conv(e, 'int');
      // ToInt32 of a widened int, or of ToUint32 of an int, is that int
      if (e.k === 'cast' && e.t === 'long' && e.e.t === 'int') return e.e;
      if (e.k === 'bin' && e.op === '&' && e.t === 'long' && e.r.k === 'lit' && e.r.v === 0xFFFFFFFF && e.l.k === 'cast' && e.l.e.t === 'int') return e.l.e;
      if (u === 'long') return E.cast(this.conv(e, 'long'), 'int');
      if (u === 'double') return E.scall('Js', 'toInt32', [this.conv(e, 'double')], 'int');
      if (u === 'boolean') return E.cond(this.conv(e, 'boolean'), E.int(1), E.int(0), 'int');
      if (e.t === 'BigInteger') return E.call(e, 'intValue', [], 'int');
      return E.scall('Js', 'toInt32', [this.conv(e, 'Object')], 'int');
    }

    /** ToUint32 of an int: a long. */
    u32(intExpr) {
      if (intExpr.k === 'lit' && T.isNumeric(intExpr.t)) return E.long(Number(BigInt.asUintN(32, BigInt(Math.trunc(intExpr.v)))));
      // ToUint32 of a narrowed long masks the long itself
      if (intExpr.k === 'cast' && intExpr.t === 'int' && intExpr.e.t === 'long') return E.bin('&', intExpr.e, E.long(0xFFFFFFFF), 'long');
      return E.bin('&', E.cast(intExpr, 'long'), E.long(0xFFFFFFFF), 'long');
    }

    bigBinary(op, l, r, resT) {
      const B = 'BigInteger';
      const big = e => this.conv(e, B);
      if (['<', '<=', '>', '>='].includes(op)) {
        if (l.t === B && r.t === B) return E.bin(op, E.call(l, 'compareTo', [r], 'int'), E.int(0), 'boolean');
        return E.scall('Js', { '<': 'lt', '<=': 'le', '>': 'gt', '>=': 'ge' }[op], [this.conv(l, 'Object'), this.conv(r, 'Object')], 'boolean');
      }
      const methods = { '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide', '%': 'remainder', '&': 'and', '|': 'or', '^': 'xor' };
      let res;
      if (methods[op]) res = E.call(big(l), methods[op], [big(r)], B);
      else if (op === '<<') res = E.call(big(l), 'shiftLeft', [this.conv(r, 'int')], B);
      else if (op === '>>') res = E.call(big(l), 'shiftRight', [this.conv(r, 'int')], B);
      else if (op === '**') res = E.scall('Js', 'pow', [big(l), big(r)], B);
      else if (op === '>>>') throw new LoweringError('>>> on a BigInt');
      else throw new LoweringError('BigInt operator ' + op);
      return res;
    }

    x_LogicalExpression(node, expect) {
      const op = node.operator;
      const l = this.lowerExpr(node.left, expect), r = this.lowerExpr(node.right, expect);
      if ((op === '&&' || op === '||') && (this.nodeJt(node) === 'boolean' || (l.t === 'boolean' && r.t === 'boolean'))) {
        return E.bin(op, this.truthy(l), this.truthy(r), 'boolean');
      }
      // a || b and a && b yield an operand; a ?? b the first that is not null
      let t = this.nodeJt(node);
      if (t === 'Object' || t === 'void' || t === 'boolean') t = this.commonJt([l.t, r.t]);
      if (t === 'void' || t === 'null') t = 'Object';
      const pure = this.isPure(node.left);
      if (op === '??') {
        if (T.isPrim(l.t)) return this.conv(l, t);
        const tt = T.isPrim(t) && T.isPrim(r.t) ? t : t;
        if (pure) return E.cond(E.bin('!=', l, E.nul(), 'boolean'), this.conv(l, tt), this.conv(r, tt), tt);
        return E.scall('Js', 'coalesce', [this.conv(l, T.box(tt)), this.conv(r, T.box(tt))], T.box(tt));
      }
      if (pure) {
        const c = this.truthy(l);
        return op === '||' ? E.cond(c, this.conv(l, t), this.conv(r, t), t) : E.cond(c, this.conv(r, t), this.conv(l, t), t);
      }
      const bt = T.box(t);
      return E.scall('Js', op === '||' ? 'or' : 'and', [this.conv(l, bt), this.conv(r, bt)], bt);
    }

    /** Whether evaluating an IL expression twice is harmless (no side effects, cheap). */
    isPure(node) {
      if (!node) return true;
      switch (node.type) {
        case 'Identifier': case 'Literal': case 'ThisExpression': return true;
        case 'ThisPropertyAccess': return !node.computed || this.isPure(node.property);
        case 'MemberExpression': return this.isPure(node.object) && (!node.computed || this.isPure(node.property));
        case 'ArrayLength': return this.isPure(node.array);
        default: return false;
      }
    }

    x_UnaryExpression(node, expect, stmt) {
      const op = node.operator;
      if (op === '++' || op === '--') return this.updateTarget(this.lowerTarget(node.argument), op, node.prefix !== false, stmt);
      if (op === 'typeof') return E.scall('Js', 'typeOf', [this.conv(this.lowerExpr(node.argument), 'Object')], 'String');
      if (op === 'void') return E.nul();
      if (op === 'delete') return this.x_DeleteExpression(node);
      const a = this.lowerExpr(node.argument);
      if (op === '!') return this.not(this.truthy(a));
      if (op === '~') {
        if (a.t === 'BigInteger') return E.call(a, 'not', [], 'BigInteger');
        return E.un('~', this.toInt32(a), 'int');
      }
      if (op === '-') {
        if (a.t === 'BigInteger') return E.call(a, 'negate', [], 'BigInteger');
        if (a.k === 'lit' && T.isNumeric(a.t)) {
          const v = -a.v;
          if (a.t === 'int' && v > MAX_INT) return E.long(v);
          return E.lit(v, Object.is(v, -0) ? 'double' : a.t);
        }
        const n = this.num(a);
        // -int: the JavaScript value of -(-2^31) does not fit an int
        const t = n.t === 'int' ? (this.nodeJt(node) === 'int' ? 'int' : 'long') : n.t;
        if (n.t === 'int' && t === 'int') return E.un('-', n, 'int');
        return E.un('-', this.conv(n, t === 'int' ? 'long' : t), t === 'int' ? 'long' : t);
      }
      if (op === '+') {
        if (T.isNumeric(T.unbox(a.t))) return this.num(a);
        return this.conv(a, 'double');
      }
      throw new LoweringError('unary ' + op);
    }

    not(b) {
      if (b.k === 'un' && b.op === '!') return b.e;
      return E.un('!', b, 'boolean');
    }

    x_TypeOfExpression(node) { return E.scall('Js', 'typeOf', [this.conv(this.lowerExpr(node.argument), 'Object')], 'String'); }
    x_Typeof(node) { return this.x_TypeOfExpression(node); }

    x_DeleteExpression(node) {
      const arg = node.argument;
      if (arg && arg.type === 'MemberExpression') {
        const obj = this.lowerExpr(arg.object);
        const key = arg.computed ? this.conv(this.lowerExpr(arg.property), 'Object') : E.str(arg.property.name || arg.property.value);
        return E.scall('Js', 'deleteProp', [this.conv(obj, 'Object'), key], 'boolean');
      }
      return E.bool(true);
    }

    x_UpdateExpression(node, expect, stmt) {
      const target = this.lowerTarget(node.argument);
      return this.updateTarget(target, node.operator, node.prefix, stmt);
    }

    x_AssignmentExpression(node, expect, stmt) {
      if (node.left && (node.left.type === 'ArrayExpression' || node.left.type === 'ArrayPattern' || node.left.type === 'ArrayLiteral')) {
        if (!stmt) throw new LoweringError('destructuring assignment as a value');
        const src = this.lowerExpr(node.right);
        const tmp = this.fresh('destructure');
        this.fn.used.add(tmp);
        const body = [S.local(tmp, src.t, src)];
        (node.left.elements || []).forEach((el, i) => {
          if (!el) return;
          const target = this.lowerTarget(el);
          body.push(S.expr(this.assignTarget(target, this.elementGet(E.name(tmp, src.t), E.int(i)), true)));
        });
        return { k: 'stmtExpr', stmt: S.block(body), t: 'void' };
      }
      const target = this.lowerTarget(node.left);
      const op = node.operator;
      if (op === '=') return this.assignTarget(target, this.lowerExpr(node.right, target.t), stmt);
      if (op === '&&=' || op === '||=' || op === '??=') {
        const cur = this.readTarget(target);
        const val = this.lowerExpr(node.right, target.t);
        const cond = op === '??=' ? E.bin('==', cur, E.nul(), 'boolean') : (op === '&&=' ? this.truthy(cur) : this.not(this.truthy(cur)));
        if (!stmt) throw new LoweringError('logical assignment as a value');
        return { k: 'stmtExpr', stmt: S.iff(cond, S.block([S.expr(this.assignTarget(target, val, true))]), null), t: 'void' };
      }
      const binop = op.slice(0, -1);
      const big = this.isBig(node.left) || this.isBig(node.right);
      // Compound: read, operate, write (the target's sub-expressions are evaluated once)
      return this.compound(target, binop, node.right, node, big, stmt);
    }

    // ------------------------------------------------------------------ assignment targets

    /**
     * An assignable place: a local, a static or instance field, an accessor, an
     * array element or a dynamic property. Sub-expressions are hoisted into
     * temporaries only when a compound operation evaluates them twice.
     */
    lowerTarget(node) {
      if (node.type === 'Identifier') {
        const sym = node.__sym;
        if (!sym) throw new LoweringError(`assignment to unresolved '${node.name}'`);
        return { kind: 'var', ref: this.symRef(sym), t: this.symJt(sym) };
      }
      if (node.type === 'ThisPropertyAccess') {
        const name = typeof node.property === 'string' ? node.property : (node.property && (node.property.name || node.property.value));
        if (node.computed && node.property && typeof node.property === 'object') return { kind: 'dyn', obj: this.selfRef(), key: this.lowerExpr(node.property), t: 'Object', node };
        return this.memberTarget(this.selfRef(), name, node);
      }
      if (node.type === 'MemberExpression') {
        const obj = this.lowerExpr(node.object);
        if (node.computed) {
          const key = this.lowerExpr(node.property);
          if (T.isArray(obj.t)) return { kind: 'elem', obj, index: this.indexOf(key), t: T.elemOf(obj.t), node };
          if (obj.t === 'JsObject' || obj.t === 'Object' || !T.isArray(obj.t)) return { kind: 'dyn', obj, key, t: this.nodeJt(node), node };
        }
        const name = node.property && (node.property.name !== undefined ? node.property.name : node.property.value);
        if (name === 'length' && T.isArray(obj.t)) return { kind: 'length', obj, t: 'int' };
        return this.memberTarget(obj, name, node);
      }
      if (node.type === 'ArrayLength') {
        const arr = this.lowerExpr(node.array);
        if (!T.isArray(arr.t)) return this.memberTarget(arr, 'length', node);
        return { kind: 'length', obj: arr, t: 'int' };
      }
      throw new LoweringError('assignment target ' + node.type);
    }

    memberTarget(obj, name, node) {
      if (obj.k === 'classref') {
        const s = this.findStatic(obj.cls, name);
        if (s && s.kind === 'field') return { kind: 'static', owner: s.owner.javaName, name: s.info.javaName, t: this.fieldJt(s.info) };
        throw new LoweringError(`static ${obj.cls}.${name} unknown`);
      }
      const cls = this.classOfJt(obj.t);
      if (cls) {
        const m = this.findMember(cls.name, name);
        if (m && m.kind === 'field') return { kind: 'field', obj, name: m.info.javaName, t: this.fieldJt(m.info) };
        if (m && m.kind === 'accessor') return { kind: 'accessor', obj, name: mid(name), t: this.accessorSetJt(m.info), getT: this.accessorJt(m.info) };
        const sub = this.findMemberInSubclasses(cls.name, name);
        if (sub && sub.member && (sub.member.kind === 'field' || sub.member.kind === 'accessor')) {
          const sc = this.classInfo(sub.cls);
          const down = E.cast(obj, sc.javaName);
          return sub.member.kind === 'field'
            ? { kind: 'field', obj: down, name: sub.member.info.javaName, t: this.fieldJt(sub.member.info) }
            : { kind: 'accessor', obj: down, name: mid(name), t: this.accessorSetJt(sub.member.info), getT: this.accessorJt(sub.member.info) };
        }
      }
      if (obj.t === 'JsObject') return { kind: 'objprop', obj, key: name, t: node ? this.nodeJt(node) : 'Object' };
      return { kind: 'dyn', obj, key: E.str(name), t: node ? this.nodeJt(node) : 'Object' };
    }

    classOfJt(t) {
      for (const c of this.classes.values()) if (c.javaName === t) return c;
      return null;
    }

    readTarget(target) {
      switch (target.kind) {
        case 'var': return target.ref;
        case 'static': return E.sfield(target.owner, target.name, target.t);
        case 'field': return E.field(target.obj, target.name, target.t);
        case 'accessor': return E.call(target.obj, 'get_' + target.name, [], target.getT || target.t);
        case 'elem': return this.elementGet(target.obj, target.index);
        case 'length': return E.call(target.obj, 'length', [], 'int');
        case 'objprop': return this.conv(E.call(target.obj, 'get', [E.str(target.key)], 'Object'), target.t);
        case 'dyn': return this.conv(this.dynGet(target.obj, target.key), target.t);
      }
      throw new LoweringError('read of ' + target.kind);
    }

    dynGet(obj, key) {
      if (key.t === 'String' && key.k === 'lit') return E.scall('Js', 'getProp', [this.conv(obj, 'Object'), key], 'Object');
      return E.scall('Js', 'index', [this.conv(obj, 'Object'), this.conv(key, 'Object')], 'Object');
    }

    /** Store a value; the expression's value is the stored JavaScript value. */
    assignTarget(target, value, stmt) {
      switch (target.kind) {
        case 'var': return E.assign(target.ref, this.conv(value, target.t));
        case 'static': return E.assign(E.sfield(target.owner, target.name, target.t), this.conv(value, target.t));
        case 'field': return E.assign(E.field(target.obj, target.name, target.t), this.conv(value, target.t));
        case 'accessor': {
          const call = E.call(target.obj, 'set_' + target.name, [this.conv(value, target.t)], 'void');
          if (stmt) return call;
          const getT = target.getT || target.t;
          return E.scall('Js', 'seq', [this.conv(call, 'Object'), this.conv(this.readTarget(target), T.box(getT))], T.box(getT));
        }
        case 'elem': return this.elementSet(target.obj, target.index, value);
        case 'length': {
          const call = E.call(target.obj, 'setLength', [this.conv(value, 'int')], 'void');
          return stmt ? call : E.scall('Js', 'seq', [this.conv(call, 'Object'), E.call(target.obj, 'length', [], 'int')], 'Integer');
        }
        case 'objprop': return this.conv(E.call(target.obj, 'put', [E.str(target.key), this.conv(value, 'Object')], 'Object'), target.t === 'Object' ? 'Object' : value.t);
        case 'dyn': {
          const set = target.key.t === 'String' && target.key.k === 'lit'
            ? E.scall('Js', 'setProp', [this.conv(target.obj, 'Object'), target.key, this.conv(value, 'Object')], 'Object')
            : E.scall('Js', 'setIndex', [this.conv(target.obj, 'Object'), this.conv(target.key, 'Object'), this.conv(value, 'Object')], 'Object');
          return stmt ? set : this.conv(set, value.t === 'null' ? 'Object' : value.t);
        }
      }
      throw new LoweringError('assignment to ' + target.kind);
    }

    /** Evaluate a target's object and index once (into temporaries) for read-modify-write. */
    stabilize(target, pre) {
      const stable = e => e.k === 'name' || e.k === 'this' || e.k === 'lit' || e.k === 'classref' || e.k === 'sfield' ||
        (e.k === 'field' && stable(e.obj)) || (e.k === 'cast' && stable(e.e));
      const tmp = (e, base) => {
        if (stable(e)) return e;
        const n = this.fresh(base);
        this.fn.used.add(n);
        pre.push({ name: n, e });
        return E.name(n, e.t);
      };
      const t = Object.assign({}, target);
      if (t.obj) t.obj = tmp(t.obj, 'o');
      if (t.index) t.index = tmp(t.index, 'ix');
      if (t.key && t.kind === 'dyn') t.key = tmp(t.key, 'k');
      return t;
    }

    compound(target, binop, rightNode, node, big, stmt) {
      const pre = [];
      const st = this.stabilize(target, pre);
      const cur = this.readTarget(st);
      const right = this.lowerExpr(rightNode, st.t);
      const result = this.binary(binop, cur, right, { resultType: node.resultType, type: 'BinaryExpression', operator: binop, left: node.left, right: rightNode, __lowered: null }, big);
      const assign = this.assignTarget(st, result, stmt);
      return this.withTemps(pre, assign);
    }

    /** Wrap an expression using temporaries: Js.let-style sequencing. */
    withTemps(pre, e) {
      if (pre.length === 0) return e;
      return { k: 'letin', binds: pre, body: e, t: e.t };
    }

    updateTarget(target, op, prefix, stmt) {
      const t = target.t;
      if (target.kind === 'var' && T.isNumeric(t)) return E.inc(target.ref, op, prefix);
      if ((target.kind === 'static' || target.kind === 'field') && T.isNumeric(t)) {
        const ref = target.kind === 'static' ? E.sfield(target.owner, target.name, t) : E.field(target.obj, target.name, t);
        return E.inc(ref, op, prefix);
      }
      if (target.kind === 'elem' && T.isNumeric(T.elemOf(target.obj.t))) {
        const name = (prefix || stmt ? 'pre' : 'post') + (op === '++' ? 'Inc' : 'Dec');
        return E.call(target.obj, name, [target.index], T.elemOf(target.obj.t));
      }
      // read-modify-write; the value is the old (postfix) or new (prefix) value
      const pre = [];
      const st = this.stabilize(target, pre);
      const cur = this.readTarget(st);
      const n = this.num(cur);
      const one = E.lit(1, n.t);
      const next = E.bin(op === '++' ? '+' : '-', n, one, n.t);
      if (stmt || prefix) return this.withTemps(pre, this.assignTarget(st, next, stmt));
      const old = this.fresh('old');
      this.fn.used.add(old);
      pre.push({ name: old, e: n });
      const assign = this.assignTarget(st, E.bin(op === '++' ? '+' : '-', E.name(old, n.t), one, n.t), true);
      return this.withTemps(pre, E.scall('Js', 'seq', [this.conv(assign, 'Object'), this.conv(E.name(old, n.t), T.box(n.t))], T.box(n.t)));
    }

    // ------------------------------------------------------------------ members

    /** The symbol a namespace (a library's exports) gives for a member, or null. */
    namespaceMember(objNode, name) {
      const sym = objNode && objNode.type === 'Identifier' && objNode.__sym;
      if (!sym || sym.kind !== 'namespace') return null;
      return sym.members.get(name) || null;
    }

    x_MemberExpression(node, expect) {
      if (!node.computed) {
        const target = this.namespaceMember(node.object, node.property && (node.property.name || node.property.value));
        if (target) return this.x_Identifier(Object.assign({ type: 'Identifier', name: target.name }, { __sym: target }));
      }
      if (node.optional) {
        const obj = this.lowerExpr(node.object);
        const key = node.computed ? this.conv(this.lowerExpr(node.property), 'Object') : E.str(node.property.name || node.property.value);
        return this.conv(E.scall('Js', 'optIndex', [this.conv(obj, 'Object'), key], 'Object'), this.dynResultJt(node));
      }
      if (node.object && node.object.type === 'Identifier' && !node.object.__sym) {
        const special = this.globalMember(node.object.name, node.property && (node.property.name || node.property.value), node);
        if (special) return special;
      }
      const obj = this.lowerExpr(node.object);
      if (node.computed) {
        const key = this.lowerExpr(node.property);
        return this.dynamicIndex(obj, key, node);
      }
      const name = node.property && (node.property.name !== undefined ? node.property.name : node.property.value);
      return this.memberGet(obj, name, node);
    }

    /** obj[key] */
    dynamicIndex(obj, key, node) {
      if (T.isArray(obj.t)) return this.elementGet(obj, this.indexOf(key));
      if (obj.t === 'String') return E.scall('Js', 'charAt', [obj, this.conv(key, 'double')], 'String');
      if (obj.t === 'JsObject' && key.t === 'String') return this.conv(E.call(obj, 'get', [key], 'Object'), this.dynResultJt(node));
      return this.conv(this.dynGet(obj, key), this.dynResultJt(node));
    }

    dynResultJt(node) {
      const t = node ? this.nodeJt(node) : 'Object';
      return t === 'void' ? 'Object' : t;
    }

    /** An array index: an int when the IL says integer, else the double (fractions read undefined). */
    indexOf(key) {
      const u = T.unbox(key.t);
      if (u === 'int') return this.conv(key, 'int');
      if (u === 'long') return this.conv(key, 'long');
      if (u === 'double') return this.conv(key, 'double');
      if (key.t === 'String') return E.scall('Js', 'toNum', [key], 'double');
      return E.scall('Js', 'toNum', [this.conv(key, 'Object')], 'double');
    }

    elementGet(arr, index) {
      const t = T.elemOf(arr.t);
      return E.call(arr, 'get', [index], t);
    }

    elementSet(arr, index, value) {
      const et = T.elemOf(arr.t);
      let v;
      // typed-array stores convert like JavaScript (modulo, not saturation)
      const vu = T.unbox(value.t);
      if (et === 'int' && vu === 'double') v = E.scall('Js', 'toInt32', [this.conv(value, 'double')], 'int');
      else if (et === 'long' && vu === 'double' && arr.t === 'U32Array') v = E.scall('Js', 'toUint32', [this.conv(value, 'double')], 'long');
      else if (et === 'int' && vu === 'long') v = E.cast(this.conv(value, 'long'), 'int');
      else v = this.conv(value, et);
      return E.call(arr, 'set', [index, v], et);
    }

    /** obj.name */
    memberGet(obj, name, node) {
      if (obj.k === 'classref') return this.staticGet(obj, name, node);
      if (name === 'length') {
        if (T.isArray(obj.t) || obj.t === 'String') return E.call(obj, 'length', [], 'int');
        if (obj.t === 'JsArrayLike') return E.call(obj, 'length', [], 'int');
      }
      if (obj.t === 'String' && name === 'length') return E.call(obj, 'length', [], 'int');
      if ((obj.t === 'JsMap' || obj.t === 'JsSet') && name === 'size') return E.call(obj, 'size', [], 'int');
      if ((obj.t === 'JsError' || obj.t === 'RuntimeException') && name === 'message') return E.scall('Js', 'message', [obj], 'String');
      if ((obj.t === 'JsError' || obj.t === 'RuntimeException') && name === 'name') return E.scall('Js', 'errorName', [obj], 'String');
      if (obj.t === 'JsRegExp' && ['source', 'flags', 'lastIndex'].includes(name)) return E.field(obj, name, name === 'lastIndex' ? 'int' : 'String');
      const cls = this.classOfJt(obj.t);
      if (cls) {
        const m = this.findMember(cls.name, name);
        if (m && m.kind === 'field') return E.field(obj, m.info.javaName, this.fieldJt(m.info));
        if (m && m.kind === 'accessor') return E.call(obj, 'get_' + mid(name), [], this.accessorJt(m.info));
        if (m && m.kind === 'method') return this.boundMethod(obj, m.info, cls);
        const sub = this.findMemberInSubclasses(cls.name, name);
        if (sub && sub.member) {
          const sc = this.classInfo(sub.cls);
          const down = E.cast(obj, sc.javaName);
          if (sub.member.kind === 'field') return E.field(down, sub.member.info.javaName, this.fieldJt(sub.member.info));
          if (sub.member.kind === 'accessor') return E.call(down, 'get_' + mid(name), [], this.accessorJt(sub.member.info));
          if (sub.member.kind === 'method') return this.boundMethod(down, sub.member.info, sc);
        }
      }
      const t = this.dynResultJt(node);
      if (obj.t === 'JsObject') return this.conv(E.call(obj, 'get', [E.str(name)], 'Object'), t);
      return this.conv(E.scall('Js', 'getProp', [this.conv(obj, 'Object'), E.str(name)], 'Object'), t);
    }

    /** A method read as a value: a JsFn calling it on obj. */
    boundMethod(obj, fi, cls) {
      const sig = fi.framework ? { params: fi.params.map(p => p.t), ret: fi.ret } : this.signature(fi, cls);
      const argsName = this.fresh('a');
      const recv = obj.k === 'this' || obj.k === 'name' ? obj : obj;
      const args = sig.params.map((t, i) => this.conv(E.scall('Js', 'arg', [E.name(argsName, 'Object[]'), E.int(i)], 'Object'), t));
      const call = E.call(recv, fi.javaName, args, sig.ret);
      return E.lambda([{ name: argsName }], sig.ret === 'void' ? [S.expr(call), S.ret(E.nul())] : [S.ret(this.conv(call, 'Object'))]);
    }

    staticGet(obj, name, node) {
      if (obj.cls === 'AlgorithmFramework') {
        if (name === 'Algorithms') return E.sfield('AlgorithmFramework', 'Algorithms', 'JsArray<Algorithm>');
        if (FRAMEWORK[name]) return { k: 'classref', name, t: 'Class', cls: name };
        if (FRAMEWORK_STATICS[name]) return this.functionValueStatic('AlgorithmFramework', name);
      }
      if (ENUM_CONSTANTS[obj.cls] && ENUM_CONSTANTS[obj.cls].includes(name)) return E.sfield(obj.cls, name, obj.cls);
      // A constant the frozen framework enumeration does not have reads undefined
      if (ENUM_CONSTANTS[obj.cls]) return E.nul(obj.cls);
      const s = this.findStatic(obj.cls, name);
      if (s && s.kind === 'field') return E.sfield(s.owner.javaName, s.info.javaName, this.fieldJt(s.info));
      if (s && s.kind === 'method') {
        const fi = s.info;
        const sig = this.signature(fi, s.owner);
        const argsName = this.fresh('a');
        const args = sig.params.map((t, i) => this.conv(E.scall('Js', 'arg', [E.name(argsName, 'Object[]'), E.int(i)], 'Object'), t));
        const call = E.scall(s.owner.javaName, fi.javaName, args, sig.ret);
        return E.lambda([{ name: argsName }], sig.ret === 'void' ? [S.expr(call), S.ret(E.nul())] : [S.ret(this.conv(call, 'Object'))]);
      }
      if (name === 'name' && this.classInfo(obj.cls)) return E.str(obj.cls);
      throw new LoweringError(`static member ${obj.cls}.${name} unknown`);
    }

    /** Members of global objects (Number.MAX_SAFE_INTEGER, Math.PI, ...) the IL left as members. */
    globalMember(objName, prop, node) {
      if (objName === 'Number') {
        const v = { MAX_SAFE_INTEGER: 9007199254740991, MIN_SAFE_INTEGER: -9007199254740991, EPSILON: Number.EPSILON, MAX_VALUE: Number.MAX_VALUE, MIN_VALUE: Number.MIN_VALUE, POSITIVE_INFINITY: Infinity, NEGATIVE_INFINITY: -Infinity, NaN: NaN }[prop];
        if (v !== undefined) return E.dbl(v);
      }
      if (objName === 'Math') {
        const v = { PI: Math.PI, E: Math.E, LN2: Math.LN2, LN10: Math.LN10, LOG2E: Math.LOG2E, LOG10E: Math.LOG10E, SQRT2: Math.SQRT2, SQRT1_2: Math.SQRT1_2 }[prop];
        if (v !== undefined) return E.dbl(v);
      }
      return null;
    }

    // ------------------------------------------------------------------ calls

    x_CallExpression(node, expect, stmt) {
      const callee = node.callee;
      const args = node.arguments || [];
      if (callee.type === 'Identifier') {
        const sym = callee.__sym;
        if (sym && sym.kind === 'func') {
          return this.callFunction(sym.fi, args, null);
        }
        if (sym && sym.kind === 'localfn') return this.callFunction(sym.fi, args, sym.holder);
        if (sym) {
          // a function value
          const fn = this.symRef(sym);
          return this.callFn(fn, args, node);
        }
        return this.globalCall(callee.name, args, node);
      }
      if (callee.type === 'MemberExpression' && !callee.computed && callee.property && (callee.property.name === 'apply' || callee.property.name === 'call') &&
          callee.object && callee.object.type === 'MemberExpression' && !callee.object.computed && callee.object.object &&
          callee.object.object.type === 'Identifier' && !callee.object.object.__sym && ['String', 'Math', 'Array', 'Number', 'Object'].includes(callee.object.object.name)) {
        const rest = callee.property.name === 'apply'
          ? (args[1] ? [{ type: 'SpreadElement', argument: args[1] }] : [])
          : args.slice(1);
        return this.x_CallExpression(Object.assign({}, node, { callee: callee.object, arguments: rest }), expect, stmt);
      }
      if (callee.type === 'MemberExpression' && !callee.computed) {
        const name = callee.property && (callee.property.name !== undefined ? callee.property.name : callee.property.value);
        const o = callee.object;
        if (o.type === 'Identifier' && !o.__sym) {
          const g = this.globalMethodCall(o.name, name, args, node);
          if (g) return g;
        }
        const nsTarget = this.namespaceMember(o, name);
        if (nsTarget) {
          const id = { type: 'Identifier', name: nsTarget.name };
          mark(id, '__sym', nsTarget);
          return this.x_CallExpression(Object.assign({}, node, { callee: id }), expect, stmt);
        }
        if (o.type === 'Super') {
          const base = this.fn.cls && this.classInfo(this.fn.cls.ext);
          if (!base || !this.findMember(base.name, name)) return this.superMissing(name, node);
          return this.methodCall(this.x_Super(), name, args, node, this.fn.cls && this.fn.cls.ext);
        }
        const obj = this.lowerExpr(o);
        return this.methodCall(obj, name, args, node);
      }
      if (callee.type === 'MemberExpression' && callee.computed) {
        const obj = this.lowerExpr(callee.object);
        const key = this.lowerExpr(callee.property);
        return this.conv(E.scall('Js', 'invokeIndex', [this.conv(obj, 'Object'), this.conv(key, 'Object'), ...this.boxArgs(args)], 'Object'), this.callResultJt(node));
      }
      // (function () { ... })() and other callee expressions
      const fn = this.lowerExpr(callee);
      return this.callFn(fn, args, node);
    }

    /** Arguments converted to Object for a dynamic call (spreads expanded at run time). */
    boxArgs(args) {
      if (args.some(a => a && a.type === 'SpreadElement')) return [E.scall('Js', 'spreadArgs', args.map(a => a.type === 'SpreadElement' ? E.scall('Js', 'spreadOf', [this.conv(this.lowerExpr(a.argument), 'Object')], 'Object') : this.conv(this.lowerExpr(a), 'Object')), 'Object[]')];
      return args.map(a => this.conv(this.lowerExpr(a), 'Object'));
    }

    callFn(fn, args, node) {
      const call = E.call(this.conv(fn, 'JsFn'), 'call', this.boxArgs(args), 'Object');
      const t = this.callResultJt(node);
      return t === 'void' ? call : this.conv(call, t);
    }

    callResultJt(node) {
      const t = this.nodeJt(node);
      return t;
    }

    callFunction(fi, args, holder) {
      const sig = holder ? fi.sig : this.signature(fi, null);
      const lowered = this.argsFor(fi, sig, args);
      if (holder && this.insideHolder(holder)) return E.call(null, fi.javaName, lowered, sig.ret);
      if (holder) return E.call(E.name(holder, 'Object'), fi.javaName, lowered, sig.ret);
      return E.scall(this.unitName, fi.javaName, lowered, sig.ret);
    }

    /** Arguments for a typed function or method: converted, missing ones filled. */
    argsFor(fi, sig, args) {
      const out = [];
      const n = sig.params.length;
      const hasRest = fi.params.length && fi.params[fi.params.length - 1].rest;
      if (args.some(a => a && a.type === 'SpreadElement')) {
        if (hasRest && args.length === n && args[n - 1].type === 'SpreadElement') {
          for (let i = 0; i < n - 1; ++i) out.push(this.valueOf(args[i], sig.params[i]));
          out.push(E.scall('JsArray', 'from', [this.conv(this.lowerExpr(args[n - 1].argument), 'Object')], 'JsArray<Object>'));
          return out;
        }
        throw new LoweringError('spread arguments to a typed function');
      }
      for (let i = 0; i < n; ++i) {
        if (hasRest && i === n - 1) {
          out.push({ k: 'jsarrayOf', items: args.slice(i).map(a => this.conv(this.lowerExpr(a), 'Object')), t: 'JsArray<Object>' });
          return out;
        }
        if (i < args.length) out.push(this.valueOf(args[i], sig.params[i]));
        else if (i < fi.min) out.push(this.undefinedOf(sig.params[i]));
        else break; // an overload covers the defaults
      }
      return out;
    }

    /** obj.name(args) */
    methodCall(obj, name, args, node, superClass) {
      if (obj.k === 'classref') return this.staticCall(obj, name, args, node);
      const t = obj.t;
      if (T.isArray(t)) return this.arrayMethod(obj, name, args, node);
      if (t === 'String') return this.stringMethod(obj, name, args, node);
      if (t === 'JsFn' && (name === 'call' || name === 'apply')) {
        const rest = name === 'call' ? args.slice(1) : null;
        if (rest) return this.callFn(obj, rest, node);
        return this.conv(E.call(obj, 'call', [E.scall('Js', 'argsOf', [this.conv(this.lowerExpr(args[1]), 'Object')], 'Object[]')], 'Object'), this.callResultJt(node));
      }
      if (t === 'BigInteger' || T.isNumeric(T.unbox(t))) return this.numberMethod(obj, name, args, node);
      if (t === 'JsMap' || t === 'JsSet') return this.collectionMethod(obj, name, args, node);
      if (t === 'JsRegExp') {
        if (name === 'test') return E.call(obj, 'test', [this.valueOf(args[0], 'String')], 'boolean');
        if (name === 'exec') return E.call(obj, 'match', [this.valueOf(args[0], 'String')], 'JsArray<String>');
      }
      const cls = superClass ? this.classInfo(superClass) : this.classOfJt(t);
      if (cls) {
        const m = this.findMember(cls.name, name);
        if (m && m.kind === 'method') return this.invokeMethod(obj, m.info, m.owner, args);
        if (m && (m.kind === 'field' || m.kind === 'accessor')) {
          const fnv = this.memberGet(obj, name, null);
          return this.callFn(fnv, args, node);
        }
        const sub = this.findMemberInSubclasses(cls.name, name);
        if (sub && sub.member && sub.member.kind === 'method') {
          const sc = this.classInfo(sub.cls);
          return this.invokeMethod(E.cast(obj, sc.javaName), sub.member.info, sub.member.owner, args);
        }
        if (name === 'toString' && args.length === 0) return E.scall('Js', 'str', [this.conv(obj, 'Object')], 'String');
      }
      if (name === 'hasOwnProperty' && args.length === 1) return E.scall('Js', 'hasOwn', [this.conv(obj, 'Object'), this.conv(this.lowerExpr(args[0]), 'Object')], 'boolean');
      if (name === 'toString' && args.length === 0 && !this.classOfJt(t)) return E.scall('Js', 'str', [this.conv(obj, 'Object')], 'String');
      // dynamic dispatch
      const call = E.scall('Js', 'invoke', [this.conv(obj, 'Object'), E.str(name), ...this.boxArgs(args)], 'Object');
      const rt = this.callResultJt(node);
      return rt === 'void' ? call : this.conv(call, rt);
    }

    invokeMethod(obj, fi, owner, args) {
      if (fi.framework) {
        const ptypes = fi.params.map(p => p.t);
        const out = [];
        for (let i = 0; i < ptypes.length; ++i) {
          if (i < args.length) out.push(this.valueOf(args[i], ptypes[i]));
          else if (i < fi.min) out.push(this.undefinedOf(ptypes[i]));
          else break;
        }
        return E.call(obj, fi.javaName, out, fi.ret);
      }
      const sig = this.signature(fi, owner);
      return E.call(obj, fi.javaName, this.argsFor(fi, sig, args), sig.ret);
    }

    staticCall(obj, name, args, node) {
      if (obj.cls === 'AlgorithmFramework' && FRAMEWORK_STATICS[name]) {
        const [ptypes, ret] = FRAMEWORK_STATICS[name];
        return E.scall('AlgorithmFramework', name, ptypes.map((t, i) => i < args.length ? this.valueOf(args[i], t) : this.undefinedOf(t)), ret);
      }
      if (obj.cls === 'OpCodes') return this.opCodesCall(name, args, node);
      const s = this.findStatic(obj.cls, name);
      if (s && s.kind === 'method') {
        const sig = this.signature(s.info, s.owner);
        return E.scall(s.owner.javaName, s.info.javaName, this.argsFor(s.info, sig, args), sig.ret);
      }
      if (s && s.kind === 'field') return this.callFn(E.sfield(s.owner.javaName, s.info.javaName, this.fieldJt(s.info)), args, node);
      throw new LoweringError(`static call ${obj.cls}.${name} unknown`);
    }

    // ------------------------------------------------------------------ builtins

    globalCall(name, args, node) {
      const a = i => this.lowerExpr(args[i]);
      switch (name) {
        case 'RegisterAlgorithm': case 'Find': case 'Clear': case 'SpongePadBlocks': case 'MerkleDamgardBlocks':
          return this.staticCall({ k: 'classref', cls: 'AlgorithmFramework' }, name, args, node);
        case 'Number': {
          if (!args.length) return E.int(0);
          const v = a(0);
          if (v.t === 'BigInteger') return E.call(v, 'doubleValue', [], 'double');
          if (T.isNumeric(T.unbox(v.t))) return this.num(v);
          return this.conv(v, 'double');
        }
        case 'String': return args.length ? this.toStr(a(0)) : E.str('');
        case 'Boolean': return args.length ? this.truthy(a(0)) : E.bool(false);
        case 'BigInt': return this.toBigInt(a(0));
        case 'parseInt': return E.scall('Js', 'parseInt', [this.conv(a(0), 'Object'), args[1] ? this.valueOf(args[1], 'double') : E.dbl(0)], 'double');
        case 'parseFloat': return E.scall('Js', 'parseFloat', [this.conv(a(0), 'Object')], 'double');
        case 'isNaN': return E.scall('Double', 'isNaN', [this.valueOf(args[0], 'double')], 'boolean');
        case 'isFinite': return E.scall('Js', 'isFinite', [this.conv(a(0), 'Object')], 'boolean');
        case 'Array': return args.length === 1 ? E.nw(this.arrayTypeFor(node, null), [this.valueOf(args[0], 'int')]) : this.arrayLiteral({ elements: args, resultType: node.resultType });
        case 'require': throw new LoweringError('require() at run time');
        case 'Error': case 'TypeError': case 'RangeError': return E.scall('Js', 'error', [E.str(name), args.length ? this.conv(a(0), 'Object') : E.nul()], 'JsError');
      }
      const call = E.scall('Js', 'callGlobal', [E.str(name), ...this.boxArgs(args)], 'Object');
      const rt = this.callResultJt(node);
      return rt === 'void' ? call : this.conv(call, rt);
    }

    globalMethodCall(objName, name, args, node) {
      const a = i => this.lowerExpr(args[i]);
      if (objName === 'Math') {
        const d = i => this.valueOf(args[i], 'double');
        switch (name) {
          case 'floor': case 'ceil': case 'sqrt': case 'abs': case 'sin': case 'cos': case 'tan': case 'exp': case 'log': case 'log10': case 'atan': case 'asin': case 'acos': case 'sinh': case 'cosh': case 'tanh': case 'cbrt':
            return E.scall('Math', name, [d(0)], 'double');
          case 'log2': return E.scall('Js', 'log2', [d(0)], 'double');
          case 'trunc': case 'round': case 'sign': case 'fround': return E.scall('Js', name, [d(0)], 'double');
          case 'pow': return E.scall('Js', 'pow', [d(0), d(1)], 'double');
          case 'atan2': return E.scall('Math', 'atan2', [d(0), d(1)], 'double');
          case 'random': return E.scall('Js', 'random', [], 'double');
          case 'imul': return E.scall('Js', 'imul', [d(0), d(1)], 'int');
          case 'clz32': return E.scall('Js', 'clz32', [d(0)], 'int');
          case 'min': case 'max': return this.minMax(name, args, node);
          case 'hypot': return E.scall('Js', 'hypot', args.map((x, i) => d(i)), 'double');
        }
      }
      if (objName === 'Number') {
        switch (name) {
          case 'isInteger': return E.scall('Js', 'isInteger', [this.conv(a(0), 'Object')], 'boolean');
          case 'isSafeInteger': return E.scall('Js', 'isSafeInteger', [this.valueOf(args[0], 'double')], 'boolean');
          case 'isFinite': return E.scall('Js', 'isFinite', [this.conv(a(0), 'Object')], 'boolean');
          case 'isNaN': return E.scall('Js', 'isNaN', [this.conv(a(0), 'Object')], 'boolean');
          case 'parseInt': return this.globalCall('parseInt', args, node);
          case 'parseFloat': return this.globalCall('parseFloat', args, node);
        }
      }
      if (objName === 'String') {
        if (name === 'fromCharCode') return this.fromCharCodes(args);
        if (name === 'fromCodePoint') return E.scall('Js', 'fromCodePoint', args.map((x, i) => this.valueOf(args[i], 'double')), 'String');
      }
      if (objName === 'Array') {
        if (name === 'isArray') return E.scall('Js', 'isArray', [this.conv(a(0), 'Object')], 'boolean');
        if (name === 'from') return this.x_ArrayFrom({ iterable: args[0], mapFunction: args[1], resultType: node.resultType });
        if (name === 'of') return this.arrayLiteral({ elements: args, resultType: node.resultType });
      }
      if (objName === 'Object') {
        switch (name) {
          case 'freeze': case 'seal': case 'preventExtensions': return a(0);
          case 'keys': return E.scall('Js', 'keys', [this.conv(a(0), 'Object')], 'JsArray<String>');
          case 'values': return E.scall('Js', 'values', [this.conv(a(0), 'Object')], 'JsArray<Object>');
          case 'entries': return E.scall('Js', 'entries', [this.conv(a(0), 'Object')], 'JsArray<Object>');
          case 'assign': return E.scall('Js', 'assign', args.map((x, i) => this.conv(a(i), 'Object')), 'JsObject');
        }
      }
      if (objName === 'BigInt') {
        if (name === 'asUintN') return E.scall('Js', 'asUintN', [this.valueOf(args[0], 'int'), this.toBigInt(a(1))], 'BigInteger');
        if (name === 'asIntN') return E.scall('Js', 'asIntN', [this.valueOf(args[0], 'int'), this.toBigInt(a(1))], 'BigInteger');
      }
      if (objName === 'console') return E.scall('Js', 'log', this.boxArgs(args), 'void');
      if (objName === 'JSON') {
        if (name === 'stringify') return E.scall('Js', 'stringify', [this.conv(a(0), 'Object')], 'String');
      }
      if (objName === 'Date' && name === 'now') return E.scall('Js', 'now', [], 'long');
      if (objName === 'performance' && name === 'now') return E.scall('Js', 'nowMs', [], 'double');
      if (objName === 'ArrayBuffer' && name === 'isView') return E.scall('Js', 'isTypedAny', [this.conv(a(0), 'Object')], 'boolean');
      if (objName === 'AlgorithmFramework' || objName === 'OpCodes') return null;
      return null;
    }

    minMax(name, args, node) {
      if (args.length === 1 && args[0].type === 'SpreadElement') {
        const arr = this.lowerExpr(args[0].argument);
        return this.conv(E.scall('Js', name + 'Of', [this.conv(arr, 'Object')], 'double'), this.minMaxType(node, ['double']));
      }
      const vals = args.map(x => this.lowerExpr(x));
      const t = this.minMaxType(node, vals.map(v => T.unbox(v.t)));
      if (t === 'BigInteger') throw new LoweringError('Math.min/max of BigInt');
      if (vals.length === 2 && T.isIntegral(t)) return E.scall('Math', name, vals.map(v => this.conv(v, t)), t);
      return this.conv(E.scall('Js', name, vals.map(v => this.conv(v, 'double')), 'double'), t);
    }

    minMaxType(node, types) {
      const nt = this.nodeJt(node);
      if (types.every(t => T.isIntegral(t))) return types.reduce(T.wider, 'int');
      return T.isNumeric(nt) && types.every(t => T.isNumeric(t) && T.rank(t) <= T.rank(nt)) ? nt : 'double';
    }

    fromCharCodes(args) {
      if (args.length === 1 && args[0].type === 'SpreadElement') return E.scall('Js', 'fromCharCodes', [this.conv(this.lowerExpr(args[0].argument), 'Object')], 'String');
      if (args.some(a => a.type === 'SpreadElement')) return E.scall('Js', 'fromCharCodes', [E.scall('Js', 'spreadArgs', args.map(a => a.type === 'SpreadElement' ? E.scall('Js', 'spreadOf', [this.conv(this.lowerExpr(a.argument), 'Object')], 'Object') : this.conv(this.lowerExpr(a), 'Object')), 'Object[]')], 'String');
      return E.scall('Js', 'fromCharCode', args.map(a => this.valueOf(a, 'double')), 'String');
    }

    numberMethod(obj, name, args, node) {
      if (name === 'toString') {
        if (!args.length) return this.toStr(obj);
        return E.scall('Js', 'toRadix', [obj.t === 'BigInteger' ? obj : this.conv(obj, T.unbox(obj.t) === 'int' ? 'int' : T.unbox(obj.t)), this.valueOf(args[0], 'int')], 'String');
      }
      if (name === 'toFixed') return E.scall('Js', 'toFixed', [this.conv(obj, 'double'), args.length ? this.valueOf(args[0], 'int') : E.int(0)], 'String');
      if (name === 'valueOf') return obj;
      throw new LoweringError(`number method ${name}`);
    }

    collectionMethod(obj, name, args, node) {
      const a = i => this.conv(this.lowerExpr(args[i]), 'Object');
      const rt = this.callResultJt(node);
      switch (name) {
        case 'get': return this.conv(E.call(obj, 'get', [a(0)], 'Object'), rt);
        case 'set': return E.call(obj, 'set', [a(0), a(1)], obj.t);
        case 'has': return E.call(obj, 'has', [a(0)], 'boolean');
        case 'delete': return E.call(obj, 'delete', [a(0)], 'boolean');
        case 'add': return E.call(obj, 'add', [a(0)], obj.t);
        case 'clear': return E.call(obj, 'clear', [], 'void');
        case 'keys': return E.call(obj, 'keys', [], 'JsArray<Object>');
        case 'values': return E.call(obj, 'values', [], 'JsArray<Object>');
        case 'entries': return E.call(obj, 'entries', [], 'JsArray<Object>');
        case 'forEach': return E.call(obj, 'forEach', [this.valueOf(args[0], 'JsFn')], 'void');
      }
      throw new LoweringError(`${obj.t}.${name}`);
    }

    // ------------------------------------------------------------------ arrays (IL nodes and methods)

    arrayMethod(arr, name, args, node) {
      const et = T.elemOf(arr.t);
      const a = (i, t) => this.valueOf(args[i], t);
      const rt = this.callResultJt(node);
      switch (name) {
        case 'push': return this.push(arr, args);
        case 'pop': return E.call(arr, 'pop', [], et);
        case 'shift': return E.call(arr, 'shift', [], et);
        case 'unshift': return args.length === 1 && args[0].type !== 'SpreadElement' ? E.call(arr, 'unshift', [this.elemValue(arr, this.lowerExpr(args[0]))], 'int') : E.call(arr, 'unshiftAll', [this.spreadArray(arr, args)], 'int');
        case 'slice': return E.call(arr, 'slice', args.map((x, i) => a(i, 'double')), arr.t);
        case 'subarray': return E.call(arr, 'subarray', args.map((x, i) => a(i, 'double')), arr.t);
        case 'concat': return E.call(arr, 'concat', args.map(x => this.conv(this.lowerExpr(x), 'Object')), arr.t);
        case 'splice': return this.splice(arr, args[0], args[1], args.slice(2));
        case 'indexOf': return E.call(arr, 'indexOf', [this.elemValue(arr, this.lowerExpr(args[0])), ...(args[1] ? [a(1, 'double')] : [])], 'int');
        case 'lastIndexOf': return E.call(arr, 'lastIndexOf', [this.elemValue(arr, this.lowerExpr(args[0]))], 'int');
        case 'includes': return E.call(arr, 'includes', [this.elemValue(arr, this.lowerExpr(args[0]))], 'boolean');
        case 'fill': return E.call(arr, 'fill', [this.elemValue(arr, this.lowerExpr(args[0])), ...args.slice(1).map((x, i) => a(i + 1, 'double'))], arr.t);
        case 'reverse': return E.call(arr, 'reverse', [], arr.t);
        case 'sort': return E.call(arr, 'sort', args.length ? [a(0, 'JsFn')] : [], arr.t);
        case 'join': return E.call(arr, 'join', args.length ? [this.toStr(this.lowerExpr(args[0]))] : [], 'String');
        case 'toString': return E.call(arr, 'join', [], 'String');
        case 'set': return E.call(arr, 'set', [this.conv(this.lowerExpr(args[0]), 'Object'), ...(args[1] ? [a(1, 'double')] : [])], 'void');
        case 'map': return this.conv(E.call(arr, 'mapToObjects', [a(0, 'JsFn')], 'JsArray<Object>'), T.isArray(rt) ? rt : arr.t);
        case 'filter': return E.call(arr, 'filter', [a(0, 'JsFn')], arr.t);
        case 'forEach': return E.call(arr, 'forEach', [a(0, 'JsFn')], 'void');
        case 'some': case 'every': return E.call(arr, name, [a(0, 'JsFn')], 'boolean');
        case 'find': return this.conv(E.call(arr, 'find', [a(0, 'JsFn')], 'Object'), rt === 'void' ? 'Object' : rt);
        case 'findIndex': return E.call(arr, 'findIndex', [a(0, 'JsFn')], 'int');
        case 'reduce': return this.conv(E.call(arr, 'reduce', args.length > 1 ? [a(0, 'JsFn'), this.conv(this.lowerExpr(args[1]), 'Object')] : [a(0, 'JsFn')], 'Object'), rt === 'void' ? 'Object' : rt);
        case 'copyWithin': return E.call(arr, 'copyWithin', args.map((x, i) => a(i, 'double')), arr.t);
        case 'at': return E.call(arr, 'get', [E.scall('Js', 'atIndex', [a(0, 'double'), E.call(arr, 'length', [], 'int')], 'int')], et);
        case 'keys': return E.scall('Js', 'indexKeysAsNumbers', [arr], 'JsArray<Object>');
      }
      return this.dynamicCall(arr, name, args, node);
    }

    /** A value converted to an array's element type (typed-array store semantics). */
    elemValue(arr, value) {
      const et = T.elemOf(arr.t);
      const vu = T.unbox(value.t);
      if (et === 'int' && vu === 'double') return E.scall('Js', 'toInt32', [this.conv(value, 'double')], 'int');
      if (et === 'int' && vu === 'long') return E.cast(this.conv(value, 'long'), 'int');
      return this.conv(value, et);
    }

    push(arr, args) {
      const vals = args.length ? args : [];
      if (vals.length === 1 && vals[0].type === 'SpreadElement') return E.call(arr, 'pushAll', [this.conv(this.spreadSource(vals[0].argument), 'Object')], 'int');
      if (vals.some(v => v.type === 'SpreadElement')) return E.call(arr, 'pushAll', [this.spreadArray(arr, vals)], 'int');
      if (vals.length === 0) return E.call(arr, 'length', [], 'int');
      if (vals.length <= 4 || T.isJsArray(arr.t)) return E.call(arr, 'push', vals.map(v => this.elemValue(arr, this.lowerExpr(v, T.elemOf(arr.t)))), 'int');
      return E.call(arr, 'pushAll', [E.scall(arr.t, 'of', vals.map(v => this.elemValue(arr, this.lowerExpr(v))), arr.t)], 'int');
    }

    spreadSource(node) {
      const e = this.lowerExpr(node);
      if (e.t === 'String' || e.t === 'JsSet' || e.t === 'JsMap') return E.scall('Js', 'spread', [this.conv(e, 'Object')], 'JsArrayLike');
      return e;
    }

    /** Elements and spreads as one array of the target's class. */
    spreadArray(arr, vals) {
      const items = vals.map(v => v.type === 'SpreadElement' ? E.scall('Js', 'spreadOf', [this.conv(this.lowerExpr(v.argument), 'Object')], 'Object') : this.conv(this.elemValue(arr, this.lowerExpr(v)), 'Object'));
      return E.scall('Js', 'build', [E.nw(arr.t, []), ...items], arr.t);
    }

    splice(arr, start, del, items) {
      const args = [this.valueOf(start, 'double')];
      if (del) args.push(this.valueOf(del, 'double'));
      else if (items.length) args.push(E.dbl(0));
      if (items.some(it => it.type === 'SpreadElement')) {
        // spread items: one array passed as the varargs
        const parts = items.map(it => it.type === 'SpreadElement' ? E.scall('Js', 'spreadOf', [this.conv(this.lowerExpr(it.argument), 'Object')], 'Object') : this.conv(this.elemValue(arr, this.lowerExpr(it)), 'Object'));
        args.push(Object.assign(E.scall('Js', 'spreadArgs', parts, 'Object[]'), { varargsArray: true }));
      } else for (const it of items) args.push(this.conv(this.elemValue(arr, this.lowerExpr(it)), 'Object'));
      return E.call(arr, 'splice', args, arr.t);
    }

    arrayOf(node, key = 'array') { return this.lowerExpr(node[key]); }

    /** An IL array node whose receiver is not an array here (an untyped value): the method by name at run time. */
    nonArray(arr, method, args, node) {
      return this.dynamicCall(arr, method, args.filter(a => a !== undefined && a !== null), node);
    }

    x_ArrayLength(node) {
      const arr = this.lowerExpr(node.array);
      if (T.isArray(arr.t) || arr.t === 'String' || arr.t === 'JsArrayLike') return E.call(arr, 'length', [], 'int');
      return E.scall('Js', 'length', [this.conv(arr, 'Object')], 'int');
    }
    x_StringLength(node) { return E.call(this.valueOf(node.string || node.value, 'String'), 'length', [], 'int'); }

    x_ArrayAppend(node) {
      const arr = this.arrayOf(node);
      const vals = node.values && node.values.length ? node.values : [node.value];
      if (!T.isArray(arr.t)) return E.scall('Js', 'invoke', [this.conv(arr, 'Object'), E.str('push'), ...this.boxArgs(vals)], 'Object');
      return this.push(arr, vals);
    }
    x_ArrayPop(node) { const arr = this.arrayOf(node); if (!T.isArray(arr.t)) return this.nonArray(arr, 'pop', [], node); return this.arrayMethod(arr, 'pop', [], node); }
    x_ArrayShift(node) { const arr = this.arrayOf(node); if (!T.isArray(arr.t)) return this.nonArray(arr, 'shift', [], node); return this.arrayMethod(arr, 'shift', [], node); }
    x_ArrayUnshift(node) { const arr = this.arrayOf(node); return this.arrayMethod(arr, 'unshift', node.values || (node.value ? [node.value] : []), node); }
    x_ArraySlice(node) {
      const arr = this.arrayOf(node);
      const args = [];
      if (node.start) args.push(this.valueOf(node.start, 'double'));
      if (node.end) { if (!node.start) args.push(E.dbl(0)); args.push(this.valueOf(node.end, 'double')); }
      if (arr.t === 'String') return E.scall('Js', 'slice', [arr, ...(args.length ? args : [E.dbl(0)])], 'String');
      if (!T.isArray(arr.t)) return this.conv(E.scall('Js', 'invoke', [this.conv(arr, 'Object'), E.str('slice'), ...args.map(x => this.conv(x, 'Object'))], 'Object'), this.nodeJt(node));
      return E.call(arr, 'slice', args, arr.t);
    }
    x_TypedArraySubarray(node) {
      const arr = this.arrayOf(node);
      if (!T.isArray(arr.t)) return this.nonArray(arr, 'subarray', [node.begin, node.end], node);
      const args = [];
      if (node.begin) args.push(this.valueOf(node.begin, 'double'));
      if (node.end) { if (!node.begin) args.push(E.dbl(0)); args.push(this.valueOf(node.end, 'double')); }
      return E.call(arr, 'subarray', args, arr.t);
    }
    x_TypedArraySet(node) {
      const arr = this.arrayOf(node);
      if (!T.isArray(arr.t)) return this.nonArray(arr, 'set', [node.source, node.offset], node);
      return E.call(arr, 'set', [this.conv(this.lowerExpr(node.source), 'Object'), ...(node.offset ? [this.valueOf(node.offset, 'double')] : [])], 'void');
    }
    x_ArrayConcat(node) {
      const arr = this.arrayOf(node);
      const others = (node.arrays || []).map(a => {
        const v = a.type === 'SpreadElement' ? this.lowerExpr(a.argument) : this.lowerExpr(a);
        return this.conv(T.isArray(arr.t) && T.isArray(v.t) && v.t !== arr.t ? this.conv(v, arr.t) : v, 'Object');
      });
      if (arr.t === 'String') return E.scall('Js', 'concat', [arr, ...others], 'String');
      if (!T.isArray(arr.t)) return this.conv(E.scall('Js', 'invoke', [this.conv(arr, 'Object'), E.str('concat'), ...others], 'Object'), this.nodeJt(node));
      return E.call(arr, 'concat', others, arr.t);
    }
    x_ArrayReverse(node) { const arr = this.arrayOf(node); if (!T.isArray(arr.t)) return this.nonArray(arr, 'reverse', [], node); return E.call(arr, 'reverse', [], arr.t); }
    x_ArrayFill(node) {
      const arr = this.arrayOf(node);
      if (!T.isArray(arr.t)) return this.nonArray(arr, 'fill', [node.value, node.start, node.end], node);
      const args = [this.elemValue(arr, this.lowerExpr(node.value, T.elemOf(arr.t)))];
      if (node.start !== undefined && node.start !== null) args.push(this.valueOf(node.start, 'double'));
      if (node.end !== undefined && node.end !== null) args.push(this.valueOf(node.end, 'double'));
      return E.call(arr, 'fill', args, arr.t);
    }
    x_ArrayClear(node) { return E.scall('OpCodes', 'ClearArray', [this.conv(this.lowerExpr(node.array || (node.arguments && node.arguments[0])), 'Object')], 'void'); }
    x_ArrayIndexOf(node) {
      const arr = this.arrayOf(node);
      if (arr.t === 'String') return E.scall('Js', 'indexOf', [arr, this.toStr(this.lowerExpr(node.value)), ...(node.fromIndex ? [this.valueOf(node.fromIndex, 'double')] : [])], 'int');
      if (!T.isArray(arr.t)) return E.scall('Js', 'indexOfDyn', [this.conv(arr, 'Object'), this.conv(this.lowerExpr(node.value), 'Object')], 'int');
      return E.call(arr, 'indexOf', [this.elemValue(arr, this.lowerExpr(node.value)), ...(node.fromIndex ? [this.valueOf(node.fromIndex, 'double')] : [])], 'int');
    }
    x_ArrayLastIndexOf(node) { const arr = this.arrayOf(node); return E.call(arr, 'lastIndexOf', [this.elemValue(arr, this.lowerExpr(node.value))], 'int'); }
    x_ArrayIncludes(node) {
      const arr = this.arrayOf(node);
      if (arr.t === 'String') return E.call(arr, 'contains', [this.toStr(this.lowerExpr(node.value))], 'boolean');
      if (!T.isArray(arr.t)) return E.scall('Js', 'includesDyn', [this.conv(arr, 'Object'), this.conv(this.lowerExpr(node.value), 'Object')], 'boolean');
      const v = this.lowerExpr(node.value);
      if (T.isPrimArray(arr.t) && !T.isNumeric(T.unbox(v.t)) && v.t !== 'boolean') return E.bin('>=', E.call(arr, 'indexOfBoxed', [this.conv(v, 'Object')], 'int'), E.int(0), 'boolean');
      return E.call(arr, 'includes', [this.elemValue(arr, v)], 'boolean');
    }
    x_ArraySplice(node) { const arr = this.arrayOf(node); if (!T.isArray(arr.t)) return this.nonArray(arr, 'splice', [node.start, node.deleteCount, ...(node.items || [])], node); return this.splice(arr, node.start, node.deleteCount, node.items || []); }
    x_ArrayJoin(node) { const arr = this.arrayOf(node); return E.call(this.conv(arr, T.isArray(arr.t) ? arr.t : 'JsArrayLike'), 'join', node.separator ? [this.toStr(this.lowerExpr(node.separator))] : [], 'String'); }
    x_ArraySort(node) { const arr = this.arrayOf(node); if (!T.isArray(arr.t)) return this.nonArray(arr, 'sort', [node.compareFn], node); return E.call(arr, 'sort', node.compareFn ? [this.valueOf(node.compareFn, 'JsFn')] : [], arr.t); }
    x_ArrayMap(node) { const arr = this.arrayOf(node); return this.arrayMethod(arr, 'map', [node.callback], node); }
    x_ArrayForEach(node) { const arr = this.arrayOf(node); return this.arrayMethod(arr, 'forEach', [node.callback], node); }
    x_ArrayFilter(node) { const arr = this.arrayOf(node); return this.arrayMethod(arr, 'filter', [node.callback], node); }
    x_ArraySome(node) { const arr = this.arrayOf(node); return this.arrayMethod(arr, 'some', [node.callback], node); }
    x_ArrayEvery(node) { const arr = this.arrayOf(node); return this.arrayMethod(arr, 'every', [node.callback], node); }
    x_ArrayFind(node) { const arr = this.arrayOf(node); return this.arrayMethod(arr, 'find', [node.callback], node); }
    x_ArrayFindIndex(node) { const arr = this.arrayOf(node); return this.arrayMethod(arr, 'findIndex', [node.callback], node); }
    x_ArrayReduce(node) { const arr = this.arrayOf(node); return this.arrayMethod(arr, 'reduce', node.initialValue ? [node.callback, node.initialValue] : [node.callback], node); }
    x_ArrayXor(node) {
      return E.scall('OpCodes', 'XorArrays', [this.conv(this.lowerExpr(node.array1 || node.arguments[0]), 'Object'), this.conv(this.lowerExpr(node.array2 || node.arguments[1]), 'Object')], 'U8Array');
    }
    x_IsArrayCheck(node) { return E.scall('Js', 'isArray', [this.conv(this.lowerExpr(node.value || node.argument || node.arguments[0]), 'Object')], 'boolean'); }

    // ------------------------------------------------------------------ strings

    stringMethod(s, name, args, node) {
      const a = (i, t) => this.valueOf(args[i], t);
      const sv = (i) => this.toStr(this.lowerExpr(args[i]));
      switch (name) {
        case 'charCodeAt': return this.charCodeAt(s, args[0] ? a(0, 'double') : E.dbl(0), node);
        case 'charAt': return E.scall('Js', 'charAt', [s, args[0] ? a(0, 'double') : E.dbl(0)], 'String');
        case 'codePointAt': return E.scall('Js', 'codePointAt', [s, a(0, 'long')], 'int');
        case 'indexOf': return E.scall('Js', 'indexOf', [s, sv(0), ...(args[1] ? [a(1, 'double')] : [])], 'int');
        case 'lastIndexOf': return E.scall('Js', 'lastIndexOf', [s, sv(0)], 'int');
        case 'includes': return E.call(s, 'contains', [sv(0)], 'boolean');
        case 'startsWith': return E.call(s, 'startsWith', [sv(0)], 'boolean');
        case 'endsWith': return E.call(s, 'endsWith', [sv(0)], 'boolean');
        case 'substring': return E.scall('Js', 'substring', [s, ...args.map((x, i) => a(i, 'double'))], 'String');
        case 'substr': return E.scall('Js', 'substr', [s, ...args.map((x, i) => a(i, 'double'))], 'String');
        case 'slice': return E.scall('Js', 'slice', [s, ...(args.length ? args.map((x, i) => a(i, 'double')) : [E.dbl(0)])], 'String');
        case 'split': {
          if (!args.length) return E.scall('Js', 'split', [s], 'JsArray<String>');
          const sep = this.lowerExpr(args[0]);
          return E.scall('Js', 'split', [s, sep.t === 'JsRegExp' ? sep : this.toStr(sep), ...(args[1] ? [a(1, 'double')] : [])], 'JsArray<String>');
        }
        case 'toUpperCase': case 'toLowerCase': case 'trim': case 'trimStart': case 'trimEnd': return E.scall('Js', name, [s], 'String');
        case 'repeat': return E.scall('Js', 'repeat', [s, a(0, 'double')], 'String');
        case 'padStart': case 'padEnd': return E.scall('Js', name, [s, a(0, 'double'), ...(args[1] ? [sv(1)] : [])], 'String');
        case 'replace': case 'replaceAll': {
          const pat = this.lowerExpr(args[0]);
          const rep = this.lowerExpr(args[1]);
          return E.scall('Js', name, [s, pat.t === 'JsRegExp' ? pat : this.toStr(pat), rep.t === 'JsFn' ? rep : this.toStr(rep)], 'String');
        }
        case 'concat': return E.scall('Js', 'concat', [s, ...args.map(x => this.conv(this.lowerExpr(x), 'Object'))], 'String');
        case 'toString': case 'valueOf': return s;
        case 'match': return E.call(this.lowerExpr(args[0]), 'match', [s], 'JsArray<String>');
        case 'normalize': return s;
        case 'localeCompare': return E.call(s, 'compareTo', [sv(0)], 'int');
        case 'at': return E.scall('Js', 'charAt', [s, E.cast(E.scall('Js', 'atIndex', [a(0, 'double'), E.call(s, 'length', [], 'int')], 'int'), 'double')], 'String');
      }
      return this.dynamicCall(s, name, args, node);
    }

    /**
     * A method the receiver's JVM type does not have: called reflectively. Code
     * the IL types one way and JavaScript narrows another (a typeof branch)
     * still compiles; a call that runs reaches the method by name.
     */
    dynamicCall(obj, name, args, node) {
      const call = E.scall('Js', 'invoke', [this.conv(obj, 'Object'), E.str(name), ...this.boxArgs(args)], 'Object');
      const rt = this.callResultJt(node);
      return rt === 'void' ? call : this.conv(call, rt);
    }

    charCodeAt(s, idx, node) {
      // NaN out of range; the IL types it as an integer where the code relies on an in-range index
      const t = this.nodeJt(node);
      if (T.isIntegral(t)) return this.conv(E.scall('Js', 'charCodeAtInt', [s, this.conv(idx, 'long')], 'int'), t);
      return E.scall('Js', 'charCodeAt', [s, idx], 'double');
    }

    x_StringCharCodeAt(node) {
      const s = this.valueOf(node.string || node.value, 'String');
      return this.charCodeAt(s, node.index ? this.valueOf(node.index, 'double') : E.dbl(0), node);
    }
    x_StringCharAt(node) { return E.scall('Js', 'charAt', [this.valueOf(node.string || node.value, 'String'), this.valueOf(node.index, 'double')], 'String'); }
    x_StringTransform(node) {
      const s = this.valueOf(node.string || node.value, 'String');
      return this.stringMethod(s, node.method || 'toString', node.arguments || [], node);
    }
    x_StringToUpperCase(node) { return E.scall('Js', 'toUpperCase', [this.valueOf(node.string || node.value, 'String')], 'String'); }
    x_StringToLowerCase(node) { return E.scall('Js', 'toLowerCase', [this.valueOf(node.string || node.value, 'String')], 'String'); }
    x_StringTrim(node) { return E.scall('Js', 'trim', [this.valueOf(node.string || node.value, 'String')], 'String'); }
    x_StringSubstring(node) {
      const s = this.valueOf(node.string || node.value, 'String');
      const start = node.start ? this.valueOf(node.start, 'double') : E.dbl(0);
      if (node.length) return E.scall('Js', 'substr', [s, start, this.valueOf(node.length, 'double')], 'String');
      return E.scall('Js', 'slice', node.end ? [s, start, this.valueOf(node.end, 'double')] : [s, start], 'String');
    }
    x_StringSlice(node) {
      const s = this.valueOf(node.string || node.value, 'String');
      return E.scall('Js', 'slice', [s, node.start ? this.valueOf(node.start, 'double') : E.dbl(0), ...(node.end ? [this.valueOf(node.end, 'double')] : [])], 'String');
    }
    x_StringIndexOf(node) {
      const s = this.valueOf(node.string || node.value, 'String');
      const search = this.toStr(this.lowerExpr(node.searchValue));
      if (node.method === 'lastIndexOf') return E.scall('Js', 'lastIndexOf', [s, search], 'int');
      return E.scall('Js', 'indexOf', [s, search, ...(node.fromIndex ? [this.valueOf(node.fromIndex, 'double')] : [])], 'int');
    }
    x_StringSplit(node) {
      const s = this.valueOf(node.string || node.value, 'String');
      if (!node.separator) return E.scall('Js', 'split', [s], 'JsArray<String>');
      const sep = this.lowerExpr(node.separator);
      return E.scall('Js', 'split', [s, sep.t === 'JsRegExp' ? sep : this.toStr(sep), ...(node.limit ? [this.valueOf(node.limit, 'double')] : [])], 'JsArray<String>');
    }
    x_StringRepeat(node) { return E.scall('Js', 'repeat', [this.valueOf(node.string || node.value, 'String'), this.valueOf(node.count, 'double')], 'String'); }
    x_StringReplace(node) {
      const s = this.valueOf(node.string || node.value, 'String');
      const pat = this.lowerExpr(node.searchValue || node.search);
      const rep = this.lowerExpr(node.replaceValue || node.replacement);
      return E.scall('Js', node.method === 'replaceAll' ? 'replaceAll' : 'replace', [s, pat.t === 'JsRegExp' ? pat : this.toStr(pat), rep.t === 'JsFn' ? rep : this.toStr(rep)], 'String');
    }
    x_StringIncludes(node) {
      const s = this.valueOf(node.string || node.value, 'String');
      const v = this.toStr(this.lowerExpr(node.searchValue || node.search));
      const m = node.method === 'startsWith' || node.method === 'endsWith' ? node.method : 'contains';
      return E.call(s, m, [v], 'boolean');
    }
    x_StringStartsWith(node) { return E.call(this.valueOf(node.string || node.value, 'String'), 'startsWith', [this.toStr(this.lowerExpr(node.prefix || node.search))], 'boolean'); }
    x_StringEndsWith(node) { return E.call(this.valueOf(node.string || node.value, 'String'), 'endsWith', [this.toStr(this.lowerExpr(node.suffix || node.search))], 'boolean'); }
    x_StringPad(node) {
      const s = this.valueOf(node.string || node.value, 'String');
      return E.scall('Js', node.method === 'padEnd' ? 'padEnd' : 'padStart', [s, this.valueOf(node.targetLength, 'double'), ...(node.padString ? [this.toStr(this.lowerExpr(node.padString))] : [])], 'String');
    }
    x_StringPadStart(node) { return E.scall('Js', 'padStart', [this.valueOf(node.string || node.value, 'String'), this.valueOf(node.length, 'double'), ...(node.fill ? [this.toStr(this.lowerExpr(node.fill))] : [])], 'String'); }
    x_StringPadEnd(node) { return E.scall('Js', 'padEnd', [this.valueOf(node.string || node.value, 'String'), this.valueOf(node.length, 'double'), ...(node.fill ? [this.toStr(this.lowerExpr(node.fill))] : [])], 'String'); }
    x_StringConcat(node) { return E.scall('Js', 'concat', [this.valueOf(node.string || node.value, 'String'), ...(node.values || node.arguments || []).map(v => this.conv(this.lowerExpr(v), 'Object'))], 'String'); }
    x_StringFromCharCodes(node) { return this.fromCharCodes(node.charCodes || node.arguments || []); }
    x_StringFromCodePoints(node) { return E.scall('Js', 'fromCodePoint', (node.codePoints || node.arguments || []).map(a => this.valueOf(a, 'double')), 'String'); }
    x_StringToBytes(node) {
      const s = this.valueOf(node.arguments && node.arguments[0] ? node.arguments[0] : node.value, 'String');
      return E.scall('Js', node.encoding === 'utf8' ? 'utf8ToBytes' : 'charsToBytes', [s], 'U8Array');
    }
    x_BytesToString(node) {
      const b = this.conv(this.lowerExpr(node.arguments && node.arguments[0] ? node.arguments[0] : node.value), 'Object');
      return E.scall('Js', node.encoding === 'utf8' ? 'bytesToUtf8' : 'bytesToChars', [b], 'String');
    }
    x_HexDecode(node) { return E.scall('OpCodes', 'Hex8ToBytes', [this.valueOf(node.arguments && node.arguments[0] ? node.arguments[0] : node.value, 'String')], 'U8Array'); }
    x_HexEncode(node) { return E.scall('OpCodes', 'BytesToHex', [this.conv(this.lowerExpr(node.arguments && node.arguments[0] ? node.arguments[0] : node.value), 'Object')], 'String'); }

    // ------------------------------------------------------------------ numbers and OpCodes

    x_Cast(node) {
      const target = ilNorm(node.targetType || node.toType || 'number');
      const arg = node.arguments ? node.arguments[0] : (node.expression || node.value);
      const v = this.lowerExpr(arg);
      switch (target) {
        case 'uint8': return E.bin('&', this.toInt32(v), E.int(0xFF), 'int');
        case 'uint16': return E.bin('&', this.toInt32(v), E.int(0xFFFF), 'int');
        case 'uint32': return this.u32(this.toInt32(v));
        case 'int32': return this.toInt32(v);
        case 'int8': return E.bin('>>', E.bin('<<', this.toInt32(v), E.int(24), 'int'), E.int(24), 'int');
        case 'int16': return E.bin('>>', E.bin('<<', this.toInt32(v), E.int(16), 'int'), E.int(16), 'int');
        case 'uint64': return E.call(this.toBigInt(v), 'and', [E.sfield('Js', 'MASK64', 'BigInteger')], 'BigInteger');
        default: return v;
      }
    }

    toBigInt(v) {
      if (v.t === 'BigInteger') return v;
      const u = T.unbox(v.t);
      if (u === 'int' || u === 'long') return E.scall('BigInteger', 'valueOf', [this.conv(v, 'long')], 'BigInteger');
      if (u === 'double') return E.scall('Js', 'big', [this.conv(v, 'double')], 'BigInteger');
      if (v.t === 'String') return E.scall('Js', 'bigOf', [v], 'BigInteger');
      if (u === 'boolean') return E.scall('Js', 'big', [this.conv(v, 'boolean')], 'BigInteger');
      return E.scall('Js', 'toBig', [this.conv(v, 'Object')], 'BigInteger');
    }

    x_BigIntCast(node) { return this.toBigInt(this.lowerExpr(node.argument || node.value)); }

    x_PackBytes(node) {
      const bits = node.bits || 32;
      const name = (bits === 16 ? 'Pack16' : bits === 64 ? 'Pack64' : 'Pack32') + (node.endian === 'big' || node.bigEndian ? 'BE' : 'LE');
      const args = node.arguments || [];
      const ret = OPCODES[name][1];
      if (args.length === 1 && args[0].type === 'SpreadElement') return E.scall('OpCodes', name + 'Of', [this.conv(this.lowerExpr(args[0].argument), 'Object')], ret);
      if (args.some(a => a.type === 'SpreadElement')) {
        return E.scall('OpCodes', name + 'Of', [E.scall('Js', 'build', [E.nw('JsArray<Object>', []), ...args.map(a => a.type === 'SpreadElement' ? E.scall('Js', 'spreadOf', [this.conv(this.lowerExpr(a.argument), 'Object')], 'Object') : this.conv(this.lowerExpr(a), 'Object'))], 'JsArray<Object>')], ret);
      }
      return E.scall('OpCodes', name, args.map(a => this.toInt32(this.lowerExpr(a))), ret);
    }

    x_UnpackBytes(node) {
      const bits = node.bits || 32;
      const name = (bits === 16 ? 'Unpack16' : bits === 64 ? 'Unpack64' : 'Unpack32') + (node.endian === 'big' || node.bigEndian ? 'BE' : 'LE');
      const v = this.lowerExpr(node.arguments ? node.arguments[0] : node.value);
      if (bits === 64) return E.scall('OpCodes', name, [this.conv(v, 'Object')], 'U8Array');
      return E.scall('OpCodes', name, [E.cast(this.toInt32(v), 'long')], 'U8Array');
    }

    rotate(node, dir) {
      const bits = node.bits || 32;
      const v = this.lowerExpr(node.value || node.arguments[0]);
      const n = this.lowerExpr(node.amount || node.arguments[1]);
      if (bits === 64) return E.scall('OpCodes', dir === 'left' ? 'RotL64n' : 'RotR64n', [this.toBigInt(v), this.conv(n, 'long')], 'BigInteger');
      const name = `Rot${dir === 'left' ? 'L' : 'R'}${bits}`;
      const sig = OPCODES[name];
      if (!sig) throw new LoweringError(`${bits}-bit rotation`);
      return E.scall('OpCodes', name, [E.cast(this.toInt32(v), 'long'), E.cast(this.toInt32(n), 'long')], sig[1]);
    }
    x_RotateLeft(node) { return this.rotate(node, 'left'); }
    x_RotateRight(node) { return this.rotate(node, 'right'); }
    x_Rotation(node) { return this.rotate(node, node.direction || 'left'); }

    x_OpCodesCall(node) { return this.opCodesCall(node.method, node.arguments || [], node); }

    opCodesCall(name, args, node) {
      const sig = OPCODES[name];
      if (!sig) throw new LoweringError(`OpCodes.${name} has no JVM runtime`);
      const [ptypes, ret, min] = sig;
      const out = [];
      let retT = ret;
      for (let i = 0; i < ptypes.length; ++i) {
        if (i >= args.length) { if (i < (min === undefined ? ptypes.length : min)) out.push(this.undefinedOf(ptypes[i])); continue; }
        const v = this.lowerExpr(args[i]);
        if (ptypes[i] === '*') { out.push(v); if (ret === 'same') retT = v.t; continue; }
        if (ptypes[i] === 'long' && T.unbox(v.t) === 'double') out.push(E.cast(this.toInt32(v), 'long'));
        else out.push(this.conv(v, ptypes[i]));
      }
      if (retT === 'same') retT = 'Object';
      return E.scall('OpCodes', name, out, retT);
    }

    x_MathCall(node) {
      const m = node.method;
      return this.globalMethodCall('Math', m, node.arguments || [], node) || (() => { throw new LoweringError('Math.' + m); })();
    }
    mathOne(node, fn, owner = 'Math') { return E.scall(owner, fn, [this.valueOf(node.argument !== undefined ? node.argument : (node.arguments ? node.arguments[0] : node.value), 'double')], 'double'); }
    x_Floor(node) { return this.mathOne(node, 'floor'); }
    x_Ceil(node) { return this.mathOne(node, 'ceil'); }
    x_Round(node) { return this.mathOne(node, 'round', 'Js'); }
    x_Truncate(node) { return this.mathOne(node, 'trunc', 'Js'); }
    x_Trunc(node) { return this.mathOne(node, 'trunc', 'Js'); }
    x_Sqrt(node) { return this.mathOne(node, 'sqrt'); }
    x_Log(node) { return this.mathOne(node, 'log'); }
    x_Log2(node) { return this.mathOne(node, 'log2', 'Js'); }
    x_Log10(node) { return this.mathOne(node, 'log10'); }
    x_Exp(node) { return this.mathOne(node, 'exp'); }
    x_Sin(node) { return this.mathOne(node, 'sin'); }
    x_Cos(node) { return this.mathOne(node, 'cos'); }
    x_Tan(node) { return this.mathOne(node, 'tan'); }
    x_Asin(node) { return this.mathOne(node, 'asin'); }
    x_Acos(node) { return this.mathOne(node, 'acos'); }
    x_Atan(node) { return this.mathOne(node, 'atan'); }
    x_Sinh(node) { return this.mathOne(node, 'sinh'); }
    x_Cosh(node) { return this.mathOne(node, 'cosh'); }
    x_Tanh(node) { return this.mathOne(node, 'tanh'); }
    x_Cbrt(node) { return this.mathOne(node, 'cbrt'); }
    x_Sign(node) { return this.mathOne(node, 'sign', 'Js'); }
    x_Fround(node) { return this.mathOne(node, 'fround', 'Js'); }
    x_Atan2(node) { return E.scall('Math', 'atan2', [this.valueOf(node.y || node.arguments[0], 'double'), this.valueOf(node.x || node.arguments[1], 'double')], 'double'); }
    x_Hypot(node) { return E.scall('Js', 'hypot', (node.arguments || []).map(a => this.valueOf(a, 'double')), 'double'); }
    x_Abs(node) {
      const v = this.lowerExpr(node.argument !== undefined ? node.argument : (node.arguments ? node.arguments[0] : node.value));
      if (v.t === 'BigInteger') return E.call(v, 'abs', [], 'BigInteger');
      const u = T.unbox(v.t);
      if (u === 'long') return E.scall('Math', 'abs', [this.conv(v, 'long')], 'long');
      if (u === 'int') return E.scall('Math', 'abs', [this.conv(v, 'long')], 'long');
      return E.scall('Math', 'abs', [this.conv(v, 'double')], 'double');
    }
    x_Min(node) { return this.minMax('min', node.arguments || [], node); }
    x_Max(node) { return this.minMax('max', node.arguments || [], node); }
    x_Power(node) {
      const b = this.lowerExpr(node.base || node.arguments[0]), e = this.lowerExpr(node.exponent || node.arguments[1]);
      if (b.t === 'BigInteger' || e.t === 'BigInteger') return E.scall('Js', 'pow', [this.toBigInt(b), this.toBigInt(e)], 'BigInteger');
      return E.scall('Js', 'pow', [this.conv(b, 'double'), this.conv(e, 'double')], 'double');
    }
    x_Random() { return E.scall('Js', 'random', [], 'double'); }
    x_CountLeadingZeros(node) { return E.scall('Integer', 'numberOfLeadingZeros', [this.toInt32(this.lowerExpr(node.argument))], 'int'); }
    x_MathConstant(node) {
      const v = { PI: Math.PI, E: Math.E, LN2: Math.LN2, LN10: Math.LN10, LOG2E: Math.LOG2E, LOG10E: Math.LOG10E, SQRT2: Math.SQRT2, SQRT1_2: Math.SQRT1_2 }[node.name];
      return E.dbl(v === undefined ? NaN : v);
    }
    x_NumberConstant(node) {
      const v = { MAX_SAFE_INTEGER: 9007199254740991, MIN_SAFE_INTEGER: -9007199254740991, EPSILON: Number.EPSILON, MAX_VALUE: Number.MAX_VALUE, MIN_VALUE: Number.MIN_VALUE, POSITIVE_INFINITY: Infinity, NEGATIVE_INFINITY: -Infinity, NaN: NaN }[node.name];
      return E.dbl(v === undefined ? NaN : v);
    }
    x_IsIntegerCheck(node) { return E.scall('Js', 'isInteger', [this.conv(this.lowerExpr(node.value || node.argument || node.arguments[0]), 'Object')], 'boolean'); }
    x_IsNaNCheck(node) { return E.scall('Js', 'isNaN', [this.conv(this.lowerExpr(node.value || node.argument || node.arguments[0]), 'Object')], 'boolean'); }
    x_IsFiniteCheck(node) { return E.scall('Js', 'isFinite', [this.conv(this.lowerExpr(node.value || node.argument || node.arguments[0]), 'Object')], 'boolean'); }
    x_IsSafeIntegerCheck(node) { return E.scall('Js', 'isSafeInteger', [this.valueOf(node.value || node.argument, 'double')], 'boolean'); }
    x_ParseInteger(node) {
      const s = node.string || (node.arguments && node.arguments[0]);
      const r = node.radix || (node.arguments && node.arguments[1]);
      return E.scall('Js', 'parseInt', [this.conv(this.lowerExpr(s), 'Object'), r ? this.valueOf(r, 'double') : E.dbl(0)], 'double');
    }
    x_ParseFloat(node) { return E.scall('Js', 'parseFloat', [this.conv(this.lowerExpr(node.string || node.arguments[0]), 'Object')], 'double'); }
    x_BitwiseOperation(node) {
      const l = this.lowerExpr(node.left || node.arguments[0]), r = this.lowerExpr(node.right || node.arguments[1]);
      return this.binary(node.operator || '&', l, r, node, l.t === 'BigInteger' || r.t === 'BigInteger');
    }

    // ------------------------------------------------------------------ objects, errors, misc

    x_ErrorCreation(node) {
      const msg = node.message ? this.conv(this.lowerExpr(node.message), 'Object') : E.str('');
      return E.scall('Js', 'error', [E.str(node.errorType || 'Error'), msg], 'JsError');
    }

    x_NewExpression(node, expect) {
      const callee = node.callee;
      const args = node.arguments || [];
      let name = callee && (callee.name || (callee.type === 'MemberExpression' && !callee.computed && callee.property && (callee.property.name || callee.property.value)));
      if (callee && callee.__sym && callee.__sym.kind === 'class') name = callee.__sym.name;
      if (callee && callee.type === 'MemberExpression' && !callee.computed) {
        const target = this.namespaceMember(callee.object, name);
        if (target && target.kind === 'class') name = target.name;
      }

      const info = this.classInfo(name);
      if (info && !info.enumLike) {
        const sigs = this.ctorSignatures(info);
        return E.nw(info.javaName, this.lowerArgsFor(args, sigs));
      }
      switch (name) {
        case 'Array': {
          if (args.length === 1) return this.x_ArrayCreation({ size: args[0], resultType: node.resultType, contextType: node.contextType }, expect);
          return this.arrayLiteral({ elements: args, resultType: node.resultType }, expect);
        }
        case 'Map': return E.nw('JsMap', args.length ? [this.conv(this.lowerExpr(args[0]), 'Object')] : []);
        case 'Set': return E.nw('JsSet', args.length ? [this.conv(this.lowerExpr(args[0]), 'Object')] : []);
        case 'Object': return E.nw('JsObject', []);
        case 'Error': case 'TypeError': case 'RangeError': case 'SyntaxError':
          return E.scall('Js', 'error', [E.str(name), args.length ? this.conv(this.lowerExpr(args[0]), 'Object') : E.str('')], 'JsError');
        case 'RegExp': return E.nw('JsRegExp', [this.toStr(this.lowerExpr(args[0])), args[1] ? this.toStr(this.lowerExpr(args[1])) : E.str('')]);
        case 'ArrayBuffer': return E.scall('U8Array', 'typed', [this.valueOf(args[0], 'int')], 'U8Array');
      }
      if (T.TYPED_ARRAY_CLASS[name]) return this.x_TypedArrayCreation({ arrayType: name, size: args[0], resultType: node.resultType });
      // a constructor resolved at run time (a ReferenceError there when not defined)
      const made = callee && callee.type === 'Identifier' && !callee.__sym
        ? E.scall('Js', 'construct', [E.str(name), ...this.boxArgs(args)], 'Object')
        : E.scall('Js', 'constructValue', [this.conv(this.lowerExpr(callee), 'Object'), ...this.boxArgs(args)], 'Object');
      return this.conv(made, this.dynResultJt(node));
    }

    x_MapCreation(node) { return E.nw('JsMap', node.entries ? [this.conv(this.lowerExpr(node.entries), 'Object')] : []); }
    x_SetCreation(node) { return E.nw('JsSet', node.values ? [this.conv(this.lowerExpr(node.values), 'Object')] : []); }
    x_MapGet(node) { return this.conv(E.call(this.valueOf(node.map, 'JsMap'), 'get', [this.conv(this.lowerExpr(node.key), 'Object')], 'Object'), this.dynResultJt(node)); }
    x_MapSet(node) { return E.call(this.valueOf(node.map, 'JsMap'), 'set', [this.conv(this.lowerExpr(node.key), 'Object'), this.conv(this.lowerExpr(node.value), 'Object')], 'JsMap'); }
    x_MapHas(node) { return E.call(this.valueOf(node.map, 'JsMap'), 'has', [this.conv(this.lowerExpr(node.key), 'Object')], 'boolean'); }
    x_MapDelete(node) { return E.call(this.valueOf(node.map, 'JsMap'), 'delete', [this.conv(this.lowerExpr(node.key), 'Object')], 'boolean'); }
    x_RegExpCreation(node) { return E.nw('JsRegExp', [this.toStr(this.lowerExpr(node.pattern)), node.flags ? this.toStr(this.lowerExpr(node.flags)) : E.str('')]); }

    x_ObjectKeys(node) { return E.scall('Js', 'keys', [this.conv(this.lowerExpr(node.argument || node.object), 'Object')], 'JsArray<String>'); }
    x_ObjectValues(node) { return this.conv(E.scall('Js', 'values', [this.conv(this.lowerExpr(node.argument || node.object), 'Object')], 'JsArray<Object>'), this.arrayTypeOrObject(node)); }
    x_ObjectEntries(node) { return E.scall('Js', 'entries', [this.conv(this.lowerExpr(node.argument || node.object), 'Object')], 'JsArray<Object>'); }
    x_ObjectFreeze(node) { return this.lowerExpr(node.object || node.value || node.argument || node.arguments[0]); }
    x_ObjectSeal(node) { return this.lowerExpr(node.object); }
    x_ObjectMerge(node) { return E.scall('Js', 'assign', [this.conv(this.lowerExpr(node.target), 'Object'), ...(node.sources || []).map(s => this.conv(this.lowerExpr(s), 'Object'))], 'JsObject'); }
    x_ObjectHasProperty(node) { return E.scall('Js', 'hasOwn', [this.conv(this.lowerExpr(node.object), 'Object'), this.conv(this.lowerExpr(node.property !== undefined ? node.property : node.key), 'Object')], 'boolean'); }
    x_ObjectFromEntries(node) { return E.scall('Js', 'fromEntries', [this.conv(this.lowerExpr(node.entries || node.value || node.argument || node.arguments[0]), 'Object')], 'JsObject'); }
    x_ObjectCreate(node) { return E.nw('JsObject', []); }
    x_ObjectPropertyNames(node) { return E.scall('Js', 'keys', [this.conv(this.lowerExpr(node.object), 'Object')], 'JsArray<String>'); }
    arrayTypeOrObject(node) { const t = this.nodeJt(node); return T.isArray(t) ? t : 'JsArray<Object>'; }

    x_InstanceOfCheck(node) { return this.instanceOf(this.lowerExpr(node.value), node.className); }
    x_Instanceof(node) { return this.instanceOf(this.lowerExpr(node.left), node.right); }

    instanceOf(v, clsNode) {
      const name = clsNode && (clsNode.name || (clsNode.property && clsNode.property.name) || (typeof clsNode === 'string' ? clsNode : null));
      const obj = this.conv(v, 'Object');
      if (name === 'Array') return E.scall('Js', 'isArray', [obj], 'boolean');
      if (T.TYPED_ARRAY_CLASS[name]) return E.scall('Js', 'isTyped', [obj, E.str(name)], 'boolean');
      if (name === 'Error' || name === 'TypeError' || name === 'RangeError') return E.inst(obj, 'RuntimeException');
      if (name === 'Map') return E.inst(obj, 'JsMap');
      if (name === 'Set') return E.inst(obj, 'JsSet');
      if (name === 'Object') return E.bin('!=', obj, E.nul(), 'boolean');
      if (name === 'Function') return E.inst(obj, 'JsFn');
      const info = this.classInfo(name);
      if (info) return E.inst(obj, info.javaName);
      throw new LoweringError('instanceof ' + name);
    }

    x_YieldExpression(node) { return E.scall('Js', 'unsupported', [E.str('yield (generators)')], 'Object'); }
    x_AwaitExpression(node) { return this.lowerExpr(node.argument); }
    x_ClassExpression(node) { return E.scall('Js', 'unsupported', [E.str('class expressions')], 'Object'); }
    x_ChainExpression(node) { return this.lowerExpr(node.expression); }

    x_DebugOutput(node) { return E.scall('Js', 'log', (node.arguments || []).map(a => this.conv(this.lowerExpr(a), 'Object')), 'void'); }

    x_DataViewCreation(node) {
      const buf = node.buffer ? this.lowerExpr(node.buffer) : E.scall('U8Array', 'typed', [E.int(0)], 'U8Array');
      return E.nw('JsDataView', [this.conv(buf, 'Object'), ...(node.byteOffset ? [this.valueOf(node.byteOffset, 'int')] : [])], 'JsDataView');
    }
    x_DataViewRead(node) {
      const view = this.valueOf(node.view || node.dataView, 'JsDataView');
      const m = node.method || 'getUint8';
      const args = [this.valueOf(node.offset !== undefined ? node.offset : node.arguments[0], 'int')];
      if (!/8$/.test(m)) args.push(node.littleEndian ? this.truthy(this.lowerExpr(node.littleEndian)) : E.bool(false));
      const rt = /Big/.test(m) ? 'BigInteger' : /Float/.test(m) ? 'double' : m === 'getUint32' ? 'long' : 'int';
      return E.call(view, m, args, rt);
    }
    x_DataViewWrite(node) {
      const view = this.valueOf(node.view || node.dataView, 'JsDataView');
      const m = node.method || 'setUint8';
      const vt = /Big/.test(m) ? 'BigInteger' : /Float/.test(m) ? 'double' : 'long';
      const value = this.lowerExpr(node.value !== undefined ? node.value : node.arguments[1]);
      const args = [this.valueOf(node.offset !== undefined ? node.offset : node.arguments[0], 'int'), vt === 'long' ? E.cast(this.toInt32(value), 'long') : this.conv(value, vt)];
      if (!/8$/.test(m)) args.push(node.littleEndian ? this.truthy(this.lowerExpr(node.littleEndian)) : E.bool(false));
      return E.call(view, m, args, 'void');
    }
    x_DataViewGetByteLength(node) {
      const v = this.lowerExpr(node.view);
      if (v.t === 'JsDataView') return E.call(v, 'byteLength', [], 'int');
      return this.conv(this.memberGet(v, 'byteLength', node), 'int');
    }
    x_DataViewGetBuffer(node) { return E.field(this.valueOf(node.view, 'JsDataView'), 'buffer', 'U8Array'); }
    x_DataViewGetByteOffset(node) { return E.field(this.valueOf(node.view, 'JsDataView'), 'offset', 'int'); }

    x_JsonSerialize(node) { return E.scall('Js', 'stringify', [this.conv(this.lowerExpr(node.value !== undefined ? node.value : node.arguments[0]), 'Object')], 'String'); }

    // ------------------------------------------------------------------ functions as values

    x_ArrowFunction(node) { return this.lambda(node); }
    x_ArrowFunctionExpression(node) { return this.lambda(node); }
    x_FunctionExpression(node) { return this.lambda(node); }

    /** A function expression: a JsFn whose parameters are converted on entry. */
    lambda(fnNode) {
      const fi = this.fnInfo(fnNode, '<lambda>');
      const ret = this.fnRet(fi);
      const outer = this.fn;
      this.fnStack = (this.fnStack || []).concat([outer]);
      const argsName = this.fresh('a');
      this.fn = { locals: [new Map()], labels: [], isStatic: outer ? outer.isStatic : true, retJt: ret === 'void' ? 'void' : 'Object', cls: outer ? outer.cls : null, used: new Set([argsName]), inner: true, node: fnNode, lambdaRet: ret, holders: outer && outer.holders };
      const body = [];
      fi.params.forEach((p, i) => {
        if (!p.sym) return;
        const t = this.paramJt(p);
        const name = this.declareLocal(p.sym, t);
        const raw = p.rest ? E.scall('Js', 'restArgs', [E.name(argsName, 'Object[]'), E.int(i)], 'JsArray<Object>') : E.scall('Js', 'arg', [E.name(argsName, 'Object[]'), E.int(i)], 'Object');
        let init = this.conv(raw, t);
        if (p.def) init = E.cond(E.bin('==', E.scall('Js', 'arg', [E.name(argsName, 'Object[]'), E.int(i)], 'Object'), E.nul(), 'boolean'), this.valueOf(p.def, t), init, t);
        p.sym.boxed = this.needsBox(p.sym);
        body.push(S.local(name, t, init, { boxed: p.sym.boxed }));
      });
      // returns convert to Object (boxed)
      this.fn.retJt = ret === 'void' ? 'void' : ret;
      let stmts;
      if (fnNode.body && fnNode.body.type === 'BlockStatement') stmts = this.lowerStmts(fnNode.body.body || []);
      else if (fnNode.body) stmts = ret === 'void' ? [S.expr(this.lowerExpr(fnNode.body))] : [S.ret(this.valueOf(fnNode.body, ret))];
      else stmts = [];
      body.push(...stmts);
      this.fn = outer;
      this.fnStack.pop();
      return E.lambda([{ name: argsName }], body, ret);
    }

    // ------------------------------------------------------------------ conversions

    /** Truthiness of a value as a boolean. */
    truthy(e) {
      const t = e.t;
      if (t === 'boolean') return e;
      if (t === 'int' || t === 'long') return E.bin('!=', e, E.lit(0, t), 'boolean');
      if (t === 'double' || t === 'String' || t === 'BigInteger' || t === 'Object' || T.isBoxed(t)) return E.scall('Js', 'truthy', [t === 'Boolean' || t === 'Integer' || t === 'Long' || t === 'Double' ? this.conv(e, 'Object') : e], 'boolean');
      if (t === 'null') return E.bool(false);
      if (t === 'void') return E.bool(false);
      return E.bin('!=', e, E.nul(), 'boolean');
    }

    /** JavaScript ToString as a Java String. */
    toStr(e) {
      if (e.t === 'String') return e.k === 'lit' ? e : E.scall('Js', 'str', [e], 'String');
      if (e.t === 'int' || e.t === 'long' || e.t === 'boolean') return E.scall('Js', 'str', [e], 'String');
      if (e.t === 'double') return E.scall('Js', 'str', [e], 'String');
      return E.scall('Js', 'str', [this.conv(e, 'Object')], 'String');
    }

    /** JavaScript === between two lowered values. */
    strictEquals(l, r) {
      const lu = T.unbox(l.t), ru = T.unbox(r.t);
      if (l.t === 'null' && r.t === 'null') return E.bool(true);
      if (l.t === 'null' || r.t === 'null') {
        const other = l.t === 'null' ? r : l;
        if (T.isPrim(other.t)) return E.bool(false);
        return E.bin('==', other, E.nul(), 'boolean');
      }
      if (T.isNumeric(lu) && T.isNumeric(ru) && T.isPrim(l.t) && T.isPrim(r.t)) {
        const w = T.wider(lu, ru);
        return E.bin('==', this.conv(l, w), this.conv(r, w), 'boolean');
      }
      if (l.t === 'boolean' && r.t === 'boolean') return E.bin('==', l, r, 'boolean');
      if (l.t === 'String' && r.t === 'String') return E.scall('java.util.Objects', 'equals', [l, r], 'boolean');
      if (l.t === 'BigInteger' && r.t === 'BigInteger') return E.scall('java.util.Objects', 'equals', [l, r], 'boolean');
      if ((T.isPrim(l.t) && (r.t === 'String' || T.isArray(r.t))) || (T.isPrim(r.t) && (l.t === 'String' || T.isArray(l.t)))) return E.bool(false);
      if (T.isRef(l.t) && T.isRef(r.t) && !this.isValueRef(l.t) && !this.isValueRef(r.t)) return E.bin('==', this.conv(l, 'Object'), this.conv(r, 'Object'), 'boolean');
      return E.scall('Js', 'strictEq', [this.conv(l, 'Object'), this.conv(r, 'Object')], 'boolean');
    }

    /** References compared by value under === (numbers, strings, BigInts, booleans in boxes or Object). */
    isValueRef(t) { return t === 'Object' || t === 'String' || t === 'BigInteger' || T.isBoxed(t); }

    looseEquals(l, r) {
      if (l.t === 'null' || r.t === 'null') {
        const other = l.t === 'null' ? r : l;
        if (T.isPrim(other.t)) return E.bool(false);
        return E.bin('==', other, E.nul(), 'boolean');
      }
      const lu = T.unbox(l.t), ru = T.unbox(r.t);
      if (T.isNumeric(lu) && T.isNumeric(ru) && T.isPrim(l.t) && T.isPrim(r.t)) return this.strictEquals(l, r);
      if (l.t === r.t && (l.t === 'String' || l.t === 'boolean' || l.t === 'BigInteger')) return this.strictEquals(l, r);
      return E.scall('Js', 'looseEq', [this.conv(l, 'Object'), this.conv(r, 'Object')], 'boolean');
    }

    /**
     * Convert an IR expression to a JVM type, preserving its JavaScript value.
     */
    conv(e, to) {
      if (!to || to === 'void') return e;
      const from = e.t;
      if (from === to) return e;
      if (e.k === 'lit' && e.v === null) {
        if (T.isPrim(to)) return this.undefinedOf(to);
        return E.nul(to);
      }
      if (e.k === 'lit' && T.isNumeric(from) && T.isNumeric(T.unbox(to))) {
        const u = T.unbox(to);
        let v = e.v;
        if (u === 'int' && (!Number.isInteger(v) || v > MAX_INT || v < MIN_INT)) v = Number.isFinite(v) ? Number(BigInt.asIntN(32, BigInt(Math.trunc(v)))) : 0;
        if (u === 'long' && !Number.isInteger(v)) v = Number.isFinite(v) ? Math.trunc(v) : 0;
        const lit = E.lit(v, u);
        return u === to ? lit : E.cast(lit, to);
      }
      if (e.k === 'lit' && T.isNumeric(from) && to === 'BigInteger' && Number.isInteger(e.v)) return E.big(BigInt(e.v));
      if (to === 'Object') {
        if (T.isPrim(from)) return E.cast(e, T.box(from));
        return e;
      }
      const fu = T.unbox(from), tu = T.unbox(to);
      // numbers
      if (T.isNumeric(fu) && T.isNumeric(tu)) {
        let x = e;
        if (T.isBoxed(from)) x = E.scall('Js', { int: 'toInt', long: 'toLong', double: 'toNum' }[tu], [e], tu);
        else if (fu !== tu) x = E.cast(e, tu);
        return T.isBoxed(to) ? E.cast(x, to) : x;
      }
      if (fu === 'boolean' && tu === 'boolean') return E.cast(e, to);
      if (fu === 'boolean' && T.isNumeric(tu)) return this.conv(E.cond(this.conv(e, 'boolean'), E.int(1), E.int(0), 'int'), to);
      if (T.isNumeric(fu) && tu === 'boolean') return this.conv(this.truthy(this.conv(e, fu)), to);
      if (from === 'BigInteger' && T.isNumeric(tu)) {
        const m = { int: 'intValue', long: 'longValue', double: 'doubleValue' }[tu];
        return this.conv(E.call(e, m, [], tu), to);
      }
      if (T.isNumeric(fu) && to === 'BigInteger') return this.toBigInt(e);
      if (from === 'String' && T.isNumeric(tu)) return this.conv(E.scall('Js', 'toNum', [e], 'double'), to);
      if (to === 'String') {
        if (from === 'Object' || from === 'null') return E.cast(e, 'String');
        return this.toStr(e);
      }
      // from Object (or an unrelated reference) to a specific type
      if (T.isPrim(to) || T.isBoxed(to)) {
        const fn = { int: 'toInt', long: 'toLong', double: 'toNum', boolean: 'truthy' }[tu];
        const x = E.scall('Js', fn, [this.conv(e, 'Object')], tu);
        if (T.isBoxed(to)) return E.scall('Js', { int: 'boxInt', long: 'boxLong', double: 'boxNum', boolean: 'boxBool' }[tu], [this.conv(e, 'Object')], to);
        return x;
      }
      if (to === 'BigInteger') return E.scall('Js', 'toBig', [this.conv(e, 'Object')], 'BigInteger');
      if (T.isPrimArray(to)) {
        const fn = { U8Array: 'toU8', I8Array: 'toI8', U16Array: 'toU16', I16Array: 'toI16', U32Array: 'toU32', I32Array: 'toI32', I64Array: 'toI64', F64Array: 'toF64', F32Array: 'toF32', BoolArray: 'toBools' }[to];
        return E.scall('Js', fn, [this.conv(e, 'Object')], to);
      }
      if (T.isJsArray(to)) {
        const et = T.elemOf(to);
        if (['TestCase', 'KeySize', 'LinkItem', 'Vulnerability'].includes(et)) return E.scall('Js', 'to' + et + 's', [this.conv(e, 'Object')], to);
        if (et === 'BigInteger') return E.scall('Js', 'toBigs', [this.conv(e, 'Object')], to);
        if (T.isJsArray(from) && (from === 'JsArray<Object>' || et === 'Object')) return { k: 'uncheckedCast', e, t: to };
        return E.scall('Js', 'toArr', [this.conv(e, 'Object')], to);
      }
      if (to === 'JsObject') return E.scall('Js', 'toObj', [this.conv(e, 'Object')], 'JsObject');
      if (to === 'JsFn') return E.scall('Js', 'toFn', [this.conv(e, 'Object')], 'JsFn');
      if (to === 'TestCase' && from === 'JsObject') return E.scall('TestCase', 'fromObject', [e], 'TestCase');
      if (to === 'KeySize' || to === 'LinkItem' || to === 'Vulnerability') return E.scall('Js', 'to' + to, [this.conv(e, 'Object')], to);
      if (['CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode'].includes(to)) return E.scall('Js', 'enumOf', [this.conv(e, 'Object'), { k: 'classlit', name: to, t: 'Class' }], to);
      if (to === 'TestCase') return E.scall('Js', 'toTest', [this.conv(e, 'Object')], 'TestCase');
      if (from === 'JsError' && to === 'RuntimeException') return e;
      if (to === 'JsArrayLike' && T.isArray(from)) return e;
      if (to === 'RuntimeException' || to === 'JsError') return E.cast(this.conv(e, 'Object'), to);
      // classes
      const fc = this.classOfJt(from), tc = this.classOfJt(to);
      if (fc && tc && this.isSubclass(fc.name, tc.name)) return e;
      return E.cast(this.conv(e, 'Object'), to);
    }
  }

  const exports = { JavaTransformer, LoweringError, ilName, ilNorm, jid, mid, OPCODES, FRAMEWORK };
  if (typeof module !== 'undefined' && module.exports) module.exports = exports;
  if (global) global.JavaTransformer = JavaTransformer;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
