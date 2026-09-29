# Xoshiro128**

> Xoshiro128** is a 32-bit all-purpose, rock-solid pseudo-random number generator with excellent speed and statistical properties. It uses a multiplication-based scrambler for superior statistical quality, passes all BigCrush tests, and is ideal for embedded systems, GPUs, and JavaScript environments.

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
| Source | [`algorithms/random/xoshiro128starstar.js`](../../../algorithms/random/xoshiro128starstar.js) |

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

- [Official Reference Implementation](https://prng.di.unimi.it/xoshiro128starstar.c)
- [xoshiro / xoroshiro generators and the PRNG shootout](https://prng.di.unimi.it/)
- [Original Paper: Scrambled Linear Pseudorandom Number Generators (2018)](https://arxiv.org/pdf/1805.01407)

## References

- [Wikipedia: Xoroshiro128+](https://en.wikipedia.org/wiki/Xoroshiro128%2B)
- [Comparison: ** vs ++ scrambler](https://prng.di.unimi.it/#speed)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=0: First five 32-bit outputs from xoshiro128**](https://prng.di.unimi.it/xoshiro128starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `2037b06a9e34ae0224504996391367e59272d943` |

**Vector 2** — [Seed=1: First five 32-bit outputs from xoshiro128**](https://prng.di.unimi.it/xoshiro128starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `01000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `d4197117e52d9681b39a60e37ac1bc7c8e542c6f` |

**Vector 3** — [Seed=42: First five 32-bit outputs from xoshiro128**](https://prng.di.unimi.it/xoshiro128starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `2a000000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `3d945d27b4aab9d94e30a104211041369c97ee88` |

**Vector 4** — [Seed=12345: First five 32-bit outputs](https://prng.di.unimi.it/xoshiro128starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `39300000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `b30b2a41dd95190c658600df663db8e2e47d12f9` |

---

[← All algorithms](../README.md)
