# PLANET

> PLANET (Postal Alpha Numeric Encoding Technique) check digit for US Postal Service Confirm Service. 12 or 14 digits for tracking business reply mail and other tracked mailings. Uses same modulo-10 algorithm as POSTNET but different barcode format.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Postal Tracking |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | United States Postal Service |
| Year | 1993 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/planet-checksum.js`](../../../algorithms/checksum/planet-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 12 or 14 digits + 1 check digit
- Used for: Business reply mail, tracking
- Algorithm: Same as POSTNET (sum mod 10)
- Barcode: Height-encoded bars (different from POSTNET)
- Service ID: 2 digits identifying mail class
- Mailer ID: 6-8 digits
- Sequence: 0-6 digits
- Check digit: (10 - sum mod 10) mod 10
- Used: 1993-2013
- Superseded by: Intelligent Mail Barcode

## Documentation

- [PLANET Code on Wikipedia](https://en.wikipedia.org/wiki/PLANET_Code)
- [USPS Confirm Service](https://postalpro.usps.com/mailing/confirm-service)
- [Postal Barcodes](https://postalpro.usps.com/mailing/barcode-systems)

## References

- [tc-lib-barcode PLANET implementation](https://github.com/tecnickcom/tc-lib-barcode/blob/main/src/Type/Linear/Planet.php)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [PLANET 12-digit](https://en.wikipedia.org/wiki/PLANET_Code)

| Field | Value |
| --- | --- |
| `input` | `313233343536373839303132` |
| `expected` | `02` |

**Vector 2** — [PLANET 14-digit](https://en.wikipedia.org/wiki/PLANET_Code)

| Field | Value |
| --- | --- |
| `input` | `3132333435363738393031323334` |
| `expected` | `05` |

**Vector 3** — [Simple sequence](https://en.wikipedia.org/wiki/PLANET_Code)

| Field | Value |
| --- | --- |
| `input` | `303030303030303030303030` |
| `expected` | `00` |

---

[← All algorithms](../README.md)
