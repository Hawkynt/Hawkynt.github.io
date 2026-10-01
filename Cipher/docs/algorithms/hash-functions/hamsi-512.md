# Hamsi-512

> SHA-3 candidate hash function with 512-bit output. Uses a Serpent-inspired non-linear permutation with a linear-code based message expansion in a concatenation-truncation construction.

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
| Output sizes | 64 bytes (512 bits) |

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

**Vector 1** — [Specification version: NIST round-2 KAT ShortMsgKAT_512.txt, Len = 0](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | _(empty)_ |
| `expected` | `5cd7436a91e27fc809d7015c34075406 33dab391127113ce6ba360f0c1e35f40 4510834a551610d6e871e75651ea381a 8ba628af1dcf2b2be13af2eb6247290f` |

**Vector 2** — [Specification version: NIST round-2 KAT ShortMsgKAT_512.txt, Len = 8](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | `cc` |
| `expected` | `7da1be62a813a8e24d200671cffb1d0b e79d2bc176ff0b163b11eded2414ef66 261ff52c745383442bc7f1884d5166f2 6f41d335fc2d2fdb2f93b24b8d079265` |

**Vector 3** — [Specification version: NIST round-2 KAT ShortMsgKAT_512.txt, Len = 512](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Hamsi_Round2.zip)

| Field | Value |
| --- | --- |
| `variant` | specification |
| `input` | `e926ae8b0af6e53176dbffcc2a6b88c6 bd765f939d3d178a9bde9ef3aa131c61 e31c1e42cdfaf4b4dcde579a37e150ef bef5555b4c1cb40439d835a724e2fae7` |
| `expected` | `3f8531a92159c5790fa3a0d2a4095a19 b25c263ebadc931bc6c88868d8b15683 93e722dfd5ce5842d044604c3a357e8a 4bb6ef9299049c3c83398a8b2ab4bba9` |

**Vector 4** — [sphlib version: test_hamsi.c nist_vec512[0] (NIST message, Len = 0)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | _(empty)_ |
| `expected` | `5cd7436a91e27fc809d7015c34075406 33dab391127113ce6ba360f0c1e35f40 4510834a551610d6e871e75651ea381a 8ba628af1dcf2b2be13af2eb6247290f` |

**Vector 5** — [sphlib version: test_hamsi.c nist_vec512[24] (NIST message, Len = 24)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | `1f877c` |
| `expected` | `af015a97b6996ed048f32b3a6c209e6a 2daeacd4f61eb62eaa31c68328ee5790 b0681245ebe1ecec4c0dd7f9008672d2 8a0424406998ec02518f023b3c27dcde` |

**Vector 6** — [sphlib version: test_hamsi.c nist_vec512[1016] (NIST message, Len = 1016)](https://github.com/pornin/sphlib/blob/master/c/test_hamsi.c)

| Field | Value |
| --- | --- |
| `variant` | sphlib |
| `input` | `a62fc595b4096e6336e53fcdfc8d1cc1 75d71dac9d750a6133d23199eaac2882 07944cea6b16d27631915b4619f743da 2e30a0c00bbdb1bbb35ab852ef3b9aec 6b0a8dcc6e9e1abaa3ad62ac0a6c5de7 65de2c3711b769e3fde44a74016fff82 ac46fa8f1797d3b2a726b696e3dea553 0439acee3a45c2a51bc32dd055650b` |
| `expected` | `b39be99df905e73ef94ee8a47cdced6c f3a9dbdbf29d35c7bcabadebcd98cd15 219082ac5f25ac0da65b6437146c9cec dbbb89299bd00e3b3fdf51de479de23b` |

---

[← All algorithms](../README.md)
