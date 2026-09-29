# Ran1 (Numerical Recipes)

> Park-Miller Minimal Standard LCG combined with Bays-Durham shuffle (32 entries) from Numerical Recipes. Uses Schrage's method to compute (16807 × X) mod (2^31-1) without overflow, then shuffles output through a 32-entry table to remove low-order serial correlations. Period ~2.1 × 10^9. Returns uniform deviates in range [0.0, 1.0).

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Linear Congruential Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Stephen K. Park, Keith W. Miller, Bays-Durham |
| Year | 1988 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/ran1.js`](../../../algorithms/random/ran1.js) |

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

- [Numerical Recipes in C: The Art of Scientific Computing (2nd Edition)](http://numerical.recipes/)
- [Park and Miller (1988): Random Number Generators: Good Ones Are Hard to Find](https://doi.org/10.1145/63039.63042)
- [Ran1 Reference Implementation (UC Berkeley)](https://www.stat.berkeley.edu/~paciorek/diss/code/regression.binomial/ran1.C)

## References

- [Numerical Recipes Legacy Code](http://numerical.recipes/routines/instc.html)
- [Press et al.: Numerical Recipes - The Art of Scientific Computing](http://numerical.recipes/)
- [Bays-Durham Shuffle Algorithm](https://en.wikipedia.org/wiki/Lehmer_random_number_generator)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=-1 (initializes to 1) - First 10 float values](https://www.stat.berkeley.edu/~paciorek/diss/code/regression.binomial/ran1.C)

| Field | Value |
| --- | --- |
| `seed` | `01` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `defdd43e1758bc3d1ea4413f6f9a073f 16316e3f625ac43e3c67273f95e4883d 4600393f72d02b3f` |

**Vector 2** — [Seed=-12345 - First 10 float values](https://www.stat.berkeley.edu/~paciorek/diss/code/regression.binomial/ran1.C)

| Field | Value |
| --- | --- |
| `seed` | `3039` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `a1516c3f3192aa3e43a34a3e4d0d733f 24a7483fdddf7b3f6d046a3f0e52153f 3f27563eb70c363e` |

**Vector 3** — [Seed=-123456789 - First 10 float values](https://www.stat.berkeley.edu/~paciorek/diss/code/regression.binomial/ran1.C)

| Field | Value |
| --- | --- |
| `seed` | `075bcd15` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `5477693fb1d57c3d1342cb3eac08b43e bea8523f4832413f80f5f03afcc23d3e a409133fc741573f` |

**Vector 4** — [Seed=-1 - First value only (initialization test)](https://www.stat.berkeley.edu/~paciorek/diss/code/regression.binomial/ran1.C)

| Field | Value |
| --- | --- |
| `seed` | `01` |
| `outputSize` | `4` |
| `input` | `null` |
| `expected` | `defdd43e` |

---

[← All algorithms](../README.md)
