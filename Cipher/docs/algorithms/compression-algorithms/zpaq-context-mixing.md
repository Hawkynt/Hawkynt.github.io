# ZPAQ (Context Mixing)

> The context-mixing compressor at the heart of ZPAQ: four direct context models over hashed orders 1 to 4 predict each bit of the message, their predictions are averaged, and a carry-propagating binary range coder turns confident predictions into fractions of a bit. The order hashes are rebuilt after every byte with ZPAQ's HASH step, h = (h + b + 512) * 773 modulo 2 to the 32. Covers the modelling and coding stages only - the journaling archive container, the general ZPAQL virtual machine with its configurable COMP/HCOMP sections, deduplication and versioning are not implemented.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Context Mixing |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Matt Mahoney |
| Year | 2009 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/zpaq.js`](../../../algorithms/compression/zpaq.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [ZPAQ specification and tools](http://mattmahoney.net/dc/zpaq.html)
- [The ZPAQ Open Standard Format](http://mattmahoney.net/dc/zpaq206.pdf)
- [Data Compression Explained - context mixing](http://mattmahoney.net/dc/dce.html)

## References

- [libzpaq reference implementation](https://github.com/zpaq/zpaq)
- [PAQ family of compressors](https://en.wikipedia.org/wiki/PAQ)
- [Context mixing](https://en.wikipedia.org/wiki/Context_mixing)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - length header only](http://mattmahoney.net/dc/zpaq.html)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single zero byte - eight bits coded at one half](http://mattmahoney.net/dc/zpaq206.pdf)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `0100000000feff8000` |

**Vector 3** — [Single byte 0x41 - pins the subrange convention](http://mattmahoney.net/dc/dce.html)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0100000000bdff8000` |

**Vector 4** — Natural text round-trip

Source: Regression test for model desync

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20` |
| `expected` | _(empty)_ |

**Vector 5** — All 256 byte values round-trip

Source: Regression test for model desync

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

**Vector 6** — Long run round-trip

Source: Regression test for high-confidence predictions

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 …` (1024 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 7** — Alternating pattern round-trip

Source: Regression test for renormalization

| Field | Value |
| --- | --- |
| `input` | `61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162 61626162616261626162616261626162` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
