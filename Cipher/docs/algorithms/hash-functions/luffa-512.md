# Luffa-512

> SHA-3 candidate hash function producing 512-bit outputs using 5 parallel state chains with a sponge-like construction. Eliminated in round 2 of the NIST SHA-3 competition.

## Properties

| Property | Value |
| --- | --- |
| Category | Hash Functions |
| Sub-category | Cryptographic Hash |
| Security status | 📰 Obsolete |
| Complexity | Advanced |
| Inventor | Christophe De Cannière, Hisayoshi Sato, Dai Watanabe |
| Year | 2008 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/hash/luffa.js`](../../../algorithms/hash/luffa.js) |

## Security

**Status:** 📰 Obsolete

No vulnerabilities are recorded for this implementation.

## Documentation

- [Luffa SHA-3 Submission (Hitachi)](https://www.hitachi.com/rd/yrl/crypto/luffa/)
- [Luffa Submission Package (NIST SHA-3 Round 2)](https://csrc.nist.gov/CSRC/media/Projects/Hash-Functions/documents/Luffa_Round2.zip)
- [sphlib Reference Implementation](https://github.com/pornin/sphlib/blob/master/c/luffa.c)
- [NIST SHA-3 Competition](https://csrc.nist.gov/projects/hash-functions/sha-3-project)

## References

- [sphlib test vectors (test_luffa.c)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [NIST Vector (0 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `6e7de4501189b3ca58f3ac114916654b bcd4922024b4cc1cd764acfe8ab4b780 5df133eab345ffdb1c414564c924f48e 0a301824e2ac4c34bd4efde2e43da90e` |

**Vector 2** — [NIST Vector (8 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `91f1b09b2842871bc2f069e5d278d2d7 07ddafabfe3ced5154faf841e9678190 8290e6533d146183e8b7ec298f6da20e 0cfb1d41f4f711a3050faa8dd4641f7f` |

**Vector 3** — [NIST Vector (16 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `41fb` |
| `expected` | `3448d8766e1c8cf84ca83d0882305a8e bcab3f9c5b87f8f1bb94ec8abbe86320 e6d33024fbe9363595ed3b36bf49a544 0a1248f0606940aec1321fc74dbb6be5` |

**Vector 4** — [NIST Vector (24 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `1f877c` |
| `expected` | `327ed73e847b90a1d098250020e45915 ce4991b686e3920043ab17f026b2d3c7 7f9fed996673d527e4a1f628fb2f4f05 949d3eabb0b00d9967063877e4370015` |

**Vector 5** — [NIST Vector (32 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `c1ecfdfc` |
| `expected` | `d6c06a024d386a58a01d9c5852229593 f2197bd9f3afc9eb3f3230807d99c06d 8eeb7aa36d7eea74fda69ec135619198 5cadedb24bf0c312ba1db9e974442b16` |

---

[← All algorithms](../README.md)
