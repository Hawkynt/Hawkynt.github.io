# rANS (Range Asymmetric Numeral Systems)

> Advanced entropy coding using range-based asymmetric numeral systems for optimal compression efficiency. Provides arithmetic coding quality with faster processing through range-based state management and renormalization.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Entropy Coding |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Jarek Duda, Fabian Giesen |
| Year | 2011 |
| Origin | 🌐 International |
| Source | [`algorithms/compression/rans.js`](../../../algorithms/compression/rans.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [rANS Implementation](https://github.com/rygorous/ryg_rans)
- [ANS Entropy Coding](https://arxiv.org/abs/1311.2540)
- [Fabian Giesen Blog](https://fgiesen.wordpress.com/2014/02/02/rans-notes/)

## References

- [Asymmetric Numeral Systems](https://en.wikipedia.org/wiki/Asymmetric_numeral_systems)
- [Range Coding Theory](https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html)
- [rANS vs tANS Comparison](https://encode.su/threads/2648-Asymmetric-Numeral-Systems)
- [Practical ANS Implementation](https://github.com/Cyan4973/FiniteStateEntropy)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - boundary case](https://github.com/rygorous/ryg_rans)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | _(empty)_ |

**Vector 2** — [Single character round-trip test](https://arxiv.org/abs/1311.2540)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | _(empty)_ |

**Vector 3** — [Repeated characters round-trip test](https://fgiesen.wordpress.com/2014/02/02/rans-notes/)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | _(empty)_ |

**Vector 4** — [Alternating characters round-trip test](https://en.wikipedia.org/wiki/Asymmetric_numeral_systems)

| Field | Value |
| --- | --- |
| `input` | `41424142` |
| `expected` | _(empty)_ |

**Vector 5** — [Three symbols round-trip test](https://marknelson.us/posts/2014/10/19/data-compression-with-arithmetic-coding.html)

| Field | Value |
| --- | --- |
| `input` | `414243` |
| `expected` | _(empty)_ |

**Vector 6** — [Skewed distribution round-trip test](https://encode.su/threads/2648-Asymmetric-Numeral-Systems)

| Field | Value |
| --- | --- |
| `input` | `414142` |
| `expected` | _(empty)_ |

**Vector 7** — [Longer alternating input round-trip test (exercises renormalization)](https://github.com/rygorous/ryg_rans)

| Field | Value |
| --- | --- |
| `input` | `4142414241424142` |
| `expected` | _(empty)_ |

**Vector 8** — All 256 byte values round-trip test

Source: Regression test for decoder/model desync

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

**Vector 9** — Repeated phrase round-trip test

Source: Regression test for decoder/model desync

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20746865 20717569636b2062726f776e20666f78 206a756d7073206f7665722074686520 6c617a7920646f672e20746865207175 69636b2062726f776e20666f78206a75 6d7073206f76657220746865206c617a 7920646f672e2074686520717569636b 2062726f776e20666f78206a756d7073 206f76657220746865206c617a792064 6f672e20` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
