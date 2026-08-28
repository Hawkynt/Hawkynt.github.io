/*
 * Exponential-Golomb Coding Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Order-k exponential-Golomb coding, the universal integer code used for
 * syntax elements in the H.264/AVC and H.265/HEVC video standards (the ue(v)
 * descriptor of ITU-T H.264 section 9.1). This implementation uses order 0 and
 * codes each input byte as one value.
 *
 * Wire format (matches CompressionWorkbench's BB_ExpGolomb building block):
 *   [originalLength: 4 bytes little-endian][exp-Golomb bitstream]
 * Bits are packed most-significant-bit first and the final partial byte is
 * zero-padded. An empty input produces only the 4-byte header.
 *
 * Order-0 codeword for a non-negative value n: let m = floor(log2(n+1)); the
 * codeword is m zero bits followed by the (m+1)-bit binary representation of
 * (n+1), most-significant bit first.
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  // ===== PARAMETERS =====

  // Order of the exp-Golomb code. Order 0 is the ue(v) mapping of H.264/H.265.
  const ORDER = 0;

  // ===== BIT STREAM HELPERS (MSB-first) =====

  class MsbBitWriter {
    constructor() {
      this.bytes = [];
      this.buf = 0;
      this.nBits = 0;
    }

    writeBit(bit) {
      this.buf = OpCodes.Or32(OpCodes.Shl32(this.buf, 1), OpCodes.And32(bit, 1));
      this.nBits++;
      if (this.nBits === 8) {
        this.bytes.push(OpCodes.And32(this.buf, 0xFF));
        this.buf = 0;
        this.nBits = 0;
      }
    }

    flush() {
      if (this.nBits > 0) {
        this.buf = OpCodes.Shl32(this.buf, 8 - this.nBits);
        this.bytes.push(OpCodes.And32(this.buf, 0xFF));
        this.buf = 0;
        this.nBits = 0;
      }
      return this.bytes;
    }
  }

  class MsbBitReader {
    constructor(bytes, startByte) {
      this.bytes = bytes;
      this.bitPos = startByte * 8;
    }

    readBit() {
      const byteIndex = Math.floor(this.bitPos / 8);
      if (byteIndex >= this.bytes.length)
        throw new Error('Exp-Golomb: unexpected end of bitstream');
      const shift = 7 - (this.bitPos % 8);
      const bit = OpCodes.And32(OpCodes.Shr32(this.bytes[byteIndex], shift), 1);
      this.bitPos++;
      return bit;
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * ExpGolombCompression - Compression algorithm implementation
   * @class
   * @extends {CompressionAlgorithm}
   */
  class ExpGolombCompression extends CompressionAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Exp-Golomb";
      this.description = "Exponential-Golomb coding, the universal variable-length integer code used for syntax elements in the H.264/AVC and H.265/HEVC video standards. Each input byte is coded at order 0 as floor(log2(n+1)) zero bits followed by the binary representation of n+1, packed most-significant-bit first behind a 4-byte little-endian length header.";
      this.inventor = "Solomon W. Golomb";
      this.year = 1966;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Entropy Coding";
      this.securityStatus = null;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.US;

      // Documentation and references
      this.documentation = [
        new LinkItem("Wikipedia - Exponential-Golomb coding", "https://en.wikipedia.org/wiki/Exponential-Golomb_coding"),
        new LinkItem("ITU-T H.264 - Advanced video coding for generic audiovisual services", "https://www.itu.int/rec/T-REC-H.264"),
        new LinkItem("ITU-T H.265 - High efficiency video coding", "https://www.itu.int/rec/T-REC-H.265")
      ];

      this.references = [
        new LinkItem("Golomb, Run-length encodings (IEEE Trans. Inf. Theory, 1966)", "https://ieeexplore.ieee.org/document/1053907"),
        new LinkItem("Teuhola, A compression method for clustered bit-vectors (1978)", "https://www.sciencedirect.com/science/article/abs/pii/0020019078900216")
      ];

      // Test vectors - byte-exact against CompressionWorkbench's BB_ExpGolomb
      // building block. Expected outputs are given as hex.
      this.tests = [
        new TestCase(
          [],
          OpCodes.Hex8ToBytes("00000000"),
          "Empty input - only the 4-byte little-endian length header",
          "https://en.wikipedia.org/wiki/Exponential-Golomb_coding"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("A"),
          OpCodes.Hex8ToBytes("010000000210"),
          "Single byte 0x41 - six zero bits then the seven-bit value 66",
          "https://en.wikipedia.org/wiki/Exponential-Golomb_coding"
        ),
        new TestCase(
          (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = 0x61; return b; })(),
          OpCodes.Hex8ToBytes("0001000003101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c406203101880c4062"),
          "Long repetitive run - 256 copies of 0x61",
          "https://en.wikipedia.org/wiki/Exponential-Golomb_coding"
        ),
        new TestCase(
          (function() { const b = new Array(64); for (let i = 0; i < 64; ++i) b[i] = (i % 2) === 0 ? 0x61 : 0x62; return b; })(),
          OpCodes.Hex8ToBytes("40000000031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063031018c0c4063"),
          "Alternating two-byte pattern - 32 repetitions of 'ab'",
          "https://en.wikipedia.org/wiki/Exponential-Golomb_coding"
        ),
        new TestCase(
          OpCodes.Hex8ToBytes("d3b07a1c8f4e2b6905c1fd3846a70e92"),
          OpCodes.Hex8ToBytes("1000000001a802c40f61d012004f05806a300c201fc0e408e02a078093"),
          "Pseudo-random binary sample - 16 high-entropy bytes",
          "https://en.wikipedia.org/wiki/Exponential-Golomb_coding"
        ),
        new TestCase(
          OpCodes.AsciiToBytes("the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. the quick brown fox jumps over the lazy dog. "),
          OpCodes.Hex8ToBytes("b400000003a81a40cc0840e407603501900d80840c607303801e00de0840ce07003c82103581d80dc07103a02103801dc0cc07304207503481981081b40c407b03d02103281c00d00bc1081d40d206604207203b01a80c806c04206303981c00f006f04206703801e41081ac0ec06e03881d01081c00ee06603982103a81a40cc0840da06203d81e81081940e006805e0840ea06903302103901d80d406403602103181cc0e007803782103381c00f20840d607603701c40e80840e007703301cc1081d40d206604206d03101ec0f40840ca07003402f04207503481981081c80ec06a03201b010818c0e607003c01bc10819c0e007904206b03b01b80e207404207003b81980e60840ea06903302103681880f607a04206503801a0178210"),
          "ASCII text - 'the quick brown fox jumps over the lazy dog. ' repeated four times",
          "https://en.wikipedia.org/wiki/Exponential-Golomb_coding"
        ),
        new TestCase(
          (function() { const b = new Array(256); for (let i = 0; i < 256; ++i) b[i] = i; return b; })(),
          OpCodes.Hex8ToBytes("00010000a64298e2048a163068e1e100884826140a8582e180c868361c0e8783e080108220460901282604e0a01482a0560b01682e05e0c0188320660d01a83606e0e01c83a0760f01e83e07e0400208108086044022811808e048024812809604c026813809e05002881480a605402a81580ae05802c81680b605c02e81780be06003081880c606403281980ce06803481a80d606c03681b80de07003881c80e607403a81d80ee07803c81e80f607c03e81f80fe02000408082010602100428086010e0220044808a01160230046808e011e024004880920126025004a8096012e026004c809a0136027004e809e013e028005080a20146029005280a6014e02a005480aa015602b005680ae015e02c005880b2016602d005a80b6016e02e005c80ba017602f005e80be017e030006080c20186031006280c6018e032006480ca0196033006680ce019e034006880d201a6035006a80d601ae036006c80da01b6037006e80de01be038007080e201c6039007280e601ce03a007480ea01d603b007680ee01de03c007880f201e603d007a80f601ee03e007c80fa01f603f007e80fe01fe01000"),
          "All 256 byte values 0x00..0xFF - each coded once, worst case for expansion",
          "https://en.wikipedia.org/wiki/Exponential-Golomb_coding"
        )
      ];
    }

    CreateInstance(isInverse = false) {
      return new ExpGolombInstance(this, isInverse);
    }
  }

  class ExpGolombInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
    }


    Result() {
      const input = this.inputBuffer;
      this.inputBuffer = [];
      return this.isInverse ? this._decompress(input) : this._compress(input);
    }

    _compress(data) {
      const out = [
        OpCodes.And32(data.length, 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 8), 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 16), 0xFF),
        OpCodes.And32(OpCodes.Shr32(data.length, 24), 0xFF)
      ];

      if (data.length === 0) return out;

      const writer = new MsbBitWriter();
      for (let i = 0; i < data.length; i++) this._encodeValue(writer, data[i]);
      const bits = writer.flush();
      for (let i = 0; i < bits.length; i++) out.push(bits[i]);

      return out;
    }

    _decompress(data) {
      if (data.length < 4) return [];

      const originalSize = OpCodes.Pack32LE(data[0], data[1], data[2], data[3]);
      if (originalSize === 0) return [];

      const reader = new MsbBitReader(data, 4);
      const result = new Array(originalSize);
      for (let i = 0; i < originalSize; i++) result[i] = OpCodes.And32(this._decodeValue(reader), 0xFF);

      return result;
    }

    // Order-k codes (value + 2^k - 1) as an order-0 codeword. Order 0 leaves
    // the value unchanged.
    _encodeValue(writer, value) {
      const adjusted = value + OpCodes.Shl32(1, ORDER) - 1;
      const n1 = adjusted + 1;

      let bits = 0;
      let temp = n1;
      while (temp > 1) { bits++; temp = Math.floor(temp / 2); }

      for (let i = 0; i < bits; i++) writer.writeBit(0);
      for (let i = bits; i >= 0; i--) writer.writeBit(OpCodes.And32(OpCodes.Shr32(n1, i), 1));
    }

    _decodeValue(reader) {
      let zeros = 0;
      while (reader.readBit() === 0) zeros++;

      // The leading one bit was already consumed by the loop above.
      let value = 1;
      for (let i = 0; i < zeros; i++) value = OpCodes.Or32(OpCodes.Shl32(value, 1), reader.readBit());

      const adjusted = value - 1;
      return adjusted - (OpCodes.Shl32(1, ORDER) - 1);
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ExpGolombCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ExpGolombCompression, ExpGolombInstance };
}));
