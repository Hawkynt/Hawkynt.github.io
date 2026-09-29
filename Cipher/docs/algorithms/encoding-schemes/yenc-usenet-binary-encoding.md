# yEnc (Usenet Binary Encoding)

> Binary-to-text encoding scheme developed by Jürgen Helbing for Usenet newsgroup postings. More efficient than UUEncoding and Base64 for binary data transmission over 8-bit clean channels, achieving only ~2% overhead. Educational implementation following yEnc specification 1.2.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Binary-to-Text Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Jürgen Helbing |
| Year | 2001 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/encoding/yenc.js`](../../../algorithms/encoding/yenc.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [yEnc Specification 1.2](http://www.yenc.org/yenc-draft.1.2.txt)
- [yEnc Efficiency Analysis](http://www.yenc.org/efficiency.html)
- [Usenet Binary Encoding Standards](https://tools.ietf.org/html/rfc1036)

## References

- [yEnc.org - Original Implementation](http://www.yenc.org/)
- [Usenet Binary Tools](https://github.com/topics/usenet)
- [Binary Encoding Comparison Study](https://www.researchgate.net/publication/binary-encoding-efficiency)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [yEnc empty data test](http://www.yenc.org/yenc-draft.1.2.txt)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Single byte encoding test - yEnc](http://www.yenc.org/yenc-draft.1.2.txt)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `6b` |

**Vector 3** — [NULL byte escaping test - yEnc](http://www.yenc.org/yenc-draft.1.2.txt)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `3d6a` |

---

[← All algorithms](../README.md)
