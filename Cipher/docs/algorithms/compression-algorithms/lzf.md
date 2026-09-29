# LZF

> Original Lempel-Ziv-Free compression by Marc Lehmann. Extremely fast compression algorithm optimized for speed with minimal memory overhead. Uses simple hash-based LZ77 matching with 2-byte minimum match length. Widely used in Redis, nginx, and other performance-critical applications.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Marc Lehmann |
| Year | 2000 |
| Origin | 🇩🇪 Germany |
| Source | [`algorithms/compression/lzf.js`](../../../algorithms/compression/lzf.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Official liblzf Homepage](http://software.schmorp.de/pkg/liblzf.html)
- [liblzf GitHub Mirror](https://github.com/nemequ/liblzf)
- [LZF Specification and API](https://github.com/nemequ/liblzf/blob/master/lzf.h)
- [Compress::LZF Perl Module](https://metacpan.org/pod/Compress::LZF)

## References

- [LZ77 Algorithm](https://en.wikipedia.org/wiki/LZ77_and_LZ78)
- [Redis LZF Usage](https://redis.io/docs/manual/persistence/)
- [ning/compress Java Implementation](https://github.com/ning/compress)

## Test vectors

11 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [All literals - no compression](https://github.com/nemequ/liblzf)

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `040000000341424344` |

**Vector 2** — [Simple repetition - AAAA](https://github.com/nemequ/liblzf)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `0400000000414000` |

**Vector 3** — [Long repetition - 10 A's](https://github.com/nemequ/liblzf)

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141` |
| `expected` | `0a0000000041e00100` |

**Vector 4** — [Pattern repetition - ABCABCABC](https://github.com/nemequ/liblzf)

| Field | Value |
| --- | --- |
| `input` | `414243414243414243` |
| `expected` | `0900000002414243a002` |

**Vector 5** — [Text compression with pattern](https://github.com/nemequ/liblzf)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f20576f726c64212048656c6c6f20576f726c6421` |
| `expected` | `190000000c48656c6c6f20576f726c642120e0040c` |

**Vector 6** — [Highly repetitive data](https://github.com/nemequ/liblzf)

| Field | Value |
| --- | --- |
| `input` | `42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 42424242424242424242424242424242 42424242` |
| `expected` | `640000000042e05b00` |

**Vector 7** — [Hash collision test data](https://github.com/ning/compress/blob/master/src/test/java/com/ning/compress/lzf/TestLZFRoundTrip.java)

| Field | Value |
| --- | --- |
| `input` | `00010203049940404009090909090909090909` |
| `expected` | `130000000900010203049940404009e00100` |

**Vector 8** — [Hash collision test data 2](https://github.com/ning/compress/blob/master/src/test/java/com/ning/compress/lzf/TestLZFRoundTrip.java)

| Field | Value |
| --- | --- |
| `input` | `019900000000994040400000000000000000000000000000` |
| `expected` | `18000000020199004000049940404000e00500` |

**Vector 9** — [Highly repetitive data - 300 bytes](https://github.com/nemequ/liblzf)

| Field | Value |
| --- | --- |
| `input` | `58585858585858585858585858585858 58585858585858585858585858585858 58585858585858585858585858585858 58585858585858585858585858585858 …` (300 bytes; the full value is in the source) |
| `expected` | `2c0100000058e0ff00e11c06` |

**Vector 10** — [Alternating pattern - 300 bytes](https://github.com/nemequ/liblzf)

| Field | Value |
| --- | --- |
| `input` | `5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 …` (300 bytes; the full value is in the source) |
| `expected` | `2c010000015a59e0ff01e11b07` |

**Vector 11** — [English text sample - repeated sentence](https://github.com/nemequ/liblzf)

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20546865 20717569636b2062726f776e20666f78 …` (450 bytes; the full value is in the source) |
| `expected` | `c20100001f54686520717569636b2062 726f776e20666f78206a756d7073206f 7665722074401e096c617a7920646f67 2e20e0ff2ce1860d` |

---

[← All algorithms](../README.md)
