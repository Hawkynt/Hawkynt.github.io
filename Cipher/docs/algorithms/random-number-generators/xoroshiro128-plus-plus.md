# Xoroshiro128++

> Xoroshiro128++ is a small, fast, all-purpose pseudo-random number generator with a 128-bit state. It is the successor to xoroshiro128+, featuring improved statistical quality through a scrambler (rotation + addition) instead of simple addition. Suitable for general-purpose applications requiring speed and quality.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Non-Cryptographic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | David Blackman, Sebastiano Vigna |
| Year | 2018 |
| Origin | 🇮🇹 Italy |
| Source | [`algorithms/random/xoroshiro128plusplus.js`](../../../algorithms/random/xoroshiro128plusplus.js) |

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

- [Official Reference Implementation](https://prng.di.unimi.it/xoroshiro128plusplus.c)
- [xoshiro / xoroshiro generators and the PRNG shootout](https://prng.di.unimi.it/)
- [Original Paper: Scrambled Linear Pseudorandom Number Generators (2018)](https://arxiv.org/pdf/1805.01407)

## References

- [Wikipedia: Xoroshiro128+](https://en.wikipedia.org/wiki/Xoroshiro128+)
- [PCG: A Quick Look at Xoshiro256**](https://www.pcg-random.org/posts/a-quick-look-at-xoshiro256.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=0: First four 64-bit outputs from xoroshiro128++](https://prng.di.unimi.it/xoroshiro128plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `fedf5a13a838f2ec3a06107952b7b9f69f58d1d0cf24ef5dd25b233ff4904de3` |

**Vector 2** — [Seed=1: First four 64-bit outputs from xoroshiro128++](https://prng.di.unimi.it/xoroshiro128plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `583bc2046428f442302496ed84374119cf70e301d8b7d23a7ccfdccf150fad6f` |

**Vector 3** — [Seed=12345: First four 64-bit outputs](https://prng.di.unimi.it/xoroshiro128plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `3930000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `dd5d8f477ada03e76e998957d2390bd7296f7651568cfde0b3b9db34515685c6` |

**Vector 4** — [Seed=0xDEADBEEF: First four 64-bit outputs](https://prng.di.unimi.it/xoroshiro128plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `efbeadde00000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `04bf986cd0068d438d4bf255ddda2222eedb0fe714c4fd0633c5491fbde665ed` |

---

[← All algorithms](../README.md)
