# Xpress

> Microsoft's LZ77+Huffman compression algorithm ([MS-XCA]), used in WIM images, NTFS, and Hyper-V. Splits data into 64KB chunks, each with its own 512-symbol canonical Huffman table (256 literals + 256 length/offset-class match symbols) over an LSB-first, 16-bit-word-packed bit stream.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Microsoft |
| Year | 2014 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/xpress.js`](../../../algorithms/compression/xpress.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [[MS-XCA]: Xpress Compression Algorithm](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8)

## References

- [[MS-XCA] 2.1: LZ77+Huffman Compression Algorithm Details](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/a8b7cb0a-92a6-4187-a23b-5e14273b96f8)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Highly repetitive input (64 'A' bytes)](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141 41414141414141414141414141414141` |
| `expected` | _(empty)_ |

**Vector 3** — [Text sample](https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-xca/)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 2e` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
