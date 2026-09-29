# MIXMAX

> MIXMAX is a matrix-recursive pseudo-random number generator based on Kolmogorov K-systems and Anosov C-systems. It uses a special NxN matrix multiplication in a Galois field to generate extremely high-quality random numbers with exceptional statistical properties and very long periods.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Konstantin Savvidy, George Savvidy |
| Year | 2015 |
| Origin | 🌐 International |
| Source | [`algorithms/random/mixmax.js`](../../../algorithms/random/mixmax.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 2048 bytes (16384 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Original Paper: The MIXMAX random number generator (CPC 2015)](https://arxiv.org/abs/1403.5355)
- [Spectral Test of MIXMAX Generators (Chaos 2018)](https://arxiv.org/abs/1806.05243)
- [Official Implementation (HEPForge)](https://mixmax.hepforge.org/)
- [ROOT CERN Implementation](https://root.cern.ch/doc/master/classROOT_1_1Math_1_1MixMaxEngine.html)
- [Wikipedia: MIXMAX generator](https://en.wikipedia.org/wiki/MIXMAX_generator)

## References

- [A Priori Tests for MIXMAX (arXiv 2018)](https://arxiv.org/abs/1804.01563)
- [TestU01 Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [Savvidy's Research Papers](https://inspirehep.net/authors/987637)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed [1,2,3,4]: First 4 outputs (32 bytes) - Verified against C# implementation](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `00000001000000020000000300000004` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `6379afc57b50bf572c9062f116e0458ad22a0a30e848249ba286b8c5a633b27a` |

**Vector 2** — [Seed [0]: First 3 outputs (24 bytes) - Zero seed with SplitMix64 initialization](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000000` |
| `outputSize` | `24` |
| `input` | `null` |
| `expected` | `05bc6a4a6d369615b1d0a961f181c7420294730f6fbef9ae` |

**Vector 3** — [Seed [1]: First 5 outputs (40 bytes) - Single-byte seed propagation](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000000000000001` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `ff4a6538e039e776dea700280bdc6e54 b67e275ac7959c340dcf790540c41f19 b13744fcb2dff6ee` |

**Vector 4** — [Seed [42]: First 4 outputs (32 bytes) - Common test seed value](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000000000000002a` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `462494ab7e4722b7233c616cc59dcf723d3137eccf3befadb59766ee350e766e` |

**Vector 5** — [Seed [123456789]: First 3 outputs (24 bytes) - Large seed value test](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `00000000075bcd15` |
| `outputSize` | `24` |
| `input` | `null` |
| `expected` | `8506a0fdac78f9caefb5db32389c75de1d094a706b95537f` |

---

[← All algorithms](../README.md)
