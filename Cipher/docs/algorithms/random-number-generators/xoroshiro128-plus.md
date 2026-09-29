# Xoroshiro128+

> Xoroshiro128+ is a fast, small-state pseudo-random number generator with a 128-bit state. The + variant uses simple addition as the scrambler, making it the fastest in the xoroshiro family but with lower statistical quality than ++ and **. Suitable for non-cryptographic applications where speed is critical.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Non-Cryptographic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | David Blackman, Sebastiano Vigna |
| Year | 2016 |
| Origin | 🇮🇹 Italy |
| Source | [`algorithms/random/xoroshiro128plus.js`](../../../algorithms/random/xoroshiro128plus.js) |

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

- [Official Reference Implementation](https://prng.di.unimi.it/xoroshiro128plus.c)
- [xoshiro / xoroshiro generators and the PRNG shootout](https://prng.di.unimi.it/)
- [Original Paper: Scrambled Linear Pseudorandom Number Generators (2018)](https://arxiv.org/pdf/1805.01407)

## References

- [Wikipedia: Xoroshiro128+](https://en.wikipedia.org/wiki/Xoroshiro128%2B)
- [PCG: A Quick Look at Xoshiro256**](https://www.pcg-random.org/posts/a-quick-look-at-xoshiro256.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=0: First four 64-bit outputs from xoroshiro128+](https://prng.di.unimi.it/xoroshiro128plus.c)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `1e4c37c8688527892e36f5cee7d6e1c9e155f41286c4260d4cefb1612219f897` |

**Vector 2** — [Seed=1: First four 64-bit outputs from xoroshiro128+](https://prng.di.unimi.it/xoroshiro128plus.c)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `dfbd3bfdf4d84bef9114e6ea7c358e4c711c063ae9ccf7432d15e6a0f88f4e78` |

**Vector 3** — [Seed=12345: First four 64-bit outputs](https://prng.di.unimi.it/xoroshiro128plus.c)

| Field | Value |
| --- | --- |
| `seed` | `3930000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `dfce102c79e21e26220cf0ea6baca21a7cab5c2e2d7f5a87e5f01a10f78bee25` |

**Vector 4** — [Seed=0xDEADBEEF: First four 64-bit outputs](https://prng.di.unimi.it/xoroshiro128plus.c)

| Field | Value |
| --- | --- |
| `seed` | `efbeadde00000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `e781e0a656fcb46978eba13167201a7dc7b3940db918a1fd48e5552a046db39f` |

---

[← All algorithms](../README.md)
