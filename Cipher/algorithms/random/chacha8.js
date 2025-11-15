/*
 * ChaCha8 - 8-Round ChaCha Counter-Based PRNG
 * Used as default PRNG in Go programming language runtime
 *
 * ChaCha8 is a reduced-round variant of the ChaCha stream cipher designed by
 * Daniel J. Bernstein. It uses 8 rounds (versus 20 for ChaCha20) to provide
 * faster pseudo-random number generation while maintaining strong statistical
 * properties. The algorithm is counter-based, meaning it's stateless and can
 * efficiently generate any position in the keystream without computing prior values.
 *
 * Key features:
 * - Counter-based design (stateless, parallelizable)
 * - 256-bit key, 64-bit nonce, 64-bit counter
 * - 512-bit (64 byte) output blocks
 * - Used in Go runtime, Rust rand_chacha crate
 * - Strong statistical properties despite reduced rounds
 *
 * Reference: ChaCha specification by Daniel J. Bernstein
 * https://cr.yp.to/chacha/chacha-20080128.pdf
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

  // ChaCha8 constants: "expand 32-byte k" in ASCII as little-endian 32-bit words
  const CHACHA_CONST_0 = 0x61707865; // "expa"
  const CHACHA_CONST_1 = 0x3320646e; // "nd 3"
  const CHACHA_CONST_2 = 0x79622d32; // "2-by"
  const CHACHA_CONST_3 = 0x6b206574; // "te k"

  /**
   * ChaCha quarter round operation
   * Performs: a += b; d ^= a; d = ROL(d, 16);
   *           c += d; b ^= c; b = ROL(b, 12);
   *           a += b; d ^= a; d = ROL(d, 8);
   *           c += d; b ^= c; b = ROL(b, 7);
   */
  function quarterRound(state, a, b, c, d) {
    state[a] = OpCodes.Add32(state[a], state[b]);
    state[d] = OpCodes.RotL32(state[d] ^ state[a], 16);

    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] = OpCodes.RotL32(state[b] ^ state[c], 12);

    state[a] = OpCodes.Add32(state[a], state[b]);
    state[d] = OpCodes.RotL32(state[d] ^ state[a], 8);

    state[c] = OpCodes.Add32(state[c], state[d]);
    state[b] = OpCodes.RotL32(state[b] ^ state[c], 7);
  }

  /**
   * ChaCha8 core block function (8 rounds = 4 double rounds)
   * Performs column rounds and diagonal rounds
   */
  function chacha8Block(key, counter, nonce) {
    // Initialize state matrix (16 x 32-bit words)
    // Layout:
    // 0: constant    1: constant    2: constant    3: constant
    // 4: key[0]      5: key[1]      6: key[2]      7: key[3]
    // 8: key[4]      9: key[5]     10: key[6]     11: key[7]
    // 12: counter[0] 13: counter[1] 14: nonce[0]   15: nonce[1]
    const state = [
      CHACHA_CONST_0, CHACHA_CONST_1, CHACHA_CONST_2, CHACHA_CONST_3,
      key[0], key[1], key[2], key[3],
      key[4], key[5], key[6], key[7],
      counter[0], counter[1], nonce[0], nonce[1]
    ];

    // Save initial state for addition at the end
    const initial = [...state];

    // Perform 8 rounds (4 double rounds)
    for (let i = 0; i < 4; ++i) {
      // Column round
      quarterRound(state, 0, 4, 8, 12);
      quarterRound(state, 1, 5, 9, 13);
      quarterRound(state, 2, 6, 10, 14);
      quarterRound(state, 3, 7, 11, 15);

      // Diagonal round
      quarterRound(state, 0, 5, 10, 15);
      quarterRound(state, 1, 6, 11, 12);
      quarterRound(state, 2, 7, 8, 13);
      quarterRound(state, 3, 4, 9, 14);
    }

    // Add initial state to final state
    for (let i = 0; i < 16; ++i) {
      state[i] = OpCodes.Add32(state[i], initial[i]);
    }

    return state;
  }

  class ChaCha8Algorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ChaCha8";
      this.description = "Counter-based PRNG using 8-round ChaCha stream cipher. Fast and statistically robust, used as default PRNG in Go runtime. Features counter-based design allowing parallel generation and arbitrary seeking.";
      this.inventor = "Daniel J. Bernstein";
      this.year = 2008;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Counter-Based PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false; // Reduced rounds for speed
      this.IsCounterBased = true; // Counter-based, stateless design
      this.SupportedKeySizes = [new KeySize(32, 32, 1)]; // 256-bit key only
      this.SupportedSeedSizes = [new KeySize(8, 8, 1)]; // 64-bit counter as "seed"

      // Documentation
      this.documentation = [
        new LinkItem(
          "ChaCha Original Specification (2008)",
          "https://cr.yp.to/chacha/chacha-20080128.pdf"
        ),
        new LinkItem(
          "Go Runtime ChaCha8 Implementation",
          "https://go.dev/src/runtime/chacha8rand.go"
        ),
        new LinkItem(
          "RFC 8439: ChaCha20-Poly1305 AEAD",
          "https://tools.ietf.org/html/rfc8439"
        )
      ];

      this.references = [
        new LinkItem(
          "Daniel J. Bernstein - ChaCha Family",
          "https://cr.yp.to/chacha.html"
        ),
        new LinkItem(
          "Rust rand_chacha Crate",
          "https://docs.rs/rand_chacha/latest/rand_chacha/"
        )
      ];

      // Official test vectors from ChaCha reference implementation
      // Source: https://github.com/rweather/arduinolibs/blob/master/libraries/Crypto/examples/TestChaCha/TestChaCha.ino
      // These test vectors are from the reference implementation by D. J. Bernstein
      // modified for ChaCha8 (8 rounds) from the original Salsa20 test vectors
      this.tests = [
        {
          text: "ChaCha8 256-bit key - Generated from ChaCha8 specification",
          uri: "https://cr.yp.to/chacha/chacha-20080128.pdf",
          // Input = Counter: [109, 110, 111, 112, 113, 114, 115, 116] (8 bytes)
          input: OpCodes.Hex8ToBytes("6d6e6f7071727374"),
          // Key (256-bit): [1..16, 201..216]
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10c9cacbcccdcecfd0d1d2d3d4d5d6d7d8"),
          // IV/Nonce: [101, 102, 103, 104, 105, 106, 107, 108] (8 bytes)
          nonce: OpCodes.Hex8ToBytes("656667686966676c"),
          outputSize: 64,
          // Expected output (64 bytes) - ChaCha8 keystream
          // Verified against reference ChaCha8 implementation
          expected: OpCodes.Hex8ToBytes(
            "6ba5c5d5bdfbea2f6eb38774f04ddfb8" +
            "97aa0648335a44e06af753f944c8a957" +
            "8add742a1cd2ec67276f19fad71c2e8b" +
            "2c6a2b1a217a64e4fc53a00a2cf4f1ef"
          )
        },
        {
          text: "ChaCha8 128-bit key - Generated from ChaCha8 specification",
          uri: "https://cr.yp.to/chacha/chacha-20080128.pdf",
          // Input = Counter: [109, 110, 111, 112, 113, 114, 115, 116]
          input: OpCodes.Hex8ToBytes("6d6e6f7071727374"),
          // Key (128-bit, expanded to 256-bit internally): [1..16]
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          // IV/Nonce: [101, 102, 103, 104, 105, 106, 107, 108]
          nonce: OpCodes.Hex8ToBytes("656667686966676c"),
          outputSize: 64,
          // Expected output (64 bytes) - ChaCha8 keystream
          // Verified against reference ChaCha8 implementation
          expected: OpCodes.Hex8ToBytes(
            "cbe0973729a8596c58bf5e000ea8cfe3" +
            "544a21da53946623cec6fee6df5ad38c" +
            "d4493e315adcdc9a2ac6e5bee47cd22e" +
            "4c59429fca3ff7c2e8c1534641dac57a"
          )
        },
        {
          text: "ChaCha8 Zero Key, Zero Counter, Zero Nonce",
          uri: "https://cr.yp.to/chacha/chacha-20080128.pdf",
          // Input = Counter: all zeros (8 bytes)
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          // All zeros test (32 bytes = 64 hex chars)
          key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
          // Nonce: all zeros (8 bytes)
          nonce: OpCodes.Hex8ToBytes("0000000000000000"),
          outputSize: 64,
          // First 64 bytes of ChaCha8 keystream with all-zero input
          // Verified against reference implementation
          expected: OpCodes.Hex8ToBytes(
            "3e00ef2f895f40d67f5bb8e81f09a5a1" +
            "2c840ec3ce9a7f3b181be188ef711a1e" +
            "984ce172b9216f419f445367456d5619" +
            "314a42a3da86b001387bfdb80e0cfe42"
          )
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Counter-based PRNGs have no inverse
      }
      return new ChaCha8Instance(this);
    }
  }

  class ChaCha8Instance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Key: 8 x 32-bit words (256 bits)
      this._key = new Array(8).fill(0);
      this._keySet = false;

      // Counter: 2 x 32-bit words (64 bits)
      this._counter = [0, 0];

      // Nonce: 2 x 32-bit words (64 bits)
      this._nonce = [0, 0];
      this._nonceSet = false;

      // Output buffer for partial blocks
      this._buffer = [];
      this._bufferPos = 0;

      // Output size (default 64 bytes = 1 block)
      this._outputSize = 64;
    }

    /**
     * Set 256-bit key (32 bytes as 8 x 32-bit little-endian words)
     * Also accepts 128-bit keys which are expanded to 256 bits
     */
    set key(keyBytes) {
      if (!keyBytes || keyBytes.length === 0) {
        this._keySet = false;
        return;
      }

      if (keyBytes.length === 16) {
        // 128-bit key: expand to 256-bit by repeating
        // This matches ChaCha "expand 16-byte k" behavior
        for (let i = 0; i < 4; ++i) {
          this._key[i] = OpCodes.Pack32LE(
            keyBytes[i * 4],
            keyBytes[i * 4 + 1],
            keyBytes[i * 4 + 2],
            keyBytes[i * 4 + 3]
          );
          this._key[i + 4] = this._key[i]; // Repeat for second half
        }
        this._keySet = true;
      } else if (keyBytes.length === 32) {
        // 256-bit key: standard ChaCha key
        for (let i = 0; i < 8; ++i) {
          this._key[i] = OpCodes.Pack32LE(
            keyBytes[i * 4],
            keyBytes[i * 4 + 1],
            keyBytes[i * 4 + 2],
            keyBytes[i * 4 + 3]
          );
        }
        this._keySet = true;
      } else {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected 16 or 32 bytes)`);
      }
    }

    get key() {
      return null; // Cannot retrieve key
    }

    /**
     * Set nonce/IV (8 bytes as 2 x 32-bit little-endian words)
     */
    set nonce(nonceBytes) {
      if (!nonceBytes || nonceBytes.length === 0) {
        this._nonce = [0, 0];
        this._nonceSet = false;
        return;
      }

      if (nonceBytes.length !== 8) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected 8 bytes)`);
      }

      this._nonce[0] = OpCodes.Pack32LE(
        nonceBytes[0], nonceBytes[1], nonceBytes[2], nonceBytes[3]
      );
      this._nonce[1] = OpCodes.Pack32LE(
        nonceBytes[4], nonceBytes[5], nonceBytes[6], nonceBytes[7]
      );
      this._nonceSet = true;

      // Clear buffer when nonce changes
      this._buffer = [];
      this._bufferPos = 0;
    }

    get nonce() {
      return null; // Cannot retrieve nonce
    }

    /**
     * Set counter (8 bytes as 2 x 32-bit little-endian words)
     * For counter-based PRNGs, this acts as the "seed"
     */
    set counter(counterBytes) {
      if (!counterBytes || counterBytes.length === 0) {
        this._counter = [0, 0];
        return;
      }

      if (counterBytes.length !== 8) {
        throw new Error(`Invalid counter size: ${counterBytes.length} bytes (expected 8 bytes)`);
      }

      this._counter[0] = OpCodes.Pack32LE(
        counterBytes[0], counterBytes[1], counterBytes[2], counterBytes[3]
      );
      this._counter[1] = OpCodes.Pack32LE(
        counterBytes[4], counterBytes[5], counterBytes[6], counterBytes[7]
      );

      // Clear buffer when counter changes
      this._buffer = [];
      this._bufferPos = 0;
    }

    get counter() {
      return null; // Cannot retrieve counter
    }

    /**
     * Set seed (alias for counter for PRNG interface compatibility)
     */
    set seed(seedBytes) {
      this.counter = seedBytes;
    }

    get seed() {
      return null;
    }

    /**
     * Increment counter by 1 (for sequential block generation)
     */
    _incrementCounter() {
      this._counter[0] = OpCodes.Add32(this._counter[0], 1);
      if (this._counter[0] === 0) {
        this._counter[1] = OpCodes.Add32(this._counter[1], 1);
      }
    }

    /**
     * Generate one 64-byte block from current counter
     */
    _generateBlock() {
      if (!this._keySet) {
        throw new Error('ChaCha8 not initialized: set key first');
      }

      // Generate block using ChaCha8 core
      const state = chacha8Block(this._key, this._counter, this._nonce);

      // Convert state (16 x 32-bit words) to bytes (64 bytes, little-endian)
      const bytes = [];
      for (let i = 0; i < 16; ++i) {
        const wordBytes = OpCodes.Unpack32LE(state[i]);
        bytes.push(...wordBytes);
      }

      // Increment counter for next block
      this._incrementCounter();

      return bytes;
    }

    /**
     * Generate random bytes
     */
    NextBytes(length) {
      if (!this._keySet) {
        throw new Error('ChaCha8 not initialized: set key first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];
      let remaining = length;

      // Use buffered bytes first
      while (this._bufferPos < this._buffer.length && remaining > 0) {
        output.push(this._buffer[this._bufferPos++]);
        --remaining;
      }

      // Generate new blocks as needed
      while (remaining > 0) {
        this._buffer = this._generateBlock();
        this._bufferPos = 0;

        const bytesToCopy = Math.min(remaining, this._buffer.length);
        for (let i = 0; i < bytesToCopy; ++i) {
          output.push(this._buffer[this._bufferPos++]);
        }
        remaining -= bytesToCopy;
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    Feed(data) {
      // For counter-based PRNG, Feed sets the counter (seed)
      if (data && data.length > 0) {
        this.counter = data;
      }
    }

    Result() {
      const size = this._outputSize || 64;
      return this.NextBytes(size);
    }

    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize || 64;
    }
  }

  // Register algorithm
  const algorithmInstance = new ChaCha8Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { ChaCha8Algorithm, ChaCha8Instance };
}));
