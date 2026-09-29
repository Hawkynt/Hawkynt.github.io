# MRG32k3a

> MRG32k3a is a combined multiple recursive generator with period approximately 2^191. It combines two MRG components using carefully chosen parameters for excellent statistical properties and is recommended for Monte Carlo simulations.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudo-Random Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Pierre L'Ecuyer |
| Year | 1999 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/random/mrg32k3a.js`](../../../algorithms/random/mrg32k3a.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 4 bytes (32 bits); 24 bytes (192 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper: Good Parameters and Implementations for Combined MRGs (Operations Research 1999)](https://pubsonline.informs.org/doi/pdf/10.1287/opre.47.1.159)
- [L'Ecuyer's MRG32k3a Reference Implementation](https://simul.iro.umontreal.ca/rng/MRG32k3a.c)
- [TestU01: Statistical Test Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [Wikipedia: Combined Linear Congruential Generator](https://en.wikipedia.org/wiki/Combined_linear_congruential_generator)

## References

- [Rosetta Code: MRG32k3a Implementation Examples](https://rosettacode.org/wiki/Pseudo-random_numbers/Combined_recursive_generator_MRG32k3a)
- [RngStreams Library (multiple independent streams)](https://github.com/umontreal-simul/RngStreams)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MRG32k3a with seed 1234567 (first 5 outputs - Rosetta Code verification)](https://rosettacode.org/wiki/Pseudo-random_numbers/Combined_recursive_generator_MRG32k3a)

| Field | Value |
| --- | --- |
| `seed` | `87d61200` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `99d6f9569a6e8ba895cd0ffdd59c1fe71ff2b09a` |

**Vector 2** — [MRG32k3a with seed 987654321 (first 5 outputs)](https://rosettacode.org/wiki/Pseudo-random_numbers/Combined_recursive_generator_MRG32k3a)

| Field | Value |
| --- | --- |
| `seed` | `b168de3a` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `44775cb5c8b3f5b8a93488c320e06f2fee99fc5f` |

**Vector 3** — [MRG32k3a with seed 12345 (first 5 outputs)](https://rosettacode.org/wiki/Pseudo-random_numbers/Combined_recursive_generator_MRG32k3a)

| Field | Value |
| --- | --- |
| `seed` | `39300000` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `cf81c57ba22715c3768957e45edb6ac52b06432c` |

---

[← All algorithms](../README.md)
