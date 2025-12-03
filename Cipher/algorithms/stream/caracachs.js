/*
 * CARACACHS (PC3) Stream Cipher - Historical Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * CARACACHS (also known as PC3) is a 256-bit variable-key stream cipher created by
 * Alexandre Pukall (pseudonym "Caracachs") in 2000. It was later used by the Lazarus Group
 * (North Korean APT group) in various cyber operations, making it historically significant
 * in the context of state-sponsored cyber warfare.
 *
 * The cipher uses:
 * - Variable key size (1-256 bytes)
 * - Complex key initialization with self-encryption
 * - PRNG-based keystream generation using multiplication and rotation
 * - Stateful operation with internal buffer array
 *
 * SECURITY STATUS: EDUCATIONAL - No formal cryptanalysis available.
 * The cipher's connection to state-sponsored attacks makes it notable for cybersecurity research.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['../../AlgorithmFramework', '../../OpCodes'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../../AlgorithmFramework'),
      require('../../OpCodes')
    );
  } else {
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
          StreamCipherAlgorithm, IAlgorithmInstance,
          TestCase, LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  /**
 * CARACAHSAlgorithm - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class CARACAHSAlgorithm extends StreamCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "CARACACHS (PC3)";
      this.description = "Variable-key stream cipher using PRNG-based keystream generation. Created by Alexandre Pukall in 2000, later used by Lazarus Group (North Korean hackers) in cyber operations.";
      this.inventor = "Alexandre Pukall (pseudonym: Caracachs)";
      this.year = 2000;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.FR; // Based on original French website

      // Algorithm-specific configuration
      this.SupportedKeySizes = [
        new KeySize(1, 256, 0)  // Variable key size 1-256 bytes
      ];
      this.SupportedNonceSizes = [
        new KeySize(0, 0, 0)    // No nonce/IV support
      ];

      // Documentation links
      this.documentation = [
        new LinkItem("Original CARACACHS Implementation", "https://gist.github.com/newsoft/a264f376c8cad3a3e6fc2dd2ae536f5c"),
        new LinkItem("Historical Archive (Internet Archive)", "https://web.archive.org/web/*/http://membres.lycos.fr/caracachs"),
        new LinkItem("Lazarus Group Analysis", "https://www.kaspersky.com/about/press-releases/2017_lazarus-under-the-hood")
      ];

      // Historical significance
      this.references = [
        new LinkItem("PC Cipher Family (PC1-PC4)", "https://gist.github.com/newsoft/"),
        new LinkItem("Lazarus Group Malware Analysis", "https://securelist.com/lazarus-under-the-hood/77908/")
      ];

      // Security considerations
      this.knownVulnerabilities = [
        new Vulnerability(
          "No Formal Cryptanalysis",
          "Cipher has not undergone formal security review or peer analysis",
          "Use only for historical research or compatibility with legacy systems"
        ),
        new Vulnerability(
          "State-Sponsored Usage",
          "Used by Lazarus Group APT, potentially indicating exploitable weaknesses known to nation-state actors",
          "Do not assume security - treat as potentially compromised"
        )
      ];

      // Test vectors from reference implementation
      this.tests = [
        {
          text: "PC3 Reference Vector: 32-byte ASCII key",
          uri: "https://gist.github.com/newsoft/a264f376c8cad3a3e6fc2dd2ae536f5c",
          input: OpCodes.AnsiToBytes("ABCDEFGH"),
          key: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz012345"),
          expected: OpCodes.Hex8ToBytes("F592AD2E34AD59F9")
        },
        {
          text: "PC3 Reference Vector: Zero pattern with 32-byte key",
          uri: "https://gist.github.com/newsoft/a264f376c8cad3a3e6fc2dd2ae536f5c",
          input: OpCodes.AnsiToBytes("00000000"),
          key: OpCodes.AnsiToBytes("abcdefghijklmnopqrstuvwxyz012345"),
          expected: OpCodes.Hex8ToBytes("848639D82AC3D7D6")
        },
        {
          text: "PC3 Short Key Test",
          uri: "https://gist.github.com/newsoft/a264f376c8cad3a3e6fc2dd2ae536f5c",
          input: OpCodes.AnsiToBytes("TEST"),
          key: OpCodes.AnsiToBytes("KEY"),
          expected: OpCodes.Hex8ToBytes("2BB0E377")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new CARACAHSInstance(this, isInverse);
    }
  }

  // Instance class implementing CARACACHS stream cipher
  /**
 * CARACAHS cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class CARACAHSInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse; // Stream ciphers are symmetric
      this._key = null;
      this.inputBuffer = [];

      // CARACACHS internal state
      this.b = new Array(128);      // Buffer array (32-bit unsigned values)
      this.a = 0x015a4e35;          // Multiplier constant
      this.r = 0;                   // Accumulator (16-bit unsigned)
      this.cle = 0;                 // Key-derived array size
      this.initialized = false;
    }

    // Property setter for key
    /**
   * Set encryption/decryption key
   * @param {uint8[]|null} keyBytes - Encryption key or null to clear
   * @throws {Error} If key size is invalid
   */

    set key(keyBytes) {
      if (!keyBytes) {
        this._key = null;
        this.initialized = false;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      const keyLength = keyBytes.length;
      if (keyLength < 1 || keyLength > 256) {
        throw new Error(`Invalid CARACACHS key size: ${keyLength} bytes. Requires 1-256 bytes`);
      }

      this._key = [...keyBytes];
      this._initializeCaracachs();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Feed data to the cipher
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!Array.isArray(data)) {
        throw new Error("Invalid input data - must be byte array");
      }
      if (!this._key) {
        throw new Error("Key not set");
      }

      this.inputBuffer.push(...data);
    }

    // Get the result (encrypted/decrypted data)
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }
      if (this.inputBuffer.length === 0) {
        throw new Error("No data fed");
      }

      const output = [];

      // Process each byte through the stream cipher
      for (let i = 0; i < this.inputBuffer.length; ++i) {
        const byte = this.inputBuffer[i];
        const encrypted = this._processByte(byte);
        output.push(encrypted);
      }

      // Clear input buffer
      this.inputBuffer = [];

      return output;
    }

    // Initialize CARACACHS cipher with key
    _initializeCaracachs() {
      const lngkey = this._key.length;
      const tab = new Array(258);

      // Copy key to tab
      for (let i = 0; i < lngkey; ++i) {
        tab[i] = this._key[i];
      }

      // Calculate cle (key-derived array size)
      const reste = lngkey % 2;
      this.cle = Math.floor(lngkey / 2);
      if (reste !== 0) {
        ++this.cle;
      }

      // Initialize buffer array to zeros
      for (let z = 0; z < 128; ++z) {
        this.b[z] = 0;
      }

      // Pack key bytes into 16-bit words in buffer array
      let y = 0;
      for (let z = 0; z < this.cle; ++z) {
        if (z === (this.cle - 1) && reste !== 0) {
          // Last element is odd byte
          this.b[z] = (this._key[y] * 256) % 65536;
        } else {
          // Pack two bytes into 16-bit word
          this.b[z] = ((this._key[y] * 256) % 65536) + this._key[y + 1];
          ++y;
        }
        ++y;
      }

      // Initialize r and a
      this.r = 0;
      this.a = 0x015a4e35;

      // Initial stream generation (warm-up)
      for (let index = 0; index < this.cle; ++index) {
        for (let z = 0; z <= index; ++z) {
          this._stream(index);
        }
      }

      // Self-encrypt the key material
      for (let i = 0; i < lngkey; ++i) {
        const plain = this._encode(tab[i]);
        tab[i] = OpCodes.XorN(tab[i], plain);
      }

      // Additional mixing rounds
      let i = lngkey - 1;
      for (let z = 1; z <= ((lngkey + 1) * 10); ++z) {
        const plain = this._encode(tab[i]);
        tab[i] = OpCodes.XorN(tab[i], plain);
        ++i;
        if (i >= lngkey) {
          i = 0;
        }
      }

      // Recalculate cle
      this.cle = Math.floor(lngkey / 2);
      if (reste !== 0) {
        ++this.cle;
      }

      // Reinitialize buffer array
      for (let z = 0; z < 128; ++z) {
        this.b[z] = 0;
      }

      // Repack modified key material
      y = 0;
      for (let z = 0; z < this.cle; ++z) {
        if (z === (this.cle - 1) && reste !== 0) {
          this.b[z] = (tab[y] * 256) % 65536;
        } else {
          this.b[z] = ((tab[y] * 256) % 65536) + tab[y + 1];
          ++y;
        }
        ++y;
      }

      // Secure clear of temporary arrays
      OpCodes.ClearArray(tab);

      // Reinitialize r and a
      this.r = 0;
      this.a = 0x015a4e35;

      // Final warm-up
      for (let index = 0; index < this.cle; ++index) {
        for (let z = 0; z <= index; ++z) {
          this._stream(index);
        }
      }

      this.initialized = true;
    }

    // Stream generation function
    _stream(index) {
      // b[index] = (b[index] * a) + 1
      // CRITICAL: Use Math.imul for correct 32-bit integer multiplication
      this.b[index] = OpCodes.ToUint32(Math.imul(this.b[index], this.a) + 1);

      // r = r + ((b[index] shr 16) AND 0x7fff)
      // NOTE: r is treated as 32-bit unsigned in the C code
      this.r = OpCodes.ToUint32(this.r + OpCodes.AndN(OpCodes.Shr32(this.b[index], 16), 0x7FFF));

      // r = (r shl (r%16)) OR (r shr (16-(r%16)))
      // This rotation operates on the full 32-bit value
      const rotAmount = this.r % 16;
      this.r = OpCodes.ToUint32(OpCodes.OrN(OpCodes.Shl32(this.r, rotAmount), OpCodes.Shr32(this.r, (16 - rotAmount))));
    }

    // Encode/decode a single byte (symmetric operation)
    _processByte(byte) {
      // Run stream for cle iterations
      for (let index = 0; index < this.cle; ++index) {
        this._stream(index);
      }

      // XOR byte with r
      const d = byte;
      byte = OpCodes.XorN(byte, OpCodes.AndN(this.r, 0xFF));

      // Update state (r is 32-bit unsigned)
      this.r = OpCodes.ToUint32(this.r + d);
      this.b[this.cle - 1] = OpCodes.ToUint32(this.b[this.cle - 1] + d);

      return byte;
    }

    // Helper function for initialization phase
    _encode(byte) {
      // Run stream for cle iterations
      for (let index = 0; index < this.cle; ++index) {
        this._stream(index);
      }

      // XOR byte with r
      const d = byte;
      byte = OpCodes.XorN(byte, OpCodes.AndN(this.r, 0xFF));

      // Update state (r is 32-bit unsigned)
      this.r = OpCodes.ToUint32(this.r + d);
      this.b[this.cle - 1] = OpCodes.ToUint32(this.b[this.cle - 1] + d);

      return byte;
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new CARACAHSAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { CARACAHSAlgorithm, CARACAHSInstance };
}));
