# Luhn-Check-Digit

> Luhn algorithm (modulo 10) used for credit card validation and many ID numbers Validates identification numbers to detect transcription errors.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Check Digit Validation |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Hans Peter Luhn (IBM) |
| Year | 1954 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/check-digit.js`](../../../algorithms/checksum/check-digit.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not Cryptographically Secure | Designed only for detecting accidental errors, not malicious attacks | — |
| Limited Security | Cannot protect against intentional manipulation by knowledgeable attackers | — |

## Documentation

- [Luhn Algorithm Wikipedia](https://en.wikipedia.org/wiki/Luhn_algorithm)
- [Credit Card Validation](https://www.paypal.com/us/webapps/mpp/security/luhn-algorithm)
- [ISO/IEC 7812](https://www.iso.org/standard/70484.html)

## References

- [Original IBM Paper](https://dl.acm.org/doi/10.1145/1464291.1464316)
- [Payment Card Industry](https://www.pcisecuritystandards.org/)
- [Mathematical Analysis](https://mathworld.wolfram.com/LuhnFormula.html)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Valid test Visa card number

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `04000000000000000000000000000002` |
| `expected` | `01` |

**Vector 2** — Invalid test Visa card number

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `04000000000000000000000000000003` |
| `expected` | `00` |

**Vector 3** — Valid 12-digit number

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `070909020703090807010308` |
| `expected` | `01` |

---

[← All algorithms](../README.md)
