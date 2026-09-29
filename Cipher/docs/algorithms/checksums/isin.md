# ISIN

> ISIN (International Securities Identification Number) check digit per ISO 6166. 12-character alphanumeric code (2 country + 9 identifier + 1 check) for global securities. Uses modified Luhn algorithm with letter-to-number conversion (A=10, B=11, ..., Z=35).

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Securities Identifier |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | International Organization for Standardization |
| Year | 1989 |
| Origin | Not specified |
| Source | [`algorithms/checksum/isin-checksum.js`](../../../algorithms/checksum/isin-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: CC123456789D (2 country + 9 ID + 1 check)
- Country codes: ISO 3166-1 alpha-2 (e.g., US, GB, DE)
- Letter conversion: A=10, B=11, ..., Z=35
- Algorithm: Modified Luhn on converted numeric string
- Double every second digit from right to left
- Sum individual digits if result > 9
- Check digit: (10 - sum mod 10) mod 10
- Example: US0378331005 (Apple Inc.)
- Used in: Trading, clearing, settlement globally
- Detects: All single-digit errors

## Documentation

- [ISIN on Wikipedia](https://en.wikipedia.org/wiki/International_Securities_Identification_Number)
- [ISO 6166 Standard](https://www.iso.org/standard/78502.html)
- [ISIN Organization](https://www.isin.org/)

## References

- [python-stdnum ISIN implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/isin.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Apple Inc.](https://en.wikipedia.org/wiki/International_Securities_Identification_Number)

| Field | Value |
| --- | --- |
| `input` | `5553303337383333313030` |
| `expected` | `05` |

**Vector 2** — [British Airways GB0009753368](https://www.isin.org/)

| Field | Value |
| --- | --- |
| `input` | `4742303030393735333336` |
| `expected` | `08` |

**Vector 3** — German security

Source: ISIN check

| Field | Value |
| --- | --- |
| `input` | `4445303030424159303031` |
| `expected` | `07` |

---

[← All algorithms](../README.md)
