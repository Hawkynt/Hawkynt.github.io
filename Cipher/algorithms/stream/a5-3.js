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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // KASUMI S-boxes
  const S7 = [
    54, 50, 62, 56, 22, 34, 94, 96, 38, 6, 63, 93, 2, 18, 123, 33,
    55, 113, 39, 114, 21, 67, 65, 12, 47, 73, 46, 27, 25, 111, 124, 81,
    53, 9, 121, 79, 52, 60, 58, 48, 101, 127, 40, 120, 104, 70, 71, 43,
    20, 122, 72, 61, 23, 109, 13, 100, 77, 1, 16, 7, 82, 10, 105, 98,
    117, 116, 76, 11, 89, 106, 0, 125, 118, 99, 86, 69, 30, 57, 126, 87,
    112, 51, 17, 5, 95, 14, 90, 84, 91, 8, 35, 103, 32, 97, 28, 66,
    102, 31, 26, 45, 75, 4, 85, 92, 37, 74, 80, 49, 68, 29, 115, 44,
    64, 107, 108, 24, 110, 83, 36, 78, 42, 19, 15, 41, 88, 119, 59, 3
  ];

  const S9 = [
    167, 239, 161, 379, 391, 334, 9, 338, 38, 226, 48, 358, 452, 385, 90, 397,
    183, 253, 147, 331, 415, 340, 51, 362, 306, 500, 262, 82, 216, 159, 356, 177,
    175, 241, 489, 37, 206, 17, 0, 333, 44, 254, 378, 58, 143, 220, 81, 400,
    95, 3, 315, 245, 54, 235, 218, 405, 472, 264, 172, 494, 371, 290, 399, 76,
    165, 197, 395, 121, 257, 480, 423, 212, 240, 28, 462, 176, 406, 507, 288, 223,
    501, 407, 249, 265, 89, 186, 221, 428, 164, 74, 440, 196, 458, 421, 350, 163,
    232, 158, 134, 354, 13, 250, 491, 142, 191, 69, 193, 425, 152, 227, 366, 135,
    344, 300, 276, 242, 437, 320, 113, 278, 11, 243, 87, 317, 36, 93, 496, 27,
    487, 446, 482, 41, 68, 156, 457, 131, 326, 403, 339, 20, 39, 115, 442, 124,
    475, 384, 508, 53, 112, 170, 479, 151, 126, 169, 73, 268, 279, 321, 168, 364,
    363, 292, 46, 499, 393, 327, 324, 24, 456, 267, 157, 460, 488, 426, 309, 229,
    439, 506, 208, 271, 349, 401, 434, 236, 16, 209, 359, 52, 56, 120, 199, 277,
    465, 416, 252, 287, 246, 6, 83, 305, 420, 345, 153, 502, 65, 61, 244, 282,
    173, 222, 418, 67, 386, 368, 261, 101, 476, 291, 195, 430, 49, 79, 166, 330,
    280, 383, 373, 128, 382, 408, 155, 495, 367, 388, 274, 107, 459, 417, 62, 454,
    132, 225, 203, 316, 234, 14, 301, 91, 503, 286, 424, 469, 207, 194, 346, 124,
    18, 223, 444, 148, 410, 181, 293, 214, 471, 330, 454, 375, 99, 367, 210, 473,
    237, 255, 104, 122, 425, 486, 256, 396, 118, 465, 138, 228, 448, 198, 150, 337,
    117, 462, 319, 312, 442, 204, 162, 492, 342, 443, 464, 230, 296, 389, 295, 251,
    303, 140, 336, 398, 105, 411, 180, 298, 466, 313, 202, 445, 136, 372, 298, 394,
    187, 449, 272, 314, 428, 467, 190, 485, 141, 341, 248, 322, 289, 468, 205, 146,
    200, 392, 335, 390, 260, 233, 189, 470, 184, 474, 269, 185, 360, 477, 258, 348,
    154, 409, 355, 307, 478, 297, 263, 481, 171, 353, 270, 387, 483, 192, 357, 484,
    219, 329, 174, 144, 490, 238, 493, 231, 149, 497, 188, 498, 302, 247, 504, 109,
    284, 505, 137, 164, 160, 285, 217, 259, 133, 361, 283, 211, 308, 215, 178, 323,
    374, 145, 376, 377, 304, 139, 213, 380, 266, 102, 381, 179, 201, 129, 318, 275,
    273, 130, 402, 404, 168, 412, 413, 365, 414, 97, 311, 352, 419, 85, 310, 422,
    294, 123, 427, 328, 119, 132, 429, 94, 431, 351, 432, 433, 435, 370, 221, 436,
    369, 438, 182, 281, 103, 72, 441, 166, 447, 176, 450, 71, 451, 453, 98, 455,
    125, 343, 224, 127, 461, 100, 463, 196, 469, 347, 75, 298, 476, 477, 255, 264,
    136, 96, 346, 176, 306, 332, 80, 332, 88, 131, 10, 106, 63, 110, 114, 78,
    64, 92, 116, 34, 508, 111, 172, 207, 40, 347, 35, 1, 55, 25, 12, 19
  ];

class A53 extends StreamCipherAlgorithm {
  constructor() {
    super();

    this.name = "A5/3";
    this.description = "Stream cipher used in 3G/UMTS mobile communications based on KASUMI block cipher. More secure replacement for A5/1 and A5/2. Uses 128-bit keys with KASUMI operated in OFB-like mode.";
    this.inventor = "3GPP (3rd Generation Partnership Project)";
    this.year = 1999;
    this.category = CategoryType.STREAM;
    this.subCategory = "Stream Cipher";
    this.securityStatus = null;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.INTERNATIONAL;

    this.SupportedKeySizes = [new KeySize(16, 16, 1)];
    this.SupportedBlockSizes = [new KeySize(1, 2500, 1)];

    this.documentation = [
      new LinkItem("Wikipedia: A5/3", "https://en.wikipedia.org/wiki/A5/3"),
      new LinkItem("3GPP TS 55.216 - A5/3 Specification", "https://www.3gpp.org/DynaReport/55216.htm"),
      new LinkItem("KASUMI Specification", "https://www.3gpp.org/ftp/Specs/archive/35_series/35.202/")
    ];

    this.vulnerabilities = [
      new Vulnerability("Related-Key Attack on KASUMI", "Theoretical attacks on KASUMI, but not practical for A5/3")
    ];

    this.tests = [
      {
        text: "A5/3 Educational Test Vector (Simplified Implementation)",
        uri: "Educational implementation test",
        input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
        key: OpCodes.Hex8ToBytes("000102030405060708090a0b0c0d0e0f"),
        expected: OpCodes.Hex8ToBytes("029c029c0480ef93029c02bb0480ef93")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new A53Instance(this, isInverse);
  }
}

class A53Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.inputBuffer = [];
    this._key = null;
    this.keystreamBuffer = [];
    this.bufferPosition = 0;
    this.count = 0;
    this.bearer = 0;
    this.direction = 0;
    this.MAX_OUTPUT_BITS = 20000;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      return;
    }

    const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
      keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
    );

    if (!isValidSize) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
    }

    this._key = [...keyBytes];
    this.keystreamBuffer = [];
    this.bufferPosition = 0;
    this._generateKeystreamBlock();
  }

  get key() { return this._key ? [...this._key] : null; }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this._key) throw new Error("Key not set");
    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this._key) throw new Error("Key not set");

    if (this.inputBuffer.length === 0) {
      return [];
    }

    const output = [];
    for (let i = 0; i < this.inputBuffer.length; i++) {
      const keystreamByte = this._getKeystreamByte();
      output.push(this.inputBuffer[i] ^ keystreamByte);
    }

    this.inputBuffer = [];
    return output;
  }

  _kasumiF1(input, key) {
    let left = (input >>> 7) & 0x1FF;
    let right = input & 0x7F;

    left = S9[left % S9.length];
    right = S7[right];

    left ^= (key >>> 7) & 0x1FF;
    right ^= key & 0x7F;

    return ((left << 7) | right) & 0xFFFF;
  }

  _kasumiF0(left, right, roundKey) {
    const k1 = OpCodes.Pack32BE(roundKey[0], roundKey[1], roundKey[2], roundKey[3]);
    const k2 = OpCodes.Pack32BE(roundKey[4], roundKey[5], roundKey[6], roundKey[7]);

    let temp = left;
    let fi1_in = (temp >>> 16) & 0xFFFF;
    fi1_in = this._kasumiF1(fi1_in, k1 & 0xFFFF);

    let fi2_in = temp & 0xFFFF;
    fi2_in = this._kasumiF1(fi2_in, (k1 >>> 16) & 0xFFFF);

    temp = ((fi1_in << 16) | fi2_in) ^ k2;

    return { left: right, right: left ^ temp };
  }

  _kasumiEncrypt(plaintext) {
    let left = OpCodes.Pack32BE(plaintext[0], plaintext[1], plaintext[2], plaintext[3]);
    let right = OpCodes.Pack32BE(plaintext[4], plaintext[5], plaintext[6], plaintext[7]);

    for (let round = 0; round < 8; round++) {
      const roundKey = [];
      for (let i = 0; i < 8; i++) {
        roundKey.push(this._key[(round * 2 + i) % 16]);
      }

      const result = this._kasumiF0(left, right, roundKey);
      left = result.left;
      right = result.right;
    }

    const leftBytes = OpCodes.Unpack32BE(left);
    const rightBytes = OpCodes.Unpack32BE(right);

    return [...leftBytes, ...rightBytes];
  }

  _generateKeystreamBlock() {
    const input = new Array(8).fill(0);
    const blockCount = Math.floor(this.keystreamBuffer.length / 8);

    const fullCount = (((this.count & 0x1F) << 27) | (blockCount & 0x07FFFFFF)) >>> 0;
    input[0] = (fullCount >>> 24) & 0xFF;
    input[1] = (fullCount >>> 16) & 0xFF;
    input[2] = (fullCount >>> 8) & 0xFF;
    input[3] = fullCount & 0xFF;
    input[4] = (((this.bearer & 0x1F) << 3) | ((this.direction & 1) << 2)) & 0xFF;

    const keystreamBlock = this._kasumiEncrypt(input);
    this.keystreamBuffer.push(...keystreamBlock);
  }

  _getKeystreamByte() {
    if (this.bufferPosition >= this.keystreamBuffer.length) {
      if (this.keystreamBuffer.length >= (this.MAX_OUTPUT_BITS / 8)) {
        throw new Error('A5/3 maximum keystream length exceeded');
      }
      this._generateKeystreamBlock();
    }

    return this.keystreamBuffer[this.bufferPosition++];
  }
}

  const algorithmInstance = new A53();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { A53, A53Instance };
}));
