# RomuMono

> RomuMono is the fastest member of the Romu (Rotate-Multiply) family of pseudo-random number generators. It uses only a single 64-bit state variable with rotation and multiplication operations to achieve extreme speed while maintaining acceptable statistical quality.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Non-Cryptographic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Mark Overton |
| Year | 2020 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/romumono.js`](../../../algorithms/random/romumono.js) |

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

- [Original Paper: The Romu Random Number Generators (arXiv:2002.11331)](https://arxiv.org/abs/2002.11331)
- [Romu Generator Overview](http://www.romu-random.org/)
- [PractRand Test Results](http://pracrand.sourceforge.net/)

## References

- [PCG: Romu - A Good PRNG](https://www.pcg-random.org/posts/romu-a-good-prng.html)
- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed x=1: First four 64-bit outputs from RomuMono](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `0100000000000000f4199c5eba627a02b80421e533ec27d6c21f9f404f373fa4` |

**Vector 2** — [Seed x=0: First four 64-bit outputs from RomuMono](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `0000000000000000000000000000000000000000000000000000000000000000` |

**Vector 3** — [Seed x=0x0123456789ABCDEF: First four 64-bit outputs](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `efcdab8967452301` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `efcdab896745230111c2812d702ce264c14ed2dd0f1d50ea3afeeb5c4c652d2b` |

**Vector 4** — [Seed x=0xFFFFFFFFFFFFFFFF: First four 64-bit outputs](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `ffffffffffffffff` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `ffffffffffffffff0be663a9459d85fd68b456cc11b11dfae0d50bc593b1dc8f` |

---

[← All algorithms](../README.md)
