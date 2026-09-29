# Grøstl

> Grøstl is a cryptographic hash function designed as a SHA-3 candidate. Features wide-pipe construction with AES-like design and two permutations (P and Q).

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash |
| Security status | 🎓 Educational Only |
| Complexity | Not specified |
| Inventor | Praveen Gauravaram, Lars R. Knudsen, Krystian Matusiewicz, et al. |
| Year | 2011 |
| Origin | Not specified |
| Source | [`algorithms/hash/groestl.js`](../../../algorithms/hash/groestl.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Grøstl - a SHA-3 candidate](https://www.groestl.info/Groestl.pdf)
- [Grøstl Official Website](https://www.groestl.info/)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)

## References

- [Wide-Pipe Hash Functions](https://eprint.iacr.org/2005/010.pdf)
- [Grøstl NIST SHA-3 Round 3 submission package (reference code and KAT files)](http://www.groestl.info/Groestl.zip)
- [Grøstl implementation guide](http://www.groestl.info/groestl-implementation-guide.pdf)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST SHA-3 Round 3 KAT, Len = 0 (empty message)](http://www.groestl.info/Groestl.zip)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `6d3ad29d279110eef3adbd66de2a0345 a77baede1557f5d099fce0c03d6dc2ba 8e6d4a6633dfbd66053c20faa87d1a11 f39a7fbe4a6c2f009801370308fc4ad8` |

**Vector 2** — [NIST SHA-3 Round 3 KAT, Len = 8 (single byte)](http://www.groestl.info/Groestl.zip)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `b23eeeb675c272c6e37a6ee9ab4dc505 c9d6a10020f6bed3948205d04cdd1e90 b06e494d186ef4f19266d7da200c89dc 009e2b1a538cdea199e773fc076f802e` |

**Vector 3** — [NIST SHA-3 Round 3 KAT, Len = 952 (119 bytes, one padding block)](http://www.groestl.info/Groestl.zip)

| Field | Value |
| --- | --- |
| `input` | `3c9b46450c0f2cae8e3823f8bdb4277f 31b744ce2eb17054bddc6dff36af7f49 fb8a2320cc3bdf8e0a2ea29ad3a55de1 165d219adeddb5175253e2d1489e9b6f dd02e2c3d3a4b54d60e3a47334c37913 c5695378a669e9b72dec32af5434f93f 46176ebf044c4784467c700470d0c0b4 0c8a088c815816` |
| `expected` | `427af58871bec7fadc342e40805abb7b 3e47ab2a4c7fe529ffa20207d7b7f3c1 b53e050ff64498f0ad028fe1f9f4d075 eb88f8a59fa4bc25922a1cd21547b09e` |

**Vector 4** — [NIST SHA-3 Round 3 KAT, Len = 960 (120 bytes, two padding blocks)](http://www.groestl.info/Groestl.zip)

| Field | Value |
| --- | --- |
| `input` | `d1e654b77cb155f5c77971a64df9e5d3 4c26a3cad6c7f6b300d39deb19100946 91adaa095be4ba5d86690a976428635d 5526f3e946f7dc3bd4dbc78999e65344 1187a81f9adcd5a3c5f254bc8256b015 8f54673dcc1232f6e918ebfc6c51ce67 eaeb042d9f57eec4bfe910e169af78b3 de48d137df4f2840` |
| `expected` | `5146d9b44b0bf31099b11835cc8bb4bc 3b6370de7932cd77c6d4468b0a847de1 3758de22f3f223522e7fe9d722ae044b 13012ec5dd7c34a9fa0d3c61cb9398b9` |

**Vector 5** — [NIST SHA-3 Round 3 KAT, Len = 1016 (127 bytes, two padding blocks)](http://www.groestl.info/Groestl.zip)

| Field | Value |
| --- | --- |
| `input` | `a62fc595b4096e6336e53fcdfc8d1cc1 75d71dac9d750a6133d23199eaac2882 07944cea6b16d27631915b4619f743da 2e30a0c00bbdb1bbb35ab852ef3b9aec 6b0a8dcc6e9e1abaa3ad62ac0a6c5de7 65de2c3711b769e3fde44a74016fff82 ac46fa8f1797d3b2a726b696e3dea553 0439acee3a45c2a51bc32dd055650b` |
| `expected` | `f42aa4043d0774e05de406181f2936b7 ba91fb1a68e209174e1d3974abb185c7 9932c5ea4bca3798b68c303b77aa682d f57fed6635201bf01d345782b1fa58c6` |

**Vector 6** — [NIST SHA-3 Round 3 KAT, Len = 1024 (128 bytes, exactly one full block)](http://www.groestl.info/Groestl.zip)

| Field | Value |
| --- | --- |
| `input` | `2b6db7ced8665ebe9deb080295218426 bdaa7c6da9add2088932cdffbaa1c141 29bccdd70f369efb149285858d2b1d15 5d14de2fdb680a8b027284055182a0ca e275234cc9c92863c1b4ab66f304cf06 21cd54565f5bff461d3b461bd40df281 98e3732501b4860eadd503d26d6e6933 8f4e0456e9e9baf3d827ae685fb1d817` |
| `expected` | `ff410b511135dbc0b8644c28efa3ec63 2326feb98e50edc6390c441610d7c514 acdf0a61a0bf01aa9dc1f55d92e08524 8eba1c24ee23978b4986af41c13a6176` |

---

[← All algorithms](../README.md)
