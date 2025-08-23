/*
 * LZ77 Sliding Window Compression Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * LZ77 dictionary-based compression using sliding window technique.
 * Encodes data as (distance, length, literal) tuples by finding matches in history buffer.
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
  
class LZ77Compression extends CompressionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "LZ77";
    this.description = "Dictionary-based compression using sliding window technique. Encodes data as (distance, length, literal) tuples by finding matches in a sliding history buffer. Foundation for many modern compression formats like DEFLATE.";
    this.inventor = "Abraham Lempel, Jacob Ziv";
    this.year = 1977;
    this.category = CategoryType.COMPRESSION;
    this.subCategory = "Dictionary";
    this.securityStatus = null;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.IL;

    // Configuration parameters
    this.WINDOW_SIZE = 4096;      // Size of sliding window (search buffer)
    this.LOOKAHEAD_SIZE = 18;     // Size of lookahead buffer
    this.MIN_MATCH_LENGTH = 3;    // Minimum match length to encode
    this.MAX_MATCH_LENGTH = 258;  // Maximum match length
    
    // Documentation and references
    this.documentation = [
      new LinkItem("Original LZ77 Paper", "https://ieeexplore.ieee.org/document/1055714"),
      new LinkItem("RFC 1951 - DEFLATE Specification", "https://tools.ietf.org/html/rfc1951"),
      new LinkItem("LZ77 and LZ78 - Wikipedia", "https://en.wikipedia.org/wiki/LZ77_and_LZ78")
    ];

    this.references = [
      new LinkItem("GZIP/zlib Implementation", "https://github.com/madler/zlib"),
      new LinkItem("Educational Implementation", "https://www.cs.duke.edu/csed/curious/compression/lz77.html"),
      new LinkItem("LZSS Variant Analysis", "https://web.archive.org/web/20070823091851/http://www.cs.bell-labs.com/who/sjk/data/lzss.ps")
    ];
    
    // Test vectors - round-trip compression tests
    this.tests = [
      {
        text: "Simple repetitive pattern",
        uri: "https://en.wikipedia.org/wiki/LZ77_and_LZ78",
        input: [65, 65, 66, 67, 65, 65, 66, 67, 65, 66, 67],
        expected: [65, 65, 66, 67, 65, 65, 66, 67, 65, 66, 67] // Round-trip test: should decompress to original
      },
      {
        text: "Long repeated substring",
        uri: "https://tools.ietf.org/html/rfc1951",
        input: [97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 97, 98, 99, 100, 101, 102, 103, 104],
        expected: [97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 97, 98, 99, 100, 101, 102, 103, 104] // Should decompress to original
      },
      {
        text: "Self-overlapping pattern",
        uri: "https://en.wikipedia.org/wiki/LZ77_and_LZ78#Example",
        input: [65, 66, 67, 65, 66, 67, 65, 66, 67, 65, 66, 67, 65, 66, 67],
        expected: [65, 66, 67, 65, 66, 67, 65, 66, 67, 65, 66, 67, 65, 66, 67] // Should decompress to original
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new LZ77Instance(this, isInverse);
  }
}

class LZ77Instance extends IAlgorithmInstance {
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
    const tokens = [];
    
    let position = 0;
    
    while (position < input.length) {
      // Find the longest match in the sliding window
      const match = this._findLongestMatch(input, position);
      
      if (match.length >= this.algorithm.MIN_MATCH_LENGTH) {
        // Encode as (distance, length, next character)
        const nextChar = position + match.length < input.length ? 
                         input[position + match.length] : 0;
        
        tokens.push({
          type: 'match',
          distance: match.distance,
          length: match.length,
          literal: nextChar
        });
        
        position += match.length + (nextChar ? 1 : 0);
      } else {
        // Encode as literal
        tokens.push({
          type: 'literal',
          literal: input[position]
        });
        
        position++;
      }
    }
    
    // Serialize tokens to compressed format
    const compressed = this._serializeTokens(tokens);
    
    // Clear input buffer
    this.inputBuffer = [];
    
    return compressed;
  }
    
  _decompress() {
    const tokens = this._deserializeTokens(this.inputBuffer);
    let output = [];
    
    for (const token of tokens) {
      if (token.type === 'literal') {
        output.push(token.literal);
      } else if (token.type === 'match') {
        // Copy from previous position
        const startPos = output.length - token.distance;
        
        if (startPos < 0) {
          throw new Error('Invalid match distance in compressed data');
        }
        
        // Copy characters (may overlap)
        for (let i = 0; i < token.length; i++) {
          if (startPos + i >= output.length) {
            throw new Error('Invalid match in compressed data');
          }
          output.push(output[startPos + i]);
        }
        
        // Add literal character if present
        if (token.literal) {
          output.push(token.literal);
        }
      }
    }
    
    // Clear input buffer
    this.inputBuffer = [];
    
    return output;
  }
    
  _findLongestMatch(input, position) {
    const windowStart = Math.max(0, position - this.algorithm.WINDOW_SIZE);
    const windowEnd = position;
    const lookaheadEnd = Math.min(input.length, position + this.algorithm.LOOKAHEAD_SIZE);
    
    let bestMatch = { distance: 0, length: 0 };
    
    // Search for matches in the window
    for (let i = windowStart; i < windowEnd; i++) {
      let matchLength = 0;
      
      // Compare bytes starting from position i in window
      // with bytes starting from current position
      while (i + matchLength < windowEnd && 
             position + matchLength < lookaheadEnd &&
             input[i + matchLength] === input[position + matchLength] &&
             matchLength < this.algorithm.MAX_MATCH_LENGTH) {
        matchLength++;
      }
      
      // Update best match if this one is longer
      if (matchLength > bestMatch.length) {
        bestMatch = {
          distance: position - i,
          length: matchLength
        };
      }
    }
    
    return bestMatch;
  }
    
  _serializeTokens(tokens) {
    const bytes = [];
    
    // Write token count (4 bytes, big-endian)
    const count = tokens.length;
    bytes.push((count >>> 24) & 0xFF);
    bytes.push((count >>> 16) & 0xFF);
    bytes.push((count >>> 8) & 0xFF);
    bytes.push(count & 0xFF);
    
    // Write tokens
    for (const token of tokens) {
      if (token.type === 'literal') {
        bytes.push(0); // Literal marker
        bytes.push(token.literal & 0xFF);
      } else if (token.type === 'match') {
        bytes.push(1); // Match marker
        
        // Distance (2 bytes, big-endian)
        bytes.push((token.distance >>> 8) & 0xFF);
        bytes.push(token.distance & 0xFF);
        
        // Length (1 byte)
        bytes.push(token.length & 0xFF);
        
        // Literal character (may be empty)
        if (token.literal) {
          bytes.push(token.literal & 0xFF);
        } else {
          bytes.push(0); // No literal
        }
      }
    }
    
    return bytes;
  }
    
  _deserializeTokens(bytes) {
    if (bytes.length < 4) {
      throw new Error('Invalid compressed data: too short');
    }
    
    // Read token count
    const count = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    const tokens = [];
    
    let pos = 4;
    for (let i = 0; i < count; i++) {
      if (pos >= bytes.length) {
        throw new Error('Invalid compressed data: unexpected end');
      }
      
      const tokenType = bytes[pos++];
      
      if (tokenType === 0) {
        // Literal token
        if (pos >= bytes.length) {
          throw new Error('Invalid compressed data: incomplete literal');
        }
        
        tokens.push({
          type: 'literal',
          literal: bytes[pos++]
        });
      } else if (tokenType === 1) {
        // Match token
        if (pos + 3 >= bytes.length) {
          throw new Error('Invalid compressed data: incomplete match');
        }
        
        const distance = (bytes[pos] << 8) | bytes[pos + 1];
        const length = bytes[pos + 2];
        const literalCode = bytes[pos + 3];
        
        tokens.push({
          type: 'match',
          distance: distance,
          length: length,
          literal: literalCode !== 0 ? literalCode : null
        });
        
        pos += 4;
      } else {
        throw new Error('Invalid compressed data: unknown token type');
      }
    }
    
    return tokens;
  }
}
    
// Register the algorithm
RegisterAlgorithm(new LZ77Compression());
  
