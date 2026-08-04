/*
 * Shrink (ZIP Method 1) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Shrink is PKWARE's ZIP "Shrinking" method: dynamic Lempel-Ziv-Welch coding
 * with variable code width (9 to 13 bits, controlled by the encoder rather
 * than grown automatically) and "partial clearing" of the dictionary instead
 * of a full reset. Two reserved control sequences appear in the code stream:
 * code 256 followed by code 1 tells the decoder to widen subsequent codes by
 * one bit, and code 256 followed by code 2 tells the decoder to scan the
 * dictionary and free every entry that is not currently a prefix of another
 * (a "leaf"), reusing the lowest freed codes first.
 *
 * Reference:
 *   PKWARE, Inc., ".ZIP File Format Specification" (APPNOTE.TXT), section
 *   describing compression method 1 "Shrinking". See also T. A. Welch,
 *   "A Technique for High-Performance Data Compression", IEEE Computer,
 *   Vol. 17, No. 6, June 1984 (the underlying LZW algorithm).
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

  // ===== ALGORITHM IMPLEMENTATION =====

  const CODE_CONTROL = 256;
  const CTRL_INCREASE_WIDTH = 1;
  const CTRL_PARTIAL_CLEAR = 2;
  const MIN_WIDTH = 9;
  const MAX_WIDTH = 13;
  const MAX_CODE = 8191; // 2^13 - 1

  // ----- Bit-level stream helpers (MSB-first) -----

  class BitWriter {
    constructor() {
      this.bytes = [];
      this.cur = 0;
      this.nbits = 0;
    }

    writeBits(value, width) {
      for (let i = width - 1; i >= 0; i--) {
        const bit = OpCodes.And32(OpCodes.Shr32(value, i), 1);
        this.cur = OpCodes.Or32(OpCodes.Shl32(this.cur, 1), bit);
        this.nbits++;
        if (this.nbits === 8) {
          this.bytes.push(OpCodes.ToByte(this.cur));
          this.cur = 0;
          this.nbits = 0;
        }
      }
    }

    finish() {
      if (this.nbits > 0) {
        this.cur = OpCodes.Shl32(this.cur, 8 - this.nbits);
        this.bytes.push(OpCodes.ToByte(this.cur));
        this.cur = 0;
        this.nbits = 0;
      }
      return this.bytes;
    }
  }

  class BitReader {
    constructor(bytes) {
      this.bytes = bytes;
      this.pos = 0; // bit position
    }

    readBits(width) {
      let value = 0;
      for (let i = 0; i < width; i++) {
        const byteIndex = Math.floor(this.pos / 8);
        const bitIndex = 7 - (this.pos % 8);
        const byteVal = byteIndex < this.bytes.length ? this.bytes[byteIndex] : 0;
        const bit = OpCodes.And32(OpCodes.Shr32(byteVal, bitIndex), 1);
        value = OpCodes.Or32(OpCodes.Shl32(value, 1), bit);
        this.pos++;
      }
      return value;
    }
  }

  /**
 * ShrinkCompression - PKZIP "Shrinking" (LZW with partial clearing) algorithm
 * @class
 * @extends {CompressionAlgorithm}
 */

  class ShrinkCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Shrink";
        this.description = "PKZIP method 1 (Shrinking): dynamic LZW coding with encoder-controlled variable code width (9-13 bits) and partial dictionary clearing, which frees only leaf (unreferenced) entries instead of resetting the whole table.";
        this.inventor = "PKWARE, Inc. (based on Terry Welch's LZW)";
        this.year = 1989;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Dictionary (LZW)";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem(".ZIP File Format Specification (APPNOTE.TXT)", "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT"),
          new LinkItem("ZIP (file format) - Wikipedia (Shrinking method)", "https://en.wikipedia.org/wiki/ZIP_(file_format)"),
          new LinkItem("A Technique for High-Performance Data Compression (Welch, 1984)", "https://ieeexplore.ieee.org/document/1659158")
        ];

        this.references = [
          new LinkItem("Info-ZIP unshrink.c (historical decoder notes)", "https://github.com/LuaDist/zziplib"),
          new LinkItem("Lempel-Ziv-Welch - Wikipedia", "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch")
        ];

        // Test vectors - self-computed round-trip verification vectors produced by
        // this implementation (the exact code stream is implementation-defined;
        // there is no publicly documented byte-exact PKZIP Shrink reference stream
        // for arbitrary short inputs). Structure and control codes follow APPNOTE.TXT.
        this.tests = [
          {
            text: "Empty input",
            uri: "https://en.wikipedia.org/wiki/Boundary_condition",
            input: [],
            expected: []
          },
          {
            text: "Repetitive input - 'AAAAAAAAAA'",
            uri: "https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT",
            input: OpCodes.AsciiToBytes("AAAAAAAAAA"),
            expected: [0,0,0,10, 32,192,96,80,48]
          },
          {
            text: "Text sample - 'TOBEORNOTTOBEORTOBEORNOT'",
            uri: "https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch",
            input: OpCodes.AsciiToBytes("TOBEORNOTTOBEORTOBEORNOT"),
            expected: [0,0,0,24, 42,19,200,68,82,121,72,156,79,42,64,96,112,88,84,18,13,8]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new ShrinkInstance(this, isInverse);
      }
    }

    class ShrinkInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      }

      Result() {
        if (this.inputBuffer.length === 0) return [];

        const result = this.isInverse ? this._decompress(this.inputBuffer) : this._compress(this.inputBuffer);
        this.inputBuffer = [];
        return result;
      }

      // ----- Shared dictionary state management -----

      _initState() {
        const state = {
          codeWidth: MIN_WIDTH,
          nextCode: 257,
          freeList: [],
          prefix: new Array(MAX_CODE + 1).fill(-1),
          char: new Array(MAX_CODE + 1).fill(0),
          childCount: new Array(MAX_CODE + 1).fill(0),
          inUse: new Array(MAX_CODE + 1).fill(false),
          keyOfCode: new Array(MAX_CODE + 1).fill(null), // encoder-only reverse lookup
          dictMap: null // encoder-only forward lookup ("prefix,char" -> code)
        };
        for (let i = 0; i < 256; i++) {
          state.char[i] = i;
          state.inUse[i] = true;
        }
        return state;
      }

      _maxForWidth(width) {
        return Math.pow(2, width) - 1;
      }

      _allocateCode(state) {
        if (state.freeList.length > 0) return state.freeList.shift();
        const code = state.nextCode;
        state.nextCode++;
        return code;
      }

      _hasRoom(state) {
        return state.nextCode <= this._maxForWidth(state.codeWidth) || state.freeList.length > 0;
      }

      _partialClear(state) {
        const freed = [];
        for (let code = 257; code < state.nextCode; code++) {
          if (state.inUse[code] && state.childCount[code] === 0) freed.push(code);
        }
        for (const code of freed) {
          state.inUse[code] = false;
          const parent = state.prefix[code];
          if (parent >= 0) state.childCount[parent] = state.childCount[parent] - 1;
          if (state.dictMap && state.keyOfCode[code] !== null) {
            state.dictMap.delete(state.keyOfCode[code]);
            state.keyOfCode[code] = null;
          }
          state.freeList.push(code);
        }
        state.freeList.sort((a, b) => a - b);
        return freed.length > 0;
      }

      // ----- Compression -----

      _compress(data) {
        const state = this._initState();
        state.dictMap = new Map();

        const writer = new BitWriter();

        const addEntry = (prefixCode, charVal) => {
          if (!this._hasRoom(state)) {
            if (state.codeWidth < MAX_WIDTH) {
              writer.writeBits(CODE_CONTROL, state.codeWidth);
              writer.writeBits(CTRL_INCREASE_WIDTH, state.codeWidth);
              state.codeWidth++;
            } else {
              writer.writeBits(CODE_CONTROL, state.codeWidth);
              writer.writeBits(CTRL_PARTIAL_CLEAR, state.codeWidth);
              this._partialClear(state);
            }
          }
          if (!this._hasRoom(state)) return; // dictionary saturated, skip growth

          const code = this._allocateCode(state);
          state.prefix[code] = prefixCode;
          state.char[code] = charVal;
          state.inUse[code] = true;
          state.childCount[prefixCode] = state.childCount[prefixCode] + 1;
          const key = prefixCode + ',' + charVal;
          state.dictMap.set(key, code);
          state.keyOfCode[code] = key;
        };

        let w = data[0];
        for (let i = 1; i < data.length; i++) {
          const c = data[i];
          const key = w + ',' + c;
          if (state.dictMap.has(key)) {
            w = state.dictMap.get(key);
            continue;
          }
          writer.writeBits(w, state.codeWidth);
          addEntry(w, c);
          w = c;
        }
        writer.writeBits(w, state.codeWidth);

        const output = [];
        { const _src = OpCodes.Unpack32BE(data.length); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
        { const _src = writer.finish(); for (let _i = 0; _i < _src.length; _i++) output.push(_src[_i]); }
        return output;
      }

      // ----- Decompression -----

      _decompress(data) {
        if (data.length < 4) return [];

        const originalLength = OpCodes.Pack32BE(data[0], data[1], data[2], data[3]);
        if (originalLength === 0) return [];

        const state = this._initState();

        const reader = new BitReader(data.slice(4));

        const stringFor = (code) => {
          const chain = [];
          let c = code;
          while (c !== -1) {
            chain.push(state.char[c]);
            c = state.prefix[c];
          }
          chain.reverse();
          return chain;
        };

        // The encoder writes any pending control-code pair (width increase or
        // partial clear) immediately after the code that made the dictionary
        // full - i.e. strictly *before* the next normal code in the stream.
        // The decoder must therefore resolve room for a pending insertion
        // before reading the next normal code, and only perform the actual
        // table insertion afterwards, once the new entry's character is known.
        const ensureRoomForPendingInsert = () => {
          if (this._hasRoom(state)) return;
          const sentinel = reader.readBits(state.codeWidth);
          const ctrl = reader.readBits(state.codeWidth);
          if (sentinel === CODE_CONTROL && ctrl === CTRL_INCREASE_WIDTH && state.codeWidth < MAX_WIDTH) {
            state.codeWidth++;
          } else if (sentinel === CODE_CONTROL && ctrl === CTRL_PARTIAL_CLEAR) {
            this._partialClear(state);
          }
        };

        const commitPendingInsert = (prefixCode, charVal) => {
          if (!this._hasRoom(state)) return; // saturated even after clearing; matches encoder skip
          const code = this._allocateCode(state);
          state.prefix[code] = prefixCode;
          state.char[code] = charVal;
          state.inUse[code] = true;
          state.childCount[prefixCode] = state.childCount[prefixCode] + 1;
        };

        const out = [];
        let prevCode = -1;
        let prevString = null;
        let pendingInsert = false;

        while (out.length < originalLength) {
          if (pendingInsert) ensureRoomForPendingInsert();

          const code = reader.readBits(state.codeWidth);
          const predictedNextCode = state.freeList.length > 0 ? state.freeList[0] : state.nextCode;

          let currentString;
          if (state.inUse[code]) {
            currentString = stringFor(code);
          } else if (prevString !== null && code === predictedNextCode) {
            // Classic LZW special case: code not yet in the table refers to
            // (previous string + previous string's first symbol).
            currentString = prevString.concat([prevString[0]]);
          } else {
            break;
          }

          for (let _i = 0; _i < currentString.length; _i++) out.push(currentString[_i]);

          if (pendingInsert) {
            commitPendingInsert(prevCode, currentString[0]);
          }

          prevCode = code;
          prevString = currentString;
          pendingInsert = true;
        }

        return out.slice(0, originalLength);
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new ShrinkCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ShrinkCompression, ShrinkInstance };
}));
