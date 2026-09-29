# Base64

> Base64 encoding scheme using 64-character alphabet to represent binary data in ASCII string format. Commonly used for email attachments, data URLs, and web APIs. Educational implementation following RFC 4648 standard.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Base Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Privacy-Enhanced Mail (PEM) Working Group |
| Year | 1993 |
| Origin | 🌐 International |
| Source | [`algorithms/encoding/base64.js`](../../../algorithms/encoding/base64.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 4648 - The Base16, Base32, and Base64 Data Encodings](https://tools.ietf.org/html/rfc4648)
- [Wikipedia - Base64](https://en.wikipedia.org/wiki/Base64)
- [Mozilla Base64 Guide](https://developer.mozilla.org/en-US/docs/Web/API/btoa)

## References

- [RFC 2045 - MIME Part One](https://tools.ietf.org/html/rfc2045)
- [Base64 Online Decoder](https://www.base64decode.org/)
- [Data URL Specification](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Base64 empty string test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Base64 single character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `66` |
| `expected` | `5a673d3d` |

**Vector 3** — [Base64 two character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f` |
| `expected` | `5a6d383d` |

**Vector 4** — [Base64 three character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f` |
| `expected` | `5a6d3976` |

**Vector 5** — [Base64 four character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f62` |
| `expected` | `5a6d397659673d3d` |

**Vector 6** — [Base64 five character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f6261` |
| `expected` | `5a6d3976596d453d` |

**Vector 7** — [Base64 six character test - RFC 4648](https://tools.ietf.org/html/rfc4648#section-10)

| Field | Value |
| --- | --- |
| `input` | `666f6f626172` |
| `expected` | `5a6d3976596d4679` |

---

[← All algorithms](../README.md)
