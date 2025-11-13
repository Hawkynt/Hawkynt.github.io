
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
          HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  // MD5 auxiliary functions (RFC 1321 Section 3.4)
  // F(X,Y,Z) = XY v not(X) Z
  // G(X,Y,Z) = XZ v Y not(Z)
  // H(X,Y,Z) = X xor Y xor Z
  // I(X,Y,Z) = Y xor (X v not(Z))

  function F(x, y, z) {
    return ((x & y) | (~x & z)) >>> 0;
  }

  function G(x, y, z) {
    return ((x & z) | (y & ~z)) >>> 0;
  }

  function H(x, y, z) {
    return (x ^ y ^ z) >>> 0;
  }

  function I(x, y, z) {
    return (y ^ (x | ~z)) >>> 0;
  }

  // MD5 T-table constants (RFC 1321 Section 3.4)
  // These are derived from the sine function: floor(abs(sin(i + 1)) * 2^32)
  const T = Object.freeze([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ]);

  // Shift amounts for each round (RFC 1321 Section 3.4)
  const S = Object.freeze([
    7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
    5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
    4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
    6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
  ]);

  class MD5Algorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "MD5";
      this.description = "Message-Digest Algorithm 5 producing 128-bit digest. CRYPTOGRAPHICALLY BROKEN - practical collision attacks trivially achievable since 2004. DO NOT USE for security purposes. Educational implementation only.";
      this.inventor = "Ronald Rivest";
      this.year = 1991;
      this.category = CategoryType.HASH;
      this.subCategory = "Cryptographic Hash";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Hash-specific metadata
      this.SupportedOutputSizes = [
        { size: 16, description: "128-bit MD5 hash" }
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 1321: The MD5 Message-Digest Algorithm", "https://tools.ietf.org/html/rfc1321"),
        new LinkItem("IETF MD5 Specification", "https://datatracker.ietf.org/doc/html/rfc1321"),
        new LinkItem("MD5 Collision Example", "https://www.mscs.dal.ca/~selinger/md5collision/")
      ];

      this.references = [
        new LinkItem("Crypto++ MD5 Implementation", "https://github.com/weidai11/cryptopp/blob/master/md5.cpp"),
        new LinkItem("OpenSSL MD5 Implementation", "https://github.com/openssl/openssl/blob/master/crypto/md5/md5_dgst.c"),
        new LinkItem("RFC 1321 Reference", "https://tools.ietf.org/html/rfc1321")
      ];

      // Known vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Collision Attack",
          "Practical collision attacks demonstrated since 2004. Two different messages can easily produce the same MD5 hash. Chosen-prefix collisions are also practical.",
          "Use SHA-256, SHA-3, or BLAKE2 instead. Never use MD5 for digital signatures, password hashing, certificates, or any security-critical application."
        )
      ];

      // Test vectors from RFC 1321 and Botan test suite
      this.tests = [
        {
          text: "RFC 1321: Empty string",
          uri: "https://tools.ietf.org/html/rfc1321",
          input: [],
          expected: OpCodes.Hex8ToBytes("d41d8cd98f00b204e9800998ecf8427e")
        },
        {
          text: "RFC 1321: Single character 'a'",
          uri: "https://tools.ietf.org/html/rfc1321",
          input: OpCodes.AnsiToBytes("a"),
          expected: OpCodes.Hex8ToBytes("0cc175b9c0f1b6a831c399e269772661")
        },
        {
          text: "RFC 1321: String 'abc'",
          uri: "https://tools.ietf.org/html/rfc1321",
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("900150983cd24fb0d6963f7d28e17f72")
        },
        {
          text: "RFC 1321: String 'message digest'",
          uri: "https://tools.ietf.org/html/rfc1321",
          input: OpCodes.AnsiToBytes("message digest"),
          expected: OpCodes.Hex8ToBytes("f96b697d7cb7938d525a2f31aaf161d0")
        },
        {
          text: "RFC 1321: Lowercase alphabet",
          uri: "https://tools.ietf.org/html/rfc1321",
          input: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
          expected: OpCodes.Hex8ToBytes("c3fcd3d76192e4007dfb496cca67e13b")
        },
        {
          text: "RFC 1321: Alphanumeric",
          uri: "https://tools.ietf.org/html/rfc1321",
          input: OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
          expected: OpCodes.Hex8ToBytes("d174ab98d277d9f5a5611c2c9f419d9f")
        },
        {
          text: "RFC 1321: Numeric string",
          uri: "https://tools.ietf.org/html/rfc1321",
          input: OpCodes.AnsiToBytes("12345678901234567890123456789012345678901234567890123456789012345678901234567890"),
          expected: OpCodes.Hex8ToBytes("57edf4a22be3c955ac49da2e2107b67a")
        },
        {
          text: "Botan: Single byte 0x7F",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/md5.vec",
          input: OpCodes.Hex8ToBytes("7F"),
          expected: OpCodes.Hex8ToBytes("83acb6e67e50e31db6ed341dd2de1595")
        },
        {
          text: "Botan: Two bytes 0xEC9C",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/md5.vec",
          input: OpCodes.Hex8ToBytes("EC9C"),
          expected: OpCodes.Hex8ToBytes("0b07f0d4ca797d8ac58874f887cb0b68")
        },
        {
          text: "Botan: 55-byte boundary test",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/md5.vec",
          input: OpCodes.Hex8ToBytes("BD68233EAC90E380907F13A3DB7A4A"),
          expected: OpCodes.Hex8ToBytes("529961e476f563084d25e0f981caf73d")
        },
        {
          text: "Botan: 64-byte block boundary test",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/md5.vec",
          input: OpCodes.Hex8ToBytes("8DF425048D0BC1CA3544975250B956CA"),
          expected: OpCodes.Hex8ToBytes("5127aef56b982e136a90bb0617ab89da")
        },
        {
          text: "Botan: Known collision pair #1",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/md5.vec",
          input: OpCodes.Hex8ToBytes("d131dd02c5e6eec4693d9a0698aff95c2fcab58712467eab4004583eb8fb7f8955ad340609f4b30283e488832571415a085125e8f7cdc99fd91dbdf280373c5bd8823e3156348f5bae6dacd436c919c6dd53e2b487da03fd02396306d248cda0e99f33420f577ee8ce54b67080a80d1ec69821bcb6a8839396f9652b6ff72a70"),
          expected: OpCodes.Hex8ToBytes("79054025255fb1a26e4bc422aef54eb4")
        },
        {
          text: "Botan: Known collision pair #2",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/hash/md5.vec",
          input: OpCodes.Hex8ToBytes("d131dd02c5e6eec4693d9a0698aff95c2fcab50712467eab4004583eb8fb7f8955ad340609f4b30283e4888325f1415a085125e8f7cdc99fd91dbd7280373c5bd8823e3156348f5bae6dacd436c919c6dd53e23487da03fd02396306d248cda0e99f33420f577ee8ce54b67080280d1ec69821bcb6a8839396f965ab6ff72a70"),
          expected: OpCodes.Hex8ToBytes("79054025255fb1a26e4bc422aef54eb4")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      // Hash functions have no inverse
      if (isInverse) return null;
      return new MD5Instance(this);
    }
  }

  class MD5Instance extends IHashFunctionInstance {
    constructor(algorithm) {
      super(algorithm);
      this.OutputSize = 16; // 128 bits

      // MD5 state variables
      this._h = null;
      this._buffer = null;
      this._length = 0;
      this._bufferLength = 0;

      this.Init();
    }

    /**
     * Initialize the hash state with standard MD5 initial values
     * RFC 1321 Section 3.3
     */
    Init() {
      // Initial hash values (RFC 1321 Section 3.3)
      // These are the little-endian representations of:
      // A = 0x67452301, B = 0xEFCDAB89, C = 0x98BADCFE, D = 0x10325476
      this._h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476];
      this._buffer = new Array(64);
      this._length = 0;
      this._bufferLength = 0;
    }

    _Reset() {
      this.Init();
    }

    /**
     * Add data to the hash calculation
     * @param {Array} data - Data to hash as byte array
     */
    Update(data) {
      if (!data || data.length === 0) return;

      // Convert string to byte array if needed
      if (typeof data === 'string') {
        const bytes = [];
        for (let i = 0; i < data.length; ++i) {
          bytes.push(data.charCodeAt(i) & 0xFF);
        }
        data = bytes;
      }

      for (let i = 0; i < data.length; ++i) {
        this._buffer[this._bufferLength++] = data[i];

        if (this._bufferLength === 64) {
          this._processBlock(this._buffer);
          this._bufferLength = 0;
        }
      }

      this._length += data.length;
    }

    /**
     * Finalize the hash calculation and return result as byte array
     * @returns {Array} Hash digest as byte array
     */
    Final() {
      // Add padding bit (RFC 1321 Section 3.1)
      this._buffer[this._bufferLength++] = 0x80;

      // If not enough space for length (need 8 bytes), pad and process block
      if (this._bufferLength > 56) {
        while (this._bufferLength < 64) {
          this._buffer[this._bufferLength++] = 0x00;
        }
        this._processBlock(this._buffer);
        this._bufferLength = 0;
      }

      // Pad with zeros
      while (this._bufferLength < 56) {
        this._buffer[this._bufferLength++] = 0x00;
      }

      // Append length in bits as 64-bit little-endian (RFC 1321 Section 3.2)
      const bitLength = this._length * 8;

      // JavaScript numbers are 53-bit precision, so we handle 64-bit length carefully
      // For messages < 2^53 bits (about 1 petabyte), this is exact
      this._buffer[56] = (bitLength >>> 0) & 0xFF;
      this._buffer[57] = (bitLength >>> 8) & 0xFF;
      this._buffer[58] = (bitLength >>> 16) & 0xFF;
      this._buffer[59] = (bitLength >>> 24) & 0xFF;

      // Upper 32 bits (for very large messages)
      const bitLengthHigh = Math.floor(bitLength / 0x100000000);
      this._buffer[60] = (bitLengthHigh >>> 0) & 0xFF;
      this._buffer[61] = (bitLengthHigh >>> 8) & 0xFF;
      this._buffer[62] = (bitLengthHigh >>> 16) & 0xFF;
      this._buffer[63] = (bitLengthHigh >>> 24) & 0xFF;

      // Process final block
      this._processBlock(this._buffer);

      // Convert hash state to byte array (little-endian)
      const result = new Array(16);
      for (let i = 0; i < 4; ++i) {
        const unpacked = OpCodes.Unpack32LE(this._h[i]);
        result[i * 4 + 0] = unpacked[0];
        result[i * 4 + 1] = unpacked[1];
        result[i * 4 + 2] = unpacked[2];
        result[i * 4 + 3] = unpacked[3];
      }

      return result;
    }

    /**
     * Process a single 512-bit (64-byte) block
     * RFC 1321 Section 3.4
     * @param {Array} block - 64-byte block to process
     */
    _processBlock(block) {
      // Convert block to 16 32-bit words (little-endian)
      const M = new Array(16);
      for (let i = 0; i < 16; ++i) {
        M[i] = OpCodes.Pack32LE(
          block[i * 4 + 0],
          block[i * 4 + 1],
          block[i * 4 + 2],
          block[i * 4 + 3]
        );
      }

      // Initialize working variables
      let A = this._h[0];
      let B = this._h[1];
      let C = this._h[2];
      let D = this._h[3];

      // Round 1 - uses F function, processes M in order
      // [ABCD k s i]: A = B + ((A + F(B,C,D) + X[k] + T[i]) <<< s)
      let idx = 0;
      for (let i = 0; i < 16; ++i) {
        const k = i;
        const temp = (A + F(B, C, D) + M[k] + T[idx]) >>> 0;
        A = D;
        D = C;
        C = B;
        B = (B + OpCodes.RotL32(temp, S[idx])) >>> 0;
        ++idx;
      }

      // Round 2 - uses G function, processes M with pattern (1 + 5*i) mod 16
      for (let i = 0; i < 16; ++i) {
        const k = (1 + 5 * i) % 16;
        const temp = (A + G(B, C, D) + M[k] + T[idx]) >>> 0;
        A = D;
        D = C;
        C = B;
        B = (B + OpCodes.RotL32(temp, S[idx])) >>> 0;
        ++idx;
      }

      // Round 3 - uses H function, processes M with pattern (5 + 3*i) mod 16
      for (let i = 0; i < 16; ++i) {
        const k = (5 + 3 * i) % 16;
        const temp = (A + H(B, C, D) + M[k] + T[idx]) >>> 0;
        A = D;
        D = C;
        C = B;
        B = (B + OpCodes.RotL32(temp, S[idx])) >>> 0;
        ++idx;
      }

      // Round 4 - uses I function, processes M with pattern (7*i) mod 16
      for (let i = 0; i < 16; ++i) {
        const k = (7 * i) % 16;
        const temp = (A + I(B, C, D) + M[k] + T[idx]) >>> 0;
        A = D;
        D = C;
        C = B;
        B = (B + OpCodes.RotL32(temp, S[idx])) >>> 0;
        ++idx;
      }

      // Add working variables back to state
      this._h[0] = (this._h[0] + A) >>> 0;
      this._h[1] = (this._h[1] + B) >>> 0;
      this._h[2] = (this._h[2] + C) >>> 0;
      this._h[3] = (this._h[3] + D) >>> 0;
    }

    /**
     * Feed/Result pattern: Feed data to the hash
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      // Initialize on first feed
      if (this._h === null) {
        this.Init();
      }

      this.Update(data);
    }

    /**
     * Feed/Result pattern: Get the final hash result
     */
    Result() {
      if (this._h === null) {
        throw new Error("No data fed");
      }

      const result = this.Final();

      // Reset for potential reuse
      this._Reset();

      return result;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new MD5Algorithm());

  return MD5Algorithm;
}));
