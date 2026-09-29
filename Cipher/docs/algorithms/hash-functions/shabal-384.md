# Shabal-384

> Shabal-384 is a cryptographic hash function submitted to the NIST SHA-3 competition by the Saphir project. It advanced to the second round but was not selected as a finalist. Three registers and a block counter are mixed by a forty-eight step permutation over each 512-bit block.

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
| Output sizes | 48 bytes (384 bits) |
| Hash sizes | 48 bytes (384 bits) |

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
| `expected` | `ff093d67d22b06a674b5f384719150d6 17e0ff9c8923569a2ab60cda886df63c 91a25f33cd71cc22c9eebc5cd6aee52a` |

**Vector 2** — [NIST SHA-3 KAT Len=8 - one byte](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `da6e116f4fc2740abb1308089251582e 516c1b0da5e56492126e3aa8fe4be1a9 ce5d58514cf32a5c1bd9211b535acfb5` |

**Vector 3** — [NIST SHA-3 KAT Len=504 - 63 bytes, one under the block size](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `f57c64006d9ea761892e145c99df1b24 640883da79d9ed5262859dcda8c3c32e 05b03d984f1ab4a230242ab6b78d368d c5aaa1e6d3498d53371e84b0c1d4ba` |
| `expected` | `5d08a206824624183efe7d76e127b6d3 b126ce879de7c286235b7bf875b27665 358741dd61afdbbb333cf4bfcad9f89e` |

**Vector 4** — [NIST SHA-3 KAT Len=512 - 64 bytes, exactly the block size, forcing an all-padding block](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `e926ae8b0af6e53176dbffcc2a6b88c6 bd765f939d3d178a9bde9ef3aa131c61 e31c1e42cdfaf4b4dcde579a37e150ef bef5555b4c1cb40439d835a724e2fae7` |
| `expected` | `166c63e8bbe2af4310ab59b8707f82a0 e9c3947a434bfd409db486e25d33c989 4ee0d232a078a5280182fc75d67bc9b1` |

**Vector 5** — [NIST SHA-3 KAT Len=520 - 65 bytes, one over the block size](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `16e8b3d8f988e9bb04de9c96f2627811 c973ce4a5296b4772ca3eefeb80a652b df21f50df79f32db23f9f73d393b2d57 d9a0297f7a2f2e79cfda39fa393df1ac 00` |
| `expected` | `33d1a460b27ed08d9fe19a35bb60df4b 7a239ce26a66e7f0ddb6b358fde925b2 5bb5adf0307fc4324b4286221b1bf965` |

**Vector 6** — [NIST SHA-3 KAT Len=1016 - 127 bytes, one under two blocks](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `a62fc595b4096e6336e53fcdfc8d1cc1 75d71dac9d750a6133d23199eaac2882 07944cea6b16d27631915b4619f743da 2e30a0c00bbdb1bbb35ab852ef3b9aec 6b0a8dcc6e9e1abaa3ad62ac0a6c5de7 65de2c3711b769e3fde44a74016fff82 ac46fa8f1797d3b2a726b696e3dea553 0439acee3a45c2a51bc32dd055650b` |
| `expected` | `070dc6a175ef1fe6fe6bc8187371890e cbdeaca2c747ea5cba48535ea0078665 2b6db1cf14fdb7b4917f8b6d45cf4220` |

**Vector 7** — [NIST SHA-3 KAT Len=1024 - 128 bytes, an exact multiple of the block size](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `2b6db7ced8665ebe9deb080295218426 bdaa7c6da9add2088932cdffbaa1c141 29bccdd70f369efb149285858d2b1d15 5d14de2fdb680a8b027284055182a0ca e275234cc9c92863c1b4ab66f304cf06 21cd54565f5bff461d3b461bd40df281 98e3732501b4860eadd503d26d6e6933 8f4e0456e9e9baf3d827ae685fb1d817` |
| `expected` | `03a37aa2fdf6c8bb11c3e760ec3fe533 ef72807c39fd6e83c73669f44ec70bea 67fdbaba02fad35c43a9e067b1794138` |

---

[← All algorithms](../README.md)
