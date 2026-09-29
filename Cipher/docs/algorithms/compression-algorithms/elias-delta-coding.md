# Elias Delta Coding

> Peter Elias improved universal integer encoding, more efficient than Gamma for larger numbers using variable-length prefix codes.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Universal |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Peter Elias |
| Year | 1975 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/elias-delta.js`](../../../algorithms/compression/elias-delta.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Universal codeword sets and representations of the integers](https://ieeexplore.ieee.org/document/1054906)
- [Elias Delta Coding - Wikipedia](https://en.wikipedia.org/wiki/Elias_delta_coding)
- [Information Theory and Coding](https://web.stanford.edu/class/ee376a/)

## References

- [Elements of Information Theory](https://www.wiley.com/en-us/Elements+of+Information+Theory%2C+2nd+Edition-p-9780471241959)
- [Introduction to Data Compression](https://www.elsevier.com/books/introduction-to-data-compression/sayood/978-0-12-620862-7)

## Test vectors

2 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Small integer sequence](https://en.wikipedia.org/wiki/Elias_delta_coding)

| Field | Value |
| --- | --- |
| `input` | `0102030405` |
| `expected` | `0500000045635c` |

**Vector 2** — Mixed small and large values

Source: Boundary value test

| Field | Value |
| --- | --- |
| `input` | `7f8081ff` |
| `expected` | `040000001000401100848000` |

---

[← All algorithms](../README.md)
