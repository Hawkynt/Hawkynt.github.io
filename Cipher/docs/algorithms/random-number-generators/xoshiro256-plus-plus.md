# Xoshiro256++

> Xoshiro256++ is an all-purpose, rock-solid, small-state pseudo-random number generator with excellent speed and statistical properties. It features a 256-bit state (four 64-bit values), passes all statistical tests, and uses addition and rotation for the output function. Default PRNG for Julia programming language.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Non-Cryptographic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | David Blackman, Sebastiano Vigna |
| Year | 2019 |
| Origin | 🇮🇹 Italy |
| Source | [`algorithms/random/xoroshiro256plusplus.js`](../../../algorithms/random/xoroshiro256plusplus.js) |

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

- [Official Reference Implementation](https://prng.di.unimi.it/xoshiro256plusplus.c)
- [xoshiro / xoroshiro generators and the PRNG shootout](https://prng.di.unimi.it/)
- [Original Paper: Scrambled Linear Pseudorandom Number Generators (2021)](https://doi.org/10.1145/3460772)
- [arXiv: Scrambled Linear Pseudorandom Number Generators](https://arxiv.org/pdf/1805.01407)

## References

- [Julia Language: Random Numbers (uses Xoshiro256++ as default)](https://docs.julialang.org/en/v1/stdlib/Random/)
- [Wikipedia: Xorshift (Xoshiro family)](https://en.wikipedia.org/wiki/Xorshift)
- [PCG: A Quick Look at Xoshiro256**](https://www.pcg-random.org/posts/a-quick-look-at-xoshiro256.html)
- [ACM Transactions on Mathematical Software Paper](https://dl.acm.org/doi/10.1145/3460772)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=0: First four 64-bit outputs from xoshiro256++](https://prng.di.unimi.it/xoshiro256plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `df230b49615d175307d580c33d6fda61fc7b9aec91df0f5c1a5ebe3b8cbfee02` |

**Vector 2** — [Seed=1: First four 64-bit outputs from xoshiro256++](https://prng.di.unimi.it/xoshiro256plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `9bc2036f7fd0c5cf8de03f96324142bf20f5aa57577da319d656cd059f1108bf` |

**Vector 3** — [Seed=12345: First four 64-bit outputs](https://prng.di.unimi.it/xoshiro256plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `3930000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `68a5f8de828a948da002677953f97734698ddbe6fca2ca15d06d0cc25388ef2c` |

**Vector 4** — [Seed=0xDEADBEEFCAFEBABE: First four 64-bit outputs](https://prng.di.unimi.it/xoshiro256plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `bebafecaefbeadde` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `e04d0b19e99f4cbcc3de715260d4eba244b245d6bcec25a8180f7ac01c1eb3a9` |

**Vector 5** — [Seed=0xFFFFFFFFFFFFFFFF: First four 64-bit outputs](https://prng.di.unimi.it/xoshiro256plusplus.c)

| Field | Value |
| --- | --- |
| `seed` | `ffffffffffffffff` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `b2278e94cef8cc56905b5a2e438885e68bca1981a4b5e9e373ae325549190f46` |

---

[← All algorithms](../README.md)
