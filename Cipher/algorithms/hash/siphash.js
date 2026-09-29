/*
 * SipHash-2-4 - Cryptographically Secure PRF for Hash Tables
 * Educational implementation designed by Jean-Philippe Aumasson and Daniel J. Bernstein
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, Vulnerability,
          KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  // SipHash constants
  /** @type {int32} */
  const KEY_SIZE = 16;
  /** @type {int32} */
  const OUTPUT_SIZE = 8;
  /** @type {int32} */
  const C_ROUNDS = 2;
  /** @type {int32} */
  const D_ROUNDS = 4;

  /** @type {BigInt} */
  const MASK64 = 0xFFFFFFFFFFFFFFFFn;

  // The initialisation constants spell "somepseudorandomlygeneratedbytes".
  /** @type {BigInt} */
  const IV0 = 0x736f6d6570736575n;
  /** @type {BigInt} */
  const IV1 = 0x646f72616e646f6dn;
  /** @type {BigInt} */
  const IV2 = 0x6c7967656e657261n;
  /** @type {BigInt} */
  const IV3 = 0x7465646279746573n;

  /**
   * SipHashAlgorithm - keyed 64-bit PRF
   * @class
   * @extends {HashFunctionAlgorithm}
   */
  class SipHashAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "SipHash-2-4";
      this.description = "Fast cryptographically secure pseudorandom function designed for hash tables and data structures requiring collision resistance.";
      this.inventor = "Jean-Philippe Aumasson, Daniel J. Bernstein";
      this.year = 2012;
      this.country = CountryCode.INTL;
      this.category = CategoryType.HASH;
      this.subCategory = "MAC/PRF";
      this.securityStatus = SecurityStatus.EDUCATIONAL; // Cryptographically secure PRF

      this.SupportedOutputSizes = [new KeySize(OUTPUT_SIZE, OUTPUT_SIZE, 1)];

      this.documentation = [
        new LinkItem("SipHash Paper", "https://cr.yp.to/siphash/siphash-20120918.pdf"),
        new LinkItem("RFC 9018 (DNS Cookie usage)", "https://www.rfc-editor.org/rfc/rfc9018.txt"),
        new LinkItem("SipHash Official Repository", "https://github.com/veorq/SipHash")
      ];

      this.references = [
        new LinkItem("Redis Hash Table Usage", "https://github.com/redis/redis"),
        new LinkItem("Linux Kernel Usage", "https://git.kernel.org/"),
        new LinkItem("Rust HashMap Implementation", "https://github.com/rust-lang/rust")
      ];

      this.knownVulnerabilities = [
        new Vulnerability(
          "Key Management",
          "Security depends on secret key - key reuse or weak keys reduce security",
          "Use strong random 128-bit keys, rotate keys periodically"
        )
      ];

      // The reference vectors.h holds 64 entries: entry i is the digest of the
      // first i bytes of 00 01 .. 3f under the key 00 01 .. 0f. It stores each
      // result little-endian, which is the byte order an implementation emits;
      // the paper prints the same numbers big-endian. The entries below are the
      // boundary lengths - empty, one byte, one under a block, exactly a block,
      // one over, and two whole blocks.
      this.tests = [
        {
          text: "vectors.h entry 0 - empty message",
          uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: [],
          expected: OpCodes.Hex8ToBytes("310e0edd47db6f72")
        },
        {
          text: "vectors.h entry 1 - one byte",
          uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("00"),
          expected: OpCodes.Hex8ToBytes("fd67dc93c539f874")
        },
        {
          text: "vectors.h entry 7 - one byte under the 8-byte block",
          uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("00010203040506"),
          expected: OpCodes.Hex8ToBytes("37d1018bf50002ab")
        },
        {
          text: "vectors.h entry 8 - exactly one block",
          uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("0001020304050607"),
          expected: OpCodes.Hex8ToBytes("6224939a79f5f593")
        },
        {
          text: "vectors.h entry 9 - one byte over a block",
          uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("000102030405060708"),
          expected: OpCodes.Hex8ToBytes("b0e4a90bdf82009e")
        },
        {
          text: "vectors.h entry 16 - two whole blocks",
          uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          expected: OpCodes.Hex8ToBytes("db9bc2577fcc2a3f")
        },
        {
          text: "vectors.h entry 63 - 63 bytes",
          uri: "https://github.com/veorq/SipHash/blob/master/vectors.h",
          key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
          input: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e"),
          expected: OpCodes.Hex8ToBytes("724506eb4c328a95")
        }
      ];
    }

    /**
     * Create a new SipHash instance
     * @param {boolean} [isInverse=false] - Unused: a PRF has no inverse
     * @returns {SipHashInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new SipHashInstance(this, isInverse);
    }
  }

  /**
   * SipHash-2-4 instance implementing the Feed/Result pattern
   * @class
   * @extends {IHashFunctionInstance}
   */
  class SipHashInstance extends IHashFunctionInstance {
    /**
     * @param {SipHashAlgorithm} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Unused
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = OUTPUT_SIZE;

      /** @type {uint8[]} */
      this.key = null;
      /** @type {uint8[]} */
      this._inputBuffer = [];
      this.Init();
    }

    /**
     * Reset the key to all zeros
     * @returns {boolean} Always true
     */
    Init() {
      this.key = OpCodes.CreateArray(KEY_SIZE, 0);
      return true;
    }

    /**
     * Key setup (128-bit key required); a shorter key selects the zero key
     * @param {uint8[]} key - 16 key bytes (extra bytes are ignored)
     * @returns {string} Key identifier
     */
    KeySetup(key) {
      if (key && key.length >= KEY_SIZE) {
        this.key = key.slice(0, KEY_SIZE);
      } else {
        // Use zero key for testing
        this.key = OpCodes.CreateArray(KEY_SIZE, 0);
      }
      /** @type {string} */
      const hi = this.key[0].toString(16);
      /** @type {string} */
      const lo = this.key[1].toString(16);
      return "siphash-" + hi + lo;
    }

    /**
     * Read one little-endian 64-bit word
     * @param {uint8[]} bytes - Source bytes
     * @param {int32} offset - Index of the first byte
     * @returns {BigInt} The word
     */
    _le64(bytes, offset) {
      /** @type {BigInt} */
      let value = 0n;
      for (let i = 7; i >= 0; i--) {
        value = OpCodes.ShiftLn(value, 8) + BigInt(bytes[offset + i]);
      }
      return value;
    }

    /**
     * One SipRound over the state
     * @param {BigInt[]} v - State words v0..v3, updated in place
     * @returns {void}
     */
    _sipRound(v) {
      v[0] = OpCodes.AndN(v[0] + v[1], MASK64);
      v[1] = OpCodes.RotL64n(v[1], 13);
      v[1] = OpCodes.XorN(v[1], v[0]);
      v[0] = OpCodes.RotL64n(v[0], 32);

      v[2] = OpCodes.AndN(v[2] + v[3], MASK64);
      v[3] = OpCodes.RotL64n(v[3], 16);
      v[3] = OpCodes.XorN(v[3], v[2]);

      v[0] = OpCodes.AndN(v[0] + v[3], MASK64);
      v[3] = OpCodes.RotL64n(v[3], 21);
      v[3] = OpCodes.XorN(v[3], v[0]);

      v[2] = OpCodes.AndN(v[2] + v[1], MASK64);
      v[1] = OpCodes.RotL64n(v[1], 17);
      v[1] = OpCodes.XorN(v[1], v[2]);
      v[2] = OpCodes.RotL64n(v[2], 32);
    }

    /**
     * Absorb one message word
     * @param {BigInt[]} v - State words v0..v3, updated in place
     * @param {BigInt} m - Message word
     * @returns {void}
     */
    _absorb(v, m) {
      v[3] = OpCodes.XorN(v[3], m);
      for (let i = 0; i < C_ROUNDS; i++) this._sipRound(v);
      v[0] = OpCodes.XorN(v[0], m);
    }

    /**
     * Main SipHash function.
     *
     * The state is four 64-bit words. They are held as BigInt here because the
     * split 32-bit form this file used before had its four initialisation
     * constants transposed, and a single 64-bit value cannot be half wrong.
     * @param {uint8[]} message - Message bytes
     * @param {uint8[]} key - 16 key bytes
     * @returns {uint8[]} 8-byte digest, little-endian
     */
    siphash(message, key) {
      if (key.length !== KEY_SIZE) {
        throw new Error("SipHash requires 128-bit (16-byte) key");
      }

      const k0 = this._le64(key, 0);
      const k1 = this._le64(key, 8);

      /** @type {BigInt[]} */
      const v = [
        OpCodes.XorN(k0, IV0),
        OpCodes.XorN(k1, IV1),
        OpCodes.XorN(k0, IV2),
        OpCodes.XorN(k1, IV3)
      ];

      // Whole 8-byte blocks
      const messageLen = message.length;
      const whole = messageLen - (messageLen % 8);
      for (let offset = 0; offset < whole; offset += 8) this._absorb(v, this._le64(message, offset));

      // The final block always exists: the tail bytes, zero filled, with the
      // low byte of the message length in the top byte. An empty message goes
      // through this path like any other, which is why there is no special case.
      const finalBlock = OpCodes.CreateArray(8, 0);
      for (let i = 0; i < messageLen - whole; i++) finalBlock[i] = message[whole + i];
      finalBlock[7] = OpCodes.And32(messageLen, 0xFF);
      this._absorb(v, this._le64(finalBlock, 0));

      // Finalization
      v[2] = OpCodes.XorN(v[2], 0xffn);
      for (let i = 0; i < D_ROUNDS; i++) this._sipRound(v);

      const result = OpCodes.XorN(OpCodes.XorN(v[0], v[1]), OpCodes.XorN(v[2], v[3]));
      /** @type {uint8[]} */
      const out = new Array(8);
      for (let i = 0; i < 8; i++) {
        /** @type {uint8} */
        const b = Number(OpCodes.AndN(OpCodes.ShiftRn(result, 8 * i), 0xffn));
        out[i] = b;
      }
      return out;
    }

    /**
     * Hash a complete message with the current key.
     * The empty message is an ordinary case: it produces one padded final
     * block whose last byte carries the length, exactly like any other tail.
     * @param {uint8[]} input - Message bytes
     * @returns {uint8[]} Digest bytes
     */
    ProcessInput(input) {
      if (!input) return this.siphash([], this.key);
      return this.siphash(input, this.key);
    }

    /**
     * Universal cipher interface: hash the block
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} plaintext - Message bytes
     * @returns {uint8[]} Digest bytes
     */
    EncryptBlock(blockIndex, plaintext) {
      return this.ProcessInput(plaintext);
    }

    /**
     * SipHash has no inverse
     * @param {int32} blockIndex - Unused
     * @param {uint8[]} ciphertext - Unused
     * @returns {uint8[]} Never returns
     */
    DecryptBlock(blockIndex, ciphertext) {
      throw new Error("SipHash is a one-way PRF and cannot be decrypted");
    }

    /**
     * Wipe the key (it becomes the zero key)
     * @returns {void}
     */
    ClearData() {
      if (this.key) {
        OpCodes.ClearArray(this.key);
        this.key = OpCodes.CreateArray(KEY_SIZE, 0);
      }
    }

    /**
     * Append message bytes
     * @param {uint8[]} data - Input bytes
     * @returns {void}
     */
    Feed(data) {
      this._inputBuffer = this._inputBuffer.concat(data);
    }

    /**
     * Digest of everything fed so far (the buffer is kept)
     * @returns {uint8[]} 8-byte digest
     */
    Result() {
      return this.ProcessInput(this._inputBuffer);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new SipHashAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { SipHashAlgorithm, SipHashInstance };
}));
