# Xoroshiro256**

> Xoroshiro256** is a large-state, high-quality pseudo-random number generator with a 256-bit state space. Adopted as the default PRNG for .NET 6+, GNU Fortran, and Lua, it features a multiplication-based scrambler (multiply by 5, rotate, multiply by 9) providing excellent statistical properties. With a period of 2^256-1, it's ideal for parallel and distributed computing via jump functions.

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
| Source | [`algorithms/random/xoroshiro256starstar.js`](../../../algorithms/random/xoroshiro256starstar.js) |

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

- [Official Reference Implementation](https://prng.di.unimi.it/xoroshiro256starstar.c)
- [xoshiro / xoroshiro generators and the PRNG shootout](https://prng.di.unimi.it/)
- [Original Paper: Scrambled Linear Pseudorandom Number Generators (2018)](https://arxiv.org/pdf/1805.01407)

## References

- [Wikipedia: Xoroshiro128+](https://en.wikipedia.org/wiki/Xoroshiro128+)
- [.NET 6 Random Class Implementation](https://github.com/dotnet/runtime/blob/main/src/libraries/System.Private.CoreLib/src/System/Random.Xoshiro256StarStarImpl.cs)
- [PCG: A Quick Look at Xoshiro256**](https://www.pcg-random.org/posts/a-quick-look-at-xoshiro256.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=0: First four 64-bit outputs from xoroshiro256**](https://prng.di.unimi.it/xoroshiro256starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `a9c29cbd46a8701a809e2bcd50f20e6a27ffc289755a32610ab72b6a53f8cc21` |

**Vector 2** — [Seed=1: First four 64-bit outputs from xoroshiro256**](https://prng.di.unimi.it/xoroshiro256starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `c326090b373e88c51cf8710fb8741b02cec8e54967f08d26f2fe7a667d7552e0` |

**Vector 3** — [Seed=12345: First four 64-bit outputs](https://prng.di.unimi.it/xoroshiro256starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `3930000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `da09229a72dbf22c9fc82a900bf85cd626166d0d4186ec8afb3906563dec5562` |

**Vector 4** — [Seed=0xDEADBEEF: First four 64-bit outputs](https://prng.di.unimi.it/xoroshiro256starstar.c)

| Field | Value |
| --- | --- |
| `seed` | `efbeadde00000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `b5b035fcf4c269becd3000f6ac4a47b201c78db74b901c6f8494e508fcfd84ea` |

---

[← All algorithms](../README.md)
