/*
 * KMAC (Keccak Message Authentication Code) - NIST SP 800-185
 * Official NIST keyed hash function based on Keccak/SHA-3
 * Two variants: KMAC128 and KMAC256
 * (c)2006-2025 Hawkynt
 */

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
  /** @type {int32} */
  const KMAC128_RATE = 168;  // Rate in bytes for KMAC128 (same as SHAKE128)
  /** @type {int32} */
  const KMAC256_RATE = 136;  // Rate in bytes for KMAC256 (same as SHAKE256)
  /** @type {int32} */
  const KECCAK_ROUNDS = 24;

  // Keccak round constants (24 rounds), low and high 32-bit halves - FIPS 202 compliant
  /** @type {uint32[]} */
  const RC_LO = [
    0x00000001, 0x00008082, 0x0000808a, 0x80008000, 0x0000808b, 0x80000001, 0x80008081, 0x00008009,
    0x0000008a, 0x00000088, 0x80008009, 0x8000000a, 0x8000808b, 0x0000008b, 0x00008089, 0x00008003,
    0x00008002, 0x00000080, 0x0000800a, 0x8000000a, 0x80008081, 0x00008080, 0x80000001, 0x80008008
  ];
  /** @type {uint32[]} */
  const RC_HI = [
    0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x00000000, 0x00000000, 0x80000000, 0x80000000,
    0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x00000000, 0x80000000, 0x80000000, 0x80000000,
    0x80000000, 0x80000000, 0x00000000, 0x80000000, 0x80000000, 0x80000000, 0x00000000, 0x80000000
  ];

  // Rotation offsets for rho step (standard Keccak-f[1600])
  /** @type {int32[]} */
  const RHO_OFFSETS = [
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ];

  // NIST SP 800-185 encoding functions
  /**
   * left_encode(n), NIST SP 800-185 section 2.3.1
   * @param {uint32} n - Value to encode
   * @returns {uint8[]} Byte count followed by the big-endian bytes of n
   */
  function leftEncode(n) {
    /** @type {uint8[]} */
    const result = [];
    if (n === 0) {
      result.push(1);
      result.push(0);
      return result;
    }
    /** @type {uint32} */
    let value = n;
    while (value > 0) {
      result.unshift(OpCodes.And32(value, 0xFF));
      value = Math.floor(value / 256);
    }
    result.unshift(result.length);
    return result;
  }

  /**
   * right_encode(n), NIST SP 800-185 section 2.3.1
   * @param {uint32} n - Value to encode
   * @returns {uint8[]} The big-endian bytes of n followed by their count
   */
  function rightEncode(n) {
    /** @type {uint8[]} */
    const result = [];
    if (n === 0) {
      result.push(0);
      result.push(1);
      return result;
    }
    /** @type {uint32} */
    let value = n;
    while (value > 0) {
      result.unshift(OpCodes.And32(value, 0xFF));
      value = Math.floor(value / 256);
    }
    result.push(result.length);
    return result;
  }

  /**
   * encode_string(S), NIST SP 800-185 section 2.3.2
   * @param {uint8[]} bytes - String bytes
   * @returns {uint8[]} left_encode(bit length) || bytes
   */
  function encodeString(bytes) {
    const lengthBytes = leftEncode(bytes.length * 8); // Length in bits
    return lengthBytes.concat(bytes);
  }

  /**
   * bytepad(X, w), NIST SP 800-185 section 2.3.3
   * @param {uint8[]} x - Bytes to pad
   * @param {int32} w - Block width in bytes
   * @returns {uint8[]} left_encode(w) || X || zero fill to a multiple of w
   */
  function bytepad(x, w) {
    const wenc = leftEncode(w);
    const z = wenc.concat(x);
    const padLen = w - (z.length % w);
    if (padLen === w) {
      return z;
    }
    return z.concat(OpCodes.CreateArray(padLen, 0));
  }

  /**
   * Low half of a 64-bit left rotation of (high:low)
   * @param {uint32} low - Low 32 bits
   * @param {uint32} high - High 32 bits
   * @param {int32} positions - Rotation amount
   * @returns {uint32} Low 32 bits of the rotated value
   */
  function rotl64Lo(low, high, positions) {
    const n = positions % 64;
    if (n === 0) return low;
    if (n === 32) return high;
    if (n < 32) return OpCodes.Or32(OpCodes.Shl32(low, n), OpCodes.Shr32(high, 32 - n));
    return OpCodes.Or32(OpCodes.Shl32(high, n - 32), OpCodes.Shr32(low, 64 - n));
  }

  /**
   * High half of a 64-bit left rotation of (high:low)
   * @param {uint32} low - Low 32 bits
   * @param {uint32} high - High 32 bits
   * @param {int32} positions - Rotation amount
   * @returns {uint32} High 32 bits of the rotated value
   */
  function rotl64Hi(low, high, positions) {
    const n = positions % 64;
    if (n === 0) return high;
    if (n === 32) return low;
    if (n < 32) return OpCodes.Or32(OpCodes.Shl32(high, n), OpCodes.Shr32(low, 32 - n));
    return OpCodes.Or32(OpCodes.Shl32(low, n - 32), OpCodes.Shr32(high, 64 - n));
  }

  /**
   * Keccak-f[1600] permutation over 25 lanes split into low/high words
   * @param {uint32[]} lo - Low 32 bits of each lane (modified in place)
   * @param {uint32[]} hi - High 32 bits of each lane (modified in place)
   * @returns {void}
   */
  function keccakF(lo, hi) {
    /** @type {uint32[]} */
    const cLo = new Array(5);
    /** @type {uint32[]} */
    const cHi = new Array(5);
    /** @type {uint32[]} */
    const dLo = new Array(5);
    /** @type {uint32[]} */
    const dHi = new Array(5);
    /** @type {uint32[]} */
    const tLo = new Array(25);
    /** @type {uint32[]} */
    const tHi = new Array(25);
    /** @type {uint32[]} */
    const rowLo = new Array(5);
    /** @type {uint32[]} */
    const rowHi = new Array(5);

    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      // Theta step
      for (let x = 0; x < 5; x++) {
        /** @type {uint32} */
        let l = 0;
        /** @type {uint32} */
        let h = 0;
        for (let y = 0; y < 5; y++) {
          l = OpCodes.Xor32(l, lo[x + 5 * y]);
          h = OpCodes.Xor32(h, hi[x + 5 * y]);
        }
        cLo[x] = l;
        cHi[x] = h;
      }

      for (let x = 0; x < 5; x++) {
        const a = (x + 4) % 5;
        const b = (x + 1) % 5;
        dLo[x] = OpCodes.Xor32(cLo[a], rotl64Lo(cLo[b], cHi[b], 1));
        dHi[x] = OpCodes.Xor32(cHi[a], rotl64Hi(cLo[b], cHi[b], 1));
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          lo[x + 5 * y] = OpCodes.Xor32(lo[x + 5 * y], dLo[x]);
          hi[x + 5 * y] = OpCodes.Xor32(hi[x + 5 * y], dHi[x]);
        }
      }

      // Rho step
      for (let i = 0; i < 25; i++) {
        const l = lo[i];
        const h = hi[i];
        lo[i] = rotl64Lo(l, h, RHO_OFFSETS[i]);
        hi[i] = rotl64Hi(l, h, RHO_OFFSETS[i]);
      }

      // Pi step
      for (let i = 0; i < 25; i++) {
        tLo[i] = lo[i];
        tHi[i] = hi[i];
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          const dst = y + 5 * ((2 * x + 3 * y) % 5);
          lo[dst] = tLo[x + 5 * y];
          hi[dst] = tHi[x + 5 * y];
        }
      }

      // Chi step
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          rowLo[x] = lo[x + 5 * y];
          rowHi[x] = hi[x + 5 * y];
        }

        for (let x = 0; x < 5; x++) {
          const n1 = (x + 1) % 5;
          const n2 = (x + 2) % 5;
          lo[x + 5 * y] = OpCodes.Xor32(rowLo[x], OpCodes.And32(OpCodes.Not32(rowLo[n1]), rowLo[n2]));
          hi[x + 5 * y] = OpCodes.Xor32(rowHi[x], OpCodes.And32(OpCodes.Not32(rowHi[n1]), rowHi[n2]));
        }
      }

      // Iota step
      lo[0] = OpCodes.Xor32(lo[0], RC_LO[round]);
      hi[0] = OpCodes.Xor32(hi[0], RC_HI[round]);
    }
  }

  // Keccak-f[1600] sponge state
  class KeccacState {
    constructor() {
      // State is 25 64-bit lanes, each split into a low and a high 32-bit word
      /** @type {uint32[]} */
      this.lo = OpCodes.CreateArray(25, 0);
      /** @type {uint32[]} */
      this.hi = OpCodes.CreateArray(25, 0);
    }

    /**
     * XOR a rate block into the state (little-endian lanes)
     * @param {uint8[]} data - Block of at least rate bytes
     * @param {int32} rate - Sponge rate in bytes (a multiple of 8)
     * @returns {void}
     */
    absorb(data, rate) {
      const limit = Math.min(data.length, rate);
      for (let i = 0; i < limit; i += 8) {
        const stateIndex = Math.floor(i / 8);

        // Pack 8 bytes into two 32-bit words (little-endian)
        const low = OpCodes.Pack32LE(data[i], data[i + 1], data[i + 2], data[i + 3]);
        const high = OpCodes.Pack32LE(data[i + 4], data[i + 5], data[i + 6], data[i + 7]);

        // XOR into state
        this.lo[stateIndex] = OpCodes.Xor32(this.lo[stateIndex], low);
        this.hi[stateIndex] = OpCodes.Xor32(this.hi[stateIndex], high);
      }
    }

    /**
     * Keccak-f[1600] permutation
     * @returns {void}
     */
    permute() {
      keccakF(this.lo, this.hi);
    }

    /**
     * Extract bytes from the state (little-endian)
     * @param {int32} outputLength - Bytes wanted
     * @param {int32} rate - Sponge rate in bytes
     * @returns {uint8[]} outputLength bytes
     */
    squeeze(outputLength, rate) {
      /** @type {uint8[]} */
      const output = [];
      let outputOffset = 0;

      while (outputOffset < outputLength) {
        // Generate rate bytes from current state
        const available = Math.min(rate, outputLength - outputOffset);

        for (let i = 0; i < available && i < rate; i += 8) {
          const stateIndex = Math.floor(i / 8);

          const bytes1 = OpCodes.Unpack32LE(this.lo[stateIndex]);
          const bytes2 = OpCodes.Unpack32LE(this.hi[stateIndex]);

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
 * KMAC instance implementing the Feed/Result pattern
 * @class
 * @extends {IMacInstance}
 */

  class KmacInstance extends IMacInstance {
    /**
     * @param {MacAlgorithm} algorithm - Parent algorithm
     * @param {int32} rate - Sponge rate in bytes
     * @param {int32} outputLength - MAC length in bytes
     */
    constructor(algorithm, rate, outputLength) {
      super(algorithm);
      /** @type {int32} */
      this.rate = rate;
      /** @type {int32} */
      this.outputLength = outputLength;
      /** @type {KeccacState} */
      this.state = new KeccacState();
      /** @type {BlockAbsorber} */
      this._absorber = new BlockAbsorber(rate, block => this._absorbBlock(block));
      /** @type {boolean} */
      this.finalized = false;
      /** @type {uint8[]} */
      this.output = null;
      /** @type {uint8[]} */
      this._key = null;
      /** @type {uint8[]} */
      this._customization = []; // Customization string (S parameter in NIST SP 800-185)
    }

    /**
   * Set the key
   * @param {uint8[]} keyBytes - Key or null to clear
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      this._key = keyBytes.slice();
      this.initialize();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]} Copy of key bytes or null
   */

    get key() {
      if (!this._key) return null;
      return this._key.slice();
    }

    /**
     * Set the customization string (S)
     * @param {uint8[]} custBytes - Customization bytes, null for none
     */
    set customization(custBytes) {
      if (custBytes) this._customization = custBytes.slice();
      else this._customization = [];
      if (this._key) {
        this.initialize(); // Reinitialize if key is already set
      }
    }

    /**
     * Get copy of the customization string
     * @returns {uint8[]} Customization bytes
     */
    get customization() {
      return this._customization.slice();
    }

    /**
     * Restart the sponge and absorb the KMAC prefix and key
     * @returns {void}
     */
    initialize() {
      if (!this._key) return;

      // Reset state
      this.state = new KeccacState();
      this._absorber = new BlockAbsorber(this.rate, block => this._absorbBlock(block));
      this.finalized = false;
      this.output = null;

      // KMAC uses cSHAKE with N = "KMAC" and S = customization string
      // First absorb: bytepad(encode_string("KMAC") || encode_string(S), rate)
      const kmacName = encodeString(OpCodes.AnsiToBytes("KMAC"));
      const encodedCustomization = encodeString(this._customization);
      const prefix = kmacName.concat(encodedCustomization);
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
     * @returns {void}
     */
    absorbWholeBlocks(data) {
      for (let offset = 0; offset < data.length; offset += this.rate) {
        const block = OpCodes.CreateArray(this.rate, 0);
        const toCopy = Math.min(this.rate, data.length - offset);
        for (let i = 0; i < toCopy; i++) block[i] = data[offset + i];
        this._absorbBlock(block);
      }
    }

    /**
     * XOR one full rate block into the sponge and permute.
     * @param {uint8[]} block - exactly rate bytes
     * @returns {void}
     */
    _absorbBlock(block) {
      this.state.absorb(block, this.rate);
      this.state.permute();
    }

    /**
   * Feed message bytes
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
   * Get the MAC
   * @returns {uint8[]} outputLength MAC bytes
   * @throws {Error} If key not set
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.finalized) return this.output.slice();

      // right_encode(L) closes the KMAC message, NIST SP 800-185 section 4.3.
      const outputBits = this.outputLength * 8;
      this._absorber.Absorb(rightEncode(outputBits));

      // pad10*1 with the cSHAKE domain separator 0x04. Separator and
      // terminating bit land on the same byte when exactly one byte of the
      // rate is free and have to merge into a single 0x84; spelling the pad
      // out by hand here instead grew the buffer by a whole spurious rate
      // block, of which only the first was ever absorbed. SpongePadBlocks
      // merges unconditionally and hands back every block it produced.
      this._absorber.Finish((held, pending, total) => {
        for (const block of SpongePadBlocks(held, pending, this.rate, 0x04))
          this._absorbBlock(block);
      });

      // Squeeze output
      this.output = this.state.squeeze(this.outputLength, this.rate);
      this.finalized = true;

      return this.output.slice();
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
   * @param {boolean} [isInverse=false] - True for the inverse, which a MAC does not have
   * @returns {KmacInstance} New MAC instance (null for the inverse)
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
   * @param {boolean} [isInverse=false] - True for the inverse, which a MAC does not have
   * @returns {KmacInstance} New MAC instance (null for the inverse)
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