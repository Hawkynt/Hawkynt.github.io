/*
 * DES-X (DES eXtended) Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * DES-X by Ron Rivest (1984) - DES with key whitening
 * Block size: 64 bits, Key size: 184 bits (56-bit DES key + 64-bit pre-whitening + 64-bit post-whitening)
 * Uses standard DES with additional XOR keys before and after encryption
 * 
 * Educational implementation for learning cryptographic key whitening techniques.
 * DES-X provides increased resistance to brute-force attacks compared to standard DES.
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (REQUIRED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

// Load DES implementation (REQUIRED for DES-X)
if (typeof require !== 'undefined') {
  require('./des.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

class DESXAlgorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "DES-X";
    this.description = "DES with key whitening by Ron Rivest (1984). Uses 64-bit pre/post-whitening keys with standard DES to increase resistance to brute-force attacks. Educational implementation showing key whitening techniques.";
    this.inventor = "Ronald L. Rivest";
    this.year = 1984;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Block Cipher";
    this.securityStatus = SecurityStatus.BROKEN;
    this.complexity = ComplexityType.INTERMEDIATE;
    this.country = CountryCode.US;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(23, 23, 1) // Fixed 184-bit keys (23 bytes)
    ];
    this.SupportedBlockSizes = [
      new KeySize(8, 8, 1) // Fixed 64-bit blocks (8 bytes)
    ];

    // Documentation and references
    this.documentation = [
      new LinkItem("DES-X Original Specification", "https://people.csail.mit.edu/rivest/pubs.html#Rivest84"),
      new LinkItem("RSA BSAFE DES-X Documentation", "https://web.archive.org/web/20050404121715/http://www.rsasecurity.com/rsalabs/node.asp?id=2229"),
      new LinkItem("Applied Cryptography - DES-X", "https://www.schneier.com/books/applied-cryptography/")
    ];

    this.references = [
      new LinkItem("Crypto++ DES-X Implementation", "https://github.com/weidai11/cryptopp"),
      new LinkItem("Key Whitening in Block Ciphers", "https://eprint.iacr.org/"),
      new LinkItem("DES-X Security Analysis", "https://link.springer.com/chapter/10.1007/BFb0052332")
    ];

    // Known vulnerabilities
    this.knownVulnerabilities = [
      new Vulnerability(
        "Based on DES",
        "DES-X inherits all weaknesses of DES including small key size and susceptibility to differential cryptanalysis",
        "Use modern block ciphers like AES instead of DES-X"
      ),
      new Vulnerability(
        "Key whitening limitations",
        "While key whitening increases security, it doesn't address fundamental DES weaknesses",
        "DES-X is obsolete - use AES or other modern ciphers"
      )
    ];

    // Test vectors for DES-X - these will need to be generated with correct values
    this.tests = [
      {
        text: "DES-X All Zeros Test Vector",
        uri: "https://people.csail.mit.edu/rivest/pubs.html#Rivest84",
        input: OpCodes.Hex8ToBytes("0000000000000000"),
        key: OpCodes.Hex8ToBytes("0000000000000000000000000000000000000000000000"),
        expected: OpCodes.Hex8ToBytes("8CA64DE9C1B123A7") // Placeholder - will be calculated
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new DESXInstance(this, isInverse);
  }
}

class DESXInstance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.inputBuffer = [];
    this.BlockSize = 8;
    this.KeySize = 0;
    
    // DES-X key components
    this.K1 = null; // Pre-whitening key (8 bytes)
    this.K2 = null; // Post-whitening key (8 bytes)
    this.desKey = null; // DES key (7 bytes, padded to 8)
    
    // Cache for DES algorithm
    this._desAlgorithm = null;
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.KeySize = 0;
      this.K1 = null;
      this.K2 = null;
      this.desKey = null;
      return;
    }

    // Validate key size (must be 23 bytes for 184-bit key)
    if (keyBytes.length !== 23) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes. DES-X requires exactly 23 bytes (184 bits)`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    
    // Split 184-bit key into components:
    // K1: bytes 0-7 (64-bit pre-whitening key)
    // DES_K: bytes 8-14 (56-bit DES key, 7 bytes)  
    // K2: bytes 15-22 (64-bit post-whitening key)
    
    this.K1 = keyBytes.slice(0, 8);
    this.desKey = keyBytes.slice(8, 15);
    this.K2 = keyBytes.slice(15, 23);
    
    // Pad DES key to 8 bytes (add parity byte)
    this.desKeyPadded = [...this.desKey, 0x00];
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");

    this.inputBuffer.push(...data);
  }

  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    // Validate input length
    if (this.inputBuffer.length % this.BlockSize !== 0) {
      throw new Error(`Input length must be multiple of ${this.BlockSize} bytes`);
    }

    const output = [];
    
    // Process each 8-byte block
    for (let i = 0; i < this.inputBuffer.length; i += this.BlockSize) {
      const block = this.inputBuffer.slice(i, i + this.BlockSize);
      const processedBlock = this.isInverse 
        ? this._decryptBlock(block) 
        : this._encryptBlock(block);
      output.push(...processedBlock);
    }

    // Clear input buffer
    this.inputBuffer = [];
    
    return output;
  }

  _encryptBlock(block) {
    // Pre-whitening: XOR plaintext with K1
    const preWhitened = [];
    for (let i = 0; i < 8; i++) {
      preWhitened[i] = block[i] ^ this.K1[i];
    }
    
    // Apply DES encryption using working DES implementation
    const desOutput = this._callDES(preWhitened, this.desKeyPadded, false);
    
    // Post-whitening: XOR DES output with K2
    const result = [];
    for (let i = 0; i < 8; i++) {
      result[i] = desOutput[i] ^ this.K2[i];
    }
    
    return result;
  }

  _decryptBlock(block) {
    // Reverse post-whitening: XOR ciphertext with K2
    const postDewhitened = [];
    for (let i = 0; i < 8; i++) {
      postDewhitened[i] = block[i] ^ this.K2[i];
    }
    
    // Apply DES decryption using working DES implementation
    const desOutput = this._callDES(postDewhitened, this.desKeyPadded, true);
    
    // Reverse pre-whitening: XOR DES output with K1
    const result = [];
    for (let i = 0; i < 8; i++) {
      result[i] = desOutput[i] ^ this.K1[i];
    }
    
    return result;
  }

  // Use existing working DES implementation
  _callDES(data, key, decrypt = false) {
    if (data.length !== 8 || key.length !== 8) {
      throw new Error("DES requires 8-byte blocks and keys");
    }

    // Get the working DES algorithm from the registry
    if (!this._desAlgorithm) {
      const algorithms = global.AlgorithmFramework.Algorithms || [];
      this._desAlgorithm = algorithms.find(alg => alg.name === 'DES');
      if (!this._desAlgorithm) {
        throw new Error("DES algorithm not found in registry. Please load DES first.");
      }
    }

    // Create a DES instance
    const desInstance = this._desAlgorithm.CreateInstance(decrypt);
    
    // Set the DES key
    desInstance.key = key;
    
    // Process the data
    desInstance.Feed(data);
    const result = desInstance.Result();
    
    return result;
  }
}

// Register the algorithm
RegisterAlgorithm(new DESXAlgorithm());