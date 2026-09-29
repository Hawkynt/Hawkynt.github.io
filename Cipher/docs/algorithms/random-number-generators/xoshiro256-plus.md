# Xoshiro256+

> Xoshiro256+ is the fastest variant in the xoshiro256 family, using simple addition for the output function. It provides excellent speed but lower statistical quality compared to ++ and ** variants, making it suitable for floating-point generation using upper bits.

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
| Source | [`algorithms/random/xoshiro256plus.js`](../../../algorithms/random/xoshiro256plus.js) |

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

- [Official Reference Implementation](https://prng.di.unimi.it/xoshiro256plus.c)
- [xoshiro / xoroshiro generators and the PRNG shootout](https://prng.di.unimi.it/)
- [Original Paper: Scrambled Linear Pseudorandom Number Generators (2018)](https://arxiv.org/pdf/1805.01407)

## References

- [Wikipedia: Xoroshiro128+](https://en.wikipedia.org/wiki/Xoroshiro128+)
- [PCG: A Quick Look at Xoshiro256**](https://www.pcg-random.org/posts/a-quick-look-at-xoshiro256.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=0: First four 64-bit outputs from xoshiro256+](https://prng.di.unimi.it/xoshiro256plus.c)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `9b4f6aede160acda3584c00ddaa15631ab46d085323ebaf9017bba1d6194d14f` |

**Vector 2** — [Seed=1: First four 64-bit outputs from xoshiro256+](https://prng.di.unimi.it/xoshiro256plus.c)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `cc2545777db4cb0226ab3444c2c0cde207787f4717e88f28d93b3442a433c9b8` |

**Vector 3** — [Seed=12345: First four 64-bit outputs](https://prng.di.unimi.it/xoshiro256plus.c)

| Field | Value |
| --- | --- |
| `seed` | `3930000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `6a541006d790274fec20511df233aed2401ed003e26e8fa284753a5a7af43e21` |

---

[← All algorithms](../README.md)
