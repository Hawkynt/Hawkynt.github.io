# Range Coding

> Entropy coding method that assigns codewords to symbols based on their probability distributions. More general and efficient than arithmetic coding.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Entropy Coding |
| Security status | Not classified |
| Complexity | Advanced |
| Inventor | G. Nigel N. Martin |
| Year | 1979 |
| Origin | 🇬🇧 United Kingdom |
| Source | [`algorithms/compression/range-coding.js`](../../../algorithms/compression/range-coding.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Range Encoding - Wikipedia](https://en.wikipedia.org/wiki/Range_encoding)
- [Arithmetic Coding Explained](https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html)

## References

- [Original Range Coding Paper](https://www.drdobbs.com/database/arithmetic-coding-data-compression/184402828)
- [Compression Research Papers](https://compression.ca/)
- [Data Compression Explained](https://web.stanford.edu/class/ee398a/handouts/papers/WittenACM87ArithmCoding.pdf)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — Empty data round-trip test

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — Single character round-trip test

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — Repeated characters round-trip test

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `4141` |
| `expected` | _(empty)_ |

**Vector 4** — Two different characters round-trip test

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | _(empty)_ |

**Vector 5** — Three different characters round-trip test

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `414243` |
| `expected` | _(empty)_ |

**Vector 6** — Hello string round-trip test

Source: Educational test vector

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f` |
| `expected` | _(empty)_ |

**Vector 7** — All 256 byte values round-trip test

Source: Regression test for decoder/model desync

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
