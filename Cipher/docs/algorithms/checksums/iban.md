# IBAN

> IBAN (International Bank Account Number) checksum using modulo-97 algorithm per ISO 13616. Validates international bank accounts with 2-digit check digits. Format: CC12BANK-ACCOUNT where CC is country code, 12 is check digits. Used in SEPA transactions worldwide.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Banking Standard |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | European Committee for Banking Standards |
| Year | 1997 |
| Origin | Not specified |
| Source | [`algorithms/checksum/iban-checksum.js`](../../../algorithms/checksum/iban-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: CC12BBBBSSSSAAAA... (Country, Check, Bank, Branch, Account)
- Algorithm: Move first 4 chars to end, replace letters with numbers (A=10...Z=35)
- Calculate: mod 97 of resulting number should equal 1 for valid IBAN
- Check digit calculation: 98 - (mod 97 of account with check=00)
- Length varies by country: 15-34 characters
- Detects: 97.3% of all errors
- Detects: All single character errors
- Detects: All double transposition errors
- Used in: SEPA payments, international transfers

## Documentation

- [IBAN on Wikipedia](https://en.wikipedia.org/wiki/International_Bank_Account_Number)
- [ISO 13616 Standard](https://www.iso.org/standard/81090.html)
- [SWIFT IBAN Registry](https://www.swift.com/standards/data-standards/iban)

## References

- [python-stdnum IBAN implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/iban.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [German IBAN](https://en.wikipedia.org/wiki/International_Bank_Account_Number)

| Field | Value |
| --- | --- |
| `input` | `44453839333730343030343430353332303133303030` |
| `expected` | `0001` |

**Vector 2** — UK IBAN

Source: IBAN validation

| Field | Value |
| --- | --- |
| `input` | `47423832574553543132333435363938373635343332` |
| `expected` | `0001` |

**Vector 3** — [Check digit calculation - Invalid IBAN](https://en.wikipedia.org/wiki/International_Bank_Account_Number)

| Field | Value |
| --- | --- |
| `input` | `47423030574553543132333435363938373635343332` |
| `expected` | `0010` |

---

[← All algorithms](../README.md)
