# dSFMT-521 (Double precision SIMD-oriented Fast Mersenne Twister)

> dSFMT-521 is a variant of Mersenne Twister optimized for generating double precision floating point numbers directly. It has period 2^521-1 and generates IEEE 754 doubles in range [1, 2) with 52-bit mantissa precision, though this JavaScript version uses portable scalar implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudo-Random Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Mutsuo Saito and Makoto Matsumoto |
| Year | 2007 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/random/dsfmt.js`](../../../algorithms/random/dsfmt.js) |

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

- [Official dSFMT Website](http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/SFMT/)
- [dSFMT Paper: A PRNG specialized in double precision floating point numbers](http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/ARTICLES/dSFMT.pdf)
- [GitHub Repository: MersenneTwister-Lab/dSFMT](https://github.com/MersenneTwister-Lab/dSFMT)

## References

- [Reference Implementation (C code)](https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.c)
- [dSFMT-521 Parameters](https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT-params521.h)
- [Test Vectors (double precision output)](https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.521.out.txt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [dSFMT-521 seed 0, doubles 1-5 in [1,2) - reference prints 1.421944098478936 1.957408659873361 1.190111011127383 1.632549872377003 1.616831120464805](https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.521.out.txt)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | _(empty)_ |

**Vector 2** — [dSFMT-521 seed 0, doubles 6-10 in [1,2) - reference prints 1.984390160895336 1.643335574461273 1.739347032660861 1.228605414113949 1.052731243538065](https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.521.out.txt)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `skipBytes` | `40` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | _(empty)_ |

**Vector 3** — [dSFMT-521 seed 0, doubles 11-15 in [1,2) - reference prints 1.772446323308858 1.114863567000073 1.636605378654444 1.087462000589056 1.391044934734219](https://github.com/MersenneTwister-Lab/dSFMT/blob/master/dSFMT.521.out.txt)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `skipBytes` | `80` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
