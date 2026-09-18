/*
 * SIKE Implementation
 * Supersingular Isogeny Key Encapsulation - the NIST PQC round 3 KEM
 * Compatible with AlgorithmFramework
 * (c)2006-2025 Hawkynt
 *
 * SIKE is a key encapsulation mechanism built from supersingular isogeny
 * Diffie-Hellman over GF(p^2), where p = 2^eA * 3^eB - 1. A public key is the
 * image of a fixed basis under a secret isogeny, and the shared secret is the
 * j-invariant of the curve both parties reach. This file implements the four
 * uncompressed parameter sets of the round 3 submission:
 *
 *   SIKEp434  p = 2^216*3^137-1  pk 330   sk 374   ct 346   ss 16
 *   SIKEp503  p = 2^250*3^159-1  pk 378   sk 434   ct 402   ss 24
 *   SIKEp610  p = 2^305*3^192-1  pk 462   sk 524   ct 486   ss 24
 *   SIKEp751  p = 2^372*3^239-1  pk 564   sk 644   ct 596   ss 32
 *
 * SIKE IS CRYPTOGRAPHICALLY BROKEN AND MUST NOT BE USED. Castryck and Decru
 * published a key-recovery attack in 2022 (eprint 2022/975) that reconstructs
 * the secret isogeny from the torsion-point images in the public key; a
 * SIKEp434 key falls in about an hour on one core, and the later refinements
 * take minutes. The submission was withdrawn. What is here is a correct
 * implementation of a dead scheme, kept because the isogeny arithmetic is
 * worth reading and because the attack is only meaningful against the real
 * construction.
 *
 * Verified against the submission's own Known Answer Tests, PQCkemKAT_374.rsp,
 * PQCkemKAT_434.rsp, PQCkemKAT_524.rsp and PQCkemKAT_644.rsp from SIKE-Round3:
 * all 100 records of each file agree on the public key, the secret key, the
 * ciphertext, the encapsulated shared secret and the decapsulated shared
 * secret - 400 records and 2000 field comparisons in total. Those records are
 * keyed by a 48 byte seed driving the NIST KAT AES-256 CTR_DRBG; the vectors
 * committed below name the drawn randomness directly so that they can be
 * driven without one.
 *
 * The compressed parameter sets (SIKEp434_compressed and friends) are not
 * implemented. They share the isogeny arithmetic but add a torsion-basis
 * decomposition and an entropy-coded public key, none of which is approximated
 * by the code here.
 *
 * The isogeny formulas follow the round 3 specification. The submission's own
 * implementations - the Microsoft/InfoSec Global SIKE library, MIT licensed,
 * Copyright (c) 2016-2017 Microsoft Corporation and Copyright (c) 2017
 * InfoSec Global, Reza Azarderakhsh, Matthew Campagna, Luca De Feo, Amir
 * Jalali, David Jao, Brian Koziel, Joost Renes and David Urbanik - were used
 * as the reference for those formulas and for the base-curve constants.
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

  const { RegisterAlgorithm, CategoryType, SecurityStatus, ComplexityType, CountryCode,
          AsymmetricCipherAlgorithm, IAlgorithmInstance, LinkItem, KeySize,
          Vulnerability } = AlgorithmFramework;

  //#region ===== SHAKE256 =====
  //
  // Every symmetric primitive in SIKE - the function G that derives the
  // ephemeral secret, the function F that masks the message and the function H
  // that derives the shared secret - is SHAKE256 and nothing else. The
  // collection's FIPS 202 module already agrees with the published digests, so
  // it is reused rather than duplicated.

  let shakeAlgorithm = null;

  /**
   * SHAKE256 with an arbitrary output length.
   *
   * The dependency is resolved on first use rather than while this file loads,
   * and that is deliberate. Both the README generator and the browser
   * script-tag checker attribute an algorithm to whichever source file was
   * being loaded when it registered, so a top-level require of the SHAKE module
   * would file SHAKE128 and SHAKE256 under this directory and drop them from
   * the hash index.
   *
   * @param {number[]} data - input bytes
   * @param {number} outputLength - number of bytes wanted
   * @returns {number[]} the squeezed bytes
   */
  function shake256(data, outputLength) {
    if (!shakeAlgorithm) {
      shakeAlgorithm = AlgorithmFramework.Find ? AlgorithmFramework.Find('SHAKE256') : null;

      if (!shakeAlgorithm && typeof require !== 'undefined') {
        try {
          require('../hash/shake.js');
        } catch (e) {
          // reported as a missing dependency below
        }
        shakeAlgorithm = AlgorithmFramework.Find ? AlgorithmFramework.Find('SHAKE256') : null;
      }

      if (!shakeAlgorithm) throw new Error('SHAKE256 is required by SIKE and was not found');
    }

    const instance = shakeAlgorithm.CreateInstance();
    instance.outputSize = outputLength;
    instance.Feed(data);
    return Array.from(instance.Result());
  }

  //#endregion

  //#region ===== PARAMETER SETS =====

  // Base curve for every set is the Montgomery curve y^2 = x^3 + 6x^2 + x over
  // GF(p^2), and the six generator x-coordinates below are its distinguished
  // torsion bases: for each party the two basis points and the x-coordinate of
  // their difference, which is what the three-point ladder needs. GF(p^2) is
  // GF(p)[i]/(i^2+1), and a value is written {real, imaginary}.

  const RAW_PARAMETERS = {
    SIKEp434: {
      eA: 216, eB: 137, msgBytes: 16, sharedSecretBytes: 16,
      p: '2341F271773446CFC5FD681C520567BC65C783158AEA3FDC1767AE2FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      XPA0: '3CCFC5E1F050030363E6920A0F7A4C6C71E63DE63A0E6475AF621995705F7C84500CB2BB61E950E19EAB8661D25C4A50ED279646CB48',
      XPA1: '1AD1C1CAE7840EDDA6D8A924520F60E573D3B9DFAC6D189941CB22326D284A8816CC4249410FE80D68047D823C97D705246F869E3EA50',
      XQA0: 'C7461738340EFCF09CE388F666EB38F7F3AFD42DC0B664D9F461F31AA2EDC6B4AB71BD42F4D7C058E13F64B237EF7DDD2ABC0DEB0C6C',
      XQA1: '25DE37157F50D75D320DD0682AB4A67E471586FBC2D31AA32E6957FA2B2614C4CD40A1E27283EAAF4272AE517847197432E2D61C85F5',
      XRA0: 'F37AB34BA0CEAD94F43CDC50DE06AD19C67CE4928346E829CB92580DA84D7C36506A2516696BBE3AEB523AD7172A6D239513C5FD2516',
      XRA1: '196CA2ED06A657E90A73543F3902C208F410895B49CF84CD89BE9ED6E4EE7E8DF90B05F3FDB8BDFE489D1B3558E987013F9806036C5AC',
      XPB0: '8664865EA7D816F03B31E223C26D406A2C6CD0C3D667466056AAE85895EC37368BFC009DFAFCB3D97E639F65E9E45F46573B0637B7A9',
      XPB1: '0',
      XQB0: '12E84D7652558E694BF84C1FBDAAF99B83B4266C32EC65B10457BCAF94C63EB063681E8B1E7398C0B241C19B9665FDB9E1406DA3D3846',
      XQB1: '0',
      XRB0: '1CD28597256D4FFE7E002E87870752A8F8A64A1CC78B5A2122074783F51B4FDE90E89C48ED91A8F4A0CCBACBFA7F51A89CE518A52B76C',
      XRB1: '147073290D78DD0CC8420B1188187D1A49DBFA24F26AAD46B2D9BB547DBB6F63A760ECB0C2B20BE52FB77BD2776C3D14BCBC404736AE4'
    },
    SIKEp503: {
      eA: 250, eB: 159, msgBytes: 24, sharedSecretBytes: 24,
      p: '4066F541811E1E6045C6BDDA77A4D01B9BF6C87B7E7DAF13085BDA2211E7A0ABFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      XPA0: '2ED31A03825FA14BC1D92C503C061D843223E611A92D7C5FBEC0F2C915EE7EEE73374DF6A1161EA00CDCB786155E21FD38220C3772CE670BC68274B851678',
      XPA1: '1EE4E4E9448FBBAB4B5BAEF280A99B7BF86A1CE05D55BD603C3BA9D7C08FD8DE7968B49A78851FFBC6D0A17CB2FA1B57F3BABEF87720DD9A489B5581F915D2',
      XQA0: '325CF6A8E2C6183A8B9932198039A7F965BA8587B67925D08D809DBF9A69DE1B621F7F134FA2DAB82FF5A2615F92CC71419FFFAAF86A290D604AB167616461',
      XQA1: '3E7B0494C8E60A8B72308AE09ED34845B34EA0911E356B77A11872CF7FEEFF745D98D0624097BC1AD7CD2ADF7FFC2C1AA5BA3C6684B964FA555A0715E57DB1',
      XRA0: '3D24CF1F347F1DA54C1696442E6AFC192CEE5E320905E0EAB3C9D3FB595CA26C154F39427A0416A9F36337354CF1E6E5AEDD73DF80C710026D49550AC8CE9F',
      XRA1: '6869EA28E4CEE05DCEE8B08ACD59775D03DAA0DC8B094C85156C212C23C72CB2AB2D2D90D46375AA6D66E58E44F8F219431D3006FDED7993F51649C029498',
      XPB0: '32D03FD1E99ED0CB05C0707AF74617CBEA5AC6B75905B4B54B1B0C2D73697840155E7B1005EFB02B5D02797A8B66A5D258C76A3C9EF745CECE11E9A178BADF',
      XPB1: '0',
      XQB0: '39014A74763076675D24CF3FA28318DAC75BCB04E54ADDC6494693F72EBB7DA7DC6A3BBCD188DAD5BECE9D6BB4ABDD05DB38C5FBE52D985DCAF74422C24D53',
      XQB1: '0',
      XRB0: 'C1465FD048FFB8BF2158ED57F0CFFF0C4D5A4397C7542D722567700FDBB8B2825CAB4B725764F5F528294B7F95C17D560E25660AD3D07AB011D95B2CB522',
      XRB1: '288165466888BE1E78DB339034E2B8C7BDF0483BFA7AB943DFA05B2D1712317916690F5E713740E7C7D4838296E67357DC34E3460A95C330D5169721981758'
    },
    SIKEp610: {
      eA: 305, eB: 192, msgBytes: 24, sharedSecretBytes: 24,
      p: '27BF6A768819010C251E7D88CB255B2FA10C4252A9AE7BF45048FF9ABB1784DE8AA5AB02E6E01FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      XPA0: '1B368BC6019B46CD802129209B3E65B98BC64A92BC4DB2F9F3AC96B97A1B9C124DF549B528F18BEECB1666D27D47530435E84221272F3A97FB80527D8F8A359F8F1598D365744CA3070A5F26C',
      XPA1: '1459685DCA7112D1F6030DBC98F2C9CBB41617B6AD913E6523416CCBD8ED9C7841D97DF83092B9B3F2AF00D62E08DAD8FA743CBCCCC1782BE0186A3432D3C97C37CA16873BEDE01F0637C1AA2',
      XQA0: '25DA39EC90CDFB9BC0F772CDA52CB8B5A9F478D7AF8DBBA0AEB3E52432822DD88C38F4E3AEC0746E56149F1FE89707C77F8BA4134568629724F4A8E34B06BFE5C5E66E0867EC38B283798B8A',
      XQA1: '2250E1959256AE502428338CB4715399551AEC78D8935B2DC73FCDCFBDB1A0118A2D3EF03489BA6F637B1C7FEE7E5F31340A1A537B76B5B736B4CDD284918918E8C986FC02741FB8C98F0A0ED',
      XRA0: '1B36A006D05F9E370D5078CCA54A16845B2BFF737C865368707C0DBBE9F5A62A9B9C79ADF11932A9FA4806210E25C92DB019CC146706DFBC7FA2638ECC4343C1E390426FAA7F2F07FDA163FB5',
      XRA1: '183C9ABF2297CA69699357F58FED92553436BBEBA2C3600D89522E7009D19EA5D6C18CFF993AA3AA33923ED93592B0637ED0B33ADF12388AE912BC4AE4749E2DF3C3292994DCF37747518A992',
      XPB0: '1587822E647707ED4313D3BE6A811A694FB201561111838A0816BFB5DEC625D23772DE48A26D78C04EEB26CA4A571C67CE4DC4C620282876B2F2FC2633CA548C3AB0C45CC991417A56F7FEFEB',
      XPB1: '0',
      XQB0: '14E647CB19B7EAAAC640A9C26B9C26DB7DEDA8FC9399F4F8CE620D2B2200480F4338755AE16D0E090F15EA1882166836A478C6E161C938E4EB8C2DD779B45FFDD17DCDF158AF48DE126B3A047',
      XQB1: '0',
      XRB0: '1DB73BC2DE666D24E59AF5E23B79251BA0D189629EF87E56C38778A448FACE312D08EDFB876C3FD45ECF3746D96E2CADBBA08B1A206C47DDD93137059E34C90E2E42E10F30F6E5F52DED74222',
      XRB1: '1B2C30180DAF5D91871555CE8EFEC76A4D521F877B754311228C7180A3E2318B4E7A00341FF99F34E35BF7A1053CA76FD77C0AFAE38E2091862AB4F1DD4C8D9C83DE37ACBA6646EDB4C238B48'
    },
    SIKEp751: {
      eA: 372, eB: 239, msgBytes: 32, sharedSecretBytes: 32,
      p: '6FE5D541F71C0E12909F97BADC668562B5045CB25748084E9867D6EBE876DA959B1A13F7CC76E3EC968549F878A8EEAFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      XPA0: '4514F8CC94B140F24874F8B87281FA6004CA5B3637C68AC0C0BDB29838051F385FBBCC300BBB24BFBBF6710D7DC8B29ACB81E429BD1BD5629AD0ECAD7C90622F6BB801D0337EE6BC78A7F12FDCB09DECFAE8BFD643C89C3BAC1D87F8B6FA',
      XPA1: '158ABF500B5914B3A96CED5FDB37D6DD925F2D6E4F7FEA3CC16E1085754077737EA6F8CC74938D971DA289DCF2435BCAC1897D2627693F9BB167DC01BE34AC494C60B8A0F65A28D7A31EA0D54640653A8099CE5A84E4F0168D818AF02041',
      XQA0: '1723D2BFA01A78BF4E39E3A333F8A7E0B415A17F208D3419E7591D59D8ABDB7EE6D2B2DFCB21AC29A40F837983C0F057FD041AD93237704F1597D87F074F682961A38B5489D1019924F8A0EF5E4F1B2E64A7BA536E219F5090F76276290E',
      XQA1: '2569D7EAFB6C60B244EF49E05B5E23F73C4F44169A7E02405E90CEB680CB0756054AC0E3DCE95E2950334262CC973235C2F87D89500BCD465B078BD0DEBDF322A2F86AEDFDCFEE65C09377EFBA0C5384DD837BEDB710209FBC8DDB8C35C7',
      XRA0: '6066E07F3C0D964E8BC963519FAC8397DF477AEA9A067F3BE343BC53C883AF29CCF008E5A30719A29357A8C33EB3600CD078AF1C40ED5792763A4D213EBDE44CC623195C387E0201E7231C529A15AF5AB743EE9E7C9C37AF3051167525BB',
      XRA1: '50E30C2C06494249BC4A144EB5F31212BD05A2AF0CB3064C322FC3604FC5F5FE3A08FB3A02B05A48557E15C992254FFC8910B72B8E1328B4893CDCFBFC003878881CE390D909E39F83C5006E0AE979587775443483D13C65B107FADA5165',
      XPB0: '605D4697A245C394B98024A5554746DC12FF56D0C6F15D2F48123B6D9C498EEE98E8F7CD6E216E2F1FF7CE0C969CCA29CAA2FAA57174EF985AC0A504260018760E9FDF67467E20C13982FF5B49B8BEAB05F6023AF873F827400E453432FE',
      XPB1: '0',
      XQB0: '5BF9544781803CBD7E0EA8B96D934C5CBCA970F9CC327A0A7E4DAD931EC29BAA8A854B8A9FDE5409AF96C5426FA375D99C68E9AE714172D7F04502D45307FA4839F39A28338BBAFD54A461A535408367D5132E6AA0D3DA6973360F8CD0F1',
      XQB1: '0',
      XRB0: '55E5124A05D4809585F67FE9EA1F02A06CD411F38588BB631BF789C3F98D1C3325843BB53D9B011D8BD1F682C0E4D8A5E723364364E40DAD1B7A476716AC7D1BA705CCDD680BFD4FE4739CC21A9A59ED544B82566BF633E8950186A79FE3',
      XRB1: '5AC57EAFD6CC7569E8B53A148721953262C5B404C143380ADCC184B6C21F0CAFE095B7E9C79CA88791F9A72F1B2F3121829B2622515B694A16875ED637F421B539E66F2FEF1CE8DCEFC8AEA608055E9C44077266AB64611BF851BA06C821'
    }
  };

  /** Number of bytes needed to hold `bits` bits. */
  function bytesForBits(bits) {
    return Math.floor((bits + 7) / 8);
  }

  /**
   * Fill in everything the specification leaves implicit for one parameter set.
   * @param {string} name - the set name
   * @returns {object} the derived parameter set
   */
  function deriveParameters(name) {
    const raw = RAW_PARAMETERS[name];
    const P = {
      name: name,
      eA: raw.eA,
      eB: raw.eB,
      msgBytes: raw.msgBytes,
      sharedSecretBytes: raw.sharedSecretBytes,
      p: BigInt('0x' + raw.p)
    };

    P.fieldBits = P.p.toString(2).length;
    P.fieldBytes = bytesForBits(P.fieldBits);
    P.fp2Bytes = 2 * P.fieldBytes;
    P.publicKeyBytes = 3 * P.fp2Bytes;
    P.ciphertextBytes = P.publicKeyBytes + P.msgBytes;

    // Alice's secret is drawn from [0, 2^eA); Bob's from [0, 2^(ceil(log2 3^eB) - 1)).
    P.aliceBits = P.eA;
    P.bobOrderBits = (3n ** BigInt(P.eB)).toString(2).length;
    P.bobBits = P.bobOrderBits - 1;
    P.secretABytes = bytesForBits(P.aliceBits);
    P.secretBBytes = bytesForBits(P.bobBits);
    // The last drawn byte is masked rather than reduced, which is what the
    // submission does and therefore what the published vectors assume.
    P.maskA = Math.pow(2, P.aliceBits - 8 * (P.secretABytes - 1)) - 1;
    P.maskB = Math.pow(2, P.bobBits - 8 * (P.secretBBytes - 1)) - 1;
    P.privateKeyBytes = P.msgBytes + P.secretBBytes + P.publicKeyBytes;

    const fp2 = (re, im) => [BigInt('0x' + raw[re]) % P.p, BigInt('0x' + raw[im]) % P.p];
    P.XPA = fp2('XPA0', 'XPA1');
    P.XQA = fp2('XQA0', 'XQA1');
    P.XRA = fp2('XRA0', 'XRA1');
    P.XPB = fp2('XPB0', 'XPB1');
    P.XQB = fp2('XQB0', 'XQB1');
    P.XRB = fp2('XRB0', 'XRB1');

    return P;
  }

  const PARAMETER_SETS = {};
  for (const name of Object.keys(RAW_PARAMETERS)) PARAMETER_SETS[name] = deriveParameters(name);

  /**
   * Look up a parameter set by name, tolerating the spellings people use.
   * @param {string|number} label - a set name, or just the prime size
   * @returns {object|null} the parameter set
   */
  function findParameterSet(label) {
    const text = String(label).trim();
    if (PARAMETER_SETS[text]) return PARAMETER_SETS[text];

    const digits = text.replace(/[^0-9]/g, '');
    if (digits && PARAMETER_SETS['SIKEp' + digits]) return PARAMETER_SETS['SIKEp' + digits];
    return null;
  }

  /**
   * Look up a parameter set by the encoded length of one of its objects.
   * @param {number} length - the byte length seen
   * @param {string} field - which size to match
   * @returns {object|null} the parameter set
   */
  function parameterSetByLength(length, field) {
    for (const name of Object.keys(PARAMETER_SETS)) {
      if (PARAMETER_SETS[name][field] === length) return PARAMETER_SETS[name];
    }
    return null;
  }

  //#endregion

  //#region ===== GF(p) AND GF(p^2) =====
  //
  // Field elements are BigInt values reduced into [0, p), and a GF(p^2)
  // element is the pair [real, imaginary] over GF(p)[i]/(i^2+1). The
  // submission's own implementations carry everything in Montgomery form to
  // keep the reduction cheap in fixed-width limbs; that is an optimisation of
  // the same arithmetic and the encoded results are identical, so plain
  // reduction is used here.

  const ZERO = 0n;
  const ONE = 1n;

  /** a + b in GF(p). */
  function fpAdd(a, b, p) {
    const s = a + b;
    return s >= p ? s - p : s;
  }

  /** a - b in GF(p). */
  function fpSub(a, b, p) {
    const d = a - b;
    return d < ZERO ? d + p : d;
  }

  /** a * b in GF(p). */
  function fpMul(a, b, p) {
    return (a * b) % p;
  }

  /**
   * 1/a in GF(p) by the extended Euclidean algorithm.
   * @param {bigint} a - the value to invert
   * @param {bigint} p - the prime
   * @returns {bigint} the inverse
   */
  function fpInverse(a, p) {
    if (a === ZERO) throw new Error('SIKE: division by zero in GF(p)');

    let oldR = a;
    let r = p;
    let oldS = ONE;
    let s = ZERO;

    while (r !== ZERO) {
      const q = oldR / r;
      const nextR = oldR - q * r;
      oldR = r;
      r = nextR;
      const nextS = oldS - q * s;
      oldS = s;
      s = nextS;
    }

    return oldS < ZERO ? oldS + p : oldS;
  }

  /** a + b in GF(p^2). */
  function fp2Add(a, b, p) {
    return [fpAdd(a[0], b[0], p), fpAdd(a[1], b[1], p)];
  }

  /** a - b in GF(p^2). */
  function fp2Sub(a, b, p) {
    return [fpSub(a[0], b[0], p), fpSub(a[1], b[1], p)];
  }

  /** -a in GF(p^2). */
  function fp2Negate(a, p) {
    return [a[0] === ZERO ? ZERO : p - a[0], a[1] === ZERO ? ZERO : p - a[1]];
  }

  /** a * b in GF(p^2), with i^2 = -1. */
  function fp2Mul(a, b, p) {
    const r0 = a[0] * b[0];
    const r1 = a[1] * b[1];
    const c0 = (r0 - r1) % p;
    const c1 = (a[0] * b[1] + a[1] * b[0]) % p;
    return [c0 < ZERO ? c0 + p : c0, c1];
  }

  /** a^2 in GF(p^2). */
  function fp2Square(a, p) {
    const sum = fpAdd(a[0], a[1], p);
    const diff = fpSub(a[0], a[1], p);
    return [(sum * diff) % p, (2n * a[0] * a[1]) % p];
  }

  /** 1/a in GF(p^2). */
  function fp2Inverse(a, p) {
    const norm = fpAdd((a[0] * a[0]) % p, (a[1] * a[1]) % p, p);
    const inv = fpInverse(norm, p);
    return [(a[0] * inv) % p, a[1] === ZERO ? ZERO : (p - a[1]) * inv % p];
  }

  /** a / 2 in GF(p^2). */
  function fp2Half(a, p, halfOfOne) {
    return fp2Mul(a, halfOfOne, p);
  }

  /** Are the two GF(p^2) elements equal? */
  function fp2Equal(a, b) {
    return a[0] === b[0] && a[1] === b[1];
  }

  /** The GF(p^2) constant `value` + 0i. */
  function fp2FromInt(value, p) {
    const v = BigInt(value) % p;
    return [v < ZERO ? v + p : v, ZERO];
  }

  //#endregion

  //#region ===== ENCODING =====

  /**
   * Encode one GF(p) element as `length` little-endian bytes.
   * @param {bigint} value - the element
   * @param {number} length - the field byte length
   * @returns {number[]} the bytes
   */
  function fpEncode(value, length) {
    const out = new Array(length);
    let v = value;
    for (let i = 0; i < length; i++) {
      out[i] = Number(OpCodes.AndN(v, 0xFFn));
      v = OpCodes.ShiftRn(v, 8);
    }
    return out;
  }

  /**
   * Decode `length` little-endian bytes into a GF(p) element.
   * @param {number[]} bytes - the source
   * @param {number} offset - where to start
   * @param {number} length - the field byte length
   * @returns {bigint} the element
   */
  function fpDecode(bytes, offset, length) {
    let v = ZERO;
    for (let i = length - 1; i >= 0; i--) {
      v = OpCodes.OrN(OpCodes.ShiftLn(v, 8), BigInt(OpCodes.And8(bytes[offset + i], 0xFF)));
    }
    return v;
  }

  /** Encode one GF(p^2) element as real || imaginary. */
  function fp2Encode(value, P, out, offset) {
    const re = fpEncode(value[0], P.fieldBytes);
    const im = fpEncode(value[1], P.fieldBytes);
    for (let i = 0; i < P.fieldBytes; i++) {
      out[offset + i] = re[i];
      out[offset + P.fieldBytes + i] = im[i];
    }
  }

  /** Decode one GF(p^2) element written as real || imaginary. */
  function fp2Decode(bytes, offset, P) {
    return [fpDecode(bytes, offset, P.fieldBytes),
            fpDecode(bytes, offset + P.fieldBytes, P.fieldBytes)];
  }

  //#endregion

  //#region ===== MONTGOMERY CURVE ARITHMETIC =====
  //
  // Points are projective x-only pairs (X:Z) and the curve coefficient is
  // carried projectively too, as (A+2C : 4C) for the 2-power side and
  // (A+2C : A-2C) for the 3-power side. Working projectively is what lets a
  // whole isogeny chain run with a single inversion at the end.

  /**
   * Double an x-only point.
   * @param {object} Q - the point { X, Z }
   * @param {number[][]} A24plus - (A+2C)
   * @param {number[][]} C24 - 4C
   * @param {object} P - parameter set
   * @returns {object} 2Q
   */
  function xDBL(Q, A24plus, C24, P) {
    const p = P.p;
    let t0 = fp2Sub(Q.X, Q.Z, p);
    let t1 = fp2Add(Q.X, Q.Z, p);
    t0 = fp2Square(t0, p);
    t1 = fp2Square(t1, p);
    let Z = fp2Mul(C24, t0, p);
    const X = fp2Mul(t1, Z, p);
    t1 = fp2Sub(t1, t0, p);
    t0 = fp2Mul(A24plus, t1, p);
    Z = fp2Add(Z, t0, p);
    Z = fp2Mul(Z, t1, p);
    return { X: X, Z: Z };
  }

  /** [2^e]Q. */
  function xDBLe(Q, A24plus, C24, e, P) {
    let R = Q;
    for (let i = 0; i < e; i++) R = xDBL(R, A24plus, C24, P);
    return R;
  }

  /**
   * The 2-isogeny with kernel the order-2 point S, as a projective (A+2C : 4C).
   * @param {object} S - the kernel point
   * @param {object} P - parameter set
   * @returns {object} { A24plus, C24 }
   */
  function get2Isogeny(S, P) {
    const p = P.p;
    const A = fp2Square(S.X, p);
    const C = fp2Square(S.Z, p);
    return { A24plus: fp2Sub(C, A, p), C24: C };
  }

  /** Push a point through the 2-isogeny with kernel S. */
  function eval2Isogeny(Q, S, P) {
    const p = P.p;
    const t0 = fp2Add(S.X, S.Z, p);
    const t1 = fp2Sub(S.X, S.Z, p);
    const t2 = fp2Add(Q.X, Q.Z, p);
    const t3 = fp2Sub(Q.X, Q.Z, p);
    const u0 = fp2Mul(t0, t3, p);
    const u1 = fp2Mul(t1, t2, p);
    return {
      X: fp2Mul(Q.X, fp2Add(u0, u1, p), p),
      Z: fp2Mul(Q.Z, fp2Sub(u0, u1, p), p)
    };
  }

  /**
   * The 4-isogeny with kernel generated by the order-4 point S.
   * @param {object} S - the kernel point
   * @param {object} P - parameter set
   * @returns {object} { A24plus, C24, coeff }
   */
  function get4Isogeny(S, P) {
    const p = P.p;
    const c1 = fp2Sub(S.X, S.Z, p);
    const c2 = fp2Add(S.X, S.Z, p);
    let c0 = fp2Square(S.Z, p);
    c0 = fp2Add(c0, c0, p);
    const C24 = fp2Square(c0, p);
    c0 = fp2Add(c0, c0, p);
    let A24plus = fp2Square(S.X, p);
    A24plus = fp2Add(A24plus, A24plus, p);
    A24plus = fp2Square(A24plus, p);
    return { A24plus: A24plus, C24: C24, coeff: [c0, c1, c2] };
  }

  /** Push a point through a 4-isogeny. */
  function eval4Isogeny(Q, coeff, P) {
    const p = P.p;
    let t0 = fp2Add(Q.X, Q.Z, p);
    let t1 = fp2Sub(Q.X, Q.Z, p);
    let X = fp2Mul(t0, coeff[1], p);
    let Z = fp2Mul(t1, coeff[2], p);
    t0 = fp2Mul(t0, t1, p);
    t0 = fp2Mul(coeff[0], t0, p);
    t1 = fp2Add(X, Z, p);
    Z = fp2Sub(X, Z, p);
    t1 = fp2Square(t1, p);
    Z = fp2Square(Z, p);
    X = fp2Add(t1, t0, p);
    t0 = fp2Sub(Z, t0, p);
    return { X: fp2Mul(X, t1, p), Z: fp2Mul(Z, t0, p) };
  }

  /**
   * Triple an x-only point.
   * @param {object} Q - the point
   * @param {number[][]} A24minus - (A-2C)
   * @param {number[][]} A24plus - (A+2C)
   * @param {object} P - parameter set
   * @returns {object} 3Q
   */
  function xTPL(Q, A24minus, A24plus, P) {
    const p = P.p;
    let t0 = fp2Sub(Q.X, Q.Z, p);
    const t2 = fp2Square(t0, p);
    let t1 = fp2Add(Q.X, Q.Z, p);
    const t3 = fp2Square(t1, p);
    const t4 = fp2Add(Q.X, Q.X, p);
    t0 = fp2Add(Q.Z, Q.Z, p);
    t1 = fp2Square(t4, p);
    t1 = fp2Sub(t1, t3, p);
    t1 = fp2Sub(t1, t2, p);
    const t5 = fp2Mul(A24plus, t3, p);
    let u3 = fp2Mul(t3, t5, p);
    const t6 = fp2Mul(A24minus, t2, p);
    let u2 = fp2Mul(t2, t6, p);
    u3 = fp2Sub(u2, u3, p);
    u2 = fp2Sub(t5, t6, p);
    t1 = fp2Mul(t1, u2, p);
    let w = fp2Add(u3, t1, p);
    w = fp2Square(w, p);
    const X = fp2Mul(t4, w, p);
    let v = fp2Sub(u3, t1, p);
    v = fp2Square(v, p);
    return { X: X, Z: fp2Mul(t0, v, p) };
  }

  /** [3^e]Q. */
  function xTPLe(Q, A24minus, A24plus, e, P) {
    let R = Q;
    for (let i = 0; i < e; i++) R = xTPL(R, A24minus, A24plus, P);
    return R;
  }

  /**
   * The 3-isogeny with kernel generated by the order-3 point S.
   * @param {object} S - the kernel point
   * @param {object} P - parameter set
   * @returns {object} { A24minus, A24plus, coeff }
   */
  function get3Isogeny(S, P) {
    const p = P.p;
    const c0 = fp2Sub(S.X, S.Z, p);
    const t0 = fp2Square(c0, p);
    const c1 = fp2Add(S.X, S.Z, p);
    const t1 = fp2Square(c1, p);
    let t3 = fp2Add(S.X, S.X, p);
    t3 = fp2Square(t3, p);
    const t2 = fp2Sub(t3, t0, p);
    t3 = fp2Sub(t3, t1, p);
    let t4 = fp2Add(t0, t3, p);
    t4 = fp2Add(t4, t4, p);
    t4 = fp2Add(t1, t4, p);
    const A24minus = fp2Mul(t2, t4, p);
    let t5 = fp2Add(t1, t2, p);
    t5 = fp2Add(t5, t5, p);
    t5 = fp2Add(t0, t5, p);
    const A24plus = fp2Mul(t3, t5, p);
    return { A24minus: A24minus, A24plus: A24plus, coeff: [c0, c1] };
  }

  /** Push a point through a 3-isogeny. */
  function eval3Isogeny(Q, coeff, P) {
    const p = P.p;
    let t0 = fp2Add(Q.X, Q.Z, p);
    let t1 = fp2Sub(Q.X, Q.Z, p);
    t0 = fp2Mul(coeff[0], t0, p);
    t1 = fp2Mul(coeff[1], t1, p);
    let t2 = fp2Add(t0, t1, p);
    t0 = fp2Sub(t1, t0, p);
    t2 = fp2Square(t2, p);
    t0 = fp2Square(t0, p);
    return { X: fp2Mul(Q.X, t2, p), Z: fp2Mul(Q.Z, t0, p) };
  }

  /**
   * Recover the affine curve coefficient A from three x-coordinates, where
   * xR is the x-coordinate of the difference of the points behind xP and xQ.
   * @param {number[][]} xP - first x-coordinate
   * @param {number[][]} xQ - second x-coordinate
   * @param {number[][]} xR - the difference's x-coordinate
   * @param {object} P - parameter set
   * @returns {number[][]} A
   */
  function getA(xP, xQ, xR, P) {
    const p = P.p;
    const one = fp2FromInt(1, p);
    let t1 = fp2Add(xP, xQ, p);
    let t0 = fp2Mul(xP, xQ, p);
    let A = fp2Mul(xR, t1, p);
    A = fp2Add(t0, A, p);
    t0 = fp2Mul(t0, xR, p);
    A = fp2Sub(A, one, p);
    t0 = fp2Add(t0, t0, p);
    t1 = fp2Add(t1, xR, p);
    t0 = fp2Add(t0, t0, p);
    A = fp2Square(A, p);
    t0 = fp2Inverse(t0, p);
    A = fp2Mul(A, t0, p);
    return fp2Sub(A, t1, p);
  }

  /**
   * The j-invariant of the Montgomery curve with projective coefficient A/C.
   * @param {number[][]} A - the numerator
   * @param {number[][]} C - the denominator
   * @param {object} P - parameter set
   * @returns {number[][]} j
   */
  function jInvariant(A, C, P) {
    const p = P.p;
    let j = fp2Square(A, p);
    let t1 = fp2Square(C, p);
    let t0 = fp2Add(t1, t1, p);
    t0 = fp2Sub(j, t0, p);
    t0 = fp2Sub(t0, t1, p);
    j = fp2Sub(t0, t1, p);
    t1 = fp2Square(t1, p);
    j = fp2Mul(j, t1, p);
    t0 = fp2Add(t0, t0, p);
    t0 = fp2Add(t0, t0, p);
    t1 = fp2Square(t0, p);
    t0 = fp2Mul(t0, t1, p);
    t0 = fp2Add(t0, t0, p);
    t0 = fp2Add(t0, t0, p);
    j = fp2Inverse(j, p);
    return fp2Mul(j, t0, p);
  }

  /**
   * Simultaneous doubling and differential addition.
   * @param {object} Q0 - the point to double
   * @param {object} Q1 - the point to add
   * @param {number[][]} xPQ - the affine difference x-coordinate
   * @param {number[][]} A24 - (A+2)/4
   * @param {object} P - parameter set
   * @returns {object} { doubled, sum }
   */
  function xDBLADD(Q0, Q1, xPQ, A24, P) {
    const p = P.p;
    let t0 = fp2Add(Q0.X, Q0.Z, p);
    let t1 = fp2Sub(Q0.X, Q0.Z, p);
    let X0 = fp2Square(t0, p);
    let t2 = fp2Sub(Q1.X, Q1.Z, p);
    let X1 = fp2Add(Q1.X, Q1.Z, p);
    t0 = fp2Mul(t0, t2, p);
    let Z0 = fp2Square(t1, p);
    t1 = fp2Mul(t1, X1, p);
    t2 = fp2Sub(X0, Z0, p);
    X0 = fp2Mul(X0, Z0, p);
    X1 = fp2Mul(A24, t2, p);
    let Z1 = fp2Sub(t0, t1, p);
    Z0 = fp2Add(X1, Z0, p);
    X1 = fp2Add(t0, t1, p);
    Z0 = fp2Mul(Z0, t2, p);
    Z1 = fp2Square(Z1, p);
    X1 = fp2Square(X1, p);
    Z1 = fp2Mul(Z1, xPQ, p);
    return { doubled: { X: X0, Z: Z0 }, sum: { X: X1, Z: Z1 } };
  }

  /**
   * The three-point ladder: given x(P), x(Q) and x(P-Q), return x(P + mQ).
   * @param {number[][]} xP - x(P)
   * @param {number[][]} xQ - x(Q)
   * @param {number[][]} xPQ - x(P-Q)
   * @param {bigint} m - the scalar
   * @param {number} nbits - how many bits of m to consume
   * @param {number[][]} A - the affine curve coefficient
   * @param {object} P - parameter set
   * @returns {object} the projective x-only point x(P + mQ)
   */
  function ladder3pt(xP, xQ, xPQ, m, nbits, A, P) {
    const p = P.p;
    const one = fp2FromInt(1, p);
    const halfOfOne = [fpInverse(2n, p), ZERO];

    let A24 = fp2Add(one, one, p);
    A24 = fp2Add(A, A24, p);
    A24 = fp2Half(A24, p, halfOfOne);
    A24 = fp2Half(A24, p, halfOfOne);

    let R0 = { X: xQ, Z: one };
    let R2 = { X: xPQ, Z: one };
    let R = { X: xP, Z: one };

    let previousBit = 0;
    for (let i = 0; i < nbits; i++) {
      const bit = Number(OpCodes.AndN(OpCodes.ShiftRn(m, i), ONE));
      if (bit !== previousBit) {
        const swap = R;
        R = R2;
        R2 = swap;
      }
      previousBit = bit;

      const step = xDBLADD(R0, R2, R.X, A24, P);
      R0 = step.doubled;
      R2 = { X: fp2Mul(step.sum.X, R.Z, p), Z: step.sum.Z };
    }

    return previousBit !== 0 ? R2 : R;
  }

  //#endregion

  //#region ===== ISOGENY CHAINS =====
  //
  // An isogeny of degree l^n is walked as a binary tree rather than as a flat
  // loop: halving the remaining length at each step costs O(n log n) point
  // operations instead of O(n^2). Every split gives the same isogeny, so the
  // shape of the tree is a matter of speed alone.

  /**
   * Walk the 2-power chain: a degree-4^n isogeny with kernel generated by S,
   * pushing `points` through it.
   * @param {object} state - { A24plus, C24 }, updated in place
   * @param {object} S - the kernel generator
   * @param {object[]} points - points to push through
   * @param {number} n - the number of 4-isogeny steps
   * @param {object} P - parameter set
   */
  function chain4(state, S, points, n, P) {
    if (n <= 0) return;

    if (n === 1) {
      const iso = get4Isogeny(S, P);
      state.A24plus = iso.A24plus;
      state.C24 = iso.C24;
      for (let i = 0; i < points.length; i++) points[i] = eval4Isogeny(points[i], iso.coeff, P);
      return;
    }

    const m = Math.max(1, Math.floor(n / 2));
    const T = xDBLe(S, state.A24plus, state.C24, 2 * (n - m), P);

    const carried = points.slice();
    carried.push(S);
    chain4(state, T, carried, m, P);

    const pushed = carried[carried.length - 1];
    for (let i = 0; i < points.length; i++) points[i] = carried[i];
    chain4(state, pushed, points, n - m, P);
  }

  /**
   * Walk the 3-power chain: a degree-3^n isogeny with kernel generated by S.
   * @param {object} state - { A24minus, A24plus }, updated in place
   * @param {object} S - the kernel generator
   * @param {object[]} points - points to push through
   * @param {number} n - the number of 3-isogeny steps
   * @param {object} P - parameter set
   */
  function chain3(state, S, points, n, P) {
    if (n <= 0) return;

    if (n === 1) {
      const iso = get3Isogeny(S, P);
      state.A24minus = iso.A24minus;
      state.A24plus = iso.A24plus;
      for (let i = 0; i < points.length; i++) points[i] = eval3Isogeny(points[i], iso.coeff, P);
      return;
    }

    const m = Math.floor(n / 2);
    const T = xTPLe(S, state.A24minus, state.A24plus, n - m, P);

    const carried = points.slice();
    carried.push(S);
    chain3(state, T, carried, m, P);

    const pushed = carried[carried.length - 1];
    for (let i = 0; i < points.length; i++) points[i] = carried[i];
    chain3(state, pushed, points, n - m, P);
  }

  /** Invert three GF(p^2) values with one field inversion. */
  function invert3(z1, z2, z3, P) {
    const p = P.p;
    const t0 = fp2Mul(z1, z2, p);
    const t1 = fp2Inverse(fp2Mul(z3, t0, p), p);
    const t2 = fp2Mul(z3, t1, p);
    return [fp2Mul(t2, z2, p), fp2Mul(t2, z1, p), fp2Mul(t0, t1, p)];
  }

  //#endregion

  //#region ===== SIDH =====

  /**
   * Alice's public key: the image of Bob's basis under her secret 2-power
   * isogeny.
   * @param {bigint} secret - Alice's private scalar
   * @param {object} P - parameter set
   * @returns {number[]} the encoded public key
   */
  function ephemeralKeyGenerationA(secret, P) {
    const p = P.p;
    const one = fp2FromInt(1, p);
    const A = fp2FromInt(6, p);
    const state = { A24plus: fp2FromInt(8, p), C24: fp2FromInt(4, p) };

    let R = ladder3pt(P.XPA, P.XQA, P.XRA, secret, P.aliceBits, A, P);
    const points = [
      { X: P.XPB, Z: one },
      { X: P.XQB, Z: one },
      { X: P.XRB, Z: one }
    ];

    if (P.eA % 2 === 1) {
      const S = xDBLe(R, state.A24plus, state.C24, P.eA - 1, P);
      const iso = get2Isogeny(S, P);
      state.A24plus = iso.A24plus;
      state.C24 = iso.C24;
      for (let i = 0; i < points.length; i++) points[i] = eval2Isogeny(points[i], S, P);
      R = eval2Isogeny(R, S, P);
    }

    chain4(state, R, points, Math.floor(P.eA / 2), P);

    return normalizeThree(points, P);
  }

  /**
   * Bob's public key: the image of Alice's basis under his secret 3-power
   * isogeny.
   * @param {bigint} secret - Bob's private scalar
   * @param {object} P - parameter set
   * @returns {number[]} the encoded public key
   */
  function ephemeralKeyGenerationB(secret, P) {
    const p = P.p;
    const one = fp2FromInt(1, p);
    const A = fp2FromInt(6, p);
    const state = { A24plus: fp2FromInt(8, p), A24minus: fp2FromInt(4, p) };

    const R = ladder3pt(P.XPB, P.XQB, P.XRB, secret, P.bobBits, A, P);
    const points = [
      { X: P.XPA, Z: one },
      { X: P.XQA, Z: one },
      { X: P.XRA, Z: one }
    ];

    chain3(state, R, points, P.eB, P);

    return normalizeThree(points, P);
  }

  /** Normalise three projective x-coordinates and encode them. */
  function normalizeThree(points, P) {
    const inverses = invert3(points[0].Z, points[1].Z, points[2].Z, P);
    const out = new Array(P.publicKeyBytes);
    for (let i = 0; i < 3; i++) {
      fp2Encode(fp2Mul(points[i].X, inverses[i], P.p), P, out, i * P.fp2Bytes);
    }
    return out;
  }

  /**
   * Alice's shared secret: the j-invariant of the curve she reaches from Bob's
   * public key.
   * @param {bigint} secret - Alice's private scalar
   * @param {number[]} publicKeyB - Bob's encoded public key
   * @param {object} P - parameter set
   * @returns {number[]} the encoded j-invariant
   */
  function ephemeralSecretAgreementA(secret, publicKeyB, P) {
    const p = P.p;
    const pk = [
      fp2Decode(publicKeyB, 0, P),
      fp2Decode(publicKeyB, P.fp2Bytes, P),
      fp2Decode(publicKeyB, 2 * P.fp2Bytes, P)
    ];

    const A = getA(pk[0], pk[1], pk[2], P);
    const two = fp2FromInt(2, p);
    const state = { A24plus: fp2Add(A, two, p), C24: fp2FromInt(4, p) };

    let R = ladder3pt(pk[0], pk[1], pk[2], secret, P.aliceBits, A, P);

    if (P.eA % 2 === 1) {
      const S = xDBLe(R, state.A24plus, state.C24, P.eA - 1, P);
      const iso = get2Isogeny(S, P);
      state.A24plus = iso.A24plus;
      state.C24 = iso.C24;
      R = eval2Isogeny(R, S, P);
    }

    chain4(state, R, [], Math.floor(P.eA / 2), P);

    let A24plus = fp2Add(state.A24plus, state.A24plus, p);
    A24plus = fp2Sub(A24plus, state.C24, p);
    A24plus = fp2Add(A24plus, A24plus, p);

    const out = new Array(P.fp2Bytes);
    fp2Encode(jInvariant(A24plus, state.C24, P), P, out, 0);
    return out;
  }

  /**
   * Bob's shared secret: the j-invariant of the curve he reaches from Alice's
   * public key.
   * @param {bigint} secret - Bob's private scalar
   * @param {number[]} publicKeyA - Alice's encoded public key
   * @param {object} P - parameter set
   * @returns {number[]} the encoded j-invariant
   */
  function ephemeralSecretAgreementB(secret, publicKeyA, P) {
    const p = P.p;
    const pk = [
      fp2Decode(publicKeyA, 0, P),
      fp2Decode(publicKeyA, P.fp2Bytes, P),
      fp2Decode(publicKeyA, 2 * P.fp2Bytes, P)
    ];

    const A = getA(pk[0], pk[1], pk[2], P);
    const two = fp2FromInt(2, p);
    const state = { A24plus: fp2Add(A, two, p), A24minus: fp2Sub(A, two, p) };

    const R = ladder3pt(pk[0], pk[1], pk[2], secret, P.bobBits, A, P);

    chain3(state, R, [], P.eB, P);

    let numerator = fp2Add(state.A24plus, state.A24minus, p);
    numerator = fp2Add(numerator, numerator, p);
    const denominator = fp2Sub(state.A24plus, state.A24minus, p);

    const out = new Array(P.fp2Bytes);
    fp2Encode(jInvariant(numerator, denominator, P), P, out, 0);
    return out;
  }

  //#endregion

  //#region ===== KEY ENCAPSULATION =====

  /**
   * Turn the drawn secret-key bytes into the scalar the submission uses. The
   * top byte is masked rather than reduced modulo the subgroup order, which is
   * what the reference does and therefore what the published vectors assume.
   * @param {number[]} bytes - the drawn bytes
   * @param {number} mask - the mask for the last byte
   * @returns {bigint} the scalar
   */
  function scalarFromBytes(bytes, mask) {
    const masked = bytes.slice();
    masked[masked.length - 1] = OpCodes.And8(masked[masked.length - 1], mask);
    return fpDecode(masked, 0, masked.length);
  }

  /**
   * Build a key pair from the randomness the submission draws for it.
   * @param {number[]} randomness - msgBytes of rejection material followed by
   *   secretBBytes of raw secret key
   * @param {object} P - parameter set
   * @returns {object} { publicKey, secretKey }
   */
  function kemKeypair(randomness, P) {
    const needed = P.msgBytes + P.secretBBytes;
    if (randomness.length !== needed)
      throw new Error('SIKE ' + P.name + ' key generation needs ' + needed + ' random bytes, got ' + randomness.length);

    const s = randomness.slice(0, P.msgBytes);
    const rawSecret = randomness.slice(P.msgBytes);
    rawSecret[rawSecret.length - 1] = OpCodes.And8(rawSecret[rawSecret.length - 1], P.maskB);

    const publicKey = ephemeralKeyGenerationB(scalarFromBytes(rawSecret, P.maskB), P);

    const secretKey = s.slice();
    for (let i = 0; i < rawSecret.length; i++) secretKey.push(rawSecret[i]);
    for (let i = 0; i < publicKey.length; i++) secretKey.push(publicKey[i]);

    return { publicKey: publicKey, secretKey: secretKey };
  }

  /**
   * Encapsulate to a public key.
   * @param {number[]} publicKey - the recipient's public key
   * @param {number[]} message - msgBytes of randomness
   * @param {object} P - parameter set
   * @returns {object} { ciphertext, sharedSecret }
   */
  function kemEncapsulate(publicKey, message, P) {
    if (publicKey.length !== P.publicKeyBytes)
      throw new Error('A SIKE ' + P.name + ' public key is ' + P.publicKeyBytes + ' bytes, got ' + publicKey.length);
    if (message.length !== P.msgBytes)
      throw new Error('SIKE ' + P.name + ' encapsulation needs ' + P.msgBytes + ' random bytes, got ' + message.length);

    const seed = message.slice();
    for (let i = 0; i < publicKey.length; i++) seed.push(publicKey[i]);

    const ephemeral = shake256(seed, P.secretABytes);
    ephemeral[ephemeral.length - 1] = OpCodes.And8(ephemeral[ephemeral.length - 1], P.maskA);
    const secretA = scalarFromBytes(ephemeral, P.maskA);

    const ciphertext = ephemeralKeyGenerationA(secretA, P);
    const jInvariantBytes = ephemeralSecretAgreementA(secretA, publicKey, P);
    const mask = shake256(jInvariantBytes, P.msgBytes);
    for (let i = 0; i < P.msgBytes; i++) ciphertext.push(OpCodes.Xor8(message[i], mask[i]));

    const secretInput = message.slice();
    for (let i = 0; i < ciphertext.length; i++) secretInput.push(ciphertext[i]);

    return { ciphertext: ciphertext, sharedSecret: shake256(secretInput, P.sharedSecretBytes) };
  }

  /**
   * Decapsulate a ciphertext.
   *
   * A ciphertext that was not produced by encapsulation yields a secret derived
   * from the rejection value stored in the secret key rather than an error, so
   * that the decapsulating party reveals nothing about why it failed.
   *
   * @param {number[]} ciphertext - the ciphertext
   * @param {number[]} secretKey - the secret key
   * @param {object} P - parameter set
   * @returns {number[]} the shared secret
   */
  function kemDecapsulate(ciphertext, secretKey, P) {
    if (secretKey.length !== P.privateKeyBytes)
      throw new Error('A SIKE ' + P.name + ' secret key is ' + P.privateKeyBytes + ' bytes, got ' + secretKey.length);
    if (ciphertext.length !== P.ciphertextBytes)
      throw new Error('A SIKE ' + P.name + ' ciphertext is ' + P.ciphertextBytes + ' bytes, got ' + ciphertext.length);

    const s = secretKey.slice(0, P.msgBytes);
    const rawSecret = secretKey.slice(P.msgBytes, P.msgBytes + P.secretBBytes);
    const publicKey = secretKey.slice(P.msgBytes + P.secretBBytes);
    const c0 = ciphertext.slice(0, P.publicKeyBytes);

    const jInvariantBytes = ephemeralSecretAgreementB(scalarFromBytes(rawSecret, P.maskB), c0, P);
    const mask = shake256(jInvariantBytes, P.msgBytes);

    const message = new Array(P.msgBytes);
    for (let i = 0; i < P.msgBytes; i++)
      message[i] = OpCodes.Xor8(ciphertext[P.publicKeyBytes + i], mask[i]);

    const seed = message.slice();
    for (let i = 0; i < publicKey.length; i++) seed.push(publicKey[i]);

    const ephemeral = shake256(seed, P.secretABytes);
    ephemeral[ephemeral.length - 1] = OpCodes.And8(ephemeral[ephemeral.length - 1], P.maskA);

    const recomputed = ephemeralKeyGenerationA(scalarFromBytes(ephemeral, P.maskA), P);
    const genuine = OpCodes.SecureCompare(recomputed, c0);

    const secretInput = (genuine ? message : s).slice();
    for (let i = 0; i < ciphertext.length; i++) secretInput.push(ciphertext[i]);

    return shake256(secretInput, P.sharedSecretBytes);
  }

  //#endregion

  //#region ===== TEST VECTORS =====
  //
  // Every expected value below is taken verbatim from the SIKE submission's own
  // Known Answer Tests, record 0 (and record 1 where a second key is needed) of
  // PQCkemKAT_374.rsp, PQCkemKAT_434.rsp, PQCkemKAT_524.rsp and
  // PQCkemKAT_644.rsp in SIKE-Round3. Nothing here was produced by this file.
  //
  // Those records are keyed by a 48 byte seed driving the NIST KAT AES-256
  // CTR_DRBG: key generation draws msg_bytes of rejection material and then the
  // raw secret key from it, and encapsulation draws the message. This file
  // implements SIKE rather than the KAT generator, so the vectors name those
  // drawn byte strings directly. The generator used to expand them was itself
  // checked against published data first - started from the standard entropy
  // input it reproduces all 100 published seeds of each of the four files
  // exactly - and the expanded strings below reproduce the published public
  // key, secret key, ciphertext and shared secret.
  //
  // The full sweep is wider than what one file can carry: all 100 records of
  // each of the four files agree on all five published fields, 400 records and
  // 2000 field comparisons.

  const SIKEP434 = {
    randomness: '7C9935A0B07694AA0C6D10E4DB6B1ADD91282214654CB55E7C2CACD53919604D5BAC7B23EEF4B315FEEF5E7D',
    message: 'CF9297D43C3E763A1B96D658428EC356',
    publicKey:
      '4484D7AADB44B40CC180DC568B2C142A60E6E2863F5988614A6215254B2F5F6F79B48F329AD1A2DED20B7ABAB10F7DBF59C3E20B59A70009' +
      '3060D2A44ACDC0083A53CF0808E0B3A827C45176BEE0DC6EC7CC16461E38461C12451BB95191407C1E942BB50D4C7B25A49C644B630159E6' +
      'C403653838E689FBF4A7ADEA693ED0657BA4A724786AF7953F7BA6E15F9BBF9F5007FB711569E72ACAB05D3463A458536CAB647F00C205D2' +
      '7D5311B2A5113D4B26548000DB237515931A040804E769361F94FF0167C78353D2630A1E6F595A1F80E87F6A5BCD679D7A64C5006F6191D4' +
      'ADEFA1EA67F6388B7017D453F4FE2DFE80CCC709000B52175BFC3ADE52ECCB0CEBE1654F89D39131C357EACB61E5F13C80AB0165B7714D6B' +
      'E6DF65F8DE73FF47B7F3304639F0903653ECCFA252F6E2104C4ABAD3C33AF24FD0E56F58DB92CC66859766035419AB2DF600',
    secretKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD91282214654CB55E7C2CACD53919604D5BAC7B23EEF4B315FEEF5E014484D7AADB44B40CC180DC56' +
      '8B2C142A60E6E2863F5988614A6215254B2F5F6F79B48F329AD1A2DED20B7ABAB10F7DBF59C3E20B59A700093060D2A44ACDC0083A53CF08' +
      '08E0B3A827C45176BEE0DC6EC7CC16461E38461C12451BB95191407C1E942BB50D4C7B25A49C644B630159E6C403653838E689FBF4A7ADEA' +
      '693ED0657BA4A724786AF7953F7BA6E15F9BBF9F5007FB711569E72ACAB05D3463A458536CAB647F00C205D27D5311B2A5113D4B26548000' +
      'DB237515931A040804E769361F94FF0167C78353D2630A1E6F595A1F80E87F6A5BCD679D7A64C5006F6191D4ADEFA1EA67F6388B7017D453' +
      'F4FE2DFE80CCC709000B52175BFC3ADE52ECCB0CEBE1654F89D39131C357EACB61E5F13C80AB0165B7714D6BE6DF65F8DE73FF47B7F33046' +
      '39F0903653ECCFA252F6E2104C4ABAD3C33AF24FD0E56F58DB92CC66859766035419AB2DF600',
    ciphertext:
      '0FDEB26DBD96E0CD272283CA5BDD1435BC9A7F9AB7FC24F83CA926DEED038AE4E47F39F9886E0BD7EEBEAACD12AB435CC92AA3383B2C01E6' +
      'B9E02BC3BEF9C6C2719014562A96A0F3E784E3FA44E5C62ED8CEA79E1108B6FECD5BF8836BF2DAE9FEB1863C4C8B3429220E2797F601FB4B' +
      '8EBAFDD4F17355508D259CA60721D167F6E5480B5133E824F76D3240E97F31325DBB9A53E9A3EEE2E0712734825615A027857E2000D4D00E' +
      '11988499A738452C93DA895BFA0E10294895CCF25E3C261CBE38F5D7E19ABE4E322094CB8DEC5BF7484902BABDE33CC69595F6013B20AABA' +
      '9698C1DEA2BC6F65D57519294E6FEEA3B549599D480948374D2D21B643573C276E1A5B0745301F648D7982AB46A3065639960182BF365819' +
      'EFC0D4E61E87D2820DBC0E849E99E875B21501D1CA7588A1D458CD70C7DF793D4993B9B1679886CAE8013A8DD854F010A100C9933FA642DC' +
      '0AEA9985786ED36B98D3',
    sharedSecret: '35F7F8FF388714DEDC41F139078CEDC9',
    secretKeyOfRecord1:
      'D60B93492A1D8C1C7BA6FC0B733137F3E37BFE55B43B32448F375903D8D226EC94ADBFEA1D2B3536EB987001C9F73E4497AAA3FDF9EB6881' +
      '35866A8A83934BA10E273B8CC3808CF0C1F5FAB3E9BB295885881B73DEBC875670C0F51C4BB40DF5FEDE01B8AF32D1BF10508B8C17B2734E' +
      'B93B2B7F5D84A4A0F2F816E9E2C32AC253C0B6025B124D05A87A9E2A8567930F44BAA14219B941B6B400B4AED1D796DA12A5A9F0B8F3F5EE' +
      '9DD43F64CB24A3B1719DF278ADF56B5F3395187829DA2319DEABF6BBD6EDA244DE2B62CC5AC250C1009DD1CD4712B0B37406612AD002B5E5' +
      '1A62B51AC9C0374D143ABBBD58275FAFC4A5E959C54838C2D6D9FB43B7B2609061267B6A2E6C6D01D295C4223E0D3D7A4CDCFB28A7818A73' +
      '7935279751A6DD8290FD498D1F6AD5F4FFF6BDFA536713F509DCE8047252F1E7D0DD9FCC414C0070B5DCCE3665A21A032D7FBE7491810321' +
      '83AFAD240B7E671E87FBBEC3A8CA4C11AA7A9A23AC69AE2ACF54B664DECD27753D63508F1B02'
  };

  const SIKEP503 = {
    randomness: '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148038626ED79D451140800E03B59B956F8210E556067407D13DC90FA9E8B872BFB8F',
    message: '147C03F7A5BEBBA406C8FAE1874D7F13C80EFE79A3A9A874',
    publicKey:
      '05279D27FF7E3A38ABB05DCFE23B5831C030D832D3EAE35FE06A6538597532D22A0F4012FB2263E160495F8291B58D9DF8A8947C7CF3E673' +
      '5520BB2D094912408829851AC4B85AA922069F2AAA0A4827DFA4730E9CF05485CBEE411C3D5169DD4953746B6A2E6574957EF920596B1612' +
      'BE62A883740B5A0C157117AE1C3A07E4CE8CCCE7E9E88FE7C20A507FF019AE0893F34303E173D291F6CB7ECB4C3901FF34A48DE40771F5BA' +
      'D72DA2B4C1CFD0A61F33E39327A8DA60F5640D4C2E71EF9C7297A4E9BC50493E3BA65D3664610A6D61035CB6600378D017D1E1810ACD1132' +
      '52D60F5915749C2B5CFB4452C40C86F1F40C63297DCCA900686F2D2266F9444539D9BA13B1F52FB2FC3BD4F3EDAA6EB707AAFCA5261EA271' +
      'ED961B2ED195D5E3B0299179251866CE0EAA31C5C90B7999A8D63BA2DE84A8AFA19F11F2DC0CACA39B982CE053F71D269931D9EE26BCE592' +
      'A8EA818553BC8F8D244F62FB4F5E5386E3EFF5CD231401C9EC2BA57FF42DC3B3791357A53E1E31394008',
    secretKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148038626ED79D451140800E03B59B956F8210E556067407D13DC90FA9E8B872BFB0F' +
      '05279D27FF7E3A38ABB05DCFE23B5831C030D832D3EAE35FE06A6538597532D22A0F4012FB2263E160495F8291B58D9DF8A8947C7CF3E673' +
      '5520BB2D094912408829851AC4B85AA922069F2AAA0A4827DFA4730E9CF05485CBEE411C3D5169DD4953746B6A2E6574957EF920596B1612' +
      'BE62A883740B5A0C157117AE1C3A07E4CE8CCCE7E9E88FE7C20A507FF019AE0893F34303E173D291F6CB7ECB4C3901FF34A48DE40771F5BA' +
      'D72DA2B4C1CFD0A61F33E39327A8DA60F5640D4C2E71EF9C7297A4E9BC50493E3BA65D3664610A6D61035CB6600378D017D1E1810ACD1132' +
      '52D60F5915749C2B5CFB4452C40C86F1F40C63297DCCA900686F2D2266F9444539D9BA13B1F52FB2FC3BD4F3EDAA6EB707AAFCA5261EA271' +
      'ED961B2ED195D5E3B0299179251866CE0EAA31C5C90B7999A8D63BA2DE84A8AFA19F11F2DC0CACA39B982CE053F71D269931D9EE26BCE592' +
      'A8EA818553BC8F8D244F62FB4F5E5386E3EFF5CD231401C9EC2BA57FF42DC3B3791357A53E1E31394008',
    ciphertext:
      '100692A8BD30F01BE8AC6B1AF8D93A060D3821B2587F4038D64B72426A194BEDE63CA60B75A5C3C15532CE307115AA9D77AC232E14D99C1E' +
      '1AFEF1EB2D6321AE342F990023466E683A2568D59A14325C2C6C272029741D8E36976D1804059BC06B802F3A495EA50D0DBBA93FD263F4CF' +
      '30BDB5F783BA6A0775715B05F700C85B316F7AA1A1624973885941DBFF91316BF47AC698E11D6B2418F553379D67A00F784B8643FB8A9402' +
      '9584391D488775EB4414A5E6E8122B0F282D900F3D05775F1DD994FB232ED826106203CD3433967F60FF925DF9E86CB376CAB5FD90B132E4' +
      '25682741F6AF078E75792CB4CE085D44993CFB6A4ED5AA3541640A0A67687922B92382CAC47C6AD358011A269CC7C17CE651CA2E2393F7DF' +
      'E19D7054FEF69610A353D676B1F076549510590D406AD13F4A3292CCF206DBDAE47F08D448CC006449F27C1FB54E9C9E6F16ED2F3D120DD5' +
      'AA2620D76690F00E31904C601310C76A843A58E1AEB9C5F515FCEC482C08205FDE99A89E64485EBBD43EEFE2E24D18EEE8F20DF6E113C666' +
      '7512E28396862C98F5C0',
    sharedSecret: 'AF1280151C2C59B4D4150B18BA7F71590523CEA83C9BDDDA'
  };

  const SIKEP610 = {
    randomness: '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148038626ED79D451140800E03B59B956F8210E556067407D13DC90FA9E8B872BFB8FAB0A72898521',
    message: '6255563BA961772146CA0867678D56787CAD77AB4FC8FCFE',
    publicKey:
      '671B24769304DD18C97AF0C5DE741C53E0B45A9E18C7A13A15C1758125E41605587E450F8452A2BF98B51C2AF6B0503CB8E01F8553C36079' +
      'EBFADF4948FFA063ABF4866E7AB9B9D4C9A07CA400C613607E6DB9BB6E7EB8ECA78894C7C8CE9E231B33179B2946C5C5BE1C783FA6AEA218' +
      'F5EC4B4E6F914E5ED3724C5D7B79403F68438A40775E964C1B2C7D22E11A6C07474EB5D4CFF75965B400167E069FA9908A562DBABF5E30FE' +
      'D46BBA0A208ED4E50764CF320FB8556F07C7F6268084476A47D83B085DC77EB3CD30A2B5EE1E5829738077D52A0D7A4149EE9C1A70269BC0' +
      '47B4BE7E5B28007DEF74A4D813853396708A3A8498CC862F54015B79047014639EB8CA3BB786B27A2CFAF31E6BB9CCB152BEB32324652069' +
      '73668597AA35EE1940A316F71241FA40D1AC233931E1967E79AAA600AA6D83FEC6280A63924E7375F22F7A47E1DE483FEA17E0DACBAEDBB1' +
      '3D58C0DC9BC21F2DC9525D46E4210AC5D88567E4F23304EA5BE08D89D57A0246EA21C0CD28C096366D7F3C8D98F5A1FB00FE2F3A183E53A7' +
      'E8B6C19E9BF979E8D20C703C957D6F06A142BE86A0A09B05ED40953BBD7A15E92098633941730DEB5BC1C5F5154E8BCA38E035580E101E6E' +
      'E858D91BD8462B906EB2004C6E01',
    secretKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148038626ED79D451140800E03B59B956F8210E556067407D13DC90FA9E8B872BFB8F' +
      'AB0A72898521671B24769304DD18C97AF0C5DE741C53E0B45A9E18C7A13A15C1758125E41605587E450F8452A2BF98B51C2AF6B0503CB8E0' +
      '1F8553C36079EBFADF4948FFA063ABF4866E7AB9B9D4C9A07CA400C613607E6DB9BB6E7EB8ECA78894C7C8CE9E231B33179B2946C5C5BE1C' +
      '783FA6AEA218F5EC4B4E6F914E5ED3724C5D7B79403F68438A40775E964C1B2C7D22E11A6C07474EB5D4CFF75965B400167E069FA9908A56' +
      '2DBABF5E30FED46BBA0A208ED4E50764CF320FB8556F07C7F6268084476A47D83B085DC77EB3CD30A2B5EE1E5829738077D52A0D7A4149EE' +
      '9C1A70269BC047B4BE7E5B28007DEF74A4D813853396708A3A8498CC862F54015B79047014639EB8CA3BB786B27A2CFAF31E6BB9CCB152BE' +
      'B3232465206973668597AA35EE1940A316F71241FA40D1AC233931E1967E79AAA600AA6D83FEC6280A63924E7375F22F7A47E1DE483FEA17' +
      'E0DACBAEDBB13D58C0DC9BC21F2DC9525D46E4210AC5D88567E4F23304EA5BE08D89D57A0246EA21C0CD28C096366D7F3C8D98F5A1FB00FE' +
      '2F3A183E53A7E8B6C19E9BF979E8D20C703C957D6F06A142BE86A0A09B05ED40953BBD7A15E92098633941730DEB5BC1C5F5154E8BCA38E0' +
      '35580E101E6EE858D91BD8462B906EB2004C6E01',
    ciphertext:
      'FB75E7D835313132AC0B29D8732F1F62E6DD10BBF30375B4A50C7B153431BAE6259E1C5526C07164E87EDC70E4F0D8331D73285661D1F639' +
      'D216372D05B4583C1302932B03FF184D115D0B250297FF26AE81DFA0DE01A1DFB237C8008B22285A289C06BF4BC89C0BD77576932A14B1FE' +
      'B9CE6D7F8816D710F1B043C8E58DCE1B32EF4EC8FB67E10CD23B6D4CC653DD8CD83B5F4DB0B5B741D30125CF842EE13EB940650E1E34E466' +
      '6935B178F2351553F0822C8B354C70E47350E74A08F16D4F39F8AA80C3F4E0083C4BA1F31F5F1D04FD4CF835AEA688885E85509133FFE557' +
      'A7892A0161AC01BBCC8A27CE37E8CB9C1916A0F62BCF1E82C3F9213275B10CA272BFABCA2713CEEAECD0007C9FB6B562AFA2231FF7FD2C1D' +
      '20D8ED28C11A840FEE931FE7A0E3BB925D88A852C2EE9BF606AD4000FA27643155A6FECAD9D4BABA8DE8F8D767AEC7A770D007ADB0D9F76E' +
      '521DE6EF8D3567A32047688E2E8130AAF3EB594A366F3C534E335A3E9EDA326E60394CA10A44340CC78995742E48994002CEE1049870D14C' +
      '23C9FF2E5899DD7E3A1516D2F6E70B3DE1D79987379296E99EBCCAC43DA9A475CA3FE756D4649934BADA6DFA8C8F8BB21136172798BDA13E' +
      '247B2F27874AFE13CCCA31F53D01A94B9520C3CBCDD1B1EB9BBBD6B83C76F64FC5D7C1DCF33A',
    sharedSecret: '0A5CFC45865775D0CC10F89EFAD9FFD33A6C8A7AB868309D'
  };

  const SIKEP751 = {
    randomness: '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2D8626ED79D451140800E03B59B956F8210E556067407D13DC90FA9E8B872BFB8FAB0A7289852106E40538D3575C50028D',
    message: '6255563BA961772146CA0867678D56787CAD77AB4FC8FCFE9E02DF839C99424D',
    publicKey:
      'E1A758EC0D418BFE86D8077B5BB169133C06C1F2A067D8B202D9D058FFC51F63FD26155A6577C74BA7F1A27E7BA51982517B923615DEB00B' +
      'E408920A07831DF5978CFDDD0BF690A264353A4A16B666F90586D7F89A193CE09375D389C1379A7A528581C3ACB002CD2DC4F0FD672568FF' +
      '9050BA8365C7FEFC5E6ED089B921DE6804091A0744DE3EB14D426A3F7DA215C50312617C1C2697243980D06056F2CCE88AE7AE73C7343C0B' +
      '7104C9F2870A94FED744CF6E94630514B6CEAB0E64733BB6FA67B931E5D8206010475CBE8BC587248D65D89D8CD9C8BBFA93E8B5F9EB9130' +
      '773DED665D52ABBD91C4C8C255F73C0FC82501AE33330E9F308DE7177CBF83E4E26E334D7CB09019E638147FC58ED372AF660F14C194BC80' +
      'E9666325C98E0F80877271D4A6BF514F603703D8A697874CD50A34D92F5AAEA84633CCF96801BD517BF425DEE4A32AAF06684052473EA146' +
      '43C3D535440FB2240A988D09F297C5A388CB3DE60ED943F124034B90EFF611221F80F78EC124956338A105F6636B063D7E48BFBD5D614310' +
      'FB97D86F122E4AE6F9DDF4977A93ED7D0CE2A94E346A1A03D3219CF21907B85A5BCDC713F93A4406A22E03B1655A66E1F6741A2F953E6FE0' +
      '868B2614BABEF1943BBBCB1B66D3E7017E533EA84F291240B56AB33EF1DC3F3DE99DBF9E8BE51A0076E462BCDD825EA96D7F63C99177C305' +
      'C257B31461F4C23D43115F0220409E8880BBB2468586D03461E807BE824B693874911B2B52AF06FDBDC47F5A0159729641A7C950AB9E03F2' +
      'DC045135',
    secretKey:
      '7C9935A0B07694AA0C6D10E4DB6B1ADD2FD81A25CCB148032DCD739936737F2D8626ED79D451140800E03B59B956F8210E556067407D13DC' +
      '90FA9E8B872BFB8FAB0A7289852106E40538D3575C500201E1A758EC0D418BFE86D8077B5BB169133C06C1F2A067D8B202D9D058FFC51F63' +
      'FD26155A6577C74BA7F1A27E7BA51982517B923615DEB00BE408920A07831DF5978CFDDD0BF690A264353A4A16B666F90586D7F89A193CE0' +
      '9375D389C1379A7A528581C3ACB002CD2DC4F0FD672568FF9050BA8365C7FEFC5E6ED089B921DE6804091A0744DE3EB14D426A3F7DA215C5' +
      '0312617C1C2697243980D06056F2CCE88AE7AE73C7343C0B7104C9F2870A94FED744CF6E94630514B6CEAB0E64733BB6FA67B931E5D82060' +
      '10475CBE8BC587248D65D89D8CD9C8BBFA93E8B5F9EB9130773DED665D52ABBD91C4C8C255F73C0FC82501AE33330E9F308DE7177CBF83E4' +
      'E26E334D7CB09019E638147FC58ED372AF660F14C194BC80E9666325C98E0F80877271D4A6BF514F603703D8A697874CD50A34D92F5AAEA8' +
      '4633CCF96801BD517BF425DEE4A32AAF06684052473EA14643C3D535440FB2240A988D09F297C5A388CB3DE60ED943F124034B90EFF61122' +
      '1F80F78EC124956338A105F6636B063D7E48BFBD5D614310FB97D86F122E4AE6F9DDF4977A93ED7D0CE2A94E346A1A03D3219CF21907B85A' +
      '5BCDC713F93A4406A22E03B1655A66E1F6741A2F953E6FE0868B2614BABEF1943BBBCB1B66D3E7017E533EA84F291240B56AB33EF1DC3F3D' +
      'E99DBF9E8BE51A0076E462BCDD825EA96D7F63C99177C305C257B31461F4C23D43115F0220409E8880BBB2468586D03461E807BE824B6938' +
      '74911B2B52AF06FDBDC47F5A0159729641A7C950AB9E03F2DC045135',
    ciphertext:
      '66D24BC4630B2EE312F01B26EC1D3EC1F583795EC93B90FD9B5453E0BEDA2A70FB6181C9B9EA86A9866F1468E62CE853C6C65AA5D0E45358' +
      '28B3A97E2D1D31DC4372E6A36DA7B0C4733574B91CCE215086C59B54F2364F61298004C8410B17658B4021CD36859C94210DE338869CACF0' +
      'E2DC11412FA5172E1663AAEBEF4B5EB0ED9175D6C86C5107DA92B8772342A2F44C93EFFE61F6C76AB8ABA194E862543EDB707E9D2EE88499' +
      '5B1062FE2F60627D5C7673C7AC0D15B08C2F8510DC239463B1B32AD46873F6D1CB5A8579457386FD75700989BEED2CA547FE505C581B6B43' +
      '6AABC0F75AD6373A08CEC1504258A972C64EC4A1FEB86BFE32ACF3A73ECF815CBC883F39B42C6429A5875BD0BD6A94CEAD587AF49AC8EFB4' +
      '3E1A447D2D8555CB0ADFBC9F335F1C599BC9FEAB3E4FE5F2D06D930A58C2FFEEDE0E2726EBD85EC890D1CB0E6870DD784AE30286F1A336D5' +
      '7FC41D2F2E2F89765C6A110853BB63E478A64D54A31A18FB4BA44FF58A3662F4D82D544BD9B0E94FC88ABC4E4D27D5F6084B5F2162B357A0' +
      '4A1A28C8938834ECC987E50C0A2CACA442850493CE16C047DF677097D3F7EA034BC3D2535504276003DBBEB12F1949C3D369E7EFBA09831E' +
      '83D622AB2D9277F523946FBAB1DDE14015857EA47663C5CCF30BDF261CCBF31DBE2A560E96CE87FBA80B783350A42C837EB36B2F39A9FED1' +
      'B649B8ECCE3D3235825F7C800834740546E0CF42C9C2C8B12495225F991B14547E5EEDB22858B26EE6E0AE13DBE3D50C6C1EF79C4B97DAD1' +
      'B0239C4037C1AAC29EE1505E0E527EC81348900E7C216A1A1B34B8D2753AF2693647C412',
    sharedSecret: 'FEE94595E8A05C50113C044D4D8558DA101035EBBF604AA41D0AAA75B8A7F786'
  };

  /**
   * Flip one bit of a published hex string, for the rejection cases.
   * @param {string} hex - the published value
   * @param {number} index - which byte to disturb
   * @returns {number[]} the disturbed bytes
   */
  function disturb(hex, index) {
    const bytes = OpCodes.Hex8ToBytes(hex);
    bytes[index] = OpCodes.Xor8(bytes[index], 0x01);
    return bytes;
  }

  const VECTORS = [
    {
      text: 'SIKE PQCkemKAT_374.rsp record 0: drawn randomness to public key (SIKEp434)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      keyGeneration: true,
      parameterSet: 'SIKEp434',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(SIKEP434.randomness),
      expected: OpCodes.Hex8ToBytes(SIKEP434.publicKey)
    },
    {
      text: 'SIKE PQCkemKAT_374.rsp record 0: drawn randomness to secret key (SIKEp434)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      keyGeneration: true,
      parameterSet: 'SIKEp434',
      keyGenerationOutput: 'privateKey',
      input: OpCodes.Hex8ToBytes(SIKEP434.randomness),
      expected: OpCodes.Hex8ToBytes(SIKEP434.secretKey)
    },
    {
      text: 'SIKE PQCkemKAT_374.rsp record 0: encapsulation ciphertext (SIKEp434)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      publicKey: OpCodes.Hex8ToBytes(SIKEP434.publicKey),
      encapsulationOutput: 'ciphertext',
      input: OpCodes.Hex8ToBytes(SIKEP434.message),
      expected: OpCodes.Hex8ToBytes(SIKEP434.ciphertext)
    },
    {
      text: 'SIKE PQCkemKAT_374.rsp record 0: encapsulated shared secret (SIKEp434)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      publicKey: OpCodes.Hex8ToBytes(SIKEP434.publicKey),
      encapsulationOutput: 'sharedSecret',
      input: OpCodes.Hex8ToBytes(SIKEP434.message),
      expected: OpCodes.Hex8ToBytes(SIKEP434.sharedSecret)
    },
    {
      text: 'SIKE PQCkemKAT_374.rsp record 0: decapsulation recovers the shared secret (SIKEp434)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      inverse: true,
      privateKey: OpCodes.Hex8ToBytes(SIKEP434.secretKey),
      input: OpCodes.Hex8ToBytes(SIKEP434.ciphertext),
      expected: OpCodes.Hex8ToBytes(SIKEP434.sharedSecret)
    },
    {
      // Setting sharedSecret turns the result into a verdict, so the rejection
      // cases below can assert a mismatch without naming the value the
      // rejection branch produces.
      text: 'SIKE PQCkemKAT_374.rsp record 0: the recovered secret is the published one (SIKEp434)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      inverse: true,
      privateKey: OpCodes.Hex8ToBytes(SIKEP434.secretKey),
      sharedSecret: OpCodes.Hex8ToBytes(SIKEP434.sharedSecret),
      input: OpCodes.Hex8ToBytes(SIKEP434.ciphertext),
      expected: [1]
    },
    {
      // One bit of the isogeny part of the ciphertext flipped. SIKE answers a
      // ciphertext it did not produce with a secret derived from the rejection
      // value in the secret key rather than an error, so the property to
      // assert is that the published secret does not come back.
      text: 'SIKE PQCkemKAT_374.rsp record 0: a modified ciphertext must not decapsulate to the published secret',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      inverse: true,
      privateKey: OpCodes.Hex8ToBytes(SIKEP434.secretKey),
      sharedSecret: OpCodes.Hex8ToBytes(SIKEP434.sharedSecret),
      input: disturb(SIKEP434.ciphertext, 7),
      expected: [0]
    },
    {
      text: 'SIKE PQCkemKAT_374.rsp record 0: the message half of the ciphertext must be bound too',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      inverse: true,
      privateKey: OpCodes.Hex8ToBytes(SIKEP434.secretKey),
      sharedSecret: OpCodes.Hex8ToBytes(SIKEP434.sharedSecret),
      input: disturb(SIKEP434.ciphertext, 340),
      expected: [0]
    },
    {
      text: "SIKE PQCkemKAT_374.rsp: record 0's ciphertext under record 1's secret key must not recover record 0's secret",
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      inverse: true,
      privateKey: OpCodes.Hex8ToBytes(SIKEP434.secretKeyOfRecord1),
      sharedSecret: OpCodes.Hex8ToBytes(SIKEP434.sharedSecret),
      input: OpCodes.Hex8ToBytes(SIKEP434.ciphertext),
      expected: [0]
    },

    {
      text: 'SIKE PQCkemKAT_434.rsp record 0: drawn randomness to public key (SIKEp503)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      keyGeneration: true,
      parameterSet: 'SIKEp503',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(SIKEP503.randomness),
      expected: OpCodes.Hex8ToBytes(SIKEP503.publicKey)
    },
    {
      text: 'SIKE PQCkemKAT_434.rsp record 0: encapsulation ciphertext (SIKEp503)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      publicKey: OpCodes.Hex8ToBytes(SIKEP503.publicKey),
      encapsulationOutput: 'ciphertext',
      input: OpCodes.Hex8ToBytes(SIKEP503.message),
      expected: OpCodes.Hex8ToBytes(SIKEP503.ciphertext)
    },
    {
      text: 'SIKE PQCkemKAT_434.rsp record 0: decapsulation recovers the shared secret (SIKEp503)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      inverse: true,
      privateKey: OpCodes.Hex8ToBytes(SIKEP503.secretKey),
      input: OpCodes.Hex8ToBytes(SIKEP503.ciphertext),
      expected: OpCodes.Hex8ToBytes(SIKEP503.sharedSecret)
    },

    {
      text: 'SIKE PQCkemKAT_524.rsp record 0: drawn randomness to public key (SIKEp610)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      keyGeneration: true,
      parameterSet: 'SIKEp610',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(SIKEP610.randomness),
      expected: OpCodes.Hex8ToBytes(SIKEP610.publicKey)
    },
    {
      // SIKEp610 is the one set with an odd 2-power exponent, so its
      // encapsulation walks a single 2-isogeny before the chain of 4-isogenies.
      text: 'SIKE PQCkemKAT_524.rsp record 0: encapsulation ciphertext (SIKEp610)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      publicKey: OpCodes.Hex8ToBytes(SIKEP610.publicKey),
      encapsulationOutput: 'ciphertext',
      input: OpCodes.Hex8ToBytes(SIKEP610.message),
      expected: OpCodes.Hex8ToBytes(SIKEP610.ciphertext)
    },
    {
      text: 'SIKE PQCkemKAT_524.rsp record 0: decapsulation recovers the shared secret (SIKEp610)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      inverse: true,
      privateKey: OpCodes.Hex8ToBytes(SIKEP610.secretKey),
      input: OpCodes.Hex8ToBytes(SIKEP610.ciphertext),
      expected: OpCodes.Hex8ToBytes(SIKEP610.sharedSecret)
    },

    {
      text: 'SIKE PQCkemKAT_644.rsp record 0: drawn randomness to public key (SIKEp751)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      keyGeneration: true,
      parameterSet: 'SIKEp751',
      keyGenerationOutput: 'publicKey',
      input: OpCodes.Hex8ToBytes(SIKEP751.randomness),
      expected: OpCodes.Hex8ToBytes(SIKEP751.publicKey)
    },
    {
      text: 'SIKE PQCkemKAT_644.rsp record 0: encapsulation ciphertext (SIKEp751)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      publicKey: OpCodes.Hex8ToBytes(SIKEP751.publicKey),
      encapsulationOutput: 'ciphertext',
      input: OpCodes.Hex8ToBytes(SIKEP751.message),
      expected: OpCodes.Hex8ToBytes(SIKEP751.ciphertext)
    },
    {
      text: 'SIKE PQCkemKAT_644.rsp record 0: decapsulation recovers the shared secret (SIKEp751)',
      uri: 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip',
      inverse: true,
      privateKey: OpCodes.Hex8ToBytes(SIKEP751.secretKey),
      input: OpCodes.Hex8ToBytes(SIKEP751.ciphertext),
      expected: OpCodes.Hex8ToBytes(SIKEP751.sharedSecret)
    }
  ];

  //#endregion

  //#region ===== ALGORITHM =====

  class SIKEAlgorithm extends AsymmetricCipherAlgorithm {
    constructor() {
      super();

      this.name = 'SIKE';
      this.description = 'Supersingular Isogeny Key Encapsulation, the NIST post-quantum round 3 KEM built on isogenies between supersingular elliptic curves over GF(p^2). Broken: the Castryck-Decru attack recovers the secret key from the torsion-point images published with it, so the submission was withdrawn. The four uncompressed parameter sets are implemented and verified against the submission Known Answer Tests.';
      this.inventor = 'David Jao, Luca De Feo, Jerome Plut, Craig Costello, Patrick Longa, Michael Naehrig, Reza Azarderakhsh, Matthew Campagna, Basil Hess, Amir Jalali, Brian Koziel, Joost Renes, Vladimir Soukharev, David Urbanik';
      this.year = 2017;
      this.category = CategoryType.ASYMMETRIC;
      this.subCategory = 'Key Encapsulation';
      this.securityStatus = SecurityStatus.BROKEN;
      this.complexity = ComplexityType.EXPERT;
      this.country = CountryCode.INTL;

      this.SupportedKeySizes = [
        new KeySize(374, 374, 0),
        new KeySize(434, 434, 0),
        new KeySize(524, 524, 0),
        new KeySize(644, 644, 0)
      ];

      this.documentation = [
        new LinkItem('SIKE round 3 specification', 'https://csrc.nist.gov/CSRC/media/Projects/post-quantum-cryptography/documents/round-3/submissions/SIKE-Round3.zip'),
        new LinkItem('NIST PQC round 3 submissions', 'https://csrc.nist.gov/projects/post-quantum-cryptography/round-3-submissions'),
        new LinkItem('Towards quantum-resistant cryptosystems from supersingular elliptic curve isogenies', 'https://eprint.iacr.org/2011/506')
      ];

      this.references = [
        new LinkItem('SIKE reference and optimised implementations', 'https://github.com/microsoft/PQCrypto-SIDH'),
        new LinkItem('Efficient compression of SIDH public keys', 'https://eprint.iacr.org/2016/963')
      ];

      this.knownVulnerabilities = [
        new Vulnerability('Key recovery in polynomial time (Castryck-Decru)',
          'The public key publishes the images of a known torsion basis under the secret isogeny. Glue-and-split on a product of elliptic curves turns those images into a sequence of decisions that recover the isogeny itself, so the secret key follows from the public key alone. SIKEp434 fell in about an hour on one core in the original paper and in minutes after the follow-up work.',
          'None. The scheme is broken for every parameter set and was withdrawn from standardisation; use a KEM whose security does not rest on the isogeny problem with torsion-point hints.',
          'https://eprint.iacr.org/2022/975')
      ];

      this.tests = VECTORS;
    }

    CreateInstance(isInverse = false) {
      return new SIKEInstance(this, isInverse);
    }
  }

  /**
   * SIKE instance implementing the Feed/Result pattern.
   *
   * Which direction runs is chosen by what is configured: with
   * `keyGeneration` set, fed bytes are the drawn randomness and the result is
   * the public or the secret key; otherwise a public key makes the instance
   * encapsulate and a secret key makes it decapsulate.
   */
  class SIKEInstance extends IAlgorithmInstance {
    constructor(algorithm, isInverse = false) {
      super(algorithm);
      this.isInverse = isInverse;
      this.inputBuffer = [];
      this._parameterSet = PARAMETER_SETS.SIKEp434;
      this._publicKey = null;
      this._privateKey = null;
      this._sharedSecret = null;
      this._keyData = null;
      this.keyGeneration = false;
      this.keyGenerationOutput = 'publicKey';
      this.encapsulationOutput = 'ciphertext';
    }

    // ---- configuration ----

    set parameterSet(label) {
      const found = findParameterSet(label);
      if (!found) throw new Error('Unknown SIKE parameter set: ' + label);
      this._parameterSet = found;
    }

    get parameterSet() {
      return this._parameterSet.name;
    }

    /** The public key. Its length selects the parameter set. */
    set publicKey(keyBytes) {
      if (!keyBytes) {
        this._publicKey = null;
        return;
      }

      const found = parameterSetByLength(keyBytes.length, 'publicKeyBytes');
      if (!found)
        throw new Error('A SIKE public key is 330, 378, 462 or 564 bytes, got ' + keyBytes.length);

      this._parameterSet = found;
      this._publicKey = Array.from(keyBytes);
    }

    get publicKey() {
      return this._publicKey ? this._publicKey.slice() : null;
    }

    set privateKey(keyBytes) {
      if (!keyBytes) {
        this._privateKey = null;
        return;
      }

      const found = parameterSetByLength(keyBytes.length, 'privateKeyBytes');
      if (!found)
        throw new Error('A SIKE secret key is 374, 434, 524 or 644 bytes, got ' + keyBytes.length);

      this._parameterSet = found;
      this._privateKey = Array.from(keyBytes);
    }

    get privateKey() {
      return this._privateKey ? this._privateKey.slice() : null;
    }

    /**
     * A shared secret to compare the decapsulated one against. Setting it makes
     * Result report agreement as [1] or [0] rather than returning the secret,
     * so a vector can assert a rejection without naming the value the rejection
     * produces.
     */
    set sharedSecret(secretBytes) {
      this._sharedSecret = secretBytes ? Array.from(secretBytes) : null;
    }

    get sharedSecret() {
      return this._sharedSecret ? this._sharedSecret.slice() : null;
    }

    /** The generic key entry point: a secret key, a public key, or a set name. */
    set key(keyData) {
      this._keyData = keyData;

      if (keyData === null || keyData === undefined) {
        this._publicKey = null;
        this._privateKey = null;
        return;
      }

      if (typeof keyData === 'string' || typeof keyData === 'number') {
        this.parameterSet = keyData;
        return;
      }

      if (!Array.isArray(keyData) && !ArrayBuffer.isView(keyData))
        throw new Error('Invalid SIKE key data format');

      const bytes = Array.from(keyData);

      if (parameterSetByLength(bytes.length, 'privateKeyBytes')) {
        this.privateKey = bytes;
        return;
      }
      if (parameterSetByLength(bytes.length, 'publicKeyBytes')) {
        this.publicKey = bytes;
        return;
      }

      let text = '';
      for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
      this.parameterSet = text;
    }

    get key() {
      return this._keyData;
    }

    // ---- streaming ----

    /**
     * Feed input bytes. Repeated calls append, so feeding in pieces is the same
     * as feeding whole.
     * @param {number[]} data - input bytes
     */
    Feed(data) {
      if (data === null || data === undefined) return;

      if (typeof data === 'string') {
        for (let i = 0; i < data.length; i++)
          this.inputBuffer.push(OpCodes.And8(data.charCodeAt(i), 0xFF));
        return;
      }

      if (typeof data === 'number') {
        this.inputBuffer.push(data);
        return;
      }

      for (let i = 0; i < data.length; i++) this.inputBuffer.push(data[i]);
    }

    /**
     * Produce the key, the ciphertext, the shared secret, or the verdict.
     * @returns {number[]} the result bytes
     */
    Result() {
      const input = this.inputBuffer;
      this.inputBuffer = [];

      if (this.keyGeneration) {
        const pair = kemKeypair(input, this._parameterSet);
        return this.keyGenerationOutput === 'privateKey' ? pair.secretKey : pair.publicKey;
      }

      if (this.isInverse || (this._privateKey && !this._publicKey)) {
        if (!this._privateKey)
          throw new Error('SIKE decapsulation needs a secret key');

        const recovered = kemDecapsulate(input, this._privateKey, this._parameterSet);
        if (!this._sharedSecret) return recovered;
        return [OpCodes.SecureCompare(recovered, this._sharedSecret) ? 1 : 0];
      }

      if (!this._publicKey)
        throw new Error('SIKE encapsulation needs a public key');

      const encapsulated = kemEncapsulate(this._publicKey, input, this._parameterSet);
      return this.encapsulationOutput === 'sharedSecret'
        ? encapsulated.sharedSecret
        : encapsulated.ciphertext;
    }

    // ---- convenience ----

    /**
     * Generate a key pair from the drawn randomness.
     * @param {number[]} randomness - msgBytes + secretBBytes bytes
     * @returns {object} { publicKey, secretKey }
     */
    GenerateKeyPair(randomness) {
      const pair = kemKeypair(Array.from(randomness), this._parameterSet);
      this._publicKey = pair.publicKey;
      this._privateKey = pair.secretKey;
      return { publicKey: pair.publicKey.slice(), secretKey: pair.secretKey.slice() };
    }

    /**
     * Encapsulate to the configured public key.
     * @param {number[]} message - msgBytes of randomness
     * @returns {object} { ciphertext, sharedSecret }
     */
    Encapsulate(message) {
      if (!this._publicKey) throw new Error('SIKE encapsulation needs a public key');
      return kemEncapsulate(this._publicKey, Array.from(message), this._parameterSet);
    }

    /**
     * Decapsulate with the configured secret key.
     * @param {number[]} ciphertext - the ciphertext
     * @returns {number[]} the shared secret
     */
    Decapsulate(ciphertext) {
      if (!this._privateKey) throw new Error('SIKE decapsulation needs a secret key');
      return kemDecapsulate(Array.from(ciphertext), this._privateKey, this._parameterSet);
    }

    /** Wipe the key material held by this instance. */
    ClearData() {
      if (this._privateKey) OpCodes.ClearArray(this._privateKey);
      if (this._sharedSecret) OpCodes.ClearArray(this._sharedSecret);
      this._privateKey = null;
      this._publicKey = null;
      this._sharedSecret = null;
      OpCodes.ClearArray(this.inputBuffer);
      this.inputBuffer = [];
    }
  }

  //#endregion

  // ===== REGISTRATION =====

  const algorithmInstance = new SIKEAlgorithm();
  if (!AlgorithmFramework.Find(algorithmInstance.name)) {
    RegisterAlgorithm(algorithmInstance);
  }

  // ===== EXPORTS =====

  return {
    SIKEAlgorithm, SIKEInstance, PARAMETER_SETS,
    kemKeypair, kemEncapsulate, kemDecapsulate,
    ephemeralKeyGenerationA, ephemeralKeyGenerationB,
    ephemeralSecretAgreementA, ephemeralSecretAgreementB
  };
}));
