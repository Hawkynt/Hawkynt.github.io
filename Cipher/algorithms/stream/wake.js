(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
    // Browser/Worker global
    factory(root.AlgorithmFramework, root.OpCodes);
  }
}((function() {
  if (typeof globalThis !== 'undefined') return globalThis;
  if (typeof window !== 'undefined') return window;
  if (typeof global !== 'undefined') return global;
  if (typeof self !== 'undefined') return self;
  throw new Error('Unable to locate global object');
})(), function (AlgorithmFramework, OpCodes) {
  'use strict';

  if (!AlgorithmFramework) {
    throw new Error('AlgorithmFramework dependency is required');
  }

  if (!OpCodes) {
    throw new Error('OpCodes dependency is required');
  }

  // Extract framework components
  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          StreamCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
   * WAKE (Word Auto Key Encryption) - Table-driven stream cipher
   * Designed by David Wheeler in 1993 for high-speed software encryption.
   * Operates on 32-bit words using a 257-word table and cascaded M() operations.
   * Two variants: WAKE-OFB-LE (little-endian) and WAKE-OFB-BE (big-endian).
   *
   * Security: BROKEN - Vulnerable to chosen plaintext/ciphertext attacks.
   * Use for educational and compatibility purposes only.
   *
   * Implementation note: This cipher requires signed 32-bit integer arithmetic
   * in several places (GenKey function) to match the original C++ reference.
   * The | 0 conversions are intentional for compatibility with the reference.
   */
  class WAKE_Base extends StreamCipherAlgorithm {
    constructor(name, isBigEndian) {
      super();

      this.name = name;
      this.isBigEndian = isBigEndian;
      this.description = "Table-driven stream cipher designed by David Wheeler using 32-bit word operations with auto-key generation. Operates in OFB mode with cascaded M() mixing functions. Known to be vulnerable to chosen plaintext attacks.";
      this.inventor = "David Wheeler";
      this.year = 1993;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.GB;

      // WAKE uses fixed 256-bit (32-byte) keys
      this.SupportedKeySizes = [new KeySize(32, 32, 1)];
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("Wheeler: A Bulk Data Encryption Algorithm", "https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-249.pdf"),
        new LinkItem("Crypto++ WAKE Implementation", "https://github.com/weidai11/cryptopp/blob/master/wake.cpp")
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new WAKEInstance(this, isInverse);
    }
  }

  // WAKE-OFB-LE (Little-Endian output)
  class WAKE_OFB_LE extends WAKE_Base {
    constructor() {
      super("WAKE-OFB-LE", false);

      // Crypto++ Test Vector - WAKE-OFB-LE (little-endian word output)
      // Source: Crypto++ 5.6.1 TestVectors/wake.txt
      this.tests = [
        {
          text: "Crypto++ WAKE-OFB-LE Test Vector",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/wake.txt",
          key: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF"),
          // Plaintext: 80 zero bytes + 80 0x01 bytes = 160 bytes total
          input: new Array(80).fill(0x00).concat(new Array(80).fill(0x01)),
          expected: OpCodes.Hex8ToBytes("FFEEDDCCDF42B9D4939C351568AB4888BD9264CA66CF7F7885141F6934F3F390F1987B8609B733919DC5F73F7BED93ECDCD4F35FF32828553B8AFAD113DDA6565932553D9143AA886AE859167327F3C260434E6C90A0895FD33E6B6412526521FA0B12F4ECEE3E8F4F96DCF70907AAFB5E29C40FC10EB70A4970736E98DF98C615AC844A46FB8E4AEBBBF599DF7B73930B94776C6C8757BE51B34E71E9B514AE")
        }
      ];
    }
  }

  // WAKE-OFB-BE (Big-Endian output)
  class WAKE_OFB_BE extends WAKE_Base {
    constructor() {
      super("WAKE-OFB-BE", true);

      // Crypto++ Test Vector - WAKE-OFB-BE (big-endian word output)
      // Source: Crypto++ 5.6.1 TestVectors/wake.txt
      this.tests = [
        {
          text: "Crypto++ WAKE-OFB-BE Test Vector",
          uri: "https://github.com/weidai11/cryptopp/blob/master/TestVectors/wake.txt",
          key: OpCodes.Hex8ToBytes("00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF"),
          // Plaintext: 80 zero bytes + 80 0x01 bytes = 160 bytes total
          input: new Array(80).fill(0x00).concat(new Array(80).fill(0x01)),
          expected: OpCodes.Hex8ToBytes("CCDDEEFFD4B942DF15359C938848AB68CA6492BD787FCF66691F148590F3F334867B98F19133B7093FF7C59DEC93ED7B5FF3D4DC552828F3D1FA8A3B56A6DD133D55325988AA43911659E86AC2F327736C4E43605F89A090646B3ED321655212F4120BFA8F3EEEECF7DC964FFBAA07090FC4295E0AB70EC16E737049C698DF984A84AC154A8EFB4699F5BBEB93737BDF6C77940BBE57876C714EB351AE14B5E9")
        }
      ];
    }
  }

  // WAKE Instance Implementation
  /**
 * WAKE cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class WAKEInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._key = null;

      // WAKE state: 4 registers + 257-word table
      this.r3 = 0;
      this.r4 = 0;
      this.r5 = 0;
      this.r6 = 0;
      this.t = new Array(257).fill(0);

      // Keystream buffer for byte-level output
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;

      // TT constants from Crypto++ wake.cpp
      this.TT = [
        0x726a8f3b, 0xe69a3b5c, 0xd3c71fe5, 0xab3c73d2,
        0x4d3a8eb3, 0x0396d6e8, 0x3d4c2f7a, 0x9ee27cf3
      ];
    }

    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        return;
      }

      // WAKE requires exactly 32-byte (256-bit) key
      if (keyBytes.length !== 32) {
        throw new Error('Invalid key size: ' + keyBytes.length + ' bytes (WAKE requires 32 bytes)');
      }

      this._key = OpCodes.CopyArray(keyBytes);
      this._keySetup();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? OpCodes.CopyArray(this._key) : null;
    }

    /**
     * WAKE key setup from Crypto++ wake.cpp lines 64-69
     * Key is split into 8 32-bit words (big-endian):
     * - Words 0-3: Initialize r3, r4, r5, r6
     * - Words 4-7: k0, k1, k2, k3 for GenKey()
     */
    _keySetup() {
      if (!this._key) return;

      // Read 8 32-bit words from key (big-endian as per Crypto++)
      var words = [];
      for (var i = 0; i < 8; i++) {
        var offset = i * 4;
        words.push(OpCodes.Pack32BE(
          this._key[offset],
          this._key[offset + 1],
          this._key[offset + 2],
          this._key[offset + 3]
        ));
      }

      // Initialize registers with first 4 words
      this.r3 = words[0];
      this.r4 = words[1];
      this.r5 = words[2];
      this.r6 = words[3];

      // Generate table with last 4 words
      this._genKey(words[4], words[5], words[6], words[7]);

      // Reset keystream buffer
      this.keystreamBuffer = [];
      this.keystreamPosition = 0;
    }

    /**
     * GenKey() function from Crypto++ wake.cpp lines 33-61
     * Generates the 257-word table used by M() function
     *
     * IMPORTANT: The original C++ implementation uses signed 32-bit integers
     * with arithmetic right shift (>>). JavaScript requires explicit conversion
     * to signed integers using | 0 to match this behavior.
     */
    _genKey(k0, k1, k2, k3) {
      // Initialize first 4 entries (using >>> 0 for unsigned)
      this.t[0] = k0 >>> 0;
      this.t[1] = k1 >>> 0;
      this.t[2] = k2 >>> 0;
      this.t[3] = k3 >>> 0;

      // Fill table (lines 42-46)
      // CRITICAL: x must be signed for arithmetic shift to match C++ behavior
      for (var p = 4; p < 256; p++) {
        var x = (this.t[p - 4] + this.t[p - 1]) | 0; // Signed 32-bit
        // Arithmetic shift >> preserves sign, then XOR with TT lookup
        this.t[p] = ((x >> 3) ^ this.TT[x & 7]) >>> 0;
      }

      // Mix first entries (lines 48-49)
      for (var p = 0; p < 23; p++) {
        this.t[p] = OpCodes.Add32(this.t[p], this.t[p + 89]);
      }

      // Change top byte to permutation (lines 50-54)
      // CRITICAL: x and z must be signed integers for correct overflow behavior
      var x = this.t[33] | 0;
      var z = (this.t[59] | 0x01000001) | 0;
      z = (z & 0xff7fffff) | 0;

      for (var p = 0; p < 256; p++) {
        x = ((x & 0xff7fffff) + z) | 0; // Signed addition with mask
        this.t[p] = ((this.t[p] & 0x00ffffff) ^ x) >>> 0;
      }

      // Further permutation changes (lines 56-60)
      // Exact translation of C++:
      // t[p] = t[y = byte(t[p ^ y] ^ y)];
      // t[y] = t[p + 1];
      this.t[256] = this.t[0];
      var y = x & 0xFF;

      for (var p = 0; p < 256; p++) {
        // y = byte(t[p ^ y] ^ y)
        y = ((this.t[(p ^ y) & 0xFF] ^ y) & 0xFF);
        // t[p] = t[y]
        var temp = this.t[y];
        // t[y] = t[p + 1]
        this.t[y] = this.t[p + 1];
        // Now assign temp to t[p]
        this.t[p] = temp;
      }
    }

    /**
     * M() mixing function from Crypto++ wake.cpp lines 27-31
     * M(x, y) = ((x + y) >> 8) ^ t[(x + y) & 0xFF]
     */
    _M(x, y) {
      var w = OpCodes.Add32(x, y);
      return OpCodes.Shr32(w, 8) ^ this.t[w & 0xFF];
    }

    /**
     * Generate one 32-bit word of keystream (OFB mode)
     * From Crypto++ wake.cpp lines 74-91
     */
    _generateWord() {
      // Output r6, then update cascade
      var output = this.r6;

      this.r3 = this._M(this.r3, this.r6);
      this.r4 = this._M(this.r4, this.r3);
      this.r5 = this._M(this.r5, this.r4);
      this.r6 = this._M(this.r6, this.r5);

      return output >>> 0;
    }

    /**
     * Generate bytes for keystream buffer based on endianness variant
     */
    _generateBlock() {
      var word = this._generateWord();

      // Output word in correct endianness
      if (this.algorithm.isBigEndian) {
        // WAKE-OFB-BE: Big-endian word output
        return OpCodes.Unpack32BE(word);
      } else {
        // WAKE-OFB-LE: Little-endian word output
        return OpCodes.Unpack32LE(word);
      }
    }

    _getNextKeystreamByte() {
      if (this.keystreamPosition >= this.keystreamBuffer.length) {
        this.keystreamBuffer = this._generateBlock();
        this.keystreamPosition = 0;
      }

      return this.keystreamBuffer[this.keystreamPosition++];
    }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push.apply(this.inputBuffer, data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      var output = [];
      for (var i = 0; i < this.inputBuffer.length; i++) {
        var keystreamByte = this._getNextKeystreamByte();
        output.push(this.inputBuffer[i] ^ keystreamByte);
      }

      this.inputBuffer = [];
      return output;
    }
  }

  // ===== REGISTRATION =====

  var wakeLE = new WAKE_OFB_LE();
  var wakeBE = new WAKE_OFB_BE();

  if (!AlgorithmFramework.Find(wakeLE.name)) {
    RegisterAlgorithm(wakeLE);
  }

  if (!AlgorithmFramework.Find(wakeBE.name)) {
    RegisterAlgorithm(wakeBE);
  }

  // ===== EXPORTS =====

  return { WAKE_OFB_LE: WAKE_OFB_LE, WAKE_OFB_BE: WAKE_OFB_BE, WAKEInstance: WAKEInstance };
}));
