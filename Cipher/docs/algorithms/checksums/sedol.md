# SEDOL

> SEDOL (Stock Exchange Daily Official List) check digit calculation. 7-character alphanumeric identifier for securities on London Stock Exchange. Uses weighted sum modulo 10 with specific character mappings. Position 7 is check digit (0-9).

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Financial Identifier |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | London Stock Exchange |
| Year | 1979 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/checksum/sedol-checksum.js`](../../../algorithms/checksum/sedol-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 6 alphanumeric + 1 check digit
- Character values: 0-9 = numeric value, A-Z = 10-35 (excluding vowels)
- Weights: 1,3,1,7,3,9 (positions 1-6)
- Algorithm: Σ(character_value × weight) mod 10
- Check digit: (10 - sum mod 10) mod 10
- Used for: UK and Irish securities
- Complements: ISIN (international), CUSIP (North America)
- Detects: All single-character errors
- Example: 0263494 (Barclays Bank)

## Documentation

- [SEDOL on Wikipedia](https://en.wikipedia.org/wiki/SEDOL)
- [London Stock Exchange](https://www.londonstockexchange.com/)
- [SEDOL Masterfile](https://www.lseg.com/en/data-indices-analytics/sedol)

## References

- [python-stdnum SEDOL implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/gb/sedol.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [BAE Systems (0263494)](https://rosettacode.org/wiki/SEDOLs)

| Field | Value |
| --- | --- |
| `input` | `303236333439` |
| `expected` | `04` |

**Vector 2** — [SEDOL 406566 (4065663)](https://rosettacode.org/wiki/SEDOLs)

| Field | Value |
| --- | --- |
| `input` | `343036353636` |
| `expected` | `03` |

**Vector 3** — [SEDOL B0YBKJ (B0YBKJ7)](https://rosettacode.org/wiki/SEDOLs)

| Field | Value |
| --- | --- |
| `input` | `423059424b4a` |
| `expected` | `07` |

---

[← All algorithms](../README.md)
