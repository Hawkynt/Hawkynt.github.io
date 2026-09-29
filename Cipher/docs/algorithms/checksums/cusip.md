# CUSIP

> CUSIP (Committee on Uniform Securities Identification Procedures) check digit calculation. 9-character alphanumeric identifier for North American securities. Uses modified Luhn algorithm with position-based doubling. Standard for stocks, bonds, mutual funds in US and Canada.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Financial Identifier |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | American Bankers Association |
| Year | 1968 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/cusip-checksum.js`](../../../algorithms/checksum/cusip-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 6 issuer ID + 2 issue ID + 1 check digit
- Character values: 0-9 = numeric, A-Z = 10-35, * = 36, @ = 37, # = 38
- Algorithm: Similar to Luhn, but doubles even positions (2,4,6,8)
- If doubled value > 9, sum its digits (e.g., 16 → 1+6 = 7)
- Check digit: (10 - sum mod 10) mod 10
- Used in: US and Canadian financial markets
- Mandatory for: SEC filings, trade reporting
- Example: 037833100 (Apple Inc.)
- Detects: All single-digit errors

## Documentation

- [CUSIP on Wikipedia](https://en.wikipedia.org/wiki/CUSIP)
- [CUSIP Global Services](https://www.cusip.com/)
- [SEC EDGAR Search](https://www.sec.gov/edgar/searchedgar/companysearch.html)

## References

- [python-stdnum CUSIP implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/cusip.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Apple Inc. (037833100)](https://rosettacode.org/wiki/CUSIP)

| Field | Value |
| --- | --- |
| `input` | `3033373833333130` |
| `expected` | `00` |

**Vector 2** — [Cisco Systems (17275R102)](https://rosettacode.org/wiki/CUSIP)

| Field | Value |
| --- | --- |
| `input` | `3137323735523130` |
| `expected` | `02` |

**Vector 3** — [Google Inc. (38259P508)](https://rosettacode.org/wiki/CUSIP)

| Field | Value |
| --- | --- |
| `input` | `3338323539503530` |
| `expected` | `08` |

---

[← All algorithms](../README.md)
