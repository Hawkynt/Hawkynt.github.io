# SplitMix64

> SplitMix64 is a very fast pseudo-random number generator designed by Guy L. Steele Jr. and Doug Lea. It uses a simple linear congruential update combined with a high-quality 64-bit mixing function. Commonly used to seed other PRNGs like xorshift*.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Guy L. Steele Jr., Doug Lea |
| Year | 2013 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/splitmix64.js`](../../../algorithms/random/splitmix64.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper: Fast Splittable Pseudorandom Number Generators (OOPSLA 2014)](https://dl.acm.org/doi/10.1145/2714064.2660195)
- [Java 8 SplittableRandom Source Code](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/SplittableRandom.java)
- [Reference Implementation (C)](https://github.com/lemire/testingRNG/blob/master/source/splitmix64.h)
- [Wikipedia: SplitMix64](https://en.wikipedia.org/wiki/Pseudorandom_number_generator#SplitMix64)

## References

- [PCG: A Better Random Number Generator](https://www.pcg-random.org/posts/some-prng-implementations.html)
- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 0: First 8 outputs (verified against reference C implementation)](https://prng.di.unimi.it/splitmix64.c)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `e220a8397b1dcdaf6e789e6aa1b965f4 06c45d188009454ff88bb8a8724c81ec 1b39896a51a8749b53cb9f0c747ea2ea 2c829abe1f4532e1c584133ac916ab3c` |

**Vector 2** — [Seed 1: First 5 outputs](https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/util/SplittableRandom.java)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `910a2dec89025cc1beeb8da1658eec67 f893a2eefb32555e71c18690ee42c90b 71bb54d8d101b5b9` |

**Vector 3** — [Seed 42: First 5 outputs (commonly used test seed)](https://prng.di.unimi.it/splitmix64.c)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `bdd732262feb6e9528efe333b266f103 47526757130f9f52581ce1ff0e4ae394 09bc585a244823f2` |

**Vector 4** — [Seed 1234567: First 5 outputs (Rosetta Code test vector)](https://rosettacode.org/wiki/Pseudo-random_numbers/Splitmix64)

| Field | Value |
| --- | --- |
| `seed` | `000000000012d687` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `599ed017fb08fc852c73f08458540fa5 883ebce5a3f27c773fbef740e9177b3f e3b8346708cb5ecd` |

**Vector 5** — [Seed 987654321: First 5 outputs (Rosetta Code test vector)](https://rosettacode.org/wiki/Pseudo-random_numbers/Splitmix64)

| Field | Value |
| --- | --- |
| `seed` | `000000003ade68b1` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `b0de530201a9d17ce0b60b3994b35aa2 e048f39adc9ee4a0867287110e89eb48 bfb28d8c1560f051` |

---

[← All algorithms](../README.md)
