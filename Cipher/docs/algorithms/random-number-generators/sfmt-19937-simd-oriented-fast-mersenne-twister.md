# SFMT-19937 (SIMD-oriented Fast Mersenne Twister)

> SFMT19937 is a variant of Mersenne Twister optimized for modern CPUs with SIMD instructions. It generates 128-bit blocks with period 2^19937-1 and faster generation than standard MT19937, though this JavaScript version uses portable C implementation without native SIMD.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudo-Random Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Mutsuo Saito and Makoto Matsumoto |
| Year | 2006 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/random/sfmt.js`](../../../algorithms/random/sfmt.js) |

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

- [Official SFMT Website](http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/SFMT/)
- [SFMT Paper: SIMD-oriented Fast Mersenne Twister (MCQMC 2006)](http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/ARTICLES/sfmt.pdf)
- [GitHub Repository: MersenneTwister-Lab/SFMT](https://github.com/MersenneTwister-Lab/SFMT)
- [Master's Thesis: Variants of Mersenne Twister (Mutsuo Saito)](http://www.math.sci.hiroshima-u.ac.jp/m-mat/MT/SFMT/M062821.pdf)

## References

- [Reference Implementation (C code)](https://github.com/MersenneTwister-Lab/SFMT/blob/master/SFMT.c)
- [SFMT19937 Parameters](https://github.com/MersenneTwister-Lab/SFMT/blob/master/SFMT-params19937.h)
- [Test Vectors (32-bit output)](https://github.com/MersenneTwister-Lab/SFMT/blob/master/SFMT.19937.out.txt)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SFMT19937 with seed 1234 (first 10 outputs)](https://github.com/MersenneTwister-Lab/SFMT/blob/master/SFMT.19937.out.txt)

| Field | Value |
| --- | --- |
| `seed` | `d2040000` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `32000dcdd7f5475df6fb0a5a247ba8ae 84799256a57546e2f05c38195d13c87f d0bb1ee4638d0ab2` |

**Vector 2** — [SFMT19937 with seed 1234 (outputs 11-20)](https://github.com/MersenneTwister-Lab/SFMT/blob/master/SFMT.19937.out.txt)

| Field | Value |
| --- | --- |
| `seed` | `d2040000` |
| `skipBytes` | `40` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `32ef709f125b9a5b911bd2789b771797 ed5e8664e4a88120498ac0586cb1b051 bc2130fc4bdb1bee` |

---

[← All algorithms](../README.md)
