# Fire Code

> Burst error correction code using cyclic polynomial structure. Can correct single burst errors up to length b. Generator polynomial G(x) = (x^c + 1)p(x) where p(x) is irreducible. Used in IEEE 802.3 Ethernet.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Cyclic Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Philip Fire |
| Year | 1959 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/fire-code.js`](../../../algorithms/ecc/fire-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Limited Burst Length | Can only correct bursts up to specified length. Longer bursts will be miscorrected. | — |
| Complex Decoding | Syndrome computation and error location require polynomial arithmetic over GF(2). | — |

## Documentation

- [Wikipedia - Burst Error Correction](https://en.wikipedia.org/wiki/Burst_error-correcting_code)
- [Fire Code Paper](https://ieeexplore.ieee.org/document/5009334/)
- [IEEE 802.3ap Fire Code](https://www.intel.com/content/www/us/en/docs/programmable/683805/current/fire-code-802-3ap-10gbase-kr.html)

## References

- [Burst Error Correction Patent](https://patents.google.com/patent/US8136013B2/en)
- [NASA Technical Report](https://ntrs.nasa.gov/api/citations/19970009858/downloads/19970009858.pdf)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Fire code all zeros](https://en.wikipedia.org/wiki/Burst_error-correcting_code)

| Field | Value |
| --- | --- |
| `burstLength` | `3` |
| `c` | `5` |
| `input` | `0000000000000000` |
| `expected` | `000000000000000000000000000000` |

**Vector 2** — [Fire code simple pattern](https://ieeexplore.ieee.org/document/5009334/)

| Field | Value |
| --- | --- |
| `burstLength` | `3` |
| `c` | `5` |
| `input` | `0100010001000100` |
| `expected` | `010001000100010001000100010001` |

---

[← All algorithms](../README.md)
