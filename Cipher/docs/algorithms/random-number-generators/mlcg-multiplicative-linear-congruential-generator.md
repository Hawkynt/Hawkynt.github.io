# MLCG (Multiplicative Linear Congruential Generator)

> The Multiplicative Linear Congruential Generator is a simplified variant of LCG using only multiplication (no additive constant). It uses the formula X(n+1) = (a * X(n)) mod m. MLCG was one of the earliest PRNGs, introduced by D. H. Lehmer in 1951. While simple and fast, it has poor statistical properties and must never be used for cryptographic purposes.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudorandom Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | D. H. Lehmer |
| Year | 1951 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/mlcg.js`](../../../algorithms/random/mlcg.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Lehmer, D. H.: Mathematical methods in large-scale computing units (1951)](https://projecteuclid.org/euclid.aoms/1177729694)
- [Wikipedia: Lehmer Random Number Generator](https://en.wikipedia.org/wiki/Lehmer_random_number_generator)
- [Knuth, D. E.: The Art of Computer Programming, Vol. 2 (Seminumerical Algorithms), Section 3.2.1](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)

## References

- [Park, Miller: Random Number Generators: Good Ones Are Hard To Find](https://www.firstpr.com.au/dsp/rand31/)
- [L'Ecuyer, P.: Tables of Linear Congruential Generators](https://doi.org/10.1090/S0025-5718-99-00996-5)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MINSTD (Park-Miller MLCG) a=16807, m=2^31-1, seed=1 - First 10 values](https://www.firstpr.com.au/dsp/rand31/)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `multiplier` | `000041a7` |
| `modulo` | `7fffffff` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `000041a710d63af160b7acd93ab50c2a 4431b7821c06dac806058ed856e509fe 56f32f4377a4044d` |

**Vector 2** — [MINSTD (Park-Miller MLCG) - 10,000th value should be 1043618065](https://www.firstpr.com.au/dsp/rand31/)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `multiplier` | `000041a7` |
| `modulo` | `7fffffff` |
| `count` | `10000` |
| `outputSize` | `4` |
| `input` | `null` |
| `expected` | `3e345911` |

**Vector 3** — [MLCG with a=48271, m=2^31-1, seed=1 - First 5 values](https://www.firstpr.com.au/dsp/rand31/)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `multiplier` | `0000bc8f` |
| `modulo` | `7fffffff` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `0000bc8f0ae257e24cf91f467220517d7be5f8f1` |

**Vector 4** — [Implicit modulo (2^64) with C# default multiplier, seed=12345](https://github.com/Hawkynt/C--FrameworkExtensions)

| Field | Value |
| --- | --- |
| `seed` | `0000000000003039` |
| `multiplier` | `5851f42d4c957f2d` |
| `modulo` | _(empty)_ |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `0807dc721521c10529e75c5d499968e1 47c1c8e2e1f40e8d6f3cc8211f2f81c9 f12741ce42b98755` |

---

[← All algorithms](../README.md)
