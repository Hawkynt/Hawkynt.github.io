# Lehmer RNG (Park-Miller)

> A multiplicative linear congruential generator using the Park-Miller minimal standard parameters. Uses Schrage's method to avoid overflow with the recurrence X(n+1) = (16807 × X(n)) mod (2^31-1). Despite being a minimal standard in 1988, it has known statistical weaknesses and should only be used for educational purposes.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Linear Congruential Generator |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | D. H. Lehmer (refined by Park and Miller) |
| Year | 1951 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/lehmer.js`](../../../algorithms/random/lehmer.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 4 bytes (32 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Park and Miller (1988): Random Number Generators: Good Ones Are Hard to Find](https://doi.org/10.1145/63039.63042)
- [Wikipedia: Lehmer Random Number Generator](https://en.wikipedia.org/wiki/Lehmer_random_number_generator)
- [Schrage's Method Explanation](https://craftofcoding.wordpress.com/2021/07/05/demystifying-random-numbers-schrages-method/)

## References

- [Communications of the ACM, Vol 31, No 10 (1988)](https://doi.org/10.1145/63039.63042)
- [Numerical Recipes in C (2nd Edition, 1992), p.279](http://numerical.recipes/)
- [C++ std::minstd_rand0 reference implementation](https://en.cppreference.com/w/cpp/numeric/random/linear_congruential_engine)
- [stdlib-js MINSTD implementation](https://github.com/stdlib-js/random-base-minstd)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Park-Miller 1988: First 10 values from seed=1](https://doi.org/10.1145/63039.63042)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `000041a710d63af160b7acd93ab50c2a 4431b7821c06dac806058ed856e509fe 56f32f4377a4044d` |

**Vector 2** — [Park-Miller 1988 canonical test: 10,000th iteration from seed=1 = 1043618065](https://doi.org/10.1145/63039.63042)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `count` | `10000` |
| `outputSize` | `4` |
| `input` | `null` |
| `expected` | `3e345911` |

**Vector 3** — [Park-Miller: Seed=123456789, first 5 values](https://github.com/stdlib-js/random-base-minstd)

| Field | Value |
| --- | --- |
| `seed` | `075bcd15` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `1bf521797a689d456a2d5bcb47e5a2e23528c84e` |

**Vector 4** — [Park-Miller: Seed=2147483646 (max seed), first value](https://doi.org/10.1145/63039.63042)

| Field | Value |
| --- | --- |
| `seed` | `7ffffffe` |
| `outputSize` | `4` |
| `input` | `null` |
| `expected` | `7fffbe58` |

**Vector 5** — [Park-Miller: Seed=16807 (a), first value](https://doi.org/10.1145/63039.63042)

| Field | Value |
| --- | --- |
| `seed` | `000041a7` |
| `outputSize` | `4` |
| `input` | `null` |
| `expected` | `10d63af1` |

---

[← All algorithms](../README.md)
