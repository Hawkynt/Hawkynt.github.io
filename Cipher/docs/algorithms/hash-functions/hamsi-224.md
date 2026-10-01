# Hamsi-224

> SHA-3 candidate hash function with 224-bit output. Uses a Serpent-inspired non-linear permutation with a linear-code based message expansion in a concatenation-truncation construction. Two incompatible versions were published: the specification and the official NIST KAT encode the designer's name in the IV wrongly, while sphlib and the libraries derived from it use the correct UTF-8 encoding. The variant property selects "specification" or "sphlib" (default).

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
| Output sizes | 28 bytes (224 bits) |

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

**Vector 1** — [Specification version: NIST round-2 KAT ShortMsgKAT_224.txt, Len = 0](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | _(empty)_ |
| `expected` | `6f5708887722a92764a4d55527feaeba32f297f05d35a8276301d508` |

**Vector 2** — [Specification version: NIST round-2 KAT ShortMsgKAT_224.txt, Len = 8](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | `cc` |
| `expected` | `fc1c9369ac35b331eda60812a9f51e9e189b5f5a699456d8ed89539f` |

**Vector 3** — [Specification version: NIST round-2 KAT ShortMsgKAT_224.txt, Len = 512](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | `e926ae8b0af6e53176dbffcc2a6b88c6 bd765f939d3d178a9bde9ef3aa131c61 e31c1e42cdfaf4b4dcde579a37e150ef bef5555b4c1cb40439d835a724e2fae7` |
| `expected` | `ee0ecdd2ce0553b60a7803416de7e9a5feb381e836c0bfa0bd6f2583` |

**Vector 4** — [sphlib version: test_hamsi.c nist_vec224[0] (NIST message, Len = 0)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | _(empty)_ |
| `expected` | `b9f6eb1a9b990373f9d2cb125584333c69a3d41ae291845f05da221f` |

**Vector 5** — [sphlib version: test_hamsi.c nist_vec224[24] (NIST message, Len = 24)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | `1f877c` |
| `expected` | `15a0b54528fe0f765b50bd340bfb36ae32f106e305aec3b2f42cbec5` |

**Vector 6** — [sphlib version: test_hamsi.c nist_vec224[1016] (NIST message, Len = 1016)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | `a62fc595b4096e6336e53fcdfc8d1cc1 75d71dac9d750a6133d23199eaac2882 07944cea6b16d27631915b4619f743da 2e30a0c00bbdb1bbb35ab852ef3b9aec 6b0a8dcc6e9e1abaa3ad62ac0a6c5de7 65de2c3711b769e3fde44a74016fff82 ac46fa8f1797d3b2a726b696e3dea553 0439acee3a45c2a51bc32dd055650b` |
| `expected` | `6d30b7cd15b0c6de05f23d7c08dc44fb2f58b5b06c4f02daf2f73408` |

---

[← All algorithms](../README.md)
