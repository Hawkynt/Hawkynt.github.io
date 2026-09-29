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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize,
          BlockAbsorber, SpongePadBlocks } = AlgorithmFramework;

  // Keccak constants shared by all variants
  /** @type {int32} */
  const KECCAK_ROUNDS = 24;

  // Keccak round constants (24 rounds) - FIPS 202 compliant, split into the
  // low and high 32-bit halves of each 64-bit lane constant
  const RC_LO = OpCodes.Hex32ToDWords(
    '00000001' + '00008082' + '0000808a' + '80008000' + '0000808b' + '80000001' + '80008081' + '00008009' +
    '0000008a' + '00000088' + '80008009' + '8000000a' + '8000808b' + '0000008b' + '00008089' + '00008003' +
    '00008002' + '00000080' + '0000800a' + '8000000a' + '80008081' + '00008080' + '80000001' + '80008008'
  );
  const RC_HI = OpCodes.Hex32ToDWords(
    '00000000' + '00000000' + '80000000' + '80000000' + '00000000' + '00000000' + '80000000' + '80000000' +
    '00000000' + '00000000' + '00000000' + '00000000' + '00000000' + '80000000' + '80000000' + '80000000' +
    '80000000' + '80000000' + '00000000' + '80000000' + '80000000' + '80000000' + '00000000' + '80000000'
  );

  // Rotation offsets for rho step
  /** @type {int32[]} */
  const RHO_OFFSETS = [
    0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41,
    45, 15, 21, 8, 18, 2, 61, 56, 14
  ];

  /**
   * 64-bit XOR operation
   * @param {uint32[]} a - [low32, high32]
   * @param {uint32[]} b - [low32, high32]
   * @returns {uint32[]} XOR result [low32, high32]
   */
  function xor64(a, b) {
    /** @type {uint32[]} */
    const r = [OpCodes.Xor32(a[0], b[0]), OpCodes.Xor32(a[1], b[1])];
    return r;
  }

  /**
   * 64-bit left rotation (using 32-bit operations)
   * @param {uint32[]} val - [low32, high32]
   * @param {int32} positions - Rotation positions
   * @returns {uint32[]} Rotated [low32, high32]
   */
  function rotl64(val, positions) {
    const low = val[0];
    const high = val[1];
    positions %= 64;

    /** @type {uint32[]} */
    const r = [low, high];
    if (positions === 0) return r;
    if (positions === 32) {
      r[0] = high;
      r[1] = low;
      return r;
    }

    if (positions < 32) {
      r[0] = OpCodes.Or32(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions));
      r[1] = OpCodes.Or32(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions));
      return r;
    }

    positions -= 32;
    r[0] = OpCodes.Or32(OpCodes.Shl32(high, positions), OpCodes.Shr32(low, 32 - positions));
    r[1] = OpCodes.Or32(OpCodes.Shl32(low, positions), OpCodes.Shr32(high, 32 - positions));
    return r;
  }

  /**
   * Keccak-f[1600] permutation
   * @param {uint32[][]} state - 25 x [low32, high32] state array
   * @returns {void}
   */
  function keccakF(state) {
    for (let round = 0; round < KECCAK_ROUNDS; round++) {
      // Theta step
      /** @type {uint32[][]} */
      const C = new Array(5);
      for (let x = 0; x < 5; x++) {
        /** @type {uint32[]} */
        const zero = [0, 0];
        C[x] = zero;
        for (let y = 0; y < 5; y++) {
          C[x] = xor64(C[x], state[x + 5 * y]);
        }
      }

      /** @type {uint32[][]} */
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
      /** @type {uint32[][]} */
      const temp = new Array(25);
      for (let i = 0; i < 25; i++) {
        temp[i] = state[i].slice();
      }

      for (let x = 0; x < 5; x++) {
        for (let y = 0; y < 5; y++) {
          state[y + 5 * ((2 * x + 3 * y) % 5)] = temp[x + 5 * y];
        }
      }

      // Chi step
      for (let y = 0; y < 5; y++) {
        /** @type {uint32[][]} */
        const row = new Array(5);
        for (let x = 0; x < 5; x++) {
          row[x] = state[x + 5 * y].slice();
        }

        for (let x = 0; x < 5; x++) {
          /** @type {uint32[]} */
          const andResult = [
            OpCodes.And32(OpCodes.Not32(row[(x + 1) % 5][0]), row[(x + 2) % 5][0]),
            OpCodes.And32(OpCodes.Not32(row[(x + 1) % 5][1]), row[(x + 2) % 5][1])
          ];
          state[x + 5 * y] = xor64(row[x], andResult);
        }
      }

      // Iota step
      /** @type {uint32[]} */
      const rc = [RC_LO[round], RC_HI[round]];
      state[0] = xor64(state[0], rc);
    }
  }

  /**
   * leftEncode from NIST SP 800-185
   * Encodes integer with byte count prefix
   * @param {uint32} value - Integer to encode
   * @returns {uint8[]} Byte count followed by the big-endian value
   */
  function leftEncode(value) {
    // Determine number of bytes needed
    let n = 1;
    let v = value;
    while (OpCodes.Shr32(v, 8) !== 0) {
      v = OpCodes.Shr32(v, 8);
      n++;
    }

    /** @type {uint8[]} */
    const result = [n]; // Byte count prefix

    // Encode value in big-endian
    for (let i = 1; i <= n; i++) {
      result.push(OpCodes.GetByte(value, n - i));
    }

    return result;
  }

  /**
   * encodeString from NIST SP 800-185
   * Encodes string as leftEncode(bitLength) || string
   * @param {uint8[]} str - Bit string as bytes
   * @returns {uint8[]} Encoded string
   */
  function encodeString(str) {
    if (str.length === 0) {
      return leftEncode(0);
    }

    const bitLength = str.length * 8;
    const encoded = leftEncode(bitLength);
    return encoded.concat(str);
  }

  /**
   * Copy of a byte array, or an empty array for null/undefined
   * @param {uint8[]} bytes - Source bytes (may be null)
   * @returns {uint8[]} Copy
   */
  function copyBytes(bytes) {
    /** @type {uint8[]} */
    const copy = [];
    if (bytes !== null && bytes !== undefined) {
      for (let i = 0; i < bytes.length; i++) copy.push(bytes[i]);
    }
    return copy;
  }

  /**
 * cSHAKEAlgorithm - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class cSHAKEAlgorithm extends HashFunctionAlgorithm {
    /**
     * @param {string} [variant='128'] - '128' or '256' (anything else configures cSHAKE128)
     */
    constructor(variant = '128') {
      super();

      /** @type {string} */
      this.variant = variant;
      this.name = 'cSHAKE' + variant;
      this.inventor = "NIST";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "Extendable-Output Function";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      /** @type {int32} Sponge rate in bytes */
      this.rate = 0;
      /** @type {int32} Capacity in bits */
      this.capacity = 0;
      /** @type {int32} Security level in bits */
      this.securityLevel = 0;

      if (variant === '256') {
        this.description = "cSHAKE256 is a customizable extendable-output function based on SHAKE256 from NIST SP 800-185. Supports function name and customization string parameters for domain separation.";
        this.rate = 136;  // 1088 bits
        this.capacity = 512;  // 512 bits (256-bit security)
        this.securityLevel = 256;
        this.tests = [
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
          },
          {
            text: "cSHAKE256: NIST ACVP tc50 - N='TupleHash', 65-byte message, 32-byte output",
            uri: "https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/cSHAKE-256-1.0/internalProjection.json",
            input: OpCodes.Hex8ToBytes(
              "31A5B91183D04C3F2ADF8A92507E44515CE6CB5BB8129862DA36B773F692A011" +
              "83576B88DA8A1F21741C6FBFAAAD821EDB05E3E3F5B29E9D2E949BA2F2C05B9A" +
              "9E"
            ),
            functionName: OpCodes.Hex8ToBytes("5475706C6548617368"),
            customization: OpCodes.Hex8ToBytes(
              "5D4D725B69572D3E277B734925693A79566164457B7021575E593C563E523D67" +
              "7378583A2E4555614530575D6374697D59426664603E216C4B3A7D2F3B542053" +
              "5E2D542B317E6C312C23206C38447368703E7C7A6B582854776C6E7347474670" +
              "2F257D56405F6D595554575E3E3553"
            ),
            outputSize: 32,
            expected: OpCodes.Hex8ToBytes("FAE091032FC8C74B7D3912A783EB6C0598E65E576FE71E5DED3C057120BD6022")
          },
          {
            text: "cSHAKE256: NIST ACVP tc58 - N='ParallelHash', 5-byte message, 39-byte output",
            uri: "https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/cSHAKE-256-1.0/internalProjection.json",
            input: OpCodes.Hex8ToBytes("D5D7E7517F"),
            functionName: OpCodes.Hex8ToBytes("506172616C6C656C48617368"),
            customization: OpCodes.Hex8ToBytes(
              "76442D313E542C662E522A56255A413C4E7457302433555A445B245825515651" +
              "452C4836453B787159514934636F5E462353663A435521646D516B625052625A" +
              "7B563178332C76337B665450694276547D5B554F6B3C2F6F2A6447724E374028" +
              "6E6D372C5E6434765D523E5B204F794A"
            ),
            outputSize: 39,
            expected: OpCodes.Hex8ToBytes(
              "442BE69B2AFD7C8282839920A8446AAF16A5049D3D018EAC87E04CF9225870EF" +
              "CA6F88DB415829"
            )
          }
        ];
      } else {
        this.description = "cSHAKE128 is a customizable extendable-output function based on SHAKE128 from NIST SP 800-185. Supports function name and customization string parameters for domain separation.";
        this.rate = 168;  // 1344 bits
        this.capacity = 256;  // 256 bits (128-bit security)
        this.securityLevel = 128;
        this.tests = [
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
          },
          {
            text: "cSHAKE128: NIST ACVP tc25 - N='KMAC', 5-byte message, 39-byte output",
            uri: "https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/cSHAKE-128-1.0/internalProjection.json",
            input: OpCodes.Hex8ToBytes("CA88F708FA"),
            functionName: OpCodes.Hex8ToBytes("4B4D4143"),
            customization: OpCodes.Hex8ToBytes(
              "606B6945466026492929375D7971303F2A734B612071295B6A506034523D296C" +
              "565F3974797654246B4162482429317D705D2E6262656F6D622E"
            ),
            outputSize: 39,
            expected: OpCodes.Hex8ToBytes(
              "BEBB534CCFCCD300F731D2911FB4351D5FCC95AC2509E9ABAE8F9DC51106E28D" +
              "7F25AE11738334"
            )
          },
          {
            text: "cSHAKE128: NIST ACVP tc27 - N='KMAC', empty message, 34-byte output",
            uri: "https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/cSHAKE-128-1.0/internalProjection.json",
            input: OpCodes.Hex8ToBytes(""),
            functionName: OpCodes.Hex8ToBytes("4B4D4143"),
            customization: OpCodes.Hex8ToBytes(
              "60503B757C2A606A4B40357E65243655787662453829426F2A7E2E4466732F7A" +
              "64583E26406D2A4E626E733C487D35723C6B49447A6526572E4B6B7D7B3B2457" +
              "313A3B2C6431362B6D3463483427462B693A297A496A207D5265767421"
            ),
            outputSize: 34,
            expected: OpCodes.Hex8ToBytes("1E5CA2A14CC46DE9A6510003516CDDCF4FD6F3DC073F64633BFE5C43172E97C7D63A")
          }
        ];
      }

      this.SupportedOutputSizes = [new KeySize(1, 1024, 1)]; // Variable output
      /** @type {int32} */
      this.BlockSize = this.rate;

      this.documentation = [
        new LinkItem("NIST SP 800-185", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf"),
        new LinkItem("Keccak Team", "https://keccak.team/")
      ];

      this.references = [
        new LinkItem("BouncyCastle Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/CSHAKEDigest.java"),
        new LinkItem("NIST Examples", "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/cSHAKE_samples.pdf")
      ];
    }

    /**
     * Create new XOF instance
     * @param {boolean} [isInverse=false] - A hash has no inverse: true yields null
     * @returns {cSHAKEInstance} New XOF instance
     */
    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new cSHAKEInstance(this);
    }
  }

  /**
 * cSHAKE instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class cSHAKEInstance extends IHashFunctionInstance {
    /**
     * Initialize a cSHAKE instance
     * @param {cSHAKEAlgorithm} algorithm - Parent algorithm instance
     */
    constructor(algorithm) {
      super(algorithm);
      /** @type {uint32[][]} 25 lanes as [low32, high32] */
      this.state = new Array(25);
      for (let i = 0; i < 25; i++) {
        /** @type {uint32[]} */
        const lane = [0, 0];
        this.state[i] = lane;
      }
      /** @type {int32} Sponge rate in bytes */
      this.rate = algorithm.rate;
      /** @type {BlockAbsorber} */
      this._absorber = new BlockAbsorber(this.rate, block => this._absorb(block));
      /** @type {int32} Output length in bytes, defaulting by variant */
      this._outputSize = algorithm.variant === '256' ? 64 : 32;
      /** @type {uint8[]} N parameter (usually empty, reserved for NIST) */
      this._functionName = [];
      /** @type {uint8[]} S parameter (customization string) */
      this._customization = [];
      /** @type {boolean} Track if we've applied customization */
      this._isCustomized = false;
    }

    /**
     * Set the output length
     * @param {int32} size - Output length in bytes, 1..1024
     */
    set outputSize(size) {
      if (size < 1 || size > 1024) {
        throw new Error('Invalid output size: ' + size + ' bytes');
      }
      this._outputSize = size;
    }

    /**
     * The output length
     * @returns {int32} Output length in bytes
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * Set the function name N
     * @param {uint8[]} nameBytes - N as bytes (null clears it)
     */
    set functionName(nameBytes) {
      this._functionName = copyBytes(nameBytes);
    }

    /**
     * The function name N
     * @returns {uint8[]} Copy of N
     */
    get functionName() {
      return this._functionName.slice();
    }

    /**
     * Set the customization string S
     * @param {uint8[]} customBytes - S as bytes (null clears it)
     */
    set customization(customBytes) {
      this._customization = copyBytes(customBytes);
    }

    /**
     * The customization string S
     * @returns {uint8[]} Copy of S
     */
    get customization() {
      return this._customization.slice();
    }

    /**
     * Apply bytepad with customization parameters
     * Called before processing input data
     * @returns {void}
     */
    _applyCustomization() {
      if (this._isCustomized) return;
      this._isCustomized = true;

      // If both N and S are empty, behave like SHAKE (no customization needed)
      if (this._functionName.length === 0 && this._customization.length === 0) {
        return;
      }

      // Build diff = leftEncode(rate) || encodeString(N) || encodeString(S).
      // Appended one element at a time: push(...source) passes every byte of
      // the customization string as a separate argument, which overflows the
      // call stack once S reaches roughly 100 KB. SP 800-185 places no such
      // limit on S, and TupleHash and ParallelHash hand their own customization
      // straight through to here.
      /** @type {uint8[]} */
      const diff = [];
      const encodedRate = leftEncode(this.rate);   // leftEncode(rate)
      for (let i = 0; i < encodedRate.length; i++) diff.push(encodedRate[i]);
      const encodedN = encodeString(this._functionName);   // encodeString(N)
      for (let i = 0; i < encodedN.length; i++) diff.push(encodedN[i]);
      const encodedS = encodeString(this._customization);  // encodeString(S)
      for (let i = 0; i < encodedS.length; i++) diff.push(encodedS[i]);

      // Absorb diff with bytepad to block boundary. This is bytepad (NIST SP
      // 800-185 section 2.3.3), a zero fill to a rate boundary, and not the
      // sponge's pad10*1 - it carries no domain separator and no terminating
      // bit, so it is written out here rather than going through
      // SpongePadBlocks. It always ends on a block boundary, which is why the
      // message absorber that follows starts empty.
      for (let offset = 0; offset < diff.length; offset += this.rate) {
        /** @type {uint8[]} */
        const block = [];
        for (let i = 0; i < this.rate; i++) block.push(offset + i < diff.length ? diff[offset + i] : 0);
        this._absorb(block);
      }
    }

    /**
     * Feed data to the XOF
     * @param {uint8[]} data - Input data bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      // Apply customization before first input
      this._applyCustomization();

      this._absorber.Absorb(data);
    }

    /**
     * XOR one rate block into the state and permute
     * @param {uint8[]} block - Exactly rate bytes
     * @returns {void}
     */
    _absorb(block) {
      for (let i = 0; i < this.rate; i += 8) {
        const idx = i / 8;
        const low = OpCodes.Pack32LE(block[i], block[i + 1], block[i + 2], block[i + 3]);
        const high = OpCodes.Pack32LE(block[i + 4], block[i + 5], block[i + 6], block[i + 7]);
        this.state[idx][0] = OpCodes.Xor32(this.state[idx][0], low);
        this.state[idx][1] = OpCodes.Xor32(this.state[idx][1], high);
      }
      keccakF(this.state);
    }

    /**
     * Pad, absorb the last block and squeeze outputSize bytes
     * @returns {uint8[]} Output bytes
     */
    Result() {
      // Apply customization if not already done
      this._applyCustomization();

      // Determine domain separation byte
      const hasCustomization = this._functionName.length > 0 || this._customization.length > 0;
      const domainByte = hasCustomization ? 0x04 : 0x1F; // 0x04 for cSHAKE, 0x1F for SHAKE

      // Padding: domain_byte || pad10*1. The two land on the same byte when
      // exactly one byte of the block is free, and writing the terminating bit
      // over the domain byte rather than into it dropped the domain separation
      // that cSHAKE exists to provide - the same defect, in the same shape, as
      // the one repaired in sha3.js and shake.js.
      const rate = this.rate;
      /** @type {uint8[][]} */
      const padded = this._absorber.Finish((held, pending) => SpongePadBlocks(held, pending, rate, domainByte));
      for (const block of padded)
        this._absorb(block);

      // Squeeze output
      /** @type {uint8[]} */
      const output = [];

      while (output.length < this._outputSize) {
        for (let i = 0; i < this.rate && output.length < this._outputSize; i += 8) {
          const idx = i / 8;
          const bytes1 = OpCodes.Unpack32LE(this.state[idx][0]);
          const bytes2 = OpCodes.Unpack32LE(this.state[idx][1]);

          for (let j = 0; j < 4 && output.length < this._outputSize; j++) output.push(bytes1[j]);
          for (let j = 0; j < 4 && output.length < this._outputSize; j++) output.push(bytes2[j]);
        }

        if (output.length < this._outputSize) {
          keccakF(this.state);
        }
      }

      return output;
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
