# ISSN

> ISSN (International Standard Serial Number) check digit calculation per ISO 3297. 8-digit identifier for periodical publications with modulo-11 weighted sum. Format: XXXX-XXXX where last digit is check digit (0-9 or X). Used for journals, magazines, newspapers worldwide.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Publication Identifier |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | International Organization for Standardization |
| Year | 1975 |
| Origin | Not specified |
| Source | [`algorithms/checksum/issn-checksum.js`](../../../algorithms/checksum/issn-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 8 digits, often written as XXXX-XXXX
- Position 8: Check digit (0-9 or X for 10)
- Weights: 8,7,6,5,4,3,2 (positions 1-7)
- Algorithm: Σ(digit × weight) mod 11
- Check digit: (11 - sum mod 11) mod 11, where 10 = 'X'
- Example: ISSN 0378-5955 (Audiology journal)
- Detects: All single-digit errors
- Detects: Most transposition errors
- Used by: Libraries, databases, citation systems

## Documentation

- [ISSN on Wikipedia](https://en.wikipedia.org/wiki/International_Standard_Serial_Number)
- [ISO 3297 Standard](https://www.iso.org/standard/39601.html)
- [ISSN Portal](https://portal.issn.org/)

## References

- [python-stdnum ISSN implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/issn.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Nature journal (0028-0836)](https://portal.issn.org/resource/ISSN/0028-0836)

| Field | Value |
| --- | --- |
| `input` | `30303238303833` |
| `expected` | `06` |

**Vector 2** — [Science journal (0036-8075)](https://portal.issn.org/resource/ISSN/0036-8075)

| Field | Value |
| --- | --- |
| `input` | `30303336383037` |
| `expected` | `05` |

**Vector 3** — [Library of Congress example (0317-8471)](https://www.loc.gov/issn/basics/basics-checkdigit.html)

| Field | Value |
| --- | --- |
| `input` | `30333137383437` |
| `expected` | `01` |

---

[← All algorithms](../README.md)
