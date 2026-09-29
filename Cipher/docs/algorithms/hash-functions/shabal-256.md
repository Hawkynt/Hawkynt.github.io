# Shabal-256

> Shabal-256 is a cryptographic hash function submitted to the NIST SHA-3 competition by the Saphir project. It advanced to the second round but was not selected as a finalist. Three registers and a block counter are mixed by a forty-eight step permutation over each 512-bit block.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | SHA-3 Candidate |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Emmanuel Bresson, Anne Canteaut, Benoit Chevallier-Mames, Christophe Clavier, Thomas Fuhr, Aline Gouget, Thomas Icart, Jean-Francois Misarsky, Maria Naya-Plasencia, Pascal Paillier, Thomas Pornin, Jean-Rene Reinhard, Celine Thuillet, Marion Videau |
| Year | 2008 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/hash/shabal.js`](../../../algorithms/hash/shabal.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Output sizes | 32 bytes (256 bits) |
| Hash sizes | 32 bytes (256 bits) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Distinguisher on the keyed permutation | Non-random behaviour was shown for the internal permutation during the SHA-3 second round; no attack on the hash function itself followed, but the result contributed to Shabal not advancing. | — |

## Documentation

- [Shabal Specification](https://csrc.nist.gov/CSRC/media/Projects/Cryptographic-Standards-and-Guidelines/documents/sha-3/documents/Shabal.pdf)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)
- [Wikipedia - Shabal](https://en.wikipedia.org/wiki/Shabal)

## References

- [sphlib reference implementation and vectors](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)
- [RustCrypto Shabal Implementation](https://github.com/RustCrypto/hashes/tree/master/shabal)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST SHA-3 KAT Len=0 - empty message](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `aec750d11feee9f16271922fbaf5a9be142f62019ef8d720f858940070889014` |

**Vector 2** — [NIST SHA-3 KAT Len=8 - one byte](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `f52e6a62fa8a0e0fcdea5e12800c3b4301a0bf8b0f897bbe7685cdc659fdd3f8` |

**Vector 3** — [NIST SHA-3 KAT Len=504 - 63 bytes, one under the block size](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `f57c64006d9ea761892e145c99df1b24 640883da79d9ed5262859dcda8c3c32e 05b03d984f1ab4a230242ab6b78d368d c5aaa1e6d3498d53371e84b0c1d4ba` |
| `expected` | `cc91d63fda30dcaa3efb6e580ef74fe5f343897234af3b5902462764fe2a905a` |

**Vector 4** — [NIST SHA-3 KAT Len=512 - 64 bytes, exactly the block size, forcing an all-padding block](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `e926ae8b0af6e53176dbffcc2a6b88c6 bd765f939d3d178a9bde9ef3aa131c61 e31c1e42cdfaf4b4dcde579a37e150ef bef5555b4c1cb40439d835a724e2fae7` |
| `expected` | `1303d2ba5fbaf789c0ed488b07b6a542371780231204ab72398a106a7355e3af` |

**Vector 5** — [NIST SHA-3 KAT Len=520 - 65 bytes, one over the block size](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `16e8b3d8f988e9bb04de9c96f2627811 c973ce4a5296b4772ca3eefeb80a652b df21f50df79f32db23f9f73d393b2d57 d9a0297f7a2f2e79cfda39fa393df1ac 00` |
| `expected` | `596d27ef127e129d77b27a26b3a6bbe661cfe4ec11e98a028accbc2fa0435b99` |

**Vector 6** — [NIST SHA-3 KAT Len=1016 - 127 bytes, one under two blocks](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `a62fc595b4096e6336e53fcdfc8d1cc1 75d71dac9d750a6133d23199eaac2882 07944cea6b16d27631915b4619f743da 2e30a0c00bbdb1bbb35ab852ef3b9aec 6b0a8dcc6e9e1abaa3ad62ac0a6c5de7 65de2c3711b769e3fde44a74016fff82 ac46fa8f1797d3b2a726b696e3dea553 0439acee3a45c2a51bc32dd055650b` |
| `expected` | `6eea046c1a389cc93f1cdb783c9da0ac4a38c8f65abe51cca7eec23571b49897` |

**Vector 7** — [NIST SHA-3 KAT Len=1024 - 128 bytes, an exact multiple of the block size](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `2b6db7ced8665ebe9deb080295218426 bdaa7c6da9add2088932cdffbaa1c141 29bccdd70f369efb149285858d2b1d15 5d14de2fdb680a8b027284055182a0ca e275234cc9c92863c1b4ab66f304cf06 21cd54565f5bff461d3b461bd40df281 98e3732501b4860eadd503d26d6e6933 8f4e0456e9e9baf3d827ae685fb1d817` |
| `expected` | `ddc4eebe6d8ba774e2bb53130bf0447b0158ba0475a13e1d35dd09c740cf00ca` |

---

[← All algorithms](../README.md)
