# Dilithium

> CRYSTALS-Dilithium, the module-lattice signature scheme standardised as ML-DSA in NIST FIPS 204. Signs over Z_q[X]/(X^256+1) with q = 8380417, using rejection sampling so that the response carries no information about the secret vectors. The three parameter sets are the standardised ones; Dilithium2, Dilithium3 and Dilithium5 name the same sets as ML-DSA-44, ML-DSA-65 and ML-DSA-87.

## Properties

| Property | Value |
| --- | --- |
| Category | Asymmetric Ciphers |
| Sub-category | Post-Quantum Digital Signature |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Vadim Lyubashevsky, Leo Ducas, Eike Kiltz, Tancrede Lepoint, Peter Schwabe, Gregor Seiler, Damien Stehle |
| Year | 2017 |
| Origin | 🌐 International |
| Source | [`algorithms/asymmetric/dilithium.js`](../../../algorithms/asymmetric/dilithium.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 2 bytes (16 bits); 3 bytes (24 bits); 5 bytes (40 bits) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [NIST FIPS 204](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf)
- [Dilithium Original Paper](https://eprint.iacr.org/2017/633)
- [NIST Post-Quantum Cryptography](https://csrc.nist.gov/projects/post-quantum-cryptography)
- [Post-Quantum Signatures](https://en.wikipedia.org/wiki/Post-quantum_cryptography)

## References

- [Dilithium Reference Implementation](https://github.com/pq-crystals/dilithium)
- [NIST ACVP FIPS 204 Vectors](https://github.com/usnistgov/ACVP-Server/tree/master/gen-val/json-files)
- [NIST PQC Standardization](https://csrc.nist.gov/projects/post-quantum-cryptography/post-quantum-cryptography-standardization)
- [Module Learning With Errors](https://en.wikipedia.org/wiki/Learning_with_errors)

## Test vectors

14 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ACVP ML-DSA-keyGen-FIPS204, ML-DSA-44 tcId 1: seed to public key](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-keyGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | ML-DSA-44 |
| `keyGenerationOutput` | publicKey |
| `input` | `7194b13c95231010afd2c909992bd2003ba6f437c3886bdbe3f6b867a14ba161` |
| `expected` | `0b89806f0eec39f2891116152ed4319d 4260dfb8ac0710765bd497e6e1de1778 3cf81e435a412eabef5db3af5d15867b bb4c60f8cf98ba31bad6d41a5f8eb0c1 …` (1312 bytes; the full value is in the source) |

**Vector 2** — [ACVP ML-DSA-keyGen-FIPS204, ML-DSA-44 tcId 1: seed to private key](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-keyGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | ML-DSA-44 |
| `keyGenerationOutput` | privateKey |
| `input` | `7194b13c95231010afd2c909992bd2003ba6f437c3886bdbe3f6b867a14ba161` |
| `expected` | `0b89806f0eec39f2891116152ed4319d 4260dfb8ac0710765bd497e6e1de1778 6cdec899f1c6534284585dda4df03e45 e4d39b4526015a7b3d65f8bf87545256 …` (2560 bytes; the full value is in the source) |

**Vector 3** — [ACVP ML-DSA-keyGen-FIPS204, ML-DSA-65 tcId 26: seed to public key](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-keyGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | ML-DSA-65 |
| `keyGenerationOutput` | publicKey |
| `input` | `a991fd42b071d49c48ae3e75c647459e0daad1e1ba356a04801912d3294bcff8` |
| `expected` | `36db0b5dce98bd190cb139e80b71b49c 7d7040b71c5a1f3412c46bde939192b1 b57ccb88ac2714c1240cb0eb62c689e0 31aea3d9f3eb3ed7bfa45931d288dcae …` (1952 bytes; the full value is in the source) |

**Vector 4** — [ACVP ML-DSA-keyGen-FIPS204, ML-DSA-87 tcId 51: seed to public key](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-keyGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `keyGeneration` | Yes |
| `parameterSet` | ML-DSA-87 |
| `keyGenerationOutput` | publicKey |
| `input` | `a16f5b0796703e2d1a0140a35cbf36efabe70e752ba59b6a9a0e9c4b05302f73` |
| `expected` | `a5787e8044248f3f85aac54e9469fc98 f1b1138cc127b120f9946c80b96e3d89 ccfe38c995645d4b6a559eacb2afb816 21d765c6e42e73031d44cbe74d322c7b …` (2592 bytes; the full value is in the source) |

**Vector 5** — [ACVP ML-DSA-sigGen-FIPS204, ML-DSA-44 tcId 110: deterministic signature, internal interface](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `messageEncoding` | internal |
| `privateKey` | `1ab666c8a0674a4d94657f97282d3904 b2b775e4f0c8b53ba83e9734aeb45054 69ea64a942bab348e718c4fd5905e9f0 7a48865dd1f2e825ef4868699e7640e9 …` (2560 bytes; the full value is in the source) |
| `input` | `35` |
| `expected` | `0a906de3d35f6b579dd2fade2e10e624 f0d6471343e28415cb6ab21620e1aa17 7fab773c107b450b58e1e786b7637fc3 c45f98eb7d089009ab14b69f75875fa3 …` (2420 bytes; the full value is in the source) |

**Vector 6** — [ACVP ML-DSA-sigGen-FIPS204, ML-DSA-65 tcId 147: deterministic signature, internal interface](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `messageEncoding` | internal |
| `privateKey` | `cb7551d9b6737ff9683013a3c9f61d2f 141e82254e4c4db55b4bcdc87d08491f 1f239b22a2661495988398fb4352065c 62bf522acaf6746c6d767f94fa032119 …` (4032 bytes; the full value is in the source) |
| `input` | `e5` |
| `expected` | `25470569f739fa6e730e32122b35d7d3 4ddf422a1e32c26c53ba253add095c52 de0e32628e12a33604cc33dfc657a5a3 7a18aa5786e4fe2c89c0d31bd7190d81 …` (3309 bytes; the full value is in the source) |

**Vector 7** — [ACVP ML-DSA-sigGen-FIPS204, ML-DSA-87 tcId 172: deterministic signature, internal interface](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `messageEncoding` | internal |
| `privateKey` | `1bff19fae7236f87ad8dda1341ac28be e33c0c92ff3ac093cc0fab1987eb06e0 adde92badec97e75d2c3cba014fafdcb 47e081dad95d565251dd842ebdd9f9b4 …` (4896 bytes; the full value is in the source) |
| `input` | `5c` |
| `expected` | `eeb284606d8a797f5599225400c4253d 026f6f18e17f6e487ebc202887cf241d d74fe3471ff10576962dff919f43b172 5c2c328354f64f328b33bcbd70f1eb56 …` (4627 bytes; the full value is in the source) |

**Vector 8** — [ACVP ML-DSA-sigGen-FIPS204, ML-DSA-44 tcId 290: hedged signature with published randomness](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigGen-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `messageEncoding` | internal |
| `privateKey` | `4ae29919ff79477285e3288096913028 7a39c3207e274afd1359182d697121bd cd6f163eb0728316b5149d0026e85f26 ac0f9cb5bc4de8a1a23f1c27a8932afa …` (2560 bytes; the full value is in the source) |
| `signRandomness` | `d035d99771c938a9927d8e24cfc7689f1f68e94d57a13c75dcb872f3a2ad14d5` |
| `input` | `27` |
| `expected` | `09fe3832b9303d44593c3b3125a4e1ec c135ebdcd593906cc6410796c0bd72ff 6a22b68e35edb7064ccd0a92970e95ab f3b73a693dd0cfee50b683507a0b6a96 …` (2420 bytes; the full value is in the source) |

**Vector 9** — [ACVP ML-DSA-sigVer-FIPS204, ML-DSA-44 tcId 11: valid signature over a message and context](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `publicKey` | `3aafe3b287818a44346f264270069349 0a8f2c5cc6a89853fc78f7a4a73edb8d 44aa62836269b171bebd6f1ccb788e7e 22bca0b23c0f3367ee8740955a766fb8 …` (1312 bytes; the full value is in the source) |
| `signature` | `7efca85402edf73aa27fcb944668b7f4 e1cea5a3110cefe5a637bedd478c4745 4f59555b98b8717b623c282125185645 ea3012ae5182fea26b286c78089b2983 …` (2420 bytes; the full value is in the source) |
| `context` | `11326798703cdf88575c20beee8738e3 d893138eae44bdbad3ada7e1e947f6ec 33a7593e4a66e0d78e4774c020420033 50ed53ef751f7a6a70b2ff51136dd0cc 1d4101efba88d02c8288ae29ae2d6cd2 ffbb4eb913132e359714c61b93635f3c 7023ee` |
| `input` | `a1993d2461b99efeeaec415e9692a3c8 bf19fca8cba4d46b889b1e522de3e643 7d93de2b86adac239156e580bcdb6399 064b7b87ada0337fc4c3d10ddc2f54cf …` (567 bytes; the full value is in the source) |
| `expected` | `01` |

**Vector 10** — [ACVP ML-DSA-sigVer-FIPS204, ML-DSA-44 tcId 117: modified signature - z, must not verify](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `messageEncoding` | internal |
| `publicKey` | `4864e2c6273d8a368f29154273771e07 65312d79a4382a338fc6274f3bbcf825 f50aaf9392b8ab1dbf4c444a64b57d3b a27aefe4b703a9d0c29a732feb04b7a6 …` (1312 bytes; the full value is in the source) |
| `signature` | `bc458ef675fc521e333a5a9eedd8255b cacf14100d0e90a66ecf2e064ab4b881 43bfb2259c606846f06eac88711b3ca0 9d3085348562f78935b4661dd231e120 …` (2420 bytes; the full value is in the source) |
| `input` | `1110e64c6cfd24f74074177f263928fd 8c1040a11784bbfa89d19b9634673139 845b75661e76697d5f069a6e6c2cf5c8 5f8bed9e75e6ef877605c2d57a84fedb …` (1292 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 11** — [ACVP ML-DSA-sigVer-FIPS204, ML-DSA-44 tcId 8: modified signature - commitment, must not verify](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `publicKey` | `5bd0caa8620ef7126da47d676d0838d7 9ef6ea0083e2fae923702488670b87c6 b289a80853c2e06a454fc30545da63e3 d666333f466d5f67a15f0e2cbb9bcdea …` (1312 bytes; the full value is in the source) |
| `signature` | `34336dac2ba38b947c3f0ef434b5b2df 5c2be3537742cdba0fafa9a88380602a 4f4f7daf5cf68428f52b1346ae042825 28f6548c7aa5664f9e14895597eb15f7 …` (2420 bytes; the full value is in the source) |
| `context` | `269cc2ac5960a0633166440d731d867a 4af2b70733d59230b0961c88623f2288 928819df93127e714dcc8c137df7a518 0ca2289ed205433f7c55bed7d1ed30bd 79c1051836931c7291890d77150e866f 6eed7693fd9c4a98a1` |
| `input` | `1f901b68c2403c84732ca2b21c770761 c26f4c14a7bb558795ff568e1d3ed34d 0fc1759415172a0a1b05f3658c638cdf 903b197551af0995243080ec4b578966 …` (1116 bytes; the full value is in the source) |
| `expected` | `00` |

**Vector 12** — [ACVP ML-DSA-sigVer-FIPS204, ML-DSA-44 tcId 9: modified signature - hint, must not verify](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `publicKey` | `3dbea11df7cf760d20f25d250da2ed66 4679bc5f8cfe1ab246d0d975960de334 3d1901a67fc48a6fb775594c971ea2a7 9dab578fda41ad235c550974f7428924 …` (1312 bytes; the full value is in the source) |
| `signature` | `c0162f0ea7a5e7de9282105e964c3502 ecdf05d94974f6506393c3dec22b98b2 64d74ac50bed39e1f75d54c841ca2ef3 ea6978c6e15637e44126242738242f4d …` (2420 bytes; the full value is in the source) |
| `context` | `89b1280b39e807` |
| `input` | `3f` |
| `expected` | `00` |

**Vector 13** — [ACVP ML-DSA-sigVer-FIPS204, ML-DSA-44 tcId 120: modified message, must not verify](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `messageEncoding` | internal |
| `publicKey` | `55da76c76da0e47e70493975dad91bf7 b20ffa38590c8f48df681d5dd94617cb 1dc4207e32777fd452237fee52b34f35 7b1ce7d8e585f29cac61fab3f4585923 …` (1312 bytes; the full value is in the source) |
| `signature` | `fe91df983d57a5fd252672de1be54908 f5a14743a93de399d8066fcf3279ed64 df36f9bc22eaee15da5365d960a7a819 235f75ea0eadd9da60b420c1adddf5d4 …` (2420 bytes; the full value is in the source) |
| `input` | `cc` |
| `expected` | `00` |

**Vector 14** — [ACVP ML-DSA-sigVer-FIPS204: tcId 11's valid signature under tcId 120's public key must not verify](https://github.com/usnistgov/ACVP-Server/blob/master/gen-val/json-files/ML-DSA-sigVer-FIPS204/internalProjection.json)

| Field | Value |
| --- | --- |
| `publicKey` | `55da76c76da0e47e70493975dad91bf7 b20ffa38590c8f48df681d5dd94617cb 1dc4207e32777fd452237fee52b34f35 7b1ce7d8e585f29cac61fab3f4585923 …` (1312 bytes; the full value is in the source) |
| `signature` | `7efca85402edf73aa27fcb944668b7f4 e1cea5a3110cefe5a637bedd478c4745 4f59555b98b8717b623c282125185645 ea3012ae5182fea26b286c78089b2983 …` (2420 bytes; the full value is in the source) |
| `context` | `11326798703cdf88575c20beee8738e3 d893138eae44bdbad3ada7e1e947f6ec 33a7593e4a66e0d78e4774c020420033 50ed53ef751f7a6a70b2ff51136dd0cc 1d4101efba88d02c8288ae29ae2d6cd2 ffbb4eb913132e359714c61b93635f3c 7023ee` |
| `input` | `a1993d2461b99efeeaec415e9692a3c8 bf19fca8cba4d46b889b1e522de3e643 7d93de2b86adac239156e580bcdb6399 064b7b87ada0337fc4c3d10ddc2f54cf …` (567 bytes; the full value is in the source) |
| `expected` | `00` |

---

[← All algorithms](../README.md)
