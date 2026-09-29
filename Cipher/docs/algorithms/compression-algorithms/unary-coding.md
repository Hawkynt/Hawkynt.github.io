# Unary Coding

> Universal integer coding where number n is represented by n-1 ones followed by a zero. Simple but inefficient for large numbers, mainly used in combination with other codes or for very small values.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Universal |
| Security status | Not classified |
| Complexity | Not specified |
| Inventor | Information Theory (fundamental) |
| Year | 1940 |
| Origin | ❓ Unknown |
| Source | [`algorithms/compression/unary.js`](../../../algorithms/compression/unary.js) |

## Security

**Status:** not classified — treat as unverified.

No vulnerabilities are recorded for this implementation.

## Documentation

- [Unary Coding - Wikipedia](https://en.wikipedia.org/wiki/Unary_coding)
- [Universal Codes Tutorial](https://web.stanford.edu/class/ee398a/handouts/lectures/05-UniversalCoding.pdf)
- [Information Theory Basics](https://www.inference.org.uk/itprnn/book.pdf)

## References

- [Elements of Information Theory](https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959)
- [Data Compression Book](https://www.data-compression.com/theory.html)
- [Coding Theory Reference](https://www.cambridge.org/core/books/introduction-to-coding-theory/)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Small values - optimal for unary](https://en.wikipedia.org/wiki/Unary_coding)

| Field | Value |
| --- | --- |
| `input` | `01020304` |
| `expected` | `04000000b778` |

**Vector 2** — Single small value

Source: Educational test

| Field | Value |
| --- | --- |
| `input` | `05` |
| `expected` | `01000000f8` |

**Vector 3** — Mixed small values

Source: Educational test

| Field | Value |
| --- | --- |
| `input` | `01030201` |
| `expected` | `04000000bb40` |

**Vector 4** — [Large repetitive block (1024x 0x61) - regression for symbol-count header overflow](https://en.wikipedia.org/wiki/Unary_coding)

| Field | Value |
| --- | --- |
| `roundTripOnly` | Yes |
| `input` | `61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 61616161616161616161616161616161 …` (1024 bytes; the full value is in the source) |
| `expected` | _(empty)_ |

---

[← All algorithms](../README.md)
