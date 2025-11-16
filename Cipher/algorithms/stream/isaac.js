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
 * ISAAC - Stream cipher implementation
 * @class
 * @extends {StreamCipherAlgorithm}
 */

  class ISAAC extends StreamCipherAlgorithm {
    constructor() {
      super();

      this.name = "ISAAC";
      this.description = "Fast cryptographic random number generator by Bob Jenkins (Indirection, Shift, Accumulate, Add, and Count). Uses 8KB internal state with 256 32-bit word arrays. Produces high-quality pseudorandom output suitable for stream cipher applications.";
      this.inventor = "Bob Jenkins";
      this.year = 1996;
      this.category = CategoryType.STREAM;
      this.subCategory = "Stream Cipher";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.SupportedKeySizes = [new KeySize(1, 1024, 1)];
      this.SupportedBlockSizes = [new KeySize(1, 65536, 1)];

      this.documentation = [
        new LinkItem("ISAAC Cipher Specification", "https://www.burtleburtle.net/bob/rand/isaacafa.html"),
        new LinkItem("BouncyCastle ISAAC Implementation", "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/ISAACEngine.java")
      ];

      this.tests = [
        {
          text: "BouncyCastle Test Vector #1 - Key: 00000000",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ISAACTest.java",
          key: OpCodes.Hex8ToBytes("00000000"),
          input: new Array(256).fill(0),
          expected: OpCodes.Hex8ToBytes(
            "f650e4c8e448e96d98db2fb4f5fad54f433f1afbedec154ad837048746ca4f9a" +
            "5de3743e88381097f1d444eb823cedb66a83e1e04a5f6355c744243325890e2e" +
            "7452e31957161df638a824f3002ed71329f5544951c08d83d78cb99ea0cc74f3" +
            "8f651659cbc8b7c2f5f71c6912ad6419e5792e1b860536b809b3ce98d45d6d81" +
            "f3b2612917e38f8529cf72ce349947b0c998f9ffb5e13dae32ae2a2bf7cf814c" +
            "8ebfa303cf22e0640b923200eca4d58aef53cec4d0f7b37d9c411a2affdf8a80" +
            "b40e27bcb4d2f97644b89b08f37c71d51a70e7e90bdb9c3060dc5207b3c3f24b" +
            "d7386806229749b54e232cd091dabc65a70e11018b87437e5781414fcdbc62e2"
          )
        },
        {
          text: "BouncyCastle Test Vector #2 - Key: ffffffff",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ISAACTest.java",
          key: OpCodes.Hex8ToBytes("ffffffff"),
          input: new Array(288).fill(0),
          expected: OpCodes.Hex8ToBytes(
            "de3b3f3c19e0629c1fc8b7836695d523e7804edd86ff7ce9b106f52caebae9d9" +
            "72f845d49ce17d7da44e49bae954aac0d0b1284b98a88eec1524fb6bc91a16b5" +
            "1192ac5334131446ac2442de9ff3d5867b9b9148881ee30a6e87dd88e5d1f7cd" +
            "98db31ff36f70d9850cfefaef42abb00ecc39ed308bf4b8030cdc2b6b7e42f0e" +
            "908030dd282f96edacc888b3a986e109c129998f89baa1b5da8970b07a6ab012" +
            "f10264f23c315c9c8e0c164955c68517b6a4f982b2626db70787f869ac6d551b" +
            "e34931627c7058e965c502e18d2cd370e6db3b70d947d61aa9717cf8394f48c6" +
            "3c796f3a154950846badb28b70d982f29bc670254e3e5e0f8e36b0a5f6da0a04" +
            "6b235ed6a42988c012bde74d879fa8eb5d59f5f40ed5e76601c9847b3edb2690"
          )
        },
        {
          text: "BouncyCastle Test Vector #3 - Key: 1024 bytes FFFF0000 pattern",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ISAACTest.java",
          key: (function() {
            const k = new Array(1024);
            for (let i = 0; i < k.length; i++) {
              k[i] = (i % 4 === 0 || i % 4 === 1) ? 0xff : 0x00;
            }
            return k;
          })(),
          input: new Array(576).fill(0),
          expected: OpCodes.Hex8ToBytes(
            "26c54b1f8c4e3fc582e9e8180f7aba5380463dcf58b03cbeda0ecc8ba90ccff8" +
            "5bd50896313d7efed44015faeac6964b241a7fb8a2e37127a7cbea0fd7c020f2" +
            "406371b87ef5185089504751e5e44352eff63e00e5c28f5dff0616a9a3a00f1f" +
            "4a1350e3a17be9abddfc2c94571450a0dc4c3c0c7c7f98e80c95f607d50c676a" +
            "9a3006f9d279a79a4d66b2ab0c52930c9ee84bc09895e70fa041b1a3a2966f11" +
            "6a47fd09705124b1f5c7ae055e54536e66584b1608f3612d81b72f109a385831" +
            "121945b207b90ac72437a248f27a121c2801f4153a8699fb047e193f7ba69e1b" +
            "b117869675d4c963e6070c2ca3d332ce830cb5e3d9ed2eee7faf0acc20fbe154" +
            "188ae789e95bd5c1f459dbd150aab6eb833170257084bc5d44e9df09f5624f9d" +
            "afecd0c9340ac8587f8625d343f7efd1cc8abcf7a6f90eabd4e8e2d906278d6e" +
            "431fcade165c8c467887fbf5c26d341557b064b98c60dd40ab262dc046d69647" +
            "56f3ddc1a07ae5f87be878b9334fcde40add68d2ca1dc05fb1670f998c7c4607" +
            "9a6e48bdb330ad8d30b61b5cc8dc156f5733905931949783f89ac396b65aa4b8" +
            "51f746b53ed8ea66130e1d75e8eab136e60450e3e600226bc8e17d03744ce94c" +
            "0eec9234fea5f18eef65d81f2f10cfbc0b112b8cde17c32eb33ed81d7356eac3" +
            "eb1cb9cefa6604c2d707949b6e5a83e60705bf6aae76dcc7d35d68ff149c1ac5" +
            "424bb4a39e2f496f886637fce3db4ba4ad12c1a32d25e1606f6635ff636486f6" +
            "714997b45477f38813c02afce4bebf196b813332f0decd567c745f441e736364"
          )
        },
        {
          text: "BouncyCastle Test Vector #4 - Key: 1024 bytes 0000FFFF pattern",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ISAACTest.java",
          key: (function() {
            const k = new Array(1024);
            for (let i = 0; i < k.length; i++) {
              k[i] = (i % 4 === 2 || i % 4 === 3) ? 0xff : 0x00;
            }
            return k;
          })(),
          input: new Array(576).fill(0),
          expected: OpCodes.Hex8ToBytes(
            "bc31712f2a2f467a5abc737c57ce0f8d49d2f775eb850fc8f856daf19310fee2" +
            "5bab40e78403c9ef4ccd971418992faf4e85ca643fa6b482f30c4659066158a6" +
            "5bc3e620ba7ea5c34dd0eac5aabb2cf078d915fd1f8c437ed00423076c10f701" +
            "eefa7fc7c461aca5db8a87be29d925c4212d4adcfa71ff5b06af15c048aa0dfd" +
            "f0e645bc09fea200c430a88eb38c466ff358b836f1159656a078f6fc752f6db1" +
            "6680bb30fc771a6a785bbb2298e947d7b3500e557775962248bedf4e82c16e66" +
            "f39283ccb95e5399061056a11c4a280f00f7487888199487905273c7aa13012b" +
            "4849eca626cbf071c782e084f9fded57de92313e5f61a6e81117fb1115eff275" +
            "66fd5c755bb3b01bba69aeb8f1b1b1cc9709734be31b35bc707d372ba6fe70d1" +
            "e2c3b0e5e74a7058faff6b11d3a168f19fecc9fcb36b3e6a5f828c01c22ac0c2" +
            "5da2a3a9eec7e0ebbbf51472e430ed4cf1c7ab57ef9aea511e40250846d260b6" +
            "17a3fdeba16cf4afaf700144d3296b58b22a3c79ed96f3e2fc8d9e3c660ae153" +
            "8e0c285ccdc48b59117e80413bd0ad24c6a8d4f133fe1496f14351bb89904fa5" +
            "e10c4b8d50e0604578389c336a9ab3d292beb90ce640fc028e697cf54e021e2f" +
            "c0ca3fe0471fde5e5462f221739a74f5a13ae0621fe2a82e752bc294f63de48d" +
            "e85430af71307a30441b861ab5380e6a6dbe1251c9baa567da14e38e5a0ccddf" +
            "0127205c38fc3b77065e98101d219246103438d223ec7f8f533d4bb3a3d3407a" +
            "944910f11e8e5492e86de7a0471250eca32f0838b3db02fffe71898712af3261"
          )
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new ISAACInstance(this, isInverse);
    }
  }

  /**
 * ISAAC cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class ISAACInstance extends IAlgorithmInstance {
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

      // ISAAC state
      this.engineState = new Array(256);  // mm
      this.results = new Array(256);      // randrsl
      this.a = 0;
      this.b = 0;
      this.c = 0;
      this.index = 0;
      this.keyStream = new Array(1024);   // 256 words * 4 bytes
      this.initialized = false;
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

      const isValidSize = this.algorithm.SupportedKeySizes.some(ks =>
        keyBytes.length >= ks.minSize && keyBytes.length <= ks.maxSize
      );

      if (!isValidSize) {
        throw new Error(`Invalid key size: ${keyBytes.length} bytes`);
      }

      this._key = [...keyBytes];
      this._setKey(this._key);
    }

    /**
   * Get copy of current key
   * @returns {uint8[]|null} Copy of key bytes or null
   */

    get key() { return this._key ? [...this._key] : null; }

    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (!data || data.length === 0) return;
      if (!this._key) throw new Error("Key not set");
      this.inputBuffer.push(...data);
    }

    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      if (!this._key) throw new Error("Key not set");
      if (this.inputBuffer.length === 0) throw new Error("No data fed");

      const output = [];
      for (let i = 0; i < this.inputBuffer.length; i++) {
        if (this.index === 0) {
          this._isaac();
          this.keyStream = OpCodes.Words32ToBytesBE(this.results);
        }
        output.push(this.keyStream[this.index] ^ this.inputBuffer[i]);
        this.index = (this.index + 1) & 1023;
      }

      this.inputBuffer = [];
      return output;
    }

    _setKey(keyBytes) {
      // Reset state
      for (let i = 0; i < 256; i++) {
        this.engineState[i] = this.results[i] = 0;
      }
      this.a = this.b = this.c = 0;
      this.index = 0;

      // Convert key bytes to ints (little-endian) and put into results[]
      const paddedKey = new Array(keyBytes.length + (keyBytes.length & 3)).fill(0);
      for (let i = 0; i < keyBytes.length; i++) {
        paddedKey[i] = keyBytes[i];
      }

      for (let i = 0; i < paddedKey.length; i += 4) {
        this.results[i >>> 2] = OpCodes.Pack32LE(
          paddedKey[i],
          paddedKey[i + 1] || 0,
          paddedKey[i + 2] || 0,
          paddedKey[i + 3] || 0
        );
      }

      // Initialize mixing variables with golden ratio
      const abcdefgh = new Array(8);
      for (let i = 0; i < 8; i++) {
        abcdefgh[i] = 0x9e3779b9;
      }

      // Mix 4 times
      for (let i = 0; i < 4; i++) {
        this._mix(abcdefgh);
      }

      // Initialize state array in 2 passes
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < 256; j += 8) {
          for (let k = 0; k < 8; k++) {
            abcdefgh[k] = OpCodes.Add32(abcdefgh[k], (pass < 1) ? this.results[j + k] : this.engineState[j + k]);
          }

          this._mix(abcdefgh);

          for (let k = 0; k < 8; k++) {
            this.engineState[j + k] = abcdefgh[k];
          }
        }
      }

      // Generate first keystream block
      this._isaac();
      this.initialized = true;
    }

    _mix(x) {
      // ISAAC mixing function - uses shift-XOR operations per Bob Jenkins' specification
      // Note: Linear shifts (<< and >>>) are required here, not rotations (RotL32/RotR32)
      // These shift-XOR combinations are fundamental to ISAAC's design and cannot be replaced
      x[0] = (x[0] ^ ((x[1] <<  11) >>> 0)) >>> 0; x[3] = OpCodes.Add32(x[3], x[0]); x[1] = OpCodes.Add32(x[1], x[2]);
      x[1] = (x[1] ^ ((x[2] >>>  2) >>> 0)) >>> 0; x[4] = OpCodes.Add32(x[4], x[1]); x[2] = OpCodes.Add32(x[2], x[3]);
      x[2] = (x[2] ^ ((x[3] <<   8) >>> 0)) >>> 0; x[5] = OpCodes.Add32(x[5], x[2]); x[3] = OpCodes.Add32(x[3], x[4]);
      x[3] = (x[3] ^ ((x[4] >>> 16) >>> 0)) >>> 0; x[6] = OpCodes.Add32(x[6], x[3]); x[4] = OpCodes.Add32(x[4], x[5]);
      x[4] = (x[4] ^ ((x[5] <<  10) >>> 0)) >>> 0; x[7] = OpCodes.Add32(x[7], x[4]); x[5] = OpCodes.Add32(x[5], x[6]);
      x[5] = (x[5] ^ ((x[6] >>>  4) >>> 0)) >>> 0; x[0] = OpCodes.Add32(x[0], x[5]); x[6] = OpCodes.Add32(x[6], x[7]);
      x[6] = (x[6] ^ ((x[7] <<   8) >>> 0)) >>> 0; x[1] = OpCodes.Add32(x[1], x[6]); x[7] = OpCodes.Add32(x[7], x[0]);
      x[7] = (x[7] ^ ((x[0] >>>  9) >>> 0)) >>> 0; x[2] = OpCodes.Add32(x[2], x[7]); x[0] = OpCodes.Add32(x[0], x[1]);
    }

    _isaac() {
      // Core ISAAC function - generates 256 32-bit random values
      // Linear shifts required per specification (not rotations)
      let i, x, y;

      this.b = OpCodes.Add32(this.b, ++this.c);

      for (i = 0; i < 256; i++) {
        x = this.engineState[i];
        switch (i & 3) {
          case 0: this.a = (this.a ^ ((this.a <<  13) >>> 0)) >>> 0; break;
          case 1: this.a = (this.a ^ ((this.a >>>  6) >>> 0)) >>> 0; break;
          case 2: this.a = (this.a ^ ((this.a <<   2) >>> 0)) >>> 0; break;
          case 3: this.a = (this.a ^ ((this.a >>> 16) >>> 0)) >>> 0; break;
        }
        this.a = OpCodes.Add32(this.a, this.engineState[(i + 128) & 0xFF]);
        this.engineState[i] = y = OpCodes.Add32(OpCodes.Add32(this.engineState[((x >>> 2) & 0xFF)], this.a), this.b);
        this.results[i] = this.b = OpCodes.Add32(this.engineState[((y >>> 10) & 0xFF)], x);
      }
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ISAAC();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { ISAAC, ISAACInstance };
}));
