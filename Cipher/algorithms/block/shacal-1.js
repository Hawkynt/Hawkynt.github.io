/* SHACAL-1 Block Cipher
 * NESSIE Submission (Not Selected)
 * (c)2006-2025 Hawkynt
 *
 * 160-bit block cipher based on SHA-1
 * Variable key length: 128-512 bits
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

class Shacal1 extends BlockCipherAlgorithm {
  constructor() {
    super();

    this.name = "SHACAL-1";
    this.description = "160-bit block cipher based on the SHA-1 hash function compression function. Submitted to NESSIE but not selected due to SHA-1 weaknesses. Uses 80 rounds with SHA-1 operations.";
    this.inventor = "Helena Handschuh, David Naccache";
    this.year = 2000;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.FR;

    this.SupportedKeySizes = [new KeySize(16, 64, 1)];
    this.SupportedBlockSizes = [new KeySize(20, 20, 1)];

    this.documentation = [
      new LinkItem("NESSIE Project", "https://www.cosic.esat.kuleuven.be/nessie/"),
      new LinkItem("Wikipedia - SHACAL", "https://en.wikipedia.org/wiki/SHACAL"),
      new LinkItem("FIPS 180-2 (SHA-1 Specification)", "https://csrc.nist.gov/publications/fips/fips180-2/fips180-2.pdf")
    ];

    this.references = [
      new LinkItem("Crypto3 Implementation", "https://github.com/nilfoundation/crypto3/blob/master/libs/block/include/nil/crypto3/block/shacal1.hpp")
    ];

    this.tests = [
      {
        text: "SHA-1 IV with single-bit key (Crypto3 reference)",
        uri: "https://github.com/nilfoundation/crypto3/blob/master/libs/block/test/shacal.cpp",
        input: OpCodes.Hex8ToBytes("67452301efcdab8998badcfe10325476c3d2e1f0"),
        key: OpCodes.Hex8ToBytes("80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("72f480ed6e9d9f84999ae2f1852dc41aec052519")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new Shacal1Instance(this, isInverse);
  }
}

class Shacal1Instance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this.BlockSize = 20;
    this.KeySize = 0;
    this.RK = null;

    // SHA-1 round constants (4 distinct values for 4 groups of 20 rounds)
    this.RC = new Uint32Array([
      0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xCA62C1D6
    ]);
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.RK = null;
      return;
    }

    if (keyBytes.length < 16 || keyBytes.length > 64) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16-64)`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    this._keySchedule();
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  _keySchedule() {
    // SHA-1 key schedule (message expansion)
    this.RK = new Uint32Array(80);
    const keyWords = Math.floor(this._key.length / 4);

    // Load key as 32-bit big-endian words
    for (let i = 0; i < keyWords && i < 16; ++i) {
      this.RK[i] = OpCodes.Pack32BE(
        this._key[i * 4] || 0,
        this._key[i * 4 + 1] || 0,
        this._key[i * 4 + 2] || 0,
        this._key[i * 4 + 3] || 0
      );
    }

    // Extend key schedule using SHA-1 message schedule
    // W[t] = ROTL^1(W[t-3] XOR W[t-8] XOR W[t-14] XOR W[t-16])
    for (let t = 16; t < 80; ++t) {
      const temp = OpCodes.Xor32(OpCodes.Xor32(OpCodes.Xor32(this.RK[t - 3], this.RK[t - 8]), this.RK[t - 14]), this.RK[t - 16]);
      this.RK[t] = OpCodes.RotL32(temp, 1);
    }
  }

  // SHA-1 round functions
  _f(t, b, c, d) {
    if (t < 20) {
      // Ch(b,c,d) = (b AND c) XOR (NOT b AND d)
      return OpCodes.Xor32(b&c, OpCodes.ToUint32(~b)&d);
    } else if (t < 40) {
      // Parity(b,c,d) = b XOR c XOR d
      return OpCodes.Xor32(OpCodes.Xor32(b, c), d);
    } else if (t < 60) {
      // Maj(b,c,d) = (b AND c) XOR (b AND d) XOR (c AND d)
      return OpCodes.Xor32(OpCodes.Xor32(b&c, b&d), c&d);
    } else {
      // Parity(b,c,d) = b XOR c XOR d
      return OpCodes.Xor32(OpCodes.Xor32(b, c), d);
    }
  }

  _encryptBlock(block) {
    // Load block as 5 32-bit big-endian words
    let a = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
    let b = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
    let c = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
    let d = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);
    let e = OpCodes.Pack32BE(block[16], block[17], block[18], block[19]);

    // 80 rounds of SHA-1 compression
    for (let t = 0; t < 80; ++t) {
      const rcIndex = Math.floor(t / 20);
      const temp = OpCodes.ToUint32(OpCodes.RotL32(a, 5) + this._f(t, b, c, d) + e + this.RC[rcIndex] + this.RK[t]);
      e = d;
      d = c;
      c = OpCodes.RotL32(b, 30);
      b = a;
      a = temp;
    }

    return [
      ...OpCodes.Unpack32BE(a),
      ...OpCodes.Unpack32BE(b),
      ...OpCodes.Unpack32BE(c),
      ...OpCodes.Unpack32BE(d),
      ...OpCodes.Unpack32BE(e)
    ];
  }

  _decryptBlock(block) {
    // Load block as 5 32-bit big-endian words
    let a = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
    let b = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
    let c = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
    let d = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);
    let e = OpCodes.Pack32BE(block[16], block[17], block[18], block[19]);

    // Reverse 80 rounds of SHA-1 compression
    for (let t = 79; t >= 0; --t) {
      const rcIndex = Math.floor(t / 20);
      const temp = a;
      a = b;
      b = OpCodes.RotR32(c, 30);
      c = d;
      d = e;
      e = OpCodes.ToUint32(temp - OpCodes.RotL32(a, 5) - this._f(t, b, c, d) - this.RC[rcIndex] - this.RK[t]);
    }

    return [
      ...OpCodes.Unpack32BE(a),
      ...OpCodes.Unpack32BE(b),
      ...OpCodes.Unpack32BE(c),
      ...OpCodes.Unpack32BE(d),
      ...OpCodes.Unpack32BE(e)
    ];
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this._key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
      const block = this.inputBuffer.slice(i, i + this.BlockSize);
      const processedBlock = this.isInverse ? this._decryptBlock(block) : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    this.inputBuffer = [];
    return output;
  }
}

  RegisterAlgorithm(new Shacal1());

  return Shacal1;
}));
