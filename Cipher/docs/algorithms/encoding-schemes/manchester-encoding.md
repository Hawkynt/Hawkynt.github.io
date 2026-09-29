# Manchester Encoding

> Line code in which each data bit is represented by at least one transition. Combines clock and data signals and is self-synchronizing. Used in Ethernet 10Base-T and other network protocols. Educational implementation following IEEE 802.3 specification.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Line Code |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | G.E. Thomas |
| Year | 1949 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/encoding/manchester.js`](../../../algorithms/encoding/manchester.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [IEEE 802.3 Ethernet Standard](https://standards.ieee.org/standard/802_3-2018.html)
- [Manchester Code Wikipedia](https://en.wikipedia.org/wiki/Manchester_code)
- [Line Code Theory](https://www.electronics-tutorials.ws/sequential/seq_7.html)

## References

- [Ethernet Physical Layer](https://www.ieee802.org/3/)
- [G.E. Thomas Patent](https://patents.google.com/patent/US2632058)
- [Digital Communications](https://www.ece.rutgers.edu/~orfanidi/ece346/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Manchester empty data test

Source: IEEE 802.3 standard

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Single zero byte encoding test - Manchester

Source: Educational standard

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `00010001000100010001000100010001` |

**Vector 3** — Single byte with LSB set - Manchester

Source: IEEE 802.3 example

| Field | Value |
| --- | --- |
| `input` | `01` |
| `expected` | `00010001000100010001000100010100` |

---

[← All algorithms](../README.md)
