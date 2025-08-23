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
    this.securityStatus = SecurityStatus.EDUCATIONAL; // Changed from SECURE
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;
    
    // MAC-specific configuration
    this.SupportedMacSizes = [
      new KeySize(16, 16, 0)  // Poly1305 produces 16-byte MAC
    ];
    this.NeedsKey = true;
    
    // Test vectors from RFC 7539
    this.tests = [
      // Test Case 1: RFC 7539 Section 2.5.2
      new TestCase(
        OpCodes.Hex8ToBytes("43727970746f6772617068696320466f72756d2052657365617263682047726f7570"),
        OpCodes.Hex8ToBytes("a8061dc1305136c6c22b8baf0c0127a9"),
        "RFC 7539 Section 2.5.2 - Cryptographic Forum Research Group",
        "https://tools.ietf.org/html/rfc7539"
      ),
      // Test Case 2: Empty message
      new TestCase(
        [],
        OpCodes.Hex8ToBytes("49ec78090e481ec6c26b33b91ccc0307"),
        "RFC 7539 Empty Message Test",
        "https://tools.ietf.org/html/rfc7539"
      )
    ];
    
    // Set keys for test vectors
    this.tests[0].key = OpCodes.Hex8ToBytes("85d6be7857556d337f4452fe42d506a80103808afb0db2fd4abff6af4149f51b");
    this.tests[1].key = OpCodes.Hex8ToBytes("746869732069732033322d62797465206b657920666f7220506f6c7931333035");
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
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  // Feed data to the MAC
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!Array.isArray(data)) {
      throw new Error("Invalid input data - must be byte array");
    }
    this.inputBuffer.push(...data);
  }

  // Get the MAC result
  Result() {
    if (!this._key) {
      throw new Error("Key not set");
    }
    
    return this.poly1305(this._key, this.inputBuffer);
  }

  // Compute MAC (IMacInstance interface)
  ComputeMac(data) {
    if (!this._key) {
      throw new Error("Key not set");
    }
    if (!Array.isArray(data)) {
      throw new Error("Invalid input data - must be byte array");
    }
    
    return this.poly1305(this._key, data);
  }
  
  /**
   * Simplified Poly1305 implementation following RFC 7539
   * Uses straightforward arithmetic instead of complex field operations
   */
  poly1305(key, message) {
    // Split key: r (first 16 bytes) and s (last 16 bytes)
    const r = key.slice(0, 16);
    const s = key.slice(16, 32);
    
    // Clamp r according to Poly1305 specification
    r[3] &= 15;  r[7] &= 15;   r[11] &= 15;  r[15] &= 15;
    r[4] &= 252; r[8] &= 252;  r[12] &= 252;
    
    // Convert r and s to little-endian 32-bit words
    const rLimbs = this.bytesToLimbs(r);
    const sLimbs = this.bytesToLimbs(s);
    
    let h = [0, 0, 0, 0, 0]; // 130-bit accumulator as 5 x 26-bit limbs
    
    // Process message in 16-byte blocks
    const msg = [...message];
    while (msg.length > 0) {
      // Get next block (pad if necessary)
      const block = new Array(16).fill(0);
      let blockLen = Math.min(16, msg.length);
      
      for (let i = 0; i < blockLen; i++) {
        block[i] = msg.shift();
      }
      
      // Add padding bit if partial block or append 0x01 for complete blocks
      if (blockLen < 16) {
        block[blockLen] = 1;
      } else {
        // For complete 16-byte blocks, add 2^128 by setting high bit
        block[16] = 1; // This will be handled in conversion to limbs
      }
      
      // Convert block to limbs, adding high bit for complete blocks
      const n = this.bytesToLimbs(block.slice(0, 16));
      if (blockLen === 16) {
        n[4] |= 0x1000000; // Set bit 24 of limb 4 (which is bit 128 overall)
      }
      
      // h = (h + n) * r mod (2^130-5)
      h = this.addLimbs(h, n);
      h = this.mulMod(h, rLimbs);
    }
    
    // Final step: h = h + s mod 2^128
    h[4] &= 0x03; // Clear high bits to reduce mod 2^128
    const finalH = this.addLimbs(h, sLimbs);
    finalH[4] &= 0x03; // Ensure result is mod 2^128
    
    // Convert back to bytes
    return this.limbsToBytes(finalH);
  }
  
  /**
   * Convert 16 bytes to 5 x 26-bit limbs
   */
  bytesToLimbs(bytes) {
    const limbs = new Array(5);
    limbs[0] = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | ((bytes[3] & 0x3) << 24);
    limbs[1] = ((bytes[3] >> 2) | (bytes[4] << 6) | (bytes[5] << 14) | ((bytes[6] & 0xf) << 22)) >>> 0;
    limbs[2] = ((bytes[6] >> 4) | (bytes[7] << 4) | (bytes[8] << 12) | ((bytes[9] & 0x3f) << 20)) >>> 0;
    limbs[3] = ((bytes[9] >> 6) | (bytes[10] << 2) | (bytes[11] << 10) | (bytes[12] << 18)) >>> 0;
    limbs[4] = (bytes[13] | (bytes[14] << 8) | (bytes[15] << 16)) >>> 0;
    return limbs;
  }
  
  /**
   * Convert 5 x 26-bit limbs to 16 bytes
   */
  limbsToBytes(limbs) {
    // Normalize limbs first
    let carry = 0;
    const norm = new Array(5);
    for (let i = 0; i < 5; i++) {
      carry += limbs[i];
      norm[i] = carry & 0x3ffffff;
      carry >>>= 26;
    }
    
    const bytes = new Array(16);
    bytes[0] = norm[0] & 0xff;
    bytes[1] = (norm[0] >>> 8) & 0xff;
    bytes[2] = (norm[0] >>> 16) & 0xff;
    bytes[3] = ((norm[0] >>> 24) | (norm[1] << 2)) & 0xff;
    bytes[4] = (norm[1] >>> 6) & 0xff;
    bytes[5] = (norm[1] >>> 14) & 0xff;
    bytes[6] = ((norm[1] >>> 22) | (norm[2] << 4)) & 0xff;
    bytes[7] = (norm[2] >>> 4) & 0xff;
    bytes[8] = (norm[2] >>> 12) & 0xff;
    bytes[9] = ((norm[2] >>> 20) | (norm[3] << 6)) & 0xff;
    bytes[10] = (norm[3] >>> 2) & 0xff;
    bytes[11] = (norm[3] >>> 10) & 0xff;
    bytes[12] = (norm[3] >>> 18) & 0xff;
    bytes[13] = norm[4] & 0xff;
    bytes[14] = (norm[4] >>> 8) & 0xff;
    bytes[15] = (norm[4] >>> 16) & 0xff;
    
    return bytes;
  }
  
  /**
   * Add two 5-limb numbers
   */
  addLimbs(a, b) {
    const result = new Array(5);
    let carry = 0;
    for (let i = 0; i < 5; i++) {
      carry += a[i] + b[i];
      result[i] = carry & 0x3ffffff;
      carry >>>= 26;
    }
    return result;
  }
  
  /**
   * Multiply and reduce mod (2^130-5)
   */
  mulMod(a, b) {
    // Schoolbook multiplication
    const t = new Array(10).fill(0);
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        t[i + j] += a[i] * b[j];
      }
    }
    
    // Reduce: t[5..9] contribute to t[0..4] with factor 5
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
    
    // Final reduction step
    carry *= 5;
    for (let i = 0; i < 5; i++) {
      carry += result[i];
      result[i] = carry & 0x3ffffff;
      carry >>>= 26;
    }
    
    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new Poly1305Algorithm());

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Poly1305Algorithm;
}