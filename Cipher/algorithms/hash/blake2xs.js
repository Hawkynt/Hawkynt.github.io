

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', './blake2s'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('./blake2s')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes, root.BLAKE2sModule);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, BLAKE2sModule) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  if (!BLAKE2sModule) {
    throw new Error('BLAKE2s dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // Extract Blake2sHasher from the BLAKE2s module
  const { Blake2sHasher } = BLAKE2sModule;

  // ===== ALGORITHM IMPLEMENTATION =====

  // BLAKE2xs constants
  const BLAKE2XS_DIGEST_LENGTH = 32;
  const BLAKE2XS_UNKNOWN_DIGEST_LENGTH = 65535;
  const BLAKE2XS_MAX_NUMBER_BLOCKS = 0x100000000; // 2^32

  class BLAKE2xsAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BLAKE2xs";
      this.description = "BLAKE2xs is an eXtendable Output Function (XOF) based on BLAKE2s. It supports variable-length output from 1 byte to 2^32 blocks of 32 bytes.";
      this.inventor = "Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "BLAKE Family";
      this.securityStatus = SecurityStatus.EXPERIMENTAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      // Hash-specific metadata - XOF supports variable output
      this.SupportedOutputSizes = null; // Variable output size

      // Performance and technical specifications
      this.blockSize = 64; // 512 bits = 64 bytes (BLAKE2s block size)
      this.outputSize = null; // Variable output

      // Documentation and references
      this.documentation = [
        new LinkItem("BLAKE2X Specification", "https://blake2.net/blake2x.pdf"),
        new LinkItem("BLAKE2 Official Specification", "https://blake2.net/blake2.pdf"),
        new LinkItem("BLAKE2 Reference Implementation", "https://github.com/BLAKE2/BLAKE2")
      ];

      this.references = [
        new LinkItem("BouncyCastle BLAKE2xs Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/Blake2xsDigest.java"),
        new LinkItem("BLAKE2 Test Vectors", "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json")
      ];

      // Test vectors from BouncyCastle test suite
      // https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json
      const input256 = OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f202122232425262728292a2b2c2d2e2f303132333435363738393a3b3c3d3e3f404142434445464748494a4b4c4d4e4f505152535455565758595a5b5c5d5e5f606162636465666768696a6b6c6d6e6f707172737475767778797a7b7c7d7e7f808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9fa0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebfc0c1c2c3c4c5c6c7c8c9cacbcccdcecfd0d1d2d3d4d5d6d7d8d9dadbdcdddedfe0e1e2e3e4e5e6e7e8e9eaebecedeeeff0f1f2f3f4f5f6f7f8f9fafbfcfdfeff");

      this.tests = [
        {
          text: "BLAKE2xs XOF - 256 byte input, 1 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 1,
          expected: OpCodes.Hex8ToBytes("99")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 2 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 2,
          expected: OpCodes.Hex8ToBytes("57d5")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 3 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 3,
          expected: OpCodes.Hex8ToBytes("72d07f")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 4 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 4,
          expected: OpCodes.Hex8ToBytes("bdf28396")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 5 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 5,
          expected: OpCodes.Hex8ToBytes("20e81fc0f3")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 16 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("541e57a4988909ea2f81953f6ca1cb75")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 32 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 32,
          expected: OpCodes.Hex8ToBytes("91cab802b466092897c7639a02acf529ca61864e5e8c8e422b3a9381a95154d1")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 64 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 64,
          expected: OpCodes.Hex8ToBytes("91cab802b466092897c7639a02acf529ca61864e5e8c8e422b3a9381a95154d10253f5487d927a5d35d0089ad9cab2d7515b65d332e870c78d1229d1c584bec3d5")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 128 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 128,
          expected: OpCodes.Hex8ToBytes("91cab802b466092897c7639a02acf529ca61864e5e8c8e422b3a9381a95154d10253f5487d927a5d35d0089ad9cab2d7515b65d332e870c78d1229d1c584bec3d538524415a7ecc9d09128cbd0999bb76847fc812148b5a432548e4e500720b356c8034607a9e4ac70b3b61c47c44f9e5d05450bc356f2a323a9d2d213525ef2ad2905f82f79")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 256 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 256,
          expected: OpCodes.Hex8ToBytes("91cab802b466092897c7639a02acf529ca61864e5e8c8e422b3a9381a95154d10253f5487d927a5d35d0089ad9cab2d7515b65d332e870c78d1229d1c584bec3d538524415a7ecc9d09128cbd0999bb76847fc812148b5a432548e4e500720b356c8034607a9e4ac70b3b61c47c44f9e5d05450bc356f2a323a9d2d213525ef2ad2905f82f79c8ab4ac86f91ab339c79bec70920cdf382f7cffa279a80687a5c27cf691cc92777120c3ede63da44e818a837a9ccb7d339ae9e68bb4632eb34ad5dcc2223de7b8c1dca50a3739ff8eaad5a3ff34c717f1ea06334e074e30b4c57053501566d4889beb32933bc6dabd01f74d17fd3ec845a8fcb16cc5459868f5200a811f511c84caf7fd7f6de2010c162c1eaeca1f3f135b14c4de356")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BLAKE2xsAlgorithmInstance(this, isInverse);
    }
  }

  /**
   * BLAKE2xs XOF implementation
   * Based on BouncyCastle's Blake2xsDigest
   */
  class BLAKE2xsAlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;

      // XOF parameters
      this._digestLength = BLAKE2XS_UNKNOWN_DIGEST_LENGTH; // Unknown length by default
      this._outputSize = 32; // Default output size (can be changed via property)

      // Root hash
      this._rootHash = null;

      // Root hash digest (h0)
      this._h0 = null;

      // Current output buffer
      this._buf = new Uint8Array(32);
      this._bufPos = 32; // Start at end to trigger generation on first read

      // Position tracking
      this._digestPos = 0; // Current position in output
      this._blockPos = 0; // Current block number
      this._nodeOffset = 0; // Current node offset for XOF
    }

    /**
     * Set the desired output size in bytes
     */
    set outputSize(size) {
      if (size < 1) {
        throw new Error("BLAKE2xs output size must be at least 1 byte");
      }
      this._outputSize = size;
      this._digestLength = size;
      this.Reset();
    }

    get outputSize() {
      return this._outputSize;
    }

    /**
     * Initialize the hash state
     */
    Init() {
      this._nodeOffset = 0; // XOF blocks start at node_offset = 0
      this._rootHash = this.createRootHash(null, null, null);
      this._h0 = null;
      this._bufPos = 32;
      this._digestPos = 0;
      this._blockPos = 0;
    }

    /**
     * Reset the XOF state
     */
    Reset() {
      this.Init();
    }

    /**
     * Create root hash instance with BLAKE2xs root parameters
     */
    createRootHash(key, salt, personalization) {
      // Create BLAKE2s hasher for root hash with xof_length set
      // Root hash uses: fanout=1, depth=1, node_offset=0, xof_length=digestLength
      const hasher = new Blake2sHasher(key, BLAKE2XS_DIGEST_LENGTH, salt, personalization, 0, {
        fanout: 1,
        depth: 1,
        xofLength: this._digestLength
      });
      return hasher;
    }

    /**
     * Create internal hash for XOF expansion
     */
    createInternalHash(stepLength, nodeOffset) {
      // Create BLAKE2s hasher for internal XOF expansion
      // Uses XOF expansion parameters: fanout=0, depth=0, leaf_length=32, inner_length=32
      // AND inherits xof_length from the parent (this._digestLength)
      const hasher = new Blake2sHasher(null, stepLength, null, null, nodeOffset, {
        fanout: 0,
        depth: 0,
        leafLength: BLAKE2XS_DIGEST_LENGTH,
        innerHashLength: BLAKE2XS_DIGEST_LENGTH,
        nodeDepth: 0,
        xofLength: this._digestLength
      });
      return hasher;
    }

    /**
     * Add data to the hash calculation
     */
    Update(data) {
      if (!this._rootHash) this.Init();
      this._rootHash.update(data);
    }

    /**
     * Finalize the root hash if not already done
     */
    finalizeRootHash() {
      if (!this._h0) {
        this._h0 = new Uint8Array(32);
        const result = this._rootHash.finalize();
        for (let i = 0; i < 32; i++) {
          this._h0[i] = result[i];
        }
      }
    }

    /**
     * Compute the step length for the current position
     */
    computeStepLength() {
      if (this._digestLength === BLAKE2XS_UNKNOWN_DIGEST_LENGTH) {
        return BLAKE2XS_DIGEST_LENGTH;
      }
      return Math.min(BLAKE2XS_DIGEST_LENGTH, this._digestLength - this._digestPos);
    }

    /**
     * Output XOF bytes
     */
    doOutput(outputLength) {
      this.finalizeRootHash();

      // Check output length constraints
      if (this._digestLength !== BLAKE2XS_UNKNOWN_DIGEST_LENGTH) {
        if (this._digestPos + outputLength > this._digestLength) {
          throw new Error("Output length exceeds digest length");
        }
      } else if (this._blockPos >= BLAKE2XS_MAX_NUMBER_BLOCKS) {
        throw new Error("Maximum length is 2^32 blocks of 32 bytes");
      }

      const output = new Uint8Array(outputLength);

      for (let i = 0; i < outputLength; i++) {
        // Generate new block if buffer exhausted
        if (this._bufPos >= BLAKE2XS_DIGEST_LENGTH) {
          const stepLength = this.computeStepLength();
          const h = this.createInternalHash(stepLength, this._nodeOffset);

          // Hash the root digest h0
          h.update(this._h0);

          // Finalize to get next block
          const result = h.finalize();
          for (let j = 0; j < 32; j++) {
            this._buf[j] = result[j];
          }

          this._bufPos = 0;
          this._nodeOffset++;
          this._blockPos++;
        }

        output[i] = this._buf[this._bufPos];
        this._bufPos++;
        this._digestPos++;
      }

      return Array.from(output);
    }

    /**
     * Finalize the hash calculation and return result
     */
    Final() {
      if (!this._rootHash) this.Init();
      return this.doOutput(this._outputSize);
    }

    /**
     * Hash a complete message in one operation
     */
    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * Required interface methods for IAlgorithmInstance compatibility
     */
    KeySetup(key) {
      return true;
    }

    EncryptBlock(blockIndex, plaintext) {
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      throw new Error('BLAKE2xs is a one-way hash function - decryption not possible');
    }

    ClearData() {
      this._rootHash = null;
      this._h0 = null;
      OpCodes.ClearArray(this._buf);
    }

    /**
     * Feed method required by test suite
     */
    Feed(data) {
      if (!this._rootHash) this.Init();
      this.Update(data);
    }

    /**
     * Result method required by test suite
     */
    Result() {
      if (!this._rootHash) this.Init();
      // Create output without resetting state
      return this.doOutput(this._outputSize);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new BLAKE2xsAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BLAKE2xsAlgorithm, BLAKE2xsAlgorithmInstance };
}));
