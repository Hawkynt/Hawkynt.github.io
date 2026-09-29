# Xoshiro256**

> Xoshiro256** is an all-purpose, rock-solid, small-state pseudo-random number generator with excellent speed and statistical properties. It features a 256-bit state, passes all statistical tests, and uses multiplication-based scrambler (star-star) for output function.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Non-Cryptographic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | David Blackman, Sebastiano Vigna |
| Year | 2018 |
| Origin | 🇮🇹 Italy |
| Source | [`algorithms/random/xoshiro256starstar.js`](../../../algorithms/random/xoshiro256starstar.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official Reference Implementation](http://prng.di.unimi.it/xoshiro256starstar.c)
- [xoshiro / xoroshiro generators and the PRNG shootout](https://prng.di.unimi.it/)
- [Original Paper: Scrambled Linear Pseudorandom Number Generators (2018)](https://arxiv.org/pdf/1805.01407)

## References

- [Wikipedia: Xoroshiro128+](https://en.wikipedia.org/wiki/Xoroshiro128+)
- [PCG: A Quick Look at Xoshiro256**](https://www.pcg-random.org/posts/a-quick-look-at-xoshiro256.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=0: First four 64-bit outputs from xoshiro256**](http://prng.di.unimi.it/xoshiro256starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `b4f275cb365fec992a455649781f6ebfe0e633499d845f1a2c2d2d26f194a56a` |

**Vector 2** — [Seed=1: First four 64-bit outputs from xoshiro256**](http://prng.di.unimi.it/xoshiro256starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `c510c70f6daff2b3ea4c364796553b8514452a085697f892a7a366c27b1c2e64` |

**Vector 3** — [Seed=12345: First four 64-bit outputs](http://prng.di.unimi.it/xoshiro256starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `3930000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `9bd4604137366abec688a63706aa4a2188d35499de169df633e0964e8c04600c` |

---

[← All algorithms](../README.md)
