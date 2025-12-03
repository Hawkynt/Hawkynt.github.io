/*
 * cSHAKE - Customizable SHAKE (128/256)
 * Professional implementation following NIST SP 800-185
 * (c)2006-2025 Hawkynt
 *
 * cSHAKE128 and cSHAKE256 are customizable extendable-output functions (XOF) based on SHAKE
 * Allows function name (N) and customization string (S) parameters
 * Reference: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf
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
    root.cSHAKE = factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Keccak constants shared by all variants
  const ROUNDS = 24;

  // Keccak round constants
  const RC = Object.freeze([
    [0x00000001, 0x00000000], [0x00008082, 0x00000000], [0x0000808a, 0x80000000], [0x80008000, 0x80000000],
    [0x0000808b, 0x00000000], [0x80000001, 0x00000000], [0x80008081, 0x80000000], [0x00008009, 0x80000000],
    [0x0000008a, 0x00000000], [0x00000088, 0x00000000], [0x80008009, 0x00000000], [0x8000000a, 0x00000000],
    [0x8000808b, 0x00000000], [0x0000008b, 0x80000000], [0x00008089, 0x80000000], [0x00008003, 0x80000000],
    [0x00008002, 0x80000000], [0x00000080, 0x80000000], [0x0000800a, 0x00000000], [0x8000000a, 0x80000000],
    [0x80008081, 0x80000000], [0x00008080, 0x80000000], [0x80000001, 0x00000000], [0x80008008, 0x80000000]
  ]);

  const RHO_OFFSETS = Object.freeze([
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ]);

  function xor64(a, b) { return [OpCodes.XorN(a[0], b[0]), OpCodes.XorN(a[1], b[1])]; }

  function rotl64(val, positions) {
    const [low, high] = val;
    positions %= 64;
    if (positions === 0) return [low, high];
    if (positions === 32) return [high, low];

    if (positions < 32) {
      return [
        OpCodes.OrN(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions)),
        OpCodes.OrN(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions))
      ];
    }

    positions -= 32;
    return [
      OpCodes.OrN(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions)),
      OpCodes.OrN(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions))
    ];
  }

  function keccakF(state) {
    for (let round = 0; round < ROUNDS; round++) {
      // Theta
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        C[x] = [0, 0];
        for (let y = 0; y < 5; y++) C[x] = xor64(C[x], state[x + 5 * y]);
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

      // Rho
      for (let i = 0; i < 25; i++) {
        state[i] = rotl64(state[i], RHO_OFFSETS[i]);
      }

      // Pi
      const temp = new Array(25);
      for (let i = 0; i < 25; i++) temp[i] = [state[i][0], state[i][1]];
      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[y + 5 * ((2 * x + 3 * y) % 5)] = temp[x + 5 * y];
        }
      }

      // Chi
      for (let y = 0; y < 5; y++) {
        const row = new Array(5);
        for (let x = 0; x < 5; x++) row[x] = [state[x + 5 * y][0], state[x + 5 * y][1]];
        for (let x = 0; x < 5; x++) {
          const notNext = [~row[(x + 1) % 5][0], ~row[(x + 1) % 5][1]];
          const andResult = [OpCodes.AndN(notNext[0], row[(x + 2) % 5][0]), OpCodes.AndN(notNext[1], row[(x + 2) % 5][1])];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }

      // Iota
      state[0] = xor64(state[0], RC[round]);
    }
  }

  /**
   * leftEncode from NIST SP 800-185
   * Encodes integer with byte count prefix
   */
  function leftEncode(value) {
    // Determine number of bytes needed
    let n = 1;
    let v = value;
    while (OpCodes.Shr32(v, 8) !== 0) {
      v = OpCodes.Shr32(v, 8);
      n++;
    }

    const result = new Array(n + 1);
    result[0] = n; // Byte count prefix

    // Encode value in big-endian
    for (let i = 1; i <= n; i++) {
      result[i] = OpCodes.AndN(OpCodes.Shr32(value, 8 * (n - i)), 0xFF);
    }

    return result;
  }

  /**
   * encodeString from NIST SP 800-185
   * Encodes string as leftEncode(bitLength) || string
   */
  function encodeString(str) {
    if (!str || str.length === 0) {
      return leftEncode(0);
    }

    const bitLength = str.length * 8;
    const encoded = leftEncode(bitLength);
    return encoded.concat(str);
  }

  /**
 * cSHAKEAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class cSHAKEAlgorithm extends HashFunctionAlgorithm {
    constructor(variant = '128') {
      super();
      const config = this._getVariantConfig(variant);

      this.variant = variant;
      this.name = `cSHAKE${variant}`;
      this.description = config.description;
      this.inventor = "NIST";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "Extendable-Output Function";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      this.rate = config.rate;
      this.capacity = config.capacity;
      this.securityLevel = config.securityLevel;

      this.SupportedHashSizes = [new KeySize(1, 1024, 1)]; // Variable output
      this.BlockSize = config.rate;

      this.documentation = [
        new LinkItem("NIST SP 800-185", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf"),
        new LinkItem("Keccak Team", "https://keccak.team/")
      ];

      this.references = [
        new LinkItem("BouncyCastle Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/CSHAKEDigest.java"),
        new LinkItem("NIST Examples", "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf")
      ];

      this.tests = config.tests;
    }

    _getVariantConfig(variant) {
      const configs = {
        '128': {
          description: "cSHAKE128 is a customizable extendable-output function based on SHAKE128 from NIST SP 800-185. Supports function name and customization string parameters for domain separation.",
          rate: 168,           // 1344 bits
          capacity: 256,       // 256 bits (128-bit security)
          securityLevel: 128,
          tests: [
            {
              text: "cSHAKE128: 00010203, S='Email Signature', 32 bytes (NIST)",
              uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf",
              input: OpCodes.Hex8ToBytes("00010203"),
              customization: OpCodes.AnsiToBytes("Email Signature"),
              outputSize: 32,
              expected: OpCodes.Hex8ToBytes("c1c36925b6409a04f1b504fcbca9d82b4017277cb5ed2b2065fc1d3814d5aaf5")
            },
            {
              text: "cSHAKE128: 200 bytes, S='Email Signature', 32 bytes (NIST)",
              uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf",
              input: OpCodes.Hex8ToBytes(
                "000102030405060708090A0B0C0D0E0F" +
                "101112131415161718191A1B1C1D1E1F" +
                "202122232425262728292A2B2C2D2E2F" +
                "303132333435363738393A3B3C3D3E3F" +
                "404142434445464748494A4B4C4D4E4F" +
                "505152535455565758595A5B5C5D5E5F" +
                "606162636465666768696A6B6C6D6E6F" +
                "707172737475767778797A7B7C7D7E7F" +
                "808182838485868788898A8B8C8D8E8F" +
                "909192939495969798999A9B9C9D9E9F" +
                "A0A1A2A3A4A5A6A7A8A9AAABACADAEAF" +
                "B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF" +
                "C0C1C2C3C4C5C6C7"
              ),
              customization: OpCodes.AnsiToBytes("Email Signature"),
              outputSize: 32,
              expected: OpCodes.Hex8ToBytes("C5221D50E4F822D96A2E8881A961420F294B7B24FE3D2094BAED2C6524CC166B")
            }
          ]
        },
        '256': {
          description: "cSHAKE256 is a customizable extendable-output function based on SHAKE256 from NIST SP 800-185. Supports function name and customization string parameters for domain separation.",
          rate: 136,           // 1088 bits
          capacity: 512,       // 512 bits (256-bit security)
          securityLevel: 256,
          tests: [
            {
              text: "cSHAKE256: 00010203, S='Email Signature', 64 bytes (NIST)",
              uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf",
              input: OpCodes.Hex8ToBytes("00010203"),
              customization: OpCodes.AnsiToBytes("Email Signature"),
              outputSize: 64,
              expected: OpCodes.Hex8ToBytes(
                "D008828E2B80AC9D2218FFEE1D070C48" +
                "B8E4C87BFF32C9699D5B6896EEE0EDD1" +
                "64020E2BE0560858D9C00C037E34A969" +
                "37C561A74C412BB4C746469527281C8C"
              )
            },
            {
              text: "cSHAKE256: 200 bytes, S='Email Signature', 64 bytes (NIST)",
              uri: "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf",
              input: OpCodes.Hex8ToBytes(
                "000102030405060708090A0B0C0D0E0F" +
                "101112131415161718191A1B1C1D1E1F" +
                "202122232425262728292A2B2C2D2E2F" +
                "303132333435363738393A3B3C3D3E3F" +
                "404142434445464748494A4B4C4D4E4F" +
                "505152535455565758595A5B5C5D5E5F" +
                "606162636465666768696A6B6C6D6E6F" +
                "707172737475767778797A7B7C7D7E7F" +
                "808182838485868788898A8B8C8D8E8F" +
                "909192939495969798999A9B9C9D9E9F" +
                "A0A1A2A3A4A5A6A7A8A9AAABACADAEAF" +
                "B0B1B2B3B4B5B6B7B8B9BABBBCBDBEBF" +
                "C0C1C2C3C4C5C6C7"
              ),
              customization: OpCodes.AnsiToBytes("Email Signature"),
              outputSize: 64,
              expected: OpCodes.Hex8ToBytes(
                "07DC27B11E51FBAC75BC7B3C1D983E8B" +
                "4B85FB1DEFAF218912AC864302730917" +
                "27F42B17ED1DF63E8EC118F04B23633C" +
                "1DFB1574C8FB55CB45DA8E25AFB092BB"
              )
            }
          ]
        }
      };
      return configs[variant] || configs['128'];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new cSHAKEInstance(this);
    }
  }

  /**
 * cSHAKE cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class cSHAKEInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.state = new Array(25);
      for (let i = 0; i < 25; i++) this.state[i] = [0, 0];
      this.rate = algorithm.rate;
      this.buffer = new Uint8Array(this.rate);
      this.bufferLength = 0;
      this._outputSize = algorithm.variant === '256' ? 64 : 32; // Default based on variant
      this._functionName = []; // N parameter (usually empty, reserved for NIST)
      this._customization = []; // S parameter (customization string)
      this._isCustomized = false; // Track if we've applied customization
    }

    set outputSize(size) {
      if (size < 1 || size > 1024) {
        throw new Error(`Invalid output size: ${size} bytes`);
      }
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize;
    }

    set functionName(nameBytes) {
      this._functionName = nameBytes ? [...nameBytes] : [];
    }

    get functionName() {
      return this._functionName ? [...this._functionName] : [];
    }

    set customization(customBytes) {
      this._customization = customBytes ? [...customBytes] : [];
    }

    get customization() {
      return this._customization ? [...this._customization] : [];
    }

    /**
     * Apply bytepad with customization parameters
     * Called before processing input data
     */
    _applyCustomization() {
      if (this._isCustomized) return;
      this._isCustomized = true;

      // If both N and S are empty, behave like SHAKE (no customization needed)
      if ((!this._functionName || this._functionName.length === 0) &&
          (!this._customization || this._customization.length === 0)) {
        return;
      }

      // Build diff = leftEncode(rate) || encodeString(N) || encodeString(S)
      const diff = [];

      // leftEncode(rate)
      diff.push(...leftEncode(this.rate));

      // encodeString(N)
      diff.push(...encodeString(this._functionName));

      // encodeString(S)
      diff.push(...encodeString(this._customization));

      // Absorb diff with bytepad to block boundary
      let offset = 0;
      while (offset < diff.length) {
        const toCopy = Math.min(this.rate - this.bufferLength, diff.length - offset);
        for (let i = 0; i < toCopy; i++) {
          this.buffer[this.bufferLength++] = diff[offset++];
        }

        if (this.bufferLength === this.rate) {
          this._absorb();
          this.bufferLength = 0;
        }
      }

      // Pad to block boundary (bytepad)
      if (this.bufferLength > 0) {
        while (this.bufferLength < this.rate) {
          this.buffer[this.bufferLength++] = 0;
        }
        this._absorb();
        this.bufferLength = 0;
      }
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;

      // Apply customization before first input
      this._applyCustomization();

      let offset = 0;
      while (offset < data.length && this.bufferLength < this.rate) {
        this.buffer[this.bufferLength++] = data[offset++];
      }

      while (this.bufferLength === this.rate) {
        this._absorb();
        this.bufferLength = 0;
        while (offset < data.length && this.bufferLength < this.rate) {
          this.buffer[this.bufferLength++] = data[offset++];
        }
      }
    }

    _absorb() {
      for (let i = 0; i < this.rate; i += 8) {
        const idx = Math.floor(i / 8);
        const low = OpCodes.Pack32LE(this.buffer[i] || 0, this.buffer[i+1] || 0, this.buffer[i+2] || 0, this.buffer[i+3] || 0);
        const high = OpCodes.Pack32LE(this.buffer[i+4] || 0, this.buffer[i+5] || 0, this.buffer[i+6] || 0, this.buffer[i+7] || 0);
        this.state[idx][0] ^= low;
        this.state[idx][1] ^= high;
      }
      keccakF(this.state);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Apply customization if not already done
      this._applyCustomization();

      // Determine domain separation byte
      const hasCustomization = (this._functionName && this._functionName.length > 0) ||
                               (this._customization && this._customization.length > 0);
      const domainByte = hasCustomization ? 0x04 : 0x1F; // 0x04 for cSHAKE, 0x1F for SHAKE

      // Padding: domain_byte || zeros || 0x80
      this.buffer[this.bufferLength] = domainByte;
      for (let i = this.bufferLength + 1; i < this.rate - 1; i++) this.buffer[i] = 0;
      this.buffer[this.rate - 1] = 0x80;
      this._absorb();

      // Squeeze output
      const output = new Uint8Array(this._outputSize);
      let outputOffset = 0;

      while (outputOffset < this._outputSize) {
        for (let i = 0; i < this.rate && outputOffset < this._outputSize; i += 8) {
          const idx = Math.floor(i / 8);
          const bytes1 = OpCodes.Unpack32LE(this.state[idx][0]);
          const bytes2 = OpCodes.Unpack32LE(this.state[idx][1]);

          for (let j = 0; j < 4 && outputOffset < this._outputSize; j++) output[outputOffset++] = bytes1[j];
          for (let j = 0; j < 4 && outputOffset < this._outputSize; j++) output[outputOffset++] = bytes2[j];
        }

        if (outputOffset < this._outputSize) {
          keccakF(this.state);
        }
      }

      return Array.from(output);
    }
  }

  // Register both variants
  const cshake128 = new cSHAKEAlgorithm('128');
  const cshake256 = new cSHAKEAlgorithm('256');

  if (!AlgorithmFramework.Find(cshake128.name)) {
    RegisterAlgorithm(cshake128);
  }
  if (!AlgorithmFramework.Find(cshake256.name)) {
    RegisterAlgorithm(cshake256);
  }

  return { cSHAKEAlgorithm, cSHAKEInstance };
}));
