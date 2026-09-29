# Exp-Golomb

> Exponential-Golomb coding, the universal variable-length integer code used for syntax elements in the H.264/AVC and H.265/HEVC video standards. Each input byte is coded at order 0 as floor(log2(n+1)) zero bits followed by the binary representation of n+1, packed most-significant-bit first behind a 4-byte little-endian length header.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Entropy Coding |
| Security status | Not classified |
| Complexity | Beginner |
| Inventor | Solomon W. Golomb |
| Year | 1966 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/exp-golomb.js`](../../../algorithms/compression/exp-golomb.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Wikipedia - Exponential-Golomb coding](https://en.wikipedia.org/wiki/Exponential-Golomb_coding)
- [ITU-T H.264 - Advanced video coding for generic audiovisual services](https://www.itu.int/rec/T-REC-H.264)
- [ITU-T H.265 - High efficiency video coding](https://www.itu.int/rec/T-REC-H.265)

## References

- [Golomb, Run-length encodings (IEEE Trans. Inf. Theory, 1966)](https://ieeexplore.ieee.org/document/1053907)
- [Teuhola, A compression method for clustered bit-vectors (1978)](https://www.sciencedirect.com/science/article/abs/pii/0020019078900216)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - only the 4-byte little-endian length header](https://en.wikipedia.org/wiki/Exponential-Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 0x41 - six zero bits then the seven-bit value 66](https://en.wikipedia.org/wiki/Exponential-Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000000210` |

**Vector 3** — [Long repetitive run - 256 copies of 0x61](https://en.wikipedia.org/wiki/Exponential-Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0001000003101880c406203101880c40 6203101880c406203101880c40620310 1880c406203101880c406203101880c4 06203101880c406203101880c4062031 …` (420 bytes; the full value is in the source) |

**Vector 4** — [Alternating two-byte pattern - 32 repetitions of 'ab'](https://en.wikipedia.org/wiki/Exponential-Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | `61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162` |
| `expected` | `40000000031018c0c4063031018c0c40 63031018c0c4063031018c0c40630310 18c0c4063031018c0c4063031018c0c4 063031018c0c4063031018c0c4063031 018c0c4063031018c0c4063031018c0c 4063031018c0c4063031018c0c406303 1018c0c4063031018c0c4063` |

**Vector 5** — [Pseudo-random binary sample - 16 high-entropy bytes](https://en.wikipedia.org/wiki/Exponential-Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | `d3b07a1c8f4e2b6905c1fd3846a70e92` |
| `expected` | `1000000001a802c40f61d012004f05806a300c201fc0e408e02a078093` |

**Vector 6** — [ASCII text - 'the quick brown fox jumps over the lazy dog. ' repeated four times](https://en.wikipedia.org/wiki/Exponential-Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b400000003a81a40cc0840e407603501 900d80840c607303801e00de0840ce07 003c82103581d80dc07103a02103801d c0cc07304207503481981081b40c407b …` (287 bytes; the full value is in the source) |

**Vector 7** — [All 256 byte values 0x00..0xFF - each coded once, worst case for expansion](https://en.wikipedia.org/wiki/Exponential-Golomb_coding)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000a64298e2048a163068e1e100 884826140a8582e180c868361c0e8783 e080108220460901282604e0a01482a0 560b01682e05e0c0188320660d01a836 …` (423 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
