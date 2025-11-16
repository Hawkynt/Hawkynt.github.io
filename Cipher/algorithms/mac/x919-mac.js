/*
 * X9.19-MAC (ANSI X9.19, ISO 9807-1 MAC Algorithm 3 Mode 1) Implementation
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Implements the ANSI X9.19 Message Authentication Code, also known as:
 * - ISO 9807-1 MAC Algorithm 3 Mode 1
 * - Retail MAC
 * - DES-MAC with final 3DES
 *
 * Uses DES in CBC mode with special final block processing using 3DES-EDE
 * for anti-forgery protection. Provides 64-bit (8-byte) MAC tags.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['../../AlgorithmFramework', '../../OpCodes', '../block/des'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js/CommonJS
    // Load DES dependency first
    require('../block/des.js');
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
          MacAlgorithm, IMacInstance, TestCase, LinkItem, KeySize, Find } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class X919MACAlgorithm extends MacAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "X9.19-MAC";
      this.description = "ANSI X9.19 Message Authentication Code using DES/3DES. Also known as ISO 9807-1 MAC Algorithm 3 Mode 1 or Retail MAC. Uses DES in CBC mode with 3DES-EDE for the final block.";
      this.inventor = "ANSI (American National Standards Institute)";
      this.year = 1986;
      this.category = CategoryType.MAC;
      this.subCategory = "DES-based MAC";
      this.securityStatus = SecurityStatus.DEPRECATED;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // MAC-specific configuration
      this.SupportedMacSizes = [
        new KeySize(8, 8, 0)  // Fixed 64-bit (8-byte) MAC output
      ];
      this.SupportedKeySizes = [
        new KeySize(8, 8, 0),   // 8 bytes (64-bit) - single DES key
        new KeySize(16, 16, 0)  // 16 bytes (128-bit) - 3DES key
      ];
      this.NeedsKey = true;

      // Documentation links
      this.documentation = [
        new LinkItem("ANSI X9.19 Standard", "https://webstore.ansi.org/standards/ascx9/ansix9191986r1998"),
        new LinkItem("ISO 9807-1:1991", "https://www.iso.org/standard/17743.html"),
        new LinkItem("Botan X9.19-MAC Implementation", "https://botan.randombit.net/handbook/api_ref/mac.html")
      ];

      this.references = [
        new LinkItem("Retail MAC Wikipedia", "https://en.wikipedia.org/wiki/CBC-MAC#Retail_MAC"),
        new LinkItem("Botan Source Code", "https://github.com/randombit/botan/tree/master/src/lib/mac/x919_mac"),
        new LinkItem("NIST SP 800-38B - MAC Modes", "https://csrc.nist.gov/publications/detail/sp/800-38b/final")
      ];

      // Test vectors from Botan official test suite
      this.tests = [
        {
          text: "Botan X9.19-MAC Test Vector #1",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec",
          input: OpCodes.Hex8ToBytes("31311C3931383237333634351C1C35383134333237361C1C3B313233343536373839303132333435363D3939313231303030303F1C30303031323530301C393738363533343132343837363932331C"),
          key: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
          expected: OpCodes.Hex8ToBytes("C156F1B8CDBFB451")
        },
        {
          text: "Botan X9.19-MAC Test Vector #2",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec",
          input: OpCodes.Hex8ToBytes("35383134333237361C3B313233343536373839303132333435363D1C30303031323530301C393738363533343132343837363932331C"),
          key: OpCodes.Hex8ToBytes("0123456789ABCDEF"),
          expected: OpCodes.Hex8ToBytes("AB4884061A159618")
        },
        {
          text: "Botan X9.19-MAC Test Vector #3 (3DES key)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec",
          input: OpCodes.Hex8ToBytes("31311C3931383237333634351C1C35383134333237361C1C3B313233343536373839303132333435363D3939313231303030303F1C30303031323530301C393738363533343132343837363932331C"),
          key: OpCodes.Hex8ToBytes("0123456789ABCDEFFEDCBA9876543210"),
          expected: OpCodes.Hex8ToBytes("C209CCB78EE1B606")
        },
        {
          text: "Botan X9.19-MAC Test Vector #4",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec",
          input: OpCodes.Hex8ToBytes("3330303030323031393543555354303120202020552020202020202020202020202020202020202054303253454154504152594742324C54535435534F414131393935303232373133333934343030303020202020202020202020202020333030303031304139354558413030303030333144"),
          key: OpCodes.Hex8ToBytes("4061610D85685DB0F4D9F1C8FE15A123"),
          expected: OpCodes.Hex8ToBytes("DBE9EB0FA03838D2")
        },
        {
          text: "Botan X9.19-MAC Test Vector #5 (Long message)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec",
          input: OpCodes.Hex8ToBytes("E7EF0EC901CCC8E5E44579A25AAE7FB82FA475ACD95F2DE313C5C2B7BCA63BA395496C9615347CFA7AF59CD4A31C8DD3C0027F9961AD7C75723E2C2EE467D279B13E10C6738CC0ED815DC125794EF8395177D2B2244E27978D53C571BB97EB6CD6FB324987F3360850F72DC9462502979DD449C1227158AFC41E217FB50CEB8B071ED48E110A966102C42A48E92CDF860028482299A0D25EBEF3DD74FFC9FF06E7D494F8DE2A59E0EE8328D8AF075EAF30A6D1C947A3270596057995CE799BB54D2FAD2B5A060C48893420383C7FE76C25B8356C5C5D72F262EB88306423E5B15392DDAD98E9F521"),
          key: OpCodes.Hex8ToBytes("BB296726F91480CDC432AB3067536EAB"),
          expected: OpCodes.Hex8ToBytes("83C4B075AF24AB7C")
        },
        {
          text: "Botan X9.19-MAC Test Vector #6 (Long message)",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/mac/x919_mac.vec",
          input: OpCodes.Hex8ToBytes("12916051C77047C9EFD1E3A43D0086D9899AA28818BCCC5D8B5A0A848682F8981359E9DAC931A4B902875D3F87E318107DBB98967765F302BFFD8645807FDE93D8C76EA1F8125AFB99B83A209B5331190EC9AF852EA287EEA00D33208C11B364D92106D13360CCCC1807EDB45A1ECD68E77CED161E7404BE8137DE0E49927222B378F3E7D9C0B3F1C7A0A521BE7289A6EE76BC0DEAC0CB6BF7AA79403CEC62EF6456D63D168A2FDD2AD4FEE947878F35FD4B42E70B0E5202B8CC43F4B8A5E31CFBBA5A114489EE6E5DEC57A473E6DA70311C573C2AAA3FE2"),
          key: OpCodes.Hex8ToBytes("214B48AB97E144F1005831C8C97B8EF0"),
          expected: OpCodes.Hex8ToBytes("31174049F029EB36")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) {
        return null; // MAC cannot be reversed
      }
      return new X919MACInstance(this);
    }
  }

  // Instance class - handles the actual X9.19-MAC computation
  /**
 * X919MAC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class X919MACInstance extends IMacInstance {
    constructor(algorithm) {
      super(algorithm);
      this._key = null;
      this.inputBuffer = [];
      this.state = new Array(8).fill(0); // 8-byte DES block state
      this.des1 = null;
      this.des2 = null;
      this.position = 0; // Position within current block
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
        this.des1 = null;
        this.des2 = null;
        return;
      }

      if (!Array.isArray(keyBytes)) {
        throw new Error("Invalid key - must be byte array");
      }

      if (keyBytes.length !== 8 && keyBytes.length !== 16) {
        throw new Error("X9.19-MAC requires 8-byte (DES) or 16-byte (3DES) key");
      }

      this._key = [...keyBytes];
      this._initializeDES();
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() {
      return this._key ? [...this._key] : null;
    }

    // Initialize DES instances
    _initializeDES() {
      // Get DES algorithm from registry
      const DESAlgorithm = Find("DES");
      if (!DESAlgorithm) {
        throw new Error("DES algorithm not found in registry - ensure des.js is loaded");
      }

      // Create two DES instances
      this.des1 = DESAlgorithm.CreateInstance(false); // Encrypt mode
      this.des2 = DESAlgorithm.CreateInstance(true);  // Decrypt mode

      // Set keys based on key length
      if (this._key.length === 8) {
        // Single DES key - use same key for both
        this.des1.key = this._key;
        this.des2.key = this._key;
      } else {
        // 3DES - use first 8 bytes for des1, last 8 bytes for des2
        this.des1.key = this._key.slice(0, 8);
        this.des2.key = this._key.slice(8, 16);
      }
    }

    // Feed data to the MAC (accumulates in buffer)
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

      // Process data in CBC mode
      for (let i = 0; i < data.length; ++i) {
        // XOR byte into current position in state
        this.state[this.position] ^= data[i];
        ++this.position;

        // When block is full, encrypt it
        if (this.position === 8) {
          this._encryptBlock();
          this.position = 0;
        }
      }
    }

    // Encrypt current state block using DES1
    _encryptBlock() {
      this.des1.Feed(this.state);
      const encrypted = this.des1.Result();
      this.state = encrypted;
    }

    // Get the MAC result
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) {
        throw new Error("Key not set");
      }

      // If there's a partial block, encrypt it
      if (this.position > 0) {
        this._encryptBlock();
      }

      // Apply final 3DES-EDE: Decrypt with DES2, then Encrypt with DES1
      this.des2.Feed(this.state);
      const decrypted = this.des2.Result();

      this.des1.Feed(decrypted);
      const mac = this.des1.Result();

      // Reset state for next MAC computation
      this.state = new Array(8).fill(0);
      this.position = 0;
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

      // Reset state
      this.state = new Array(8).fill(0);
      this.position = 0;

      // Feed data and get result
      this.Feed(data);
      return this.Result();
    }
  }

  // Register algorithm
  RegisterAlgorithm(new X919MACAlgorithm());

  return X919MACAlgorithm;
}));
