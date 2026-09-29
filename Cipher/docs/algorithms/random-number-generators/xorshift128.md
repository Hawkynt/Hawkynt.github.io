# XorShift128

> XorShift128 is a very fast pseudo-random number generator invented by George Marsaglia. It uses three xorshift operations on a 128-bit state to generate high-quality random numbers with a period of 2^128-1. Widely used in simulations and gaming.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | George Marsaglia |
| Year | 2003 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/xorshift.js`](../../../algorithms/random/xorshift.js) |

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

- [Original Paper: Xorshift RNGs (Marsaglia, 2003)](https://www.jstatsoft.org/article/view/v008i14)
- [Wikipedia: Xorshift](https://en.wikipedia.org/wiki/Xorshift)
- [Reference Implementation (GitHub)](https://github.com/WebDrake/xorshift)
- [Sebastiano Vigna: Analysis of xorshift generators](https://vigna.di.unimi.it/ftp/papers/xorshift.pdf)

## References

- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [Modern PRNG Alternatives (xoshiro/xoroshiro)](https://prng.di.unimi.it/)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed (1,2,3,4): First 5 outputs (20 bytes) - verified against reference C implementation](https://www.jstatsoft.org/article/view/v008i14)

| Field | Value |
| --- | --- |
| `seed` | `00000001000000020000000300000004` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `0000080d0000181f00000004000020200040004d` |

**Vector 2** — [Seed (123456789, 362436069, 521288629, 88675123): First 10 outputs - Marsaglia's standard test seed](https://www.jstatsoft.org/article/view/v008i14)

| Field | Value |
| --- | --- |
| `seed` | `075bcd15159a55e51f123bb505491333` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `dca345ea1b5116e6951049aad88d00b0 1ec7825e8db241469af814432ac00f2c 0837ad5817906569` |

**Vector 3** — [Seed (1,1,1,1): First 8 outputs - all identical seed values](https://github.com/WebDrake/xorshift)

| Field | Value |
| --- | --- |
| `seed` | `00000001000000010000000100000001` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `0000080800000001000008080000000100400841004000400000080800000001` |

**Vector 4** — [Seed (1000000, 2000000, 3000000, 4000000): First 5 outputs - large seed values](https://vigna.di.unimi.it/ftp/papers/xorshift.pdf)

| Field | Value |
| --- | --- |
| `seed` | `000f4240001e8480002dc6c0003d0900` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `7a5a56058e94e74ae0e12b9e087c4b8ba03edeff` |

**Vector 5** — [Seed (1,2,3,4): Outputs 11-15 - verifies long-term state progression](https://github.com/WebDrake/xorshift)

| Field | Value |
| --- | --- |
| `seed` | `00000001000000020000000300000004` |
| `outputSize` | `20` |
| `skip` | `10` |
| `input` | `null` |
| `expected` | `00c28a0f004ed75811c11a8922431ffe36c57b4b` |

---

[← All algorithms](../README.md)
