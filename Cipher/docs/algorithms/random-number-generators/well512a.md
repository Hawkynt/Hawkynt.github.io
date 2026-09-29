# WELL512a

> WELL (Well Equidistributed Long-period Linear) is a family of pseudo-random number generators designed to improve upon Mersenne Twister's equidistribution properties. WELL512a has a period of 2^512-1 and better performance in statistical tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | François Panneton, Pierre L'Ecuyer, Makoto Matsumoto |
| Year | 2006 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/random/well.js`](../../../algorithms/random/well.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 128 bytes (1024 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper: Improved Long-Period Generators Based on Linear Recurrences Modulo 2 (ACM TOMS 2006)](https://dl.acm.org/doi/10.1145/1132973.1132974)
- [WELL Random Number Generators - Official Page](http://www.iro.umontreal.ca/~panneton/WELLRNG.html)
- [Wikipedia: WELL PRNG](https://en.wikipedia.org/wiki/Well_equidistributed_long-period_linear)
- [Reference Implementation Discussion](https://www.lomont.org/posts/2008/random-number-generation/)

## References

- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [Comparison with Mersenne Twister](https://en.wikipedia.org/wiki/Mersenne_Twister#Comparison_with_WELL)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [WELL512a with seed 0: First 10 outputs (32-bit values)](https://github.com/Hawkynt/Randomizer (Reference C# Implementation Pattern))

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `87444164a8607ff9624d61346854fe55 7283578efd970258c78bac851a0fe687 48935f9b5c57c8f9` |

**Vector 2** — [WELL512a with seed 1: First 10 outputs](https://github.com/Hawkynt/Randomizer (Reference C# Implementation Pattern))

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `c7798c5c7229bbe39682a4ffc440c989 053f46bfdd305a688e2be560d398fc58 739f16364958d47e` |

**Vector 3** — [WELL512a with seed 42: First 8 outputs (common test seed)](https://github.com/Hawkynt/Randomizer (Reference C# Implementation Pattern))

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `536aad71d41b1b0565f1897e75290c673bf21b5f6a4c54d447944ab981c19822` |

**Vector 4** — [WELL512a with seed 123456789: First 5 outputs](https://github.com/Hawkynt/Randomizer (Reference C# Implementation Pattern))

| Field | Value |
| --- | --- |
| `seed` | `00000000075bcd15` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `6a9c9afe9c8a2699b868fd39f4118aa1dec59614` |

---

[← All algorithms](../README.md)
