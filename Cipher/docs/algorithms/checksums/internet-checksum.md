# Internet-Checksum

> Internet checksum algorithm (RFC 1071) used in IPv4, TCP, UDP protocols. Uses 16-bit one's complement arithmetic for network packet header integrity verification.

## Properties

| Property | Value |
| --- | --- |
| Category | Checksums |
| Sub-category | Network Protocol Checksum |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Internet Engineering Task Force (IETF) |
| Year | 1988 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/checksum/internet-checksum.js`](../../../algorithms/checksum/internet-checksum.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Not Cryptographically Secure | Designed for error detection only, not security - can be easily forged | — |
| Collision Prone | 16-bit checksum provides limited collision resistance | — |
| No Protection Against Reordering | Cannot detect packet reordering or replay attacks | — |

## Documentation

- [RFC 1071 - Computing the Internet Checksum](https://tools.ietf.org/rfc/rfc1071.txt)
- [Internet Protocol Specification](https://tools.ietf.org/rfc/rfc791.txt)
- [TCP Specification](https://tools.ietf.org/rfc/rfc793.txt)

## References

- [IPv4 Header Format](https://en.wikipedia.org/wiki/IPv4#Header)
- [TCP Header Format](https://en.wikipedia.org/wiki/Transmission_Control_Protocol#TCP_segment_structure)
- [UDP Header Format](https://en.wikipedia.org/wiki/User_Datagram_Protocol#UDP_datagram_structure)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty data

Source: RFC 1071 - empty data gives all 1s checksum

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `ffff` |

**Vector 2** — IPv4 header example

Source: RFC 1071 style IPv4 header checksum

| Field | Value |
| --- | --- |
| `input` | `4500003044224000800600008c7053548c70545f` |
| `expected` | `f611` |

**Vector 3** — Sequential bytes 1-4

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `0001000200030004` |
| `expected` | `fff5` |

**Vector 4** — Partial IPv4 header

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `45000020000040004006` |
| `expected` | `3ad9` |

---

[← All algorithms](../README.md)
