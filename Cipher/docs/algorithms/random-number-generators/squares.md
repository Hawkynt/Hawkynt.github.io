# Squares

> Fast counter-based PRNG using multiple rounds of squaring, modernizing von Neumann's middle-square method. Trivially parallelizable with competitive performance, passing BigCrush and PractRand statistical tests.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Counter-Based PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Bernard Widynski |
| Year | 2020 |
| Origin | Not specified |
| Source | [`algorithms/random/squares.js`](../../../algorithms/random/squares.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Key sizes | 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |
| `IsCounterBased` | Yes |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper: Squares: A Fast Counter-Based RNG (arXiv:2004.06278, 2020)](https://arxiv.org/abs/2004.06278)
- [Paper PDF (arXiv v3)](https://arxiv.org/pdf/2004.06278v3.pdf)
- [HTML Version (ar5iv)](https://ar5iv.labs.arxiv.org/html/2004.06278)

## References

- [Reference Implementation: FlorisSteenkamp/squares-rng (TypeScript/WebAssembly)](https://github.com/FlorisSteenkamp/squares-rng)
- [BigCrush Statistical Test Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [PractRand Statistical Test Suite](http://pracrand.sourceforge.net/)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Squares 3-round: counter=0, key=0xea3742c76bf95d47 - FlorisSteenkamp reference](https://github.com/FlorisSteenkamp/squares-rng)

| Field | Value |
| --- | --- |
| `key` | `475df96bc74237ea` |
| `outputSize` | `4` |
| `input` | `0000000000000000` |
| `expected` | `63b29228` |

**Vector 2** — [Squares 3-round: counter=1, key=0xea3742c76bf95d47](https://github.com/FlorisSteenkamp/squares-rng)

| Field | Value |
| --- | --- |
| `key` | `475df96bc74237ea` |
| `outputSize` | `4` |
| `input` | `0100000000000000` |
| `expected` | `42e3a3d8` |

**Vector 3** — [Squares 3-round: counter=100, key=0xea3742c76bf95d47 - Known test vector](https://github.com/FlorisSteenkamp/squares-rng)

| Field | Value |
| --- | --- |
| `key` | `475df96bc74237ea` |
| `outputSize` | `4` |
| `input` | `6400000000000000` |
| `expected` | `7b2c9b40` |

**Vector 4** — [Squares 3-round: counter=42, key=0xea3742c76bf95d47](https://github.com/FlorisSteenkamp/squares-rng)

| Field | Value |
| --- | --- |
| `key` | `475df96bc74237ea` |
| `outputSize` | `4` |
| `input` | `2a00000000000000` |
| `expected` | `79a8cc24` |

**Vector 5** — [Squares 3-round: counter=0xFFFFFFFF, key=0xea3742c76bf95d47 - Max 32-bit counter](https://github.com/FlorisSteenkamp/squares-rng)

| Field | Value |
| --- | --- |
| `key` | `475df96bc74237ea` |
| `outputSize` | `4` |
| `input` | `ffffffff00000000` |
| `expected` | `c9604e43` |

**Vector 6** — [Squares 3-round: counter=12345, key=0xea3742c76bf95d47](https://github.com/FlorisSteenkamp/squares-rng)

| Field | Value |
| --- | --- |
| `key` | `475df96bc74237ea` |
| `outputSize` | `4` |
| `input` | `3930000000000000` |
| `expected` | `907d8ec2` |

---

[← All algorithms](../README.md)
