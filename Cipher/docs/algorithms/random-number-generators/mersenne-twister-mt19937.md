# Mersenne Twister (MT19937)

> MT19937 is a widely-used pseudo-random number generator with a period of 2^19937-1. It passes numerous statistical tests and is the default PRNG in many programming languages, though it is not cryptographically secure.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudo-Random Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Makoto Matsumoto and Takuji Nishimura |
| Year | 1997 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/random/mersenne-twister.js`](../../../algorithms/random/mersenne-twister.js) |

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

- [Original Paper: Mersenne Twister (ACM TOMACS 1998)](https://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/ARTICLES/mt.pdf)
- [MT19937ar: Improved Initialization (2002)](https://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/MT2002/emt19937ar.html)
- [Crypto++ Implementation](https://github.com/weidai11/cryptopp/blob/master/mersenne.h)
- [Wikipedia: Mersenne Twister](https://en.wikipedia.org/wiki/Mersenne_Twister)

## References

- [Reference Implementation (C code)](https://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/MT2002/CODES/mt19937ar.c)
- [C++11 std::mt19937 Documentation](https://en.cppreference.com/w/cpp/numeric/random/mersenne_twister_engine)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MT19937 with seed 5489 (default seed, first 10 outputs)](https://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/MT2002/CODES/mt19937ar.c)

| Field | Value |
| --- | --- |
| `seed` | `71150000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `5cbb91d0f69eae22eefae1e7791fc3d5 2c358220dfb707f80500d3e9e1af9538 ba4be2a12b09e44e` |

**Vector 2** — [MT19937 with seed 1 (common test seed, first 10 outputs)](https://en.cppreference.com/w/cpp/numeric/random/mersenne_twister_engine)

| Field | Value |
| --- | --- |
| `seed` | `01000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `25f4c16aeb8047ff8c2f67b84814bcee ff7e070089c3cc20cbaa654d851ec1ff 4fcb9125c053703c` |

**Vector 3** — [MT19937 with seed 123456789 (validation test)](https://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/MT2002/CODES/mt19937ar.c)

| Field | Value |
| --- | --- |
| `seed` | `15cd5b07` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `b8be67889c2e9bfd322dbd88d9175e035a117282` |

---

[← All algorithms](../README.md)
