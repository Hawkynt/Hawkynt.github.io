# SECDED

> Extended Hamming code providing Single Error Correction and Double Error Detection. Used in ECC RAM and critical storage systems. Achieves Hamming distance of 4 through additional parity bit.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Linear Code |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Richard Hamming (Extended) |
| Year | 1961 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/secded.js`](../../../algorithms/ecc/secded.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Double Error Detection Only | Can detect but not correct double-bit errors. Triple errors may be miscorrected as single errors. | — |
| Burst Error Weakness | Not optimized for burst errors affecting consecutive bits. | — |

## Documentation

- [Wikipedia - Hamming Code](https://en.wikipedia.org/wiki/Hamming_code)
- [SECDED Code in DRAM](https://www.researchgate.net/publication/372210291_SECDED_code_and_its_extended_applications_in_DRAM_system)
- [Error Correction Tutorial](http://lumetta.web.engr.illinois.edu/120-S19/slide-copies/142-error-correction-and-hamming-codes.pdf)

## References

- [IBM 7030 Stretch](https://en.wikipedia.org/wiki/IBM_7030_Stretch)
- [ECC Memory](https://en.wikipedia.org/wiki/ECC_memory)
- [Error Correcting Codes](https://www.jameswhanlon.com/error-correcting-codes.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [SECDED (8,4) all zeros](https://en.wikipedia.org/wiki/Hamming_code)

| Field | Value |
| --- | --- |
| `input` | `00000000` |
| `expected` | `0000000000000000` |

**Vector 2** — [SECDED (8,4) all ones](https://en.wikipedia.org/wiki/Hamming_code)

| Field | Value |
| --- | --- |
| `input` | `01010101` |
| `expected` | `0101010101010101` |

**Vector 3** — [SECDED (8,4) pattern test](https://en.wikipedia.org/wiki/Hamming_code)

| Field | Value |
| --- | --- |
| `input` | `01000100` |
| `expected` | `0001000101000100` |

**Vector 4** — [SECDED (8,4) alternating pattern](https://en.wikipedia.org/wiki/Hamming_code)

| Field | Value |
| --- | --- |
| `input` | `00010001` |
| `expected` | `0100010000010001` |

---

[← All algorithms](../README.md)
