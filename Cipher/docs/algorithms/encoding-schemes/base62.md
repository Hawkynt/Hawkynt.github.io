# Base62

> Base62 encoding using 62-character alphabet (A-Z, a-z, 0-9) for URL-safe, compact encoding. Commonly used in URL shortening services like bit.ly and for generating user-friendly database IDs. No padding required.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Base Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | URL Shortening Industry |
| Year | 2000 |
| Origin | 🌐 International |
| Source | [`algorithms/encoding/base62.js`](../../../algorithms/encoding/base62.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Base62 Wikipedia Article](https://en.wikipedia.org/wiki/Base62)
- [URL Shortening Best Practices](https://developers.google.com/url-shortener/v1/getting_started)
- [RFC 4648 - Base Encodings Background](https://tools.ietf.org/html/rfc4648)

## References

- [Base62 Online Encoder/Decoder](https://base62.io/)
- [Instagram Engineering - Sharding IDs](https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c)
- [System Design - URL Shortener](https://www.educative.io/courses/grokking-the-system-design-interview/m2ygV4E81AR)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Base62 empty string test](https://en.wikipedia.org/wiki/Base62)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Base62 zero byte test - maps to first alphabet character](https://en.wikipedia.org/wiki/Base62)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `41` |

**Vector 3** — [Base62 maximum byte test - 255 in Base62](https://en.wikipedia.org/wiki/Base62)

| Field | Value |
| --- | --- |
| `input` | `ff` |
| `expected` | `4548` |

**Vector 4** — [Base62 single byte - 72 ('H' ASCII)](https://en.wikipedia.org/wiki/Base62)

| Field | Value |
| --- | --- |
| `input` | `48` |
| `expected` | `424b` |

**Vector 5** — [Base62 three byte array test](https://en.wikipedia.org/wiki/Base62)

| Field | Value |
| --- | --- |
| `input` | `010203` |
| `expected` | `524c56` |

**Vector 6** — [Base62 leading zero byte test](https://en.wikipedia.org/wiki/Base62)

| Field | Value |
| --- | --- |
| `input` | `0001` |
| `expected` | `4142` |

---

[← All algorithms](../README.md)
