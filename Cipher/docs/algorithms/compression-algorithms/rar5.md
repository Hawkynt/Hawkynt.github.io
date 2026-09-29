# RAR5

> Block compression stage of the RAR 5.0 archive format: LZ77 over a 128KB dictionary whose literals, match-length slots, distance slots and low-distance nibbles are entropy coded with four Huffman tables, themselves serialised through a 20-symbol pre-code with run-length escapes. Bits are most-significant-first and each block carries a byte-aligned flags/checksum/size header. Documented-subset implementation covering literals and plain matches; PPM modelling and the delta/E8E9/ARM filters are out of scope.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Expert |
| Inventor | Eugene Roshal |
| Year | 2013 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/rar5.js`](../../../algorithms/compression/rar5.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [RARLAB - RAR 5.0 archive format technical note](https://www.rarlab.com/technote.htm)
- [Wikipedia - RAR (file format)](https://en.wikipedia.org/wiki/RAR_(file_format))
- [Wikipedia - LZ77 and LZ78](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

## References

- [RARLAB - UnRAR source distribution](https://www.rarlab.com/rar_add.htm)
- [7-Zip - contains an independent RAR5 decoder](https://www.7-zip.org/)
- [Huffman, A Method for the Construction of Minimum-Redundancy Codes, 1952](https://ieeexplore.ieee.org/document/4051119)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - size prefix only, no block emitted](https://www.rarlab.com/technote.htm)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte - one literal plus the four Huffman tables](https://www.rarlab.com/technote.htm)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000c08812010000000000000000015abff6cb320c9f80` |

**Vector 3** — [Text sample repeated 4x](https://www.rarlab.com/technote.htm)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b4000000c2a53d534543400000000030 320afc05c27e81f3935ce7fa1b04b045 99ec42a40054241f9a0c2144fab1e44a ce1f95c2a8d7c8154d11af33bce07c47 eb73c0a0` |

**Vector 4** — [Long repetitive run - 256 identical bytes](https://www.rarlab.com/technote.htm)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `00010000c78e1301000000000000000001d67fd5214b320c9f7a` |

**Vector 5** — [Alternating two-byte pattern - ABABABABABAB](https://www.rarlab.com/technote.htm)

| Field | Value |
| --- | --- |
| `input` | `414241424142414241424142` |
| `expected` | `0c000000c08f150220000000000000000136f7f368628ce80e87ec80` |

**Vector 6** — [Pseudo-random binary sample with one repeated run](https://www.rarlab.com/technote.htm)

| Field | Value |
| --- | --- |
| `input` | `9e1fd24b6a0cf7832155be083dc471aa9e1fd24b6a0cf7831162ef904d7c38a1` |
| `expected` | `20000000c0a43e440032000000000000 2268812408e21624811c30808c163c59 01204770dd08cad02d11ccd09d1af5fc b7fe07ff1ff44eb97af2571750b40de1 84edb73f80` |

**Vector 7** — [English text with short interior repeats](https://www.rarlab.com/technote.htm)

| Field | Value |
| --- | --- |
| `input` | `4f7074696d616c2070617273696e6720 6d696e696d697365732074686520746f 74616c20746f6b656e20636f73742c20 6e6f7420746865206c6f63616c206d61 746368206c656e6774682e` |
| `expected` | `4b000000c7da47330533300000000050 420af801960ae0355545645a7c55a78f fd6ac1d7d58adb01b61ff365a30e378f ada7421a5a1ad2c154068f2cd7a92335 67a1347f97acf263072a1d27457b` |

---

[← All algorithms](../README.md)
