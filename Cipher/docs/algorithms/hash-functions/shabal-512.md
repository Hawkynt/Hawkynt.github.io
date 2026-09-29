# Shabal-512

> Shabal-512 is a cryptographic hash function submitted to the NIST SHA-3 competition by the Saphir project. It advanced to the second round but was not selected as a finalist. Three registers and a block counter are mixed by a forty-eight step permutation over each 512-bit block.

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
| Output sizes | 64 bytes (512 bits) |
| Hash sizes | 64 bytes (512 bits) |

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
| `expected` | `fc2d5dff5d70b7f6b1f8c2fcc8c1f9fe 9934e54257eded0cf2b539a2ef0a19cc ffa84f8d9fa135e4bd3c09f590f3a927 ebd603ac29eb729e6f2a9af031ad8dc6` |

**Vector 2** — [NIST SHA-3 KAT Len=8 - one byte](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `da2621ac83fa9ed23e2fd977cdba8906 492e7c9405940974a4017c61a9615bb3 2a3ec0ff89937b58395168b012175973 dea0def7b4412c4c1ed80e5b2d9a6ad0` |

**Vector 3** — [NIST SHA-3 KAT Len=504 - 63 bytes, one under the block size](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `f57c64006d9ea761892e145c99df1b24 640883da79d9ed5262859dcda8c3c32e 05b03d984f1ab4a230242ab6b78d368d c5aaa1e6d3498d53371e84b0c1d4ba` |
| `expected` | `73981b87c3038e99d2c863729315aea3 d0294904a6d6f0e4c3c2a28d2a503ed8 35b68f2f4407c99205fa08b2d6067633 abc03cfa921dc61b55f9d1671cbe3257` |

**Vector 4** — [NIST SHA-3 KAT Len=512 - 64 bytes, exactly the block size, forcing an all-padding block](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `e926ae8b0af6e53176dbffcc2a6b88c6 bd765f939d3d178a9bde9ef3aa131c61 e31c1e42cdfaf4b4dcde579a37e150ef bef5555b4c1cb40439d835a724e2fae7` |
| `expected` | `ec6dbea0c9817a4a29b91e55358da61a 9bf6938d5464190f82e48d1c8adc5cde ee3f0b3c6d37ee097db55a725c20282d 3b6ddfbc00c57bd8f375536dfdfba36c` |

**Vector 5** — [NIST SHA-3 KAT Len=520 - 65 bytes, one over the block size](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `16e8b3d8f988e9bb04de9c96f2627811 c973ce4a5296b4772ca3eefeb80a652b df21f50df79f32db23f9f73d393b2d57 d9a0297f7a2f2e79cfda39fa393df1ac 00` |
| `expected` | `0e7ef0baa779ca25aec58208794c881b 2a6a6d1d9d428e77230ef3d810bd6d26 c0fc903ca69a76879e42b9a2f7fd6dd8 bd24ea9ad3494cab4c91e68d557b559d` |

**Vector 6** — [NIST SHA-3 KAT Len=1016 - 127 bytes, one under two blocks](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `a62fc595b4096e6336e53fcdfc8d1cc1 75d71dac9d750a6133d23199eaac2882 07944cea6b16d27631915b4619f743da 2e30a0c00bbdb1bbb35ab852ef3b9aec 6b0a8dcc6e9e1abaa3ad62ac0a6c5de7 65de2c3711b769e3fde44a74016fff82 ac46fa8f1797d3b2a726b696e3dea553 0439acee3a45c2a51bc32dd055650b` |
| `expected` | `426f43d642d488abe1b8df01a3360f25 02cef215ef054627a36866f288a4d3eb 6f8f6a235247570a8ed4d33dd0419d8f 468c8f424e72ae9faa0be929e7824f78` |

**Vector 7** — [NIST SHA-3 KAT Len=1024 - 128 bytes, an exact multiple of the block size](https://github.com/pornin/sphlib/blob/master/c/test_shabal.c)

| Field | Value |
| --- | --- |
| `input` | `2b6db7ced8665ebe9deb080295218426 bdaa7c6da9add2088932cdffbaa1c141 29bccdd70f369efb149285858d2b1d15 5d14de2fdb680a8b027284055182a0ca e275234cc9c92863c1b4ab66f304cf06 21cd54565f5bff461d3b461bd40df281 98e3732501b4860eadd503d26d6e6933 8f4e0456e9e9baf3d827ae685fb1d817` |
| `expected` | `523d5356af034b0539cdb3f793451672 24a4869d19d57ba5f7b5bfecf5b6a4e6 b4a88dd2ace88e692c30610ed80753f3 4baf67ca5bf2698d711b95b77dea58f0` |

---

[← All algorithms](../README.md)
