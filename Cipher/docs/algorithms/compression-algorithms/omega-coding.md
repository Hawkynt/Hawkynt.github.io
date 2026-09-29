# Omega Coding

> Universal code for positive integers with self-delimiting property. Efficient encoding scheme for integers with unknown probability distribution, using recursive length encoding.

## Properties

| Property | Value |
| --- | --- |
| Category | Compression Algorithms |
| Sub-category | Universal Codes |
| Security status | 🎓 Educational Only |
| Complexity | Intermediate |
| Inventor | Peter Elias |
| Year | 1975 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/compression/omega.js`](../../../algorithms/compression/omega.js) |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Universal Code Wikipedia](https://en.wikipedia.org/wiki/Universal_code_(data_compression))
- [Elias Omega Coding](https://en.wikipedia.org/wiki/Elias_omega_coding)

## References

- [Universal Coding Theory](https://web.stanford.edu/class/ee376a/files/2017-18/lecture_4.pdf)
- [Information Theory Course](https://ocw.mit.edu/courses/electrical-engineering-and-computer-science/)
- [Data Compression Explained](https://www.data-compression.com/theory.shtml)
- [Coding Theory Resources](https://michaeldipperstein.github.io/omega.html)

## Test vectors

7 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Empty input](https://en.wikipedia.org/wiki/Universal_code_(data_compression))

| Field | Value |
| --- | --- |
| `input` | _(empty)_ |
| `expected` | `00000000` |

**Vector 2** — [Single byte value](https://en.wikipedia.org/wiki/Elias_omega_coding)

| Field | Value |
| --- | --- |
| `input` | `41` |
| `expected` | `01000000b420` |

**Vector 3** — [Repeated byte values](https://en.wikipedia.org/wiki/Elias_omega_coding)

| Field | Value |
| --- | --- |
| `input` | `4141` |
| `expected` | `02000000b425a100` |

**Vector 4** — [Two different byte values](https://en.wikipedia.org/wiki/Elias_omega_coding)

| Field | Value |
| --- | --- |
| `input` | `4142` |
| `expected` | `02000000b425a180` |

**Vector 5** — [Three different byte values](https://en.wikipedia.org/wiki/Elias_omega_coding)

| Field | Value |
| --- | --- |
| `input` | `414243` |
| `expected` | `03000000b425a1ad10` |

**Vector 6** — [Hello string bytes](https://en.wikipedia.org/wiki/Elias_omega_coding)

| Field | Value |
| --- | --- |
| `input` | `48656c6c6f` |
| `expected` | `05000000b495b32db56dab7000` |

**Vector 7** — [Sequential small values](https://en.wikipedia.org/wiki/Elias_omega_coding)

| Field | Value |
| --- | --- |
| `input` | `0102030405` |
| `expected` | `050000009a8aac` |

---

[← All algorithms](../README.md)
