# Middle Square Method

> The Middle Square Method is one of the earliest pseudorandom number generators, invented by John von Neumann in 1946. It generates numbers by repeatedly squaring a value and extracting the middle digits. This method has serious statistical flaws including short cycles and can degenerate to zero, making it unsuitable for any practical use beyond historical study.

## Properties

| Property | Value |
| --- | --- |
| Category | Random Number Generators |
| Sub-category | Pseudorandom Number Generator |
| Security status | 🎓 Educational Only |
| Complexity | Beginner |
| Inventor | John von Neumann |
| Year | 1949 |
| Origin | 🇺🇸 United States |
| Source | [`algorithms/random/middle-square.js`](../../../algorithms/random/middle-square.js) |

## Parameters

| Parameter | Supported values |
| --- | --- |
| Seed sizes | 1 byte (8 bits) to 16 bytes (128 bits) |

## Capabilities

| Flag | Value |
| --- | --- |
| `IsDeterministic` | Yes |
| `IsCryptographicallySecure` | No |

## Security

**Status:** 🎓 Educational Only

No vulnerabilities are recorded for this implementation.

## Documentation

- [Wikipedia: Middle-square method](https://en.wikipedia.org/wiki/Middle-square_method)
- [von Neumann, J.: Various techniques used in connection with random digits (1951)](https://mcnp.lanl.gov/pdf_files/nbs_vonneumann.pdf)
- [History of Random Number Generation](https://www.random.org/history/)

## References

- [Applied and Computational Complex Analysis, Volume 1](https://archive.org/details/appliedcomputati01henr)
- [The Art of Computer Programming, Vol. 2: Seminumerical Algorithms](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)

## Test vectors

4 vectors ship with this algorithm and run in the test suite. Byte values are hexadecimal.

**Vector 1** — [Middle Square: seed=5772156649 (von Neumann's example, 10-digit number from 1951 paper)](https://mcnp.lanl.gov/pdf_files/nbs_vonneumann.pdf)

| Field | Value |
| --- | --- |
| `seed` | `00000001580c1ee9` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `ce6093a7418fc1a9f04b87d30da6de35 c9f9f581000000000000000000000000 0000000000000000` |

**Vector 2** — [Middle Square: seed=1 (minimal seed, demonstrates rapid degeneration to zero)](https://en.wikipedia.org/wiki/Middle-square_method)

| Field | Value |
| --- | --- |
| `seed` | `01` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `00000000000000000000000000000000 00000001000000000000000000000000 0000000000000000` |

**Vector 3** — [Middle Square: seed=12345 (short cycle demonstration)](https://www-cs-faculty.stanford.edu/~knuth/taocp.html)

| Field | Value |
| --- | --- |
| `seed` | `00003039` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `0000000000528a47d24d034ba27d5fd6 fb9e5281000000000000000000000000 0000000000000000` |

**Vector 4** — [Middle Square: seed=675248 (historical 6-digit example from literature)](https://en.wikipedia.org/wiki/Middle-square_method)

| Field | Value |
| --- | --- |
| `seed` | `000a4db0` |
| `outputSize` | `40` |
| `input` | `null` |
| `expected` | `0000006a50c8d6d1ecb41ac6a5b7c1f7 94a5b306dbc8c93e65fb09ab90a5fee0 daf7da3cbbbc1925` |

---

[← All algorithms](../README.md)
