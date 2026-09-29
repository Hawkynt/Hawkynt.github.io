# ICCID

> ICCID (Integrated Circuit Card Identifier) check digit for SIM cards using Luhn algorithm. 18-20 digit identifier per ITU-T E.118 standard. Format: 89 (telecom) + CC (country) + issuer + account + check digit. Used in GSM, UMTS, LTE SIM cards worldwide.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Telecom Identifier |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | ITU-T (International Telecommunication Union) |
| Year | 1998 |
| Origin | Not specified |
| Source | [`algorithms/checksum/iccid-checksum.js`](../../../algorithms/checksum/iccid-checksum.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 89 CC II... (18-20 digits)
- 89: Major industry identifier (Telecom)
- CC: Country code (ISO 3166-1 numeric)
- II: Issuer identifier
- Account/serial number + check digit
- Algorithm: Luhn (same as credit cards)
- Usually printed on SIM card
- Command: AT+CCID or AT+ICCID
- Example: 89014103211234567890
- Detects: All single-digit errors

## Documentation

- [ICCID on Wikipedia](https://en.wikipedia.org/wiki/SIM_card)
- [ITU-T E.118](https://www.itu.int/rec/T-REC-E.118/en)
- [SIM Card Numbering](https://www.gsma.com/aboutus/wp-content/uploads/2014/12/ts.06-v5.0.pdf)

## References

- [python-stdnum Luhn implementation (used for ICCID check digit)](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/luhn.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Official ICCID 89148000005339755555](https://www.itu.int/rec/T-REC-E.118/en)

| Field | Value |
| --- | --- |
| `input` | `38393134383030303030353333393735353535` |
| `expected` | `05` |

**Vector 2** — [US AT&T ICCID pattern](https://www.gsma.com/aboutus/wp-content/uploads/2014/12/ts.06-v5.0.pdf)

| Field | Value |
| --- | --- |
| `input` | `38393031343130313233343536373839303132` |
| `expected` | `02` |

**Vector 3** — [DE Vodafone ICCID pattern](https://www.itu.int/rec/T-REC-E.118/en)

| Field | Value |
| --- | --- |
| `input` | `38393439313031323334353637383930313233` |
| `expected` | `02` |

---

[← All algorithms](../README.md)
