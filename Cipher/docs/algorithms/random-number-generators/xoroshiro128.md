# Xoroshiro128**

> Xoroshiro128** is a small, fast, all-purpose pseudo-random number generator with a 128-bit state. It features a multiplication-based scrambler (multiply by 5, rotate, multiply by 9) providing superior statistical quality compared to the ++ variant, especially for generating floating-point numbers. Passes all statistical tests including BigCrush.

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
| Source | [`algorithms/random/xoroshiro128starstar.js`](../../../algorithms/random/xoroshiro128starstar.js) |

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

- [Official Reference Implementation](https://prng.di.unimi.it/xoroshiro128starstar.c)
- [xoshiro / xoroshiro generators and the PRNG shootout](https://prng.di.unimi.it/)
- [Original Paper: Scrambled Linear Pseudorandom Number Generators (2018)](https://arxiv.org/pdf/1805.01407)

## References

- [Wikipedia: Xoroshiro128+](https://en.wikipedia.org/wiki/Xoroshiro128+)
- [PCG: A Quick Look at Xoshiro256**](https://www.pcg-random.org/posts/a-quick-look-at-xoshiro256.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=0: First four 64-bit outputs from xoroshiro128**](https://prng.di.unimi.it/xoroshiro128starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `5de3931e520dc9decfa4f463349dd61f381c4e7cec308adc82954c34991a309c` |

**Vector 2** — [Seed=1: First four 64-bit outputs from xoroshiro128**](https://prng.di.unimi.it/xoroshiro128starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `3afa26b50a4a0965fcc56acda003aee16843869640e95fa190efadf9374c3969` |

**Vector 3** — [Seed=12345: First four 64-bit outputs](https://prng.di.unimi.it/xoroshiro128starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `3930000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `fd920ce0eccaf489c80c1fdcf4e0a706d982091d7e7f479b5222d758e12e7f6c` |

**Vector 4** — [Seed=0xDEADBEEF: First four 64-bit outputs](https://prng.di.unimi.it/xoroshiro128starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `efbeadde00000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `932135bfb5dac3a9a2ab46db7d75eb39a097f60c65aaa1823069d10e8e6d7243` |

---

[← All algorithms](../README.md)
