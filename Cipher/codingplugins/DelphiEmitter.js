/**
 * DelphiEmitter.js - Object Pascal source from the DelphiAST tree
 * (c)2006-2025 Hawkynt
 *
 * The emitter decides layout and parentheses only; every name, type and
 * conversion was settled by DelphiTransformer. It also holds the Pascal
 * runtime every generated unit embeds: JavaScript arrays with reference
 * semantics (TJsArray<T>), an arbitrary-precision TBigInt, JavaScript number
 * and string semantics, the OpCodes helpers the IL does not express as
 * operators, the AlgorithmFramework classes, and the dynamic values
 * (TJsValue) that test vectors and name-based member access use.
 *
 * Target: Free Pascal 3.2 in {$MODE DELPHIUNICODE} (string is UTF-16, like
 * JavaScript), compiled with overflow and range checks off so integer
 * arithmetic wraps like the IL's fixed-width types.
 */

(function (global) {
  'use strict';

  // ======================== the embedded runtime ========================

  const RUNTIME_INTERFACE = String.raw`type
  { ---- errors ---- }
  EJsError = class(Exception);
  EJsTypeError = class(EJsError);
  EJsRangeError = class(EJsError);

  { ---- BigInt: sign and magnitude, 32-bit limbs, least significant first ---- }
  TBigInt = record
  public
    Neg: Boolean;
    M: array of UInt32;
    class function FromInt64(V: Int64): TBigInt; static;
    class function FromUInt64(V: UInt64): TBigInt; static;
    class function FromDouble(V: Double): TBigInt; static;
    class function FromBool(V: Boolean): TBigInt; static;
    class function Parse(const S: string): TBigInt; static;
    class function Zero: TBigInt; static;
    function IsZero: Boolean; inline;
    function Sign: Int32;
    function ToInt64: Int64;
    function ToUInt64: UInt64;
    function ToInt32: Int32;
    function ToUInt32: UInt32;
    function ToDouble: Double;
    function ToString(Radix: Int32 = 10): string;
    function BitLength: Int32;
    class function Compare(const A, B: TBigInt): Int32; static;
    class procedure DivMod(const A, B: TBigInt; out Q, R: TBigInt); static;
    class function Pow(const A: TBigInt; E: Int64): TBigInt; static;
    class function AsUintN(Bits: Int32; const A: TBigInt): TBigInt; static;
    class function AsIntN(Bits: Int32; const A: TBigInt): TBigInt; static;
    class operator Add(const A, B: TBigInt): TBigInt;
    class operator Subtract(const A, B: TBigInt): TBigInt;
    class operator Multiply(const A, B: TBigInt): TBigInt;
    class operator IntDivide(const A, B: TBigInt): TBigInt;
    class operator Modulus(const A, B: TBigInt): TBigInt;
    class operator Negative(const A: TBigInt): TBigInt;
    class operator LeftShift(const A: TBigInt; N: Int32): TBigInt;
    class operator RightShift(const A: TBigInt; N: Int32): TBigInt;
    class operator BitwiseAnd(const A, B: TBigInt): TBigInt;
    class operator BitwiseOr(const A, B: TBigInt): TBigInt;
    class operator BitwiseXor(const A, B: TBigInt): TBigInt;
    class operator LogicalNot(const A: TBigInt): TBigInt;
    class operator Equal(const A, B: TBigInt): Boolean;
    class operator NotEqual(const A, B: TBigInt): Boolean;
    class operator LessThan(const A, B: TBigInt): Boolean;
    class operator LessThanOrEqual(const A, B: TBigInt): Boolean;
    class operator GreaterThan(const A, B: TBigInt): Boolean;
    class operator GreaterThanOrEqual(const A, B: TBigInt): Boolean;
  end;
  PBigInt = ^TBigInt;

  { ---- JS arrays: a shared store (reference semantics), optionally a view ---- }
  TJsArrayStore<T> = record
    Items: array of T;
    Count: Int32;
  end;

  TJsArray<T> = record
  public type
    TCompareFn = function(const A, B: T): Double is nested;
  public
    S: array of TJsArrayStore<T>;
    O: Int32;
    L: Int32;
    function GetLength: Int32; inline;
    procedure SetLength_(N: Int32);
    function Get(I: Int32): T; inline;
    procedure Put(I: Int32; const V: T); inline;
    procedure Grow(I: Int32);
    property Items[I: Int32]: T read Get write Put; default;
    property length: Int32 read GetLength write SetLength_;
    class function New(N: Int32): TJsArray<T>; static;
    class function Empty: TJsArray<T>; static;
    class function Null: TJsArray<T>; static;
    class function From(const A: array of T): TJsArray<T>; static;
    class function Concat(const Parts: array of TJsArray<T>): TJsArray<T>; static;
    function IsNull: Boolean; inline;
    function Same(const B: TJsArray<T>): Boolean; inline;
    function Push(const V: T): Int32;
    procedure PushAll(const B: TJsArray<T>);
    function Pop: T;
    function Shift: T;
    function Unshift(const V: T): Int32;
    function Slice(AStart: Int32): TJsArray<T>; overload;
    function Slice(AStart, AEnd: Int32): TJsArray<T>; overload;
    function Subarray(AStart: Int32): TJsArray<T>; overload;
    function Subarray(AStart, AEnd: Int32): TJsArray<T>; overload;
    function Copy: TJsArray<T>;
    function Fill(const V: T): TJsArray<T>; overload;
    function Fill(const V: T; AStart: Int32): TJsArray<T>; overload;
    function Fill(const V: T; AStart, AEnd: Int32): TJsArray<T>; overload;
    procedure SetFrom(const Src: TJsArray<T>; Offset: Int32 = 0);
    function Reverse: TJsArray<T>;
    function Splice(AStart: Int32): TJsArray<T>; overload;
    function Splice(AStart, ADeleteCount: Int32): TJsArray<T>; overload;
    function Splice(AStart, ADeleteCount: Int32; const AItems: array of T): TJsArray<T>; overload;
    function IndexOf(const V: T; FromIndex: Int32 = 0): Int32;
    function LastIndexOf(const V: T): Int32;
    function Includes(const V: T): Boolean;
    function Sort(Fn: TCompareFn): TJsArray<T>;
    procedure Clear;
    function ToArray: TArray<T>;
  end;

  TJsEq<T> = record
    class function Eq(const A, B: T): Boolean; static;
  end;

  TA_U8 = TJsArray<Byte>;
  TA_I8 = TJsArray<ShortInt>;
  TA_U16 = TJsArray<Word>;
  TA_I16 = TJsArray<SmallInt>;
  TA_U32 = TJsArray<UInt32>;
  TA_I32 = TJsArray<Int32>;
  TA_U64 = TJsArray<UInt64>;
  TA_I64 = TJsArray<Int64>;
  TA_F32 = TJsArray<Single>;
  TA_F64 = TJsArray<Double>;
  TA_Bool = TJsArray<Boolean>;
  TA_Str = TJsArray<string>;
  TA_Big = TJsArray<TBigInt>;
  TA_A_U8 = TJsArray<TA_U8>;
  TA_A_U16 = TJsArray<TA_U16>;
  TA_A_U32 = TJsArray<TA_U32>;
  TA_A_I32 = TJsArray<TA_I32>;
  TA_A_U64 = TJsArray<TA_U64>;

  { ---- dynamic values: test vector fields and name-based member access ---- }
  TJsValueKind = (jvUndefined, jvNull, jvBool, jvInt, jvUInt, jvNum, jvStr, jvBig, jvArr, jvObj);

  TJsValue = record
    Kind: TJsValueKind;
    B: Boolean;
    I: Int64;
    U: UInt64;
    N: Double;
    S: string;
    Big: TBigInt;
    A: array of TJsValue;
    Ref: TObject;
    function IsNullish: Boolean;
    function Truthy: Boolean;
    function Describe: string;
  end;
  TJsValues = array of TJsValue;

  TJsArrayRef<T> = class
    A: TJsArray<T>;
    constructor Create(const AArr: TJsArray<T>);
  end;

  TJsField = record
    Name: string;
    Value: TJsValue;
  end;

  { ---- framework (AlgorithmFramework.js) ---- }
  TAlgorithm = class;
  TIAlgorithmInstance = class;

  { Every object: its members by JavaScript name, for the vector harness and
    for members reached through a base type the IL gives (an HMAC instance a
    registry lookup returned as IMacInstance) }
  TJsObject = class
  public
    JsExtra: array of TJsField;
    function JsSetMember(const AName: string; const AValue: TJsValue): Boolean; virtual;
    function JsHasMember(const AName: string): Boolean; virtual;
    function JsGetMember(const AName: string; out AValue: TJsValue): Boolean; virtual;
    function JsCallMethod(const AName: string; const AValue: TJsValue): Boolean; virtual;
    function JsHasMethod(const AName: string): Boolean; virtual;
    function JsInvoke(const AName: string; const AArgs: array of TJsValue; out AResult: TJsValue): Boolean; virtual;
  end;

  TLinkItem = class(TJsObject)
  public
    text: string;
    uri: string;
    constructor Create(const AText: string = ''; const AUri: string = '');
  end;

  TTestCase = class(TLinkItem)
  public
    input: TA_U8;
    expected: TA_U8;
    Fields: array of TJsField;
    constructor Create; overload;
    constructor Create(const AInput, AExpected: TA_U8; const ADescription: string = ''; const AUri: string = ''); overload;
    function HasField(const AName: string): Boolean;
    function GetField(const AName: string): TJsValue;
    procedure SetField(const AName: string; const AValue: TJsValue);
  end;

  { An object literal the IL leaves untyped: its fields as dynamic values }
  TJsDynObject = class(TJsObject)
  public
    Fields: array of TJsField;
    function HasField(const AName: string): Boolean;
    function GetField(const AName: string): TJsValue;
    procedure SetField(const AName: string; const AValue: TJsValue);
    function JsSetMember(const AName: string; const AValue: TJsValue): Boolean; override;
    function JsHasMember(const AName: string): Boolean; override;
  end;

  TVulnerability = class(TLinkItem)
  public
    description: string;
    mitigation: string;
    constructor Create(const AType: string; const ADescription: string = ''; const AMitigation: string = ''; const AUri: string = '');
  end;

  TAuthResult = class(TJsObject)
  public
    Success: Boolean;
    Output: TA_U8;
    FailureReason: string;
    constructor Create(ASuccess: Boolean; const AOutput: TA_U8; const AFailureReason: string = '');
  end;

  TKeySize = class(TJsObject)
  public
    minSize: Int32;
    maxSize: Int32;
    stepSize: Int32;
    constructor Create(AMinSize, AMaxSize: Int32; AStepSize: Int32 = 1);
  end;

  TA_LinkItem = TJsArray<TLinkItem>;
  TA_TestCase = TJsArray<TTestCase>;
  TA_Vulnerability = TJsArray<TVulnerability>;
  TA_KeySize = TJsArray<TKeySize>;

  TJsBlockProc = procedure(const Block: TA_U8) of object;

  TBlockAbsorber = class(TJsObject)
  public
    _blockSize: Int32;
    _processBlock: TJsBlockProc;
    _held: TA_U8;
    _pending: Int32;
    _length: UInt64;
    constructor Create(ABlockSize: Int32; AProcessBlock: TJsBlockProc);
    function Get_BlockSize: Int32;
    function Get_Pending: Int32;
    function Get_Length: UInt64;
    property BlockSize: Int32 read Get_BlockSize;
    property Pending: Int32 read Get_Pending;
    property Length: UInt64 read Get_Length;
    procedure Absorb(const AData: TA_U8);
    function FinishHeld: TA_U8;
    procedure Reset;
  end;

  { OpCodes._BitStream (OpCodes.CreateBitStream), with its JavaScript int32 arithmetic }
  TJsBitStream = class(TJsObject)
  public
    buffer: Int32;
    bufferBits: Int32;
    byteArray: TA_U8;
    readPosition: Int32;
    totalBitsWritten: Int32;
    constructor Create(const initialBytes: TA_U8);
    procedure writeBits(value, numBits: UInt32);
    procedure writeBit(bit: UInt32);
    procedure writeByte(b: UInt32);
    procedure writeBytes(const bytes: TA_U8);
    procedure writeUint16BE(value: UInt32);
    procedure writeUint16LE(value: UInt32);
    procedure writeUint32BE(value: UInt32);
    procedure writeUint32LE(value: UInt32);
    function readBits(numBits: Int32): UInt32;
    function readBit: UInt32;
    function readByte: Byte;
    function readBytes(count: Int32): TA_U8;
    function peekBits(numBits: Int32): UInt32;
    procedure skipBits(numBits: Int32);
    function hasMoreBits: Boolean;
    function getRemainingBits: Int32;
    procedure resetReadPosition;
    procedure seekBits(bitOffset: UInt32);
    function toArray(padLastByte: Boolean = True): TA_U8;
    function getBitLength: Int32;
    function getByteLength: Int32;
    procedure clear;
    function clone: TJsBitStream;
    procedure writeVarInt(value: UInt32);
    function readVarInt: UInt32;
    procedure writeUnary(value: Int32);
    function readUnary: Int32;
    procedure alignToByte;
    function isAligned: Boolean;
  end;

  { A JavaScript Map: insertion-ordered, keys compared by SameValueZero }
  TJsMap = class(TJsObject)
  public
    Keys: array of TJsValue;
    Vals: array of TJsValue;
    Count: Int32;
    function IndexOfKey(const K: TJsValue): Int32;
    function Get(const K: TJsValue): TJsValue;
    function Put(const K, V: TJsValue): TJsMap;
    function Has(const K: TJsValue): Boolean;
    function Delete(const K: TJsValue): Boolean;
    procedure Clear;
    function Size: Int32;
  end;

  TMerkleDamgardOptions = class(TJsObject)
  public
    blockSize: Int32;
    padByte: Int32;
    lengthBytes: Int32;
    lengthLittleEndian: Boolean;
    lengthInBits: Boolean;
    constructor Create(ABlockSize, APadByte, ALengthBytes: Int32; ALengthLittleEndian, ALengthInBits: Boolean);
  end;

  TAlgorithm = class(TJsObject)
  public
    name: string;
    description: string;
    inventor: string;
    year: Int32;
    category: string;
    subCategory: string;
    securityStatus: string;
    complexity: string;
    country: string;
    documentation: TA_LinkItem;
    references: TA_LinkItem;
    knownVulnerabilities: TA_Vulnerability;
    tests: TA_TestCase;
    constructor Create;
    function CreateInstance(isInverse: Boolean = False): TIAlgorithmInstance; virtual;
    function JsGetMember(const AName: string; out AValue: TJsValue): Boolean; override;
    function JsInvoke(const AName: string; const AArgs: array of TJsValue; out AResult: TJsValue): Boolean; override;
  end;
  TAlgorithmClass = class of TAlgorithm;
  TA_Algorithm = TJsArray<TAlgorithm>;

  TCryptoAlgorithm = class(TAlgorithm);
  TSymmetricCipherAlgorithm = class(TCryptoAlgorithm);
  TAsymmetricCipherAlgorithm = class(TCryptoAlgorithm);
  TBlockCipherAlgorithm = class(TSymmetricCipherAlgorithm)
  public
    SupportedKeySizes: TA_KeySize;
    SupportedBlockSizes: TA_KeySize;
    constructor Create;
  end;
  TStreamCipherAlgorithm = class(TSymmetricCipherAlgorithm);
  TEncodingAlgorithm = class(TAlgorithm);
  TCompressionAlgorithm = class(TAlgorithm);
  TErrorCorrectionAlgorithm = class(TAlgorithm);
  THashFunctionAlgorithm = class(TAlgorithm)
  public
    SupportedOutputSizes: TA_KeySize;
    constructor Create;
  end;
  TMacAlgorithm = class(TAlgorithm)
  public
    SupportedMacSizes: TA_KeySize;
    NeedsKey: Boolean;
    constructor Create;
  end;
  TKdfAlgorithm = class(TAlgorithm)
  public
    SupportedOutputSizes: TA_KeySize;
    SaltRequired: Boolean;
    constructor Create;
  end;
  TPaddingAlgorithm = class(TAlgorithm)
  public
    IsLengthIncluded: Boolean;
    constructor Create;
  end;
  TCipherModeAlgorithm = class(TAlgorithm)
  public
    RequiresIV: Boolean;
    SupportedIVSizes: TA_KeySize;
    constructor Create;
  end;
  TAeadAlgorithm = class(TCryptoAlgorithm)
  public
    SupportedTagSizes: TA_KeySize;
    SupportsDetached: Boolean;
    constructor Create;
  end;
  TRandomGenerationAlgorithm = class(TAlgorithm)
  public
    IsDeterministic: Boolean;
    IsCryptographicallySecure: Boolean;
    SupportedSeedSizes: TA_KeySize;
    constructor Create;
  end;

  TIAlgorithmInstance = class(TJsObject)
  public
    algorithm: TAlgorithm;
    isInverse: Boolean;
    inputBuffer: TA_U8;
    constructor Create(AAlgorithm: TAlgorithm);
    procedure Feed(data: TA_U8); virtual;
    function Result_: TA_U8; virtual;
    procedure Dispose; virtual;
    function JsSetMember(const AName: string; const AValue: TJsValue): Boolean; override;
    function JsHasMember(const AName: string): Boolean; override;
    function JsGetMember(const AName: string; out AValue: TJsValue): Boolean; override;
    function JsInvoke(const AName: string; const AArgs: array of TJsValue; out AResult: TJsValue): Boolean; override;
  end;

  TIBlockCipherInstance = class(TIAlgorithmInstance)
  public
    BlockSize: Int32;
    KeySize: Int32;
    _key: TA_U8;
    constructor Create(AAlgorithm: TAlgorithm);
    procedure Set_key(keyBytes: TA_U8); virtual;
    function Get_key: TA_U8; virtual;
    property key: TA_U8 read Get_key write Set_key;
    function EncryptBlock(block: TA_U8): TA_U8; virtual;
    function DecryptBlock(block: TA_U8): TA_U8; virtual;
    function RequireBlockMultiple(blockSize_: Int32 = 0): Int32; virtual;
    function Result_: TA_U8; override;
    function JsSetMember(const AName: string; const AValue: TJsValue): Boolean; override;
    function JsHasMember(const AName: string): Boolean; override;
    function JsGetMember(const AName: string; out AValue: TJsValue): Boolean; override;
    function JsInvoke(const AName: string; const AArgs: array of TJsValue; out AResult: TJsValue): Boolean; override;
  end;

  TIHashFunctionInstance = class(TIAlgorithmInstance)
  public
    OutputSize: Int32;
    function JsSetMember(const AName: string; const AValue: TJsValue): Boolean; override;
    function JsHasMember(const AName: string): Boolean; override;
    function JsGetMember(const AName: string; out AValue: TJsValue): Boolean; override;
  end;

  TIMacInstance = class(TIAlgorithmInstance)
  public
    function ComputeMac(data: TA_U8): TA_U8; virtual;
  end;

  TIKdfInstance = class(TIAlgorithmInstance)
  public
    OutputSize: Int32;
    Iterations: Int32;
    function JsSetMember(const AName: string; const AValue: TJsValue): Boolean; override;
    function JsHasMember(const AName: string): Boolean; override;
  end;

  TIAeadInstance = class(TIAlgorithmInstance)
  public
    aad: TA_U8;
    tagSize: Int32;
    function JsSetMember(const AName: string; const AValue: TJsValue): Boolean; override;
    function JsHasMember(const AName: string): Boolean; override;
  end;

  TIErrorCorrectionInstance = class(TIAlgorithmInstance)
  public
    function DetectError(data: TA_U8): Boolean; virtual;
  end;

  TIRandomGeneratorInstance = class(TIAlgorithmInstance)
  public
    function NextBytes(count: Int32): TA_U8; virtual;
  end;

  TCategoryType = record
  const
    ASYMMETRIC = 'Asymmetric Ciphers'; BLOCK = 'Block Ciphers'; STREAM = 'Stream Ciphers'; HASH = 'Hash Functions';
    CHECKSUM = 'Checksums'; COMPRESSION = 'Compression'; ENCODING = 'Encoding Schemes'; CLASSICAL = 'Classical Ciphers';
    MAC = 'Message Authentication'; KDF = 'Key Derivation'; ECC = 'Error Correction'; MODE = 'Cipher Modes';
    PADDING = 'Padding Schemes'; AEAD = 'AEAD'; SPECIAL = 'Special Algorithms'; PQC = 'Post-Quantum Cryptography';
    RANDOM = 'Random Number Generators'; CRYPTO = 'Cryptographic Primitives'; MODES = 'Cipher Modes';
  end;
  TSecurityStatus = record
  const
    SECURE = 'Secure'; DEPRECATED = 'Deprecated'; BROKEN = 'Broken'; OBSOLETE = 'Obsolete';
    EXPERIMENTAL = 'Experimental'; EDUCATIONAL = 'Educational'; INSECURE = 'Insecure'; ACTIVE = 'Active';
  end;
  TComplexityType = record
  const
    BEGINNER = 'Beginner'; INTERMEDIATE = 'Intermediate'; ADVANCED = 'Advanced'; EXPERT = 'Expert'; RESEARCH = 'Research';
    BASIC = 'Basic'; ELEMENTARY = 'Elementary'; TRIVIAL = 'Trivial'; SIMPLE = 'Simple'; LOW = 'Low'; MEDIUM = 'Medium'; HIGH = 'High';
  end;
  TCountryCode = record
  const
    US = 'US'; GB = 'GB'; UK = 'UK'; DE = 'DE'; FR = 'FR'; JP = 'JP'; CN = 'CN'; RU = 'RU'; KR = 'KR'; IL = 'IL';
    BE = 'BE'; CH = 'CH'; NL = 'NL'; AU = 'AU'; CA = 'CA'; IT = 'IT'; ES = 'ES'; SE = 'SE'; NO = 'NO'; FI = 'FI';
    DK = 'DK'; AT = 'AT'; PL = 'PL'; UA = 'UA'; BR = 'BR'; IN_ = 'IN'; SG = 'SG'; TR = 'TR'; ZA = 'ZA'; GR = 'GR';
    PT = 'PT'; ID = 'ID'; CR = 'CR'; EU = 'EU'; INT = 'INT'; INTL = 'INTL'; INTERNATIONAL = 'INTERNATIONAL';
    MULTI = 'MULTI'; ANCIENT = 'ANCIENT'; UNKNOWN = 'UNKNOWN'; OTHER = 'OTHER'; AUSTRIA = 'AUSTRIA';
    FRANCE = 'FRANCE'; NETHERLANDS = 'NETHERLANDS'; SINGAPORE = 'SINGAPORE';
  end;

var
  JsAlgorithms: TA_Algorithm;

procedure RegisterAlgorithm(AAlgorithm: TAlgorithm);
function JsFindAlgorithm(const AName: string): TAlgorithm;

function MerkleDamgardBlocks(const held: TA_U8; pending: Int32; totalLength: UInt64; options: TMerkleDamgardOptions): TA_A_U8;
function SpongePadBlocks(const held: TA_U8; pending, rate, separator: Int32): TA_A_U8;

function JsClampIndex(I, N: Int32): Int32; inline;
{ ---- numbers ---- }
function JsToInt32(D: Double): Int32;
function JsToUInt32(D: Double): UInt32;
function JsToInt64(D: Double): Int64;
function JsToUInt64(D: Double): UInt64;
function JsFloor(D: Double): Double;
function JsCeil(D: Double): Double;
function JsTrunc(D: Double): Double;
function JsRound(D: Double): Double;
function JsFMod(A, B: Double): Double;
function JsPow(A, B: Double): Double;
function JsSign(D: Double): Double;
function JsImul(A, B: Int32): Int32;
function JsClz32(X: UInt32): Int32;
function JsIntDiv(A, B: Int64): Int64;
function JsIntMod(A, B: Int64): Int64;
function JsUIntDiv(A, B: UInt64): UInt64;
function JsUIntMod(A, B: UInt64): UInt64;
function JsNumToStr(D: Double): string;
function JsNumToStrRadix(D: Double; Radix: Int32): string;
function JsIntToStrRadix(V: Int64; Radix: Int32): string;
function JsUIntToStrRadix(V: UInt64; Radix: Int32): string;
function JsBoolToStr(B: Boolean): string;
function JsParseInt(const S: string; Radix: Int32 = 10): Double;
function JsParseFloat(const S: string): Double;
function JsStrToNum(const S: string): Double;
function JsIsInteger(D: Double): Boolean;
function JsNaN: Double;
function JsInfinity: Double;
function JsMinD(A, B: Double): Double;
function JsMaxD(A, B: Double): Double;
function JsMinI(A, B: Int64): Int64;
function JsMaxI(A, B: Int64): Int64;
function JsMinU(A, B: UInt64): UInt64;
function JsMaxU(A, B: UInt64): UInt64;
function JsRandom: Double;
function JsBigToStr(const B: TBigInt): string;
function JsTypeOf(const V: TJsValue): string;
function JsNumTruthy(D: Double): Boolean;
function JsDbl(D: Double): Double; inline;
function JsShl64(V: UInt64; N: Int32): UInt64;
function JsShr64(V: UInt64; N: Int32): UInt64;
function JsSar64(V: Int64; N: Int32): Int64;
function JsBigAbs(const B: TBigInt): TBigInt;

{ ---- strings ---- }
function JsCharCodeAt(const S: string; I: Int32): Int32;
function JsCodePointAt(const S: string; I: Int32): Int32;
function JsCharAt(const S: string; I: Int32): string;
function JsFromCharCode(C: Int32): string;
function JsFromCharCodesI32(const A: TA_I32): string;
function JsFromCharCodesU8(const A: TA_U8): string;
function JsFromCharCodesU16(const A: TA_U16): string;
function JsFromCharCodesU32(const A: TA_U32): string;
function JsSubstring(const S: string; A: Int32): string; overload;
function JsSubstring(const S: string; A, B: Int32): string; overload;
function JsSubstr(const S: string; A: Int32): string; overload;
function JsSubstr(const S: string; A, Len: Int32): string; overload;
function JsStrSlice(const S: string; A: Int32): string; overload;
function JsStrSlice(const S: string; A, B: Int32): string; overload;
function JsIndexOf(const S, Sub: string; From: Int32 = 0): Int32;
function JsLastIndexOf(const S, Sub: string): Int32;
function JsIncludes(const S, Sub: string): Boolean;
function JsStartsWith(const S, Sub: string): Boolean;
function JsEndsWith(const S, Sub: string): Boolean;
function JsSplit(const S, Sep: string): TA_Str;
function JsJoin(const A: TA_Str; const Sep: string = ','): string; overload;
function JsJoin(const A: TA_U8; const Sep: string = ','): string; overload;
function JsJoin(const A: TA_I32; const Sep: string = ','): string; overload;
function JsJoin(const A: TA_U32; const Sep: string = ','): string; overload;
function JsJoin(const A: TA_U16; const Sep: string = ','): string; overload;
function JsJoin(const A: TA_F64; const Sep: string = ','): string; overload;
function JsJoin(const A: TA_Big; const Sep: string = ','): string; overload;
function JsToUpper(const S: string): string;
function JsToLower(const S: string): string;
function JsTrim(const S: string): string;
function JsTrimStart(const S: string): string;
function JsTrimEnd(const S: string): string;
function JsPadStart(const S: string; N: Int32; const Pad: string = ' '): string;
function JsPadEnd(const S: string; N: Int32; const Pad: string = ' '): string;
function JsRepeat(const S: string; N: Int32): string;
function JsReplaceAll(const S, A, B: string): string;
function JsReplaceFirst(const S, A, B: string): string;
function JsRegexReplace(const S, Pattern, Flags, Repl: string): string;
function JsRegexTest(const Pattern, Flags, S: string): Boolean;
function JsRegexSplit(const S, Pattern, Flags: string): TA_Str;

{ ---- dynamic values ---- }
function JsVUndef: TJsValue;
function JsVNull: TJsValue;
function JsVBool(B: Boolean): TJsValue;
function JsVInt(I: Int64): TJsValue;
function JsVUInt(U: UInt64): TJsValue;
function JsVNum(D: Double): TJsValue;
function JsVStr(const S: string): TJsValue;
function JsVBig(const B: TBigInt): TJsValue;
function JsVObj(O: TObject): TJsValue;
function JsVArr(const A: array of TJsValue): TJsValue;
function JsVArr_U8(const A: TA_U8): TJsValue;
function JsVArr_I8(const A: TA_I8): TJsValue;
function JsVArr_U16(const A: TA_U16): TJsValue;
function JsVArr_I16(const A: TA_I16): TJsValue;
function JsVArr_U32(const A: TA_U32): TJsValue;
function JsVArr_I32(const A: TA_I32): TJsValue;
function JsVArr_U64(const A: TA_U64): TJsValue;
function JsVArr_I64(const A: TA_I64): TJsValue;
function JsVArr_F64(const A: TA_F64): TJsValue;
function JsVArr_Str(const A: TA_Str): TJsValue;
function JsVArr_Big(const A: TA_Big): TJsValue;
function JsVArr_Bool(const A: TA_Bool): TJsValue;
function JsValToBool(const V: TJsValue): Boolean;
function JsValToInt64(const V: TJsValue): Int64;
function JsValToUInt64(const V: TJsValue): UInt64;
function JsValToDouble(const V: TJsValue): Double;
function JsValToStr(const V: TJsValue): string;
function JsValToBig(const V: TJsValue): TBigInt;
function JsValToObj(const V: TJsValue): TObject;
function JsValLength(const V: TJsValue): Int32;
function JsValElem(const V: TJsValue; I: Int32): TJsValue;
function JsValTo_TA_U8(const V: TJsValue): TA_U8;
function JsValTo_TA_I8(const V: TJsValue): TA_I8;
function JsValTo_TA_U16(const V: TJsValue): TA_U16;
function JsValTo_TA_I16(const V: TJsValue): TA_I16;
function JsValTo_TA_U32(const V: TJsValue): TA_U32;
function JsValTo_TA_I32(const V: TJsValue): TA_I32;
function JsValTo_TA_U64(const V: TJsValue): TA_U64;
function JsValTo_TA_I64(const V: TJsValue): TA_I64;
function JsValTo_TA_F64(const V: TJsValue): TA_F64;
function JsValTo_TA_Str(const V: TJsValue): TA_Str;
function JsValTo_TA_Big(const V: TJsValue): TA_Big;
function JsValTo_TA_Bool(const V: TJsValue): TA_Bool;
function JsF(const AName: string; const AValue: TJsValue): TJsField;
function JsArg(const AArgs: array of TJsValue; I: Int32): TJsValue;
function JsObjGet(O: TObject; const AName: string): TJsValue;
procedure JsObjSet(O: TObject; const AName: string; const AValue: TJsValue);
function JsObjCall(O: TObject; const AName: string; const AArgs: array of TJsValue): TJsValue;
function JsSameValue(const A, B: TJsValue): Boolean;
function JsNowMs: Double;
function JsTestCase(const AFields: array of TJsField): TTestCase;
function JsDynObject(const AFields: array of TJsField): TJsValue;
function JsValGet(const V: TJsValue; const AName: string): TJsValue;
procedure JsValSet(const V: TJsValue; const AName: string; const AValue: TJsValue);
function JsValToTestCase(const V: TJsValue): TTestCase;
function JsDescribeException(E: TObject): string;

{ ---- OpCodes ---- }
function OpPack16BE(B0, B1: UInt32): UInt16;
function OpPack16LE(B0, B1: UInt32): UInt16;
function OpPack32BE(B0, B1, B2, B3: UInt32): UInt32;
function OpPack32LE(B0, B1, B2, B3: UInt32): UInt32;
function OpPack64BE(B0, B1, B2, B3, B4, B5, B6, B7: UInt32): UInt64;
function OpPack64LE(B0, B1, B2, B3, B4, B5, B6, B7: UInt32): UInt64;
function OpPackArr(const A: TA_U8; Bits: Int32; BigEndian: Boolean): UInt64;
function OpUnpack16BE(V: UInt32): TA_U8;
function OpUnpack16LE(V: UInt32): TA_U8;
function OpUnpack32BE(V: UInt32): TA_U8;
function OpUnpack32LE(V: UInt32): TA_U8;
function OpUnpack64BE(V: UInt64): TA_U8;
function OpUnpack64LE(V: UInt64): TA_U8;
function OpRotL8(V: UInt32; N: Int32): Byte;
function OpRotR8(V: UInt32; N: Int32): Byte;
function OpRotL16(V: UInt32; N: Int32): Word;
function OpRotR16(V: UInt32; N: Int32): Word;
function OpRotL32(V: UInt32; N: Int32): UInt32;
function OpRotR32(V: UInt32; N: Int32): UInt32;
function OpRotL64(V: UInt64; N: Int32): UInt64;
function OpRotR64(V: UInt64; N: Int32): UInt64;
function OpRotL64n(const V: TBigInt; N: Int32): TBigInt;
function OpRotR64n(const V: TBigInt; N: Int32): TBigInt;
function OpRotL128n(const V: TBigInt; N: Int32): TBigInt;
function OpRotR128n(const V: TBigInt; N: Int32): TBigInt;
function OpHex4ToBytes(const S: string): TA_U8;
function OpHex8ToBytes(const S: string): TA_U8;
function OpHex16ToWords(const S: string): TA_U16;
function OpHex32ToDWords(const S: string): TA_U32;
function OpAnsiToBytes(const S: string): TA_U8;
function OpAsciiToBytes(const S: string): TA_U8;
function OpUtf8ToBytes(const S: string): TA_U8;
function OpBytesToAnsi(const A: TA_U8): string;
function OpBytesToChars(const A: TA_U8): string;
function OpBytesToUtf8(const A: TA_U8): string;
function OpXorArrays(const A, B: TA_U8): TA_U8;
function OpXorArrayWithByte(const A: TA_U8; V: UInt32): TA_U8;
function OpSecureCompare(const A, B: TA_U8): Boolean;
function OpConstantTimeCompare(const A, B: TA_U8; N: Int32 = 0): Boolean;
function OpArraysEqual(const A, B: TA_U8): Boolean;
function OpGF256Mul(A, B: UInt32): Byte;
function OpGFMul(A, B, Irreducible: UInt32; Width: Int32): UInt32;
function OpGetByte(W: UInt32; Index: Int32): Byte;
function OpGetBit(V: UInt32; Index: Int32): Boolean;
function OpSetBit(V: UInt32; Index: Int32; Bit: Boolean): UInt32;
function OpBitMask(Bits: Int32): UInt32;
function OpShr32Signed(V: Int32; N: Int32): Int32;
function OpMulHi32(A, B: UInt32): UInt32;
function OpPopCount(V: UInt32): Int32;
function OpAddMod(A, B, M: Int32): Int32;
function OpSubMod(A, B, M: Int32): Int32;
function OpWords32ToBytesBE(const W: TA_U32): TA_U8;
function OpBytesToWords32BE(const B: TA_U8): TA_U32;
function OpEncodeMsgLength64LE(BitLength: UInt64): TA_U8;
function OpGHashMul(const X, Y: TA_U8): TA_U8;
function OpGCMIncrement(const C: TA_U8): TA_U8;
function OpAdd3L64(AL, BL, CL: UInt32): UInt64;
function OpAdd3H64(LowSum: UInt64; AH, BH, CH: UInt32): Int32;
function OpCreateUint64ArrayFromHex(const H: TA_Str): TA_A_U32;
function OpToLong(const V: TBigInt): TBigInt;
function OpToShort(V: Int32): Int16;
function OpGetBitN(const V: TBigInt; Index: Int32): TBigInt;
function OpMulModN(const A, B, M: TBigInt): TBigInt;
function OpSquareModN(const A, M: TBigInt): TBigInt;
function OpModPowN(const B, E, M: TBigInt): TBigInt;
function OpGcdN(const A, B: TBigInt): TBigInt;
function OpModN(const A, M: TBigInt): TBigInt;
function OpModInverseN(const A, M: TBigInt): TBigInt;
function OpBitCountN(const V: TBigInt): Int32;
function OpSecureRandomBytes(Count: Int32): TA_U8;`;

  const RUNTIME_IMPLEMENTATION = String.raw`{ ======================== BigInt ======================== }

type
  TLimbs = array of UInt32;

function BigTrim(const A: TLimbs): TLimbs;
var N: Int32;
begin
  N := System.Length(A);
  while (N > 0) and (A[N - 1] = 0) do Dec(N);
  if N = System.Length(A) then Exit(A);
  Result := System.Copy(A, 0, N);
end;

function BigMake(ANeg: Boolean; const AM: TLimbs): TBigInt;
begin
  Result.M := BigTrim(AM);
  Result.Neg := ANeg and (System.Length(Result.M) > 0);
end;

function MagCmp(const A, B: TLimbs): Int32;
var I: Int32;
begin
  if System.Length(A) <> System.Length(B) then
    if System.Length(A) < System.Length(B) then Exit(-1) else Exit(1);
  for I := System.Length(A) - 1 downto 0 do
    if A[I] <> B[I] then
      if A[I] < B[I] then Exit(-1) else Exit(1);
  Result := 0;
end;

function MagAdd(const A, B: TLimbs): TLimbs;
var I, N: Int32; C: UInt64; X, Y: UInt32;
begin
  N := System.Length(A);
  if System.Length(B) > N then N := System.Length(B);
  SetLength(Result, N + 1);
  C := 0;
  for I := 0 to N - 1 do
  begin
    if I < System.Length(A) then X := A[I] else X := 0;
    if I < System.Length(B) then Y := B[I] else Y := 0;
    C := C + UInt64(X) + Y;
    Result[I] := UInt32(C);
    C := C shr 32;
  end;
  Result[N] := UInt32(C);
  Result := BigTrim(Result);
end;

{ A >= B required }
function MagSub(const A, B: TLimbs): TLimbs;
var I: Int32; D: Int64; Borrow: Int64; Y: UInt32;
begin
  SetLength(Result, System.Length(A));
  Borrow := 0;
  for I := 0 to System.Length(A) - 1 do
  begin
    if I < System.Length(B) then Y := B[I] else Y := 0;
    D := Int64(A[I]) - Int64(Y) - Borrow;
    if D < 0 then begin D := D + $100000000; Borrow := 1; end else Borrow := 0;
    Result[I] := UInt32(D);
  end;
  Result := BigTrim(Result);
end;

function MagMul(const A, B: TLimbs): TLimbs;
var I, J, NA, NB: Int32; C, T: UInt64; AI: UInt32;
begin
  NA := System.Length(A); NB := System.Length(B);
  if (NA = 0) or (NB = 0) then Exit(nil);
  SetLength(Result, NA + NB);
  for I := 0 to NA + NB - 1 do Result[I] := 0;
  for I := 0 to NA - 1 do
  begin
    AI := A[I];
    if AI = 0 then Continue;
    C := 0;
    for J := 0 to NB - 1 do
    begin
      T := UInt64(AI) * B[J] + Result[I + J] + C;
      Result[I + J] := UInt32(T);
      C := T shr 32;
    end;
    Result[I + NB] := UInt32(C);
  end;
  Result := BigTrim(Result);
end;

function MagDivSmall(const A: TLimbs; D: UInt32; out R: UInt32): TLimbs;
var I: Int32; Rem: UInt64;
begin
  SetLength(Result, System.Length(A));
  Rem := 0;
  for I := System.Length(A) - 1 downto 0 do
  begin
    Rem := (Rem shl 32) or A[I];
    Result[I] := UInt32(Rem div D);
    Rem := Rem mod D;
  end;
  R := UInt32(Rem);
  Result := BigTrim(Result);
end;

function MagShl(const A: TLimbs; N: Int32): TLimbs;
var W, B, I: Int32; LA: Int32;
begin
  LA := System.Length(A);
  if (LA = 0) then Exit(nil);
  W := N div 32; B := N mod 32;
  SetLength(Result, LA + W + 1);
  for I := 0 to System.Length(Result) - 1 do Result[I] := 0;
  for I := 0 to LA - 1 do
  begin
    if B = 0 then
      Result[I + W] := A[I]
    else
    begin
      Result[I + W] := Result[I + W] or (A[I] shl B);
      Result[I + W + 1] := A[I] shr (32 - B);
    end;
  end;
  Result := BigTrim(Result);
end;

function MagShr(const A: TLimbs; N: Int32): TLimbs;
var W, B, I, LA: Int32;
begin
  LA := System.Length(A);
  W := N div 32; B := N mod 32;
  if W >= LA then Exit(nil);
  SetLength(Result, LA - W);
  for I := 0 to LA - W - 1 do
  begin
    if B = 0 then
      Result[I] := A[I + W]
    else
    begin
      Result[I] := A[I + W] shr B;
      if I + W + 1 < LA then Result[I] := Result[I] or (A[I + W + 1] shl (32 - B));
    end;
  end;
  Result := BigTrim(Result);
end;

{ Knuth algorithm D: Q = A div B, R = A mod B (magnitudes) }
procedure MagDivMod(const A, B: TLimbs; out Q, R: TLimbs);
var
  S, M, N, I, J: Int32;
  U, V, Sh: TLimbs;
  QHat, RHat, P, Num: UInt64;
  T, K: Int64;
  BTop, BNext: UInt64;
  Rem, Top: UInt32;
begin
  if System.Length(B) = 0 then raise EJsRangeError.Create('Division by zero');
  if MagCmp(A, B) < 0 then begin Q := nil; R := System.Copy(A); Exit; end;
  if System.Length(B) = 1 then
  begin
    Q := MagDivSmall(A, B[0], Rem);
    if Rem = 0 then R := nil else begin SetLength(R, 1); R[0] := Rem; end;
    Exit;
  end;
  { normalize so the divisor's top bit is set }
  S := 0;
  Top := B[System.Length(B) - 1];
  while (Top and $80000000) = 0 do begin Top := Top shl 1; Inc(S); end;
  V := MagShl(B, S);
  N := System.Length(V);
  Sh := MagShl(A, S);
  SetLength(U, System.Length(A) + 1);
  for I := 0 to System.Length(U) - 1 do
    if I < System.Length(Sh) then U[I] := Sh[I] else U[I] := 0;
  M := System.Length(A) - N;
  SetLength(Q, M + 1);
  BTop := V[N - 1];
  BNext := V[N - 2];
  for J := M downto 0 do
  begin
    Num := (UInt64(U[J + N]) shl 32) or U[J + N - 1];
    QHat := Num div BTop;
    RHat := Num mod BTop;
    while (QHat >= $100000000) or (QHat * BNext > ((RHat shl 32) or U[J + N - 2])) do
    begin
      Dec(QHat);
      RHat := RHat + BTop;
      if RHat >= $100000000 then Break;
    end;
    { multiply and subtract }
    K := 0;
    for I := 0 to N - 1 do
    begin
      P := QHat * V[I];
      T := Int64(U[I + J]) - K - Int64(P and $FFFFFFFF);
      U[I + J] := UInt32(T);
      K := Int64(P shr 32) - SarInt64(T, 32);
    end;
    T := Int64(U[J + N]) - K;
    U[J + N] := UInt32(T);
    Q[J] := UInt32(QHat);
    if T < 0 then
    begin
      Q[J] := UInt32(QHat - 1);
      K := 0;
      for I := 0 to N - 1 do
      begin
        T := Int64(U[I + J]) + Int64(V[I]) + K;
        U[I + J] := UInt32(T);
        K := T shr 32;
      end;
      U[J + N] := UInt32(Int64(U[J + N]) + K);
    end;
  end;
  Q := BigTrim(Q);
  SetLength(U, N);
  R := MagShr(BigTrim(U), S);
end;

class function TBigInt.Zero: TBigInt;
begin
  Result.Neg := False;
  Result.M := nil;
end;

class function TBigInt.FromUInt64(V: UInt64): TBigInt;
begin
  Result.Neg := False;
  if V = 0 then begin Result.M := nil; Exit; end;
  if V shr 32 = 0 then
  begin
    SetLength(Result.M, 1);
    Result.M[0] := UInt32(V);
  end
  else
  begin
    SetLength(Result.M, 2);
    Result.M[0] := UInt32(V);
    Result.M[1] := UInt32(V shr 32);
  end;
end;

class function TBigInt.FromInt64(V: Int64): TBigInt;
begin
  if V >= 0 then Exit(FromUInt64(UInt64(V)));
  Result := FromUInt64(UInt64(-(V + 1)) + 1);
  Result.Neg := True;
end;

class function TBigInt.FromBool(V: Boolean): TBigInt;
begin
  Result := FromInt64(Ord(V));
end;

class function TBigInt.FromDouble(V: Double): TBigInt;
var E: Int32; Mant: Extended; Neg_: Boolean;
begin
  if IsNan(V) or IsInfinite(V) then raise EJsRangeError.Create('The number cannot be converted to a BigInt');
  V := Int(V);
  Neg_ := V < 0;
  if Neg_ then V := -V;
  if V < 9.2233720368547758E18 then
    Result := FromUInt64(Trunc(V))
  else
  begin
    Frexp(V, Mant, E);
    { V = Mant * 2^E, 0.5 <= Mant < 1 }
    Result := FromUInt64(UInt64(Trunc(Mant * 9007199254740992.0))) shl (E - 53);
  end;
  Result.Neg := Neg_ and not Result.IsZero;
end;

class function TBigInt.Parse(const S: string): TBigInt;
var T: string; I, Radix, Start, D: Int32; Neg_: Boolean; Ch: Char; R: TBigInt; RadixBig: TBigInt;
begin
  T := Trim(S);
  Neg_ := False;
  Start := 1;
  if (System.Length(T) > 0) and ((T[1] = '-') or (T[1] = '+')) then
  begin
    Neg_ := T[1] = '-';
    Start := 2;
  end;
  Radix := 10;
  if (System.Length(T) >= Start + 1) and (T[Start] = '0') and CharInSet(T[Start + 1], ['x', 'X', 'b', 'B', 'o', 'O']) then
  begin
    case T[Start + 1] of
      'x', 'X': Radix := 16;
      'b', 'B': Radix := 2;
      'o', 'O': Radix := 8;
    end;
    Start := Start + 2;
  end;
  R := Zero;
  RadixBig := FromInt64(Radix);
  for I := Start to System.Length(T) do
  begin
    Ch := T[I];
    case Ch of
      '0'..'9': D := Ord(Ch) - 48;
      'a'..'z': D := Ord(Ch) - 87;
      'A'..'Z': D := Ord(Ch) - 55;
    else
      raise EJsError.Create('SyntaxError: Cannot convert ' + S + ' to a BigInt');
    end;
    if D >= Radix then raise EJsError.Create('SyntaxError: Cannot convert ' + S + ' to a BigInt');
    R := R * RadixBig + FromInt64(D);
  end;
  R.Neg := Neg_ and not R.IsZero;
  Result := R;
end;

function TBigInt.IsZero: Boolean;
begin
  Result := System.Length(M) = 0;
end;

function TBigInt.Sign: Int32;
begin
  if System.Length(M) = 0 then Exit(0);
  if Neg then Result := -1 else Result := 1;
end;

function TBigInt.ToUInt64: UInt64;
var V: UInt64;
begin
  V := 0;
  if System.Length(M) > 0 then V := M[0];
  if System.Length(M) > 1 then V := V or (UInt64(M[1]) shl 32);
  if Neg then V := UInt64(0) - V;
  Result := V;
end;

function TBigInt.ToInt64: Int64;
begin
  Result := Int64(ToUInt64);
end;

function TBigInt.ToUInt32: UInt32;
begin
  Result := UInt32(ToUInt64);
end;

function TBigInt.ToInt32: Int32;
begin
  Result := Int32(UInt32(ToUInt64));
end;

function TBigInt.ToDouble: Double;
var I: Int32;
begin
  Result := 0;
  for I := System.Length(M) - 1 downto 0 do
    Result := Result * 4294967296.0 + M[I];
  if Neg then Result := -Result;
end;

function TBigInt.BitLength: Int32;
var Top: UInt32;
begin
  if System.Length(M) = 0 then Exit(0);
  Result := (System.Length(M) - 1) * 32;
  Top := M[System.Length(M) - 1];
  while Top <> 0 do begin Inc(Result); Top := Top shr 1; end;
end;

function TBigInt.ToString(Radix: Int32): string;
const Digits = '0123456789abcdefghijklmnopqrstuvwxyz';
var Mag: TLimbs; R: UInt32; Chunk: UInt32; Width, K: Int32; Part: string;
begin
  if (Radix < 2) or (Radix > 36) then raise EJsRangeError.Create('toString() radix must be between 2 and 36');
  if System.Length(M) = 0 then Exit('0');
  Result := '';
  Mag := M;
  { the largest power of Radix that fits in 32 bits, chunked }
  Chunk := Radix; Width := 1;
  while UInt64(Chunk) * UInt32(Radix) <= $FFFFFFFF do begin Chunk := Chunk * UInt32(Radix); Inc(Width); end;
  while System.Length(Mag) > 0 do
  begin
    Mag := MagDivSmall(Mag, Chunk, R);
    Part := '';
    for K := 1 to Width do
    begin
      Part := Digits[(R mod UInt32(Radix)) + 1] + Part;
      R := R div UInt32(Radix);
      if (System.Length(Mag) = 0) and (R = 0) then Break;
    end;
    Result := Part + Result;
  end;
  if Neg then Result := '-' + Result;
end;

class function TBigInt.Compare(const A, B: TBigInt): Int32;
begin
  if A.Neg <> B.Neg then
    if A.Neg then Exit(-1) else Exit(1);
  Result := MagCmp(A.M, B.M);
  if A.Neg then Result := -Result;
end;

class operator TBigInt.Add(const A, B: TBigInt): TBigInt;
var C: Int32;
begin
  if A.Neg = B.Neg then Exit(BigMake(A.Neg, MagAdd(A.M, B.M)));
  C := MagCmp(A.M, B.M);
  if C = 0 then Exit(Zero);
  if C > 0 then Result := BigMake(A.Neg, MagSub(A.M, B.M))
  else Result := BigMake(B.Neg, MagSub(B.M, A.M));
end;

class operator TBigInt.Negative(const A: TBigInt): TBigInt;
begin
  Result.M := A.M;
  Result.Neg := (not A.Neg) and (System.Length(A.M) > 0);
end;

class operator TBigInt.Subtract(const A, B: TBigInt): TBigInt;
begin
  Result := A + (-B);
end;

class operator TBigInt.Multiply(const A, B: TBigInt): TBigInt;
begin
  Result := BigMake(A.Neg <> B.Neg, MagMul(A.M, B.M));
end;

class procedure TBigInt.DivMod(const A, B: TBigInt; out Q, R: TBigInt);
var QM, RM: TLimbs;
begin
  if B.IsZero then raise EJsRangeError.Create('Division by zero');
  MagDivMod(A.M, B.M, QM, RM);
  Q := BigMake(A.Neg <> B.Neg, QM);
  R := BigMake(A.Neg, RM);
end;

class operator TBigInt.IntDivide(const A, B: TBigInt): TBigInt;
var R: TBigInt;
begin
  DivMod(A, B, Result, R);
end;

class operator TBigInt.Modulus(const A, B: TBigInt): TBigInt;
var Q: TBigInt;
begin
  DivMod(A, B, Q, Result);
end;

class function TBigInt.Pow(const A: TBigInt; E: Int64): TBigInt;
var Base: TBigInt;
begin
  if E < 0 then raise EJsRangeError.Create('Exponent must be non-negative');
  Result := FromInt64(1);
  Base := A;
  while E > 0 do
  begin
    if (E and 1) <> 0 then Result := Result * Base;
    E := E shr 1;
    if E > 0 then Base := Base * Base;
  end;
end;

class operator TBigInt.LeftShift(const A: TBigInt; N: Int32): TBigInt;
begin
  if N < 0 then Exit(A shr (-N));
  Result := BigMake(A.Neg, MagShl(A.M, N));
end;

class operator TBigInt.RightShift(const A: TBigInt; N: Int32): TBigInt;
var One: TLimbs;
begin
  if N < 0 then Exit(A shl (-N));
  if not A.Neg then Exit(BigMake(False, MagShr(A.M, N)));
  { floor division for negatives: -(((|a| - 1) >> n) + 1) }
  SetLength(One, 1); One[0] := 1;
  Result := BigMake(True, MagAdd(MagShr(MagSub(A.M, One), N), One));
end;

{ two's complement in N limbs }
function BigToTC(const A: TBigInt; N: Int32): TLimbs;
var I: Int32; C: UInt64;
begin
  SetLength(Result, N);
  for I := 0 to N - 1 do
    if I < System.Length(A.M) then Result[I] := A.M[I] else Result[I] := 0;
  if A.Neg then
  begin
    C := 1;
    for I := 0 to N - 1 do
    begin
      C := C + UInt64(not Result[I]);
      Result[I] := UInt32(C);
      C := C shr 32;
    end;
  end;
end;

function BigFromTC(const T: TLimbs): TBigInt;
var I, N: Int32; C: UInt64; R: TLimbs;
begin
  N := System.Length(T);
  if (N > 0) and ((T[N - 1] and $80000000) <> 0) then
  begin
    SetLength(R, N);
    C := 1;
    for I := 0 to N - 1 do
    begin
      C := C + UInt64(not T[I]);
      R[I] := UInt32(C);
      C := C shr 32;
    end;
    Result := BigMake(True, R);
  end
  else
    Result := BigMake(False, T);
end;

function BigBitOp(const A, B: TBigInt; Op: Int32): TBigInt;
var N, I: Int32; X, Y, R: TLimbs;
begin
  N := System.Length(A.M);
  if System.Length(B.M) > N then N := System.Length(B.M);
  Inc(N);
  X := BigToTC(A, N); Y := BigToTC(B, N);
  SetLength(R, N);
  for I := 0 to N - 1 do
    case Op of
      0: R[I] := X[I] and Y[I];
      1: R[I] := X[I] or Y[I];
    else
      R[I] := X[I] xor Y[I];
    end;
  Result := BigFromTC(R);
end;

class operator TBigInt.BitwiseAnd(const A, B: TBigInt): TBigInt;
var N, I: Int32; R: TLimbs;
begin
  if not A.Neg and not B.Neg then
  begin
    N := System.Length(A.M);
    if System.Length(B.M) < N then N := System.Length(B.M);
    SetLength(R, N);
    for I := 0 to N - 1 do R[I] := A.M[I] and B.M[I];
    Exit(BigMake(False, R));
  end;
  Result := BigBitOp(A, B, 0);
end;

class operator TBigInt.BitwiseOr(const A, B: TBigInt): TBigInt;
begin
  Result := BigBitOp(A, B, 1);
end;

class operator TBigInt.BitwiseXor(const A, B: TBigInt): TBigInt;
begin
  Result := BigBitOp(A, B, 2);
end;

class operator TBigInt.LogicalNot(const A: TBigInt): TBigInt;
begin
  Result := (-A) - FromInt64(1);
end;

class function TBigInt.AsUintN(Bits: Int32; const A: TBigInt): TBigInt;
var N: Int32; T: TLimbs;
begin
  if Bits <= 0 then Exit(Zero);
  N := (Bits + 31) div 32;
  T := BigToTC(A, N + 1);
  SetLength(T, N);
  if (Bits mod 32) <> 0 then T[N - 1] := T[N - 1] and ((UInt32(1) shl (Bits mod 32)) - 1);
  Result := BigMake(False, T);
end;

class function TBigInt.AsIntN(Bits: Int32; const A: TBigInt): TBigInt;
var U: TBigInt;
begin
  if Bits <= 0 then Exit(Zero);
  U := AsUintN(Bits, A);
  if U.BitLength >= Bits then
    Result := U - (FromInt64(1) shl Bits)
  else
    Result := U;
end;

class operator TBigInt.Equal(const A, B: TBigInt): Boolean;
begin
  Result := Compare(A, B) = 0;
end;

class operator TBigInt.NotEqual(const A, B: TBigInt): Boolean;
begin
  Result := Compare(A, B) <> 0;
end;

class operator TBigInt.LessThan(const A, B: TBigInt): Boolean;
begin
  Result := Compare(A, B) < 0;
end;

class operator TBigInt.LessThanOrEqual(const A, B: TBigInt): Boolean;
begin
  Result := Compare(A, B) <= 0;
end;

class operator TBigInt.GreaterThan(const A, B: TBigInt): Boolean;
begin
  Result := Compare(A, B) > 0;
end;

class operator TBigInt.GreaterThanOrEqual(const A, B: TBigInt): Boolean;
begin
  Result := Compare(A, B) >= 0;
end;

{ ======================== JS arrays ======================== }

class function TJsEq<T>.Eq(const A, B: T): Boolean;
begin
  case GetTypeKind(T) of
    tkUString: Result := PUnicodeString(@A)^ = PUnicodeString(@B)^;
    tkAString: Result := PAnsiString(@A)^ = PAnsiString(@B)^;
    tkFloat:
      if SizeOf(T) = SizeOf(Double) then Result := PDouble(@A)^ = PDouble(@B)^
      else Result := PSingle(@A)^ = PSingle(@B)^;
    tkRecord:
      if TypeInfo(T) = TypeInfo(TBigInt) then Result := PBigInt(@A)^ = PBigInt(@B)^
      else Result := CompareMem(@A, @B, SizeOf(T));
  else
    Result := CompareMem(@A, @B, SizeOf(T));
  end;
end;

function TJsArray<T>.GetLength: Int32;
begin
  if S = nil then Exit(0);
  if L >= 0 then Exit(L);
  Result := S[0].Count;
end;

function TJsArray<T>.Get(I: Int32): T;
begin
  if (S = nil) or (UInt32(I) >= UInt32(GetLength)) then Exit(Default(T));
  Result := S[0].Items[O + I];
end;

procedure TJsArray<T>.Grow(I: Int32);
var C, J: Int32;
begin
  if S = nil then raise EJsTypeError.Create('Cannot set properties of null');
  if L >= 0 then Exit;
  C := System.Length(S[0].Items);
  if I >= C then
  begin
    if C < 8 then C := 8;
    while C <= I do C := C * 2;
    System.SetLength(S[0].Items, C);
  end;
  for J := S[0].Count to I - 1 do S[0].Items[J] := Default(T);
  S[0].Count := I + 1;
end;

procedure TJsArray<T>.Put(I: Int32; const V: T);
begin
  if (S = nil) or (UInt32(I) >= UInt32(GetLength)) then
  begin
    if I < 0 then Exit;
    if (S <> nil) and (L >= 0) then Exit;
    Grow(I);
  end;
  S[0].Items[O + I] := V;
end;

procedure TJsArray<T>.SetLength_(N: Int32);
var J: Int32;
begin
  if S = nil then raise EJsTypeError.Create('Cannot set properties of null');
  if L >= 0 then Exit;
  if N < S[0].Count then
  begin
    for J := N to S[0].Count - 1 do S[0].Items[J] := Default(T);
    S[0].Count := N;
  end
  else if N > S[0].Count then
  begin
    Grow(N - 1);
  end;
end;

class function TJsArray<T>.New(N: Int32): TJsArray<T>;
var J: Int32;
begin
  if N < 0 then raise EJsRangeError.Create('Invalid array length');
  Result.O := 0;
  Result.L := -1;
  System.SetLength(Result.S, 1);
  System.SetLength(Result.S[0].Items, N);
  for J := 0 to N - 1 do Result.S[0].Items[J] := Default(T);
  Result.S[0].Count := N;
end;

class function TJsArray<T>.Empty: TJsArray<T>;
begin
  Result := New(0);
end;

class function TJsArray<T>.Null: TJsArray<T>;
begin
  Result.S := nil;
  Result.O := 0;
  Result.L := -1;
end;

class function TJsArray<T>.From(const A: array of T): TJsArray<T>;
var J: Int32;
begin
  Result := New(System.Length(A));
  for J := 0 to System.Length(A) - 1 do Result.S[0].Items[J] := A[J];
end;

class function TJsArray<T>.Concat(const Parts: array of TJsArray<T>): TJsArray<T>;
var J, K, N, P: Int32;
begin
  N := 0;
  for J := 0 to System.Length(Parts) - 1 do N := N + Parts[J].GetLength;
  Result := New(N);
  P := 0;
  for J := 0 to System.Length(Parts) - 1 do
    for K := 0 to Parts[J].GetLength - 1 do
    begin
      Result.S[0].Items[P] := Parts[J].S[0].Items[Parts[J].O + K];
      Inc(P);
    end;
end;

function TJsArray<T>.IsNull: Boolean;
begin
  Result := S = nil;
end;

function TJsArray<T>.Same(const B: TJsArray<T>): Boolean;
begin
  Result := (Pointer(S) = Pointer(B.S)) and (O = B.O) and (L = B.L);
end;

function TJsArray<T>.Push(const V: T): Int32;
var N: Int32;
begin
  N := GetLength;
  Put(N, V);
  Result := GetLength;
end;

procedure TJsArray<T>.PushAll(const B: TJsArray<T>);
var J, N, M: Int32; Tmp: TJsArray<T>;
begin
  M := B.GetLength;
  if M = 0 then Exit;
  if Same(B) then Tmp := B.Copy else Tmp := B;
  N := GetLength;
  Grow(N + M - 1);
  for J := 0 to M - 1 do S[0].Items[N + J] := Tmp.S[0].Items[Tmp.O + J];
end;

function TJsArray<T>.Pop: T;
var N: Int32;
begin
  N := GetLength;
  if (N = 0) or (L >= 0) then Exit(Default(T));
  Result := S[0].Items[N - 1];
  S[0].Items[N - 1] := Default(T);
  S[0].Count := N - 1;
end;

function TJsArray<T>.Shift: T;
var N, J: Int32;
begin
  N := GetLength;
  if (N = 0) or (L >= 0) then Exit(Default(T));
  Result := S[0].Items[0];
  for J := 1 to N - 1 do S[0].Items[J - 1] := S[0].Items[J];
  S[0].Items[N - 1] := Default(T);
  S[0].Count := N - 1;
end;

function TJsArray<T>.Unshift(const V: T): Int32;
var N, J: Int32;
begin
  N := GetLength;
  Grow(N);
  for J := N downto 1 do S[0].Items[J] := S[0].Items[J - 1];
  S[0].Items[0] := V;
  Result := N + 1;
end;

function JsClampIndex(I, N: Int32): Int32; inline;
begin
  if I < 0 then
  begin
    I := I + N;
    if I < 0 then I := 0;
  end
  else if I > N then I := N;
  Result := I;
end;

function TJsArray<T>.Slice(AStart: Int32): TJsArray<T>;
begin
  Result := Slice(AStart, GetLength);
end;

function TJsArray<T>.Slice(AStart, AEnd: Int32): TJsArray<T>;
var N, J: Int32;
begin
  if S = nil then raise EJsTypeError.Create('Cannot read properties of null (reading ''slice'')');
  N := GetLength;
  AStart := JsClampIndex(AStart, N);
  AEnd := JsClampIndex(AEnd, N);
  if AEnd < AStart then AEnd := AStart;
  Result := New(AEnd - AStart);
  for J := 0 to AEnd - AStart - 1 do Result.S[0].Items[J] := S[0].Items[O + AStart + J];
end;

function TJsArray<T>.Subarray(AStart: Int32): TJsArray<T>;
begin
  Result := Subarray(AStart, GetLength);
end;

function TJsArray<T>.Subarray(AStart, AEnd: Int32): TJsArray<T>;
var N: Int32;
begin
  if S = nil then raise EJsTypeError.Create('Cannot read properties of null (reading ''subarray'')');
  N := GetLength;
  AStart := JsClampIndex(AStart, N);
  AEnd := JsClampIndex(AEnd, N);
  if AEnd < AStart then AEnd := AStart;
  Result.S := S;
  Result.O := O + AStart;
  Result.L := AEnd - AStart;
end;

function TJsArray<T>.Copy: TJsArray<T>;
begin
  Result := Slice(0, GetLength);
end;

function TJsArray<T>.Fill(const V: T): TJsArray<T>;
begin
  Result := Fill(V, 0, GetLength);
end;

function TJsArray<T>.Fill(const V: T; AStart: Int32): TJsArray<T>;
begin
  Result := Fill(V, AStart, GetLength);
end;

function TJsArray<T>.Fill(const V: T; AStart, AEnd: Int32): TJsArray<T>;
var N, J: Int32;
begin
  N := GetLength;
  AStart := JsClampIndex(AStart, N);
  AEnd := JsClampIndex(AEnd, N);
  for J := AStart to AEnd - 1 do S[0].Items[O + J] := V;
  Result := Self;
end;

procedure TJsArray<T>.SetFrom(const Src: TJsArray<T>; Offset: Int32);
var J, M: Int32; Tmp: TJsArray<T>;
begin
  M := Src.GetLength;
  if (Offset < 0) or (Offset + M > GetLength) then raise EJsRangeError.Create('offset is out of bounds');
  if Pointer(Src.S) = Pointer(S) then Tmp := Src.Copy else Tmp := Src;
  for J := 0 to M - 1 do S[0].Items[O + Offset + J] := Tmp.S[0].Items[Tmp.O + J];
end;

function TJsArray<T>.Reverse: TJsArray<T>;
var I, J: Int32; X: T;
begin
  I := 0; J := GetLength - 1;
  while I < J do
  begin
    X := S[0].Items[O + I];
    S[0].Items[O + I] := S[0].Items[O + J];
    S[0].Items[O + J] := X;
    Inc(I); Dec(J);
  end;
  Result := Self;
end;

function TJsArray<T>.Splice(AStart: Int32): TJsArray<T>;
begin
  Result := Splice(AStart, GetLength, []);
end;

function TJsArray<T>.Splice(AStart, ADeleteCount: Int32): TJsArray<T>;
begin
  Result := Splice(AStart, ADeleteCount, []);
end;

function TJsArray<T>.Splice(AStart, ADeleteCount: Int32; const AItems: array of T): TJsArray<T>;
var N, J, Ins, NewN: Int32; Old: array of T;
begin
  N := GetLength;
  AStart := JsClampIndex(AStart, N);
  if ADeleteCount < 0 then ADeleteCount := 0;
  if ADeleteCount > N - AStart then ADeleteCount := N - AStart;
  Result := Slice(AStart, AStart + ADeleteCount);
  Ins := System.Length(AItems);
  NewN := N - ADeleteCount + Ins;
  System.SetLength(Old, N);
  for J := 0 to N - 1 do Old[J] := S[0].Items[J];
  if NewN > N then Grow(NewN - 1) else SetLength_(NewN);
  for J := 0 to Ins - 1 do S[0].Items[AStart + J] := AItems[J];
  for J := AStart + ADeleteCount to N - 1 do S[0].Items[J - ADeleteCount + Ins] := Old[J];
end;

function TJsArray<T>.IndexOf(const V: T; FromIndex: Int32): Int32;
var J, N: Int32;
begin
  N := GetLength;
  if FromIndex < 0 then FromIndex := FromIndex + N;
  if FromIndex < 0 then FromIndex := 0;
  for J := FromIndex to N - 1 do
    if TJsEq<T>.Eq(S[0].Items[O + J], V) then Exit(J);
  Result := -1;
end;

function TJsArray<T>.LastIndexOf(const V: T): Int32;
var J: Int32;
begin
  for J := GetLength - 1 downto 0 do
    if TJsEq<T>.Eq(S[0].Items[O + J], V) then Exit(J);
  Result := -1;
end;

function TJsArray<T>.Includes(const V: T): Boolean;
begin
  Result := IndexOf(V) >= 0;
end;

function TJsArray<T>.Sort(Fn: TCompareFn): TJsArray<T>;
var N: Int32;
  Tmp: array of T;
  procedure MergeSort(Lo, Hi: Int32);
  var Mid, A, B, K: Int32;
  begin
    if Hi - Lo < 2 then Exit;
    Mid := (Lo + Hi) div 2;
    MergeSort(Lo, Mid);
    MergeSort(Mid, Hi);
    A := Lo; B := Mid; K := Lo;
    while (A < Mid) and (B < Hi) do
    begin
      if Fn(S[0].Items[O + B], S[0].Items[O + A]) < 0 then
      begin Tmp[K] := S[0].Items[O + B]; Inc(B); end
      else
      begin Tmp[K] := S[0].Items[O + A]; Inc(A); end;
      Inc(K);
    end;
    while A < Mid do begin Tmp[K] := S[0].Items[O + A]; Inc(A); Inc(K); end;
    while B < Hi do begin Tmp[K] := S[0].Items[O + B]; Inc(B); Inc(K); end;
    for K := Lo to Hi - 1 do S[0].Items[O + K] := Tmp[K];
  end;
begin
  N := GetLength;
  System.SetLength(Tmp, N);
  MergeSort(0, N);
  Result := Self;
end;

procedure TJsArray<T>.Clear;
var J: Int32;
begin
  for J := 0 to GetLength - 1 do S[0].Items[O + J] := Default(T);
end;

function TJsArray<T>.ToArray: TArray<T>;
var J: Int32;
begin
  System.SetLength(Result, GetLength);
  for J := 0 to GetLength - 1 do Result[J] := S[0].Items[O + J];
end;

constructor TJsArrayRef<T>.Create(const AArr: TJsArray<T>);
begin
  inherited Create;
  A := AArr;
end;

{ ======================== numbers ======================== }

var
  JsInvariant: TFormatSettings;

function JsToUInt32(D: Double): UInt32;
var T: Double;
begin
  if IsNan(D) or IsInfinite(D) then Exit(0);
  T := Int(D);
  if Abs(T) < 9.2233720368547758E18 then Exit(UInt32(Trunc(T)));
  T := T - 4294967296.0 * Int(T / 4294967296.0);
  if T < 0 then T := T + 4294967296.0;
  Result := UInt32(Trunc(T));
end;

function JsToInt32(D: Double): Int32;
begin
  Result := Int32(JsToUInt32(D));
end;

function JsToInt64(D: Double): Int64;
begin
  if IsNan(D) or IsInfinite(D) then Exit(0);
  if Abs(D) < 9.2233720368547758E18 then Exit(Trunc(D));
  Result := TBigInt.FromDouble(D).ToInt64;
end;

function JsToUInt64(D: Double): UInt64;
begin
  if IsNan(D) or IsInfinite(D) then Exit(0);
  if Abs(D) < 9.2233720368547758E18 then Exit(UInt64(Trunc(D)));
  Result := TBigInt.FromDouble(D).ToUInt64;
end;

function JsFloor(D: Double): Double;
begin
  if IsNan(D) or IsInfinite(D) then Exit(D);
  Result := Int(D);
  if (Result > D) then Result := Result - 1;
end;

function JsCeil(D: Double): Double;
begin
  if IsNan(D) or IsInfinite(D) then Exit(D);
  Result := Int(D);
  if (Result < D) then Result := Result + 1;
end;

function JsTrunc(D: Double): Double;
begin
  if IsNan(D) or IsInfinite(D) then Exit(D);
  Result := Int(D);
end;

function JsRound(D: Double): Double;
begin
  if IsNan(D) or IsInfinite(D) then Exit(D);
  Result := JsFloor(D + 0.5);
end;

function JsFMod(A, B: Double): Double;
begin
  if IsNan(A) or IsNan(B) or IsInfinite(A) or (B = 0) then Exit(NaN);
  if IsInfinite(B) then Exit(A);
  Result := A - B * Int(A / B);
  { guard against rounding of A / B }
  if (A >= 0) and (Result < 0) then Result := Result + Abs(B)
  else if (A < 0) and (Result > 0) then Result := Result - Abs(B);
end;

function JsPow(A, B: Double): Double;
begin
  if IsNan(B) then Exit(NaN);
  if B = 0 then Exit(1);
  Result := Math.Power(A, B);
end;

function JsSign(D: Double): Double;
begin
  if IsNan(D) then Exit(D);
  if D > 0 then Result := 1 else if D < 0 then Result := -1 else Result := 0;
end;

function JsImul(A, B: Int32): Int32;
begin
  Result := Int32(UInt32(A) * UInt32(B));
end;

function JsClz32(X: UInt32): Int32;
begin
  if X = 0 then Exit(32);
  Result := 0;
  while (X and $80000000) = 0 do begin X := X shl 1; Inc(Result); end;
end;

function JsIntDiv(A, B: Int64): Int64;
begin
  if B = 0 then raise EJsRangeError.Create('Division by zero');
  Result := A div B;
end;

function JsIntMod(A, B: Int64): Int64;
begin
  if B = 0 then raise EJsRangeError.Create('Division by zero');
  Result := A mod B;
end;

function JsUIntDiv(A, B: UInt64): UInt64;
begin
  if B = 0 then raise EJsRangeError.Create('Division by zero');
  Result := A div B;
end;

function JsUIntMod(A, B: UInt64): UInt64;
begin
  if B = 0 then raise EJsRangeError.Create('Division by zero');
  Result := A mod B;
end;

function JsNumToStr(D: Double): string;
var P, E, N, K, I, Q: Int32; S, Digits, Mant: string; Neg: Boolean; Back: Double;
begin
  if IsNan(D) then Exit('NaN');
  if IsInfinite(D) then
    if D > 0 then Exit('Infinity') else Exit('-Infinity');
  if D = 0 then Exit('0');
  if (Int(D) = D) and (Abs(D) < 9.2233720368547758E18) then Exit(IntToStr(Trunc(D)));
  Neg := D < 0;
  if Neg then D := -D;
  S := '';
  { the shortest digit count that reads back as D }
  for P := 1 to 17 do
  begin
    S := FloatToStrF(D, ffExponent, P, 0, JsInvariant);
    if TryStrToFloat(S, Back, JsInvariant) and (Back = D) then Break;
  end;
  { S = d.ddddE+xxx; Free Pascal leaves the exponent out when it is 0 }
  I := Pos('E', S);
  if I = 0 then
  begin
    Mant := S;
    E := 0;
  end
  else
  begin
    Mant := System.Copy(S, 1, I - 1);
    E := StrToInt(System.Copy(S, I + 1, 10));
  end;
  Digits := StringReplace(Mant, '.', '', [rfReplaceAll]);
  while (System.Length(Digits) > 1) and (Digits[System.Length(Digits)] = '0') do
    System.Delete(Digits, System.Length(Digits), 1);
  K := System.Length(Digits);
  N := E + 1;
  if (K <= N) and (N <= 21) then
  begin
    Result := Digits;
    for Q := 1 to N - K do Result := Result + '0';
  end
  else if (0 < N) and (N <= 21) then
    Result := System.Copy(Digits, 1, N) + '.' + System.Copy(Digits, N + 1, K)
  else if (-6 < N) and (N <= 0) then
  begin
    Result := '0.';
    for Q := 1 to -N do Result := Result + '0';
    Result := Result + Digits;
  end
  else
  begin
    Result := Digits[1];
    if K > 1 then Result := Result + '.' + System.Copy(Digits, 2, K);
    if N - 1 >= 0 then Result := Result + 'e+' + IntToStr(N - 1)
    else Result := Result + 'e' + IntToStr(N - 1);
  end;
  if Neg then Result := '-' + Result;
end;

function JsUIntToStrRadix(V: UInt64; Radix: Int32): string;
const Digits = '0123456789abcdefghijklmnopqrstuvwxyz';
begin
  if (Radix < 2) or (Radix > 36) then raise EJsRangeError.Create('toString() radix must be between 2 and 36');
  if V = 0 then Exit('0');
  Result := '';
  while V > 0 do
  begin
    Result := Digits[(V mod UInt64(Radix)) + 1] + Result;
    V := V div UInt64(Radix);
  end;
end;

function JsIntToStrRadix(V: Int64; Radix: Int32): string;
begin
  if V < 0 then Result := '-' + JsUIntToStrRadix(UInt64(-(V + 1)) + 1, Radix)
  else Result := JsUIntToStrRadix(UInt64(V), Radix);
end;

function JsNumToStrRadix(D: Double; Radix: Int32): string;
begin
  if Radix = 10 then Exit(JsNumToStr(D));
  if IsNan(D) then Exit('NaN');
  if Int(D) = D then
  begin
    if Abs(D) < 9.2233720368547758E18 then Exit(JsIntToStrRadix(Trunc(D), Radix));
    Exit(TBigInt.FromDouble(D).ToString(Radix));
  end;
  { fractional values in another radix are rare: integer part only }
  Result := JsIntToStrRadix(Trunc(D), Radix);
end;

function JsBoolToStr(B: Boolean): string;
begin
  if B then Result := 'true' else Result := 'false';
end;

function JsBigToStr(const B: TBigInt): string;
begin
  Result := B.ToString(10);
end;

function JsParseInt(const S: string; Radix: Int32): Double;
var T: string; I, D: Int32; Neg, Any: Boolean; Ch: Char;
begin
  T := TrimLeft(S);
  Neg := False;
  I := 1;
  if (I <= System.Length(T)) and ((T[I] = '-') or (T[I] = '+')) then begin Neg := T[I] = '-'; Inc(I); end;
  if Radix = 0 then Radix := 10;
  if ((Radix = 16) or (Radix = 10)) and (I + 1 <= System.Length(T)) and (T[I] = '0') and ((T[I + 1] = 'x') or (T[I + 1] = 'X')) then
  begin
    Radix := 16;
    I := I + 2;
  end;
  Result := 0;
  Any := False;
  while I <= System.Length(T) do
  begin
    Ch := T[I];
    case Ch of
      '0'..'9': D := Ord(Ch) - 48;
      'a'..'z': D := Ord(Ch) - 87;
      'A'..'Z': D := Ord(Ch) - 55;
    else
      D := 99;
    end;
    if D >= Radix then Break;
    Result := Result * Radix + D;
    Any := True;
    Inc(I);
  end;
  if not Any then Exit(NaN);
  if Neg then Result := -Result;
end;

function JsParseFloat(const S: string): Double;
var T: string; I: Int32;
begin
  T := Trim(S);
  I := 1;
  while (I <= System.Length(T)) and CharInSet(T[I], ['0'..'9', '.', '-', '+', 'e', 'E']) do Inc(I);
  T := System.Copy(T, 1, I - 1);
  if not TryStrToFloat(T, Result, JsInvariant) then
  begin
    while (System.Length(T) > 0) and not TryStrToFloat(T, Result, JsInvariant) do System.Delete(T, System.Length(T), 1);
    if System.Length(T) = 0 then Result := NaN;
  end;
end;

function JsStrToNum(const S: string): Double;
var T: string;
begin
  T := Trim(S);
  if T = '' then Exit(0);
  if (System.Length(T) > 2) and (T[1] = '0') and CharInSet(T[2], ['x', 'X', 'b', 'B', 'o', 'O']) then
    Exit(TBigInt.Parse(T).ToDouble);
  if not TryStrToFloat(T, Result, JsInvariant) then Result := NaN;
end;

function JsIsInteger(D: Double): Boolean;
begin
  Result := not IsNan(D) and not IsInfinite(D) and (Int(D) = D);
end;

function JsNaN: Double;
begin
  Result := NaN;
end;

function JsInfinity: Double;
begin
  Result := Infinity;
end;

function JsMinD(A, B: Double): Double;
begin
  if IsNan(A) or IsNan(B) then Exit(NaN);
  if A < B then Result := A else Result := B;
end;

function JsMaxD(A, B: Double): Double;
begin
  if IsNan(A) or IsNan(B) then Exit(NaN);
  if A > B then Result := A else Result := B;
end;

function JsMinI(A, B: Int64): Int64;
begin
  if A < B then Result := A else Result := B;
end;

function JsMaxI(A, B: Int64): Int64;
begin
  if A > B then Result := A else Result := B;
end;

function JsMinU(A, B: UInt64): UInt64;
begin
  if A < B then Result := A else Result := B;
end;

function JsMaxU(A, B: UInt64): UInt64;
begin
  if A > B then Result := A else Result := B;
end;

function JsRandom: Double;
begin
  Result := System.Random;
end;

function JsTypeOf(const V: TJsValue): string;
begin
  case V.Kind of
    jvUndefined: Result := 'undefined';
    jvBool: Result := 'boolean';
    jvInt, jvUInt, jvNum: Result := 'number';
    jvStr: Result := 'string';
    jvBig: Result := 'bigint';
  else
    Result := 'object';
  end;
end;

function JsDbl(D: Double): Double; inline;
begin
  Result := D;
end;

function JsNumTruthy(D: Double): Boolean;
begin
  Result := (D <> 0) and not IsNan(D);
end;

function JsShl64(V: UInt64; N: Int32): UInt64;
begin
  if (N < 0) or (N >= 64) then Exit(0);
  Result := V shl N;
end;

function JsShr64(V: UInt64; N: Int32): UInt64;
begin
  if (N < 0) or (N >= 64) then Exit(0);
  Result := V shr N;
end;

function JsSar64(V: Int64; N: Int32): Int64;
begin
  if N < 0 then Exit(V);
  if N >= 64 then N := 63;
  Result := SarInt64(V, N);
end;

function JsBigAbs(const B: TBigInt): TBigInt;
begin
  Result := B;
  Result.Neg := False;
end;

{ ======================== strings ======================== }

function JsCharCodeAt(const S: string; I: Int32): Int32;
begin
  if (I < 0) or (I >= System.Length(S)) then Exit(0);
  Result := Ord(S[I + 1]);
end;

function JsCodePointAt(const S: string; I: Int32): Int32;
var Hi, Lo: Int32;
begin
  if (I < 0) or (I >= System.Length(S)) then Exit(0);
  Hi := Ord(S[I + 1]);
  if (Hi >= $D800) and (Hi <= $DBFF) and (I + 1 < System.Length(S)) then
  begin
    Lo := Ord(S[I + 2]);
    if (Lo >= $DC00) and (Lo <= $DFFF) then Exit((Hi - $D800) * $400 + (Lo - $DC00) + $10000);
  end;
  Result := Hi;
end;

function JsCharAt(const S: string; I: Int32): string;
begin
  if (I < 0) or (I >= System.Length(S)) then Exit('');
  Result := S[I + 1];
end;

function JsFromCharCode(C: Int32): string;
begin
  Result := WideChar(C and $FFFF);
end;

function JsFromCharCodesI32(const A: TA_I32): string;
var I: Int32;
begin
  System.SetLength(Result, A.length);
  for I := 0 to A.length - 1 do Result[I + 1] := WideChar(A[I] and $FFFF);
end;

function JsFromCharCodesU8(const A: TA_U8): string;
var I: Int32;
begin
  System.SetLength(Result, A.length);
  for I := 0 to A.length - 1 do Result[I + 1] := WideChar(A[I]);
end;

function JsFromCharCodesU16(const A: TA_U16): string;
var I: Int32;
begin
  System.SetLength(Result, A.length);
  for I := 0 to A.length - 1 do Result[I + 1] := WideChar(A[I]);
end;

function JsFromCharCodesU32(const A: TA_U32): string;
var I: Int32;
begin
  System.SetLength(Result, A.length);
  for I := 0 to A.length - 1 do Result[I + 1] := WideChar(A[I] and $FFFF);
end;

function JsSubstring(const S: string; A: Int32): string;
begin
  Result := JsSubstring(S, A, System.Length(S));
end;

function JsSubstring(const S: string; A, B: Int32): string;
var N, T: Int32;
begin
  N := System.Length(S);
  if A < 0 then A := 0; if A > N then A := N;
  if B < 0 then B := 0; if B > N then B := N;
  if A > B then begin T := A; A := B; B := T; end;
  Result := System.Copy(S, A + 1, B - A);
end;

function JsSubstr(const S: string; A: Int32): string;
begin
  Result := JsSubstr(S, A, System.Length(S));
end;

function JsSubstr(const S: string; A, Len: Int32): string;
var N: Int32;
begin
  N := System.Length(S);
  if A < 0 then begin A := A + N; if A < 0 then A := 0; end;
  if A > N then A := N;
  if Len < 0 then Len := 0;
  if A + Len > N then Len := N - A;
  Result := System.Copy(S, A + 1, Len);
end;

function JsStrSlice(const S: string; A: Int32): string;
begin
  Result := JsStrSlice(S, A, System.Length(S));
end;

function JsStrSlice(const S: string; A, B: Int32): string;
var N: Int32;
begin
  N := System.Length(S);
  A := JsClampIndex(A, N);
  B := JsClampIndex(B, N);
  if B < A then B := A;
  Result := System.Copy(S, A + 1, B - A);
end;

function JsIndexOf(const S, Sub: string; From: Int32): Int32;
var P: SizeInt;
begin
  if From < 0 then From := 0;
  if Sub = '' then
  begin
    if From > System.Length(S) then Exit(System.Length(S));
    Exit(From);
  end;
  if From >= System.Length(S) then Exit(-1);
  P := Pos(Sub, System.Copy(S, From + 1, MaxInt));
  if P = 0 then Result := -1 else Result := P - 1 + From;
end;

function JsLastIndexOf(const S, Sub: string): Int32;
var I: Int32;
begin
  for I := System.Length(S) - System.Length(Sub) downto 0 do
    if System.Copy(S, I + 1, System.Length(Sub)) = Sub then Exit(I);
  Result := -1;
end;

function JsIncludes(const S, Sub: string): Boolean;
begin
  Result := JsIndexOf(S, Sub, 0) >= 0;
end;

function JsStartsWith(const S, Sub: string): Boolean;
begin
  Result := System.Copy(S, 1, System.Length(Sub)) = Sub;
end;

function JsEndsWith(const S, Sub: string): Boolean;
begin
  Result := (System.Length(Sub) <= System.Length(S)) and (System.Copy(S, System.Length(S) - System.Length(Sub) + 1, System.Length(Sub)) = Sub);
end;

function JsSplit(const S, Sep: string): TA_Str;
var I, P: Int32; Rest: string;
begin
  Result := TA_Str.Empty;
  if Sep = '' then
  begin
    for I := 1 to System.Length(S) do Result.Push(S[I]);
    Exit;
  end;
  Rest := S;
  repeat
    P := Pos(Sep, Rest);
    if P = 0 then begin Result.Push(Rest); Break; end;
    Result.Push(System.Copy(Rest, 1, P - 1));
    Rest := System.Copy(Rest, P + System.Length(Sep), MaxInt);
  until False;
end;

function JsJoin(const A: TA_Str; const Sep: string): string;
var I: Int32;
begin
  Result := '';
  for I := 0 to A.length - 1 do
  begin
    if I > 0 then Result := Result + Sep;
    Result := Result + A[I];
  end;
end;

function JsJoin(const A: TA_U8; const Sep: string): string;
var I: Int32;
begin
  Result := '';
  for I := 0 to A.length - 1 do
  begin
    if I > 0 then Result := Result + Sep;
    Result := Result + IntToStr(A[I]);
  end;
end;

function JsJoin(const A: TA_I32; const Sep: string): string;
var I: Int32;
begin
  Result := '';
  for I := 0 to A.length - 1 do
  begin
    if I > 0 then Result := Result + Sep;
    Result := Result + IntToStr(A[I]);
  end;
end;

function JsJoin(const A: TA_U32; const Sep: string): string;
var I: Int32;
begin
  Result := '';
  for I := 0 to A.length - 1 do
  begin
    if I > 0 then Result := Result + Sep;
    Result := Result + IntToStr(A[I]);
  end;
end;

function JsJoin(const A: TA_U16; const Sep: string): string;
var I: Int32;
begin
  Result := '';
  for I := 0 to A.length - 1 do
  begin
    if I > 0 then Result := Result + Sep;
    Result := Result + IntToStr(A[I]);
  end;
end;

function JsJoin(const A: TA_F64; const Sep: string): string;
var I: Int32;
begin
  Result := '';
  for I := 0 to A.length - 1 do
  begin
    if I > 0 then Result := Result + Sep;
    Result := Result + JsNumToStr(A[I]);
  end;
end;

function JsJoin(const A: TA_Big; const Sep: string): string;
var I: Int32;
begin
  Result := '';
  for I := 0 to A.length - 1 do
  begin
    if I > 0 then Result := Result + Sep;
    Result := Result + A[I].ToString(10);
  end;
end;

function JsToUpper(const S: string): string;
begin
  Result := UpperCase(S);
end;

function JsToLower(const S: string): string;
begin
  Result := LowerCase(S);
end;

function JsTrim(const S: string): string;
begin
  Result := Trim(S);
end;

function JsTrimStart(const S: string): string;
begin
  Result := TrimLeft(S);
end;

function JsTrimEnd(const S: string): string;
begin
  Result := TrimRight(S);
end;

function JsPadStart(const S: string; N: Int32; const Pad: string): string;
var Fill: string;
begin
  if (System.Length(S) >= N) or (Pad = '') then Exit(S);
  Fill := '';
  while System.Length(Fill) < N - System.Length(S) do Fill := Fill + Pad;
  Result := System.Copy(Fill, 1, N - System.Length(S)) + S;
end;

function JsPadEnd(const S: string; N: Int32; const Pad: string): string;
var Fill: string;
begin
  if (System.Length(S) >= N) or (Pad = '') then Exit(S);
  Fill := '';
  while System.Length(Fill) < N - System.Length(S) do Fill := Fill + Pad;
  Result := S + System.Copy(Fill, 1, N - System.Length(S));
end;

function JsRepeat(const S: string; N: Int32): string;
var I: Int32;
begin
  if N < 0 then raise EJsRangeError.Create('Invalid count value');
  Result := '';
  for I := 1 to N do Result := Result + S;
end;

function JsReplaceAll(const S, A, B: string): string;
begin
  if A = '' then Exit(S);
  Result := StringReplace(S, A, B, [rfReplaceAll]);
end;

function JsReplaceFirst(const S, A, B: string): string;
begin
  Result := StringReplace(S, A, B, []);
end;

{ ======================== regular expressions ======================== }

function JsRegexNew(const Pattern, Flags: string): TRegExpr;
begin
  Result := TRegExpr.Create(Pattern);
  Result.ModifierI := Pos('i', Flags) > 0;
  Result.ModifierM := Pos('m', Flags) > 0;
end;

function JsRegexReplace(const S, Pattern, Flags, Repl: string): string;
var R: TRegExpr;
begin
  R := JsRegexNew(Pattern, Flags);
  try
    if Pos('g', Flags) > 0 then
      Result := R.Replace(S, Repl, True)
    else if R.Exec(S) then
      Result := System.Copy(S, 1, R.MatchPos[0] - 1) + R.Substitute(Repl) + System.Copy(S, R.MatchPos[0] + R.MatchLen[0], MaxInt)
    else
      Result := S;
  finally
    R.Free;
  end;
end;

function JsRegexTest(const Pattern, Flags, S: string): Boolean;
var R: TRegExpr; I: Int32;
begin
  // TRegExpr has no Unicode property classes: /\p{L}/u is any letter
  if (Pattern = '\p{L}') and (Pos('u', Flags) > 0) then
  begin
    for I := 1 to System.Length(S) do
      if TCharacter.IsLetter(S[I]) then Exit(True);
    Exit(False);
  end;
  R := JsRegexNew(Pattern, Flags);
  try
    Result := R.Exec(S);
  finally
    R.Free;
  end;
end;

function JsRegexSplit(const S, Pattern, Flags: string): TA_Str;
var R: TRegExpr; Start: Int32;
begin
  Result := TA_Str.Empty;
  R := JsRegexNew(Pattern, Flags);
  try
    Start := 1;
    if R.Exec(S) then
      repeat
        if R.MatchLen[0] = 0 then Break;
        Result.Push(System.Copy(S, Start, R.MatchPos[0] - Start));
        Start := R.MatchPos[0] + R.MatchLen[0];
      until not R.ExecNext;
    Result.Push(System.Copy(S, Start, MaxInt));
  finally
    R.Free;
  end;
end;

{ ======================== dynamic values ======================== }

function TJsValue.IsNullish: Boolean;
begin
  Result := Kind in [jvUndefined, jvNull];
end;

function TJsValue.Truthy: Boolean;
begin
  case Kind of
    jvUndefined, jvNull: Result := False;
    jvBool: Result := B;
    jvInt: Result := I <> 0;
    jvUInt: Result := U <> 0;
    jvNum: Result := (N <> 0) and not IsNan(N);
    jvStr: Result := S <> '';
    jvBig: Result := not Big.IsZero;
  else
    Result := True;
  end;
end;

function TJsValue.Describe: string;
begin
  case Kind of
    jvUndefined: Result := 'undefined';
    jvNull: Result := 'null';
    jvBool: Result := JsBoolToStr(B);
    jvInt: Result := IntToStr(I);
    jvUInt: Result := IntToStr(U);
    jvNum: Result := JsNumToStr(N);
    jvStr: Result := S;
    jvBig: Result := Big.ToString(10) + 'n';
    jvArr: Result := '[array ' + IntToStr(System.Length(A)) + ']';
  else
    if Ref <> nil then Result := '[object ' + Ref.ClassName + ']' else Result := '[object]';
  end;
end;

function JsVUndef: TJsValue;
begin
  Result := Default(TJsValue);
  Result.Kind := jvUndefined;
end;

function JsVNull: TJsValue;
begin
  Result := Default(TJsValue);
  Result.Kind := jvNull;
end;

function JsVBool(B: Boolean): TJsValue;
begin
  Result := Default(TJsValue);
  Result.Kind := jvBool;
  Result.B := B;
end;

function JsVInt(I: Int64): TJsValue;
begin
  Result := Default(TJsValue);
  Result.Kind := jvInt;
  Result.I := I;
end;

function JsVUInt(U: UInt64): TJsValue;
begin
  Result := Default(TJsValue);
  Result.Kind := jvUInt;
  Result.U := U;
end;

function JsVNum(D: Double): TJsValue;
begin
  Result := Default(TJsValue);
  Result.Kind := jvNum;
  Result.N := D;
end;

function JsVStr(const S: string): TJsValue;
begin
  Result := Default(TJsValue);
  Result.Kind := jvStr;
  Result.S := S;
end;

function JsVBig(const B: TBigInt): TJsValue;
begin
  Result := Default(TJsValue);
  Result.Kind := jvBig;
  Result.Big := B;
end;

function JsVObj(O: TObject): TJsValue;
begin
  Result := Default(TJsValue);
  if O = nil then begin Result.Kind := jvNull; Exit; end;
  Result.Kind := jvObj;
  Result.Ref := O;
end;

function JsVArr(const A: array of TJsValue): TJsValue;
var I: Int32;
begin
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, System.Length(A));
  for I := 0 to System.Length(A) - 1 do Result.A[I] := A[I];
end;

function JsVArr_U8(const A: TA_U8): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVInt(A[I]);
  Result.Ref := TJsArrayRef<Byte>.Create(A);
end;

function JsVArr_I8(const A: TA_I8): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVInt(A[I]);
end;

function JsVArr_U16(const A: TA_U16): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVInt(A[I]);
end;

function JsVArr_I16(const A: TA_I16): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVInt(A[I]);
end;

function JsVArr_U32(const A: TA_U32): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVInt(A[I]);
end;

function JsVArr_I32(const A: TA_I32): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVInt(A[I]);
end;

function JsVArr_U64(const A: TA_U64): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVUInt(A[I]);
end;

function JsVArr_I64(const A: TA_I64): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVInt(A[I]);
end;

function JsVArr_F64(const A: TA_F64): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVNum(A[I]);
end;

function JsVArr_Str(const A: TA_Str): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVStr(A[I]);
end;

function JsVArr_Big(const A: TA_Big): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVBig(A[I]);
end;

function JsVArr_Bool(const A: TA_Bool): TJsValue;
var I: Int32;
begin
  if A.IsNull then Exit(JsVNull);
  Result := Default(TJsValue);
  Result.Kind := jvArr;
  System.SetLength(Result.A, A.length);
  for I := 0 to A.length - 1 do Result.A[I] := JsVBool(A[I]);
end;

function JsValToBool(const V: TJsValue): Boolean;
begin
  Result := V.Truthy;
end;

function JsValToDouble(const V: TJsValue): Double;
begin
  case V.Kind of
    jvBool: Result := Ord(V.B);
    jvInt: Result := V.I;
    jvUInt: Result := V.U;
    jvNum: Result := V.N;
    jvStr: Result := JsStrToNum(V.S);
    jvBig: Result := V.Big.ToDouble;
    jvNull: Result := 0;
  else
    Result := NaN;
  end;
end;

function JsValToInt64(const V: TJsValue): Int64;
begin
  case V.Kind of
    jvBool: Result := Ord(V.B);
    jvInt: Result := V.I;
    jvUInt: Result := Int64(V.U);
    jvBig: Result := V.Big.ToInt64;
    jvUndefined, jvNull: Result := 0;
  else
    Result := JsToInt64(JsValToDouble(V));
  end;
end;

function JsValToUInt64(const V: TJsValue): UInt64;
begin
  case V.Kind of
    jvBool: Result := Ord(V.B);
    jvInt: Result := UInt64(V.I);
    jvUInt: Result := V.U;
    jvBig: Result := V.Big.ToUInt64;
    jvUndefined, jvNull: Result := 0;
  else
    Result := JsToUInt64(JsValToDouble(V));
  end;
end;

function JsValToStr(const V: TJsValue): string;
var I: Int32;
begin
  case V.Kind of
    jvUndefined: Result := '';
    jvNull: Result := '';
    jvArr:
      begin
        Result := '';
        for I := 0 to System.Length(V.A) - 1 do
        begin
          if I > 0 then Result := Result + ',';
          Result := Result + JsValToStr(V.A[I]);
        end;
      end;
    jvBig: Result := V.Big.ToString(10);
  else
    Result := V.Describe;
  end;
end;

function JsValToBig(const V: TJsValue): TBigInt;
begin
  case V.Kind of
    jvBig: Result := V.Big;
    jvInt: Result := TBigInt.FromInt64(V.I);
    jvUInt: Result := TBigInt.FromUInt64(V.U);
    jvBool: Result := TBigInt.FromInt64(Ord(V.B));
    jvStr: Result := TBigInt.Parse(V.S);
    jvNum: Result := TBigInt.FromDouble(V.N);
  else
    raise EJsTypeError.Create('Cannot convert ' + V.Describe + ' to a BigInt');
  end;
end;

function JsValToObj(const V: TJsValue): TObject;
begin
  if V.Kind = jvObj then Result := V.Ref
  else if V.IsNullish then Result := nil
  else raise EJsTypeError.Create('Cannot convert ' + V.Describe + ' to an object');
end;

function JsValLength(const V: TJsValue): Int32;
begin
  if V.Kind = jvArr then Result := System.Length(V.A)
  else if V.Kind = jvStr then Result := System.Length(V.S)
  else if V.IsNullish then Result := 0
  else raise EJsTypeError.Create(V.Describe + ' is not an array');
end;

function JsValElem(const V: TJsValue; I: Int32): TJsValue;
begin
  if (V.Kind = jvArr) and (I >= 0) and (I < System.Length(V.A)) then Result := V.A[I]
  else if (V.Kind = jvStr) and (I >= 0) and (I < System.Length(V.S)) then Result := JsVInt(Ord(V.S[I + 1]))
  else Result := JsVUndef;
end;

function JsValTo_TA_U8(const V: TJsValue): TA_U8;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_U8.Null);
  if (V.Ref <> nil) and (V.Ref is TJsArrayRef<Byte>) then Exit(TJsArrayRef<Byte>(V.Ref).A);
  Result := TA_U8.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := Byte(JsValToInt64(JsValElem(V, I)));
end;

function JsValTo_TA_I8(const V: TJsValue): TA_I8;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_I8.Null);
  Result := TA_I8.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := ShortInt(JsValToInt64(JsValElem(V, I)));
end;

function JsValTo_TA_U16(const V: TJsValue): TA_U16;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_U16.Null);
  Result := TA_U16.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := Word(JsValToInt64(JsValElem(V, I)));
end;

function JsValTo_TA_I16(const V: TJsValue): TA_I16;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_I16.Null);
  Result := TA_I16.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := SmallInt(JsValToInt64(JsValElem(V, I)));
end;

function JsValTo_TA_U32(const V: TJsValue): TA_U32;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_U32.Null);
  Result := TA_U32.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := UInt32(JsValToInt64(JsValElem(V, I)));
end;

function JsValTo_TA_I32(const V: TJsValue): TA_I32;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_I32.Null);
  Result := TA_I32.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := Int32(JsValToInt64(JsValElem(V, I)));
end;

function JsValTo_TA_U64(const V: TJsValue): TA_U64;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_U64.Null);
  Result := TA_U64.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := JsValToUInt64(JsValElem(V, I));
end;

function JsValTo_TA_I64(const V: TJsValue): TA_I64;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_I64.Null);
  Result := TA_I64.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := JsValToInt64(JsValElem(V, I));
end;

function JsValTo_TA_F64(const V: TJsValue): TA_F64;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_F64.Null);
  Result := TA_F64.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := JsValToDouble(JsValElem(V, I));
end;

function JsValTo_TA_Str(const V: TJsValue): TA_Str;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_Str.Null);
  Result := TA_Str.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := JsValToStr(JsValElem(V, I));
end;

function JsValTo_TA_Big(const V: TJsValue): TA_Big;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_Big.Null);
  Result := TA_Big.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := JsValToBig(JsValElem(V, I));
end;

function JsValTo_TA_Bool(const V: TJsValue): TA_Bool;
var I: Int32;
begin
  if V.IsNullish then Exit(TA_Bool.Null);
  Result := TA_Bool.New(JsValLength(V));
  for I := 0 to Result.length - 1 do Result[I] := JsValToBool(JsValElem(V, I));
end;

function JsF(const AName: string; const AValue: TJsValue): TJsField;
begin
  Result.Name := AName;
  Result.Value := AValue;
end;

function JsTestCase(const AFields: array of TJsField): TTestCase;
var I: Int32;
begin
  Result := TTestCase.Create;
  for I := 0 to System.Length(AFields) - 1 do
    Result.SetField(AFields[I].Name, AFields[I].Value);
end;

constructor TJsBitStream.Create(const initialBytes: TA_U8);
begin
  inherited Create;
  buffer := 0;
  bufferBits := 0;
  byteArray := TA_U8.Empty;
  readPosition := 0;
  totalBitsWritten := 0;
  if not initialBytes.IsNull and (initialBytes.length > 0) then
  begin
    byteArray := initialBytes.Copy;
    totalBitsWritten := initialBytes.length * 8;
  end;
end;

procedure TJsBitStream.writeBits(value, numBits: UInt32);
var Mask: UInt32;
begin
  if (Int32(numBits) <= 0) or (numBits > 32) then raise EJsError.Create('BitStream.writeBits: numBits must be 1-32');
  if numBits = 32 then Mask := $FFFFFFFF else Mask := UInt32(Int32(UInt32(1) shl numBits) - 1);
  value := value and Mask;
  { JavaScript shifts by numBits mod 32 }
  buffer := Int32((UInt32(buffer) shl (numBits and 31)) or value);
  bufferBits := bufferBits + Int32(numBits);
  totalBitsWritten := totalBitsWritten + Int32(numBits);
  while bufferBits >= 8 do
  begin
    bufferBits := bufferBits - 8;
    byteArray.Push(Byte(UInt32(buffer) shr (bufferBits and 31)));
    if bufferBits > 0 then
      buffer := buffer and Int32((UInt32(1) shl (bufferBits and 31)) - 1)
    else
      buffer := 0;
  end;
end;

procedure TJsBitStream.writeBit(bit: UInt32);
begin
  writeBits(bit and 1, 1);
end;

procedure TJsBitStream.writeByte(b: UInt32);
begin
  writeBits(b and $FF, 8);
end;

procedure TJsBitStream.writeBytes(const bytes: TA_U8);
var I: Int32;
begin
  for I := 0 to bytes.length - 1 do writeByte(bytes[I]);
end;

procedure TJsBitStream.writeUint16BE(value: UInt32);
begin
  writeBits((value shr 8) and $FF, 8);
  writeBits(value and $FF, 8);
end;

procedure TJsBitStream.writeUint16LE(value: UInt32);
begin
  writeBits(value and $FF, 8);
  writeBits((value shr 8) and $FF, 8);
end;

procedure TJsBitStream.writeUint32BE(value: UInt32);
begin
  writeBits((value shr 24) and $FF, 8);
  writeBits((value shr 16) and $FF, 8);
  writeBits((value shr 8) and $FF, 8);
  writeBits(value and $FF, 8);
end;

procedure TJsBitStream.writeUint32LE(value: UInt32);
begin
  writeBits(value and $FF, 8);
  writeBits((value shr 8) and $FF, 8);
  writeBits((value shr 16) and $FF, 8);
  writeBits((value shr 24) and $FF, 8);
end;

function TJsBitStream.readBits(numBits: Int32): UInt32;
var R: Int32; BitsRead, ByteIndex, BitOffset, Available, Take: Int32; Cur, Mask, Extracted: UInt32;
begin
  if (numBits <= 0) or (numBits > 32) then raise EJsError.Create('BitStream.readBits: numBits must be 1-32');
  R := 0;
  BitsRead := 0;
  while BitsRead < numBits do
  begin
    ByteIndex := readPosition div 8;
    BitOffset := readPosition mod 8;
    if ByteIndex >= byteArray.length then
    begin
      if BitsRead = 0 then raise EJsError.Create('BitStream.readBits: No more data available');
      Break;
    end;
    Cur := byteArray[ByteIndex];
    Available := 8 - BitOffset;
    Take := numBits - BitsRead;
    if Available < Take then Take := Available;
    Mask := (UInt32(1) shl Take) - 1;
    Extracted := (Cur shr (Available - Take)) and Mask;
    R := Int32((UInt32(R) shl (Take and 31)) or Extracted);
    BitsRead := BitsRead + Take;
    readPosition := readPosition + Take;
  end;
  Result := UInt32(R);
end;

function TJsBitStream.readBit: UInt32;
begin
  Result := readBits(1);
end;

function TJsBitStream.readByte: Byte;
begin
  Result := Byte(readBits(8));
end;

function TJsBitStream.readBytes(count: Int32): TA_U8;
var I: Int32;
begin
  Result := TA_U8.Empty;
  for I := 0 to count - 1 do Result.Push(readByte);
end;

function TJsBitStream.peekBits(numBits: Int32): UInt32;
var Saved: Int32;
begin
  Saved := readPosition;
  Result := readBits(numBits);
  readPosition := Saved;
end;

procedure TJsBitStream.skipBits(numBits: Int32);
begin
  readPosition := readPosition + numBits;
  if readPosition > byteArray.length * 8 then readPosition := byteArray.length * 8;
end;

function TJsBitStream.hasMoreBits: Boolean;
begin
  Result := readPosition < byteArray.length * 8;
end;

function TJsBitStream.getRemainingBits: Int32;
begin
  Result := byteArray.length * 8 - readPosition;
  if Result < 0 then Result := 0;
end;

procedure TJsBitStream.resetReadPosition;
begin
  readPosition := 0;
end;

procedure TJsBitStream.seekBits(bitOffset: UInt32);
var MaxBits, Offset: Int32;
begin
  MaxBits := byteArray.length * 8;
  Offset := Int32(bitOffset and $7FFFFFFF);
  if Offset > MaxBits then Offset := MaxBits;
  if Offset > 0 then readPosition := Offset else readPosition := 0;
end;

function TJsBitStream.toArray(padLastByte: Boolean): TA_U8;
begin
  if (bufferBits > 0) and padLastByte then
  begin
    buffer := Int32(UInt32(buffer) shl ((8 - bufferBits) and 31));
    byteArray.Push(Byte(buffer));
    buffer := 0;
    bufferBits := 0;
  end;
  Result := byteArray.Copy;
end;

function TJsBitStream.getBitLength: Int32;
begin
  Result := totalBitsWritten;
end;

function TJsBitStream.getByteLength: Int32;
begin
  Result := byteArray.length + bufferBits div 8 + Ord((bufferBits mod 8) > 0);
end;

procedure TJsBitStream.clear;
begin
  buffer := 0;
  bufferBits := 0;
  byteArray := TA_U8.Empty;
  readPosition := 0;
  totalBitsWritten := 0;
end;

function TJsBitStream.clone: TJsBitStream;
begin
  Result := TJsBitStream.Create(TA_U8.Null);
  Result.buffer := buffer;
  Result.bufferBits := bufferBits;
  Result.byteArray := byteArray.Copy;
  Result.readPosition := readPosition;
  Result.totalBitsWritten := totalBitsWritten;
end;

procedure TJsBitStream.writeVarInt(value: UInt32);
begin
  while value >= $80 do
  begin
    writeByte((value and $7F) or $80);
    value := value shr 7;
  end;
  writeByte(value and $7F);
end;

function TJsBitStream.readVarInt: UInt32;
var R: Int32; Shift: Int32; B: Byte;
begin
  R := 0;
  Shift := 0;
  repeat
    if Shift >= 32 then raise EJsError.Create('BitStream.readVarInt: Integer overflow');
    B := readByte;
    R := R or Int32((UInt32(B) and $7F) shl (Shift and 31));
    Shift := Shift + 7;
  until (B and $80) = 0;
  Result := UInt32(R);
end;

procedure TJsBitStream.writeUnary(value: Int32);
var I: Int32;
begin
  for I := 0 to value - 1 do writeBit(1);
  writeBit(0);
end;

function TJsBitStream.readUnary: Int32;
begin
  Result := 0;
  while hasMoreBits and (readBit = 1) do Inc(Result);
end;

procedure TJsBitStream.alignToByte;
begin
  while bufferBits mod 8 <> 0 do writeBit(0);
end;

function TJsBitStream.isAligned: Boolean;
begin
  Result := bufferBits mod 8 = 0;
end;

function JsSameValue(const A, B: TJsValue): Boolean;
begin
  if (A.Kind in [jvInt, jvUInt, jvNum]) and (B.Kind in [jvInt, jvUInt, jvNum]) then
  begin
    if (A.Kind = jvInt) and (B.Kind = jvInt) then Exit(A.I = B.I);
    if (A.Kind = jvUInt) and (B.Kind = jvUInt) then Exit(A.U = B.U);
    Exit(JsValToDouble(A) = JsValToDouble(B));
  end;
  if A.Kind <> B.Kind then Exit(False);
  case A.Kind of
    jvUndefined, jvNull: Result := True;
    jvBool: Result := A.B = B.B;
    jvStr: Result := A.S = B.S;
    jvBig: Result := A.Big = B.Big;
    jvObj: Result := A.Ref = B.Ref;
  else
    Result := (A.Ref <> nil) and (A.Ref = B.Ref);
  end;
end;

function JsNowMs: Double;
begin
  Result := GetTickCount64;
end;

function TJsMap.IndexOfKey(const K: TJsValue): Int32;
var I: Int32;
begin
  for I := 0 to Count - 1 do
    if JsSameValue(Keys[I], K) then Exit(I);
  Result := -1;
end;

function TJsMap.Get(const K: TJsValue): TJsValue;
var I: Int32;
begin
  I := IndexOfKey(K);
  if I < 0 then Result := JsVUndef else Result := Vals[I];
end;

function TJsMap.Put(const K, V: TJsValue): TJsMap;
var I: Int32;
begin
  I := IndexOfKey(K);
  if I < 0 then
  begin
    if Count >= System.Length(Keys) then
    begin
      System.SetLength(Keys, Count * 2 + 4);
      System.SetLength(Vals, Count * 2 + 4);
    end;
    Keys[Count] := K;
    Vals[Count] := V;
    Inc(Count);
  end
  else
    Vals[I] := V;
  Result := Self;
end;

function TJsMap.Has(const K: TJsValue): Boolean;
begin
  Result := IndexOfKey(K) >= 0;
end;

function TJsMap.Delete(const K: TJsValue): Boolean;
var I, J: Int32;
begin
  I := IndexOfKey(K);
  if I < 0 then Exit(False);
  for J := I to Count - 2 do
  begin
    Keys[J] := Keys[J + 1];
    Vals[J] := Vals[J + 1];
  end;
  Dec(Count);
  Keys[Count] := JsVUndef;
  Vals[Count] := JsVUndef;
  Result := True;
end;

procedure TJsMap.Clear;
begin
  Count := 0;
  Keys := nil;
  Vals := nil;
end;

function TJsMap.Size: Int32;
begin
  Result := Count;
end;

function TJsDynObject.HasField(const AName: string): Boolean;
var I: Int32;
begin
  for I := 0 to System.Length(Fields) - 1 do
    if Fields[I].Name = AName then Exit(True);
  Result := False;
end;

function TJsDynObject.GetField(const AName: string): TJsValue;
var I: Int32;
begin
  for I := 0 to System.Length(Fields) - 1 do
    if Fields[I].Name = AName then Exit(Fields[I].Value);
  Result := JsVUndef;
end;

procedure TJsDynObject.SetField(const AName: string; const AValue: TJsValue);
var I: Int32;
begin
  for I := 0 to System.Length(Fields) - 1 do
    if Fields[I].Name = AName then begin Fields[I].Value := AValue; Exit; end;
  I := System.Length(Fields);
  System.SetLength(Fields, I + 1);
  Fields[I].Name := AName;
  Fields[I].Value := AValue;
end;

function TJsDynObject.JsSetMember(const AName: string; const AValue: TJsValue): Boolean;
begin
  SetField(AName, AValue);
  Result := True;
end;

function TJsDynObject.JsHasMember(const AName: string): Boolean;
begin
  Result := HasField(AName);
end;

function JsDynObject(const AFields: array of TJsField): TJsValue;
var O: TJsDynObject; I: Int32;
begin
  O := TJsDynObject.Create;
  for I := 0 to System.Length(AFields) - 1 do O.SetField(AFields[I].Name, AFields[I].Value);
  Result := JsVObj(O);
end;

function JsValGet(const V: TJsValue; const AName: string): TJsValue;
begin
  if (V.Kind = jvObj) and (V.Ref is TJsDynObject) then Exit(TJsDynObject(V.Ref).GetField(AName));
  if (V.Kind = jvObj) and (V.Ref is TTestCase) then Exit(TTestCase(V.Ref).GetField(AName));
  if AName = 'length' then
    if V.Kind = jvArr then Exit(JsVInt(System.Length(V.A)))
    else if V.Kind = jvStr then Exit(JsVInt(System.Length(V.S)));
  if V.IsNullish then raise EJsTypeError.Create('Cannot read properties of ' + V.Describe + ' (reading ''' + AName + ''')');
  Result := JsVUndef;
end;

procedure JsValSet(const V: TJsValue; const AName: string; const AValue: TJsValue);
begin
  if (V.Kind = jvObj) and (V.Ref is TJsDynObject) then begin TJsDynObject(V.Ref).SetField(AName, AValue); Exit; end;
  if (V.Kind = jvObj) and (V.Ref is TTestCase) then begin TTestCase(V.Ref).SetField(AName, AValue); Exit; end;
  if (V.Kind = jvObj) and (V.Ref is TJsObject) and TJsObject(V.Ref).JsSetMember(AName, AValue) then Exit;
  raise EJsTypeError.Create('Cannot set property ' + AName + ' of ' + V.Describe);
end;

function JsValToTestCase(const V: TJsValue): TTestCase;
var D: TJsDynObject; I: Int32;
begin
  if V.IsNullish then Exit(nil);
  if (V.Kind = jvObj) and (V.Ref is TTestCase) then Exit(TTestCase(V.Ref));
  if (V.Kind = jvObj) and (V.Ref is TJsDynObject) then
  begin
    D := TJsDynObject(V.Ref);
    Result := TTestCase.Create;
    for I := 0 to System.Length(D.Fields) - 1 do Result.SetField(D.Fields[I].Name, D.Fields[I].Value);
    Exit;
  end;
  raise EJsTypeError.Create('Cannot use ' + V.Describe + ' as a test vector');
end;

function JsDescribeException(E: TObject): string;
var N: string;
begin
  if E is Exception then
  begin
    N := E.ClassName;
    if (N = 'EJsError') then N := 'Error'
    else if N = 'EJsTypeError' then N := 'TypeError'
    else if N = 'EJsRangeError' then N := 'RangeError';
    Result := N + ': ' + Exception(E).Message;
  end
  else if E <> nil then Result := 'thrown: ' + E.ClassName
  else Result := 'thrown: null';
end;

{ ======================== OpCodes ======================== }

function OpPack16BE(B0, B1: UInt32): UInt16;
begin
  Result := UInt16(((B0 and $FF) shl 8) or (B1 and $FF));
end;

function OpPack16LE(B0, B1: UInt32): UInt16;
begin
  Result := UInt16(((B1 and $FF) shl 8) or (B0 and $FF));
end;

function OpPack32BE(B0, B1, B2, B3: UInt32): UInt32;
begin
  Result := ((B0 and $FF) shl 24) or ((B1 and $FF) shl 16) or ((B2 and $FF) shl 8) or (B3 and $FF);
end;

function OpPack32LE(B0, B1, B2, B3: UInt32): UInt32;
begin
  Result := ((B3 and $FF) shl 24) or ((B2 and $FF) shl 16) or ((B1 and $FF) shl 8) or (B0 and $FF);
end;

function OpPack64BE(B0, B1, B2, B3, B4, B5, B6, B7: UInt32): UInt64;
begin
  Result := (UInt64(OpPack32BE(B0, B1, B2, B3)) shl 32) or OpPack32BE(B4, B5, B6, B7);
end;

function OpPack64LE(B0, B1, B2, B3, B4, B5, B6, B7: UInt32): UInt64;
begin
  Result := OpPack64BE(B7, B6, B5, B4, B3, B2, B1, B0);
end;

function OpPackArr(const A: TA_U8; Bits: Int32; BigEndian: Boolean): UInt64;
var I, N: Int32;
begin
  N := Bits div 8;
  Result := 0;
  if BigEndian then
    for I := 0 to N - 1 do Result := (Result shl 8) or A[I]
  else
    for I := N - 1 downto 0 do Result := (Result shl 8) or A[I];
end;

function OpUnpack16BE(V: UInt32): TA_U8;
begin
  Result := TA_U8.From([Byte(V shr 8), Byte(V)]);
end;

function OpUnpack16LE(V: UInt32): TA_U8;
begin
  Result := TA_U8.From([Byte(V), Byte(V shr 8)]);
end;

function OpUnpack32BE(V: UInt32): TA_U8;
begin
  Result := TA_U8.From([Byte(V shr 24), Byte(V shr 16), Byte(V shr 8), Byte(V)]);
end;

function OpUnpack32LE(V: UInt32): TA_U8;
begin
  Result := TA_U8.From([Byte(V), Byte(V shr 8), Byte(V shr 16), Byte(V shr 24)]);
end;

function OpUnpack64BE(V: UInt64): TA_U8;
begin
  Result := TA_U8.From([Byte(V shr 56), Byte(V shr 48), Byte(V shr 40), Byte(V shr 32),
    Byte(V shr 24), Byte(V shr 16), Byte(V shr 8), Byte(V)]);
end;

function OpUnpack64LE(V: UInt64): TA_U8;
begin
  Result := TA_U8.From([Byte(V), Byte(V shr 8), Byte(V shr 16), Byte(V shr 24),
    Byte(V shr 32), Byte(V shr 40), Byte(V shr 48), Byte(V shr 56)]);
end;

function OpRotL8(V: UInt32; N: Int32): Byte;
begin
  V := V and $FF; N := N and 7;
  Result := Byte((V shl N) or (V shr ((8 - N) and 7)));
end;

function OpRotR8(V: UInt32; N: Int32): Byte;
begin
  V := V and $FF; N := N and 7;
  Result := Byte((V shr N) or (V shl ((8 - N) and 7)));
end;

function OpRotL16(V: UInt32; N: Int32): Word;
begin
  V := V and $FFFF; N := N and 15;
  Result := Word((V shl N) or (V shr ((16 - N) and 15)));
end;

function OpRotR16(V: UInt32; N: Int32): Word;
begin
  V := V and $FFFF; N := N and 15;
  Result := Word((V shr N) or (V shl ((16 - N) and 15)));
end;

function OpRotL32(V: UInt32; N: Int32): UInt32;
begin
  N := N and 31;
  if N = 0 then Exit(V);
  Result := (V shl N) or (V shr (32 - N));
end;

function OpRotR32(V: UInt32; N: Int32): UInt32;
begin
  N := N and 31;
  if N = 0 then Exit(V);
  Result := (V shr N) or (V shl (32 - N));
end;

function OpRotL64(V: UInt64; N: Int32): UInt64;
begin
  N := N and 63;
  if N = 0 then Exit(V);
  Result := (V shl N) or (V shr (64 - N));
end;

function OpRotR64(V: UInt64; N: Int32): UInt64;
begin
  N := N and 63;
  if N = 0 then Exit(V);
  Result := (V shr N) or (V shl (64 - N));
end;

function OpRotL64n(const V: TBigInt; N: Int32): TBigInt;
begin
  Result := TBigInt.FromUInt64(OpRotL64(TBigInt.AsUintN(64, V).ToUInt64, N));
end;

function OpRotR64n(const V: TBigInt; N: Int32): TBigInt;
begin
  Result := TBigInt.FromUInt64(OpRotR64(TBigInt.AsUintN(64, V).ToUInt64, N));
end;

function OpRotL128n(const V: TBigInt; N: Int32): TBigInt;
var X: TBigInt;
begin
  X := TBigInt.AsUintN(128, V);
  N := N and 127;
  if N = 0 then Exit(X);
  Result := TBigInt.AsUintN(128, (X shl N) or (X shr (128 - N)));
end;

function OpRotR128n(const V: TBigInt; N: Int32): TBigInt;
var X: TBigInt;
begin
  X := TBigInt.AsUintN(128, V);
  N := N and 127;
  if N = 0 then Exit(X);
  Result := TBigInt.AsUintN(128, (X shr N) or (X shl (128 - N)));
end;

function OpHexNibble(C: WideChar; const Fn, S: string): Int32;
begin
  case C of
    '0'..'9': Result := Ord(C) - 48;
    'a'..'f': Result := Ord(C) - 87;
    'A'..'F': Result := Ord(C) - 55;
  else
    raise EJsError.Create(Fn + ': Invalid hex characters found');
  end;
end;

function OpHex4ToBytes(const S: string): TA_U8;
var I: Int32;
begin
  Result := TA_U8.New(System.Length(S));
  for I := 1 to System.Length(S) do Result[I - 1] := OpHexNibble(S[I], 'Hex4ToBytes', S);
end;

function OpHex8ToBytes(const S: string): TA_U8;
var I: Int32;
begin
  for I := 1 to System.Length(S) do OpHexNibble(S[I], 'Hex8ToBytes', S);
  { JS: (length & 1 !== 0) is (length & true): odd lengths parse the last single digit }
  if (System.Length(S) and 1) <> 0 then raise EJsError.Create('Hex8ToBytes: Length must be even');
  Result := TA_U8.New(System.Length(S) div 2);
  for I := 0 to System.Length(S) div 2 - 1 do
    Result[I] := (OpHexNibble(S[2 * I + 1], 'Hex8ToBytes', S) shl 4) or OpHexNibble(S[2 * I + 2], 'Hex8ToBytes', S);
end;

function OpHex16ToWords(const S: string): TA_U16;
var I, J, N: Int32; W: UInt32;
begin
  for I := 1 to System.Length(S) do OpHexNibble(S[I], 'Hex16ToWords', S);
  if (System.Length(S) and 1) <> 0 then raise EJsError.Create('Hex16ToWords: Length must be divisible by 4');
  N := (System.Length(S) + 3) div 4;
  Result := TA_U16.New(N);
  for I := 0 to N - 1 do
  begin
    W := 0;
    for J := 4 * I + 1 to 4 * I + 4 do
      if J <= System.Length(S) then W := (W shl 4) or UInt32(OpHexNibble(S[J], 'Hex16ToWords', S));
    Result[I] := W;
  end;
end;

function OpHex32ToDWords(const S: string): TA_U32;
var I, J, N: Int32; W: UInt32;
begin
  for I := 1 to System.Length(S) do OpHexNibble(S[I], 'Hex32ToDWords', S);
  if (System.Length(S) and 1) <> 0 then raise EJsError.Create('Hex32ToDWords: Length must be divisible by 8');
  N := (System.Length(S) + 7) div 8;
  Result := TA_U32.New(N);
  for I := 0 to N - 1 do
  begin
    W := 0;
    for J := 8 * I + 1 to 8 * I + 8 do
      if J <= System.Length(S) then W := (W shl 4) or UInt32(OpHexNibble(S[J], 'Hex32ToDWords', S));
    Result[I] := W;
  end;
end;

function OpAnsiToBytes(const S: string): TA_U8;
var I: Int32;
begin
  Result := TA_U8.New(System.Length(S));
  for I := 1 to System.Length(S) do Result[I - 1] := Ord(S[I]) and $7F;
end;

function OpAsciiToBytes(const S: string): TA_U8;
var I: Int32;
begin
  Result := TA_U8.New(System.Length(S));
  for I := 1 to System.Length(S) do Result[I - 1] := Ord(S[I]) and $FF;
end;

function OpUtf8ToBytes(const S: string): TA_U8;
var U: UTF8String; I: Int32;
begin
  U := UTF8Encode(S);
  Result := TA_U8.New(System.Length(U));
  for I := 1 to System.Length(U) do Result[I - 1] := Ord(U[I]);
end;

function OpBytesToAnsi(const A: TA_U8): string;
var I: Int32;
begin
  System.SetLength(Result, A.length);
  for I := 0 to A.length - 1 do Result[I + 1] := WideChar(A[I] and $7F);
end;

function OpBytesToChars(const A: TA_U8): string;
begin
  Result := JsFromCharCodesU8(A);
end;

function OpBytesToUtf8(const A: TA_U8): string;
var U: UTF8String; I: Int32;
begin
  System.SetLength(U, A.length);
  for I := 0 to A.length - 1 do U[I + 1] := AnsiChar(A[I]);
  Result := UTF8Decode(U);
end;

function OpXorArrays(const A, B: TA_U8): TA_U8;
var I, N: Int32;
begin
  N := A.length;
  if B.length < N then N := B.length;
  Result := TA_U8.New(N);
  for I := 0 to N - 1 do Result[I] := A[I] xor B[I];
end;

function OpXorArrayWithByte(const A: TA_U8; V: UInt32): TA_U8;
var I: Int32;
begin
  Result := TA_U8.New(A.length);
  for I := 0 to A.length - 1 do Result[I] := A[I] xor Byte(V);
end;

function OpSecureCompare(const A, B: TA_U8): Boolean;
var I: Int32; R: UInt32;
begin
  if A.length <> B.length then Exit(False);
  R := 0;
  for I := 0 to A.length - 1 do R := R or (A[I] xor B[I]);
  Result := R = 0;
end;

function OpConstantTimeCompare(const A, B: TA_U8; N: Int32): Boolean;
var I: Int32; R, X, Y: UInt32;
begin
  if N = 0 then
  begin
    N := A.length;
    if B.length < N then N := B.length;
  end;
  R := 0;
  for I := 0 to N - 1 do
  begin
    if I < A.length then X := A[I] else X := 0;
    if I < B.length then Y := B[I] else Y := 0;
    R := R or (X xor Y);
  end;
  R := R or UInt32(A.length xor B.length);
  Result := R = 0;
end;

function OpArraysEqual(const A, B: TA_U8): Boolean;
begin
  Result := OpSecureCompare(A, B);
end;

function OpGF256Mul(A, B: UInt32): Byte;
var I: Int32; R, Hi: UInt32;
begin
  R := 0;
  A := A and $FF; B := B and $FF;
  for I := 0 to 7 do
  begin
    if (B and 1) <> 0 then R := R xor A;
    Hi := A and $80;
    A := (A shl 1) and $FF;
    if Hi <> 0 then A := A xor $1B;
    B := B shr 1;
  end;
  Result := Byte(R);
end;

function OpGFMul(A, B, Irreducible: UInt32; Width: Int32): UInt32;
var R, Mask: UInt32;
begin
  R := 0;
  Mask := UInt32((UInt32(1) shl (Width and 31)) - 1);
  while B <> 0 do
  begin
    if (B and 1) <> 0 then R := R xor A;
    A := A shl 1;
    if (A and (UInt32(1) shl (Width and 31))) <> 0 then A := A xor Irreducible;
    A := A and Mask;
    B := B shr 1;
  end;
  Result := R;
end;

function OpGetByte(W: UInt32; Index: Int32): Byte;
begin
  Result := Byte(W shr ((Index * 8) and 31));
end;

function OpGetBit(V: UInt32; Index: Int32): Boolean;
begin
  Result := ((V shr (Index and 31)) and 1) <> 0;
end;

function OpSetBit(V: UInt32; Index: Int32; Bit: Boolean): UInt32;
begin
  if Bit then Result := V or (UInt32(1) shl (Index and 31))
  else Result := V and not (UInt32(1) shl (Index and 31));
end;

function OpBitMask(Bits: Int32): UInt32;
begin
  if Bits >= 32 then Exit($FFFFFFFF);
  if Bits <= 0 then Exit(0);
  Result := (UInt32(1) shl Bits) - 1;
end;

function OpShr32Signed(V: Int32; N: Int32): Int32;
begin
  Result := SarLongint(V, N and 31);
end;

function OpMulHi32(A, B: UInt32): UInt32;
begin
  Result := UInt32((UInt64(A) * B) shr 32);
end;

function OpPopCount(V: UInt32): Int32;
begin
  Result := 0;
  while V <> 0 do begin Inc(Result, V and 1); V := V shr 1; end;
end;

function OpAddMod(A, B, M: Int32): Int32;
begin
  Result := ((A mod M) + (B mod M)) mod M;
end;

function OpSubMod(A, B, M: Int32): Int32;
begin
  Result := ((A mod M) - (B mod M) + M) mod M;
end;

function OpWords32ToBytesBE(const W: TA_U32): TA_U8;
var I: Int32;
begin
  Result := TA_U8.New(W.length * 4);
  for I := 0 to W.length - 1 do
  begin
    Result[4 * I] := Byte(W[I] shr 24);
    Result[4 * I + 1] := Byte(W[I] shr 16);
    Result[4 * I + 2] := Byte(W[I] shr 8);
    Result[4 * I + 3] := Byte(W[I]);
  end;
end;

function OpBytesToWords32BE(const B: TA_U8): TA_U32;
var I: Int32;
begin
  Result := TA_U32.Empty;
  I := 0;
  while I < B.length do
  begin
    Result.Push(OpPack32BE(B[I], B[I + 1], B[I + 2], B[I + 3]));
    I := I + 4;
  end;
end;

function OpEncodeMsgLength64LE(BitLength: UInt64): TA_U8;
begin
  Result := OpUnpack64LE(BitLength);
end;

function OpGHashMul(const X, Y: TA_U8): TA_U8;
var Z, V: TA_U8; I, J, K: Int32; XI, Lsb: Byte;
begin
  if X.IsNull or (X.length <> 16) or Y.IsNull or (Y.length <> 16) then
    raise EJsError.Create('GHashMul requires 16-byte arrays');
  Z := TA_U8.New(16);
  V := Y.Copy;
  for I := 0 to 15 do
  begin
    XI := X[I];
    for J := 7 downto 0 do
    begin
      if (XI and (1 shl J)) <> 0 then
        for K := 0 to 15 do Z[K] := Z[K] xor V[K];
      Lsb := V[15] and 1;
      for K := 15 downto 1 do V[K] := (V[K] shr 1) or ((V[K - 1] and 1) shl 7);
      V[0] := V[0] shr 1;
      if Lsb <> 0 then V[0] := V[0] xor $E1;
    end;
  end;
  Result := Z;
end;

function OpGCMIncrement(const C: TA_U8): TA_U8;
var I: Int32; Carry, Sum: UInt32;
begin
  if C.IsNull or (C.length <> 16) then raise EJsError.Create('GCMIncrement requires 16-byte counter');
  Carry := 1;
  for I := 15 downto 12 do
  begin
    Sum := C[I] + Carry;
    C[I] := Byte(Sum);
    Carry := Sum shr 8;
  end;
  Result := C;
end;

function OpAdd3L64(AL, BL, CL: UInt32): UInt64;
begin
  Result := UInt64(AL) + BL + CL;
end;

function OpAdd3H64(LowSum: UInt64; AH, BH, CH: UInt32): Int32;
begin
  Result := Int32(UInt32(UInt64(AH) + BH + CH + (LowSum shr 32)));
end;

function OpCreateUint64ArrayFromHex(const H: TA_Str): TA_A_U32;
var I: Int32; S: string;
begin
  Result := TA_A_U32.New(H.length);
  for I := 0 to H.length - 1 do
  begin
    S := H[I];
    if JsStartsWith(S, '0x') or JsStartsWith(S, '0X') then S := System.Copy(S, 3, MaxInt);
    S := JsPadStart(S, 16, '0');
    Result[I] := TA_U32.From([OpHex32ToDWords(System.Copy(S, 1, 8))[0], OpHex32ToDWords(System.Copy(S, 9, 8))[0]]);
  end;
end;

function OpToLong(const V: TBigInt): TBigInt;
begin
  Result := TBigInt.AsIntN(64, V);
end;

function OpToShort(V: Int32): Int16;
begin
  Result := Int16(V);
end;

function OpGetBitN(const V: TBigInt; Index: Int32): TBigInt;
begin
  Result := (V shr Index) and TBigInt.FromInt64(1);
end;

function OpMulModN(const A, B, M: TBigInt): TBigInt;
begin
  Result := ((A mod M) * (B mod M)) mod M;
end;

function OpSquareModN(const A, M: TBigInt): TBigInt;
var R: TBigInt;
begin
  R := A mod M;
  Result := (R * R) mod M;
end;

function OpModPowN(const B, E, M: TBigInt): TBigInt;
var Base, Ex, One: TBigInt;
begin
  One := TBigInt.FromInt64(1);
  if M = One then Exit(TBigInt.Zero);
  if E.IsZero then Exit(One);
  Result := One;
  Base := B mod M;
  Ex := E;
  while Ex.Sign > 0 do
  begin
    if (Ex.M[0] and 1) <> 0 then Result := (Result * Base) mod M;
    Ex := Ex shr 1;
    Base := (Base * Base) mod M;
  end;
end;

function OpGcdN(const A, B: TBigInt): TBigInt;
var X, Y, T: TBigInt;
begin
  X := A; if X.Neg then X := -X;
  Y := B; if Y.Neg then Y := -Y;
  while not Y.IsZero do
  begin
    T := Y;
    Y := X mod Y;
    X := T;
  end;
  Result := X;
end;

function OpModN(const A, M: TBigInt): TBigInt;
begin
  if M.Sign <= 0 then raise EJsRangeError.Create('ModN requires a positive modulus');
  Result := A mod M;
  if Result.Neg then Result := Result + M;
end;

function OpModInverseN(const A, M: TBigInt): TBigInt;
var OldR, R, OldS, S, Q, T: TBigInt;
begin
  OldR := OpModN(A, M);
  R := M;
  OldS := TBigInt.FromInt64(1);
  S := TBigInt.Zero;
  while not R.IsZero do
  begin
    Q := OldR div R;
    T := OldR - Q * R; OldR := R; R := T;
    T := OldS - Q * S; OldS := S; S := T;
  end;
  if OldR <> TBigInt.FromInt64(1) then raise EJsRangeError.Create('ModInverseN: value has no inverse modulo m');
  Result := OpModN(OldS, M);
end;

function OpBitCountN(const V: TBigInt): Int32;
begin
  if V.IsZero then Exit(1);
  Result := V.BitLength;
end;

function OpSecureRandomBytes(Count: Int32): TA_U8;
var I: Int32;
begin
  if Count < 0 then raise EJsRangeError.Create('SecureRandomBytes: count must be a non-negative integer');
  Result := TA_U8.New(Count);
  for I := 0 to Count - 1 do Result[I] := Byte(System.Random(256));
end;

{ ======================== framework ======================== }

function TJsObject.JsSetMember(const AName: string; const AValue: TJsValue): Boolean;
begin
  Result := False;
end;

function TJsObject.JsHasMember(const AName: string): Boolean;
var I: Int32;
begin
  for I := 0 to System.Length(JsExtra) - 1 do
    if JsExtra[I].Name = AName then Exit(True);
  Result := False;
end;

function TJsObject.JsGetMember(const AName: string; out AValue: TJsValue): Boolean;
var I: Int32;
begin
  for I := 0 to System.Length(JsExtra) - 1 do
    if JsExtra[I].Name = AName then begin AValue := JsExtra[I].Value; Exit(True); end;
  AValue := JsVUndef;
  Result := False;
end;

function TJsObject.JsCallMethod(const AName: string; const AValue: TJsValue): Boolean;
begin
  Result := False;
end;

function TJsObject.JsHasMethod(const AName: string): Boolean;
begin
  Result := False;
end;

function TJsObject.JsInvoke(const AName: string; const AArgs: array of TJsValue; out AResult: TJsValue): Boolean;
begin
  AResult := JsVUndef;
  Result := False;
end;

function JsArg(const AArgs: array of TJsValue; I: Int32): TJsValue;
begin
  if (I >= 0) and (I < System.Length(AArgs)) then Result := AArgs[I] else Result := JsVUndef;
end;

function JsObjGet(O: TObject; const AName: string): TJsValue;
begin
  if O = nil then raise EJsTypeError.Create('Cannot read properties of null (reading ''' + AName + ''')');
  if not (O is TJsObject) or not TJsObject(O).JsGetMember(AName, Result) then Result := JsVUndef;
end;

procedure JsObjSet(O: TObject; const AName: string; const AValue: TJsValue);
var X: TJsObject; I: Int32;
begin
  if O = nil then raise EJsTypeError.Create('Cannot set properties of null (setting ''' + AName + ''')');
  if not (O is TJsObject) then raise EJsTypeError.Create('Cannot set property ' + AName + ' of ' + O.ClassName);
  X := TJsObject(O);
  if X.JsSetMember(AName, AValue) then Exit;
  for I := 0 to System.Length(X.JsExtra) - 1 do
    if X.JsExtra[I].Name = AName then begin X.JsExtra[I].Value := AValue; Exit; end;
  I := System.Length(X.JsExtra);
  System.SetLength(X.JsExtra, I + 1);
  X.JsExtra[I].Name := AName;
  X.JsExtra[I].Value := AValue;
end;

function JsObjCall(O: TObject; const AName: string; const AArgs: array of TJsValue): TJsValue;
begin
  if O = nil then raise EJsTypeError.Create('Cannot read properties of null (reading ''' + AName + ''')');
  if not (O is TJsObject) or not TJsObject(O).JsInvoke(AName, AArgs, Result) then
    raise EJsTypeError.Create(O.ClassName + '.' + AName + ' is not a function');
end;

constructor TLinkItem.Create(const AText: string; const AUri: string);
begin
  inherited Create;
  text := AText;
  uri := AUri;
end;

constructor TTestCase.Create;
begin
  inherited Create('', '');
  input := TA_U8.Null;
  expected := TA_U8.Null;
end;

constructor TTestCase.Create(const AInput, AExpected: TA_U8; const ADescription: string; const AUri: string);
begin
  inherited Create(ADescription, AUri);
  input := AInput;
  expected := AExpected;
end;

function TTestCase.HasField(const AName: string): Boolean;
var I: Int32;
begin
  if (AName = 'input') or (AName = 'expected') or (AName = 'text') or (AName = 'uri') then Exit(True);
  for I := 0 to System.Length(Fields) - 1 do
    if Fields[I].Name = AName then Exit(True);
  Result := False;
end;

function TTestCase.GetField(const AName: string): TJsValue;
var I: Int32;
begin
  if AName = 'input' then Exit(JsVArr_U8(input));
  if AName = 'expected' then Exit(JsVArr_U8(expected));
  if AName = 'text' then Exit(JsVStr(text));
  if AName = 'uri' then Exit(JsVStr(uri));
  for I := 0 to System.Length(Fields) - 1 do
    if Fields[I].Name = AName then Exit(Fields[I].Value);
  Result := JsVUndef;
end;

procedure TTestCase.SetField(const AName: string; const AValue: TJsValue);
var I: Int32;
begin
  if AName = 'input' then begin input := JsValTo_TA_U8(AValue); Exit; end;
  if AName = 'expected' then begin expected := JsValTo_TA_U8(AValue); Exit; end;
  if AName = 'text' then begin text := JsValToStr(AValue); Exit; end;
  if AName = 'uri' then begin uri := JsValToStr(AValue); Exit; end;
  for I := 0 to System.Length(Fields) - 1 do
    if Fields[I].Name = AName then begin Fields[I].Value := AValue; Exit; end;
  I := System.Length(Fields);
  System.SetLength(Fields, I + 1);
  Fields[I].Name := AName;
  Fields[I].Value := AValue;
end;

constructor TVulnerability.Create(const AType: string; const ADescription: string; const AMitigation: string; const AUri: string);
begin
  inherited Create(AType, AUri);
  description := ADescription;
  mitigation := AMitigation;
end;

constructor TAuthResult.Create(ASuccess: Boolean; const AOutput: TA_U8; const AFailureReason: string);
begin
  inherited Create;
  Success := ASuccess;
  Output := AOutput;
  FailureReason := AFailureReason;
end;

constructor TKeySize.Create(AMinSize, AMaxSize: Int32; AStepSize: Int32);
begin
  inherited Create;
  minSize := AMinSize;
  maxSize := AMaxSize;
  stepSize := AStepSize;
end;

constructor TBlockAbsorber.Create(ABlockSize: Int32; AProcessBlock: TJsBlockProc);
begin
  inherited Create;
  if not (ABlockSize > 0) then raise EJsError.Create('BlockAbsorber: blockSize must be positive');
  if not Assigned(AProcessBlock) then raise EJsError.Create('BlockAbsorber: processBlock must be a function');
  _blockSize := ABlockSize;
  _processBlock := AProcessBlock;
  _held := TA_U8.New(ABlockSize);
  _pending := 0;
  _length := 0;
end;

function TBlockAbsorber.Get_BlockSize: Int32;
begin
  Result := _blockSize;
end;

function TBlockAbsorber.Get_Pending: Int32;
begin
  Result := _pending;
end;

function TBlockAbsorber.Get_Length: UInt64;
begin
  Result := _length;
end;

procedure TBlockAbsorber.Absorb(const AData: TA_U8);
var Total, Offset, Take, I: Int32;
begin
  if AData.IsNull or (AData.length = 0) then Exit;
  Total := AData.length;
  Offset := 0;
  while Offset < Total do
  begin
    if _pending = _blockSize then
    begin
      _processBlock(_held);
      _pending := 0;
    end;
    Take := _blockSize - _pending;
    if Total - Offset < Take then Take := Total - Offset;
    for I := 0 to Take - 1 do _held[_pending + I] := AData[Offset + I];
    _pending := _pending + Take;
    Offset := Offset + Take;
    _length := _length + UInt64(Take);
  end;
end;

function TBlockAbsorber.FinishHeld: TA_U8;
begin
  Result := _held.Slice(0, _pending);
end;

procedure TBlockAbsorber.Reset;
begin
  _held.Fill(0);
  _pending := 0;
  _length := 0;
end;

constructor TMerkleDamgardOptions.Create(ABlockSize, APadByte, ALengthBytes: Int32; ALengthLittleEndian, ALengthInBits: Boolean);
begin
  inherited Create;
  blockSize := ABlockSize;
  padByte := APadByte;
  lengthBytes := ALengthBytes;
  lengthLittleEndian := ALengthLittleEndian;
  lengthInBits := ALengthInBits;
end;

function JsEncodeLength(Value: UInt64; ByteCount: Int32; LittleEndian: Boolean): TA_U8;
var I: Int32;
begin
  Result := TA_U8.New(ByteCount);
  for I := 0 to ByteCount - 1 do
  begin
    if LittleEndian then Result[I] := Byte(Value) else Result[ByteCount - 1 - I] := Byte(Value);
    Value := Value shr 8;
  end;
end;

function MerkleDamgardBlocks(const held: TA_U8; pending: Int32; totalLength: UInt64; options: TMerkleDamgardOptions): TA_A_U8;
var BlockSize_, Used, I: Int32; Block, Encoded: TA_U8; Len: UInt64;
begin
  BlockSize_ := options.blockSize;
  if not (BlockSize_ > 0) then raise EJsError.Create('MerkleDamgardBlocks: blockSize must be positive');
  if (pending < 0) or (pending > BlockSize_) then
    raise EJsError.Create('MerkleDamgardBlocks: pending ' + IntToStr(pending) + ' outside 0..' + IntToStr(BlockSize_));
  if (options.lengthBytes < 0) or (options.lengthBytes >= BlockSize_) then
    raise EJsError.Create('MerkleDamgardBlocks: lengthBytes ' + IntToStr(options.lengthBytes) + ' does not fit a ' + IntToStr(BlockSize_) + '-byte block');
  Result := TA_A_U8.Empty;
  Block := TA_U8.New(BlockSize_);
  for I := 0 to pending - 1 do Block[I] := held[I];
  Used := pending;
  if Used = BlockSize_ then
  begin
    Result.Push(Block);
    Block := TA_U8.New(BlockSize_);
    Used := 0;
  end;
  Block[Used] := Byte(options.padByte);
  Inc(Used);
  if Used > BlockSize_ - options.lengthBytes then
  begin
    Result.Push(Block);
    Block := TA_U8.New(BlockSize_);
  end;
  if options.lengthBytes > 0 then
  begin
    if options.lengthInBits then Len := totalLength * 8 else Len := totalLength;
    Encoded := JsEncodeLength(Len, options.lengthBytes, options.lengthLittleEndian);
    for I := 0 to options.lengthBytes - 1 do Block[BlockSize_ - options.lengthBytes + I] := Encoded[I];
  end;
  Result.Push(Block);
end;

function SpongePadBlocks(const held: TA_U8; pending, rate, separator: Int32): TA_A_U8;
var Block: TA_U8; Used, I: Int32;
begin
  if not (rate > 0) then raise EJsError.Create('SpongePadBlocks: rate must be positive');
  if (pending < 0) or (pending > rate) then
    raise EJsError.Create('SpongePadBlocks: pending ' + IntToStr(pending) + ' outside 0..' + IntToStr(rate));
  Result := TA_A_U8.Empty;
  Block := TA_U8.New(rate);
  for I := 0 to pending - 1 do Block[I] := held[I];
  Used := pending;
  if Used = rate then
  begin
    Result.Push(Block);
    Block := TA_U8.New(rate);
    Used := 0;
  end;
  Block[Used] := Byte(separator);
  Block[rate - 1] := Block[rate - 1] or $80;
  Result.Push(Block);
end;

constructor TAlgorithm.Create;
begin
  inherited Create;
  year := 0;
  documentation := TA_LinkItem.Empty;
  references := TA_LinkItem.Empty;
  knownVulnerabilities := TA_Vulnerability.Empty;
  tests := TA_TestCase.Empty;
end;

function TAlgorithm.CreateInstance(isInverse: Boolean): TIAlgorithmInstance;
begin
  raise EJsError.Create('CreateInstance() not implemented');
end;

function TAlgorithm.JsGetMember(const AName: string; out AValue: TJsValue): Boolean;
begin
  Result := True;
  if AName = 'name' then AValue := JsVStr(name)
  else if AName = 'description' then AValue := JsVStr(description)
  else if AName = 'category' then AValue := JsVStr(category)
  else Result := inherited JsGetMember(AName, AValue);
end;

function TAlgorithm.JsInvoke(const AName: string; const AArgs: array of TJsValue; out AResult: TJsValue): Boolean;
begin
  if AName = 'CreateInstance' then
  begin
    AResult := JsVObj(CreateInstance(JsValToBool(JsArg(AArgs, 0))));
    Exit(True);
  end;
  Result := inherited JsInvoke(AName, AArgs, AResult);
end;

constructor TBlockCipherAlgorithm.Create;
begin
  inherited Create;
  SupportedKeySizes := TA_KeySize.Empty;
  SupportedBlockSizes := TA_KeySize.Empty;
end;

constructor THashFunctionAlgorithm.Create;
begin
  inherited Create;
  SupportedOutputSizes := TA_KeySize.Empty;
end;

constructor TMacAlgorithm.Create;
begin
  inherited Create;
  SupportedMacSizes := TA_KeySize.Empty;
  NeedsKey := True;
end;

constructor TKdfAlgorithm.Create;
begin
  inherited Create;
  SupportedOutputSizes := TA_KeySize.Empty;
  SaltRequired := True;
end;

constructor TPaddingAlgorithm.Create;
begin
  inherited Create;
  IsLengthIncluded := False;
end;

constructor TCipherModeAlgorithm.Create;
begin
  inherited Create;
  RequiresIV := True;
  SupportedIVSizes := TA_KeySize.Empty;
end;

constructor TAeadAlgorithm.Create;
begin
  inherited Create;
  SupportedTagSizes := TA_KeySize.Empty;
  SupportsDetached := False;
end;

constructor TRandomGenerationAlgorithm.Create;
begin
  inherited Create;
  IsDeterministic := False;
  IsCryptographicallySecure := True;
  SupportedSeedSizes := TA_KeySize.Empty;
end;

constructor TIAlgorithmInstance.Create(AAlgorithm: TAlgorithm);
begin
  inherited Create;
  algorithm := AAlgorithm;
  isInverse := False;
  inputBuffer := TA_U8.Empty;
end;

procedure TIAlgorithmInstance.Feed(data: TA_U8);
var I: Int32;
begin
  if data.IsNull or (data.length = 0) then Exit;
  if inputBuffer.IsNull then inputBuffer := TA_U8.Empty;
  for I := 0 to data.length - 1 do inputBuffer.Push(data[I]);
end;

function TIAlgorithmInstance.Result_: TA_U8;
begin
  raise EJsError.Create('Result() not implemented');
end;

procedure TIAlgorithmInstance.Dispose;
begin
  if not inputBuffer.IsNull then inputBuffer.length := 0;
end;

function TIAlgorithmInstance.JsSetMember(const AName: string; const AValue: TJsValue): Boolean;
begin
  if AName = 'algorithm' then begin algorithm := TAlgorithm(JsValToObj(AValue)); Exit(True); end;
  if AName = 'isInverse' then begin isInverse := JsValToBool(AValue); Exit(True); end;
  if AName = 'inputBuffer' then begin inputBuffer := JsValTo_TA_U8(AValue); Exit(True); end;
  Result := inherited JsSetMember(AName, AValue);
end;

function TIAlgorithmInstance.JsHasMember(const AName: string): Boolean;
begin
  Result := (AName = 'algorithm') or (AName = 'isInverse') or (AName = 'inputBuffer') or inherited JsHasMember(AName);
end;

function TIAlgorithmInstance.JsGetMember(const AName: string; out AValue: TJsValue): Boolean;
begin
  Result := True;
  if AName = 'algorithm' then AValue := JsVObj(algorithm)
  else if AName = 'isInverse' then AValue := JsVBool(isInverse)
  else if AName = 'inputBuffer' then AValue := JsVArr_U8(inputBuffer)
  else Result := inherited JsGetMember(AName, AValue);
end;

function TIAlgorithmInstance.JsInvoke(const AName: string; const AArgs: array of TJsValue; out AResult: TJsValue): Boolean;
begin
  Result := True;
  AResult := JsVUndef;
  if AName = 'Feed' then Feed(JsValTo_TA_U8(JsArg(AArgs, 0)))
  else if AName = 'Result' then AResult := JsVArr_U8(Result_)
  else if AName = 'Dispose' then Dispose
  else Result := inherited JsInvoke(AName, AArgs, AResult);
end;

constructor TIBlockCipherInstance.Create(AAlgorithm: TAlgorithm);
begin
  inherited Create(AAlgorithm);
  BlockSize := 0;
  KeySize := 0;
  _key := TA_U8.Null;
end;

procedure TIBlockCipherInstance.Set_key(keyBytes: TA_U8);
begin
  _key := keyBytes;
end;

function TIBlockCipherInstance.Get_key: TA_U8;
begin
  Result := _key;
end;

function TIBlockCipherInstance.EncryptBlock(block: TA_U8): TA_U8;
begin
  raise EJsError.Create('EncryptBlock() not implemented');
end;

function TIBlockCipherInstance.DecryptBlock(block: TA_U8): TA_U8;
begin
  raise EJsError.Create('DecryptBlock() not implemented');
end;

function TIBlockCipherInstance.RequireBlockMultiple(blockSize_: Int32): Int32;
var Size, Len: Int32;
begin
  Size := blockSize_;
  if Size = 0 then Size := BlockSize;
  if not (Size > 0) then raise EJsError.Create('BlockSize not set');
  if inputBuffer.IsNull then Len := 0 else Len := inputBuffer.length;
  if Len mod Size <> 0 then raise EJsError.Create('Input length must be multiple of ' + IntToStr(Size) + ' bytes');
  Result := Len div Size;
end;

function TIBlockCipherInstance.Result_: TA_U8;
var Bs, Offset, I: Int32; Block, Processed, Output: TA_U8;
begin
  if key.IsNull then raise EJsError.Create('Key not set');
  if inputBuffer.IsNull or (inputBuffer.length = 0) then raise EJsError.Create('No data fed');
  Bs := BlockSize;
  RequireBlockMultiple(Bs);
  Output := TA_U8.Empty;
  Offset := 0;
  while Offset < inputBuffer.length do
  begin
    Block := inputBuffer.Slice(Offset, Offset + Bs);
    if isInverse then Processed := DecryptBlock(Block) else Processed := EncryptBlock(Block);
    for I := 0 to Processed.length - 1 do Output.Push(Processed[I]);
    Offset := Offset + Bs;
  end;
  inputBuffer := TA_U8.Empty;
  Result := Output;
end;

function TIBlockCipherInstance.JsSetMember(const AName: string; const AValue: TJsValue): Boolean;
begin
  if AName = 'BlockSize' then begin BlockSize := Int32(JsValToInt64(AValue)); Exit(True); end;
  if AName = 'KeySize' then begin KeySize := Int32(JsValToInt64(AValue)); Exit(True); end;
  if AName = '_key' then begin _key := JsValTo_TA_U8(AValue); Exit(True); end;
  if AName = 'key' then begin key := JsValTo_TA_U8(AValue); Exit(True); end;
  Result := inherited JsSetMember(AName, AValue);
end;

function TIBlockCipherInstance.JsHasMember(const AName: string): Boolean;
begin
  Result := (AName = 'BlockSize') or (AName = 'KeySize') or (AName = '_key') or (AName = 'key') or inherited JsHasMember(AName);
end;

function TIBlockCipherInstance.JsGetMember(const AName: string; out AValue: TJsValue): Boolean;
begin
  Result := True;
  if AName = 'BlockSize' then AValue := JsVInt(BlockSize)
  else if AName = 'KeySize' then AValue := JsVInt(KeySize)
  else if AName = '_key' then AValue := JsVArr_U8(_key)
  else if AName = 'key' then AValue := JsVArr_U8(key)
  else Result := inherited JsGetMember(AName, AValue);
end;

function TIBlockCipherInstance.JsInvoke(const AName: string; const AArgs: array of TJsValue; out AResult: TJsValue): Boolean;
begin
  Result := True;
  if AName = 'EncryptBlock' then AResult := JsVArr_U8(EncryptBlock(JsValTo_TA_U8(JsArg(AArgs, 0))))
  else if AName = 'DecryptBlock' then AResult := JsVArr_U8(DecryptBlock(JsValTo_TA_U8(JsArg(AArgs, 0))))
  else Result := inherited JsInvoke(AName, AArgs, AResult);
end;

function TIHashFunctionInstance.JsSetMember(const AName: string; const AValue: TJsValue): Boolean;
begin
  if AName = 'OutputSize' then begin OutputSize := Int32(JsValToInt64(AValue)); Exit(True); end;
  Result := inherited JsSetMember(AName, AValue);
end;

function TIHashFunctionInstance.JsHasMember(const AName: string): Boolean;
begin
  Result := (AName = 'OutputSize') or inherited JsHasMember(AName);
end;

function TIHashFunctionInstance.JsGetMember(const AName: string; out AValue: TJsValue): Boolean;
begin
  if AName = 'OutputSize' then begin AValue := JsVInt(OutputSize); Exit(True); end;
  Result := inherited JsGetMember(AName, AValue);
end;

function TIMacInstance.ComputeMac(data: TA_U8): TA_U8;
begin
  raise EJsError.Create('ComputeMac() not implemented');
end;

function TIKdfInstance.JsSetMember(const AName: string; const AValue: TJsValue): Boolean;
begin
  if AName = 'OutputSize' then begin OutputSize := Int32(JsValToInt64(AValue)); Exit(True); end;
  if AName = 'Iterations' then begin Iterations := Int32(JsValToInt64(AValue)); Exit(True); end;
  Result := inherited JsSetMember(AName, AValue);
end;

function TIKdfInstance.JsHasMember(const AName: string): Boolean;
begin
  Result := (AName = 'OutputSize') or (AName = 'Iterations') or inherited JsHasMember(AName);
end;

function TIAeadInstance.JsSetMember(const AName: string; const AValue: TJsValue): Boolean;
begin
  if AName = 'aad' then begin aad := JsValTo_TA_U8(AValue); Exit(True); end;
  if AName = 'tagSize' then begin tagSize := Int32(JsValToInt64(AValue)); Exit(True); end;
  Result := inherited JsSetMember(AName, AValue);
end;

function TIAeadInstance.JsHasMember(const AName: string): Boolean;
begin
  Result := (AName = 'aad') or (AName = 'tagSize') or inherited JsHasMember(AName);
end;

function TIErrorCorrectionInstance.DetectError(data: TA_U8): Boolean;
begin
  raise EJsError.Create('DetectError() not implemented');
end;

function TIRandomGeneratorInstance.NextBytes(count: Int32): TA_U8;
begin
  raise EJsError.Create('NextBytes() not implemented');
end;

procedure RegisterAlgorithm(AAlgorithm: TAlgorithm);
var I: Int32;
begin
  if AAlgorithm = nil then raise EJsError.Create('RegisterAlgorithm: Invalid algorithm object');
  if AAlgorithm.name = '' then raise EJsError.Create('RegisterAlgorithm: Algorithm must have a valid name');
  for I := 0 to JsAlgorithms.length - 1 do
    if JsAlgorithms[I].name = AAlgorithm.name then
      raise EJsError.Create('RegisterAlgorithm: Algorithm ''' + AAlgorithm.name + ''' already registered');
  JsAlgorithms.Push(AAlgorithm);
end;

function JsFindAlgorithm(const AName: string): TAlgorithm;
var I: Int32;
begin
  for I := JsAlgorithms.length - 1 downto 0 do
    if JsAlgorithms[I].name = AName then Exit(JsAlgorithms[I]);
  Result := nil;
end;`;

  const RUNTIME_INITIALIZATION = String.raw`  JsInvariant := DefaultFormatSettings;
  JsInvariant.DecimalSeparator := '.';
  JsInvariant.ThousandSeparator := ',';
  JsAlgorithms := TA_Algorithm.Empty;`;

  const UNIT_DIRECTIVES = [
    '{$MODE DELPHIUNICODE}',
    '{$MODESWITCH NESTEDPROCVARS}',
    '{$MODESWITCH ADVANCEDRECORDS}',
    '{$Q-}{$R-}{$GOTO ON}{$INLINE ON}{$B-}',
    '{$WARN 5024 OFF}{$WARN 5025 OFF}{$WARN 5026 OFF}{$WARN 5028 OFF}{$WARN 5036 OFF}{$WARN 5057 OFF}{$WARN 5091 OFF}{$WARN 5092 OFF}{$WARN 6058 OFF}{$WARN 4055 OFF}{$WARN 4056 OFF}{$WARN 4079 OFF}{$WARN 4080 OFF}{$WARN 4081 OFF}{$WARN 4082 OFF}{$WARN 3123 OFF}{$WARN 3124 OFF}'
  ];

  /**
   * Every identifier the runtime declares at unit level, lower-cased: the
   * transformer keeps generated names off them.
   */
  function runtimeIdentifiers() {
    const names = new Set();
    const text = RUNTIME_INTERFACE;
    for (const m of text.matchAll(/^\s*(?:function|procedure)\s+([A-Za-z_]\w*)/gm)) names.add(m[1].toLowerCase());
    for (const m of text.matchAll(/^\s{2}([A-Za-z_]\w*)\s*(?:<[^>]*>)?\s*=/gm)) names.add(m[1].toLowerCase());
    for (const m of text.matchAll(/^\s{2}([A-Za-z_]\w*)\s*:/gm)) names.add(m[1].toLowerCase());
    for (const m of RUNTIME_IMPLEMENTATION.matchAll(/^(?:function|procedure)\s+([A-Za-z_]\w*)\s*[(:;]/gm)) names.add(m[1].toLowerCase());
    return names;
  }

  // ======================== precedence ========================

  const PREC = {
    '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, 'in': 1, 'is': 1,
    '+': 2, '-': 2, 'or': 2, 'xor': 2,
    '*': 3, '/': 3, 'div': 3, 'mod': 3, 'and': 3, 'shl': 3, 'shr': 3, 'as': 3
  };

  class DelphiEmitter {
    constructor(options = {}) {
      this.indentUnit = options.indent || '  ';
      this.newline = options.newline || '\n';
      this.addComments = options.addComments !== false;
    }

    // ------------------------------------------------------------ entry

    /**
     * Emit a unit (or, for a bare node, its text).
     * @param {object} node - DelphiAST unit, routine, statement or expression
     * @returns {string} Pascal source
     */
    emit(node) {
      if (!node) return '';
      if (node.kind === 'unit') return this.emitUnit(node);
      if (node.kind === 'routine') return this.emitRoutine(node, 0).join(this.newline);
      if (this.isStatement(node)) return this.emitStatements([node], 0).join(this.newline);
      return this.expr(node);
    }

    isStatement(node) {
      return ['assign', 'expr', 'if', 'while', 'repeat', 'for', 'try', 'raise', 'exit', 'break', 'continue',
        'goto', 'label', 'block', 'comment', 'rawStmt'].includes(node.kind);
    }

    ind(level) {
      return this.indentUnit.repeat(level);
    }

    // ------------------------------------------------------------ unit

    emitUnit(u) {
      const L = [];
      L.push(`unit ${u.name};`);
      L.push('');
      if (this.addComments && u.header.length) {
        for (const line of u.header) L.push(`{ ${line.replace(/[{}]/g, '')} }`);
        L.push('');
      }
      L.push(...UNIT_DIRECTIVES);
      L.push('');
      // the runtime is embedded, or (when several units share it) a unit of its own
      const embedded = !u.runtimeUnit;
      L.push('interface');
      L.push('');
      L.push(`uses ${['SysUtils', 'Math', 'TypInfo', ...(embedded ? [] : [u.runtimeUnit]), ...u.interfaceUses].join(', ')};`);
      L.push('');
      if (embedded) {
        L.push(u.runtimeInterface || RUNTIME_INTERFACE);
        L.push('');
      }
      // a library unit exports its declarations; any other unit keeps them private
      const declarations = [];
      if (u.types.length) {
        declarations.push('type');
        for (const t of u.types) declarations.push(...this.emitTypeDecl(t, 1));
        declarations.push('');
      }
      if (u.consts.length) {
        declarations.push('const');
        for (const c of u.consts) declarations.push(`${this.ind(1)}${c.name}: ${c.type} = ${c.valueText};`);
        declarations.push('');
      }
      if (u.vars.length) {
        declarations.push('var');
        for (const v of u.vars) declarations.push(`${this.ind(1)}${v.name}: ${v.type};`);
        declarations.push('');
      }
      if (u.isLibrary) {
        L.push(...declarations);
        for (const f of u.forwards) L.push(this.routineHeader(f, false));
        L.push('');
      }
      L.push('implementation');
      L.push('');
      const implUses = [...(embedded ? ['uregexpr', 'Character'] : []), ...(u.usesUnits || []), ...u.implementationUses];
      if (implUses.length) {
        L.push(`uses ${implUses.join(', ')};`);
        L.push('');
      }
      if (embedded) {
        L.push(u.runtimeImplementation || RUNTIME_IMPLEMENTATION);
        L.push('');
      }
      L.push('{ ======================== generated code ======================== }');
      L.push('');
      if (!u.isLibrary) {
        L.push(...declarations);
        for (const f of u.forwards) L.push(this.routineHeader(f, false) + ' forward;');
        if (u.forwards.length) L.push('');
      }
      for (const r of u.routines) {
        L.push(...this.emitRoutine(r, 0));
        L.push('');
      }
      L.push('initialization');
      if (embedded) L.push(u.runtimeInitialization || RUNTIME_INITIALIZATION);
      L.push(...this.emitStatements(u.initialization, 1));
      L.push('end.');
      L.push('');
      return L.join(this.newline);
    }

    // ------------------------------------------------------------ types

    emitTypeDecl(t, level) {
      const I = this.ind(level);
      switch (t.kind) {
        case 'forwardClass':
          return [`${I}${t.name} = class;`];
        case 'typeAlias':
        case 'procType':
          return [`${I}${t.name} = ${t.text};`];
        case 'recordDecl': {
          const L = [`${I}${t.name} = record`];
          for (const f of t.fields) L.push(`${I}${this.indentUnit}${f.name}: ${f.type};`);
          L.push(`${I}end;`);
          return L;
        }
        case 'classDecl': {
          const L = [];
          if (t.comment && this.addComments) L.push(`${I}{ ${t.comment.replace(/[{}]/g, '')} }`);
          L.push(`${I}${t.name} = class${t.base ? '(' + t.base + ')' : ''}`);
          const fields = t.members.filter(m => m.kind === 'field' && !m.isClassVar);
          const classVars = t.members.filter(m => m.kind === 'field' && m.isClassVar);
          const methods = t.members.filter(m => m.kind === 'method');
          const props = t.members.filter(m => m.kind === 'property');
          const J = I + this.indentUnit;
          const K = J + this.indentUnit;
          if (fields.length) {
            L.push(`${J}public`);
            for (const f of fields) L.push(`${K}${f.name}: ${f.type};`);
          }
          if (classVars.length) {
            L.push(`${J}public`);
            for (const f of classVars) L.push(`${K}class var ${f.name}: ${f.type};`);
          }
          if (methods.length || props.length) {
            L.push(`${J}public`);
            for (const m of methods) L.push(`${K}${this.methodHeader(m)}`);
            for (const p of props)
              L.push(`${K}${p.isClassProp ? 'class ' : ''}property ${p.name}: ${p.type}${p.read ? ' read ' + p.read : ''}${p.write ? ' write ' + p.write : ''};`);
          }
          L.push(`${I}end;`);
          return L;
        }
        default:
          throw new Error('DelphiEmitter: unknown type declaration ' + t.kind);
      }
    }

    paramList(params) {
      if (!params.length) return '';
      return '(' + params.map(p =>
        (p.mode ? p.mode + ' ' : '') + p.name + ': ' + p.type + (p.defaultValue != null ? ' = ' + p.defaultValue : '')
      ).join('; ') + ')';
    }

    methodHeader(m) {
      const kw = m.routineKind;
      const head = (m.isClassMethod ? 'class ' : '') + kw + ' ' + m.name + this.paramList(m.params) +
        (m.returns ? ': ' + m.returns : '') + ';';
      return head + (m.directives.length ? ' ' + m.directives.map(d => d + ';').join(' ') : '');
    }

    routineHeader(r, withOwner = true) {
      const name = (withOwner && r.owner ? r.owner + '.' : '') + r.name;
      return (r.isClassMethod ? 'class ' : '') + r.routineKind + ' ' + name + this.paramList(r.params) +
        (r.returns ? ': ' + r.returns : '') + ';';
    }

    // ------------------------------------------------------------ routines

    emitRoutine(r, level) {
      const I = this.ind(level);
      const L = [];
      if (r.comment && this.addComments) L.push(`${I}{ ${r.comment.replace(/[{}]/g, '')} }`);
      const header = this.routineHeader(r, true);
      const extra = r.owner ? [] : r.directives;
      L.push(I + header + (extra.length ? ' ' + extra.map(d => d + ';').join(' ') : ''));
      if (r.labels.length) L.push(`${I}label ${r.labels.join(', ')};`);
      if (r.vars.length) {
        L.push(`${I}var`);
        for (const v of r.vars) L.push(`${I}${this.indentUnit}${v.name}: ${v.type};`);
      }
      for (const n of r.nested) L.push(...this.emitRoutine(n, level + 1));
      L.push(`${I}begin`);
      L.push(...this.emitStatements(r.body, level + 1));
      L.push(`${I}end;`);
      return L;
    }

    // ------------------------------------------------------------ statements

    emitStatements(stmts, level) {
      const L = [];
      for (const s of stmts) this.emitStatement(s, level, L);
      return L;
    }

    emitBlock(body, level, L, suffix) {
      L.push(`${this.ind(level)}begin`);
      L.push(...this.emitStatements(body, level + 1));
      L.push(`${this.ind(level)}end${suffix}`);
    }

    emitStatement(s, level, L) {
      const I = this.ind(level);
      switch (s.kind) {
        case 'assign':
          L.push(`${I}${this.expr(s.target)} := ${this.expr(s.value)};`);
          return;
        case 'expr':
          L.push(`${I}${this.expr(s.e)};`);
          return;
        case 'if': {
          L.push(`${I}if ${this.expr(s.cond)} then`);
          if (s.else && s.else.length) {
            this.emitBlock(s.then, level, L, '');
            L.push(`${I}else`);
            this.emitBlock(s.else, level, L, ';');
          } else {
            this.emitBlock(s.then, level, L, ';');
          }
          return;
        }
        case 'while':
          L.push(`${I}while ${this.expr(s.cond)} do`);
          this.emitBlock(s.body, level, L, ';');
          return;
        case 'repeat':
          L.push(`${I}repeat`);
          L.push(...this.emitStatements(s.body, level + 1));
          L.push(`${I}until ${this.expr(s.cond)};`);
          return;
        case 'for':
          L.push(`${I}for ${s.variable} := ${this.expr(s.from)} ${s.down ? 'downto' : 'to'} ${this.expr(s.to)} do`);
          this.emitBlock(s.body, level, L, ';');
          return;
        case 'try': {
          const inner = [];
          if (s.handler) {
            inner.push(`try`);
            inner.push(...this.emitStatements(s.body, 1));
            inner.push(`except`);
            if (s.handler.varName) {
              inner.push(`${this.indentUnit}on ${s.handler.varName}: ${s.handler.type || 'Exception'} do`);
              inner.push(`${this.indentUnit}begin`);
              inner.push(...this.emitStatements(s.handler.body, 2));
              inner.push(`${this.indentUnit}end;`);
            } else {
              inner.push(...this.emitStatements(s.handler.body, 1));
            }
            inner.push(`end;`);
          } else {
            inner.push(...this.emitStatements(s.body, 0).map(x => x));
          }
          if (s.fin) {
            L.push(`${I}try`);
            for (const x of inner) L.push(this.ind(level + 1) + x);
            L.push(`${I}finally`);
            L.push(...this.emitStatements(s.fin, level + 1));
            L.push(`${I}end;`);
          } else {
            for (const x of inner) L.push(I + x);
          }
          return;
        }
        case 'raise':
          L.push(s.e ? `${I}raise ${this.expr(s.e)};` : `${I}raise;`);
          return;
        case 'exit':
          L.push(s.value ? `${I}Exit(${this.expr(s.value)});` : `${I}Exit;`);
          return;
        case 'break':
          L.push(`${I}Break;`);
          return;
        case 'continue':
          L.push(`${I}Continue;`);
          return;
        case 'goto':
          L.push(`${I}goto ${s.label};`);
          return;
        case 'label':
          L.push(`${this.ind(Math.max(0, level - 1))}${s.name}: ;`);
          return;
        case 'block':
          this.emitBlock(s.body, level, L, ';');
          return;
        case 'comment':
          if (this.addComments) L.push(`${I}{ ${String(s.text).replace(/[{}]/g, '')} }`);
          return;
        case 'rawStmt':
          for (const line of String(s.text).split('\n')) L.push(I + line);
          return;
        default:
          throw new Error('DelphiEmitter: unknown statement ' + s.kind);
      }
    }

    // ------------------------------------------------------------ expressions

    prec(e) {
      switch (e.kind) {
        case 'bin': return PREC[e.op] || 1;
        case 'un': return e.op === '-' ? 2 : 4;
        case 'lit': return /^-/.test(e.text) ? 2 : 5;
        case 'raw': return e.compound ? 0 : 5;
        default: return 5;
      }
    }

    wrap(e, minPrec) {
      const text = this.exprText(e);
      return this.prec(e) < minPrec ? '(' + text + ')' : text;
    }

    expr(e) {
      return this.exprText(e);
    }

    exprText(e) {
      if (e == null) return 'nil';
      if (typeof e === 'string') return e;
      switch (e.kind) {
        case 'id': return e.name;
        case 'lit': return e.text;
        case 'raw': return e.text;
        case 'bin': {
          const p = PREC[e.op] || 1;
          const leftMin = p === 1 ? 2 : p;
          // a right operand of the same level is always parenthesized: and, shr, div, mod and *
          // share one level, so a and (b shr 1 and c) printed flat would regroup
          const rightMin = p + 1;
          return `${this.wrap(e.l, leftMin)} ${e.op} ${this.wrap(e.r, p === 1 ? 2 : rightMin)}`;
        }
        case 'un':
          if (e.op === 'not') return `not ${this.wrap(e.e, 4)}`;
          if (e.op === '@') return `@${this.wrap(e.e, 5)}`;
          return `-${this.wrap(e.e, 4)}`;
        case 'call':
          return `${this.wrap(e.fn, 5)}${e.args.length ? '(' + e.args.map(a => this.expr(a)).join(', ') + ')' : ''}`;
        case 'mem':
          return `${this.wrap(e.obj, 5)}.${e.name}`;
        case 'idx':
          return `${this.wrap(e.obj, 5)}[${this.expr(e.index)}]`;
        case 'cast':
          return `${e.type}(${this.expr(e.e)})`;
        case 'arr':
          return `[${e.items.map(a => this.expr(a)).join(', ')}]`;
        default:
          throw new Error('DelphiEmitter: unknown expression ' + e.kind);
      }
    }
  }

  /**
   * The runtime as a unit of its own, for units that share it.
   * @param {string} name - unit name
   * @returns {string} Pascal source
   */
  function runtimeUnit(name) {
    return [`unit ${name};`, '', '{ The runtime the transpiled units share. Generated by the SynthelicZ Cipher transpiler }', '',
      ...UNIT_DIRECTIVES, '', 'interface', '', 'uses SysUtils, Math, TypInfo;', '', RUNTIME_INTERFACE, '', 'implementation', '',
      'uses uregexpr, Character;', '', RUNTIME_IMPLEMENTATION, '', 'initialization', RUNTIME_INITIALIZATION, 'end.', ''].join('\n');
  }

  const exported = { DelphiEmitter, RUNTIME_INTERFACE, RUNTIME_IMPLEMENTATION, RUNTIME_INITIALIZATION, runtimeIdentifiers, runtimeUnit };

  if (typeof module !== 'undefined' && module.exports)
    module.exports = exported;
  if (typeof global !== 'undefined' && global)
    global.DelphiEmitter = DelphiEmitter;
  if (typeof global !== 'undefined' && global)
    global.DelphiEmitterModule = exported;

})(typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : this));
