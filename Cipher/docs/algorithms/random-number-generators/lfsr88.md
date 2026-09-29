# LFSR88

> LFSR88 is a combined linear feedback shift register using three Tausworthe components with primitive trinomials. With a period of approximately 2^88, it provides excellent statistical quality for simulations and Monte Carlo methods. Simpler and faster than LFSR113, widely used in GNU Scientific Library (GSL).

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Tausworthe LFSR |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Pierre L'Ecuyer |
| Year | 1996 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/random/lfsr88.js`](../../../algorithms/random/lfsr88.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 12 bytes (96 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [L'Ecuyer: Maximally Equidistributed Combined Tausworthe Generators (1996)](https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/)
- [GNU Scientific Library: Random Number Generators](https://www.gnu.org/software/gsl/doc/html/rng.html)
- [GSL Source: gsl_rng_taus](https://github.com/ampl/gsl/blob/master/rng/taus.c)
- [L'Ecuyer: Tables of Maximally Equidistributed Combined LFSR Generators](https://www.ams.org/journals/mcom/1999-68-225/S0025-5718-99-00996-5/)

## References

- [TestU01: Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [L'Ecuyer: Uniform Random Number Generation (2017)](https://pubsonline.informs.org/doi/10.1287/ijoc.2016.0744)
- [Panneton and L'Ecuyer: On the xorshift random number generators (2005)](https://dl.acm.org/doi/10.1145/1132973.1132974)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed (12345, 23456, 34567): First 5 outputs - verified against LFSR88 specification](https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/)

| Field | Value |
| --- | --- |
| `seed` | `0000303900005ba000008707` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `0d063a5739786e63455d3d002ca381e2805afcf6` |

**Vector 2** — [Seed (987654321, 123456789, 362436069): First 10 outputs - large seed values](https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/)

| Field | Value |
| --- | --- |
| `seed` | `3ade68b1075bcd15159a55e5` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `38e0e6ebb81c2db71e43dc1d9567cf51 78b9be0ccd95f930e9903cb4b3d3529e c1423895391f9e51` |

**Vector 3** — [Seed (2, 8, 16): Minimal valid seed values - edge case test](https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/)

| Field | Value |
| --- | --- |
| `seed` | `000000020000000800000010` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `0020208002002c8048088062804d2000428049a0` |

**Vector 4** — [Seed (1000000, 2000000, 3000000): First 8 outputs - round seed values](https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/)

| Field | Value |
| --- | --- |
| `seed` | `000f4240001e8480002dc6c0` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `784c7d760fa83ede80fde985b34c4faeeaacedf0b65239864005b43bc328d759` |

**Vector 5** — [Seed (12345, 23456, 34567): Outputs 11-15 - verifies long-term state progression](https://www.ams.org/journals/mcom/1996-65-213/S0025-5718-96-00696-5/)

| Field | Value |
| --- | --- |
| `seed` | `0000303900005ba000008707` |
| `outputSize` | `20` |
| `skip` | `10` |
| `input` | `null` |
| `expected` | `93f757cdb1d16696117eee33dd3fcfdd2b582a1e` |

---

[← All algorithms](../README.md)
