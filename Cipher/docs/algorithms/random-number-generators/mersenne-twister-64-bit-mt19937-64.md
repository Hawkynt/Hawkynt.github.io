# Mersenne Twister 64-bit (MT19937-64)

> MT19937-64 is the 64-bit version of the widely-used Mersenne Twister PRNG with a period of 2^19937-1. It generates high-quality 64-bit pseudo-random numbers suitable for simulation and statistical applications, though it is not cryptographically secure.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudo-Random Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Makoto Matsumoto and Takuji Nishimura |
| Year | 2004 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/random/mersenne-twister-64.js`](../../../algorithms/random/mersenne-twister-64.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 8 bytes (64 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official MT19937-64 Page](http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/emt64.html)
- [Reference Implementation (C code)](http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/VERSIONS/C-LANG/mt19937-64.c)
- [Original Paper: Mersenne Twister (ACM TOMACS 1998)](https://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/ARTICLES/mt.pdf)
- [Wikipedia: Mersenne Twister](https://en.wikipedia.org/wiki/Mersenne_Twister)

## References

- [C++11 std::mt19937_64 Documentation](https://en.cppreference.com/w/cpp/numeric/random/mersenne_twister_engine)
- [Crypto++ Implementation](https://github.com/weidai11/cryptopp/blob/master/mersenne.h)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [MT19937-64 with seed 5489 (default seed, first 10 outputs)](http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/VERSIONS/C-LANG/mt19937-64.c)

| Field | Value |
| --- | --- |
| `seed` | `7115000000000000` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `a6aef6f61c196dc91c0fc88bc77a1f40 f857e4abb68ceeb59213b94d2dd258f2 cc60d8b5b4f2ee04d672d110beaaa767 21402be7505d564086e38d1e7d7bd005 cc1a8230a1de48853a0a2e832c503c58` |

**Vector 2** — [MT19937-64 with seed 1 (common test seed, first 5 outputs)](http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/VERSIONS/C-LANG/mt19937-64.c)

| Field | Value |
| --- | --- |
| `seed` | `0100000000000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `686f68bb5fbd45224efa18235092eb22 9a45e67ae7d182738ec0357905d86105 3867fcec7275d459` |

**Vector 3** — [MT19937-64 with seed 123456789 (validation test)](http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/VERSIONS/C-LANG/mt19937-64.c)

| Field | Value |
| --- | --- |
| `seed` | `15cd5b0700000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `0ec89191f1a74f59755ad328339f5244 9fd9b6f16540fb22c0b3134cbb804f07 ad0ce47a256972de` |

---

[← All algorithms](../README.md)
