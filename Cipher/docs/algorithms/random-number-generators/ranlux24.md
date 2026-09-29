# RANLUX24

> RANLUX24 is the C++ standard library implementation of Martin Lüscher's luxury-level random number generator. It uses a 24-bit subtract-with-borrow base engine with a discard block adaptor that discards 200 out of every 223 generated numbers for improved statistical quality.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudo-Random Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Martin Lüscher |
| Year | 1994 |
| Origin | 🇨🇭 Switzerland |
| Source | [`algorithms/random/ranlux24.js`](../../../algorithms/random/ranlux24.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 4 bytes (32 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [C++ Reference: std::ranlux24](https://en.cppreference.com/w/cpp/numeric/random/discard_block_engine)
- [Original Paper: M. Lüscher (Computer Physics Communications 1994)](https://www.sciencedirect.com/science/article/abs/pii/001046559490232X)
- [C++ subtract_with_carry_engine Documentation](https://en.cppreference.com/w/cpp/numeric/random/subtract_with_carry_engine)
- [Martin Lüscher's RANLUX Page](https://luscher.web.cern.ch/luscher/ranlux/)

## References

- [C++ Standard Library Random Number Generators](https://en.cppreference.com/w/cpp/header/random)
- [F. James: RANLUX Implementation (Computer Physics Communications 1994)](https://www.sciencedirect.com/science/article/abs/pii/001046559490233X)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [C++ std::ranlux24 with seed 1, first 5 outputs](https://en.cppreference.com/w/cpp/numeric/random/discard_block_engine)

| Field | Value |
| --- | --- |
| `seed` | `01000000` |
| `outputSize` | `15` |
| `input` | `null` |
| `expected` | `0c5f871f153967fc4f6cb618599fb0` |

**Vector 2** — [C++ std::ranlux24 with seed 314159265 (FORTRAN default), first 5 outputs](https://en.cppreference.com/w/cpp/numeric/random/discard_block_engine)

| Field | Value |
| --- | --- |
| `seed` | `a1b0b912` |
| `outputSize` | `15` |
| `input` | `null` |
| `expected` | `117f61a40213310c8a02a7552fcfea` |

**Vector 3** — [C++ std::ranlux24 with seed 12345, first 5 outputs](https://en.cppreference.com/w/cpp/numeric/random/discard_block_engine)

| Field | Value |
| --- | --- |
| `seed` | `39300000` |
| `outputSize` | `15` |
| `input` | `null` |
| `expected` | `6bfbfaa56bafc20b1c49a1b4d08033` |

**Vector 4** — [C++ std::ranlux24 with seed 42, first 5 outputs](https://en.cppreference.com/w/cpp/numeric/random/discard_block_engine)

| Field | Value |
| --- | --- |
| `seed` | `2a000000` |
| `outputSize` | `15` |
| `input` | `null` |
| `expected` | `9f9b35687a5d41631f63ed0df023fa` |

---

[← All algorithms](../README.md)
