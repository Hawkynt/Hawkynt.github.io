# Ran0 (Numerical Recipes)

> Park-Miller minimal standard PRNG from Numerical Recipes. Simple multiplicative linear congruential generator using Schrage's method to compute (16807 × seed) mod (2^31-1) without overflow. Returns floating-point values in [0.0, 1.0). Superseded by Ran2 and Ran3, but useful for educational purposes and as a reference implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Linear Congruential Generator |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Stephen K. Park and Keith W. Miller |
| Year | 1988 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/ran0.js`](../../../algorithms/random/ran0.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 4 bytes (32 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Numerical Recipes in C: The Art of Scientific Computing (2nd Ed.), Section 7.1](http://numerical.recipes/)
- [Park and Miller (1988): Random Number Generators: Good Ones Are Hard to Find](https://doi.org/10.1145/63039.63042)
- [Wikipedia: Lehmer Random Number Generator](https://en.wikipedia.org/wiki/Lehmer_random_number_generator)

## References

- [Press et al., Numerical Recipes in C (1992), pp. 278-286](http://numerical.recipes/)
- [Park and Miller, CACM 31(10):1192-1201 (1988)](https://doi.org/10.1145/63039.63042)
- [Numerical Recipes Legacy Code Repository](http://numerical.recipes/routines/instc.html)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=1: First 10 output values (floating-point doubles)](http://numerical.recipes/)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `80d32000c069e03e76ac21f13ad6c03f d65b7036eb2de83f0cb53a15865add3f dc18a2e06d0ce13fb60d38c8da06cc3f 772c30603b16a83f8572ab7f42b9e53f 9879ebd0cbbce53f02d27b1301e9ed3f` |

**Vector 2** — [Seed=123456789: First 5 output values](http://numerical.recipes/)

| Field | Value |
| --- | --- |
| `seed` | `075bcd15` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `43ea377921f5cb3f4f347d51279aee3f ae16f5f2568bea3fd1f2a3b868f9e13f c82835276494da3f` |

**Vector 3** — [Park-Miller canonical test: 10,000th iteration from seed=1](https://doi.org/10.1145/63039.63042)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `count` | `10000` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `5934be882c1adf3f` |

**Vector 4** — [Seed=16807 (multiplier a): First value](http://numerical.recipes/)

| Field | Value |
| --- | --- |
| `seed` | `000041a7` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `76ac21f13ad6c03f` |

**Vector 5** — [Seed=2147483646 (max valid seed): First value](https://doi.org/10.1145/63039.63042)

| Field | Value |
| --- | --- |
| `seed` | `7ffffffe` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `dfff3f96efffef3f` |

---

[← All algorithms](../README.md)
