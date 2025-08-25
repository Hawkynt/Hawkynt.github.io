/*
 * Base85 (Ascii85) Encoding Implementation
 * Educational implementation of Base85 encoding with 85-character alphabet
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
        EncodingAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = AlgorithmFramework;

class Base85Algorithm extends EncodingAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Base85";
    this.description = "Base85 (Ascii85) encoding using 85-character alphabet for efficient binary-to-text encoding. Encodes 4 bytes into 5 characters with 25% overhead compared to Base64's 33%. Developed by Adobe for PostScript and used in various applications.";
    this.inventor = "Paul E. Rutter (Adobe)";
    this.year = 1985;
    this.category = CategoryType.ENCODING;
    this.subCategory = "Base Encoding";
    this.securityStatus = SecurityStatus.EDUCATIONAL;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("Adobe PostScript Language Reference", "https://www.adobe.com/products/postscript/pdfs/PLRM.pdf"),
      new LinkItem("RFC 1924 - IPv6 Address Encoding", "https://tools.ietf.org/html/rfc1924"),
      new LinkItem("Base85 Wikipedia Article", "https://en.wikipedia.org/wiki/Ascii85")
    ];

    this.references = [
      new LinkItem("Base85 Online Encoder/Decoder", "https://base85.io/"),
      new LinkItem("Adobe Ascii85 Specification", "https://www.adobe.com/devnet/postscript.html"),
      new LinkItem("RFC 1924 Compact IPv6 Representation", "https://datatracker.ietf.org/doc/html/rfc1924")
    ];

    this.knownVulnerabilities = [];

    // Test vectors with bit-perfect accuracy
    this.tests = this.createTestVectors();
  }

  createTestVectors() {
    // Ensure OpCodes is available
    if (!global.OpCodes) {
      return [];
    }

    return [
      new TestCase(
        OpCodes.AnsiToBytes(""),
        OpCodes.AnsiToBytes(""),
        "Base85 empty string test",
        "https://en.wikipedia.org/wiki/Ascii85"
      ),
      new TestCase(
        [0, 0, 0, 0],
        OpCodes.AnsiToBytes("z"),
        "Base85 zero compression test - 4 zero bytes to 'z'",
        "https://en.wikipedia.org/wiki/Ascii85"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("Man "),
        OpCodes.AnsiToBytes("O<`^z"),
        "Base85 four character test - 'Man '",
        "https://en.wikipedia.org/wiki/Ascii85"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("M"),
        OpCodes.AnsiToBytes("O#"),
        "Base85 single character test - 'M'",
        "https://en.wikipedia.org/wiki/Ascii85"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("Ma"),
        OpCodes.AnsiToBytes("O<@"),
        "Base85 two character test - 'Ma'",
        "https://en.wikipedia.org/wiki/Ascii85"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("Man"),
        OpCodes.AnsiToBytes("O<`^"),
        "Base85 three character test - 'Man'",
        "https://en.wikipedia.org/wiki/Ascii85"
      ),
      new TestCase(
        OpCodes.AnsiToBytes("sure."),
        OpCodes.AnsiToBytes("b9HiME&"),
        "Base85 five character test - 'sure.'",
        "https://en.wikipedia.org/wiki/Ascii85"
      )
    ];
  }

  CreateInstance(isInverse = false) {
    return new Base85Instance(this, isInverse);
  }
}

class Base85Instance extends IAlgorithmInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    
    // RFC 1924 Base85 alphabet (0-9, A-Z, a-z, and 23 additional characters)
    this.alphabet = OpCodes.AnsiToBytes("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~");
    this.base = 85;
    this.processedData = null;
    
    // Create decode lookup table
    this.decodeTable = {};
    const alphabetStr = String.fromCharCode(...this.alphabet);
    for (let i = 0; i < alphabetStr.length; i++) {
      this.decodeTable[alphabetStr[i]] = i;
    }
    
    // Note: 'z' is handled specially for zero compression, not in regular decode table
  }

  Feed(data) {
    if (!Array.isArray(data)) {
      throw new Error('Base85Instance.Feed: Input must be byte array');
    }

    if (this.isInverse) {
      this.processedData = this.decode(data);
    } else {
      this.processedData = this.encode(data);
    }
  }

  Result() {
    if (this.processedData === null) {
      throw new Error('Base85Instance.Result: No data processed. Call Feed() first.');
    }
    return this.processedData;
  }

  encode(data) {
    if (data.length === 0) {
      return [];
    }

    const result = [];
    const alphabetStr = String.fromCharCode(...this.alphabet);
    
    // Process in groups of 4 bytes
    for (let i = 0; i < data.length; i += 4) {
      const group = [];
      const groupSize = Math.min(4, data.length - i);
      
      // Get the 4-byte group (pad with zeros if necessary)
      for (let j = 0; j < 4; j++) {
        group.push(i + j < data.length ? data[i + j] : 0);
      }
      
      // Convert 4 bytes to 32-bit number (big-endian)
      const num = (group[0] << 24) | (group[1] << 16) | (group[2] << 8) | group[3];
      
      // Special case for all zeros (Adobe Ascii85 optimization)
      if (num === 0 && groupSize === 4) {
        result.push('z'.charCodeAt(0));
      } else {
        // Convert to base85 (5 characters)
        const chars = [];
        let n = num;
        
        for (let k = 0; k < 5; k++) {
          chars.unshift(alphabetStr[n % this.base]);
          n = Math.floor(n / this.base);
        }
        
        // For partial groups, only output the needed characters
        const outputSize = groupSize + 1;
        for (let k = 0; k < outputSize; k++) {
          result.push(chars[k].charCodeAt(0));
        }
      }
    }
    
    return result;
  }

  decode(data) {
    if (data.length === 0) {
      return [];
    }

    const input = String.fromCharCode(...data);
    const result = [];
    
    let i = 0;
    while (i < input.length) {
      const char = input[i];
      
      // Handle special zero compression character
      if (char === 'z') {
        result.push(0, 0, 0, 0);
        i++;
        continue;
      }
      
      // Process 5-character group
      let groupSize = Math.min(5, input.length - i);
      let num = 0;
      
      // Convert base85 characters to number
      for (let j = 0; j < groupSize; j++) {
        const c = input[i + j];
        if (!(c in this.decodeTable)) {
          throw new Error(`Base85Instance.decode: Invalid character '${c}'`);
        }
        num = num * this.base + this.decodeTable[c];
      }
      
      // Handle partial groups by adjusting for missing characters
      for (let j = groupSize; j < 5; j++) {
        num = num * this.base + (this.base - 1);
      }
      
      // Convert back to 4 bytes
      const bytes = [
        (num >>> 24) & 0xFF,
        (num >>> 16) & 0xFF,
        (num >>> 8) & 0xFF,
        num & 0xFF
      ];
      
      // For partial groups, only output the actual data bytes
      const outputSize = Math.max(0, groupSize - 1);
      for (let j = 0; j < outputSize; j++) {
        result.push(bytes[j]);
      }
      
      i += groupSize;
    }
    
    return result;
  }

  // Utility methods for string encoding
  encodeString(str) {
    const bytes = OpCodes.AnsiToBytes(str);
    const encoded = this.encode(bytes);
    return String.fromCharCode(...encoded);
  }

  decodeString(str) {
    const bytes = OpCodes.AnsiToBytes(str);
    const decoded = this.decode(bytes);
    return String.fromCharCode(...decoded);
  }
}

// Create algorithm instance
const algorithm = new Base85Algorithm();

// Register the algorithm
RegisterAlgorithm(algorithm);

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = algorithm;
}