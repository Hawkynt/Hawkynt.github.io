# LFSR258

> Combined Linear Feedback Shift Register using five 64-bit Tausworthe components with extremely long period (2^258). Developed for the TestU01 statistical testing suite with superior quality to LFSR113. Uses BigInt for 64-bit arithmetic in JavaScript.

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
| Source | [`algorithms/random/lfsr258.js`](../../../algorithms/random/lfsr258.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 40 bytes (320 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [L'Ecuyer: Tables of Maximally Equidistributed Combined LFSR Generators (1999)](https://simul.iro.umontreal.ca/articles/tausme2.pdf)
- [TestU01: Statistical Testing Library](http://simul.iro.umontreal.ca/testu01/tu01.html)
- [L'Ecuyer&Simard: TestU01 Paper (2007)](https://dl.acm.org/doi/10.1145/1268776.1268777)
- [SSJ Library - LFSR258 Reference Implementation](https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java)

## References

- [Mathematics of Computation: Combined LFSR Generators](https://www.ams.org/journals/mcom/1999-68-225/S0025-5718-99-01039-X/S0025-5718-99-01039-X.pdf)
- [L'Ecuyer: Uniform Random Number Generation (1994)](https://www.iro.umontreal.ca/~lecuyer/myftp/papers/handstat.pdf)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Default seed (123456789123456789 for all 5 components) - First 8 bytes](https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java)

| Field | Value |
| --- | --- |
| `seed` | `01b69b4bacd05f1501b69b4bacd05f15 01b69b4bacd05f1501b69b4bacd05f15 01b69b4bacd05f15` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `456e698a9b4e9cf5` |

**Vector 2** — [Default seed (123456789123456789 for all 5 components) - First 16 bytes](https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java)

| Field | Value |
| --- | --- |
| `seed` | `01b69b4bacd05f1501b69b4bacd05f15 01b69b4bacd05f1501b69b4bacd05f15 01b69b4bacd05f15` |
| `outputSize` | `16` |
| `input` | `null` |
| `expected` | `456e698a9b4e9cf59b773ded05a86848` |

**Vector 3** — [Custom seed [12345, 23456, 34567, 131072, 8388608] - First 8 bytes](https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java)

| Field | Value |
| --- | --- |
| `seed` | `00000000000030390000000000005ba0 00000000000087070000000000020000 0000000000800000` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `0011000083000080` |

**Vector 4** — [Minimum valid seeds [2, 512, 4096, 131072, 8388608] - First 8 bytes](https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java)

| Field | Value |
| --- | --- |
| `seed` | `00000000000000020000000000000200 00000000000010000000000000020000 0000000000800000` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `0003000080000080` |

**Vector 5** — [Maximum seeds (all 0xFFFFFFFFFFFFFFFF) - First 8 bytes](https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java)

| Field | Value |
| --- | --- |
| `seed` | `ffffffffffffffffffffffffffffffff ffffffffffffffffffffffffffffffff ffffffffffffffff` |
| `outputSize` | `8` |
| `input` | `null` |
| `expected` | `c3efffff80ffff7f` |

**Vector 6** — [Default seed - First 32 bytes (sequence test)](https://github.com/umontreal-simul/ssj/blob/master/src/main/java/umontreal/ssj/rng/LFSR258.java)

| Field | Value |
| --- | --- |
| `seed` | `01b69b4bacd05f1501b69b4bacd05f15 01b69b4bacd05f1501b69b4bacd05f15 01b69b4bacd05f15` |
| `outputSize` | `32` |
| `input` | `null` |
| `expected` | `456e698a9b4e9cf59b773ded05a8684851a18de9815ffd298274805f0797f5f3` |

---

[← All algorithms](../README.md)
