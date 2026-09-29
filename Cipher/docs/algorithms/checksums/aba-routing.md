# ABA-Routing

> ABA Routing Number check digit for US bank identification. 9-digit code using weighted modulo-10 algorithm with weights 3,7,1 repeating. Found on checks for ACH transfers, wire transfers, and direct deposits. Administered by American Bankers Association.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Banking Identifier |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | American Bankers Association |
| Year | 1910 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/aba-routing.js`](../../../algorithms/checksum/aba-routing.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Format: 9 digits (8 data + 1 check)
- First 4 digits: Federal Reserve routing symbol
- Next 4 digits: ABA institution identifier
- Last digit: Check digit
- Weights: 3,7,1,3,7,1,3,7 for positions 1-8
- Algorithm: (3×d1 + 7×d2 + 1×d3 + ... + 7×d8) mod 10 = d9
- Found on: Bottom left of checks (MICR line)
- Example: 021000021 (JP Morgan Chase)
- Validates: ACH, wire transfers, direct deposit

## Documentation

- [ABA Routing Number on Wikipedia](https://en.wikipedia.org/wiki/ABA_routing_transit_number)
- [Federal Reserve Routing Directory](https://www.frbservices.org/)
- [ABA Routing Number Lookup](https://www.routingnumbers.org/)

## References

- [python-stdnum US RTN implementation](https://github.com/arthurdejong/python-stdnum/blob/master/stdnum/us/rtn.py)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [JP Morgan Chase (021000021)](https://en.wikipedia.org/wiki/ABA_routing_transit_number)

| Field | Value |
| --- | --- |
| `input` | `3032313030303032` |
| `expected` | `01` |

**Vector 2** — [Routing number 026000013](https://en.wikipedia.org/wiki/ABA_routing_transit_number)

| Field | Value |
| --- | --- |
| `input` | `3032363030303031` |
| `expected` | `03` |

**Vector 3** — [Routing number 121000028](https://en.wikipedia.org/wiki/ABA_routing_transit_number)

| Field | Value |
| --- | --- |
| `input` | `3132313030303032` |
| `expected` | `08` |

---

[← All algorithms](../README.md)
