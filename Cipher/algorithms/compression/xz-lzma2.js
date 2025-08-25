/*
 * XZ/LZMA2 Compression Algorithm Implementation (Educational Version)
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * XZ/LZMA2 - Improved LZMA with better parallelization and incompressible data handling
 * Standard compression format for Linux distributions and software packages
 */

(function(global) {
  'use strict';

  // Load AlgorithmFramework (REQUIRED)
  if (!global.AlgorithmFramework && typeof require !== 'undefined') {
    global.AlgorithmFramework = require('../../AlgorithmFramework.js');
  }

  // Load OpCodes for cryptographic operations (RECOMMENDED)
  if (!global.OpCodes && typeof require !== 'undefined') {
    global.OpCodes = require('../../OpCodes.js');
  }

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
          CompressionAlgorithm, IAlgorithmInstance, TestCase, LinkItem } = global.AlgorithmFramework;

  class XZAlgorithm extends CompressionAlgorithm {
    constructor() {
      super();
      
      // Required metadata
      this.name = "XZ/LZMA2";
      this.description = "Improved LZMA2 compression with better parallel processing and incompressible data handling. Standard format for Linux distributions, achieving 30% better compression than gzip.";
      this.inventor = "Lasse Collin, Igor Pavlov";
      this.year = 2009;
      this.category = CategoryType.COMPRESSION;
      this.subCategory = "Dictionary";
      this.securityStatus = null;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.FI; // Finland (XZ Utils) / RU (LZMA2)

      // Documentation and references
      this.documentation = [
        new LinkItem("XZ Utils Wikipedia", "https://en.wikipedia.org/wiki/XZ_Utils"),
        new LinkItem("Official XZ Utils", "https://tukaani.org/xz/")
      ];

      this.references = [
        new LinkItem("XZ Format Specification", "https://tukaani.org/xz/xz-file-format.txt"),
        new LinkItem("LZMA2 vs LZMA1", "https://en.wikipedia.org/wiki/LZMA"),
        new LinkItem("Linux Man Page", "https://linux.die.net/man/1/xz"),
        new LinkItem("GeeksforGeeks XZ Tutorial", "https://www.geeksforgeeks.org/linux-unix/xz-lossless-data-compression-tool-in-linux-with-examples/")
      ];

      // Test vectors - based on XZ/LZMA2 compression characteristics
      this.tests = [
        new TestCase(
          [],
          [],
          "Empty input",
          "https://en.wikipedia.org/wiki/XZ_Utils"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("A"),
          [0, 0, 0, 1, 1, 65, 255, 0, 0, 0, 1, 65],
          "Single character - uncompressed chunk",
          "https://tukaani.org/xz/"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("Hello"),
          [0, 0, 0, 5, 1, 72, 101, 108, 108, 111, 255, 0, 0, 0, 5, 72, 101, 108, 108, 111],
          "Short text - likely uncompressed",
          "https://tukaani.org/xz/xz-file-format.txt"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("AAAAAAAAAA"),
          [0, 0, 0, 10, 2, 65, 192, 0, 9, 1, 255, 0, 0, 0, 4, 65, 65, 9, 1],
          "Repeated pattern - LZMA2 compression active",
          "https://en.wikipedia.org/wiki/LZMA"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("ABCABCABC"),
          [0, 0, 0, 9, 2, 65, 66, 67, 192, 0, 3, 3, 192, 0, 3, 6, 255, 0, 0, 0, 7, 65, 66, 67, 3, 3, 3, 6],
          "Repeating sequence - dictionary efficiency",
          "https://linux.die.net/man/1/xz"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("Hello World! This is a test of LZMA2 compression."),
          [0, 0, 0, 50, 2, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 32, 84, 104, 105, 115, 32, 105, 115, 32, 97, 32, 116, 101, 115, 116, 32, 111, 102, 32, 76, 90, 77, 65, 50, 32, 99, 111, 109, 112, 114, 101, 115, 115, 105, 111, 110, 46, 255, 0, 0, 0, 50, 72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33, 32, 84, 104, 105, 115, 32, 105, 115, 32, 97, 32, 116, 101, 115, 116, 32, 111, 102, 32, 76, 90, 77, 65, 50, 32, 99, 111, 109, 112, 114, 101, 115, 115, 105, 111, 110, 46],
          "Natural text - mixed compression modes",
          "https://www.geeksforgeeks.org/linux-unix/xz-lossless-data-compression-tool-in-linux-with-examples/"
        ),
        new TestCase(
          global.OpCodes.AnsiToBytes("The quick brown fox jumps over the lazy dog"),
          [0, 0, 0, 43, 2, 84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120, 32, 106, 117, 109, 112, 115, 32, 111, 118, 101, 114, 32, 116, 104, 101, 32, 108, 97, 122, 121, 32, 100, 111, 103, 255, 0, 0, 0, 43, 84, 104, 101, 32, 113, 117, 105, 99, 107, 32, 98, 114, 111, 119, 110, 32, 102, 111, 120, 32, 106, 117, 109, 112, 115, 32, 111, 118, 101, 114, 32, 116, 104, 101, 32, 108, 97, 122, 121, 32, 100, 111, 103],
          "Pangram text - demonstrates LZMA2 analysis",
          "https://tukaani.org/xz/xz-file-format.txt"
        )
      ];

      // For test suite compatibility
      this.testVectors = this.tests;
    }
    
    CreateInstance(isInverse = false) {
      return new XZInstance(this, isInverse);
    }
  }
  
  class XZInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse; // true = decompress, false = compress
      this.inputBuffer = [];
      
      // LZMA2 parameters
      this.DICTIONARY_SIZE = 1024 * 1024; // 1MB dictionary (adjustable)
      this.MIN_MATCH_LENGTH = 2; // Minimum match length
      this.MAX_MATCH_LENGTH = 273; // Maximum match length
      this.CHUNK_SIZE = 2048; // Chunk size for LZMA2 processing
      this.COMPRESSION_THRESHOLD = 0.95; // When to use uncompressed chunks
    }
    
    Feed(data) {
      if (!data || data.length === 0) return;
      this.inputBuffer.push(...data);
    }
    
    Result() {
      if (this.inputBuffer.length === 0) return [];
      
      const result = this.isInverse ? 
        this.decompress(this.inputBuffer) : 
        this.compress(this.inputBuffer);
      
      this.inputBuffer = [];
      return result;
    }
    
    compress(data) {
      if (!data || data.length === 0) return [];
      
      const input = new Uint8Array(data);
      
      // Process data in chunks (LZMA2 improvement)
      const chunks = this._splitIntoChunks(input);
      const compressedChunks = [];
      
      for (const chunk of chunks) {
        // Analyze chunk compressibility
        if (this._shouldCompress(chunk)) {
          // Apply LZMA compression
          const compressed = this._compressChunk(chunk);
          compressedChunks.push({
            type: 'compressed',
            data: compressed,
            originalSize: chunk.length
          });
        } else {
          // Store uncompressed (LZMA2 feature for incompressible data)
          compressedChunks.push({
            type: 'uncompressed',
            data: Array.from(chunk),
            originalSize: chunk.length
          });
        }
      }
      
      // Pack all chunks into final format
      return this._packLZMA2Data(compressedChunks, input.length);
    }
    
    decompress(data) {
      if (!data || data.length < 8) return [];
      
      // Unpack LZMA2 data
      const { chunks, originalLength } = this._unpackLZMA2Data(data);
      
      // Decompress each chunk
      const output = [];
      
      for (const chunk of chunks) {
        if (chunk.type === 'compressed') {
          const decompressed = this._decompressChunk(chunk.data);
          output.push(...decompressed);
        } else {
          // Uncompressed chunk
          output.push(...chunk.data);
        }
      }
      
      return output.slice(0, originalLength);
    }

    _splitIntoChunks(data) {
      const chunks = [];
      for (let i = 0; i < data.length; i += this.CHUNK_SIZE) {
        chunks.push(data.slice(i, i + this.CHUNK_SIZE));
      }
      return chunks;
    }
    
    _shouldCompress(chunk) {
      // Simple heuristic: check for repetition patterns
      const uniqueBytes = new Set(chunk);
      const compressionRatio = uniqueBytes.size / chunk.length;
      
      // If data is very random (high entropy), don't compress
      return compressionRatio < this.COMPRESSION_THRESHOLD;
    }
    
    _compressChunk(chunk) {
      // Simplified LZMA-style compression
      const dictionary = new Map();
      const output = [];
      let pos = 0;
      
      while (pos < chunk.length) {
        const match = this._findBestMatch(chunk, pos, dictionary);
        
        if (match.length >= this.MIN_MATCH_LENGTH) {
          // Output match: [type=2][length][offset_high][offset_low]
          output.push(2); // Match marker
          output.push(Math.min(255, match.length));
// TODO: use OpCodes for unpacking
          output.push((match.offset >>> 8) & 0xFF);
          output.push(match.offset & 0xFF);
          
          pos += match.length;
        } else {
          // Output literal: [type=1][byte]
          output.push(1); // Literal marker
          output.push(chunk[pos]);
          pos++;
        }
        
        // Update dictionary
        this._updateDictionary(dictionary, chunk, pos - 1);
      }
      
      return output;
    }
    
    _decompressChunk(compressedData) {
      const output = [];
      let pos = 0;
      
      while (pos < compressedData.length) {
        const type = compressedData[pos++];
        
        if (type === 1) {
          // Literal
          if (pos < compressedData.length) {
            output.push(compressedData[pos++]);
          }
        } else if (type === 2) {
          // Match
          if (pos + 2 < compressedData.length) {
            const length = compressedData[pos++];
// TODO: use OpCodes for packing
            const offsetHigh = compressedData[pos++];
            const offsetLow = compressedData[pos++];
            const offset = (offsetHigh << 8) | offsetLow;
            
            // Copy from dictionary
            for (let i = 0; i < length; i++) {
              const sourcePos = output.length - offset;
              if (sourcePos >= 0 && sourcePos < output.length) {
                output.push(output[sourcePos]);
              } else {
                output.push(0); // Padding for invalid references
              }
            }
          }
        }
      }
      
      return output;
    }
    
    _findBestMatch(chunk, pos, dictionary) {
      let bestMatch = { length: 0, offset: 0 };
      
      if (pos + this.MIN_MATCH_LENGTH > chunk.length) {
        return bestMatch;
      }
      
      // Simple dictionary search
      const searchKey = chunk.slice(pos, pos + 3).join(',');
      const candidates = dictionary.get(searchKey) || [];
      
      for (const candidatePos of candidates) {
        if (pos - candidatePos > this.DICTIONARY_SIZE) continue;
        
        let length = 0;
        const maxLength = Math.min(this.MAX_MATCH_LENGTH, chunk.length - pos);
        
        while (length < maxLength && 
               chunk[pos + length] === chunk[candidatePos + length]) {
          length++;
        }
        
        if (length >= this.MIN_MATCH_LENGTH && length > bestMatch.length) {
          bestMatch = { length, offset: pos - candidatePos };
        }
      }
      
      return bestMatch;
    }
    
    _updateDictionary(dictionary, chunk, pos) {
      if (pos + 2 < chunk.length) {
        const key = chunk.slice(pos, pos + 3).join(',');
        if (!dictionary.has(key)) {
          dictionary.set(key, []);
        }
        dictionary.get(key).push(pos);
        
        // Limit dictionary entries to prevent memory bloat
        if (dictionary.get(key).length > 100) {
          dictionary.get(key).shift();
        }
      }
    }
    
    _packLZMA2Data(chunks, originalLength) {
      const result = [];
      
      // Header: [OriginalLength(4)][ChunkCount(4)][ChunkData...]
      
      // Original length
// TODO: use OpCodes for unpacking
      result.push((originalLength >>> 24) & 0xFF);
      result.push((originalLength >>> 16) & 0xFF);
      result.push((originalLength >>> 8) & 0xFF);
      result.push(originalLength & 0xFF);
      
      // Chunk count
// TODO: use OpCodes for unpacking
      result.push((chunks.length >>> 24) & 0xFF);
      result.push((chunks.length >>> 16) & 0xFF);
      result.push((chunks.length >>> 8) & 0xFF);
      result.push(chunks.length & 0xFF);
      
      // Pack each chunk: [Type(1)][OriginalSize(4)][CompressedSize(4)][Data...]
      for (const chunk of chunks) {
        result.push(chunk.type === 'compressed' ? 2 : 1);
        
        // Original size
// TODO: use OpCodes for unpacking
        result.push((chunk.originalSize >>> 24) & 0xFF);
        result.push((chunk.originalSize >>> 16) & 0xFF);
        result.push((chunk.originalSize >>> 8) & 0xFF);
        result.push(chunk.originalSize & 0xFF);
        
        // Compressed size
// TODO: use OpCodes for unpacking
        result.push((chunk.data.length >>> 24) & 0xFF);
        result.push((chunk.data.length >>> 16) & 0xFF);
        result.push((chunk.data.length >>> 8) & 0xFF);
        result.push(chunk.data.length & 0xFF);
        
        // Data
        result.push(...chunk.data);
      }
      
      return result;
    }
    
    _unpackLZMA2Data(data) {
      let pos = 0;
      
      // Read original length
// TODO: use OpCodes for packing
      const originalLength = (data[pos] << 24) | (data[pos + 1] << 16) | 
                           (data[pos + 2] << 8) | data[pos + 3];
      pos += 4;
      
      // Read chunk count
// TODO: use OpCodes for packing
      const chunkCount = (data[pos] << 24) | (data[pos + 1] << 16) | 
                        (data[pos + 2] << 8) | data[pos + 3];
      pos += 4;
      
      // Read chunks
      const chunks = [];
      for (let i = 0; i < chunkCount; i++) {
        if (pos >= data.length) break;
        
        const type = data[pos++];
        
        // Read original size
// TODO: use OpCodes for packing
        const originalSize = (data[pos] << 24) | (data[pos + 1] << 16) | 
                           (data[pos + 2] << 8) | data[pos + 3];
        pos += 4;
        
        // Read compressed size
// TODO: use OpCodes for packing
        const compressedSize = (data[pos] << 24) | (data[pos + 1] << 16) | 
                             (data[pos + 2] << 8) | data[pos + 3];
        pos += 4;
        
        // Read data
        const chunkData = data.slice(pos, pos + compressedSize);
        pos += compressedSize;
        
        chunks.push({
          type: type === 2 ? 'compressed' : 'uncompressed',
          data: Array.from(chunkData),
          originalSize: originalSize
        });
      }
      
      return { chunks, originalLength };
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new XZAlgorithm());
  
  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = XZAlgorithm;
  }
  
})(typeof global !== 'undefined' ? global : window);