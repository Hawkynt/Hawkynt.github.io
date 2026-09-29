# POSTNET

> POSTNET (Postal Numeric Encoding Technique) check digit for US Postal Service barcodes. Simple modulo-10 sum algorithm for ZIP codes and delivery point codes. Used in automated mail sorting from 1982-2013, superseded by Intelligent Mail Barcode.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Postal Code |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | United States Postal Service |
| Year | 1982 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/postnet-checksum.js`](../../../algorithms/checksum/postnet-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 5, 9, or 11 digits + 1 check digit
- ZIP: 5 digits (12345)
- ZIP+4: 9 digits (12345-6789)
- ZIP+4+2: 11 digits (12345-6789-01)
- Algorithm: Sum all digits, check = (10 - sum mod 10) mod 10
- Barcode: Vertical bars (tall = 1, short = 0)
- Used: 1982-2013 in US mail
- Superseded by: Intelligent Mail Barcode (IMb)
- Simple error detection only

## Documentation

- [POSTNET on Wikipedia](https://en.wikipedia.org/wiki/POSTNET)
- [USPS Publication 25](https://pe.usps.com/text/pub25/welcome.htm)
- [Postal Barcodes](https://postalpro.usps.com/mailing/barcode-systems)

## References

- [tc-lib-barcode POSTNET implementation](https://github.com/tecnickcom/tc-lib-barcode/blob/main/src/Type/Linear/Postnet.php)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [ZIP code](https://en.wikipedia.org/wiki/POSTNET)

| Field | Value |
| --- | --- |
| `input` | `3132333435` |
| `expected` | `05` |

**Vector 2** — ZIP+4

Source: POSTNET validation

| Field | Value |
| --- | --- |
| `input` | `313233343536373839` |
| `expected` | `05` |

**Vector 3** — [ZIP+4+2](https://en.wikipedia.org/wiki/POSTNET)

| Field | Value |
| --- | --- |
| `input` | `3132333435363738393031` |
| `expected` | `04` |

---

[← All algorithms](../README.md)
