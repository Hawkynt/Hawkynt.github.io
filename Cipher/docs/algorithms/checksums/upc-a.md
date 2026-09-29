# UPC-A

> UPC-A (Universal Product Code) check digit for North American retail products. 12-digit identifier (11 data + 1 check) using alternating weights 3,1 from right. Developed by IBM in 1973, first scanned in 1974 on Wrigley's gum. Standard barcode in USA and Canada.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Product Barcode |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | George Laurer (IBM) |
| Year | 1973 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/upca-checksum.js`](../../../algorithms/checksum/upca-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 12 digits (11 data + 1 check)
- Number system digit: 1 digit (0-9)
- Manufacturer code: 5 digits
- Product code: 5 digits
- Check digit: 1 digit
- Weights: 3,1,3,1,3,1,3,1,3,1,3 from left to right
- First product scanned: Wrigley's gum (1974)
- Used primarily in: USA and Canada
- Subset of: GTIN-12
- Example: 036000291452 (Coca-Cola)

## Documentation

- [UPC-A on Wikipedia](https://en.wikipedia.org/wiki/Universal_Product_Code)
- [GS1 US Standards](https://www.gs1us.org/upcs-barcodes-prefixes)
- [UPC History](https://www.smithsonianmag.com/innovation/history-of-bar-code-180956704/)

## References

- [python-stdnum EAN/UPC-A implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/ean.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Coca-Cola Classic UPC](https://en.wikipedia.org/wiki/Universal_Product_Code)

| Field | Value |
| --- | --- |
| `input` | `3033363030303239313435` |
| `expected` | `02` |

**Vector 2** — [Coke 12oz Can UPC](https://www.upcdatabase.com/item/012000181788)

| Field | Value |
| --- | --- |
| `input` | `3031323030303138313738` |
| `expected` | `08` |

**Vector 3** — [Campbell's Soup UPC](https://www.upcdatabase.com/item/051000012234)

| Field | Value |
| --- | --- |
| `input` | `3035313030303031323233` |
| `expected` | `04` |

---

[← All algorithms](../README.md)
