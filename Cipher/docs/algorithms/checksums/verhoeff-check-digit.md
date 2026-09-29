# Verhoeff-Check-Digit

> Verhoeff algorithm using dihedral group D5 for superior error detection Validates identification numbers to detect transcription errors.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Check Digit Validation |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Jacobus Verhoeff |
| Year | 1969 |
| Origin | 🇳🇱 Netherlands |
| Source | [`algorithms/checksum/check-digit.js`](../../../algorithms/checksum/check-digit.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not Cryptographically Secure | Designed only for detecting accidental errors, not malicious attacks | — |
| Limited Security | Cannot protect against intentional manipulation by knowledgeable attackers | — |

## Documentation

- [Verhoeff Algorithm Wikipedia](https://en.wikipedia.org/wiki/Verhoeff_algorithm)
- [Original Paper](https://dl.acm.org/doi/10.1145/364096.364100)
- [Dihedral Group D5](https://en.wikipedia.org/wiki/Dihedral_group)

## References

- [Indian Aadhaar System](https://uidai.gov.in/)
- [Mathematical Foundation](https://mathworld.wolfram.com/DihedralGroup.html)
- [Error Detection Analysis](https://www.scientificamerican.com/article/bring-science-home-luhn-algorithm/)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Rosetta Code: 2363 validates](https://rosettacode.org/wiki/Verhoeff_algorithm)

| Field | Value |
| --- | --- |
| `input` | `02030603` |
| `expected` | `01` |

**Vector 2** — [Rosetta Code: 2369 does not validate](https://rosettacode.org/wiki/Verhoeff_algorithm)

| Field | Value |
| --- | --- |
| `input` | `02030609` |
| `expected` | `00` |

**Vector 3** — [Rosetta Code: 123451 validates](https://rosettacode.org/wiki/Verhoeff_algorithm)

| Field | Value |
| --- | --- |
| `input` | `010203040501` |
| `expected` | `01` |

**Vector 4** — [Rosetta Code: 123459 does not validate](https://rosettacode.org/wiki/Verhoeff_algorithm)

| Field | Value |
| --- | --- |
| `input` | `010203040509` |
| `expected` | `00` |

**Vector 5** — [Rosetta Code: 1234567890120 validates](https://rosettacode.org/wiki/Verhoeff_algorithm)

| Field | Value |
| --- | --- |
| `input` | `01020304050607080900010200` |
| `expected` | `01` |

**Vector 6** — [Rosetta Code: 1234567890129 does not validate](https://rosettacode.org/wiki/Verhoeff_algorithm)

| Field | Value |
| --- | --- |
| `input` | `01020304050607080900010209` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
