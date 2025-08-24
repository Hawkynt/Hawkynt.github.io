/*
 * bcrypt Implementation - Password Hashing Function
 * Adaptive hash function based on Blowfish cipher
 * (c)2006-2025 Hawkynt
 */

if (!global.AlgorithmFramework && typeof require !== 'undefined')
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');

if (!global.OpCodes && typeof require !== 'undefined')
  global.OpCodes = require('../../OpCodes.js');

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        HashFunctionAlgorithm, IHashFunctionInstance, TestCase, LinkItem } = AlgorithmFramework;
  
class BcryptAlgorithm extends HashFunctionAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "bcrypt";
    this.description = "Adaptive password hashing function based on the Blowfish cipher. Designed to be slow and resistant to brute-force attacks with configurable work factor (cost parameter).";
    this.inventor = "Niels Provos, David Mazières";
    this.year = 1999;
    this.category = CategoryType.HASH;
    this.subCategory = "Password Hash";
    this.securityStatus = SecurityStatus.SECURE;
    this.complexity = ComplexityType.HIGH;
    this.country = CountryCode.MULTI;

    // Hash-specific metadata
    this.SupportedOutputSizes = [60]; // Standard bcrypt output length
    
    // Performance and technical specifications
    this.blockSize = 8; // Blowfish block size
    this.outputSize = 60; // Standard bcrypt output length
    
    // Documentation and references
    this.documentation = [
      new LinkItem("Original Paper", "https://www.usenix.org/legacy/publications/library/proceedings/usenix99/provos.html"),
      new LinkItem("RFC (draft)", "https://tools.ietf.org/id/draft-irtf-cfrg-bcrypt-pbkdf-03.html"),
      new LinkItem("OpenBSD Implementation", "https://github.com/openbsd/src/blob/master/lib/libc/crypt/bcrypt.c")
    ];

    this.references = [
      new LinkItem("bcrypt.net", "https://bcrypt-generator.com/"),
      new LinkItem("Security Analysis", "https://security.stackexchange.com/questions/4781/do-any-security-experts-recommend-bcrypt-for-password-storage"),
      new LinkItem("OWASP Guidelines", "https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html")
    ];

    this.knownVulnerabilities = [
      {
        type: "Length Limitation",
        text: "Passwords longer than 72 bytes are truncated",
        mitigation: "Pre-hash long passwords with SHA-256 or use alternative like Argon2"
      },
      {
        type: "Cost Parameter Obsolescence",
        text: "Cost parameter may become insufficient as hardware improves",
        mitigation: "Regularly review and increase cost parameter as needed"
      }
    ];
    
    // Test vectors from OpenBSD
    this.tests = [
      {
        text: "bcrypt Test Vector - 'password' Cost 4",
        uri: "OpenBSD test vectors",
        input: OpCodes.AnsiToBytes("password"),
        expected: OpCodes.AnsiToBytes("$2a$04$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    return new BcryptAlgorithmInstance(this, isInverse);
  }
}

class BcryptAlgorithmInstance extends IHashFunctionInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.OutputSize = 60; // Standard bcrypt output length
    
    // bcrypt constants
    this.BCRYPT_SALT_LEN = 16;
    this.BCRYPT_HASH_LEN = 24;
    this.BCRYPT_MIN_COST = 4;
    this.BCRYPT_MAX_COST = 31;
    
    // Blowfish constants (subset for bcrypt)
    this.BLOWFISH_ROUNDS = 16;
    
    // Base64 encoding table for bcrypt (custom alphabet)
    this.B64_ALPHABET = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    
    // Current configuration
    this.cost = 10;
    this.salt = null;
    this.keyScheduled = false;
  }
    
  // Initialize bcrypt
  Init() {
    this.cost = 10;
    this.salt = null;
    this.keyScheduled = false;
    return true;
  }
    
  // Key setup (cost parameter and optional salt)
  KeySetup(key, options) {
    if (typeof key === 'number') {
      this.cost = Math.max(this.BCRYPT_MIN_COST, Math.min(this.BCRYPT_MAX_COST, key));
    } else if (typeof key === 'string') {
      // Parse bcrypt salt string
      const match = key.match(/^\$2[axy]?\$(\d{2})\$(.{22})/);
      if (match) {
        this.cost = parseInt(match[1]);
        this.salt = this.decodeBase64(match[2]);
      } else {
        this.cost = 10;
      }
    } else {
      this.cost = 10;
    }
    
    if (options) {
      if (options.cost) this.cost = options.cost;
      if (options.salt) this.salt = options.salt;
    }
    
    this.keyScheduled = true;
    return true;
  }
    
  // Generate random salt
  generateSalt() {
    const salt = new Array(this.BCRYPT_SALT_LEN);
    for (let i = 0; i < salt.length; i++) {
      salt[i] = Math.floor(Math.random() * 256);
    }
    return salt;
  }
  
  // bcrypt base64 encoding (different from standard base64)
  encodeBase64(data) {
    let result = '';
    const alphabet = this.B64_ALPHABET;
    
    for (let i = 0; i < data.length; i += 3) {
      const b1 = data[i] || 0;
      const b2 = data[i + 1] || 0;
      const b3 = data[i + 2] || 0;
      
      const combined = (b1 << 16) | (b2 << 8) | b3;
      
      result += alphabet[(combined >>> 18) & 63];
      result += alphabet[(combined >>> 12) & 63];
      result += alphabet[(combined >>> 6) & 63];
      result += alphabet[combined & 63];
    }
    
    return result;
  }
  
  // bcrypt base64 decoding
  decodeBase64(str) {
    const alphabet = this.B64_ALPHABET;
    const result = [];
    
    for (let i = 0; i < str.length; i += 4) {
      const c1 = alphabet.indexOf(str[i] || '.');
      const c2 = alphabet.indexOf(str[i + 1] || '.');
      const c3 = alphabet.indexOf(str[i + 2] || '.');
      const c4 = alphabet.indexOf(str[i + 3] || '.');
      
      const combined = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
      
      result.push((combined >>> 16) & 255);
      if (i + 2 < str.length) result.push((combined >>> 8) & 255);
      if (i + 3 < str.length) result.push(combined & 255);
    }
    
    return result;
  }
  
  // Simplified Blowfish key schedule for bcrypt
  blowfishKeySchedule(password, salt) {
    // This is a simplified educational implementation
    // Production bcrypt would use full Blowfish implementation
    
    const state = new Array(18); // P-array
    const sboxes = [new Array(256), new Array(256), new Array(256), new Array(256)];
    
    // Initialize with pi digits (simplified)
    for (let i = 0; i < 18; i++) {
      state[i] = 0x243F6A88 + i; // Simplified pi constants
    }
    
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < 256; i++) {
        sboxes[s][i] = 0x243F6A88 + s * 256 + i;
      }
    }
    
    // XOR password into P-array
    let passwordIndex = 0;
    for (let i = 0; i < 18; i++) {
      let word = 0;
      for (let j = 0; j < 4; j++) {
        word = (word << 8) | (password[passwordIndex % password.length] || 0);
        passwordIndex++;
      }
      state[i] ^= word;
    }
    
    return {pArray: state, sBoxes: sboxes};
  }
  
  // Simplified Blowfish encryption
  blowfishEncrypt(keySchedule, left, right) {
    const pArray = keySchedule.pArray;
    
    for (let i = 0; i < this.BLOWFISH_ROUNDS; i++) {
      left ^= pArray[i];
      // Simplified F function
      right ^= ((left + i) >>> 0) ^ 0x5A827999;
      
      // Swap
      const temp = left;
      left = right;
      right = temp;
    }
    
    // Undo last swap
    const temp = left;
    left = right;
    right = temp;
    
    right ^= pArray[16];
    left ^= pArray[17];
    
    return {left: left >>> 0, right: right >>> 0};
  }
  
  // bcrypt expensive key setup
  expensiveKeySetup(password, salt, cost) {
    let keySchedule = this.blowfishKeySchedule(password, salt);
    
    const iterations = 1 << cost;
    
    // Expensive key stretching
    for (let i = 0; i < iterations; i++) {
      keySchedule = this.blowfishKeySchedule(password, []);
      keySchedule = this.blowfishKeySchedule(salt, []);
    }
    
    return keySchedule;
  }
  
  // Generate bcrypt hash
  hashPassword(password, cost, salt) {
    if (password.length > 72) {
      password = password.slice(0, 72); // Truncate to 72 bytes
    }
    
    cost = cost || this.cost;
    salt = salt || this.salt || this.generateSalt();
    
    // Expensive key setup
    const keySchedule = this.expensiveKeySetup(password, salt, cost);
    
    // Encrypt magic string "OrpheanBeholderScryDoubt" 64 times
    const magic = OpCodes.AnsiToBytes("OrpheanBeholderScryDoubt");
    let ciphertext = OpCodes.CopyArray(magic);
    
    for (let i = 0; i < 64; i++) {
      for (let j = 0; j < ciphertext.length; j += 8) {
        const left = OpCodes.Pack32BE(
          ciphertext[j] || 0, ciphertext[j+1] || 0,
          ciphertext[j+2] || 0, ciphertext[j+3] || 0
        );
        const right = OpCodes.Pack32BE(
          ciphertext[j+4] || 0, ciphertext[j+5] || 0,
          ciphertext[j+6] || 0, ciphertext[j+7] || 0
        );
        
        const encrypted = this.blowfishEncrypt(keySchedule, left, right);
        
        const leftBytes = OpCodes.Unpack32BE(encrypted.left);
        const rightBytes = OpCodes.Unpack32BE(encrypted.right);
        
        for (let k = 0; k < 4; k++) {
          if (j + k < ciphertext.length) ciphertext[j + k] = leftBytes[k];
          if (j + k + 4 < ciphertext.length) ciphertext[j + k + 4] = rightBytes[k];
        }
      }
    }
    
    // Format result
    const version = "$2a$";
    const costStr = cost.toString().padStart(2, '0');
    const saltStr = this.encodeBase64(salt).substring(0, 22);
    const hashStr = this.encodeBase64(ciphertext.slice(0, 23));
    
    return version + costStr + "$" + saltStr + hashStr;
  }
  
  // Verify password against hash
  verifyPassword(password, hash) {
    const match = hash.match(/^\$2[axy]?\$(\d{2})\$(.{22})(.+)$/);
    if (!match) {
      throw new Error('Invalid bcrypt hash format');
    }
    
    const cost = parseInt(match[1]);
    const salt = this.decodeBase64(match[2]);
    
    const computedHash = this.hashPassword(password, cost, salt);
    return OpCodes.SecureCompare(OpCodes.AnsiToBytes(hash), OpCodes.AnsiToBytes(computedHash));
  }
  
  /**
   * Required interface methods for IAlgorithmInstance compatibility
   */
  EncryptBlock(blockIndex, plaintext) {
    // Return hash of the password
    const password = String.fromCharCode.apply(null, plaintext);
    return OpCodes.AnsiToBytes(this.hashPassword(OpCodes.AnsiToBytes(password)));
  }

  DecryptBlock(blockIndex, ciphertext) {
    // Hash functions are one-way
    throw new Error('bcrypt is a one-way password hash function - decryption not possible');
  }

  Hash(message) {
    const password = typeof message === 'string' ? message : String.fromCharCode.apply(null, message);
    return OpCodes.AnsiToBytes(this.hashPassword(OpCodes.AnsiToBytes(password)));
  }

  /**
   * Feed method required by test suite - processes input data
   * @param {Array} data - Input data as byte array
   */
  Feed(data) {
    this._inputData = data;
  }

  /**
   * Result method required by test suite - returns final hash
   * @returns {Array} Hash digest as byte array
   */
  Result() {
    return this.Hash(this._inputData || []);
  }

  Update(data) {
    this._inputData = data;
  }

  Final() {
    return this.Hash(this._inputData || []);
  }

  ClearData() {
    if (this.salt) {
      OpCodes.ClearArray(this.salt);
    }
    this.keyScheduled = false;
  }
}

// Register the algorithm
RegisterAlgorithm(new BcryptAlgorithm());