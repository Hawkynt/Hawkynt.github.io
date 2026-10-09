/**
 * RubyTransformer.js - IL AST to Ruby AST Transformer
 * Converts the typed IL AST into a Ruby AST with JavaScript semantics.
 * (c)2006-2025 Hawkynt
 *
 * Full Pipeline:
 *   JS Source -> Parser -> JS AST -> IL Transformer -> IL AST -> Ruby Transformer -> Ruby AST -> Ruby Emitter -> Ruby Source
 *
 * How JavaScript maps onto Ruby:
 *   - Numbers are Ruby Integers wherever the IL types a value as an integer;
 *     Ruby integers are unbounded, so fixed-width arithmetic is masked exactly
 *     where the IL type says so (the bit operators and the width casts).
 *     Values the IL types float64 may be Floats.
 *   - The file becomes a Ruby module; module-level variables and functions are
 *     global variables (functions as lambdas), so methods can reach them.
 *   - Classes keep their JavaScript member names (Feed, Result, key=); a
 *     property is an instance variable of its name unless an accessor
 *     (get/set) of that name exists, in which case it goes through the method.
 *   - Object literals are JSObject, typed arrays JSTypedArray, Map/Set
 *     JSMap/JSSet; the runtime prelude (RUBY_RUNTIME) supplies them, the
 *     JavaScript operators whose meaning differs from Ruby's (truthiness,
 *     division, string concatenation), AlgorithmFramework and the OpCodes
 *     helpers the IL leaves as calls.
 *
 * Options:
 *   - addComments: emit the file's doc comment (default true)
 *   - useFrozenStringLiteral: add the frozen_string_literal magic comment (default true)
 *   - generateTestHarness / embedRuntime: include the runtime prelude (default true)
 *   - className: names the module the file is wrapped in and prefixes its globals
 */

(function(global) {
  'use strict';

  let RubyAST;
  if (typeof require !== 'undefined') {
    RubyAST = require('./RubyAST.js');
  } else if (global.RubyAST) {
    RubyAST = global.RubyAST;
  }

  const {
    RubyModule, RubyMagicComment, RubyDocComment, RubyModuleDef, RubyClass, RubyAttribute,
    RubyMethod, RubyParameter,
    RubyBlock, RubyExpressionStatement, RubyComment, RubyReturn, RubyBreak, RubyNext, RubyRaise,
    RubyIf, RubyWhile, RubyFor, RubyCase, RubyWhen, RubyBegin, RubyRescue, RubyRawCode,
    RubyLiteral, RubyIdentifier, RubyBinaryExpression, RubyUnaryExpression, RubyMethodCall, RubyIndex,
    RubyAssignment, RubyMultipleAssignment, RubyArrayLiteral, RubyHashLiteral, RubyLambda,
    RubyConditional, RubySplat, RubySequence, RubySuper, RubyRawExpression
  } = RubyAST;

  // ========================[ NAMES ]========================

  const RUBY_KEYWORDS = new Set([
    'BEGIN', 'END', 'alias', 'and', 'begin', 'break', 'case', 'class', 'def', 'defined', 'do', 'else', 'elsif',
    'end', 'ensure', 'false', 'for', 'if', 'in', 'module', 'next', 'nil', 'not', 'or', 'redo', 'rescue',
    'retry', 'return', 'self', 'super', 'then', 'true', 'undef', 'unless', 'until', 'when', 'while', 'yield',
    '__FILE__', '__LINE__', '__ENCODING__', '__method__', '__dir__',
    // Kernel methods the emitted code calls without a receiver
    'raise', 'lambda', 'proc', 'loop', 'catch', 'throw', 'puts', 'print', 'p', 'format', 'rand', 'require',
    'block_given', 'binding', 'method', 'send', 'sleep', 'exit', 'abort', 'fail', 'gets', 'open', 'select',
    'srand', 'sprintf', 'printf', 'putc', 'warn', 'eval', 'exec', 'fork', 'system', 'trap', 'test',
    'Integer', 'Float', 'String', 'Array', 'Hash', 'Rational', 'Complex'
  ]);

  // JavaScript property names whose Ruby method of the same name means something else (see JS.mangle)
  const MANGLED_MEMBERS = new Set(['class', 'send', '__send__', 'object_id', 'method', 'methods', 'initialize',
    'freeze', 'frozen', 'dup', 'clone', 'inspect', 'to_s', 'extend', 'instance_variables', 'singleton_class',
    'define_singleton_method', 'public_send', 'hash', 'then', 'tap', 'display', 'itself', 'instance_variable_get',
    'instance_variable_set', 'respond_to_missing', 'method_missing', 'to_a', 'to_ary', 'to_str', 'to_proc', 'to_h',
    'to_hash', 'to_int', 'to_i', 'to_f', 'coerce', 'equal', 'eql', 'instance_of', 'kind_of', 'is_a', 'nil']);

  // AlgorithmFramework names the runtime defines as constants or methods
  const FRAMEWORK_CLASSES = new Set([
    'Algorithm', 'CryptoAlgorithm', 'SymmetricCipherAlgorithm', 'AsymmetricCipherAlgorithm', 'AsymmetricAlgorithm',
    'BlockCipherAlgorithm', 'StreamCipherAlgorithm', 'EncodingAlgorithm', 'CompressionAlgorithm',
    'ErrorCorrectionAlgorithm', 'HashFunctionAlgorithm', 'MacAlgorithm', 'KdfAlgorithm', 'PaddingAlgorithm',
    'CipherModeAlgorithm', 'AeadAlgorithm', 'RandomGenerationAlgorithm',
    'IAlgorithmInstance', 'IBlockCipherInstance', 'IStreamCipherInstance', 'IHashFunctionInstance', 'IMacInstance',
    'IKdfInstance', 'IAeadInstance', 'IErrorCorrectionInstance', 'IRandomGeneratorInstance', 'IEncodingInstance',
    'ICompressionInstance', 'ICipherModeInstance', 'IPaddingInstance',
    'LinkItem', 'TestCase', 'Vulnerability', 'AuthResult', 'KeySize', 'BlockAbsorber'
  ]);
  const FRAMEWORK_ENUMS = new Set(['CategoryType', 'SecurityStatus', 'ComplexityType', 'CountryCode']);
  const FRAMEWORK_FUNCTIONS = new Set(['RegisterAlgorithm', 'SpongePadBlocks', 'MerkleDamgardBlocks']);
  // Accessors (get/set) the framework classes define: a property of this name goes through the method
  const FRAMEWORK_ACCESSORS = { IBlockCipherInstance: ['key'], BlockAbsorber: ['BlockSize', 'Pending', 'Length'] };
  // Methods the framework classes define
  const FRAMEWORK_METHODS = {
    IAlgorithmInstance: ['Feed', 'Result', 'Dispose'],
    IBlockCipherInstance: ['EncryptBlock', 'DecryptBlock', 'RequireBlockMultiple'],
    IMacInstance: ['ComputeMac'], IErrorCorrectionInstance: ['DetectError'], IRandomGeneratorInstance: ['NextBytes'],
    Algorithm: ['CreateInstance'], BlockAbsorber: ['Absorb', 'Finish', 'Reset']
  };
  const FRAMEWORK_PARENT = {
    CryptoAlgorithm: 'Algorithm', SymmetricCipherAlgorithm: 'CryptoAlgorithm', AsymmetricCipherAlgorithm: 'CryptoAlgorithm',
    AsymmetricAlgorithm: 'CryptoAlgorithm', BlockCipherAlgorithm: 'SymmetricCipherAlgorithm',
    StreamCipherAlgorithm: 'SymmetricCipherAlgorithm', EncodingAlgorithm: 'Algorithm', CompressionAlgorithm: 'Algorithm',
    ErrorCorrectionAlgorithm: 'Algorithm', HashFunctionAlgorithm: 'Algorithm', MacAlgorithm: 'Algorithm',
    KdfAlgorithm: 'Algorithm', PaddingAlgorithm: 'Algorithm', CipherModeAlgorithm: 'Algorithm', AeadAlgorithm: 'CryptoAlgorithm',
    RandomGenerationAlgorithm: 'Algorithm', IBlockCipherInstance: 'IAlgorithmInstance', IStreamCipherInstance: 'IAlgorithmInstance',
    IHashFunctionInstance: 'IAlgorithmInstance', IMacInstance: 'IAlgorithmInstance', IKdfInstance: 'IAlgorithmInstance',
    IAeadInstance: 'IAlgorithmInstance', IErrorCorrectionInstance: 'IAlgorithmInstance',
    IRandomGeneratorInstance: 'IAlgorithmInstance', IEncodingInstance: 'IAlgorithmInstance',
    ICompressionInstance: 'IAlgorithmInstance', ICipherModeInstance: 'IAlgorithmInstance', IPaddingInstance: 'IAlgorithmInstance',
    TestCase: 'LinkItem', Vulnerability: 'LinkItem'
  };

  // JavaScript global objects and the runtime objects standing in for them
  const JS_GLOBALS = {
    Math: 'JsMath', Number: 'JsNumber', String: 'JsString', Boolean: 'JsBoolean', BigInt: 'JsBigInt',
    Array: 'JsArray', Object: 'JsObjectG', JSON: 'JsJSON', console: 'JsConsole',
    Map: 'JSMap', Set: 'JSSet', WeakMap: 'JSMap', WeakSet: 'JSSet', ArrayBuffer: 'JSArrayBuffer', DataView: 'JSDataView',
    Error: 'JSError', TypeError: 'JSError', RangeError: 'JSError', SyntaxError: 'JSError', ReferenceError: 'JSError',
    OpCodes: 'OpCodes', AlgorithmFramework: 'AlgorithmFramework'
  };
  const TYPED_ARRAY_KINDS = {
    Uint8Array: 'u8', Uint8ClampedArray: 'u8c', Int8Array: 'i8', Uint16Array: 'u16', Int16Array: 'i16',
    Uint32Array: 'u32', Int32Array: 'i32', Float32Array: 'f32', Float64Array: 'f64',
    BigUint64Array: 'u64', BigInt64Array: 'i64'
  };
  const ERROR_TYPES = new Set(['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError', 'EvalError', 'URIError']);

  // ========================[ TYPES ]========================

  const INT_WIDTH = {
    int8: [8, true], uint8: [8, false], byte: [8, false], sbyte: [8, true],
    int16: [16, true], uint16: [16, false], short: [16, true], ushort: [16, false], word: [16, false],
    int32: [32, true], uint32: [32, false], int: [32, true], uint: [32, false], dword: [32, false],
    int64: [64, true], uint64: [64, false], long: [64, true], ulong: [64, false], qword: [64, false]
  };

  function typeName(t) {
    if (!t) return '';
    if (typeof t === 'string') return t;
    if (typeof t === 'object' && t.name) return String(t.name);
    return String(t);
  }

  const isIntType = t => Object.prototype.hasOwnProperty.call(INT_WIDTH, typeName(t));
  const isBigIntType = t => /^bigint$/i.test(typeName(t));
  const isFloatType = t => ['float64', 'float32', 'number', 'double', 'float'].includes(typeName(t));
  const isNumericType = t => isIntType(t) || isBigIntType(t) || isFloatType(t);
  const isStringType = t => typeName(t) === 'string';
  const isBoolType = t => ['boolean', 'bool'].includes(typeName(t));
  const isArrayType = t => /\[\]$/.test(typeName(t)) || Object.prototype.hasOwnProperty.call(TYPED_ARRAY_KINDS, typeName(t));
  const isUnknownType = t => !typeName(t) || ['any', 'object', 'null', 'undefined', 'void', 'unknown', 'function', '*'].includes(typeName(t));
  const isUnsignedType = t => isIntType(t) && !INT_WIDTH[typeName(t)][1];
  const intWidth = t => isIntType(t) ? INT_WIDTH[typeName(t)][0] : 0;
  // A class-like object type: truthy exactly when it is not null
  const isObjectType = t => {
    const n = typeName(t);
    return !!n && !isNumericType(n) && !isStringType(n) && !isBoolType(n) && !isUnknownType(n);
  };
  const elementTypeOf = t => typeName(t).replace(/\[\]$/, '');

  // ========================[ AST SHORTHANDS ]========================

  const id = name => new RubyIdentifier(name);
  const raw = (code, prec = 20) => new RubyRawExpression(code, prec);
  const nil = () => new RubyLiteral(null, 'nil');
  const int = n => new RubyLiteral(typeof n === 'bigint' ? n.toString() : String(n), 'int');
  const str = s => new RubyLiteral(s, 'string');
  const bool = b => new RubyLiteral(!!b, 'bool');
  const bin = (l, op, r) => new RubyBinaryExpression(l, op, r);
  const un = (op, x) => new RubyUnaryExpression(op, x);
  const call = (recv, name, args = []) => new RubyMethodCall(recv, name, args);
  const fcall = (name, args = []) => new RubyMethodCall(null, name, args);
  const prop = (recv, name) => { const c = new RubyMethodCall(recv, name, []); c.forceParens = false; return c; };
  const lambdaCall = (fn, args) => { const c = new RubyMethodCall(fn, 'call', args); c.useShortCall = true; return c; };
  const assign = (t, v, op = '=') => new RubyAssignment(t, v, op);
  const exprStmt = e => new RubyExpressionStatement(e);
  const block = (s = []) => new RubyBlock(s);
  const MASK = { 8: '0xFF', 16: '0xFFFF', 32: '0xFFFFFFFF', 64: '0xFFFFFFFFFFFFFFFF' };

  /** The exact decimal of a JavaScript number that holds an integer */
  function exactInteger(v) {
    try { return BigInt(v).toString(); } catch (e) { return String(Math.trunc(v)); }
  }

  // ========================[ SCOPES ]========================

  /**
   * A Ruby local-variable scope: a method body (closed) or a lambda (sees its
   * parent's locals). JavaScript blocks inside it are a stack of name maps.
   */
  class Scope {
    constructor(parent, closed) {
      this.parent = parent;
      this.closed = closed;
      this.blocks = [new Map()];
      this.rubyNames = new Set();
      this.assigned = new Set();
      this.predeclare = new Set();
    }

    lookup(jsName) {
      for (let i = this.blocks.length - 1; i >= 0; --i)
        if (this.blocks[i].has(jsName)) return { scope: this, name: this.blocks[i].get(jsName) };
      if (!this.closed && this.parent) return this.parent.lookup(jsName);
      return null;
    }

    /** Whether a Ruby local of this name is visible here (own or, for lambdas, the parents') */
    visible(rubyName) {
      if (this.rubyNames.has(rubyName)) return true;
      return !this.closed && this.parent ? this.parent.visible(rubyName) : false;
    }

    /** Whether the name is bound in an enclosing JavaScript block or an enclosing function */
    boundOutside(jsName, rubyName) {
      for (let i = this.blocks.length - 2; i >= 0; --i)
        for (const v of this.blocks[i].values()) if (v === rubyName) return true;
      return !this.closed && this.parent ? this.parent.visible(rubyName) : false;
    }
  }

  // ========================[ RUNTIME PRELUDE ]========================
  // The JavaScript semantics, AlgorithmFramework and OpCodes for transpiled code.

  // BEGIN RUBY RUNTIME
  const RUBY_RUNTIME = String.raw`# ---------------------------------------------------------------------------
# JavaScript semantics for transpiled code: values, operators, built-ins,
# AlgorithmFramework and the OpCodes helpers the IL leaves as calls.
# ---------------------------------------------------------------------------
$VERBOSE = nil

module JS
  MANGLED = %w[class send __send__ object_id method methods initialize freeze frozen dup clone inspect to_s
               extend instance_variables singleton_class define_singleton_method public_send hash then tap
               display itself instance_variable_get instance_variable_set respond_to_missing method_missing
               to_a to_ary to_str to_proc to_h to_hash to_int to_i to_f coerce equal eql instance_of kind_of
               is_a nil].freeze
  MANGLED_SET = MANGLED.each_with_object({}) { |n, h| h[n] = true }.freeze
  NAN = Float::NAN
  INF = Float::INFINITY
  OBJECT_STRING = '[object ' 'Object]'
  @mangle_cache = {}
  @demangle_cache = {}

  # The Ruby method name of a JavaScript property name
  def self.mangle(name)
    name = name.to_s
    @mangle_cache[name] ||= (MANGLED_SET[name] ? "#{name}_" : name.tr('$', '_')).to_sym
  end

  # The JavaScript property name of a Ruby method name
  def self.demangle(name)
    name = name.to_s
    @demangle_cache[name] ||= begin
      base = name.end_with?('_') ? name[0..-2] : nil
      base && MANGLED_SET[base] ? base : name
    end
  end
end

# A JavaScript exception: Error, TypeError, RangeError, ... and thrown non-errors
class JSError < StandardError
  attr_accessor :js_name, :value
  def initialize(message = nil, name = 'Error', value = nil)
    super(message.nil? ? '' : js_str(message))
    @js_name = name
    @value = value
  end

  def name = @js_name
  def toString = "#{@js_name}: #{message}"
end

class Exception
  def js_name = self.class.name
end

# ---------------------------------------------------------------------------
# Truthiness, conversions, operators
# ---------------------------------------------------------------------------

def js_truthy(x)
  case x
  when nil, false then false
  when true then true
  when Integer then x != 0
  when Float then x != 0.0 && !x.nan?
  when String then !x.empty?
  else true
  end
end

def js_or(a) = js_truthy(a) ? a : yield
def js_and(a) = js_truthy(a) ? yield : a
def js_nc(a) = a.nil? ? yield : a

# ToNumber
def js_num(x)
  case x
  when Integer, Float then x
  when nil then JS::NAN
  when true then 1
  when false then 0
  when String
    s = x.strip
    return 0 if s.empty?
    if s =~ /\A[+-]?0[xX][0-9a-fA-F]+\z/ then Integer(s)
    elsif s =~ /\A[+-]?0[bB][01]+\z/ then Integer(s)
    elsif s =~ /\A[+-]?0[oO][0-7]+\z/ then Integer(s)
    elsif s =~ /\A[+-]?\d+\z/ then s.to_i
    elsif s =~ /\A[+-]?(\d+\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)\z/ then js_normf(s.to_f)
    elsif s =~ /\A[+-]?Infinity\z/ then s.start_with?('-') ? -JS::INF : JS::INF
    else JS::NAN
    end
  when Array then x.empty? ? 0 : (x.length == 1 ? js_num(x[0]) : JS::NAN)
  else JS::NAN
  end
end

# A float that holds an integer becomes an Integer, so integer typed code stays exact
def js_normf(f)
  f.is_a?(Float) && f.finite? && f == f.floor && f.abs < 9.007199254740992e15 ? f.to_i : f
end

# ToIntegerOrInfinity truncated to an Integer (NaN, Infinity: 0) - the operand of a bit operator
def js_int(x)
  return x if x.is_a?(Integer)
  x = js_num(x) unless x.is_a?(Float)
  return x if x.is_a?(Integer)
  x.finite? ? x.truncate : 0
end

def js_i32(x)
  x = js_int(x) unless x.is_a?(Integer)
  ((x + 0x80000000) & 0xFFFFFFFF) - 0x80000000
end

def js_u32(x)
  x = js_int(x) unless x.is_a?(Integer)
  x & 0xFFFFFFFF
end

def js_wrap(x, bits, signed)
  x = js_int(x) unless x.is_a?(Integer)
  m = (1 << bits) - 1
  x &= m
  signed && x >= (1 << (bits - 1)) ? x - (1 << bits) : x
end

def js_shl(a, n) = js_i32(js_int(a) << (js_int(n) & 31))
def js_sar(a, n) = js_i32(a) >> (js_int(n) & 31)
def js_shr(a, n) = js_u32(a) >> (js_int(n) & 31)

# Number (not BigInt) arithmetic beyond 2**53 rounds like an IEEE double
def js_exact(p)
  p.is_a?(Integer) && (p > 9007199254740992 || p < -9007199254740992) ? js_normf(p.to_f).then { |f| f.is_a?(Float) && f.finite? ? f.to_i : f } : p
end

def js_mul(a, b)
  a = js_num(a) unless a.is_a?(Numeric)
  b = js_num(b) unless b.is_a?(Numeric)
  p = a * b
  p.is_a?(Integer) ? js_exact(p) : js_normf(p)
end

def js_div(a, b)
  a = js_num(a) unless a.is_a?(Numeric)
  b = js_num(b) unless b.is_a?(Numeric)
  if a.is_a?(Integer) && b.is_a?(Integer)
    if b == 0
      return a == 0 ? JS::NAN : (a > 0 ? JS::INF : -JS::INF)
    end
    return a / b if a % b == 0
  end
  js_normf(a.to_f / b)
end

# BigInt division truncates toward zero
def js_bdiv(a, b)
  raise JSError.new('Division by zero', 'RangeError') if b == 0
  q = a.abs / b.abs
  (a < 0) ^ (b < 0) ? -q : q
end

def js_mod(a, b)
  a = js_num(a) unless a.is_a?(Numeric)
  b = js_num(b) unless b.is_a?(Numeric)
  if a.is_a?(Integer) && b.is_a?(Integer)
    return JS::NAN if b == 0
    return a.remainder(b)
  end
  return JS::NAN if b == 0 || (a.is_a?(Float) && !a.finite?)
  return a if b.is_a?(Float) && b.infinite?
  js_normf(a.to_f.remainder(b))
end

def js_bmod(a, b)
  raise JSError.new('Division by zero', 'RangeError') if b == 0
  a.remainder(b)
end

def js_pow(a, b)
  a = js_num(a) unless a.is_a?(Numeric)
  b = js_num(b) unless b.is_a?(Numeric)
  if a.is_a?(Integer) && b.is_a?(Integer) && b >= 0
    return js_exact(a**b) if b < 2048 || a.abs <= 1
    return js_normf(a.to_f**b)
  end
  return JS::NAN if b.is_a?(Float) && b.nan?
  r = a.to_f**b
  r.is_a?(Complex) ? JS::NAN : js_normf(r)
end

def js_bpow(a, b)
  raise JSError.new('BigInt negative exponent', 'RangeError') if b < 0
  a**b
end

def js_neg(a)
  a = js_num(a) unless a.is_a?(Numeric)
  a.is_a?(Integer) && a == 0 ? 0 : -a
end

def js_add(a, b)
  if a.is_a?(String) || b.is_a?(String) || (!a.is_a?(Numeric) && !a.nil? && a != true && a != false) || (!b.is_a?(Numeric) && !b.nil? && b != true && b != false)
    return js_str(a) + js_str(b)
  end
  a = js_num(a) unless a.is_a?(Numeric)
  b = js_num(b) unless b.is_a?(Numeric)
  r = a + b
  r.is_a?(Integer) ? r : js_normf(r)
end

def js_sub(a, b)
  a = js_num(a) unless a.is_a?(Numeric)
  b = js_num(b) unless b.is_a?(Numeric)
  r = a - b
  r.is_a?(Integer) ? r : js_normf(r)
end

def js_inc(a) = a.is_a?(Integer) ? a + 1 : js_add(js_num(a), 1)
def js_dec(a) = a.is_a?(Integer) ? a - 1 : js_sub(js_num(a), 1)

def js_floor(x)
  return x if x.is_a?(Integer)
  x = js_num(x) unless x.is_a?(Float)
  return x if x.is_a?(Integer)
  x.finite? ? x.floor : x
end

def js_ceil(x)
  return x if x.is_a?(Integer)
  x = js_num(x) unless x.is_a?(Float)
  return x if x.is_a?(Integer)
  x.finite? ? x.ceil : x
end

def js_trunc(x)
  return x if x.is_a?(Integer)
  x = js_num(x) unless x.is_a?(Float)
  return x if x.is_a?(Integer)
  x.finite? ? x.truncate : x
end

def js_round(x)
  return x if x.is_a?(Integer)
  x = js_num(x) unless x.is_a?(Float)
  return x if x.is_a?(Integer)
  x.finite? ? (x + 0.5).floor : x
end

def js_abs(x)
  x = js_num(x) unless x.is_a?(Numeric)
  x.abs
end

def js_sign(x)
  x = js_num(x) unless x.is_a?(Numeric)
  return x if x.is_a?(Float) && x.nan?
  x > 0 ? 1 : (x < 0 ? -1 : 0)
end

def js_min(*a)
  return JS::INF if a.empty?
  a = a.map { |v| v.is_a?(Numeric) ? v : js_num(v) }
  return JS::NAN if a.any? { |v| v.is_a?(Float) && v.nan? }
  a.min
end

def js_max(*a)
  return -JS::INF if a.empty?
  a = a.map { |v| v.is_a?(Numeric) ? v : js_num(v) }
  return JS::NAN if a.any? { |v| v.is_a?(Float) && v.nan? }
  a.max
end

def js_imul(a, b) = js_i32(js_int(a) * js_int(b))

def js_clz32(x)
  x = js_u32(x)
  x == 0 ? 32 : 32 - x.bit_length
end

def js_fround(x)
  x = js_num(x) unless x.is_a?(Numeric)
  js_normf([x.to_f].pack('e').unpack1('e'))
end

def js_sqrt(x)
  x = js_num(x) unless x.is_a?(Numeric)
  x < 0 ? JS::NAN : js_normf(Math.sqrt(x))
end

def js_math(name, *args)
  a = args.map { |v| v.is_a?(Numeric) ? v.to_f : js_num(v).to_f }
  r = case name
      when 'sin' then Math.sin(a[0])
      when 'cos' then Math.cos(a[0])
      when 'tan' then Math.tan(a[0])
      when 'asin' then a[0].abs > 1 ? JS::NAN : Math.asin(a[0])
      when 'acos' then a[0].abs > 1 ? JS::NAN : Math.acos(a[0])
      when 'atan' then Math.atan(a[0])
      when 'atan2' then Math.atan2(a[0], a[1])
      when 'sinh' then Math.sinh(a[0])
      when 'cosh' then Math.cosh(a[0])
      when 'tanh' then Math.tanh(a[0])
      when 'exp' then Math.exp(a[0])
      when 'expm1' then Math.exp(a[0]) - 1
      when 'log' then a[0] < 0 ? JS::NAN : (a[0] == 0 ? -JS::INF : Math.log(a[0]))
      when 'log2' then a[0] < 0 ? JS::NAN : (a[0] == 0 ? -JS::INF : Math.log2(a[0]))
      when 'log10' then a[0] < 0 ? JS::NAN : (a[0] == 0 ? -JS::INF : Math.log10(a[0]))
      when 'log1p' then Math.log(1 + a[0])
      when 'cbrt' then Math.cbrt(a[0])
      when 'hypot' then Math.sqrt(a.sum { |v| v * v })
      when 'sqrt' then a[0] < 0 ? JS::NAN : Math.sqrt(a[0])
      when 'random' then rand
      when 'imul' then return js_imul(args[0], args[1])
      when 'clz32' then return js_clz32(args[0])
      when 'floor' then return js_floor(args[0])
      when 'ceil' then return js_ceil(args[0])
      when 'round' then return js_round(args[0])
      when 'trunc' then return js_trunc(args[0])
      when 'abs' then return js_abs(args[0])
      when 'sign' then return js_sign(args[0])
      when 'min' then return js_min(*args)
      when 'max' then return js_max(*args)
      when 'pow' then return js_pow(args[0], args[1])
      when 'fround' then return js_fround(args[0])
      else raise JSError.new("Math.#{name} is not a function", 'TypeError')
      end
  js_normf(r)
end

# ToString
def js_str(x)
  case x
  when String then x
  when Integer then x.to_s
  when Float then js_num_str(x)
  when nil then 'undefined'
  when true then 'true'
  when false then 'false'
  when Array then x.map { |e| e.nil? ? '' : js_str(e) }.join(',')
  when Proc, Method then 'function () { [native code] }'
  when JSError then x.toString
  when Exception then "Error: #{x.message}"
  else
    if x.respond_to?(:toString) then x.toString
    else JS::OBJECT_STRING
    end
  end
end

def js_num_str(x, radix = 10)
  if x.is_a?(Integer)
    return x.to_s(radix)
  end
  return 'NaN' if x.nan?
  return (x > 0 ? 'Infinity' : '-Infinity') if x.infinite?
  return '0' if x == 0
  if x == x.floor && x.abs < 1e21
    return x.to_i.to_s(radix)
  end
  if radix != 10
    neg = x < 0
    v = x.abs
    ip = v.floor
    fp = v - ip
    s = ip.to_s(radix) + '.'
    20.times do
      fp *= radix
      d = fp.floor
      s << d.to_s(radix)
      fp -= d
      break if fp == 0
    end
    return neg ? "-#{s}" : s
  end
  s = x.to_s
  if s.include?('e')
    m, e = s.split('e')
    m = m.sub(/\.0\z/, '')
    ei = e.to_i
    return "#{m}e#{ei >= 0 ? '+' : '-'}#{ei.abs}"
  end
  s.sub(/\.0\z/, '')
end

def js_typeof(x, static_type = nil)
  case x
  when nil then static_type == 'object' ? 'object' : 'undefined'
  when Integer then static_type == 'bigint' ? 'bigint' : 'number'
  when Float then 'number'
  when String then 'string'
  when true, false then 'boolean'
  when Proc, Method then 'function'
  when Class then 'function'
  else 'object'
  end
end

# == (loose equality)
def js_loose_eq(a, b)
  return true if a.nil? && b.nil?
  return false if a.nil? || b.nil?
  if a.is_a?(Numeric) && b.is_a?(String) then return a == js_num(b) end
  if a.is_a?(String) && b.is_a?(Numeric) then return js_num(a) == b end
  if a == true || a == false then return js_loose_eq(a ? 1 : 0, b) end
  if b == true || b == false then return js_loose_eq(a, b ? 1 : 0) end
  if (a.is_a?(Numeric) || a.is_a?(String)) && !(b.is_a?(Numeric) || b.is_a?(String)) then return a == js_prim(b) end
  if (b.is_a?(Numeric) || b.is_a?(String)) && !(a.is_a?(Numeric) || a.is_a?(String)) then return js_prim(a) == b end
  js_strict_eq(a, b)
end

def js_prim(x) = x.is_a?(Array) ? js_str(x) : x

# === (strict equality): numbers and strings by value, everything else by identity
def js_strict_eq(a, b)
  case a
  when Numeric, String, true, false, nil then a == b && (b.is_a?(Numeric) == a.is_a?(Numeric))
  else a.equal?(b)
  end
end

def js_lt(a, b)
  return a < b if a.is_a?(Numeric) && b.is_a?(Numeric)
  return a < b if a.is_a?(String) && b.is_a?(String)
  a = js_num(a); b = js_num(b)
  return false if (a.is_a?(Float) && a.nan?) || (b.is_a?(Float) && b.nan?)
  a < b
end

def js_gt(a, b) = js_lt(b, a)

def js_le(a, b)
  return a <= b if a.is_a?(Numeric) && b.is_a?(Numeric)
  return a <= b if a.is_a?(String) && b.is_a?(String)
  a = js_num(a); b = js_num(b)
  return false if (a.is_a?(Float) && a.nan?) || (b.is_a?(Float) && b.nan?)
  a <= b
end

def js_ge(a, b) = js_le(b, a)

def js_not(a) = !js_truthy(a)

def js_throw(value)
  raise value if value.is_a?(Exception)
  raise JSError.new(js_str(value), 'Error', value)
end

# The value a catch clause binds: the thrown value for a thrown non-error
def js_caught(e) = e.is_a?(JSError) && !e.value.nil? ? e.value : e

def js_unsupported(what)
  raise JSError.new("not supported by the Ruby transpiler: #{what}", 'Error')
end

# ---------------------------------------------------------------------------
# Objects
# ---------------------------------------------------------------------------

# Dynamic properties for every transpiled class: a property no accessor
# declares lives in an instance variable of its name
module JSDynamic
  def method_missing(name, *args, &blk)
    n = name.to_s
    if n.end_with?('=') && args.length == 1
      instance_variable_set("@#{JS.demangle(n[0..-2])}", args[0])
    elsif args.empty? && !n.end_with?('?', '!')
      iv = "@#{JS.demangle(n)}"
      instance_variable_defined?(iv) ? instance_variable_get(iv) : nil
    else
      iv = "@#{JS.demangle(n)}"
      v = instance_variable_defined?(iv) ? instance_variable_get(iv) : nil
      return v.call(*args) if v.respond_to?(:call)
      super
    end
  end

  def respond_to_missing?(name, include_private = false) = false

  # Whether the object has the property (JavaScript: name in object)
  def js_has?(name)
    m = JS.mangle(name)
    respond_to?(m) || respond_to?("#{m}=") || instance_variable_defined?("@#{name}")
  end

  def [](key)
    key = js_key(key)
    m = JS.mangle(key)
    if respond_to?(m)
      v = public_send(m)
      return v
    end
    iv = "@#{key}"
    instance_variable_defined?(iv) ? instance_variable_get(iv) : nil
  end

  def []=(key, value)
    key = js_key(key)
    m = "#{JS.mangle(key)}="
    return public_send(m, value) if respond_to?(m)
    instance_variable_set("@#{key}", value)
  end

  def js_own_keys
    instance_variables.map { |v| v.to_s[1..] }
  end

  def js_remove(key)
    iv = "@#{js_key(key)}"
    remove_instance_variable(iv) if instance_variable_defined?(iv)
    true
  end

  def toString = JS::OBJECT_STRING
  def hasOwnProperty(k) = js_has?(js_key(k))
end

class JSBase
  include JSDynamic
end

# A property name: numbers become their string form, as in JavaScript
def js_key(k)
  case k
  when String then k
  when Symbol then k.to_s
  when Integer then k.to_s
  when Float then js_num_str(k)
  else js_str(k)
  end
end

# An object literal: an ordered dictionary of properties
class JSObject
  attr_reader :__h
  def initialize(h = nil)
    @__h = h || {}
  end

  def self.from(pairs)
    o = new
    pairs.each { |k, v| o.__h[js_key(k)] = v }
    o
  end

  def [](k) = @__h[js_key(k)]
  def []=(k, v)
    @__h[js_key(k)] = v
  end

  def js_has?(k) = @__h.key?(js_key(k))
  def js_own_keys = @__h.keys
  def js_own_values = @__h.values
  def js_remove(k)
    @__h.delete(js_key(k))
    true
  end

  def hasOwnProperty(k) = @__h.key?(js_key(k))
  def toString = @__h.key?('toString') && @__h['toString'].respond_to?(:call) ? @__h['toString'].call : JS::OBJECT_STRING

  def method_missing(name, *args, &blk)
    n = name.to_s
    if n.end_with?('=') && args.length == 1
      key = JS.demangle(n[0..-2])
      @__h[key] = args[0]
    else
      key = JS.demangle(n)
      v = @__h[key]
      return v.call(*args) if !args.empty? && v.respond_to?(:call)
      raise JSError.new("#{key} is not a function", 'TypeError') unless args.empty?
      v
    end
  end

  def respond_to_missing?(name, include_private = false)
    n = name.to_s
    n.end_with?('=') || @__h.key?(JS.demangle(n))
  end

  def ==(other) = equal?(other)
  def inspect = "#<JSObject #{@__h.inspect}>"
end

def js_obj(pairs = nil) = pairs ? JSObject.from(pairs) : JSObject.new

# obj[key] for any receiver
def js_get(obj, key)
  case obj
  when Array
    return obj[key] if key.is_a?(Integer)
    return obj[key.to_i] if key.is_a?(Float) && key == key.floor
    return obj.length if key == 'length'
    if key.is_a?(String) && key =~ /\A\d+\z/ then return obj[key.to_i] end
    nil
  when String
    return obj[key] if key.is_a?(Integer) && key >= 0
    return obj.length if key == 'length'
    nil
  when nil then raise JSError.new("Cannot read properties of undefined (reading '#{js_str(key)}')", 'TypeError')
  else obj[key]
  end
end

def js_set(obj, key, value)
  case obj
  when Array
    if key.is_a?(Integer) then obj[key] = value
    elsif key == 'length' then js_set_length(obj, value)
    else obj[js_int(js_num(key))] = value
    end
  when nil then raise JSError.new("Cannot set properties of undefined (setting '#{js_str(key)}')", 'TypeError')
  else obj[key] = value
  end
  value
end

def js_set_length(arr, n)
  n = js_int(n)
  if n < arr.length then arr.slice!(n..)
  else arr.fill(arr.is_a?(JSTypedArray) ? 0 : nil, arr.length...n)
  end
  n
end

# property read obj.name where obj's type is not known statically
def js_prop(obj, name)
  case obj
  when Array
    return obj.length if name == 'length'
    return obj.js_buffer if name == 'buffer' && obj.respond_to?(:js_buffer)
    return obj.byteLength if name == 'byteLength' && obj.respond_to?(:byteLength)
    nil
  when String then name == 'length' ? obj.length : nil
  when nil then raise JSError.new("Cannot read properties of undefined (reading '#{name}')", 'TypeError')
  when JSObject then obj[name]
  else
    m = JS.mangle(name)
    obj.respond_to?(m) ? obj.public_send(m) : obj[name]
  end
end

def js_in(key, obj)
  case obj
  when Array then key.is_a?(Integer) ? key >= 0 && key < obj.length : (key == 'length' || (key.to_s =~ /\A\d+\z/ && key.to_i < obj.length))
  when JSMap then obj.has(key)
  else obj.respond_to?(:js_has?) ? obj.js_has?(js_key(key)) : false
  end
end

def js_delete(obj, key)
  if obj.is_a?(Array) then obj[js_int(key)] = nil if js_int(key) < obj.length
  elsif obj.respond_to?(:js_remove) then obj.js_remove(key)
  end
  true
end

def js_keys(obj)
  case obj
  when Array then (0...obj.length).map(&:to_s)
  when String then (0...obj.length).map(&:to_s)
  when JSMap then obj.js_map.keys
  when nil then raise JSError.new('Cannot convert undefined or null to object', 'TypeError')
  else obj.respond_to?(:js_own_keys) ? obj.js_own_keys : []
  end
end

def js_values(obj)
  case obj
  when Array then obj.to_a
  when JSObject then obj.js_own_values
  when JSMap then obj.js_map.values
  else js_keys(obj).map { |k| obj[k] }
  end
end

def js_entries(obj)
  case obj
  when Array then obj.each_with_index.map { |v, i| [i.to_s, v] }
  when JSMap then obj.js_map.map { |k, v| [k, v] }
  else js_keys(obj).map { |k| [k, obj[k]] }
  end
end

def js_assign(target, *sources)
  sources.each do |s|
    next if s.nil?
    js_keys(s).each { |k| target[k] = s[k] }
  end
  target
end

def js_instanceof(x, klass)
  return false if klass.nil?
  return x.is_a?(klass) if klass.is_a?(Module)
  false
end

def js_call(f, *args)
  raise JSError.new('undefined is not a function', 'TypeError') if f.nil?
  f.call(*args)
end

# An iterable as a Ruby enumerable (for...of)
def js_iter(x)
  case x
  when Array then x
  when String then x.chars
  when JSMap then x.js_map.map { |k, v| [k, v] }
  when JSSet then x.js_set.to_a
  when nil then raise JSError.new('undefined is not iterable', 'TypeError')
  else x.respond_to?(:js_iterate) ? x.js_iterate : x.to_a
  end
end

def js_spread(x)
  case x
  when Array then x
  when String then x.chars
  when nil then raise JSError.new('undefined is not iterable', 'TypeError')
  else js_iter(x).to_a
  end
end

def js_sequence(*values) = values.last

# OpCodes.PackNNxE / UnpackNNxE and rotations, as the IL lowers them
def js_pack_bytes(bits, big, *bytes)
  n = bits / 8
  v = 0
  n.times do |i|
    b = js_int(bytes[i] || 0) & 0xFF
    v |= big ? b << (8 * (n - 1 - i)) : b << (8 * i)
  end
  v
end

def js_unpack_bytes(v, bits, big)
  n = bits / 8
  v = js_int(v) & ((1 << bits) - 1)
  arr = Array.new(n) { |i| (v >> (8 * i)) & 0xFF }
  big ? arr.reverse! : arr
end

def js_rotl(v, n, bits)
  m = (1 << bits) - 1
  v = js_int(v) & m
  n = js_int(n) % bits
  n == 0 ? v : ((v << n) | (v >> (bits - n))) & m
end

def js_rotr(v, n, bits)
  m = (1 << bits) - 1
  v = js_int(v) & m
  n = js_int(n) % bits
  n == 0 ? v : ((v >> n) | (v << (bits - n))) & m
end

def js_clz(x, bits)
  x = js_int(x) & ((1 << bits) - 1)
  bits - x.bit_length
end

# ---------------------------------------------------------------------------
# Typed arrays, ArrayBuffer, DataView
# ---------------------------------------------------------------------------

class JSArrayBuffer
  attr_reader :bytes
  def initialize(n = 0)
    @bytes = n.is_a?(Array) ? n : Array.new(js_int(n), 0)
  end

  def self.isView(x) = x.respond_to?(:js_kind) || x.is_a?(JSDataView)
  def byteLength = @bytes.length
  def length = @bytes.length
  def slice(a = 0, b = nil)
    n = @bytes.length
    a = a.nil? ? 0 : js_int(a); b = b.nil? ? n : js_int(b)
    a = [a < 0 ? n + a : a, 0].max; b = [[b < 0 ? n + b : b, 0].max, n].min
    JSArrayBuffer.new(a < b ? @bytes[a...b] : [])
  end
end

# Element kinds: [bytes per element, signed, float]
TYPED_KINDS = {
  u8: [1, false, false], u8c: [1, false, false], i8: [1, true, false],
  u16: [2, false, false], i16: [2, true, false], u32: [4, false, false], i32: [4, true, false],
  f32: [4, true, true], f64: [8, true, true], u64: [8, false, false], i64: [8, true, false]
}.freeze

def js_typed_coerce(kind, v)
  case kind
  when :u8 then v.is_a?(Integer) ? v & 0xFF : js_int(v) & 0xFF
  when :u32 then v.is_a?(Integer) ? v & 0xFFFFFFFF : js_int(v) & 0xFFFFFFFF
  when :i32 then js_i32(v)
  when :u16 then js_int(v) & 0xFFFF
  when :i16 then js_wrap(v, 16, true)
  when :i8 then js_wrap(v, 8, true)
  when :u8c
    f = v.is_a?(Numeric) ? v : js_num(v)
    return 0 if f.is_a?(Float) && f.nan?
    f <= 0 ? 0 : (f >= 255 ? 255 : (f.is_a?(Integer) ? f : ((r = f.round) - f == 0.5 && r.odd? ? r - 1 : r).to_i))
  when :f64 then v.is_a?(Numeric) ? v : js_num(v)
  when :f32 then js_fround(v)
  when :u64 then v & 0xFFFFFFFFFFFFFFFF
  when :i64 then js_wrap(v, 64, true)
  else v
  end
end

# A typed array that owns its storage: an Array whose stores wrap to the element type
class JSTypedArray < Array
  attr_reader :js_kind
  def self.create(kind, n = 0)
    a = new
    a.instance_variable_set(:@js_kind, kind)
    if n.is_a?(Integer) || n.is_a?(Float)
      a.concat(Array.new(js_int(n), kind == :f64 || kind == :f32 ? 0 : 0))
    elsif n.is_a?(JSArrayBuffer)
      return JSTypedView.over_buffer(kind, n)
    elsif !n.nil?
      js_iter(n).each { |v| a.push(js_typed_coerce(kind, v)) }
    end
    a
  end

  def self.from_buffer(kind, buffer, offset = nil, length = nil)
    JSTypedView.over_buffer(kind, buffer, offset, length)
  end

  def []=(i, v)
    return v if i.is_a?(Integer) && (i < 0 || i >= length)
    super(i, js_typed_coerce(@js_kind, v))
  end

  def byteLength = length * TYPED_KINDS[@js_kind][0]
  def BYTES_PER_ELEMENT = TYPED_KINDS[@js_kind][0]
  def byteOffset = 0

  # The bytes, as a fresh buffer (not shared with this array)
  def js_buffer
    @js_buffer_obj ||= JSArrayBuffer.new(js_typed_to_bytes(@js_kind, self))
  end
  alias buffer js_buffer

  def js_new_like(n) = JSTypedArray.create(@js_kind, n)
end

def js_typed_to_bytes(kind, values)
  w, = TYPED_KINDS[kind]
  out = []
  values.each do |v|
    case kind
    when :f64 then out.concat([v.to_f].pack('E').bytes)
    when :f32 then out.concat([v.to_f].pack('e').bytes)
    else
      x = js_int(v)
      w.times { |k| out << ((x >> (8 * k)) & 0xFF) }
    end
  end
  out
end

def js_bytes_to_typed(kind, bytes, at)
  w, signed, = TYPED_KINDS[kind]
  case kind
  when :f64 then return js_normf(bytes[at, 8].pack('C*').unpack1('E'))
  when :f32 then return js_normf(bytes[at, 4].pack('C*').unpack1('e'))
  end
  x = 0
  w.times { |k| x |= (bytes[at + k] || 0) << (8 * k) }
  signed && x >= (1 << (8 * w - 1)) ? x - (1 << (8 * w)) : x
end

# A typed array viewing another's storage (subarray) or an ArrayBuffer
class JSTypedView
  include Enumerable
  attr_reader :js_kind
  def initialize(kind, target, offset, len, bytes_mode)
    @js_kind = kind
    @t = target
    @o = offset
    @n = len
    @bytes = bytes_mode
  end

  def self.over_buffer(kind, buffer, offset = nil, length = nil)
    w = TYPED_KINDS[kind][0]
    off = offset.nil? ? 0 : js_int(offset)
    len = length.nil? ? (buffer.bytes.length - off) / w : js_int(length)
    new(kind, buffer.bytes, off, len, true)
  end

  def length = @n
  alias size length
  def byteLength = @n * TYPED_KINDS[@js_kind][0]
  def byteOffset = @bytes ? @o : @o * TYPED_KINDS[@js_kind][0]
  def BYTES_PER_ELEMENT = TYPED_KINDS[@js_kind][0]

  def [](i, len = nil)
    return to_a[i, len] unless len.nil?
    return to_a[i] if i.is_a?(Range)
    i = js_int(i) unless i.is_a?(Integer)
    return nil if i < 0 || i >= @n
    @bytes ? js_bytes_to_typed(@js_kind, @t, @o + i * TYPED_KINDS[@js_kind][0]) : @t[@o + i]
  end

  def []=(i, v)
    i = js_int(i) unless i.is_a?(Integer)
    return v if i < 0 || i >= @n
    v = js_typed_coerce(@js_kind, v)
    if @bytes
      w = TYPED_KINDS[@js_kind][0]
      bs = js_typed_to_bytes(@js_kind, [v])
      w.times { |k| @t[@o + i * w + k] = bs[k] }
    else
      @t[@o + i] = v
    end
    v
  end

  def each
    return enum_for(:each) unless block_given?
    @n.times { |i| yield self[i] }
    self
  end

  def to_a = Array.new(@n) { |i| self[i] }
  alias to_ary to_a
  def ==(o) = o.respond_to?(:to_a) && to_a == o.to_a
  def js_buffer = @bytes ? JSArrayBuffer.new(@t) : JSArrayBuffer.new(js_typed_to_bytes(@js_kind, to_a))
  alias buffer js_buffer
  def js_new_like(n) = JSTypedArray.create(@js_kind, n)
  def fill(v, a = nil, b = nil)
    js_fill(self, v, a, b)
  end

  def inspect = to_a.inspect
  def js_view_parent = [@t, @o]
  def empty? = @n == 0
  def last = @n > 0 ? self[@n - 1] : nil
  def first = @n > 0 ? self[0] : nil
end

def js_typed_new(kind, arg = 0, offset = nil, length = nil)
  if arg.is_a?(JSArrayBuffer) then JSTypedView.over_buffer(kind, arg, offset, length)
  else JSTypedArray.create(kind, arg)
  end
end

def js_subarray(arr, a = nil, b = nil)
  n = arr.length
  a = a.nil? ? 0 : js_int(a); b = b.nil? ? n : js_int(b)
  a = [a < 0 ? n + a : a, 0].max; a = [a, n].min
  b = [[b < 0 ? n + b : b, 0].max, n].min
  len = [b - a, 0].max
  case arr
  when JSTypedView
    t, o = arr.js_view_parent
    JSTypedView.new(arr.js_kind, t, o + (arr.instance_variable_get(:@bytes) ? a * TYPED_KINDS[arr.js_kind][0] : a), len, arr.instance_variable_get(:@bytes))
  when JSTypedArray then JSTypedView.new(arr.js_kind, arr, a, len, false)
  else arr[a, len] || []
  end
end

class JSDataView
  attr_reader :buffer, :byteOffset, :byteLength
  def initialize(buffer, offset = nil, length = nil)
    buffer = JSArrayBuffer.new(buffer.to_a) unless buffer.is_a?(JSArrayBuffer)
    @buffer = buffer
    @byteOffset = offset.nil? ? 0 : js_int(offset)
    @byteLength = length.nil? ? buffer.bytes.length - @byteOffset : js_int(length)
  end

  def js_read(kind, at, little)
    w = TYPED_KINDS[kind][0]
    bs = @buffer.bytes[@byteOffset + js_int(at), w]
    raise JSError.new('Offset is outside the bounds of the DataView', 'RangeError') if bs.nil? || bs.length < w
    bs = bs.reverse unless js_truthy(little)
    js_bytes_to_typed(kind, bs, 0)
  end

  def js_write(kind, at, value, little)
    w = TYPED_KINDS[kind][0]
    bs = js_typed_to_bytes(kind, [js_typed_coerce(kind, value)])
    bs = bs.reverse unless js_truthy(little)
    w.times { |k| @buffer.bytes[@byteOffset + js_int(at) + k] = bs[k] }
    nil
  end

  { 'Uint8' => :u8, 'Int8' => :i8, 'Uint16' => :u16, 'Int16' => :i16, 'Uint32' => :u32, 'Int32' => :i32,
    'Float32' => :f32, 'Float64' => :f64, 'BigUint64' => :u64, 'BigInt64' => :i64 }.each do |n, k|
    define_method("get#{n}") { |at, little = false| js_read(k, at, little) }
    define_method("set#{n}") { |at, v, little = false| js_write(k, at, v, little) }
  end
end

# ---------------------------------------------------------------------------
# Map and Set
# ---------------------------------------------------------------------------

def js_map_key(k) = k.is_a?(Float) && k.finite? && k == k.floor ? k.to_i : k

class JSMap
  attr_reader :js_map
  def initialize(entries = nil)
    @js_map = {}
    entries&.each { |e| e = e.to_a; @js_map[js_map_key(e[0])] = e[1] }
  end

  def get(k) = @js_map[js_map_key(k)]
  def set(k, v)
    @js_map[js_map_key(k)] = v
    self
  end

  def has(k) = @js_map.key?(js_map_key(k))
  def delete(k) = !@js_map.delete(js_map_key(k)) { :__none }.equal?(:__none)
  def size = @js_map.size
  def clear = @js_map.clear && nil
  def keys = @js_map.keys
  def values = @js_map.values
  def entries = @js_map.map { |k, v| [k, v] }
  def forEach(f)
    @js_map.to_a.each { |k, v| f.call(v, k, self) }
    nil
  end

  def js_iterate = entries
end

class JSSet
  attr_reader :js_set
  def initialize(values = nil)
    @js_set = {}
    js_iter(values).each { |v| @js_set[js_map_key(v)] = true } unless values.nil?
  end

  def add(v)
    @js_set[js_map_key(v)] = true
    self
  end

  def has(v) = @js_set.key?(js_map_key(v))
  def delete(v) = !@js_set.delete(js_map_key(v)).nil?
  def size = @js_set.size
  def clear = @js_set.clear && nil
  def values = @js_set.keys
  def keys = @js_set.keys
  def entries = @js_set.keys.map { |k| [k, k] }
  def forEach(f)
    @js_set.keys.each { |k| f.call(k, k, self) }
    nil
  end

  def js_iterate = @js_set.keys
end

# ---------------------------------------------------------------------------
# Array, String and number methods (JavaScript semantics)
# ---------------------------------------------------------------------------

def js_rel(i, n, default)
  return default if i.nil?
  i = js_int(i)
  i < 0 ? [n + i, 0].max : [i, n].min
end

def js_slice(arr, a = nil, b = nil)
  n = arr.length
  a = js_rel(a, n, 0)
  b = js_rel(b, n, n)
  if arr.is_a?(String) then return a < b ? arr[a...b] : '' end
  res = a < b ? arr.to_a[a...b] : []
  arr.respond_to?(:js_kind) && arr.js_kind ? JSTypedArray.create(arr.js_kind, res) : res
end

def js_splice(arr, start, delete_count = nil, *items)
  n = arr.length
  s = js_rel(start, n, 0)
  dc = delete_count.nil? ? n - s : [[js_int(delete_count), 0].max, n - s].min
  removed = arr[s, dc]
  arr[s, dc] = items
  removed
end

def js_push(arr, *vals)
  vals.each { |v| arr.push(v) }
  arr.length
end

def js_unshift(arr, *vals)
  arr.unshift(*vals)
  arr.length
end

def js_concat(arr, *others)
  res = arr.to_a.dup
  others.each do |o|
    if o.is_a?(Array) || o.is_a?(JSTypedView) then res.concat(o.to_a)
    else res.push(o)
    end
  end
  res
end

def js_fill(arr, v, a = nil, b = nil)
  n = arr.length
  a = js_rel(a, n, 0)
  b = js_rel(b, n, n)
  (a...b).each { |i| arr[i] = v }
  arr
end

def js_index_of(arr, v, from = nil)
  if arr.is_a?(String)
    from = from.nil? ? 0 : [js_int(from), 0].max
    r = arr.index(js_str(v), from)
    return r.nil? ? -1 : r
  end
  n = arr.length
  i = from.nil? ? 0 : js_int(from)
  i = [n + i, 0].max if i < 0
  while i < n
    return i if js_strict_eq(arr[i], v)
    i += 1
  end
  -1
end

def js_last_index_of(arr, v, from = nil)
  if arr.is_a?(String)
    r = from.nil? ? arr.rindex(js_str(v)) : arr.rindex(js_str(v), js_int(from))
    return r.nil? ? -1 : r
  end
  i = from.nil? ? arr.length - 1 : js_int(from)
  i = arr.length + i if i < 0
  while i >= 0
    return i if js_strict_eq(arr[i], v)
    i -= 1
  end
  -1
end

def js_includes(arr, v, from = nil)
  return arr.include?(js_str(v)) if arr.is_a?(String) && from.nil?
  return js_index_of(arr, v, from) >= 0 unless v.is_a?(Float) && v.nan?
  arr.to_a.any? { |e| e.is_a?(Float) && e.nan? }
end

def js_join(arr, sep = nil)
  sep = sep.nil? ? ',' : js_str(sep)
  arr.to_a.map { |e| e.nil? ? '' : js_str(e) }.join(sep)
end

def js_reverse(arr)
  if arr.is_a?(Array) then arr.reverse!
  else
    vals = arr.to_a.reverse
    vals.each_with_index { |v, i| arr[i] = v }
  end
  arr
end

def js_sort_cmp(a, b)
  return 0 if a.nil? && b.nil?
  return 1 if a.nil?
  return -1 if b.nil?
  js_str(a) <=> js_str(b)
end

def js_sort(arr, cmp = nil)
  vals = arr.to_a
  sorted = if cmp.nil?
             if arr.respond_to?(:js_kind) && arr.js_kind then vals.sort
             else vals.sort { |a, b| js_sort_cmp(a, b) }
             end
           else
             # a stable merge sort, as Array.prototype.sort is stable
             js_merge_sort(vals) { |a, b| r = cmp.call(a, b); r = js_num(r) unless r.is_a?(Numeric); r.is_a?(Float) && r.nan? ? 0 : r }
           end
  sorted.each_with_index { |v, i| arr[i] = v }
  arr
end

def js_merge_sort(a, &cmp)
  return a.dup if a.length <= 1
  mid = a.length / 2
  l = js_merge_sort(a[0...mid], &cmp)
  r = js_merge_sort(a[mid..], &cmp)
  out = []
  i = j = 0
  while i < l.length && j < r.length
    if cmp.call(r[j], l[i]) < 0 then out << r[j]; j += 1
    else out << l[i]; i += 1
    end
  end
  out.concat(l[i..]).concat(r[j..])
end

def js_callback(f)
  raise JSError.new("#{js_str(f)} is not a function", 'TypeError') unless f.respond_to?(:call)
  f
end

def js_map(arr, f)
  js_callback(f)
  res = arr.to_a.each_with_index.map { |v, i| f.call(v, i, arr) }
  res
end

def js_filter(arr, f) = arr.to_a.each_with_index.select { |v, i| js_truthy(f.call(v, i, arr)) }.map(&:first)
def js_for_each(arr, f)
  arr.to_a.each_with_index { |v, i| f.call(v, i, arr) }
  nil
end

def js_some(arr, f) = arr.to_a.each_with_index.any? { |v, i| js_truthy(f.call(v, i, arr)) }
def js_every(arr, f) = arr.to_a.each_with_index.all? { |v, i| js_truthy(f.call(v, i, arr)) }
def js_find(arr, f)
  arr.to_a.each_with_index { |v, i| return v if js_truthy(f.call(v, i, arr)) }
  nil
end

def js_find_index(arr, f)
  arr.to_a.each_with_index { |v, i| return i if js_truthy(f.call(v, i, arr)) }
  -1
end

def js_find_last(arr, f)
  arr.to_a.each_with_index.reverse_each { |v, i| return v if js_truthy(f.call(v, i, arr)) }
  nil
end

def js_reduce(arr, f, *init)
  vals = arr.to_a
  if init.empty?
    raise JSError.new('Reduce of empty array with no initial value', 'TypeError') if vals.empty?
    acc = vals[0]
    (1...vals.length).each { |i| acc = f.call(acc, vals[i], i, arr) }
  else
    acc = init[0]
    vals.each_with_index { |v, i| acc = f.call(acc, v, i, arr) }
  end
  acc
end

def js_reduce_right(arr, f, *init)
  vals = arr.to_a
  i = vals.length - 1
  if init.empty?
    acc = vals[i]
    i -= 1
  else
    acc = init[0]
  end
  while i >= 0
    acc = f.call(acc, vals[i], i, arr)
    i -= 1
  end
  acc
end

def js_array_from(src, f = nil)
  vals = if src.is_a?(Integer) then Array.new(src)
         elsif src.is_a?(JSObject) || (src.respond_to?(:js_has?) && !src.is_a?(Array)) then Array.new(js_int(src['length'] || 0)) { |i| src[i] }
         else js_iter(src).to_a.dup
         end
  f ? vals.each_with_index.map { |v, i| f.call(v, i) } : vals
end

def js_array_new(*args)
  if args.length == 1 && args[0].is_a?(Numeric) then Array.new(js_int(args[0]))
  else args
  end
end

def js_is_array(x) = x.is_a?(Array) && !x.is_a?(JSTypedArray)

def js_copy_within(arr, target, start, stop = nil)
  n = arr.length
  t = js_rel(target, n, 0); s = js_rel(start, n, 0); e = js_rel(stop, n, n)
  vals = (s...e).map { |i| arr[i] }
  vals.each_with_index { |v, k| arr[t + k] = v if t + k < n }
  arr
end

def js_typed_set(arr, src, offset = nil)
  off = offset.nil? ? 0 : js_int(offset)
  vals = src.to_a
  raise JSError.new('offset is out of bounds', 'RangeError') if off + vals.length > arr.length
  vals.each_with_index { |v, i| arr[off + i] = v }
  nil
end

# --- strings ---
def js_char_at(s, i)
  i = js_int(i)
  i >= 0 && i < s.length ? s[i] : ''
end

def js_char_code_at(s, i = 0)
  i = js_int(i)
  return JS::NAN if i < 0 || i >= s.length
  c = s[i].ord
  c > 0xFFFF ? c : c
end

def js_from_char_codes(*codes)
  codes.flatten.map { |c| (js_int(c) & 0xFFFF).chr(Encoding::UTF_8) }.join
end

def js_from_code_points(*codes) = codes.flatten.map { |c| js_int(c).chr(Encoding::UTF_8) }.join

def js_substring(s, a, b = nil)
  n = s.length
  a = a.nil? ? 0 : [[js_int(js_num(a).is_a?(Float) && js_num(a).nan? ? 0 : a), 0].max, n].min
  b = b.nil? ? n : [[js_int(b), 0].max, n].min
  a, b = b, a if a > b
  s[a...b]
end

def js_substr(s, a, len = nil)
  n = s.length
  a = js_int(a)
  a = [n + a, 0].max if a < 0
  len = len.nil? ? n - a : js_int(len)
  return '' if len <= 0 || a >= n
  s[a, len]
end

def js_split(s, sep = nil, limit = nil)
  res = if sep.nil? then [s]
        elsif sep.is_a?(Regexp) then s.split(sep, -1)
        elsif sep == '' then s.chars
        else s.split(js_str(sep), -1)
        end
  limit.nil? ? res : res[0, js_int(limit)]
end

def js_pad(s, n, pad = ' ', at_start = true)
  s = js_str(s)
  n = js_int(n)
  pad = pad.nil? ? ' ' : js_str(pad)
  return s if n <= s.length || pad.empty?
  fill = (pad * ((n - s.length) / pad.length + 1))[0, n - s.length]
  at_start ? fill + s : s + fill
end

def js_repeat(s, n) = js_str(s) * js_int(n)

def js_regex(source, flags = '')
  opts = 0
  opts |= Regexp::IGNORECASE if flags.include?('i')
  opts |= Regexp::MULTILINE if flags.include?('s')
  src = source.gsub('\\d', '[0-9]').gsub(/(?<!\\)\$\z/, '\\z').gsub(/\A\^/, '\\A')
  Regexp.new(src, opts)
end

def js_replace(s, search, repl, all = false)
  s = js_str(s)
  if search.is_a?(Regexp)
    global = all
    if repl.respond_to?(:call)
      blk = proc { |m| md = Regexp.last_match; js_str(repl.call(m, *md.captures)) }
      global ? s.gsub(search, &blk) : s.sub(search, &blk)
    else
      r = js_str(repl).gsub(/\$(\d)/) { "\\#{::Regexp.last_match(1)}" }.gsub('$&', '\\0')
      global ? s.gsub(search, r) : s.sub(search, r)
    end
  else
    search = js_str(search)
    if repl.respond_to?(:call)
      all ? s.gsub(search) { |m| js_str(repl.call(m)) } : s.sub(search) { |m| js_str(repl.call(m)) }
    else
      all ? s.gsub(search) { js_str(repl) } : s.sub(search) { js_str(repl) }
    end
  end
end

def js_parse_int(s, radix = nil)
  s = js_str(s).strip
  radix = radix.nil? ? 0 : js_int(radix)
  neg = false
  if s.start_with?('-') then neg = true; s = s[1..]
  elsif s.start_with?('+') then s = s[1..]
  end
  if (radix == 0 || radix == 16) && s =~ /\A0[xX]/
    s = s[2..]
    radix = 16
  end
  radix = 10 if radix == 0
  return JS::NAN if radix < 2 || radix > 36
  digits = '0123456789abcdefghijklmnopqrstuvwxyz'[0, radix]
  m = s.downcase[/\A[#{Regexp.escape(digits)}]+/]
  return JS::NAN if m.nil? || m.empty?
  v = m.to_i(radix)
  v = js_exact(v)
  neg ? -v : v
end

def js_parse_float(s)
  m = js_str(s).strip[/\A[+-]?(Infinity|\d+\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)/]
  return JS::NAN if m.nil?
  return m.start_with?('-') ? -JS::INF : JS::INF if m.include?('Infinity')
  js_normf(m.to_f)
end

def js_to_fixed(x, d = 0)
  x = js_num(x)
  format("%.#{js_int(d)}f", x.to_f)
end

def js_bigint(x)
  case x
  when Integer then x
  when Float
    raise JSError.new("The number #{js_num_str(x)} cannot be converted to a BigInt because it is not an integer", 'RangeError') unless x.finite? && x == x.floor
    x.to_i
  when String
    s = x.strip
    return 0 if s.empty?
    return Integer(s) if s =~ /\A[+-]?(\d+|0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+)\z/
    raise JSError.new("Cannot convert #{x} to a BigInt", 'SyntaxError')
  when true then 1
  when false then 0
  else raise JSError.new("Cannot convert #{js_str(x)} to a BigInt", 'TypeError')
  end
end

def js_bigint_as_uint(bits, x) = js_int(x) & ((1 << js_int(bits)) - 1)
def js_bigint_as_int(bits, x) = js_wrap(js_int(x), js_int(bits), true)

def js_number(x = 0) = js_num(x)

# Calls a JavaScript method on a receiver whose type is known only at run time
def js_invoke(obj, name, *args)
  case obj
  when Array, JSTypedView then js_array_method(obj, name, args)
  when String then js_string_method(obj, name, args)
  when Integer, Float then js_number_method(obj, name, args)
  when JSObject
    f = obj[name]
    return f.call(*args) if f.respond_to?(:call)
    return obj.toString if name == 'toString'
    return obj.js_has?(args[0]) if name == 'hasOwnProperty'
    raise JSError.new("obj.#{name} is not a function", 'TypeError')
  when nil then raise JSError.new("Cannot read properties of undefined (reading '#{name}')", 'TypeError')
  when Regexp
    case name
    when 'test' then !(obj =~ js_str(args[0])).nil?
    when 'exec'
      m = obj.match(js_str(args[0]))
      m.nil? ? nil : [m[0], *m.captures]
    else raise JSError.new("regexp.#{name} is not a function", 'TypeError')
    end
  when Proc, Method
    case name
    when 'call' then obj.call(*args[1..])
    when 'apply' then obj.call(*(args[1] || []).to_a)
    when 'bind' then obj
    else raise JSError.new("function.#{name} is not a function", 'TypeError')
    end
  else
    m = JS.mangle(name)
    return obj.public_send(m, *args) if obj.respond_to?(m)
    v = obj.respond_to?(:js_has?) ? obj[name] : nil
    return v.call(*args) if v.respond_to?(:call)
    return js_str(obj) if name == 'toString'
    raise JSError.new("#{obj.class}.#{name} is not a function", 'TypeError')
  end
end

def js_array_method(a, name, args)
  case name
  when 'push' then js_push(a, *args)
  when 'pop' then a.pop
  when 'shift' then a.shift
  when 'unshift' then js_unshift(a, *args)
  when 'slice' then js_slice(a, *args)
  when 'subarray' then js_subarray(a, *args)
  when 'splice' then js_splice(a, *args)
  when 'concat' then js_concat(a, *args)
  when 'fill' then js_fill(a, *args)
  when 'indexOf' then js_index_of(a, *args)
  when 'lastIndexOf' then js_last_index_of(a, *args)
  when 'includes' then js_includes(a, *args)
  when 'join' then js_join(a, *args)
  when 'reverse' then js_reverse(a)
  when 'sort' then js_sort(a, *args)
  when 'map' then js_map(a, *args).then { |r| a.respond_to?(:js_kind) && a.js_kind ? JSTypedArray.create(a.js_kind, r) : r }
  when 'filter' then js_filter(a, *args)
  when 'forEach' then js_for_each(a, *args)
  when 'some' then js_some(a, *args)
  when 'every' then js_every(a, *args)
  when 'find' then js_find(a, *args)
  when 'findIndex' then js_find_index(a, *args)
  when 'findLast' then js_find_last(a, *args)
  when 'reduce' then js_reduce(a, *args)
  when 'reduceRight' then js_reduce_right(a, *args)
  when 'set' then js_typed_set(a, *args)
  when 'copyWithin' then js_copy_within(a, *args)
  when 'toString' then js_join(a)
  when 'keys' then (0...a.length).to_a
  when 'values' then a.to_a
  when 'entries' then a.to_a.each_with_index.map { |v, i| [i, v] }
  when 'at' then i = js_int(args[0]); a[i < 0 ? a.length + i : i]
  when 'flat' then a.to_a.flatten(args[0].nil? ? 1 : js_int(args[0]))
  else raise JSError.new("array.#{name} is not a function", 'TypeError')
  end
end

def js_string_method(s, name, args)
  case name
  when 'charAt' then js_char_at(s, args[0] || 0)
  when 'charCodeAt' then js_char_code_at(s, args[0] || 0)
  when 'codePointAt' then i = js_int(args[0] || 0); i < s.length ? s[i].ord : nil
  when 'substring' then js_substring(s, *args)
  when 'substr' then js_substr(s, *args)
  when 'slice' then js_slice(s, *args)
  when 'indexOf' then js_index_of(s, *args)
  when 'lastIndexOf' then js_last_index_of(s, *args)
  when 'includes' then s.include?(js_str(args[0]))
  when 'startsWith' then s[js_int(args[1] || 0)..].to_s.start_with?(js_str(args[0]))
  when 'endsWith' then s.end_with?(js_str(args[0]))
  when 'split' then js_split(s, *args)
  when 'toUpperCase', 'toLocaleUpperCase' then s.upcase
  when 'toLowerCase', 'toLocaleLowerCase' then s.downcase
  when 'trim' then s.strip
  when 'trimStart', 'trimLeft' then s.lstrip
  when 'trimEnd', 'trimRight' then s.rstrip
  when 'padStart' then js_pad(s, args[0], args[1], true)
  when 'padEnd' then js_pad(s, args[0], args[1], false)
  when 'repeat' then js_repeat(s, args[0])
  when 'replace' then js_replace(s, args[0], args[1], false)
  when 'replaceAll' then js_replace(s, args[0], args[1], true)
  when 'concat' then s + args.map { |x| js_str(x) }.join
  when 'toString', 'valueOf' then s
  when 'localeCompare' then s <=> js_str(args[0])
  when 'at' then i = js_int(args[0]); s[i < 0 ? s.length + i : i]
  when 'match'
    m = s.match(args[0])
    m.nil? ? nil : [m[0], *m.captures]
  else raise JSError.new("string.#{name} is not a function", 'TypeError')
  end
end

def js_number_method(x, name, args)
  case name
  when 'toString' then js_num_str(x, args[0].nil? ? 10 : js_int(args[0]))
  when 'toFixed' then js_to_fixed(x, args[0] || 0)
  when 'valueOf' then x
  when 'toPrecision' then args[0].nil? ? js_num_str(x) : format("%.#{js_int(args[0])}g", x.to_f)
  else raise JSError.new("number.#{name} is not a function", 'TypeError')
  end
end

def js_to_string(x, radix = nil)
  return js_num_str(x, js_int(radix)) if x.is_a?(Numeric) && !radix.nil?
  js_str(x)
end

# ---------------------------------------------------------------------------
# JavaScript global objects
# ---------------------------------------------------------------------------

class JsNumberGlobal
  MAX_SAFE_INTEGER = 9007199254740991
  MIN_SAFE_INTEGER = -9007199254740991
  def call(x = 0) = js_num(x)
  def MAX_SAFE_INTEGER = 9007199254740991
  def MIN_SAFE_INTEGER = -9007199254740991
  def MAX_VALUE = Float::MAX
  def MIN_VALUE = 5e-324
  def EPSILON = Float::EPSILON
  def POSITIVE_INFINITY = JS::INF
  def NEGATIVE_INFINITY = -JS::INF
  def NaN = JS::NAN
  def isInteger(x) = x.is_a?(Integer) || (x.is_a?(Float) && x.finite? && x == x.floor)
  def isSafeInteger(x) = isInteger(x) && x.abs <= 9007199254740991
  def isFinite(x) = x.is_a?(Integer) || (x.is_a?(Float) && x.finite?)
  def isNaN(x) = x.is_a?(Float) && x.nan?
  def parseInt(s, r = nil) = js_parse_int(s, r)
  def parseFloat(s) = js_parse_float(s)
end
JsNumber = JsNumberGlobal.new

class JsStringGlobal
  def call(x = '') = js_str(x)
  def fromCharCode(*c) = js_from_char_codes(*c)
  def fromCodePoint(*c) = js_from_code_points(*c)
end
JsString = JsStringGlobal.new

class JsBooleanGlobal
  def call(x = false) = js_truthy(x)
end
JsBoolean = JsBooleanGlobal.new

class JsBigIntGlobal
  def call(x) = js_bigint(x)
  def asUintN(b, x) = js_bigint_as_uint(b, x)
  def asIntN(b, x) = js_bigint_as_int(b, x)
end
JsBigInt = JsBigIntGlobal.new

class JsArrayGlobal
  def call(*a) = js_array_new(*a)
  def new(*a) = js_array_new(*a)
  def isArray(x) = js_is_array(x)
  def from(x, f = nil) = js_array_from(x, f)
  def of(*a) = a
end
JsArray = JsArrayGlobal.new

class JsObjectGlobal
  def keys(o) = js_keys(o)
  def values(o) = js_values(o)
  def entries(o) = js_entries(o)
  def assign(t, *s) = js_assign(t, *s)
  def freeze(o) = o
  def seal(o) = o
  def isFrozen(_o) = false
  def create(_p, *_) = JSObject.new
  def fromEntries(e) = JSObject.from(js_iter(e).map(&:to_a))
  def getOwnPropertyNames(o) = js_keys(o)
  def defineProperty(o, k, d)
    o[k] = d['value'] if d.js_has?('value')
    o
  end
  def getPrototypeOf(o) = o.class
  def call(x = nil) = x.nil? ? JSObject.new : x
end
JsObjectG = JsObjectGlobal.new

class JsMathGlobal
  def PI = Math::PI
  def E = Math::E
  def LN2 = Math.log(2)
  def LN10 = Math.log(10)
  def LOG2E = 1 / Math.log(2)
  def LOG10E = 1 / Math.log(10)
  def SQRT2 = Math.sqrt(2)
  def SQRT1_2 = Math.sqrt(0.5)
  def method_missing(name, *args) = js_math(name.to_s, *args)
  def respond_to_missing?(*) = true
end
JsMath = JsMathGlobal.new

class JsConsoleGlobal
  def log(*a) = $stderr.puts(a.map { |x| js_str(x) }.join(' ')) && nil
  def method_missing(_name, *a) = log(*a)
  def respond_to_missing?(*) = true
end
JsConsole = JsConsoleGlobal.new

class JsJSONGlobal
  def stringify(x, *_)
    case x
    when nil then 'null'
    when String then x.inspect
    when Numeric then js_str(x)
    when true, false then x.to_s
    when Array then "[#{x.map { |e| stringify(e) }.join(',')}]"
    else "{#{js_keys(x).map { |k| "#{k.inspect}:#{stringify(x[k])}" }.join(',')}}"
    end
  end

  def parse(s) = js_unsupported('JSON.parse')
end
JsJSON = JsJSONGlobal.new

def js_error(message = nil, name = 'Error') = JSError.new(message, name)

# ---------------------------------------------------------------------------
# AlgorithmFramework
# ---------------------------------------------------------------------------

def js_enum(pairs) = JSObject.from(pairs.map { |k, v| [k, JSObject.from(v)] })

CategoryType = js_enum([
  ['ASYMMETRIC', [['name', 'Asymmetric Ciphers']]], ['BLOCK', [['name', 'Block Ciphers']]],
  ['STREAM', [['name', 'Stream Ciphers']]], ['HASH', [['name', 'Hash Functions']]],
  ['CHECKSUM', [['name', 'Checksums']]], ['COMPRESSION', [['name', 'Compression Algorithms']]],
  ['ENCODING', [['name', 'Encoding Schemes']]], ['CLASSICAL', [['name', 'Classical Ciphers']]],
  ['MAC', [['name', 'Message Authentication']]], ['KDF', [['name', 'Key Derivation Functions']]],
  ['ECC', [['name', 'Error Correction']]], ['MODE', [['name', 'Cipher Modes']]],
  ['PADDING', [['name', 'Padding Schemes']]], ['AEAD', [['name', 'Authenticated Encryption']]],
  ['SPECIAL', [['name', 'Special Algorithms']]], ['PQC', [['name', 'Post-Quantum Cryptography']]],
  ['RANDOM', [['name', 'Random Number Generators']]]
])
SecurityStatus = js_enum(%w[SECURE DEPRECATED BROKEN OBSOLETE EXPERIMENTAL EDUCATIONAL].map { |n| [n, [['name', n.capitalize]]] })
ComplexityType = js_enum(%w[BEGINNER INTERMEDIATE ADVANCED EXPERT RESEARCH].each_with_index.map { |n, i| [n, [['name', n.capitalize], ['level', i + 1]]] })
CountryCode = js_enum(%w[US RU CN UA DE GB FR JP KR IL BE CA AU IT NL CH SE NO IN BR INTL ANCIENT UNKNOWN].map { |n| [n, [['name', n]]] })

class LinkItem < JSBase
  attr_accessor :text, :uri
  def initialize(text = nil, uri = nil, *_)
    @text = text
    @uri = uri
  end
end

class TestCase < LinkItem
  attr_accessor :input, :expected
  def initialize(input = nil, expected = nil, description = '', uri = '', *_)
    super(description, uri)
    @input = input
    @expected = expected
  end
end

class Vulnerability < LinkItem
  attr_accessor :description, :mitigation
  def initialize(type = nil, description = '', mitigation = '', uri = '', *_)
    super(type, uri)
    @description = description
    @mitigation = mitigation
  end
end

class AuthResult < JSBase
  attr_accessor :Success, :Output, :FailureReason
  def initialize(success = nil, output = nil, failure_reason = nil, *_)
    @Success = success
    @Output = output
    @FailureReason = failure_reason
  end
end

class KeySize < JSBase
  attr_accessor :minSize, :maxSize, :stepSize
  def initialize(min_size = nil, max_size = nil, step_size = 1, *_)
    @minSize = min_size
    @maxSize = max_size
    @stepSize = step_size
  end
end

def js_fw_byte(value)
  r = js_trunc(value) % 256
  r.is_a?(Float) ? r.to_i : r
end

def js_fw_merge_bits(a, b) = js_fw_byte(a) | js_fw_byte(b)

def js_fw_encode_length(value, count, little)
  enc = Array.new(count, 0)
  rem = [0, js_trunc(value)].max
  count.times do |i|
    enc[little ? i : count - 1 - i] = rem % 256
    rem /= 256
  end
  enc
end

class BlockAbsorber < JSBase
  def initialize(block_size = nil, process_block = nil, *_)
    raise JSError.new('BlockAbsorber: blockSize must be positive') unless block_size.is_a?(Numeric) && block_size > 0
    raise JSError.new('BlockAbsorber: processBlock must be a function') unless process_block.respond_to?(:call)
    @_blockSize = block_size
    @_processBlock = process_block
    @_held = Array.new(block_size, 0)
    @_pending = 0
    @_length = 0
  end

  def BlockSize = @_blockSize
  def Pending = @_pending
  def Length = @_length

  def Absorb(data = nil, *_)
    return nil if data.nil? || data.length == 0
    bs = @_blockSize
    total = data.length
    offset = 0
    while offset < total
      if @_pending == bs
        @_processBlock.call(@_held)
        @_pending = 0
      end
      take = [bs - @_pending, total - offset].min
      take.times { |i| @_held[@_pending + i] = js_fw_byte(data[offset + i]) }
      @_pending += take
      offset += take
      @_length += take
    end
    nil
  end

  def Finish(finalize = nil, *_)
    raise JSError.new('BlockAbsorber: finalize must be a function') unless finalize.respond_to?(:call)
    finalize.call(@_held[0, @_pending], @_pending, @_length)
  end

  def Reset(*_)
    @_held.fill(0)
    @_pending = 0
    @_length = 0
    nil
  end
end

def SpongePadBlocks(held, pending, rate, separator)
  raise JSError.new('SpongePadBlocks: rate must be positive') unless rate > 0
  raise JSError.new("SpongePadBlocks: pending #{pending} outside 0..#{rate}") if pending < 0 || pending > rate
  blocks = []
  block = Array.new(rate, 0)
  pending.times { |i| block[i] = js_fw_byte(held[i]) }
  used = pending
  if used == rate
    blocks.push(block)
    block = Array.new(rate, 0)
    used = 0
  end
  block[used] = js_fw_byte(separator)
  block[rate - 1] = js_fw_merge_bits(block[rate - 1], 0x80)
  blocks.push(block)
  blocks
end

def MerkleDamgardBlocks(held, pending, total_length, options = nil)
  s = options || JSObject.new
  bs = s['blockSize']
  raise JSError.new('MerkleDamgardBlocks: blockSize must be positive') unless bs.is_a?(Numeric) && bs > 0
  raise JSError.new("MerkleDamgardBlocks: pending #{pending} outside 0..#{bs}") if pending < 0 || pending > bs
  pad_byte = s['padByte'].nil? ? 0x80 : s['padByte']
  length_bytes = s['lengthBytes'].nil? ? 8 : s['lengthBytes']
  little = s['lengthLittleEndian'] == true
  in_bits = s['lengthInBits'] != false
  raise JSError.new("MerkleDamgardBlocks: lengthBytes #{length_bytes} does not fit a #{bs}-byte block") if length_bytes < 0 || length_bytes >= bs
  blocks = []
  block = Array.new(bs, 0)
  pending.times { |i| block[i] = js_fw_byte(held[i]) }
  used = pending
  if used == bs
    blocks.push(block)
    block = Array.new(bs, 0)
    used = 0
  end
  block[used] = js_fw_byte(pad_byte)
  used += 1
  if used > bs - length_bytes
    blocks.push(block)
    block = Array.new(bs, 0)
  end
  if length_bytes > 0
    enc = js_fw_encode_length(in_bits ? total_length * 8 : total_length, length_bytes, little)
    length_bytes.times { |i| block[bs - length_bytes + i] = enc[i] }
  end
  blocks.push(block)
  blocks
end

class IAlgorithmInstance < JSBase
  attr_accessor :algorithm, :isInverse, :inputBuffer
  def initialize(algorithm = nil, *_)
    @algorithm = algorithm
    @isInverse = false
    @inputBuffer = []
  end

  def Feed(data = nil, *_)
    return nil if data.nil? || data.length == 0
    @inputBuffer = [] if @inputBuffer.nil?
    data.each { |b| @inputBuffer.push(b) }
    nil
  end

  def Result(*_) = js_throw('Result() not implemented')
  def Dispose(*_)
    @inputBuffer&.clear
    nil
  end
end

class Algorithm < JSBase
  attr_accessor :name, :description, :inventor, :year, :category, :subCategory, :securityStatus,
                :complexity, :country, :documentation, :references, :knownVulnerabilities, :tests
  def initialize(*_)
    @name = nil
    @description = nil
    @inventor = nil
    @year = nil
    @category = nil
    @subCategory = nil
    @securityStatus = nil
    @complexity = nil
    @country = nil
    @documentation = []
    @references = []
    @knownVulnerabilities = []
    @tests = []
  end

  def CreateInstance(*_) = js_throw('CreateInstance() not implemented')
end

class CryptoAlgorithm < Algorithm; end
class SymmetricCipherAlgorithm < CryptoAlgorithm; end
class AsymmetricCipherAlgorithm < CryptoAlgorithm; end

class BlockCipherAlgorithm < SymmetricCipherAlgorithm
  attr_accessor :SupportedKeySizes, :SupportedBlockSizes
  def initialize(*_)
    super()
    @SupportedKeySizes = []
    @SupportedBlockSizes = []
  end
end

class StreamCipherAlgorithm < SymmetricCipherAlgorithm; end
class EncodingAlgorithm < Algorithm; end
class CompressionAlgorithm < Algorithm; end
class ErrorCorrectionAlgorithm < Algorithm; end

class HashFunctionAlgorithm < Algorithm
  attr_accessor :SupportedOutputSizes
  def initialize(*_)
    super()
    @SupportedOutputSizes = []
  end
end

class MacAlgorithm < Algorithm
  attr_accessor :SupportedMacSizes, :NeedsKey
  def initialize(*_)
    super()
    @SupportedMacSizes = []
    @NeedsKey = true
  end
end

class KdfAlgorithm < Algorithm
  attr_accessor :SupportedOutputSizes, :SaltRequired
  def initialize(*_)
    super()
    @SupportedOutputSizes = []
    @SaltRequired = true
  end
end

class PaddingAlgorithm < Algorithm
  attr_accessor :IsLengthIncluded
  def initialize(*_)
    super()
    @IsLengthIncluded = false
  end
end

class CipherModeAlgorithm < Algorithm
  attr_accessor :RequiresIV, :SupportedIVSizes
  def initialize(*_)
    super()
    @RequiresIV = true
    @SupportedIVSizes = []
  end
end

class AeadAlgorithm < CryptoAlgorithm
  attr_accessor :SupportedTagSizes, :SupportsDetached
  def initialize(*_)
    super()
    @SupportedTagSizes = []
    @SupportsDetached = false
  end
end

class RandomGenerationAlgorithm < Algorithm
  attr_accessor :IsDeterministic, :IsCryptographicallySecure, :SupportedSeedSizes
  def initialize(*_)
    super()
    @IsDeterministic = false
    @IsCryptographicallySecure = true
    @SupportedSeedSizes = []
  end
end

class IBlockCipherInstance < IAlgorithmInstance
  attr_accessor :BlockSize, :KeySize, :_key
  def initialize(algorithm = nil, *_)
    super(algorithm)
    @BlockSize = 0
    @KeySize = 0
    @_key = nil
  end

  def key=(key_bytes)
    @_key = key_bytes
  end

  def key = @_key
  def EncryptBlock(*_) = js_throw('EncryptBlock() not implemented')
  def DecryptBlock(*_) = js_throw('DecryptBlock() not implemented')

  def RequireBlockMultiple(block_size = nil, *_)
    size = js_truthy(block_size) ? block_size : self.BlockSize
    raise JSError.new('BlockSize not set') unless size.is_a?(Numeric) && size > 0
    length = @inputBuffer ? @inputBuffer.length : 0
    raise JSError.new("Input length must be multiple of #{size} bytes") if length % size != 0
    length / size
  end

  def Result(*_)
    raise JSError.new('Key not set') unless js_truthy(self.key)
    raise JSError.new('No data fed') if @inputBuffer.nil? || @inputBuffer.length == 0
    bs = self.BlockSize
    RequireBlockMultiple(bs)
    output = []
    offset = 0
    while offset < @inputBuffer.length
      block = @inputBuffer[offset, bs]
      processed = js_truthy(self.isInverse) ? DecryptBlock(block) : EncryptBlock(block)
      processed.each { |b| output.push(b) }
      offset += bs
    end
    @inputBuffer = []
    output
  end
end

class IHashFunctionInstance < IAlgorithmInstance
  attr_accessor :OutputSize
  def initialize(algorithm = nil, *_)
    super(algorithm)
    @OutputSize = 0
  end
end

class IMacInstance < IAlgorithmInstance
  def ComputeMac(*_) = js_throw('ComputeMac() not implemented')
end

class IKdfInstance < IAlgorithmInstance
  attr_accessor :OutputSize, :Iterations
  def initialize(algorithm = nil, *_)
    super(algorithm)
    @OutputSize = 0
    @Iterations = 0
  end
end

class IAeadInstance < IAlgorithmInstance
  attr_accessor :aad, :tagSize
  def initialize(algorithm = nil, *_)
    super(algorithm)
    @aad = []
    @tagSize = 0
  end
end

class IErrorCorrectionInstance < IAlgorithmInstance
  def DetectError(*_) = js_throw('DetectError() not implemented')
end

class IRandomGeneratorInstance < IAlgorithmInstance
  def NextBytes(*_) = js_throw('NextBytes() not implemented')
end

# Families some files name that AlgorithmFramework does not define
class IStreamCipherInstance < IAlgorithmInstance; end
class IEncodingInstance < IAlgorithmInstance; end
class ICompressionInstance < IAlgorithmInstance; end
class ICipherModeInstance < IAlgorithmInstance; end
class IPaddingInstance < IAlgorithmInstance; end
class AsymmetricAlgorithm < CryptoAlgorithm; end

$__js_algorithms = [] unless defined?($__js_algorithms) && $__js_algorithms

def js_process_test_vector(test, index, algorithm_name)
  return test if test.is_a?(TestCase)
  unless !test.nil? && test.respond_to?(:js_has?) && test.js_has?('input')
    raise JSError.new("RegisterAlgorithm: Invalid test vector ##{index + 1} in algorithm '#{algorithm_name}' - must have at least 'input' field")
  end
  description = js_truthy(test['text']) ? test['text'] : "Test vector ##{index + 1}"
  uri = js_truthy(test['uri']) ? test['uri'] : ''
  expected = test.js_has?('expected') && !test['expected'].nil? ? test['expected'] : []
  result = TestCase.new(test['input'], expected, description, uri)
  js_keys(test).each do |k|
    result[k] = test[k] unless %w[input expected text uri].include?(k)
  end
  result
end

def RegisterAlgorithm(algorithm)
  raise JSError.new('RegisterAlgorithm: Invalid algorithm object') if algorithm.nil?
  name = algorithm.name
  raise JSError.new('RegisterAlgorithm: Algorithm must have a valid name') unless name.is_a?(String) && !name.empty?
  if $__js_algorithms.any? { |a| a.name == name }
    raise JSError.new("RegisterAlgorithm: Algorithm '#{name}' already registered")
  end
  tests = algorithm.tests
  if tests.is_a?(Array)
    algorithm.tests = tests.each_with_index.map { |t, i| js_process_test_vector(t, i, name) }
  end
  $__js_algorithms.push(algorithm)
  nil
end

module AlgorithmFramework
  def self.RegisterAlgorithm(a) = Object.send(:RegisterAlgorithm, a)
  def self.Find(name) = $__js_algorithms.find { |a| a.name == name }
  def self.Clear = $__js_algorithms.clear && nil
  def self.Algorithms = $__js_algorithms
  def self.SpongePadBlocks(*a) = Object.send(:SpongePadBlocks, *a)
  def self.MerkleDamgardBlocks(*a) = Object.send(:MerkleDamgardBlocks, *a)
  def self.CategoryType = ::CategoryType
  def self.SecurityStatus = ::SecurityStatus
  def self.ComplexityType = ::ComplexityType
  def self.CountryCode = ::CountryCode
  def self.method_missing(name, *args)
    return Object.const_get(name) if args.empty? && Object.const_defined?(name)
    super
  end

  def self.respond_to_missing?(name, priv = false) = Object.const_defined?(name) || super
  def self.[](k) = public_send(k.to_s)
end

# ---------------------------------------------------------------------------
# OpCodes: the helpers the IL leaves as calls
# ---------------------------------------------------------------------------
module OpCodes
  M64 = 0xFFFFFFFFFFFFFFFF
  def self.CreateArray(length, value = 0) = Array.new(js_int(length), value.nil? ? 0 : value)
  def self.GetByte(word, i) = (js_u32(word) >> (js_int(i) * 8 & 31)) & 0xFF
  def self.GF256Mul(a, b)
    r = 0
    a &= 0xFF
    b &= 0xFF
    8.times do
      r ^= a if b & 1 != 0
      hi = a & 0x80
      a = (a << 1) & 0xFF
      a ^= 0x1B if hi != 0
      b >>= 1
    end
    r & 0xFF
  end

  def self.RotL64n(v, n)
    v &= M64
    n = js_int(n) & 63
    n == 0 ? v : ((v << n) | (v >> (64 - n))) & M64
  end

  def self.RotR64n(v, n)
    v &= M64
    n = js_int(n) & 63
    n == 0 ? v : ((v >> n) | (v << (64 - n))) & M64
  end

  def self.RotL128n(v, n)
    m = (1 << 128) - 1
    v &= m
    n = js_int(n) & 127
    n == 0 ? v : ((v << n) | (v >> (128 - n))) & m
  end

  def self.Hex32ToDWords(hex)
    raise JSError.new('Hex32ToDWords: Input must be a string') unless hex.is_a?(String)
    raise JSError.new('Hex32ToDWords: Invalid hex characters found') unless hex =~ /\A[0-9A-Fa-f]*\z/
    (0...hex.length).step(8).map { |i| hex[i, 8].to_i(16) }
  end

  def self.Hex8ToBytes(hex)
    raise JSError.new('Hex8ToBytes: Input must be a string') unless hex.is_a?(String)
    raise JSError.new('Hex8ToBytes: Invalid hex characters found') unless hex =~ /\A[0-9A-Fa-f]*\z/
    [hex].pack('H*').bytes
  end

  def self.CopyArray(arr) = arr.to_a.dup
  def self.GetBit(v, i) = ((js_u32(v) >> (js_int(i) & 31)) & 1) != 0
  def self.SetBit(v, i, bit) = js_truthy(bit) ? js_u32(v | js_shl(1, i)) : js_u32(v & ~js_shl(1, i))
  def self.ConcatArrays(arrays) = arrays.to_a.flat_map(&:to_a)
  def self.SecureCompare(a, b)
    return false if a.length != b.length
    r = 0
    a.length.times { |i| r |= js_int(a[i]) ^ js_int(b[i]) }
    r == 0
  end

  def self.ArraysEqual(a, b) = SecureCompare(a, b)
  def self.ConstantTimeCompare(a, b, length = nil)
    length = js_truthy(length) ? length : [a.length, b.length].min
    r = 0
    length.times { |i| r |= (i < a.length ? a[i] : 0) ^ (i < b.length ? b[i] : 0) }
    r |= a.length ^ b.length
    r == 0
  end

  def self.BytesToChars(bytes) = bytes.to_a.map { |b| (js_int(b) & 0xFFFF).chr(Encoding::UTF_8) }.join
  def self.ToLong(v)
    x = js_int(v) & M64
    x > 0x7FFFFFFFFFFFFFFF ? x - (1 << 64) : x
  end

  def self.ToShort(v)
    x = js_int(v) & 0xFFFF
    x > 32767 ? x - 65536 : x
  end

  def self.Shr32Signed(v, n) = js_i32(v) >> (js_int(n) & 31)
  def self.BitMask(bits)
    return 0xFFFFFFFF if bits >= 32
    return 0 if bits <= 0
    js_i32(1 << bits) - 1
  end

  def self.SecureRandomBytes(count) = Array.new(js_int(count)) { rand(256) }
  def self.MulHi32(a, b) = (js_u32(a) * js_u32(b)) >> 32
  def self.ArraySlice(arr, s, e = nil)
    e = e.nil? ? arr.length : e
    res = []
    i = s
    while i < e && i < arr.length
      res.push(arr[i])
      i += 1
    end
    res
  end

  def self.GFMul(a, b, irreducible, width)
    r = 0
    mask = (1 << width) - 1
    while b != 0
      r ^= a if b & 1 != 0
      a <<= 1
      a ^= irreducible if a & (1 << width) != 0
      a &= mask
      b >>= 1
    end
    r
  end

  def self.BitCountN(v)
    return 1 if v == 0
    v.abs.bit_length
  end

  def self.RotL64_HL(high, low, n)
    n = js_int(n) & 63
    high = js_u32(high)
    low = js_u32(low)
    return js_obj([['h', high], ['l', low]]) if n == 0
    return js_obj([['h', low], ['l', high]]) if n == 32
    if n < 32
      h = js_u32((high << n) | (low >> (32 - n)))
      l = js_u32((low << n) | (high >> (32 - n)))
    else
      n -= 32
      h = js_u32((low << n) | (high >> (32 - n)))
      l = js_u32((high << n) | (low >> (32 - n)))
    end
    js_obj([['h', h], ['l', l]])
  end

  def self.GcdN(a, b) = a.abs.gcd(b.abs)
  def self.PopCount(v) = js_u32(v).to_s(2).count('1')
  def self.PopCountFast(v) = js_u32(v).to_s(2).count('1')
  def self.AddMod(a, b, m) = js_mod(js_mod(a, m) + js_mod(b, m), m)
  def self.SubMod(a, b, m) = js_mod(js_mod(a, m) - js_mod(b, m) + m, m)
  def self.SquareModN(a, m)
    r = a.remainder(m)
    (r * r).remainder(m)
  end

  def self.MulModN(a, b, m) = (a.remainder(m) * b.remainder(m)).remainder(m)
  def self.ModN(a, m)
    raise JSError.new('ModN requires a positive modulus', 'RangeError') if m <= 0
    a % m
  end

  def self.GetBitN(v, i) = (v >> js_int(i)) & 1
  def self.ModPowN(base, exp, m)
    return 0 if m == 1
    return 1 if exp == 0
    base.remainder(m).then { |b| b < 0 ? b + m : b }.pow(exp, m).then { |r| base < 0 && r != 0 ? r : r }
  end

  def self.ModInverseN(a, m)
    old_r = ModN(a, m)
    r = m
    old_s = 1
    s = 0
    while r != 0
      q = js_bdiv(old_r, r)
      old_r, r = r, old_r - q * r
      old_s, s = s, old_s - q * s
    end
    raise JSError.new('ModInverseN: value has no inverse modulo m', 'RangeError') if old_r != 1
    ModN(old_s, m)
  end

  def self.Words32ToBytesBE(words) = words.to_a.flat_map { |w| w = js_u32(w); [(w >> 24) & 0xFF, (w >> 16) & 0xFF, (w >> 8) & 0xFF, w & 0xFF] }
  def self.BytesToWords32BE(bytes)
    b = bytes.to_a
    (0...b.length).step(4).map { |i| ((b[i] || 0) << 24 | (b[i + 1] || 0) << 16 | (b[i + 2] || 0) << 8 | (b[i + 3] || 0)) & 0xFFFFFFFF }
  end

  def self.Split64(v)
    low = js_i32(v) # JavaScript's value & 0xFFFFFFFF is signed
    high = js_floor(js_div(v, 0x100000000))
    js_obj([['high32', high], ['low32', low]])
  end

  def self.EncodeMsgLength64LE(bit_length)
    s = Split64(bit_length)
    Unpack32LE(s['low32']) + Unpack32LE(s['high32'])
  end

  def self.Unpack32LE(v)
    v = js_u32(v)
    [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF]
  end

  def self.Unpack32BE(v)
    v = js_u32(v)
    [(v >> 24) & 0xFF, (v >> 16) & 0xFF, (v >> 8) & 0xFF, v & 0xFF]
  end

  def self.Add3L64(a, b, c) = js_u32(a) + js_u32(b) + js_u32(c)
  def self.Add3H64(low_sum, ah, bh, ch) = js_i32(ah + bh + ch + js_i32(js_trunc(js_div(low_sum, 0x100000000))))
  def self.GHashMul(x, y)
    raise JSError.new('GHashMul requires 16-byte arrays') if x.nil? || x.length != 16 || y.nil? || y.length != 16
    z = Array.new(16, 0)
    v = y.to_a.dup
    16.times do |i|
      xi = x[i]
      7.downto(0) do |j|
        16.times { |k| z[k] = (z[k] ^ v[k]) & 0xFF } if xi & (1 << j) != 0
        lsb = v[15] & 1
        15.downto(1) { |k| v[k] = ((v[k] >> 1) | ((v[k - 1] & 1) << 7)) & 0xFF }
        v[0] = (v[0] >> 1) & 0xFF
        v[0] = (v[0] ^ 0xE1) & 0xFF if lsb != 0
      end
    end
    z
  end

  def self.GCMIncrement(counter)
    raise JSError.new('GCMIncrement requires 16-byte counter') if counter.nil? || counter.length != 16
    carry = 1
    15.downto(12) do |i|
      sum = counter[i] + carry
      counter[i] = sum & 0xFF
      carry = sum >> 8
    end
    counter
  end

  def self.CreateUint64ArrayFromHex(values)
    values.to_a.map do |h|
      h = h.sub(/\A0[xX]/, '').rjust(16, '0')
      [h[0, 8].to_i(16), h[8, 8].to_i(16)]
    end
  end

  def self.XorArrayWithByte(arr, value)
    value &= 0xFF
    arr.to_a.map { |b| (b ^ value) & 0xFF }
  end

  def self.XorArrays(a, b) = (0...[a.length, b.length].min).map { |i| (a[i] ^ b[i]) & 0xFF }
  def self.ClearArray(arr)
    arr.length.times { |i| arr[i] = 0 }
    nil
  end

  def self.AnsiToBytes(s) = s.each_char.map { |c| c.ord & 0x7F }
  def self.AsciiToBytes(s) = s.each_char.map { |c| c.ord & 0xFF }
  def self.BytesToAnsi(b) = b.to_a.map { |x| (x & 0x7F).chr }.join
  def self.CreateBitStream(initial = nil) = JSBitStream.new(initial)

  # 64-bit values as [high32, low32]
  module UInt64
    M = 0xFFFFFFFFFFFFFFFF
    def self.int(a) = ((js_int(a[0]) & 0xFFFFFFFF) << 32) | (js_int(a[1]) & 0xFFFFFFFF)
    def self.pair(v) = [(v >> 32) & 0xFFFFFFFF, v & 0xFFFFFFFF]
    def self.create(high, low) = [js_u32(high), js_u32(low)]
    def self.fromBytes(bytes)
      b = bytes.to_a
      b = [0] * (8 - b.length) + b if b.length < 8
      [OpCodes.Pack32BE(b[0], b[1], b[2], b[3]), OpCodes.Pack32BE(b[4], b[5], b[6], b[7])]
    end

    def self.toBytes(a) = OpCodes.Unpack32BE(a[0]) + OpCodes.Unpack32BE(a[1])
    def self.fromUInt16(w)
      w = w.to_a
      w = [0] * (4 - w.length) + w if w.length < 4
      [((w[0] & 0xFFFF) << 16) | (w[1] & 0xFFFF), ((w[2] & 0xFFFF) << 16) | (w[3] & 0xFFFF)]
    end

    def self.toUInt16(a) = [(a[0] >> 16) & 0xFFFF, a[0] & 0xFFFF, (a[1] >> 16) & 0xFFFF, a[1] & 0xFFFF]
    def self.fromUInt32(w)
      w = w.to_a
      w = [0] * (2 - w.length) + w if w.length < 2
      [js_u32(w[0]), js_u32(w[1])]
    end

    def self.toUInt32(a) = [a[0], a[1]]
    def self.add(a, b) = pair((int(a) + int(b)) & M)
    def self.sub(a, b) = pair((int(a) - int(b)) & M)
    def self.mul(a, b) = pair((int(a) * int(b)) & M)
    def self.rotr(a, n)
      n = js_int(n) % 64
      v = int(a)
      pair(n == 0 ? v : ((v >> n) | (v << (64 - n))) & M)
    end

    def self.rotl(a, n) = rotr(a, 64 - (js_int(n) % 64))
    def self.shr(a, n) = pair(js_int(n) >= 64 ? 0 : int(a) >> js_int(n))
    def self.shl(a, n) = pair(js_int(n) >= 64 ? 0 : (int(a) << js_int(n)) & M)
    def self.xor(a, b) = pair(int(a) ^ int(b))
    def self.and(a, b) = pair(int(a) & int(b))
    def self.or(a, b) = pair(int(a) | int(b))
    def self.not(a) = pair(~int(a) & M)
    def self.toNumber(a) = int(a)
    def self.fromNumber(num) = pair(js_int(num) & M)
    def self.equals(a, b) = int(a) == int(b)
    def self.clone(a) = [a[0], a[1]]
  end

  def self.Pack32BE(a, b, c, d) = ((js_int(a) & 0xFF) << 24) | ((js_int(b) & 0xFF) << 16) | ((js_int(c) & 0xFF) << 8) | (js_int(d) & 0xFF)
  def self.Pack32LE(a, b, c, d) = ((js_int(d) & 0xFF) << 24) | ((js_int(c) & 0xFF) << 16) | ((js_int(b) & 0xFF) << 8) | (js_int(a) & 0xFF)
  def self.ToUint32(v) = js_u32(v)
  def self.ToByte(v) = js_int(v) & 0xFF
  def self.RotL32(v, n) = js_rotl(v, n, 32)
  def self.RotR32(v, n) = js_rotr(v, n, 32)
  def self.method_missing(name, *args)
    js_unsupported("OpCodes.#{name}")
  end

  def self.respond_to_missing?(*) = true
end

# OpCodes._BitStream
class JSBitStream < JSBase
  attr_accessor :buffer, :bufferBits, :byteArray, :readPosition, :totalBitsWritten
  def initialize(initial = nil)
    @buffer = 0
    @bufferBits = 0
    @byteArray = []
    @readPosition = 0
    @totalBitsWritten = 0
    if initial && initial.length > 0
      @byteArray = initial.to_a.dup
      @totalBitsWritten = initial.length * 8
    end
  end

  def writeBits(value, num_bits)
    raise JSError.new('BitStream.writeBits: numBits must be 1-32') if num_bits <= 0 || num_bits > 32
    mask = num_bits == 32 ? 0xFFFFFFFF : (1 << num_bits) - 1
    value = js_u32(value) & mask
    @buffer = (@buffer << num_bits) | value
    @bufferBits += num_bits
    @totalBitsWritten += num_bits
    while @bufferBits >= 8
      @bufferBits -= 8
      @byteArray.push((@buffer >> @bufferBits) & 0xFF)
      @buffer = @bufferBits > 0 ? @buffer & ((1 << @bufferBits) - 1) : 0
    end
    nil
  end

  def writeBit(bit) = writeBits(bit & 1, 1)
  def writeByte(b) = writeBits(b & 0xFF, 8)
  def writeBytes(bytes)
    bytes.each { |b| writeByte(b) }
    nil
  end

  def writeUint16BE(v)
    writeBits((v >> 8) & 0xFF, 8)
    writeBits(v & 0xFF, 8)
  end

  def writeUint16LE(v)
    writeBits(v & 0xFF, 8)
    writeBits((v >> 8) & 0xFF, 8)
  end

  def writeUint32BE(v)
    v = js_u32(v)
    [24, 16, 8, 0].each { |s| writeBits((v >> s) & 0xFF, 8) }
  end

  def writeUint32LE(v)
    v = js_u32(v)
    [0, 8, 16, 24].each { |s| writeBits((v >> s) & 0xFF, 8) }
  end

  def readBits(num_bits)
    raise JSError.new('BitStream.readBits: numBits must be 1-32') if num_bits <= 0 || num_bits > 32
    result = 0
    bits_read = 0
    while bits_read < num_bits
      byte_index = @readPosition / 8
      bit_offset = @readPosition % 8
      if byte_index >= @byteArray.length
        raise JSError.new('BitStream.readBits: No more data available') if bits_read == 0
        break
      end
      current = @byteArray[byte_index]
      available = 8 - bit_offset
      take = [num_bits - bits_read, available].min
      extracted = (current >> (available - take)) & ((1 << take) - 1)
      result = (result << take) | extracted
      bits_read += take
      @readPosition += take
    end
    js_u32(result)
  end

  def readBit = readBits(1)
  def readByte = readBits(8)
  def flush
    if @bufferBits > 0
      @byteArray.push((@buffer << (8 - @bufferBits)) & 0xFF)
      @buffer = 0
      @bufferBits = 0
    end
    nil
  end

  def toArray
    flush
    @byteArray.dup
  end

  def getBytes = toArray
  def hasMoreBits = @readPosition < @byteArray.length * 8
  def getBitsAvailable = @byteArray.length * 8 - @readPosition
  def reset
    @readPosition = 0
    nil
  end
end`;
  // END RUBY RUNTIME

  // ========================[ TRANSFORMER ]========================

  class RubyTransformer {
    constructor(options = {}) {
      this.options = options;
      this.reset();
    }

    reset() {
      this.classes = new Map();          // JS class name -> info
      this.accessorNames = new Set();    // properties with a get/set anywhere in the file (or its framework bases)
      this.moduleNames = new Map();      // module-level JS name -> Ruby global
      this.moduleFunctions = new Set();  // module-level function names
      this.scope = null;
      this.currentClass = null;
      this.currentMethod = null;
      this.isStatic = false;
      this.loops = [];                   // enclosing loops: { update, kind }
      this.tempCounter = 0;
      this.hoistedClasses = [];
    }

    // ------------------------------------------------------------------
    // Entry
    // ------------------------------------------------------------------

    /**
     * Transform an IL (or plain ESTree) Program into a Ruby module.
     * @param {object} ast - Program
     * @returns {RubyModule}
     */
    transform(ast) {
      this.reset();
      const module = new RubyModule();
      if (this.options.useFrozenStringLiteral !== false)
        module.magicComments.push(new RubyMagicComment('frozen_string_literal', 'true'));
      if (this.options.addComments !== false)
        module.docComment = new RubyDocComment('Generated Ruby code from JavaScript AST\nThis file was automatically generated');

      const body = ast && ast.type === 'Program' ? (ast.body || []) : (ast ? [ast] : []);
      this.globalPrefix = RubyTransformer.globalNameFor(this.options.className, '');
      const moduleName = RubyTransformer.moduleNameFor(this.options.className);

      this.collectClasses(body);
      this.collectModuleNames(body);

      const items = [];
      this.scope = new Scope(null, true);
      this.scope.isModule = true;
      // Function declarations are hoisted, as in JavaScript
      for (const node of body) if (node && node.type === 'FunctionDeclaration') items.push(...this.moduleFunction(node));
      for (const node of body) {
        if (!node || node.type === 'FunctionDeclaration') continue;
        this.topLevel(node, items);
      }
      const prelude = this.options.embedRuntime !== false && this.options.generateTestHarness !== false && RUBY_RUNTIME
        ? [new RubyRawCode(`unless defined?($__js_runtime_loaded)\n$__js_runtime_loaded = true\n${RUBY_RUNTIME}\nend`)] : [];
      module.items = [...prelude, new RubyModuleDef(moduleName, [...this.hoistedClasses, ...items])];
      return module;
    }

    /** Transform one function declaration on its own (OpCodesInliner) */
    transformFunction(node) {
      return this.transform({ type: 'Program', body: [node] });
    }

    // ------------------------------------------------------------------
    // Pre-passes: classes and module-level names
    // ------------------------------------------------------------------

    collectClasses(body) {
      const visit = (node, nested) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(n => visit(n, nested)); return; }
        if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && node.id && node.id.name) this.registerClass(node, nested);
        for (const key of Object.keys(node)) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue;
          const v = node[key];
          if (v && typeof v === 'object') visit(v, nested || ['FunctionDeclaration', 'FunctionExpression', 'ArrowFunction', 'ArrowFunctionExpression', 'MethodDefinition'].includes(node.type));
        }
      };
      visit(body, false);
      // Ruby constant names, unique
      const used = new Set();
      for (const info of this.classes.values()) {
        let name = info.jsName.replace(/[^A-Za-z0-9_]/g, '_');
        name = name.charAt(0).toUpperCase() + name.slice(1);
        if (!/^[A-Z]/.test(name)) name = 'C' + name;
        while (used.has(name) || FRAMEWORK_CLASSES.has(name) && name !== info.jsName) name += '_';
        used.add(name);
        info.rubyName = name;
      }
      // Framework accessors of the bases in use
      for (const info of this.classes.values()) {
        for (let base = info.superName; base; base = this.classes.has(base) ? this.classes.get(base).superName : FRAMEWORK_PARENT[base]) {
          for (const a of FRAMEWORK_ACCESSORS[base] || []) this.accessorNames.add(a);
          if (this.classes.has(base) && this.classes.get(base) === info) break;
        }
      }
    }

    registerClass(node, nested) {
      const info = {
        jsName: node.id.name, node, nested,
        superName: this.superClassName(node.superClass),
        methods: new Set(), staticMethods: new Set(), getters: new Set(), setters: new Set(),
        staticGetters: new Set(), staticSetters: new Set(), fields: new Set(), staticFields: new Set()
      };
      for (const member of (node.body && node.body.body) || []) {
        const name = this.memberKeyName(member);
        if (!name) continue;
        if (member.type === 'MethodDefinition') {
          const kind = member.kind;
          if (kind === 'constructor') continue;
          if (member.static) {
            if (kind === 'get') info.staticGetters.add(name);
            else if (kind === 'set') info.staticSetters.add(name);
            else info.staticMethods.add(name);
          } else if (kind === 'get') { info.getters.add(name); this.accessorNames.add(name); }
          else if (kind === 'set') { info.setters.add(name); this.accessorNames.add(name); }
          else info.methods.add(name);
        } else if (member.type === 'FieldDefinition' || member.type === 'PropertyDefinition' || member.type === 'ClassProperty') {
          (member.static ? info.staticFields : info.fields).add(name);
        }
      }
      // Fields: every this.X assigned in the class
      const visit = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if (n.type === 'ClassDeclaration' || n.type === 'ClassExpression') { if (n !== node) return; }
        if (n.type === 'AssignmentExpression' || n.type === 'UpdateExpression') {
          const target = n.type === 'AssignmentExpression' ? n.left : n.argument;
          const name = this.thisPropertyName(target);
          if (name) info.fields.add(name);
        }
        for (const key of Object.keys(n)) {
          if (key === 'parent' || key === 'loc') continue;
          const v = n[key];
          if (v && typeof v === 'object') visit(v);
        }
      };
      visit(node.body);
      this.classes.set(info.jsName, info);
    }

    superClassName(sc) {
      if (!sc) return null;
      if (sc.type === 'Identifier') return sc.name;
      if (sc.type === 'MemberExpression' && !sc.computed && sc.property) return sc.property.name || sc.property.value;
      return null;
    }

    memberKeyName(member) {
      const key = member.key;
      if (!key) return null;
      if (typeof key === 'string') return key;
      if (key.type === 'Identifier' || key.type === 'PrivateIdentifier') return key.name;
      if (key.type === 'Literal') return String(key.value);
      return null;
    }

    thisPropertyName(target) {
      if (!target) return null;
      if (target.type === 'ThisPropertyAccess' && !target.computed) return typeof target.property === 'string' ? target.property : (target.property && target.property.name);
      if (target.type === 'MemberExpression' && !target.computed && target.object && target.object.type === 'ThisExpression')
        return target.property && (target.property.name || target.property.value);
      return null;
    }

    collectModuleNames(body) {
      for (const node of body) {
        if (!node) continue;
        if (node.type === 'VariableDeclaration') {
          for (const d of node.declarations || []) for (const n of this.patternNames(d.id)) this.moduleNames.set(n, this.globalName(n));
        } else if (node.type === 'FunctionDeclaration' && node.id) {
          this.moduleNames.set(node.id.name, this.globalName(node.id.name));
          this.moduleFunctions.add(node.id.name);
        }
      }
    }

    globalName(jsName) {
      return this.globalPrefix + String(jsName).replace(/[^A-Za-z0-9_]/g, '_');
    }

    patternNames(p) {
      if (!p) return [];
      switch (p.type) {
        case 'Identifier': return [p.name];
        case 'ArrayPattern': return (p.elements || []).flatMap(e => this.patternNames(e));
        case 'ObjectPattern': return (p.properties || []).flatMap(q => this.patternNames(q.type === 'RestElement' ? q.argument : (q.value || q.key)));
        case 'AssignmentPattern': return this.patternNames(p.left);
        case 'RestElement': return this.patternNames(p.argument);
        default: return [];
      }
    }

    classInfo(name) {
      return name && this.classes.has(name) ? this.classes.get(name) : null;
    }

    /** The class's own and inherited (in-file and framework) methods include this name */
    hierarchyHasMethod(className, name) {
      for (let c = className, guard = 0; c && guard < 50; ++guard) {
        const info = this.classInfo(c);
        if (info) {
          if (info.methods.has(name)) return true;
          c = info.superName;
        } else {
          if ((FRAMEWORK_METHODS[c] || []).includes(name)) return true;
          c = FRAMEWORK_PARENT[c];
        }
      }
      return false;
    }

    hierarchyHasField(className, name) {
      for (let c = className, guard = 0; c && guard < 50; ++guard) {
        const info = this.classInfo(c);
        if (!info) return false;
        if (info.fields.has(name)) return true;
        c = info.superName;
      }
      return false;
    }

    hierarchyHasStaticMethod(className, name) {
      for (let c = className, guard = 0; c && guard < 50; ++guard) {
        const info = this.classInfo(c);
        if (!info) return false;
        if (info.staticMethods.has(name)) return true;
        c = info.superName;
      }
      return false;
    }

    rubyClassName(jsName) {
      const info = this.classInfo(jsName);
      return info ? info.rubyName : jsName;
    }

    // ------------------------------------------------------------------
    // Naming
    // ------------------------------------------------------------------

    /** The Ruby method name of a JavaScript member name */
    memberName(name) {
      name = String(name);
      if (MANGLED_MEMBERS.has(name)) return name + '_';
      return name.replace(/\$/g, '_') || '_';
    }

    /** The instance variable of a JavaScript property */
    ivarName(name) {
      return '@' + (String(name).replace(/[^A-Za-z0-9_]/g, '_') || '_');
    }

    sanitizeLocal(jsName) {
      let n = String(jsName).replace(/[^A-Za-z0-9_]/g, '_');
      if (/^[A-Z0-9]/.test(n)) n = '_' + n;
      if (RUBY_KEYWORDS.has(n) || /^js_/.test(n)) n = n + '_';
      return n || '_v';
    }

    /** Declare a JavaScript local in the current block; returns its Ruby name */
    declareLocal(jsName, functionScoped = false) {
      const scope = this.scope;
      const blockMap = functionScoped ? scope.blocks[0] : scope.blocks[scope.blocks.length - 1];
      if (blockMap.has(jsName)) return blockMap.get(jsName);
      const base = this.sanitizeLocal(jsName);
      let name = base;
      let n = 1;
      const conflicts = candidate => (functionScoped
        ? (!scope.closed && scope.parent && scope.parent.visible(candidate)) || [...scope.blocks[0].values()].includes(candidate) && false
        : scope.boundOutside(jsName, candidate))
        || this.isReservedLocal(candidate);
      while (conflicts(name)) name = `${base}_${n++}`;
      blockMap.set(jsName, name);
      scope.rubyNames.add(name);
      return name;
    }

    isReservedLocal(name) {
      return RUBY_KEYWORDS.has(name);
    }

    tempName(prefix = 't') {
      const name = `__${prefix}${++this.tempCounter}`;
      if (this.scope) this.scope.rubyNames.add(name);
      return name;
    }

    /** A Ruby local about to be read: predeclare it when no assignment precedes this point */
    useLocal(binding) {
      if (!binding.scope.assigned.has(binding.name)) binding.scope.predeclare.add(binding.name);
      return id(binding.name);
    }

    markAssigned(name) {
      for (let s = this.scope; s; s = s.closed ? null : s.parent) {
        if (s.rubyNames.has(name)) { s.assigned.add(name); return; }
      }
      this.scope.assigned.add(name);
    }

    pushBlockScope() { this.scope.blocks.push(new Map()); }
    popBlockScope() { this.scope.blocks.pop(); }

    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    typeOf(node) {
      if (!node) return '';
      return typeName(node.resultType);
    }

    isInt(node) { return isIntType(this.typeOf(node)) || (node && node.type === 'Literal' && typeof node.value === 'number' && Number.isInteger(node.value)); }
    isBig(node) { return isBigIntType(this.typeOf(node)) || (node && node.type === 'Literal' && typeof node.value === 'bigint'); }
    isFloat(node) { return isFloatType(this.typeOf(node)) && !(node && node.type === 'Literal' && Number.isInteger(node.value)); }
    isStr(node) { return isStringType(this.typeOf(node)) || (node && node.type === 'Literal' && typeof node.value === 'string'); }
    isBool(node) { return isBoolType(this.typeOf(node)) || (node && node.type === 'Literal' && typeof node.value === 'boolean'); }
    isNum(node) { return this.isInt(node) || this.isBig(node) || isFloatType(this.typeOf(node)); }

    isNullLiteral(node) {
      return node && ((node.type === 'Literal' && node.value === null && !node.regex) || (node.type === 'Identifier' && node.name === 'undefined')
        || (node.type === 'UnaryExpression' && node.operator === 'void'));
    }

    /** Non-negative integer bounds of a node, or null: [max bits] for masks and narrow types */
    unsignedBits(node) {
      if (!node) return null;
      if (node.type === 'Literal' && typeof node.value === 'number' && Number.isInteger(node.value) && node.value >= 0)
        return Math.max(1, Math.ceil(Math.log2(node.value + 1)));
      const t = this.typeOf(node);
      if (isUnsignedType(t)) return intWidth(t);
      if (node.type === 'ArrayLength') return 31;
      return null;
    }

    /** Whether evaluating the node twice is harmless (no side effects, cheap) */
    isPure(node) {
      if (!node) return true;
      switch (node.type) {
        case 'Literal': case 'Identifier': case 'ThisExpression': return true;
        case 'ThisPropertyAccess': return !node.computed || typeof node.property !== 'object' || this.isPure(node.property);
        case 'MemberExpression': return this.isPure(node.object) && (!node.computed || this.isPure(node.property));
        case 'ArrayLength': return this.isPure(node.array);
        case 'BinaryExpression': return this.isPure(node.left) && this.isPure(node.right);
        case 'UnaryExpression': return !['++', '--', 'delete'].includes(node.operator) && this.isPure(node.argument);
        default: return false;
      }
    }

    // ------------------------------------------------------------------
    // Module level
    // ------------------------------------------------------------------

    topLevel(node, items) {
      switch (node.type) {
        case 'ClassDeclaration':
          items.push(this.classDeclaration(node));
          return;
        case 'VariableDeclaration':
          for (const d of node.declarations || []) items.push(...this.moduleVariable(d));
          return;
        case 'ExpressionStatement': {
          const e = node.expression;
          // A UMD/IIFE wrapper that the IL did not unwrap: its body is the module
          if (e && e.type === 'CallExpression' && e.callee && ['FunctionExpression', 'ArrowFunctionExpression', 'ArrowFunction'].includes(e.callee.type)) {
            const fn = e.callee;
            const inner = fn.body && fn.body.body ? fn.body.body : [];
            for (const n of inner) if (n && n.type === 'FunctionDeclaration') {
              this.moduleNames.set(n.id.name, this.globalName(n.id.name));
              this.moduleFunctions.add(n.id.name);
            }
            this.collectModuleNames(inner);
            for (const n of inner) if (n && n.type === 'FunctionDeclaration') items.push(...this.moduleFunction(n));
            for (const n of inner) if (n && n.type !== 'FunctionDeclaration') this.topLevel(n, items);
            return;
          }
          break;
        }
        case 'ReturnStatement':
          return;
        default:
          break;
      }
      items.push(...this.statements([node]));
    }

    moduleVariable(declarator) {
      const out = [];
      const target = declarator.id;
      if (target && target.type === 'Identifier') {
        const value = declarator.init ? this.expr(declarator.init) : nil();
        out.push(exprStmt(assign(id(this.moduleNames.get(target.name) || this.globalName(target.name)), value)));
        return out;
      }
      out.push(...this.destructure(target, declarator.init, true));
      return out;
    }

    moduleFunction(node) {
      const name = this.moduleNames.get(node.id.name) || this.globalName(node.id.name);
      return [exprStmt(assign(id(name), this.functionLambda(node)))];
    }

    // ------------------------------------------------------------------
    // Classes
    // ------------------------------------------------------------------

    classDeclaration(node) {
      const info = this.classInfo(node.id && node.id.name) || { rubyName: node.id ? node.id.name : 'Anonymous', methods: new Set(), getters: new Set(), setters: new Set(), fields: new Set(), staticFields: new Set(), staticMethods: new Set(), superName: this.superClassName(node.superClass) };
      const cls = new RubyClass(info.rubyName, this.superClassExpression(node.superClass));
      const saved = { cls: this.currentClass, method: this.currentMethod, isStatic: this.isStatic, scope: this.scope, loops: this.loops };
      this.currentClass = info;
      this.loops = [];

      const members = (node.body && node.body.body) || [];
      const ctor = members.find(m => m.type === 'MethodDefinition' && m.kind === 'constructor');
      const instanceFields = members.filter(m => (m.type === 'FieldDefinition' || m.type === 'PropertyDefinition' || m.type === 'ClassProperty') && !m.static);
      const staticFields = members.filter(m => (m.type === 'FieldDefinition' || m.type === 'PropertyDefinition' || m.type === 'ClassProperty') && m.static);

      // attr_accessor for plain fields (accessor-named properties go through their methods)
      const plain = [...info.fields].filter(f => !this.accessorNames.has(f) && !info.methods.has(f) && /^[A-Za-z_][A-Za-z0-9_]*$/.test(f) && !MANGLED_MEMBERS.has(f));
      if (plain.length) cls.body.push(new RubyAttribute('accessor', plain));
      const statics = [...info.staticFields].filter(f => /^[A-Za-z_][A-Za-z0-9_]*$/.test(f) && !info.staticGetters.has(f));
      if (statics.length) cls.body.push(new RubyAttribute('accessor', statics.map(f => this.memberName(f)), true));

      if (ctor || instanceFields.length) cls.body.push(this.constructorMethod(ctor, instanceFields, info));
      for (const m of members) {
        if (m.type !== 'MethodDefinition' || m.kind === 'constructor') continue;
        cls.body.push(this.methodDefinition(m, info));
      }
      for (const f of staticFields) {
        this.isStatic = true;
        this.scope = new Scope(null, true);
        const value = f.value ? this.expr(f.value) : nil();
        cls.body.push(exprStmt(assign(prop(id('self'), this.memberName(this.memberKeyName(f))), value)));
        this.isStatic = false;
      }
      for (const m of members) if (m.type === 'StaticBlock') {
        this.isStatic = true;
        cls.body.push(...this.functionBody(m.body || [], [], true).statements);
        this.isStatic = false;
      }

      this.currentClass = saved.cls;
      this.currentMethod = saved.method;
      this.isStatic = saved.isStatic;
      this.scope = saved.scope;
      this.loops = saved.loops;
      return cls;
    }

    superClassExpression(sc) {
      if (!sc) return id('JSBase');
      if (sc.type === 'Identifier') {
        if (this.classes.has(sc.name)) return id(this.rubyClassName(sc.name));
        if (FRAMEWORK_CLASSES.has(sc.name)) return id(sc.name);
        if (this.moduleNames.has(sc.name)) return id(this.moduleNames.get(sc.name));
        if (JS_GLOBALS[sc.name] === 'JSError' || sc.name === 'Error') return id('JSError');
        return id(sc.name);
      }
      if (sc.type === 'MemberExpression' && !sc.computed) {
        const name = sc.property && (sc.property.name || sc.property.value);
        if (FRAMEWORK_CLASSES.has(name)) return id(name);
      }
      return this.expr(sc);
    }

    constructorMethod(ctor, instanceFields, info) {
      const fn = ctor ? ctor.value : null;
      const prevMethod = this.currentMethod;
      this.currentMethod = 'initialize';
      this.isStatic = false;
      const fieldInits = instanceFields.map(f => ({ name: this.memberKeyName(f), value: f.value }));
      const method = this.functionToMethod('initialize', fn, false, fieldInits, info);
      this.currentMethod = prevMethod;
      return method;
    }

    methodDefinition(m, info) {
      const name = this.memberKeyName(m);
      const isStatic = !!m.static;
      let rubyName = this.memberName(name);
      if (m.kind === 'set') rubyName += '=';
      const prevMethod = this.currentMethod;
      this.currentMethod = name;
      this.isStatic = isStatic;
      const method = this.functionToMethod(rubyName, m.value, isStatic, null, info, m.kind === 'set');
      this.isStatic = false;
      this.currentMethod = prevMethod;
      return method;
    }

    /**
     * A JavaScript function as a Ruby method (def): every parameter optional
     * and extra arguments accepted, as JavaScript allows.
     */
    functionToMethod(rubyName, fn, isStatic, fieldInits, info, isSetter = false) {
      const savedScope = this.scope;
      const savedLoops = this.loops;
      this.scope = new Scope(null, true);
      this.loops = [];
      const params = this.parameters(fn ? fn.params || [] : [], { exact: isSetter });
      let statements = [];
      const bodyNode = fn ? fn.body : null;
      const bodyStatements = bodyNode ? (bodyNode.type === 'BlockStatement' ? bodyNode.body : [{ type: 'ReturnStatement', argument: bodyNode }]) : [];

      if (fieldInits && fieldInits.length) {
        // Field initializers run right after super() (or first, without one)
        const fieldStatements = () => fieldInits.map(f => exprStmt(this.thisAssign(f.name, f.value ? this.expr(f.value) : nil())));
        const superIndex = bodyStatements.findIndex(s => s && s.type === 'ExpressionStatement' && s.expression &&
          (s.expression.type === 'ParentConstructorCall' || (s.expression.type === 'CallExpression' && s.expression.callee && s.expression.callee.type === 'Super')));
        if (superIndex >= 0) {
          statements.push(...this.statements(bodyStatements.slice(0, superIndex + 1)));
          statements.push(...fieldStatements());
          statements.push(...this.statements(bodyStatements.slice(superIndex + 1)));
        } else {
          if (info && info.superName && (!fn)) statements.push(exprStmt(new RubySuper([raw('*__args')])));
          statements.push(...fieldStatements());
          statements.push(...this.statements(bodyStatements));
        }
        if (!fn) params.push(new RubyParameter('__args', null, true));
      } else {
        statements = this.functionStatements(bodyStatements, params.prologue || []);
      }
      if (params.prologue && fieldInits && fieldInits.length) statements.unshift(...params.prologue);
      statements = this.withPredeclarations(statements);
      const method = new RubyMethod(rubyName, params.list || params, block(statements), isStatic);
      this.scope = savedScope;
      this.loops = savedLoops;
      return method;
    }

    /**
     * Parameters: Ruby names declared in the current scope, all optional
     * (JavaScript passes undefined for a missing argument) and a rest parameter
     * swallowing extra arguments. Destructuring parameters become a prologue.
     */
    parameters(params, opts = {}) {
      const list = [];
      const prologue = [];
      let hasRest = false;
      params.forEach((p, i) => {
        if (!p) return;
        if (p.type === 'RestParameter' || p.type === 'RestElement') {
          const name = this.declareLocal(p.name || (p.argument && p.argument.name) || `rest${i}`);
          this.scope.assigned.add(name);
          list.push(new RubyParameter(name, null, true));
          hasRest = true;
          return;
        }
        if (p.type === 'DestructuringParameter' || p.type === 'ObjectPattern' || p.type === 'ArrayPattern') {
          const pattern = p.pattern || p;
          const name = this.tempName('p');
          this.scope.assigned.add(name);
          list.push(new RubyParameter(name, opts.exact ? null : nil()));
          prologue.push(...this.destructure(pattern, { type: '__RubyTemp', name }, false));
          return;
        }
        let jsName = p.name;
        let def = p.defaultValue || null;
        if (p.type === 'AssignmentPattern') { jsName = p.left && p.left.name; def = p.right; }
        if (p.type === 'DefaultParameter') { jsName = p.name || (p.left && p.left.name); def = p.defaultValue; }
        const name = this.declareLocal(jsName || `arg${i}`);
        this.scope.assigned.add(name);
        if (def && typeof def === 'object' && def.type) {
          list.push(new RubyParameter(name, nil()));
          prologue.push(exprStmt(assign(id(name), this.expr(def), '||=')));
          // ||= would also replace false: compare with nil instead
          prologue[prologue.length - 1] = new RubyIf(raw(`${name}.nil?`), block([exprStmt(assign(id(name), this.expr(def)))]));
        } else {
          list.push(new RubyParameter(name, opts.exact ? null : nil()));
        }
      });
      if (!hasRest && !opts.exact) list.push(new RubyParameter('_', null, true));
      list.list = list;
      list.prologue = prologue;
      return list;
    }

    /**
     * Declare a block's let/const names (and, for a function body, every var
     * of the function) on entry, so a closure created before a declaration
     * still binds the local, as JavaScript's scoping does.
     */
    hoistDeclarations(nodes, functionBody) {
      for (const s of nodes || []) {
        if (s && s.type === 'VariableDeclaration' && s.kind !== 'var')
          for (const d of s.declarations || []) for (const n of this.patternNames(d.id)) this.declareLocal(n);
      }
      if (!functionBody) return;
      const visit = n => {
        if (!n || typeof n !== 'object') return;
        if (Array.isArray(n)) { n.forEach(visit); return; }
        if (['FunctionDeclaration', 'FunctionExpression', 'ArrowFunction', 'ArrowFunctionExpression', 'ClassDeclaration', 'ClassExpression'].includes(n.type)) return;
        if (n.type === 'VariableDeclaration' && n.kind === 'var')
          for (const d of n.declarations || []) for (const name of this.patternNames(d.id)) this.declareLocal(name, true);
        for (const k of Object.keys(n)) if (k !== 'parent' && n[k] && typeof n[k] === 'object') visit(n[k]);
      };
      visit(nodes);
    }

    /** The statements of a function body, after its parameter prologue, with local functions hoisted */
    functionStatements(bodyStatements, prologue = []) {
      this.hoistDeclarations(bodyStatements, true);
      const out = [...prologue];
      // Local function declarations are hoisted
      const fns = bodyStatements.filter(s => s && s.type === 'FunctionDeclaration');
      for (const f of fns) this.declareLocal(f.id.name);
      for (const f of fns) {
        const name = this.scope.lookup(f.id.name).name;
        this.scope.assigned.add(name);
        out.push(exprStmt(assign(id(name), this.functionLambda(f))));
      }
      out.push(...this.statements(bodyStatements.filter(s => !s || s.type !== 'FunctionDeclaration')));
      return out;
    }

    functionBody(bodyStatements, params, isMethod) {
      return block(this.functionStatements(bodyStatements));
    }

    /** Prepend name = nil for locals read before any assignment (Ruby decides local-vs-method at parse time) */
    withPredeclarations(statements) {
      const names = [...this.scope.predeclare].filter(n => this.scope.rubyNames.has(n));
      if (!names.length) return statements;
      return [exprStmt(raw(`${names.join(' = ')} = nil`, 0)), ...statements];
    }

    /** A function or arrow function as a Ruby lambda (a closure over the enclosing locals) */
    functionLambda(fn) {
      const savedScope = this.scope;
      const savedLoops = this.loops;
      this.scope = new Scope(savedScope && !savedScope.isModule ? savedScope : null, !savedScope || !!savedScope.isModule);
      this.loops = [];
      const params = this.parameters(fn.params || []);
      let body;
      if (fn.body && fn.body.type === 'BlockStatement') {
        body = block(this.withPredeclarations(this.functionStatements(fn.body.body || [], params.prologue)));
      } else if (fn.body) {
        const e = this.expr(fn.body);
        body = params.prologue.length || this.scope.predeclare.size
          ? block(this.withPredeclarations([...params.prologue, exprStmt(e)]))
          : e;
      } else body = block([]);
      // Locals the lambda reads before its parent assigns them must be predeclared in the parent
      for (const n of this.scope.predeclare) if (!this.scope.rubyNames.has(n) && savedScope) this.markPredeclareOuter(savedScope, n);
      this.scope = savedScope;
      this.loops = savedLoops;
      return new RubyLambda(params.list, body);
    }

    markPredeclareOuter(scope, name) {
      for (let s = scope; s; s = s.closed ? null : s.parent) {
        if (s.rubyNames.has(name)) { s.predeclare.add(name); return; }
      }
    }

    // ------------------------------------------------------------------
    // Statements
    // ------------------------------------------------------------------

    statements(nodes) {
      const out = [];
      for (const n of nodes || []) this.statement(n, out);
      return out;
    }

    blockOf(node) {
      if (!node) return block([]);
      this.pushBlockScope();
      if (node.type === 'BlockStatement') this.hoistDeclarations(node.body, false);
      const out = node.type === 'BlockStatement' ? this.functionStatementsInBlock(node.body) : this.statements([node]);
      this.popBlockScope();
      return block(out);
    }

    statement(node, out) {
      if (!node) return;
      switch (node.type) {
        case 'EmptyStatement':
          return;
        case 'BlockStatement':
          this.pushBlockScope();
          this.hoistDeclarations(node.body, false);
          out.push(...this.functionStatementsInBlock(node.body || []));
          this.popBlockScope();
          return;
        case 'ExpressionStatement':
          this.expressionStatement(node.expression, out);
          return;
        case 'VariableDeclaration':
          for (const d of node.declarations || []) this.variableDeclarator(d, node.kind, out);
          return;
        case 'FunctionDeclaration': {
          const binding = this.scope.lookup(node.id.name) || { name: this.declareLocal(node.id.name) };
          this.scope.assigned.add(binding.name);
          out.push(exprStmt(assign(id(binding.name), this.functionLambda(node))));
          return;
        }
        case 'ClassDeclaration':
          if (this.scope && this.scope.isModule) out.push(this.classDeclaration(node));
          else this.hoistedClasses.push(this.classDeclaration(node));
          return;
        case 'ReturnStatement':
          out.push(new RubyReturn(node.argument ? this.expr(node.argument) : null));
          return;
        case 'IfStatement':
          out.push(this.ifStatement(node));
          return;
        case 'ForStatement':
          this.forStatement(node, out);
          return;
        case 'WhileStatement':
          this.whileStatement(node, out);
          return;
        case 'DoWhileStatement':
          this.doWhileStatement(node, out);
          return;
        case 'ForOfStatement':
        case 'ForInStatement':
          this.forOfStatement(node, out);
          return;
        case 'BreakStatement':
          this.jump('break', node.label, out);
          return;
        case 'ContinueStatement':
          this.jump('continue', node.label, out);
          return;
        case 'ThrowStatement':
          out.push(this.throwStatement(node));
          return;
        case 'TryStatement':
          out.push(this.tryStatement(node));
          return;
        case 'SwitchStatement':
          this.switchStatement(node, out);
          return;
        case 'LabeledStatement':
          out.push(exprStmt(fcall('js_unsupported', [str('labeled statement')])));
          return;
        default:
          // An expression node standing as a statement
          if (node.resultType !== undefined || /Expression$|Call$/.test(node.type)) {
            this.expressionStatement(node, out);
            return;
          }
          out.push(exprStmt(fcall('js_unsupported', [str(`statement ${node.type}`)])));
      }
    }

    functionStatementsInBlock(nodes) {
      const fns = nodes.filter(s => s && s.type === 'FunctionDeclaration');
      const out = [];
      for (const f of fns) this.declareLocal(f.id.name);
      for (const f of fns) {
        const name = this.scope.lookup(f.id.name).name;
        this.scope.assigned.add(name);
        out.push(exprStmt(assign(id(name), this.functionLambda(f))));
      }
      out.push(...this.statements(nodes.filter(s => !s || s.type !== 'FunctionDeclaration')));
      return out;
    }

    expressionStatement(e, out) {
      if (!e) return;
      switch (e.type) {
        case 'UpdateExpression':
          out.push(exprStmt(this.updateExpression(e, true)));
          return;
        case 'AssignmentExpression':
          out.push(exprStmt(this.assignmentExpression(e, true)));
          return;
        case 'SequenceExpression':
          for (const x of e.expressions || []) this.expressionStatement(x, out);
          return;
        case 'ArrayAppend': {
          const values = e.values || (e.value ? [e.value] : []);
          if (!values.some(v => v && v.type === 'SpreadElement') && values.length) {
            out.push(exprStmt(call(this.expr(e.array, { receiver: true }), 'push', values.map(v => this.expr(v)))));
            return;
          }
          break;
        }
        case 'LogicalExpression':
          // a && b() as a statement
          if (e.operator === '&&' || e.operator === '||') {
            const c = this.cond(e.left);
            out.push(new RubyIf(e.operator === '&&' ? c : un('!', c), block(this.statements([{ type: 'ExpressionStatement', expression: e.right }]))));
            return;
          }
          break;
        case 'ConditionalExpression':
          out.push(new RubyIf(this.cond(e.test), block(this.statements([{ type: 'ExpressionStatement', expression: e.consequent }])), [],
            block(this.statements([{ type: 'ExpressionStatement', expression: e.alternate }]))));
          return;
        case 'Literal':
        case 'Identifier':
          return;
        default:
          break;
      }
      out.push(exprStmt(this.expr(e, { statement: true })));
    }

    variableDeclarator(d, kind, out) {
      const target = d.id;
      if (target && target.type === 'Identifier') {
        if (this.scope.isModule && this.moduleNames.has(target.name)) {
          out.push(exprStmt(assign(id(this.moduleNames.get(target.name)), d.init ? this.expr(d.init) : nil())));
          return;
        }
        const value = d.init ? this.expr(d.init) : (kind === 'var' && this.scope.lookup(target.name) ? null : nil());
        const name = this.declareLocal(target.name, kind === 'var');
        if (value === null) return;
        out.push(exprStmt(assign(id(name), value)));
        this.markAssigned(name);
        return;
      }
      out.push(...this.destructure(target, d.init, false, kind));
    }

    /** Destructuring declaration or assignment: a temp holding the value, then each target */
    destructure(pattern, init, atModule, kind) {
      const out = [];
      let source;
      if (init && init.type === '__RubyTemp') source = id(init.name);
      else {
        const temp = this.tempName('d');
        out.push(exprStmt(assign(id(temp), init ? this.expr(init) : nil())));
        source = id(temp);
      }
      const bindTarget = (targetNode, valueExpr) => {
        if (!targetNode) return;
        if (targetNode.type === 'AssignmentPattern') {
          const t = this.tempName('d');
          out.push(exprStmt(assign(id(t), valueExpr)));
          out.push(new RubyIf(raw(`${t}.nil?`), block([exprStmt(assign(id(t), this.expr(targetNode.right)))])));
          bindTarget(targetNode.left, id(t));
          return;
        }
        if (targetNode.type === 'Identifier') {
          if (atModule && this.moduleNames.has(targetNode.name)) {
            out.push(exprStmt(assign(id(this.moduleNames.get(targetNode.name)), valueExpr)));
            return;
          }
          let name;
          if (kind) name = this.declareLocal(targetNode.name, kind === 'var');
          else {
            const b = this.scope.lookup(targetNode.name);
            name = b ? b.name : (this.moduleNames.get(targetNode.name) || this.declareLocal(targetNode.name));
          }
          out.push(exprStmt(assign(id(name), valueExpr)));
          if (!name.startsWith('$')) this.markAssigned(name);
          return;
        }
        if (targetNode.type === 'ArrayPattern' || targetNode.type === 'ObjectPattern') {
          const t = this.tempName('d');
          out.push(exprStmt(assign(id(t), valueExpr)));
          walk(targetNode, id(t));
          return;
        }
        // A member target (assignment destructuring)
        out.push(exprStmt(this.assignTo(targetNode, valueExpr)));
      };
      const walk = (p, src) => {
        if (p.type === 'ArrayPattern') {
          (p.elements || []).forEach((el, i) => {
            if (!el) return;
            if (el.type === 'RestElement') bindTarget(el.argument, fcall('js_slice', [src, int(i)]));
            else bindTarget(el, fcall('js_get', [src, int(i)]));
          });
        } else if (p.type === 'ObjectPattern') {
          for (const q of p.properties || []) {
            if (q.type === 'RestElement') { bindTarget(q.argument, src); continue; }
            const key = q.key && (q.key.name !== undefined && !q.computed ? q.key.name : q.key.value);
            const keyExpr = q.computed ? this.expr(q.key) : str(String(key));
            bindTarget(q.value || q.key, fcall('js_get', [src, keyExpr]));
          }
        }
      };
      walk(pattern, source);
      return out;
    }

    ifStatement(node) {
      const condition = this.cond(node.test);
      const thenBranch = this.blockOf(node.consequent);
      const elsifs = [];
      let alt = node.alternate;
      while (alt && alt.type === 'IfStatement') {
        elsifs.push({ condition: this.cond(alt.test), body: this.blockOf(alt.consequent) });
        alt = alt.alternate;
      }
      const elseBranch = alt ? this.blockOf(alt) : null;
      return new RubyIf(condition, thenBranch, elsifs, elseBranch);
    }

    // --- loops ---------------------------------------------------------

    /** Run fn with a loop context; its continue runs `update` first */
    withLoop(update, fn) {
      this.loops.push({ update, kind: 'loop' });
      try { return fn(); } finally { this.loops.pop(); }
    }

    forStatement(node, out) {
      this.pushBlockScope();
      if (node.init) {
        if (node.init.type === 'VariableDeclaration') this.statement(node.init, out);
        else this.expressionStatement(node.init, out);
      }
      const condition = node.test ? this.cond(node.test) : bool(true);
      const update = [];
      if (node.update) this.expressionStatement(node.update, update);
      const body = this.withLoop(update, () => this.blockOf(node.body));
      body.statements.push(...update);
      out.push(new RubyWhile(condition, body));
      this.popBlockScope();
    }

    whileStatement(node, out) {
      const condition = this.cond(node.test);
      const body = this.withLoop([], () => this.blockOf(node.body));
      out.push(new RubyWhile(condition, body));
    }

    doWhileStatement(node, out) {
      // begin ... end while: `next` jumps to the condition
      const body = this.withLoop([], () => this.blockOf(node.body));
      out.push(new RubyWhile(this.cond(node.test), body, true));
    }

    forOfStatement(node, out) {
      this.pushBlockScope();
      const isIn = node.type === 'ForInStatement';
      const right = node.right;
      let iterable;
      if (isIn) iterable = fcall('js_keys', [this.expr(right)]);
      else iterable = isArrayType(this.typeOf(right)) ? this.expr(right, { receiver: true }) : fcall('js_iter', [this.expr(right)]);
      let left = node.left;
      let variable;
      const prologue = [];
      const declKind = left && left.type === 'VariableDeclaration' ? left.kind : null;
      const pattern = declKind ? left.declarations[0].id : left;
      if (pattern && pattern.type === 'Identifier') {
        if (declKind) variable = this.declareLocal(pattern.name, declKind === 'var');
        else {
          const b = this.scope.lookup(pattern.name);
          variable = b ? b.name : null;
          if (!variable) {
            const temp = this.tempName('it');
            variable = temp;
            prologue.push(exprStmt(this.assignTo(pattern, id(temp))));
          }
        }
        if (variable) this.markAssigned(variable);
      } else {
        variable = this.tempName('it');
        prologue.push(...this.destructure(pattern, { type: '__RubyTemp', name: variable }, false, declKind || null));
      }
      const body = this.withLoop([], () => this.blockOf(node.body));
      body.statements.unshift(...prologue);
      out.push(new RubyFor(variable, iterable, body));
      this.popBlockScope();
    }

    jump(kind, label, out) {
      if (label) {
        out.push(exprStmt(fcall('js_unsupported', [str(`labeled ${kind}`)])));
        return;
      }
      if (kind === 'break') {
        // JavaScript's break leaves the innermost loop or switch; a switch
        // that needs one is a loop run once (switchwrap), a plain case needs none
        out.push(new RubyBreak());
        return;
      }
      // continue: the innermost real loop; a switch wrapper in between is left through a flag
      let i = this.loops.length - 1;
      while (i >= 0 && this.loops[i].kind !== 'loop') i--;
      const loop = this.loops[i];
      const wrap = [...this.loops.slice(i + 1)].reverse().find(l => l.kind === 'switchwrap');
      if (wrap) {
        wrap.continueFlag = wrap.continueFlag || this.tempName('cont');
        out.push(exprStmt(assign(id(wrap.continueFlag), bool(true))));
        out.push(new RubyBreak());
        return;
      }
      if (loop && loop.update) out.push(...loop.update);
      out.push(new RubyNext());
    }

    // --- switch ----------------------------------------------------------

    switchStatement(node, out) {
      const cases = node.cases || [];
      // Fallthrough: a case body that does not end in a jump continues into the next one
      const ends = stmts => {
        const last = stmts[stmts.length - 1];
        return last && ['BreakStatement', 'ReturnStatement', 'ThrowStatement', 'ContinueStatement'].includes(last.type);
      };
      const bodies = cases.map((c, i) => {
        let stmts = [...(c.consequent || [])];
        if (stmts.length === 1 && stmts[0].type === 'BlockStatement') stmts = [...stmts[0].body];
        if (stmts.length === 0) return null; // grouped with the next case
        let j = i;
        while (!ends(stmts) && j + 1 < cases.length) {
          j++;
          let next = [...(cases[j].consequent || [])];
          if (next.length === 1 && next[0].type === 'BlockStatement') next = [...next[0].body];
          stmts = stmts.concat(next);
        }
        // the trailing break belongs to the switch
        if (stmts.length && stmts[stmts.length - 1].type === 'BreakStatement' && !stmts[stmts.length - 1].label) stmts = stmts.slice(0, -1);
        return stmts;
      });
      const hasInnerBreak = bodies.some(b => b && this.containsSwitchBreak(b));
      const subject = this.expr(node.discriminant);
      const ctx = { kind: hasInnerBreak ? 'switchwrap' : 'switch', update: null };
      this.loops.push(ctx);
      const whens = [];
      let elseBody = null;
      let pending = [];
      cases.forEach((c, i) => {
        if (c.test) pending.push(this.caseValue(c.test));
        else pending.push(null);
        if (bodies[i] === null) return;
        this.pushBlockScope();
        const body = block(this.statements(bodies[i]));
        this.popBlockScope();
        const hasDefault = pending.includes(null);
        const values = pending.filter(v => v !== null);
        if (hasDefault) elseBody = body;
        else if (values.length) whens.push(new RubyWhen(values, body));
        pending = [];
      });
      this.loops.pop();
      const caseNode = new RubyCase(subject, whens, elseBody);
      if (!hasInnerBreak) {
        out.push(caseNode);
        return;
      }
      // A switch with a break inside its cases: a loop run once, so break leaves it
      const wrapBody = block([caseNode, new RubyBreak()]);
      out.push(new RubyWhile(bool(true), wrapBody));
      if (ctx.continueFlag) {
        out.splice(out.length - 1, 0, exprStmt(assign(id(ctx.continueFlag), bool(false))));
        // Carry the continue on: out of the next switch wrapper, or to the loop itself
        let i = this.loops.length - 1;
        while (i >= 0 && this.loops[i].kind !== 'loop') i--;
        const loop = this.loops[i];
        const outer = [...this.loops.slice(i + 1)].reverse().find(l => l.kind === 'switchwrap');
        const jumpOut = [];
        if (outer) {
          outer.continueFlag = outer.continueFlag || this.tempName('cont');
          jumpOut.push(exprStmt(assign(id(outer.continueFlag), bool(true))), new RubyBreak());
        } else {
          if (loop && loop.update) jumpOut.push(...loop.update);
          jumpOut.push(new RubyNext());
        }
        out.push(new RubyIf(id(ctx.continueFlag), block(jumpOut)));
      }
    }

    containsSwitchBreak(stmts) {
      let found = false;
      const visit = (n, depth) => {
        if (!n || typeof n !== 'object' || found) return;
        if (Array.isArray(n)) { n.forEach(x => visit(x, depth)); return; }
        if (['ForStatement', 'WhileStatement', 'DoWhileStatement', 'ForOfStatement', 'ForInStatement', 'SwitchStatement',
          'FunctionExpression', 'FunctionDeclaration', 'ArrowFunction', 'ArrowFunctionExpression', 'ClassDeclaration'].includes(n.type)) return;
        if (n.type === 'BreakStatement' && !n.label) { found = true; return; }
        for (const k of Object.keys(n)) if (k !== 'parent' && n[k] && typeof n[k] === 'object') visit(n[k], depth + 1);
      };
      visit(stmts, 0);
      return found;
    }

    caseValue(test) {
      return this.expr(test);
    }

    // --- exceptions -----------------------------------------------------

    throwStatement(node) {
      const arg = node.argument;
      if (arg && (arg.type === 'ErrorCreation' || (arg.type === 'NewExpression' && arg.callee && ERROR_TYPES.has(arg.callee.name))))
        return new RubyRaise(this.expr(arg));
      return exprStmt(fcall('js_throw', [this.expr(arg)]));
    }

    tryStatement(node) {
      const body = this.blockOf(node.block);
      const rescues = [];
      if (node.handler) {
        this.pushBlockScope();
        const stmts = [];
        let varName = null;
        if (node.handler.param) {
          const param = node.handler.param;
          if (param.type === 'Identifier') {
            const name = this.declareLocal(param.name);
            varName = this.tempName('e');
            stmts.push(exprStmt(assign(id(name), fcall('js_caught', [id(varName)]))));
            this.markAssigned(name);
          }
        }
        const handlerBody = node.handler.body;
        stmts.push(...this.statements(handlerBody && handlerBody.type === 'BlockStatement' ? handlerBody.body : [handlerBody]));
        this.popBlockScope();
        rescues.push(new RubyRescue(['StandardError', 'SystemStackError'], varName, block(stmts)));
      }
      const ensureBody = node.finalizer ? this.blockOf(node.finalizer) : null;
      if (!rescues.length && !ensureBody) return body;
      return new RubyBegin(body, rescues, ensureBody);
    }

    // ------------------------------------------------------------------
    // Conditions
    // ------------------------------------------------------------------

    /** A JavaScript value used as a condition, as a Ruby true/false (or truthy object) */
    cond(node) {
      if (!node) return bool(true);
      switch (node.type) {
        case 'LogicalExpression':
          if (node.operator === '&&') return bin(this.cond(node.left), '&&', this.cond(node.right));
          if (node.operator === '||') return bin(this.cond(node.left), '||', this.cond(node.right));
          break;
        case 'UnaryExpression':
          if (node.operator === '!') return un('!', this.cond(node.argument));
          break;
        case 'Literal':
          if (typeof node.value === 'boolean') return bool(node.value);
          break;
        default:
          break;
      }
      const t = this.typeOf(node);
      const e = this.expr(node);
      if (isBoolType(t) || this.isComparison(node)) return e;
      if (isArrayType(t) || (isObjectType(t) && !isStringType(t))) return e;
      return fcall('js_truthy', [e]);
    }

    isComparison(node) {
      return node && ((node.type === 'BinaryExpression' && ['==', '!=', '===', '!==', '<', '>', '<=', '>=', 'instanceof', 'in'].includes(node.operator))
        || ['IsArrayCheck', 'IsIntegerCheck', 'IsNaNCheck', 'IsFiniteCheck', 'IsSafeIntegerCheck', 'ArrayIncludes', 'StringIncludes', 'InstanceOfCheck'].includes(node.type));
    }

    // ------------------------------------------------------------------
    // Expressions
    // ------------------------------------------------------------------

    /**
     * An IL expression as a Ruby expression.
     * @param {object} node - IL node
     * @param {object} [ctx] - { lowBits: the parent keeps only the low 32 bits; statement: value unused; receiver }
     */
    expr(node, ctx = {}) {
      if (!node) return nil();
      const handler = this[`x${node.type}`];
      if (typeof handler === 'function') return handler.call(this, node, ctx);
      return fcall('js_unsupported', [str(String(node.type))]);
    }

    exprs(nodes) {
      return (nodes || []).map(n => n && n.type === 'SpreadElement' ? new RubySplat(this.spreadValue(n.argument)) : this.expr(n));
    }

    spreadValue(node) {
      const t = this.typeOf(node);
      if (isArrayType(t) && !TYPED_ARRAY_KINDS[t]) return this.expr(node);
      return fcall('js_spread', [this.expr(node)]);
    }

    // --- literals and names ---

    xLiteral(node) {
      const v = node.value;
      if (node.regex) return fcall('js_regex', [str(node.regex.pattern), str(node.regex.flags || '')]);
      if (v === null || v === undefined) return nil();
      if (typeof v === 'boolean') return bool(v);
      if (typeof v === 'string') {
        if (node.bigint) return int(node.bigint);
        return str(v);
      }
      if (typeof v === 'bigint') return int(v);
      if (typeof v === 'number') {
        if (Number.isInteger(v)) return int(exactInteger(v));
        return new RubyLiteral(v, 'float');
      }
      if (node.bigint) return int(String(node.bigint).replace(/n$/, ''));
      return nil();
    }

    xIdentifier(node) {
      const name = node.name;
      const binding = this.scope ? this.scope.lookup(name) : null;
      if (binding) return this.useLocal(binding);
      switch (name) {
        case 'undefined': return nil();
        case 'NaN': return raw('JS::NAN');
        case 'Infinity': return raw('JS::INF');
        case 'globalThis': case 'window': case 'self': case 'global': return raw('JsObjectG');
        default: break;
      }
      if (this.moduleNames.has(name)) return id(this.moduleNames.get(name));
      if (this.classes.has(name)) return id(this.rubyClassName(name));
      if (FRAMEWORK_CLASSES.has(name) || FRAMEWORK_ENUMS.has(name)) return id(name);
      if (FRAMEWORK_FUNCTIONS.has(name)) return raw(`method(:${name})`);
      if (JS_GLOBALS[name]) return id(JS_GLOBALS[name]);
      if (TYPED_ARRAY_KINDS[name]) return raw(`JSTypedArray`);
      return id(this.globalName(name));
    }

    xThisExpression() {
      return id('self');
    }

    xSuper() {
      return id('super');
    }

    // --- operators ---

    xBinaryExpression(node, ctx) {
      const op = node.operator;
      const L = node.left, R = node.right;
      const big = node.bigint === true || ((this.isBig(L) || this.isBig(R)) && node.bigint !== false && !this.isFloat(L) && !this.isFloat(R));
      switch (op) {
        case '+': return this.addition(node, ctx, big);
        case '-': case '*': case '/': case '%': case '**': return this.arithmetic(node, ctx, big);
        case '&': case '|': case '^': case '<<': case '>>': case '>>>': return this.bitwise(node, ctx, big);
        case '===': case '!==': case '==': case '!=': return this.equality(node);
        case '<': case '>': case '<=': case '>=': return this.relational(node);
        case 'instanceof': return this.instanceOf(L, R);
        case 'in': return fcall('js_in', [this.expr(L), this.expr(R)]);
        default: return fcall('js_unsupported', [str(`operator ${op}`)]);
      }
    }

    /** An integer operand: a float64-typed value is truncated first (ToInt32 does) */
    intOperand(node, ctx = {}) {
      const e = this.expr(node, ctx);
      if (this.isInt(node) || this.isBig(node)) return e;
      return fcall('js_int', [e]);
    }

    /** Normalize an integer result to the IL type (or JavaScript's int32/uint32) */
    normalize(e, type, fallbackSigned32 = true) {
      const t = typeName(type);
      if (isIntType(t)) {
        const [bits, signed] = INT_WIDTH[t];
        if (!signed) return bin(e, '&', raw(MASK[bits]));
        if (bits === 32) return fcall('js_i32', [e]);
        return fcall('js_wrap', [e, int(bits), bool(true)]);
      }
      if (isBigIntType(t)) return e;
      return fallbackSigned32 ? fcall('js_i32', [e]) : bin(e, '&', raw(MASK[32]));
    }

    bitwise(node, ctx, big) {
      const op = node.operator;
      const L = node.left, R = node.right;
      if (big) {
        const l = this.expr(L), r = this.expr(R);
        if (op === '>>>') return fcall('js_unsupported', [str('>>> on BigInt')]);
        return bin(l, op, r);
      }
      const type = this.typeOf(node);
      const shiftAmount = rNode => {
        if (rNode.type === 'Literal' && typeof rNode.value === 'number') return int(((rNode.value % 32) + 32) % 32);
        const e = this.intOperand(rNode);
        const bits = this.unsignedBits(rNode);
        return bits !== null && bits <= 5 ? e : bin(e, '&', int(31));
      };
      if (op === '>>>') {
        const lb = this.unsignedBits(L);
        const left = lb !== null && lb <= 32 ? this.expr(L) : bin(this.intOperand(L, { lowBits: true }), '&', raw(MASK[32]));
        const e = bin(left, '>>', shiftAmount(R));
        // a uint32 result; an int32 type cannot hold a shift by 0 of a large value, but the IL says what it is
        if (isIntType(type) && INT_WIDTH[typeName(type)][0] < 32) return this.normalize(e, type);
        return e;
      }
      if (op === '>>') {
        const t = this.typeOf(L);
        const left = (isIntType(t) && (INT_WIDTH[t][1] ? INT_WIDTH[t][0] <= 32 : INT_WIDTH[t][0] < 32)) || (L.type === 'Literal' && L.value >= -0x80000000 && L.value <= 0x7FFFFFFF)
          ? this.expr(L) : fcall('js_i32', [this.intOperand(L, { lowBits: true })]);
        const e = bin(left, '>>', shiftAmount(R));
        if (isUnsignedType(type) && !ctx.lowBits) return this.normalize(e, type);
        return e;
      }
      if (op === '<<') {
        const e = bin(this.intOperand(L, { lowBits: true }), '<<', shiftAmount(R));
        return ctx.lowBits ? e : this.normalize(e, type);
      }
      // & | ^
      const lb = this.unsignedBits(L), rb = this.unsignedBits(R);
      const l = this.intOperand(L, { lowBits: true });
      const r = this.intOperand(R, { lowBits: true });
      const e = bin(l, op, r);
      if (ctx.lowBits) return e;
      const t = typeName(type);
      const width = isIntType(t) ? INT_WIDTH[t][0] : 32;
      const signed = isIntType(t) ? INT_WIDTH[t][1] : true;
      // In range without masking: a non-negative mask operand bounds &, narrow unsigned operands bound everything
      if (op === '&') {
        const bound = Math.min(lb === null ? 99 : lb, rb === null ? 99 : rb);
        if (bound <= (signed ? width - 1 : width)) return e;
      } else if (lb !== null && rb !== null && Math.max(lb, rb) <= (signed ? width - 1 : width)) {
        return e;
      } else if (signed && width === 32 && this.isSigned32(L) && this.isSigned32(R)) {
        return e;
      }
      return this.normalize(e, type);
    }

    isSigned32(node) {
      const t = this.typeOf(node);
      if (isIntType(t)) {
        const [bits, signed] = INT_WIDTH[t];
        return signed ? bits <= 32 : bits < 32;
      }
      return node.type === 'Literal' && Number.isInteger(node.value) && node.value >= -0x80000000 && node.value <= 0x7FFFFFFF;
    }

    addition(node, ctx, big) {
      const L = node.left, R = node.right;
      const type = this.typeOf(node);
      const ls = this.isStr(L), rs = this.isStr(R);
      if (isStringType(type) || ls || rs) {
        const part = (n, isStr) => {
          if (isStr && (n.type === 'Literal' || (n.type === 'BinaryExpression' && n.operator === '+' && isStringType(this.typeOf(n))))) return this.expr(n);
          return fcall('js_str', [this.expr(n)]);
        };
        return bin(part(L, ls), '+', part(R, rs));
      }
      if (big) return bin(this.expr(L), '+', this.expr(R));
      if (this.isNum(L) && this.isNum(R)) {
        const lowBits = ctx.lowBits && this.isInt(L) && this.isInt(R);
        return bin(this.expr(L, { lowBits }), '+', this.expr(R, { lowBits }));
      }
      return fcall('js_add', [this.expr(L), this.expr(R)]);
    }

    arithmetic(node, ctx, big) {
      const op = node.operator;
      const L = node.left, R = node.right;
      if (big) {
        const l = this.expr(L), r = this.expr(R);
        if (op === '/') return fcall('js_bdiv', [l, r]);
        if (op === '%') return call(l, 'remainder', [r]);
        if (op === '**') return fcall('js_bpow', [l, r]);
        return bin(l, op, r);
      }
      const ints = this.isInt(L) && this.isInt(R);
      const nums = this.isNum(L) && this.isNum(R);
      switch (op) {
        case '-':
          if (nums) {
            const lowBits = ctx.lowBits && ints;
            return bin(this.expr(L, { lowBits }), '-', this.expr(R, { lowBits }));
          }
          return fcall('js_sub', [this.expr(L), this.expr(R)]);
        case '*': {
          // An OpCodes multiply the IL lowered (Mul32: Math.imul) is exact, not a rounded double product
          if (node.opCodesMethod) {
            const lowBits = !!ctx.lowBits;
            return bin(this.intOperand(L, { lowBits }), '*', this.intOperand(R, { lowBits }));
          }
          if (ints) {
            const lb = this.magnitudeBits(L), rb = this.magnitudeBits(R);
            if (lb + rb <= 53) return bin(this.expr(L, { lowBits: false }), '*', this.expr(R));
          }
          return fcall('js_mul', [this.expr(L), this.expr(R)]);
        }
        case '/':
          return fcall('js_div', [this.expr(L), this.expr(R)]);
        case '%':
          if (ints && this.unsignedBits(L) !== null && this.unsignedBits(R) !== null && !(R.type === 'Literal' && R.value === 0))
            return bin(this.expr(L), '%', this.expr(R));
          return fcall('js_mod', [this.expr(L), this.expr(R)]);
        case '**':
          return fcall('js_pow', [this.expr(L), this.expr(R)]);
        default:
          return fcall('js_unsupported', [str(op)]);
      }
    }

    /** Bits needed for the magnitude of an integer-typed node (for exact products) */
    magnitudeBits(node) {
      if (node.type === 'Literal' && typeof node.value === 'number') return Math.max(1, Math.ceil(Math.log2(Math.abs(node.value) + 1)));
      if (node.type === 'ArrayLength') return 31;
      const t = this.typeOf(node);
      if (isIntType(t)) return INT_WIDTH[t][0];
      return 64;
    }

    equality(node) {
      const op = node.operator;
      const L = node.left, R = node.right;
      const negate = op === '!==' || op === '!=';
      const strict = op === '===' || op === '!==';
      const wrap = e => negate ? un('!', e) : e;
      if (this.isNullLiteral(L) || this.isNullLiteral(R)) {
        const other = this.isNullLiteral(L) ? R : L;
        if (this.isNullLiteral(other)) return bool(!negate);
        return wrap(call(this.expr(other), 'nil?'));
      }
      // typeof x === 'type'
      if (L.type === 'TypeOfExpression' || R.type === 'TypeOfExpression') {
        const l = this.expr(L), r = this.expr(R);
        return bin(l, negate ? '!=' : '==', r);
      }
      const lt = this.typeOf(L), rt = this.typeOf(R);
      const prim = n => this.isNum(n) || this.isStr(n) || this.isBool(n);
      const literal = n => n.type === 'Literal' && !n.regex && n.value !== null;
      if ((prim(L) && prim(R) && (this.isNum(L) === this.isNum(R))) || literal(L) || literal(R))
        return bin(this.expr(L), negate ? '!=' : '==', this.expr(R));
      if (strict && (isArrayType(lt) || isObjectType(lt)) && (isArrayType(rt) || isObjectType(rt)) && !isStringType(lt) && !isStringType(rt))
        return wrap(call(this.expr(L), 'equal?', [this.expr(R)]));
      return wrap(fcall(strict ? 'js_strict_eq' : 'js_loose_eq', [this.expr(L), this.expr(R)]));
    }

    relational(node) {
      const op = node.operator;
      const L = node.left, R = node.right;
      if ((this.isNum(L) && this.isNum(R)) || (this.isStr(L) && this.isStr(R)))
        return bin(this.expr(L), op, this.expr(R));
      const fn = { '<': 'js_lt', '>': 'js_gt', '<=': 'js_le', '>=': 'js_ge' }[op];
      return fcall(fn, [this.expr(L), this.expr(R)]);
    }

    instanceOf(L, R) {
      const value = this.expr(L);
      if (R && R.type === 'Identifier') {
        const name = R.name;
        if (name === 'Array') return fcall('js_is_array', [value]);
        if (TYPED_ARRAY_KINDS[name]) return raw(`(${this.code(value)}.respond_to?(:js_kind) && ${this.code(value)}.js_kind == :${TYPED_ARRAY_KINDS[name]})`);
        if (ERROR_TYPES.has(name)) return call(value, 'is_a?', [id('Exception')]);
        if (name === 'Object') return un('!', call(value, 'nil?'));
        if (name === 'Function') return call(value, 'respond_to?', [raw(':call')]);
        if (name === 'Map') return call(value, 'is_a?', [id('JSMap')]);
        if (name === 'Set') return call(value, 'is_a?', [id('JSSet')]);
        if (name === 'String') return call(value, 'is_a?', [id('String')]);
        if (name === 'Number') return call(value, 'is_a?', [id('Numeric')]);
        if (name === 'ArrayBuffer') return call(value, 'is_a?', [id('JSArrayBuffer')]);
      }
      return fcall('js_instanceof', [value, this.expr(R)]);
    }

    /** Ruby source of an expression node (for verbatim composition) */
    code(e) {
      const { RubyEmitter } = typeof require !== 'undefined' ? require('./RubyEmitter.js') : { RubyEmitter: global.RubyEmitter };
      return new RubyEmitter({}).expr(e, 20);
    }

    xLogicalExpression(node) {
      const op = node.operator;
      const L = node.left, R = node.right;
      if (op === '&&' || op === '||') {
        if (this.isBool(L) && this.isBool(R)) return bin(this.expr(L), op, this.expr(R));
        const lt = this.typeOf(L);
        if (op === '||' && (isArrayType(lt) || isObjectType(lt)) && !isStringType(lt)) return bin(this.expr(L), '||', this.expr(R));
        if (op === '&&' && (isArrayType(lt) || isObjectType(lt)) && !isStringType(lt)) return bin(this.expr(L), '&&', this.expr(R));
        const c = new RubyMethodCall(null, op === '&&' ? 'js_and' : 'js_or', [this.expr(L)]);
        c.block = { nodeType: 'BlockExpression', parameters: [], body: this.expr(R) };
        return c;
      }
      if (op === '??') {
        const c = new RubyMethodCall(null, 'js_nc', [this.expr(L)]);
        c.block = { nodeType: 'BlockExpression', parameters: [], body: this.expr(R) };
        return c;
      }
      return fcall('js_unsupported', [str(op)]);
    }

    xUnaryExpression(node, ctx) {
      const op = node.operator;
      const arg = node.argument;
      switch (op) {
        case '!': return un('!', this.cond(arg));
        case '-':
          if (arg.type === 'Literal' && typeof arg.value === 'number') {
            if (Number.isInteger(arg.value)) return int(exactInteger(-arg.value));
            return new RubyLiteral(-arg.value, 'float');
          }
          if (this.isNum(arg)) return un('-', this.expr(arg));
          return fcall('js_neg', [this.expr(arg)]);
        case '+':
          return this.isNum(arg) ? this.expr(arg) : fcall('js_num', [this.expr(arg)]);
        case '~': {
          if (this.isBig(arg) || node.bigint) return un('~', this.expr(arg));
          const e = un('~', this.intOperand(arg, { lowBits: true }));
          if (ctx.lowBits) return e;
          const t = this.typeOf(node);
          if (this.isSigned32(arg) && (!isIntType(t) || INT_WIDTH[t][1])) return e;
          return this.normalize(e, t);
        }
        case 'typeof':
          return fcall('js_typeof', [this.expr(arg)]);
        case 'void':
          return raw(`(${this.code(this.expr(arg))}; nil)`);
        case 'delete':
          return this.deleteOf(arg);
        case '++': case '--':
          return this.updateExpression({ operator: op, prefix: true, argument: arg, resultType: node.resultType }, ctx.statement);
        default:
          return fcall('js_unsupported', [str(`unary ${op}`)]);
      }
    }

    deleteOf(arg) {
      if (arg && arg.type === 'MemberExpression') {
        const key = arg.computed ? this.expr(arg.property) : str(arg.property.name || String(arg.property.value));
        return fcall('js_delete', [this.expr(arg.object), key]);
      }
      if (arg && arg.type === 'ThisPropertyAccess') return fcall('js_delete', [id('self'), arg.computed ? this.thisComputedKey(arg.property) : str(String(arg.property))]);
      return bool(true);
    }

    xDeleteExpression(node) {
      return this.deleteOf(node.argument);
    }

    xTypeOfExpression(node) {
      const hint = typeName(node.inferredType || (node.argument && node.argument.resultType));
      const args = [this.expr(node.argument)];
      if (isBigIntType(hint)) args.push(str('bigint'));
      return fcall('js_typeof', args);
    }

    xConditionalExpression(node) {
      return new RubyConditional(this.cond(node.test), this.expr(node.consequent), this.expr(node.alternate));
    }

    xSequenceExpression(node) {
      return new RubySequence((node.expressions || []).map(e => this.expr(e, { statement: true })));
    }

    // --- assignment ---

    xAssignmentExpression(node, ctx) {
      return this.assignmentExpression(node, ctx.statement);
    }

    assignmentExpression(node, statement) {
      const op = node.operator;
      const target = node.left;
      if (target && ['ArrayPattern', 'ObjectPattern', 'ArrayExpression', 'ArrayLiteral', 'ObjectLiteral', 'ObjectExpression'].includes(target.type)) {
        const stmts = this.destructure(this.asPattern(target), node.right, false, null);
        return new RubySequence(stmts.map(s => s.expression || raw('nil')));
      }
      if (op === '=') return this.assignTo(target, this.expr(node.right));
      const base = op.slice(0, -1);
      if (base === '&&' || base === '||' || base === '??') {
        const helper = base === '&&' ? 'js_and' : base === '||' ? 'js_or' : 'js_nc';
        const c = new RubyMethodCall(null, helper, [this.readTarget(target)]);
        c.block = { nodeType: 'BlockExpression', parameters: [], body: this.expr(node.right) };
        return this.assignTo(target, c);
      }
      // x op= y is x = x op y, with the operator's JavaScript meaning and the target's type
      const synthetic = { type: 'BinaryExpression', operator: base, left: target, right: node.right, resultType: node.resultType || target.resultType, bigint: node.bigint };
      if (!this.isPureTarget(target)) {
        // Evaluate the target's object and index once
        return this.compoundOnImpureTarget(target, synthetic);
      }
      return this.assignTo(target, this.expr(synthetic));
    }

    /** An array or object literal written as an assignment target, as the pattern it means */
    asPattern(node) {
      if (!node) return node;
      if (node.type === 'ArrayExpression' || node.type === 'ArrayLiteral')
        return { type: 'ArrayPattern', elements: (node.elements || []).map(e => e && e.type === 'SpreadElement' ? { type: 'RestElement', argument: this.asPattern(e.argument) } : this.asPattern(e)) };
      if (node.type === 'ObjectLiteral' || node.type === 'ObjectExpression')
        return { type: 'ObjectPattern', properties: (node.properties || []).map(p => ({ key: typeof p.key === 'string' ? { name: p.key } : p.key, computed: p.computed, value: this.asPattern(p.value) })) };
      if (node.type === 'AssignmentExpression' && node.operator === '=') return { type: 'AssignmentPattern', left: this.asPattern(node.left), right: node.right };
      return node;
    }

    isPureTarget(t) {
      if (!t) return true;
      if (t.type === 'Identifier') return true;
      if (t.type === 'ThisPropertyAccess') return !t.computed || typeof t.property !== 'object' || this.isPure(t.property);
      if (t.type === 'MemberExpression') return this.isPure(t.object) && (!t.computed || this.isPure(t.property));
      return false;
    }

    compoundOnImpureTarget(target, synthetic) {
      const objTemp = this.tempName('o');
      const keyTemp = this.tempName('k');
      const objNode = target.type === 'ThisPropertyAccess' ? { type: 'ThisExpression' } : target.object;
      const keyNode = target.type === 'ThisPropertyAccess' ? (target.computed ? (typeof target.property === 'object' ? target.property : { type: '__RubyKey', property: target.property }) : { type: 'Literal', value: String(target.property) }) : (target.computed ? target.property : { type: 'Literal', value: target.property.name });
      const tempTarget = { type: 'MemberExpression', computed: true, object: { type: '__RubyTemp', name: objTemp, resultType: objNode.resultType }, property: { type: '__RubyTemp', name: keyTemp, resultType: keyNode.resultType || 'int32' }, resultType: target.resultType };
      const s = { ...synthetic, left: tempTarget };
      return new RubySequence([
        assign(id(objTemp), this.expr(objNode)),
        assign(id(keyTemp), this.expr(keyNode)),
        this.assignTo(tempTarget, this.expr(s))
      ]);
    }

    x__RubyKey(node) {
      return this.thisComputedKey(node.property);
    }

    x__RubyTemp(node) {
      return id(node.name);
    }

    readTarget(target) {
      return this.expr(target);
    }

    /** target = value for any assignable IL node */
    assignTo(target, value) {
      if (!target) return value;
      switch (target.type) {
        case 'Identifier': {
          const binding = this.scope.lookup(target.name);
          if (binding) {
            this.markAssigned(binding.name);
            return assign(id(binding.name), value);
          }
          if (this.moduleNames.has(target.name)) return assign(id(this.moduleNames.get(target.name)), value);
          // An undeclared name assigned in sloppy code: a module global
          return assign(id(this.globalName(target.name)), value);
        }
        case '__RubyTemp':
          return assign(id(target.name), value);
        case 'ThisPropertyAccess':
          if (target.computed) return assign(new RubyIndex(id('self'), this.thisComputedKey(target.property)), value);
          return this.thisAssign(typeof target.property === 'string' ? target.property : target.property.name, value);
        case 'MemberExpression':
          return this.memberAssign(target, value);
        case 'ArrayLength':
          return fcall('js_set_length', [this.expr(target.array), value]);
        default:
          return fcall('js_unsupported', [str(`assignment to ${target.type}`)]);
      }
    }

    thisAssign(name, value) {
      if (this.isStatic) return assign(prop(id('self'), this.memberName(name)), value);
      if (this.accessorNames.has(name)) return assign(prop(id('self'), this.memberName(name)), value);
      return assign(id(this.ivarName(name)), value);
    }

    memberAssign(target, value) {
      const obj = target.object;
      if (target.computed) {
        const objType = this.typeOf(obj);
        const key = this.expr(target.property);
        if (isArrayType(objType) && this.isInt(target.property)) return assign(new RubyIndex(this.expr(obj, { receiver: true }), key), value);
        return fcall('js_set', [this.expr(obj), key, value]);
      }
      const name = target.property && (target.property.name !== undefined ? target.property.name : String(target.property.value));
      if (name === 'length' && (isArrayType(this.typeOf(obj)) || isUnknownType(this.typeOf(obj)))) return fcall('js_set_length', [this.expr(obj), value]);
      if (obj && obj.type === 'ThisExpression') return this.thisAssign(name, value);
      return assign(prop(this.expr(obj, { receiver: true }), this.memberName(name)), value);
    }

    xUpdateExpression(node, ctx) {
      return this.updateExpression(node, ctx.statement);
    }

    updateExpression(node, statement) {
      const delta = node.operator === '++' ? '+' : '-';
      const target = node.argument;
      const numeric = this.isNum(target);
      if (!this.isPureTarget(target)) {
        const synthetic = { type: 'BinaryExpression', operator: delta, left: target, right: { type: 'Literal', value: 1, resultType: 'int32' }, resultType: target.resultType };
        const seq = this.compoundOnImpureTarget(target, synthetic);
        if (statement || node.prefix) return seq;
        return bin(seq, delta === '+' ? '-' : '+', int(1));
      }
      let newValue;
      if (numeric) newValue = bin(this.expr(target), delta, int(1));
      else newValue = fcall(delta === '+' ? 'js_inc' : 'js_dec', [this.expr(target)]);
      if (statement) {
        if (numeric && (target.type === 'Identifier' || target.type === 'ThisPropertyAccess' || target.type === 'MemberExpression')) {
          const read = this.assignTo(target, int(1));
          if (read.nodeType === 'Assignment') return assign(read.target, int(1), delta + '=');
        }
        return this.assignTo(target, newValue);
      }
      const assigned = this.assignTo(target, newValue);
      if (node.prefix) return assigned;
      return numeric ? bin(assigned, delta === '+' ? '-' : '+', int(1)) : fcall('js_num', [fcall(delta === '+' ? 'js_dec' : 'js_inc', [assigned])]);
    }

    // --- members ---

    xMemberExpression(node, ctx) {
      const obj = node.object;
      if (node.computed) {
        const objType = this.typeOf(obj);
        if ((isArrayType(objType) || isStringType(objType)) && this.isInt(node.property))
          return new RubyIndex(this.expr(obj, { receiver: true }), this.expr(node.property));
        return fcall('js_get', [this.expr(obj), this.expr(node.property)]);
      }
      const name = node.property && (node.property.name !== undefined ? node.property.name : String(node.property.value));
      return this.propertyRead(obj, name, node);
    }

    propertyRead(obj, name, node) {
      if (obj && obj.type === 'Identifier') {
        const special = this.globalMember(obj.name, name);
        if (special) return special;
        if (this.classes.has(obj.name) && !(this.scope && this.scope.lookup(obj.name))) {
          const info = this.classInfo(obj.name);
          if (this.hierarchyHasStaticMethod(obj.name, name)) return raw(`${info.rubyName}.method(:${this.memberName(name)})`);
          return prop(id(info.rubyName), this.memberName(name));
        }
      }
      if (obj && obj.type === 'ThisExpression') return this.thisRead(name);
      if (obj && obj.type === 'Super') return fcall('js_unsupported', [str('super property')]);
      const objType = this.typeOf(obj);
      const receiver = this.expr(obj, { receiver: true });
      if (name === 'length') {
        if (isArrayType(objType) || isStringType(objType)) return prop(receiver, 'length');
        if (isObjectType(objType) && !this.classes.has(objType)) return fcall('js_prop', [receiver, str('length')]);
      }
      if (isArrayType(objType) || isStringType(objType) || isNumericType(objType) || isUnknownType(objType) || isBoolType(objType))
        return fcall('js_prop', [receiver, str(name)]);
      // A method of a known class read without a call: a bound Method
      if (this.classes.has(objType) && this.hierarchyHasMethod(objType, name) && !this.hierarchyHasField(objType, name))
        return call(receiver, 'method', [raw(`:${this.memberName(name)}`)]);
      return prop(receiver, this.memberName(name));
    }

    thisRead(name) {
      if (this.isStatic) return prop(id('self'), this.memberName(name));
      if (this.accessorNames.has(name)) return prop(id('self'), this.memberName(name));
      const cls = this.currentClass;
      if (cls && this.hierarchyHasMethod(cls.jsName, name) && !this.hierarchyHasField(cls.jsName, name))
        return raw(`method(:${this.memberName(name)})`);
      return id(this.ivarName(name));
    }

    /**
     * The key of this[...]: the IL keeps only the name of an identifier key
     * (this[k]) or the value of a literal one (this['k']); a name bound to a
     * variable in scope is that variable.
     */
    thisComputedKey(property) {
      if (property && typeof property === 'object') return this.expr(property);
      if (typeof property === 'number') return int(property);
      if (typeof property === 'string' && /^[A-Za-z_$][\w$]*$/.test(property)
        && ((this.scope && this.scope.lookup(property)) || this.moduleNames.has(property)))
        return this.xIdentifier({ type: 'Identifier', name: property });
      return str(String(property));
    }

    xThisPropertyAccess(node) {
      if (node.computed) return new RubyIndex(id('self'), this.thisComputedKey(node.property));
      return this.thisRead(typeof node.property === 'string' ? node.property : node.property.name);
    }

    /** Members of JavaScript globals and of the framework: Math.PI, Number.MAX_SAFE_INTEGER, ... */
    globalMember(objName, name) {
      if (this.scope && this.scope.lookup(objName)) return null;
      if (this.moduleNames.has(objName)) return null;
      // A function of a global object read as a value (String.fromCharCode.apply, Math.max as a callback)
      const asFunction = target => /^[a-z]/.test(name) ? raw(`${target}.method(:${name})`) : prop(id(target), name);
      switch (objName) {
        case 'Math':
          if (name === 'PI') return raw('Math::PI');
          if (name === 'E') return raw('Math::E');
          if (/^[a-z]/.test(name)) return raw(`->(*a) { js_math(${JSON.stringify(name)}, *a) }`);
          return prop(id('JsMath'), name);
        case 'Number':
          return asFunction('JsNumber');
        case 'String': case 'Array': case 'Object': case 'BigInt': case 'JSON': case 'console':
          return asFunction(JS_GLOBALS[objName]);
        case 'AlgorithmFramework':
          if (FRAMEWORK_CLASSES.has(name) || FRAMEWORK_ENUMS.has(name)) return id(name);
          if (FRAMEWORK_FUNCTIONS.has(name)) return raw(`method(:${name})`);
          return prop(id('AlgorithmFramework'), name);
        case 'OpCodes':
          if (name === 'UInt64') return prop(id('OpCodes'), name);
          return raw(`OpCodes.method(:${name})`);
        default:
          if (JS_GLOBALS[objName] && !this.classes.has(objName)) return prop(id(JS_GLOBALS[objName]), name);
          return null;
      }
    }

    // --- calls ---

    xCallExpression(node) {
      const callee = node.callee;
      const args = node.arguments || [];
      if (!callee) return nil();
      if (callee.type === 'Identifier') return this.callIdentifier(callee, args, node);
      if (callee.type === 'Super') return new RubySuper(this.exprs(args));
      if (callee.type === 'MemberExpression') return this.callMember(callee, args, node);
      if (callee.type === 'ThisPropertyAccess') return this.callThisMember(!callee.computed && typeof callee.property === 'string' ? callee.property : null, args, callee);
      return fcall('js_call', [this.expr(callee), ...this.exprs(args)]);
    }

    callIdentifier(callee, args, node) {
      const name = callee.name;
      const binding = this.scope ? this.scope.lookup(name) : null;
      if (binding) return lambdaCall(this.useLocal(binding), this.exprs(args));
      if (this.moduleNames.has(name)) return lambdaCall(id(this.moduleNames.get(name)), this.exprs(args));
      if (FRAMEWORK_FUNCTIONS.has(name)) return fcall(name, this.exprs(args));
      const a = this.exprs(args);
      switch (name) {
        case 'parseInt': return fcall('js_parse_int', a);
        case 'parseFloat': return fcall('js_parse_float', a);
        case 'isNaN': return raw(`js_num(${this.code(a[0] || nil())}).then { |v| v.is_a?(Float) && v.nan? }`);
        case 'isFinite': return call(id('JsNumber'), 'isFinite', [fcall('js_num', [a[0] || nil()])]);
        case 'Number': return a.length ? fcall('js_num', a) : int(0);
        case 'String': return a.length ? fcall('js_str', a) : str('');
        case 'Boolean': return a.length ? fcall('js_truthy', a) : bool(false);
        case 'BigInt': return fcall('js_bigint', a);
        case 'Array': return fcall('js_array_new', a);
        case 'Object': return a.length ? a[0] : raw('JSObject.new');
        case 'Symbol': return call(raw('Object'), 'new');
        case 'require': return nil();
        default: break;
      }
      if (ERROR_TYPES.has(name)) return call(id('JSError'), 'new', [a[0] || nil(), str(name)]);
      if (this.classes.has(name)) return call(id(this.rubyClassName(name)), 'new', a);
      return lambdaCall(id(this.globalName(name)), a);
    }

    callMember(callee, args, node) {
      const obj = callee.object;
      const computed = callee.computed;
      const name = computed ? null : (callee.property && (callee.property.name !== undefined ? callee.property.name : String(callee.property.value)));
      if (computed) {
        return fcall('js_invoke', [this.expr(obj), fcall('js_key', [this.expr(callee.property)]), ...this.exprs(args)]);
      }
      if (obj && obj.type === 'ThisExpression') return this.callThisMember(name, args, callee);
      if (obj && obj.type === 'Super') {
        return this.parentMethodCall(name, args);
      }
      if (obj && obj.type === 'Identifier' && !(this.scope && this.scope.lookup(obj.name)) && !this.moduleNames.has(obj.name)) {
        const special = this.globalCall(obj.name, name, args);
        if (special) return special;
        if (this.classes.has(obj.name)) return call(id(this.rubyClassName(obj.name)), this.memberName(name), this.exprs(args));
      }
      // Function.prototype.call/apply/bind on a function value
      const objType = this.typeOf(obj);
      if (['call', 'apply', 'bind'].includes(name) && (objType === 'function' || isUnknownType(objType)) && !this.classes.has(objType)) {
        const fn = this.expr(obj);
        const a = this.exprs(args);
        if (name === 'bind') return fn;
        if (name === 'call') return fcall('js_call', [fn, ...a.slice(1)]);
        return fcall('js_call', [fn, new RubySplat(fcall('js_spread', [a[1] || raw('[]')]))]);
      }
      const receiver = this.expr(obj, { receiver: true });
      const a = this.exprs(args);
      if (this.classes.has(objType) || FRAMEWORK_CLASSES.has(objType)) {
        // A function-valued field is called through its value
        if (this.classes.has(objType) && !this.hierarchyHasMethod(objType, name) && this.hierarchyHasField(objType, name))
          return lambdaCall(prop(receiver, this.memberName(name)), a);
        return call(receiver, this.memberName(name), a);
      }
      if (FRAMEWORK_ENUMS.has(objType)) return fcall('js_invoke', [receiver, str(name), ...a]);
      return fcall('js_invoke', [receiver, str(name), ...a]);
    }

    callThisMember(name, args, callee) {
      const a = this.exprs(args);
      if (name === null) return fcall('js_invoke', [id('self'), fcall('js_key', [this.thisComputedKey(callee.property)]), ...a]);
      const cls = this.currentClass;
      if (this.isStatic) {
        if (cls && !this.hierarchyHasStaticMethod(cls.jsName, name) && cls.staticFields.has(name))
          return lambdaCall(prop(id('self'), this.memberName(name)), a);
        return call(id('self'), this.memberName(name), a);
      }
      if (cls && !this.hierarchyHasMethod(cls.jsName, name) && this.hierarchyHasField(cls.jsName, name) && !this.accessorNames.has(name))
        return lambdaCall(id(this.ivarName(name)), a);
      return call(id('self'), this.memberName(name), a);
    }

    xThisMethodCall(node) {
      return this.callThisMember(node.method, node.arguments || [], node);
    }

    xParentConstructorCall(node) {
      return new RubySuper(this.exprs(node.arguments || []));
    }

    xParentMethodCall(node) {
      return this.parentMethodCall(node.method, node.arguments || []);
    }

    parentMethodCall(name, args) {
      const a = this.exprs(args);
      if (name === this.currentMethod) return new RubySuper(a);
      const cls = this.currentClass;
      const parent = cls && cls.superName ? (this.classes.has(cls.superName) ? this.rubyClassName(cls.superName) : cls.superName) : 'JSBase';
      return call(call(id(parent), 'instance_method', [raw(`:${this.memberName(name)}`)]), 'bind_call', [id('self'), ...a]);
    }

    /** Calls on JavaScript globals (Math.max, Object.keys, String.fromCharCode, ...) */
    globalCall(objName, name, args) {
      const a = this.exprs(args);
      switch (objName) {
        case 'Math':
          switch (name) {
            case 'floor': return this.floorOf(args[0]);
            case 'ceil': return fcall('js_ceil', a);
            case 'round': return fcall('js_round', a);
            case 'trunc': return fcall('js_trunc', a);
            case 'abs': return fcall('js_abs', a);
            case 'min': return fcall('js_min', a);
            case 'max': return fcall('js_max', a);
            case 'pow': return fcall('js_pow', a);
            case 'sqrt': return fcall('js_sqrt', a);
            case 'imul': return fcall('js_imul', a);
            case 'clz32': return fcall('js_clz32', a);
            case 'sign': return fcall('js_sign', a);
            case 'fround': return fcall('js_fround', a);
            case 'random': return raw('rand');
            default: return fcall('js_math', [str(name), ...a]);
          }
        case 'Number': return call(id('JsNumber'), name, a);
        case 'String': return call(id('JsString'), name, a);
        case 'Array':
          if (name === 'isArray') return fcall('js_is_array', a);
          if (name === 'from') return fcall('js_array_from', a);
          if (name === 'of') return new RubyArrayLiteral(a);
          return call(id('JsArray'), name, a);
        case 'Object': return call(id('JsObjectG'), name, a);
        case 'BigInt': return call(id('JsBigInt'), name, a);
        case 'JSON': return call(id('JsJSON'), name, a);
        case 'console': return call(id('JsConsole'), name, a);
        case 'OpCodes': return call(id('OpCodes'), name, a);
        case 'AlgorithmFramework':
          if (FRAMEWORK_FUNCTIONS.has(name)) return fcall(name, a);
          return call(id('AlgorithmFramework'), name, a);
        case 'Date':
          if (name === 'now') return raw('(Time.now.to_f * 1000).to_i');
          return null;
        default:
          if (TYPED_ARRAY_KINDS[objName] && name === 'from') return call(id('JSTypedArray'), 'create', [raw(`:${TYPED_ARRAY_KINDS[objName]}`), ...a]);
          if (TYPED_ARRAY_KINDS[objName] && name === 'of') return call(id('JSTypedArray'), 'create', [raw(`:${TYPED_ARRAY_KINDS[objName]}`), new RubyArrayLiteral(a)]);
          return null;
      }
    }

    xNewExpression(node) {
      const callee = node.callee;
      const args = node.arguments || [];
      const a = this.exprs(args);
      if (callee && callee.type === 'Identifier' && !(this.scope && this.scope.lookup(callee.name)) && !this.moduleNames.has(callee.name)) {
        const name = callee.name;
        if (this.classes.has(name)) return call(id(this.rubyClassName(name)), 'new', a);
        if (FRAMEWORK_CLASSES.has(name)) return call(id(name), 'new', a);
        if (ERROR_TYPES.has(name)) return call(id('JSError'), 'new', [a[0] || nil(), str(name)]);
        if (TYPED_ARRAY_KINDS[name]) return fcall('js_typed_new', [raw(`:${TYPED_ARRAY_KINDS[name]}`), ...a]);
        switch (name) {
          case 'Map': case 'WeakMap': return call(id('JSMap'), 'new', a);
          case 'Set': case 'WeakSet': return call(id('JSSet'), 'new', a);
          case 'Array': return fcall('js_array_new', a);
          case 'Object': return raw('JSObject.new');
          case 'ArrayBuffer': return call(id('JSArrayBuffer'), 'new', a);
          case 'DataView': return call(id('JSDataView'), 'new', a);
          case 'Date': return raw('Time.now');
          default: break;
        }
      }
      if (callee && callee.type === 'MemberExpression' && !callee.computed && callee.object && callee.object.type === 'Identifier') {
        const pn = callee.property && callee.property.name;
        if (callee.object.name === 'AlgorithmFramework' && FRAMEWORK_CLASSES.has(pn)) return call(id(pn), 'new', a);
        if (callee.object.name === 'OpCodes' && pn === '_BitStream') return call(id('JSBitStream'), 'new', a);
      }
      return call(this.expr(callee), 'new', a);
    }

    // --- functions, objects, arrays ---

    xFunctionExpression(node) { return this.functionLambda(node); }
    xArrowFunctionExpression(node) { return this.functionLambda(node); }
    xArrowFunction(node) { return this.functionLambda(node); }
    xFunctionDeclaration(node) { return this.functionLambda(node); }

    xClassExpression(node) {
      if (node.id && this.classes.has(node.id.name)) {
        this.hoistedClasses.push(this.classDeclaration(node));
        return id(this.rubyClassName(node.id.name));
      }
      return fcall('js_unsupported', [str('anonymous class expression')]);
    }

    xArrayExpression(node) {
      return new RubyArrayLiteral((node.elements || []).map(e => {
        if (!e) return nil();
        if (e.type === 'SpreadElement') return new RubySplat(this.spreadValue(e.argument));
        return this.expr(e);
      }));
    }

    xArrayLiteral(node) { return this.xArrayExpression(node); }

    xSpreadElement(node) {
      return new RubySplat(this.spreadValue(node.argument));
    }

    xObjectLiteral(node) {
      const props = node.properties || [];
      const pairs = [];
      const spreads = [];
      for (const p of props) {
        if (p.type === 'ObjectSpread' || p.type === 'SpreadElement') {
          spreads.push({ at: pairs.length, value: this.expr(p.argument) });
          continue;
        }
        if (p.kind === 'get' || p.kind === 'set') {
          pairs.push([str(String(p.key && (p.key.name || p.key))), fcall('js_unsupported', [str('object literal accessor')])]);
          continue;
        }
        let key;
        if (p.computed && typeof p.key === 'object') key = fcall('js_key', [this.expr(p.key)]);
        else key = str(typeof p.key === 'object' && p.key ? String(p.key.name !== undefined ? p.key.name : p.key.value) : String(p.key));
        pairs.push([key, this.expr(p.value)]);
      }
      let result = call(id('JSObject'), 'new', [new RubyHashLiteral(pairs)]);
      if (!pairs.length) result = raw('JSObject.new');
      if (spreads.length) {
        // { ...a, b: 1 }: assign in order (approximating interleaving by placing spreads first)
        result = fcall('js_assign', [raw('JSObject.new'), ...spreads.map(s => s.value), result]);
      }
      return result;
    }

    xObjectExpression(node) {
      return this.xObjectLiteral({ properties: (node.properties || []).map(p => p.type === 'Property' ? { type: 'ObjectProperty', key: p.computed ? p.key : (p.key.name !== undefined ? p.key.name : p.key.value), computed: p.computed, value: p.value, kind: p.kind } : p) });
    }

    xTemplateLiteral(node) {
      const parts = [];
      const quasis = node.quasis || [];
      const exprs = node.expressions || [];
      quasis.forEach((q, i) => {
        const text = q.value ? (q.value.cooked !== undefined ? q.value.cooked : q.value.raw) : '';
        if (text) parts.push(str(text));
        if (i < exprs.length) parts.push(fcall('js_str', [this.expr(exprs[i])]));
      });
      if (!parts.length) return str('');
      return parts.reduce((a, b) => bin(a, '+', b));
    }

    xStringInterpolation(node) {
      const parts = (node.parts || []).map(p => p.type === 'StringPart' ? str(p.value) : fcall('js_str', [this.expr(p.expression)]));
      if (!parts.length) return str('');
      return parts.reduce((a, b) => bin(a, '+', b));
    }

    // ------------------------------------------------------------------
    // IL nodes
    // ------------------------------------------------------------------

    xArrayLength(node) {
      const t = this.typeOf(node.array);
      const recv = this.expr(node.array, { receiver: true });
      if (isArrayType(t) || isStringType(t)) return prop(recv, 'length');
      return fcall('js_prop', [recv, str('length')]);
    }

    xArrayAppend(node) {
      const values = node.values || (node.value ? [node.value] : []);
      return fcall('js_push', [this.expr(node.array), ...this.exprs(values)]);
    }

    xArrayPush(node) { return this.xArrayAppend(node); }
    xArrayPop(node) { return call(this.expr(node.array, { receiver: true }), 'pop'); }
    xArrayShift(node) { return call(this.expr(node.array, { receiver: true }), 'shift'); }
    xArrayUnshift(node) {
      const values = node.values || (node.value ? [node.value] : []);
      return fcall('js_unshift', [this.expr(node.array), ...this.exprs(values)]);
    }

    xArraySlice(node) {
      const args = [this.expr(node.array)];
      if (node.start || node.end) args.push(node.start ? this.expr(node.start) : nil());
      if (node.end) args.push(this.expr(node.end));
      return fcall('js_slice', args);
    }

    xArraySplice(node) {
      const args = [this.expr(node.array), node.start ? this.expr(node.start) : int(0)];
      if (node.deleteCount || (node.items && node.items.length)) args.push(node.deleteCount ? this.expr(node.deleteCount) : nil());
      args.push(...this.exprs(node.items || []));
      return fcall('js_splice', args);
    }

    xArrayFill(node) {
      const arr = node.array;
      if (arr && arr.type === 'ArrayCreation' && !node.start && !node.end && arr.size)
        return call(id('Array'), 'new', [this.intOperand(arr.size), this.expr(node.value)]);
      const args = [this.expr(arr), this.expr(node.value)];
      if (node.start || node.end) args.push(node.start ? this.expr(node.start) : nil());
      if (node.end) args.push(this.expr(node.end));
      return fcall('js_fill', args);
    }

    xArrayCreation(node) {
      if (!node.size) return new RubyArrayLiteral([]);
      const elem = elementTypeOf(node.elementType ? node.elementType : (node.resultType || node.contextType));
      const numeric = node.elementType ? isNumericType(node.elementType) : isNumericType(elem);
      if (node.size.type === 'Literal' || this.isInt(node.size))
        return call(id('Array'), 'new', numeric ? [this.intOperand(node.size), int(0)] : [this.intOperand(node.size)]);
      return fcall('js_array_new', [this.expr(node.size)]);
    }

    xTypedArrayCreation(node) {
      const kind = TYPED_ARRAY_KINDS[node.arrayType] || 'u8';
      if (node.buffer) {
        const args = [raw(`:${kind}`), this.expr(node.buffer)];
        if (node.byteOffset) args.push(this.expr(node.byteOffset));
        if (node.length) args.push(this.expr(node.length));
        return fcall('js_typed_new', args);
      }
      const size = node.size;
      if (!size) return call(id('JSTypedArray'), 'create', [raw(`:${kind}`), int(0)]);
      return call(id('JSTypedArray'), 'create', [raw(`:${kind}`), this.expr(size)]);
    }

    xBufferCreation(node) {
      return call(id('JSArrayBuffer'), 'new', [node.size ? this.expr(node.size) : int(0)]);
    }

    xDataViewCreation(node) {
      const args = [this.expr(node.buffer)];
      if (node.byteOffset) args.push(this.expr(node.byteOffset));
      if (node.byteLength) args.push(this.expr(node.byteLength));
      return call(id('JSDataView'), 'new', args);
    }

    xDataViewRead(node) {
      const args = [this.expr(node.offset)];
      if (node.littleEndian) args.push(this.expr(node.littleEndian));
      return call(this.expr(node.view, { receiver: true }), node.method, args);
    }

    xDataViewWrite(node) {
      const args = [this.expr(node.offset), this.expr(node.value)];
      if (node.littleEndian) args.push(this.expr(node.littleEndian));
      return call(this.expr(node.view, { receiver: true }), node.method, args);
    }

    xDataViewGetByteLength(node) { return prop(this.expr(node.view, { receiver: true }), 'byteLength'); }
    xDataViewGetByteOffset(node) { return prop(this.expr(node.view, { receiver: true }), 'byteOffset'); }
    xDataViewGetBuffer(node) { return prop(this.expr(node.view, { receiver: true }), 'buffer'); }

    xTypedArraySet(node) {
      const args = [this.expr(node.array), this.expr(node.source)];
      if (node.offset) args.push(this.expr(node.offset));
      return fcall('js_typed_set', args);
    }

    xTypedArraySubarray(node) {
      const args = [this.expr(node.array)];
      if (node.begin || node.end) args.push(node.begin ? this.expr(node.begin) : nil());
      if (node.end) args.push(this.expr(node.end));
      return fcall('js_subarray', args);
    }

    xArrayFrom(node) {
      const args = [this.expr(node.iterable)];
      if (node.mapFunction) args.push(this.expr(node.mapFunction));
      const result = fcall('js_array_from', args);
      if (node.arrayType && TYPED_ARRAY_KINDS[node.arrayType]) return call(id('JSTypedArray'), 'create', [raw(`:${TYPED_ARRAY_KINDS[node.arrayType]}`), result]);
      return result;
    }

    xArrayConcat(node) {
      return fcall('js_concat', [this.expr(node.array), ...this.exprs(node.arrays || [])]);
    }

    xArrayIndexOf(node) {
      const args = [this.expr(node.array), this.expr(node.value)];
      if (node.start) args.push(this.expr(node.start));
      return fcall('js_index_of', args);
    }

    xArrayLastIndexOf(node) { return fcall('js_last_index_of', [this.expr(node.array), this.expr(node.value)]); }
    xArrayIncludes(node) { return fcall('js_includes', [this.expr(node.array), this.expr(node.value)]); }
    xArrayJoin(node) { return fcall('js_join', [this.expr(node.array), ...(node.separator ? [this.expr(node.separator)] : [])]); }
    xArrayReverse(node) { return fcall('js_reverse', [this.expr(node.array)]); }
    xArraySort(node) { return fcall('js_sort', [this.expr(node.array), ...(node.compareFn ? [this.expr(node.compareFn)] : [])]); }
    xArrayMap(node) { return fcall('js_map', [this.expr(node.array), this.expr(node.callback)]); }
    xArrayFilter(node) { return fcall('js_filter', [this.expr(node.array), this.expr(node.callback)]); }
    xArrayForEach(node) { return fcall('js_for_each', [this.expr(node.array), this.expr(node.callback)]); }
    xArraySome(node) { return fcall('js_some', [this.expr(node.array), this.expr(node.callback)]); }
    xArrayEvery(node) { return fcall('js_every', [this.expr(node.array), this.expr(node.callback)]); }
    xArrayFind(node) { return fcall('js_find', [this.expr(node.array), this.expr(node.callback)]); }
    xArrayFindIndex(node) { return fcall('js_find_index', [this.expr(node.array), this.expr(node.callback)]); }
    xArrayReduce(node) {
      const args = [this.expr(node.array), this.expr(node.callback)];
      if (node.initialValue) args.push(this.expr(node.initialValue));
      return fcall('js_reduce', args);
    }

    xArrayXor(node) { return call(id('OpCodes'), 'XorArrays', this.exprs(node.arguments || [])); }
    xArrayClear(node) { return call(id('OpCodes'), 'ClearArray', this.exprs(node.arguments || [])); }
    xIsArrayCheck(node) { return fcall('js_is_array', [this.expr(node.value)]); }
    xIsIntegerCheck(node) { return call(id('JsNumber'), 'isInteger', [this.expr(node.value)]); }
    xIsSafeIntegerCheck(node) { return call(id('JsNumber'), 'isSafeInteger', [this.expr(node.value)]); }
    xIsNaNCheck(node) { return call(id('JsNumber'), 'isNaN', [this.expr(node.value)]); }
    xIsFiniteCheck(node) { return call(id('JsNumber'), 'isFinite', [this.expr(node.value)]); }
    xObjectFreeze(node) { return this.expr(node.object); }
    xObjectSeal(node) { return this.expr(node.object); }
    xObjectKeys(node) { return fcall('js_keys', [this.expr(node.object || node.argument)]); }
    xObjectValues(node) { return fcall('js_values', [this.expr(node.object || node.argument)]); }
    xObjectEntries(node) { return fcall('js_entries', [this.expr(node.object || node.argument)]); }
    xObjectFromEntries(node) { return call(id('JsObjectG'), 'fromEntries', [this.expr(node.entries)]); }
    xMapCreation(node) { return call(id('JSMap'), 'new', node.entries ? [this.expr(node.entries)] : []); }
    xSetCreation(node) { return call(id('JSSet'), 'new', node.values ? [this.expr(node.values)] : (node.entries ? [this.expr(node.entries)] : [])); }
    xMapSet(node) { return call(this.expr(node.map, { receiver: true }), 'set', [this.expr(node.key), this.expr(node.value)]); }
    xErrorCreation(node) {
      return call(id('JSError'), 'new', [node.message ? this.expr(node.message) : nil(), str(node.errorType || 'Error')]);
    }

    xHexDecode(node) {
      const arg = (node.arguments || [])[0];
      if (arg && arg.type === 'Literal' && typeof arg.value === 'string' && /^([0-9a-fA-F]{2})*$/.test(arg.value))
        return raw(`[${JSON.stringify(arg.value)}].pack("H*").bytes`);
      return call(id('OpCodes'), 'Hex8ToBytes', this.exprs(node.arguments || []));
    }

    xHexEncode(node) {
      return raw(`${this.code(this.expr((node.arguments || [])[0]))}.to_a.map { |b| format("%02x", b & 0xFF) }.join`);
    }

    xStringToBytes(node) {
      const method = node.opCodesMethod || (node.encoding === 'ascii' ? 'AsciiToBytes' : 'AnsiToBytes');
      const a = this.exprs(node.arguments || []);
      if (method === 'Utf8ToBytes' || node.encoding === 'utf8' || node.encoding === 'utf-8') return raw(`${this.code(a[0])}.encode("UTF-8").bytes`);
      return call(id('OpCodes'), method, a);
    }

    xBytesToString(node) {
      const method = node.opCodesMethod || 'BytesToAnsi';
      const a = this.exprs(node.arguments || []);
      if (method === 'BytesToAnsi') return call(id('OpCodes'), 'BytesToAnsi', a);
      if (method === 'Utf8ToString' || node.encoding === 'utf8') return raw(`${this.code(a[0])}.to_a.pack("C*").force_encoding("UTF-8")`);
      return call(id('OpCodes'), method, a);
    }

    xOpCodesCall(node) {
      return call(id('OpCodes'), node.method || node.opCodesMethod, this.exprs(node.arguments || []));
    }

    xPackBytes(node) {
      const args = node.arguments || [];
      const bits = node.bits || 32;
      const count = bits / 8;
      const big = node.endian === 'big';
      if (args.some(a => a && a.type === 'SpreadElement') || bits > 32) {
        return fcall('js_pack_bytes', [int(bits), bool(big), ...this.exprs(args)]);
      }
      const parts = [];
      for (let i = 0; i < count; ++i) {
        const a = args[i];
        if (!a) continue;
        let e = this.expr(a);
        const ub = this.unsignedBits(a);
        if (ub === null || ub > 8) e = bin(this.intOperand(a), '&', raw('0xFF'));
        const shift = big ? (count - 1 - i) * 8 : i * 8;
        parts.push(shift ? bin(e, '<<', int(shift)) : e);
      }
      if (!parts.length) return int(0);
      return parts.reduce((x, y) => bin(x, '|', y));
    }

    xUnpackBytes(node) {
      const bits = node.bits || 32;
      const big = node.endian === 'big';
      return fcall('js_unpack_bytes', [this.expr((node.arguments || [])[0]), int(bits), bool(big)]);
    }

    xRotateLeft(node) { return this.rotation(node, true); }
    xRotateRight(node) { return this.rotation(node, false); }

    rotation(node, left) {
      const bits = node.bits || 32;
      const value = node.value || (node.arguments && node.arguments[0]);
      const amount = node.amount || (node.arguments && node.arguments[1]);
      if (bits === 64 && (this.isBig(value) || node.bigint)) return call(id('OpCodes'), left ? 'RotL64n' : 'RotR64n', [this.expr(value), this.expr(amount)]);
      if (amount && amount.type === 'Literal' && typeof amount.value === 'number' && this.isPure(value) && bits <= 32) {
        let n = ((amount.value % bits) + bits) % bits;
        if (!left) n = (bits - n) % bits;
        const ub = this.unsignedBits(value);
        let v = this.expr(value);
        if (ub === null || ub > bits) v = bin(this.intOperand(value), '&', raw(MASK[bits]));
        if (n === 0) return v;
        return bin(bin(bin(v, '<<', int(n)), '&', raw(MASK[bits])), '|', bin(v, '>>', int(bits - n)));
      }
      return fcall(left ? 'js_rotl' : 'js_rotr', [this.intOperand(value), this.intOperand(amount), int(bits)]);
    }

    xCast(node, ctx) {
      const target = node.targetType || typeName(node.resultType);
      const arg = (node.arguments || [])[0] || node.argument;
      if (!arg) return nil();
      const t = typeName(target);
      if (t === 'int') return ctx.lowBits ? this.intOperand(arg, { lowBits: true }) : this.normalize(this.intOperand(arg, { lowBits: true }), 'int32');
      if (isIntType(t)) {
        const [bits] = INT_WIDTH[t];
        const lowBits = bits <= 32;
        const e = this.intOperand(arg, { lowBits });
        if (ctx.lowBits && bits <= 32) return e;
        const ub = this.unsignedBits(arg);
        if (ub !== null && ub <= bits && (!INT_WIDTH[t][1] || ub < bits)) return e;
        return this.normalize(e, t);
      }
      if (isBigIntType(t)) return this.bigIntOf(arg);
      if (isFloatType(t)) return this.expr(arg);
      if (isStringType(t)) return fcall('js_str', [this.expr(arg)]);
      if (isBoolType(t)) return fcall('js_truthy', [this.expr(arg)]);
      return this.expr(arg, ctx);
    }

    xBigIntCast(node) {
      return this.bigIntOf(node.argument || (node.arguments || [])[0]);
    }

    bigIntOf(arg) {
      if (!arg) return int(0);
      if (this.isInt(arg) || this.isBig(arg)) return this.expr(arg);
      return fcall('js_bigint', [this.expr(arg)]);
    }

    floorOf(arg) {
      if (!arg) return raw('JS::NAN');
      if (this.isInt(arg) || this.isBig(arg)) return this.expr(arg);
      // Math.floor(a / b) of integers: Ruby's integer division floors
      if (arg.type === 'BinaryExpression' && arg.operator === '/' && this.isInt(arg.left) && this.isInt(arg.right)
        && arg.right.type === 'Literal' && arg.right.value > 0)
        return bin(this.expr(arg.left), '/', this.expr(arg.right));
      return fcall('js_floor', [this.expr(arg)]);
    }

    xFloor(node) { return this.floorOf(node.argument || (node.arguments || [])[0]); }
    xCeil(node) {
      const arg = node.argument || (node.arguments || [])[0];
      if (this.isInt(arg)) return this.expr(arg);
      if (arg && arg.type === 'BinaryExpression' && arg.operator === '/' && this.isInt(arg.left) && this.isInt(arg.right) && arg.right.type === 'Literal' && arg.right.value > 0)
        return un('-', bin(un('-', this.expr(arg.left)), '/', this.expr(arg.right)));
      return fcall('js_ceil', [this.expr(arg)]);
    }

    xTruncate(node) {
      const arg = node.argument || (node.arguments || [])[0];
      if (this.isInt(arg)) return this.expr(arg);
      return fcall('js_trunc', [this.expr(arg)]);
    }

    xTrunc(node) { return this.xTruncate(node); }
    xRound(node) { return fcall('js_round', [this.expr(node.argument || (node.arguments || [])[0])]); }
    xAbs(node) { return fcall('js_abs', [this.expr(node.argument || (node.arguments || [])[0])]); }
    xSign(node) { return fcall('js_sign', [this.expr(node.argument || (node.arguments || [])[0])]); }
    xSqrt(node) { return fcall('js_sqrt', [this.expr(node.argument || (node.arguments || [])[0])]); }
    xCbrt(node) { return fcall('js_math', [str('cbrt'), this.expr(node.argument)]); }
    xFround(node) { return fcall('js_fround', [this.expr(node.argument)]); }
    xMin(node) { return this.minMax(node, 'js_min', '<'); }
    xMax(node) { return this.minMax(node, 'js_max', '>'); }

    minMax(node, helper, op) {
      const args = node.arguments || [];
      if (args.length === 2 && args.every(a => this.isInt(a) && this.isPure(a))) {
        const a = this.expr(args[0]), b = this.expr(args[1]);
        return new RubyConditional(bin(a, op, b), a, b);
      }
      return fcall(helper, this.exprs(args));
    }

    xPower(node) {
      if (this.isBig(node.base) || this.isBig(node.exponent)) return fcall('js_bpow', [this.expr(node.base), this.expr(node.exponent)]);
      return fcall('js_pow', [this.expr(node.base), this.expr(node.exponent)]);
    }

    xPow(node) { return fcall('js_pow', this.exprs(node.arguments || [node.base, node.exponent])); }
    xRandom() { return raw('rand'); }
    xImul(node) { return fcall('js_imul', this.exprs(node.arguments || [])); }
    xClz32(node) { return fcall('js_clz32', this.exprs(node.arguments || [node.argument])); }
    xCountLeadingZeros(node) {
      if ((node.bits || 32) === 32) return fcall('js_clz32', [this.expr(node.argument)]);
      return fcall('js_clz', [this.expr(node.argument), int(node.bits)]);
    }

    mathFn(name) { return node => fcall('js_math', [str(name), ...this.exprs(node.arguments || [node.argument])]); }
    xLog(node) { return this.mathFn('log')(node); }
    xLog2(node) { return this.mathFn('log2')(node); }
    xLog10(node) { return this.mathFn('log10')(node); }
    xExp(node) { return this.mathFn('exp')(node); }
    xSin(node) { return this.mathFn('sin')(node); }
    xCos(node) { return this.mathFn('cos')(node); }
    xTan(node) { return this.mathFn('tan')(node); }
    xAsin(node) { return this.mathFn('asin')(node); }
    xAcos(node) { return this.mathFn('acos')(node); }
    xAtan(node) { return this.mathFn('atan')(node); }
    xAtan2(node) { return this.mathFn('atan2')(node); }
    xSinh(node) { return this.mathFn('sinh')(node); }
    xCosh(node) { return this.mathFn('cosh')(node); }
    xTanh(node) { return this.mathFn('tanh')(node); }
    xHypot(node) { return this.mathFn('hypot')(node); }

    xMathCall(node) {
      const a = this.exprs(node.arguments || []);
      if (node.method === 'imul') return fcall('js_imul', a);
      return fcall('js_math', [str(node.method), ...a]);
    }

    xMathConstant(node) {
      if (node.name === 'PI') return raw('Math::PI');
      if (node.name === 'E') return raw('Math::E');
      return new RubyLiteral(node.value, 'float');
    }

    xNumberConstant(node) {
      return prop(id('JsNumber'), node.name);
    }

    xStringCharAt(node) { return fcall('js_char_at', [this.expr(node.string), node.index ? this.expr(node.index) : int(0)]); }
    xStringCharCodeAt(node) { return fcall('js_char_code_at', [this.expr(node.string), node.index ? this.expr(node.index) : int(0)]); }
    xStringFromCharCodes(node) { return fcall('js_from_char_codes', this.exprs(node.charCodes || [])); }
    xStringFromCodePoints(node) { return fcall('js_from_code_points', this.exprs(node.codePoints || [])); }

    xStringSubstring(node) {
      const s = this.expr(node.string);
      if (node.length) return fcall('js_substr', [s, node.start ? this.expr(node.start) : int(0), this.expr(node.length)]);
      const negative = n => n && ((n.type === 'UnaryExpression' && n.operator === '-') || (n.type === 'Literal' && n.value < 0));
      const args = [s, node.start ? this.expr(node.start) : int(0)];
      if (node.end) args.push(this.expr(node.end));
      return fcall(negative(node.start) || negative(node.end) ? 'js_slice' : 'js_substring', args);
    }

    xStringTransform(node) {
      const s = this.expr(node.string, { receiver: true });
      switch (node.method) {
        case 'toUpperCase': return call(s, 'upcase');
        case 'toLowerCase': return call(s, 'downcase');
        case 'trim': return call(s, 'strip');
        case 'trimStart': return call(s, 'lstrip');
        case 'trimEnd': return call(s, 'rstrip');
        default: return fcall('js_invoke', [s, str(node.method)]);
      }
    }

    xStringRepeat(node) { return fcall('js_repeat', [this.expr(node.string), this.expr(node.count)]); }

    xStringReplace(node) {
      return fcall('js_replace', [this.expr(node.string), this.expr(node.searchValue), this.expr(node.replaceValue),
        bool(node.method === 'replaceAll' || !!(node.searchValue && node.searchValue.regex && /g/.test(node.searchValue.regex.flags)))]);
    }

    xStringIndexOf(node) {
      const args = [this.expr(node.string), this.expr(node.searchValue)];
      if (node.fromIndex) args.push(this.expr(node.fromIndex));
      return fcall(node.method === 'lastIndexOf' ? 'js_last_index_of' : 'js_index_of', args);
    }

    xStringIncludes(node) {
      const s = this.expr(node.string, { receiver: true });
      const v = fcall('js_str', [this.expr(node.searchValue)]);
      switch (node.method) {
        case 'startsWith': return call(s, 'start_with?', [v]);
        case 'endsWith': return call(s, 'end_with?', [v]);
        default: return call(s, 'include?', [v]);
      }
    }

    xStringSplit(node) { return fcall('js_split', [this.expr(node.string), ...(node.separator ? [this.expr(node.separator)] : [])]); }

    xStringPad(node) {
      return fcall('js_pad', [this.expr(node.string), this.expr(node.targetLength), node.padString ? this.expr(node.padString) : nil(), bool(node.method !== 'padEnd')]);
    }

    xStringConcat(node) {
      return [this.expr(node.string), ...(node.values || []).map(v => fcall('js_str', [this.expr(v)]))].reduce((a, b) => bin(a, '+', b));
    }

    xDebugOutput(node) {
      return call(id('JsConsole'), node.method || 'log', this.exprs(node.arguments || []));
    }

    xInstanceOfCheck(node) {
      return this.instanceOf(node.value || node.left, node.className ? { type: 'Identifier', name: node.className } : node.right);
    }

    xYieldExpression() {
      return fcall('js_unsupported', [str('generator')]);
    }

    xAwaitExpression(node) {
      return this.expr(node.argument);
    }

    xChainExpression(node) {
      return this.expr(node.expression);
    }

    xRestParameter(node) {
      return id(node.name);
    }

    xParseInteger(node) { return fcall('js_parse_int', this.exprs(node.arguments || [node.argument])); }
    xParseFloat(node) { return fcall('js_parse_float', this.exprs(node.arguments || [node.argument])); }
  }

  RubyTransformer.RUBY_RUNTIME = RUBY_RUNTIME;

  /** The token a file's className option gives its module and globals */
  function fileToken(className) {
    return String(className || 'main').replace(/Generated$/, '').replace(/[^A-Za-z0-9_]/g, '_') || 'main';
  }

  /** The Ruby global holding a module-level JavaScript name of the file transpiled with this className */
  RubyTransformer.globalNameFor = (className, jsName) => {
    const token = fileToken(className);
    return '$' + (/^[0-9]/.test(token) ? 'g' + token : token.charAt(0).toLowerCase() + token.slice(1)) + '_'
      + String(jsName).replace(/[^A-Za-z0-9_]/g, '_');
  };

  /** The Ruby module the file transpiled with this className is wrapped in */
  RubyTransformer.moduleNameFor = className => {
    const token = fileToken(className);
    return 'Cv' + token.charAt(0).toUpperCase() + token.slice(1);
  };

  /**
   * The Ruby expression for a module-level name of a transpiled file (a
   * bundled library's export): its class constant, or its global.
   * @param {string} className - the className the file was transpiled with
   * @param {string} jsName - the JavaScript name
   * @param {string} rubyCode - the file's Ruby code
   */
  RubyTransformer.libraryBinding = (className, jsName, rubyCode) => {
    let constant = String(jsName).replace(/[^A-Za-z0-9_]/g, '_');
    constant = constant.charAt(0).toUpperCase() + constant.slice(1);
    if (new RegExp(`^\\s*class ${constant}\\b`, 'm').test(rubyCode)) return `${RubyTransformer.moduleNameFor(className)}::${constant}`;
    return RubyTransformer.globalNameFor(className, jsName);
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RubyTransformer, RUBY_RUNTIME };
  }
  if (typeof global !== 'undefined') {
    global.RubyTransformer = RubyTransformer;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
