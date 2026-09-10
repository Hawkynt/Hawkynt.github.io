/*
 * KMAC (Keccak Message Authentication Code) - NIST SP 800-185
 * Official NIST keyed hash function based on Keccak/SHA-3
 * Two variants: KMAC128 and KMAC256
 * (c)2006-2025 Hawkynt
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (REQUIRED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
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
          MacAlgorithm, IMacInstance, TestCase, LinkItem,
          BlockAbsorber, SpongePadBlocks } = AlgorithmFramework;

  // ===== KMAC IMPLEMENTATION =====

  // NIST SP 800-185 KMAC constants
  const KMAC128_RATE = 168;  // Rate in bytes for KMAC128 (same as SHAKE128)
  const KMAC256_RATE = 136;  // Rate in bytes for KMAC256 (same as SHAKE256)
  const KECCAK_ROUNDS = 24;

  // Keccak round constants (24 rounds, as [low32, high32] pairs) - FIPS 202 compliant
  const RC = Object.freeze([
    [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
    [0x0000808b, 0x00000000], [0x80000001, 0x00000000], [0x80008081, 0x80000000], [0x00008009, 0x80000000],
    [0x0000008a, 0x00000000], [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
    [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000], [0x00008003, 0x80000000],
    [0x00008002, 0x80000000], [0x00000080, 0x80000000], [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
    [0x80008081, 0x80000000], [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000]
  ]);

  // Rotation offsets for rho step (standard Keccak-f[1600])
  const RHO_OFFSETS = Object.freeze([
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ]);

  // NIST SP 800-185 encoding functions
  function leftEncode(n) {
    if (n === 0) return [1, 0];
    const result = [];
    let value = n;
    while (value > 0) {
      result.unshift(value&0xff); // Native AND for integer operations
      value = Math.floor(value / 256);
    }
    result.unshift(result.length);
    return result;
  }

  function rightEncode(n) {
    if (n === 0) return [0, 1];
    const result = [];
    let value = n;
    while (value > 0) {
      result.unshift(value&0xff); // Native AND for integer operations
      value = Math.floor(value / 256);
    }
    result.push(result.length);
    return result;
  }

  function encodeString(s) {
    const bytes = typeof s === 'string' ? OpCodes.AnsiToBytes(s) : s;
    const lengthBytes = leftEncode(bytes.length * 8); // Length in bits
    return [...lengthBytes, ...bytes];
  }

  function bytepad(x, w) {
    // NIST SP 800-185: bytepad(X, w) = left_encode(w) || X || 00...00
    // where padding is applied so total length is multiple of w
    const wenc = leftEncode(w);
    const z = [...wenc, ...x];
    const padLen = w - (z.length % w);
    if (padLen === w) {
      return z;
    }
    return [...z, ...new Array(padLen).fill(0)];
  }

  // Helper functions for 64-bit operations
  function xor64(a, b) {
    return [OpCodes.XorN(a[0], b[0]), OpCodes.XorN(a[1], b[1])];
  }

  function rotl64(val, positions) {
    const [low, high] = val;
    positions %= 64;

    if (positions === 0) return [low, high];

    if (positions === 32) {
      return [high, low];
    } else if (positions < 32) {
      // Manual 64-bit rotation across two 32-bit words (no OpCodes equivalent for split 64-bit rotations)
      const newLow = OpCodes.OrN(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions));
      const newHigh = OpCodes.OrN(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions));
      return [newLow, newHigh];
    } else {
      positions -= 32;
      const newLow = OpCodes.OrN(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions));
      const newHigh = OpCodes.OrN(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions));
      return [newLow, newHigh];
    }
  }

  // Keccak-f[1600] permutation
  function keccakF(state) {
    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      // Theta step
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = [0, 0];
        for (let y = 0; y < 5; y++) {
          C[x] = xor64(C[x], state[x + 5 * y]);
        }
      }

      const D = new Array(5);
      for (let x = 0; x < 5; x++) {
        D[x] = xor64(C[(x + 4) % 5], rotl64(C[(x + 1) % 5], 1));
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[x + 5 * y] = xor64(state[x + 5 * y], D[x]);
        }
      }

      // Rho step
      for (let i = 0; i < 25; i++) {
        state[i] = rotl64(state[i], RHO_OFFSETS[i]);
      }

      // Pi step
      const temp = new Array(25);
      for (let i = 0; i < 25; i++) {
        temp[i] = [state[i][0], state[i][1]];
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[y + 5 * ((2 * x + 3 * y) % 5)] = temp[x + 5 * y];
        }
      }

      // Chi step
      for (let y = 0; y < 5; y++) {
        const row = new Array(5);
        for (let x = 0; x < 5; x++) {
          row[x] = [state[x + 5 * y][0], state[x + 5 * y][1]];
        }

        for (let x = 0; x < 5; x++) {
          const notNext = [~row[(x + 1) % 5][0], ~row[(x + 1) % 5][1]]; // Native NOT
          const andResult = [OpCodes.AndN(notNext[0], row[(x + 2) % 5][0]), OpCodes.AndN(notNext[1], row[(x + 2) % 5][1])];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }

      // Iota step
      state[0] = xor64(state[0], RC[round]);
    }
  }

  // Keccak-f[1600] permutation implementation
  class KeccacState {
    constructor() {
      // State is 25 64-bit words, each as [low32, high32]
      this.state = new Array(25);
      for (let i = 0; i < 25; i++) {
        this.state[i] = [0, 0];
      }
    }

    // Convert byte array to state (little-endian)
    absorb(data, rate) {
      for (let i = 0; i < Math.min(data.length, rate); i += 8) {
        const stateIndex = Math.floor(i / 8);

        // Pack 8 bytes into two 32-bit words (little-endian)
        const low = OpCodes.Pack32LE(
          data[i] || 0,
          data[i + 1] || 0,
          data[i + 2] || 0,
          data[i + 3] || 0
        );
        const high = OpCodes.Pack32LE(
          data[i + 4] || 0,
          data[i + 5] || 0,
          data[i + 6] || 0,
          data[i + 7] || 0
        );

        // XOR into state
        this.state[stateIndex][0] ^= low;
        this.state[stateIndex][1] ^= high;
      }
    }

    // Keccak-f[1600] permutation
    permute() {
      keccakF(this.state);
    }

    // Extract bytes from state (little-endian)
    squeeze(outputLength, rate) {
      const output = [];
      let outputOffset = 0;

      while (outputOffset < outputLength) {
        // Generate rate bytes from current state
        const available = Math.min(rate, outputLength - outputOffset);

        for (let i = 0; i < available && i < rate; i += 8) {
          const stateIndex = Math.floor(i / 8);
          const word = this.state[stateIndex];

          const bytes1 = OpCodes.Unpack32LE(word[0]);
          const bytes2 = OpCodes.Unpack32LE(word[1]);

          for (let j = 0; j < 4 && outputOffset < outputLength; j++) {
            output.push(bytes1[j]);
            outputOffset++;
          }
          for (let j = 0; j < 4 && outputOffset < outputLength; j++) {
            output.push(bytes2[j]);
            outputOffset++;
          }
        }

        // If we need more output, apply Keccak-f again
        if (outputOffset < outputLength) {
          this.permute();
        }
      }

      return output.slice(0, outputLength);
    }
  }

  // KMAC instance implementation
  /**
 * Kmac cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class KmacInstance extends IMacInstance {
    constructor(algorithm, rate, outputLength) {
      super(algorithm);
      this.rate = rate;
      this.outputLength = outputLength;
      this.state = new KeccacState();
      this._absorber = new BlockAbsorber(rate, block => this._absorbBlock(block));
      this.finalized = false;
      this.output = null;
      this._key = null;
      this._customization = []; // Customization string (S parameter in NIST SP 800-185)
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      this._key = [...keyBytes];
      this.initialize();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Property for customization string
    set customization(custBytes) {
      this._customization = custBytes ? [...custBytes] : [];
      if (this._key) {
        this.initialize(); // Reinitialize if key is already set
      }
    }

    get customization() {
      return this._customization ? [...this._customization] : [];
    }

    initialize() {
      if (!this._key) return;

      // Reset state
      this.state = new KeccacState();
      this._absorber = new BlockAbsorber(this.rate, block => this._absorbBlock(block));
      this.finalized = false;
      this.output = null;

      // KMAC uses cSHAKE with N = "KMAC" and S = customization string
      // First absorb: bytepad(encode_string("KMAC") || encode_string(S), rate)
      const kmacName = encodeString("KMAC");
      const encodedCustomization = encodeString(this._customization);
      const prefix = [...kmacName, ...encodedCustomization];
      this.absorbWholeBlocks(bytepad(prefix, this.rate));

      // Second absorb: bytepad(encode_string(K), rate)
      const encodedKey = encodeString(this._key);
      this.absorbWholeBlocks(bytepad(encodedKey, this.rate));
    }

    /**
     * Absorb data that bytepad has already rounded up to whole rate blocks.
     * bytepad (NIST SP 800-185 section 2.3.3) is a zero fill to a rate
     * boundary, not the sponge's pad10*1 - it carries neither a domain
     * separator nor a terminating bit - so it goes straight into the sponge
     * and leaves the message absorber starting on a block boundary.
     * @param {uint8[]} data - length is a multiple of the rate
     */
    absorbWholeBlocks(data) {
      for (let offset = 0; offset < data.length; offset += this.rate) {
        const block = new Array(this.rate).fill(0);
        const toCopy = Math.min(this.rate, data.length - offset);
        for (let i = 0; i < toCopy; i++) block[i] = data[offset + i];
        this._absorbBlock(block);
      }
    }

    /**
     * XOR one full rate block into the sponge and permute.
     * @param {uint8[]} block - exactly rate bytes
     */
    _absorbBlock(block) {
      this.state.absorb(block, this.rate);
      this.state.permute();
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      if (this.finalized) throw new Error("Cannot feed data after finalization");

      this._absorber.Absorb(data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.finalized) return [...this.output];

      // right_encode(L) closes the KMAC message, NIST SP 800-185 section 4.3.
      const outputBits = this.outputLength * 8;
      this._absorber.Absorb(rightEncode(outputBits));

      // pad10*1 with the cSHAKE domain separator 0x04. Separator and
      // terminating bit land on the same byte when exactly one byte of the
      // rate is free and have to merge into a single 0x84; spelling the pad
      // out by hand here instead grew the buffer by a whole spurious rate
      // block, of which only the first was ever absorbed. SpongePadBlocks
      // merges unconditionally and hands back every block it produced.
      for (const block of this._absorber.Finish((held, pending) =>
        SpongePadBlocks(held, pending, this.rate, 0x04)))
        this._absorbBlock(block);

      // Squeeze output
      this.output = this.state.squeeze(this.outputLength, this.rate);
      this.finalized = true;

      return [...this.output];
    }
  }

  // KMAC128 Algorithm
  class Kmac128Algorithm extends MacAlgorithm {
    constructor() {
      super();
      this.name = "KMAC128";
      this.description = "KMAC128 - NIST SP 800-185 Keccak Message Authentication Code with 128-bit security.";
      this.inventor = "NIST";
      this.year = 2016;
      this.category = CategoryType.MAC;
      this.subCategory = "Keyed Hash";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("NIST SP 800-185", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf"),
        new LinkItem("KMAC Specification", "https://csrc.nist.gov/publications/detail/sp/800-185/final"),
        new LinkItem("Noble Hashes Implementation", "https://github.com/paulmillr/noble-hashes")
      ];

      this.references = [
        new LinkItem("Bouncy Castle KMAC Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/KMAC.java"),
        new LinkItem("PyCryptodome KMAC128 Implementation", "https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/Hash/KMAC128.py")
      ];

      this.tests = [
        {
          text: "KMAC128 Sample #1 from NIST SP 800-185",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf",
          input: OpCodes.Hex8ToBytes("00010203"),
          key: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          customization: [], // Empty customization string
          expected: OpCodes.Hex8ToBytes("e5780b0d3ea6f7d3a429c5706aa43a00fadbd7d49628839e3187243f456ee14e")
        },
        {
          text: "KMAC128 Sample #2 from NIST SP 800-185 (with customization)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf",
          input: OpCodes.Hex8ToBytes("00010203"),
          key: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          customization: OpCodes.AnsiToBytes("My Tagged Application"),
          expected: OpCodes.Hex8ToBytes("3b1fba963cd8b0b59e8c1a6d71888b7143651af8ba0a7070c0979e2811324aa5")
        },
        {
          text: "KMAC128 Sample #3 from NIST SP 800-185 (200-byte message, with customization)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf",
          input: OpCodes.Hex8ToBytes(
            "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F" +
            "202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F" +
            "404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F" +
            "606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F" +
            "808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9F" +
            "A0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF" +
            "C0C1C2C3C4C5C6C7"),
          key: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          customization: OpCodes.AnsiToBytes("My Tagged Application"),
          expected: OpCodes.Hex8ToBytes("1f5b4e6cca02209e0dcb5ca635b89a15e271ecc760071dfd805faa38f9729230")
        },
        {
          // 164 message bytes plus the three bytes of right_encode(256) fill the
          // 168-byte rate to within a single byte, so the cSHAKE domain
          // separator 0x04 and the pad10*1 terminating bit share that byte and
          // must merge into 0x84. Every NIST sample message is shorter than the
          // rate, which is why this case went unnoticed. The expected value is
          // the SP 800-185 section 4.3 definition of KMAC evaluated over this
          // repository's cSHAKE128, which reproduces all six published KMAC
          // samples and is itself checked against the SHAKE128 XOF.
          text: "KMAC128 rate boundary: 164-byte message merges pad10*1 into the domain separator",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf",
          input: OpCodes.Hex8ToBytes(
            "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F" +
            "202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F" +
            "404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F" +
            "606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F" +
            "808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9F" +
            "A0A1A2A3"),
          key: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          customization: [],
          expected: OpCodes.Hex8ToBytes("5719373e3073956c9b1b54453b95ff62b9d8a787c734c9781e78c4164d10667d")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // MACs have no inverse
      return new KmacInstance(this, KMAC128_RATE, 32);
    }
  }

  // KMAC256 Algorithm
  class Kmac256Algorithm extends MacAlgorithm {
    constructor() {
      super();
      this.name = "KMAC256";
      this.description = "KMAC256 - NIST SP 800-185 Keccak Message Authentication Code with 256-bit security.";
      this.inventor = "NIST";
      this.year = 2016;
      this.category = CategoryType.MAC;
      this.subCategory = "Keyed Hash";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.documentation = [
        new LinkItem("NIST SP 800-185", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf"),
        new LinkItem("KMAC Specification", "https://csrc.nist.gov/publications/detail/sp/800-185/final"),
        new LinkItem("Noble Hashes Implementation", "https://github.com/paulmillr/noble-hashes")
      ];

      this.references = [
        new LinkItem("Bouncy Castle KMAC Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/macs/KMAC.java"),
        new LinkItem("PyCryptodome KMAC256 Implementation", "https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/Hash/KMAC256.py")
      ];

      this.tests = [
        {
          text: "KMAC256 Sample #4 from NIST SP 800-185",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf",
          input: OpCodes.Hex8ToBytes("00010203"),
          key: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          customization: OpCodes.AnsiToBytes("My Tagged Application"),
          expected: OpCodes.Hex8ToBytes("20c570c31346f703c9ac36c61c03cb64c3970d0cfc787e9b79599d273a68d2f7f69d4cc3de9d104a351689f27cf6f5951f0103f33f4f24871024d9c27773a8dd")
        },
        {
          text: "KMAC256 Sample #5 from NIST SP 800-185 (no customization)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf",
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7"),
          key: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          customization: [],
          expected: OpCodes.Hex8ToBytes("75358cf39e41494e949707927cee0af20a3ff553904c86b08f21cc414bcfd691589d27cf5e15369cbbff8b9a4c2eb17800855d0235ff635da82533ec6b759b69")
        },
        {
          text: "KMAC256 Sample #6 from NIST SP 800-185 (200-byte message, with customization)",
          uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf",
          input: OpCodes.Hex8ToBytes(
            "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F" +
            "202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F" +
            "404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F" +
            "606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F" +
            "808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9F" +
            "A0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF" +
            "C0C1C2C3C4C5C6C7"),
          key: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          customization: OpCodes.AnsiToBytes("My Tagged Application"),
          expected: OpCodes.Hex8ToBytes("b58618f71f92e1d56c1b8c55ddd7cd188b97b4ca4d99831eb2699a837da2e4d970fbacfde50033aea585f1a2708510c32d07880801bd182898fe476876fc8965")
        },
        {
          // 132 message bytes plus the three bytes of right_encode(512) fill the
          // 136-byte rate to within a single byte, so the cSHAKE domain
          // separator 0x04 and the pad10*1 terminating bit share that byte and
          // must merge into 0x84. See the KMAC128 boundary case above for how
          // the expected value was derived.
          text: "KMAC256 rate boundary: 132-byte message merges pad10*1 into the domain separator",
          uri: "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf",
          input: OpCodes.Hex8ToBytes(
            "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F" +
            "202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F" +
            "404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F" +
            "606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F" +
            "80818283"),
          key: OpCodes.Hex8ToBytes("404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f"),
          customization: [],
          expected: OpCodes.Hex8ToBytes("10b07e27533954705aee9771c4325a3028d97e9c5ff731d30ebc94c7249bad3f8203f4d5ff61e4a762a4a4ceadc65234f2a8cca7650977899f34e296b3cfa268")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null; // MACs have no inverse
      return new KmacInstance(this, KMAC256_RATE, 64);
    }
  }

  // Register algorithms
  RegisterAlgorithm(new Kmac128Algorithm());
  RegisterAlgorithm(new Kmac256Algorithm());

  return {
    Kmac128Algorithm,
    Kmac256Algorithm,
    KmacInstance
  };

}));