# ISBN-10

> ISBN-10 checksum using modulo 11 with weighted positions and possible X check digit Standard book identifier validation used worldwide in publishing.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Publication Identifier |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | International Organization for Standardization (ISO) |
| Year | 1970 |
| Origin | Not specified |
| Source | [`algorithms/checksum/isbn.js`](../../../algorithms/checksum/isbn.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not Cryptographically Secure | Designed for accidental error detection only, not security | — |
| Limited Error Detection | Cannot detect all types of transcription errors | — |

## Notes

- Format: 10 digits (9 data + 1 check)
- Weights: 1,2,3,4,5,6,7,8,9 applied left to right (equivalently 10,9,...,2 read right to left)
- Algorithm: check digit d10 chosen so that sum(i=1..10, i * digit_i) ≡ 0 (mod 11)
- Check digit: 0 if remainder is 0, 'X' (=10) if remainder is 1, otherwise 11 minus the remainder
- Example: 0-306-40615-9 (Structured Computer Organization, Tanenbaum)
- Superseded by ISBN-13 in 2007
- Detects: all single-digit errors and most transposition errors

## Documentation

- [ISO 2108 Standard](https://www.iso.org/standard/36563.html)
- [ISBN User's Manual](https://www.isbn-international.org/content/user-manual)
- [Library of Congress ISBN](https://www.loc.gov/publish/isbn/)
- [ISBN on Wikipedia](https://en.wikipedia.org/wiki/International_Standard_Book_Number)

## References

- [International ISBN Agency](https://www.isbn-international.org/)
- [Publisher Guidelines](https://www.isbn.org/)
- [WorldCat Library Database](https://www.worldcat.org/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Valid ISBN-10: 0-306-40615-9](https://en.wikipedia.org/wiki/International_Standard_Book_Number)

| Field | Value |
| --- | --- |
| `input` | `00030006040006010509` |
| `expected` | `01` |

**Vector 2** — [Invalid ISBN-10: 0-306-40615-3](https://en.wikipedia.org/wiki/International_Standard_Book_Number)

| Field | Value |
| --- | --- |
| `input` | `00030006040006010503` |
| `expected` | `00` |

**Vector 3** — [Valid ISBN-10: 0-19-605688-3](https://en.wikipedia.org/wiki/International_Standard_Book_Number)

| Field | Value |
| --- | --- |
| `input` | `00010906000506080803` |
| `expected` | `01` |

---

[← All algorithms](../README.md)
