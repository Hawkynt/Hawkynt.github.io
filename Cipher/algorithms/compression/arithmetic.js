/*
 * Arithmetic Coding Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * Arithmetic coding is a form of entropy encoding used in lossless data compression.
 * Unlike traditional prefix codes, arithmetic coding represents the entire message
 * as a single fraction in the range [0, 1).
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
  
  // Arithmetic Coding constants
  const PRECISION = 16;                    // Bits of precision for arithmetic (reduced for JavaScript)
  const MAX_FREQ = (1 << 14);             // Maximum frequency count
  const MAX_VALUE = (1 << PRECISION) - 1; // Maximum value for arithmetic
  const QUARTER = (MAX_VALUE >> 2) + 1;   // Quarter point
  const HALF = QUARTER * 2;               // Half point
  const THREE_QUARTERS = QUARTER * 3;     // Three-quarter point
  
  /**
   * Adaptive frequency model for arithmetic coding
   */
  function FrequencyModel() {
    this.symbols = 256;           // Number of symbols (0-255 + EOF)
    this.frequencies = new Array(this.symbols + 1);
    this.cumulativeFreq = new Array(this.symbols + 2);
    this.totalCount = 0;
    
    // Initialize with uniform distribution
    for (let i = 0; i <= this.symbols; i++) {
      this.frequencies[i] = 1;
    }
    this.updateCumulative();
    
  }
  
  FrequencyModel.prototype.updateCumulative = function() {
    this.cumulativeFreq[0] = 0;
    for (let i = 1; i <= this.symbols + 1; i++) {
      this.cumulativeFreq[i] = this.cumulativeFreq[i - 1] + this.frequencies[i - 1];
    }
    this.totalCount = this.cumulativeFreq[this.symbols + 1];
  };
  
  FrequencyModel.prototype.updateSymbol = function(symbol) {
    // Increment frequency for symbol
    this.frequencies[symbol]++;
    
    // Scale down if total gets too large
    if (this.totalCount >= MAX_FREQ) {
      for (let i = 0; i <= this.symbols; i++) {
        this.frequencies[i] = Math.max(1, Math.floor(this.frequencies[i] / 2));
      }
    }
    
    this.updateCumulative();
  };
  
  FrequencyModel.prototype.getSymbolRange = function(symbol) {
    return {
      low: this.cumulativeFreq[symbol],
      high: this.cumulativeFreq[symbol + 1],
      total: this.totalCount
    };
  };
  
  FrequencyModel.prototype.getSymbolFromValue = function(value, total) {
    const scaledValue = Math.floor((value * this.totalCount) / total);
    
    for (let i = 0; i <= this.symbols; i++) {
      if (scaledValue < this.cumulativeFreq[i + 1]) {
        return i;
      }
    }
    return this.symbols; // EOF symbol
  };
  
  /**
   * Arithmetic encoder
   */
  function ArithmeticEncoder() {
    this.low = 0;
    this.high = MAX_VALUE;
    this.underflowBits = 0;
    this.output = [];
    this.model = new FrequencyModel();
    
  }
  
  ArithmeticEncoder.prototype.encode = function(data) {
    this.output = [];
    this.low = 0;
    this.high = MAX_VALUE;
    this.underflowBits = 0;
    
    // Encode each byte
    for (let i = 0; i < data.length; i++) {
      const symbol = data[i] & 0xFF;
      this.encodeSymbol(symbol);
    }
    
    // Encode EOF symbol
    this.encodeSymbol(this.model.symbols);
    
    // Output final bits
    this.outputBit(this.low >= HALF ? 1 : 0);
    this.underflowBits++;
    while (this.underflowBits > 0) {
      this.outputBit((this.low >= HALF ? 0 : 1));
      this.underflowBits--;
    }
    
    return this.output;
  };
  
  ArithmeticEncoder.prototype.encodeSymbol = function(symbol) {
    const range = this.model.getSymbolRange(symbol);
    const total = range.total;
    
    // Calculate new range
    const rangeSize = this.high - this.low + 1;
    this.high = this.low + Math.floor((rangeSize * range.high) / total) - 1;
    this.low = this.low + Math.floor((rangeSize * range.low) / total);
    
    // Output bits and handle underflow
    while (true) {
      if (this.high < HALF) {
        this.outputBit(0);
      } else if (this.low >= HALF) {
        this.outputBit(1);
        this.low -= HALF;
        this.high -= HALF;
      } else if (this.low >= QUARTER && this.high < THREE_QUARTERS) {
        this.underflowBits++;
        this.low -= QUARTER;
        this.high -= QUARTER;
      } else {
        break;
      }
      
      this.low = (this.low << 1) & MAX_VALUE;
      this.high = ((this.high << 1) | 1) & MAX_VALUE;
    }
    
    // Update model
    this.model.updateSymbol(symbol);
  };
  
  ArithmeticEncoder.prototype.outputBit = function(bit) {
    this.output.push(bit);
    
    // Output underflow bits
    while (this.underflowBits > 0) {
      this.output.push(1 - bit);
      this.underflowBits--;
    }
  };
  
  /**
   * Arithmetic decoder
   */
  function ArithmeticDecoder() {
    this.low = 0;
    this.high = MAX_VALUE;
    this.value = 0;
    this.model = new FrequencyModel();
    
  }
  
  ArithmeticDecoder.prototype.decode = function(bits) {
    this.low = 0;
    this.high = MAX_VALUE;
    this.value = 0;
    this.bitIndex = 0;
    this.bits = bits;
    
    // Initialize value with first PRECISION bits
    for (let i = 0; i < PRECISION && i < bits.length; i++) {
      this.value = (this.value << 1) | bits[i];
    }
    this.bitIndex = PRECISION;
    
    const result = [];
    let maxSymbols = Math.max(1000, bits.length * 2); // Safety limit to prevent infinite loops
    
    while (result.length < maxSymbols) {
      const symbol = this.decodeSymbol();
      
      if (symbol === this.model.symbols) {
        // EOF symbol
        break;
      }
      
      if (symbol < 0 || symbol > 255) {
        // Invalid symbol - break to prevent corruption
        break;
      }
      
      result.push(symbol);
    }
    
    return result;
  };
  
  ArithmeticDecoder.prototype.decodeSymbol = function() {
    const rangeSize = this.high - this.low + 1;
    const scaledValue = this.value - this.low;
    const symbol = this.model.getSymbolFromValue(scaledValue, rangeSize);
    
    const range = this.model.getSymbolRange(symbol);
    const total = range.total;
    
    // Update range
    this.high = this.low + Math.floor((rangeSize * range.high) / total) - 1;
    this.low = this.low + Math.floor((rangeSize * range.low) / total);
    
    // Remove bits and handle underflow
    while (true) {
      if (this.high < HALF) {
        // Do nothing
      } else if (this.low >= HALF) {
        this.value -= HALF;
        this.low -= HALF;
        this.high -= HALF;
      } else if (this.low >= QUARTER && this.high < THREE_QUARTERS) {
        this.value -= QUARTER;
        this.low -= QUARTER;
        this.high -= QUARTER;
      } else {
        break;
      }
      
      this.low = (this.low << 1) & MAX_VALUE;
      this.high = ((this.high << 1) | 1) & MAX_VALUE;
      this.value = ((this.value << 1) | this.inputBit()) & MAX_VALUE;
    }
    
    // Update model
    this.model.updateSymbol(symbol);
    
    return symbol;
  };
  
  ArithmeticDecoder.prototype.inputBit = function() {
    if (this.bitIndex < this.bits.length) {
      return this.bits[this.bitIndex++];
    }
    return 0; // Padding
  };
  
class ArithmeticCoding extends CompressionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Arithmetic Coding";
    this.description = "Arithmetic coding represents the entire message as a single fraction in the range [0,1) using probability models. Unlike prefix codes, achieves optimal compression ratios approaching the Shannon entropy limit.";
    this.inventor = "Jorma Rissanen, Glen Langdon";
    this.year = 1976;
    this.category = CategoryType.COMPRESSION;
    this.subCategory = "Statistical";
    this.securityStatus = null;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.US;

    // Documentation and references
    this.documentation = [
      new LinkItem("Arithmetic Coding - Wikipedia", "https://en.wikipedia.org/wiki/Arithmetic_coding"),
      new LinkItem("Introduction to Data Compression by Khalid Sayood", "http://rahult.com/bookdc/"),
      new LinkItem("Mark Nelson's Data Compression Tutorial", "https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html")
    ];

    this.references = [
      new LinkItem("Nayuki Reference Implementation", "https://github.com/nayuki/Reference-arithmetic-coding"),
      new LinkItem("CABAC in H.264 Standard", "https://en.wikipedia.org/wiki/Context-adaptive_binary_arithmetic_coding"),
      new LinkItem("JPEG 2000 Arithmetic Coding", "https://www.jpeg.org/jpeg2000/")
    ];

    // Test vectors - round-trip compression tests
    this.tests = [
      {
        text: "Empty data compression test",
        uri: "Educational test vector",
        input: [],
        expected: [] // Empty input produces empty output
      },
      {
        text: "Single byte 'A' compression", 
        uri: "Basic compression test",
        input: [65], // 'A'
        expected: [65,189,64] // Compressed output
      },
      {
        text: "Two byte 'AB' compression",
        uri: "Simple pattern test", 
        input: [65, 66], // "AB"
        expected: [65,2,51,64] // Compressed output
      }
    ];
    
  }

  CreateInstance(isInverse = false) {
    return new ArithmeticCodingInstance(this, isInverse);
    
  }
}

class ArithmeticCodingInstance extends IAlgorithmInstance {
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
    // Create fresh encoder for this compression
    const encoder = new ArithmeticEncoder();
    const compressedBits = encoder.encode(this.inputBuffer);
    
    // Convert bits to bytes for output
    const output = [];
    for (let i = 0; i < compressedBits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8 && i + j < compressedBits.length; j++) {
        byte |= (compressedBits[i + j] << (7 - j));
      }
      output.push(byte);
    }
    
    // Clear input buffer
    this.inputBuffer = [];
    
    return output;
    
  }

  _decompress() {
    // Convert bytes to bits
    const bits = [];
    for (let i = 0; i < this.inputBuffer.length; i++) {
      for (let j = 7; j >= 0; j--) {
        bits.push((this.inputBuffer[i] >> j) & 1);
      }
    }
    
    // Create fresh decoder for this decompression
    const decoder = new ArithmeticDecoder();
    const decompressedBytes = decoder.decode(bits);
    
    // Clear input buffer
    this.inputBuffer = [];
    
    return decompressedBytes;
    
  }
}
  
// Register the algorithm
RegisterAlgorithm(new ArithmeticCoding());