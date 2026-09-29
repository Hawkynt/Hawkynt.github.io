# Shioi128

> Shioi128 is a fast LFSR-based pseudo-random number generator with 128-bit state producing 64-bit outputs. Designed for speed-critical applications, it achieves 3.1x faster performance than MT19937-64 while maintaining excellent statistical quality. It passes PractRand (32TB), TestU01 BigCrush, and Hamming-weight tests with no anomalies.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Non-Cryptographic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Shioi, Sugita |
| Year | 2022 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/random/shioi128.js`](../../../algorithms/random/shioi128.js) |

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

- [Official GitHub Repository](https://github.com/andanteyk/prng-shioi)
- [Reference Implementation (C)](https://github.com/andanteyk/prng-shioi/blob/master/shioi128.c)

## References

- [PractRand Testing Results](https://github.com/andanteyk/prng-shioi#test-results)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=401: First four 64-bit outputs from Shioi128](https://github.com/andanteyk/prng-shioi/blob/master/shioi128.c)

| Field | Value |
| --- | --- |
| `seed` | `9101000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `7ad1c491bab7d7f87104ae028d7853b08a1c635c7b46f7f6205490a5929e108f` |

**Vector 2** — [Seed=0: First four 64-bit outputs from Shioi128](https://github.com/andanteyk/prng-shioi/blob/master/shioi128.c)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `94411d355d14db4041fd6fcc61876362d6bd1abc661e7cce7adaab6b96c16ecb` |

**Vector 3** — [Seed=1: First four 64-bit outputs from Shioi128](https://github.com/andanteyk/prng-shioi/blob/master/shioi128.c)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `89525a229a1871bef028838ad8da1201240284026bf75790569fe6d5d0059573` |

**Vector 4** — [Seed=12345: First four 64-bit outputs from Shioi128](https://github.com/andanteyk/prng-shioi/blob/master/shioi128.c)

| Field | Value |
| --- | --- |
| `seed` | `3930000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `20fce35a36700d58baa6f97f08599210dbed2833c1c9a8b5a402a832e30fcb70` |

---

[← All algorithms](../README.md)
