# Levenshtein Code

> Code correcting single deletion errors using balanced binary sequences. All codewords have equal number of 0s and 1s (balanced). Can correct one deletion error. Efficient for synchronization in data transmission. Related to Varshamov-Tenengolts codes but simpler construction.

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Deletion Code |
| Security status | 🎓 Educational Only |
| Complexity | Advanced |
| Inventor | Vladimir Levenshtein |
| Year | 1965 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/ecc/levenshtein-code.js`](../../../algorithms/ecc/levenshtein-code.js) |

## Security

**Status:** 🎓 Educational Only

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| Single Deletion Only | Can only correct single deletion, not multiple deletions or insertions. | — |
| Balance Requirement | Requires even-length codes with equal 0s and 1s, limiting code rate. | — |

## Documentation

- [Error Correction Zoo](https://errorcorrectionzoo.org/c/levenshtein)
- [Deletion Codes Survey](https://arxiv.org/abs/1906.08689)
- [Wikipedia - Edit Distance](https://en.wikipedia.org/wiki/Levenshtein_distance)

## References

- [Original Paper](https://ieeexplore.ieee.org/document/1054045)
- [Balanced Codes](https://link.springer.com/article/10.1007/s10623-006-9000-9)
- [Synchronization Codes](https://ieeexplore.ieee.org/document/8437800)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Levenshtein [4] balanced 1010](https://errorcorrectionzoo.org/c/levenshtein)

| Field | Value |
| --- | --- |
| `input` | `01000100` |
| `expected` | `01000100` |

**Vector 2** — [Levenshtein [4] balanced 0110](https://errorcorrectionzoo.org/c/levenshtein)

| Field | Value |
| --- | --- |
| `input` | `00010100` |
| `expected` | `00010100` |

**Vector 3** — [Levenshtein [6] balanced 101010](https://errorcorrectionzoo.org/c/levenshtein)

| Field | Value |
| --- | --- |
| `input` | `010001000100` |
| `expected` | `010001000100` |

**Vector 4** — [Levenshtein [6] balanced 110010](https://errorcorrectionzoo.org/c/levenshtein)

| Field | Value |
| --- | --- |
| `input` | `010100000100` |
| `expected` | `010100000100` |

---

[← All algorithms](../README.md)
