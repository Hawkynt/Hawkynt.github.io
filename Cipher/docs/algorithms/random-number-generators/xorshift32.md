# Xorshift32

> Xorshift32 is the simplest xorshift PRNG using a single 32-bit state with three XOR-shift operations. Invented by George Marsaglia in his seminal 2003 paper on xorshift generators. Extremely fast with period 2^32-1, suitable for simulations and gaming.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Xorshift Family |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | George Marsaglia |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/xorshift32.js`](../../../algorithms/random/xorshift32.js) |

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

- [Original Paper: Xorshift RNGs (Marsaglia, 2003)](https://www.jstatsoft.org/article/view/v008i14)
- [PDF: Xorshift RNGs (Direct Download)](https://www.jstatsoft.org/index.php/jss/article/view/v008i14/xorshift.pdf)
- [Wikipedia: Xorshift](https://en.wikipedia.org/wiki/Xorshift)
- [Reference C Implementation](https://github.com/edrosten/8point_algo/blob/master/xorshift.h)

## References

- [Sebastiano Vigna: Analysis of xorshift generators](https://vigna.di.unimi.it/ftp/papers/xorshift.pdf)
- [Modern PRNG Alternatives (xoshiro/xoroshiro)](https://prng.di.unimi.it/)
- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 1: First 5 outputs (20 bytes) - verified against reference implementation](https://www.jstatsoft.org/article/view/v008i14)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `00042021040806019dcca8c51255994f8ef917d1` |

**Vector 2** — [Seed 12345: First 5 outputs (20 bytes) - common test seed](https://github.com/edrosten/8point_algo/blob/master/xorshift.h)

| Field | Value |
| --- | --- |
| `seed` | `00003039` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `c6e5747a652a09afa7e08fa0748e41ea2ad8a9d3` |

**Vector 3** — [Seed 0 (defaults to 1): First 5 outputs - zero seed handling](https://www.jstatsoft.org/article/view/v008i14)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `00042021040806019dcca8c51255994f8ef917d1` |

**Vector 4** — [Seed 0xFFFFFFFF (max 32-bit): First 5 outputs (20 bytes) - edge case](https://en.wikipedia.org/wiki/Xorshift)

| Field | Value |
| --- | --- |
| `seed` | `ffffffff` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `0003e01ffc07fdff74bb9843f1cc88da7a28ee91` |

**Vector 5** — [Seed 42: First 8 outputs (32 bytes) - answer to everything](https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript)

| Field | Value |
| --- | --- |
| `seed` | `0000002a` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `00ad4528a90a34ac1c67af03d970c3c0e01ccbc455ea99b6dd5701d890eff2ae` |

**Vector 6** — [Seed 2^31 (0x80000000): First 5 outputs - high bit set](https://vigna.di.unimi.it/ftp/papers/xorshift.pdf)

| Field | Value |
| --- | --- |
| `seed` | `80000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `8008400089088484aa914148d5b8029468b7e441` |

---

[← All algorithms](../README.md)
