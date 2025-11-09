/*
 * ASCON-128 AEAD - NIST Lightweight Cryptography Standard Winner
 * Professional implementation following NIST SP 800-232 specification
 * (c)2006-2025 Hawkynt
 *
 * ASCON-128 is NIST's selected lightweight cryptography standard for authenticated
 * encryption with associated data (AEAD). Selected as winner of NIST LWC competition
 * in February 2023 and standardized in NIST SP 800-232.
 *
 * Specifications:
 * - 128-bit keys
 * - 128-bit nonces
 * - 128-bit authentication tags
 * - 8-byte rate (64-bit) for associated data and plaintext
 * - 12 rounds for initialization/finalization, 6 rounds for intermediate operations
 * - State size: 320 bits (5 x 64-bit words)
 *
 * Reference: NIST SP 800-232 (February 2023)
 * Specification: https://ascon.iaik.tugraz.at/
 * C Reference: https://github.com/ascon/ascon-c
 * Test Vectors: NIST LWC Known Answer Test (KAT) files
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

  // ASCON-128 initialization vector (IV)
  // Format: k=128, r=64, a=12, b=6 encoded as 0x80400c0600000000
  const ASCON128_IV = [0x00000000, 0x80400c06]; // [low32, high32] in big-endian

  // ========================[ 64-BIT OPERATIONS ]========================
  // JavaScript lacks native 64-bit integers (before BigInt), so we use
  // pairs of 32-bit values [low32, high32] to represent 64-bit words

  /**
   * XOR two 64-bit values represented as [low32, high32] pairs
   */
  function xor64(a, b) {
    return [(a[0] ^ b[0]) >>> 0, (a[1] ^ b[1]) >>> 0];
  }

  /**
   * NOT operation on 64-bit value
   */
  function not64(a) {
    return [(~a[0]) >>> 0, (~a[1]) >>> 0];
  }

  /**
   * AND operation on two 64-bit values
   */
  function and64(a, b) {
    return [(a[0] & b[0]) >>> 0, (a[1] & b[1]) >>> 0];
  }

  /**
   * Rotate left 64-bit value by n positions
   * Matches working ascon.js implementation
   */
  function rotl64(low, high, positions) {
    positions %= 64;
    if (positions === 0) return [low, high];
    if (positions === 32) return [high, low];

    if (positions < 32) {
      return [
        ((low << positions) | (high >>> (32 - positions))) >>> 0,
        ((high << positions) | (low >>> (32 - positions))) >>> 0
      ];
    }

    positions -= 32;
    return [
      ((high << positions) | (low >>> (32 - positions))) >>> 0,
      ((low << positions) | (high >>> (32 - positions))) >>> 0
    ];
  }

  /**
   * Rotate right 64-bit value by n positions
   * Implemented as left rotation by (64 - n)
   */
  function rotr64(low, high, positions) {
    return rotl64(low, high, 64 - positions);
  }

  /**
   * Pack 8 bytes into 64-bit word [low32, high32] in big-endian order
   */
  function pack64BE(bytes, offset) {
    offset = offset || 0;
    return [
      OpCodes.Pack32BE(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]),
      OpCodes.Pack32BE(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
    ];
  }

  /**
   * Unpack 64-bit word [low32, high32] to 8 bytes in big-endian order
   */
  function unpack64BE(word) {
    const highBytes = OpCodes.Unpack32BE(word[1]);
    const lowBytes = OpCodes.Unpack32BE(word[0]);
    return highBytes.concat(lowBytes);
  }

  // ========================[ ASCON PERMUTATION ]========================

  /**
   * ASCON permutation state - 5 x 64-bit words (320 bits total)
   * Each word stored as [low32, high32] pair
   */
  class AsconState {
    constructor() {
      // Initialize 5 x 64-bit words to zero
      this.x = new Array(5);
      for (let i = 0; i < 5; ++i) {
        this.x[i] = [0, 0];
      }
    }

    /**
     * ASCON permutation with specified number of rounds
     * @param {number} rounds - Number of rounds (12 for initialization, 6 for intermediate)
     */
    permute(rounds) {
      const startRound = 12 - rounds;
      for (let i = startRound; i < 12; ++i) {
        this.round(i);
      }
    }

    /**
     * Single round of ASCON permutation
     * Consists of: addition of constants, substitution layer, linear diffusion layer
     */
    round(roundNum) {
      // Step 1: Addition of round constant to x2
      // Round constant: c = ((0x0F - roundNum) << 4) | roundNum
      const c = ((0x0F - roundNum) << 4) | roundNum;
      this.x[2][0] = (this.x[2][0] ^ c) >>> 0;

      // Step 2: Substitution layer (5-bit S-box applied to state columns)
      // Based on χ (chi) operation with additional XORs

      // Pre-XOR: x0 ^= x4, x4 ^= x3, x2 ^= x1
      this.x[0] = xor64(this.x[0], this.x[4]);
      this.x[4] = xor64(this.x[4], this.x[3]);
      this.x[2] = xor64(this.x[2], this.x[1]);

      // χ layer: xi ^= (~x(i+1) & x(i+2)) for each bit position
      // Use temporary variables to avoid overwriting needed values
      const t0 = and64(not64(this.x[0]), this.x[1]);
      const t1 = and64(not64(this.x[1]), this.x[2]);
      const t2 = and64(not64(this.x[2]), this.x[3]);
      const t3 = and64(not64(this.x[3]), this.x[4]);
      const t4 = and64(not64(this.x[4]), this.x[0]);

      this.x[0] = xor64(this.x[0], t1);
      this.x[1] = xor64(this.x[1], t2);
      this.x[2] = xor64(this.x[2], t3);
      this.x[3] = xor64(this.x[3], t4);
      this.x[4] = xor64(this.x[4], t0);

      // Post-XOR: x1 ^= x0, x0 ^= x4, x3 ^= x2, x2 = ~x2
      this.x[1] = xor64(this.x[1], this.x[0]);
      this.x[0] = xor64(this.x[0], this.x[4]);
      this.x[3] = xor64(this.x[3], this.x[2]);
      this.x[2] = not64(this.x[2]);

      // Step 3: Linear diffusion layer (rotation-based mixing)
      // Each word is XORed with two rotated versions of itself
      // Rotation amounts are specific to each word position
      // Must save original values before modification

      const s0_l = this.x[0][0];
      const s0_h = this.x[0][1];
      const s1_l = this.x[1][0];
      const s1_h = this.x[1][1];
      const s2_l = this.x[2][0];
      const s2_h = this.x[2][1];
      const s3_l = this.x[3][0];
      const s3_h = this.x[3][1];
      const s4_l = this.x[4][0];
      const s4_h = this.x[4][1];

      // x0 ^= rightRotate19_64(x0) ^ rightRotate28_64(x0)
      let r0 = rotr64(s0_l, s0_h, 19);
      let r1 = rotr64(s0_l, s0_h, 28);
      this.x[0][0] = (s0_l ^ r0[0] ^ r1[0]) >>> 0;
      this.x[0][1] = (s0_h ^ r0[1] ^ r1[1]) >>> 0;

      // x1 ^= rightRotate61_64(x1) ^ rightRotate39_64(x1)
      r0 = rotr64(s1_l, s1_h, 61);
      r1 = rotr64(s1_l, s1_h, 39);
      this.x[1][0] = (s1_l ^ r0[0] ^ r1[0]) >>> 0;
      this.x[1][1] = (s1_h ^ r0[1] ^ r1[1]) >>> 0;

      // x2 ^= rightRotate1_64(x2) ^ rightRotate6_64(x2)
      r0 = rotr64(s2_l, s2_h, 1);
      r1 = rotr64(s2_l, s2_h, 6);
      this.x[2][0] = (s2_l ^ r0[0] ^ r1[0]) >>> 0;
      this.x[2][1] = (s2_h ^ r0[1] ^ r1[1]) >>> 0;

      // x3 ^= rightRotate10_64(x3) ^ rightRotate17_64(x3)
      r0 = rotr64(s3_l, s3_h, 10);
      r1 = rotr64(s3_l, s3_h, 17);
      this.x[3][0] = (s3_l ^ r0[0] ^ r1[0]) >>> 0;
      this.x[3][1] = (s3_h ^ r0[1] ^ r1[1]) >>> 0;

      // x4 ^= rightRotate7_64(x4) ^ rightRotate41_64(x4)
      r0 = rotr64(s4_l, s4_h, 7);
      r1 = rotr64(s4_l, s4_h, 41);
      this.x[4][0] = (s4_l ^ r0[0] ^ r1[0]) >>> 0;
      this.x[4][1] = (s4_h ^ r0[1] ^ r1[1]) >>> 0;
    }

    /**
     * XOR 64-bit word into state at given position
     */
    xorWord(position, word) {
      this.x[position] = xor64(this.x[position], word);
    }

    /**
     * XOR byte array into state (up to rate bytes)
     */
    xorBytes(bytes, offset, length) {
      // ASCON-128 has 8-byte rate, so we XOR into x0
      const blockOffset = offset || 0;
      const blockLength = length || bytes.length;

      // Create padded block
      const block = new Array(8);
      for (let i = 0; i < 8; ++i) {
        if (i < blockLength) {
          block[i] = bytes[blockOffset + i];
        } else {
          block[i] = 0;
        }
      }

      const word = pack64BE(block, 0);
      this.xorWord(0, word);
    }

    /**
     * Extract bytes from state (from x0 for encryption/decryption)
     */
    extractBytes(length) {
      const word = unpack64BE(this.x[0]);
      return word.slice(0, length);
    }

    /**
     * Set state word at position
     */
    setWord(position, word) {
      this.x[position] = [word[0], word[1]];
    }

    /**
     * Get state word at position
     */
    getWord(position) {
      return [this.x[position][0], this.x[position][1]];
    }
  }

  // ========================[ ASCON-128 AEAD INSTANCE ]========================

  class Ascon128Instance extends IAeadInstance {
    constructor(algorithm, isInverse) {
      super(algorithm);
      this.isInverse = isInverse;

      // Algorithm parameters
      this._key = null;
      this._nonce = null;

      // Buffered data
      this.aadBuffer = [];
      this.dataBuffer = [];

      // State tracking
      this.state = new AsconState();
      this.initialized = false;
      this.aadProcessed = false;
    }

    // Property: key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error('Invalid key size: ' + keyBytes.length + ' bytes (must be 16 bytes)');
      }

      this._key = Array.from(keyBytes);
    }

    get key() {
      return this._key ? Array.from(this._key) : null;
    }

    // Property: nonce
    set nonce(nonceBytes) {
      if (!nonceBytes) {
        this._nonce = null;
        return;
      }

      if (nonceBytes.length !== 16) {
        throw new Error('Invalid nonce size: ' + nonceBytes.length + ' bytes (must be 16 bytes)');
      }

      this._nonce = Array.from(nonceBytes);
    }

    get nonce() {
      return this._nonce ? Array.from(this._nonce) : null;
    }

    // Property: aad (associated data)
    set aad(aadBytes) {
      if (!aadBytes) {
        this.aadBuffer = [];
        return;
      }

      this.aadBuffer = Array.from(aadBytes);
    }

    get aad() {
      return Array.from(this.aadBuffer);
    }

    /**
     * Initialize ASCON state with IV, Key, and Nonce
     */
    initialize() {
      if (!this._key || !this._nonce) {
        throw new Error('Key and nonce must be set before initialization');
      }

      // Initialize state: S = IV || K || N
      // x0 = IV
      this.state.setWord(0, ASCON128_IV);

      // x1 = K[0..7] (first 64 bits of key)
      this.state.setWord(1, pack64BE(this._key, 0));

      // x2 = K[8..15] (last 64 bits of key)
      this.state.setWord(2, pack64BE(this._key, 8));

      // x3 = N[0..7] (first 64 bits of nonce)
      this.state.setWord(3, pack64BE(this._nonce, 0));

      // x4 = N[8..15] (last 64 bits of nonce)
      this.state.setWord(4, pack64BE(this._nonce, 8));

      // Apply 12-round permutation
      this.state.permute(12);

      // XOR key into state: x3 ^= K[0..7], x4 ^= K[8..15]
      this.state.xorWord(3, pack64BE(this._key, 0));
      this.state.xorWord(4, pack64BE(this._key, 8));

      this.initialized = true;
      this.aadProcessed = false;
    }

    /**
     * Process associated data (AAD)
     */
    processAAD() {
      if (!this.initialized) {
        this.initialize();
      }

      if (this.aadProcessed) return;

      const aad = this.aadBuffer;
      const aadLen = aad.length;

      // Only process AAD if length > 0
      if (aadLen > 0) {
        // Process full 8-byte blocks
        let offset = 0;
        while (offset + 8 <= aadLen) {
          this.state.xorBytes(aad, offset, 8);
          this.state.permute(6);
          offset += 8;
        }

        // Process final block (may be partial or empty if aadLen was multiple of 8)
        // This matches C reference: lw_xor_block + padding + permute ALWAYS happens
        const remaining = aadLen - offset;
        const finalBlock = new Array(8);
        for (let i = 0; i < 8; ++i) {
          if (i < remaining) {
            finalBlock[i] = aad[offset + i];
          } else if (i === remaining) {
            finalBlock[i] = 0x80; // Padding: 10*
          } else {
            finalBlock[i] = 0x00;
          }
        }
        this.state.xorBytes(finalBlock, 0, 8);
        this.state.permute(6);
      }

      // Domain separation: x4[0] ^= 1
      this.state.x[4][0] = (this.state.x[4][0] ^ 1) >>> 0;

      this.aadProcessed = true;
    }

    /**
     * Feed data for encryption or decryption
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      this.dataBuffer.push.apply(this.dataBuffer, data);
    }

    /**
     * Result: Encrypt or decrypt and produce authentication tag
     */
    Result() {
      if (!this._key || !this._nonce) {
        throw new Error('Key and nonce must be set');
      }

      if (!this.initialized) {
        this.initialize();
      }

      // Process AAD if not already done
      if (!this.aadProcessed) {
        this.processAAD();
      }

      const input = this.dataBuffer;
      const inputLen = input.length;
      const output = [];

      if (this.isInverse) {
        // DECRYPTION MODE

        // Extract tag from end of ciphertext
        if (inputLen < 16) {
          throw new Error('Ciphertext too short (must include 16-byte tag)');
        }

        const ciphertextLen = inputLen - 16;
        const ciphertext = input.slice(0, ciphertextLen);
        const expectedTag = input.slice(ciphertextLen, inputLen);

        // Decrypt ciphertext - matches C reference ascon_decrypt_8
        let offset = 0;

        // Process complete 8-byte blocks
        while (offset + 8 <= ciphertextLen) {
          const block = ciphertext.slice(offset, offset + 8);
          const keystream = this.state.extractBytes(8);

          // Plaintext = Ciphertext XOR Keystream
          for (let i = 0; i < 8; ++i) {
            output.push(block[i] ^ keystream[i]);
          }

          // Update state with ciphertext and permute
          this.state.xorBytes(block, 0, 8);
          this.state.permute(6);

          offset += 8;
        }

        // Process final block (may be 0-7 bytes)
        // C reference: extract keystream, decrypt, then add padding, NO final permute
        const remaining = ciphertextLen - offset;

        if (remaining > 0) {
          const block = ciphertext.slice(offset, ciphertextLen);
          const keystream = this.state.extractBytes(remaining);

          for (let i = 0; i < remaining; ++i) {
            output.push(block[i] ^ keystream[i]);
          }
        }

        // Add ONLY padding to state (matches encrypt behavior)
        // Do NOT XOR ciphertext bytes - only the 0x80 padding byte
        const paddedBlock = new Array(8);
        for (let i = 0; i < 8; ++i) {
          if (i === remaining) {
            paddedBlock[i] = 0x80; // padding at position 'remaining'
          } else {
            paddedBlock[i] = 0x00;
          }
        }
        this.state.xorBytes(paddedBlock, 0, 8);
        // NO permutation here!

        // Finalization: x1 ^= K[0..7], x2 ^= K[8..15]
        this.state.xorWord(1, pack64BE(this._key, 0));
        this.state.xorWord(2, pack64BE(this._key, 8));
        this.state.permute(12);

        // Extract computed tag: T = x3 ^ K[0..7] || x4 ^ K[8..15]
        const tag1 = xor64(this.state.getWord(3), pack64BE(this._key, 0));
        const tag2 = xor64(this.state.getWord(4), pack64BE(this._key, 8));
        const computedTag = unpack64BE(tag1).concat(unpack64BE(tag2));

        // Constant-time tag comparison
        let tagMatch = 0;
        for (let i = 0; i < 16; ++i) {
          tagMatch |= computedTag[i] ^ expectedTag[i];
        }

        if (tagMatch !== 0) {
          // Clear output on authentication failure
          OpCodes.ClearArray(output);
          throw new Error('Authentication tag verification failed');
        }

      } else {
        // ENCRYPTION MODE

        // Encrypt plaintext - matches working ascon.js and C reference
        let offset = 0;

        // Process complete 8-byte blocks
        while (offset + 8 <= inputLen) {
          const block = input.slice(offset, offset + 8);

          // XOR plaintext into state: state ^= plaintext
          // This simultaneously: (1) absorbs plaintext, (2) produces ciphertext in state
          this.state.xorBytes(block, 0, 8);

          // Extract ciphertext from state (state is now original_state XOR plaintext = ciphertext)
          const cipherBlock = this.state.extractBytes(8);
          output.push.apply(output, cipherBlock);

          // Permute for next block
          this.state.permute(6);

          offset += 8;
        }

        // Process final block (may be 0-7 bytes)
        // Unlike complete blocks, final block does not get permuted
        const remaining = inputLen - offset;

        if (remaining > 0) {
          const block = input.slice(offset, inputLen);

          // XOR plaintext into state
          this.state.xorBytes(block, 0, remaining);

          // Extract ciphertext
          const cipherBlock = this.state.extractBytes(remaining);
          output.push.apply(output, cipherBlock);
        }

        // Add padding byte at position 'remaining'
        // C reference: state.B[len] ^= 0x80
        const paddedBlock = new Array(8);
        for (let i = 0; i < 8; ++i) {
          if (i === remaining) {
            paddedBlock[i] = 0x80; // padding at position 'remaining'
          } else {
            paddedBlock[i] = 0x00;
          }
        }
        this.state.xorBytes(paddedBlock, 0, 8);
        // NO permutation after final block!

        // Finalization: x1 ^= K[0..7], x2 ^= K[8..15]
        this.state.xorWord(1, pack64BE(this._key, 0));
        this.state.xorWord(2, pack64BE(this._key, 8));
        this.state.permute(12);

        // Extract tag: T = x3 ^ K[0..7] || x4 ^ K[8..15]
        const tag1 = xor64(this.state.getWord(3), pack64BE(this._key, 0));
        const tag2 = xor64(this.state.getWord(4), pack64BE(this._key, 8));
        const tag = unpack64BE(tag1).concat(unpack64BE(tag2));

        // Append tag to ciphertext
        output.push.apply(output, tag);
      }

      // Reset for next operation
      this.dataBuffer = [];
      this.initialized = false;
      this.aadProcessed = false;

      return output;
    }
  }

  // ========================[ ASCON-128 ALGORITHM ]========================

  class Ascon128Algorithm extends AeadAlgorithm {
    constructor() {
      super();

      // Metadata
      this.name = "ASCON-128";
      this.description = "NIST's lightweight cryptography standard for authenticated encryption. Winner of NIST LWC competition, standardized in SP 800-232.";
      this.inventor = "Christoph Dobraunig, Maria Eichlseder, Florian Mendel, Martin Schläffer";
      this.year = 2014;
      this.category = CategoryType.AEAD;
      this.subCategory = "Authenticated Encryption";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.INTL;

      // Algorithm capabilities
      this.SupportedKeySizes = [new KeySize(16, 16, 1)]; // 128-bit keys only
      this.SupportedNonceSizes = [new KeySize(16, 16, 1)]; // 128-bit nonces only
      this.SupportedTagSizes = [new KeySize(16, 16, 1)]; // 128-bit tags only
      this.SupportsDetached = false;

      // Documentation
      this.documentation = [
        new LinkItem(
          "NIST SP 800-232: Lightweight Cryptography",
          "https://csrc.nist.gov/pubs/sp/800/232/final"
        ),
        new LinkItem(
          "ASCON Official Specification",
          "https://ascon.iaik.tugraz.at/files/asconv12-nist.pdf"
        ),
        new LinkItem(
          "NIST LWC Competition Results",
          "https://csrc.nist.gov/Projects/lightweight-cryptography"
        ),
        new LinkItem(
          "ASCON C Reference Implementation",
          "https://github.com/ascon/ascon-c"
        )
      ];

      // Official test vectors from NIST LWC KAT file
      // Source: Reference Sources/c-cpp-source/academic/lightweight-crypto/test/kat/ASCON-128.txt
      this.tests = [
        {
          text: "NIST LWC KAT Count=1 (empty plaintext, empty AAD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes(""),
          expected: OpCodes.Hex8ToBytes("E355159F292911F794CB1432A0103A8A")
        },
        {
          text: "NIST LWC KAT Count=34 (1-byte plaintext, empty AAD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes(""),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("BC18C3F4E39ECA7222490D967C79BFFC92")
        },
        {
          text: "NIST LWC KAT Count=42 (1-byte plaintext, 8-byte AAD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("695A8F1BD29D59C5C82021B6CACE80C895")
        },
        {
          text: "NIST LWC KAT multi-block (16-byte plaintext, 8-byte AAD)",
          uri: "https://csrc.nist.gov/projects/lightweight-cryptography/finalists",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          nonce: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          aad: OpCodes.Hex8ToBytes("0001020304050607"),
          input: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          expected: OpCodes.Hex8ToBytes("69FFEE6F5505A4897E2EC80CBDFF67CE31614DAC97643C45940A8F9E7964613A")
        }
      ];
    }

    CreateInstance(isInverse) {
      return new Ascon128Instance(this, isInverse || false);
    }
  }

  // Register algorithm
  RegisterAlgorithm(new Ascon128Algorithm());

  return { Ascon128Algorithm, Ascon128Instance };
}));
