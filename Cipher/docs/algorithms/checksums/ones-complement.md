# Ones-Complement

> Internet protocol checksum using one's complement arithmetic. Sums 16-bit words with end-around carry, then inverts all bits. Used in IP, TCP, UDP, and ICMP headers for packet integrity verification.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Internet Protocol |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Internet Protocol designers |
| Year | 1974 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/complement.js`](../../../algorithms/checksum/complement.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Notes

- Algorithm: sum 16-bit words, add carry back (end-around carry), then NOT
- Used in: IPv4, TCP, UDP, ICMP headers
- Verification: sum of data + checksum should be 0xFFFF
- Handles odd-length data by padding with zero byte
- End-around carry: carry bits are added back to sum
- One's complement: invert all bits (~sum)
- Detects most common errors but not all reordering

## Documentation

- [RFC 1071 - Computing Internet Checksum](https://tools.ietf.org/html/rfc1071)
- [Internet Checksum on Wikipedia](https://en.wikipedia.org/wiki/IPv4_header_checksum)
- [TCP/IP Checksum Calculation](https://www.rfc-editor.org/rfc/rfc1624.html)

## References

- [Linux kernel Internet checksum implementation](https://github.com/torvalds/linux/blob/master/lib/checksum.c)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Two 16-bit words 0x0001 + 0x0002, complement 0xFFFC (RFC 1071 section 1 definition)](https://tools.ietf.org/html/rfc1071)

| Field | Value |
| --- | --- |
| `input` | `00010002` |
| `expected` | `fffc` |

**Vector 2** — [IP header fragment](https://tools.ietf.org/html/rfc1071)

| Field | Value |
| --- | --- |
| `input` | `0001f203f4f5f6f7` |
| `expected` | `220d` |

**Vector 3** — [Single word 0xFFFF, complement 0x0000 (RFC 1071 section 1 definition)](https://tools.ietf.org/html/rfc1071)

| Field | Value |
| --- | --- |
| `input` | `ffff` |
| `expected` | `0000` |

---

[← All algorithms](../README.md)
