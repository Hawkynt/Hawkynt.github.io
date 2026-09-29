# LFSR113

> LFSR113 is a combined linear feedback shift register using four Tausworthe components with primitive trinomials. With a period of approximately 2^113, it provides excellent statistical quality for simulations and Monte Carlo methods. Widely used in GNU Scientific Library (GSL).

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Tausworthe LFSR |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Pierre L'Ecuyer |
| Year | 1999 |
| Origin | 🇨🇦 Canada |
| Source | [`algorithms/random/lfsr113.js`](../../../algorithms/random/lfsr113.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [L'Ecuyer: Tables of Maximally Equidistributed Combined LFSR Generators (1999)](https://www.ams.org/journals/mcom/1999-68-225/S0025-5718-99-00996-5/)
- [GNU Scientific Library: Random Number Generators](https://www.gnu.org/software/gsl/doc/html/rng.html)
- [GSL Source: gsl_rng_taus113](https://github.com/ampl/gsl/blob/master/rng/taus113.c)
- [Wikipedia: Combined Linear Congruential Generator](https://en.wikipedia.org/wiki/Combined_linear_congruential_generator)

## References

- [TestU01: Statistical Testing Suite](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [L'Ecuyer: Uniform Random Number Generation (2017)](https://pubsonline.informs.org/doi/10.1287/ijoc.2016.0744)
- [Panneton and L'Ecuyer: On the xorshift random number generators (2005)](https://dl.acm.org/doi/10.1145/1132973.1132974)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Seed (12345, 23456, 34567, 45678): First 5 outputs - verified against LFSR113 specification](https://github.com/ampl/gsl/blob/master/rng/taus113.c)

| Field | Value |
| --- | --- |
| `seed` | `0000303900005ba0000087070000b26e` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `d6e2ee3420487a82b4b42f7b1ecb28ddf0404482` |

**Vector 2** — [Seed (987654321, 123456789, 362436069, 521288629): First 10 outputs - large seed values](https://github.com/ampl/gsl/blob/master/rng/taus113.c)

| Field | Value |
| --- | --- |
| `seed` | `3ade68b1075bcd15159a55e51f123bb5` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `35ffd4a6874afbbae88a2f023f7c813f 06e12e04a2527763564d45d7861c1ffb 6c1a069f197ee877` |

**Vector 3** — [Seed (2, 8, 16, 128): Minimal valid seed values - edge case test](https://github.com/ampl/gsl/blob/master/rng/taus113.c)

| Field | Value |
| --- | --- |
| `seed` | `00000002000000080000001000000080` |
| `outputSize` | `20` |
| `input` | `null` |
| `expected` | `00180820000419c8422006240082821431412e59` |

**Vector 4** — [Seed (1000000, 2000000, 3000000, 4000000): First 8 outputs - round seed values](https://github.com/ampl/gsl/blob/master/rng/taus113.c)

| Field | Value |
| --- | --- |
| `seed` | `000f4240001e8480002dc6c0003d0900` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `beb9746d080a61e0ae650dc53685fc3f1b0bc9a487caff3b45b7800e7e08d479` |

**Vector 5** — [Seed (12345, 23456, 34567, 45678): Outputs 11-15 - verifies long-term state progression](https://github.com/ampl/gsl/blob/master/rng/taus113.c)

| Field | Value |
| --- | --- |
| `seed` | `0000303900005ba0000087070000b26e` |
| `outputSize` | `20` |
| `skip` | `10` |
| `input` | `null` |
| `expected` | `f55194733f2f40acc83ad68ad2a5d8f01032c2db` |

---

[← All algorithms](../README.md)
