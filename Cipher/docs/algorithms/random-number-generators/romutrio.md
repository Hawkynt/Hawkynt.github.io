# RomuTrio

> RomuTrio is a member of the Romu (Rotate-Multiply) family of pseudo-random number generators designed by Mark Overton. It uses three 64-bit state variables with rotation and multiplication operations to achieve exceptional speed while passing rigorous statistical tests including PractRand and TestU01.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Non-Cryptographic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Mark Overton |
| Year | 2020 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/romu.js`](../../../algorithms/random/romu.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 8 bytes (64 bits) to 24 bytes (192 bits) |

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

**Vector 1** — [Seed (1,1,1): First four 64-bit outputs from RomuTrio](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `010000000000000001000000000000000100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `01000000000000004b574c4f803e83d300000000000000000000000000000000` |

**Vector 2** — [Seed (0,0,1): First four 64-bit outputs from RomuTrio](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `000000000000000000000000000000000100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `00000000000000004b574c4f803e83d30000000000b074c50000004b574c4f80` |

**Vector 3** — [Seed via SplitMix64(0): First four 64-bit outputs](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `afcd1d7b39a820e22527b99d5442ccc1cc7de71af3e3464122857317d8d4882f` |

**Vector 4** — [Seed via SplitMix64(1): First four 64-bit outputs](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `c15c0289ec2d0a918af4a90cab8108115e4371067b6d365af7421d4ce665d833` |

---

[← All algorithms](../README.md)
