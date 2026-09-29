# DS-LZ77

> LZSS variant used by the Game Boy Advance and Nintendo DS BIOS decompression routines (type 0x10 header). Flag bytes select between literal bytes and 12-bit-displacement/4-bit-length back-references, with the total decompressed size stored in the header.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Nintendo |
| Year | 2001 |
| Origin | 🇯🇵 Japan |
| Source | [`algorithms/compression/ds-lz77.js`](../../../algorithms/compression/ds-lz77.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [GBATEK - LZ Decompression Functions](https://problemkaputt.de/gbatek-lz-decompression-functions.htm)
- [GBATEK - BIOS Decompression Functions](https://problemkaputt.de/gbatek-bios-decompression-functions.htm)

## References

- [GBATEK main index](https://problemkaputt.de/gbatek.htm)
- [GBATemp - Nintendo DS/GBA Compressors](https://gbatemp.net/threads/nintendo-ds-gba-compressors.313278/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://problemkaputt.de/gbatek-lz-decompression-functions.htm)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Highly repetitive input (48 zero bytes)](https://problemkaputt.de/gbatek-lz-decompression-functions.htm)

| Field | Value |
| --- | --- |
| `input` | `00000000000000000000000000000000 00000000000000000000000000000000 00000000000000000000000000000000` |
| `expected` | `103000007000f000f0128024` |

**Vector 3** — [Text sample](https://problemkaputt.de/gbatek-lz-decompression-functions.htm)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 2e` |
| `expected` | `10410000007468652071756963006b20 62726f776e2000666f78206a756d7001 73206f76657220101e006c617a792064 6f67602e200dc02c2e` |

---

[← All algorithms](../README.md)
