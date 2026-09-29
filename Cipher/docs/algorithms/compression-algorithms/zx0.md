# ZX0

> LZ77 compressor for 8-bit targets designed by Einar Saukas. Uses only three block types (literal, last-offset match, new-offset match) distinguished by a single context-dependent bit, with interlaced Elias gamma coding for offsets and lengths.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Einar Saukas |
| Year | 2021 |
| Origin | 🇧🇷 Brazil |
| Source | [`algorithms/compression/zx0.js`](../../../algorithms/compression/zx0.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [ZX0 official repository](https://github.com/einar-saukas/ZX0)
- [ZX0 README (format overview)](https://github.com/einar-saukas/ZX0/blob/main/README.md)

## References

- [dzx0_standard.asm reference decompressor](https://github.com/einar-saukas/ZX0/blob/main/z80/dzx0_standard.asm)
- [Reference compress.c](https://raw.githubusercontent.com/einar-saukas/ZX0/main/src/compress.c)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://github.com/einar-saukas/ZX0)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Highly repetitive input (64 'A' bytes)](https://github.com/einar-saukas/ZX0)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141` |
| `expected` | _(empty)_ |

**Vector 3** — [Text sample](https://github.com/einar-saukas/ZX0)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 2e` |
| `expected` | _(empty)_ |

**Vector 4** — [Repetitive text beyond a single maximum-length match (90 KB)](https://github.com/einar-saukas/ZX0)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 …` (90000 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
