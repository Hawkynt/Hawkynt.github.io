# LFIB4

> Marsaglia's 4-tap Lagged Fibonacci Generator uses four lags (256, 179, 119, 55) with additive operations to achieve better statistical properties than 2-lag generators. Period approximately 2^287. Optimized for GPU parallel execution and Monte Carlo simulations.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Deterministic PRNG |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | George Marsaglia |
| Year | 1999 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/lfib4.js`](../../../algorithms/random/lfib4.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 32 bytes (256 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Marsaglia's Random Number CDROM (original implementation)](https://www.stat.fsu.edu/pub/diehard/)
- [Wikipedia: Lagged Fibonacci Generator](https://en.wikipedia.org/wiki/Lagged_Fibonacci_generator)
- [Reference Implementation (C) - Archipelago Project](https://github.com/plasma-umass/Archipelago/blob/master/util/marsaglia.h)
- [PractRand Testing Suite](http://pracrand.sourceforge.net/)

## References

- [Lagged Fibonacci Generators for Distributed Memory Parallel Computers](https://www.sciencedirect.com/science/article/abs/pii/S0743731597913630)
- [Random Number Generators: Good Ones Are Hard To Find (1988)](https://dl.acm.org/doi/10.1145/63039.63042)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [LFIB4 with seed 0: First 32 bytes output](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `00000000` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `a7de64b112ec1552afa351065cf2167723ee12446f38761d7bac7c67b8536577` |

**Vector 2** — [LFIB4 with seed 1: First 32 bytes output](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `00000001` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `78d69582ea59b4ec7c6c1015e0bca708c508973c1d3d7be7fb72bb85685e4cf7` |

**Vector 3** — [LFIB4 with seed 42: First 32 bytes output](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0000002a` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `84bc8394d35f29dee163f82f81ba488c3d94d837ed689467f15298b5f1c38f73` |

**Vector 4** — [LFIB4 with seed 1234567: First 32 bytes output](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `0012d687` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `32dba711686415523f1183ee66ffd0ea361ff731a70ecab7bfd472eef969ebdf` |

**Vector 5** — [LFIB4 with seed 999: First 64 bytes output](https://github.com/Hawkynt/Randomizer)

| Field | Value |
| --- | --- |
| `seed` | `000003e7` |
| `outputSize` | `64` |
| `input` | `null` |
| `expected` | `f4ab8fed0f07c8fd70b54844a5ca8ec0 36cf0f7f7f61422c60c6a42592bf5ce8 f1614584a21da25186317858be4a28fe 99bedad51a9324372d5aa7dc2e4a5df0` |

---

[← All algorithms](../README.md)
