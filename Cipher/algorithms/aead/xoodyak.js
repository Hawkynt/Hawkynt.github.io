/*
 * Xoodyak AEAD - NIST Lightweight Cryptography Finalist
 * Professional implementation following NIST LWC specification
 * (c)2006-2025 Hawkynt
 *
 * Xoodyak is a cryptographic scheme based on the Xoodoo permutation using the Cyclist mode
 * construction for authenticated encryption with associated data (AEAD). This implementation
 * provides the AEAD mode with 128-bit keys, 128-bit nonces, and 128-bit authentication tags.
 *
 * Reference: https://csrc.nist.gov/Projects/lightweight-cryptography/finalists
 * Specification: https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/xoodyak-spec-final.pdf
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AeadAlgorithm, IAeadInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Xoodoo permutation constants
  const RC = [
    0x00000058, 0x00000038, 0x000003C0, 0x000000D0, 0x00000120,
    0x00000014, 0x00000060, 0x0000002C, 0x00000380, 0x000000F0,
    0x000001A0, 0x00000012
  ];

  const MAXROUNDS = 12;
  const STATE_SIZE = 48;        // 48 bytes = 384 bits
  const ABSORB_RATE = 44;       // Absorption rate for AEAD mode
  const SQUEEZE_RATE = 24;      // Squeeze rate for encryption/decryption
  const NONCE_SIZE = 16;        // 128-bit nonce
  const KEY_SIZE = 16;          // 128-bit key
  const TAG_SIZE = 16;          // 128-bit tag

  // Phase identifiers
  const PHASE_UP = 0;
  const PHASE_DOWN = 1;

  /**
   * Xoodoo permutation function (reused from xoodyak-hash.js)
   * @param {Array<number>} state - 48-byte state array
   */
  function xoodooPermutation(state) {
    // Unpack state into 12 x 32-bit words (little-endian)
    let a0 = OpCodes.Pack32LE(state[0], state[1], state[2], state[3]);
    let a1 = OpCodes.Pack32LE(state[4], state[5], state[6], state[7]);
    let a2 = OpCodes.Pack32LE(state[8], state[9], state[10], state[11]);
    let a3 = OpCodes.Pack32LE(state[12], state[13], state[14], state[15]);
    let a4 = OpCodes.Pack32LE(state[16], state[17], state[18], state[19]);
    let a5 = OpCodes.Pack32LE(state[20], state[21], state[22], state[23]);
    let a6 = OpCodes.Pack32LE(state[24], state[25], state[26], state[27]);
    let a7 = OpCodes.Pack32LE(state[28], state[29], state[30], state[31]);
    let a8 = OpCodes.Pack32LE(state[32], state[33], state[34], state[35]);
    let a9 = OpCodes.Pack32LE(state[36], state[37], state[38], state[39]);
    let a10 = OpCodes.Pack32LE(state[40], state[41], state[42], state[43]);
    let a11 = OpCodes.Pack32LE(state[44], state[45], state[46], state[47]);

    for (let i = 0; i < MAXROUNDS; ++i) {
      // Theta: Column Parity Mixer
      const p0 = a0^a4^a8;
      const p1 = a1^a5^a9;
      const p2 = a2^a6^a10;
      const p3 = a3^a7^a11;

      const e0 = OpCodes.RotL32(p3, 5)^OpCodes.RotL32(p3, 14);
      const e1 = OpCodes.RotL32(p0, 5)^OpCodes.RotL32(p0, 14);
      const e2 = OpCodes.RotL32(p1, 5)^OpCodes.RotL32(p1, 14);
      const e3 = OpCodes.RotL32(p2, 5)^OpCodes.RotL32(p2, 14);

      a0 ^= e0;
      a4 ^= e0;
      a8 ^= e0;

      a1 ^= e1;
      a5 ^= e1;
      a9 ^= e1;

      a2 ^= e2;
      a6 ^= e2;
      a10 ^= e2;

      a3 ^= e3;
      a7 ^= e3;
      a11 ^= e3;

      // Rho-west: plane shift
      let b0 = a0;
      let b1 = a1;
      let b2 = a2;
      let b3 = a3;

      let b4 = a7;
      let b5 = a4;
      let b6 = a5;
      let b7 = a6;

      let b8 = OpCodes.RotL32(a8, 11);
      let b9 = OpCodes.RotL32(a9, 11);
      let b10 = OpCodes.RotL32(a10, 11);
      let b11 = OpCodes.RotL32(a11, 11);

      // Iota: round constant
      b0 ^= RC[i];

      // Chi: non-linear layer
      a0 = b0^(~b4&b8);
      a1 = b1^(~b5&b9);
      a2 = b2^(~b6&b10);
      a3 = b3^(~b7&b11);

      a4 = b4^(~b8&b0);
      a5 = b5^(~b9&b1);
      a6 = b6^(~b10&b2);
      a7 = b7^(~b11&b3);

      b8 ^= (~b0&b4);
      b9 ^= (~b1&b5);
      b10 ^= (~b2&b6);
      b11 ^= (~b3&b7);

      // Rho-east: plane shift
      a4 = OpCodes.RotL32(a4, 1);
      a5 = OpCodes.RotL32(a5, 1);
      a6 = OpCodes.RotL32(a6, 1);
      a7 = OpCodes.RotL32(a7, 1);

      a8 = OpCodes.RotL32(b10, 8);
      a9 = OpCodes.RotL32(b11, 8);
      a10 = OpCodes.RotL32(b8, 8);
      a11 = OpCodes.RotL32(b9, 8);
    }

    // Pack results back into state (little-endian)
    const bytes0 = OpCodes.Unpack32LE(a0);
    const bytes1 = OpCodes.Unpack32LE(a1);
    const bytes2 = OpCodes.Unpack32LE(a2);
    const bytes3 = OpCodes.Unpack32LE(a3);
    const bytes4 = OpCodes.Unpack32LE(a4);
    const bytes5 = OpCodes.Unpack32LE(a5);
    const bytes6 = OpCodes.Unpack32LE(a6);
    const bytes7 = OpCodes.Unpack32LE(a7);
    const bytes8 = OpCodes.Unpack32LE(a8);
    const bytes9 = OpCodes.Unpack32LE(a9);
    const bytes10 = OpCodes.Unpack32LE(a10);
    const bytes11 = OpCodes.Unpack32LE(a11);

    state[0] = bytes0[0]; state[1] = bytes0[1]; state[2] = bytes0[2]; state[3] = bytes0[3];
    state[4] = bytes1[0]; state[5] = bytes1[1]; state[6] = bytes1[2]; state[7] = bytes1[3];
    state[8] = bytes2[0]; state[9] = bytes2[1]; state[10] = bytes2[2]; state[11] = bytes2[3];
    state[12] = bytes3[0]; state[13] = bytes3[1]; state[14] = bytes3[2]; state[15] = bytes3[3];
    state[16] = bytes4[0]; state[17] = bytes4[1]; state[18] = bytes4[2]; state[19] = bytes4[3];
    state[20] = bytes5[0]; state[21] = bytes5[1]; state[22] = bytes5[2]; state[23] = bytes5[3];
    state[24] = bytes6[0]; state[25] = bytes6[1]; state[26] = bytes6[2]; state[27] = bytes6[3];
    state[28] = bytes7[0]; state[29] = bytes7[1]; state[30] = bytes7[2]; state[31] = bytes7[3];
    state[32] = bytes8[0]; state[33] = bytes8[1]; state[34] = bytes8[2]; state[35] = bytes8[3];
    state[36] = bytes9[0]; state[37] = bytes9[1]; state[38] = bytes9[2]; state[39] = bytes9[3];
    state[40] = bytes10[0]; state[41] = bytes10[1]; state[42] = bytes10[2]; state[43] = bytes10[3];
    state[44] = bytes11[0]; state[45] = bytes11[1]; state[46] = bytes11[2]; state[47] = bytes11[3];
  }

  class XoodyakAEAD extends AeadAlgorithm {
    constructor() {
      super();

      this.name = "Xoodyak AEAD";
      this.description = "NIST Lightweight Cryptography finalist using the Xoodoo permutation with Cyclist mode construction. Provides authenticated encryption with 128-bit keys and tags for resource-constrained environments.";
      this.inventor = "Joan Daemen, Seth Hoffert, Michaël Peeters, Gilles Van Assche, Ronny Van Keer";
      this.year = 2019;
      this.category = CategoryType.AEAD;
      this.subCategory = "Lightweight Cryptography";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.BE;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];
      this.SupportedTagSizes = [new KeySize(16, 16, 1)];
      this.SupportsDetached = false;

      this.documentation = [
        new LinkItem(
          "NIST LWC Finalist",
          "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists"
        ),
        new LinkItem(
          "Xoodyak Specification",
          "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/xoodyak-spec-final.pdf"
        ),
        new LinkItem(
          "Xoodoo Permutation",
          "https://eprint.iacr.org/2018/767.pdf"
        )
      ];

      // Official NIST LWC test vectors from KAT file
      this.tests = [
        {
          text: "Xoodyak AEAD: empty PT/AD (NIST LWC KAT #1)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("4BF0E393144CB58069FC1FEBCAFCFB3C")
        },
        {
          text: "Xoodyak AEAD: empty PT, 1-byte AD (NIST LWC KAT #2)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("00"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("4D2A8D1716DFE3401F3BBE8ACB637AB0")
        },
        {
          text: "Xoodyak AEAD: empty PT, 2-byte AD (NIST LWC KAT #3)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("0001"),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("4EBC154612159A949679453DC6CC52C6")
        },
        {
          text: "Xoodyak AEAD: 1-byte PT, empty AD (NIST LWC KAT #34)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("890788EAC729D9539F401845B35A34D19F")
        },
        {
          text: "Xoodyak AEAD: 16-byte PT, 16-byte AD (NIST LWC KAT #545)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("D69753865422CBB82FABD13C4B5996417211FC2BC37B98C1BCC0964D39227C0E")
        },
        {
          text: "Xoodyak AEAD: 24-byte PT, empty AD (NIST LWC KAT #793)",
          uri: "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          associatedData: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F1011121314151617"),
          expected: OpCodes.Hex8ToBytes("8929B40735CF316546C1256FF5E025F411D6DAC6C606A0EA9A33CC81BEE982E4556FC1CE2C3CCF91")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new XoodyakAEADInstance(this, isInverse);
    }
  }

  /**
 * XoodyakAEAD cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class XoodyakAEADInstance extends IAeadInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this._nonce = null;
      this._associatedData = [];
      this.inputBuffer = [];
      this.initialized = false;

      // Xoodyak state
      this.state = new Array(STATE_SIZE).fill(0);
      this.phase = PHASE_UP;
      this.encrypted = false;
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (keyBytes.length !== KEY_SIZE) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (expected ${KEY_SIZE})`);
      }

      this._key = [...keyBytes];
      this._initializeIfReady();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        this.initialized = false;
        return;
      }

      if (nonceBytes.length !== NONCE_SIZE) {
        throw new Error(`Invalid nonce size: ${nonceBytes.length} bytes (expected ${NONCE_SIZE})`);
      }

      this._nonce = [...nonceBytes];
      this._initializeIfReady();
    }

    get nonce() {
      return this._nonce ? [...this._nonce] : null;
    }

    set associatedData(adBytes) {
      this._associatedData = adBytes ? [...adBytes] : [];
    }

    get associatedData() {
      return [...this._associatedData];
    }

    _initializeIfReady() {
      if (!this._key || !this._nonce) {
        this.initialized = false;
        return;
      }

      // C Reference implementation method:
      // Initialize state with key directly
      this.state.fill(0);

      // Copy key directly into state
      for (let i = 0; i < KEY_SIZE; i++) {
        this.state[i] = this._key[i];
      }

      // state[KEY_SIZE] should be 0 (already filled)
      // Add padding at position KEY_SIZE + 1
      this.state[KEY_SIZE + 1] = 0x01;

      // Add domain separation at last byte
      this.state[STATE_SIZE - 1] = 0x02;

      this.phase = PHASE_DOWN;

      // Absorb nonce with domain 0x03
      this._absorbAny(this._nonce, 0, NONCE_SIZE, 0x03);

      this.encrypted = false;
      this.initialized = true;
    }

    /**
     * Absorb data into state with domain separation
     * @param {Array<number>} X - Data to absorb
     * @param {number} Xoff - Offset in X
     * @param {number} XLen - Length of data
     * @param {number} Cd - Domain separation byte
     */
    _absorbAny(X, Xoff, XLen, Cd) {
      let splitLen;

      do {
        // Check phase and call Up if needed (official Cyclist pattern)
        if (this.phase !== PHASE_UP) {
          this._up(0);
        }

        splitLen = Math.min(XLen, ABSORB_RATE);
        this._down(X, Xoff, splitLen, Cd);
        this.phase = PHASE_DOWN;
        Cd = 0;
        Xoff += splitLen;
        XLen -= splitLen;
      } while (XLen !== 0);
    }

    /**
     * Down operation: XOR data into state with padding and domain separation
     * @param {Array<number>} Xi - Data to absorb
     * @param {number} XiOff - Offset in Xi
     * @param {number} XiLen - Length to absorb
     * @param {number} Cd - Domain separation byte
     */
    _down(Xi, XiOff, XiLen, Cd) {
      // XOR data into state
      for (let i = 0; i < XiLen; i++) {
        this.state[i] ^= Xi[XiOff + i];
      }

      // Add padding bit
      this.state[XiLen] ^= 0x01;

      // Add domain separation at last byte
      this.state[STATE_SIZE - 1] ^= Cd;
    }

    /**
     * Up operation: Apply Xoodoo permutation with domain separation
     * @param {number} Cu - Domain separation for up phase
     */
    _up(Cu) {
      this.state[STATE_SIZE - 1] ^= Cu;
      xoodooPermutation(this.state);
      this.phase = PHASE_UP;
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this.initialized) {
        throw new Error("Key and nonce not set");
      }

      const input = this.inputBuffer;
      this.inputBuffer = [];

      // Process associated data (even if empty)
      this._absorbAny(this._associatedData, 0, this._associatedData.length, 0x03);

      const output = [];

      if (this.isInverse) {
        // Decryption
        if (input.length < TAG_SIZE) {
          throw new Error("Input too short for tag");
        }

        const ciphertext = input.slice(0, input.length - TAG_SIZE);
        const expectedTag = input.slice(input.length - TAG_SIZE);

        // Decrypt ciphertext
        let pos = 0;
        let clen = ciphertext.length;
        let domain = 0x80;

        // Process full blocks (only if clen > SQUEEZE_RATE, matching C reference)
        while (clen > SQUEEZE_RATE) {
          this._up(domain);

          for (let i = 0; i < SQUEEZE_RATE; i++) {
            const plainByte = this.state[i] ^ ciphertext[pos + i];
            output.push(plainByte);
            this.state[i] = ciphertext[pos + i];
          }

          this.state[SQUEEZE_RATE] ^= 0x01;
          this.phase = PHASE_DOWN;
          pos += SQUEEZE_RATE;
          clen -= SQUEEZE_RATE;
          domain = 0;
        }

        // Final block (always executed, even if clen == 0)
        this._up(domain);

        for (let i = 0; i < clen; i++) {
          const plainByte = this.state[i] ^ ciphertext[pos + i];
          output.push(plainByte);
          this.state[i] = ciphertext[pos + i];
        }
        // Add padding at position 'clen'
        this.state[clen] ^= 0x01;
        this.phase = PHASE_DOWN;

        // Generate and verify tag
        this._up(0x40);
        const computedTag = this.state.slice(0, TAG_SIZE);

        // Constant-time comparison
        let tagMatch = true;
        for (let i = 0; i < TAG_SIZE; i++) {
          if (computedTag[i] !== expectedTag[i]) {
            tagMatch = false;
          }
        }

        if (!tagMatch) {
          throw new Error("Authentication tag verification failed");
        }

      } else {
        // Encryption
        let pos = 0;
        let mlen = input.length;
        let domain = 0x80;

        // Process full blocks (only if mlen > SQUEEZE_RATE, matching C reference)
        while (mlen > SQUEEZE_RATE) {
          this._up(domain);

          for (let i = 0; i < SQUEEZE_RATE; i++) {
            const cipherByte = this.state[i] ^ input[pos + i];
            output.push(cipherByte);
          }

          // Absorb plaintext into state for authentication
          for (let i = 0; i < SQUEEZE_RATE; i++) {
            this.state[i] ^= input[pos + i];
          }

          // Add padding
          this.state[SQUEEZE_RATE] ^= 0x01;
          this.phase = PHASE_DOWN;
          pos += SQUEEZE_RATE;
          mlen -= SQUEEZE_RATE;
          domain = 0;
        }

        // Final block (always executed, even if mlen == 0)
        this._up(domain);

        for (let i = 0; i < mlen; i++) {
          const cipherByte = this.state[i] ^ input[pos + i];
          output.push(cipherByte);
        }

        // Absorb plaintext into state for authentication
        for (let i = 0; i < mlen; i++) {
          this.state[i] ^= input[pos + i];
        }

        // Add padding
        this.state[mlen] ^= 0x01;
        this.phase = PHASE_DOWN;

        // Generate authentication tag
        this._up(0x40);
        for (let i = 0; i < TAG_SIZE; i++) {
          output.push(this.state[i]);
        }
      }

      // Reset for next operation
      this.phase = PHASE_UP;
      this.encrypted = false;

      return output;
    }
  }

  RegisterAlgorithm(new XoodyakAEAD());
  return XoodyakAEAD;
}));
