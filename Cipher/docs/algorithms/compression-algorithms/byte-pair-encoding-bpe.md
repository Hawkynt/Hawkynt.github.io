# Byte-Pair Encoding (BPE)

> Iteratively replaces the most frequently occurring byte pairs with unused byte values. Simple greedy approach that can achieve good compression on structured data with repeated patterns.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Transform |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Philip Gage |
| Year | 1994 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/bpe.js`](../../../algorithms/compression/bpe.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [A New Algorithm for Data Compression - Philip Gage](http://www.cbloom.com/papers/gage_bpe.pdf)
- [Byte Pair Encoding - Wikipedia](https://en.wikipedia.org/wiki/Byte_pair_encoding)
- [BPE Algorithm Explanation](https://leimao.github.io/blog/Byte-Pair-Encoding/)

## References

- [Philip Gage Original Implementation](http://www.cbloom.com/src/index_lz.html)
- [sentencepiece BPE Implementation](https://github.com/google/sentencepiece)
- [Modern BPE in NLP](https://github.com/rsennrich/subword-nmt)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty data test](https://csrc.nist.gov/)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `000000000000` |

**Vector 2** — [Single byte test](https://csrc.nist.gov/)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `0000010000004100` |

**Vector 3** — [Pattern with potential compression](https://csrc.nist.gov/)

| Field | Value |
| --- | --- |
| `input` | `41424142` |
| `expected` | `0000040000004100420041004200` |

---

[← All algorithms](../README.md)
