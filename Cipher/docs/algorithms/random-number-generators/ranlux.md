# RANLUX

> RANLUX is a high-quality pseudo-random number generator based on subtract-with-borrow with luxury levels that control the fraction of discarded numbers. Designed for Monte Carlo simulations requiring provably decorrelated random sequences.

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
| Source | [`algorithms/random/ranlux.js`](../../../algorithms/random/ranlux.js) |

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

- [Original Paper: M. Lüscher (Computer Physics Communications 1994)](https://www.sciencedirect.com/science/article/abs/pii/001046559490232X)
- [F. James: RANLUX Fortran Implementation (Computer Physics Communications 1994)](https://www.sciencedirect.com/science/article/abs/pii/001046559490233X)
- [Martin Lüscher's RANLUX Page](https://luscher.web.cern.ch/luscher/ranlux/)
- [GNU Scientific Library: RANLUX](https://www.gnu.org/software/gsl/doc/html/rng.html#the-ranlux-generators)

## References

- [GSL ranlux.c Implementation](https://github.com/ampl/gsl/blob/master/rng/ranlux.c)
- [FORTRAN Reference Implementation](https://cyber.dabamos.de/programming/fortran/computer-games/ranlux.f)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RANLUX luxury=3 (p=223) with default seed 314159265, first 5 outputs](https://cyber.dabamos.de/programming/fortran/computer-games/ranlux.f)

| Field | Value |
| --- | --- |
| `seed` | `a1b0b912` |
| `luxuryLevel` | `3` |
| `outputSize` | `15` |
| `input` | `null` |
| `expected` | `85318af8f4c2c86f0fd4c6cb7a6a4e` |

**Vector 2** — [RANLUX luxury=4 (p=389) with default seed 314159265, first 3 outputs](https://github.com/ampl/gsl/blob/master/rng/ranlux.c)

| Field | Value |
| --- | --- |
| `seed` | `a1b0b912` |
| `luxuryLevel` | `4` |
| `outputSize` | `9` |
| `input` | `null` |
| `expected` | `85318af8f4c2c86f0f` |

**Vector 3** — [RANLUX luxury=0 (p=24) with seed 1, first 4 outputs](https://www.gnu.org/software/gsl/doc/html/rng.html)

| Field | Value |
| --- | --- |
| `seed` | `01000000` |
| `luxuryLevel` | `0` |
| `outputSize` | `12` |
| `input` | `null` |
| `expected` | `2b26f2e335795597f31d026e` |

**Vector 4** — [RANLUX luxury=2 (p=97) with seed 12345, first 3 outputs](https://www.gnu.org/software/gsl/doc/html/rng.html)

| Field | Value |
| --- | --- |
| `seed` | `39300000` |
| `luxuryLevel` | `2` |
| `outputSize` | `9` |
| `input` | `null` |
| `expected` | `d44d138f9125b5809f` |

---

[← All algorithms](../README.md)
