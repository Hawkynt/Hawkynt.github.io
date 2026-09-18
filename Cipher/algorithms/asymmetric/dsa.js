/*
 * DSA (Digital Signature Algorithm) Implementation
 * Based on FIPS 186-4 standard and Crypto++ reference implementation
 * Uses JavaScript native BigInt for all arithmetic operations
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
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
          Algorithm, CryptoAlgorithm, AsymmetricCipherAlgorithm,
          IAlgorithmInstance, TestCase, LinkItem, KeySize, Vulnerability } = AlgorithmFramework;

  // ===== BigInt Helper Functions =====

  /**
   * Modular exponentiation using BigInt (base^exponent mod modulus)
   * Uses square-and-multiply algorithm for efficiency
   */
  function modPow(base, exponent, modulus) {
    if (modulus === 1n) return 0n;

    var result = 1n;
    base = base % modulus;

    while (exponent > 0n) {
      if (exponent % 2n === 1n) {
        result = (result * base) % modulus;
      }
      exponent = exponent / 2n; // Divide by 2 instead of bit shift
      base = (base * base) % modulus;
    }

    return result;
  }

  /**
   * Modular multiplicative inverse using Extended Euclidean Algorithm
   */
  function modInverse(a, m) {
    a = ((a % m) + m) % m;

    var m0 = m;
    var x0 = 0n;
    var x1 = 1n;

    if (m === 1n) return 0n;

    while (a > 1n) {
      var q = a / m;
      var t = m;

      m = a % m;
      a = t;
      t = x0;

      x0 = x1 - q * x0;
      x1 = t;
    }

    if (x1 < 0n) x1 += m0;

    return x1;
  }

  /**
   * Convert hex string to BigInt
   */
  function hexToBigInt(hexStr) {
    if (!hexStr || hexStr.length === 0) return 0n;
    return BigInt('0x' + hexStr);
  }

  /**
   * Convert BigInt to hex string
   */
  function bigIntToHex(bigIntVal) {
    var hex = bigIntVal.toString(16);
    if (hex.length % 2 !== 0) hex = '0' + hex;
    return hex;
  }

  /**
   * Convert byte array to hex string
   */
  function bytesToHex(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i].toString(16);
      hex += (b.length === 1 ? '0' + b : b);
    }
    return hex;
  }

  /**
   * Convert BigInt to byte array
   */
  function bigIntToBytes(bigIntVal, length) {
    var hex = bigIntToHex(bigIntVal);

    // Pad to desired length
    if (length) {
      var targetLen = length * 2; // 2 hex chars per byte
      while (hex.length < targetLen) {
        hex = '00' + hex;
      }
    }

    return OpCodes.Hex8ToBytes(hex);
  }

  /**
   * Convert byte array to BigInt
   */
  function bytesToBigInt(bytes) {
    if (!bytes || bytes.length === 0) return 0n;
    var hex = bytesToHex(bytes);
    return hexToBigInt(hex);
  }

  // ===== HASHING AND RFC 6979 =====

  // DSA signs a digest. A stand-in for the hash produces a signature that no
  // other implementation verifies, so the approved digests are loaded here and
  // every path below fails loudly if the requested one is missing.
  if (typeof require !== 'undefined') {
    for (var _mod of ['../hash/sha1.js', '../hash/sha256.js', '../hash/sha512.js']) {
      try {
        require(_mod);
      } catch (error) {
        // In the browser these arrive as script tags instead; Find() reports it.
      }
    }
  }

  // Digest and HMAC block sizes in octets for the hashes FIPS 186-4 approves.
  var HASH_PARAMS = {
    'SHA-1':   { outLen: 20, blockLen: 64 },
    'SHA-224': { outLen: 28, blockLen: 64 },
    'SHA-256': { outLen: 32, blockLen: 64 },
    'SHA-384': { outLen: 48, blockLen: 128 },
    'SHA-512': { outLen: 64, blockLen: 128 }
  };

  /**
   * Digest a byte array with a registered hash algorithm.
   * @param {string} hashName - Registered algorithm name, e.g. "SHA-256"
   * @param {uint8[]} bytes - Message octets
   * @returns {uint8[]} Digest octets
   */
  function digest(hashName, bytes) {
    var algorithm = AlgorithmFramework.Find(hashName);
    if (!algorithm) {
      throw new Error('DSA requires the hash ' + hashName + ', which is not registered');
    }

    var instance = algorithm.CreateInstance();
    instance.Feed(bytes);
    return instance.Result();
  }

  /**
   * Concatenate byte arrays without spreading them into an argument list.
   * @param {...uint8[]} parts - Arrays to join
   * @returns {uint8[]} Concatenation
   */
  function concatBytes() {
    var out = [];
    for (var p = 0; p < arguments.length; ++p) {
      var part = arguments[p];
      for (var i = 0; i < part.length; ++i) out.push(part[i]);
    }
    return out;
  }

  /**
   * HMAC (RFC 2104) over one of the digests above.
   * @param {string} hashName - Registered hash algorithm name
   * @param {uint8[]} key - MAC key octets
   * @param {uint8[]} message - Message octets
   * @returns {uint8[]} MAC octets
   */
  function hmac(hashName, key, message) {
    var params = HASH_PARAMS[hashName];
    if (!params) throw new Error('No HMAC block size known for ' + hashName);

    var blockLen = params.blockLen;
    var k = key.length > blockLen ? digest(hashName, key) : key.slice();
    while (k.length < blockLen) k.push(0x00);

    var innerPad = new Array(blockLen);
    var outerPad = new Array(blockLen);
    for (var i = 0; i < blockLen; ++i) {
      innerPad[i] = OpCodes.XorN(k[i], 0x36);
      outerPad[i] = OpCodes.XorN(k[i], 0x5C);
    }

    var innerHash = digest(hashName, concatBytes(innerPad, message));
    return digest(hashName, concatBytes(outerPad, innerHash));
  }

  /**
   * RFC 6979 section 2.3.3: render an integer as exactly rlen octets.
   * @param {BigInt} value - The integer
   * @param {number} rlen - Output length in octets
   * @returns {uint8[]} Big-endian fixed-width octets
   */
  function intToOctets(value, rlen) {
    var bytes = new Array(rlen);
    var v = value;
    for (var i = rlen - 1; i >= 0; --i) {
      bytes[i] = Number(OpCodes.AndN(v, 0xFFn));
      v = OpCodes.ShiftRn(v, 8);
    }
    return bytes;
  }

  /**
   * RFC 6979 section 2.3.2 / FIPS 186-4 section 4.6: take the leftmost qlen
   * bits of an octet string. This is a truncation and not a reduction modulo
   * q; reducing instead changes the digest whenever it exceeds q and the
   * signature then verifies nowhere else.
   * @param {uint8[]} bytes - Octets, normally a digest
   * @param {number} qlen - Bit length of q
   * @returns {BigInt} The truncated integer
   */
  function bitsToInt(bytes, qlen) {
    var value = bytesToBigInt(bytes);
    var blen = bytes.length * 8;
    return blen > qlen ? OpCodes.ShiftRn(value, blen - qlen) : value;
  }

  /**
   * RFC 6979 section 2.3.4.
   * @param {uint8[]} bytes - Digest octets
   * @param {BigInt} q - Subgroup order
   * @param {number} qlen - Bit length of q
   * @param {number} rlen - Octet length used by the generator
   * @returns {uint8[]} Octets of the reduced digest
   */
  function bitsToOctets(bytes, q, qlen, rlen) {
    var z1 = bitsToInt(bytes, qlen);
    var z2 = z1 >= q ? z1 - q : z1;
    return intToOctets(z2, rlen);
  }

  /**
   * RFC 6979 section 3.2: derive the per-signature nonce k deterministically
   * from the private key and the message digest with HMAC-DRBG.
   *
   * The nonce is the whole security of DSA. s = k^-1 (z + x*r) mod q is linear
   * in both k and x, so any k an attacker can predict or solve for - a
   * counter, an offset from the key, a value derived from the message alone -
   * hands over the private key from a single signature.
   *
   * @param {string} hashName - Registered hash algorithm name
   * @param {BigInt} q - Subgroup order
   * @param {BigInt} x - Private key
   * @param {uint8[]} h1 - Digest of the message
   * @returns {BigInt} A nonce in [1, q-1]
   */
  function deterministicNonce(hashName, q, x, h1) {
    var params = HASH_PARAMS[hashName];
    if (!params) throw new Error('No digest length known for ' + hashName);

    var hlen = params.outLen;
    var qlen = q.toString(2).length;
    var rlen = Math.ceil(qlen / 8);

    var xOctets = intToOctets(x, rlen);
    var hOctets = bitsToOctets(h1, q, qlen, rlen);

    var V = new Array(hlen).fill(0x01);
    var K = new Array(hlen).fill(0x00);

    K = hmac(hashName, K, concatBytes(V, [0x00], xOctets, hOctets));
    V = hmac(hashName, K, V);
    K = hmac(hashName, K, concatBytes(V, [0x01], xOctets, hOctets));
    V = hmac(hashName, K, V);

    for (;;) {
      var T = [];
      while (T.length * 8 < qlen) {
        V = hmac(hashName, K, V);
        T = concatBytes(T, V);
      }

      var k = bitsToInt(T, qlen);
      if (k >= 1n && k < q) return k;

      K = hmac(hashName, K, concatBytes(V, [0x00]));
      V = hmac(hashName, K, V);
    }
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class DSASignature extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "DSA";
      this.description = "Digital Signature Algorithm of FIPS 186-4: r = (g^k mod p) mod q and s = k^-1 (z + x*r) mod q over a prime-order subgroup, with the nonce derived from the key and the digest per RFC 6979 and the signature carried as r || s. Verified against the RFC 6979 vectors for both published parameter sets. FIPS 186-5 withdrew DSA for new signatures in 2023; it is here for the standard it defined and for verifying signatures that already exist.";
      this.inventor = "David Kravitz (NSA)";
      this.year = 1991;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Digital Signature";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.ADVANCED;
      this.country = CountryCode.US;

      // Algorithm-specific metadata
      this.SupportedKeySizes = [
        new KeySize(1024, 1024, 0), // DSA-1024 (legacy, L=1024, N=160)
        new KeySize(2048, 2048, 0), // DSA-2048 (L=2048, N=224 or N=256)
        new KeySize(3072, 3072, 0)  // DSA-3072 (L=3072, N=256)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("FIPS 186-4 - Digital Signature Standard (DSS)", "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf"),
        new LinkItem("RFC 6979 - Deterministic Usage of DSA", "https://tools.ietf.org/rfc/rfc6979.txt"),
        new LinkItem("Crypto++ DSA Implementation", "https://github.com/weidai11/cryptopp/blob/master/dsa.cpp"),
        new LinkItem("Wikipedia - Digital Signature Algorithm", "https://en.wikipedia.org/wiki/Digital_Signature_Algorithm")
      ];

      this.references = [
        new LinkItem("NIST CAVP Test Vectors", "https://csrc.nist.gov/projects/cryptographic-algorithm-validation-program"),
        new LinkItem("Crypto++ Test Vectors", "https://github.com/weidai11/cryptopp/blob/master/TestVectors/dsa.txt"),
        new LinkItem("OpenSSL DSA Implementation", "https://github.com/openssl/openssl/blob/master/crypto/dsa/")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Nonce Reuse and Bias",
          "s = k^-1 (z + x*r) mod q is linear in k and in x, so two signatures sharing a "
          + "nonce, or nonces with a few predictable bits, recover the private key outright",
          "The nonce here comes from RFC 6979 section 3.2, derived by HMAC-DRBG from the "
          + "private key and the digest, so no randomness source can go wrong; do not "
          + "substitute a counter or a value derived from the message alone",
          "https://www.rfc-editor.org/rfc/rfc6979#section-3.2"),
        new Vulnerability("Withdrawn for Signing",
          "FIPS 186-5 removed DSA as an approved signature algorithm in 2023, and the "
          + "1024-bit parameter set of A.2.1 is below the strength expected of anything "
          + "still in use",
          "Sign with ECDSA, Ed25519 or ML-DSA; keep DSA only to verify signatures that "
          + "already exist",
          "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-5.pdf"),
        new Vulnerability("Timing and Trace Leakage",
          "Modular exponentiation here branches on the bits of the nonce, so an attacker "
          + "able to time or trace the signer learns k and therefore the private key",
          "Use a constant-time implementation wherever an attacker shares a machine with "
          + "the signer; this file is a reference for the mathematics, not a hardened signer",
          "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.186-4.pdf")
      ];

      // RFC 6979 Appendix A.2.1 and A.2.2 publish the domain parameters, the
      // key pair, and k, r and s for every approved hash. They work as
      // known-answer tests only because the nonce is deterministic: under a
      // random k there is no expected signature to compare against, and a
      // vector could then pin down nothing about what is computed.
      const RFC6979 = "https://www.rfc-editor.org/rfc/rfc6979#appendix-A.2";

      // A.2.1, DSA with a 1024-bit p and a 160-bit q
      const P1024 =
        "86F5CA03DCFEB225063FF830A0C769B9DD9D6153AD91D7CE27F787C43278B447" +
        "E6533B86B18BED6E8A48B784A14C252C5BE0DBF60B86D6385BD2F12FB763ED88" +
        "73ABFD3F5BA2E0A8C0A59082EAC056935E529DAF7C610467899C77ADEDFC846C" +
        "881870B7B19B2B58F9BE0521A17002E3BDD6B86685EE90B3D9A1B02B782B1779";
      const Q1024 = "996F967F6C8E388D9E28D01E205FBA957A5698B1";
      const G1024 =
        "07B0F92546150B62514BB771E2A0C0CE387F03BDA6C56B505209FF25FD3C133D" +
        "89BBCD97E904E09114D9A7DEFDEADFC9078EA544D2E401AEECC40BB9FBBF78FD" +
        "87995A10A1C27CB7789B594BA7EFB5C4326A9FE59A070E136DB77175464ADCA4" +
        "17BE5DCE2F40D10A46A3A3943F26AB7FD9C0398FF8C76EE0A56826A8A88F1DBD";
      const X1024 = "411602CB19A6CCC34494D79D98EF1E7ED5AF25F7";
      const Y1024 =
        "5DF5E01DED31D0297E274E1691C192FE5868FEF9E19A84776454B100CF16F653" +
        "92195A38B90523E2542EE61871C0440CB87C322FC4B4D2EC5E1E7EC766E1BE8D" +
        "4CE935437DC11C3C8FD426338933EBFE739CB3465F4D3668C5E473508253B1E6" +
        "82F65CBDC4FAE93C2EA212390E54905A86E2223170B44EAA7DA5DD9FFCFB7F3B";

      // A.2.2, DSA with a 2048-bit p and a 256-bit q
      const P2048 =
        "9DB6FB5951B66BB6FE1E140F1D2CE5502374161FD6538DF1648218642F0B5C48" +
        "C8F7A41AADFA187324B87674FA1822B00F1ECF8136943D7C55757264E5A1A44F" +
        "FE012E9936E00C1D3E9310B01C7D179805D3058B2A9F4BB6F9716BFE6117C6B5" +
        "B3CC4D9BE341104AD4A80AD6C94E005F4B993E14F091EB51743BF33050C38DE2" +
        "35567E1B34C3D6A5C0CEAA1A0F368213C3D19843D0B4B09DCB9FC72D39C8DE41" +
        "F1BF14D4BB4563CA28371621CAD3324B6A2D392145BEBFAC748805236F5CA2FE" +
        "92B871CD8F9C36D3292B5509CA8CAA77A2ADFC7BFD77DDA6F71125A7456FEA15" +
        "3E433256A2261C6A06ED3693797E7995FAD5AABBCFBE3EDA2741E375404AE25B";
      const Q2048 = "F2C3119374CE76C9356990B465374A17F23F9ED35089BD969F61C6DDE9998C1F";
      const G2048 =
        "5C7FF6B06F8F143FE8288433493E4769C4D988ACE5BE25A0E24809670716C613" +
        "D7B0CEE6932F8FAA7C44D2CB24523DA53FBE4F6EC3595892D1AA58C4328A06C4" +
        "6A15662E7EAA703A1DECF8BBB2D05DBE2EB956C142A338661D10461C0D135472" +
        "085057F3494309FFA73C611F78B32ADBB5740C361C9F35BE90997DB2014E2EF5" +
        "AA61782F52ABEB8BD6432C4DD097BC5423B285DAFB60DC364E8161F4A2A35ACA" +
        "3A10B1C4D203CC76A470A33AFDCBDD92959859ABD8B56E1725252D78EAC66E71" +
        "BA9AE3F1DD2487199874393CD4D832186800654760E1E34C09E4D155179F9EC0" +
        "DC4473F996BDCE6EED1CABED8B6F116F7AD9CF505DF0F998E34AB27514B0FFE7";
      const X2048 = "69C7548C21D0DFEA6B9A51C9EAD4E27C33D3B3F180316E5BCAB92C933F0E4DBC";
      const Y2048 =
        "667098C654426C78D7F8201EAC6C203EF030D43605032C2F1FA937E5237DBD94" +
        "9F34A0A2564FE126DC8B715C5141802CE0979C8246463C40E6B6BDAA2513FA61" +
        "1728716C2E4FD53BC95B89E69949D96512E873B9C8F8DFD499CC312882561ADE" +
        "CB31F658E934C0C197F2C4D96B05CBAD67381E7B768891E4DA3843D24D94CDFB" +
        "5126E9B8BF21E8358EE0E0A30EF13FD6A664C0DCE3731F7FB49A4845A4FD8254" +
        "687972A2D382599C9BAC4E0ED7998193078913032558134976410B89D2C171D1" +
        "23AC35FD977219597AA7D15C1A9A428E59194F75C721EBCBCFAE44696A499AFA" +
        "74E04299F132026601638CB87AB79190D4A0986315DA8EEC6561C938996BEADF";

      // The signature as carried here is r || s, each padded to the length of
      // q, which is how the r and s below are joined into one expected value.
      const SHA256_SAMPLE_1024 = OpCodes.Hex8ToBytes(
        "81F2F5850BE5BC123C43F71A3033E9384611C545" +
        "4CDD914B65EB6C66A8AAAD27299BEE6B035F5E89");

      this.tests = [
        {
          text: 'RFC 6979 A.2.1 - DSA 1024/160, SHA-1, message "sample"',
          uri: RFC6979,
          p: P1024, q: Q1024, g: G1024, x: X1024,
          hashAlgorithm: 'SHA-1',
          input: OpCodes.AnsiToBytes("sample"),
          expected: OpCodes.Hex8ToBytes(
            "2E1A0C2562B2912CAAF89186FB0F42001585DA55" +
            "29EFB6B0AFF2D7A68EB70CA313022253B9A88DF5")
        },
        {
          text: 'RFC 6979 A.2.1 - DSA 1024/160, SHA-256, message "sample"',
          uri: RFC6979,
          p: P1024, q: Q1024, g: G1024, x: X1024,
          hashAlgorithm: 'SHA-256',
          input: OpCodes.AnsiToBytes("sample"),
          expected: SHA256_SAMPLE_1024
        },
        {
          text: 'RFC 6979 A.2.1 - DSA 1024/160, SHA-256, message "test"',
          uri: RFC6979,
          p: P1024, q: Q1024, g: G1024, x: X1024,
          hashAlgorithm: 'SHA-256',
          input: OpCodes.AnsiToBytes("test"),
          expected: OpCodes.Hex8ToBytes(
            "22518C127299B0F6FDC9872B282B9E70D0790812" +
            "6837EC18F150D55DE95B5E29BE7AF5D01E4FE160")
        },
        {
          text: 'RFC 6979 A.2.2 - DSA 2048/256, SHA-256, message "sample"',
          uri: RFC6979,
          p: P2048, q: Q2048, g: G2048, x: X2048,
          hashAlgorithm: 'SHA-256',
          input: OpCodes.AnsiToBytes("sample"),
          expected: OpCodes.Hex8ToBytes(
            "EACE8BDBBE353C432A795D9EC556C6D021F7A03F42C36E9BC87E4AC7932CC809" +
            "7081E175455F9247B812B74583E9E94F9EA79BD640DC962533B0680793A38D53")
        },
        {
          text: 'RFC 6979 A.2.2 - DSA 2048/256, SHA-512, message "test"',
          uri: RFC6979,
          p: P2048, q: Q2048, g: G2048, x: X2048,
          hashAlgorithm: 'SHA-512',
          input: OpCodes.AnsiToBytes("test"),
          expected: OpCodes.Hex8ToBytes(
            "89EC4BB1400ECCFF8E7D9AA515CD1DE7803F2DAFF09693EE7FD1353E90A68307" +
            "C9F0BDABCC0D880BB137A994CC7F3980CE91CC10FAF529FC46565B15CEA854E1")
        },
        {
          // Verification over the same published signature, driven from the
          // public key alone. Signing and verifying are separate code paths
          // and a vector that only signs leaves the second one unmeasured.
          text: 'RFC 6979 A.2.1 - verify the published SHA-256 signature over "sample"',
          uri: RFC6979,
          p: P1024, q: Q1024, g: G1024, y: Y1024,
          hashAlgorithm: 'SHA-256',
          signature: SHA256_SAMPLE_1024,
          input: OpCodes.AnsiToBytes("sample"),
          expected: [1]
        },
        {
          // The same signature against a different message. It must fail, and
          // it is the case a verifier that does not hash the message at all
          // has no way to detect.
          text: 'RFC 6979 A.2.1 - the SHA-256 signature over "sample" must not verify over "test"',
          uri: RFC6979,
          p: P1024, q: Q1024, g: G1024, y: Y1024,
          hashAlgorithm: 'SHA-256',
          signature: SHA256_SAMPLE_1024,
          input: OpCodes.AnsiToBytes("test"),
          expected: [0]
        },
        {
          // The published signature presented under a public key that is not
          // the signer's. The y below is an arbitrary residue standing in for
          // another party's key; nothing about it is published, and nothing
          // needs to be, because the assertion is only that it is rejected.
          text: 'RFC 6979 A.2.1 - the SHA-256 signature over "sample" must not verify under another key',
          uri: RFC6979,
          p: P1024, q: Q1024, g: G1024,
          y: "62D1C9CEBCCAB5C44CCB9DED8A99B33FA1D6FF1E0B2A0F1FE8B6C48AC5B9A4D5",
          hashAlgorithm: 'SHA-256',
          signature: SHA256_SAMPLE_1024,
          input: OpCodes.AnsiToBytes("sample"),
          expected: [0]
        }
      ];
    }

    /**
   * Create new cipher instance
   * @param {boolean} [isInverse=false] - True for decryption, false for encryption
   * @returns {Object} New cipher instance
   */

    CreateInstance(isInverse = false) {
      return new DSAInstance(this, isInverse);
    }
  }

  /**
 * DSA cipher instance implementing Feed/Result pattern
 * @class
 * @extends {IBlockCipherInstance}
 */

  class DSAInstance extends IAlgorithmInstance {
    /**
   * Initialize Algorithm cipher instance
   * @param {Object} algorithm - Parent algorithm instance
   * @param {boolean} [isInverse=false] - Decryption mode flag
   */

    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];

      // DSA domain parameters (p, q, g)
      this._p = null; // Prime modulus
      this._q = null; // Prime divisor (subgroup order)
      this._g = null; // Generator

      // DSA keys
      this._publicKey = null;  // y = g^x mod p
      this._privateKey = null; // x (private exponent)

      // Signature for verification
      this._signature = null;

      // Digest the signature is taken over
      this._hashAlgorithm = 'SHA-1';
    }

    // Property setters for test vector support
    set p(value) {
      if (typeof value === 'string') {
        this._p = hexToBigInt(value);
      } else if (Array.isArray(value)) {
        this._p = bytesToBigInt(value);
      } else if (typeof value === 'bigint') {
        this._p = value;
      }
    }

    get p() { return this._p; }

    set q(value) {
      if (typeof value === 'string') {
        this._q = hexToBigInt(value);
      } else if (Array.isArray(value)) {
        this._q = bytesToBigInt(value);
      } else if (typeof value === 'bigint') {
        this._q = value;
      }
    }

    get q() { return this._q; }

    set g(value) {
      if (typeof value === 'string') {
        this._g = hexToBigInt(value);
      } else if (Array.isArray(value)) {
        this._g = bytesToBigInt(value);
      } else if (typeof value === 'bigint') {
        this._g = value;
      }
    }

    get g() { return this._g; }

    set y(value) {
      // Public key (y = g^x mod p)
      if (typeof value === 'string') {
        this._publicKey = hexToBigInt(value);
      } else if (Array.isArray(value)) {
        this._publicKey = bytesToBigInt(value);
      } else if (typeof value === 'bigint') {
        this._publicKey = value;
      }
    }

    get y() { return this._publicKey; }

    // Private key x, in [1, q-1]. There was no way to set one before, which is
    // why signing could not reach the arithmetic below.
    set x(value) {
      this.privateKey = value;
    }

    get x() { return this._privateKey; }

    set privateKey(value) {
      var x = null;
      if (typeof value === 'string') x = hexToBigInt(value);
      else if (Array.isArray(value)) x = bytesToBigInt(value);
      else if (typeof value === 'bigint') x = value;

      if (x === null) { this._privateKey = null; return; }

      if (this._q && (x <= 0n || x >= this._q)) {
        throw new Error('DSA private key out of range: x must satisfy 0 < x < q');
      }

      this._privateKey = x;

      // y = g^x mod p, derived so a caller that sets only the domain
      // parameters and x can still verify what it signed.
      if (this._p && this._g && this._publicKey === null) {
        this._publicKey = modPow(this._g, x, this._p);
      }
    }

    get privateKey() { return this._privateKey; }

    // Which digest the signature is taken over. FIPS 186-4 permits any
    // approved hash whose output is at least as long as q, and RFC 6979
    // derives the nonce from the same one.
    set hashAlgorithm(name) {
      if (!name) return;
      if (!HASH_PARAMS[name]) {
        throw new Error('Unsupported hash for DSA: ' + name);
      }
      this._hashAlgorithm = name;
    }

    get hashAlgorithm() { return this._hashAlgorithm; }

    set signature(value) {
      if (Array.isArray(value)) {
        // DSA signature format: r || s (each 20 bytes for DSA-1024 with SHA-1)
        var halfLen = value.length / 2;
        var rBytes = value.slice(0, halfLen);
        var sBytes = value.slice(halfLen);

        this._signature = {
          r: bytesToBigInt(rBytes),
          s: bytesToBigInt(sBytes)
        };
      } else if (value && typeof value === 'object') {
        this._signature = value;
      }
    }

    get signature() { return this._signature; }

    set expected(value) {
      // For test vectors - expected result
      this._expectedResult = value;
    }

    get expected() { return this._expectedResult; }

    // Feed data for signing/verification
    /**
   * Feed data to cipher for processing
   * @param {uint8[]} data - Input data bytes
   * @throws {Error} If key not set
   */

    Feed(data) {
      if (Array.isArray(data)) {
        for (let _i = 0; _i < data.length; _i++) this.inputBuffer.push(data[_i]);
      } else if (typeof data === 'string') {
        this.inputBuffer.push(...OpCodes.AnsiToBytes(data));
      } else {
        this.inputBuffer.push(data);
      }
    }

    // Get result (sign or verify)
    /**
   * Get cipher result (encrypted or decrypted data)
   * @returns {uint8[]} Processed output bytes
   * @throws {Error} If key not set, no data fed, or invalid input length
   */

    Result() {
      try {
        var result;

        // If signature is provided, always verify (regardless of isInverse)
        if (this._signature) {
          result = this.Verify(this.inputBuffer, this._signature);
        } else if (this.isInverse) {
          // Verification mode but no signature - error
          throw new Error("Verification mode requires signature to be set");
        } else {
          result = this.Sign(this.inputBuffer);
        }

        this.inputBuffer = [];
        return result;
      } catch (error) {
        this.inputBuffer = [];
        throw error;
      }
    }

    /**
     * DSA Signature Generation
     * Input: message M, domain parameters (p, q, g), private key x
     * Output: signature (r, s)
     *
     * Algorithm:
     * 1. Compute e = H(M) where H is SHA-1 or SHA-2
     * 2. Generate random k where 0 < k < q
     * 3. Compute r = (g^k mod p) mod q
     * 4. Compute s = k^-1 * (e + x*r) mod q
     * 5. Return (r, s)
     */
    Sign(message) {
      if (!this._p || !this._q || !this._g) {
        throw new Error("DSA domain parameters (p, q, g) not set");
      }

      if (this._privateKey === null || this._privateKey === undefined) {
        throw new Error("DSA private key not set");
      }

      var qlen = this._q.toString(2).length;

      // Step 1: z = leftmost min(N, outlen) bits of Hash(M). The digest is
      // needed twice as the same octets: as the integer z that enters s, and
      // as the input to the nonce generator.
      var h1 = digest(this._hashAlgorithm, message);
      var z = bitsToInt(h1, qlen);

      // Step 2: k from RFC 6979, not from the key plus a constant
      var k = deterministicNonce(this._hashAlgorithm, this._q, this._privateKey, h1);

      // Step 3: r = (g^k mod p) mod q
      var r = modPow(this._g, k, this._p) % this._q;
      if (r === 0n) {
        throw new Error("DSA signature generation failed: r = 0");
      }

      // Step 4: s = k^-1 * (z + x*r) mod q
      var s = (modInverse(k, this._q) * (z + this._privateKey * r)) % this._q;
      if (s === 0n) {
        throw new Error("DSA signature generation failed: s = 0");
      }

      // Return signature as r || s, each padded to the length of q so the two
      // halves can be split apart again without a length prefix.
      var qByteLength = Math.ceil(qlen / 8);
      return bigIntToBytes(r, qByteLength).concat(bigIntToBytes(s, qByteLength));
    }

    /**
     * DSA Signature Verification
     * Input: message M, signature (r, s), domain parameters (p, q, g), public key y
     * Output: true if valid, false otherwise
     *
     * Algorithm:
     * 1. Verify 0 < r < q and 0 < s < q
     * 2. Compute e = H(M) - message bytes are treated as hash
     * 3. Compute w = s^-1 mod q
     * 4. Compute u1 = e*w mod q
     * 5. Compute u2 = r*w mod q
     * 6. Compute v = ((g^u1 * y^u2) mod p) mod q
     * 7. Return v == r
     */
    Verify(message, signature) {
      if (!this._p || !this._q || !this._g) {
        throw new Error("DSA domain parameters (p, q, g) not set");
      }

      if (!this._publicKey) {
        throw new Error("DSA public key not set");
      }

      if (!signature || !signature.r || !signature.s) {
        throw new Error("DSA signature not set");
      }

      var r = signature.r;
      var s = signature.s;

      // Step 1: Verify 0 < r < q and 0 < s < q
      if (r <= 0n || r >= this._q || s <= 0n || s >= this._q) {
        return [0]; // Invalid signature - return false as byte array
      }

      // Step 2: z = leftmost min(N, outlen) bits of Hash(M). Treating the
      // message bytes as the digest, as this did, means a verifier that never
      // hashes anything and cannot agree with any signer.
      var z = bitsToInt(digest(this._hashAlgorithm, message), this._q.toString(2).length);

      // Step 3: Compute w = s^-1 mod q
      var w = modInverse(s, this._q);

      // Step 4: Compute u1 = z*w mod q
      var u1 = (z * w) % this._q;

      // Step 5: Compute u2 = r*w mod q
      var u2 = (r * w) % this._q;

      // Step 6: Compute v = ((g^u1 * y^u2) mod p) mod q
      var g_u1 = modPow(this._g, u1, this._p);
      var y_u2 = modPow(this._publicKey, u2, this._p);
      var v = ((g_u1 * y_u2) % this._p) % this._q;

      // Step 7: Return v == r
      var isValid = (v === r);

      // Return as byte array for test framework compatibility
      return isValid ? [1] : [0];
    }

    // Clear sensitive data
    ClearData() {
      if (this._privateKey) {
        this._privateKey = 0n;
      }
      this._privateKey = null;
      this._publicKey = null;
      this._p = null;
      this._q = null;
      this._g = null;
      this._signature = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  var algorithmInstance = new DSASignature();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DSASignature, DSAInstance };
}));
