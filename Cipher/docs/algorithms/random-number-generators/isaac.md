# ISAAC

> ISAAC (Indirection, Shift, Accumulate, Add, Count) is a cryptographically secure PRNG designed by Bob Jenkins. Features 8KB internal state, extremely long period (minimum 2^40, average 2^8295), and high performance.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Cryptographic PRNG |
| Security status | 🧪 Experimental |
| Complexity | Intermediate |
| Inventor | Bob Jenkins |
| Year | 1996 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/isaac.js`](../../../algorithms/random/isaac.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 0 bytes (0 bits) to 1024 bytes (8192 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | Yes |

## Security

**Status:** 🧪 Experimental

No vulnerabilities are recorded for this implementation.

## Documentation

- [ISAAC Homepage - Bob Jenkins](https://www.burtleburtle.net/bob/rand/isaacafa.html)
- [ISAAC Paper - Fast Software Encryption 1996](https://www.burtleburtle.net/bob/rand/isaac.html)
- [BouncyCastle Reference Implementation](https://github.com/bcgit/bc-java/blob/main/core/src/main/java/org/bouncycastle/crypto/engines/ISAACEngine.java)

## References

- [Wikipedia: ISAAC (cipher)](https://en.wikipedia.org/wiki/ISAAC_(cipher))
- [Bob Jenkins' Random Number Page](https://www.burtleburtle.net/bob/rand/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BouncyCastle Test Vector #1 - Key: 00000000 (4 bytes)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ISAACTest.java)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `outputSize` | `2048` |
| `input` | `null` |
| `expected` | `f650e4c8e448e96d98db2fb4f5fad54f 433f1afbedec154ad837048746ca4f9a 5de3743e88381097f1d444eb823cedb6 6a83e1e04a5f6355c744243325890e2e …` (2048 bytes; the full value is in the source) |

**Vector 2** — [BouncyCastle Test Vector #2 - Key: FFFFFFFF (4 bytes)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ISAACTest.java)

| Field | Value |
| --- | --- |
| `seed` | `ffffffff` |
| `outputSize` | `288` |
| `input` | `null` |
| `expected` | `de3b3f3c19e0629c1fc8b7836695d523 e7804edd86ff7ce9b106f52caebae9d9 72f845d49ce17d7da44e49bae954aac0 d0b1284b98a88eec1524fb6bc91a16b5 …` (288 bytes; the full value is in the source) |

**Vector 3** — [BouncyCastle Test Vector #3 - Key: FFFF0000 pattern (1024 bytes)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ISAACTest.java)

| Field | Value |
| --- | --- |
| `seed` | `ffff0000ffff0000ffff0000ffff0000 ffff0000ffff0000ffff0000ffff0000 ffff0000ffff0000ffff0000ffff0000 ffff0000ffff0000ffff0000ffff0000 …` (1024 bytes; the full value is in the source) |
| `outputSize` | `576` |
| `input` | `null` |
| `expected` | `26c54b1f8c4e3fc582e9e8180f7aba53 80463dcf58b03cbeda0ecc8ba90ccff8 5bd50896313d7efed44015faeac6964b 241a7fb8a2e37127a7cbea0fd7c020f2 …` (576 bytes; the full value is in the source) |

**Vector 4** — [BouncyCastle Test Vector #4 - Key: 0000FFFF pattern (1024 bytes)](https://github.com/bcgit/bc-java/blob/main/core/src/test/java/org/bouncycastle/crypto/test/ISAACTest.java)

| Field | Value |
| --- | --- |
| `seed` | `0000ffff0000ffff0000ffff0000ffff 0000ffff0000ffff0000ffff0000ffff 0000ffff0000ffff0000ffff0000ffff 0000ffff0000ffff0000ffff0000ffff …` (1024 bytes; the full value is in the source) |
| `outputSize` | `576` |
| `input` | `null` |
| `expected` | `bc31712f2a2f467a5abc737c57ce0f8d 49d2f775eb850fc8f856daf19310fee2 5bab40e78403c9ef4ccd971418992faf 4e85ca643fa6b482f30c4659066158a6 …` (576 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
