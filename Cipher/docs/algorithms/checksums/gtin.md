# GTIN

> GTIN (Global Trade Item Number) check digit calculation per GS1 standards. Unified format for product identification supporting GTIN-8, GTIN-12 (UPC), GTIN-13 (EAN), GTIN-14. Uses alternating weights (3,1) from right to left for global supply chain compatibility.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Product Identifier |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | GS1 (formerly EAN/UCC) |
| Year | 2004 |
| Origin | Not specified |
| Source | [`algorithms/checksum/gtin-checksum.js`](../../../algorithms/checksum/gtin-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- GTIN-8: 8 digits (EAN-8, RCN-8)
- GTIN-12: 12 digits (UPC-A)
- GTIN-13: 13 digits (EAN-13)
- GTIN-14: 14 digits (shipping containers)
- Algorithm: Alternating weights 3,1,3,1... from right to left
- Sum odd positions (×3) + even positions (×1)
- Check digit: (10 - sum mod 10) mod 10
- Detects: All single-digit errors
- Detects: Most adjacent transposition errors
- Used globally in: Retail, logistics, e-commerce

## Documentation

- [GTIN on Wikipedia](https://en.wikipedia.org/wiki/Global_Trade_Item_Number)
- [GS1 GTIN Standard](https://www.gs1.org/standards/id-keys/gtin)
- [GTIN Validation](https://www.gs1.org/services/check-digit-calculator)

## References

- [python-stdnum EAN/GTIN implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/ean.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [GTIN-13 example (9780201379624)](https://www.gs1.org/standards/id-keys/gtin)

| Field | Value |
| --- | --- |
| `input` | `393738303230313337393632` |
| `expected` | `04` |

**Vector 2** — [GTIN-12 (UPC-A) example](https://www.gs1.org/services/check-digit-calculator)

| Field | Value |
| --- | --- |
| `input` | `3034393633343036333835` |
| `expected` | `02` |

**Vector 3** — [GTIN-8 example (96385074)](https://www.gs1.org/standards/id-keys/gtin)

| Field | Value |
| --- | --- |
| `input` | `39363338353037` |
| `expected` | `04` |

---

[← All algorithms](../README.md)
