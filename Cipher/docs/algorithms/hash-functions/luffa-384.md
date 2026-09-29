# Luffa-384

> SHA-3 candidate hash function producing 384-bit outputs using 4 parallel state chains with a sponge-like construction. Eliminated in round 2 of the NIST SHA-3 competition.

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
| `expected` | `117d3ad49024dfe2994f4e335c9b330b 48c537a13a9b7fa465938e1a02ff862b cdf33838bc0f371b045d26952d3ea0c5` |

**Vector 2** — [NIST Vector (8 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `cc` |
| `expected` | `e1979d16848976ca9ff183ec28998ab3 d4b56942497f8e2c6d51895a96c7465d f6d7b66d6ba9636a16dbe51aae6d2eb9` |

**Vector 3** — [NIST Vector (16 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `41fb` |
| `expected` | `836e9c8429d4a071935c72b0e575ea4c ca81642dc14a98a87307e02ac2d81268 2ce3eeaf8043330a7ea5cbe3a578b5d2` |

**Vector 4** — [NIST Vector (24 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `1f877c` |
| `expected` | `0aff61867c087908d2b9742012bb980c ae833c79fd4ecaaea31bc1279f4ce356 d6308c36d1fd0dbe70f652b0e2c66d35` |

**Vector 5** — [NIST Vector (32 bits)](https://github.com/pornin/sphlib/blob/master/c/test_luffa.c)

| Field | Value |
| --- | --- |
| `input` | `c1ecfdfc` |
| `expected` | `3736466ca7dc43a81025378e6ce678fe 010ebb06382a73113af39104cea0f9bf 00e27d12e0a1e7f37516e5cd0f2e9752` |

---

[← All algorithms](../README.md)
