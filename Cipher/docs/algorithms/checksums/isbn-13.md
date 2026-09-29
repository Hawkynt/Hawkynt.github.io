# ISBN-13

> ISBN-13 checksum using modulo 10 (EAN-13 based) for modern book identification Standard book identifier validation used worldwide in publishing.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Publication Identifier |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | International Organization for Standardization (ISO) |
| Year | 2007 |
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

- Format: 13 digits (12 data + 1 check)
- Prefix: 978 (Bookland) or 979 (additional capacity)
- Weights: alternating 1,3,1,3,... from left to right
- Algorithm: sum(digit * weight) mod 10
- Check digit: (10 - sum mod 10) mod 10
- Example: 978-0-306-40615-7
- Compatible with the EAN-13/GTIN-13 barcode system
- Supersedes ISBN-10 since 2007
- Detects: all single-digit errors and most adjacent transposition errors

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

**Vector 1** — [Valid ISBN-13: 978-0-306-40615-7](https://en.wikipedia.org/wiki/International_Standard_Book_Number)

| Field | Value |
| --- | --- |
| `input` | `09070800030006040006010507` |
| `expected` | `01` |

**Vector 2** — [Invalid ISBN-13: 978-0-306-40615-3](https://en.wikipedia.org/wiki/International_Standard_Book_Number)

| Field | Value |
| --- | --- |
| `input` | `09070800030006040006010503` |
| `expected` | `00` |

**Vector 3** — [Valid ISBN-13: 979-0-19-605688-2](https://en.wikipedia.org/wiki/International_Standard_Book_Number)

| Field | Value |
| --- | --- |
| `input` | `09070900010906000506080802` |
| `expected` | `01` |

---

[← All algorithms](../README.md)
