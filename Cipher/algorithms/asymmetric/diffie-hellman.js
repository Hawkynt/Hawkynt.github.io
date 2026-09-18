/*
 * Diffie-Hellman Key Agreement (RFC 2631) over the published MODP groups of
 * RFC 3526 and RFC 5114, using JavaScript native BigInt
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * Both parties agree on a prime p and a generator g. Each picks a private
 * exponent x and publishes y = g^x mod p. Each then raises the value it
 * received to its own exponent; because (g^a)^b and (g^b)^a are the same group
 * element, both arrive at the same shared secret Z, which never crosses the
 * wire. There is no encryption direction and no plaintext, so CreateInstance
 * returns null for the inverse.
 *
 * What is committed as vectors is RFC 5114 Appendix A, a protocol-independent
 * subset of the NIST SP 800-56A example values. It publishes xA, yA, xB, yB and
 * Z for all three RFC 5114 MODP groups, so both directions that matter are
 * pinned to published data: the public value derived from a private exponent,
 * and the shared secret derived from a peer's public value. Party A and party B
 * are driven separately and are asserted to reach the same Z.
 *
 * The group parameters were checked before being committed. Each RFC 3526 prime
 * reproduces the closed form that RFC 3526 gives for it,
 * p = 2^n - 2^(n-64) - 1 + 2^64 * (floor(2^(n-130) pi) + offset), and equals the
 * prime OpenSSL ships for the same group. Each RFC 5114 group satisfies
 * g^q mod p = 1, and every Appendix A value round-trips through OpenSSL.
 */

// Load AlgorithmFramework (REQUIRED)

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
          Algorithm, CryptoAlgorithm, SymmetricCipherAlgorithm, AsymmetricCipherAlgorithm,
          BlockCipherAlgorithm, StreamCipherAlgorithm, EncodingAlgorithm, CompressionAlgorithm,
          ErrorCorrectionAlgorithm, HashFunctionAlgorithm, MacAlgorithm, KdfAlgorithm,
          PaddingAlgorithm, CipherModeAlgorithm, AeadAlgorithm, RandomGenerationAlgorithm,
          IAlgorithmInstance, IBlockCipherInstance, IHashFunctionInstance, IMacInstance,
          IKdfInstance, IAeadInstance, IErrorCorrectionInstance, IRandomGeneratorInstance,
          TestCase, LinkItem, Vulnerability, AuthResult, KeySize } = AlgorithmFramework;

  const H = hex => BigInt('0x' + hex);

  // ===== PUBLISHED MODP GROUPS =====
  //
  // Two families, and the difference decides how much of a received public value
  // can be validated.
  //
  // RFC 3526 groups are safe primes with generator 2. The specification gives p
  // and g but no subgroup order, so a received value can only be range-checked,
  // which is what RFC 2631 section 2.1.5 requires.
  //
  // RFC 5114 groups also publish the prime order q of the subgroup that g
  // generates. That permits the full public key validation of NIST SP 800-56A:
  // a value that is in range but outside the order-q subgroup is refused, which
  // is what stops small subgroup confinement.

  const DH_GROUPS = {

    // 1536-bit MODP group, RFC 3526 Group 5
    modp1536: {
      groupName: 'RFC 3526 Group 5',
      source: 'RFC 3526',
      bitLength: 1536,
      g: 2n,
      q: null,
      p: H(
        'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74' +
        '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437' +
        '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
        'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05' +
        '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB' +
        '9ED529077096966D670C354E4ABC9804F1746C08CA237327FFFFFFFFFFFFFFFF')
    },

    // 2048-bit MODP group, RFC 3526 Group 14
    modp2048: {
      groupName: 'RFC 3526 Group 14',
      source: 'RFC 3526',
      bitLength: 2048,
      g: 2n,
      q: null,
      p: H(
        'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74' +
        '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437' +
        '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
        'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05' +
        '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB' +
        '9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
        'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718' +
        '3995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF')
    },

    // 3072-bit MODP group, RFC 3526 Group 15
    modp3072: {
      groupName: 'RFC 3526 Group 15',
      source: 'RFC 3526',
      bitLength: 3072,
      g: 2n,
      q: null,
      p: H(
        'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74' +
        '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437' +
        '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
        'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05' +
        '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB' +
        '9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
        'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718' +
        '3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33' +
        'A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7' +
        'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864' +
        'D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E2' +
        '08E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF')
    },

    // 4096-bit MODP group, RFC 3526 Group 16
    modp4096: {
      groupName: 'RFC 3526 Group 16',
      source: 'RFC 3526',
      bitLength: 4096,
      g: 2n,
      q: null,
      p: H(
        'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74' +
        '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437' +
        '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
        'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05' +
        '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB' +
        '9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
        'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718' +
        '3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33' +
        'A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7' +
        'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864' +
        'D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E2' +
        '08E24FA074E5AB3143DB5BFCE0FD108E4B82D120A92108011A723C12A787E6D7' +
        '88719A10BDBA5B2699C327186AF4E23C1A946834B6150BDA2583E9CA2AD44CE8' +
        'DBBBC2DB04DE8EF92E8EFC141FBECAA6287C59474E6BC05D99B2964FA090C3A2' +
        '233BA186515BE7ED1F612970CEE2D7AFB81BDD762170481CD0069127D5B05AA9' +
        '93B4EA988D8FDDC186FFB7DC90A6C08F4DF435C934063199FFFFFFFFFFFFFFFF')
    },

    // 6144-bit MODP group, RFC 3526 Group 17
    modp6144: {
      groupName: 'RFC 3526 Group 17',
      source: 'RFC 3526',
      bitLength: 6144,
      g: 2n,
      q: null,
      p: H(
        'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74' +
        '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437' +
        '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
        'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05' +
        '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB' +
        '9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
        'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718' +
        '3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33' +
        'A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7' +
        'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864' +
        'D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E2' +
        '08E24FA074E5AB3143DB5BFCE0FD108E4B82D120A92108011A723C12A787E6D7' +
        '88719A10BDBA5B2699C327186AF4E23C1A946834B6150BDA2583E9CA2AD44CE8' +
        'DBBBC2DB04DE8EF92E8EFC141FBECAA6287C59474E6BC05D99B2964FA090C3A2' +
        '233BA186515BE7ED1F612970CEE2D7AFB81BDD762170481CD0069127D5B05AA9' +
        '93B4EA988D8FDDC186FFB7DC90A6C08F4DF435C93402849236C3FAB4D27C7026' +
        'C1D4DCB2602646DEC9751E763DBA37BDF8FF9406AD9E530EE5DB382F413001AE' +
        'B06A53ED9027D831179727B0865A8918DA3EDBEBCF9B14ED44CE6CBACED4BB1B' +
        'DB7F1447E6CC254B332051512BD7AF426FB8F401378CD2BF5983CA01C64B92EC' +
        'F032EA15D1721D03F482D7CE6E74FEF6D55E702F46980C82B5A84031900B1C9E' +
        '59E7C97FBEC7E8F323A97A7E36CC88BE0F1D45B7FF585AC54BD407B22B4154AA' +
        'CC8F6D7EBF48E1D814CC5ED20F8037E0A79715EEF29BE32806A1D58BB7C5DA76' +
        'F550AA3D8A1FBFF0EB19CCB1A313D55CDA56C9EC2EF29632387FE8D76E3C0468' +
        '043E8F663F4860EE12BF2D5B0B7474D6E694F91E6DCC4024FFFFFFFFFFFFFFFF')
    },

    // 8192-bit MODP group, RFC 3526 Group 18
    modp8192: {
      groupName: 'RFC 3526 Group 18',
      source: 'RFC 3526',
      bitLength: 8192,
      g: 2n,
      q: null,
      p: H(
        'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74' +
        '020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F1437' +
        '4FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED' +
        'EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05' +
        '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB' +
        '9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B' +
        'E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF695581718' +
        '3995497CEA956AE515D2261898FA051015728E5A8AAAC42DAD33170D04507A33' +
        'A85521ABDF1CBA64ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7' +
        'ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6BF12FFA06D98A0864' +
        'D87602733EC86A64521F2B18177B200CBBE117577A615D6C770988C0BAD946E2' +
        '08E24FA074E5AB3143DB5BFCE0FD108E4B82D120A92108011A723C12A787E6D7' +
        '88719A10BDBA5B2699C327186AF4E23C1A946834B6150BDA2583E9CA2AD44CE8' +
        'DBBBC2DB04DE8EF92E8EFC141FBECAA6287C59474E6BC05D99B2964FA090C3A2' +
        '233BA186515BE7ED1F612970CEE2D7AFB81BDD762170481CD0069127D5B05AA9' +
        '93B4EA988D8FDDC186FFB7DC90A6C08F4DF435C93402849236C3FAB4D27C7026' +
        'C1D4DCB2602646DEC9751E763DBA37BDF8FF9406AD9E530EE5DB382F413001AE' +
        'B06A53ED9027D831179727B0865A8918DA3EDBEBCF9B14ED44CE6CBACED4BB1B' +
        'DB7F1447E6CC254B332051512BD7AF426FB8F401378CD2BF5983CA01C64B92EC' +
        'F032EA15D1721D03F482D7CE6E74FEF6D55E702F46980C82B5A84031900B1C9E' +
        '59E7C97FBEC7E8F323A97A7E36CC88BE0F1D45B7FF585AC54BD407B22B4154AA' +
        'CC8F6D7EBF48E1D814CC5ED20F8037E0A79715EEF29BE32806A1D58BB7C5DA76' +
        'F550AA3D8A1FBFF0EB19CCB1A313D55CDA56C9EC2EF29632387FE8D76E3C0468' +
        '043E8F663F4860EE12BF2D5B0B7474D6E694F91E6DBE115974A3926F12FEE5E4' +
        '38777CB6A932DF8CD8BEC4D073B931BA3BC832B68D9DD300741FA7BF8AFC47ED' +
        '2576F6936BA424663AAB639C5AE4F5683423B4742BF1C978238F16CBE39D652D' +
        'E3FDB8BEFC848AD922222E04A4037C0713EB57A81A23F0C73473FC646CEA306B' +
        '4BCBC8862F8385DDFA9D4B7FA2C087E879683303ED5BDD3A062B3CF5B3A278A6' +
        '6D2A13F83F44F82DDF310EE074AB6A364597E899A0255DC164F31CC50846851D' +
        'F9AB48195DED7EA1B1D510BD7EE74D73FAF36BC31ECFA268359046F4EB879F92' +
        '4009438B481C6CD7889A002ED5EE382BC9190DA6FC026E479558E4475677E9AA' +
        '9E3050E2765694DFC81F56E880B96E7160C980DD98EDD3DFFFFFFFFFFFFFFFFF')
    },

    // 1024-bit MODP Group with 160-bit Prime Order Subgroup, RFC 5114 Group 22 (RFC 5114 section 2.1)
    modp1024s160: {
      groupName: 'RFC 5114 Group 22',
      source: 'RFC 5114 section 2.1',
      bitLength: 1024,
      q: H(
        'F518AA8781A8DF278ABA4E7D64B7CB9D49462353'),
      g: H(
        'A4D1CBD5C3FD34126765A442EFB99905F8104DD258AC507FD6406CFF14266D31' +
        '266FEA1E5C41564B777E690F5504F213160217B4B01B886A5E91547F9E2749F4' +
        'D7FBD7D3B9A92EE1909D0D2263F80A76A6A24C087A091F531DBF0A0169B6A28A' +
        'D662A4D18E73AFA32D779D5918D08BC8858F4DCEF97C2A24855E6EEB22B3B2E5'),
      p: H(
        'B10B8F96A080E01DDE92DE5EAE5D54EC52C99FBCFB06A3C69A6A9DCA52D23B61' +
        '6073E28675A23D189838EF1E2EE652C013ECB4AEA906112324975C3CD49B83BF' +
        'ACCBDD7D90C4BD7098488E9C219A73724EFFD6FAE5644738FAA31A4FF55BCCC0' +
        'A151AF5F0DC8B4BD45BF37DF365C1A65E68CFDA76D4DA708DF1FB2BC2E4A4371')
    },

    // 2048-bit MODP Group with 224-bit Prime Order Subgroup, RFC 5114 Group 23 (RFC 5114 section 2.2)
    modp2048s224: {
      groupName: 'RFC 5114 Group 23',
      source: 'RFC 5114 section 2.2',
      bitLength: 2048,
      q: H(
        '801C0D34C58D93FE997177101F80535A4738CEBCBF389A99B36371EB'),
      g: H(
        'AC4032EF4F2D9AE39DF30B5C8FFDAC506CDEBE7B89998CAF74866A08CFE4FFE3' +
        'A6824A4E10B9A6F0DD921F01A70C4AFAAB739D7700C29F52C57DB17C620A8652' +
        'BE5E9001A8D66AD7C17669101999024AF4D027275AC1348BB8A762D0521BC98A' +
        'E247150422EA1ED409939D54DA7460CDB5F6C6B250717CBEF180EB34118E98D1' +
        '19529A45D6F834566E3025E316A330EFBB77A86F0C1AB15B051AE3D428C8F8AC' +
        'B70A8137150B8EEB10E183EDD19963DDD9E263E4770589EF6AA21E7F5F2FF381' +
        'B539CCE3409D13CD566AFBB48D6C019181E1BCFE94B30269EDFE72FE9B6AA4BD' +
        '7B5A0F1C71CFFF4C19C418E1F6EC017981BC087F2A7065B384B890D3191F2BFA'),
      p: H(
        'AD107E1E9123A9D0D660FAA79559C51FA20D64E5683B9FD1B54B1597B61D0A75' +
        'E6FA141DF95A56DBAF9A3C407BA1DF15EB3D688A309C180E1DE6B85A1274A0A6' +
        '6D3F8152AD6AC2129037C9EDEFDA4DF8D91E8FEF55B7394B7AD5B7D0B6C12207' +
        'C9F98D11ED34DBF6C6BA0B2C8BBC27BE6A00E0A0B9C49708B3BF8A3170918836' +
        '81286130BC8985DB1602E714415D9330278273C7DE31EFDC7310F7121FD5A074' +
        '15987D9ADC0A486DCDF93ACC44328387315D75E198C641A480CD86A1B9E587E8' +
        'BE60E69CC928B2B9C52172E413042E9B23F10B0E16E79763C9B53DCF4BA80A29' +
        'E3FB73C16B8E75B97EF363E2FFA31F71CF9DE5384E71B81C0AC4DFFE0C10E64F')
    },

    // 2048-bit MODP Group with 256-bit Prime Order Subgroup, RFC 5114 Group 24 (RFC 5114 section 2.3)
    modp2048s256: {
      groupName: 'RFC 5114 Group 24',
      source: 'RFC 5114 section 2.3',
      bitLength: 2048,
      q: H(
        '8CF83642A709A097B447997640129DA299B1A47D1EB3750BA308B0FE64F5FBD3'),
      g: H(
        '3FB32C9B73134D0B2E77506660EDBD484CA7B18F21EF205407F4793A1A0BA125' +
        '10DBC15077BE463FFF4FED4AAC0BB555BE3A6C1B0C6B47B1BC3773BF7E8C6F62' +
        '901228F8C28CBB18A55AE31341000A650196F931C77A57F2DDF463E5E9EC144B' +
        '777DE62AAAB8A8628AC376D282D6ED3864E67982428EBC831D14348F6F2F9193' +
        'B5045AF2767164E1DFC967C1FB3F2E55A4BD1BFFE83B9C80D052B985D182EA0A' +
        'DB2A3B7313D3FE14C8484B1E052588B9B7D2BBD2DF016199ECD06E1557CD0915' +
        'B3353BBB64E0EC377FD028370DF92B52C7891428CDC67EB6184B523D1DB246C3' +
        '2F63078490F00EF8D647D148D47954515E2327CFEF98C582664B4C0F6CC41659'),
      p: H(
        '87A8E61DB4B6663CFFBBD19C651959998CEEF608660DD0F25D2CEED4435E3B00' +
        'E00DF8F1D61957D4FAF7DF4561B2AA3016C3D91134096FAA3BF4296D830E9A7C' +
        '209E0C6497517ABD5A8A9D306BCF67ED91F9E6725B4758C022E0B1EF4275BF7B' +
        '6C5BFC11D45F9088B941F54EB1E59BB8BC39A0BF12307F5C4FDB70C581B23F76' +
        'B63ACAE1CAA6B7902D52526735488A0EF13C6D9A51BFA4AB3AD8347796524D8E' +
        'F6A167B5A41825D967E144E5140564251CCACB83E6B486F6B3CA3F7971506026' +
        'C0B857F689962856DED4010ABD0BE621C3A3960A54E710C375F26375D7014103' +
        'A4B54330C198AF126116D2276E11715F693877FAD7EF09CADB094AE91E1A1597')
    }
  };

  // Selecting a group by modulus size alone is how RFC 3526 is usually cited,
  // so a bare bit length keeps working and resolves to the RFC 3526 group.
  const GROUP_BY_SIZE = {
    1536: 'modp1536',
    2048: 'modp2048',
    3072: 'modp3072',
    4096: 'modp4096',
    6144: 'modp6144',
    8192: 'modp8192'
  };

  /**
   * Resolve a group selector to its parameters.
   * @param {string|number} selector - Group key such as 'modp2048' or 'modp2048s256', or a modulus bit length
   * @returns {object} The group parameters
   * @throws {Error} If the selector names no known group
   */
  function resolveGroup(selector) {
    if (selector !== null && typeof selector === 'object' && selector.p !== undefined) return selector;

    if (typeof selector === 'number') {
      const bySize = GROUP_BY_SIZE[selector];
      if (bySize) return DH_GROUPS[bySize];
    }

    if (typeof selector === 'string') {
      const trimmed = selector.trim();
      if (DH_GROUPS[trimmed]) return DH_GROUPS[trimmed];
      const parsed = parseInt(trimmed, 10);
      if (!isNaN(parsed) && GROUP_BY_SIZE[parsed]) return DH_GROUPS[GROUP_BY_SIZE[parsed]];
    }

    throw new Error('Unknown Diffie-Hellman group: ' + selector
      + '. Use one of ' + Object.keys(DH_GROUPS).join(', ')
      + ', or an RFC 3526 modulus size of 1536, 2048, 3072, 4096, 6144 or 8192.');
  }

  // ===== ALGORITHM IMPLEMENTATION =====

  class DiffieHellmanKE extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      // Required metadata
      this.name = "Diffie-Hellman";
      this.description = "Key agreement over a finite field: each party publishes g^x mod p for its own "
        + "private exponent x and raises the value it receives to that same exponent, so both reach the "
        + "shared secret without transmitting it. Carries the RFC 3526 safe-prime groups and the RFC 5114 "
        + "groups, and validates a received public value by range and, where the subgroup order is "
        + "published, by checking membership of the order-q subgroup. The modular exponentiation uses "
        + "native BigInt and is not constant-time, so it leaks the private exponent to a timing observer "
        + "and is unsuitable for use against an adversary who can measure it.";
      this.inventor = "Whitfield Diffie, Martin Hellman";
      this.year = 1976;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = "Key Exchange Protocol";
      this.securityStatus = SecurityStatus.EDUCATIONAL;
      this.complexity = ComplexityType.INTERMEDIATE;
      this.country = CountryCode.US;

      // Private exponent sizes, in bytes. The RFC 5114 groups fix the exponent
      // to the width of their subgroup order (20, 28 and 32 bytes); the RFC 3526
      // groups place no upper bound below the modulus, the largest of which is
      // 8192 bits, so 1024 bytes.
      this.SupportedKeySizes = [
        new KeySize(20, 1024, 1)
      ];

      // Documentation and references
      this.documentation = [
        new LinkItem("Original DH Paper (1976)", "https://ee.stanford.edu/~hellman/publications/24.pdf"),
        new LinkItem("RFC 2631 - Diffie-Hellman Key Agreement Method", "https://www.rfc-editor.org/rfc/rfc2631"),
        new LinkItem("RFC 3526 - More MODP Groups for IKE", "https://www.rfc-editor.org/rfc/rfc3526"),
        new LinkItem("RFC 5114 - Additional Diffie-Hellman Groups (test data in Appendix A)", "https://www.rfc-editor.org/rfc/rfc5114"),
        new LinkItem("NIST SP 800-56A Rev. 3 - Key Establishment Using Discrete Logarithm Cryptography", "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Ar3.pdf"),
        new LinkItem("Wikipedia - Diffie-Hellman key exchange", "https://en.wikipedia.org/wiki/Diffie%E2%80%93Hellman_key_exchange")
      ];

      this.references = [
        new LinkItem("OpenSSL DH Implementation", "https://github.com/openssl/openssl/blob/master/crypto/dh/dh_key.c"),
        new LinkItem("Crypto++ DH Implementation", "https://github.com/weidai11/cryptopp/blob/master/dh.h"),
        new LinkItem("Python cryptography library DH", "https://github.com/pyca/cryptography/tree/main/src/cryptography/hazmat/primitives/asymmetric")
      ];

      this.knownVulnerabilities = [
        new Vulnerability("Man-in-the-Middle Attack",
          "Unauthenticated Diffie-Hellman agrees a key with whoever answers. An active attacker runs "
          + "one exchange with each side and relays between them, holding both shared secrets.",
          "Authenticate the public values, for example by signing them or by confirming the derived key",
          "https://en.wikipedia.org/wiki/Diffie%E2%80%93Hellman_key_exchange#Security"),
        new Vulnerability("Small Subgroup Confinement",
          "A public value crafted to lie in a small subgroup forces the shared secret into that same "
          + "small set, so it can be guessed and, repeated across exchanges, recovers the private exponent.",
          "Reject values outside [2, p-2] and, where the subgroup order q is published, reject any y with "
          + "y^q mod p not equal to 1. Both checks are applied here.",
          "https://www.rfc-editor.org/rfc/rfc2631"),
        new Vulnerability("Logjam",
          "Precomputation against a widely shared 512-bit or 768-bit prime amortises over every exchange "
          + "that uses it, so export-grade groups fall to a one-off effort.",
          "Use a 2048-bit group or larger; no group below 1024 bits is offered here",
          "https://weakdh.org/"),
        new Vulnerability("Non-Constant-Time Exponentiation",
          "The square-and-multiply loop in this implementation branches on the bits of the private "
          + "exponent, so its running time depends on the secret.",
          "Use a constant-time implementation such as OpenSSL's for any adversarial setting",
          "https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-56Ar3.pdf")
      ];

      // Test vectors: RFC 5114 Appendix A, which reproduces the modular
      // exponentiation examples of NIST SP 800-56A. For each group, party A and
      // party B each derive the shared secret from the other's public value and
      // are asserted to reach the same Z, and each public value is re-derived
      // from its private exponent.
      this.tests = [
        {
          text: "RFC 5114 Appendix A.1 - 1024-bit MODP Group with 160-bit Prime Order Subgroup - party A derives the shared secret Z from yB and xA",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.1",
          group: "modp1024s160",
          privateKey: OpCodes.Hex8ToBytes(
            'B9A3B3AE8FEFC1A2930496507086F8455D48943E'),
          input: OpCodes.Hex8ToBytes(
            '717A6CB053371FF4A3B932941C1E5663F861A1D6AD34AE66576DFB98F6C6CBF9' +
            'DDD5A56C7833F6BCFDFF095582AD868E440E8D09FD769E3CECCDC3D3B1E4CFA0' +
            '57776CAAF9739B6A9FEE8E7411F8D6DAC09D6A4EDB46CC2B5D5203090EAE6126' +
            '311E53FD2C14B574E6A3109A3DA1BE41BDCEAA186F5CE06716A2B6A07B3C33FE'),
          expected: OpCodes.Hex8ToBytes(
            '5C804F454D30D9C4DF85271F93528C91DF6B48AB5F80B3B59CAAC1B28F8ACBA9' +
            'CD3E39F3CB614525D9521D2E644C53B807B810F340062F257D7D6FBFE8D5E8F0' +
            '72E9B6E9AFDA9413EAFB2E8B0699B1FB5A0CACEDDEAEAD7E9CFBB36AE2B42083' +
            '5BD83A19FB0B5E96BF8FA4D09E345525167ECD9155416F46F408ED31B63C6E6D')
        },
        {
          text: "RFC 5114 Appendix A.1 - 1024-bit MODP Group with 160-bit Prime Order Subgroup - party B derives the same shared secret Z from yA and xB",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.1",
          group: "modp1024s160",
          privateKey: OpCodes.Hex8ToBytes(
            '9392C9F9EB6A7A6A9022F7D83E7223C6835BBDDA'),
          input: OpCodes.Hex8ToBytes(
            '2A853B3D92197501B9015B2DEB3ED84F5E021DCC3E52F109D3273D2B7521281C' +
            'BABE0E76FF5727FA8ACCE26956BA9A1FCA26F20228D8693FEB10841D84A73600' +
            '54ECE5A7F5B7A61AD3DFB3C60D2E43106D8727DA37DF9CCE95B478755D06BCEA' +
            '8F9D45965F75A5F3D1DF3701165FC9E50C4279CEB07F989540AE96D5D88ED776'),
          expected: OpCodes.Hex8ToBytes(
            '5C804F454D30D9C4DF85271F93528C91DF6B48AB5F80B3B59CAAC1B28F8ACBA9' +
            'CD3E39F3CB614525D9521D2E644C53B807B810F340062F257D7D6FBFE8D5E8F0' +
            '72E9B6E9AFDA9413EAFB2E8B0699B1FB5A0CACEDDEAEAD7E9CFBB36AE2B42083' +
            '5BD83A19FB0B5E96BF8FA4D09E345525167ECD9155416F46F408ED31B63C6E6D')
        },
        {
          text: "RFC 5114 Appendix A.1 - 1024-bit MODP Group with 160-bit Prime Order Subgroup - party A public value yA from private exponent xA",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.1",
          group: "modp1024s160",
          privateKey: OpCodes.Hex8ToBytes(
            'B9A3B3AE8FEFC1A2930496507086F8455D48943E'),
          input: [],
          expected: OpCodes.Hex8ToBytes(
            '2A853B3D92197501B9015B2DEB3ED84F5E021DCC3E52F109D3273D2B7521281C' +
            'BABE0E76FF5727FA8ACCE26956BA9A1FCA26F20228D8693FEB10841D84A73600' +
            '54ECE5A7F5B7A61AD3DFB3C60D2E43106D8727DA37DF9CCE95B478755D06BCEA' +
            '8F9D45965F75A5F3D1DF3701165FC9E50C4279CEB07F989540AE96D5D88ED776')
        },
        {
          text: "RFC 5114 Appendix A.1 - 1024-bit MODP Group with 160-bit Prime Order Subgroup - party B public value yB from private exponent xB",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.1",
          group: "modp1024s160",
          privateKey: OpCodes.Hex8ToBytes(
            '9392C9F9EB6A7A6A9022F7D83E7223C6835BBDDA'),
          input: [],
          expected: OpCodes.Hex8ToBytes(
            '717A6CB053371FF4A3B932941C1E5663F861A1D6AD34AE66576DFB98F6C6CBF9' +
            'DDD5A56C7833F6BCFDFF095582AD868E440E8D09FD769E3CECCDC3D3B1E4CFA0' +
            '57776CAAF9739B6A9FEE8E7411F8D6DAC09D6A4EDB46CC2B5D5203090EAE6126' +
            '311E53FD2C14B574E6A3109A3DA1BE41BDCEAA186F5CE06716A2B6A07B3C33FE')
        },
        {
          text: "RFC 5114 Appendix A.2 - 2048-bit MODP Group with 224-bit Prime Order Subgroup - party A derives the shared secret Z from yB and xA",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.2",
          group: "modp2048s224",
          privateKey: OpCodes.Hex8ToBytes(
            '22E62601DBFFD06708A680F747F361F76D8F4F721A0548E483294B0C'),
          input: OpCodes.Hex8ToBytes(
            '4DCEE992A9762A13F2F83844AD3D77EE0E31C9718B3DB6C2035D3961182C3E0B' +
            'A247EC4182D760CD48D99599970622A1881BBA2DC822939C78C3912C6661FA54' +
            '38B20766222B75E24C2E3AD0C7287236129525EE15B5DD7998AA04C4A9696CAC' +
            'D7172083A97A81664EAD2C479E444E4C0654CC19E28D7703CEE8DACD6126F5D6' +
            '65EC52C67255DB92014B037EB621A2AC8E365DE071FFC1400ACF077A12913DD8' +
            'DE89473437AB7BA346743C1B215DD9C12164A7E4053118D199BEC8EF6FC56117' +
            '0C84C87D10EE9A674A1FA8FFE13BDFBA1D44DE48946D68DC0CDD777635A7AB5B' +
            'FB1E4BB7B856F96827734C184138E915D9C3002EBCE53120546A7E2002142B6C'),
          expected: OpCodes.Hex8ToBytes(
            '34D9BDDC1B42176C313FEA034C21034D074A6313BB4ECDB3703FFF424567A46B' +
            'DF75530EDE0A9DA5229DE7D76732286CBC0F91DA4C3C852FC099C679531D94C7' +
            '8AB03D9DECB0A4E4CA8B2BB4591C4021CF8CE3A20A541D33994017D0200AE2C9' +
            '516E2FF5145779269E862B0FB474A2D56DC31ED569A7700B4C4AB16B22A45513' +
            '531EF523D71212077B5A169BDEFFAD7AD9608284C7795B6D5A5183B87066DE17' +
            'D8D671C9EBD8EC89544D45EC061593D442C62AB9CE3B1CB9943A1D23A5EA3BCF' +
            '21A01471E67E003E7F8A69C728BE490B2FC88CFEB92DB6A215E5D03C17C464C9' +
            'AC1A46E203E13F952995FB03C69D3CC47FCB510B6998FFD3AA6DE73CF9F63869')
        },
        {
          text: "RFC 5114 Appendix A.2 - 2048-bit MODP Group with 224-bit Prime Order Subgroup - party B derives the same shared secret Z from yA and xB",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.2",
          group: "modp2048s224",
          privateKey: OpCodes.Hex8ToBytes(
            '4FF3BC96C7FC6A6D71D3B363800A7CDFEF6FC41B4417EA15353B7590'),
          input: OpCodes.Hex8ToBytes(
            '1B3A63451BD886E699E67B494E288BD7F8E0D370BADDA7A0EFD2FDE7D8F66145' +
            'CC9F280419975EB808877C8A4C0C8E0BD48D4A5401EB1E8776BFEEE134C03831' +
            'AC273CD9D635AB0CE006A42A887E3F52FB8766B650F38078BC8EE8580CEFE243' +
            '968CFC4F8DC3DB084554171D41BF2E861B7BB4D69DD0E01EA387CBAA5CA672AF' +
            'CBE8BDB9D62D4CE15F17DD36F91ED1EEDD65CA4A06455CB94CD40A52EC360E84' +
            'B3C926E22C4380A3BF309D56849768B7F52CFDF655FD053A7EF706979E7E5806' +
            'B17DFAE53AD2A5BC568EBB529A7A61D68D256F8FC97C074A861D827E2EBC8C61' +
            '34553115B70E7103920AA16D85E52BCBAB8D786A68178FA8FF7C2F5C71648D6F'),
          expected: OpCodes.Hex8ToBytes(
            '34D9BDDC1B42176C313FEA034C21034D074A6313BB4ECDB3703FFF424567A46B' +
            'DF75530EDE0A9DA5229DE7D76732286CBC0F91DA4C3C852FC099C679531D94C7' +
            '8AB03D9DECB0A4E4CA8B2BB4591C4021CF8CE3A20A541D33994017D0200AE2C9' +
            '516E2FF5145779269E862B0FB474A2D56DC31ED569A7700B4C4AB16B22A45513' +
            '531EF523D71212077B5A169BDEFFAD7AD9608284C7795B6D5A5183B87066DE17' +
            'D8D671C9EBD8EC89544D45EC061593D442C62AB9CE3B1CB9943A1D23A5EA3BCF' +
            '21A01471E67E003E7F8A69C728BE490B2FC88CFEB92DB6A215E5D03C17C464C9' +
            'AC1A46E203E13F952995FB03C69D3CC47FCB510B6998FFD3AA6DE73CF9F63869')
        },
        {
          text: "RFC 5114 Appendix A.2 - 2048-bit MODP Group with 224-bit Prime Order Subgroup - party A public value yA from private exponent xA",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.2",
          group: "modp2048s224",
          privateKey: OpCodes.Hex8ToBytes(
            '22E62601DBFFD06708A680F747F361F76D8F4F721A0548E483294B0C'),
          input: [],
          expected: OpCodes.Hex8ToBytes(
            '1B3A63451BD886E699E67B494E288BD7F8E0D370BADDA7A0EFD2FDE7D8F66145' +
            'CC9F280419975EB808877C8A4C0C8E0BD48D4A5401EB1E8776BFEEE134C03831' +
            'AC273CD9D635AB0CE006A42A887E3F52FB8766B650F38078BC8EE8580CEFE243' +
            '968CFC4F8DC3DB084554171D41BF2E861B7BB4D69DD0E01EA387CBAA5CA672AF' +
            'CBE8BDB9D62D4CE15F17DD36F91ED1EEDD65CA4A06455CB94CD40A52EC360E84' +
            'B3C926E22C4380A3BF309D56849768B7F52CFDF655FD053A7EF706979E7E5806' +
            'B17DFAE53AD2A5BC568EBB529A7A61D68D256F8FC97C074A861D827E2EBC8C61' +
            '34553115B70E7103920AA16D85E52BCBAB8D786A68178FA8FF7C2F5C71648D6F')
        },
        {
          text: "RFC 5114 Appendix A.2 - 2048-bit MODP Group with 224-bit Prime Order Subgroup - party B public value yB from private exponent xB",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.2",
          group: "modp2048s224",
          privateKey: OpCodes.Hex8ToBytes(
            '4FF3BC96C7FC6A6D71D3B363800A7CDFEF6FC41B4417EA15353B7590'),
          input: [],
          expected: OpCodes.Hex8ToBytes(
            '4DCEE992A9762A13F2F83844AD3D77EE0E31C9718B3DB6C2035D3961182C3E0B' +
            'A247EC4182D760CD48D99599970622A1881BBA2DC822939C78C3912C6661FA54' +
            '38B20766222B75E24C2E3AD0C7287236129525EE15B5DD7998AA04C4A9696CAC' +
            'D7172083A97A81664EAD2C479E444E4C0654CC19E28D7703CEE8DACD6126F5D6' +
            '65EC52C67255DB92014B037EB621A2AC8E365DE071FFC1400ACF077A12913DD8' +
            'DE89473437AB7BA346743C1B215DD9C12164A7E4053118D199BEC8EF6FC56117' +
            '0C84C87D10EE9A674A1FA8FFE13BDFBA1D44DE48946D68DC0CDD777635A7AB5B' +
            'FB1E4BB7B856F96827734C184138E915D9C3002EBCE53120546A7E2002142B6C')
        },
        {
          text: "RFC 5114 Appendix A.3 - 2048-bit MODP Group with 256-bit Prime Order Subgroup - party A derives the shared secret Z from yB and xA",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.3",
          group: "modp2048s256",
          privateKey: OpCodes.Hex8ToBytes(
            '0881382CDB87660C6DC13E614938D5B9C8B2F248581CC5E31B35454397FCE50E'),
          input: OpCodes.Hex8ToBytes(
            '575F0351BD2B1B817448BDF87A6C362C1E289D3903A30B9832C5741FA250363E' +
            '7ACBC7F77F3DACBC1F131ADD8E03367EFF8FBBB3E1C5784424809B25AFE4D226' +
            '2A1A6FD2FAB64105CA30A674E07F7809852088632FC049233791AD4EDD083A97' +
            '8B883EE618BC5E0DD047415F2D95E683CF14826B5FBE10D3CE41C6C120C78AB2' +
            '0008C698BF7F0BCAB9D7F407BED0F43AFB2970F57F8D12043963E66DDD320D59' +
            '9AD9936C8F44137C08B180EC5E985CEBE186F3D549677E80607331EE17AF3380' +
            'A725B0782317D7DD43F59D7AF9568A9BB63A84D365F92244ED120988219302F4' +
            '2924C7CA90B89D24F71B0AB697823D7DEB1AFF5B0E8E4A45D49F7F53757E1913'),
          expected: OpCodes.Hex8ToBytes(
            '86C70BF8D0BB81BB01078A17219CB7D27203DB2A19C877F1D1F19FD7D77EF225' +
            '46A68F005AD52DC84553B78FC60330BE51EA7C0672CAC1515E4B35C047B9A551' +
            'B88F39DC26DA14A09EF74774D47C762DD177F9ED5BC2F11E52C879BD95098504' +
            'CD9EECD8A8F9B3EFBD1F008AC5853097D9D1837F2B18F77CD7BE01AF80A7C7B5' +
            'EA3CA54CC02D0C116FEE3F95BB87399385875D7E86747E676E728938ACBFF709' +
            '8E05BE4DCFB24052B83AEFFB14783F029ADBDE7F53FAE92084224090E007CEE9' +
            '4D4BF2BACE9FFD4B57D2AF7C724D0CAA19BF0501F6F17B4AA10F425E3EA76080' +
            'B4B9D6B3CEFEA115B2CEB8789BB8A3B0EA87FEBE63B6C8F846EC6DB0C26C5D7C')
        },
        {
          text: "RFC 5114 Appendix A.3 - 2048-bit MODP Group with 256-bit Prime Order Subgroup - party B derives the same shared secret Z from yA and xB",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.3",
          group: "modp2048s256",
          privateKey: OpCodes.Hex8ToBytes(
            '7D62A7E3EF36DE617B13D1AFB82C780D83A23BD4EE6705645121F371F546A53D'),
          input: OpCodes.Hex8ToBytes(
            '2E9380C8323AF97545BC4941DEB0EC3742C62FE0ECE824A6ABDBE66C59BEE024' +
            '2911BFB967235CEBA35AE13E4EC752BE630B92DC4BDE2847A9C62CB815274542' +
            '1FB7EB60A63C0FE9159FCCE726CE7CD8523D7450667EF840E4919121EB5F01C8' +
            'C9B0D3D648A93BFB75689E8244AC134AF544711CE79A02DCC34226684780DDDC' +
            'B498594106C37F5BC79856487AF5AB022A2E5E42F09897C1A85A11EA0212AF04' +
            'D9B4CEBC937C3C1A3E15A8A0342E337615C84E7FE3B8B9B87FB1E73A15AF12A3' +
            '0D746E06DFC34F290D797CE51AA13AA785BF6658AFF5E4B093003CBEAF665B3C' +
            '2E113A3A4E905269341DC0711426685F4EF37E868A8126FF3F2279B57CA67E29'),
          expected: OpCodes.Hex8ToBytes(
            '86C70BF8D0BB81BB01078A17219CB7D27203DB2A19C877F1D1F19FD7D77EF225' +
            '46A68F005AD52DC84553B78FC60330BE51EA7C0672CAC1515E4B35C047B9A551' +
            'B88F39DC26DA14A09EF74774D47C762DD177F9ED5BC2F11E52C879BD95098504' +
            'CD9EECD8A8F9B3EFBD1F008AC5853097D9D1837F2B18F77CD7BE01AF80A7C7B5' +
            'EA3CA54CC02D0C116FEE3F95BB87399385875D7E86747E676E728938ACBFF709' +
            '8E05BE4DCFB24052B83AEFFB14783F029ADBDE7F53FAE92084224090E007CEE9' +
            '4D4BF2BACE9FFD4B57D2AF7C724D0CAA19BF0501F6F17B4AA10F425E3EA76080' +
            'B4B9D6B3CEFEA115B2CEB8789BB8A3B0EA87FEBE63B6C8F846EC6DB0C26C5D7C')
        },
        {
          text: "RFC 5114 Appendix A.3 - 2048-bit MODP Group with 256-bit Prime Order Subgroup - party A public value yA from private exponent xA",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.3",
          group: "modp2048s256",
          privateKey: OpCodes.Hex8ToBytes(
            '0881382CDB87660C6DC13E614938D5B9C8B2F248581CC5E31B35454397FCE50E'),
          input: [],
          expected: OpCodes.Hex8ToBytes(
            '2E9380C8323AF97545BC4941DEB0EC3742C62FE0ECE824A6ABDBE66C59BEE024' +
            '2911BFB967235CEBA35AE13E4EC752BE630B92DC4BDE2847A9C62CB815274542' +
            '1FB7EB60A63C0FE9159FCCE726CE7CD8523D7450667EF840E4919121EB5F01C8' +
            'C9B0D3D648A93BFB75689E8244AC134AF544711CE79A02DCC34226684780DDDC' +
            'B498594106C37F5BC79856487AF5AB022A2E5E42F09897C1A85A11EA0212AF04' +
            'D9B4CEBC937C3C1A3E15A8A0342E337615C84E7FE3B8B9B87FB1E73A15AF12A3' +
            '0D746E06DFC34F290D797CE51AA13AA785BF6658AFF5E4B093003CBEAF665B3C' +
            '2E113A3A4E905269341DC0711426685F4EF37E868A8126FF3F2279B57CA67E29')
        },
        {
          text: "RFC 5114 Appendix A.3 - 2048-bit MODP Group with 256-bit Prime Order Subgroup - party B public value yB from private exponent xB",
          uri: "https://www.rfc-editor.org/rfc/rfc5114#appendix-A.3",
          group: "modp2048s256",
          privateKey: OpCodes.Hex8ToBytes(
            '7D62A7E3EF36DE617B13D1AFB82C780D83A23BD4EE6705645121F371F546A53D'),
          input: [],
          expected: OpCodes.Hex8ToBytes(
            '575F0351BD2B1B817448BDF87A6C362C1E289D3903A30B9832C5741FA250363E' +
            '7ACBC7F77F3DACBC1F131ADD8E03367EFF8FBBB3E1C5784424809B25AFE4D226' +
            '2A1A6FD2FAB64105CA30A674E07F7809852088632FC049233791AD4EDD083A97' +
            '8B883EE618BC5E0DD047415F2D95E683CF14826B5FBE10D3CE41C6C120C78AB2' +
            '0008C698BF7F0BCAB9D7F407BED0F43AFB2970F57F8D12043963E66DDD320D59' +
            '9AD9936C8F44137C08B180EC5E985CEBE186F3D549677E80607331EE17AF3380' +
            'A725B0782317D7DD43F59D7AF9568A9BB63A84D365F92244ED120988219302F4' +
            '2924C7CA90B89D24F71B0AB697823D7DEB1AFF5B0E8E4A45D49F7F53757E1913')
        }
      ];
    }

    /**
     * Create new algorithm instance
     * @param {boolean} [isInverse=false] - True for the inverse direction
     * @returns {Object|null} New instance, or null because key agreement has no inverse
     */
    CreateInstance(isInverse = false) {
      // Key agreement has no inverse: nothing is transmitted that could be decrypted.
      if (isInverse) {
        return null;
      }
      return new DiffieHellmanInstance(this, isInverse);
    }
  }

  /**
   * Diffie-Hellman instance implementing the Feed/Result pattern.
   *
   * Feed accepts the peer's public value; Result returns the shared secret,
   * big-endian and left-padded to the width of the modulus as RFC 2631 section
   * 2.1.2 requires. With nothing fed, Result returns this party's own public
   * value instead, so one instance covers both halves of an exchange.
   *
   * @class
   * @extends {IAlgorithmInstance}
   */
  class DiffieHellmanInstance extends IAlgorithmInstance {
    /**
     * @param {Object} algorithm - Parent algorithm instance
     * @param {boolean} [isInverse=false] - Inverse direction flag
     */
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this._group = DH_GROUPS.modp2048; // RFC 3526 Group 14, the recommended minimum
      this._privateKey = null;
      this._otherPublicKey = null;
      this.inputBuffer = [];
      this._keyData = null;
    }

    //#region ===== configuration =====

    set group(selector) {
      this._group = resolveGroup(selector);
    }

    get group() {
      return this._group;
    }

    // RFC 3526 is normally cited by modulus size, so that spelling works too.
    set groupSize(bits) {
      this._group = resolveGroup(bits);
    }

    get groupSize() {
      return this._group.bitLength;
    }

    /**
     * Set the private exponent.
     * @param {uint8[]|BigInt|number|null} value - Private exponent, big-endian bytes or a BigInt
     */
    set privateKey(value) {
      if (value === null || value === undefined) {
        this._privateKey = null;
        this._keyData = null;
        return;
      }
      this._privateKey = this._toBigInt(value, 'private exponent');
      this._keyData = Array.isArray(value) ? value.slice() : null;
    }

    get privateKey() {
      return this._privateKey;
    }

    // The framework and the UI both drive a 'key' property, which for a key
    // agreement is the private exponent.
    set key(value) {
      this.privateKey = value;
    }

    get key() {
      return this._keyData;
    }

    /**
     * Set the peer's public value, as an alternative to feeding it.
     * @param {uint8[]|BigInt|null} value - Peer public value
     */
    set otherPublicKey(value) {
      if (value === null || value === undefined) {
        this._otherPublicKey = null;
        return;
      }
      this._otherPublicKey = this._toBigInt(value, 'public value');
    }

    get otherPublicKey() {
      return this._otherPublicKey;
    }

    /**
     * This party's public value, big-endian and padded to the modulus width.
     * @returns {uint8[]} Public value bytes
     */
    get publicKey() {
      return this._bigIntToBytes(this._computePublicValue(), this._modulusBytes());
    }

    //#endregion

    //#region ===== key agreement =====

    /**
     * Generate a key pair. With no argument a private exponent is drawn from a
     * cryptographically secure source, by rejection sampling so the draw stays
     * uniform over its range.
     * @param {uint8[]|BigInt|null} [privateValue=null] - Private exponent to use, or null to generate one
     * @returns {{privateKey: BigInt, publicKey: BigInt}} The generated pair
     */
    GenerateKeyPair(privateValue = null) {
      this._privateKey = privateValue === null
        ? this._randomPrivateExponent()
        : this._toBigInt(privateValue, 'private exponent');
      this._keyData = null;
      return { privateKey: this._privateKey, publicKey: this._computePublicValue() };
    }

    /**
     * Derive the shared secret from the peer's public value.
     * @param {uint8[]|BigInt} otherPublicValue - The peer's public value
     * @returns {BigInt} The shared secret Z
     * @throws {Error} If no private exponent is set or the public value fails validation
     */
    ComputeSharedSecret(otherPublicValue) {
      if (this._privateKey === null) {
        throw new Error('Diffie-Hellman private exponent not set. Assign privateKey or call GenerateKeyPair() first.');
      }
      const peer = this._toBigInt(otherPublicValue, 'public value');
      this._validatePublicValue(peer);
      return this._modPow(peer, this._privateKey, this._group.p);
    }

    /**
     * Reject a peer public value that cannot be a legitimate one.
     * @param {BigInt} y - Candidate public value
     * @throws {Error} If the value is out of range or outside the order-q subgroup
     */
    _validatePublicValue(y) {
      const group = this._group;

      // RFC 2631 section 2.1.5: 1 and p-1 generate subgroups of order 1 and 2,
      // and anything outside [2, p-2] is not a usable public value.
      if (y < 2n || y > group.p - 2n) {
        throw new Error('Diffie-Hellman public value outside the valid range [2, p-2]');
      }

      // NIST SP 800-56A full public key validation, available only where the
      // specification publishes the subgroup order.
      if (group.q !== null && this._modPow(y, group.q, group.p) !== 1n) {
        throw new Error('Diffie-Hellman public value is not in the order-q subgroup: '
          + 'rejected to prevent small subgroup confinement');
      }
    }

    /**
     * This party's public value g^x mod p.
     * @returns {BigInt} The public value
     * @throws {Error} If no private exponent is set
     */
    _computePublicValue() {
      if (this._privateKey === null) {
        throw new Error('Diffie-Hellman private exponent not set. Assign privateKey or call GenerateKeyPair() first.');
      }
      return this._modPow(this._group.g, this._privateKey, this._group.p);
    }

    //#endregion

    //#region ===== arithmetic =====

    /**
     * Modular exponentiation by square and multiply.
     * @param {BigInt} base - Base
     * @param {BigInt} exponent - Exponent, must not be negative
     * @param {BigInt} modulus - Modulus
     * @returns {BigInt} base raised to exponent, modulo modulus
     */
    _modPow(base, exponent, modulus) {
      if (modulus === 1n) return 0n;
      if (exponent < 0n) throw new Error('Diffie-Hellman exponent must not be negative');

      let result = 1n;
      let value = base % modulus;
      if (value < 0n) value += modulus;
      let remaining = exponent;

      while (remaining > 0n) {
        if (remaining % 2n === 1n) result = (result * value) % modulus;
        remaining = OpCodes.ShiftRn(remaining, 1);
        value = (value * value) % modulus;
      }

      return result;
    }

    /**
     * Width of the current modulus in bytes.
     * @returns {number} Byte count
     */
    _modulusBytes() {
      return Math.ceil(this._group.bitLength / 8);
    }

    /**
     * Accept a private exponent or public value in any of the forms callers use.
     * @param {uint8[]|Uint8Array|BigInt|number|string} value - The value
     * @param {string} what - Name used in error messages
     * @returns {BigInt} The value as a BigInt
     */
    _toBigInt(value, what) {
      if (typeof value === 'bigint') return value;
      if (typeof value === 'number') {
        if (!Number.isInteger(value) || value < 0) {
          throw new Error('Diffie-Hellman ' + what + ' must be a non-negative integer');
        }
        return BigInt(value);
      }
      if (Array.isArray(value) || (value && typeof value.length === 'number' && typeof value !== 'string')) {
        return this._bytesToBigInt(value);
      }
      throw new Error('Invalid Diffie-Hellman ' + what + ' format: expected big-endian bytes or a BigInt');
    }

    /**
     * Big-endian bytes to BigInt.
     * @param {uint8[]} bytes - Big-endian byte sequence
     * @returns {BigInt} The value
     */
    _bytesToBigInt(bytes) {
      let value = 0n;
      for (let i = 0; i < bytes.length; i++) {
        const octet = bytes[i];
        if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
          throw new Error('Diffie-Hellman input must be a sequence of bytes in 0..255');
        }
        value = value * 256n + BigInt(octet);
      }
      return value;
    }

    /**
     * BigInt to big-endian bytes, left-padded to a fixed width.
     * @param {BigInt} value - The value
     * @param {number} length - Required byte count
     * @returns {uint8[]} Big-endian bytes
     */
    _bigIntToBytes(value, length) {
      if (value < 0n) throw new Error('Diffie-Hellman value must not be negative');

      const bytes = new Array(length);
      let remaining = value;
      for (let i = length - 1; i >= 0; i--) {
        bytes[i] = Number(remaining % 256n);
        remaining = remaining / 256n;
      }

      if (remaining !== 0n) {
        throw new Error('Diffie-Hellman value does not fit in ' + length + ' bytes');
      }
      return bytes;
    }

    /**
     * Draw a private exponent uniformly from [2, upper], rejecting candidates
     * above the range rather than folding them into it.
     * @returns {BigInt} A fresh private exponent
     */
    _randomPrivateExponent() {
      const group = this._group;
      // SP 800-56A: the exponent lives in the subgroup order where one is
      // published, and otherwise below the modulus.
      const upper = (group.q === null ? group.p : group.q) - 2n;
      let digits = upper.toString(16).length;
      if (digits % 2 === 1) digits += 1;
      const width = digits / 2;

      for (let attempt = 0; attempt < 1000; attempt++) {
        const candidate = this._bytesToBigInt(this._randomBytes(width));
        if (candidate >= 2n && candidate <= upper) return candidate;
      }
      throw new Error('Diffie-Hellman private exponent generation failed to find a value in range');
    }

    /**
     * Cryptographically secure random bytes.
     * @param {number} count - Number of bytes
     * @returns {uint8[]} Random bytes
     * @throws {Error} If no secure source is available
     */
    _randomBytes(count) {
      const out = new Array(count);

      const host = (typeof globalThis !== 'undefined') ? globalThis : null;
      const webCrypto = host ? host.crypto : null;
      if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
        const buffer = new Uint8Array(count);
        webCrypto.getRandomValues(buffer);
        for (let i = 0; i < count; i++) out[i] = buffer[i];
        return out;
      }

      if (typeof require === 'function') {
        const buffer = require('crypto').randomBytes(count);
        for (let i = 0; i < count; i++) out[i] = buffer[i];
        return out;
      }

      throw new Error('No cryptographically secure random source available for Diffie-Hellman key generation');
    }

    //#endregion

    //#region ===== Feed/Result =====

    /**
     * Feed the peer's public value. Successive calls extend it, so Feed(a) then
     * Feed(b) is the same as Feed(a || b).
     * @param {uint8[]} data - Peer public value bytes
     */
    Feed(data) {
      if (!data || data.length === 0) return;

      if (typeof data === 'string') {
        throw new Error('Diffie-Hellman expects the peer public value as bytes, not text');
      }
      if (typeof data === 'number') {
        this.inputBuffer.push(data);
        return;
      }
      for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
    }

    /**
     * Derive the shared secret from whatever was fed, or this party's own public
     * value when nothing was.
     * @returns {uint8[]} Shared secret or public value, big-endian, padded to the modulus width
     * @throws {Error} If no private exponent is set or the peer value fails validation
     */
    Result() {
      const width = this._modulusBytes();

      let peer = null;
      if (this.inputBuffer.length > 0) {
        peer = this._bytesToBigInt(this.inputBuffer);
      } else if (this._otherPublicKey !== null) {
        peer = this._otherPublicKey;
      }
      this.inputBuffer = [];

      if (peer === null) {
        return this._bigIntToBytes(this._computePublicValue(), width);
      }

      return this._bigIntToBytes(this.ComputeSharedSecret(peer), width);
    }

    //#endregion

    /**
     * Clear the private exponent and the derived state.
     */
    ClearData() {
      this._privateKey = null;
      this._otherPublicKey = null;
      if (this._keyData) OpCodes.ClearArray(this._keyData);
      this._keyData = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  // ===== REGISTRATION =====

  const algorithmInstance = new DiffieHellmanKE();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return { DiffieHellmanKE, DiffieHellmanInstance, DH_GROUPS };
}));
