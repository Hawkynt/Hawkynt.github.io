# tANS (Table-based Asymmetric Numeral Systems)

> Table-driven ANS entropy coder over a 2048-state table. Symbols are spread with Duda's precise initialization (slots ranked by the keys (2k+1)/(2f)) rather than the FSE pseudo-random walk this collection's FSE implementation uses, and renormalization emits a whole precomputed bit group per symbol instead of peeling single bits. Order-0 model: the normalized frequency table is transmitted in the header.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Entropy Coding |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Jarek Duda |
| Year | 2013 |
| Origin | Not specified |
| Source | [`algorithms/compression/tans.js`](../../../algorithms/compression/tans.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Asymmetric Numeral Systems (original paper)](https://arxiv.org/abs/0902.0271)
- [ANS with applications to data compression](https://arxiv.org/abs/1311.2540)
- [ANS on Wikipedia (tANS section)](https://en.wikipedia.org/wiki/Asymmetric_numeral_systems)

## References

- [Jarek Duda homepage](http://th.if.uj.edu.pl/~dudaj/)
- [Finite State Entropy (the FSE spread, for comparison)](https://github.com/Cyan4973/FiniteStateEntropy)
- [ANS discussion thread](https://encode.su/threads/2078-Asymmetric-Numeral-Systems)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input - length header only](https://arxiv.org/abs/0902.0271)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single distinct symbol - whole table, zero bits emitted](https://arxiv.org/abs/1311.2540)

| Field | Value |
| --- | --- |
| `input` | `41414141` |
| `expected` | `040000000b0100410008000000000000` |

**Vector 3** — [Two symbols, equal counts - interleaved spread](https://en.wikipedia.org/wiki/Asymmetric_numeral_systems)

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | `020000000b020041000442000400000200000040` |

**Vector 4** — [Two symbols, reversed order - pins the final state field](http://th.if.uj.edu.pl/~dudaj/)

| Field | Value |
| --- | --- |
| `input` | `4241` |
| `expected` | `020000000b020041000442000401000200000000` |

**Vector 5** — Natural text round-trip

Source: Regression test for table desync

| Field | Value |
| --- | --- |
| `input` | `74686520717569636b2062726f776e20 666f78206a756d7073206f7665722074 6865206c617a7920646f672e20` |
| `expected` | _(empty)_ |

**Vector 6** — All 256 byte values round-trip

Source: Regression test for table desync

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

**Vector 7** — Long run round-trip

Source: Regression test for zero-bit renormalization

| Field | Value |
| --- | --- |
| `input` | `5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a 5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a 5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a 5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a5a …` (512 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 8** — Uneven frequencies round-trip

Source: Regression test for apportionment

| Field | Value |
| --- | --- |
| `input` | `414141424343444545454546` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
