# Hamsi-384

> SHA-3 candidate hash function with 384-bit output. Uses a Serpent-inspired non-linear permutation with a linear-code based message expansion in a concatenation-truncation construction.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Hash Function |
| Security status | 📰 Obsolete |
| Complexity | Advanced |
| Inventor | Özgül Küçük |
| Year | 2008 |
| Origin | Not specified |
| Source | [`algorithms/hash/hamsi.js`](../../../algorithms/hash/hamsi.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 48 bytes (384 bits) |

## Security

**Status:** 📰 Obsolete

No vulnerabilities are recorded for this implementation.

## Documentation

- [Hamsi Specification](https://www.cosic.esat.kuleuven.be/hamsi/)
- [Hamsi Submission Package (NIST SHA-3 Round 2)](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)
- [sphlib Reference Implementation](https://github.com/pornin/sphlib/blob/master/c/hamsi.c)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)

## References

- [Distinguishers for the Compression Function and Output Transformation of Hamsi-256](https://eprint.iacr.org/2010/091.pdf)
- [sphlib test vectors (test_hamsi.c)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Specification version: NIST round-2 KAT ShortMsgKAT_384.txt, Len = 0](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | _(empty)_ |
| `expected` | `3943cd34e3b96b197a8bf4bac7aa982d 18530dd12f41136b26d7e88759255f21 153f4a4bd02e523612b8427f9dd96c8d` |

**Vector 2** — [Specification version: NIST round-2 KAT ShortMsgKAT_384.txt, Len = 8](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | `cc` |
| `expected` | `9b299c0b4a6838b5b0f53b0f9c0aea98 bbc9c4c9481ec0ec68f344e696f8787d e2e08a1404a038c83ac9e121136e8bb8` |

**Vector 3** — [Specification version: NIST round-2 KAT ShortMsgKAT_384.txt, Len = 512](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | `e926ae8b0af6e53176dbffcc2a6b88c6 bd765f939d3d178a9bde9ef3aa131c61 e31c1e42cdfaf4b4dcde579a37e150ef bef5555b4c1cb40439d835a724e2fae7` |
| `expected` | `eb2582e8e02dfea88e372f233833eb17 b283cad4a3ad13410e16a50867a62270 fb4c5b90a9d7c6b2077571f9ea2054e6` |

**Vector 4** — [sphlib version: test_hamsi.c nist_vec384[0] (NIST message, Len = 0)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | _(empty)_ |
| `expected` | `3943cd34e3b96b197a8bf4bac7aa982d 18530dd12f41136b26d7e88759255f21 153f4a4bd02e523612b8427f9dd96c8d` |

**Vector 5** — [sphlib version: test_hamsi.c nist_vec384[24] (NIST message, Len = 24)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | `1f877c` |
| `expected` | `d8c34c26e4147f706b94923073ee272a ef4d024e75cb622288016e38175af79c 405cec671f426dc2abef6e4381886e69` |

**Vector 6** — [sphlib version: test_hamsi.c nist_vec384[1016] (NIST message, Len = 1016)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | `a62fc595b4096e6336e53fcdfc8d1cc1 75d71dac9d750a6133d23199eaac2882 07944cea6b16d27631915b4619f743da 2e30a0c00bbdb1bbb35ab852ef3b9aec 6b0a8dcc6e9e1abaa3ad62ac0a6c5de7 65de2c3711b769e3fde44a74016fff82 ac46fa8f1797d3b2a726b696e3dea553 0439acee3a45c2a51bc32dd055650b` |
| `expected` | `a401dd37b1c6c6bbe5275677b3989f19 3e0ac946db1d2545de416a30b4d98f44 4e2ed3287b84411c93b154fa0b027f0a` |

---

[← All algorithms](../README.md)
