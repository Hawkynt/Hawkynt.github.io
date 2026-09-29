# EAN-13

> EAN-13 (European Article Number) check digit for retail product barcodes. 13-digit identifier (12 data + 1 check) using alternating weights 1,3 from left. Most widely used barcode standard worldwide, found on virtually all retail products globally.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Product Barcode |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | GS1 (formerly EAN International) |
| Year | 1976 |
| Origin | Not specified |
| Source | [`algorithms/checksum/ean13-checksum.js`](../../../algorithms/checksum/ean13-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 13 digits (12 data + 1 check)
- Country/company code: 7-9 digits
- Product code: 3-5 digits
- Check digit: 1 digit
- Weights: 1,3,1,3,1,3... from left to right
- Algorithm: Σ(digit × weight) mod 10, check = (10 - sum) mod 10
- Most common barcode globally
- Used on: Books, groceries, electronics, etc.
- Compatible with: ISBN-13 (prefix 978/979)
- Example: 5901234123457

## Documentation

- [EAN-13 on Wikipedia](https://en.wikipedia.org/wiki/International_Article_Number)
- [GS1 Standards](https://www.gs1.org/standards/barcodes/ean-upc)
- [Barcode Generator](https://www.gs1.org/services/barcodes/generator)

## References

- [python-stdnum EAN implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/ean.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Standard EAN-13](https://en.wikipedia.org/wiki/International_Article_Number)

| Field | Value |
| --- | --- |
| `input` | `353930313233343132333435` |
| `expected` | `07` |

**Vector 2** — Product barcode

Source: EAN-13 validation

| Field | Value |
| --- | --- |
| `input` | `343030363338313333333933` |
| `expected` | `01` |

**Vector 3** — Simple test

Source: EAN-13 check

| Field | Value |
| --- | --- |
| `input` | `313233343536373839303132` |
| `expected` | `08` |

---

[← All algorithms](../README.md)
