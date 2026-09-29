# RomuQuad

> RomuQuad is the highest-quality member of the Romu (Rotate-Multiply) family of pseudo-random number generators designed by Mark Overton. It uses four 64-bit state variables with rotation and multiplication operations to achieve exceptional statistical quality while maintaining very good speed. RomuQuad passes all BigCrush tests with maximum quality and is recommended for demanding applications.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Non-Cryptographic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Mark Overton |
| Year | 2020 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/romuquad.js`](../../../algorithms/random/romuquad.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 8 bytes (64 bits) to 32 bytes (256 bits) |

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

**Vector 1** — [Seed (1,1,1,1): First four 64-bit outputs from RomuQuad](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000010000000000000001000000000000000100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `0100000000000000c5f404e83338ad744630db0ad65e973e06fc27105e6ee70d` |

**Vector 2** — [Seed (0,0,0,1): First four 64-bit outputs from RomuQuad](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000000000000000000000000000000000000100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `0000000000000000ffffffffffffffff3a0bfb17ccc7528bffc329dd5dd93536` |

**Vector 3** — [Seed via SplitMix64(0): First four 64-bit outputs](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `afcd1d7b39a820e2a411b89013d70589b48f0a530c9e51d416317aa5131f4cda` |

**Vector 4** — [Seed via SplitMix64(1): First four 64-bit outputs](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `c15c0289ec2d0a9177c8d58103712aa2ada40f24ac878918caf84e08292c94a3` |

---

[← All algorithms](../README.md)
