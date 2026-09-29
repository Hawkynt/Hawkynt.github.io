# LZ4

> Lossless compression algorithm focused on compression and decompression speed. Uses byte-oriented encoding with tokens for literals and match copies. Optimized for speed over compression ratio.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Yann Collet |
| Year | 2011 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/compression/lz4.js`](../../../algorithms/compression/lz4.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [LZ4 Official Website](https://lz4.org/)
- [LZ4 Block Format Specification](https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md)
- [LZ4 Wikipedia](https://en.wikipedia.org/wiki/LZ4_(compression_algorithm))

## References

- [Official LZ4 Implementation](https://github.com/lz4/lz4)
- [xxHash (by same author)](https://github.com/Cyan4973/xxHash)
- [Real World Compression Benchmark](https://github.com/inikep/lzbench)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 0x41](https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000001041` |

**Vector 3** — [All literals, too short for a match - AAAAA](https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | `4141414141` |
| `expected` | `05000000504141414141` |

**Vector 4** — [All literals, too short for a match - ABCDABCD](https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | `4142434441424344` |
| `expected` | `08000000804142434441424344` |

**Vector 5** — [Text sample with a real match - 'the quick brown fox...' x4](https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4000000f01074686520717569636b20 62726f776e20666f78206a756d707320 6f766572201f00916c617a7920646f67 2e0e000f2d006b50646f672e20` |

---

[← All algorithms](../README.md)
