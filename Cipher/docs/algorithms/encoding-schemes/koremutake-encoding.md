# Koremutake Encoding

> Memorable phonetic string encoding system that converts large numbers into pronounceable words using consonant-vowel patterns. Designed to create human-readable representations of binary data. Treats the whole byte string as a single unsigned big-endian integer and re-expresses it in base 128 (one syllable per digit), with leading zero bytes each represented by their own leading 'ba' syllable (the same convention Base58Check uses for leading zero bytes) so the byte count is always recoverable. Encodes any byte sequence of any length losslessly - there is no restricted input domain.

## Properties

| Property | Value |
| --- | --- |
| Category | Encoding Schemes |
| Sub-category | Phonetic Encoding |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Shorl.com |
| Year | 2007 |
| Origin | 🌐 International |
| Source | [`algorithms/encoding/koremutake.js`](../../../algorithms/encoding/koremutake.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Koremutake Specification](http://shorl.com/koremutake.php)
- [Phonetic Encoding Systems](https://en.wikipedia.org/wiki/Phonetic_algorithm)
- [Human-readable Identifiers](https://tools.ietf.org/html/draft-hallambaker-mesh-udf-03)

## References

- [Memorable String Generation](https://www.npmjs.com/package/koremutake)
- [Base Conversion Algorithms](https://en.wikipedia.org/wiki/Radix)
- [Pronunciation Systems](https://www.internationalphoneticalphabet.org/)

## Test vectors

6 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Koremutake empty data test](http://shorl.com/koremutake.php)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Single byte encoding test - Koremutake

Source: Educational example

| Field | Value |
| --- | --- |
| `input` | `01` |
| `expected` | `6265` |

**Vector 3** — Single zero byte encoding test - Koremutake (leading-zero-byte marker, distinct from empty input)

Source: Educational example

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `6261` |

**Vector 4** — Two zero bytes encoding test - Koremutake

Source: Shorl.com specification

| Field | Value |
| --- | --- |
| `input` | `0000` |
| `expected` | `62616261` |

**Vector 5** — High-bit-set byte regression test - the old 'byte % 128' scheme discarded the 8th bit, so 200 and 200-128=72 encoded identically

Source: Educational example

| Field | Value |
| --- | --- |
| `input` | `c801` |
| `expected` | `626f66756265` |

**Vector 6** — All 256 byte values regression test - exercises the full big-integer base-128 conversion path

Source: Educational example

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | `626162756275626f626962656a697861 6e696a69676164756279726562657469 626c7570616a696679646f6275786970 796b7576756c7568616661727572656d …` (630 bytes; the full value is in the source) |

---

[← All algorithms](../README.md)
