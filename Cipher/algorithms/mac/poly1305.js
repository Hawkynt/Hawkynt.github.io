/*
 * Poly1305 MAC (Message Authentication Code) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * RFC 7539 compliant Poly1305 implementation
 * Provides one-time authentication using 130-bit field arithmetic
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
        MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

/**
 * Poly1305 large integer arithmetic helpers for 130-bit field operations
 */
const Poly1305Math = {
  /**
   * Add two 130-bit numbers represented as 5 26-bit limbs
   */
  add(a, b) {
    const result = new Array(5);
    let carry = 0;
    
    for (let i = 0; i < 5; i++) {
      carry += a[i] + b[i];
      result[i] = carry & 0x3ffffff; // 26-bit mask
      carry >>>= 26;
    }
    
    return result;
  },
  
  /**
   * Multiply two 130-bit numbers and reduce modulo 2^130-5
   */
  mul(a, b) {
    // Schoolbook multiplication with reduction
    let t = new Array(10).fill(0);
    
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        t[i + j] += a[i] * b[j];
      }
    }
    
    // Reduce modulo 2^130-5
    // High limbs contribute with factor 5 to low limbs
    for (let i = 5; i < 10; i++) {
      t[i - 5] += t[i] * 5;
    }
    
    // Carry propagation
    let carry = 0;
    const result = new Array(5);
    for (let i = 0; i < 5; i++) {
      carry += t[i];
      result[i] = carry & 0x3ffffff;
      carry >>>= 26;
    }
    
    // Final reduction
    carry *= 5;
    for (let i = 0; i < 5; i++) {
      carry += result[i];
      result[i] = carry & 0x3ffffff;
      carry >>>= 26;
    }
    
    return result;
  },
  
  /**
   * Convert 16-byte little-endian to 5x26-bit representation
   */
  fromBytes(bytes) {
    const result = new Array(5);
    
    result[0] = (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | ((bytes[3] & 0x3) << 24)) >>> 0;
    result[1] = (((bytes[3] >>> 2) | (bytes[4] << 6) | (bytes[5] << 14) | ((bytes[6] & 0xf) << 22)) >>> 0);
    result[2] = (((bytes[6] >>> 4) | (bytes[7] << 4) | (bytes[8] << 12) | ((bytes[9] & 0x3f) << 20)) >>> 0);
    result[3] = (((bytes[9] >>> 6) | (bytes[10] << 2) | (bytes[11] << 10) | (bytes[12] << 18)) >>> 0);
    result[4] = ((bytes[13] | (bytes[14] << 8) | (bytes[15] << 16)) >>> 0);
    
    return result;
  },
  
  /**
   * Convert 5x26-bit representation to 16-byte little-endian
   */
  toBytes(limbs) {
    // Normalize limbs first
    let carry = 0;
    const normalized = new Array(5);
    for (let i = 0; i < 5; i++) {
      carry += limbs[i];
      normalized[i] = carry & 0x3ffffff;
      carry >>>= 26;
    }
    
    const result = new Array(16);
    
    result[0] = normalized[0] & 0xff;
    result[1] = (normalized[0] >>> 8) & 0xff;
    result[2] = (normalized[0] >>> 16) & 0xff;
    result[3] = ((normalized[0] >>> 24) | (normalized[1] << 2)) & 0xff;
    result[4] = (normalized[1] >>> 6) & 0xff;
    result[5] = (normalized[1] >>> 14) & 0xff;
    result[6] = ((normalized[1] >>> 22) | (normalized[2] << 4)) & 0xff;
    result[7] = (normalized[2] >>> 4) & 0xff;
    result[8] = (normalized[2] >>> 12) & 0xff;
    result[9] = ((normalized[2] >>> 20) | (normalized[3] << 6)) & 0xff;
    result[10] = (normalized[3] >>> 2) & 0xff;
    result[11] = (normalized[3] >>> 10) & 0xff;
    result[12] = (normalized[3] >>> 18) & 0xff;
    result[13] = normalized[4] & 0xff;
    result[14] = (normalized[4] >>> 8) & 0xff;
    result[15] = (normalized[4] >>> 16) & 0xff;
    
    return result;
  }
};

class Poly1305Algorithm extends MacAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "Poly1305";
    this.description = "One-time message authenticator designed by D.J. Bernstein using 130-bit field arithmetic. Provides information-theoretic security when used with unique keys.";
    this.inventor = "Daniel J. Bernstein";
    this.year = 2005;
    this.category = CategoryType.MAC;
    this.subCategory = "Universal Hashing MAC";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;
    
    // MAC-specific configuration
    this.SupportedMacSizes = [
      new KeySize(16, 16, 1)  // Poly1305 produces 16-byte MAC
    ];
    this.NeedsKey = true;
    
    // Documentation links
    this.documentation = [
      new LinkItem("RFC 7539 - ChaCha20 and Poly1305", "https://tools.ietf.org/html/rfc7539"),
      new LinkItem("Poly1305 Specification", "https://cr.yp.to/mac/poly1305-20050329.pdf"),
      new LinkItem("The Poly1305-AES Message-Authentication Code", "https://www.iacr.org/archive/fse2005/33250419/33250419.pdf")
    ];
    
    // Reference links
    this.references = [
      new LinkItem("NaCl crypto library", "https://nacl.cr.yp.to/"),
      new LinkItem("libsodium Poly1305", "https://libsodium.gitbook.io/doc/advanced/poly1305"),
      new LinkItem("RFC 8439 ChaCha20-Poly1305", "https://tools.ietf.org/html/rfc8439")
    ];
    
    // Known vulnerabilities
    this.knownVulnerabilities = [
      new LinkItem("Key Reuse Attack", "Using the same key twice completely breaks security"),
      new LinkItem("Weak Key Generation", "Keys must be cryptographically random")
    ];
    
    // Test vectors from RFC 7539
    this.tests = [
      // Test Case 1: RFC 7539 Section 2.5.2
      {
        text: "RFC 7539 Section 2.5.2 - Cryptographic Forum Research Group",
        uri: "https://tools.ietf.org/html/rfc7539",
        input: [0x43, 0x72, 0x79, 0x70, 0x74, 0x6f, 0x67, 0x72, 0x61, 0x70, 0x68, 0x69, 0x63, 0x20, 0x46, 0x6f, 0x72, 0x75, 0x6d, 0x20, 0x52, 0x65, 0x73, 0x65, 0x61, 0x72, 0x63, 0x68, 0x20, 0x47, 0x72, 0x6f, 0x75, 0x70],
        key: [0x85, 0xd6, 0xbe, 0x78, 0x57, 0x55, 0x6d, 0x33, 0x7f, 0x44, 0x52, 0xfe, 0x42, 0xd5, 0x06, 0xa8, 0x01, 0x03, 0x80, 0x8a, 0xfb, 0x0d, 0xb2, 0xfd, 0x4a, 0xbf, 0xf6, 0xaf, 0x41, 0x49, 0xf5, 0x1b],
        expected: [0xa8, 0x06, 0x1d, 0xc1, 0x30, 0x51, 0x36, 0xc6, 0xc2, 0x2b, 0x8b, 0xaf, 0x0c, 0x01, 0x27, 0xa9]
      },
      // Test Case 2: Empty message
      {
        text: "RFC 7539 Empty Message Test",
        uri: "https://tools.ietf.org/html/rfc7539", 
        input: [],
        key: [0x74, 0x68, 0x69, 0x73, 0x20, 0x69, 0x73, 0x20, 0x33, 0x32, 0x2d, 0x62, 0x79, 0x74, 0x65, 0x20, 0x6b, 0x65, 0x79, 0x20, 0x66, 0x6f, 0x72, 0x20, 0x50, 0x6f, 0x6c, 0x79, 0x31, 0x33, 0x30, 0x35],
        expected: [0x49, 0xec, 0x78, 0x09, 0x0e, 0x48, 0x1e, 0xc6, 0xc2, 0x6b, 0x33, 0xb9, 0x1c, 0xcc, 0x03, 0x07]
      }
    ];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // Poly1305 cannot be reversed
    }
    return new Poly1305Instance(this);
  }
}

// Instance class - handles the actual Poly1305 computation
class Poly1305Instance extends IMacInstance {
  constructor(algorithm) {
    super(algorithm);
    this._key = null;
    this.inputBuffer = [];
    this.r = null;      // Secret key r (clamped)
    this.s = null;      // Secret key s
    this.h = null;      // Accumulator
  }

  // Property setter for key
  set key(keyBytes) {
    if (!keyBytes || !Array.isArray(keyBytes)) {
      throw new Error("Invalid key - must be byte array");
    }
    if (keyBytes.length !== 32) {
      throw new Error("Poly1305 requires 32-byte key");
    }
    this._key = [...keyBytes]; // Store copy
    this._initializePoly1305();
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  // Initialize Poly1305 with key setup
  _initializePoly1305() {
    if (!this._key) return;
    
    // Split key into r (first 16 bytes) and s (last 16 bytes)
    const rBytes = this._key.slice(0, 16);
    const sBytes = this._key.slice(16, 32);
    
    // Clamp r according to Poly1305 specification
    rBytes[3] &= 15;   // Clear top 4 bits
    rBytes[7] &= 15;
    rBytes[11] &= 15;
    rBytes[15] &= 15;
    
    rBytes[4] &= 252;  // Clear bottom 2 bits
    rBytes[8] &= 252;
    rBytes[12] &= 252;
    
    // Convert to 5x26-bit representation
    this.r = Poly1305Math.fromBytes(rBytes);
    this.s = Poly1305Math.fromBytes(sBytes);
    
    // Initialize accumulator to zero
    this.h = [0, 0, 0, 0, 0];
  }

  // Feed data to the MAC
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!Array.isArray(data)) {
      throw new Error("Invalid input data - must be byte array");
    }
    this.inputBuffer.push(...data);
  }

  // Process a 16-byte block
  _processBlock(block, isLast) {
    // Convert block to 5x26-bit representation
    const blockLimbs = Poly1305Math.fromBytes(block);
    
    // Add high bit (2^128) unless this is the last partial block
    if (!isLast) {
      blockLimbs[4] |= 0x1000000; // Set bit 128
    }
    
    // h = (h + block) * r mod (2^130-5)
    this.h = Poly1305Math.add(this.h, blockLimbs);
    this.h = Poly1305Math.mul(this.h, this.r);
  }

  // Get the MAC result
  Result() {
    if (!this._key) {
      throw new Error("Key not set");
    }
    
    if (!this.r || !this.s || !this.h) {
      throw new Error("Poly1305 not properly initialized");
    }

    // Process complete 16-byte blocks
    const messageBuffer = [...this.inputBuffer];
    
    // Process complete blocks
    while (messageBuffer.length >= 16) {
      const block = messageBuffer.splice(0, 16);
      this._processBlock(block, false);
    }

    // Process any remaining bytes in buffer
    if (messageBuffer.length > 0) {
      // Pad to 16 bytes and add high bit
      const finalBlock = new Array(16).fill(0);
      for (let i = 0; i < messageBuffer.length; i++) {
        finalBlock[i] = messageBuffer[i];
      }
      finalBlock[messageBuffer.length] = 0x01; // Set high bit for padding
      
      this._processBlock(finalBlock, true);
    }
    
    // Add s to get final result and reduce modulo 2^128
    const finalH = Poly1305Math.add(this.h, this.s);
    
    // Reduce modulo 2^128 (clear bit 128 and higher)
    finalH[4] &= 0xffffff; // Clear bits above 128
    
    // Convert back to bytes
    const mac = Poly1305Math.toBytes(finalH);

    // Clear buffer for next use
    this.inputBuffer = [];
    return mac;
  }

  // Compute MAC (IMacInstance interface)
  ComputeMac(data) {
    if (!this._key) {
      throw new Error("Key not set");
    }
    if (!Array.isArray(data)) {
      throw new Error("Invalid input data - must be byte array");
    }
    
    // Feed data and get result
    this.Feed(data);
    return this.Result();
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new Poly1305Algorithm());