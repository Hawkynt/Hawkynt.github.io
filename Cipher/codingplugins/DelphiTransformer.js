/**
 * DelphiTransformer.js - typed IL AST to the DelphiAST tree
 * (c)2006-2025 Hawkynt
 *
 * Every Pascal type comes from the IL: an expression's resultType, a
 * declaration's type, a parameter's type, the contextual type of a returned
 * value. Names and values are never consulted to guess a type.
 *
 * How JavaScript maps onto the runtime DelphiEmitter embeds:
 *  - integers are fixed-width (Byte..UInt64) and wrap like the IL types say;
 *    each operation computes in a domain wide enough for its operands and
 *    result and is cast to the IL result type, so `(a + b) >>> 0` and
 *    OpCodes.Add32 come out modular exactly where JavaScript is;
 *  - BigInt is TBigInt, a record with operators;
 *  - arrays are TJsArray<T>: reference semantics, push/pop/slice/subarray,
 *    a read past the end yields the element default (JavaScript undefined
 *    in a numeric context), a write past the end grows the array;
 *  - classes are classes, getters/setters are properties, every method is
 *    virtual so a subclass override dispatches like JavaScript;
 *  - an expression JavaScript evaluates lazily or for its side effect inside
 *    an expression (?:, &&, ||, x++, assignments) is lowered to statements
 *    before the statement that uses it.
 */

(function (global) {
  'use strict';

  const A = (typeof require !== 'undefined') ? require('./DelphiAST.js') : global.DelphiAST;
  // The emitter holds the runtime and its identifiers; in the browser it loads after this file
  const emitterModule = () => (typeof require !== 'undefined') ? require('./DelphiEmitter.js') : (global.DelphiEmitterModule || {});

  // =====================================================================
  // Types
  // =====================================================================

  const INT_INFO = {
    int8: { bits: 8, signed: true, pas: 'ShortInt', code: 'I8' },
    uint8: { bits: 8, signed: false, pas: 'Byte', code: 'U8' },
    int16: { bits: 16, signed: true, pas: 'SmallInt', code: 'I16' },
    uint16: { bits: 16, signed: false, pas: 'Word', code: 'U16' },
    int32: { bits: 32, signed: true, pas: 'Int32', code: 'I32' },
    uint32: { bits: 32, signed: false, pas: 'UInt32', code: 'U32' },
    int64: { bits: 64, signed: true, pas: 'Int64', code: 'I64' },
    uint64: { bits: 64, signed: false, pas: 'UInt64', code: 'U64' }
  };
  const TYPE_ALIASES = {
    byte: 'uint8', sbyte: 'int8', word: 'uint16', short: 'int16', dword: 'uint32', int: 'int32', integer: 'int32',
    qword: 'uint64', long: 'int64', uint: 'uint32', ulong: 'uint64', bool: 'boolean', Boolean: 'boolean', String: 'string',
    double: 'float64', float: 'float32', number: 'float64', Number: 'float64', BigInt: 'bigint', char: 'string'
  };
  const TYPED_ARRAYS = {
    Uint8Array: 'uint8', Uint8ClampedArray: 'uint8', Int8Array: 'int8', Uint16Array: 'uint16', Int16Array: 'int16',
    Uint32Array: 'uint32', Int32Array: 'int32', Float32Array: 'float32', Float64Array: 'float64',
    BigUint64Array: 'uint64', BigInt64Array: 'int64', ArrayBuffer: 'uint8'
  };
  const ENUM_TYPES = new Set(['CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode']);
  const WEAK_TYPES = new Set(['', 'any', 'object', 'Object', 'unknown', '*', 'mixed', 'Array']);

  const typeCache = new Map();
  function mk(key, t) {
    if (!typeCache.has(key)) { t.key = key; typeCache.set(key, t); }
    return typeCache.get(key);
  }
  const T = {
    bool: mk('boolean', { k: 'bool' }),
    str: mk('string', { k: 'string' }),
    big: mk('bigint', { k: 'bigint' }),
    f64: mk('float64', { k: 'float', bits: 64 }),
    f32: mk('float32', { k: 'float', bits: 32 }),
    void: mk('void', { k: 'void' }),
    null: mk('null', { k: 'null' }),
    any: mk('any', { k: 'any' }),
    fn: mk('function', { k: 'function' }),
    err: mk('Error', { k: 'error' })
  };
  for (const [name, info] of Object.entries(INT_INFO)) T[name] = mk(name, Object.assign({ k: 'int', il: name }, info));
  const tArr = elem => mk(elem.key + '[]', { k: 'array', elem });
  const tClass = name => mk('class:' + name, { k: 'class', name });
  const tEnum = name => mk('enum:' + name, { k: 'enum', name });
  const tTuple = elems => mk('[' + elems.map(e => e.key).join(',') + ']', { k: 'tuple', elems });
  const tRecord = fields => mk('(' + fields.map(f => f.name + ':' + f.type.key).join(',') + ')', { k: 'record', fields });
  const tMap = (key, value) => mk('Map<' + key.key + ',' + value.key + '>', { k: 'map', keyT: key, valueT: value });

  function splitTop(text, sep) {
    const parts = [];
    let depth = 0, start = 0;
    for (let i = 0; i < text.length; ++i) {
      const c = text[i];
      if (c === '<' || c === '(' || c === '{' || c === '[') ++depth;
      else if (c === '>' || c === ')' || c === '}' || c === ']') --depth;
      else if (c === sep && depth === 0) { parts.push(text.slice(start, i).trim()); start = i + 1; }
    }
    parts.push(text.slice(start).trim());
    return parts;
  }

  /**
   * An IL type name as a type object, or null for no type.
   * @param {string|object} s - IL type ('uint32', 'uint8[]', a class name, ...)
   * @returns {object|null}
   */
  function parseType(s) {
    if (s == null) return null;
    if (typeof s === 'object') {
      if (s.k) return s;
      return parseType(jsDocTypeName(s));
    }
    s = String(s).trim();
    if (!s) return null;
    s = s.replace(/^[?!]|[?=!]$/g, '');
    if (s.includes('|') && !s.startsWith('(') && !s.startsWith('[')) {
      const members = splitTop(s, '|').filter(m => m !== 'null' && m !== 'undefined' && m !== 'void');
      if (members.length === 1) return parseType(members[0]);
      if (members.length === 0) return T.null;
      const types = members.map(parseType).filter(Boolean);
      if (types.length && types.every(t => t.key === types[0].key)) return types[0];
      return T.any;
    }
    if (s.endsWith('[]')) {
      const e = parseType(s.slice(0, -2));
      return e ? tArr(e) : tArr(T.any);
    }
    let m = s.match(/^Array\.?<(.+)>$/);
    if (m) { const e = parseType(m[1]); return tArr(e || T.any); }
    m = s.match(/^(Map|Object|Record)\.?<(.+)>$/);
    if (m) {
      const args = splitTop(m[2], ',');
      if (args.length === 2) return tMap(parseType(args[0]) || T.any, parseType(args[1]) || T.any);
      return T.any;
    }
    if (s.startsWith('[') && s.endsWith(']')) {
      const elems = splitTop(s.slice(1, -1), ',').map(parseType);
      if (elems.every(Boolean)) return tTuple(elems);
      return T.any;
    }
    if (s.startsWith('(') && s.endsWith(')')) {
      const fields = splitTop(s.slice(1, -1), ',').map(f => {
        const i = f.indexOf(':');
        return { name: f.slice(0, i).trim(), type: parseType(f.slice(i + 1).trim()) || T.any };
      });
      return tRecord(fields);
    }
    if (TYPE_ALIASES[s]) s = TYPE_ALIASES[s];
    if (INT_INFO[s]) return T[s];
    switch (s) {
      case 'boolean': return T.bool;
      case 'string': return T.str;
      case 'bigint': return T.big;
      case 'float64': return T.f64;
      case 'float32': return T.f32;
      case 'void': case 'undefined': return T.void;
      case 'null': return T.null;
      case 'function': case 'Function': return T.fn;
      case 'Error': case 'TypeError': case 'RangeError': case 'ReferenceError': case 'SyntaxError': return T.err;
    }
    if (WEAK_TYPES.has(s)) return T.any;
    if (TYPED_ARRAYS[s]) return tArr(T[TYPED_ARRAYS[s]] || parseType(TYPED_ARRAYS[s]));
    if (ENUM_TYPES.has(s)) return tEnum(s);
    if (s === 'Map') return tMap(T.any, T.any);
    if (s === 'Set' || s === 'DataView') return T.any;
    if (/^[A-Za-z_$][\w$]*$/.test(s)) return tClass(s);
    return T.any;
  }

  /** The IL name of a JSDoc type object (as JSDocParser builds them). */
  function jsDocTypeName(t) {
    if (!t) return null;
    if (typeof t === 'string') return t;
    if (t.isTuple) return null;
    if (t.isUnion) {
      const names = (t.unionTypes || []).map(u => u && jsDocTypeName(u)).filter(n => n && n !== 'null' && n !== 'undefined');
      return names.length === 1 ? names[0] : (t.name || null);
    }
    if (t.isArray) {
      const e = jsDocTypeName(t.elementType);
      return e ? e + '[]' : null;
    }
    if (t.isGeneric && (t.name === 'Map' || t.name === 'Object' || t.name === 'Record') && (t.genericTypes || []).length === 2)
      return 'Map<' + jsDocTypeName(t.genericTypes[0]) + ',' + jsDocTypeName(t.genericTypes[1]) + '>';
    return t.name || null;
  }

  const isInt = t => !!t && t.k === 'int';
  const isFloat = t => !!t && t.k === 'float';
  const isNum = t => isInt(t) || isFloat(t);
  const isBig = t => !!t && t.k === 'bigint';
  const isArr = t => !!t && t.k === 'array';
  const isStr = t => !!t && t.k === 'string';
  const isBool = t => !!t && t.k === 'bool';
  const isClassT = t => !!t && t.k === 'class';
  const isNullT = t => !!t && (t.k === 'null' || t.k === 'void');
  const isAnyT = t => !!t && t.k === 'any';
  const isRef = t => !!t && (t.k === 'array' || t.k === 'class' || t.k === 'error' || t.k === 'map');
  const is64 = t => isInt(t) && t.bits === 64;

  /** Does every value of `from` fit `to` unchanged (an implicit Pascal conversion)? */
  function intFits(from, to) {
    if (from.signed === to.signed) return from.bits <= to.bits;
    if (!from.signed && to.signed) return from.bits < to.bits;
    return false;
  }

  // =====================================================================
  // Pascal names
  // =====================================================================

  const PASCAL_KEYWORDS = ('and array as asm begin case class const constructor destructor dispinterface div do downto else end ' +
    'except exports file finalization finally for function goto if implementation in inherited initialization inline interface ' +
    'is label library mod nil not object of on operator or out packed procedure program property raise record repeat ' +
    'resourcestring set shl shr string then threadvar to try type unit until uses var while with xor absolute abstract ' +
    'self result true false exit break continue default specialize generic helper strict private protected public published ' +
    'override virtual overload reintroduce static message cdecl stdcall register pascal far near forward external export ' +
    'index name read write stored nodefault implements dynamic deprecated platform experimental unimplemented assembler ' +
    'otherwise bitpacked weakexternal cppdecl iochecks local noreturn nostackframe oldfpccall safecall softfloat varargs').split(' ');
  const PASCAL_BUILTINS = ('system sysutils math typinfo integer cardinal byte word shortint smallint longint longword int8 uint8 ' +
    'int16 uint16 int32 uint32 int64 uint64 qword double single extended real boolean char widechar ansichar unicodestring ' +
    'ansistring widestring shortstring pointer tobject tclass exception tarray length setlength high low ord chr inc dec ' +
    'trunc round int frac abs sqr sqrt sin cos ln exp pi assigned copy move fillchar sizeof typeof writeln write readln ' +
    'free create destroy classname classtype inheritsfrom equals gethashcode tostring dispatch afterconstruction ' +
    'beforedestruction freeinstance newinstance instancesize classparent classinfo methodaddress fieldaddress ' +
    'initinstance cleanupinstance safecallexception defaulthandler getinterface unitname qualifiedclassname ' +
    'random randomize odd succ pred halt assert include exclude str val power floor ceil min max sign isnan isinfinite ' +
    'nan infinity sarlongint sarint64 inttostr uinttostr format trim uppercase lowercase pos delete insert frexp ' +
    'tformatsettings defaultformatsettings strtofloat floattostrf comparemem gettypekind log2 log10 tan arctan arctan2 tanh ' +
    'hypot comparestr booltostr inttohex').split(' ');

  /** A JavaScript identifier as a Pascal one ($ is not allowed). */
  function sanitize(name) {
    let s = String(name).replace(/\$/g, 'S_').replace(/[^A-Za-z0-9_]/g, '_');
    if (!/^[A-Za-z_]/.test(s)) s = '_' + s;
    return s;
  }

  /** Allocates names unique without regard to case. */
  class NamePool {
    constructor(reserved, parent = null) {
      this.used = new Set();
      this.reserved = reserved;
      this.parent = parent;
    }
    has(lc) {
      return this.used.has(lc) || this.reserved.has(lc) || (this.parent ? this.parent.has(lc) : false);
    }
    take(want) {
      let base = sanitize(want);
      if (/^TA_/i.test(base) || /^Js[A-Z]/.test(base) || /^Op[A-Z]/.test(base)) base = base + '_';
      let name = base;
      let n = 1;
      while (this.has(name.toLowerCase())) name = base + '_' + (++n);
      this.used.add(name.toLowerCase());
      return name;
    }
    claim(name) {
      this.used.add(name.toLowerCase());
    }
  }

  // =====================================================================
  // The framework as the runtime declares it
  // =====================================================================

  const P = (name, type, def = null) => ({ name, type, def });
  const FRAMEWORK = {
    LinkItem: { pas: 'TLinkItem', base: null, fields: { text: 'string', uri: 'string' },
      ctor: [P('text', 'string', "''"), P('uri', 'string', "''")] },
    TestCase: { pas: 'TTestCase', base: 'LinkItem', fields: { input: 'uint8[]', expected: 'uint8[]' }, dynamic: true,
      ctor: [P('input', 'uint8[]'), P('expected', 'uint8[]'), P('description', 'string', "''"), P('uri', 'string', "''")] },
    Vulnerability: { pas: 'TVulnerability', base: 'LinkItem', fields: { description: 'string', mitigation: 'string' },
      ctor: [P('type', 'string'), P('description', 'string', "''"), P('mitigation', 'string', "''"), P('uri', 'string', "''")] },
    AuthResult: { pas: 'TAuthResult', base: null, fields: { Success: 'boolean', Output: 'uint8[]', FailureReason: 'string' },
      ctor: [P('success', 'boolean'), P('output', 'uint8[]', 'null'), P('failureReason', 'string', "''")] },
    KeySize: { pas: 'TKeySize', base: null, fields: { minSize: 'int32', maxSize: 'int32', stepSize: 'int32' },
      ctor: [P('minSize', 'int32'), P('maxSize', 'int32'), P('stepSize', 'int32', '1')] },
    BlockAbsorber: { pas: 'TBlockAbsorber', base: null,
      fields: { _blockSize: 'int32', _held: 'uint8[]', _pending: 'int32', _length: 'uint64' },
      props: { BlockSize: { type: 'int32', get: 'Get_BlockSize' }, Pending: { type: 'int32', get: 'Get_Pending' }, Length: { type: 'uint64', get: 'Get_Length' } },
      methods: { Absorb: { params: [P('data', 'uint8[]')], ret: 'void' }, Reset: { params: [], ret: 'void' } },
      ctor: [P('blockSize', 'int32'), P('processBlock', 'function')] },
    _BitStream: { pas: 'TJsBitStream', base: null,
      fields: { buffer: 'int32', bufferBits: 'int32', byteArray: 'uint8[]', readPosition: 'int32', totalBitsWritten: 'int32' },
      methods: {
        writeBits: { params: [P('value', 'uint32'), P('numBits', 'uint32')], ret: 'void' },
        writeBit: { params: [P('bit', 'uint32')], ret: 'void' },
        writeByte: { params: [P('byte', 'uint32')], ret: 'void' },
        writeBytes: { params: [P('bytes', 'uint8[]')], ret: 'void' },
        writeUint16BE: { params: [P('value', 'uint32')], ret: 'void' },
        writeUint16LE: { params: [P('value', 'uint32')], ret: 'void' },
        writeUint32BE: { params: [P('value', 'uint32')], ret: 'void' },
        writeUint32LE: { params: [P('value', 'uint32')], ret: 'void' },
        readBits: { params: [P('numBits', 'int32')], ret: 'uint32' },
        readBit: { params: [], ret: 'uint32' },
        readByte: { params: [], ret: 'uint8' },
        readBytes: { params: [P('count', 'int32')], ret: 'uint8[]' },
        peekBits: { params: [P('numBits', 'int32')], ret: 'uint32' },
        skipBits: { params: [P('numBits', 'int32')], ret: 'void' },
        hasMoreBits: { params: [], ret: 'boolean' },
        getRemainingBits: { params: [], ret: 'int32' },
        resetReadPosition: { params: [], ret: 'void' },
        seekBits: { params: [P('bitOffset', 'uint32')], ret: 'void' },
        toArray: { params: [P('padLastByte', 'boolean', 'True')], ret: 'uint8[]' },
        getBitLength: { params: [], ret: 'int32' },
        getByteLength: { params: [], ret: 'int32' },
        clear: { params: [], ret: 'void' },
        clone: { params: [], ret: '_BitStream' },
        writeVarInt: { params: [P('value', 'uint32')], ret: 'void' },
        readVarInt: { params: [], ret: 'uint32' },
        writeUnary: { params: [P('value', 'int32')], ret: 'void' },
        readUnary: { params: [], ret: 'int32' },
        alignToByte: { params: [], ret: 'void' },
        isAligned: { params: [], ret: 'boolean' }
      },
      ctor: [P('initialBytes', 'uint8[]', 'null')] },
    MerkleDamgardOptions: { pas: 'TMerkleDamgardOptions', base: null,
      fields: { blockSize: 'int32', padByte: 'int32', lengthBytes: 'int32', lengthLittleEndian: 'boolean', lengthInBits: 'boolean' }, ctor: [] },
    Algorithm: { pas: 'TAlgorithm', base: null,
      fields: { name: 'string', description: 'string', inventor: 'string', year: 'int32', category: 'CategoryType', subCategory: 'string',
        securityStatus: 'SecurityStatus', complexity: 'ComplexityType', country: 'CountryCode', documentation: 'LinkItem[]',
        references: 'LinkItem[]', knownVulnerabilities: 'Vulnerability[]', tests: 'TestCase[]' },
      methods: { CreateInstance: { params: [P('isInverse', 'boolean', 'False')], ret: 'IAlgorithmInstance', virtual: true } },
      ctor: [] },
    CryptoAlgorithm: { pas: 'TCryptoAlgorithm', base: 'Algorithm', ctor: [] },
    SymmetricCipherAlgorithm: { pas: 'TSymmetricCipherAlgorithm', base: 'CryptoAlgorithm', ctor: [] },
    AsymmetricCipherAlgorithm: { pas: 'TAsymmetricCipherAlgorithm', base: 'CryptoAlgorithm', ctor: [] },
    BlockCipherAlgorithm: { pas: 'TBlockCipherAlgorithm', base: 'SymmetricCipherAlgorithm', fields: { SupportedKeySizes: 'KeySize[]', SupportedBlockSizes: 'KeySize[]' }, ctor: [] },
    StreamCipherAlgorithm: { pas: 'TStreamCipherAlgorithm', base: 'SymmetricCipherAlgorithm', ctor: [] },
    EncodingAlgorithm: { pas: 'TEncodingAlgorithm', base: 'Algorithm', ctor: [] },
    CompressionAlgorithm: { pas: 'TCompressionAlgorithm', base: 'Algorithm', ctor: [] },
    ErrorCorrectionAlgorithm: { pas: 'TErrorCorrectionAlgorithm', base: 'Algorithm', ctor: [] },
    HashFunctionAlgorithm: { pas: 'THashFunctionAlgorithm', base: 'Algorithm', fields: { SupportedOutputSizes: 'KeySize[]' }, ctor: [] },
    MacAlgorithm: { pas: 'TMacAlgorithm', base: 'Algorithm', fields: { SupportedMacSizes: 'KeySize[]', NeedsKey: 'boolean' }, ctor: [] },
    KdfAlgorithm: { pas: 'TKdfAlgorithm', base: 'Algorithm', fields: { SupportedOutputSizes: 'KeySize[]', SaltRequired: 'boolean' }, ctor: [] },
    PaddingAlgorithm: { pas: 'TPaddingAlgorithm', base: 'Algorithm', fields: { IsLengthIncluded: 'boolean' }, ctor: [] },
    CipherModeAlgorithm: { pas: 'TCipherModeAlgorithm', base: 'Algorithm', fields: { RequiresIV: 'boolean', SupportedIVSizes: 'KeySize[]' }, ctor: [] },
    AeadAlgorithm: { pas: 'TAeadAlgorithm', base: 'CryptoAlgorithm', fields: { SupportedTagSizes: 'KeySize[]', SupportsDetached: 'boolean' }, ctor: [] },
    RandomGenerationAlgorithm: { pas: 'TRandomGenerationAlgorithm', base: 'Algorithm',
      fields: { IsDeterministic: 'boolean', IsCryptographicallySecure: 'boolean', SupportedSeedSizes: 'KeySize[]' }, ctor: [] },
    IAlgorithmInstance: { pas: 'TIAlgorithmInstance', base: null, fields: { algorithm: 'Algorithm', isInverse: 'boolean', inputBuffer: 'uint8[]' },
      methods: {
        Feed: { params: [P('data', 'uint8[]')], ret: 'void', virtual: true },
        Result: { pas: 'Result_', params: [], ret: 'uint8[]', virtual: true },
        Dispose: { params: [], ret: 'void', virtual: true }
      },
      ctor: [P('algorithm', 'Algorithm')] },
    IBlockCipherInstance: { pas: 'TIBlockCipherInstance', base: 'IAlgorithmInstance', fields: { BlockSize: 'int32', KeySize: 'int32', _key: 'uint8[]' },
      props: { key: { type: 'uint8[]', get: 'Get_key', set: 'Set_key', virtual: true } },
      methods: {
        EncryptBlock: { params: [P('block', 'uint8[]')], ret: 'uint8[]', virtual: true },
        DecryptBlock: { params: [P('block', 'uint8[]')], ret: 'uint8[]', virtual: true },
        RequireBlockMultiple: { params: [P('blockSize', 'int32', '0')], ret: 'int32', virtual: true }
      },
      ctor: [P('algorithm', 'Algorithm')] },
    IHashFunctionInstance: { pas: 'TIHashFunctionInstance', base: 'IAlgorithmInstance', fields: { OutputSize: 'int32' }, ctor: [P('algorithm', 'Algorithm')] },
    IMacInstance: { pas: 'TIMacInstance', base: 'IAlgorithmInstance',
      methods: { ComputeMac: { params: [P('data', 'uint8[]')], ret: 'uint8[]', virtual: true } }, ctor: [P('algorithm', 'Algorithm')] },
    IKdfInstance: { pas: 'TIKdfInstance', base: 'IAlgorithmInstance', fields: { OutputSize: 'int32', Iterations: 'int32' }, ctor: [P('algorithm', 'Algorithm')] },
    IAeadInstance: { pas: 'TIAeadInstance', base: 'IAlgorithmInstance', fields: { aad: 'uint8[]', tagSize: 'int32' }, ctor: [P('algorithm', 'Algorithm')] },
    IErrorCorrectionInstance: { pas: 'TIErrorCorrectionInstance', base: 'IAlgorithmInstance',
      methods: { DetectError: { params: [P('data', 'uint8[]')], ret: 'boolean', virtual: true } }, ctor: [P('algorithm', 'Algorithm')] },
    IRandomGeneratorInstance: { pas: 'TIRandomGeneratorInstance', base: 'IAlgorithmInstance',
      methods: { NextBytes: { params: [P('count', 'int32')], ret: 'uint8[]', virtual: true } }, ctor: [P('algorithm', 'Algorithm')] }
  };

  /** Algorithm metadata fields: descriptive, never read back by the Feed/Result contract. */
  const METADATA_FIELDS = new Set(['documentation', 'references', 'knownVulnerabilities', 'SupportedKeySizes', 'SupportedBlockSizes',
    'SupportedOutputSizes', 'SupportedMacSizes', 'SupportedIVSizes', 'SupportedTagSizes', 'SupportedSeedSizes', 'category', 'subCategory',
    'securityStatus', 'complexity', 'country', 'inventor', 'year', 'description']);

  /** Array aliases the runtime already declares (element type key -> alias). */
  const RUNTIME_ALIASES = {
    'uint8[]': 'TA_U8', 'int8[]': 'TA_I8', 'uint16[]': 'TA_U16', 'int16[]': 'TA_I16', 'uint32[]': 'TA_U32', 'int32[]': 'TA_I32',
    'uint64[]': 'TA_U64', 'int64[]': 'TA_I64', 'float32[]': 'TA_F32', 'float64[]': 'TA_F64', 'boolean[]': 'TA_Bool',
    'string[]': 'TA_Str', 'bigint[]': 'TA_Big', 'uint8[][]': 'TA_A_U8', 'uint16[][]': 'TA_A_U16', 'uint32[][]': 'TA_A_U32',
    'int32[][]': 'TA_A_I32', 'uint64[][]': 'TA_A_U64',
    'class:LinkItem[]': 'TA_LinkItem', 'class:TestCase[]': 'TA_TestCase', 'class:Vulnerability[]': 'TA_Vulnerability',
    'class:KeySize[]': 'TA_KeySize', 'class:Algorithm[]': 'TA_Algorithm'
  };
  /** JsValTo_* converters and JsVArr_* constructors the runtime declares. */
  const RUNTIME_VALUE_CONVERTERS = new Set(['TA_U8', 'TA_I8', 'TA_U16', 'TA_I16', 'TA_U32', 'TA_I32', 'TA_U64', 'TA_I64', 'TA_F64', 'TA_Str', 'TA_Big', 'TA_Bool']);

  /** OpCodes calls the IL leaves as calls: runtime routine, parameter and result types. */
  const OPCODES = {
    GetByte: ['OpGetByte', ['uint32', 'int32'], 'uint8'],
    GF256Mul: ['OpGF256Mul', ['uint32', 'uint32'], 'uint8'],
    RotL64n: ['OpRotL64n', ['bigint', 'int32'], 'bigint'],
    RotR64n: ['OpRotR64n', ['bigint', 'int32'], 'bigint'],
    RotL128n: ['OpRotL128n', ['bigint', 'int32'], 'bigint'],
    RotR128n: ['OpRotR128n', ['bigint', 'int32'], 'bigint'],
    Hex32ToDWords: ['OpHex32ToDWords', ['string'], 'uint32[]'],
    Hex16ToWords: ['OpHex16ToWords', ['string'], 'uint16[]'],
    Hex4ToBytes: ['OpHex4ToBytes', ['string'], 'uint8[]'],
    Hex8ToBytes: ['OpHex8ToBytes', ['string'], 'uint8[]'],
    SetBit: ['OpSetBit', ['uint32', 'int32', 'boolean'], 'uint32'],
    GetBit: ['OpGetBit', ['uint32', 'int32'], 'boolean'],
    SecureCompare: ['OpSecureCompare', ['uint8[]', 'uint8[]'], 'boolean'],
    ConstantTimeCompare: ['OpConstantTimeCompare', ['uint8[]', 'uint8[]', 'int32'], 'boolean'],
    ArraysEqual: ['OpArraysEqual', ['uint8[]', 'uint8[]'], 'boolean'],
    BytesToChars: ['OpBytesToChars', ['uint8[]'], 'string'],
    BytesToAnsi: ['OpBytesToAnsi', ['uint8[]'], 'string'],
    BitMask: ['OpBitMask', ['int32'], 'uint32'],
    Shr32Signed: ['OpShr32Signed', ['int32', 'int32'], 'int32'],
    SecureRandomBytes: ['OpSecureRandomBytes', ['int32'], 'uint8[]'],
    MulHi32: ['OpMulHi32', ['uint32', 'uint32'], 'uint32'],
    GFMul: ['OpGFMul', ['uint32', 'uint32', 'uint32', 'int32'], 'uint32'],
    PopCount: ['OpPopCount', ['uint32'], 'int32'],
    PopCountFast: ['OpPopCount', ['uint32'], 'int32'],
    AddMod: ['OpAddMod', ['int32', 'int32', 'int32'], 'int32'],
    SubMod: ['OpSubMod', ['int32', 'int32', 'int32'], 'int32'],
    Words32ToBytesBE: ['OpWords32ToBytesBE', ['uint32[]'], 'uint8[]'],
    BytesToWords32BE: ['OpBytesToWords32BE', ['uint8[]'], 'uint32[]'],
    EncodeMsgLength64LE: ['OpEncodeMsgLength64LE', ['uint64'], 'uint8[]'],
    GHashMul: ['OpGHashMul', ['uint8[]', 'uint8[]'], 'uint8[]'],
    GCMIncrement: ['OpGCMIncrement', ['uint8[]'], 'uint8[]'],
    Add3L64: ['OpAdd3L64', ['uint32', 'uint32', 'uint32'], 'uint64'],
    Add3H64: ['OpAdd3H64', ['uint64', 'uint32', 'uint32', 'uint32'], 'int32'],
    CreateUint64ArrayFromHex: ['OpCreateUint64ArrayFromHex', ['string[]'], 'uint32[][]'],
    ToLong: ['OpToLong', ['bigint'], 'bigint'],
    ToShort: ['OpToShort', ['int32'], 'int16'],
    GetBitN: ['OpGetBitN', ['bigint', 'int32'], 'bigint'],
    MulModN: ['OpMulModN', ['bigint', 'bigint', 'bigint'], 'bigint'],
    SquareModN: ['OpSquareModN', ['bigint', 'bigint'], 'bigint'],
    ModPowN: ['OpModPowN', ['bigint', 'bigint', 'bigint'], 'bigint'],
    GcdN: ['OpGcdN', ['bigint', 'bigint'], 'bigint'],
    ModN: ['OpModN', ['bigint', 'bigint'], 'bigint'],
    ModInverseN: ['OpModInverseN', ['bigint', 'bigint'], 'bigint'],
    BitCountN: ['OpBitCountN', ['bigint'], 'int32'],
    XorArrayWithByte: ['OpXorArrayWithByte', ['uint8[]', 'uint32'], 'uint8[]'],
    AnsiToBytes: ['OpAnsiToBytes', ['string'], 'uint8[]'],
    AsciiToBytes: ['OpAsciiToBytes', ['string'], 'uint8[]'],
    Utf8ToBytes: ['OpUtf8ToBytes', ['string'], 'uint8[]'],
    RotL32: ['OpRotL32', ['uint32', 'int32'], 'uint32'],
    RotR32: ['OpRotR32', ['uint32', 'int32'], 'uint32'],
    RotL64: null, RotR64: null,
    Pack32BE: ['OpPack32BE', ['uint32', 'uint32', 'uint32', 'uint32'], 'uint32'],
    Pack32LE: ['OpPack32LE', ['uint32', 'uint32', 'uint32', 'uint32'], 'uint32'],
    Pack16BE: ['OpPack16BE', ['uint32', 'uint32'], 'uint16'],
    Pack16LE: ['OpPack16LE', ['uint32', 'uint32'], 'uint16'],
    Unpack32BE: ['OpUnpack32BE', ['uint32'], 'uint8[]'],
    Unpack32LE: ['OpUnpack32LE', ['uint32'], 'uint8[]'],
    XorArrays: ['OpXorArrays', ['uint8[]', 'uint8[]'], 'uint8[]']
  };

  /** Runtime routines for Pack/Unpack/rotation IL nodes, by bits. */
  const ROT = { 8: ['OpRotL8', 'OpRotR8', 'uint8'], 16: ['OpRotL16', 'OpRotR16', 'uint16'], 32: ['OpRotL32', 'OpRotR32', 'uint32'], 64: ['OpRotL64', 'OpRotR64', 'uint64'] };

  // =====================================================================
  // Errors
  // =====================================================================

  class TranspileError extends Error {
    constructor(message, node) {
      super(message);
      this.node = node;
    }
  }
  const fail = (message, node) => { throw new TranspileError(message, node); };

  // =====================================================================
  // Literals
  // =====================================================================

  /** A string as Pascal source: quoted runs and #$XXXX for the rest, chunked. */
  function pasString(s) {
    s = String(s);
    if (s.length === 0) return "''";
    const pieces = [];
    let cur = '';
    let inQuote = false;
    let count = 0;
    const flush = () => {
      if (inQuote) { cur += "'"; inQuote = false; }
      if (cur) pieces.push(cur);
      cur = ''; count = 0;
    };
    for (let i = 0; i < s.length; ++i) {
      const c = s.charCodeAt(i);
      if (c >= 32 && c < 127) {
        if (!inQuote) { cur += "'"; inQuote = true; }
        cur += c === 39 ? "''" : s[i];
      } else {
        if (inQuote) { cur += "'"; inQuote = false; }
        cur += '#$' + c.toString(16).toUpperCase().padStart(4, '0');
      }
      if (++count >= 120) flush();
    }
    flush();
    return pieces.join(' + ');
  }

  function isIdentifier(node, name) {
    return node && node.type === 'Identifier' && (name === undefined || node.name === name);
  }

  // =====================================================================
  // The transformer
  // =====================================================================

  class DelphiTransformer {
    constructor(options = {}) {
      this.options = options;
      this.unitName = sanitize(options.unitName || 'GeneratedUnit');
    }

    // ------------------------------------------------------------ entry

    /**
     * Transform an IL program into a DelphiAST unit.
     * @param {object} program - IL AST (Program)
     * @returns {object} DelphiAST unit
     */
    transform(program) {
      this.reset();
      this.importLibraries(this.options.libraries || []);
      const body = this.unwrapModule((program && program.body) || []);
      this.collectTopLevel(body);
      this.buildClasses();
      this.assignNames();
      this.declareGlobals();
      this.transformClassBodies();
      this.transformGlobalFunctions();
      this.transformInitialization();
      return this.assembleUnit();
    }

    reset() {
      const em = emitterModule();
      const runtime = em.runtimeIdentifiers ? em.runtimeIdentifiers() : new Set();
      this.reserved = new Set([...PASCAL_KEYWORDS, ...PASCAL_BUILTINS, ...runtime, this.unitName.toLowerCase()]);
      this.globalPool = new NamePool(this.reserved);
      this.globalIdents = new Set();
      this.localParent = { has: lc => this.globalIdents.has(lc) };
      this.classes = new Map();          // jsName -> class info (user and framework)
      this.userClasses = [];             // in declaration order
      this.functions = new Map();        // jsName -> global function info
      this.globals = new Map();          // jsName -> global var info
      this.topStatements = [];           // IL statements run at unit initialization
      this.aliases = new Map();          // type key -> { name, decl }
      this.records = new Map();          // type key -> { name, fields }
      this.procTypes = new Map();        // signature key -> name
      this.consts = [];
      this.globalVarDecls = [];
      this.routines = [];
      this.forwards = [];
      this.initialization = [];
      this.bigLiterals = new Map();
      this.converters = new Map();       // generated JsValTo_/JsVArr_/array conversion routines
      this.constTables = 0;
      this.lambdaCount = 0;
      this.labelCount = 0;
      this.pre = null;
      this.fn = null;
      this.diagnostics = [];
      this.libraries = new Map();        // factory parameter -> library unit info
      this.libraryAliases = new Map();   // top-level alias of a library namespace
      this.libraryImports = new Map();   // name destructured from a library -> { lib, name }
      this.usesUnits = [];
      for (const [name, def] of Object.entries(FRAMEWORK)) this.classes.set(name, this.frameworkClass(name, def));
      for (const c of this.classes.values()) if (c.baseName) c.base = this.classes.get(c.baseName);
    }

    frameworkClass(jsName, def) {
      const info = { jsName, pas: def.pas, isFramework: true, baseName: def.base, base: null, members: new Map(),
        dynamic: !!def.dynamic, ctorParams: (def.ctor || []).map(p => ({ jsName: p.name, pas: p.name, type: parseType(p.type), defText: p.def })) };
      for (const [name, type] of Object.entries(def.fields || {}))
        info.members.set(name, { kind: 'field', jsName: name, pas: name, type: parseType(type), owner: info });
      for (const [name, p] of Object.entries(def.props || {}))
        info.members.set(name, { kind: 'prop', jsName: name, pas: name, type: parseType(p.type), getter: p.get || null, setter: p.set || null, owner: info, virtual: !!p.virtual });
      for (const [name, m] of Object.entries(def.methods || {}))
        info.members.set(name, { kind: 'method', jsName: name, pas: m.pas || name, owner: info, virtual: !!m.virtual,
          params: m.params.map(p => ({ jsName: p.name, pas: p.name, type: parseType(p.type), defText: p.def })), ret: parseType(m.ret) });
      return info;
    }

    // ------------------------------------------------------------ collection

    /**
     * A library written as (function () { ... }).call(this) runs its body at
     * the top level.
     */
    unwrapModule(body) {
      if (body.length === 1 && body[0].type === 'ExpressionStatement') {
        const e = body[0].expression;
        const fn = e && e.type === 'CallExpression' && e.callee && e.callee.type === 'MemberExpression' && !e.callee.computed &&
          (e.callee.property.name === 'call' || e.callee.property.name === 'apply') ? e.callee.object : null;
        if (fn && (fn.type === 'FunctionExpression' || fn.type === 'ArrowFunction') && fn.body && fn.body.type === 'BlockStatement' && fn.params.length === 0)
          return fn.body.body;
      }
      return body;
    }

    /**
     * The .data libraries the file receives as factory parameters: each is a
     * unit of its own, whose names this unit uses qualified by that unit.
     * @param {object[]} libraries - [{ param, unit, ast }]
     */
    importLibraries(libraries) {
      for (const lib of libraries) {
        const sub = new DelphiTransformer({ unitName: lib.unit, library: true, runtimeUnit: this.options.runtimeUnit });
        sub.transform(lib.ast);
        const info = { param: lib.param, unit: sub.unitName, functions: sub.functions, globals: sub.globals, classes: new Map() };
        for (const c of sub.userClasses) {
          const imported = Object.assign({}, c, { pas: sub.unitName + '.' + c.pas, isFramework: true, imported: true });
          info.classes.set(c.jsName, imported);
          if (!this.classes.has(c.jsName)) this.classes.set(c.jsName, imported);
        }
        for (const c of info.classes.values()) if (c.base && info.classes.has(c.base.jsName)) c.base = info.classes.get(c.base.jsName);
        this.libraries.set(lib.param, info);
        this.usesUnits.push(sub.unitName);
      }
    }

    /** The library a name stands for: a factory parameter or a top-level alias of one. */
    libraryOf(name) {
      if (this.lookup && this.fn && this.lookup(name)) return null;
      return this.libraries.get(name) || this.libraryAliases.get(name) || null;
    }

    /** A member of a library namespace as an expression: its function, variable or class. */
    libraryMember(lib, name, node) {
      if (lib.globals.has(name)) {
        const g = lib.globals.get(name);
        return { e: A.mem(A.id(lib.unit), g.pas), t: g.type, lvalue: true };
      }
      if (lib.functions.has(name)) {
        const f = lib.functions.get(name);
        return { e: A.mem(A.id(lib.unit), f.pas), t: T.fn, globalFn: Object.assign({}, f, { pas: lib.unit + '.' + f.pas }) };
      }
      if (lib.classes.has(name)) return { e: A.id(lib.classes.get(name).pas), t: T.any, classRef: lib.classes.get(name) };
      fail(`library ${lib.param} has no member ${name}`, node);
    }

    collectTopLevel(body) {
      for (const node of body) {
        if (!node) continue;
        // const { A, B } = Library; const Alias = Library;
        if (node.type === 'VariableDeclaration' && node.declarations.every(d => d.init && d.init.type === 'Identifier' && this.libraries.has(d.init.name))) {
          for (const d of node.declarations) {
            const lib = this.libraries.get(d.init.name);
            if (d.id.type === 'Identifier') this.libraryAliases.set(d.id.name, lib);
            else if (d.id.type === 'ObjectPattern')
              for (const p of d.id.properties) {
                const key = p.key && (p.key.name || p.key.value);
                const local = p.value && p.value.name || key;
                this.libraryImports.set(local, { lib, name: key });
              }
          }
          continue;
        }
        // const { TestCase, ... } = AlgorithmFramework (the IL reads it into a
        // temporary, then each name from it): the runtime declares those names
        if (node.type === 'VariableDeclaration' && node.declarations.length && isIdentifier(node.declarations[0].init, 'AlgorithmFramework')) {
          const temp = node.declarations[0].id && node.declarations[0].id.name;
          if (node.declarations.slice(1).every(d => d.init && d.init.type === 'MemberExpression' && isIdentifier(d.init.object, temp))) continue;
        }
        switch (node.type) {
          case 'ClassDeclaration':
            this.addUserClass(node);
            break;
          case 'FunctionDeclaration':
            if (node.id) this.functions.set(node.id.name, { jsName: node.id.name, node, pas: null });
            break;
          case 'VariableDeclaration':
            for (const d of node.declarations) {
              if (!d.id || d.id.type !== 'Identifier') { this.topStatements.push({ type: 'VariableDeclaration', kind: node.kind, declarations: [d] }); continue; }
              const init = d.init;
              if (init && (init.type === 'FunctionExpression' || init.type === 'ArrowFunction' || init.type === 'ArrowFunctionExpression')) {
                this.functions.set(d.id.name, { jsName: d.id.name, node: init, pas: null });
                continue;
              }
              if (init && init.type === 'ClassExpression') { this.addUserClass(Object.assign({}, init, { id: d.id })); continue; }
              this.globals.set(d.id.name, { jsName: d.id.name, node: d, type: null, pas: null });
              this.topStatements.push({ type: 'VariableDeclaration', kind: node.kind, declarations: [d], isGlobalInit: true });
            }
            break;
          case 'EmptyStatement':
            break;
          default:
            this.topStatements.push(node);
        }
      }
    }

    addUserClass(node) {
      const name = node.id.name;
      // extends Foo, or extends AlgorithmFramework.Foo
      const sc = node.superClass;
      const baseName = !sc ? null : sc.type === 'Identifier' ? sc.name
        : sc.type === 'MemberExpression' && !sc.computed ? (sc.property.name || sc.property.value) : null;
      const info = { jsName: name, pas: null, isFramework: false, node, baseName,
        base: null, members: new Map(), subclasses: [], ctorNode: null, ctorParams: [], staticInits: [], fieldVotes: new Map(),
        lambdas: [] };
      this.classes.set(name, info);
      this.userClasses.push(info);
    }

    // ------------------------------------------------------------ classes

    buildClasses() {
      for (const c of this.userClasses) {
        if (c.baseName) {
          c.base = this.classes.get(c.baseName) || null;
          if (!c.base) { this.diagnostics.push(`class ${c.jsName} extends unknown class ${c.baseName}`); continue; }
          if (!c.base.isFramework) c.base.subclasses.push(c);
        }
      }
      // ancestors before descendants
      const ordered = [];
      const seen = new Set();
      const visit = c => {
        if (seen.has(c)) return;
        seen.add(c);
        if (c.base && !c.base.isFramework) visit(c.base);
        ordered.push(c);
      };
      this.userClasses.forEach(visit);
      this.userClasses = ordered;

      for (const c of this.userClasses) this.declareMembers(c);
      for (const c of this.userClasses) this.collectFieldUses(c);
      for (const c of this.userClasses) this.settleFields(c);
    }

    /** Methods, accessors, constructor and static fields of a user class. */
    declareMembers(c) {
      for (const m of (c.node.body && c.node.body.body) || []) {
        if (m.type === 'MethodDefinition') {
          const name = m.key && (m.key.name || m.key.value);
          if (m.kind === 'constructor') {
            c.ctorNode = m.value;
            continue;
          }
          if (m.kind === 'get' || m.kind === 'set') {
            let prop = c.members.get(name);
            if (!prop || prop.kind !== 'prop') {
              prop = { kind: 'prop', jsName: name, pas: null, type: null, getNode: null, setNode: null, owner: c, static: !!m.static };
              c.members.set(name, prop);
            }
            if (m.kind === 'get') prop.getNode = m.value; else prop.setNode = m.value;
            continue;
          }
          c.members.set(name, { kind: 'method', jsName: name, pas: null, node: m.value, owner: c, static: !!m.static,
            params: null, ret: null, virtual: !m.static });
        } else if (m.type === 'FieldDefinition' || m.type === 'PropertyDefinition') {
          const name = m.key && (m.key.name || m.key.value);
          if (m.static) c.staticInits.push(m);
          const f = { kind: 'field', jsName: name, pas: null, type: null, owner: c, static: !!m.static, initNode: m.value };
          c.members.set(name, f);
          if (m.value && m.value.resultType) this.vote(c, name, m.value.resultType, !!m.static);
        } else if (m.type === 'StaticBlock') {
          c.staticInits.push(m);
        }
      }
    }

    vote(c, name, type, isStatic) {
      const t = parseType(type);
      if (!t || isNullT(t)) return;
      const key = (isStatic ? 'static:' : '') + name;
      if (!c.fieldVotes.has(key)) c.fieldVotes.set(key, new Map());
      const votes = c.fieldVotes.get(key);
      const strength = isAnyT(t) || t.k === 'function' ? 0 : 1;
      const cur = votes.get(t.key) || { t, n: 0, strength };
      cur.n += 1;
      votes.set(t.key, cur);
    }

    /** Every `this.X` of a class's own code, with the types the IL gives it. */
    collectFieldUses(c) {
      const visit = (node, inArrowOrMethod) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(n => visit(n, inArrowOrMethod)); return; }
        if (node.type === 'ClassDeclaration') return;
        if (node.type === 'FunctionExpression' && !inArrowOrMethod) return;
        if (node.type === 'AssignmentExpression' && node.left && node.left.type === 'ThisPropertyAccess' && !node.left.computed) {
          const name = node.left.property;
          this.noteThisUse(c, name);
          this.vote(c, name, node.left.resultType || node.left.declaredType || node.declaredType || (node.operator === '=' && node.right ? node.right.resultType : null), false);
        } else if (node.type === 'ThisPropertyAccess' && !node.computed) {
          this.noteThisUse(c, node.property);
          if (node.resultType) this.vote(c, node.property, node.resultType, false);
        } else if (node.type === 'AssignmentExpression' && node.left && node.left.type === 'MemberExpression' && !node.left.computed &&
                   isIdentifier(node.left.object, c.jsName)) {
          const name = node.left.property.name || node.left.property.value;
          this.noteStaticUse(c, name);
          this.vote(c, name, node.left.resultType || node.right.resultType, true);
        } else if (node.type === 'MemberExpression' && !node.computed && isIdentifier(node.object, c.jsName)) {
          const name = node.property.name || node.property.value;
          this.noteStaticUse(c, name);
          if (node.resultType) this.vote(c, name, node.resultType, true);
        }
        for (const k in node) {
          if (k === 'typeInfo' || k === 'leadingComments' || k === 'range' || k === 'loc') continue;
          const v = node[k];
          if (v && typeof v === 'object') visit(v, node.type === 'FunctionExpression' && k === 'body' ? false : true);
        }
      };
      for (const m of (c.node.body && c.node.body.body) || []) {
        if (m.type === 'MethodDefinition' && m.value) visit(m.value.body, true);
        else if (m.value) visit(m.value, true);
      }
      // static assignments at the top level: Foo.X = ...
      for (const s of this.topStatements) visit(s, true);
    }

    noteThisUse(c, name) {
      if (!c.thisUses) c.thisUses = new Set();
      c.thisUses.add(name);
    }

    noteStaticUse(c, name) {
      if (!c.staticUses) c.staticUses = new Set();
      c.staticUses.add(name);
    }

    findMember(c, name) {
      for (let k = c; k; k = k.base) {
        const m = k.members.get(name);
        if (m) return m;
      }
      return null;
    }

    /** The field set of a class: every this.X no ancestor or own member already declares. */
    settleFields(c) {
      for (const name of c.thisUses || []) {
        const existing = this.findMember(c, name);
        if (existing) {
          if (existing.kind === 'field' && !existing.type && existing.owner === c) existing.type = this.votedType(c, name, false);
          continue;
        }
        // a field first used in a base class is declared there
        c.members.set(name, { kind: 'field', jsName: name, pas: null, type: this.votedType(c, name, false), owner: c, static: false });
      }
      for (const name of c.staticUses || []) {
        const existing = c.members.get(name);
        if (existing) {
          if (existing.kind === 'field' && !existing.type) existing.type = this.votedType(c, name, true);
          continue;
        }
        c.members.set(name, { kind: 'field', jsName: name, pas: null, type: this.votedType(c, name, true), owner: c, static: true });
      }
      for (const m of c.members.values())
        if (m.kind === 'field' && !m.type) m.type = this.votedType(c, m.jsName, !!m.static);
    }

    votedType(c, name, isStatic) {
      // votes from this class and its user subclasses (a base-class field set in a subclass)
      const all = new Map();
      const gather = k => {
        const votes = k.fieldVotes.get((isStatic ? 'static:' : '') + name);
        if (votes) for (const [key, v] of votes) {
          const cur = all.get(key) || { t: v.t, n: 0, strength: v.strength };
          cur.n += v.n;
          all.set(key, cur);
        }
        if (!isStatic) for (const s of k.subclasses) if (!s.members.has(name)) gather(s);
      };
      gather(c);
      let best = null;
      for (const v of all.values())
        if (!best || v.strength > best.strength || (v.strength === best.strength && v.n > best.n)) best = v;
      return best ? best.t : T.any;
    }

    // ------------------------------------------------------------ signatures

    /** Parameters of an IL function node: [{ jsName, type, defaultNode, rest }]. */
    paramsOf(fnNode) {
      return (fnNode.params || []).map((p, i) => {
        if (typeof p === 'string') return { jsName: p, type: T.any };
        if (p.type === 'DefaultParameter' || p.type === 'AssignmentPattern' || (p.type === 'AssignmentExpression' && p.left)) {
          const left = p.left || p;
          return { jsName: p.name || left.name, type: parseType(left.resultType || p.resultType) || T.any, defaultNode: p.defaultValue || p.right };
        }
        if (p.type === 'RestElement' || p.type === 'RestParameter') {
          const arg = p.argument || p;
          return { jsName: arg.name || p.name || ('rest' + i), type: parseType(arg.resultType || p.resultType) || tArr(T.any), rest: true };
        }
        return { jsName: p.name || ('arg' + i), type: parseType(p.resultType) || T.any, defaultNode: p.defaultValue || null };
      });
    }

    /** The return type of a function node, from its returns' contextual types, its JSDoc, or what it returns. */
    returnTypeOf(fnNode) {
      if (!fnNode) return T.void;
      const declared = parseType(fnNode.declaredReturnType);
      const returns = [];
      const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (['FunctionExpression', 'FunctionDeclaration', 'ArrowFunction', 'ArrowFunctionExpression', 'ClassDeclaration'].includes(node.type)) return;
        if (node.type === 'ReturnStatement') { if (node.argument) returns.push(node.argument); return; }
        for (const k in node) {
          if (k === 'typeInfo' || k === 'range' || k === 'loc') continue;
          const v = node[k];
          if (v && typeof v === 'object') visit(v);
        }
      };
      if (fnNode.body && fnNode.body.type !== 'BlockStatement') {
        const t = parseType(fnNode.body.contextType) || declared || parseType(fnNode.body.resultType);
        if (t) return t;
        // an untyped expression body still yields its value (`(_, i) => i`);
        // a call or assignment body may be there for its effect only
        const forEffect = ['CallExpression', 'AssignmentExpression', 'UpdateExpression'].includes(fnNode.body.type);
        return forEffect ? T.void : T.any;
      }
      visit(fnNode.body);
      if (returns.length === 0) {
        // a body that only throws (an abstract method) still has the declared result its overrides return
        const doc = declared || (fnNode.typeInfo && parseType(jsDocTypeName(fnNode.typeInfo.returns)));
        return doc && !isNullT(doc) && !isAnyT(doc) ? doc : T.void;
      }
      for (const r of returns) {
        const t = parseType(r.contextType);
        if (t && !isNullT(t) && !isAnyT(t)) return t;
      }
      if (declared && !isNullT(declared)) return declared;
      const fromDoc = fnNode.typeInfo && parseType(jsDocTypeName(fnNode.typeInfo.returns));
      if (fromDoc && !isNullT(fromDoc) && !isAnyT(fromDoc)) return fromDoc;
      let best = null;
      for (const r of returns) {
        const t = parseType(r.resultType);
        if (t && !isNullT(t)) { if (!best || (isAnyT(best) && !isAnyT(t))) best = t; }
      }
      return best || T.any;
    }

    // ------------------------------------------------------------ naming

    assignNames() {
      // classes
      for (const c of this.userClasses) { c.pas = this.globalPool.take('T' + c.jsName); this.globalIdents.add(c.pas.toLowerCase()); }
      for (const c of this.classes.values()) if (c.isFramework) this.reserved.add(c.pas.toLowerCase());
      // members, ancestors first
      for (const c of this.userClasses) this.nameMembers(c);
      // every member name is off limits to globals, which methods reference unqualified
      for (const c of this.userClasses) for (const lc of c.memberPool.used) this.globalPool.claim(lc);
      for (const c of this.classes.values()) if (c.isFramework) for (const m of c.members.values()) {
        this.globalPool.claim(m.pas.toLowerCase());
        if (m.getter) this.globalPool.claim(m.getter.toLowerCase());
        if (m.setter) this.globalPool.claim(m.setter.toLowerCase());
      }
      for (const f of this.functions.values()) { f.pas = this.globalPool.take(f.jsName); this.globalIdents.add(f.pas.toLowerCase()); }
      for (const g of this.globals.values()) { g.pas = this.globalPool.take(g.jsName); this.globalIdents.add(g.pas.toLowerCase()); }
    }

    memberPoolOf(c) {
      if (c.isFramework) {
        if (!c.memberPool) {
          const pool = new NamePool(this.reserved, c.base ? this.memberPoolOf(c.base) : null);
          for (const m of c.members.values()) {
            pool.claim(m.pas);
            if (m.getter) pool.claim(m.getter);
            if (m.setter) pool.claim(m.setter);
          }
          for (const extra of ['Create', 'JsSetMember', 'JsHasMember', 'JsCallMethod', 'JsHasMethod', 'FinishHeld', 'Fields', 'HasField', 'GetField', 'SetField'])
            pool.claim(extra);
          c.memberPool = pool;
        }
        return c.memberPool;
      }
      return c.memberPool;
    }

    nameMembers(c) {
      const basePool = c.base ? this.memberPoolOf(c.base) : null;
      c.memberPool = new NamePool(this.reserved, basePool);
      // user class names are global types: members must not hide them
      for (const k of this.userClasses) c.memberPool.claim(k.pas);
      const methods = [...c.members.values()];
      for (const m of methods) {
        const inherited = c.base ? this.findMember(c.base, m.jsName) : null;
        if (inherited && !m.static && inherited.kind === m.kind) {
          m.pas = inherited.pas;
          m.overrides = inherited;
          if (m.kind === 'prop') { m.getterPas = inherited.getter || inherited.getterPas; m.setterPas = inherited.setter || inherited.setterPas; }
          continue;
        }
        if (inherited && !m.static && inherited.kind !== m.kind)
          this.diagnostics.push(`${c.jsName}.${m.jsName} is a ${m.kind} where ${inherited.owner.jsName} has a ${inherited.kind}`);
        m.pas = c.memberPool.take(m.jsName === 'Result' ? 'Result_' : m.jsName);
        if (m.kind === 'prop') {
          m.getterPas = m.getNode ? c.memberPool.take('Get_' + m.pas) : null;
          m.setterPas = m.setNode ? c.memberPool.take('Set_' + m.pas) : null;
        }
      }
      for (const m of methods) if (m.kind === 'prop' && m.overrides) {
        // an accessor the base lacks gets a name of its own
        if (m.getNode && !m.getterPas) m.getterPas = c.memberPool.take('Get_' + m.pas);
        if (m.setNode && !m.setterPas) m.setterPas = c.memberPool.take('Set_' + m.pas);
      }
    }

    // ------------------------------------------------------------ globals

    declareGlobals() {
      // method signatures (need every class named)
      for (const c of this.userClasses) {
        for (const m of c.members.values()) {
          if (m.kind === 'method') {
            const own = this.paramsOf(m.node);
            m.ownParams = own;
            m.ownRet = this.returnTypeOf(m.node);
            if (m.overrides) {
              m.params = m.overrides.params;
              m.ret = m.overrides.ret;
              m.virtual = false;
            } else {
              m.params = own.map(p => ({ jsName: p.jsName, pas: null, type: p.type, defaultNode: p.defaultNode, rest: p.rest }));
              m.ret = m.ownRet;
            }
          } else if (m.kind === 'prop') {
            const getT = m.getNode ? this.returnTypeOf(m.getNode) : null;
            const setP = m.setNode ? this.paramsOf(m.setNode)[0] : null;
            if (m.overrides) m.type = m.overrides.type;
            else if (getT && setP && !isAnyT(getT) && !isNullT(getT) && getT.key !== setP.type.key) m.type = T.any;  // accepts one type, returns another
            else m.type = getT && !isAnyT(getT) && !isNullT(getT) ? getT : (setP ? setP.type : getT || T.any);
          }
        }
        // constructor
        if (c.ctorNode) c.ctorParams = this.paramsOf(c.ctorNode).map(p => ({ jsName: p.jsName, type: p.type, defaultNode: p.defaultNode, rest: p.rest }));
        else c.ctorParams = null;  // inherits the base constructor
      }
      // methods called on a base class but defined in a subclass are declared virtual in the base
      for (const f of this.functions.values()) {
        f.params = this.paramsOf(f.node);
        f.ret = this.returnTypeOf(f.node);
      }
      for (const g of this.globals.values()) {
        const d = g.node;
        g.type = parseType(d.declaredType) || parseType(d.id.resultType) || (d.init && parseType(d.init.resultType)) || T.any;
        if (isNullT(g.type)) g.type = T.any;
      }
    }

    /** Effective constructor parameters of a class (its own or the nearest ancestor's). */
    ctorParamsOf(c) {
      for (let k = c; k; k = k.base) {
        if (k.isFramework) return k.ctorParams;
        if (k.ctorParams) return k.ctorParams;
      }
      return [];
    }

    // =====================================================================
    // Type names
    // =====================================================================

    /** The Pascal type of an IL type. */
    pasType(t) {
      if (!t) return 'TJsValue';
      switch (t.k) {
        case 'int': return t.pas;
        case 'float': return t.bits === 32 ? 'Single' : 'Double';
        case 'bool': return 'Boolean';
        case 'string': return 'string';
        case 'bigint': return 'TBigInt';
        case 'enum': return 'string';
        case 'array': return this.aliasOf(t);
        case 'class': return this.classPas(t.name);
        case 'error': return 'Exception';
        case 'tuple': case 'record': return this.recordOf(t);
        case 'null': return 'TObject';
        case 'void': return 'TJsValue';
        case 'function': return 'TJsValue';
        case 'map': return 'TJsMap';
        default: return 'TJsValue';
      }
    }

    classPas(name) {
      const c = this.classes.get(name);
      if (c) return c.pas;
      return 'TJsObject';
    }

    elemCode(t) {
      switch (t.k) {
        case 'int': return t.code;
        case 'float': return t.bits === 32 ? 'F32' : 'F64';
        case 'bool': return 'Bool';
        case 'string': case 'enum': return 'Str';
        case 'bigint': return 'Big';
        case 'array': return 'A_' + this.elemCode(t.elem);
        case 'class': return this.classPas(t.name).replace(/^T/, '');
        case 'error': return 'Exception';
        case 'tuple': case 'record': return this.recordOf(t).replace(/^T/, '');
        default: return 'Val';
      }
    }

    /** Array alias name for an array type, declaring it when new. */
    aliasOf(t) {
      const elem = t.elem.k === 'enum' ? T.str : t.elem;
      const key = elem.key + '[]';
      const fixed = RUNTIME_ALIASES[key] || RUNTIME_ALIASES[elem.k === 'class' ? 'class:' + elem.name + '[]' : ''];
      if (fixed) return fixed;
      if (this.aliases.has(key)) return this.aliases.get(key).name;
      const elemPas = this.pasType(elem);
      const name = 'TA_' + this.elemCode(elem);
      this.aliases.set(key, { name, elemPas, elem, depth: this.depthOf(elem) });
      return name;
    }

    depthOf(t) {
      if (t.k === 'array') return 1 + this.depthOf(t.elem);
      if (t.k === 'tuple' || t.k === 'record') return 1 + Math.max(0, ...this.recordFields(t).map(f => this.depthOf(f.type)));
      return 0;
    }

    recordFields(t) {
      if (t.k === 'record') return t.fields;
      return t.elems.map((e, i) => ({ name: 'Item' + i, type: e }));
    }

    recordOf(t) {
      if (this.records.has(t.key)) return this.records.get(t.key).name;
      const name = 'TRec' + (this.records.size + 1);
      const entry = { name, fields: null, depth: 0 };
      this.records.set(t.key, entry);
      entry.fields = this.recordFields(t).map(f => ({ name: sanitize(f.name), type: this.pasType(f.type) }));
      entry.depth = this.depthOf(t);
      return name;
    }

    // =====================================================================
    // Function contexts
    // =====================================================================

    /**
     * A routine being compiled: its scopes, locals, labels and nested routines.
     * @param {object} o - { parent, cls, isStatic, retType, name }
     */
    newFn(o) {
      const parent = o.parent || null;
      const pool = parent ? parent.pool : new NamePool(this.reserved, this.localParent);
      return {
        parent, cls: o.cls || null, isStatic: !!o.isStatic, retType: o.retType || T.void,
        pool, scopes: [new Map()], vars: [], labels: [], nested: [], loops: [], name: o.name || '',
        catchVars: [], isCtor: !!o.isCtor, lambdaMethods: [], hasSelf: o.hasSelf !== undefined ? o.hasSelf : !!o.cls
      };
    }

    pushScope() { this.fn.scopes.push(new Map()); }
    popScope() { this.fn.scopes.pop(); }

    declareLocal(jsName, type, kind = 'local') {
      const pas = this.fn.pool.take(jsName);
      const entry = { pas, type, kind };
      this.fn.scopes[this.fn.scopes.length - 1].set(jsName, entry);
      if (kind === 'local') this.fn.vars.push({ name: pas, type: this.pasType(type) });
      return entry;
    }

    temp(type, hint = 'tmp') {
      const pas = this.fn.pool.take('_' + hint);
      this.fn.vars.push({ name: pas, type: this.pasType(type) });
      return pas;
    }

    newLabel(hint) {
      const name = 'L_' + hint + '_' + (++this.labelCount);
      // labels belong to the routine that contains them
      this.fn.labels.push(name);
      return name;
    }

    lookup(jsName) {
      for (let f = this.fn; f; f = f.parent) {
        for (let i = f.scopes.length - 1; i >= 0; --i) {
          const e = f.scopes[i].get(jsName);
          if (e && e.kind === 'nestedFn' && e.lazy) this.compileHoisted(e);
          if (e) return Object.assign({ outer: f !== this.fn }, e);
        }
      }
      return null;
    }

    // ------------------------------------------------------------ pre-statements

    /** Run fn collecting the statements its expressions hoist; returns [result, stmts]. */
    capture(fn) {
      const saved = this.pre;
      this.pre = [];
      try {
        const r = fn();
        return [r, this.pre];
      } finally {
        this.pre = saved;
      }
    }

    emitPre(stmt) {
      if (!this.pre) fail('internal: a statement was hoisted outside a statement context');
      this.pre.push(stmt);
    }

    // =====================================================================
    // Bodies
    // =====================================================================

    transformClassBodies() {
      for (const c of this.userClasses) {
        c.decl = { methods: [], props: [], fields: [] };
        this.transformClass(c);
      }
    }

    transformClass(c) {
      // constructor
      const ctorParams = c.ctorNode ? c.ctorParams : null;
      if (c.ctorNode) {
        this.compileRoutine({
          cls: c, node: c.ctorNode, name: 'Create', isCtor: true,
          params: ctorParams.map(p => ({ jsName: p.jsName, type: p.type, rest: p.rest })), retType: T.void,
          decl: true
        });
      }
      for (const m of c.members.values()) {
        if (m.kind === 'method') {
          this.compileRoutine({
            cls: c, node: m.node, name: m.pas, member: m, isStatic: m.static,
            params: m.params.map((p, i) => ({ jsName: (m.ownParams[i] || p).jsName, type: p.type, ownType: m.ownParams[i] ? m.ownParams[i].type : p.type, rest: p.rest })),
            extraParams: m.ownParams.slice(m.params.length),
            retType: m.ret, ownRet: m.ownRet, decl: true
          });
        } else if (m.kind === 'prop') {
          if (m.getNode) this.compileRoutine({ cls: c, node: m.getNode, name: m.getterPas, member: m, isStatic: m.static, params: [], retType: m.type, decl: true,
            accessor: 'get', overridesAccessor: m.overrides && (m.overrides.getter || m.overrides.getterPas) === m.getterPas });
          if (m.setNode) {
            const sp = this.paramsOf(m.setNode)[0] || { jsName: 'value', type: m.type };
            this.compileRoutine({ cls: c, node: m.setNode, name: m.setterPas, member: m, isStatic: m.static,
              params: [{ jsName: sp.jsName, type: m.type, ownType: sp.type }], retType: T.void, decl: true,
              accessor: 'set', overridesAccessor: m.overrides && (m.overrides.setter || m.overrides.setterPas) === m.setterPas });
          }
        }
      }
      // lambdas turned into methods while compiling (bodies already compiled)
      this.generateDispatchers(c);
    }

    transformGlobalFunctions() {
      for (const f of this.functions.values()) {
        this.compileRoutine({ cls: null, node: f.node, name: f.pas, params: f.params.map(p => ({ jsName: p.jsName, type: p.type, rest: p.rest })),
          retType: f.ret, global: f });
      }
    }

    /**
     * Compile a routine (method, accessor, constructor or global function).
     * @param {object} o - { cls, node, name, params, retType, isCtor, isStatic, member, decl, global, extraParams, ownRet }
     */
    compileRoutine(o) {
      const savedFn = this.fn, savedPre = this.pre;
      this.fn = this.newFn({ cls: o.cls, isStatic: o.isStatic, retType: o.retType, name: o.name, isCtor: o.isCtor, hasSelf: !!o.cls && !o.isStatic });
      this.pre = null;
      try {
        const params = [];
        const prologue = [];
        for (const p of o.params) {
          const entry = this.declareLocal(p.jsName, p.ownType || p.type, 'param');
          params.push(A.param(entry.pas, this.pasType(p.type), this.paramMode(p.type)));
          if (p.ownType && p.ownType.key !== p.type.key) {
            // the override's own parameter type differs from the inherited signature
            const local = this.declareLocal(p.jsName, p.ownType);
            try {
              prologue.push(A.assign(A.id(local.pas), this.conv({ e: A.id(entry.pas), t: p.type }, p.ownType)));
            } catch (e) {
              if (!(e instanceof TranspileError)) throw e;
              prologue.push(...this.unsupported(e));
            }
          }
        }
        for (const p of o.extraParams || []) {
          const local = this.declareLocal(p.jsName, p.type);
          prologue.push(A.assign(A.id(local.pas), this.defaultValue(p.type)));
        }
        const ownRet = o.ownRet || o.retType;
        this.fn.retType = o.retType;
        this.fn.ownRet = ownRet;
        const body = prologue.concat(this.hoistVars(o.node), this.compileBody(o.node));
        const r = A.routine({
          name: o.name, owner: o.cls ? o.cls.pas : null,
          routineKind: o.isCtor ? 'constructor' : (isNullT(o.retType) || o.retType.k === 'void' ? 'procedure' : 'function'),
          params, returns: o.isCtor || o.retType.k === 'void' ? null : this.pasType(o.retType),
          isClassMethod: !!o.isStatic, labels: this.fn.labels, vars: this.dedupeVars(this.fn.vars), nested: this.fn.nested, body
        });
        if (o.global && o.global.pas) {
          this.routines.push(r);
          this.forwards.push(Object.assign({}, r, { owner: null }));
        } else {
          this.routines.push(r);
        }
        if (o.decl && o.cls) {
          const directives = [];
          if (o.isStatic) directives.push('static');
          else if (o.isCtor) { /* constructors hide the base one */ }
          else if (o.member && o.member.kind === 'method') directives.push(o.member.overrides ? 'override' : 'virtual');
          else if (o.member && o.member.kind === 'prop') directives.push(o.overridesAccessor ? 'override' : 'virtual');
          o.cls.decl.methods.push(A.methodDecl({ name: o.name, routineKind: r.routineKind, params, returns: r.returns, isClassMethod: !!o.isStatic, directives }));
        }
        return r;
      } finally {
        this.fn = savedFn;
        this.pre = savedPre;
      }
    }

    dedupeVars(vars) {
      const seen = new Set();
      return vars.filter(v => { const k = v.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    }

    paramMode(t) {
      return '';
    }

    /**
     * JavaScript `var` is scoped to the function: every var the body declares
     * (outside nested functions) is a local from the start, undefined until set.
     * @returns {object[]} statements giving each its initial value
     */
    /**
     * An integer local the IL typed from its initializer alone, though an
     * assignment in the same function gives it a float64 value: a Double.
     * A type declared in JSDoc stands.
     */
    widenForFloats(d, type) {
      if (d.declaredType || !isInt(type) || !this.fn.floatAssigned || !this.fn.floatAssigned.has(d.id.name)) return type;
      return T.f64;
    }

    hoistVars(fnNode) {
      const out = [];
      const body = fnNode && fnNode.body;
      if (!body || body.type !== 'BlockStatement') return out;
      // locals some assignment gives a fractional value (let tau = 0; tau += R / k)
      const floatAssigned = this.fn.floatAssigned = new Set();
      const scan = node => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(scan); return; }
        if (['FunctionExpression', 'FunctionDeclaration', 'ArrowFunction', 'ArrowFunctionExpression', 'ClassDeclaration'].includes(node.type)) return;
        if (node.type === 'AssignmentExpression' && node.left && node.left.type === 'Identifier' &&
            (node.operator === '/=' || isFloat(parseType(node.right && node.right.resultType) || T.any)))
          floatAssigned.add(node.left.name);
        for (const k in node) {
          if (k === 'typeInfo' || k === 'range' || k === 'loc') continue;
          const v = node[k];
          if (v && typeof v === 'object') scan(v);
        }
      };
      scan(body.body);
      const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (['FunctionExpression', 'FunctionDeclaration', 'ArrowFunction', 'ArrowFunctionExpression', 'ClassDeclaration'].includes(node.type)) return;
        if (node.type === 'VariableDeclaration' && node.kind === 'var') {
          for (const d of node.declarations) {
            if (!d.id || d.id.type !== 'Identifier' || this.fn.scopes[0].has(d.id.name)) continue;
            if (d.init && (d.init.type === 'FunctionExpression' || d.init.type === 'ArrowFunction' || d.init.type === 'ArrowFunctionExpression')) continue;
            let type = parseType(d.declaredType) || parseType(d.id.resultType) || (d.init && parseType(d.init.resultType)) || null;
            if (!type || isNullT(type)) type = (d.init && parseType(d.init.contextType)) || T.any;
            type = this.widenForFloats(d, type);
            const pas = this.fn.pool.take(d.id.name);
            this.fn.scopes[0].set(d.id.name, { pas, type, kind: 'local', isVar: true });
            this.fn.vars.push({ name: pas, type: this.pasType(type) });
            out.push(A.assign(A.id(pas), this.defaultValue(type)));
          }
        }
        for (const k in node) {
          if (k === 'typeInfo' || k === 'range' || k === 'loc') continue;
          const v = node[k];
          if (v && typeof v === 'object') visit(v);
        }
      };
      visit(body.body);
      return out;
    }

    /** Statements of a function body (a block or an arrow's expression). */
    compileBody(node) {
      if (!node) return [];
      if (node.body && node.body.type === 'BlockStatement') return this.block(node.body.body);
      if (node.body) {
        // expression-bodied arrow
        try {
          const [res, pre] = this.capture(() => this.ex(node.body, this.fn.retType));
          if (this.fn.retType.k === 'void') return pre.concat(this.exprStatement(res) || []);
          return pre.concat([A.exit(this.conv(res, this.fn.retType))]);
        } catch (e) {
          if (!(e instanceof TranspileError)) throw e;
          return this.unsupported(e);
        }
      }
      return [];
    }

    // =====================================================================
    // Statements
    // =====================================================================

    block(stmts) {
      const out = [];
      this.pushScope();
      try {
        // function declarations are hoisted
        // function declarations are hoisted; each body compiles at its first
        // use, when the locals of this block it reads are declared
        const hoisted = [];
        for (const s of stmts) if (s && s.type === 'FunctionDeclaration') hoisted.push(this.declareNestedFunction(s.id.name, s, true));
        for (const s of stmts) this.stmt(s, out);
        for (const h of hoisted) if (h.lazy) this.compileHoisted(h);
      } finally {
        this.popScope();
      }
      return out;
    }

    /** A statement with its hoisted pre-statements. */
    stmt(node, out) {
      if (!node) return;
      let pre;
      try {
        [, pre] = this.capture(() => {
          const r = this.stmtInner(node);
          if (r) (Array.isArray(r) ? r : [r]).forEach(s => this.pre.push(s));
        });
      } catch (e) {
        if (!(e instanceof TranspileError)) throw e;
        pre = this.unsupported(e);
      }
      out.push(...pre);
    }

    /**
     * A statement the target cannot express: it raises when reached, so the
     * rest of the unit still compiles and runs (strict mode fails instead).
     */
    unsupported(e) {
      if (this.options.strict) throw e;
      this.diagnostics.push(e.message + (e.node && e.node.range ? " @" + e.node.range[0] : ""));
      const text = 'unsupported: ' + e.message;
      return [A.comment(text), A.raise(A.call(A.mem(A.id('EJsError'), 'Create'), [A.lit(pasString(text))]))];
    }

    stmtInner(node) {
      switch (node.type) {
        case 'ExpressionStatement': return this.expressionStatement(node.expression);
        case 'VariableDeclaration': return this.variableDeclaration(node);
        case 'ReturnStatement': return this.returnStatement(node);
        case 'IfStatement': return this.ifStatement(node);
        case 'BlockStatement': return this.block(node.body);
        case 'ForStatement': return this.forStatement(node);
        case 'ForOfStatement': return this.forOfStatement(node);
        case 'ForInStatement': fail('for...in is not supported', node); break;
        case 'WhileStatement': return this.whileStatement(node);
        case 'DoWhileStatement': return this.doWhileStatement(node);
        case 'BreakStatement': return this.breakStatement(node);
        case 'ContinueStatement': return this.continueStatement(node);
        case 'ThrowStatement': return this.throwStatement(node);
        case 'TryStatement': return this.tryStatement(node);
        case 'SwitchStatement': return this.switchStatement(node);
        case 'FunctionDeclaration': return null;  // hoisted
        case 'EmptyStatement': return null;
        case 'LabeledStatement': return this.labeledStatement(node);
        case 'ClassDeclaration': fail('a class declared inside a function is not supported', node); break;
        default:
          fail(`unsupported statement ${node.type}`, node);
      }
    }

    expressionStatement(e) {
      if (!e) return null;
      switch (e.type) {
        case 'AssignmentExpression': return this.assignment(e, false);
        case 'UpdateExpression': return this.update(e, false);
        case 'SequenceExpression': {
          const out = [];
          for (const x of e.expressions) { const r = this.expressionStatement(x); if (r) out.push(...(Array.isArray(r) ? r : [r])); }
          return out;
        }
        case 'ConditionalExpression': {
          const test = this.ex(e.test);
          if (test.constBool !== undefined) return this.expressionStatement(test.constBool ? e.consequent : e.alternate);
          const cond = this.truthy(test);
          const [, a] = this.capture(() => { const r = this.expressionStatement(e.consequent); if (r) this.pre.push(...(Array.isArray(r) ? r : [r])); });
          const [, b] = this.capture(() => { const r = this.expressionStatement(e.alternate); if (r) this.pre.push(...(Array.isArray(r) ? r : [r])); });
          return A.ifStmt(cond, a, b.length ? b : null);
        }
        case 'LogicalExpression': {
          if (e.operator === '&&' || e.operator === '||') {
            const cond = this.truthy(this.ex(e.left));
            const [, a] = this.capture(() => { const r = this.expressionStatement(e.right); if (r) this.pre.push(...(Array.isArray(r) ? r : [r])); });
            return A.ifStmt(e.operator === '&&' ? cond : A.un('not', cond), a);
          }
          break;
        }
        case 'DebugOutput': return null;
        case 'Literal': case 'Identifier': case 'ThisExpression': return null;
        case 'UnaryExpression':
          if (e.operator === 'void') return this.expressionStatement(e.argument);
          break;
      }
      const res = this.ex(e, null, true);
      return this.exprStatement(res);
    }

    /** A value computed for its side effect only. */
    exprStatement(res) {
      if (!res || !res.e) return null;
      const e = res.e;
      if (e.kind === 'call') return A.expr(e);
      if (res.stmtOk) return A.expr(e);
      return null;
    }

    variableDeclaration(node) {
      const out = [];
      for (const d of node.declarations) {
        if (!d.id) continue;
        if (d.id.type !== 'Identifier') {
          this.destructuringDeclaration(d, out, node.isGlobalInit);
          continue;
        }
        const name = d.id.name;
        if (node.isGlobalInit) {
          const g = this.globals.get(name);
          if (d.init) out.push(...this.assignTo({ e: A.id(g.pas), t: g.type, lvalue: true }, d.init));
          continue;
        }
        if (d.init && (d.init.type === 'FunctionExpression' || d.init.type === 'ArrowFunction' || d.init.type === 'ArrowFunctionExpression')) {
          this.declareNestedFunction(name, d.init);
          continue;
        }
        if (node.kind === 'var') {
          // hoisted: the declaration only assigns
          const hoisted = this.fn.scopes[0].get(name);
          if (hoisted && hoisted.isVar) {
            if (d.init) out.push(...this.assignTo({ e: A.id(hoisted.pas), t: hoisted.type, lvalue: true }, d.init));
            continue;
          }
        }
        let type = parseType(d.declaredType) || parseType(d.id.resultType) || (d.init && parseType(d.init.resultType)) || null;
        if (!type || isNullT(type)) type = (d.init && parseType(d.init.contextType)) || T.any;
        type = this.widenForFloats(d, type);
        if (isAnyT(type) && d.init) {
          // untyped by the IL (test vector helpers): the variable holds what its initializer compiles to
          const [res, pre] = this.capture(() => this.ex(d.init));
          const t = res.t && !isNullT(res.t) && res.t.k !== 'void' && res.t.k !== 'function' ? res.t : T.any;
          const local = this.declareLocal(name, t);
          out.push(...pre, A.assign(A.id(local.pas), this.conv(res, t)));
          continue;
        }
        const entry = this.declareLocal(name, type);
        if (d.init) out.push(...this.assignTo({ e: A.id(entry.pas), t: type, lvalue: true }, d.init));
        else out.push(A.assign(A.id(entry.pas), this.defaultValue(type)));
      }
      return out;
    }

    destructuringDeclaration(d, out, isGlobal) {
      // const [a, b] = expr / const { a, b } = expr
      const src = this.ex(d.init);
      const tmp = this.temp(src.t, 'destr');
      out.push(A.assign(A.id(tmp), src.e));
      const pattern = d.id;
      if (pattern.type === 'ArrayPattern') {
        pattern.elements.forEach((el, i) => {
          if (!el) return;
          const name = el.type === 'Identifier' ? el.name : (el.left && el.left.name);
          const val = this.indexValue({ e: A.id(tmp), t: src.t }, { e: A.lit(i), t: T.int32 }, i);
          const t = parseType(el.resultType) || val.t;
          const entry = this.declareLocal(name, t);
          out.push(A.assign(A.id(entry.pas), this.conv(val, t)));
        });
        return;
      }
      if (pattern.type === 'ObjectPattern') {
        for (const p of pattern.properties) {
          const key = p.key && (p.key.name || p.key.value);
          const name = p.value && p.value.name || key;
          const val = this.memberValue({ e: A.id(tmp), t: src.t }, key, p);
          const t = parseType(p.value && p.value.resultType) || val.t;
          const entry = this.declareLocal(name, t);
          out.push(A.assign(A.id(entry.pas), this.conv(val, t)));
        }
        return;
      }
      fail('unsupported destructuring ' + pattern.type, d);
    }

    returnStatement(node) {
      if (this.fn.isCtor) return A.exit();
      if (!node.argument) {
        if (this.fn.retType.k !== 'void') return A.exit(this.defaultValue(this.fn.retType));
        return A.exit();
      }
      if (this.fn.retType.k === 'void') {
        const r = this.expressionStatement(node.argument);
        return [].concat(r || [], [A.exit()]);
      }
      const res = this.ex(node.argument, this.fn.ownRet || this.fn.retType);
      const own = this.fn.ownRet && this.fn.ownRet.key !== this.fn.retType.key ? this.conv(res, this.fn.ownRet) : null;
      return A.exit(own ? this.conv({ e: own, t: this.fn.ownRet }, this.fn.retType) : this.conv(res, this.fn.retType));
    }

    ifStatement(node) {
      const test = this.ex(node.test);
      // a branch the IL types rule out is not compiled
      if (test.constBool === true) return this.subBlock(node.consequent);
      if (test.constBool === false) return node.alternate ? this.subBlock(node.alternate) : [];
      const cond = this.truthy(test);
      const thenBody = this.subBlock(node.consequent);
      const elseBody = node.alternate ? this.subBlock(node.alternate) : null;
      return A.ifStmt(cond, thenBody, elseBody && elseBody.length ? elseBody : null);
    }

    /** A nested statement or block, compiled into its own list. */
    subBlock(node) {
      if (!node) return [];
      if (node.type === 'BlockStatement') {
        const [, stmts] = this.capture(() => { this.pre.push(...this.block(node.body)); });
        return stmts;
      }
      const out = [];
      this.pushScope();
      try { this.stmt(node, out); } finally { this.popScope(); }
      return out;
    }

    /** A loop condition: [statements to run before each test, the test]. */
    loopCondition(test) {
      if (!test) return [[], A.lit('True')];
      const [cond, pre] = this.capture(() => this.truthy(this.ex(test)));
      return [pre, cond];
    }

    pushLoop(entry) { this.fn.loops.push(entry); }
    popLoop() { this.fn.loops.pop(); }

    forStatement(node) {
      const out = [];
      this.pushScope();
      try {
        if (node.init) {
          if (node.init.type === 'VariableDeclaration') this.stmt(node.init, out);
          else { const [, pre] = this.capture(() => { const r = this.expressionStatement(node.init); if (r) this.pre.push(...[].concat(r)); }); out.push(...pre); }
        }
        const [condPre, cond] = this.loopCondition(node.test);
        const loop = { kind: 'loop', jsLabel: node.jsLabel || null, continueLabel: null, breakLabel: null, needsGotoContinue: !!node.update };
        this.pushLoop(loop);
        let body;
        try { body = this.subBlock(node.body); } finally { this.popLoop(); }
        let update = [];
        if (node.update) {
          const [, pre] = this.capture(() => { const r = this.expressionStatement(node.update); if (r) this.pre.push(...[].concat(r)); });
          update = pre;
        }
        const loopBody = [];
        if (condPre.length) { loopBody.push(...condPre, A.ifStmt(A.un('not', cond), [A.breakStmt()])); }
        loopBody.push(...body);
        if (loop.continueLabel) loopBody.push(A.label(loop.continueLabel));
        loopBody.push(...update);
        out.push(A.whileStmt(condPre.length ? A.lit('True') : cond, loopBody));
        if (loop.breakLabel) out.push(A.label(loop.breakLabel));
      } finally {
        this.popScope();
      }
      return out;
    }

    whileStatement(node) {
      const [condPre, cond] = this.loopCondition(node.test);
      const loop = { kind: 'loop', jsLabel: node.jsLabel || null, continueLabel: null, breakLabel: null, needsGotoContinue: false };
      this.pushLoop(loop);
      let body;
      try { body = this.subBlock(node.body); } finally { this.popLoop(); }
      const loopBody = [];
      if (condPre.length) loopBody.push(...condPre, A.ifStmt(A.un('not', cond), [A.breakStmt()]));
      loopBody.push(...body);
      if (loop.continueLabel) loopBody.push(A.label(loop.continueLabel));
      const out = [A.whileStmt(condPre.length ? A.lit('True') : cond, loopBody)];
      if (loop.breakLabel) out.push(A.label(loop.breakLabel));
      return out;
    }

    doWhileStatement(node) {
      const loop = { kind: 'loop', jsLabel: node.jsLabel || null, continueLabel: null, breakLabel: null, needsGotoContinue: false };
      this.pushLoop(loop);
      let body;
      try { body = this.subBlock(node.body); } finally { this.popLoop(); }
      const [condPre, cond] = this.loopCondition(node.test);
      if (condPre.length && !loop.continueLabel) loop.continueLabel = this.newLabel('cont');
      const loopBody = [...body];
      if (loop.continueLabel) loopBody.push(A.label(loop.continueLabel));
      loopBody.push(...condPre);
      const out = [A.repeatStmt(loopBody, A.un('not', cond))];
      if (loop.breakLabel) out.push(A.label(loop.breakLabel));
      return out;
    }

    forOfStatement(node) {
      const out = [];
      this.pushScope();
      try {
        const src = this.ex(node.right);
        const arrT = src.t;
        const tmp = this.temp(arrT, 'iter');
        out.push(A.assign(A.id(tmp), src.e));
        const idxName = this.temp(T.int32, 'i');
        out.push(A.assign(A.id(idxName), A.lit(0)));
        let decl = node.left;
        let jsName, declType;
        if (decl.type === 'VariableDeclaration') {
          const d = decl.declarations[0];
          jsName = d.id.name;
          declType = parseType(d.id.resultType);
        } else {
          jsName = decl.name;
        }
        let elemT;
        let lenExpr, elemExpr;
        if (isArr(arrT)) {
          elemT = arrT.elem;
          lenExpr = A.mem(A.id(tmp), 'length');
          elemExpr = A.idx(A.id(tmp), A.id(idxName));
        } else if (isStr(arrT)) {
          elemT = T.str;
          lenExpr = A.call(A.id('System.Length'), [A.id(tmp)]);
          elemExpr = A.call('JsCharAt', [A.id(tmp), A.id(idxName)]);
        } else fail('for...of over ' + (arrT && arrT.key), node);
        const varT = declType && !isAnyT(declType) ? declType : elemT;
        let target;
        if (decl.type === 'VariableDeclaration') target = this.declareLocal(jsName, varT);
        else target = this.lookup(jsName) || fail('unknown loop variable ' + jsName, node);
        const loop = { kind: 'loop', jsLabel: node.jsLabel || null, continueLabel: null, breakLabel: null, needsGotoContinue: true };
        this.pushLoop(loop);
        let body;
        try { body = this.subBlock(node.body); } finally { this.popLoop(); }
        const loopBody = [A.assign(A.id(target.pas), this.conv({ e: elemExpr, t: elemT }, target.type)), ...body];
        if (loop.continueLabel) loopBody.push(A.label(loop.continueLabel));
        loopBody.push(A.assign(A.id(idxName), A.bin('+', A.id(idxName), A.lit(1))));
        out.push(A.whileStmt(A.bin('<', A.id(idxName), lenExpr), loopBody));
        if (loop.breakLabel) out.push(A.label(loop.breakLabel));
      } finally {
        this.popScope();
      }
      return out;
    }

    labeledStatement(node) {
      const inner = node.body;
      if (inner && ['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForOfStatement'].includes(inner.type)) {
        return this.stmtInner(Object.assign({}, inner, { jsLabel: node.label.name }));
      }
      // a labeled block: break label exits it
      const loop = { kind: 'block', jsLabel: node.label.name, breakLabel: null };
      this.pushLoop(loop);
      let body;
      try { body = this.subBlock(inner); } finally { this.popLoop(); }
      if (loop.breakLabel) body.push(A.label(loop.breakLabel));
      return body;
    }

    findLoop(label, forContinue) {
      for (let i = this.fn.loops.length - 1; i >= 0; --i) {
        const l = this.fn.loops[i];
        if (label) { if (l.jsLabel === label) return { loop: l, innermost: i === this.fn.loops.length - 1 }; continue; }
        if (forContinue && l.kind !== 'loop') continue;
        if (!forContinue && l.kind === 'block') continue;
        return { loop: l, innermost: this.innermostPascalLoop(i) };
      }
      fail('break/continue outside a loop');
    }

    /** Is loops[i] the innermost Pascal loop (no switch/loop wrapper between)? */
    innermostPascalLoop(i) {
      for (let j = this.fn.loops.length - 1; j > i; --j)
        if (this.fn.loops[j].kind === 'loop') return false;
      return true;
    }

    breakStatement(node) {
      const { loop, innermost } = this.findLoop(node.label && node.label.name, false);
      if (loop.kind === 'loop' && innermost && !this.insideSwitchAbove(loop)) return A.breakStmt();
      if (!loop.breakLabel) loop.breakLabel = this.newLabel('brk');
      return A.gotoStmt(loop.breakLabel);
    }

    insideSwitchAbove(loop) {
      const i = this.fn.loops.indexOf(loop);
      for (let j = i + 1; j < this.fn.loops.length; ++j) if (this.fn.loops[j].kind === 'switch') return true;
      return false;
    }

    continueStatement(node) {
      const { loop, innermost } = this.findLoop(node.label && node.label.name, true);
      if (!loop.needsGotoContinue && innermost && !this.insideSwitchAbove(loop)) return A.continueStmt();
      if (!loop.continueLabel) loop.continueLabel = this.newLabel('cont');
      return A.gotoStmt(loop.continueLabel);
    }

    throwStatement(node) {
      const arg = node.argument;
      if (arg && arg.type === 'Identifier') {
        const v = this.lookup(arg.name);
        if (v && v.kind === 'catch') return A.raise(null);
      }
      return A.raise(this.errorObject(arg));
    }

    errorObject(arg) {
      if (!arg) return A.call(A.mem(A.id('EJsError'), 'Create'), [A.lit("''")]);
      if (arg.type === 'ErrorCreation') {
        const cls = arg.errorType === 'TypeError' ? 'EJsTypeError' : arg.errorType === 'RangeError' ? 'EJsRangeError' : 'EJsError';
        const msg = arg.message ? this.conv(this.ex(arg.message), T.str) : A.lit("''");
        return A.call(A.mem(A.id(cls), 'Create'), [msg]);
      }
      if (arg.type === 'NewExpression' && isIdentifier(arg.callee) && /Error$/.test(arg.callee.name)) {
        const cls = arg.callee.name === 'TypeError' ? 'EJsTypeError' : arg.callee.name === 'RangeError' ? 'EJsRangeError' : 'EJsError';
        const msg = arg.arguments && arg.arguments[0] ? this.conv(this.ex(arg.arguments[0]), T.str) : A.lit("''");
        return A.call(A.mem(A.id(cls), 'Create'), [msg]);
      }
      const v = this.ex(arg);
      if (v.t.k === 'error') return v.e;
      return A.call(A.mem(A.id('EJsError'), 'Create'), [this.toStr(v)]);
    }

    tryStatement(node) {
      const body = this.subBlock(node.block);
      let handler = null;
      if (node.handler) {
        this.pushScope();
        try {
          let varName = null;
          if (node.handler.param && node.handler.param.name) {
            varName = this.fn.pool.take(node.handler.param.name);
            this.fn.scopes[this.fn.scopes.length - 1].set(node.handler.param.name, { pas: varName, type: T.err, kind: 'catch' });
          }
          const hb = this.subBlock(node.handler.body);
          handler = { varName: varName || 'E_' + (++this.labelCount), type: 'Exception', body: hb };
        } finally {
          this.popScope();
        }
      }
      const fin = node.finalizer ? this.subBlock(node.finalizer) : null;
      return A.tryStmt(body, handler, fin);
    }

    switchStatement(node) {
      const out = [];
      const disc = this.ex(node.discriminant);
      const tmp = this.temp(disc.t, 'sw');
      out.push(A.assign(A.id(tmp), disc.e));
      const sw = { kind: 'switch', breakLabel: this.newLabel('swend') };
      const caseLabels = node.cases.map(() => this.newLabel('case'));
      let defaultIndex = -1;
      // dispatch
      let chain = null;
      let tail = null;
      node.cases.forEach((c, i) => {
        if (!c.test) { defaultIndex = i; return; }
        const test = this.compare('===', { e: A.id(tmp), t: disc.t }, this.ex(c.test, disc.t));
        const ifs = A.ifStmt(test, [A.gotoStmt(caseLabels[i])], null);
        if (!chain) chain = ifs; else tail.else = [ifs];
        tail = ifs;
      });
      const fallback = A.gotoStmt(defaultIndex >= 0 ? caseLabels[defaultIndex] : sw.breakLabel);
      if (chain) { tail.else = [fallback]; out.push(chain); } else out.push(fallback);
      this.pushLoop(sw);
      try {
        node.cases.forEach((c, i) => {
          out.push(A.label(caseLabels[i]));
          this.pushScope();
          try { for (const s of c.consequent) this.stmt(s, out); } finally { this.popScope(); }
        });
      } finally {
        this.popLoop();
      }
      out.push(A.label(sw.breakLabel));
      return out;
    }

    // =====================================================================
    // Nested functions and lambdas
    // =====================================================================

    /** A function declared inside a routine: a Pascal nested routine. */
    declareNestedFunction(jsName, node, lazy = false) {
      const existing = this.fn.scopes[this.fn.scopes.length - 1].get(jsName);
      if (existing && existing.kind === 'nestedFn') return existing;
      const params = this.paramsOf(node);
      const ret = this.returnTypeOf(node);
      const pas = this.fn.pool.take(jsName);
      const entry = { pas, type: T.fn, kind: 'nestedFn', params, ret, node, compiled: false,
        lazy, owner: this.fn, scopeDepth: this.fn.scopes.length };
      this.fn.scopes[this.fn.scopes.length - 1].set(jsName, entry);
      if (!lazy) this.compileNested(entry);
      return entry;
    }

    /**
     * Compile a hoisted function declaration, seeing the scopes of its block
     * as they are now (not the inner blocks of the use that triggered it).
     */
    compileHoisted(entry) {
      entry.lazy = false;
      const owner = entry.owner;
      const saved = owner.scopes;
      owner.scopes = saved.slice(0, entry.scopeDepth);
      try {
        this.compileNested(entry, owner);
      } finally {
        owner.scopes = saved;
      }
    }

    compileNested(entry, owner = this.fn) {
      const savedFn = this.fn, savedPre = this.pre;
      this.fn = this.newFn({ parent: owner, cls: owner.cls, isStatic: owner.isStatic, retType: entry.ret, hasSelf: owner.hasSelf });
      this.pre = null;
      try {
        // the nested routine sees itself (recursion)
        this.fn.scopes[0].set(entry.node.id ? entry.node.id.name : '__self__', entry);
        const params = entry.params.map(p => {
          const e = this.declareLocal(p.jsName, p.type, 'param');
          return A.param(e.pas, this.pasType(p.type), entry.constParams ? 'const' : '');
        });
        this.fn.ownRet = entry.ret;
        const body = this.hoistVars(entry.node).concat(this.compileBody(entry.node));
        const r = A.routine({
          name: entry.pas, routineKind: entry.ret.k === 'void' ? 'procedure' : 'function', params,
          returns: entry.ret.k === 'void' ? null : this.pasType(entry.ret), labels: this.fn.labels,
          vars: this.dedupeVars(this.fn.vars), nested: this.fn.nested, body
        });
        owner.nested.push(r);
        entry.compiled = true;
        return r;
      } finally {
        this.fn = savedFn;
        this.pre = savedPre;
      }
    }

    /**
     * A function value used in place (a callback run while the caller runs):
     * compiled as a nested routine of the current one.
     * @returns {object} entry { pas, params, ret }
     */
    inlineLambda(node, opts = {}) {
      if (!node || !['FunctionExpression', 'ArrowFunction', 'ArrowFunctionExpression'].includes(node.type))
        fail(`a callback that is not a function expression (${node && (node.name || node.type)}) is not supported`, node);
      const params = this.paramsOf(node);
      if (opts.paramTypes) opts.paramTypes.forEach((t, i) => { if (params[i] && (isAnyT(params[i].type) || opts.forceParamTypes)) params[i].type = t; });
      if (opts.paramCount !== undefined) while (params.length < opts.paramCount) params.push({ jsName: '_unused' + params.length, type: opts.paramTypes ? opts.paramTypes[params.length] : T.any });
      let ret = opts.retType || this.returnTypeOf(node);
      const entry = { pas: this.fn.pool.take('_Lambda'), type: T.fn, kind: 'nestedFn', params, ret, node, constParams: !!opts.constParams };
      this.compileNested(entry);
      return entry;
    }

    /**
     * A function value stored for later (a BlockAbsorber callback): a method
     * of the current class, which may only use this, its parameters and globals.
     */
    methodLambda(node, paramTypes) {
      const c = this.fn.cls;
      if (!c || this.fn.isStatic) fail('a stored callback outside a class method is not supported', node);
      const params = this.paramsOf(node);
      paramTypes.forEach((t, i) => { if (params[i]) params[i].type = t; else params.push({ jsName: '_unused' + i, type: t }); });
      const name = c.memberPool.take('_Lambda' + (++this.lambdaCount));
      // locals of the enclosing routines are out of reach
      const outerNames = new Set();
      for (let f = this.fn; f; f = f.parent) for (const s of f.scopes) for (const k of s.keys()) outerNames.add(k);
      const ownNames = new Set(params.map(p => p.jsName));
      const captured = [];
      const visit = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if (n.type === 'Identifier' && outerNames.has(n.name) && !ownNames.has(n.name)) captured.push(n.name);
        if (n.type === 'VariableDeclarator' && n.id && n.id.name) ownNames.add(n.id.name);
        for (const k in n) { if (k === 'typeInfo' || k === 'range') continue; const v = n[k]; if (v && typeof v === 'object') visit(v); }
      };
      visit(node.body);
      if (captured.length) fail(`a stored callback capturing locals (${[...new Set(captured)].join(', ')}) is not supported`, node);
      const savedFn = this.fn, savedPre = this.pre;
      this.fn = this.newFn({ cls: c, retType: T.void, name });
      this.pre = null;
      try {
        const ps = params.map(p => { const e = this.declareLocal(p.jsName, p.type, 'param'); return A.param(e.pas, this.pasType(p.type), 'const'); });
        this.fn.ownRet = T.void;
        const body = this.hoistVars(node).concat(this.compileBody(node));
        this.routines.push(A.routine({ name, owner: c.pas, routineKind: 'procedure', params: ps, labels: this.fn.labels,
          vars: this.dedupeVars(this.fn.vars), nested: this.fn.nested, body }));
        c.decl.methods.push(A.methodDecl({ name, routineKind: 'procedure', params: ps }));
      } finally {
        this.fn = savedFn;
        this.pre = savedPre;
      }
      return A.mem(A.id('Self'), name);
    }

    // =====================================================================
    // Expressions
    // =====================================================================

    /**
     * Compile an expression.
     * @param {object} node - IL expression
     * @param {object} [expected] - the type the context wants (literals and empty arrays take it)
     * @param {boolean} [forEffect] - the value is discarded
     * @returns {{e: object, t: object}} Pascal expression and its IL type
     */
    ex(node, expected = null, forEffect = false) {
      if (!node) return { e: A.lit('nil'), t: T.null };
      const handler = this['x' + node.type];
      if (handler) return handler.call(this, node, expected, forEffect);
      fail(`unsupported expression ${node.type}`, node);
    }

    typeOf(node, fallback = T.any) {
      return parseType(node && node.resultType) || fallback;
    }

    // ------------------------------------------------------------ leaves

    xLiteral(node, expected) {
      const v = node.value;
      if (node.regex) fail('regular expressions are not supported', node);
      if (typeof v === 'bigint' || node.bigint || (typeof v === 'string' && /^BIGINT:/.test(v)))
        return { e: this.bigLiteral(BigInt(typeof v === 'string' && /^BIGINT:/.test(v) ? v.slice(7) : v)), t: T.big };
      if (v === null || v === undefined) {
        const t = expected && !isNullT(expected) ? expected : T.null;
        return { e: this.nullValue(t), t: T.null, isNull: true };
      }
      if (typeof v === 'boolean') return { e: A.lit(v ? 'True' : 'False'), t: T.bool };
      if (typeof v === 'string') return { e: A.lit(pasString(v)), t: T.str, constStr: v };
      if (typeof v === 'number') {
        let t = this.typeOf(node, null);
        if (!t || !isNum(t)) t = Number.isInteger(v) ? (Math.abs(v) <= 2147483647 ? T.int32 : (v >= 0 ? T.uint64 : T.int64)) : T.f64;
        if (expected && isNum(expected) && Number.isInteger(v) && (isFloat(expected) || this.fitsInt(v, expected))) t = expected;
        if (expected && isBig(expected) && Number.isInteger(v)) return { e: this.bigLiteral(BigInt(v)), t: T.big };
        return { e: this.numLiteral(v, t, node.raw), t, constNum: v };
      }
      fail('unsupported literal', node);
    }

    fitsInt(v, t) {
      if (!isInt(t)) return false;
      if (t.bits === 64) return true;
      const min = t.signed ? -(2 ** (t.bits - 1)) : 0;
      const max = t.signed ? 2 ** (t.bits - 1) - 1 : 2 ** t.bits - 1;
      return v >= min && v <= max;
    }

    numLiteral(v, t, raw) {
      if (isFloat(t) || !Number.isInteger(v)) {
        if (!Number.isFinite(v)) return A.call(Number.isNaN(v) ? 'JsNaN' : 'JsInfinity');
        let s = String(v);
        if (/^-?\d+$/.test(s)) s += '.0';
        if (/e/.test(s) && !/\./.test(s.split('e')[0])) s = s.replace('e', '.0e');
        return A.lit(s);
      }
      if (raw && /^0[xX][0-9a-fA-F_]+$/.test(raw)) {
        const hex = raw.slice(2).replace(/_/g, '');
        if (BigInt('0x' + hex) === BigInt(v)) return A.lit('$' + hex.toUpperCase());
      }
      if (Math.abs(v) > 9007199254740991) return A.lit(BigInt(v).toString());
      return A.lit(String(v));
    }

    bigLiteral(v) {
      const key = v.toString();
      if (!this.bigLiterals.has(key)) {
        const name = 'JsBig_' + (this.bigLiterals.size + 1);
        this.bigLiterals.set(key, name);
      }
      return A.id(this.bigLiterals.get(key));
    }

    xIdentifier(node, expected) {
      const name = node.name;
      const v = this.lookup(name);
      if (v) {
        if (v.kind === 'nestedFn') return { e: A.id(v.pas), t: T.fn, fnEntry: v };
        return { e: A.id(v.pas), t: v.type, lvalue: v.kind !== 'catch', local: v };
      }
      if (this.globals.has(name)) { const g = this.globals.get(name); return { e: A.id(g.pas), t: g.type, lvalue: true }; }
      if (this.functions.has(name)) { const f = this.functions.get(name); return { e: A.id(f.pas), t: T.fn, globalFn: f }; }
      const lib = this.libraries.get(name) || this.libraryAliases.get(name);
      if (lib) return { e: A.lit('True'), t: T.bool, libNamespace: lib, constBool: true };
      if (this.libraryImports.has(name)) { const imp = this.libraryImports.get(name); return this.libraryMember(imp.lib, imp.name, node); }
      switch (name) {
        case 'undefined': return { e: this.nullValue(expected || T.null), t: T.null, isNull: true };
        case 'NaN': return { e: A.call('JsNaN'), t: T.f64 };
        case 'Infinity': return { e: A.call('JsInfinity'), t: T.f64 };
      }
      if (this.classes.has(name)) return { e: A.id(this.classes.get(name).pas), t: T.any, classRef: this.classes.get(name) };
      fail(`unknown identifier ${name}`, node);
    }

    xThisExpression() {
      if (!this.fn.cls || !this.fn.hasSelf) fail('this outside a method');
      return { e: A.id('Self'), t: tClass(this.fn.cls.jsName) };
    }

    // ------------------------------------------------------------ members

    xThisPropertyAccess(node) {
      if (!this.fn.cls) fail('this outside a class', node);
      if (node.computed) fail('computed this[...] access is not supported', node);
      const c = this.fn.cls;
      const self = this.fn.isStatic ? A.id(c.pas) : A.id('Self');
      return this.memberValue({ e: self, t: tClass(c.jsName) }, node.property, node);
    }

    /** obj.name for a value of a known type. */
    memberValue(obj, name, node) {
      const t = obj.t;
      if (t.k === 'class') {
        const c = this.classes.get(t.name);
        if (!c) fail(`member ${name} of unknown class ${t.name}`, node);
        if (c.dynamic && !this.findMember(c, name)) {
          // a test vector's own field
          const want = this.typeOf(node, T.any);
          return { e: A.call(A.mem(obj.e, 'GetField'), [A.lit(pasString(name))]), t: T.any, wantType: want, dynamicField: { obj: obj.e, name } };
        }
        const m = this.findMember(c, name) || this.memberFromSubclass(c, name, node, true);
        if (!m) {
          // declared by no class the value can be: looked up by name at run time
          return { e: A.call('JsObjGet', [obj.e, A.lit(pasString(name))]), t: T.any, dynamicMember: { obj: obj.e, name, set: 'JsObjSet' } };
        }
        if (m.kind === 'method') fail(`method ${name} used as a value`, node);
        if (m.castTo && c.isFramework && !m.owner.isFramework) {
          // a framework-typed value may come from another unit (a registry
          // lookup): only a run-time lookup by name is sure to reach the member
          const t = m.type || T.any;
          const read = A.call('JsObjGet', [obj.e, A.lit(pasString(name))]);
          return { e: isAnyT(t) ? read : this.fromJsValue(read, t), t, dynamicMember: { obj: obj.e, name, set: 'JsObjSet' } };
        }
        const owner = m.owner;
        const base = m.static ? A.id(owner.pas) : (m.castTo ? A.cast(m.castTo, obj.e) : obj.e);
        return { e: A.mem(base, m.pas), t: m.type || T.any, lvalue: true, member: m, objE: base };
      }
      if (t.k === 'error') {
        if (name === 'message') return { e: A.mem(obj.e, 'Message'), t: T.str };
        if (name === 'name') return { e: A.mem(obj.e, 'ClassName'), t: T.str };
        fail(`member ${name} of an Error`, node);
      }
      if (t.k === 'record' || t.k === 'tuple') {
        const fields = this.recordFields(t);
        const f = fields.find(x => x.name === name);
        if (!f) fail(`record has no field ${name}`, node);
        return { e: A.mem(obj.e, sanitize(f.name)), t: f.type, lvalue: true };
      }
      if (t.k === 'array' && name === 'length') return { e: A.mem(obj.e, 'length'), t: T.int32, lvalue: true };
      if (t.k === 'map' && name === 'size') return { e: A.call(A.mem(obj.e, 'Size')), t: T.int32 };
      if (t.k === 'string' && name === 'length') return { e: A.call(A.id('System.Length'), [obj.e]), t: T.int32 };
      if (t.k === 'any') {
        // a value the IL leaves untyped: its members are dynamic too
        return { e: A.call('JsValGet', [obj.e, A.lit(pasString(name))]), t: T.any, dynamicMember: { obj: obj.e, name } };
      }
      fail(`member ${name} of ${t.key}`, node);
    }

    /** A member only a subclass declares, reached through a base-typed value: cast to that subclass. */
    memberFromSubclass(c, name, node, optional = false) {
      const found = [];
      for (const k of this.classes.values()) {
        let isSub = false;
        for (let b = k.base; b; b = b.base) if (b === c) isSub = true;
        if (isSub && k.members.has(name)) found.push(k);
      }
      // the topmost declaring subclasses
      const top = found.filter(k => !found.some(o => o !== k && this.isAncestor(o, k)));
      if (top.length === 1) {
        const m = top[0].members.get(name);
        return Object.assign({}, m, { castTo: top[0].pas });
      }
      // none or several subclasses declare it: the caller looks it up by name
      if (optional) return null;
      fail(`${c.jsName} has no member ${name}`, node);
    }

    isAncestor(a, b) {
      for (let k = b.base; k; k = k.base) if (k === a) return true;
      return false;
    }

    xMemberExpression(node) {
      const obj = node.object;
      if (node.computed) {
        const o = this.ex(obj);
        const i = this.ex(node.property);
        return this.indexValue(o, i, node.property && node.property.type === 'Literal' ? node.property.value : null, node);
      }
      const name = node.property && (node.property.name || node.property.value);
      if (obj && obj.type === 'Identifier') {
        if (ENUM_TYPES.has(obj.name)) return { e: this.enumValue(obj.name, name), t: tEnum(obj.name) };
        if (!this.lookup(obj.name) && !this.globals.has(obj.name)) {
          const c = this.classes.get(obj.name);
          if (c && !c.isFramework) {
            const m = c.members.get(name) || this.findMember(c, name);
            if (m && m.static) return { e: A.mem(A.id(m.owner.pas), m.pas), t: m.type || T.any, lvalue: true, member: m };
            fail(`${obj.name}.${name} is not a static member`, node);
          }
          if (obj.name === 'AlgorithmFramework' && ENUM_TYPES.has(name)) fail('framework enum object as a value', node);
        }
      }
      if (obj && obj.type === 'MemberExpression' && !obj.computed && isIdentifier(obj.object, 'AlgorithmFramework') && ENUM_TYPES.has(obj.property.name))
        return { e: this.enumValue(obj.property.name, name), t: tEnum(obj.property.name) };
      const o = this.ex(obj);
      if (o.libNamespace) return this.libraryMember(o.libNamespace, name, node);
      if (o.t.k === 'enum') {
        if (name === 'name') return { e: o.e, t: T.str };
        fail(`member ${name} of an enum value`, node);
      }
      return this.memberValue(o, name, node);
    }

    enumValue(enumName, member) {
      const known = {
        CategoryType: ['ASYMMETRIC', 'BLOCK', 'STREAM', 'HASH', 'CHECKSUM', 'COMPRESSION', 'ENCODING', 'CLASSICAL', 'MAC', 'KDF', 'ECC', 'MODE', 'PADDING', 'AEAD', 'SPECIAL', 'PQC', 'RANDOM', 'CRYPTO', 'MODES'],
        SecurityStatus: ['SECURE', 'DEPRECATED', 'BROKEN', 'OBSOLETE', 'EXPERIMENTAL', 'EDUCATIONAL', 'INSECURE', 'ACTIVE'],
        ComplexityType: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'RESEARCH', 'BASIC', 'ELEMENTARY', 'TRIVIAL', 'SIMPLE', 'LOW', 'MEDIUM', 'HIGH']
      };
      if (known[enumName] && known[enumName].includes(member)) return A.mem(A.id('T' + enumName), member);
      return A.lit(pasString(member));
    }

    /** obj[index] for arrays, strings, tuples and dynamic values. */
    indexValue(o, i, literalIndex, node) {
      const t = o.t;
      if (t.k === 'array') return { e: A.idx(o.e, this.conv(i, T.int32)), t: t.elem, lvalue: true, arrayElem: { arr: o.e, index: this.conv(i, T.int32) } };
      if (t.k === 'string') return { e: A.call('JsCharAt', [o.e, this.conv(i, T.int32)]), t: T.str };
      if (t.k === 'tuple' || t.k === 'record') {
        if (!Number.isInteger(literalIndex)) fail('a tuple indexed by a non-literal', node);
        const f = this.recordFields(t)[literalIndex];
        if (!f) fail('tuple index out of range', node);
        return { e: A.mem(o.e, sanitize(f.name)), t: f.type, lvalue: true };
      }
      if (t.k === 'any') return { e: A.call('JsValElem', [o.e, this.conv(i, T.int32)]), t: T.any };
      fail(`index into ${t.key}`, node);
    }

    // ------------------------------------------------------------ conversions

    defaultValue(t) {
      switch (t.k) {
        case 'int': return A.lit('0');
        case 'float': return A.lit('0.0');
        case 'bool': return A.lit('False');
        case 'string': case 'enum': return A.lit("''");
        case 'bigint': return A.call(A.mem(A.id('TBigInt'), 'Zero'));
        case 'array': return A.call(A.mem(A.id(this.aliasOf(t)), 'Null'));
        case 'any': return A.call('JsVUndef');
        case 'tuple': case 'record': return A.call('Default', [A.id(this.pasType(t))]);
        default: return A.lit('nil');
      }
    }

    nullValue(t) {
      if (!t || isNullT(t)) return A.lit('nil');
      if (t.k === 'any') return A.call('JsVNull');
      return this.defaultValue(t);
    }

    /**
     * Convert a compiled value to a type.
     * @param {{e, t}} res - value
     * @param {object} to - target type
     * @returns {object} Pascal expression
     */
    conv(res, to) {
      const from = res.t;
      const e = res.e;
      if (!to || !from) return e;
      if (res.isNull || isNullT(from)) return this.nullValue(to);
      if (from.key === to.key) return e;
      if (res.dynamicField) return this.fromJsValue(e, to);
      switch (to.k) {
        case 'any': return this.toJsValue(res);
        case 'int': {
          if (from.k === 'int') {
            if (intFits(from, to)) return e;
            if (res.constNum !== undefined && this.fitsInt(res.constNum, to)) return e;
            return A.cast(to.pas, e);
          }
          if (from.k === 'float') return to.bits === 64 ? A.call(to.signed ? 'JsToInt64' : 'JsToUInt64', [e]) : A.cast(to.pas, A.call('JsToInt64', [e]));
          if (from.k === 'bigint') return to.bits === 64 ? A.call(A.mem(e, to.signed ? 'ToInt64' : 'ToUInt64')) : A.cast(to.pas, A.call(A.mem(e, 'ToInt64')));
          if (from.k === 'bool') return A.call('Ord', [e]);
          if (from.k === 'any') return this.fromJsValue(e, to);
          if (from.k === 'string') return A.cast(to.pas, A.call('JsToInt64', [A.call('JsStrToNum', [e])]));
          break;
        }
        case 'float': {
          if (from.k === 'int' || from.k === 'float') return e;
          if (from.k === 'bigint') return A.call(A.mem(e, 'ToDouble'));
          if (from.k === 'bool') return A.call('Ord', [e]);
          if (from.k === 'any') return this.fromJsValue(e, to);
          if (from.k === 'string') return A.call('JsStrToNum', [e]);
          break;
        }
        case 'bigint': {
          if (from.k === 'int') return A.call(A.mem(A.id('TBigInt'), is64(from) && !from.signed ? 'FromUInt64' : 'FromInt64'), [e]);
          if (from.k === 'float') return A.call(A.mem(A.id('TBigInt'), 'FromDouble'), [e]);
          if (from.k === 'bool') return A.call(A.mem(A.id('TBigInt'), 'FromBool'), [e]);
          if (from.k === 'string') return A.call(A.mem(A.id('TBigInt'), 'Parse'), [e]);
          if (from.k === 'any') return this.fromJsValue(e, to);
          break;
        }
        case 'bool':
          return this.truthy(res);
        case 'string': case 'enum':
          if (from.k === 'string' || from.k === 'enum') return e;
          if (from.k === 'any') return this.fromJsValue(e, to);
          return this.toStr(res);
        case 'array': {
          if (from.k === 'array') {
            if (this.pasType(from) === this.pasType(to)) return e;
            return A.call(this.arrayConverter(from, to), [e]);
          }
          if (from.k === 'any') return this.fromJsValue(e, to);
          break;
        }
        case 'class': {
          if (from.k === 'class') {
            if (this.isSubclassOf(from.name, to.name)) return e;
            return A.cast(this.classPas(to.name), e);
          }
          if (from.k === 'any') return this.fromJsValue(e, to);
          break;
        }
        case 'error':
          if (from.k === 'error') return e;
          break;
        case 'tuple': case 'record':
          if (from.k === 'tuple' || from.k === 'record') {
            if (this.pasType(from) === this.pasType(to)) return e;
          }
          if (from.k === 'array' && to.k === 'tuple') {
            // a tuple built from an array value
            const tmp = this.temp(from, 'tup');
            this.emitPre(A.assign(A.id(tmp), e));
            const rec = this.temp(to, 'rec');
            this.recordFields(to).forEach((f, i) => this.emitPre(A.assign(A.mem(A.id(rec), sanitize(f.name)),
              this.conv({ e: A.idx(A.id(tmp), A.lit(i)), t: from.elem }, f.type))));
            return A.id(rec);
          }
          break;
        case 'function':
          return e;
        case 'void':
          return e;
        case 'map':
          if (from.k === 'map') return e;
          if (from.k === 'any') return this.fromJsValue(e, to);
          break;
      }
      fail(`cannot convert ${from.key} to ${to.key}`, null);
    }

    isSubclassOf(sub, sup) {
      if (sub === sup) return true;
      let c = this.classes.get(sub);
      while (c) {
        if (c.jsName === sup) return true;
        c = c.base;
      }
      return false;
    }

    /** JavaScript truthiness as a Boolean expression. */
    truthy(res) {
      const t = res.t, e = res.e;
      switch (t.k) {
        case 'bool': return e;
        case 'int': return A.bin('<>', e, A.lit('0'));
        case 'float': return A.call('JsNumTruthy', [e]);
        case 'string': case 'enum': return A.bin('<>', e, A.lit("''"));
        case 'bigint': return A.un('not', A.call(A.mem(e, 'IsZero')));
        case 'array': return A.un('not', A.call(A.mem(e, 'IsNull')));
        case 'class': case 'error': case 'map': return A.bin('<>', e, A.lit('nil'));
        case 'null': case 'void': return A.lit('False');
        case 'any': return A.call(A.mem(e, 'Truthy'));
        case 'function': return A.lit('True');
        case 'tuple': case 'record': return A.lit('True');
      }
      return A.lit('True');
    }

    /** JavaScript ToString as a string expression. */
    toStr(res) {
      const t = res.t, e = res.e;
      switch (t.k) {
        case 'string': case 'enum': return e;
        case 'int': return A.call('IntToStr', [e]);
        case 'float': return A.call('JsNumToStr', [e]);
        case 'bool': return A.call('JsBoolToStr', [e]);
        case 'bigint': return A.call(A.mem(e, 'ToString'), [A.lit(10)]);
        case 'null': return A.lit("'null'");
        case 'void': return A.lit("'undefined'");
        case 'any': return A.call('JsValToStr', [e]);
        case 'array': {
          const elemPas = this.aliasOf(t);
          if (['TA_Str', 'TA_U8', 'TA_I32', 'TA_U32', 'TA_U16', 'TA_F64', 'TA_Big'].includes(elemPas)) return A.call('JsJoin', [e, A.lit("','")]);
          return A.call('JsValToStr', [this.toJsValue(res)]);
        }
        case 'error': return A.bin('+', A.bin('+', A.mem(e, 'ClassName'), A.lit("': '")), A.mem(e, 'Message'));
        case 'class': return A.lit("'[object Object]'");
      }
      return A.lit("''");
    }

    /** A value as TJsValue. */
    toJsValue(res) {
      const t = res.t, e = res.e;
      if (res.isNull || isNullT(t)) return A.call('JsVNull');
      switch (t.k) {
        case 'any': return e;
        case 'int': return A.call(is64(t) && !t.signed ? 'JsVUInt' : 'JsVInt', [e]);
        case 'float': return A.call('JsVNum', [e]);
        case 'bool': return A.call('JsVBool', [e]);
        case 'string': case 'enum': return A.call('JsVStr', [e]);
        case 'bigint': return A.call('JsVBig', [e]);
        case 'class': case 'error': case 'map': return A.call('JsVObj', [e]);
        case 'array': return A.call(this.arrayToJsValue(t), [e]);
        case 'function': return A.call('JsVUndef');
      }
      fail(`cannot make a dynamic value of ${t.key}`);
    }

    /** A TJsValue expression as a type. */
    fromJsValue(e, to) {
      switch (to.k) {
        case 'any': return e;
        case 'int': return to.bits === 64 ? A.call(to.signed ? 'JsValToInt64' : 'JsValToUInt64', [e]) : A.cast(to.pas, A.call('JsValToInt64', [e]));
        case 'float': return A.call('JsValToDouble', [e]);
        case 'bool': return A.call('JsValToBool', [e]);
        case 'string': case 'enum': return A.call('JsValToStr', [e]);
        case 'bigint': return A.call('JsValToBig', [e]);
        case 'class':
          if (to.name === 'TestCase') return A.call('JsValToTestCase', [e]);
          // checked: a dynamic value of another class raises instead of corrupting memory
          return A.bin('as', A.call('JsValToObj', [e]), A.id(this.classPas(to.name)));
        case 'error': return A.cast('Exception', A.call('JsValToObj', [e]));
        case 'map': return A.cast('TJsMap', A.call('JsValToObj', [e]));
        case 'array': return A.call(this.jsValueToArray(to), [e]);
        case 'null': case 'void': return e;
      }
      fail(`cannot convert a dynamic value to ${to.key}`);
    }

    /** Name of a TJsValue -> array converter, generated when the runtime lacks it. */
    jsValueToArray(t) {
      const alias = this.aliasOf(t);
      if (RUNTIME_VALUE_CONVERTERS.has(alias)) return 'JsValTo_' + alias;
      const name = 'JsValTo_' + alias;
      if (!this.converters.has(name)) {
        this.converters.set(name, null);
        const body = [
          A.ifStmt(A.call(A.mem(A.id('V'), 'IsNullish')), [A.exit(A.call(A.mem(A.id(alias), 'Null')))]),
          A.assign(A.id('Result'), A.call(A.mem(A.id(alias), 'New'), [A.call('JsValLength', [A.id('V')])])),
          A.forStmt('I', A.lit(0), A.bin('-', A.mem(A.id('Result'), 'length'), A.lit(1)), false, [
            A.assign(A.idx(A.id('Result'), A.id('I')), this.fromJsValue(A.call('JsValElem', [A.id('V'), A.id('I')]), t.elem))
          ])
        ];
        this.converters.set(name, A.routine({ name, routineKind: 'function', params: [A.param('V', 'TJsValue', 'const')], returns: alias,
          vars: [{ name: 'I', type: 'Int32' }], body }));
      }
      return name;
    }

    /** Name of an array -> TJsValue constructor, generated when the runtime lacks it. */
    arrayToJsValue(t) {
      const alias = this.aliasOf(t);
      if (RUNTIME_VALUE_CONVERTERS.has(alias)) return 'JsVArr_' + alias.slice(3);
      const name = 'JsVArr_' + alias.slice(3);
      if (!this.converters.has(name)) {
        this.converters.set(name, null);
        const body = [
          A.ifStmt(A.call(A.mem(A.id('A'), 'IsNull')), [A.exit(A.call('JsVNull'))]),
          A.assign(A.id('Result'), A.call('Default', [A.id('TJsValue')])),
          A.assign(A.mem(A.id('Result'), 'Kind'), A.id('jvArr')),
          A.expr(A.call('System.SetLength', [A.mem(A.id('Result'), 'A'), A.mem(A.id('A'), 'length')])),
          A.forStmt('I', A.lit(0), A.bin('-', A.mem(A.id('A'), 'length'), A.lit(1)), false, [
            A.assign(A.idx(A.mem(A.id('Result'), 'A'), A.id('I')), this.toJsValue({ e: A.idx(A.id('A'), A.id('I')), t: t.elem }))
          ])
        ];
        this.converters.set(name, A.routine({ name, routineKind: 'function', params: [A.param('A', alias, 'const')], returns: 'TJsValue',
          vars: [{ name: 'I', type: 'Int32' }], body }));
      }
      return name;
    }

    /** Name of an element-wise array conversion routine. */
    arrayConverter(from, to) {
      const fa = this.aliasOf(from), ta = this.aliasOf(to);
      const name = 'JsConv_' + fa.slice(3) + '_To_' + ta.slice(3);
      if (!this.converters.has(name)) {
        this.converters.set(name, null);
        const savedFn = this.fn, savedPre = this.pre;
        this.fn = this.newFn({});
        this.pre = [];
        let elemConv;
        try {
          elemConv = this.conv({ e: A.idx(A.id('A'), A.id('I')), t: from.elem }, to.elem);
          if (this.pre.length) fail(`cannot convert ${from.key} to ${to.key} element-wise`);
        } finally {
          this.fn = savedFn;
          this.pre = savedPre;
        }
        const body = [
          A.ifStmt(A.call(A.mem(A.id('A'), 'IsNull')), [A.exit(A.call(A.mem(A.id(ta), 'Null')))]),
          A.assign(A.id('Result'), A.call(A.mem(A.id(ta), 'New'), [A.mem(A.id('A'), 'length')])),
          A.forStmt('I', A.lit(0), A.bin('-', A.mem(A.id('A'), 'length'), A.lit(1)), false, [A.assign(A.idx(A.id('Result'), A.id('I')), elemConv)])
        ];
        this.converters.set(name, A.routine({ name, routineKind: 'function', params: [A.param('A', fa, 'const')], returns: ta,
          vars: [{ name: 'I', type: 'Int32' }], body }));
      }
      return name;
    }

    // ------------------------------------------------------------ operators

    xBinaryExpression(node, expected) {
      const op = node.operator;
      const resT = this.typeOf(node, null);
      if (['==', '!=', '===', '!==', '<', '>', '<=', '>='].includes(op)) {
        const l = this.ex(node.left);
        const r = this.ex(node.right, l.t);
        const folded = this.foldTypeofCompare(op, l, r);
        if (folded) return folded;
        return { e: this.compare(op, l, r), t: T.bool };
      }
      if (op === 'instanceof') {
        const l = this.ex(node.left);
        if (isIdentifier(node.right) && this.classes.has(node.right.name)) return { e: A.bin('is', l.e, A.id(this.classes.get(node.right.name).pas)), t: T.bool };
        if (isIdentifier(node.right) && /^(Uint8Array|Array|Uint32Array|Uint16Array|Int32Array)$/.test(node.right.name))
          return { e: isArr(l.t) ? A.un('not', A.call(A.mem(l.e, 'IsNull'))) : A.lit('False'), t: T.bool };
        if (isIdentifier(node.right) && /Error$/.test(node.right.name)) return { e: A.bin('is', l.e, A.id('Exception')), t: T.bool };
        fail('instanceof ' + (node.right && node.right.name), node);
      }
      if (op === 'in') fail('the in operator is not supported', node);
      const l = this.ex(node.left);
      const r = this.ex(node.right);
      return this.arith(op, l, r, resT, node);
    }

    /** An arithmetic, bitwise or shift operation with JavaScript semantics and the IL's result type. */
    arith(op, l, r, resT, node) {
      if (op === '+' && (isStr(l.t) || isStr(r.t) || l.t.k === 'enum' || r.t.k === 'enum' || (resT && isStr(resT)))) {
        if (l.constStr !== undefined && r.constStr !== undefined) {
          const s = l.constStr + r.constStr;
          return { e: A.lit(pasString(s)), t: T.str, constStr: s };
        }
        return { e: A.bin('+', this.toStr(l), this.toStr(r)), t: T.str };
      }
      if (op === '**') return this.power(l, r, resT);
      const big = isBig(l.t) || isBig(r.t) || (resT && isBig(resT));
      if (big) {
        const shift = op === '<<' || op === '>>';
        const L = this.conv(l, T.big);
        const R = shift ? this.conv(r, T.int32) : this.conv(r, T.big);
        const pop = { '+': '+', '-': '-', '*': '*', '/': 'div', '%': 'mod', '&': 'and', '|': 'or', '^': 'xor', '<<': 'shl', '>>': 'shr' }[op];
        if (!pop) fail(`BigInt operator ${op}`, node);
        const res = { e: A.bin(pop, L, R), t: T.big };
        return resT && !isBig(resT) ? { e: this.conv(res, resT), t: resT } : res;
      }
      if (!resT || (!isNum(resT) && !isBool(resT))) {
        resT = isFloat(l.t) || isFloat(r.t) || op === '/' ? T.f64 : (is64(l.t) || is64(r.t) ? T.int64 : T.int32);
      }
      if (isBool(resT)) resT = T.int32;
      if (['&', '|', '^'].includes(op)) return this.bitwise(op, l, r, resT);
      if (['<<', '>>', '>>>'].includes(op)) return this.shift(op, l, r, resT);
      if (op === '/' || isFloat(resT) || isFloat(l.t) || isFloat(r.t) || l.t.k === 'any' || r.t.k === 'any') {
        // JavaScript division is a double; where the IL calls the quotient an
        // integer, the place that stores it truncates (JavaScript keeps the fraction)
        const L = this.dbl(l), R = this.dbl(r);
        let e;
        if (op === '%') e = A.call('JsFMod', [L, R]);
        else e = A.bin(op === '/' ? '/' : op, L, R);
        return { e, t: T.f64 };
      }
      // An inlined OpCodes operation (Add32, Sub32, Mul32, ...) is exact
      // modular arithmetic: computed in 64 bits and cast to its result type.
      if (node && node.opCodesMethod) {
        const dom = this.intDomain(l.t, r.t, resT);
        const L = this.convInt(l, dom), R = this.convInt(r, dom);
        const e = op === '%' ? A.bin('mod', L, R) : A.bin(op, L, R);
        return { e: this.castTo(resT, e, dom), t: resT };
      }
      // Two operands the IL types 64-bit (a BigInt may hold either): exact
      // 64-bit arithmetic, as BigInt's low bits are
      if (!this.isNumberOperand(l) && !this.isNumberOperand(r)) {
        const dom = this.intDomain(l.t, r.t, resT);
        const L = this.convInt(l, dom), R = this.convInt(r, dom);
        const e = op === '%' ? A.bin('mod', L, R) : A.bin(op, L, R);
        return { e, t: dom };
      }
      // JavaScript Number arithmetic. Its result is exact until 2^53 and only
      // the place it is stored, or an explicit |0 / >>>0 / mask, narrows it:
      // the IL's type of an intermediate result (`y * TABLE_SIZE` typed int32)
      // is not a wrap. Sums and differences are exact in Int64; a product
      // that can pass 2^53 is computed as JavaScript does, in Double, rounding
      // included (an LCG's 1103515245 * state + 12345 depends on it).
      const lw = this.bitWidth(l), rw = this.bitWidth(r);
      if (op === '*' && lw + rw > 53) {
        return { e: A.bin('*', this.dbl(l), this.dbl(r)), t: T.f64 };
      }
      const L = this.convInt(l, T.int64), R = this.convInt(r, T.int64);
      const e = op === '%' ? A.bin('mod', L, R) : A.bin(op, L, R);
      const bits = op === '*' ? lw + rw : op === '%' ? Math.min(lw, rw) : Math.max(lw, rw) + 1;
      return { e, t: T.int64, num: true, numBits: Math.min(bits, 63) };
    }

    /** Bits a Number operand can occupy (magnitude), for exactness of a product. */
    bitWidth(res) {
      if (res.constNum !== undefined) return Math.max(1, Math.ceil(Math.log2(Math.abs(res.constNum) + 1)));
      if (res.numBits !== undefined) return res.numBits;
      if (isInt(res.t)) return res.t.bits === 64 ? 53 : res.t.bits;
      return 53;
    }

    /** A value as a Double-typed Pascal expression (an integer operand alone would keep integer arithmetic). */
    dbl(res) {
      if (isFloat(res.t)) return res.e;
      if (res.constNum !== undefined && Number.isFinite(res.constNum)) return this.numLiteral(res.constNum, T.f64);
      if (isInt(res.t)) return A.call('JsDbl', [res.e]);
      return this.conv(res, T.f64);
    }

    /** Is the operand certainly a JavaScript Number (never a BigInt)? */
    isNumberOperand(res) {
      if (res.constNum !== undefined || res.num) return true;
      if (isFloat(res.t)) return true;
      return isInt(res.t) && res.t.bits <= 32;
    }

    /** The integer type an operation computes in. */
    intDomain(a, b, res) {
      const ts = [a, b, res].filter(isInt);
      if (ts.some(t => t.bits === 64 && !t.signed)) return T.uint64;
      if (ts.some(t => t.bits === 64)) return T.int64;
      // 32-bit operands: Int64 keeps every sum, difference and product of two
      // 32-bit values exact before the cast to the result type
      return T.int64;
    }

    convInt(res, dom) {
      if (isInt(res.t)) {
        if (res.constNum !== undefined) return res.e;
        if (res.t.key === dom.key) return res.e;
        if (dom.bits === 64 && res.t.bits < 64) return A.cast(dom.pas, res.e);
        return A.cast(dom.pas, res.e);
      }
      return this.conv(res, dom);
    }

    /** Cast an expression computed in `from` to the result type. */
    castTo(to, e, from) {
      if (from && to.key === from.key) return e;
      return A.cast(to.pas, e);
    }

    /** As a 32-bit pattern: JavaScript's ToInt32/ToUint32 of an operand. */
    bits32(res) {
      const t = res.t;
      if (res.constNum !== undefined && Number.isInteger(res.constNum)) {
        const v = res.constNum >>> 0;
        return A.lit(v > 0x7FFFFFFF ? '$' + v.toString(16).toUpperCase() : String(v));
      }
      if (isInt(t)) return t.key === 'uint32' ? res.e : A.cast('UInt32', res.e);
      if (isFloat(t)) return A.call('JsToUInt32', [res.e]);
      if (isBool(t)) return A.cast('UInt32', A.call('Ord', [res.e]));
      if (isBig(t)) return A.call(A.mem(res.e, 'ToUInt32'));
      return A.cast('UInt32', this.conv(res, T.int64));
    }

    bits64(res) {
      const t = res.t;
      if (res.constNum !== undefined && Number.isInteger(res.constNum)) return res.e;
      if (isInt(t)) return t.key === 'uint64' ? res.e : A.cast('UInt64', res.e);
      return this.conv(res, T.uint64);
    }

    bitwise(op, l, r, resT) {
      const pop = { '&': 'and', '|': 'or', '^': 'xor' }[op];
      if (isInt(resT) && resT.bits === 64) {
        const e = A.bin(pop, this.bits64(l), this.bits64(r));
        return { e: resT.key === 'uint64' ? e : A.cast(resT.pas, e), t: resT };
      }
      const e = A.bin(pop, this.bits32(l), this.bits32(r));
      if (isFloat(resT)) return { e: A.cast('Int32', e), t: T.int32 };
      return { e: resT.key === 'uint32' ? e : A.cast(resT.pas, e), t: resT };
    }

    shift(op, l, r, resT) {
      const amount = res => {
        if (res.constNum !== undefined) return A.lit(String(res.constNum & 31));
        return A.bin('and', this.conv(res, T.int32), A.lit('31'));
      };
      if (isInt(resT) && resT.bits === 64 && op !== '>>>') {
        // a 64-bit value (a BigInt at run time) shifted
        const n = this.conv(r, T.int32);
        let e;
        if (op === '<<') e = A.call('JsShl64', [this.bits64(l), n]);
        else e = resT.signed ? A.call('JsSar64', [this.conv(l, T.int64), n]) : A.call('JsShr64', [this.bits64(l), n]);
        return { e: resT.key === 'uint64' ? e : A.cast(resT.pas, e), t: resT };
      }
      let e;
      if (op === '<<') e = A.bin('shl', this.bits32(l), amount(r));
      else if (op === '>>>') e = A.bin('shr', this.bits32(l), amount(r));
      else e = A.call('SarLongint', [A.cast('Int32', this.bits32(l)), amount(r)]);
      const fromT = op === '>>' ? T.int32 : T.uint32;
      if (isFloat(resT)) return { e: op === '>>' ? e : A.cast(op === '>>>' ? 'UInt32' : 'Int32', e), t: op === '>>>' ? T.uint32 : T.int32 };
      return { e: resT.key === fromT.key && op !== '<<' ? e : A.cast(resT.pas, e), t: resT };
    }

    power(l, r, resT) {
      if (isBig(l.t) || isBig(r.t) || (resT && isBig(resT))) {
        const res = { e: A.call(A.mem(A.id('TBigInt'), 'Pow'), [this.conv(l, T.big), this.conv(r, T.int64)]), t: T.big };
        return resT && !isBig(resT) ? { e: this.conv(res, resT), t: resT } : res;
      }
      const res = { e: A.call('JsPow', [this.conv(l, T.f64), this.conv(r, T.f64)]), t: T.f64 };
      if (resT && isInt(resT)) return { e: this.conv(res, resT), t: resT };
      return res;
    }

    /** A comparison with JavaScript semantics. */
    compare(op, l, r) {
      const eq = op === '==' || op === '===';
      const ne = op === '!=' || op === '!==';
      const pop = eq ? '=' : ne ? '<>' : op;
      // null / undefined
      const lNull = l.isNull || isNullT(l.t), rNull = r.isNull || isNullT(r.t);
      if (lNull || rNull) {
        const v = lNull ? r : l;
        if (lNull && rNull) return A.lit(eq ? 'True' : 'False');
        let test;
        switch (v.t.k) {
          case 'array': test = A.call(A.mem(v.e, 'IsNull')); break;
          case 'class': case 'error': test = A.bin('=', v.e, A.lit('nil')); break;
          case 'any': test = A.call(A.mem(v.e, 'IsNullish')); break;
          case 'string': case 'enum': test = A.bin('=', v.e, A.lit("''")); break;
          default: test = A.lit('False');
        }
        if (!eq && !ne) fail('relational comparison with null');
        return eq ? test : A.un('not', test);
      }
      const lt = l.t, rt = r.t;
      if ((isStr(lt) || lt.k === 'enum') && (isStr(rt) || rt.k === 'enum')) return A.bin(pop, l.e, r.e);
      if (isBig(lt) || isBig(rt)) {
        if ((isNum(lt) || isBig(lt)) && (isNum(rt) || isBig(rt))) return A.bin(pop, this.conv(l, T.big), this.conv(r, T.big));
      }
      if (isNum(lt) && isNum(rt)) {
        if (isFloat(lt) || isFloat(rt)) return A.bin(pop, this.conv(l, T.f64), this.conv(r, T.f64));
        if ((lt.key === 'uint64' && rt.signed && r.constNum === undefined) || (rt.key === 'uint64' && lt.signed && l.constNum === undefined))
          return A.bin(pop, this.conv(l, T.f64), this.conv(r, T.f64));
        return A.bin(pop, l.e, r.e);
      }
      if (isBool(lt) && isBool(rt)) return A.bin(pop, l.e, r.e);
      if (isArr(lt) && isArr(rt) && (eq || ne)) {
        const same = A.call(A.mem(l.e, 'Same'), [this.conv(r, lt)]);
        return eq ? same : A.un('not', same);
      }
      if ((isClassT(lt) || lt.k === 'error') && (isClassT(rt) || rt.k === 'error')) return A.bin(pop, l.e, r.e);
      if (lt.k === 'any' || rt.k === 'any') {
        const other = lt.k === 'any' ? r : l;
        const dyn = lt.k === 'any' ? l : r;
        if (other.t.k === 'any') fail('comparison of two untyped values');
        const a = this.conv(dyn, other.t);
        return lt.k === 'any' ? A.bin(pop, a, other.e) : A.bin(pop, other.e, a);
      }
      if (isBool(lt) && isNum(rt)) return A.bin(pop, A.call('Ord', [l.e]), r.e);
      if (isNum(lt) && isBool(rt)) return A.bin(pop, l.e, A.call('Ord', [r.e]));
      if (isStr(lt) && isNum(rt)) return A.bin(pop, A.call('JsStrToNum', [l.e]), this.conv(r, T.f64));
      if (isNum(lt) && isStr(rt)) return A.bin(pop, this.conv(l, T.f64), A.call('JsStrToNum', [r.e]));
      if (eq || ne) return A.lit(ne ? 'True' : 'False');
      fail(`comparison of ${lt.key} with ${rt.key}`);
    }

    xLogicalExpression(node, expected) {
      const op = node.operator;
      let resT = this.typeOf(node, null);
      const l = this.ex(node.left, expected);
      // a left side the IL types decide: the right side is dead or is the result
      if (l.constBool !== undefined && (op === '&&' || op === '||')) {
        if ((op === '&&') !== l.constBool) return l;
        const r = this.ex(node.right, expected);
        if (r.constBool !== undefined || isBool(r.t)) return r;
        return { e: this.truthy(r), t: T.bool };
      }
      const [r, rPre] = this.capture(() => this.ex(node.right, expected || l.t));
      if (r.constBool !== undefined && rPre.length === 0 && (op === '&&' || op === '||') && (isBool(l.t) || (resT && isBool(resT)))) {
        if (op === '&&' && r.constBool === false) { this.discard(l); return r; }
        if (op === '||' && r.constBool === true) { this.discard(l); return r; }
        return { e: this.truthy(l), t: T.bool };
      }
      if (op === '??') {
        resT = resT && !isAnyT(resT) ? resT : l.t;
        const tmp = this.temp(resT, 'coalesce');
        this.emitPre(A.assign(A.id(tmp), this.conv(l, resT)));
        const isNullTest = this.compare('===', { e: A.id(tmp), t: resT }, { e: A.lit('nil'), t: T.null, isNull: true });
        this.emitPre(A.ifStmt(isNullTest, [...rPre, A.assign(A.id(tmp), this.conv(r, resT))]));
        return { e: A.id(tmp), t: resT };
      }
      const boolResult = (resT && isBool(resT)) || (isBool(l.t) && isBool(r.t));
      if (boolResult && rPre.length === 0) {
        return { e: A.bin(op === '&&' ? 'and' : 'or', this.truthy(l), this.truthy(r)), t: T.bool };
      }
      if (!resT || isAnyT(resT) || isNullT(resT)) resT = isNullT(l.t) ? r.t : l.t;
      if (boolResult) resT = T.bool;
      const tmp = this.temp(resT, op === '&&' ? 'and' : 'or');
      this.emitPre(A.assign(A.id(tmp), this.conv(l, resT)));
      const test = this.truthy({ e: A.id(tmp), t: resT });
      this.emitPre(A.ifStmt(op === '&&' ? test : A.un('not', test), [...rPre, A.assign(A.id(tmp), this.conv(r, resT))]));
      return { e: A.id(tmp), t: resT };
    }

    xConditionalExpression(node, expected) {
      let resT = this.typeOf(node, null);
      if (!resT || isAnyT(resT) || isNullT(resT)) resT = expected && !isAnyT(expected) ? expected : null;
      const test = this.ex(node.test);
      if (test.constBool !== undefined) {
        const live = this.ex(test.constBool ? node.consequent : node.alternate, resT || expected);
        return resT && live.t.key !== resT.key ? { e: this.conv(live, resT), t: resT } : live;
      }
      const cond = this.truthy(test);
      const [a, aPre] = this.capture(() => this.ex(node.consequent, resT || expected));
      const [b, bPre] = this.capture(() => this.ex(node.alternate, resT || expected || a.t));
      if (!resT) resT = isNullT(a.t) ? b.t : a.t;
      const tmp = this.temp(resT, 'cond');
      this.emitPre(A.ifStmt(cond, [...aPre, A.assign(A.id(tmp), this.conv(a, resT))], [...bPre, A.assign(A.id(tmp), this.conv(b, resT))]));
      return { e: A.id(tmp), t: resT };
    }

    xUnaryExpression(node, expected, forEffect) {
      const op = node.operator;
      if (op === '++' || op === '--')
        return this.xUpdateExpression({ type: 'UpdateExpression', operator: op, argument: node.argument, prefix: node.prefix !== false }, expected, forEffect);
      const resT = this.typeOf(node, null);
      if (op === '!') {
        const a = this.ex(node.argument);
        if (a.constBool !== undefined) return { e: A.lit(a.constBool ? 'False' : 'True'), t: T.bool, constBool: !a.constBool };
        return { e: A.un('not', this.truthy(a)), t: T.bool };
      }
      if (op === 'typeof') return this.typeofArgument(node.argument);
      if (op === 'void') { const r = this.ex(node.argument); this.discard(r); return { e: A.lit('nil'), t: T.null, isNull: true }; }
      if (op === 'delete') fail('delete is not supported', node);
      const a = this.ex(node.argument, op === '-' ? expected : null);
      if (op === '+') return { e: this.conv(a, isNum(a.t) ? a.t : T.f64), t: isNum(a.t) ? a.t : T.f64 };
      if (op === '-') {
        if (a.constNum !== undefined) {
          const v = -a.constNum;
          const t = resT && isNum(resT) ? resT : a.t;
          return { e: this.numLiteral(v, t), t, constNum: v };
        }
        if (isBig(a.t)) return { e: A.un('-', a.e), t: T.big };
        if (isFloat(a.t) || (resT && isFloat(resT))) return { e: A.un('-', this.conv(a, T.f64)), t: T.f64 };
        const t = resT && isInt(resT) ? resT : (isInt(a.t) && a.t.signed ? a.t : T.int64);
        const dom = is64(t) && !t.signed ? T.uint64 : T.int64;
        return { e: this.castTo(t, A.un('-', this.convInt(a, dom)), dom), t };
      }
      if (op === '~') {
        if (isBig(a.t)) return { e: A.un('not', a.e), t: T.big };
        const t = resT && isInt(resT) ? resT : T.int32;
        if (t.bits === 64) { const e = A.un('not', this.bits64(a)); return { e: t.key === 'uint64' ? e : A.cast(t.pas, e), t }; }
        const e = A.un('not', this.bits32(a));
        return { e: t.key === 'uint32' ? e : A.cast(t.pas, e), t };
      }
      fail('unary ' + op, node);
    }

    typeofOf(a) {
      if (a.t.k === 'any') return { e: A.call('JsTypeOf', [a.e]), t: T.str, typeofOf: a };
      const name = { int: 'number', float: 'number', bool: 'boolean', string: 'string', bigint: 'bigint', function: 'function', enum: 'object' }[a.t.k] || 'object';
      return { e: A.lit(pasString(name)), t: T.str, constStr: name, typeofOf: a };
    }

    /**
     * typeof x === 'name' decided by the IL type of x: a constant, except
     * 'undefined' of a reference (its null) and anything of an untyped value.
     * @returns {object|null} { e, t, constBool } or null when not a typeof test
     */
    foldTypeofCompare(op, l, r) {
      const eq = op === '==' || op === '===';
      if (!eq && op !== '!=' && op !== '!==') return null;
      const tf = l.typeofOf ? l : r.typeofOf ? r : null;
      const other = tf === l ? r : l;
      if (!tf || other.constStr === undefined) return null;
      const v = tf.typeofOf;
      if (v.t.k === 'any') return null;
      let res;
      if (v.t.k === 'void') {
        res = tf.constStr === other.constStr;
      } else if (other.constStr === 'undefined') {
        if (isRef(v.t) || isStr(v.t)) {
          const test = this.compare('===', v, { e: A.lit('nil'), t: T.null, isNull: true });
          return { e: eq ? test : A.un('not', test), t: T.bool };
        }
        res = false;
      } else {
        res = tf.constStr === other.constStr;
      }
      const value = eq ? res : !res;
      return { e: A.lit(value ? 'True' : 'False'), t: T.bool, constBool: value };
    }

    xTypeOfExpression(node) {
      return this.typeofArgument(node.argument || node.value);
    }

    /** typeof of an expression; of a name nothing declares (module, define, window, ...) it is 'undefined'. */
    typeofArgument(arg) {
      if (arg && arg.type === 'Identifier' && !this.lookup(arg.name) && !this.globals.has(arg.name) && !this.functions.has(arg.name) &&
          !this.classes.has(arg.name) && !this.libraries.has(arg.name) && !this.libraryAliases.has(arg.name) && !this.libraryImports.has(arg.name))
        return { e: A.lit("'undefined'"), t: T.str, constStr: 'undefined', typeofOf: { e: A.lit('nil'), t: T.void } };
      return this.typeofOf(this.ex(arg));
    }

    discard(res) {
      if (res && res.e && res.e.kind === 'call') this.emitPre(A.expr(res.e));
    }

    // ------------------------------------------------------------ assignment

    xAssignmentExpression(node, expected, forEffect) {
      const stmts = this.assignment(node, !forEffect);
      for (const s of [].concat(stmts.stmts || stmts)) if (s) this.emitPre(s);
      if (forEffect) return { e: null, t: T.void };
      return stmts.value;
    }

    /**
     * An assignment: the statements, and (when the value is wanted) an expression for it.
     * @returns {object[]|{stmts, value}}
     */
    assignment(node, wantValue) {
      const op = node.operator;
      if (op === '=' && (node.left.type === 'ArrayExpression' || node.left.type === 'ArrayPattern' || node.left.type === 'ArrayLiteral')) {
        const stmts = this.destructuringAssignment(node.left.elements, node.right);
        return wantValue ? { stmts, value: { e: null, t: T.void } } : stmts;
      }
      if (node.left.type === 'ThisPropertyAccess' && !this.fn.cls)
        return wantValue ? { stmts: [], value: this.ex(node.right) } : [A.comment('a property of the global object is not kept')];
      const target = this.lvalue(node.left);
      let stmts = [];
      if (op === '=') {
        try {
          stmts = this.assignTo(target, node.right);
        } catch (e) {
          // algorithm metadata JavaScript never reads back, assigned a shape the framework does not declare
          if (!(e instanceof TranspileError) || !target.member || !METADATA_FIELDS.has(target.member.jsName) || !target.member.owner.isFramework) throw e;
          this.diagnostics.push(`metadata ${target.member.jsName} not representable: ${e.message}`);
          stmts = [A.comment(`${target.member.jsName}: ${e.message}`)];
        }
      } else {
        const binop = op.slice(0, -1);
        const cur = target.read();
        let res;
        if (binop === '&&' || binop === '||' || binop === '??') {
          const fake = { type: 'LogicalExpression', operator: binop, left: { type: '__Compiled', res: cur }, right: node.right, resultType: target.t.key };
          res = this.ex(fake);
        } else {
          const rhs = this.ex(node.right);
          res = this.arith(binop, cur, rhs, target.t, node);
        }
        stmts = [target.write(this.conv(res, target.t))];
      }
      if (!wantValue) return stmts;
      return { stmts, value: target.read() };
    }

    x__Compiled(node) {
      return node.res;
    }

    /** [a, b] = [x, y] (every value is read before any target is written) or [a, b] = array. */
    destructuringAssignment(targets, rightNode) {
      const out = [];
      const values = [];
      if (rightNode.type === 'ArrayExpression' || rightNode.type === 'ArrayLiteral') {
        rightNode.elements.forEach((el, i) => {
          const r = this.ex(el);
          const tmp = this.temp(r.t, 'd');
          out.push(A.assign(A.id(tmp), r.e));
          values.push({ e: A.id(tmp), t: r.t });
        });
      } else {
        const src = this.ex(rightNode);
        const tmp = this.temp(src.t, 'd');
        out.push(A.assign(A.id(tmp), src.e));
        targets.forEach((el, i) => values.push(this.indexValue({ e: A.id(tmp), t: src.t }, { e: A.lit(i), t: T.int32, constNum: i }, i)));
      }
      targets.forEach((el, i) => {
        if (!el || !values[i]) return;
        const [stmt, pre] = this.capture(() => {
          const target = this.lvalue(el);
          return target.write(this.conv(values[i], target.t));
        });
        out.push(...pre, stmt);
      });
      return out;
    }

    /** Statements assigning an IL value node to a target. */
    assignTo(target, valueNode) {
      const [res, pre] = this.capture(() => this.ex(valueNode, target.t));
      const out = [...pre];
      if (target.write) out.push(target.write(this.conv(res, target.t)));
      else out.push(A.assign(target.e, this.conv(res, target.t)));
      return out;
    }

    /** An assignable place: { t, read(), write(valueExpr) }. */
    lvalue(node) {
      switch (node.type) {
        case 'Identifier': {
          const v = this.xIdentifier(node);
          if (!v.lvalue) fail('assignment to ' + node.name, node);
          return { t: v.t, e: v.e, read: () => ({ e: v.e, t: v.t }), write: val => A.assign(v.e, val) };
        }
        case 'ThisPropertyAccess':
        case 'MemberExpression': {
          if (node.type === 'MemberExpression' && node.computed) {
            const o = this.ex(node.object);
            const i = this.ex(node.property);
            if (o.t.k === 'array') {
              const arrE = this.stable(o);
              const idxE = this.stable({ e: this.conv(i, T.int32), t: T.int32 });
              return { t: o.t.elem, read: () => ({ e: A.idx(arrE, idxE), t: o.t.elem }), write: val => A.assign(A.idx(arrE, idxE), val) };
            }
            if (o.t.k === 'tuple' || o.t.k === 'record') {
              const v = this.indexValue(o, i, node.property.type === 'Literal' ? node.property.value : null, node);
              return { t: v.t, read: () => v, write: val => A.assign(v.e, val) };
            }
            fail(`assignment into ${o.t.key}[...]`, node);
          }
          const v = node.type === 'ThisPropertyAccess' ? this.xThisPropertyAccess(node) : this.xMemberExpression(node);
          if (v.dynamicField) {
            const objE = v.dynamicField.obj;
            return { t: T.any, read: () => v, write: val => A.expr(A.call(A.mem(objE, 'SetField'), [A.lit(pasString(v.dynamicField.name)), val])) };
          }
          if (v.dynamicMember) {
            const objE = v.dynamicMember.obj;
            return { t: T.any, read: () => v, write: val => A.expr(A.call(v.dynamicMember.set || 'JsValSet', [objE, A.lit(pasString(v.dynamicMember.name)), val])) };
          }
          if (v.member && v.member.kind === 'prop' && !v.member.setter && !v.member.setterPas && !(v.member.overrides && (v.member.overrides.setter || v.member.overrides.setterPas)))
            fail(`assignment to getter-only property ${v.member.jsName}`, node);
          if (!v.lvalue) fail('assignment to a read-only member', node);
          return { t: v.t, read: () => ({ e: v.e, t: v.t }), write: val => A.assign(v.e, val), member: v.member };
        }
        case 'ArrayLength': {
          const o = this.ex(node.array);
          if (!isArr(o.t)) fail('length assignment to ' + o.t.key, node);
          const arrE = this.stable(o);
          return { t: T.int32, read: () => ({ e: A.mem(arrE, 'length'), t: T.int32 }), write: val => A.assign(A.mem(arrE, 'length'), val) };
        }
        default:
          fail('assignment to ' + node.type, node);
      }
    }

    /** An expression evaluated once: simple ones as they are, others into a temp. */
    stable(res) {
      if (this.isSimple(res.e)) return res.e;
      const tmp = this.temp(res.t, 'v');
      this.emitPre(A.assign(A.id(tmp), res.e));
      return A.id(tmp);
    }

    isSimple(e) {
      if (!e) return true;
      if (e.kind === 'id' || e.kind === 'lit') return true;
      if (e.kind === 'mem') return this.isSimple(e.obj) && e.obj.kind !== 'call';
      if (e.kind === 'cast') return this.isSimple(e.e);
      if (e.kind === 'bin') return this.isSimple(e.l) && this.isSimple(e.r) && !['div', 'mod', '/'].includes(e.op);
      return false;
    }

    xUpdateExpression(node, expected, forEffect) {
      if (forEffect) { for (const s of [].concat(this.update(node, false))) this.emitPre(s); return { e: null, t: T.void }; }
      const r = this.update(node, true);
      for (const s of r.stmts) this.emitPre(s);
      return r.value;
    }

    update(node, wantValue) {
      if (!wantValue && node.argument.type === 'Identifier') {
        const v = this.lookup(node.argument.name);
        if (v && (v.kind === 'local' || v.kind === 'param') && isInt(v.type) && !v.outer)
          return [A.expr(A.call(node.operator === '++' ? 'Inc' : 'Dec', [A.id(v.pas)]))];
      }
      const target = this.lvalue(node.argument);
      const one = { e: A.lit(1), t: T.int32, constNum: 1 };
      const stmts = [];
      let value = null;
      if (wantValue && !node.prefix) {
        const tmp = this.temp(target.t, 'old');
        stmts.push(A.assign(A.id(tmp), target.read().e));
        value = { e: A.id(tmp), t: target.t };
      }
      const res = this.arith(node.operator === '++' ? '+' : '-', target.read(), one, target.t, node);
      stmts.push(target.write(this.conv(res, target.t)));
      if (!wantValue) return stmts;
      if (node.prefix) value = target.read();
      return { stmts, value };
    }

    xSequenceExpression(node, expected, forEffect) {
      let last = null;
      node.expressions.forEach((x, i) => {
        if (i < node.expressions.length - 1) {
          const r = this.expressionStatement(x);
          if (r) for (const s of [].concat(r)) this.emitPre(s);
        } else last = this.ex(x, expected, forEffect);
      });
      return last;
    }

    // ------------------------------------------------------------ calls

    /** Compile arguments against parameters (missing ones take the default value). */
    args(argNodes, params, node) {
      const out = [];
      const nodes = argNodes || [];
      if (nodes.some(a => a && a.type === 'SpreadElement') && !params.some(p => p.rest)) fail('spread arguments are not supported', node);
      params.forEach((p, i) => {
        if (p.rest) {
          const rest = nodes.slice(i).map(a => this.ex(a, p.type.elem));
          out.push(A.call(A.mem(A.id(this.aliasOf(p.type)), 'From'), [A.arr(rest.map(r => this.conv(r, p.type.elem)))]));
          return;
        }
        if (i < nodes.length && nodes[i]) {
          out.push(this.conv(this.ex(nodes[i], p.type), p.type));
        } else if (p.defaultNode) {
          out.push(this.conv(this.defaultArgument(p.defaultNode, p.type, params.slice(0, i), out), p.type));
        } else if (p.defText) {
          out.push(p.defText === 'null' ? this.nullValue(p.type) : A.lit(p.defText));
        } else {
          out.push(this.defaultValue(p.type));
        }
      });
      // extra arguments are evaluated for their side effects only
      for (let i = params.length; i < nodes.length; ++i) {
        const r = this.ex(nodes[i]);
        this.discard(r);
      }
      return out;
    }

    /**
     * A parameter default evaluated at the call site. It may read the earlier
     * parameters (`n = data.length`): those arguments are held in temporaries
     * and the default sees them under the parameter names.
     */
    defaultArgument(defaultNode, type, earlier, out) {
      const used = new Set();
      const visit = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if (n.type === 'Identifier') used.add(n.name);
        for (const k in n) { if (k === 'typeInfo' || k === 'range' || k === 'loc') continue; const v = n[k]; if (v && typeof v === 'object') visit(v); }
      };
      visit(defaultNode);
      const bound = earlier.map((p, j) => [p, j]).filter(([p]) => !p.rest && used.has(p.jsName));
      if (!bound.length) return this.ex(defaultNode, type);
      this.pushScope();
      try {
        for (const [p, j] of bound) {
          const tmp = this.temp(p.type, p.jsName);
          this.emitPre(A.assign(A.id(tmp), out[j]));
          out[j] = A.id(tmp);
          this.fn.scopes[this.fn.scopes.length - 1].set(p.jsName, { pas: tmp, type: p.type, kind: 'local' });
        }
        return this.ex(defaultNode, type);
      } finally {
        this.popScope();
      }
    }

    xThisMethodCall(node) {
      const c = this.fn.cls;
      if (!c) fail('this.method() outside a class', node);
      const self = this.fn.isStatic ? A.id(c.pas) : A.id('Self');
      return this.methodCall({ e: self, t: tClass(c.jsName) }, node.method, node.arguments, node);
    }

    /** obj.method(args) on a value of known class. */
    methodCall(obj, name, argNodes, node) {
      const t = obj.t;
      if (t.k === 'class') {
        const c = this.classes.get(t.name);
        if (!c) fail(`method ${name} of unknown class ${t.name}`, node);
        if (c.jsName === 'BlockAbsorber' && name === 'Finish') return this.absorberFinish(obj, argNodes, node);
        let m = this.findMember(c, name);
        if (!m) m = this.memberFromSubclass(c, name, node, true);
        if (!m) {
          // declared by no class the value can be: invoked by name at run time
          const dynArgs = (argNodes || []).map(a => this.toJsValue(this.ex(a)));
          return { e: A.call('JsObjCall', [obj.e, A.lit(pasString(name)), A.arr(dynArgs)]), t: T.any, stmtOk: true };
        }
        if (m.kind === 'prop' || m.kind === 'field') {
          if (m.type && m.type.k === 'function') fail(`call through function-valued member ${name}`, node);
          fail(`${name} is not a method`, node);
        }
        const params = m.params || [];
        const args = this.args(argNodes, params, node);
        if (m.castTo && c.isFramework && !m.owner.isFramework && !m.static) {
          // as for members: the object may be another unit's subclass
          const dynArgs = args.map((a, i) => this.toJsValue({ e: a, t: params[i] ? params[i].type : T.any }));
          const call = A.call('JsObjCall', [obj.e, A.lit(pasString(name)), A.arr(dynArgs)]);
          const ret = m.ret || T.void;
          if (ret.k === 'void') return { e: call, t: T.any, stmtOk: true };
          return { e: isAnyT(ret) ? call : this.fromJsValue(call, ret), t: ret, stmtOk: true };
        }
        const base = m.static ? A.id(m.owner.pas) : (m.castTo ? A.cast(m.castTo, obj.e) : obj.e);
        const e = A.call(A.mem(base, m.pas), args);
        const ret = m.ret || T.void;
        return { e, t: ret.k === 'void' ? T.void : ret, stmtOk: true };
      }
      if (t.k === 'map') return this.mapCall(obj, name, argNodes || [], node);
      return this.builtinMethodCall(obj, name, argNodes, node);
    }

    /** Methods of numbers, strings and arrays the IL left as calls. */
    builtinMethodCall(obj, name, argNodes, node) {
      const t = obj.t;
      const args = argNodes || [];
      if (name === 'toString') {
        if (args.length && (isInt(t) || isFloat(t) || isBig(t))) {
          const radix = this.conv(this.ex(args[0]), T.int32);
          if (isBig(t)) return { e: A.call(A.mem(obj.e, 'ToString'), [radix]), t: T.str };
          if (isFloat(t)) return { e: A.call('JsNumToStrRadix', [obj.e, radix]), t: T.str };
          return { e: A.call(t.bits === 64 && !t.signed ? 'JsUIntToStrRadix' : 'JsIntToStrRadix', [obj.e, radix]), t: T.str };
        }
        return { e: this.toStr(obj), t: T.str };
      }
      if (isArr(t)) {
        switch (name) {
          case 'every': case 'some': case 'find': case 'findIndex': case 'reduce':
            return this.arrayCallback(name, obj, args, node);
        }
      }
      if (isStr(t) || t.k === 'enum') {
        const S = { type: '__Compiled', res: obj };
        switch (name) {
          case 'charCodeAt': return { e: A.call('JsCharCodeAt', [obj.e, args[0] ? this.conv(this.ex(args[0]), T.int32) : A.lit(0)]), t: T.int32 };
          case 'codePointAt': return { e: A.call('JsCodePointAt', [obj.e, args[0] ? this.conv(this.ex(args[0]), T.int32) : A.lit(0)]), t: T.int32 };
          case 'toLowerCase': case 'toUpperCase': case 'trim': case 'trimStart': case 'trimEnd':
            return this.xStringTransform({ string: S, method: name });
          case 'charAt': return this.xStringCharAt({ string: S, index: args[0] });
          case 'split': return this.xStringSplit({ string: S, separator: args[0] });
          case 'indexOf': case 'lastIndexOf': return this.xStringIndexOf({ string: S, searchValue: args[0], fromIndex: args[1], method: name });
          case 'includes': case 'startsWith': case 'endsWith': return this.xStringIncludes({ string: S, searchValue: args[0], method: name });
          case 'substring': case 'slice': return this.xStringSubstring({ string: S, start: args[0], end: args[1], method: name });
          case 'substr': return this.xStringSubstring({ string: S, start: args[0], length: args[1] });
          case 'repeat': return this.xStringRepeat({ string: S, count: args[0] });
          case 'padStart': case 'padEnd': return this.xStringPad({ string: S, targetLength: args[0], padString: args[1], method: name });
          case 'replace': case 'replaceAll': return this.xStringReplace({ string: S, searchValue: args[0], replaceValue: args[1], method: name });
          case 'concat': return this.xStringConcat({ string: S, values: args });
          case 'localeCompare': {
            const other = this.conv(this.ex(args[0]), T.str);
            return { e: A.call('CompareStr', [obj.e, other]), t: T.int32 };
          }
        }
      }
      if (isFloat(t) || isInt(t)) {
        if (name === 'toFixed') fail('toFixed is not supported', node);
      }
      fail(`method ${name} of ${t.key}`, node);
    }

    xCallExpression(node, expected) {
      const callee = node.callee;
      if (callee.type === 'Super') return this.xParentConstructorCall(node);
      if (callee.type === 'Identifier') return this.callIdentifier(callee.name, node, expected);
      if (callee.type === 'FunctionExpression' || callee.type === 'ArrowFunction' || callee.type === 'ArrowFunctionExpression') {
        // an immediately invoked function: a nested routine called in place
        const entry = this.inlineLambda(callee);
        const args = this.args(node.arguments, entry.params, node);
        return { e: A.call(A.id(entry.pas), args), t: entry.ret, stmtOk: true };
      }
      if (callee.type === 'MemberExpression' && !callee.computed) {
        const name = callee.property.name || callee.property.value;
        const obj = callee.object;
        if (obj.type === 'Identifier' && !this.lookup(obj.name) && !this.globals.has(obj.name)) {
          const r = this.staticCall(obj.name, name, node, expected);
          if (r) return r;
        }
        if (obj.type === 'Super') fail('super.method() is not supported', node);
        if (name === 'apply' && obj.type === 'MemberExpression' && isIdentifier(obj.object, 'String') && (obj.property.name === 'fromCharCode'))
          return this.xStringFromCharCodes({ charCodes: [{ type: 'SpreadElement', argument: node.arguments[1] }] });
        if (obj.type === 'Literal' && obj.regex) {
          if (name !== 'test') fail('regular expression method ' + name, node);
          return { e: A.call('JsRegexTest', [A.lit(pasString(obj.regex.pattern)), A.lit(pasString(obj.regex.flags || '')), this.conv(this.ex(node.arguments[0]), T.str)]), t: T.bool };
        }
        const o = this.ex(obj);
        return this.methodCall(o, name, node.arguments, node);
      }
      fail('call of ' + callee.type, node);
    }

    callIdentifier(name, node, expected) {
      const v = this.lookup(name);
      if (v && v.kind === 'nestedFn') {
        const args = this.args(node.arguments, v.params, node);
        return { e: A.call(A.id(v.pas), args), t: v.ret.k === 'void' ? T.void : v.ret, stmtOk: true };
      }
      if (v) fail(`call through function value ${name}`, node);
      if (this.functions.has(name)) {
        const f = this.functions.get(name);
        const args = this.args(node.arguments, f.params, node);
        return { e: A.call(A.id(f.pas), args), t: f.ret.k === 'void' ? T.void : f.ret, stmtOk: true };
      }
      const args = node.arguments || [];
      switch (name) {
        case 'RegisterAlgorithm':
          return { e: A.call('RegisterAlgorithm', [this.conv(this.ex(args[0]), tClass('Algorithm'))]), t: T.void, stmtOk: true };
        case 'MerkleDamgardBlocks':
          return { e: A.call('MerkleDamgardBlocks', [this.conv(this.ex(args[0]), tArr(T.uint8)), this.conv(this.ex(args[1]), T.int32),
            this.conv(this.ex(args[2]), T.uint64), this.mdOptions(args[3])]), t: tArr(tArr(T.uint8)) };
        case 'SpongePadBlocks':
          return { e: A.call('SpongePadBlocks', [this.conv(this.ex(args[0]), tArr(T.uint8)), this.conv(this.ex(args[1]), T.int32),
            this.conv(this.ex(args[2]), T.int32), this.conv(this.ex(args[3]), T.int32)]), t: tArr(tArr(T.uint8)) };
        case 'BigInt': return { e: this.conv(this.ex(args[0]), T.big), t: T.big };
        case 'Number': {
          const a = this.ex(args[0]);
          const t = this.typeOf(node, T.f64);
          return { e: this.conv(a, isNum(t) ? t : T.f64), t: isNum(t) ? t : T.f64 };
        }
        case 'String': return { e: this.toStr(this.ex(args[0])), t: T.str };
        case 'Boolean': return { e: this.truthy(this.ex(args[0])), t: T.bool };
        case 'parseInt': {
          const s = this.conv(this.ex(args[0]), T.str);
          const radix = args[1] ? this.conv(this.ex(args[1]), T.int32) : A.lit(10);
          const res = { e: A.call('JsParseInt', [s, radix]), t: T.f64 };
          const t = this.typeOf(node, T.f64);
          return isInt(t) ? { e: this.conv(res, t), t } : res;
        }
        case 'parseFloat': return { e: A.call('JsParseFloat', [this.conv(this.ex(args[0]), T.str)]), t: T.f64 };
        case 'Array':
          // Array(n) without new: n empty slots, like new Array(n)
          if (args.length === 1 && isNum(this.typeOf(args[0], T.any))) return this.xArrayCreation(Object.assign({}, node, { size: args[0] }), expected);
          fail('Array() with elements is not supported', node);
          break;
        case 'isNaN': return { e: A.call('IsNan', [this.conv(this.ex(args[0]), T.f64)]), t: T.bool };
        case 'isFinite': { const a = this.conv(this.ex(args[0]), T.f64); return { e: A.un('not', A.bin('or', A.call('IsNan', [a]), A.call('IsInfinite', [a]))), t: T.bool }; }
      }
      if (this.classes.has(name)) fail(`class ${name} called without new`, node);
      fail(`call of unknown function ${name}`, node);
    }

    /** Calls through a namespace or class: AlgorithmFramework.Find, Foo.staticMethod, Math.x, ... */
    staticCall(objName, name, node, expected) {
      const args = node.arguments || [];
      const lib = this.libraries.get(objName) || this.libraryAliases.get(objName);
      if (lib) {
        const member = this.libraryMember(lib, name, node);
        if (!member.globalFn) fail(`${objName}.${name} is not a function`, node);
        const f = member.globalFn;
        return { e: A.call(A.id(f.pas), this.args(args, f.params, node)), t: f.ret.k === 'void' ? T.void : f.ret, stmtOk: true };
      }
      const c = this.classes.get(objName);
      if (c && !c.isFramework) {
        const m = this.findMember(c, name);
        if (!m || !m.static || m.kind !== 'method') fail(`${objName}.${name} is not a static method`, node);
        return { e: A.call(A.mem(A.id(m.owner.pas), m.pas), this.args(args, m.params, node)), t: m.ret.k === 'void' ? T.void : m.ret, stmtOk: true };
      }
      if (objName === 'AlgorithmFramework') {
        if (name === 'Find') return { e: A.call('JsFindAlgorithm', [this.conv(this.ex(args[0]), T.str)]), t: tClass('Algorithm') };
        if (name === 'RegisterAlgorithm') return this.callIdentifier('RegisterAlgorithm', node, expected);
        if (name === 'MerkleDamgardBlocks' || name === 'SpongePadBlocks') return this.callIdentifier(name, node, expected);
      }
      if (objName === 'OpCodes') return this.xOpCodesCall({ type: 'OpCodesCall', method: name, arguments: args, resultType: node.resultType }, expected);
      if (objName === 'Math') return this.xMathCall({ type: 'MathCall', method: name, arguments: args, resultType: node.resultType });
      if (objName === 'Number') {
        if (name === 'isInteger' || name === 'isSafeInteger') return { e: A.call('JsIsInteger', [this.conv(this.ex(args[0]), T.f64)]), t: T.bool };
        if (name === 'isNaN') return { e: A.call('IsNan', [this.conv(this.ex(args[0]), T.f64)]), t: T.bool };
        if (name === 'parseInt') return this.callIdentifier('parseInt', node, expected);
      }
      if (objName === 'BigInt') {
        if (name === 'asUintN' || name === 'asIntN')
          return { e: A.call(A.mem(A.id('TBigInt'), name === 'asUintN' ? 'AsUintN' : 'AsIntN'), [this.conv(this.ex(args[0]), T.int32), this.conv(this.ex(args[1]), T.big)]), t: T.big };
      }
      if (objName === 'console') return { e: null, t: T.void };
      if ((objName === 'performance' || objName === 'Date') && name === 'now') return { e: A.call('JsNowMs'), t: T.f64 };
      if (objName === 'ArrayBuffer' && name === 'isView') return this.xIsArrayCheck({ value: args[0] });
      if (objName === 'String' && name === 'fromCharCode') return this.xStringFromCharCodes({ charCodes: args });
      if (objName === 'Array' && name === 'isArray') return this.xIsArrayCheck({ value: args[0] });
      if (objName === 'Object' && name === 'freeze') return this.ex(args[0], expected);
      return null;
    }

    xNewExpression(node, expected) {
      let callee = node.callee;
      if (callee.type === 'MemberExpression' && !callee.computed) {
        // new Library.Class(...)
        const ref = this.ex(callee);
        if (!ref.classRef) fail('new of a member that is not a class', node);
        callee = { type: 'Identifier', name: ref.classRef.jsName, classInfo: ref.classRef };
      }
      if (!isIdentifier(callee)) fail('new of ' + callee.type, node);
      const name = callee.name;
      const c = callee.classInfo || this.classes.get(name);
      if (!c) fail(`new of unknown class ${name}`, node);
      if (name === 'BlockAbsorber') {
        const args = node.arguments || [];
        const size = this.conv(this.ex(args[0]), T.int32);
        const cb = args[1];
        if (!cb || !(cb.type === 'ArrowFunction' || cb.type === 'ArrowFunctionExpression' || cb.type === 'FunctionExpression'))
          fail('BlockAbsorber needs an inline callback', node);
        const method = this.methodLambda(cb, [tArr(T.uint8)]);
        return { e: A.call(A.mem(A.id('TBlockAbsorber'), 'Create'), [size, method]), t: tClass('BlockAbsorber') };
      }
      if (name === 'TestCase' || (c.isFramework && c.ctorParams)) {
        const args = this.args(node.arguments, c.ctorParams, node);
        return { e: A.call(A.mem(A.id(c.pas), 'Create'), args), t: tClass(name) };
      }
      const params = this.ctorParamsOf(c) || [];
      const args = this.args(node.arguments, params, node);
      return { e: A.call(A.mem(A.id(c.pas), 'Create'), args), t: tClass(name), stmtOk: true };
    }

    xParentConstructorCall(node) {
      if (!this.fn.cls || !this.fn.isCtor) fail('super() outside a constructor', node);
      const base = this.fn.cls.base;
      const params = base ? this.ctorParamsOf(base) : [];
      const args = this.args(node.arguments, params, node);
      this.emitPre(A.expr(A.call(A.raw('inherited Create'), args)));
      return { e: null, t: T.void };
    }

    xParentMethodCall(node) {
      const c = this.fn.cls;
      if (!c || !c.base) fail('super.method() outside a subclass', node);
      const m = this.findMember(c.base, node.method);
      if (!m || m.kind !== 'method') fail(`super.${node.method} is not a method`, node);
      const args = this.args(node.arguments, m.params || [], node);
      return { e: A.call(A.raw('inherited ' + m.pas), args), t: m.ret.k === 'void' ? T.void : m.ret, stmtOk: true };
    }

    // ------------------------------------------------------------ framework

    mdOptions(node) {
      if (!node || node.type !== 'ObjectLiteral') fail('MerkleDamgardBlocks options must be an object literal', node);
      const get = (key, def) => {
        const p = node.properties.find(x => (x.key && (x.key.name || x.key.value || x.key)) === key);
        return p ? p.value : null;
      };
      const intArg = (key, def) => { const v = get(key); return v ? this.conv(this.ex(v), T.int32) : A.lit(def); };
      const boolArg = (key, def) => { const v = get(key); return v ? this.truthy(this.ex(v)) : A.lit(def); };
      return A.call(A.mem(A.id('TMerkleDamgardOptions'), 'Create'), [
        intArg('blockSize', '0'), intArg('padByte', '$80'), intArg('lengthBytes', '8'),
        boolArg('lengthLittleEndian', 'False'), boolArg('lengthInBits', 'True')]);
    }

    /** absorber.Finish(f): f(held copy, pending, total length) in place. */
    absorberFinish(obj, argNodes, node) {
      const cb = argNodes && argNodes[0];
      if (!cb || !(cb.type === 'ArrowFunction' || cb.type === 'ArrowFunctionExpression' || cb.type === 'FunctionExpression'))
        fail('BlockAbsorber.Finish needs an inline callback', node);
      const absE = this.stable(obj);
      const entry = this.inlineLambda(cb, { paramTypes: [tArr(T.uint8), T.int32, T.uint64], forceParamTypes: false });
      const actual = [A.call(A.mem(absE, 'FinishHeld')), A.mem(absE, 'Pending'), A.mem(absE, 'Length')].slice(0, Math.max(entry.params.length, 0));
      const args = entry.params.map((p, i) => this.conv({ e: actual[i], t: [tArr(T.uint8), T.int32, T.uint64][i] }, p.type));
      return { e: A.call(A.id(entry.pas), args), t: entry.ret.k === 'void' ? T.void : entry.ret, stmtOk: true };
    }

    // ------------------------------------------------------------ arrays

    xArrayExpression(node, expected) {
      let t = this.typeOf(node, null);
      if (expected && isArr(expected) && (!t || !isArr(t) || isAnyT(t.elem) || node.elements.length === 0 || node.typeGuess)) t = expected;
      if (!t || !isArr(t)) t = expected && isArr(expected) ? expected : tArr(T.any);
      if (t.k === 'tuple') return this.tupleLiteral(node, t);
      const elemT = t.elem;
      const alias = this.aliasOf(t);
      const elems = node.elements || [];
      if (elems.length === 0) return { e: A.call(A.mem(A.id(alias), 'Empty')), t };
      if (elems.some(e => e && e.type === 'SpreadElement')) {
        const parts = [];
        let run = [];
        const flush = () => { if (run.length) { parts.push(A.call(A.mem(A.id(alias), 'From'), [A.arr(run)])); run = []; } };
        for (const el of elems) {
          if (el && el.type === 'SpreadElement') {
            flush();
            parts.push(this.conv(this.ex(el.argument, t), t));
          } else run.push(this.conv(this.ex(el, elemT), elemT));
        }
        flush();
        return { e: A.call(A.mem(A.id(alias), 'Concat'), [A.arr(parts)]), t };
      }
      // a long table of numeric literals becomes a typed constant
      if (elems.length >= 16 && isNum(elemT) && elems.every(el => this.numericLiteralValue(el) !== null)) {
        const values = elems.map(el => this.numericLiteralValue(el));
        return { e: A.call(A.mem(A.id(alias), 'From'), [A.id(this.constTable(elemT, values))]), t };
      }
      if (elems.length > 24) return { e: this.chunkedArray(elems, t), t };
      const items = elems.map(el => this.conv(this.ex(el, elemT), elemT));
      return { e: A.call(A.mem(A.id(alias), 'From'), [A.arr(items)]), t };
    }

    xArrayLiteral(node, expected) {
      return this.xArrayExpression(node, expected);
    }

    numericLiteralValue(el) {
      if (!el) return null;
      if (el.type === 'Literal' && typeof el.value === 'number') return el.value;
      if (el.type === 'UnaryExpression' && el.operator === '-' && el.argument.type === 'Literal' && typeof el.argument.value === 'number') return -el.argument.value;
      return null;
    }

    constTable(elemT, values) {
      const name = 'JsTable_' + (++this.constTables);
      const pas = this.pasType(elemT);
      const text = values.map(v => isFloat(elemT) ? this.numLiteral(v, elemT).text : (isInt(elemT) && !elemT.signed && v < 0 ? String(v) : String(v)));
      const lines = [];
      for (let i = 0; i < text.length; i += 16) lines.push(text.slice(i, i + 16).join(', '));
      this.consts.push(A.constDecl(name, `array[0..${values.length - 1}] of ${pas}`, '(\n    ' + lines.join(',\n    ') + ')'));
      if (isInt(elemT)) {
        // values outside the element range wrap as the IL type does
        const info = elemT;
        if (values.some(v => !this.fitsInt(v, info))) {
          this.consts[this.consts.length - 1].valueText = '(\n    ' + values.map(v => this.wrapInt(v, info)).join(', ') + ')';
        }
      }
      return name;
    }

    wrapInt(v, t) {
      let b = BigInt(Math.trunc(v));
      const m = 1n << BigInt(t.bits);
      b = ((b % m) + m) % m;
      if (t.signed && b >= m / 2n) b -= m;
      return b.toString();
    }

    /** A long array literal built by nested routines of 16 elements each (keeps routines small). */
    chunkedArray(elems, t) {
      const alias = this.aliasOf(t);
      const tmp = this.temp(t, 'arr');
      this.emitPre(A.assign(A.id(tmp), A.call(A.mem(A.id(alias), 'New'), [A.lit(0)])));
      for (let i = 0; i < elems.length; i += 16) {
        const chunk = elems.slice(i, i + 16);
        const entry = { pas: this.fn.pool.take('_Chunk'), params: [], ret: T.void, node: null };
        const savedFn = this.fn, savedPre = this.pre;
        this.fn = this.newFn({ parent: savedFn, cls: savedFn.cls, isStatic: savedFn.isStatic, hasSelf: savedFn.hasSelf });
        this.pre = null;
        try {
          const body = [];
          for (const el of chunk) {
            const [r, pre] = this.capture(() => this.conv(this.ex(el, t.elem), t.elem));
            body.push(...pre, A.expr(A.call(A.mem(A.id(tmp), 'Push'), [r])));
          }
          savedFn.nested.push(A.routine({ name: entry.pas, routineKind: 'procedure', labels: this.fn.labels, vars: this.dedupeVars(this.fn.vars), nested: this.fn.nested, body }));
        } finally {
          this.fn = savedFn;
          this.pre = savedPre;
        }
        this.emitPre(A.expr(A.call(A.id(entry.pas))));
      }
      return A.id(tmp);
    }

    tupleLiteral(node, t) {
      const rec = this.temp(t, 'tup');
      const fields = this.recordFields(t);
      node.elements.forEach((el, i) => {
        if (fields[i]) this.emitPre(A.assign(A.mem(A.id(rec), sanitize(fields[i].name)), this.conv(this.ex(el, fields[i].type), fields[i].type)));
      });
      return { e: A.id(rec), t };
    }

    xArrayLength(node) {
      const o = this.ex(node.array);
      if (isStr(o.t)) return { e: A.call(A.id('System.Length'), [o.e]), t: T.int32 };
      if (isArr(o.t)) return { e: A.mem(o.e, 'length'), t: T.int32 };
      if (o.t.k === 'any') return { e: A.call('JsValLength', [o.e]), t: T.int32 };
      if (o.t.k === 'class') return this.memberValue(o, 'length', node);
      fail('length of ' + o.t.key, node);
    }

    arrOf(node) {
      const o = this.ex(node);
      if (!isArr(o.t)) fail('array operation on ' + o.t.key, node);
      return o;
    }

    xArrayAppend(node, expected, forEffect) {
      const o = this.arrOf(node.array);
      const values = node.values || [node.value];
      const arrE = values.length > 1 || values.some(v => v && v.type === 'SpreadElement') ? this.stable(o) : o.e;
      let last = null;
      values.forEach((v, i) => {
        if (v && v.type === 'SpreadElement') {
          const src = this.conv(this.ex(v.argument, o.t), o.t);
          last = A.call(A.mem(arrE, 'PushAll'), [src]);
          if (i < values.length - 1 || forEffect) { this.emitPre(A.expr(last)); last = null; }
          return;
        }
        const val = this.conv(this.ex(v, o.t.elem), o.t.elem);
        last = A.call(A.mem(arrE, 'Push'), [val]);
        if (i < values.length - 1) { this.emitPre(A.expr(last)); last = null; }
      });
      if (!last) return { e: A.mem(arrE, 'length'), t: T.int32 };
      return { e: last, t: T.int32, stmtOk: true };
    }

    xArrayPop(node) {
      const o = this.arrOf(node.array);
      return { e: A.call(A.mem(o.e, 'Pop')), t: o.t.elem, stmtOk: true };
    }

    xArrayShift(node) {
      const o = this.arrOf(node.array);
      return { e: A.call(A.mem(o.e, 'Shift')), t: o.t.elem, stmtOk: true };
    }

    xArrayUnshift(node) {
      const o = this.arrOf(node.array);
      return { e: A.call(A.mem(o.e, 'Unshift'), [this.conv(this.ex(node.value, o.t.elem), o.t.elem)]), t: T.int32, stmtOk: true };
    }

    xArraySlice(node, expected) {
      const o = this.ex(node.array);
      if (isStr(o.t)) {
        const a = node.start ? this.conv(this.ex(node.start), T.int32) : A.lit(0);
        return { e: node.end ? A.call('JsStrSlice', [o.e, a, this.conv(this.ex(node.end), T.int32)]) : A.call('JsStrSlice', [o.e, a]), t: T.str };
      }
      if (!isArr(o.t)) fail('slice of ' + o.t.key, node);
      const args = [];
      if (node.start || node.end) args.push(node.start ? this.conv(this.ex(node.start), T.int32) : A.lit(0));
      if (node.end) args.push(this.conv(this.ex(node.end), T.int32));
      const res = { e: args.length ? A.call(A.mem(o.e, 'Slice'), args) : A.call(A.mem(o.e, 'Copy')), t: o.t };
      return res;
    }

    xTypedArraySubarray(node) {
      const o = this.arrOf(node.array);
      const args = [node.begin ? this.conv(this.ex(node.begin), T.int32) : A.lit(0)];
      if (node.end) args.push(this.conv(this.ex(node.end), T.int32));
      return { e: A.call(A.mem(o.e, 'Subarray'), args), t: o.t };
    }

    xArrayFill(node, expected) {
      let t = this.typeOf(node, null);
      if ((!t || !isArr(t) || node.typeGuess) && expected && isArr(expected)) t = expected;
      let o;
      if (node.array && (node.array.type === 'ArrayCreation') && t && isArr(t)) o = this.xArrayCreation(node.array, t);
      else o = this.arrOf(node.array);
      if (!t || !isArr(t)) t = o.t;
      const args = [this.conv(this.ex(node.value, o.t.elem), o.t.elem)];
      if (node.start) args.push(this.conv(this.ex(node.start), T.int32));
      if (node.end) args.push(this.conv(this.ex(node.end), T.int32));
      return { e: A.call(A.mem(o.e, 'Fill'), args), t: o.t, stmtOk: true };
    }

    xArrayCreation(node, expected) {
      let t = this.typeOf(node, null);
      if ((!t || !isArr(t) || isAnyT(t.elem)) && expected && isArr(expected)) t = expected;
      // nothing types the elements (code the IL leaves untyped, as in test vectors): dynamic values
      if (!t || !isArr(t)) t = tArr(T.any);
      const size = node.size ? this.conv(this.ex(node.size), T.int32) : A.lit(0);
      return { e: A.call(A.mem(A.id(this.aliasOf(t)), 'New'), [size]), t };
    }

    xTypedArrayCreation(node, expected) {
      const t = this.typeOf(node, null) || tArr(parseType(node.elementType) || T.uint8);
      const alias = this.aliasOf(t);
      if (!node.size) return { e: A.call(A.mem(A.id(alias), 'New'), [A.lit(0)]), t };
      const s = this.ex(node.size);
      if (isArr(s.t)) {
        // new Uint8Array(array) copies (converting each element)
        const copy = this.pasType(s.t) === alias ? A.call(A.mem(s.e, 'Copy')) : this.conv(s, t);
        return { e: copy, t };
      }
      if (node.buffer && !isNum(s.t)) fail('typed array over ' + s.t.key, node);
      return { e: A.call(A.mem(A.id(alias), 'New'), [this.conv(s, T.int32)]), t };
    }

    xBufferCreation(node) {
      return { e: A.call(A.mem(A.id('TA_U8'), 'New'), [this.conv(this.ex(node.size), T.int32)]), t: tArr(T.uint8) };
    }

    xArrayClear(node) {
      const o = this.arrOf(node.arguments[0]);
      return { e: A.call(A.mem(o.e, 'Clear')), t: T.void, stmtOk: true };
    }

    xArrayXor(node) {
      const a = this.conv(this.ex(node.arguments[0]), tArr(T.uint8));
      const b = this.conv(this.ex(node.arguments[1]), tArr(T.uint8));
      return { e: A.call('OpXorArrays', [a, b]), t: tArr(T.uint8) };
    }

    xArrayConcat(node) {
      const o = this.ex(node.array);
      if (isStr(o.t)) return { e: (node.arrays || []).reduce((acc, a) => A.bin('+', acc, this.toStr(this.ex(a))), o.e), t: T.str };
      if (!isArr(o.t)) fail('concat of ' + o.t.key, node);
      const parts = [o.e];
      for (const a of node.arrays || []) {
        const r = this.ex(a, o.t);
        if (isArr(r.t)) parts.push(this.conv(r, o.t));
        else parts.push(A.call(A.mem(A.id(this.aliasOf(o.t)), 'From'), [A.arr([this.conv(r, o.t.elem)])]));
      }
      return { e: A.call(A.mem(A.id(this.aliasOf(o.t)), 'Concat'), [A.arr(parts)]), t: o.t };
    }

    xArrayIndexOf(node) {
      const o = this.ex(node.array);
      if (isStr(o.t)) return { e: A.call('JsIndexOf', [o.e, this.conv(this.ex(node.value), T.str)]), t: T.int32 };
      if (!isArr(o.t)) fail('indexOf on ' + o.t.key, node);
      const args = [this.conv(this.ex(node.value, o.t.elem), o.t.elem)];
      if (node.start) args.push(this.conv(this.ex(node.start), T.int32));
      return { e: A.call(A.mem(o.e, 'IndexOf'), args), t: T.int32 };
    }

    xArrayIncludes(node) {
      const o = this.ex(node.array);
      if (isStr(o.t)) return { e: A.call('JsIncludes', [o.e, this.conv(this.ex(node.value), T.str)]), t: T.bool };
      if (!isArr(o.t)) fail('includes on ' + o.t.key, node);
      return { e: A.call(A.mem(o.e, 'Includes'), [this.conv(this.ex(node.value, o.t.elem), o.t.elem)]), t: T.bool };
    }

    xArrayJoin(node) {
      const o = this.arrOf(node.array);
      const sep = node.separator ? this.conv(this.ex(node.separator), T.str) : A.lit("','");
      const alias = this.aliasOf(o.t);
      if (['TA_Str', 'TA_U8', 'TA_I32', 'TA_U32', 'TA_U16', 'TA_F64', 'TA_Big'].includes(alias)) return { e: A.call('JsJoin', [o.e, sep]), t: T.str };
      return { e: A.call('JsJoin', [this.conv(o, tArr(T.str)), sep]), t: T.str };
    }

    xArrayReverse(node) {
      const o = this.arrOf(node.array);
      return { e: A.call(A.mem(o.e, 'Reverse')), t: o.t, stmtOk: true };
    }

    xArraySplice(node) {
      const o = this.arrOf(node.array);
      const args = [this.conv(this.ex(node.start), T.int32)];
      if (node.deleteCount) args.push(this.conv(this.ex(node.deleteCount), T.int32));
      if (node.items && node.items.length) {
        if (!node.deleteCount) args.push(A.mem(o.e, 'length'));
        args.push(A.arr(node.items.map(i => this.conv(this.ex(i, o.t.elem), o.t.elem))));
      }
      return { e: A.call(A.mem(o.e, 'Splice'), args), t: o.t, stmtOk: true };
    }

    xTypedArraySet(node) {
      const o = this.arrOf(node.array);
      const src = this.conv(this.ex(node.source, o.t), o.t);
      const args = [src];
      if (node.offset) args.push(this.conv(this.ex(node.offset), T.int32));
      return { e: A.call(A.mem(o.e, 'SetFrom'), args), t: T.void, stmtOk: true };
    }

    xIsArrayCheck(node) {
      const v = this.ex(node.value);
      if (isArr(v.t)) return { e: A.un('not', A.call(A.mem(v.e, 'IsNull'))), t: T.bool };
      if (v.t.k === 'any') return { e: A.bin('=', A.mem(v.e, 'Kind'), A.id('jvArr')), t: T.bool };
      return { e: A.lit('False'), t: T.bool };
    }

    xIsIntegerCheck(node) {
      const v = this.ex(node.value || node.argument);
      if (isInt(v.t)) return { e: A.lit('True'), t: T.bool };
      if (isFloat(v.t)) return { e: A.call('JsIsInteger', [v.e]), t: T.bool };
      return { e: A.lit('False'), t: T.bool };
    }

    xObjectFreeze(node, expected) {
      return this.ex(node.object || node.value, expected);
    }

    xSpreadElement(node, expected) {
      fail('spread outside an array literal or push', node);
    }

    /** map/filter/forEach/sort/from with a callback: a loop calling a nested routine. */
    xArrayMap(node) {
      const o = this.arrOf(node.array);
      const resT = this.typeOf(node, null);
      const src = this.stable(o);
      const entry = this.inlineLambda(node.callback, { paramTypes: [o.t.elem, T.int32] });
      // a callback returning dynamic values (an object literal) keeps them
      // dynamic: the IL may name a class they are not instances of
      const dynamicObjects = isAnyT(entry.ret) && resT && isArr(resT) && resT.elem.k === 'class';
      const outT = resT && isArr(resT) && !isAnyT(resT.elem) && !dynamicObjects ? resT : tArr(entry.ret);
      const tmp = this.temp(outT, 'map');
      const i = this.temp(T.int32, 'i');
      this.emitPre(A.assign(A.id(tmp), A.call(A.mem(A.id(this.aliasOf(outT)), 'New'), [A.mem(src, 'length')])));
      const callArgs = entry.params.map((p, k) => this.conv(k === 0 ? { e: A.idx(src, A.id(i)), t: o.t.elem } : { e: A.id(i), t: T.int32 }, p.type));
      this.emitPre(A.forStmt(i, A.lit(0), A.bin('-', A.mem(src, 'length'), A.lit(1)), false, [
        A.assign(A.idx(A.id(tmp), A.id(i)), this.conv({ e: A.call(A.id(entry.pas), callArgs), t: entry.ret }, outT.elem))
      ]));
      return { e: A.id(tmp), t: outT };
    }

    xArrayFilter(node) {
      const o = this.arrOf(node.array);
      const src = this.stable(o);
      const entry = this.inlineLambda(node.callback, { paramTypes: [o.t.elem, T.int32] });
      const tmp = this.temp(o.t, 'filter');
      const i = this.temp(T.int32, 'i');
      this.emitPre(A.assign(A.id(tmp), A.call(A.mem(A.id(this.aliasOf(o.t)), 'Empty'))));
      const callArgs = entry.params.map((p, k) => this.conv(k === 0 ? { e: A.idx(src, A.id(i)), t: o.t.elem } : { e: A.id(i), t: T.int32 }, p.type));
      this.emitPre(A.forStmt(i, A.lit(0), A.bin('-', A.mem(src, 'length'), A.lit(1)), false, [
        A.ifStmt(this.truthy({ e: A.call(A.id(entry.pas), callArgs), t: entry.ret }), [A.expr(A.call(A.mem(A.id(tmp), 'Push'), [A.idx(src, A.id(i))]))])
      ]));
      return { e: A.id(tmp), t: o.t };
    }

    xArrayForEach(node) {
      const o = this.arrOf(node.array);
      const src = this.stable(o);
      const entry = this.inlineLambda(node.callback, { paramTypes: [o.t.elem, T.int32] });
      const i = this.temp(T.int32, 'i');
      const callArgs = entry.params.map((p, k) => this.conv(k === 0 ? { e: A.idx(src, A.id(i)), t: o.t.elem } : { e: A.id(i), t: T.int32 }, p.type));
      this.emitPre(A.forStmt(i, A.lit(0), A.bin('-', A.mem(src, 'length'), A.lit(1)), false, [A.expr(A.call(A.id(entry.pas), callArgs))]));
      return { e: null, t: T.void };
    }

    xArraySort(node) {
      const o = this.arrOf(node.array);
      if (!node.compareFn) fail('sort without a comparator is not supported', node);
      const entry = this.inlineLambda(node.compareFn, { paramTypes: [o.t.elem, o.t.elem], forceParamTypes: true, retType: T.f64, constParams: true });
      return { e: A.call(A.mem(o.e, 'Sort'), [A.id(entry.pas)]), t: o.t, stmtOk: true };
    }

    arrayCallback(name, o, args, node) {
      fail(`array ${name} is not supported`, node);
    }

    xArrayFrom(node, expected) {
      let t = this.typeOf(node, null);
      if ((!t || !isArr(t) || isAnyT(t.elem)) && expected && isArr(expected)) t = expected;
      const it = node.iterable;
      const isLengthObject = it && it.type === 'ObjectLiteral' && it.properties.length === 1 &&
        ((it.properties[0].key && (it.properties[0].key.name || it.properties[0].key)) === 'length');
      if (isLengthObject) {
        const n = this.conv(this.ex(it.properties[0].value), T.int32);
        if (!node.mapFunction) {
          if (!t || !isArr(t)) fail('Array.from({length}) without an element type', node);
          return { e: A.call(A.mem(A.id(this.aliasOf(t)), 'New'), [n]), t };
        }
        const entry = this.inlineLambda(node.mapFunction, { paramTypes: [T.any, T.int32] });
        if (!t || !isArr(t) || isAnyT(t.elem)) t = tArr(entry.ret);
        const tmp = this.temp(t, 'from');
        const i = this.temp(T.int32, 'i');
        this.emitPre(A.assign(A.id(tmp), A.call(A.mem(A.id(this.aliasOf(t)), 'New'), [n])));
        const callArgs = entry.params.map((p, k) => k === 0 ? this.defaultValue(p.type) : this.conv({ e: A.id(i), t: T.int32 }, p.type));
        this.emitPre(A.forStmt(i, A.lit(0), A.bin('-', A.mem(A.id(tmp), 'length'), A.lit(1)), false, [
          A.assign(A.idx(A.id(tmp), A.id(i)), this.conv({ e: A.call(A.id(entry.pas), callArgs), t: entry.ret }, t.elem))
        ]));
        return { e: A.id(tmp), t };
      }
      const src = this.ex(it, t);
      if (!node.mapFunction) {
        if (isStr(src.t)) fail('Array.from(string) is not supported', node);
        if (!isArr(src.t)) fail('Array.from of ' + src.t.key, node);
        const target = t && isArr(t) && !isAnyT(t.elem) ? t : src.t;
        if (this.pasType(target) === this.pasType(src.t)) return { e: A.call(A.mem(src.e, 'Copy')), t: target };
        return { e: this.conv(src, target), t: target };
      }
      return this.xArrayMap({ array: { type: '__Compiled', res: src }, callback: node.mapFunction, resultType: t ? t.key : null });
    }

    // ------------------------------------------------------------ bytes and bits

    xPackBytes(node) {
      const bits = node.bits;
      const be = node.endian === 'big';
      const args = node.arguments || [];
      const t = parseType(node.resultType) || (bits === 64 ? T.uint64 : bits === 16 ? T.uint16 : T.uint32);
      if (args.length === 1 && args[0].type === 'SpreadElement') {
        const a = this.conv(this.ex(args[0].argument), tArr(T.uint8));
        const res = { e: A.call('OpPackArr', [a, A.lit(bits), A.lit(be ? 'True' : 'False')]), t: T.uint64 };
        return { e: this.conv(res, t), t };
      }
      const fn = 'OpPack' + bits + (be ? 'BE' : 'LE');
      const vals = args.map(a => this.bits32(this.ex(a)));
      const natT = bits === 64 ? T.uint64 : bits === 16 ? T.uint16 : T.uint32;
      const res = { e: A.call(fn, vals), t: natT };
      return { e: this.conv(res, t), t };
    }

    xUnpackBytes(node) {
      const bits = node.bits;
      const be = node.endian === 'big';
      const v = this.ex(node.arguments[0]);
      const arg = bits === 64 ? this.bits64(v) : this.bits32(v);
      return { e: A.call('OpUnpack' + bits + (be ? 'BE' : 'LE'), [arg]), t: tArr(T.uint8) };
    }

    rotate(node, left) {
      const bits = node.bits || 32;
      const r = ROT[bits];
      if (!r) fail('rotation of ' + bits + ' bits', node);
      const v = this.ex(node.value);
      const n = this.conv(this.ex(node.amount), T.int32);
      const natT = parseType(r[2]);
      const arg = bits === 64 ? this.bits64(v) : this.bits32(v);
      const res = { e: A.call(left ? r[0] : r[1], [arg, n]), t: natT };
      const t = this.typeOf(node, natT);
      return { e: this.conv(res, t), t };
    }

    xRotateLeft(node) { return this.rotate(node, true); }
    xRotateRight(node) { return this.rotate(node, false); }

    xHexDecode(node) {
      const m = node.opCodesMethod || 'Hex8ToBytes';
      const spec = OPCODES[m];
      if (!spec) fail('hex decoder ' + m, node);
      return { e: A.call(spec[0], [this.conv(this.ex(node.arguments[0]), T.str)]), t: parseType(spec[2]) };
    }

    xStringToBytes(node) {
      const m = node.opCodesMethod || (node.encoding === 'utf8' ? 'Utf8ToBytes' : 'AnsiToBytes');
      const fn = { AnsiToBytes: 'OpAnsiToBytes', AsciiToBytes: 'OpAsciiToBytes', Utf8ToBytes: 'OpUtf8ToBytes' }[m] || 'OpAnsiToBytes';
      const arg = node.arguments ? node.arguments[0] : node.value;
      return { e: A.call(fn, [this.conv(this.ex(arg), T.str)]), t: tArr(T.uint8) };
    }

    xBytesToString(node) {
      const m = node.opCodesMethod || 'BytesToAnsi';
      const fn = { BytesToAnsi: 'OpBytesToAnsi', BytesToAscii: 'OpBytesToChars', BytesToUtf8: 'OpBytesToUtf8' }[m] || 'OpBytesToAnsi';
      const arg = node.arguments ? node.arguments[0] : node.value;
      return { e: A.call(fn, [this.conv(this.ex(arg), tArr(T.uint8))]), t: T.str };
    }

    xCast(node) {
      const target = parseType(node.targetType === 'int' ? 'int32' : node.targetType) || T.uint32;
      const resT = this.typeOf(node, target);
      const a = this.ex(node.arguments[0]);
      const m = node.opCodesMethod;
      if (m === 'ToQWord') {
        // BigInt(value) & 0xFFFFFFFFFFFFFFFFn
        if (isBig(a.t)) return { e: A.call(A.mem(A.id('TBigInt'), 'AsUintN'), [A.lit(64), a.e]), t: T.big };
        const v = { e: this.bits64(a), t: T.uint64 };
        return isBig(resT) ? { e: this.conv(v, T.big), t: T.big } : { e: this.conv(v, resT), t: resT };
      }
      if (isBig(a.t)) {
        const v = { e: A.call(A.mem(a.e, target.bits === 64 ? 'ToUInt64' : 'ToUInt32')), t: target.bits === 64 ? T.uint64 : T.uint32 };
        return { e: this.conv(v, resT), t: resT };
      }
      if (isInt(target) && target.bits <= 32) {
        // JavaScript bit operations: the low bits of ToInt32
        const pattern = this.bits32(a);
        if (target.key === 'uint32') return { e: pattern, t: T.uint32 };
        return { e: A.cast(target.pas, pattern), t: target };
      }
      return { e: this.conv(a, resT), t: resT };
    }

    xBigIntCast(node) {
      const a = this.ex(node.argument);
      return { e: this.conv(a, T.big), t: T.big };
    }

    xOpCodesCall(node, expected) {
      const m = node.method;
      const args = node.arguments || [];
      switch (m) {
        case 'CreateArray': {
          let t = this.typeOf(node, null);
          if ((!t || !isArr(t)) && expected && isArr(expected)) t = expected;
          if (!t || !isArr(t)) t = tArr(T.uint8);
          const n = this.conv(this.ex(args[0]), T.int32);
          const created = A.call(A.mem(A.id(this.aliasOf(t)), 'New'), [n]);
          if (args[1]) return { e: A.call(A.mem(created, 'Fill'), [this.conv(this.ex(args[1], t.elem), t.elem)]), t };
          return { e: created, t };
        }
        case 'CopyArray': {
          const o = this.arrOf(args[0]);
          return { e: A.call(A.mem(o.e, 'Copy')), t: o.t };
        }
        case 'ArraySlice': {
          const o = this.arrOf(args[0]);
          const a = [this.conv(this.ex(args[1]), T.int32)];
          if (args[2]) a.push(this.conv(this.ex(args[2]), T.int32));
          return { e: A.call(A.mem(o.e, 'Slice'), a), t: o.t };
        }
        case 'ConcatArrays': {
          const arrs = this.ex(args[0], tArr(tArr(T.uint8)));
          if (!isArr(arrs.t) || !isArr(arrs.t.elem)) fail('ConcatArrays of ' + arrs.t.key, node);
          return { e: A.call(A.mem(A.id(this.aliasOf(arrs.t.elem)), 'Concat'), [A.call(A.mem(arrs.e, 'ToArray'))]), t: arrs.t.elem };
        }
        case 'ClearArray': {
          const o = this.arrOf(args[0]);
          return { e: A.call(A.mem(o.e, 'Clear')), t: T.void, stmtOk: true };
        }
        case 'Xor32': case 'And32': case 'Or32': {
          const op = { Xor32: '^', And32: '&', Or32: '|' }[m];
          return this.bitwise(op, this.ex(args[0]), this.ex(args[1]), T.uint32);
        }
        case 'Shl32': return this.shift('<<', this.ex(args[0]), this.ex(args[1]), T.uint32);
        case 'Shr32': return this.shift('>>>', this.ex(args[0]), this.ex(args[1]), T.uint32);
        case 'Add32': return this.arith('+', this.ex(args[0]), this.ex(args[1]), T.uint32, node);
        case 'Sub32': return this.arith('-', this.ex(args[0]), this.ex(args[1]), T.uint32, node);
        case 'Mul32': return this.arith('*', this.ex(args[0]), this.ex(args[1]), T.uint32, node);
        case 'ToUint32': case 'ToDWord': return { e: this.bits32(this.ex(args[0])), t: T.uint32 };
        case 'ToByte': case 'ToUint8': return { e: A.cast('Byte', this.bits32(this.ex(args[0]))), t: T.uint8 };
        case 'ToWord': case 'ToUint16': return { e: A.cast('Word', this.bits32(this.ex(args[0]))), t: T.uint16 };
        case 'ToInt': return { e: A.cast('Int32', this.bits32(this.ex(args[0]))), t: T.int32 };
        case 'XorN': case 'AndN': case 'OrN': {
          const op = { XorN: 'xor', AndN: 'and', OrN: 'or' }[m];
          return { e: A.bin(op, this.conv(this.ex(args[0]), T.big), this.conv(this.ex(args[1]), T.big)), t: T.big };
        }
        case 'ShiftLn': case 'ShiftRn':
          return { e: A.bin(m === 'ShiftLn' ? 'shl' : 'shr', this.conv(this.ex(args[0]), T.big), this.conv(this.ex(args[1]), T.int32)), t: T.big };
        case 'Split64': {
          const t = this.typeOf(node, null) || tRecord([{ name: 'high32', type: T.uint32 }, { name: 'low32', type: T.uint32 }]);
          const v = this.stable({ e: this.bits64(this.ex(args[0])), t: T.uint64 });
          const rec = this.temp(t, 'split');
          this.emitPre(A.assign(A.mem(A.id(rec), 'high32'), A.cast('UInt32', A.bin('shr', v, A.lit(32)))));
          this.emitPre(A.assign(A.mem(A.id(rec), 'low32'), A.cast('UInt32', v)));
          return { e: A.id(rec), t };
        }
        case 'RotL64_HL': case 'RotR64_HL': {
          const t = this.typeOf(node, null) || tRecord([{ name: 'h', type: T.uint32 }, { name: 'l', type: T.uint32 }]);
          const hi = this.bits32(this.ex(args[0])), lo = this.bits32(this.ex(args[1]));
          const n = this.conv(this.ex(args[2]), T.int32);
          const v = this.temp(T.uint64, 'q');
          this.emitPre(A.assign(A.id(v), A.call(m === 'RotL64_HL' ? 'OpRotL64' : 'OpRotR64', [A.bin('or', A.bin('shl', A.cast('UInt64', hi), A.lit(32)), lo), n])));
          const rec = this.temp(t, 'hl');
          this.emitPre(A.assign(A.mem(A.id(rec), 'h'), A.cast('UInt32', A.bin('shr', A.id(v), A.lit(32)))));
          this.emitPre(A.assign(A.mem(A.id(rec), 'l'), A.cast('UInt32', A.id(v))));
          return { e: A.id(rec), t };
        }
        case 'CreateBitStream': {
          const init = args[0] ? this.conv(this.ex(args[0], tArr(T.uint8)), tArr(T.uint8)) : A.call(A.mem(A.id('TA_U8'), 'Null'));
          return { e: A.call(A.mem(A.id('TJsBitStream'), 'Create'), [init]), t: tClass('_BitStream') };
        }
      }
      const spec = OPCODES[m];
      if (!spec) fail(`OpCodes.${m} is not supported`, node);
      const params = spec[1].map(parseType);
      const callArgs = params.map((p, i) => args[i] ? this.conv(this.ex(args[i], p), p) : this.defaultValue(p));
      const ret = parseType(spec[2]);
      const res = { e: A.call(spec[0], callArgs), t: ret };
      const want = this.typeOf(node, ret);
      if (want.key !== ret.key && (isNum(want) || isBig(want)) && (isNum(ret) || isBig(ret))) return { e: this.conv(res, want), t: want };
      return res;
    }

    // ------------------------------------------------------------ math

    xFloor(node) { return this.rounding(node, 'JsFloor'); }
    xCeil(node) { return this.rounding(node, 'JsCeil'); }
    xRound(node) { return this.rounding(node, 'JsRound'); }
    xTruncate(node) { return this.rounding(node, 'JsTrunc'); }

    rounding(node, fn) {
      const a = this.ex(node.argument);
      const resT = this.typeOf(node, T.f64);
      if (isInt(a.t)) return { e: this.conv(a, isNum(resT) ? resT : a.t), t: isNum(resT) ? resT : a.t };
      // floor(a / b) of non-negative integers is integer division
      const res = { e: A.call(fn, [this.conv(a, T.f64)]), t: T.f64 };
      return isInt(resT) ? { e: this.conv(res, resT), t: resT } : res;
    }

    mathArgs(node) {
      return (node.arguments || (node.argument ? [node.argument] : [])).map(a => this.ex(a));
    }

    xMin(node) { return this.minMax(node, true); }
    xMax(node) { return this.minMax(node, false); }

    minMax(node, isMin) {
      const vals = this.mathArgs(node);
      let resT = this.typeOf(node, null);
      if (!resT || !isNum(resT)) resT = vals.some(v => isFloat(v.t)) ? T.f64 : T.int64;
      const allInt = vals.every(v => isInt(v.t)) && isInt(resT);
      const unsigned64 = vals.some(v => v.t.key === 'uint64') || resT.key === 'uint64';
      const fn = allInt ? (unsigned64 ? (isMin ? 'JsMinU' : 'JsMaxU') : (isMin ? 'JsMinI' : 'JsMaxI')) : (isMin ? 'JsMinD' : 'JsMaxD');
      const domT = allInt ? (unsigned64 ? T.uint64 : T.int64) : T.f64;
      if (vals.length === 0) return { e: A.call(isMin ? 'JsInfinity' : 'JsInfinity'), t: T.f64 };
      let e = this.conv(vals[0], domT);
      for (let i = 1; i < vals.length; ++i) e = A.call(fn, [e, this.conv(vals[i], domT)]);
      return { e: this.conv({ e, t: domT }, resT), t: resT };
    }

    xAbs(node) {
      const a = this.ex(node.argument || node.arguments[0]);
      const resT = this.typeOf(node, a.t);
      if (isBig(a.t)) return { e: A.call(A.raw('JsBigAbs'), [a.e]), t: T.big };
      if (isInt(a.t)) return { e: this.conv({ e: A.call('Abs', [A.cast('Int64', a.e)]), t: T.int64 }, isNum(resT) ? resT : T.int64), t: isNum(resT) ? resT : T.int64 };
      return { e: A.call('Abs', [this.conv(a, T.f64)]), t: T.f64 };
    }

    xPower(node) {
      return this.power(this.ex(node.base), this.ex(node.exponent), this.typeOf(node, null));
    }

    unaryMath(node, fn) {
      const a = this.ex(node.argument || node.arguments[0]);
      const res = { e: A.call(fn, [this.conv(a, T.f64)]), t: T.f64 };
      const resT = this.typeOf(node, T.f64);
      return isInt(resT) ? { e: this.conv(res, resT), t: resT } : res;
    }

    xSqrt(node) { return this.unaryMath(node, 'Sqrt'); }
    xLog(node) { return this.unaryMath(node, 'Ln'); }
    xLog2(node) { return this.unaryMath(node, 'Log2'); }
    xExp(node) { return this.unaryMath(node, 'Exp'); }
    xSin(node) { return this.unaryMath(node, 'Sin'); }
    xCos(node) { return this.unaryMath(node, 'Cos'); }
    xTanh(node) { return this.unaryMath(node, 'Tanh'); }

    xCountLeadingZeros(node) {
      const a = this.ex(node.argument);
      return { e: A.call('JsClz32', [this.bits32(a)]), t: T.int32 };
    }

    xMathConstant(node) {
      return { e: this.numLiteral(node.value, T.f64), t: T.f64 };
    }

    xNumberConstant(node) {
      const v = node.value;
      if (!Number.isFinite(v)) return { e: A.call(Number.isNaN(v) ? 'JsNaN' : 'JsInfinity'), t: T.f64 };
      if (Number.isInteger(v)) return { e: A.lit(String(v)), t: T.int64, constNum: v };
      return { e: this.numLiteral(v, T.f64), t: T.f64 };
    }

    xRandom() {
      return { e: A.call('JsRandom'), t: T.f64 };
    }

    xMathCall(node) {
      const args = (node.arguments || []).map(a => this.ex(a));
      const resT = this.typeOf(node, T.f64);
      const d = i => this.conv(args[i], T.f64);
      let res;
      switch (node.method) {
        case 'imul': res = { e: A.call('JsImul', [A.cast('Int32', this.bits32(args[0])), A.cast('Int32', this.bits32(args[1]))]), t: T.int32 }; break;
        case 'clz32': res = { e: A.call('JsClz32', [this.bits32(args[0])]), t: T.int32 }; break;
        case 'sign': res = { e: A.call('JsSign', [d(0)]), t: T.f64 }; break;
        case 'trunc': res = { e: A.call('JsTrunc', [d(0)]), t: T.f64 }; break;
        case 'floor': res = { e: A.call('JsFloor', [d(0)]), t: T.f64 }; break;
        case 'ceil': res = { e: A.call('JsCeil', [d(0)]), t: T.f64 }; break;
        case 'round': res = { e: A.call('JsRound', [d(0)]), t: T.f64 }; break;
        case 'abs': res = { e: A.call('Abs', [d(0)]), t: T.f64 }; break;
        case 'sqrt': res = { e: A.call('Sqrt', [d(0)]), t: T.f64 }; break;
        case 'log': res = { e: A.call('Ln', [d(0)]), t: T.f64 }; break;
        case 'log2': res = { e: A.call('Log2', [d(0)]), t: T.f64 }; break;
        case 'log10': res = { e: A.call('Log10', [d(0)]), t: T.f64 }; break;
        case 'exp': res = { e: A.call('Exp', [d(0)]), t: T.f64 }; break;
        case 'pow': res = { e: A.call('JsPow', [d(0), d(1)]), t: T.f64 }; break;
        case 'sin': case 'cos': case 'tan': case 'atan': case 'tanh':
          res = { e: A.call({ sin: 'Sin', cos: 'Cos', tan: 'Tan', atan: 'ArcTan', tanh: 'Tanh' }[node.method], [d(0)]), t: T.f64 }; break;
        case 'atan2': res = { e: A.call('ArcTan2', [d(0), d(1)]), t: T.f64 }; break;
        case 'hypot': res = { e: A.call('Hypot', [d(0), d(1)]), t: T.f64 }; break;
        case 'cbrt': res = { e: A.call('JsPow', [d(0), A.bin('/', A.lit('1.0'), A.lit('3.0'))]), t: T.f64 }; break;
        case 'min': return this.minMax({ arguments: node.arguments, resultType: node.resultType }, true);
        case 'max': return this.minMax({ arguments: node.arguments, resultType: node.resultType }, false);
        case 'random': res = { e: A.call('JsRandom'), t: T.f64 }; break;
        default: fail('Math.' + node.method, node);
      }
      return isInt(resT) && !isInt(res.t) ? { e: this.conv(res, resT), t: resT } : res;
    }

    // ------------------------------------------------------------ strings

    strOf(node) {
      const s = this.ex(node);
      if (!isStr(s.t) && s.t.k !== 'enum') fail('string operation on ' + s.t.key, node);
      return s;
    }

    xStringCharCodeAt(node) {
      const s = this.strOf(node.string);
      return { e: A.call('JsCharCodeAt', [s.e, node.index ? this.conv(this.ex(node.index), T.int32) : A.lit(0)]), t: T.int32 };
    }

    xStringCharAt(node) {
      const s = this.strOf(node.string);
      return { e: A.call('JsCharAt', [s.e, node.index ? this.conv(this.ex(node.index), T.int32) : A.lit(0)]), t: T.str };
    }

    xStringFromCharCodes(node) {
      const codes = node.charCodes || node.arguments || [];
      if (codes.length === 1 && codes[0].type === 'SpreadElement') {
        const a = this.ex(codes[0].argument);
        if (!isArr(a.t)) fail('String.fromCharCode(...' + a.t.key + ')', node);
        const alias = this.aliasOf(a.t);
        const fn = { TA_U8: 'JsFromCharCodesU8', TA_U16: 'JsFromCharCodesU16', TA_U32: 'JsFromCharCodesU32', TA_I32: 'JsFromCharCodesI32' }[alias];
        if (fn) return { e: A.call(fn, [a.e]), t: T.str };
        return { e: A.call('JsFromCharCodesI32', [this.conv(a, tArr(T.int32))]), t: T.str };
      }
      if (codes.length === 0) return { e: A.lit("''"), t: T.str, constStr: '' };
      let e = null;
      for (const c of codes) {
        const part = A.call('JsFromCharCode', [A.cast('Int32', this.bits32(this.ex(c)))]);
        e = e ? A.bin('+', e, part) : part;
      }
      return { e, t: T.str };
    }

    xStringTransform(node) {
      const s = this.strOf(node.string);
      const fn = { toUpperCase: 'JsToUpper', toLowerCase: 'JsToLower', trim: 'JsTrim', trimStart: 'JsTrimStart', trimEnd: 'JsTrimEnd' }[node.method];
      if (!fn) fail('string ' + node.method, node);
      return { e: A.call(fn, [s.e]), t: T.str };
    }

    xStringRepeat(node) {
      const s = this.strOf(node.string);
      return { e: A.call('JsRepeat', [s.e, this.conv(this.ex(node.count), T.int32)]), t: T.str };
    }

    xStringReplace(node) {
      const s = this.strOf(node.string);
      if (node.searchValue && node.searchValue.regex) {
        const re = node.searchValue.regex;
        return { e: A.call('JsRegexReplace', [s.e, A.lit(pasString(re.pattern)), A.lit(pasString(re.flags || '')), this.conv(this.ex(node.replaceValue), T.str)]), t: T.str };
      }
      const fn = node.method === 'replaceAll' ? 'JsReplaceAll' : 'JsReplaceFirst';
      return { e: A.call(fn, [s.e, this.conv(this.ex(node.searchValue), T.str), this.conv(this.ex(node.replaceValue), T.str)]), t: T.str };
    }

    xStringIndexOf(node) {
      const s = this.strOf(node.string);
      const sub = this.conv(this.ex(node.searchValue), T.str);
      if (node.method === 'lastIndexOf') return { e: A.call('JsLastIndexOf', [s.e, sub]), t: T.int32 };
      const args = [s.e, sub];
      if (node.fromIndex) args.push(this.conv(this.ex(node.fromIndex), T.int32));
      return { e: A.call('JsIndexOf', args), t: T.int32 };
    }

    xStringIncludes(node) {
      const s = this.strOf(node.string);
      const sub = this.conv(this.ex(node.searchValue), T.str);
      const fn = { includes: 'JsIncludes', startsWith: 'JsStartsWith', endsWith: 'JsEndsWith' }[node.method || 'includes'];
      return { e: A.call(fn, [s.e, sub]), t: T.bool };
    }

    xStringSubstring(node) {
      const s = this.strOf(node.string);
      const a = node.start ? this.conv(this.ex(node.start), T.int32) : A.lit(0);
      if (node.length) return { e: A.call('JsSubstr', [s.e, a, this.conv(this.ex(node.length), T.int32)]), t: T.str };
      const fn = node.method === 'slice' ? 'JsStrSlice' : 'JsSubstring';
      if (node.end) return { e: A.call(fn, [s.e, a, this.conv(this.ex(node.end), T.int32)]), t: T.str };
      return { e: A.call(fn, [s.e, a]), t: T.str };
    }

    xStringSplit(node) {
      const s = this.strOf(node.string);
      if (node.separator && node.separator.regex)
        return { e: A.call('JsRegexSplit', [s.e, A.lit(pasString(node.separator.regex.pattern)), A.lit(pasString(node.separator.regex.flags || ''))]), t: tArr(T.str) };
      const sep = node.separator ? this.conv(this.ex(node.separator), T.str) : null;
      if (!sep) return { e: A.call(A.mem(A.id('TA_Str'), 'From'), [A.arr([s.e])]), t: tArr(T.str) };
      return { e: A.call('JsSplit', [s.e, sep]), t: tArr(T.str) };
    }

    xStringPad(node) {
      const s = this.strOf(node.string);
      const fn = node.method === 'padEnd' ? 'JsPadEnd' : 'JsPadStart';
      const args = [s.e, node.targetLength ? this.conv(this.ex(node.targetLength), T.int32) : A.lit(0)];
      if (node.padString) args.push(this.conv(this.ex(node.padString), T.str));
      return { e: A.call(fn, args), t: T.str };
    }

    xStringConcat(node) {
      let e = this.strOf(node.string).e;
      for (const v of node.values || []) e = A.bin('+', e, this.toStr(this.ex(v)));
      return { e, t: T.str };
    }

    xStringInterpolation(node) {
      let e = null;
      for (const part of node.parts || []) {
        let p;
        if (part.type === 'StringPart') p = A.lit(pasString(part.value || ''));
        else p = this.toStr(this.ex(part.expression));
        e = e ? A.bin('+', e, p) : p;
      }
      return { e: e || A.lit("''"), t: T.str };
    }

    xTemplateLiteral(node) {
      let e = null;
      const quasis = node.quasis || [];
      quasis.forEach((q, i) => {
        const text = q.value ? (q.value.cooked !== undefined ? q.value.cooked : q.value.raw) : String(q);
        if (text) e = e ? A.bin('+', e, A.lit(pasString(text))) : A.lit(pasString(text));
        if (i < (node.expressions || []).length) {
          const p = this.toStr(this.ex(node.expressions[i]));
          e = e ? A.bin('+', e, p) : p;
        }
      });
      return { e: e || A.lit("''"), t: T.str };
    }

    xErrorCreation(node) {
      return { e: this.errorObject(node), t: T.err };
    }

    xDebugOutput() {
      return { e: null, t: T.void };
    }

    // ------------------------------------------------------------ objects

    xObjectLiteral(node, expected) {
      if (expected && expected.k === 'class' && expected.name === 'TestCase') return this.testCaseLiteral(node);
      if (expected && expected.k === 'class' && expected.name === 'MerkleDamgardOptions') return { e: this.mdOptions(node), t: expected };
      if (expected && (expected.k === 'record' || expected.k === 'tuple')) {
        const rec = this.temp(expected, 'obj');
        const fields = this.recordFields(expected);
        for (const p of node.properties) {
          const key = p.key && (p.key.name || p.key.value || p.key);
          const f = fields.find(x => x.name === key);
          if (!f) fail(`object literal field ${key} not in ${expected.key}`, node);
          this.emitPre(A.assign(A.mem(A.id(rec), sanitize(f.name)), this.conv(this.ex(p.value, f.type), f.type)));
        }
        return { e: A.id(rec), t: expected };
      }
      if (!expected || isAnyT(expected) || isNullT(expected)) {
        // an object the IL leaves untyped (test vector helpers): a bag of dynamic values
        const fields = [];
        for (const p of node.properties) {
          if (p.type === 'SpreadElement' || p.type === 'ObjectSpread') fail('spread in an object literal', node);
          const key = p.key && (p.key.name || p.key.value || p.key);
          fields.push(A.call('JsF', [A.lit(pasString(key)), this.toJsValue(this.ex(p.value))]));
        }
        return { e: A.call('JsDynObject', [A.arr(fields)]), t: T.any };
      }
      fail('object literal of ' + (expected ? expected.key : 'unknown type'), node);
    }

    /** A test vector object literal: a TTestCase with its fields as dynamic values. */
    testCaseLiteral(node) {
      const fields = [];
      for (const p of node.properties) {
        if (p.type === 'SpreadElement' || p.type === 'ObjectSpread') fail('spread in a test vector', node);
        const key = p.key && (p.key.name || p.key.value || p.key);
        const expectedT = key === 'input' || key === 'expected' ? tArr(T.uint8) : null;
        const v = this.ex(p.value, expectedT);
        fields.push(A.call('JsF', [A.lit(pasString(key)), this.toJsValue(v)]));
      }
      return { e: A.call('JsTestCase', [A.arr(fields)]), t: tClass('TestCase') };
    }

    // ------------------------------------------------------------ functions as values

    xArrowFunction(node) {
      fail('a function value outside a supported callback position', node);
    }

    xFunctionExpression(node) {
      fail('a function value outside a supported callback position', node);
    }

    xArrowFunctionExpression(node) {
      fail('a function value outside a supported callback position', node);
    }

    // modern node kinds the shared code-generation suite probes for
    xChainExpression(node, expected) { return this.ex(node.expression, expected); }
    xYieldExpression(node) { fail('generators are not supported', node); }
    xClassExpression(node) { fail('class expressions are only supported as declarations', node); }
    xStaticBlock(node) { fail('static blocks are only supported inside classes', node); }
    xPrivateIdentifier(node) { fail('private names are not supported', node); }
    xMapCreation(node) {
      if (node.entries) fail('a Map built from entries is not supported', node);
      const t = this.typeOf(node, null);
      return { e: A.call(A.mem(A.id('TJsMap'), 'Create')), t: t && t.k === 'map' ? t : tMap(T.any, T.any) };
    }

    /** get/set/has/delete/clear of a Map; keys and values are dynamic values. */
    mapCall(obj, name, args, node) {
      const t = obj.t;
      const key = () => this.toJsValue(this.ex(args[0], t.keyT));
      switch (name) {
        case 'get': return { e: A.call(A.mem(obj.e, 'Get'), [key()]), t: T.any };
        case 'set': return { e: A.call(A.mem(obj.e, 'Put'), [key(), this.toJsValue(this.ex(args[1], t.valueT))]), t, stmtOk: true };
        case 'has': return { e: A.call(A.mem(obj.e, 'Has'), [key()]), t: T.bool };
        case 'delete': return { e: A.call(A.mem(obj.e, 'Delete'), [key()]), t: T.bool, stmtOk: true };
        case 'clear': return { e: A.call(A.mem(obj.e, 'Clear')), t: T.void, stmtOk: true };
      }
      fail('Map.' + name + ' is not supported', node);
    }
    xDataViewCreation(node) { fail('DataView is not supported', node); }
    xDeleteExpression(node) { fail('delete is not supported', node); }

    // =====================================================================
    // Initialization and dispatchers
    // =====================================================================

    transformInitialization() {
      this.fn = this.newFn({ name: 'initialization' });
      const out = [];
      this.pushScope();
      // static fields and static blocks of classes run before the rest
      for (const s of this.topStatements) this.stmt(s, out);
      this.popScope();
      if (this.fn.vars.length || this.fn.labels.length || this.fn.nested.length) {
        // locals of the top level live in a routine of their own
        const name = this.globalPool.take('JsUnitInit');
        this.routines.push(A.routine({ name, routineKind: 'procedure', labels: this.fn.labels, vars: this.dedupeVars(this.fn.vars), nested: this.fn.nested, body: out }));
        this.forwards.push(A.routine({ name, routineKind: 'procedure' }));
        this.initialization.push(A.expr(A.call(A.id(name))));
      } else {
        this.initialization.push(...out);
      }
      this.fn = null;
    }

    /** Name-based member access for the vector harness (JavaScript's `field in instance` and `instance[field] = v`). */
    generateDispatchers(c) {
      const d = { setters: [], hasNames: [], calls: [], methodNames: [], getters: [], invokes: [] };
      for (const m of c.members.values()) {
        if (m.static) continue;
        try {
          this.dispatchEntry(c, m, d);
        } catch (e) {
          if (!(e instanceof TranspileError)) throw e;
          this.diagnostics.push(`${c.jsName}.${m.jsName} is not reachable by name: ${e.message}`);
        }
      }
      this.emitDispatchers(c, d);
    }

    /** One member's entries in the name dispatchers (set, get, has, call with one value, invoke). */
    dispatchEntry(c, m, d) {
      const self = name => A.mem(A.id('Self'), name);
      if (m.kind === 'field' && m.owner === c) {
        if (m.type && m.type.k === 'function') return;
        const t = m.type || T.any;
        d.setters.push([m.jsName, A.assign(self(m.pas), this.fromJsValue(A.id('AValue'), t))]);
        d.getters.push([m.jsName, A.assign(A.id('AValue'), this.toJsValue({ e: self(m.pas), t }))]);
        d.hasNames.push(m.jsName);
      } else if (m.kind === 'prop') {
        const t = m.type || T.any;
        const setter = m.setterPas || (m.overrides && (m.overrides.setter || m.overrides.setterPas));
        const getter = m.getterPas || (m.overrides && (m.overrides.getter || m.overrides.getterPas));
        if (setter) d.setters.push([m.jsName, A.assign(self(m.pas), this.fromJsValue(A.id('AValue'), t))]);
        else d.setters.push([m.jsName, A.raise(A.call(A.mem(A.id('EJsTypeError'), 'Create'), [A.lit(pasString(`Cannot set property ${m.jsName} of #<${c.jsName}> which has only a getter`))]))]);
        if (getter) d.getters.push([m.jsName, A.assign(A.id('AValue'), this.toJsValue({ e: self(m.pas), t }))]);
        d.hasNames.push(m.jsName);
      } else if (m.kind === 'method') {
        const params = m.params || [];
        if (params.some(p => p.rest)) return;
        const args = params.map((p, i) => i === 0 ? this.fromJsValue(A.id('AValue'), p.type) : (p.defaultNode ? this.safeDefault(p) : this.defaultValue(p.type)));
        d.calls.push([m.jsName, A.expr(A.call(self(m.pas), args))]);
        const all = params.map((p, i) => this.fromJsValue(A.call('JsArg', [A.id('AArgs'), A.lit(i)]), p.type));
        const call = A.call(self(m.pas), all);
        const ret = m.ret || T.void;
        d.invokes.push([m.jsName, ret.k === 'void' ? A.block([A.expr(call), A.assign(A.id('AResult'), A.call('JsVUndef'))])
          : A.assign(A.id('AResult'), this.toJsValue({ e: call, t: ret }))]);
        d.methodNames.push(m.jsName);
      }
    }

    emitDispatchers(c, d) {
      const { setters, hasNames, calls, methodNames, getters, invokes } = d;
      const dispatch = (name, entries, params, tail) => {
        const body = [];
        for (const [js, stmt] of entries)
          body.push(A.ifStmt(A.bin('=', A.id('AName'), A.lit(pasString(js))), [stmt, A.exit(A.lit('True'))]));
        body.push(A.assign(A.id('Result'), tail));
        this.routines.push(A.routine({ name, owner: c.pas, routineKind: 'function', params, returns: 'Boolean', body }));
        c.decl.methods.push(A.methodDecl({ name, routineKind: 'function', params, returns: 'Boolean', directives: ['override'] }));
      };
      dispatch('JsGetMember', getters, [A.param('AName', 'string', 'const'), A.param('AValue', 'TJsValue', 'out')],
        A.call(A.raw('inherited JsGetMember'), [A.id('AName'), A.id('AValue')]));
      dispatch('JsInvoke', invokes, [A.param('AName', 'string', 'const'), A.param('AArgs', 'array of TJsValue', 'const'), A.param('AResult', 'TJsValue', 'out')],
        A.call(A.raw('inherited JsInvoke'), [A.id('AName'), A.id('AArgs'), A.id('AResult')]));
      const nameValue = () => [A.param('AName', 'string', 'const'), A.param('AValue', 'TJsValue', 'const')];
      dispatch('JsSetMember', setters, nameValue(), A.call(A.raw('inherited JsSetMember'), [A.id('AName'), A.id('AValue')]));
      dispatch('JsCallMethod', calls, nameValue(), A.call(A.raw('inherited JsCallMethod'), [A.id('AName'), A.id('AValue')]));
      const has = (name, names) => {
        const cond = names.length ? names.map(n => A.bin('=', A.id('AName'), A.lit(pasString(n)))).reduce((a, b) => A.bin('or', a, b)) : null;
        const tail = A.call(A.raw('inherited ' + name), [A.id('AName')]);
        const body = [A.assign(A.id('Result'), cond ? A.bin('or', cond, tail) : tail)];
        this.routines.push(A.routine({ name, owner: c.pas, routineKind: 'function', params: [A.param('AName', 'string', 'const')], returns: 'Boolean', body }));
        c.decl.methods.push(A.methodDecl({ name, routineKind: 'function', params: [A.param('AName', 'string', 'const')], returns: 'Boolean', directives: ['override'] }));
      };
      has('JsHasMember', hasNames);
      has('JsHasMethod', methodNames);
    }

    /** A parameter default usable outside the method (only literals are). */
    safeDefault(p) {
      const n = p.defaultNode;
      if (n && n.type === 'Literal') {
        const savedFn = this.fn;
        this.fn = this.fn || this.newFn({});
        try { return this.conv(this.ex(n, p.type), p.type); } finally { this.fn = savedFn; }
      }
      return this.defaultValue(p.type);
    }

    // =====================================================================
    // Assembly
    // =====================================================================

    assembleUnit() {
      // class declarations
      const classDecls = this.userClasses.map(c => {
        const members = [];
        for (const m of c.members.values()) {
          if (m.kind === 'field' && m.owner === c) members.push(A.field(m.pas, this.pasType(m.type || T.any), !!m.static));
        }
        members.push(...c.decl.methods);
        for (const m of c.members.values()) {
          if (m.kind !== 'prop') continue;
          const read = m.getterPas || (m.overrides && (m.overrides.getter || m.overrides.getterPas)) || null;
          const write = m.setterPas || (m.overrides && (m.overrides.setter || m.overrides.setterPas)) || null;
          if (m.overrides && !m.getNode && !m.setNode) continue;
          members.push(A.property(m.pas, this.pasType(m.type || T.any), read, write, !!m.static));
        }
        return A.classDecl(c.pas, c.base ? c.base.pas : 'TJsObject', members);
      });
      // types: forward classes, records and aliases by dependency, then classes
      const types = [];
      for (const c of this.userClasses) types.push(A.forwardClass(c.pas));
      const typeEntries = [
        ...[...this.records.values()].map(r => ({ depth: r.depth, decl: A.recordDecl(r.name, r.fields) })),
        ...[...this.aliases.values()].map(a => ({ depth: a.depth, decl: A.typeAlias(a.name, `TJsArray<${a.elemPas}>`) }))
      ];
      typeEntries.sort((a, b) => a.depth - b.depth);
      types.push(...typeEntries.map(e => e.decl));
      types.push(...classDecls);
      // globals
      const vars = [];
      for (const g of this.globals.values()) vars.push(A.varDecl(g.pas, this.pasType(g.type)));
      for (const [, name] of this.bigLiterals) vars.push(A.varDecl(name, 'TBigInt'));
      const init = [];
      for (const [value, name] of this.bigLiterals) {
        const v = BigInt(value);
        const fits = v >= -(2n ** 63n) && v < 2n ** 63n;
        init.push(A.assign(A.id(name), fits ? A.call(A.mem(A.id('TBigInt'), 'FromInt64'), [A.lit(v.toString())]) : A.call(A.mem(A.id('TBigInt'), 'Parse'), [A.lit(pasString(v.toString()))])));
      }
      const converters = [...this.converters.values()].filter(Boolean);
      return A.unit({
        name: this.unitName,
        runtimeUnit: this.options.runtimeUnit || null,
        isLibrary: !!this.options.library,
        usesUnits: this.usesUnits,
        header: ['Generated from JavaScript by the SynthelicZ Cipher transpiler', 'Free Pascal 3.2+ (Delphi mode); the runtime is embedded'],
        types, consts: this.consts, vars,
        forwards: [...converters.map(r => Object.assign({}, r)), ...this.forwards],
        routines: [...converters, ...this.routines],
        initialization: [...init, ...this.initialization]
      });
    }
  }

  DelphiTransformer.TranspileError = TranspileError;
  DelphiTransformer.parseType = parseType;

  const exported = { DelphiTransformer, TranspileError, parseType };
  if (typeof module !== 'undefined' && module.exports)
    module.exports = exported;
  if (typeof global !== 'undefined' && global)
    global.DelphiTransformer = DelphiTransformer;

})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
