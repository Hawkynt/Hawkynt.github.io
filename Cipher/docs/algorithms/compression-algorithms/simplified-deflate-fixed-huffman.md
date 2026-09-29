# Simplified Deflate (Fixed Huffman)

> Raw RFC 1951 DEFLATE restricted to fixed-Huffman blocks. The encoder emits a single BFINAL=1, BTYPE=01 block over the fixed literal/length and distance alphabets of section 3.2.6, with LZ77 matching across a 32 KiB window; no dynamic code lengths are ever transmitted. Output is a conforming raw DEFLATE stream that any inflater reads. The decoder handles stored and fixed blocks; dynamic blocks are the full DEFLATE implementation's job.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary + Entropy Coding |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Phil Katz |
| Year | 1991 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/deflate-simple.js`](../../../algorithms/compression/deflate-simple.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [RFC 1951 - DEFLATE Compressed Data Format](https://www.rfc-editor.org/rfc/rfc1951)
- [An Explanation of the Deflate Algorithm](https://www.zlib.net/feldspar.html)
- [LZ77 and LZ78](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

## References

- [zlib reference implementation](https://www.zlib.net/)
- [infgen - DEFLATE stream disassembler](https://github.com/madler/infgen)
- [PKZIP APPNOTE](https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - bare final fixed block with end-of-block only](https://www.rfc-editor.org/rfc/rfc1951)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `0300` |

**Vector 2** — [Single literal - 0x30+65 then end-of-block](https://www.rfc-editor.org/rfc/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `730400` |

**Vector 3** — [Literal then length 7 at distance 1 - overlapping match](https://www.zlib.net/feldspar.html)

| Field | Value |
| --- | --- |
| `input` | `4141414141414141` |
| `expected` | `73840200` |

**Vector 4** — [Three literals then length 6 at distance 3](https://www.rfc-editor.org/rfc/rfc1951)

| Field | Value |
| --- | --- |
| `input` | `414243414243414243` |
| `expected` | `737472862000` |

**Vector 5** — Repeated phrase round-trip

Source: Regression test for match emission

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e` |
| `expected` | _(empty)_ |

**Vector 6** — All 256 byte values round-trip

Source: Regression test for the 9-bit literal range

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

**Vector 7** — Long run round-trip

Source: Regression test for maximum match length

| Field | Value |
| --- | --- |
| `input` | `5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a 5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a 5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a 5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a …` (1024 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
