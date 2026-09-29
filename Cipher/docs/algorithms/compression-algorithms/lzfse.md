# LZFSE

> Apple's Lempel-Ziv Finite State Entropy compression algorithm. Splits the LZ77 parse into literal/length/distance streams and entropy-codes each with FSE (tANS), with an overflow stream for values outside the small direct symbol alphabet. Follows LZFSE's documented shape but is not a byte-compatible reproduction of Apple's real bitstream (whose bucket tables are unpublished).

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Apple Inc. |
| Year | 2015 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/lzfse.js`](../../../algorithms/compression/lzfse.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [LZFSE GitHub Repository (Apple reference implementation)](https://github.com/lzfse/lzfse)
- [LZFSE Wikipedia](https://en.wikipedia.org/wiki/LZFSE)
- [Apple Developer Documentation](https://developer.apple.com/documentation/compression/compression_lzfse)

## References

- [LZFSE GitHub Repository](https://github.com/lzfse/lzfse)
- [Apple's Compression Framework](https://developer.apple.com/documentation/compression/algorithm/lzfse)
- [LZFSE Technical Analysis](https://encode.su/threads/2221-LZFSE-New-Apple-Data-Compression)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000000000000000000006000000 05000020002000000000000000000000 0000000000000000000000000000` |

**Vector 2** — [Single byte literal](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000000000000100000008000000 05010000002000200000000000000000 00000000000000000000000088000000 05410000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 0000000000200020` |

**Vector 3** — [Text with no repetition - all literals](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `0b000000000000000b0000001c000000 050b0000000000000000000000000000 00000000000000000020002000000000 00000000000000000000000000000000 …` (306 bytes; the full value is in the source) |

**Vector 4** — [Structured pattern with clear repetition](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | `616263646566616263646566` |
| `expected` | `0c000000010000000600000012000000 05060010000000000000000000000010 0046000000000a000000050200000000 00200020000000001200000005060000 …` (298 bytes; the full value is in the source) |

**Vector 5** — [Repeated text sample (4x)](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4000000030000002800000045000000 051f0010000000000000000000000000 00000000000800000000000000000000 00000000000000000000000000000000 …` (534 bytes; the full value is in the source) |

**Vector 6** — [256 repeated bytes](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `00010000010000000100000008000000 05010010001000460000000044000000 051f0000000000000000000000000000 00000000000000000000000000000000 …` (328 bytes; the full value is in the source) |

**Vector 7** — [All 256 byte values](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000000000000001000044000000 051f0000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000 …` (884 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
