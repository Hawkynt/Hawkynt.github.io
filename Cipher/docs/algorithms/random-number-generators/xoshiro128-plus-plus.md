# Xoshiro128++

> Xoshiro128++ is a 32-bit all-purpose, rock-solid pseudo-random number generator with excellent speed and statistical properties. It features a 128-bit state, passes all BigCrush tests, and is ideal for embedded systems, GPUs, and JavaScript environments.

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
| Source | [`algorithms/random/xoshiro-plusplus.js`](../../../algorithms/random/xoshiro-plusplus.js) |

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

- [Official Reference Implementation (Xoshiro128++)](https://prng.di.unimi.it/xoshiro128plusplus.c)
- [xoshiro / xoroshiro generators and the PRNG shootout](https://prng.di.unimi.it/)
- [Original Paper: Scrambled Linear Pseudorandom Number Generators (2018)](https://arxiv.org/pdf/1805.01407)

## References

- [Wikipedia: Xoroshiro128+](https://en.wikipedia.org/wiki/Xoroshiro128%2B)
- [Rust SmallRng (uses xoshiro128++)](https://docs.rs/rand/latest/rand/rngs/struct.SmallRng.html)
- [Java RandomGenerator (includes xoshiro128++)](https://docs.oracle.com/en/java/javase/17/docs/api/java.base/java/util/random/package-summary.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=0: First five 32-bit outputs from xoshiro128++](https://prng.di.unimi.it/xoshiro128plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `a4f2ce6940989589be3eb9ee379984999131ee28` |

**Vector 2** — [Seed=1: First five 32-bit outputs from xoshiro128++](https://prng.di.unimi.it/xoshiro128plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `01000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `fa6c3236d177304e8dcdf4485771d5ec85edafa7` |

**Vector 3** — [Seed=42: First five 32-bit outputs from xoshiro128++](https://prng.di.unimi.it/xoshiro128plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `2a000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `8261ca0447e7ab9a7705c7a3d606ff3e5e1d4920` |

**Vector 4** — [Seed=12345: First five 32-bit outputs](https://prng.di.unimi.it/xoshiro128plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `39300000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `8a1d79000e7e11b369576395cbb730d0456116da` |

---

[← All algorithms](../README.md)
