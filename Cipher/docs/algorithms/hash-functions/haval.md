# HAVAL

> HAVAL (HAsh of Variable Length) is a cryptographic hash function with variable output length (128, 160, 192, 224, 256 bits) and variable passes (3, 4, 5).

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Variable Hash |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Yuliang Zheng, Josef Pieprzyk, Jennifer Seberry |
| Year | 1992 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/hash/haval.js`](../../../algorithms/hash/haval.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [HAVAL - A One-Way Hashing Algorithm with Variable Length of Output](https://web.archive.org/web/20171129084214/http://labs.calyptix.com/haval.php)
- [US Patent 5,351,310 - HAVAL](https://patents.google.com/patent/US5351310A/en)
- [Cryptanalysis of HAVAL](https://link.springer.com/chapter/10.1007/3-540-48329-2_24)

## References

- [Hash Function Cryptanalysis](https://csrc.nist.gov/projects/hash-functions)

## Test vectors

19 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [String 'abc' - HAVAL-128/3](https://github.com/rikyoz/MrHash/blob/master/src/haval.cpp)

| Field | Value |
| --- | --- |
| `passes` | `3` |
| `hashBits` | `128` |
| `input` | `616263` |
| `expected` | `9e40ed883fb63e985d299b40cda2b8f2` |

**Vector 2** — [String 'abc' - HAVAL-256/3](https://github.com/rikyoz/MrHash/blob/master/src/haval.cpp)

| Field | Value |
| --- | --- |
| `passes` | `3` |
| `hashBits` | `256` |
| `input` | `616263` |
| `expected` | `8699f1e3384d05b2a84b032693e2b6f46df85a13a50d93808d6874bb8fb9e86c` |

**Vector 3** — [Empty string - HAVAL-256/5](https://github.com/rikyoz/MrHash/blob/master/src/haval.cpp)

| Field | Value |
| --- | --- |
| `passes` | `5` |
| `hashBits` | `256` |
| `input` | _(empty)_ |
| `expected` | `be417bb4dd5cfb76c7126f4f8eeb1553a449039307b1a3cd451dbfdc0fbbe330` |

**Vector 4** — [Empty string - HAVAL-160/3](https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt)

| Field | Value |
| --- | --- |
| `passes` | `3` |
| `hashBits` | `160` |
| `input` | _(empty)_ |
| `expected` | `d353c3ae22a25401d257643836d7231a9a95f953` |

**Vector 5** — [Empty string - HAVAL-192/5](https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt)

| Field | Value |
| --- | --- |
| `passes` | `5` |
| `hashBits` | `192` |
| `input` | _(empty)_ |
| `expected` | `4839d0626f95935e17ee2fc4509387bbe2cc46cb382ffe85` |

**Vector 6** — [String 'abc' - HAVAL-160/3](https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt)

| Field | Value |
| --- | --- |
| `passes` | `3` |
| `hashBits` | `160` |
| `input` | `616263` |
| `expected` | `b21e876c4d391e2a897661149d83576b5530a089` |

**Vector 7** — [String 'abc' - HAVAL-160/4](https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt)

| Field | Value |
| --- | --- |
| `passes` | `4` |
| `hashBits` | `160` |
| `input` | `616263` |
| `expected` | `77aca22f5b12cc09010afc9c0797308638b1cb9b` |

**Vector 8** — [String 'abc' - HAVAL-160/5](https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt)

| Field | Value |
| --- | --- |
| `passes` | `5` |
| `hashBits` | `160` |
| `input` | `616263` |
| `expected` | `ae646b04845e3351f00c5161d138940e1fa0c11c` |

**Vector 9** — [String 'abc' - HAVAL-192/3](https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt)

| Field | Value |
| --- | --- |
| `passes` | `3` |
| `hashBits` | `192` |
| `input` | `616263` |
| `expected` | `a7b14c9ef3092319b0e75e3b20b957d180bf20745629e8de` |

**Vector 10** — [String 'abc' - HAVAL-192/4](https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt)

| Field | Value |
| --- | --- |
| `passes` | `4` |
| `hashBits` | `192` |
| `input` | `616263` |
| `expected` | `7e29881ed05c915903dd5e24a8e81cde5d910142ae66207c` |

**Vector 11** — [String 'abc' - HAVAL-192/5](https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt)

| Field | Value |
| --- | --- |
| `passes` | `5` |
| `hashBits` | `192` |
| `input` | `616263` |
| `expected` | `d12091104555b00119a8d07808a3380bf9e60018915b9025` |

**Vector 12** — [String 'a..z A..Z 0..9' (61 chars) x3 - HAVAL-160/4](https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt)

| Field | Value |
| --- | --- |
| `passes` | `4` |
| `hashBits` | `160` |
| `input` | `6162636465666768696a6b6c6d6e6f70 7172737475767778797a414243444546 4748494a4b4c4d4f5051525354555657 58595a30313233343536373839616263 6465666768696a6b6c6d6e6f70717273 7475767778797a414243444546474849 4a4b4c4d4f505152535455565758595a 30313233343536373839616263646566 6768696a6b6c6d6e6f70717273747576 7778797a4142434445464748494a4b4c 4d4f505152535455565758595a303132 33343536373839` |
| `expected` | `3444e38cc2a132b818b554ced8f7d9592df28f57` |

**Vector 13** — [String 'a..z A..Z 0..9' (61 chars) x3 - HAVAL-192/4](https://github.com/php/php-src/blob/master/ext/hash/tests/haval.phpt)

| Field | Value |
| --- | --- |
| `passes` | `4` |
| `hashBits` | `192` |
| `input` | `6162636465666768696a6b6c6d6e6f70 7172737475767778797a414243444546 4748494a4b4c4d4f5051525354555657 58595a30313233343536373839616263 6465666768696a6b6c6d6e6f70717273 7475767778797a414243444546474849 4a4b4c4d4f505152535455565758595a 30313233343536373839616263646566 6768696a6b6c6d6e6f70717273747576 7778797a4142434445464748494a4b4c 4d4f505152535455565758595a303132 33343536373839` |
| `expected` | `0ca58f140ed92828a27913ce5636611abcada220fccf3af7` |

**Vector 14** — [117 x 'a' - HAVAL-224/3 (117 bytes, the longest tail the footer still fits behind)](https://www.nuget.org/packages/HashLib4CSharp)

| Field | Value |
| --- | --- |
| `passes` | `3` |
| `hashBits` | `224` |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 6161616161` |
| `expected` | `365601a3c875aeae81f92d0029f1c8ab837148dae077e28fd0a192ea` |

**Vector 15** — [118 x 'a' - HAVAL-128/3 (118 bytes, the shortest tail that pushes the footer into a second block)](https://www.nuget.org/packages/HashLib4CSharp)

| Field | Value |
| --- | --- |
| `passes` | `3` |
| `hashBits` | `128` |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 616161616161` |
| `expected` | `1065c6b9296279e1286c9b248bcf3208` |

**Vector 16** — [122 x 'a' - HAVAL-192/4 (122 bytes, footer in a second block)](https://www.nuget.org/packages/HashLib4CSharp)

| Field | Value |
| --- | --- |
| `passes` | `4` |
| `hashBits` | `192` |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161` |
| `expected` | `d29ca0a0aed203918df5f7f1ea47cdaae598b2e0cf9bc39e` |

**Vector 17** — [127 x 'a' - HAVAL-256/5 (127 bytes, the longest tail that needs a second block)](https://www.nuget.org/packages/HashLib4CSharp)

| Field | Value |
| --- | --- |
| `passes` | `5` |
| `hashBits` | `256` |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 616161616161616161616161616161` |
| `expected` | `f7eabeec467c8b56af40f90e799ea878d8ea7eff260d49982209364ad0e0c39d` |

**Vector 18** — [128 x 'a' - HAVAL-256/5 (128 bytes, one full block and a padding block)](https://www.nuget.org/packages/HashLib4CSharp)

| Field | Value |
| --- | --- |
| `passes` | `5` |
| `hashBits` | `256` |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `93390552a2d23df530a5918c95d095e3914cf476cd1d95bede099c7674b31efe` |

**Vector 19** — [246 x 'a' - HAVAL-160/4 (246 bytes, 118 bytes past a full block)](https://www.nuget.org/packages/HashLib4CSharp)

| Field | Value |
| --- | --- |
| `passes` | `4` |
| `hashBits` | `160` |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 616161616161` |
| `expected` | `a1ca5bfdf2e7bc4ba833d8f6ec047d801b1d99a2` |

---

[← All algorithms](../README.md)
