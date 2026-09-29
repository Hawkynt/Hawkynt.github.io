# Middle Square Weyl Sequence

> MSWS is a modern improvement of von Neumann's 1949 Middle Square method. By adding a Weyl sequence with a golden ratio-derived increment, it achieves full period and passes statistical tests. The algorithm squares a 64-bit state, adds the Weyl counter, and extracts the middle 64 bits.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Bernard Widynski |
| Year | 2017 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/msws.js`](../../../algorithms/random/msws.js) |

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

- [Original Paper: Middle Square Weyl Sequence RNG (Widynski, 2017)](https://arxiv.org/abs/1704.00358)
- [arXiv PDF](https://arxiv.org/pdf/1704.00358.pdf)
- [Wikipedia: Middle Square Method](https://en.wikipedia.org/wiki/Middle-square_method)
- [Rosetta Code: MSWS Implementations](https://rosettacode.org/wiki/Middle-square_method)

## References

- [Original Middle Square Method (von Neumann, 1949)](https://mcnp.lanl.gov/pdf_files/nbs_vonneumann.pdf)
- [PractRand Statistical Testing Suite](http://pracrand.sourceforge.net/)
- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed 0: First output - C# reference implementation](https://arxiv.org/abs/1704.00358)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `fffffffeb5ad4ece` |

**Vector 2** — [Seed 1: First 5 outputs (40 bytes) - C# reference implementation](https://arxiv.org/abs/1704.00358)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `fffffff8b5ad4ece7a742cd0c5a00d5a 193d8a560760f364c9207c7c8f3cc60e 71e0d56832c88399` |

**Vector 3** — [Seed 2: First 3 outputs - Additional verification](https://arxiv.org/abs/1704.00358)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000002` |
| `outputSize` | `24` |
| `input` | `null` |
| `expected` | `ffffffeeb5ad4ece7032769fde65216fe7dd025969677be9` |

---

[← All algorithms](../README.md)
