# Adaptive Huffman (FGK)

> Faller-Gallager-Knuth dynamic Huffman coding. The code tree adapts after every symbol and no code-length table is transmitted: the decoder replays the identical incremental update procedure, so both sides always hold the same tree. New symbols are introduced through a NYT escape node followed by the raw byte value. Vitter's tighter node-numbering refinement is not applied.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Entropy Coding |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Newton Faller, Robert G. Gallager, Donald E. Knuth |
| Year | 1973 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/adaptive-huffman.js`](../../../algorithms/compression/adaptive-huffman.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Wikipedia - Adaptive Huffman coding](https://en.wikipedia.org/wiki/Adaptive_Huffman_coding)
- [Knuth, Dynamic Huffman Coding (Journal of Algorithms 6(2), 1985)](https://www.sciencedirect.com/science/article/abs/pii/0196677485900360)
- [Gallager, Variations on a Theme by Huffman (IEEE Trans. Inf. Theory, 1978)](https://ieeexplore.ieee.org/document/1055959)

## References

- [Vitter, Design and Analysis of Dynamic Huffman Codes (JACM 34(4), 1987)](https://dl.acm.org/doi/10.1145/31846.42227)
- [Sayood, Introduction to Data Compression - adaptive Huffman chapter](https://www.sciencedirect.com/book/9780124157965/introduction-to-data-compression)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - only the 4-byte little-endian length header](https://en.wikipedia.org/wiki/Adaptive_Huffman_coding)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 0x41 - empty NYT path plus the raw eight-bit value](https://en.wikipedia.org/wiki/Adaptive_Huffman_coding)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0100000041` |

**Vector 3** — [Long repetitive run - 256 copies of 0x61 collapse to one bit each](https://en.wikipedia.org/wiki/Adaptive_Huffman_coding)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0001000061ffffffffffffffffffffff ffffffffffffffffffffffffffffffff fffffffffe` |

**Vector 4** — [Alternating two-byte pattern - 32 repetitions of 'ab'](https://en.wikipedia.org/wiki/Adaptive_Huffman_coding)

| Field | Value |
| --- | --- |
| `input` | `61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162` |
| `expected` | `4000000061315b6db6db6db6db6db6db6db4` |

**Vector 5** — [Pseudo-random binary sample - 16 high-entropy bytes, all first occurrences](https://en.wikipedia.org/wiki/Adaptive_Huffman_coding)

| Field | Value |
| --- | --- |
| `input` | `d3b07a1c8f4e2b6905c1fd3846a70e92` |
| `expected` | `10000000d3580f507047e27415a34802f3071fb438823329d01c4920` |

**Vector 6** — [ASCII text - 'the quick brown fox jumps over the lazy dog. ' repeated four times](https://en.wikipedia.org/wiki/Adaptive_Huffman_coding)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b400000074340cb08038e3ac34a31835 8e3151ca0dec774376233281e370d516 36c8e1039ef71da5034e5ec36646101e ae3cfd0c99519ec17732a7a1fbad8bbd 977861d8167b0caee30ad7d66fd15514 7b2e79a86e990722dc476f7f0b7b635f 697e47635a359a30aeab5b2e79af374c 83916e83b7bf85bdb1afb4bf23b1ad1a cd385f75ad973cd4` |

**Vector 7** — [All 256 byte values 0x00..0xFF - every symbol arrives through the NYT escape](https://en.wikipedia.org/wiki/Adaptive_Huffman_coding)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000000080500c02602c03203804 702701540b806303501c40f0087823c0 9682780a582b40b482f00c3832c0d283 680e183a40f083e0107c21f045d08f81 …` (515 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
