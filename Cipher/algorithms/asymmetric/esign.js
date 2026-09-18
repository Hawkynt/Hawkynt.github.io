/*
 * ESIGN-D Implementation
 * Okamoto's ESIGN signature scheme over a modulus n = p^2 * q
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Specified by the NESSIE submission "ESIGN-D" (NTT, 21 August 2002), which
 * normatively references IEEE P1363a / D10. Writing pLen for the common width
 * of the two prime factors, the modulus satisfies
 *
 *     2^(3*pLen-1)  <  n = p^2 * q  <  2^(3*pLen)
 *
 * and the message representative f occupies pLen-1 bits. Verification, VP-ESIGN-D,
 * accepts a signature s when
 *
 *     0 <= s < n     and     floor( (s^e mod n) / 2^(2*pLen) )  equals  f
 *
 * equivalently when s^e mod n lies in [ f*2^(2*pLen), (f+1)*2^(2*pLen) ).
 *
 * Signing, SP-ESIGN-D, solves for that interval rather than searching for it.
 * Because n = p^2 * q, the square of any multiple of p*q is a multiple of n, so
 * writing s = r + t*p*q collapses the binomial expansion of s^e after two terms:
 *
 *     s^e  ==  r^e + e * r^(e-1) * t * p * q   (mod n)
 *
 * which is linear in t. The signer sets z = f * 2^(2*pLen), takes
 * a = (z - r^e) mod n, rounds a up to the next multiple of p*q to obtain
 * w0 = ceil(a / (p*q)), and solves e * r^(e-1) * t == w0 (mod p). The leftover
 * w1 = w0*p*q - a is exactly the amount by which s^e mod n overshoots z, and the
 * specification retries whenever it reaches 2^(2*pLen-1).
 *
 * The D in ESIGN-D is the derandomisation: r is not drawn at random but derived
 * from a secret seed held with the private key, the representative, and the
 * attempt counter, through MGF1. Signing is therefore deterministic, which is
 * what makes the published test vectors reproducible byte for byte.
 *
 * References:
 *   NESSIE ESIGN-D specification and test vectors (NTT, 2002)
 *   IEEE P1363a - Standard Specifications for Public-Key Cryptography,
 *                 Additional Techniques (ESIGN signatures, EMSA5 encoding)
 *   RFC 8017 Appendix B.2.1 - MGF1, the mask generation function EMSA5 uses
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
          AsymmetricCipherAlgorithm, IAlgorithmInstance,
          LinkItem, Vulnerability, KeySize } = AlgorithmFramework;

  // ===== HASHING =====

  // EMSA-ESIGN-D-ENCODE is defined over SHA-1 and MGF1-SHA1. A stand-in for the
  // hash produces signatures no other implementation accepts, so the digest is
  // loaded from the collection and every path below fails loudly without it.
  //
  // On first use rather than at load: requiring the module here would register a
  // hash algorithm while this file is being loaded, and every tool that
  // attributes an algorithm to whichever file was loading when it registered
  // would then file SHA-1 under asymmetric ciphers.
  let hashesLoaded = false;

  /**
   * Load the digest module ESIGN needs, once.
   * @returns {void}
   */
  function loadHashes() {
    if (hashesLoaded) return;
    hashesLoaded = true;
    if (typeof require === 'undefined') return;

    try {
      require('../hash/sha1.js');
    } catch (error) {
      // In the browser this arrives as a script tag instead; Find() reports it.
    }
  }

  const HASH_NAME = 'SHA-1';
  const HASH_LENGTH = 20;

  // LOW_BIT_MASK[i] keeps the 8-i low bits of an octet and clears the rest, so
  // that a representative can be cut to a width that is not a whole octet.
  const LOW_BIT_MASK = [0xFF, 0x7F, 0x3F, 0x1F, 0x0F, 0x07, 0x03, 0x01];

  /**
   * Digest a byte array with the registered hash algorithm.
   * @param {uint8[]} bytes - Message octets
   * @returns {uint8[]} Digest octets
   */
  function digest(bytes) {
    loadHashes();

    const algorithm = AlgorithmFramework.Find(HASH_NAME);
    if (!algorithm) {
      throw new Error('ESIGN requires the hash ' + HASH_NAME + ', which is not registered');
    }

    const instance = algorithm.CreateInstance();
    instance.Feed(bytes);
    return instance.Result();
  }

  /**
   * MGF1 mask generation (RFC 8017 Appendix B.2.1), over SHA-1, counting from
   * zero. This is the mask function both EMSA5 and the ESIGN-D derandomiser use.
   * @param {uint8[]} seed - Seed octets
   * @param {number} maskLen - Requested mask length in octets
   * @returns {uint8[]} Mask of exactly maskLen octets
   */
  function mgf1(seed, maskLen) {
    const mask = [];
    const blocks = Math.ceil(maskLen / HASH_LENGTH);

    for (let counter = 0; counter < blocks; ++counter) {
      // I2OSP(counter, 4), big-endian
      const suffix = OpCodes.Unpack32BE(counter);

      const block = new Array(seed.length + 4);
      for (let i = 0; i < seed.length; ++i) block[i] = seed[i];
      for (let i = 0; i < 4; ++i) block[seed.length + i] = suffix[i];

      const chunk = digest(block);
      for (let i = 0; i < chunk.length; ++i) mask.push(chunk[i]);
    }

    return mask.slice(0, maskLen);
  }

  // ===== INTEGER / OCTET-STRING PRIMITIVES =====

  /**
   * Parse a hexadecimal literal into a BigInt.
   * @param {string} hex - Hexadecimal digits, no prefix
   * @returns {BigInt} Parsed value
   */
  function hexToBigInt(hex) {
    let value = 0n;
    for (let i = 0; i < hex.length; ++i) {
      value = value * 16n + BigInt(parseInt(hex.charAt(i), 16));
    }
    return value;
  }

  /**
   * OS2IP - Octet string to non-negative integer (RFC 8017 Section 4.2)
   * @param {uint8[]} octets - Big-endian octet string
   * @returns {BigInt} Corresponding integer
   */
  function OS2IP(octets) {
    let value = 0n;
    for (let i = 0; i < octets.length; ++i) {
      value = value * 256n + BigInt(octets[i]);
    }
    return value;
  }

  /**
   * I2OSP - Non-negative integer to octet string (RFC 8017 Section 4.1)
   * @param {BigInt} value - Integer to convert
   * @param {number} xLen - Intended length of the octet string
   * @returns {uint8[]} Big-endian octet string of exactly xLen octets
   */
  function I2OSP(value, xLen) {
    if (value < 0n) {
      throw new Error('I2OSP: integer must be non-negative');
    }

    const octets = new Array(xLen);
    let remaining = value;
    for (let i = xLen - 1; i >= 0; --i) {
      octets[i] = Number(remaining % 256n);
      remaining = remaining / 256n;
    }

    if (remaining !== 0n) {
      throw new Error('I2OSP: integer too large for ' + xLen + ' octets');
    }

    return octets;
  }

  /**
   * Number of bits in a non-negative BigInt.
   * @param {BigInt} value - The number
   * @returns {number} Bit length, zero for zero
   */
  function bitCount(value) {
    if (value === 0n) return 0;
    return value.toString(2).length;
  }

  /**
   * Modular exponentiation by square and multiply.
   * @param {BigInt} base - Base value
   * @param {BigInt} exponent - Exponent
   * @param {BigInt} modulus - Modulus
   * @returns {BigInt} base^exponent mod modulus
   */
  function modPow(base, exponent, modulus) {
    if (modulus === 1n) return 0n;

    let result = 1n;
    let b = ((base % modulus) + modulus) % modulus;
    let e = exponent;

    while (e > 0n) {
      if (e % 2n === 1n) {
        result = (result * b) % modulus;
      }
      e = e / 2n;
      b = (b * b) % modulus;
    }

    return result;
  }

  /**
   * Modular multiplicative inverse by the extended Euclidean algorithm.
   * @param {BigInt} a - Value to invert
   * @param {BigInt} m - Modulus
   * @returns {BigInt} The inverse of a modulo m
   * @throws {Error} When a is not invertible modulo m
   */
  function modInverse(a, m) {
    let oldR = ((a % m) + m) % m;
    let r = m;
    let oldS = 1n;
    let s = 0n;

    while (r !== 0n) {
      const quotient = oldR / r;
      const nextR = oldR - quotient * r;
      const nextS = oldS - quotient * s;
      oldR = r; r = nextR;
      oldS = s; s = nextS;
    }

    if (oldR !== 1n) {
      throw new Error('ESIGN: value has no inverse modulo the prime factor');
    }

    return ((oldS % m) + m) % m;
  }

  // ===== ESIGN CORE =====

  /**
   * The parameter pLen: the common bit width of p and q. The modulus of ESIGN
   * is p^2*q with both factors the same width, so its bit length is three times
   * this and is necessarily a multiple of three.
   * @param {BigInt} n - The modulus
   * @returns {number} pLen
   */
  function getPLen(n) {
    const bits = bitCount(n);
    if (bits % 3 !== 0) {
      throw new Error('ESIGN: modulus of ' + bits + ' bits is not three times a prime width');
    }
    return bits / 3;
  }

  /**
   * VP-ESIGN-D, the public function: the leading bits of s^e mod n.
   * @param {BigInt} s - Signature value
   * @param {BigInt} e - Public exponent
   * @param {BigInt} n - Modulus
   * @returns {BigInt} floor((s^e mod n) / 2^(2*pLen))
   */
  function ESIGNApply(s, e, n) {
    return OpCodes.ShiftRn(modPow(s, e, n), 2 * getPLen(n));
  }

  /**
   * SP-ESIGN-D, the private operation: find s whose image under ESIGNApply is f.
   *
   * @param {BigInt} f - Message representative, below 2^(pLen-1)
   * @param {BigInt} e - Public exponent
   * @param {BigInt} n - Modulus, equal to p^2 * q
   * @param {BigInt} p - First prime factor
   * @param {BigInt} q - Second prime factor
   * @param {uint8[]} seed - The secret seed, 2*pLen/8 octets
   * @returns {BigInt} A signature s in [0, n)
   */
  function ESIGNCalculateInverse(f, e, n, p, q, seed) {
    const pLen = getPLen(n);
    const pq = p * q;
    const z = OpCodes.ShiftLn(f, 2 * pLen);
    const fOctets = Math.ceil((pLen - 1) / 8);
    const rOctets = 2 * pLen / 8;
    const w1Bound = OpCodes.ShiftLn(1n, 2 * pLen - 1);
    const fBytes = I2OSP(f, fOctets);

    // The attempt counter is a four-octet field, so it bounds the loop as the
    // specification does: exhausting it is a failure to sign, not a silent
    // fallback to an unchecked value.
    for (let counter = 1; counter < 4294967296; ++counter) {
      // r = MGF1( seed || I2OSP(f, fOctets) || I2OSP(counter, 4) )
      const suffix = OpCodes.Unpack32BE(counter);
      const mgfInput = new Array(seed.length + fOctets + 4);
      for (let i = 0; i < seed.length; ++i) mgfInput[i] = seed[i];
      for (let i = 0; i < fOctets; ++i) mgfInput[seed.length + i] = fBytes[i];
      for (let i = 0; i < 4; ++i) mgfInput[seed.length + fOctets + i] = suffix[i];

      const r = OS2IP(mgf1(mgfInput, rOctets));
      if (r >= pq) continue;

      const re = modPow(r, e, n);
      const a = ((z - re) % n + n) % n;

      // w0 = ceil(a / pq): the smallest multiple of pq at or above a. The
      // remainder w1 = w0*pq - a is what s^e mod n overshoots z by.
      let w0 = a / pq;
      if (a % pq !== 0n) w0 = w0 + 1n;
      const w1 = w0 * pq - a;
      if (w1 >= w1Bound) continue;

      // Solve e * r^(e-1) * t == w0 (mod p). Only a draw with p dividing r
      // leaves this unsolvable, which the specification also retries.
      if (r % p === 0n) continue;
      const denominator = ((e % p) * modPow(r, e - 1n, p)) % p;
      if (denominator === 0n) continue;

      let t;
      try {
        t = ((w0 % p) * modInverse(denominator, p)) % p;
      } catch (error) {
        continue;
      }

      const s = r + t * pq;
      if (s >= n) continue;

      return s;
    }

    throw new Error('ESIGN: the four-octet attempt counter was exhausted without a signature');
  }

  // ===== KEY MATERIAL =====

  // Four published ESIGN-D key pairs, so that a signing instance and a verifying
  // instance configured with the same selector share the same modulus, and so
  // that the published signatures over them can be reproduced here.
  //
  // These are key blocks 0, 4, 10 and 12 of ESIGN-D_test_vectors.txt, the test
  // vector file of the NESSIE ESIGN-D submission, dated 25 June 2002. Each
  // carries the secret SEED that the derandomiser needs, which is why the
  // signatures they produce are reproducible at all. They are published
  // material and confer no confidentiality whatever.
  //
  // Independently confirmed for all four, before any was written down here:
  // p and q are prime by Miller-Rabin, they are distinct, each carries exactly
  // pLen bits, and p * p * q reproduces n exactly. A file that merely asserted a
  // modulus could not sign, since the signer needs the factorisation; the file
  // this replaced carried an n that was not p^2*q for any p and q it named.
  //
  // Two of the twenty SEED fields in that file are printed one hex digit short,
  // because the generator wrote them as integers rather than as fixed-width
  // octet strings. Neither of those two keys is used here, and the four below
  // are transcribed at their full width.
  const ESIGN_KEYS = {
    'NESSIE-1536-0': {
      n: 'e6755c83eb4a23269d342e6ec74e632e593bdb345206d7b7697a4940df800ae4' +
         '7e866ee0368e7c1ed5d31d0d8629d691855b823bb3d2576eacb7311cdddc4815' +
         '0ac15beac84209e1fe5f8504677a154192dbe8da75f84e4749273619ccdb243f' +
         'b308970ad0c70f911c05502786138650b4546d7662a1ba18473a61daf364e44b' +
         'a758b88a40b203f064a8ebb90d6a505eaf781ee8a70a43731edaa000104461f2' +
         '8992d4d5cda20b001e0f5f1bad81d22f26005226a012a745b8c6aec5bc0915dd',
      e: '10001',
      p: 'f816b36a63ba7b53cb75f9a74fa9cc032fd8c00f6beb24885a16950fe7ef54d5' +
         'e474582a4a7512c1379c05081ed1c056e500e19ba1882419ab751573e9c1a1cb',
      q: 'f5641a315c2fdc59f81630130f32cb3923cbbaefebf230b9e23edc7e51e7f068' +
         'bc82ab8d28362a738fcdf274ab2ae9f0bd9991bcf7a092b7f743f0c3211a1b05',
      seed: 'e8e57c5ea7f687b32ae45218627222ab2a9b8298493ab5520e78d77979c2a078' +
            'a0d2c8f2363a4a58c5334d16ed7243a74a329cd8e0ba5dbe41522feb984d5a3b' +
            '3f1bee209a5032ab5a7b8ed61a3f53e3cfb94ecb3f5a52af19e164e20cd7df17' +
            'c8dc76ee632a7ee4b679a4f03c3511e933f949a14f1354571d45c0a8dfd64677'
    },
    'NESSIE-1536-4': {
      n: '91b6a444d9f130241f4c109510cd05cc3a5503f4f75342eec90ba4edc5fedc44' +
         'bfe57809e86ba189fcdd6386ca67d1debd65e42a3511c89aa811365df8c8a61d' +
         '3ecd129cc04ae9c7067c9281c71fe299039b17afc7611ac07255e30a3413ac71' +
         '9403f8cebc29716305298fab90a9370efdc9bc7d017c1537708b82ff7a6afed5' +
         '352a557d19ddf8ee895ca4edcc37aa255530daf798312153c45c098886d94e3b' +
         '3f97efebcbb3914a6166684b652fa949f3d089f37a3cf3539b3856aa753d86ab',
      e: '10001',
      p: 'eb9b71f5421c036b87860aea1defe10c18a3275acaafc5cb831ca960fe92b416' +
         '895cd79133a0057310d28c366248db92b738d54e4ca64846a5ce9cee50458d1f',
      q: 'ac077fe0f98bc439995577a9564d38df63a5081ec0b88b7c97a40d14ca696050' +
         '3da6ca796bead0891c094dd2c0fe1b61e1815644a670ab068654883c2997d36b',
      seed: '1920c44dd8ba2d4f2127a5ad224ff7062bb4412aeba984bcb036892a0ac829b6' +
            '725745b55532cbc66617e8c2967595f3a5352bffa2283aa0f8f98f75da9ce587' +
            'c661a8c10dda5fa8b28b32436d7657e08fd438c774d309c04c63117f612c5fd4' +
            'a6dbb071cfcf20f55e606c0f40ef8a84ff88860b39dc93d64da8189e5881a418'
    },
    'NESSIE-3072-10': {
      n: 'a720c94a5f564c0d9e8061416384741ceb3fd3bb6cadc04c5fd684cac23fe7b6' +
         'aef8117c311ae09210a61f513296d6c8a65e20d1d0f109be26bc8f725026843d' +
         '3df60150efc3a29a1acf7c2c57455c0ac4b9f2588f4f73fcb55b86d3d56c9d14' +
         '5bb06180adf818a53ed92c8b40acdfd2f8a81f39ac0798adb103b773d4d157d1' +
         '32e2234329fb0b77d69a0f4578cf564f43d762c59fbcc6fa0fd3bef58cd6bfe1' +
         '2c8a5e1bfa6231c63a691ae87b97cbceac17338387cc3c3254ac32a65e6c81c3' +
         'adf4a884f0d6c9c91f4c9d6ce6dc5d638a37a76ec9c557d15a03d9ad2718a08a' +
         'c7b65fc71c54e5bfa983e6815eb0e2e237ce68ef9c572af926e0689b22e28293' +
         '0d162b691c2ad90620abe6cf454fa82df8c192ca15717ab6cbcba1df765f4893' +
         'cd7fe47bed63aa8729afc9edd9afc3b1969034fccc544c0c5c30542860941c51' +
         '9fe8feba4632b30b687f8abf443a08c34f2c52357cb01945d69e604292ae9dfd' +
         '47a6bfdef6e803a0aacd71ca9f60443448cbed31e25f4d0d7c88d1249bc79981',
      e: '10001',
      p: 'd990ccd887c6739ae307259f06482c00927a28e084ef8ecb6d2ebc98483c3dff' +
         'b91edfb8b287c865379e7d820bb6e609017da9ac0de50123b617a2bd91247859' +
         '581ed1701ef1b6d0f51e3712d11408e61034077c3235167ddb037947da6f39ed' +
         '53c7b8f56a360afb14d7008d5e491aa1a1fb9f3593044b7d95c43637dab32071',
      q: 'e7646935d82a56d826ddacca5f898be8217a14b67cde3f326af95a3c727c9636' +
         '3d71aa6c3b7c426c8cddfe55bd5d06c893505189f37ee5b063ea260c38bdfe13' +
         'be22e937f374235c139628279361a5c69eb0d55ceb5601c39331c600def6928d' +
         '34fb3730d6d16fa8c21e4fef6a01827ce6b1fac1197b1bfcfb6f6977dc035ba1',
      seed: '170c1c8be7642e4af1d7ca007df4aa8795f4b2f71ee7f4e6a3bef306b9f97b13' +
            '5df1922aaa70701b644fcb50583b16aa6e458d8db8eb0b1a7b689c777d0705ed' +
            '5cd0836dc81c1ae66642bbb2a584d0c445f0424e97aeaa2dfd98abd1e0fae54d' +
            '57ec79ac27eef0341fd7f8f06c8dc02b1f0747b3e30109f7ddc64918d75fc087' +
            'b53b269497523f2d36dbb88f7bc7080213fdda5eb792620097a188c406a85e0b' +
            '39e651f8ef8599859f8a94e7fb08b95cb90076f002660c3ffc41d31ba994124f' +
            '41b6b2640d3ecf311179fddb5cc2d339c316813f0aff1ff62de710ea6a17f90f' +
            '6b9881686ce7b3989e693e36c15a09e1931fd8485b55c48e0214bf31bb2873a5'
    },
    'NESSIE-3072-12': {
      n: '84c133e09ed5c096f79b5758cd1d1b468a469c448f0351f9916a5c0c9ea39f1a' +
         '6e893f23fc08f037c64ba49c1edd0972719efded27f864fd4748d1794906c16b' +
         'cda105c54cf9f70260eadf7f84c53b7ff851a9566251d959ec1ce375e9092a8e' +
         '5af2389c0b2e8e3998fb01c632fc194b5c54f94bd21cf18ec9b7a45d1cb2173a' +
         'b866d0f20a66da60e4e1b4317c04fa331d4aa8246509ff3f840b460aa6baaeb1' +
         'e657492575ea21da794fe3da3eba467b31f8cc9a6fda9d243bff35408842cb3b' +
         '6ad9c5a9a8c9aea704f90df681e9b28a88bdb77f0722950b3fdb935da349e7fd' +
         '21ccbb7f26265ea75221b3903fbca8743c41841fb094b074770fb36418248cdc' +
         'b30073dc3f5c4f3f52e920a6123af895c09ba8bb1ef328c06c6f6a4c52012f79' +
         'f95227432ea051f60c3901b9a80d08e5c6e6d603c7e9e5ecbb75bde5eb9dd6b6' +
         'f2f65a81d06feb133d5e851d9c45db1577566f121915e5597fa9cc6a357c92ed' +
         '9f1fafa681a4bfd86363a25fac0c7c4e61bd25c219e38fbeb1945baf8b917cd7',
      e: '10001',
      p: 'fb11ae1f56da6304942adb575d64750dc9268a6c827a551b01cb9e85f315816b' +
         'e158e0735422b38217626c8c6eb3990b4cb0d6ce18b5897eb52fb1677f6a8e00' +
         '013c8765227b7fcf0699145a08a98f71dbfc59ba3c26e13f59b4ca232265d642' +
         '72f8f919ee362d2914dd00d7e4254ca7833b77d676a7a16849b48843a840ae51',
      q: '8a053bebd427ab6b34dd020fd40825e34fb0c01f07a9566e799cb81cb0fbcb5a' +
         'b1bf1a3e15f408f7ee82ffa7baaeb2f00498cc96adeec50bf7a60b75d8d2e5de' +
         '6a4d4020ba85df7597594db21c9639985690142a31349209f311ee1d2702e368' +
         '7ce09970b29fc0a29dd7e3430fa9b7e5bb52a4e8bdfe27b769af7d6384222f77',
      seed: 'ff1a0e5f7bd48b7fd7950f758cee1a11b2f4442e5a047055f5f5498e1741c3a2' +
            '0703e6e904024a3315c9b4971676e303b7334016d0c513a9bcad6cd49f04377d' +
            '55563d1e72fb111ba44ac5e883ba25621984d84b04e6f399ef566dd28ad3e66a' +
            '7189eee59b52b5cf34c328c049ed9a5ddbe26871089fbd3f877384dd8afea9fe' +
            '6728ce8ec45d43ed8afb2bdc15e6bc094b2f46c3a5cfb6109be23f2145070538' +
            '36faf27a1dde03ef4b31f17f24fb7e0a035f2887f7a91da21502211a1c072bd5' +
            '19330257735bc143d9ca58764db19790435ac33540f79e7798383c8329e17ac5' +
            '6261abba9ac621fe25ccc37d37c7878e4b4c28c3f3d1ac07d62e6de2f686c540'
    }
  };

  /**
   * Read a key selector. Two octets: the modulus size in units of 256 bits,
   * then the index of the key within the published file. A decimal string or a
   * number naming the modulus size selects the first key of that size.
   * @param {uint8[]|string|number} keyData - Key selector
   * @returns {string} The key name
   */
  function parseKeySelector(keyData) {
    if (typeof keyData === 'number') return findFirstOfSize(keyData);
    if (typeof keyData === 'string') {
      if (ESIGN_KEYS[keyData]) return keyData;
      return findFirstOfSize(parseInt(keyData, 10));
    }

    if (keyData && typeof keyData.length === 'number') {
      let digits = '';
      let allDigits = keyData.length > 0;
      for (let i = 0; i < keyData.length; ++i) {
        if (keyData[i] < 0x30 || keyData[i] > 0x39) { allDigits = false; break; }
        digits += String.fromCharCode(keyData[i]);
      }
      if (allDigits) return findFirstOfSize(parseInt(digits, 10));

      if (keyData.length >= 2) {
        const name = 'NESSIE-' + (keyData[0] * 256) + '-' + keyData[1];
        if (ESIGN_KEYS[name]) return name;
        throw new Error('ESIGN: no published key ' + name);
      }
    }

    throw new Error('ESIGN: unrecognised key selector');
  }

  /**
   * The first published key of a given modulus size.
   * @param {number} bits - Modulus size in bits
   * @returns {string} The key name
   */
  function findFirstOfSize(bits) {
    for (const name of Object.keys(ESIGN_KEYS)) {
      if (name.indexOf('NESSIE-' + bits + '-') === 0) return name;
    }
    throw new Error('ESIGN: no published key of ' + bits + ' bits');
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class ESIGNCipher extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "ESIGN";
      this.description = "Okamoto's signature scheme over a modulus n = p²q, in the derandomised ESIGN-D form of the NESSIE submission. A signature is a value whose e-th power modulo n begins with the message representative, which the holder of p and q solves for directly because the square of any multiple of pq vanishes modulo p²q. Signing costs one exponentiation with a small exponent and no inversion modulo n, which is what made the scheme fast enough to be proposed for smart cards.";
      this.inventor = "Tatsuaki Okamoto, Jacques Stern, Serge Vaudenay";
      this.year = 1990;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Digital Signature";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.JP;

      // The two sizes the published key material covers. The modulus is p^2*q
      // with both factors the same width, so its bit length is a multiple of
      // three. Other sizes work the moment key material of that size is supplied
      // through the publicKey/privateKey properties; no key that has not been
      // checked against an outside source belongs in this file.
      this.SupportedKeySizes = [
        new KeySize(1536, 1536, 0),
        new KeySize(3072, 3072, 0)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("NESSIE ESIGN-D specification (NTT, 2002)", "https://web.archive.org/web/2016id_/http://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/esignd-spec.pdf"),
        new LinkItem("IEEE P1363a - Additional Public-Key Techniques (ESIGN, EMSA5)", "https://grouper.ieee.org/groups/1363/P1363a/"),
        new LinkItem("Okamoto - A Fast Signature Scheme Based on Congruential Polynomial Operations", "https://ieeexplore.ieee.org/document/44624"),
        new LinkItem("RFC 8017 Appendix B.2.1 - MGF1", "https://www.rfc-editor.org/rfc/rfc8017#appendix-B.2.1")
      ];

      this.references = [
        new LinkItem("NESSIE ESIGN-D test vectors", "https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip"),
        new LinkItem("NTT MCL IEEE P1363a ESIGN/EMSA5 test vectors", "https://web.archive.org/web/20050907111319id_/http://www.nttmcl.com/sec/Esign/esign_emsa5_data_ntt.txt"),
        new LinkItem("Crypto++ ESIGN implementation and test vectors", "https://github.com/weidai11/cryptopp/blob/master/esign.cpp"),
        new LinkItem("Granboulan - How to repair ESIGN", "https://www.di.ens.fr/~granboul/recherche/publications/data/esignupdate-pub.pdf")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Broken for small exponents",
          '',
          "ESIGN with e = 3 was broken outright and the original argument for small e does not hold. The published keys here carry e = 65537; do not reduce it. The specification requires e to be at least 3*pLen/2",
          "https://www.iacr.org/archive/crypto2002/24420001/24420001.pdf"),
        new Vulnerability("Security proof withdrawn",
          '',
          "The reduction originally claimed for ESIGN was shown not to establish what it claimed, so the scheme rests on the unbroken-in-practice status of the approximate e-th root problem rather than on a proof. Prefer a scheme with a standing reduction",
          "https://eprint.iacr.org/2001/077"),
        new Vulnerability("Published demonstration keys",
          '',
          "The key pairs in this file, including their ESIGN-D seeds, are printed in the source and confer no confidentiality. Supply real key material through the publicKey/privateKey properties for any use beyond demonstration",
          "https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip")
      ];

      // Test vectors.
      //
      // Every expected value below is published: the signature is the s field of
      // the corresponding key block of the NESSIE ESIGN-D test vector file, and
      // the message is that block's M. None of it was produced by this code.
      // ESIGN-D derives r from the secret seed rather than drawing it at random,
      // so signing is deterministic and these are reproducible byte for byte
      // rather than merely verifiable.
      //
      // Signing yields signature || message, the convention the NIST signature
      // API uses for a signed message, so the expected value is the published s
      // followed by the published M. The inverse direction checks the signature
      // and returns the message, which is what the round trip grades.
      //
      // The four keys were chosen to exercise both published modulus sizes and
      // both halves of the retry loop: blocks 0 and 10 succeed on the first
      // attempt counter, blocks 4 and 12 are rejected three times each by the
      // w1 < 2^(2*pLen-1) condition and sign on the fourth.
      this.tests = [
        {
          text: "ESIGN-D 1536-bit, NESSIE test vector key block 0 (first attempt counter accepted)",
          uri: "https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0600"),
          expected: OpCodes.Hex8ToBytes(
            '2e83553dc834d60e5d7d76b7a1ddf61c243791a029bd6d528392706c58dd5e15' +
            'bccd89400311a8692e67415056b456854cbe348835af7189768f92fe65bbcaaf' +
            '91814b01d06a59e09244d36614c4a43eaae8906ff5e9bef25fe1cc17cb536106' +
            '5c38abe407d6b72dd3f0e5fbfeff7eb224d90ec2b81dddd8d3cabcf8bc3476b1' +
            '7b33e17101cc5df98614150684070905b07f69ddca7655dee2e11867631bb93f' +
            '45948e172821398352e522c1ef6a5097db442b6e4de3c17a1b67b965f983f1ea' +
            '00000000000000000000000000000000')
        },
        {
          text: "ESIGN-D 1536-bit, NESSIE test vector key block 4 (three attempt counters rejected by the w1 bound)",
          uri: "https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip",
          input: OpCodes.Hex8ToBytes("55555555555555555555555555555555"),
          key: OpCodes.Hex8ToBytes("0604"),
          expected: OpCodes.Hex8ToBytes(
            '32541abb879bc26dc5ffee0d9ad6079da1ae44b559d015ed41de51366480f55f' +
            'c74b8b94aebd4c1a0a5fd469c77a755a7e770fa306f6b2dd37e9a49374d4fc78' +
            '0d724dbbff7550de7f3eb6a38ecfef0bc7b59ed0269bdb85d63ec065aaa76d91' +
            'c0778a28333b3912153daa1f945e605216a331fddd28ce24c29a4736483f0d10' +
            'ac8a4743b1239b481fb37219f5c305fa3aac655ca4c88966b0be2253a26f70e7' +
            '904981254280fda91a3ce0a651adf5e89211e37747b5fb9e6023ab7a8b22dccb' +
            '55555555555555555555555555555555')
        },
        {
          text: "ESIGN-D 3072-bit, NESSIE test vector key block 10 (first attempt counter accepted)",
          uri: "https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip",
          input: OpCodes.Hex8ToBytes("00000000000000000000000000000000"),
          key: OpCodes.Hex8ToBytes("0C0A"),
          expected: OpCodes.Hex8ToBytes(
            '432eb5256ff762e565b578d650b0ea6c4487739916a55a9cbb0aab8676c6fa4b' +
            'c2abc3280507665df8f9c1e7138e1bf3845687468c9bf6a5f630d525a2e5e701' +
            'ea60e8974d2c74b58d3c3e8306b6856eeb4c7a2cac2f0c0c62a5df052ff6a006' +
            'aa560c4d73f71e13d55f1a0cc5b21dc1135d1b8dafa5bbae94ce9f29e0ec2555' +
            '97f06cc56912b79b45e452a0d905e6b52e37506ebbbdf405684165bfcd77b23b' +
            'ba14d5bdabb719559e8714ce259b3e66aad5b6c9f10bc1d21e4425c8a1c67b0e' +
            'dde4fefaad4546b3bdd7ea9924f1a5cffe6495e227fbbc1f5fa10bb54ac2f451' +
            '2b51248a114acb6bf37b33f760f41e9289c51422eca59fd2ad739097c3ea114e' +
            'ce93234a18f44903abc9478fe0af3ca4d975a85dfd4dd951e73fd5dc6cfb6fff' +
            'de6434eaa748457f4be781c99428e69a8dc44f9e8b06cf8d3c9f1f16359534e3' +
            '278a7beb89c637394936c2398468f925a95f2bb75871e2503fce805f8e23da3b' +
            'd820497dfa0176ec4cc7ea76cb39c2477e78bc71be48d8fca437d13451ef1ff5' +
            '00000000000000000000000000000000')
        },
        {
          text: "ESIGN-D 3072-bit, NESSIE test vector key block 12 (three attempt counters rejected by the w1 bound)",
          uri: "https://web.archive.org/web/20110812022852id_/https://www.cosic.esat.kuleuven.be/nessie/updatedPhase2Specs/esign/ESIGN-D_test_vectors.zip",
          input: OpCodes.Hex8ToBytes("ffffffffffffffffffffffffffffffff"),
          key: OpCodes.Hex8ToBytes("0C0C"),
          expected: OpCodes.Hex8ToBytes(
            '5cf1e3078f51be24433c0c991df43000d4cceb7154b7e9cadb78d343d2ed67c2' +
            '48aefe254172c270d4ba2ada0ad03387773b1deebccc931267be0deaf03d19ad' +
            '604b03c29ed85a37e99c6d8df8166d1cb606bf0e43d8c55a1d3d59f3f156193a' +
            'eb3bbdf4b0ef74e3f501cac14ebe31222e6eebd076c207c974a7e0ceecb690d0' +
            '01d40cf99aacb397c2f968de86bb5ddc4d19b04e72b1635aee7dfd4b42c8d3fc' +
            '517a7c3cbe4bcd5722efa5d182096e771ab0fce04c13ec7b76ee8102a025d779' +
            '087457dd449567d9012a5728c6bedae67b9552917957f0999b8064894d9ed63e' +
            '1c9731678fb43a8b0b81e443e3bfe6950c548f50c17a7cd4f88c6181e4983de4' +
            '9a71f08f23b515746667cf2ca063972afc03c2e859cc85d3d2838d495379da57' +
            'a9a80d61dc1abf3316c2ad251654130a1f3d089d9151556afa557bd203f74aa8' +
            '72b6136eb1d5e61c952fe0df3026398a7f2ba0ced91e36c293c7401b08836b5c' +
            'f94e7e4068f0933fda3825af706b9a931c20934f4d6bb23b0b095cb324c99f67' +
            'ffffffffffffffffffffffffffffffff')
        }
      ];
    }

    /**
     * Create a new ESIGN instance
     * @param {boolean} [isInverse=false] - True to verify, false to sign
     * @returns {Object} New instance
     */
    CreateInstance(isInverse = false) {
      return new ESIGNInstance(this, isInverse);
    }
  }

  /**
   * ESIGN instance implementing the Feed/Result pattern.
   *
   * The forward direction consumes a message and produces signature || message.
   * The inverse direction consumes that, checks the signature against the
   * message it carries, and returns the message alone. A signature that does
   * not verify is reported by throwing rather than by returning anything.
   *
   * @class
   * @extends {IAlgorithmInstance}
   */
  class ESIGNInstance extends IAlgorithmInstance {
    /**
     * @param {Object} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Verification mode flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.keySize = 1536;
      this._publicKey = null;
      this._privateKey = null;
      this.inputBuffer = [];
      this._keyData = null;
    }

    // Property setter for key (for test suite compatibility)
    set key(keyData) {
      this.KeySetup(keyData);
    }

    /**
     * Get the key selector this instance was configured with.
     * @returns {uint8[]|string|number|null} The selector, or null
     */
    get key() {
      return this._keyData;
    }

    set publicKey(keyData) {
      this._publicKey = keyData ? keyData : null;
    }

    get publicKey() {
      return this._publicKey;
    }

    set privateKey(keyData) {
      this._privateKey = keyData ? keyData : null;
    }

    get privateKey() {
      return this._privateKey;
    }

    /**
     * Feed data for processing. Appends, so that a message split across several
     * calls signs identically to the same message delivered at once.
     * @param {uint8[]|string} data - Input octets
     */
    Feed(data) {
      if (typeof data === 'string') {
        for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data.charCodeAt(i) % 256);
      } else if (data && typeof data.length === 'number') {
        for (let i = 0; i < data.length; ++i) this.inputBuffer.push(data[i]);
      } else {
        this.inputBuffer.push(data);
      }
    }

    /**
     * Produce the signed message, or recover the message from one.
     * @returns {uint8[]} signature || message when signing, message when verifying
     * @throws {Error} If no key is set or the signature does not verify
     */
    Result() {
      if (this.inputBuffer.length === 0) {
        return [];
      }

      try {
        const result = this.isInverse
          ? this._open(this.inputBuffer)
          : this._sign(this.inputBuffer);

        this.inputBuffer = [];
        return result;
      } catch (error) {
        this.inputBuffer = [];
        throw error;
      }
    }

    /**
     * Install one of the published key pairs.
     * @param {uint8[]|string|number} keyData - Key selector
     */
    KeySetup(keyData) {
      this._keyData = keyData;

      const material = ESIGN_KEYS[parseKeySelector(keyData)];
      const n = hexToBigInt(material.n);
      const e = hexToBigInt(material.e);
      this.keySize = bitCount(n);

      this._publicKey = { n: n, e: e, keySize: this.keySize };
      this._privateKey = {
        n: n,
        e: e,
        p: hexToBigInt(material.p),
        q: hexToBigInt(material.q),
        seed: OpCodes.Hex8ToBytes(material.seed),
        keySize: this.keySize
      };
    }

    /**
     * Number of octets a signature occupies. The specification fixes the
     * modulus at exactly 3*pLen bits, so this is that many octets.
     * @param {BigInt} n - Modulus
     * @returns {number} Octet length
     */
    _signatureLength(n) {
      return bitCount(n) / 8;
    }

    /**
     * EMSA-ESIGN-D-ENCODE: MGF1-SHA1 over the SHA-1 digest of the message, cut
     * to exactly pLen-1 bits.
     *
     * pLen-1 rather than pLen: the accepting interval starts at f*2^(2*pLen) and
     * ends 2^(2*pLen) later, so a wider representative can place that interval
     * past n, where no signature exists. With f below 2^(pLen-1) the interval
     * ends at or below 2^(3*pLen-1), and n exceeds 2^(3*pLen-1) by definition,
     * so every message is signable.
     *
     * @param {uint8[]} message - Message octets
     * @param {number} pLen - The prime width of the key
     * @returns {BigInt} Representative in [0, 2^(pLen-1))
     */
    _representative(message, pLen) {
      const width = pLen - 1;
      const octets = Math.ceil(width / 8);
      const mask = mgf1(digest(message), octets);

      // Clear the bits above position pLen-1 in the leading octet.
      const surplus = octets * 8 - width;
      if (surplus > 0) {
        mask[0] = OpCodes.And32(mask[0], LOW_BIT_MASK[surplus]);
      }

      return OS2IP(mask);
    }

    /**
     * Sign a message.
     * @param {uint8[]} message - Message octets
     * @returns {uint8[]} signature || message
     */
    _sign(message) {
      if (!this._privateKey) {
        throw new Error('ESIGN private key not set. Assign a key first.');
      }

      const { n, e, p, q, seed } = this._privateKey;
      const pLen = getPLen(n);
      const f = this._representative(message, pLen);

      const s = ESIGNCalculateInverse(f, e, n, p, q, seed);

      // A signer that hands out a value it has not checked is how a scheme ends
      // up with signatures nothing verifies, so the interval condition is
      // asserted here against the public function rather than assumed.
      if (ESIGNApply(s, e, n) !== f) {
        throw new Error('ESIGN: internal error, the computed signature does not verify');
      }

      const signature = I2OSP(s, this._signatureLength(n));
      const out = new Array(signature.length + message.length);
      for (let i = 0; i < signature.length; ++i) out[i] = signature[i];
      for (let i = 0; i < message.length; ++i) out[signature.length + i] = message[i];
      return out;
    }

    /**
     * Check a signed message and return the message it carries.
     * @param {uint8[]} signed - signature || message
     * @returns {uint8[]} The message octets
     * @throws {Error} When the signature does not verify
     */
    _open(signed) {
      if (!this._publicKey) {
        throw new Error('ESIGN public key not set. Assign a key first.');
      }

      const { n, e } = this._publicKey;
      const sigLen = this._signatureLength(n);

      if (signed.length < sigLen) {
        throw new Error('ESIGN: signed message is ' + signed.length
          + ' octets, shorter than the ' + sigLen + '-octet signature it must carry');
      }

      // VP-ESIGN-D step 1. Crypto++ omits this check, so a value congruent to a
      // valid signature modulo n is accepted there; the specification rejects it.
      const s = OS2IP(signed.slice(0, sigLen));
      if (s >= n) {
        throw new Error('ESIGN: signature representative is not below the modulus');
      }

      const message = signed.slice(sigLen);
      const pLen = getPLen(n);

      // VP-ESIGN-D step 4 rejects a recovered representative that is too wide,
      // rather than clamping it to the bound as Crypto++ does.
      const recovered = ESIGNApply(s, e, n);
      if (recovered >= OpCodes.ShiftLn(1n, pLen - 1)) {
        throw new Error('ESIGN: recovered representative is out of range');
      }

      if (recovered !== this._representative(message, pLen)) {
        throw new Error('ESIGN: signature does not verify');
      }

      return message;
    }

    /**
     * Sign a message, returning the signature alone.
     * @param {uint8[]|string} message - Message octets
     * @returns {uint8[]} Signature octets
     */
    Sign(message) {
      const bytes = typeof message === 'string' ? this._stringToBytes(message) : message;
      return this._sign(bytes).slice(0, this._signatureLength(this._privateKey.n));
    }

    /**
     * Verify a detached signature over a message.
     * @param {uint8[]|string} message - Message octets
     * @param {uint8[]} signature - Signature octets
     * @returns {boolean} Whether the signature verifies
     */
    Verify(message, signature) {
      const bytes = typeof message === 'string' ? this._stringToBytes(message) : message;
      const signed = new Array(signature.length + bytes.length);
      for (let i = 0; i < signature.length; ++i) signed[i] = signature[i];
      for (let i = 0; i < bytes.length; ++i) signed[signature.length + i] = bytes[i];

      try {
        this._open(signed);
        return true;
      } catch (error) {
        return false;
      }
    }

    /**
     * Octets of a string, one per code unit.
     * @param {string} text - Input
     * @returns {uint8[]} Octets
     */
    _stringToBytes(text) {
      const out = new Array(text.length);
      for (let i = 0; i < text.length; ++i) out[i] = text.charCodeAt(i) % 256;
      return out;
    }

    /**
     * Clear sensitive data.
     */
    ClearData() {
      if (this._privateKey) {
        this._privateKey.p = 0n;
        this._privateKey.q = 0n;
        if (this._privateKey.seed) OpCodes.ClearArray(this._privateKey.seed);
        this._privateKey = null;
      }
      this._publicKey = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new ESIGNCipher();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    ESIGNCipher,
    ESIGNInstance,
    ESIGNApply,
    ESIGNCalculateInverse,
    modPow,
    modInverse,
    bitCount,
    getPLen,
    mgf1,
    I2OSP,
    OS2IP
  };
}));
