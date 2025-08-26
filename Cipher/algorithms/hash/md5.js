

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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

    class MD5Instance extends IHashFunctionInstance {
      constructor(algorithm) {
        super(algorithm);
        this.OutputSize = 16; // 128 bits
        this._Reset();
      }

      _Reset() {
        // MD5 initialization values (RFC 1321)
        const initValues = global.OpCodes.Hex32ToDWords('67452301EFCDAB8998BADCFE10325476');
        this.h = new Uint32Array(initValues);

        this.buffer = new Uint8Array(64);
        this.bufferLength = 0;
        this.totalLength = 0;
      }

      Initialize() {
        this._Reset();
      }

      Feed(data) {
        if (!data || data.length === 0) return;

        const input = new Uint8Array(data);
        this.totalLength += input.length;

        let offset = 0;

        // Process any remaining bytes in buffer
        if (this.bufferLength > 0) {
          const needed = 64 - this.bufferLength;
          const available = Math.min(needed, input.length);

          this.buffer.set(input.slice(0, available), this.bufferLength);
          this.bufferLength += available;
          offset = available;

          if (this.bufferLength === 64) {
            this._ProcessBlock(this.buffer);
            this.bufferLength = 0;
          }
        }

        // Process complete 64-byte blocks
        while (offset + 64 <= input.length) {
          this._ProcessBlock(input.slice(offset, offset + 64));
          offset += 64;
        }

        // Store remaining bytes in buffer
        if (offset < input.length) {
          const remaining = input.slice(offset);
          this.buffer.set(remaining, 0);
          this.bufferLength = remaining.length;
        }
      }

      Result() {
        // Save current state
        const originalH = this.h.slice();
        const originalBuffer = this.buffer.slice();
        const originalBufferLength = this.bufferLength;
        const originalTotalLength = this.totalLength;

        // Create padding
        const msgLength = this.totalLength;
        const padLength = (msgLength % 64 < 56) ? (56 - (msgLength % 64)) : (120 - (msgLength % 64));

        // Add padding
        const padding = new Uint8Array(padLength + 8);
        padding[0] = 0x80; // First padding bit is 1

        // Add length in bits as 64-bit little-endian
        const bitLength = msgLength * 8;
        // Pack as 64-bit little-endian (low 32 bits first, then high 32 bits)
        padding[padLength] = bitLength & 0xFF;
        padding[padLength + 1] = (bitLength >>> 8) & 0xFF;
        padding[padLength + 2] = (bitLength >>> 16) & 0xFF;
        padding[padLength + 3] = (bitLength >>> 24) & 0xFF;
        // For practical message sizes, high 32 bits are always 0
        padding[padLength + 4] = 0;
        padding[padLength + 5] = 0;
        padding[padLength + 6] = 0;
        padding[padLength + 7] = 0;

        this.Feed(padding);

        // Convert hash to bytes (little-endian)
        const result = [];
        for (let i = 0; i < 4; i++) {
          const bytes = global.OpCodes.Unpack32LE(this.h[i]);
          result.push(...bytes);
        }

        // Restore original state (so Result() can be called multiple times)
        this.h = originalH;
        this.buffer = originalBuffer;
        this.bufferLength = originalBufferLength;
        this.totalLength = originalTotalLength;

        return result;
      }

      _ProcessBlock(block) {
        // Convert block to 32-bit words (little-endian)
        const w = new Array(16);
        for (let i = 0; i < 16; i++) {
          w[i] = global.OpCodes.Pack32LE(block[i * 4], block[i * 4 + 1], block[i * 4 + 2], block[i * 4 + 3]);
        }

        // Initialize working variables
        let a = this.h[0], b = this.h[1], c = this.h[2], d = this.h[3];

        // MD5 round constants (RFC 1321)
        const k = global.OpCodes.Hex32ToDWords(
          'D76AA478E8C7B756242070DBC1BDCEEEF57C0FAF4787C62AA8304613FD469501' +
          '698098D88B44F7AFFFFF5BB1895CD7BE6B901122FD987193A679438E49B40821' +
          'F61E2562C040B340265E5A51E9B6C7AAD62F105D02441453D8A1E681E7D3FBC8' +
          '21E1CDE6C33707D6F4D50D87455A14EDA9E3E905FCEFA3F8676F02D98D2A4C8A' +
          'FFFA39428771F6816D9D6122FDE5380CA4BEEA444BDECFA9F6BB4B60BEBFBC70' +
          '289B7EC6EAA127FAD4EF308504881D05D9D4D039E6DB99E51FA27CF8C4AC5665' +
          'F4292244432AFF97AB9423A7FC93A039655B59C38F0CCC92FFEFF47D85845DD1' +
          '6FA87E4FFE2CE6E0A30143144E0811A1F7537E82BD3AF2352AD7D2BBEB86D391'
        );

        // MD5 auxiliary functions
        const F = (x, y, z) => (x & y) | (~x & z);
        const G = (x, y, z) => (x & z) | (y & ~z);
        const H = (x, y, z) => x ^ y ^ z;
        const I = (x, y, z) => y ^ (x | ~z);

        // Use OpCodes rotate left function
        const rotl = (x, n) => global.OpCodes.RotL32(x, n);

        // MD5 shift amounts per round (RFC 1321)
        const shifts = [
          7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
          5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
          4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
          6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
        ];

        // MD5 rounds
        for (let i = 0; i < 64; i++) {
          let f, g;

          if (i < 16) {
            f = F(b, c, d);
            g = i;
          } else if (i < 32) {
            f = G(b, c, d);
            g = (5 * i + 1) % 16;
          } else if (i < 48) {
            f = H(b, c, d);
            g = (3 * i + 5) % 16;
          } else {
            f = I(b, c, d);
            g = (7 * i) % 16;
          }

          f = (f + a + k[i] + w[g]) >>> 0;
          a = d;
          d = c;
          c = b;
          b = (b + rotl(f, shifts[i])) >>> 0;
        }

        // Add to hash
        this.h[0] = (this.h[0] + a) >>> 0;
        this.h[1] = (this.h[1] + b) >>> 0;
        this.h[2] = (this.h[2] + c) >>> 0;
        this.h[3] = (this.h[3] + d) >>> 0;
      }
    }

    class MD5Algorithm extends HashFunctionAlgorithm {
      constructor() {
        super();

        // Basic information
        this.name = "MD5";
        this.description = "128-bit cryptographic hash function designed by Ronald Rivest. Fast but cryptographically broken with practical collision attacks.";
        this.inventor = "Ronald Rivest";
        this.year = 1991;
        this.category = CategoryType.HASH;
        this.subCategory = "Cryptographic Hash";
        this.securityStatus = SecurityStatus.BROKEN;
        this.complexity = ComplexityType.BEGINNER;
        this.country = CountryCode.US;

        // Capabilities
        this.SupportedOutputSizes = [{ minSize: 16, maxSize: 16, stepSize: 1 }];

        // Documentation
        this.documentation = [
          new LinkItem("RFC 1321 - The MD5 Message-Digest Algorithm", "https://tools.ietf.org/html/rfc1321"),
          new LinkItem("NIST SP 800-107 - Recommendation for Applications Using Approved Hash Algorithms", "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-107r1.pdf"),
          new LinkItem("Wikipedia - MD5", "https://en.wikipedia.org/wiki/MD5")
        ];

        // References
        this.references = [
          new LinkItem("OpenSSL MD5 Implementation", "https://github.com/openssl/openssl/blob/master/crypto/md5/md5_dgst.c"),
          new LinkItem("MD5 Collision Research", "https://www.win.tue.nl/hashclash/rogue-ca/"),
          new LinkItem("RFC 6151 - Updated Security Considerations for MD5", "https://tools.ietf.org/html/rfc6151")
        ];

        // Known vulnerabilities
        this.knownVulnerabilities = [
          new Vulnerability("Collision Attack", "Practical collision attacks demonstrated by Wang et al. in 2004. Can generate two different messages with same MD5 hash.", "https://eprint.iacr.org/2004/199.pdf"),
          new Vulnerability("Chosen-prefix Collision", "Attackers can create collisions with chosen prefixes, enabling sophisticated attacks.", "https://www.win.tue.nl/hashclash/rogue-ca/"),
          new Vulnerability("Rainbow Table Attack", "Common passwords vulnerable to precomputed rainbow table attacks.", "")
        ];

        // Test vectors from RFC 1321
        this.tests = [
          {
            input: [],
            expected: global.OpCodes.Hex8ToBytes("d41d8cd98f00b204e9800998ecf8427e"),
            text: "RFC 1321 Test Vector - Empty string",
            uri: "https://tools.ietf.org/html/rfc1321"
          },
          {
            input: global.OpCodes.AnsiToBytes("a"),
            expected: global.OpCodes.Hex8ToBytes("0cc175b9c0f1b6a831c399e269772661"),
            text: "RFC 1321 Test Vector - 'a'",
            uri: "https://tools.ietf.org/html/rfc1321"
          },
          {
            input: global.OpCodes.AnsiToBytes("abc"),
            expected: global.OpCodes.Hex8ToBytes("900150983cd24fb0d6963f7d28e17f72"),
            text: "RFC 1321 Test Vector - 'abc'",
            uri: "https://tools.ietf.org/html/rfc1321"
          },
          {
            input: global.OpCodes.AnsiToBytes("message digest"),
            expected: global.OpCodes.Hex8ToBytes("f96b697d7cb7938d525a2f31aaf161d0"),
            text: "RFC 1321 Test Vector - 'message digest'",
            uri: "https://tools.ietf.org/html/rfc1321"
          },
          {
            input: global.OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz"),
            expected: global.OpCodes.Hex8ToBytes("c3fcd3d76192e4007dfb496cca67e13b"),
            text: "RFC 1321 Test Vector - alphabet",
            uri: "https://tools.ietf.org/html/rfc1321"
          },
          {
            input: global.OpCodes.AnsiToBytes("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"),
            expected: global.OpCodes.Hex8ToBytes("d174ab98d277d9f5a5611c2c9f419d9f"),
            text: "RFC 1321 Test Vector - alphanumeric",
            uri: "https://tools.ietf.org/html/rfc1321"
          },
          {
            input: global.OpCodes.AnsiToBytes("1234567890".repeat(8)),
            expected: global.OpCodes.Hex8ToBytes("57edf4a22be3c955ac49da2e2107b67a"),
            text: "RFC 1321 Test Vector - numeric sequence",
            uri: "https://tools.ietf.org/html/rfc1321"
          }
        ];
      }

      CreateInstance(isInverse = false) {
        // Hash functions don't have an inverse operation
        if (isInverse) {
          return null;
        }
        return new MD5Instance(this);
      }
    }

  // ===== REGISTRATION =====

    const algorithmInstance = new MD5Algorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { MD5Algorithm, MD5Instance };
}));