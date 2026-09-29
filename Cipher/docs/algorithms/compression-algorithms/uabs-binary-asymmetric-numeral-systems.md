# uABS (Binary Asymmetric Numeral Systems)

> Binary variant of Asymmetric Numeral Systems. Each bit of the message is coded with the uABS transition pair against a 24-bit state that renormalizes one byte at a time. Probabilities come from an order-0 adaptive binary context tree, so no frequency table is transmitted. Distinct from the range variant (rANS) and from the table variants (FSE, tANS), which are implemented separately.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Entropy Coding |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Jarek Duda |
| Year | 2009 |
| Origin | Not specified |
| Source | [`algorithms/compression/ans.js`](../../../algorithms/compression/ans.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Asymmetric Numeral Systems (original paper)](https://arxiv.org/abs/0902.0271)
- [ANS with applications to data compression](https://arxiv.org/abs/1311.2540)
- [ANS on Wikipedia (uABS section)](https://en.wikipedia.org/wiki/Asymmetric_numeral_systems)

## References

- [Jarek Duda homepage](http://th.if.uj.edu.pl/~dudaj/)
- [ryg_rans (range variant, for comparison)](https://github.com/rygorous/ryg_rans)
- [Finite State Entropy (table variant, for comparison)](https://github.com/Cyan4973/FiniteStateEntropy)

## Test vectors

9 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - length header only](https://arxiv.org/abs/0902.0271)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single zero byte - eight bits coded at p=1/2](https://arxiv.org/abs/1311.2540)

| Field | Value |
| --- | --- |
| `input` | `00` |
| `expected` | `010000000001000000` |

**Vector 3** — [Single byte 0x41 - renormalization emits one payload byte](https://en.wikipedia.org/wiki/Asymmetric_numeral_systems)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `010000000001000041` |

**Vector 4** — [Single byte 0xFF - all-ones bit path](http://th.if.uj.edu.pl/~dudaj/)

| Field | Value |
| --- | --- |
| `input` | `ff` |
| `expected` | `01000000000100017f` |

**Vector 5** — [Two identical bytes - pins the context adaptation rule](https://arxiv.org/abs/0902.0271)

| Field | Value |
| --- | --- |
| `input` | `4141` |
| `expected` | `0200000000c82382a6` |

**Vector 6** — Natural text round-trip

Source: Regression test for model desync

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20` |
| `expected` | _(empty)_ |

**Vector 7** — All 256 byte values round-trip

Source: Regression test for model desync

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

**Vector 8** — Long run round-trip

Source: Regression test for renormalization

| Field | Value |
| --- | --- |
| `input` | `5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a 5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a 5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a 5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a …` (512 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 9** — Alternating pattern round-trip

Source: Regression test for renormalization

| Field | Value |
| --- | --- |
| `input` | `aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
