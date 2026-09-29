# Ran3 (Numerical Recipes)

> Subtractive random number generator from Numerical Recipes based on Knuth's algorithm. Uses 55-element state array with subtractive method (MA[i] = MA[i-55] - MA[i-31]) and initialization based on golden ratio constant MSEED=161803398. Period approximately 2 × 10^18. Returns uniform deviates in range [0.0, 1.0).

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Subtractive Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Donald Knuth (subtractive method), adapted by William H. Press, Saul A. Teukolsky, William T. Vetterling, Brian P. Flannery |
| Year | 1981 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/ran3.js`](../../../algorithms/random/ran3.js) |

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
- [Knuth, D.E.: The Art of Computer Programming, Vol 2 (Seminumerical Algorithms)](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)
- [Ran3 Reference Implementation (GitHub)](https://github.com/nis/Numerical-Methods--RB-NUM6-U2-1-F12-/blob/master/Code/Tools/NR_C301/legacy/nr2/C_211/recipes/ran3.c)

## References

- [Numerical Recipes Legacy Code](http://numerical.recipes/routines/instc.html)
- [Knuth, TAOCP Volume 2, Section 3.2.2 (Algorithm A)](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)
- [Subtractive Generator - Rosetta Code](https://rosettacode.org/wiki/Subtractive_generator)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=-1 (initializes to 1) - First 10 float values](https://github.com/nis/Numerical-Methods--RB-NUM6-U2-1-F12-/blob/master/Code/Tools/NR_C301/legacy/nr2/C_211/recipes/ran3.c)

| Field | Value |
| --- | --- |
| `seed` | `01` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `41b1983e0d12373f2441073d42d85f3f f7c0083fa3af213f871a643f4add833e a47f6e3f3cf38d3e` |

**Vector 2** — [Seed=-12345 - First 10 float values](https://github.com/nis/Numerical-Methods--RB-NUM6-U2-1-F12-/blob/master/Code/Tools/NR_C301/legacy/nr2/C_211/recipes/ran3.c)

| Field | Value |
| --- | --- |
| `seed` | `3039` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `b8505c3f42eb6c3f280cd63e614b943e 16a9113e8d33e63e78717c3e90125e3e fba5103f3fe0cc3e` |

**Vector 3** — [Seed=-123456789 - First 10 float values](https://github.com/nis/Numerical-Methods--RB-NUM6-U2-1-F12-/blob/master/Code/Tools/NR_C301/legacy/nr2/C_211/recipes/ran3.c)

| Field | Value |
| --- | --- |
| `seed` | `075bcd15` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `10b75f3e1c666b3f43147c3d28e1153f 78fe873ec4cea13edb7bdc3d673b2d3f 6cf8563e8c64503f` |

**Vector 4** — [Seed=-1 - First value only (initialization test)](https://github.com/nis/Numerical-Methods--RB-NUM6-U2-1-F12-/blob/master/Code/Tools/NR_C301/legacy/nr2/C_211/recipes/ran3.c)

| Field | Value |
| --- | --- |
| `seed` | `01` |
| `outputSize` | `4` |
| `input` | `null` |
| `expected` | `41b1983e` |

---

[← All algorithms](../README.md)
