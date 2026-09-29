# Self-Shrinking Generator

> Self-Shrinking Generator (SSG) is a pseudorandom generator derived from a single Linear Feedback Shift Register (LFSR). It processes LFSR output in pairs: the first bit is a selector, and the second bit is output only when the selector is 1. Introduced as a structurally simpler alternative to the two-LFSR Shrinking Generator, it is a well-studied cryptographic building block but is not considered secure against modern cryptanalysis and should not be used for cryptographic purposes.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Cryptographic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Willi Meier and Othmar Staffelbach |
| Year | 1994 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/random/self-shrinking-generator.js`](../../../algorithms/random/self-shrinking-generator.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Meier&Staffelbach: The Self-Shrinking Generator - EUROCRYPT '94](https://doi.org/10.1007/BFb0053436)
- [Wikipedia: Self-shrinking generator](https://en.wikipedia.org/wiki/Self-shrinking_generator)
- [Related: Coppersmith, Krawczyk,&Mansour - The Shrinking Generator (CRYPTO '93)](https://link.springer.com/chapter/10.1007/3-540-48329-2_1)

## References

- [Shrinking Generator Reference Code (closest published implementation of the underlying LFSR-decimation technique)](https://en.wikipedia.org/wiki/Shrinking_generator)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SSG Test Vector 1: Polynomial 0x3B, Seed 0x01](https://doi.org/10.1007/BFb0053436)

| Field | Value |
| --- | --- |
| `seed` | `01` |
| `polynomial` | `59` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `20240a0007702aa0` |

**Vector 2** — [SSG Test Vector 2: Polynomial 0x3B, Seed 0xFF](https://doi.org/10.1007/BFb0053436)

| Field | Value |
| --- | --- |
| `seed` | `ff` |
| `polynomial` | `59` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `f9ffed42be2f7f92` |

**Vector 3** — [SSG Test Vector 3: Polynomial 0xD5, Seed 0x42](https://doi.org/10.1007/BFb0053436)

| Field | Value |
| --- | --- |
| `seed` | `42` |
| `polynomial` | `213` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `40cc111100c88844` |

**Vector 4** — [SSG Test Vector 4: Polynomial 0x3B, Seed 0xAB](https://doi.org/10.1007/BFb0053436)

| Field | Value |
| --- | --- |
| `seed` | `ab` |
| `polynomial` | `59` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `baa4b49aaa802aae` |

**Vector 5** — [SSG Test Vector 5: Polynomial 0x3B, Seed 0x12](https://doi.org/10.1007/BFb0053436)

| Field | Value |
| --- | --- |
| `seed` | `12` |
| `polynomial` | `59` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `0694062519a00000` |

---

[← All algorithms](../README.md)
