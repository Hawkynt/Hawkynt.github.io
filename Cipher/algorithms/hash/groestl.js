
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
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize,
          BlockAbsorber, MerkleDamgardBlocks } = AlgorithmFramework;

  // Grøstl specification section 3.2: the state is always 8 rows tall; only
  // the number of columns changes between the 512-bit and 1024-bit states.
  const ROWS = 8;

  // MixBytes multiplies each column by the circulant matrix
  // circ(02,02,03,04,05,03,05,07) over GF(2^8) with the AES polynomial.
  // This is not the AES MixColumns matrix.
  const MIX_COEFFICIENTS = Object.freeze([0x02, 0x02, 0x03, 0x04, 0x05, 0x03, 0x05, 0x07]);

  // ShiftBytes rotates row i to the left by sigma[i]. P and Q differ, and so
  // do the 512-bit and 1024-bit states.
  const SHIFTS_P_512 = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7]);
  const SHIFTS_Q_512 = Object.freeze([1, 3, 5, 7, 0, 2, 4, 6]);
  const SHIFTS_P_1024 = Object.freeze([0, 1, 2, 3, 4, 5, 6, 11]);
  const SHIFTS_Q_1024 = Object.freeze([1, 3, 5, 11, 0, 2, 4, 6]);

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * Groestl - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class Groestl extends HashFunctionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "Grøstl";
        this.description = "Grøstl is a cryptographic hash function designed as a SHA-3 candidate. Features wide-pipe construction with AES-like design and two permutations (P and Q).";
        this.category = CategoryType.HASH;
        this.subCategory = "Cryptographic Hash";
        this.securityStatus = SecurityStatus.EDUCATIONAL; // SHA-3 finalist but not selected
        this.complexity = ComplexityType.HIGH;

        // Algorithm properties
        this.inventor = "Praveen Gauravaram, Lars R. Knudsen, Krystian Matusiewicz, et al.";
        this.year = 2011;
        this.country = CountryCode.MULTI;

        // Hash-specific properties
        this.hashSize = 512; // bits (default)
        this.blockSize = 1024; // bits

        // Documentation
        this.documentation = [
          new LinkItem("Grøstl - a SHA-3 candidate", "https://www.groestl.info/Groestl.pdf"),
          new LinkItem("Grøstl Official Website", "https://www.groestl.info/"),
          new LinkItem("NIST SHA-3 Competition", "https://csrc.nist.gov/projects/hash-functions/sha-3-project")
        ];

        this.references = [
          new LinkItem("Wide-Pipe Hash Functions", "https://eprint.iacr.org/2005/010.pdf"),
          new LinkItem("Grøstl NIST SHA-3 Round 3 submission package (reference code and KAT files)", "http://www.groestl.info/Groestl.zip"),
          new LinkItem("Grøstl implementation guide", "http://www.groestl.info/groestl-implementation-guide.pdf")
        ];

        // Known-answer tests from the Grøstl NIST SHA-3 Round 3 submission
        // package (KAT_MCT/ShortMsgKAT_512.txt), the final tweaked Grøstl
        // rather than Grøstl-0. Grøstl-512 has a 128-byte block with an 8-byte
        // block counter at the end of the final padded block, so messages of
        // 120..127 bytes mod 128 need a second padding block - the lengths at
        // which the padding used to be discarded entirely. 119 and 128 bytes
        // bracket that range with single-padding-block cases.
        this.tests = [
          {
            text: "NIST SHA-3 Round 3 KAT, Len = 0 (empty message)",
            uri: "http://www.groestl.info/Groestl.zip",
            input: [],
            expected: OpCodes.Hex8ToBytes(
              "6d3ad29d279110eef3adbd66de2a0345a77baede1557f5d099fce0c03d6dc2ba" +
              "8e6d4a6633dfbd66053c20faa87d1a11f39a7fbe4a6c2f009801370308fc4ad8")
          },
          {
            text: "NIST SHA-3 Round 3 KAT, Len = 8 (single byte)",
            uri: "http://www.groestl.info/Groestl.zip",
            input: OpCodes.Hex8ToBytes("CC"),
            expected: OpCodes.Hex8ToBytes(
              "b23eeeb675c272c6e37a6ee9ab4dc505c9d6a10020f6bed3948205d04cdd1e90" +
              "b06e494d186ef4f19266d7da200c89dc009e2b1a538cdea199e773fc076f802e")
          },
          {
            text: "NIST SHA-3 Round 3 KAT, Len = 952 (119 bytes, one padding block)",
            uri: "http://www.groestl.info/Groestl.zip",
            input: OpCodes.Hex8ToBytes(
              "3C9B46450C0F2CAE8E3823F8BDB4277F31B744CE2EB17054BDDC6DFF36AF7F49" +
              "FB8A2320CC3BDF8E0A2EA29AD3A55DE1165D219ADEDDB5175253E2D1489E9B6F" +
              "DD02E2C3D3A4B54D60E3A47334C37913C5695378A669E9B72DEC32AF5434F93F" +
              "46176EBF044C4784467C700470D0C0B40C8A088C815816"),
            expected: OpCodes.Hex8ToBytes(
              "427af58871bec7fadc342e40805abb7b3e47ab2a4c7fe529ffa20207d7b7f3c1" +
              "b53e050ff64498f0ad028fe1f9f4d075eb88f8a59fa4bc25922a1cd21547b09e")
          },
          {
            text: "NIST SHA-3 Round 3 KAT, Len = 960 (120 bytes, two padding blocks)",
            uri: "http://www.groestl.info/Groestl.zip",
            input: OpCodes.Hex8ToBytes(
              "D1E654B77CB155F5C77971A64DF9E5D34C26A3CAD6C7F6B300D39DEB19100946" +
              "91ADAA095BE4BA5D86690A976428635D5526F3E946F7DC3BD4DBC78999E65344" +
              "1187A81F9ADCD5A3C5F254BC8256B0158F54673DCC1232F6E918EBFC6C51CE67" +
              "EAEB042D9F57EEC4BFE910E169AF78B3DE48D137DF4F2840"),
            expected: OpCodes.Hex8ToBytes(
              "5146d9b44b0bf31099b11835cc8bb4bc3b6370de7932cd77c6d4468b0a847de1" +
              "3758de22f3f223522e7fe9d722ae044b13012ec5dd7c34a9fa0d3c61cb9398b9")
          },
          {
            text: "NIST SHA-3 Round 3 KAT, Len = 1016 (127 bytes, two padding blocks)",
            uri: "http://www.groestl.info/Groestl.zip",
            input: OpCodes.Hex8ToBytes(
              "A62FC595B4096E6336E53FCDFC8D1CC175D71DAC9D750A6133D23199EAAC2882" +
              "07944CEA6B16D27631915B4619F743DA2E30A0C00BBDB1BBB35AB852EF3B9AEC" +
              "6B0A8DCC6E9E1ABAA3AD62AC0A6C5DE765DE2C3711B769E3FDE44A74016FFF82" +
              "AC46FA8F1797D3B2A726B696E3DEA5530439ACEE3A45C2A51BC32DD055650B"),
            expected: OpCodes.Hex8ToBytes(
              "f42aa4043d0774e05de406181f2936b7ba91fb1a68e209174e1d3974abb185c7" +
              "9932c5ea4bca3798b68c303b77aa682df57fed6635201bf01d345782b1fa58c6")
          },
          {
            text: "NIST SHA-3 Round 3 KAT, Len = 1024 (128 bytes, exactly one full block)",
            uri: "http://www.groestl.info/Groestl.zip",
            input: OpCodes.Hex8ToBytes(
              "2B6DB7CED8665EBE9DEB080295218426BDAA7C6DA9ADD2088932CDFFBAA1C141" +
              "29BCCDD70F369EFB149285858D2B1D155D14DE2FDB680A8B027284055182A0CA" +
              "E275234CC9C92863C1B4AB66F304CF0621CD54565F5BFF461D3B461BD40DF281" +
              "98E3732501B4860EADD503D26D6E69338F4E0456E9E9BAF3D827AE685FB1D817"),
            expected: OpCodes.Hex8ToBytes(
              "ff410b511135dbc0b8644c28efa3ec632326feb98e50edc6390c441610d7c514" +
              "acdf0a61a0bf01aa9dc1f55d92e085248eba1c24ee23978b4986af41c13a6176")
          }
        ];

        // For test suite compatibility
        this.testVectors = this.tests;
      }

      CreateInstance(isInverse = false) {
        return new GroestlInstance(this, isInverse);
      }
    }

    class GroestlInstance extends IHashFunctionInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.inputBuffer = [];
        this.hashSize = algorithm.hashSize;
        this.blockSize = algorithm.blockSize;
      }


      Result() {
        // Process using Grøstl hasher (even for empty input)
        const hasher = new GroestlHasher(512);
        if (this.inputBuffer.length > 0) {
          hasher.update(this.inputBuffer);
        }
        const result = hasher.finalize();

        this.inputBuffer = [];
        return Array.from(result);
      }

      // Direct hash interface with variable output
      hash(data, outputBits) {
        const hasher = new GroestlHasher(outputBits || 512);
        hasher.update(data);
        return hasher.finalize();
      }

      // Variants
      hash224(data) {
        return this.hash(data, 224);
      }

      hash256(data) {
        return this.hash(data, 256);
      }

      hash384(data) {
        return this.hash(data, 384);
      }

      hash512(data) {
        return this.hash(data, 512);
      }
    }

    // ===== GROESTL HASHER IMPLEMENTATION =====

    class GroestlHasher {
      constructor(outputBits = 512) {
        this.outputBits = outputBits;
        // Grøstl-224 and Grøstl-256 use the 512-bit state, Grøstl-384 and
        // Grøstl-512 the 1024-bit one.
        this.stateSize = outputBits <= 256 ? 512 : 1024; // bits
        this.blockSize = this.stateSize; // bits
        this.rows = ROWS;
        this.cols = this.stateSize / 64; // 8 for 512-bit, 16 for 1024-bit
        this.rounds = this.stateSize === 512 ? 10 : 14;
        this.shiftsP = this.cols === 8 ? SHIFTS_P_512 : SHIFTS_P_1024;
        this.shiftsQ = this.cols === 8 ? SHIFTS_Q_512 : SHIFTS_Q_1024;

        // Initialize state (wide-pipe construction)
        this.state = new Array(this.stateSize / 8).fill(0);
        this.blocksProcessed = 0;
        this._absorber = new BlockAbsorber(this.stateSize / 8, block => this.processBlock(block));

        // Set initial value based on output size
        this.initializeState();
      }

      initializeState() {
        // Initialize state to zero
        this.state.fill(0);

        // Grøstl specification section 3.1: the initial value is the output
        // length in bits as a 64-bit big-endian integer, occupying the LAST
        // eight bytes of the state - the final column, not the first byte of
        // it. Grøstl-256 therefore ends ...00 01 00, not ...00 01 00 00 00 00.
        const stateBytes = this.stateSize / 8;
        let bits = this.outputBits;
        for (let i = 0; i < 8; i++) {
          this.state[stateBytes - 1 - i] = OpCodes.ToByte(bits);
          bits = Math.floor(bits / 256);
        }
      }

      update(data) {
        if (!Array.isArray(data)) {
          data = Array.from(data);
        }

        this._absorber.Absorb(data);
      }

      finalize() {
        const blockBytes = this.stateSize / 8;

        // Grøstl specification section 3.3: the padding is 0x80, a zero fill,
        // then the number of blocks in the PADDED message as a 64-bit
        // big-endian integer - a block count, not a message length. How many
        // blocks the padding itself adds has to be known before the counter
        // can be written, which is why it is computed here and handed to
        // MerkleDamgardBlocks as the value to encode.
        const blocks = this._absorber.Finish((held, pending) => {
          const emitted = (pending === blockBytes || pending + 1 > blockBytes - 8) ? 2 : 1;
          return MerkleDamgardBlocks(held, pending, this.blocksProcessed + emitted, {
            blockSize: blockBytes,
            padByte: 0x80,
            lengthBytes: 8,
            lengthLittleEndian: false,
            lengthInBits: false
          });
        });

        // Every padding block gets compressed. Testing for a single block and
        // silently discarding anything longer dropped both blocks whenever a
        // second was needed, which is every message of 56..63 bytes mod 64.
        for (const block of blocks) {
          this.processBlock(block);
        }

        // Output transformation omega(h) = trunc_n(P(h) xor h)
        const finalState = this.permutationP(this.state.slice());

        // XOR with original state for feedforward
        for (let i = 0; i < this.state.length; i++) {
          finalState[i] = OpCodes.XorN(finalState[i], this.state[i]);
        }

        // Truncate to desired output length
        const outputBytes = this.outputBits / 8;
        const stateBytes = this.stateSize / 8;
        const startIndex = stateBytes - outputBytes;

        return finalState.slice(startIndex, startIndex + outputBytes);
      }

      processBlock(block) {
        // Compression function: f(h,m) = P(h ⊕ m) ⊕ Q(m) ⊕ h
        const h = this.state.slice();
        const m = Array.from(block);

        // h ⊕ m
        const hXorM = new Array(h.length);
        for (let i = 0; i < h.length; i++) {
          hXorM[i] = OpCodes.XorN(h[i], m[i]);
        }

        // Compute P(h ⊕ m) and Q(m)
        const pResult = this.permutationP(hXorM);
        const qResult = this.permutationQ(m);

        // Final result: P(h ⊕ m) ⊕ Q(m) ⊕ h
        for (let i = 0; i < this.state.length; i++) {
          this.state[i] = OpCodes.XorN(OpCodes.XorN(pResult[i], qResult[i]), h[i]);
        }

        this.blocksProcessed++;
      }

      // AES S-box (same as Rijndael)
      static get SBOX() {
        return [
          0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
          0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
          0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
          0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
          0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
          0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
          0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
          0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
          0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
          0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
          0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
          0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
          0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
          0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
          0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
          0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16
        ];
      }

      /**
       * Index of matrix element (row, col) in the flat state array.
       *
       * Grøstl specification section 3.2 fills the state column by column, so
       * the byte at stream position i sits at row i mod 8 of column
       * floor(i / 8). Holding the array in stream order and going through this
       * helper is what makes ShiftBytes act on rows; indexing it as
       * row * cols + col transposes the matrix and shuffles bytes that were
       * never meant to meet.
       *
       * @param {int} row - 0..7
       * @param {int} col - 0..cols-1
       * @returns {int} flat index
       */
      index(row, col) {
        return col * ROWS + row;
      }

      // P permutation
      permutationP(state) {
        return this.permute(state, false);
      }

      // Q permutation
      permutationQ(state) {
        return this.permute(state, true);
      }

      /**
       * One permutation, Grøstl specification section 3.2.
       * @param {uint8[]} state - input state, not modified
       * @param {boolean} isQ - false for P, true for Q
       * @returns {uint8[]} permuted state
       */
      permute(state, isQ) {
        const newState = state.slice();
        const shifts = isQ ? this.shiftsQ : this.shiftsP;

        for (let round = 0; round < this.rounds; round++) {
          this.addRoundConstant(newState, round, isQ);
          this.subBytes(newState);
          this.shiftBytes(newState, shifts);
          this.mixBytes(newState);
        }

        return newState;
      }

      /**
       * AddRoundConstant.
       *
       * P touches the top row of EVERY column with (col * 0x10) xor round, and
       * Q complements all seven upper rows before adding
       * (col * 0x10) xor 0xff xor round to the bottom row. Reducing either to a
       * single byte leaves most of the state unmixed.
       *
       * @param {uint8[]} state - modified in place
       * @param {int} round - round index
       * @param {boolean} isQ - false for P, true for Q
       */
      addRoundConstant(state, round, isQ) {
        for (let col = 0; col < this.cols; col++) {
          const columnConstant = OpCodes.XorN(OpCodes.Shl32(col, 4), round);

          if (isQ) {
            for (let row = 0; row < ROWS - 1; row++) {
              const i = this.index(row, col);
              state[i] = OpCodes.XorN(state[i], 0xFF);
            }
            const last = this.index(ROWS - 1, col);
            state[last] = OpCodes.XorN(state[last], OpCodes.XorN(columnConstant, 0xFF));
          } else {
            const first = this.index(0, col);
            state[first] = OpCodes.XorN(state[first], columnConstant);
          }
        }
      }

      // SubBytes transformation using AES S-box
      subBytes(state) {
        const sbox = GroestlHasher.SBOX;
        for (let i = 0; i < state.length; i++) {
          state[i] = sbox[state[i]];
        }
      }

      /**
       * ShiftBytes: rotate row i to the LEFT by shifts[i].
       * @param {uint8[]} state - modified in place
       * @param {int[]} shifts - per-row rotation amounts
       */
      shiftBytes(state, shifts) {
        const cols = this.cols;
        const rowData = new Array(cols);

        for (let row = 0; row < ROWS; row++) {
          const shift = shifts[row] % cols;
          if (shift === 0) continue;

          for (let col = 0; col < cols; col++) rowData[col] = state[this.index(row, col)];
          // Rotating left means the byte landing in column col came from
          // column col + shift, not the other way round.
          for (let col = 0; col < cols; col++)
            state[this.index(row, col)] = rowData[(col + shift) % cols];
        }
      }

      /**
       * MixBytes: multiply every column by circ(02,02,03,04,05,03,05,07) over
       * GF(2^8) with the AES reduction polynomial.
       * @param {uint8[]} state - modified in place
       */
      mixBytes(state) {
        const column = new Array(ROWS);

        for (let col = 0; col < this.cols; col++) {
          for (let row = 0; row < ROWS; row++) column[row] = state[this.index(row, col)];

          for (let row = 0; row < ROWS; row++) {
            let result = 0;
            for (let k = 0; k < ROWS; k++) {
              result = OpCodes.XorN(result,
                OpCodes.GF256Mul(MIX_COEFFICIENTS[k], column[(row + k) % ROWS]));
            }
            state[this.index(row, col)] = result;
          }
        }
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new Groestl();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { Groestl, GroestlInstance };
}));