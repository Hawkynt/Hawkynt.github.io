# RomuDuo

> RomuDuo is a two-state member of the Romu (Rotate-Multiply) family of pseudo-random number generators designed by Mark Overton. It balances speed and quality using rotation and multiplication operations on two 64-bit state variables. Recommended for general-purpose use, passing PractRand and BigCrush statistical tests.

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
| Source | [`algorithms/random/romuduo.js`](../../../algorithms/random/romuduo.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 8 bytes (64 bits) to 16 bytes (128 bits) |

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
- [BigCrush Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed (1,1): First four 64-bit outputs from RomuDuo](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `01000000000000000100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `01000000000000004b574c4f803e83d30080a52ba6279859b76f895d29aa8955` |

**Vector 2** — [Seed (0,1): First four 64-bit outputs from RomuDuo](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `00000000000000000100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `00000000000000004b574c4f803e83d300000000000058ba8b12582028b07c07` |

**Vector 3** — [Seed via SplitMix64(0): First four 64-bit outputs](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `afcd1d7b39a820e27cca66f3b3f1fc552917cf7337129456e29bccc704bef429` |

**Vector 4** — [Seed via SplitMix64(1): First four 64-bit outputs](https://arxiv.org/abs/2002.11331)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `c15c0289ec2d0a912d43ca4aaebed118d469b2b764d4a9a2985f245643c8a42f` |

---

[← All algorithms](../README.md)
