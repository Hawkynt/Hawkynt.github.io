/* SHACAL-2 Block Cipher
 * NESSIE Selected Algorithm
 * (c)2006-2025 Hawkynt
 *
 * 256-bit block cipher based on SHA-256
 * Variable key length: 128-512 bits
 */

// Load AlgorithmFramework
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
        BlockCipherAlgorithm, IBlockCipherInstance, LinkItem, KeySize } = AlgorithmFramework;

class Shacal2 extends BlockCipherAlgorithm {
  constructor() {
    super();

    this.name = "SHACAL-2";
    this.description = "256-bit block cipher based on the SHA-256 hash function compression function. Selected by NESSIE for standardization. Uses 64 rounds with SHA-256 operations.";
    this.inventor = "Helena Handschuh, David Naccache";
    this.year = 2000;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.FR;

    this.SupportedKeySizes = [new KeySize(16, 64, 1)];
    this.SupportedBlockSizes = [new KeySize(32, 32, 1)];

    this.documentation = [
      new LinkItem("NESSIE Portfolio", "https://www.cosic.esat.kuleuven.be/nessie/"),
      new LinkItem("Wikipedia - SHACAL", "https://en.wikipedia.org/wiki/SHACAL")
    ];

    this.references = [
      new LinkItem("Botan Implementation", "https://github.com/randombit/botan/blob/master/src/lib/block/shacal2/shacal2.cpp")
    ];

    this.tests = [
      {
        text: "NESSIE Set 1, vector 0 (512-bit key)",
        uri: "https://www.cosic.esat.kuleuven.be/nessie/testvectors/",
        input: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("80000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("361AB6322FA9E7A7BB23818D839E01BDDAFDF47305426EDD297AEDB9F6202BAE")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new Shacal2Instance(this, isInverse);
  }
}

class Shacal2Instance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this.BlockSize = 32;
    this.KeySize = 0;
    this.RK = null;

    // SHA-256 round constants
    this.RC = new Uint32Array([
      0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5,
      0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174,
      0xE49B69C1, 0xEFBE4786, 0x0FC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA,
      0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x06CA6351, 0x14292967,
      0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85,
      0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070,
      0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3,
      0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2
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

  _sigma0(x) {
    return OpCodes.RotR32(x, 7) ^ OpCodes.RotR32(x, 18) ^ (x >>> 3);
  }

  _sigma1(x) {
    return OpCodes.RotR32(x, 17) ^ OpCodes.RotR32(x, 19) ^ (x >>> 10);
  }

  _keySchedule() {
    this.RK = new Uint32Array(64);
    const keyWords = Math.floor(this._key.length / 4);

    // Load key as 32-bit words
    for (let i = 0; i < keyWords; ++i) {
      this.RK[i] = OpCodes.Pack32BE(
        this._key[i * 4],
        this._key[i * 4 + 1],
        this._key[i * 4 + 2],
        this._key[i * 4 + 3]
      );
    }

    // Extend key schedule using SHA-256 message schedule
    for (let i = 16; i < 64; ++i) {
      const s0 = this._sigma0(this.RK[i - 15]);
      const s1 = this._sigma1(this.RK[i - 2]);
      this.RK[i] = (this.RK[i - 16] + s0 + this.RK[i - 7] + s1) >>> 0;
    }

    // Add round constants
    for (let i = 0; i < 64; ++i) {
      this.RK[i] = (this.RK[i] + this.RC[i]) >>> 0;
    }
  }

  _Ch(x, y, z) {
    return (x & y) ^ (~x & z);
  }

  _Maj(x, y, z) {
    return (x & y) ^ (x & z) ^ (y & z);
  }

  _Sigma0(x) {
    return OpCodes.RotR32(x, 2) ^ OpCodes.RotR32(x, 13) ^ OpCodes.RotR32(x, 22);
  }

  _Sigma1(x) {
    return OpCodes.RotR32(x, 6) ^ OpCodes.RotR32(x, 11) ^ OpCodes.RotR32(x, 25);
  }

  _encryptBlock(block) {
    let [A, B, C, D, E, F, G, H] = [
      OpCodes.Pack32BE(block[0], block[1], block[2], block[3]),
      OpCodes.Pack32BE(block[4], block[5], block[6], block[7]),
      OpCodes.Pack32BE(block[8], block[9], block[10], block[11]),
      OpCodes.Pack32BE(block[12], block[13], block[14], block[15]),
      OpCodes.Pack32BE(block[16], block[17], block[18], block[19]),
      OpCodes.Pack32BE(block[20], block[21], block[22], block[23]),
      OpCodes.Pack32BE(block[24], block[25], block[26], block[27]),
      OpCodes.Pack32BE(block[28], block[29], block[30], block[31])
    ];

    for (let r = 0; r < 64; r += 8) {
      // Unrolled 8 rounds
      H = (H + this._Sigma1(E) + this._Ch(E, F, G) + this.RK[r]) >>> 0;
      D = (D + H) >>> 0;
      H = (H + this._Sigma0(A) + this._Maj(A, B, C)) >>> 0;

      G = (G + this._Sigma1(D) + this._Ch(D, E, F) + this.RK[r+1]) >>> 0;
      C = (C + G) >>> 0;
      G = (G + this._Sigma0(H) + this._Maj(H, A, B)) >>> 0;

      F = (F + this._Sigma1(C) + this._Ch(C, D, E) + this.RK[r+2]) >>> 0;
      B = (B + F) >>> 0;
      F = (F + this._Sigma0(G) + this._Maj(G, H, A)) >>> 0;

      E = (E + this._Sigma1(B) + this._Ch(B, C, D) + this.RK[r+3]) >>> 0;
      A = (A + E) >>> 0;
      E = (E + this._Sigma0(F) + this._Maj(F, G, H)) >>> 0;

      D = (D + this._Sigma1(A) + this._Ch(A, B, C) + this.RK[r+4]) >>> 0;
      H = (H + D) >>> 0;
      D = (D + this._Sigma0(E) + this._Maj(E, F, G)) >>> 0;

      C = (C + this._Sigma1(H) + this._Ch(H, A, B) + this.RK[r+5]) >>> 0;
      G = (G + C) >>> 0;
      C = (C + this._Sigma0(D) + this._Maj(D, E, F)) >>> 0;

      B = (B + this._Sigma1(G) + this._Ch(G, H, A) + this.RK[r+6]) >>> 0;
      F = (F + B) >>> 0;
      B = (B + this._Sigma0(C) + this._Maj(C, D, E)) >>> 0;

      A = (A + this._Sigma1(F) + this._Ch(F, G, H) + this.RK[r+7]) >>> 0;
      E = (E + A) >>> 0;
      A = (A + this._Sigma0(B) + this._Maj(B, C, D)) >>> 0;
    }

    return [
      ...OpCodes.Unpack32BE(A), ...OpCodes.Unpack32BE(B), ...OpCodes.Unpack32BE(C), ...OpCodes.Unpack32BE(D),
      ...OpCodes.Unpack32BE(E), ...OpCodes.Unpack32BE(F), ...OpCodes.Unpack32BE(G), ...OpCodes.Unpack32BE(H)
    ];
  }

  _decryptBlock(block) {
    let A = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
    let B = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);
    let C = OpCodes.Pack32BE(block[8], block[9], block[10], block[11]);
    let D = OpCodes.Pack32BE(block[12], block[13], block[14], block[15]);
    let E = OpCodes.Pack32BE(block[16], block[17], block[18], block[19]);
    let F = OpCodes.Pack32BE(block[20], block[21], block[22], block[23]);
    let G = OpCodes.Pack32BE(block[24], block[25], block[26], block[27]);
    let H = OpCodes.Pack32BE(block[28], block[29], block[30], block[31]);

    // Reverse rounds with rotated register order (matches Botan implementation)
    for (let r = 0; r < 64; r += 8) {
      // Round 7 reverse (B,C,D,->E, F,G,H,->A)
      A = (A - this._Sigma0(B) - this._Maj(B, C, D)) >>> 0;
      E = (E - A) >>> 0;
      A = (A - this._Sigma1(F) - this._Ch(F, G, H) - this.RK[63-r]) >>> 0;

      // Round 6 reverse (C,D,E,->F, G,H,A,->B)
      B = (B - this._Sigma0(C) - this._Maj(C, D, E)) >>> 0;
      F = (F - B) >>> 0;
      B = (B - this._Sigma1(G) - this._Ch(G, H, A) - this.RK[62-r]) >>> 0;

      // Round 5 reverse (D,E,F,->G, H,A,B,->C)
      C = (C - this._Sigma0(D) - this._Maj(D, E, F)) >>> 0;
      G = (G - C) >>> 0;
      C = (C - this._Sigma1(H) - this._Ch(H, A, B) - this.RK[61-r]) >>> 0;

      // Round 4 reverse (E,F,G,->H, A,B,C,->D)
      D = (D - this._Sigma0(E) - this._Maj(E, F, G)) >>> 0;
      H = (H - D) >>> 0;
      D = (D - this._Sigma1(A) - this._Ch(A, B, C) - this.RK[60-r]) >>> 0;

      // Round 3 reverse (F,G,H,->A, B,C,D,->E)
      E = (E - this._Sigma0(F) - this._Maj(F, G, H)) >>> 0;
      A = (A - E) >>> 0;
      E = (E - this._Sigma1(B) - this._Ch(B, C, D) - this.RK[59-r]) >>> 0;

      // Round 2 reverse (G,H,A,->B, C,D,E,->F)
      F = (F - this._Sigma0(G) - this._Maj(G, H, A)) >>> 0;
      B = (B - F) >>> 0;
      F = (F - this._Sigma1(C) - this._Ch(C, D, E) - this.RK[58-r]) >>> 0;

      // Round 1 reverse (H,A,B,->C, D,E,F,->G)
      G = (G - this._Sigma0(H) - this._Maj(H, A, B)) >>> 0;
      C = (C - G) >>> 0;
      G = (G - this._Sigma1(D) - this._Ch(D, E, F) - this.RK[57-r]) >>> 0;

      // Round 0 reverse (A,B,C,->D, E,F,G,->H)
      H = (H - this._Sigma0(A) - this._Maj(A, B, C)) >>> 0;
      D = (D - H) >>> 0;
      H = (H - this._Sigma1(E) - this._Ch(E, F, G) - this.RK[56-r]) >>> 0;
    }

    return [
      ...OpCodes.Unpack32BE(A), ...OpCodes.Unpack32BE(B), ...OpCodes.Unpack32BE(C), ...OpCodes.Unpack32BE(D),
      ...OpCodes.Unpack32BE(E), ...OpCodes.Unpack32BE(F), ...OpCodes.Unpack32BE(G), ...OpCodes.Unpack32BE(H)
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

RegisterAlgorithm(new Shacal2());
