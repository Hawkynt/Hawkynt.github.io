# Hamsi-256

> SHA-3 candidate hash function with 256-bit output. Uses a Serpent-inspired non-linear permutation with a linear-code based message expansion in a concatenation-truncation construction. Known distinguishers exist against the compression function and output transformation.

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
| Output sizes | 32 bytes (256 bits) |

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

**Vector 1** — [Specification version: NIST round-2 KAT ShortMsgKAT_256.txt, Len = 0](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | _(empty)_ |
| `expected` | `750e9ec469f4db626bee7e0c10ddaa1bd01fe194b94efbabebd24764dc2b13e9` |

**Vector 2** — [Specification version: NIST round-2 KAT ShortMsgKAT_256.txt, Len = 8](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | `cc` |
| `expected` | `ac2dac2a6ddaf703b7a55745d61b1a16a3d1bf1f74caab265a2e5dbebcf60832` |

**Vector 3** — [Specification version: NIST round-2 KAT ShortMsgKAT_256.txt, Len = 512](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | `e926ae8b0af6e53176dbffcc2a6b88c6 bd765f939d3d178a9bde9ef3aa131c61 e31c1e42cdfaf4b4dcde579a37e150ef bef5555b4c1cb40439d835a724e2fae7` |
| `expected` | `4b24b386d53085883656f1edadf10532ea11f369aa6952d6559cb90c80f8e96d` |

**Vector 4** — [sphlib version: test_hamsi.c nist_vec256[0] (NIST message, Len = 0)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | _(empty)_ |
| `expected` | `750e9ec469f4db626bee7e0c10ddaa1bd01fe194b94efbabebd24764dc2b13e9` |

**Vector 5** — [sphlib version: test_hamsi.c nist_vec256[24] (NIST message, Len = 24)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | `1f877c` |
| `expected` | `cb596913e691f8654a613e24debf3262e6477fd737d5c422e670e0c75fae7d17` |

**Vector 6** — [sphlib version: test_hamsi.c nist_vec256[1016] (NIST message, Len = 1016)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | `a62fc595b4096e6336e53fcdfc8d1cc1 75d71dac9d750a6133d23199eaac2882 07944cea6b16d27631915b4619f743da 2e30a0c00bbdb1bbb35ab852ef3b9aec 6b0a8dcc6e9e1abaa3ad62ac0a6c5de7 65de2c3711b769e3fde44a74016fff82 ac46fa8f1797d3b2a726b696e3dea553 0439acee3a45c2a51bc32dd055650b` |
| `expected` | `5fe8991b5ca9547c156197c9f797296b09690599c75aa0acbd4fa0c54c09f020` |

---

[← All algorithms](../README.md)
