/*
 * ChaCha - Counter-Based PRNG Family
 * Parametrized implementation supporting ChaCha8, ChaCha12, ChaCha20, and Tyche (20 rounds)
 *
 * ChaCha is a family of stream cipher variants designed by Daniel J. Bernstein.
 * Different round counts provide different speed/security trade-offs:
 * - ChaCha8: 8 rounds (used in Go runtime, fastest)
 * - ChaCha12: 12 rounds (balanced)
 * - ChaCha20: 20 rounds (original specification, most secure)
 * - Tyche: 20 rounds with different initialization (Neves&Araujo variant)
 *
 * The algorithm is counter-based, meaning it's stateless and can efficiently
 * generate any position in the keystream without computing prior values.
 *
 * Key features:
 * - Counter-based design (stateless, parallelizable)
 * - 256-bit key, 64-bit nonce, 64-bit counter
 * - 512-bit (64 byte) output blocks
 * - Configurable round count for speed/quality trade-off
 * - Strong statistical properties across all variants
 *
 * References:
 * - ChaCha specification by Daniel J. Bernstein (2008)
 * - Tyche: "Fast and Small Nonlinear Pseudorandom Number Generators" by Neves&Araujo (2011)
 *
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          RandomGenerationAlgorithm, IRandomGeneratorInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ChaCha constants: "expand 32-byte k" in ASCII as little-endian 32-bit words
  const CHACHA_CONST_0 = 0x61707865; // "expa"
  const CHACHA_CONST_1 = 0x3320646e; // "nd 3"
  const CHACHA_CONST_2 = 0x79622d32; // "2-by"
  const CHACHA_CONST_3 = 0x6b206574; // "te k"

  /**
   * ChaCha quarter round operation
   * Performs: a += b; d = OpCodes.Xor32(d, a); d = ROL(d, 16);
   *           c += d; b = OpCodes.Xor32(b, c); b = ROL(b, 12);
   *           a += b; d = OpCodes.Xor32(d, a); d = ROL(d, 8);
   *           c += d; b = OpCodes.Xor32(b, c); b = ROL(b, 7);
   */
  function quarterRound(state, a, b, c, d) {
    state[a] = OpCodes.Add32(state[a], state[b]);
    state[d] = OpCodes.RotL32(OpCodes.Xor32(state[d], state[a]), 16);

    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] = OpCodes.RotL32(OpCodes.Xor32(state[b], state[c]), 12);

    state[a] = OpCodes.Add32(state[a], state[b]);
    state[d] = OpCodes.RotL32(OpCodes.Xor32(state[d], state[a]), 8);

    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] = OpCodes.RotL32(OpCodes.Xor32(state[b], state[c]), 7);
  }

  /**
   * ChaCha block function - performs specified number of rounds
   */
  function chachaBlock(input, numRounds) {
    const state = input.slice(); // Copy initial state

    // Perform double-rounds (2 rounds per iteration)
    for (let i = 0; i < numRounds; i += 2) {
      // Odd round - column rounds
      quarterRound(state, 0, 4, 8, 12);
      quarterRound(state, 1, 5, 9, 13);
      quarterRound(state, 2, 6, 10, 14);
      quarterRound(state, 3, 7, 11, 15);

      // Even round - diagonal rounds
      quarterRound(state, 0, 5, 10, 15);
      quarterRound(state, 1, 6, 11, 12);
      quarterRound(state, 2, 7, 8, 13);
      quarterRound(state, 3, 4, 9, 14);
    }

    // Add initial state (feedforward)
    for (let i = 0; i < 16; i++) {
      state[i] = OpCodes.Add32(state[i], input[i]);
    }

    return state;
  }

  /**
   * ChaCha Algorithm - Parametrized by round count
   */
  class ChaChaAlgorithm extends RandomGenerationAlgorithm {
    constructor(rounds, variant) {
      super();

      this.rounds = rounds;
      this.variant = variant || `ChaCha${rounds}`;

      // Metadata varies by variant
      if (variant === 'Tyche') {
        this.name = 'Tyche';
        this.description = 'Fast cryptographic PRNG based on 20-round ChaCha cipher designed by Samuel Neves and Filipe Araujo (2011). Tyche passes PractRand and TestU01 BigCrush statistical test suites. Uses ChaCha quarter-round function with different initialization than standard ChaCha20.';
        this.inventor = 'Samuel Neves, Filipe Araujo';
        this.year = 2011;
        this.securityStatus = SecurityStatus.EXPERIMENTAL;
      } else {
        this.name = this.variant;
        this.description = `ChaCha stream cipher variant with ${rounds} rounds designed by Daniel J. Bernstein. Counter-based PRNG providing excellent statistical properties and high performance. ${rounds === 8 ? 'Used as default PRNG in Go programming language runtime.' : rounds === 20 ? 'Original specification with maximum security margin.' : 'Balanced variant offering good performance and quality.'}`;
        this.inventor = 'Daniel J. Bernstein';
        this.year = 2008;
        this.securityStatus = rounds >= 20 ? SecurityStatus.EXPERIMENTAL : SecurityStatus.EDUCATIONAL;
      }

      this.category = CategoryType.RANDOM;
      this.subCategory = 'Pseudorandom Number Generator';
      this.complexity = ComplexityType.ADVANCED;
      this.country = variant === 'Tyche' ? CountryCode.PT : CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = rounds >= 20;
      this.SupportedSeedSizes = [new KeySize(32, 32, 1)]; // 256-bit key

      // Documentation
      if (variant === 'Tyche') {
        this.documentation = [
          new LinkItem(
            'Tyche: Fast and Small Nonlinear Pseudorandom Number Generators (PPAM 2011)',
            'https://eden.dei.uc.pt/~sneves/pubs/2011-snfa2.pdf'
          ),
          new LinkItem(
            'ChaCha: A variant of Salsa20',
            'https://cr.yp.to/chacha/chacha-20080128.pdf'
          ),
          new LinkItem(
            'Cryptography StackExchange: Tyche vs ChaCha',
            'https://crypto.stackexchange.com/questions/28503/what-is-the-difference-between-tyche-and-chacha'
          )
        ];
      } else {
        this.documentation = [
          new LinkItem(
            'ChaCha: A variant of Salsa20 (Bernstein 2008)',
            'https://cr.yp.to/chacha/chacha-20080128.pdf'
          ),
          new LinkItem(
            'Wikipedia: Salsa20 (ChaCha section)',
            'https://en.wikipedia.org/wiki/Salsa20#ChaCha_variant'
          ),
          new LinkItem(
            'RFC 7539: ChaCha20 and Poly1305 for IETF Protocols',
            'https://tools.ietf.org/html/rfc7539'
          )
        ];
      }

      this.references = [
        new LinkItem(
          'Go runtime PRNG source code (ChaCha8)',
          'https://github.com/golang/go/blob/master/src/runtime/rand.go'
        ),
        new LinkItem(
          'Rust rand_chacha crate',
          'https://docs.rs/rand_chacha/'
        )
      ];

      // Test vectors - vary by variant
      this.tests = this._getTestVectors(variant, rounds);
    }

    _getTestVectors(variant, rounds) {
      if (variant === 'Tyche') {
        // Test vectors generated from Shiroechi/Litdex.Security.RNG implementation
        // https://github.com/Shiroechi/Litdex.Security.RNG/blob/main/Source/Security/RNG/PRNG/Tyche.cs
        return [
          {
            text: 'Tyche with seed 0, stream 0: First 16 bytes',
            uri: 'https://github.com/Shiroechi/Litdex.Security.RNG/blob/main/Source/Security/RNG/PRNG/Tyche.cs',
            input: null,
            seed: OpCodes.Hex8ToBytes('0000000000000000'),
            streamIndex: OpCodes.Hex8ToBytes('00000000'),
            outputSize: 16,
            expected: OpCodes.Hex8ToBytes('DBDCAE836FDE31BF714BE8ABA4B974FF')
          },
          {
            text: 'Tyche with seed 1, stream 0: First 16 bytes',
            uri: 'https://github.com/Shiroechi/Litdex.Security.RNG/blob/main/Source/Security/RNG/PRNG/Tyche.cs',
            input: null,
            seed: OpCodes.Hex8ToBytes('0100000000000000'),
            streamIndex: OpCodes.Hex8ToBytes('00000000'),
            outputSize: 16,
            expected: OpCodes.Hex8ToBytes('ABBF5598B056862844653EBD5AA86B9C')
          },
          {
            text: 'Tyche with seed 12345, stream 0: First 16 bytes',
            uri: 'https://github.com/Shiroechi/Litdex.Security.RNG/blob/main/Source/Security/RNG/PRNG/Tyche.cs',
            input: null,
            seed: OpCodes.Hex8ToBytes('3930000000000000'),
            streamIndex: OpCodes.Hex8ToBytes('00000000'),
            outputSize: 16,
            expected: OpCodes.Hex8ToBytes('D7D0722E34863050D14334A5877D014C')
          },
          {
            text: 'Tyche with seed 0xDEADBEEF, stream 1: First 16 bytes',
            uri: 'https://github.com/Shiroechi/Litdex.Security.RNG/blob/main/Source/Security/RNG/PRNG/Tyche.cs',
            input: null,
            seed: OpCodes.Hex8ToBytes('EFBEADDE00000000'),
            streamIndex: OpCodes.Hex8ToBytes('01000000'),
            outputSize: 16,
            expected: OpCodes.Hex8ToBytes('8E24DFDB18A1D74D5BDF1E9D5B5585FC')
          }
        ];
      } else if (rounds === 8) {
        // ChaCha8 test vectors from cryptopp reference implementation
        return [
          {
            text: 'ChaCha8 zero key and nonce (32-byte key): First 16 bytes',
            uri: 'https://github.com/weidai11/cryptopp/blob/master/TestVectors/chacha.txt',
            input: null,
            seed: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
            nonce: OpCodes.Hex8ToBytes('0000000000000000'),
            counter: OpCodes.Hex8ToBytes('0000000000000000'),
            outputSize: 16,
            expected: OpCodes.Hex8ToBytes('3E00EF2F895F40D67F5BB8E81F09A5A1')
          },
          {
            text: 'ChaCha8 zero key and nonce (32-byte key): First 64 bytes',
            uri: 'https://github.com/weidai11/cryptopp/blob/master/TestVectors/chacha.txt',
            input: null,
            seed: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
            nonce: OpCodes.Hex8ToBytes('0000000000000000'),
            counter: OpCodes.Hex8ToBytes('0000000000000000'),
            outputSize: 64,
            expected: OpCodes.Hex8ToBytes('3E00EF2F895F40D67F5BB8E81F09A5A12C840EC3CE9A7F3B181BE188EF711A1E984CE172B9216F419F445367456D5619314A42A3DA86B001387BFDB80E0CFE42')
          }
        ];
      } else if (rounds === 12) {
        // ChaCha12 test vectors from cryptopp reference
        return [
          {
            text: 'ChaCha12 zero key and nonce (32-byte key): First 16 bytes',
            uri: 'https://github.com/weidai11/cryptopp/blob/master/TestVectors/chacha.txt',
            input: null,
            seed: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
            nonce: OpCodes.Hex8ToBytes('0000000000000000'),
            counter: OpCodes.Hex8ToBytes('0000000000000000'),
            outputSize: 16,
            expected: OpCodes.Hex8ToBytes('9BF49A6A0755F953811FCE125F2683D5')
          }
        ];
      } else {
        // ChaCha20 test vectors from RFC 7539
        return [
          {
            text: 'ChaCha20 zero key and nonce (32-byte key): First 16 bytes',
            uri: 'https://tools.ietf.org/html/rfc7539',
            input: null,
            seed: OpCodes.Hex8ToBytes('0000000000000000000000000000000000000000000000000000000000000000'),
            nonce: OpCodes.Hex8ToBytes('0000000000000000'),
            counter: OpCodes.Hex8ToBytes('0000000000000000'),
            outputSize: 16,
            expected: OpCodes.Hex8ToBytes('76B8E0ADA0F13D90405D6AE55386BD28')
          }
        ];
      }
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // PRNGs have no inverse
      return new ChaChaInstance(this, this.rounds, this.variant);
    }
  }

  /**
   * ChaCha Instance - Implements Feed/Result pattern
   */
  class ChaChaInstance extends IRandomGeneratorInstance {
    constructor(algorithm, rounds, variant) {
      super(algorithm);
      this.rounds = rounds;
      this.variant = variant;
      this._key = null;
      this._nonce = 0n;
      this._counter = 0n;
      this._streamIndex = 0;
      this._buffer = [];
      this._bufferPosition = 0;
      this.outputSize = 64; // Default output size in bytes
    }

    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._key = null;
        return;
      }

      // Accept 8-byte or 32-byte seeds
      if (seedBytes.length === 8) {
        // Expand 8-byte seed to 32-byte key using simple repetition
        this._key = new Array(32);
        for (let i = 0; i < 32; i++) {
          this._key[i] = seedBytes[i % 8];
        }
      } else if (seedBytes.length === 32) {
        this._key = seedBytes.slice();
      } else {
        throw new Error(`Invalid seed size: ${seedBytes.length} bytes (expected 8 or 32)`);
      }

      this._resetState();
    }

    get seed() {
      return this._key ? this._key.slice() : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes || nonceBytes.length === 0) {
        this._nonce = 0n;
        return;
      }

      if (nonceBytes.length !== 8) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected 8)`);
      }

      // Parse as little-endian 64-bit
      this._nonce = 0n;
      for (let i = 0; i < 8; i++) {
        this._nonce = this._nonce | (BigInt(nonceBytes[i]) << BigInt(i * 8));
      }

      this._resetState();
    }

    get nonce() {
      const result = new Array(8);
      let n = this._nonce;
      for (let i = 0; i < 8; i++) {
        result[i] = Number(OpCodes.And32(n, 0xFFn));
        n >>= 8n;
      }
      return result;
    }

    set counter(counterBytes) {
      if (!counterBytes || counterBytes.length === 0) {
        this._counter = 0n;
        return;
      }

      if (counterBytes.length !== 8) {
        throw new Error(`Invalid counter size: ${counterBytes.length} bytes (expected 8)`);
      }

      // Parse as little-endian 64-bit
      this._counter = 0n;
      for (let i = 0; i < 8; i++) {
        this._counter = this._counter | (BigInt(counterBytes[i]) << BigInt(i * 8));
      }

      this._resetState();
    }

    get counter() {
      const result = new Array(8);
      let c = this._counter;
      for (let i = 0; i < 8; i++) {
        result[i] = Number(c & 0xFFn);
        c >>= 8n;
      }
      return result;
    }

    set streamIndex(indexBytes) {
      if (!indexBytes || indexBytes.length === 0) {
        this._streamIndex = 0;
        return;
      }

      if (indexBytes.length !== 4) {
        throw new Error(`Invalid stream index size: ${indexBytes.length} bytes (expected 4)`);
      }

      // Parse as little-endian 32-bit
      this._streamIndex = OpCodes.Pack32LE(indexBytes[0], indexBytes[1], indexBytes[2], indexBytes[3]);
      this._resetState();
    }

    get streamIndex() {
      return OpCodes.Unpack32LE(this._streamIndex);
    }

    _resetState() {
      this._buffer = [];
      this._bufferPosition = 0;
      this._tycheState = null; // Reset Tyche state for re-initialization
    }

    _initializeState() {
      const state = new Array(16);

      if (this.variant === 'Tyche') {
        // Tyche initialization: 4-word state (not full ChaCha 16-word state)
        // Parse seed as little-endian (high 32 bits, low 32 bits)
        const seedHigh = OpCodes.Pack32LE(this._key[4], this._key[5], this._key[6], this._key[7]);
        const seedLow = OpCodes.Pack32LE(this._key[0], this._key[1], this._key[2], this._key[3]);

        state[0] = seedHigh;
        state[1] = seedLow;
        state[2] = 0x9E3779B9; // Golden ratio constant (PHI)
        state[3] = OpCodes.Xor32(this._streamIndex, 0x51866487); // Stream index XOR constant

        // Tyche warm-up: 20 quarter-round iterations on the 4-word state
        for (let i = 0; i < 20; ++i) {
          state[0] = OpCodes.Add32(state[0], state[1]);
          state[3] = OpCodes.RotL32(OpCodes.Xor32(state[3], state[0]), 16);
          state[2] = OpCodes.Add32(state[2], state[3]);
          state[1] = OpCodes.RotL32(OpCodes.Xor32(state[1], state[2]), 12);
          state[0] = OpCodes.Add32(state[0], state[1]);
          state[3] = OpCodes.RotL32(OpCodes.Xor32(state[3], state[0]), 8);
          state[2] = OpCodes.Add32(state[2], state[3]);
          state[1] = OpCodes.RotL32(OpCodes.Xor32(state[1], state[2]), 7);
        }
      } else {
        // Standard ChaCha initialization
        state[0] = CHACHA_CONST_0;
        state[1] = CHACHA_CONST_1;
        state[2] = CHACHA_CONST_2;
        state[3] = CHACHA_CONST_3;

        // Key (8 words = 256 bits)
        for (let i = 0; i < 8; i++) {
          state[4 + i] = OpCodes.Pack32LE(
            this._key[i * 4],
            this._key[i * 4 + 1],
            this._key[i * 4 + 2],
            this._key[i * 4 + 3]
          );
        }

        // Counter (2 words = 64 bits)
        state[12] = Number(this._counter & 0xFFFFFFFFn);
        state[13] = Number(this._counter >> 32n);

        // Nonce (2 words = 64 bits)
        state[14] = Number(this._nonce & 0xFFFFFFFFn);
        state[15] = Number(this._nonce >> 32n);
      }

      return state;
    }

    _generateBlock() {
      if (!this._key) {
        throw new Error('Seed not set');
      }

      if (this.variant === 'Tyche') {
        // Tyche: Initialize state lazily and keep advancing it
        if (!this._tycheState) {
          const state = this._initializeState();
          this._tycheState = [state[0], state[1], state[2], state[3]];
        }

        // Perform one Tyche quarter-round to advance the state
        this._tycheState[0] = OpCodes.Add32(this._tycheState[0], this._tycheState[1]);
        this._tycheState[3] = OpCodes.RotL32(OpCodes.Xor32(this._tycheState[3], this._tycheState[0]), 16);
        this._tycheState[2] = OpCodes.Add32(this._tycheState[2], this._tycheState[3]);
        this._tycheState[1] = OpCodes.RotL32(OpCodes.Xor32(this._tycheState[1], this._tycheState[2]), 12);
        this._tycheState[0] = OpCodes.Add32(this._tycheState[0], this._tycheState[1]);
        this._tycheState[3] = OpCodes.RotL32(OpCodes.Xor32(this._tycheState[3], this._tycheState[0]), 8);
        this._tycheState[2] = OpCodes.Add32(this._tycheState[2], this._tycheState[3]);
        this._tycheState[1] = OpCodes.RotL32(OpCodes.Xor32(this._tycheState[1], this._tycheState[2]), 7);

        // Return 4 bytes from b (state[1]) in little-endian
        // Litdex Next() returns only _State[1] after Mix()
        const b = this._tycheState[1];
        return [
          OpCodes.And32(b, 0xFF),
          OpCodes.And32(OpCodes.Shr32(b, 8), 0xFF),
          OpCodes.And32(OpCodes.Shr32(b, 16), 0xFF),
          OpCodes.And32(OpCodes.Shr32(b, 24), 0xFF)
        ];
      }

      // Standard ChaCha block generation
      const input = this._initializeState();
      const output = chachaBlock(input, this.rounds);

      // Convert to bytes (little-endian)
      const bytes = [];
      for (let i = 0; i < 16; i++) {
        const word = output[i];
        bytes.push(OpCodes.And32(word, 0xFF));
        bytes.push(OpCodes.And32(OpCodes.Shr32(word, 8), 0xFF));
        bytes.push(OpCodes.And32(OpCodes.Shr32(word, 16), 0xFF));
        bytes.push(OpCodes.And32(OpCodes.Shr32(word, 24), 0xFF));
      }

      // Increment counter
      this._counter++;

      return bytes;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      // ChaCha is a counter-based PRNG - Feed() is not used for input
      // This is here for AlgorithmFramework compatibility
      if (data && data.length > 0) {
        throw new Error('ChaCha is a counter-based PRNG and does not accept input data');
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */
    Result() {
      if (!this._key) {
        throw new Error('Seed not set');
      }

      const requestedSize = this.outputSize || 64;
      const output = [];

      while (output.length < requestedSize) {
        // Refill buffer if needed
        if (this._bufferPosition >= this._buffer.length) {
          this._buffer = this._generateBlock();
          this._bufferPosition = 0;
        }

        // Copy from buffer
        const bytesNeeded = requestedSize - output.length;
        const bytesAvailable = this._buffer.length - this._bufferPosition;
        const bytesToCopy = Math.min(bytesNeeded, bytesAvailable);

        for (let i = 0; i < bytesToCopy; i++) {
          output.push(this._buffer[this._bufferPosition++]);
        }
      }

      return output;
    }
  }

  // Register all variants
  RegisterAlgorithm(new ChaChaAlgorithm(8, 'ChaCha8'));
  RegisterAlgorithm(new ChaChaAlgorithm(12, 'ChaCha12'));
  RegisterAlgorithm(new ChaChaAlgorithm(20, 'ChaCha20'));
  RegisterAlgorithm(new ChaChaAlgorithm(20, 'Tyche'));

  return ChaChaAlgorithm;
}));
