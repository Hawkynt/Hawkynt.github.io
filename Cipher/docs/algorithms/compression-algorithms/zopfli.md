# Zopfli

> Iterative-optimal DEFLATE encoder from Google (2013). Parses the input by shortest path over the entropy of the previous parse's symbol counts, repeats until the size stops falling, and searches for the block boundaries that minimise the total. Output is standard RFC 1951 DEFLATE, decodable by any conforming reader.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Deflate Optimizer (LZ77 + Huffman) |
| Security status | Not classified |
| Complexity | Expert |
| Inventor | Lode Vandevenne, Jyrki Alakuijala (Google) |
| Year | 2013 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/zopfli.js`](../../../algorithms/compression/zopfli.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Zopfli Announcement (2013)](https://opensource.googleblog.com/2013/02/compress-data-more-densely-with-zopfli.html)
- [RFC 1951 - Deflate Format](https://datatracker.ietf.org/doc/html/rfc1951)
- [Zopfli Wikipedia](https://en.wikipedia.org/wiki/Zopfli)

## References

- [Official Google Zopfli Repository (C reference implementation)](https://github.com/google/zopfli)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Zopfli RFC 1951 round-trip - hello](https://datatracker.ietf.org/doc/html/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `68656c6c6f` |
| `expected` | _(empty)_ |

**Vector 2** — [Zopfli RFC 1951 round-trip - AAAA](https://datatracker.ietf.org/doc/html/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | _(empty)_ |

**Vector 3** — [Zopfli RFC 1951 round-trip - ABCABCABC](https://datatracker.ietf.org/doc/html/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `414243414243414243` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
