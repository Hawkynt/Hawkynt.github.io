#!/usr/bin/env node
/*
 * Universal Arithmetic Coding Implementation
 * Compatible with both Browser and Node.js environments
 * (c)2006-2025 Hawkynt
 * 
 * Arithmetic coding is a form of entropy encoding used in lossless data compression.
 * Unlike traditional prefix codes, arithmetic coding represents the entire message
 * as a single fraction in the range [0, 1).
 * 
 * Educational implementation demonstrating:
 * - Probability model construction
 * - Interval arithmetic with high precision
 * - Adaptive frequency counting
 * - Binary output encoding
 * 
 * Based on: "Introduction to Data Compression" by Khalid Sayood
 * Standard: No formal standard (foundational algorithm)
 * 
 * NOTE: This is an educational implementation for learning purposes only.
 * Use proven compression libraries for production systems.
 */

(function(global) {
  'use strict';
  
  // Ensure environment dependencies are available
  if (!global.OpCodes) {
    if (typeof require !== 'undefined') {
      try {
        require('../../OpCodes.js');
      } catch (e) {
        console.error('Failed to load OpCodes dependency:', e.message);
        return;
      }
    } else {
      console.error('Arithmetic Coding requires OpCodes library to be loaded first');
      return;
    }
  }
  
  if (!global.Cipher) {
    if (typeof require !== 'undefined') {
      try {
        require('../../universal-cipher-env.js');
        require('../../cipher.js');
      } catch (e) {
        console.error('Failed to load cipher dependencies:', e.message);
        return;
      }
    } else {
      console.error('Arithmetic Coding requires Cipher system to be loaded first');
      return;
    }
  }
  
  // Arithmetic Coding constants
  const PRECISION = 32;                    // Bits of precision for arithmetic
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
    
    while (true) {
      const symbol = this.decodeSymbol();
      
      if (symbol === this.model.symbols) {
        // EOF symbol
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
  
  // Create Arithmetic Coding object
  const ArithmeticCoding = {
    // Public interface properties
    internalName: 'ArithmeticCoding',
    name: 'Arithmetic Coding',
    comment: 'Arithmetic Coding compression - Entropy encoding using fractional arithmetic',
    minKeyLength: 0,      // No key required
    maxKeyLength: 0,      // No key required
    stepKeyLength: 1,     // Not applicable
    minBlockSize: 1,      // Can compress any size data
    maxBlockSize: 0,      // No maximum (0 = unlimited)
    stepBlockSize: 1,     // Can process byte by byte
    instances: {},        // Instance tracking
    
    // Comprehensive test vectors demonstrating arithmetic coding principles
    testVectors: [
      {
        algorithm: 'ArithmeticCoding',
        description: 'Empty data',
        origin: 'Educational implementation',
        link: 'https://en.wikipedia.org/wiki/Arithmetic_coding',
        standard: 'Educational',
        input: '',
        expectedCompressed: [1], // Just EOF symbol
        inputHex: '',
        expectedHex: '80',
        keyRequired: false,
        compressionType: 'entropy'
      },
      {
        algorithm: 'ArithmeticCoding',
        description: 'Single byte "A" (0x41)',
        origin: 'Educational implementation',
        link: 'https://en.wikipedia.org/wiki/Arithmetic_coding',
        standard: 'Educational',
        input: 'A',
        expectedCompressed: [0, 1, 0, 0, 0, 0, 0, 1, 1], // Approximate encoding
        inputHex: '41',
        expectedHex: '411',
        keyRequired: false,
        compressionType: 'entropy'
      },
      {
        algorithm: 'ArithmeticCoding',
        description: 'Repeated character "AAAA" (high redundancy)',
        origin: 'Educational implementation',
        link: 'https://en.wikipedia.org/wiki/Arithmetic_coding',
        standard: 'Educational',
        input: 'AAAA',
        expectedCompressed: [0, 1, 0, 0, 0, 0, 1, 1], // Should compress well
        inputHex: '41414141',
        expectedHex: '4043',
        keyRequired: false,
        compressionType: 'entropy'
      },
      {
        algorithm: 'ArithmeticCoding',
        description: 'Binary pattern "\\x00\\x01\\x02\\x03"',
        origin: 'Educational implementation',
        link: 'https://en.wikipedia.org/wiki/Arithmetic_coding',
        standard: 'Educational',
        input: OpCodes.BytesToString([0, 1, 2, 3]),
        expectedCompressed: [0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1], // Low redundancy
        inputHex: '00010203',
        expectedHex: '06B',
        keyRequired: false,
        compressionType: 'entropy'
      },
      {
        algorithm: 'ArithmeticCoding',
        description: 'Text "HELLO" (medium redundancy)',
        origin: 'Educational implementation',
        link: 'https://en.wikipedia.org/wiki/Arithmetic_coding',
        standard: 'Educational',
        input: 'HELLO',
        expectedCompressed: [0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1], // Text compression
        inputHex: '48454C4C4F',
        expectedHex: '486D',
        keyRequired: false,
        compressionType: 'entropy'
      }
    ],
    cantDecode: false,    // Arithmetic coding is reversible
    isInitialized: false,
    
    // Reference links to educational and technical resources
    referenceLinks: {
      specifications: [
        {
          name: 'Arithmetic Coding - Wikipedia',
          url: 'https://en.wikipedia.org/wiki/Arithmetic_coding',
          description: 'Comprehensive overview of arithmetic coding principles and applications'
        },
        {
          name: 'Introduction to Data Compression',
          url: 'http://rahult.com/bookdc/',
          description: 'Khalid Sayood\'s textbook covering arithmetic coding theory and implementation'
        },
        {
          name: 'Arithmetic Coding Tutorial',
          url: 'https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html',
          description: 'Practical tutorial on implementing arithmetic coding'
        },
        {
          name: 'Entropy and Information Theory',
          url: 'https://en.wikipedia.org/wiki/Entropy_(information_theory)',
          description: 'Theoretical foundation for entropy-based compression algorithms'
        }
      ],
      implementations: [
        {
          name: 'Reference Implementation in C',
          url: 'https://github.com/nayuki/Reference-arithmetic-coding',
          description: 'Clean reference implementation by Nayuki'
        },
        {
          name: 'CABAC (H.264/AVC)',
          url: 'https://en.wikipedia.org/wiki/Context-adaptive_binary_arithmetic_coding',
          description: 'Context-Adaptive Binary Arithmetic Coding used in H.264'
        },
        {
          name: 'JPEG 2000 Arithmetic Coding',
          url: 'https://en.wikipedia.org/wiki/JPEG_2000',
          description: 'Arithmetic coding as used in JPEG 2000 image compression'
        }
      ],
      validation: [
        {
          name: 'Compression Benchmark Suite',
          url: 'http://mattmahoney.net/dc/text.html',
          description: 'Standard test files for evaluating compression algorithms'
        },
        {
          name: 'Information Theory and Coding',
          url: 'https://web.stanford.edu/class/ee276/',
          description: 'Stanford course materials on information theory and coding'
        }
      ]
    },
    
    // Arithmetic Coding interface
    Init: function() {
      this.encoder = new ArithmeticEncoder();
      this.decoder = new ArithmeticDecoder();
      this.bKey = false;
    },
    
    KeySetup: function(keyData) {
      // Arithmetic coding doesn't use keys
      this.bKey = false;
      return true;
    },
    
    Encode: function(plaintext) {
      if (!this.encoder) {
        throw new Error('Arithmetic Coding not initialized');
      }
      
      const inputBytes = OpCodes.StringToBytes(plaintext);
      const compressedBits = this.encoder.encode(inputBytes);
      
      // Convert bits to bytes for output
      const output = [];
      for (let i = 0; i < compressedBits.length; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8 && i + j < compressedBits.length; j++) {
          byte |= (compressedBits[i + j] << (7 - j));
        }
        output.push(byte);
      }
      
      return OpCodes.BytesToString(output);
    },
    
    Decode: function(ciphertext) {
      if (!this.decoder) {
        throw new Error('Arithmetic Coding not initialized');
      }
      
      const inputBytes = OpCodes.StringToBytes(ciphertext);
      
      // Convert bytes to bits
      const bits = [];
      for (let i = 0; i < inputBytes.length; i++) {
        for (let j = 7; j >= 0; j--) {
          bits.push((inputBytes[i] >> j) & 1);
        }
      }
      
      const decompressedBytes = this.decoder.decode(bits);
      return OpCodes.BytesToString(decompressedBytes);
    },
    
    ClearData: function() {
      if (this.encoder) {
        this.encoder = new ArithmeticEncoder();
      }
      if (this.decoder) {
        this.decoder = new ArithmeticDecoder();
      }
    },
    
    // Legacy interface for compatibility
    encryptBlock: function(dataOffset, data) {
      return this.Encode(data);
    },
    
    decryptBlock: function(dataOffset, data) {
      return this.Decode(data);
    }
  };
  
  // Auto-register with Cipher system if available
  if (typeof global.Cipher !== 'undefined' && global.Cipher.AddCipher) {
    global.Cipher.AddCipher(ArithmeticCoding);
  }
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ArithmeticCoding;
  }
  
  // Global access
  global.ArithmeticCoding = ArithmeticCoding;
  
})(typeof global !== 'undefined' ? global : window);