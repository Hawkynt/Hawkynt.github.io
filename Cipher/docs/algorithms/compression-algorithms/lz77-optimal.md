# LZ77-Optimal

> LZ77 with cost-based optimal (shortest-path) parsing. Keeps the flat literal/match token stream of plain LZ77 but chooses the parse by a forward dynamic program over byte positions, pricing a literal at its serialized 2 bytes and a match at its serialized 5 bytes, so the emitted stream is the smallest this token grammar can produce. Matches are supplied by a 15-bit hash-chain finder over a 32KB window.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Abraham Lempel, Jacob Ziv |
| Year | 1977 |
| Origin | 🇮🇱 Israel |
| Source | [`algorithms/compression/lz77-optimal.js`](../../../algorithms/compression/lz77-optimal.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Ziv and Lempel, A Universal Algorithm for Sequential Data Compression (1977)](https://ieeexplore.ieee.org/document/1055714)
- [LZ77 and LZ78 - Wikipedia](https://en.wikipedia.org/wiki/LZ77_and_LZ78)
- [LZMA SDK - price-based optimal parsing](https://www.7-zip.org/sdk.html)

## References

- [Zopfli - shortest-path LZ77 parser for DEFLATE](https://github.com/google/zopfli)
- [RFC 1951 - DEFLATE Compressed Data Format](https://www.rfc-editor.org/rfc/rfc1951)
- [Shortest-path optimal parsing overview](https://en.wikipedia.org/wiki/LZ77_and_LZ78#Optimal_parsing)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - zero-byte output](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Single byte - one literal token](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0041` |

**Vector 3** — [Text sample repeated 4x - literals then a long back-reference](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `00740068006500200071007500690063 006b002000620072006f0077006e0020 0066006f00780020006a0075006d0070 00730020006f0076006500720020011f 000400006c0061007a00790020006400 6f0067002e00200074012d008600` |

**Vector 4** — [Long repetitive run - 256 identical bytes](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0061010100ff00` |

**Vector 5** — [Alternating two-byte pattern - ABABABABABAB](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

| Field | Value |
| --- | --- |
| `input` | `414241424142414241424142` |
| `expected` | `004100420102000a00` |

**Vector 6** — [Pseudo-random binary sample with one repeated run](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

| Field | Value |
| --- | --- |
| `input` | `9e1fd24b6a0cf7832155be083dc471aa9e1fd24b6a0cf7831162ef904d7c38a1` |
| `expected` | `009e001f00d2004b006a000c00f70083 0021005500be0008003d00c4007100aa 01100008000011006200ef0090004d00 7c003800a1` |

**Vector 7** — [English text with short interior repeats](https://en.wikipedia.org/wiki/LZ77_and_LZ78)

| Field | Value |
| --- | --- |
| `input` | `4f7074696d616c2070617273696e6720 6d696e696d697365732074686520746f 74616c20746f6b656e20636f73742c20 6e6f7420746865206c6f63616c206d61 746368206c656e6774682e` |
| `expected` | `004f007000740069006d0061006c0020 00700061007200730069006e00670020 006d0069006e0069006d006900730065 0073002000740068006500200074006f 00740061006c0106000300006b006500 6e00200063006f00730074002c002000 6e006f0074011a000500006c006f0063 011a000300006d006100740063006800 20006c0065006e006700740068002e` |

---

[← All algorithms](../README.md)
