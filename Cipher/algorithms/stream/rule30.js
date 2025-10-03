/*
 * Rule30 Cellular Automaton - Production Implementation
 * Educational pseudorandom number generator
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Rule30 is an elementary cellular automaton discovered by Stephen Wolfram that
 * exhibits chaotic behavior. While it produces seemingly random output, it is NOT
 * cryptographically secure and should only be used for educational purposes.
 *
 * SECURITY STATUS: EDUCATIONAL - Not cryptographically secure.
 * USE ONLY FOR: Mathematical demonstrations, educational examples, toy applications.
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

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework; 

  // ===== ALGORITHM IMPLEMENTATION =====

  class Rule30Algorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Rule30";
      this.description = "Elementary cellular automaton-based pseudorandom number generator using Rule 30 pattern. Exhibits chaotic behavior but NOT cryptographically secure. Educational use only.";
      this.inventor = "Stephen Wolfram";
      this.year = 1983;
      this.category = CategoryType.STREAM;
      this.subCategory = "Cellular Automaton";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.BEGINNER;
      this.country = CountryCode.GB;

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(1, 1024, 0)  // Flexible key size for CA initialization, step 0 for variable
      ];
      this.SupportedNonceSizes = [
        new KeySize(0, 0, 0)     // Rule30 does not use nonce/IV
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("Rule 30 Wikipedia", "https://en.wikipedia.org/wiki/Rule_30"),
        new LinkItem("A New Kind of Science", "https://www.wolframscience.com/nks/"),
        new LinkItem("Wolfram's Original Paper", "https://www.stephenwolfram.com/publications/cellular-automata-irreversibility/")
      ];

      // Security vulnerabilities
      this.knownVulnerabilities = [
        new Vulnerability(
          "Predictability",
          "State can be reconstructed from sufficient keystream output, not cryptographically secure",
          "Use only for educational purposes, never for actual cryptography"
        ),
        new Vulnerability(
          "No Cryptographic Design",
          "Cellular automaton not designed for cryptographic use and lacks proper security properties",
          "Educational use only - use proper stream ciphers for security"
        )
      ];

      // Educational test vectors (deterministic for validation)
      this.tests = [
        {
          text: "Rule30 Deterministic Test - Simple Key",
          uri: "Educational deterministic test case",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0102030405060708"),
          expected: OpCodes.Hex8ToBytes("acfb3ef79b300e94e86c7fa1f08555f8")
        },
        {
          text: "Rule30 Single Byte Test",
          uri: "Educational single byte test case",
          input: OpCodes.Hex8ToBytes("00"),
          key: OpCodes.Hex8ToBytes("ff"),
          expected: OpCodes.Hex8ToBytes("00")
        }
      ];
    }

    CreateInstance(isInverse = false) {
      return new Rule30Instance(this, isInverse);
    }
  }

  // Instance class implementing production-grade Rule30
  class Rule30Instance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._key = null;
      this.inputBuffer = [];

      // Rule30 CA configuration
      this.DEFAULT_SIZE = 127;    // CA array size (odd for central cell)
      this.cells = null;
      this.centerIndex = Math.floor(this.DEFAULT_SIZE / 2);
      this.initialized = false;
    }

    // Property setter for key
    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      const keyLength = keyBytes.length;
      if (keyLength < 1 || keyLength > 1024) {
        throw new Error(`Invalid Rule30 key size: ${keyLength} bytes. Requires 1-1024 bytes`);
      }

      this._key = [...keyBytes];
      this._initializeCA();
    }

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Feed data to the cipher
    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }

      this.inputBuffer.push(...data);
    }

    // Get the cipher result
    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data to process");
      }
      if (!this.initialized) {
        throw new Error("Rule30 not properly initialized");
      }

      const output = [];

      // Process input data byte by byte (stream cipher)
      for (let i = 0; i < this.inputBuffer.length; i++) {
        const keystreamByte = this._generateByte();
        output.push(this.inputBuffer[i] ^ keystreamByte);
      }

      // Clear input buffer for next operation
      this.inputBuffer = [];

      return output;
    }

    // Initialize cellular automaton from key
    _initializeCA() {
      if (!this._key) return;

      // Initialize CA cells array
      this.cells = new Array(this.DEFAULT_SIZE).fill(0);

      // Use key bytes to set initial cell states
      for (let i = 0; i < this.DEFAULT_SIZE; i++) {
        const keyIndex = i % this._key.length;
        const bitIndex = i % 8;
        this.cells[i] = OpCodes.GetBit(this._key[keyIndex], bitIndex);
      }

      // Ensure at least one cell is set (avoid all-zero state)
      let hasActiveCell = false;
      for (let i = 0; i < this.DEFAULT_SIZE; i++) {
        if (this.cells[i] !== 0) {
          hasActiveCell = true;
          break;
        }
      }
      if (!hasActiveCell) {
        this.cells[this.centerIndex] = 1;
      }

      // Perform initial evolution steps for mixing
      for (let step = 0; step < 100; step++) {
        this._evolveCA();
      }

      this.initialized = true;
    }

    // Evolve cellular automaton one step using Rule 30
    _evolveCA() {
      const newCells = new Array(this.DEFAULT_SIZE);

      for (let i = 0; i < this.DEFAULT_SIZE; i++) {
        const left = this.cells[(i - 1 + this.DEFAULT_SIZE) % this.DEFAULT_SIZE];
        const center = this.cells[i];
        const right = this.cells[(i + 1) % this.DEFAULT_SIZE];

        // Apply Rule 30: XOR of left neighbor and (center OR right neighbor)
        newCells[i] = left ^ (center | right);
      }

      this.cells = newCells;
    }

    // Generate single bit from CA center cell
    _generateBit() {
      this._evolveCA();
      return this.cells[this.centerIndex];
    }

    // Generate full byte from 8 CA evolution steps
    _generateByte() {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const bitValue = this._generateBit();
        byte |= (bitValue << bit);
      }
      return byte & 0xFF;
    }
  }

  // Register the algorithm
  const algorithmInstance = new Rule30Algorithm();
  RegisterAlgorithm(algorithmInstance);

  // Return for module systems
  return { Rule30Algorithm, Rule30Instance };
}));