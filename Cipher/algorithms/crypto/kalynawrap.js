/*
 * DSTU 7624 Kalyna Key Wrap Implementation
 * Based on RFC 3394-style key wrapping with Kalyna cipher
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Reference: DSTU7624WrapEngine.java from Bouncy Castle
 * Ukrainian standard DSTU 7624:2014 Key Wrapping
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes', '../../algorithms/block/kalyna'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes'),
      require('../../algorithms/block/kalyna')
    );
  } else {
    factory(root.AlgorithmFramework, root.OpCodes, root.Kalyna);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes, KalynaModule) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, IAlgorithmInstance, KeySize, LinkItem } = AlgorithmFramework;

  // Find Kalyna algorithm from registry
  const KalynaAlgorithm = AlgorithmFramework.Find('Kalyna');
  if (!KalynaAlgorithm) {
    throw new Error('Kalyna algorithm not found in registry');
  }

  /**
   * DSTU 7624 Kalyna Key Wrap Algorithm
   *
   * Wraps keys using the Kalyna block cipher following RFC 3394 structure
   * as specified in Ukrainian standard DSTU 7624:2014.
   *
   * The algorithm:
   * 1. Splits plaintext into half-blocks
   * 2. Performs V iterations (V = (n-1) * 6 where n = 2 * blocks)
   * 3. For each iteration:
   *    - Encrypt B || Btemp[0]
   *    - XOR result with iteration counter
   *    - Rotate the half-blocks
   * 4. Returns wrapped ciphertext with integrity check
   */
  class KalynaWrap extends Algorithm {
    constructor() {
      super();

      this.name = "Kalyna Key Wrap";
      this.description = "RFC 3394-style key wrapping using the Kalyna block cipher as specified in DSTU 7624:2014. Provides authenticated encryption for key material with integrity verification. Widely used in Ukrainian cryptographic systems.";
      this.inventor = "Ukrainian National Standard";
      this.year = 2014;
      this.category = CategoryType.SPECIAL;
      this.subCategory = "Key Wrapping";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.UA;

      this.SupportedBlockSizes = [128, 256, 512]; // Kalyna block sizes in bits
      this.SupportedKeySizes = [
        new KeySize(16, 32, 8),   // 128-bit Kalyna: 128/256-bit keys
        new KeySize(16, 64, 16)   // 256/512-bit Kalyna: variable key sizes
      ];

      this.documentation = [
        new LinkItem("DSTU 7624:2014 Standard", "https://www.dstu.gov.ua/"),
        new LinkItem("Bouncy Castle Implementation", "https://github.com/bcgit/bc-java/blob/master/core/src/main/java/org/bouncycastle/crypto/engines/DSTU7624WrapEngine.java")
      ];

      // Test vectors from Bouncy Castle DSTU7624Test.java
      this.tests = [
        {
          text: "DSTU 7624 KW Test 1 (128-bit block)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7624Test.java",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          blockSize: 128,
          input: OpCodes.Hex8ToBytes("101112131415161718191A1B1C1D1E1F"),
          expected: OpCodes.Hex8ToBytes("1DC91DC6E52575F6DBED25ADDA95A1B6AD3E15056E489738972C199FB9EE2913")
        },
        {
          text: "DSTU 7624 KW Test 2 (128-bit block, 48 bytes)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7624Test.java",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F"),
          blockSize: 128,
          input: OpCodes.Hex8ToBytes("101112131415161718191A1B1C1D1E1F20219000000000000000800000000000"),
          expected: OpCodes.Hex8ToBytes("0EA983D6CE48484D51462C32CC61672210FCC44196ABE635BAF878FDB83E1A63114128585D49DB355C5819FD38039169")
        },
        {
          text: "DSTU 7624 KW Test 3 (128-bit block, 256-bit key)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7624Test.java",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          blockSize: 128,
          input: OpCodes.Hex8ToBytes("202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F"),
          expected: OpCodes.Hex8ToBytes("2D09A7C18E6A5A0816331EC27CEA596903F77EC8D63F3BDB73299DE7FD9F4558E05992B0B24B39E02EA496368E0841CC1E3FA44556A3048C5A6E9E335717D17D")
        },
        {
          text: "DSTU 7624 KW Round-trip test (256-bit block)",
          uri: "https://github.com/bcgit/bc-java/blob/master/core/src/test/java/org/bouncycastle/crypto/test/DSTU7624Test.java",
          key: OpCodes.Hex8ToBytes("000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"),
          blockSize: 256,
          input: OpCodes.Hex8ToBytes("202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new KalynaWrapInstance(this, isInverse);
    }
  }

  /**
   * Kalyna Key Wrap Instance
   * Implements the Feed/Result pattern for key wrapping/unwrapping
   */
  class KalynaWrapInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this._blockSize = 128; // Default to 128-bit blocks
      this.kalynaInstance = null;
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.kalynaInstance = null;
        return;
      }

      // Validate key size
      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];

      // Create Kalyna instance for the current block size
      this.kalynaInstance = KalynaAlgorithm.CreateInstance(false);
      this.kalynaInstance.blockSize = this._blockSize;
      this.kalynaInstance.key = this._key;
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    set blockSize(bits) {
      if (![128, 256, 512].includes(bits)) {
        throw new Error(`Invalid block size: ${bits} bits. Must be 128, 256, or 512`);
      }
      this._blockSize = bits;

      // Recreate Kalyna instance if key is already set
      if (this._key) {
        this.kalynaInstance = KalynaAlgorithm.CreateInstance(false);
        this.kalynaInstance.blockSize = this._blockSize;
        this.kalynaInstance.key = this._key;
      }
    }

    get blockSize() {
      return this._blockSize;
    }

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) {
        throw new Error("Key not set");
      }
      this.inputBuffer.push(...data);
    }

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const blockBytes = this._blockSize / 8;

      // Validate input length
      if (this.inputBuffer.length % blockBytes !== 0) {
        throw new Error(`Input must be a multiple of ${blockBytes} bytes (${this._blockSize}-bit blocks)`);
      }

      let result;
      if (this.isInverse) {
        result = this._unwrap(this.inputBuffer, blockBytes);
      } else {
        result = this._wrap(this.inputBuffer, blockBytes);
      }

      this.inputBuffer = []; // Clear for next operation
      return result;
    }

    /**
     * Wrap operation following DSTU 7624 specification
     * @param {Array<number>} plaintext - Input bytes to wrap
     * @param {number} blockBytes - Block size in bytes
     * @returns {Array<number>} Wrapped ciphertext
     */
    _wrap(plaintext, blockBytes) {
      const halfBlock = blockBytes / 2;

      // Calculate n and V according to DSTU 7624
      const n = 2 * (1 + plaintext.length / blockBytes);
      const V = (n - 1) * 6;

      // Initialize wrapped buffer
      const wrappedBuffer = new Array(plaintext.length + blockBytes);
      for (let i = 0; i < plaintext.length; ++i) {
        wrappedBuffer[i] = plaintext[i];
      }
      for (let i = plaintext.length; i < wrappedBuffer.length; ++i) {
        wrappedBuffer[i] = 0; // Zero padding for checksum
      }

      // Initialize B (first half-block)
      const B = new Array(halfBlock);
      for (let i = 0; i < halfBlock; ++i) {
        B[i] = wrappedBuffer[i];
      }

      // Initialize Btemp array of half-blocks
      const Btemp = [];
      for (let pos = halfBlock; pos < wrappedBuffer.length; pos += halfBlock) {
        const temp = new Array(halfBlock);
        for (let i = 0; i < halfBlock; ++i) {
          temp[i] = wrappedBuffer[pos + i];
        }
        Btemp.push(temp);
      }

      // Working buffer for encryption
      const encBuffer = new Array(blockBytes);
      const intArray = new Array(4);

      // Main wrapping loop
      for (let j = 0; j < V; ++j) {
        // Prepare input: B || Btemp[0]
        for (let i = 0; i < halfBlock; ++i) {
          encBuffer[i] = B[i];
          encBuffer[halfBlock + i] = Btemp[0][i];
        }

        // Encrypt using Kalyna
        this.kalynaInstance.Feed(encBuffer);
        const encrypted = this.kalynaInstance.Result();
        for (let i = 0; i < blockBytes; ++i) {
          encBuffer[i] = encrypted[i];
        }

        // Convert iteration number to bytes (big-endian)
        this._intToBytes(j + 1, intArray);

        // XOR second half with iteration counter
        for (let byteNum = 0; byteNum < 4; ++byteNum) {
          encBuffer[halfBlock + byteNum] ^= intArray[byteNum];
        }

        // Update B with second half
        for (let i = 0; i < halfBlock; ++i) {
          B[i] = encBuffer[halfBlock + i];
        }

        // Rotate Btemp array
        for (let i = 2; i < n; ++i) {
          for (let k = 0; k < halfBlock; ++k) {
            Btemp[i - 2][k] = Btemp[i - 1][k];
          }
        }

        // Place first half at end
        for (let i = 0; i < halfBlock; ++i) {
          Btemp[n - 2][i] = encBuffer[i];
        }
      }

      // Construct final output
      const output = new Array(wrappedBuffer.length);
      for (let i = 0; i < halfBlock; ++i) {
        output[i] = B[i];
      }

      let bufOff = halfBlock;
      for (let i = 0; i < n - 1; ++i) {
        for (let k = 0; k < halfBlock; ++k) {
          output[bufOff++] = Btemp[i][k];
        }
      }

      return output;
    }

    /**
     * Unwrap operation following DSTU 7624 specification
     * @param {Array<number>} ciphertext - Wrapped bytes to unwrap
     * @param {number} blockBytes - Block size in bytes
     * @returns {Array<number>} Unwrapped plaintext
     */
    _unwrap(ciphertext, blockBytes) {
      const halfBlock = blockBytes / 2;

      // Calculate n and V
      const n = 2 * ciphertext.length / blockBytes;
      const V = (n - 1) * 6;

      // Initialize buffer
      const buffer = [...ciphertext];

      // Initialize B (first half-block)
      const B = new Array(halfBlock);
      for (let i = 0; i < halfBlock; ++i) {
        B[i] = buffer[i];
      }

      // Initialize Btemp array
      const Btemp = [];
      for (let pos = halfBlock; pos < buffer.length; pos += halfBlock) {
        const temp = new Array(halfBlock);
        for (let i = 0; i < halfBlock; ++i) {
          temp[i] = buffer[pos + i];
        }
        Btemp.push(temp);
      }

      // Working buffer
      const decBuffer = new Array(blockBytes);
      const intArray = new Array(4);

      // Main unwrapping loop (reverse order)
      for (let j = 0; j < V; ++j) {
        // Prepare input: Btemp[n-2] || B
        for (let i = 0; i < halfBlock; ++i) {
          decBuffer[i] = Btemp[n - 2][i];
          decBuffer[halfBlock + i] = B[i];
        }

        // Convert iteration number to bytes
        this._intToBytes(V - j, intArray);

        // XOR second half with iteration counter
        for (let byteNum = 0; byteNum < 4; ++byteNum) {
          decBuffer[halfBlock + byteNum] ^= intArray[byteNum];
        }

        // Decrypt using Kalyna
        const kalynaDecrypt = KalynaAlgorithm.CreateInstance(true);
        kalynaDecrypt.blockSize = this._blockSize;
        kalynaDecrypt.key = this._key;
        kalynaDecrypt.Feed(decBuffer);
        const decrypted = kalynaDecrypt.Result();
        for (let i = 0; i < blockBytes; ++i) {
          decBuffer[i] = decrypted[i];
        }

        // Update B with first half
        for (let i = 0; i < halfBlock; ++i) {
          B[i] = decBuffer[i];
        }

        // Rotate Btemp array (backward)
        for (let i = 2; i < n; ++i) {
          for (let k = 0; k < halfBlock; ++k) {
            Btemp[n - i][k] = Btemp[n - i - 1][k];
          }
        }

        // Place second half at beginning
        for (let i = 0; i < halfBlock; ++i) {
          Btemp[0][i] = decBuffer[halfBlock + i];
        }
      }

      // Reconstruct buffer
      for (let i = 0; i < halfBlock; ++i) {
        buffer[i] = B[i];
      }

      let bufOff = halfBlock;
      for (let i = 0; i < n - 1; ++i) {
        for (let k = 0; k < halfBlock; ++k) {
          buffer[bufOff++] = Btemp[i][k];
        }
      }

      // Verify checksum (last block should be zeros)
      const checksumStart = buffer.length - blockBytes;
      for (let i = checksumStart; i < buffer.length; ++i) {
        if (buffer[i] !== 0) {
          throw new Error("Checksum verification failed - invalid wrapped data");
        }
      }

      // Return unwrapped data (without checksum block)
      return buffer.slice(0, checksumStart);
    }

    /**
     * Convert integer to 4 bytes (big-endian)
     * @param {number} num - Integer to convert
     * @param {Array<number>} bytes - Output byte array
     */
    _intToBytes(num, bytes) {
      // Use OpCodes to unpack 32-bit integer into bytes (big-endian)
      // Ensure positive integer by using modulo for large numbers
      if (num < 0) num = 0x100000000 + num;
      const unpacked = OpCodes.Unpack32BE(num);
      bytes[0] = unpacked[3]; // Least significant byte
      bytes[1] = unpacked[2];
      bytes[2] = unpacked[1];
      bytes[3] = unpacked[0]; // Most significant byte
    }
  }

  // Register algorithm
  RegisterAlgorithm(new KalynaWrap());

  return KalynaWrap;
}));
