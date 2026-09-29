# LZW (Lempel-Ziv-Welch)

> Dictionary-based compression algorithm that builds a table of frequently occurring strings, starting from a dictionary of all single bytes and adding new patterns dynamically. Emits a pure variable-width (9-16 bit) LZW bitstream, LSB-first packed, with clear and stop codes and no length header - matching CompressionWorkbench's BB_Lzw building block. Used in GIF/TIFF formats.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Terry Welch |
| Year | 1984 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/lzw.js`](../../../algorithms/compression/lzw.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [A Technique for High-Performance Data Compression](https://ieeexplore.ieee.org/document/1659158)
- [LZW - Wikipedia](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)
- [GIF Format Specification](https://www.w3.org/Graphics/GIF/spec-gif89a.txt)

## References

- [Original IEEE Paper by Terry Welch](https://ieeexplore.ieee.org/document/1659158)
- [TIFF LZW Reference](https://github.com/vadimkantorov/pytiff)
- [Educational LZW Implementation](https://rosettacode.org/wiki/LZW_compression)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - still emits clear code and stop code](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `000302` |

**Vector 2** — [Single byte - no dictionary matches possible](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `00830404` |

**Vector 3** — [Repeated two-character pattern - Wikipedia example](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)

| Field | Value |
| --- | --- |
| `input` | `41424142414241424142` |
| `expected` | `008308114870a09080` |

**Vector 4** — [Classic Shakespeare-inspired LZW test string - Wikipedia](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)

| Field | Value |
| --- | --- |
| `input` | `544f42454f524e4f54544f42454f52544f42454f524e4f54` |
| `expected` | `00a93c1152e48914274fa80824687061c183090302` |

**Vector 5** — Maximum redundancy test (all identical characters)

Source: Edge case - maximum compression ratio

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141` |
| `expected` | `0083081c483020` |

**Vector 6** — All 256 byte values 0..255 once each - no repetition

Source: Edge case - minimal compression benefit

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010410308040010307102450b08041 03070f204490308142050b173064d0b0 8143070f1f40841031824409132750a4 50b182450b172f60c4903183460d1b37 …` (291 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
