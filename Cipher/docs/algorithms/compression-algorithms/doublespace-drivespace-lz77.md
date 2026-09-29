# DoubleSpace/DriveSpace LZ77

> Microsoft DoubleSpace/DriveSpace LZ77 grammar as a standalone building block: variable-bit length and distance codes over a 4KB sliding window, minimum match length 2, greedy hash-chain parse, prefixed by a 4-byte little-endian original-size header. Corresponds to CompressionWorkbench's BB_DsLz77, which fixes the greedy effort level; at that setting the stream is identical to the DoubleSpace and DriveSpace entries, which expose the same grammar under their product names. Unrelated to the Nintendo GBA/NDS BIOS LZSS variant that shares the DS-LZ77 abbreviation. Documented-subset reimplementation; Microsoft never published a bitstream specification.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Microsoft Corporation |
| Year | 1993 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/ds-lz77-doublespace.js`](../../../algorithms/compression/ds-lz77-doublespace.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Microsoft TechNet Archive - What is DoubleSpace and How Does It Work?](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))
- [Wikipedia - DriveSpace](https://en.wikipedia.org/wiki/DriveSpace)
- [Wikipedia - LZ77 and LZ78](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

## References

- [Storer and Szymanski, Data compression via textual substitution, 1982](https://dl.acm.org/doi/10.1145/322344.322346)
- [Stac Electronics, Inc. v. Microsoft Corp. (1994)](https://en.wikipedia.org/wiki/Stac_Electronics_v._Microsoft_Corporation)
- [Wikipedia - Nintendo DS/GBA BIOS LZSS, the unrelated format sharing the DS-LZ77 name](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Storer%E2%80%93Szymanski)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - size header only](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte - one literal token](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000008200` |

**Vector 3** — [Text sample repeated 4x](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4000000e8a02903224e9d3463d68010 23e7cd1d3720ccbcc103424d9d3670e6 807863a78c1c90e26113464f1e1064de 9c713940f3ff0716` |

**Vector 4** — [Long repetitive run - 256 identical bytes](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `00010000c2feef0200` |

**Vector 5** — [Alternating two-byte pattern - ABABABABABAB](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | `414241424142414241424142` |
| `expected` | `0c0000008208bd2000` |

**Vector 6** — [Pseudo-random binary sample with one repeated run](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | `9e1fd24b6a0cf7832155be083dc471aa9e1fd24b6a0cf7831162ef904d7c38a1` |
| `expected` | `200000003c7d90b6440d837b834254f1 85a007b138aa1f784410f30e52133e38 4201` |

**Vector 7** — [English text with short interior repeats](https://learn.microsoft.com/en-us/previous-versions/tn-archive/cc722457(v=technet.10))

| Field | Value |
| --- | --- |
| `input` | `4f7074696d616c2070617273696e6720 6d696e696d697365732074686520746f 74616c20746f6b656e20636f73742c20 6e6f7420746865206c6f63616c206d61 746368206c656e6774682e` |
| `expected` | `4b0000009ec0a193a64d183620e08491 33278d9b3320da02111e69e694990382 0e9ab230784337b6505853c60d88316f e6d06101c22d4407c8b0793336b290a3 33062d2ca17316262e` |

---

[← All algorithms](../README.md)
