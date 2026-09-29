# LCG (Linear Congruential Generator)

> The Linear Congruential Generator is one of the oldest and most well-known pseudorandom number generator algorithms. It uses the formula X(n+1) = (a * X(n) + c) mod m to generate a sequence of numbers. Despite its simplicity and speed, it has poor statistical properties and should not be used for cryptographic purposes.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudorandom Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | D. H. Lehmer |
| Year | 1949 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/lcg.js`](../../../algorithms/random/lcg.js) |

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

- [Wikipedia: Linear Congruential Generator](https://en.wikipedia.org/wiki/Linear_congruential_generator)
- [Knuth, D. E.: The Art of Computer Programming, Vol. 2 (Seminumerical Algorithms)](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)
- [Park, Miller: Random Number Generators: Good Ones Are Hard To Find](https://www.firstpr.com.au/dsp/rand31/)

## References

- [Park-Miller-Carta Pseudo-Random Number Generators](https://www.firstpr.com.au/dsp/rand31/)
- [Numerical Recipes in C: The Art of Scientific Computing](http://numerical.recipes/)
- [GLIBC rand() implementation](https://sourceware.org/git/?p=glibc.git;a=blob;f=stdlib/random_r.c)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MINSTD (Park-Miller) a=16807, c=0, m=2^31-1, seed=1 - First 10 values](https://www.firstpr.com.au/dsp/rand31/)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `multiplier` | `000041a7` |
| `increment` | `00000000` |
| `modulo` | `7fffffff` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `000041a710d63af160b7acd93ab50c2a 4431b7821c06dac806058ed856e509fe 56f32f4377a4044d` |

**Vector 2** — [MINSTD (Park-Miller) - 10,000th value should be 1043618065](https://www.firstpr.com.au/dsp/rand31/)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `multiplier` | `000041a7` |
| `increment` | `00000000` |
| `modulo` | `7fffffff` |
| `count` | `10000` |
| `outputSize` | `4` |
| `input` | `null` |
| `expected` | `3e345911` |

**Vector 3** — [Numerical Recipes a=1664525, c=1013904223, m=2^32, seed=1 - First 10 values](http://numerical.recipes/)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `multiplier` | `0019660d` |
| `increment` | `3c6ef35f` |
| `modulo` | `0100000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `3c88596c5e8885db8116017eb4733ac5 0cf06d605e98c13fc656dd928e625fc9 0438e694a3a5a0e3` |

**Vector 4** — [ANSI C (glibc) a=1103515245, c=12345, m=2^31, seed=1 - First 8 values](https://sourceware.org/git/?p=glibc.git)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `multiplier` | `41c64e6d` |
| `increment` | `00003039` |
| `modulo` | `80000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `41c67ea6167eb0e72781e494446b9b3d794bdf3215fb748359e2b6001cfbae39` |

---

[← All algorithms](../README.md)
