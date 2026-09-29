# Fibonacci Coding

> Universal integer encoding using Fibonacci number representation. Each number is represented as a sum of non-consecutive Fibonacci numbers, terminated with '11'. More efficient than unary for larger numbers.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Universal |
| Security status | Not classified |
| Complexity | Intermediate |
| Inventor | Edouard Zeckendorf |
| Year | 1972 |
| Origin | 🇧🇪 Belgium |
| Source | [`algorithms/compression/fibonacci.js`](../../../algorithms/compression/fibonacci.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Fibonacci Coding - Wikipedia](https://en.wikipedia.org/wiki/Fibonacci_coding)
- [Zeckendorf's Theorem](https://en.wikipedia.org/wiki/Zeckendorf%27s_theorem)
- [Universal Codes Tutorial](https://web.stanford.edu/class/ee398a/handouts/lectures/05-UniversalCoding.pdf)

## References

- [Elements of Information Theory](https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959)
- [Data Compression Book](https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-809474-7)
- [Fibonacci Applications](https://www.mathsisfun.com/numbers/fibonacci-sequence.html)

## Test vectors

8 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Fibonacci coding of byte value 1 (Zeckendorf 2)](https://en.wikipedia.org/wiki/Fibonacci_coding)

| Field | Value |
| --- | --- |
| `input` | `01` |
| `expected` | `0100000060` |

**Vector 2** — [Fibonacci coding of byte value 2 (Zeckendorf 3)](https://en.wikipedia.org/wiki/Fibonacci_coding)

| Field | Value |
| --- | --- |
| `input` | `02` |
| `expected` | `0100000030` |

**Vector 3** — [Fibonacci coding of byte value 6 (Zeckendorf 7 = 5+2)](https://cp-algorithms.com/algebra/fibonacci-numbers.html)

| Field | Value |
| --- | --- |
| `input` | `06` |
| `expected` | `0100000058` |

**Vector 4** — [Fibonacci coding of byte value 8 (Zeckendorf 9 = 8+1)](https://cp-algorithms.com/algebra/fibonacci-numbers.html)

| Field | Value |
| --- | --- |
| `input` | `08` |
| `expected` | `010000008c` |

**Vector 5** — [Fibonacci coding of byte value 11 (Zeckendorf 12 = 8+3)](https://www.geeksforgeeks.org/fibonacci-coding/)

| Field | Value |
| --- | --- |
| `input` | `0b` |
| `expected` | `01000000ac` |

**Vector 6** — All byte values 0-255 round-trip test

Source: Regression test for byte 0/1 codeword collision

| Field | Value |
| --- | --- |
| `input` | `000102030405060708090a0b0c0d0e0f 101112131415161718191a1b1c1d1e1f 202122232425262728292a2b2c2d2e2f 303132333435363738393a3b3c3d3e3f 404142434445464748494a4b4c4d4e4f 505152535455565758595a5b5c5d5e5f 606162636465666768696a6b6c6d6e6f 707172737475767778797a7b7c7d7e7f 808182838485868788898a8b8c8d8e8f 909192939495969798999a9b9c9d9e9f a0a1a2a3a4a5a6a7a8a9aaabacadaeaf b0b1b2b3b4b5b6b7b8b9babbbcbdbebf c0c1c2c3c4c5c6c7c8c9cacbcccdcecf d0d1d2d3d4d5d6d7d8d9dadbdcdddedf e0e1e2e3e4e5e6e7e8e9eaebecedeeef f0f1f2f3f4f5f6f7f8f9fafbfcfdfeff` |
| `expected` | _(empty)_ |

**Vector 7** — Pseudo-random data round-trip test

Source: Regression test for byte 0/1 codeword collision

| Field | Value |
| --- | --- |
| `input` | `f3ccbfab9d8fe554efb09bd0b0f5ba94 8035b768414265947a6b83c1414fe53a 321915d231a7468a060cbf21437ca17a 41025ccf252088f87f924ecff37e92df …` (300 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

**Vector 8** — Alternating pattern round-trip test

Source: Regression test for byte 0/1 codeword collision

| Field | Value |
| --- | --- |
| `input` | `aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55 aa55aa55aa55aa55aa55aa55aa55aa55` |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
