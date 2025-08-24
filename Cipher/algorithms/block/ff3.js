/*
 * FF3 Format-Preserving Encryption Algorithm Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 * 
 * FF3 (Format-Preserving Encryption) from NIST SP 800-38G (March 2016)
 * DEPRECATED due to security vulnerabilities - included for historical/educational purposes
 * 
 * Educational implementation for learning format-preserving encryption concepts.
 * Shows the differences between FF1 and FF3 approaches.
 * 
 * EDUCATIONAL IMPLEMENTATION ONLY - DO NOT USE IN PRODUCTION
 */

// Load AlgorithmFramework (REQUIRED)
if (!global.AlgorithmFramework && typeof require !== 'undefined') {
  global.AlgorithmFramework = require('../../AlgorithmFramework.js');
}

// Load OpCodes for cryptographic operations (REQUIRED)
if (!global.OpCodes && typeof require !== 'undefined') {
  global.OpCodes = require('../../OpCodes.js');
}

const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode, 
        BlockCipherAlgorithm, IBlockCipherInstance, TestCase, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;
  
class FF3Algorithm extends BlockCipherAlgorithm {
  constructor() {
    super();
    
    // Required metadata
    this.name = "FF3 (DEPRECATED)";
    this.description = "Format-Preserving Encryption from NIST SP 800-38G (March 2016). DEPRECATED due to security vulnerabilities discovered after publication. Educational implementation for historical reference only.";
    this.inventor = "NIST";
    this.year = 2016;
    this.category = CategoryType.BLOCK;
    this.subCategory = "Format-Preserving Encryption";
    this.securityStatus = SecurityStatus.BROKEN;
    this.complexity = ComplexityType.ADVANCED;
    this.country = CountryCode.US;

    // Algorithm-specific metadata
    this.SupportedKeySizes = [
      new KeySize(16, 32, 8) // 128-256 bit AES keys
    ];
    this.SupportedBlockSizes = [
      new KeySize(2, 56, 1) // Variable length strings per NIST spec
    ];

    // FF3 constants
    this.RADIX_MIN = 2;
    this.RADIX_MAX = 65536;
    this.TWEAK_LENGTH = 8; // FF3 requires 64-bit (8 byte) tweak

    // Documentation and references
    this.documentation = [
      new LinkItem("NIST Special Publication 800-38G", "https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-38g.pdf"),
      new LinkItem("FF3 Security Vulnerabilities", "https://eprint.iacr.org/2017/521.pdf"),
      new LinkItem("NIST Withdrawal of FF3-1", "https://csrc.nist.gov/News/2017/Update-to-SP-800-38G")
    ];

    this.references = [
      new LinkItem("FF3 Security Analysis", "https://eprint.iacr.org/2017/521.pdf"),
      new LinkItem("Format-Preserving Encryption Vulnerabilities", "https://blog.cryptographyengineering.com/2016/08/13/format-preserving-encryption-ff1-and/"),
      new LinkItem("NIST SP 800-38G Rev 1", "https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-38g.pdf")
    ];

    // Known vulnerabilities
    this.knownVulnerabilities = [
      new Vulnerability(
        "FF3 Algorithm Deprecated",
        "FF3 was deprecated by NIST in 2017 due to discovered security vulnerabilities",
        "Use FF1 instead of FF3, or modern encryption algorithms like AES"
      ),
      new Vulnerability(
        "Practical distinguishing attacks",
        "FF3 is vulnerable to practical attacks that can distinguish it from a random permutation",
        "FF3 should never be used in production - algorithm is fundamentally broken"
      ),
      new Vulnerability(
        "Educational implementation",
        "This is a simplified educational implementation, not suitable for any use",
        "Do not use FF3 in any application - algorithm has been withdrawn by NIST"
      )
    ];

    // Test vectors from original NIST SP 800-38G (before deprecation)
    this.tests = [
      {
        text: "NIST FF3 Sample (DEPRECATED) - 18 digit decimal",
        uri: "https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-38g.pdf",
        input: OpCodes.AnsiToBytes("890121234567890000"),
        key: OpCodes.Hex8ToBytes("2DE79D232DF5585D68CE47882AE256D6"),
        tweak: OpCodes.Hex8ToBytes("CBD09280979564CB"),
        radix: 10,
        expected: OpCodes.AnsiToBytes("750918814058654607")
      }
    ];
  }

  CreateInstance(isInverse = false) {
    // FF3 is DEPRECATED and BROKEN - do not use in any application
    // FF3 was withdrawn by NIST due to security vulnerabilities
    // Use FF1 or modern encryption algorithms instead
    
    return new FF3Instance(this, isInverse);
  }
}
class FF3Instance extends IBlockCipherInstance {
  constructor(algorithm, isInverse = false) {
    super(algorithm);
    this.isInverse = isInverse;
    this.key = null;
    this.inputBuffer = [];
    this.BlockSize = 0; // Variable size for FF3
    this.KeySize = 0;
    
    // FF3 configuration
    this.radix = 10; // Default to decimal
    this.tweak = []; // Tweak data (8 bytes for FF3)
    
    // FF3 constants
    this.RADIX_MIN = 2;
    this.RADIX_MAX = 65536;
    this.MIN_LEN = 2;
    this.MAX_LEN = 56;
    this.TWEAK_LENGTH = 8; // FF3 requires exactly 64-bit (8 byte) tweak
  }

  set key(keyBytes) {
    if (!keyBytes) {
      this._key = null;
      this.KeySize = 0;
      return;
    }

    // Validate key size (must be 16, 24, or 32 bytes for AES)
    if (keyBytes.length !== 16 && keyBytes.length !== 24 && keyBytes.length !== 32) {
      throw new Error(`Invalid key size: ${keyBytes.length} bytes. FF3 requires 16, 24, or 32 byte AES keys`);
    }

    this._key = [...keyBytes];
    this.KeySize = keyBytes.length;
    
    // For FF3, we need to reverse key bytes (per NIST spec)
    this.keyReversed = [...this._key].reverse();
  }

  get key() {
    return this._key ? [...this._key] : null;
  }

  // Set FF3 parameters
  setRadix(radix) {
    if (radix < this.RADIX_MIN || radix > this.RADIX_MAX) {
      throw new Error(`Invalid radix: ${radix}. Must be between ${this.RADIX_MIN} and ${this.RADIX_MAX}`);
    }
    this.radix = radix;
  }

  setTweak(tweakBytes) {
    if (tweakBytes && tweakBytes.length !== this.TWEAK_LENGTH) {
      throw new Error(`FF3 tweak must be exactly ${this.TWEAK_LENGTH} bytes (64 bits)`);
    }
    this.tweak = tweakBytes ? [...tweakBytes] : new Array(8).fill(0);
  }

  Feed(data) {
    if (!data || data.length === 0) return;
    if (!this.key) throw new Error("Key not set");

    // For FF3, we expect string data that represents numerals
    if (typeof data === 'string') {
      this.inputBuffer.push(...OpCodes.AnsiToBytes(data));
    } else {
      this.inputBuffer.push(...data);
    }
  }

  Result() {
    if (!this.key) throw new Error("Key not set");
    if (this.inputBuffer.length === 0) throw new Error("No data fed");

    // Convert buffer to string
    const inputString = OpCodes.BytesToAnsi(this.inputBuffer);
    
    // Validate input length
    if (inputString.length < this.MIN_LEN || inputString.length > this.MAX_LEN) {
      throw new Error(`Input length must be between ${this.MIN_LEN} and ${this.MAX_LEN} characters`);
    }

    // Process the string with FF3
    const outputString = this.isInverse 
      ? this._decrypt(inputString)
      : this._encrypt(inputString);

    // Clear input buffer
    this.inputBuffer = [];
    
    return OpCodes.AnsiToBytes(outputString);
  }

  // FF3 encryption function (8 rounds instead of 10 like FF1)
  _encrypt(plaintext) {
    // Convert string to numerals based on radix
    const X = this._stringToNumerals(plaintext);
    const n = X.length;
    
    if (n < this.MIN_LEN || n > this.MAX_LEN) {
      throw new Error(`FF3: Invalid plaintext length ${n}. Must be between ${this.MIN_LEN} and ${this.MAX_LEN}`);
    }
    
    // Split into two halves (FF3 uses ceiling for first half)
    const u = Math.ceil(n / 2);
    const v = n - u;
    const A = X.slice(0, u);
    const B = X.slice(u);
    
    // Parse tweak into TL and TR
    const TL = this.tweak.slice(0, 4);
    const TR = this.tweak.slice(4, 8);
    
    // FF3 has 8 rounds
    for (let i = 0; i < 8; i++) {
      let W;
      if (i % 2 === 0) {
        // Even round: use TR
        W = [...TR];
      } else {
        // Odd round: use TL  
        W = [...TL];
      }
      
      // XOR with round number
      W[3] ^= i;
      
      // Convert B to bytes and combine with W
      const bInt = this._numeralStringToInt(B);
      const bBytes = [
        (bInt >>> 24) & 0xFF,
        (bInt >>> 16) & 0xFF,
        (bInt >>> 8) & 0xFF,
        bInt & 0xFF
      ];
      
      // Combine W and B bytes for AES input
      const P = [...W, ...bBytes, 0, 0, 0, 0, 0, 0, 0, 0];
      
      // Simplified AES encryption
      const S = this._aesEncrypt(P);
      
      // Extract y from S
      let y = 0;
      for (let j = 0; j < 4; j++) {
        y = (y << 8) | S[j];
      }
      
      // Calculate c
      const aInt = this._numeralStringToInt(A);
      const modulus = Math.pow(this.radix, A.length);
      const c = (aInt + y) % modulus;
      const C = this._intToNumeralString(c, A.length);
      
      // Swap for next round
      A.splice(0, A.length, ...B);
      B.splice(0, B.length, ...C);
    }
    
    return this._numeralsToString([...A, ...B]);
  }
  // FF3 decryption function  
  _decrypt(ciphertext) {
    // Convert string to numerals based on radix
    const Y = this._stringToNumerals(ciphertext);
    const n = Y.length;
    
    // Split into two halves
    const u = Math.ceil(n / 2);
    const v = n - u;
    const A = Y.slice(0, u);
    const B = Y.slice(u);
    
    // Parse tweak
    const TL = this.tweak.slice(0, 4);
    const TR = this.tweak.slice(4, 8);
    
    // FF3 rounds in reverse (7 down to 0)
    for (let i = 7; i >= 0; i--) {
      let W;
      if (i % 2 === 0) {
        W = [...TR];
      } else {
        W = [...TL];
      }
      
      W[3] ^= i;
      
      const aInt = this._numeralStringToInt(A);
      const aBytes = [
        (aInt >>> 24) & 0xFF,
        (aInt >>> 16) & 0xFF,
        (aInt >>> 8) & 0xFF,
        aInt & 0xFF
      ];
      
      const P = [...W, ...aBytes, 0, 0, 0, 0, 0, 0, 0, 0];
      const S = this._aesEncrypt(P);
      
      let y = 0;
      for (let j = 0; j < 4; j++) {
        y = (y << 8) | S[j];
      }
      
      const bInt = this._numeralStringToInt(B);
      const modulus = Math.pow(this.radix, B.length);
      const c = (bInt - y + modulus) % modulus;
      const C = this._intToNumeralString(c, B.length);
      
      // Swap for next round
      B.splice(0, B.length, ...A);
      A.splice(0, A.length, ...C);
    }
    
    return this._numeralsToString([...A, ...B]);
  }
  // Helper functions for FF3 processing
  
  // Simplified AES encryption function (educational implementation)
  _aesEncrypt(plaintext) {
    // Simplified AES-like encryption using reversed key
    const result = new Array(16);
    for (let i = 0; i < 16; i++) {
      result[i] = plaintext[i % plaintext.length] ^ this.keyReversed[i % this.KeySize];
      // Apply simple transformation
      result[i] = ((result[i] << 1) | (result[i] >> 7)) & 0xFF;
    }
    return result;
  }
  
  // Convert string to numeral array
  _stringToNumerals(str) {
    const numerals = [];
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      let numeral;
      
      if (char >= '0' && char <= '9') {
        numeral = char.charCodeAt(0) - 48;
      } else if (char >= 'a' && char <= 'z') {
        numeral = char.charCodeAt(0) - 87;
      } else if (char >= 'A' && char <= 'Z') {
        numeral = char.charCodeAt(0) - 55;
      } else {
        throw new Error('FF3: Invalid character in input string');
      }
      
      if (numeral >= this.radix) {
        throw new Error('FF3: Character not valid for specified radix');
      }
      numerals.push(numeral);
    }
    return numerals;
  }
  
  // Convert numeral array to string
  _numeralsToString(numerals) {
    let result = '';
    for (let i = 0; i < numerals.length; i++) {
      const numeral = numerals[i];
      if (numeral < 10) {
        result += String.fromCharCode(48 + numeral);
      } else if (numeral < 36) {
        result += String.fromCharCode(87 + numeral);
      } else {
        throw new Error('FF3: Invalid numeral value');
      }
    }
    return result;
  }
  
  // Numeral string to big integer (simplified)
  _numeralStringToInt(numerals) {
    let result = 0;
    for (let i = 0; i < numerals.length; i++) {
      result = result * this.radix + numerals[i];
    }
    return result;
  }
  
  // Big integer to numeral string (simplified)
  _intToNumeralString(value, length) {
    const numerals = [];
    for (let i = 0; i < length; i++) {
      numerals.unshift(value % this.radix);
      value = Math.floor(value / this.radix);
    }
    return numerals;
  }
}

// Register the algorithm
RegisterAlgorithm(new FF3Algorithm());