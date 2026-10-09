/**
 * CppTransformer.js - IL AST to C++ AST Transformer
 * Translates the typed IL AST into C++20 that runs on the runtime CppEmitter
 * embeds (namespace js).
 * (c)2006-2025 Hawkynt
 *
 * Every C++ type comes from an IL type (resultType, contextType, declared
 * types, JSDoc); nothing is guessed from names or values. A site the IL leaves
 * untyped becomes js::Any, the runtime's dynamic value, which converts back at
 * the next typed site. The mapping:
 *   int8..uint64      int8_t..uint64_t        float64/number  double
 *   boolean           bool                    string          js::String (UTF-16, nullable)
 *   bigint/BigInt     js::BigInt              T[]             js::Array<T> (shared, nullable)
 *   class C           C* (never freed)        object/any/T    js::Any
 *   function          js::Fun                 Map/Set         js::Map* / js::Set*
 *
 * Expressions keep JavaScript's values: integer arithmetic runs in a type wide
 * enough for the exact result (int64/uint64), bitwise operators on Numbers in
 * int32/uint32 as ToInt32/ToUint32 do, division in double, and a value is
 * converted to its IL type where it is stored, passed or returned. Classes
 * become structs whose JavaScript constructor is the method __ctor (so virtual
 * calls in it dispatch as in JavaScript); every method is virtual; accessors
 * are __get_x/__set_x; every class answers the runtime's dynamic member
 * protocol (__get/__set/__has/__call), which the vector harness and untyped
 * accesses use.
 */

(function (global) {
  'use strict';

  const CppAST = typeof require !== 'undefined' ? require('./CppAST.js') : global.CppAST;
  const {
    CppFile, CppRaw, CppComment, CppClass, CppFunction, CppBlock, CppExpressionStatement,
    CppVariableDeclaration, CppIf, CppFor, CppWhile, CppDoWhile, CppReturn, CppBreak, CppContinue,
    CppGoto, CppLabel, CppThrow, CppTry, CppSwitch
  } = CppAST;

  // ========================[ TYPES ]========================

  const INT_TYPES = {
    int8: [8, true], uint8: [8, false], int16: [16, true], uint16: [16, false],
    int32: [32, true], uint32: [32, false], int64: [64, true], uint64: [64, false]
  };
  const ALIASES = {
    byte: 'uint8', word: 'uint16', dword: 'uint32', qword: 'uint64', sbyte: 'int8', short: 'int16',
    int: 'int32', long: 'int64', bool: 'boolean', Boolean: 'boolean', String: 'string',
    float: 'float32', double: 'float64', number: 'float64', Number: 'float64', integer: 'int32'
  };
  const TYPED_ARRAYS = {
    Uint8Array: 'uint8', Uint8ClampedArray: 'uint8', Int8Array: 'int8', Uint16Array: 'uint16', Int16Array: 'int16',
    Uint32Array: 'uint32', Int32Array: 'int32', Float32Array: 'float32', Float64Array: 'float64',
    BigUint64Array: 'uint64', BigInt64Array: 'int64', ArrayBuffer: 'uint8'
  };

  const T = {
    int: (bits, signed) => ({ k: 'int', bits, signed }),
    f64: { k: 'f64' }, f32: { k: 'f32' }, bool: { k: 'bool' }, str: { k: 'str' }, big: { k: 'big' },
    any: { k: 'any' }, void: { k: 'void' }, null: { k: 'null' }, undef: { k: 'undef' }, fun: { k: 'fun' },
    map: { k: 'map' }, set: { k: 'set' }, regex: { k: 'regex' }, dataview: { k: 'dataview' },
    arr: e => ({ k: 'arr', e }),
    cls: (name, fw) => ({ k: 'cls', name, fw: !!fw }),
    sfn: (params, ret) => ({ k: 'sfn', params, ret }) // a typed local function (std::function)
  };
  T.i32 = T.int(32, true); T.u32 = T.int(32, false); T.i64 = T.int(64, true); T.u64 = T.int(64, false);
  T.u8 = T.int(8, false);

  const isInt = t => t && t.k === 'int';
  const isFloat = t => t && (t.k === 'f64' || t.k === 'f32');
  const isNum = t => isInt(t) || isFloat(t);
  const isNumOrBool = t => isNum(t) || (t && t.k === 'bool');
  const isRef = t => t && (t.k === 'arr' || t.k === 'str' || t.k === 'cls' || t.k === 'fun' || t.k === 'map' || t.k === 'set' || t.k === 'regex' || t.k === 'dataview' || t.k === 'any');

  function sameType(a, b) {
    if (!a || !b || a.k !== b.k) return false;
    switch (a.k) {
      case 'int': return a.bits === b.bits && a.signed === b.signed;
      case 'arr': return sameType(a.e, b.e);
      case 'cls': return a.name === b.name;
      case 'sfn': return false;
      default: return true;
    }
  }

  // C++ keywords and macros a JavaScript name may collide with
  const RESERVED = new Set(('alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq final override ' +
    'NULL EOF NAN INFINITY HUGE_VAL BUFSIZ RAND_MAX CHAR_BIT INT_MAX INT_MIN UINT_MAX LONG_MAX LONG_MIN SIZE_MAX INT8_MAX INT16_MAX INT32_MAX INT64_MAX UINT8_MAX UINT16_MAX UINT32_MAX UINT64_MAX INT8_MIN INT16_MIN INT32_MIN INT64_MIN M_PI M_E EXIT_SUCCESS EXIT_FAILURE stdin stdout stderr errno assert offsetof min max abs main std js int8_t int16_t int32_t int64_t uint8_t uint16_t uint32_t uint64_t size_t ptrdiff_t intptr_t uintptr_t FILE TRUE FALSE DOMAIN OVERFLOW UNDERFLOW _U _L _N _S _P _C _X _B').split(/\s+/));

  function cppIdent(name) {
    let n = String(name).replace(/[^A-Za-z0-9_]/g, c => '_' + c.charCodeAt(0).toString(16) + '_');
    if (/^[0-9]/.test(n)) n = '_' + n;
    if (RESERVED.has(n) || n.startsWith('__')) n = n + '_';
    return n;
  }

  // A u"..." literal for a JavaScript string (UTF-16 code units, any of them)
  function u16Literal(s) {
    let out = 'u"';
    let lastHex = false;
    for (let i = 0; i < s.length; ++i) {
      const c = s.charCodeAt(i);
      const ch = s[i];
      if (c >= 0x20 && c < 0x7f && ch !== '"' && ch !== '\\' && ch !== '?') {
        if (lastHex && /[0-9a-fA-F]/.test(ch)) out += '" u"';
        out += ch; lastHex = false;
      } else if (ch === '"') { out += '\\"'; lastHex = false; }
      else if (ch === '\\') { out += '\\\\'; lastHex = false; }
      else if (ch === '?') { out += '\\?'; lastHex = false; }
      else if (ch === '\n') { out += '\\n'; lastHex = false; }
      else if (ch === '\t') { out += '\\t'; lastHex = false; }
      else if (ch === '\r') { out += '\\r'; lastHex = false; }
      else { out += '\\x' + c.toString(16); lastHex = true; }
    }
    return out + '"';
  }
  const lit = s => `JS_LIT(${u16Literal(s)})`;

  // ========================[ FRAMEWORK MODEL ]========================
  // The AlgorithmFramework classes the runtime defines, with the member types
  // of their JSDoc (the same types the IL gives algorithm code reading them).
  const FW_FAMILY = (base, fields = {}) => ({ base, fields, ctor: [] });
  const FRAMEWORK = {
    Object: { base: null },
    Error: { base: 'Object', fields: { name: 'string', message: 'string' }, ctor: [['message', 'string']] },
    LinkItem: { base: 'Object', fields: { text: 'string', uri: 'string' }, ctor: [['text', 'string'], ['uri', 'string']] },
    TestCase: { base: 'LinkItem', fields: { input: 'uint8[]', expected: 'uint8[]' }, ctor: [['input', 'uint8[]'], ['expected', 'uint8[]'], ['description', 'string'], ['uri', 'string']] },
    Vulnerability: { base: 'LinkItem', fields: { description: 'string', mitigation: 'string' }, ctor: [['type', 'string'], ['description', 'string'], ['mitigation', 'string'], ['uri', 'string']] },
    AuthResult: { base: 'Object', fields: { Success: 'boolean', Output: 'uint8[]', FailureReason: 'string' }, ctor: [['success', 'boolean'], ['output', 'uint8[]'], ['failureReason', 'string']] },
    KeySize: { base: 'Object', fields: { minSize: 'int32', maxSize: 'int32', stepSize: 'int32' }, ctor: [['minSize', 'int32'], ['maxSize', 'int32'], ['stepSize', 'int32']] },
    BlockAbsorber: {
      base: 'Object', fields: { _blockSize: 'int32', _processBlock: 'function', _held: 'uint8[]', _pending: 'int32', _length: 'uint64' },
      accessors: { BlockSize: { type: 'int32', get: true }, Pending: { type: 'int32', get: true }, Length: { type: 'uint64', get: true } },
      ctor: [['blockSize', 'int32'], ['processBlock', 'function']],
      methods: { Absorb: { params: [['data', 'uint8[]']], ret: 'void' }, Finish: { params: [['finalize', 'function']], ret: 'any' }, Reset: { params: [], ret: 'void' } }
    },
    Algorithm: {
      base: 'Object',
      fields: {
        name: 'string', description: 'string', inventor: 'string', year: 'int32', category: 'object', subCategory: 'string',
        securityStatus: 'object', complexity: 'object', country: 'object', documentation: 'any[]', references: 'any[]',
        knownVulnerabilities: 'any[]', tests: 'TestCase[]'
      },
      ctor: [],
      methods: { CreateInstance: { params: [['isInverse', 'boolean', 'false']], ret: 'IAlgorithmInstance' } }
    },
    CryptoAlgorithm: FW_FAMILY('Algorithm'),
    SymmetricCipherAlgorithm: FW_FAMILY('CryptoAlgorithm'),
    AsymmetricCipherAlgorithm: FW_FAMILY('CryptoAlgorithm'),
    BlockCipherAlgorithm: FW_FAMILY('SymmetricCipherAlgorithm', { SupportedKeySizes: 'any[]', SupportedBlockSizes: 'any[]' }),
    StreamCipherAlgorithm: FW_FAMILY('SymmetricCipherAlgorithm'),
    EncodingAlgorithm: FW_FAMILY('Algorithm'),
    CompressionAlgorithm: FW_FAMILY('Algorithm'),
    ErrorCorrectionAlgorithm: FW_FAMILY('Algorithm'),
    HashFunctionAlgorithm: FW_FAMILY('Algorithm', { SupportedOutputSizes: 'any[]' }),
    MacAlgorithm: FW_FAMILY('Algorithm', { SupportedMacSizes: 'any[]', NeedsKey: 'boolean' }),
    KdfAlgorithm: FW_FAMILY('Algorithm', { SupportedOutputSizes: 'any[]', SaltRequired: 'boolean' }),
    PaddingAlgorithm: FW_FAMILY('Algorithm', { IsLengthIncluded: 'boolean' }),
    CipherModeAlgorithm: FW_FAMILY('Algorithm', { RequiresIV: 'boolean', SupportedIVSizes: 'any[]' }),
    AeadAlgorithm: FW_FAMILY('CryptoAlgorithm', { SupportedTagSizes: 'any[]', SupportsDetached: 'boolean' }),
    RandomGenerationAlgorithm: FW_FAMILY('Algorithm', { IsDeterministic: 'boolean', IsCryptographicallySecure: 'boolean', SupportedSeedSizes: 'any[]' }),
    IAlgorithmInstance: {
      base: 'Object', fields: { algorithm: 'Algorithm', isInverse: 'boolean', inputBuffer: 'uint8[]' },
      ctor: [['algorithm', 'Algorithm']],
      methods: { Feed: { params: [['data', 'uint8[]']], ret: 'void' }, Result: { params: [], ret: 'uint8[]' }, Dispose: { params: [], ret: 'void' } }
    },
    IBlockCipherInstance: {
      base: 'IAlgorithmInstance', fields: { BlockSize: 'int32', KeySize: 'int32', _key: 'uint8[]' },
      accessors: { key: { type: 'uint8[]', get: true, set: true } },
      ctor: [['algorithm', 'Algorithm']],
      methods: {
        EncryptBlock: { params: [['block', 'uint8[]']], ret: 'uint8[]' }, DecryptBlock: { params: [['block', 'uint8[]']], ret: 'uint8[]' },
        RequireBlockMultiple: { params: [['blockSize', 'int32', '0']], ret: 'int32' }, Result: { params: [], ret: 'uint8[]' }
      }
    },
    IHashFunctionInstance: { base: 'IAlgorithmInstance', fields: { OutputSize: 'int32' }, ctor: [['algorithm', 'Algorithm']] },
    IMacInstance: { base: 'IAlgorithmInstance', fields: {}, ctor: [['algorithm', 'Algorithm']], methods: { ComputeMac: { params: [['data', 'uint8[]']], ret: 'uint8[]' } } },
    IKdfInstance: { base: 'IAlgorithmInstance', fields: { OutputSize: 'int32', Iterations: 'int32' }, ctor: [['algorithm', 'Algorithm']] },
    IAeadInstance: { base: 'IAlgorithmInstance', fields: { aad: 'uint8[]', tagSize: 'int32' }, ctor: [['algorithm', 'Algorithm']] },
    IErrorCorrectionInstance: { base: 'IAlgorithmInstance', fields: {}, ctor: [['algorithm', 'Algorithm']], methods: { DetectError: { params: [['data', 'uint8[]']], ret: 'boolean' } } },
    IRandomGeneratorInstance: { base: 'IAlgorithmInstance', fields: {}, ctor: [['algorithm', 'Algorithm']], methods: { NextBytes: { params: [['count', 'int32']], ret: 'uint8[]' } } }
  };
  const FW_FUNCTIONS = {
    RegisterAlgorithm: { params: [['algorithm', 'Algorithm']], ret: 'void', cpp: 'js::RegisterAlgorithm' },
    SpongePadBlocks: { params: [['held', 'uint8[]'], ['pending', 'int32'], ['rate', 'int32'], ['separator', 'int32']], ret: 'uint8[][]', cpp: 'js::SpongePadBlocks' },
    MerkleDamgardBlocks: { params: [['held', 'uint8[]'], ['pending', 'int32'], ['totalLength', 'float64'], ['options', 'object']], ret: 'uint8[][]', cpp: 'js::MerkleDamgardBlocks' }
  };
  const FW_ENUMS = new Set(['CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode']);
  const GLOBAL_OBJECTS = new Set(['OpCodes', 'AlgorithmFramework', 'Math', 'Number', 'String', 'Array', 'Object', 'JSON', 'console', 'BigInt', 'Date', 'Symbol', 'Reflect', 'globalThis', 'window', 'global', 'self', 'module', 'exports', 'require', 'define', 'ArrayBuffer', 'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array', 'Float32Array', 'Float64Array', 'BigUint64Array', 'BigInt64Array', 'DataView', 'Map', 'Set', 'Promise', 'TextEncoder', 'TextDecoder', 'Buffer', 'crypto', 'performance', 'process']);

  // ========================[ THE TRANSFORMER ]========================

  class CppTransformer {
    constructor(options = {}) {
      this.options = options;
      this.warnings = [];
      this.tmpCounter = 0;
      const base = String(options.className || options.namespace || 'generated');
      this.ns = cppIdent(String(options.namespace || 'generated') + '_' + base).replace(/^_+/, '');
    }

    // ------------------------------------------------------------ entry

    transform(ast) {
      const file = new CppFile();
      file.namespace = this.ns;
      this.program = ast;
      this.traceSites = CppTransformer.traceSitesFor(this.options.className);
      this.classes = new Map();     // user classes by JS name
      this.functions = new Map();   // top-level functions by JS name
      this.globals = new Map();     // top-level variables by JS name
      this.scopes = [];
      this.fn = null;
      const body = (ast && ast.type === 'Program' ? ast.body : (Array.isArray(ast) ? ast : [ast])) || [];
      try {
        this.collect(body);
        this.analyzeClasses();
        this.emitProgram(body, file);
      } catch (e) {
        this.warnings.push('transformation error: ' + e.message);
        file.sections.push(new CppComment('transformation failed: ' + String(e.message).replace(/\n/g, ' ')));
        if (this.options.throwOnError) throw e;
      }
      return file;
    }

    // ------------------------------------------------------------ types

    /** IL type (string, JSDoc type object, or null) -> type */
    type(il) {
      if (il === null || il === undefined || il === '') return T.any;
      if (typeof il === 'object') {
        if (il.k) return il;
        if (il.isArray) return T.arr(this.type(il.elementType || (il.name ? il.name.replace(/\[\]$/, '') : null)));
        if (il.isUnion && il.unionTypes) {
          const members = il.unionTypes.map(u => u && u.name).filter(n => n && n !== 'null' && n !== 'undefined');
          return members.length === 1 ? this.type(members[0]) : T.any;
        }
        if (il.isTuple) return T.arr(T.any);
        if (il.isNullable && il.name && NULLABLE_VALUE(il.name)) return T.any;
        return this.type(il.name || null);
      }
      let s = String(il).trim();
      if (!s) return T.any;
      if (/^\?/.test(s) || /[=?]$/.test(s)) {
        const inner = this.type(s.replace(/^\?/, '').replace(/[=?]$/, ''));
        return isNumOrBool(inner) || inner.k === 'big' ? T.any : inner;
      }
      if (s.endsWith('[]')) return T.arr(this.type(s.slice(0, -2)));
      if (s.startsWith('[') && s.endsWith(']')) return T.arr(T.any);
      if (s.startsWith('(')) return T.any;
      let m = s.match(/^Array\.?<(.+)>$/);
      if (m) return T.arr(this.type(m[1]));
      if (s.includes('|')) {
        const members = splitTop(s, '|').map(x => x.trim()).filter(x => x !== 'null' && x !== 'undefined');
        if (members.length === 1) {
          const inner = this.type(members[0]);
          return isNumOrBool(inner) || inner.k === 'big' ? T.any : inner;
        }
        return T.any;
      }
      if ((m = s.match(/^(Map|Set|Object|Record)\.?<.*>$/))) return m[1] === 'Map' ? T.map : m[1] === 'Set' ? T.set : T.any;
      if (ALIASES[s]) s = ALIASES[s];
      if (INT_TYPES[s]) return T.int(INT_TYPES[s][0], INT_TYPES[s][1]);
      switch (s) {
        case 'float64': return T.f64;
        case 'float32': return T.f32;
        case 'boolean': return T.bool;
        case 'string': return T.str;
        case 'bigint': case 'BigInt': return T.big;
        case 'void': return T.void;
        case 'null': return T.null;
        case 'undefined': return T.undef;
        case 'function': case 'Function': return T.fun;
        case 'Map': return T.map;
        case 'Set': return T.set;
        case 'regex': case 'RegExp': return T.any;
        case 'DataView': return T.dataview;
        case 'object': case 'Object': case 'any': case '*': case 'mixed': return T.any;
        case 'Error': case 'TypeError': case 'RangeError': case 'ReferenceError': case 'SyntaxError': return T.cls('Error', true);
      }
      if (TYPED_ARRAYS[s]) return T.arr(this.type(TYPED_ARRAYS[s]));
      if (this.classes && this.classes.has(s)) return T.cls(s, false);
      if (FRAMEWORK[s] && s !== 'Object') return T.cls(s, true);
      return T.any;
    }

    /** C++ spelling of a type */
    cpp(t) {
      switch (t.k) {
        case 'int': return `${t.signed ? '' : 'u'}int${t.bits}_t`;
        case 'f64': return 'double';
        case 'f32': return 'float';
        case 'bool': return 'bool';
        case 'str': return 'js::String';
        case 'big': return 'js::BigInt';
        case 'any': case 'undef': return 'js::Any';
        case 'void': return 'void';
        case 'fun': return 'js::Fun';
        case 'map': return 'js::Map*';
        case 'set': return 'js::Set*';
        case 'regex': return 'js::Any';
        case 'dataview': return 'js::DataView*';
        case 'null': return 'std::nullptr_t';
        case 'arr': return `js::Array<${this.cpp(t.e)}>`;
        case 'cls': return t.fw ? `js::${t.name}*` : `${this.ns}::${cppIdent(t.name)}*`;
        case 'sfn': return `std::function<${this.cpp(t.ret)}(${t.params.map(p => this.cpp(p)).join(', ')})>`;
        default: return 'js::Any';
      }
    }

    /** The class (not pointer) name of a class type */
    clsName(t) { return t.fw ? `js::${t.name}` : `${this.ns}::${cppIdent(t.name)}`; }

    /** The JavaScript undefined of a type: what an unset field or omitted argument holds */
    defaultOf(t) {
      switch (t.k) {
        case 'int': case 'f64': case 'f32': return '0';
        case 'bool': return 'false';
        case 'cls': case 'map': case 'set': case 'dataview': return 'nullptr';
        case 'any': case 'undef': case 'regex': return 'js::Any()';
        default: return `${this.cpp(t)}()`;
      }
    }

    /** A null of a type (the JavaScript null literal stored into it) */
    nullOf(t) {
      switch (t.k) {
        case 'any': case 'regex': return 'js::Any(nullptr)';
        case 'undef': return 'js::Any()';
        case 'int': case 'f64': case 'f32': return '0';
        case 'bool': return 'false';
        case 'big': return 'js::BigInt()';
        case 'void': return '(void)0';
        default: return this.defaultOf(t);
      }
    }

    isSubclass(child, parent) {
      for (let c = child; c; c = this.baseOf(c)) if (c === parent) return true;
      return false;
    }

    baseOf(name) {
      const u = this.classes.get(name);
      if (u) return u.base;
      const f = FRAMEWORK[name];
      return f ? f.base : null;
    }

    // ------------------------------------------------------------ conversions

    /** C++ text of expression e converted to type `to` */
    cv(e, to) {
      const from = e.t;
      if (!to || to.k === 'void') return e.c;
      if (sameType(from, to)) return e.c;
      if (from.k === 'sfn') {
        if (to.k === 'fun' || to.k === 'any') {
          const f = this.wrapSfn(e);
          return to.k === 'any' ? `js::Any(${f})` : f;
        }
        return `js::fromAny<${this.cpp(to)}>(js::Any(${this.wrapSfn(e)}))`;
      }
      if (to.k === 'any' || to.k === 'undef') {
        if (from.k === 'null') return 'js::Any(nullptr)';
        if (from.k === 'undef') return e.c;
        if (from.k === 'void') return `((void)(${e.c}), js::Any())`;
        return `js::Any(${e.c})`;
      }
      if (from.k === 'void') return `((void)(${e.c}), ${this.defaultOf(to)})`;
      if (from.k === 'null' || from.k === 'undef') return this.nullOf(to);
      if (from.k === 'any') return `js::fromAny<${this.cpp(to)}>(${e.c})`;
      switch (to.k) {
        case 'int':
          if (from.k === 'int' || from.k === 'bool') return `static_cast<${this.cpp(to)}>(${e.c})`;
          if (isFloat(from)) return `js::num<${this.cpp(to)}>(${e.c})`;
          if (from.k === 'big') return `static_cast<${this.cpp(to)}>((${e.c}).lowU64())`;
          if (from.k === 'str') return `js::num<${this.cpp(to)}>(js::toNumber(${e.c}))`;
          break;
        case 'f64': case 'f32':
          if (from.k === 'int' || from.k === 'bool' || isFloat(from)) return `static_cast<${this.cpp(to)}>(${e.c})`;
          if (from.k === 'big') return `static_cast<${this.cpp(to)}>((${e.c}).toDouble())`;
          if (from.k === 'str') return `static_cast<${this.cpp(to)}>(js::toNumber(${e.c}))`;
          break;
        case 'bool':
          return `js::truthy(${e.c})`;
        case 'str':
          if (isNumOrBool(from) || from.k === 'big') return `js::str(${e.c})`;
          break;
        case 'big':
          if (from.k === 'int') return `js::BigInt(${from.bits === 64 ? '' : '(long long)'}${e.c})`;
          if (isFloat(from)) return `js::BigInt((double)(${e.c}))`;
          if (from.k === 'bool') return `js::BigInt((${e.c}) ? 1 : 0)`;
          break;
        case 'arr':
          if (from.k === 'arr') return `js::arrayAs<${this.cpp(to.e)}>(${e.c})`;
          break;
        case 'cls':
          if (from.k === 'cls') {
            if (this.isSubclass(from.name, to.name)) return `static_cast<${this.cpp(to)}>(${e.c})`;
            if (this.isSubclass(to.name, from.name)) return `js::downcast<${this.clsName(to)}>(${e.c})`;
          }
          break;
        case 'fun':
          break;
      }
      return `js::fromAny<${this.cpp(to)}>(js::Any(${e.c}))`;
    }

    /** A typed local function as a js::Fun (the dynamic calling convention) */
    wrapSfn(e) {
      const t = e.t;
      const args = t.params.map((p, i) => `js::fromAny<${this.cpp(p)}>(__a.size() > ${i} ? __a[${i}] : js::Any())`).join(', ');
      const call = `${e.c}(${args})`;
      return t.ret.k === 'void'
        ? `js::Fun([=](std::vector<js::Any>& __a) -> js::Any { ${call}; return js::Any(); })`
        : `js::Fun([=](std::vector<js::Any>& __a) -> js::Any { return js::Any(${call}); })`;
    }

    tmp(prefix = 't') { return `__${prefix}${++this.tmpCounter}`; }

    // ------------------------------------------------------------ collection

    collect(body) {
      // const { RegisterAlgorithm, ... } = AlgorithmFramework (as the IL spells it: a
      // temporary bound to the module, then one constant per name): the runtime
      // provides those names, so they are not variables
      this.moduleAliases = new Set(['AlgorithmFramework', 'OpCodes']);
      this.skippedDeclarators = new Set();
      for (const node of body) {
        if (!node || node.type !== 'VariableDeclaration') continue;
        for (const d of node.declarations || []) {
          if (!d.id || d.id.type !== 'Identifier' || !d.init) continue;
          if (d.init.type === 'Identifier' && this.moduleAliases.has(d.init.name)) { this.moduleAliases.add(d.id.name); this.skippedDeclarators.add(d); }
          else if (d.init.type === 'MemberExpression' && !d.init.computed && d.init.object && d.init.object.type === 'Identifier' &&
                   this.moduleAliases.has(d.init.object.name) && d.init.property && d.init.property.name === d.id.name) this.skippedDeclarators.add(d);
        }
      }
      for (const node of body) {
        if (!node) continue;
        if (node.type === 'ClassDeclaration' && node.id) this.declareClass(node);
        else if (node.type === 'FunctionDeclaration' && node.id) this.functions.set(node.id.name, { node, name: node.id.name, cpp: cppIdent(node.id.name) });
        else if (node.type === 'VariableDeclaration') {
          for (const d of node.declarations || []) {
            if (d.id && d.id.type === 'Identifier' && !this.skippedDeclarators.has(d)) {
              // a class expression bound to a constant is a class
              if (d.init && (d.init.type === 'ClassExpression' || d.init.type === 'ClassDeclaration') && !this.classes.has(d.id.name)) {
                this.declareClass(Object.assign({}, d.init, { id: { type: 'Identifier', name: d.id.name } }));
                continue;
              }
              this.globals.set(d.id.name, { name: d.id.name, cpp: cppIdent(d.id.name), node: d, type: null });
            }
          }
        }
      }
      // global types once every class is known
      for (const g of this.globals.values()) g.type = this.declType(g.node);
    }

    declareClass(node) {
      const name = node.id.name;
      const superName = node.superClass ? (node.superClass.name || (node.superClass.property && node.superClass.property.name) || null) : null;
      this.classes.set(name, {
        name, node, cppName: cppIdent(name), base: superName || 'Object', baseUnknown: false,
        fields: new Map(), accessors: new Map(), methods: new Map(), ctor: null,
        fieldInits: [], staticFields: new Map(), virtualAccessors: new Set()
      });
    }

    /** The declared type of a variable declarator */
    declType(d) {
      const il = d.declaredType || d.resultType || (d.id && d.id.resultType) || (d.init && (d.init.contextType || d.init.resultType));
      let t = this.type(il);
      if (d.declaredNullable || (d.id && d.id.nullable)) { if (isNumOrBool(t) || t.k === 'big') t = T.any; }
      if (t.k === 'void' || t.k === 'null' || t.k === 'undef') t = T.any;
      return t;
    }

    // ------------------------------------------------------------ class analysis

    analyzeClasses() {
      for (const c of this.classes.values()) {
        if (!this.classes.has(c.base) && !FRAMEWORK[c.base]) { c.baseUnknown = true; c.base = 'Object'; }
      }
      // members declared in each class body
      for (const c of this.classes.values()) {
        for (const m of (c.node.body && c.node.body.body) || []) {
          if (!m) continue;
          const key = m.key && (m.key.name || m.key.value);
          if (m.type === 'MethodDefinition') {
            if (m.computed && !key) continue;
            if (m.kind === 'constructor') { c.ctor = m; continue; }
            if (m.kind === 'get' || m.kind === 'set') {
              const a = c.accessors.get(key) || { name: key, get: null, set: null, isStatic: !!m.static, type: null };
              a[m.kind] = m;
              c.accessors.set(key, a);
              continue;
            }
            c.methods.set(key, { name: key, node: m, isStatic: !!m.static, cls: c.name });
          } else if (m.type === 'FieldDefinition' || m.type === 'PropertyDefinition' || m.type === 'ClassProperty') {
            if (m.static) c.staticFields.set(key, { name: key, node: m, type: null });
            else c.fieldInits.push(m);
          }
        }
      }
      // accessor types: the getter's result and the setter's parameter (JavaScript lets them differ);
      // an override keeps the types of the accessor it overrides
      for (const c of this.orderedClasses()) {
        for (const a of c.accessors.values()) {
          const inherited = a.isStatic ? null : this.findAccessorAbove(c.base, a.name);
          let gt = inherited ? inherited.type : null, st = inherited ? (inherited.setType || inherited.type) : null;
          if (!gt && a.get) gt = this.returnTypeOf(a.get.value, a.get);
          if (!st && a.set && a.set.value.params && a.set.value.params[0]) st = this.paramType(a.set.value.params[0]);
          if (!gt || gt.k === 'void') gt = st;
          if (!st || st.k === 'void') st = gt;
          a.type = gt && gt.k !== 'void' ? gt : T.any;
          a.setType = st && st.k !== 'void' ? st : T.any;
        }
      }
      // fields: every this.x assignment in the class, typed by the IL
      for (const c of this.classes.values()) {
        const found = new Map();
        const add = (name, il, declared) => {
          if (!name) return;
          const e = found.get(name) || { declared: [], seen: [] };
          if (declared) e.declared.push(il); else if (il) e.seen.push(il);
          found.set(name, e);
        };
        for (const fd of c.fieldInits) add(fd.key && (fd.key.name || fd.key.value), fd.value && (fd.value.contextType || fd.value.resultType), false);
        const visit = (n, inStatic) => {
          if (!n || typeof n !== 'object') return;
          if (Array.isArray(n)) { for (const x of n) visit(x, inStatic); return; }
          if ((n.type === 'AssignmentExpression' || n.type === 'UpdateExpression')) {
            const target = n.type === 'AssignmentExpression' ? n.left : n.argument;
            if (target && target.type === 'ThisPropertyAccess' && !target.computed && typeof target.property === 'string' && !inStatic)
              add(target.property, target.resultType || n.resultType, false);
            if (n.declaredType && target && target.type === 'ThisPropertyAccess' && !target.computed && !inStatic) add(target.property, n.declaredType, true);
          }
          if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression') return;
          for (const k in n) if (k !== 'loc' && k !== 'jsDoc' && k !== 'typeInfo' && k !== 'range') visit(n[k], inStatic);
        };
        if (c.ctor) visit(c.ctor.value, false);
        for (const m of c.methods.values()) visit(m.node.value, m.isStatic);
        for (const a of c.accessors.values()) { if (a.get) visit(a.get.value, a.isStatic); if (a.set) visit(a.set.value, a.isStatic); }
        for (const [name, e] of found) {
          if (c.accessors.has(name) || c.methods.has(name)) continue;
          if (this.findMemberAbove(c.base, name)) continue;
          c.fields.set(name, { name, type: this.unifyTypes(e.declared.length ? e.declared : e.seen) });
        }
      }
      // fields assigned from outside the class (instance.x = ... where instance is typed C)
      const external = (n) => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(external); return; }
        if (n.type === 'AssignmentExpression' && n.left && n.left.type === 'MemberExpression' && !n.left.computed) {
          const objT = n.left.object && n.left.object.resultType;
          const prop = n.left.property && (n.left.property.name || n.left.property.value);
          const c = objT && this.classes.get(objT);
          if (c && prop && !c.fields.has(prop) && !c.accessors.has(prop) && !c.methods.has(prop) && !this.findMemberAbove(c.base, prop))
            c.fields.set(prop, { name: prop, type: this.unifyTypes([n.left.resultType || n.right && n.right.resultType]) });
        }
        for (const k in n) if (k !== 'loc' && k !== 'jsDoc' && k !== 'typeInfo') external(n[k]);
      };
      external(this.program && this.program.body);
      // static fields
      for (const c of this.classes.values()) {
        for (const s of c.staticFields.values()) s.type = this.unifyTypes([s.node.value && (s.node.value.contextType || s.node.value.resultType)]);
      }
      // static fields assigned at top level (Class.x = ...)
      for (const node of (this.program && this.program.body) || []) {
        const e = node && node.type === 'ExpressionStatement' ? node.expression : null;
        if (e && e.type === 'AssignmentExpression' && e.left && e.left.type === 'MemberExpression' && !e.left.computed &&
            e.left.object && e.left.object.type === 'Identifier' && this.classes.has(e.left.object.name)) {
          const c = this.classes.get(e.left.object.name);
          const prop = e.left.property.name;
          if (!c.staticFields.has(prop)) c.staticFields.set(prop, { name: prop, node: null, type: this.unifyTypes([e.left.resultType || e.right.resultType]) });
        }
      }
      // accessors overriding a field of a base class make that field virtual there
      for (const c of this.classes.values()) {
        for (const a of c.accessors.values()) {
          for (let b = c.base; b; b = this.baseOf(b)) {
            const bc = this.classes.get(b);
            if (bc && bc.fields.has(a.name)) { bc.virtualAccessors.add(a.name); a.type = a.setType = bc.fields.get(a.name).type; break; }
          }
        }
      }
      // method signatures (overrides take their root's)
      for (const c of this.orderedClasses()) {
        for (const m of c.methods.values()) this.methodSignature(c, m);
        c.ctorSig = this.ctorSignature(c);
      }
    }

    unifyTypes(ils) {
      const types = ils.filter(Boolean).map(t => this.type(t)).filter(t => t.k !== 'null' && t.k !== 'undef' && t.k !== 'void');
      if (!types.length) return T.any;
      let r = types[0];
      for (const t of types.slice(1)) {
        if (sameType(r, t)) continue;
        if (isNum(r) && isNum(t)) { r = this.widerNumber(r, t); continue; }
        if (r.k === 'arr' && t.k === 'arr' && isNum(r.e) && isNum(t.e)) { r = T.arr(this.widerNumber(r.e, t.e)); continue; }
        if (r.k === 'cls' && t.k === 'cls') {
          if (this.isSubclass(t.name, r.name)) continue;
          if (this.isSubclass(r.name, t.name)) { r = t; continue; }
        }
        return T.any;
      }
      return r;
    }

    widerNumber(a, b) {
      if (isFloat(a) || isFloat(b)) return T.f64;
      if (a.bits === 64 || b.bits === 64) return a.signed && b.signed ? T.i64 : (!a.signed && !b.signed ? T.u64 : T.i64);
      if (a.signed !== b.signed) return T.i64;
      return a.bits >= b.bits ? a : b;
    }

    orderedClasses() {
      const out = [];
      const seen = new Set();
      const visit = c => {
        if (seen.has(c.name)) return;
        seen.add(c.name);
        const b = this.classes.get(c.base);
        if (b) visit(b);
        out.push(c);
      };
      for (const c of this.classes.values()) visit(c);
      return out;
    }

    /** A member a class (user or framework) or one of its ancestors declares */
    findMemberAbove(clsName, name) {
      for (let c = clsName; c; c = this.baseOf(c)) {
        const m = this.ownMember(c, name);
        if (m) return m;
      }
      return null;
    }

    findAccessorAbove(clsName, name) {
      const m = this.findMemberAbove(clsName, name);
      return m && m.kind === 'accessor' ? m : null;
    }

    /** A member a class itself declares: { kind, owner, type | sig } */
    ownMember(clsName, name) {
      const u = this.classes.get(clsName);
      if (u) {
        if (u.accessors.has(name)) { const a = u.accessors.get(name); return { kind: 'accessor', owner: clsName, type: a.type || T.any, setType: a.setType || a.type || T.any, hasGet: !!a.get, hasSet: !!a.set, isStatic: a.isStatic }; }
        if (u.fields.has(name)) return { kind: 'field', owner: clsName, type: u.fields.get(name).type, virtual: u.virtualAccessors.has(name) };
        if (u.methods.has(name)) return { kind: 'method', owner: clsName, method: u.methods.get(name), isStatic: u.methods.get(name).isStatic };
        if (u.staticFields.has(name)) return { kind: 'static', owner: clsName, type: u.staticFields.get(name).type };
        return null;
      }
      const f = FRAMEWORK[clsName];
      if (!f) return null;
      if (f.accessors && f.accessors[name]) { const a = f.accessors[name]; return { kind: 'accessor', owner: clsName, type: this.type(a.type), hasGet: !!a.get, hasSet: !!a.set, fw: true }; }
      if (f.fields && f.fields[name]) return { kind: 'field', owner: clsName, type: this.type(f.fields[name]), fw: true };
      if (f.methods && f.methods[name]) return { kind: 'method', owner: clsName, method: { name, fw: true, sig: this.fwSig(f.methods[name]) } };
      return null;
    }

    fwSig(m) {
      return {
        params: m.params.map(([name, type, def]) => ({ name, type: this.type(type), cpp: cppIdent(name), def: null, defText: def !== undefined ? def : null })),
        ret: this.type(m.ret)
      };
    }

    paramType(p) {
      const node = p && p.type === 'AssignmentPattern' ? p.left : p;
      if (!node) return T.any;
      let t = this.type(node.resultType || (node.typeAnnotation && node.typeAnnotation.name) || null);
      if (node.nullable && (isNumOrBool(t) || t.k === 'big')) t = T.any;
      if (t.k === 'void' || t.k === 'null' || t.k === 'undef') t = T.any;
      return t;
    }

    /** Declared or inferred return type of a function node */
    returnTypeOf(fnNode, methodNode) {
      const ti = (fnNode && fnNode.typeInfo) || (methodNode && methodNode.typeInfo);
      if (ti && ti.returns) {
        const t = this.type(ti.returns);
        if (ti.returnsNullable || (ti.returns.isNullable) || (ti.returns.name && /\|\s*null|null\s*\|/.test(ti.returns.name))) { if (isNumOrBool(t) || t.k === 'big') return T.any; }
        return t;
      }
      if (fnNode && fnNode.declaredReturnType) return this.type(fnNode.declaredReturnType);
      if (fnNode && fnNode.returnType) return this.type(fnNode.returnType);
      // from the return statements
      const found = [];
      let bare = false;
      const visit = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration' || n.type === 'ArrowFunction' || n.type === 'ArrowFunctionExpression' || n.type === 'ClassDeclaration') return;
        if (n.type === 'ReturnStatement') {
          if (n.argument) found.push(n.argument.contextType || n.argument.resultType || (n.argument.type === 'Literal' && n.argument.value === null ? 'null' : null) || 'any');
          else bare = true;
        }
        for (const k in n) if (k !== 'loc' && k !== 'jsDoc' && k !== 'typeInfo') visit(n[k]);
      };
      if (fnNode && fnNode.body) {
        if (fnNode.expression && fnNode.body.type !== 'BlockStatement') return this.type(fnNode.body.resultType);
        visit(fnNode.body.body || fnNode.body);
      }
      if (!found.length) return T.void;
      const nonNull = found.filter(t => t !== 'null');
      if (!nonNull.length) return T.any;
      const t = this.unifyTypes(nonNull);
      if ((found.length !== nonNull.length || bare) && (isNumOrBool(t) || t.k === 'big')) return T.any;
      return t;
    }

    /** Parameters of a function node: [{ name, cpp, type, def (IL node), simpleDefault }] */
    paramsOf(fnNode) {
      return ((fnNode && fnNode.params) || []).map((p, i) => {
        let node = p, def = null, rest = false;
        if (p && p.type === 'AssignmentPattern') { node = p.left; def = p.right; }
        if (p && p.defaultValue) def = p.defaultValue;
        if (p && (p.type === 'RestElement' || p.type === 'RestParameter')) { rest = true; node = p.argument || p; }
        const name = (node && (node.name || (typeof node === 'string' ? node : null))) || `p${i}`;
        let type = rest ? T.arr(this.type(node && node.resultType && String(node.resultType).replace(/\[\]$/, ''))) : this.paramType(node);
        return { name, cpp: cppIdent(name), type, def, rest };
      });
    }

    methodSignature(c, m) {
      if (m.sig) return m.sig;
      const own = { params: this.paramsOf(m.node.value), ret: this.returnTypeOf(m.node.value, m.node) };
      if (!m.isStatic) {
        const above = this.findMemberAbove(c.base, m.name);
        if (above && above.kind === 'method' && !above.isStatic) {
          const rootSig = above.method.fw ? above.method.sig : this.methodSignature(this.classes.get(above.owner), above.method);
          if (above.method.fw && own.params.length > rootSig.params.length) {
            // more parameters than the framework method: a method of its own (the extra
            // parameters without defaults, so a call by the framework's arity picks the
            // override), and an override forwarding to it
            const params = own.params.map((p, i) => i < rootSig.params.length ? Object.assign({}, p, { type: rootSig.params[i].type, ownType: p.type, noDefault: true }) : Object.assign({}, p, { noDefault: true }));
            m.sig = { params, ret: rootSig.ret, ownRet: own.ret };
            m.forwarder = rootSig;
            return m.sig;
          }
          m.overrides = true;
          // the root's types; extra parameters of this override keep their own
          const params = own.params.map((p, i) => i < rootSig.params.length ? Object.assign({}, p, { type: rootSig.params[i].type, ownType: p.type }) : p);
          for (let i = own.params.length; i < rootSig.params.length; ++i) params.push(Object.assign({}, rootSig.params[i], { unused: true }));
          m.sig = { params, ret: rootSig.ret, ownRet: own.ret, root: rootSig };
          if (params.length > rootSig.params.length) rootSig.params.push(...params.slice(rootSig.params.length).map(p => Object.assign({}, p, { unused: true })));
          return m.sig;
        }
      }
      m.sig = own;
      return own;
    }

    ctorSignature(c) {
      if (c.ctor) return { params: this.paramsOf(c.ctor.value) };
      // the implicit constructor passes its arguments to the base
      const b = this.classes.get(c.base);
      if (b) return { params: (b.ctorSig || this.ctorSignature(b)).params.map(p => Object.assign({}, p)), implicit: true };
      const f = FRAMEWORK[c.base];
      return { params: ((f && f.ctor) || []).map(([name, type]) => ({ name, cpp: cppIdent(name), type: this.type(type), def: null })), implicit: true };
    }

    // ------------------------------------------------------------ scopes

    pushScope() { this.scopes.push(new Map()); }
    popScope() { this.scopes.pop(); }
    declare(name, type, extra = {}) {
      const scope = this.scopes[this.scopes.length - 1];
      let cpp = cppIdent(name);
      // a name the C++ scope chain already uses for something else gets a fresh spelling
      const taken = n => this.scopes.some(s => [...s.values()].some(v => v.cpp === n && v.name !== name));
      if (taken(cpp)) { let k = 2; while (taken(cpp + '_' + k)) ++k; cpp = cpp + '_' + k; }
      const v = Object.assign({ name, cpp, type }, extra);
      scope.set(name, v);
      return v;
    }
    lookup(name) {
      for (let i = this.scopes.length - 1; i >= 0; --i) if (this.scopes[i].has(name)) return this.scopes[i].get(name);
      return null;
    }

    // ------------------------------------------------------------ program emission

    emitProgram(body, file) {
      const S = file.sections;
      S.push(new CppComment('Transpiled from JavaScript; runs on the js runtime above.'));
      const classes = this.orderedClasses();
      for (const c of classes) S.push(new CppRaw(`struct ${c.cppName};`));
      if (classes.length) S.push(new CppRaw(''));
      // class definitions
      for (const c of classes) S.push(this.classDefinition(c));
      // globals and function prototypes
      this.pushScope();
      for (const g of this.globals.values()) {
        S.push(new CppRaw(`static ${this.cpp(g.type)} ${g.cpp}{};`));
        this.scopes[0].set(g.name, { name: g.name, cpp: g.cpp, type: g.type, global: true });
      }
      const fnDefs = [];
      for (const f of this.functions.values()) {
        f.sig = { params: this.paramsOf(f.node), ret: this.returnTypeOf(f.node, null) };
        S.push(new CppRaw(this.functionPrototype(f.cpp, f.sig, true) + ';'));
      }
      S.push(new CppRaw(''));
      // method bodies
      for (const c of classes) S.push(...this.classBodies(c));
      // functions
      for (const f of this.functions.values()) S.push(this.functionDefinition(f));
      // module initialisation: the top-level statements in order
      const init = [];
      this.fn = { kind: 'init', ret: T.void, cls: null };
      this.pushScope();
      for (const node of body) {
        if (!node) continue;
        if (node.type === 'ClassDeclaration') { init.push(...this.staticInitializers(this.classes.get(node.id.name))); continue; }
        if (node.type === 'FunctionDeclaration') continue;
        if (node.type === 'VariableDeclaration') {
          for (const d of node.declarations || []) {
            if (!d.id || d.id.type !== 'Identifier') {
              // const { RegisterAlgorithm, ... } = AlgorithmFramework: the runtime provides those names
              if (d.init && d.init.type === 'Identifier' && (d.init.name === 'AlgorithmFramework' || d.init.name === 'OpCodes')) continue;
              init.push(...this.destructure(d, node.kind));
              continue;
            }
            if (this.skippedDeclarators.has(d)) continue;
            if (d.init && (d.init.type === 'ClassExpression' || d.init.type === 'ClassDeclaration')) { init.push(...this.staticInitializers(this.classes.get(d.id.name))); continue; }
            const g = this.globals.get(d.id.name);
            if (d.init) init.push(new CppExpressionStatement(`${g.cpp} = ${this.cv(this.expr(d.init, g.type), g.type)}`));
          }
          continue;
        }
        init.push(...this.stmt(node));
      }
      this.popScope();
      this.fn = null;
      S.push(new CppFunction('static void __module_init()', new CppBlock(init)));
      S.push(new CppRaw('static js::ModuleInit __module_init_registration(&__module_init);'));
      this.popScope();
    }

    functionPrototype(name, sig, withDefaults, prefix = 'static ') {
      return `${prefix}${this.cpp(sig.ret)} ${name}(${this.paramList(sig.params, withDefaults)})`;
    }

    paramList(params, withDefaults) {
      let defaulted = false;
      return params.map(p => {
        if (p.rest) return `${this.cpp(p.type)} ${p.cpp} = ${this.cpp(p.type)}::create(0)`;
        const complex = p.def && !this.simpleDefault(p.def);
        const t = complex ? `std::optional<${this.cpp(p.type)}>` : this.cpp(p.type);
        const name = complex ? p.cpp + '__opt' : p.cpp;
        if (!withDefaults || p.noDefault) return `${t} ${name}`;
        let def;
        if (complex) def = 'std::nullopt';
        else if (p.def) def = this.defaultExpr(p.def, p.type);
        else if (p.defText !== undefined && p.defText !== null) def = p.defText;
        else def = this.defaultOf(p.type);
        defaulted = true;
        return `${t} ${name} = ${def}`;
      }).join(', ');
    }

    /** Whether a default value can be a C++ default argument */
    simpleDefault(node) {
      if (!node) return true;
      switch (node.type) {
        case 'Literal': return true;
        case 'UnaryExpression': return this.simpleDefault(node.argument);
        case 'Identifier': return node.name === 'undefined' || this.globals.has(node.name);
        case 'ArrayExpression': case 'ArrayLiteral': return (node.elements || []).every(e => e && this.simpleDefault(e));
        case 'ObjectLiteral': return (node.properties || []).length === 0;
        case 'MemberExpression': return !node.computed && node.object && node.object.type === 'Identifier' && (FW_ENUMS.has(node.object.name) || this.globals.has(node.object.name));
        default: return false;
      }
    }

    defaultExpr(node, type) {
      const saved = this.fn;
      this.fn = saved || { kind: 'init', ret: T.void };
      const e = this.expr(node, type);
      this.fn = saved;
      const text = this.cv(e, type);
      return /JS_LIT\(/.test(text) ? text.replace(/JS_LIT\((u"(?:[^"\\]|\\.)*"(?:\s*u"(?:[^"\\]|\\.)*")*)\)/g, 'js::String($1)') : text;
    }

    /** Statements binding the parameters a C++ signature cannot spell (complex defaults, overrides retyped) */
    paramPrologue(params) {
      const out = [];
      for (const p of params) {
        if (p.rest || p.unused) continue;
        if (p.def && !this.simpleDefault(p.def)) {
          const v = this.lookup(p.name);
          out.push(new CppVariableDeclaration(this.cpp(p.type), v.cpp, `${p.cpp}__opt ? *${p.cpp}__opt : ${this.cv(this.expr(p.def, p.type), p.type)}`));
        }
      }
      return out;
    }

    declareParams(params) {
      for (const p of params) {
        if (p.unused) continue;
        const v = this.declare(p.name, p.ownType && !sameType(p.ownType, p.type) ? p.ownType : p.type);
        v.cpp = p.cpp;
        if (p.ownType && !sameType(p.ownType, p.type)) { v.cpp = p.cpp + '__own'; v.retyped = p; }
      }
    }

    retypePrologue(params) {
      const out = [];
      for (const p of params) {
        if (p.unused || !p.ownType || sameType(p.ownType, p.type)) continue;
        out.push(new CppVariableDeclaration(this.cpp(p.ownType), p.cpp + '__own', this.cv({ c: p.cpp, t: p.type }, p.ownType)));
      }
      return out;
    }

    functionDefinition(f) {
      this.fn = { kind: 'function', ret: f.sig.ret, cls: null };
      this.pushScope();
      this.declareParams(f.sig.params);
      const body = [...this.paramPrologue(f.sig.params), ...this.functionBody(f.node.body)];
      this.popScope();
      this.fn = null;
      return new CppFunction(this.functionPrototype(f.cpp, f.sig, false), new CppBlock(body));
    }

    functionBody(body) {
      if (!body) return [];
      if (body.type !== 'BlockStatement') {
        // expression body
        const e = this.expr(body, this.fn.ret);
        return this.fn.ret.k === 'void' ? [new CppExpressionStatement(e.c)] : [new CppReturn(this.cv(e, this.fn.ret))];
      }
      const stmts = [];
      this.hoistVars(body, stmts);
      for (const s of body.body || []) stmts.push(...this.stmt(s));
      return stmts;
    }

    /** var declarations live in the function scope: declared at its top */
    hoistVars(body, out) {
      const seen = new Set();
      const visit = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if (n.type === 'FunctionExpression' || n.type === 'FunctionDeclaration' || n.type === 'ArrowFunction' || n.type === 'ArrowFunctionExpression' || n.type === 'ClassDeclaration') return;
        if (n.type === 'VariableDeclaration' && n.kind === 'var') {
          for (const d of n.declarations || []) {
            if (!d.id || d.id.type !== 'Identifier' || seen.has(d.id.name)) continue;
            seen.add(d.id.name);
            if (this.lookup(d.id.name) && this.scopes[this.scopes.length - 1].has(d.id.name)) continue; // a parameter
            const t = this.declType(d);
            const v = this.declare(d.id.name, t, { hoisted: true });
            out.push(new CppVariableDeclaration(this.cpp(t), v.cpp, null));
          }
        }
        for (const k in n) if (k !== 'loc' && k !== 'jsDoc' && k !== 'typeInfo') visit(n[k]);
      };
      visit(body.body || body);
    }

    // ------------------------------------------------------------ classes

    classDefinition(c) {
      const base = this.classes.has(c.base) ? this.classes.get(c.base).cppName : `js::${c.base}`;
      const k = new CppClass(c.cppName, `${base}`);
      const M = k.members;
      const self = `${c.cppName}`;
      for (const f of c.fields.values()) M.push(new CppRaw(`${this.cpp(f.type)} ${cppIdent(f.name)}{};`));
      for (const s of c.staticFields.values()) M.push(new CppRaw(`inline static ${this.cpp(s.type)} ${cppIdent(s.name)}{};`));
      M.push(new CppRaw(`static const char16_t* __staticClassName() { return ${u16Literal(c.name)}; }`));
      M.push(new CppRaw(`const char16_t* __className() const override { return ${u16Literal(c.name)}; }`));
      M.push(new CppRaw(`${c.cppName}() {}`));
      M.push(new CppRaw(`explicit ${c.cppName}(js::Object* __from) { js::copyMembers(__from, this); }`));
      M.push(new CppRaw(`${self}* __ctor(${this.paramList(c.ctorSig.params, true)});`));
      for (const name of c.virtualAccessors) {
        const f = c.fields.get(name);
        M.push(new CppRaw(`virtual ${this.cpp(f.type)} __get_${cppIdent(name)}() { return ${cppIdent(name)}; }`));
        M.push(new CppRaw(`virtual void __set_${cppIdent(name)}(${this.cpp(f.type)} v) { ${cppIdent(name)} = v; }`));
      }
      for (const a of c.accessors.values()) {
        const pre = a.isStatic ? 'static ' : 'virtual ';
        const inherited = !a.isStatic && (this.findAccessorAbove(c.base, a.name) || this.findFieldVirtualAbove(c.base, a.name));
        const ov = inherited ? ' override' : '';
        // an accessor needs both halves: a missing one keeps the inherited behaviour (or ignores/undefined)
        M.push(new CppRaw(`${pre}${this.cpp(a.type)} __get_${cppIdent(a.name)}()${ov};`));
        M.push(new CppRaw(`${pre}void __set_${cppIdent(a.name)}(${this.cpp(a.setType)} v)${ov};`));
      }
      for (const m of c.methods.values()) {
        const sig = m.sig;
        const pre = m.isStatic ? 'static ' : 'virtual ';
        M.push(new CppRaw(`${pre}${this.cpp(sig.ret)} ${cppIdent(m.name)}(${this.paramList(sig.params, true)})${m.overrides && !m.isStatic ? ' override' : ''};`));
        if (m.forwarder) {
          const rootParams = m.forwarder.params;
          const extra = sig.params.slice(rootParams.length).map(p => p.def && this.simpleDefault(p.def) ? this.defaultExpr(p.def, p.type) : this.defaultOf(p.type));
          const call = `this->${cppIdent(m.name)}(${rootParams.map(p => p.cpp).concat(extra).join(', ')})`;
          M.push(new CppRaw(`${this.cpp(sig.ret)} ${cppIdent(m.name)}(${this.paramList(rootParams, true)}) override { ${sig.ret.k === 'void' ? call + ';' : 'return ' + call + ';'} }`));
        }
      }
      M.push(...this.reflection(c));
      return k;
    }

    findFieldVirtualAbove(clsName, name) {
      for (let b = clsName; b; b = this.baseOf(b)) {
        const u = this.classes.get(b);
        if (u && u.virtualAccessors.has(name)) return true;
      }
      return false;
    }

    /** The dynamic member protocol of a class */
    reflection(c) {
      const base = this.classes.has(c.base) ? this.classes.get(c.base).cppName : `js::${c.base}`;
      const L = [];
      const get = [], set = [], has = [], keys = [], hasMethod = [], call = [];
      for (const f of c.fields.values()) {
        const n = cppIdent(f.name), key = u16Literal(f.name);
        const viaAccessor = c.virtualAccessors.has(f.name);
        get.push(`if (__k == ${key}) { __out = js::toAny(${viaAccessor ? `this->__get_${n}()` : 'this->' + n}); return true; }`);
        set.push(`if (__k == ${key}) { ${viaAccessor ? `this->__set_${n}(js::fromAny<${this.cpp(f.type)}>(__v))` : `this->${n} = js::fromAny<${this.cpp(f.type)}>(__v)`}; return true; }`);
        has.push(key);
        keys.push(`__out.push_back(js::String(${key}));`);
      }
      for (const a of c.accessors.values()) {
        if (a.isStatic) continue;
        const n = cppIdent(a.name), key = u16Literal(a.name);
        get.push(`if (__k == ${key}) { __out = js::toAny(this->__get_${n}()); return true; }`);
        set.push(`if (__k == ${key}) { this->__set_${n}(js::fromAny<${this.cpp(a.setType)}>(__v)); return true; }`);
        has.push(key);
      }
      for (const m of c.methods.values()) {
        if (m.isStatic) continue;
        const key = u16Literal(m.name);
        has.push(key);
        hasMethod.push(key);
        const args = m.sig.params.filter(p => !p.rest).map((p, i) => {
          const complex = p.def && !this.simpleDefault(p.def);
          const t = complex ? `std::optional<${this.cpp(p.type)}>` : this.cpp(p.type);
          const fallback = complex ? 'std::nullopt' : (p.def ? this.defaultExpr(p.def, p.type) : (p.defText !== undefined && p.defText !== null ? p.defText : this.defaultOf(p.type)));
          return `(__a.size() > ${i} && !__a[${i}].isUndef() ? static_cast<${t}>(js::fromAny<${this.cpp(p.type)}>(__a[${i}])) : static_cast<${t}>(${fallback}))`;
        });
        const invoke = `this->${cppIdent(m.name)}(${args.join(', ')})`;
        call.push(m.sig.ret.k === 'void'
          ? `if (__k == ${key}) { ${invoke}; __out = js::Any(); return true; }`
          : `if (__k == ${key}) { __out = js::toAny(${invoke}); return true; }`);
      }
      const names = list => list.length ? `static const char16_t* names[] = { ${list.join(', ')} };\n  for (auto n : names) if (__k == n) return true;\n  ` : '';
      L.push(new CppRaw(`bool __get(const std::u16string& __k, js::Any& __out) override {${get.length ? '\n  ' + get.join('\n  ') : ''}\n  return ${base}::__get(__k, __out);\n}`));
      L.push(new CppRaw(`bool __set(const std::u16string& __k, const js::Any& __v) override {${set.length ? '\n  ' + set.join('\n  ') : ''}\n  return ${base}::__set(__k, __v);\n}`));
      L.push(new CppRaw(`bool __has(const std::u16string& __k) override {\n  ${names(has)}return ${base}::__has(__k);\n}`));
      L.push(new CppRaw(`bool __hasMethod(const std::u16string& __k) override {\n  ${names(hasMethod)}return ${base}::__hasMethod(__k);\n}`));
      L.push(new CppRaw(`bool __call(const std::u16string& __k, std::vector<js::Any>& __a, js::Any& __out) override {${call.length ? '\n  ' + call.join('\n  ') : ''}\n  return ${base}::__call(__k, __a, __out);\n}`));
      L.push(new CppRaw(`void __keys(std::vector<js::String>& __out) override {\n  ${base}::__keys(__out);${keys.length ? '\n  ' + keys.join('\n  ') : ''}\n}`));
      return L;
    }

    classBodies(c) {
      const out = [];
      const self = c.cppName;
      const thisType = T.cls(c.name, false);
      // constructor
      {
        this.fn = { kind: 'ctor', ret: T.void, cls: c, thisType };
        this.pushScope();
        const sig = c.ctorSig;
        this.declareParams(sig.params);
        const body = [...this.paramPrologue(sig.params)];
        const fieldInits = () => c.fieldInits.map(fd => {
          const name = fd.key && (fd.key.name || fd.key.value);
          const m = this.findMemberAbove(c.name, name);
          const t = m && m.type ? m.type : T.any;
          return new CppExpressionStatement(`this->${cppIdent(name)} = ${fd.value ? this.cv(this.expr(fd.value, t), t) : this.defaultOf(t)}`);
        });
        if (c.ctor) {
          const stmts = (c.ctor.value.body && c.ctor.value.body.body) || [];
          const hasSuper = stmts.some(s => s && s.type === 'ExpressionStatement' && s.expression && s.expression.type === 'ParentConstructorCall');
          this.hoistVars(c.ctor.value.body, body);
          if (!hasSuper) { body.push(new CppExpressionStatement(`${this.baseCpp(c)}::__ctor()`)); body.push(...fieldInits()); }
          for (const s of stmts) {
            body.push(...this.stmt(s));
            if (hasSuper && s && s.type === 'ExpressionStatement' && s.expression && s.expression.type === 'ParentConstructorCall') body.push(...fieldInits());
          }
        } else {
          body.push(new CppExpressionStatement(`${this.baseCpp(c)}::__ctor(${sig.params.map(p => p.cpp).join(', ')})`));
          body.push(...fieldInits());
        }
        body.push(new CppReturn('this'));
        this.popScope();
        out.push(new CppFunction(`${self}* ${self}::__ctor(${this.paramList(sig.params, false)})`, new CppBlock(body)));
      }
      // accessors
      for (const a of c.accessors.values()) {
        const n = cppIdent(a.name);
        const at = a.type;
        this.fn = { kind: 'method', ret: at, cls: c, thisType, isStatic: a.isStatic };
        this.pushScope();
        let getBody;
        if (a.get) getBody = this.functionBody(a.get.value.body);
        else {
          const above = !a.isStatic && (this.findAccessorAbove(c.base, a.name) || this.findFieldVirtualAbove(c.base, a.name));
          getBody = [new CppReturn(above ? `${this.baseCpp(c)}::__get_${n}()` : this.defaultOf(at))];
        }
        this.popScope();
        out.push(new CppFunction(`${this.cpp(at)} ${self}::__get_${n}()`, new CppBlock(getBody)));
        this.fn = { kind: 'method', ret: T.void, cls: c, thisType, isStatic: a.isStatic };
        this.pushScope();
        let setBody;
        if (a.set) {
          const p = this.paramsOf(a.set.value)[0] || { name: 'v', cpp: 'v' };
          const own = p.type && p.type.k !== 'any' ? p.type : a.setType;
          const v = this.declare(p.name, own);
          v.cpp = cppIdent(p.name) + '__v';
          setBody = [new CppVariableDeclaration(this.cpp(own), v.cpp, this.cv({ c: '__value', t: a.setType }, own)), ...this.functionBody(a.set.value.body)];
        } else {
          const above = !a.isStatic && (this.findAccessorAbove(c.base, a.name) || this.findFieldVirtualAbove(c.base, a.name));
          setBody = above ? [new CppExpressionStatement(`${this.baseCpp(c)}::__set_${n}(__value)`)] : [new CppExpressionStatement('(void)__value')];
        }
        this.popScope();
        out.push(new CppFunction(`void ${self}::__set_${n}(${this.cpp(a.setType)} __value)`, new CppBlock(setBody)));
      }
      // methods
      for (const m of c.methods.values()) {
        const sig = m.sig;
        this.fn = { kind: 'method', ret: sig.ownRet && !sameType(sig.ownRet, sig.ret) ? sig.ret : sig.ret, cls: c, thisType, isStatic: m.isStatic };
        this.pushScope();
        this.declareParams(sig.params);
        const body = [...this.retypePrologue(sig.params), ...this.paramPrologue(sig.params), ...this.functionBody(m.node.value.body)];
        this.popScope();
        out.push(new CppFunction(`${this.cpp(sig.ret)} ${self}::${cppIdent(m.name)}(${this.paramList(sig.params, false)})`, new CppBlock(body)));
      }
      this.fn = null;
      return out;
    }

    baseCpp(c) { return this.classes.has(c.base) ? this.classes.get(c.base).cppName : `js::${c.base}`; }

    staticInitializers(c) {
      if (!c) return [];
      const out = [];
      for (const s of c.staticFields.values()) {
        if (!s.node || !s.node.value) continue;
        this.fn = { kind: 'init', ret: T.void, cls: c, thisType: null, isStatic: true };
        out.push(new CppExpressionStatement(`${c.cppName}::${cppIdent(s.name)} = ${this.cv(this.expr(s.node.value, s.type), s.type)}`));
      }
      this.fn = { kind: 'init', ret: T.void, cls: null };
      return out;
    }

    // ------------------------------------------------------------ statements

    stmt(node) {
      if (!node) return [];
      switch (node.type) {
        case 'Line': case 'Block': case 'EmptyStatement': return [];
        case 'ExpressionStatement': return this.exprStatement(node.expression);
        case 'VariableDeclaration': return this.varDecl(node);
        case 'BlockStatement': {
          this.pushScope();
          const out = [];
          for (const s of node.body || []) out.push(...this.stmt(s));
          this.popScope();
          return [new CppBlock(out)];
        }
        case 'ReturnStatement': {
          const ret = this.fn ? this.fn.ret : T.void;
          if (!node.argument) return [new CppReturn(ret.k === 'void' || !this.fn || this.fn.kind === 'ctor' ? null : this.defaultOf(ret))];
          if (this.fn && this.fn.kind === 'ctor') return [new CppExpressionStatement(`(void)(${this.expr(node.argument).c})`), new CppReturn('this')];
          if (ret.k === 'void') {
            const e = this.expr(node.argument);
            return [new CppExpressionStatement(`(void)(${e.c})`), new CppReturn(null)];
          }
          return [new CppReturn(this.cv(this.expr(node.argument, ret), ret))];
        }
        case 'IfStatement': {
          const test = this.cond(node.test);
          return [new CppIf(test, this.blockOf(node.consequent), node.alternate ? this.blockOf(node.alternate) : null)];
        }
        case 'ForStatement': return this.forStmt(node);
        case 'WhileStatement':
          return this.loop(node, label => new CppWhile(this.cond(node.test), this.loopBody(node.body, label)));
        case 'DoWhileStatement':
          return this.loop(node, label => { const body = this.loopBody(node.body, label); return new CppDoWhile(body, this.cond(node.test)); });
        case 'ForOfStatement': return this.forOf(node);
        case 'ForInStatement': return this.forIn(node);
        case 'BreakStatement':
          return [node.label ? new CppGoto(`${cppIdent(node.label.name || node.label)}__break`) : new CppBreak()];
        case 'ContinueStatement':
          return [node.label ? new CppGoto(`${cppIdent(node.label.name || node.label)}__continue`) : new CppContinue()];
        case 'LabeledStatement': {
          const name = cppIdent(node.label.name || node.label);
          const inner = node.body;
          const isLoop = inner && /^(For|ForOf|ForIn|While|DoWhile)Statement$/.test(inner.type);
          if (isLoop) inner.__label = name;
          const out = this.stmt(inner);
          out.push(new CppLabel(`${name}__break`));
          return out;
        }
        case 'ThrowStatement': {
          const e = this.expr(node.argument);
          return [new CppThrow(`js::Throw{${this.cv(e, T.any)}}`)];
        }
        case 'TryStatement': return this.tryStmt(node);
        case 'SwitchStatement': return this.switchStmt(node);
        case 'FunctionDeclaration': return this.localFunction(node);
        case 'ClassDeclaration':
          return [new CppExpressionStatement('js::unsupported(u"local class declaration")')];
        default: {
          if (node.type && /Expression$|^ThisMethodCall$|^ParentConstructorCall$|^ParentMethodCall$|^Array|^OpCodesCall$|^DebugOutput$/.test(node.type)) return this.exprStatement(node);
          return [new CppExpressionStatement(`js::unsupported(${u16Literal('statement ' + node.type)})`)];
        }
      }
    }

    blockOf(node) {
      this.pushScope();
      const out = node && node.type === 'BlockStatement' ? (node.body || []).flatMap(s => this.stmt(s)) : this.stmt(node);
      this.popScope();
      return new CppBlock(out);
    }

    loop(node, build) {
      const label = node.__label || null;
      const l = build(label);
      const out = [l];
      return out;
    }

    loopBody(body, label) {
      const block = this.blockOf(body);
      if (label) block.statements.push(new CppLabel(`${label}__continue`));
      return block;
    }

    cond(node) {
      const e = this.expr(node, T.bool);
      return e.t.k === 'bool' ? e.c : `js::truthy(${e.c})`;
    }

    forStmt(node) {
      this.pushScope();
      const out = [];
      let init = null;
      if (node.init) {
        if (node.init.type === 'VariableDeclaration') {
          const decls = this.varDecl(node.init);
          if (decls.length === 1 && decls[0].nodeType === 'VariableDeclaration') init = decls[0];
          else out.push(...decls);
        } else {
          init = new CppExpressionStatement(this.expr(node.init, T.void).c);
        }
      }
      const test = node.test ? this.cond(node.test) : null;
      const update = node.update ? this.expr(node.update, T.void).c : null;
      const body = this.loopBody(node.body, node.__label || null);
      this.popScope();
      out.push(new CppFor(init, test, update, body));
      return out.length > 1 ? [new CppBlock(out)] : out;
    }

    forOf(node) {
      this.pushScope();
      const right = this.expr(node.right);
      const coll = this.tmp('of');
      const idx = this.tmp('i');
      let elemT = right.t.k === 'arr' ? right.t.e : right.t.k === 'str' ? T.str : T.any;
      const out = [new CppVariableDeclaration('auto', coll, right.c)];
      const decl = node.left && node.left.type === 'VariableDeclaration' ? node.left.declarations[0] : null;
      const bodyStmts = [];
      let getter;
      if (right.t.k === 'arr') getter = `${coll}.get(${idx})`;
      else if (right.t.k === 'str') getter = `${coll}.charAt(${idx})`;
      else getter = `${coll}.index(js::Any(${idx}))`;
      const lengthOf = right.t.k === 'any' ? `${coll}.length()` : `${coll}.length()`;
      if (decl && decl.id && decl.id.type === 'Identifier') {
        const t = decl.id.resultType || decl.resultType ? this.declType(decl) : elemT;
        const v = this.declare(decl.id.name, t);
        bodyStmts.push(new CppVariableDeclaration(this.cpp(t), v.cpp, this.cv({ c: getter, t: elemT }, t)));
      } else if (decl && decl.id) {
        const tmpName = this.tmp('e');
        bodyStmts.push(new CppVariableDeclaration(this.cpp(elemT), tmpName, getter));
        bodyStmts.push(...this.destructurePattern(decl.id, { c: tmpName, t: elemT }, true));
      } else if (node.left && node.left.type === 'Identifier') {
        const target = this.expr(node.left);
        bodyStmts.push(new CppExpressionStatement(`${target.c} = ${this.cv({ c: getter, t: elemT }, target.t)}`));
      }
      const body = this.loopBody(node.body, node.__label || null);
      body.statements.unshift(...bodyStmts);
      this.popScope();
      out.push(new CppFor(new CppVariableDeclaration('int32_t', idx, '0'), `${idx} < ${lengthOf}`, `++${idx}`, body));
      return [new CppBlock(out)];
    }

    forIn(node) {
      this.pushScope();
      const right = this.expr(node.right);
      const keys = this.tmp('keys');
      const idx = this.tmp('i');
      const out = [new CppVariableDeclaration('js::Array<js::String>', keys, `js::keysOf(${this.cv(right, T.any)})`)];
      const decl = node.left && node.left.type === 'VariableDeclaration' ? node.left.declarations[0] : null;
      const bodyStmts = [];
      if (decl) {
        const v = this.declare(decl.id.name, T.str);
        bodyStmts.push(new CppVariableDeclaration('js::String', v.cpp, `${keys}.get(${idx})`));
      }
      const body = this.loopBody(node.body, node.__label || null);
      body.statements.unshift(...bodyStmts);
      this.popScope();
      out.push(new CppFor(new CppVariableDeclaration('int32_t', idx, '0'), `${idx} < ${keys}.length()`, `++${idx}`, body));
      return [new CppBlock(out)];
    }

    tryStmt(node) {
      const out = [];
      const block = this.blockOf(node.block);
      let tryNode;
      if (node.handler) {
        this.pushScope();
        let decl = null;
        const param = node.handler.param;
        if (param && param.type === 'Identifier') {
          const v = this.declare(param.name, T.any);
          decl = `js::Any ${v.cpp} = js::caught(); (void)${v.cpp};`;
        }
        const handler = this.blockOf(node.handler.body);
        this.popScope();
        tryNode = new CppTry(block, decl, handler);
      } else {
        tryNode = new CppTry(block, null, null);
      }
      if (node.finalizer) {
        const fin = this.blockOf(node.finalizer);
        const fname = this.tmp('finally');
        const lambda = new CppFunction(`auto ${fname} = [&]()`, fin);
        // run the finalizer on normal exit and on a throw (rethrown after)
        out.push(new CppRaw(`js::Finally ${fname}__guard([&]() {`));
        out.push(new CppBlock(fin.statements));
        out.push(new CppRaw('});'));
        void lambda;
      }
      out.push(tryNode);
      return node.finalizer ? [new CppBlock(out)] : out;
    }

    switchStmt(node) {
      const disc = this.expr(node.discriminant);
      const sel = this.tmp('sw');
      const caseVar = this.tmp('case');
      const out = [new CppVariableDeclaration(this.cpp(disc.t), sel, disc.c), new CppVariableDeclaration('int', caseVar, '-1')];
      const cases = node.cases || [];
      let chain = null, last = null;
      let defaultIndex = -1;
      cases.forEach((c, i) => {
        if (!c.test) { defaultIndex = i; return; }
        const t = this.expr(c.test);
        const cmp = this.equality('===', { c: sel, t: disc.t }, t);
        const assign = new CppBlock([new CppExpressionStatement(`${caseVar} = ${i}`)]);
        const ifNode = new CppIf(cmp, assign, null);
        if (!chain) chain = ifNode; else last.alternate = ifNode;
        last = ifNode;
      });
      if (defaultIndex >= 0) {
        const d = new CppBlock([new CppExpressionStatement(`${caseVar} = ${defaultIndex}`)]);
        if (!chain) out.push(...d.statements); else last.alternate = d;
      }
      if (chain) out.push(chain);
      const sw = new CppSwitch(caseVar);
      this.pushScope();
      cases.forEach((c, i) => {
        const body = [];
        for (const s of c.consequent || []) body.push(...this.stmt(s));
        sw.cases.push({ labels: [String(i)], body });
      });
      this.popScope();
      out.push(sw);
      return [new CppBlock(out)];
    }

    localFunction(node) {
      const name = node.id.name;
      const sig = { params: this.paramsOf(node), ret: this.returnTypeOf(node, null) };
      const t = T.sfn(sig.params.map(p => p.type), sig.ret);
      const v = this.declare(name, t, { sig });
      const lambda = this.lambdaText(node, sig, '&');
      return [new CppVariableDeclaration(this.cpp(t), v.cpp, null), new CppExpressionStatement(`${v.cpp} = ${lambda}`)];
    }

    /** A typed C++ lambda for a function node with a signature */
    lambdaText(node, sig, capture) {
      const savedFn = this.fn;
      this.fn = { kind: 'lambda', ret: sig.ret, cls: savedFn ? savedFn.cls : null, thisType: savedFn ? savedFn.thisType : null, isStatic: savedFn && savedFn.isStatic };
      this.pushScope();
      for (const p of sig.params) { const v = this.declare(p.name, p.type); v.cpp = p.cpp; }
      const body = [...this.functionBody(node.body)];
      this.popScope();
      this.fn = savedFn;
      const params = sig.params.map(p => `${this.cpp(p.type)} ${p.cpp}`).join(', ');
      const cap = capture === '&' ? '&' : (this.fn && this.fn.thisType && !this.fn.isStatic ? '=, this' : '=');
      return `[${cap}](${params}) mutable -> ${this.cpp(sig.ret)} ${this.inlineBlock(body)}`;
    }

    /** Statements as one-line C++ (for lambdas inside expressions) */
    inlineBlock(stmts) {
      const { CppEmitter } = typeof require !== 'undefined' ? require('./CppEmitter.js') : { CppEmitter: global.CppEmitter };
      const e = new CppEmitter({ indent: '  ' });
      const out = [];
      e.emitNode(new CppBlock(stmts), 0, out);
      return out.join('\n');
    }

    varDecl(node) {
      const out = [];
      for (const d of node.declarations || []) {
        if (!d.id) continue;
        if (d.id.type !== 'Identifier') { out.push(...this.destructure(d, node.kind)); continue; }
        if (d.init && (d.init.type === 'ArrowFunction' || d.init.type === 'ArrowFunctionExpression' || d.init.type === 'FunctionExpression') && this.functionNodeTyped(d.init)) {
          // a function bound to a local: a typed std::function
          const sig = { params: this.paramsOf(d.init), ret: this.returnTypeOf(d.init, null) };
          const t = T.sfn(sig.params.map(p => p.type), sig.ret);
          const existing = node.kind === 'var' ? this.lookup(d.id.name) : null;
          const v = existing && existing.hoisted ? existing : this.declare(d.id.name, t, { sig });
          if (existing && existing.hoisted) { v.type = t; v.sig = sig; }
          if (!(existing && existing.hoisted)) out.push(new CppVariableDeclaration(this.cpp(t), v.cpp, null));
          out.push(new CppExpressionStatement(`${v.cpp} = ${this.lambdaText(d.init, sig, '&')}`));
          continue;
        }
        if (node.kind === 'var') {
          const v = this.lookup(d.id.name);
          if (v && v.hoisted) {
            if (d.init) out.push(new CppExpressionStatement(`${v.cpp} = ${this.cv(this.expr(d.init, v.type), v.type)}`));
            continue;
          }
        }
        const t = this.declType(d);
        const init = d.init ? this.cv(this.expr(d.init, t), t) : null;
        const v = this.declare(d.id.name, t);
        out.push(new CppVariableDeclaration(this.cpp(t), v.cpp, init));
      }
      return out;
    }

    /** Whether every parameter of a function node is typed (else it takes the dynamic convention) */
    functionNodeTyped(fn) {
      return (fn.params || []).every(p => { const n = p && p.type === 'AssignmentPattern' ? p.left : p; return n && n.resultType; });
    }

    destructure(d, kind) {
      const init = d.init ? this.expr(d.init) : { c: 'js::Any()', t: T.any };
      const tmpName = this.tmp('d');
      return [new CppVariableDeclaration(this.cpp(init.t), tmpName, init.c), ...this.destructurePattern(d.id, { c: tmpName, t: init.t }, true)];
    }

    destructurePattern(pattern, source, declare) {
      const out = [];
      const bind = (target, value) => {
        if (!target) return;
        if (target.type === 'AssignmentPattern') {
          const t = this.type(target.left.resultType);
          const tmpName = this.tmp('dv');
          out.push(new CppVariableDeclaration(this.cpp(value.t), tmpName, value.c));
          const fallback = this.cv(this.expr(target.right, t), t);
          const chosen = value.t.k === 'any' ? `(${tmpName}.isUndef() ? ${fallback} : ${this.cv({ c: tmpName, t: value.t }, t)})` : this.cv({ c: tmpName, t: value.t }, t);
          bind(target.left, { c: chosen, t });
          return;
        }
        if (target.type === 'Identifier') {
          if (declare) {
            const t = target.resultType ? this.type(target.resultType) : value.t;
            const v = this.declare(target.name, t);
            out.push(new CppVariableDeclaration(this.cpp(t), v.cpp, this.cv(value, t)));
          } else {
            const tgt = this.expr(target);
            out.push(new CppExpressionStatement(`${tgt.c} = ${this.cv(value, tgt.t)}`));
          }
          return;
        }
        if (target.type === 'ArrayPattern') {
          const tmpName = this.tmp('da');
          out.push(new CppVariableDeclaration(this.cpp(value.t), tmpName, value.c));
          (target.elements || []).forEach((el, i) => {
            if (!el) return;
            const elem = value.t.k === 'arr' ? { c: `${tmpName}.get(${i})`, t: value.t.e } : { c: `js::Any(${tmpName}).index(js::Any(${i}))`, t: T.any };
            bind(el, elem);
          });
          return;
        }
        if (target.type === 'ObjectPattern') {
          const tmpName = this.tmp('do');
          out.push(new CppVariableDeclaration(this.cpp(value.t), tmpName, value.c));
          for (const p of target.properties || []) {
            const key = propKeyName(p.key);
            const member = this.memberRead({ c: tmpName, t: value.t }, key);
            bind(p.value || p.key, member);
          }
          return;
        }
      };
      bind(pattern, source);
      return out;
    }

    exprStatement(node) {
      if (!node) return [];
      const e = this.expr(node, T.void, true);
      if (!e.c) return [];
      return [new CppExpressionStatement(e.t.k === 'void' || /=/.test(e.c) ? e.c : `(void)(${e.c})`)];
    }

    // ------------------------------------------------------------ expressions

    /**
     * Translate an expression. `want` is the type the context will convert it
     * to (a hint for literals and for nodes that can build that type
     * directly); the result's .t is the C++ type of .c.
     */
    expr(node, want = null, asStatement = false) {
      if (!node) return { c: 'js::Any()', t: T.undef };
      const r = this.exprInner(node, want, asStatement);
      if (!r || r.c === undefined) return { c: `js::unsupported(${u16Literal('expression ' + node.type)})`, t: T.any };
      // differential tracing: the value of a traced site of the source
      if (this.traceSites && node.range && this.traceSites.has(node.range[0] + ':' + node.range[1]) && !['void', 'sfn', 'null', 'undef'].includes(r.t.k))
        return Object.assign({}, r, { c: `js::trace(${node.range[0]}, ${r.c})`, lvalue: false, accessor: null, array: null });
      return r;
    }

    /** The IL type a node is converted to in its context, else its own */
    ilType(node) { return this.type(node && (node.contextType || node.resultType)); }

    exprInner(node, want, asStatement) {
      switch (node.type) {
        case 'Literal': return this.literal(node, want);
        case 'Identifier': return this.identifier(node);
        case 'ThisExpression': return this.thisExpr();
        case 'ThisPropertyAccess': return node.computed ? this.indexRead(this.thisExpr(), node.property, node) : this.memberRead(this.thisExpr(), node.property, node);
        case 'MemberExpression': return this.member(node);
        case 'BinaryExpression': return this.binary(node);
        case 'LogicalExpression': return this.logical(node, want);
        case 'UnaryExpression': return this.unary(node);
        case 'UpdateExpression': return this.update(node, asStatement);
        case 'AssignmentExpression': return this.assign(node, asStatement);
        case 'ConditionalExpression': return this.conditional(node, want);
        case 'SequenceExpression': {
          const parts = (node.expressions || []).map((e, i, all) => this.expr(e, i === all.length - 1 ? want : T.void, i < all.length - 1));
          const last = parts[parts.length - 1];
          return { c: `(${parts.slice(0, -1).map(p => `(void)(${p.c})`).concat([last.c]).join(', ')})`, t: last.t };
        }
        case 'CallExpression': return this.call(node);
        case 'ThisMethodCall': return this.methodCall(this.thisExpr(), node.method, node.arguments || [], node);
        case 'ParentMethodCall': return this.parentMethodCall(node);
        case 'ParentConstructorCall': return this.parentCtor(node);
        case 'NewExpression': return this.newExpr(node, want);
        case 'ArrayExpression': case 'ArrayLiteral': return this.arrayLiteral(node, want);
        case 'ObjectLiteral': case 'ObjectExpression': return this.objectLiteral(node, want);
        case 'ArrowFunction': case 'ArrowFunctionExpression': case 'FunctionExpression': return this.functionValue(node, want);
        case 'TemplateLiteral': return this.template(node);
        case 'StringInterpolation': return this.interpolation(node);
        case 'SpreadElement': return this.expr(node.argument, want);
        case 'TypeOfExpression': return this.typeOf(node);
        case 'DeleteExpression': return this.deleteExpr(node);
        default: return this.ilNode(node, want);
      }
    }

    thisExpr() {
      if (!this.fn || !this.fn.thisType || this.fn.isStatic) return { c: 'js::Any()', t: T.undef };
      return { c: 'this', t: this.fn.thisType };
    }

    literal(node, want) {
      const v = node.value;
      if (node.regex) return { c: `js::Any(js::newRegExp(${u16Literal(node.regex.pattern)}, ${u16Literal(node.regex.flags || '')}))`, t: T.any };
      if (v === null && node.bigint === undefined) return { c: 'nullptr', t: T.null };
      if (typeof v === 'boolean') return { c: v ? 'true' : 'false', t: T.bool };
      if (typeof v === 'string') return { c: lit(v), t: T.str };
      if (typeof v === 'bigint' || node.bigint !== undefined) {
        const text = typeof v === 'bigint' ? v.toString() : String(node.bigint).replace(/n$/, '');
        const big = BigInt(text.startsWith('0x') || text.startsWith('0b') || text.startsWith('0o') ? text : text);
        const rt = this.type(node.resultType);
        if (isInt(rt) && rt.bits === 64 && big >= 0n && big <= 0xFFFFFFFFFFFFFFFFn && !(want && want.k === 'big')) return { c: `${big.toString()}ULL`, t: T.u64 };
        if (big >= -(2n ** 62n) && big < 2n ** 62n) return { c: `js::BigInt(${big.toString()}LL)`, t: T.big };
        return { c: `js::BigInt::fromString("${big.toString()}")`, t: T.big };
      }
      if (typeof v === 'number') return this.numberLiteral(v, this.type(node.resultType), want);
      return { c: 'js::Any()', t: T.undef };
    }

    numberLiteral(v, rt, want) {
      if (!Number.isFinite(v)) return { c: Number.isNaN(v) ? 'NAN' : (v > 0 ? 'INFINITY' : '-INFINITY'), t: T.f64 };
      const integral = Number.isInteger(v) && !Object.is(v, -0);
      if (!integral || isFloat(rt) || (want && isFloat(want) && !isInt(rt))) {
        let s = String(v);
        if (!/[.eE]/.test(s)) s += '.0';
        return { c: s, t: T.f64 };
      }
      let t = isInt(rt) ? rt : null;
      if (t && (v < (t.signed ? -(2 ** (t.bits - 1)) : 0) || v > (t.signed ? 2 ** (t.bits - 1) - 1 : 2 ** t.bits - 1))) t = null;
      if (!t || t.bits < 32) {
        if (v >= -2147483648 && v <= 2147483647) t = T.i32;
        else if (v >= 0 && v <= 4294967295) t = T.u32;
        else if (Math.abs(v) <= Number.MAX_SAFE_INTEGER) t = T.i64;
        else return { c: v.toExponential().replace('e+', 'e'), t: T.f64 };
      }
      if (t.bits === 64 && Math.abs(v) > Number.MAX_SAFE_INTEGER) return { c: `${BigInt(v).toString()}${t.signed ? 'LL' : 'ULL'}`, t };
      const suffix = t.bits === 64 ? (t.signed ? 'LL' : 'ULL') : (t.signed ? '' : 'u');
      if (t.signed && t.bits === 32 && v === -2147483648) return { c: '(-2147483647 - 1)', t };
      return { c: `${v}${suffix}`, t };
    }

    identifier(node) {
      const name = node.name;
      const v = this.lookup(name);
      if (v) {
        // a top-level name, qualified: a member of the same name would hide it in a method
        if (v.global) return { c: `${this.ns}::${v.cpp}`, t: v.type };
        return { c: v.cpp, t: v.type };
      }
      switch (name) {
        case 'undefined': return { c: 'js::Any()', t: T.undef };
        case 'NaN': return { c: 'NAN', t: T.f64 };
        case 'Infinity': return { c: 'INFINITY', t: T.f64 };
      }
      if (this.functions.has(name)) {
        const f = this.functions.get(name);
        if (!f.sig) f.sig = { params: this.paramsOf(f.node), ret: this.returnTypeOf(f.node, null) };
        return { c: `${this.ns}::${f.cpp}`, t: T.sfn(f.sig.params.map(p => p.type), f.sig.ret), fnRef: f };
      }
      if (this.classes.has(name)) return { c: `js::Any()`, t: T.any, classRef: name };
      if (FW_FUNCTIONS[name]) return { c: 'js::Any()', t: T.any, fwFunction: name };
      if (FRAMEWORK[name] || FW_ENUMS.has(name) || GLOBAL_OBJECTS.has(name)) return { c: 'js::Any()', t: T.any, globalRef: name };
      return { c: 'js::Any()', t: T.undef, unknown: name };
    }

    // ---------------- member access

    member(node) {
      const obj = node.object;
      if (node.computed) return this.indexRead(this.expr(obj), node.property, node);
      const prop = node.property && (node.property.name || node.property.value);
      // static and global names
      if (obj && obj.type === 'Identifier' && !this.lookup(obj.name)) {
        const special = this.staticMember(obj.name, prop, node);
        if (special) return special;
      }
      return this.memberRead(this.expr(obj), prop, node);
    }

    staticMember(objName, prop, node) {
      if (FW_ENUMS.has(objName)) return { c: `js::enumValue(${u16Literal(objName)}, ${u16Literal(prop)})`, t: T.any };
      if (this.classes.has(objName)) {
        const c = this.classes.get(objName);
        for (let k = c; k; k = this.classes.get(k.base)) {
          if (k.staticFields.has(prop)) return { c: `${k.cppName}::${cppIdent(prop)}`, t: k.staticFields.get(prop).type, lvalue: true };
          if (k.accessors.has(prop) && k.accessors.get(prop).isStatic) return { c: `${k.cppName}::__get_${cppIdent(prop)}()`, t: k.accessors.get(prop).type, staticAccessor: { cls: k, name: prop } };
          if (k.methods.has(prop) && k.methods.get(prop).isStatic) {
            const m = k.methods.get(prop);
            return { c: `${k.cppName}::${cppIdent(prop)}`, t: T.sfn(m.sig.params.map(p => p.type), m.sig.ret) };
          }
        }
        if (prop === 'name') return { c: lit(objName), t: T.str };
        return null;
      }
      if (objName === 'Math') {
        const consts = { PI: 'M_PI', E: 'M_E', LN2: 'M_LN2', LN10: 'M_LN10', LOG2E: 'M_LOG2E', LOG10E: 'M_LOG10E', SQRT2: 'M_SQRT2', SQRT1_2: 'M_SQRT1_2' };
        const vals = { PI: Math.PI, E: Math.E, LN2: Math.LN2, LN10: Math.LN10, LOG2E: Math.LOG2E, LOG10E: Math.LOG10E, SQRT2: Math.SQRT2, SQRT1_2: Math.SQRT1_2 };
        if (consts[prop]) return { c: `(${vals[prop].toPrecision(17)})`, t: T.f64 };
      }
      if (objName === 'Number') {
        const vals = { MAX_SAFE_INTEGER: '9007199254740991.0', MIN_SAFE_INTEGER: '(-9007199254740991.0)', EPSILON: '2.220446049250313e-16', MAX_VALUE: '1.7976931348623157e308', MIN_VALUE: '5e-324', POSITIVE_INFINITY: 'INFINITY', NEGATIVE_INFINITY: '(-INFINITY)', NaN: 'NAN' };
        if (vals[prop]) return { c: vals[prop], t: T.f64 };
      }
      if (objName === 'AlgorithmFramework') {
        if (prop === 'Algorithms') return { c: 'js::Algorithms()', t: T.arr(T.cls('Algorithm', true)) };
        if (FW_ENUMS.has(prop)) return { c: 'js::Any()', t: T.any };
      }
      return null;
    }

    /** obj.prop for a translated object */
    memberRead(o, prop, node) {
      const want = node ? this.type(node.resultType) : T.any;
      if (prop === 'length' && (o.t.k === 'arr' || o.t.k === 'str')) return { c: `${o.c}.length()`, t: T.i32 };
      if (o.t.k === 'cls') {
        const m = this.findMemberAbove(o.t.name, prop);
        if (m) {
          if (m.kind === 'field') {
            if (m.virtual) return { c: `${o.c}->__get_${cppIdent(prop)}()`, t: m.type, accessor: { o, prop, type: m.type, setType: m.type } };
            return { c: `${o.c}->${cppIdent(prop)}`, t: m.type, lvalue: true };
          }
          if (m.kind === 'accessor') return { c: `${o.c}->__get_${cppIdent(prop)}()`, t: m.type, accessor: { o, prop, type: m.type, setType: m.setType || m.type } };
          if (m.kind === 'static') return { c: `${this.classes.get(m.owner).cppName}::${cppIdent(prop)}`, t: m.type, lvalue: true };
          if (m.kind === 'method') return { c: `js::Any(${o.c}).get(${lit(prop)})`, t: T.any };
        }
      }
      if (o.t.k === 'str' && prop === 'length') return { c: `${o.c}.length()`, t: T.i32 };
      if (o.t.k === 'map' && prop === 'size') return { c: `${o.c}->size()`, t: T.i32 };
      if (o.t.k === 'set' && prop === 'size') return { c: `${o.c}->size()`, t: T.i32 };
      if (o.t.k === 'cls' && o.t.name === 'Error' && (prop === 'message' || prop === 'name')) return { c: `${o.c}->${prop}`, t: T.str, lvalue: true };
      if (o.t.k === 'sfn' && prop === 'name') return { c: lit(o.c), t: T.str };
      // dynamic
      return { c: `${this.cv(o, T.any)}.get(${lit(String(prop))})`, t: T.any, dynamic: { o, key: { c: lit(String(prop)), t: T.str } }, wantType: want };
    }

    /** obj[index] for a translated object */
    indexRead(o, indexNode, node) {
      const idx = typeof indexNode === 'string' ? { c: lit(indexNode), t: T.str } : this.expr(indexNode, T.i32);
      if (o.t.k === 'arr' && isNumOrBool(idx.t)) {
        const i = isInt(idx.t) ? idx.c : `js::d2i64(${idx.c})`;
        return { c: `${o.c}.get(${i})`, t: o.t.e, array: { o, i } };
      }
      if (o.t.k === 'str' && isNumOrBool(idx.t)) return { c: `${o.c}.at(${isInt(idx.t) ? idx.c : `js::d2i64(${idx.c})`})`, t: T.str };
      if (o.t.k === 'cls' && idx.t.k === 'str' && indexNode && indexNode.type === 'Literal') return this.memberRead(o, indexNode.value, node);
      if (o.t.k === 'map') return { c: `${o.c}->get(${this.cv(idx, T.any)})`, t: T.any };
      return { c: `${this.cv(o, T.any)}.index(${this.cv(idx, T.any)})`, t: T.any, dynamicIndex: { o, idx } };
    }

    // ---------------- assignment

    /** An assignable place: { get, set(valueText) -> text, t } */
    place(node) {
      // array.length = n
      if (node.type === 'ArrayLength' || (node.type === 'MemberExpression' && !node.computed && node.property && node.property.name === 'length')) {
        const a = this.expr(node.type === 'ArrayLength' ? node.array : node.object);
        if (a.t.k === 'arr') return { get: { c: `${a.c}.length()`, t: T.i32 }, set: v => `${a.c}.setLength(${v})`, t: T.i32, simple: false };
      }
      if (node.type === 'Identifier') {
        const e = this.identifier(node);
        if (e.unknown || e.globalRef) {
          // an undeclared global: give it a dynamic slot
          return { get: { c: 'js::Any()', t: T.any }, set: v => `(void)(${v})`, t: T.any, simple: true };
        }
        return { get: e, set: v => `${e.c} = ${v}`, t: e.t, simple: true, ref: e.c };
      }
      if (node.type === 'ThisPropertyAccess' || (node.type === 'MemberExpression')) {
        const computed = node.computed;
        let o;
        if (node.type === 'ThisPropertyAccess') o = this.thisExpr();
        else {
          const objNode = node.object;
          if (!computed && objNode && objNode.type === 'Identifier' && !this.lookup(objNode.name)) {
            const prop = node.property && (node.property.name || node.property.value);
            const st = this.staticMember(objNode.name, prop, node);
            if (st && st.lvalue) return { get: st, set: v => `${st.c} = ${v}`, t: st.t, simple: true, ref: st.c };
            if (st && st.staticAccessor) return { get: st, set: v => `${st.staticAccessor.cls.cppName}::__set_${cppIdent(prop)}(${v})`, t: st.t, simple: false };
          }
          o = this.expr(objNode);
        }
        if (computed) {
          const r = this.indexRead(o, node.type === 'ThisPropertyAccess' ? node.property : node.property, node);
          if (r.array) {
            const ref = `${r.array.o.c}.at(${r.array.i})`;
            return { get: r, set: v => `${ref} = ${v}`, t: o.t.e, simple: /^[\w.>-]+\.at\([\w]+\)$/.test(ref), ref };
          }
          if (r.dynamicIndex) {
            const oa = this.cv(o, T.any), ia = this.cv(r.dynamicIndex.idx, T.any);
            return { get: r, set: v => `${oa}.setIndex(${ia}, ${v})`, t: T.any, simple: false, dynamicSet: true };
          }
          if (o.t.k === 'map') return { get: r, set: v => `${o.c}->set(${this.cv(this.expr(node.property), T.any)}, ${v})`, t: T.any };
          if (r.lvalue) return { get: r, set: v => `${r.c} = ${v}`, t: r.t, simple: true, ref: r.c };
          if (r.accessor) return { get: r, set: v => `${r.accessor.o.c}->__set_${cppIdent(r.accessor.prop)}(${v})`, t: r.accessor.setType || r.t, simple: false, accessorSet: true };
          return { get: r, set: v => `(void)(${v})`, t: r.t };
        }
        const prop = typeof node.property === 'string' ? node.property : (node.property && (node.property.name || node.property.value));
        const r = this.memberRead(o, prop, node);
        if (r.lvalue) return { get: r, set: v => `${r.c} = ${v}`, t: r.t, simple: /^(this->|[\w]+->)?[\w]+$/.test(r.c), ref: r.c };
        if (r.accessor) return { get: r, set: v => `${r.accessor.o.c}->__set_${cppIdent(prop)}(${v})`, t: r.accessor.setType || r.t, simple: false, accessorSet: true };
        const oa = this.cv(o, T.any);
        return { get: r, set: v => `${oa}.set(${lit(String(prop))}, ${v})`, t: T.any, simple: false, dynamicSet: true };
      }
      const e = this.expr(node);
      return { get: e, set: v => `(void)(${v})`, t: e.t };
    }

    assign(node, asStatement) {
      const op = node.operator;
      const p = this.place(node.left);
      const target = p.t;
      if (op === '=') {
        const value = this.expr(node.right, target);
        const v = this.cv(value, target);
        if (asStatement || p.simple) return { c: p.set(v), t: asStatement ? T.void : target };
        // the assignment's value is used: keep it in a temporary
        const tmpName = this.tmp('v');
        return { c: `({ ${this.cpp(target)} ${tmpName} = ${v}; ${p.set(tmpName)}; ${tmpName}; })`, t: target };
      }
      if (op === '&&=' || op === '||=' || op === '??=') {
        const cur = p.get;
        const value = this.cv(this.expr(node.right, target), target);
        const test = op === '&&=' ? `js::truthy(${cur.c})` : op === '||=' ? `!js::truthy(${cur.c})` : `!js::truthyRef(${cur.c})`;
        return { c: `(${test} ? (${p.set(value)}, 0) : 0)`, t: T.void };
      }
      const bop = op.slice(0, -1);
      // compound: read, combine with JavaScript semantics, convert, store
      if (p.simple || p.ref && !/\(/.test(p.ref.replace(/\.at\(\w+\)$/, ''))) {
        const combined = this.binaryValues(bop, p.get, this.expr(node.right), node, target);
        const v = this.cv(combined, target);
        return { c: p.set(v), t: asStatement ? T.void : target };
      }
      if (p.ref) {
        const r = this.tmp('r');
        const combined = this.binaryValues(bop, { c: r, t: target }, this.expr(node.right), node, target);
        return { c: `({ auto& ${r} = ${p.ref}; ${r} = ${this.cv(combined, target)}; })`, t: target };
      }
      const tmpName = this.tmp('c');
      const combined = this.binaryValues(bop, { c: tmpName, t: p.get.t }, this.expr(node.right), node, target);
      return { c: `({ ${this.cpp(p.get.t)} ${tmpName} = ${p.get.c}; ${p.set(this.cv(combined, target))}; })`, t: T.void };
    }

    update(node, asStatement) {
      const p = this.place(node.argument);
      const t = p.t;
      const op = node.operator === '++' ? '+' : '-';
      if ((isNum(t)) && (p.simple || p.ref)) {
        const ref = p.ref || p.get.c;
        return { c: node.prefix ? `${node.operator}${ref}` : `${ref}${node.operator}`, t };
      }
      const one = { c: '1', t: T.i32 };
      const tmpName = this.tmp('u');
      const combined = this.binaryValues(op, { c: tmpName, t }, one, node, t);
      if (asStatement) return { c: `({ ${this.cpp(t)} ${tmpName} = ${p.get.c}; ${p.set(this.cv(combined, t))}; })`, t: T.void };
      const after = this.tmp('n');
      return { c: `({ ${this.cpp(t)} ${tmpName} = ${p.get.c}; ${this.cpp(t)} ${after} = ${this.cv(combined, t)}; ${p.set(after)}; ${node.prefix ? after : tmpName}; })`, t };
    }

    // ---------------- operators

    binary(node) {
      const op = node.operator;
      if (op === 'instanceof') return this.instanceOf(node);
      if (op === 'in') {
        const key = this.expr(node.left), obj = this.expr(node.right);
        return { c: `js::hasProperty(${this.cv(obj, T.any)}, ${this.cv(key, T.str)})`, t: T.bool };
      }
      const L = this.expr(node.left), R = this.expr(node.right);
      return this.binaryValues(op, L, R, node, this.type(node.resultType));
    }

    /** a op b with JavaScript semantics on translated operands */
    binaryValues(op, L, R, node, rt) {
      if (['==', '!=', '===', '!=='].includes(op)) return { c: this.equality(op, L, R), t: T.bool };
      if (['<', '>', '<=', '>='].includes(op)) return this.compare(op, L, R);
      if (L.t.k === 'sfn' || R.t.k === 'sfn') { L = { c: this.cv(L, T.any), t: T.any }; R = { c: this.cv(R, T.any), t: T.any }; }
      if (op === '+' && (L.t.k === 'str' || R.t.k === 'str' || (rt && rt.k === 'str' && !(isNumOrBool(L.t) && isNumOrBool(R.t))))) {
        return { c: `js::concat(${L.c}, ${R.c})`, t: T.str };
      }
      const dyn = t => t.k === 'any' || t.k === 'undef' || t.k === 'null' || t.k === 'arr' || t.k === 'cls' || t.k === 'str' || t.k === 'fun' || t.k === 'map' || t.k === 'set';
      if (dyn(L.t) || dyn(R.t)) {
        return { c: `js::dynBinary("${op}", ${this.cv(L, T.any)}, ${this.cv(R, T.any)})`, t: T.any };
      }
      const big = L.t.k === 'big' || R.t.k === 'big' || (rt && rt.k === 'big' && node && node.bigint);
      if (big) {
        const a = this.cv(L, T.big), b = this.cv(R, T.big);
        switch (op) {
          case '/': return { c: `js::bdiv(${a}, ${b})`, t: T.big };
          case '%': return { c: `js::bmod(${a}, ${b})`, t: T.big };
          case '**': return { c: `js::bpow(${a}, ${b})`, t: T.big };
          case '>>>': return { c: `js::unsupported(u"BigInt >>>")`, t: T.big };
          default: return { c: `(${a} ${op} ${b})`, t: T.big };
        }
      }
      // fixed 64-bit BigInt arithmetic (IL types the BigInt operands uint64/int64): a
      // node marked BigInt, or a bitwise operator the IL types 64-bit (on Numbers it
      // would be a 32-bit result) - OpCodes.XorN and friends inline unmarked
      const intLike = t => isInt(t) || t.k === 'bool';
      const wide64 = isInt(rt) && rt.bits === 64 && intLike(L.t) && intLike(R.t) &&
        (['&', '|', '^', '<<', '>>', '>>>'].includes(op) || (['/', '%'].includes(op) && (L.t.bits === 64 || R.t.bits === 64)));
      if (wide64 || (node && node.bigint === true && ((isInt(L.t) && L.t.bits === 64) || (isInt(R.t) && R.t.bits === 64) || (isInt(rt) && rt.bits === 64)))) {
        const ct = isInt(rt) && rt.bits === 64 ? rt : ((L.t.bits === 64 && !L.t.signed) || (R.t.bits === 64 && !R.t.signed) ? T.u64 : T.i64);
        const c = this.cpp(ct);
        const a = this.cv(L, ct), b = this.cv(R, ct);
        switch (op) {
          case '/': return { c: `js::idiv<${c}>(${a}, ${b})`, t: ct };
          case '%': return { c: `js::imod<${c}>(${a}, ${b})`, t: ct };
          case '<<': return { c: `js::shl64<${c}>(${a}, (int64_t)(${b}))`, t: ct };
          case '>>': return { c: `js::shr64<${c}>(${a}, (int64_t)(${b}))`, t: ct };
          case '>>>': return { c: `static_cast<${c}>(js::shr64<uint64_t>(static_cast<uint64_t>(${a}), (int64_t)(${b})))`, t: ct };
          case '**': return { c: `static_cast<${c}>(js::BigInt(${a}).pow(js::BigInt(${b})).lowU64())`, t: ct };
          default: return { c: `static_cast<${c}>(${a} ${op} ${b})`, t: ct };
        }
      }
      // Number semantics
      switch (op) {
        case '&': case '|': case '^': {
          const small = t => (isInt(t) && t.bits <= 32) || t.k === 'bool';
          if (small(L.t) && small(R.t)) {
            const ct = isInt(rt) && !rt.signed && rt.bits <= 32 ? T.u32 : T.i32;
            const c = this.cpp(ct);
            return { c: `(static_cast<${c}>(${L.c}) ${op} static_cast<${c}>(${R.c}))`, t: ct };
          }
          return { c: `(js::i32(${L.c}) ${op} js::i32(${R.c}))`, t: T.i32 };
        }
        case '<<': return { c: `js::shl32(js::i32(${L.c}), js::u32(${R.c}))`, t: T.i32 };
        case '>>': return { c: `js::sar32(js::i32(${L.c}), js::u32(${R.c}))`, t: T.i32 };
        case '>>>': return { c: `js::shr32(js::u32(${L.c}), js::u32(${R.c}))`, t: T.u32 };
        case '**': return { c: `std::pow(static_cast<double>(${L.c}), static_cast<double>(${R.c}))`, t: T.f64 };
        case '/': return { c: `(static_cast<double>(${L.c}) / static_cast<double>(${R.c}))`, t: T.f64 };
        case '+': case '-': case '*': case '%': {
          if (isFloat(L.t) || isFloat(R.t) || (rt && isFloat(rt) && op !== '%' && !(isInt(L.t) && isInt(R.t)))) {
            if (op === '%') return { c: `std::fmod(static_cast<double>(${L.c}), static_cast<double>(${R.c}))`, t: T.f64 };
            return { c: `(static_cast<double>(${L.c}) ${op} static_cast<double>(${R.c}))`, t: T.f64 };
          }
          const lb = L.t.k === 'bool' ? T.i32 : L.t, rb = R.t.k === 'bool' ? T.i32 : R.t;
          let ct;
          if (lb.bits === 64 || rb.bits === 64) ct = isInt(rt) && rt.bits === 64 ? rt : ((lb.bits === 64 && !lb.signed) || (rb.bits === 64 && !rb.signed) ? T.u64 : T.i64);
          else ct = op === '*' && !lb.signed && !rb.signed ? T.u64 : T.i64;
          const c = this.cpp(ct);
          if (op === '%') return { c: `js::imod<${c}>(static_cast<${c}>(${L.c}), static_cast<${c}>(${R.c}))`, t: ct };
          return { c: `(static_cast<${c}>(${L.c}) ${op} static_cast<${c}>(${R.c}))`, t: ct };
        }
      }
      return { c: `js::dynBinary("${op}", ${this.cv(L, T.any)}, ${this.cv(R, T.any)})`, t: T.any };
    }

    equality(op, L, R) {
      const strict = op === '===' || op === '!==';
      const neg = op === '!==' || op === '!=';
      let r;
      const nullish = t => t.k === 'null' || t.k === 'undef';
      if (nullish(L.t) || nullish(R.t)) {
        const other = nullish(L.t) ? R : L;
        const lit = nullish(L.t) ? L : R;
        if (nullish(other.t)) r = strict ? (L.t.k === R.t.k ? 'true' : 'false') : 'true';
        else if (other.t.k === 'any') {
          if (strict) r = lit.t.k === 'null' ? `(${other.c}.tag == js::Tag::Null)` : `(${other.c}.tag == js::Tag::Undef)`;
          else r = `${other.c}.isNullish()`;
        } else if (isNumOrBool(other.t) || other.t.k === 'big') r = 'false';
        else if (other.t.k === 'sfn') r = 'false';
        else r = `!js::truthyRef(${other.c})`;
      } else if (isNum(L.t) && isNum(R.t)) {
        if (isFloat(L.t) || isFloat(R.t)) r = `(static_cast<double>(${L.c}) == static_cast<double>(${R.c}))`;
        else if (L.t.signed === R.t.signed || (L.t.bits < 64 && R.t.bits < 64 && (L.t.bits < 32 || R.t.bits < 32))) r = `(${L.c} == ${R.c})`;
        else r = `std::cmp_equal(${L.c}, ${R.c})`;
      } else if (L.t.k === 'bool' && R.t.k === 'bool') r = `(${L.c} == ${R.c})`;
      else if (L.t.k === 'str' && R.t.k === 'str') r = `(${L.c} == ${R.c})`;
      else if (L.t.k === 'big' && R.t.k === 'big') r = `(${L.c} == ${R.c})`;
      else if (L.t.k === 'sfn' || R.t.k === 'sfn') r = 'false';
      else r = `js::${strict ? 'strictEq' : 'looseEq'}(${L.c}, ${R.c})`;
      return neg ? `(!${r})` : r;
    }

    compare(op, L, R) {
      const fn = { '<': 'lt', '>': 'gt', '<=': 'le', '>=': 'ge' }[op];
      if (isNum(L.t) && isNum(R.t)) {
        if (isFloat(L.t) || isFloat(R.t)) return { c: `(static_cast<double>(${L.c}) ${op} static_cast<double>(${R.c}))`, t: T.bool };
        if (L.t.signed === R.t.signed) return { c: `(${L.c} ${op} ${R.c})`, t: T.bool };
        if (L.t.bits < 32 && R.t.bits < 64 || R.t.bits < 32 && L.t.bits < 64) return { c: `(static_cast<int64_t>(${L.c}) ${op} static_cast<int64_t>(${R.c}))`, t: T.bool };
      }
      if (L.t.k === 'big' && R.t.k === 'big') return { c: `(${L.c} ${op} ${R.c})`, t: T.bool };
      if (L.t.k === 'str' && R.t.k === 'str') return { c: `(${L.c} ${op} ${R.c})`, t: T.bool };
      const a = L.t.k === 'sfn' || L.t.k === 'null' || L.t.k === 'undef' ? { c: this.cv(L, T.any) } : L;
      const b = R.t.k === 'sfn' || R.t.k === 'null' || R.t.k === 'undef' ? { c: this.cv(R, T.any) } : R;
      const boolish = t => t.k === 'bool';
      return { c: `js::${fn}(${boolish(L.t) ? `static_cast<int32_t>(${a.c})` : a.c}, ${boolish(R.t) ? `static_cast<int32_t>(${b.c})` : b.c})`, t: T.bool };
    }

    logical(node, want) {
      const op = node.operator;
      const rt = this.type(node.resultType);
      const L = this.expr(node.left), R = this.expr(node.right);
      if (op !== '??' && L.t.k === 'bool' && R.t.k === 'bool') return { c: `(${L.c} ${op} ${R.c})`, t: T.bool };
      if (op !== '??' && rt.k === 'bool' && (!want || want.k === 'bool')) {
        return { c: `(js::truthy(${L.c}) ${op} js::truthy(${R.c}))`, t: T.bool };
      }
      // the value of one operand
      let t = rt.k === 'void' || rt.k === 'null' || rt.k === 'undef' ? T.any : rt;
      if (sameType(L.t, R.t)) t = L.t;
      else if (t.k === 'any' && isNum(L.t) && isNum(R.t)) t = this.widerNumber(L.t, R.t);
      else if (t.k === 'any' && R.t.k === 'null' && isRef(L.t)) t = L.t;
      const l = this.tmp('l');
      const test = op === '||' ? `js::truthy(${l})` : op === '&&' ? `!js::truthy(${l})` : `js::truthyRef(${l})`;
      return { c: `({ ${this.cpp(L.t)} ${l} = ${L.c}; ${test} ? ${this.cv({ c: l, t: L.t }, t)} : ${this.cv(R, t)}; })`, t };
    }

    unary(node) {
      const op = node.operator;
      if (op === 'typeof') return this.typeOf(node);
      if (op === 'delete') return this.deleteExpr(node);
      if (op === '++' || op === '--') return this.update(node, false);
      const a = this.expr(node.argument);
      switch (op) {
        case '!': return { c: a.t.k === 'bool' ? `(!${a.c})` : `(!js::truthy(${a.c}))`, t: T.bool };
        case 'void': return { c: `((void)(${a.c}), js::Any())`, t: T.undef };
        case '-':
          if (a.t.k === 'big') return { c: `(-${a.c})`, t: T.big };
          if (isInt(a.t) && node.argument.type === 'Literal') {
            const v = -node.argument.value;
            return this.numberLiteral(v, this.type(node.resultType), null);
          }
          if (isInt(a.t)) {
            if (a.t.bits === 64 && node.bigint) return { c: `static_cast<${this.cpp(a.t)}>(0 - ${a.c})`, t: a.t };
            return { c: `(-static_cast<int64_t>(${a.c}))`, t: T.i64 };
          }
          if (isFloat(a.t)) return { c: `(-${a.c})`, t: a.t };
          if (a.t.k === 'bool') return { c: `(-static_cast<int32_t>(${a.c}))`, t: T.i32 };
          return { c: `js::Any(-(${this.cv(a, T.any)}).toNumber())`, t: T.any };
        case '+':
          if (isNum(a.t)) return a;
          if (a.t.k === 'bool') return { c: `static_cast<int32_t>(${a.c})`, t: T.i32 };
          return { c: `${this.cv(a, T.any)}.toNumber()`, t: T.f64 };
        case '~':
          if (a.t.k === 'big') return { c: `(~${a.c})`, t: T.big };
          if (isInt(a.t) && a.t.bits === 64 && (node.bigint || (isInt(this.type(node.resultType)) && this.type(node.resultType).bits === 64))) return { c: `static_cast<${this.cpp(a.t)}>(~${a.c})`, t: a.t };
          if (isInt(a.t) && a.t.bits <= 32 && !a.t.signed && isInt(this.type(node.resultType)) && !this.type(node.resultType).signed) return { c: `(~static_cast<uint32_t>(${a.c}))`, t: T.u32 };
          return { c: `(~js::i32(${a.c}))`, t: T.i32 };
      }
      return { c: `js::unsupported(${u16Literal('unary ' + op)})`, t: T.any };
    }

    conditional(node, want) {
      const test = this.cond(node.test);
      const rt = this.type(node.contextType || node.resultType);
      const A = this.expr(node.consequent, rt.k !== 'any' ? rt : want), B = this.expr(node.alternate, rt.k !== 'any' ? rt : want);
      let t;
      if (sameType(A.t, B.t)) t = A.t;
      else if (rt.k !== 'any' && rt.k !== 'void' && rt.k !== 'null' && rt.k !== 'undef' && !(node.nullable)) t = rt;
      else if (isNum(A.t) && isNum(B.t)) t = this.widerNumber(A.t, B.t);
      else if (A.t.k === 'null' && isRef(B.t)) t = B.t;
      else if (B.t.k === 'null' && isRef(A.t)) t = A.t;
      else t = T.any;
      if (t.k === 'sfn') t = T.fun;
      return { c: `(${test} ? ${this.cv(A, t)} : ${this.cv(B, t)})`, t };
    }

    typeOf(node) {
      const a = this.expr(node.argument);
      const fixed = { int: 'number', f64: 'number', f32: 'number', bool: 'boolean', str: 'string', big: 'bigint', arr: 'object', cls: 'object', fun: 'function', sfn: 'function', map: 'object', set: 'object', undef: 'undefined', null: 'object', dataview: 'object' };
      if (a.t.k === 'any') return { c: `${a.c}.typeOf()`, t: T.str };
      if (a.unknown || a.globalRef) return { c: lit(a.globalRef && GLOBAL_OBJECTS.has(a.globalRef) && !['window', 'self', 'module', 'exports', 'require', 'define', 'global', 'process', 'Buffer', 'crypto', 'performance', 'TextEncoder', 'TextDecoder'].includes(a.globalRef) ? (a.globalRef === 'OpCodes' || a.globalRef === 'AlgorithmFramework' || a.globalRef === 'Math' || a.globalRef === 'JSON' || a.globalRef === 'console' || a.globalRef === 'globalThis' || a.globalRef === 'Reflect' ? 'object' : 'function') : 'undefined'), t: T.str };
      if (a.classRef || a.fnRef) return { c: lit('function'), t: T.str };
      if (isRef(a.t) && a.t.k !== 'any') return { c: `(js::truthyRef(${a.c}) ? ${lit(fixed[a.t.k] || 'object')} : ${lit('object')})`, t: T.str };
      return { c: `((void)(${a.c}), ${lit(fixed[a.t.k] || 'object')})`, t: T.str };
    }

    deleteExpr(node) {
      const arg = node.argument;
      if (arg && (arg.type === 'MemberExpression' || arg.type === 'ThisPropertyAccess')) {
        const o = arg.type === 'ThisPropertyAccess' ? this.thisExpr() : this.expr(arg.object);
        const key = arg.computed ? this.cv(this.expr(arg.property), T.str) : lit(arg.type === 'ThisPropertyAccess' ? arg.property : (arg.property.name || arg.property.value));
        if (o.t.k === 'cls' || o.t.k === 'any') return { c: `js::deleteProperty(${this.cv(o, T.any)}, ${key})`, t: T.bool };
      }
      return { c: 'true', t: T.bool };
    }

    instanceOf(node) {
      const L = this.expr(node.left);
      const name = node.right && node.right.name;
      if (name && (this.classes.has(name) || (FRAMEWORK[name] && name !== 'Object'))) {
        const cls = this.classes.has(name) ? `${this.ns}::${cppIdent(name)}` : `js::${name}`;
        return { c: `js::instanceOf<${cls}>(${this.cv(L, T.any)})`, t: T.bool };
      }
      if (name === 'Array' || TYPED_ARRAYS[name]) return { c: `(${this.cv(L, T.any)}.tag == js::Tag::Arr)`, t: T.bool };
      if (name === 'Error' || name === 'TypeError' || name === 'RangeError') return { c: `js::instanceOf<js::Error>(${this.cv(L, T.any)})`, t: T.bool };
      if (name === 'Object') return { c: `(${this.cv(L, T.any)}.tag == js::Tag::Obj || ${this.cv(L, T.any)}.tag == js::Tag::Arr)`, t: T.bool };
      if (name === 'Map') return { c: `js::instanceOf<js::Map>(${this.cv(L, T.any)})`, t: T.bool };
      return { c: 'false', t: T.bool };
    }

    // ---------------- literals of compound values

    elementTypeFor(node, want) {
      // the storage it goes to, else the IL's type of the context
      if (want && want.k === 'arr') return want.e;
      const ctx = this.type(node.contextType);
      if (ctx.k === 'arr') return ctx.e;
      const rt = this.type(node.resultType);
      if (rt.k === 'arr') return rt.e;
      if (node.elementType) return this.type(node.elementType);
      return T.any;
    }

    arrayLiteral(node, want) {
      const elemT = this.elementTypeFor(node, want);
      const els = node.elements || [];
      const typed = !!node.arrayType;
      const arrT = T.arr(elemT);
      const ce = this.cpp(elemT);
      if (!els.length) return { c: `${this.cpp(arrT)}::create(0${typed ? ', true' : ''})`, t: arrT };
      if (els.some(e => e && e.type === 'SpreadElement')) {
        const a = this.tmp('a');
        const parts = els.map(e => {
          if (e && e.type === 'SpreadElement') {
            const s = this.expr(e.argument, arrT);
            if (s.t.k === 'arr') return `${a}.pushAll(${this.cv(s, arrT)});`;
            if (s.t.k === 'str') return `{ js::String __s = ${s.c}; for (int32_t __k = 0; __k < __s.length(); ++__k) ${a}.push(${this.cv({ c: '__s.charAt(__k)', t: T.str }, elemT)}); }`;
            return `${a}.pushAll(js::fromAny<${this.cpp(arrT)}>(${this.cv(s, T.any)}));`;
          }
          return `${a}.push(${e ? this.cv(this.expr(e, elemT), elemT) : this.defaultOf(elemT)});`;
        });
        return { c: `({ ${this.cpp(arrT)} ${a} = ${this.cpp(arrT)}::create(0); ${parts.join(' ')} ${typed ? `${a}.p->typed = true; ` : ''}${a}; })`, t: arrT };
      }
      const items = els.map(e => e ? this.cv(this.expr(e, elemT), elemT) : this.defaultOf(elemT));
      if (typed) return { c: `js::Array<${ce}>::from(std::vector<${ce}>{ ${items.join(', ')} }, true)`, t: arrT };
      return { c: `js::Array<${ce}>{ ${items.join(', ')} }`, t: arrT };
    }

    objectLiteral(node, want) {
      const props = node.properties || [];
      const parts = [];
      const spreads = [];
      for (const p of props) {
        if (!p) continue;
        if (p.type === 'ObjectSpread' || p.type === 'SpreadElement') { spreads.push(this.cv(this.expr(p.argument), T.any)); continue; }
        let key = typeof p.key === 'string' || typeof p.key === 'number' ? p.key : p.key && (p.key.name !== undefined ? p.key.name : p.key.value);
        if (p.computed && p.key && typeof p.key === 'object' && p.key.type !== 'Literal') { spreads.push(null); parts.push({ dynKey: this.cv(this.expr(p.key), T.str), value: this.cv(this.expr(p.value), T.any) }); continue; }
        if (p.kind === 'get' || p.kind === 'set') continue;
        let value;
        if (p.method || (p.value && (p.value.type === 'FunctionExpression' || p.value.type === 'ArrowFunction'))) value = this.cv(this.functionValue(p.value, T.fun), T.any);
        else value = this.cv(this.expr(p.value), T.any);
        parts.push({ key: String(key), value });
      }
      const fixed = parts.filter(p => p.key !== undefined);
      const base = `js::newObject({ ${fixed.map(p => `{ ${u16Literal(p.key)}, ${p.value} }`).join(', ')} })`;
      const dyn = parts.filter(p => p.dynKey);
      const sp = spreads.filter(Boolean);
      if (!dyn.length && !sp.length) return { c: `js::Any(${base})`, t: T.any };
      const o = this.tmp('o');
      return { c: `({ js::DynObject* ${o} = ${base}; ${sp.map(s => `js::assignProps(${o}, ${s});`).join(' ')} ${dyn.map(d => `${o}->__set(${d.dynKey}.s(), ${d.value});`).join(' ')} js::Any(${o}); })`, t: T.any };
    }

    /** An arrow function or function expression as a value */
    functionValue(node, want) {
      const params = this.paramsOf(node);
      const savedFn = this.fn;
      const ret = this.returnTypeOf(node, null);
      const typedRet = ret.k === 'void' ? T.void : ret;
      this.fn = { kind: 'lambda', ret: typedRet, cls: savedFn ? savedFn.cls : null, thisType: node.type === 'FunctionExpression' && !(savedFn && savedFn.thisType) ? null : (savedFn ? savedFn.thisType : null), isStatic: savedFn && savedFn.isStatic };
      this.pushScope();
      const prologue = [];
      params.forEach((p, i) => {
        const v = this.declare(p.name, p.type);
        if (p.rest) {
          prologue.push(new CppVariableDeclaration(this.cpp(p.type), v.cpp, `${this.cpp(p.type)}::create(0)`));
          prologue.push(new CppRaw(`for (size_t __k = ${i}; __k < __a.size(); ++__k) ${v.cpp}.push(js::fromAny<${this.cpp(p.type.e)}>(__a[__k]));`));
          return;
        }
        let init = `js::fromAny<${this.cpp(p.type)}>(__a.size() > ${i} ? __a[${i}] : js::Any())`;
        if (p.type.k === 'any') init = `(__a.size() > ${i} ? __a[${i}] : js::Any())`;
        if (p.def) init = `(__a.size() > ${i} && !__a[${i}].isUndef() ? ${init} : ${this.cv(this.expr(p.def, p.type), p.type)})`;
        prologue.push(new CppVariableDeclaration(this.cpp(p.type), v.cpp, init));
      });
      let body;
      if (node.body && node.body.type !== 'BlockStatement') {
        const e = this.expr(node.body, typedRet.k === 'void' ? null : typedRet);
        body = typedRet.k === 'void' && e.t.k === 'void' ? [new CppExpressionStatement(e.c), new CppReturn('js::Any()')] : [new CppReturn(this.cv(e, T.any))];
      } else {
        this.fn.ret = T.any;
        this.fn.dynamicReturn = true;
        body = this.functionBody(node.body);
        body.push(new CppReturn('js::Any()'));
      }
      this.popScope();
      this.fn = savedFn;
      const inCall = node.__immediate;
      const cap = inCall ? '&' : (savedFn && savedFn.thisType && !savedFn.isStatic ? '=, this' : '=');
      const text = `js::Fun([${cap}](std::vector<js::Any>& __a) mutable -> js::Any ${this.inlineBlock([...prologue, ...body])})`;
      return { c: text, t: T.fun };
    }

    template(node) {
      const parts = [];
      const quasis = node.quasis || [];
      quasis.forEach((q, i) => {
        const text = q.value ? (q.value.cooked !== undefined ? q.value.cooked : q.value.raw) : '';
        if (text) parts.push(lit(text));
        if (i < (node.expressions || []).length) parts.push(`js::str(${this.expr(node.expressions[i]).c})`);
      });
      return { c: parts.length ? parts.reduce((a, b) => `js::concat(${a}, ${b})`) : lit(''), t: T.str };
    }

    interpolation(node) {
      const parts = (node.parts || []).map(p => p.type === 'StringPart' || p.value !== undefined && p.expression === undefined ? lit(String(p.value)) : `js::str(${this.expr(p.expression).c})`);
      return { c: parts.length ? parts.reduce((a, b) => `js::concat(${a}, ${b})`) : lit(''), t: T.str };
    }

    // ---------------- calls

    /** Convert call arguments to a signature's parameters (spreads expand dynamically) */
    callArgs(args, params) {
      const out = [];
      const spread = args.findIndex(a => a && a.type === 'SpreadElement');
      if (spread >= 0) {
        // f(a, ...rest): unpack the spread array into the remaining parameters
        const fixed = args.slice(0, spread).map((a, i) => i < params.length ? this.cv(this.expr(a, params[i].type), params[i].type) : null).filter(x => x !== null);
        const arr = this.expr(args[spread].argument);
        const tmpName = this.tmp('s');
        const rest = params.slice(spread).map((p, k) => p.rest ? `${this.cv(arr, p.type)}` : this.cv({ c: `${tmpName}.index(js::Any(${k}))`, t: T.any }, p.type));
        return { pre: `js::Any ${tmpName} = ${this.cv(arr, T.any)};`, args: [...fixed, ...rest] };
      }
      params.forEach((p, i) => {
        if (p.rest) {
          const items = args.slice(i).map(a => this.cv(this.expr(a, p.type.e), p.type.e));
          out.push(`${this.cpp(p.type)}{ ${items.join(', ')} }`);
          if (!items.length) out[out.length - 1] = `${this.cpp(p.type)}::create(0)`;
          return;
        }
        if (i >= args.length) return;
        const complex = p.def && !this.simpleDefault(p.def);
        const e = this.expr(args[i], p.type);
        out.push(complex ? `std::optional<${this.cpp(p.type)}>(${this.cv(e, p.type)})` : this.cv(e, p.type));
      });
      // missing middle arguments keep their defaults only at the end: fill gaps
      return { pre: null, args: out };
    }

    finishCall(callText, pre, ret) {
      if (pre) return { c: `({ ${pre} ${callText}; })`, t: ret };
      return { c: callText, t: ret };
    }

    call(node) {
      const callee = node.callee;
      const args = node.arguments || [];
      for (const a of args) if (a && (a.type === 'ArrowFunction' || a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression')) a.__immediate = true;
      if (callee.type === 'Identifier') return this.callIdentifier(callee, args, node);
      if (callee.type === 'MemberExpression' && !callee.computed) {
        const prop = callee.property && (callee.property.name || callee.property.value);
        const obj = callee.object;
        // Global.fn.apply(thisArg, list) / Global.fn.call(thisArg, ...args)
        if ((prop === 'apply' || prop === 'call') && obj && obj.type === 'MemberExpression' && !obj.computed &&
            obj.object && obj.object.type === 'Identifier' && !this.lookup(obj.object.name) && GLOBAL_OBJECTS.has(obj.object.name)) {
          const inner = obj.property && (obj.property.name || obj.property.value);
          const rest = prop === 'apply' ? (args[1] ? [{ type: 'SpreadElement', argument: args[1] }] : []) : args.slice(1);
          const g = this.globalCall(obj.object.name, inner, rest, node);
          if (g) return g;
        }
        if (obj && obj.type === 'Identifier' && !this.lookup(obj.name)) {
          const g = this.globalCall(obj.name, prop, args, node);
          if (g) return g;
        }
        if (obj && obj.type === 'Super') return this.parentMethodCall({ method: prop, arguments: args, parentClass: this.fn && this.fn.cls && this.fn.cls.base });
        const o = this.expr(obj);
        return this.methodCall(o, prop, args, node);
      }
      if (callee.type === 'ThisPropertyAccess' && !callee.computed) return this.methodCall(this.thisExpr(), callee.property, args, node);
      // a computed callee or a call of a call
      const f = this.expr(callee);
      return this.callValue(f, args, node);
    }

    /** Call a function value (js::Fun, typed local function, or dynamic) */
    callValue(f, args, node) {
      const rt = this.type(node.resultType);
      if (f.t.k === 'sfn') {
        const params = f.t.params.map((t, i) => ({ type: t, name: 'p' + i }));
        const sig = f.fnRef ? f.fnRef.sig : (this.lookup(f.c) && this.lookup(f.c).sig) || null;
        const a = this.callArgs(args, sig ? sig.params : params);
        return this.finishCall(`${f.c}(${a.args.join(', ')})`, a.pre, f.t.ret);
      }
      const list = args.map(a => a && a.type === 'SpreadElement' ? null : this.cv(this.expr(a), T.any));
      if (args.some(a => a && a.type === 'SpreadElement')) {
        const v = this.tmp('args');
        const pushes = args.map(a => a.type === 'SpreadElement' ? `{ js::Any __s = ${this.cv(this.expr(a.argument), T.any)}; for (int32_t __k = 0; __k < __s.length(); ++__k) ${v}.push_back(__s.index(js::Any(__k))); }` : `${v}.push_back(${this.cv(this.expr(a), T.any)});`);
        const fc = f.t.k === 'fun' ? `js::Any(${f.c})` : this.cv(f, T.any);
        return { c: `({ std::vector<js::Any> ${v}; ${pushes.join(' ')} ${fc}.call(${v}); })`, t: T.any };
      }
      const fc = f.t.k === 'fun' ? `js::Any(${f.c})` : this.cv(f, T.any);
      void rt;
      return { c: `${fc}.call({ ${list.join(', ')} })`, t: T.any };
    }

    callIdentifier(callee, args, node) {
      const name = callee.name;
      const v = this.lookup(name);
      if (v) return this.callValue({ c: v.cpp, t: v.type, fnRef: null }, args, node);
      if (this.functions.has(name)) {
        const f = this.functions.get(name);
        if (!f.sig) f.sig = { params: this.paramsOf(f.node), ret: this.returnTypeOf(f.node, null) };
        const a = this.callArgs(args, f.sig.params);
        return this.finishCall(`${this.ns}::${f.cpp}(${a.args.join(', ')})`, a.pre, f.sig.ret);
      }
      if (FW_FUNCTIONS[name]) {
        const fw = FW_FUNCTIONS[name];
        const sig = this.fwSig(fw);
        const a = this.callArgs(args, sig.params);
        return this.finishCall(`${fw.cpp}(${a.args.join(', ')})`, a.pre, sig.ret);
      }
      const arg = i => args[i] ? this.expr(args[i]) : { c: 'js::Any()', t: T.undef };
      switch (name) {
        case 'parseInt': return { c: `js::parseInt(${this.cv(arg(0), T.str)}${args[1] ? ', ' + this.cv(arg(1), T.i32) : ''})`, t: T.f64 };
        case 'parseFloat': return { c: `js::parseFloat(${this.cv(arg(0), T.str)})`, t: T.f64 };
        case 'isNaN': return { c: `std::isnan(${this.cv(arg(0), T.f64)})`, t: T.bool };
        case 'isFinite': return { c: `std::isfinite(${this.cv(arg(0), T.f64)})`, t: T.bool };
        case 'Number': {
          const a = arg(0);
          if (isNum(a.t)) return { c: `static_cast<double>(${a.c})`, t: T.f64 };
          if (a.t.k === 'big') return { c: `${a.c}.toDouble()`, t: T.f64 };
          return { c: `${this.cv(a, T.any)}.toNumber()`, t: T.f64 };
        }
        case 'String': return { c: `js::str(${arg(0).c})`, t: T.str };
        case 'Boolean': return { c: `js::truthy(${arg(0).c})`, t: T.bool };
        case 'BigInt': return { c: this.cv(arg(0), T.big), t: T.big };
        case 'Array': return { c: `js::Array<js::Any>::create(${this.cv(arg(0), T.i32)})`, t: T.arr(T.any) };
        case 'Symbol': return { c: 'js::Any()', t: T.any };
      }
      return { c: `js::unsupported(${u16Literal('call of ' + name)})`, t: T.any };
    }

    /** Calls on global objects: OpCodes, Math, Object, String, Number, Array, AlgorithmFramework, JSON, console */
    globalCall(objName, prop, args, node) {
      const arg = (i, w) => args[i] ? this.expr(args[i], w) : { c: 'js::Any()', t: T.undef };
      const rt = this.type(node.contextType || node.resultType);
      switch (objName) {
        case 'AlgorithmFramework':
          if (prop === 'Find') return { c: `js::Find(${this.cv(arg(0), T.str)})`, t: T.cls('Algorithm', true) };
          if (prop === 'RegisterAlgorithm') return { c: `js::RegisterAlgorithm(${this.cv(arg(0), T.cls('Algorithm', true))})`, t: T.void };
          if (FW_FUNCTIONS[prop]) return this.callIdentifier({ name: prop }, args, node);
          return null;
        case 'Math': return this.mathCall(prop, args, node);
        case 'Object': {
          switch (prop) {
            case 'keys': return { c: `js::keysOf(${this.cv(arg(0), T.any)})`, t: T.arr(T.str) };
            case 'values': return { c: `js::valuesOf(${this.cv(arg(0), T.any)})`, t: T.arr(T.any) };
            case 'entries': return { c: `js::entriesOf(${this.cv(arg(0), T.any)})`, t: T.arr(T.arr(T.any)) };
            case 'freeze': case 'seal': case 'preventExtensions': { const a = arg(0); return a.t.k === 'any' ? { c: `js::freeze(${a.c})`, t: T.any } : a; }
            case 'assign': return { c: `js::assignAll(${args.map(a => this.cv(this.expr(a), T.any)).join(', ')})`, t: T.any };
            case 'create': return { c: 'js::Any(js::newObject())', t: T.any };
            case 'getPrototypeOf': return { c: 'js::Any()', t: T.any };
            case 'defineProperty': return { c: `js::defineValue(${this.cv(arg(0), T.any)}, ${this.cv(arg(1), T.str)}, ${this.cv(arg(2), T.any)})`, t: T.any };
            case 'prototype': return null;
          }
          return null;
        }
        case 'String':
          if (prop === 'fromCharCode') {
            if (args.length === 1 && args[0].type === 'SpreadElement') return { c: `js::fromCharCodes(${this.expr(args[0].argument).c})`, t: T.str };
            return { c: `js::fromCharCode(${args.map(a => this.cv(this.expr(a), T.i32)).join(', ')})`, t: T.str };
          }
          if (prop === 'fromCodePoint') return { c: `js::fromCodePoint(${this.cv(arg(0), T.u32)})`, t: T.str };
          return null;
        case 'Number':
          if (prop === 'isInteger' || prop === 'isSafeInteger') return { c: `js::isInteger(${this.cv(arg(0), T.f64)})`, t: T.bool };
          if (prop === 'isNaN') return { c: `std::isnan(${this.cv(arg(0), T.f64)})`, t: T.bool };
          if (prop === 'isFinite') return { c: `std::isfinite(${this.cv(arg(0), T.f64)})`, t: T.bool };
          if (prop === 'parseInt') return { c: `js::parseInt(${this.cv(arg(0), T.str)}${args[1] ? ', ' + this.cv(arg(1), T.i32) : ''})`, t: T.f64 };
          if (prop === 'parseFloat') return { c: `js::parseFloat(${this.cv(arg(0), T.str)})`, t: T.f64 };
          return null;
        case 'Array':
          if (prop === 'isArray') { const a = arg(0); return { c: a.t.k === 'arr' ? `js::truthyRef(${a.c})` : a.t.k === 'any' ? `(${a.c}.tag == js::Tag::Arr)` : 'false', t: T.bool }; }
          if (prop === 'from') return this.arrayFrom({ iterable: args[0], mapFunction: args[1] || null, resultType: node.resultType, contextType: node.contextType }, rt);
          if (prop === 'of') return this.arrayLiteral({ elements: args, resultType: node.resultType, contextType: node.contextType }, rt);
          return null;
        case 'ArrayBuffer':
          if (prop === 'isView') { const a = arg(0); return { c: a.t.k === 'arr' ? `js::truthyRef(${a.c})` : a.t.k === 'any' ? `(${a.c}.tag == js::Tag::Arr)` : 'false', t: T.bool }; }
          return null;
        case 'BigInt':
          if (prop === 'asUintN') return { c: `${this.cv(arg(1), T.big)}.asUintN(${this.cv(arg(0), T.i64)})`, t: T.big };
          if (prop === 'asIntN') return { c: `${this.cv(arg(1), T.big)}.asIntN(${this.cv(arg(0), T.i64)})`, t: T.big };
          return null;
        case 'JSON':
          if (prop === 'stringify') return { c: `js::jsonStringify(${this.cv(arg(0), T.any)})`, t: T.str };
          return null;
        case 'console':
          return { c: `js::debugOutput({ ${args.map(a => this.cv(this.expr(a), T.any)).join(', ')} })`, t: T.void };
        case 'OpCodes':
          return this.opcodesCall(prop, args, node);
      }
      if (this.classes.has(objName)) {
        const c = this.classes.get(objName);
        for (let k = c; k; k = this.classes.get(k.base)) {
          if (k.methods.has(prop) && k.methods.get(prop).isStatic) {
            const m = k.methods.get(prop);
            const a = this.callArgs(args, m.sig.params);
            return this.finishCall(`${k.cppName}::${cppIdent(prop)}(${a.args.join(', ')})`, a.pre, m.sig.ret);
          }
          if (k.staticFields.has(prop)) {
            return this.callValue({ c: `${k.cppName}::${cppIdent(prop)}`, t: k.staticFields.get(prop).type }, args, node);
          }
        }
        return null;
      }
      return null;
    }

    mathCall(prop, args, node) {
      const rt = this.type(node.resultType);
      const arg = i => args[i] ? this.expr(args[i]) : { c: 'NAN', t: T.f64 };
      const d = i => this.cv(arg(i), T.f64);
      switch (prop) {
        case 'floor': case 'ceil': case 'trunc': case 'round': {
          const a = arg(0);
          if (isInt(a.t)) return a;
          return { c: `js::Math::${prop}(${this.cv(a, T.f64)})`, t: T.f64 };
        }
        case 'abs': {
          const a = arg(0);
          if (isInt(a.t)) return { c: `std::abs(static_cast<int64_t>(${a.c}))`, t: T.i64 };
          return { c: `std::fabs(${this.cv(a, T.f64)})`, t: T.f64 };
        }
        case 'min': case 'max': {
          if (args.length === 1 && args[0].type === 'SpreadElement') {
            const a = this.expr(args[0].argument);
            const t = a.t.k === 'arr' && isNum(a.t.e) ? (isInt(a.t.e) ? T.i64 : T.f64) : T.f64;
            return { c: `js::Math::${prop}Arr<${this.cpp(t)}>(${a.t.k === 'arr' ? a.c : `js::fromAny<js::Array<double>>(${this.cv(a, T.any)})`})`, t };
          }
          const vals = args.map(a => this.expr(a));
          let t = vals.length && vals.every(v => isInt(v.t)) ? vals.map(v => v.t).reduce((a, b) => this.widerNumber(a, b)) : T.f64;
          if (isInt(t) && t.bits < 64 && vals.some(v => v.t.signed) && vals.some(v => !v.t.signed)) t = T.i64;
          if (!vals.length) return { c: prop === 'min' ? 'INFINITY' : '(-INFINITY)', t: T.f64 };
          return { c: `js::Math::${prop}Of<${this.cpp(t)}>(${vals.map(v => this.cv(v, t)).join(', ')})`, t };
        }
        case 'pow': return { c: `std::pow(${d(0)}, ${d(1)})`, t: T.f64 };
        case 'sqrt': case 'cbrt': case 'log': case 'log2': case 'log10': case 'exp': case 'sin': case 'cos': case 'tan':
        case 'asin': case 'acos': case 'atan': case 'sinh': case 'cosh': case 'tanh': case 'sign': case 'fround':
          return { c: `js::Math::${prop}(${d(0)})`, t: T.f64 };
        case 'atan2': case 'hypot': return { c: `js::Math::${prop}(${d(0)}, ${d(1)})`, t: T.f64 };
        case 'imul': return { c: `js::Math::imul(js::i32(${arg(0).c}), js::i32(${arg(1).c}))`, t: T.i32 };
        case 'clz32': return { c: `js::Math::clz32(js::u32(${arg(0).c}))`, t: T.i32 };
        case 'random': return { c: 'js::Math::random()', t: T.f64 };
      }
      void rt;
      return null;
    }

    opcodesCall(method, args, node) {
      const rt = this.type(node.contextType || node.resultType);
      const a = args.map(x => this.expr(x));
      const arr = (i, e) => a[i] && a[i].t.k === 'arr' ? a[i].c : `js::fromAny<js::Array<${e || 'uint8_t'}>>(${a[i] ? this.cv(a[i], T.any) : 'js::Any()'})`;
      const n = (i, t) => a[i] ? this.cv(a[i], t) : this.defaultOf(t);
      switch (method) {
        case 'CreateArray': {
          const et = rt.k === 'arr' ? rt.e : T.u8;
          return { c: `js::OpCodes::CreateArray<${this.cpp(et)}>(${n(0, T.i64)}${a[1] ? ', ' + this.cv(a[1], et) : ''})`, t: T.arr(et) };
        }
        case 'GetByte': return { c: `js::OpCodes::GetByte(${n(0, T.u32)}, ${n(1, T.i32)})`, t: T.u32 };
        case 'SecureCompare': case 'ArraysEqual': return { c: `js::OpCodes::${method}(${arr(0)}, ${arr(1)})`, t: T.bool };
        case 'ConstantTimeCompare': return { c: `js::OpCodes::ConstantTimeCompare(${arr(0)}, ${arr(1)}${a[2] ? ', ' + n(2, T.i32) : ''})`, t: T.bool };
        case 'GetBit': return { c: `js::OpCodes::GetBit(js::u32(${a[0].c}), ${n(1, T.i32)})`, t: T.bool };
        case 'SetBit': return { c: `js::OpCodes::SetBit(js::u32(${a[0].c}), ${n(1, T.i32)}, ${n(2, T.bool)})`, t: T.u32 };
        case 'Hex32ToDWords': return { c: `js::OpCodes::Hex32ToDWords(${n(0, T.str)})`, t: T.arr(T.u32) };
        case 'GF256Mul': return { c: `js::OpCodes::GF256Mul(js::u32(${a[0].c}), js::u32(${a[1].c}))`, t: T.u32 };
        case 'CopyArray': { const t = a[0].t.k === 'arr' ? a[0].t : (rt.k === 'arr' ? rt : T.arr(T.u8)); return { c: `js::OpCodes::CopyArray(${this.cv(a[0], t)})`, t }; }
        case 'BytesToChars': return { c: `js::OpCodes::BytesToChars(${arr(0)})`, t: T.str };
        case 'ConcatArrays': {
          const t = rt.k === 'arr' ? rt : T.arr(T.u8);
          return { c: `js::OpCodes::ConcatArrays<${this.cpp(t.e)}>(${this.cv(a[0], T.arr(t))})`, t };
        }
        case 'BitMask': return { c: `js::OpCodes::BitMask(${n(0, T.i32)})`, t: T.u32 };
        case 'Shr32Signed': return { c: `js::OpCodes::Shr32Signed(js::i32(${a[0].c}), ${n(1, T.i32)})`, t: T.i32 };
        case 'SecureRandomBytes': return { c: `js::OpCodes::SecureRandomBytes(${n(0, T.i32)})`, t: T.arr(T.u8) };
        case 'GFMul': return { c: `js::OpCodes::GFMul(js::u32(${a[0].c}), js::u32(${a[1].c}), js::u32(${a[2].c}), ${n(3, T.i32)})`, t: T.u32 };
        case 'MulHi32': return { c: `js::OpCodes::MulHi32(js::u32(${a[0].c}), js::u32(${a[1].c}))`, t: T.u32 };
        case 'GcdN': return { c: `js::OpCodes::GcdN(${n(0, T.big)}, ${n(1, T.big)})`, t: T.big };
        case 'BitCountN': return { c: `js::OpCodes::BitCountN(${n(0, T.big)})`, t: T.i32 };
        case 'PopCount': case 'PopCountFast': return { c: `js::OpCodes::${method}(js::u32(${a[0].c}))`, t: T.i32 };
        case 'EncodeMsgLength64LE': return { c: `js::OpCodes::EncodeMsgLength64LE(${n(0, T.f64)})`, t: T.arr(T.u8) };
        case 'RotL64_HL': return { c: `js::OpCodes::RotL64_HL(js::u32(${a[0].c}), js::u32(${a[1].c}), ${n(2, T.i32)})`, t: T.any };
        case 'GetBitN': return { c: `js::OpCodes::GetBitN(${n(0, T.big)}, ${n(1, T.i32)})`, t: T.big };
        case 'AddMod': case 'SubMod': {
          if (a.some(x => x.t.k === 'big') || rt.k === 'big') return { c: `js::OpCodes::${method}(${n(0, T.big)}, ${n(1, T.big)}, ${n(2, T.big)})`, t: T.big };
          return { c: `js::OpCodes::${method}<int64_t>(${n(0, T.i64)}, ${n(1, T.i64)}, ${n(2, T.i64)})`, t: T.i64 };
        }
        case 'MulModN': case 'ModN': case 'ModInverseN': case 'SquareModN': case 'ModPowN':
          return { c: `js::OpCodes::${method}(${a.map(x => this.cv(x, T.big)).join(', ')})`, t: T.big };
        case 'Words32ToBytesBE': return { c: `js::OpCodes::Words32ToBytesBE(${arr(0, 'uint32_t')})`, t: T.arr(T.u8) };
        case 'BytesToWords32BE': return { c: `js::OpCodes::BytesToWords32BE(${arr(0)})`, t: T.arr(T.u32) };
        case 'Add3L64': return { c: `js::OpCodes::Add3L64(js::u32(${a[0].c}), js::u32(${a[1].c}), js::u32(${a[2].c}))`, t: T.f64 };
        case 'Add3H64': return { c: `js::OpCodes::Add3H64(${n(0, T.f64)}, js::i32(${a[1].c}), js::i32(${a[2].c}), js::i32(${a[3].c}))`, t: T.i32 };
        case 'GHashMul': return { c: `js::OpCodes::GHashMul(${arr(0)}, ${arr(1)})`, t: T.arr(T.u8) };
        case 'Split64': return { c: `js::OpCodes::Split64(${n(0, T.f64)})`, t: T.any };
        case 'CreateUint64ArrayFromHex': return { c: `js::OpCodes::CreateUint64ArrayFromHex(${n(0, T.arr(T.str))})`, t: T.arr(T.arr(T.u32)) };
        case 'ToLong': return { c: `js::OpCodes::ToLong(${n(0, T.big)})`, t: T.big };
        case 'ToShort': return { c: `js::OpCodes::ToShort(js::i32(${a[0].c}))`, t: T.i32 };
        case 'XorArrayWithByte': return { c: `js::OpCodes::XorArrayWithByte(${arr(0)}, js::u32(${a[1].c}))`, t: T.arr(T.u8) };
        case 'GCMIncrement': { const t = a[0].t.k === 'arr' ? a[0].t : T.arr(T.u8); return { c: `js::OpCodes::GCMIncrement(${this.cv(a[0], t)})`, t }; }
        case 'RotL64n': case 'RotR64n': case 'RotL128n': case 'RotR128n': {
          if (/64/.test(method) && isInt(a[0].t) && a[0].t.bits === 64) return { c: `js::OpCodes::${method}(static_cast<uint64_t>(${a[0].c}), ${n(1, T.i32)})`, t: T.u64 };
          return { c: `js::OpCodes::${method}(${n(0, T.big)}, ${n(1, T.i32)})`, t: T.big };
        }
        case 'ArraySlice': { const t = a[0].t.k === 'arr' ? a[0].t : T.arr(T.u8); return { c: `js::OpCodes::ArraySlice(${this.cv(a[0], t)}, ${a.slice(1).map(x => this.cv(x, T.f64)).join(', ')})`, t }; }
        case 'ClearArray': return { c: `js::clearArray(${a[0].c})`, t: T.void };
        case 'XorArrays': return { c: `js::xorArrays(${arr(0)}, ${arr(1)})`, t: T.arr(T.u8) };
        case 'Hex8ToBytes': return { c: `js::hexToBytes(${n(0, T.str)})`, t: T.arr(T.u8) };
      }
      return { c: `js::unsupported(${u16Literal('OpCodes.' + method)})`, t: rt.k === 'void' ? T.any : T.any };
    }

    /** A method call on a translated receiver */
    methodCall(o, method, args, node) {
      const rt = this.type(node && (node.resultType));
      if (o.t.k === 'cls') {
        const m = this.findMemberAbove(o.t.name, method);
        if (m && m.kind === 'method') {
          const sig = m.method.fw ? m.method.sig : this.methodSignature(this.classes.get(m.owner), m.method);
          const a = this.callArgs(args, sig.params);
          const recv = m.isStatic ? `${this.classes.get(m.owner).cppName}::` : `${o.c}->`;
          return this.finishCall(`${recv}${cppIdent(method)}(${a.args.join(', ')})`, a.pre, sig.ret);
        }
        if (m && (m.kind === 'field' || m.kind === 'accessor')) {
          const f = this.memberRead(o, method, null);
          return this.callValue(f, args, node);
        }
        if (o.t.name === 'Error' && method === 'toString') return { c: `js::str(js::Any(${o.c}))`, t: T.str };
      }
      if (o.t.k === 'arr') { const r = this.arrayMethod(o, method, args, node); if (r) return r; }
      if (o.t.k === 'str') { const r = this.stringMethod(o, method, args, node); if (r) return r; }
      if (isNum(o.t) || o.t.k === 'big' || o.t.k === 'bool') { const r = this.numberMethod(o, method, args, node); if (r) return r; }
      if (o.t.k === 'map' || o.t.k === 'set') { const r = this.collectionMethod(o, method, args); if (r) return r; }
      if (o.t.k === 'fun' || o.t.k === 'sfn') {
        if (method === 'call') return this.callValue(o, args.slice(1), node);
        if (method === 'apply') {
          const list = args[1] ? this.expr(args[1]) : null;
          if (!list) return this.callValue(o, [], node);
          return { c: `${this.cv(o, T.any)}.call(js::toVector(${this.cv(list, T.any)}))`, t: T.any };
        }
        if (method === 'bind') return { c: this.cv(o, T.fun), t: T.fun };
      }
      if (o.t.k === 'dataview') { const r = this.dataViewMethod(o, method, args); if (r) return r; }
      // dynamic: on an Any, or a member the static type does not declare
      const list = args.map(a => this.cv(this.expr(a.type === 'SpreadElement' ? a.argument : a), T.any));
      void rt;
      return { c: `${this.cv(o, T.any)}.callMethod(${lit(String(method))}, { ${list.join(', ')} })`, t: T.any };
    }

    parentMethodCall(node) {
      const c = this.fn && this.fn.cls;
      if (!c) return { c: 'js::unsupported(u"super call outside a class")', t: T.any };
      const method = node.method;
      const m = this.findMemberAbove(c.base, method);
      const base = this.baseCpp(c);
      if (m && m.kind === 'method') {
        const sig = m.method.fw ? m.method.sig : this.methodSignature(this.classes.get(m.owner), m.method);
        const a = this.callArgs(node.arguments || [], sig.params);
        return this.finishCall(`${base}::${cppIdent(method)}(${a.args.join(', ')})`, a.pre, sig.ret);
      }
      return { c: `js::unsupported(${u16Literal('super.' + method)})`, t: T.any };
    }

    parentCtor(node) {
      const c = this.fn && this.fn.cls;
      if (!c) return { c: '(void)0', t: T.void };
      const base = this.classes.get(c.base);
      const params = base ? (base.ctorSig || this.ctorSignature(base)).params
        : ((FRAMEWORK[c.base] && FRAMEWORK[c.base].ctor) || []).map(([name, type]) => ({ name, type: this.type(type), cpp: cppIdent(name) }));
      const a = this.callArgs(node.arguments || [], params);
      return this.finishCall(`${this.baseCpp(c)}::__ctor(${a.args.join(', ')})`, a.pre, T.void);
    }

    newExpr(node, want) {
      const callee = node.callee;
      const name = callee && (callee.name || (callee.property && callee.property.name));
      const args = node.arguments || [];
      if (name && this.classes.has(name)) {
        const c = this.classes.get(name);
        const a = this.callArgs(args, c.ctorSig.params);
        return this.finishCall(`(new ${c.cppName}())->__ctor(${a.args.join(', ')})`, a.pre, T.cls(name, false));
      }
      if (name && FRAMEWORK[name] && FRAMEWORK[name].ctor && name !== 'Error') {
        const params = FRAMEWORK[name].ctor.map(([n, type]) => ({ name: n, type: this.type(type), cpp: cppIdent(n) }));
        const a = this.callArgs(args, params);
        return this.finishCall(`(new js::${name}())->__ctor(${a.args.join(', ')})`, a.pre, T.cls(name, true));
      }
      switch (name) {
        case 'Error': case 'TypeError': case 'RangeError': case 'SyntaxError': case 'ReferenceError':
          return { c: `js::newError(${u16Literal(name)}, ${args[0] ? this.cv(this.expr(args[0]), T.str) : 'js::String(u"")'})`, t: T.cls('Error', true) };
        case 'Map': return { c: `js::newMap(${args[0] ? this.cv(this.expr(args[0]), T.any) : 'js::Any()'})`, t: T.map };
        case 'Set': return { c: `js::newSet(${args[0] ? this.cv(this.expr(args[0]), T.any) : 'js::Any()'})`, t: T.set };
        case 'Array': {
          const et = this.elementTypeFor(node, want);
          if (args.length === 1) return { c: `js::Array<${this.cpp(et)}>::create(${this.cv(this.expr(args[0]), T.i64)})`, t: T.arr(et) };
          return this.arrayLiteral({ elements: args, contextType: node.contextType, resultType: node.resultType }, want);
        }
        case 'Object': return { c: 'js::Any(js::newObject())', t: T.any };
      }
      if (name && TYPED_ARRAYS[name]) return this.typedArrayCreation({ arrayType: name, elementType: TYPED_ARRAYS[name], size: args[0] || null }, want);
      return { c: `js::unsupported(${u16Literal('new ' + name)})`, t: T.any };
    }

    // ---------------- built-in methods of values

    arrayMethod(o, method, args, node) {
      const et = o.t.e;
      const a = (i, t) => args[i] ? this.cv(this.expr(args[i], t), t) : null;
      const rt = this.type(node && (node.contextType || node.resultType));
      switch (method) {
        case 'push': {
          if (args.some(x => x.type === 'SpreadElement')) {
            const parts = args.map(x => x.type === 'SpreadElement' ? `${o.c}.pushAll(${this.cv(this.expr(x.argument, o.t), o.t)})` : `${o.c}.push(${this.cv(this.expr(x, et), et)})`);
            return { c: `(${parts.join(', ')}, ${o.c}.length())`, t: T.i32 };
          }
          return { c: `${o.c}.push(${args.map(x => this.cv(this.expr(x, et), et)).join(', ')})`, t: T.i32 };
        }
        case 'pop': return { c: `${o.c}.pop()`, t: et };
        case 'shift': return { c: `${o.c}.shift()`, t: et };
        case 'unshift': return { c: `${o.c}.unshift(${a(0, et)})`, t: T.i32 };
        case 'slice': return { c: `${o.c}.slice(${args.map(x => this.cv(this.expr(x), T.f64)).join(', ')})`, t: o.t };
        case 'subarray': return { c: `${o.c}.subarray(${args.map(x => this.cv(this.expr(x), T.f64)).join(', ')})`, t: o.t };
        case 'concat': return { c: `${o.c}.concat(${args.map(x => { const e = this.expr(x, o.t); return e.t.k === 'arr' ? this.cv(e, o.t) : this.cv(e, e.t.k === 'any' ? o.t : et); }).join(', ')})`, t: o.t };
        case 'fill': return { c: `${o.c}.fill(${a(0, et)}${args.slice(1).map(x => ', ' + this.cv(this.expr(x), T.f64)).join('')})`, t: o.t };
        case 'reverse': return { c: `${o.c}.reverse()`, t: o.t };
        case 'indexOf': return { c: `${o.c}.indexOf(${a(0, et)}${args[1] ? ', ' + a(1, T.f64) : ''})`, t: T.i32 };
        case 'lastIndexOf': return { c: `${o.c}.lastIndexOf(${a(0, et)})`, t: T.i32 };
        case 'includes': return { c: `${o.c}.includes(${a(0, et)})`, t: T.bool };
        case 'join': return { c: `${o.c}.join(${args[0] ? a(0, T.str) : ''})`, t: T.str };
        case 'set': return { c: `${o.c}.set(${this.expr(args[0], o.t).c}${args[1] ? ', ' + a(1, T.f64) : ''})`, t: T.void };
        case 'splice': {
          const items = args.slice(2).map(x => this.cv(this.expr(x, et), et));
          return { c: `${o.c}.splice(${args[0] ? a(0, T.f64) : '0'}${args.length > 1 ? ', ' + a(1, T.f64) : ''}${items.length ? `, std::vector<${this.cpp(et)}>{ ${items.join(', ')} }` : ''})`, t: o.t };
        }
        case 'sort': {
          if (!args[0]) return { c: `${o.c}.sort()`, t: o.t };
          const f = this.callbackFor(args[0], [et, et], T.f64);
          return { c: `${o.c}.sort(${f})`, t: o.t };
        }
        case 'map': {
          const outE = rt.k === 'arr' ? rt.e : T.any;
          const f = this.callbackFor(args[0], [et, T.i32], outE);
          return { c: `js::arrayMap<${this.cpp(outE)}>(${o.c}, ${f})`, t: T.arr(outE) };
        }
        case 'forEach': return { c: `js::arrayForEach(${o.c}, ${this.callbackFor(args[0], [et, T.i32], T.void)})`, t: T.void };
        case 'filter': return { c: `js::arrayFilter(${o.c}, ${this.callbackFor(args[0], [et, T.i32], T.bool)})`, t: o.t };
        case 'some': return { c: `js::arraySome(${o.c}, ${this.callbackFor(args[0], [et, T.i32], T.bool)})`, t: T.bool };
        case 'every': return { c: `js::arrayEvery(${o.c}, ${this.callbackFor(args[0], [et, T.i32], T.bool)})`, t: T.bool };
        case 'find': return { c: `js::arrayFind(${o.c}, ${this.callbackFor(args[0], [et, T.i32], T.bool)})`, t: et };
        case 'findIndex': return { c: `js::arrayFindIndex(${o.c}, ${this.callbackFor(args[0], [et, T.i32], T.bool)})`, t: T.i32 };
        case 'reduce': {
          const accT = args[1] ? this.expr(args[1]).t : et;
          const t = accT.k === 'null' || accT.k === 'undef' ? T.any : accT;
          const f = this.callbackFor(args[0], [t, et, T.i32], t);
          return { c: `js::arrayReduce<${this.cpp(t)}>(${o.c}, ${f}${args[1] ? ', ' + this.cv(this.expr(args[1]), t) : ''})`, t };
        }
        case 'toString': return { c: `${o.c}.join()`, t: T.str };
        case 'keys': return { c: `js::arrayKeys(${o.c}.length())`, t: T.arr(T.i32) };
        case 'at': return { c: `${o.c}.get(${a(0, T.i64)} < 0 ? ${o.c}.length() + ${a(0, T.i64)} : ${a(0, T.i64)})`, t: et };
      }
      return null;
    }

    /** A callback argument as a typed C++ lambda (params typed from the array) */
    callbackFor(node, paramTypes, ret) {
      if (node && (node.type === 'ArrowFunction' || node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression')) {
        const params = this.paramsOf(node).map((p, i) => Object.assign({}, p, { type: p.type.k !== 'any' ? p.type : (paramTypes[i] || T.any) }));
        const savedFn = this.fn;
        this.fn = { kind: 'lambda', ret, cls: savedFn ? savedFn.cls : null, thisType: savedFn ? savedFn.thisType : null, isStatic: savedFn && savedFn.isStatic };
        this.pushScope();
        for (const p of params) { const v = this.declare(p.name, p.type); v.cpp = p.cpp; }
        const body = this.functionBody(node.body);
        this.popScope();
        this.fn = savedFn;
        const list = paramTypes.map((t, i) => params[i] ? `${this.cpp(params[i].type)} ${params[i].cpp}` : `${this.cpp(t)}`).join(', ');
        return `[&](${list}) -> ${this.cpp(ret)} ${this.inlineBlock(body)}`;
      }
      // a function value: call it dynamically
      const f = this.expr(node);
      const fa = this.cv(f, T.any);
      const ps = paramTypes.map((t, i) => `${this.cpp(t)} __p${i}`).join(', ');
      const call = `${fa}.call({ ${paramTypes.map((t, i) => `js::Any(__p${i})`).join(', ')} })`;
      return `[&](${ps}) -> ${this.cpp(ret)} { ${ret.k === 'void' ? `${call};` : `return js::fromAny<${this.cpp(ret)}>(${call});`} }`;
    }

    stringMethod(o, method, args, node) {
      const a = (i, t) => args[i] ? this.cv(this.expr(args[i]), t) : null;
      switch (method) {
        case 'charCodeAt': return { c: `${o.c}.charCodeAt(${args[0] ? a(0, T.i64) : '0'})`, t: T.i32 };
        case 'codePointAt': return { c: `${o.c}.codePointAt(${a(0, T.i64)})`, t: T.i32 };
        case 'charAt': return { c: `${o.c}.charAt(${a(0, T.i64)})`, t: T.str };
        case 'at': return { c: `${o.c}.at(${a(0, T.i64)})`, t: T.str };
        case 'indexOf': return { c: `${o.c}.indexOf(${a(0, T.str)}${args[1] ? ', ' + a(1, T.i64) : ''})`, t: T.i32 };
        case 'lastIndexOf': return { c: `${o.c}.lastIndexOf(${a(0, T.str)}${args[1] ? ', ' + a(1, T.i64) : ''})`, t: T.i32 };
        case 'includes': return { c: `${o.c}.includes(${a(0, T.str)})`, t: T.bool };
        case 'startsWith': return { c: `${o.c}.startsWith(${a(0, T.str)})`, t: T.bool };
        case 'endsWith': return { c: `${o.c}.endsWith(${a(0, T.str)})`, t: T.bool };
        case 'substring': case 'substr': case 'slice': return { c: `${o.c}.${method}(${args.map(x => this.cv(this.expr(x), T.f64)).join(', ')})`, t: T.str };
        case 'toUpperCase': case 'toLowerCase': case 'trim': case 'trimStart': case 'trimEnd': case 'toLocaleUpperCase': case 'toLocaleLowerCase':
          return { c: `${o.c}.${method.replace('Locale', '').replace(/^toUpper/, 'toUpper').replace('toUpperCase', 'toUpperCase')}()`, t: T.str };
        case 'split': {
          if (args[0] && args[0].type === 'Literal' && args[0].regex) return { c: `js::regexSplit(${o.c}, ${u16Literal(args[0].regex.pattern)})`, t: T.arr(T.str) };
          return { c: args[0] ? `${o.c}.split(${a(0, T.str)})` : `${o.c}.split()`, t: T.arr(T.str) };
        }
        case 'repeat': return { c: `${o.c}.repeat(${a(0, T.f64)})`, t: T.str };
        case 'padStart': case 'padEnd': return { c: `${o.c}.${method}(${a(0, T.f64)}${args[1] ? ', ' + a(1, T.str) : ''})`, t: T.str };
        case 'concat': return { c: args.map(x => `js::str(${this.expr(x).c})`).reduce((acc, x) => `js::concat(${acc}, ${x})`, o.c), t: T.str };
        case 'replace': case 'replaceAll': {
          if (args[0] && args[0].type === 'Literal' && args[0].regex) return { c: `js::regexReplace(${o.c}, ${u16Literal(args[0].regex.pattern)}, ${u16Literal(args[0].regex.flags || '')}, ${a(1, T.str)})`, t: T.str };
          return { c: `${o.c}.${method === 'replace' ? 'replaceFirst' : 'replaceAll'}(${a(0, T.str)}, ${a(1, T.str)})`, t: T.str };
        }
        case 'toString': case 'valueOf': return o;
        case 'match': return { c: `js::regexMatch(${o.c}, ${args[0] && args[0].regex ? u16Literal(args[0].regex.pattern) : a(0, T.str)})`, t: T.any };
        case 'normalize': return o;
        case 'localeCompare': return { c: `js::localeCompare(${o.c}, ${a(0, T.str)})`, t: T.i32 };
      }
      void node;
      return null;
    }

    numberMethod(o, method, args, node) {
      switch (method) {
        case 'toString': {
          if (o.t.k === 'big') return { c: `js::String(js::fromUtf8(${o.c}.toStdString(${args[0] ? this.cv(this.expr(args[0]), T.i32) : '10'})))`, t: T.str };
          if (args[0]) return { c: `js::String(js::numberText(static_cast<double>(${o.c}), ${this.cv(this.expr(args[0]), T.i32)}))`, t: T.str };
          return { c: `js::str(${o.c})`, t: T.str };
        }
        case 'toFixed': return { c: `js::toFixed(static_cast<double>(${o.c}), ${args[0] ? this.cv(this.expr(args[0]), T.i32) : '0'})`, t: T.str };
        case 'valueOf': return o;
      }
      void node;
      return null;
    }

    collectionMethod(o, method, args) {
      const a = i => args[i] ? this.cv(this.expr(args[i]), T.any) : 'js::Any()';
      if (o.t.k === 'map') {
        switch (method) {
          case 'get': return { c: `${o.c}->get(${a(0)})`, t: T.any };
          case 'set': return { c: `${o.c}->set(${a(0)}, ${a(1)})`, t: T.map };
          case 'has': return { c: `${o.c}->has(${a(0)})`, t: T.bool };
          case 'delete': return { c: `${o.c}->remove(${a(0)})`, t: T.bool };
          case 'clear': return { c: `${o.c}->clear()`, t: T.void };
          case 'keys': return { c: `js::mapKeys(${o.c})`, t: T.arr(T.any) };
          case 'values': return { c: `js::mapValues(${o.c})`, t: T.arr(T.any) };
          case 'entries': return { c: `js::mapEntries(${o.c})`, t: T.arr(T.arr(T.any)) };
        }
      } else {
        switch (method) {
          case 'add': return { c: `${o.c}->add(${a(0)})`, t: T.set };
          case 'has': return { c: `${o.c}->has(${a(0)})`, t: T.bool };
          case 'delete': return { c: `${o.c}->remove(${a(0)})`, t: T.bool };
          case 'clear': return { c: `${o.c}->clear()`, t: T.void };
          case 'values': case 'keys': return { c: `js::setValues(${o.c})`, t: T.arr(T.any) };
        }
      }
      return null;
    }

    dataViewMethod(o, method, args) {
      const m = method.match(/^(get|set)(Uint|Int|Float|BigUint|BigInt)(8|16|32|64)$/);
      if (!m) return null;
      const bytes = Number(m[3]) / 8;
      const at = this.cv(this.expr(args[0]), T.i64);
      if (m[1] === 'get') {
        const little = args[1] ? this.cv(this.expr(args[1]), T.bool) : 'false';
        const raw = `${o.c}->read(${at}, ${bytes}, ${little})`;
        const t = m[2] === 'Float' ? T.f64 : m[2].startsWith('Big') ? T.int(64, m[2] === 'BigInt') : T.int(Number(m[3]), m[2] === 'Int');
        if (m[2] === 'Float') return { c: bytes === 4 ? `js::bitsToFloat(static_cast<uint32_t>(${raw}))` : `js::bitsToDouble(${raw})`, t };
        return { c: `static_cast<${this.cpp(t)}>(${raw})`, t };
      }
      const little = args[2] ? this.cv(this.expr(args[2]), T.bool) : 'false';
      let v;
      if (m[2] === 'Float') v = bytes === 4 ? `js::floatToBits(static_cast<float>(${this.cv(this.expr(args[1]), T.f64)}))` : `js::doubleToBits(${this.cv(this.expr(args[1]), T.f64)})`;
      else v = `static_cast<uint64_t>(${this.cv(this.expr(args[1]), m[2].startsWith('Big') ? T.u64 : T.i64)})`;
      return { c: `${o.c}->write(${at}, ${bytes}, ${v}, ${little})`, t: T.void };
    }

    // ---------------- IL nodes

    ilNode(node, want) {
      const rt = this.type(node.resultType);
      const ctx = this.type(node.contextType || node.resultType);
      const arg0 = () => this.expr((node.arguments && node.arguments[0]) || node.argument || node.value);
      switch (node.type) {
        case 'ArrayLength': {
          const a = this.expr(node.array);
          if (a.t.k === 'arr' || a.t.k === 'str') return { c: `${a.c}.length()`, t: T.i32 };
          return { c: `${this.cv(a, T.any)}.length()`, t: T.i32 };
        }
        case 'ArrayAppend': {
          const a = this.expr(node.array);
          const values = (node.values && node.values.length ? node.values : [node.value]).filter(Boolean);
          if (a.t.k !== 'arr') return { c: `${this.cv(a, T.any)}.callMethod(u"push", { ${values.map(v => this.cv(this.expr(v.type === 'SpreadElement' ? v.argument : v), T.any)).join(', ')} })`, t: T.any };
          return this.arrayMethod(a, 'push', values, node);
        }
        case 'ArraySlice': {
          const a = this.expr(node.array);
          const t = a.t.k === 'arr' ? a.t : (ctx.k === 'arr' ? ctx : T.arr(T.any));
          const args = [node.start, node.end].filter(x => x !== undefined && x !== null).map(x => this.cv(this.expr(x), T.f64));
          if (a.t.k === 'str') return { c: `${a.c}.slice(${args.join(', ')})`, t: T.str };
          return { c: `${this.cv(a, t)}.slice(${args.join(', ')})`, t };
        }
        case 'ArrayCreation': {
          const et = this.elementTypeFor(node, want);
          if (!node.size) return { c: `js::Array<${this.cpp(et)}>::create(0)`, t: T.arr(et) };
          return { c: `js::Array<${this.cpp(et)}>::create(${this.cv(this.expr(node.size), T.i64)})`, t: T.arr(et) };
        }
        case 'TypedArrayCreation': return this.typedArrayCreation(node, want);
        case 'ArrayFill': {
          const a = this.expr(node.array, ctx.k === 'arr' ? ctx : null);
          if (a.t.k !== 'arr') return { c: `${this.cv(a, T.any)}.callMethod(u"fill", { ${this.cv(this.expr(node.value), T.any)} })`, t: T.any };
          const args = [node.value].map(v => this.cv(this.expr(v, a.t.e), a.t.e));
          for (const x of [node.start, node.end]) if (x !== undefined && x !== null) args.push(this.cv(this.expr(x), T.f64));
          return { c: `${a.c}.fill(${args.join(', ')})`, t: a.t };
        }
        case 'ArrayClear': {
          const a = this.expr(node.array || (node.arguments && node.arguments[0]));
          return { c: a.t.k === 'arr' ? `js::clearArray(${a.c})` : `js::clearAny(${this.cv(a, T.any)})`, t: T.void };
        }
        case 'ArrayConcat': {
          const a = this.expr(node.array, ctx.k === 'arr' ? ctx : null);
          if (a.t.k !== 'arr') return { c: `${this.cv(a, T.any)}.callMethod(u"concat", { ${(node.arrays || []).map(x => this.cv(this.expr(x), T.any)).join(', ')} })`, t: T.any };
          return this.arrayMethod(a, 'concat', node.arrays || [], node);
        }
        case 'ArrayIndexOf': case 'ArrayIncludes': {
          const a = this.expr(node.array);
          if (a.t.k === 'str') return this.stringMethod(a, node.type === 'ArrayIndexOf' ? 'indexOf' : 'includes', [node.value], node);
          if (a.t.k !== 'arr') return { c: `${this.cv(a, T.any)}.callMethod(${node.type === 'ArrayIndexOf' ? 'u"indexOf"' : 'u"includes"'}, { ${this.cv(this.expr(node.value), T.any)} })`, t: T.any };
          return this.arrayMethod(a, node.type === 'ArrayIndexOf' ? 'indexOf' : 'includes', [node.value].concat(node.fromIndex ? [node.fromIndex] : []), node);
        }
        case 'ArrayReverse': case 'ArrayPop': case 'ArrayShift': {
          const a = this.expr(node.array);
          const m = { ArrayReverse: 'reverse', ArrayPop: 'pop', ArrayShift: 'shift' }[node.type];
          if (a.t.k !== 'arr') return { c: `${this.cv(a, T.any)}.callMethod(${u16Literal(m)}, {})`, t: T.any };
          return this.arrayMethod(a, m, [], node);
        }
        case 'ArrayUnshift': {
          const a = this.expr(node.array);
          if (a.t.k !== 'arr') return { c: `${this.cv(a, T.any)}.callMethod(u"unshift", { ${this.cv(this.expr(node.value), T.any)} })`, t: T.any };
          return this.arrayMethod(a, 'unshift', [node.value], node);
        }
        case 'ArraySplice': {
          const a = this.expr(node.array);
          const args = [node.start || { type: 'Literal', value: 0, resultType: 'int32' }];
          if (node.deleteCount) args.push(node.deleteCount);
          if (node.items && node.items.length) { if (!node.deleteCount) args.push({ type: 'Literal', value: 0, resultType: 'int32' }); args.push(...node.items); }
          if (a.t.k !== 'arr') return { c: `${this.cv(a, T.any)}.callMethod(u"splice", { ${args.map(x => this.cv(this.expr(x), T.any)).join(', ')} })`, t: T.any };
          return this.arrayMethod(a, 'splice', args, node);
        }
        case 'ArrayJoin': {
          const a = this.expr(node.array);
          if (a.t.k !== 'arr') return { c: `js::fromAny<js::String>(${this.cv(a, T.any)}.callMethod(u"join", { ${node.separator ? this.cv(this.expr(node.separator), T.any) : ''} }))`, t: T.str };
          return this.arrayMethod(a, 'join', node.separator ? [node.separator] : [], node);
        }
        case 'ArraySort': {
          const a = this.expr(node.array);
          if (a.t.k !== 'arr') return { c: 'js::unsupported(u"sort of a dynamic value")', t: T.any };
          return this.arrayMethod(a, 'sort', node.compareFn ? [node.compareFn] : [], node);
        }
        case 'ArrayMap': case 'ArrayForEach': case 'ArrayFilter': case 'ArraySome': case 'ArrayEvery': case 'ArrayFind': case 'ArrayReduce': case 'ArrayFindIndex': {
          const a = this.expr(node.array);
          const m = { ArrayMap: 'map', ArrayForEach: 'forEach', ArrayFilter: 'filter', ArraySome: 'some', ArrayEvery: 'every', ArrayFind: 'find', ArrayReduce: 'reduce', ArrayFindIndex: 'findIndex' }[node.type];
          const args = [node.callback].concat(node.initialValue ? [node.initialValue] : []);
          if (a.t.k === 'arr') return this.arrayMethod(a, m, args, node);
          if (a.t.k === 'str' && m === 'map') return this.arrayMethod({ c: `${a.c}.split(js::String(u""))`, t: T.arr(T.str) }, m, args, node);
          return { c: `js::unsupported(${u16Literal(m + ' of a dynamic value')})`, t: T.any };
        }
        case 'ArrayFrom': return this.arrayFrom(node, ctx);
        case 'ArrayXor': {
          const args = node.arguments || [node.array1, node.array2];
          const a = this.expr(args[0]), b = this.expr(args[1]);
          const arr = x => x.t.k === 'arr' ? x.c : `js::fromAny<js::Array<uint8_t>>(${this.cv(x, T.any)})`;
          return { c: `js::xorArrays(${arr(a)}, ${arr(b)})`, t: T.arr(T.u8) };
        }
        case 'TypedArraySet': {
          const a = this.expr(node.array);
          const src = this.expr(node.source, a.t);
          if (a.t.k !== 'arr') return { c: `js::unsupported(u"set on a dynamic value")`, t: T.void };
          const s = src.t.k === 'arr' ? src.c : `js::fromAny<${this.cpp(a.t)}>(${this.cv(src, T.any)})`;
          return { c: `${a.c}.set(${s}${node.offset ? ', ' + this.cv(this.expr(node.offset), T.f64) : ''})`, t: T.void };
        }
        case 'TypedArraySubarray': {
          const a = this.expr(node.array);
          const args = [node.begin, node.end].filter(x => x !== undefined && x !== null).map(x => this.cv(this.expr(x), T.f64));
          if (a.t.k !== 'arr') return { c: `js::unsupported(u"subarray of a dynamic value")`, t: T.any };
          return { c: `${a.c}.subarray(${args.join(', ')})`, t: a.t };
        }
        case 'ArrayLiteral': return this.arrayLiteral(node, want);
        case 'HexDecode': return { c: `js::hexToBytes(${this.cv(arg0(), T.str)})`, t: T.arr(T.u8) };
        case 'HexEncode': {
          const a = arg0();
          return { c: `js::bytesToHex(${a.t.k === 'arr' ? a.c : `js::fromAny<js::Array<uint8_t>>(${this.cv(a, T.any)})`})`, t: T.str };
        }
        case 'StringToBytes': return { c: `js::stringToBytes(${this.cv(arg0(), T.str)}, ${this.byteMask(node)})`, t: T.arr(T.u8) };
        case 'BytesToString': {
          const a = arg0();
          return { c: `js::bytesToString(${a.t.k === 'arr' ? a.c : `js::fromAny<js::Array<uint8_t>>(${this.cv(a, T.any)})`}, ${this.byteMask(node)})`, t: T.str };
        }
        case 'PackBytes': {
          const args = (node.arguments || []);
          let items = args.map(x => this.expr(x));
          if (items.length === 1 && items[0].t.k === 'arr') {
            const n = node.bits / 8;
            const tmpName = this.tmp('pk');
            const parts = Array.from({ length: n }, (_, i) => `js::u32(${tmpName}.get(${i}))`);
            const inner = node.bits === 64 ? `js::pack64(${parts.map(p => `(uint64_t)${p}`).join(', ')})` : node.bits === 16 ? `js::pack16(${parts.join(', ')})` : `js::pack32(${parts.join(', ')})`;
            return { c: `({ auto ${tmpName} = ${items[0].c}; ${inner}; })`, t: node.bits === 64 ? T.u64 : node.bits === 16 ? T.u32 : T.u32 };
          }
          const big = node.endian === 'big';
          if (!big) items = items.slice().reverse();
          if (node.bits === 16) return { c: `js::pack16(${items.map(x => `js::u32(${x.c})`).join(', ')})`, t: T.u32 };
          if (node.bits === 64) return { c: `js::pack64(${items.map(x => `static_cast<uint64_t>(js::u32(${x.c}))`).join(', ')})`, t: T.u64 };
          return { c: `js::pack32(${items.map(x => `js::u32(${x.c})`).join(', ')})`, t: T.u32 };
        }
        case 'UnpackBytes': {
          const v = arg0();
          const bytes = (node.bits || 32) / 8;
          let val;
          if (bytes === 8) val = v.t.k === 'big' ? `${v.c}.lowU64()` : isFloat(v.t) ? `js::d2u64(${v.c})` : v.t.k === 'any' ? `js::fromAny<uint64_t>(${v.c})` : `static_cast<uint64_t>(${v.c})`;
          else val = `static_cast<uint64_t>(js::u32(${v.c}))`;
          return { c: `js::unpack(${val}, ${bytes}, ${node.endian === 'big' ? 'true' : 'false'})`, t: T.arr(T.u8) };
        }
        case 'RotateLeft': case 'RotateRight': case 'Rotation': {
          const left = node.type === 'RotateLeft' || (node.type === 'Rotation' && node.direction !== 'right');
          const v = this.expr(node.value || (node.arguments && node.arguments[0]));
          const amt = this.expr(node.amount || (node.arguments && node.arguments[1]));
          const bits = node.bits || 32;
          if (bits === 64 && v.t.k === 'big') return { c: `js::${left ? 'rotlBig' : 'rotrBig'}(${v.c}, ${this.cv(amt, T.i64)}, 64)`, t: T.big };
          const t = bits === 64 ? T.u64 : T.u32;
          const val = bits === 64 ? this.cv(v, T.u64) : `js::u32(${v.c})`;
          return { c: `js::${left ? 'rotl' : 'rotr'}<${this.cpp(t)}>(${val}, ${this.cv(amt, T.i64)}, ${bits})`, t };
        }
        case 'Cast': return this.castNode(node);
        case 'BigIntCast': {
          const a = this.expr(node.argument || node.value);
          return { c: this.cv(a, T.big), t: T.big };
        }
        case 'OpCodesCall': return this.opcodesCall(node.method, node.arguments || [], node);
        case 'Floor': case 'Ceil': case 'Round': case 'Truncate': case 'Trunc': case 'Abs': case 'Sqrt': case 'Log': case 'Log2': case 'Log10': case 'Exp':
        case 'Sin': case 'Cos': case 'Tan': case 'Tanh': case 'Sign': case 'Cbrt': case 'Asin': case 'Acos': case 'Atan': case 'Sinh': case 'Cosh': case 'Fround': {
          const m = node.type === 'Truncate' ? 'trunc' : node.type.toLowerCase();
          return this.mathCall(m, [node.argument || (node.arguments && node.arguments[0]) || node.value], node);
        }
        case 'Min': case 'Max': return this.mathCall(node.type.toLowerCase(), node.arguments || [], node);
        case 'Power': {
          const b = this.expr(node.base || node.arguments[0]), e = this.expr(node.exponent || node.arguments[1]);
          if (b.t.k === 'big' || e.t.k === 'big') return { c: `js::bpow(${this.cv(b, T.big)}, ${this.cv(e, T.big)})`, t: T.big };
          return { c: `std::pow(${this.cv(b, T.f64)}, ${this.cv(e, T.f64)})`, t: T.f64 };
        }
        case 'MathCall': return this.mathCall(node.method, node.arguments || [], node) || { c: `js::unsupported(${u16Literal('Math.' + node.method)})`, t: T.f64 };
        case 'MathConstant': return { c: `(${Number(node.value).toPrecision(17)})`, t: T.f64 };
        case 'NumberConstant': {
          const v = node.value;
          if (typeof v === 'number' && !Number.isFinite(v)) return { c: Number.isNaN(v) ? 'NAN' : v > 0 ? 'INFINITY' : '(-INFINITY)', t: T.f64 };
          return this.staticMember('Number', node.name, node) || { c: String(v), t: T.f64 };
        }
        case 'Random': return { c: 'js::Math::random()', t: T.f64 };
        case 'CountLeadingZeros': return { c: `js::Math::clz32(js::u32(${arg0().c}))`, t: T.i32 };
        case 'ErrorCreation': {
          const msg = node.message ? this.cv(this.expr(node.message), T.str) : 'js::String(u"")';
          return { c: `js::newError(${u16Literal(node.errorType || 'Error')}, ${msg})`, t: T.cls('Error', true) };
        }
        case 'IsArrayCheck': {
          const a = this.expr(node.value || node.argument);
          return { c: a.t.k === 'arr' ? `js::truthyRef(${a.c})` : a.t.k === 'any' ? `(${a.c}.tag == js::Tag::Arr)` : 'false', t: T.bool };
        }
        case 'IsIntegerCheck': {
          const a = this.expr(node.value || node.argument);
          return { c: isInt(a.t) ? '((void)0, true)' : `js::isInteger(${this.cv(a, T.f64)})`, t: T.bool };
        }
        case 'IsNaNCheck': return { c: `std::isnan(${this.cv(this.expr(node.value || node.argument), T.f64)})`, t: T.bool };
        case 'IsFiniteCheck': return { c: `std::isfinite(${this.cv(this.expr(node.value || node.argument), T.f64)})`, t: T.bool };
        case 'StringFromCharCodes': {
          const codes = node.charCodes || node.arguments || [];
          if (codes.length === 1 && codes[0].type === 'SpreadElement') {
            const a = this.expr(codes[0].argument);
            return { c: `js::fromCharCodes(${a.t.k === 'arr' ? a.c : `js::fromAny<js::Array<int32_t>>(${this.cv(a, T.any)})`})`, t: T.str };
          }
          return { c: `js::fromCharCode(${codes.map(x => `js::i32(${this.expr(x).c})`).join(', ')})`, t: T.str };
        }
        case 'StringFromCodePoints': return { c: `js::fromCodePoint(js::u32(${this.expr((node.codePoints || node.arguments)[0]).c}))`, t: T.str };
        case 'StringCharCodeAt': {
          const s = this.expr(node.string || node.value);
          return { c: `${this.cv(s, T.str)}.charCodeAt(${node.index ? this.cv(this.expr(node.index), T.i64) : '0'})`, t: T.i32 };
        }
        case 'StringCharAt': {
          const s = this.expr(node.string || node.value);
          return { c: `${this.cv(s, T.str)}.charAt(${node.index ? this.cv(this.expr(node.index), T.i64) : '0'})`, t: T.str };
        }
        case 'StringTransform': {
          const s = this.expr(node.string || node.value);
          if (s.t.k === 'str' || s.t.k === 'any') {
            const r = this.stringMethod({ c: this.cv(s, T.str), t: T.str }, node.method || 'toString', node.arguments || [], node);
            if (r) return r;
          }
          return this.methodCall(s, node.method, node.arguments || [], node);
        }
        case 'StringSubstring': {
          const s = this.cv(this.expr(node.string || node.value), T.str);
          const start = node.start ? this.cv(this.expr(node.start), T.f64) : '0';
          if (node.length) return { c: `${s}.substr(${start}, ${this.cv(this.expr(node.length), T.f64)})`, t: T.str };
          return { c: `${s}.slice(${start}${node.end ? ', ' + this.cv(this.expr(node.end), T.f64) : ''})`, t: T.str };
        }
        case 'StringIndexOf': {
          const s = { c: this.cv(this.expr(node.string || node.value), T.str), t: T.str };
          return this.stringMethod(s, node.method === 'lastIndexOf' ? 'lastIndexOf' : 'indexOf', [node.searchValue].concat(node.fromIndex ? [node.fromIndex] : []), node);
        }
        case 'StringLength': return { c: `${this.cv(this.expr(node.string || node.value), T.str)}.length()`, t: T.i32 };
        case 'StringSplit': {
          const s = { c: this.cv(this.expr(node.string || node.value), T.str), t: T.str };
          return this.stringMethod(s, 'split', node.separator ? [node.separator] : [], node);
        }
        case 'StringRepeat': return { c: `${this.cv(this.expr(node.string || node.value), T.str)}.repeat(${this.cv(this.expr(node.count), T.f64)})`, t: T.str };
        case 'StringReplace': {
          const s = { c: this.cv(this.expr(node.string || node.value), T.str), t: T.str };
          return this.stringMethod(s, node.method === 'replaceAll' ? 'replaceAll' : 'replace', [node.searchValue, node.replaceValue], node);
        }
        case 'StringIncludes': case 'StringStartsWith': case 'StringEndsWith': {
          const s = { c: this.cv(this.expr(node.string || node.value), T.str), t: T.str };
          const m = node.method || { StringIncludes: 'includes', StringStartsWith: 'startsWith', StringEndsWith: 'endsWith' }[node.type];
          return this.stringMethod(s, m, [node.searchValue || node.search || (node.arguments && node.arguments[0])], node);
        }
        case 'StringTrim': return { c: `${this.cv(this.expr(node.string || node.value), T.str)}.trim()`, t: T.str };
        case 'StringPad': case 'StringPadStart': case 'StringPadEnd': {
          const s = { c: this.cv(this.expr(node.string || node.value), T.str), t: T.str };
          const m = node.method || (node.type === 'StringPadEnd' ? 'padEnd' : 'padStart');
          return this.stringMethod(s, m, [node.targetLength].concat(node.padString ? [node.padString] : []), node);
        }
        case 'DebugOutput': return { c: `js::debugOutput({ ${(node.arguments || []).map(a => this.cv(this.expr(a), T.any)).join(', ')} })`, t: T.void };
        case 'ObjectFreeze': case 'ObjectSeal': {
          const a = this.expr(node.object || node.argument, want);
          return a.t.k === 'any' ? { c: `js::freeze(${a.c})`, t: T.any } : a;
        }
        case 'ObjectKeys': return { c: `js::keysOf(${this.cv(this.expr(node.object || node.argument), T.any)})`, t: T.arr(T.str) };
        case 'ObjectValues': return { c: `js::valuesOf(${this.cv(this.expr(node.object || node.argument), T.any)})`, t: T.arr(T.any) };
        case 'ObjectEntries': return { c: `js::entriesOf(${this.cv(this.expr(node.object || node.argument), T.any)})`, t: T.arr(T.arr(T.any)) };
        case 'MapCreation': return { c: `js::newMap(${node.entries ? this.cv(this.expr(node.entries), T.any) : 'js::Any()'})`, t: T.map };
        case 'SetCreation': return { c: `js::newSet(${node.values ? this.cv(this.expr(node.values), T.any) : 'js::Any()'})`, t: T.set };
        case 'BufferCreation': return { c: `js::Array<uint8_t>::create(${this.cv(this.expr(node.size), T.i64)}, true)`, t: T.arr(T.u8) };
        case 'DataViewCreation': {
          const b = this.expr(node.buffer);
          const buf = b.t.k === 'arr' ? `js::arrayAs<uint8_t>(${b.c})` : `js::fromAny<js::Array<uint8_t>>(${this.cv(b, T.any)})`;
          return { c: `new js::DataView(${buf}${node.byteOffset ? ', ' + this.cv(this.expr(node.byteOffset), T.i32) : ''}${node.byteLength ? ', ' + this.cv(this.expr(node.byteLength), T.i32) : ''})`, t: T.dataview };
        }
        case 'DataViewRead': case 'DataViewWrite': {
          const v = this.expr(node.view);
          const kind = (node.method || '').replace(/^(get|set)/, '');
          const args = node.type === 'DataViewRead' ? [node.offset, node.littleEndian] : [node.offset, node.value, node.littleEndian];
          const fakeArgs = args.map(a => (a === undefined || a === null) ? { type: 'Literal', value: false, resultType: 'boolean' } : (typeof a === 'boolean' ? { type: 'Literal', value: a, resultType: 'boolean' } : a));
          return this.dataViewMethod(v.t.k === 'dataview' ? v : { c: `js::fromAny<js::DataView*>(${this.cv(v, T.any)})`, t: T.dataview }, (node.type === 'DataViewRead' ? 'get' : 'set') + kind, fakeArgs) || { c: 'js::unsupported(u"DataView")', t: T.any };
        }
        case 'DataViewGetByteLength': return { c: `${this.expr(node.view).c}->length`, t: T.i32 };
        case 'TypeOfExpression': return this.typeOf(node);
        case 'InstanceOfCheck': return this.instanceOf({ left: node.value || node.left, right: node.className ? { name: node.className } : node.right });
        case 'MapGet': return this.collectionMethod(this.mapOf(node.map), 'get', [node.key]);
        case 'MapSet': return this.collectionMethod(this.mapOf(node.map), 'set', [node.key, node.value]);
        case 'MapHas': return this.collectionMethod(this.mapOf(node.map), 'has', [node.key]);
        case 'MapDelete': return this.collectionMethod(this.mapOf(node.map), 'delete', [node.key]);
        case 'ParseInteger': return { c: `js::parseInt(${this.cv(this.expr(node.string || node.value || node.arguments[0]), T.str)}${node.radix ? ', ' + this.cv(this.expr(node.radix), T.i32) : ''})`, t: T.f64 };
        case 'ParseFloat': return { c: `js::parseFloat(${this.cv(this.expr(node.string || node.value || node.arguments[0]), T.str)})`, t: T.f64 };
        case 'JsonSerialize': return { c: `js::jsonStringify(${this.cv(this.expr(node.value || node.arguments[0]), T.any)})`, t: T.str };
        case 'ObjectHasProperty': return { c: `js::hasProperty(${this.cv(this.expr(node.object), T.any)}, ${this.cv(this.expr(node.property || node.key), T.str)})`, t: T.bool };
        case 'ChainExpression': return this.expr(node.expression, want);
      }
      return { c: `js::unsupported(${u16Literal('node ' + node.type)})`, t: rt.k === 'void' ? T.any : T.any };
    }

    /** The character mask of an OpCodes string/byte conversion: 0x7F (Ansi), 0xFF (Ascii), 0 for UTF-8 */
    byteMask(node) {
      const m = node.opCodesMethod || '';
      if (/Ansi/.test(m)) return '0x7F';
      if (/Utf8/.test(m) || node.encoding === 'utf8') return '0';
      return '0xFF';
    }

    mapOf(n) {
      const m = this.expr(n);
      return m.t.k === 'map' ? m : { c: `js::fromAny<js::Map*>(${this.cv(m, T.any)})`, t: T.map };
    }

    castNode(node) {
      const a = this.expr((node.arguments && node.arguments[0]) || node.expression || node.value);
      const target = node.targetType;
      switch (target) {
        case 'uint8': case 'byte': return { c: `static_cast<uint8_t>(js::u32(${a.c}))`, t: T.int(8, false) };
        case 'uint16': return { c: `static_cast<uint16_t>(js::u32(${a.c}))`, t: T.int(16, false) };
        case 'uint32': case 'dword': return { c: `js::u32(${a.c})`, t: T.u32 };
        case 'int32': case 'int': return { c: `js::i32(${a.c})`, t: T.i32 };
        case 'int8': return { c: `static_cast<int8_t>(js::u32(${a.c}))`, t: T.int(8, true) };
        case 'int16': return { c: `static_cast<int16_t>(js::u32(${a.c}))`, t: T.int(16, true) };
        case 'uint64': {
          if (a.t.k === 'big') return { c: `${a.c}.lowU64()`, t: T.u64 };
          return { c: this.cv(a, T.u64), t: T.u64 };
        }
        case 'float': case 'float32': return { c: this.cv(a, T.f32), t: T.f32 };
        case 'double': case 'float64': return { c: this.cv(a, T.f64), t: T.f64 };
        case 'boolean': return { c: this.cv(a, T.bool), t: T.bool };
        case 'string': return { c: `js::str(${a.c})`, t: T.str };
      }
      return a;
    }

    typedArrayCreation(node, want) {
      const et = this.type(node.elementType || TYPED_ARRAYS[node.arrayType] || 'uint8');
      const at = T.arr(et);
      const ce = this.cpp(et);
      const src = node.buffer || node.size;
      if (!src) return { c: `js::Array<${ce}>::create(0, true)`, t: at };
      const s = this.expr(src);
      if (isNumOrBool(s.t)) return { c: `js::Array<${ce}>::create(${this.cv(s, T.i64)}, true)`, t: at };
      if (s.t.k === 'arr') return { c: `js::typedCopy<${ce}>(${s.c})`, t: at };
      if (s.t.k === 'any') return { c: `js::typedFrom<${ce}>(${s.c})`, t: at };
      void want;
      return { c: `js::typedFrom<${ce}>(${this.cv(s, T.any)})`, t: at };
    }

    arrayFrom(node, ctx) {
      const src = node.iterable ? this.expr(node.iterable) : null;
      const outT = ctx && ctx.k === 'arr' ? ctx : (src && src.t.k === 'arr' && !node.mapFunction ? src.t : T.arr(T.any));
      const et = outT.e;
      if (!src) return { c: `js::Array<${this.cpp(et)}>::create(0)`, t: outT };
      if (node.mapFunction) {
        // Array.from({length: n}, (_, i) => ...) and Array.from(arr, fn)
        const isLengthObject = node.iterable && node.iterable.type === 'ObjectLiteral';
        if (isLengthObject) {
          const lenProp = (node.iterable.properties || []).find(p => propKeyName(p.key) === 'length');
          const len = lenProp ? this.cv(this.expr(lenProp.value), T.i64) : '0';
          const f = this.callbackFor(node.mapFunction, [T.any, T.i32], et);
          return { c: `js::arrayGenerate<${this.cpp(et)}>(${len}, ${f})`, t: outT };
        }
        const srcArr = src.t.k === 'arr' ? src : { c: `js::fromAny<js::Array<js::Any>>(${this.cv(src, T.any)})`, t: T.arr(T.any) };
        const f = this.callbackFor(node.mapFunction, [srcArr.t.e, T.i32], et);
        return { c: `js::arrayMap<${this.cpp(et)}>(${srcArr.c}, ${f})`, t: outT };
      }
      if (src.t.k === 'arr') return { c: `js::arrayCopy<${this.cpp(et)}>(${src.c})`, t: outT };
      if (src.t.k === 'str') return { c: `js::arrayAs<${this.cpp(et)}>(${src.c}.split(js::String(u"")))`, t: outT };
      if (src.t.k === 'set') return { c: `js::arrayAs<${this.cpp(et)}>(js::setValues(${src.c}))`, t: outT };
      if (src.t.k === 'map') return { c: `js::arrayAs<${this.cpp(et)}>(js::mapEntries(${src.c}))`, t: outT };
      return { c: `js::arrayFromAny<${this.cpp(et)}>(${this.cv(src, T.any)})`, t: outT };
    }
  }

  /** The sites to trace (JS_CPP_TRACE names a JSON file: { className, sites: ['start:end', ...] }) */
  CppTransformer.traceSitesFor = function (className) {
    if (typeof process === 'undefined' || !process.env || !process.env.JS_CPP_TRACE || typeof require === 'undefined') return null;
    try {
      const cfg = JSON.parse(require('fs').readFileSync(process.env.JS_CPP_TRACE, 'utf8'));
      return cfg.className === className ? new Set(cfg.sites) : null;
    } catch (e) { return null; }
  };

  function propKeyName(k) { return typeof k === 'string' || typeof k === 'number' ? String(k) : k ? (k.name !== undefined ? k.name : k.value) : undefined; }

  function NULLABLE_VALUE(name) { return /^(u?int(8|16|32|64)|float(32|64)|bigint|BigInt|boolean|number|int|byte|word|dword|qword)$/.test(name); }

  function splitTop(text, sep) {
    const parts = [];
    let depth = 0, start = 0;
    for (let i = 0; i < text.length; ++i) {
      const c = text[i];
      if ('<([{'.includes(c)) ++depth;
      else if ('>)]}'.includes(c)) --depth;
      else if (c === sep && depth === 0) { parts.push(text.slice(start, i)); start = i + 1; }
    }
    parts.push(text.slice(start));
    return parts;
  }

  const exports = { CppTransformer, cppIdent, u16Literal };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.CppTransformer = CppTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
