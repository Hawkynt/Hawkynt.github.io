/**
 * PerlEmitter.js - Perl Code Generator from Perl AST
 * Generates properly formatted Perl source code from PerlAST nodes
 * (c)2006-2025 Hawkynt
 *
 * Pipeline: JS Source -> JS AST -> Type Inference -> Perl AST -> Perl Emitter -> Perl Source
 */

(function(global) {
  'use strict';

  // Load PerlAST if available
  let PerlAST;
  if (typeof require !== 'undefined') {
    PerlAST = require('./PerlAST.js');
  } else if (global.PerlAST) {
    PerlAST = global.PerlAST;
  }

  /**
   * Perl Code Emitter
   * Generates formatted Perl code from a Perl AST
   *
   * Supported Options:
   * - indent: string - Indentation string (default: '    ')
   * - newline/lineEnding: string - Line ending character (default: '\n')
   * - useStrict: boolean - Add 'use strict'. Default: true
   * - useWarnings: boolean - Add 'use warnings'. Default: true
   */
  // Framework base classes that need stub definitions
  const FRAMEWORK_BASE_CLASSES = new Set([
    'Algorithm', 'IAlgorithmInstance',
    'BlockCipherAlgorithm', 'IBlockCipherInstance',
    'StreamCipherAlgorithm', 'IStreamCipherInstance',
    'HashFunctionAlgorithm', 'IHashFunctionInstance',
    'MacAlgorithm', 'IMacInstance',
    'KdfAlgorithm', 'IKdfInstance',
    'AeadAlgorithm', 'IAeadInstance',
    'CompressionAlgorithm', 'ICompressionInstance',
    'ErrorCorrectionAlgorithm', 'IErrorCorrectionInstance',
    'RandomGenerationAlgorithm', 'IRandomGeneratorInstance',
    'EncodingAlgorithm', 'IEncodingInstance',
    'PaddingAlgorithm', 'IPaddingInstance',
    'CipherModeAlgorithm', 'ICipherModeInstance',
    'AsymmetricCipherAlgorithm', 'IAsymmetricCipherInstance',
    'SymmetricCipherAlgorithm', 'CryptoAlgorithm'
  ]);

  // Framework helper classes (like LinkItem, TestCase, etc.)
  const FRAMEWORK_HELPER_CLASSES = new Set([
    'LinkItem', 'Vulnerability', 'TestCase', 'KeySize', 'AuthResult'
  ]);

  class PerlEmitter {
    constructor(options = {}) {
      this.options = options;
      this.indentString = options.indent || '    ';
      this.indentLevel = 0;
      this.newline = options.newline || options.lineEnding || '\n';
      this.emittedBaseClassStubs = new Set(); // Track which stubs we've already emitted
      this.skipHelperStubs = options.skipHelperStubs || false; // Skip emitting LinkItem, TestCase, etc.
      this.skipBaseStubs = options.skipBaseStubs || false; // Skip emitting base algorithm class stubs
    }

    /**
     * Emit Perl code from a Perl AST node
     * @param {PerlNode} node - The AST node to emit
     * @returns {string} Generated Perl code
     */
    emit(node) {
      if (!node) return '';

      if (typeof node === 'string') return node;

      // Handle arrays of nodes (e.g., from transformLetStatement)
      if (Array.isArray(node)) {
        return node.map(n => this.emit(n)).filter(s => s).join('');
      }

      // Duck typing fallback for nodes with missing nodeType
      if (!node.nodeType) {
        if (node.statements !== undefined) return this.emitBlock(node);
        if (node.target && node.value && node.operator !== undefined) return this.emitAssignment(node);
        if (node.name && typeof node.name === 'string') return this.emitIdentifier(node);
        // Skip known control objects from transformer (not AST nodes)
        if (node.isMethod !== undefined || node.initStatement !== undefined) return '';
        // Show more debug info for unknown nodes
        const keys = Object.keys(node).slice(0, 5).join(', ');
        console.error(`No emitter for node type: ${node.nodeType} (keys: ${keys})`);
        return '';
      }

      const emitterMethod = `emit${node.nodeType}`;
      if (typeof this[emitterMethod] === 'function') {
        return this[emitterMethod](node);
      }

      console.error(`No emitter for node type: ${node.nodeType}`);
      return `# Unknown node type: ${node.nodeType}`;
    }

    // ========================[ HELPERS ]========================

    indent() {
      return this.indentString.repeat(this.indentLevel);
    }

    line(content = '') {
      return content ? `${this.indent()}${content}${this.newline}` : this.newline;
    }

    /**
     * Generate stub base class package for framework classes
     * @param {string} className - The base class name to stub
     * @returns {string} Perl code defining the stub package
     */
    emitFrameworkBaseClassStub(className) {
      if (this.skipBaseStubs) {
        return ''; // Skip when test harness provides stubs
      }
      if (this.emittedBaseClassStubs.has(className)) {
        return ''; // Already emitted
      }
      this.emittedBaseClassStubs.add(className);

      let code = '';
      code += this.line(`package ${className};`);
      code += this.line('use strict;');
      code += this.line('use warnings;');
      code += this.newline;
      code += this.line('sub new {');
      this.indentLevel++;
      code += this.line('my $class = shift;');
      code += this.line('my $self = { @_ };');
      code += this.line('bless $self, $class;');
      code += this.line('return $self;');
      this.indentLevel--;
      code += this.line('}');
      code += this.newline;
      code += this.line('1;');
      code += this.newline;

      return code;
    }

    /**
     * Constructor bodies for framework helper (data) classes, mirroring the
     * exact positional parameter lists from AlgorithmFramework.js. These
     * classes are always instantiated with positional arguments
     * (new KeySize(16, 16, 1), new TestCase(input, expected, desc, uri),
     * ...), so the generic "my $self = { @_ }" stub is wrong here - it
     * treats the positional args as alternating hash key/value pairs,
     * silently corrupting every field (and warning "Odd number of
     * elements in anonymous hash" whenever there's an odd argument count).
     */
    static get FRAMEWORK_HELPER_CTOR_PARAMS() {
      return {
        // LinkItem(text, uri)
        LinkItem: ['text', 'uri'],
        // TestCase(input, expected, description = '', uri = '') extends LinkItem(description, uri)
        TestCase: ['input', 'expected', 'text', 'uri'],
        // Vulnerability(type, mitigation, uri = '') extends LinkItem(type, uri)
        Vulnerability: ['text', 'mitigation', 'uri'],
        // AuthResult(success, output = null, failureReason = null)
        AuthResult: ['Success', 'Output', 'FailureReason'],
        // KeySize(minSize, maxSize, stepSize = 1)
        KeySize: ['minSize', 'maxSize', 'stepSize'],
      };
    }

    /**
     * Emit all framework helper class stubs (LinkItem, TestCase, etc.)
     * These are simple data classes used by algorithm metadata
     * @returns {string} Perl code for all helper class stubs
     */
    emitAllFrameworkHelperStubs() {
      if (this.skipHelperStubs) {
        return ''; // Skip when test harness provides stubs
      }

      let code = '';
      const ctorParams = PerlEmitter.FRAMEWORK_HELPER_CTOR_PARAMS;

      for (const className of FRAMEWORK_HELPER_CLASSES) {
        if (this.emittedBaseClassStubs.has(className)) {
          continue; // Already emitted
        }
        this.emittedBaseClassStubs.add(className);

        code += this.line(`package ${className};`);
        code += this.line('use strict;');
        code += this.line('use warnings;');
        code += this.newline;
        code += this.line('sub new {');
        this.indentLevel++;
        code += this.line('my $class = shift;');
        const params = ctorParams[className];
        if (params) {
          code += this.line(`my (${params.map(p => '$' + p).join(', ')}) = @_;`);
          code += this.line('my $self = {');
          this.indentLevel++;
          for (const p of params) {
            code += this.line(`'${p}' => $${p},`);
          }
          this.indentLevel--;
          code += this.line('};');
        } else {
          code += this.line('my $self = { @_ };');
        }
        code += this.line('bless $self, $class;');
        code += this.line('return $self;');
        this.indentLevel--;
        code += this.line('}');
        code += this.newline;
        code += this.line('1;');
        code += this.newline;
      }

      return code;
    }

    /**
     * Inline Perl implementations of the OpCodes.js functions that don't
     * reduce to a simple inline expression (GetByte, GetBit, GF256Mul,
     * ...) and are therefore called via the OpCodes::<name> fallback in
     * PerlTransformer.js's transformOpCodesCall. Sub names are lowercased
     * with no separators, matching methodName.toLowerCase() there exactly.
     * Only emitted when that fallback is actually used (module.usesOpCodesRuntimeFallback).
     */
    emitOpCodesRuntimeStub() {
      let code = '';
      code += this.line('package OpCodes;');
      code += this.line('use strict;');
      code += this.line('use warnings;');
      // POSIX::fmod backs u32mask (see the "u32mask" sub below) - needed
      // unconditionally here since u32mask is emitted whenever this whole
      // stub package is (module.usesOpCodesRuntimeFallback), which is a
      // superset of "u32mask specifically is called".
      code += this.line('use POSIX qw(fmod);');
      code += this.newline;

      // Deliberately written WITHOUT Perl sub signatures (plain "my (...)
      // = @_;" unpacking) so this stub works regardless of whether the
      // surrounding file enabled the signatures feature.
      const subs = [
        ["getbyte", "$word, $byteIndex", "return ($word >> ($byteIndex * 8)) & 0xFF;"],
        ["setbyte", "$word, $byteIndex, $value",
          "my $shift = $byteIndex * 8; my $mask = (~(0xFF << $shift)) & 0xFFFFFFFF; return (($word & $mask) | (($value & 0xFF) << $shift)) & 0xFFFFFFFF;"],
        ["getbit", "$value, $bitIndex", "return ((($value >> $bitIndex) & 1) != 0) ? 1 : 0;"],
        ["setbit", "$value, $bitIndex, $bitValue",
          "return $bitValue ? (($value | (1 << $bitIndex)) & 0xFFFFFFFF) : (($value & ~(1 << $bitIndex)) & 0xFFFFFFFF);"],
        ["gf256mul", "$a, $b",
          "$a &= 0xFF; $b &= 0xFF; my $result = 0; " +
          "for (my $i = 0; $i < 8; $i++) { $result ^= $a if ($b & 1); my $hi = $a & 0x80; $a = ($a << 1) & 0xFF; $a ^= 0x1B if $hi; $b >>= 1; } " +
          "return $result & 0xFF;"],
        ["constanttimecompare", "$a, $b, $length",
          "$length = defined($length) ? $length : (scalar(@$a) < scalar(@$b) ? scalar(@$a) : scalar(@$b)); my $result = 0; " +
          "for (my $i = 0; $i < $length; $i++) { my $v1 = $i < scalar(@$a) ? $a->[$i] : 0; my $v2 = $i < scalar(@$b) ? $b->[$i] : 0; $result |= $v1 ^ $v2; } " +
          "$result |= scalar(@$a) ^ scalar(@$b); return ($result == 0) ? 1 : 0;"],
        ["securecompare", "$a, $b",
          "return 0 if scalar(@$a) != scalar(@$b); my $result = 0; " +
          "for (my $i = 0; $i < scalar(@$a); $i++) { $result |= $a->[$i] ^ $b->[$i]; } return ($result == 0) ? 1 : 0;"],
        ["concatarrays", "$arrays", "my @out; for my $arr (@$arrays) { push @out, @$arr; } return \\@out;"],
        ["arrayslice", "$arr, $start, $end",
          "$end = defined($end) ? $end : scalar(@$arr); my @result; " +
          "for (my $i = $start; $i < $end && $i < scalar(@$arr); $i++) { push @result, $arr->[$i]; } " +
          "return \\@result;"],
        ["createarray", "$length, $value", "$value = defined($value) ? $value : 0; return [($value) x $length];"],
        ["hex32todwords", "$hexString",
          "my @out; for (my $i = 0; $i < length($hexString); $i += 8) { push @out, hex(substr($hexString, $i, 8)); } return \\@out;"],
        // OpCodes.js's own DoubleToBytes is a cross-platform placeholder
        // that returns eight zero bytes - matched here for parity with
        // the JS reference test vectors were generated against.
        ["doubletobytes", "$value", "return [0, 0, 0, 0, 0, 0, 0, 0];"],
        ["touint16", "$value", "return $value & 0xFFFF;"],
        ["touint8", "$value", "return $value & 0xFF;"],
        ["bitmask", "$bits", "return 0xFFFFFFFF if $bits >= 32; return 0 if $bits <= 0; return (1 << $bits) - 1;"],
        ["popcount", "$value", "my $count = 0; while ($value) { $count += $value & 1; $value >>= 1; } return $count;"],
        ["popcountfast", "$value",
          "my $count = 0; $value &= 0xFFFFFFFF; while ($value) { $value &= $value - 1; $count++; } return $count;"],
        // 64-bit rotations assume a 64-bit native Perl integer (the
        // overwhelmingly common build on modern platforms); OpCodes.js
        // uses BigInt for these since JS numbers cap at 53 safe bits.
        ["rotl64n", "$value, $positions",
          "$positions &= 63; my $mask = 0xFFFFFFFFFFFFFFFF; $value &= $mask; return $value if $positions == 0; return (($value << $positions) | ($value >> (64 - $positions))) & $mask;"],
        ["rotr64n", "$value, $positions",
          "$positions &= 63; my $mask = 0xFFFFFFFFFFFFFFFF; $value &= $mask; return $value if $positions == 0; return (($value >> $positions) | ($value << (64 - $positions))) & $mask;"],
        // 128-bit rotations (OpCodes.RotL128n/RotR128n - block/present.js's
        // PRESENT-128 key-schedule rotate is the only current caller) -
        // unlike rotl64n/rotr64n above, 128 bits genuinely exceeds a native
        // Perl integer (64-bit), so this must go through Math::BigInt
        // rather than plain "&"/"<<"/">>" on a native scalar. "$value" may
        // already be a blessed Math::BigInt object (the common case here -
        // PRESENT-128's keyState is built up via the self-referential
        // shift-accumulate exact-precision path, see PerlTransformer.js's
        // transformAssignmentExpression) or a plain scalar; stringifying
        // through "Math::BigInt->new(\"$value\")" (interpolating via "" -
        // which calls the object's own bstr() if already blessed, or plain
        // Perl stringification of a scalar) normalizes either input into a
        // fresh, independent Math::BigInt copy the same way OpCodes::u64div
        // above does for its own "$a"/"$b" operands. ->copy() before each
        // of the two shifted halves is required because Math::BigInt's
        // blsft/brsft/band/bior all mutate their invocant in place (unlike
        // Perl's native operators) - reusing $v directly for both the left-
        // and right-shifted half would have the second shift operate on the
        // first shift's already-mutated result instead of the original
        // value.
        ["rotl128n", "$value, $positions",
          "my $v = Math::BigInt->new(\"$value\"); my $mask = Math::BigInt->new(1)->blsft(128)->bsub(1); $v->band($mask); $positions &= 127; return $v if $positions == 0; my $l = $v->copy()->blsft($positions); my $r = $v->copy()->brsft(128 - $positions); return $l->bior($r)->band($mask);"],
        ["rotr128n", "$value, $positions",
          "my $v = Math::BigInt->new(\"$value\"); my $mask = Math::BigInt->new(1)->blsft(128)->bsub(1); $v->band($mask); $positions &= 127; return $v if $positions == 0; my $r = $v->copy()->brsft($positions); my $l = $v->copy()->blsft(128 - $positions); return $r->bior($l)->band($mask);"],
        // 64-bit-safe add/sub for the BigInt hash/PRNG family (see
        // PerlTransformer.js's _u64SafeArithCall). Perl's native "+"/"-"
        // silently promote to a floating-point NV once the result exceeds
        // 64 bits, permanently losing precision (unlike JS BigInt, which is
        // exact at any size) - `use integer` forces exact 64-bit wraparound
        // (two's-complement) arithmetic instead, matching JS BigInt
        // arithmetic modulo 2**64. Lexically scoped to this sub body only,
        // so it doesn't affect the caller's shifts/rotations (which rely on
        // Perl's default *logical* >>/<< - `use integer` would make those
        // sign-extending instead, corrupting any value with bit 63 set).
        ["u64add", "$a, $b", "use integer; return $a + $b;"],
        ["u64sub", "$a, $b", "use integer; return $a - $b;"],
        ["u64mul", "$a, $b", "use integer; return $a * $b;"],
        // 64-bit-safe truncating division for the BigInt family (see
        // PerlTransformer.js's transformBinaryExpression '/' case). JS
        // BigInt "/" is exact arbitrary-precision division truncated
        // toward zero - Perl's native "/" always promotes to a
        // floating-point NV, even for plain-integer operands (e.g.
        // "1 / 18446744073709551557" silently becomes a nonzero float
        // like 5.4e-20 instead of the true integer quotient 0), which
        // then corrupts any "quotient == 0" zero-check downstream (see
        // random/wichmann-hill.js's/mwc.js's seed()-by-repeated-division
        // idiom). A plain `use integer; $a / $b` (matching u64add/u64sub/
        // u64mul above) doesn't work here the way it does for +/-/*:
        // `use integer` reinterprets any operand at or above 2**63 as a
        // *signed* 64-bit two's-complement value - and these moduli
        // (each within ~100 of 2**64) all have the top bit set, so e.g.
        // MODULUS_X (18446744073709551557) is treated as -59, turning
        // "12345 / MODULUS_X" (should truncate to 0) into "12345 / -59"
        // = -209. Math::BigInt does exact, unsigned-magnitude arbitrary-
        // precision division regardless of operand size, avoiding the
        // sign reinterpretation entirely; stringifying both operands
        // first via interpolation handles a $a/$b that's already a
        // blessed Math::BigInt object (from the '%'-of-'*' case in
        // PerlTransformer.js) the same as a plain scalar.
        // Returned via bstr() (a plain decimal-digit string), not the
        // blessed Math::BigInt object itself: this same helper is used for
        // *every* "/" in a BigInt-flagged file, including plain small-
        // number divisions that have nothing to do with 64-bit-prime LCG
        // seeding (e.g. hash/skein.js's "Math.ceil(outputBytes / 8)" word-
        // count calculation) - a blessed object reaching POSIX::ceil()
        // (which expects a plain numeric scalar) died "Usage:
        // POSIX::ceil(x)" instead of computing anything. A digit string
        // numifies correctly in any later numeric context (POSIX::ceil,
        // comparisons, further arithmetic) exactly like a plain integer,
        // and still round-trips exactly back through a later
        // "Math::BigInt->new(...)" (see _buildExactBigIntExpr) for chained
        // exact-precision use.
        ["u64div", "$a, $b", "return Math::BigInt->new(\"$a\")->bdiv(\"$b\")->bstr();"],

        // Modular arithmetic (OpCodes.AddMod/SubMod/MulMod) - straight
        // ports of OpCodes.js's own (a % m [+-*] b % m) % m formulas.
        ["addmod", "$a, $b, $m", "return (($a % $m) + ($b % $m)) % $m;"],
        ["submod", "$a, $b, $m", "return (($a % $m) - ($b % $m) + $m) % $m;"],
        ["mulmod", "$a, $b, $m", "return (($a % $m) * ($b % $m)) % $m;"],

        // Generic GF(2^n) multiplication with an explicit irreducible
        // polynomial and field width (OpCodes.GFMul - distinct from the
        // fixed GF(2^8)/AES-only gf256mul above).
        ["gfmul", "$a, $b, $irreducible, $width",
          "my $result = 0; my $mask = (1 << $width) - 1; " +
          "while ($b) { $result ^= $a if ($b & 1); $a <<= 1; $a ^= $irreducible if ($a & (1 << $width)); $a &= $mask; $b >>= 1; } " +
          "return $result;"],

        // GCM's GHASH field multiplication over GF(2^128) (OpCodes.GHashMul)
        // - a fixed-width 16-byte-array variant distinct from the
        // arbitrary-width scalar gfmul above (used by modes/gcm.js,
        // modes/gcm-siv.js, ...). Was entirely missing from this stub
        // package, so every call fell through to "Undefined subroutine
        // &OpCodes::ghashmul" - a straight line-for-line port of
        // OpCodes.js's own GHashMul (bit-at-a-time double-and-add over the
        // reduction polynomial x^128 + x^7 + x^2 + x + 1, i.e. the trailing
        // "^ 0xE1" reduction constant).
        ["ghashmul", "$x, $y",
          "my @z = (0) x 16; my @v = @$y; " +
          "for (my $i = 0; $i < 16; $i++) { my $xi = $x->[$i]; " +
          "for (my $j = 7; $j >= 0; $j--) { " +
          "if ($xi & (1 << $j)) { for (my $k = 0; $k < 16; $k++) { $z[$k] = ($z[$k] ^ $v[$k]) & 0xFF; } } " +
          "my $lsb = $v[15] & 1; " +
          "for (my $k = 15; $k >= 1; $k--) { $v[$k] = (($v[$k] >> 1) | (($v[$k-1] & 1) << 7)) & 0xFF; } " +
          "$v[0] = ($v[0] >> 1) & 0xFF; " +
          "if ($lsb != 0) { $v[0] = ($v[0] ^ 0xE1) & 0xFF; } } } " +
          "return \\@z;"],

        // High 32 bits of an unsigned 32x32->64-bit multiplication
        // (OpCodes.MulHi32). OpCodes.js splits into 16-bit halves purely to
        // dodge JS's 53-bit safe-integer ceiling - moot on Perl's native
        // (64-bit-on-any-modern-build) integers, so the product can just be
        // computed directly and shifted down.
        ["mulhi32", "$a, $b", "return ((($a & 0xFFFFFFFF) * ($b & 0xFFFFFFFF)) >> 32) & 0xFFFFFFFF;"],

        // Split a JS-number-range 64-bit value into {high32, low32}
        // (OpCodes.Split64) - returned as a hashref, matching every other
        // OpCodes stub here that returns a JS-object-shaped result (see
        // rotl64 below).
        ["split64", "$value",
          "my $low32 = $value & 0xFFFFFFFF; my $high32 = int($value / 4294967296) & 0xFFFFFFFF; " +
          "return { high32 => $high32, low32 => $low32 };"],

        // 8-byte little-endian message-bit-length encoding for MD5/SHA-1-
        // family Merkle-Damgard padding (OpCodes.EncodeMsgLength64LE).
        ["encodemsglength64le", "$bitLength",
          "my $low32 = $bitLength & 0xFFFFFFFF; my $high32 = int($bitLength / 4294967296) & 0xFFFFFFFF; " +
          "return [unpack('C4', pack('V', $low32)), unpack('C4', pack('V', $high32))];"],

        // Extract one bit from an arbitrary-width integer (OpCodes.GetBitN) -
        // OpCodes.js's BigInt-typed version exists only to go past 32 bits;
        // Perl's native integers already cover the same range this codebase
        // actually uses it for (PRNG/bit-serializer state).
        ["getbitn", "$value, $bitIndex", "return ($value >> $bitIndex) & 1;"],

        // Increment the last 4 bytes (big-endian, wrapping) of a 16-byte
        // GCM counter block in place (OpCodes.GCMIncrement).
        ["gcmincrement", "$counter",
          "my $carry = 1; for (my $i = 15; $i >= 12; $i--) { my $sum = $counter->[$i] + $carry; $counter->[$i] = $sum & 0xFF; $carry = $sum >> 8; } " +
          "return $counter;"],

        // Cryptographically-insecure placeholder (OpCodes.js has no
        // real SecureRandom implementation of its own either - see its
        // callers' "typeof OpCodes.SecureRandom" feature-detection) - only
        // reachable from this codebase's non-deterministic/non-testMode
        // code paths, which fixed test vectors never actually exercise.
        ["securerandom", "$bits", "return int(rand(256));"],

        // 32-bit words -> bytes, big-endian (OpCodes.Words32ToBytesBE).
        ["words32tobytesbe", "$words",
          "my @bytes; for my $word (@$words) { $word &= 0xFFFFFFFF; push @bytes, ($word >> 24) & 0xFF, ($word >> 16) & 0xFF, ($word >> 8) & 0xFF, $word & 0xFF; } " +
          "return \\@bytes;"],

        // Two-word (low/high 32-bit halves) 64-bit left rotation
        // (OpCodes.RotL64 - distinct from the single-BigInt-argument
        // rotl64n above) used by the Threefish family. Returns a hashref
        // {low, high}, mirroring OpCodes.js's own {low, high} object
        // return value.
        ["rotl64", "$low, $high, $positions",
          "$positions &= 63; $low &= 0xFFFFFFFF; $high &= 0xFFFFFFFF; " +
          "return { low => $low, high => $high } if $positions == 0; " +
          "my ($newLow, $newHigh); " +
          "if ($positions < 32) { " +
          "$newHigh = (($high << $positions) | ($low >> (32 - $positions))) & 0xFFFFFFFF; " +
          "$newLow = (($low << $positions) | ($high >> (32 - $positions))) & 0xFFFFFFFF; " +
          "} else { my $p2 = $positions - 32; " +
          "return { low => $high, high => $low } if $p2 == 0; " +
          "$newHigh = (($low << $p2) | ($high >> (32 - $p2))) & 0xFFFFFFFF; " +
          "$newLow = (($high << $p2) | ($low >> (32 - $p2))) & 0xFFFFFFFF; } " +
          "return { low => $newLow, high => $newHigh };"],

        // ----------------------------------------------------------------
        // The methods below are straight ports of the remaining OpCodes.js
        // top-level functions this codebase calls that aren't already
        // covered above or reduced to an inline Perl expression elsewhere
        // (transformOpCodesCall / the PackBytes/UnpackBytes/HexDecode/
        // RotateLeft/RotateRight IL-node cases). Normally those IL-node
        // cases catch a direct "OpCodes.Method(...)" call before it ever
        // reaches this runtime-fallback package - but a call through a
        // local OpCodes alias variable (see PerlTransformer.js's
        // opCodesAliasNames, e.g. "const OC = ...OpCodes...; OC.Hex8ToBytes(...)")
        // bypasses that upfront pattern-matching entirely and always ends
        // up here, so every OpCodes.js function needs a real fallback,
        // not just the ones that never had an inline shortcut.

        // Hex string -> byte array (OpCodes.Hex8ToBytes) - "f123" -> [0xf1, 0x23].
        ["hex8tobytes", "$hexString",
          "return [] if !defined($hexString) || $hexString eq ''; return [unpack('C*', pack('H*', $hexString))];"],

        // String <-> byte array (OpCodes.AnsiToBytes/AsciiToBytes/BytesToAnsi) -
        // all three treat each character as one byte (7-bit-masked for the
        // "Ansi" naming, 8-bit for "Ascii"), matching OpCodes.js exactly.
        ["ansitobytes", "$str", "return [map { ord($_) & 0x7F } split('', $str)];"],
        ["asciitobytes", "$str", "return [map { ord($_) & 0xFF } split('', $str)];"],
        ["bytestoansi", "$bytes", "return join('', map { chr($_ & 0x7F) } @$bytes);"],

        // Constant-time-shaped byte array equality (OpCodes.ArraysEqual).
        ["arraysequal", "$a, $b",
          "return 0 if scalar(@$a) != scalar(@$b); my $result = 0; " +
          "for (my $i = 0; $i < scalar(@$a); $i++) { $result |= $a->[$i] ^ $b->[$i]; } " +
          "return ($result == 0) ? 1 : 0;"],

        // Zero out an array in place (OpCodes.ClearArray).
        ["cleararray", "$arr", "\@$arr = (); return $arr;"],

        // XOR every element of an array with a single byte value (OpCodes.XorArrayWithByte).
        ["xorarraywithbyte", "$arr, $value",
          "my @out; for my $b (\@$arr) { push \@out, ($b ^ $value) & 0xFF; } return \\\@out;"],

        // 32-bit arithmetic/logic (OpCodes.Add32/Sub32/Mul32/Not32/And32/Or32/Xor32) -
        // all masked to stay within an unsigned 32-bit result, matching the
        // ">>> 0"/"Math.imul(...) >>> 0" JS originals.
        ["add32", "$a, $b", "return ($a + $b) & 0xFFFFFFFF;"],
        ["sub32", "$a, $b", "return ($a - $b) & 0xFFFFFFFF;"],
        ["mul32", "$a, $b", "use integer; return ($a * $b) & 0xFFFFFFFF;"],
        ["not32", "$a", "return (~$a) & 0xFFFFFFFF;"],
        ["and32", "$a, $b", "return ($a & $b) & 0xFFFFFFFF;"],
        ["or32", "$a, $b", "return ($a | $b) & 0xFFFFFFFF;"],
        ["xor32", "$a, $b", "return ($a ^ $b) & 0xFFFFFFFF;"],

        // 8/16-bit logic (OpCodes.And8/Or8/Xor8/And16/Or16/Xor16).
        ["and8", "$a, $b", "return ($a & $b) & 0xFF;"],
        ["or8", "$a, $b", "return ($a | $b) & 0xFF;"],
        ["xor8", "$a, $b", "return ($a ^ $b) & 0xFF;"],
        ["and16", "$a, $b", "return ($a & $b) & 0xFFFF;"],
        ["or16", "$a, $b", "return ($a | $b) & 0xFFFF;"],
        ["xor16", "$a, $b", "return ($a ^ $b) & 0xFFFF;"],

        // 8/16/32-bit shifts (OpCodes.Shl8/Shr8/Shl16/Shr16/Shl32/Shr32/Shr32Signed).
        // $positions is masked to the operand's own bit width (7/15/31)
        // *first*, matching the JS spec: "<<"/">>"/">>>" ALWAYS reduce
        // their shift-count operand via "ToUint32(positions) & 0x1F" (0xF/
        // 0x7 for 16-/8-bit) before shifting - so in real JS, shifting by
        // an amount at or beyond the operand's width wraps around instead
        // of vanishing to 0 (e.g. "8 >>> 32" is 8, not 0, since 32 & 0x1F
        // == 0). Perl's native ">>"/"<<" have no such masking (a 64-bit-
        // native "$value >> 32" truly shifts all 32 significant bits out,
        // giving 0) - this silently corrupted any code that (ab)uses this
        // JS wraparound intentionally, e.g. hash/groestl.js's finalize()
        // byte-serializing a 64-bit-*shaped* bit-length counter one byte
        // at a time via "OpCodes.Shr32(msgBitLength, i*8)" for i up to 7:
        // the upper "half" of that loop (shifts of 32-56) relies on the
        // wraparound to re-expose the low bits instead of reading zero.
        ["shl8", "$value, $positions", "return ($value << ($positions & 7)) & 0xFF;"],
        // Mask *before* shifting (not after) - see the '>>>' case in
        // PerlTransformer.js's transformBinaryExpression for why: a
        // negative $value shifted first pulls 1-bits down from Perl's
        // full 64-bit-wide unsigned view of a negative operand, which a
        // trailing mask can no longer remove once they're in the low bits.
        ["shr8", "$value, $positions", "return (($value & 0xFF) >> ($positions & 7)) & 0xFF;"],
        ["shl16", "$value, $positions", "return ($value << ($positions & 15)) & 0xFFFF;"],
        ["shr16", "$value, $positions", "return (($value & 0xFFFF) >> ($positions & 15)) & 0xFFFF;"],
        ["shl32", "$value, $positions", "return ($value << ($positions & 31)) & 0xFFFFFFFF;"],
        ["shr32", "$value, $positions", "return (($value & 0xFFFFFFFF) >> ($positions & 31)) & 0xFFFFFFFF;"],
        ["shr32signed", "$value, $positions",
          "my $v = $value & 0xFFFFFFFF; $v -= 0x100000000 if $v & 0x80000000; return ($v >> ($positions & 31)) & 0xFFFFFFFF;"],

        // 8/16-bit rotations (OpCodes.RotL8/RotR8/RotL16/RotR16 - RotL32/
        // RotR32 are handled inline via the RotateLeft/RotateRight IL node
        // for a direct "OpCodes.RotL32(...)" call, but still need a runtime
        // fallback here for the alias-call-site case described above).
        ["rotl8", "$value, $positions",
          "$value &= 0xFF; $positions &= 7; return (($value << $positions) | ($value >> (8 - $positions))) & 0xFF;"],
        ["rotr8", "$value, $positions",
          "$value &= 0xFF; $positions &= 7; return (($value >> $positions) | ($value << (8 - $positions))) & 0xFF;"],
        ["rotl16", "$value, $positions",
          "$value &= 0xFFFF; $positions &= 15; return (($value << $positions) | ($value >> (16 - $positions))) & 0xFFFF;"],
        ["rotr16", "$value, $positions",
          "$value &= 0xFFFF; $positions &= 15; return (($value >> $positions) | ($value << (16 - $positions))) & 0xFFFF;"],
        ["rotl32", "$value, $positions",
          "$value &= 0xFFFFFFFF; $positions &= 31; return (($value << $positions) | ($value >> (32 - $positions))) & 0xFFFFFFFF;"],
        ["rotr32", "$value, $positions",
          "$value &= 0xFFFFFFFF; $positions &= 31; return (($value >> $positions) | ($value << (32 - $positions))) & 0xFFFFFFFF;"],

        // Safely truncate a value to an unsigned 32-bit dword, mirroring
        // JS's ToUint32/">>> 0". A plain "$value & 0xFFFFFFFF" is exact
        // for a native Perl integer, but a value that derives from a
        // JS-semantics-preserving raw multiplication (see
        // PerlTransformer.js's transformBinaryExpression '*' case and
        // _forceDoubleMultiply's doc comment) was deliberately forced
        // through Perl floating-point (NV) arithmetic to reproduce the
        // IEEE-754 double rounding V8 applies to any "a * b" not routed
        // through Math.imul/OpCodes.Mul32 (JS numbers are always doubles,
        // silently losing precision once a product exceeds 2**53 - e.g.
        // two ~32-bit operands, product up to ~2**64). Converting such a
        // large NV back to an integer via Perl's native "&" is unreliable
        // in practice (observed to silently corrupt low-order bits for
        // NVs beyond roughly 2**53 on at least one tested Perl build - a
        // real conversion quirk, not merely redundant caution), whereas
        // POSIX::fmod operates purely in double space and reproduces the
        // exact mod-2**32 reduction ToUint32 performs. Only called from
        // the Cast IL node's 'uint32'/'int32' cases in PerlTransformer.js,
        // and only when the operand actually contains a forced-double
        // multiply (_containsForcedDoubleMultiply) - every OTHER uint32
        // truncation (the "todword"/"touint32" stubs just below, e.g.,
        // reached when OpCodes.ToDWord/ToUint32 is called on a plain
        // native-integer value like Whirlpool's "ToUint32(~pos)") stays on
        // the plain, exact "& 0xFFFFFFFF" path deliberately: routing an
        // already-exact large native integer (IV/UV, e.g. a 64-bit bitwise
        // complement) through this fmod-based helper would *introduce*
        // precision loss instead of avoiding it (an unwanted IV/UV -> NV
        // round-trip once the value exceeds 2**53) - exactly the
        // regression seen in hash/whirlpool.js when this was applied
        // unconditionally.
        ["u32mask", "$value", "my $v = fmod($value, 4294967296); $v += 4294967296 if $v < 0; return int($v);"],
        // Type conversions (OpCodes.ToByte/ToWord/ToDWord/ToInt/ToUint32/ToUint8).
        ["toint", "$value", "my $v = $value & 0xFFFFFFFF; $v -= 0x100000000 if $v & 0x80000000; return $v;"],
        ["todword", "$value", "return $value & 0xFFFFFFFF;"],
        ["toword", "$value", "return $value & 0xFFFF;"],
        ["touint32", "$value", "return $value & 0xFFFFFFFF;"],

        // 64-bit arithmetic on [HIGH, LOW] word-pairs, returned as a {h, l}
        // hashref matching OpCodes.js's own {h, l} object shape (OpCodes.
        // Add64_HL/Add3L64/Add3H64/RotR64_HL/RotL64_HL/Swap64_HL/Xor64_HL) -
        // used by the SHA-512/BLAKE2b/etc. hash family.
        ["add64_hl", "$ah, $al, $bh, $bl",
          "my $l = ($al & 0xFFFFFFFF) + ($bl & 0xFFFFFFFF); my $h = ($ah + $bh + (int($l / 4294967296))) & 0xFFFFFFFF; " +
          "return { h => $h, l => $l & 0xFFFFFFFF };"],
        ["add3l64", "$al, $bl, $cl", "return ($al & 0xFFFFFFFF) + ($bl & 0xFFFFFFFF) + ($cl & 0xFFFFFFFF);"],
        ["add3h64", "$lowSum, $ah, $bh, $ch",
          "return ($ah + $bh + $ch + int($lowSum / 4294967296)) & 0xFFFFFFFF;"],
        ["rotr64_hl", "$high, $low, $n",
          "$n &= 63; $high &= 0xFFFFFFFF; $low &= 0xFFFFFFFF; " +
          "return { h => $high, l => $low } if $n == 0; " +
          "return { h => $low, l => $high } if $n == 32; " +
          "if ($n < 32) { return { h => (($high >> $n) | ($low << (32 - $n))) & 0xFFFFFFFF, l => (($low >> $n) | ($high << (32 - $n))) & 0xFFFFFFFF }; } " +
          "my $n2 = $n - 32; return { h => (($low >> $n2) | ($high << (32 - $n2))) & 0xFFFFFFFF, l => (($high >> $n2) | ($low << (32 - $n2))) & 0xFFFFFFFF };"],
        ["rotl64_hl", "$high, $low, $n",
          "$n &= 63; $high &= 0xFFFFFFFF; $low &= 0xFFFFFFFF; " +
          "return { h => $high, l => $low } if $n == 0; " +
          "return { h => $low, l => $high } if $n == 32; " +
          "if ($n < 32) { return { h => (($high << $n) | ($low >> (32 - $n))) & 0xFFFFFFFF, l => (($low << $n) | ($high >> (32 - $n))) & 0xFFFFFFFF }; } " +
          "my $n2 = $n - 32; return { h => (($low << $n2) | ($high >> (32 - $n2))) & 0xFFFFFFFF, l => (($high << $n2) | ($low >> (32 - $n2))) & 0xFFFFFFFF };"],
        ["swap64_hl", "$high, $low", "return { h => $low & 0xFFFFFFFF, l => $high & 0xFFFFFFFF };"],
        ["xor64_hl", "$ah, $al, $bh, $bl", "return { h => ($ah ^ $bh) & 0xFFFFFFFF, l => ($al ^ $bl) & 0xFFFFFFFF };"],

        // Arbitrary-precision-integer bitwise ops (OpCodes.AndN/OrN/XorN) -
        // OpCodes.js's own versions exist purely to operate on JS BigInt
        // (which has no fixed width); Perl's "&"/"|"/"^" already work the
        // same way on plain integers/Math::BigInt objects without a width
        // mask, so these are direct passthroughs.
        ["andn", "$a, $b", "return $a & $b;"],
        ["orn", "$a, $b", "return $a | $b;"],
        ["xorn", "$a, $b", "return $a ^ $b;"],

        // Arbitrary-precision modular arithmetic (OpCodes.MulModN/SquareModN/
        // ModPowN/GcdN) - straight ports of the BigInt originals. Unlike
        // u64add/u64mul/addmod/mulmod above (which back genuinely fixed-
        // width 64-bit hash/rotate state, where wraparound at 2**64 IS the
        // desired semantics), these back JS's unbounded BigInt "**"/mod
        // arithmetic directly (e.g. random/blum-micali.js's Blum-Micali
        // generator: state = g^state mod p) - a native "use integer"
        // 64-bit-wraparound multiply silently truncates the moment either
        // operand approaches 64 bits (educational-but-realistic moduli like
        // blum-micali.js's own 3rd test vector, p=6364136223846793005,
        // ~2**62.5 - squaring a state near that magnitude needs ~125 bits),
        // producing a wrong (here, all-zero) result instead of the exact
        // value JS's BigInt computes and the test vectors were captured
        // from. Routed through Math::BigInt (already unconditionally
        // available - see emitOpCodesRuntimeStub's "use Math::BigInt;"
        // preamble - and already relied on by rotl128n/rotr128n/u64div just
        // above) for exact-precision multiply-then-mod regardless of
        // operand size; only 2 algorithms in this codebase call these
        // (both small-scale educational PRNGs, not real multi-thousand-bit
        // RSA/DH key generation), so the extra arbitrary-precision overhead
        // is negligible in practice.
        ["mulmodn", "$a, $b, $m", "return (Math::BigInt->new(\"$a\") * \"$b\") % \"$m\";"],
        ["squaremodn", "$a, $m", "my $r = Math::BigInt->new(\"$a\") % \"$m\"; return ($r * $r) % \"$m\";"],
        ["modpown", "$base, $exp, $m",
          "my $mm = Math::BigInt->new(\"$m\"); return Math::BigInt->new(0) if $mm == 1; " +
          "my $ee = Math::BigInt->new(\"$exp\"); return Math::BigInt->new(1) if $ee == 0; " +
          "my $result = Math::BigInt->new(1); my $bb = Math::BigInt->new(\"$base\") % $mm; " +
          "while ($ee > 0) { if ($ee->is_odd()) { $result = ($result * $bb) % $mm; } $ee = $ee >> 1; $bb = ($bb * $bb) % $mm; } " +
          "return $result;"],
        ["gcdn", "$a, $b",
          "$a = -$a if $a < 0; $b = -$b if $b < 0; " +
          "while ($b != 0) { my $t = $b; $b = $a % $b; $a = $t; } return $a;"],
        ["bitcountn", "$value",
          "return 1 if $value == 0; $value = -$value if $value < 0; my $count = 0; " +
          "while ($value > 0) { $count++; $value >>= 1; } return $count;"],

        // Byte<->word packing/unpacking (OpCodes.Pack16BE/LE, Pack32BE/LE,
        // Pack64LE, Unpack16BE/LE, Unpack32BE/LE, Unpack64BE) - a direct
        // "OpCodes.Pack32BE(...)" call is normally reduced inline via the
        // PackBytes/UnpackBytes IL node, but (as with the other entries in
        // this section) a call through a local alias variable bypasses
        // that and needs this fallback.
        ["pack16be", "\@b", "return ((($b[0] // 0) & 0xFF) << 8) | (($b[1] // 0) & 0xFF);"],
        ["pack16le", "\@b", "return ((($b[1] // 0) & 0xFF) << 8) | (($b[0] // 0) & 0xFF);"],
        ["pack32be", "\@b", "return ((($b[0] // 0) & 0xFF) << 24 | (($b[1] // 0) & 0xFF) << 16 | (($b[2] // 0) & 0xFF) << 8 | (($b[3] // 0) & 0xFF)) & 0xFFFFFFFF;"],
        ["pack32le", "\@b", "return ((($b[3] // 0) & 0xFF) << 24 | (($b[2] // 0) & 0xFF) << 16 | (($b[1] // 0) & 0xFF) << 8 | (($b[0] // 0) & 0xFF)) & 0xFFFFFFFF;"],
        ["pack64le", "\@b",
          "my $v = 0; for (my $i = 7; $i >= 0; $i--) { $v = ($v << 8) | (($b[$i] // 0) & 0xFF); } return $v;"],
        ["unpack16be", "$word", "$word &= 0xFFFF; return [($word >> 8) & 0xFF, $word & 0xFF];"],
        ["unpack16le", "$word", "$word &= 0xFFFF; return [$word & 0xFF, ($word >> 8) & 0xFF];"],
        ["unpack32be", "$word",
          "$word &= 0xFFFFFFFF; return [($word >> 24) & 0xFF, ($word >> 16) & 0xFF, ($word >> 8) & 0xFF, $word & 0xFF];"],
        ["unpack32le", "$word",
          "$word &= 0xFFFFFFFF; return [$word & 0xFF, ($word >> 8) & 0xFF, ($word >> 16) & 0xFF, ($word >> 24) & 0xFF];"],
        ["unpack64be", "$qword",
          "return [($qword >> 56) & 0xFF, ($qword >> 48) & 0xFF, ($qword >> 40) & 0xFF, ($qword >> 32) & 0xFF, " +
          "($qword >> 24) & 0xFF, ($qword >> 16) & 0xFF, ($qword >> 8) & 0xFF, $qword & 0xFF];"],

        // OpCodes.UInt64.<method>(...) sub-namespace (see
        // PerlTransformer.js's dedicated "OpCodes.UInt64.<method>(...)"
        // CallExpression handling, just above the plain OpCodes::<method>
        // fallback in transformCallExpression) - a [high32, low32] array-
        // pair representation of a 64-bit value, distinct from the {h, l}
        // hashref used by the *_HL family above. Naming mirrors that
        // handling exactly: "uint64" + lowercased method name.
        ["uint64create", "$high, $low", "return [($high // 0) & 0xFFFFFFFF, ($low // 0) & 0xFFFFFFFF];"],
        ["uint64frombytes", "$bytes",
          "my @b = @$bytes; while (scalar(@b) < 8) { unshift @b, 0; } " +
          "return [(($b[0] & 0xFF) << 24 | ($b[1] & 0xFF) << 16 | ($b[2] & 0xFF) << 8 | ($b[3] & 0xFF)) & 0xFFFFFFFF, " +
          "(($b[4] & 0xFF) << 24 | ($b[5] & 0xFF) << 16 | ($b[6] & 0xFF) << 8 | ($b[7] & 0xFF)) & 0xFFFFFFFF];"],
        ["uint64tobytes", "$a",
          "my ($hi, $lo) = @$a; return [($hi >> 24) & 0xFF, ($hi >> 16) & 0xFF, ($hi >> 8) & 0xFF, $hi & 0xFF, " +
          "($lo >> 24) & 0xFF, ($lo >> 16) & 0xFF, ($lo >> 8) & 0xFF, $lo & 0xFF];"],
        ["uint64fromuint16", "$words16",
          "my @w = @$words16; while (scalar(@w) < 4) { unshift @w, 0; } " +
          "return [(($w[0] & 0xFFFF) << 16) | ($w[1] & 0xFFFF), (($w[2] & 0xFFFF) << 16) | ($w[3] & 0xFFFF)];"],
        ["uint64touint16", "$a",
          "my ($hi, $lo) = @$a; return [($hi >> 16) & 0xFFFF, $hi & 0xFFFF, ($lo >> 16) & 0xFFFF, $lo & 0xFFFF];"],
        ["uint64fromuint32", "$words32",
          "my @w = @$words32; while (scalar(@w) < 2) { unshift @w, 0; } return [$w[0] & 0xFFFFFFFF, $w[1] & 0xFFFFFFFF];"],
        ["uint64touint32", "$a", "return [$a->[0], $a->[1]];"],
        ["uint64add", "$a, $b",
          "my $low = ($a->[1] + $b->[1]) & 0xFFFFFFFF; my $carry = (($a->[1] + $b->[1]) > 0xFFFFFFFF) ? 1 : 0; " +
          "my $high = ($a->[0] + $b->[0] + $carry) & 0xFFFFFFFF; return [$high, $low];"],
        ["uint64sub", "$a, $b",
          "my $borrow = ($a->[1] < $b->[1]) ? 1 : 0; my $low = ($a->[1] - $b->[1]) & 0xFFFFFFFF; " +
          "my $high = ($a->[0] - $b->[0] - $borrow) & 0xFFFFFFFF; return [$high, $low];"],
        ["uint64mul", "$a, $b",
          "my ($a0, $a1, $a2, $a3) = ($a->[1] & 0xFFFF, $a->[1] >> 16, $a->[0] & 0xFFFF, $a->[0] >> 16); " +
          "my ($b0, $b1, $b2, $b3) = ($b->[1] & 0xFFFF, $b->[1] >> 16, $b->[0] & 0xFFFF, $b->[0] >> 16); " +
          "my $c0 = $a0 * $b0; my $c1 = ($a1 * $b0 + $a0 * $b1 + ($c0 >> 16)) & 0xFFFFFFFF; " +
          "my $c2 = ($a2 * $b0 + $a1 * $b1 + $a0 * $b2 + ($c1 >> 16)) & 0xFFFFFFFF; " +
          "my $c3 = ($a3 * $b0 + $a2 * $b1 + $a1 * $b2 + $a0 * $b3 + ($c2 >> 16)) & 0xFFFFFFFF; " +
          "return [(($c3 & 0xFFFF) << 16 | ($c2 & 0xFFFF)) & 0xFFFFFFFF, (($c1 & 0xFFFF) << 16 | ($c0 & 0xFFFF)) & 0xFFFFFFFF];"],
        ["uint64rotr", "$a, $n",
          "return $a if $n == 0; $n = $n % 64; my ($hi, $lo) = @$a; " +
          "if ($n < 32) { return [(($hi >> $n) | (($lo << (32 - $n)) & 0xFFFFFFFF)) & 0xFFFFFFFF, (($lo >> $n) | (($hi << (32 - $n)) & 0xFFFFFFFF)) & 0xFFFFFFFF]; } " +
          "my $s = $n - 32; return [(($lo >> $s) | (($hi << (32 - $s)) & 0xFFFFFFFF)) & 0xFFFFFFFF, (($hi >> $s) | (($lo << (32 - $s)) & 0xFFFFFFFF)) & 0xFFFFFFFF];"],
        ["uint64rotl", "$a, $n", "return $a if $n == 0; return OpCodes::uint64rotr($a, 64 - ($n % 64));"],
        ["uint64shr", "$a, $n",
          "return $a if $n == 0; my ($hi, $lo) = @$a; " +
          "if ($n < 32) { return [($hi >> $n) & 0xFFFFFFFF, (($lo >> $n) | (($hi << (32 - $n)) & 0xFFFFFFFF)) & 0xFFFFFFFF]; } " +
          "return [0, ($hi >> ($n - 32)) & 0xFFFFFFFF];"],
        ["uint64shl", "$a, $n",
          "return $a if $n == 0; my ($hi, $lo) = @$a; " +
          "if ($n < 32) { return [(($hi << $n) | ($lo >> (32 - $n))) & 0xFFFFFFFF, ($lo << $n) & 0xFFFFFFFF]; } " +
          "return [($lo << ($n - 32)) & 0xFFFFFFFF, 0];"],
        ["uint64xor", "$a, $b", "return [($a->[0] ^ $b->[0]) & 0xFFFFFFFF, ($a->[1] ^ $b->[1]) & 0xFFFFFFFF];"],
        ["uint64and", "$a, $b", "return [($a->[0] & $b->[0]) & 0xFFFFFFFF, ($a->[1] & $b->[1]) & 0xFFFFFFFF];"],
        ["uint64or", "$a, $b", "return [($a->[0] | $b->[0]) & 0xFFFFFFFF, ($a->[1] | $b->[1]) & 0xFFFFFFFF];"],
        ["uint64not", "$a", "return [(~$a->[0]) & 0xFFFFFFFF, (~$a->[1]) & 0xFFFFFFFF];"],
        ["uint64tonumber", "$a", "return $a->[0] * 4294967296 + $a->[1];"],
        ["uint64fromnumber", "$num",
          "my $low = $num & 0xFFFFFFFF; my $high = int($num / 4294967296) & 0xFFFFFFFF; return [$high, $low];"],
        ["uint64equals", "$a, $b", "return ($a->[0] == $b->[0] && $a->[1] == $b->[1]) ? 1 : 0;"],
        ["uint64clone", "$a", "return [$a->[0], $a->[1]];"],
      ];

      for (const [name, params, body] of subs) {
        code += this.line(`sub ${name} {`);
        this.indentLevel++;
        code += this.line(`my (${params}) = @_;`);
        code += this.line(body);
        this.indentLevel--;
        code += this.line('}');
        code += this.newline;
      }

      code += this.line('1;');
      code += this.newline;
      return code;
    }

    /**
     * Inline Perl port of OpCodes.js's stateful "_BitStream" helper class
     * (a bit-level I/O buffer used by compression/bitstream-oriented
     * algorithms, e.g. compression/golomb-bitstream.js's
     * "OpCodes.CreateBitStream()" - see the matching comment at
     * transformOpCodesCall's 'CreateBitStream' case). Only emitted when
     * that constructor is actually used (module.usesBitStreamClass).
     * Straight method-for-method port of the JS original; state kept as a
     * blessed hashref (buffer/bufferBits/byteArray/readPosition/
     * totalBitsWritten), mirroring the JS instance's own fields exactly.
     */
    emitBitStreamClass() {
      let code = '';
      code += this.line('package _OpCodesBitStream;');
      code += this.line('use strict;');
      code += this.line('use warnings;');
      code += this.newline;

      const methods = [
        ["new", "$class, $initialBytes",
          "my $self = { buffer => 0, bufferBits => 0, byteArray => [], readPosition => 0, totalBitsWritten => 0 }; " +
          "if ($initialBytes && scalar(@$initialBytes) > 0) { " +
          "$self->{byteArray} = [@$initialBytes]; $self->{totalBitsWritten} = scalar(@$initialBytes) * 8; } " +
          "bless $self, $class; return $self;"],

        ["writeBits", "$self, $value, $numBits",
          "die 'BitStream.writeBits: numBits must be 1-32' if $numBits <= 0 || $numBits > 32; " +
          "my $mask = $numBits == 32 ? 0xFFFFFFFF : (1 << $numBits) - 1; $value = $value & $mask; " +
          "$self->{buffer} = ($self->{buffer} << $numBits) | $value; " +
          "$self->{bufferBits} += $numBits; $self->{totalBitsWritten} += $numBits; " +
          "while ($self->{bufferBits} >= 8) { " +
          "$self->{bufferBits} -= 8; " +
          "my $byte = ($self->{buffer} >> $self->{bufferBits}) & 0xFF; " +
          "push @{$self->{byteArray}}, $byte; " +
          "if ($self->{bufferBits} > 0) { my $remMask = (1 << $self->{bufferBits}) - 1; $self->{buffer} &= $remMask; } " +
          "else { $self->{buffer} = 0; } }"],
        ["writeBit", "$self, $bit", "$self->writeBits($bit & 1, 1);"],
        ["writeByte", "$self, $byte", "$self->writeBits($byte & 0xFF, 8);"],
        ["writeBytes", "$self, $bytes", "for my $b (@$bytes) { $self->writeByte($b); }"],

        ["readBits", "$self, $numBits",
          "die 'BitStream.readBits: numBits must be 1-32' if $numBits <= 0 || $numBits > 32; " +
          "my $result = 0; my $bitsRead = 0; " +
          "while ($bitsRead < $numBits) { " +
          "my $byteIndex = int($self->{readPosition} / 8); my $bitOffset = $self->{readPosition} % 8; " +
          "if ($byteIndex >= scalar(@{$self->{byteArray}})) { " +
          "die 'BitStream.readBits: No more data available' if $bitsRead == 0; last; } " +
          "my $currentByte = $self->{byteArray}->[$byteIndex]; my $availableBits = 8 - $bitOffset; " +
          "my $bitsToRead = ($numBits - $bitsRead) < $availableBits ? ($numBits - $bitsRead) : $availableBits; " +
          "my $mask = (1 << $bitsToRead) - 1; " +
          "my $extractedBits = ($currentByte >> ($availableBits - $bitsToRead)) & $mask; " +
          "$result = ($result << $bitsToRead) | $extractedBits; " +
          "$bitsRead += $bitsToRead; $self->{readPosition} += $bitsToRead; } " +
          "return $result;"],
        ["readBit", "$self", "return $self->readBits(1);"],
        ["readByte", "$self", "return $self->readBits(8) & 0xFF;"],
        ["readBytes", "$self, $count",
          "my @bytes; for (my $i = 0; $i < $count; $i++) { push @bytes, $self->readByte(); } return \\@bytes;"],

        ["peekBits", "$self, $numBits",
          "my $saved = $self->{readPosition}; my $result = $self->readBits($numBits); " +
          "$self->{readPosition} = $saved; return $result;"],
        ["skipBits", "$self, $numBits",
          "$self->{readPosition} += $numBits; my $maxPos = scalar(@{$self->{byteArray}}) * 8; " +
          "$self->{readPosition} = $maxPos if $self->{readPosition} > $maxPos;"],
        ["hasMoreBits", "$self", "return ($self->{readPosition} < scalar(@{$self->{byteArray}}) * 8) ? 1 : 0;"],
        ["getRemainingBits", "$self",
          "my $rem = scalar(@{$self->{byteArray}}) * 8 - $self->{readPosition}; return $rem > 0 ? $rem : 0;"],
        ["resetReadPosition", "$self", "$self->{readPosition} = 0;"],
        ["seekBits", "$self, $bitOffset",
          "my $maxBits = scalar(@{$self->{byteArray}}) * 8; my $offset = $bitOffset & 0x7FFFFFFF; " +
          "my $clamped = $offset > $maxBits ? $maxBits : $offset; $self->{readPosition} = $clamped > 0 ? $clamped : 0;"],

        ["toArray", "$self, $padLastByte",
          "$padLastByte = 1 if !defined($padLastByte); " +
          "if ($self->{bufferBits} > 0 && $padLastByte) { " +
          "my $paddingBits = 8 - $self->{bufferBits}; $self->{buffer} = $self->{buffer} << $paddingBits; " +
          "push @{$self->{byteArray}}, $self->{buffer} & 0xFF; $self->{buffer} = 0; $self->{bufferBits} = 0; } " +
          "return [@{$self->{byteArray}}];"],
        ["getBitLength", "$self", "return $self->{totalBitsWritten};"],
        ["getByteLength", "$self",
          "my $complete = int($self->{bufferBits} / 8); my $partial = ($self->{bufferBits} % 8) > 0 ? 1 : 0; " +
          "return scalar(@{$self->{byteArray}}) + $complete + $partial;"],
        ["clear", "$self",
          "$self->{buffer} = 0; $self->{bufferBits} = 0; $self->{byteArray} = []; " +
          "$self->{readPosition} = 0; $self->{totalBitsWritten} = 0;"],
        ["clone", "$self",
          "my $c = { buffer => $self->{buffer}, bufferBits => $self->{bufferBits}, " +
          "byteArray => [@{$self->{byteArray}}], readPosition => $self->{readPosition}, " +
          "totalBitsWritten => $self->{totalBitsWritten} }; bless $c, ref($self); return $c;"],

        ["writeVarInt", "$self, $value",
          "$value = $value & 0xFFFFFFFF; " +
          "while ($value >= 0x80) { $self->writeByte(($value & 0x7F) | 0x80); $value = ($value >> 7) & 0xFFFFFFFF; } " +
          "$self->writeByte($value & 0x7F);"],
        ["readVarInt", "$self",
          "my $result = 0; my $shift = 0; my $byte; " +
          "do { die 'BitStream.readVarInt: Integer overflow' if $shift >= 32; " +
          "$byte = $self->readByte(); $result |= (($byte & 0x7F) << $shift); $shift += 7; } while ($byte & 0x80); " +
          "return $result & 0xFFFFFFFF;"],
        ["writeUnary", "$self, $value",
          "for (my $i = 0; $i < $value; $i++) { $self->writeBit(1); } $self->writeBit(0);"],
        ["readUnary", "$self",
          "my $count = 0; while ($self->hasMoreBits() && $self->readBit() == 1) { $count++; } return $count;"],
        ["alignToByte", "$self", "while ($self->{bufferBits} % 8 != 0) { $self->writeBit(0); }"],
      ];

      for (const [name, params, body] of methods) {
        code += this.line(`sub ${name} {`);
        this.indentLevel++;
        code += this.line(`my (${params}) = @_;`);
        code += this.line(body);
        this.indentLevel--;
        code += this.line('}');
        code += this.newline;
      }

      code += this.line('1;');
      code += this.newline;
      return code;
    }

    /**
     * Tied-array package backing "typedArray.subarray(begin, end)" (see the
     * 'TypedArraySubarray' case in PerlTransformer.js). A JS TypedArray
     * subarray is a *view* over its parent's buffer - reads and (crucially)
     * writes alias the parent. Perl has no native array-slice view, so this
     * ties a fresh lexical array to a {parent, begin, len} record: FETCH/
     * STORE index into the parent arrayref at $begin+$idx. SPLICE is
     * required explicitly - Perl's tie protocol does NOT synthesize it from
     * FETCH/STORE/FETCHSIZE/STORESIZE the way it does for some other
     * optional methods; without it, "splice(@$view, ...)" (which is exactly
     * what the TypedArraySet '.set()' case lowers to, e.g. block/crypton.js's
     * key-schedule "dKey.subarray(destIndex, destIndex + 4).set(tmpOut)")
     * dies "Can't locate object method "SPLICE" via package
     * _JSSubarrayView". Implemented by delegating to a real splice() on the
     * (untied, plain-array) parent at the view's offset, which handles
     * growing/shrinking correctly for free.
     * Only emitted when the source actually uses subarray() (module.usesSubarrayView).
     */
    emitSubarrayViewClass() {
      let code = '';
      code += this.line('package _JSSubarrayView;');
      code += this.line('use strict;');
      code += this.line('use warnings;');
      code += this.newline;

      const methods = [
        ["TIEARRAY", "$class, $parent, $begin, $len",
          "return bless { parent => $parent, begin => $begin, len => $len }, $class;"],
        ["FETCH", "$self, $idx", "return $self->{parent}[$self->{begin} + $idx];"],
        ["STORE", "$self, $idx, $val", "return $self->{parent}[$self->{begin} + $idx] = $val;"],
        ["FETCHSIZE", "$self", "return $self->{len};"],
        ["STORESIZE", "$self, $newLen", "$self->{len} = $newLen;"],
        ["EXISTS", "$self, $idx", "return ($idx >= 0 && $idx < $self->{len}) ? 1 : 0;"],
        ["DELETE", "$self, $idx",
          "my $old = $self->{parent}[$self->{begin} + $idx]; $self->{parent}[$self->{begin} + $idx] = undef; return $old;"],
        ["CLEAR", "$self",
          "for (my $i = 0; $i < $self->{len}; $i++) { $self->{parent}[$self->{begin} + $i] = undef; }"],
        ["EXTEND", "$self, $newLen", "return;"],
        ["SPLICE", "$self, $offset, $length, @list",
          "$offset //= 0; $offset += $self->{len} if $offset < 0; $offset = 0 if $offset < 0; $offset = $self->{len} if $offset > $self->{len}; $length = $self->{len} - $offset unless defined $length; $length = 0 if $length < 0; $length = $self->{len} - $offset if $length > $self->{len} - $offset; my @removed = @{$self->{parent}}[map { $self->{begin} + $offset + $_ } (0 .. $length - 1)]; splice(@{$self->{parent}}, $self->{begin} + $offset, $length, @list); $self->{len} += scalar(@list) - $length; return @removed;"],
      ];

      for (const [name, params, body] of methods) {
        code += this.line(`sub ${name} {`);
        this.indentLevel++;
        code += this.line(`my (${params}) = @_;`);
        code += this.line(body);
        this.indentLevel--;
        code += this.line('}');
        code += this.newline;
      }

      code += this.line('1;');
      code += this.newline;
      return code;
    }

    // ========================[ MODULE ]========================

    emitModule(node) {
      let code = '';

      // Package declaration
      if (node.packageName && node.packageName !== 'main') {
        code += this.line(`package ${node.packageName};`);
        code += this.newline;
      }

      // Pragmas
      for (const pragma of node.pragmas) {
        code += this.line(`${pragma};`);
      }
      if (node.pragmas.length > 0) {
        code += this.newline;
      }

      // Use declarations
      for (const use of node.uses) {
        code += this.emit(use);
      }
      if (node.uses.length > 0) {
        code += this.newline;
      }

      // Emit framework helper class stubs at the start of the module
      // These are needed by generated code that instantiates framework types
      const stubsEmittedBefore = this.emittedBaseClassStubs.size;
      code += this.emitAllFrameworkHelperStubs();
      const helperStubsEmitted = this.emittedBaseClassStubs.size > stubsEmittedBefore;

      // Each helper stub above is its own `package Foo; ... 1;` block. Perl
      // packages stay in effect until the next package statement, so without
      // an explicit reset here, everything that follows (top-level subs,
      // vars, and the RegisterAlgorithm stub below) would silently be bound
      // into the last helper package instead of main.
      if (helperStubsEmitted) {
        code += this.line('package main;');
        code += this.newline;
      }

      // Emit the inline OpCodes runtime package backing OpCodes::<name>
      // fallback calls, when the source actually uses one (see
      // transformOpCodesCall / module.usesOpCodesRuntimeFallback).
      //
      // Deliberately NOT gated by skipHelperStubs (unlike every other
      // helper stub below): skipHelperStubs exists so a multi-file bundle
      // (see measure_pl.js's dependency bundling) only emits ONE copy of
      // *stateful* bookkeeping packages, whose state a later redefinition
      // would silently reset (e.g. "our @_registered_algorithms" - see
      // measure_pl.js's doc comment on skipHelperStubs). The OpCodes
      // package holds no state at all - just static "sub name { ... }"
      // definitions - so redefining it per bundled file is harmless (at
      // worst a "Subroutine X redefined" warning), and skipping it
      // entirely for a dependency that itself calls OpCodes::gf256mul/etc.
      // (e.g. a mode-of-operation test bundled ahead of its block-cipher
      // dependency, where only the *dependency* actually needs a runtime
      // OpCodes fallback method, not the primary file) left those calls
      // dangling as "Undefined subroutine &OpCodes::gf256mul".
      if (node.usesOpCodesRuntimeFallback) {
        code += this.emitOpCodesRuntimeStub();
        code += this.line('package main;');
        code += this.newline;
      }

      // Emit the _OpCodesBitStream package backing "OpCodes.CreateBitStream(...)"
      // (see PerlTransformer.js's transformOpCodesCall / module.usesBitStreamClass).
      if (node.usesBitStreamClass) {
        code += this.emitBitStreamClass();
        code += this.line('package main;');
        code += this.newline;
      }

      // Emit the _JSSubarrayView tied-array package backing
      // "typedArray.subarray(...)" (see PerlTransformer.js's
      // 'TypedArraySubarray' case / module.usesSubarrayView).
      if (node.usesSubarrayView) {
        code += this.emitSubarrayViewClass();
        code += this.line('package main;');
        code += this.newline;
      }

      // Emit a RegisterAlgorithm() stub when the source calls it. The real
      // AlgorithmFramework registry does not exist in standalone transpiled
      // output, so this just records every registered instance into a
      // package-global array a test harness can enumerate afterwards
      // (files can register more than one algorithm variant, e.g. BLAKE2b
      // and BLAKE2s from the same source file).
      if (node.usesRegisterAlgorithm && !this.skipHelperStubs) {
        code += this.line('our @_registered_algorithms;');
        code += this.line('sub RegisterAlgorithm {');
        this.indentLevel++;
        code += this.line('push @_registered_algorithms, $_[0];');
        code += this.line('return $_[0];');
        this.indentLevel--;
        code += this.line('}');
        code += this.newline;
      }

      // Emit an AlgorithmFramework::Find() stub when the source calls it -
      // the lazy "already registered?" lookup used by require()-guarded
      // dependency loaders (see type-aware-transpiler.js
      // _stripRequireGuardedBlocks, which rescues these from being stubbed
      // out entirely). Backed by the same @_registered_algorithms array the
      // RegisterAlgorithm stub above populates (in package main, regardless
      // of which bundled source file's RegisterAlgorithm call added an
      // entry - see measure_pl.js dependency bundling), matched by the
      // registered instance's 'name' field.
      if (node.usesAlgorithmFrameworkFind && !this.skipHelperStubs) {
        code += this.line('package AlgorithmFramework;');
        code += this.line('sub Find {');
        this.indentLevel++;
        code += this.line('my $name = $_[-1];');
        code += this.line('for my $alg (@main::_registered_algorithms) {');
        this.indentLevel++;
        code += this.line('return $alg if ref($alg) && exists $alg->{\'name\'} && $alg->{\'name\'} eq $name;');
        this.indentLevel--;
        code += this.line('}');
        code += this.line('return undef;');
        this.indentLevel--;
        code += this.line('}');
        code += this.line('1;');
        code += this.line('package main;');
        code += this.newline;
      }

      // Emit the _LegacyAlgoObj AUTOLOAD-dispatch package when the source
      // bundles a legacy "const X = { name: ..., CreateInstance: function(){...} }"
      // object-literal algorithm (as opposed to a proper class) - such
      // objects are blessed into this package (see
      // PerlTransformer.transformObjectExpression/ObjectCreate and
      // module.usesLegacyAlgoObj) purely so "$x->Method(...)" call syntax
      // resolves; there are no real package-level subs, every "method" is a
      // coderef stashed under that key in the hash itself (mirroring how the
      // JS object literal's methods are just its own properties), so AUTOLOAD
      // dispatches to $self->{$name}->($self, @args) instead.
      if (node.usesLegacyAlgoObj && !this.skipHelperStubs) {
        code += this.line('package _LegacyAlgoObj;');
        code += this.line('our $AUTOLOAD;');
        code += this.line('sub AUTOLOAD {');
        this.indentLevel++;
        code += this.line('my $self = shift;');
        code += this.line('my $name = $AUTOLOAD;');
        code += this.line('$name =~ s/.*:://;');
        code += this.line('return if $name eq \'DESTROY\';');
        code += this.line('my $fn = ref($self) ? $self->{$name} : undef;');
        code += this.line('return $fn->($self, @_) if ref($fn) eq \'CODE\';');
        code += this.line('die qq{Can\'t locate object method "$name" via package "_LegacyAlgoObj"};');
        this.indentLevel--;
        code += this.line('}');
        code += this.line('sub can {');
        this.indentLevel++;
        code += this.line('my ($self, $name) = @_;');
        code += this.line('return (ref($self) && ref($self->{$name}) eq \'CODE\') ? 1 : 0;');
        this.indentLevel--;
        code += this.line('}');
        code += this.line('1;');
        code += this.line('package main;');
        code += this.newline;
      }

      // Reorder statements: emit declarations in order that respects dependencies
      // Perl doesn't hoist, so class definitions must come before code that instantiates them
      const simpleVarDecls = [];   // Variables without class constructor calls
      const classInstVarDecls = []; // Variables that call class constructors (e.g., Foo->new())
      const classDefs = [];
      const subDefs = [];
      const otherStmts = [];

      // Helper to check if a node contains a class constructor call (->new())
      const containsConstructorCall = (node) => {
        if (!node) return false;
        // Check for MemberAccess with ->new() call pattern
        // e.g., { nodeType: 'MemberAccess', member: { nodeType: 'Call', callee: { name: 'new' } } }
        if (node.nodeType === 'MemberAccess' && node.member) {
          if (node.member.nodeType === 'Call' && node.member.callee?.name === 'new') return true;
          // Recursively check member
          if (containsConstructorCall(node.member)) return true;
        }
        // Check for direct method call pattern
        if (node.nodeType === 'MethodCall' && node.method === 'new') return true;
        if (node.nodeType === 'Call' && node.callee) {
          // Check for Foo->new() pattern which shows as method call on identifier
          if (node.callee.name === 'new') return true;
          if (node.callee.nodeType === 'MemberAccess' && node.callee.member === 'new') return true;
        }
        // Check initializer for constructor calls
        if (node.initializer) return containsConstructorCall(node.initializer);
        // Check object and arguments
        if (node.object) return containsConstructorCall(node.object);
        if (node.arguments) return node.arguments.some(a => containsConstructorCall(a));
        if (node.args) return node.args.some(a => containsConstructorCall(a));
        if (node.callee) return containsConstructorCall(node.callee);
        return false;
      };

      for (const stmt of node.statements) {
        if (stmt.nodeType === 'VarDeclaration') {
          // Check if the variable initialization involves a class constructor
          if (containsConstructorCall(stmt)) {
            classInstVarDecls.push(stmt);
          } else {
            simpleVarDecls.push(stmt);
          }
        } else if (stmt.nodeType === 'Class')
          classDefs.push(stmt);
        else if (stmt.nodeType === 'Sub')
          subDefs.push(stmt);
        else
          otherStmts.push(stmt);
      }

      // Emit in order:
      // 1. Simple variables (no class constructor calls)
      // 2. Subs (functions)
      // 3. Classes (must be before code that instantiates them)
      // 4. Variables with class constructor calls (after classes are defined)
      // 5. Other statements
      for (const stmt of simpleVarDecls) {
        code += this.emit(stmt);
        code += this.newline;
      }

      for (const stmt of subDefs) {
        code += this.emit(stmt);
        code += this.newline;
      }

      for (const stmt of classDefs) {
        code += this.emit(stmt);
        code += this.newline;
      }

      // After classes, switch back to main package for remaining statements
      // This is needed because Perl packages have implicit scope until the next package declaration
      if (classDefs.length > 0 && (classInstVarDecls.length > 0 || otherStmts.length > 0)) {
        code += this.line('package main;');
        code += this.newline;
      }

      for (const stmt of classInstVarDecls) {
        code += this.emit(stmt);
        code += this.newline;
      }

      for (const stmt of otherStmts) {
        code += this.emit(stmt);
        code += this.newline;
      }

      // End with 1; for modules
      if (node.packageName && node.packageName !== 'main') {
        code += this.newline + this.line('1;');
      }

      return code;
    }

    emitUse(node) {
      let code = node.isRequire ? 'require ' : 'use ';
      code += node.module;

      if (node.version) {
        code += ' ' + node.version;
      }

      if (node.imports && Array.isArray(node.imports)) {
        code += ' qw(' + node.imports.join(' ') + ')';
      }

      return this.line(code + ';');
    }

    // ========================[ PACKAGE/CLASS ]========================

    emitPackage(node) {
      let code = this.line(`package ${node.name};`);
      code += this.newline;

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      for (const stmt of node.statements) {
        code += this.emit(stmt);
      }

      code += this.newline + this.line('1;');

      return code;
    }

    emitClass(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      if (node.useModernClass) {
        // Emit stub base class if needed (for framework classes)
        if (node.baseClass && FRAMEWORK_BASE_CLASSES.has(node.baseClass)) {
          code += this.emitFrameworkBaseClassStub(node.baseClass);
        }

        // ES2022 "static NAME = ..." class fields - see the blessed-hashref
        // branch's matching comment below for why these can't be per-instance
        // fields. Emitted ahead of the class block as plain fully-qualified
        // package-variable assignments (Perl 5.38+ "class" blocks have no
        // static-field syntax of their own).
        for (const field of node.staticFields || []) {
          const value = field.defaultValue ? this.emit(field.defaultValue) : 'undef';
          code += this.line(`$${node.name}::${field.name} = ${value};`);
        }

        // ES2022 "static { ... }" class initializer block - see the
        // blessed-hashref branch's matching comment.
        if (node.staticInitStatements && node.staticInitStatements.length > 0) {
          code += this.emitBlockContents({ statements: node.staticInitStatements });
        }

        // Modern Perl 5.38+ class syntax
        code += this.line(`class ${node.name}`);
        if (node.baseClass) {
          code += ' :isa(' + node.baseClass + ')';
        }
        code += ' {' + this.newline;

        this.indentLevel++;

        // Fields
        for (const field of node.fields) {
          code += this.emit(field);
        }

        if (node.fields.length > 0 && node.methods.length > 0) {
          code += this.newline;
        }

        // Methods
        for (const method of node.methods) {
          code += this.emit(method);
          code += this.newline;
        }

        this.indentLevel--;
        code += this.line('}');
      } else {
        // Blessed hashref OO (zero external dependencies)

        // Emit stub base class if needed (for framework classes)
        if (node.baseClass && FRAMEWORK_BASE_CLASSES.has(node.baseClass)) {
          code += this.emitFrameworkBaseClassStub(node.baseClass);
        }

        code += this.line(`package ${node.name};`);
        code += this.line('use strict;');
        code += this.line('use warnings;');

        if (node.baseClass) {
          // Always use @ISA for inheritance - all classes are defined in same file
          // (use parent tries to load .pm file from @INC which doesn't exist)
          code += this.line(`our @ISA = qw(${node.baseClass});`);
        }

        // ES2022 "static NAME = ..." class fields (see PerlTransformer.js
        // transformClassDeclaration's FieldDefinition/staticFields comment) -
        // emitted once as a package variable, fully qualified so "use
        // strict" never complains regardless of declaration order, and
        // matching the $ClassName::name read/write side already produced by
        // transformMemberExpression/transformAssignmentExpression's
        // _isClassStaticField branches (e.g. "Gift128Instance.RC[round]" ->
        // "$Gift128Instance::RC->[$round]").
        for (const field of node.staticFields || []) {
          const value = field.defaultValue ? this.emit(field.defaultValue) : 'undef';
          code += this.line(`$${node.name}::${field.name} = ${value};`);
        }

        // ES2022 "static { ... }" class initializer block (e.g. block/aria.js's
        // "static { AriaInstance.SB3 = ...; AriaInstance.SB4 = ...; }", which
        // derives SB3/SB4 from SB1/SB2 at load time) - runs once, right after
        // the static field defaults above so it can read them, and before any
        // method executes since these are plain top-level package statements.
        if (node.staticInitStatements && node.staticInitStatements.length > 0) {
          code += this.emitBlockContents({ statements: node.staticInitStatements });
        }

        code += this.newline;

        // Find existing constructor in methods
        const hasConstructor = node.methods.some(m => m.name === 'new');

        // Generate default constructor if none exists
        if (!hasConstructor) {
          const hasBuild = node.methods.some(m => m.name === 'BUILD');

          code += this.line('sub new {');
          this.indentLevel++;
          code += this.line('my $class = shift;');

          // Always bless a fresh hashref directly, rather than chaining
          // through SUPER::new(@_): the framework base-class stubs only
          // know the generic "$self = { @_ }" pattern, which corrupts
          // positional constructor arguments (e.g. TEAInstance->new($algo,
          // $isInverse)) into bogus hash-key/value pairs. Field
          // initialization instead flows entirely through BUILD, which
          // chains into the parent's own BUILD via SUPER::BUILD when the
          // parent is a real class with a constructor of its own (see
          // PerlTransformer.js transformSuperCallsForBuild).
          code += this.line('my $self = {};');
          code += this.line('bless $self, $class;');

          // Set field defaults
          for (const field of node.fields) {
            if (field.defaultValue) {
              const emittedDefault = this.emit(field.defaultValue);
              code += this.line(`$self->{${field.name}} //= ${emittedDefault};`);
            }
          }

          if (hasBuild) {
            code += this.line('$self->BUILD(@_);');
          }

          code += this.line('return $self;');
          this.indentLevel--;
          code += this.line('}');
          code += this.newline;
        }

        // Generate accessors for fields
        for (const field of node.fields) {
          code += this.emitFieldAsAccessor(field);
        }

        if (node.fields.length > 0 && node.methods.length > 0) {
          code += this.newline;
        }

        // Methods
        for (const method of node.methods) {
          code += this.emit(method);
          code += this.newline;
        }

        code += this.line('1;');
      }

      return code;
    }

    emitField(node) {
      // For modern class keyword
      let code = this.indent() + 'field $' + node.name;

      if (node.defaultValue) {
        code += ' = ' + this.emit(node.defaultValue);
      }

      return code + ';' + this.newline;
    }

    emitFieldAsMoo(node) {
      // For Moo/Moose (deprecated - use emitFieldAsAccessor instead)
      let code = this.line(`has ${node.name} => (`);
      this.indentLevel++;

      code += this.line('is => ' + (node.isReadOnly ? '"ro"' : '"rw"') + ',');

      if (node.type) {
        code += this.line(`isa => ${node.type.toString()},`);
      }

      if (node.defaultValue) {
        const emittedDefault = this.emit(node.defaultValue);
        // If default references $self, wrap in sub { } since $self doesn't exist at definition time
        if (/\$self\b/.test(emittedDefault)) {
          // Replace $self with shift-> for the closure
          const closureDefault = emittedDefault.replace(/\$self->/g, 'shift->');
          code += this.line('default => sub { ' + closureDefault + ' },');
        } else {
          code += this.line('default => ' + emittedDefault + ',');
        }
      }

      if (node.isRequired) {
        code += this.line('required => 1,');
      }

      this.indentLevel--;
      code += this.line(');');

      return code;
    }

    emitFieldAsAccessor(node) {
      // Blessed hashref accessor (zero dependencies)
      let code = '';

      if (node.isReadOnly) {
        // Read-only accessor
        code += this.line(`sub ${node.name} {`);
        this.indentLevel++;
        code += this.line('my $self = shift;');
        code += this.line(`return $self->{${node.name}};`);
        this.indentLevel--;
        code += this.line('}');
      } else {
        // Read-write accessor
        code += this.line(`sub ${node.name} {`);
        this.indentLevel++;
        code += this.line('my $self = shift;');
        code += this.line(`if (@_) { $self->{${node.name}} = shift; }`);
        code += this.line(`return $self->{${node.name}};`);
        this.indentLevel--;
        code += this.line('}');
      }

      return code;
    }

    // ========================[ SUBROUTINES ]========================

    emitSub(node) {
      let code = '';

      if (node.docComment) {
        code += this.emit(node.docComment);
      }

      // Subroutine declaration
      let decl = 'sub ' + node.name;

      if (node.useSignatures && node.parameters.length > 0) {
        // Modern Perl signatures
        const params = node.parameters.map(p => this.emitParameterSignature(p));
        decl += ' (' + params.join(', ') + ')';
      }

      code += this.line(decl + ' {');

      this.indentLevel++;

      // Traditional parameter extraction if not using signatures
      if (!node.useSignatures && node.parameters.length > 0) {
        const params = node.parameters.map((p, i) => {
          return `my ${p.sigil}${p.name} = $_[${i}];`;
        });
        code += this.line(params.join(' '));
        code += this.newline;
      }

      // Body
      if (node.body) {
        code += this.emitBlockContents(node.body);
      }

      this.indentLevel--;
      code += this.line('}');

      return code;
    }

    emitParameterSignature(node) {
      let param = node.sigil + node.name;

      if (node.defaultValue) {
        param += ' = ' + this.emit(node.defaultValue);
      }

      return param;
    }

    // ========================[ STATEMENTS ]========================

    emitBlock(node) {
      // Optional label (e.g. "SW1: { ... }") - used by transformSwitchStatement
      // to give a switch's bare block a "last"/"next" target so JS's
      // fall-through switch semantics (see that method's doc comment) can
      // jump out of the whole switch from a 'break' at any nesting depth
      // within a case, exactly like JS's break-exits-the-switch behavior.
      let code = this.line((node.label ? node.label + ': ' : '') + '{');
      this.indentLevel++;
      code += this.emitBlockContents(node);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitBlockContents(node) {
      let code = '';

      if (!node || !node.statements) {
        return code;
      }

      for (const stmt of node.statements) {
        // Handle arrays of statements (e.g., from transformLetStatement)
        if (Array.isArray(stmt)) {
          for (const s of stmt) {
            code += this.emit(s);
          }
        } else {
          code += this.emit(stmt);
        }
      }

      return code;
    }

    emitVarDeclaration(node) {
      // For 'our' declarations with initializers, split into declaration + assignment
      // This ensures the variable is visible inside closures within the initializer
      // (Perl doesn't make 'our $x' visible in 'our $x = sub { $x }' initializer)
      if (node.declarator === 'our' && node.initializer) {
        let code = this.line(node.declarator + ' ' + node.sigil + node.name + ';');
        code += this.line(node.sigil + node.name + ' = ' + this.emit(node.initializer) + ';');
        return code;
      }

      let code = node.declarator + ' ' + node.sigil + node.name;

      if (node.initializer) {
        code += ' = ' + this.emit(node.initializer);
      }

      return this.line(code + ';');
    }

    emitExpressionStatement(node) {
      return this.line(this.emit(node.expression) + ';');
    }

    emitReturn(node) {
      if (node.expression) {
        return this.line('return ' + this.emit(node.expression) + ';');
      }
      return this.line('return;');
    }

    emitIf(node) {
      const keyword = node.isUnless ? 'unless' : 'if';
      let code = this.line(keyword + ' (' + this.emit(node.condition) + ') {');

      this.indentLevel++;
      code += this.emitBlockContents(node.thenBranch);
      this.indentLevel--;
      code += this.line('}');

      // elsif branches (array format)
      if (node.elsifBranches) {
        for (const elsif of node.elsifBranches) {
          code = code.trimEnd();
          code += ' elsif (' + this.emit(elsif.condition) + ') {' + this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(elsif.body);
          this.indentLevel--;
          code += this.line('}');
        }
      }

      // else branch - can be a PerlBlock or another PerlIf (for switch chains)
      if (node.elseBranch) {
        // Check if elseBranch is another PerlIf node (from switch statement transform)
        if (node.elseBranch.nodeType === 'If') {
          // Emit as elsif, then recurse for remaining chain
          code = code.trimEnd();
          code += ' elsif (' + this.emit(node.elseBranch.condition) + ') {' + this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(node.elseBranch.thenBranch);
          this.indentLevel--;
          code += this.line('}');
          // Recursively handle the rest of the chain
          if (node.elseBranch.elseBranch) {
            // Create a temporary node to handle the remaining chain
            const remainingChain = node.elseBranch;
            while (remainingChain.elseBranch) {
              if (remainingChain.elseBranch.nodeType === 'If') {
                code = code.trimEnd();
                code += ' elsif (' + this.emit(remainingChain.elseBranch.condition) + ') {' + this.newline;
                this.indentLevel++;
                code += this.emitBlockContents(remainingChain.elseBranch.thenBranch);
                this.indentLevel--;
                code += this.line('}');
                remainingChain.elseBranch = remainingChain.elseBranch.elseBranch;
              } else {
                // Final else block
                code = code.trimEnd();
                code += ' else {' + this.newline;
                this.indentLevel++;
                code += this.emitBlockContents(remainingChain.elseBranch);
                this.indentLevel--;
                code += this.line('}');
                break;
              }
            }
          }
        } else {
          // Regular else block (PerlBlock)
          code = code.trimEnd();
          code += ' else {' + this.newline;
          this.indentLevel++;
          code += this.emitBlockContents(node.elseBranch);
          this.indentLevel--;
          code += this.line('}');
        }
      }

      return code;
    }

    emitFor(node) {
      if (node.isCStyle) {
        // C-style for loop
        let code = 'for (';
        if (node.init) {
          // Handle multiple variable declarations in for init
          // JavaScript: for (let r = 0, k = 0; ...) -> Perl: for (my ($r, $k) = (0, 0); ...)
          if (Array.isArray(node.init) && node.init.length > 1) {
            // Multiple declarations - combine into single my (...) = (...)
            const names = node.init.map(n => '$' + n.name);
            const values = node.init.map(n => n.initializer ? this.emit(n.initializer) : 'undef');
            code += `my (${names.join(', ')}) = (${values.join(', ')})`;
          } else {
            // Single declaration or expression - emit normally
            let initCode = this.emit(node.init).trim();
            // Strip trailing semicolons to avoid double semicolons in for-loop syntax
            code += initCode.replace(/;+\s*$/, '');
          }
        }
        code += '; ';
        if (node.condition) code += this.emit(node.condition);
        code += '; ';
        if (node.increment) code += this.emit(node.increment);
        code += ') {';
        code = this.line(code);
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line('}');

        return code;
      }

      // foreach loop
      let iterableCode = this.emit(node.iterable).trim();
      // If iterable is a simple scalar (starts with $, doesn't contain function/block syntax),
      // wrap in @{ } for dereferencing
      // This converts: foreach my $byte ($data) -> foreach my $byte (@{$data})
      let foreachIterable = iterableCode;
      // Only wrap if it's a simple scalar or hash access - not complex expressions like map {...}
      const isSimpleScalar = iterableCode.startsWith('$') && !iterableCode.includes('{');
      const isHashAccess = iterableCode.startsWith('$') && /^\$[a-zA-Z_][a-zA-Z0-9_]*->\{/.test(iterableCode);
      // An anonymous array-*literal* iterable (starts with "[", e.g. the
      // "[map { [$_, $obj->{$_}] } sort {...} keys %{$obj}]" this codebase's
      // Object.entries()/Object.keys() translation produces - see
      // transformForOfStatement's doc comment on the destructuring "for
      // (const [char, freq] of Object.entries(frequencies))" shape) is
      // itself just a single arrayref VALUE, not a LIST - "foreach my $x
      // ([...])" iterates that ref exactly ONCE (one loop iteration, $x
      // bound to the whole ref) instead of once per element. Needing
      // dereferencing here is easy to miss because it doesn't fail loudly:
      // compression/huffman.js's frequency-table walk silently built a
      // 1-node Huffman heap from an int()-on-a-stringified-reference
      // garble instead of raising any error, corrupting the encoded output
      // instead of crashing. "@{ [...] }" dereferences the literal back
      // into its element list, same as the "$scalar" case just below.
      const isArrayLiteral = iterableCode.startsWith('[');
      if ((isSimpleScalar || isHashAccess) && !iterableCode.startsWith('@{')) {
        // Scalar variable or hash reference - needs dereferencing for list context.
        // The transform layer's isStringType/isArrayType static heuristics
        // (PerlTransformer.js's transformForOfStatement) can't always tell
        // whether a bare parameter/property (e.g. a "key" arg that's really
        // a plain string, not a byte array) will hold a string or an array
        // ref at runtime - JS's "for (const c of x)" is valid for both, but
        // Perl's array-deref and string-split are different operations.
        // Guessing "array" unconditionally used to blow up at runtime with
        // "Not an ARRAY reference" / "Can't use string ... as an ARRAY ref"
        // whenever the guess was wrong (this was the single largest class
        // of Perl transpile runtime failures). Deciding at *runtime* via
        // ref() instead removes the guess entirely: an actual array ref
        // derefs exactly as before, and anything else (string/undef) is
        // split into characters, matching JS's for-of-over-string semantics.
        foreachIterable = `(ref(${iterableCode}) eq 'ARRAY' ? @{${iterableCode}} : split(//, ${iterableCode}))`;
      } else if (isArrayLiteral) {
        foreachIterable = `@{${iterableCode}}`;
      }

      let code = this.line('foreach my ' + node.variable + ' (' + foreachIterable + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhile(node) {
      const keyword = node.isUntil ? 'until' : 'while';

      if (node.isDoWhile) {
        // NOT emitted as Perl's own "do { BODY } while (COND);" - that's a
        // well-known Perl gotcha: unlike a real "while"/"for" loop, a
        // "do {} while" block is NOT a loop from the perspective of
        // last/next/redo - those loop-control keywords, if used anywhere
        // inside BODY (even indirectly, e.g. a JS "do { ...; if (ok) break;
        // ... } while (true);" rejection-sampling idiom - see mac/vmac.js's
        // L3-key derivation, which retries an AES call until the output
        // falls in range), target the NEAREST ENCLOSING REAL loop instead -
        // typically whatever "for"/"while" this do-while is itself nested
        // inside. A "last" meant to exit only the do-while's own retry loop
        // silently exited the OUTER loop instead, skipping every statement
        // after the do-while in the same outer-loop iteration (vmac.js's
        // "this.l3Key.push(k0, k1);", right after the do-while) - a
        // structurally-empty/all-undef this.l3Key was the visible symptom,
        // corrupting every VMAC tag including the empty-message vector.
        // Translating to "while (1) { BODY } continue { last unless
        // (COND); }" instead is semantically identical for a body with no
        // break/continue (BODY always runs at least once, then loops while
        // COND holds), but now IS a genuine Perl loop: last/next inside
        // BODY correctly target only this loop. Perl's "continue" block
        // runs after BODY on every pass - including one reached via "next"
        // - before the condition is re-tested, matching JS's do-while
        // "continue" semantics (jumps to the condition check, not past it).
        let code = this.line('while (1) {');
        this.indentLevel++;
        code += this.emitBlockContents(node.body);
        this.indentLevel--;
        code += this.line('} continue {');
        this.indentLevel++;
        code += this.line('last ' + (node.isUntil ? 'if' : 'unless') + ' (' + this.emit(node.condition) + ');');
        this.indentLevel--;
        code += this.line('}');
        return code;
      }

      let code = this.line(keyword + ' (' + this.emit(node.condition) + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitLast(node) {
      let code = 'last';
      if (node.label) {
        code += ' ' + node.label;
      }
      return this.line(code + ';');
    }

    emitNext(node) {
      let code = 'next';
      if (node.label) {
        code += ' ' + node.label;
      }
      return this.line(code + ';');
    }

    emitRedo(node) {
      let code = 'redo';
      if (node.label) {
        code += ' ' + node.label;
      }
      return this.line(code + ';');
    }

    emitDie(node) {
      return this.line('die ' + this.emit(node.message) + ';');
    }

    /**
     * Does executing this statement, in normal (non-throwing) control flow,
     * unconditionally reach a Return (or a Die, which - inside the eval this
     * feeds - aborts the eval the same way a return-propagation guard would
     * skip over) before falling off the end? Stops at nested Sub/AnonSub
     * boundaries (a nested function's own return doesn't return from the
     * enclosing one). See emitTry's call site for why this matters: Perl's
     * "return" inside "eval { }" only exits the eval block itself (per
     * perldoc -f return: eval is one of the few constructs "return" can
     * exit besides a subroutine) - it does NOT also return from the
     * enclosing sub the way a JS "try { ...; return x; }" does. A
     * transpiled "try { compute(); return x; } catch (e) { ...; throw e; }"
     * was therefore silently discarding its return value: the eval block
     * evaluated to x internally, but the enclosing sub fell through with no
     * explicit return, yielding undef/empty-list to its caller.
     * @param {object} stmt
     * @returns {boolean}
     */
    _stmtAlwaysReturns(stmt) {
      if (!stmt) return false;
      switch (stmt.nodeType) {
        case 'Return':
        case 'Die':
          return true;
        case 'Block':
          return this._blockAlwaysReturns(stmt);
        case 'If': {
          if (!this._blockAlwaysReturns(stmt.thenBranch)) return false;
          if (stmt.elsifBranches) {
            for (const elsif of stmt.elsifBranches) {
              if (!this._blockAlwaysReturns(elsif.body)) return false;
            }
          }
          if (!stmt.elseBranch) return false;
          // elseBranch may itself be a chained PerlIf (switch-statement
          // transform), not a plain PerlBlock - see emitIf.
          return stmt.elseBranch.nodeType === 'If'
            ? this._stmtAlwaysReturns(stmt.elseBranch)
            : this._blockAlwaysReturns(stmt.elseBranch);
        }
        case 'Try':
          // A nested try/catch is itself fixed up by this same emitTry
          // treatment (each Try node is emitted independently), so by the
          // time it runs, its own normal-flow return already propagates
          // out as a real "return" - safe to treat as a terminal return
          // here too.
          return this._blockAlwaysReturns(stmt.tryBlock) &&
            (!stmt.catchBlock || this._blockAlwaysReturns(stmt.catchBlock));
        default:
          return false;
      }
    }

    /**
     * @param {object} blockNode PerlBlock ({ statements: [...] })
     * @returns {boolean}
     */
    _blockAlwaysReturns(blockNode) {
      if (!blockNode || !blockNode.statements) return false;
      return blockNode.statements.some(s => {
        if (Array.isArray(s)) return s.some(ss => this._stmtAlwaysReturns(ss));
        return this._stmtAlwaysReturns(s);
      });
    }

    emitTry(node) {
      // Use eval-based error handling for maximum Perl compatibility
      // This works on all Perl versions without requiring modules or features

      // If the try block unconditionally returns in its normal (non-throwing)
      // flow, capture the eval's own value (which "return" inside the eval
      // already correctly produces) and re-emit it as a real "return" from
      // the enclosing sub once we're back outside the eval - see
      // _stmtAlwaysReturns's doc comment for why this is otherwise silently
      // lost. Skipped when the try block doesn't provably always return, to
      // avoid returning early on a path that should merely fall through to
      // whatever code follows the try/catch.
      const alwaysReturns = this._blockAlwaysReturns(node.tryBlock);
      const tmpVar = alwaysReturns ? '$__try_result_' + (this._tryResultCounter = (this._tryResultCounter || 0) + 1) : null;

      let code = this.line((tmpVar ? `my ${tmpVar} = ` : '') + 'eval {');
      this.indentLevel++;
      code += this.emitBlockContents(node.tryBlock);
      this.indentLevel--;
      code += this.line('};');

      if (node.catchBlock) {
        code += this.line('if ($@) {');
        this.indentLevel++;
        // Capture the error in the catch variable
        const catchVar = node.catchVariable || '$_error';
        code += this.line(`my ${catchVar} = $@;`);
        code += this.emitBlockContents(node.catchBlock);
        this.indentLevel--;
        code += this.line('}');
      }

      // Note: Perl's eval doesn't have finally, but we can simulate by always running
      if (node.finallyBlock) {
        code += this.emitBlockContents(node.finallyBlock);
      }

      if (tmpVar) {
        code += this.line(`return ${tmpVar} unless $@;`);
      }

      return code;
    }


    emitGiven(node) {
      let code = this.line('given (' + this.emit(node.expression) + ') {');
      this.indentLevel++;

      for (const whenClause of node.whenClauses) {
        code += this.emit(whenClause);
      }

      if (node.defaultClause) {
        code += this.line('default {');
        this.indentLevel++;
        code += this.emitBlockContents(node.defaultClause);
        this.indentLevel--;
        code += this.line('}');
      }

      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    emitWhen(node) {
      let code = this.line('when (' + this.emit(node.condition) + ') {');
      this.indentLevel++;
      code += this.emitBlockContents(node.body);
      this.indentLevel--;
      code += this.line('}');
      return code;
    }

    // ========================[ EXPRESSIONS ]========================

    emitLiteral(node) {
      if (node.literalType === 'undef') {
        return 'undef';
      }

      if (node.literalType === 'number') {
        // Large-integer-valued doubles (e.g. a 64-bit IV constant like
        // 0x80400c0600000000, which - having 32 trailing zero bits - is
        // still exactly representable as an IEEE double even past
        // Number.MAX_SAFE_INTEGER) must NOT be stringified with JS's
        // default decimal String(value): that produces the *shortest*
        // decimal string that round-trips back to the same double when
        // RE-PARSED AS A DOUBLE (e.g. "9241399655273595000" for the exact
        // integer 9241399655273594880) - a 120-off approximation, not the
        // exact value. Perl parses a bare integer literal exactly as
        // written (promoting to UV, not rounding through NV) - so passing
        // that decimal string straight through corrupted every large
        // masked/rotated constant built from such a literal (silently
        // wrong low bits after "& 0xFFFFFFFF", e.g. Ascon's IV words).
        // BigInt(value) recovers the double's exact mathematical value
        // (safe for any finite integer-valued double - that's exactly
        // when Number.isInteger is true), so stringifying through BigInt
        // instead reproduces precisely what the JS source intended.
        if (typeof node.value === 'bigint') return node.value.toString();
        if (typeof node.value === 'number' && Number.isFinite(node.value) && Number.isInteger(node.value)) {
          return BigInt(node.value).toString();
        }
        return String(node.value);
      }

      if (node.literalType === 'hex') {
        return '0x' + node.value.toString(16).toUpperCase();
      }

      if (node.literalType === 'string') {
        let delimiter = node.stringDelimiter || "'";

        // Empty-pattern regex literal (used by split() with no separator,
        // e.g. PerlLiteral.String('', "//") for "split into characters") -
        // must render as a literal // token, not '' wrapped in "//...//".
        if (delimiter === '//')
          return '//';

        let escaped = String(node.value);

        if (delimiter === '"') {
          // Double-quoted string - escape special chars
          escaped = escaped
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/\$/g, '\\$')
            .replace(/@/g, '\\@');
        } else {
          // Single-quoted string - Perl only allows \\ and \' at end of string
          // If string contains single quotes, switch to double quotes
          if (escaped.includes("'")) {
            delimiter = '"';
            escaped = escaped
              .replace(/\\/g, '\\\\')
              .replace(/"/g, '\\"')
              .replace(/\$/g, '\\$')
              .replace(/@/g, '\\@');
          } else {
            escaped = escaped.replace(/\\/g, '\\\\');
          }
        }

        return delimiter + escaped + delimiter;
      }

      return String(node.value);
    }

    emitGrouped(node) {
      const inner = this.emit(node.expression);
      return `(${inner})`;
    }

    emitIdentifier(node) {
      return node.sigil + node.name;
    }

    // Operator precedence for Perl (higher number = higher precedence)
    // Based on Perl precedence: https://perldoc.perl.org/perlop
    getOperatorPrecedence(op) {
      const precedence = {
        // Assignment (lowest)
        '=': 1, '+=': 1, '-=': 1, '*=': 1, '/=': 1, '|=': 1, '&=': 1, '^=': 1, '<<=': 1, '>>=': 1,
        // Ternary
        '?:': 2,
        // Logical or
        '||': 3, '//': 3,
        // Logical and
        '&&': 4,
        // Bitwise or
        '|': 5,
        // Bitwise xor
        '^': 6,
        // Bitwise and
        '&': 7,
        // Equality
        '==': 8, '!=': 8, 'eq': 8, 'ne': 8, '<=>': 8, 'cmp': 8,
        // Comparison
        '<': 9, '>': 9, '<=': 9, '>=': 9, 'lt': 9, 'gt': 9, 'le': 9, 'ge': 9,
        // Shift
        '<<': 10, '>>': 10,
        // Addition
        '+': 11, '-': 11, '.': 11,
        // Multiplication
        '*': 12, '/': 12, '%': 12, 'x': 12,
        // Exponentiation
        '**': 13,
        // Unary (highest)
        '~': 14, '!': 14,
        // Pattern match (binds looser than unary/**, tighter than */%x -
        // see perlop's precedence table)
        '=~': 12.5, '!~': 12.5
      };
      return precedence[op] || 0;
    }

    emitBinaryExpression(node) {
      const parentPrecedence = this.getOperatorPrecedence(node.operator);

      // A ternary (PerlConditional, nodeType 'Conditional') or an assignment
      // (PerlAssignment, nodeType 'Assignment') used as an operand always
      // needs parens here: Perl's "?:" and "=" both bind looser than every
      // binary operator (precedence 2 and 1 respectively, below even "||"),
      // so e.g. JS's explicitly-parenthesized "a + (b < c ? 1 : 0)" - if
      // emitted as bare "$a + $b < $c ? 1 : 0" - reparses in Perl as
      // "(($a + $b) < $c) ? 1 : 0", silently changing which value the "+"
      // and "?:" apply to (this is exactly how SipHash's add64() carry
      // computation broke: "a[1] + b[1] + (low < a[0] ? 1 : 0)" lost its
      // inner parens). Assignment-as-operand is already guarded at the
      // transform layer (see transformBinaryExpression's explicit
      // PerlGrouped wrap) but is checked again here defensively since this
      // precedence table is the single source of truth for what needs
      // wrapping and BinaryExpression isn't the only lower-precedence node
      // type that can appear as an operand.
      const LOWER_PRECEDENCE_NODE_TYPES = new Set(['Conditional', 'Assignment']);

      // Wrap left operand if it has lower precedence
      let left = this.emit(node.left);
      if (node.left && node.left.nodeType === 'BinaryExpression') {
        const leftPrecedence = this.getOperatorPrecedence(node.left.operator);
        if (leftPrecedence < parentPrecedence)
          left = `(${left})`;
      } else if (node.left && LOWER_PRECEDENCE_NODE_TYPES.has(node.left.nodeType)) {
        left = `(${left})`;
      }

      // Wrap right operand if it has lower or equal precedence (for right-associativity safety)
      let right = this.emit(node.right);
      if (node.right && node.right.nodeType === 'BinaryExpression') {
        const rightPrecedence = this.getOperatorPrecedence(node.right.operator);
        if (rightPrecedence <= parentPrecedence)
          right = `(${right})`;
      } else if (node.right && LOWER_PRECEDENCE_NODE_TYPES.has(node.right.nodeType)) {
        right = `(${right})`;
      }

      return `${left} ${node.operator} ${right}`;
    }

    emitUnaryExpression(node) {
      let operand = this.emit(node.operand);

      // Perl's unary "!"/"-"/"~" bind tighter than every binary operator
      // (they're precedence 14 here, the highest), unlike some of what a
      // naive JS->Perl transliteration might assume. Emitting the operand
      // without parens when it's itself a binary expression silently
      // changes what the operator applies to - e.g. "!ref($x) eq 'ARRAY'"
      // parses as "(!ref($x)) eq 'ARRAY'", not "!(ref($x) eq 'ARRAY')" as
      // the source JS ("!Array.isArray(x)") intended.
      if ((node.operator === '!' || node.operator === '-' || node.operator === '~') &&
          node.operand && node.operand.nodeType === 'BinaryExpression') {
        operand = `(${operand})`;
      }

      if (node.isPrefix) {
        // For @, %, and $# operators (array/hash dereference, and
        // last-index-of-array), we need special handling. "$#" is the same
        // dereferencing-sigil shape as "@"/"%" (it needs "$#{EXPR}" braces
        // around anything but a bare scalar variable) - without sharing
        // this branch, "$#" fell through to the generic prefix case below
        // and e.g. "$#$self->{'state'}" was emitted for arr.slice(n) on a
        // "this.state" field. That's not "last index of the arrayref at
        // $self->{'state'}" as intended - Perl parses the "->" as binding
        // to the *result* of "$#$self" instead ("(last index of @$self)
        // ->{'state'}"), which doesn't even parse as a hash/array
        // dereference of a defined value, dying at runtime.
        if (node.operator === '@' || node.operator === '%' || node.operator === '$#') {
          // Anonymous array/hash refs need wrapping: @[1,2,3] -> @{[1,2,3]}
          if (operand.startsWith('[') || operand.startsWith('{')) {
            return `${node.operator}{${operand}}`;
          }
          // Block-style function calls (map/grep/sort/do) need parentheses to disambiguate
          // @{do{...}} is ambiguous and resolved to @do{...} (hash slice) even with space
          // Use @{(do {...})} to force correct parsing
          // IMPORTANT: Check this BEFORE -> check, because do{} blocks may contain -> inside them
          if (/^(map|grep|sort|reverse|do)\b/.test(operand)) {
            return `${node.operator}{(${operand})}`;
          }
          // Complex expressions need wrapping: @$arr->[$i] -> @{$arr->[$i]}
          // Check if operand contains -> (subscript/method access)
          if (operand.includes('->')) {
            return `${node.operator}{${operand}}`;
          }
          // Function calls need wrapping: @Hp(...) -> @{Hp(...)}. Includes
          // package-qualified calls (e.g. "main::swapMask64(...)", emitted
          // for every top-level helper function call from inside a class's
          // "package Foo;" block - see transformCallExpression's
          // functionNames handling) - without allowing "::" in the name
          // here, "@main::swapMask64(...)" was emitted unwrapped, a hard
          // Perl syntax error ("@" can only prefix an array variable or a
          // "{...}"-braced dereference, never a bareword function call).
          if (/^[A-Za-z_][A-Za-z0-9_]*(::[A-Za-z_][A-Za-z0-9_]*)*\(/.test(operand)) {
            return `${node.operator}{${operand}}`;
          }
          // Already-parenthesized/grouped expression (e.g. a PerlGrouped
          // wrapping a "do {...}" block that itself contains no "->" for
          // the check above to catch - see PerlEmitter's emitTypedArray/
          // wrapArrayDeref's fallback for "new Uint8Array(arr.slice(a,b))"
          // copy-or-zero-fill do-block). "@" can never directly prefix a
          // "(...)"-parenthesized expression in Perl (only a bare scalar,
          // a "{...}"-braced deref, or specific block-call barewords) -
          // without this, "@(do { ... })" was emitted verbatim, a hard
          // Perl syntax error ("Global symbol... near \"@(do\"") - e.g.
          // compression/rolz.js's "Array.from(new Uint8Array(output.slice(
          // 0, originalLength)))". Needs the operand's own parens preserved
          // *inside* the braces (stripping them would still work here since
          // do-blocks and ternaries print fine unparenthesized, but keeping
          // them is simpler and always safe).
          if (operand.startsWith('(')) {
            return `${node.operator}{${operand}}`;
          }
          // Simple scalar variable: @$arr is fine
          return `${node.operator}${operand}`;
        }
        return `${node.operator}${operand}`;
      } else {
        return `${operand}${node.operator}`;
      }
    }

    emitAssignment(node) {
      return `${this.emit(node.target)} ${node.operator} ${this.emit(node.value)}`;
    }

    emitMemberAccess(node) {
      const object = this.emit(node.object);
      let member;

      if (typeof node.member === 'string') {
        member = node.member;
      } else {
        member = this.emit(node.member);
      }

      if (node.accessType === '::') {
        // Package namespace access: List::Util::min
        return `${object}::${member}`;
      } else if (node.accessType === '->') {
        return `${object}->${member}`;
      } else if (node.accessType === '{key}') {
        // Hash reference access: $self->{key} not $self{key}
        return `${object}->{${member}}`;
      } else if (node.accessType === '[index]') {
        // Array reference access: $self->[index]
        return `${object}->[${member}]`;
      }

      return `${object}->${member}`;
    }

    emitSubscript(node) {
      let object = this.emit(node.object);
      const index = this.emit(node.index).replace(/[\n\r\t]/g, '').trim();

      // In Perl, when accessing a single element:
      // - %hash{key} should be $hash{key} (scalar context, no arrow)
      // - @array[0] should be $array[0] (scalar context, no arrow)
      // Change sigil for simple identifiers (these don't need arrows)
      let wasSimpleAggregate = false;
      if (/^[%@][a-zA-Z_][a-zA-Z0-9_]*$/.test(object)) {
        object = '$' + object.slice(1);
        wasSimpleAggregate = true;  // Track this to avoid adding arrow
      }

      // Determine if we need -> before the subscript
      // In Perl, after a method call, hash access, or array access, we need ->
      let needsArrow = node.isRefDeref;

      if (!needsArrow && !wasSimpleAggregate) {
        const lastChar = object.slice(-1);
        // If object ends with ) ] or }, it's a call/subscript result - needs ->
        if (lastChar === ')' || lastChar === ']' || lastChar === '}')
          needsArrow = true;
        // If object starts with $, it's likely an arrayref
        else if (/^\$[a-zA-Z_]/.test(object))
          needsArrow = true;
      }

      const accessor = needsArrow ? '->' : '';

      // Debug: check if isRefDeref is being set correctly
      // console.log(`emitSubscript: ${object}${accessor}[${index}], isRefDeref=${node.isRefDeref}, subscriptType=${node.subscriptType}`);

      if (node.subscriptType === 'array')
        return `${object}${accessor}[${index}]`;
      else
        return `${object}${accessor}{${index}}`;
    }

    emitCall(node) {
      // Handle null callee - used for IIFE patterns like (sub {...})->()
      if (node.callee === null || node.callee === undefined) {
        const args = node.args.map(a => this.emit(a));
        return `(${args.join(', ')})`;
      }

      // Handle IIFE: when callee is an anonymous sub, use (sub { ... })->(args) syntax
      if (node.callee && node.callee.nodeType === 'AnonSub') {
        const subCode = this.emit(node.callee);
        const args = node.args.map(a => this.emit(a));
        return `(${subCode})->(${args.join(', ')})`;
      }

      const callee = typeof node.callee === 'string' ? node.callee : this.emit(node.callee);

      // Handle List::Util block-style functions (any, all, first, none, notall, reduce)
      // Syntax: List::Util::any { block } @array  (NOT with parentheses and commas)
      const listUtilBlockFuncs = ['List::Util::any', 'List::Util::all', 'List::Util::first', 'List::Util::none', 'List::Util::notall'];
      if (listUtilBlockFuncs.includes(callee) && node.args.length >= 2) {
        const blockArg = node.args[0];
        const arrayArg = node.args[1];

        // Emit the block - if it's a PerlBlock, emit its contents inside { }
        let blockStr;
        if (blockArg && blockArg.nodeType === 'Block') {
          const stmts = blockArg.statements.map(s => this.emit(s)).join(' ');
          blockStr = `{ ${stmts} }`;
        } else {
          // Fallback - emit as-is
          blockStr = `{ ${this.emit(blockArg)} }`;
        }

        // Emit the array argument
        const arrayStr = this.emit(arrayArg);

        return `${callee} ${blockStr} ${arrayStr}`;
      }

      // Handle List::Util::reduce which has special syntax: reduce { block } @array or reduce { block } initialValue, @array
      if (callee === 'List::Util::reduce' && node.args.length >= 2) {
        const blockArg = node.args[0];
        const restArgs = node.args.slice(1).map(a => this.emit(a));

        let blockStr;
        // ArrayReduce's callback (the JS ".reduce((acc, cur) => ...)"
        // arrow/function argument) transforms to a PerlAnonSub, not a bare
        // PerlBlock - falling through to the generic "{ ${this.emit
        // (blockArg)} }" case below emitted the ENTIRE "sub (acc, cur)
        // {...}" text wrapped in an extra pair of braces ("{ sub ($p, $bit)
        // { ... } }"), which List::Util::reduce parses as a block that
        // just builds-and-returns a CODE reference every iteration - never
        // actually calling it, and never touching $a/$b (the two special
        // variables reduce actually feeds the accumulator/current value
        // through). The reduction result ended up being that stray CODE
        // ref's own memory address (numeric context on a reference yields
        // its address) instead of any real computed value - e.g. ecc/
        // hamming.js's SECDED overall-parity XOR-reduce silently produced
        // garbage instead of a single parity bit. Perl's reduce block uses
        // $a/$b (like sort's comparator) instead of named parameters, so
        // the callback's two parameter names are substituted for $a/$b
        // (mirroring the map/grep case's $_ substitution just below) and
        // the body's final expression becomes the block's own return
        // value.
        if (blockArg && blockArg.nodeType === 'AnonSub') {
          const pName = blockArg.parameters?.[0]?.name;
          const cName = blockArg.parameters?.[1]?.name;
          const substituteBoth = (text) => {
            let out = text;
            if (pName) out = out.replace(new RegExp(`\\$${pName}(?![a-zA-Z0-9_])`, 'g'), '$a');
            if (cName) out = out.replace(new RegExp(`\\$${cName}(?![a-zA-Z0-9_])`, 'g'), '$b');
            return out;
          };
          const bodyStmts = (blockArg.body && blockArg.body.statements) ? blockArg.body.statements : [];
          const stmts = bodyStmts.map(stmt => {
            const target = (stmt.nodeType === 'Return' && stmt.expression) ? stmt.expression : stmt;
            return substituteBoth(this.emit(target));
          });
          blockStr = `{ ${stmts.join('; ')} }`;
        } else if (blockArg && blockArg.nodeType === 'Block') {
          const stmts = blockArg.statements.map(s => this.emit(s)).join(' ');
          blockStr = `{ ${stmts} }`;
        } else {
          blockStr = `{ ${this.emit(blockArg)} }`;
        }

        return `${callee} ${blockStr} ${restArgs.join(', ')}`;
      }

      // Handle map and grep with block syntax: map { BLOCK } @array
      // Perl's map/grep use $_ for the current element, not named parameters
      if ((callee === 'map' || callee === 'grep') && node.args.length >= 2) {
        const blockArg = node.args[0];
        const arrayArg = node.args[1];

        // Emit the array argument
        const arrayStr = this.emit(arrayArg);

        // If the callback is an AnonSub, convert to block with $_ substitution
        if (blockArg && blockArg.nodeType === 'AnonSub') {
          const paramName = blockArg.parameters?.[0]?.name;
          const blockStr = this.emitMapGrepBlock(blockArg.body, paramName);
          return `${callee} ${blockStr} ${arrayStr}`;
        }

        // If it's a Block, emit directly
        if (blockArg && blockArg.nodeType === 'Block') {
          const stmts = blockArg.statements.map(s => this.emit(s)).join(' ');
          return `${callee} { ${stmts} } ${arrayStr}`;
        }

        // Fallback - emit as function call. A RawCode block (e.g. the
        // "{ chr($_) }" produced by StringFromCharCodes' map/join
        // treatment) already carries its own enclosing braces - wrapping
        // it in another "{ ... }" pair produced double-braced
        // "{ { chr($_) } }", which Perl parses as a hash-constructor
        // literal (not a block) containing a single element, dying with
        // "Odd number of elements in anonymous hash" instead of running
        // the intended per-element map. Only add braces when the emitted
        // text doesn't already look like a self-contained block.
        const emittedBlock = this.emit(blockArg).trim();
        const blockStr = (emittedBlock.startsWith('{') && emittedBlock.endsWith('}'))
          ? emittedBlock
          : `{ ${emittedBlock} }`;
        return `${callee} ${blockStr} ${arrayStr}`;
      }

      // Handle sort with a comparator function: Perl's "sort BLOCK LIST" form
      // needs a bare block (no comma before the list) that reads the package
      // globals $a/$b - emitting it as a normal call sort($coderef, @list)
      // instead makes the comma fold the coderef into the sorted list itself
      // (so sort() gets called with just one LIST argument containing both
      // the sub{} ref and every array element, silently corrupting the
      // result instead of using the sub as a comparator).
      if (callee === 'sort' && node.args.length === 2 && node.args[0] && node.args[0].nodeType === 'AnonSub') {
        const blockArg = node.args[0];
        const arrayStr = this.emit(node.args[1]);
        const blockStr = this.emitMapGrepBlock(blockArg.body, null);
        return `sort ${blockStr} ${arrayStr}`;
      }

      // Handle do { block } - special Perl syntax without parentheses
      // do executes a block and returns the last expression's value
      if (callee === 'do' && node.args.length === 1 && node.args[0].nodeType === 'Block') {
        const block = node.args[0];
        const stmts = [];
        for (let i = 0; i < block.statements.length; ++i) {
          const stmt = block.statements[i];
          let code = this.emit(stmt);
          // Ensure each statement in the do block ends with a semicolon
          // The emitter already adds semicolons for most statements, but not for bare identifiers
          if (stmt.nodeType === 'Identifier' || (stmt.nodeType === 'Call' && i === block.statements.length - 1)) {
            if (!code.trim().endsWith(';')) {
              code = code.trim() + ';';
            }
          }
          stmts.push(code.trim());
        }
        return `do { ${stmts.join(' ')} }`;
      }

      // A spread call argument (e.g. "String.fromCharCode(...data)" ->
      // chr(...)/join(map{chr}...) built from the raw args here, or any
      // other builtin/user sub called with "fn(...arr)") was transformed by
      // transformSpreadElement into the plain scalar with a `.spread` flag
      // set - unlike emitArray (which already dereferences `.spread`
      // elements to flatten "[...arr]" literals), this generic call-args
      // path emitted the flag-bearing node as an ordinary scalar, so e.g.
      // "chr(...data)" silently became "chr($data)" (chr() of a whole
      // arrayref, not each element) instead of flattening $data into the
      // argument list the way Perl's already-list-context call syntax
      // requires ("fn(@{$data})", which flattens exactly like JS spread).
      const args = node.args.map(a => {
        const emitted = this.emit(a);
        if ((a.spread || a.isSpread) && (emitted.startsWith('$') || emitted.includes('->')))
          return `@{${emitted}}`;
        return emitted;
      });

      if (node.isMethodCall) {
        return `${callee}(${args.join(', ')})`;
      }

      // Handle Perl builtins that require arrays (not array refs) as first argument
      const arrayBuiltins = ['push', 'pop', 'shift', 'unshift', 'splice'];
      if (arrayBuiltins.includes(callee) && args.length > 0) {
        // Dereference the first arg if it's a scalar (array reference)
        // $arr -> @{$arr}, $self->{buffer} -> @{$self->{buffer}}
        // Skip if already dereferenced (@arr or @{...})
        const firstArg = args[0];
        if (!firstArg.startsWith('@') && (firstArg.startsWith('$') || firstArg.includes('->{'))) {
          args[0] = `@{${firstArg}}`;
        }
      }

      // Handle code references (variables holding function refs)
      // In Perl, $coderef->() is the syntax for calling a code reference
      // Detect if callee is a scalar variable (starts with $) that could hold a code ref
      //
      // BUT: a callee that already ends in "->BarewordName" (e.g.
      // "$self->SUPER::BUILD", built by transformSuperCallsForBuild/
      // ParentMethodCall as a bare PerlMemberAccess wrapped in an outer
      // PerlCall for its args - see their call sites' comments) is already
      // a complete, directly-callable "receiver->method" target, NOT a
      // scalar holding a coderef - it also happens to start with "$" (from
      // the "$self" receiver), which used to make this branch add a
      // spurious extra "->()": "$self->SUPER::BUILD->(224, 3)" calls
      // whatever *value* SUPER::BUILD() (invoked with no args) returns as
      // a coderef instead of calling SUPER::BUILD(224, 3) directly, dying
      // with "Not a CODE reference". A callee ending in "}"/"]" (a hash/
      // array-subscript read, e.g. "$self->{'callback'}") is the real
      // scalar-holds-a-coderef case and still needs the "->()" below.
      const endsInBarewordMethodName = /->[A-Za-z_][A-Za-z0-9_:]*$/.test(callee);
      if (callee.startsWith('$') && !arrayBuiltins.includes(callee.slice(1)) && !endsInBarewordMethodName) {
        return `${callee}->(${args.join(', ')})`;
      }

      return `${callee}(${args.join(', ')})`;
    }

    /**
     * Emit a map/grep block with $_ substitution for the element parameter
     * @param {PerlBlock} body - The body of the callback
     * @param {string} paramName - The parameter name to replace with $_
     * @returns {string} Perl block code string
     */
    emitMapGrepBlock(body, paramName) {
      if (!body || !body.statements || body.statements.length === 0)
        return '{ }';

      // For map/grep, we need to emit the expression (not a return statement)
      // and replace references to paramName with $_
      const stmts = [];
      for (const stmt of body.statements) {
        // If it's a Return statement, just emit the expression
        if (stmt.nodeType === 'Return' && stmt.expression) {
          const expr = this.emitWithSubstitution(stmt.expression, paramName, '$_');
          stmts.push(expr);
        } else {
          // Emit the statement with substitution
          const code = this.emitWithSubstitution(stmt, paramName, '$_');
          stmts.push(code);
        }
      }

      return `{ ${stmts.join('; ')} }`;
    }

    /**
     * Emit a node with variable name substitution
     * @param {PerlNode} node - The node to emit
     * @param {string} oldName - Variable name to replace
     * @param {string} newName - Replacement (e.g., '$_')
     * @returns {string} Emitted code with substitution
     */
    emitWithSubstitution(node, oldName, newName) {
      if (!node) return '';

      // Handle identifier - replace if it matches the param name
      if (node.nodeType === 'Identifier') {
        if (node.name === oldName)
          return newName;
        return this.emit(node);
      }

      // For expressions, emit normally and do string replacement
      // This is a simple approach - could be made more robust with AST rewriting
      let emitted = this.emit(node);

      // Replace $paramName with $_ (handle both $b and $b-> patterns)
      if (oldName) {
        // Match $paramName at word boundary or followed by ->
        const pattern = new RegExp(`\\$${oldName}(?![a-zA-Z0-9_])`, 'g');
        emitted = emitted.replace(pattern, newName);
      }

      return emitted;
    }

    /**
     * Emit a reduce block - inline do block for array reduction
     * Generates: do { my $acc = init; for my $x (@{$array}) { $acc = expr } $acc }
     */
    emitReduceBlock(node) {
      const initValue = this.emit(node.initialValue);
      const bodyExpr = this.emit(node.bodyExpr);
      let arrayExpr = this.emit(node.array);

      // Dereference array if it's a scalar reference
      if (arrayExpr.startsWith('$') || arrayExpr.includes('->{') || arrayExpr.includes('->[')) {
        arrayExpr = `@{${arrayExpr}}`;
      }

      // Generate inline do block
      return `do { my $acc = ${initValue}; for my $x (${arrayExpr}) { $acc = ${bodyExpr} } $acc }`;
    }

    emitArray(node) {
      const elements = node.elements.map(e => {
        const emitted = this.emit(e);
        // Handle spread elements: [...$arr] should become @$arr or @{$arr}
        // Check if this element has a spread flag or if it's a variable that needs dereferencing
        if (e.spread || e.isSpread) {
          // Explicitly marked as spread - dereference to flatten into parent
          // array. This handles: [...$arr], [...[a,b,c]], [...func()], etc.
          // Previously gated on the emitted text's shape (only "[...]"
          // array-literal-looking or "$scalar"/"->"-containing text got
          // wrapped) - every one of those branches produced the exact same
          // "@{${emitted}}" result anyway, so the shape check only ever
          // mattered for what it *excluded*: any OTHER shape (e.g. a
          // "do { ...; [...]; }" block - the actual Perl shape of a
          // "key.slice(a, b)" array-slice helper, which starts with "do"/
          // "(", matching neither branch) silently fell through
          // unwrapped, leaving the spread's referenced array nested as one
          // single opaque element instead of flattening its contents in -
          // e.g. mac/poly1305.js's "const rBytes = [...key.slice(0, 16)];"
          // produced a 1-element array holding an arrayref, so every real
          // byte index (rBytes[1..15]) read as undef. Already-dereferenced
          // text (starting with "@") is the only shape that must NOT be
          // re-wrapped (double-dereferencing would break); every other
          // shape needs the same "@{...}" treatment regardless of what it
          // looks like.
          if (emitted.startsWith('@')) {
            return emitted;
          }
          // "@{do{...}}"/"@{map{...}...}"/etc. are ambiguous to Perl's
          // parser - "@{do{...}}" in particular resolves to the HASH SLICE
          // "@do{...}" (reading "do" as a bareword hash name), not a
          // dereference of a do-block's result - see the identical
          // disambiguation in emitUnaryExpression's "@"/"%"/"$#" case just
          // above (whose doc comment covers this in more depth). Needs an
          // extra layer of parens to force "dereference of THIS
          // expression" parsing instead.
          if (/^(map|grep|sort|reverse|do)\b/.test(emitted)) {
            return `@{(${emitted})}`;
          }
          return `@{${emitted}}`;
        }
        return emitted;
      });
      // Use [] for array references (JavaScript arrays are always references)
      return `[${elements.join(', ')}]`;
    }

    emitHash(node) {
      const pairs = node.pairs.map(p => {
        let key;
        if (typeof p.key === 'string') {
          // Check if key needs quoting (contains special chars like hyphens, spaces, etc.)
          if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(p.key)) {
            key = p.key;  // Safe bareword
          } else if (p.key.includes("'")) {
            // Contains single quote - use double quotes with proper escaping
            const escaped = p.key
              .replace(/\\/g, '\\\\')
              .replace(/"/g, '\\"')
              .replace(/\$/g, '\\$')
              .replace(/@/g, '\\@');
            key = `"${escaped}"`;
          } else {
            key = `'${p.key}'`;  // Safe for single quotes
          }
        } else {
          key = this.emit(p.key);
        }
        const value = this.emit(p.value);
        return `${key} => ${value}`;
      });
      // Use {} for hash references (JavaScript objects are always references)
      return `{${pairs.join(', ')}}`;
    }

    emitArraySlice(node) {
      const arrayStr = this.emit(node.array);
      let sliceArray;

      // @{do{...}}, @{map{...}...}, @{sort{...}...} etc are ambiguous to
      // Perl's parser - it resolves the leading block-looking identifier as
      // a package name for a hash slice (@do{...}) instead of dereferencing
      // the block's return value, silently producing nonsense. An extra
      // pair of parens forces the block-expression parse (see the identical
      // guard in emitUnaryExpression for the @/% dereference operators).
      const blockStarter = /^(do|map|grep|sort|reverse)\b/.test(arrayStr.trim());
      const derefTarget = blockStarter ? `(${arrayStr})` : arrayStr;

      // For array slicing, we need @ context
      // In JS/this codebase, arrays are ALWAYS stored as references (arrayrefs)
      // So $arr holds [...] and needs @{$arr} to dereference, NOT @arr
      if (arrayStr.startsWith('@')) {
        // Already an array (unlikely in our context) - use as-is
        sliceArray = arrayStr;
      } else {
        // Scalar variable, anonymous array literal ([...]), or function-call
        // expression returning an arrayref - all need a block dereference:
        // @{$ref}[a..b], @{[...]}[a..b], @{func(...)}[a..b].
        //
        // NOTE: This always returns the BARE list-slice expression, never
        // self-wrapped in an extra "[...]" - every one of this AST node's 3
        // call sites in PerlTransformer.js (ArraySlice IL node / .slice()'s
        // 1-arg and 2-arg cases) already wraps the whole PerlArraySlice node
        // in an outer PerlArray to turn the slice's list result into a
        // single arrayref value. Self-wrapping here too used to silently
        // double-bracket every slice of an array-literal- or call-shaped
        // expression - e.g. "OpCodes.Hex8ToBytes(hex).slice(0, 15)" (a very
        // common "decode this fixed hex constant, then truncate" idiom for
        // test-vector key/iv fields) emitted as
        // "[[@{[unpack(...)]}[0 .. 14]]]" - a 1-element array whose single
        // element was the correctly-sliced 15-byte arrayref, instead of that
        // arrayref directly. Every consumer expecting a flat N-byte array
        // (scalar(@$key), $key->[i], ...) silently saw length 1 instead
        // ("Invalid key size: 1 bytes"), and setup that depends on the key
        // being present/correct-length failed downstream ("Key not set" /
        // "Key must be set before processing data").
        sliceArray = `@{${derefTarget}}`;
      }

      const start = this.emit(node.start);
      if (node.end === null) {
        // For last index, use $#{$ref} for arrayrefs
        const lastIndex = arrayStr.startsWith('@') ? `$#${arrayStr.slice(1)}` : `$#{${derefTarget}}`;
        return `${sliceArray}[${start} .. ${lastIndex}]`;
      }
      const end = this.emit(node.end);
      return `${sliceArray}[${start} .. ${end}]`;
    }

    emitAnonSub(node) {
      let code = 'sub';

      if (node.parameters && node.parameters.length > 0) {
        // Include each parameter's default (see transformFunctionExpression:
        // every JS param without an explicit default is still given an
        // implicit "= undef" default, since JS silently allows calling a
        // function with fewer arguments than declared but Perl's signature
        // feature enforces exact arity unless a default is present) -
        // mirrors emitParameterSignature (used for named subs). Previously
        // this dropped all defaults for anonymous subs specifically, so
        // every optional-trailing-argument call site (e.g. "this.hash32(x)"
        // calling "hash32: function(data, seed) {...}") died with "Too few
        // arguments for subroutine" instead of leaving the extra param undef.
        const params = node.parameters.map(p => this.emitParameterSignature(p));
        code += ' (' + params.join(', ') + ')';
      }

      code += ' {' + this.newline;
      this.indentLevel++;

      if (node.body) {
        code += this.emitBlockContents(node.body);
      }

      this.indentLevel--;
      code += this.indent() + '}';

      return code;
    }

    // PerlBless(reference, className) -> bless <reference>, 'ClassName'
    // Used to bless legacy object-literal algorithm hashrefs (and their
    // Object.create(this)-style clones) into _LegacyAlgoObj - see
    // PerlTransformer's transformObjectExpression/'ObjectLiteral' and
    // 'ObjectCreate' handling and node.usesLegacyAlgoObj / the
    // _LegacyAlgoObj stub emitted above in emitModule.
    emitBless(node) {
      // Explicit parens are required, not cosmetic: bless's low-precedence
      // unparenthesized list-operator syntax ("bless {...}, 'Class'")
      // slurps every subsequent comma-separated item to its right as an
      // extra argument whenever this expression is itself nested inside a
      // broader comma list - e.g. as a hash-literal value ("'_cipher' =>
      // bless {...}, 'Class', 'nextKey' => ..."), which then also
      // swallowed 'nextKey' => ... into bless's own argument list, dying
      // "Too many arguments for bless" (its prototype only accepts 2). Seen
      // wherever a legacy object-literal algorithm has an Object.create(this)-
      // style clone field alongside further fields/methods after it (e.g.
      // stream/mugi.js's "_cipher: Object.create(MUGI)" instance field -
      // see transformObjectExpression's 'ObjectCreate' handling). A
      // standalone top-level "bless {...}, 'Class';" statement works either
      // way, so the parens are always safe to add unconditionally.
      return `bless(${this.emit(node.reference)}, '${node.className}')`;
    }

    emitConditional(node) {
      // Parenthesized: Perl's "?:" binds looser than most other operators
      // it can end up nested inside as an *operand* - notably the ".."
      // range operator, which binds *tighter* than "?:". A ternary used
      // directly as an array-slice bound (e.g. PerlTransformer.js's
      // ArraySlice-with-negative-start rewrite: "@{$arr}[$cond ? $a : $b
      // .. $#arr]") was silently misparsed as "$cond ? $a : ($b ..
      // $#arr)" - the range swallowed the ternary's *false* branch instead
      // of bounding the whole ternary result, corrupting which elements
      // got sliced. Unconditional parens cost nothing when this ternary
      // is instead emitted at statement level (assignment RHS, return
      // value, ...), and Perl's "conditional lvalue" idiom
      // ("(cond ? $x : $y) = value") requires these same parens anyway.
      return `(${this.emit(node.condition)} ? ${this.emit(node.consequent)} : ${this.emit(node.alternate)})`;
    }

    emitList(node) {
      const elements = node.elements.map(e => this.emit(e));
      return `(${elements.join(', ')})`;
    }

    emitQw(node) {
      return `qw(${node.words.join(' ')})`;
    }

    emitRegex(node) {
      // A JS regex pattern containing a literal (unescaped, since valid in a
      // JS /.../ regex literal) "/" - e.g. a "[.../]"-shaped character
      // class - breaks Perl's naive "/"-delimited match/regex (the in-
      // pattern "/" is read as the delimiter closing the pattern early,
      // usually dying "Unmatched [ in regex"). Use Perl's "m{...}" bracket-
      // delimiter form instead whenever that happens (still matches
      // implicitly against $_ the same way a bare "/pattern/" does) -
      // mirrors the identical fix for .replace()'s s/// emission in
      // PerlTransformer.js.
      if (/(?<!\\)\//.test(node.pattern))
        return `m{${node.pattern}}${node.modifiers}`;
      return `/${node.pattern}/${node.modifiers}`;
    }

    emitStringInterpolation(node) {
      let result = '"';
      for (const part of node.parts) {
        if (typeof part === 'string') {
          // String literal part
          result += part
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\$/g, '\\$')
            .replace(/@/g, '\\@');
        } else {
          // Expression part - handle based on type
          const emitted = this.emit(part);
          if (part.type === 'Identifier' && emitted.startsWith('$')) {
            // Simple variable: just use $varname directly
            result += emitted;
          } else {
            // Complex expression: use @{[expr]} for interpolation
            result += '@{[' + emitted + ']}';
          }
        }
      }
      result += '"';
      return result;
    }

    emitType(node) {
      return node.toString();
    }

    // ========================[ DOCUMENTATION ]========================

    emitPOD(node) {
      let code = this.line('=' + node.podType);
      code += this.newline;
      code += this.line(node.content);
      code += this.newline;
      code += this.line('=cut');
      return code;
    }

    emitComment(node) {
      return this.line('# ' + node.text);
    }

    emitRawCode(node) {
      // Return raw code as-is without adding indentation or newlines
      // This is used for inline expressions that are embedded in other code
      return node.code;
    }
  }

  // Export
  const exports = { PerlEmitter };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  }
  if (typeof global !== 'undefined') {
    global.PerlEmitter = PerlEmitter;
  }

})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
