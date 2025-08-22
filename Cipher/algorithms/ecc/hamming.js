/*
 * Hamming Code Implementation
 * Educational implementation of Hamming error correction codes
 * (c)2006-2025 Hawkynt
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
        ErrorCorrectionAlgorithm, IErrorCorrectionInstance, TestCase, LinkItem, Vulnerability } = AlgorithmFramework;

class HammingAlgorithm extends ErrorCorrectionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Hamming";
    this.description = "Hamming (7,4) error correction code that can detect and correct single-bit errors. Uses parity bits at power-of-2 positions to encode redundancy. Educational implementation demonstrating linear error correction principles.";
    this.inventor = "Richard Hamming";
    this.year = 1950;
    this.category = CategoryType.ECC;
    this.subCategory = "Linear Code";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("Wikipedia - Hamming Code", "https://en.wikipedia.org/wiki/Hamming_code"),
      new LinkItem("Hamming Code Tutorial", "https://www.tutorialspoint.com/hamming-code"),
      new LinkItem("Error Detection and Correction", "https://www.geeksforgeeks.org/error-detection-in-computer-networks/")
    ];

    this.references = [
      new LinkItem("Hamming's Original Paper", "https://ieeexplore.ieee.org/document/6772729"),
      new LinkItem("Bell Labs Technical Journal", "https://archive.org/details/bstj29-2-147"),
      new LinkItem("Information Theory Foundation", "https://en.wikipedia.org/wiki/Information_theory")
    ];

    this.knownVulnerabilities = [
      new Vulnerability(
        "Single Error Correction Only",
        "Standard Hamming codes can only correct single-bit errors. Multiple errors will be detected but incorrectly corrected"
      ),
      new Vulnerability(
        "Limited Error Detection",
        "Cannot reliably detect burst errors or certain patterns of multiple errors"
      )
    ];

    // Test vectors for Hamming (7,4) code
    this.tests = [
      new TestCase(
        [0, 0, 0, 0], // 4-bit data
        [0, 0, 0, 0, 0, 0, 0], // 7-bit encoded
        "Hamming (7,4) all zeros test",
        "https://en.wikipedia.org/wiki/Hamming_code"
      ),
      new TestCase(
        [1, 1, 1, 1], // 4-bit data  
        [1, 1, 0, 1, 1, 0, 1], // 7-bit encoded
        "Hamming (7,4) all ones test",
        "https://en.wikipedia.org/wiki/Hamming_code"
      ),
      new TestCase(
        [1, 0, 1, 0], // 4-bit data
        [1, 0, 1, 1, 0, 1, 0], // 7-bit encoded
        "Hamming (7,4) pattern test",
        "https://en.wikipedia.org/wiki/Hamming_code"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    return new HammingInstance(this, isInverse);
  }
}

class HammingInstance extends IErrorCorrectionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('HammingInstance.Feed: Input must be bit array');
    }

    if (this.isInverse) {
      return this.decode(data);
    } else {
      return this.encode(data);
    }
  }

  Result() {
    // Hamming processing is done in Feed method
    throw new Error('HammingInstance.Result: Use Feed() method to encode/decode data');
  }

  DetectError(data) {
    if (!Array.isArray(data) || data.length !== 7) {
      throw new Error('HammingInstance.DetectError: Input must be 7-bit array');
    }

    const syndrome = this.calculateSyndrome(data);
    return syndrome !== 0;
  }

  encode(data) {
    // Hamming (7,4) encoding - input 4 bits, output 7 bits
    if (data.length !== 4) {
      throw new Error('Hamming encode: Input must be exactly 4 bits');
    }

    const [d1, d2, d3, d4] = data;
    const encoded = new Array(7);

    // Data bits go to positions 3, 5, 6, 7 (1-indexed)
    encoded[2] = d1; // position 3
    encoded[4] = d2; // position 5  
    encoded[5] = d3; // position 6
    encoded[6] = d4; // position 7

    // Parity bits at positions 1, 2, 4 (1-indexed) = 0, 1, 3 (0-indexed)
    encoded[0] = d1 ^ d2 ^ d4; // p1 checks positions 1,3,5,7
    encoded[1] = d1 ^ d3 ^ d4; // p2 checks positions 2,3,6,7  
    encoded[3] = d2 ^ d3 ^ d4; // p4 checks positions 4,5,6,7

    return encoded;
  }

  decode(data) {
    // Hamming (7,4) decoding - input 7 bits, output 4 bits with error correction
    if (data.length !== 7) {
      throw new Error('Hamming decode: Input must be exactly 7 bits');
    }

    const received = [...data]; // Copy input
    const syndrome = this.calculateSyndrome(received);

    if (syndrome !== 0) {
      console.log(`Hamming: Error detected at position ${syndrome}, correcting...`);
      // Correct the error (flip bit at error position, 1-indexed)
      if (syndrome > 0 && syndrome <= 7) {
        received[syndrome - 1] = received[syndrome - 1] ^ 1;
      }
    }

    // Extract data bits from positions 3, 5, 6, 7 (1-indexed)
    return [received[2], received[4], received[5], received[6]];
  }

  calculateSyndrome(data) {
    // Calculate syndrome to find error position
    const s1 = data[0] ^ data[2] ^ data[4] ^ data[6]; // p1 XOR positions 1,3,5,7
    const s2 = data[1] ^ data[2] ^ data[5] ^ data[6]; // p2 XOR positions 2,3,6,7
    const s4 = data[3] ^ data[4] ^ data[5] ^ data[6]; // p4 XOR positions 4,5,6,7

    // Syndrome indicates error position (0 = no error)
    return s1 + (s2 << 1) + (s4 << 2);
  }

  // Convert byte data to bit arrays for testing
  bytesToBits(bytes) {
    const bits = [];
    for (let byte of bytes) {
      for (let i = 7; i >= 0; i--) {
        bits.push((byte >> i) & 1);
      }
    }
    return bits;
  }

  bitsToByte(bits) {
    if (bits.length !== 8) {
      throw new Error('bitsToByte: Input must be exactly 8 bits');
    }
    let byte = 0;
    for (let i = 0; i < 8; i++) {
      byte |= (bits[i] << (7 - i));
    }
    return byte;
  }
}

// Register the algorithm
RegisterAlgorithm(new HammingAlgorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HammingAlgorithm, HammingInstance };
}