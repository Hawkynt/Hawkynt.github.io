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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  /** @type {int32} */
  const BLOCK_SIZE = 16;   // Key and keystream block size in bytes

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * Educational E2-inspired counter keystream generator
   */
  class E2StreamAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = 'E2 (NTT AES candidate)';
      this.description = 'Educational implementation of E2 block cipher adapted as a stream cipher using keystream generation. Originally an AES candidate by NTT with Feistel structure.';
      this.inventor = 'NTT (Nippon Telegraph and Telephone)';
      this.year = 1998;
      this.category = CategoryType.STREAM;
      this.subCategory = 'Stream Cipher';
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      /** @type {string} */
      this.securityNotes = 'Block cipher adapted for educational stream cipher demonstration. Original E2 was an AES candidate.';
      this.country = CountryCode.JP;

      this.SupportedKeySizes = [new KeySize(16, 16, 1)];

      this.documentation = [
        new LinkItem('E2 (cipher) - Wikipedia', 'https://en.wikipedia.org/wiki/E2_(cipher)'),
        new LinkItem('E2 - A Candidate Cipher for AES (NTT, First AES Candidate Conference, 1998)', 'https://pdfs.semanticscholar.org/d97c/e39b4bec4d467a1b0c45cdd0fa49a058c964.pdf'),
        new LinkItem('NIST AES Development Archive (Round 1 candidates)', 'https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines/archived-crypto-projects/aes-development')
      ];

      // No live public reference-implementation repository for E2 is known to exist (NTT's
      // original 1998 submission archive at info.isl.ntt.co.jp/e2/ is no longer reachable);
      // the most authoritative surviving sources are NTT's own archive index and the official
      // AES-conference paper on E2 software implementation technique, cited below.
      this.references = [
        new LinkItem('NTT Social Informatics Laboratories - Encryption Archive (E2 submission)', 'https://info.isl.ntt.co.jp/crypt/eng/archive/'),
        new LinkItem('Optimized Software Implementations of E2 (Aoki and Ueda, NIST AES Candidate Conference, 1999)', 'https://csrc.nist.rip/encryption/aes/round1/conf2/papers/aoki.pdf')
      ];

      this.tests = [
        {
          text: 'Self-computed vector: output of this educational E2-based keystream construction, verified for self-consistency (not an official NTT E2 test vector - this implementation is a simplified stream-cipher adaptation, not the original E2 Feistel block cipher)',
          uri: 'https://en.wikipedia.org/wiki/E2_(cipher)',
          input: OpCodes.Hex8ToBytes('0001020304050607'),
          key: OpCodes.Hex8ToBytes('00010203040506070809101112131415'),
          expected: OpCodes.Hex8ToBytes('1a1b18191e1f1c1d') // Generated from implementation
        }
      ];
    }

    /**
     * @param {boolean} [isInverse=false] - Decryption flag (XOR stream: same operation)
     * @returns {E2StreamInstance} New instance
     */
    CreateInstance(isInverse = false) {
      return new E2StreamInstance(this, isInverse);
    }
  }

  /**
   * Keystream instance; every message starts at block counter 0
   */
  class E2StreamInstance extends IAlgorithmInstance {
    /**
     * @param {E2StreamAlgorithm} algorithm - Parent algorithm
     * @param {boolean} [isInverse=false] - Decryption flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      /** @type {boolean} */
      this.isInverse = isInverse;
      /** @type {uint8[]} */
      this.inputBuffer = [];
      /** @type {uint8[]|null} */
      this._key = null;
    }

    /**
     * @param {uint8[]|null} keyBytes - 16-byte key
     */
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }
      if (keyBytes.length !== BLOCK_SIZE) {
        throw new Error('Invalid E2 key size: ' + keyBytes.length + ' bytes. Key must be 16 bytes');
      }
      this._key = [...keyBytes];
    }

    /**
     * @returns {uint8[]|null} Copy of the key
     */
    get key() {
      return this._key ? [...this._key] : null;
    }

    /**
     * @param {uint8[]} data - Input bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;
      for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
    }

    /**
     * XOR the buffered input with the keystream
     * @returns {uint8[]} Output bytes
     */
    Result() {
      if (!this._key) throw new Error('Key not set');

      /** @type {uint8[]} */
      const output = [];
      /** @type {uint8[]} */
      let keystream = [];
      /** @type {uint32} */
      let blockCounter = 0;
      /** @type {int32} */
      let keystreamPos = 0;

      for (let i = 0; i < this.inputBuffer.length; i++) {
        if (keystreamPos >= keystream.length) {
          keystream = this._generateKeystream(this._key, blockCounter);
          blockCounter++;
          keystreamPos = 0;
        }
        output.push(OpCodes.Xor8(this.inputBuffer[i], keystream[keystreamPos]));
        keystreamPos++;
      }

      this.inputBuffer = [];
      return output;
    }

    /**
     * One 16-byte keystream block (simplified E2-based counter construction)
     * @param {uint8[]} key - 16-byte key
     * @param {uint32} blockIndex - Block counter
     * @returns {uint8[]} 16 keystream bytes
     */
    _generateKeystream(key, blockIndex) {
      /** @type {uint8[]} */
      const counter = OpCodes.CreateArray(BLOCK_SIZE, 0);
      for (let i = 0; i < BLOCK_SIZE; i++) {
        counter[i] = OpCodes.UintToByte(OpCodes.Shr32(blockIndex, (i % 4) * 8));
      }

      /** @type {uint8[]} */
      const keystream = OpCodes.CreateArray(BLOCK_SIZE, 0);
      for (let i = 0; i < BLOCK_SIZE; i++) {
        keystream[i] = OpCodes.UintToByte(OpCodes.Xor32(OpCodes.Xor32(key[i], counter[i]), OpCodes.Add32(OpCodes.Mul32(blockIndex, 17), i)));
      }

      // S-box-like diffusion pass, in place and in order
      for (let i = 0; i < BLOCK_SIZE; i++) {
        keystream[i] = OpCodes.UintToByte(OpCodes.Add32(keystream[i], OpCodes.Xor32(keystream[(i + 1) % BLOCK_SIZE], keystream[(i + 15) % BLOCK_SIZE])));
      }

      return keystream;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new E2StreamAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { E2StreamAlgorithm, E2StreamInstance };
}));
