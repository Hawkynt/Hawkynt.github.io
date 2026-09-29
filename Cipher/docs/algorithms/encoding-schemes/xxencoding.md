# XXencoding

> Binary-to-text encoding similar to UUencoding but uses a different character set designed to avoid problematic characters in some communication systems. Alternative encoding method for transmitting binary data over text-based protocols. Educational implementation for learning purposes.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Mail Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | Unix Community |
| Year | 1980 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/encoding/xxencode.js`](../../../algorithms/encoding/xxencode.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [XXencode Specification](https://en.wikipedia.org/wiki/Xxencoding)
- [UUencoding Alternatives](https://tools.ietf.org/html/rfc1341)
- [Binary Encoding History](https://www.unix.org/what_is_unix/history_timeline.html)

## References

- [Unix Mail Systems](https://tools.ietf.org/html/rfc822)
- [Text-based Binary Transfer](https://www.ietf.org/rfc/rfc2045.txt)
- [Character Set Standards](https://www.ascii-code.com/)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — XXencode empty data test

Source: Educational standard

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Basic 3-byte zero test - XXencode

Source: Educational example

| Field | Value |
| --- | --- |
| `input` | `000000` |
| `expected` | `2b2b2b2b` |

**Vector 3** — Simple pattern encoding test - XXencode

Source: Educational standard

| Field | Value |
| --- | --- |
| `input` | `010203` |
| `expected` | `2b453631` |

**Vector 4** — [XXencode 1-byte group - eight data bits need exactly two 6-bit symbols](https://en.wikipedia.org/wiki/Xxencoding)

| Field | Value |
| --- | --- |
| `input` | `4d` |
| `expected` | `4845` |

**Vector 5** — [XXencode 2-byte group - sixteen data bits need exactly three 6-bit symbols](https://en.wikipedia.org/wiki/Xxencoding)

| Field | Value |
| --- | --- |
| `input` | `4d61` |
| `expected` | `484b32` |

**Vector 6** — [XXencode trailing NUL regression test - the old decoder stripped trailing zero bytes as if they were padding, so any payload ending in NUL decoded short and could not be re-encoded](https://en.wikipedia.org/wiki/Xxencoding)

| Field | Value |
| --- | --- |
| `input` | `01020300` |
| `expected` | `2b4536312b2b` |

**Vector 7** — [XXencode all-NUL payload regression test - the old decoder returned an empty array for any all-zero payload](https://en.wikipedia.org/wiki/Xxencoding)

| Field | Value |
| --- | --- |
| `input` | `0000000000` |
| `expected` | `2b2b2b2b2b2b2b` |

---

[← All algorithms](../README.md)
