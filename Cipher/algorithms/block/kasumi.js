/* Kasumi Block Cipher
 * 3GPP Confidentiality and Integrity Algorithms
 * (c)2006-2025 Hawkynt
 *
 * 64-bit block cipher with 128-bit key
 * Used in 3GPP mobile networks (UMTS/LTE)
 * Based on MISTY1 structure
 */

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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  class Kasumi extends BlockCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Kasumi";
      this.description = "3GPP confidentiality and integrity algorithm based on MISTY1 structure. 64-bit block cipher with 128-bit key used in UMTS/LTE mobile networks for encryption and authentication.";
      this.inventor = "3GPP Task Force (based on MISTY1 by Mitsubishi)";
      this.year = 1999;
      this.category = CategoryType.BLOCK;
      this.subCategory = "Block Cipher";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.INTL;

      // Algorithm capabilities
      this.SupportedKeySizes = [new KeySize(16, 16, 1)];  // 128-bit only
      this.SupportedBlockSizes = [new KeySize(8, 8, 1)]; // 64-bit only

      // Documentation
      this.documentation = [
        new LinkItem("3GPP TS 35.202 - KASUMI Specification", "https://www.tech-invite.com/3m35/tinv-3gpp-35-202.html"),
        new LinkItem("3GPP Security Algorithms", "https://www.arib.or.jp/english/html/overview/doc/STD-T63V9_21/5_Appendix/Rel4/35/35201-410.pdf")
      ];

      this.references = [
        new LinkItem("LibTomCrypt Implementation", "https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/kasumi.c"),
        new LinkItem("Crypto++ Implementation", "https://www.cryptopp.com/")
      ];

      // Test vectors from LibTomCrypt and crypto3 library
      this.tests = [
        {
          text: "Crypto3 Library Test Vector",
          uri: "https://github.com/NilFoundation/crypto3/blob/master/libs/block/test/kasumi.cpp",
          input: OpCodes.Hex8ToBytes("ea024714ad5c4d84"),
          key: OpCodes.Hex8ToBytes("2bd6459f82c5b300952c49104881ff48"),
          expected: OpCodes.Hex8ToBytes("df1f9b251c0bf45f")
        },
        {
          text: "LibTomCrypt Test Vector #1 - Single bit set in key (MSB)",
          uri: "https://github.com/libtom/libtomcrypt/blob/develop/src/ciphers/kasumi.c",
          input: OpCodes.Hex8ToBytes("0000000000000000"),
          key: OpCodes.Hex8ToBytes("80000000000000000000000000000000"),
          expected: OpCodes.Hex8ToBytes("4b58a771afc7e5e8")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new KasumiInstance(this, isInverse);
    }
  }

  class KasumiInstance extends IBlockCipherInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;
      this.BlockSize = 8;
      this.KeySize = 0;

      // Subkey storage
      this.KLi1 = null;
      this.KLi2 = null;
      this.KOi1 = null;
      this.KOi2 = null;
      this.KOi3 = null;
      this.KIi1 = null;
      this.KIi2 = null;
      this.KIi3 = null;

      // S-boxes
      this.S7 = new Uint16Array([
        54, 50, 62, 56, 22, 34, 94, 96, 38, 6, 63, 93, 2, 18,123, 33,
        55,113, 39,114, 21, 67, 65, 12, 47, 73, 46, 27, 25,111,124, 81,
        53, 9,121, 79, 52, 60, 58, 48,101,127, 40,120,104, 70, 71, 43,
        20,122, 72, 61, 23,109, 13,100, 77, 1, 16, 7, 82, 10,105, 98,
        117,116, 76, 11, 89,106, 0,125,118, 99, 86, 69, 30, 57,126, 87,
        112, 51, 17, 5, 95, 14, 90, 84, 91, 8, 35,103, 32, 97, 28, 66,
        102, 31, 26, 45, 75, 4, 85, 92, 37, 74, 80, 49, 68, 29,115, 44,
        64,107,108, 24,110, 83, 36, 78, 42, 19, 15, 41, 88,119, 59, 3
      ]);

      this.S9 = new Uint16Array([
        167,239,161,379,391,334, 9,338, 38,226, 48,358,452,385, 90,397,
        183,253,147,331,415,340, 51,362,306,500,262, 82,216,159,356,177,
        175,241,489, 37,206, 17, 0,333, 44,254,378, 58,143,220, 81,400,
         95, 3,315,245, 54,235,218,405,472,264,172,494,371,290,399, 76,
        165,197,395,121,257,480,423,212,240, 28,462,176,406,507,288,223,
        501,407,249,265, 89,186,221,428,164, 74,440,196,458,421,350,163,
        232,158,134,354, 13,250,491,142,191, 69,193,425,152,227,366,135,
        344,300,276,242,437,320,113,278, 11,243, 87,317, 36, 93,496, 27,
        487,446,482, 41, 68,156,457,131,326,403,339, 20, 39,115,442,124,
        475,384,508, 53,112,170,479,151,126,169, 73,268,279,321,168,364,
        363,292, 46,499,393,327,324, 24,456,267,157,460,488,426,309,229,
        439,506,208,271,349,401,434,236, 16,209,359, 52, 56,120,199,277,
        465,416,252,287,246, 6, 83,305,420,345,153,502, 65, 61,244,282,
        173,222,418, 67,386,368,261,101,476,291,195,430, 49, 79,166,330,
        280,383,373,128,382,408,155,495,367,388,274,107,459,417, 62,454,
        132,225,203,316,234, 14,301, 91,503,286,424,211,347,307,140,374,
         35,103,125,427, 19,214,453,146,498,314,444,230,256,329,198,285,
         50,116, 78,410, 10,205,510,171,231, 45,139,467, 29, 86,505, 32,
         72, 26,342,150,313,490,431,238,411,325,149,473, 40,119,174,355,
        185,233,389, 71,448,273,372, 55,110,178,322, 12,469,392,369,190,
          1,109,375,137,181, 88, 75,308,260,484, 98,272,370,275,412,111,
        336,318, 4,504,492,259,304, 77,337,435, 21,357,303,332,483, 18,
         47, 85, 25,497,474,289,100,269,296,478,270,106, 31,104,433, 84,
        414,486,394, 96, 99,154,511,148,413,361,409,255,162,215,302,201,
        266,351,343,144,441,365,108,298,251, 34,182,509,138,210,335,133,
        311,352,328,141,396,346,123,319,450,281,429,228,443,481, 92,404,
        485,422,248,297, 23,213,130,466, 22,217,283, 70,294,360,419,127,
        312,377, 7,468,194, 2,117,295,463,258,224,447,247,187, 80,398,
        284,353,105,390,299,471,470,184, 57,200,348, 63,204,188, 33,451,
         97, 30,310,219, 94,160,129,493, 64,179,263,102,189,207,114,402,
        438,477,387,122,192, 42,381, 5,145,118,180,449,293,323,136,380,
         43, 66, 60,455,341,445,202,432, 8,237, 15,376,436,464, 59,461
      ]);
    }

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.KLi1 = null;
        this.KLi2 = null;
        this.KOi1 = null;
        this.KOi2 = null;
        this.KOi3 = null;
        this.KIi1 = null;
        this.KIi2 = null;
        this.KIi3 = null;
        return;
      }

      if (keyBytes.length !== 16) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes (must be 16)`);
      }

      this._key = [...keyBytes];
      this.KeySize = 16;
      this._keySchedule();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    _keySchedule() {
      const C = Object.freeze([0x0123, 0x4567, 0x89AB, 0xCDEF, 0xFEDC, 0xBA98, 0x7654, 0x3210]);
      const ukey = new Array(8);
      const Kprime = new Array(8);

      // Convert key bytes to 16-bit words (big-endian)
      for (let n = 0; n < 8; ++n) {
        ukey[n] = OpCodes.Pack16BE(this._key[2 * n], this._key[2 * n + 1]);
      }

      // Build K' keys
      for (let n = 0; n < 8; ++n) {
        Kprime[n] = ukey[n] ^ C[n];
      }

      // Generate round subkeys
      this.KLi1 = new Array(8);
      this.KLi2 = new Array(8);
      this.KOi1 = new Array(8);
      this.KOi2 = new Array(8);
      this.KOi3 = new Array(8);
      this.KIi1 = new Array(8);
      this.KIi2 = new Array(8);
      this.KIi3 = new Array(8);

      for (let n = 0; n < 8; ++n) {
        this.KLi1[n] = OpCodes.RotL16(ukey[n], 1);
        this.KLi2[n] = Kprime[(n + 2) & 0x7];
        this.KOi1[n] = OpCodes.RotL16(ukey[(n + 1) & 0x7], 5);
        this.KOi2[n] = OpCodes.RotL16(ukey[(n + 5) & 0x7], 8);
        this.KOi3[n] = OpCodes.RotL16(ukey[(n + 6) & 0x7], 13);
        this.KIi1[n] = Kprime[(n + 4) & 0x7];
        this.KIi2[n] = Kprime[(n + 3) & 0x7];
        this.KIi3[n] = Kprime[(n + 7) & 0x7];
      }
    }

    _FI(inVal, subkey) {
      // Split 16-bit input into 9-bit and 7-bit parts
      let nine = (inVal >>> 7) & 0x1FF;
      let seven = inVal & 0x7F;

      // Run S-box operations
      nine = this.S9[nine] ^ seven;
      seven = this.S7[seven] ^ (nine & 0x7F);
      seven ^= (subkey >>> 9);
      nine ^= (subkey & 0x1FF);
      nine = this.S9[nine] ^ seven;
      seven = this.S7[seven] ^ (nine & 0x7F);

      return ((seven << 9) + nine) & 0xFFFF;
    }

    _FO(inVal, roundNo) {
      // Split 32-bit input into two 16-bit words
      let left = (inVal >>> 16) & 0xFFFF;
      let right = inVal & 0xFFFF;

      // Apply three iterations
      left ^= this.KOi1[roundNo];
      left = this._FI(left, this.KIi1[roundNo]);
      left ^= right;

      right ^= this.KOi2[roundNo];
      right = this._FI(right, this.KIi2[roundNo]);
      right ^= left;

      left ^= this.KOi3[roundNo];
      left = this._FI(left, this.KIi3[roundNo]);
      left ^= right;

      return (((right << 16) >>> 0) + left) >>> 0;
    }

    _FL(inVal, roundNo) {
      // Split into left and right halves
      let l = (inVal >>> 16) & 0xFFFF;
      let r = inVal & 0xFFFF;

      // Linear operations
      const a = (l & this.KLi1[roundNo]) & 0xFFFF;
      r ^= OpCodes.RotL16(a, 1);
      const b = (r | this.KLi2[roundNo]) & 0xFFFF;
      l ^= OpCodes.RotL16(b, 1);

      return (((l << 16) >>> 0) + r) >>> 0;
    }

    _encryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("Invalid block size");
      }

      // Load block as two 32-bit words
      let left = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let right = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

      // 8 rounds (4 iterations with FL-FO pairs)
      for (let n = 0; n <= 7; ) {
        let temp = this._FL(left, n);
        temp = this._FO(temp, n++);
        right ^= temp;

        temp = this._FO(right, n);
        temp = this._FL(temp, n++);
        left ^= temp;
      }

      // Store result
      return [
        ...OpCodes.Unpack32BE(left),
        ...OpCodes.Unpack32BE(right)
      ];
    }

    _decryptBlock(block) {
      if (block.length !== 8) {
        throw new Error("Invalid block size");
      }

      // Load block as two 32-bit words
      let left = OpCodes.Pack32BE(block[0], block[1], block[2], block[3]);
      let right = OpCodes.Pack32BE(block[4], block[5], block[6], block[7]);

      // 8 rounds in reverse (4 iterations with FL-FO pairs)
      for (let n = 7; n >= 0; ) {
        let temp = this._FO(right, n);
        temp = this._FL(temp, n--);
        left ^= temp;

        temp = this._FL(left, n);
        temp = this._FO(temp, n--);
        right ^= temp;
      }

      // Store result
      return [
        ...OpCodes.Unpack32BE(left),
        ...OpCodes.Unpack32BE(right)
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
        const processedBlock = this.isInverse
          ? this._decryptBlock(block)
          : this._encryptBlock(block);
        output.push(...processedBlock);
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // Register algorithm
  RegisterAlgorithm(new Kasumi());

}));
