# LZWL

> LZW whose initial dictionary is seeded with the input's most frequent byte digrams (found via an up-front frequency analysis), so common byte pairs get single codes from the start. Otherwise a standard trie-based LZW with a decoder-mirrored code-width counter and an explicit stop code.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Jan Platos, Jiri Dvorsky, Vaclav Snasel |
| Year | 2006 |
| Origin | ❓ Unknown |
| Source | [`algorithms/compression/lzwl.js`](../../../algorithms/compression/lzwl.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [LZWL (Wikipedia)](https://en.wikipedia.org/wiki/LZWL)
- [Lempel-Ziv-Welch (base algorithm)](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch)

## References

- [LZW compression overview](https://www.geeksforgeeks.org/computer-networks/lzw-lempel-ziv-welch-compression-technique/)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/LZWL)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte](https://en.wikipedia.org/wiki/LZWL)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000000020c000` |

**Vector 3** — [Highly repetitive input (256 'a' bytes)](https://en.wikipedia.org/wiki/LZWL)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `00010000010061618040a070482c1a0f 0884c2a170c86c3a1f1088c4a27148ac 0e02` |

**Vector 4** — [All 256 byte values once each, in order](https://en.wikipedia.org/wiki/LZWL)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `000100000000000040403020140c0704 024140b060341c0f0804424130a0542c 170c064341b0e0743c1f100844423120 944c27140a4542b160b45c2f180c4643 …` (296 bytes; the full value is in the source) |

**Vector 5** — [Every digram over 0x70..0x73 exactly twice - the frequency sort ties throughout, so the table pins the ascending-digram-value rule](https://en.wikipedia.org/wiki/LZWL)

| Field | Value |
| --- | --- |
| `input` | `70707071707270737170717171727173 72707271727272737370737173727373 70707071707270737170717171727173 72707271727272737370737173727373` |
| `expected` | `40000000100070707071707270737170 71717172717372707271727272737371 737273737370804060503824160d0784 426150b87c321b0e88c12110c80c1613 0d8141a15208f47220` |

**Vector 6** — ['the quick brown fox...' repeated 4 times (digram-sort tie-break stress test)](https://en.wikipedia.org/wiki/LZWL)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4000000290065206865746820742062 20642066206a206c206f20712e20617a 6272636b646f6572666f672e69636a75 6b206c616d706e206f676f766f776f78 707371757220726f73207569756d7665 776e782079207a79814023d138ac3637 1888c9a291790c6a210380c22192787c 4a732b9143a092092c1a390791c76132 48fcaa772882c66174f9650e5f469952 66b4c9c53e2d519f5527556975166348 9a52e6f4e9d5827b53104a40` |

---

[← All algorithms](../README.md)
