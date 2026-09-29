# Base16

> Base16 (hexadecimal) encoding using 16-character alphabet to represent binary data. Each byte is represented by two hex digits (0-9, A-F). Educational implementation following RFC 4648 standard.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Base Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | RFC Working Group |
| Year | 1969 |
| Origin | 🌐 International |
| Source | [`algorithms/encoding/base16.js`](../../../algorithms/encoding/base16.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 4648 - The Base16, Base32, and Base64 Data Encodings](https://tools.ietf.org/html/rfc4648)
- [Wikipedia - Hexadecimal](https://en.wikipedia.org/wiki/Hexadecimal)
- [Base16 Online Converter](https://base64.guru/converter/encode/hex)

## References

- [IEEE Standard 754](https://ieeexplore.ieee.org/document/8766229)
- [ASCII Hex Representation](https://www.asciitable.com/)
- [Binary to Hex Conversion](https://www.rapidtables.com/convert/number/binary-to-hex.html)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Base16 empty string test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Base16 single character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `66` |
| `expected` | `3636` |

**Vector 3** — [Base16 two character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f` |
| `expected` | `36363646` |

**Vector 4** — [Base16 three character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f` |
| `expected` | `363636463646` |

**Vector 5** — [Base16 four character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f62` |
| `expected` | `3636364636463632` |

**Vector 6** — [Base16 five character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f6261` |
| `expected` | `36363646364636323631` |

**Vector 7** — [Base16 six character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f626172` |
| `expected` | `363636463646363236313732` |

---

[← All algorithms](../README.md)
