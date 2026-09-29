# Ran2 (Numerical Recipes)

> Combined linear congruential generator with Bays-Durham shuffle from Numerical Recipes. Uses two LCGs with moduli 2147483563 and 2147483399, combined with a 32-entry shuffle table. Long period (~2.3 × 10^18) makes it suitable for Monte Carlo simulations. Returns uniform deviates in range [0.0, 1.0).

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Linear Congruential Generator |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | William H. Press, Saul A. Teukolsky, William T. Vetterling, Brian P. Flannery |
| Year | 1988 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/ran2.js`](../../../algorithms/random/ran2.js) |

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
- [Ran2 Reference Implementation (GitHub)](https://github.com/sharpee/mid/blob/master/mid/ran2.c)
- [L'Ecuyer, P. (1988): Efficient and Portable Combined Random Number Generators](https://www.iro.umontreal.ca/~lecuyer/myftp/papers/cacm88.pdf)

## References

- [Numerical Recipes Legacy Code](http://numerical.recipes/routines/instc.html)
- [Press et al.: Numerical Recipes - The Art of Scientific Computing](http://numerical.recipes/)
- [GNU Scientific Library - Numerical Recipes generators](https://www.math.utah.edu/software/gsl/gsl-ref_254.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed=-1 (initializes to 1) - First 10 double values](https://github.com/sharpee/mid/blob/master/mid/ran2.c)

| Field | Value |
| --- | --- |
| `seed` | `01` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `b6f1203fae43d23f7f8944440537d03f 1fc0e3bb8dedb73f1c39ae78ce78e33f 319bf29ad1e8ec3f5f33a66e5f12c93f 3eeface507a1dd3faa46f475760cee3f ff36d0199b48c03f9554ad7d9d9eda3f` |

**Vector 2** — [Seed=-12345 - First 10 double values](https://github.com/sharpee/mid/blob/master/mid/ran2.c)

| Field | Value |
| --- | --- |
| `seed` | `3039` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `badb7eba23da9b3fe93f0bec0e2fae3f f64a547e0d9dce3fb1bf8e980eef983f ff588c73f56fbd3ffc6d260f1570e63f 457e15f89053e33fde9aae964961db3f 609a3f0f7f17e83fa0f7e414a531da3f` |

**Vector 3** — [Seed=-123456789 - First 10 double values](https://github.com/sharpee/mid/blob/master/mid/ran2.c)

| Field | Value |
| --- | --- |
| `seed` | `075bcd15` |
| `outputSize` | `80` |
| `input` | `null` |
| `expected` | `8f9ee4ec1528d13f4990dfaf42eaea3f 19cb792883d2db3f14885e8e6fa3d53f b8027ff3df5bad3fb6823a24134fe73f bb22f6ceb581c03f5f44f0f46600d83f 552134d1d19fe13f06c43e5d542ed03f` |

**Vector 4** — [Seed=-1 - First value only (initialization test)](https://github.com/sharpee/mid/blob/master/mid/ran2.c)

| Field | Value |
| --- | --- |
| `seed` | `01` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `b6f1203fae43d23f` |

---

[← All algorithms](../README.md)
