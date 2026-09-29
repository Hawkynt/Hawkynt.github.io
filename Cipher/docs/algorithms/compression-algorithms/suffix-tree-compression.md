# Suffix Tree Compression

> Advanced lossless compression using suffix tree construction and longest common substring analysis. Exploits repetitive structure through efficient substring matching and reference-based encoding with optimal space utilization.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Suffix Structure |
| Security status | 🎓 Educational Only |
| Complexity | Expert |
| Inventor | Edward McCreight, Esko Ukkonen |
| Year | 1976 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/suffix-tree.js`](../../../algorithms/compression/suffix-tree.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Suffix Trees](https://en.wikipedia.org/wiki/Suffix_tree)
- [Ukkonen's Algorithm](https://www.cs.helsinki.fi/u/ukkonen/SuffixT1withFigs.pdf)
- [Suffix Tree Applications](https://web.stanford.edu/~mjkay/suffix_trees.pdf)

## References

- [Linear Time Suffix Trees](https://doi.org/10.1145/74073.74089)
- [McCreight Suffix Trees](https://dl.acm.org/doi/10.1145/321879.321884)
- [Practical Suffix Trees](https://github.com/kvh/suffix-trees)
- [String Algorithms](https://www.cambridge.org/core/books/string-algorithms/)

## Test vectors

3 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/Suffix_tree)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Repetitive pattern - optimal for suffix tree](https://www.cs.helsinki.fi/u/ukkonen/SuffixT1withFigs.pdf)

| Field | Value |
| --- | --- |
| `input` | `616261626162` |
| `expected` | `06000000000261620402000000` |

**Vector 3** — [Classic suffix tree example](https://web.stanford.edu/~mjkay/suffix_trees.pdf)

| Field | Value |
| --- | --- |
| `input` | `62616e616e61` |
| `expected` | `06000000000362616e0302000000` |

---

[← All algorithms](../README.md)
