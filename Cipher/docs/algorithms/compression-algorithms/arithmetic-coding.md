# Arithmetic Coding

> Arithmetic coding represents the entire message as a single fraction in the range [0,1) using probability models. Unlike prefix codes, achieves optimal compression ratios approaching the Shannon entropy limit.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Statistical |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | Jorma Rissanen, Glen Langdon |
| Year | 1976 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/arithmetic.js`](../../../algorithms/compression/arithmetic.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Arithmetic Coding - Wikipedia](https://en.wikipedia.org/wiki/Arithmetic_coding)
- [Introduction to Data Compression by Khalid Sayood](http://rahult.com/bookdc/)
- [Mark Nelson's Data Compression Tutorial](https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html)

## References

- [Nayuki Reference Implementation](https://github.com/nayuki/Reference-arithmetic-coding)
- [CABAC in H.264 Standard](https://en.wikipedia.org/wiki/Context-adaptive_binary_arithmetic_coding)
- [JPEG 2000 Arithmetic Coding](https://www.jpeg.org/jpeg2000/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty data round-trip test

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — All byte values 0-255 round-trip test

Source: Regression test for decoder/model desync

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

**Vector 3** — Pseudo-random data round-trip test

Source: Regression test for decoder/model desync

| Field | Value |
| --- | --- |
| `input` | `f3ccbfab9d8fe554efb09bd0b0f5ba94 8035b768414265947a6b83c1414fe53a 321915d231a7468a060cbf21437ca17a 41025ccf252088f87f924ecff37e92df …` (300 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 4** — Alternating pattern round-trip test

Source: Regression test for decoder/model desync

| Field | Value |
| --- | --- |
| `input` | `aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
