# Lizard

> Efficient compressor with very fast decompression and compression ratios comparable to zip/zlib at fast decompression speed. Successor to LZ4 with improved entropy utilization and four compression levels (10, 20, 30, 40).

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Przemysław Skibiński, Yann Collet |
| Year | 2016 |
| Origin | Not specified |
| Source | [`algorithms/compression/lizard.js`](../../../algorithms/compression/lizard.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Lizard GitHub Repository](https://github.com/inikep/lizard)
- [Lizard Block Format Specification](https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md)
- [Lizard Frame Format Specification](https://github.com/inikep/lizard/blob/lizard/doc/lizard_Frame_format.md)

## References

- [Official Lizard Implementation](https://github.com/inikep/lizard/tree/lizard/lib)
- [LZ4 Compression (predecessor)](https://github.com/lz4/lz4)
- [Compression Benchmark](https://github.com/inikep/lzbench)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [All literals - no matches (ABCD)](https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `040000004041424344` |

**Vector 3** — [Simple repetition - AAAAA (5 A's, too short to search for a match)](https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | `4141414141` |
| `expected` | `05000000504141414141` |

**Vector 4** — [Pattern ABCABC (6 bytes, too short to search for a match)](https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | `414243414243` |
| `expected` | `0600000060414243414243` |

**Vector 5** — [Text sample with a real match - 'the quick brown fox...' x4](https://github.com/inikep/lizard/blob/lizard/doc/lizard_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4000000f01074686520717569636b20 62726f776e20666f78206a756d707320 6f766572201f00916c617a7920646f67 2e0e000f2d0070` |

---

[← All algorithms](../README.md)
