
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
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== MD4 CONSTANTS =====

  // MD4 initial hash values (RFC 1320 Section 3.3)
  const MD4_H = Object.freeze([0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476]);

  // MD4 round constants (RFC 1320)
  const MD4_K2 = 0x5A827999; // Round 2 constant: sqrt(2)
  const MD4_K3 = 0x6ED9EBA1; // Round 3 constant: sqrt(3)

  // ===== MD4 AUXILIARY FUNCTIONS =====

  // Round 1: F(X,Y,Z) = (X AND Y) OR ((NOT X) AND Z)
  // Optimized form: Z XOR (X AND (Y XOR Z))
  function MD4_F(x, y, z) {
    return (z ^ (x & (y ^ z))) >>> 0;
  }

  // Round 2: G(X,Y,Z) = (X AND Y) OR (X AND Z) OR (Y AND Z)
  // Majority function
  function MD4_G(x, y, z) {
    return ((x & y) | (x & z) | (y & z)) >>> 0;
  }

  // Round 3: H(X,Y,Z) = X XOR Y XOR Z
  function MD4_AUX_H(x, y, z) {
    return (x ^ y ^ z) >>> 0;
  }

  // ===== MD4 PADDING FUNCTION =====

  /**
   * Pads message according to MD4 specification (RFC 1320 Section 3.1)
   * Merkle-Damgård construction with little-endian length encoding
   * @param {Array} msgBytes - Message to pad as byte array
   * @returns {Array} Padded message
   */
  function padMessageMD4(msgBytes) {
    const msgLength = msgBytes.length;
    const bitLength = msgLength * 8;

    // Create copy for padding
    const padded = msgBytes.slice();

    // Append the '1' bit (0x80 = 10000000 in binary)
    padded.push(0x80);

    // Append 0 bits until message length ≡ 448 (mod 512)
    // This means 56 bytes mod 64 bytes
    while ((padded.length % 64) !== 56) {
      padded.push(0x00);
    }

    // Append original length in bits as 64-bit little-endian integer
    const bitLengthLow = bitLength & 0xFFFFFFFF;
    const bitLengthHigh = Math.floor(bitLength / 0x100000000);

    const lengthBytes = OpCodes.Unpack32LE(bitLengthLow).concat(OpCodes.Unpack32LE(bitLengthHigh));
    padded.push(...lengthBytes);

    return padded;
  }

  // ===== MD4 ALGORITHM CLASS =====

  class MD4Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MD4";
      this.description = "MD4 is a 128-bit cryptographic hash function designed by Ronald Rivest in 1990. It is cryptographically broken with practical collision attacks and should only be used for educational purposes or legacy compatibility.";
      this.inventor = "Ronald Rivest";
      this.year = 1990;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Hash-specific metadata
      this.SupportedOutputSizes = [16]; // 128 bits = 16 bytes

      // Performance and technical specifications
      this.blockSize = 64; // 512 bits = 64 bytes
      this.outputSize = 16; // 128 bits = 16 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 1320 - The MD4 Message-Digest Algorithm", "https://tools.ietf.org/html/rfc1320"),
        new LinkItem("Wikipedia - MD4", "https://en.wikipedia.org/wiki/MD4")
      ];

      this.references = [
        new LinkItem("Crypto++ MD4 Implementation", "https://github.com/weidai11/cryptopp/blob/master/md4.cpp"),
        new LinkItem("OpenSSL MD4 Implementation", "https://github.com/openssl/openssl/blob/master/crypto/md4/md4_dgst.c"),
        new LinkItem("Botan MD4 Implementation", "https://github.com/randombit/botan/blob/master/src/lib/hash/md4/md4.cpp")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Collision Attack",
          "Practical collision attacks demonstrated. Collisions can be found in less than a second on modern hardware.",
          "https://link.springer.com/chapter/10.1007/978-3-540-28628-8_1"
        ),
        new Vulnerability(
          "Preimage Attack",
          "Theoretical preimage attacks exist with reduced complexity compared to brute force.",
          ""
        )
      ];

      // Test vectors from RFC 1320 and Botan test suite
      this.tests = [
        {
          text: "RFC 1320 Test Vector #1 - Empty string",
          uri: "https://tools.ietf.org/html/rfc1320",
          input: [],
          expected: OpCodes.Hex8ToBytes("31d6cfe0d16ae931b73c59d7e0c089c0")
        },
        {
          text: "RFC 1320 Test Vector #2 - 'a'",
          uri: "https://tools.ietf.org/html/rfc1320",
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("bde52cb31de33e46245e05fbdbd6fb24")
        },
        {
          text: "RFC 1320 Test Vector #3 - 'abc'",
          uri: "https://tools.ietf.org/html/rfc1320",
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("a448017aaf21d8525fc10ae87aa6729d")
        },
        {
          text: "RFC 1320 Test Vector #4 - 'message digest'",
          uri: "https://tools.ietf.org/html/rfc1320",
          input: OpCodes.AnsiToBytes("message digest"),
          expected: OpCodes.Hex8ToBytes("d9130a8164549fe818874806e1c7014b")
        },
        {
          text: "RFC 1320 Test Vector #5 - alphabet",
          uri: "https://tools.ietf.org/html/rfc1320",
          input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
          expected: OpCodes.Hex8ToBytes("d79e1c308aa5bbcdeea8ed63df412da9")
        },
        {
          text: "RFC 1320 Test Vector #6 - alphanumeric",
          uri: "https://tools.ietf.org/html/rfc1320",
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
          expected: OpCodes.Hex8ToBytes("043f8582f241db351ce627e153e7f0e4")
        },
        {
          text: "RFC 1320 Test Vector #7 - numeric sequence",
          uri: "https://tools.ietf.org/html/rfc1320",
          input: OpCodes.AnsiToBytes("12345678901234567890123456789012345678901234567890123456789012345678901234567890"),
          expected: OpCodes.Hex8ToBytes("e33b4ddc9c38f2199c3e7b164fcc0536")
        },
        {
          text: "Nettle Test Suite - '38'",
          uri: "https://git.lysator.liu.se/nettle/nettle/-/blob/master/testsuite/md4-test.c",
          input: OpCodes.AnsiToBytes("38"),
          expected: OpCodes.Hex8ToBytes("ae9c7ebfb68ea795483d270f5934b71d")
        },
        {
          text: "Botan Test Vector - Single byte 0x44",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/md4.vec",
          input: OpCodes.Hex8ToBytes("44"),
          expected: OpCodes.Hex8ToBytes("aae7b2d482382aaad75fde64df8ff86f")
        },
        {
          text: "Botan Test Vector - Two bytes",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/md4.vec",
          input: OpCodes.Hex8ToBytes("0246"),
          expected: OpCodes.Hex8ToBytes("cb386d6a1189cd159f4458a1cef7b28e")
        },
        {
          text: "Botan Test Vector - Multi-block message (64+ bytes)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/md4.vec",
          input: OpCodes.Hex8ToBytes("CA547E696B455522A16EF1191F8C39196BBBF6EABA00693B69698DC1344416F6F3BA1DF367B7EAE71D48165678F7C78B0096D6DD5EE2E7EB618E85758392EB7F"),
          expected: OpCodes.Hex8ToBytes("8391004470075bf3cd8858c492e7184f")
        },
        {
          text: "Botan Collision Test - First collision message",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/md4.vec",
          input: OpCodes.Hex8ToBytes("839c7a4d7a92cb5678a5d5b9eea5a7573c8a74deb366c3dc20a083b69f5d2a3bb3719dc69891e9f95e809fd7e8b23ba6318edd45e51fe39708bf9427e9c3e8b9"),
          expected: OpCodes.Hex8ToBytes("4d7e6a1defa93d2dde05b45d864c429b")
        },
        {
          text: "Botan Collision Test - Second collision message (same hash as first)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/md4.vec",
          input: OpCodes.Hex8ToBytes("839c7a4d7a92cbd678a5d529eea5a7573c8a74deb366c3dc20a083b69f5d2a3bb3719dc69891e9f95e809fd7e8b23ba6318edc45e51fe39708bf9427e9c3e8b9"),
          expected: OpCodes.Hex8ToBytes("4d7e6a1defa93d2dde05b45d864c429b")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // Hash functions have no inverse
      }
      return new MD4AlgorithmInstance(this);
    }
  }

  // ===== MD4 INSTANCE CLASS =====

  class MD4AlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 16; // 128 bits = 16 bytes

      // MD4 state
      this._buffer = [];
      this._length = 0;
    }

    Init() {
      this._buffer = [];
      this._length = 0;
    }

    Update(data) {
      if (!data || data.length === 0) return;

      // Convert string to byte array if needed
      if (typeof data === 'string') {
        data = OpCodes.AnsiToBytes(data);
      }

      this._buffer = this._buffer.concat(Array.from(data));
      this._length += data.length;
    }

    Final() {
      return this._computeMD4(this._buffer);
    }

    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    /**
     * MD4 hash computation following RFC 1320
     * @param {Array} data - Input data as byte array
     * @returns {Array} 16-byte MD4 hash
     */
    _computeMD4(data) {
      // Step 1: Append padding bits
      const paddedMsg = padMessageMD4(data);

      // Step 2: Initialize MD4 buffer with initial values
      let h = [...MD4_H];

      // Step 3: Process message in 512-bit (64-byte) chunks
      for (let chunkStart = 0; chunkStart < paddedMsg.length; chunkStart += 64) {
        const chunk = paddedMsg.slice(chunkStart, chunkStart + 64);

        // Break chunk into sixteen 32-bit little-endian words
        const X = new Array(16);
        for (let i = 0; i < 16; i++) {
          const offset = i * 4;
          X[i] = OpCodes.Pack32LE(chunk[offset], chunk[offset + 1], chunk[offset + 2], chunk[offset + 3]);
        }

        // Initialize working variables to current hash value
        let A = h[0];
        let B = h[1];
        let C = h[2];
        let D = h[3];

        // ===== ROUND 1 ===== (RFC 1320 Section 3.4)
        // [A B C D X[i] S]: A = (A + F(B,C,D) + X[i]) <<< S
        // Process in order: 0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15

        // Round 1, operations 1-4
        A = OpCodes.RotL32((A + MD4_F(B, C, D) + X[0]) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_F(A, B, C) + X[1]) >>> 0, 7);
        C = OpCodes.RotL32((C + MD4_F(D, A, B) + X[2]) >>> 0, 11);
        B = OpCodes.RotL32((B + MD4_F(C, D, A) + X[3]) >>> 0, 19);

        // Round 1, operations 5-8
        A = OpCodes.RotL32((A + MD4_F(B, C, D) + X[4]) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_F(A, B, C) + X[5]) >>> 0, 7);
        C = OpCodes.RotL32((C + MD4_F(D, A, B) + X[6]) >>> 0, 11);
        B = OpCodes.RotL32((B + MD4_F(C, D, A) + X[7]) >>> 0, 19);

        // Round 1, operations 9-12
        A = OpCodes.RotL32((A + MD4_F(B, C, D) + X[8]) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_F(A, B, C) + X[9]) >>> 0, 7);
        C = OpCodes.RotL32((C + MD4_F(D, A, B) + X[10]) >>> 0, 11);
        B = OpCodes.RotL32((B + MD4_F(C, D, A) + X[11]) >>> 0, 19);

        // Round 1, operations 13-16
        A = OpCodes.RotL32((A + MD4_F(B, C, D) + X[12]) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_F(A, B, C) + X[13]) >>> 0, 7);
        C = OpCodes.RotL32((C + MD4_F(D, A, B) + X[14]) >>> 0, 11);
        B = OpCodes.RotL32((B + MD4_F(C, D, A) + X[15]) >>> 0, 19);

        // ===== ROUND 2 ===== (RFC 1320 Section 3.4)
        // [A B C D X[i] S]: A = (A + G(B,C,D) + X[i] + 0x5A827999) <<< S
        // Process in order: 0,4,8,12,1,5,9,13,2,6,10,14,3,7,11,15

        // Round 2, operations 1-4
        A = OpCodes.RotL32((A + MD4_G(B, C, D) + X[0] + MD4_K2) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_G(A, B, C) + X[4] + MD4_K2) >>> 0, 5);
        C = OpCodes.RotL32((C + MD4_G(D, A, B) + X[8] + MD4_K2) >>> 0, 9);
        B = OpCodes.RotL32((B + MD4_G(C, D, A) + X[12] + MD4_K2) >>> 0, 13);

        // Round 2, operations 5-8
        A = OpCodes.RotL32((A + MD4_G(B, C, D) + X[1] + MD4_K2) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_G(A, B, C) + X[5] + MD4_K2) >>> 0, 5);
        C = OpCodes.RotL32((C + MD4_G(D, A, B) + X[9] + MD4_K2) >>> 0, 9);
        B = OpCodes.RotL32((B + MD4_G(C, D, A) + X[13] + MD4_K2) >>> 0, 13);

        // Round 2, operations 9-12
        A = OpCodes.RotL32((A + MD4_G(B, C, D) + X[2] + MD4_K2) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_G(A, B, C) + X[6] + MD4_K2) >>> 0, 5);
        C = OpCodes.RotL32((C + MD4_G(D, A, B) + X[10] + MD4_K2) >>> 0, 9);
        B = OpCodes.RotL32((B + MD4_G(C, D, A) + X[14] + MD4_K2) >>> 0, 13);

        // Round 2, operations 13-16
        A = OpCodes.RotL32((A + MD4_G(B, C, D) + X[3] + MD4_K2) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_G(A, B, C) + X[7] + MD4_K2) >>> 0, 5);
        C = OpCodes.RotL32((C + MD4_G(D, A, B) + X[11] + MD4_K2) >>> 0, 9);
        B = OpCodes.RotL32((B + MD4_G(C, D, A) + X[15] + MD4_K2) >>> 0, 13);

        // ===== ROUND 3 ===== (RFC 1320 Section 3.4)
        // [A B C D X[i] S]: A = (A + H(B,C,D) + X[i] + 0x6ED9EBA1) <<< S
        // Process in order: 0,8,4,12,2,10,6,14,1,9,5,13,3,11,7,15

        // Round 3, operations 1-4
        A = OpCodes.RotL32((A + MD4_AUX_H(B, C, D) + X[0] + MD4_K3) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_AUX_H(A, B, C) + X[8] + MD4_K3) >>> 0, 9);
        C = OpCodes.RotL32((C + MD4_AUX_H(D, A, B) + X[4] + MD4_K3) >>> 0, 11);
        B = OpCodes.RotL32((B + MD4_AUX_H(C, D, A) + X[12] + MD4_K3) >>> 0, 15);

        // Round 3, operations 5-8
        A = OpCodes.RotL32((A + MD4_AUX_H(B, C, D) + X[2] + MD4_K3) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_AUX_H(A, B, C) + X[10] + MD4_K3) >>> 0, 9);
        C = OpCodes.RotL32((C + MD4_AUX_H(D, A, B) + X[6] + MD4_K3) >>> 0, 11);
        B = OpCodes.RotL32((B + MD4_AUX_H(C, D, A) + X[14] + MD4_K3) >>> 0, 15);

        // Round 3, operations 9-12
        A = OpCodes.RotL32((A + MD4_AUX_H(B, C, D) + X[1] + MD4_K3) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_AUX_H(A, B, C) + X[9] + MD4_K3) >>> 0, 9);
        C = OpCodes.RotL32((C + MD4_AUX_H(D, A, B) + X[5] + MD4_K3) >>> 0, 11);
        B = OpCodes.RotL32((B + MD4_AUX_H(C, D, A) + X[13] + MD4_K3) >>> 0, 15);

        // Round 3, operations 13-16
        A = OpCodes.RotL32((A + MD4_AUX_H(B, C, D) + X[3] + MD4_K3) >>> 0, 3);
        D = OpCodes.RotL32((D + MD4_AUX_H(A, B, C) + X[11] + MD4_K3) >>> 0, 9);
        C = OpCodes.RotL32((C + MD4_AUX_H(D, A, B) + X[7] + MD4_K3) >>> 0, 11);
        B = OpCodes.RotL32((B + MD4_AUX_H(C, D, A) + X[15] + MD4_K3) >>> 0, 15);

        // Add this chunk's hash to result so far
        h[0] = (h[0] + A) >>> 0;
        h[1] = (h[1] + B) >>> 0;
        h[2] = (h[2] + C) >>> 0;
        h[3] = (h[3] + D) >>> 0;
      }

      // Step 4: Output - Convert hash values to byte array (little-endian)
      const result = [];
      h.forEach(word => {
        const bytes = OpCodes.Unpack32LE(word);
        result.push(...bytes);
      });

      return result;
    }

    KeySetup(key) {
      // Hash functions don't use keys
      return true;
    }

    EncryptBlock(blockIndex, plaintext) {
      // Return hash of the plaintext
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      // Hash functions are one-way
      throw new Error('MD4 is a one-way hash function - decryption not possible');
    }

    ClearData() {
      if (this._buffer) OpCodes.ClearArray(this._buffer);
      this._length = 0;
    }

    Feed(data) {
      this.Init();
      this.Update(data);
    }

    Result() {
      return this.Final();
    }
  }

  // ===== REGISTRATION =====

  const md4Instance = new MD4Algorithm();
  if (!AlgorithmFramework.Find(md4Instance.name)) {
    RegisterAlgorithm(md4Instance);
  }

  // ===== EXPORTS =====

  return {
    MD4Algorithm,
    MD4AlgorithmInstance
  };
}));
