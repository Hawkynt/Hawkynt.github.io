/*
 * RLE (Run-Length Encoding) Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Simple compression algorithm that replaces consecutive identical bytes
 * with a count-value pair. Most effective on data with long runs of repeated values.
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;
  
class RLECompression extends CompressionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "RLE";
    this.description = "Simple compression algorithm that replaces consecutive identical bytes with a count-value pair. Most effective on data with long runs of repeated values. Fundamental technique used in many image formats.";
    this.inventor = "Unknown (fundamental technique)";
    this.year = 1967;
    this.category = CategoryType.COMPRESSION;
    this.subCategory = "Transform";
    this.securityStatus = null;
    this.complexity = ComplexityType.ELEMENTARY;
    this.country = CountryCode.US;

    // Configuration
    this.MAX_RUN_LENGTH = 255; // Maximum run length in a single encoding
    this.ESCAPE_CHAR = 0x1B;   // Escape character (ESC)
    
    // Documentation and references
    this.documentation = [
      new LinkItem("Run-Length Encoding - Wikipedia", "https://en.wikipedia.org/wiki/Run-length_encoding"),
      new LinkItem("PCX Image Format Specification", "https://web.archive.org/web/20100206055706/http://www.qzx.com/pc-gpe/pcx.txt"),
      new LinkItem("TIFF PackBits Algorithm", "https://www.adobe.io/open/standards/TIFF.html")
    ];

    this.references = [
      new LinkItem("Mark Nelson RLE Article", "https://web.archive.org/web/20071013094925/http://www.dogma.net/markn/articles/rle/rle.htm"),
      new LinkItem("Stanford CS106B Compression", "https://web.stanford.edu/class/cs106b/lectures/compression/"),
      new LinkItem("ITU-T T.4 Fax Standard", "https://www.itu.int/rec/T-REC-T.4/en")
    ];
    
    // Test vectors - round-trip compression tests
    this.tests = [
      {
        text: "Simple repeated pattern",
        uri: "https://en.wikipedia.org/wiki/Run-length_encoding",
        input: [65, 65, 65, 66, 66, 66, 67, 67, 67], // "AAABBBCCC"
        expected: [65, 65, 65, 66, 66, 66, 67, 67, 67] // Should decompress to original
      },
      {
        text: "Long run compression",
        uri: "https://en.wikipedia.org/wiki/Run-length_encoding",
        input: [65, 65, 65, 65, 65, 65, 65, 65, 65, 65], // "AAAAAAAAAA"
        expected: [65, 65, 65, 65, 65, 65, 65, 65, 65, 65] // Should decompress to original
      },
      {
        text: "No repeated characters",
        uri: "https://en.wikipedia.org/wiki/Run-length_encoding",
        input: [65, 66, 67, 68, 69, 70], // "ABCDEF"
        expected: [65, 66, 67, 68, 69, 70] // Should decompress to original
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new RLEInstance(this, isInverse);
  }
}

class RLEInstance extends IAlgorithmInstance {
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
    const input = this.inputBuffer;
    const output = [];
    
    let i = 0;
    while (i < input.length) {
      const currentByte = input[i];
      let runLength = 1;
      
      // Count consecutive identical bytes
      while (i + runLength < input.length && 
             input[i + runLength] === currentByte && 
             runLength < this.algorithm.MAX_RUN_LENGTH) {
        runLength++;
      }
      
      // Decide encoding strategy
      if (runLength >= 3 || currentByte === this.algorithm.ESCAPE_CHAR) {
        // Use RLE encoding for runs >= 3 or escape character
        output.push(this.algorithm.ESCAPE_CHAR);
        output.push(runLength);
        output.push(currentByte);
      } else {
        // Output literal bytes for short runs
        for (let j = 0; j < runLength; j++) {
          output.push(currentByte);
        }
      }
      
      i += runLength;
    }
    
    // Clear input buffer
    this.inputBuffer = [];
    
    return output;
  }
    
  _decompress() {
    const input = this.inputBuffer;
    const output = [];
    
    let i = 0;
    while (i < input.length) {
      if (input[i] === this.algorithm.ESCAPE_CHAR && i + 2 < input.length) {
        // RLE encoded sequence
        const runLength = input[i + 1];
        const character = input[i + 2];
        
        // Validate run length
        if (runLength === 0 || runLength > this.algorithm.MAX_RUN_LENGTH) {
          throw new Error('Invalid run length in data');
        }
        
        // Output the run
        for (let j = 0; j < runLength; j++) {
          output.push(character);
        }
        
        i += 3;
      } else {
        // Literal character
        output.push(input[i]);
        i++;
      }
    }
    
    // Clear input buffer
    this.inputBuffer = [];
    
    return output;
  }
}
    
// Register the algorithm
RegisterAlgorithm(new RLECompression());
  
