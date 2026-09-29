# Wichmann-Hill

> Combined random number generator using three Linear Congruential Generators with large prime moduli near 2^64. This modernized variant improves upon the original 1982 AS183 algorithm by using 64-bit arithmetic and larger primes, providing an extremely long period and better statistical properties than simple LCGs.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudorandom Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Brian Wichmann and David Hill |
| Year | 1982 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/random/wichmann-hill.js`](../../../algorithms/random/wichmann-hill.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 32 bytes (256 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Wichmann, B.A. and Hill, I.D. (1982): Algorithm AS 183: An Efficient and Portable Pseudo-random Number Generator (Applied Statistics 31:188-190)](https://www.jstor.org/stable/2347988)
- [McLeod, A.I. (1985): Remark AS R58: A Remark on Algorithm AS 183 (Applied Statistics 34:198-200)](https://www.jstor.org/stable/2347378)
- [Wikipedia: Wichmann-Hill Generator](https://en.wikipedia.org/wiki/Wichmann%E2%80%93Hill)

## References

- [Original AS183 Paper - Applied Statistics](https://academic.oup.com/jrsssc/article-abstract/31/2/188/6963832)
- [Wichmann-Hill Implementation Guide](https://people.sc.fsu.edu/~jburkardt/m_src/asa183/asa183.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Modernized 64-bit variant, seed=1 - First 5 values (8 bytes each)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `0657c71cd00132e59be711b3d64ccd31 a5c923bdd09ac22a4ec5b77f8af1e2a8 164d1e21fc54f174` |

**Vector 2** — [Modernized 64-bit variant, seed=42 - First 5 values (8 bytes each)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `2b77e25e13f294543f54be2cb9ed2c4b 9753deeaedce96af456610eb40b08e51 5a4bf254af2dd91b` |

**Vector 3** — [Modernized 64-bit variant, seed=12345 - First 5 values (8 bytes each)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000003039` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `b60daf6198914a4e0e408acd97013b5b 7f61c25c0fb4e029a647db70cc8d51ea 1a632a25e20f99a6` |

**Vector 4** — [Modernized 64-bit variant, seed=1000000 - First 5 values (8 bytes each)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `00000000000f4240` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `321e08c3a86eb0b0de16241ceed7a4f1 b99dafa2c41ec0c856b8244ab00a908c 731d999437b7ba88` |

**Vector 5** — [Modernized 64-bit variant, seed=0xDEADBEEF - First 5 values (8 bytes each)](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `00000000deadbeef` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `40c8cd72a36b85bb0a9004ff6b8dedb3 0a88e02dbbd1b206ebabb900fc54a2c9 bd136837299fd960` |

---

[← All algorithms](../README.md)
