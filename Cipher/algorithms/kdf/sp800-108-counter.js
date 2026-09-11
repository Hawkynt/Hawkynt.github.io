/*
 * NIST SP 800-108 KDF in Counter Mode Implementation
 * Compatible with AlgorithmFramework
 * (c)2025 Hawkynt
 *
 * Implements Key-Based Key Derivation Function (KBKDF) in Counter Mode
 * as defined in NIST Special Publication 800-108
 * Reference: https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-108.pdf
 */

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
          KdfAlgorithm, IKdfInstance, TestCase, LinkItem, KeySize } = AlgorithmFramework;

  // ===== ALGORITHM IMPLEMENTATION =====

  class SP800108CounterAlgorithm extends KdfAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "SP800-108-Counter";
      this.description = "NIST SP 800-108 Key Derivation Function in Counter Mode. Uses HMAC with counter-based PRF expansion for deriving cryptographic keys from input key material, following the NIST standardized specification.";
      this.inventor = "NIST";
      this.year = 2009;
      this.category = CategoryType.KDF;
      this.subCategory = "NIST SP 800-108 Counter Mode";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // KDF-specific configuration
      this.SupportedKeyDerivationSizes = [
        new KeySize(16, 65535, 1)  // Variable output size (1 byte to 64KB)
      ];
      this.NeedsKey = true;  // Requires input key material (KI)

      // Documentation links
      this.documentation = [
        new LinkItem(
          "NIST SP 800-108 Revision 1 - Recommendation for Key Derivation Using Pseudorandom Functions",
          "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-108.pdf"
        ),
        new LinkItem(
          "RFC 6803 - KBKDF with HMAC",
          "https://tools.ietf.org/rfc/rfc6803.txt"
        ),
        new LinkItem(
          "OpenSSL EVP_KDF-KB Documentation",
          "https://www.openssl.org/docs/manmaster/man7/EVP_KDF-KB.html"
        )
      ];

      // Reference links
      this.references = [
        new LinkItem(
          "Botan SP800_108_Counter Implementation",
          "https://github.com/randombit/botan/blob/master/src/lib/kdf/sp800_108/sp800_108.cpp"
        ),
        new LinkItem(
          "PyCryptodome NIST SP 800-108 Test Vectors",
          "https://github.com/Legrandin/pycryptodome/blob/master/lib/Crypto/SelfTest/Protocol/test_KDF.py"
        ),
        new LinkItem(
          "OpenSSL KBKDF Implementation",
          "https://github.com/openssl/openssl/blob/master/crypto/kdf/kbkdf.c"
        )
      ];

      // Published test vectors, quoted verbatim from Botan's sp800_108_ctr.vec.
      // Botan names the SP 800-108 Context field "Salt", so Salt maps to context here.
      // Output lengths are chosen around the PRF block boundary: shorter than one
      // HMAC block, exactly one block, and spanning two blocks.
      this.tests = [
        {
          text: "SP800-108-Counter(HMAC(SHA-1)) - 20 bytes, exactly one PRF block",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("17182760595F697F27E4E64A8E66102AC83A4B11"),
          label: OpCodes.Hex8ToBytes("EB5A279F6AC4522804FAF25E"),
          context: OpCodes.Hex8ToBytes("13E3EA2CF37566A55321C8E6386FAAC93421D614948EBF5BBA07649D77A27E161021346BAC19B3ADE49D4250DDEACAD90E3643389C320305541B5C3CCE41DEA5586CACEB3D43C43B256DA060CB3366108AB7895C7AFDA46C68C09D63D49E74AD74B05D94"),
          outputLength: 20,
          counterBits: 32,
          hashAlgorithm: "SHA-1",
          expected: OpCodes.Hex8ToBytes("AFA3F9DABB5BE44C4D25DD83EB1C0983D89961CA")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-256)) - 12 bytes, truncated below one PRF block",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("8a90e91cf6e25ae0f733a0eb186415af49cd7a0d78e1b6d01626b711aab4f12b"),
          label: OpCodes.Hex8ToBytes("036e2c420a6053e7441595745da71384"),
          context: OpCodes.Hex8ToBytes("7ca576af452eb08eccd0bf5a9ce6e5bd"),
          outputLength: 12,
          counterBits: 32,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("69283d6572c9eba192b68279")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-256)) - 36 bytes, one byte group past the first block",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("304932533feea6cc93b9a5b01e362b416f6cf1c3eb8019191cd9f607814b6b71"),
          label: OpCodes.Hex8ToBytes("a16cc203753424e8b08633fe43d9b0c4"),
          context: OpCodes.Hex8ToBytes("54eeac24933ff6829bc37e7b1ed932b9f050899bb7d0c32615a708ee213d9085585fb010544fe4d29a8021b39fbb267d"),
          outputLength: 36,
          counterBits: 32,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("719a8ae5eb4b1ac325d6e3598080e05cc15aede16f0547de0646e7639c1bf605ca557969")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-256)) - 48 bytes, two PRF blocks",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("4b7ef2ca535af6b75b9cbf60a0d61a92af7edad9d568688fd9cde1c0c95f3e33"),
          label: OpCodes.Hex8ToBytes("be7baa20a4fd50eb81d30ce04aa8fbfb"),
          context: OpCodes.Hex8ToBytes("ec72d16625fa2404052a5cd44ea924e376b53ad759442803809bb2b09e1189d16950f654fccf806519aa7113c8a64a4a89f470d92a9b0477fe0b0b5549294060"),
          outputLength: 48,
          counterBits: 32,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("caebdad694080005aff424e983bad862f4f7efec50102381cd25509fabc487a36509dabc6760088a7d33e7a37be94791")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-512)) - 20 bytes, heavy truncation of a 64 byte block",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("BFFA0F4267D5F24F219151CB38C581C0D1CFF8EFE475D7C38A47726B226DF36E47E1A579993B4BEF9E3197330610ED57350BDE57EC6EDF231BCEFF1532017C0D"),
          label: OpCodes.Hex8ToBytes("196636113098B35C35406BB4"),
          context: OpCodes.Hex8ToBytes("17E42893512C6DF7747906508AD41396096A13B7D9AA87C4F7FABCBD9795165823A1B54819EB190691C96BAD55AD233A85F3C554C3E9B2D9B588A9F0DA09DF0D83D6141B83F5A62190FD16AA20B15552C3417C96B931E7EB55E06CD57406D5AB79FE12A7"),
          outputLength: 20,
          counterBits: 32,
          hashAlgorithm: "SHA-512",
          expected: OpCodes.Hex8ToBytes("40595AEEF8C541A9C453E27D38F6F04463331A8A")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-256),8,32) - 8 bit counter, 24 bytes",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("b1fefddae964b5becda2ac39309eed39ba1fff819425ec48e0ce2efa5eee2e13"),
          label: OpCodes.Hex8ToBytes("d17a21b0e89b371149ee89d4c9239b8a"),
          context: OpCodes.Hex8ToBytes("6baf3ba16f03e5b10fe439a307b16f208ab54cb1a2a564d40644f27ad298f515"),
          outputLength: 24,
          counterBits: 8,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("ba1dea3338a92eeeb3ae0046ac214ba56beb939b7054efe3")
        },
        {
          text: "SP800-108-Counter(HMAC(SHA-256),16,32) - 16 bit counter, 36 bytes over two blocks",
          uri: "https://github.com/randombit/botan/blob/master/src/tests/data/kdf/sp800_108_ctr.vec",
          input: OpCodes.Hex8ToBytes("c342730ce2412fcdeb94cdf6b9f23d656f44c9cd0acfa9c6ca6904aaafe19d2a"),
          label: OpCodes.Hex8ToBytes("2523abf2d9bd9ee7e06faf7c62999705"),
          context: OpCodes.Hex8ToBytes("6bf53bfb235ae2edce466761860f7470b5fae6d51cd7ce250f984062994dfdf5fead470abb43fe434817564c5dee6f30"),
          outputLength: 36,
          counterBits: 16,
          hashAlgorithm: "SHA-256",
          expected: OpCodes.Hex8ToBytes("99cbbccf79545b8a341637395b0349955077ef3b3901e06f6507962b4f08b8d5154b03ad")
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
        return null;  // KDF cannot be reversed
      }
      return new SP800108CounterInstance(this);
    }
  }

  // Instance class - handles the actual KDF computation
  /**
 * SP800108Counter cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class SP800108CounterInstance extends IKdfInstance {
    constructor(algorithm) {
      super(algorithm);
      this._keyInput = null;
      this._label = null;
      this._context = null;
      this._counterBits = 32;  // Default counter bits (8, 16, 24, or 32)
      this._outputLength = 32;  // Default output length
      this._hashAlgorithm = 'SHA-256';  // Default hash function for HMAC
    }

    // Property setter for input key material (KI) - matches test vector 'input' field
    set input(keyBytes) {
      if (!keyBytes || !Array.isArray(keyBytes)) {
        throw new Error("Key input must be a byte array");
      }
      this._keyInput = [...keyBytes];
    }

    get input() {
      return this._keyInput ? [...this._keyInput] : null;
    }

    // Alias for compatibility
    set keyInput(keyBytes) {
      this.input = keyBytes;
    }

    get keyInput() {
      return this.input;
    }

    // Property setter for label (optional fixed input data)
    set label(labelBytes) {
      this._label = labelBytes && Array.isArray(labelBytes) ? [...labelBytes] : [];
    }

    get label() {
      return this._label ? [...this._label] : [];
    }

    // Property setter for context (optional fixed input data)
    set context(contextBytes) {
      this._context = contextBytes && Array.isArray(contextBytes) ? [...contextBytes] : [];
    }

    get context() {
      return this._context ? [...this._context] : [];
    }

    // Counter bits (8, 16, 24, or 32)
    set counterBits(bits) {
      if (![8, 16, 24, 32].includes(bits)) {
        throw new Error("Counter bits must be one of: 8, 16, 24, 32");
      }
      this._counterBits = bits;
    }

    get counterBits() {
      return this._counterBits;
    }

    // Output length in bytes
    set outputLength(bytes) {
      if (!Number.isInteger(bytes) || bytes < 1 || bytes > 65535) {
        throw new Error("Output length must be between 1 and 65535 bytes");
      }
      this._outputLength = bytes;
    }

    get outputLength() {
      return this._outputLength;
    }

    // Hash algorithm used for HMAC (SHA-256, SHA-512, etc.)
    set hashAlgorithm(algo) {
      if (!algo || typeof algo !== 'string') {
        throw new Error("Hash algorithm must be a valid string");
      }
      this._hashAlgorithm = algo.toUpperCase();
    }

    get hashAlgorithm() {
      return this._hashAlgorithm;
    }

    // Main derivation method
    // For KDFs, Feed() is used to provide the input key material
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (data && Array.isArray(data)) {
        // Feed is a streaming interface: successive calls extend the input rather
        // than replace it, so Feed(a); Feed(b) derives from the same octet string
        // as Feed(a || b).
        if (!this._keyInput) this._keyInput = [];
        for (let i = 0; i < data.length; i++) this._keyInput.push(data[i]);
      }
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._keyInput || this._keyInput.length === 0) {
        throw new Error("Key input not set");
      }

      if (this._outputLength < 1) {
        throw new Error("Output length must be at least 1 byte");
      }

      // Get HMAC function for the specified hash algorithm
      const hmacFunc = this._getHMACFunction();

      const output = [];
      const counterBytes = this._counterBits / 8;
      const outputBits = this._outputLength * 8;

      // Calculate number of HMAC iterations needed
      const hmacOutputBytes = this._getHMACOutputSize();
      const blocksNeeded = Math.ceil(this._outputLength / hmacOutputBytes);

      // SP 800-108 Counter Mode KDF
      // Each block: HMAC(K_I, [i]_r || Label || 0x00 || Context || [L]_32)
      for (let i = 1; i <= blocksNeeded; i++) {
        const blockInput = [];

        // Add counter [i]_r (r bits, encoded in big-endian)
        const counterBytes_i = this._encodeCounter(i, counterBytes);
        for (let _i = 0; _i < counterBytes_i.length; _i++) blockInput.push(counterBytes_i[_i]);

        // Add label
        if (this._label && this._label.length > 0) {
          blockInput.push(...this._label);
        }

        // Add fixed separator (0x00)
        blockInput.push(0x00);

        // Add context
        if (this._context && this._context.length > 0) {
          blockInput.push(...this._context);
        }

        // Add output length in bits [L]_32 (always 32 bits, big-endian)
        blockInput.push(
          OpCodes.Shr32(outputBits, 24)&0xFF,
          OpCodes.Shr32(outputBits, 16)&0xFF,
          OpCodes.Shr32(outputBits, 8)&0xFF,
          outputBits&0xFF
        );

        // Compute HMAC(K_I, block_input)
        const blockOutput = hmacFunc(this._keyInput, blockInput);
        for (let _i = 0; _i < blockOutput.length; _i++) output.push(blockOutput[_i]);
      }

      // Truncate to requested output length
      return output.slice(0, this._outputLength);
    }

    // Encode counter as big-endian bytes
    _encodeCounter(counter, numBytes) {
      const result = [];
      for (let i = numBytes - 1; i >= 0; i--) {
        result.push(OpCodes.Shr32(counter, i * 8)&0xFF);
      }
      return result;
    }

    // Get HMAC function for the specified hash algorithm
    _getHMACFunction() {
      // Determine hash output size and implement basic HMAC
      const hashAlgo = this._hashAlgorithm.toUpperCase();

      if (hashAlgo === 'SHA-256' || hashAlgo === 'SHA256') {
        return (key, message) => {
          return this._hmacSHA256(key, message);
        };
      } else if (hashAlgo === 'SHA-512' || hashAlgo === 'SHA512') {
        return (key, message) => {
          return this._hmacSHA512(key, message);
        };
      } else if (hashAlgo === 'SHA-1' || hashAlgo === 'SHA1') {
        return (key, message) => {
          return this._hmacSHA1(key, message);
        };
      } else {
        throw new Error(`Unsupported hash algorithm: ${this._hashAlgorithm}`);
      }
    }

    // Get HMAC output size for the selected hash
    _getHMACOutputSize() {
      const hashAlgo = this._hashAlgorithm.toUpperCase();
      if (hashAlgo === 'SHA-256' || hashAlgo === 'SHA256') return 32;
      if (hashAlgo === 'SHA-512' || hashAlgo === 'SHA512') return 64;
      if (hashAlgo === 'SHA-1' || hashAlgo === 'SHA1') return 20;
      return 32;  // Default to SHA-256 output size
    }

    // Implementation of HMAC-SHA256 using Web Crypto or fallback
    _hmacSHA256(key, message) {
      return this._hmacCompute(key, message, 'SHA-256', 32);
    }

    // Implementation of HMAC-SHA512 using Web Crypto or fallback
    _hmacSHA512(key, message) {
      return this._hmacCompute(key, message, 'SHA-512', 64);
    }

    // Implementation of HMAC-SHA1 using Web Crypto or fallback
    _hmacSHA1(key, message) {
      return this._hmacCompute(key, message, 'SHA-1', 20);
    }

    // Generic HMAC computation
    _hmacCompute(key, message, hashName, hashOutputSize) {
      // Try using Node.js crypto if available
      if (typeof require !== 'undefined') {
        try {
          const crypto = require('crypto');
          const hmac = crypto.createHmac(
            hashName.replace('-', '').toLowerCase(),
            Buffer.from(key)
          );
          hmac.update(Buffer.from(message));
          return Array.from(hmac.digest());
        } catch (e) {
          // Fall through to alternate implementation
        }
      }

      // Check if we have HMAC in OpCodes (unlikely but possible)
      if (OpCodes && OpCodes.HMAC) {
        return OpCodes.HMAC(key, message, hashName);
      }

      // Try using AlgorithmFramework HMAC implementation
      const hmacResult = this._hmacWithFramework(key, message, hashName);
      if (hmacResult) {
        return hmacResult;
      }

      // Fallback: use built-in pure JavaScript implementation
      if (hashName === 'SHA-256' || hashName === 'SHA256') {
        return this._hmacSha256Pure(key, message);
      }

      throw new Error(
        `Cannot compute HMAC: No crypto library available for ${hashName}. Ensure HMAC algorithms are loaded before SP800-108-Counter.`
      );
    }

    // HMAC computation using AlgorithmFramework's HMAC implementation
    _hmacWithFramework(key, message, hashName) {
      // Map hash names to HMAC algorithm names in the framework
      const hmacAlgoMap = {
        'SHA-1': 'HMAC-SHA-1',
        'SHA1': 'HMAC-SHA-1',
        'SHA-256': 'HMAC-SHA-256',
        'SHA256': 'HMAC-SHA-256',
        'SHA-512': 'HMAC-SHA-512',
        'SHA512': 'HMAC-SHA-512'
      };

      const hmacAlgoName = hmacAlgoMap[hashName];
      if (!hmacAlgoName) {
        return null;
      }

      // Try to find the HMAC algorithm in the framework
      const hmacAlgo = AlgorithmFramework.Find(hmacAlgoName);
      if (hmacAlgo) {
        const instance = hmacAlgo.CreateInstance(false);
        if (instance) {
          instance.key = key;
          instance.Feed(message);
          return instance.Result();
        }
      }

      return null;
    }

    // Pure JavaScript HMAC-SHA256 implementation (fallback when no crypto available)
    _hmacSha256Pure(key, message) {
      const BLOCK_SIZE = 64;
      const OUTPUT_SIZE = 32;

      // Ensure key and message are arrays
      let keyArr = Array.isArray(key) ? key : Array.from(key);
      const msgArr = Array.isArray(message) ? message : Array.from(message);

      // If key is longer than block size, hash it
      if (keyArr.length > BLOCK_SIZE) {
        keyArr = this._sha256Pure(keyArr);
      }

      // Pad key to block size
      while (keyArr.length < BLOCK_SIZE) {
        keyArr.push(0);
      }

      // Create inner and outer padding
      const ipad = keyArr.map(b => OpCodes.Xor32(b, 0x36));
      const opad = keyArr.map(b => OpCodes.Xor32(b, 0x5c));

      // Inner hash: SHA256(ipad || message)
      const innerInput = ipad.concat(msgArr);
      const innerHash = this._sha256Pure(innerInput);

      // Outer hash: SHA256(opad || inner_hash)
      const outerInput = opad.concat(innerHash);
      return this._sha256Pure(outerInput);
    }

    // Pure JavaScript SHA-256 implementation
    _sha256Pure(message) {
      // SHA-256 constants
      const K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
      ];

      // Initial hash values
      let H = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
      ];

      // Helper functions
      const rotr = (x, n) => OpCodes.ToUint32((OpCodes.Shr32(x, n))|OpCodes.Shl32(x, 32 - n));
      const ch = (x, y, z) => OpCodes.ToUint32(OpCodes.Xor32((x&y), ((~x)&z)));
      const maj = (x, y, z) => OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32((x&y), (x&z)), (y&z)));
      const sigma0 = x => OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(rotr(x, 2), rotr(x, 13)), rotr(x, 22)));
      const sigma1 = x => OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(rotr(x, 6), rotr(x, 11)), rotr(x, 25)));
      const gamma0 = x => OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(rotr(x, 7), rotr(x, 18)), OpCodes.Shr32(x, 3)));
      const gamma1 = x => OpCodes.ToUint32(OpCodes.Xor32(OpCodes.Xor32(rotr(x, 17), rotr(x, 19)), OpCodes.Shr32(x, 10)));

      // Pre-processing: adding padding bits
      const msgArr = Array.isArray(message) ? message : Array.from(message);
      const msgLen = msgArr.length;
      const bitLen = msgLen * 8;

      // Append '1' bit and padding zeros
      msgArr.push(0x80);
      while ((msgArr.length % 64) !== 56) {
        msgArr.push(0);
      }

      // Append original length in bits as 64-bit big-endian
      for (let i = 7; i >= 0; i--) {
        msgArr.push(Math.floor(bitLen / Math.pow(2, i * 8))&0xff);
      }

      // Process each 512-bit block
      for (let offset = 0; offset < msgArr.length; offset += 64) {
        const W = new Array(64);

        // Copy block into first 16 words
        for (let i = 0; i < 16; i++) {
          W[i] = OpCodes.ToUint32((OpCodes.Shl32(msgArr[offset + i * 4], 24))|(OpCodes.Shl32(msgArr[offset + i * 4 + 1], 16))|(OpCodes.Shl32(msgArr[offset + i * 4 + 2], 8))|msgArr[offset + i * 4 + 3]);
        }

        // Extend the first 16 words into the remaining 48 words
        for (let i = 16; i < 64; i++) {
          W[i] = OpCodes.ToUint32(gamma1(W[i - 2]) + W[i - 7] + gamma0(W[i - 15]) + W[i - 16]);
        }

        // Initialize working variables
        let [a, b, c, d, e, f, g, h] = H;

        // Main loop
        for (let i = 0; i < 64; i++) {
          const T1 = OpCodes.ToUint32(h + sigma1(e) + ch(e, f, g) + K[i] + W[i]);
          const T2 = OpCodes.ToUint32(sigma0(a) + maj(a, b, c));
          h = g;
          g = f;
          f = e;
          e = OpCodes.ToUint32(d + T1);
          d = c;
          c = b;
          b = a;
          a = OpCodes.ToUint32(T1 + T2);
        }

        // Add compressed chunk to current hash value
        H[0] = OpCodes.ToUint32(H[0] + a);
        H[1] = OpCodes.ToUint32(H[1] + b);
        H[2] = OpCodes.ToUint32(H[2] + c);
        H[3] = OpCodes.ToUint32(H[3] + d);
        H[4] = OpCodes.ToUint32(H[4] + e);
        H[5] = OpCodes.ToUint32(H[5] + f);
        H[6] = OpCodes.ToUint32(H[6] + g);
        H[7] = OpCodes.ToUint32(H[7] + h);
      }

      // Produce the final hash value (big-endian)
      const result = [];
      for (let i = 0; i < 8; i++) {
        result.push(OpCodes.Shr32(H[i], 24)&0xff);
        result.push(OpCodes.Shr32(H[i], 16)&0xff);
        result.push(OpCodes.Shr32(H[i], 8)&0xff);
        result.push(H[i]&0xff);
      }
      return result;
    }
  }

  // Register the algorithm
  RegisterAlgorithm(new SP800108CounterAlgorithm());

  return {
    SP800108CounterAlgorithm,
    SP800108CounterInstance
  };
}));
