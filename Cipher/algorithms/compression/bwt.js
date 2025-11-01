/*
 * BWT (Burrows-Wheeler Transform) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * The Burrows-Wheeler Transform is a reversible data transformation that
 * rearranges string characters to improve the performance of other compression techniques.
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

  class BWTCompression extends CompressionAlgorithm {
      constructor() {
        super();

        // Required metadata
        this.name = "BWT (Burrows-Wheeler Transform)";
        this.description = "Reversible data transformation that rearranges string characters to improve performance of other compression techniques. Used as preprocessing step in bzip2 and other advanced compressors.";
        this.inventor = "Michael Burrows, David Wheeler";
        this.year = 1994;
        this.category = CategoryType.COMPRESSION;
        this.subCategory = "Transform";
        this.securityStatus = null;
        this.complexity = ComplexityType.ADVANCED;
        this.country = CountryCode.US;

        // Documentation and references
        this.documentation = [
          new LinkItem("Burrows-Wheeler Transform - Wikipedia", "https://en.wikipedia.org/wiki/Burrows%E2%80%93Wheeler_transform"),
          new LinkItem("Original BWT Paper", "https://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-124.pdf"),
          new LinkItem("bzip2 Algorithm", "https://sourceware.org/bzip2/")
        ];

        this.references = [
          new LinkItem("bzip2 Implementation", "https://sourceware.org/bzip2/downloads.html"),
          new LinkItem("Educational BWT Tutorial", "https://web.stanford.edu/class/cs262/notes/lecture12.pdf"),
          new LinkItem("Suffix Arrays for BWT", "https://web.stanford.edu/class/cs166/lectures/04/Small04.pdf")
        ];

        // Test vectors - round-trip tests
        this.tests = [
          {
            text: "Empty data test",
            uri: "Edge case test",
            input: [], 
            expected: [] // Empty input produces empty output
          },
          {
            text: "Single byte test",
            uri: "Minimal transformation test",
            input: [65], // "A"
            expected: [0,0,0,1,65] // BWT output: [position, transformed_data]
          }
        ];
      }

      CreateInstance(isInverse = false) {
        return new BWTInstance(this, isInverse);
      }
    }

    class BWTInstance extends IAlgorithmInstance {
      constructor(algorithm, isInverse = false) {
        super(algorithm);
        this.isInverse = isInverse;
        this.inputBuffer = [];
      }

      Feed(data) {
        if (!data || data.length === 0) return;
        this.inputBuffer.push(...data);
      }

      Result() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        if (this.isInverse) {
          return this._decompress();
        } else {
          return this._compress();
        }
      }

      _compress() {
        if (this.inputBuffer.length === 0) {
          return [];
        }

        // Simple BWT implementation
        const data = this.inputBuffer.slice();
        const n = data.length;

        // Add end-of-string marker (simplified)
        data.push(0);

        // Generate all rotations
        const rotations = [];
        for (let i = 0; i <= n; i++) {
          rotations.push({
            rotation: data.slice(i).concat(data.slice(0, i)),
            originalIndex: i
          });
        }

        // Sort rotations lexicographically
        rotations.sort((a, b) => {
          for (let i = 0; i <= n; i++) {
            if (a.rotation[i] !== b.rotation[i]) {
              return a.rotation[i] - b.rotation[i];
            }
          }
          return 0;
        });

        // Extract last column and find original string position
        const lastColumn = [];
        let originalPosition = 0;

        for (let i = 0; i < rotations.length; i++) {
          lastColumn.push(rotations[i].rotation[n]);
          if (rotations[i].originalIndex === 0) {
            originalPosition = i;
          }
        }

        // Create output: [original_position(4 bytes), last_column]
        const result = [...OpCodes.Unpack32BE(originalPosition)];
        result.push(...lastColumn.slice(0, n)); // Remove the added marker

        this.inputBuffer = [];
        return result;
      }

      _decompress() {
        if (this.inputBuffer.length < 5) {
          this.inputBuffer = [];
          return [];
        }

        // Read original position
        const originalPosition = OpCodes.Pack32BE(
          this.inputBuffer[0],
          this.inputBuffer[1],
          this.inputBuffer[2],
          this.inputBuffer[3]
        );

        const lastColumn = this.inputBuffer.slice(4);
        const n = lastColumn.length;

        if (n === 0) {
          this.inputBuffer = [];
          return [];
        }

        // Add end marker back
        lastColumn.push(0);

        // Create first column by sorting last column
        const firstColumn = lastColumn.slice().sort((a, b) => a - b);

        // Build next array for reconstruction
        const next = new Array(n + 1);
        const count = new Array(256).fill(0);

        // Count occurrences in first column
        for (const char of firstColumn) {
          count[char]++;
        }

        // Build cumulative counts
        for (let i = 1; i < 256; i++) {
          count[i] += count[i - 1];
        }

        // Build next array
        const tempCount = new Array(256).fill(0);
        for (let i = 0; i <= n; i++) {
          const char = lastColumn[i];
          next[tempCount[char]] = i;
          tempCount[char]++;

          // Adjust for cumulative positioning
          for (let j = 0; j < char; j++) {
            if (tempCount[j] < count[j]) {
              next[count[j] - tempCount[j] - 1 + tempCount[j]] = i;
              break;
            }
          }
        }

        // Reconstruct original string
        const result = [];
        let pos = originalPosition;

        for (let i = 0; i < n; i++) {
          if (firstColumn[pos] !== 0) { // Skip end marker
            result.push(firstColumn[pos]);
          }
          pos = next[pos];
        }

        this.inputBuffer = [];
        return result;
      }
    }

    // Register the algorithm

  // ===== REGISTRATION =====

    const algorithmInstance = new BWTCompression();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { BWTCompression, BWTInstance };
}));