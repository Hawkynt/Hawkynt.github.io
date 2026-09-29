# aPLib

> Joergen Ibsen's LZSS-based compression library, known for very small and fast decompressors. A 4-byte little-endian length header precedes a bare stream whose single MSB-first tag-bit sequence is interleaved in place (byte-aligned) with literal bytes and back-references (normal match, short match, single byte), selected by a tag-bit prefix, with gamma-coded numbers for offsets and lengths.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Dictionary-based |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Joergen Ibsen |
| Year | 1998 |
| Origin | Not specified |
| Source | [`algorithms/compression/aplib.js`](../../../algorithms/compression/aplib.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Ibsen Software - aPLib product page](https://ibsensoftware.com/products_aPLib.html)
- [The malware analyst's guide to aPLib decompression](https://0xc0decafe.com/malware-analysts-guide-to-aplib-decompression)

## References

- [malduck aplib decompressor (independent reimplementation)](https://malduck.readthedocs.io/en/v4.0.0/_modules/malduck/compression/aplib.html)
- [apultra (aPLib-compatible optimal-parse compressor)](https://github.com/emmanuel-marty/apultra)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://ibsensoftware.com/products_aPLib.html)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte](https://ibsensoftware.com/products_aPLib.html)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0100000041c000` |

**Vector 3** — [Repeated phrase (4x 'the quick brown fox jumps over the lazy dog. ')](https://ibsensoftware.com/products_aPLib.html)

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | `b40000007400686520717569636b0020 62726f776e2066006f78206a756d7073 02206f76657220801f6c617a79052064 6f672e500e2daab600` |

**Vector 4** — [256 repeated bytes of 0x61](https://ibsensoftware.com/products_aPLib.html)

| Field | Value |
| --- | --- |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161` |
| `expected` | `0001000061af01fdb000` |

**Vector 5** — [All 256 byte values, in order](https://ibsensoftware.com/products_aPLib.html)

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `00010000000001020304050607080009 0a0b0c0d0e0f10001112131415161718 00191a1b1c1d1e1f2000212223242526 272800292a2b2c2d2e2f300031323334 …` (294 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
