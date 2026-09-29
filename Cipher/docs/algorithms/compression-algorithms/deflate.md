# DEFLATE

> Industry-standard lossless compression combining LZ77 and Huffman coding. Used in ZIP, gzip, PNG, and HTTP compression. Full RFC 1951 implementation.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Hybrid |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Phil Katz |
| Year | 1993 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/deflate.js`](../../../algorithms/compression/deflate.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 1951 - DEFLATE Specification](https://www.rfc-editor.org/rfc/rfc1951)
- [RFC 1950 - zlib Format](https://www.rfc-editor.org/rfc/rfc1950)
- [RFC 1952 - gzip Format](https://www.rfc-editor.org/rfc/rfc1952)

## References

- [zlib Library](https://github.com/madler/zlib)
- [DEFLATE Wikipedia](https://en.wikipedia.org/wiki/Deflate)
- [PNG Specification](https://www.w3.org/TR/PNG/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [RFC 1951 DEFLATE round-trip - hello](https://www.rfc-editor.org/rfc/rfc1951.txt)

| Field | Value |
| --- | --- |
| `input` | `68656c6c6f` |
| `expected` | _(empty)_ |

**Vector 2** — [RFC 1951 DEFLATE round-trip - AAAA](https://www.rfc-editor.org/rfc/rfc1951.txt)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | _(empty)_ |

**Vector 3** — [RFC 1951 DEFLATE round-trip - ABCABCABC](https://www.rfc-editor.org/rfc/rfc1951.txt)

| Field | Value |
| --- | --- |
| `input` | `414243414243414243` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
