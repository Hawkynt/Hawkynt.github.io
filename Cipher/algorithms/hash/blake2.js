

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
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem } = AlgorithmFramework;

  // ===== SHARED BLAKE2 CONSTANTS =====

  // Shared sigma permutation schedule (used by both BLAKE2b and BLAKE2s)
  const SIGMA = Object.freeze([
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
    [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
    [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
    [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
    [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
    [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
    [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
    [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
    [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0]
  ]);

  // ===== BLAKE2B (64-BIT) IMPLEMENTATION =====

  // BLAKE2b constants
  const BLAKE2B_BLOCKBYTES = 128;
  const BLAKE2B_OUTBYTES = 64;
  const BLAKE2B_KEYBYTES = 64;

  // BLAKE2b initialization vectors (64-bit words as BigInt values)
  const BLAKE2B_IV = Object.freeze([
    BigInt('0x6a09e667f3bcc908'), BigInt('0xbb67ae8584caa73b'),
    BigInt('0x3c6ef372fe94f82b'), BigInt('0xa54ff53a5f1d36f1'),
    BigInt('0x510e527fade682d1'), BigInt('0x9b05688c2b3e6c1f'),
    BigInt('0x1f83d9abfb41bd6b'), BigInt('0x5be0cd19137e2179')
  ]);

  /**
   * 64-bit right rotation for BigInt values
   */
  function RotR64(value, positions) {
    const mask64 = BigInt('0xffffffffffffffff');
    value = value & mask64;
    positions = BigInt(positions) & BigInt(63);
    return ((value >> positions) | (value << (BigInt(64) - positions))) & mask64;
  }

  /**
   * BLAKE2b G function (mixing function for 64-bit)
   */
  function BLAKE2b_G(v, a, b, c, d, x, y) {
    v[a] = (v[a] + v[b] + x) & BigInt('0xffffffffffffffff');
    v[d] = RotR64(v[d] ^ v[a], 32);
    v[c] = (v[c] + v[d]) & BigInt('0xffffffffffffffff');
    v[b] = RotR64(v[b] ^ v[c], 24);
    v[a] = (v[a] + v[b] + y) & BigInt('0xffffffffffffffff');
    v[d] = RotR64(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) & BigInt('0xffffffffffffffff');
    v[b] = RotR64(v[b] ^ v[c], 63);
  }

  /**
   * BLAKE2b compression function
   */
  function BLAKE2b_compress(h, m, t, f) {
    const v = new Array(16);

    // Initialize working vector
    for (let i = 0; i < 8; i++) {
      v[i] = h[i];
    }
    for (let i = 0; i < 8; i++) {
      v[i + 8] = BLAKE2B_IV[i];
    }

    // Mix counter and final flag
    v[12] ^= t & BigInt('0xffffffffffffffff');
    v[13] ^= (t >> BigInt(64)) & BigInt('0xffffffffffffffff');
    if (f) {
      v[14] ^= BigInt('0xffffffffffffffff');
    }

    // 12 rounds of mixing
    for (let round = 0; round < 12; round++) {
      const s = SIGMA[round % 10];

      // Mix columns
      BLAKE2b_G(v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
      BLAKE2b_G(v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
      BLAKE2b_G(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
      BLAKE2b_G(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);

      // Mix diagonals
      BLAKE2b_G(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
      BLAKE2b_G(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
      BLAKE2b_G(v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
      BLAKE2b_G(v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
    }

    // Update hash state
    for (let i = 0; i < 8; i++) {
      h[i] ^= v[i] ^ v[i + 8];
    }
  }

  /**
   * Convert bytes to 64-bit words (little-endian)
   */
  function bytesToWords64(bytes) {
    const words = [];
    for (let i = 0; i < bytes.length; i += 8) {
      let word = BigInt(0);
      for (let j = 0; j < 8 && i + j < bytes.length; j++) {
        word |= BigInt(bytes[i + j]) << BigInt(j * 8);
      }
      words.push(word);
    }
    return words;
  }

  /**
   * Convert 64-bit words to bytes (little-endian)
   */
  function words64ToBytes(words, length) {
    const bytes = new Uint8Array(length);
    let byteIndex = 0;

    for (let i = 0; i < words.length && byteIndex < length; i++) {
      let word = words[i];
      for (let j = 0; j < 8 && byteIndex < length; j++) {
        bytes[byteIndex++] = Number(word & BigInt('0xff'));
        word >>= BigInt(8);
      }
    }

    return bytes;
  }

  /**
   * BLAKE2b hasher class
   */
  function Blake2bHasher(key, outputLength) {
    this.outputLength = outputLength || BLAKE2B_OUTBYTES;
    this.key = key || null;
    this.h = new Array(8);
    this.buffer = new Uint8Array(BLAKE2B_BLOCKBYTES);
    this.bufferLength = 0;
    this.counter = BigInt(0);

    // Initialize hash state
    for (let i = 0; i < 8; i++) {
      this.h[i] = BLAKE2B_IV[i];
    }

    // Set parameter block in h[0]
    this.h[0] ^= BigInt(this.outputLength) |
                 (BigInt(key ? key.length : 0) << BigInt(8)) |
                 (BigInt(1) << BigInt(16)) |  // fanout = 1
                 (BigInt(1) << BigInt(24));   // depth = 1

    // Process key if provided
    if (key && key.length > 0) {
      const keyPadded = new Uint8Array(BLAKE2B_BLOCKBYTES);
      for (let i = 0; i < key.length && i < BLAKE2B_KEYBYTES; i++) {
        keyPadded[i] = key[i];
      }
      this.update(keyPadded);
    }
  }

  Blake2bHasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.AnsiToBytes(data);
    }

    let offset = 0;

    while (offset < data.length) {
      const remaining = BLAKE2B_BLOCKBYTES - this.bufferLength;
      const toCopy = Math.min(remaining, data.length - offset);

      // Copy data to buffer
      for (let i = 0; i < toCopy; i++) {
        this.buffer[this.bufferLength + i] = data[offset + i];
      }

      this.bufferLength += toCopy;
      offset += toCopy;

      // Process full blocks
      if (this.bufferLength === BLAKE2B_BLOCKBYTES) {
        this.counter += BigInt(BLAKE2B_BLOCKBYTES);
        const m = bytesToWords64(this.buffer);

        // Pad message block to 16 words
        while (m.length < 16) {
          m.push(BigInt(0));
        }

        BLAKE2b_compress(this.h, m, this.counter, false);
        this.bufferLength = 0;
      }
    }
  };

  Blake2bHasher.prototype.finalize = function() {
    // Process final block
    this.counter += BigInt(this.bufferLength);

    // Pad final block with zeros
    for (let i = this.bufferLength; i < BLAKE2B_BLOCKBYTES; i++) {
      this.buffer[i] = 0x00;
    }

    const m = bytesToWords64(this.buffer);
    while (m.length < 16) {
      m.push(BigInt(0));
    }

    BLAKE2b_compress(this.h, m, this.counter, true);

    // Convert hash state to bytes
    return words64ToBytes(this.h, this.outputLength);
  };

  // ===== BLAKE2S (32-BIT) IMPLEMENTATION =====

  // BLAKE2s constants
  const BLAKE2S_BLOCKBYTES = 64;
  const BLAKE2S_OUTBYTES = 32;
  const BLAKE2S_KEYBYTES = 32;

  // BLAKE2s initialization vectors
  const BLAKE2S_IV = OpCodes.Hex32ToDWords('6a09e667bb67ae853c6ef372a54ff53a510e527f9b05688c1f83d9ab5be0cd19');

  /**
   * BLAKE2s G function (mixing function for 32-bit)
   */
  function BLAKE2s_G(v, a, b, c, d, x, y) {
    v[a] = (v[a] + v[b] + x) >>> 0;
    v[d] = OpCodes.RotR32(v[d] ^ v[a], 16);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = OpCodes.RotR32(v[b] ^ v[c], 12);
    v[a] = (v[a] + v[b] + y) >>> 0;
    v[d] = OpCodes.RotR32(v[d] ^ v[a], 8);
    v[c] = (v[c] + v[d]) >>> 0;
    v[b] = OpCodes.RotR32(v[b] ^ v[c], 7);
  }

  /**
   * BLAKE2s compression function
   */
  function BLAKE2s_compress(h, m, t0, t1, f) {
    const v = new Uint32Array(16);

    // Initialize working vector
    for (let i = 0; i < 8; i++) {
      v[i] = h[i];
    }
    for (let i = 0; i < 8; i++) {
      v[i + 8] = BLAKE2S_IV[i];
    }

    // Mix counter and final flag
    v[12] ^= t0;
    v[13] ^= t1;
    if (f) {
      v[14] = ~v[14] >>> 0;
    }

    // 10 rounds of mixing
    for (let round = 0; round < 10; round++) {
      const s = SIGMA[round];

      // Mix columns
      BLAKE2s_G(v, 0, 4, 8, 12, m[s[0]], m[s[1]]);
      BLAKE2s_G(v, 1, 5, 9, 13, m[s[2]], m[s[3]]);
      BLAKE2s_G(v, 2, 6, 10, 14, m[s[4]], m[s[5]]);
      BLAKE2s_G(v, 3, 7, 11, 15, m[s[6]], m[s[7]]);

      // Mix diagonals
      BLAKE2s_G(v, 0, 5, 10, 15, m[s[8]], m[s[9]]);
      BLAKE2s_G(v, 1, 6, 11, 12, m[s[10]], m[s[11]]);
      BLAKE2s_G(v, 2, 7, 8, 13, m[s[12]], m[s[13]]);
      BLAKE2s_G(v, 3, 4, 9, 14, m[s[14]], m[s[15]]);
    }

    // Update hash state
    for (let i = 0; i < 8; i++) {
      h[i] ^= v[i] ^ v[i + 8];
    }
  }

  /**
   * BLAKE2s hasher class
   */
  function Blake2sHasher(key, outputLength, salt, personalization, nodeOffset, xofParams) {
    this.outputLength = outputLength || BLAKE2S_OUTBYTES;
    this.key = key || null;
    this.h = new Uint32Array(8);
    this.buffer = new Uint8Array(BLAKE2S_BLOCKBYTES);
    this.bufferLength = 0;
    this.t0 = 0; // Low 32 bits of counter
    this.t1 = 0; // High 32 bits of counter

    // Tree hashing / XOF parameters
    const fanout = (xofParams && xofParams.fanout !== undefined) ? xofParams.fanout : 1;
    const depth = (xofParams && xofParams.depth !== undefined) ? xofParams.depth : 1;
    const leafLength = (xofParams && xofParams.leafLength) || 0;
    const innerHashLength = (xofParams && xofParams.innerHashLength) || 0;
    const nodeDepth = (xofParams && xofParams.nodeDepth) || 0;
    const xofLength = (xofParams && xofParams.xofLength) || 0;
    const nOffset = nodeOffset || 0;

    // Initialize hash state
    for (let i = 0; i < 8; i++) {
      this.h[i] = BLAKE2S_IV[i];
    }

    // Set parameter block
    this.h[0] ^= this.outputLength |
                 ((key ? key.length : 0) << 8) |
                 (fanout << 16) |
                 (depth << 24);

    this.h[1] ^= leafLength;

    // h[2] and h[3]: node_offset
    const nodeOffsetLo = nOffset >>> 0;
    const nodeOffsetHi = Math.floor(nOffset / 0x100000000);
    this.h[2] ^= nodeOffsetLo;
    this.h[3] ^= ((xofLength & 0xFFFF) | (nodeDepth << 16) | (innerHashLength << 24));

    // h[4] and h[5]: salt
    if (salt && salt.length === 8) {
      this.h[4] ^= OpCodes.Pack32LE(salt[0], salt[1], salt[2], salt[3]);
      this.h[5] ^= OpCodes.Pack32LE(salt[4], salt[5], salt[6], salt[7]);
    }

    // h[6] and h[7]: personalization
    if (personalization && personalization.length === 8) {
      this.h[6] ^= OpCodes.Pack32LE(personalization[0], personalization[1], personalization[2], personalization[3]);
      this.h[7] ^= OpCodes.Pack32LE(personalization[4], personalization[5], personalization[6], personalization[7]);
    }

    // Process key if provided
    if (key && key.length > 0) {
      const keyPadded = new Uint8Array(BLAKE2S_BLOCKBYTES);
      for (let i = 0; i < key.length && i < BLAKE2S_KEYBYTES; i++) {
        keyPadded[i] = key[i];
      }
      this.update(keyPadded);
    }
  }

  Blake2sHasher.prototype.update = function(data) {
    if (typeof data === 'string') {
      data = OpCodes.AnsiToBytes(data);
    }

    let offset = 0;

    while (offset < data.length) {
      const remaining = BLAKE2S_BLOCKBYTES - this.bufferLength;
      const toCopy = Math.min(remaining, data.length - offset);

      // Copy data to buffer
      for (let i = 0; i < toCopy; i++) {
        this.buffer[this.bufferLength + i] = data[offset + i];
      }

      this.bufferLength += toCopy;
      offset += toCopy;

      // Process full blocks ONLY if there's more data to come
      if (this.bufferLength === BLAKE2S_BLOCKBYTES && offset < data.length) {
        // Increment counter (64-bit addition)
        this.t0 += BLAKE2S_BLOCKBYTES;
        if (this.t0 < BLAKE2S_BLOCKBYTES) {
          this.t1++; // Overflow
        }

        // Convert buffer to 32-bit words (little-endian)
        const m = new Uint32Array(16);
        for (let i = 0; i < 16; i++) {
          m[i] = OpCodes.Pack32LE(
            this.buffer[i * 4],
            this.buffer[i * 4 + 1],
            this.buffer[i * 4 + 2],
            this.buffer[i * 4 + 3]
          );
        }

        BLAKE2s_compress(this.h, m, this.t0, this.t1, false);
        this.bufferLength = 0;
        // Clear buffer after processing
        for (let i = 0; i < BLAKE2S_BLOCKBYTES; i++) {
          this.buffer[i] = 0;
        }
      }
    }
  };

  Blake2sHasher.prototype.finalize = function() {
    // Increment counter for final block
    this.t0 += this.bufferLength;
    if (this.t0 < this.bufferLength) {
      this.t1++; // Overflow
    }

    // Pad final block with zeros
    for (let i = this.bufferLength; i < BLAKE2S_BLOCKBYTES; i++) {
      this.buffer[i] = 0;
    }

    // Convert buffer to 32-bit words (little-endian)
    const m = new Uint32Array(16);
    for (let i = 0; i < 16; i++) {
      m[i] = OpCodes.Pack32LE(
        this.buffer[i * 4],
        this.buffer[i * 4 + 1],
        this.buffer[i * 4 + 2],
        this.buffer[i * 4 + 3]
      );
    }

    BLAKE2s_compress(this.h, m, this.t0, this.t1, true);

    // Convert hash state to bytes (little-endian)
    const output = new Uint8Array(this.outputLength);
    for (let i = 0; i < this.outputLength; i++) {
      const wordIndex = Math.floor(i / 4);
      const byteIndex = i % 4;
      const word = this.h[wordIndex];
      output[i] = OpCodes.GetByte(word, byteIndex);
    }

    return output;
  };

  // ===== BLAKE2B ALGORITHM =====

  class BLAKE2bAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BLAKE2b";
      this.description = "BLAKE2b is a high-speed cryptographic hash function optimized for 64-bit platforms. It's faster than MD5, SHA-1, SHA-2, and SHA-3 while providing excellent security properties.";
      this.inventor = "Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "BLAKE Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      // Hash-specific metadata
      this.SupportedOutputSizes = [64]; // 512 bits = 64 bytes (default)

      // Performance and technical specifications
      this.blockSize = 128; // 1024 bits = 128 bytes
      this.outputSize = 64; // 512 bits = 64 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 7693 - BLAKE2 Cryptographic Hash and MAC", "https://tools.ietf.org/html/rfc7693"),
        new LinkItem("BLAKE2 Official Specification", "https://blake2.net/blake2.pdf"),
        new LinkItem("BLAKE2 Reference Implementation", "https://github.com/BLAKE2/BLAKE2")
      ];

      this.references = [
        new LinkItem("Wikipedia BLAKE2", "https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE2"),
        new LinkItem("libsodium BLAKE2b", "https://github.com/jedisct1/libsodium")
      ];

      // Test vectors from RFC 7693
      this.tests = [
        {
          text: "RFC 7693 Test Vector - Empty string",
          uri: "https://tools.ietf.org/html/rfc7693",
          input: [],
          expected: OpCodes.Hex8ToBytes("786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce")
        },
        {
          text: "RFC 7693 Test Vector - abc",
          uri: "https://tools.ietf.org/html/rfc7693",
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923")
        },
        {
          text: "RFC 7693 Test Vector - The quick brown fox",
          uri: "https://tools.ietf.org/html/rfc7693",
          input: OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          expected: OpCodes.Hex8ToBytes("a8add4bdddfd93e4877d2746e62817b116364a1fa7bc148d95090bc7333b3673f82401cf7aa2e4cb1ecd90296e3f14cb5413f8ed77be73045b13914cdcd6a918")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BLAKE2bAlgorithmInstance(this, isInverse);
    }
  }

  class BLAKE2bAlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 64; // 512 bits = 64 bytes

      // BLAKE2b state
      this._hasher = null;
    }

    Init() {
      this._hasher = new Blake2bHasher(null, BLAKE2B_OUTBYTES);
    }

    Update(data) {
      if (!this._hasher) this.Init();
      this._hasher.update(data);
    }

    Final() {
      if (!this._hasher) this.Init();
      const result = this._hasher.finalize();
      return Array.from(result);
    }

    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    KeySetup(key) {
      return true;
    }

    EncryptBlock(blockIndex, plaintext) {
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      throw new Error('BLAKE2b is a one-way hash function - decryption not possible');
    }

    ClearData() {
      this._hasher = null;
    }

    Feed(data) {
      this.Init();
      this.Update(data);
    }

    Result() {
      return this.Final();
    }
  }

  // ===== BLAKE2S ALGORITHM =====

  class BLAKE2sAlgorithm extends HashFunctionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "BLAKE2s";
      this.description = "BLAKE2s is a high-speed cryptographic hash function optimized for 8-32 bit platforms. It's the 32-bit version of BLAKE2 and is used in protocols like WireGuard.";
      this.inventor = "Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn, Christian Winnerlein";
      this.year = 2012;
      this.category = CategoryType.HASH;
      this.subCategory = "BLAKE Family";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.CH;

      // Hash-specific metadata
      this.SupportedOutputSizes = [32]; // 256 bits = 32 bytes (default)

      // Performance and technical specifications
      this.blockSize = 64; // 512 bits = 64 bytes
      this.outputSize = 32; // 256 bits = 32 bytes

      // Documentation and references
      this.documentation = [
        new LinkItem("RFC 7693 - BLAKE2 Cryptographic Hash and MAC", "https://tools.ietf.org/html/rfc7693"),
        new LinkItem("BLAKE2 Official Specification", "https://blake2.net/blake2.pdf"),
        new LinkItem("BLAKE2 Reference Implementation", "https://github.com/BLAKE2/BLAKE2")
      ];

      this.references = [
        new LinkItem("Wikipedia BLAKE2", "https://en.wikipedia.org/wiki/BLAKE_(hash_function)#BLAKE2"),
        new LinkItem("WireGuard Protocol", "https://www.wireguard.com/papers/wireguard.pdf")
      ];

      // Test vectors from RFC 7693
      this.tests = [
        {
          text: "RFC 7693 BLAKE2s - Empty string",
          uri: "https://datatracker.ietf.org/doc/html/rfc7693",
          input: [],
          expected: OpCodes.Hex8ToBytes("69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9")
        },
        {
          text: "RFC 7693 BLAKE2s - 'abc'",
          uri: "https://datatracker.ietf.org/doc/html/rfc7693",
          input: OpCodes.AnsiToBytes("abc"),
          expected: OpCodes.Hex8ToBytes("508c5e8c327c14e2e1a72ba34eeb452f37458b209ed63a294d999b4c86675982")
        },
        {
          text: "Linux crypto test vector - Empty string unkeyed",
          uri: "https://kdave.github.io/linux-crypto-blake2s/",
          input: [],
          expected: OpCodes.Hex8ToBytes("69217a3079908094e11121d042354a7c1f55b6482ca1a51e1b250dfd1ed0eef9")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new BLAKE2sAlgorithmInstance(this, isInverse);
    }
  }

  class BLAKE2sAlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.OutputSize = 32; // 256 bits = 32 bytes

      // BLAKE2s state
      this._hasher = null;
    }

    Init() {
      this._hasher = new Blake2sHasher(null, BLAKE2S_OUTBYTES);
    }

    Update(data) {
      if (!this._hasher) this.Init();
      this._hasher.update(data);
    }

    Final() {
      if (!this._hasher) this.Init();
      const result = this._hasher.finalize();
      return Array.from(result);
    }

    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

    KeySetup(key) {
      return true;
    }

    EncryptBlock(blockIndex, plaintext) {
      return this.Hash(plaintext);
    }

    DecryptBlock(blockIndex, ciphertext) {
      throw new Error('BLAKE2s is a one-way hash function - decryption not possible');
    }

    ClearData() {
      this._hasher = null;
    }

    Feed(data) {
      if (!this._hasher) this.Init();
      this.Update(data);
    }

    Result() {
      if (!this._hasher) this.Init();
      // Create a copy of the current state to avoid modifying the original
      const hasherCopy = new Blake2sHasher(null, BLAKE2S_OUTBYTES);
      hasherCopy.h = new Uint32Array(this._hasher.h);
      hasherCopy.buffer = new Uint8Array(this._hasher.buffer);
      hasherCopy.bufferLength = this._hasher.bufferLength;
      hasherCopy.t0 = this._hasher.t0;
      hasherCopy.t1 = this._hasher.t1;

      const result = hasherCopy.finalize();
      return Array.from(result);
    }
  }

  // ===== BLAKE2XS ALGORITHM =====

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

  class BLAKE2xsAlgorithmInstance extends IHashFunctionInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;

      // XOF parameters
      this._digestLength = BLAKE2XS_UNKNOWN_DIGEST_LENGTH;
      this._outputSize = 32;

      // Root hash
      this._rootHash = null;
      this._h0 = null;

      // Current output buffer
      this._buf = new Uint8Array(32);
      this._bufPos = 32;

      // Position tracking
      this._digestPos = 0;
      this._blockPos = 0;
      this._nodeOffset = 0;
    }

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

    Init() {
      this._nodeOffset = 0;
      this._rootHash = this.createRootHash(null, null, null);
      this._h0 = null;
      this._bufPos = 32;
      this._digestPos = 0;
      this._blockPos = 0;
    }

    Reset() {
      this.Init();
    }

    createRootHash(key, salt, personalization) {
      const hasher = new Blake2sHasher(key, BLAKE2XS_DIGEST_LENGTH, salt, personalization, 0, {
        fanout: 1,
        depth: 1,
        xofLength: this._digestLength
      });
      return hasher;
    }

    createInternalHash(stepLength, nodeOffset) {
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

    Update(data) {
      if (!this._rootHash) this.Init();
      this._rootHash.update(data);
    }

    finalizeRootHash() {
      if (!this._h0) {
        this._h0 = new Uint8Array(32);
        const result = this._rootHash.finalize();
        for (let i = 0; i < 32; i++) {
          this._h0[i] = result[i];
        }
      }
    }

    computeStepLength() {
      if (this._digestLength === BLAKE2XS_UNKNOWN_DIGEST_LENGTH) {
        return BLAKE2XS_DIGEST_LENGTH;
      }
      return Math.min(BLAKE2XS_DIGEST_LENGTH, this._digestLength - this._digestPos);
    }

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

    Final() {
      if (!this._rootHash) this.Init();
      return this.doOutput(this._outputSize);
    }

    Hash(message) {
      this.Init();
      this.Update(message);
      return this.Final();
    }

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

    Feed(data) {
      if (!this._rootHash) this.Init();
      this.Update(data);
    }

    Result() {
      if (!this._rootHash) this.Init();
      return this.doOutput(this._outputSize);
    }
  }

  // ===== REGISTRATION =====

  const blake2bInstance = new BLAKE2bAlgorithm();
  if (!AlgorithmFramework.Find(blake2bInstance.name)) {
    RegisterAlgorithm(blake2bInstance);
  }

  const blake2sInstance = new BLAKE2sAlgorithm();
  if (!AlgorithmFramework.Find(blake2sInstance.name)) {
    RegisterAlgorithm(blake2sInstance);
  }

  const blake2xsInstance = new BLAKE2xsAlgorithm();
  if (!AlgorithmFramework.Find(blake2xsInstance.name)) {
    RegisterAlgorithm(blake2xsInstance);
  }

  // ===== EXPORTS =====

  return {
    BLAKE2bAlgorithm, BLAKE2bAlgorithmInstance, Blake2bHasher,
    BLAKE2sAlgorithm, BLAKE2sAlgorithmInstance, Blake2sHasher,
    BLAKE2xsAlgorithm, BLAKE2xsAlgorithmInstance
  };
}));
