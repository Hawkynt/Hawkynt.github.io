# Deflate64

> Enhanced DEFLATE (ZIP compression method 9) with a 64KB sliding window, distance codes up to 65536, and a 16-bit extended length code reaching matches up to 65538 bytes. Always uses dynamic Huffman blocks - no fixed table is defined for the extended alphabet.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Hybrid |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | PKWARE |
| Year | 2001 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/deflate64.js`](../../../algorithms/compression/deflate64.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [.ZIP File Format Specification (APPNOTE.TXT)](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)
- [RFC 1951 - DEFLATE Specification (base algorithm)](https://www.rfc-editor.org/rfc/rfc1951)

## References

- [.NET Deflate64Stream](https://learn.microsoft.com/en-us/dotnet/api/system.io.compression.deflate64stream)
- [DEFLATE Wikipedia](https://en.wikipedia.org/wiki/Deflate)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Deflate64 round-trip - hello](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `68656c6c6f` |
| `expected` | _(empty)_ |

**Vector 2** — [Deflate64 round-trip - AAAA](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | _(empty)_ |

**Vector 3** — [Deflate64 round-trip - ABCABCABC](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

| Field | Value |
| --- | --- |
| `input` | `414243414243414243` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
