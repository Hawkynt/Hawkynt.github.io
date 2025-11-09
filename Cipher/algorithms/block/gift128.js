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
    // Browser/Worker global - assign exports to global scope
    const exports = factory(root.AlgorithmFramework, root.OpCodes);
    if (exports) Object.assign(root, exports);
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  class Gift128Algorithm extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "GIFT-128";
      this.description = "Lightweight block cipher designed for efficient hardware and software implementation. Uses 128-bit blocks with 128-bit keys and 40 rounds. Selected for NIST Lightweight Cryptography standardization in GIFT-COFB.";
      this.inventor = "Subhadeep Banik, Sumit Kumar Pandey, Thomas Peyrin, et al.";
      this.year = 2017;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.SG; // Singapore (Nanyang Technological University)

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(16, 16, 0) // GIFT-128 uses only 128-bit keys
      ];
      this.SupportedBlockSizes = [
        new KeySize(16, 16, 0) // Fixed 128-bit blocks
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("GIFT Specification (ePrint 2017/622)", "https://eprint.iacr.org/2017/622.pdf"),
        new LinkItem("GIFT-COFB NIST LWC Finalist", "https://csrc.nist.gov/Projects/lightweight-cryptography/finalists"),
        new LinkItem("Official GIFT Website", "https://giftcipher.github.io/gift/")
      ];

      this.references = [
        new LinkItem("Original GIFT Paper (CHES 2017)", "https://eprint.iacr.org/2017/622.pdf"),
        new LinkItem("GIFT-COFB Specification", "https://eprint.iacr.org/2020/412.pdf"),
        new LinkItem("NIST LWC GIFT-COFB", "https://csrc.nist.gov/CSRC/media/Projects/lightweight-cryptography/documents/finalist-round/updated-spec-doc/gift-cofb-spec-final.pdf")
      ];

      // Test vectors generated from reference implementation
      // Source: X:\Coding\Working Copies\Hawkynt.git\Hawkynt.github.io\Cipher\Reference Sources\c-cpp-source\academic\lightweight-crypto
      this.tests = [
        {
          text: 'GIFT-128 Test Vector #1 (All Zeros)',
          uri: 'Generated from reference implementation (Southern Storm Software)',
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("5e8e3a2e1697a77dcc0b89dcd97a64ee")
        },
        {
          text: 'GIFT-128 Test Vector #2 (Incrementing Pattern)',
          uri: 'Generated from reference implementation (Southern Storm Software)',
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("81326fbb780c5cf4f4d6c465bfa9ee2f")
        },
        {
          text: 'GIFT-128 Test Vector #3 (Known Pattern)',
          uri: 'Generated from reference implementation (Southern Storm Software)',
          input: OpCodes.Hex8ToBytes("102030405060708090a0b0c0d0e0f000"),
          key: OpCodes.Hex8ToBytes("0102030405060708090a0b0c0d0e0f10"),
          expected: OpCodes.Hex8ToBytes("41948f85e16a56872a812e1f0b8f9a9e")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new Gift128Instance(this, isInverse);
    }
  }

  class Gift128Instance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];
      this.BlockSize = 16;
    }

    // Round constants for GIFT-128 (6-bit values)
    static RC = Object.freeze([
      0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3E, 0x3D, 0x3B,
      0x37, 0x2F, 0x1E, 0x3C, 0x39, 0x33, 0x27, 0x0E,
      0x1D, 0x3A, 0x35, 0x2B, 0x16, 0x2C, 0x18, 0x30,
      0x21, 0x02, 0x05, 0x0B, 0x17, 0x2E, 0x1C, 0x38,
      0x31, 0x23, 0x06, 0x0D, 0x1B, 0x36, 0x2D, 0x1A
    ]);

    // Property setter for key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      // Validate key size (must be exactly 16 bytes for GIFT-128)
      if (keyBytes.length !== 16) {
        throw new Error("Invalid key size: " + keyBytes.length + " bytes (GIFT-128 requires 16 bytes)");
      }

      this._key = [...keyBytes];
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Bit permutation helper using bit_permute_step technique
    bitPermuteStep(value, mask, shift) {
      const t = ((value >>> shift) ^ value) & mask;
      return (value ^ t) ^ (t << shift);
    }

    // PERM3_INNER - Core permutation used by all PERM functions
    perm3Inner(x) {
      x = this.bitPermuteStep(x, 0x0a0a0a0a, 3);
      x = this.bitPermuteStep(x, 0x00cc00cc, 6);
      x = this.bitPermuteStep(x, 0x0000f0f0, 12);
      x = this.bitPermuteStep(x, 0x000000ff, 24);
      return x >>> 0;
    }

    // PERM0 - Permutation with 8-bit left rotation
    perm0(x) {
      const permuted = this.perm3Inner(x);
      return OpCodes.RotL32(permuted, 8);
    }

    // PERM1 - Permutation with 16-bit left rotation
    perm1(x) {
      const permuted = this.perm3Inner(x);
      return OpCodes.RotL32(permuted, 16);
    }

    // PERM2 - Permutation with 24-bit left rotation
    perm2(x) {
      const permuted = this.perm3Inner(x);
      return OpCodes.RotL32(permuted, 24);
    }

    // PERM3 - Permutation without rotation
    perm3(x) {
      return this.perm3Inner(x);
    }

    // INV_PERM3_INNER - Inverse of core permutation
    invPerm3Inner(x) {
      x = this.bitPermuteStep(x, 0x00550055, 9);
      x = this.bitPermuteStep(x, 0x00003333, 18);
      x = this.bitPermuteStep(x, 0x000f000f, 12);
      x = this.bitPermuteStep(x, 0x000000ff, 24);
      return x >>> 0;
    }

    // INV_PERM0 - Inverse permutation with 8-bit right rotation
    invPerm0(x) {
      const rotated = OpCodes.RotR32(x, 8);
      return this.invPerm3Inner(rotated);
    }

    // INV_PERM1 - Inverse permutation with 16-bit right rotation
    invPerm1(x) {
      const rotated = OpCodes.RotR32(x, 16);
      return this.invPerm3Inner(rotated);
    }

    // INV_PERM2 - Inverse permutation with 24-bit right rotation
    invPerm2(x) {
      const rotated = OpCodes.RotR32(x, 24);
      return this.invPerm3Inner(rotated);
    }

    // INV_PERM3 - Inverse permutation without rotation
    invPerm3(x) {
      return this.invPerm3Inner(x);
    }

    // GIFT-128 S-box (SubCells operation)
    sbox(state) {
      let s0 = state[0], s1 = state[1], s2 = state[2], s3 = state[3];

      s1 ^= s0 & s2;
      s0 ^= s1 & s3;
      s2 ^= s0 | s1;
      s3 ^= s2;
      s1 ^= s3;
      s3 ^= 0xFFFFFFFF;
      s2 ^= s0 & s1;

      // Swap s0 and s3
      const temp = s0;
      s0 = s3;
      s3 = temp;

      return [s0 >>> 0, s1 >>> 0, s2 >>> 0, s3 >>> 0];
    }

    // Inverse GIFT-128 S-box
    invSbox(state) {
      let s0 = state[0], s1 = state[1], s2 = state[2], s3 = state[3];

      // Swap s0 and s3 first (inverse of final swap)
      const temp = s0;
      s0 = s3;
      s3 = temp;

      s2 ^= s0 & s1;
      s3 ^= 0xFFFFFFFF;
      s1 ^= s3;
      s3 ^= s2;
      s2 ^= s0 | s1;
      s0 ^= s1 & s3;
      s1 ^= s0 & s2;

      return [s0 >>> 0, s1 >>> 0, s2 >>> 0, s3 >>> 0];
    }

    // Apply bit permutation to state
    applyPermutation(state) {
      return [
        this.perm0(state[0]),
        this.perm1(state[1]),
        this.perm2(state[2]),
        this.perm3(state[3])
      ];
    }

    // Apply inverse bit permutation to state
    applyInvPermutation(state) {
      return [
        this.invPerm0(state[0]),
        this.invPerm1(state[1]),
        this.invPerm2(state[2]),
        this.invPerm3(state[3])
      ];
    }

    // Rotate key schedule forward (used in encryption)
    rotateKeyForward(keyState) {
      const temp = keyState[3];
      const newW0 = ((temp & 0xFFFC0000) >>> 2) | ((temp & 0x00030000) << 14) |
                    ((temp & 0x00000FFF) << 4) | ((temp & 0x0000F000) >>> 12);

      return [newW0 >>> 0, keyState[0], keyState[1], keyState[2]];
    }

    // Rotate key schedule backward (used in decryption)
    rotateKeyBackward(keyState) {
      const temp = keyState[0];
      const newW3 = ((temp & 0x3FFF0000) << 2) | ((temp & 0xC0000000) >>> 14) |
                    ((temp & 0x0000FFF0) >>> 4) | ((temp & 0x0000000F) << 12);

      return [keyState[1], keyState[2], keyState[3], newW3 >>> 0];
    }

    // Encrypt a single 16-byte block
    encryptBlock(input) {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Load plaintext (big-endian)
      let s0 = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
      let s1 = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);
      let s2 = OpCodes.Pack32BE(input[8], input[9], input[10], input[11]);
      let s3 = OpCodes.Pack32BE(input[12], input[13], input[14], input[15]);

      // Load key (big-endian, mirrored order 3,1,2,0 for fixslicing)
      const keyWords = [
        OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]),
        OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]),
        OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]),
        OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3])
      ];

      let state = [s0, s1, s2, s3];
      let keyState = [...keyWords];

      // Perform 40 rounds
      for (let round = 0; round < 40; round++) {
        // SubCells (S-box)
        state = this.sbox(state);

        // PermBits (bit permutation)
        state = this.applyPermutation(state);

        // AddRoundKey
        state[2] ^= keyState[1];
        state[1] ^= keyState[3];
        state[3] ^= (0x80000000 ^ Gift128Instance.RC[round]);

        // Ensure all values are unsigned 32-bit
        state = state.map(x => x >>> 0);

        // Rotate key schedule
        keyState = this.rotateKeyForward(keyState);
      }

      // Pack state into output (big-endian)
      const output = [];
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32BE(state[i]);
        output.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }

      return output;
    }

    // Decrypt a single 16-byte block
    decryptBlock(input) {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // Load ciphertext (big-endian)
      let s0 = OpCodes.Pack32BE(input[0], input[1], input[2], input[3]);
      let s1 = OpCodes.Pack32BE(input[4], input[5], input[6], input[7]);
      let s2 = OpCodes.Pack32BE(input[8], input[9], input[10], input[11]);
      let s3 = OpCodes.Pack32BE(input[12], input[13], input[14], input[15]);

      // Load key (big-endian, mirrored order 3,1,2,0)
      const keyWords = [
        OpCodes.Pack32BE(this._key[12], this._key[13], this._key[14], this._key[15]),
        OpCodes.Pack32BE(this._key[4], this._key[5], this._key[6], this._key[7]),
        OpCodes.Pack32BE(this._key[8], this._key[9], this._key[10], this._key[11]),
        OpCodes.Pack32BE(this._key[0], this._key[1], this._key[2], this._key[3])
      ];

      let state = [s0, s1, s2, s3];
      let keyState = [...keyWords];

      // Fast-forward key schedule to end of round 40
      // The key schedule rotates 4 words every round for 40 rounds
      // Equivalent to applying the rotation transformation 10 times to each word
      for (let i = 0; i < 4; i++) {
        let w = keyState[i];
        w = ((w & 0xFFF00000) >>> 4) | ((w & 0x000F0000) << 12) |
            ((w & 0x000000FF) << 8) | ((w & 0x0000FF00) >>> 8);
        keyState[i] = w >>> 0;
      }

      // Perform 40 rounds in reverse
      for (let round = 39; round >= 0; round--) {
        // Rotate key schedule backward
        keyState = this.rotateKeyBackward(keyState);

        // AddRoundKey (same as encryption, XOR is self-inverse)
        state[2] ^= keyState[1];
        state[1] ^= keyState[3];
        state[3] ^= (0x80000000 ^ Gift128Instance.RC[round]);

        // Ensure all values are unsigned 32-bit
        state = state.map(x => x >>> 0);

        // InvPermBits (inverse bit permutation)
        state = this.applyInvPermutation(state);

        // InvSubCells (inverse S-box)
        state = this.invSbox(state);
      }

      // Pack state into output (big-endian)
      const output = [];
      for (let i = 0; i < 4; i++) {
        const bytes = OpCodes.Unpack32BE(state[i]);
        output.push(bytes[0], bytes[1], bytes[2], bytes[3]);
      }

      return output;
    }

    // Feed/Result pattern implementation
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      // GIFT-128 operates on 16-byte blocks
      if (this.inputBuffer.length % 16 !== 0) {
        throw new Error("Invalid block size: " + this.inputBuffer.length + " bytes (must be multiple of 16)");
      }

      const output = [];

      // Process each 16-byte block
      for (let i = 0; i < this.inputBuffer.length; i += 16) {
        const block = this.inputBuffer.slice(i, i + 16);
        const result = this.isInverse ? this.decryptBlock(block) : this.encryptBlock(block);
        output.push(...result);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new Gift128Algorithm());

  // Export for module systems
  return {
    Gift128Algorithm: Gift128Algorithm,
    Gift128Instance: Gift128Instance
  };
}));
