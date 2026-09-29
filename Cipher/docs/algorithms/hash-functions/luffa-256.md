# Luffa-256

> SHA-3 candidate hash function producing 256-bit outputs using 3 parallel state chains with a sponge-like construction. Eliminated in round 2 of the NIST SHA-3 competition.

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
| `expected` | `dbb8665871f4154d3e4396aefbba417cb7837dd683c332ba6be87e02a2712d6f` |

**Vector 2** — [NIST Vector (8 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `e47d4158bfe03555d370d8fd877ead17d6aa9fdc689a9614c411fbba370c1706` |

**Vector 3** — [NIST Vector (16 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `41fb` |
| `expected` | `08cbdd1c9caea9711ab2b30b872ddc09f2954b98ac1850abe3f648f11b76bf92` |

**Vector 4** — [NIST Vector (24 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `1f877c` |
| `expected` | `a590d4995c909abd9150398d4ab9465a8e9f768c576921c26a998857e7b0a604` |

**Vector 5** — [NIST Vector (32 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `c1ecfdfc` |
| `expected` | `25c82f898f66355aba7a6215d07cab27fbeeedd16b52aa910040b40fda859981` |

---

[← All algorithms](../README.md)
