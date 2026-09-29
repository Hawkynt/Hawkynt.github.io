# Folded Reed-Solomon

> Reed-Solomon codes with folding transformation achieving list-decoding capacity. Bundles consecutive symbols into super-symbols for improved error correction. Enables list decoding beyond the unique decoding bound up to (1-R-ε) fraction of errors. First explicit codes achieving list-decoding capacity with efficient algorithms. Educational implementation demonstrates folding concept and systematic encoding over GF(256).

## Properties

| Property | Value |
| --- | --- |
| Category | Error Correction |
| Sub-category | Algebraic Code |
| Security status | 🧪 Experimental |
| Complexity | Expert |
| Inventor | Venkatesan Guruswami, Atri Rudra |
| Year | 2006 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/ecc/folded-reed-solomon.js`](../../../algorithms/ecc/folded-reed-solomon.js) |

## Security

**Status:** 🧪 Experimental

### Known vulnerabilities

| Issue | Description | Mitigation |
| --- | --- | --- |
| List Decoding Complexity | List decoding is computationally more complex than unique decoding, requiring polynomial interpolation and root-finding. | — |
| Field Size Requirements | Requires large field sizes for good parameters. Field size must be at least n for [n,k] base RS code. | — |
| Folding Overhead | Folding reduces the code rate by factor of s (folding parameter), trading rate for list-decodability. | — |

## Documentation

- [Error Correction Zoo - Folded RS](https://errorcorrectionzoo.org/c/folded_reed_solomon)
- [Wikipedia - List Decoding](https://en.wikipedia.org/wiki/List_decoding)
- [Guruswami-Rudra Paper](https://www.cs.cmu.edu/~venkatg/pubs/papers/listdec-journ.pdf)

## References

- [Essential Coding Theory](http://www.cse.buffalo.edu/~atri/courses/coding-theory/book/)
- [List Decoding Tutorial](https://people.csail.mit.edu/madhu/ST03/scribe/lect06.pdf)
- [Folded RS Capacity](https://arxiv.org/abs/cs/0508023)

## Test vectors

5 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Folded RS [8,4] zero data round-trip](https://errorcorrectionzoo.org/c/folded_reed_solomon)

| Field | Value |
| --- | --- |
| `input` | `0000000000000000` |
| `expected` | _(empty)_ |

**Vector 2** — [Folded RS [8,4] sequential data round-trip](https://www.cs.cmu.edu/~venkatg/teaching/codingtheory/notes/notes11.pdf)

| Field | Value |
| --- | --- |
| `input` | `0102030405060708` |
| `expected` | _(empty)_ |

**Vector 3** — [Folded RS [8,4] max value data round-trip](https://arxiv.org/abs/cs/0511072)

| Field | Value |
| --- | --- |
| `input` | `fffefdfc80402010` |
| `expected` | _(empty)_ |

**Vector 4** — [Folded RS [8,4] repeated pattern round-trip](http://www.cse.buffalo.edu/~atri/courses/coding-theory/book/)

| Field | Value |
| --- | --- |
| `input` | `2a2a2a2a63636363` |
| `expected` | _(empty)_ |

**Vector 5** — [Folded RS [8,4] alternating pattern round-trip](https://errorcorrectionzoo.org/c/folded_reed_solomon)

| Field | Value |
| --- | --- |
| `input` | `01ff02fe03fd04fc` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
