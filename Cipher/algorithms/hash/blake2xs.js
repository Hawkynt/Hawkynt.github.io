

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
          expected: OpCodes.Hex8ToBytes("57aa5c761e7cfa573c48785109ad76445441de0ee0f9fe9dd4abb920b7cb5f608fc9a029f85ec478a130f194372b6112f5f2d10408e0d23f696cc9e313b7f1d3")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 128 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 128,
          expected: OpCodes.Hex8ToBytes("4d1f33edc0d969128edb16e0756c5b1ef45caa7c23a2f3724dab70c8d068cfbfc4ee15ca2fa799b1eb286c2298036faec73d3cac41b950083e17ef20ddff9d55aa8b4d0365c6dd38d5ddea19ebfa2cb009dd5961320c547af20f96044f7a82a0919126466bad6f88f49b0342fd40f5c7b85206e77d26256c8b7ff4fedf36119b")
        },
        {
          text: "BLAKE2xs XOF - 256 byte input, 256 byte output",
          uri: "https://github.com/BLAKE2/BLAKE2/blob/master/testvectors/blake2-kat.json",
          input: input256,
          outputSize: 256,
          expected: OpCodes.Hex8ToBytes("d4a23a17b657fa3ddc2df61eefce362f048b9dd156809062997ab9d5b1fb26b8542b1a638f517fcbad72a6fb23de0754db7bb488b75c12ac826dcced9806d7873e6b31922097ef7b42506275ccc54caf86918f9d1c6cdb9bad2bacf123c0380b2e5dc3e98de83a159ee9e10a8444832c371e5b72039b31c38621261aa04d8271598b17dba0d28c20d1858d879038485ab069bdb58733b5495f934889658ae81b7536bcf601cfcc572060863c1ff2202d2ea84c800482dbe777335002204b7c1f70133e4d8a6b7516c66bb433ad31030a7a9a9a6b9ea69890aa40662d908a5acfe8328802595f0284c51a000ce274a985823de9ee74250063a879a3787fca23a6")
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
