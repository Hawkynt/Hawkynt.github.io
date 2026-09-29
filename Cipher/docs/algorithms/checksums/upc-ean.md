# UPC-EAN

> UPC/EAN checksum algorithm for product barcodes. Uses alternating weights (3,1,3,1...) from right to left. Used in UPC-A (12 digits), EAN-13 (13 digits), EAN-8 (8 digits) for retail product identification worldwide.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Product Code |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | George Laurer (IBM) / GS1 |
| Year | 1973 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/upc-ean.js`](../../../algorithms/checksum/upc-ean.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Algorithm: Alternating weights 3,1,3,1... from right to left
- Sum = Σ(digit × weight), check = (10 - sum % 10) % 10
- UPC-A: 12 digits (11 data + 1 check)
- EAN-13: 13 digits (12 data + 1 check)
- EAN-8: 8 digits (7 data + 1 check)
- Detects: All single-digit errors
- Detects: Most adjacent transposition errors
- Used in: Retail products worldwide
- Barcode scanning: high reliability in practice

## Documentation

- [UPC on Wikipedia](https://en.wikipedia.org/wiki/Universal_Product_Code)
- [EAN on Wikipedia](https://en.wikipedia.org/wiki/International_Article_Number)
- [GS1 Standards](https://www.gs1.org/standards/barcodes)

## References

- [python-stdnum EAN/UPC implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/ean.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [UPC-A validation](https://en.wikipedia.org/wiki/Universal_Product_Code)

| Field | Value |
| --- | --- |
| `input` | `3033363030303239313435` |
| `expected` | `02` |

**Vector 2** — [EAN-13 validation](https://www.gs1.org/standards/barcodes)

| Field | Value |
| --- | --- |
| `input` | `343030363338313333333933` |
| `expected` | `01` |

**Vector 3** — Simple test

Source: UPC calculation

| Field | Value |
| --- | --- |
| `input` | `3132333435` |
| `expected` | `07` |

---

[← All algorithms](../README.md)
