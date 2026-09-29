# LZVN

> Byte-oriented opcode LZ77 in the spirit of Apple's fast LZVN codec, with tiered distance encoding. Follows LZVN's documented single-byte-opcode shape but is not a byte-exact reproduction of Apple's undocumented real bitstream.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Apple Inc. |
| Year | 2015 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/lzvn.js`](../../../algorithms/compression/lzvn.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Apple Compression Documentation](https://developer.apple.com/documentation/compression/algorithm)
- [LZVN Technical Analysis](https://blog.yossarian.net/2021/06/01/Playing-with-Apples-weird-compression-formats)

## References

- [LZFSE Repository (includes LZVN)](https://github.com/lzfse/lzfse)
- [Apple StackExchange Discussion](https://apple.stackexchange.com/questions/378319/what-is-the-full-name-for-lzvn-the-compression-algorithm)
- [Reverse Engineering Analysis](https://encode.su/threads/2221-LZFSE-New-Apple-Data-Compression)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte literal](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000001f41` |

**Vector 3** — [Two character literals](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | `020000002f4142` |

**Vector 4** — [Repeating pattern - dictionary reference](https://encode.su/threads/2221-LZFSE-New-Apple-Data-Compression)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `060000003041424302` |

**Vector 5** — [Text with no repetition - all literals](https://github.com/lzfse/lzfse/blob/master/README.md)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c64` |
| `expected` | `0b000000bf48656c6c6f20576f726c64` |

**Vector 6** — [Structured pattern with clear repetition](https://blog.yossarian.net/2021/06/01/Playing-with-Apples-weird-compression-formats)

| Field | Value |
| --- | --- |
| `input` | `616263646566616263646566` |
| `expected` | `0c0000006361626364656605` |

**Vector 7** — [Repeated text sample (4x)](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4000000f11074686520717569636b20 62726f776e20666f78206a756d707320 6f766572201e926c617a7920646f672e 0d0e722c` |

**Vector 8** — [256 repeated bytes](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `000100001e61ee00` |

**Vector 9** — [All 256 byte values](https://github.com/lzfse/lzfse)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000fff100010203040506070809 0a0b0c0d0e0f10111213141516171819 1a1b1c1d1e1f20212223242526272829 2a2b2c2d2e2f30313233343536373839 …` (262 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
