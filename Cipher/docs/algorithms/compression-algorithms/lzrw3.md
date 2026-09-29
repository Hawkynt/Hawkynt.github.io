# LZRW3

> Improved LZ77-based compression using hash table index encoding instead of offsets. Better compression than LZRW1 (50% vs 55%) with persistent phrase storage. Uses group-based hash table updates for compressor/decompressor synchronization.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Ross N. Williams |
| Year | 1991 |
| Origin | 🇦🇺 Australia |
| Source | [`algorithms/compression/lzrw3.js`](../../../algorithms/compression/lzrw3.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [LZRW3 Specification](http://ross.net/compression/lzrw3.html)
- [LZRW3 Release Notes](https://strangetextsbutcher.blogspot.com/2019/01/notes-on-lzrw3-algorithm.html)
- [Data Compression Conference 1991](https://ieeexplore.ieee.org/xpl/conhome/1000160/all-proceedings)
- [LZRW Wikipedia](https://en.wikipedia.org/wiki/LZRW)

## References

- [Ross Williams Compression](http://ross.net/compression/)
- [LZRW Implementation Analysis](https://www.heliontech.com/comp_info.htm)
- [Linux Kernel ftape LZRW3](http://courses.cs.tau.ac.il/os/orish/src/drivers/char/ftape/compressor/lzrw3.c)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — No repetition - all literals

Source: Round-trip validated

| Field | Value |
| --- | --- |
| `input` | `41424344` |
| `expected` | `04000000000041424344` |

**Vector 2** — Pattern repetition - ABC repeated 4 times

Source: Round-trip validated

| Field | Value |
| --- | --- |
| `input` | `414243414243414243414243` |
| `expected` | `0c0000000008414243652c` |

**Vector 3** — Real text compression - English phrase

Source: Round-trip validated

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20666f78` |
| `expected` | `13000000000054686520717569636b2062726f776e200000666f78` |

**Vector 4** — High repetition - 16 identical characters

Source: Round-trip validated

| Field | Value |
| --- | --- |
| `input` | `41414141414141414141414141414141` |
| `expected` | `100000000008414141a27e` |

**Vector 5** — Edge case - empty input

Source: Round-trip validated

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 6** — Highly repetitive data - 300 bytes

Source: Round-trip validated

| Field | Value |
| --- | --- |
| `input` | `58585858585858585858585858585858 58585858585858585858585858585858 58585858585858585858585858585858 58585858585858585858585858585858 …` (300 bytes; the full value is in the source) |
| `expected` | `2c010000fff8585858f49bf49bf49bf4 9bf49bf49bf49bf49bf49bf49bf49bf4 9bf49b000ff49bf49bf49b649b` |

**Vector 7** — Alternating pattern - 300 bytes

Source: Round-trip validated

| Field | Value |
| --- | --- |
| `input` | `5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 5a595a595a595a595a595a595a595a59 …` (300 bytes; the full value is in the source) |
| `expected` | `2c010000fff05a595a59fb10fb10fb10 fb10fb10fb10fb10fb10fb10fb10fb10 fb10001ffb10fb10fb10fb105b10` |

**Vector 8** — English text sample - repeated sentence

Source: Round-trip validated

| Field | Value |
| --- | --- |
| `input` | `54686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20546865 20717569636b2062726f776e20666f78 …` (450 bytes; the full value is in the source) |
| `expected` | `c2010000000054686520717569636b20 62726f776e200000666f78206a756d70 73206f7665722074f80105fa6c617a79 20646f672e20f767f7c8fe7af345f016 fffff767f7c8fe7af345f016f767f7c8 fe7af345f016f767f7c8fe7af345f016 f7670003f7c86e7a` |

---

[← All algorithms](../README.md)
