# Brotli

> RFC 7932-compatible Brotli codec. The decoder implements the full RFC 7932 bitstream grammar (meta-block framing, complex/simple prefix codes, block-switch commands, insert-and-copy commands, distance ring buffer, context modeling, and the static dictionary with word transforms) and correctly reads streams from conformant encoders such as zlib's brotliCompressSync. The encoder exploits the format rather than emitting bare LZ77 plus Huffman: literal context modeling (all four context modes, with the 64 contexts clustered into up to 16 literal prefix codes and sent as a context map), the distance ring buffer including the implicit-distance insert-and-copy ranges, run-length coded prefix code descriptors, cost-driven meta-block splitting with a per-meta-block uncompressed fallback, and static dictionary references searched with a hash index over the Appendix A word list and coded with the Appendix B transforms. It does not use the OmitFirst word transforms, multiple block types with block-switch commands, non-zero NPOSTFIX/NDIRECT, distance context modeling, or an optimal parse.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary + Entropy Coding |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Jyrki Alakuijala, Zoltan Szabadka (Google) |
| Year | 2013 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/brotli.js`](../../../algorithms/compression/brotli.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| [Compression Bomb (Decompression Bomb)](https://en.wikipedia.org/wiki/Zip_bomb) | — | Maliciously crafted Brotli streams with high compression ratios can decompress to extremely large outputs, causing memory exhaustion. Always validate and limit decompressed output size before decompression. |
| [Memory Exhaustion via Window Size](https://datatracker.ietf.org/doc/html/rfc7932#section-9.1) | — | Attackers can specify large window sizes (up to 16MB) causing excessive memory allocation. Limit window size for untrusted input. |

## Notes

- DECODER: full RFC 7932 grammar, including the static dictionary and word transforms - reads real-world
- Brotli streams (verified against zlib's brotliCompressSync output, including compressed meta-blocks
- that reference the static dictionary)
- ENCODER: hash-chain LZ77 (minimum match 4, cost-aware ranking, two-step lazy matching) plus
- canonical, length-limited (package-merge, RFC-capped at 15 bits for data alphabets / 5 bits for
- the code-length alphabet) prefix coding. Implements literal context modeling (Section 7.1, all
- four modes, 64 contexts clustered into up to 16 trees and sent as a context map per Section 7.3),
- the distance ring buffer with codes 0-15 and the implicit-distance insert-and-copy ranges
- (Sections 4 and 5), run-length coded complex prefix code descriptors (Section 3.5),
- cost-driven meta-block splitting with a per-meta-block uncompressed fallback (Section 9.2),
- and static dictionary references (Section 8) found through a hash index over the first four
- bytes of every word form and coded with the Appendix B word transforms
- ENCODER LIMITATIONS: the OmitFirst1-9 word transforms are not searched (8 of the 121 in
- Appendix B; they carry no prefix or suffix), one block type per category (no block-switch
- commands, Section 6), NPOSTFIX=0 and NDIRECT=0 (Section 4), no distance context modeling
- (Section 7.2), and a cost-ranked greedy parse with two lazy steps rather than an optimal one.
- Verified byte-for-byte interoperable with zlib's brotliDecompressSync and the
- reference `brotli` CLI in both directions, and byte-identical to the CompressionWorkbench
- C# encoder for the same input
- Static dictionary (Appendix A, 122,784 bytes) and word transforms (Appendix B, 121 entries) are
- transcribed directly from the RFC 7932 specification text and verified against its own CRC-32 checks
- **Implementation:** Pure JavaScript, RFC 7932 bitstream-compatible in both directions

## Documentation

- [RFC 7932 - Brotli Compressed Data Format](https://datatracker.ietf.org/doc/html/rfc7932)
- [RFC 9841 - Shared Brotli Compressed Data Format](https://datatracker.ietf.org/doc/rfc9841/)
- [Official Brotli Repository](https://github.com/google/brotli)
- [Google Brotli Announcement (2015)](https://opensource.googleblog.com/2015/09/introducing-brotli-new-compression.html)

## References

- [RFC 7932 Section 8 - Static Dictionary](https://datatracker.ietf.org/doc/html/rfc7932#section-8)
- [RFC 7932 Section 9 - Compressed Data Format](https://datatracker.ietf.org/doc/html/rfc7932#section-9)
- [Node.js zlib Brotli bindings (interop reference)](https://nodejs.org/api/zlib.html#zlib-constants)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Round-trip - Empty input](https://datatracker.ietf.org/doc/html/rfc7932#section-9.2)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Interop - decode real zlib brotliCompressSync('Hello, World!') output (uncompressed meta-block)](https://nodejs.org/api/zlib.html)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `input` | `0b068048656c6c6f2c20576f726c642103` |
| `expected` | `48656c6c6f2c20576f726c6421` |

**Vector 3** — [Interop - decode real zlib brotliCompressSync output using Huffman/context-coded meta-block + static dictionary](https://nodejs.org/api/zlib.html)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `input` | `1b6701888c946ee622d083a5ba905e13 148d807c430b830d387048206f24bc41 a715ce66c7e34485a560239c7af58749 8101` |
| `expected` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 …` (360 bytes; the full value is in the source) |

**Vector 4** — [Interop - decode real zlib brotliCompressSync output of pseudo-random binary data](https://nodejs.org/api/zlib.html)

| Field | Value |
| --- | --- |
| `inverse` | Yes |
| `input` | `1bff01f8af8bb705ff306b83267bfcc3 5b3dd043b93fce189cd7ca005d5c1c17 42186f0cce0b2d0df0c1c571a1f7e9e6 e0bcd2d2001f5c1c577a9f6e0ece1b98 52200fc6a2f18a4f8726d47539f179dc 37dad4360025d47962ee799c87e9d596 ff4b77cc1d9189f7b9a8f2e5fbafb0a9 43043ad44528bb3c2e1726b64d81f665 9e965deae70926d6f5ffeccb3810b5d4 f74dd5acf3fb84ddc70651876b9f445c 7edfc34d6c00feca978909d9d40fe31a eafa52b93c0e4336b67d7b0d65be2fb9 dc778835b675111965ba2f375b5f0128 7fae03b34dcfbd990ef5079f7479208c 26b64d99f8329f9036f55d13` |
| `expected` | `0b30557a9fc4e90e33587da2c7ec1136 5b80a5caef14395e83a8cdf2173c6186 abd0f51a3f6489aed3f81d42678cb1d6 fb20456a8fb4d9fe23486d92b7dc0126 …` (512 bytes; the full value is in the source) |

**Vector 5** — [Regression - single byte round-trips through our own encoder/decoder](https://github.com/google/brotli/tree/master/tests/testdata)

| Field | Value |
| --- | --- |
| `input` | `58` |
| `expected` | _(empty)_ |

**Vector 6** — [Brotli Round-trip - Pangram](https://github.com/google/brotli/blob/master/tests/testdata)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f67` |
| `expected` | _(empty)_ |

**Vector 7** — [Brotli Round-trip - Binary data](https://datatracker.ietf.org/doc/html/rfc7932)

| Field | Value |
| --- | --- |
| `input` | `aaaaaaaaaaaaaaaaaaaa` |
| `expected` | _(empty)_ |

**Vector 8** — [Brotli Round-trip - all 256 byte values](https://datatracker.ietf.org/doc/html/rfc7932)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
