/*
 * Feedback with Carry Shift Register (FCSR) Pseudo-Random Number Generator
 *
 * FCSR is the carry analog of LFSR (Linear Feedback Shift Register). While LFSR
 * uses XOR operations over GF(2), FCSR uses arithmetic addition with carry,
 * operating in the 2-adic number system. This fundamental difference gives FCSR
 * superior algebraic properties and longer periods for certain applications.
 *
 * Key differences from LFSR:
 * - LFSR: XOR-based feedback, operates in GF(2)
 * - FCSR: Addition-based feedback with carry propagation, operates in 2-adic integers
 *
 * Period: Up to 2^64 - 1 (with appropriate connection integer)
 * State: 64 bits + 1 carry bit
 *
 * The FCSR operates by:
 * 1. Computing feedback bit from state AND connection integer (polynomial)
 * 2. Adding feedback bit + carry bit
 * 3. Propagating carry to next iteration
 * 4. Shifting state right and inserting sum bit at position 63
 *
 * Default connection integer: 0b1000_1101__0101_1101__1100_1011__1101_1011__0110_0111__1100_1010__1101_1011__0110_0111
 * This produces maximal-length sequences with good statistical properties.
 *
 * SECURITY WARNING: While FCSRs have better algebraic properties than LFSRs,
 * they are still NOT cryptographically secure PRNGs on their own. Use only for:
 * - Educational purposes
 * - Stream cipher building blocks (in combination with other primitives)
 * - Sequence generation research
 * - Hardware testing applications
 *
 * References:
 * - Goresky & Klapper: "Feedback Registers Based on Ramified Extensions of the 2-Adic Numbers" (1994)
 * - Goresky & Klapper: "Arithmetic Crosscorrelations of Feedback with Carry Shift Register Sequences" (1997)
 * - Klapper & Goresky: "Cryptanalysis Based on 2-Adic Rational Approximation" (1995)
 * - Arnault & Berger: "F-FCSR: Design of a New Class of Stream Ciphers" (2005)
 *
 * AlgorithmFramework Format
 * (c)2006-2025 Hawkynt
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

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          RandomGenerationAlgorithm, IRandomGeneratorInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  class FCSRAlgorithm extends RandomGenerationAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "FCSR";
      this.description = "Feedback with Carry Shift Register is a pseudo-random sequence generator using arithmetic with carry instead of XOR operations. Operates in 2-adic number system with superior algebraic properties compared to LFSRs, producing maximal-length sequences with period up to 2^n-1.";
      this.inventor = "Mark Goresky and Andrew Klapper";
      this.year = 1994;
      this.category = CategoryType.RANDOM;
      this.subCategory = "Deterministic PRNG";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // PRNG-specific metadata
      this.IsDeterministic = true;
      this.IsCryptographicallySecure = false;
      this.SupportedSeedSizes = [new KeySize(1, 8, 1)]; // 1-8 bytes (up to 64-bit seed)

      // Documentation
      this.documentation = [
        new LinkItem(
          "Goresky & Klapper: Feedback Registers Based on Ramified Extensions (1994)",
          "https://link.springer.com/chapter/10.1007/3-540-58691-1_52"
        ),
        new LinkItem(
          "Goresky & Klapper: Arithmetic Crosscorrelations of FCSR Sequences (1997)",
          "https://ieeexplore.ieee.org/document/575854"
        ),
        new LinkItem(
          "Klapper & Goresky: Cryptanalysis Based on 2-Adic Rational Approximation (1995)",
          "https://link.springer.com/chapter/10.1007/3-540-44750-4_20"
        ),
        new LinkItem(
          "Arnault & Berger: F-FCSR: Design of a New Class of Stream Ciphers (2005)",
          "https://link.springer.com/chapter/10.1007/11502760_2"
        ),
        new LinkItem(
          "Wikipedia: Feedback with Carry Shift Registers",
          "https://en.wikipedia.org/wiki/Feedback_with_carry_shift_registers"
        )
      ];

      this.references = [
        new LinkItem(
          "Goresky & Klapper: Pseudo-noise sequences based on algebraic feedback shift registers (2006)",
          "https://ieeexplore.ieee.org/document/1626204"
        ),
        new LinkItem(
          "Klapper & Xu: Register synthesis for algebraic feedback shift registers (2007)",
          "https://www.sciencedirect.com/science/article/pii/S1071579706000402"
        )
      ];

      // Test vectors generated from reference C# implementation
      // Connection integer: 0x8D5DCBDB67CADB67 (default from C# code)
      // This specific connection integer produces maximal-length sequences
      // Vectors verified against the original C# implementation
      this.tests = [
        {
          text: "Seed 0x0000000000000042: First 8 bytes - minimal seed pattern",
          uri: "https://link.springer.com/chapter/10.1007/3-540-58691-1_52",
          input: null,
          seed: OpCodes.Hex8ToBytes("4200000000000000"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("4200000000000000")
        },
        {
          text: "Seed 0x0123456789ABCDEF: First 8 bytes - standard test pattern",
          uri: "https://link.springer.com/chapter/10.1007/3-540-58691-1_52",
          input: null,
          seed: OpCodes.Hex8ToBytes("EFCDAB8967452301"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("EFCDAB8967452301")
        },
        {
          text: "Seed 0xFFFFFFFFFFFFFFFF: First 8 bytes - all ones seed",
          uri: "https://link.springer.com/chapter/10.1007/3-540-58691-1_52",
          input: null,
          seed: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("FFFFFFFFFFFFFFFF")
        },
        {
          text: "Seed 0x0123456789ABCDEF: First 16 bytes - sequence continuation",
          uri: "https://link.springer.com/chapter/10.1007/3-540-58691-1_52",
          input: null,
          seed: OpCodes.Hex8ToBytes("EFCDAB8967452301"),
          outputSize: 16,
          expected: OpCodes.Hex8ToBytes("EFCDAB8967452301D7BAA2E4376FF962")
        },
        {
          text: "Seed 0x8000000000000000: First 8 bytes - high bit set",
          uri: "https://link.springer.com/chapter/10.1007/3-540-58691-1_52",
          input: null,
          seed: OpCodes.Hex8ToBytes("0000000000000080"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("0000000000000080")
        },
        {
          text: "Seed 0xAAAAAAAAAAAAAAAA: First 8 bytes - alternating bit pattern",
          uri: "https://link.springer.com/chapter/10.1007/3-540-58691-1_52",
          input: null,
          seed: OpCodes.Hex8ToBytes("AAAAAAAAAAAAAAAA"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("AAAAAAAAAAAAAAAA")
        },
        {
          text: "Seed 0x1111111111111111: First 8 bytes - sparse bit pattern",
          uri: "https://link.springer.com/chapter/10.1007/3-540-58691-1_52",
          input: null,
          seed: OpCodes.Hex8ToBytes("1111111111111111"),
          outputSize: 8,
          expected: OpCodes.Hex8ToBytes("1111111111111111")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // PRNGs have no inverse operation
      }
      return new FCSRInstance(this);
    }
  }

  /**
 * FCSR cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class FCSRInstance extends IRandomGeneratorInstance {
    constructor(algorithm) {
      super(algorithm);

      // Default connection integer (polynomial) from C# implementation
      // Binary: 1000_1101__0101_1101__1100_1011__1101_1011__0110_0111__1100_1010__1101_1011__0110_0111
      // This is a carefully chosen value that produces maximal-length sequences
      // Split into high and low 32-bit words for JavaScript compatibility
      this._connectionHigh = 0x8D5DCBDB; // High 32 bits
      this._connectionLow = 0x67CADB67;  // Low 32 bits

      // 64-bit state stored as two 32-bit words (high and low)
      this._stateHigh = 0;
      this._stateLow = 0;

      // Carry bit (0 or 1)
      this._carryBit = 0;

      this._ready = false;
    }

    /**
     * Set seed value (1-8 bytes)
     * Seed initializes the 64-bit FCSR state and carry bit
     * The LSB of the seed initializes the carry bit
     */
    set seed(seedBytes) {
      if (!seedBytes || seedBytes.length === 0) {
        this._ready = false;
        return;
      }

      // Initialize state to zero
      this._stateHigh = 0;
      this._stateLow = 0;

      // Pack seed bytes into 64-bit state (little-endian to match C# implementation)
      // For seed [b0, b1, b2, b3, b4, b5, b6, b7]:
      //   Low 32 bits  = b0 b1 b2 b3
      //   High 32 bits = b4 b5 b6 b7

      if (seedBytes.length <= 4) {
        // Seed is 4 bytes or less - pack into low word
        const bytes = seedBytes.concat(Array(4 - seedBytes.length).fill(0));
        this._stateLow = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      } else {
        // Seed is more than 4 bytes - pack into low and high words
        // Low word: first 4 bytes
        const lowBytes = seedBytes.slice(0, 4);
        this._stateLow = OpCodes.Pack32LE(lowBytes[0], lowBytes[1], lowBytes[2], lowBytes[3]);

        // High word: next 4 bytes
        const highBytes = seedBytes.slice(4, 8).concat([0, 0, 0, 0]).slice(0, 4);
        this._stateHigh = OpCodes.Pack32LE(highBytes[0], highBytes[1], highBytes[2], highBytes[3]);
      }

      // Extract carry bit from LSB of seed (matching C# line 12)
      this._carryBit = OpCodes.AndN(seedBytes[0], 1);

      this._ready = true;
    }

    get seed() {
      return null; // Cannot retrieve seed from PRNG state
    }

    /**
     * Set custom connection integer (optional)
     * The connection integer determines the feedback pattern
     * @param {Array} bytes - 8-byte array representing 64-bit connection integer
     */
    set connectionInteger(bytes) {
      if (!bytes || bytes.length < 8) {
        return;
      }
      // Pack into high and low words (little-endian)
      this._connectionLow = OpCodes.Pack32LE(bytes[0], bytes[1], bytes[2], bytes[3]);
      this._connectionHigh = OpCodes.Pack32LE(bytes[4], bytes[5], bytes[6], bytes[7]);
    }

    get connectionInteger() {
      // Unpack to byte array
      const lowBytes = OpCodes.Unpack32LE(this._connectionLow);
      const highBytes = OpCodes.Unpack32LE(this._connectionHigh);
      return lowBytes.concat(highBytes);
    }

    /**
     * Calculate feedback bit from current state and connection integer
     *
     * This implements the FCSR feedback calculation:
     * - Perform bitwise AND between 64-bit state and connection integer
     * - XOR-reduce all bits to get single feedback bit (parity)
     *
     * Matches C# implementation (lines 40-48)
     */
    _calculateFeedback() {
      // Perform AND operation on both words
      const maskedLow = OpCodes.AndN(OpCodes.ToUint32(this._stateLow), OpCodes.ToUint32(this._connectionLow));
      const maskedHigh = OpCodes.AndN(OpCodes.ToUint32(this._stateHigh), OpCodes.ToUint32(this._connectionHigh));

      // XOR reduction on low word
      let resultLow = maskedLow;
      resultLow = OpCodes.XorN(resultLow, OpCodes.Shr32(resultLow, 16));
      resultLow = OpCodes.XorN(resultLow, OpCodes.Shr32(resultLow, 8));
      resultLow = OpCodes.XorN(resultLow, OpCodes.Shr32(resultLow, 4));
      resultLow = OpCodes.XorN(resultLow, OpCodes.Shr32(resultLow, 2));
      resultLow = OpCodes.XorN(resultLow, OpCodes.Shr32(resultLow, 1));

      // XOR reduction on high word
      let resultHigh = maskedHigh;
      resultHigh = OpCodes.XorN(resultHigh, OpCodes.Shr32(resultHigh, 16));
      resultHigh = OpCodes.XorN(resultHigh, OpCodes.Shr32(resultHigh, 8));
      resultHigh = OpCodes.XorN(resultHigh, OpCodes.Shr32(resultHigh, 4));
      resultHigh = OpCodes.XorN(resultHigh, OpCodes.Shr32(resultHigh, 2));
      resultHigh = OpCodes.XorN(resultHigh, OpCodes.Shr32(resultHigh, 1));

      // Combine both results
      return OpCodes.AndN(OpCodes.XorN(resultLow, resultHigh), 1);
    }

    /**
     * Single FCSR step: compute feedback, add with carry, shift, and update
     * Returns the output bit (LSB before shift, matching C# line 30)
     *
     * FCSR algorithm (from C# lines 24-36):
     * 1. Compute feedback bit from state AND connection integer
     * 2. Add feedback bit + carry bit
     * 3. Extract new carry from bit 1 of sum (sum >> 1)
     * 4. Output current LSB of state
     * 5. Shift state right by 1
     * 6. Insert (sum & 1) at bit 63
     */
    _stepFCSR() {
      // Calculate feedback bit from current state (C# line 25)
      const feedbackBit = this._calculateFeedback();

      // Add feedback bit and carry (C# line 26)
      const feedbackCarrySum = feedbackBit + this._carryBit;

      // Extract new carry bit (bit 1 of sum) (C# line 27)
      this._carryBit = OpCodes.AndN(OpCodes.Shr32(feedbackCarrySum, 1), 1);

      // Output bit is current LSB of state (C# line 30)
      const outputBit = OpCodes.AndN(this._stateLow, 1);

      // Shift state right: move LSB of high into MSB of low (C# line 31)
      const carryFromHigh = OpCodes.AndN(this._stateHigh, 1);
      this._stateLow = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shr32(this._stateLow, 1), OpCodes.Shl32(carryFromHigh, 31)));
      this._stateHigh = OpCodes.ToUint32(OpCodes.Shr32(this._stateHigh, 1));

      // Insert (feedbackCarrySum & 1) at bit 63 (C# line 34)
      const insertBit = OpCodes.AndN(feedbackCarrySum, 1);
      this._stateHigh = OpCodes.ToUint32(OpCodes.OrN(this._stateHigh, OpCodes.Shl32(insertBit, 31)));

      return outputBit;
    }

    /**
     * Generate next 64-bit value (8 bytes)
     * Accumulates 64 FCSR steps into a single output value
     * Matches C# implementation (lines 16-22)
     */
    _next64() {
      if (!this._ready) {
        throw new Error('FCSR not initialized: set seed first');
      }

      // Accumulate 64 bits (8 bytes)
      const result = [0, 0, 0, 0, 0, 0, 0, 0];

      // Generate 8 bytes (64 bits total)
      // Each byte contains 8 bits accumulated from FCSR steps
      for (let byteIdx = 0; byteIdx < 8; ++byteIdx) {
        let byte = 0;
        // Generate 8 bits for this byte (C# line 19: qword |= (ulong)GetNextBit() << i)
        for (let bitIdx = 0; bitIdx < 8; ++bitIdx) {
          const bit = this._stepFCSR();
          byte = OpCodes.OrN(byte, OpCodes.Shl32(bit, bitIdx));
        }
        result[byteIdx] = byte;
      }

      return result;
    }

    /**
     * Generate random bytes
     * @param {number} length - Number of random bytes to generate
     * @returns {Array} Random bytes
     */
    NextBytes(length) {
      if (!this._ready) {
        throw new Error('FCSR not initialized: set seed first');
      }

      if (length === 0) {
        return [];
      }

      const output = [];

      // Generate in 8-byte (64-bit) chunks
      while (output.length < length) {
        const chunk = this._next64();
        const bytesNeeded = Math.min(8, length - output.length);
        for (let i = 0; i < bytesNeeded; ++i) {
          output.push(chunk[i]);
        }
      }

      return output;
    }

    // AlgorithmFramework interface implementation
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      // For PRNG, Feed is not used (no input data to process)
      // Could be extended to support re-seeding or mixing
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      // Use specified output size or default to 32 bytes
      const size = this._outputSize || 32;
      return this.NextBytes(size);
    }

    /**
     * Set output size for Result() method
     */
    set outputSize(size) {
      this._outputSize = size;
    }

    get outputSize() {
      return this._outputSize || 32;
    }
  }

  // Register algorithm
  const algorithmInstance = new FCSRAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  return { FCSRAlgorithm, FCSRInstance };
}));
