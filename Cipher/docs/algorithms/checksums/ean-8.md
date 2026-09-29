# EAN-8

> EAN-8 (European Article Number) check digit for compact product barcodes. 8-digit identifier (7 data + 1 check) using alternating weights 3,1 from right. Subset of GTIN family for small products like cigarettes, cosmetics, chewing gum where space is limited.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Product Barcode |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | GS1 (formerly EAN International) |
| Year | 1977 |
| Origin | Not specified |
| Source | [`algorithms/checksum/ean8-checksum.js`](../../../algorithms/checksum/ean8-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 8 digits (7 data + 1 check)
- Country/company code: 2-3 digits
- Product code: 4-5 digits
- Check digit: 1 digit
- Weights: 3,1,3,1,3,1,3 from right to left
- Algorithm: Same as UPC/EAN-13
- Used for: Small products with limited space
- Common on: Cigarettes, cosmetics, gum
- Barcode: Compact vertical bars
- Example: 96385074

## Documentation

- [EAN-8 on Wikipedia](https://en.wikipedia.org/wiki/EAN-8)
- [GS1 Barcodes](https://www.gs1.org/standards/barcodes/ean-upc)
- [Barcode Standards](https://www.gs1.org/standards/id-keys/gtin)

## References

- [python-stdnum EAN implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/ean.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Standard EAN-8](https://en.wikipedia.org/wiki/EAN-8)

| Field | Value |
| --- | --- |
| `input` | `39363338353037` |
| `expected` | `04` |

**Vector 2** — EAN-8 product

Source: EAN-8 validation

| Field | Value |
| --- | --- |
| `input` | `32303132333435` |
| `expected` | `01` |

**Vector 3** — Simple test

Source: EAN-8 check

| Field | Value |
| --- | --- |
| `input` | `31323334353637` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
