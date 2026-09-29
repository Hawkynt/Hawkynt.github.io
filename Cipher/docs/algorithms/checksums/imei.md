# IMEI

> IMEI (International Mobile Equipment Identity) check digit using Luhn algorithm. 15-digit unique identifier for mobile phones (14 digits + 1 check). Used by GSM, WCDMA, LTE networks for device identification, tracking, and blocking stolen phones.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Device Identifier |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | GSMA (GSM Association) |
| Year | 1992 |
| Origin | Not specified |
| Source | [`algorithms/checksum/imei-checksum.js`](../../../algorithms/checksum/imei-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: AA-BBBBBB-CCCCCC-D (TAC-FAC-SNR-CD)
- TAC: Type Allocation Code (8 digits)
- FAC: Final Assembly Code (2 digits) - deprecated
- SNR: Serial Number (6 digits)
- CD: Check Digit (1 digit) using Luhn algorithm
- Dial *#06# on most phones to see IMEI
- Used for: Device tracking, theft reporting, network blocking
- Example: 490154203237518
- Detects: All single-digit errors
- Detects: Most adjacent transposition errors

## Documentation

- [IMEI on Wikipedia](https://en.wikipedia.org/wiki/International_Mobile_Equipment_Identity)
- [GSMA IMEI Database](https://www.gsma.com/services/gsma-device-check/)
- [IMEI Calculator](https://www.imei.info/calc/)

## References

- [python-stdnum IMEI implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/imei.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Example IMEI](https://en.wikipedia.org/wiki/International_Mobile_Equipment_Identity)

| Field | Value |
| --- | --- |
| `input` | `3439303135343230333233373531` |
| `expected` | `08` |

**Vector 2** — Another IMEI

Source: IMEI validation

| Field | Value |
| --- | --- |
| `input` | `3335323039393030313736313438` |
| `expected` | `01` |

**Vector 3** — [IMEI test 864586030236528](https://www.imei.info/calc/)

| Field | Value |
| --- | --- |
| `input` | `3836343538363033303233363532` |
| `expected` | `08` |

---

[← All algorithms](../README.md)
