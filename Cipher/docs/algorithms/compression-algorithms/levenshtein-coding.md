# Levenshtein Coding

> Universal prefix code for non-negative integers. Recursively encodes the bit-length of the bit-length (an iterated-logarithm chain) terminated by zero, so arbitrarily large integers can be represented with a self-delimiting code.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Universal Codes |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Vladimir I. Levenshtein |
| Year | 1968 |
| Origin | 🇷🇺 Russia |
| Source | [`algorithms/compression/levenshtein-coding.js`](../../../algorithms/compression/levenshtein-coding.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Levenshtein coding - Wikipedia](https://en.wikipedia.org/wiki/Levenshtein_coding)
- [Punctured Elias Codes for variable-length coding of the integers (Fenwick, 1996)](https://www.cs.auckland.ac.nz/~peter-f/FTPfiles/TechRep137.ps)
- [Universal code (data compression) - Wikipedia](https://en.wikipedia.org/wiki/Universal_code_(data_compression))

## References

- [V.I. Levenshtein, 'On the Redundancy and Delay of Separable Codes for the Natural Numbers' (1968)](https://en.wikipedia.org/wiki/Levenshtein_coding#History)
- [Elias omega coding (related recursive universal code)](https://en.wikipedia.org/wiki/Elias_omega_coding)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/Boundary_condition)

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single small value - byte 1 (encodes value 2, code '1100')](https://en.wikipedia.org/wiki/Levenshtein_coding)

| Field | Value |
| --- | --- |
| `input` | `01` |
| `expected` | `01000000c0` |

**Vector 3** — [Canonical worked examples - byte values 0,1,2,3,7,8](https://en.wikipedia.org/wiki/Levenshtein_coding)

| Field | Value |
| --- | --- |
| `input` | `000102030708` |
| `expected` | `06000000b378747480` |

**Vector 4** — [Text sample - 'AB3'](https://en.wikipedia.org/wiki/Levenshtein_coding)

| Field | Value |
| --- | --- |
| `input` | `414233` |
| `expected` | `03000000f20bc83f1a00` |

---

[← All algorithms](../README.md)
