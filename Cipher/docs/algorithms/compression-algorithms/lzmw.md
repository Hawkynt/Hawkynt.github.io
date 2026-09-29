# LZMW

> Miller-Wegman variant of LZW: instead of adding the previous match plus one character, the dictionary gains the concatenation of the previous match and the entire current match, so entries grow by whole matches at a time. Variable-width codes from 9 to 16 bits are packed least-significant-bit first behind a 4-byte little-endian length header, with clear and stop codes.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Victor S. Miller, Mark N. Wegman |
| Year | 1985 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/lzmw.js`](../../../algorithms/compression/lzmw.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Wikipedia - LZMW](https://en.wikipedia.org/wiki/Lempel%E2%80%93Ziv%E2%80%93Welch#Variants)
- [Wikibooks - Data Compression/Dictionary compression](https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression)
- [Miller and Wegman, Variations on a theme by Ziv and Lempel (NATO ASI Series F12, 1985)](https://link.springer.com/chapter/10.1007/978-3-642-82456-2_9)

## References

- [Bell, Cleary and Witten, Text Compression (1990)](https://openlibrary.org/books/OL2185474M/Text_compression)
- [Ziv and Lempel, Compression of Individual Sequences via Variable-Rate Coding (1978)](https://ieeexplore.ieee.org/document/1055934)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - only the 4-byte little-endian length header](https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte 0x41 - one literal code followed by the stop code](https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000410202` |

**Vector 3** — [Long repetitive run - 256 copies of 0x61, entries double in length each step](https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0001000061c2081c48b0a0c18308132a3c383020` |

**Vector 4** — [Alternating two-byte pattern - 32 repetitions of 'ab'](https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression)

| Field | Value |
| --- | --- |
| `input` | `61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162` |
| `expected` | `4000000061c4081448b0a0c183070b0604` |

**Vector 5** — [Pseudo-random binary sample - 16 high-entropy bytes, no reusable matches](https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression)

| Field | Value |
| --- | --- |
| `input` | `d3b07a1c8f4e2b6905c1fd3846a70e92` |
| `expected` | `10000000d360e9e1f0c8c98a340582f5c361e49403490101` |

**Vector 6** — [ASCII text - 'the quick brown fox jumps over the lazy dog. ' repeated four times](https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b400000074d0940111a74e9a316b4088 91f3e68e1b1066dee001a1a64e1b3873 40bcb153460e088104d984d193070499 37675c80246810a142860e214aa46811 a3468e1e598e2c7932e5ca962f63ceac 7933e7ce9e3f830e2d7ab4674a172002 02` |

**Vector 7** — [All 256 byte values 0x00..0xFF - no repetition, every code is a single byte](https://en.wikibooks.org/wiki/Data_Compression/Dictionary_compression)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `000100000002081840a0808103081228 58c0a08183071022489840a182850b18 3268d8c0a183870f2042881841a28489 132852a858c1a2858b173062c89841a3 …` (294 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
