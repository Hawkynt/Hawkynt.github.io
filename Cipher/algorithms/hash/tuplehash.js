/*
 * TupleHash - SHA-3 Derived Tuple Hashing (128-bit and 256-bit security)
 * Professional implementation following NIST SP 800-185
 * (c)2006-2025 Hawkynt
 *
 * TupleHash provides unambiguous hashing of tuple input strings with XOF mode support.
 * Reference: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf
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

  if (!AlgorithmFramework) throw new Error('AlgorithmFramework dependency is required');
  if (!OpCodes) throw new Error('OpCodes dependency is required');

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          HashFunctionAlgorithm, IHashFunctionInstance, LinkItem, KeySize } = AlgorithmFramework;

  // Load cSHAKE, which registers the cSHAKE128/cSHAKE256 instances this file
  // looks up at run time. A browser has already loaded it through its script
  // tag; the check in the instance constructor reports a missing one.
  if (typeof require !== 'undefined') {
    try {
      require('./cshake.js');
    } catch(e) {
      // cSHAKE will be checked at runtime
    }
  }

  /**
   * Left-encode: Encode integer with length prefix at start
   * @param {uint32} value - Value to encode
   * @returns {uint8[]} Encoded bytes [length, bytes...]
   */
  function leftEncode(value) {
    // Count bytes needed
    let n = 1;
    let v = OpCodes.Shr32(value, 8);
    while (v !== 0) {
      n++;
      v = OpCodes.Shr32(v, 8);
    }

    /** @type {uint8[]} */
    const result = [n];
    for (let i = 1; i <= n; i++) {
      result.push(OpCodes.GetByte(value, n - i));
    }
    return result;
  }

  /**
   * Right-encode: Encode integer with length suffix at end
   * @param {uint32} value - Value to encode
   * @returns {uint8[]} Encoded bytes [bytes..., length]
   */
  function rightEncode(value) {
    // Count bytes needed
    let n = 1;
    let v = OpCodes.Shr32(value, 8);
    while (v !== 0) {
      n++;
      v = OpCodes.Shr32(v, 8);
    }

    /** @type {uint8[]} */
    const result = [];
    for (let i = 0; i < n; i++) {
      result.push(OpCodes.GetByte(value, n - i - 1));
    }
    result.push(n);
    return result;
  }

  /**
   * Encode tuple element: leftEncode(bitLength) || data
   * @param {uint8[]} data - Data bytes
   * @returns {uint8[]} Encoded tuple element
   */
  function encodeTuple(data) {
    const bitLength = data.length * 8;
    return leftEncode(bitLength).concat(data);
  }

  /**
 * TupleHash128 - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class TupleHash128 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "TupleHash128";
      this.description = "SHA-3 derived function for unambiguous tuple hashing with 128-bit security. Encodes each tuple element to prevent collisions between different tuple structures.";
      this.inventor = "John Kelsey, Shu-jen Chang, Ray Perlner (NIST)";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 Derived";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.SupportedOutputSizes = [new KeySize(1, 1024, 1)];

      this.documentation = [
        new LinkItem(
          "NIST SP 800-185",
          "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf"
        ),
        new LinkItem(
          "NIST Test Vectors",
          "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf"
        )
      ];

      this.references = [
        new LinkItem(
          "BouncyCastle TupleHash implementation",
          "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/TupleHash.java"
        ),
        new LinkItem(
          "XKCP - eXtended Keccak Code Package",
          "https://github.com/XKCP/XKCP"
        )
      ];

      // Official NIST test vectors from SP 800-185 (via BouncyCastle)
      this.tests = [
        {
          text: "TupleHash128: (000102, 101112131415), empty S, 32 bytes (NIST)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java",
          input: null,
          outputSize: 32,
          customization: [],
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415")
          ],
          expected: OpCodes.Hex8ToBytes("C5D8786C1AFB9B82111AB34B65B2C0048FA64E6D48E263264CE1707D3FFC8ED1")
        },
        {
          text: "TupleHash128: (000102, 101112131415), S='My Tuple App', 32 bytes (NIST)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java",
          input: null,
          outputSize: 32,
          customization: OpCodes.AnsiToBytes("My Tuple App"),
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415")
          ],
          expected: OpCodes.Hex8ToBytes("75CDB20FF4DB1154E841D758E24160C54BAE86EB8C13E7F5F40EB35588E96DFB")
        },
        {
          text: "TupleHash128: (000102, 101112131415, 202122232425262728), S='My Tuple App', 32 bytes (NIST)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java",
          input: null,
          outputSize: 32,
          customization: OpCodes.AnsiToBytes("My Tuple App"),
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415"),
            OpCodes.Hex8ToBytes("202122232425262728")
          ],
          expected: OpCodes.Hex8ToBytes("E60F202C89A2631EDA8D4C588CA5FD07F39E5151998DECCF973ADB3804BB6E84")
        },
        {
          text: "TupleHash128: NIST ACVP tg2/tc179 - empty element at position 3 of 7",
          uri: "https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/TupleHash-128-1.0/internalProjection.json",
          input: null,
          outputSize: 37,
          customization: OpCodes.Hex8ToBytes("4A774C6A"),
          tuples: [
            OpCodes.Hex8ToBytes("CC25D160F2"),
            OpCodes.Hex8ToBytes("370C1C66D507D6E314E98526C74D5271A014ECF395"),
            OpCodes.Hex8ToBytes(""),
            OpCodes.Hex8ToBytes("37A8DF27CEC8D92A895EB7D2533D47C2C076D842C31FCC"),
            OpCodes.Hex8ToBytes("ACDCDB"),
            OpCodes.Hex8ToBytes("C7D228D4C89419B4F91DEA6F9E"),
            OpCodes.Hex8ToBytes("92FB")
          ],
          expected: OpCodes.Hex8ToBytes(
            "51AB471EE4B86FDA531A588A61AA832A9D0B4E8E7E982852E4DEFC7862AE8AF6" +
            "FF01FC3A18"
          )
        },
        {
          text: "TupleHash128: NIST ACVP tg1/tc48 - XOF mode, leading empty element",
          uri: "https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/TupleHash-128-1.0/internalProjection.json",
          input: null,
          outputSize: 49,
          xofMode: true,
          customization: OpCodes.Hex8ToBytes("636A5E4A5246372A73556C5A662020286B6676274A4B39287B35793B6E5B7744695329256B73702D68647D357D405021434C36"),
          tuples: [
            OpCodes.Hex8ToBytes(""),
            OpCodes.Hex8ToBytes(
              "EC03DC6F8CD75C68F1D013E48E7F8A84713054009501CCCBC430340C7D3A3B6E" +
              "30BB3AB1753F3EB5BBAC320644092AAE6B37203B111DA326B451AECA8D181424" +
              "D758EDB92EF5BB926B651E3828811D73FAC124925E13C71E7468A631D1A91BDA" +
              "E55A87617C256F90CA7F4ED83B178F5B838073A8F2FA7F5FB96ADE9E868611BA"
            )
          ],
          expected: OpCodes.Hex8ToBytes(
            "C0B00600A2148E4F8B2ED37A50381DACF7D8317901DC608D431EA3D50CC0D5A4" +
            "49893F7EFCC9DF9EE8D7FE249E99862CE7"
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
      if (isInverse) return null;
      return new TupleHashInstance(this, 128);
    }
  }

  /**
 * TupleHash256 - Cryptographic hash function
 * @class
 * @extends {HashFunctionAlgorithm}
 */

  class TupleHash256 extends HashFunctionAlgorithm {
    constructor() {
      super();

      this.name = "TupleHash256";
      this.description = "SHA-3 derived function for unambiguous tuple hashing with 256-bit security. Encodes each tuple element to prevent collisions between different tuple structures.";
      this.inventor = "John Kelsey, Shu-jen Chang, Ray Perlner (NIST)";
      this.year = 2016;
      this.category = CategoryType.HASH;
      this.subCategory = "SHA-3 Derived";
      this.securityStatus = SecurityStatus.SECURE;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      this.SupportedOutputSizes = [new KeySize(1, 1024, 1)];

      this.documentation = [
        new LinkItem(
          "NIST SP 800-185",
          "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-185.pdf"
        ),
        new LinkItem(
          "NIST Test Vectors",
          "https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/examples/KMAC_samples.pdf"
        )
      ];

      this.references = [
        new LinkItem(
          "BouncyCastle TupleHash implementation",
          "https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/digests/TupleHash.java"
        ),
        new LinkItem(
          "XKCP - eXtended Keccak Code Package",
          "https://github.com/XKCP/XKCP"
        )
      ];

      // Official NIST test vectors from SP 800-185 (via BouncyCastle)
      this.tests = [
        {
          text: "TupleHash256: (000102, 101112131415), empty S, 64 bytes (NIST)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java",
          input: null,
          outputSize: 64,
          customization: [],
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415")
          ],
          expected: OpCodes.Hex8ToBytes("CFB7058CACA5E668F81A12A20A2195CE97A925F1DBA3E7449A56F82201EC607311AC2696B1AB5EA2352DF1423BDE7BD4BB78C9AED1A853C78672F9EB23BBE194")
        },
        {
          text: "TupleHash256: (000102, 101112131415), S='My Tuple App', 64 bytes (NIST)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java",
          input: null,
          outputSize: 64,
          customization: OpCodes.AnsiToBytes("My Tuple App"),
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415")
          ],
          expected: OpCodes.Hex8ToBytes("147C2191D5ED7EFD98DBD96D7AB5A11692576F5FE2A5065F3E33DE6BBA9F3AA1C4E9A068A289C61C95AAB30AEE1E410B0B607DE3620E24A4E3BF9852A1D4367E")
        },
        {
          text: "TupleHash256: (000102, 101112131415, 202122232425262728), S='My Tuple App', 64 bytes (NIST)",
          uri: "https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/TupleHashTest.java",
          input: null,
          outputSize: 64,
          customization: OpCodes.AnsiToBytes("My Tuple App"),
          tuples: [
            OpCodes.Hex8ToBytes("000102"),
            OpCodes.Hex8ToBytes("101112131415"),
            OpCodes.Hex8ToBytes("202122232425262728")
          ],
          expected: OpCodes.Hex8ToBytes("45000BE63F9B6BFD89F54717670F69A9BC763591A4F05C50D68891A744BCC6E7D6D5B5E82C018DA999ED35B0BB49C9678E526ABD8E85C13ED254021DB9E790CE")
        },
        {
          text: "TupleHash256: NIST ACVP tg2/tc120 - leading empty element, empty S",
          uri: "https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/TupleHash-256-1.0/internalProjection.json",
          input: null,
          outputSize: 38,
          customization: OpCodes.Hex8ToBytes(""),
          tuples: [
            OpCodes.Hex8ToBytes(""),
            OpCodes.Hex8ToBytes(
              "AEBA5DA424057417633D62E58CF8194F444B1349F4C1A031067F243B4E5F269A" +
              "7262635BE94FBE88701A284A693CD99599EA46A591B738111647F3E28EE4318B" +
              "87CC22658EB3398BF0A5002DD2B679FA61B32080EAAD6695C8F10E22DAAE2D70" +
              "47FB00E3363B48BA6A3152F84C0003246ACE91BB55798787AF59A0D76DA4BC43"
            )
          ],
          expected: OpCodes.Hex8ToBytes(
            "6EB8E712B3CDAFDFCE02D786A0EEC4305CAB4F2AA10611743FEF8B5192822FDD" +
            "4D74468873D4"
          )
        },
        {
          text: "TupleHash256: NIST ACVP tg1/tc82 - XOF mode, leading empty element",
          uri: "https://raw.githubusercontent.com/usnistgov/ACVP-Server/master/gen-val/json-files/TupleHash-256-1.0/internalProjection.json",
          input: null,
          outputSize: 32,
          xofMode: true,
          customization: OpCodes.Hex8ToBytes("2857675F733F30636144776B6B2E6E43735876616269662D5B757D486460322B3257575B2F29794C7529796C5A7C33775577693E705D793E715A237D41677E21326C59345532346A5F49"),
          tuples: [
            OpCodes.Hex8ToBytes(""),
            OpCodes.Hex8ToBytes(
              "C391C9868B8C6DE496BCDC49EA37BCE42196CBD5211847AC1A7B065EF2FB9332" +
              "AD3FEAB54789746DBC98859F4A5E43D6817C54288FDC68AE47111000F9297C1C" +
              "5C27A72E0E3E6176BE5BB18AC68EBE2A7B00886E17EF5A556EF8F3A8FF33C86D" +
              "224B2D0988BFD70AEB6C17E932D6A73ABA1033C2979F67893030EEE5484CE3D6"
            )
          ],
          expected: OpCodes.Hex8ToBytes("0CDED52B4886A6EEB886E57E1FA4B055060F33BC5A68D3FD45F06692A52073BB")
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      if (isInverse) return null;
      return new TupleHashInstance(this, 256);
    }
  }

  /**
 * TupleHash instance implementing the Feed/Result pattern
 * @class
 * @extends {IHashFunctionInstance}
 */

  class TupleHashInstance extends IHashFunctionInstance {
    /**
     * Initialize a TupleHash instance
     * @param {HashFunctionAlgorithm} algorithm - Parent algorithm instance
     * @param {int32} securityBits - 128 or 256
     */
    constructor(algorithm, securityBits) {
      super(algorithm);

      // Every setting is read when Result() runs, never earlier, so the digest
      // does not depend on the order the properties and the elements are set in.
      // cSHAKE absorbs N and S before the first message byte, so the cSHAKE
      // state can only be built once S is final: the encoded elements are kept
      // until Result() and absorbed there.

      /** @type {int32} */
      this.securityBits = securityBits;
      /** @type {int32} Output length in bytes, defaulting by security level */
      this._outputSize = securityBits === 128 ? 32 : 64;
      /** @type {uint8[]} */
      this._customization = [];
      /** @type {boolean} */
      this._xofMode = false;
      /** @type {uint8[]} encode_string(X_1) || ... of the elements fed since the last Result() */
      this._encoded = [];
    }

    /**
     * A fresh cSHAKE instance with N = "TupleHash" and the current S, for the
     * current security level
     * @returns {IHashFunctionInstance} cSHAKE128 or cSHAKE256 instance
     * @throws {Error} If that cSHAKE is not registered
     */
    _newCshake() {
      // Get registered cSHAKE algorithm
      const cshakeName = this.securityBits === 128 ? 'cSHAKE128' : 'cSHAKE256';
      const cshakeAlgo = AlgorithmFramework.Find(cshakeName);

      if (!cshakeAlgo) {
        throw new Error(cshakeName + ' is required for TupleHash');
      }

      /** @type {IHashFunctionInstance} */
      const cshake = cshakeAlgo.CreateInstance();
      cshake.functionName = OpCodes.AnsiToBytes("TupleHash");
      cshake.customization = this._customization;
      return cshake;
    }

    /**
     * Set the output length
     * @param {int32} size - Output length in bytes, 1..1024
     */
    set outputSize(size) {
      if (size < 1 || size > 1024) {
        throw new Error('Invalid output size: ' + size + ' bytes');
      }
      this._outputSize = size;
    }

    /**
     * The output length
     * @returns {int32} Output length in bytes
     */
    get outputSize() {
      return this._outputSize;
    }

    /**
     * Set the customization string S; it applies to the next Result(), even
     * when elements were fed before it was set
     * @param {uint8[]} customBytes - S as bytes (null clears it)
     */
    set customization(customBytes) {
      /** @type {uint8[]} */
      const copy = [];
      if (customBytes !== null && customBytes !== undefined) {
        for (let i = 0; i < customBytes.length; i++) copy.push(customBytes[i]);
      }
      this._customization = copy;
    }

    /**
     * The customization string S
     * @returns {uint8[]} Copy of S
     */
    get customization() {
      return this._customization.slice();
    }

    /**
     * Select XOF output (right_encode(0)) instead of fixed-length output
     * @param {boolean} enabled - True for TupleHashXOF
     */
    set xofMode(enabled) {
      this._xofMode = enabled ? true : false;
    }

    /**
     * Whether XOF output is selected
     * @returns {boolean} True for TupleHashXOF
     */
    get xofMode() {
      return this._xofMode;
    }

    /**
     * Special property for testing: feeds every element of an array of byte arrays
     * @param {uint8[][]} tupleArray - Tuple elements
     */
    set tuples(tupleArray) {
      if (!Array.isArray(tupleArray)) return;

      for (let i = 0; i < tupleArray.length; i++) {
        this.Feed(tupleArray[i]);
      }
    }

    /**
     * Feed one tuple element
     * @param {uint8[]} data - Element bytes
     */
    Feed(data) {
      // A zero-length element is still an element. SP 800-185 builds TupleHash
      // over encode_string(X_i) for every i, and encode_string("") is
      // left_encode(0) - two bytes, not nothing. Skipping empty elements makes
      // the tuples ("", "AB") and ("AB") hash alike, which is precisely the
      // ambiguity TupleHash exists to remove, and it is what the NIST ACVP
      // vectors carrying an empty element caught here. Only the absence of an
      // element - null/undefined, how the suite spells "no input" - is a no-op.
      if (data === null || data === undefined) return;

      // Keep encode_string(X_i); cSHAKE absorbs it in Result(), once S is final
      /** @type {uint8[]} */
      const encoded = encodeTuple(data);
      for (let i = 0; i < encoded.length; i++) this._encoded.push(encoded[i]);
    }

    /**
     * Digest of the tuple fed so far, under the settings current now; starts a
     * new tuple (the settings stay)
     * @returns {uint8[]} Output bytes
     * @throws {Error} If the cSHAKE for the security level is not registered
     */
    Result() {
      /** @type {IHashFunctionInstance} */
      const cshake = this._newCshake();
      cshake.Feed(this._encoded);

      // right_encode(L) for fixed-length output, right_encode(0) for TupleHashXOF
      const outputBits = this._xofMode ? 0 : (this._outputSize * 8);
      cshake.Feed(rightEncode(outputBits));

      cshake.outputSize = this._outputSize;
      /** @type {uint8[]} */
      const result = cshake.Result();

      this._encoded = [];
      return result;
    }
  }

  RegisterAlgorithm(new TupleHash128());
  RegisterAlgorithm(new TupleHash256());

  return { TupleHash128, TupleHash256 };
}));
