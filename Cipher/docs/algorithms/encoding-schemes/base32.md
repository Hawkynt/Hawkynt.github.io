# Base32

> Base32 encoding scheme using 32-character alphabet for case-insensitive encoding. More human-readable than Base64 and commonly used in authentication systems like TOTP. Educational implementation following RFC 4648 standard.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Base Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Privacy-Enhanced Mail (PEM) Working Group |
| Year | 2006 |
| Origin | 🌐 International |
| Source | [`algorithms/encoding/base32.js`](../../../algorithms/encoding/base32.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 4648 - The Base16, Base32, and Base64 Data Encodings](https://tools.ietf.org/html/rfc4648)
- [Wikipedia - Base32](https://en.wikipedia.org/wiki/Base32)
- [Base32 Crockford](https://www.crockford.com/base32.html)

## References

- [Google Authenticator](https://github.com/google/google-authenticator)
- [TOTP Specification](https://tools.ietf.org/html/rfc6238)
- [Base32 Online Decoder](https://base32decode.org/)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Base32 empty string test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Base32 single character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `66` |
| `expected` | `4d593d3d3d3d3d3d` |

**Vector 3** — [Base32 two character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f` |
| `expected` | `4d5a58513d3d3d3d` |

**Vector 4** — [Base32 three character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f` |
| `expected` | `4d5a5857363d3d3d` |

**Vector 5** — [Base32 four character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f62` |
| `expected` | `4d5a58573659513d` |

**Vector 6** — [Base32 five character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f6261` |
| `expected` | `4d5a585736595442` |

**Vector 7** — [Base32 six character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f626172` |
| `expected` | `4d5a5857365954424f493d3d3d3d3d3d` |

---

[← All algorithms](../README.md)
