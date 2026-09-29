# LZ4 Frame

> LZ4 frame format with content size, checksums and multi-block support. Wraps LZ4 compressed blocks in the interchange container defined by the LZ4 frame specification: magic number 0x184D2204, a frame descriptor with FLG/BD bytes and an xxHash32-derived header checksum byte, length-prefixed independent blocks (4MB maximum, stored verbatim when compression does not help), a zero end-mark and a trailing xxHash32 content checksum.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Yann Collet |
| Year | 2013 |
| Origin | 🇫🇷 France |
| Source | [`algorithms/compression/lz4-frame.js`](../../../algorithms/compression/lz4-frame.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [LZ4 Frame Format Description](https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md)
- [LZ4 Block Format Description](https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md)
- [LZ4 Official Website](https://lz4.org/)

## References

- [Official LZ4 Implementation](https://github.com/lz4/lz4)
- [xxHash Specification](https://github.com/Cyan4973/xxHash/blob/dev/doc/xxhash_spec.md)
- [RFC 8878 - Zstandard (uses the same xxHash32 checksum family)](https://www.rfc-editor.org/rfc/rfc8878)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - header, end mark and content checksum only](https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `04224d186c7000000000000000000300000000055dcc02` |

**Vector 2** — [Single byte - block stored uncompressed](https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `04224d186c700100000000000000740100008041000000004d9a6510` |

**Vector 3** — [Text sample repeated 4x - compressed block](https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `04224d186c70b4000000000000001f39 000000f01074686520717569636b2062 726f776e20666f78206a756d7073206f 766572201f00916c617a7920646f672e 0e000f2d006b50646f672e2000000000 b54777df` |

**Vector 4** — [Long repetitive run - 256 identical bytes](https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `04224d186c7000010000000000005a0b 0000001f610100e75061616161610000 000048ae2a39` |

**Vector 5** — [Alternating two-byte pattern - too short for a match](https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | `414241424142414241424142` |
| `expected` | `04224d186c700c00000000000000190c 00008041424142414241424142414200 0000006ca23e8c` |

**Vector 6** — [Pseudo-random binary sample with one repeated run](https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md)

| Field | Value |
| --- | --- |
| `input` | `9e1fd24b6a0cf7832155be083dc471aa9e1fd24b6a0cf7831162ef904d7c38a1` |
| `expected` | `04224d186c702000000000000000c61d 000000f4019e1fd24b6a0cf7832155be 083dc471aa1000801162ef904d7c38a1 00000000a5d3a3f5` |

**Vector 7** — [English text - block stored uncompressed](https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md)

| Field | Value |
| --- | --- |
| `input` | `4f7074696d616c2070617273696e6720 6d696e696d697365732074686520746f 74616c20746f6b656e20636f73742c20 6e6f7420746865206c6f63616c206d61 746368206c656e6774682e` |
| `expected` | `04224d186c704b000000000000000e4b 0000804f7074696d616c207061727369 6e67206d696e696d6973657320746865 20746f74616c20746f6b656e20636f73 742c206e6f7420746865206c6f63616c 206d61746368206c656e6774682e0000 000051b28b5e` |

---

[← All algorithms](../README.md)
