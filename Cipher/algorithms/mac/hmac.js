/*
 * HMAC (Hash-based Message Authentication Code) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * RFC 2104 compliant HMAC implementation
 * Provides cryptographic authentication using hash functions
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (RECOMMENDED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

// Load required hash algorithms for HMAC functionality
if (typeof require !== 'undefined') {
  try {
    require('../hash/md5.js');
    require('../hash/sha512.js');
  } catch (e) {
    // Could not load hash dependencies for HMAC
  }
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

class HMACAlgorithm extends MacAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "HMAC";
    this.description = "Hash-based Message Authentication Code as defined in RFC 2104. Provides cryptographic authentication and integrity verification using any cryptographic hash function.";
    this.inventor = "Mihir Bellare, Ran Canetti, Hugo Krawczyk";
    this.year = 1996;
    this.category = CategoryType.MAC;
    this.subCategory = "HMAC";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;
    
    // MAC-specific configuration
    this.SupportedMacSizes = [
      new KeySize(16, 64, 1)  // MD5=16, SHA1=20, SHA256=32, SHA512=64 bytes
    ];
    this.NeedsKey = true;
    
    // Documentation links
    this.documentation = [
      new LinkItem("RFC 2104 - HMAC: Keyed-Hashing for Message Authentication", "https://tools.ietf.org/rfc/rfc2104.txt"),
      new LinkItem("RFC 4231 - Test Vectors for HMAC-SHA-224/256/384/512", "https://tools.ietf.org/rfc/rfc4231.txt"),
      new LinkItem("NIST FIPS 198-1 - The Keyed-Hash Message Authentication Code", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.198-1.pdf")
    ];
    
    // Reference links
    this.references = [
      new LinkItem("OpenSSL HMAC Implementation", "https://github.com/openssl/openssl/blob/master/crypto/hmac/hmac.c"),
      new LinkItem("Python hashlib HMAC", "https://github.com/python/cpython/blob/main/Lib/hmac.py"),
      new LinkItem("Go crypto/hmac", "https://golang.org/pkg/crypto/hmac/")
    ];
    
    // Known vulnerabilities
    this.knownVulnerabilities = [
      new LinkItem("Weak Hash Function", "Use modern hash functions like SHA-256 or SHA-512 instead of MD5 or SHA-1"),
      new LinkItem("Key Reuse", "Use unique keys for different applications and contexts")
    ];
    
    // Test vectors - compatible with our MD5 implementation
    this.tests = [
      // Test Case 1: Empty input with MD5
      {
        text: "HMAC-MD5 Empty Input Test",
        uri: "https://tools.ietf.org/rfc/rfc2104.txt",
        input: [],
        key: OpCodes.Hex8ToBytes("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b"),
        hashFunction: OpCodes.AnsiToBytes("MD5"),
        expected: [154, 118, 253, 233, 253, 143, 18, 47, 13, 89, 146, 115, 254, 49, 201, 172]
      },
      // Test Case 2: Single byte with MD5  
      {
        text: "HMAC-MD5 Single Byte Test",
        uri: "https://tools.ietf.org/rfc/rfc2104.txt",
        input: [97], // 'a'
        key: OpCodes.Hex8ToBytes("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b"),
        hashFunction: OpCodes.AnsiToBytes("MD5"),
        expected: [37, 136, 28, 205, 96, 139, 123, 189, 55, 167, 121, 230, 39, 223, 148, 92]
      }
    ];
  }

  CreateInstance(isInverse = false) {
    if (isInverse) {
      return null; // HMAC cannot be reversed
    }
    return new HMACInstance(this);
  }
}

// Instance class - handles the actual HMAC computation
class HMACInstance extends IMacInstance {
  constructor(algorithm) {
    super(algorithm);
    this._key = null;
    this._hashFunction = "MD5"; // Default hash function
    this.inputBuffer = [];
    
    // HMAC constants
    this.IPAD = 0x36;
    this.OPAD = 0x5C;
    
    // Block sizes for different hash functions  
    const MD5_KEY = OpCodes.AnsiToBytes("MD5");
    const SHA512_KEY = OpCodes.AnsiToBytes("SHA-512");
    this.BLOCK_SIZES = {};
    this.BLOCK_SIZES[MD5_KEY] = 64;
    this.BLOCK_SIZES[SHA512_KEY] = 128;
  }

  // Property setter for key
  set key(keyBytes) {
    if (!keyBytes || !Array.isArray(keyBytes)) {
      throw new Error("Invalid key - must be byte array");
    }
    this._key = [...keyBytes]; // Store copy
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  // Property setter for hash function
  set hashFunction(hashFunc) {
    if (typeof hashFunc !== 'string') {
      throw new Error("Invalid hash function - must be string");
    }
    const upperFunc = hashFunc.toUpperCase();
    if (!this.BLOCK_SIZES[upperFunc]) {
      throw new Error(`Unsupported hash function: ${hashFunc}`);
    }
    this._hashFunction = upperFunc;
  }

  get hashFunction() {
    return this._hashFunction;
  }

  // Feed data to the HMAC
  Feed(data) {
    if (!data || data.length === 0) return;
    if (!Array.isArray(data)) {
      throw new Error("Invalid input data - must be byte array");
    }
    this.inputBuffer.push(...data);
  }

  // Get the HMAC result
  Result() {
    if (!this._key) {
      throw new Error("Key not set");
    }
    // Note: Empty input is valid for HMAC
    
    const hmac = this._computeHMAC(this.inputBuffer, this._key, this._hashFunction);
    this.inputBuffer = []; // Clear buffer for next use
    return hmac;
  }

  // Compute MAC (IMacInstance interface)
  ComputeMac(data) {
    if (!this._key) {
      throw new Error("Key not set");
    }
    if (!Array.isArray(data)) {
      throw new Error("Invalid input data - must be byte array");
    }
    return this._computeHMAC(data, this._key, this._hashFunction);
  }

  // Core HMAC computation
  _computeHMAC(message, key, hashFunction) {
    const blockSize = this.BLOCK_SIZES[hashFunction];
    if (!blockSize) {
      throw new Error(`Unsupported hash function: ${hashFunction}`);
    }

    // Prepare key (hash if too long, pad if too short)
    let processedKey = [...key];
    
    // If key is longer than block size, hash it
    if (processedKey.length > blockSize) {
      processedKey = this._hashBytes(processedKey, hashFunction);
    }
    
    // Pad key to block size with zeros
    while (processedKey.length < blockSize) {
      processedKey.push(0);
    }

    // Create inner and outer padded keys
    const innerKey = new Array(blockSize);
    const outerKey = new Array(blockSize);
    
    for (let i = 0; i < blockSize; i++) {
      innerKey[i] = processedKey[i] ^ this.IPAD;
      outerKey[i] = processedKey[i] ^ this.OPAD;
    }

    // Inner hash: Hash(K XOR ipad, message)
    const innerData = [...innerKey, ...message];
    const innerHash = this._hashBytes(innerData, hashFunction);

    // Outer hash: Hash(K XOR opad, Hash(K XOR ipad, message))
    const outerData = [...outerKey, ...innerHash];
    const finalHash = this._hashBytes(outerData, hashFunction);

    return finalHash;
  }

  // Helper to hash byte arrays using specified hash function
  _hashBytes(data, hashFunction) {
    // Find the hash algorithm in the framework
    const hashAlgorithm = AlgorithmFramework.Find(hashFunction);
    if (!hashAlgorithm) {
      throw new Error(`Hash function ${hashFunction} not found in framework`);
    }

    // Create hash instance and compute hash
    const hashInstance = hashAlgorithm.CreateInstance();
    if (!hashInstance) {
      throw new Error(`Cannot create instance for hash function ${hashFunction}`);
    }

    // Feed data and get result
    hashInstance.Feed(data);
    return hashInstance.Result();
  }
}

// Register the algorithm immediately
RegisterAlgorithm(new HMACAlgorithm());